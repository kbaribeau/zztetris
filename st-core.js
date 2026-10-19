/* Bounded right-sided ST scoring recognition. No DOM, RNG, clock or play history.
 * Geometry/provenance and deliberately unadvised gaps: ST-LAB.md.
 */
'use strict';
const STCore = (() => {
  const VERSION = 'st-free-play-srs-plus-2';
  const copy = value => JSON.parse(JSON.stringify(value));
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const cellKey = cells => cells.map(([x,y]) => y * 10 + x).sort((a,b) => a-b).join(',');

  function create(pieces, kicks) {
    // Immutable copies of the actual engine's matrices and ordered SRS+ kicks.
    const shapes = freeze(copy(pieces)), kickTable = freeze(copy(kicks));
    const offsets = Object.fromEntries(Object.entries(shapes).map(([kind,rs]) => [kind,rs.map(matrix =>
      matrix.flatMap((row,y) => row.flatMap((v,x) => v ? [[x,y]] : [])))]));
    const cellsAt = (kind,p) => offsets[kind][p.rotation].map(([x,y]) => [x+p.x,y+p.y]);
    const free = (heap,kind,p) => cellsAt(kind,p).every(([x,y]) => x>=0 && x<10 && y>=0 && y<40 && heap[y][x]==='.');
    const empty = (heap,cells) => cells.every(([x,y]) => heap[y]?.[x]==='.');
    function placed(heap,cells) {
      const rows = heap.map(row => [...row]);
      for (const [x,y] of cells) rows[y][x]='#';
      const remaining = rows.filter(row => row.includes('.')).map(row => row.join(''));
      return {heap:[...Array(40-remaining.length).fill('..........'),...remaining],cleared:40-remaining.length};
    }
    function spin(heap,p) {
      const corners = [[p.x,p.y+1],[p.x+2,p.y+1],[p.x+2,p.y+3],[p.x,p.y+3]];
      const occupied = corners.map(([x,y]) => x<0 || x>=10 || y>=40 || (y>=0 && heap[y][x]==='#'));
      const tspin = p.rotated && occupied.filter(Boolean).length >= 3;
      return {tspin,mini:tspin && !(occupied[p.rotation] && occupied[(p.rotation+1)%4])};
    }
    const spawn = instance => ({...instance,x:3,y:17,rotation:0,lastAction:'HOLD'});
    function supported(input) {
      if (input?.rules?.version!==VERSION || input.rules.mode!=='st-lab' || input.rules.kickset!=='SRS+' || input.rules.gravity!==false || input.holdRule!=='unlimited-swap') return false;
      // A pre-existing full row is not an ordinary post-lock board. Don't count
      // unrelated editor-created full rows toward an advertised scoring action.
      if (!Array.isArray(input.heap) || input.heap.length!==40 || !input.heap.every(row=>typeof row==='string' && /^[.#]{10}$/.test(row) && row.includes('.'))) return false;
      const instance=p => p && typeof p.id==='string' && /^[IJLOSTZ]$/.test(p.kind);
      if (!instance(input.active) || (input.hold!==null && !instance(input.hold)) || !Array.isArray(input.visibleNext) || input.visibleNext.length>6 || !input.visibleNext.every(instance)) return false;
      const ids=[input.active,input.hold,...input.visibleNext].filter(Boolean).map(p=>p.id);
      if (new Set(ids).size!==ids.length) return false;
      const p=input.active;
      return [p.x,p.y,p.rotation].every(Number.isInteger) && p.rotation>=0 && p.rotation<4 && typeof p.lastAction==='string';
    }
    function options(input) {
      if (!free(input.heap,input.active.kind,input.active)) return [];
      const list=[{active:input.active,hold:input.hold,next:input.visibleNext,prelude:[],from:'active'}];
      const held=input.hold || input.visibleNext[0];
      if (held && free(input.heap,held.kind,spawn(held))) {
        const next=input.hold ? input.visibleNext : input.visibleNext.slice(1);
        list.push({active:spawn(held),hold:input.active,next,prelude:['hold'],from:input.hold?'hold':'next-0'});
        if (free(input.heap,input.active.kind,spawn(input.active)))
          list.push({active:spawn(input.active),hold:held,next,prelude:['hold','hold'],from:'active'});
      }
      return list;
    }
    function pathTo(heap,active,rule,budget) {
      if (active.kind!==rule.kind || !free(heap,active.kind,active)) return null;
      const cacheKey=JSON.stringify([heap,active.kind,active.x,active.y,active.rotation,active.lastAction==='ROT',rule.cells,!!rule.tspin]);
      if(budget.paths.has(cacheKey)) return budget.paths.get(cacheKey);
      const goal=cellKey(rule.cells), start={x:active.x,y:active.y,rotation:active.rotation,rotated:active.lastAction==='ROT',parent:-1};
      const key=p=>`${p.x},${p.y},${p.rotation},${Number(p.rotated)}`;
      const queue=[start],seen=new Set([key(start)]);
      for(let head=0;head<queue.length;head++) {
        if (budget.poses>=budget.maxPoses) { budget.exhausted=true; return null; }
        budget.poses++;
        const p=queue[head];
        if (cellKey(cellsAt(active.kind,p))===goal && !free(heap,active.kind,{...p,y:p.y+1})) {
          const scoring=spin(heap,p);
          if (!rule.tspin || (scoring.tspin && !scoring.mini)) {
            if (budget.locks>=budget.maxLocks) { budget.exhausted=true; return null; }
            budget.locks++;
            const path=['HD']; let node=p;
            while(node.parent!==-1) {path.unshift(node.action);node=queue[node.parent];}
            const result={pose:{x:p.x,y:p.y,rotation:p.rotation},path};
            budget.paths.set(cacheKey,result);
            return result;
          }
        }
        for(const action of ['L','R','SD','CW','CCW','R180']) {
          let n=null;
          if (action==='L'||action==='R'||action==='SD') {
            const candidate={...p,x:p.x+(action==='L'?-1:action==='R'?1:0),y:p.y+(action==='SD'?1:0),rotated:false};
            if(free(heap,active.kind,candidate)) n=candidate;
          } else {
            const rotation=(p.rotation+{CW:1,CCW:3,R180:2}[action])%4;
            for(const [dx,dy] of kickTable[`${active.kind==='I'?'I':'N'}${p.rotation}-${rotation}`]) {
              const candidate={x:p.x+dx,y:p.y-dy,rotation,rotated:true};
              if(free(heap,active.kind,candidate)) {n=candidate;break;}
            }
          }
          if(n && !seen.has(key(n))) {seen.add(key(n));queue.push({...n,parent:head,action});}
        }
      }
      budget.paths.set(cacheKey,null);
      return null;
    }
    // Translate local targets through the visible field. Whole affected rows,
    // supports, lock results and reachability matter; unrelated filler does not.
    // Setup hints must also leave a reachable scoring shape, but that virtual
    // shape is NOT evidence that the player has the next required piece.
    function geometry(heap) {
      const rules=[];
      const accept=rule=> {
        if(!empty(heap,rule.cells))return;
        const after=placed(heap,rule.cells);
        if(after.cleared===rule.cleared)rules.push({...rule,after:after.heap});
      };
      for(let y=37;y>=18;y--) {
        const cap=[[9,y],[8,y+1],[9,y+1],[8,y+2]];
        const t={kind:'T',cells:[[6,y],[7,y],[8,y],[7,y+1]],rule:'capped-pocket-tsd',cleared:2,tspin:true,
          explanation:'Rotate T into the notch; finish grounded on a rotation, then hard drop for a non-mini double.'};
        const capped=board=>cap.every(([x,r])=>board[r][x]==='#') && board[y+2][6]==='#' && board[y+2][7]==='.' && board[y+2][9]==='.';
        if(capped(heap))accept(t);
        if(empty(heap,cap) && empty(heap,t.cells)) {
          const after=placed(heap,cap);
          if(after.cleared===0 && capped(after.heap) && placed(after.heap,t.cells).cleared===2) {
            accept({kind:'Z',cells:cap,rule:'uncapped-pocket-cap',cleared:0,follow:t,
              explanation:'Z caps a reachable double-shaped notch, clearing no lines. This alone does not establish a sustainable stack.'});
          }
        }
      }
      for(let y=36;y>=18;y--) {
        const well={kind:'I',cells:[0,1,2,3].map(d=>[7,y+d]),rule:'well-I-quad',cleared:4,
          explanation:'This I clears the four-row right-side well for a quad.'};
        if(heap.slice(y,y+4).every(row=>row==='#######.##'))accept(well);
        if(heap.slice(y,y+4).every(row=>row==='#######.#.'))accept({kind:'I',cells:[0,1,2,3].map(d=>[9,y+d]),rule:'uncapped-pocket-I',cleared:0,follow:well,
          explanation:'Fill this four-cell right pocket with I, clearing no lines. The resulting well can fit a quad; another I is not guaranteed.'});
      }
      return rules;
    }
    function advise(input) {
      const abstain=(reason,explanation,diagnostics)=>({kind:'abstain',reason,explanation,...(diagnostics?{diagnostics}:{})});
      if (!supported(input)) return abstain('unsupported','Advice requires ST lab, SRS+, gravity off and a valid ordinary-piece board/preview. Normal play remains available.');
      if(!free(input.heap,input.active.kind,input.active)) return abstain('unsupported','The active piece overlaps the heap or lies outside the field.');
      const limits={maxPoseStates:30000,maxLockStates:128,depth:2,...input.limits};
      if(!Number.isInteger(limits.maxPoseStates)||limits.maxPoseStates<0||limits.maxPoseStates>30000||!Number.isInteger(limits.maxLockStates)||limits.maxLockStates<0||limits.maxLockStates>128||![1,2].includes(limits.depth)) return abstain('unsupported','Invalid work limits: at most 30,000 poses, 128 verified locks and two locks of lookahead.');
      const budget={poses:0,locks:0,maxPoses:limits.maxPoseStates,maxLocks:limits.maxLockStates,exhausted:false,paths:new Map()};
      const found=[];
      for(const rule of geometry(input.heap)) {
        if(budget.exhausted)break;
        // First require a legally accessible immediate piece, before spending
        // work verifying hypothetical setup geometry.
        const choices=options(input).filter(choice=>choice.active.kind===rule.kind);
        if(!choices.length)continue;
        if(rule.follow && (!empty(rule.after,rule.follow.cells) || placed(rule.after,rule.follow.cells).cleared!==rule.follow.cleared ||
          !pathTo(rule.after,spawn({kind:rule.follow.kind}),rule.follow,budget)))continue;
        for(const choice of choices) {
          if(budget.exhausted)break;
          const path=pathTo(input.heap,choice.active,rule,budget);
          if(!path)continue;
          let continuation=null;
          if(rule.follow && limits.depth===2 && choice.next.length) {
            const future={heap:rule.after,active:spawn(choice.next[0]),hold:choice.hold,visibleNext:choice.next.slice(1)};
            for(const access of options(future)) {
              if(pathTo(rule.after,access.active,rule.follow,budget)) {continuation={piece:copy(access.active),rule:rule.follow.rule};break;}
              if(budget.exhausted)break;
            }
          }
          found.push({...choice,...path,rule,continuation});
        }
      }
      const diagnostics={poseStates:budget.poses,lockStates:budget.locks,depth:limits.depth};
      if(budget.exhausted) return abstain('budget-exhausted','Search limit reached; no verified decision. This does not prove impossibility.',diagnostics);
      if(!found.length) return abstain('no-core-fit-found','No verified scoring hint for the current board and accessible pieces. Build and maintain your stack; opener, filler and recovery moves are unadvised.',diagnostics);
      found.sort((a,b)=>Number(!!b.continuation)-Number(!!a.continuation) || a.prelude.length-b.prelude.length || a.path.length-b.path.length || a.pose.rotation-b.pose.rotation || a.pose.x-b.pose.x || a.pose.y-b.pose.y);
      const best=found[0];
      return {kind:'target',piece:{id:best.active.id,kind:best.active.kind},from:best.from,prelude:best.prelude,path:best.path,pose:best.pose,cells:copy(best.rule.cells),rule:best.rule.rule,
        expected:{cleared:best.rule.cleared,tspin:!!best.rule.tspin,mini:false},explanation:best.rule.explanation,
        continuationVerified:!!best.continuation,continuation:best.continuation,diagnostics};
    }
    return Object.freeze({advise});
  }
  // Match the renderer's seven-raw-entry loop and six-slot canvas clipping.
  function visiblePreview(queue) {
    let separator=false;
    const visible=[];
    for(let i=0;i<Math.min(7,queue.length);i++) {
      if(queue[i]==='|') {if(separator)return null;separator=true;continue;}
      const slot=i-Number(separator);
      if(slot>=0 && slot<6) {
        if(!/^[IJLOSTZ]$/.test(queue[i]))return null;
        visible.push(queue[i]);
      }
    }
    return visible;
  }
  return Object.freeze({version:VERSION,create,visiblePreview});
})();
