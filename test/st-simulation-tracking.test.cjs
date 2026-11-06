'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/lib/st-simulation.cjs'),P=require('../st-planner'),R=require('../st-rules');
const api={...P,startOpeningSession:()=>({active:true}),acceptOpeningResult:P.acceptOpeningResult,updateOpeningSession:s=>s,advance:()=>null,continueCommitment:()=>null};
function hd(state,extra={}){const witness=['HD'],proof=R.replay(state,witness);return{target:proof.events[0].target,witness,hold:false,evidence:{opening:true},...extra};}
test('simulation tracking: runner subscribes without normal event output and samples authoritative final capped status',()=>{
 const input=E.makeInput('empty',13,2),rows=[];const s=E.runEpisode(input,{api,planner:r=>hd(r.observation),onRecord:r=>rows.push(r)});
 assert.equal(rows[0].kind,'tracking-start');assert.equal(rows.filter(r=>r.kind==='tracking-start').length,1);assert.equal(rows.some(r=>r.trackingEvents),false);assert.equal(s.tracking.total,0);assert.deepEqual(s.tracking.counts,{});assert.equal(s.tracking.scope,'entire-run');assert.equal(s.finalObligations.scope,'current');assert.equal(s.finalObligations.throughLock,2);assert.equal(s.stop,'lock-cap');assert.equal(s.censored,true);assert.equal(s.finalObligations.coverage.status,'complete');assert.ok(JSON.stringify(s.finalObligations).length<3000);
 const last=rows.filter(r=>r.kind==='lock').at(-1),recovered=E.recoverTrackingStatus(last);assert.deepEqual(recovered.obligations,s.finalObligations.obligations);assert.equal(recovered.scope,'partial');assert.equal(recovered.throughLock,2);
});
test('simulation tracking: abstention and imported history have honest final status, not a false clean-history claim',()=>{
 for(const scenario of ['empty','stable']){const s=E.runEpisode(E.makeInput(scenario,1,2),{planner:()=>({status:'unsupported'})});assert.equal(s.finalObligations.throughLock,0);assert.equal(s.finalObligations.coverage.status,scenario==='empty'?'complete':'partial');assert.equal(s.stop,'abstention');assert.equal(s.finalObligations.obligations.extraZ.remaining,null);}
});
test('simulation tracking: recovery cannot invent a handoff from an unaccepted maintenance label',()=>{
 const rows=[],input=E.makeInput('empty',13,2),s=E.runEpisode(input,{api,planner:r=>hd(r.observation,{phase:'maintenance',evidence:{}}),onRecord:r=>rows.push(r)});
 assert.equal(s.currentCoach,'opening');const row=rows.filter(r=>r.kind==='lock').at(-1);const recovered=E.recoverTrackingStatus(row);assert.deepEqual(recovered.obligations,s.finalObligations.obligations);assert.equal(recovered.coverage.status,'complete');
 const forged=E.clone(row);forged.lock=99;assert.throws(()=>E.recoverTrackingStatus(forged),/lock boundary/);
});
test('simulation tracking: empty-HOLD intermediate reveals authenticate without private future access',()=>{
 const input=E.makeInput('empty',13,1),rows=[],s=E.runEpisode(input,{api,planner:r=>{const witness=['HOLD','HD'],proof=R.replay(r.observation,witness);return{target:proof.events[0].target,witness,hold:true,evidence:{opening:true}};},onRecord:r=>rows.push(r)});
 const row=rows.find(r=>r.kind==='lock');assert.deepEqual(E.recoverTrackingStatus(row).obligations,s.finalObligations.obligations);assert.equal(s.tracking.total,0);
});

test('simulation tracking: a post-lock controller failure cannot relabel actual resource state as a completed earlier lock',()=>{
 const input=E.makeInput('empty',13,2),s=E.runEpisode(input,{api:{...api,updatePatternHistory(){throw Error('Post-lock fault injection');}},planner:r=>hd(r.observation)});
 assert.equal(s.stop,'execution-error');assert.equal(s.locks,0);assert.equal(s.finalObligations.scope,'partial');assert.equal(s.finalObligations.throughLock,1);assert.equal(s.finalObligations.coverage.status,'complete');assert.match(s.finalObligations.reason,/Execution interrupted/);assert.equal(s.tracking.scope,'retained-prefix');assert.equal(s.tracking.throughLock,1);
});
