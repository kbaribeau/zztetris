'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access'),f=require('./support/st-completed-preparation-priority.json');
function replay(steps){let state=f.observation,phase=S.notchPattern(state.board);for(const step of steps){const r=R.replay(state,step.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],step.event);assert.ok(S.canonicalClear(step.event));const n=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},phase);assert.ok(n.valid);phase=n.pattern;state=r.state;}return{state,phase};}
test('literal cap/T alternatives preserve the measured Center versus Left construction tradeoff',()=>{
 const old=replay(f.oldSteps),clean=replay(f.completedBaselineSteps);
 for(const steps of [f.oldSteps,f.completedBaselineSteps]){assert.equal(A.prefix(f.observation,steps).reachable,true);assert.equal(steps.reduce((n,p)=>n+p.event.lines,0),2);assert.equal(steps.length,3);}
 const prior=S.geometry(old.state.board,{notches:old.phase}).center,next=S.geometry(clean.state.board,{notches:clean.phase}).center;
 assert.equal(prior.status,'unrecognized');assert.equal(next.status,'level');assert.equal(next.patternSupport,'reference-supported');assert.equal(next.foundation.status,'aligned');
 assert.ok(P.assess(clean.state.board).maxHeight<20);
 // Both exact public routes remain legal. The rejected comparator experiment
 // does not establish that the cleaner Center is the better long-run choice.
});
