'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const equivalent=require('./support/st-equivalent-s.cjs'),{summarize}=require('./support/st-selection-performance.cjs');
const expected={type:'S',target:{type:'S',x:4,y:22,rotation:0},cells:[[5,23],[6,23],[4,24],[5,24]],lines:0,clearedRows:[],spin:'none',topOut:false};
test('fresh S semantic oracle ignores only symmetric encoding, not cells or event safety',()=>{
 const same={...structuredClone(expected),target:{type:'S',x:4,y:21,rotation:2}};
 equivalent.event(same,expected);
 for(const mutate of [e=>e.target.x++,e=>e.target.type='Z',e=>e.cells[0][0]++,e=>e.type='Z',e=>e.lines=1,e=>e.spin='full',e=>e.topOut=true,e=>e.clearedRows=[39]]){
  const wrong=structuredClone(same);mutate(wrong);assert.throws(()=>equivalent.event(wrong,expected),assert.AssertionError);
 }
 const t={...structuredClone(expected),type:'T',target:{type:'T',x:4,y:22,rotation:0}};
 assert.throws(()=>equivalent.event({...t,target:{...t.target,rotation:2}},t),assert.AssertionError,'T targets remain exact');
});
test('selection performance distinguishes immediate, deferred and absent finite-window scores',()=>{
 const filler={spin:'none',lines:0},double={spin:'full',lines:2};
 assert.deepEqual(summarize([double,filler]),{locks:2,firstTsdLock:1,tsds:1,lines:2,cycle:null});
 assert.deepEqual(summarize([filler,double]),{locks:2,firstTsdLock:2,tsds:1,lines:2,cycle:null});
 assert.deepEqual(summarize([filler,filler],{cycle:false}),{locks:2,firstTsdLock:null,tsds:0,lines:0,cycle:false});
});
