const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {settings,DEFAULT_CONFIG}=require('./support/pages.cjs');
const {start,input,core,replay,json,heap}=require('./support/st-driver.cjs');
const {fixtures}=require('./support/st-fixtures.cjs');
const target=g=>g.element('#st-target');
const reason=g=>g.element('#st-status').dataset.result;
const refresh=g=>g.advance(16);

for(const gravity of [undefined,'true','false']) {
  test(`st-lab/entry/${gravity ?? 'absent'}: explicit authored start, temporary rules, default-on`,()=>withPage('st-lab.html',{storage:settings(gravity===undefined?{}:{gravity})},g=>{
    const beforeStorage=g.storage();
    assert.equal(g.element('#grav').checked,false);assert.equal(input(g).strategy,null);
    assert.ok(heap(g).every(row=>row==='..........'));
    assert.equal(target(g).children.length,0);
    g.advance(700);assert.equal(g.window.yPOS,17,'lab does not restore normal gravity');
    start(g);
    assert.deepEqual(heap(g),fixtures.cap.before);
    assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'),'true');
    assert.equal(g.window.piece,'T');assert.equal(g.window.holdP,'Z');
    assert.equal(target(g).children.length,8);
    assert.match(g.element('#st-status').textContent,/HOLD FIRST.*T → Z/);
    assert.deepEqual(g.storage(),beforeStorage);
    g.click('#grav');refresh(g);
    assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
    assert.deepEqual(g.storage(),beforeStorage,'temporary gravity toggle never writes normal preference');
    start(g);assert.equal(g.element('#grav').checked,false);
    assert.deepEqual(g.storage(),beforeStorage);
    g.window.eval("document.getElementById('kickset').value='SRS'; updateKickTable();");refresh(g);
    assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
    start(g);assert.equal(g.element('#kickset').value,'SRS+');
    assert.deepEqual(g.storage(),beforeStorage);
  }));
}

test('st-lab/toggle: display only, no repeat, no persisted off state; normal practice unaffected',async()=>{
  let storage;
  await withPage('st-lab.html',{storage:settings({gravity:'true'})},g=>{
    start(g);const before=g.snapshot(),saved=g.storage();
    g.tap('KeyA');assert.equal(target(g).children.length,0);assert.equal(reason(g),'off');
    assert.deepEqual(g.snapshot(),before);assert.deepEqual(g.storage(),saved);
    g.key('keydown','KeyA',true);g.key('keyup','KeyA');
    assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'),'false');
    g.click('#st-toggle');assert.equal(target(g).children.length,8);assert.deepEqual(g.snapshot(),before);
    g.tap('KeyA');start(g);assert.equal(target(g).children.length,8,'each explicit entry is on');
    g.tap('KeyA');storage=g.storage();
  });
  await withPage('st-lab.html',{storage},g=>{start(g);assert.equal(target(g).children.length,8);});
  await withPage('index.html',{storage},g=>{
    assert.equal(g.element('#grav').checked,true);const before=g.snapshot();
    g.tap('KeyA');assert.deepEqual(g.snapshot(),before);assert.equal(g.window.stLab,undefined);
    assert.equal(g.window.document.querySelector('#st-target'),null);
  });
});

test('st-lab/input guards: typing/selecting, modifiers and button keyboard activation never drop/toggle accidentally',()=>withPage('st-lab.html',{},g=>{
  start(g);const w=g.window,before=g.snapshot();
  const textarea=w.document.createElement('textarea');w.document.body.append(textarea);
  for(const element of [textarea,g.element('#st-exercise')]) {
    element.focus();
    for(const code of ['KeyA','Space','KeyR','KeyX','ArrowRight'])element.dispatchEvent(new w.KeyboardEvent('keydown',{code,bubbles:true}));
  }
  assert.deepEqual(g.snapshot(),before);assert.equal(target(g).children.length,8);
  g.element('#st-toggle').focus();g.element('#st-toggle').dispatchEvent(new w.KeyboardEvent('keydown',{code:'Space',bubbles:true}));
  assert.deepEqual(g.snapshot(),before,'native button activation must not hard-drop first');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyA',ctrlKey:true,bubbles:true}));
  assert.equal(target(g).children.length,8);
  g.click('#st-toggle');assert.deepEqual(g.snapshot(),before);assert.equal(target(g).children.length,0);
  const right=new w.KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true,cancelable:true});
  w.document.dispatchEvent(right);assert.equal(right.defaultPrevented,true,'game keys must not scroll the lab page');
  g.advance(16);assert.equal(w.xPOS,before.x+1);g.key('keyup','ArrowRight');
}));

test('st-lab/binding: separate preference, conflict refusal, real controls edit/reset and custom gameplay preservation',async()=>{
  let saved;
  const config=[...DEFAULT_CONFIG];config[1]='KeyA';
  await withPage('controls.html',{storage:settings({config:JSON.stringify(config),gravity:'true'})},g=>{
    const before=g.storage().config;
    assert.match(g.element('#st-key-status').textContent,/conflicts/);
    g.click('#st-advice-key');g.tap('KeyX');
    assert.equal(g.storage().stAdviceKey,undefined);assert.match(g.element('#st-key-status').textContent,/unused/);
    g.tap('KeyB');assert.equal(g.storage().stAdviceKey,'KeyB');assert.equal(g.storage().config,before);
    saved=g.storage();
  });
  await withPage('st-lab.html',{storage:saved},g=>{
    start(g);const x=g.window.xPOS;
    g.key('keydown','KeyA');g.advance(16);g.key('keyup','KeyA');g.advance(16);
    assert.equal(g.window.xPOS,x+1);assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'),'true');
    const before=g.snapshot();g.tap('KeyB');assert.deepEqual(g.snapshot(),before);assert.equal(target(g).children.length,0);
  });
  await withPage('st-lab.html',{storage:settings({config:JSON.stringify(config)})},g=>{
    start(g);assert.match(g.element('#st-toggle').textContent,/conflicts/);
    g.click('#st-toggle');assert.equal(target(g).children.length,0,'button remains available with conflicted default');
    assert.equal(g.storage().stAdviceKey,undefined,'never choose or overwrite a custom binding silently');
  });
  await withPage('controls.html',{storage:saved},g=>{g.resetControls();assert.equal(g.storage().stAdviceKey,undefined);assert.equal(g.storage().gravity,'true');});
});

test('st-lab/pending target: current movement and hold recompute; scales with cell size without touching collision board',()=>{
  const config=[...DEFAULT_CONFIG];config[14]='24';
  return withPage('st-lab.html',{storage:settings({config:JSON.stringify(config)})},g=>{
    start(g);const original=heap(g),before=g.snapshot(),w=g.window;
    assert.equal(target(g).getAttribute('viewBox'),'0 0 240 528');
    const rect=target(g).querySelector('rect');
    assert.equal(Number(rect.getAttribute('x')),9*24+24*.22);
    assert.equal(Number(rect.getAttribute('y')),(37-18)*24+24*.22);
    assert.deepEqual(g.snapshot(),before,'display must not write active/ghost/heap');
    g.tap('ShiftLeft');refresh(g);assert.match(g.element('#st-status').textContent,/ACTIVE Z/);assert.equal(input(g).strategy.stage,0);
    assert.deepEqual(heap(g),original);assert.equal(target(g).children.length,8);
    w.zzBot.move('L');w.zzBot.rotate('CW');refresh(g);
    const current=input(g),answer=core(g).advise(current);
    assert.equal(current.active.x,w.xPOS);assert.equal(current.active.rotation,w.rot);
    replay(g,answer);assert.deepEqual(heap(g),fixtures.cap.afterCap);
  });
});

test('st-lab/history: actual lock advances even while hidden; undo/redo and divergent branches restore exact certificates',()=>withPage('st-lab.html',{},g=>{
  start(g);const planner=core(g);
  replay(g,planner.advise(input(g)));assert.equal(input(g).strategy.stage,1);
  const second=planner.advise(input(g));g.tap('KeyA');replay(g,second);
  assert.equal(input(g).strategy.stage,2);assert.equal(target(g).children.length,0);
  g.tap('KeyA');assert.equal(reason(g),'exercise-complete');
  g.tap('KeyT');refresh(g);assert.equal(input(g).strategy.stage,1);assert.equal(reason(g),'target');
  g.tap('KeyY');refresh(g);assert.equal(reason(g),'exercise-complete');
  g.tap('KeyT');refresh(g);g.tap('Space');refresh(g); // O in ordinary column, not the requested T
  assert.equal(reason(g),'unsupported');assert.equal(input(g).strategy,null);assert.equal(target(g).children.length,0);
  g.tap('KeyT');refresh(g);assert.equal(input(g).strategy.stage,1);
  replay(g,planner.advise(input(g)));assert.equal(reason(g),'exercise-complete');
  assert.equal(g.window.hist.length,3,'new branch removes the old continuation');
}));

test('st-lab/history cap and missing metadata: not indexed by cursor, imported history cannot inherit a stale phase',async()=>withPage('st-lab.html',{},async g=>{
  start(g);const w=g.window;
  for(let i=0;i<505;i++)w.updateHistory();
  assert.ok(w.hist.length<=501);g.tap('KeyT');refresh(g);assert.equal(reason(g),'target');
  const imported=w.fullEncode(w.hist.slice(0,1));
  w.navigator.clipboard.readText=async()=>imported;
  await w.importFullFumen();refresh(g);
  assert.equal(input(g).strategy,null);assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
}));

test('st-lab/edit/reset lifecycle: real drawing, garbage, mirror, shuffle, queue/hold edit and imports never retain stale targets',async()=>withPage('st-lab.html',{},async g=>{
  const w=g.window;
  start(g); // mousedown paints the obstructing bottom-right cell
  g.element('#b').dispatchEvent(new w.MouseEvent('mousedown',{button:0,clientX:18+9*20+1,clientY:18+21*20+1,bubbles:true}));
  refresh(g);assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
  w.document.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  start(g);w.garbage(0);refresh(g);assert.equal(reason(g),'unsupported');
  start(g);w.mirror();refresh(g);assert.equal(reason(g),'unsupported');
  start(g);w.fullMirror();refresh(g);assert.equal(reason(g),'unsupported');assert.equal(input(g).strategy,null);
  start(g);w.shuffleQueue();refresh(g);
  assert.deepEqual(input(g).heap,fixtures.cap.before);
  const afterShuffle=core(g).advise(input(g));assert.equal(reason(g),afterShuffle.kind==='abstain'?afterShuffle.reason:afterShuffle.kind);
  start(g);w.prompt=()=> 'J';g.click('#h');refresh(g);assert.equal(reason(g),'no-core-fit-found');
  w.prompt=()=> 'OZTISLJ';g.click('#n');refresh(g);assert.equal(w.piece,'O');assert.equal(reason(g),'no-core-fit-found');
  start(g);w.navigator.clipboard.readText=async()=> '_'.repeat(400);await w.importTetrio();refresh(g);
  assert.equal(reason(g),'unsupported');assert.equal(target(g).children.length,0);
  start(g);const empty=w.board.map(row=>row.map(()=>({t:0,c:''})));const fumen=w.encode(empty);
  w.navigator.clipboard.readText=async()=>fumen;await w.importFumen();refresh(g);assert.equal(reason(g),'unsupported');
  start(g);g.tap('KeyR');refresh(g);assert.equal(input(g).strategy,null);assert.equal(reason(g),'unsupported');
  assert.ok(heap(g).every(row=>row==='..........'));
}));

test('st-lab/unchanged frame: no DOM churn or repeated live-region announcements',()=>withPage('st-lab.html',{},g=>{
  start(g);
  const observer=new g.window.MutationObserver(()=>{});
  observer.observe(g.window.document.querySelector('main'),{subtree:true,attributes:true,childList:true,characterData:true});
  g.advance(100);
  assert.equal(observer.takeRecords().length,0);
  observer.disconnect();
}));

test('st-lab/abstention only: unsupported/no-fit do not reset or modify the queue, heap or settings',()=>withPage('st-lab.html',{storage:settings({gravity:'false'})},g=>{
  start(g,'cap','no-fit');const before=g.snapshot(),saved=g.storage();refresh(g);
  assert.equal(reason(g),'no-core-fit-found');assert.equal(target(g).children.length,0);
  assert.deepEqual(g.snapshot(),before);assert.deepEqual(g.storage(),saved);
  assert.ok(![...g.window.document.querySelectorAll('button')].some(b=>/retry|recover/i.test(b.textContent)));
  g.window.board[0][0]={t:1,c:'X'};const edited=g.snapshot();refresh(g);
  assert.equal(reason(g),'unsupported');assert.deepEqual(g.snapshot(),edited);
}));
