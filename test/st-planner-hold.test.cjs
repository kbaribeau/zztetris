'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),P=require('../st-planner'),F=require('../st-fixtures');
function doubleHoldAdvice(){
 const s=R.migrateState({...F.get('o-before-double').observation,hold:null});
 const scoped={...R,placements:(state,options)=>{const e=R.placements(state,options);return {...e,placements:e.placements.filter(p=>p.holdCount===2)};}};
 const box={module:{exports:{}},exports:{},require:p=>p==='./st-rules.js'?scoped:require('../'+p),Date};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),box);
 const a=JSON.parse(JSON.stringify(box.module.exports.plan(s,{depth:1})));assert.ok(a.target,a.reason);return{s,a};
}
test('planner describes and retains only the remaining meaningful holds',()=>{
 const{s,a}=doubleHoldAdvice();assert.equal(a.holdCount,2);assert.match(a.reason,/^Hold twice\./);
 const once=R.move(s,'HOLD'),next=P.advance(once,a,'HOLD');assert.ok(next);assert.equal(next.holdCount,1);assert.match(next.reason,/^Hold first\./);
 const twice=R.move(once,'HOLD'),last=P.advance(twice,next,'HOLD');assert.ok(last);assert.equal(last.holdCount,0);assert.equal(last.hold,false);assert.doesNotMatch(last.reason,/^Hold/);
 assert.equal(twice.streamCursor,s.streamCursor+1);assert.equal(twice.hold,s.queue[0]);
});
test('revalidation preserves swap-back semantic result, not only matching placement cells',()=>{
 const{s,a}=doubleHoldAdvice();const valid=P.revalidate(s,a);assert.ok(valid);assert.equal(valid.holdCount,2);
 const counterfeit={...a,holdCount:0,hold:false};assert.equal(P.revalidate(s,counterfeit),null,'same cells without stashing the next piece are a different result');
 const stale=structuredClone(a);stale.continuation[0].resultContext='stale';assert.equal(P.revalidate(s,stale),null);
});
