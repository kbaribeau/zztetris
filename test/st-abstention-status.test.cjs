'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),Context=require('../st-obligation-context');
const fixture=require('./support/st-autoplay-lost-phase.json').cases.find(c=>c.id==='marathon-preparation');
const observation=()=>P.observe(fixture.snapshot);
const bounds={depth:3,width:8,maxNodes:45000,now:()=>0};
function withheld(a){assert.equal(a.target,null);assert.deepEqual(a.witness,[]);assert.deepEqual(a.continuation,[]);assert.ok(a.metrics.nodes<=45000);}
test('abstention status: completed covered-cell exclusion does not invent unfinished movement screening',()=>{
 const a=P.plan(observation(),bounds);withheld(a);
 assert.equal(a.assessment.maxHeight,20);assert.equal(a.assessment.regionalSupport,true);
 assert.ok(a.metrics.nodes<45000,'An internal proof allowance can stop before the global cap');
 assert.equal(a.metrics.proofScheduling.unfinished,0);assert.equal(a.metrics.proofScheduling.budgetStops,0);
 assert.equal(a.status,'no-supported-continuation-found');assert.match(a.reason,/supported/);
});
test('abstention status: completed unsuitable endpoint remains a supported-shape rejection',()=>{
 // Ordinary-only control disables construction and its optional screening cap;
 // it does not alter the board, witnesses, or production safety validators.
 const a=P.plan(observation(),{...bounds,disableConstruction:true});withheld(a);
 assert.equal(a.assessment.maxHeight,20);assert.equal(a.assessment.regionalSupport,true);
 assert.equal(a.metrics.proofScheduling.unfinished,0);assert.equal(a.metrics.proofScheduling.budgetStops,0);
 assert.equal(a.status,'no-supported-continuation-found');assert.match(a.reason,/supported stack shape/);
});
test('abstention status: global node and clock exhaustion without a best move stay budget-limited',()=>{
 for(const options of [{maxNodes:0},{deadline:10,now:()=>11}]){
  const a=P.plan(observation(),{...bounds,...options});withheld(a);assert.equal(a.status,'budget-exhausted');
 }
});
test('abstention status: exhausted budget does not relabel invalid input or malformed current accounting',()=>{
 const s=observation(),options={...bounds,maxNodes:0,deadline:0,now:()=>1};
 assert.equal(P.plan({...s,board:['bad']},options).status,'invalid-input');
 const obligationContext=Context.exportState(Context.start(s));obligationContext.inventory.queue[0].id=obligationContext.inventory.active.id;
 const resourceContext={schemaVersion:1,origin:s,fresh:false,steps:[{action:'TELEPORT',revealed:[]}],handoffAtAction:null};
 for(const [input,reason]of [[{obligationContext},/Invalid obligation context/],[{resourceContext},/Legacy resource contexts are unsupported/]]){
  const a=P.plan(s,{...options,...input});withheld(a);
  assert.equal(a.status,'no-supported-continuation-found');assert.equal(a.metrics.nodes,0);assert.equal(a.evidence.resourceObligations.status,'unavailable');assert.match(a.reason,/Current resource accounting is unavailable/);assert.match(a.evidence.resourceObligations.reason,reason);
 }
});
