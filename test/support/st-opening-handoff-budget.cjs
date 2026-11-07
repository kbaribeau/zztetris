'use strict';
// Real-budget handoff outcomes may be unfinished, but may never retire opening
// on an unchecked claim or return an unverified construction as maintenance.
const assert=require('node:assert/strict'),P=require('../../st-planner'),R=require('../../st-rules'),S=require('../../st-structure'),Provider=require('../../st-resource-provider'),E=require('../../scripts/lib/st-simulation.cjs');
const {budgetEvidence,verify}=require('./st-production-budget.cjs');
module.exports=function verifyProductionHandoff(request,result){
 const options=request.options,limit=options.maxNodes;
 assert.ok(Number.isInteger(result.metrics?.nodes)&&result.metrics.nodes>=0&&result.metrics.nodes<=limit);
 const work=result.metrics.handoffWork?.legacy;
 if(work?.eligible){assert.equal(work.allocatedNodes,Math.min(12000,limit));assert.ok(work.nodes>=0&&work.nodes<=work.allocatedNodes);}
 const opening={active:true,clear:options.openingClear||null,source:null,repair:null};
 if(result.phase==='maintenance'){
  assert.ok(result.target);assert.equal(result.evidence?.openingHandoff?.status,options.openingClear?'checked-after-actual-clear':'checked-after-observed-opening-quality');
  const input=Provider.prepare(request.observation,options),boundary=Provider.projectHandoff(input.frame),eligibility=Provider.eligibility(boundary);
  assert.equal(eligibility.mandatoryZPending,false);
  if(options.openingClear){
   const proof=options.openingClear,replay=R.replay(proof.before,['HD']);assert.ok(replay.valid);assert.deepEqual(replay.events,[proof.event]);assert.ok(proof.event.lines&&S.canonicalClear(proof.event));
   assert.deepEqual(replay.state.board,request.observation.board);assert.equal(replay.state.active?.type,request.observation.active?.type);assert.equal(replay.state.hold,request.observation.hold);assert.equal(replay.state.canHold,request.observation.canHold);
   assert.deepEqual(replay.state.queue,request.observation.queue.slice(0,replay.state.queue.length));
  }else assert.equal(eligibility.historicalHandoff,true,'Current observed allocation and quality, not a copied phase label, authorize the boundary');
  assert.ok(P.revalidate(request.observation,result,{...Provider.withFrame(boundary,options),openingPhase:false,now:()=>0,deadline:Infinity}),'Phase retirement requires independent current maintenance admission');
  assert.equal(P.acceptOpeningResult(opening,result).active,false);E.validateAdvice(request.observation,result);return;
 }
 assert.equal(result.phase,'opening');assert.equal(result.evidence?.openingHandoff,undefined);assert.equal(P.acceptOpeningResult(opening,result).active,true);
 assert.ok(budgetEvidence(result,limit)||work?.status==='budget-exhausted','An alternate opening outcome requires concrete unfinished/budget evidence');
 if(!result.target||result.recommendation?.kind==='risky'){verify(request.observation,result,options);return;}
 // Opening construction is intentionally not ordinary admission. Recheck its
 // literal route, protected notches, cavity safety and public access instead.
 E.validateAdvice(request.observation,result);
 const input=Provider.prepare(request.observation,options);let state=P.observe(request.observation),notches=P.resolvePatternHistory(state,input.frame.state.safety.notches);
 const initialNotches=notches;
 for(const step of result.continuation){
  const replay=R.replay(state,step.witness);assert.ok(replay.valid);assert.deepEqual(replay.events,[step.event]);assert.ok(S.canonicalClear(step.event));
  const next=S.advanceNotches(state.board,{state:replay.state,event:step.event},notches);assert.ok(next.valid);
  assert.deepEqual(P.cavityRepairDebt(P.assess(state.board),P.assess(replay.state.board),step.event),[]);state=replay.state;notches=next.pattern;
 }
 assert.equal(P.checkAccessPrefix(request.observation,result.continuation,{notches:initialNotches,now:()=>0,deadline:Infinity,maxNodes:limit}).reachable,true);
};
