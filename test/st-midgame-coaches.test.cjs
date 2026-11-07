'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../st-rules'),B=require('../st-bag'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),PH=require('../st-pattern-history');
const M=require('../st-obligation-resources'),L=require('../st-left-context'),C=require('../st-midgame-coaches'),P=require('../st-planner');
const Context=require('../st-obligation-context'),Provider=require('../st-resource-provider'),Resources=require('../st-obligation-resources');
const coaches=C.create(L),clone=x=>JSON.parse(JSON.stringify(x));
const trial=require('./support/st-resource-trial-1.json');
function observed(until=Infinity){
 let state=R.createState(trial.initial),history=Current.start(state,{fresh:true}),locks=0;const points=[];
 const act=(action,revealed=[])=>{
  const before=state;let next=R.move(state,action);assert.notEqual(next,state);
  for(const type of revealed)next={...next,queue:[...next.queue,type],...(next.bag?{bag:B.consume(next.bag,type)}:{})};
  history=Current.applyActual(history,{before:before,action:action,after:next}).context;state=next;
  if(action==='HD'){locks++;points.push({state,history});}
 };
 for(const step of trial.steps){if(locks>=until)break;act(step.action,step.revealed);}
 return{get state(){return state;},get history(){return history;},points,act};
}
const phase=(state,history)=>coaches.forResources(M.start(state,history)).phase;
test('midgame coaches: only established Extra-Z ledger states select early or late',()=>{
 for(const status of [undefined,'unknown','out-of-profile','invalid','available','used']){
  const expected=status==='available'?'early':status==='used'?'late':'compatibility';
  assert.equal(coaches.forResources({extraZ:status}).phase,expected);
 }
 assert.equal(coaches.forResources(null).phase,'compatibility');
 const a=observed(20),raw={...a.state,extraZ:'available',resources:{extraZ:'available'}};
 assert.equal(phase(raw,Current.start(raw)),'compatibility','raw flags cannot replace observed history');
 const context=clone(Current.exportState(Current.start(a.state)));context.extraZ={status:'used'};
 assert.throws(()=>Current.importState(context,{position:a.state}),/envelope shape/);
});
test('midgame coaches: all phases preserve every current Left tier and the used-Z held-T adjustment',()=>{
 for(const entry of L.catalog)for(const status of ['available','used','unknown'])for(const hold of [null,'T']){
  const state={active:{type:'J'},hold,queue:['I','O','Z'],canHold:true};
  const context={heights:entry.profile.map(h=>h+3),covered:0,resources:{extraZ:status}};
  for(const coach of [coaches.early,coaches.late,coaches.compatibility])
   assert.deepEqual(coach.evaluateLeft(state,context),L.evaluate(state,context));
 }
 const state={active:{type:'J'},hold:'T',queue:[],canHold:true};
 const scored=coaches.late.evaluateLeft(state,{heights:[3,4,4,3],covered:0,resources:{extraZ:'used'}});
 assert.equal(scored.context,'held-T-after-extra-Z');
});
test('midgame coaches: actual optional Z spending changes phase; ordinary Right Z and later clears do not renew it',()=>{
 const t=observed(),p=lock=>t.points[lock-1],at=lock=>phase(p(lock).state,p(lock).history);
 assert.equal(at(14),'compatibility');assert.equal(at(15),'early');
 assert.equal(p(18).state.lastEvent.type,'Z');assert.ok(p(18).state.lastEvent.cells.every(([x])=>x>=8));assert.equal(at(18),'early');
 assert.equal(at(20),'early');assert.equal(p(21).state.lastEvent.type,'Z');assert.ok(p(21).state.lastEvent.cells.every(([x])=>x<7));assert.equal(at(21),'late');
 assert.equal(p(25).state.lastEvent.lines,2);assert.equal(at(25),'late');
 assert.equal(p(29).state.lastEvent.type,'Z');assert.ok(p(29).state.lastEvent.cells.every(([x])=>x>=8));assert.equal(at(29),'late');
});
test('midgame coaches: HOLD, validated session import and Undo retain the original phase authority and obligations',()=>{
 const Session=require('../st-session'),early=observed(20),late=observed(21);
 for(const t of [early,late]){
  const expected=phase(t.state,t.history),before={state:t.state,history:t.history};t.act('HOLD');
  assert.equal(phase(t.state,t.history),expected);
  const saved=Session.create(t.state,{obligationContext:t.history,patternHistory:PH.start(t.state)});
  const got=Session.parse(JSON.stringify(saved));
  assert.equal(coaches.forResources(Resources.start(got.state,got.obligationContext)).phase,expected);
  assert.deepEqual(Context.exportState(got.obligationContext),saved.coaching.obligationContext);assert.equal(got.resourceHistory,undefined);
  assert.equal(phase(before.state,before.history),expected,'immutable Undo boundary keeps original authority');
 }
 assert.equal(phase(early.points[19].state,early.points[19].history),'early','Undo before actual optional spend restores early');
 assert.equal(phase(late.points[20].state,late.points[20].history),'late');
});
test('midgame coaches: planner projected nodes switch early to late without promoting unknown attempted spending',()=>{
 // Expose the actual node builder only in this test realm. Inputs are real
 // recorded public actions; no search target, scorer or ledger is stubbed.
 const filename=require.resolve('../st-planner'),module={exports:{}},req=require('node:module').createRequire(filename);
 const source=fs.readFileSync(filename,'utf8').replace('return Object.freeze({dPatternAdmission,','return Object.freeze({testNodeFor:nodeFor,dPatternAdmission,');
 vm.runInNewContext(source,{module,require:req});assert.equal(typeof module.exports.testNodeFor,'function');
 const makeInitial=(t,known)=>{
  const input=Provider.prepare(t.state,{obligationContext:Current.exportState(known?t.history:Current.start(t.state)),patternHistory:PH.start(t.state)}),summary=Provider.facts(input);assert.equal(input.status,'available');
  return{...P.assess(t.state.board),state:t.state,resources:Provider.startRoute(input,{extendForced:false}),notches:PH.resolve(t.state,PH.start(t.state)),coveredRepair:summary.coveredRepair};
 };
 const project=(initial,witness,parent=null)=>{
  const replay=R.replay(parent?.state??initial.state,witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);
  const event=replay.events[0],p={state:replay.state,event,witness,target:event.target,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};
  return module.exports.testNodeFor(p,parent,initial,0);
 };
 const t=observed(20),initial=makeInitial(t,true);assert.equal(coaches.forResources(initial.resources).phase,'early');
 const spent=project(initial,['R','CW','HD']);assert.equal(spent.resources.extraZ,'used');assert.equal(spent.assessment.coachPhase,'late');
 const next=project(initial,['HOLD','CW','HD'],spent);assert.equal(next.assessment.coachPhase,'late');
 assert.equal(initial.resources.extraZ,'available','projected spending never mutates real root resources');
 const unknown=makeInitial(t,false),invalid=project(unknown,['R','CW','HD']);
 assert.equal(invalid.resources.extraZ,'used');assert.ok(invalid.resources.violations.includes('extra-Z-not-available'));
 assert.equal(invalid.assessment.coachPhase,'compatibility');
 const unknownNext=project(unknown,['HOLD','CW','HD'],invalid);assert.equal(unknownNext.assessment.coachPhase,'compatibility');
 const root=observed(17),right=project(makeInitial(root,true),['R','R','R','R','CW','HD']);
 assert.equal(right.resources.extraZ,'available');assert.equal(right.assessment.coachPhase,'early');
 for(const node of [spent,next,invalid,unknownNext,right]){
  assert.equal(node.rank.length,8,'rank layout stays compatible');
  assert.equal(node.rank[6],0,'early, late and compatibility strategic effort is neutral');
  assert.ok(node.path.every(p=>p.witness.length>0),'executable witnesses remain intact');
 }
 const reset=project(makeInitial(root,true),['HOLD','HOLD','R','R','R','R','CW','HD']);
 assert.deepEqual(clone(reset.rank),clone(right.rank),'equivalent extra-HOLD route changes no strategic rank');
});
test('midgame coaches: classic Worker imports and real page load the same coach factory before the planner',async()=>{
 const context={Date,performance,console,self:{postMessage(){}}};context.globalThis=context;
 context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),context);
 assert.equal(context.STMidgameCoaches.create(context.STLeftContext).forResources(null).phase,'compatibility');
 assert.equal(typeof context.STPlanner.plan,'function');
 const {withPage}=require('./support/page.cjs');await withPage('st-lab.html',{},g=>{
  assert.equal(g.window.STMidgameCoaches.create(g.window.STLeftContext).forResources(null).phase,'compatibility');
  assert.equal(typeof g.window.STPlanner.plan,'function');
 });
});

test('midgame coaches: simulator binds coach source without fabricating it in older baseline closure',()=>{
 const E=require('../scripts/lib/st-simulation.cjs'),V=require('../scripts/lib/st-evaluation.cjs');
 // Synthetic historical hashes exercise protocol shape only, not an old
 // executable or acceptance evidence. A historical closure includes its two
 // retired resource modules and can legitimately predate the coach module.
 const current=E.sourceHashes(),baseline={...current,'st-resource-history.js':'1'.repeat(64),'st-midgame-resources.js':'2'.repeat(64)};delete baseline['st-midgame-coaches.js'];
 assert.match(current['st-midgame-coaches.js'],/^[a-f0-9]{64}$/);
 const input=E.makeInput('empty',1,1),execution={config:E.CONFIG,locks:1,rng:E.RNG_VERSION,lane:'production-wall-clock',execution:'rapid-uninterrupted-actual-witness-v1',episodeMs:11500,node:process.version};
 const protocol={schemaVersion:1,kind:'st-evaluation-protocol',id:'coach-source-binding-test-only',sources:{baseline,candidate:current},execution,cohorts:[{id:'development',kind:'development',pairs:[{id:'one',input,inputHash:V.hash(input)}],criteria:[{id:'locks',metric:'locks',aggregate:'mean-paired-delta',operator:'at-least',threshold:0,uncertainty:{method:'none'}}]}],correctness:[{id:'test',kind:'test',side:'candidate'}]};
 assert.doesNotThrow(()=>V.validateProtocol(protocol));
 assert.doesNotThrow(()=>V.bindProtocol(protocol,'candidate',current,execution,[input]));
 assert.doesNotThrow(()=>V.bindProtocol(protocol,'baseline',baseline,execution,[input]));
 assert.equal(Object.hasOwn(baseline,'st-midgame-coaches.js'),false);
 protocol.sources.candidate=baseline;assert.throws(()=>V.validateProtocol(protocol),/Missing required source hashes/,'Only the historical baseline may omit current coach dependencies');
 protocol.sources.candidate={...current,'st-midgame-coaches.js':'0'.repeat(64)};
 assert.throws(()=>V.bindProtocol(protocol,'candidate',current,execution,[input]),/source mismatch/);
});
