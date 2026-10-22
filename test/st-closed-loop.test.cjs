'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/evaluate-st.cjs'),R=require('../st-rules'),B=require('../st-bag'),F=require('../st-fixtures');
test('closed-loop reveal consumes new evidence only and does not mutate snapshot',()=>{
 const f=F.get('o-before-double'),state=R.createState(f.observation),before=JSON.stringify(state),future=f.future.slice(),locked=E.execute(state,['HD']),count=locked.bag.observedCount;
 const filled=E.replenish(locked,future);assert.equal(filled.queue.length,6);assert.equal(filled.bag.observedCount,count+1);assert.deepEqual(B.validate(filled.bag),[]);assert.equal(JSON.stringify(state),before);
});
test('planner closes a nonclear, T-spin double and supported rebuild loop from fresh observations',()=>{
 const result=E.closedLoop('o-before-double',{locks:4});assert.equal(result.locks,4);assert.equal(result.status,'lock-limit');assert.equal(result.cycle,true);assert.equal(result.steps[0].lines,0);assert.ok(result.steps.some(s=>s.lines===2&&s.spin==='full'));assert.equal(result.steps.at(-1).lines,0);assert.ok(result.steps.every(s=>s.regionalSupport&&s.openChannel));
});
test('held-out higher stack also completes a nonclear, TSD and supported rebuild cycle',()=>{
 const result=E.closedLoop('higher-cap',{locks:4});assert.equal(result.locks,4);assert.equal(result.cycle,true);assert.equal(result.steps[0].lines,0);assert.ok(result.steps.some(s=>s.lines===2&&s.spin==='full'));assert.equal(result.steps.at(-1).lines,0);assert.ok(result.steps.every(s=>s.regionalSupport&&s.openChannel));
});
test('early filler decisions preserve real T entry instead of farming inaccessible slots',()=>{
 const f=F.get('o-filler'),future=f.future.slice(),result=E.closedLoop(f.id,{locks:4});let state=R.createState(f.observation);assert.equal(result.locks,4);
 for(const step of result.steps){state=E.execute(state,step.witness);assert.equal(R.tDoubleAccess(state.board).reachable,true,`lost executable T opportunity after lock ${step.lock}`);state=E.replenish(state,future);}
});

test('a provenance-replayed temporary channel imbalance can be replanned back to strict support',()=>{
 const P=require('../st-planner'),f=F.get('o-filler'),future=f.future.slice();let state=R.createState(f.observation);
 // Recorded legal prefix from the earlier evaluator, not prescribed planner answers.
 const prefix=[["L","L","HD"],["R","R","R","R","R180","HD"],["HD"],["R","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CCW","SD","SD","SD","SD","SD","CCW","HD"],["HOLD","L","L","L","CW","L","HD"],["R","CW","HD"],["L","L","HD"],["R","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CCW","R","R","SD","SD","SD","SD","SD","SD","SD","CCW","HD"],["R","R","R","R","HD"],["R","R","R","R","HD"],["HOLD","L","L","HD"],["CCW","HD"],["R","R180","HD"],["HD"],["R","R","R","CW","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CW","HD"],["HOLD","CW","HD"],["HOLD","L","L","HD"],["HOLD","L","L","L","CW","L","HD"],["R","R","R","R","R180","HD"],["HOLD","L","L","L","HD"],["R","R","R","R","CCW","R","HD"],["R","R","R","R","CW","HD"],["L","L","L","HD"],["HOLD","R","R","R","R","HD"],["L","L","L","CW","L","HD"],["L","L","HD"],["L","L","R180","HD"],["R","R","CW","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CW","HD"],["R","R","HD"]];
 for(const witness of prefix)state=E.replenish(E.execute(state,witness),future);
 assert.equal(P.assess(state.board).regionalSupport,false);
 const advice=P.plan(P.observe(state),E.CONFIG);assert.ok(advice.target,advice.reason);
 for(const step of advice.continuation)state=E.execute(state,step.witness);
 assert.equal(P.assess(state.board).regionalSupport,true);
});
