'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarize}=require('./support/st-selection-performance.cjs');
const E=require('../scripts/evaluate-st.cjs'),R=require('../st-rules'),B=require('../st-bag'),F=require('../st-fixtures');
test('closed-loop reveal consumes new evidence only and does not mutate snapshot',()=>{
 const f=F.get('o-before-double'),state=R.createState(f.observation),before=JSON.stringify(state),future=f.future.slice(),locked=E.execute(state,['HD']),count=locked.bag.observedCount;
 const filled=E.replenish(locked,future);assert.equal(filled.queue.length,6);assert.equal(filled.bag.observedCount,count+1);assert.deepEqual(B.validate(filled.bag),[]);assert.equal(JSON.stringify(state),before);
});
test('planner preserves executable supported play across four fresh observations',t=>{
 const result=E.closedLoop('o-before-double',{locks:4,config:{...E.CONFIG,now:()=>0,deadline:Infinity}});
 assert.equal(result.locks,4);assert.equal(result.status,'lock-limit');assert.equal(result.witnessFailures,0);
 assert.ok(result.steps.every(s=>s.regionalSupport&&s.openChannel));
 const f=F.get('o-before-double'),future=f.future.slice();let state=R.createState(f.observation);
 for(const step of result.steps){const replay=R.replay(state,step.witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);
  const event=replay.events[0];assert.equal(event.topOut,false);assert.equal(require('../st-structure').canonicalClear(event),true);
  assert.equal(event.type,step.type);assert.equal(event.lines,step.lines);assert.equal(event.spin,step.spin);
  state=E.replenish(replay.state,future);
 }
 t.diagnostic('selection-performance '+JSON.stringify({id:'o-before-double',selected:summarize(result.steps,{cycle:result.cycle})}));
});
test('reviewed scoring and deferred routes remain executable; performance metrics preserve the observed regression',()=>{
 const recorded=require('./fixtures/effort-neutral-scoring-routes.json'),f=F.get('o-before-double');
 for(const route of Object.values(recorded.routes)){
  let state=R.createState(f.observation),priorNonclear=false,afterDouble=false,cycle=false;const future=f.future.slice(),events=[];
  for(const witness of route.witnesses){const replay=R.replay(state,witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);
   const event=replay.events[0];events.push(event);assert.equal(event.topOut,false);assert.equal(require('../st-structure').canonicalClear(event),true);
   const assessment=require('../st-planner').assess(replay.state.board);assert.equal(assessment.regionalSupport,true);assert.equal(assessment.channel.openBelowStack,true);
   if(event.spin==='full'&&event.lines===2&&priorNonclear)afterDouble=true;
   if(event.lines===0){if(afterDouble)cycle=true;priorNonclear=true;}
   state=E.replenish(replay.state,future);
  }
  assert.deepEqual(events.map(e=>e.type),route.pieces);
  assert.deepEqual(summarize(events,{cycle}),{locks:4,firstTsdLock:route.firstTsdLock,tsds:route.tsds,lines:route.tsds*2,cycle:route.cycle});
 }
 // Keep the finite-window regression visible rather than extending its horizon.
 assert.equal(recorded.routes.baseline.firstTsdLock,2);assert.equal(recorded.routes.baseline.cycle,true);
 assert.equal(recorded.routes.effortNeutral.firstTsdLock,null);assert.equal(recorded.routes.effortNeutral.cycle,false);
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
