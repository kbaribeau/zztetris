'use strict';
const {extendPublic}=require('./support/current-resource-test.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('./support/repair-isolated-planner.cjs').planner(),R=require('../st-rules'),B=require('../st-bag'),CurrentProvider=require('../st-resource-provider'),I=require('../st-public-inventory'),HC=require('../st-handoff-continuity'),PH=require('../st-pattern-history'),M=require('../st-obligation-resources'),Ctx=require('../st-obligation-context'),Provider=require('../st-resource-provider'),Current=require('../st-obligation-resources');
const fixture=require('./fixtures/forced-bag-resource-binding.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={maxNodes:45000,deadline:Infinity,now:()=>0},context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
// Literal public pre20/finite Z→S proof from the earlier diagnostic. Only its
// already observed next reveal is applied; no simulation seed/private tape.
function actual({mark=true,actualWitness=null}={}){
 const f=clone(fixture),origin=R.createState(f.observation),advice=f.advice;
 advice.phase='maintenance';advice.evidence.openingHandoff={status:'checked-after-actual-clear',recovery:'shared-after-legacy-budget-miss'};
 let state=origin,history=Ctx.importState(f.options.obligationContext,{position:origin}),pattern=PH.start(origin),event;
 let current=Ctx.importState(f.options.obligationContext,{position:origin});const prior=Ctx.exportState(current);let inventory=current.inventory,execution=HC.start(origin,inventory);
 // This stored route is a policy-isolated candidate, rebuilt under the current
 // handoff boundary rather than trusting its historical serialized binding.
 advice.evidence.resourceObligations.binding=Current.rootBinding(Provider.startRoute(Provider.projectHandoff(Provider.prepare(origin,{obligationContext:prior}))));
 if(mark){history=Ctx.handoff(history,{position:state}).context;current=Ctx.handoff(current,{position:state}).context;execution=HC.markHandoff(execution,state,inventory);}
 for(const action of actualWitness||advice.witness){const before=state;state=R.move(state,action);
  if(action==='HD'){event=state.lastEvent;state={...state,queue:[...state.queue,f.nextPublicReveal],bag:B.consume(state.bag,f.nextPublicReveal)};pattern=PH.update(pattern,before,state,event);}
  const receipt=I.transition(inventory,before,action,state);execution=HC.advance(execution,before,action,state,receipt);inventory=receipt.next;
  current=Ctx.applyActual(current,{before,action,after:state,receipt}).context;history=Ctx.applyActual(history,{before:before,action:action,after:state}).context;
 }
 return{origin,state,history,current,event,advice,options:{...bounds,openingPhase:false,obligationContext:Ctx.exportState(current),patternHistory:pattern,handoffRecovery:{observation:origin,advice,obligationContext:prior,actualEvent:event,continuity:HC.exportConnected(execution)}}};
}
function rejected(q,reason,options={}){
 const a=P.decide(q.state,{...q.options,maxNodes:64,...options});
 if(!a.metrics.handoffRecovery){assert.equal(reason,'resource-state');assert.equal(a.target,null);assert.equal(a.evidence?.resourceObligations?.status,'unavailable');}else{assert.equal(a.metrics.handoffRecovery.retained,false);if(reason)assert.equal(a.metrics.handoffRecovery.reason,reason);}
 assert.ok(a.metrics.nodes<=(options.maxNodes??64));return a;
}
test('handoff bookkeeping (covered-geometry isolated): actual first lock/refill retains only its same observed S payment under the normal boundary',()=>{
 const q=actual(),before={...clone(q.options),deadline:q.options.deadline,now:q.options.now},a=P.decide(q.state,q.options);
 assert.equal(a.metrics.handoffRecovery.retained,true);assert.equal(a.retained,true);assert.equal(a.evidence.handoffRecovery.status,'observed-S-payment-retained');
 assert.equal(a.evidence.handoffRecovery.sId,21);assert.equal(a.evidence.handoffRecovery.bag,2);
 assert.equal(a.continuation.length,1);assert.equal(a.metrics.certifiedHorizon,1);assert.deepEqual(a.target,q.advice.continuation[1].target);
 assert.deepEqual(a.continuation[0].event,q.advice.continuation[1].event);assert.equal(a.context,context(q.state));
 assert.ok(a.metrics.nodes>0&&a.metrics.nodes<=45000);assert.equal(a.metrics.nodes,a.metrics.handoffRecovery.nodes);
 assert.equal(P.resourceGoal(q.advice.continuation),false);assert.equal(P.resourceGoal(a.continuation),false,'No new generic filler goal');
 assert.equal(a.evidence.openingHandoff,undefined,'A consumed routing hint cannot arm another handoff');
 const replay=R.replay(extendPublic(q.state),a.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events,[a.continuation[0].event]);assert.equal(context(replay.state),a.continuation[0].resultContext);
 const summary=CurrentProvider.facts(CurrentProvider.prepare(q.state,{obligationContext:Ctx.exportState(q.history)})),resources=M.checkPath(q.state,a.continuation,q.history);assert.equal(resources.valid,true);assert.deepEqual(resources.resource.hangingS,[]);assert.deepEqual(resources.resource.unclassifiedS,[]);
 assert.notEqual(a.evidence.resourceObligations.binding,q.advice.evidence.resourceObligations.binding,'Actual reveal and mark require current identity binding');
 assert.ok(P.revalidate(q.state,a,{...q.options,handoffRecovery:null}),'Normal existing revalidation still accepts the fresh suffix');assert.deepEqual(q.options,before,'Candidate/history are never mutated');
});
test('handoff bookkeeping (covered-geometry isolated): marker and copied proof flags alone do not acquire source/history/binding authority',()=>{
 const noMarker=actual();delete noMarker.advice.evidence.openingHandoff.recovery;rejected(noMarker,'candidate-shape');
 const noHistory=actual();noHistory.options.handoffRecovery.obligationContext=null;rejected(noHistory,'resource-state');
 const stale=actual();stale.options.obligationContext=stale.options.handoffRecovery.obligationContext;rejected(stale,'resource-state');
 const staleBinding=actual();staleBinding.advice.evidence.resourceObligations.binding=fixture.advice.evidence.resourceObligations.binding;rejected(staleBinding,'origin-resource-binding');
 const forged=actual();forged.advice.evidence.resourceObligations.binding+='forged';rejected(forged,'origin-resource-binding');
 const wrongId=actual(),binding=JSON.parse(wrongId.advice.evidence.resourceObligations.binding);binding[1].hold.id=25;wrongId.advice.evidence.resourceObligations.binding=JSON.stringify(binding);rejected(wrongId,'origin-resource-binding');
 const marked=actual({mark:false});rejected(marked,'history-not-connected');
});
test('handoff bookkeeping (covered-geometry isolated): actual event, connected first witness, bag reveal and actual pose are mandatory',()=>{
 const event=actual();event.options.handoffRecovery.actualEvent={...event.event,lines:2};rejected(event,'actual-lock');
 const bag=actual();bag.state={...bag.state,bag:{...bag.state.bag,remaining:[2]}};rejected(bag,'resource-state');
 const reveal=actual();reveal.state={...reveal.state,queue:[...reveal.state.queue.slice(0,-1),'J']};rejected(reveal,'resource-state');
 const moved=actual(),before=moved.state;moved.state=R.move(before,'R');moved.current=Ctx.applyActual(moved.current,{before,action:'R',after:moved.state}).context;moved.options.obligationContext=Ctx.exportState(moved.current);rejected(moved,'history-not-connected');
 const prefix=actual();prefix.advice.continuation[0].witness=prefix.advice.continuation[0].witness.slice(1);prefix.advice.witness=prefix.advice.continuation[0].witness;prefix.advice.hold=prefix.advice.continuation[0].hold=false;prefix.advice.holdCount=prefix.advice.continuation[0].holdCount=0;rejected(prefix,'origin-prefix');
});
test('handoff bookkeeping (covered-geometry isolated): no extra fillers, non-Left S, wrong witness or fabricated result context',()=>{
 const long=actual();long.advice.continuation.push(clone(long.advice.continuation[1]));rejected(long,'candidate-shape');
 const other=actual();other.advice.continuation[1].event.type='L';rejected(other,'not-immediate-left-S');
 const crossing=actual();crossing.advice.continuation[1].event.cells[0][0]=4;rejected(crossing,'not-immediate-left-S');
 const witness=actual();witness.advice.continuation[1].witness=['HOLD','HD'];rejected(witness,'origin-prefix');
 const result=actual();result.advice.continuation[1].resultContext+='forged';rejected(result,'origin-prefix');
 const flags=actual();flags.advice.continuation[1].hold=false;rejected(flags,'candidate-shape');
});
test('handoff bookkeeping: private fields cannot substitute public supply and malformed native current state fails explicitly',()=>{
 const q=actual();q.state.privateFuture=['S','S'];q.state.privateSeed=999;
 const a=P.decide(q.state,q.options);assert.equal(a.metrics.handoffRecovery.retained,true);assert.equal(a.evidence.handoffRecovery.sId,21);
 const imported=actual();imported.options.obligationContext=Ctx.exportState(Ctx.start(imported.state));rejected(imported,'resource-state');
 const corrupt=actual();corrupt.options.obligationContext.state.sl.residuals='not-current-records';rejected(corrupt,'resource-state');
});
test('handoff bookkeeping (covered-geometry isolated): zero/expired/tiny budgets cannot reuse a cached or serialized certificate',()=>{
 const q=actual();
 for(const opts of [{maxNodes:0},{maxNodes:1},{maxNodes:45000,deadline:0},{maxNodes:45000,deadline:10,now:()=>10}]){const a=rejected(q,'shared-budget',opts);assert.equal(a.target,null);}
 const ordinary=actual();ordinary.options.commitment={};const a=rejected(ordinary,'existing-commitment');assert.equal(a.metrics.handoffRecovery.nodes,0,'Do not override an existing strategic commitment');
});
test('handoff bookkeeping (covered-geometry isolated): incomplete access is charged to the shared request and never promoted to retention',()=>{
 const q=actual(),A=require('../st-access'),access={...require('./support/repair-isolated-planner.cjs').access(),prefix:(_s,_p,o)=>({reachable:null,complete:false,visited:Math.min(20,o.maxNodes),status:'unknown-access-budget'})};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module:mod,require:id=>id==='./st-access.js'?access:require(id.replace('./','../')),Date,performance});
 const a=mod.exports.decide(q.state,{...q.options,maxNodes:128});assert.equal(a.metrics.handoffRecovery.retained,false);assert.equal(a.metrics.handoffRecovery.reason,'origin-access');assert.ok(a.metrics.handoffRecovery.nodes>=20);assert.ok(a.metrics.nodes<=128);assert.equal(a.target,null);
});

test('handoff bookkeeping (covered-geometry isolated): shared capture is a bounded public routing copy, not an eligibility certificate',()=>{
 const q=actual(),prior=q.options.handoffRecovery.obligationContext,captured=P.captureHandoffRecovery({...q.origin,privateFuture:['S'],privateSeed:1},q.advice,prior);
 assert.ok(captured);assert.equal(captured.observation.privateFuture,undefined);assert.equal(captured.observation.privateSeed,undefined);assert.deepEqual(captured.advice,q.advice);assert.deepEqual(captured.obligationContext,prior);
 assert.notEqual(captured.advice,q.advice);assert.notEqual(captured.obligationContext,prior);assert.equal(captured.obligationContext.state.sl.handoff,false,'Capture precedes the actual handoff marker');
 assert.equal(P.captureHandoffRecovery(q.origin,q.advice,q.options.obligationContext),null,'An already-marked mid-piece reply must preserve, not replace, the original capture');
 const ordinary=clone(q.advice);delete ordinary.evidence.openingHandoff.recovery;assert.equal(P.captureHandoffRecovery(q.origin,ordinary,prior),null);
 const long=clone(q.advice);long.continuation.push(clone(long.continuation[1]));assert.equal(P.captureHandoffRecovery(q.origin,long,prior),null);
 const cyclic=clone(q.advice);cyclic.loop=cyclic;assert.equal(P.captureHandoffRecovery(q.origin,cyclic,prior),null);
 const huge=clone(q.advice);huge.padding='x'.repeat(1048577);assert.equal(P.captureHandoffRecovery(q.origin,huge,prior),null);
 assert.equal(P.captureHandoffRecovery(q.origin,q.advice,null),null,'Unavailable current facts cannot create a handoff capture');
});

test('handoff bookkeeping (covered-geometry isolated): a different legal route to the same actual first lock preserves identity, not exact input tape',()=>{
 const q=actual({actualWitness:['L','R',...fixture.advice.witness]}),a=P.decide(q.state,q.options);
 assert.equal(a.metrics.handoffRecovery.retained,true);assert.equal(a.evidence.handoffRecovery.sId,21);assert.deepEqual(a.target,q.advice.continuation[1].target);
 assert.equal(q.options.handoffRecovery.continuity.actions,q.advice.witness.length+2);
 const disconnected=actual();disconnected.options.handoffRecovery.obligationContext.inventory.active.id++;rejected(disconnected,'resource-state');
});

test('handoff production: archived observed-S payment is rejected for its actual unresolved roof',()=>{
 const q=actual(),real=require('../st-planner'),A=require('../st-access');
 const proof=A.repairPrefix(extendPublic(q.origin),q.advice.continuation);assert.equal(proof.valid,false);assert.deepEqual(proof.outstandingCells,[[2,31]]);
 assert.equal(real.revalidate(q.origin,q.advice,{...fixture.options,...bounds}),null);
 const result=real.decide(q.state,q.options);assert.equal(result.metrics.handoffRecovery.retained,false);
});

test('handoff test seam: actual geometry module stays rejecting and malformed proofs remain invalid',()=>{
 const A=require('../st-access'),isolated=require('./support/repair-isolated-planner.cjs').access(),q=actual();
 assert.equal(A.repairPrefix(q.origin,q.advice.continuation).valid,false);
 assert.equal(isolated.repairPrefix(q.origin,q.advice.continuation).valid,true);
 assert.equal(A.repairPrefix(q.origin,q.advice.continuation).valid,false);
 assert.equal(isolated.repairPrefix(q.origin,[{witness:['TELEPORT']}]).valid,false);
});

test('handoff bookkeeping (covered-geometry isolated): same-pose HOLD cycle counts actual execution without repeating it',()=>{
 const q=actual({actualWitness:['HOLD','HOLD',...fixture.advice.witness]}),a=P.decide(q.state,q.options);
 assert.equal(a.metrics.handoffRecovery.retained,true);assert.equal(q.options.handoffRecovery.continuity.actions,q.advice.witness.length+2);
 assert.deepEqual(a.target,q.advice.continuation[1].target);assert.equal(a.evidence.handoffRecovery.sId,21);
});

test('handoff bookkeeping: no connector, copied boolean and wrong live identity cannot promote future advice',()=>{
 const missing=actual();delete missing.options.handoffRecovery.continuity;rejected(missing,'history-not-connected');
 const boolean=actual();boolean.options.handoffRecovery.continuity={marked:true};rejected(boolean,'history-not-connected');
 const identity=actual();identity.options.handoffRecovery.continuity.currentSupply.active.id++;rejected(identity,'history-not-connected');
 const expired=actual();expired.options.handoffRecovery.continuity.actions=257;rejected(expired,'history-not-connected');
});

test('handoff production Worker: controller-exported JSON remains subject to the unresolved-roof rejection',()=>{
 const q=actual(),worker=require('../scripts/lib/st-simulation.cjs').workerPlanner();
 const result=worker(clone({type:'plan',id:81,observation:q.state,previous:null,commitment:null,options:{...q.options,maxNodes:128,timeMs:1500}}));
 assert.equal(result.metrics.handoffRecovery.retained,false);assert.equal(result.metrics.handoffRecovery.reason,'origin-resource-proof');assert(result.metrics.nodes<=128);
});
