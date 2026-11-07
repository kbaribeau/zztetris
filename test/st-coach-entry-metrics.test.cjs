'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../scripts/lib/st-coach-entry-metrics.cjs'),E=require('../scripts/lib/st-simulation.cjs');
const R=require('../st-rules'),P=require('../st-planner'),H=require('../st-obligation-context'),B=require('../st-bag');
const zero={opening:0,earlyMidgame:0,lateMidgame:0,reset:0,compatibility:0};
const active={active:true},inactive={active:false};
test('coach entries: initial opening and immediate failure count once, not per request',()=>{
 const records=[],summary=E.runEpisode(E.makeInput('empty',1,2),{planner:()=>({status:'no-supported-continuation-found'}),onRecord:r=>records.push(r)});
 assert.deepEqual(summary.coachEntries,{...zero,opening:1});assert.equal(summary.currentCoach,'opening');assert.equal(summary.stop,'abstention');
 assert.equal('openingCompletedAt'in summary,false);assert.deepEqual(records[0].coachEntries,summary.coachEntries);
 const t=C.create('opening');t.enter('opening',1,'same');t.enter('opening',2,'same');assert.deepEqual(t.snapshot().coachEntries,{...zero,opening:1});
});
test('coach entries: actual transitions accumulate across repeated cycles and handback at final lock',()=>{
 const t=C.create('opening');
 for(const [coach,lock]of [['earlyMidgame',20],['lateMidgame',40],['reset',50]])t.enter(coach,lock,'actual');
 assert.deepEqual(t.snapshot().coachEntries,{...zero,opening:1,earlyMidgame:1,lateMidgame:1,reset:1});
 t.enter('reset',51,'first-T');assert.equal(t.snapshot().coachEntries.earlyMidgame,1);
 t.enter('earlyMidgame',60,'second-T-final-capped-lock');
 assert.deepEqual(t.snapshot().coachEntries,{...zero,opening:1,earlyMidgame:2,lateMidgame:1,reset:1});
 t.enter('lateMidgame',70,'Z-used');t.enter('reset',80,'reset-takeover');
 assert.deepEqual(t.snapshot().coachEntries,{...zero,opening:1,earlyMidgame:2,lateMidgame:2,reset:2});
 assert.equal(t.snapshot().coachTransitions.at(-1).afterLock,80);
 const copy=t.snapshot();copy.coachEntries.reset=100;copy.coachTransitions[0].coach='forged';assert.equal(t.snapshot().coachEntries.reset,2);assert.equal(t.snapshot().coachTransitions[0].coach,'opening');
});
test('coach entries: phase is actual history not projected evidence or notch geometry',()=>{
 assert.equal(C.phase(active,{extraZ:{status:'used'},reset:{status:'inactive'}}),'opening');
 assert.equal(C.phase(inactive,{extraZ:{status:'used'},reset:{status:'active'}}),'reset');
 assert.equal(C.phase(inactive,{extraZ:{status:'available'},reset:{status:'inactive'}}),'earlyMidgame');
 assert.equal(C.phase(inactive,{extraZ:{status:'used'}}),'lateMidgame');
 for(const status of ['unknown','out-of-profile',undefined])assert.equal(C.phase(inactive,{extraZ:{status}}),'compatibility');
 const t=C.create('opening');t.enter(C.phase(inactive,{extraZ:{status:'used'}}),10,'handoff');assert.equal(t.snapshot().coachEntries.earlyMidgame,0,'No synthetic early entry');
});
test('coach entries: imported unknown history and infrastructure failures stay explicit',()=>{
 const summary=E.runEpisode(E.makeInput('stable',1,2),{planner:()=>{throw Error('worker failed');}});
 assert.deepEqual(summary.coachEntries,{...zero,compatibility:1});assert.equal(summary.coachHistoryScope,'observed-from-import');assert.equal(summary.stop,'planner-error');
 assert.equal(summary.censored,false);assert.equal(summary.currentCoach,'compatibility');
});
test('coach entries: Reset takeover that immediately abstains counts, speculative probes do not',()=>{
 const input=E.makeInput('stable',1,2);
 const failed=E.runEpisode(input,{planner:()=>({target:null,status:'budget-exhausted',evidence:{strategy:'reset-coach'}})});
 assert.deepEqual(failed.coachEntries,{...zero,compatibility:1,reset:1});assert.equal(failed.currentCoach,'reset');assert.equal(failed.reset.starts.length,0,'No actual reset marker/lock was executed');
 const probe=E.runEpisode(input,{planner:()=>({target:null,status:'budget-exhausted',assessment:{coachPhase:'late'},metrics:{resetOrdinaryProbe:{selected:true}},evidence:{resetConsideration:{status:'ordinary-proof-preferred'}}})});
 assert.deepEqual(probe.coachEntries,{...zero,compatibility:1});
});
test('coach entries: real Reset history returns early immediately at second qualifying T',()=>{
 const f=require('./support/st-reset-live-cycle.json');let state=R.createState(f.initial),history=H.importState(E.clone(f.obligationContext),{position:state});
 const tracker=C.create(C.phase(inactive,H.resolve(history,{position:state})),{imported:true}),completions=[];assert.equal(tracker.snapshot().currentCoach,'lateMidgame');
 history=H.beginReset(history,{position:state,candidate:true}).context;tracker.enter(C.phase(inactive,H.resolve(history,{position:state})),0,'reset-entry');
 for(const [i,step]of f.steps.entries()){
  for(const {action,revealed}of step.actions){const before=state;state=R.move(state,action);for(const type of revealed)state={...state,queue:state.queue.concat(type),bag:B.consume(state.bag,type)};const transition=H.applyActual(history,{before,action,after:state});history=transition.context;for(const effect of transition.effects)if(effect.status==='reset-completed')completions.push({afterLock:i+1,effect});}
  assert.deepEqual(state.lastEvent,step.event);tracker.enter(C.phase(inactive,H.resolve(history,{position:state})),i+1,'actual-lock');
  if(i<f.steps.length-1)assert.equal(tracker.snapshot().currentCoach,'reset');
 }
 assert.deepEqual(tracker.snapshot().coachEntries,{...zero,lateMidgame:1,reset:1,earlyMidgame:1});
 assert.equal(tracker.snapshot().coachTransitions.at(-1).afterLock,f.steps.length);
 assert.equal(H.resolve(history,{position:state}).reset.progress,0);assert.equal(history.state.account.reset.status,'inactive');
 assert.equal(completions.length,1);assert.equal(completions[0].afterLock,f.steps.length,'Completion is emitted on the actual second qualifying T, not retained in the current account');
});
test('coach entries: successful simulation locks retain phase counts and replay unaffected',()=>{
 const input=E.makeInput('empty',13,2),records=[];
 const api={...P,startOpeningSession:()=>({active:true}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,advance:()=>null};
 const summary=E.runEpisode(input,{api,planner:req=>{const p=R.replay(req.observation,['HD']);return{target:p.events[0].target,witness:['HD'],hold:false,evidence:{opening:true}};},onRecord:r=>records.push(r)});
 assert.equal(summary.stop,'lock-cap');assert.equal(summary.censored,true);assert.deepEqual(summary.coachEntries,{...zero,opening:1});
 assert.equal(E.replayRecords(input,records,api).verified,true);assert.equal(records.filter(r=>r.kind==='lock').length,2);
});
test('coach entries: accepted handoff survives a later execution failure',()=>{
 const input=E.makeInput('empty',13,1);
 const api={...P,acceptOpeningResult:()=>({active:false}),updateOpeningSession:()=>{throw Error('after actual lock');}};
 const summary=E.runEpisode(input,{api,planner:req=>{const p=R.replay(req.observation,['HD']);return{phase:'maintenance',target:p.events[0].target,witness:['HD'],hold:false,evidence:{openingHandoff:{}}};}});
 assert.equal(summary.stop,'execution-error');assert.equal(summary.final.mass,4);
 assert.deepEqual(summary.coachEntries,{...zero,opening:1,compatibility:1});
 assert.equal(summary.currentCoach,'compatibility');assert.equal(summary.coachTransitions.at(-1).afterLock,0,'Handoff precedes the failed lock processing');
});
test('coach entries: simulation counts Reset completion on its final capped lock',()=>{
 const f=require('./support/st-reset-live-cycle.json'),Context=require('../st-obligation-context');
 const converted={context:Context.importState(f.obligationContext,{position:R.createState(f.initial)})};
 // Import the compact current checkpoint once. The runner owns all subsequent
 // real receipts and Reset completion effects, including the final lock.
 const input={scenario:'stable',seed:0,initial:f.initial,obligationContext:Context.exportState(converted.context),locks:f.steps.length,future:f.steps.flatMap(s=>s.actions.flatMap(a=>a.revealed)),inputHash:'test-real-reset-current'};
 let index=0;
 const summary=E.runEpisode(input,{api:{...P,startOpeningSession:()=>({active:false}),updateOpeningSession:s=>s,advance:()=>null,continueCommitment:()=>null},planner:request=>{
  const step=f.steps[index++],witness=step.actions.map(a=>a.action),p=R.replay(request.observation,witness);
  return{target:p.events[0].target,witness,hold:witness.includes('HOLD'),evidence:{strategy:'reset-coach'}};
 }});
 assert.equal(summary.stop,'lock-cap',summary.detail);assert.equal(summary.locks,f.steps.length);assert.equal(summary.reset.completions.length,1);
 assert.deepEqual(E.clone(summary.coachEntries),{...zero,lateMidgame:1,reset:1,earlyMidgame:1});
 assert.equal(summary.currentCoach,'earlyMidgame');assert.equal(summary.coachTransitions.at(-1).afterLock,input.locks);
});
