'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/lib/st-simulation.cjs');
const CLI=require('../scripts/simulate-st.cjs');
const R=require('../st-rules'),B=require('../st-bag'),P=require('../st-planner');
function hd(state,hold=false){const witness=hold?['HOLD','HD']:['HD'],proof=R.replay(state,witness);assert.ok(proof.valid);return{status:'test-only',target:proof.events[0].target,witness,hold,holdCount:Number(hold),continuation:[],evidence:{opening:true}};}
const stub={...P,startOpeningSession:()=>({active:true,clear:null}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,cycleResources:()=>({tsds:0,quads:0,pocket:0,centerCompletions:0}),advance:()=>null};
test('simulation/seeded streams are repeatable, valid and separate from observation',()=>{
 for(const scenario of ['empty','stable']){
  const a=E.makeInput(scenario,123,8),b=E.makeInput(scenario,123,8);
  assert.deepEqual(a,b);assert.notDeepEqual(a.future,E.makeInput(scenario,124,8).future);
  let bag=a.initial.bag;for(const piece of a.future){bag=B.consume(bag,piece);assert.deepEqual(B.validate(bag),[]);}
  const session=E.createSession(a,stub),request=session.request(1,E.CONFIG);
  assert.equal(request.observation.queue.length,6);
  for(const key of ['future','seed','rng','inputHash'])assert.equal(key in request.observation,false);
  assert.equal('future' in request,false);
 }
});
test('simulation/actual empty HOLD reveals preview before lock and does not leak private future',()=>{
 const input=E.makeInput('empty',123,2),calls=[];
 const api={...stub,updateOpeningSession(session,before,after,event){calls.push({before,after,event});return session;}};
 const session=E.createSession(input,api),before=session.state,advice=hd(before,true),actual=session.execute(advice);
 assert.equal(actual.actions[0].draws,1);assert.equal(actual.actions[1].draws,2);
 assert.equal(calls.length,1);assert.equal(calls[0].before.active.type,before.queue[0]);
 assert.equal(calls[0].before.hold,before.active.type);assert.equal(calls[0].before.queue.length,6);
 assert.equal(calls[0].after.queue.length,6);assert.equal(session.state.bag.observedCount,before.bag.observedCount+2);
 assert.equal(actual.actions[0].adviceAdvanced,false);
});
test('simulation/commitment admission excludes opening and advances after revealed lock',()=>{
 const input=E.makeInput('empty',123,2),calls=[];
 const api={...stub,resourceGoal:()=>true,cycleResources:()=>({tsds:1,quads:0,pocket:0}),continueCommitment(before,after,advice,event){calls.push({before,after,advice,event});return null;}};
 const s=E.createSession(input,api);s.execute(hd(s.state));assert.equal(calls.length,0);
 const advice=hd(s.state);advice.evidence={};const origin=E.publicObservation(s.state);s.execute(advice);
 assert.equal(calls.length,1);assert.deepEqual(calls[0].before,origin);assert.equal(calls[0].after.queue.length,6);
 assert.equal(s.request(3,E.CONFIG).commitment,null);assert.equal(s.request(3,E.CONFIG).previous,null);
});
test('simulation/invalid target, hold metadata and multi-lock witness are rejected before execution',()=>{
 const input=E.makeInput('empty',1,2),state=input.initial,good=hd(state);
 assert.throws(()=>E.validateAdvice(state,{...good,target:{...good.target,x:99}}),/Target/);
 assert.throws(()=>E.validateAdvice(state,{...good,hold:true}),/Hold/);
 assert.throws(()=>E.validateAdvice(state,{...good,witness:['HD','HD']}),/witness/);
 assert.throws(()=>E.validateAdvice(state,{...good,holdCount:1}),/Hold/);
});
test('simulation/abstention is not top-out or an illegal recommendation',()=>{
 const result=E.runEpisode(E.makeInput('empty',1,3),{api:stub,planner:()=>({status:'no-supported-continuation-found',reason:'test abstention'})});
 assert.equal(result.stop,'abstention');assert.equal(result.locks,0);assert.equal(result.invalidRecommendations,0);assert.equal(result.censored,false);assert.equal(CLI.failure(result),false);
});
test('simulation/capped actual-action run replays without rerunning search',()=>{
 const input=E.makeInput('empty',13,2),records=[];
 const result=E.runEpisode(input,{api:stub,planner:req=>hd(req.observation),onRecord:r=>records.push(r)});
 assert.equal(result.stop,'lock-cap');assert.equal(result.censored,true);assert.equal(result.locks,2);
 const replay=E.replayRecords(input,records,stub);assert.equal(replay.verified,true);assert.equal(replay.locks,2);
 assert.deepEqual(replay.finalObservation,result.finalObservation);
 const corrupt=E.clone(records);corrupt[0].after.hold='T';assert.throws(()=>E.replayRecords(input,corrupt,stub));
});
test('simulation/worker protocol executes actual entry code and fresh globals without a search',()=>{
 const planner=E.workerPlanner(),state=E.makeInput('empty',1,1).initial;state.topOut=true;
 const request={type:'plan',id:1,observation:state,previous:null,commitment:null,options:{...E.CONFIG,openingPhase:false}};
 const a=planner(request),b=planner({...request,id:2});
 assert.equal(a.target,null);assert.equal(a.status,b.status);assert.equal(a.status,P.decide(state,request.options).status);
});
test('simulation/invalid returned recommendation and worker errors have distinct stops',()=>{
 const input=E.makeInput('empty',1,2);
 const a=E.runEpisode(input,{api:stub,planner:()=>({target:{},witness:['HD']})});
 assert.equal(a.stop,'invalid-recommendation');assert.equal(a.invalidRecommendations,1);assert.equal(a.locks,0);
 const b=E.runEpisode(input,{api:stub,planner:()=>{throw Error('failed worker');}});assert.equal(b.stop,'planner-error');
});
test('simulation/CLI rejects missing values and unknown options',()=>{
 assert.throws(()=>CLI.parse(['--seeds']),/Missing/);assert.throws(()=>CLI.parse(['--compare','one']),/two/);assert.throws(()=>CLI.parse(['--mystery']),/Unknown/);
 assert.deepEqual(CLI.parse(['--preset','quick','--scenario','both']),{preset:'quick',scenario:'both'});
});
test('simulation/paired comparisons preserve censored caps and reject mismatched inputs',()=>{
 const episode={scenario:'empty',seed:1,inputHash:'same',locks:2,stop:'lock-cap',censored:true,profile:[{lines:0,height:2},{lines:0,height:4}]};
 const manifest={schemaVersion:1,complete:true,config:E.CONFIG,locks:2,rng:E.RNG_VERSION,lane:'production-wall-clock',execution:'rapid-uninterrupted-actual-witness-v1',episodes:[episode]};
 const report=CLI.compare(manifest,E.clone(manifest));assert.equal(report.cohorts.empty.ties,1);assert.equal(report.cohorts.empty.baseline.medianStopLock,null);
 const bad=E.clone(manifest);bad.episodes[0].inputHash='other';assert.throws(()=>CLI.compare(manifest,bad),/inputs differ/);
 const timed=E.clone(manifest);timed.episodes[0].stop='wall-cap';assert.throws(()=>CLI.compare(manifest,timed),/wall censoring/);
});

test('simulation/real empty worker has worker clocks even with exhausted budget',()=>{
 const state=E.makeInput('empty',1,1).initial;
 const result=E.workerPlanner()({type:'plan',id:1,observation:state,previous:null,commitment:null,options:{...E.CONFIG,timeMs:0,openingPhase:true}});
 assert.equal(typeof result.status,'string');assert.equal(result.target,null);
});

test('simulation/actual page and runner agree on rapid empty HOLD, refill and lock request',()=>{
 const {withPage}=require('./support/page.cjs');
 return withPage('st-lab.html',{},g=>{
  const workers=[];
  g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=E.clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
  const seed=9876,rng=E.random(seed);
  const bag=()=>{const pieces=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=Math.floor(rng()*(i+1));[pieces[i],pieces[j]]=[pieces[j],pieces[i]];}return pieces;};
  bag();const future=[...bag(),...bag()];
  g.window.Math.random=E.random(seed);
  const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));g.advance(40);
  const initial=workers.at(-1).message;
  const session=E.createSession({scenario:'empty',initial:initial.observation,future});
  assert.deepEqual(session.request(initial.id,E.CONFIG),initial);
  const advice=hd(initial.observation,true);workers.at(-1).respond(advice);
  const actual=session.execute(advice);
  for(const action of advice.witness)g.window.stLab.act(action);
  g.advance(40);const next=workers.at(-1).message;
  assert.deepEqual(session.request(next.id,E.CONFIG),next);
  assert.deepEqual(E.publicObservation(session.state),E.clone(g.snapshot()));assert.equal(actual.actions[0].draws,1);
 });
});

test('simulation/true top-out and exhausted private input are distinct outcomes',()=>{
 const top=E.makeInput('empty',1,1);top.initial.topOut=true;
 const a=E.runEpisode(top,{api:stub,planner:()=>{throw Error('must not plan a top-out');}});assert.equal(a.stop,'top-out');assert.equal(a.locks,0);
 const finite=E.makeInput('empty',1,1);finite.future=[];
 const b=E.runEpisode(finite,{api:stub,planner:req=>hd(req.observation)});assert.equal(b.stop,'input-exhausted');assert.equal(b.censored,false);
});


test('simulation/replay ignores only regenerated commitment timing, never goals, events or supply',()=>{
 const input=E.makeInput('empty',13,2),records=[];let duration=0;
 const api={...stub,resourceGoal:()=>true,continueCommitment:(_before,after)=>({goal:{kind:'checked-goal'},continuation:[{event:{type:'T',lines:2}}],metrics:{elapsedMs:++duration,nodes:4}})};
 E.runEpisode(input,{api,planner:req=>({...hd(req.observation),evidence:{}}),onRecord:r=>records.push(r)});
 const replay=E.replayRecords(input,records,api);assert.equal(replay.locks,2);assert.deepEqual(replay.ignoredVolatileRequestFields,['commitment.advice.metrics.elapsedMs']);
 for(const mutate of [r=>{r.request.commitment.advice.goal.kind='forged';},r=>{r.request.commitment.advice.continuation[0].event.lines=4;},r=>{r.request.commitment.observation.queue[0]='X';},r=>{r.request.commitment.advice.metrics.nodes=999;}]){const bad=E.clone(records);mutate(bad.find(r=>r.kind==='lock'&&r.lock===2));assert.throws(()=>E.replayRecords(input,bad,api),/Public decision state diverged/);}
});

test('simulation/replay reports timed display-retention drift without weakening game-state checks',()=>{
 const input=E.makeInput('empty',13,2),records=[];
 const live={...stub,advance:(_state,advice)=>advice};
 E.runEpisode(input,{api:live,planner:req=>hd(req.observation,true),onRecord:r=>records.push(r)});
 const replay=E.replayRecords(input,records,stub);
 assert.equal(replay.verified,true);assert.equal(replay.locks,2);
 assert.deepEqual(replay.ignoredVolatileActionFields,['adviceAdvanced']);
 assert.deepEqual(replay.adviceAdvanceMismatches,[1,2].map(lock=>({lock,index:0,action:'HOLD',recorded:true,replayed:false})));
 const unchanged=E.replayRecords(input,records,live);assert.deepEqual(unchanged.adviceAdvanceMismatches,[]);
 for(const mutate of [
  r=>{r.actions[0].action='L';},r=>{r.actions[0].draws++;},r=>{r.actions[0].observationHash='forged';},
  r=>{r.event.type='X';},r=>{r.after.hold='X';},r=>{r.request.observation.queue[0]='X';},
  r=>{r.actions[0].adviceAdvanced='true';},r=>{r.actions.at(-1).adviceAdvanced=false;},
  r=>{r.advice.witness=['HD'];},r=>{r.advice.target.x=99;},
 ]){const corrupt=E.clone(records);mutate(corrupt.find(r=>r.kind==='lock'));assert.throws(()=>E.replayRecords(input,corrupt,stub));}
});
