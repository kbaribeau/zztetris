'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),RH=require('../st-resource-history'),M=require('../st-midgame-resources'),L=require('../st-left-context'),Session=require('../st-session'),f=require('./fixtures/delayed-J-Center-payment.json'),clone=x=>JSON.parse(JSON.stringify(x));
const root=()=>R.createState(f.observation),options=()=>({...clone(f.options),depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});
function harness(){const fs=require('fs'),path=require('path'),vm=require('vm'),filename=require.resolve('../st-planner'),m={exports:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8').replace('return Object.freeze({dPatternAdmission,','return Object.freeze({checkedResourceEndpoint,'),{module:m,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance});return m.exports;}
function pathFor(s,witnesses){const out=[];for(const witness of witnesses){const r=R.replay(s,witness);assert(r.valid&&r.events.length===1);out.push({witness,event:r.events[0],target:r.events[0].target});s=r.state;}return out;}
let saved;const advice=()=>clone(saved??=P.decide(root(),options()));
function variant(edit){const ctx=clone(f.options.resourceContext);edit(ctx);let s=R.createState(ctx.origin),h=RH.start(s);for(const q of ctx.steps){const before=s;s=R.move(s,q.action);s={...s,queue:[...s.queue,...q.revealed]};h=RH.applyAction(h,before,q.action,s);}return{s,o:{...options(),resourceContext:RH.exportContext(s,h),resourceOriginBag:null}};}
test('delayed J / natural selection has a real Center payment and distinct J exit within original budgets',()=>{
 const a=advice();assert.equal(a.target.type,'Z');assert.equal(a.recommendation.kind,'supported');assert.deepEqual(a.continuation.map(p=>p.event.type),['Z','I','L']);assert(a.continuation[1].event.cells.every(([x])=>x===0));assert(a.metrics.nodes<=45000);const plans=a.evidence.resourceObligations.delayedDPlans;assert.equal(plans.length,1);assert.deepEqual(plans[0].steps.map(p=>p.event.type),['L','J']);assert.notEqual(plans[0].paidPieceId,plans[0].jPieceId);assert(R.replay(plans[0].origin,plans[0].steps.flatMap(p=>p.witness)).valid);assert.match(a.reason,/Center completion followed by J Left/);
 const disabled=P.decide(root(),{...options(),disableDelayedJPlan:true});assert.equal(disabled.target.type,'I');assert(disabled.continuation[0].event.cells.every(([x])=>x===9));
});
test('delayed J / original six-lock public route and shorter four-lock route close actual obligations',()=>{
 const full=pathFor(root(),f.userWitnesses),short=pathFor(root(),[...f.userWitnesses.slice(0,3),f.userWitnesses[5]]),Q=harness();
 for(const path of [full,short]){const check=Q.checkedResourceEndpoint(root(),path,options());assert.equal(check.valid,true);assert.equal(check.resource.pendingCenter.length,0);assert.equal(check.resource.violations.length,0);assert(P.checkedCoveredRepair(root(),path,options()));assert.equal(Q.checkedResourceEndpoint(root(),path,{...options(),disableDelayedJPlan:true}).valid,false);}
});
test('delayed J / one J cannot pay both Center and Left but can cover the shorter route',()=>{
 const {s,o}=variant(c=>{c.steps.find(q=>q.revealed.includes('J')).revealed=['O'];}),full=pathFor(root(),f.userWitnesses),short=pathFor(s,[...f.userWitnesses.slice(0,3),f.userWitnesses[5]]),Q=harness();assert.equal(Q.checkedResourceEndpoint(s,full,o).valid,false);assert.equal(Q.checkedResourceEndpoint(s,short,o).valid,true);
});
test('delayed J / no visible J or missing authenticated Center target cannot become a certificate',()=>{
 const {s,o}=variant(c=>{c.origin.queue=c.origin.queue.map(t=>t==='J'?'O':t);for(const q of c.steps)q.revealed=q.revealed.map(t=>t==='J'?'O':t);}),Q=harness(),path=pathFor(root(),f.userWitnesses.slice(0,3));assert.equal(Q.checkedResourceEndpoint(s,path,o).valid,false);
 const unknown={...options(),resourceContext:RH.exportContext(root(),RH.start(root()))};assert.equal(Q.checkedResourceEndpoint(root(),path,unknown).valid,false);
});
test('delayed J / exact Center cells and real moved active pose are mandatory',()=>{
 const path=pathFor(root(),f.userWitnesses.slice(0,2));let before=root(),history=RH.importContext(before,f.options.resourceContext);for(const step of path.slice(0,1))for(const action of step.witness){const old=before;before=R.move(before,action);history=RH.applyAction(history,old,action,before);}const p={...path[1],state:R.replay(before,path[1].witness).state},summary=RH.resolve(before,history),resource=M.start(before,summary),o={...options(),resourceContext:RH.exportContext(before,history),resource};
 const fake=clone(resource);fake.pendingCenter[0].alternatives[0].cells[0][0]=0;assert.equal(P.dPatternAdmission(before,p,{...o,resource:fake}).valid,false);
 const forged=clone(p);forged.state.active.x--;assert.equal(P.dPatternAdmission(before,forged,o).valid,true,'Caller post-pose is ignored; actual witness supplies state');const moved={...p,witness:[...p.witness,'L']};moved.state=R.replay(before,moved.witness).state;assert.equal(P.dPatternAdmission(before,moved,o).valid,false);
});
test('delayed J / exhausted shared budget and forged imported plan never grant permission',()=>{
 const Q=harness(),a=advice();assert.equal(Q.checkedResourceEndpoint(root(),a.continuation,{...options(),maxNodes:0}).valid,false);assert.equal(Q.checkedResourceEndpoint(root(),a.continuation,{...options(),deadline:0}).valid,false);
 const forged=clone(a);forged.evidence.resourceObligations.delayedDPlans[0].steps=[];assert(P.revalidate(root(),forged,options()),'Fresh independent proof replaces metadata');assert.equal(P.revalidate(root(),forged,{...options(),disableDelayedJPlan:true}),null);
});
test('delayed J / every movement, HOLD and lock retains checked plan then actual J exits D',()=>{
 let s=root(),h=RH.importContext(s,f.options.resourceContext),a=advice(),pattern=clone(f.options.patternHistory);const live=()=>({...options(),resourceContext:RH.exportContext(s,h),patternHistory:pattern});for(let lock=0;lock<3;lock++){const beforeLock=s,old=a;for(const action of a.witness){const before=s;s=R.move(s,action);h=RH.applyAction(h,before,action,s);if(action==='HD')pattern=P.updatePatternHistory(pattern,before,s,s.lastEvent);if(action!=='HD'){a=P.advance(s,a,action,live());assert(a,`advance${lock}/${action}`);}}if(lock<2){a=P.continueCommitment(beforeLock,s,old,s.lastEvent,live());assert(a,`retention${lock}`);}}
 assert(L.isD(s.board));const j=P.decide(s,live());assert.equal(j.target.type,'J');const r=R.replay(s,j.witness);assert(r.valid);assert(r.events[0].cells.every(([x])=>x<4));assert.equal(L.isD(r.state.board),false);
});
test('delayed J / session roundtrip recomputes proof and fresh Worker respects production budget',()=>{
 const a=advice(),s=root(),h=RH.importContext(s,f.options.resourceContext),session=Session.create(s,{...options(),resourceHistory:h,previous:a}),restored=Session.parse(JSON.stringify(session));assert(P.revalidate(restored.state,restored.previous,{...options(),resourceContext:RH.exportContext(restored.state,restored.resourceHistory)}));
 const worker=require('../scripts/lib/st-simulation.cjs').workerPlanner(),result=worker(clone({type:'plan',id:93,observation:s,previous:null,commitment:null,options:{...options(),timeMs:1500}}));assert.equal(result.target.type,'Z');assert.equal(result.recommendation.kind,'supported');assert(result.metrics.nodes<=45000);assert.equal(result.evidence.resourceObligations.delayedDPlans.length,1);
});
test('delayed J / actual preview reveals and session reload preserve the original J identity',()=>{
 const B=require('../st-bag');let s=root(),h=RH.importContext(s,f.options.resourceContext),pattern=clone(f.options.patternHistory),a=advice();const originalJ=a.evidence.resourceObligations.delayedDPlans[0].jPieceId,live=()=>({...options(),resourceContext:RH.exportContext(s,h),patternHistory:pattern});
 for(let lock=0;lock<3;lock++){const beforeLock=s,old=a;for(const action of a.witness){const before=s;let next=R.move(s,action);if(action==='HD'){const revealed=['I','Z','T'][lock];next={...next,queue:[...next.queue,revealed],bag:B.consume(next.bag,revealed)};}s=next;h=RH.applyAction(h,before,action,s);if(action==='HD')pattern=P.updatePatternHistory(pattern,before,s,s.lastEvent);else{a=P.advance(s,a,action,live());assert(a);}}
  if(lock<2){a=P.continueCommitment(beforeLock,s,old,s.lastEvent,live());assert(a);if(lock===0){assert.equal(a.evidence.resourceObligations.delayedDPlans[0].jPieceId,originalJ);const encoded=Session.create(s,{...live(),resourceHistory:h,previous:a}),restored=Session.parse(JSON.stringify(encoded));a=P.revalidate(restored.state,restored.previous,{...live(),resourceContext:RH.exportContext(restored.state,restored.resourceHistory)});assert(a);}}
 }
 const j=P.decide(s,live()),r=R.replay(s,j.witness);assert.equal(j.target.type,'J');assert.equal(L.isD(r.state.board),false);assert.equal(s.queue.length,6);
});
