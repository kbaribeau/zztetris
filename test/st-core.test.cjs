const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixtures}=require('./support/st-fixtures.cjs');
const {json,heap,core,input,start,editPieces,replay}=require('./support/st-driver.cjs');
const freeze=value=>{if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

for(const id of ['cap','cap-high','pocket','well','spin']) {
  test(`st-core/source replay/${id}: real SRS+ paths, exact cells, clears and finite completion`,()=>withPage('st-lab.html',{},g=>{
    const planner=core(g),fixture=fixtures[id] || fixtures.cap;
    assert.equal(g.window.document.querySelectorAll('.lab-setup select').length,1);
    for(const availability of ['held','active','empty']) {
      start(g,id);
      const authored=g.snapshot();
      assert.equal(authored.piece,{cap:'T','cap-high':'T',pocket:'I',well:'O',spin:'O'}[id]);
      assert.equal(authored.hold,{cap:'Z','cap-high':'Z',pocket:'I',well:'I',spin:'T'}[id]);
      assert.deepEqual(authored.queue.slice(0,6),['O','I','J','L','S','T']);
      if(availability==='active')g.tap('ShiftLeft');
      if(availability==='empty')editPieces(g,{active:authored.piece,hold:'',next:[authored.hold,'O','I','J','L','S']});
      assert.deepEqual(heap(g),id==='spin'?fixtures.cap.afterCap:fixture.before);
      let a=planner.advise(input(g));
      const firstCells=id==='pocket'?fixture.pocketCells:id==='well'?fixture.wellCells:id==='spin'?fixture.spinCells:fixture.capCells;
      assert.deepEqual(json(a.cells),firstCells);
      if(availability==='empty' && id!=='pocket') {assert.equal(a.from,'next-0');assert.deepEqual(json(a.prelude),['hold']);}
      if(availability==='empty' && id==='pocket') {assert.equal(a.from,'active');assert.deepEqual(json(a.prelude),[]);}
      replay(g,a);
      if(id==='cap')assert.deepEqual(heap(g),fixture.afterCap);
      if(id==='pocket')assert.deepEqual(heap(g),fixture.afterPocket);
      if(['cap','cap-high','pocket'].includes(id)) {
        assert.equal(g.window.cleared,0);
        a=planner.advise(input(g));
        assert.deepEqual(json(a.cells),id==='pocket'?fixture.wellCells:fixture.spinCells);
        replay(g,a);
      }
      assert.equal(g.window.cleared,['pocket','well'].includes(id)?4:2);
      assert.equal(g.window.tspin,!['pocket','well'].includes(id));
      assert.equal(g.window.mini,false);
      assert.deepEqual(heap(g),fixture.after);
      assert.equal(planner.advise(input(g)).kind,'exercise-complete');
      assert.equal(g.element('#st-target').children.length,0);
    }
  }));
}

test('st-core/real scoring: two cleared rows without a final rotation do not complete the TSD exercise',()=>withPage('st-lab.html',{},g=>{
  start(g,'spin');g.tap('ShiftLeft');const w=g.window;
  // Arrange the target shape but deliberately omit its required last rotation.
  w.clearActive();w.xPOS=6;w.yPOS=35;w.rot=2;w.lastAction='SD';w.updateGhost();w.setShape();
  w.zzBot.hardDrop();g.advance(16);
  assert.equal(w.cleared,2);assert.equal(w.tspin,false);
  assert.deepEqual(heap(g),fixtures.cap.after);
  assert.equal(input(g).strategy,null);
  assert.equal(core(g).advise(input(g)).reason,'unsupported');
}));

test('st-core/determinism: immutable input, fresh advisors, stable duplicate-piece tie break',()=>withPage('st-lab.html',{},g=>{
  start(g,'pocket'); // active and held I have distinct identities
  const snapshot=freeze(input(g)),before=JSON.stringify(snapshot),planner=core(g);
  const first=json(planner.advise(snapshot));
  assert.equal(first.piece.id,'active');assert.deepEqual(first.prelude,[]);
  for(let i=0;i<4;i++)assert.deepEqual(json(core(g).advise(snapshot)),first);
  assert.equal(JSON.stringify(snapshot),before);
  first.cells[0][0]=0;first.afterMatchingLock.stage=99;
  assert.equal(planner.advise(snapshot).cells[0][0],9);
  assert.equal(input(g).strategy.stage,0,'displaying never advances phase');
}));

test('st-core/hold: only active/held/next-0; empty hold and repeated swaps preserve order',()=>withPage('st-lab.html',{},g=>{
  const planner=core(g);
  start(g,'cap');const before=g.snapshot();const initial=input(g);
  assert.equal(planner.advise(initial).piece.id,'hold');
  g.tap('ShiftLeft');g.advance(16);
  assert.equal(g.window.piece,'Z');assert.equal(g.window.holdP,'T');
  assert.deepEqual(g.snapshot().queue,before.queue);assert.equal(input(g).strategy.stage,0);
  assert.deepEqual(json(planner.advise(input(g)).prelude),[]);
  g.tap('ShiftLeft');g.advance(16);
  assert.equal(g.window.piece,'T');assert.deepEqual(g.snapshot().queue,before.queue);
  start(g,'cap');editPieces(g,{active:'T',hold:'',next:['Z','O','I','J','L','S']});const queue=g.snapshot().queue;
  assert.equal(planner.advise(input(g)).from,'next-0');
  g.tap('ShiftLeft');assert.deepEqual(g.snapshot().queue,queue.slice(1));
  g.tap('ShiftLeft');assert.deepEqual(g.snapshot().queue,queue.slice(1));
  assert.equal(g.window.piece,'T');assert.equal(g.window.holdP,'Z');
  start(g,'cap');editPieces(g,{active:'O',hold:'J',next:['Z','T','I','S','L','O']});
  assert.equal(planner.advise(input(g)).reason,'no-core-fit-found');
  const bottom=heap(g);g.tap('Space');assert.notDeepEqual(heap(g),bottom,'ordinary O placement remains legal');
}));

test('st-core/respawn: two holds recover an I trapped in the well without skipping preview',()=>withPage('st-lab.html',{},g=>{
  start(g,'pocket');const w=g.window;
  w.clearActive();w.holdP='O';w.xPOS=5;w.yPOS=36;w.rot=1;w.lastAction='SD';w.updateGhost();w.setShape();
  const before=g.snapshot().queue,answer=core(g).advise(input(g));
  assert.equal(answer.kind,'target');assert.equal(answer.piece.id,'active');
  assert.deepEqual(json(answer.prelude),['hold','hold']);
  replay(g,answer);
  assert.deepEqual(g.snapshot().queue.slice(0,5),before.slice(1,6));
  assert.deepEqual(heap(g),fixtures.pocket.afterPocket);
}));

test('st-core/visible horizon: hidden suffix cannot affect advice; actual clipping and markers',()=>withPage('st-lab.html',{},g=>{
  start(g);const w=g.window,planner=core(g),api=w.eval('STCore');
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
  assert.equal(planner.advise(limited).reason,'no-core-fit-found','active T cannot jump to unseen Z');
}));

test('st-core/ordered lookahead: verifies a legal held continuation, never invents a future draw',()=>withPage('st-lab.html',{},g=>{
  start(g,'cap');g.tap('ShiftLeft');const planner=core(g),s=input(g);
  assert.equal(planner.advise(s).continuationVerified,true);
  s.hold={id:'hold',kind:'J'};s.visibleNext=[{id:'next-0',kind:'O'},{id:'next-1',kind:'T'}];
  assert.equal(planner.advise(s).continuationVerified,false,'T is visible but O/J must play first');
  s.visibleNext=[{id:'next-0',kind:'T'}];
  assert.equal(planner.advise(s).continuationVerified,true);
  s.visibleNext=[];
  assert.equal(planner.advise(s).continuationVerified,false);
}));

test('st-core/abstentions: malformed profiles, exact whole heap, missing metadata and finite budgets',()=>withPage('st-lab.html',{},g=>{
  start(g);const s=input(g),planner=core(g);
  for(const mutate of [
    x=>{x.heap[0]='#.........';},x=>{x.heap[39]='#######.##';},x=>{x.strategy=null;},
    x=>{x.strategy.stage=1;},x=>{x.rules.mode='pc';},x=>{x.rules.gravity=true;},
    x=>{x.rules.kickset='SRS';},x=>{x.rules.version='old';},x=>{x.holdRule='once-per-lock';},
    x=>{x.active.kind='M';},x=>{x.active.id=x.hold.id;},x=>{x.active.rotation=4;},
    x=>{x.visibleNext.push({id:'q7',kind:'I'});},x=>{x.limits.maxPoseStates=Infinity;},
  ]) {const invalid=json(s);mutate(invalid);assert.equal(planner.advise(invalid).reason,'unsupported');}
  for(const limits of [{maxPoseStates:0},{maxPoseStates:1},{maxLockStates:0}]) {
    const result=planner.advise({...s,limits:{...s.limits,...limits}});
    assert.equal(result.reason,'budget-exhausted');assert.equal(result.cells,undefined);
    assert.deepEqual(json(planner.advise({...s,limits:{...s.limits,...limits}})),json(result));
  }
  const completeCandidate=planner.advise(s);
  assert.equal(planner.advance(s,{kind:'Z',...completeCandidate.pose,cleared:0,tspin:false,heap:fixtures.cap.before}),null,'matching cells but wrong resulting heap cannot advance');
}));
