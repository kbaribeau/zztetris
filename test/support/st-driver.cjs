const assert=require('node:assert/strict');
const json=value=>JSON.parse(JSON.stringify(value));
const heap=g=>g.snapshot().heap.map(row=>row.replace(/[^.]/g,'#'));
const core=g=>g.window.eval('STCore.create(pieces,kicksets["SRS+"])');
const input=g=>json(g.window.stLab.snapshot());
// Independent test-only examples, never a product entry mode or natural replay.
function fixture(g,id='cap') {
  const {fixtures}=require('./st-fixtures.cjs');
  const rows=id==='spin'?fixtures.cap.afterCap:fixtures[id].before;
  arrange(g,rows,{active:{cap:'T','cap-high':'T',pocket:'I',well:'O',spin:'O'}[id],
    hold:{cap:'Z','cap-high':'Z',pocket:'I',well:'I',spin:'T'}[id]});
}
function arrange(g,rows,{active='T',hold='Z',next=['O','I','J','L','S','T']}={}) {
  const w=g.window;
  w.board=rows.map(row=>[...row].map(c=>({t:c==='#'?1:0,c:c==='#'?'X':''})));
  w.queue=w.JSON.parse(JSON.stringify([active,...next,...'IOTJLSZ|IOTJLSZ|']));w.holdP=hold;w.held=false;w.lastAction='';
  w.newPiece();w.hist=[{board:JSON.stringify(w.board),queue:JSON.stringify(w.queue),hold:w.holdP,piece:w.piece}];w.histPos=0;
  g.advance(16);
}
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
module.exports={json,heap,core,input,fixture,arrange,editPieces,replay};
