'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),H=require('../st-resource-history');
const E=require('../scripts/lib/st-simulation.cjs'),fixture=require('./fixtures/opening-z-allocation.json');
function replay(advice){
 let state=R.createState(fixture.request.observation),history=H.importContext(state,fixture.request.options.resourceContext),pattern=S.notchPattern(state.board);
 for(const step of advice.continuation){const before=state,proof=R.replay(state,step.witness);assert(proof.valid);assert.deepEqual(proof.events[0],step.event);
  for(const action of step.witness){const next=R.move(state,action);history=H.applyAction(history,state,action,next);state=next;}
  assert.equal(H.resolve(state,history).coverage.status,'complete');const n=S.advanceNotches(before.board,{state,event:step.event},pattern);assert(n.valid);pattern=n.pattern;
  assert.deepEqual(P.cavityRepairDebt(P.assess(before.board),P.assess(state.board),step.event),[]);
 }
 return{state,history,summary:H.resolve(state,history)};
}
test('opening allocation: actual workers discover the visible Z/J route and pay the held S at unchanged live limits',()=>{
 const advice=E.workerPlanner()(fixture.request);assert(advice.target);assert.equal(advice.target.type,'Z');
 assert(advice.continuation[0].event.cells.every(([x])=>x>=4&&x<7));
 assert.equal(advice.metrics.openingAllocation.requiredNonRightZ,1);assert.equal(advice.metrics.allocationCompletion.complete,true);
 assert(advice.metrics.nodes<=fixture.request.options.maxNodes);assert.equal(fixture.request.options.maxNodes,45000);assert.equal(fixture.request.options.timeMs,1500);
 let {state,history,summary}=replay(advice);assert.deepEqual(S.geometry(state.board).center.profile,[9,9,9]);assert.equal(S.geometry(state.board).left.covered,0);
 assert.equal(summary.openingAllocation.status,'verified-first-tsd');assert.equal(summary.openingAllocation.checkpoint.counts.TNonRight,2);assert.equal(summary.openingAllocation.checkpoint.counts.ZNonRight,1);
 if(summary.hangingS.status==='hanging'){
  assert.equal(summary.extraZ.status,'unknown');assert.equal(state.hold,'S');assert.equal(summary.hangingS.evidence.length,1);
  const next=E.workerPlanner()({type:'plan',id:2,observation:E.publicObservation(state),previous:null,commitment:null,options:{...fixture.request.options,openingPhase:false,openingClear:null,resourceContext:H.exportContext(state,history),patternHistory:P.startPatternHistory(state)}});
  assert.equal(next.target.type,'S');assert(next.continuation[0].event.cells.every(([x])=>x<4));assert(next.metrics.nodes<=45000);
  for(const action of next.witness){const after=R.move(state,action);history=H.applyAction(history,state,action,after);state=after;}summary=H.resolve(state,history);
 }
 assert.equal(summary.extraZ.status,'available');assert.equal(summary.hangingS.status,'none-observed');assert.equal(summary.hangingL.status,'none-observed');assert.deepEqual(summary.center.pending,[]);assert.deepEqual(summary.center.debt,[]);
 assert.match(advice.reason,/still-required opening Z/);
});
test('opening allocation: TSD first carries the Z debt, then actual Z/J completion permits historical handoff',()=>{
 const O=require('../st-opening');let state=R.createState(fixture.request.observation),history=H.importContext(state,fixture.request.options.resourceContext),pattern=fixture.request.options.patternHistory,opening={active:true,clear:null,source:null,repair:null};
 const execute=witness=>{for(const action of witness){const after=R.move(state,action);history=H.applyAction(history,state,action,after);assert.equal(H.resolve(after,history).coverage.status,'complete');if(action==='HD'){pattern=P.updatePatternHistory(pattern,state,after,after.lastEvent);opening=P.updateOpeningSession(opening,state,after,after.lastEvent);}state=after;}};
 execute(['L','L','L','HD']);execute(fixture.steps[1].witness); // actual S17, then TSD18
 assert.equal(H.resolve(state,history).openingAllocation.requiredNonRightZ,1);assert.equal(H.resolve(state,history).extraZ.status,'unknown');
 assert.equal(O.handoff(state,opening.clear,{...fixture.request.options,resourceContext:H.exportContext(state,history)}),null,'The scoring event does not erase an observed allocation obligation');
 const request=id=>({type:'plan',id,observation:E.publicObservation(state),previous:null,commitment:null,options:{...fixture.request.options,patternHistory:pattern,resourceContext:H.exportContext(state,history),openingPhase:opening.active,openingClear:opening.clear,openingRepair:opening.repair,openingSource:opening.source}});
 for(const type of ['Z','J']){const advice=E.workerPlanner()(request(type==='Z'?19:20));assert.equal(advice.target.type,type);assert(advice.continuation[0].event.cells.every(([x])=>x>=4&&x<7));assert.equal(advice.phase,'opening');assert(advice.metrics.nodes<=45000);execute(advice.witness);if(type==='Z'){assert.equal(H.resolve(state,history).extraZ.status,'unknown');assert.equal(H.resolve(state,history).extraZ.allocations.length,0);}}
 const summary=H.resolve(state,history);assert.equal(summary.openingAllocation.firstTsdAt,18);assert.equal(summary.openingAllocation.completedAt,19);assert.equal(summary.extraZ.baseline.qualityAt,20);assert.equal(summary.extraZ.status,'available');assert.equal(opening.clear,null);
 const handoff=E.workerPlanner()(request(21));assert(handoff.target);assert.equal(handoff.phase,'maintenance');assert.equal(handoff.evidence.openingHandoff.status,'checked-after-observed-opening-quality');assert.equal(P.acceptOpeningResult(opening,handoff).active,false);
 const unknown=H.start(state);assert.equal(O.handoff(state,null,{...fixture.request.options,resourceContext:H.exportContext(state,unknown),openingAllocation:summary.openingAllocation}),null,'The same geometry and a forged summary cannot invent historical handoff proof');
});
test('opening allocation: a cutoff cannot replace the completed nominal prefix with a partial extra layer',()=>{
 const options={...fixture.request.options,deadline:Infinity,maxNodes:12000};
 const nominal=P.plan(fixture.request.observation,{...options,disableOpeningAllocationCompletion:true}),cutoff=P.plan(fixture.request.observation,options);
 assert.equal(cutoff.metrics.allocationCompletion.complete,false);assert.equal(cutoff.metrics.allocationCompletion.selected,false);assert.equal(cutoff.metrics.completeDepth,3);
 assert.deepEqual(cutoff.target,nominal.target);assert.deepEqual(cutoff.continuation,nominal.continuation);assert(cutoff.metrics.nodes<=options.maxNodes);replay(cutoff);
});
test('opening allocation: priority and equal-horizon partner completion each have observable effects',()=>{
 const options={...fixture.request.options,deadline:Infinity};
 const disabled=P.plan(fixture.request.observation,{...options,disableOpeningAllocation:true});
 const nominal=P.plan(fixture.request.observation,{...options,disableOpeningAllocationCompletion:true});
 const completed=P.plan(fixture.request.observation,options);
 assert.equal(disabled.target.type,'S');assert.equal(nominal.target.type,'Z');assert(nominal.continuation[0].event.cells.every(([x])=>x<4));
 assert(completed.continuation[0].event.cells.every(([x])=>x>=4&&x<7));assert.equal(completed.metrics.allocationCompletion.nominalDepth,3);assert.equal(completed.metrics.allocationCompletion.comparisonDepth,4);assert(completed.metrics.allocationCompletion.beamWidth>1);
 assert.equal(completed.continuation.length,4);assert.equal(completed.metrics.allocationCompletion.selected,true);replay(completed);
});
test('opening allocation: an expired extra-layer clock retains the completed nominal advice',()=>{
 const deadline=10000000;let calls=0;
 const nominal=P.plan(fixture.request.observation,{...fixture.request.options,deadline,now:()=>++calls,disableOpeningAllocationCompletion:true});
 calls=0;const interrupted=P.plan(fixture.request.observation,{...fixture.request.options,deadline,now:()=>++calls>=1300?deadline:calls});
 assert.equal(interrupted.metrics.allocationCompletion.complete,false);assert.equal(interrupted.metrics.allocationCompletion.selected,false);assert.equal(interrupted.metrics.completeDepth,3);
 assert.deepEqual(interrupted.target,nominal.target);assert.deepEqual(interrupted.continuation,nominal.continuation);replay(interrupted);
});
test('opening allocation: unknown history and fabricated allocation summaries do not invent an opening debt',()=>{
 const {resourceContext,...options}=fixture.request.options;
 const plain=P.plan(fixture.request.observation,{...options,deadline:Infinity}),forged=P.plan({...fixture.request.observation,openingAllocation:{requiredNonRightZ:1}},{...options,deadline:Infinity,openingAllocation:{requiredNonRightZ:1}});
 assert.equal(plain.metrics.openingAllocation.requiredNonRightZ,null);assert.equal(plain.metrics.allocationCompletion,undefined);assert.equal(forged.metrics.openingAllocation.requiredNonRightZ,null);assert.deepEqual(forged.target,plain.target);assert.deepEqual(forged.continuation,plain.continuation);
});
test('opening allocation: zero allowance still abstains before the new priority or extension can search',()=>{
 const advice=P.plan(fixture.request.observation,{...fixture.request.options,timeMs:0,maxNodes:0});assert.equal(advice.target,null);assert.equal(advice.metrics.nodes,0);
});
