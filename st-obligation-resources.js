/* Compact ordinary resource/search backend.
 * start consumes a literal current Context/position; only Route extends forced
 * public supply. A resource is an immutable view of ONE Route, never a second
 * factual ledger. Nested checks/searches continue that Route and its fixed
 * request root. No historical summary, archive, receipts or origin proof is
 * synthesized. Only native current Context inputs are accepted.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-obligation-context'),require('./st-obligation-route'),require('./st-obligation-assessment'),require('./st-obligation-admission'),require('./st-resource-search'),require('./st-obligation-projection')):factory(root.STRules,root.STObligationContext,root.STObligationRoute,root.STObligationAssessment,root.STObligationAdmission,root.STResourceSearch,root.STObligationProjection);if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationResources=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,Context,Route,Assessment,Admission,Search,Projection){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),trusted=new WeakSet(),roots=new WeakMap();
const check=(ok,reason)=>{if(!ok)throw Error('Invalid compact resources: '+reason);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const subject=p=>p?{id:p.id,type:p.type,bag:p.bag}:null;
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).filter(k=>k!=='domain').sort().map(k=>[k,canonical(x[k])])):x;
function supplyFacts(supply){return{originKnown:supply.originKnown,nextObservedId:supply.nextObservedId??supply.nextId,nextSyntheticId:supply.nextSyntheticId??-1,streamCursor:supply.streamCursor,
 active:supply.active,hold:supply.hold,queue:supply.queue,frontier:supply.frontier,knowledge:supply.knowledge?{remaining:supply.knowledge.remaining,...(supply.knowledge.error?{error:supply.knowledge.error}:{})}:null};}
// Resource compatibility excludes pose/revision, history, request budgets and
// external plan association. Geometry has its own independent caller binding.
// Actual/projection tags and allocator field names are representation details.
// Left jobs are observational work today, not route permission or ranking.
// Accepting a checked plan records that job without invalidating its proof.
// Full node binding still includes jobs. Revisit this exclusion before adding
// any strategy that depends on them.
function factualBinding(state,supply,openingBoundary){const {leftGoals,...permissionFacts}=state;return JSON.stringify(canonical([permissionFacts,supplyFacts(supply),openingBoundary]));}
function view(route,root){
 const resources=Route.resolve(route).resources,supply=route.projection.supply;
 const out=freeze({...resources,active:subject(supply.active),hold:subject(supply.hold),queue:supply.queue.map(subject),route});trusted.add(out);roots.set(out,root);return out;
}
function read(resource){check(trusted.has(resource),'current projected resource required; start or explicitly rebase a projection');return resource;}
function position(resource){return read(resource).route.projection.position;}
function bound(raw,resource){
 // Search normalizes away the preceding lock event. It does not waive pose,
 // revision, HOLD, public supply, bag knowledge or stream cursor agreement.
 check(JSON.stringify(R.createState(raw))===JSON.stringify(R.createState(position(resource))),'public position differs from projected route');
}
function start(raw,current,{horizon=14,planReferences=[],extendForced=true}={}){
 const facts=Context.resolve(current,{position:raw});check(facts.status==='available','current accounting unavailable');
 return view(Route.start(current.state,{position:raw,inventory:current.inventory,openingBoundary:current.boundary,horizon,planReferences,extendForced}),factualBinding(current.state,current.inventory,current.boundary));
}
// A deliberate projected entry point is a new query root, not a way to
// continue an existing resource or import hypothetical facts as actual state.
function fromProjection(projection,{openingBoundary,horizon=14,planReferences=[],extendForced=true}={}){return view(Route.fromProjection(projection,{openingBoundary,horizon,planReferences,extendForced}),factualBinding(projection.state,projection.supply,openingBoundary));}
function startUnknown(raw,options={}){const projection=Projection.startUnknown(R.createState(raw));return fromProjection(projection,{...options,openingBoundary:{firstBagLocks:null,sourcePatternSeen:false}});}
function step(before,p,resource){
 bound(before,resource);const result=Route.step(resource.route,{witness:p.witness,event:p.event}),next=view(result.route,rootBinding(resource));
 if(p.state!==undefined)bound(p.state,next);
 return next;
}
function binding(resource){return Route.binding(read(resource).route);}
function rootBinding(resource){read(resource);return roots.get(resource);}
// Extra-Z preference compares routes under the SAME request root. Current
// optional-Z balance/status, spending, and unrelated account eligibility flags
// must not split the class before the preference can compare them.
function spendNeutralBinding(resource){const r=read(resource),p=r.route.projection;return JSON.stringify(canonical([rootBinding(r),p.state.sl,supplyFacts(p.supply),r.uncertainty,r.scoredTs]));}
// Pending-SL compares accounting under one root while deliberately comparing
// different Left geometry. Safety/D/profile facts remain in full node binding;
// they are separately admitted, not a reason to split the allocation class.
function allocationBinding(resource){const r=read(resource),p=r.route.projection;return JSON.stringify(canonical([rootBinding(r),p.state.sl,supplyFacts(p.supply),diversityBinding(r),r.initialUnclassified,r.introducedUnclassified,r.originalOutstanding]));}
function historyDiversityEnabled(resource){const state=read(resource).route.projection.state;return state.availability==='known'&&state.sl.handoff;}
function diversityBinding(resource){const r=read(resource);return JSON.stringify(canonical([r.active,r.hold,r.queue,r.extraZ,r.extraZRemaining,r.resetActive,r.resetProgress,r.pendingCenter,r.hangingS,r.hangingL,r.uncertainty,r.violations,r.scoredTs,Boolean(r.pendingLDiverted)]));}
function hasSevereS(resource){return read(resource).uncertainty.S.severeCount>0;}
function newUnclassified(resource){return read(resource).introducedUnclassified.length>0;}
const search=Search.create({step,binding,hasSevereS,hasUnclassifiedS:r=>r.uncertainty.S.count>0,
 describe:r=>({uncertainty:clone(r.uncertainty)}),
 canStep:r=>r.route.assessment.schedule.locks<r.route.assessment.horizon});
function repairGoal(event,instance,resource){return search.repairGoal(event,instance,read(resource));}
function repair(raw,resource,options={}){bound(raw,resource);return search.repair(position(resource),resource,options);}
function pendingLStageEligible(raw,resource){bound(raw,resource);return search.pendingLStageEligible(position(resource),resource);}
function pendingLStage(raw,resource,options={}){bound(raw,resource);return search.pendingLStage(position(resource),resource,options);}
function checkPath(raw,path,current,options={}){
 let resource=current?.route?current:start(raw,current,options);if(current?.route)bound(raw,resource);
 if(!Array.isArray(path)||path.length>7)return{valid:false,reason:'resource-prefix-limit',resource};
 const result=Route.checkPath(resource.route,path);resource=view(result.route,rootBinding(resource));
 return{valid:result.valid,reason:result.reason,resource,...(result.valid||result.reason==='center-partner-blocked-by-T-or-unseen'?{state:position(resource)}:{}),steps:result.steps||[]};
}
function discloseAdvice(result){
 const resources=result?.evidence?.resourceObligations;
 if(!result?.target||!resources||result.recommendation?.kind==='risky')return result;
 const identities=['S','L'].flatMap(kind=>{
  const facts=resources.uncertainty?.[kind],named=facts?.named||resources['unclassified'+kind]||[];
  const labels=named.map(p=>{const id=p[kind==='S'?'sId':'lId'],partnerKind=kind==='S'?'L':'S',partner=p[partnerKind==='S'?'sId':'lId'];return id==null?kind+' (bag '+p.bag+(partner==null?'':', '+partnerKind+partner)+')':kind+id;});
  const count=(facts?.aggregate||[]).reduce((a,b)=>a+b,0);if(count)labels.push(count+' additional '+kind+' accommodation'+(count===1?'':'s')+' (identity unavailable)');return labels;
 });
 if(!identities.length&&!result.evidence.resourceDisclosure)return result;
 const prior=result.evidence.resourceDisclosure,reason=prior&&result.reason?.endsWith(prior.detail)?result.reason.slice(0,-prior.detail.length).trimEnd():result.reason;
 const hazards=(result.recommendation?.hazards||[]).filter(p=>p.code!=='unclassified-SL-accommodation');
 const detail=identities.length?'Unresolved accommodation: '+identities.join(', ')+'. These unresolved obligations remain tracked; this finite prefix does not certify their repair.':null;
 const disclosure=detail?{code:'unclassified-SL-accommodation',identities,detail,downside:'The remaining accommodation may constrain later moves or require repair.'}:null;
 return{...result,reason:detail?reason+' '+detail:reason,recommendation:{...result.recommendation,hazards:disclosure?[...hazards,disclosure]:hazards},evidence:{...result.evidence,resourceDisclosure:disclosure}};
}
return Object.freeze({start,startUnknown,fromProjection,position,step,checkPath,binding,rootBinding,factualBinding,spendNeutralBinding,allocationBinding,historyDiversityEnabled,diversityBinding,hasSevereS,newUnclassified,repairGoal,repair,pendingLStageEligible,pendingLStage,partnerAccessible:Assessment.partnerAccessible,resetLosesObligation:Admission.resetLosesObligation,discloseAdvice});
});
