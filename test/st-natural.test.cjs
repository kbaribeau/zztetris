const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {seed,steps,act}=require('./support/st-natural.cjs');
const {heap,input,core,settle}=require('./support/st-driver.cjs');
const {pad}=require('./support/st-fixtures.cjs');

test('st-natural/empty-board normal generation: eleven legal locks and a manual quad remain legal outside continuation coverage',()=>withPage('st-lab.html',{seed},g=>{
  assert.ok(heap(g).every(row=>row==='..........'));
  assert.equal(g.window.holdP,'');assert.equal(g.window.histPos,0);
  assert.equal(g.window.piece,'J');
  assert.deepEqual(g.snapshot().queue.slice(0,7),['Z','O','L','S','T','I','|']);
  assert.equal(core(g).advise(input(g)).kind,'abstain');
  for(const [i,step] of steps.entries()) {
    assert.equal(g.window.piece,step.active,`actual generated piece at lock ${i+1}`);
    for(const action of step.actions) {
      if(action==='HD')assert.equal(g.window.piece,step.piece);
      act(g.window,action);
    }
    g.advance(16);assert.equal(g.window.cleared,0);
    assert.equal(g.window.histPos,i+1);
  }
  assert.deepEqual(g.snapshot().heap.slice(-6),[
    'JJ...LL...','J.T.T.L...','JTTITTL.OO','ZZTITSS.OO','JZZISSL.OO','JJJILLL.OO',
  ]);
  assert.equal(g.window.piece,'I');assert.equal(g.window.holdP,'S');
  // This irregular stack has a legal quad but no established Center ladder.
  // The replacement deliberately does not equate a legal score with ST safety.
  assert.equal(core(g).advise(input(g)).kind,'abstain');settle(g);
  assert.equal(g.element('#st-target').children.length,0);
  for(const action of ['CW','R','R','HD'])act(g.window,action);
  assert.equal(g.window.cleared,4);assert.equal(g.window.tspin,false);
  assert.deepEqual(heap(g),pad(['##...##...','#.#.#.#...']));
  assert.equal(core(g).advise(input(g)).kind,'abstain');
}));
