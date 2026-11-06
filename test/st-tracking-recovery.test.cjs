'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const TM=require('../scripts/lib/st-tracking-metrics.cjs');
const CLI=require('../scripts/simulate-st.cjs'),Runner=require('../scripts/lib/st-simulation-runner.cjs');
const E=require('../scripts/lib/st-simulation.cjs'),R=require('../st-rules'),P=require('../st-planner');
const marker={kind:'tracking-start',schemaVersion:1};
const event=(code='obligation-lost',lock=1)=>({code,stage:'lock',lock,identity:{type:'S',id:4,bag:0},details:{reason:'test-only injected anomaly'}});
const clone=value=>JSON.parse(JSON.stringify(value));
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-tracking-recovery-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function recorded(locks=2){
 const input=E.makeInput('empty',13,locks),records=[];
 // Actual physics/history, controlled one-HD advice. No timed planner search.
 const api={...P,startOpeningSession:()=>({active:true}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,advance:()=>null,continueCommitment:()=>null};
 const summary=E.runEpisode(input,{api,planner:request=>{const replay=R.replay(request.observation,['HD']);return{target:replay.events[0].target,witness:['HD'],hold:false,evidence:{opening:true}};},onRecord:r=>records.push(r)});
 assert.equal(summary.locks,locks);return{input,records,summary,locks:records.filter(r=>r.kind==='lock')};
}
function failed(directory,input,records,result={status:1,stderr:'controlled failure'}){
 fs.writeFileSync(path.join(directory,'trace.jsonl'),records.map(r=>JSON.stringify(r)+'\n').join(''));
 return CLI.recoverSummary(directory,input,result);
}

test('tracking metrics: counts remain exact while examples and nested details stay bounded',()=>{
 const metrics=TM.create(),item=event();item.details={huge:'x'.repeat(10000),rows:Array.from({length:100},()=>({nested:['y'.repeat(10000)]}))};
 for(let i=0;i<10000;i++)metrics.record({...item,code:i%2?'projection-mismatch':'obligation-lost',lock:i+1});
 const snapshot=metrics.snapshot({throughLock:10000});
 assert.equal(snapshot.schemaVersion,1);assert.equal(snapshot.scope,'entire-run');assert.equal(snapshot.total,10000);
 assert.deepEqual(snapshot.counts,{'obligation-lost':5000,'projection-mismatch':5000});
 assert.equal(snapshot.examples.length,8);assert.equal(snapshot.examplesOmitted,9992);assert.equal(snapshot.throughLock,10000);
 assert.ok(JSON.stringify(snapshot.examples).length<30000,'Detail size is bounded independently of source payload size');
 item.identity.id=999;snapshot.examples[0].identity.id=888;snapshot.counts['obligation-lost']=0;
 const again=metrics.snapshot();assert.equal(again.examples[0].identity.id,4);assert.equal(again.counts['obligation-lost'],5000);
 assert.deepEqual(again.examples.map(e=>e.lock),[1,2,3,4,5,6,7,8]);
});

test('tracking metrics: zero is measured only when known and malformed events cannot alter counts',()=>{
 const metrics=TM.create();assert.deepEqual(metrics.snapshot(),{schemaVersion:1,scope:'entire-run',total:0,counts:{},examples:[],examplesOmitted:0});
 for(const bad of [null,{},event('',1),event('lost',-1),{...event(),stage:null},{...event(),lock:1.5}])assert.throws(()=>metrics.record(bad),/Malformed tracking event/);
 assert.equal(metrics.snapshot().total,0);assert.throws(()=>metrics.snapshot({scope:'all-maybe'}),/scope/);
 assert.deepEqual(TM.unavailable('legacy'),{schemaVersion:1,scope:'unavailable',throughLock:null,total:null,counts:null,examples:[],examplesOmitted:null,reason:'legacy'});
 metrics.record(event('__proto__'));assert.equal(metrics.snapshot().counts.__proto__,1);
});

test('tracking recovery: lock, stop and final-drain anomalies accumulate once without recounting summary metrics',t=>{
 const {input,locks,summary}=recorded(),dir=temporary(t);
 locks[0].trackingEvents=[event('obligation-lost',1)];locks[1].trackingEvents=[event('projection-mismatch',2)];
 const stop={kind:'stop',lock:2,trackingEvents:[event('coverage-degraded',2)]};
 const result=failed(dir,input,[marker,...locks,stop,{kind:'summary',summary:{...summary,tracking:{total:9999}},trackingEvents:[event('center-obligation-lost',2)]}]);
 assert.equal(result.tracking.scope,'retained-prefix');assert.equal(result.tracking.total,4);assert.equal(result.tracking.throughLock,2);
 assert.deepEqual(result.tracking.counts,{'obligation-lost':1,'projection-mismatch':1,'coverage-degraded':1,'center-obligation-lost':1});
 assert.equal(result.finalObligations.scope,'partial');assert.equal(result.finalObligations.throughLock,2);
 assert.deepEqual(result.finalObligations.obligations,summary.finalObligations.obligations);
 assert.match(result.tracking.reason,/Recorded prefix only/);assert.match(result.finalObligations.reason,/later actions/i);
});

test('tracking recovery: a forced child interruption preserves the exact prefix and partial status',async t=>{
 const {input,locks}=recorded(),dir=temporary(t),trace=path.join(dir,'trace.jsonl');
 locks[0].trackingEvents=[event()];
 const bytes=[marker,locks[0]].map(r=>JSON.stringify(r)+'\n').join('');
 const result=await Runner.runChild(process.execPath,['-e',`require('node:fs').writeFileSync(${JSON.stringify(trace)},${JSON.stringify(bytes)});setInterval(()=>{},1000);`],{timeoutMs:500});
 assert.equal(result.error.code,'ETIMEDOUT');assert.equal(result.signal,'SIGKILL');
 const recovered=CLI.recoverSummary(dir,input,result);
 assert.equal(recovered.stop,'wall-cap');assert.equal(recovered.locks,1);assert.equal(recovered.tracking.total,1);
 assert.equal(recovered.tracking.scope,'retained-prefix');assert.equal(recovered.finalObligations.scope,'partial');assert.equal(recovered.finalObligations.throughLock,1);
 assert.equal(fs.readFileSync(trace,'utf8'),bytes,'Recovery does not rewrite raw evidence');
});

test('tracking recovery: truncated JSON keeps counts and status only through retained authenticated locks',t=>{
 const {input,locks}=recorded(),dir=temporary(t),trace=path.join(dir,'trace.jsonl');
 locks[0].trackingEvents=[event()];
 const bytes=[marker,locks[0]].map(r=>JSON.stringify(r)+'\n').join('')+'{"kind":"lock","trackingEvents":';fs.writeFileSync(trace,bytes);
 const recovered=CLI.recoverSummary(dir,input,{status:null,error:Object.assign(Error('interrupted'),{code:'ABORT_ERR'})});
 assert.equal(recovered.tracking.scope,'retained-prefix');assert.equal(recovered.tracking.total,1);assert.equal(recovered.tracking.throughLock,1);
 assert.equal(recovered.finalObligations.scope,'partial');assert.equal(recovered.finalObligations.throughLock,1);
 assert.equal(recovered.detail.artifactRecovery.complete,false);assert.equal(recovered.detail.artifactRecovery.errors[0].file,'trace.jsonl');
 assert.equal(fs.readFileSync(trace,'utf8'),bytes);assert.throws(()=>Array.from(CLI.streamTrace(trace)),/JSON/);
});

test('tracking recovery: missing and legacy instrumentation stays unavailable, not a silent zero',t=>{
 const {input,locks}=recorded(),dir=temporary(t);
 for(const rows of [[],[...locks],[{kind:'tracking-start',schemaVersion:2},...locks],[{kind:'lock',metrics:{lines:0}},marker]]){
  const recovered=failed(dir,input,rows);
  assert.equal(recovered.tracking.scope,'unavailable');assert.equal(recovered.tracking.total,null);assert.equal(recovered.tracking.counts,null);
  assert.match(recovered.tracking.reason,/instrumentation/);
 }
 const noContext=clone(locks[0]);delete noContext.request.options.resourceContext;
 const legacy=failed(dir,input,[noContext]);assert.equal(legacy.finalObligations.scope,'unavailable');assert.equal(legacy.finalObligations.obligations,null);
});

test('tracking recovery: a new quiet prefix measures zero without claiming terminal completeness',t=>{
 const {input,locks}=recorded(),dir=temporary(t);
 for(const rows of [[marker],[marker,{kind:'stop',lock:0,error:'before planning'}],[marker,...locks]]){
  const recovered=failed(dir,input,rows);
  assert.equal(recovered.tracking.scope,'retained-prefix');assert.equal(recovered.tracking.total,0);assert.deepEqual(recovered.tracking.counts,{});
  assert.equal(recovered.tracking.examplesOmitted,0);
  if(rows.some(r=>r.kind==='lock'))assert.equal(recovered.finalObligations.scope,'partial');
  else{assert.equal(recovered.finalObligations.scope,'unavailable');assert.equal(recovered.finalObligations.obligations,null);}
 }
});

test('tracking recovery: malformed event rows stop counts atomically and cannot invent known zeros later',t=>{
 const {input,locks}=recorded(),dir=temporary(t);
 locks[0].trackingEvents=[event()];locks[1].trackingEvents=[event('projection-mismatch',2),{code:'missing-stage-and-lock'}];
 const recovered=failed(dir,input,[marker,...locks,{kind:'stop',lock:2,trackingEvents:[event('coverage-degraded',2)]}]);
 assert.equal(recovered.tracking.total,1);assert.equal(recovered.tracking.throughLock,1);assert.deepEqual(recovered.tracking.counts,{'obligation-lost':1});
 assert.match(recovered.tracking.reason,/Malformed tracking event/);assert.equal(recovered.finalObligations.throughLock,2,'Independent public-state authentication is not an event-count claim');
});

test('tracking recovery: repeated markers, broken lock order and malformed rows delimit the measured prefix',t=>{
 const {input,locks}=recorded(),dir=temporary(t);locks[0].trackingEvents=[event()];
 for(const row of [marker,null,[],42,{kind:'unknown'},{...locks[1],lock:9},{kind:'stop',lock:9},{kind:'summary',summary:{locks:9}}]){
  const recovered=failed(dir,input,[marker,locks[0],row,{kind:'stop',lock:1,trackingEvents:[event('should-not-count')]}]);
  assert.equal(recovered.tracking.total,1);assert.equal(recovered.tracking.throughLock,1);
  assert.deepEqual(recovered.tracking.counts,{'obligation-lost':1});
  assert.match(recovered.tracking.reason,/marker|Malformed|Noncontiguous|boundary/);
  assert.equal(recovered.finalObligations.throughLock,1,'Malformed lock labels cannot relabel a verified resource state');
 }
});

test('tracking recovery: event stages and lock boundaries reject future or misattributed events atomically',t=>{
 const {input,locks,summary}=recorded(),dir=temporary(t);locks[0].trackingEvents=[event()];
 const malformed=[
  {...locks[1],trackingEvents:[event('valid-before-invalid',2),event('future-lock',3)]},
  {...locks[1],trackingEvents:[event('wrong-lock',1)]},
  {...locks[1],trackingEvents:[{...event('future-handoff',3),stage:'handoff'}]},
  {...locks[1],trackingEvents:[{...event('future-reset',3),stage:'reset'}]},
  {...locks[1],trackingEvents:[{...event('unknown-stage',2),stage:'future-stage'}]},
  {...locks[1],trackingEvents:[{...event('earlier-action',1),stage:'action'}]},
  {...locks[1],trackingEvents:[{...event('future-action',3),stage:'action'}]},
  {kind:'stop',lock:1,trackingEvents:[event('future-stop',2)]},
  {kind:'stop',lock:1,trackingEvents:[{...event('earlier-stop-action',1),stage:'action'}]},
  {kind:'stop',lock:1,trackingEvents:[{...event('valid-before-invalid',2),stage:'action'},{...event('future-stop-action',3),stage:'action'}]},
  {kind:'summary',summary:{...summary,locks:1},trackingEvents:[event('future-final-drain',2)]},
  {kind:'summary',summary:{...summary,locks:1},trackingEvents:[{...event('earlier-final-action',1),stage:'action'}]},
  {kind:'summary',summary:{...summary,locks:1},trackingEvents:[{...event('future-final-action',3),stage:'action'}]},
 ];
 for(const row of malformed){
  const recovered=failed(dir,input,[marker,locks[0],row]);
  assert.equal(recovered.tracking.total,1);assert.equal(recovered.tracking.throughLock,1);
  assert.deepEqual(recovered.tracking.counts,{'obligation-lost':1});assert.match(recovered.tracking.reason,/event.*lock boundary/);
 }
 const boundaryEvents=[{...event('previous-handoff',1),stage:'handoff'},{...event('same-lock-reset',2),stage:'reset'},event('current-lock',2)];
 const valid=failed(dir,input,[marker,locks[0],{...locks[1],trackingEvents:boundaryEvents},{kind:'stop',lock:2,trackingEvents:[{...event('earlier-reset',1),stage:'reset'},event('current-stop',2)]}]);
 assert.equal(valid.tracking.total,6);assert.equal(valid.tracking.throughLock,2);assert.doesNotMatch(valid.tracking.reason,/does not match/);
});

test('tracking recovery: action events retain attempted locks without advancing completed boundaries',t=>{
 const {input,locks,summary}=recorded(),dir=temporary(t),action={...event('coverage-degraded',2),stage:'action'};
 for(const row of [{...locks[1],trackingEvents:[action]},{kind:'stop',lock:1,trackingEvents:[action]},{kind:'summary',summary:{...summary,locks:1},trackingEvents:[action]}]){
  const recovered=failed(dir,input,[marker,locks[0],row]);
  assert.equal(recovered.tracking.total,1);assert.deepEqual(recovered.tracking.examples,[action]);assert.equal(recovered.tracking.throughLock,row.kind==='lock'?2:1);assert.doesNotMatch(recovered.tracking.reason,/does not match/);
 }
});

test('tracking recovery: stored counters and status claims never replace authenticated public history',t=>{
 const {input,locks,summary}=recorded(1),dir=temporary(t),record=clone(locks[0]);
 const forged={coverage:{status:'complete'},locks:999,extraZ:{status:'available',remaining:999},hangingS:{status:'none-observed',known:[],unclassified:[]},hangingL:{status:'none-observed',known:[],unclassified:[]},center:{pending:[],debt:[]},reset:{status:'inactive',progress:999}};
 // These derived claims are not part of the replay proof. Valid proof bytes
 // must still produce the actual status, even beside contradictory counters.
 Object.assign(record.request.options.resourceContext,clone(forged));
 record.metrics.resourceObligations=0;record.metrics.finalObligations=clone(forged);record.finalObligations=clone(forged);record.resourceSummary=clone(forged);
 const recovered=failed(dir,input,[marker,record,{kind:'summary',summary:{...summary,finalObligations:forged}}]);
 assert.equal(recovered.finalObligations.scope,'partial');assert.equal(recovered.finalObligations.throughLock,1);
 assert.deepEqual(recovered.finalObligations.obligations,summary.finalObligations.obligations);
 assert.notEqual(recovered.finalObligations.obligations.extraZ.remaining,999);assert.notEqual(recovered.finalObligations.obligations.reset.progress,999);
 // Removing the action proof cannot be repaired by retaining those claims.
 record.request.options.resourceContext=clone(forged);
 const unavailable=failed(dir,input,[marker,record,{kind:'summary',summary:{...summary,finalObligations:forged}}]);
 assert.equal(unavailable.finalObligations.scope,'unavailable');assert.equal(unavailable.finalObligations.obligations,null);
});

test('tracking recovery: forged final lock falls back to prior authenticated status, never its advertised totals',t=>{
 const {input,locks}=recorded(),dir=temporary(t);
 locks[1].after.board[39]='XXXXXXXXXX';locks[1].metrics.resourceObligations=0;
 const recovered=failed(dir,input,[marker,...locks]);
 assert.equal(recovered.finalObligations.scope,'partial');assert.equal(recovered.finalObligations.throughLock,1);assert.match(recovered.finalObligations.reason,/could not be authenticated/);
 const onlyBad=failed(dir,input,[marker,locks[1]]);assert.equal(onlyBad.finalObligations.scope,'unavailable');assert.equal(onlyBad.finalObligations.obligations,null);
});

test('tracking recovery: completed legacy summaries are explicit and compact report never dumps examples',t=>{
 const {input,summary}=recorded(),dir=temporary(t),file=path.join(dir,'summary.json');
 const legacy=clone(summary);delete legacy.tracking;delete legacy.finalObligations;fs.writeFileSync(file,JSON.stringify(legacy));
 const recovered=CLI.recoverSummary(dir,input,{status:0});
 assert.equal(recovered.tracking.scope,'unavailable');assert.equal(recovered.finalObligations.scope,'unavailable');
 assert.match(CLI.trackingReport(recovered),/tracking unavailable; final status unavailable, obligations unavailable/);
 const text=CLI.trackingReport({...summary,tracking:{total:123,scope:'retained-prefix',throughLock:2,examples:[{details:'DO NOT PRINT THIS'}]}});
 assert.match(text,/123 anomalies \(retained prefix through lock 2\)/);assert.match(text,/final status current\/complete/);assert.doesNotMatch(text,/DO NOT PRINT THIS/);assert.ok(text.length<400);
});
