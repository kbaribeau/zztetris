'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),F=require('../st-fixtures');
const snapshot=require('./support/st-user-future-notch.json');
const config={depth:3,width:8,maxNodes:45000};
const clone=x=>JSON.parse(JSON.stringify(x));let discoveredAdvice;
// Reuse only identical positive setup, never the actual discovery or lifecycle checks.
function positiveAdvice(){if(!discoveredAdvice){const a=P.plan(snapshot,config);assert.ok(a.target,a.reason);discoveredAdvice=clone(a);}return clone(discoveredAdvice);}
const move=(state,witness)=>{const r=R.replay(state,witness);assert.ok(r.valid);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0],witness};};
test('user J snapshot reserves the future column-seven notch, not a score bonus',()=>{
 const phase=S.notchPattern(snapshot.board);assert.equal(phase.anchorRow,36);assert.ok(phase.protectedRows.includes(27));
 const placements=R.placements(snapshot).placements;
 const center=placements.find(p=>p.event.type==='J'&&p.event.cells.some(([x,y])=>x===6&&y===27));assert.ok(center);
 const rejected=S.advanceNotches(snapshot.board,center,phase);assert.equal(rejected.valid,false);assert.deepEqual(rejected.blockedCells,[[6,27]]);
 const left=placements.find(p=>p.event.type==='J'&&p.target.rotation===3&&p.event.cells.every(([x])=>x<4));assert.ok(left);assert.equal(S.advanceNotches(snapshot.board,left,phase).valid,true);
});
for(const timed of [false,true])test(`user J recommendation protects the future notch (${timed?`${SEARCH_TIME_MS}ms`:'full'})`,()=>{
 const a=P.plan(snapshot,{...config,...(timed?{timeMs:SEARCH_TIME_MS}:{})});assert.ok(a.target,a.reason);assert.equal(a.target.type,'J');assert.ok(a.continuation[0].event.cells.every(([x])=>x<4));
 let state=R.createState(snapshot),phase=S.notchPattern(state.board);
 for(const step of a.continuation){const p=move(state,step.witness),check=S.advanceNotches(state.board,p,phase);assert.ok(check.valid);phase=check.pattern;state=p.state;}
 if(!timed){assert.equal(a.evidence.tsdAt,3);assert.equal(a.metrics.completeDepth,3);discoveredAdvice=clone(a);}
});
test('current TSD arm may fill and clear its notch while higher notches translate down two rows',()=>{
 const state=F.get('direct-double').observation,phase=S.notchPattern(state.board);
 const p=R.placements(state).placements.find(p=>p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2);assert.ok(p);
 assert.ok(p.event.cells.some(([x,y])=>x===6&&y===phase.anchorRow));
 const check=S.advanceNotches(state.board,p,phase);assert.equal(check.valid,true);assert.equal(check.pattern.anchorRow,phase.anchorRow-1);
 assert.deepEqual(check.pattern.protectedRows.slice(0,3),phase.protectedRows.slice(1,4).map(y=>y+2));
 assert.equal(check.pattern.anchorRow,S.notchPattern(p.state.board).anchorRow);
});
test('uncapped wall establishes the same phase as its actual next Z, without requiring filled upper teeth',()=>{
 const state=F.get('cap-rebuild').observation,phase=S.notchPattern(state.board);
 assert.equal(phase.source,'recognized-next-Z-cap');
 const p=R.placements(state).placements.find(p=>p.event.type==='Z'&&S.transition(state,p).allocation==='right-cap-preparation');assert.ok(p);
 const check=S.advanceNotches(state.board,p,phase);assert.ok(check.valid);assert.equal(check.pattern.anchorRow,S.notchPattern(p.state.board).anchorRow);
 // The already-reviewed fixture has empty upper construction cells. They are
 // not demanded filled just because their eventual row lies between notches.
 assert.ok(state.board.some((row,y)=>y<phase.anchorRow&&!phase.protectedRows.includes(y)&&row[6]==='.'));
});
test('unrecognized geometry does not guess phase; known floor rebuild is anchored by its next Z witness',()=>{
 assert.equal(S.notchPattern(F.get('left-side-diagnostic').observation.board).status,'unanchored');
 for(const id of ['after-quad','marathon-rebuild']){const p=S.notchPattern(F.get(id).observation.board);assert.equal(p.status,'established');assert.equal(p.source,'witnessed-floor-Z-cap');assert.equal(40-p.anchorRow,3);}
 const phases=['o-filler','direct-double','higher-double','offset-double'].map(id=>40-S.notchPattern(F.get(id).observation.board).anchorRow);
 assert.deepEqual(phases,[3,4,5,6]);
});
test('already damaged user position abstains honestly rather than claiming a repair',()=>{
 const center=R.placements(snapshot).placements.find(p=>p.event.type==='J'&&p.event.cells.some(([x,y])=>x===6&&y===27));
 const bad={...center.state,queue:['T','S','J','I','L']};assert.equal(S.notchPattern(bad.board).status,'broken');
 const a=P.plan(bad,config);assert.equal(a.target,null);assert.match(a.reason,/column 7 is filled/);
});
test('revalidation and in-flight advancement reject the old notch-blocking recommendation',()=>{
 const center=R.placements(snapshot).placements.find(p=>p.event.type==='J'&&p.event.cells.some(([x,y])=>x===6&&y===27));
 const good=positiveAdvice(),stale={...good,target:center.target,hold:center.hold,holdCount:center.holdCount,witness:center.witness,continuation:[{target:center.target,hold:center.hold,holdCount:center.holdCount,witness:center.witness,event:center.event}],evidence:{...good.evidence,cycleDebt:0}};
 assert.equal(P.revalidate(snapshot,stale),null);
 stale.witness=['L','R',...center.witness];stale.continuation[0].witness=stale.witness;
 const action=stale.witness[0];assert.equal(P.advance(R.move(R.createState(snapshot),action),stale,action),null);
 assert.ok(P.revalidate(snapshot,good));
});
// Existing trusted reference fields supply exact before/after boards. These
// checks concern structural reservation/row translation, not inferred hold or
// spawn order and not a newly generated generalization position.
function referencePages(file){const fs=require('node:fs'),vm=require('node:vm');return vm.runInNewContext(fs.readFileSync(require.resolve('../tetris-fumen.js'),'utf8'),{window:{}})(2).decoder.decode(fs.readFileSync(file,'utf8').trim());}
function fieldBoard(page){return Array.from({length:40},(_,y)=>y<17?'..........':Array.from({length:10},(_,x)=>page.field.at(x,39-y).replace('_','.')).join(''));}
test('existing Sprint reference preserves phase through all locks, including all three quads',()=>{
 const pages=referencePages(require.resolve('../references/st-stacking/hXc2nbXcXOc.fumen'));let pattern=S.notchPattern(fieldBoard(pages[0])),quads=0,doubles=0;
 for(let i=0;i<pages.length-1;i++){
  const before=fieldBoard(pages[i]),after=fieldBoard(pages[i+1]),op=pages[i].operation;
  const cells=Array.from(op.positions(),c=>[c.x,39-c.y]),locked=before.map(row=>row.split(''));for(const[x,y]of cells)locked[y][x]=op.type;
  const clearedRows=locked.map((row,y)=>row.every(c=>c!=='.')?y:-1).filter(y=>y>=0),event={type:op.type,cells,clearedRows,lines:clearedRows.length,spin:op.type==='T'&&clearedRows.length===2?'full':'none'};
  assert.equal(S.canonicalClear(event),true);assert.equal(S.notchPattern(before).anchorRow,pattern.anchorRow,`fresh root phase at reference page ${i+1}`);const prior=pattern,check=S.advanceNotches(before,{event,state:{board:after}},prior);assert.equal(check.valid,true,`reference page ${i+1}: ${check.violation}`);pattern=check.pattern;
  if(event.lines===4){quads++;assert.equal(prior.status,'established');assert.equal(S.notchPattern(after).anchorRow,pattern.anchorRow,'fresh observation retains the translated phase');assert.deepEqual(pattern.protectedRows.slice(0,3),prior.protectedRows.filter(y=>!clearedRows.includes(y)).slice(0,3).map(y=>y+clearedRows.filter(r=>r>y).length));}
  if(event.lines===2)doubles++;
 }
 assert.equal(quads,3);assert.equal(doubles,14);
});
test('reviewed Ultra outer cleanup I is not mistaken for a Z roof while left rows remain incomplete',()=>{
 const reference=require('./support/st-reviewed-outer-i-notches.json');
 for(const board of reference.boards){const p=S.notchPattern(board);assert.equal(p.status,'established');assert.equal(40-p.anchorRow,6);assert.equal(p.source,'recognized-next-Z-cap');assert.equal(board[36][6]!=='.',true,'height four is not the next notch in this cleanup phase');}
});
