'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// TEST ONLY: expose the risk filter to literal already-replayed candidates.
// No production option bypasses supported search, history, resources or D gates.
// This tests admission/diagnostics, not natural policy selection at that root.
module.exports=function riskHarness(){const filename=require.resolve('../../st-planner'),source=fs.readFileSync(filename,'utf8'),seam='return Object.freeze({dPatternAdmission,';if(source.split(seam).length!==2)throw Error('Risk test seam changed');const module={exports:{}};vm.runInNewContext(source.replace(seam,'return Object.freeze({riskyFallback,riskyDAdmission,classifySupported,'),{module,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance},{filename:'st-risk-filter-test-only.js'});return module.exports;};
