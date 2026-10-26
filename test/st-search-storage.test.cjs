'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules');

test('st-search-storage: compact frontiers keep HOLD roots, shortest witnesses and predicates',()=>{
 const start=R.move(R.createState({active:'T',hold:'I',queue:['O','S','Z']}),'L');
 const full=R.placements(start,{maxNodes:16000,now:()=>0});assert.equal(full.complete,true);
 for(const p of full.placements){const replay=R.replay(start,p.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,p.state);assert.equal(p.witness.at(-1),'HD');assert.equal(p.witness.filter(a=>a==='HOLD').length,p.holdCount);}
 const first=R.placements(start,{stopWhen:()=>true,now:()=>0});assert.equal(first.visited,1);assert.equal(first.stopReason,'placement-predicate');assert.deepEqual(first.placements[0].witness,['HD']);
 assert.equal(R.placements(start,{maxNodes:0,now:()=>0}).visited,0);
 assert.equal(R.placements(start,{deadline:1,now:()=>1}).visited,0);
 const prefix=R.placements(start,{maxNodes:3,now:()=>0});assert.equal(prefix.visited,3);assert.deepEqual(prefix.placements.map(p=>p.holdCount),[0,1,2]);
});
