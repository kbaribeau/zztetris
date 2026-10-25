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
