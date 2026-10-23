'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure');
const input=require('./support/st-user-held-t-preparation.json');
for(const version of ['legacy','practice'])for(const timed of [false,true])test(`held T preparation: actual visible I/Z/T witnesses ${version} (${timed?'750ms':'full'})`,()=>{
 const source=version==='practice'?R.migrateState(input):input;
 const a=P.plan(source,timed?{timeMs:750}:{});assert.ok(a.target,a.reason);
 assert.equal(a.target.type,'I');assert.equal(a.hold,true);assert.equal(a.evidence.preparationProof.kind,'visible-I-Z-held-T');
 let state=R.createState(source);
 for(const step of a.continuation){const r=R.replay(state,step.witness);assert.equal(r.valid,true);assert.deepEqual(r.events[0],step.event);state=r.state;}
 assert.ok(a.continuation[0].event.cells.every(([x])=>x===9));
 assert.equal(a.continuation[1].structuralEvidence.allocation,'right-cap-preparation');
 assert.equal(a.continuation[2].event.spin,'full');assert.equal(a.continuation[2].event.lines,2);
 assert.equal(P.assess(state.board).maxHeight,9);
 const quad=R.placements(state).placements.find(p=>p.event.type==='I'&&p.event.lines===4&&p.event.cells.every(([x])=>x===7));
 assert.ok(quad);assert.equal(P.assess(quad.state.board).maxHeight,5);
});
test('held T preparation is cap pending rather than scoring with inaccessible T entry',()=>{
 const first=R.placements(R.createState(input)).placements.find(p=>p.event.type==='I'&&p.event.cells.every(([x])=>x===9));
 assert.ok(first);assert.equal(S.geometry(first.state.board).right.cycle.phase,'cap-rebuild-with-cleanup-prepared');
 assert.equal(S.transition(input,first).allocation,'quad-preparation');
 assert.ok(S.geometry(first.state.board).right.completions.length);
});
test('held T obligation is not inferred without the visible Z witness',()=>{
 const a=P.plan({...input,queue:['L','I','J','L','O','S']});assert.equal(a.evidence?.preparationProof??null,null);
});
test('held T proof interruption never fabricates an executed preparation',()=>{
 let tick=0;const a=P.plan(input,{now:()=>++tick,deadline:100,maxNodes:200});
 assert.equal(a.evidence?.preparationProof??null,null);
 assert.ok(!a.target||a.target.type!=='T');
});
test('held T access-proof interruption does not authorize spending the saved T',()=>{
 const s=R.createState(input),root=R.placements(s,{maxNodes:45000});assert.equal(root.complete,true);
 const a=P.plan(input,{maxNodes:root.visited+1});
 assert.ok(a.metrics.accessNodes>0,'budget must enter the actual T access proof');
 assert.equal(a.evidence?.preparationProof??null,null);assert.ok(!a.target||a.target.type!=='T');
});
test('existing marathon rollout prepares the outer I before the cap can seal it',()=>{
 // Derived from the already-reviewed marathon-rebuild rollout at lock25,
 // also reached by marathon-preparation at lock27; not a new held-out case.
 const s=R.migrateState(require('./support/st-existing-cleanup-before-cap.json'));
 const a=P.plan(s);assert.equal(a.target?.type,'I');assert.ok(a.continuation[0].event.cells.every(([x])=>x===9));
 assert.equal(a.continuation[1].event.type,'Z');assert.equal(a.continuation[1].structuralEvidence.allocation,'right-cap-preparation');
 let current=s;for(const step of a.continuation){const r=R.replay(current,step.witness);assert.equal(r.valid,true);assert.deepEqual(r.events[0],step.event);current=r.state;}
});
