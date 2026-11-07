'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),B=require('../st-bag'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources'),P=require('../st-planner');
const Context=require('../st-obligation-context'),Provider=require('../st-resource-provider'),Resources=require('../st-obligation-resources');
const clone=x=>JSON.parse(JSON.stringify(x)),ids=(d,type)=>d['hanging'+type].evidence.map(e=>e[type.toLowerCase()+'Id']);
function live(types){
 let state=R.createState({active:types[0],queue:types.slice(1),streamCursor:1,bag:B.fromObserved({observed:types,startPhase:0})}),history=Current.start(state,{fresh:true}),effects=[];
 const act=(action,revealed=[])=>{const next=R.move(state,action);assert.notEqual(next,state);const after={...next,queue:[...next.queue,...revealed],bag:revealed.reduce((bag,t)=>B.consume(bag,t),next.bag)};const result=Current.applyActual(history,{before:state,action,after});history=result.context;effects.push(...result.effects);state=after;assert.equal(history.status,'available');};
 return{act,get effects(){return effects;},lock(witness=['HD'],revealed=[]){for(const a of witness)act(a,a==='HD'?revealed:[]);},handoff(){history=Current.handoff(history,{position:state}).context;},get state(){return state;},get history(){return history;},get summary(){return CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));}};
}
const left=['L','L','L','HD'];
test('handoff SL: either unused partner is carried regardless of its opening partner region',()=>{
 for(const [used,unused]of[['S','L'],['L','S']])for(const witness of[left,['HD'],['R','R','R','HD']]){
  const a=live([used,unused,'I','J','O','T','Z']);a.lock(witness);
  const before=a.summary;a.handoff();const d=a.summary;
  assert.deepEqual(ids(d,unused),[2]);assert.deepEqual(ids(d,used),[]);
  assert.equal(d['hanging'+unused].evidence[0].bag,0);assert.equal(d.instances.active.id,2);
  assert.deepEqual(d.center,before.center,'Real geometric pending/debt/closed targets are not rebased');
  assert.deepEqual(d.coveredRepair,before.coveredRepair,'Covered-cell repair survives allocation rebase');
  assert.equal('allocations'in d,false);assert.equal('pairs'in d,false,'Current facts carry no lifetime archives');
  assert.equal(d.extraZ.status,before.extraZ.status,'SL rebase does not create Extra-Z permission');
 }
});
test('handoff SL: both used is settled without a pairing requirement; neither used creates no obligation',()=>{
 for(const used of['S','L']){
  const other=used==='S'?'L':'S',a=live([used,other,'I','J','O','T','Z']);
  a.handoff();assert.deepEqual(ids(a.summary,'S'),[]);assert.deepEqual(ids(a.summary,'L'),[]);
  const b=live([used,other,'I','J','O','T','Z']);b.lock(['HD']);b.lock(['HD']);
  assert.equal(b.effects.filter(p=>p.domain==='center'&&p.status==='fulfilled').length,0,'Literal opening locks do not complete a recognized pair');
  const before=b.summary;b.handoff();
  for(const type of['S','L']){assert.deepEqual(ids(b.summary,type),[]);assert.deepEqual(b.summary['hanging'+type].unclassified,[]);}
  assert.deepEqual(b.summary.center,before.center);assert.deepEqual(b.summary.coveredRepair,before.coveredRepair);
 }
});
test('handoff SL: HOLD is unused and repeated swaps keep the original bag and identity',()=>{
 const a=live(['L','S','I','J','O','T','Z']);a.act('HOLD');a.lock(['HD']);
 const held=a.summary.instances.hold;assert.equal(held.id,1);assert.equal(held.type,'L');assert.equal('allocation'in held,false);
 a.handoff();assert.deepEqual(ids(a.summary,'L'),[1]);
 for(let i=0;i<4;i++){a.act('HOLD');assert.deepEqual(ids(a.summary,'L'),[1]);assert.equal(a.summary.hangingL.evidence[0].bag,0);}
 const before=a.summary,projected=M.start(a.state,a.history,{extendForced:false});assert.deepEqual(projected.hangingL,[{id:1,bag:0,known:true}]);
 const witness=['HOLD',...left],r=R.replay(a.state,witness);assert.equal(r.valid,true);
 const expected=M.step(a.state,{witness,event:r.events[0],state:r.state},projected);a.lock(witness);
 assert.deepEqual(ids(a.summary,'L'),[]);assert.deepEqual(expected.hangingL,[]);
});
test('handoff SL: old held S plus unused current S remain two distinct hanging identities',()=>{
 const a=live(['S','L','I','J','O','T','Z']);a.act('HOLD',['L']);
 const next=['S','I','J','O','T','Z'];
 for(let i=0;i<6;i++)a.lock(i%2?['R','R','R','HD']:left,[next[i]]);
 assert.equal(a.state.active.type,'L');a.lock(left,['I']);
 assert.equal(a.summary.instances.hold.id,1);assert.equal(a.summary.instances.active.id,9);
 a.handoff();const d=a.summary;
 assert.deepEqual(d.hangingS.evidence.map(e=>[e.sId,e.lId,e.bag]),[[1,2,0],[9,8,1]]);
 assert.equal(d.hangingS.status,'out-of-profile','Existing multiple-surplus profile label stays conservative');
 assert.deepEqual(M.start(a.state,a.history,{extendForced:false}).hangingS,[{id:1,bag:0,known:true},{id:9,bag:1,known:true}]);
 a.lock(left);assert.deepEqual(ids(a.summary,'S'),[1],'Paying the current S cannot consume the old held identity');
 a.lock(['HOLD',...left]);assert.deepEqual(ids(a.summary,'S'),[]);
});
test('handoff SL: worker/session replay and immutable Undo state rederive the boundary instead of importing labels',()=>{
 const a=live(['S','L','I','J','O','T','Z']);a.lock(['HD']);const before=a.history,pre=a.summary;
 a.handoff();const boundary=a.summary,context=clone(Current.exportState(a.history));
 const annotated=clone(context);annotated.hangingL={status:'none-observed',evidence:[]};annotated.pieces={};
 assert.throws(()=>Current.importState(annotated,{position:a.state}),/envelope shape/);
 assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(a.state,{obligationContext:Current.exportState(Current.importState(context,{position:a.state}))})),boundary);
 assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(a.state,{obligationContext:Current.exportState(before)})),pre,'Undo snapshot remains unmarked and immutable');
 assert.deepEqual(ids(pre,'L'),[]);assert.deepEqual(ids(boundary,'L'),[2]);
 const state=a.state;a.lock(left);assert.deepEqual(ids(a.summary,'L'),[]);
 assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(Current.importState(context,{position:state}))})),boundary,'Returning across the lock restores the exact handoff obligation');
 const Session=require('../st-session'),session=Session.create(state,{obligationContext:Current.importState(context,{position:state}),openingPhase:false});
 const restored=Session.prepare(clone(session)),current=Context.resolve(restored.obligationContext,{position:restored.state});assert.deepEqual(Context.exportState(restored.obligationContext),session.coaching.obligationContext);assert.deepEqual(ids(current,'L'),ids(boundary,'L'));assert.deepEqual(ids(current,'S'),ids(boundary,'S'));assert.equal(restored.obligationContext.state.sl.handoff,true);assert.equal(restored.resourceHistory,undefined);
 const partial=Current.handoff(Current.start(state),{position:state}).context;assert.equal(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(partial)})).hangingL.status,'unknown','No invented bag identity from a snapshot');
});
test('handoff SL: H01 closes consumed opening pairs and carries only its held current-bag L',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),history=Current.importState(f.obligationContext,{position:f.position}),before=CurrentProvider.facts(CurrentProvider.prepare(f.position,{obligationContext:Current.exportState(history)})),marked=Current.handoff(history,{position:f.position}).context,d=CurrentProvider.facts(CurrentProvider.prepare(f.position,{obligationContext:Current.exportState(marked)}));
 assert.equal(d.status,'available');assert.equal(marked.state.sl.handoff,true);assert.equal(d.instances.hold.type,'L');
 assert.deepEqual(d.hangingS.evidence,[]);assert.deepEqual(d.hangingS.unclassified,[]);
 assert.deepEqual(d.hangingL.evidence.map(e=>[e.lId,e.sId,e.bag]),[[17,15,2]]);
 assert.deepEqual(d.center,before.center);assert.deepEqual(d.coveredRepair,before.coveredRepair);
 const projected=M.start(f.position,marked,{extendForced:false});assert.deepEqual(projected.hangingL,[{id:17,bag:2,known:true}]);assert.deepEqual(projected.hangingS,[]);assert.deepEqual(projected.unclassifiedS,[]);
});
test('handoff SL: unobserved same-bag partner is deferred, then binds only its actual revealed identity',()=>{
 const a=live(['S','L','I','J','O','T','Z']);
 for(let i=0;i<8;i++)a.lock(i%2?['R','R','R','HD']:left,i<3?[['L','I','J'][i]]:[]);
 assert.equal(a.state.active.type,'I');assert.deepEqual(a.state.queue,['J']);a.handoff();
 assert.deepEqual(a.summary.hangingS.evidence.map(e=>[e.sId,e.lId,e.bag,e.deferred]),[[null,8,1,true]]);
 a.lock(left,['S']);assert.deepEqual(a.summary.hangingS.evidence.map(e=>[e.sId,e.lId,e.bag]),[[11,8,1]]);
 assert.equal(a.summary.instances.queue[0].id,11);assert.equal(a.summary.instances.queue[0].bag,1);
});
test('handoff SL: actual Center diversion debt and covered repair remain intact when consumed opening pairs settle',()=>{
 const f=require('./support/st-resource-trial-1.json');let state=R.createState(f.initial),history=Current.start(state,{fresh:true}),locks=0;
 for(const step of f.steps){if(locks===27)break;const next=R.move(state,step.action),after={...next,queue:[...next.queue,...step.revealed],...(next.bag?{bag:step.revealed.reduce((bag,type)=>B.consume(bag,type),next.bag)}:{})};history=Current.applyActual(history,{before:state,action:step.action,after:after}).context;state=after;if(step.action==='HD')locks++;}
 for(const action of left){const next=R.move(state,action);history=Current.applyActual(history,{before:state,action:action,after:next}).context;state=next;}
 const before=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.ok(before.center.debt.length,'Fixture has a real diverted exact Center target');
 const d=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(Current.handoff(history,{position:state}).context)}));assert.deepEqual(d.center,before.center);assert.deepEqual(d.coveredRepair,before.coveredRepair);assert.deepEqual(d.dPattern,before.dPattern);
});
function intercepted(extras){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?{...P,...extras}:require(id.replace('./','../')),Date});return module.exports;}
test('handoff SL: first H01 maintenance search receives the marked ledger without changing live history',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),before=clone(f.obligationContext);let calls=0;
 const O=intercepted({plan:(state,options)=>{calls++;const input=Provider.prepare(state,options),d=Provider.facts(input);assert.equal(Provider.frame(input).state.sl.handoff,true);assert.equal(d.availability,'known');assert.deepEqual(ids(d,'S'),[]);assert.deepEqual(ids(d,'L'),[17]);assert.equal(options.openingPhase,false);return{target:null,status:'budget-exhausted',metrics:{nodes:1}};}});
 assert.equal(O.handoff(f.position,f.openingClear,{obligationContext:f.obligationContext,maxNodes:12000,deadline:Infinity,now:()=>0}),null);assert.equal(calls,1);assert.deepEqual(f.obligationContext,before);assert.equal(f.obligationContext.state.sl.handoff,false);
});
test('handoff SL: forecast-first validation and fallback both receive the identical boundary context',()=>{
 const f=require('./fixtures/opening-forecast-public.json');let first=null,calls=0;
 const O=intercepted({revalidateOpeningForecast:(state,_steps,options,work)=>{first=clone(Provider.frame(Provider.prepare(state,options)));assert.equal(first.state.sl.handoff,true);work.nodes=1;return null;},plan:(state,options)=>{calls++;assert.deepEqual(clone(Provider.frame(Provider.prepare(state,options))),first);return{target:null,status:'budget-exhausted',metrics:{nodes:1}};}});
 O.handoff(f.request.observation,f.request.options.openingClear,{...f.request.options,openingForecast:f.forecast,maxNodes:12000,deadline:Infinity,now:()=>0});assert.ok(first);assert.equal(calls,1);
});
test('handoff SL: repeated phase marker cannot erase post-handoff accommodation',()=>{
 const a=live(['L','S','I','J','O','T','Z']);a.handoff();a.lock(left);a.lock(['R','R','R','R','HD']);
 const before=a.summary,context=Current.exportState(a.history);assert.deepEqual(before.hangingS.unclassified,[{bag:0,sId:2,lId:1,requiresAccommodation:true}]);assert.equal(before.hangingS.unclassifiedCount,1);
 a.handoff();assert.deepEqual(a.summary,before);assert.deepEqual(Current.exportState(a.history),context,'Exactly-once rebase cannot launder later debt');
 const supplied=clone(context);supplied.state.sl.residuals[0].S.region='left';supplied.state.sl.residuals[0].S.requiresAccommodation=false;const imported=Current.importState(supplied,{position:a.state});assert.equal(Current.resolve(imported,{position:a.state}).hangingS.unclassifiedCount,0,'An explicitly trusted current snapshot owns its stated facts, without history proof');
 const obsolete=clone(context);obsolete.handoffAtAction=0;assert.throws(()=>Current.importState(obsolete,{position:a.state}),/envelope shape/);
});
test('handoff SL: shared recovery gating uses boundary facts even when opening diagnostics had unclassified S',()=>{
 const q=require('./fixtures/shared-handoff-roots.json')[0].request,advice=require('./fixtures/forced-bag-resource-binding.json').advice;let calls=0;
 // A trusted current anonymous opening count is exempted by the projected
 // handoff, without changing the controller's still-unmarked current state.
 const supplied=Provider.prepare(q.observation,q.options);assert.equal(supplied.status,'available');const snapshot=Context.exportState(supplied.context);snapshot.state.sl.uncertainty.S[0]++;
 const current=Context.importState(snapshot,{position:q.observation});assert(Context.resolve(current,{position:q.observation}).hangingS.unclassifiedCount>0);
 const planner={...P,plan:()=>++calls===1?{target:null,status:'budget-exhausted',metrics:{nodes:12000}}:{...clone(advice),metrics:{nodes:20848}}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?planner:require(id.replace('./','../')),Date});
 const result=module.exports.plan(q.observation,{...q.options,obligationContext:snapshot,deadline:1500,now:()=>0});assert.equal(calls,2);assert.equal(result.evidence.openingHandoff.recovery,'shared-after-legacy-budget-miss');assert.equal(result.metrics.nodes,32848);assert.deepEqual(Context.exportState(current),snapshot);
});
test('handoff SL: complete H01 planner admission and actual continuation use the same current boundary',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),converted=Provider.prepare(f.position,{obligationContext:f.obligationContext});assert.equal(converted.status,'available');
 const options={obligationContext:Context.exportState(converted.context),openingPhase:true,openingClear:f.openingClear,maxNodes:45000,deadline:Infinity,now:()=>0};
 const before=clone(options.obligationContext),advice=P.decide(f.position,options);
 assert.ok(advice.target,advice.reason);assert.equal(advice.phase,'maintenance');assert.equal(advice.evidence.openingHandoff.status,'checked-after-actual-clear');assert.equal(advice.evidence.resourceObligations.status,'checked');
 let state=f.position,current=Context.handoff(converted.context,{position:state}).context;
 const boundary=Context.resolve(current,{position:state}),input=Provider.prepare(state,{obligationContext:Context.exportState(current)}),resource=Provider.startRoute(input),binding=Resources.rootBinding(resource);
 assert.equal(advice.evidence.resourceObligations.binding,binding,'Outer admission cannot restore stale opening pairing evidence');assert.deepEqual(ids(boundary,'L'),[17]);assert.deepEqual(boundary.hangingS.unclassified,[]);
 assert.equal(P.revalidate(state,clone(advice),{...options,openingPhase:false}),null,'Copied phase/handoff labels cannot rebase an unmarked request');
 assert.ok(P.revalidate(state,clone(advice),{...options,openingPhase:false,obligationContext:Context.exportState(current)})?.target,'Controller-marked current state revalidates normally');
 const checked=Resources.checkPath(Resources.position(resource),advice.continuation,resource);assert.equal(checked.valid,true);
 for(const step of advice.continuation)for(const action of step.witness){const next=R.move(state,action);assert.notEqual(next,state);current=Context.applyActual(current,{before:state,action,after:next}).context;state=next;}
 const after=Context.resolve(current,{position:state});assert.equal(after.availability,'known');assert.deepEqual(checked.resource.hangingS.map(p=>p.id),ids(after,'S'));assert.deepEqual(checked.resource.hangingL.map(p=>p.id),ids(after,'L'));
 assert.deepEqual(options.obligationContext,before,'Successful planning still cannot mutate the controller current state');
});
