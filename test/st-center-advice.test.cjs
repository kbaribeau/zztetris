const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../st-fixtures'),P=require('../st-planner'),R=require('../st-rules');
const opts={depth:3,width:8,maxNodes:45000};
const S=require('../st-structure'),emptyOrders=require('./support/st-empty-hold-orders.json');
function verifyEmptyOrder(steps){
 let state=P.observe(F.get('empty-hold').observation),notches=S.notchPattern(state.board);const center=[];let doubles=0;
 for(const step of steps){
  const r=R.replay(state,step.witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);
  const event=r.events[0];assert.ok(S.canonicalClear(event));
  const check=S.advanceNotches(state.board,{event,state:r.state},notches);assert.ok(check.valid);notches=check.pattern;
  if(event.cells.every(([x])=>x>=4&&x<=6))center.push(event.type);
  if(event.type==='T'&&event.spin==='full'&&event.lines===2)doubles++;
  state=r.state;
 }
 assert.deepEqual(center,['S','L']);assert.equal(doubles,1);assert.equal(P.assess(state.board).sealed,0);assert.deepEqual(state.board,emptyOrders.expectedBoard);return state;
}
test('st-advice/empty hold completes S/L and the double in either accepted order',()=>{
 const plan=P.plan(F.get('empty-hold').observation,opts);assert.equal(plan.continuation.length,3);
 verifyEmptyOrder(plan.continuation);
 const pair=plan.continuation.find(p=>p.structuralEvidence.pairFamily==='SL');assert.ok(pair);
 assert.deepEqual(pair.structuralEvidence.pairProgress.orderedPieces,['S','L']);
 assert.doesNotMatch(plan.reason,/S or L|L\/O pair|O\/J pair/);
});
test('st-advice/accepted empty-hold orders retain distinct legacy hold mechanics',()=>{
 const center=verifyEmptyOrder(emptyOrders.orders.centerFirst.map(witness=>({witness})));
 const score=verifyEmptyOrder(emptyOrders.orders.scoreFirst.map(witness=>({witness})));
 assert.deepEqual([center.active.type,center.hold,center.queue,center.canHold],['Z','I',['J','O'],true]);
 assert.deepEqual([score.active.type,score.hold,score.queue,score.canHold],['I',null,['Z','J','O'],true]);
 const held=R.move(score,'HOLD');assert.deepEqual([held.active.type,held.hold,held.queue],['Z','I',['J','O']]);
 assert.equal(held.canHold,false);assert.notEqual(center.canHold,held.canHold);
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

test('st-advice/quad rebuild reports S preparation without promising the unexecuted L partner',()=>{
 const plan=P.plan(F.get('after-quad').observation,opts),first=plan.continuation[0];
 assert.equal(first.event.type,'S');assert.ok(first.event.cells.every(([x])=>x>=4&&x<=6));
 assert.equal(first.structuralEvidence.pairFamily,'SL');
 assert.match(plan.reason,/Prepare the center surface; its next completion is not established/);
 assert.doesNotMatch(plan.reason,/completes it|S or L|L\/O pair/);
 assert.equal(plan.assessment.structure.right.reservoir.status,'verified-clear-reopens-reservoir');
});
test('st-advice/previous quad L/O continuation still names its executed pair precisely',()=>{
 // Isolate the two already-checked L/O moves for explanation coverage, without
 // requiring that this route keep winning against the corrected cap evaluation.
 const fs=require('node:fs'),vm=require('node:vm'),module={exports:{}};
 const targets=[{type:'L',x:3,y:28,rotation:1},{type:'O',x:4,y:28,rotation:0}];
 const rules={...R,placements:(state,options)=>{const r=R.placements(state,options);return{...r,placements:r.placements.filter(p=>targets.some(t=>JSON.stringify(t)===JSON.stringify(p.target)))};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner.js'),'utf8'),{module,require:name=>name==='./st-rules.js'?rules:name==='./st-bag.js'?require('../st-bag'):require('../st-structure')});
 const plan=module.exports.plan(F.get('after-quad').observation,{...opts,depth:2});
 assert.match(plan.reason,/Hold first\. Place L in the center to start an L\/O pair\. The next O completes it\./);
 assert.equal(plan.continuation[0].structuralEvidence.pairProgress.status,'completed-in-checked-prefix');
 assert.equal(plan.continuation[1].structuralEvidence.pairProgress.step,2);
 let state=F.get('after-quad').observation;
 for(const [i,step]of plan.continuation.entries()){
  assert.equal(step.event.type,['L','O'][i]);assert.ok(step.event.cells.every(([x])=>x>=4&&x<=6));
  const replay=R.replay(state,step.witness);assert.equal(replay.valid,true);state=replay.state;
 }
 assert.equal(plan.continuation.length,2);assert.equal(new Set(plan.assessment.structure.center.profile).size,1);
});
