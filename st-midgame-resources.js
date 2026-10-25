/* Ordinary-midgame resource obligations. Public, replay-validated identities,
 * not a new Reset recognizer and never a hidden-piece or fresh-allowance guess. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-bag'),require('./st-access')):factory(root.STRules,root.STStructure,root.STBag,root.STAccess);if(typeof module==='object'&&module.exports)module.exports=api;else root.STMidgameResources=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,B,A){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),key=c=>JSON.stringify(c.slice().sort(([x,y],[u,v])=>x-u||y-v));
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&S.canonicalClear(e);
const left=e=>e.cells.every(([x])=>x<4),center=e=>e.cells.every(([x])=>x>=4&&x<7),nonRight=e=>e.cells.every(([x])=>x<7);
const completions=board=>S.geometry(board).center.completions.filter(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported').map(c=>({piece:c.piece,cells:c.cells}));
function start(raw,summary={}){
 let next=-1;const instance=(p,type)=>p&&p.type===type?{id:p.id,type,bag:p.bag??null}:{id:next--,type,bag:null};
 const live=summary.instances||{},a=raw.active?instance(live.active,raw.active.type):null,h=raw.hold?instance(live.hold,raw.hold):null,q=raw.queue.map((t,i)=>instance(live.queue?.[i],t));
 const all=[a,h,...q].filter(Boolean),byId=id=>all.find(p=>p.id===id);
 return{active:a,hold:h,queue:q,nextId:next,extraZ:summary.extraZ?.status==='available'?'available':summary.extraZ?.status||'unknown',
  pendingCenter:(summary.center?.pending||[]).map(p=>({rootId:p.rootId,bag:p.rootBag??byId(p.rootId)?.bag??null,family:p.family,alternatives:clone(p.alternatives),created:false})),
  hangingS:(summary.hangingS?.evidence||[]).map(e=>({id:e.sId,bag:e.bag,known:true})),violations:[],scoredTs:[],
  originKey:JSON.stringify([summary.coverage?.status,all,summary.center?.pending,summary.center?.debt,summary.hangingS?.evidence,summary.extraZ?.status,summary.extraZ?.allocations?.map(a=>[a.at,a.pieceId]),summary.milestones?.maintenanceHandoff])};
}
// Necessary piece-flow test, not a geometric placement proof. Enumerate HOLD
// choices without spending a T; a partner behind two pending Ts is inaccessible.
function partnerAccessible(state,pieces){
 const seen=new Set(),todo=[{a:state.active?.type??null,h:state.hold?.type??null,q:state.queue.map(p=>p.type)}];
 for(let i=0;i<todo.length;i++){
  const n=todo[i],k=JSON.stringify(n);if(seen.has(k))continue;seen.add(k);
  if(pieces.includes(n.a))return true;
  if(n.a&&n.a!=='T'&&n.q.length)todo.push({a:n.q[0],h:n.h,q:n.q.slice(1)});
  if(n.a&&n.h)todo.push({a:n.h,h:n.a,q:n.q});
  else if(n.a&&n.q.length)todo.push({a:n.q[0],h:n.a,q:n.q.slice(1)});
 }
 return false;
}
function step(before,p,prior){
 const n={...prior,queue:prior.queue.slice(),pendingCenter:clone(prior.pendingCenter),hangingS:clone(prior.hangingS),violations:prior.violations.slice(),scoredTs:prior.scoredTs.slice()};
 const reject=reason=>{if(!n.violations.includes(reason))n.violations.push(reason);};
 while(n.queue.length<before.queue.length)n.queue.push({id:n.nextId--,type:before.queue[n.queue.length],bag:null});
 for(const action of p.witness||[]){if(action==='HOLD'){if(n.hold){const a=n.active;n.active=n.hold;n.hold=a;}else{n.hold=n.active;n.active=n.queue.shift()??null;}}}
 const piece=n.active,e=p.event;if(!piece||piece.type!==e.type){reject('piece-identity-mismatch');return n;}
 if(e.type==='T'){if(tsd(e))n.scoredTs.push(piece.id);else reject('ordinary-T-must-score');}
 if(e.type==='Z'){if(nonRight(e)){if(n.extraZ!=='available')reject('extra-Z-not-available');n.extraZ='used';}else if(!e.cells.every(([x])=>x>=8))reject('ordinary-Z-outside-reviewed-Right-role');}
 const available=completions(before.board),matches=c=>c.piece===e.type&&key(c.cells)===key(e.cells);
 const finished=n.pendingCenter.filter(p=>p.alternatives.some(matches));
 const leftS=left(e)&&e.type==='S';if(leftS)n.hangingS=n.hangingS.filter(s=>s.id!==piece.id&&(s.bag===null||s.bag!==piece.bag));
 if(e.type==='L'&&piece.bag!==null){
  const paired=finished.find(p=>p.family==='SL');
  if(left(e)||center(e)&&(!paired||paired.bag!==piece.bag)){
   const s=[n.active,n.hold,...n.queue].find(p=>p?.type==='S'&&p.bag===piece.bag);
   if(s&&!n.hangingS.some(h=>h.id===s.id))n.hangingS.push({id:s.id,bag:s.bag,known:true});
  }
 }
 const cleared=e.clearedRows||[],translate=cells=>cells.map(([x,y])=>[x,cleared.includes(y)?-1:y+cleared.filter(r=>r>y).length]);
 const after=completions(p.state.board);
 n.pendingCenter=n.pendingCenter.filter(p=>!p.alternatives.some(matches)).map(p=>{
  const alternatives=p.alternatives.map(c=>({...c,cells:translate(c.cells)}));
  // Losing a supported partner is debt, not completion. Keep its exact cells
  // until filled by that partner or removed entirely by an actual clear.
  const removed=alternatives.every(c=>c.cells.every(([,y])=>y<0));
  return removed?null:{...p,alternatives,lost:!alternatives.some(c=>c.cells.every(([,y])=>y>=0)&&after.some(a=>a.piece===c.piece&&key(a.cells)===key(c.cells)))};
 }).filter(Boolean);
 if(center(e)&&!e.lines&&S.CENTER_PAIRS[e.type]){
  const alternatives=after.filter(c=>c.piece===S.CENTER_PAIRS[e.type]);
  if(alternatives.length&&!n.pendingCenter.some(p=>key(p.alternatives[0].cells)===key(alternatives[0].cells)))n.pendingCenter.push({rootId:piece.id,bag:piece.bag,family:e.type+S.CENTER_PAIRS[e.type],alternatives,created:true});
 }
 n.active=n.queue.shift()??null;
 // Only a deduced final bag member can be appended by the existing planner.
 // It carries no invented bag identity or allowance.
 while(n.queue.length<p.state.queue.length)n.queue.push({id:n.nextId--,type:p.state.queue[n.queue.length],bag:null});
 if(n.active?.type!==p.state.active?.type||(n.hold?.type??null)!==p.state.hold)reject('piece-identity-mismatch');
 const pendingT=[n.active,n.hold,...n.queue].some(p=>p?.type==='T');
 n.centerBlocked=n.pendingCenter.some(debt=>debt.lost||pendingT&&!partnerAccessible(n,debt.alternatives.map(c=>c.piece)));
 // Even a completed pair is not a scoring route. A T/T collision is accepted
 // only if the next checked node actually scores one of those identities.
 n.tCollision=n.active?.type==='T'&&n.hold?.type==='T';
 n.hangingLive=n.hangingS.filter(h=>[n.active,n.hold,...n.queue].some(p=>p?.id===h.id));
 return n;
}
function checkPath(raw,path,summary={}){if(!Array.isArray(path)||path.length>7)return{valid:false,reason:'resource-prefix-limit',resource:start(raw,summary)};let state=R.createState(raw);const forced=state.bag&&B.forcedNext(state.bag);if(forced)state={...state,queue:[...state.queue,forced],bag:B.consume(state.bag,forced)};let resource=start(state,summary);for(const p of path){const r=R.replay(state,p.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(p.event))return{valid:false,reason:'invalid-resource-witness',resource};resource=step(state,{...p,state:r.state,event:r.events[0]},resource);if(resource.violations.length)return{valid:false,reason:resource.violations[0],resource};state=r.state;}return{valid:!resource.centerBlocked,reason:resource.centerBlocked?'center-partner-blocked-by-T-or-unseen':null,resource,state};}
// A local landing is positive evidence only. It must be reached from the real
// observed inventory through a checked finite prefix before it can be promised.
function repairGoal(event,instance,resource){return event.type==='S'&&left(event)&&resource.hangingS.some(h=>h.id===instance?.id);}
function binding(resource){return JSON.stringify([resource.active,resource.hold,resource.queue,resource.extraZ,resource.pendingCenter,resource.hangingS,resource.violations,resource.scoredTs]);}
function repair(raw,resource,{maxNodes=4000,deadline=Infinity,now=()=>Date.now(),depth=4,notches=S.notchPattern(raw.board),centerCompletions=true}={}){
 const centerIds=centerCompletions?resource.pendingCenter.map(p=>p.rootId):[];
 const done=r=>!r.hangingS.length&&!r.pendingCenter.some(p=>centerIds.includes(p.rootId))&&!r.centerBlocked&&!r.tCollision;
 if(!resource.hangingS.length&&!centerIds.length)return{valid:true,visited:0,status:'no-new-resource-repair-needed'};
 let visited=0,complete=true,layer=[{state:R.createState(raw),resource,path:[],notches}];
 const leftCovered=board=>S.geometry(board).left.covered,rootCovered=leftCovered(raw.board);
 for(let d=0;d<depth&&layer.length;d++){
  const next=[];
  for(const n of layer){
   if(now()>=deadline||visited>=maxNodes)return{valid:null,visited,status:'resource-repair-budget'};
   const inspect=p=>{
    if(!S.canonicalClear(p.event)||p.event.topOut)return null;
    const phase=S.advanceNotches(n.state.board,p,n.notches);if(!phase.valid)return null;
    if(S.transition(n.state,p,undefined,{notches:n.notches}).cycleViolations.length)return null;
    const r=step(n.state,p,n.resource);if(r.violations.length||leftCovered(p.state.board)>rootCovered)return null;
    const path=[...n.path,p];
    if(done(r)){
     const access=A.prefix(raw,path,{notches,deadline,now,maxNodes:Math.max(0,maxNodes-visited)});visited+=access.visited;
     if(access.reachable===true)return{valid:true,visited,status:centerIds.length?'visible-Center-and-S-repair':'visible-left-S-repair',path};
     if(access.reachable===null)complete=false;
    }
    // A short, explicit visible preparation, not an arbitrary hypothetical
    // future surface. Every prefix must pass notch and resource checks.
    if(d+1<depth&&(left(p.event)&&!p.event.lines&&('IJLO'.includes(p.event.type)||p.event.type==='S'&&r.hangingS.length<n.resource.hangingS.length)||p.event.lines||n.resource.pendingCenter.some(c=>!r.pendingCenter.some(v=>v.rootId===c.rootId))||p.event.type==='Z'&&p.event.cells.every(([x])=>x>=8)))
     next.push({state:p.state,resource:r,path,notches:phase.pattern,score:10*r.pendingCenter.filter(p=>centerIds.includes(p.rootId)).length+10*r.hangingS.length+leftCovered(p.state.board)+Math.max(...S.geometry(p.state.board).left.profile)-p.event.lines*3});
    return null;
   };
   // Try the exact recognized partner first. These are legal input replays
   // from the actual pose/HOLD; a silhouette alone never discharges a debt.
   const geometry=S.geometry(n.state.board,{notches:n.notches}),targets=[...geometry.center.completions,...geometry.left.completions.filter(c=>c.piece==='S')];
   let held=n.state;
   for(let count=0;count<=2;count++){
    if(count){const swapped=R.move(held,'HOLD');if(swapped===held||swapped.topOut)break;held=swapped;}
    for(const c of targets){
     if(c.piece!==held.active?.type||now()>=deadline||visited>=maxNodes)continue;
     visited++;const witness=[...Array(count).fill('HOLD'),...c.witness],r=R.replay(n.state,witness);
     if(!r.valid||r.events.length!==1||key(r.events[0].cells)!==key(c.cells))continue;
     const goal=inspect({state:r.state,event:r.events[0],target:r.events[0].target,witness});if(goal)return goal;
    }
   }
   const e=R.placements(n.state,{maxNodes:Math.max(0,maxNodes-visited),deadline,now});visited+=e.visited;if(!e.complete)complete=false;
   for(const p of e.placements){if(now()>=deadline||visited>maxNodes){complete=false;break;}const goal=inspect(p);if(goal)return goal;}
  }
  const seen=new Set();layer=next.sort((a,b)=>a.score-b.score).filter(n=>{const k=n.state.board.join('')+binding(n.resource);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,4);
 }
 return{valid:complete?false:null,visited,status:complete?'no-visible-resource-repair':'resource-repair-budget'};
}
return Object.freeze({start,step,checkPath,partnerAccessible,repairGoal,binding,repair});
});
