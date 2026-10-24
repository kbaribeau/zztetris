'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),A=require('../st-access'),F=require('./support/st-gap-phase.json');
function replayWitnesses(board,proof){const hit=new Set();for(const w of proof.witnesses){const r=R.replay(R.createState({board,active:w.piece,queue:['I']}),w.witness);assert.ok(r.valid);assert.equal(r.events.length,1);assert.deepEqual(r.events[0].target,w.target);for(const c of w.cells){assert.ok(r.events[0].cells.some(d=>d[0]===c[0]&&d[1]===c[1]));hit.add(c.join(','));}}if(proof.reachable)for(const c of proof.cells)assert.ok(hit.has(c.join(',')));}
function exhaustive(board,cells){const missing=new Set(cells.map(c=>c.join(',')));for(const type of 'IJLOSTZ'){const e=R.placements(R.createState({board,active:type,queue:['I']}),{allowHold:false,maxNodes:30000});assert.ok(e.complete);for(const p of e.placements)for(const c of p.event.cells)missing.delete(c.join(','));if(!missing.size)return true;}return false;}
test('movement enumeration distinguishes predicate success from exhaustive graph completion and preserves default outputs',()=>{
 const s=R.createState({active:'I',queue:['O']});const full=R.placements(s,{allowHold:false}),observed=R.placements(s,{allowHold:false,stopWhen:()=>false});assert.deepEqual(observed,full);
 const early=R.placements(s,{allowHold:false,stopWhen:()=>true});assert.equal(early.complete,false);assert.equal(early.stopReason,'placement-predicate');assert.equal(early.visited,1);assert.deepEqual(early.placements,[full.placements[0]]);assert.ok(early.visited<full.visited);
});
test('access stops on complete actual per-cell witnesses without claiming joint repair',()=>{
 const board=R.emptyBoard(),cells=[[0,39],[9,39]];A.clearCache();const p=A.access(board,cells);assert.equal(p.reachable,true);assert.equal(p.complete,true);assert.ok(p.witnesses.length>=2);replayWitnesses(board,p);assert.equal(p.reachable,exhaustive(board,cells));
 const s=F.gap.observation,bad=R.replay(s,F.gap.witness).state.board;A.clearCache();const negative=A.access(bad,[[2,37]]);assert.equal(negative.reachable,false);assert.equal(negative.complete,true);assert.equal(negative.reachable,exhaustive(bad,[[2,37]]));assert.equal(negative.visited,1603);
 A.clearCache();const positive=A.access(s.board,[[2,37]]);replayWitnesses(s.board,positive);assert.equal(positive.reachable,true);assert.ok(positive.visited<573);
});
test('partial witnessed targets at a node limit remain unknown and are never cached as complete',()=>{
 const board=R.emptyBoard(),cells=[[3,39],[9,39]];A.clearCache();const partial=A.access(board,cells,{maxNodes:1});assert.equal(partial.reachable,null);assert.equal(partial.complete,false);assert.equal(partial.visited,1);assert.ok(partial.witnesses.length);assert.deepEqual(partial.unreachable,[]);replayWitnesses(board,partial);
 const complete=A.access(board,cells);assert.equal(complete.reachable,true);assert.equal(complete.cached,undefined);replayWitnesses(board,complete);
});
