'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),E=require('../scripts/lib/st-simulation.cjs'),fixture=require('./fixtures/forced-bag-resource-binding.json'),roots=require('./fixtures/shared-handoff-roots.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function intercepted(inner,resources=require('../st-midgame-resources'),extras={}){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?{...P,plan:inner,...extras}:id==='./st-midgame-resources'?resources:require(id.replace('./','../')),Date,performance});return module.exports;}
test('handoff recovery budget: legacy success returns its exact prefix without a new goal or recovery attempt',()=>{
 let calls=0;const saved=clone(fixture.advice);saved.metrics.nodes=6116;
 const O=intercepted((_s,o)=>{calls++;assert.equal(o.maxNodes,12000);assert.equal(o.deadline,200);return saved;});
 const q=roots[0].request,a=O.plan(q.observation,{...q.options,handoffRecoveryProbe:true,deadline:1500,now:()=>0});
 assert.equal(calls,1);assert.deepEqual(a.continuation,saved.continuation);assert.deepEqual(a.target,saved.target);assert.equal(a.evidence.openingHandoff.recovery,undefined);assert.equal(a.metrics.nodes,6116);assert.equal(a.metrics.handoffWork.recovery.nodes,undefined);
});
test('handoff recovery budget: failed old proof and recovery share residual nodes and original deadline',()=>{
 const calls=[];const O=intercepted((_s,o)=>{calls.push(o);return calls.length===1?{target:null,status:'budget-exhausted',metrics:{nodes:12000}}:{...clone(fixture.advice),metrics:{nodes:20848}};});
 const q=roots[0].request,a=O.plan(q.observation,{...q.options,deadline:1500,now:()=>0});
 assert.equal(calls.length,2);assert.equal(calls[0].maxNodes,12000);assert.equal(calls[0].deadline,200);assert.equal(calls[1].maxNodes,22000);assert.equal(calls[1].deadline,1000);
 assert.equal(a.metrics.nodes,32848);assert.equal(a.metrics.handoffWork.fallbackNodes,11000);assert.equal(a.evidence.openingHandoff.recovery,'shared-after-legacy-budget-miss');assert.equal(a.continuation.length,2);assert.equal(a.continuation[1].event.type,'S');
});
test('handoff recovery budget: elapsed time and exhausted recovery cannot restart source/full fallback work',()=>{
 let clock=0,callbacks=0,calls=0;const O=intercepted((_s,o)=>{calls++;clock=calls===1?200:1500;return{target:null,status:'budget-exhausted',metrics:{nodes:o.maxNodes}};});
 const q=roots[0].request,a=O.plan(q.observation,{...q.options,openingClear:null,openingSource:{continuationSteps:Array(7).fill({}),scoringSteps:[]},normalOpeningDecision:()=>{callbacks++;throw Error('Fresh full allowance is forbidden');},deadline:1500,now:()=>clock});
 assert.equal(calls,2);assert.equal(callbacks,0);assert.equal(a.target,null);assert.equal(a.status,'budget-exhausted');assert.equal(a.metrics.nodes,34000);assert(a.metrics.handoffWork.recovery.deadline<1500);
});
test('handoff recovery budget: zero, expired and reduced caller allowances remain exact',()=>{
 let calls=0;const O=intercepted((_s,o)=>{calls++;return{target:null,status:'budget-exhausted',metrics:{nodes:o.maxNodes}};});const q=roots[0].request;
 for(const o of [{maxNodes:0,deadline:1500},{maxNodes:45000,deadline:0}]){const a=O.plan(q.observation,{...q.options,...o,now:()=>0});assert.equal(a.target,null);assert.equal(a.metrics.nodes,0);}assert.equal(calls,0);
 const a=O.plan(q.observation,{...q.options,maxNodes:12000,deadline:Infinity,now:()=>0});assert.equal(calls,1);assert.equal(a.metrics.nodes,12000);assert.equal(a.target,null);
});
test('handoff recovery budget: actual old positive handoff cannot grow into a different retained commitment',()=>{
 const f=require('./fixtures/legacy-handoff-prefix.json'),q=f.request,a=P.decide(q.observation,{...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,now:()=>0});
 assert(a.target);assert.equal(a.phase,'maintenance');assert.equal(a.evidence.openingHandoff.recovery,undefined);assert.deepEqual(a.continuation.map(p=>p.event),f.advice.continuation.map(p=>p.event));assert.equal(P.resourceGoal(a.continuation),false);assert.equal(a.metrics.handoffWork.recovery.nodes,undefined);assert(a.metrics.nodes<=45000);E.validateAdvice(q.observation,a);
});
test('handoff recovery budget: fresh live worker recovers only the visible observed-S payment within unchanged cap',()=>{
 const q=roots[0].request,a=E.workerPlanner()(q);assert(a.target,a.reason);assert.equal(a.phase,'maintenance');assert.equal(a.evidence.openingHandoff.recovery,'shared-after-legacy-budget-miss');assert(a.metrics.nodes<=45000);assert(a.metrics.handoffWork.legacy.nodes>0);assert(a.metrics.handoffWork.recovery.nodes>0);assert.equal(a.continuation.at(-1).event.type,'S');assert(a.continuation.at(-1).event.cells.every(([x])=>x<4));E.validateAdvice(q.observation,a);
});

test('handoff recovery budget: an already-paid prefix cannot label another S filler as its mandatory payment',()=>{
 const M=require('../st-midgame-resources');let calls=0,clock=0;
 // Boundary injection models an already-discharged prefix. The real resource
 // unit tests independently require exact consumed identity for S→Left payment.
 const resources={...M,checkPath:(raw,path,summary)=>{const r=M.checkPath(raw,path,summary);return path.length===1?{...r,resource:{...r.resource,hangingS:[]}}:r;}};
 const O=intercepted((_s,o)=>{calls++;if(calls===1)return{target:null,status:'budget-exhausted',metrics:{nodes:12000}};clock=1500;return{...clone(fixture.advice),metrics:{nodes:20848}};},resources),q=roots[0].request;
 const a=O.plan(q.observation,{...q.options,deadline:1500,now:()=>clock});assert.equal(calls,2);assert.equal(a.target,null);assert.equal(a.metrics.nodes,32848);assert.equal(a.metrics.handoffWork.recovery.nodes,20848);
});

test('handoff recovery budget: unavailable bounded routing cannot strand an accepted two-lock handoff',()=>{
 let calls=0,clock=0;const O=intercepted((_s,o)=>++calls===1?{target:null,status:'budget-exhausted',metrics:{nodes:12000}}:{...clone(fixture.advice),metrics:{nodes:20848}},undefined,{captureHandoffRecovery:()=>{clock=1500;return null;}}),q=roots[0].request;
 const a=O.plan(q.observation,{...q.options,deadline:1500,now:()=>clock});assert.equal(calls,2);assert.equal(a.target,null);assert.equal(a.metrics.nodes,32848);assert.equal(a.metrics.handoffWork.recovery.status,'routing-candidate-unavailable');
});
test('handoff recovery budget: stale source cannot stack a fresh full callback while residual time still remains',()=>{
 const q=roots[1].request;let callbacks=0;const O=intercepted((_s,o)=>({target:null,status:'budget-exhausted',metrics:{nodes:o.maxNodes}}));
 const a=O.plan(q.observation,{...q.options,openingClear:null,openingSource:{continuationSteps:Array(7).fill({}),scoringSteps:[]},normalOpeningDecision:()=>{callbacks++;throw Error('Cannot restart original allowance after charged work');},deadline:Infinity,now:()=>0});
 assert.equal(callbacks,0);assert.equal(a.metrics.handoffWork.legacy.nodes,12000);assert.equal(a.metrics.handoffWork.recovery.nodes,22000);assert(a.metrics.nodes<=45000);
});
test('handoff recovery budget: untouched source-scoring fallback keeps exact checked-object identity',()=>{
 const O=require('../st-opening'),state=R.createState({active:'O',queue:['I','T']}),proof=R.replay(state,['HD']),event=proof.events[0];const ordinary={target:event.target,witness:['HD'],hold:false,holdCount:0,continuation:[{target:event.target,witness:['HD'],event,board:proof.state.board}],metrics:{nodes:17},evidence:{opening:{status:'controlled-ordinary'}}};let called=0;
 const a=O.plan(state,{openingPhase:true,openingSource:{continuationSteps:Array(7).fill({}),scoringSteps:[]},normalOpeningDecision:()=>{called++;return ordinary;},deadline:Infinity,now:()=>0,maxNodes:100});assert.equal(called,1);assert.equal(a,ordinary);assert.equal(a.metrics.handoffWork.legacy.nodes,0);assert.equal(a.metrics.nodes,17);
});
