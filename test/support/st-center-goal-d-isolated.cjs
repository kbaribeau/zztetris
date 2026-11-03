'use strict';
// TEST ONLY: the historical waiting challenger now violates strict D admission.
// Isolate that newly stronger eligibility gate solely to exercise the older
// Center-goal replacement veto. This is not production admission evidence for
// the challenger. Real-policy saved-goal and strict-D controls remain separate.
const fs=require('node:fs'),path=require('node:path');
module.exports=function centerGoalHarness({disablePreservation=false,observeComparison=()=>{}}={}){
 const filename=require.resolve('../../st-planner');let source=fs.readFileSync(filename,'utf8');
 // Pin only this isolated challenger-selection control to the historical effort
 // tiebreak. The nodes and repair certificates are still constructed by the real
 // search; no safety facts or guard outcome are fabricated. Neutral production
 // ranking need not happen to choose this adversarial challenger.
 const rank='tsds*2,leftContext.score,0,path.reduce((n,v)=>n+v.event.lines,0)';
 if(source.split(rank).length!==2)throw Error('Center-goal ranking control seam changed');
 source=source.replace(rank,'tsds*2,leftContext.score,-path.reduce((n,v)=>n+v.witness.length+holdCount(v)*2,0),path.reduce((n,v)=>n+v.event.lines,0)');
 if(disablePreservation){const seam='if(pendingLCompletionPreserved)replacement=false;';if(source.split(seam).length!==2)throw Error('Center-goal mutation seam changed');source=source.replace(seam,'if(pendingLCompletionPreserved){pendingLCompletionPreserved=false;}');}
 const guard='let pendingLCompletionPreserved=false;';if(source.split(guard).length!==2)throw Error('Center-goal observation seam changed');
 source=source.replace(guard,'observeComparison({fresh,commitment,replacement,rankingPreferred});'+guard);
 const module={exports:{}};new Function('module','require','observeComparison',source)(module,id=>{const actual=require(path.resolve(path.dirname(filename),id));return id==='./st-left-context.js'?{...actual,isD:()=>false,createsD:()=>false}:actual;},observeComparison);return module.exports;
};
