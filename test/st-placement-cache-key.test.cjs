'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules');
const clone=x=>JSON.parse(JSON.stringify(x));
const previousEvents=[null,
 {type:'O',target:{type:'O',x:1,y:37,rotation:0},cells:[[2,38],[3,38],[2,39],[3,39]],lines:0,clearedRows:[],spin:'none',topOut:false},
 {type:'T',target:{type:'T',x:7,y:36,rotation:2},cells:[[7,38],[8,38],[9,38],[8,39]],lines:2,clearedRows:[38,39],spin:'full',topOut:false}];

test('placement cache: preceding lock events share complete ordered results without retaining caller mutations',()=>{
 const base=R.createState({active:'O',hold:'T',queue:['I','S'],revision:37,streamCursor:12,bag:{remaining:[6],observedCount:23,provenance:'known-phase'}});
 const states=previousEvents.map(lastEvent=>({...clone(base),lastEvent:clone(lastEvent)}));
 const absent=clone(base);delete absent.lastEvent;states.push(absent);
 const expected=R.placements(states[0]);assert.equal(expected.complete,true);assert.ok(expected.placements.length>0);
 for(const state of states){
  const fresh=R.placements(state);assert.deepEqual(fresh,expected);
  assert.equal(JSON.stringify(fresh.placements),JSON.stringify(expected.placements),'placement and property ordering is stable');
 }
 R.withQueries(()=>{
  const originalInputs=states.map(JSON.stringify),first=R.placements(states[1]);
  assert.equal(first.complete,true);assert.ok(first.visited>0);
  first.placements[0].event.cells[0][0]=99;first.placements[0].state.lastEvent.lines=99;first.placements[0].witness.push('NO');
  for(const state of states){
   const cached=R.placements(state,{maxNodes:0});
   assert.equal(cached.queryCached,true);assert.equal(cached.visited,0);assert.equal(cached.complete,true);
   assert.deepEqual(cached.placements,expected.placements);
   assert.equal(JSON.stringify(cached.placements),JSON.stringify(expected.placements));
   for(const placement of cached.placements){
    const replay=R.replay(state,placement.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,placement.state);
    assert.deepEqual(placement.event,placement.state.lastEvent);
   }
   cached.placements[0].state.board[39]='XXXXXXXXXX';cached.placements[0].event.spin='mutated';
  }
  assert.deepEqual(states.map(JSON.stringify),originalInputs);
  const metrics=R.queryMetrics();assert.equal(metrics.hits,states.length);assert.equal(metrics.avoidedNodes,states.length*first.visited);assert.equal(metrics.entries,1);
 });
});

test('placement cache: revision and passthrough state remain distinct and exact in replayed outputs',()=>{
 const base=R.createState({active:'O',queue:['I'],revision:20,streamCursor:3});
 const variants=[{...base,revision:21},{...base,trace:{source:'caller'}},{...base,topOut:true},{...base,revision:-1}];
 const expected=variants.map(state=>R.placements(state));
 R.withQueries(()=>{
  R.placements(base);
  for(let i=0;i<variants.length;i++){
   const state=variants[i],result=R.placements(state);assert.notEqual(result.queryCached,true);assert.deepEqual(result.placements,expected[i].placements);
   const cached=R.placements({...state,lastEvent:previousEvents[2]},{maxNodes:0});assert.equal(cached.queryCached,true);assert.deepEqual(cached.placements,expected[i].placements);
   for(const placement of cached.placements){assert.equal(placement.state.revision,state.revision+placement.witness.length);assert.deepEqual(R.replay(state,placement.witness).state,placement.state);}
  }
 });
});

test('placement cache: current rotation evidence still separates zero-distance none, mini and full spins',()=>{
 const board=R.emptyBoard();board[36]='...#.#....';board[38]='...#......';
 const rotations=[null,{from:1,to:2,kickIndex:0},{from:1,to:2,kickIndex:4},{from:0,to:2,kickIndex:4}];
 const classifications=['none','mini','full','mini'];
 const states=rotations.map(lastRotation=>R.createState({board,active:{type:'T',x:3,y:35,rotation:2,lastRotation},revision:80}));
 const expected=states.map(state=>R.placements(state,{allowHold:false}));
 R.withQueries(()=>{
  for(let i=0;i<states.length;i++){
   const state=states[i],result=R.placements({...state,lastEvent:previousEvents[2]},{allowHold:false});
   assert.notEqual(result.queryCached,true);assert.equal(result.complete,true);assert.deepEqual(result.placements,expected[i].placements);
   const direct=result.placements.find(p=>p.witness.length===1&&p.witness[0]==='HD');assert.ok(direct);assert.equal(direct.event.spin,classifications[i]);
   const cached=R.placements({...state,lastEvent:previousEvents[1]},{allowHold:false,maxNodes:0});assert.equal(cached.queryCached,true);assert.deepEqual(cached.placements,expected[i].placements);
   for(const placement of cached.placements)assert.deepEqual(R.replay(state,placement.witness).state,placement.state);
  }
 });
});
