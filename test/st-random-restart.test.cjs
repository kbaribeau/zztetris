'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
for(const mode of ['empty','marathon-rebuild']){
 test(`restart key generates a fresh bag in ${mode}`,()=>withPage('st-lab.html',{seed:42},g=>{
  g.element('#st-fixture').value=mode;
  g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));
  const before=g.snapshot();
  let calls=0;g.window.Math.random=()=>{calls++;return 0;};
  g.tap('KeyR');const first=g.snapshot();
  assert.equal(calls,6);
  assert.deepEqual(first.board,before.board);
  assert.equal(first.queue.length,6);
  assert.equal(new Set([first.active.type,...first.queue]).size,7);
  g.window.Math.random=()=>0.999;
  g.tap('KeyR');const second=g.snapshot();
  assert.notDeepEqual([second.active.type,...second.queue],[first.active.type,...first.queue]);
  assert.deepEqual(second.board,before.board);
  assert.equal(g.element('#st-undo').disabled,true);
  assert.equal(g.element('#st-fixture').value,mode);
 }));
}
