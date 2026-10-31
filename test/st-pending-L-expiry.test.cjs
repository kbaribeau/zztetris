'use strict';
const P=require('../st-planner'),M=require('../st-midgame-resources'),R=require('../st-rules');
let exportedAtExpiry;
const test=require('node:test'),assert=require('node:assert/strict'),{withPage}=require('./support/page.cjs'),{workerPlanner}=require('../scripts/lib/st-simulation.cjs'),Session=require('../st-session'),Practice=require('../st-practice'),H=require('../st-resource-history'),f=require('./fixtures/pending-L-expiry.json'),clone=x=>JSON.parse(JSON.stringify(x));
function packed(){return Practice.create(Session.create(f.observation,{resourceHistory:H.importContext(f.observation,f.options.resourceContext),resourceOriginBag:f.resourceOriginBag,patternHistory:f.options.patternHistory,openingPhase:false}),f.recordedReveals);}
test('pending L expiry / actual page and fresh serialized Workers keep an unforced waiting hint after J24 S25 T26 goal expires',()=>withPage('st-lab.html',{},g=>{
 const workers=[],run=workerPlanner();g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
 g.element('#st-snapshot').value=JSON.stringify(packed());g.click('#st-import');g.advance(40);
 for(const piece of ['J','S','T']){const w=workers.at(-1),advice=run(w.message);assert.equal(advice.target?.type,piece);w.respond(advice);for(const action of advice.witness)g.window.stLab.act(action);g.advance(40);}
 const request=workers.at(-1).message;assert.equal(request.observation.active.type,'I');assert.deepEqual(request.observation.queue,['O','Z','J','I','O','T']);assert.equal(request.commitment,null,'Old J/S/T goal has expired, not been revived as a forced route');
 assert.ok(request.options.pendingLHint,'The nonauthorizing waiting candidate must survive separately');const advice=run(request);assert.ok(advice.target);assert.equal(advice.target.type,'I');assert.ok(advice.metrics.nodes<=45000);
 exportedAtExpiry=clone(g.window.stLab.exportSession());assert.equal(exportedAtExpiry.coaching.commitment,null);assert.ok(exportedAtExpiry.coaching.pendingLHint);
 const target=clone(g.window.stLab.resources.center.pending);g.window.stLab.act('UNDO');g.advance(40);assert.equal(workers.at(-1).message.observation.active.type,'T');assert.ok(workers.at(-1).message.options.pendingLHint);
 g.element('#st-snapshot').value=JSON.stringify(exportedAtExpiry);g.click('#st-import');g.advance(40);const imported=workers.at(-1).message;assert.equal(imported.commitment,null);assert.ok(imported.options.pendingLHint);assert.deepEqual(clone(g.window.stLab.resources.center.pending),target);
 const again=run(imported);assert.ok(again.target);assert.equal(again.target.type,'I');
 const bounded=P.decide(imported.observation,{...imported.options,maxNodes:1,now:()=>0,deadline:Infinity});assert.equal(bounded.target,null);assert.deepEqual(clone(g.window.stLab.resources.center.pending),target,'Budget failure cannot discharge the recorded target');
}));
test('pending L expiry / imported hint is bounded whitelisted suggestion, never copied authority',()=>{
 assert.ok(exportedAtExpiry);const injected=clone(exportedAtExpiry),h=injected.coaching.pendingLHint;h.valid=true;h.globallyOptimal=true;h.publicDrawsExhausted=true;h.hiddenFuture=['L'];h.origin.hiddenFuture=['L'];h.origin.active.hiddenFuture=['L'];h.target.hiddenFuture=['L'];h.waiting[0].event.hiddenFuture=['L'];
 const restored=Session.prepare(injected);assert.ok(restored.pendingLHint);assert.equal(JSON.stringify(restored.pendingLHint).includes('hiddenFuture'),false);assert.equal(restored.pendingLHint.valid,undefined);assert.equal(restored.pendingLHint.globallyOptimal,undefined);assert.equal(restored.pendingLHint.publicDrawsExhausted,undefined);
 for(const mutate of [x=>x.target.cells=null,x=>x.waiting[0].event.type={secret:'L'},x=>x.waiting[0].witness=Array(257).fill('L'),x=>x.waiting=Array(8).fill(x.waiting[0])]){const bad=clone(exportedAtExpiry);mutate(bad.coaching.pendingLHint);const value=Session.prepare(bad);assert.equal(value.pendingLHint,null);assert.equal(H.resolve(value.state,value.resourceHistory).center.pending.length,1);}
 const old=clone(exportedAtExpiry);old.engineVersion='old-coach';assert.equal(Session.prepare(old).pendingLHint,null);
});

test('pending L expiry / consumed alignment replays exact events before checking the remaining current supply',()=>{
 const prepared=Session.prepare(exportedAtExpiry),hint=prepared.pendingLHint,summary=H.resolve(prepared.state,prepared.resourceHistory),first=hint.waiting[0],end=M.checkPath(prepared.state,[first],summary);
 const proof=M.pendingLStage(end.state,end.resource,{waitingHint:hint,maxNodes:2000,now:()=>0});assert.equal(proof.valid,true);assert.ok(proof.visited<=2000);assert.equal(proof.path[0].event.type,'O');assert.equal(proof.path.at(-1).event.type,'T');assert.equal(proof.path.at(-1).event.lines,2);
 const bad=clone(hint);bad.waiting[0].event.lines=4;assert.notEqual(M.pendingLStage(end.state,end.resource,{waitingHint:bad,maxNodes:2000,now:()=>0}).valid,true,'A copied consumed-count or mismatched event cannot align the old origin');
});

test('pending L expiry / simulation transports the same candidate through authentic observed history and fresh Workers',()=>{
 const {createSession,CONFIG}=require('../scripts/lib/st-simulation.cjs'),context=f.options.resourceContext,initial={...clone(context.origin),revision:f.observation.revision-context.steps.length,bag:clone(f.resourceOriginBag)},future=[...context.steps.flatMap(s=>s.revealed),...f.recordedReveals],session=createSession({scenario:'stable',initial,future});
 let witness=[];for(const step of context.steps){witness.push(step.action);if(step.action==='HD'){const literal=R.replay(session.state,witness);assert.ok(literal.valid);const event=literal.events[0];session.execute({target:event.target,witness,hold:witness.includes('HOLD'),continuation:[{target:event.target,witness,event}],evidence:{}});witness=[];}}
 assert.deepEqual(session.request(24,CONFIG).observation,f.observation);const run=workerPlanner();
 for(let i=24;i<=26;i++){const request=session.request(i,CONFIG),advice=run(request);assert.equal(advice.target?.type,['J','S','T'][i-24]);session.execute(advice);}
 const request=session.request(27,CONFIG);assert.equal(request.commitment,null);assert.ok(request.options.pendingLHint);assert.deepEqual(request.observation.queue,['O','Z','J','I','O','T']);const next=run(request);assert.ok(next.target);assert.equal(next.target.type,'I');assert.ok(next.metrics.nodes<=45000);
});
