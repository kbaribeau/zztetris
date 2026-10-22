const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../st-fixtures'),R=require('../st-rules'),S=require('../st-structure');
const state=id=>F.get(id).observation;
const placements=id=>R.placements(state(id)).placements;
test('existing center partials expose exact executable hypothetical finishing placements',()=>{
 for(const[id,piece]of[['center-j','J'],['left-l','L']]){
  const s=state(id),a=S.assess(s),c=a.center.completions.find(c=>c.piece===piece);assert.ok(c);
  const fresh=R.createState({board:s.board,active:piece,canHold:false});let n=fresh;for(const action of c.witness)n=R.move(n,action);
  assert.deepEqual(n.lastEvent.target,c.target);assert.equal(S.assess(n).center.status,'level');assert.equal(c.access,'hypothetical-spawn-straight-drop');
 }
});
test('existing quad rebuild supports S preparation and concrete L completion without treating the center outlet as a hole',()=>{
 const s=state('after-quad'),p=placements('after-quad').find(p=>p.event.type==='S'&&p.target.rotation===0&&p.event.cells.every(([x])=>x>=4&&x<=6));
 assert.ok(p);const a=S.assess(p.state);assert.ok(a.center.completions.some(c=>c.piece==='L'));assert.equal(a.center.coveredInternal,0);assert.equal(S.transition(s,p,a).dependencyDebt,0);
});
test('visible and held instances are not reused across competing piece obligations',()=>{
 const supply=S.instances(state('center-j'));const selected=supply.find(p=>p.piece==='J');assert.ok(selected);
 const a=S.allocate([{kind:'center-partner',alternatives:['J']},{kind:'left-surface',alternatives:['J']}],[selected]);
 assert.equal(a.matched,1);assert.equal(a.conflicts.length,1);assert.equal(new Set(a.assignments.map(a=>a.instance)).size,a.assignments.length);
});
test('existing unknown-bag observation does not invent a forced next identity',()=>{
 const supply=S.instances(state('unknown-bag-double'));assert.equal(supply.some(p=>p.source==='forced-beyond-preview'),false);
});
test('existing direct double distinguishes an unusual I wall from the executed scoring move',()=>{
 const s=state('direct-double'),ps=placements('direct-double'),wall=ps.find(p=>p.event.type==='I'&&p.event.cells.every(([x])=>x===9)),double=ps.find(p=>p.event.spin==='full'&&p.event.lines===2);
 assert.ok(wall);assert.ok(double);assert.ok(S.transition(s,wall).dependencyDebt>S.transition(s,double).dependencyDebt);
 assert.equal(S.transition(s,double).allocation,'scoring-double');
});
test('existing marathon left I keeps a supported flat platform',()=>{
 const s=state('marathon-preparation'),p=placements('marathon-preparation').find(p=>p.event.type==='I'&&p.event.cells.every(([x])=>x<=3)&&new Set(p.event.cells.map(c=>c[1])).size===1);
 assert.ok(p);assert.equal(S.transition(s,p).allocation,'horizontal-left-I');assert.equal(S.assess(p.state).left.flat,true);
});
test('all existing fixture assessments expose finite estimates and bounded, honest evidence',()=>{
 for(const f of F.list){const a=S.assess(f.observation);assert.ok(Number.isFinite(a.supportEstimate));assert.ok(Number.isFinite(a.center.completionDebt));assert.ok(Number.isFinite(a.supply.conflictCount));assert.match(a.claim,/not a sustainability guarantee/);if(a.center.patternSupport==='unrecognized')assert.equal(a.uncertainty,true);}
 assert.equal(S.assess(state('o-rebuild')).right.shapeStatus,'cap-preparation');
});
test('existing late held double can rebuild with a checked J then O center pair',()=>{
 const s=state('late-held-double'),t=R.placements(s).placements.find(p=>p.event.spin==='full'&&p.event.lines===2);
 const j=R.placements(t.state).placements.find(p=>JSON.stringify(p.witness)===JSON.stringify(['R','R','CCW','HD']));assert.ok(j);
 const a=S.assess(j.state),o=a.center.completions.find(c=>c.piece==='O');assert.ok(o);
 let n=R.createState({board:j.state.board,active:'O',canHold:false});for(const action of o.witness)n=R.move(n,action);
 const transition=S.transition(j.state,{state:n,event:n.lastEvent});assert.equal(transition.pairFamily,null,'a finishing O alone does not establish an ordered pair history');assert.equal(transition.allocation,'center-completion');
 assert.equal(S.assess(n).center.status,'level');assert.equal(S.assess(n).center.sealedVoids,0);assert.ok(S.assess(n).center.coveredCavities>0);
});
test('existing quad rebuild exposes SL family and grades unknown partner supply instead of rejecting it',()=>{
 const s=state('after-quad'),p=R.placements(s).placements.find(p=>p.event.type==='S'&&p.target.rotation===0&&p.event.cells.every(([x])=>x>=4&&x<=6));
 assert.equal(S.transition(s,p).pairFamily,'SL');const known=S.assess(p.state),unknown=S.assess({...p.state,active:null,hold:null,queue:[],bag:null});
 assert.ok(unknown.supplyBurden>known.supplyBurden);assert.equal(unknown.center.status,known.center.status);
});
test('the other existing late-held J/O route finishes into a supported SL-ready surface',()=>{
 const s=state('late-held-double'),t=R.placements(s).placements.find(p=>p.event.spin==='full'&&p.event.lines===2),j=R.placements(t.state).placements.find(p=>JSON.stringify(p.witness)===JSON.stringify(['R','HD']));
 const completion=S.assess(j.state).center.completions.find(c=>c.piece==='O');assert.ok(completion);assert.equal(completion.resultStatus,'SL-preparation-surface');
 let n=R.createState({board:j.state.board,active:'O',canHold:false});for(const action of completion.witness)n=R.move(n,action);
 assert.equal(S.transition(t.state,j).pairFamily,null,'J then O must not be mislabeled as common O then J');assert.equal(S.assess(n).center.sealedVoids,0);assert.ok(S.assess(n).center.completions.some(c=>c.piece==='L'));
});
test('existing I-via-hold deep left deficit has a witnessed partial I repair without new cover',()=>{
 const s=state('i-via-hold'),before=S.assess(s),repair=before.left.completions.find(c=>c.piece==='I'&&c.resultStatus==='partial-repair');assert.ok(repair);
 let n=R.createState({board:s.board,active:'I',canHold:false});for(const action of repair.witness)n=R.move(n,action);
 const after=S.assess(n);assert.deepEqual(n.lastEvent.target,repair.target);assert.deepEqual(after.left.profile,[11,11,14,14]);assert.equal(after.left.covered,before.left.covered);assert.ok(after.left.roughness<before.left.roughness);
 assert.ok(before.obligations.find(o=>o.kind==='left-surface').completions.some(c=>c.piece==='I'&&c.resultStatus==='partial-repair'));
 assert.equal(S.assess(state('o-filler')).left.completions.some(c=>c.resultStatus==='partial-repair'),false,'ordinary shallow filler must not be labeled deep repair');
});
test('existing cap rebuild reserves scarce Z ahead of optional left work and exposes J/O substitute',()=>{
 const s=state('cap-rebuild'),a=S.assess(s),cap=a.obligations.find(o=>o.kind==='right-cap');assert.ok(cap);assert.equal(cap.priority,'essential');assert.equal(cap.access,'available-now-requires-actual-path');
 for(const c of cap.completions){const replay=R.replay(R.createState({board:s.board,active:'Z',canHold:false}),c.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events[0].cells,c.cells);assert.equal(S.geometry(replay.state.board).right.shapeStatus,'staggered-scoring-wall');}
 const route=S.leftSubstitutes(s.board).find(r=>r.pieces.join('')==='JO');assert.ok(route);assert.equal(route.resultStatus,'partial-scoring-row-fill');
 let board=s.board;for(const step of route.steps){const replay=R.replay(R.createState({board,active:step.piece,canHold:false}),step.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events[0].cells,step.cells);board=replay.state.board;}
 assert.deepEqual(S.geometry(board).left.profile,route.resultProfile);assert.equal(S.geometry(board).left.covered,a.left.covered);
 const ps=placements('cap-rebuild'),left=ps.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x<4)),right=ps.find(p=>p.event.type==='Z'&&S.geometry(p.state.board).right.shapeStatus==='staggered-scoring-wall');
 assert.ok(S.transition(s,left).opportunityCost>0);assert.equal(S.transition(s,right).opportunityCost,0);
 assert.equal(S.assess(left.state).capSupplyBurden,2);assert.equal(S.assess(right.state).capSupplyBurden,0);
});
test('essential identity allocation wins over earlier optional obligations and prefers accessible supply',()=>{
 const a=S.allocate([{kind:'left-surface',alternatives:['Z']},{kind:'right-cap',priority:'essential',alternatives:['Z']}],[{id:'active',piece:'Z',available:'now'}]);assert.equal(a.assignments[0].obligation,'right-cap');
 const b=S.allocate([{kind:'right-cap',priority:'essential',alternatives:['Z']}],[{id:'late',piece:'Z',available:'when-drawn',drawOffset:5},{id:'hold',piece:'Z',available:'hold-now'}]);assert.equal(b.assignments[0].instance,'hold');
});
test('existing cap recommendation reserves Z for the right and verifies its renewable reservoir',()=>{
 const P=require('../st-planner'),s=state('cap-rebuild'),p=P.plan(s,{depth:3,width:8,maxNodes:45000});assert.ok(p.target);assert.equal(p.continuation[0].event.type,'Z');assert.ok(p.continuation[0].event.cells.every(([x])=>x>=8));
 assert.equal(p.continuation[0].structuralEvidence.allocation,'right-cap-preparation');
 assert.equal(p.continuation[0].structuralEvidence.opportunityCost,0);
 assert.ok(p.continuation.every(step=>step.structuralEvidence.newlyCovered===0));
 assert.doesNotMatch(p.reason,/fills the left with J then O/);
 assert.equal(p.assessment.structure.right.reservoir.status,'verified-clear-reopens-reservoir');
 assert.equal(p.assessment.damageSealed,0);assert.equal(p.assessment.right.entry.status,'reachable-if-T-available');
 let n=s;for(const step of p.continuation){const replay=R.replay(n,step.witness);assert.equal(replay.valid,true);n=replay.state;}
});
test('existing quad rebuild labels L then O by ordered geometry, not by finishing-piece lookup',()=>{
 const s=state('after-quad'),p=placements('after-quad').find(p=>p.event.type==='L'&&p.event.cells.every(([x])=>x>=4&&x<=6)&&S.transition(s,p).pairFamily==='LO');assert.ok(p);
 const t=S.transition(s,p);assert.deepEqual(t.pairProgress.orderedPieces,['L','O']);assert.equal(t.pairProgress.step,1);assert.equal(t.pairProgress.completion.resultStatus,'level');
 assert.deepEqual(S.CENTER_PAIRS,{L:'O',O:'J',S:'L',Z:'J'});
});
test('existing cap rebuild does not call an arbitrary right Z a completed cap',()=>{
 const s=state('cap-rebuild'),wrong=R.placements(s).placements.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x>=7)&&S.geometry(p.state.board).right.shapeStatus==='unrecognized');assert.ok(wrong);
 const t=S.transition(s,wrong);assert.equal(t.allocation,'unrecognized-role');assert.ok(t.opportunityCost>0);
});
test('all four ordered center families have replayed geometry in already-existing starts',()=>{
 for(const[id,actions,family]of[['o-filler',['HD'],'OJ'],['empty-hold',['HOLD','R','HD'],'SL'],['left-l',['CW','HD'],'LO'],['cap-rebuild',['R','HD'],'ZJ']]){
  const s=state(id),first=R.replay(s,actions);assert.equal(first.valid,true);const t=S.transition(s,{state:first.state,event:first.events[0]});assert.equal(t.pairFamily,family);
  const c=t.pairProgress.completion,finish=R.replay(R.createState({board:first.state.board,active:c.piece,canHold:false}),c.witness);assert.equal(finish.valid,true);assert.deepEqual(finish.events[0].cells,c.cells);assert.equal(S.geometry(finish.state.board).center.status,'level');
 }
});

test('existing alternate J/O left-fill mechanics remain available after the Z cap',()=>{
 let n=state('cap-rebuild');
 for(const [i,witness]of [['R','R','R','R','CW','HD'],['L','L','L','CCW','HD'],['L','L','HD']].entries()){
  const replay=R.replay(n,witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);
  assert.equal(replay.events[0].type,['Z','J','O'][i]);assert.ok(replay.events[0].cells.every(([x])=>i===0?x>=8:x<4));n=replay.state;
 }
 assert.equal(R.tDoubleAccess(n.board).reachable,true);
});
