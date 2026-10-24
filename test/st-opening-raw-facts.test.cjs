'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),X=require('../st-paired-repair');
function load(planner){const module={exports:{}},modules={'./st-rules':R,'./st-structure':S,'./st-paired-repair':X,'./st-planner':planner};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>modules[id],performance,Date});return module.exports;}
const clean=a=>{const out=JSON.parse(JSON.stringify(a));delete out.metrics.elapsedMs;return out;};
test('opening raw facts: repeated children reuse immutable parent assessment without exporting decorated authority',()=>{
 const counts=new WeakMap();let observed;
 const mock={...P,observe:raw=>(observed=P.observe(raw)),assess:board=>{counts.set(board,(counts.get(board)||0)+1);const a=P.assess(board);Object.freeze(a);return a;}};
 const O=load(mock),state=R.createState({active:'O',queue:['I','L','J','T','S','Z']});
 const a=O.plan(state,{deadline:Infinity,maxNodes:12000,openingDepth:1});
 assert.ok(a.target);assert.equal(a.metrics.completeDepth,1);assert.equal(counts.get(observed.board),2,'one search assessment plus independent final certificate replay');
 const r=R.replay(state,a.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],JSON.parse(JSON.stringify(a.continuation[0].event)));
});
test('opening raw facts: cache lifetime ends with the request and caller board changes do not reuse stale facts',()=>{
 const O=load(P),state=R.createState({active:'O',queue:['I','L','J','T','S','Z']}),options={deadline:Infinity,maxNodes:12000,openingDepth:1};
 const first=O.plan(state,options);state.board[39]='IIII......';const changed=O.plan(state,options);
 assert.notDeepEqual(clean(changed),clean(first));state.board[39]='..........';
 assert.deepEqual(clean(O.plan(state,options)),clean(first));assert.equal(state.board[39],'..........');
});
