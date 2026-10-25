/* Classic worker: the only input is the public observation, never game RNG. */
'use strict';
importScripts('st-rules.js','st-bag.js','st-structure.js','st-paired-repair.js','st-access.js','st-pattern-history.js', 'st-left-foundation.js','st-opening-patterns.js','st-resource-history.js','st-midgame-resources.js','st-planner.js','st-opening-continuations.js','st-opening-sources.js','st-source-scoring.js','st-opening.js');
self.onmessage = ({data}) => {
  if (!data || data.type !== 'plan') return;
  try {
    const options = {...(data.options || {})};
    options.deadline = Date.now() + (options.timeMs ?? 200);
    const result=STPlanner.decide(data.observation,{...options,previous:data.previous,commitment:data.commitment});
    self.postMessage({type:'result', id:data.id, revision:data.observation.revision, result});
  } catch (error) {
    self.postMessage({type:'error', id:data.id, revision:data.observation?.revision,
      message: error instanceof Error ? error.message : String(error)});
  }
};
