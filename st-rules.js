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
 else if(action==='HD'){let landing={...a};while(fits(s.board,{...landing,y:landing.y+1}))landing.y++;if(landing.y!==a.y)landing.lastRotation=null;const occupied=cells(landing),classification=spin(s.board,landing),board=s.board.slice();
  // Cells are row-major: rebuild each touched string once, leaving all other
  // immutable rows shared. The outer array and every edited row stay private.
  for(let i=0;i<occupied.length;){const y=occupied[i][1],row=[...board[y]];
   do{row[occupied[i][0]]=a.type;i++;}while(i<occupied.length&&occupied[i][1]===y);
   board[y]=row.join('');
  }
  // Imported positions may already contain full rows outside the piece.
  // Keep the complete scan and original pre-clear row indices/order.
  const cleared=[];let rows=board.filter((r,i)=>{if(!r.includes('.')){cleared.push(i);return false;}return true;});while(rows.length<40)rows.unshift('..........');const active=spawn(s.queue[0]);const topOut=occupied.every(([,y])=>y<20)||(active!==null&&!fits(rows,active));const event={type:a.type,target:{type:a.type,x:landing.x,y:landing.y,rotation:landing.rotation},cells:occupied,lines:cleared.length,clearedRows:cleared,spin:classification,topOut};next={...s,board:rows,active,canHold:true,queue:s.queue.slice(1),streamCursor:s.streamCursor+(active?1:0),topOut,lastEvent:event};}
 else return s;
 return{...next,revision:s.revision+1,lastEvent:action==='HD'?next.lastEvent:null};
}
function replay(state,actions){let s=state;const events=[];for(let i=0;i<actions.length;i++){const n=move(s,actions[i]);if(n===s)return{state:s,events,valid:false,failedAt:i};s=n;if(s.lastEvent)events.push(s.lastEvent);}return{state:s,events,valid:true,failedAt:null};}
// Legal four-cell poses have origins in [-3,9] x [-3,39]. Keep the three
// T-spin evidence classes distinct, exactly as the former textual key did.
function poseKey(a){const r=a.lastRotation,semantic=a.type==='T'&&r?((r.to-r.from+4)%4!==2&&r.kickIndex===4?2:1):0;return(((TYPES.indexOf(a.type)*16+a.x+4)*64+a.y+4)*4+a.rotation)*3+semantic;}
function witness(queue,index,prefix){const actions=[];for(let n=queue[index];n.parent>=0;n=queue[n.parent])actions.push(n.action);actions.reverse();return prefix.concat(actions,'HD');}
// Completed geometry queries are reusable only within one synchronous request.
// Full states are keys (including pose, HOLD, bag and draw cursor); arbitrary
// stop predicates are deliberately excluded. Cached values never share mutable
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
 const id=cacheable?JSON.stringify([kind,input,kind==='placements'?options.allowHold!==false:null]):null;
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
 // Interleave frontiers so a tight budget cannot starve hold.
 const queues=roots.map(r=>[{state:r.state,parent:-1,action:null,depth:r.witness.length}]),seen=roots.map(r=>new Set([poseKey(r.state.active)])),heads=roots.map(()=>0);
 outer:while(queues.some((q,i)=>heads[i]<q.length)){for(let k=0;k<queues.length;k++){
  if(heads[k]>=queues[k].length)continue;
  if(visited>=maxNodes||now()>=deadline){complete=false;break outer;}
  const indexInQueue=heads[k]++,n=queues[k][indexInQueue];visited++;
  const locked=move(n.state,'HD'),event=locked.lastEvent;
  if(event&&!event.topOut){
   // In v2 deduplicate equivalent outcomes, not merely matching targets: an
   // empty-hold swap-back can have the same target but different held/next pieces.
   const id=unlimited?JSON.stringify([event,locked.active,locked.hold,locked.queue,locked.streamCursor]):[roots[k].hold,event.target.type,event.target.x,event.target.y,event.target.rotation,event.spin].join(':');
   const index=seenOut.get(id);
   if(index===undefined||n.depth+1<out[index].witness.length){
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
return Object.freeze({withQueries,queryMetrics,PROFILE,LEGACY_PROFILE,migrateState,pieces,kicks,cells,emptyBoard,spawn,fits,createState,validate,move,replay,placements,spin,tDoubleAccess});
});
