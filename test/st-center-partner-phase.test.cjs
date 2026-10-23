const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),F=require('../st-fixtures');
const raw=require('./support/st-user-o-partner-phase.json');
const state=()=>P.observe(raw);
const dropO=s=>R.placements(s,{maxNodes:45000}).placements.find(p=>p.witness.length===1&&p.witness[0]==='HD');
function replayPartner(board,c,notches){
 const r=R.replay(R.createState({board,active:c.piece,canHold:false}),c.witness);
 assert.equal(r.valid,true);assert.equal(r.events.length,1);assert.deepEqual(r.events[0].cells,c.cells);
 assert.equal(S.canonicalClear(r.events[0]),true);
 return S.advanceNotches(board,{event:r.events[0],state:r.state},notches);
}
test('st-center-phase/existing O partner remains supported but stacked O gets no invalid O/J credit',()=>{
 const s=state(),notches=S.notchPattern(s.board),existing=S.geometry(s.board,{notches}).center.completions.find(c=>c.piece==='J');
 assert.ok(existing);assert.equal(replayPartner(s.board,existing,notches).valid,true);
 const p=dropO(s),next=S.advanceNotches(s.board,p,notches);
 assert.equal(next.valid,true); // The O itself stays legal; no O-on-O ban.
 const g=S.geometry(p.state.board,{notches:next.pattern});
 assert.equal(g.center.completions.some(c=>c.piece==='J'),false);
 assert.ok(g.center.completions.some(c=>c.piece==='S'));assert.ok(g.center.completions.some(c=>c.piece==='L'));
 for(const c of g.center.completions)assert.equal(replayPartner(p.state.board,c,next.pattern).valid,true);
 const transition=S.transition(s,p,S.assess(p.state,{notches:next.pattern}),{notches});
 assert.equal(transition.pairFamily,null);assert.equal(transition.pairProgress,null);assert.equal(transition.pairEvidence,null);
 assert.doesNotMatch(transition.reason,/O\/J/);
});
test('st-center-phase/cache separates identical occupancy under different inherited phases',()=>{
 const s=state(),p=dropO(s),normal=S.advanceNotches(s.board,p,S.notchPattern(s.board)).pattern;
 // Explicit contradictory phase tests cache isolation, not a new gameplay fixture.
 // It cannot earn a partner by overriding the board's positively recognized cycle.
 const alternate={status:'established',anchorRow:27,protectedRows:[27,24,21,18,15,12,9,6,3,0],blockedRows:[]};
 S.clearCache();
 const a=S.geometry(p.state.board,{notches:alternate});assert.equal(a.center.completions.length,0);
 const b=S.geometry(p.state.board,{notches:normal});assert.equal(b.center.completions.some(c=>c.piece==='J'),false);assert.ok(b.center.completions.length>0);
 assert.deepEqual(S.geometry(p.state.board,{notches:alternate}),a);
 S.clearCache();assert.deepEqual(S.geometry(p.state.board,{notches:normal}),b);
 assert.deepEqual(S.geometry(p.state.board,{notches:alternate}),a);
});
test('st-center-phase/quad translation preserves valid original partner evidence',()=>{
 let s=state(),notches=S.notchPattern(s.board);
 const o=R.placements(s,{maxNodes:45000}).placements.find(p=>p.event.type==='O'&&p.event.cells.every(([x])=>x===2||x===3));
 notches=S.advanceNotches(s.board,o,notches).pattern;s=o.state;
 const i=R.placements(s,{maxNodes:45000}).placements.find(p=>p.event.type==='I'&&p.event.lines===4);
 assert.ok(i);notches=S.advanceNotches(s.board,i,notches).pattern;s=i.state;
 assert.equal(notches.anchorRow,36);
 const j=S.assess(s,{notches}).center.completions.find(c=>c.piece==='J');assert.ok(j);
 assert.equal(replayPartner(s.board,j,notches).valid,true);
});
test('st-center-phase/recommendation preserves cleanup without demanding immediate pair completion',()=>{
 const plan=P.plan(state(),{depth:3,width:8,maxNodes:45000});
 assert.equal(plan.status,'recommended-with-verified-prefix');assert.equal(plan.target.type,'O');
 assert.ok(plan.continuation[0].event.cells.every(([x])=>x===2||x===3));
 assert.equal(plan.continuation[1].event.type,'I');assert.equal(plan.continuation[1].event.lines,4);
 let s=state(),notches=S.notchPattern(s.board);
 for(const step of plan.continuation){const r=R.replay(s,step.witness);assert.equal(r.valid,true);const check=S.advanceNotches(s.board,{event:r.events[0],state:r.state},notches);assert.equal(check.valid,true);notches=check.pattern;s=r.state;}
});
test('st-center-phase/existing incomplete center constructions retain replayable compatible partners',()=>{
 for(const id of ['empty-hold','after-quad','center-j']){
  const s=P.observe(F.get(id).observation),notches=S.notchPattern(s.board),g=S.assess(s,{notches});
  for(const c of g.center.completions)assert.equal(replayPartner(s.board,c,notches).valid,true);
 }
 const plan=P.plan(F.get('empty-hold').observation,{depth:3,width:8,maxNodes:45000});
 const pair=plan.continuation.find(p=>p.structuralEvidence.pairFamily==='SL');assert.ok(pair);
 assert.deepEqual(pair.structuralEvidence.pairProgress.orderedPieces,['S','L']);
 const finish=plan.continuation.find(p=>p.event.type==='L'&&p.event.cells.every(([x])=>x>=4&&x<=6));assert.ok(finish);
 assert.equal(new Set(finish.structuralEvidence.structure.center.profile).size,1);
});
