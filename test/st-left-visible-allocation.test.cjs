'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('../st-left-context');
const state=(active,hold=null,queue=[],canHold=true)=>({active:active?{type:active}:null,hold,queue,canHold});
const evaluate=(s,heights,extra={})=>L.evaluate(s,{heights,covered:0,...extra});
// These are literal source-profile transformations, not a claim that source
// tier identifies a sustainable field or that this estimator proves movement.
test('Unlisted Left: actual visible J conversion to SS receives no invented starting tier',()=>{
 const r=evaluate(state('J','I',['Z','S','J','O','T','L']),[12,9,9,8]);
 assert.equal(r.shape,null);assert.equal(r.tier,null);assert.equal(r.context,'unlisted-visible-conversion');
 assert.deepEqual(r.repair,{pieces:['J'],tier:'SS',hold:false});assert.ok(r.score>0);assert.ok(r.score<=4.6);assert.equal(r.executionVerified,false);
 assert.ok(L.landings([12,9,9,8],'J').some(h=>JSON.stringify(h)==='[12,10,10,10]'));
});
test('Unlisted Left: visible held J then O can justify the temporary I/I surface',()=>{
 const r=evaluate(state('O','J',['T','Z','I','T','J','O']),[8,10,14,14]);
 assert.equal(r.context,'unlisted-visible-conversion');assert.deepEqual(r.repair,{pieces:['J','O'],tier:'S',hold:true});assert.equal(r.score,2.8);
 const blocked=evaluate(state('O','J',['T','Z'],false),[8,10,14,14]);assert.equal(blocked.repair,null);assert.equal(blocked.score,0);
});
test('Unlisted Left: visible order and empty-HOLD draw consumption are exact',()=>{
 const usable=evaluate(state('T',null,['J','O'],true),[8,10,14,14]);
 assert.deepEqual(usable.repair,{pieces:['J','O'],tier:'S',hold:true});
 assert.equal(evaluate(state('T',null,['T','J','O'],true),[8,10,14,14]).score,0);
 assert.equal(evaluate(state('T','J',['T','O'],true),[8,10,14,14]).score,0);
});
test('Unlisted Left: reservations are not free I/O/J repair supply',()=>{
 const s=state('J','I',['Z']);
 assert.equal(evaluate(s,[12,9,9,8],{centerDebt:[{alternatives:[{piece:'J'}]}],right:{cycle:{prepareColumn:9}}}).score,0);
 assert.equal(evaluate(s,[12,9,9,8],{resources:{pendingCenter:[{alternatives:[{piece:'J'}]}]},right:{cycle:{cleanupColumns:[9]}}}).score,0);
 assert.equal(evaluate(state('O','J',['T']),[8,10,14,14],{center:{status:'supported-partner-completion',completions:[{piece:'O',patternSupport:'reference-supported'}]}}).score,0);
});
test('Unlisted Left: no credit for holes, flat unknown tier, or unlisted endpoint',()=>{
 assert.equal(evaluate(state('J'),[12,9,9,8],{covered:1}).context,'covered-cells-neutral');
 assert.equal(evaluate(state('O','I',['J']),[8,8,8,8]).score,0);
 assert.equal(evaluate(state('T',null,[],false),[3,6,5,3]).score,0);
 assert.equal(evaluate(state('J'),[3,6,5,3]).score,0);
});
test('Unlisted Left: no S/L/Z surplus shortcut and no hidden future',()=>{
 const resources={extraZ:'available',active:{type:'S',id:1},hangingS:[{id:1}],hold:{type:'L',id:2},hangingL:[{id:2}]};
 assert.equal(evaluate(state('S','L',['Z']),[12,9,9,8],{resources}).score,0);
 const s=state('T',null,[],false),a=evaluate(s,[8,10,14,14]);
 assert.deepEqual(evaluate({...s,hiddenQueue:['J','O'],seed:817920},[8,10,14,14]),a);
});
