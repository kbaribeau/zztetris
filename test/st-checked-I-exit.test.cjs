'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),C=require('../st-obligation-context'),M=require('../st-obligation-resources'),L=require('../st-left-context'),Session=require('../st-session'),f=require('./fixtures/checked-I-D-exit.json');
const clone=x=>JSON.parse(JSON.stringify(x)),root=()=>R.createState(f.observation),options=()=>({...clone(f.options),now:()=>0,deadline:Infinity,depth:3,width:8,maxNodes:45000});
function route(){let s=root();return f.userWitnesses.map(witness=>{const r=R.replay(s,witness);assert(r.valid);assert.equal(r.events.length,1);s=r.state;return{witness,event:r.events[0],target:r.events[0].target,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};});}
function saved(){const s=root(),continuation=route();return{...continuation[0],continuation,context:JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active.type]),metrics:{},evidence:{cycleDebt:0}};}
test('Public I route / literal player allocation pays separate Left and Center jobs',()=>{
 const steps=route(),result=R.replay(root(),steps.flatMap(p=>p.witness));assert(result.valid);assert.equal(result.events.length,6);assert.equal(L.isD(result.state.board),false);
 const checked=M.checkPath(root(),steps,C.importState(f.options.obligationContext,{position:root()}));assert.equal(checked.valid,true,checked.reason);assert.equal(checked.resource.pendingCenter.length,0);assert.equal(checked.resource.hangingS.length,0);assert.equal(checked.resource.violations.length,0);
 const work={};assert(P.revalidateOpeningForecast(root(),steps,options(),work));assert.equal(work.retained,true);
});
test('Public I route / legal replay cannot borrow an absent I or forged placement',()=>{
 const steps=route(),changed=R.createState({...f.observation,active:'O',bag:null});assert.equal(R.replay(changed,steps.flatMap(p=>p.witness)).events.some((e,i)=>JSON.stringify(e)!==JSON.stringify(steps[i]?.event)),true);
 const good=saved();assert(P.revalidate(root(),good,options()));
 for(const alter of [a=>a.continuation[4].witness=['HD'],a=>a.continuation[4].event.type='O']){const bad=saved();alter(bad);assert.equal(P.revalidate(root(),bad,options()),null);}
 const stale=options();stale.obligationContext.inventory.active.id=stale.obligationContext.inventory.queue[0].id;assert.equal(P.revalidate(root(),good,stale),null);
 for(const patch of [{maxNodes:0},{deadline:0}])assert.equal(P.revalidate(root(),good,{...options(),...patch}),null);
});
test('Public I route / old D exit claims cannot authenticate saved advice',()=>{
 const a=saved();a.evidence.checkedIAllocation={leftJId:-1,centerRootId:-1,centerJId:-1,iExitLock:0};a.evidence.resourceObligations={checkedIExits:[{pieceId:-1}],delayedDPlans:[{steps:[]}]};const checked=P.revalidate(root(),a,options());assert(checked);assert.equal(checked.evidence.checkedIAllocation,null);
 const session=Session.create(root(),{...options(),obligationContext:C.importState(f.options.obligationContext,{position:root()}),previous:checked}),restored=Session.parse(JSON.stringify(session));assert(P.revalidate(restored.state,restored.previous,{...options(),obligationContext:restored.obligationContext}));
});
test('Public I route / malformed observations keep normal invalid-input behavior',()=>{
 for(const value of [null,{board:['bad']}]){let result;assert.doesNotThrow(()=>{result=P.decide(value,{openingPhase:false,maxNodes:0,timeMs:0});});assert.equal(result.status,'invalid-input');}
});
test('Public I route / exact saved route survives movement, HOLD and actual resource payments',()=>{
 let position=root(),history=C.importState(f.options.obligationContext,{position}),pattern=clone(f.options.patternHistory),advice=P.revalidate(position,saved(),options());assert(advice);
 const live=()=>({...options(),obligationContext:C.exportState(history),patternHistory:pattern});let locks=0;
 while(advice&&locks<7){const beforeLock=position,original=advice;for(const action of original.witness){const before=position;position=R.move(position,action);history=C.applyActual(history,{before,action,after:position}).context;if(action==='HD')pattern=P.updatePatternHistory(pattern,before,position,position.lastEvent);else{advice=P.advance(position,advice,action,live());assert(advice,`movement ${locks}/${action}`);}}
  locks++;advice=P.continueCommitment(beforeLock,position,original,position.lastEvent,live());if(locks<6)assert(advice,`retained original payment ${locks}`);
 }
 assert.equal(locks,6);assert.equal(advice,null);const resource=M.start(position,history,{extendForced:false});assert.equal(resource.pendingCenter.length,0);assert.equal(resource.hangingS.length,0);
});
