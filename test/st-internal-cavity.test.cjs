const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure');
const c=require('./support/st-internal-cavity.json');
const opts={depth:3,width:8,maxNodes:45000};
const internal=s=>P.assess(s.board).sealedCells.filter(([x])=>x<7);
test('st-cavity/exact observed O choice does not seal the avoidable center cell',()=>{
 const bad=R.replay(c.snapshot,c.badAdvice.witness);assert.equal(bad.valid,true);
 assert.ok(internal(bad.state).some(([x,y])=>x===4&&y===30));
 const advice=P.plan(c.snapshot,opts);assert.ok(advice.target,advice.reason);
 let state=c.snapshot;for(const step of advice.continuation){const r=R.replay(state,step.witness);assert.equal(r.valid,true);assert.equal(S.canonicalClear(r.events[0]),true);state=r.state;}
 assert.deepEqual(advice.evidence.cavityRepair.outstandingCells,[]);
 assert.equal(internal(R.replay(c.snapshot,advice.witness).state).length,0);
 assert.equal(P.revalidate(c.snapshot,c.badAdvice),null);
});
test('st-cavity/actual preceding double and fresh replanning preserve accessible center',()=>{
 const r=R.replay(c.before,c.precedingWitness);assert.equal(r.valid,true);assert.deepEqual(r.state.board,c.snapshot.board);
 // Revealed preview is supplied only after its observed predecessor locks.
 const current={...r.state,queue:c.snapshot.queue,bag:c.snapshot.bag};
 const advice=P.plan(current,opts);assert.ok(advice.target,advice.reason);
 assert.equal(internal(R.replay(current,advice.witness).state).length,0);
});
test('st-cavity/visible four-lock alternative repairs the threatened center cell',()=>{
 let s=c.snapshot,notches=S.notchPattern(s.board);
 for(const step of c.repair){const r=R.replay(s,step.witness);assert.equal(r.valid,true);assert.equal(S.canonicalClear(r.events[0]),true);const ck=S.advanceNotches(s.board,{event:r.events[0],state:r.state},notches);assert.equal(ck.valid,true);notches=ck.pattern;s=r.state;assert.equal(internal(s).length,0);}
 assert.notEqual(s.board[30][4],'.');
});
test('st-cavity/repair tracks cell identity rather than a total hole count across clears',()=>{
 const before={sealedCells:[[0,39],[4,30]]},after={sealedCells:[[4,31],[2,28]]};
 const debt=P.cavityRepairDebt(before,after,{clearedRows:[39]},[[4,30]]);
 assert.deepEqual(debt,[[4,31],[2,28]]);
 assert.deepEqual(P.cavityRepairDebt(after,{sealedCells:[[4,31]]},{clearedRows:[]},debt),[[4,31]]);
});
test('st-cavity/cleared or reopened cells repay debt; right reservoirs are separate',()=>{
 assert.deepEqual(P.cavityRepairDebt({sealedCells:[[4,30]]},{sealedCells:[[9,38]]},{clearedRows:[30]},[[4,30]]),[]);
 assert.deepEqual(P.cavityRepairDebt({sealedCells:[]},{sealedCells:[[9,38],[9,39]]},{clearedRows:[]}),[]);
 assert.deepEqual(P.cavityRepairDebt({sealedCells:[[4,30]]},{sealedCells:[]},{clearedRows:[]},[[4,30]]),[]);
});
test('st-cavity/retention rejects the formerly synthetic left-sealing hold witness',()=>{
 const f=require('../st-fixtures').get('o-before-double'),s=R.migrateState(f.observation),witness=['HOLD','L','HD'];
 const r=R.replay(s,witness);assert.equal(r.valid,true);
 assert.deepEqual(P.cavityRepairDebt(P.assess(s.board),P.assess(r.state.board),r.events[0]),[[2,28],[2,29],[3,28],[3,29]]);
 const advice={target:r.events[0].target,witness,hold:true,reason:'Synthetic legal witness.',continuation:[{witness,event:r.events[0]}]};
 assert.equal(P.advance(R.move(s,'HOLD'),advice,'HOLD'),null);
});
