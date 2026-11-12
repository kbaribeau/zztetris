/* Portable current obligation checkpoints. Only version 2 current facts are supported.
 * Future advice remains an independently checked candidate, never a certificate.
 * No hidden generator, private future or lifetime accounting tape is stored. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-bag'),require('./st-obligation-context'),require('./st-plan-continuity'),require('./st-pattern-history'),require('./st-planner'),require('./st-opening'),()=>require('./st-coach-config')):factory(root.STRules,root.STBag,root.STObligationContext,root.STPlanContinuity,root.STPatternHistory,root.STPlanner,root.STOpening,()=>root.STCoachConfig);if(typeof module==='object'&&module.exports)module.exports=api;else root.STSession=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,Context,PC,PH,P,O,C){
'use strict';
const FORMAT='zztetris-st-session',VERSION=2,ENGINE='st-coach-session-2026-11-11-contour-routes-v1';
// Transport-only download hint; never part of a position or coaching proof.
const DEFAULT_EXPORT_FILENAME='st-lab-coaching-export.json';
function exportFilename(value){
 if(typeof value!=='string')return DEFAULT_EXPORT_FILENAME;
 let name=value.replace(/[^A-Za-z0-9._ -]/g,'_').replace(/^[. ]+|[. ]+$/g,'');
 if(!/[A-Za-z0-9]/.test(name)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))return DEFAULT_EXPORT_FILENAME;
 name=name.replace(/\.json$/i,'').slice(0,115).replace(/[. ]+$/g,'');
 return name?name+'.json':DEFAULT_EXPORT_FILENAME;
}
const LIMITS=Object.freeze({bytes:4*1024*1024,depth:64,nodes:150000,witness:256,continuation:16});
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Transient next-lock routing is not portable certificate authority.
function portableAdvice(value){const result=P.importCandidateResources(value);if(!result)return null;if(result.evidence?.openingHandoff)delete result.evidence.openingHandoff.recovery;return result;}
function portableCommitment(value){const result=clone(value);if(result.advice)result.advice=portableAdvice(result.advice);return result.advice?result:null;}
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
const defaults=()=>({timeMs:C().SEARCH_TIME_MS,depth:null,width:8,maxNodes:45000});
function bounded(value){let nodes=0;const seen=new Set();function visit(x,d){if(++nodes>LIMITS.nodes||d>LIMITS.depth)throw Error('Session exceeds structural limits.');if(!x||typeof x!=='object')return;if(seen.has(x))throw Error('Session contains cycles.');seen.add(x);for(const [key,v] of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsupported session property.');visit(v,d+1);}seen.delete(x);}visit(value,0);if(JSON.stringify(value).length>LIMITS.bytes)throw Error('Session exceeds size limit.');}
function position(raw){if(!raw||R.validate(raw).length)throw Error('Invalid session position.');if(raw.rules!==R.PROFILE.id)throw Error('Session rules version is unsupported; import a position instead.');if(raw.queue.length>6)throw Error('Session may contain only six visible preview pieces.');if(raw.bag&&(B.validate(raw.bag).length||!Number.isInteger(raw.bag.observedCount)||raw.bag.observedCount<0||typeof raw.bag.provenance!=='string'))throw Error('Invalid session bag evidence.');const result=P.observe(raw);delete result.lastEvent;return result;}
function settings(input,{legacy=false}={}){const d=defaults();if(!input||Object.keys(input).sort().join()!==Object.keys(d).sort().join()||!Object.keys(d).every(k=>input[k]===d[k]||legacy&&k==='depth'&&input[k]===3))throw Error('Unsupported session search settings; current coach settings are required.');return d;}
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
function pairedContext(position,current){
 const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 if(position.bag&&!same(canonical(position.bag),canonical(current.inventory.knowledge)))throw Error('Session public bag disagrees with current inventory knowledge.');
 return current;
}
function currentContext(state,options){
 if(['resourceHistory','resourceContext','resourceOriginBag'].some(k=>Object.hasOwn(options,k)))throw Error('Legacy resource accounting is unsupported; supply a current obligationContext or explicitly import a position.');
 if(Object.hasOwn(options,'obligationContext'))return pairedContext(state,Context.importState(options.obligationContext,{position:state}));
 let current=Context.start(state);
 if(Object.hasOwn(options,'patternHistory')){const notches=PH.snapshot(state,options.patternHistory);if(PH.resolve(state,notches).status==='invalid-history')throw Error('Invalid current notch checkpoint.');const snapshot=Context.exportState(current);snapshot.state.safety.notches=notches;current=Context.importState(snapshot,{position:state});}
 return current;
}
function create(state,options={}){
 const {patternHistory=null,planContinuity=null,openingPhase=false,openingSource=null,openingClear=null,openingRepair=null,previous=null,commitment=null,pendingLHint=null,search=defaults(),suggestedFileName=DEFAULT_EXPORT_FILENAME}=options;
 const observation=position(state),current=currentContext(observation,options),savedPrevious=previous?portableAdvice(previous):null,savedCommitment=commitment?portableCommitment(commitment):null;
 const proof=savedPrevious?.evidence?.construction||savedCommitment?.advice?.evidence?.construction;
 const cursor=proof&&planContinuity?PC.importState(planContinuity,{position:observation,inventory:current.inventory,proof}):null;
 const result={format:FORMAT,schemaVersion:VERSION,engineVersion:ENGINE,suggestedFileName:exportFilename(suggestedFileName),position:observation,search:settings(search),coaching:{obligationContext:Context.exportState(current),planContinuity:PC.exportState(cursor),patternHistory:current.status==='available'?clone(current.state.safety.notches):PH.snapshot(observation,patternHistory),openingPhase:openingPhase&&current.state?.account.reset.status!=='active',openingSource:current.state?.account.reset.status==='active'?null:openingSource?clone(openingSource):null,openingClear:current.state?.account.reset.status==='active'?null:openingClear?clone(openingClear):null,openingRepair:current.state?.account.reset.status==='active'?null:openingRepair?clone(openingRepair):null,previous:savedPrevious,commitment:savedCommitment,pendingLHint:portablePendingLHint(pendingLHint)}};
 bounded(result);return result;
}
function prepare(input){
 bounded(input);if(input?.format!==FORMAT||input.schemaVersion!==VERSION)throw Error('Unsupported session format version; legacy sessions must be explicitly imported as positions.');if(typeof input.engineVersion!=='string'||!input.engineVersion.trim())throw Error('Invalid coach provenance.');const legacyDepth=input.search?.depth===3,differentCoach=input.engineVersion!==ENGINE||legacyDepth;
 const state=position(input.position),search=settings(input.search,{legacy:true}),c=clone(input.coaching);
 if(!c||typeof c!=='object'||typeof c.openingPhase!=='boolean')throw Error('Missing session coaching state.');
 const warnings=differentCoach?[legacyDepth?'Imported a session from an earlier search configuration. Current accounting is preserved; advice will be recomputed.':'Imported a session from a different coach version. Current accounting and settings are preserved; advice will be recomputed.']:[];if(legacyDepth)warnings.push('The former three-lock search setting was upgraded to the public-piece horizon; time, node and width limits are unchanged.');let obligationContext;
 if(['resourceContext','resourceHistory','resourceOriginBag'].some(k=>Object.hasOwn(c,k)))throw Error('Current session cannot contain legacy resource authority.');
 obligationContext=pairedContext(state,Context.importState(c.obligationContext,{position:state}));
 const patternHistory=obligationContext.status==='available'?clone(obligationContext.state.safety.notches):PH.snapshot(state,c.patternHistory);
 if(PH.resolve(state,patternHistory).status==='invalid-history')throw Error('Invalid current notch checkpoint.');
 const observedReset=obligationContext.state?.account.reset.status==='active';
 if(observedReset&&c.openingPhase){c.openingPhase=false;c.openingSource=null;c.openingClear=null;c.openingRepair=null;warnings.push('Current Reset progress superseded stale Opening coaching state.');}
 const opening=O.validateSessionState(state,{active:c.openingPhase,source:c.openingSource??null,clear:c.openingClear??null,repair:c.openingRepair??null},search);warnings.push(...opening.warnings);
 if(obligationContext.status==='available'&&obligationContext.state.sl.handoff&&opening.session.active)throw Error('Opening phase contradicts the current maintenance handoff.');
 let previous=null,commitment=null;const pendingLHint=differentCoach?null:portablePendingLHint(c.pendingLHint);
 if(c.handoffRecovery||c.previous?.evidence?.openingHandoff?.recovery||c.commitment?.advice?.evidence?.openingHandoff?.recovery)warnings.push('Transient handoff routing was discarded; advice remains subject to fresh validation.');
 if(differentCoach&&(c.previous||c.commitment))warnings.push('Saved coach advice and construction commitments were discarded for fresh planning.');
 if(c.previous?.recommendation?.kind==='risky'||c.previous?.status==='recommended-risky-placement')warnings.push('Saved risky advice was discarded for fresh planning.');
 if(!differentCoach&&c.previous&&c.previous.recommendation?.kind!=='risky'&&c.previous.status!=='recommended-risky-placement'){try{if(candidateShape(c.previous))previous=portableAdvice(c.previous);}catch{}if(!previous)warnings.push('Stale or invalid previous advice was discarded.');}
 if(!differentCoach&&c.commitment&&!['risky','immediate'].includes(c.commitment.advice?.recommendation?.kind)&&c.commitment.advice?.status!=='recommended-risky-placement'){try{const origin=position(c.commitment.observation);if(candidate(origin,c.commitment.advice)&&(c.commitment.advice.evidence?.strategy==='reset-coach'||P.resourceGoal(c.commitment.advice.continuation)))commitment=portableCommitment(c.commitment);}catch{}if(!commitment)warnings.push('Stale or invalid construction commitment was discarded.');}
 const proof=previous?.evidence?.construction||commitment?.advice?.evidence?.construction,payload=c.planContinuity;
 const planContinuity=proof&&payload?PC.importState(payload,{position:state,inventory:obligationContext.inventory,proof}):null;
 if(payload&&!planContinuity)warnings.push('Saved construction cursor was discarded; future advice requires fresh validation.');
 // Candidates remain subject to the normal planner's resource, access, source
 // and construction revalidation. Import never displays them as advice.
 return{suggestedFileName:exportFilename(input.suggestedFileName),state,search,obligationContext,planContinuity,patternHistory,...{openingPhase:opening.session.active,openingSource:opening.session.source,openingClear:opening.session.clear,openingRepair:opening.session.repair},previous,commitment,pendingLHint,warnings};
}
function parse(text){if(typeof text!=='string'||text.length>LIMITS.bytes)throw Error('Session exceeds size limit.');return prepare(JSON.parse(text));}
return Object.freeze({FORMAT,VERSION,ENGINE,LIMITS,DEFAULT_EXPORT_FILENAME,exportFilename,defaults,create,prepare,parse});
});
