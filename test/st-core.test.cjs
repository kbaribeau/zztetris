const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixtures}=require('./support/st-fixtures.cjs');
const {json,heap,core,input,fixture,arrange,replay}=require('./support/st-driver.cjs');
const hidden={storage:{stGuideVisible:'false'}};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

// The matcher-output contracts were intentionally superseded. These checks keep
// actual-engine legality, exact score/board transitions, identity/order, spawn,
// immutability and fail-closed budgets; no old priority is a success oracle.
function witness(g,a) {
  assert.equal(a.kind,'target',JSON.stringify(a.diagnostics));
  assert.equal(a.witness.steps.length,3);
  assert.equal(a.diagnostics.requestedHorizon,3);
  assert.equal(a.diagnostics.effectiveHorizon,3);
  const used=new Set();
  for(const step of a.witness.steps) {
    assert.ok(!used.has(step.piece.id));used.add(step.piece.id);
    replay(g,step);
    assert.deepEqual(heap(g),json(step.heap));
    assert.equal(g.window.cleared,step.expected.cleared);
    assert.equal(g.window.tspin,step.expected.tspin);
    assert.equal(g.window.mini,step.expected.mini);
    assert.notEqual(g.element('#notif').textContent,'TOP OUT');
  }
  assert.deepEqual(heap(g),json(a.witness.endpoint.heap));
  assert.equal(g.window.piece,a.witness.endpoint.active.kind);
  assert.equal(g.window.lastAction,a.witness.endpoint.active.lastAction,'newPiece preserves the last action; hold resets it');
  assert.equal(g.window.holdP,a.witness.endpoint.hold?.kind||'');
  assert.deepEqual(input(g).visibleNext.slice(0,a.witness.endpoint.visibleNext.length).map(p=>p.kind),json(a.witness.endpoint.visibleNext.map(p=>p.kind)));
  assert.equal(a.witness.endpoint.newConstructionObligations,'paid');
  assert.equal(a.witness.endpoint.opportunity.resourceStatus,'unverified-beyond-horizon');
  assert.match(a.explanation,/3 locks and spawns checked.*unverified/);
}
module.exports={witness};

for(const id of ['cap','cap-high','pocket','well','spin'])test(`st-core/source ${id}: all three actual locks replay with exact scoring and terminal spawn`,()=>withPage('st-lab.html',hidden,g=>{
  fixture(g,id);witness(g,core(g).advise(input(g)));
}));

test('st-core/scoring: source cap and non-mini double exact literal boards; final rotation matters',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g,'cap');const a=core(g).advise(input(g));
  assert.equal(a.rule,'cap');replay(g,a);assert.deepEqual(heap(g),fixtures.cap.afterCap);
  const t=a.witness.steps[1];assert.equal(t.rule,'double');replay(g,t);
  assert.deepEqual(heap(g),fixtures.cap.after);assert.equal(g.window.tspin,true);assert.equal(g.window.mini,false);assert.equal(g.window.cleared,2);
  assert.equal(t.obligations.unfinishedCenter,0);
  assert.equal(heap(g)[33].slice(4,7),'##.');
  fixture(g,'spin');const w=g.window;w.zzBot.hold();w.clearActive();w.xPOS=6;w.yPOS=35;w.rot=2;w.lastAction='SD';w.updateGhost();w.setShape();
  const next=core(g).advise(input(g));assert.equal(next.rule,'double');assert.ok(next.path.some(a=>['CW','CCW','R180'].includes(a)));
  w.zzBot.hardDrop();assert.equal(w.cleared,2);assert.equal(w.tspin,false);
}));

test('st-core/Center top: repairing an irregular initial row cannot inherit a newly formed uncovered cut',()=>withPage('st-lab.html',hidden,g=>{
  const rows=fixtures.cap.before.slice();rows[31]='###..#....';rows[32]='###..##...';
  const cells=[[3,31],[4,31],[3,32],[4,32]];
  arrange(g,rows,{active:'O',hold:'Z',next:['T','I','J','L','S','O']});
  const a=core(g).advise({...input(g),preferredTarget:{kind:'O',cells}});
  if(a.kind==='target') {
    if(JSON.stringify(json(a.cells).sort())===JSON.stringify(cells.sort()))assert.equal(a.obligations.unfinishedCenter,1);
    const endpoint=a.witness.endpoint;
    assert.equal(endpoint.heap[endpoint.facts.centerTop].slice(4,7),'###','new Center tops must be covered even at the inherited height after clears');
    witness(g,a);
  } else {
    assert.equal(a.cells,undefined);
    assert.equal(a.diagnostics.effectiveHorizon,0);
  }
}));

test('st-core/near negative: missing Left cell never receives stale double claim; real stale path is a single',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g,'spin');const a=core(g).advise(input(g));assert.equal(a.rule,'double');
  g.window.board[37][0]={t:0,c:''};const changed=core(g).advise(input(g));
  if(changed.kind==='target')assert.notDeepEqual(json(changed.cells),json(a.cells));
  replay(g,a);assert.equal(g.window.cleared,1);assert.equal(g.window.tspin,true);
}));

test('st-core/immutable determinism and frozen rule tables',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g);const s=freeze(input(g)),before=JSON.stringify(s),a=json(core(g).advise(s));
  for(let i=0;i<3;i++)assert.deepEqual(json(core(g).advise(s)),a);
  assert.equal(JSON.stringify(s),before);a.cells[0][0]=0;
  assert.notDeepEqual(json(core(g).advise(s).cells),a.cells);
}));

test('st-core/hold: actual, held, empty-hold and two-hold access preserve legal ordered spawns',()=>withPage('st-lab.html',hidden,g=>{
  for(const hold of ['Z','']) {
    arrange(g,fixtures.cap.before,{active:'T',hold,next:['Z','O','I','J','L','S']});
    const a=core(g).advise(input(g));witness(g,a);
  }
  fixture(g,'pocket');const w=g.window;w.clearActive();w.holdP='O';w.xPOS=5;w.yPOS=36;w.rot=1;w.lastAction='SD';w.updateGhost();w.setShape();
  const s=input(g);s.preferredTarget={kind:'I',cells:fixtures.pocket.pocketCells};
  const a=core(g).advise(s);assert.equal(a.kind,'target');assert.deepEqual(json(a.prelude),['hold','hold']);witness(g,a);
}));

test('st-core/spawn: blocked intermediate hold and next spawns cannot be bypassed',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g,'pocket');const w=g.window;w.clearActive();w.holdP='O';w.board[19][4]={t:1,c:'X'};w.xPOS=5;w.yPOS=36;w.rot=1;w.lastAction='SD';w.updateGhost();w.setShape();
  const a=core(g).advise(input(g));assert.equal(a.kind,'abstain');
  w.zzBot.hold();assert.equal(g.element('#notif').textContent,'TOP OUT');
  const rows=fixtures.cap.before.slice();rows[18]='......#...';
  arrange(g,rows,{active:'Z',hold:'T',next:['I','T','O','J','L','S']});
  const b=core(g).advise(input(g));assert.equal(b.kind,'abstain','next I spawn is checked even before any hold escape');
}));

test('st-core/visible prefix: hidden-suffix invariance, clipping, separators, no late-piece selection',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g);const p=core(g),api=g.window.eval('STCore'),a=json(p.advise(input(g)));
  g.window.queue.splice(6,g.window.queue.length-6,...'MZZZZZZ|IIIIIII|');assert.deepEqual(json(p.advise(input(g))),a);
  for(let boundary=0;boundary<=6;boundary++){const q=[...'IOTJLS'];q.splice(boundary,0,'|');q.push('Z','M');assert.deepEqual(json(api.visiblePreview(q)),[...'IOTJLS']);}
  assert.equal(api.visiblePreview(['I','|','|','T','J','L','S']),null);
  assert.equal(api.visiblePreview(['M','I','O','T','J','L','S']),null);
  assert.deepEqual(json(api.visiblePreview([...'IOTJLSM'])),[...'IOTJLS']);
  const s=input(g);s.hold=null;s.visibleNext=[];assert.equal(p.advise(s).kind,'abstain');
  const short=input(g);short.visibleNext=short.visibleNext.slice(0,2);assert.equal(p.advise(short).kind,'abstain','lock H must have a known following spawn');
}));

test('st-core/limits: malformed input and shared budgets fail closed, including candidate generation',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g);const s=input(g),p=core(g);
  for(const mutate of [x=>x.heap=[],x=>x.heap[39]='##########',x=>x.rules.gravity=true,x=>x.rules.mode='practice',x=>x.rules.kickset='SRS',x=>x.rules.version='old',x=>x.holdRule='once',x=>x.active.kind='M',x=>x.active.id=x.hold.id,x=>x.active.rotation=4,x=>x.visibleNext.push({id:'q7',kind:'I'}),x=>x.limits.maxPoseStates=Infinity]){const invalid=json(s);mutate(invalid);assert.equal(p.advise(invalid).reason,'unsupported');}
  for(const limits of [{maxPoseStates:0},{maxPoseStates:1},{maxLockStates:0},{maxCandidates:0},{maxCandidates:4000}]) {
    const a=p.advise({...s,limits});assert.equal(a.reason,'budget-exhausted');assert.equal(a.cells,undefined);assert.ok(a.diagnostics.effectiveHorizon<3);
    assert.deepEqual(json(p.advise({...s,limits})),json(a));
  }
  for(const depth of [0,1,2,4]) {
    const a=p.advise({...s,limits:{depth}});assert.equal(a.kind,'abstain');assert.equal(a.reason,'unsupported');assert.equal(a.cells,undefined);
  }
  witness(g,p.advise({...s,limits:{depth:3}}));
}));

test('st-core/resumable search: slicing is identical to synchronous advice and abandonment has no side effects',()=>withPage('st-lab.html',hidden,g=>{
  fixture(g);const s=input(g),before=g.snapshot(),p=core(g),job=p.start(s);let r,yields=0;
  do{r=job.next();yields++;}while(!r.done);
  assert.ok(yields>10000);assert.deepEqual(json(r.value),json(p.advise(s)));assert.deepEqual(g.snapshot(),before);
  const abandoned=p.start(s);for(let i=0;i<50;i++)abandoned.next();abandoned.return();assert.deepEqual(g.snapshot(),before);
}));
