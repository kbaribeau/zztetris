'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),L=require('../st-left-context');
const {cases}=require('./support/st-autoplay-buried-phase.json');
const config={depth:3,width:8,maxNodes:45000,timeMs:SEARCH_TIME_MS};
for(const c of cases)test(`observed filler preserves the buried cycle through fresh replan (seed ${c.seed})`,()=>{
 const before=P.observe(c.snapshot),phase=S.notchPattern(before.board);
 assert.equal(phase.status,'established');
 const replay=R.replay(before,c.witness);assert.ok(replay.valid);assert.equal(replay.events.length,1);
 assert.deepEqual(replay.state.board,c.nextSnapshot.board);
 const inherited=S.advanceNotches(before.board,{state:replay.state,event:replay.events[0]},phase);assert.ok(inherited.valid);
 // Recreate only public visible state, with no preceding advice or lastEvent.
 const fresh=P.observe(c.nextSnapshot),anchored=S.notchPattern(fresh.board);
 assert.equal(fresh.lastEvent,null);assert.equal(anchored.status,'established');assert.equal(anchored.anchorRow,inherited.pattern.anchorRow);
 const imported=R.migrateState(JSON.parse(JSON.stringify(fresh)));assert.equal(S.notchPattern(imported.board).anchorRow,anchored.anchorRow);
 let planningRoot=fresh;
 if(c.seed===10342){
  // Original S filler preserves the buried phase but creates D with O active,
  // T held and no immediate J. Keep that original as a strict-D negative.
  const first=R.replay(fresh,['L','L','L','HD']);assert.ok(first.valid);assert.equal(L.createsD(fresh.board,first.state.board),true);
  assert.equal(P.dPatternAdmission(fresh,{state:first.state,event:first.events[0],witness:['L','L','L','HD']}).reason,'D-created-without-immediate-J');
  assert.equal(P.plan(fresh,config).target,null);
  // Separate disclosed supply variant: actual next J exits D. No fresh bag or
  // hidden history is inferred; the original source board/phase is unchanged.
  planningRoot={...fresh,queue:['J','I','Z','L','O','I']};delete planningRoot.bag;
 }
 const advice=P.plan(planningRoot,config);assert.ok(advice.target,advice.reason);
 let state=planningRoot,notches=inherited.pattern;for(const step of advice.continuation){const r=R.replay(state,step.witness);assert.ok(r.valid);const check=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},notches);assert.ok(check.valid);state=r.state;notches=check.pattern;}
 assert.ok(P.revalidate(planningRoot,advice));
 if(c.episode===0){assert.equal(advice.continuation[0].event.lines,2);assert.equal(advice.continuation[0].event.spin,'full');assert.equal(P.assess(R.replay(fresh,advice.witness).state.board).maxHeight,16);}
});
test('buried cap recognition uses occupancy and rejects damage, not stale phase history',()=>{
 const board=cases[0].nextSnapshot.board.map(r=>r.replace(/[IJLOSTZ]/g,'#'));
 assert.equal(S.notchPattern(board).anchorRow,37);
 const damage=board.slice();damage[22]=damage[22].slice(0,6)+'#'+damage[22].slice(7);
 assert.equal(S.notchPattern(damage).status,'broken');
 const absent=board.slice();absent[38]=absent[38].slice(0,8)+'.'+absent[38].slice(9);
 assert.equal(S.notchPattern(absent).status,'unanchored');
 const changed=board.slice();changed[37]=changed[37].slice(0,8)+'#'+changed[37].slice(9);
 assert.equal(S.notchPattern(changed).status,'unanchored','an O-like roof is not a cap');
});
test('a placement cannot substitute a different recognized phase for an established cycle',()=>{
 const c=require('./support/st-autoplay-conflicting-phase.json'),state=P.observe(c.snapshot),phase=S.notchPattern(state.board),r=R.replay(state,c.witness);
 assert.ok(r.valid);assert.equal(phase.anchorRow,37);assert.equal(S.notchPattern(r.state.board).anchorRow,33);
 const check=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},phase);
 assert.equal(check.valid,false);assert.equal(check.violation,'changed-established-scoring-phase');
 // Original visible order has no certified resource-safe route within this
 // bound; that is not evidence that its conflicting geometric phase is legal.
 const original=P.plan(state,{...config,deadline:Infinity});assert.equal(original.target,null);assert.equal(original.status,'budget-exhausted');
 // Separate physical-completion control: make the Center partner available,
 // rather than silently changing the original queue or weakening its policy.
 const available=R.createState({...state,active:'L'}),completion=S.geometry(available.board).center.completions.find(c=>c.piece==='L');assert.ok(completion);
 const finished=R.replay(available,completion.witness);assert.ok(finished.valid);assert.deepEqual(finished.events[0].cells.slice().sort(),completion.cells.slice().sort());
 // Milestone scope: this is already compromised, not a stable-ST positive
 // admission control. Supplying L does not repair its off-pattern column-7
 // vacancies. Preserve the physical completion and phase-conflict assertions,
 // but do not require the coach to select this recovery as ordinary play.
 assert.deepEqual(S.centerFoundation(available.board,phase).vacancies,[[6,35],[6,36]]);
 assert.deepEqual(S.centerFoundation(finished.state.board,phase).vacancies,[[6,35],[6,36]]);
 assert.ok(S.advanceNotches(available.board,{state:finished.state,event:finished.events[0]},phase).valid);
 assert.equal(P.ordinaryCenterEligible(available,{state:finished.state,event:finished.events[0]},phase),false);
});
