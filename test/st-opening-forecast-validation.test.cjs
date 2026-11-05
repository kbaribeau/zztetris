'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules');
const fixture=require('./fixtures/opening-forecast-public.json'),clone=x=>JSON.parse(JSON.stringify(x));
function input(){const f=clone(fixture);return{state:f.request.observation,steps:f.forecast.continuation,options:{...f.request.options,maxNodes:45000,deadline:Infinity,now:()=>0}};}
function check(q,overrides={}){const work={},result=P.revalidateOpeningForecast(q.state,q.steps,{...q.options,...overrides},work);return{result,work};}
test('opening forecast validation: actual goal-free ordinary J Left refreshes all policy evidence',()=>{
 const q=input(),before=clone({state:q.state,steps:q.steps}),{result,work}=check(q);
 assert.ok(result?.target);assert.equal(work.attempted,true);assert.equal(work.retained,true);assert.equal(work.reason,'ordinary-prefix-revalidated');
 assert.equal(P.resourceGoal(result.continuation),false,'Existing ordinary filler admission does not invent a new commitment goal');
 assert.equal(result.continuation.length,1);assert.equal(result.continuation[0].event.type,'J');assert.ok(result.continuation[0].event.cells.every(([x])=>x<4));
 assert.deepEqual(result.continuation[0].event,q.steps[0].event);assert.equal(result.evidence.resourceObligations.status,'checked');assert.equal(result.evidence.cycleDebt,0);
 assert.equal(result.metrics.certifiedHorizon,1);assert.equal(result.metrics.nodes,work.nodes);assert.ok(work.nodes>0&&work.nodes<=45000);
 assert.deepEqual({state:q.state,steps:q.steps},before);const replay=R.replay(q.state,result.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events[0],result.continuation[0].event);
});
test('opening forecast validation: transported derived metadata cannot supply proof authority',()=>{
 const q=input(),baseline=check(q).result;
 q.state.hiddenQueue=['T','T','T'];q.steps[0].state={board:[]};q.steps[0].resultContext='forged';q.steps[0].gapAccess={reachable:true};
 q.steps[0].structuralEvidence={cycleViolations:[],allocation:'forged-allocation',coveredRepair:{required:false},futureNotches:{valid:true},structure:{regionalSupport:true}};
 q.steps[0].assessment={regionalSupport:true};q.steps[0].evidence={resourceObligations:{status:'checked',binding:'forged'}};
 const {result,work}=check(q);assert.ok(result?.target);assert.equal(work.retained,true);
 assert.deepEqual(result.continuation,baseline.continuation);assert.deepEqual(result.evidence,baseline.evidence);assert.deepEqual(result.assessment,baseline.assessment);
 assert.notEqual(result.continuation[0].structuralEvidence.allocation,'forged-allocation');
});
test('opening forecast validation: malformed history and mismatched event reject without borrowing saved claims',()=>{
 const q=input();q.options.resourceContext.steps[0].action='NOT_AN_INPUT';let checked=check(q);assert.equal(checked.result,null);assert.equal(checked.work.retained,false);assert.equal(checked.work.reason,'resource-history');
 const changed=input();changed.steps[0].event.lines=4;checked=check(changed);assert.equal(checked.result,null);assert.equal(checked.work.reason,'candidate-event');assert.ok(checked.work.nodes>0);
});
test('opening forecast validation: a legal J Right routing candidate cannot become ordinary ST',()=>{
 const q=input(),witness=['HOLD','R','R','HD'],replay=R.replay(q.state,witness);
 assert.equal(replay.valid,true);assert.equal(replay.events.length,1);assert.ok(replay.events[0].cells.some(([x])=>x>=7));
 q.steps=[{witness,event:replay.events[0]}];const {result,work}=check(q);assert.equal(result,null);assert.equal(work.reason,'ordinary-placement');assert.equal(work.retained,false);assert.ok(work.nodes>0);
});
test('opening forecast validation: shared exhaustion and deadline preserve failed proof accounting',()=>{
 for(const overrides of [{maxNodes:0},{deadline:0}]){const {result,work}=check(input(),overrides);assert.equal(result,null);assert.deepEqual(work,{attempted:true,retained:false,nodes:0,reason:'shared-budget'});}
 const tracker={nodes:17},{result,work}=check(input(),{maxNodes:60,budgetTracker:tracker});assert.equal(result,null);assert.equal(work.retained,false);assert.ok(work.nodes>=40&&work.nodes<=60,'Replay reservation and unsuccessful reachability enumeration are charged');assert.equal(tracker.nodes,17+work.nodes);
});
test('opening forecast validation: bounded witnesses and unknown public draws cannot be certified',()=>{
 const q=input();q.steps[0].witness=Array(257).fill('L');let checked=check(q);assert.equal(checked.result,null);assert.equal(checked.work.reason,'candidate-shape');
 const absent=input();absent.state.hold=null;absent.state.queue=[];absent.options.resourceContext=null;absent.options.patternHistory=null;checked=check(absent);assert.equal(checked.result,null);assert.equal(checked.work.retained,false);
 const noHold=check(input(),{allowHold:false});assert.equal(noHold.result,null);assert.equal(noHold.work.reason,'hold-disabled');
});
test('opening forecast validation: incomplete counterfactual endpoint entry is rejected and charged',()=>{
 const {fixtures}=require('./support/st-fixtures.cjs');
 const state=R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']}),witness=['CW','R','R','R','R','HD'],replay=R.replay(state,witness);
 assert.equal(replay.valid,true);assert.equal(P.assess(replay.state.board).right.slots.length,1);
 const work={},result=P.revalidateOpeningForecast(state,[{witness,event:replay.events[0]}],{maxNodes:witness.length+1,now:()=>0,deadline:Infinity},work);
 assert.equal(result,null);assert.equal(work.reason,'endpoint-entry-budget');assert.equal(work.retained,false);assert.equal(work.nodes,witness.length+1,'The incomplete T-entry query consumes the remaining shared node');
});
