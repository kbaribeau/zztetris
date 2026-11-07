'use strict';
// Test-only production-budget contract. An alternate target needs evidence of
// unfinished/bounded work, and every positive claim is independently checked.
const assert=require('node:assert/strict'),P=require('../../st-planner'),R=require('../../st-rules'),E=require('../../scripts/lib/st-simulation.cjs');
function budgetEvidence(result,maxNodes=45000){
 const m=result.metrics||{},e=result.evidence||{},counts=x=>Boolean(x?.proofScheduling?.unfinished||x?.proofScheduling?.budgetStops||x?.queries?.unfinished);
 return result.status==='budget-exhausted'||m.nodes>=maxNodes||e.budgetExhausted===true||e.searchIncomplete===true||counts(m)||counts(m.supportedSearch)||
  result.recommendation?.search?.incomplete===true||m.riskFallback?.truncated===true||m.riskFallback?.proofIncomplete===true||
  m.reservedPiecePlan?.incomplete===true||m.reservedPiecePlan?.reason==='shared-budget'||m.visibleLeftRepair?.incomplete===true||m.resetOrdinaryProbe?.budgetExhausted===true;
}
function verify(raw,result,options={},expectedSelected=true){
 const limit=options.maxNodes??45000;assert(Number.isInteger(result.metrics?.nodes));assert(result.metrics.nodes>=0&&result.metrics.nodes<=limit);
 if(!expectedSelected)assert(budgetEvidence(result,limit),'A changed production outcome needs concrete budget/unfinished evidence');
 if(!result.target){assert.equal(result.target,null);assert.deepEqual(result.witness,[]);assert.deepEqual(result.continuation,[]);assert(['budget-exhausted','no-supported-continuation-found'].includes(result.status));assert(budgetEvidence(result,limit));assert.notEqual(result.evidence?.resourceObligations?.status,'unavailable');return;}
 E.validateAdvice(raw,result);
 const fixed={...options,maxNodes:limit,now:()=>0,deadline:Infinity},kind=result.recommendation?.kind;
 if(kind==='supported'){
  assert(P.revalidate(raw,result,fixed),'A production supported result still needs full current admission');
  let state=require('../../st-obligation-resources').position(require('../../st-resource-provider').startRoute(require('../../st-resource-provider').prepare(P.observe(raw),options)));for(const step of result.continuation){const replay=R.replay(state,step.witness);assert(replay.valid);assert.deepEqual(replay.events,[step.event]);state=replay.state;}
 }else{
  assert.equal(kind,'risky');assert.equal(result.continuation.length,1);assert.equal(result.metrics.certifiedHorizon,0);assert(result.recommendation.hazards.length>0);assert.equal(P.revalidate(raw,result,fixed),null,'Risk never gains supported retention authority');
 }
}
module.exports={budgetEvidence,verify};
