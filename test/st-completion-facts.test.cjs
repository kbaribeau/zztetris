'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),F=require('../st-fixtures');
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

test('st-completions/facts: returned candidates cannot mutate later completion witnesses or profiles',()=>{
 let witnessed=0;
 for(const id of ['center-j','left-l','after-quad','i-via-hold']){
  const state=freeze(F.get(id).observation),before=JSON.stringify(state),phase=S.notchPattern(state.board),a=S.assess(state,{notches:phase}),pristine=copy(a);
  for(const region of ['left','center','right'])for(const completion of a[region].completions){
   const replay=R.replay(R.createState({board:state.board,active:completion.piece,canHold:false}),completion.witness);
   assert.equal(replay.valid,true);assert.deepEqual(replay.events[0].cells,completion.cells);assert.deepEqual(replay.events[0].target,completion.target);witnessed++;
   completion.cells[0][0]=99;completion.target.x=99;completion.witness.push('BAD');if(completion.resultProfile)completion.resultProfile[0]=99;
  }
  a.left.profile[0]=99;a.center.profile[0]=99;
  assert.deepEqual(S.assess(state,{notches:phase}),pristine,'a sibling assessment owns its completion output');
  S.clearCache();assert.deepEqual(S.assess(state,{notches:phase}),pristine,'a new decision owns its completion output');
  assert.equal(JSON.stringify(state),before);
 }
 assert.ok(witnessed>0);
});

test('st-completions/facts: board-dependent heights and sealed baselines do not survive a calculation',()=>{
 const state=freeze(F.get('center-j').observation),phase=S.notchPattern(state.board);
 S.clearCache();const expected=copy(S.assess(state,{notches:phase}));
 const shifted=state.board.slice(3).concat(Array(3).fill('..........'));
 for(const board of [shifted,R.emptyBoard(),F.get('higher-double').observation.board]){
  S.clearCache();S.assess(R.createState({board,active:'T',hold:'I',queue:['S','L']}));
  S.clearCache();assert.deepEqual(S.assess(state,{notches:phase}),expected);
 }
 const unknown=S.assess({...state,active:null,hold:null,queue:[],bag:null},{notches:phase});
 assert.deepEqual(unknown.center.completions,expected.center.completions);
 assert.deepEqual(unknown.left.completions,expected.left.completions);
 assert.deepEqual(unknown.supply.instances,[],'piece supply is not memoized with shape facts');
 assert.ok(expected.supply.instances.length>0);
});

test('st-completions/facts: shifted stacks retain exact executable profiles and independent output cells',()=>{
 let checked=0;const height=(board,x)=>{for(let y=0;y<40;y++)if(board[y][x]!=='.')return 40-y;return 0;};
 for(const fixture of F.list)for(const shift of [0,4,12]){
  const board=fixture.observation.board.slice(shift).concat(Array(shift).fill('..........'));
  const state=R.createState({board,active:'T',hold:'I',queue:['S','L','O','J','Z']});S.clearCache();const assessment=S.assess(state);
  for(const [region,lo,hi]of [['left',0,3],['center',4,6]]){
   const seen=new Set();for(const c of assessment[region].completions){
    const replay=R.replay(R.createState({board,active:c.piece,canHold:false}),c.witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);assert.equal(replay.events[0].lines,0);assert.equal(replay.events[0].topOut,false);
    assert.deepEqual(c.cells,replay.events[0].cells);assert.deepEqual(c.resultProfile,Array.from({length:hi-lo+1},(_,i)=>height(replay.state.board,lo+i)));
    const key=c.cells.map(([x,y])=>x+','+y).sort().join(';');assert.equal(seen.has(key),false);seen.add(key);
    assert.notEqual(c.cells,c.preserveCells);assert.notEqual(c.cells[0],c.preserveCells[0]);checked++;
   }
  }
 }
 assert.ok(checked>20,'exercise multiple piece columns, rotations and surface heights');
});
