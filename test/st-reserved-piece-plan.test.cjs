'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),RH=require('../st-resource-history'),A=require('../st-access'),f=require('./fixtures/reserved-piece-plan.json'),clone=x=>JSON.parse(JSON.stringify(x));
const opts=()=>({...clone(f.options),depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});
const root=()=>R.createState(f.observation);
let cached;const advice=()=>clone(cached??=P.decide(root(),opts()));
test('reserved plan / natural decision reserves O and closes actual repair with public supply',()=>{
 const a=advice();assert.equal(a.recommendation.kind,'supported');assert.equal(a.metrics.reservedPiecePlan.selected,true);assert.equal(a.continuation.length,7);assert.deepEqual(a.continuation.map(p=>p.event.type),['Z','J','S','T','I','L','O']);assert.equal(a.continuation[3].event.lines,2);assert.ok(a.metrics.nodes<=45000);assert.match(a.reason,/Keep the O reserved/);
 const r=R.replay(root(),a.continuation.flatMap(p=>p.witness));assert(r.valid);assert.equal(r.events.length,7);assert.deepEqual(a.evidence.coveredRepair.outstandingCells,[]);assert.equal(a.evidence.coveredRepairPlan.steps.length,7);
 assert.ok(a.evidence.coveredRepair.steps.some(p=>p.created.length));assert.equal(a.evidence.reservedPiecePlan.paymentLock,7);
});
test('reserved plan / finite repair cannot borrow missing O or a shortened queue',()=>{
 const a=advice(),steps=a.continuation;assert.equal(P.checkedCoveredRepair({...root(),active:{...root().active,type:'I'}},steps,f.options),null);
 assert.equal(P.checkedCoveredRepair({...root(),queue:root().queue.slice(0,3)},steps,f.options),null);
 const truncated=steps.slice(0,-1);assert.equal(P.checkedCoveredRepair(root(),truncated,f.options),null,'Air access with unpaid covered cells is not restoration');
 const forged=clone(a);forged.continuation.at(-1).witness=['HD'];assert.equal(P.revalidate(root(),forged,opts()),null);
});
test('reserved plan / repair commitment survives each actual movement and lock',()=>{
 let s=root(),history=RH.importContext(s,f.options.resourceContext),a=advice(),completed=0;
 while(a&&completed<7){const beforeLock=s,old=a,actions=a.witness.slice();
  for(const action of actions){const before=s;s=R.move(s,action);assert.notEqual(s,before);history=RH.applyAction(history,before,action,s);
   if(action!=='HD'){a=P.advance(s,a,action,{...opts(),resourceContext:RH.exportContext(s,history)});assert.ok(a,`advance ${completed+1} ${action}`);}
  }
  completed++;if(completed<7){a=P.continueCommitment(beforeLock,s,old,s.lastEvent,{...opts(),resourceContext:RH.exportContext(s,history)});assert.ok(a,`retain after ${completed}`);assert.equal(a.continuation.length,7-completed);}
 }
 assert.equal(completed,7);assert.deepEqual(RH.resolve(s,history).coveredRepair.cells,[]);
});

test('reserved plan / fresh Worker discovers plan without private stream or imported answers',()=>{
 const request={type:'plan',id:91,observation:root(),previous:null,commitment:null,options:{...f.options,depth:3,width:8,maxNodes:45000,timeMs:1500}},worker=require('../scripts/lib/st-simulation.cjs').workerPlanner();
 const result=worker(JSON.parse(JSON.stringify(request)));assert.equal(result.recommendation.kind,'supported');assert.equal(result.metrics.reservedPiecePlan.selected,true);assert.equal(result.continuation.length,7);assert.ok(result.metrics.nodes<=45000);assert.equal(result.evidence.coveredRepair.outstandingCells.length,0);
});
test('reserved plan / altered board and stale origin fail direct planner revalidation',()=>{
 const a=advice(),changed=root();changed.board[39]=changed.board[39].replace(/[^.]/,'.');assert.equal(P.revalidate(changed,a,opts()),null);
 const stale=clone(a);stale.evidence.coveredRepairPlan.origin.hold='I';assert.equal(P.revalidate(root(),stale,opts()),null);
 const bounded=P.decide(root(),{...opts(),maxNodes:0});assert.equal(bounded.target,null);
 const disabled=P.decide(root(),{...opts(),disableReservedPiecePlan:true});assert.equal(disabled.metrics.reservedPiecePlan,undefined);assert.notEqual(disabled.continuation.length,7);
});
test('reserved plan / actual later reveals cannot change the original finite proof',()=>{
 let s=root(),history=RH.importContext(s,f.options.resourceContext),a=advice();const B=require('../st-bag');
 for(let lock=0;lock<7;lock++){
  const old=a,beforeLock=s;
  for(const action of a.witness){const before=s;let next=R.move(s,action);if(action==='HD'){const revealed=f.testOnlyRevealsAfterLocks[lock];next={...next,queue:[...next.queue,...revealed]};for(const piece of revealed)if(next.bag)next={...next,bag:B.consume(next.bag,piece)};}s=next;history=RH.applyAction(history,before,action,s);}
  if(lock<6){a=P.continueCommitment(beforeLock,s,old,s.lastEvent,{...opts(),resourceContext:RH.exportContext(s,history)});assert.ok(a,`actual refill after ${lock+1}`);assert.equal(a.continuation.length,6-lock);}
 }
 assert.deepEqual(RH.resolve(s,history).coveredRepair.cells,[]);assert.equal(s.queue.length,6);
});

test('reserved plan / session round trip preserves history but no forged proof authority',()=>{
 const Session=require('../st-session'),a=advice(),s=root(),history=RH.importContext(s,f.options.resourceContext);
 const saved=Session.create(s,{resourceHistory:history,resourceOriginBag:s.bag,openingPhase:false,previous:a}),restored=Session.parse(JSON.stringify(saved));
 assert.ok(restored.previous);assert.ok(P.revalidate(restored.state,restored.previous,{...opts(),resourceContext:RH.exportContext(restored.state,restored.resourceHistory)}));
 const stale=clone(saved);stale.engineVersion='old-unaccepted-coach';const parsed=Session.parse(JSON.stringify(stale));assert.equal(parsed.previous,null);assert.deepEqual(parsed.state.board,s.board);
});
function internalPlanner(mutate=s=>s){const fs=require('fs'),path=require('path'),vm=require('vm'),filename=require.resolve('../st-planner'),m={exports:{}};let source=mutate(fs.readFileSync(filename,'utf8'));source=source.replace('return Object.freeze({dPatternAdmission,','return Object.freeze({checkedResourceEndpoint,');vm.runInNewContext(source,{module:m,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance});return m.exports;}
test('reserved plan / executed J exit cannot certify a still-unpaid suffix',()=>{
 const internal=internalPlanner(),a=advice(),partial=a.continuation.slice(0,-1),checked=internal.checkedResourceEndpoint(root(),partial,opts());assert.equal(checked.valid,false);assert.equal(checked.reason,'unresolved-covered-cells');
 const forged=clone(a);forged.continuation=partial;assert.equal(P.revalidate(root(),forged,opts()),null);
});
test('reserved plan / removing whole-path D-exit proof loses the positive mechanism',()=>{
 const mutant=internalPlanner(s=>s.replace('const executedExit=exit?.valid','const executedExit=false&&exit?.valid')),a=mutant.decide(root(),opts());assert.notEqual(a.metrics.reservedPiecePlan?.selected,true);assert.equal(a.recommendation.kind,'risky');
});
