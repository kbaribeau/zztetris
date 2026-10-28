'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),P=require('../st-planner');
const fixture=require('./fixtures/forced-bag-resource-binding.json'),clone=x=>JSON.parse(JSON.stringify(x));
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
const bounds={maxNodes:45000,deadline:Infinity,now:()=>0};
function observed(){const f=clone(fixture),state=R.createState(f.observation),history=H.importContext(state,f.options.resourceContext);return{...f,state,history,summary:H.resolve(state,history)};}
function verifyPrefix(state,advice){
 let current=M.extendForced(state);
 for(const step of advice.continuation){const r=R.replay(current,step.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[step.event]);assert.equal(context(r.state),step.resultContext);current=r.state;}
 return current;
}
test('forced bag binding: producer and consumer share one public deduction, without observed identity or allowance',()=>{
 const {state,summary,advice}=observed(),before=clone(state),normalized=M.extendForced(state);
 assert.equal(summary.coverage.status,'complete');assert.equal(B.forcedNext(state.bag),'I');
 assert.deepEqual(normalized.queue,[...state.queue,'I']);assert.deepEqual(normalized.bag,B.consume(state.bag,'I'));
 assert.deepEqual(state,before,'Normalization never mutates the public request');assert.equal(M.extendForced(normalized),normalized,'The consumed deduction cannot be appended twice');
 const raw=M.start(state,summary),canonical=M.start(normalized,summary),checked=M.checkPath(state,advice.continuation,summary);
 assert.notEqual(raw.originKey,advice.evidence.resourceObligations.binding,'Literal old mismatch remains a useful regression control');
 assert.equal(canonical.originKey,advice.evidence.resourceObligations.binding);assert.equal(checked.resource.originKey,canonical.originKey);assert.equal(checked.valid,true);
 assert.deepEqual(canonical.queue.at(-1),{id:-1,type:'I',bag:null});assert.equal(canonical.extraZ,raw.extraZ);
 assert.deepEqual(canonical.hangingS,[{id:21,bag:2,known:true}]);assert.deepEqual(summary.instances.queue.map(p=>p.type),state.queue);
});
test('forced bag binding: the archived Z then S prefix now survives exact retention and result-context replay',()=>{
 const {state,options,advice}=observed(),tracker={nodes:0};
 const retained=P.revalidate(state,advice,{...options,...bounds,budgetTracker:tracker});
 assert.ok(retained?.target,'Previously rejected immediately at the raw resource binding');assert.equal(retained.retained,true);
 assert.deepEqual(retained.target,advice.target);assert.deepEqual(retained.continuation.map(p=>p.event),advice.continuation.map(p=>p.event));
 assert.equal(retained.context,context(state),'Observation binding remains raw, not a projected queue');
 assert.equal(retained.evidence.resourceObligations.binding,advice.evidence.resourceObligations.binding);
 assert.ok(tracker.nodes>0&&tracker.nodes<=45000,'Still performs finite reachability/resource/access validation');verifyPrefix(state,retained);
});
test('forced bag binding: HOLD advancement binds actual swapped identities and Undo restores the old proof',()=>{
 const {state,history,options,advice}=observed(),action=advice.witness[0];assert.equal(action,'HOLD');
 const next=R.move(state,action),nextHistory=H.applyAction(history,state,action,next),nextOptions={...options,...bounds,resourceContext:H.exportContext(next,nextHistory)};
 const advanced=P.advance(next,advice,action,nextOptions);assert.ok(advanced?.target);verifyPrefix(next,advanced);
 assert.notEqual(advanced.evidence.resourceObligations.binding,advice.evidence.resourceObligations.binding,'HOLD changes which observed identity occupies each slot');
 assert.deepEqual(H.resolve(next,nextHistory).instances.active.id,14);assert.equal(H.resolve(next,nextHistory).instances.hold.id,21);
 assert.ok(P.revalidate(next,advanced,nextOptions));assert.equal(P.revalidate(next,advanced,{...nextOptions,resourceContext:options.resourceContext}),null,'Stale pre-HOLD history is not normalized away');
 assert.ok(P.revalidate(state,advice,{...options,...bounds}),'Undo reuses the actual old observation and history');
});
test('forced bag binding: the next actual reveal gets its observed identity, not the synthetic projection id',()=>{
 let {state,history,summary,advice}=observed();const initial=state,virtual=M.checkPath(state,advice.continuation,summary);
 for(const action of advice.witness){const before=state;state=R.move(state,action);
  if(action==='HD'){assert.equal(state.queue.length,5);state={...state,queue:[...state.queue,fixture.nextPublicReveal],bag:B.consume(state.bag,fixture.nextPublicReveal)};}
  history=H.applyAction(history,before,action,state);
 }
 assert.equal(context(state),advice.continuation[0].resultContext,'Actual forced reveal exactly matches the predicted public supply');
 summary=H.resolve(state,history);assert.equal(summary.coverage.status,'complete');assert.equal(B.forcedNext(state.bag),null);
 assert.equal(summary.instances.queue.at(-1).type,'I');assert.equal(summary.instances.queue.at(-1).id,28);assert.equal(summary.instances.queue.at(-1).bag,3);
 const actual=M.start(M.extendForced(state),summary);assert.equal(actual.queue.at(-1).id,28);assert.ok(!actual.queue.some(p=>p.id<0));
 assert.deepEqual(actual.hangingS,[{id:21,bag:2,known:true}]);
 const suffix=M.checkPath(state,advice.continuation.slice(1),summary);assert.equal(suffix.valid,true);assert.deepEqual(suffix.resource.hangingS,[]);assert.deepEqual(virtual.resource.hangingS,[]);
 assert.equal(suffix.resource.extraZ,virtual.resource.extraZ);assert.deepEqual(suffix.state.board,virtual.state.board);
 const wrong={...state,queue:[...state.queue.slice(0,-1),'J']};assert.equal(H.resolve(wrong,H.importContext(wrong,H.exportContext(state,history))).coverage.status,'invalid');
 assert.notEqual(actual.originKey,M.start(M.extendForced(initial),H.resolve(initial,H.importContext(initial,fixture.options.resourceContext))).originKey,'A real reveal requires a newly verified resource binding');
});
test('forced bag binding: wrong deduced piece, invented age, omitted binding inventory and forged history fail closed',()=>{
 const {state,options,advice}=observed();
 for(const mutate of [inventory=>inventory.at(-1).type='J',inventory=>inventory.at(-1).id=28,inventory=>inventory.at(-1).bag=3,inventory=>inventory.pop(),inventory=>inventory[0].id=25]){
  const bad=clone(advice),binding=JSON.parse(bad.evidence.resourceObligations.binding);mutate(binding[2]);bad.evidence.resourceObligations.binding=JSON.stringify(binding);
  const tracker={nodes:0};assert.equal(P.revalidate(state,bad,{...options,...bounds,budgetTracker:tracker}),null);assert.equal(tracker.nodes,0,'The exact binding guard must still reject before search');
 }
 const history=clone(options.resourceContext);history.steps[0].action='TELEPORT';assert.equal(H.resolve(state,H.importContext(state,history)).coverage.status,'invalid');
 assert.equal(P.revalidate(state,advice,{...options,...bounds,resourceContext:history}),null);
 const claims=clone(options.resourceContext);claims.instances={queue:[{id:28,type:'I',bag:3}]};claims.extraZ={status:'available'};
 assert.deepEqual(H.resolve(state,H.importContext(state,claims)),H.resolve(state,H.importContext(state,options.resourceContext)),'Serialized derived identities/allowances have no authority');
});
test('forced bag binding: changed public supply and forged result contexts do not inherit a certificate',()=>{
 const {state,options,advice}=observed();
 for(const mutate of [s=>s.queue[0]='I',s=>s.hold='T',s=>s.bag.remaining=[2],s=>s.board[0]='X.........']){
  const different=clone(state);mutate(different);assert.equal(P.revalidate(different,advice,{...options,...bounds}),null);
  const forged=clone(advice);forged.context=context(different);assert.equal(P.revalidate(different,forged,{...options,...bounds}),null,'Changing the outer context cannot bless another inventory/history');
 }
 const bad=clone(advice),result=JSON.parse(bad.continuation[0].resultContext);result[4][result[4].length-1]='J';bad.continuation[0].resultContext=JSON.stringify(result);
 assert.equal(P.revalidate(state,bad,{...options,...bounds}),null,'Normalization is not permission to ignore saved result contexts');
});
test('forced bag binding: unknown, ambiguous, contradictory or errored bags append nothing',()=>{
 const base=R.createState({active:'S',hold:'S',queue:['J','L','O','T','Z','I']});
 for(const bag of [undefined,B.fromObserved({observed:[...'IJLOST'],startPhase:null}),{remaining:[1,2]},{remaining:[]},{remaining:[128]},{remaining:[1],error:'contradictory-observed-stream'}]){
  const state={...base,...(bag?{bag}:{})},summary=H.resolve(state,H.start(state)),normalized=M.extendForced(state);
  assert.equal(normalized,state);assert.equal(M.checkPath(state,[],summary).resource.queue.length,6);assert.equal(M.start(normalized,summary).extraZ,'unknown');
 }
});
test('forced bag binding: identical-letter HOLD keeps distinct observed identities and unknown age',()=>{
 const state=R.createState({active:'S',hold:'S',queue:['J','L','O','T','Z','I'],bag:{remaining:[1],observedCount:6,provenance:'known-phase'}}),history=H.start(state),summary=H.resolve(state,history);
 const after=R.move(state,'HOLD'),nextHistory=H.applyAction(history,state,'HOLD',after),next=H.resolve(after,nextHistory);
 assert.equal(context(after),context(state),'The letter-only public context cannot distinguish these two instances');
 assert.notEqual(summary.instances.active.id,next.instances.active.id);assert.equal(summary.instances.active.id,next.instances.hold.id);
 const a=M.start(M.extendForced(state),summary),b=M.start(M.extendForced(after),next);assert.notEqual(a.originKey,b.originKey);
 assert.equal(summary.coverage.status,'partial');assert.equal(next.flow.ageKnown,false);assert.equal(a.hold.bag,null);assert.equal(a.queue.at(-1).bag,null);assert.equal(a.extraZ,'unknown');
});

test('forced bag binding: a real committed scoring suffix keeps normalized contexts before a new reveal',()=>{
 const PH=require('../st-pattern-history');
 const f=clone(require('./fixtures/scheduling-selection-roots.json').find(f=>f.seed===2449486415&&f.lock===20));
 const q=f.request,origin=R.createState(q.observation),options={...q.options,...bounds,previous:q.previous,commitment:q.commitment};
 assert.equal(B.forcedNext(origin.bag),'Z');
 let state=origin,history=H.importContext(origin,q.options.resourceContext),pattern=q.options.patternHistory;
 assert.equal(H.resolve(origin,history).coverage.status,'complete');
 const advice=P.decide(origin,options);assert.ok(advice?.target);assert.ok(P.revalidate(origin,advice,options));
 assert.ok(advice.continuation.length>1);assert.equal(P.resourceGoal(advice.continuation.slice(1)),true,'Use a real certified resource goal, not the unrelated S-only filler fixture');
 // Execute only the observed finite supply. No controller refill is simulated:
 // the shorter preview is a valid rules/history snapshot, and Z remains a
 // deduction until actually revealed (covered separately by the I-reveal test).
 for(const action of advice.witness){const before=state;state=R.move(state,action);assert.notEqual(state,before);history=H.applyAction(history,before,action,state);if(action==='HD')pattern=PH.update(pattern,before,state,state.lastEvent);}
 assert.equal(B.forcedNext(state.bag),'Z');assert.equal(state.queue.length,origin.queue.length-1);
 const summary=H.resolve(state,history);assert.equal(summary.coverage.status,'complete');
 const nextOptions={...options,resourceContext:H.exportContext(state,history),patternHistory:pattern};
 const suffix=P.continueCommitment(origin,state,advice,state.lastEvent,nextOptions);assert.ok(suffix?.target);
 assert.deepEqual(suffix.continuation.map(p=>p.event),advice.continuation.slice(1).map(p=>p.event));assert.equal(suffix.context,context(state));
 verifyPrefix(state,suffix);assert.ok(P.revalidate(state,suffix,nextOptions));
 const resources=M.checkPath(state,suffix.continuation,summary);assert.equal(resources.valid,true);assert.equal(suffix.evidence.resourceObligations.binding,resources.resource.originKey);
 const inventory=JSON.parse(resources.resource.originKey)[2];assert.deepEqual(inventory.at(-1),{id:-1,type:'Z',bag:null});
 assert.equal(P.continueCommitment(origin,state,advice,state.lastEvent,{...nextOptions,resourceContext:q.options.resourceContext}),null,'Pre-lock history cannot authenticate the executed suffix');
 const forged=clone(suffix);forged.evidence.resourceObligations.binding+='forged';assert.equal(P.revalidate(state,forged,nextOptions),null);
});
