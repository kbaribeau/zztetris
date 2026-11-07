'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const R=require('../st-rules'),M=require('../st-obligation-resources'),C=require('../st-obligation-context'),Provider=require('../st-resource-provider');
// Synthetic node ranks isolate scheduling, while every resource view is a
// locally prepared immutable current route. No historical timestamps remain.
const source=fs.readFileSync(require.resolve('../st-planner'),'utf8').replace('return Object.freeze({dPatternAdmission,','return Object.freeze({historyDiversityEnabled,diversify,dPatternAdmission,');
const mod={exports:{}};vm.runInNewContext(source,{module:mod,require:createRequire(require.resolve('../st-planner')),Date,performance});
const diversify=mod.exports.diversify,clone=x=>JSON.parse(JSON.stringify(x));
function resource(at=43,change=()=>{},handoff=true){
 const state=R.createState({active:'O',queue:[...'IJLSTZ'],streamCursor:1});let context=C.start(state,{fresh:true});if(handoff)context=C.handoff(context,{position:state}).context;
 const raw=C.exportState(context);raw.state.account.profile.before.t=at%2+1;change(raw);
 return Provider.startRoute(Provider.prepare(state,{obligationContext:raw}),{extendForced:false});
}
function node(key,type='L',at=43,rootIndex=0){const resources=resource(at),state=clone(M.position(resources));return{key,state,resources,rank:[1,1,0,10,1,0,0,0],notches:{status:'known',anchorRow:35},cavityDebt:[],coveredRepairDebt:[],centerDebt:[],rootIndex,
 path:[{target:{type,x:1,y:30,rotation:0},witness:type==='L'?['HOLD','HD']:['HD'],structuralEvidence:{cavityRepair:{cells:[]}}}],assessment:{right:{slots:[{}]}}};}
const keys=nodes=>Array.from(nodes,n=>n.key);
function cohort(){const a=node('a','L',43,0),b=node('b','Z',44,1),c=node('c','Z',44,1);c.state.board[39]='I.........';c.rank[3]=9;return[a,b,c];}
test('resource diversity: latent current facts cannot consume both ordinary family slots',()=>{
 const nodes=cohort(),before=clone(nodes),bindings=nodes.map(n=>M.binding(n.resources));assert.notEqual(bindings[0],bindings[1]);
 assert.deepEqual(keys(diversify(nodes,2,false)),['a','b']);assert.deepEqual(keys(diversify(nodes,2,true)),['a','c']);assert.deepEqual(nodes,before);assert.deepEqual(nodes.map(n=>M.binding(n.resources)),bindings);
});
test('resource diversity: spare width retains distinct current routes, never merged proofs',()=>{const nodes=cohort(),chosen=diversify(nodes,3,true);assert.deepEqual(keys(chosen),['a','c','b']);assert.equal(chosen[0],nodes[0]);assert.equal(chosen[2],nodes[1]);assert.notEqual(M.binding(chosen[0].resources),M.binding(chosen[2].resources));assert.equal(diversify(nodes,1,true).length,1);});
test('resource diversity: current identities, aggregate uncertainty and exact obligations stay distinct',()=>{
 const edits=[raw=>{[raw.inventory.active.id,raw.inventory.queue[0].id]=[raw.inventory.queue[0].id,raw.inventory.active.id];},raw=>raw.state.sl.uncertainty.S[0]++,raw=>raw.state.sl.uncertainty.L[0]++,raw=>raw.state.center.pending.push({id:'current-target',rootId:null,family:null,alternatives:[{piece:'L',cells:[[4,37],[4,38],[4,39],[5,39]]}]})];
 for(const edit of edits){const nodes=cohort();nodes[1].resources=resource(44,edit);assert.deepEqual(keys(diversify(nodes,2,true)),['a','b']);}
});
test('resource diversity: no collisions retain original scheduling and nonordinary scope',()=>{const nodes=cohort();nodes[1].state.board[38]='.I........';for(const width of [1,2,3,4])assert.deepEqual(keys(diversify(nodes,width,true)),keys(diversify(nodes,width,false)));assert.deepEqual(keys(diversify(cohort(),2)),['a','b']);});
test('resource diversity: activation requires known current accounting and observed handoff',()=>{const enabled=mod.exports.historyDiversityEnabled;assert.equal(enabled(resource(43,()=>{},false)),false);assert.equal(enabled(resource()),true);assert.equal(enabled(Provider.startRoute(Provider.projectHandoff(Provider.prepare(M.position(resource()))))),false);});
