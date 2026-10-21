const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixtures}=require('./support/st-center-fixtures.cjs');
const {dualChannel,roof}=require('./support/st-continuation-fixtures.cjs');
const {arrange,core,input,replay,heap,json}=require('./support/st-driver.cjs');
const hidden={storage:{stGuideVisible:'false'}};
const key=c=>c?.map(([x,y])=>y*10+x).sort((a,b)=>a-b).join(',');
function replayAll(g,a){assert.equal(a.kind,'target',JSON.stringify(a.diagnostics));assert.equal(a.witness.steps.length,3);for(const s of a.witness.steps){replay(g,s);assert.deepEqual(heap(g),json(s.heap));assert.equal(g.window.cleared,s.expected.cleared);assert.equal(g.window.tspin,s.expected.tspin);assert.notEqual(g.element('#notif').textContent,'TOP OUT');}}

for(const [pair,f] of Object.entries(fixtures))test(`st-center/${pair}: three-lock construction, whole-board paths, no blanket partner policy`,()=>withPage('st-lab.html',hidden,g=>{
  arrange(g,f.before,{active:f.kind,hold:'',next:['O','T','I','J','L','S']});
  const a=core(g).advise({...input(g),preferredTarget:{kind:f.kind,cells:f.cells}});
  assert.equal(key(a.cells),key(f.cells));assert.equal(a.rule,'center');replay(g,a);assert.deepEqual(heap(g),f.completed);
  for(const s of a.witness.steps.slice(1)){replay(g,s);assert.deepEqual(heap(g),json(s.heap));}
  assert.equal(a.witness.endpoint.newConstructionObligations,'paid');
}));

test('st-continuation/new channels: S needs TWO distinct I remedies, including a shallow boundary vacancy',()=>withPage('st-lab.html',hidden,g=>{
  arrange(g,dualChannel.before,dualChannel);const p=core(g),s=input(g),preferredTarget={kind:'S',cells:dualChannel.cells};
  const a=p.advise({...s,preferredTarget});assert.equal(key(a.cells),key(dualChannel.cells));
  assert.equal(a.obligations.status,'verified-payable-within-horizon');assert.ok(a.obligations.newVacancies.length>=2);
  assert.deepEqual(json(a.witness.steps.map(s=>s.piece.kind)),['S','I','I']);
  assert.notEqual(a.witness.steps[1].piece.id,a.witness.steps[2].piece.id);
  replayAll(g,a);assert.deepEqual(heap(g),dualChannel.after);assert.ok(a.witness.steps.every(s=>s.expected.cleared===0));
  for(const next of [['I','O','O','J','L','I'],['O','O','J','L','I','I']]) {
    arrange(g,dualChannel.before,{...dualChannel,hold:'Z',next});const late=p.advise({...input(g),preferredTarget});
    assert.notEqual(key(late.cells),key(dualChannel.cells),'late preview Is are not a menu or reused resource');
  }
}));

test('st-continuation/freestyle roof: a temporary buried vacancy has an executed remedy, not a terminal bonus',()=>withPage('st-lab.html',hidden,g=>{
  arrange(g,roof.before,roof);const p=core(g),s=input(g),preferredTarget={kind:'J',cells:roof.cells};
  const a=p.advise({...s,preferredTarget});assert.equal(key(a.cells),key(roof.cells));
  assert.equal(a.obligations.status,'verified-payable-within-horizon');assert.ok(a.obligations.newVacancies.length);
  replay(g,a);assert.equal(heap(g)[30][1],'.');
  assert.equal(a.witness.steps[1].piece.kind,'S');replay(g,a.witness.steps[1]);assert.deepEqual(heap(g),roof.afterRepair);
  replay(g,a.witness.steps[2]);assert.equal(g.window.cleared,2);assert.equal(g.window.tspin,true);
}));

test('st-continuation/unfinished pairs: pair initiation is allowed only with completion inside the horizon',()=>withPage('st-lab.html',hidden,g=>{
  const f=fixtures.OJ,rows=f.before.slice();
  for(let y=f.y;y<f.y+3;y++)rows[y]=rows[y].slice(0,4)+'...'+rows[y].slice(7);
  const cells=[[4,f.y+1],[5,f.y+1],[4,f.y+2],[5,f.y+2]],preferredTarget={kind:'O',cells};
  arrange(g,rows,{active:'O',hold:'',next:['J','T','I','L','Z','S']});const s=input(g),p=core(g);
  const a=p.advise({...s,preferredTarget});assert.equal(key(a.cells),key(cells));assert.equal(a.obligations.status,'verified-payable-within-horizon');replayAll(g,a);
}));

test('st-continuation/whole-board negatives: roofed access, missing support, mirrors and obstructed preference',()=>withPage('st-lab.html',hidden,g=>{
  const f=fixtures.SL,p=core(g);
  for(const mutate of [rows=>{rows[f.y-1]='#########.';},rows=>{rows[f.y+3]='####.##...';},rows=>{rows[f.y+2]=rows[f.y+2].slice(0,6)+'#'+rows[f.y+2].slice(7);}]) {
    const rows=f.before.slice();mutate(rows);arrange(g,rows,{active:'L',hold:'',next:['T','O','I','J','Z','S']});
    const a=p.advise({...input(g),preferredTarget:{kind:'L',cells:f.cells}});
    if(a.kind==='target')replayAll(g,a); // alternatives are allowed, stale claims are not
  }
  arrange(g,f.before.map(r=>[...r].reverse().join('')),{active:'J',hold:'',next:['T','O','I','J','Z','S']});assert.equal(p.advise(input(g)).kind,'abstain');
  arrange(g,f.before,{active:'L',hold:'',next:['T','O','I','J','Z','S']});const s=input(g),a=p.advise(s);
  g.window.zzBot.move('L');const moved=p.advise({...input(g),preferredTarget:{kind:a.piece.kind,cells:a.cells}});assert.equal(key(moved.cells),key(a.cells));
  const blocked=json(s);const [x,y]=a.cells[0];blocked.heap[y]=blocked.heap[y].slice(0,x)+'#'+blocked.heap[y].slice(x+1);
  assert.notEqual(key(p.advise({...blocked,preferredTarget:{kind:a.piece.kind,cells:a.cells}}).cells),key(a.cells));
}));
