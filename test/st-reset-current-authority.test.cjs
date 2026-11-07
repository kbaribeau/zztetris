'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const R=require('../st-rules'),B=require('../st-bag'),Context=require('../st-obligation-context'),Provider=require('../st-resource-provider'),Resources=require('../st-obligation-resources'),Coach=require('../st-reset-coach'),Policy=require('../st-reset-policy');
const copy=x=>JSON.parse(JSON.stringify(x)),bounds={maxNodes:45000,now:()=>0,deadline:Infinity};
const fixture=require('./support/st-reset-certification-miss.json');
function native(){const prepared=Provider.prepare(fixture.initial,{resourceContext:fixture.resourceContext});assert.equal(prepared.status,'available',prepared.reason);return Context.exportState(prepared.context);}
function coachWithProvider(provider,resources=Resources){
 const file=require.resolve('../st-reset-coach'),req=createRequire(file),box={module:{exports:{}},require:name=>name==='./st-resource-provider'?provider:name==='./st-obligation-resources'?resources:req(name)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),box,{filename:file});return box.module.exports;
}
test('Reset current authority: native duties validate the exact prefix without a historical tape',()=>{
 const obligationContext=native(),saved=copy(obligationContext),result=Coach.check(fixture.initial,fixture.continuation,{...bounds,obligationContext});
 assert.equal(result.valid,true,result.reason);assert.equal(result.node.resource.resetProgress,1);assert.equal(result.node.resource.extraZRemaining,1);
 assert.equal(result.node.resource.route.extendForced,false);assert.deepEqual(result.start.resource.route.projection.position.queue,fixture.initial.queue);
 assert.deepEqual(obligationContext,saved);assert.ok(result.node.resource.hangingS.some(p=>p.id===111));
});
test('Reset current authority: search and recertification share one literal-supply root',()=>{
 let starts=0;const coach=coachWithProvider({...Provider,startRoute:(input,options)=>{starts++;assert.equal(options.extendForced,false);return Provider.startRoute(input,options);}});
 const result=coach.plan(fixture.initial,{...bounds,obligationContext:native(),depth:1,width:8});
 assert.ok(result.target,result.reason);assert.equal(starts,1);assert.equal(result.evidence.reset.entry,false);
 assert.deepEqual(result.evidence.resetSelection.progress,1);
});
test('Reset current authority: a forced public tail never enters literal Reset search supply',()=>{
 const state=R.createState({...fixture.initial,bag:B.fromObserved({observed:[...'JLOSTZ'],startPhase:0})}),obligationContext=native();
 // Current bag knowledge and the observed identity frontier are separate facts.
 // A forced deduction is useful elsewhere, but Reset did not enumerate it.
 obligationContext.inventory.knowledge=copy(state.bag);assert.equal(B.forcedNext(state.bag),'I');
 const result=Coach.check(state,fixture.continuation,{...bounds,obligationContext});assert.equal(result.valid,true,result.reason);
 assert.deepEqual(result.start.resource.route.projection.position.queue,state.queue);
 assert.deepEqual(result.start.resource.queue.map(p=>p.type),state.queue);
 assert.equal(result.start.resource.route.projection.supply.nextSyntheticId,-1);
});
test('Reset current authority: inherited anonymous uncertainty carries and remains disclosed',()=>{
 const obligationContext=native();obligationContext.state.sl.uncertainty.S[0]+=2;obligationContext.state.sl.uncertainty.L[0]+=3;
 const result=Coach.check(fixture.initial,fixture.continuation,{...bounds,obligationContext});
 assert.equal(result.valid,true,result.reason);assert.equal(Resources.resetLosesObligation(result.start.resource,result.node.resource),false);
 assert.ok(result.node.resource.uncertainty.S.aggregate[0]>=2);assert.ok(result.node.resource.uncertainty.L.aggregate[0]>=3);
 const advice=Coach.plan(fixture.initial,{...bounds,obligationContext,depth:1,width:8});assert.ok(advice.target,advice.reason);
 assert.match(advice.reason,/additional S accommodations/);assert.match(advice.reason,/additional L accommodations/);
 assert.ok(advice.evidence.resourceObligations.uncertainty.S.count>=2);
});
test('Reset current authority: known L37 becoming unclassified remains a rejection',()=>{
 const f=require('./fixtures/resource-projection-history.json').cases[1],prepared=Provider.prepare(f.observation,{resourceContext:f.resourceContext});
 let losses=0;const coach=coachWithProvider(Provider,{...Resources,resetLosesObligation:(before,after)=>{const lost=Resources.resetLosesObligation(before,after);losses+=Number(lost);return lost;}});
 const result=coach.check(f.observation,[{witness:f.witness,event:f.event}],{...bounds,obligationContext:Context.exportState(prepared.context)});
 assert.equal(result.valid,false);assert.equal(result.reason,'reset-transition-invalid');assert.equal(losses,1,'The actual Reset loss gate rejects this known-to-unclassified step');
});
test('Reset current authority: policy uses observed frontier, never conflicting raw bag or compatibility fields',()=>{
 const f=require('./support/reset-history.cjs')(),input=Provider.prepare(f.state,{resourceContext:f.resourceContext});
 const state=R.createState({board:f.state.board,active:'J',queue:[],bag:B.fromObserved({observed:[...'IJLOSZ'],startPhase:0})});
 const facts={...input.facts,observedRemainingTypes:['I'],publicBag:{remainingTypes:['T']}};
 const result=Policy.consider(state,facts);assert.equal(result.arrival.kind,'public-forced-non-T-before-unseen-T');assert.equal(result.arrival.nonTBefore,2);
 const unknown=Policy.consider(state,{...facts,availability:'unknown',coverage:{status:'complete'}});assert.equal(unknown.status,'unknown-history');
 const unavailable=Policy.consider(state,{...facts,status:'unavailable',coverage:{status:'complete'}});assert.equal(unavailable.status,'unknown-history');
});
test('Reset current authority: projected completion survives request retirement while actual status becomes inactive zero',()=>{
 const f=require('./support/st-reset-live-cycle.json');let state=R.createState(f.initial),context=Provider.prepare(state,{resourceContext:f.resourceContext}).context;
 context=Context.beginReset(context,{position:state,candidate:true}).context;let checked=null;
 for(const [index,step]of f.steps.entries()){
  if(index===f.steps.length-1){checked=Coach.check(state,[{witness:step.actions.map(p=>p.action),event:step.event}],{...bounds,obligationContext:Context.exportState(context)});assert.equal(checked.valid,true,checked.reason);}
  for(const {action,revealed}of step.actions){const before=state;state=R.move(before,action);for(const type of revealed)state={...state,queue:state.queue.concat(type),bag:B.consume(state.bag,type)};context=Context.applyActual(context,{before,action,after:state}).context;assert.equal(context.status,'available',context.reason);}
 }
 assert.equal(checked.node.resource.resetProgress,2);assert.equal(checked.node.resource.resetCompleted,true);assert.equal(checked.node.done,true);
 const facts=Context.resolve(context,{position:state});assert.deepEqual(facts.reset,{status:'inactive',progress:0});assert.equal(facts.extraZ.remaining,2);
 assert.equal(Coach.plan(state,{...bounds,obligationContext:Context.exportState(context)}),null);
});
