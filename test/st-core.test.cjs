const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixtures,pad}=require('./support/st-fixtures.cjs');
const {json,heap,core,input,fixture,arrange,editPieces,replay}=require('./support/st-driver.cjs');
const freeze=value=>{if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

for(const id of ['cap','cap-high','pocket','well','spin']) {
  test(`st-core/source replay/${id}: independent cells, real SRS+ paths and scoring`,()=>withPage('st-lab.html',{},g=>{
    const planner=core(g),expected=fixtures[id] || fixtures.cap;
    for(const availability of ['held','active','empty']) {
      fixture(g,id);
      const setup=g.snapshot();
      if(availability==='active')g.tap('ShiftLeft');
      if(availability==='empty')editPieces(g,{active:setup.piece,hold:'',next:[setup.hold,'O','I','J','L','S']});
      assert.deepEqual(heap(g),id==='spin'?fixtures.cap.afterCap:expected.before);
      let a=planner.advise(input(g));
      const firstCells=id==='pocket'?expected.pocketCells:id==='well'?expected.wellCells:id==='spin'?expected.spinCells:expected.capCells;
      assert.deepEqual(json(a.cells),firstCells);
      if(availability==='empty' && id!=='pocket') {assert.equal(a.from,'next-0');assert.deepEqual(json(a.prelude),['hold']);}
      if(availability==='empty' && id==='pocket') {assert.equal(a.from,'active');assert.deepEqual(json(a.prelude),[]);}
      replay(g,a);
      if(id==='cap')assert.deepEqual(heap(g),expected.afterCap);
      if(id==='pocket')assert.deepEqual(heap(g),expected.afterPocket);
      if(['cap','cap-high','pocket'].includes(id)) {
        assert.equal(g.window.cleared,0);
        a=planner.advise(input(g));
        assert.deepEqual(json(a.cells),id==='pocket'?expected.wellCells:expected.spinCells);
        replay(g,a);
      }
      assert.equal(g.window.cleared,['pocket','well'].includes(id)?4:2);
      assert.equal(g.window.tspin,!['pocket','well'].includes(id));
      assert.equal(g.window.mini,false);
      assert.deepEqual(heap(g),expected.after);
      const next=planner.advise(input(g));
      if(id==='cap-high') {
        assert.equal(next.rule,'uncapped-pocket-I','re-recognize the demonstrated high-notch → pocket transition');
        assert.deepEqual(json(next.cells),fixtures.pocket.pocketCells);
        replay(g,next);assert.equal(g.window.cleared,0);assert.deepEqual(heap(g),fixtures.pocket.afterPocket);
      } else assert.equal(next.kind,'abstain','no authored completion or assumed next phase');
    }
  }));
}

test('st-core/generalized: varying upper filler, notch heights and lower support, no whole-board certificate',()=>withPage('st-lab.html',{},g=>{
  for(const rows of [
    ['......#...','######....','#######...','#######...'],
    ['##........','####..#...','######....','#######...','#######...'],
    ['..##......','####..#...','######....','#######...','#######...','#######.#.'],
    ['#.........','####..#...','######....','#######...','#######...','##....#.#.','#######.#.'],
  ]) {
    arrange(g,pad(rows));const p=core(g),s=input(g),a=p.advise(s);
    assert.equal(a.rule,'uncapped-pocket-cap');assert.equal(a.continuationVerified,true);
    replay(g,a);assert.equal(g.window.cleared,0);
    const t=p.advise(input(g));assert.equal(t.rule,'capped-pocket-tsd');
    replay(g,t);assert.equal(g.window.cleared,2);assert.equal(g.window.tspin,true);assert.equal(g.window.mini,false);
  }
  // Extra upper filler and translated four-row pocket/well also remain eligible.
  for(const lower of [[],['#......#.#'],['#......#.#','.#........']]) {
    arrange(g,pad(['##........','....##....',...Array(4).fill('#######.#.'),...lower]),{active:'I',hold:'I'});
    const p=core(g);const a=p.advise(input(g));assert.equal(a.rule,'uncapped-pocket-I');
    replay(g,a);assert.equal(g.window.cleared,0);
    const b=p.advise(input(g));assert.equal(b.rule,'well-I-quad');replay(g,b);assert.equal(g.window.cleared,4);
  }
}));

test('st-core/near negatives: missing left cell is a single, blocked pocket, unsupported supports and unreachable scoring cavity',()=>withPage('st-lab.html',{},g=>{
  fixture(g,'spin');const stale=core(g).advise(input(g));
  g.window.board[37][0]={t:0,c:''};
  assert.equal(core(g).advise(input(g)).kind,'abstain');
  replay(g,stale); // Deliberately ignore rejection: demonstrate the actual counterexample.
  assert.equal(g.window.cleared,1);assert.equal(g.window.tspin,true);assert.equal(g.window.mini,false);
  for(const [id,x,y] of [['cap',0,37],['cap',6,39],['pocket',0,38]]) {
    fixture(g,id);g.window.board[y][x]={t:0,c:''};
    assert.equal(core(g).advise(input(g)).kind,'abstain');
  }
  fixture(g,'pocket');g.window.board[39][9]={t:1,c:'X'};
  assert.equal(core(g).advise(input(g)).kind,'abstain');
  fixture(g,'spin'); // Roof blocks entry but keeps target rows and corners intact.
  for(let x=5;x<10;x++)g.window.board[36][x]={t:1,c:'X'};
  assert.equal(core(g).advise(input(g)).kind,'abstain');
}));

test('st-core/real scoring: a double without final rotation is not a T-spin; fresh recognition after deviation',()=>withPage('st-lab.html',{},g=>{
  fixture(g,'spin');g.tap('ShiftLeft');const w=g.window;
  w.clearActive();w.xPOS=6;w.yPOS=35;w.rot=2;w.lastAction='SD';w.updateGhost();w.setShape();
  const a=core(g).advise(input(g));
  assert.equal(a.kind,'target');assert.ok(a.path.some(action=>['CW','CCW','R180'].includes(action)));
  w.zzBot.hardDrop();g.advance(16);
  assert.equal(w.cleared,2);assert.equal(w.tspin,false);
  assert.deepEqual(heap(g),fixtures.cap.after);
  assert.equal(core(g).advise(input(g)).kind,'abstain');
}));

test('st-core/determinism: immutable inputs, fresh advisors, duplicate-instance tie break',()=>withPage('st-lab.html',{},g=>{
  fixture(g,'pocket');
  const snapshot=freeze(input(g)),before=JSON.stringify(snapshot),planner=core(g);
  const first=json(planner.advise(snapshot));
  assert.equal(first.piece.id,'active');assert.deepEqual(first.prelude,[]);
  for(let i=0;i<4;i++)assert.deepEqual(json(core(g).advise(snapshot)),first);
  assert.equal(JSON.stringify(snapshot),before);
  first.cells[0][0]=0;
  assert.equal(planner.advise(snapshot).cells[0][0],9);
}));

test('st-core/hold: only active/held/next-0; empty and repeated swaps preserve order',()=>withPage('st-lab.html',{},g=>{
  const planner=core(g);
  fixture(g);const before=g.snapshot();
  assert.equal(planner.advise(input(g)).piece.id,'hold');
  g.tap('ShiftLeft');g.advance(16);
  assert.equal(g.window.piece,'Z');assert.equal(g.window.holdP,'T');
  assert.deepEqual(g.snapshot().queue,before.queue);
  assert.deepEqual(json(planner.advise(input(g)).prelude),[]);
  g.tap('ShiftLeft');g.advance(16);
  assert.equal(g.window.piece,'T');assert.deepEqual(g.snapshot().queue,before.queue);
  fixture(g);editPieces(g,{active:'T',hold:'',next:['Z','O','I','J','L','S']});const queue=g.snapshot().queue;
  assert.equal(planner.advise(input(g)).from,'next-0');
  g.tap('ShiftLeft');assert.deepEqual(g.snapshot().queue,queue.slice(1));
  g.tap('ShiftLeft');assert.deepEqual(g.snapshot().queue,queue.slice(1));
  assert.equal(g.window.piece,'T');assert.equal(g.window.holdP,'Z');
  fixture(g);editPieces(g,{active:'O',hold:'J',next:['Z','T','I','S','L','O']});
  assert.equal(planner.advise(input(g)).reason,'no-core-fit-found');
  const bottom=heap(g);g.tap('Space');assert.notDeepEqual(heap(g),bottom);
}));

test('st-core/respawn: two holds recover trapped I without skipping preview',()=>withPage('st-lab.html',{},g=>{
  fixture(g,'pocket');const w=g.window;
  w.clearActive();w.holdP='O';w.xPOS=5;w.yPOS=36;w.rot=1;w.lastAction='SD';w.updateGhost();w.setShape();
  const before=g.snapshot().queue,answer=core(g).advise(input(g));
  assert.equal(answer.kind,'target');assert.equal(answer.piece.id,'active');
  assert.deepEqual(json(answer.prelude),['hold','hold']);
  replay(g,answer);
  assert.deepEqual(g.snapshot().queue.slice(0,5),before.slice(1,6));
  assert.deepEqual(heap(g),fixtures.pocket.afterPocket);
}));

test('st-core/visible horizon: hidden suffix invariance, renderer clipping and separators',()=>withPage('st-lab.html',{},g=>{
  fixture(g);const w=g.window,planner=core(g),api=w.eval('STCore');
  const original=json(planner.advise(input(g)));
  w.queue.splice(6,w.queue.length-6,...'MZZZZZZ|IIIIIII|');
  assert.deepEqual(json(planner.advise(input(g))),original);
  const expected=['I','O','T','J','L','S'];
  for(let boundary=0;boundary<=6;boundary++) {
    const q=[...expected];q.splice(boundary,0,'|');q.push('Z','M');
    assert.deepEqual(json(api.visiblePreview(q)),expected);
  }
  assert.deepEqual(json(api.visiblePreview(['I','O','T','J','L','S','M'])),expected);
  assert.equal(api.visiblePreview(['I','|','|','T','J','L','S']),null);
  assert.equal(api.visiblePreview(['M','I','O','T','J','L','S']),null);
  const limited=input(g);limited.hold=null;limited.visibleNext=[];
  assert.equal(planner.advise(limited).reason,'no-core-fit-found');
}));

test('st-core/continuation: actual ordered legal access, not a promised future piece or completion',()=>withPage('st-lab.html',{},g=>{
  fixture(g);g.tap('ShiftLeft');const planner=core(g),s=input(g);
  assert.equal(planner.advise(s).continuationVerified,true);
  s.hold={id:'hold',kind:'J'};s.visibleNext=[{id:'next-0',kind:'O'},{id:'next-1',kind:'T'}];
  assert.equal(planner.advise(s).continuationVerified,false);
  s.visibleNext=[{id:'next-0',kind:'T'}];
  assert.equal(planner.advise(s).continuationVerified,true);
  s.visibleNext=[];
  assert.equal(planner.advise(s).continuationVerified,false);
  fixture(g,'pocket');const pocket=input(g);pocket.hold={id:'hold',kind:'J'};
  assert.equal(planner.advise(pocket).continuationVerified,false,'no assumed second I');
  fixture(g,'well');assert.equal(planner.advise(input(g)).continuationVerified,false,'quad is not an indefinite continuation');
}));

test('st-core/abstentions: malformed snapshots, rules and deterministic finite budgets',()=>withPage('st-lab.html',{},g=>{
  fixture(g);const s=input(g),planner=core(g);
  for(const mutate of [
    x=>{x.heap=[];},x=>{x.heap[39]='##########';},x=>{x.heap[39]='invalid';},
    x=>{x.rules.mode='practice';},x=>{x.rules.gravity=true;},x=>{x.rules.kickset='SRS';},x=>{x.rules.version='old';},x=>{x.holdRule='once-per-lock';},
    x=>{x.active.kind='M';},x=>{x.active.id=x.hold.id;},x=>{x.active.rotation=4;},
    x=>{x.visibleNext.push({id:'q7',kind:'I'});},x=>{x.limits.maxPoseStates=Infinity;},
  ]) {const invalid=json(s);mutate(invalid);assert.equal(planner.advise(invalid).reason,'unsupported');}
  for(const limits of [{maxPoseStates:0},{maxPoseStates:1},{maxLockStates:0}]) {
    const result=planner.advise({...s,limits:{...s.limits,...limits}});
    assert.equal(result.reason,'budget-exhausted');assert.equal(result.cells,undefined);
    assert.deepEqual(json(planner.advise({...s,limits:{...s.limits,...limits}})),json(result));
  }
  const shallow=planner.advise({...s,limits:{...s.limits,depth:1}});
  assert.equal(shallow.kind,'target');assert.equal(shallow.continuationVerified,false);
}));
