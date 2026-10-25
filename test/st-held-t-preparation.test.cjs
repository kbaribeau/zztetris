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
test('old broken marathon rollout retains cleanup-order mechanics but no longer certifies normal ST',()=>{
 // Derived from the already-reviewed marathon-rebuild rollout at lock25,
 // also reached by marathon-preparation at lock27; not a new held-out case.
 const s=R.migrateState(require('./support/st-existing-cleanup-before-cap.json'));
 // The old engine reached this board after filling two scoring notches.
 // Keep the independent cleanup-order regression, but no longer present that
 // already-broken board as a supported normal-ST planning result.
 const phase=S.notchPattern(s.board);assert.equal(phase.status,'broken');assert.deepEqual(phase.blockedRows,[34,31]);
 const advice=P.plan(s);assert.equal(advice.target,null);assert.match(advice.reason,/column 7 is filled/);
 const placements=R.placements(s).placements;
 const i=placements.find(p=>p.event.type==='I'&&p.event.cells.every(([x])=>x===9));
 const z=placements.find(p=>p.event.type==='Z'&&S.transition(s,p).allocation==='right-cap-preparation');assert.ok(i);assert.ok(z);
 assert.equal(S.transition(s,i).allocation,'quad-preparation');
 const cap=S.geometry(i.state.board).right.completions.find(c=>c.piece==='Z');assert.ok(cap);
 assert.equal(i.state.hold,'Z');const replay=R.replay(i.state,['HOLD',...cap.witness]);assert.ok(replay.valid);assert.equal(replay.events[0].type,'Z');
 assert.equal(S.transition(i.state,{state:replay.state,event:replay.events[0]}).allocation,'right-cap-preparation');
 assert.ok(S.transition(s,{...z,availableCleanupPreparation:true}).cycleViolations.includes('capped-before-available-cleanup-I'));
 assert.equal(S.transition(s,{...i,availableCleanupPreparation:true}).cycleViolations.includes('capped-before-available-cleanup-I'),false);
});

const delayed=require('./support/st-user-delayed-cap-t.json');
for(const timed of [false,true])test(`visible filler prefix preserves a real T until the Z cap (${timed?'750ms':'full'})`,()=>{
 const a=P.plan(delayed,timed?{timeMs:750}:{});
 assert.ok(a.target,a.reason);assert.equal(a.evidence.preparationProof.kind,'visible-prefix-Z-saved-T');
 assert.equal(a.evidence.preparationProof.locks,5);assert.equal(a.continuation.length,5);
 let state=R.createState(delayed),notches=S.notchPattern(state.board);
 for(const [i,p] of a.continuation.entries()){
  const replay=R.replay(state,p.witness);assert.ok(replay.valid);assert.deepEqual(replay.events,[p.event]);
  const check=S.advanceNotches(state.board,{event:p.event,state:replay.state},notches);assert.ok(check.valid);notches=check.pattern;
  assert.ok(S.canonicalClear(p.event));if(i<4)assert.notEqual(p.event.type,'T');state=replay.state;
 }
 assert.equal(a.continuation[3].structuralEvidence.allocation,'right-cap-preparation');
 assert.equal(a.continuation[4].event.type,'T');assert.equal(a.continuation[4].event.spin,'full');assert.equal(a.continuation[4].event.lines,2);
 assert.ok(P.assess(state.board).maxHeight<=14);assert.ok(a.metrics.nodes<=45000);
 assert.ok(!a.continuation.some(p=>p.event.type==='I'&&p.event.cells.every(([x])=>x===9)),'this phase must not put I into the future Z cap');
 const moved=R.move(R.createState(delayed),a.witness[0]),advanced=P.advance(moved,a,a.witness[0]);assert.ok(advanced);assert.equal(advanced.continuation.length,5);
 assert.equal(P.advance({...moved,queue:['J',...moved.queue.slice(1)]},a,a.witness[0]),null);
});
test('delayed cap proof cannot invent a missing visible T or Z',()=>{
 for(const queue of [['O','J','Z','I','S','L'],['O','T','J','I','S','L']]){
  const a=P.plan({...delayed,queue});assert.equal(a.evidence?.preparationProof??null,null);
 }
});
test('delayed cap proof requires permitted hold and a sufficient requested horizon',()=>{
 for(const options of [{allowHold:false},{depth:2}]){const a=P.plan(delayed,options);assert.equal(a.evidence?.preparationProof??null,null);}
});
test('interrupted delayed cap proof never spends T in its returned prefix or claims success',()=>{
 const root=R.placements(R.createState(delayed));const a=P.plan(delayed,{maxNodes:root.visited+1});
 assert.equal(a.evidence?.preparationProof??null,null);assert.ok(a.metrics.nodes<=root.visited+1);
 assert.ok(a.continuation.every(p=>p.event.type!=='T'||p.event.lines===2));
});
test('existing o-filler lock21 keeps its stronger equally long prefix without spending the saved T',()=>{
 // Existing accepted 36-lock trace, not a new unseen generalization position.
 const s=require('./support/st-existing-cap-proof-tie.json'),a=P.plan(s);
 assert.equal(a.target.type,'O');assert.ok(a.continuation[0].event.cells.every(([x])=>x<4));
 assert.equal(a.continuation[1].event.type,'Z');assert.ok(a.continuation.every(p=>p.event.type!=='T'||p.event.lines===2));
 let state=R.createState(s);for(const p of a.continuation){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events,[p.event]);state=r.state;}
 assert.equal(state.hold,'T');assert.equal(a.evidence.preparationProof,null,'a different safe prefix must not inherit an unrelated proof');
});

test('cleanup prerequisite uses an actual empty-HOLD I, not just active or occupied hold',()=>{
 const s=R.createState({board:input.board,active:'Z',hold:null,queue:['I','L','J','T','Z','O']});
 const a=P.plan(s,{depth:1,width:8,maxNodes:8000});
 assert.ok(a.target,a.reason);assert.equal(a.target.type,'I');assert.equal(a.witness[0],'HOLD');
 const replay=R.replay(s,a.witness);assert.ok(replay.valid);assert.deepEqual(replay.events,[a.continuation[0].event]);
 assert.equal(a.continuation[0].structuralEvidence.allocation,'quad-preparation');
 assert.equal(S.geometry(replay.state.board).right.cycle.phase,'cap-rebuild-with-cleanup-prepared');
 assert.equal(replay.state.hold,'Z');
 const cap=S.geometry(replay.state.board).right.completions[0];assert.ok(cap);
 const z=R.replay(replay.state,['HOLD',...cap.witness]);assert.ok(z.valid);assert.equal(z.events[0].type,'Z');
 assert.equal(S.transition(replay.state,{state:z.state,event:z.events[0]}).allocation,'right-cap-preparation');
});
