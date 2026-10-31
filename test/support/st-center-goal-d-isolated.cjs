'use strict';
// TEST ONLY: the historical waiting challenger now violates strict D admission.
// Isolate that newly stronger eligibility gate solely to exercise the older
// Center-goal replacement veto. This is not production admission evidence for
// the challenger. Real-policy saved-goal and strict-D controls remain separate.
const fs=require('node:fs'),path=require('node:path');
module.exports=function centerGoalHarness({disablePreservation=false}={}){
 const filename=require.resolve('../../st-planner');let source=fs.readFileSync(filename,'utf8');
 if(disablePreservation){const seam='if(pendingLCompletionPreserved)replacement=false;';if(source.split(seam).length!==2)throw Error('Center-goal mutation seam changed');source=source.replace(seam,'if(pendingLCompletionPreserved){pendingLCompletionPreserved=false;}');}
 const module={exports:{}};new Function('module','require',source)(module,id=>{const actual=require(path.resolve(path.dirname(filename),id));return id==='./st-left-context.js'?{...actual,isD:()=>false,createsD:()=>false}:actual;});return module.exports;
};
