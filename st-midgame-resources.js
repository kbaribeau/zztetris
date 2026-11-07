/* Ordinary-midgame resource obligations. Public, replay-validated identities,
 * not a new Reset recognizer and never a hidden-piece or fresh-allowance guess. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-bag'),require('./st-access'),require('./st-resource-history'),require('./st-center-obligations'),require('./st-obligation-admission'),require('./st-resource-search')):factory(root.STRules,root.STStructure,root.STBag,root.STAccess,root.STResourceHistory,root.STCenterObligations,root.STObligationAdmission,root.STResourceSearch);if(typeof module==='object'&&module.exports)module.exports=api;else root.STMidgameResources=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,B,A,H,Center,Admission,Search){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),key=c=>JSON.stringify(c.slice().sort(([x,y],[u,v])=>x-u||y-v));
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&S.canonicalClear(e);
const left=e=>e.cells.every(([x])=>x<4),center=e=>e.cells.every(([x])=>x>=4&&x<7),nonRight=e=>e.cells.every(([x])=>x<7);
const completions=Center.completions;
// Canonical planning supply shared by proof creation and retention. This adds
// only the unique remaining public bag member, consumes that deduction once,
// and never changes the observed history or invents its piece/bag identity.
function extendForced(state){if(!state.bag||state.bag.error)return state;const type=B.forcedNext(state.bag);return type?{...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)}:state;}
// Only replay-resolved summaries supply these allocation facts. Preserve past
// consumption and pairing, not just the live inventory, across every prefix.
function slHistory(summary){
 if(summary.coverage?.status!=='complete'||!Array.isArray(summary.observedSL)||!Array.isArray(summary.allocations)||!Array.isArray(summary.pairs))return null;
 const pieces=Object.fromEntries(summary.observedSL.map(p=>[p.id,{...clone(p),allocation:null,pair:null}]));
 for(const a of summary.allocations||[])if(pieces[a.pieceId])pieces[a.pieceId].allocation=clone(a);
 for(const pair of summary.pairs||[])for(const id of [pair.rootId,pair.partnerId])if(pieces[id])pieces[id].pair=clone(pair);
 return{pieces,closed:clone(summary.center?.closed||[]),milestones:clone(summary.milestones||{}),locks:summary.locks||0};
}
const hasSevereS=Admission.hasSevereS;
function newUnclassified(resource){return resource?.introducedUnclassified?.length>0;}
// Supported finite movement and unresolved historical accommodation are
// different claims. Preserve existing admission, but never describe the latter
// as repaired or omit it from retained/fresh advice.
function discloseAdvice(result){
 const resources=result?.evidence?.resourceObligations;
 if(!result?.target||!resources||result.recommendation?.kind==='risky')return result;
 const identities=['S','L'].flatMap(kind=>(resources['unclassified'+kind]||[]).map(p=>{const id=p[kind==='S'?'sId':'lId'];const partnerKind=kind==='S'?'L':'S',partner=p[partnerKind==='S'?'sId':'lId'];return id==null?kind+' (bag '+p.bag+(partner==null?'':', '+partnerKind+partner)+')':kind+id;}));
 if(!identities.length&&!result.evidence.resourceDisclosure)return result;
 const prior=result.evidence.resourceDisclosure,reason=prior&&result.reason?.endsWith(prior.detail)?result.reason.slice(0,-prior.detail.length).trimEnd():result.reason;
 const hazards=(result.recommendation?.hazards||[]).filter(p=>p.code!=='unclassified-SL-accommodation');
 const detail=identities.length?'Unresolved accommodation: '+identities.join(', ')+'. These identities remain tracked; this finite prefix does not certify their repair.':null;
 const disclosure=detail?{code:'unclassified-SL-accommodation',identities,detail,downside:'The remaining accommodation may constrain later moves or require repair.'}:null;
 return{...result,reason:detail?reason+' '+detail:reason,recommendation:{...result.recommendation,hazards:disclosure?[...hazards,disclosure]:hazards},evidence:{...result.evidence,resourceDisclosure:disclosure}};
}
function start(raw,summary={}){
 let next=-1;const instance=(p,type)=>p&&p.type===type?{id:p.id,type,bag:p.bag??null}:{id:next--,type,bag:null};
 const live=summary.instances||{},a=raw.active?instance(live.active,raw.active.type):null,h=raw.hold?instance(live.hold,raw.hold):null,q=raw.queue.map((t,i)=>instance(live.queue?.[i],t));
 const all=[a,h,...q].filter(Boolean),byId=id=>all.find(p=>p.id===id);
 // The observed inventory includes already consumed S/L pieces. Absence from
 // the live queue alone must never fabricate a deferred counterpart.
 const observedSL=summary.coverage?.status==='complete'&&Array.isArray(summary.observedSL)?clone(summary.observedSL):null,sl=slHistory(summary);
 return{active:a,hold:h,queue:q,nextId:next,observedSL,slHistory:sl,introducedUnclassified:[],initialUnclassified:Admission.uncertaintyKeys(summary),extraZ:summary.extraZ?.status==='available'?'available':summary.extraZ?.status||'unknown',
  extraZRemaining:Number.isInteger(summary.extraZ?.remaining)?summary.extraZ.remaining:null,resetActive:summary.reset?.status==='active',resetProgress:summary.reset?.progress||0,
  pendingCenter:(summary.center?.pending||[]).map(p=>({rootId:p.rootId,bag:p.rootBag??byId(p.rootId)?.bag??null,family:p.family,alternatives:clone(p.alternatives),created:false})),
  hangingS:(summary.hangingS?.evidence||[]).map(e=>({id:e.sId,bag:e.bag,known:true})),
  unclassifiedS:(summary.hangingS?.unclassified||[]).map(s=>({...clone(s),...(summary.center?.closed?.some(p=>p.family==='SL'&&p.rootId===s.sId&&p.status==='invalidated')?{invalidated:true}:{})})),
  hangingL:(summary.hangingL?.evidence||[]).map(e=>({id:e.lId,bag:e.bag,known:true})),unclassifiedL:clone(summary.hangingL?.unclassified||[]),violations:[],scoredTs:[],
  // Keep the serialized compatibility tag stable. It never authorizes a route:
  // retention replays fresh authenticated facts; binding() keys all search facts.
  originKey:JSON.stringify([summary.coverage?.status,observedSL,all,summary.center?.pending,summary.center?.debt,summary.hangingS?.evidence,summary.hangingS?.unclassified,summary.center?.closed?.filter(p=>p.status==='invalidated'),summary.hangingL?.evidence,summary.hangingL?.unclassified,summary.extraZ?.status,summary.extraZ?.allocations?.map(a=>[a.at,a.pieceId]),summary.milestones?.maintenanceHandoff].concat(summary.reset?.credits?.length||['active','invalid'].includes(summary.reset?.status)?[{reset:summary.reset,remaining:summary.extraZ?.remaining}]:[]))};
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
 const n={...prior,queue:prior.queue.slice(),pendingCenter:clone(prior.pendingCenter),hangingS:clone(prior.hangingS),unclassifiedS:clone(prior.unclassifiedS||[]),hangingL:clone(prior.hangingL||[]),unclassifiedL:clone(prior.unclassifiedL||[]),violations:prior.violations.slice(),scoredTs:prior.scoredTs.slice()};
 const reject=reason=>{if(!n.violations.includes(reason))n.violations.push(reason);};
 while(n.queue.length<before.queue.length)n.queue.push({id:n.nextId--,type:before.queue[n.queue.length],bag:null});
 for(const action of p.witness||[]){if(action==='HOLD'){if(n.hold){const a=n.active;n.active=n.hold;n.hold=a;}else{n.hold=n.active;n.active=n.queue.shift()??null;}}}
 const piece=n.active,e=p.event;if(!piece||piece.type!==e.type){reject('piece-identity-mismatch');return n;}
 if(e.type==='T'){if(n.resetActive){if(e.lines===0&&left(e)&&n.resetProgress<2){n.resetProgress++;if(n.extraZRemaining!==null)n.extraZRemaining++;if(n.resetProgress===2)n.resetActive=false;}else reject('reset-T-must-be-zero-clear-Left');}else if(tsd(e))n.scoredTs.push(piece.id);else reject('ordinary-T-must-score');}
 if(e.type==='Z'){if(nonRight(e)){if(n.extraZRemaining!==null? n.extraZRemaining<=0:n.extraZ!=='available')reject('extra-Z-not-available');if(n.extraZRemaining!==null)n.extraZRemaining--;n.extraZ=n.extraZRemaining>0?'available':'used';}else if(!e.cells.every(([x])=>x>=8))reject('ordinary-Z-outside-reviewed-Right-role');}
 const centerFacts=Center.frame(before.board,p.state.board,e,n.pendingCenter);
 const finished=n.pendingCenter.filter(target=>Center.inspect(target,centerFacts).finished);
 // Projection-only diagnostic: a proposed route may not spend a usable
 // pending partner elsewhere and then claim the absent-partner waiting exception.
 if(e.type==='L'&&prior.pendingCenter.some(p=>p.family==='SL'&&!p.lost&&!finished.some(f=>f.rootId===p.rootId)))n.pendingLDiverted=true;
 const leftS=left(e)&&e.type==='S';
 // Only actual consumption of the identified S, or its exact supported SL
 // completion, discharges that identity. A same-bag label alone is not enough.
 const completedS=finished.filter(p=>p.family==='SL').map(p=>p.rootId);
 n.hangingS=n.hangingS.filter(s=>!(leftS&&s.id===piece.id)&&!completedS.includes(s.id));
 // Keep rejected-route target diagnostics outside the shared factual state.
 // Actual accounting removes an invalidated target; this route must remember
 // that it lost one, and cannot revive it by a later exact-looking placement.
 n.pendingCenter=n.pendingCenter.filter(target=>!finished.includes(target)).map(target=>{
  const result=Center.inspect(target,centerFacts);
  return result.removed?null:{...target,alternatives:result.alternatives,lost:Boolean(target.lost)||!result.live.length};
 }).filter(Boolean);
 if(center(e)&&!e.lines&&S.CENTER_PAIRS[e.type]){
  const alternatives=completions(p.state.board,[],e.type);
  if(alternatives.length&&!n.pendingCenter.some(p=>key(p.alternatives[0].cells)===key(alternatives[0].cells)))n.pendingCenter.push({rootId:piece.id,bag:piece.bag,family:S.centerPairFamily(e.type),alternatives,created:true});
 }
 if(e.type==='L'&&piece.bag!==null){
  const paired=finished.find(p=>p.family==='SL');
  if(nonRight(e)&&(!paired||paired.bag!==piece.bag)){
   const pending=n.pendingCenter.find(p=>p.family==='SL'&&p.bag===piece.bag&&!p.lost);
   const s=[n.active,n.hold,...n.queue].find(p=>p?.type==='S'&&p.bag===piece.bag)||(pending&&{id:pending.rootId,bag:pending.bag});
   // A known seven-bag counterpart still exists beyond this prefix.
   // Null is an unresolved identity, not a guessed piece or queue position.
   if(s&&!n.hangingS.some(h=>h.id===s.id))n.hangingS.push({id:s.id,bag:s.bag,known:true});
   else if(!s&&n.observedSL&&!n.observedSL.some(p=>p.type==='S'&&p.bag===piece.bag)&&!n.hangingS.some(h=>h.bag===piece.bag))
    n.hangingS.push({id:null,bag:piece.bag,known:true});
  }
 }
 // L bookkeeping is diagnostic only: it never enters repair(), its search
 // grammar, or the ordinary placement rejection rules. Exact LO completion
 // is source-supported accommodation (Chapter 10), not a mirrored S search.
 const completedL=finished.filter(p=>p.family==='LO').map(p=>p.rootId);
 n.hangingL=n.hangingL.filter(l=>!completedL.includes(l.id)&&!(e.type==='L'&&l.id===piece.id&&(left(e)||finished.some(p=>p.family==='SL'))));
 const displacedBags=[];
 if(e.type==='S'&&left(e))displacedBags.push(piece.bag);
 if(e.type==='L')for(const p of finished)if(p.family==='SL'&&p.bag!==piece.bag)displacedBags.push(p.bag);
 for(const bag of displacedBags){
  if(bag===null)continue;
  const l=[n.active,n.hold,...n.queue].find(p=>p?.type==='L'&&p.bag===bag&&p.id!==piece.id);
  if(l&&!n.hangingL.some(h=>h.id===l.id))n.hangingL.push({id:l.id,bag:l.bag,known:true});
  else if(!l&&n.observedSL&&!n.observedSL.some(p=>p.type==='L'&&p.bag===bag)&&!n.hangingL.some(h=>h.bag===bag))
   n.hangingL.push({id:null,bag,known:true});
 }
 for(const l of n.hangingL.slice()){
  const consumed=e.type==='L'&&l.id===piece.id,wasPending=prior.pendingCenter.some(p=>p.family==='LO'&&p.rootId===l.id);
  if((consumed||wasPending)&&!n.pendingCenter.some(p=>p.family==='LO'&&p.rootId===l.id&&!p.lost)){
   n.hangingL=n.hangingL.filter(h=>h.id!==l.id);n.unclassifiedL.push({lId:l.id,bag:l.bag,reason:'Unreviewed accommodation of an observed surplus L.'});
  }
 }
 // An observed S whose supported accommodation disappears is uncertain,
 // not a live token to spend again and not a silently completed obligation.
 for(const s of n.hangingS.slice()){
  const consumed=e.type==='S'&&s.id===piece.id,wasPending=prior.pendingCenter.some(p=>p.family==='SL'&&p.rootId===s.id);
  if((consumed||wasPending)&&!n.pendingCenter.some(p=>p.family==='SL'&&p.rootId===s.id&&!p.lost)){
   n.hangingS=n.hangingS.filter(h=>h.id!==s.id);
   if(!n.unclassifiedS.some(h=>h.sId===s.id&&h.bag===s.bag))n.unclassifiedS.push({sId:s.id,bag:s.bag,requiresAccommodation:true,...(wasPending?{invalidated:true}:{}),reason:'Unreviewed accommodation of an observed surplus S.'});
  }
 }
 // Reclassify from the same consumed-allocation facts used by actual history.
 // Incremental live-token bookkeeping alone cannot see S then L consumed in
 // unreviewed shapes, or a consumed counterpart from an earlier search node.
 if(prior.slHistory){
  const sl=n.slHistory=clone(prior.slHistory);sl.locks++;sl.milestones=H.advanceSLMilestones(sl.milestones,p.state.board,e,sl.locks);
  const region=left(e)?'left':center(e)?'center':nonRight(e)?'left-center':e.cells.every(([x])=>x>=7)?'right':'cross-right';
  if(sl.pieces[piece.id])sl.pieces[piece.id].allocation={at:sl.locks,pieceId:piece.id,type:e.type,region,cells:clone(e.cells),lines:e.lines,spin:e.spin,clearedRows:(e.clearedRows||[]).slice()};
  for(const p of finished){
   const pair={family:p.family,rootId:p.rootId,partnerId:piece.id,at:sl.locks};
   for(const id of [p.rootId,piece.id])if(sl.pieces[id])sl.pieces[id].pair=pair;
   sl.closed.push({...clone(p),status:'fulfilled',at:sl.locks,partnerId:piece.id});
  }
  for(const old of prior.pendingCenter)if(!old.lost&&!finished.includes(old)&&!finished.some(p=>p.rootId===old.rootId)&&!n.pendingCenter.some(p=>p.rootId===old.rootId&&!p.lost))sl.closed.push({...clone(old),status:'invalidated',at:sl.locks});
  const allocated=sl.pieces[piece.id];
  if(e.type==='S'&&prior.hangingS.some(s=>s.id===piece.id)&&region!=='left'&&allocated?.pair?.family!=='SL'&&!n.pendingCenter.some(p=>p.family==='SL'&&p.rootId===piece.id&&!p.lost)&&allocated)allocated.allocation.requiresAccommodation=true;
  const classified=H.classifySL({fresh:true,pieces:sl.pieces,center:{pending:n.pendingCenter.filter(p=>!p.lost),closed:sl.closed},milestones:sl.milestones});
  for(const kind of ['S','L']){
   const idKey=kind==='S'?'sId':'lId',facts=classified['hanging'+kind];
   // Unknown synthetic identities are never upgraded into observed bag facts.
   const unknown=n['hanging'+kind].filter(p=>p.id!==null&&!sl.pieces[p.id]);
   n['hanging'+kind]=facts.evidence.map(p=>({id:p[idKey],bag:p.bag,known:true})).concat(unknown);
   n['unclassified'+kind]=facts.unclassified.map(p=>({...clone(p),...(kind==='S'&&sl.closed.some(c=>c.family==='SL'&&c.rootId===p.sId&&c.status==='invalidated')?{invalidated:true}:{})}));
  }
 }
 // Record newly uncertain identities without changing ordinary admission.
 // The presenter carries and discloses uncertainty; it is not a repair proof.
 n.introducedUnclassified=Admission.introducedUnclassified(Admission.uncertaintyKeys(n),prior.initialUnclassified||[]);
 n.active=n.queue.shift()??null;
 // Only a deduced final bag member can be appended by the existing planner.
 // It carries no invented bag identity or allowance.
 while(n.queue.length<p.state.queue.length)n.queue.push({id:n.nextId--,type:p.state.queue[n.queue.length],bag:null});
 if(n.active?.type!==p.state.active?.type||(n.hold?.type??null)!==p.state.hold)reject('piece-identity-mismatch');
 const pendingT=[n.active,n.hold,...n.queue].some(p=>p?.type==='T');
 n.centerBlocked=n.pendingCenter.some(debt=>debt.lost||!n.resetActive&&pendingT&&!partnerAccessible(n,debt.alternatives.map(c=>c.piece)));
 // Even a completed pair is not a scoring route. A T/T collision is accepted
 // only if the next checked node actually scores one of those identities.
 n.tCollision=n.active?.type==='T'&&n.hold?.type==='T';
 n.hangingLive=n.hangingS.filter(h=>[n.active,n.hold,...n.queue].some(p=>p?.id===h.id));
 return n;
}
function checkPath(raw,path,summary={}){if(!Array.isArray(path)||path.length>7)return{valid:false,reason:'resource-prefix-limit',resource:start(raw,summary)};let state=extendForced(R.createState(raw)),resource=start(state,summary);for(const p of path){const r=R.replay(state,p.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(p.event))return{valid:false,reason:'invalid-resource-witness',resource};resource=step(state,{...p,state:r.state,event:r.events[0]},resource);if(resource.violations.length)return{valid:false,reason:resource.violations[0],resource};state=r.state;}return{valid:!resource.centerBlocked,reason:resource.centerBlocked?'center-partner-blocked-by-T-or-unseen':null,resource,state};}
function binding(resource){return JSON.stringify([resource.active,resource.hold,resource.queue,resource.observedSL,resource.slHistory,resource.initialUnclassified,resource.introducedUnclassified,resource.extraZ,resource.extraZRemaining,resource.resetActive,resource.resetProgress,resource.pendingCenter,resource.hangingS,resource.unclassifiedS,resource.hangingL,resource.unclassifiedL,resource.violations,resource.scoredTs,Boolean(resource.pendingLDiverted)]);}
const {repairGoal,repair,pendingLStageEligible,pendingLStage}=Search.create({step,binding,hasSevereS});
return Object.freeze({hasSevereS,resetLosesObligation:Admission.resetLosesObligation,discloseAdvice,newUnclassified,start,step,checkPath,partnerAccessible,repairGoal,binding,repair,extendForced,pendingLStageEligible,pendingLStage});
});
