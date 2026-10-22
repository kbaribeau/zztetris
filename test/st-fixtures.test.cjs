'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const R=require('../st-rules.js');
const B=require('../st-bag.js');
const F=require('../st-fixtures.js');
const root=path.resolve(__dirname,'..');
// Independent Fumen decoder supplies boards and clear counts, not the new kernel.
const codec=vm.runInNewContext(fs.readFileSync(path.join(root,'tetris-fumen.js'),'utf8'),{window:{}})(2);
const swap={I:'I',O:'O',T:'T',S:'Z',Z:'S',J:'L',L:'J','.':'.'};
const sources=new Map();
function source(file){if(!sources.has(file))sources.set(file,codec.decoder.decode(fs.readFileSync(path.join(root,file),'utf8').trim()));return sources.get(file);}
function boardAt(page,mirror){let board=Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>y<17?'.':page.field.at(x,39-y)).join('').replace(/_/g,'.'));return mirror?board.map(r=>[...r].reverse().map(c=>swap[c]).join('')):board;}
function replayPrefix(c,locks){let s=R.createState({active:c.stream[0],queue:c.stream.slice(1),streamCursor:1});for(let i=0;i<locks;i++){const replay=R.replay(s,c.steps[i].actions);assert.equal(replay.valid,true,`${c.id} lock ${i+1}`);s=replay.state;}return s;}
for(const c of F.constructions)test(`st-fixtures/provenance/${c.id}: empty-board input replay matches independent Fumen boards`,()=>{
 const pages=source(c.source),meta=JSON.parse(fs.readFileSync(path.join(root,c.source.replace('.fumen','.json'))));
 for(let i=0;i+7<=c.stream.length;i+=7)assert.equal([...c.stream.slice(i,i+7)].sort().join(''),'IJLOSTZ',`bag ${i/7}`);
 let s=R.createState({active:c.stream[0],queue:c.stream.slice(1),streamCursor:1});
 assert.deepEqual(s.board,boardAt(pages[0],c.mirrored));
 for(const [i,step] of c.steps.entries()){
  const replay=R.replay(s,step.actions);assert.equal(replay.valid,true,`witness ${i+1}`);assert.equal(replay.events.length,1);s=replay.state;
  assert.deepEqual(s.board,step.expectedBoard,`stored expected board ${i+1}`);
  assert.deepEqual(s.board,boardAt(pages[i+1],c.mirrored),`independent source board ${i+1}`);
  assert.equal(s.lastEvent.lines,meta.pages[i].clearedRows.length,`source line count ${i+1}`);
  assert.equal(s.lastEvent.spin,step.expectedEvent.spin);
 }
});

test('st-fixtures/all cases: supplied snapshots derive from replay and current witnesses are executable',()=>{
 assert.equal(new Set(F.list.map(f=>f.id)).size,F.list.length);
 for(const fixture of F.list){
  const c=F.constructions.find(c=>c.id===fixture.provenance.constructionId);let expected=replayPrefix(c,fixture.provenance.locks);
  expected=R.replay(expected,[...fixture.provenance.extraInputs,...(fixture.provenance.extraActions??[])]).state;
  const s=fixture.observation;
  assert.deepEqual(R.validate(s),[],fixture.id);assert.deepEqual(s.board,expected.board,fixture.id);
  assert.deepEqual(s.active,expected.active,fixture.id);assert.equal(s.hold,expected.hold,fixture.id);assert.equal(s.canHold,expected.canHold,fixture.id);
  assert.equal(s.streamCursor,expected.streamCursor,fixture.id);assert.deepEqual(s.queue,expected.queue.slice(0,6),fixture.id);
  assert.deepEqual(fixture.future,expected.queue.slice(6),fixture.id);
  const r=R.replay(s,fixture.expectations.referenceWitness);assert.equal(r.valid,true,fixture.id);
  assert.deepEqual(r.state.board,fixture.expectations.referenceAfter,fixture.id);
  assert.equal(r.events[0].lines,fixture.expectations.referenceEvent.lines,fixture.id);
  assert.equal(r.events[0].spin,fixture.expectations.referenceEvent.spin,fixture.id);
 }
});

test('st-fixtures/bag evidence: known history stops at preview and unknown history does not invent phase',()=>{
 for(const f of F.list){const c=F.constructions.find(c=>c.id===f.provenance.constructionId),s=f.observation;
  const expected=f.categories.includes('unknown-bag')?B.fromObserved({observed:s.queue}):B.fromObserved({observed:c.stream.slice(0,s.streamCursor+s.queue.length),startPhase:0});
  assert.deepEqual(s.bag,expected,f.id);assert.deepEqual(B.validate(s.bag),[],f.id);
 }
 assert.equal(F.get('unknown-bag-double').observation.bag.provenance,'unknown-phase');
});

test('st-fixtures/reference cycle: filler, full double, and rebuild run closed-loop with six visible previews',()=>{
 const fixture=F.get('empty-hold'),c=F.construction;let state=fixture.observation;const future=[...fixture.future],events=[];
 for(let i=20;i<=23;i++){
  assert.equal(state.queue.length,6);const result=R.replay(state,c.steps[i].actions);assert.equal(result.valid,true);state=result.state;events.push(...result.events);
  while(state.queue.length<6&&future.length)state={...state,queue:[...state.queue,future.shift()]};
 }
 assert.deepEqual(events.map(e=>e.lines),[0,0,2,0]);assert.equal(events[2].spin,'full');
 assert.deepEqual(state.board,c.steps[23].expectedBoard);
});

test('st-fixtures/corpus coverage and isolation: both sources, hold modes, held-out geometry, actual pose, clone safety',()=>{
 const categories=new Set(F.list.flatMap(f=>f.categories));
 for(const c of ['empty-hold','occupied-hold','nonclear','tsd','postclear','actual-pose','unknown-bag','independent-source'])assert.ok(categories.has(c),c);
 assert.ok(F.list.some(f=>f.split==='held-out'&&f.provenance.source.includes('sm22939781')));
 const a=F.get('o-filler');a.observation.board[39]='..........';a.future.length=0;
 assert.notDeepEqual(a.observation.board,F.get('o-filler').observation.board);assert.ok(F.get('o-filler').future.length>0);
 assert.throws(()=>F.get('missing'),/Unknown ST fixture/);
});

 test('st-fixtures/recovery: legal O deviation worsens left balance, with a non-canned repair criterion',()=>{
 const P=require('../st-planner.js'),f=F.get('deviated-o-recovery'),a=P.assess(f.observation.board);
 const c=F.constructions.find(c=>c.id===f.provenance.constructionId),sourceAfter=P.assess(c.steps[12].expectedBoard);
 assert.equal(a.left.roughness,3);assert.equal(sourceAfter.left.roughness,1);assert.notDeepEqual(f.observation.board,c.steps[12].expectedBoard);
 const r=R.replay(f.observation,f.expectations.referenceWitness),b=P.assess(r.state.board);
 assert.equal(r.valid,true);assert.equal(b.left.roughness,1);assert.equal(b.leftSealed,0);assert.equal(b.regionalSupport,true);assert.equal(b.channel.openBelowStack,true);assert.ok(b.maxHeight<20);
 });
