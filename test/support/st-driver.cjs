const assert=require('node:assert/strict');
const json=value=>JSON.parse(JSON.stringify(value));
const heap=g=>g.snapshot().heap.map(row=>row.replace(/[^.]/g,'#'));
const core=g=>g.window.eval('STCore.create(pieces,kicksets["SRS+"])');
const input=g=>json(g.window.stLab.beforeLock());
function start(g,id='cap',variant='held') {g.element('#st-exercise').value=id;g.element('#st-variant').value=variant;g.click('#st-start');}
function replay(g,result) {
  assert.equal(result.kind,'target');
  const w=g.window;
  for(const action of result.prelude){assert.equal(action,'hold');w.zzBot.hold();}
  assert.equal(w.piece,result.piece.kind);
  const prior=heap(g);
  for(const action of result.path) {
    if(action==='HD') {
      assert.deepEqual([w.xPOS,w.yPOS,w.rot],[result.pose.x,result.pose.y,result.pose.rotation]);
      assert.equal(w.yPOS,w.yGHO,'HD must not move the final grounded pose');
      for(const [x,y] of result.cells) assert.equal(prior[y][x],'.');
      w.zzBot.hardDrop();
    } else if(['L','R','SD'].includes(action)) w.zzBot.move(action);
    else w.zzBot.rotate(action);
  }
  g.advance(16);
}
module.exports={json,heap,core,input,start,replay};
