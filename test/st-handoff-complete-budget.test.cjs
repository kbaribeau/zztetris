'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),Provider=require('../st-resource-provider'),fixture=require('./fixtures/opening-complete-handoff-budget.json');
const options={openingPhase:true,obligationContext:fixture.obligationContext,patternHistory:fixture.patternHistory,timeMs:1500,maxNodes:45000,deadline:1500,now:()=>0};
function intercepted(inner){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?{...P,plan:inner}:require(id.replace('./','../')),Date,performance});return module.exports;}
test('completed opening: timed-out initial handoff retries ordinary maintenance within shared residual budget',()=>{
 let clock=0;const calls=[],before=JSON.stringify(fixture);
 const O=intercepted((s,o)=>{calls.push(o);if(calls.length===1){clock=200;return{status:'budget-exhausted',target:null,metrics:{nodes:2308}};}return P.plan(s,o);});
 const a=O.plan(fixture.position,{...options,now:()=>clock});
 assert.equal(calls.length,2);assert.equal(calls[0].maxNodes,12000);assert.equal(calls[0].deadline,200);
 assert.equal(calls[1].maxNodes,28461);assert.equal(calls[1].deadline,1500-1300/3);
 assert.equal(a.phase,'maintenance');assert.ok(a.target);assert.equal(a.evidence.openingHandoff.budgetRetry,'remaining-shared-budget');
 assert.equal(a.metrics.nodes,2308+a.metrics.handoffWork.retry.nodes);assert.ok(a.metrics.nodes<=45000);assert.equal(a.metrics.handoffWork.fallbackNodes,14231);
 assert.equal(a.target.type,'I');assert.equal(JSON.stringify(fixture),before);
 const input=Provider.prepare(fixture.position,options),marked=Provider.projectHandoff(input.frame);
 assert.equal(Provider.facts(marked).extraZ.remaining,1);assert.equal(Provider.facts(marked).hangingL.status,'none-observed');
 assert.equal(O.acceptResult({active:true},a).active,false);
});
test('completed opening: exhausted global budget does not restart handoff or erase obligations',()=>{
 let clock=0,calls=0;const O=intercepted((_s,o)=>{calls++;clock=1500;return{status:'budget-exhausted',target:null,metrics:{nodes:12000}};});
 const a=O.plan(fixture.position,{...options,now:()=>clock});assert.equal(calls,1);assert.equal(a.target,null);assert.equal(a.status,'budget-exhausted');assert.equal(a.metrics.nodes,12000);assert.equal(a.metrics.handoffWork.retry,undefined);assert.equal(fixture.obligationContext.state.account.z.remaining,1);
});
test('completed opening: reduced allowance is never replenished for retry',()=>{
 let calls=0;const O=intercepted((_s,o)=>{calls++;return{status:'budget-exhausted',target:null,metrics:{nodes:o.maxNodes}};});
 const a=O.plan(fixture.position,{...options,maxNodes:12000});assert.equal(calls,1);assert.equal(a.target,null);assert.equal(a.metrics.nodes,12000);
});
test('completed opening: failed shared retry reports exact work and honors global deadline',()=>{
 let clock=0;const calls=[];const O=intercepted((_s,o)=>{calls.push(o);clock=calls.length===1?200:1500;return{status:'budget-exhausted',target:null,metrics:{nodes:o.maxNodes}};});
 const a=O.plan(fixture.position,{...options,now:()=>clock});assert.equal(calls.length,2);assert.equal(calls[1].maxNodes,22000);assert.ok(calls[1].deadline<1500);assert.equal(a.metrics.nodes,34000);assert.equal(a.target,null);assert.equal(a.status,'budget-exhausted');
});
test('completed opening: no retry can bypass a mandatory opening Z or failed geometry',()=>{
 let calls=0;const O=intercepted(()=>{calls++;throw Error('Ineligible handoff must not enter maintenance');});
 const mandatory=JSON.parse(JSON.stringify(fixture.obligationContext));Object.assign(mandatory.state.account,{mandatoryZ:true,qualityCandidate:true,opening:{kind:'quality',imbalance:0},z:{remaining:null,uncredited:'none'}});
 const work={};assert.equal(O.handoff(fixture.position,null,{...options,obligationContext:mandatory},work,'shared'),null);assert.equal(work.eligible,false);
 const board=fixture.position.board.slice();board[30]='X.........';assert.equal(O.handoff({...fixture.position,board},null,options,{},'shared'),null);assert.equal(calls,0);
});
