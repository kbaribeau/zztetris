'use strict';
const {extendPublic}=require('./support/current-resource-test.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources'),P=require('../st-planner');
const N=require('../st-obligation-resources'),Provider=require('../st-resource-provider');
const currentRoot=(state,options)=>Provider.startRoute(Provider.prepare(state,options));
const fixture=require('./fixtures/forced-bag-resource-binding.json'),clone=x=>JSON.parse(JSON.stringify(x));
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
const bounds={maxNodes:45000,deadline:Infinity,now:()=>0};
function observed(){const f=clone(fixture),state=R.createState(f.observation),history=Current.importState(f.options.obligationContext,{position:state});f.advice.evidence.resourceObligations.binding=Provider.binding(Provider.prepare(state,f.options));return{...f,state,history,summary:CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}))};}
function verifyPrefix(state,advice){
 let current=extendPublic(state);
 for(const step of advice.continuation){const r=R.replay(current,step.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[step.event]);assert.equal(context(r.state),step.resultContext);current=r.state;}
 return current;
}
test('forced bag binding: producer and consumer share one public deduction, without observed identity or allowance',()=>{
 const {state,summary,advice}=observed(),before=clone(state),normalized=extendPublic(state);
 assert.equal(summary.availability,'known');assert.equal(B.forcedNext(state.bag),'I');
 assert.deepEqual(normalized.queue,[...state.queue,'I']);assert.deepEqual(normalized.bag,B.consume(state.bag,'I'));
 assert.deepEqual(state,before,'Normalization never mutates the public request');
 const input=Provider.prepare(state,{obligationContext:fixture.options.obligationContext}),raw=Provider.startRoute(input,{extendForced:false}),canonical=Provider.startRoute(input),checked=M.checkPath(state,advice.continuation,input.context);
 assert.deepEqual(require('../st-obligation-projection').extendForced(canonical.route.projection).position,normalized,'The consumed deduction cannot be appended twice inside its finite projection');
 assert.equal(N.rootBinding(raw),advice.evidence.resourceObligations.binding,'Literal current binding excludes speculative forced supply');
 assert.equal(N.rootBinding(canonical),advice.evidence.resourceObligations.binding);assert.equal(N.rootBinding(checked.resource),N.rootBinding(canonical));assert.equal(checked.valid,true);
 assert.deepEqual(canonical.queue.at(-1),{id:-1,type:'I',bag:null});assert.equal(canonical.extraZ,raw.extraZ);
 assert.deepEqual(canonical.hangingS,[{id:21,bag:2,known:true}]);assert.deepEqual(summary.instances.queue.map(p=>p.type),state.queue);
});
test('forced bag bookkeeping (covered-geometry isolated): archived prefix exact retention and result-context replay',()=>{
 const P=require('./support/repair-isolated-planner.cjs').planner();
 const {state,options,advice}=observed(),tracker={nodes:0};
 const retained=P.revalidate(state,advice,{...options,...bounds,budgetTracker:tracker});
 assert.ok(retained?.target,'Previously rejected immediately at the raw resource binding');assert.equal(retained.retained,true);
 assert.deepEqual(retained.target,advice.target);assert.deepEqual(retained.continuation.map(p=>p.event),advice.continuation.map(p=>p.event));
 assert.equal(retained.context,context(state),'Observation binding remains raw, not a projected queue');
 assert.equal(retained.evidence.resourceObligations.binding,N.rootBinding(currentRoot(state,options)));assert.equal(retained.evidence.resourceObligations.binding,advice.evidence.resourceObligations.binding,'Native candidate retains the exact current fact binding');
 assert.ok(tracker.nodes>0&&tracker.nodes<=45000,'Still performs finite reachability/resource/access validation');verifyPrefix(state,retained);
});
test('forced bag bookkeeping (covered-geometry isolated): HOLD identities and Undo restore the old binding',()=>{
 const P=require('./support/repair-isolated-planner.cjs').planner();
 const {state,history,options,advice}=observed(),action=advice.witness[0];assert.equal(action,'HOLD');
 const next=R.move(state,action),nextHistory=Current.applyActual(history,{before:state,action:action,after:next}).context,nextOptions={...options,...bounds,obligationContext:Current.exportState(nextHistory)};
 const advanced=P.advance(next,advice,action,nextOptions);assert.ok(advanced?.target);verifyPrefix(next,advanced);
 assert.notEqual(advanced.evidence.resourceObligations.binding,advice.evidence.resourceObligations.binding,'HOLD changes which observed identity occupies each slot');
 assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(next,{obligationContext:Current.exportState(nextHistory)})).instances.active.id,14);assert.equal(CurrentProvider.facts(CurrentProvider.prepare(next,{obligationContext:Current.exportState(nextHistory)})).instances.hold.id,21);
 assert.ok(P.revalidate(next,advanced,nextOptions));assert.equal(P.revalidate(next,advanced,{...nextOptions,obligationContext:options.obligationContext}),null,'Stale pre-HOLD history is not normalized away');
 assert.ok(P.revalidate(state,advice,{...options,...bounds}),'Undo reuses the actual old observation and history');
});
test('forced bag binding: the next actual reveal gets its observed identity, not the synthetic projection id',()=>{
 let {state,history,summary,advice}=observed();const initial=state,virtual=M.checkPath(state,advice.continuation,history);
 for(const action of advice.witness){const before=state;state=R.move(state,action);
  if(action==='HD'){assert.equal(state.queue.length,5);state={...state,queue:[...state.queue,fixture.nextPublicReveal],bag:B.consume(state.bag,fixture.nextPublicReveal)};}
  history=Current.applyActual(history,{before:before,action:action,after:state}).context;
 }
 assert.equal(context(state),advice.continuation[0].resultContext,'Actual forced reveal exactly matches the predicted public supply');
 summary=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.equal(summary.availability,'known');assert.equal(B.forcedNext(state.bag),null);
 assert.equal(summary.instances.queue.at(-1).type,'I');assert.equal(summary.instances.queue.at(-1).id,28);assert.equal(summary.instances.queue.at(-1).bag,3);
 const actual=M.start(state,history);assert.equal(actual.queue.at(-1).id,28);assert.ok(!actual.queue.some(p=>p.id<0));
 assert.deepEqual(actual.hangingS,[{id:21,bag:2,known:true}]);
 const suffix=M.checkPath(state,advice.continuation.slice(1),history);assert.equal(suffix.valid,true);assert.deepEqual(suffix.resource.hangingS,[]);assert.deepEqual(virtual.resource.hangingS,[]);
 assert.equal(suffix.resource.extraZ,virtual.resource.extraZ);assert.deepEqual(suffix.state.board,virtual.state.board);
 const wrong={...state,queue:[...state.queue.slice(0,-1),'J']};assert.equal(Provider.prepare(wrong,{obligationContext:Current.exportState(history)}).status,'unavailable');
 assert.notEqual(N.rootBinding(actual),N.rootBinding(currentRoot(initial,fixture.options)),'A real reveal requires a newly verified resource binding');

});
test('forced bag binding: forged current resource key and malformed current accounting fail closed',()=>{
 const {state,options,advice}=observed(),current={...clone(advice),evidence:{...advice.evidence,resourceObligations:{...advice.evidence.resourceObligations,binding:N.rootBinding(currentRoot(state,options))}}};
 for(const suffix of ['forged',' ',':28',':unknown']){
  const bad=clone(current);bad.evidence.resourceObligations.binding+=suffix;
  const tracker={nodes:0};assert.equal(P.revalidate(state,bad,{...options,...bounds,budgetTracker:tracker}),null);assert.equal(tracker.nodes,0,'Current keys must reject before search');
 }
 const history=clone(options.obligationContext);history.inventory.queue[0].id=history.inventory.active.id;assert.equal(Provider.prepare(state,{obligationContext:history}).status,'unavailable');
 assert.equal(P.revalidate(state,advice,{...options,...bounds,obligationContext:history}),null);
 const claims=clone(options.obligationContext);claims.instances={queue:[{id:28,type:'I',bag:3}]};claims.extraZ={status:'available'};
 assert.equal(Provider.prepare(state,{obligationContext:claims}).status,'unavailable','Unexpected historical annotation fields do not belong to current Context');
 const old=clone(advice);old.evidence.resourceObligations.binding=fixture.advice.evidence.resourceObligations.binding;assert.equal(P.revalidate(state,old,{...options,...bounds}),null,'Obsolete historical binding is not current authority');
 assert.equal(N.rootBinding(currentRoot(state,options)),Provider.binding(Provider.prepare(state,options)),'Current request binding is literal and does not invent a forced observed identity');
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
 for(const bag of [undefined,B.fromObserved({observed:[...'IJLOST'],startPhase:null}),{remaining:[1,2]},{remaining:[],error:'contradictory-observed-stream'}]){
  const state={...base,...(bag?{bag}:{})},normalized=extendPublic(state);
  assert.deepEqual(normalized,state);const resource=M.startUnknown(state);assert.equal(resource.queue.length,6);assert.equal(resource.extraZ,'unknown');

 }
 for(const bag of [{remaining:[]},{remaining:[128]},{remaining:[1],error:'contradictory-observed-stream'}]){const state={...base,bag};assert.throws(()=>M.startUnknown(state),/unknown public origin/);assert.equal(Provider.prepare(state).status,'unavailable');}
});
test('forced bag binding: identical-letter HOLD keeps distinct observed identities and unknown age',()=>{
 const state=R.createState({active:'S',hold:'S',queue:['J','L','O','T','Z','I'],bag:{remaining:[1],observedCount:6,provenance:'known-phase'}}),history=Current.start(state),summary=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));
 const after=R.move(state,'HOLD'),nextHistory=Current.applyActual(history,{before:state,action:'HOLD',after:after}).context,next=CurrentProvider.facts(CurrentProvider.prepare(after,{obligationContext:Current.exportState(nextHistory)}));
 assert.equal(context(after),context(state),'The letter-only public context cannot distinguish these two instances');
 assert.notEqual(summary.instances.active.id,next.instances.active.id);assert.equal(summary.instances.active.id,next.instances.hold.id);
 const a=M.start(state,history),b=M.start(after,nextHistory);assert.notEqual(N.rootBinding(a),N.rootBinding(b));
 assert.equal(summary.availability,'unknown');assert.equal(nextHistory.inventory.originKnown,false);assert.equal(a.hold.bag,null);assert.equal(a.queue.at(-1).bag,null);assert.equal(a.extraZ,'unknown');
});

test('forced bag binding: a real committed scoring suffix keeps normalized contexts before a new reveal',()=>{
 const PH=require('../st-pattern-history');
 const f=clone(require('./fixtures/scheduling-selection-roots.json').find(f=>f.seed===2449486415&&f.lock===20));
 const q=f.request,origin=R.createState(q.observation),options={...q.options,...bounds,previous:q.previous,commitment:q.commitment};
 assert.equal(B.forcedNext(origin.bag),'Z');
 let state=origin,history=Current.importState(q.options.obligationContext,{position:origin}),pattern=q.options.patternHistory;
 assert.equal(CurrentProvider.facts(CurrentProvider.prepare(origin,{obligationContext:Current.exportState(history)})).availability,'known');
 const advice=P.decide(origin,options);assert.ok(advice?.target);assert.ok(P.revalidate(origin,advice,options));
 assert.ok(advice.continuation.length>1);assert.equal(P.resourceGoal(advice.continuation.slice(1)),true,'Use a real certified resource goal, not the unrelated S-only filler fixture');
 // Execute only the observed finite supply. No controller refill is simulated:
 // the shorter preview is a valid rules/history snapshot, and Z remains a
 // deduction until actually revealed (covered separately by the I-reveal test).
 for(const action of advice.witness){const before=state;state=R.move(state,action);assert.notEqual(state,before);history=Current.applyActual(history,{before:before,action:action,after:state}).context;if(action==='HD')pattern=PH.update(pattern,before,state,state.lastEvent);}
 assert.equal(B.forcedNext(state.bag),'Z');assert.equal(state.queue.length,origin.queue.length-1);
 const summary=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.equal(summary.availability,'known');
 const nextOptions={...options,obligationContext:Current.exportState(history),patternHistory:pattern};
 const suffix=P.continueCommitment(origin,state,advice,state.lastEvent,nextOptions);assert.ok(suffix?.target);
 assert.deepEqual(suffix.continuation.map(p=>p.event),advice.continuation.slice(1).map(p=>p.event));assert.equal(suffix.context,context(state));
 verifyPrefix(state,suffix);assert.ok(P.revalidate(state,suffix,nextOptions));
 const resources=M.checkPath(state,suffix.continuation,history);assert.equal(resources.valid,true);assert.equal(suffix.evidence.resourceObligations.binding,N.rootBinding(currentRoot(state,nextOptions)));
 assert.deepEqual(currentRoot(state,nextOptions).queue.at(-1),{id:-1,type:'Z',bag:null});
 assert.equal(P.continueCommitment(origin,state,advice,state.lastEvent,{...nextOptions,obligationContext:q.options.obligationContext}),null,'Pre-lock history cannot authenticate the executed suffix');
 const forged=clone(suffix);forged.evidence.resourceObligations.binding+='forged';assert.equal(P.revalidate(state,forged,nextOptions),null);
});
