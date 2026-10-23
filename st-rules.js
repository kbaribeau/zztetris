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
 else if(action==='HD'){let landing={...a};while(fits(s.board,{...landing,y:landing.y+1}))landing.y++;if(landing.y!==a.y)landing.lastRotation=null;const occupied=cells(landing),classification=spin(s.board,landing),board=s.board.map(r=>[...r]);for(const[x,y]of occupied)board[y][x]=a.type;const cleared=[];let rows=board.map(r=>r.join('')).filter((r,i)=>{if(!r.includes('.')){cleared.push(i);return false;}return true;});while(rows.length<40)rows.unshift('..........');const active=spawn(s.queue[0]);const topOut=occupied.every(([,y])=>y<20)||(active!==null&&!fits(rows,active));const event={type:a.type,target:{type:a.type,x:landing.x,y:landing.y,rotation:landing.rotation},cells:occupied,lines:cleared.length,clearedRows:cleared,spin:classification,topOut};next={...s,board:rows,active,canHold:true,queue:s.queue.slice(1),streamCursor:s.streamCursor+(active?1:0),topOut,lastEvent:event};}
 else return s;
 return{...next,revision:s.revision+1,lastEvent:action==='HD'?next.lastEvent:null};
}
function replay(state,actions){let s=state;const events=[];for(let i=0;i<actions.length;i++){const n=move(s,actions[i]);if(n===s)return{state:s,events,valid:false,failedAt:i};s=n;if(s.lastEvent)events.push(s.lastEvent);}return{state:s,events,valid:true,failedAt:null};}
function poseKey(a){const r=a.lastRotation;const semantic=a.type==='T'&&r?((r.to-r.from+4)%4!==2&&r.kickIndex===4?'upgrade':'rotation'):'none';return[a.type,a.x,a.y,a.rotation,semantic].join(':');}
function placements(s,options={}){
 const out=[],seenOut=new Map();let visited=0,complete=true;
 const maxNodes=options.maxNodes??16000,deadline=options.deadline??Infinity,now=options.now??(()=>Date.now());
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
 const queues=roots.map(r=>[{state:r.state,witness:r.witness}]),seen=roots.map(r=>new Set([poseKey(r.state.active)])),heads=roots.map(()=>0);
 outer:while(queues.some((q,i)=>heads[i]<q.length)){for(let k=0;k<queues.length;k++){
  if(heads[k]>=queues[k].length)continue;
  if(visited>=maxNodes||now()>=deadline){complete=false;break outer;}
  const n=queues[k][heads[k]++];visited++;
  const locked=move(n.state,'HD'),event=locked.lastEvent;
  if(event&&!event.topOut){
   // In v2 deduplicate equivalent outcomes, not merely matching targets: an
   // empty-hold swap-back can have the same target but different held/next pieces.
   const id=unlimited?JSON.stringify([event,locked.active,locked.hold,locked.queue,locked.streamCursor]):[roots[k].hold,event.target.type,event.target.x,event.target.y,event.target.rotation,event.spin].join(':');
   const placement={target:event.target,hold:roots[k].hold,holdCount:roots[k].holdCount,witness:[...n.witness,'HD'],state:locked,event};
   const index=seenOut.get(id);
   if(index===undefined){seenOut.set(id,out.length);out.push(placement);}
   else if(placement.witness.length<out[index].witness.length)out[index]=placement;
  }
  for(const action of ['L','R','CW','CCW','R180','SD']){
   const next=move(n.state,action);if(next===n.state)continue;
   const key=poseKey(next.active);if(seen[k].has(key))continue;seen[k].add(key);
   queues[k].push({state:next,witness:[...n.witness,action]});
  }
 }}return{placements:out,complete,visited};
}
// Hypothetical fresh T access, not a claim that a T is currently available.
function tDoubleAccess(board,options={}){
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
 const queue=[{state,witness:prefix}],seen=new Set([poseKey(state.active)]);let head=0;
 while(head<queue.length){
  if(visited>=maxNodes||now()>=deadline)return{reachable:null,witness:[],event:null,visited,complete:false};
  const n=queue[head++],a=n.state.active;visited++;
  if(!fits(board,{...a,y:a.y+1})&&spin(board,a)==='full'){
   const occupied=cells(a),rows=new Set(occupied.map(c=>c[1]));let lines=existingFullRows;
   for(const y of rows)if([...board[y]].every((v,x)=>v!=='.'||occupied.some(([cx,cy])=>cx===x&&cy===y)))lines++;
   if(lines===2){const locked=move(n.state,'HD');if(!locked.topOut)return{reachable:true,witness:[...n.witness,'HD'],event:locked.lastEvent,visited,complete:true};}
  }
  for(const action of ['L','R','CW','CCW','R180','SD']){const next=move(n.state,action);if(next===n.state||(clipped&&next.active.y<plane))continue;const key=poseKey(next.active);if(seen.has(key))continue;seen.add(key);queue.push({state:next,witness:[...n.witness,action]});}
 }
 return{reachable:false,witness:[],event:null,visited,complete:true};
}
return Object.freeze({PROFILE,LEGACY_PROFILE,migrateState,pieces,kicks,cells,emptyBoard,spawn,fits,createState,validate,move,replay,placements,spin,tDoubleAccess});
});
