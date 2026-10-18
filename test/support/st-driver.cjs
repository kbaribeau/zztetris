const assert=require('node:assert/strict');
const json=value=>JSON.parse(JSON.stringify(value));
const heap=g=>g.snapshot().heap.map(row=>row.replace(/[^.]/g,'#'));
const core=g=>g.window.eval('STCore.create(pieces,kicksets["SRS+"])');
const input=g=>json(g.window.stLab.beforeLock());
function start(g,id='cap') {g.element('#st-exercise').value=id;g.click('#st-start');}
function editPieces(g,{active,hold,next}) {
  const w=g.window,prompt=w.prompt;
  try {
    w.prompt=()=>hold;g.click('#h');
    w.clearActive();w.prompt=()=>[active,...next,...'IOTJLSZIOTJLSZ'].join('');g.click('#n');
    g.advance(16);
  } finally {w.prompt=prompt;}
}
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
module.exports={json,heap,core,input,start,editPieces,replay};
