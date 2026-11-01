/* Logical early/late coaches share the same Left scorer and planner proofs.
 * This module consumes the planner's validated resource ledger, never raw
 * imported status flags. It grants no resource permission or Reset behavior. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STMidgameCoaches=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create(left){
 // All modes deliberately call the identical scorer with the original context,
 // including its existing used-Z/held-T adjustment. Phase is not a score bonus.
 const evaluateLeft=(state,context)=>left.evaluate(state,context);
 const early=Object.freeze({phase:'early',evaluateLeft});
 const late=Object.freeze({phase:'late',evaluateLeft});
 const compatibility=Object.freeze({phase:'compatibility',evaluateLeft});
 const forResources=resources=>resources?.extraZ==='available'?early:resources?.extraZ==='used'?late:compatibility;
 // Invalid speculative spending also marks the ledger as used. An unknown
 // root cannot acquire verified phase authority that way. Known roots must,
 // however, select from each projected node rather than freeze the root phase.
 const project=(resources,priorPhase)=>priorPhase==='compatibility'?compatibility:forResources(resources);
 return Object.freeze({early,late,compatibility,forResources,project});
}
return Object.freeze({create});
});
