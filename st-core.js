/* Finite ST scoring exercises, not an ongoing-game solver. No DOM, RNG or clock.
 * Fixtures: Hard Drop ST Stacking, revision 37604, diagrams 0/1/4/9/10/13–16,
 * mirrored into Shocky's right-Z/T convention. See ST-LAB.md for provenance.
 */
'use strict';
const STCore = (() => {
  const VERSION = 'st-core-srs-plus-1';
  const EMPTY = '..........';
  const notch = ['######....', '#######...', '#######...'];
  const residual = '#######.#.';
  const pad = rows => [...Array(40 - rows.length).fill(EMPTY), ...rows];
  const copy = value => JSON.parse(JSON.stringify(value));
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const cellKey = cells => cells.map(([x,y]) => y * 10 + x).sort((a,b) => a-b).join(',');
  const sameHeap = (a,b) => a.length === b.length && a.every((row,i) => row === b[i]);
  const catalog = freeze([
    { id:'cap', title:'Cap → T-spin double', description:'Nine prebuilt notch rows; cap with Z, then make one non-mini T-spin double. The residual row is the finish, not a replenished stack.', kind:'cap', height:0 },
    { id:'spin', title:'Capped notch → T-spin double', description:'The Z cap is supplied. Rotate T under it for one non-mini double.', kind:'spin', height:0 },
    { id:'cap-high', title:'Three residual rows → one more double', description:'The source notch is raised over three residual rows. One Z/T cycle leaves four pocket rows; this exercise ends there.', kind:'cap', height:3 },
    { id:'pocket', title:'Pocket I → well I', description:'Four residual rows under six supplied notch rows. Fill the rightmost pocket, then clear the four-row well with the next accessible I.', kind:'pocket' },
    { id:'well', title:'Filled pocket → well quad', description:'The source diagram supplies the filled pocket and upper stack. Clear the four-row well with I.', kind:'well' },
  ]);

  // Capture immutable rule tables explicitly, rather than reading live game globals
  // during search. The adapter passes the actual project's matrices and SRS+ kicks.
  function create(pieces, kicks) {
    const shapes = freeze(copy(pieces));
    const kickTable = freeze(copy(kicks));
    const offsets = Object.fromEntries(Object.entries(shapes).map(([kind,rs]) => [kind,rs.map(matrix =>
      matrix.flatMap((row,y) => row.flatMap((v,x) => v ? [[x,y]] : [])))]));
    const cellsAt = (kind,p) => offsets[kind][p.rotation].map(([x,y]) => [x+p.x,y+p.y]);
    const free = (heap,kind,p) => cellsAt(kind,p).every(([x,y]) => x>=0 && x<10 && y>=0 && y<40 && heap[y][x]==='.');
    function placed(heap,cells) {
      const rows = heap.map(row => [...row]);
      for (const [x,y] of cells) rows[y][x]='#';
      const remaining = rows.filter(row => row.some(c => c==='.' )).map(row => row.join(''));
      return { heap:pad(remaining), cleared:40-remaining.length };
    }
    function spin(heap,p) {
      const corners = [[p.x,p.y+1],[p.x+2,p.y+1],[p.x+2,p.y+3],[p.x,p.y+3]];
      const occupied = corners.map(([x,y]) => x<0 || x>=10 || y>=40 || (y>=0 && heap[y][x]==='#'));
      const tspin = p.rotated && occupied.filter(Boolean).length >= 3;
      return { tspin, mini:tspin && !(occupied[p.rotation] && occupied[(p.rotation+1)%4]) };
    }
    const families = new Map();
    for (const exercise of catalog) {
      let heap;
      const rules = [];
      if (exercise.kind==='cap' || exercise.kind==='spin') {
        heap = pad([...notch,...notch,...notch,...Array(exercise.height).fill(residual)]);
        const y = 37-exercise.height;
        const capCells = [[9,y],[8,y+1],[9,y+1],[8,y+2]];
        if (exercise.kind==='spin') heap=placed(heap,capCells).heap;
        else rules.push({kind:'Z',cells:capCells,rule:'uncapped-pocket-cap',cleared:0,explanation:'Cap the pocket with Z; the next supported step is a T-spin double.'});
        rules.push({kind:'T',cells:[[6,y],[7,y],[8,y],[7,y+1]],rule:'capped-pocket-tsd',cleared:2,tspin:true,explanation:'Rotate T into the notch. Finish grounded on a rotation, then hard drop for a non-mini double.'});
      } else if (exercise.kind==='pocket') {
        heap=pad([...notch,...notch,...Array(4).fill(residual)]);
        rules.push({kind:'I',cells:[[9,36],[9,37],[9,38],[9,39]],rule:'uncapped-pocket-I',cleared:0,explanation:'Fill the rightmost pocket before the well. This I clears no lines.'});
        rules.push({kind:'I',cells:[[7,36],[7,37],[7,38],[7,39]],rule:'well-I-quad',cleared:4,explanation:'Clear the four-row well with I.'});
      } else {
        heap=pad([...notch,...notch,residual,...Array(4).fill('#######.##')]);
        rules.push({kind:'I',cells:[[7,36],[7,37],[7,38],[7,39]],rule:'well-I-quad',cleared:4,explanation:'Clear the four-row well with I.'});
      }
      const stages=[heap];
      for(const rule of rules) {
        const next=placed(stages.at(-1),rule.cells);
        if(next.cleared!==rule.cleared) throw new Error('Invalid ST fixture clear count');
        stages.push(next.heap);
      }
      families.set(exercise.id,freeze({stages,rules}));
    }
    function certificate(input) {
      const state=input.strategy, family=families.get(state?.exerciseId);
      if (!family || state.version!==VERSION || state.orientation!=='right-ZT' || !Number.isInteger(state.stage) || !family.stages[state.stage]) return null;
      if (!Array.isArray(input.heap) || !sameHeap(input.heap,family.stages[state.stage])) return null;
      return family;
    }
    function exercise(id,variant='held') {
      const family=families.get(id);
      if (!family || !['active','held','empty','no-fit'].includes(variant)) return null;
      const first=family.rules[0].kind, second=family.rules[1]?.kind || 'O';
      let active=first, hold=second, next=['O','I','J','L','S','T'];
      if (variant==='held') { active=second; hold=first; }
      if (variant==='empty') { active=second; hold=''; next=[first,'O','I','J','L','S']; }
      if (variant==='no-fit') { active='O'; hold='J'; next=[first,'T','I','S','L','O']; }
      return { heap:copy(family.stages[0]), active, hold, next,
        strategy:{version:VERSION,orientation:'right-ZT',exerciseId:id,stage:0} };
    }
    function supported(input) {
      if (input?.rules?.version!==VERSION || input.rules.mode!=='practice' || input.rules.kickset!=='SRS+' || input.rules.gravity!==false || input.holdRule!=='unlimited-swap') return false;
      const instance=p => p && typeof p.id==='string' && /^[IJLOSTZ]$/.test(p.kind);
      if (!instance(input.active) || (input.hold!==null && !instance(input.hold)) || !Array.isArray(input.visibleNext) || input.visibleNext.length>6 || !input.visibleNext.every(instance)) return false;
      const ids=[input.active,input.hold,...input.visibleNext].filter(Boolean).map(p=>p.id);
      if (new Set(ids).size!==ids.length) return false;
      const p=input.active;
      return [p.x,p.y,p.rotation].every(Number.isInteger) && p.rotation>=0 && p.rotation<4 && typeof p.lastAction==='string';
    }
    function options(input) {
      const spawn = instance => ({...instance,x:3,y:17,rotation:0,lastAction:'HOLD'});
      const list=[{active:input.active,hold:input.hold,next:input.visibleNext,prelude:[],from:'active'}];
      const held=input.hold || input.visibleNext[0];
      if (held) {
        const next=input.hold ? input.visibleNext : input.visibleNext.slice(1);
        list.push({active:spawn(held),hold:input.active,next,prelude:['hold'],from:input.hold?'hold':'next-0'});
        list.push({active:spawn(input.active),hold:held,next,prelude:['hold','hold'],from:'active'});
      }
      return list;
    }
    function pathTo(heap,active,rule,budget) {
      if (active.kind!==rule.kind || !free(heap,active.kind,active)) return null;
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
            return {pose:{x:p.x,y:p.y,rotation:p.rotation},path,lastAction:p.rotated?'ROT':'other'};
          }
        }
        // Order is versioned policy: a stable shortest path, including grounded rotations.
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
      return null;
    }
    function candidates(input,family,budget) {
      const rule=family.rules[input.strategy.stage];
      const found=[];
      for(const choice of options(input)) {
        const path=pathTo(input.heap,choice.active,rule,budget);
        if(path) found.push({...choice,...path,rule});
        if(budget.exhausted) break;
      }
      return found;
    }
    function advise(input) {
      const abstain=(reason,explanation,diagnostics)=>({kind:'abstain',reason,explanation,...(diagnostics?{diagnostics}:{})});
      if (!supported(input)) return abstain('unsupported','This lab requires practice, SRS+, gravity off and ordinary tetrominoes with the current unlimited-hold rules.');
      const family=certificate(input);
      if(!family) return abstain('unsupported','This board or exercise state is outside the certified finite drill. Normal play remains available.');
      if(input.strategy.stage===family.rules.length) return {kind:'exercise-complete',explanation:'Finite exercise complete. The stack is not automatically rebuilt. Choose another exercise or return to practice.'};
      if(!free(input.heap,input.active.kind,input.active)) return abstain('unsupported','The active piece overlaps the heap or lies outside the field.');
      const limits={maxPoseStates:30000,maxLockStates:128,depth:2,...input.limits};
      if(!Number.isInteger(limits.maxPoseStates)||limits.maxPoseStates<0||limits.maxPoseStates>30000||!Number.isInteger(limits.maxLockStates)||limits.maxLockStates<0||limits.maxLockStates>128||![1,2].includes(limits.depth)) return abstain('unsupported','Invalid work limits: at most 30,000 poses, 128 verified locks and two locks of lookahead.');
      const budget={poses:0,locks:0,maxPoses:limits.maxPoseStates,maxLocks:limits.maxLockStates,exhausted:false};
      const found=candidates(input,family,budget);
      for(const candidate of found) {
        candidate.continuation=0;
        const stage=input.strategy.stage+1;
        if(stage===family.rules.length) candidate.continuation=1;
        else if(limits.depth===2 && candidate.next.length && !budget.exhausted) {
          const future={...input,heap:family.stages[stage],active:{...candidate.next[0],x:3,y:17,rotation:0,lastAction:candidate.lastAction},hold:candidate.hold,visibleNext:candidate.next.slice(1),strategy:{...input.strategy,stage}};
          candidate.continuation=Number(candidates(future,family,budget).length>0);
        }
      }
      const diagnostics={poseStates:budget.poses,lockStates:budget.locks,depth:limits.depth};
      if(budget.exhausted) return abstain('budget-exhausted','The declared search limit was reached. No verified decision is available; this does not prove impossibility.',diagnostics);
      if(!found.length) return abstain('no-core-fit-found',`No reachable core-loop fit found for ${input.active.kind}${input.hold?' / held '+input.hold.kind:''}. Preview is ordered lookahead, not a piece menu. Normal play remains available.`,diagnostics);
      found.sort((a,b)=>b.continuation-a.continuation || a.prelude.length-b.prelude.length || a.path.length-b.path.length || a.pose.rotation-b.pose.rotation || a.pose.x-b.pose.x || a.pose.y-b.pose.y);
      const best=found[0];
      return {kind:'target',piece:{id:best.active.id,kind:best.active.kind},from:best.from,prelude:best.prelude,path:best.path,pose:best.pose,cells:copy(best.rule.cells),rule:best.rule.rule,explanation:best.rule.explanation,continuationVerified:Boolean(best.continuation),afterMatchingLock:{...input.strategy,stage:input.strategy.stage+1},diagnostics};
    }
    // Called after an ACTUAL lock, even when display is off. A display/hold never
    // advances the certificate. Compare cells, real scoring AND the entire heap.
    function advance(input,lock) {
      if(!supported(input)) return null;
      const family=certificate(input),rule=family?.rules[input.strategy?.stage];
      if(!rule || lock.kind!==rule.kind || lock.kind!==input.active.kind || ![lock.x,lock.y,lock.rotation].every(Number.isInteger) || lock.rotation<0 || lock.rotation>3) return null;
      if(cellKey(cellsAt(lock.kind,lock))!==cellKey(rule.cells) || lock.cleared!==rule.cleared || (rule.tspin && (!lock.tspin || lock.mini || lock.lastAction!=='ROT'))) return null;
      const stage=input.strategy.stage+1;
      if(!Array.isArray(lock.heap) || !sameHeap(lock.heap,family.stages[stage])) return null;
      return {...input.strategy,stage};
    }
    return Object.freeze({advise,advance,exercise});
  }
  // Match zztetris.js's actual seven-raw-entry loop and six-slot canvas clipping.
  // Reject ambiguous multi-marker/custom input rather than exposing hidden pieces.
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
  return Object.freeze({version:VERSION,exercises:catalog,create,visiblePreview});
})();
