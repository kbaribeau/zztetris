const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner');
const snapshot=require('./support/st-user-center-cap.json');
// Kevin's supplied manual snapshot remains the default-planner regression below.
// The historical no-HOLD L/T/Z route sacrificed T and is no longer acceptable
// ordinary advice. Reproduce its pre-cap geometry mechanically, explicitly as a
// counterfactual shape fixture, to keep reservoir credit independent of that
// now-forbidden policy. These two literals are not recommended by the coach.
const historicalPrefix=[['HD'],['L','CCW','HD']];
let reservoirOrigin=R.createState(snapshot);
for(const witness of historicalPrefix){const r=R.replay(reservoirOrigin,witness);assert.ok(r.valid);reservoirOrigin=r.state;}
const result=P.plan(reservoirOrigin,{depth:1,width:8,maxNodes:45000,allowHold:false});
function endpoint(){let state=reservoirOrigin;for(const step of result.continuation){const replay=R.replay(state,step.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events[0],step.event);state=replay.state;}return state;}
test('reservoir/counterfactual pre-cap geometry retains exact verified credit without recommending the historical T sacrifice',()=>{
 assert.equal(result.metrics.completeDepth,1);assert.equal(result.evidence.budgetExhausted,false);
 assert.deepEqual(result.target,{type:'Z',x:7,y:34,rotation:1});
 assert.equal(result.continuation[0].structuralEvidence.allocation,'right-cap-preparation');
 const a=result.assessment;
 assert.deepEqual(a.intentionalReservoir.cells,[[9,37],[9,38],[9,39]]);
 assert.equal(a.intentionalReservoir.credit,9);assert.equal(a.sealed,3);assert.equal(a.damageSealed,0);
 assert.equal(a.covered,6);assert.equal(a.damageCovered,3,'unrelated roofed cells keep their original penalty');
 assert.equal(result.evidence.structuralScore,-11.3);assert.deepEqual(result.evidence.structuralRank,[1,1,0,-3,1,-6,0,0]);assert.equal(a.leftContext.score,0);endpoint();
});
test('reservoir/ordinary advice cannot retain the historical non-scoring T prefix',()=>{
 const blocked=P.plan(snapshot,{depth:3,width:8,maxNodes:45000,allowHold:false});assert.equal(blocked.target,null,'The old Center L keeps inherited D without an immediate usable J');
 const ordinary=P.plan(snapshot,{depth:3,width:8,maxNodes:45000});assert.ok(ordinary.target);assert.ok(ordinary.continuation.every(p=>p.event.type!=='T'||p.event.spin==='full'&&p.event.lines===2));
 let state=R.createState(snapshot);const steps=[];
 for(const witness of [...historicalPrefix,result.witness]){const r=R.replay(state,witness);assert.ok(r.valid);steps.push({witness,event:r.events[0],target:r.events[0].target,hold:false,holdCount:0});state=r.state;}
 assert.equal(steps[1].event.type,'T');assert.equal(steps[1].event.lines,0);
 const origin=R.createState(snapshot),stale={target:steps[0].target,witness:steps[0].witness,hold:false,holdCount:0,continuation:steps,context:JSON.stringify([origin.rules,origin.board,origin.hold,origin.canHold,origin.queue,origin.bag??null,origin.active.type]),evidence:{},metrics:{}};
 assert.ok(stale.target,'The non-scoring-T rejection must not be a vacuous null-target check');assert.equal(require('../st-midgame-resources').checkPath(origin,steps).reason,'ordinary-T-must-score','The actual T-allocation violation remains independently observable');assert.equal(P.revalidate(snapshot,stale),null);
});
test('reservoir/immediate J supply keeps a genuine supported Center-L then D-exit positive',()=>{
 // Disclosed synthetic order variant: move the existing final J to the front;
 // no new piece type or hidden future is added. Actual history remains unknown.
 const supplied={...snapshot,queue:['J','T','Z','S','L','I']},a=P.plan(supplied,{depth:3,width:8,maxNodes:45000,allowHold:false});assert.deepEqual(a.target,{type:'L',x:4,y:25,rotation:2});assert.equal(a.continuation[1].event.type,'J');
 let state=R.createState(supplied);for(const p of a.continuation){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);state=r.state;}assert.equal(require('../st-left-context').isD(state.board),false);assert.ok(P.revalidate(supplied,a,{maxNodes:45000,allowHold:false}));
});
test('reservoir/proof: actual clear reopens exact shaft, without inventing T arrival',()=>{
 const state=endpoint(),cavity=result.assessment.structure.right.reservoir;
 assert.equal(cavity.status,'verified-clear-reopens-reservoir');
 assert.notEqual(state.active?.type,'T');assert.notEqual(state.hold,'T');assert.ok(!state.queue.includes('T'));
 const clear=R.replay(R.createState({board:state.board,active:'T',canHold:false}),cavity.witness);
 assert.equal(clear.valid,true);assert.equal(clear.events[0].spin,'full');assert.equal(clear.events[0].lines,2);
 assert.deepEqual(clear.events[0].clearedRows,[35,36]);assert.equal(P.assess(clear.state.board).sealed,0);
 assert.equal(result.evidence.tsdAt,null);assert.match(result.reason,/if a T is available/);
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
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner.js'),'utf8'),{module,require:name=>name==='./st-left-context.js'?require('../st-left-context'):name==='./st-resource-history.js'?require('../st-resource-history'):name==='./st-midgame-resources.js'?require('../st-midgame-resources'):name==='./st-rules.js'?rules:name==='./st-bag.js'?require('../st-bag'):name==='./st-access.js'?require('../st-access'):name==='./st-pattern-history.js'?require('../st-pattern-history'):name==='./st-left-foundation.js'?require('../st-left-foundation'):S});
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

test('reservoir/user snapshot completes its reserved center and preserves actual T through the cap',()=>{
 const advice=P.plan(snapshot);assert.ok(advice.target,advice.reason);
 let state=R.createState(snapshot),notches=S.notchPattern(state.board);
 let cells=S.geometry(state.board).center.completions.find(c=>c.piece==='L').cells.map(c=>c.slice()),completed=false,doubles=0;
 for(const p of advice.continuation){
  const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events,[p.event]);
  const check=S.advanceNotches(state.board,{event:p.event,state:r.state},notches);assert.ok(check.valid);notches=check.pattern;
  if(!completed&&p.event.type==='L'&&JSON.stringify(p.event.cells.slice().sort())===JSON.stringify(cells.slice().sort()))completed=true;
  if(!completed)cells=cells.filter(([,y])=>!p.event.clearedRows.includes(y)).map(([x,y])=>[x,y+p.event.clearedRows.filter(row=>row>y).length]);
  if(p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2)doubles++;
  state=r.state;
 }
 assert.equal(completed,true,'The original exact L completion is executed, immediately or by the visible replacement L.');
 assert.ok(doubles>=1);assert.equal(P.assess(state.board).sealed,0);assert.ok(P.assess(state.board).maxHeight<20);
});
