'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules.js'),F=require('../st-fixtures.js');
const {withPage}=require('./support/page.cjs');
const state=id=>R.migrateState(F.get(id).observation);
const semantic=s=>JSON.stringify([s.board,s.active,s.hold,s.queue,s.streamCursor,s.bag]);

test('st-hold/versioning: v1 witnesses keep legacy semantics, migration is explicit and immutable',()=>{
 const legacy=F.get('empty-hold').observation,original=JSON.stringify(legacy);
 const held=R.move(legacy,'HOLD');assert.equal(held.canHold,false);assert.equal(R.move(held,'HOLD'),held);
 assert.equal(R.createState(held).rules,'st-zero-v1');
 const current=R.migrateState(held);assert.equal(current.rules,'st-zero-v2');assert.equal(current.canHold,true);
 assert.equal(R.move(current,'HOLD').active.type,legacy.active.type);
 assert.equal(JSON.stringify(legacy),original);assert.deepEqual(current.board,held.board);assert.deepEqual(current.bag,held.bag);
 assert.throws(()=>R.migrateState({...legacy,rules:'unsupported'}),/unsupported-profile/);
});

test('st-hold/empty: swap-back stores next piece, consumes exactly one draw and never repeatedly scans queue',()=>{
 const s=state('empty-hold'),h=R.move(s,'HOLD'),back=R.move(h,'HOLD');
 assert.equal(h.active.type,s.queue[0]);assert.equal(h.hold,s.active.type);
 assert.equal(back.active.type,s.active.type);assert.equal(back.hold,s.queue[0]);
 assert.deepEqual(back.queue,s.queue.slice(1));assert.equal(back.streamCursor,s.streamCursor+1);
 assert.deepEqual(back.bag,s.bag);assert.equal(back.canHold,true);
 let n=back;for(let i=0;i<20;i++)n=R.move(n,'HOLD');
 assert.equal(semantic(n),semantic(back));assert.equal(n.revision,back.revision+20);
});

test('st-hold/occupied: repeated swaps reset moved pose and rotation, never advance cursor or bag',()=>{
 let s=state('actual-pose-double');s=R.move(s,'CW');s=R.move(s,'SD');
 assert.notDeepEqual(s.active,R.spawn(s.active.type));
 const back=R.replay(s,['HOLD','HOLD']);assert.equal(back.valid,true);
 assert.deepEqual(back.state.active,R.spawn(s.active.type));assert.equal(back.state.hold,s.hold);
 assert.deepEqual(back.state.queue,s.queue);assert.deepEqual(back.state.bag,s.bag);assert.equal(back.state.streamCursor,s.streamCursor);
 assert.equal(back.state.active.lastRotation,null);
});

test('st-hold/same-type: holding remains a legal spawn reset and bounded enumeration deduplicates it',()=>{
 const fixture=state('actual-pose-double'),s=R.createState({...fixture,active:R.spawn(fixture.active.type),hold:fixture.active.type});
 const h=R.move(s,'HOLD');assert.notEqual(h,s);assert.equal(h.active.lastRotation,null);
 const p=R.placements(s);assert.equal(p.complete,true);assert.ok(p.placements.length>0);
 assert.ok(p.placements.every(p=>p.holdCount===0),'identical spawn resets add no reachability');
});

test('st-hold/safety: cannot invent unknown queue or escape an intermediate blocked spawn',()=>{
 const empty=R.createState({...state('empty-hold'),hold:null,queue:[]});assert.equal(R.move(empty,'HOLD'),empty);
 // Same blocked-spawn geometry as the existing rules top-out regression.
 const board=R.emptyBoard();board[18]='....#.....';
 const s=R.createState({board,active:{type:'O',x:0,y:30,rotation:0,lastRotation:null},hold:'T',queue:['I']});
 const h=R.move(s,'HOLD');assert.equal(h.topOut,true);assert.equal(R.move(h,'HOLD'),h);
 assert.ok(R.placements(s).placements.every(p=>p.holdCount===0));
});

test('st-hold/enumeration: empty swap-back outcomes retained, every witness replayable and semantic duplicates removed',()=>{
 for(const id of ['empty-hold','actual-pose-double']){
  const s=state(id),p=R.placements(s),keys=new Set();assert.equal(p.complete,true,id);
  for(const item of p.placements){
   assert.equal(item.holdCount,item.witness.filter(a=>a==='HOLD').length);assert.ok(item.holdCount<=2);
   assert.equal(item.hold,item.holdCount>0);
   const replay=R.replay(s,item.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,item.state);
   const key=JSON.stringify([item.event,item.state.active,item.state.hold,item.state.queue,item.state.streamCursor]);
   assert.ok(!keys.has(key),id);keys.add(key);
  }
  if(id==='empty-hold'){
   const back=p.placements.find(p=>p.holdCount===2);assert.ok(back);assert.equal(back.event.type,s.active.type);
   assert.equal(back.state.hold,s.queue[0]);
   assert.ok(p.placements.some(p=>p.holdCount===0&&p.event.type===back.event.type));
  }
  assert.ok(R.placements(s,{allowHold:false}).placements.every(p=>p.holdCount===0));
  assert.equal(R.placements(s,{maxNodes:1}).complete,false);
 }
});

test('st-hold/ui: legacy imports visibly migrate; button and keyboard swaps preserve filled preview and bag',()=>withPage('st-lab.html',{},g=>{
 const old=F.get('empty-hold').observation;old.canHold=false;
 g.element('#st-snapshot').value=JSON.stringify(old);g.click('#st-import');
 assert.match(g.element('#st-import-status').textContent,/migrated.*v2/);assert.equal(g.snapshot().rules,'st-zero-v2');
 g.tap('ShiftLeft');const h=g.snapshot();assert.equal(h.canHold,true);
 assert.equal(h.streamCursor,old.streamCursor+1);assert.equal(h.queue.length,6);
 g.click('[data-action="HOLD"]');const back=g.snapshot();assert.equal(back.active.type,old.active.type);
 assert.deepEqual(back.queue,h.queue);assert.deepEqual(back.bag,h.bag);assert.equal(back.streamCursor,h.streamCursor);
 assert.equal(g.element('#st-hold-state').textContent,'Unlimited swaps');
 g.click('#st-export');assert.equal(JSON.parse(g.element('#st-snapshot').value).rules,'st-zero-v2');
 g.click('#st-reset');assert.equal(g.snapshot().rules,'st-zero-v2');assert.equal(g.snapshot().canHold,true);
}));

test('st-hold/corpus: all 27 existing reference witnesses retain their board and clear result under explicit v2 migration',()=>{
 assert.equal(F.list.length,27);
 for(const fixture of F.list){
  const before=fixture.observation,actions=fixture.expectations.referenceWitness;
  const legacy=R.replay(before,actions),current=R.replay(R.migrateState(before),actions);
  assert.equal(legacy.valid,true,fixture.id);assert.equal(current.valid,true,fixture.id);
  assert.deepEqual(current.events,legacy.events,fixture.id);assert.deepEqual(current.state.board,legacy.state.board,fixture.id);
  assert.equal(current.state.hold,legacy.state.hold,fixture.id);assert.deepEqual(current.state.queue,legacy.state.queue,fixture.id);
  assert.equal(current.state.streamCursor,legacy.state.streamCursor,fixture.id);
 }
});
