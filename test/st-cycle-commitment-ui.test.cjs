'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {withPage}=require('./support/page.cjs');
const R=require('../st-rules');
const json=x=>JSON.parse(JSON.stringify(x));
function setup(g){
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=json(m);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 g.click('#st-reset');g.advance(40);return workers;
}
function advice(s){const p=R.placements(s,{maxNodes:8000}).placements.find(p=>p.witness.at(-1)==='HD');assert.ok(p);return {status:'recommended-with-verified-prefix',target:p.target,hold:p.hold,holdCount:p.holdCount,witness:p.witness,continuation:[{target:p.target,witness:p.witness,event:p.event}],reason:'Verified test plan.'};}
// Plumbing-only fixtures stub goal accounting as well as suffix replay. Real
// commitment validity is exercised separately below with the production API.
function stubContinuation(g,returnSuffix=true){const calls=[];g.window.STPlanner={...g.window.STPlanner,cycleResources:()=>({tsds:1,quads:0,pocket:0}),continueCommitment:(before,after,plan)=>{calls.push(json({before,after,plan}));return returnSuffix?{...advice(after),marker:'remaining-cycle-proof'}:null;}};return calls;}
test('st-cycle-ui/matching hard drop retains origin-bound proof after preview refresh',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),initial=workers.at(-1).message.observation,plan=advice(initial),calls=stubContinuation(g);
 workers.at(-1).respond(plan);
 // Cosmetic deviation and return do not rewrite the origin of the checked lock.
 g.window.stLab.act('L');g.window.stLab.act('R');
 for(const action of plan.witness)g.window.stLab.act(action);
 assert.equal(calls.length,1);assert.deepEqual(calls[0].before,initial);assert.deepEqual(calls[0].plan,plan);
 assert.equal(calls[0].after.queue.length,6);assert.deepEqual(calls[0].after,g.snapshot());
 g.advance(40);const next=workers.at(-1).message;
 assert.equal(next.previous,null);assert.equal(next.commitment.advice.marker,'remaining-cycle-proof');assert.deepEqual(next.commitment.observation,next.observation);
 g.click('#st-export');const exported=JSON.parse(g.element('#st-snapshot').value);assert.equal(exported.commitment,undefined);
}));
test('st-cycle-ui/reset and imported metadata cannot resurrect a commitment',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),plan=advice(workers.at(-1).message.observation);stubContinuation(g);workers.at(-1).respond(plan);
 g.click('#st-reset');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
 workers.at(-1).respond(advice(workers.at(-1).message.observation));
 g.element('#st-snapshot').value=JSON.stringify({...g.snapshot(),commitment:{observation:g.snapshot(),advice:plan}});g.click('#st-import');g.advance(40);
 assert.equal(workers.at(-1).message.commitment,null);
}));
test('st-cycle-ui/rejected actual lock retires the old resource proof',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),plan=advice(workers.at(-1).message.observation),calls=stubContinuation(g,false);workers.at(-1).respond(plan);
 g.window.stLab.act('HD');g.advance(40);assert.equal(calls.length,1);assert.equal(workers.at(-1).message.commitment,null);
}));
test('st-cycle-ui/hidden guidance still advances proof on a manual lock',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),plan=advice(workers.at(-1).message.observation),calls=stubContinuation(g);workers.at(-1).respond(plan);g.click('#st-toggle');
 for(const action of plan.witness)g.window.stLab.act(action);
 assert.equal(calls.length,1);g.click('#st-toggle');g.advance(40);assert.equal(workers.at(-1).message.commitment.advice.marker,'remaining-cycle-proof');
}));
test('st-worker/cycle commitment is compared in fresh search, not blindly retained',()=>{
 const calls=[],messages=[],commitment={observation:{board:['public']},advice:{witness:['HD']}},context={Date,self:{postMessage:x=>messages.push(x)},importScripts(){},STPlanner:{revalidate(){throw Error('must not bypass comparison');},plan(observation,options){calls.push({observation,options});return {status:'fresh-comparison'};}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),context);
 context.self.onmessage({data:{type:'plan',id:4,observation:{revision:7},previous:{target:{}},commitment,options:{timeMs:750}}});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].options.commitment,commitment);assert.equal(messages[0].result.status,'fresh-comparison');
});
test('st-cycle-ui/stale worker cannot replace a newer cycle proof',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),old=workers.at(-1),oldPlan={...advice(old.message.observation),marker:'old'};stubContinuation(g);
 old.respond(oldPlan);g.window.stLab.act('R');g.advance(40);
 const fresh=workers.at(-1),newPlan={...advice(fresh.message.observation),marker:'new'};fresh.respond(newPlan);old.respond(oldPlan);
 g.window.stLab.act('L');g.advance(40);assert.equal(workers.at(-1).message.commitment.advice.marker,'new');
 assert.deepEqual(workers.at(-1).message.commitment.observation,fresh.message.observation);
}));
test('st-cycle-ui/hold swaps do not mutate the proof origin or expose hidden pieces',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),initial=workers.at(-1).message.observation,plan=advice(initial);stubContinuation(g);workers.at(-1).respond(plan);
 g.window.stLab.act('HOLD');g.window.stLab.act('HOLD');g.advance(40);
 const request=workers.at(-1).message;assert.deepEqual(request.commitment.observation,initial);assert.deepEqual(request.commitment.advice,plan);
 assert.equal(request.observation.queue.length,6);assert.equal('future' in request.commitment.observation,false);assert.equal('seed' in request.commitment.observation,false);
}));
// These use the real planner API, not the plumbing stub above. The two known
// fixtures exercise an occupied hold and the empty-hold preview expansion.
for(const id of ['o-before-double','empty-hold'])test(`st-cycle-ui/real ${id} resource suffix survives locks and retires after its final protected goal`,()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),workers=setup(g);g.window.stLab.loadFixture(id);g.advance(40);
 let request=workers.at(-1).message,plan=P.plan(request.observation,{depth:3,width:8,maxNodes:45000});
 assert.ok(plan.target);assert.ok(plan.continuation.some(s=>s.event.type==='T'&&s.event.lines===2));workers.at(-1).respond(plan);
 const originalSteps=json(plan.continuation),doubleIndex=originalSteps.findIndex(s=>s.event.type==='T'&&s.event.lines===2);
 for(let lock=0;lock<originalSteps.length;lock++){
  for(const action of originalSteps[lock].witness)g.window.stLab.act(action);
  g.advance(40);request=workers.at(-1).message;
  if(lock<doubleIndex){assert.ok(request.commitment,'remaining scoring goal survives a fresh request');assert.deepEqual(request.commitment.observation,request.observation);assert.ok(request.commitment.advice.continuation.some(s=>s.event.type==='T'&&s.event.lines===2));}
  else if(id==='empty-hold'&&lock<originalSteps.length-1){assert.ok(request.commitment,'the accepted S/L goal survives scoring first');assert.ok(P.cycleResources(request.commitment.advice.continuation).centerCompletions>0);}
  else assert.equal(request.commitment,null,'the fulfilled resource route retires its commitment');
 }
}));
test('st-cycle-ui/real mismatched manual lock discards the old scoring commitment',()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),workers=setup(g),request=workers.at(-1).message;
 const plan=P.plan(request.observation,{depth:3,width:8,maxNodes:45000});assert.ok(plan.target);assert.ok(plan.continuation.length>1);
 const actual=R.replay(request.observation,['HD']);assert.notDeepEqual(actual.events[0].target,plan.target);workers.at(-1).respond(plan);
 g.window.stLab.act('HD');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));
test('st-cycle-ui/real reserved I survives the double and fills the Pocket across fresh workers',()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),snapshot=require('./support/st-cycle-resources.json').holdI.snapshot,workers=setup(g),events=[];
 g.element('#st-snapshot').value=JSON.stringify(snapshot);g.click('#st-import');g.advance(40);
 for(let lock=0;lock<3;lock++){
  const request=workers.at(-1).message,plan=P.plan(request.observation,{depth:3,width:8,maxNodes:45000,commitment:request.commitment});assert.ok(plan.target,plan.reason);
  events.push(R.replay(request.observation,plan.witness).events[0]);workers.at(-1).respond(plan);
  for(const action of plan.witness)g.window.stLab.act(action);g.advance(40);
  const next=workers.at(-1).message;
  if(lock<2){assert.ok(next.commitment);assert.ok(next.commitment.advice.continuation.some(s=>s.event.type==='I'&&s.structuralEvidence.allocation==='quad-preparation'));}
  else assert.equal(next.commitment,null,'fulfilled Pocket preparation retires its commitment');
  if(lock===0)assert.equal(g.snapshot().hold,'I');
 }
 assert.deepEqual(events.map(e=>e.type),['L','T','I']);assert.equal(events[1].lines,2);assert.equal(events[1].spin,'full');assert.ok(events[2].cells.every(([x])=>x===9));
}));
test('st-cycle-ui/goal-free filler advice never becomes a cycle commitment',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),plan=advice(workers.at(-1).message.observation);assert.equal(require('../st-planner').cycleResources(plan.continuation).tsds,0);
 workers.at(-1).respond(plan);g.window.stLab.act('L');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));
test('st-cycle-ui/identical locked board without the actual spin does not fulfil the scoring commitment',()=>{
 const P=require('../st-planner'),snapshot=require('./support/st-cycle-resources.json').holdI.snapshot;
 const plan=P.plan(snapshot,{depth:3,width:8,maxNodes:45000}),first=R.replay(snapshot,plan.witness);assert.ok(first.valid);
 const scoring=P.continueCommitment(snapshot,first.state,plan,first.events[0]);assert.ok(scoring);assert.equal(scoring.continuation[0].event.spin,'full');
 const atTarget=R.replay(first.state,scoring.witness.slice(0,-1));assert.ok(atTarget.valid);
 const noRotation=R.createState({...atTarget.state,active:{...atTarget.state.active,lastRotation:null}}),uncredited=R.move(noRotation,'HD'),scored=R.replay(first.state,scoring.witness);
 assert.deepEqual(uncredited.board,scored.state.board);assert.deepEqual(uncredited.lastEvent.target,scored.events[0].target);assert.equal(uncredited.lastEvent.lines,2);assert.equal(uncredited.lastEvent.spin,'none');
 assert.ok(P.continueCommitment(first.state,scored.state,scoring,scored.events[0]));
 assert.equal(P.continueCommitment(first.state,uncredited,scoring,uncredited.lastEvent),null);
});
test('st-cycle-ui/construction proof survives hold, first T, refresh and reset without imported state',()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),fixture=require('./support/st-construction-recovery.json'),workers=setup(g);
 g.window.STFixtures={...g.window.STFixtures,get:()=>({observation:fixture.initial,future:['J','L','O'],label:'Synthetic public construction control'})};
 g.window.stLab.loadFixture('synthetic-construction-control');g.advance(40);
 let request=workers.at(-1).message,plan=P.plan(request.observation,{timeMs:750});assert.ok(plan.target,plan.reason);workers.at(-1).respond(plan);
 // Deliver the refreshed result after HOLD as a real worker may do, then lock.
 const first=plan.witness[0];assert.equal(first,'HOLD');g.window.stLab.act(first);g.advance(40);
 request=workers.at(-1).message;
 const refreshed=P.plan(request.observation,{timeMs:750,commitment:request.commitment,constructionPrevious:request.previous});assert.ok(refreshed.target,refreshed.reason);workers.at(-1).respond(refreshed);
 for(const action of refreshed.witness)g.window.stLab.act(action);
 g.advance(40);request=workers.at(-1).message;
 assert.ok(request.commitment);assert.equal(Math.abs(request.commitment.advice.evidence.constructionStage.parity),2);
 plan=P.plan(request.observation,{timeMs:750,commitment:request.commitment});workers.at(-1).respond(plan);
 g.window.stLab.act('CW');g.window.stLab.act('CCW');
 for(const action of plan.witness)g.window.stLab.act(action);
 g.advance(40);request=workers.at(-1).message;assert.ok(request.commitment);assert.equal(request.commitment.advice.evidence.constructionStage.parity,0);
 const savedProof=json(request.commitment.advice.evidence.construction);
 plan=P.plan(request.observation,{timeMs:750,commitment:request.commitment});workers.at(-1).respond(plan);
 g.window.stLab.act('HD');g.advance(40);assert.equal(workers.at(-1).message.commitment,null,'a different manual lock retires the construction');
 const snap=g.snapshot();g.element('#st-snapshot').value=JSON.stringify({...snap,construction:savedProof});g.click('#st-import');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
 g.click('#st-reset');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));
test('st-cycle-ui/exact replacement-Z debt crosses refreshed preview and rejects a different lock',()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),X=require('../st-paired-repair'),fixture=require('./support/st-visible-z-deferral.json'),workers=setup(g);
 g.window.STFixtures={...g.window.STFixtures,get:()=>({observation:fixture.initial,future:['J','L','O'],label:'Synthetic public construction control'})};
 g.window.stLab.loadFixture('synthetic-construction-control');g.advance(40);
 const request=workers.at(-1).message,cert=X.search(request.observation,{kind:'cap-deferral'});assert.ok(cert.valid);
 const proof={kind:'cap-deferral',origin:request.observation,steps:cert.continuation.map(p=>({witness:p.witness})),consumed:0};
 const plan=P.plan(request.observation,{timeMs:750,commitment:{observation:request.observation,advice:{evidence:{construction:proof}}}});assert.equal(plan.evidence.strategy,'finite-cap-deferral');workers.at(-1).respond(plan);
 for(const a of plan.witness)g.window.stLab.act(a);g.advance(40);
 const next=workers.at(-1).message;assert.ok(next.commitment);assert.ok(next.commitment.advice.evidence.constructionStage.capDebt.length);assert.equal(next.observation.queue.length,6);
 const continuation=P.plan(next.observation,{timeMs:750,commitment:next.commitment});workers.at(-1).respond(continuation);
 g.window.stLab.act('HD');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));
