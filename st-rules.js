/* Pure milestone-one rules (v2 unlimited hold; v1 retained for replay). Static shape/kick data is copied from rotationSystem.js SRS+.
 * Board coordinates increase downwards; no DOM, RNG or hidden stream access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const pieces={"I": [[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]], [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]], "L": [[[0, 0, 0, 0], [0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 0], [1, 0, 0, 0]], [[0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]], "J": [[[0, 0, 0, 0], [1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 0], [0, 0, 1, 0]], [[0, 0, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0]]], "Z": [[[0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0]], [[0, 0, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0], [1, 0, 0, 0]]], "T": [[[0, 0, 0, 0], [0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 1, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0]], [[0, 0, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0]]], "S": [[[0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0]], [[0, 0, 0, 0], [1, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0]]], "O": [[[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]]]};
const kicks={"N0-1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "N1-0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "N1-2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "N2-1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "N2-3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "N3-2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "N3-0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "N0-3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "N0-2": [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]], "N1-3": [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]], "N2-0": [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]], "N3-1": [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]], "I0-1": [[0, 0], [1, 0], [-2, 0], [-2, -1], [1, 2]], "I1-0": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], "I1-2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "I2-1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], "I2-3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "I3-2": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], "I3-0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "I0-3": [[0, 0], [-1, 0], [2, 0], [2, -1], [-1, 2]], "I0-2": [[0, 0], [0, 1]], "I1-3": [[0, 0], [1, 0]], "I2-0": [[0, 0], [0, -1]], "I3-1": [[0, 0], [-1, 0]]};
function freezeData(x){Object.values(x).forEach(v=>{if(v&&typeof v==='object')freezeData(v);});return Object.freeze(x);}
freezeData(pieces);freezeData(kicks);
const TYPES='IJLOSTZ';
const offsets=Object.fromEntries(Object.entries(pieces).map(([t,rots])=>[t,rots.map(shape=>shape.flatMap((r,y)=>r.flatMap((v,x)=>v?[[x,y]]:[])))]));
const PROFILE=Object.freeze({id:'st-zero-v2',width:10,height:40,hiddenRows:20,spawn:Object.freeze({x:3,y:17}),gravity:0,kickset:'SRS+',hold:'unlimited',lock:'manual-hard-drop',spin:'three-corner-front-or-quarter-turn-fifth-kick',topOut:'blocked-spawn-or-lock-entirely-above-visible'});
const LEGACY_PROFILE=Object.freeze({...PROFILE,id:'st-zero-v1',hold:'once-per-lock'});
const emptyBoard=()=>Array(40).fill('..........');
const spawn=type=>type?{type,x:3,y:17,rotation:0,lastRotation:null}:null;
function cells(a){return a&&offsets[a.type]?.[a.rotation]?offsets[a.type][a.rotation].map(([x,y])=>[a.x+x,a.y+y]):[];}
function fits(board,a){const coords=a&&offsets[a.type]?.[a.rotation];if(!coords)return false;for(const[dx,dy]of coords){const x=a.x+dx,y=a.y+dy;if(x<0||x>=10||y<0||y>=40||board[y][x]!=='.')return false;}return true;}
function createState(input={}){const active=typeof input.active==='string'?spawn(input.active):input.active?{...input.active,lastRotation:input.active.lastRotation?{...input.active.lastRotation}:null}:null;return {rules:input.rules??PROFILE.id,board:(input.board??emptyBoard()).slice(),active,hold:input.hold||null,canHold:input.canHold??true,queue:(input.queue??[]).slice(),revision:input.revision??0,streamCursor:input.streamCursor??0,topOut:input.topOut??false,...(input.bag?{bag:JSON.parse(JSON.stringify(input.bag))}:{}),lastEvent:null};}
// Migration is explicit: legacy witnesses still replay under their original rules.
function migrateState(input){const state=createState(input);const errors=validate(state);if(errors.length)throw new Error(errors.join('; '));return createState({...state,rules:PROFILE.id,canHold:true});}
function validate(s){const e=[];if(!s||typeof s!=='object')return['state must be an object'];if(s.rules!==PROFILE.id&&s.rules!==LEGACY_PROFILE.id)e.push('unsupported-profile');if(!Array.isArray(s.board)||s.board.length!==40||s.board.some(r=>typeof r!=='string'||r.length!==10||/[^.X#IJLOSTZ]/.test(r)))e.push('invalid-board');if(!Array.isArray(s.queue)||s.queue.some(t=>!TYPES.includes(t)||t.length!==1))e.push('invalid-queue');if(s.hold!==null&&(!TYPES.includes(s.hold)||s.hold.length!==1))e.push('invalid-hold');if(typeof s.canHold!=='boolean')e.push('invalid-hold-availability');if(!Number.isInteger(s.revision)||s.revision<0)e.push('invalid-revision');if(!Number.isInteger(s.streamCursor)||s.streamCursor<0)e.push('invalid-stream-cursor');if(s.active){const a=s.active;if(!TYPES.includes(a.type)||a.type.length!==1||!Number.isInteger(a.x)||!Number.isInteger(a.y)||!Number.isInteger(a.rotation)||a.rotation<0||a.rotation>3)e.push('invalid-active');else if(!e.includes('invalid-board')&&!s.topOut&&!fits(s.board,a))e.push('active-collision');if(a.lastRotation&&(!Number.isInteger(a.lastRotation.from)||!Number.isInteger(a.lastRotation.to)||a.lastRotation.to!==a.rotation||a.lastRotation.from<0||a.lastRotation.from>3||!Number.isInteger(a.lastRotation.kickIndex)||a.lastRotation.kickIndex<0||!kicks[`${a.type==='I'?'I':'N'}${a.lastRotation.from}-${a.lastRotation.to}`]||a.lastRotation.kickIndex>=kicks[`${a.type==='I'?'I':'N'}${a.lastRotation.from}-${a.lastRotation.to}`].length))e.push('invalid-rotation-evidence');}return e;}
function spin(board,a){if(a.type!=='T'||!a.lastRotation)return'none';const filled=(x,y)=>x<0||x>=10||y>=40||(y>=0&&board[y][x]!=='.');const corners=[[a.x,a.y+1],[a.x+2,a.y+1],[a.x+2,a.y+3],[a.x,a.y+3]].map(([x,y])=>filled(x,y));if(corners.filter(Boolean).length<3)return'none';const quarter=(a.lastRotation.to-a.lastRotation.from+4)%4!==2;return(corners[a.rotation]&&corners[(a.rotation+1)%4])||(quarter&&a.lastRotation.kickIndex===4)?'full':'mini';}
function move(s,action){if(!s.active||s.topOut)return s;const a=s.active;let next;
 if(action==='HOLD'){if((s.rules===LEGACY_PROFILE.id&&!s.canHold)||(!s.hold&&!s.queue.length))return s;const type=s.hold||s.queue[0];next={...s,active:spawn(type),hold:a.type,canHold:s.rules===PROFILE.id,queue:s.hold?s.queue:s.queue.slice(1),streamCursor:s.streamCursor+(s.hold?0:1)};next.topOut=!fits(next.board,next.active);}
 else if(action==='L'||action==='R'||action==='SD'){const trial={...a,x:a.x+(action==='L'?-1:action==='R'?1:0),y:a.y+(action==='SD'?1:0),lastRotation:null};if(!fits(s.board,trial))return s;next={...s,active:trial};}
 else if(['CW','CCW','R180'].includes(action)){const r=(a.rotation+(action==='CW'?1:action==='CCW'?3:2))%4;const table=kicks[`${a.type==='I'?'I':'N'}${a.rotation}-${r}`];for(let i=0;i<table.length;i++){const [dx,dy]=table[i],trial={...a,x:a.x+dx,y:a.y-dy,rotation:r,lastRotation:{from:a.rotation,to:r,kickIndex:i}};if(fits(s.board,trial)){next={...s,active:trial};break;}}if(!next)return s;}
 else if(action==='HD'){const landing=dropLanding(s.board,a);return lockLanding(s,landing,spin(s.board,landing));}
 else return s;
 return{...next,revision:s.revision+1,lastEvent:null};
}
// Geometry is enough to identify a hard-drop outcome. Keep locking separate so
// enumeration can discard duplicate/longer witnesses before allocating rows,
// cells, events, queue slices and complete successor states.
function dropLanding(board,a){let landing={...a};while(fits(board,{...landing,y:landing.y+1}))landing.y++;if(landing.y!==a.y)landing.lastRotation=null;return landing;}
function lockLanding(s,landing,classification){const occupied=cells(landing),board=s.board.slice();
 // Cells are row-major: rebuild each touched string once, leaving all other
 // immutable rows shared. The outer array and every edited row stay private.
 for(let i=0;i<occupied.length;){const y=occupied[i][1],row=[...board[y]];
  do{row[occupied[i][0]]=landing.type;i++;}while(i<occupied.length&&occupied[i][1]===y);
  board[y]=row.join('');
 }
 // Imported positions may already contain full rows outside the piece.
 // Keep the complete scan and original pre-clear row indices/order.
 const cleared=[];let rows=board.filter((r,i)=>{if(!r.includes('.')){cleared.push(i);return false;}return true;});while(rows.length<40)rows.unshift('..........');const active=spawn(s.queue[0]);const topOut=occupied.every(([,y])=>y<20)||(active!==null&&!fits(rows,active));const event={type:landing.type,target:{type:landing.type,x:landing.x,y:landing.y,rotation:landing.rotation},cells:occupied,lines:cleared.length,clearedRows:cleared,spin:classification,topOut};
 return{...s,board:rows,active,canHold:true,queue:s.queue.slice(1),streamCursor:s.streamCursor+(active?1:0),topOut,lastEvent:event,revision:s.revision+1};
}
function replay(state,actions){let s=state;const events=[];for(let i=0;i<actions.length;i++){const n=move(s,actions[i]);if(n===s)return{state:s,events,valid:false,failedAt:i};s=n;if(s.lastEvent)events.push(s.lastEvent);}return{state:s,events,valid:true,failedAt:null};}
// Legal four-cell poses have origins in [-3,9] x [-3,39]. Keep the three
// T-spin evidence classes distinct, exactly as the former textual key did.
function poseKey(a){const r=a.lastRotation,semantic=a.type==='T'&&r?((r.to-r.from+4)%4!==2&&r.kickIndex===4?2:1):0;return(((TYPES.indexOf(a.type)*16+a.x+4)*64+a.y+4)*4+a.rotation)*3+semantic;}
function witness(queue,index,prefix){const actions=[];for(let n=queue[index];n.parent>=0;n=queue[n.parent])actions.push(n.action);actions.reverse();return prefix.concat(actions,'HD');}
// Completed geometry queries are reusable only within one synchronous request.
// State keys retain pose, HOLD, bag, draw cursor, revision and passthrough data.
// The preceding lock event is never read and each returned lock replaces it.
// Arbitrary stop predicates are deliberately excluded. Cached values never share mutable
// placement/evidence objects with callers. Limits bound retained serialized data.
let queryContext=null;
function withQueries(run){
 if(queryContext)return run();
 queryContext={cache:new Map(),bytes:0,metrics:{hits:0,avoidedNodes:0,proven:0,failedWithinScope:0,unfinished:0,evictions:0,peakBytes:0,peakEntries:0}};
 try{return run();}finally{queryContext=null;}
}
function queryMetrics(){return queryContext?{...queryContext.metrics,entries:queryContext.cache.size,bytes:queryContext.bytes,maxBytes:8*1024*1024,maxEntries:64}:null;}
function query(kind,input,options,run){
 const ctx=queryContext;if(!ctx)return run();
 const cacheable=typeof options.stopWhen!=='function';
 const id=cacheable?JSON.stringify([kind,kind==='placements'?{...input,lastEvent:undefined}:input,kind==='placements'?options.allowHold!==false:null]):null;
 const saved=id&&ctx.cache.get(id);
 if(saved){ctx.metrics.hits++;ctx.metrics.avoidedNodes+=saved.visited;return{...JSON.parse(saved.json),visited:0,queryCached:true};}
 const result=run(),status=result.complete?(kind==='tDoubleAccess'?result.reachable===true:result.placements.length>0)?'proven':'failed-within-scope':'unfinished';
 ctx.metrics[status==='proven'?'proven':status==='unfinished'?'unfinished':'failedWithinScope']++;
 const value={...result,queryStatus:status};
 if(id&&result.complete){
  const json=JSON.stringify(value),bytes=(id.length+json.length)*2;
  if(bytes<=8*1024*1024){
   while(ctx.cache.size&&(ctx.cache.size>=64||ctx.bytes+bytes>8*1024*1024)){const first=ctx.cache.keys().next().value;ctx.bytes-=ctx.cache.get(first).bytes;ctx.cache.delete(first);ctx.metrics.evictions++;}
   ctx.cache.set(id,{json,bytes,visited:result.visited});ctx.bytes+=bytes;
   ctx.metrics.peakBytes=Math.max(ctx.metrics.peakBytes,ctx.bytes);ctx.metrics.peakEntries=Math.max(ctx.metrics.peakEntries,ctx.cache.size);
  }
 }
 return value;
}
function placements(s,options={}){return query('placements',s,options,()=>placementsCore(s,options));}
function tDoubleAccess(board,options={}){return query('tDoubleAccess',board,options,()=>tDoubleAccessCore(board,options));}

function placementsCore(s,options={}){
 const out=[],seenOut=new Map();let visited=0,complete=true;
 const maxNodes=options.maxNodes??16000,deadline=options.deadline??Infinity,now=options.now??(()=>Date.now()),stopWhen=typeof options.stopWhen==='function'?options.stopWhen:null;
 if(validate(s).length||!s.active||s.topOut)return{placements:out,visited,complete:true};
 const unlimited=s.rules===PROFILE.id;
 const rootKey=state=>JSON.stringify([poseKey(state.active),state.hold,state.queue,state.canHold,state.streamCursor]);
 const roots=[{state:s,witness:[],hold:false,holdCount:0}],rootSeen=new Set([rootKey(s)]);
 if(options.allowHold!==false){
  let current=s;
  // A filled hold only swaps two pieces. A second swap also covers returning a
  // moved piece to spawn, or stashing the next piece after an initially empty hold.
  // Further swaps repeat these states; never add HOLD to the movement BFS.
  for(let count=1;count<=(unlimited?2:1);count++){
   const next=move(current,'HOLD');if(next===current||next.topOut)break;current=next;
   const key=rootKey(current);if(rootSeen.has(key))continue;rootSeen.add(key);
   roots.push({state:current,witness:Array(count).fill('HOLD'),hold:true,holdCount:count});
  }
 }
 // One enumeration has one board. Landing type/pose/spin determines the
 // event; held piece, pre-lock queue and cursor determine post-lock supply.
 // Intern supply only among these at-most-three roots. Equivalent swap-back
 // roots still compete for the original shortest witness.
 const supplyKeys=unlimited?roots.map(r=>JSON.stringify([r.state.hold,r.state.queue,r.state.streamCursor])):null;
 const outcomeRoots=unlimited?roots.map((r,i)=>supplyKeys.indexOf(supplyKeys[i])*7+TYPES.indexOf(r.state.active.type)):null;
 // Mixed-radix identity: root/type<21, x+4<16, y+4<64, rotation<4,
 // spin<3. Legal origins are x[-3,9], y[-3,39]; the key is below258048.
 // Plain Number arithmetic is exact here; no signed32-bit bitwise packing.
 // Interleave frontiers so a tight budget cannot starve hold.
 const queues=roots.map(r=>[{state:r.state,parent:-1,action:null,depth:r.witness.length}]),seen=roots.map(r=>new Set([poseKey(r.state.active)])),heads=roots.map(()=>0);
 outer:while(queues.some((q,i)=>heads[i]<q.length)){for(let k=0;k<queues.length;k++){
  if(heads[k]>=queues[k].length)continue;
  if(visited>=maxNodes||now()>=deadline){complete=false;break outer;}
  const indexInQueue=heads[k]++,n=queues[k][indexInQueue];visited++;
  const landing=dropLanding(n.state.board,n.state.active),classification=spin(n.state.board,landing);
  // In v2 deduplicate equivalent outcomes, not merely matching targets: an
  // empty-hold swap-back can have the same target but different held/next pieces.
  const id=unlimited?(((outcomeRoots[k]*16+landing.x+4)*64+landing.y+4)*4+landing.rotation)*3+(classification==='full'?2:classification==='mini'?1:0):[roots[k].hold,landing.type,landing.x,landing.y,landing.rotation,classification].join(':');
  const index=seenOut.get(id);
  if(index===undefined||n.depth+1<out[index].witness.length){
   const locked=lockLanding(n.state,landing,classification),event=locked.lastEvent;
   if(!event.topOut){
    const placement={target:event.target,hold:roots[k].hold,holdCount:roots[k].holdCount,witness:witness(queues[k],indexInQueue,roots[k].witness),state:locked,event};
    if(index===undefined){seenOut.set(id,out.length);out.push(placement);
     // A new witness can settle an existential query, not complete enumeration.
     if(stopWhen?.(placement)===true)return{placements:out,complete:false,visited,stopReason:'placement-predicate'};
    }else out[index]=placement;
   }
  }
  for(const action of ['L','R','CW','CCW','R180','SD']){
   const next=move(n.state,action);if(next===n.state)continue;
   const key=poseKey(next.active);if(seen[k].has(key))continue;seen[k].add(key);
   queues[k].push({state:next,parent:indexInQueue,action,depth:n.depth+1});
  }
 }}return{placements:out,complete,visited};
}
// Resolve only explicitly requested landings. A target is not proof of access:
// every returned placement is reached by real inputs from an actual HOLD root.
// Direct templates handle ordinary drops; a shared bounded BFS settles the
// remaining targets (including left spins). complete refers to this target set,
// never to enumeration of all possible placements. Unspecified spin accepts any
// one actual spin class; callers needing distinct outcomes request each class.
function targetedPlacements(s,targets,options={}){
 // Target order, spin classes and supplied witnesses are part of the scope.
 // Never reuse a broad enumeration or a different HOLD/search policy here.
 // Budgets are work limits: a completed fact can be reused without more work,
 // including under a zero remaining budget, just like placements().
 const input={state:s,targets,allowHold:options.allowHold!==false,search:options.search!==false};
 const result=query('targetedPlacements',input,options,()=>targetedPlacementsCore(s,targets,options));
 return result.queryCached?{...result,directCount:0,fallbackNodes:0}:result;
}
function targetedPlacementsCore(s,targets,options={}){
 const out=[];let visited=0,directCount=0,fallbackNodes=0,complete=true;
 const maxNodes=options.maxNodes??16000,deadline=options.deadline??Infinity,now=options.now??(()=>Date.now());
 if(!Array.isArray(targets))throw new TypeError('targets must be an array');
 const cellKey=cs=>cs.map(([x,y])=>x+','+y).sort().join(';');
 const requested=targets.map(t=>{
  if(!t||!TYPES.includes(t.type)||t.type.length!==1||t.spin!==undefined&&!['none','mini','full'].includes(t.spin))throw new TypeError('invalid landing target');
  let poses;
  if(Array.isArray(t.cells)&&t.cells.length===4&&t.cells.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger))){
   const key=cellKey(t.cells);poses=[];
   for(let rotation=0;rotation<4;rotation++){
    const shape=offsets[t.type][rotation],x=Math.min(...t.cells.map(c=>c[0]))-Math.min(...shape.map(c=>c[0])),y=Math.min(...t.cells.map(c=>c[1]))-Math.min(...shape.map(c=>c[1]));
    const pose={type:t.type,x,y,rotation};if(cellKey(cells(pose))===key)poses.push(pose);
   }
  }else if(Number.isInteger(t.x)&&Number.isInteger(t.y)&&Number.isInteger(t.rotation)&&t.rotation>=0&&t.rotation<4)poses=[{type:t.type,x:t.x,y:t.y,rotation:t.rotation}];
  else throw new TypeError('invalid landing target pose');
  return{...t,poses};
 });
 const result=()=>({placements:out,visited,complete,directCount,fallbackNodes,scope:'requested-targets'});
 if(validate(s).length||!s.active||s.topOut||!requested.length)return result();
 const canWork=()=>{if(visited>=maxNodes||now()>=deadline){complete=false;return false;}return true;};
 const roots=[{state:s,prefix:[],holdCount:0}],rootSeen=new Set();
 const rootKey=q=>JSON.stringify([poseKey(q.active),q.hold,q.queue,q.canHold,q.streamCursor]);rootSeen.add(rootKey(s));
 if(options.allowHold!==false){let q=s;for(let count=1;count<=(s.rules===PROFILE.id?2:1);count++){
  const n=move(q,'HOLD');if(n===q||n.topOut)break;q=n;const key=rootKey(q);if(rootSeen.has(key))continue;rootSeen.add(key);roots.push({state:q,prefix:Array(count).fill('HOLD'),holdCount:count});
 }}
 const outcomes=new Set();
 const matches=(t,event)=>event.type===t.type&&(t.spin===undefined||t.spin===event.spin)&&t.poses.some(p=>p.x===event.target.x&&p.y===event.target.y&&p.rotation===event.target.rotation);
 const jobs=roots.map(root=>({root,remaining:requested.filter(t=>t.type===root.state.active.type&&t.poses.some(p=>fits(s.board,p)&&!fits(s.board,{...p,y:p.y+1}))),queue:null,head:0,seen:null}));
 const accept=(job,locked,actions,isDirect)=>{
  const event=locked.lastEvent;if(!event||event.topOut)return false;
  const satisfied=job.remaining.filter(t=>matches(t,event));if(!satisfied.length)return false;
  job.remaining=job.remaining.filter(t=>!satisfied.includes(t));
  const key=JSON.stringify([event.target,event.spin,locked.hold,locked.queue,locked.streamCursor]);
  if(!outcomes.has(key)){outcomes.add(key);out.push({target:event.target,hold:job.root.holdCount>0,holdCount:job.root.holdCount,witness:job.root.prefix.concat(actions),state:locked,event});if(isDirect)directCount++;}
  return true;
 };
 const tryActions=(job,actions)=>{
  let q=job.root.state;
  for(let i=0;i<actions.length;i++){
   if(!canWork())return false;visited++;
   const n=move(q,actions[i]);if(n===q||n.topOut)return false;q=n;
   if(q.lastEvent){if(i!==actions.length-1)return false;return accept(job,q,actions,true);}
  }
  return false;
 };
 // At most two orientation/translation orders per requested pose. No guessed
 // path is emitted: collision, kicks, drops and last-rotation facts are replayed.
 for(const job of jobs){
  for(const t of [...job.remaining]){
   if(!job.remaining.includes(t))continue;
   if(Array.isArray(t.witness)&&t.witness.length&&tryActions(job,t.witness))continue;
   for(const target of t.poses){
    if(!job.remaining.includes(t))break;
    for(const rotateFirst of [true,false]){
     let q=job.root.state,actions=[],valid=true;
     const act=a=>{if(!canWork()){valid=false;return;}visited++;const n=move(q,a);if(n===q||n.topOut){valid=false;return;}q=n;actions.push(a);};
     const rotate=()=>{const d=(target.rotation-q.active.rotation+4)%4;if(d)act(d===1?'CW':d===2?'R180':'CCW');};
     const shift=()=>{for(let i=0;valid&&q.active.x!==target.x&&i<14;i++)act(q.active.x<target.x?'R':'L');};
     if(rotateFirst){rotate();if(valid)shift();}else{shift();if(valid)rotate();}
     if(valid){act('HD');if(valid)accept(job,q,actions,true);}
     if(!complete)return result();
     if(!job.remaining.includes(t))break;
    }
   }
   if(!complete)return result();
  }
 }
 // A tuck/spin has a finite set of inverse-kick predecessor poses. Verify the
 // final kick geometrically first, then replay a simple descent to that pose.
 // This avoids a movement flood for canonical right TSDs without inventing
 // rotation evidence or assuming that a left-region tuck is reachable.
 for(const job of jobs)for(const t of [...job.remaining]){
  if(!job.remaining.includes(t)||t.type==='O')continue;
  for(const target of t.poses){
   if(!job.remaining.includes(t))break;
   const predecessors=new Set();
   for(const action of ['CW','CCW','R180']){
    if(!job.remaining.includes(t))break;
    const delta=action==='CW'?1:action==='CCW'?3:2,rotation=(target.rotation-delta+4)%4;
    for(const [dx,dy] of kicks[`${t.type==='I'?'I':'N'}${rotation}-${target.rotation}`]){
     if(!job.remaining.includes(t))break;
     if(!canWork())return result();
     const predecessor={type:t.type,x:target.x-dx,y:target.y+dy,rotation,lastRotation:null};
     if(!fits(s.board,predecessor))continue;
     const key=[predecessor.x,predecessor.y,rotation,action].join(',');
     if(predecessors.has(key))continue;predecessors.add(key);
     // SRS picks the first legal kick, not whichever inverse offset we want.
     visited++;
     const probe={...job.root.state,active:predecessor},rotated=move(probe,action);
     if(rotated===probe||rotated.active.x!==target.x||rotated.active.y!==target.y||rotated.active.rotation!==target.rotation||
        t.spin!==undefined&&spin(s.board,rotated.active)!==t.spin)continue;
     for(const rotateFirst of [true,false]){
      let q=job.root.state,actions=[],valid=true;
      const act=a=>{if(!canWork()){valid=false;return;}visited++;const n=move(q,a);if(n===q||n.topOut){valid=false;return;}q=n;actions.push(a);};
      const rotate=()=>{const d=(rotation-q.active.rotation+4)%4;if(d)act(d===1?'CW':d===2?'R180':'CCW');};
      const shift=()=>{for(let i=0;valid&&q.active.x!==predecessor.x&&i<14;i++)act(q.active.x<predecessor.x?'R':'L');};
      if(rotateFirst){rotate();if(valid)shift();}else{shift();if(valid)rotate();}
      if(valid&&(q.active.x!==predecessor.x||q.active.rotation!==rotation||q.active.y>predecessor.y))valid=false;
      while(valid&&q.active.y<predecessor.y)act('SD');
      if(valid){act(action);if(valid)act('HD');if(valid)accept(job,q,actions,true);}
      if(!complete)return result();
      if(!job.remaining.includes(t))break;
     }
    }
   }
  }
 }
 if(options.search===false){complete=!jobs.some(j=>j.remaining.length);return result();}
 for(const job of jobs){job.queue=[{state:job.root.state,parent:-1,action:null}];job.seen=new Set([poseKey(job.root.state.active)]);}
 // Interleave HOLD roots; one hard target must not starve a held-piece target.
 while(jobs.some(j=>j.remaining.length&&j.head<j.queue.length))for(const job of jobs){
  if(!job.remaining.length||job.head>=job.queue.length)continue;
  if(!canWork())return result();visited++;fallbackNodes++;
  const index=job.head++,n=job.queue[index],landing=dropLanding(n.state.board,n.state.active),classification=spin(n.state.board,landing);
  const event={type:landing.type,target:landing,spin:classification};
  if(job.remaining.some(t=>matches(t,event))){
   const locked=lockLanding(n.state,landing,classification);accept(job,locked,witness(job.queue,index,[]),false);
   if(!job.remaining.length)continue;
  }
  for(const action of ['L','R','CW','CCW','R180','SD']){
   const next=move(n.state,action);if(next===n.state)continue;const key=poseKey(next.active);if(job.seen.has(key))continue;job.seen.add(key);job.queue.push({state:next,parent:index,action});
  }
 }
 return result();
}
// Hypothetical fresh T access, not a claim that a T is currently available.
function tDoubleAccessCore(board,options={}){
 const maxNodes=options.maxNodes??16000,deadline=options.deadline??Infinity,now=options.now??(()=>Date.now());
 if(!Array.isArray(board)||board.length!==40||board.some(r=>typeof r!=='string'||r.length!==10||/[^.X#IJLOSTZ]/.test(r)))return{reachable:null,witness:[],event:null,visited:0,complete:false,reason:'invalid-board'};
 let state=createState({board,active:'T',canHold:false}),visited=0;
 const existingFullRows=board.filter(r=>!r.includes('.')).length;
 if(!fits(board,state.active))return{reachable:false,witness:[],event:null,visited,complete:true};
 const highest=board.findIndex(r=>r!=='..........'),plane=Math.max(PROFILE.spawn.y,(highest<0?40:highest)-4),prefix=[];
 // Every T orientation fits wholly above the stack at this plane. Horizontal
 // and rotational changes commute with this empty-air descent. Do not clip
 // upward movement when the stack itself reaches the spawn region.
 const clipped=plane>PROFILE.spawn.y;
 while(state.active.y<plane){state=move(state,'SD');prefix.push('SD');}
 const queue=[{state,parent:-1,action:null}],seen=new Set([poseKey(state.active)]);let head=0;
 while(head<queue.length){
  if(visited>=maxNodes||now()>=deadline)return{reachable:null,witness:[],event:null,visited,complete:false};
  const index=head++,n=queue[index],a=n.state.active;visited++;
  if(!fits(board,{...a,y:a.y+1})&&spin(board,a)==='full'){
   const occupied=cells(a),rows=new Set(occupied.map(c=>c[1]));let lines=existingFullRows;
   for(const y of rows)if([...board[y]].every((v,x)=>v!=='.'||occupied.some(([cx,cy])=>cx===x&&cy===y)))lines++;
   if(lines===2){const locked=move(n.state,'HD');if(!locked.topOut)return{reachable:true,witness:witness(queue,index,prefix),event:locked.lastEvent,visited,complete:true};}
  }
  for(const action of ['L','R','CW','CCW','R180','SD']){const next=move(n.state,action);if(next===n.state||(clipped&&next.active.y<plane))continue;const key=poseKey(next.active);if(seen.has(key))continue;seen.add(key);queue.push({state:next,parent:index,action});}
 }
 return{reachable:false,witness:[],event:null,visited,complete:true};
}
return Object.freeze({withQueries,queryMetrics,PROFILE,LEGACY_PROFILE,migrateState,pieces,kicks,cells,emptyBoard,spawn,fits,createState,validate,move,replay,placements,targetedPlacements,spin,tDoubleAccess});
});
