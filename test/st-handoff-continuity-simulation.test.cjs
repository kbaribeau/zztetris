'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/lib/st-simulation.cjs'),P=require('../st-planner'),R=require('../st-rules'),C=require('../st-handoff-continuity');
// Controlled accepted advice isolates the simulator lifecycle. This empty-board
// route is not a production handoff proof and is never passed off as one.
function advice(state){
 let current=state;const continuation=[];
 for(let n=0;n<2;n++){
  const witness=n?['HD']:['HOLD','HOLD','L','R','HD'],r=R.replay(current,witness);assert(r.valid);
  continuation.push({witness,event:r.events[0],target:r.events[0].target,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length});current=r.state;
 }
 return{...continuation[0],continuation,evidence:{openingHandoff:{recovery:'shared-after-legacy-budget-miss'}}};
}
const api={...P,acceptOpeningResult:session=>({...session,active:false}),advance:()=>null,continueCommitment:()=>null,resourceGoal:()=>false};
test('handoff simulation: connector advances after real HOLD/draw/refill and is consumed on the next accepted advice',()=>{
 const session=E.createSession(E.makeInput('empty',123,3),api),before=session.request(1,E.CONFIG),rootInventory=session.publicInventory,selected=advice(before.observation);
 session.execute(selected);const next=session.request(2,E.CONFIG),recovery=next.options.handoffRecovery;assert(recovery?.continuity);
 assert.equal(recovery.continuity.actions,selected.witness.length);assert.deepEqual(recovery.continuity.origin,P.observe(before.observation));assert.deepEqual(recovery.continuity.current,P.observe(next.observation));assert.equal(recovery.continuity.locked.id,rootInventory.active.id);
 assert.equal(C.connected(recovery.continuity,before.observation,next.observation,rootInventory,session.publicInventory),true);
 assert.equal(C.matchesEndpoint(recovery.continuity,next.observation,recovery.actualEvent),true);
 const r=R.replay(next.observation,['HD']);session.execute({target:r.events[0].target,witness:['HD'],hold:false,evidence:{opening:true}});
 assert.equal(session.request(3,E.CONFIG).options.handoffRecovery,undefined);
});
test('handoff simulation: a candidate without an accepted phase boundary does not export execution',()=>{
 const session=E.createSession(E.makeInput('empty',123,2),{...api,acceptOpeningResult:s=>s});session.execute(advice(session.request(1,E.CONFIG).observation));
 assert.equal(session.request(2,E.CONFIG).options.handoffRecovery,undefined);
});
