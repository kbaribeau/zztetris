/* One finite resource-search grammar for legacy and compact route adapters.
 * Only factual step/binding and uncertainty access differ. Keep ordering,
 * replay/access checks, beam pruning and proof budgets in this single module.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-access')):factory(root.STRules,root.STStructure,root.STAccess);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResourceSearch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,A){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),key=c=>JSON.stringify(c.slice().sort(([x,y],[u,v])=>x-u||y-v));
const left=e=>e.cells.every(([x])=>x<4);
function create({step,binding,hasSevereS,canStep=()=>true,describe=()=>({}),hasUnclassifiedS=r=>Boolean(r.unclassifiedS?.length),uncertainty=r=>({unclassifiedS:clone(r.unclassifiedS||[])})}){
// A local landing is positive evidence only. It must be reached from the real
// observed inventory through a checked finite prefix before it can be promised.
function repairGoal(event,instance,resource){return event.type==='S'&&left(event)&&resource.hangingS.some(h=>h.id===instance?.id);}
function repair(raw,resource,options={}){const result=repairCore(raw,resource,options);return{...describe(resource),...result,queryStatus:result.valid===true?'proven':result.valid===false?'failed-within-scope':'unfinished',scope:{kind:'visible-resource-repair',grammar:'left-center-v1',beamWidth:4,depth:options.depth??4,centerCompletions:options.centerCompletions!==false,...(typeof options.acceptStep==='function'?{additionalStepFilter:true}:{})}};}
function repairCore(raw,resource,{maxNodes=4000,deadline=Infinity,now=()=>Date.now(),depth=4,notches=S.notchPattern(raw.board),centerCompletions=true,acceptStep=null}={}){
 // This finite repair grammar cannot establish how an already consumed,
 // unclassified S was accommodated. Keep uncertainty separate from false
 // (a completed bounded search), and never manufacture a replay target.
 if(hasSevereS(resource))return{valid:null,visited:0,status:'unclassified-S-accommodation',...uncertainty(resource)};
 const centerIds=centerCompletions?resource.pendingCenter.map(p=>p.rootId):[];
 const done=r=>!hasSevereS(r)&&!r.hangingS.length&&!r.pendingCenter.some(p=>centerIds.includes(p.rootId))&&!r.centerBlocked&&!r.tCollision;
 if(!resource.hangingS.length&&!centerIds.length)return{valid:true,visited:0,status:hasUnclassifiedS(resource)?'no-confirmed-resource-repair-needed':'no-new-resource-repair-needed',...uncertainty(resource)};
 let visited=0,complete=true,layer=[{state:R.createState(raw),resource,path:[],notches}];
 const leftCovered=board=>S.geometry(board).left.covered,rootCovered=leftCovered(raw.board);
 for(let d=0;d<depth&&layer.length;d++){
  const next=[];
  for(const n of layer){
   if(now()>=deadline||visited>=maxNodes)return{valid:null,visited,status:'resource-repair-budget'};
   if(!canStep(n.resource)){complete=false;continue;}
   const beforeCavities=S.cavityFacts(n.state.board);
   const inspect=p=>{
    if(!S.canonicalClear(p.event)||p.event.topOut)return null;
    const phase=S.advanceNotches(n.state.board,p,n.notches);if(!phase.valid)return null;
    if(S.transition(n.state,p,undefined,{notches:n.notches}).cycleViolations.length)return null;
    // Optional callers may narrow this grammar, never waive its checks.
    if(typeof acceptStep==='function'&&!acceptStep(n.state,p,n.notches))return null;
    const r=step(n.state,p,n.resource);if(r.violations.length||leftCovered(p.state.board)>rootCovered)return null;
    // This witness must remain admissible when each future lock becomes the
    // next real move. Covered-cell counts cannot detect newly sealed pockets.
    if(S.cavityRepairDebt(beforeCavities,S.cavityFacts(p.state.board),p.event).length)return null;
    const path=[...n.path,p];
    if(done(r)){
     const access=A.prefix(raw,path,{notches,deadline,now,maxNodes:Math.max(0,maxNodes-visited)});visited+=access.visited;
     if(access.reachable===true)return{valid:true,visited,status:centerIds.length?'visible-Center-and-S-repair':'visible-left-S-repair',path,...describe(r)};
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
// A narrowly scoped unfinished SL stage. This is conditional completion access
// plus actual accommodation of PUBLIC intervening draws, never an L arrival.
function pendingLStageEligible(raw,resource){
 const pending=resource.pendingCenter;
 return Boolean(pending?.length===1&&pending[0].family==='SL'&&Number.isInteger(pending[0].rootId)&&pending[0].rootId>0&&!pending[0].lost&&pending[0].alternatives.length&&pending[0].alternatives.every(c=>c.piece==='L')&&!resource.pendingLDiverted&&!resource.violations.length&&!hasSevereS(resource)&&resource.hangingS.every(s=>s.id===pending[0].rootId));
}
function pendingLStage(raw,resource,options={}){return{...describe(resource),...pendingLStageCore(raw,resource,options)};}
function pendingLStageCore(raw,resource,{maxNodes=4000,deadline=Infinity,now=()=>Date.now(),notches=S.notchPattern(raw.board),coveredDebt=[],waitingHint=null}={}){
 if(!pendingLStageEligible(raw,resource))return{valid:false,visited:0,status:'ineligible-pending-L-stage'};
 const rootId=resource.pendingCenter[0].rootId;let visited=0,stopped=false;
 const room=board=>board.findIndex(row=>/[^.]/.test(row))>20||board.every(row=>row==='..........');
 const remaining=()=>Math.max(0,maxNodes-visited),bounded=()=>now()<deadline&&visited<maxNodes;
 const access=(state,r,phase)=>{
  const pending=r.pendingCenter.find(p=>p.rootId===rootId);if(!pending||pending.lost)return null;
  const candidates=S.geometry(state.board,{notches:phase}).center.completions.filter(c=>c.piece==='L'&&S.supportedCenterCompletion(c,[pending])&&pending.alternatives.some(a=>key(a.cells)===key(c.cells)));
  for(const c of candidates){if(!bounded()||c.witness.length>remaining()){stopped=true;return null;}visited+=c.witness.length;
   const conditional=R.createState({rules:state.rules,board:state.board,active:'L',queue:[],canHold:false}),proof=R.replay(conditional,c.witness);
   if(proof.valid&&proof.events.length===1&&key(proof.events[0].cells)===key(c.cells))return{piece:'L',cells:clone(c.cells),witness:c.witness.slice(),access:'conditional-fresh-L-only',arrival:'not-established'};
  }return null;
 };
 const state=R.createState(raw);if(!room(state.board))return{valid:false,visited,status:'pending-L-stage-headroom'};
 const rootAccess=access(state,resource,notches);if(!rootAccess)return{valid:stopped?null:false,visited,status:stopped?'pending-L-stage-budget':'pending-L-stage-inaccessible'};
 const finish=n=>{
  const live=n.resource.pendingCenter.find(p=>p.rootId===rootId),closed=!live;
  const exhausted=!n.state.active&&n.state.queue.length===0&&n.state.hold!=='L';
  if(!closed&&!exhausted)return null;
  if(n.resource.centerBlocked||n.resource.tCollision||n.resource.hangingS.length&&!n.resource.hangingS.every(s=>!closed&&s.id===rootId)||hasSevereS(n.resource))return null;
  const covered=A.repairPrefix(state,n.path,{notches,initialDebt:coveredDebt,stages:resource.pendingCenter});if(!covered.valid)return null;
  return{valid:true,visited,status:closed?'visible-pending-L-closure':'visible-pending-L-wait',waitingStage:!closed,rootId,origin:clone(state),target:rootAccess,endpointTarget:n.access,path:n.path,publicDrawsExhausted:exhausted,parkedHold:n.state.hold??null,arrival:closed?'actually-supplied-and-placed':'not-established',queryStatus:'proven',scope:{kind:'pending-L-visible-wait',beamWidth:4,maxNodes,depth:Math.min(7,state.queue.length+1+(state.hold?1:0))},...describe(n.resource)};
 };
 const childFor=(n,p)=>{
    if(!canStep(n.resource)){stopped=true;return null;}
    if(!S.canonicalClear(p.event)||p.event.topOut||!room(p.state.board)||p.event.cells.some(([x])=>x>=7)&&!['Z','T','I'].includes(p.event.type))return null;
    const phase=S.advanceNotches(n.state.board,p,n.notches);if(!phase.valid||S.transition(n.state,p,undefined,{notches:n.notches}).cycleViolations.length)return null;
    // Keep this new grammar narrow: it may preserve this exact Center stage,
    // not create unrelated Left repairs while searching for an absent L.
    if(A.newlyCovered(n.state.board,p.state.board,p.event,phase.pattern).some(([x])=>x<4)||S.cavityRepairDebt(S.cavityFacts(n.state.board),S.cavityFacts(p.state.board),p.event).length)return null;
    const r=step(n.state,p,n.resource);if(r.violations.length||r.pendingLDiverted||r.pendingCenter.some(v=>v.rootId!==rootId||v.lost)||hasSevereS(r))return null;
    const live=r.pendingCenter.some(v=>v.rootId===rootId),conditional=live?access(p.state,r,phase.pattern):null;if(live&&!conditional)return null;
    return {state:p.state,resource:r,path:[...n.path,p],notches:phase.pattern,access:conditional,coveredDebt:A.repairStep(n.state.board,p.state.board,p.event,n.coveredDebt,phase.pattern),score:S.geometry(p.state.board).left.covered+Math.max(...S.geometry(p.state.board).left.profile)-p.event.lines*3};
 };
 let layer=[{state,resource,path:[],notches,access:rootAccess,coveredDebt:coveredDebt.map(c=>c.slice()),score:0}];const immediate=finish(layer[0]);if(immediate)return immediate;
 const depth=Math.min(7,state.queue.length+1+(state.hold?1:0));
 let startDepth=0,hintReplayed=0;
 let h=waitingHint,o=h?.origin;
 const shaped=o&&h.rootId===rootId&&Array.isArray(h.target?.cells)&&h.target.cells.length===4&&
  h.target.cells.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger))&&
  Array.isArray(h.waiting)&&h.waiting.length<=7&&h.waiting.every(p=>Array.isArray(p?.witness)&&p.witness.length<=256&&p.event);
 const matches=(origin,cells)=>origin.rules===state.rules&&JSON.stringify(origin.board)===JSON.stringify(state.board)&&
  JSON.stringify(origin.active)===JSON.stringify(state.active)&&origin.hold===state.hold&&origin.canHold===state.canHold&&
  Array.isArray(origin.queue)&&origin.queue.every((piece,i)=>state.queue[i]===piece)&&key(cells)===key(rootAccess.cells);
 let aligned=Boolean(shaped&&matches(o,h.target.cells));
 // Align a consumed candidate only by its literal public event tape. No saved
 // consumed-count flag or arbitrary witness slice supplies authority.
 if(shaped&&!aligned){let origin=o,cells=clone(h.target.cells);
  try{for(let i=0;i<h.waiting.length;i++){
   const p=h.waiting[i];if(!bounded()||p.witness.length>remaining()){stopped=true;break;}visited+=p.witness.length;
   const replay=R.replay(origin,p.witness);if(!replay.valid||replay.events.length!==1||JSON.stringify(replay.events[0])!==JSON.stringify(p.event))break;
   const rows=replay.events[0].clearedRows||[];cells=cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(v=>v>y).length]);origin=replay.state;
   if(matches(origin,cells)){h={...h,origin,target:{cells},waiting:h.waiting.slice(i+1)};o=origin;aligned=true;break;}
  }}catch{aligned=false;}
 }
 if(aligned&&Array.isArray(h.waiting)&&h.waiting.length<=depth&&h.waiting.every(p=>Array.isArray(p.witness)&&p.witness.length<=256&&p.event)){
  let n=layer[0],valid=true;
  for(const p of h.waiting){
   if(!bounded()||p.witness.length>remaining()){stopped=true;valid=false;break;}
   visited+=p.witness.length;const replay=R.replay(n.state,p.witness);
   if(!replay.valid||replay.events.length!==1||JSON.stringify(replay.events[0])!==JSON.stringify(p.event)){valid=false;break;}
   const child=childFor(n,{state:replay.state,event:replay.events[0],witness:p.witness,target:replay.events[0].target});
   if(!child){valid=false;break;}n=child;hintReplayed++;
   const proof=finish(n);if(proof)return{...proof,hintReplayed};
  }
  if(valid){layer=[n];startDepth=n.path.length;}else hintReplayed=0;
 }
 for(let d=startDepth;d<depth&&layer.length;d++){
  const next=[];
  for(const n of layer){if(!bounded())return{valid:null,visited,status:'pending-L-stage-budget',queryStatus:'unfinished'};
   if(!canStep(n.resource)){stopped=true;continue;}
   const placements=R.placements(n.state,{maxNodes:remaining(),deadline,now});visited+=placements.visited;if(!placements.complete)stopped=true;
   for(const p of placements.placements){
    if(!bounded()){stopped=true;break;}
    const child=childFor(n,p);if(!child)continue;
    const proof=finish(child);if(proof)return{...proof,hintReplayed};next.push(child);
   }
  }
  const seen=new Set();layer=next.sort((a,b)=>a.score-b.score).filter(n=>{const id=n.state.board.join('')+binding(n.resource)+JSON.stringify(n.coveredDebt);if(seen.has(id))return false;seen.add(id);return true;}).slice(0,4);
 }
 // Beam/cap failure is never a theorem about all waiting alternatives.
 return{valid:null,visited,status:stopped?'pending-L-stage-budget':'no-pending-L-wait-witness',queryStatus:'unfinished',scope:{kind:'pending-L-visible-wait',beamWidth:4,depth}};
}
return Object.freeze({repairGoal,repair,pendingLStageEligible,pendingLStage});
}
return Object.freeze({create});
});
