const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixtures}=require('./support/st-center-fixtures.cjs');
const {arrange,core,input,replay,heap,json}=require('./support/st-driver.cjs');
const change=(rows,x,y,value)=>{rows[y]=rows[y].slice(0,x)+value+rows[y].slice(x+1);};
const rule=pair=>`center-${pair.toLowerCase()}-completion`;
const drawn=g=>Array.from(g.element('#st-target').children,r=>[r.getAttribute('x'),r.getAttribute('y')]);
const next=['O','T','I','J','L','Z']; // no invented unseen partner or S home

for(const [pair,f] of Object.entries(fixtures)) {
  test(`st-center/${pair}: completion, ordered access, open notch and real exact non-mini double`,()=>withPage('st-lab.html',{},g=>{
    for(const pieces of [
      {active:f.kind,hold:'',next},
      {active:'I',hold:f.kind,next:['T','O','I','J','L','Z']},
      {active:'I',hold:'',next:[f.kind,'T','O','I','J','Z']},
    ]) {
      arrange(g,f.before,pieces);
      const before=g.snapshot(),planner=core(g),a=planner.advise(input(g));
      assert.equal(a.rule,rule(pair));assert.equal(a.continuationVerified,true);
      assert.deepEqual(json(a.cells),f.cells);assert.equal(a.expected.cleared,0);
      assert.match(a.explanation,new RegExp(pair+' overhang'));
      assert.deepEqual(g.snapshot(),before,'advice never executes against the engine');
      replay(g,a);assert.equal(g.window.cleared,0);assert.deepEqual(heap(g),f.completed);
      assert.equal(heap(g)[f.y+2][6],'.','new notch stays empty');
      const t=planner.advise(input(g));assert.equal(t.rule,'capped-pocket-tsd');
      replay(g,t);assert.equal(g.window.cleared,2);assert.equal(g.window.tspin,true);assert.equal(g.window.mini,false);
      assert.deepEqual(heap(g),f.after);assert.notEqual(g.element('#notif').textContent,'TOP OUT');
    }
  }));
  test(`st-center/${pair}: unavailable completer, inaccessible ordered T, missing preview and shallow budget abstain`,()=>withPage('st-lab.html',{},g=>{
    for(const pieces of [
      {active:'I',hold:'Z',next:[f.kind,'T','O','J','L','Z']},
      {active:f.kind,hold:'J',next:['O','T','I','J','L','Z']},
      {active:f.kind,hold:'',next:['O','I','J','L','Z','O']},
    ]) {
      arrange(g,f.before,pieces);assert.equal(core(g).advise(input(g)).kind,'abstain');
    }
    arrange(g,f.before,{active:f.kind,hold:'',next});const s=input(g),p=core(g);
    s.visibleNext=[];assert.equal(p.advise(s).kind,'abstain');
    s.visibleNext=input(g).visibleNext;s.limits.depth=1;assert.equal(p.advise(s).kind,'abstain');
    s.limits.depth=2;s.limits.maxPoseStates=1;
    assert.equal(p.advise(s).reason,'budget-exhausted');assert.equal(p.advise(s).cells,undefined);
  }));
  test(`st-center/${pair}: exact envelope, solid support, whole-board access and exact double are necessary`,()=>withPage('st-lab.html',{},g=>{
    const scoringY={SL:37,OJ:35,LO:36}[pair];
    for(const mutate of [
      ...[4,5,6].map(x=>rows=>change(rows,x,f.y+3,'.')),
      rows=>change(rows,6,f.y+2,'#'),
      rows=>change(rows,4,f.y+2,'.'),
      rows=>change(rows,f.cells[0][0],f.cells[0][1],'#'),
      rows=>{rows[f.y-1]='#########.';},
      rows=>change(rows,0,scoringY,'.'),
    ]) {
      const rows=f.before.slice();mutate(rows);arrange(g,rows,{active:f.kind,hold:'',next});
      const a=core(g).advise(input(g));assert.equal(a.kind,'abstain',JSON.stringify(rows));
    }
    // The active filler fits, but the I that must spawn after it does not.
    for(const blocked of [true,false]) {
      const rows=f.before.slice();change(rows,blocked?6:0,18,'#');
      arrange(g,rows,{active:f.kind,hold:'',next:['I','T','J','L','Z','O']});
      const a=core(g).advise(input(g));assert.equal(a.kind,blocked?'abstain':'target');
      if(!blocked) {replay(g,a);assert.notEqual(g.element('#notif').textContent,'TOP OUT');}
    }
    // Deliberately replay stale positive actions: the near-negative really is
    // only a single, not evidence that every ST continuation is impossible.
    arrange(g,f.before,{active:f.kind,hold:'',next});const p=core(g),fill=p.advise(input(g));
    replay(g,fill);const t=p.advise(input(g));
    arrange(g,f.before,{active:f.kind,hold:'',next});
    g.window.board[scoringY][0]={t:0,c:''};
    assert.equal(p.advise(input(g)).kind,'abstain');replay(g,fill);replay(g,t);
    assert.equal(g.window.cleared,1);assert.equal(g.window.tspin,true);assert.equal(g.window.mini,false);
  }));
  test(`st-center/${pair}: actual trapped pose needs two legal holds; blocked intermediate spawn abstains`,()=>withPage('st-lab.html',{},g=>{
    for(const blocked of [false,true]) {
      arrange(g,f.before,{active:f.kind,hold:'Z',next:['T','O','I','J','L','Z']});const w=g.window;
      w.clearActive();if(blocked)w.board[19][4]={t:1,c:'X'};
      w.xPOS=7;w.yPOS=31;w.rot=1;w.lastAction='SD';w.updateGhost();w.setShape();
      const a=core(g).advise(input(g));
      if(blocked)assert.equal(a.kind,'abstain');
      else {
        assert.equal(a.rule,rule(pair));assert.deepEqual(json(a.prelude),['hold','hold']);
        replay(g,a);assert.deepEqual(heap(g),f.completed);
        replay(g,core(g).advise(input(g)));assert.deepEqual(heap(g),f.after);assert.equal(w.cleared,2);
      }
    }
  }));
  test(`st-center/${pair}: geometry generalizes across height, unequal Left filler and lower support`,()=>withPage('st-lab.html',{},g=>{
    // Raise every occupied row, with unrelated extra support at the bottom.
    const rows=[...f.before.slice(2),'#.........','##........'];change(rows,0,f.y-3,'#');
    arrange(g,rows,{active:f.kind,hold:'',next});const a=core(g).advise(input(g));
    assert.equal(a.rule,rule(pair));assert.deepEqual(json(a.cells),f.cells.map(([x,y])=>[x,y-2]));
    replay(g,a);replay(g,core(g).advise(input(g)));assert.equal(g.window.cleared,2);
  }));
}

test('st-center/stability: preference is revalidated, not a stale geometry certificate',()=>withPage('st-lab.html',{},g=>{
  const f=fixtures.SL,b=f.before.slice();
  b[23]='.....##...';b[24]='....##....';b[25]='....###...';
  arrange(g,b,{active:'L',hold:'',next});const p=core(g),s=input(g);
  const defaultCells=json(p.advise(s).cells);
  assert.notDeepEqual(defaultCells,f.cells,'default favors the simpler upper target');
  for(const preferredTarget of [null,{kind:'L',cells:[null,null,null,null]},{kind:'L',cells:'bad'}])
    assert.deepEqual(json(p.advise({...s,preferredTarget}).cells),defaultCells);
  const preferredTarget={kind:'L',cells:f.cells},a=p.advise({...s,preferredTarget});
  assert.deepEqual(json(a.cells),f.cells,'sound lower target stays selected');
  const invalid=json(s);change(invalid.heap,6,f.y+2,'#');
  assert.notDeepEqual(json(p.advise({...invalid,preferredTarget}).cells),f.cells);
  replay(g,a);replay(g,p.advise(input(g)));assert.equal(g.window.cleared,2);
}));

test('st-center/live adapter: stable movement/hold, lock/undo, edit/settings and hide both cues',()=>withPage('st-lab.html',{},g=>{
  for(const [pair,f] of Object.entries(fixtures)) {
    arrange(g,f.before,{active:f.kind,hold:'',next});const original=drawn(g);
    assert.equal(original.length,8);assert.match(g.element('#st-status').textContent,new RegExp(pair+' overhang'));
    g.window.zzBot.move('L');g.advance(16);assert.deepEqual(drawn(g),original);
    g.tap('ShiftLeft');g.advance(16);assert.deepEqual(drawn(g),original);assert.match(g.element('#st-status').textContent,pair==='LO'?/ACTIVE O/:/HOLD FIRST/);
    const before=g.snapshot();g.tap('KeyA');assert.equal(drawn(g).length,0);
    assert.doesNotMatch(g.element('#st-status').textContent,/overhang|double/);assert.deepEqual(g.snapshot(),before);
    g.tap('KeyA');assert.deepEqual(drawn(g),original);
    replay(g,core(g).advise(input(g)));assert.deepEqual(heap(g),f.completed);
    g.tap('KeyT');g.advance(16);assert.deepEqual(heap(g),f.before);assert.deepEqual(drawn(g),original);
    g.tap('KeyY');g.advance(16);assert.deepEqual(heap(g),f.completed);
    arrange(g,f.before,{active:f.kind,hold:'',next});
    g.click('#grav');assert.equal(drawn(g).length,0);assert.equal(g.element('#st-status').dataset.result,'unsupported');
    g.click('#grav');assert.equal(drawn(g).length,8);
    g.window.board[f.y+2][6]={t:1,c:'X'};g.advance(16);
    assert.equal(drawn(g).length,0);assert.equal(g.element('#st-status').dataset.result,'no-core-fit-found');
  }
  // Adding another valid option must not replace a still-sound target.
  arrange(g,fixtures.SL.before,{active:'L',hold:'',next});const original=drawn(g);
  for(const [y,row] of [[23,'.....##...'],[24,'....##....'],[25,'....###...']])
    g.window.board[y]=[...row].map(c=>({t:c==='#'?1:0,c:c==='#'?'X':''}));
  g.advance(16);assert.deepEqual(drawn(g),original);
}));

test('st-center/mirror boundary: original ZJ/OL/JO orientations are not advertised as SL/OJ/LO',()=>withPage('st-lab.html',{},g=>{
  for(const f of Object.values(fixtures)) {
    arrange(g,f.before.map(r=>[...r].reverse().join('')),{active:{L:'J',J:'L',O:'O'}[f.kind],hold:'',next});
    assert.equal(core(g).advise(input(g)).kind,'abstain');
  }
}));

test('st-center/LO reserve: any observable S rejects LO, hidden suffix is uncertainty not debt',()=>withPage('st-lab.html',{},g=>{
  const f=fixtures.LO;
  for(const pieces of [
    {active:'S',hold:'O',next:['T','O','I','J','L','Z']},
    {active:'O',hold:'S',next:['T','O','I','J','L','Z']},
    ...Array.from({length:6},(_,i)=>({active:'O',hold:'',next:['O','T','J','L','Z','I'].map((k,j)=>j===i?'S':k)})),
  ]) {
    arrange(g,f.before,pieces);assert.equal(core(g).advise(input(g)).kind,'abstain');
  }
  arrange(g,f.before,{active:'O',hold:'',next});const p=core(g),a=json(p.advise(input(g)));
  assert.equal(a.rule,rule('LO'));assert.match(a.explanation,/later S still needs a checked home/);
  const conflict=input(g);conflict.visibleNext[5].kind='S';
  assert.equal(p.advise({...conflict,preferredTarget:{kind:'O',cells:a.cells}}).kind,'abstain','a preference cannot override LO reserve');
  g.window.queue.splice(6,g.window.queue.length-6,...'SSSSSSS|SSSSSSS');
  assert.deepEqual(json(p.advise(input(g))),a,'hidden bags do not become invented obligations');
}));

test('st-center/completion-only: no pair starts or O-before-L promise',()=>withPage('st-lab.html',{},g=>{
  for(const [pair,f] of Object.entries(fixtures)) {
    const rows=f.before.slice();for(let y=f.y;y<f.y+3;y++)for(let x=4;x<7;x++)change(rows,x,y,'.');
    arrange(g,rows,{active:{SL:'S',OJ:'O',LO:'L'}[pair],hold:'',next:[f.kind,'T','O','I','J','Z']});
    const a=core(g).advise(input(g));assert.notEqual(a.rule,rule(pair));
    arrange(g,rows,{active:f.kind,hold:'',next});assert.notEqual(core(g).advise(input(g)).rule,rule(pair));
  }
}));

test('st-center/preserve scoring: an available exact double is not diverted into filler',()=>withPage('st-lab.html',{},g=>{
  for(const [pair,f] of Object.entries(fixtures)) {
    arrange(g,f.before,{active:'T',hold:f.kind,next});const a=core(g).advise(input(g));
    assert.equal(a.rule,'capped-pocket-tsd');replay(g,a);assert.equal(g.window.cleared,2);
  }
}));
