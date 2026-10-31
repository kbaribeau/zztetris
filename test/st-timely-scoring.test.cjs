'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),RH=require('../st-resource-history');
const fixture=require('./fixtures/timely-scoring.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={depth:3,width:8,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
function decide(q=fixture.request,extra={}){return P.decide(q.observation,{...q.options,...bounds,commitment:q.commitment,...extra});}
function replay(raw,advice){let state=R.createState(raw);for(const p of advice.continuation){const r=R.replay(state,p.witness);assert(r.valid);assert.equal(r.events.length,1);assert.deepEqual(r.events[0],p.event);assert(S.canonicalClear(p.event));state=r.state;}return state;}

test('timely scoring: a heuristic-only O/J replacement cannot postpone the executable TSD',()=>{
 const q=fixture.request,old=decide(q,{disableTimelyScoring:true}),a=decide(q);
 assert.equal(old.metrics.commitmentComparison.replacement,true);assert.equal(old.metrics.commitmentComparison.freshGoalLocks,3);assert.equal(old.continuation[0].event.type,'O');
 assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.spin,'full');assert.equal(a.continuation[0].event.lines,2);assert.equal(a.hold,false);
 assert.equal(a.metrics.commitmentComparison.replacement,false);assert.equal(a.metrics.commitmentComparison.scoringTiming.reason,'delay-without-concrete-benefit');
 assert.deepEqual(a.metrics.commitmentComparison.scoringTiming.required,{tsds:[1],quads:[]});
 assert.equal(a.metrics.commitmentComparison.scoringTiming.endpoint.fresh.maxHeight,14);assert.equal(a.metrics.commitmentComparison.scoringTiming.endpoint.saved.maxHeight,13);
 assert(a.metrics.nodes<=45000);assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);replay(q.observation,a);replay(q.observation,old);
});

test('timely scoring: a sound goal remains executable from an actual moved pose',()=>{
 const q=clone(fixture.request),before=R.createState(q.observation),history=RH.importContext(before,q.options.resourceContext),moved=R.move(before,'R');assert.notDeepEqual(moved.active,q.observation.active);q.observation=P.observe(moved);q.options.resourceContext=RH.exportContext(moved,RH.applyAction(history,before,'R',moved));
 const a=decide(q);assert(a.target,a.reason);assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.lines,2);replay(q.observation,a);
});

test('timely scoring: HOLD does not erase a reachable saved T goal or invent a new draw',()=>{
 const q=clone(fixture.request),before=R.createState(q.observation),history=RH.importContext(before,q.options.resourceContext),held=R.move(before,'HOLD');
 assert.equal(held.active.type,'O');assert.equal(held.hold,'T');assert.deepEqual(held.queue,before.queue);
 q.observation=P.observe(held);q.options.resourceContext=RH.exportContext(held,RH.applyAction(history,before,'HOLD',held));
 const a=decide(q);assert(a.target,a.reason);assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.lines,2);assert.equal(a.hold,true);replay(q.observation,a);
});

test('timely scoring: imported comparison flags cannot grant permission or revive a forged proof',()=>{
 const q=clone(fixture.request);q.commitment.advice.metrics={commitmentComparison:{replacement:true,scoringTiming:{allowed:true,reason:'verified-endpoint-dominance'}}};
 const a=decide(q);assert.equal(a.continuation[0].event.type,'T');assert.equal(a.metrics.commitmentComparison.replacement,false);
 q.commitment.advice.continuation[0].witness=['HD'];const noCommit=decide({...q,commitment:null}),forged=decide(q);
 assert.deepEqual(forged.target,noCommit.target);assert.equal(forged.metrics.commitmentComparison,undefined);if(forged.target)replay(q.observation,forged);
});

test('timely scoring: interrupted work cannot use a delayed fallback in place of the saved goal',()=>{
 for(const maxNodes of [0,500,4000]){const a=decide(fixture.request,{maxNodes});assert(a.metrics.nodes<=maxNodes);if(a.target){assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.lines,2);replay(fixture.request.observation,a);}else assert.match(a.status,/budget|supported/);}
});

// Contract unit cases deliberately use abstract already-checked endpoints.
// They test the replacement predicate, not availability of a physical repair.
const step=(type,lines=0)=>({event:{type,lines,spin:type==='T'&&lines===2?'full':'none'}}),T=()=>step('T',2),Q=()=>step('I',4),F=()=>step('O');
function node(path,{height=10,mass=40,sealed=0,covered=0,continuity=0}={}){return{path,state:{board:['X'.repeat(mass)]},assessment:{maxHeight:height,sealed,structure:{left:{covered}}},centerContinuity:continuity};}

test('timely scoring contract: same or earlier per-type scoring keeps the ordinary ranking path',()=>{
 const goal=node([F(),T(),Q()]);assert.equal(P.scoringReplacement(node([T(),F(),Q()]),node([F(),T(),Q()]),goal).allowed,true);
 assert.equal(P.scoringReplacement(node([T()]),node([T()]),node([T()])).reason,'no-protected-score-delay');
});

test('timely scoring contract: tangible same-horizon height or mass dominance can justify delay',()=>{
 const goal=node([T()]),saved=node([T(),F(),F()]);
 const shorter=node([F(),F(),T()],{height:9});assert.equal(P.scoringReplacement(shorter,saved,goal).reason,'endpoint-dominance');
 const clearer=node([F(),T(),Q()],{mass:0});assert.equal(P.scoringReplacement(clearer,saved,goal).allowed,true);
 for(const bad of [{height:9,mass:44},{height:11,mass:0},{height:9,covered:1},{height:9,sealed:1},{height:9,continuity:-1}])assert.equal(P.scoringReplacement(node([F(),F(),T()],bad),saved,goal).allowed,false);
 assert.equal(P.scoringReplacement(node([F(),T()],{height:9}),saved,goal).allowed,false);
});

test('timely scoring contract: mixed late resource goals cannot hide an earlier TSD delay',()=>{
 const pocket={event:{type:'I',lines:0,cells:[[9,35]]},structuralEvidence:{allocation:'quad-preparation'}};
 const goal=node([T(),F(),pocket]),fresh=node([F(),T(),pocket]);
 assert.equal(P.resourceGoalPrefix(fresh.path,goal.path),3);assert.equal(P.resourceGoalPrefix(goal.path,goal.path),3);
 assert.equal(P.scoringReplacement(fresh,goal,goal).allowed,false);
});

test('timely scoring contract: quad, TSD, repeated scores and post-goal filler retain separate clocks',()=>{
 const goal=node([T(),Q(),T()]),a=P.scoringReplacement(node([Q(),T(),T()]),goal,goal);assert.equal(a.allowed,false);assert.deepEqual(a.delayed,[{kind:'tsds',index:1,savedLock:1,freshLock:2}]);
 const later=P.scoringReplacement(node([T(),F(),Q(),T()]),node([T(),Q(),T(),F()]),goal);assert.equal(later.allowed,false);assert.equal(later.delayed.length,2);
 assert.deepEqual(P.scoringSchedule([T(),F(),Q(),F()]),{tsds:[1],quads:[3]});
 assert.equal(P.scoringReplacement(node([Q(),F(),Q()],{height:1,mass:0}),goal,goal).reason,'missing-protected-score');
});
