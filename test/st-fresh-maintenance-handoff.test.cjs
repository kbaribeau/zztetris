'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),B=require('../st-bag'),PH=require('../st-pattern-history'),RH=require('../st-resource-history'),M=require('../st-obligation-resources'),Provider=require('../st-resource-provider'),A=require('../st-access');
const fixture=require('./fixtures/fresh-maintenance-handoff.json'),clone=x=>JSON.parse(JSON.stringify(x));
const request=()=>clone(fixture.request),options=q=>({...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,now:()=>0});
let cached;const advice=()=>clone(cached??=P.decide(request().observation,options(request())));
function marked(q){return RH.markHandoff(RH.importContext(q.observation,q.options.resourceContext),q.observation);}
function intercepted(extras){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:id=>extras[id]||require(id.replace('./','../')),Date,performance});return module.exports;}

test('fresh handoff / ordinary maintenance discovers and admits the visible J dependency without a handoff-specific hint',()=>{
 const q=request(),before=clone(q),a=P.decide(q.observation,options(q));cached=clone(a);
 assert.equal(a.phase,'maintenance');assert.equal(a.recommendation.kind,'supported');assert.equal(a.evidence.openingHandoff.decision,'fresh-supported-maintenance');
 assert.equal(a.metrics.handoffWork.fresh.selected,true);assert.equal(a.metrics.visibleLeftRepair.selected,true);
 assert.deepEqual(a.continuation.map(p=>p.event.type),['L','Z','O','J']);assert.equal(P.cycleResources(a.continuation).leftRepairs,1);
 assert.equal(a.continuation.at(-1).structuralEvidence.leftRepair.pieceId,23);
 assert.deepEqual(a.continuation.at(-1).event.cells,[[0,34],[1,34],[0,35],[0,36]]);
 assert.ok(a.metrics.nodes<=45000);assert.equal(a.metrics.nodes,45000-a.metrics.handoffWork.fresh.remainingNodes+a.metrics.handoffWork.fresh.nodes);
 assert.equal(a.metrics.handoffWork.legacy.forecast.retained,true);assert.equal(a.evidence.openingHandoff.forecast,undefined,'Fresh advice must not claim the selected route was forecast-revalidated');
 const boundary=Provider.projectHandoff(Provider.prepare(q.observation,q.options).frame);
 assert.equal(a.evidence.resourceObligations.binding,M.rootBinding(Provider.startRoute(boundary)));
 assert.equal(P.revalidate(q.observation,a,{...options(q),openingPhase:false}),null,'The unmarked live ledger cannot borrow handoff labels');
 assert.ok(P.revalidate(q.observation,a,{...options(q),openingPhase:false,resourceContext:RH.exportContext(q.observation,marked(q))}));
 assert.deepEqual(q,before,'The planner never mutates the live request or history');
});
test('fresh handoff / no forecast and rejected forecast still allow an ordinary supported decision',()=>{
 for(const forecast of [null,{...clone(fixture.request.options.openingForecast),version:999}]){
  const q=request();q.options.openingForecast=forecast;const a=P.decide(q.observation,options(q));
  assert.equal(a.metrics.handoffWork.fresh.selected,true);assert.equal(a.metrics.visibleLeftRepair.selected,true);assert.equal(a.evidence.openingHandoff.forecast,undefined);
  assert.ok(a.metrics.nodes<=45000);assert.ok(R.replay(q.observation,a.continuation.flatMap(p=>p.witness)).valid);
 }
});
test('fresh handoff / exact J goal survives movement, HOLD and newly revealed supply until actual payment',()=>{
 const q=request();let state=q.observation,history=marked(q),pattern=q.options.patternHistory,a=advice(),holds=0;const goal=clone(a.continuation.at(-1).structuralEvidence.leftRepair);
 for(let lock=0;lock<4;lock++){
  const origin=state,old=a;for(const action of old.witness){holds+=Number(action==='HOLD');const before=state;state=R.move(before,action);assert.notEqual(state,before);
   if(action==='HD'){const revealed=['T','Z','S','J'][lock];state={...state,queue:[...state.queue,revealed],bag:B.consume(state.bag,revealed)};pattern=PH.update(pattern,before,state,state.lastEvent);}
   history=RH.applyAction(history,before,action,state);
   if(action!=='HD'){a=P.advance(state,a,action,{...options(q),openingPhase:false,patternHistory:pattern,resourceContext:RH.exportContext(state,history)});assert.ok(a);}
  }
  a=P.continueCommitment(origin,state,old,state.lastEvent,{...options(q),openingPhase:false,patternHistory:pattern,resourceContext:RH.exportContext(state,history)});
  if(lock<3){assert.ok(a,`retained after actual lock ${lock+1}`);assert.deepEqual(a.continuation.at(-1).structuralEvidence.leftRepair,goal);}else assert.equal(a,null);
 }
 assert.ok(holds>0,'The retained route actually executes HOLD');
});
test('fresh handoff / another eligible public position delegates without requiring a J repair',()=>{
 const f=require('./fixtures/opening-forecast-public.json'),q=clone(f.request);q.options.openingForecast=clone(f.forecast);
 const a=P.decide(q.observation,options(q));assert.equal(a.metrics.handoffWork.fresh.attempted,true);assert.equal(a.metrics.handoffWork.fresh.selected,true);
 assert.equal(a.recommendation.kind,'supported');assert.equal(P.cycleResources(a.continuation).leftRepairs,0);assert.equal(a.evidence.openingHandoff.decision,'fresh-supported-maintenance');assert.ok(R.replay(q.observation,a.continuation.flatMap(p=>p.witness)).valid);
});
test('fresh handoff / disabled comparison preserves the checked forecast as the unchanged fallback',()=>{
 const q=request(),a=P.decide(q.observation,{...options(q),disableFreshHandoff:true});
 assert.equal(a.evidence.openingHandoff.forecast.status,'revalidated-after-actual-clear');assert.equal(a.metrics.handoffWork.fresh,undefined);
 assert.equal(a.metrics.handoffWork.legacy.source,'forecast-revalidated');assert.deepEqual(a.continuation.map(p=>p.event.type),['O','Z']);assert.equal(P.cycleResources(a.continuation).leftRepairs,0);
});
test('fresh handoff / an expired post-admission deadline keeps the proven fallback and does not begin another search',()=>{
 let clock=0,calls=0;const planner=intercepted({'./st-access.js':{...A,prefix:(s,p,o)=>{calls++;const result=A.prefix(s,p,o);clock=1500;return result;}}});
 const q=request(),a=planner.plan(q.observation,{...options(q),now:()=>clock,deadline:1500});
 assert.equal(calls,1);assert.ok(a.target);assert.equal(a.metrics.handoffWork.fresh.attempted,false);assert.equal(a.metrics.handoffWork.fresh.reason,'shared-budget');
 assert.equal(a.evidence.openingHandoff.forecast.status,'revalidated-after-actual-clear');assert.deepEqual(a.continuation.map(p=>p.event.type),['O','Z']);
});
test('fresh handoff / incomplete fresh work spends the residual allowance and retains the already admitted forecast',()=>{
 const q=request(),fallback=P.plan(q.observation,{...options(q),disableFreshHandoff:true});
 let clock=0,roots=0;const planner=intercepted({'./st-rules.js':{...R,placements:(s,o)=>{roots++;clock=1500;return{placements:[],visited:Math.min(13,o.maxNodes),complete:false};}}});
 const a=planner.plan(q.observation,{...options(q),now:()=>clock,deadline:1500});
 assert.ok(roots>0);assert.ok(a.target);assert.equal(a.metrics.handoffWork.fresh.attempted,true);assert.equal(a.metrics.handoffWork.fresh.selected,false);
 assert.ok(a.metrics.handoffWork.fresh.nodes>=13);assert.equal(a.metrics.nodes,45000-a.metrics.handoffWork.fresh.remainingNodes+a.metrics.handoffWork.fresh.nodes);assert.ok(a.metrics.nodes<=45000);
 assert.deepEqual(clone(a.continuation),fallback.continuation);assert.deepEqual(clone(a.target),fallback.target);assert.deepEqual(clone(a.witness),fallback.witness);assert.deepEqual(clone(a.evidence),fallback.evidence);
});
test('fresh handoff / supported-only decision never invokes Reset dispatch and returns a supported result',()=>{
 let calls=0;const reset={...require('../st-reset-coach'),consider:()=>{calls++;throw Error('Reset dispatch is outside fresh supported handoff');},plan:()=>{throw Error('Reset must not run');}};
 const planner=intercepted({'./st-reset-coach.js':reset}),q=request(),a=planner.decide(q.observation,options(q));
 assert.equal(calls,0);assert.equal(a.metrics.handoffWork.fresh.selected,true);assert.equal(a.recommendation.kind,'supported');assert.notEqual(a.evidence.strategy,'reset-coach');
});
test('fresh handoff / zero and expired outer requests cannot acquire handoff authority',()=>{
 for(const patch of [{maxNodes:0},{deadline:0,now:()=>1}]){const q=request(),a=P.decide(q.observation,{...options(q),...patch});assert.equal(a.target,null);assert.equal(a.metrics.handoffWork?.fresh,undefined);}
});
test('fresh handoff / imported phase labels and previous advice cannot authorize the optional transition',()=>{
 const q=request(),previous=advice(),history=marked(q);
 const a=P.decide(q.observation,{...options(q),openingPhase:false,resourceContext:RH.exportContext(q.observation,history),previous});
 assert.ok(a.target);assert.equal(a.retained,true);assert.deepEqual(a.continuation,previous.continuation);assert.ok(a.metrics.revalidationNodes>0);
});
test('fresh handoff / fresh production Worker performs the same supported boundary and finite goal',()=>{
 const q=request(),a=require('../scripts/lib/st-simulation.cjs').workerPlanner()(q);
 assert.equal(a.metrics.handoffWork.fresh.selected,true);assert.equal(a.metrics.visibleLeftRepair.selected,true);assert.equal(a.recommendation.kind,'supported');assert.ok(a.metrics.nodes<=45000);
 assert.ok(R.replay(q.observation,a.continuation.flatMap(p=>p.witness)).valid);
});
test('fresh handoff / zero residual nodes preserves its certified fallback without starting fresh work',()=>{
 const q=request(),fallback=P.plan(q.observation,{...options(q),disableFreshHandoff:true});assert.ok(fallback.target);
 const a=P.plan(q.observation,{...options(q),maxNodes:fallback.metrics.nodes});
 assert.ok(a.target);assert.equal(a.metrics.handoffWork.fresh.remainingNodes,0);assert.equal(a.metrics.handoffWork.fresh.attempted,false);
 assert.equal(a.metrics.nodes,fallback.metrics.nodes);assert.deepEqual(a.continuation,fallback.continuation);assert.deepEqual(a.evidence,fallback.evidence);
});
test('fresh handoff / copied handoff labels without eligible history or an actual clear cannot authorize fresh work',()=>{
 const q=request(),a=P.decide(q.observation,{...options(q),previous:advice(),resourceContext:null,openingClear:null});
 assert.notEqual(a.retained,true);assert.notEqual(a.phase,'maintenance');assert.equal(a.evidence?.openingHandoff,undefined);assert.equal(a.metrics.handoffWork?.fresh,undefined);
});
