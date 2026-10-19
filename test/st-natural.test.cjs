const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {seed,steps,act}=require('./support/st-natural.cjs');
const {heap,input,core,replay,json}=require('./support/st-driver.cjs');
const {pad}=require('./support/st-fixtures.cjs');

test('st-natural/empty-board normal generation: eleven legal locks and hold lead to a verified quad',()=>withPage('st-lab.html',{seed},g=>{
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
  const answer=core(g).advise(input(g));
  assert.equal(answer.rule,'well-I-quad');assert.equal(answer.continuationVerified,false);
  assert.deepEqual(json(answer.prelude),[]);
  assert.deepEqual(json(answer.cells),[[7,36],[7,37],[7,38],[7,39]]);
  assert.equal(g.element('#st-target').children.length,8);
  replay(g,answer);
  assert.equal(g.window.cleared,4);assert.equal(g.window.tspin,false);
  assert.deepEqual(heap(g),pad(['##...##...','#.#.#.#...']));
  assert.equal(core(g).advise(input(g)).kind,'abstain');
}));
