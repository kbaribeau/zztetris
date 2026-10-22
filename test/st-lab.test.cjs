const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {settings,DEFAULT_CONFIG}=require('./support/pages.cjs');
const {fixture,editPieces,input,core,replay,heap,settle}=require('./support/st-driver.cjs');
const {fixtures}=require('./support/st-fixtures.cjs');
const target=g=>g.element('#st-target');
const reason=g=>g.element('#st-status').dataset.result;
const refresh=settle;
const fresh=g=>{
  refresh(g);const shown=g.window.stLab.diagnostics().result;
  if(shown.kind==='target') {
    const a=core(g).advise({...input(g),preferredTarget:{kind:shown.piece.kind,cells:shown.cells}});
    assert.equal(a.kind,'target');assert.equal(JSON.stringify(a.cells),JSON.stringify(shown.cells));
  } else {
    // Revalidating a previous target can spend the shared budget differently
    // from a fresh no-preference search. Either abstention must remove its SVG.
    assert.equal(shown.kind,'abstain');assert.equal(target(g).children.length,0);
  }
};

for(const gravity of [undefined,'true','false']) {
  test(`st-lab/entry/${gravity ?? 'absent'}: empty normal play, temporary rules, default-on`,()=>withPage('st-lab.html',{storage:settings(gravity===undefined?{}:{gravity})},g=>{
    refresh(g);const beforeStorage=g.storage(),initial=g.snapshot();
    assert.equal(g.element('#grav').checked,false);
    assert.ok(heap(g).every(row=>row==='..........'));
    assert.equal(initial.hold,'');assert.equal(new Set([initial.piece,...initial.queue.slice(0,6)]).size,7,'normal first bag');
    assert.equal(g.window.document.querySelector('#st-exercise'),null);
    assert.equal(g.window.document.querySelector('#st-start'),null);
    assert.equal(target(g).children.length,0);assert.equal(reason(g),'no-core-fit-found');
    g.advance(700);assert.equal(g.window.yPOS,17);
    fixture(g);
    assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'),'true');
    assert.equal(target(g).children.length,8);
    assert.match(g.element('#st-status').textContent,/HOLD FIRST.*T → Z/);
    assert.deepEqual(g.storage(),beforeStorage);
    g.click('#grav');refresh(g);
    assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
    assert.deepEqual(g.storage(),beforeStorage);
    g.tap('KeyR');refresh(g);assert.equal(g.element('#grav').checked,true,'restart does not silently rewrite current rules');
    g.click('#grav');fixture(g);
    g.window.eval("document.getElementById('kickset').value='SRS'; updateKickTable();");refresh(g);
    assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
    g.window.eval("document.getElementById('kickset').value='SRS+'; updateKickTable();");refresh(g);
    assert.equal(reason(g),'target');assert.deepEqual(g.storage(),beforeStorage);
    g.tap('KeyR');refresh(g);
    assert.ok(heap(g).every(row=>row==='..........'));assert.equal(reason(g),'no-core-fit-found');
    assert.equal(g.window.holdP,'');assert.equal(g.window.hist.length,1);
  }));
}

test('st-lab/toggle: display only, no repeat, persisted off; normal practice unaffected',async()=>{
  let storage;
  await withPage('st-lab.html',{storage:settings({gravity:'true'})},g=>{
    fixture(g);const before=g.snapshot(),saved=g.storage();
    g.tap('KeyA');assert.equal(target(g).children.length,0);assert.equal(reason(g),'off');
    assert.deepEqual(g.snapshot(),before);assert.deepEqual(g.storage(),{...saved,stGuideVisible:'false'});
    g.key('keydown','KeyA',true);g.key('keyup','KeyA');
    assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'),'false');
    g.click('#st-toggle');refresh(g);assert.equal(target(g).children.length,8);assert.deepEqual(g.snapshot(),before);
    g.tap('KeyA');g.tap('KeyR');fixture(g);assert.equal(target(g).children.length,0);
    storage=g.storage();
  });
  await withPage('st-lab.html',{storage},g=>{fixture(g);assert.equal(target(g).children.length,0);});
  await withPage('index.html',{storage},g=>{
    assert.equal(g.element('#grav').checked,true);const before=g.snapshot();
    g.tap('KeyA');assert.deepEqual(g.snapshot(),before);assert.equal(g.window.stLab,undefined);
    assert.equal(g.window.document.querySelector('#st-target'),null);
  });
});

test('st-lab/input guards: typing/selecting, modifiers and button activation never drop/toggle accidentally',()=>withPage('st-lab.html',{},g=>{
  fixture(g);const w=g.window,before=g.snapshot();
  const textarea=w.document.createElement('textarea');w.document.body.append(textarea);
  for(const element of [textarea,g.element('#kickset')]) {
    element.focus();
    for(const code of ['KeyA','Space','KeyR','KeyX','ArrowRight'])element.dispatchEvent(new w.KeyboardEvent('keydown',{code,bubbles:true}));
  }
  assert.deepEqual(g.snapshot(),before);assert.equal(target(g).children.length,8);
  g.element('#st-toggle').focus();g.element('#st-toggle').dispatchEvent(new w.KeyboardEvent('keydown',{code:'Space',bubbles:true}));
  assert.deepEqual(g.snapshot(),before);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyA',ctrlKey:true,bubbles:true}));
  assert.equal(target(g).children.length,8);
  g.click('#st-toggle');assert.deepEqual(g.snapshot(),before);assert.equal(target(g).children.length,0);
  const right=new w.KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true,cancelable:true});
  w.document.dispatchEvent(right);assert.equal(right.defaultPrevented,true);
  g.advance(16);assert.equal(w.xPOS,before.x+1);g.key('keyup','ArrowRight');
}));

test('st-lab/binding: separate preference, conflict refusal, real controls edit/reset',async()=>{
  let saved;
  const config=[...DEFAULT_CONFIG];config[1]='KeyA';
  await withPage('controls.html',{storage:settings({config:JSON.stringify(config),gravity:'true'})},g=>{
    const before=g.storage().config;
    assert.match(g.element('#st-key-status').textContent,/conflicts/);
    g.click('#st-advice-key');g.tap('KeyX');
    assert.equal(g.storage().stAdviceKey,undefined);assert.match(g.element('#st-key-status').textContent,/unused/);
    g.tap('KeyB');assert.equal(g.storage().stAdviceKey,'KeyB');assert.equal(g.storage().config,before);saved=g.storage();
  });
  await withPage('st-lab.html',{storage:saved},g=>{
    fixture(g);const x=g.window.xPOS;
    g.key('keydown','KeyA');g.advance(16);g.key('keyup','KeyA');g.advance(16);
    assert.equal(g.window.xPOS,x+1);assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'),'true');
    const before=g.snapshot();g.tap('KeyB');assert.deepEqual(g.snapshot(),before);assert.equal(target(g).children.length,0);
  });
  await withPage('st-lab.html',{storage:settings({config:JSON.stringify(config)})},g=>{
    fixture(g);assert.match(g.element('#st-toggle').textContent,/conflicts/);
    g.click('#st-toggle');assert.equal(target(g).children.length,0);
    assert.equal(g.storage().stAdviceKey,undefined);
  });
  await withPage('controls.html',{storage:saved},g=>{g.resetControls();assert.equal(g.storage().stAdviceKey,undefined);assert.equal(g.storage().gravity,'true');});
});

test('st-lab/pending target: movement/hold recompute; scales without touching collision board',()=>{
  const config=[...DEFAULT_CONFIG];config[14]='24';
  return withPage('st-lab.html',{storage:settings({config:JSON.stringify(config)})},g=>{
    fixture(g);const original=heap(g),before=g.snapshot(),w=g.window;
    assert.equal(target(g).getAttribute('viewBox'),'0 0 240 528');
    const rect=target(g).querySelector('rect');
    assert.equal(Number(rect.getAttribute('x')),9*24+24*.22);
    assert.equal(Number(rect.getAttribute('y')),(37-18)*24+24*.22);
    assert.deepEqual(g.snapshot(),before);
    g.tap('ShiftLeft');refresh(g);assert.match(g.element('#st-status').textContent,/ACTIVE Z/);
    assert.deepEqual(heap(g),original);assert.equal(target(g).children.length,8);
    w.zzBot.move('L');w.zzBot.rotate('CW');refresh(g);
    const current=input(g),answer=core(g).advise(current);
    assert.equal(current.active.x,w.xPOS);assert.equal(current.active.rotation,w.rot);
    replay(g,answer);assert.deepEqual(heap(g),fixtures.cap.afterCap);
  });
});

test('st-lab/history: hidden locks, undo/redo, filler and branches re-recognize current geometry',()=>withPage('st-lab.html',{},g=>{
  fixture(g);const planner=core(g);
  replay(g,planner.advise(input(g)));assert.deepEqual(heap(g),fixtures.cap.afterCap);
  const second=planner.advise(input(g));g.tap('KeyA');replay(g,second);
  assert.equal(target(g).children.length,0);
  const afterScore=heap(g);g.tap('KeyA');fresh(g);assert.deepEqual(heap(g),afterScore);
  g.tap('KeyT');fresh(g);assert.equal(reason(g),'target');
  g.tap('KeyY');fresh(g);assert.deepEqual(heap(g),afterScore);
  g.tap('KeyT');refresh(g);g.tap('Space');refresh(g); // harmless O filler, no assumed phase
  fresh(g); // Filler may now have a longer verified route, or honestly abstain.
  assert.notDeepEqual(heap(g),fixtures.cap.afterCap);
  g.tap('KeyT');refresh(g);assert.deepEqual(heap(g),fixtures.cap.afterCap);
  replay(g,planner.advise(input(g)));fresh(g);
  assert.equal(g.window.hist.length,3);
}));

test('st-lab/history truncation and imports: geometry needs no metadata or phase',async()=>withPage('st-lab.html',{},async g=>{
  fixture(g);const w=g.window;
  for(let i=0;i<505;i++)w.updateHistory();
  assert.ok(w.hist.length<=501);g.tap('KeyT');refresh(g);assert.equal(reason(g),'target');
  const imported=w.fullEncode(w.hist.slice(0,1));
  w.navigator.clipboard.readText=async()=>imported;
  await w.importFullFumen();refresh(g);assert.equal(reason(g),'target');
  // In-place history mutation must also be reflected, not inherit cached advice.
  w.hist[w.histPos].board=JSON.stringify(w.board.map(row=>row.map(()=>({t:0,c:''}))));
  w.board=JSON.parse(w.hist[w.histPos].board);w.updateGhost();w.setShape();refresh(g);
  assert.equal(reason(g),'no-core-fit-found');
}));

test('st-lab/edits: drawing, garbage, mirror, shuffle, editors, imports and reset refresh advice',async()=>withPage('st-lab.html',{},async g=>{
  const w=g.window;
  fixture(g);
  g.element('#b').dispatchEvent(new w.MouseEvent('mousedown',{button:0,clientX:18+9*20+1,clientY:18+21*20+1,bubbles:true}));
  fresh(g); // Drawing can invalidate the old cap yet leave another finite route.
  w.document.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  for(const action of ['garbage','mirror','fullMirror','shuffleQueue']) {
    fixture(g);w[action](0);refresh(g);
    const a=core(g).advise(input(g));assert.equal(reason(g),a.kind==='abstain'?a.reason:a.kind);
    if(action==='mirror'||action==='fullMirror')assert.equal(target(g).children.length,0);
    if(action==='garbage')assert.notDeepEqual(heap(g),fixtures.cap.before);
  }
  fixture(g);w.prompt=()=> 'J';g.click('#h');fresh(g);
  w.prompt=()=> 'OZTISLJ';g.click('#n');fresh(g);assert.equal(w.piece,'O');
  fixture(g);w.navigator.clipboard.readText=async()=> '_'.repeat(400);await w.importTetrio();refresh(g);
  assert.equal(reason(g),'no-core-fit-found');assert.equal(target(g).children.length,0);
  fixture(g);const empty=w.board.map(row=>row.map(()=>({t:0,c:''})));const fumen=w.encode(empty);
  w.navigator.clipboard.readText=async()=>fumen;await w.importFumen();refresh(g);assert.equal(reason(g),'no-core-fit-found');
  fixture(g);g.tap('KeyR');refresh(g);assert.equal(reason(g),'no-core-fit-found');
  assert.ok(heap(g).every(row=>row==='..........'));
}));

test('st-lab/advice order: live advice follows the playing field across display states',()=>withPage('st-lab.html',{},g=>{
  const w=g.window,field=g.element('.lab-field-scroll'),status=g.element('#st-status');
  const messages=new Set();
  const check=expected=>{
    refresh(g);assert.equal(reason(g),expected);messages.add(status.textContent);
    assert.equal(field.contains(status),false,'advice must not enter the gameplay row');
    for(const canvas of ['#b','#h','#n']) {
      assert.ok(g.element(canvas).compareDocumentPosition(status)&w.Node.DOCUMENT_POSITION_FOLLOWING,
        'live advice must follow the board, HOLD and NEXT in document/reading order');
    }
  };
  check('no-core-fit-found');
  fixture(g);check('target');
  fixture(g,'well');check('target');
  g.click('#grav');check('unsupported');
  g.click('#st-toggle');check('off');
  g.click('#st-toggle');g.click('#grav');g.tap('KeyR');check('no-core-fit-found');
  assert.equal(messages.size,5,'exercise distinct real renderer messages, not replacement text');
  // jsdom proves reading order only; real-browser geometry covers CSS flow/wrapping.
}));

test('st-lab/unchanged frame: no DOM churn or repeated live-region announcements',()=>withPage('st-lab.html',{},g=>{
  fixture(g);
  const observer=new g.window.MutationObserver(()=>{});
  observer.observe(g.window.document.querySelector('main'),{subtree:true,attributes:true,childList:true,characterData:true});
  g.advance(100);assert.equal(observer.takeRecords().length,0);observer.disconnect();
}));

test('st-lab/abstention: no reset, fabricated target or queue/settings mutation',()=>withPage('st-lab.html',{storage:settings({gravity:'false'})},g=>{
  g.tap('KeyR');editPieces(g,{active:'O',hold:'J',next:['Z','T','I','S','L','O']});const before=g.snapshot(),saved=g.storage();refresh(g);
  assert.equal(reason(g),'no-core-fit-found');assert.equal(target(g).children.length,0);
  assert.deepEqual(g.snapshot(),before);assert.deepEqual(g.storage(),saved);
  g.click('#grav');const edited=g.snapshot();refresh(g);
  assert.equal(reason(g),'unsupported');assert.deepEqual(g.snapshot(),edited);
}));
