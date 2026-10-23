const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner');
const snapshot=require('./support/st-user-center-cap.json');
// Kevin's supplied manual-playtest snapshot, not a new generalization fixture.
// Isolate reservoir scoring from held-T continuation selection. The new hold
// proof has separate default-planner coverage below; this no-hold ablation keeps
// the original exact reservoir credit and counterfactual-arrival assertions.
const result=P.plan(snapshot,{depth:3,width:8,maxNodes:45000,allowHold:false});
function endpoint(){let state=R.createState(snapshot);for(const step of result.continuation){const replay=R.replay(state,step.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events[0],step.event);state=replay.state;}return state;}
test('reservoir/user snapshot: full search completes the S/L center rather than penalizing the later Z cap',()=>{
 assert.equal(result.metrics.completeDepth,3);assert.equal(result.evidence.budgetExhausted,false);
 assert.deepEqual(result.target,{type:'L',x:4,y:25,rotation:2});assert.deepEqual(result.witness,['HD']);
 assert.equal(result.continuation[0].structuralEvidence.allocation,'center-completion');
 const a=result.assessment;
 assert.deepEqual(a.intentionalReservoir.cells,[[9,37],[9,38],[9,39]]);
 assert.equal(a.intentionalReservoir.credit,9);assert.equal(a.sealed,3);assert.equal(a.damageSealed,0);
 assert.equal(a.covered,6);assert.equal(a.damageCovered,3,'unrelated roofed cells keep their original penalty');
 assert.equal(result.evidence.structuralScore,-11.3);assert.deepEqual(result.evidence.structuralRank,[1,1,0,-3,1,-10,0]);endpoint();
});
test('reservoir/proof: actual clear reopens exact shaft, without inventing T arrival',()=>{
 const state=endpoint(),cavity=result.assessment.structure.right.reservoir;
 assert.equal(cavity.status,'verified-clear-reopens-reservoir');
 assert.notEqual(state.active?.type,'T');assert.notEqual(state.hold,'T');assert.ok(!state.queue.includes('T'));
 const clear=R.replay(R.createState({board:state.board,active:'T',canHold:false}),cavity.witness);
 assert.equal(clear.valid,true);assert.equal(clear.events[0].spin,'full');assert.equal(clear.events[0].lines,2);
 assert.deepEqual(clear.events[0].clearedRows,[35,36]);assert.equal(P.assess(clear.state.board).sealed,0);
 assert.equal(result.evidence.tsdAt,null);assert.match(result.reason,/when a T is available/);
 assert.ok(result.assessment.obligations.some(o=>o.kind==='T-slot'&&o.status==='entry-verified-arrival-unresolved'));
});
test('reservoir/proof is assessment-local, never cached as geometric certainty',()=>{
 const board=endpoint().board;
 assert.equal(S.geometry(board).right.reservoir.status,'clear-witness-required');
 const a=S.assess(R.createState({board,active:'I'}));
 assert.equal(a.right.reservoir.status,'clear-witness-required');assert.equal(a.right.reservoir.witness,undefined);
 assert.equal(P.assess(board).damageSealed,3,'raw assessment cannot award credit without a clear witness');
});
test('reservoir/reference: sprint caps on pages 34/62 reopen at T doubles on pages 35/65',()=>{
 const codec=vm.runInNewContext(fs.readFileSync(require.resolve('../tetris-fumen.js'),'utf8'),{window:{}})(2);
 const pages=codec.decoder.decode(fs.readFileSync(require.resolve('../references/st-stacking/hXc2nbXcXOc.fumen'),'utf8').trim());
 const board=f=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>39-y<23?f.at(x,39-y):'_').join('').replace(/_/g,'.'));
 for(const page of [35,63,65])assert.deepEqual(S.geometry(board(pages[page-1].field)).right.reservoir.cells,[[9,37],[9,38],[9,39]]);
 for(const page of [35,65]){
  const b=board(pages[page-1].field),access=R.tDoubleAccess(b),cavity=S.geometry(b).right.reservoir;
  assert.equal(access.reachable,true);assert.ok(access.event.clearedRows.includes(cavity.roofRow));
  const clear=R.replay(R.createState({board:b,active:'T',canHold:false}),access.witness);
  assert.equal(clear.valid,true);assert.equal(P.assess(b).sealed,3);assert.equal(P.assess(clear.state.board).sealed,0);
 }
});
test('reservoir/budget interruption: optimistic eligibility cannot award an unverified exemption',()=>{
 let calls=0;
 const rules={...R,tDoubleAccess:()=>{calls++;return{reachable:null,complete:false,visited:0};}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner.js'),'utf8'),{module,require:name=>name==='./st-rules.js'?rules:name==='./st-bag.js'?require('../st-bag'):S});
 const p=module.exports.plan(snapshot,{depth:3,width:8,maxNodes:45000});
 assert.ok(calls>0);assert.equal(p.evidence.budgetExhausted,true);assert.equal(p.assessment.intentionalReservoir,undefined);
 assert.equal(p.assessment.damageSealed,p.assessment.sealed);assert.equal(p.assessment.damageCovered,p.assessment.covered);
});
test('reservoir/unrelated damage: existing inaccessible reward-farming cavity gets no exemption',()=>{
 // Same already-established bad cavity as st-rules.test.cjs, not a fresh case.
 const board=[...Array(33).fill('..........'),'OO..LLL...','OOOOLSS..Z','ZZOOSS..ZZ','ITTTLSS.ZJ','ITTTSS...Z','ITJJJOO.ZZ','IIIIJOO.Z.'];
 const a=P.assess(board);assert.ok(a.sealed>0);assert.equal(a.damageSealed,a.sealed);assert.equal(a.damageCovered,a.covered);
 assert.equal(S.geometry(board).right.reservoir,null);assert.equal(R.tDoubleAccess(board).reachable,false);
});

test('reservoir/user snapshot retains accepted center first while preserving actual T through the cap',()=>{
 const advice=P.plan(snapshot);assert.deepEqual(advice.target,{type:'L',x:4,y:25,rotation:2});
 assert.equal(advice.evidence.preparationProof.kind,'visible-prefix-Z-saved-T');assert.equal(advice.continuation.length,4);
 let state=R.createState(snapshot),notches=S.notchPattern(state.board);
 for(const p of advice.continuation){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events,[p.event]);const c=S.advanceNotches(state.board,{event:p.event,state:r.state},notches);assert.ok(c.valid);notches=c.pattern;state=r.state;}
 assert.deepEqual(advice.continuation.map(p=>p.event.type),['L','I','Z','T']);
 assert.equal(advice.continuation[3].event.spin,'full');assert.equal(advice.continuation[3].event.lines,2);assert.equal(P.assess(state.board).maxHeight,12);
});
