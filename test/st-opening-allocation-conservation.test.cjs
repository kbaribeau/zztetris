'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),O=require('../st-opening'),R=require('../st-rules'),H=require('../st-obligation-context');
const f=require('./fixtures/opening-allocation-conservation.json');
const options={...f.request.options,deadline:Infinity};
function projected(path){
 let state=R.createState(f.request.observation),history=H.importState(options.obligationContext,{position:state});const summaries=[];
 for(const step of path){const r=R.replay(state,step.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[step.event]);
  for(const action of step.witness){const after=R.move(state,action);history=H.applyActual(history,{before:state,action:action,after:after}).context;state=after;}
  const summary=H.resolve(history,{position:state});assert.equal(summary.availability,'known');summaries.push(summary);
 }
 return summaries;
}
function assertConserved(advice){
 assert(advice.target);assert.equal(advice.phase,'opening');assert(advice.metrics.nodes<=options.maxNodes);
 assert.equal(advice.metrics.openingAllocation.conservation.enabled,true);
 assert(advice.metrics.openingAllocation.conservation.rejected>0);
 for(const summary of projected(advice.continuation)){
  assert.equal(summary.openingAllocation.requiredNonRightZ,0);
  assert(['ready-for-first-tsd','verified-first-tsd'].includes(summary.openingAllocation.status));
  if(summary.openingAllocation.status==='verified-first-tsd')break;
 }
}
test('opening conservation: completed source allocation survives ordinary public preparation',()=>{
 assert.equal(projected(f.priorPath).at(-1).openingAllocation.status,'out-of-profile','The recorded counterexample really spends a second pre-score Z');
 const advice=P.plan(f.request.observation,options);assertConserved(advice);
 assert.equal(advice.evidence.opening.handoffCandidate,null,'Construction alone has no handoff authority');
});
test('opening conservation: a valid retained geometric repair cannot bypass the allocation ledger',()=>{
 const repair=O.repairCertificate(f.request.observation,f.priorPath);assert(repair);assert(O.checkedRepair(repair,f.request.observation));
 const advice=P.plan(f.request.observation,{...options,openingRepair:repair});assertConserved(advice);assert.equal(advice.metrics.repairRetained,false);
});
test('opening conservation: unknown history does not invent a completed allocation',()=>{
 const {obligationContext,...unknown}=options;
 const advice=P.plan(f.request.observation,{...unknown,openingAllocation:{status:'ready-for-first-tsd',counts:{T:2}}});
 assert.equal(advice.metrics.openingAllocation.conservation.enabled,false);
});
test('opening conservation: replay work stays inside the existing node allowance',()=>{
 const advice=P.plan(f.request.observation,{...options,maxNodes:100});assert(advice.metrics.nodes<=100);assert.equal(advice.target,null);
 const zero=P.plan(f.request.observation,{...options,maxNodes:0});assert.equal(zero.metrics.nodes,0);assert.equal(zero.target,null);
});
