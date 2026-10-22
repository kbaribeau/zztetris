const json=value=>JSON.parse(JSON.stringify(value));
const heap=g=>g.snapshot().heap.map(row=>row.replace(/[^.]/g,'#'));
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
module.exports={json,heap,fixture,arrange,editPieces};
