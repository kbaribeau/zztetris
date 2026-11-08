/* Classic worker: the only input is the public observation, never game RNG. */
'use strict';
importScripts('st-coach-config.js','st-rules.js','st-bag.js','st-structure.js','st-paired-repair.js','st-access.js','st-pattern-history.js', 'st-left-foundation.js','st-opening-patterns.js','st-reset-policy.js','st-public-inventory.js','st-center-obligations.js','st-handoff-continuity.js','st-obligation-admission.js','st-resource-search.js', 'st-sl-obligations.js','st-opening-obligations.js','st-left-obligations.js','st-obligation-state.js','st-obligation-context.js','st-obligation-projection.js','st-obligation-assessment.js','st-obligation-route.js','st-obligation-resources.js','st-opening-eligibility.js','st-plan-continuity.js','st-resource-provider.js','st-obligation-tracking.js','st-left-context.js','st-midgame-coaches.js','st-reset-coach.js','st-planner.js','st-opening-continuations.js','st-opening-sources.js','st-source-scoring.js','st-opening.js');
self.onmessage = ({data}) => {
  if (!data || !['plan','explore'].includes(data.type)) return;
  try {
    const options = {...(data.options || {})};
    delete options.searchTrace;
    if(data.type==='explore'&&typeof STSearchTrace==='undefined')importScripts('st-search-trace.js');
    const trace=data.type==='explore'?STSearchTrace.create({limit:data.traceLimit}):null;
    if(trace)options.searchTrace=trace;
    options.timeMs ??= STCoachConfig.SEARCH_TIME_MS;
    options.deadline = Date.now() + options.timeMs;
    const result=STPlanner.decide(data.observation,{...options,previous:data.previous,commitment:data.commitment});
    self.postMessage({type:trace?'exploration':'result', id:data.id, revision:data.observation.revision, result,...(trace?{trace:trace.finish(result)}:{})});
  } catch (error) {
    self.postMessage({type:'error', id:data.id, revision:data.observation?.revision,
      message: error instanceof Error ? error.message : String(error)});
  }
};
