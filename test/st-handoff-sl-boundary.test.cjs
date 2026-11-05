'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),P=require('../st-planner');
const clone=x=>JSON.parse(JSON.stringify(x)),ids=(d,type)=>d['hanging'+type].evidence.map(e=>e[type.toLowerCase()+'Id']);
function live(types){
 let state=R.createState({active:types[0],queue:types.slice(1),streamCursor:1,bag:B.fromObserved({observed:types,startPhase:0})}),history=H.start(state,{fresh:true});
 const act=(action,revealed=[])=>{const next=R.move(state,action);assert.notEqual(next,state);const after={...next,queue:[...next.queue,...revealed],bag:revealed.reduce((bag,t)=>B.consume(bag,t),next.bag)};history=H.applyAction(history,state,action,after);state=after;assert.equal(history.coverage.status,'complete');};
 return{act,lock(witness=['HD'],revealed=[]){for(const a of witness)act(a,a==='HD'?revealed:[]);},handoff(){history=H.markHandoff(history,state);},get state(){return state;},get history(){return history;},get summary(){return H.resolve(state,history);}};
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
  assert.deepEqual(d.allocations,before.allocations);assert.deepEqual(d.pairs,before.pairs);
  assert.equal(d.extraZ.status,before.extraZ.status,'SL rebase does not create Extra-Z permission');
 }
});
test('handoff SL: both used is settled without a pairing requirement; neither used creates no obligation',()=>{
 for(const used of['S','L']){
  const other=used==='S'?'L':'S',a=live([used,other,'I','J','O','T','Z']);
  a.handoff();assert.deepEqual(ids(a.summary,'S'),[]);assert.deepEqual(ids(a.summary,'L'),[]);
  const b=live([used,other,'I','J','O','T','Z']);b.lock(['HD']);b.lock(['HD']);
  assert.equal(b.summary.pairs.length,0,'Literal opening locks do not complete a recognized pair');
  const before=b.summary;b.handoff();
  for(const type of['S','L']){assert.deepEqual(ids(b.summary,type),[]);assert.deepEqual(b.summary['hanging'+type].unclassified,[]);}
  assert.deepEqual(b.summary.center,before.center);assert.deepEqual(b.summary.coveredRepair,before.coveredRepair);
 }
});
test('handoff SL: HOLD is unused and repeated swaps keep the original bag and identity',()=>{
 const a=live(['L','S','I','J','O','T','Z']);a.act('HOLD');a.lock(['HD']);
 const held=a.summary.instances.hold;assert.equal(held.id,1);assert.equal(held.type,'L');assert.equal(held.allocation,null);
 a.handoff();assert.deepEqual(ids(a.summary,'L'),[1]);
 for(let i=0;i<4;i++){a.act('HOLD');assert.deepEqual(ids(a.summary,'L'),[1]);assert.equal(a.summary.hangingL.evidence[0].bag,0);}
 const before=a.summary,projected=M.start(a.state,before);assert.deepEqual(projected.hangingL,[{id:1,bag:0,known:true}]);
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
 assert.deepEqual(M.start(a.state,d).hangingS,[{id:1,bag:0,known:true},{id:9,bag:1,known:true}]);
 a.lock(left);assert.deepEqual(ids(a.summary,'S'),[1],'Paying the current S cannot consume the old held identity');
 a.lock(['HOLD',...left]);assert.deepEqual(ids(a.summary,'S'),[]);
});
test('handoff SL: worker/session replay and immutable Undo state rederive the boundary instead of importing labels',()=>{
 const a=live(['S','L','I','J','O','T','Z']);a.lock(['HD']);const before=a.history,pre=a.summary;
 a.handoff();const boundary=a.summary,context=clone(H.exportContext(a.state,a.history));
 context.hangingL={status:'none-observed',evidence:[]};context.pieces={};
 assert.deepEqual(H.resolve(a.state,H.importContext(a.state,context)),boundary);
 assert.deepEqual(H.resolve(a.state,before),pre,'Undo snapshot remains unmarked and immutable');
 assert.deepEqual(ids(pre,'L'),[]);assert.deepEqual(ids(boundary,'L'),[2]);
 const state=a.state;a.lock(left);assert.deepEqual(ids(a.summary,'L'),[]);
 assert.deepEqual(H.resolve(state,H.importContext(state,context)),boundary,'Returning across the lock restores the exact handoff obligation');
 const Session=require('../st-session'),session=Session.create(state,{resourceOriginBag:B.fromObserved({observed:['S','L','I','J','O','T','Z'],startPhase:0}),resourceHistory:H.importContext(state,context),openingPhase:false});
 const restored=Session.prepare(clone(session));assert.deepEqual(H.resolve(restored.state,restored.resourceHistory),boundary);
 const partial=H.markHandoff(H.start(state),state);assert.equal(H.resolve(state,partial).hangingL.status,'unknown','No invented bag identity from a snapshot');
});
test('handoff SL: H01 closes consumed opening pairs and carries only its held current-bag L',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),history=H.importContext(f.position,f.resourceContext),before=H.resolve(f.position,history),marked=H.markHandoff(history,f.position),d=H.resolve(f.position,marked);
 assert.equal(d.coverage.status,'complete');assert.equal(d.locks,17);assert.equal(d.instances.hold.type,'L');
 assert.deepEqual(d.hangingS.evidence,[]);assert.deepEqual(d.hangingS.unclassified,[]);
 assert.deepEqual(d.hangingL.evidence.map(e=>[e.lId,e.sId,e.bag]),[[17,15,2]]);
 assert.deepEqual(d.center,before.center);assert.deepEqual(d.coveredRepair,before.coveredRepair);
 const projected=M.start(f.position,d);assert.deepEqual(projected.hangingL,[{id:17,bag:2,known:true}]);assert.deepEqual(projected.hangingS,[]);assert.deepEqual(projected.unclassifiedS,[]);
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
 const f=require('./support/st-resource-trial-1.json');let state=R.createState(f.initial),history=H.start(state,{fresh:true}),locks=0;
 for(const step of f.steps){if(locks===27)break;const next=R.move(state,step.action),after={...next,queue:[...next.queue,...step.revealed]};history=H.applyAction(history,state,step.action,after);state=after;if(step.action==='HD')locks++;}
 for(const action of left){const next=R.move(state,action);history=H.applyAction(history,state,action,next);state=next;}
 const before=H.resolve(state,history);assert.ok(before.center.debt.length,'Fixture has a real diverted exact Center target');
 const d=H.resolve(state,H.markHandoff(history,state));assert.deepEqual(d.center,before.center);assert.deepEqual(d.coveredRepair,before.coveredRepair);assert.deepEqual(d.dPattern,before.dPattern);
});
function intercepted(extras){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?{...P,...extras}:require(id.replace('./','../')),Date});return module.exports;}
test('handoff SL: first H01 maintenance search receives the marked ledger without changing live history',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),before=clone(f.resourceContext);let calls=0;
 const O=intercepted({plan:(state,options)=>{calls++;const d=H.resolve(state,H.importContext(state,options.resourceContext));assert.equal(d.milestones.maintenanceHandoff.at,17);assert.deepEqual(ids(d,'S'),[]);assert.deepEqual(ids(d,'L'),[17]);assert.equal(options.openingPhase,false);return{target:null,status:'budget-exhausted',metrics:{nodes:1}};}});
 assert.equal(O.handoff(f.position,f.openingClear,{resourceContext:f.resourceContext,maxNodes:12000,deadline:Infinity,now:()=>0}),null);assert.equal(calls,1);assert.deepEqual(f.resourceContext,before);assert.equal(f.resourceContext.handoffAtAction,null);
});
test('handoff SL: forecast-first validation and fallback both receive the identical boundary context',()=>{
 const f=require('./fixtures/opening-forecast-public.json');let first=null,calls=0;
 const O=intercepted({revalidateOpeningForecast:(state,_steps,options,work)=>{first=clone(options.resourceContext);const d=H.resolve(state,H.importContext(state,first));assert.equal(d.milestones.maintenanceHandoff.at,d.locks);work.nodes=1;return null;},plan:(_state,options)=>{calls++;assert.deepEqual(clone(options.resourceContext),first);return{target:null,status:'budget-exhausted',metrics:{nodes:1}};}});
 O.handoff(f.request.observation,f.request.options.openingClear,{...f.request.options,openingForecast:f.forecast,maxNodes:12000,deadline:Infinity,now:()=>0});assert.ok(first);assert.equal(calls,1);
});
test('handoff SL: a recorded phase boundary is interpreted as input, never a repair or allocation certificate',()=>{
 const a=live(['L','S','I','J','O','T','Z']);a.handoff();a.lock(left);a.lock(['HD']);
 const before=a.summary,context=clone(H.exportContext(a.state,a.history));assert.ok(before.hangingS.unclassified.some(e=>e.requiresAccommodation));
 // This intentionally describes a different phase history, not an authentic
 // original boundary. The public tape cannot authenticate that user choice.
 context.handoffAtAction=context.steps.length;const other=H.resolve(a.state,H.importContext(a.state,context));
 assert.equal(other.coverage.status,'complete');assert.deepEqual(other.hangingS.unclassified,[]);
 assert.deepEqual(other.allocations,before.allocations);assert.deepEqual(other.center,before.center);assert.deepEqual(other.coveredRepair,before.coveredRepair);
});
test('handoff SL: shared recovery gating uses boundary facts even when opening diagnostics had unclassified S',()=>{
 const q=require('./fixtures/shared-handoff-roots.json')[0].request,advice=require('./fixtures/forced-bag-resource-binding.json').advice;let calls=0;
 // Component control injects a stale consumed-opening label only before the
 // marker. Real history tests above separately prove its boundary removal.
 const history={...H,resolve:(state,h)=>{const d=H.resolve(state,h);if(!d.milestones?.maintenanceHandoff)d.hangingS={...d.hangingS,unclassified:[{sId:999}]};return d;}};
 const planner={...P,plan:()=>++calls===1?{target:null,status:'budget-exhausted',metrics:{nodes:12000}}:{...clone(advice),metrics:{nodes:20848}}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?planner:id==='./st-resource-history'?history:require(id.replace('./','../')),Date});
 const result=module.exports.plan(q.observation,{...q.options,deadline:1500,now:()=>0});assert.equal(calls,2);assert.equal(result.evidence.openingHandoff.recovery,'shared-after-legacy-budget-miss');assert.equal(result.metrics.nodes,32848);
});
