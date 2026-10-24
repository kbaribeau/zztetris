'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),X=require('../st-paired-repair');
const f=require('./support/st-opening-access-beam.json');
test('opening beam: proven rejected executed prefixes do not occupy later expansion slots',()=>{
 const a=P.plan(f.observation,{openingPhase:true,deadline:Infinity,maxNodes:45000});
 assert.ok(a.target);assert.ok(a.metrics.accessPrunedPrefixes>0);assert.equal(a.metrics.completeDepth,3);
 const access=P.checkAccessPrefix(f.observation,a.continuation,{deadline:Infinity,maxNodes:30000});assert.equal(access.reachable,true);
 assert.ok(a.metrics.nodes<=45000);
});
test('opening beam: an unknown access result never becomes a proven-negative pruning decision',()=>{
 let checks=0;const module={exports:{}},mock={...P,checkAccessPrefix:()=>{checks++;return{reachable:null,complete:false,visited:0,status:'budget-unknown'};}};
 const modules={'./st-rules':R,'./st-structure':S,'./st-paired-repair':X,'./st-planner':mock};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>modules[id],performance,console,Date});
 const a=module.exports.plan(f.observation,{deadline:Infinity,maxNodes:12000,openingDepth:2});
 assert.ok(checks>0);assert.equal(a.metrics.accessPrunedPrefixes,0);assert.equal(a.target,null);
});
