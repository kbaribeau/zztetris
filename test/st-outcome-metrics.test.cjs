'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const O = require('../scripts/lib/st-outcome-metrics.cjs');
const E = require('../scripts/lib/st-simulation.cjs');
const P = require('../st-planner'), R = require('../st-rules');
const stub = {...P, startOpeningSession: () => ({active:true, clear:null}), acceptOpeningResult:s=>s, updateOpeningSession:s=>s, advance:()=>null};
test('outcomes: advice and budget exhaustion are independent, thresholds overlap', () => {
  const d = O.decision({target:{}, status:'supported', evidence:{budgetExhausted:true}, metrics:{nodes:45,elapsedMs:50}}, {maxNodes:45,timeMs:50});
  assert.equal(d.disposition, 'recommendation'); assert.equal(d.exhaustion, 'reported');
  assert.equal(d.nodeLimitReached,true); assert.equal(d.timeLimitReached,true);
});
test('outcomes: status carries exhaustion even with missing/false evidence', () => {
  for (const evidence of [undefined,{budgetExhausted:false}]) assert.equal(O.decision({status:'budget-exhausted',evidence}).exhaustion,'reported');
});
test('outcomes: missing instrumentation stays unknown, incomplete is not an outer timeout', () => {
  const d=O.decision({status:'no-supported-continuation-found',evidence:{searchIncomplete:true}});
  assert.equal(d.exhaustion,'unknown'); assert.equal(d.searchIncomplete,true); assert.equal(d.timeLimitReached,null);
  assert.equal(O.decision({evidence:{budgetExhausted:false}}).exhaustion,'not-reported');
});
test('outcomes: nested reported exhaustion does not assert outer thresholds',()=>{
  const d=O.decision({evidence:{budgetExhausted:true},metrics:{nodes:40,elapsedMs:5}},{maxNodes:100,timeMs:50});
  assert.equal(d.nodeLimitReached,false);assert.equal(d.timeLimitReached,false);assert.equal(d.exhaustion,'reported');
});
test('outcomes: disabled deadline cannot be recorded as a zero-ms deadline',()=>{
  assert.equal(O.decision({metrics:{elapsedMs:5}},{timeMs:null}).timeLimitReached,null);
});
test('outcomes: episode includes terminal abstention and retains legacy successful-lock counter',()=>{
  const rows=[];let calls=0;
  const summary=E.runEpisode(E.makeInput('empty',13,3),{api:stub,onRecord:r=>rows.push(r),planner:req=>{
    if(calls++)return {status:'budget-exhausted',evidence:{budgetExhausted:true},metrics:{nodes:45}};
    const proof=R.replay(req.observation,['HD']);
    return {target:proof.events[0].target,witness:['HD'],hold:false,continuation:[],evidence:{opening:true,budgetExhausted:true}};
  }});
  assert.equal(summary.stop,'abstention');assert.equal(summary.locks,1);assert.equal(summary.budgetHits,1);
  assert.equal(summary.outcomes.decisions,2);assert.equal(summary.outcomes.recommendation.reported,1);assert.equal(summary.outcomes.abstention.reported,1);
  assert.equal(rows.find(r=>r.kind==='stop').decisionOutcome.exhaustion,'reported');
  assert.equal(O.terminal(summary),'abstention/reported');
});
test('outcomes: fast unsupported stop is distinct without claiming completeness',()=>{
  const summary=E.runEpisode(E.makeInput('empty',13,1),{api:stub,planner:()=>({status:'no-supported-continuation-found',evidence:{budgetExhausted:false}})});
  assert.equal(O.terminal(summary),'abstention/not-reported');assert.equal(summary.outcomes.decisions,1);
});
test('outcomes: VM errors are not abstentions, and invalid targets stay invalid',()=>{
  const input=E.makeInput('empty',13,1);
  const err=E.runEpisode(input,{api:stub,planner:()=>{throw Object.assign(Error('test'),{code:'ERR_SCRIPT_EXECUTION_TIMEOUT'});}});
  assert.equal(O.terminal(err),'planner-timeout');assert.equal(err.outcomes.decisions,0);
  const invalid=E.runEpisode(input,{api:stub,planner:()=>({target:{},witness:['HD']})});
  assert.equal(O.terminal(invalid),'invalid-recommendation');assert.equal(invalid.outcomes.recommendation.unknown,1);
});
test('outcomes: aggregation separates legacy and caps; no fake zero decision coverage',()=>{
  const outcomes=O.create();O.add(outcomes,O.decision({status:'budget-exhausted'}));
  const episodes=[{stop:'abstention',outcomes},{stop:'abstention'},{stop:'wall-cap'},{stop:'lock-cap'},{stop:'top-out'}];
  const a=O.aggregate(episodes);assert.equal(a.runs,5);assert.equal(a.instrumentedRuns,1);assert.equal(a.decisions.decisions,1);
  assert.equal(a.terminal['abstention/unknown'],1);assert.equal(a.terminal['wall-cap'],1);
  assert.match(O.report(episodes).join('\n'),/1\/5 runs/);
});
test('outcomes: retained legacy terminal budget status is usable without inventing decision coverage',()=>{
  const e={stop:'abstention',detail:{status:'budget-exhausted'}};
  assert.equal(O.terminal(e),'abstention/reported');assert.equal(O.aggregate([e]).instrumentedRuns,0);
});
test('outcomes: unknown threshold measurements are counted separately',()=>{
  const o=O.create();O.add(o,O.decision({target:{}}));
  assert.equal(o.nodeLimitUnknown,1);assert.equal(o.timeLimitUnknown,1);
  const a=O.aggregate([{stop:'lock-cap',outcomes:o}]);assert.equal(a.decisions.nodeLimitUnknown,1);
  assert.match(O.report([{stop:'lock-cap',outcomes:o}]).join('\n'),/node limit reached 0 \(1 unknown\)/);
});
