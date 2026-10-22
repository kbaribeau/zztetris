// Execute a complete certificate through the game, tracking identities and all
// following spawns independently of the adviser's geometric ranking estimates.
const assert=require('node:assert/strict');
const {input,replay,heap,json}=require('./st-driver.cjs');
function verify(g,a){
  assert.equal(a.kind,'target');assert.equal(a.witness.steps.length,3);
  let {active,hold,visibleNext:next}=input(g);const used=new Set();
  for(const step of a.witness.steps){
    for(const action of step.prelude){assert.equal(action,'hold');const old=active;active=hold||next.shift();hold=old;assert.ok(active);}
    assert.equal(step.piece.id,active.id);assert.equal(step.piece.kind,active.kind);assert.ok(!used.has(active.id));used.add(active.id);
    replay(g,step);assert.deepEqual(heap(g),json(step.heap));
    assert.equal(g.window.cleared,step.expected.cleared);assert.equal(g.window.tspin,step.expected.tspin);assert.equal(g.window.mini,step.expected.mini);
    assert.notEqual(g.element('#notif').textContent,'TOP OUT');active=next.shift();assert.ok(active);
    assert.equal(g.window.piece,active.kind);assert.equal(g.window.holdP,hold?.kind||'');
  }
  const end=a.witness.endpoint;
  assert.equal(end.active.id,active.id);assert.equal(end.hold?.id,hold?.id);assert.deepEqual(json(end.visibleNext),next);
  assert.deepEqual(heap(g),json(end.heap));
  assert.deepEqual([g.window.xPOS,g.window.yPOS,g.window.rot],[end.active.x,end.active.y,end.active.rotation]);
  assert.equal(g.window.lastAction,end.active.lastAction);
  assert.equal(end.obligations.newConstruction,'paid');
  assert.equal(end.opportunity.resourceStatus,'unverified-beyond-horizon');
}
module.exports={verify};
