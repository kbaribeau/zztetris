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
