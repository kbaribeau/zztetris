/* Portable session evidence. JSON is untrusted; derived resource flags are never
 * restored. This format stores visible inputs, not hidden RNG or future bags. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-bag'),require('./st-resource-history'),require('./st-pattern-history'),require('./st-planner'),require('./st-opening'),()=>require('./st-coach-config')):factory(root.STRules,root.STBag,root.STResourceHistory,root.STPatternHistory,root.STPlanner,root.STOpening,()=>root.STCoachConfig);if(typeof module==='object'&&module.exports)module.exports=api;else root.STSession=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,H,PH,P,O,C){
'use strict';
const FORMAT='zztetris-st-session',VERSION=1,ENGINE='st-coach-session-2026-10-31-delayed-J-v1';
const LIMITS=Object.freeze({bytes:4*1024*1024,depth:64,nodes:150000,witness:256,continuation:16});
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Transient next-lock routing is not portable certificate authority.
function portableAdvice(value){const result=clone(value);if(result.evidence?.openingHandoff)delete result.evidence.openingHandoff.recovery;return result;}
function portableCommitment(value){const result=clone(value);if(result.advice)result.advice=portableAdvice(result.advice);return result;}
// Portable action-order suggestion only, never an executable certificate.
function portablePendingLHint(h){try{
 if(!h||!Number.isInteger(h.rootId)||h.rootId<=0||R.validate(h.origin).length||!Array.isArray(h.target?.cells)||h.target.cells.length!==4||!Array.isArray(h.waiting)||h.waiting.length>7)return null;
 const cells=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger)&&c[0]>=0&&c[0]<10&&c[1]>=0&&c[1]<40;
 if(!h.target.cells.every(cells))return null;
 const origin=P.observe(h.origin);delete origin.bag;delete origin.lastEvent;
 if(origin.queue.length>7)return null;
 if(origin.active){const a=origin.active,r=a.lastRotation;origin.active={type:a.type,x:a.x,y:a.y,rotation:a.rotation,lastRotation:r?{from:r.from,to:r.to,kickIndex:r.kickIndex}:null};}
 const waiting=[];for(const p of h.waiting){const e=p?.event,t=e?.target;
  if(!e||!t||!['I','J','L','O','S','T','Z'].includes(e.type)||t.type!==e.type||![t.x,t.y,t.rotation,e.lines].every(Number.isInteger)||t.rotation<0||t.rotation>3||e.lines<0||e.lines>4||!['none','mini','full'].includes(e.spin)||typeof e.topOut!=='boolean'||!Array.isArray(p?.witness)||!p.witness.length||p.witness.length>256||p.witness.at(-1)!=='HD'||p.witness.some(a=>!['L','R','SD','HD','HOLD','CW','CCW','R180'].includes(a))||!Array.isArray(e.cells)||e.cells.length!==4||!e.cells.every(cells)||!Array.isArray(e.clearedRows)||!e.clearedRows.every(y=>Number.isInteger(y)&&y>=0&&y<40))return null;
  waiting.push({witness:p.witness.slice(),event:{type:e.type,target:{type:t.type,x:t.x,y:t.y,rotation:t.rotation},cells:clone(e.cells),lines:e.lines,clearedRows:e.clearedRows.slice(),spin:e.spin,topOut:e.topOut}});
 }
 return{origin,rootId:h.rootId,target:{cells:clone(h.target.cells)},waiting};
 }catch{return null;}}
const defaults=()=>({timeMs:C().SEARCH_TIME_MS,depth:3,width:8,maxNodes:45000});
function bounded(value){let nodes=0;const seen=new Set();function visit(x,d){if(++nodes>LIMITS.nodes||d>LIMITS.depth)throw Error('Session exceeds structural limits.');if(!x||typeof x!=='object')return;if(seen.has(x))throw Error('Session contains cycles.');seen.add(x);for(const [key,v] of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsupported session property.');visit(v,d+1);}seen.delete(x);}visit(value,0);if(JSON.stringify(value).length>LIMITS.bytes)throw Error('Session exceeds size limit.');}
function position(raw){if(!raw||R.validate(raw).length)throw Error('Invalid session position.');if(raw.rules!==R.PROFILE.id)throw Error('Session rules version is unsupported; import a position instead.');if(raw.queue.length>6)throw Error('Session may contain only six visible preview pieces.');if(raw.bag&&(B.validate(raw.bag).length||!Number.isInteger(raw.bag.observedCount)||raw.bag.observedCount<0||typeof raw.bag.provenance!=='string'))throw Error('Invalid session bag evidence.');const result=P.observe(raw);delete result.lastEvent;return result;}
function settings(input){const d=defaults();if(!input||Object.keys(input).sort().join()!==Object.keys(d).sort().join()||!Object.keys(d).every(k=>input[k]===d[k]))throw Error('Unsupported session search settings; current coach settings are required.');return d;}
function candidateShape(advice){
 if(!advice||typeof advice!=='object'||!Array.isArray(advice.continuation)||!advice.continuation.length||advice.continuation.length>LIMITS.continuation)return false;
 for(const step of advice.continuation){if(!Array.isArray(step?.witness)||!step.witness.length||step.witness.length>LIMITS.witness||step.witness.at(-1)!=='HD'||step.witness.some(a=>!['L','R','SD','HD','HOLD','CW','CCW','R180'].includes(a))||!step.event||!same(step.event.target,step.target))return false;}
 return same(advice.witness,advice.continuation[0].witness)&&same(advice.target,advice.continuation[0].target);
}
function candidate(state,advice){
 if(!candidateShape(advice))return false;let current=state;
 for(const step of advice.continuation){const r=R.replay(current,step.witness);if(!r.valid||r.events.length!==1||!same(r.events[0],step.event))return false;current=r.state;}
 return true;
}
function validateBag(context,originBag,current){
 if(originBag!==null&&(!originBag||B.validate(originBag).length))throw Error('Invalid resource-origin bag evidence.');
 let bag=originBag?clone(originBag):null;
 if(context.fresh){const actual=B.fromObserved({observed:[context.origin.active.type,...context.origin.queue],startPhase:0});if(!same(actual,bag))throw Error('Resource origin does not match the claimed first bag.');}
 for(const step of context.steps)for(const t of step.revealed){if(bag){bag=B.consume(bag,t);if(B.validate(bag).length)throw Error('Resource draws contradict bag evidence.');}}
 if(!same(bag,current.bag??null))throw Error('Resource replay does not match current bag evidence.');
}
function create(state,{resourceHistory,resourceOriginBag=null,patternHistory=null,openingPhase=false,openingSource=null,openingClear=null,openingRepair=null,previous=null,commitment=null,pendingLHint=null,search=defaults()}={}){
 const observation=position(state),resourceContext=H.exportContext(observation,resourceHistory),coverage=H.resolve(observation,resourceHistory).coverage;
 const result={format:FORMAT,schemaVersion:VERSION,engineVersion:ENGINE,position:observation,search:settings(search),coaching:{resourceContext:resourceContext?clone(resourceContext):null,resourceOriginBag:resourceContext?clone(resourceOriginBag):null,resourceCoverage:clone(coverage),patternHistory:patternHistory?clone(patternHistory):null,openingPhase,openingSource:openingSource?clone(openingSource):null,openingClear:openingClear?clone(openingClear):null,openingRepair:openingRepair?clone(openingRepair):null,previous:previous?portableAdvice(previous):null,commitment:commitment?portableCommitment(commitment):null,pendingLHint:portablePendingLHint(pendingLHint)}};
 bounded(result);return result;
}
function prepare(input){
 bounded(input);if(input?.format!==FORMAT||input.schemaVersion!==VERSION)throw Error('Unsupported session format version.');if(typeof input.engineVersion!=='string'||!input.engineVersion.trim())throw Error('Invalid coach provenance.');const differentCoach=input.engineVersion!==ENGINE;
 const state=position(input.position),search=settings(input.search),c=input.coaching;
 if(!c||typeof c!=='object'||typeof c.openingPhase!=='boolean')throw Error('Missing session coaching state.');
 const warnings=differentCoach?['Imported a session from a different coach version. Validated history and settings are preserved; advice will be recomputed.']:[];let resourceHistory,resourceOriginBag=null;
 if(c.resourceContext){resourceHistory=H.importContext(state,c.resourceContext);const coverage=H.resolve(state,resourceHistory).coverage;if(!['complete','partial'].includes(coverage.status))throw Error('Invalid resource replay: '+coverage.reason);validateBag(c.resourceContext,c.resourceOriginBag,state);resourceOriginBag=clone(c.resourceOriginBag);}
 else{resourceHistory=H.start(state);resourceOriginBag=state.bag?clone(state.bag):null;warnings.push('Resource history is unavailable; prior S/L/Z allocations remain unknown.');}
 const patternHistory=c.patternHistory?clone(c.patternHistory):null;
 if(PH.resolve(state,patternHistory).status==='invalid-history')throw Error('Pattern history does not replay to the position.');
 const opening=O.validateSessionState(state,{active:c.openingPhase,source:c.openingSource??null,clear:c.openingClear??null,repair:c.openingRepair??null},search);warnings.push(...opening.warnings);
 if(c.resourceContext&&H.resolve(state,resourceHistory).milestones?.maintenanceHandoff&&opening.session.active)throw Error('Opening phase contradicts the recorded maintenance handoff.');
 let previous=null,commitment=null;const pendingLHint=differentCoach?null:portablePendingLHint(c.pendingLHint);
 if(c.handoffRecovery||c.previous?.evidence?.openingHandoff?.recovery||c.commitment?.advice?.evidence?.openingHandoff?.recovery)warnings.push('Transient handoff routing was discarded; advice remains subject to fresh validation.');
 if(differentCoach&&(c.previous||c.commitment))warnings.push('Saved coach advice and construction commitments were discarded for fresh planning.');
 if(c.previous?.recommendation?.kind==='risky'||c.previous?.status==='recommended-risky-placement')warnings.push('Saved risky advice was discarded for fresh planning.');
 if(!differentCoach&&c.previous&&c.previous.recommendation?.kind!=='risky'&&c.previous.status!=='recommended-risky-placement'){try{if(candidateShape(c.previous))previous=portableAdvice(c.previous);}catch{}if(!previous)warnings.push('Stale or invalid previous advice was discarded.');}
 if(!differentCoach&&c.commitment&&c.commitment.advice?.recommendation?.kind!=='risky'&&c.commitment.advice?.status!=='recommended-risky-placement'){try{const origin=position(c.commitment.observation);if(candidate(origin,c.commitment.advice)&&P.resourceGoal(c.commitment.advice.continuation))commitment=portableCommitment(c.commitment);}catch{}if(!commitment)warnings.push('Stale or invalid construction commitment was discarded.');}
 // Candidates remain subject to the normal planner's resource, access, source
 // and construction revalidation. Import never displays them as advice.
 return{state,search,resourceHistory,resourceOriginBag,patternHistory,...{openingPhase:opening.session.active,openingSource:opening.session.source,openingClear:opening.session.clear,openingRepair:opening.session.repair},previous,commitment,pendingLHint,warnings};
}
function parse(text){if(typeof text!=='string'||text.length>LIMITS.bytes)throw Error('Session exceeds size limit.');return prepare(JSON.parse(text));}
return Object.freeze({FORMAT,VERSION,ENGINE,LIMITS,defaults,create,prepare,parse});
});
