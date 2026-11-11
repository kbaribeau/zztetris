'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),B=require('../st-bag'),F=require('../st-fixtures'),Session=require('../st-session'),Sim=require('../scripts/lib/st-simulation.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const untimed={now:()=>0,deadline:Infinity};
function replay(position,advice){let state=R.createState(position);for(const step of advice.continuation){const got=R.replay(state,step.witness);assert.equal(got.valid,true);assert.deepEqual(got.events,[step.event]);state=got.state;}return state;}

test('public horizon: default ordinary search passes three locks under the unchanged node cap',()=>{
 const state=F.get('o-filler').observation,config={...Session.defaults(),...untimed};
 assert.deepEqual(Session.defaults(),{timeMs:1500,depth:null,width:8,maxNodes:45000});assert.deepEqual(Sim.CONFIG,Session.defaults());
 const capped=P.plan(state,{...config,depth:3}),actual=P.plan(state,config);
 assert.equal(capped.metrics.completedBeamDepth,3);assert.equal(capped.continuation.length,3);
 assert.ok(actual.metrics.completedBeamDepth>3);assert.ok(actual.continuation.length>3);assert.ok(actual.metrics.nodes<=45000);replay(state,actual);
 const {depth,...omitted}=config,implicit=P.plan(state,omitted);assert.deepEqual(implicit.target,actual.target);assert.deepEqual(implicit.continuation,actual.continuation);
});

test('public horizon: finite supply, HOLD and forced public deduction do not create hidden draws',()=>{
 const source=R.createState(F.get('o-filler').observation);
 for(const extra of [
  {hold:null,queue:['J','L','I']},
  {hold:'Z',queue:['J','L','I']},
  {hold:null,queue:['J','L','I'],bag:B.fromObserved({observed:['I','J','L','O','S','Z'],startPhase:0})}
 ]){
  const state={...source,...extra},forced=state.bag?Number(Boolean(B.forcedNext(state.bag))):0,known=1+state.queue.length+Number(Boolean(state.hold))+forced;
  const config={...untimed,width:1,maxNodes:45000},a=P.plan(state,config),hidden=P.plan({...state,seed:987,hiddenQueue:['T','I','Z'],generator:{future:['S','S','S']}},config);
  assert.equal(a.metrics.completedBeamDepth,known);assert.ok(a.continuation.length<=known);assert.ok(a.metrics.nodes<=45000);assert.deepEqual(hidden.continuation,a.continuation);assert.deepEqual(hidden.target,a.target);
  const route=require('../st-resource-provider'),input=route.prepare(state),materialized=require('../st-obligation-resources').position(route.startRoute(input,{horizon:14}));replay(materialized,a);
 }
});

test('public horizon: interrupted deeper search preserves a completed result and respects zero/deadline bounds',()=>{
 const state=F.get('o-filler').observation,config={...Session.defaults(),...untimed},root=P.plan(state,{...config,depth:1}),partial=P.plan(state,{...config,maxNodes:root.metrics.nodes+100});
 assert.equal(partial.metrics.completeDepth,1);assert.equal(partial.continuation.length,1);assert.ok(partial.metrics.nodes<=root.metrics.nodes+100);assert.equal(partial.evidence.budgetExhausted,true);replay(state,partial);
 assert.equal(P.plan(state,{...config,maxNodes:0}).status,'budget-exhausted');assert.equal(P.plan(state,{...config,deadline:0}).status,'budget-exhausted');
});

test('public horizon: real worker follows the shared default beyond three locks',()=>{
 const observation=R.createState(F.get('o-filler').observation),actual=Sim.workerPlanner({disableSearchTimeout:true})({type:'plan',id:411,observation,options:Sim.CONFIG});
 assert.ok(actual.metrics.completedBeamDepth>3);assert.ok(actual.continuation.length>3);assert.ok(actual.metrics.nodes<=45000);replay(observation,actual);
});

test('public horizon: old production sessions migrate without losing current accounting or accepting larger budgets',()=>{
 const position=R.migrateState(F.get('o-before-double').observation),saved=Session.create(position),old=clone(saved);old.engineVersion='st-coach-session-2026-11-07-current-obligations-v1';old.search.depth=3;old.coaching.previous={target:'old advice'};old.coaching.commitment={advice:'old commitment'};
 const restored=Session.prepare(old);assert.deepEqual(restored.search,Session.defaults());assert.deepEqual(restored.state,saved.position);assert.deepEqual(require('../st-obligation-context').exportState(restored.obligationContext),saved.coaching.obligationContext);assert.equal(restored.previous,null);assert.equal(restored.commitment,null);assert.ok(restored.warnings.some(w=>/three-lock/.test(w)));
 assert.equal(Session.create(restored.state,restored).search.depth,null);
 for(const alter of [x=>x.search.depth=4,x=>x.search.width=9,x=>x.search.maxNodes=45001,x=>x.search.timeMs=1501,x=>delete x.search.depth,x=>x.search.extra=true]){const bad=clone(old);alter(bad);assert.throws(()=>Session.prepare(bad),/search settings/);}
});


test('public horizon: Reset explores past three literal locks while retaining its separate proof limit',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),file=require.resolve('../st-reset-coach'),req=createRequire(file),f=require('./support/reset-history.cjs')(),count=s=>Number(Boolean(s.active))+Number(Boolean(s.hold))+s.queue.length,initial=count(f.state);let explored=0;
 // Observe real enumeration depth without replacing moves, proofs or ranking.
 const rules={...R,placements(state,options){explored=Math.max(explored,initial-count(state));return R.placements(state,options);}},box={module:{exports:{}},require:name=>name==='./st-rules'?rules:req(name),Date};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),box);const C=box.module.exports;
 const options={obligationContext:f.obligationContext,...untimed,width:1,maxNodes:45000};
 const limited=C.plan(f.state,{...options,depth:3});assert.equal(explored,2);assert.ok(limited.target);
 explored=0;const actual=C.plan(f.state,{...options,depth:null});assert.ok(explored>=3);assert.ok(explored<7);assert.ok(actual.metrics.nodes<=45000);assert.ok(C.check(f.state,actual.continuation,options).valid);
});


test('public horizon: a longer pending-L commitment remains valid after the former three-lock expiry',()=>{
 const f=require('./fixtures/pending-L-expiry.json'),session=Sim.createSession({scenario:'stable',initial:f.observation,obligationContext:f.options.obligationContext,future:f.recordedReveals}),run=Sim.workerPlanner({disableSearchTimeout:true});
 for(let lock=24;lock<=26;lock++){const request=session.request(lock,Sim.CONFIG),advice=run(request);assert.ok(advice.target);assert.ok(advice.metrics.nodes<=45000);Sim.validateAdvice(request.observation,advice);session.execute(advice);}
 const request=session.request(27,Sim.CONFIG),saved=request.commitment?.advice;assert.ok(saved?.continuation.length>0);replay(request.observation,saved);assert.ok(P.revalidate(request.observation,saved,{...request.options,...untimed}));
});
