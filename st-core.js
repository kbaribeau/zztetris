/* Finite right-scoring ST continuation search. Independent implementation;
 * actual matrices/kicks are supplied by the trainer. See ST-LAB.md for the
 * endpoint contract, heuristic pruning and deliberately unverified futures. */
'use strict';
const STCore = (() => {
  const VERSION='st-continuation-srs-plus-1';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const cellKey=cells=>cells.map(([x,y])=>y*10+x).sort((a,b)=>a-b).join(',');
  const DEFAULTS=Object.freeze({depth:3,maxPoseStates:60000,maxLockStates:600,maxCandidates:120000,width:12});
  function create(pieces,kicks) {
    const shapes=copy(pieces),table=copy(kicks);
    const offsets=Object.fromEntries(Object.entries(shapes).map(([kind,rs])=>[kind,rs.map(m=>m.flatMap((row,y)=>row.flatMap((v,x)=>v?[[x,y]]:[])))]));
    const cellsAt=(kind,p)=>offsets[kind][p.rotation].map(([x,y])=>[x+p.x,y+p.y]);
    function free(heap,kind,p) {
      for(const [dx,dy] of offsets[kind][p.rotation]) {
        const x=p.x+dx,y=p.y+dy;
        if(x<0||x>=10||y<0||y>=40||heap[y][x]!=='.')return false;
      }
      return true;
    }
    const spawn=p=>({...p,x:3,y:17,rotation:0,lastAction:'HOLD'});
    function supported(s) {
      if(s?.rules?.version!==VERSION||s.rules.mode!=='st-lab'||s.rules.kickset!=='SRS+'||s.rules.gravity!==false||s.holdRule!=='unlimited-swap')return false;
      if(!Array.isArray(s.heap)||s.heap.length!==40||!s.heap.every(r=>typeof r==='string'&&/^[.#]{10}$/.test(r)&&r.includes('.')))return false;
      const instance=p=>p&&typeof p.id==='string'&&/^[IJLOSTZ]$/.test(p.kind);
      if(!instance(s.active)||(s.hold!==null&&!instance(s.hold))||!Array.isArray(s.visibleNext)||s.visibleNext.length>6||!s.visibleNext.every(instance))return false;
      const ids=[s.active,s.hold,...s.visibleNext].filter(Boolean).map(p=>p.id),p=s.active;
      return new Set(ids).size===ids.length&&[p.x,p.y,p.rotation].every(Number.isInteger)&&p.rotation>=0&&p.rotation<4&&typeof p.lastAction==='string';
    }
    function access(s) {
      if(!free(s.heap,s.active.kind,s.active))return [];
      const out=[{active:s.active,hold:s.hold,next:s.visibleNext,prelude:[],from:'active'}];
      const held=s.hold||s.visibleNext[0];
      if(held&&free(s.heap,held.kind,spawn(held))) {
        const next=s.hold?s.visibleNext:s.visibleNext.slice(1);
        out.push({active:spawn(held),hold:s.active,next,prelude:['hold'],from:s.hold?'hold':'next-0'});
        const identicalRespawn=s.hold&&s.active.x===3&&s.active.y===17&&s.active.rotation===0&&s.active.lastAction!=='ROT';
        if(!identicalRespawn&&free(s.heap,s.active.kind,spawn(s.active)))out.push({active:spawn(s.active),hold:held,next,prelude:['hold','hold'],from:'active'});
      }
      return out;
    }
    function lock(heap,cells) {
      const rows=heap.map(r=>[...r]);
      for(const [x,y] of cells)rows[y][x]='#';
      const removed=[],remaining=[];
      rows.forEach((r,y)=>r.includes('.')?remaining.push(r.join('')):removed.push(y));
      return {heap:[...Array(removed.length).fill('..........'),...remaining],removed,cleared:removed.length};
    }
    function spin(heap,p) {
      const occupied=[[p.x,p.y+1],[p.x+2,p.y+1],[p.x+2,p.y+3],[p.x,p.y+3]].map(([x,y])=>x<0||x>=10||y>=40||(y>=0&&heap[y][x]==='#'));
      const tspin=p.rotated&&occupied.filter(Boolean).length>=3;
      return {tspin:!!tspin,mini:!!tspin&&!(occupied[p.rotation]&&occupied[(p.rotation+1)%4])};
    }
    // Calculation-local LRU caches: <=16 indexed entries of each kind, plus
    // one referenced traversal per suspended root (<=width). A movement graph
    // has <=40*10*4*2 poses; geometry has <=4*12*24 probes. No resource state,
    // translated obligation or acceptance result is merged by these keys.
    const CACHE_ENTRIES=16,ROOT_QUANTUM=512;
    function cached(map,key,make,b) {
      let entry=map.get(key);
      if(entry){map.delete(key);b.cacheHits++;}
      else {entry=make();if(map.size===CACHE_ENTRIES){map.delete(map.keys().next().value);b.cacheEvictions++;}}
      map.set(key,entry);return entry;
    }
    function charge(b,field,limit,reason) {
      if(b[field]>=b.limits[limit]){b.stop=reason;return false;}
      b[field]++;return true;
    }
    const poseKey=p=>`${p.x},${p.y},${p.rotation},${+p.rotated}`;
    // One resumable BFS indexes all grounded endpoints it encounters. Actual
    // lastAction and spin-required endpoints are distinct. Expand atomically
    // before yielding so interleaved roots can share even an unfinished graph.
    function* pathTo(heap,active,cells,needsSpin,b) {
      if(!free(heap,active.kind,active))return null;
      const cacheKey=JSON.stringify([heap,active.kind,active.x,active.y,active.rotation,active.lastAction]);
      if(b.movements.has(cacheKey))b.movementReuses++;
      const graph=cached(b.movements,cacheKey,()=>{
        b.movementBuilds++;
        const p={x:active.x,y:active.y,rotation:active.rotation,rotated:active.lastAction==='ROT',parent:-1};
        return {queue:[p],seen:new Set([poseKey(p)]),head:0,goals:new Map()};
      },b),goal=cellKey(cells)+(needsSpin?':spin':':any');
      const {queue,seen,goals}=graph;
      while(!goals.has(goal)&&graph.head<queue.length&&!b.stop) {
        if(!charge(b,'poseStates','maxPoseStates','pose-budget'))return null;
        const head=graph.head++,p=queue[head];
        if(!free(heap,active.kind,{...p,y:p.y+1})) {
          const key=cellKey(cellsAt(active.kind,p)),scoring=active.kind==='T'?spin(heap,p):{tspin:false,mini:false};
          if(!goals.has(key+':any'))goals.set(key+':any',head);
          if(scoring.tspin&&!scoring.mini&&!goals.has(key+':spin'))goals.set(key+':spin',head);
        }
        for(const action of ['L','R','SD','CW','CCW','R180']) {
          let n;
          if(['L','R','SD'].includes(action)) {
            const c={x:p.x+(action==='L'?-1:action==='R'?1:0),y:p.y+(action==='SD'?1:0),rotation:p.rotation,rotated:false};
            if(free(heap,active.kind,c))n=c;
          } else {
            const rotation=(p.rotation+{CW:1,CCW:3,R180:2}[action])%4;
            for(const [dx,dy] of table[`${active.kind==='I'?'I':'N'}${p.rotation}-${rotation}`]) {
              const c={x:p.x+dx,y:p.y-dy,rotation,rotated:true};
              if(free(heap,active.kind,c)){n=c;break;}
            }
          }
          if(n&&!seen.has(poseKey(n))){seen.add(poseKey(n));queue.push({...n,parent:head,action});}
        }
        yield;
      }
      if(!goals.has(goal))return null;
      const p=queue[goals.get(goal)],path=['HD'];let n=p;
      while(n.parent!==-1){path.unshift(n.action);n=queue[n.parent];}
      return {pose:{x:p.x,y:p.y,rotation:p.rotation},path,
        scoring:active.kind==='T'?spin(heap,p):{tspin:false,mini:false},
        lastAction:p.rotated?'ROT':p.parent===-1?active.lastAction:p.action};
    }
    // Geometry facts, not a learned value or a certificate of resource access.
    function facts(heap) {
      const tops=Array(10).fill(40),holes=[],channels=[];
      for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(heap[y][x]==='#'){tops[x]=y;break;}
      for(let x=0;x<4;x++) {
        for(let y=tops[x]+1;y<40;y++)if(heap[y][x]==='.')holes.push([x,y]);
        // The freestyle strip has four columns. At its two edges, treat the
        // region boundary as a wall: even a one-cell notch is an obligation,
        // not a free pass because an adjacent region is temporarily lower.
        const rim=Math.max(x===0?0:tops[x-1],x===3?0:tops[x+1]);
        if(tops[x]-rim>=1)for(let y=rim;y<tops[x];y++)channels.push([x,y]);
      }
      const centerTop=Math.min(...tops.slice(4,7)),notches=[];let unfinished=0;
      for(let y=centerTop;y<40;y++) {
        const r=heap[y].slice(4,7);
        if(r!=='###'&&r!=='##.')unfinished++;
        if(r==='##.'&&heap[y+1]?.slice(4,7)!=='###')unfinished++;
        if(r==='##.'&&y>0&&heap[y-1].slice(4,7)==='###')notches.push(y);
      }
      const centerReady=centerTop<39&&unfinished===0;
      // A clear well, contiguous spine, and only a top cap may roof the pocket.
      // An empty Right is also an uncapped construction base, not a scoring claim.
      let right=true;
      for(let y=0;y<40;y++)if(heap[y][7]!=='.')right=false;
      for(let y=tops[8];y<40;y++)if(heap[y][8]!== '#')right=false;
      const pocket=[];for(let y=0;y<40;y++)if(heap[y][9]==='#')pocket.push(y);
      if(pocket.some(y=>y<tops[8]-1))right=false;
      // Pocket can be bottom-filled, or have exactly the two-cell Z roof above
      // an otherwise open channel; other roofs are not known ST cleanup states.
      const roof=pocket.filter(y=>y<40&&heap.slice(y+1).some(r=>r[9]==='.'));
      if(roof.length&&!(roof.length===2&&roof[0]===tops[8]-1&&roof[1]===tops[8]))right=false;
      const cap=right&&roof.length===2;
      return {tops,holes,channels,centerTop,topFlat:heap[centerTop]?.slice(4,7)==='###',centerReady,unfinished,notches,right,cap,
        headroom:Math.min(...tops)-18};
    }
    const defectKeys=f=>new Set([...f.holes,...f.channels].map(([x,y])=>y*10+x));
    function shiftKeys(keys,removed) {
      const result=new Set([...keys].filter(k=>!removed.includes(Math.floor(k/10))).map(k=>k+10*removed.filter(y=>y>Math.floor(k/10)).length));
      result.openTop=keys.openTop===null||removed.includes(keys.openTop)?null:keys.openTop+removed.filter(y=>y>keys.openTop).length;
      return result;
    }
    function debt(f,allowed) {return [...defectKeys(f)].filter(k=>!allowed.has(k));}
    const centerDebt=(f,allowed)=>f.unfinished+Number(!f.topFlat&&f.centerTop!==allowed.openTop);
    function terminal(f,allowed) {
      return f.headroom>=0&&f.holes.length===0&&f.centerReady&&centerDebt(f,allowed)===0&&f.right&&f.notches.length>0&&debt(f,allowed).length===0;
    }
    // Terminal access is checked, not credited as an actual future score. These
    // virtual pieces are NOT drawn, held, or appended to the visible prefix.
    // Their availability remains explicitly unverified beyond the horizon.
    function* opportunity(heap,b) {
      for(let y=37;y>=18;y--) {
        if(!charge(b,'candidates','maxCandidates','candidate-budget'))return null;
        yield;
        const cells=[[6,y],[7,y],[8,y],[7,y+1]];
        const cap=[[9,y],[8,y+1],[9,y+1],[8,y+2]];
        const empty=c=>c.every(([x,r])=>heap[r][x]==='.');
        if(!empty(cells))continue;
        let board=heap,setup=null;
        if(empty(cap)) {
          board=lock(heap,cap).heap;
          if(lock(board,cells).cleared!==2)continue;
          const path=yield* pathTo(heap,spawn({kind:'Z'}),cap,false,b);
          if(!path)continue;
          setup={piece:'Z',cells:cap,...path};
        }
        if(lock(board,cells).cleared!==2)continue;
        const path=yield* pathTo(board,spawn({kind:'T'}),cells,true,b);
        if(path)return {kind:'double-access',setup,piece:'T',cells,...path,resourceStatus:'unverified-beyond-horizon'};
        if(b.stop)return null;
      }
      // Cleanup is a distinct finite structural endpoint; two I instances are
      // never claimed available from this hypothetical shape/path check.
      for(const x of [7,9])for(let y=36;y>=18;y--) {
        if(!charge(b,'candidates','maxCandidates','candidate-budget'))return null;
        yield;
        const cells=[0,1,2,3].map(d=>[x,y+d]);
        if(!cells.every(([c,r])=>heap[r][c]==='.')||lock(heap,cells).cleared!==4)continue;
        const path=yield* pathTo(heap,spawn({kind:'I'}),cells,false,b);
        if(path)return {kind:'quad-access',piece:'I',cells,...path,resourceStatus:'unverified-beyond-horizon'};
        if(b.stop)return null;
      }
      return null;
    }
    // Domain restriction: freestyle/Center construction, or Right Z/T/I cycle.
    // It doesn't choose a placement; all surviving endpoints compete in search.
    function role(kind,cells,after) {
      if(after.cleared) {
        if(kind==='T'&&after.cleared===2&&cells.some(([x])=>x===7)&&cells.every(([x])=>x>=6&&x<=8))return 'double';
        if(kind==='I'&&after.cleared===4&&cells.every(([x])=>x===7||x===9)&&new Set(cells.map(c=>c[0])).size===1)return 'cleanup';
        return null;
      }
      if(cells.every(([x])=>x<=6))return cells.every(([x])=>x<4)?'freestyle':'center';
      if(kind==='I'&&cells.every(([x])=>x===7||x===9)&&new Set(cells.map(c=>c[0])).size===1)return 'staging';
      if(kind==='Z'&&cells.every(([x])=>x>=8))return 'cap';
      return null;
    }
    function compare(a,b) {for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;}
    function* geometry(heap,kind,b) {
      const key=JSON.stringify([heap,kind]);
      if(b.geometry.has(key))b.geometryReuses++;
      const entry=cached(b.geometry,key,()=>({cursor:0,items:[],seen:new Set()}),b);
      while(entry.cursor<4*12*24&&!b.stop) {
        if(!charge(b,'candidates','maxCandidates','candidate-budget'))return [];
        const i=entry.cursor++,rotation=Math.floor(i/(12*24)),x=Math.floor(i/24)%12-2,y=i%24+16,pose={x,y,rotation};
        if(free(heap,kind,pose)&&!free(heap,kind,{...pose,y:y+1})) {
          const cells=cellsAt(kind,pose),key=cellKey(cells);
          if(cells.every(([,r])=>r>=18)&&!entry.seen.has(key)) {
            entry.seen.add(key);
            const after=lock(heap,cells),type=role(kind,cells,after);
            if(type)entry.items.push({cells,key,after,type,f:facts(after.heap),rotation,x,y});
          }
        }
        yield;
      }
      return entry.items;
    }
    function* candidates(s,allowed,preferred,b) {
      const all=[];
      for(const choice of access(s)) {
        const kind=choice.active.kind,list=yield* geometry(s.heap,kind,b);
        for(const {cells,key,after,type,f,rotation,x,y} of list) {
          // Resource-dependent spawn, translated debt and rank are NOT cached.
          // Charge their real checks even when the placement geometry was reused.
          if(!charge(b,'candidates','maxCandidates','candidate-budget'))return [];
          yield;
          if(!choice.next.length){b.unknown++;continue;}
          const active=spawn(choice.next[0]);
          if(!free(after.heap,active.kind,active)){b.spawnRejects++;continue;}
          const allowedAfter=shiftKeys(allowed,after.removed);
          if(f.headroom<0)continue;
          const preferredMatch=preferred?.kind===kind&&Array.isArray(preferred.cells)&&preferred.cells.length===4&&preferred.cells.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger))&&cellKey(preferred.cells)===key;
          const rank=[+!preferredMatch,f.holes.length,debt(f,allowedAfter).length,centerDebt(f,allowedAfter),+!f.right,
            Math.abs(Math.min(...f.tops.slice(0,4))-f.centerTop),choice.prelude.length,-after.cleared,rotation,x,y];
          all.push({choice,cells,after,type,f,allowed:allowedAfter,rank,preferred:preferredMatch,
            future:{heap:after.heap,active,hold:choice.hold,visibleNext:choice.next.slice(1)}});
        }
        if(b.stop)return [];
      }
      all.sort((a,b)=>compare(a.rank,b.rank));
      b.widthPruned+=Math.max(0,all.length-b.limits.width);
      return all.slice(0,b.limits.width);
    }
    function* search(s,allowed,depth,b,progress) {
      b.maxDepth=Math.max(b.maxDepth,depth);
      if(depth===b.limits.depth) {
        const f=facts(s.heap);b.endpoints++;
        if(!terminal(f,allowed)){b.endpointRejects++;return null;}
        const nextOpportunity=yield* opportunity(s.heap,b);
        if(!nextOpportunity){b.endpointRejects++;return null;}
        return {steps:[],endpoint:{heap:s.heap,active:copy(s.active),hold:copy(s.hold),visibleNext:copy(s.visibleNext),facts:f,opportunity:nextOpportunity,
          obligations:{newConstruction:'paid',inheritedNarrowChannels:f.channels,intentionalCenterNotches:f.notches,scoringResources:'unverified-beyond-horizon'},
          newConstructionObligations:'paid',future:'Center notches and Right cleanup are intentional, unverified beyond the horizon; no unseen piece is promised.'}};
      }
      const list=yield* candidates(s,allowed,null,b);
      for(const c of list) {
        if(b.stop)return null;
        const route=yield* branch(s,c,depth,b,progress);
        if(route)return route;
      }
      return null;
    }
    function* branch(s,c,depth,b,progress) {
      if(!charge(b,'lockStates','maxLockStates','lock-budget'))return null;
      yield;
      const path=yield* pathTo(s.heap,c.choice.active,c.cells,c.type==='double',b);
      if(!path){b.pathRejects++;return null;}
      progress.depth=Math.max(progress.depth,depth+1);
      if(compare(c.rank.slice(1,7),progress.bestRank)<0)progress.bestRank=c.rank.slice(1,7);
      // newPiece preserves lastAction; only hold resets it.
      const future={...c.future,active:{...c.future.active,lastAction:path.lastAction}};
      const tail=yield* search(future,c.allowed,depth+1,b,progress);
      if(!tail)return null;
      const step={kind:'target',piece:{id:c.choice.active.id,kind:c.choice.active.kind},from:c.choice.from,prelude:c.choice.prelude,
        cells:c.cells,pose:path.pose,path:path.path,rule:c.type,expected:{cleared:c.after.cleared,...path.scoring},heap:c.after.heap,
        obligations:{scope:'freestyle vacancies/channels and unfinished Center construction',intentionalSTResources:'unverified-beyond-horizon',newVacancies:debt(c.f,c.allowed).map(k=>[k%10,Math.floor(k/10)]),unfinishedCenter:centerDebt(c.f,c.allowed),
          status:debt(c.f,c.allowed).length||centerDebt(c.f,c.allowed)?'verified-payable-within-horizon':'paid'},facts:c.f};
      return {...tail,steps:[step,...tail.steps]};
    }
    function* allocate(input,allowed,b) {
      const list=yield* candidates(input,allowed,input.preferredTarget,b);
      const jobs=list.map((c,index)=>{
        const progress={index,piece:{id:c.choice.active.id,kind:c.choice.active.kind},cells:c.cells,prelude:c.choice.prelude,
          preferred:!!c.preferred,rank:c.rank,depth:0,bestRank:c.rank.slice(1,7),work:0,turns:0,initialWork:0,status:'pending'};
        b.roots.push(progress);return {progress,iterator:branch(input,c,0,b,progress)};
      });
      let fallback=null;
      function* resume(job,initial) {
        const p=job.progress;p.turns++;
        for(let i=0;i<ROOT_QUANTUM&&!b.stop;i++) {
          const next=job.iterator.next();
          if(next.done){p.status=next.value?'verified':'exhausted';if(next.value)fallback={route:next.value,preferred:p.preferred};break;}
          p.work++;if(initial)p.initialWork++;yield;
        }
      }
      const ready=()=>fallback&&(fallback.preferred||!jobs.some(j=>j.progress.preferred&&j.progress.status==='pending'));
      // Each retained root gets an initial slice unless a complete witness or
      // the shared budget ends the decision. Suspended subtrees are not restarted.
      for(const job of jobs){yield* resume(job,true);if(ready())return fallback.route;if(b.stop)break;}
      let turn=0,cursor=0;
      while(!b.stop&&jobs.some(j=>j.progress.status==='pending')) {
        let job;
        if(turn++%4===3) {
          // One of every four turns revisits alternatives, even if an early root
          // continually looks best. No random scheduling or hidden future value.
          do{job=jobs[cursor++%jobs.length];}while(job.progress.status!=='pending');
          b.fairRevisits++;
        } else {
          const priority=j=>[+!j.progress.preferred,-j.progress.depth,...j.progress.bestRank,j.progress.index];
          job=jobs.filter(j=>j.progress.status==='pending').sort((a,b)=>compare(priority(a),priority(b)))[0];
          b.promisingTurns++;
        }
        yield* resume(job,false);if(ready())return fallback.route;
      }
      // A saved fallback is already a FULL verified witness, never a partial
      // branch. Extra effort to preserve an old target cannot invalidate it.
      return fallback?.route||null;
    }
    function explain(step,route,horizon) {
      const reasons={double:'Scoring cycle: rotate T into a non-mini double.',cleanup:'Scoring-cycle cleanup: I clears four rows.',
        staging:'Scoring cycle: stage I in the right channel.',cap:'Scoring cycle: Z builds the right cap.',
        center:'Center construction: this route pays its unfinished construction and retains open scoring notches.',
        freestyle:'Freestyle filler: this route leaves no new buried vacancy or narrow channel unpaid.'};
      const repairs=step.obligations.status==='verified-payable-within-horizon'?' Checked follow-ups pay its new vacancies/unfinished work.':'';
      const regions=new Set(route.steps.map(s=>s.rule==='freestyle'?'Left':s.rule==='center'?'Center':'Right'));
      const allocation=regions.size>1?` Allocation: ${[...regions].join('/')} use distinct pieces.`:'';
      return `${reasons[step.rule]}${repairs}${allocation} ${horizon} locks and spawns checked; later scoring/resources unverified.`;
    }
    function* start(input) {
      const abstain=(reason,explanation,diagnostics)=>({kind:'abstain',reason,explanation,diagnostics});
      if(!supported(input))return abstain('unsupported','Advice requires ST lab, SRS+, gravity off and a valid board/visible preview.');
      if(!free(input.heap,input.active.kind,input.active))return abstain('unsupported','The active piece overlaps the heap or lies outside the field.');
      const limits={...DEFAULTS,...input.limits};
      if(Object.keys(DEFAULTS).some(k=>!Number.isInteger(limits[k])||limits[k]<(k==='depth'?DEFAULTS.depth:k==='width'?1:0)||limits[k]>DEFAULTS[k]))return abstain('unsupported','Invalid continuation work limits.');
      const b={limits,poseStates:0,lockStates:0,candidates:0,cacheHits:0,cacheEvictions:0,movementBuilds:0,movementReuses:0,geometryReuses:0,
        widthPruned:0,unknown:0,spawnRejects:0,pathRejects:0,endpointRejects:0,endpoints:0,maxDepth:0,stop:null,
        movements:new Map(),geometry:new Map(),roots:[],fairRevisits:0,promisingTurns:0};
      const initial=facts(input.heap),allowed=defectKeys(initial);
      allowed.openTop=input.heap[initial.centerTop]?.slice(4,7)==='##.'?initial.centerTop:null;
      // Empty boards are intentionally outside this first established-stack
      // endpoint contract. No opening bag/orientation is inferred.
      const wellCells=input.heap.flatMap((r,y)=>r[7]==='#'?[y]:[]);
      const stagedWell=wellCells.length===4&&wellCells[3]-wellCells[0]===3&&facts(input.heap.map(r=>r.slice(0,7)+'.'+r.slice(8))).right;
      const established=initial.notches.length>0&&(initial.right||stagedWell);
      const route=established?yield* allocate(input,allowed,b):null;
      const diagnostics={requestedHorizon:limits.depth,effectiveHorizon:route?route.steps.length:0,maxReachedDepth:b.maxDepth,
        poseStates:b.poseStates,lockStates:b.lockStates,candidates:b.candidates,cacheHits:b.cacheHits,widthPruned:b.widthPruned,
        unknownPrefix:b.unknown,spawnRejects:b.spawnRejects,pathRejects:b.pathRejects,endpointRejects:b.endpointRejects,endpoints:b.endpoints,
        movementBuilds:b.movementBuilds,movementReuses:b.movementReuses,geometryReuses:b.geometryReuses,cacheEvictions:b.cacheEvictions,
        cacheEntries:{movement:b.movements.size,geometry:b.geometry.size,limit:CACHE_ENTRIES},
        roots:b.roots,rootQuantum:ROOT_QUANTUM,fairRevisits:b.fairRevisits,promisingTurns:b.promisingTurns,
        searchStop:b.stop,stopReason:route?'witness-found':b.stop||(!established?'no-established-right-stack':'no-suitable-witness'),limits};
      if(b.stop&&!route)return abstain('budget-exhausted','Search limit reached; no verified suitable continuation within budget. This is not impossibility.',diagnostics);
      if(!route)return abstain('no-core-fit-found','No suitable ST continuation verified through the requested horizon. Keep playing manually; opening coverage is not implemented.',diagnostics);
      const first=route.steps[0];
      return {...first,explanation:explain(first,route,limits.depth),continuationVerified:true,continuation:route.steps[1]||null,
        witness:route,diagnostics};
    }
    function advise(input) {const job=start(input);let r;do{r=job.next();}while(!r.done);return r.value;}
    return Object.freeze({advise,start});
  }
  function visiblePreview(queue) {
    let separator=false;const visible=[];
    for(let i=0;i<Math.min(7,queue.length);i++) {
      if(queue[i]==='|'){if(separator)return null;separator=true;continue;}
      const slot=i-Number(separator);
      if(slot>=0&&slot<6){if(!/^[IJLOSTZ]$/.test(queue[i]))return null;visible.push(queue[i]);}
    }
    return visible;
  }
  return Object.freeze({version:VERSION,create,visiblePreview,limits:DEFAULTS});
})();
