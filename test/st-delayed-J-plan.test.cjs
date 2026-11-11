'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),Current=require('../st-obligation-context'),M=require('../st-obligation-resources'),Session=require('../st-session'),f=require('./fixtures/delayed-J-Center-payment.json');
const clone=x=>JSON.parse(JSON.stringify(x)),root=()=>R.createState(f.observation),options=()=>({...clone(f.options),depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});
function pathFor(s,witnesses){return witnesses.map(witness=>{const r=R.replay(s,witness);assert(r.valid&&r.events.length===1);s=r.state;return{witness,event:r.events[0],target:r.events[0].target};});}
function context(s){return JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);}
function saved(){const continuation=pathFor(root(),f.userWitnesses);return{...continuation[0],hold:continuation[0].witness.includes('HOLD'),holdCount:continuation[0].witness.filter(a=>a==='HOLD').length,continuation,context:context(root()),metrics:{},evidence:{cycleDebt:0}};}
test('Center payment route / original six-lock and shorter four-lock routes retain actual resource checks',()=>{
 for(const witnesses of [f.userWitnesses,[...f.userWitnesses.slice(0,3),f.userWitnesses[5]]]){
  const route=pathFor(root(),witnesses),resource=M.checkPath(root(),route,Current.importState(f.options.obligationContext,{position:root()}));assert.equal(resource.valid,true,resource.reason);assert.equal(resource.resource.pendingCenter.length,0);assert.equal(resource.resource.violations.length,0);assert(P.checkedCoveredRepair(root(),route,options()));
  const work={};assert(P.revalidateOpeningForecast(root(),route,options(),work));assert.equal(work.retained,true);
 }
});
test('Center payment route / missing public J cannot replay the recorded payment',()=>{
 const variant=clone(require('./fixtures/delayed-J-native-variants.json').cases[0]),s=R.createState(variant.observation),route=pathFor(root(),f.userWitnesses);
 const result=M.checkPath(s,route,Current.importState(variant.obligationContext,{position:s}));assert.equal(result.valid,false);
});
test('Center payment route / forged event, illegal witness and stale accounting remain rejected',()=>{
 const good=saved();assert(P.revalidate(root(),good,options()));
 for(const alter of [a=>a.continuation[1].event.type='O',a=>a.continuation[1].witness=['TELEPORT','HD']]){const bad=saved();alter(bad);assert.equal(P.revalidate(root(),bad,options()),null);}
 const stale=options();stale.obligationContext.inventory.active.id=stale.obligationContext.inventory.queue[0].id;assert.equal(P.revalidate(root(),good,stale),null);
 for(const patch of [{maxNodes:0},{deadline:0}])assert.equal(P.revalidate(root(),good,{...options(),...patch}),null);
});
test('Center payment route / session roundtrip independently revalidates literal route',()=>{
 const s=root(),h=Current.importState(f.options.obligationContext,{position:s}),a=P.revalidate(s,saved(),options());assert(a);
 const session=Session.create(s,{...options(),obligationContext:h,previous:a}),restored=Session.parse(JSON.stringify(session));assert(P.revalidate(restored.state,restored.previous,{...options(),obligationContext:restored.obligationContext}));
});
