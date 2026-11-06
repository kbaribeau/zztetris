'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),CLI=require('../scripts/simulate-st.cjs');
const E=require('../scripts/lib/st-simulation.cjs'),P=require('../st-planner'),R=require('../st-rules');
const api={...P,startOpeningSession:()=>({active:true}),acceptOpeningResult:P.acceptOpeningResult,updateOpeningSession:s=>s,advance:()=>null,continueCommitment:()=>null};
function hd(state,extra={}){const witness=['HD'],proof=R.replay(state,witness);return{target:proof.events[0].target,witness,hold:false,evidence:{opening:true},...extra};}
// Controlled legal stress witnesses, not engine-selected play. Four 1,000-action
// locks put the 4,097th action on either HD or its immediately preceding input.
function coverageBoundary(lastRotations,overrides={}){
 let decisions=0;const rows=[],input=E.makeInput('empty',123,5);
 const summary=E.runEpisode(input,{api:{...api,acceptOpeningResult:s=>s,updatePatternHistory:()=>null,...overrides},planner:r=>{
  const rotations=++decisions<=4?999:lastRotations,witness=Array.from({length:rotations},(_,i)=>i%2?'CCW':'CW').concat('HD'),proof=R.replay(r.observation,witness);
  assert.equal(proof.valid,true);return{target:proof.events[0].target,witness,hold:false,evidence:{opening:true}};
 },onRecord:r=>rows.push(r)});
 return{input,summary,rows};
}
function recover(t,input,rows){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-action-coverage-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.writeFileSync(path.join(dir,'trace.jsonl'),rows.map(r=>JSON.stringify(r)+'\n').join(''));return CLI.recoverSummary(dir,input,{status:1,stderr:'Controlled missing child summary'});}
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

for(const rotations of [96,97])test(`simulation tracking: coverage limit on ${rotations===96?'HD':'movement before HD'} emits exactly once with unavailable final status`,t=>{
 const {input,summary:s,rows}=coverageBoundary(rotations),events=rows.flatMap(r=>r.trackingEvents||[]);
 assert.equal(s.stop,'lock-cap');assert.equal(s.locks,5);assert.equal(s.censored,true);
 assert.equal(rows.filter(r=>r.kind==='lock').reduce((n,r)=>n+r.actions.length,0),4001+rotations);
 assert.deepEqual(events,[{code:'coverage-degraded',details:{before:'complete',after:'truncated'},stage:rotations===96?'lock':'action',lock:5}]);
 assert.equal(rows.find(r=>r.trackingEvents).lock,5);assert.equal(rows.find(r=>r.trackingEvents).kind,'lock');
 assert.equal(s.tracking.scope,'entire-run');assert.equal(s.tracking.throughLock,5);assert.equal(s.tracking.total,1);assert.deepEqual(s.tracking.counts,{'coverage-degraded':1});assert.deepEqual(s.tracking.examples,events);
 assert.equal(s.finalObligations.coverage.status,'truncated');assert.equal(s.finalObligations.scope,'unavailable');assert.equal(s.finalObligations.throughLock,5);assert.equal(s.finalObligations.obligations,null);
 const recovered=recover(t,input,rows);assert.equal(recovered.tracking.total,1);assert.equal(recovered.tracking.throughLock,5);assert.deepEqual(recovered.tracking.examples,events);assert.doesNotMatch(recovered.tracking.reason,/does not match/);
 assert.equal(recovered.finalObligations.scope,'partial');assert.equal(recovered.finalObligations.throughLock,4,'Only the earlier authenticated resource snapshot survives');
});

test('simulation tracking: movement coverage loss survives a controller error before HD',t=>{
 let completed=0,movements=0;const {input,summary:s,rows}=coverageBoundary(97,{updateOpeningSession(s){completed++;return s;},advance(state,advice){if(completed<4)return null;if(++movements===97)throw Error('After truncating movement');return advice;}});
 assert.equal(s.stop,'execution-error');assert.equal(s.detail,'After truncating movement');assert.equal(s.locks,4);
 const stop=rows.find(r=>r.kind==='stop'),events=rows.flatMap(r=>r.trackingEvents||[]);
 assert.equal(stop.lock,4);assert.deepEqual(stop.trackingEvents,events);assert.deepEqual(events,[{code:'coverage-degraded',details:{before:'complete',after:'truncated'},stage:'action',lock:5}]);
 assert.equal(s.tracking.scope,'retained-prefix');assert.equal(s.tracking.throughLock,4);assert.equal(s.tracking.total,1);assert.deepEqual(s.tracking.counts,{'coverage-degraded':1});
 assert.equal(s.finalObligations.coverage.status,'truncated');assert.equal(s.finalObligations.scope,'unavailable');assert.equal(s.finalObligations.throughLock,4);assert.equal(s.finalObligations.obligations,null);
 const recovered=recover(t,input,rows);assert.equal(recovered.tracking.total,1);assert.equal(recovered.tracking.throughLock,4);assert.deepEqual(recovered.tracking.examples,events);assert.doesNotMatch(recovered.tracking.reason,/does not match/);
 assert.equal(recovered.finalObligations.scope,'partial');assert.equal(recovered.finalObligations.throughLock,4);assert.match(recovered.finalObligations.reason,/later actions/i);
});
