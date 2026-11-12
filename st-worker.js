/* Classic worker: the only input is the public observation, never game RNG. */
'use strict';
// Carry the entry URL's release token through all classic-worker dependencies.
// Non-browser hosts without a location retain their explicit source-map imports.
const assetQuery=typeof self.location?.search==='string'?self.location.search:'';
const importAssets=(...files)=>importScripts(...files.map(file=>file+assetQuery));
let diagnosticRequest=null;
let reportingFailure=false;
function workerFailure(error,stage){
  if(reportingFailure)return;reportingFailure=true;
  try {
    let detail;
    try{detail=typeof STDiagnostics!=='undefined'?STDiagnostics.serializeError(error):{name:'Error',message:String(error?.message||error),stack:String(error?.stack||'')};}
    catch{detail={name:'Error',message:'Unserializable worker error'};}
    self.postMessage({type:'error',id:diagnosticRequest?.id,revision:diagnosticRequest?.observation?.revision,message:detail.message,error:detail,stage,diagnosticBuild:'st-worker-diagnostics-2026-11-08-v1',assetVersion:typeof STCoachConfig!=='undefined'?STCoachConfig.ASSET_VERSION:'unknown',startupDiagnostic:!diagnosticRequest});
  }catch(postError){try{console.error('Worker diagnostic could not be delivered',postError);}catch{}}
  finally{reportingFailure=false;}
}
self.addEventListener?.('error',event=>workerFailure(event.error||{message:event.message},'uncaught-worker-error'));
self.addEventListener?.('unhandledrejection',event=>workerFailure(event.reason,'worker-unhandled-rejection'));
self.addEventListener?.('messageerror',()=>workerFailure(new Error('Worker could not deserialize message'),'worker-messageerror'));
let startupError=null;
try {
importAssets('st-diagnostics.js');
importAssets('st-coach-config.js','st-rules.js','st-bag.js','st-structure.js','st-paired-repair.js','st-access.js','st-pattern-history.js', 'st-left-foundation.js','st-opening-patterns.js','st-reset-policy.js','st-public-inventory.js','st-center-obligations.js','st-handoff-continuity.js','st-obligation-admission.js','st-resource-search.js', 'st-sl-obligations.js','st-opening-obligations.js','st-left-obligations.js','st-obligation-state.js','st-obligation-context.js','st-obligation-projection.js','st-obligation-assessment.js','st-obligation-route.js','st-obligation-resources.js','st-opening-eligibility.js','st-plan-continuity.js','st-resource-provider.js','st-obligation-tracking.js','st-left-context.js','st-midgame-coaches.js','st-reset-coach.js','st-left-contours.js','st-left-dependencies.js','st-left-routes.js','st-planner.js','st-opening-continuations.js','st-opening-sources.js','st-source-scoring.js','st-opening.js');
}catch(error){startupError=error;}
self.onmessage = ({data}) => {
  if (!data || !['plan','explore'].includes(data.type)) return;
  diagnosticRequest=data;
  try {
    if(startupError)throw startupError;
    const options = {...(data.options || {})};
    delete options.searchTrace;
    if(data.type==='explore'&&typeof STSearchTrace==='undefined')importAssets('st-search-trace.js');
    const trace=data.type==='explore'?STSearchTrace.create({limit:data.traceLimit}):null;
    if(trace)options.searchTrace=trace;
    options.timeMs ??= STCoachConfig.SEARCH_TIME_MS;
    options.deadline = Date.now() + options.timeMs;
    const result=STPlanner.decide(data.observation,{...options,previous:data.previous,commitment:data.commitment});
    self.postMessage({type:trace?'exploration':'result', id:data.id, revision:data.observation.revision, result,...(trace?{trace:trace.finish(result)}:{})});
  } catch (error) {
    workerFailure(error,startupError?'worker-import':'worker-evaluation');
  }
};
