'use strict';
const P=require('../st-planner'),M=require('../st-obligation-resources'),Context=require('../st-obligation-context'),R=require('../st-rules');
let exportedAtExpiry,postJRequest,targetAtExpiry,expirySimulation;
const test=require('node:test'),assert=require('node:assert/strict'),{withPage}=require('./support/page.cjs'),{workerPlanner}=require('../scripts/lib/st-simulation.cjs'),Session=require('../st-session'),Practice=require('../st-practice'),H=require('../st-obligation-context'),f=require('./fixtures/pending-L-expiry.json'),clone=x=>JSON.parse(JSON.stringify(x));
function packed(){return Practice.create(Session.create(f.observation,{obligationContext:f.options.obligationContext,patternHistory:f.options.patternHistory,openingPhase:false}),f.recordedReveals);}
// Semantic assertions use the unchanged node allowance, not host throughput.
// The separate production-budget control below checks bounded safe behavior.
test('pending L expiry / 45000-node no-timeout page semantics retain exact J24 S25 T26 expiry and Undo',()=>withPage('st-lab.html',{},g=>{
 const workers=[],run=workerPlanner({disableSearchTimeout:true});g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
 g.element('#st-snapshot').value=JSON.stringify(packed());g.click('#st-import');g.advance(40);
 for(const piece of ['J','S','T']){const w=workers.at(-1),advice=run(w.message);assert.equal(advice.target?.type,piece,JSON.stringify({status:advice.status,reason:advice.reason,nodes:advice.metrics?.nodes,elapsedMs:advice.metrics?.elapsedMs}));assert.ok(advice.metrics.nodes<=45000);w.respond(advice);for(const action of advice.witness)g.window.stLab.act(action);g.advance(40);if(piece==='J')postJRequest=clone(workers.at(-1).message);}
 const request=workers.at(-1).message;assert.equal(request.observation.active.type,'I');assert.deepEqual(request.observation.queue,['O','Z','J','I','O','T']);assert.equal(request.commitment,null,'Old J/S/T goal has expired, not been revived as a forced route');
 assert.ok(request.options.pendingLHint,'The nonauthorizing waiting candidate must survive separately');
 exportedAtExpiry=clone(g.window.stLab.exportSession());assert.equal(exportedAtExpiry.coaching.commitment,null);assert.ok(exportedAtExpiry.coaching.pendingLHint);
 targetAtExpiry=clone(g.window.stLab.resources.center.pending);g.window.stLab.act('UNDO');g.advance(40);assert.equal(workers.at(-1).message.observation.active.type,'T');assert.ok(workers.at(-1).message.options.pendingLHint);
}));
test('pending L expiry / 45000-node no-timeout native import retains waiting hint and exact current target',()=>withPage('st-lab.html',{},g=>{
 assert.ok(exportedAtExpiry);const workers=[],run=workerPlanner({disableSearchTimeout:true});g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};
 const install=()=>{g.element('#st-snapshot').value=JSON.stringify(exportedAtExpiry);g.click('#st-import');g.advance(40);const request=workers.at(-1).message;assert.equal(request.commitment,null);assert.ok(request.options.pendingLHint);assert.deepEqual(clone(g.window.stLab.resources.center.pending),targetAtExpiry);return request;};
 const request=install(),advice=run(request);assert.ok(advice.target);assert.equal(advice.target.type,'I');assert.ok(advice.metrics.nodes<=45000);
 const imported=install(),again=run(imported);assert.ok(again.target);assert.equal(again.target.type,'I');assert.ok(again.metrics.nodes<=45000);
 const bounded=P.decide(imported.observation,{...imported.options,maxNodes:1,now:()=>0,deadline:Infinity});assert.equal(bounded.target,null);assert.deepEqual(clone(g.window.stLab.resources.center.pending),targetAtExpiry,'Budget failure cannot discharge the recorded target');
}));
test('pending L expiry / imported hint is bounded whitelisted suggestion, never copied authority',()=>{
 assert.ok(exportedAtExpiry);const injected=clone(exportedAtExpiry),h=injected.coaching.pendingLHint;h.valid=true;h.globallyOptimal=true;h.publicDrawsExhausted=true;h.hiddenFuture=['L'];h.origin.hiddenFuture=['L'];h.origin.active.hiddenFuture=['L'];h.target.hiddenFuture=['L'];h.waiting[0].event.hiddenFuture=['L'];
 const restored=Session.prepare(injected);assert.ok(restored.pendingLHint);assert.equal(JSON.stringify(restored.pendingLHint).includes('hiddenFuture'),false);assert.equal(restored.pendingLHint.valid,undefined);assert.equal(restored.pendingLHint.globallyOptimal,undefined);assert.equal(restored.pendingLHint.publicDrawsExhausted,undefined);
 for(const mutate of [x=>x.target.cells=null,x=>x.waiting[0].event.type={secret:'L'},x=>x.waiting[0].witness=Array(257).fill('L'),x=>x.waiting=Array(8).fill(x.waiting[0])]){const bad=clone(exportedAtExpiry);mutate(bad.coaching.pendingLHint);const value=Session.prepare(bad);assert.equal(value.pendingLHint,null);assert.equal(Context.resolve(value.obligationContext,{position:value.state}).center.pending.length,1);}
 const old=clone(exportedAtExpiry);old.engineVersion='old-coach';assert.equal(Session.prepare(old).pendingLHint,null);
});

test('pending L expiry / consumed alignment replays exact events before checking the remaining current supply',()=>{
 const prepared=Session.prepare(exportedAtExpiry),hint=prepared.pendingLHint,resource=M.start(prepared.state,prepared.obligationContext,{extendForced:false}),first=hint.waiting[0],end=M.checkPath(prepared.state,[first],resource);
 const proof=M.pendingLStage(end.state,end.resource,{waitingHint:hint,maxNodes:2000,now:()=>0});assert.equal(proof.valid,true);assert.ok(proof.visited<=2000);assert.equal(proof.path[0].event.type,'O');assert.equal(proof.path.at(-1).event.type,'T');assert.equal(proof.path.at(-1).event.lines,2);
 const bad=clone(hint);bad.waiting[0].event.lines=4;assert.notEqual(M.pendingLStage(end.state,end.resource,{waitingHint:bad,maxNodes:2000,now:()=>0}).valid,true,'A copied consumed-count or mismatched event cannot align the old origin');
});

test('pending L expiry / 45000-node no-timeout simulation semantics execute the exact J24 S25 T26 goal',()=>{
 const {createSession,CONFIG}=require('../scripts/lib/st-simulation.cjs'),session=createSession({scenario:'stable',initial:f.observation,obligationContext:f.options.obligationContext,future:f.recordedReveals});
 assert.deepEqual(session.request(24,CONFIG).observation,f.observation);const run=workerPlanner({disableSearchTimeout:true});
 for(let i=24;i<=26;i++){const request=session.request(i,CONFIG),advice=run(request);assert.equal(advice.target?.type,['J','S','T'][i-24],JSON.stringify({status:advice.status,reason:advice.reason,nodes:advice.metrics?.nodes,elapsedMs:advice.metrics?.elapsedMs}));assert.ok(advice.metrics.nodes<=45000);session.execute(advice);}
 const request=session.request(27,CONFIG);assert.equal(request.commitment,null);assert.ok(request.options.pendingLHint);assert.deepEqual(request.observation.queue,['O','Z','J','I','O','T']);expirySimulation=session;
});
test('pending L expiry / 45000-node no-timeout simulator retains the post-expiry I candidate',()=>{
 assert.ok(expirySimulation);const {CONFIG}=require('../scripts/lib/st-simulation.cjs'),request=expirySimulation.request(27,CONFIG),next=workerPlanner({disableSearchTimeout:true})(request);assert.ok(next.target);assert.equal(next.target.type,'I');assert.ok(next.metrics.nodes<=45000);assert.equal(request.commitment,null);assert.ok(request.options.pendingLHint);
});


function actualPostJRequest(){
 if(postJRequest)return clone(postJRequest);
 // Also support selecting this safety test alone. Start from the same finite
 // legacy fixture converted once, then consume the actual accepted J inputs.
 const E=require('../scripts/lib/st-simulation.cjs'),saved=Session.create(f.observation,{obligationContext:f.options.obligationContext,patternHistory:f.options.patternHistory,openingPhase:false});
 const session=E.createSession({scenario:'stable',initial:saved.position,obligationContext:saved.coaching.obligationContext,future:f.recordedReveals});
 const request=session.request(24,E.CONFIG),advice=workerPlanner({disableSearchTimeout:true})(request);assert.equal(advice.target?.type,'J');assert.ok(advice.metrics.nodes<=45000);session.execute(advice);
 return session.request(25,E.CONFIG);
}
test('pending L expiry / production 1500ms post-J Worker returns a checked witness or explicit unfinished result',()=>{
 const E=require('../scripts/lib/st-simulation.cjs'),request=actualPostJRequest(),before=clone(request);
 assert.equal(request.observation.active.type,'S');assert.equal(request.options.timeMs,1500);assert.equal(request.options.maxNodes,45000);assert.equal(request.options.deadline,undefined);
 const result=workerPlanner()(request);assert.deepEqual(request,before,'Budget outcome cannot mutate the current authority or hint');
 assert.ok(Number.isInteger(result.metrics.nodes)&&result.metrics.nodes>=0&&result.metrics.nodes<=45000);
 if(result.target){
  assert.equal(result.target.type,'S');assert.equal(result.status,'recommended-with-verified-prefix');
  const replay=E.validateAdvice(request.observation,result);assert.deepEqual(replay.events[0],result.continuation[0].event);assert.equal(result.evidence.resourceObligations.status,'checked');
  const checked=P.revalidate(request.observation,result,{...request.options,now:()=>0,deadline:Infinity});assert.ok(checked,'A timed target still requires independent current resource and movement proof');assert.deepEqual(checked.target,result.target);
 }else{
  assert.equal(result.status,'budget-exhausted');assert.match(result.reason,/search limit|budget|unfinished/i);assert.deepEqual(result.witness,[]);assert.deepEqual(result.continuation,[]);
  assert.notEqual(result.evidence?.resourceObligations?.status,'checked');assert.equal(result.evidence?.construction,undefined,'Unfinished work cannot become a construction certificate');
 }
});
