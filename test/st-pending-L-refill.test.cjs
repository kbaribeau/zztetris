'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),M=require('../st-midgame-resources'),H=require('../st-resource-history'),R=require('../st-rules'),q=require('./fixtures/pending-L-visible-stage.json'),f=require('./fixtures/pending-L-refill.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={maxNodes:45000,now:()=>0,deadline:Infinity};
function lifecycle(){const a=P.decide(q.observation,{...q.options,...bounds}),first=R.replay(q.observation,a.witness),s=P.continueCommitment(q.observation,f.afterS.observation,a,first.events[0],{...f.afterS.options,...bounds});assert.ok(s);
 const b=P.decide(f.afterS.observation,{...f.afterS.options,...bounds,commitment:{observation:f.afterS.observation,advice:s}}),second=R.replay(f.afterS.observation,b.witness),n=P.continueCommitment(f.afterS.observation,f.afterT.observation,b,second.events[0],{...f.afterT.options,...bounds});assert.ok(n);
 return{a,s,b,n,result:P.decide(f.afterT.observation,{...f.afterT.options,...bounds,commitment:{observation:f.afterT.observation,advice:n}})};}
let saved;
test('pending L refill / actual S25 T26 refill preserves checked waiting candidate and accommodates new public T',()=>{
 saved=lifecycle();const {a,s,b,n,result}=saved;assert.deepEqual(a.target,{type:'S',x:4,y:22,rotation:0});assert.equal(s.continuation.length,2);assert.equal(n.continuation.length,1);assert.equal(result.target.type,'I');assert.equal(result.continuation.length,1);assert.ok(result.metrics.nodes<=45000);
 assert.ok(s.evidence.pendingLStage.hintReplayed>=4);assert.ok(n.evidence.pendingLStage.hintReplayed>=5);assert.equal(result.evidence.pendingLStage.waiting.at(-1).event.type,'T');assert.equal(result.evidence.pendingLStage.waiting.at(-1).event.lines,2);
 const replay=R.replay(f.afterT.observation,[...result.continuation,...result.evidence.pendingLStage.waiting].flatMap(p=>p.witness));assert.ok(replay.valid);assert.equal(replay.state.active,null);assert.equal(replay.state.queue.length,0);assert.equal(replay.state.hold,'Z');assert.equal(result.evidence.pendingLStage.arrival,'not-established');
});
test('pending L refill / hint identity, endpoint, inventory, event and witness cannot substitute for current proof',()=>{
 const {result}=saved||lifecycle(),summary=H.resolve(f.afterT.observation,H.importContext(f.afterT.observation,f.afterT.options.resourceContext)),end=M.checkPath(f.afterT.observation,result.continuation,summary),hint=result.evidence.pendingLStage;
 const opts={maxNodes:1000,now:()=>0,waitingHint:hint},positive=M.pendingLStage(end.state,end.resource,opts);assert.equal(positive.valid,true);assert.equal(positive.hintReplayed,6);assert.ok(positive.visited<=1000);
 for(const mutate of [h=>h.rootId++,h=>h.target.cells={},h=>h.target.cells[0]=null,h=>h.target.cells[0][0]--,h=>h.origin.hold='L',h=>h.origin.active.x++,h=>h.origin.board[39]='..........',h=>h.origin.queue[0]='S',h=>h.waiting[0].event.lines=4,h=>h.waiting[0].witness=['HD'],h=>h.waiting=Array(8).fill(h.waiting[0]),h=>h.waiting[0].witness=Array(257).fill('L')]){const h=clone(hint);mutate(h);const proof=M.pendingLStage(end.state,end.resource,{...opts,waitingHint:h});assert.notEqual(proof.valid,true);}
 const partial=clone(hint);partial.waiting=partial.waiting.slice(1);assert.notEqual(M.pendingLStage(end.state,end.resource,{...opts,waitingHint:partial}).valid,true,'A consumed hint cannot simply be sliced without endpoint alignment');
 const stale=clone(hint);stale.waiting=stale.waiting.slice(0,-1);stale.publicDrawsExhausted=true;const proof=M.pendingLStage(end.state,end.resource,{...opts,waitingHint:stale});assert.notEqual(proof.valid,true,'Copied old exhaustion cannot omit newly public T');
 assert.equal(M.pendingLStage(end.state,end.resource,{...opts,maxNodes:0}).valid,null);
});
test('pending L refill / standalone stale exhaustion flag cannot hide the newly visible T',()=>{
 const summary=H.resolve(f.afterT.observation,H.importContext(f.afterT.observation,f.afterT.options.resourceContext)),end=M.checkPath(f.afterT.observation,f.endpointPrefix,summary),hint=clone(f.hint);hint.waiting.pop();hint.publicDrawsExhausted=true;
 const proof=M.pendingLStage(end.state,end.resource,{maxNodes:1000,now:()=>0,waitingHint:hint});assert.notEqual(proof.valid,true,'Current T remains unaccommodated after the old tail; copied exhaustion is not a certificate');
});
test('pending L refill / synthetic newly visible O also requires accommodation after a complete prior tail',()=>{
 const summary=H.resolve(f.afterT.observation,H.importContext(f.afterT.observation,f.afterT.options.resourceContext)),end=M.checkPath(f.afterT.observation,f.endpointPrefix,summary),state=clone(end.state),resource=clone(end.resource);delete state.bag;state.queue.push('O');resource.queue.push({id:-999,type:'O',bag:null});
 const proof=M.pendingLStage(state,resource,{maxNodes:200,now:()=>0,waitingHint:clone(f.hint)});assert.notEqual(proof.valid,true,'Synthetic public O is not covered by the old exhaustion flag; residual enumeration exceeds this bounded allowance');
});
