const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../st-fixtures'),P=require('../st-planner'),R=require('../st-rules');
const opts={depth:3,width:8,maxNodes:45000};
test('st-advice/quad rebuild names the selected ordered L/O pair, not all hypothetical partners',()=>{
 let state=F.get('after-quad').observation;
 const plan=P.plan(state,opts);
 assert.equal(plan.hold,true);
 assert.match(plan.reason,/Hold first\. Place L in the center to start an L\/O pair\. The next O completes it\./);
 assert.doesNotMatch(plan.reason,/S or L|S\/L pair|O\/J pair/);
 assert.deepEqual(plan.continuation.slice(0,2).map(p=>p.event.type),['L','O']);
 for(const step of plan.continuation.slice(0,2)){
  assert.ok(step.event.cells.every(([x])=>x>=4&&x<=6));
  const replay=R.replay(state,step.witness);assert.equal(replay.valid,true);state=replay.state;
 }
 assert.equal(plan.continuation[0].structuralEvidence.pairProgress.status,'completed-in-checked-prefix');
 assert.equal(plan.continuation[1].structuralEvidence.pairProgress.step,2);
 assert.deepEqual(plan.continuation[1].structuralEvidence.pairProgress.orderedPieces,['L','O']);
 assert.equal(new Set(plan.continuation[1].structuralEvidence.structure.center.profile).size,1);
});
test('st-advice/a short checked prefix cannot promise an unexecuted center pair completion',()=>{
 const plan=P.plan(F.get('after-quad').observation,{...opts,depth:1});
 assert.equal(plan.continuation.length,1);
 assert.doesNotMatch(plan.reason,/pair|completes it|S or L or O or J/);
});
test('st-advice/an existing finishing J is a completion without invented O/J preparation history',()=>{
 const plan=P.plan(F.get('center-j').observation,opts);
 assert.equal(plan.target.type,'J');
 assert.match(plan.reason,/Complete a level center surface/);
 assert.doesNotMatch(plan.reason,/start an|pair/);
});
