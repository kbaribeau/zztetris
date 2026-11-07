'use strict';
const equivalent=require('./support/st-equivalent-s.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),M=require('../st-obligation-resources'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),R=require('../st-rules'),S=require('../st-structure'),q=require('./fixtures/pending-L-visible-stage.json'),f=require('./fixtures/pending-L-refill.json'),route=require('./fixtures/covered-repair-plan.json').ordinaryCenter,clone=x=>JSON.parse(JSON.stringify(x));
const bounds={maxNodes:45000,now:()=>0,deadline:Infinity};
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
function literalPocketAdvice(){
 let state=q.observation;const continuation=route.steps.slice(0,3).map(p=>{const r=R.replay(state,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[p.event]);state=r.state;return{...p,target:p.event.target,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length,resultContext:context(state)};});
 const first=continuation[0];return P.revalidate(q.observation,{target:first.target,witness:first.witness,hold:first.hold,holdCount:first.holdCount,continuation,context:context(q.observation),evidence:{}},{...q.options,...bounds});
}
// This positive protects the independently retained S/T/I Pocket route, not a
// promise that each bounded fresh search must select its same trailing filler.
function lifecycle(){const a=literalPocketAdvice();assert.ok(a);const first=R.replay(q.observation,a.witness),s=P.continueCommitment(q.observation,f.afterS.observation,a,first.events[0],{...f.afterS.options,...bounds});assert.ok(s);
 const b=P.decide(f.afterS.observation,{...f.afterS.options,...bounds,commitment:{observation:f.afterS.observation,advice:s}}),second=R.replay(f.afterS.observation,b.witness),n=P.continueCommitment(f.afterS.observation,f.afterT.observation,b,second.events[0],{...f.afterT.options,...bounds});assert.ok(n);
 return{a,s,b,n,result:P.decide(f.afterT.observation,{...f.afterT.options,...bounds,commitment:{observation:f.afterT.observation,advice:n}})};}
let saved;
test('pending L refill / literal S25 T26 Pocket commitment survives refill and accommodates new public T',()=>{
 saved=lifecycle();const {a,s,b,n,result}=saved;equivalent.sPlacement(a.continuation[0].event,[[5,23],[6,23],[4,24],[5,24]]);assert.equal(s.continuation.length,2);assert.equal(n.continuation.length,1);assert.equal(result.target.type,'I');assert.equal(result.continuation.length,1);assert.ok(result.metrics.nodes<=45000);
 assert.ok(s.evidence.pendingLStage.hintReplayed>=4);assert.ok(n.evidence.pendingLStage.hintReplayed>=5);assert.equal(result.evidence.pendingLStage.waiting.at(-1).event.type,'T');assert.equal(result.evidence.pendingLStage.waiting.at(-1).event.lines,2);
 const replay=R.replay(f.afterT.observation,[...result.continuation,...result.evidence.pendingLStage.waiting].flatMap(p=>p.witness));assert.ok(replay.valid);assert.equal(replay.state.active,null);assert.equal(replay.state.queue.length,0);assert.equal(replay.state.hold,'Z');assert.equal(result.evidence.pendingLStage.arrival,'not-established');
});
test('pending L refill / fresh choices transport the waiting hint even when the scoring commitment expires',()=>{
 const a=P.decide(q.observation,{...q.options,...bounds}),first=R.replay(q.observation,a.witness);assert.equal(first.valid,true);assert.deepEqual(first.state.board,f.afterS.observation.board);
 const s=P.continueCommitment(q.observation,f.afterS.observation,a,first.events[0],{...f.afterS.options,...bounds});assert.ok(s);
 const b=P.decide(f.afterS.observation,{...f.afterS.options,...bounds,commitment:{observation:f.afterS.observation,advice:s}}),second=R.replay(f.afterS.observation,b.witness);assert.equal(second.valid,true);assert.deepEqual(second.state.board,f.afterT.observation.board);assert.equal(second.events[0].spin,'full');assert.equal(second.events[0].lines,2);
 const n=P.continueCommitment(f.afterS.observation,f.afterT.observation,b,second.events[0],{...f.afterT.options,...bounds}),remainingGoal=P.resourceGoal(b.continuation.slice(1));
 assert.equal(Boolean(n),remainingGoal,'Only a still-executable resource goal keeps this commitment alive');
 if(!n)assert.equal(b.evidence.coveredRepairPlan,null,'Outstanding covered repair must not be retired as filler');
 const hint=b.evidence.pendingLStage;assert.ok(hint,'The controller stores this separately from the retiring commitment');
 const result=P.decide(f.afterT.observation,{...f.afterT.options,...bounds,pendingLHint:hint,...(n?{commitment:{observation:f.afterT.observation,advice:n}}:{})});
 assert.equal(result.target?.type,'I');assert.ok(result.metrics.nodes<=45000);assert.equal(result.evidence.pendingLStage.arrival,'not-established');assert.equal(result.evidence.pendingLStage.rootId,hint.rootId);
 const summary=CurrentProvider.facts(CurrentProvider.prepare(f.afterT.observation,{obligationContext:Current.exportState(Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation}))})),joined=[...result.continuation,...result.evidence.pendingLStage.waiting],checked=M.checkPath(f.afterT.observation,joined,Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation}));
 assert.equal(checked.valid,true);assert.deepEqual(checked.resource.violations,[]);assert.equal(checked.resource.pendingCenter.length,1);assert.equal(checked.resource.pendingCenter[0].rootId,hint.rootId);
 const replay=R.replay(f.afterT.observation,joined.flatMap(p=>p.witness));assert.equal(replay.valid,true);assert.equal(replay.events.reduce((n,e)=>n+e.lines,0),6);assert.equal(replay.events.at(-1).type,'T');assert.equal(replay.events.at(-1).lines,2);assert.equal(replay.state.active,null);assert.deepEqual(replay.state.queue,[]);assert.equal(replay.state.hold,'Z');assert.equal(replay.state.topOut,false);
});
test('pending L refill / literal TSD then right-cap Z retires its goal-free suffix without erasing its waiting hint',()=>{
 const raw=f.afterS.observation,witnesses=[route.steps[1].witness,['HOLD','R','R','R','R','CW','HD']];let state=raw;
 const continuation=witnesses.map(witness=>{const r=R.replay(state,witness);assert.equal(r.valid,true);state=r.state;const event=r.events[0];return{witness,event,target:event.target,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,resultContext:context(state)};});
 const summary=CurrentProvider.facts(CurrentProvider.prepare(raw,{obligationContext:Current.exportState(Current.importState(f.afterS.options.obligationContext,{position:raw}))})),end=M.checkPath(raw,continuation,Current.importState(f.afterS.options.obligationContext,{position:raw}));assert.equal(end.valid,true);
 const pending=end.resource.pendingCenter[0],origin=clone(state),waiting=[['L','L','HD'],['HOLD','R','R','R','CW','R','HD'],['HOLD','R','R','R','R','CW','HD'],['HOLD','L','L','HD'],['L','L','HD']].map(witness=>{const r=R.replay(state,witness);assert.equal(r.valid,true);state=r.state;return{witness,event:r.events[0]};});
 assert.equal(state.active,null);assert.deepEqual(state.queue,[]);
 const hint={rootId:pending.rootId,origin,target:{cells:clone(pending.alternatives[0].cells)},waiting},head=continuation[0],proposed={target:head.target,witness:head.witness,hold:head.hold,holdCount:head.holdCount,continuation,context:context(raw),evidence:{pendingLStage:hint}};
 const admitted=P.revalidate(raw,proposed,{...f.afterS.options,...bounds});assert.ok(admitted,'The literal cap route and its complete waiting tape are independently admitted');assert.equal(admitted.continuation.length,2);
 const suffix=admitted.continuation[1];assert.equal(suffix.event.type,'Z');assert.equal(suffix.event.lines,0);assert.ok(suffix.event.cells.every(([x])=>x>=7));const beforeCap=R.replay(raw,admitted.witness).state,cap=R.replay(beforeCap,suffix.witness);assert.equal(cap.valid,true);assert.equal(S.transition(beforeCap,{state:cap.state,event:cap.events[0]}).allocation,'right-cap-preparation');assert.equal(suffix.structuralEvidence.coveredRepair.required,false);assert.equal(admitted.evidence.coveredRepairPlan,null);
 assert.equal(P.resourceGoal([suffix]),false,'A non-scoring right Z cap alone is not a scoring, Pocket, Center or repair commitment');
 const actual=R.replay(raw,admitted.witness);assert.equal(actual.events[0].spin,'full');assert.equal(actual.events[0].lines,2);assert.deepEqual(actual.state.board,f.afterT.observation.board);
 assert.equal(P.continueCommitment(raw,f.afterT.observation,admitted,actual.events[0],{...f.afterT.options,...bounds}),null);
 assert.ok(admitted.evidence.pendingLStage,'The waiting hint remains available independently of the expired goal');
});
test('pending L refill / hint identity, endpoint, inventory, event and witness cannot substitute for current proof',()=>{
 const {result}=saved||lifecycle(),summary=CurrentProvider.facts(CurrentProvider.prepare(f.afterT.observation,{obligationContext:Current.exportState(Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation}))})),end=M.checkPath(f.afterT.observation,result.continuation,Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation})),hint=result.evidence.pendingLStage;
 const opts={maxNodes:1000,now:()=>0,waitingHint:hint},positive=M.pendingLStage(end.state,end.resource,opts);assert.equal(positive.valid,true);assert.equal(positive.hintReplayed,6);assert.ok(positive.visited<=1000);
 for(const mutate of [h=>h.rootId++,h=>h.target.cells={},h=>h.target.cells[0]=null,h=>h.target.cells[0][0]--,h=>h.origin.hold='L',h=>h.origin.active.x++,h=>h.origin.board[39]='..........',h=>h.origin.queue[0]='S',h=>h.waiting[0].event.lines=4,h=>h.waiting[0].witness=['HD'],h=>h.waiting=Array(8).fill(h.waiting[0]),h=>h.waiting[0].witness=Array(257).fill('L')]){const h=clone(hint);mutate(h);const proof=M.pendingLStage(end.state,end.resource,{...opts,waitingHint:h});assert.notEqual(proof.valid,true);}
 const partial=clone(hint);partial.waiting=partial.waiting.slice(1);assert.notEqual(M.pendingLStage(end.state,end.resource,{...opts,waitingHint:partial}).valid,true,'A consumed hint cannot simply be sliced without endpoint alignment');
 const stale=clone(hint);stale.waiting=stale.waiting.slice(0,-1);stale.publicDrawsExhausted=true;const proof=M.pendingLStage(end.state,end.resource,{...opts,waitingHint:stale});assert.notEqual(proof.valid,true,'Copied old exhaustion cannot omit newly public T');
 assert.equal(M.pendingLStage(end.state,end.resource,{...opts,maxNodes:0}).valid,null);
});
test('pending L refill / standalone stale exhaustion flag cannot hide the newly visible T',()=>{
 const summary=CurrentProvider.facts(CurrentProvider.prepare(f.afterT.observation,{obligationContext:Current.exportState(Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation}))})),end=M.checkPath(f.afterT.observation,f.endpointPrefix,Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation})),hint=clone(f.hint);hint.waiting.pop();hint.publicDrawsExhausted=true;
 const proof=M.pendingLStage(end.state,end.resource,{maxNodes:1000,now:()=>0,waitingHint:hint});assert.notEqual(proof.valid,true,'Current T remains unaccommodated after the old tail; copied exhaustion is not a certificate');
});
test('pending L refill / synthetic newly visible O also requires accommodation after a complete prior tail',()=>{
 const summary=CurrentProvider.facts(CurrentProvider.prepare(f.afterT.observation,{obligationContext:Current.exportState(Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation}))})),end=M.checkPath(f.afterT.observation,f.endpointPrefix,Current.importState(f.afterT.options.obligationContext,{position:f.afterT.observation})),projection=clone(end.resource.route.projection);delete projection.position.bag;projection.supply.knowledge=null;projection.position.queue.push('O');projection.supply.queue.push({id:projection.supply.nextSyntheticId--,type:'O',bag:null,observedOrder:null});
 const resource=M.fromProjection(projection,{openingBoundary:end.resource.route.openingBoundary}),state=M.position(resource);
 const proof=M.pendingLStage(state,resource,{maxNodes:200,now:()=>0,waitingHint:clone(f.hint)});assert.notEqual(proof.valid,true,'Synthetic public O is not covered by the old exhaustion flag; residual enumeration exceeds this bounded allowance');
});
