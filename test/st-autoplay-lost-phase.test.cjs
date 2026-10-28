'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),F=require('../st-fixtures');
const {cases}=require('./support/st-autoplay-lost-phase.json');
const config={depth:3,width:8,maxNodes:45000,timeMs:SEARCH_TIME_MS};
for(const c of cases){
 test(`observed ${c.id} move ${c.move} cannot erase an established scoring phase`,()=>{
  const state=P.observe(c.snapshot),phase=S.notchPattern(state.board),replay=R.replay(state,c.advice.witness);
  assert.equal(phase.status,'established');assert.equal(phase.anchorRow,c.anchorRow);
  assert.ok(replay.valid);assert.equal(replay.events.length,1);assert.deepEqual(replay.events[0],c.advice.continuation[0].event);
  assert.equal(replay.events[0].lines,0);assert.ok(replay.events[0].cells.every(([x])=>x>=7));
  assert.equal(S.notchPattern(replay.state.board).status,'unanchored','the rules-legal placement removes independently recoverable phase evidence');
  const check=S.advanceNotches(state.board,{state:replay.state,event:replay.events[0]},phase);
  assert.equal(check.valid,false);assert.equal(check.violation,'lost-established-scoring-phase');assert.deepEqual(check.blockedCells,[]);
  assert.equal(check.pattern.status,'established','reject the earlier phase loss before any notch is filled');
  assert.equal(P.revalidate(state,c.advice),null);
  const first=c.advice.witness[0];assert.equal(P.advance(R.move(state,first),c.advice,first),null);
  // The later logged breach is ordinary piece legality too. Fresh recognition
  // alone had forgotten the earlier phase, while the inherited rows expose it.
  const breach=P.observe(c.firstNotchBreach.snapshot),later=R.replay(breach,c.firstNotchBreach.witness);
  assert.ok(later.valid);assert.deepEqual(later.events[0],c.firstNotchBreach.event);
  assert.equal(S.notchPattern(breach.board).status,'unanchored');
  const inherited=S.advanceNotches(breach.board,{state:later.state,event:later.events[0]},check.pattern);
  assert.equal(inherited.valid,false);assert.equal(inherited.violation,'filled-protected-column-seven-notch');
  assert.deepEqual(inherited.blockedCells,c.firstNotchBreach.blockedCells);
 });
 // Deferred pre-existing status bug: unsuitable-best rejection omits unfinished
 // proof status (e3499165). User-approved pending case; keep its body/assertions.
 // See docs/st-center-eligibility-scope.md, 'Deferred search-status regression'.
 test(`fresh advice avoids the observed ${c.id} phase-losing placement`,{
  todo:c.id==='marathon-preparation'?'Deferred incomplete-search status reporting; see st-center-eligibility-scope.md':false
 },()=>{
  let state=P.observe(c.snapshot),phase=S.notchPattern(state.board);const advice=P.plan(state,config);
  assert.notDeepEqual(advice.target,c.advice.target);
  if(!advice.target){const incomplete=advice.metrics.proofScheduling?.unfinished||advice.metrics.proofScheduling?.budgetStops;assert.equal(advice.status,incomplete?'budget-exhausted':'no-supported-continuation-found');return;}
  for(const step of advice.continuation){const replay=R.replay(state,step.witness);assert.ok(replay.valid);
   const check=S.advanceNotches(state.board,{state:replay.state,event:replay.events[0]},phase);assert.ok(check.valid,check.violation);
   const fresh=S.notchPattern(P.observe(replay.state).board);
   if(step.event.lines===0&&S.notchPattern(state.board).status==='established')assert.equal(fresh.status,'established');
   if(fresh.status!=='unanchored')assert.equal(fresh.anchorRow,check.pattern.anchorRow);
   state=replay.state;phase=check.pattern;
  }
 });
}
test('phase-loss guard does not add a nonclearing left-T prohibition',()=>{
 const controls=require('./support/st-reference-reset-limitations.json');
 for(const c of controls){const state=R.createState({board:c.before,active:'T'}),replay=R.replay(state,c.witness);
  assert.ok(replay.valid);assert.deepEqual(replay.state.board,c.after);assert.equal(replay.events[0].lines,0);
  assert.ok(replay.events[0].cells.every(([x])=>x<4));
  const before=S.notchPattern(state.board),after=S.notchPattern(replay.state.board);assert.equal(before.status,'established');assert.equal(after.anchorRow,before.anchorRow);
  assert.ok(S.advanceNotches(state.board,{state:replay.state,event:replay.events[0]},before).valid);
 }
});
test('an already unrecognized root does not acquire an invented inherited phase',()=>{
 const state=R.createState(F.get('left-side-diagnostic').observation),phase=S.notchPattern(state.board);
 assert.equal(phase.status,'unanchored');
 const replay=R.replay(state,['HD']);assert.ok(replay.valid);assert.equal(replay.events.length,1);
 assert.equal(S.notchPattern(replay.state.board).status,'unanchored');
 const check=S.advanceNotches(state.board,{state:replay.state,event:replay.events[0]},phase);
 assert.ok(check.valid);assert.equal(check.pattern.status,'unanchored');
});
test('canonical scoring keeps its translated prefix when residual geometry is not yet recognized',()=>{
 const state=P.observe(require('./support/st-autoplay-buried-phase.json').cases[0].nextSnapshot),phase=S.notchPattern(state.board);
 const double=R.placements(state).placements.find(p=>p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2);
 assert.ok(double);assert.equal(phase.source,'recognized-buried-scoring-cap');
 assert.equal(S.notchPattern(double.state.board).status,'unanchored','post-clear O residual recognition remains a separate limitation');
 const check=S.advanceNotches(state.board,double,phase);assert.ok(check.valid);assert.equal(check.pattern.anchorRow,phase.anchorRow-1);
 const left=R.placements(double.state).placements.find(p=>p.event.lines===0&&p.event.cells.every(([x])=>x<4));assert.ok(left);
 assert.ok(S.advanceNotches(double.state.board,left,check.pattern).valid,'unchanged unrecognized geometry is not a new phase-erasing construction');
});
