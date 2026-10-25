'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Branch-coverage fault injection only: withhold the optional generic result
// after its search has run. Root enumeration, finite cap qualification, movement
// witnesses, resource checks, budgets and final validation stay production code.
// This does NOT claim the natural planner selects this fallback at these limits.
// There is deliberately no production option for disabling resource policy.
module.exports=function fallbackHarness(){
 const filename=require.resolve('../../st-planner'),source=fs.readFileSync(filename,'utf8');
 const seam='let best=preparation&&resourceSafe(preparation)?preparation:cleanBest(frontier);';
 if(source.split(seam).length!==2)throw Error('Optional-result seam changed; review the fallback branch-coverage harness.');
 const module={exports:{}};
 vm.runInNewContext(source.replace(seam,'let best=null;'),{module,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance},{filename:'st-planner-fallback-branch-coverage.js'});
 return module.exports;
};
