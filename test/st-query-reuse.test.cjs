'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),M=require('../st-midgame-resources');
const clone=x=>JSON.parse(JSON.stringify(x));
test('request queries: complete enumeration is reused with independent mutable results and honest work counts',()=>{
 const s=R.createState({active:'O',hold:'S',queue:['T','I','L']});let saved;
 R.withQueries(()=>{
  const a=R.placements(s,{maxNodes:10000});assert.equal(a.complete,true);assert.ok(a.visited>0);saved=clone(a.placements);
  a.placements[0].state.board[39]='XXXXXXXXXX';a.placements[0].witness.push('NO');
  const b=R.placements(s,{maxNodes:0});assert.equal(b.visited,0);assert.equal(b.queryCached,true);assert.deepEqual(b.placements,saved);
  b.placements[0].target.x=99;assert.deepEqual(R.placements(s).placements,saved);
  const m=R.queryMetrics();assert.equal(m.hits,2);assert.equal(m.avoidedNodes,2*a.visited);
 });
 assert.equal(R.queryMetrics(),null);R.withQueries(()=>assert.ok(R.placements(s).visited>0));
});
test('request queries: full pose, spin evidence, HOLD, draw, rules and bag context do not collide',()=>{
 const s=R.createState({active:'T',hold:'L',queue:['O','I','J'],bag:{remaining:[0],observedCount:7,provenance:'known-phase'}});
 R.withQueries(()=>{
  R.placements(s);const variants=[x=>x.active.x++,x=>x.active.lastRotation={from:3,to:0,kickIndex:4},x=>x.hold='S',x=>x.canHold=false,x=>x.queue.reverse(),x=>x.streamCursor++,x=>x.rules=R.LEGACY_PROFILE.id,x=>x.bag.observedCount++,x=>x.board[39]='X.........'];
  for(const f of variants){const x=clone(s);f(x);assert.notEqual(R.placements(x).queryCached,true);}
 });
});
test('request queries: unfinished work and arbitrary predicates never become completed negative facts',()=>{
 const s=R.createState({active:'O',queue:['I']});
 R.withQueries(()=>{
  for(let i=0;i<2;i++){const r=R.placements(s,{maxNodes:1});assert.equal(r.queryStatus,'unfinished');assert.notEqual(r.queryCached,true);assert.equal(r.visited,1);}
  const expired=R.placements(s,{deadline:0,now:()=>1});assert.equal(expired.queryStatus,'unfinished');
  for(const stopWhen of [()=>true,()=>false])assert.notEqual(R.placements(s,{stopWhen}).queryCached,true);
  const a=R.tDoubleAccess(R.emptyBoard());assert.equal(a.queryStatus,'failed-within-scope');assert.equal(a.reachable,false);
  const b=R.tDoubleAccess(R.emptyBoard());assert.equal(b.queryStatus,'failed-within-scope');assert.equal(b.visited,0);
 });
});
test('request queries: memory is bounded and exception/reentry boundaries cannot leak results',()=>{
 assert.throws(()=>R.withQueries(()=>{R.tDoubleAccess(R.emptyBoard());throw Error('interrupt');}),/interrupt/);assert.equal(R.queryMetrics(),null);
 R.withQueries(()=>{
  for(let i=0;i<80;i++){const board=R.emptyBoard();board[17]='XXXXXXXXXX';board[0]=i.toString(2).padStart(10,'0').replaceAll('0','.').replaceAll('1','X');R.tDoubleAccess(board);}
  const m=R.queryMetrics();assert.ok(m.evictions>0);assert.ok(m.peakBytes<=m.maxBytes);assert.ok(m.peakEntries<=m.maxEntries);
  R.withQueries(()=>assert.deepEqual(R.queryMetrics(),m));
 });
});
test('resource results distinguish unresolved history from a completed bounded failure',()=>{
 const s=R.createState({active:'I',queue:['O']}),r=M.start(s);r.unclassifiedS=[{sId:12,bag:1,invalidated:true}];
 const unknown=M.repair(s,r);assert.equal(unknown.valid,null);assert.equal(unknown.queryStatus,'unfinished');
 r.unclassifiedS=[];r.hangingS=[{id:99,bag:1,known:true}];const limited=M.repair(s,r,{maxNodes:0});assert.equal(limited.queryStatus,'unfinished');
 const exhausted=M.repair(s,r,{depth:0});assert.equal(exhausted.queryStatus,'failed-within-scope');assert.equal(exhausted.scope.depth,0);
});
