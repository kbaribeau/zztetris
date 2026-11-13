const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../st-rules');
const {fixtures}=require('./support/st-fixtures.cjs');
const signature=p=>JSON.stringify([p.event.target,p.event.spin,p.state.board,p.state.hold,p.state.queue,p.state.streamCursor]);
const target=p=>({...p.target,spin:p.event.spin});
function validateReplay(s,result){for(const p of result.placements){const replay=R.replay(s,p.witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);assert.deepEqual(replay.state,p.state);}}

test('st-targeted/known right Z uses a replayed direct witness without movement search',()=>{
 const s=R.createState({active:'Z',hold:'O',queue:['T','I']});const snapshot=JSON.stringify(s);
 const result=R.targetedPlacements(s,[{type:'Z',x:7,y:36,rotation:1,spin:'none'}],{allowHold:false});
 assert.equal(result.complete,true);assert.equal(result.placements.length,1);assert.equal(result.fallbackNodes,0);assert.equal(result.directCount,1);assert.equal(result.visited,6);assert.deepEqual(result.placements[0].witness,['CW','R','R','R','R','HD']);validateReplay(s,result);assert.equal(JSON.stringify(s),snapshot);
 assert.ok(result.visited<R.placements(s,{allowHold:false}).visited/10);
});
test('st-targeted/actual pose and empty HOLD preserve distinct public supply outcomes',()=>{
 const s=R.createState({active:{type:'Z',x:6,y:25,rotation:1,lastRotation:null},queue:['O','I','T']});
 const full=R.placements(s),targets=full.placements.filter(p=>p.target.type==='Z'&&p.target.x===7&&p.target.rotation===1).map(target);
 const actual=R.targetedPlacements(s,targets);assert.equal(actual.complete,true);validateReplay(s,actual);
 const expected=new Set(full.placements.filter(p=>targets.some(t=>JSON.stringify(t)===JSON.stringify(target(p)))).map(signature));assert.deepEqual(new Set(actual.placements.map(signature)),expected);
 assert.ok(actual.placements.some(p=>p.holdCount===0));assert.ok(actual.placements.some(p=>p.holdCount===2));
});
test('st-targeted/direct inverse-kick template preserves full spin without movement search',()=>{
 const s=R.createState({active:'T',board:fixtures.cap.afterCap});const full=R.placements(s,{allowHold:false});const tsd=full.placements.find(p=>p.event.lines===2&&p.event.spin==='full');assert.ok(tsd);
 const direct=R.targetedPlacements(s,[target(tsd)],{allowHold:false,search:false});assert.equal(direct.placements.length,1);assert.equal(direct.complete,true);assert.equal(direct.fallbackNodes,0);validateReplay(s,direct);
 const result=R.targetedPlacements(s,[target(tsd)],{allowHold:false});assert.equal(result.complete,true);assert.equal(result.placements.length,1);assert.equal(result.placements[0].event.spin,'full');assert.equal(result.placements[0].event.lines,2);assert.equal(result.fallbackNodes,0);assert.ok(result.visited<full.visited/5);validateReplay(s,result);
 const templated=R.targetedPlacements(s,[{...target(tsd),witness:tsd.witness}],{allowHold:false});assert.equal(templated.fallbackNodes,0);assert.equal(templated.placements.length,1);validateReplay(s,templated);
});
test('st-targeted/complete requested outcome sets match exhaustive reachability on uneven boards',()=>{
 for(const board of [fixtures.cap.before,fixtures.cap.afterCap])for(const active of ['L','T','I']){
  const s=R.createState({board,active,hold:'S',queue:['J','O']});const full=R.placements(s,{maxNodes:40000});assert.equal(full.complete,true);
  const targets=full.placements.map(target);const result=R.targetedPlacements(s,targets,{maxNodes:80000});assert.equal(result.complete,true);validateReplay(s,result);assert.deepEqual(new Set(result.placements.map(signature)),new Set(full.placements.map(signature)));
 }
});
test('st-targeted/blocked direct path does not teleport and bounded search stays unfinished',()=>{
 const board=R.emptyBoard();for(let y=20;y<40;y++)board[y]='.....#....';
 const s=R.createState({board,active:{type:'O',x:1,y:28,rotation:0,lastRotation:null}});
 const t={type:'O',x:7,y:37,rotation:0,spin:'none'};
 const direct=R.targetedPlacements(s,[t],{search:false,allowHold:false});assert.equal(direct.complete,false);assert.equal(direct.placements.length,0);
 const bounded=R.targetedPlacements(s,[t],{allowHold:false,maxNodes:20});assert.equal(bounded.complete,false);assert.equal(bounded.visited,20);assert.equal(bounded.placements.length,0);
 const finished=R.targetedPlacements(s,[t],{allowHold:false});assert.equal(finished.complete,true);assert.equal(finished.placements.length,0);
 for(const options of [{maxNodes:0},{deadline:0}]){const r=R.targetedPlacements(s,[t],options);assert.equal(r.complete,false);assert.equal(r.visited,0);assert.equal(r.placements.length,0);}
});
test('st-targeted/cell targets and legacy hold restrictions remain factual',()=>{
 const s=R.createState({rules:R.LEGACY_PROFILE.id,active:'O',hold:'Z',canHold:false});
 const cells=R.cells({type:'Z',x:7,y:36,rotation:1});assert.equal(R.targetedPlacements(s,[{type:'Z',cells,spin:'none'}]).placements.length,0);
 const allowed=R.createState({...s,canHold:true});const r=R.targetedPlacements(allowed,[{type:'Z',cells,spin:'none'}]);assert.equal(r.placements.length,1);assert.equal(r.placements[0].holdCount,1);validateReplay(allowed,r);
 assert.throws(()=>R.targetedPlacements(allowed,[{type:'Z',x:7}]),/invalid landing target/);
});

test('st-targeted/left tuck uses actual inverse-kick entry, with no synthetic spin facts',()=>{
 const board=fixtures.cap.afterCap.map(row=>[...row].reverse().join(''));
 const s=R.createState({active:'T',board});
 const full=R.placements(s,{allowHold:false});
 const tuck=full.placements.find(p=>p.target.x<3&&p.event.spin==='full'&&p.event.lines===2);assert.ok(tuck);
 const result=R.targetedPlacements(s,[target(tuck)],{allowHold:false,search:false});
 assert.equal(result.complete,true);assert.equal(result.fallbackNodes,0);assert.equal(result.placements.length,1);assert.ok(result.placements[0].witness.includes('SD'));validateReplay(s,result);
 const bounded=R.targetedPlacements(s,[target(tuck)],{allowHold:false,maxNodes:10});
 assert.equal(bounded.complete,false);assert.equal(bounded.visited,10);assert.equal(bounded.placements.length,0);
});

test('st-targeted/request cache reuses only completed exact scopes with independent results',()=>{
 const state=R.createState({active:'Z',hold:'O',queue:['T','I']});
 const targets=[{type:'Z',x:7,y:36,rotation:1,spin:'none'}];
 let original;
 R.withQueries(()=>{
  const first=R.targetedPlacements(state,targets,{allowHold:false});assert.ok(first.complete);assert.ok(first.visited>0);
  original=JSON.parse(JSON.stringify(first.placements));
  first.placements[0].witness.push('NO');first.placements[0].state.board[39]='XXXXXXXXXX';
  const cached=R.targetedPlacements(state,targets,{allowHold:false,maxNodes:0,deadline:0});
  assert.equal(cached.queryCached,true);assert.equal(cached.visited,0);assert.equal(cached.fallbackNodes,0);assert.equal(cached.directCount,0);assert.deepEqual(cached.placements,original);
  const misses=[
   [state,[{...targets[0],spin:undefined}],{allowHold:false}],
   [state,[{...targets[0],witness:original[0].witness}],{allowHold:false}],
   [state,targets,{allowHold:true}],
   [state,targets,{allowHold:false,search:false}],
   [{...state,revision:state.revision+1},targets,{allowHold:false}],
   [{...state,queue:['I','T']},targets,{allowHold:false}],
   [{...state,active:{...state.active,x:4}},targets,{allowHold:false}],
   [{...state,bag:{remaining:['Z']}},targets,{allowHold:false}]
  ];
  for(const [s,t,o] of misses)assert.notEqual(R.targetedPlacements(s,t,{...o,maxNodes:0}).queryCached,true);
  assert.equal(R.placements(state,{allowHold:false,maxNodes:0}).complete,false);
  assert.equal(R.queryMetrics().hits,1);
 });
 R.withQueries(()=>assert.notEqual(R.targetedPlacements(state,targets,{allowHold:false}).queryCached,true));
});
test('st-targeted/request cache does not promote interrupted target proofs into failures',()=>{
 const state=R.createState({active:'T',board:fixtures.cap.afterCap});
 const p=R.placements(state,{allowHold:false}).placements.find(p=>p.event.spin==='full'&&p.event.lines===2);
 R.withQueries(()=>{
  for(let i=0;i<2;i++){
   const r=R.targetedPlacements(state,[target(p)],{allowHold:false,maxNodes:1});
   assert.equal(r.complete,false);assert.equal(r.queryStatus,'unfinished');assert.equal(r.visited,1);assert.notEqual(r.queryCached,true);
  }
  const complete=R.targetedPlacements(state,[target(p)],{allowHold:false});assert.ok(complete.complete);
  assert.equal(R.targetedPlacements(state,[target(p)],{allowHold:false,maxNodes:0}).queryCached,true);
 });
});
