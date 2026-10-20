const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixture,heap,settle}=require('./support/st-driver.cjs');
function slowChange(g) {
  g.window.board[37][0]={t:0,c:''};
  g.window.queue.splice(0,6,...'ZZZZZZ');
  g.window.stLab.render();
  assert.equal(g.element('#st-status').dataset.result,'pending');
  assert.equal(g.element('#st-target').children.length,0,'hide stale target immediately');
}
test('st-scheduling/cancel: edit, hide/show, restart and movement cannot publish an old witness',()=>withPage('st-lab.html',{},g=>{
  fixture(g);const w=g.window,initial=w.stLab.diagnostics();assert.equal(initial.result.kind,'target');
  slowChange(g);g.tap('KeyA');assert.equal(w.stLab.diagnostics().pending,false);assert.equal(g.element('#st-target').children.length,0);
  g.tap('KeyR');g.tap('KeyA');settle(g);assert.equal(g.element('#st-status').dataset.result,'no-core-fit-found');
  assert.ok(heap(g).every(r=>r==='..........'));assert.ok(w.stLab.diagnostics().stats.cancelled>=1);
  fixture(g);const cells=JSON.stringify(w.stLab.diagnostics().result.cells);
  w.zzBot.move('L');settle(g);assert.equal(JSON.stringify(w.stLab.diagnostics().result.cells),cells);
  slowChange(g);g.tap('KeyR');settle(g);g.advance(1000);assert.equal(g.element('#st-target').children.length,0);
}));
test('st-scheduling/deadline: total elapsed exhaustion is honest abstention, not a partial target',()=>withPage('st-lab.html',{},g=>{
  fixture(g);slowChange(g);const now=g.window.performance.now();
  Object.defineProperty(g.window.performance,'now',{value:()=>now+1000,configurable:true});
  g.window.stLab.render();const d=g.window.stLab.diagnostics();
  assert.equal(d.result.reason,'time-exhausted');assert.equal(d.result.diagnostics.effectiveHorizon,0);
  assert.ok(d.result.diagnostics.workUnits>0);assert.equal(d.pending,false);assert.equal(g.element('#st-target').children.length,0);
}));
