'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const L=require('../scripts/lib/st-left-shape-metrics.cjs'),CLI=require('../scripts/analyze-st-left-shapes.cjs');
const E=require('../scripts/lib/st-simulation.cjs'),R=require('../st-rules'),P=require('../st-planner');
function board(heights){return Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>x<4&&y>=40-heights[x]?'J':'.').join(''));}
const stub={...P,startOpeningSession:()=>({active:true,clear:null}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,cycleResources:()=>({tsds:0,quads:0,pocket:0,centerCompletions:0}),advance:()=>null};
function hd(state,hold=false){const witness=hold?['HOLD','HD']:['HD'],proof=R.replay(state,witness);assert.ok(proof.valid);return{status:'test-only',target:proof.events[0].target,witness,hold,holdCount:Number(hold),continuation:[],evidence:{opening:true}};}
test('Left shape metrics: all twelve oriented shapes are elevation-independent',()=>{
 assert.equal(L.catalog.length,12);assert.equal(new Set(L.catalog.map(s=>s.id)).size,12);
 for(const shape of L.catalog)for(const elevation of [0,4,12]){
  const result=L.classify(board(shape.profile.map(h=>h+elevation)));
  assert.equal(result.shape,shape.id);assert.equal(result.tier,shape.tier);assert.deepEqual(result.profile,shape.profile);assert.equal(result.coveredCells,0);
 }
});
test('Left shape metrics: any covered Left hole overrides every listed tier',()=>{
 for(const shape of L.catalog)for(let x=0;x<4;x++){
  const rows=board(shape.profile.map(h=>h+4));rows[39]=rows[39].slice(0,x)+'.'+rows[39].slice(x+1);
  const result=L.classify(rows);assert.equal(result.shape,'other');assert.equal(result.tier,'other');assert.equal(result.reason,'left-holes');assert.equal(result.coveredCells,1);
 }
 const rightOnly=board([4,4,4,6]);rightOnly[37]=rightOnly[37].slice(0,8)+'I.';
 assert.equal(L.classify(rightOnly).shape,'shocky-left-1');
});
test('Left shape metrics: flat/unlisted boards and zero denominators are explicit',()=>{
 for(const heights of [[0,0,0,0],[4,4,4,4],[3,5,8,1]])assert.equal(L.classify(board(heights)).shape,'other');
 const result=L.finish(L.create(board([0,0,0,2])));assert.equal(result.initial.shape,'shocky-left-1');assert.equal(result.observations,0);
 assert.equal(Object.values(result.percentByShape).reduce((a,b)=>a+b,0),0);assert.throws(()=>L.classify([]),/40 by 10/);
});
test('Left shape metrics: actual locks count once despite HOLD and terminal abstention',()=>{
 const input=E.makeInput('empty',13,4),records=[];let calls=0;
 const result=E.runEpisode(input,{api:stub,planner:req=>++calls<=2?hd(req.observation,true):{status:'no-supported-continuation-found'},onRecord:r=>records.push(r)});
 assert.equal(result.locks,2);assert.equal(result.stop,'abstention');assert.equal(result.holds,2);
 assert.equal(result.leftShapes.observations,2);assert.equal(Object.values(result.leftShapes.countsByShape).reduce((a,b)=>a+b,0),2);
 assert.equal(Object.values(result.leftShapes.countsByTier).reduce((a,b)=>a+b,0),2);
 const offline=L.analyze(input,records);
 for(const key of Object.keys(result.leftShapes))assert.deepEqual(offline[key],result.leftShapes[key]);
 assert.equal(offline.coverage.terminalSummaryPresent,true);assert.equal(L.analyze(input,records.filter(r=>r.kind!=='summary')).coverage.terminalSummaryPresent,false);
 assert.equal(offline.perLock.length,2);for(const record of records.filter(r=>r.kind==='lock'))assert.deepEqual(record.metrics.leftShape,L.classify(record.after.board));
 assert.equal(L.analyze(input,records,{prefixLocks:1}).observations,1);assert.equal(L.analyze(input,records,{prefixLocks:0}).observations,0);
 assert.throws(()=>L.analyze(input,records,{prefixLocks:3}),/recorded lock count/);
 const bad=E.clone(records);bad.find(r=>r.kind==='lock').lock=3;assert.throws(()=>L.analyze(input,bad),/Noncontiguous/);
 const mismatch=E.clone(records);mismatch.at(-1).summary.locks++;assert.throws(()=>L.analyze(input,mismatch),/lock counts differ/);
});
test('Left shape metrics: count actual post-clear board rather than pre-clear skyline',()=>{
 const input=E.makeInput('empty',13,1);input.initial.board=board([0,0,0,0]);input.initial.board[39]='JJJJ..JJJJ';
 input.initial.active={type:'O',x:3,y:0,rotation:0,lastRotation:null};
 const records=[],result=E.runEpisode(input,{api:stub,planner:req=>hd(req.observation),onRecord:r=>records.push(r)});
 assert.equal(result.locks,1);assert.equal(result.lines,1);assert.equal(result.stop,'policy-violation');assert.equal(result.leftShapes.observations,1);const lock=records.find(r=>r.kind==='lock');
 assert.deepEqual(lock.metrics.leftShape.heights,[0,0,0,0]);assert.equal(result.leftShapes.countsByShape.other,1);
 assert.deepEqual(result.leftShapes.initial.heights,[1,1,1,1]);
});
test('Left shape metrics: offline CLI preserves source bytes and refuses output overwrite',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-left-shapes-'));
 try{
  const input={initial:{board:board([0,0,0,2])}},records=[{kind:'lock',lock:1,after:{board:board([6,4,4,4])}},{kind:'stop',lock:1},{kind:'summary',summary:{locks:1}}];
  const inputText=JSON.stringify(input),traceText=records.map(r=>JSON.stringify(r)).join('\n')+'\n';
  fs.writeFileSync(path.join(dir,'input.json'),inputText);fs.writeFileSync(path.join(dir,'trace.jsonl'),traceText);
  const out=path.join(dir,'counts.json'),result=CLI.analyzeDirectory(dir,{out});assert.equal(result.countsByShape['shocky-left-2'],1);assert.equal(result.percentByTier.SS,100);
  assert.ok(result.artifact.traceSha256);assert.deepEqual(JSON.parse(fs.readFileSync(out)),result);
  for(const file of ['st-structure.js','st-rules.js','st-bag.js'])assert.equal(result.artifact.sources[file],require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex'),'Catalogue/runtime source is bound: '+file);
  assert.throws(()=>CLI.analyzeDirectory(dir,{out}),/EEXIST/);assert.equal(fs.readFileSync(path.join(dir,'input.json'),'utf8'),inputText);assert.equal(fs.readFileSync(path.join(dir,'trace.jsonl'),'utf8'),traceText);
  assert.throws(()=>CLI.parse(['--episode']),/Missing/);assert.throws(()=>CLI.parse(['--unknown']),/Unknown/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Left lookup metrics: literal missing, listed unknown, known and crossing-only contours stay distinct',()=>{
 const cases=[[[0,0,0,39],'unlisted',null],[[0,3,2,1],'no-recorded-resolution','LC-023'],[[0,0,1,1],'recorded-resolution','LC-001'],[[0,0,0,0],'recorded-resolution','LC-090']];
 const counts=L.lookup.create();
 for(const [heights,status,id]of cases){const value=L.lookup.classify(board(heights));assert.equal(value.status,status);assert.equal(value.contour,id);assert.equal(value.noKnownResolution,status!=='recorded-resolution');assert.equal(value.availability,'not-assessed');assert.equal(value.executionVerified,false);L.lookup.add(counts,value);}
 const totals=L.lookup.finish(counts);assert.equal(totals.noKnownResolution,2);assert.equal(totals.unlisted,1);assert.equal(totals.noRecordedResolution,1);assert.equal(totals.recordedResolution,2);assert.equal(totals.noKnownResolutionPercent,50);assert.equal(totals.crossingOnly,1,'Flat LC-090 has only recorded Center-crossing paths');
 assert.equal(L.lookup.finish(L.lookup.create()).noKnownResolutionPercent,0);
 assert.throws(()=>L.lookup.add(counts,{}),/Invalid/);
 for(const contour of require('../st-left-contours').catalog){const value=L.lookup.classify(board(contour.profile.map(h=>h+2)));assert.equal(value.contour,contour.id);assert.equal(value.noKnownResolution,contour.dependencies.status==='unknown');}
 const unavailable=require('../st-left-dependencies').query(R.createState({board:board([0,0,1,1]),active:'T',queue:[],hold:null}));
 assert.equal(unavailable.status,'known');assert.equal(unavailable.alternatives.length,0);assert.equal(L.lookup.classify(board([0,0,1,1])).noKnownResolution,false,'Unavailable supply is not missing catalog knowledge');
 const holes=board([4,4,5,5]);holes[39]='.JJJ......';const value=L.lookup.classify(holes);assert.equal(value.noKnownResolution,false);assert.equal(value.coveredCells,1);L.lookup.add(counts,value);assert.equal(counts.leftHoleObservations,1);
});
test('Left lookup metrics: actual pre-decision roots include terminal abstention, not HOLD or internal nodes',()=>{
 const input=E.makeInput('empty',13,4),records=[];let calls=0;
 const result=E.runEpisode(input,{api:stub,planner:req=>++calls<=2?{...hd(req.observation,true),metrics:{nodes:99999}}:{status:'no-supported-continuation-found'},onRecord:r=>records.push(r)});
 assert.equal(result.locks,2);assert.equal(result.holds,2);assert.equal(result.leftLookup.observations,3);
 const decisions=records.filter(r=>r.request);assert.equal(decisions.length,3);
 for(const r of decisions)assert.deepEqual(r.leftLookup,L.lookup.classify(r.request.observation.board));
 const recovered=L.lookup.recover();records.forEach(r=>recovered.record(r));const prefix=recovered.finish();
 assert.equal(prefix.observations,3);assert.equal(prefix.scope,'retained-prefix');assert.equal(prefix.noKnownResolution,result.leftLookup.noKnownResolution);assert.equal(prefix.throughLock,2);
 const capped=E.runEpisode({...input,locks:1},{api:stub,planner:req=>hd(req.observation)});assert.equal(capped.leftLookup.observations,1);
 const error=E.runEpisode(input,{api:stub,planner:()=>{throw Error('controlled');}});assert.equal(error.stop,'planner-error');assert.equal(error.leftLookup.observations,1);
 const terminal=E.runEpisode({...input,initial:{...input.initial,topOut:true}},{api:stub,planner:()=>{throw Error('must not run');}});assert.equal(terminal.leftLookup.observations,0);
});
test('Left lookup recovery: missing markers, malformed observations and duplicate boundaries never invent counts',()=>{
 const recover=rows=>{const r=L.lookup.recover();rows.forEach(row=>r.record(row));return r.finish();};
 assert.equal(recover([]).observations,null);assert.equal(recover([{kind:'tracking-start',schemaVersion:1}]).scope,'unavailable');
 const marker={kind:'tracking-start',schemaVersion:1,leftLookupSchemaVersion:1},observation=R.createState({board:board([0,3,2,1])}),row={kind:'lock',lock:1,request:{observation},leftLookup:L.lookup.classify(observation.board)};
 const valid=recover([marker,row]);assert.equal(valid.noKnownResolution,1);assert.equal(valid.scope,'retained-prefix');
 for(const bad of [{...row,lock:3},{...row,leftLookup:{...row.leftLookup,noKnownResolution:false}},null,marker]){const r=recover([marker,row,bad,row]);assert.equal(r.observations,1);assert.match(r.reason,/mismatch|Noncontiguous|Malformed/);}
 assert.equal(recover([marker,row,row]).observations,1);
 assert.equal(recover([marker,row,{kind:'summary',summary:{locks:1}},{...row,lock:2}]).observations,1);
 assert.match(recover([marker,row,{kind:'summary',summary:{locks:9}}]).reason,/summary boundary/);
});

test('Left lookup recovery: CLI fallback retains measured prefixes and legacy summaries remain unavailable',t=>{
 const CLI=require('../scripts/simulate-st.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-lookup-recovery-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const input=E.makeInput('empty',13,1),records=[];
 const summary=E.runEpisode(input,{api:stub,planner:req=>hd(req.observation),onRecord:r=>records.push(r)});
 fs.writeFileSync(path.join(dir,'trace.jsonl'),records.filter(r=>r.kind!=='summary').map(r=>JSON.stringify(r)+'\n').join(''));
 const recovered=CLI.recoverSummary(dir,input,{status:null,error:Object.assign(Error('watchdog'),{code:'ETIMEDOUT'})});
 assert.equal(recovered.stop,'wall-cap');assert.equal(recovered.leftLookup.observations,1);assert.equal(recovered.leftLookup.scope,'retained-prefix');
 assert.match(CLI.leftLookupReport(recovered),/retained prefix/);
 delete summary.leftLookup;fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary));
 const legacy=CLI.recoverSummary(dir,input,{status:0});assert.equal(legacy.leftLookup.scope,'unavailable');assert.equal(legacy.leftLookup.noKnownResolution,null);assert.match(CLI.leftLookupReport(legacy),/unavailable/);
});
