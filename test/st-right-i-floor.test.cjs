'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner');
const fixture=require('./fixtures/st-right-i-floor.json');
function internal(file,names,overrides={}){const filename=require.resolve('../'+file),source=fs.readFileSync(filename,'utf8'),module={exports:{}};assert.equal(source.split('return Object.freeze({').length,2);vm.runInNewContext(source.replace('return Object.freeze({','return Object.freeze({'+names+','),{module,require:id=>overrides[id]||require(path.resolve(path.dirname(filename),id)),Date,performance});return module.exports;}
function placement(state,witness){const r=R.replay(state,witness);assert(r.valid);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0],target:r.events[0].target,witness,hold:witness.includes('HOLD')};}
const empty=()=>Array(40).fill('..........');
for(const rotation of [0,1,2,3])test('right I floor: occupied cells for rotation '+rotation,()=>{
 const x=rotation===1?7:rotation===3?8:6,y=rotation===0?38:rotation===2?37:36;
 const cells=R.cells({type:'I',x,y,rotation});assert(cells.some(([x,y])=>x===9&&y===39));
 assert(S.rightIFloorAllowed({type:'I',cells}));
 assert(!S.rightIFloorAllowed({type:'I',cells:cells.map(([x,y])=>[x,y-1])}));
 assert(S.rightIFloorAllowed({type:'I',cells:cells.map(([x,y])=>[x-1,y-5])}));
 assert(S.rightIFloorAllowed({type:'Z',cells:cells.map(([x,y])=>[x,y-1])}));
});
test('right I floor: actual pre-clear cells reject a floating Tetris; floor Tetris remains allowed',()=>{
 for(const bottom of [38,39]){const board=empty();for(let y=bottom-3;y<=bottom;y++)board[y]='JJJJJJJJJ.';if(bottom===38)board[39]='.........Z';
  const state=R.createState({board,active:{type:'I',x:7,y:bottom-3,rotation:1},queue:['T','Z']}),p=placement(state,['HD']);
  assert.equal(p.event.lines,4);assert.equal(S.canonicalClear(p.event),true);assert.equal(S.rightIFloorAllowed(p.event),bottom===39);assert.equal(P.ordinaryRightEligible(p.event),bottom===39);
  assert.equal(S.transition(state,p).cycleViolations.includes('right-I-must-reach-floor'),bottom!==39);
 }
});
test('right I floor: seed10331 lock65 is physically legal but rejected by ordinary, route, fallback and saved-advice eligibility',()=>{
 const state=R.createState(fixture.request.observation),p=placement(state,fixture.witness);
 assert.deepEqual(p.event.cells,[[9,31],[9,32],[9,33],[9,34]]);assert.equal(p.event.lines,0);
 assert.equal(P.ordinaryRightEligible(p.event),false);assert(S.transition(state,p).cycleViolations.includes('right-I-must-reach-floor'));
 const api=internal('st-planner.js','nodeFor'),initial={...P.assess(state.board),state,notches:S.notchPattern(state.board),resources:{}};
 assert.equal(api.nodeFor(p,null,initial,0,api.assess,true),null,'pruned before resource projection');
});
test('right I floor: opening rejects before clear-specific admission and Reset rejects before resource projection',()=>{
 const state=R.createState(fixture.request.observation),p=placement(state,fixture.witness),notches=S.notchPattern(state.board);
 const opening=internal('st-opening.js','validStep'),usage={rejections:{}};
 assert.equal(opening.validStep(state.board,p,notches,{usage}),null);assert.equal(usage.rejections['right-I-must-reach-floor'],1);
 const clearing={...p,event:{...p.event,lines:4}};assert.equal(opening.validStep(state.board,clearing,notches,{usage}),null);assert.equal(usage.rejections['right-I-must-reach-floor'],2);
 const reset=internal('st-reset-coach.js','transition',{'./st-obligation-resources':{step(){throw Error('must reject before projection');}}});
 assert.equal(reset.transition({state,notches,allowHold:true,resource:{}},p),null);
});
test('right I floor: real worker never returns the diagnosed floating I or a floating continuation',()=>{
 const E=require('../scripts/lib/st-simulation.cjs'),request=structuredClone(fixture.request);request.options={...request.options,timeMs:1500,maxNodes:45000,width:8,depth:null};
 const advice=E.workerPlanner({timeoutMs:2500})(request);
 for(const step of advice.continuation||[])assert(S.rightIFloorAllowed(step.event));
 if(advice.target){const p=placement(R.createState(request.observation),advice.witness);assert(S.rightIFloorAllowed(p.event));}
});
