'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),M=require('../st-obligation-resources');
const source=fs.readFileSync(require.resolve('../st-planner.js'),'utf8');
function load({notchValid=true,cycle=[],dependencyDebt=0}={}){
 const calls={resources:0},module={exports:{}},stop=new Error('reached resource projection');
 const structure={...S,advanceNotches:(...args)=>({...S.advanceNotches(...args),valid:notchValid}),transition:(...args)=>({...S.transition(...args),cycleViolations:cycle.slice(),dependencyDebt})};
 assert.equal(source.split('return Object.freeze({').length,2,'review the private export seam after a planner refactor');
 vm.runInNewContext(source.replace('return Object.freeze({','return Object.freeze({nodeFor,'),{module,require:id=>id==='./st-structure.js'?structure:id==='./st-obligation-resources.js'?{...M,step:()=>{calls.resources++;throw stop;}}:require(id.replace('./','../')),Date,performance});
 return{api:module.exports,calls,stop};
}
function input(){
 const state=R.createState({active:'O',queue:['I','T']}),next=R.move(state,'HD'),notches=S.notchPattern(state.board),initial={...P.assess(state.board),state,notches,resources:{}};
 const p={state:next,event:next.lastEvent,target:next.lastEvent.target,witness:['HD'],hold:false,holdCount:0,structuralEvidence:{retained:'preparation'}};
 return{state,initial,p};
}
for(const [name,settings] of [['invalid notch',{notchValid:false}],['known cycle violation',{cycle:['spent-cap-Z-on-optional-work']}]]){
 test('ordinary early rejection: '+name+' stops before projection without changing shared placement',()=>{
  const {api,calls,stop}=load(settings),{p,initial}=input(),before=JSON.stringify(p);
  assert.equal(api.nodeFor(p,null,initial,0,api.assess,true),null);assert.equal(calls.resources,0);assert.equal(JSON.stringify(p),before);
  assert.throws(()=>api.nodeFor(p,null,initial,0,api.assess),error=>error===stop,'shared preparation callers keep the full node path');assert.equal(calls.resources,1);
 });
}
test('ordinary early rejection: inherited cycle debt cannot be repaired by a child projection',()=>{
 const {api,calls}=load(),{p,initial}=input(),parent={state:initial.state,notches:initial.notches,path:[],cycleDebt:1};
 assert.equal(api.nodeFor(p,parent,initial,0,api.assess,true),null);assert.equal(calls.resources,0);
});
test('ordinary early rejection: unresolved structural preference alone is not rejection',()=>{
 const {api,calls,stop}=load({dependencyDebt:9}),{p,initial}=input();
 assert.throws(()=>api.nodeFor(p,null,initial,0,api.assess,true),error=>error===stop);assert.equal(calls.resources,1);
});
test('ordinary early rejection: actual Right piece gate remains an early necessary condition',()=>{
 const {api,calls}=load(),{p,initial}=input();p.event={...p.event,cells:[[7,38],[8,38],[7,39],[8,39]]};
 assert.equal(api.nodeFor(p,null,initial,0,api.assess,true),null);assert.equal(calls.resources,0);
});
