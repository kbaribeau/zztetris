const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {arrange,core,input,json}=require('./support/st-driver.cjs');
const {verify}=require('./support/st-witness.cjs');
const cases=require('./support/st-frontier-fixtures.cjs');
const {dualChannel}=require('./support/st-continuation-fixtures.cjs');
const hidden={storage:{stGuideVisible:'false'}};
const key=c=>c.map(([x,y])=>y*10+x).sort((a,b)=>a-b).join(',');
function load(g,c){arrange(g,c.heap,{active:c.active,hold:'',next:c.next});return input(g);}
const paidEstimate=r=>r.repair&&r.repair.remaining.every(n=>n===0);

for(const page of [199,338])test(`st-frontier/payable roof p${page}: retained unhinted, resource estimate is not its certificate`,()=>withPage('st-lab.html',hidden,g=>{
  const c=cases.find(c=>c.page===page),s=load(g,c),p=core(g),a=p.advise(s);
  const roof=a.diagnostics.roots.find(r=>r.piece.kind===c.active&&key(r.cells)===key(c.cells));
  assert.ok(roof,'an ugly but payable roof must survive the unhinted beam');assert.ok(paidEstimate(roof));
  assert.equal(roof.repair.status,'unverified-geometric-estimate');assert.equal(roof.repair.slots,2);
  assert.ok(a.diagnostics.repairProbes>0&&a.diagnostics.repairResourceChecks>0);
  verify(g,a); // An alternative recommendation is not automatically inferior.
  load(g,c);const exact=p.advise({...s,preferredTarget:{kind:c.active,cells:c.cells}});
  assert.equal(key(exact.cells),key(c.cells));assert.ok(exact.obligations.newVacancies.length);
  verify(g,exact); // The retained roof also has a real, paid three-lock route.
}));

test('st-frontier/backtracking: current branch can worsen; old depth/rank are only history, caches stay bounded',()=>withPage('st-lab.html',hidden,g=>{
  const a=core(g).advise(load(g,cases.find(c=>c.page===10))),d=a.diagnostics;
  assert.equal(a.kind,'abstain');assert.equal(d.effectiveHorizon,0);assert.equal(a.cells,undefined);
  assert.ok(d.roots.some(r=>r.rejectedEndpoints>0&&r.frontierDepth<r.depth));
  assert.ok(d.roots.some(r=>JSON.stringify(r.frontierRank)!==JSON.stringify(r.bestRank)));
  assert.ok(d.roots.every(r=>r.frontierChanges>0&&r.initialWork===d.rootQuantum));
  assert.ok(d.fairRevisits>0&&d.promisingTurns>d.fairRevisits);
  assert.ok(d.cacheEvictions>0&&d.cacheEntries.movement<=16&&d.cacheEntries.geometry<=16);
  assert.ok(d.poseStates<=60000&&d.lockStates<=600&&d.candidates<=120000);
}));

test('st-frontier/descendants: repair-family reservations are not just a root-only reorder',()=>withPage('st-lab.html',hidden,g=>{
  const a=core(g).advise(load(g,cases.find(c=>c.page===226))),d=a.diagnostics;
  // The first half of the root beam is the ordinary sorted prefix. Every root
  // reservation must occur in its tail and carry a paid geometric estimate.
  // More reservations than that upper bound must have occurred below root.
  const rootUpperBound=d.roots.slice(6).filter(paidEstimate).length;
  assert.ok(d.repairFamilyReservations>rootUpperBound);
  assert.ok(d.repairEstimates>4*12,'descendant estimates share the same decision budget');
  assert.equal(a.kind,'abstain');assert.equal(a.cells,undefined,'diversity is not acceptance');
}));

test('st-frontier/resource competition: estimates cannot spend one I twice or borrow a late I',()=>withPage('st-lab.html',hidden,g=>{
  arrange(g,dualChannel.before,dualChannel);const p=core(g),s=input(g),preferredTarget={kind:'S',cells:dualChannel.cells};
  const a=p.advise({...s,preferredTarget}),r=a.diagnostics.roots.find(r=>key(r.cells)===key(dualChannel.cells));
  assert.ok(paidEstimate(r));assert.deepEqual(json(r.repair.steps.map(s=>s.kind)),['I','I']);
  assert.equal(new Set(r.repair.steps.map(s=>s.id)).size,2);verify(g,a);
  arrange(g,dualChannel.before,{...dualChannel,hold:'Z',next:['I','O','O','J','L','I']});
  const limited=input(g),lateId=limited.visibleNext[5].id,late=p.advise({...limited,preferredTarget});
  for(const r of late.diagnostics.roots.filter(r=>key(r.cells)===key(dualChannel.cells))){
    assert.ok(!paidEstimate(r));
    if(r.repair){assert.equal(new Set(r.repair.steps.map(s=>s.id)).size,r.repair.steps.length);assert.ok(!r.repair.steps.some(s=>s.id===lateId));}
  }
  assert.notEqual(late.kind==='target'?key(late.cells):null,key(dualChannel.cells));
}));

test('st-frontier/charged estimates: exhaustion before any lock never emits advice',()=>withPage('st-lab.html',hidden,g=>{
  const s=load(g,cases.find(c=>c.page===199)),job=core(g).start({...s,limits:{maxCandidates:4000}});let r,yields=0;
  do{r=job.next();if(!r.done)yields++;}while(!r.done);
  const a=r.value,d=a.diagnostics;
  assert.equal(a.kind,'abstain');assert.equal(a.cells,undefined);assert.equal(d.effectiveHorizon,0);
  assert.equal(d.candidates,4000);assert.ok(d.repairProbes>0&&d.repairResourceChecks>0);assert.equal(d.lockStates,0);
  assert.ok(d.repairProbes+d.repairResourceChecks<=d.candidates);
  assert.equal(yields,d.poseStates+d.lockStates+d.candidates);
}));
