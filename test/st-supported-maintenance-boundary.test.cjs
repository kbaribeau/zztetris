'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../st-planner');
// Test-only seam exposes the existing supported selector, not a production
// admission option. The real risky-root fixture distinguishes it from decide.
function supported(){const filename=require.resolve('../st-planner'),source=fs.readFileSync(filename,'utf8'),seam='return Object.freeze({dPatternAdmission,';if(source.split(seam).length!==2)throw Error('Supported-decision seam changed');const module={exports:{}};vm.runInNewContext(source.replace(seam,'return Object.freeze({supportedMaintenanceDecision,dPatternAdmission,'),{module,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance});return module.exports.supportedMaintenanceDecision;}
test('supported maintenance boundary / actual risky-only public root remains an abstention in the handoff selector',()=>{
 const q=require('./fixtures/covered-repair-plan.json').cases[0],options={...q.options,depth:3,width:8,maxNodes:45000,openingPhase:false,deadline:Infinity,now:()=>0};
 const normal=P.decide(q.observation,options);assert.equal(normal.recommendation.kind,'risky','Control has a legal separate risk fallback');
 const result=supported()(q.observation,options);assert.equal(result.target,null);assert.notEqual(result.recommendation?.kind,'risky');assert.equal(result.metrics.riskFallback,undefined);assert.ok(result.metrics.nodes<=45000);
});
