'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const R=require('../st-rules'),M=require('../st-midgame-resources');
// Expose only the private scheduling seam. These synthetic nodes test beam
// sampling, not legality, supported strategy, or a substitute repair proof.
const source=fs.readFileSync(require.resolve('../st-planner'),'utf8').replace('return Object.freeze({dPatternAdmission,','return Object.freeze({diversify,dPatternAdmission,');
const mod={exports:{}};vm.runInNewContext(source,{module:mod,require:createRequire(require.resolve('../st-planner')),Date,performance});
const diversify=mod.exports.diversify,clone=x=>JSON.parse(JSON.stringify(x));
function node(key,type='L',at=43,rootIndex=0){
 const state=R.createState({active:'O',hold:'L',queue:['S','T','J','I']});
 const resources={...M.start(state),slHistory:{pieces:{43:{id:43,type:'L',bag:6,allocation:{at,region:'left'},pair:null}},closed:[],milestones:{maintenanceHandoff:{at:20}},locks:44}};
 return{key,state,resources,rank:[1,1,0,10,1,0,0,0],notches:{status:'known',anchorRow:35},cavityDebt:[],coveredRepairDebt:[],centerDebt:[],rootIndex,
 path:[{target:{type,x:1,y:30,rotation:0},witness:type==='L'?['HOLD','HD']:['HD'],structuralEvidence:{cavityRepair:{cells:[]}}}],assessment:{right:{slots:[{}]}}};
}
const keys=nodes=>Array.from(nodes,n=>n.key);
function cohort(){const a=node('a','L',43,0),b=node('b','Z',44,1),c=node('c','Z',44,1);c.state.board[39]='I.........';c.rank[3]=9;return[a,b,c];}
test('resource diversity: commuting histories cannot consume both ordinary family slots',()=>{
 const nodes=cohort(),before=clone(nodes),bindings=nodes.map(n=>M.binding(n.resources));assert.notEqual(bindings[0],bindings[1]);
 assert.deepEqual(keys(diversify(nodes,2,false)),['a','b'],'legacy scheduling exposes crowding');
 assert.deepEqual(keys(diversify(nodes,2,true)),['a','c'],'other current position receives the Z family slot');
 assert.deepEqual(nodes,before);assert.deepEqual(nodes.map(n=>M.binding(n.resources)),bindings,'exact proof identities unchanged');
});
test('resource diversity: spare width retains distinct histories, never merged proofs',()=>{
 const nodes=cohort(),chosen=diversify(nodes,3,true);assert.deepEqual(keys(chosen),['a','c','b']);assert.equal(chosen[0],nodes[0]);assert.equal(chosen[2],nodes[1]);assert.notEqual(M.binding(chosen[0].resources),M.binding(chosen[2].resources));
 assert.equal(diversify(nodes,1,true).length,1);
});
test('resource diversity: current identities, obligations, and violations stay distinct',()=>{
 const edits=[n=>n.resources.active.id--,n=>n.resources.hangingS.push({id:46,bag:6,known:true}),n=>n.resources.unclassifiedL.push({lId:43,bag:6}),n=>n.resources.violations.push('extra-Z-not-available'),n=>n.resources.pendingCenter.push({rootId:43,family:'LO',alternatives:[]})];
 for(const edit of edits){const nodes=cohort();edit(nodes[1]);assert.deepEqual(keys(diversify(nodes,2,true)),['a','b']);}
});
test('resource diversity: no collisions retain original scheduling and nonordinary scope',()=>{
 const nodes=cohort();nodes[1].state.board[38]='.I........';for(const width of [1,2,3,4])assert.deepEqual(keys(diversify(nodes,width,true)),keys(diversify(nodes,width,false)));assert.deepEqual(keys(diversify(cohort(),2)),['a','b'],'existing other search families keep their default');
});
