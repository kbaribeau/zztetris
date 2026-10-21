const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {arrange,fixture,core,input,json}=require('./support/st-driver.cjs');
const {verify}=require('./support/st-witness.cjs');
const cases=require('./support/st-allocation-fixtures.cjs');
const hidden={storage:{stGuideVisible:'false'}};
function load(g,c){arrange(g,c.heap,{active:c.active,hold:'',next:[...c.next]});return input(g);}
for(const c of cases)test(`st-allocation/starvation p${c.page}: fair initial work, unhinted witness and alternative revisits`,()=>withPage('st-lab.html',hidden,g=>{
  const s=load(g,c),a=core(g).advise(s),d=a.diagnostics;
  assert.equal(a.kind,'target','an unhinted root must verify before the shared budget is consumed');
  assert.equal(d.roots.length,12);assert.ok(d.roots.every(r=>r.initialWork===d.rootQuantum));
  // A completed witness ends work. It need not wait for EVERY other root to
  // finish its first path or receive a second turn.
  assert.ok(d.roots.every(r=>r.turns>=1));
  assert.ok(d.roots.slice(4).some(r=>r.depth>=1),'later roots make actual path progress, not only bookkeeping');
  assert.ok(d.roots.some(r=>r.depth===3));
  assert.ok(d.fairRevisits>0);assert.ok(d.promisingTurns>d.fairRevisits);
  assert.ok(d.poseStates<=60000&&d.lockStates<=600&&d.candidates<=120000);
  assert.ok(d.movementReuses>0&&d.geometryReuses>0);
  assert.ok(d.cacheEntries.movement<=16&&d.cacheEntries.geometry<=16);
  // Identical cells do not erase empty-hold/two-hold resource alternatives.
  assert.ok(d.roots.some((r,i)=>d.roots.some((q,j)=>i!==j&&r.piece.id===q.piece.id&&JSON.stringify(r.cells)===JSON.stringify(q.cells)&&r.prelude.length!==q.prelude.length)));
  verify(g,a); // All three cases now require a complete actual-engine witness.
}));

test('st-allocation/reuse is calculation-local: interleaving, abandonment and repeat outputs do not contaminate caches',()=>withPage('st-lab.html',hidden,g=>{
  const p=core(g),a=load(g,cases[0]),b=load(g,cases[1]);
  const expectedA=json(p.advise(a)),expectedB=json(p.advise(b));
  const first=p.start(a),second=p.start(b);let x,y;
  do {if(!x?.done)x=first.next();if(!y?.done)y=second.next();}while(!x.done||!y.done);
  assert.deepEqual(json(x.value),expectedA);assert.deepEqual(json(y.value),expectedB);
  const abandoned=p.start(a);for(let i=0;i<15000;i++)abandoned.next();abandoned.return();
  assert.deepEqual(json(p.advise(b)),expectedB);assert.deepEqual(json(p.advise(a)),expectedA);
}));

test('st-allocation/work accounting: every charged unit yields; tiny budgets cannot emit a partial witness',()=>withPage('st-lab.html',hidden,g=>{
  const s=load(g,cases[1]),p=core(g);
  for(const limits of [{},{maxPoseStates:1},{maxCandidates:2600},{maxLockStates:2}]){
    const job=p.start({...s,limits});let result,yields=0;
    do {result=job.next();if(!result.done)yields++;}while(!result.done);
    const d=result.value.diagnostics;
    assert.equal(yields,d.poseStates+d.lockStates+d.candidates);
    if(Object.keys(limits).length){assert.equal(result.value.kind,'abstain');assert.equal(d.effectiveHorizon,0);assert.equal(result.value.cells,undefined);}
  }
}));

test('st-allocation/reused paths preserve actual rotation state, stable preference and exact spin scoring',()=>withPage('st-lab.html',hidden,g=>{
  const p=core(g),w=g.window;
  for(const lastAction of ['ROT','SD']){
    fixture(g,'spin');w.zzBot.hold();w.clearActive();w.xPOS=6;w.yPOS=35;w.rot=2;w.lastAction=lastAction;w.updateGhost();w.setShape();
    const s=input(g),cells=json(w.pieces.T[2].flatMap((r,y)=>r.flatMap((v,x)=>v?[[x+6,y+35]]:[])));
    const a=p.advise({...s,preferredTarget:{kind:'T',cells}});
    assert.equal(a.kind,'target');assert.deepEqual(json(a.cells).sort(),cells.sort());assert.equal(a.prelude.length,0);
    if(lastAction==='ROT')assert.deepEqual(json(a.path),['HD']);
    else assert.ok(a.path.some(c=>['CW','CCW','R180'].includes(c)));
    verify(g,a);
  }
}));
