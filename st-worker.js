/* Classic worker: the only input is the public observation, never game RNG. */
'use strict';
importScripts('st-rules.js','st-bag.js','st-structure.js','st-paired-repair.js','st-planner.js');
self.onmessage = ({data}) => {
  if (!data || data.type !== 'plan') return;
  try {
    const options = {...(data.options || {})};
    options.deadline = Date.now() + (options.timeMs ?? 200);
    const previous = data.previous;
    // A remaining cycle proof is a candidate to compare, not permission to
    // bypass fresh search or replay validation after a lock/deviation.
    if(data.commitment)options.commitment=data.commitment;
    if(previous?.evidence?.construction)options.constructionPrevious=previous;
    let result = !data.commitment && previous && typeof STPlanner.revalidate === 'function'
      ? STPlanner.revalidate(data.observation, previous, options) : null;
    if (!result) result = STPlanner.plan(data.observation, options);
    self.postMessage({type:'result', id:data.id, revision:data.observation.revision, result});
  } catch (error) {
    self.postMessage({type:'error', id:data.id, revision:data.observation?.revision,
      message: error instanceof Error ? error.message : String(error)});
  }
};
