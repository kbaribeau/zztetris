'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),A=require('../st-access'),M=require('../st-midgame-resources'),{fixtures}=require('./support/st-fixtures.cjs');
function probe({denyResource=false,expire=true}={}){
 const state=R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']});let clock=0,checks=0,callerCalls=0;
 const access={...A,prefix:(...args)=>{checks++;if(clock>=50)return{reachable:null,complete:false,visited:0,status:'unknown-access-budget'};const result=A.prefix(...args);if(expire&&checks===3)clock=100;return result;}};
 const resources={...M,checkPath:(...args)=>denyResource?{valid:false,reason:'controlled-resource-rejection',resource:M.start(args[0])}:M.checkPath(...args)};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module:mod,require:id=>id==='./st-access.js'?access:id==='./st-midgame-resources.js'?resources:require(id.replace('./','../')),Date,performance});
 const result=mod.exports.plan(state,{depth:3,width:3,maxNodes:15000,deadline:50,now:()=>clock,admitMaintenance:()=>{callerCalls++;throw Error('untrusted callback');}});
 return{state,result,checks,callerCalls,P:mod.exports};
}
test('certified fallback: all boundary checks complete before later unknown access, without overstating depth',()=>{
 const {state,result,checks,callerCalls}=probe();assert.ok(checks>=4);assert.equal(callerCalls,0);assert.ok(result.target,result.reason);assert.equal(result.metrics.certifiedFallback?.selected,true);
 assert.equal(result.evidence.searchIncomplete,true);assert.ok(result.metrics.completeDepth<3);assert.ok(result.metrics.nodes<=15000);assert.ok(result.metrics.firstCertified.nodes<=result.metrics.nodes);
 const r=R.replay(state,result.continuation.flatMap(x=>x.witness));assert.equal(r.valid,true);assert.equal(result.evidence.resourceObligations.status,'checked');assert.equal(result.evidence.gapAccess.reachable,true);
});
test('certified fallback: resource rejection cannot be replaced by access-only or caller-supplied authority',()=>{
 const {result,callerCalls}=probe({denyResource:true,expire:false});assert.equal(result.target,null);assert.equal(callerCalls,0);assert.equal(result.metrics.certifiedFallback,undefined);
});
test('certified fallback: prior serialized evidence is not a new invocation certificate',()=>{
 const {state,result,P}=probe();assert.ok(result.target);
 const changed={...state,hold:'S'};const next=P.plan(changed,{maxNodes:0,previous:result,admitMaintenance:()=>result});assert.equal(next.target,null);
 assert.equal(P.revalidate(changed,result,{maxNodes:0}),null);
});
