'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),LR=require('../st-left-routes'),S=require('../st-structure');
const fixture=require('./fixtures/immediate-maintenance-m01.json');
const key=p=>JSON.stringify([p.event.target,p.event.spin,p.state.hold,p.state.queue,p.state.streamCursor]);
function surface(heights,active,hold=null){const s=R.createState({active,hold,queue:['J','O','L']});s.board=s.board.map((row,y)=>heights.map(h=>y>=40-h?'X':'.').join('')+row.slice(4));return s;}
test('geometric target inventory covers every ordinary witnessed landing, including holes and T spin classes',()=>{
 for(const state of [surface([0,0,1,1],'O'),surface([2,0,0,0],'J','L'),R.createState(fixture.observation)]){
  const full=R.placements(state,{maxNodes:100000});assert.ok(full.complete);
  const geometry=LR.landingTargets(state,()=>true);assert.ok(geometry.complete);
  for(const p of full.placements)assert.ok(geometry.targets.some(t=>JSON.stringify({type:t.type,x:t.x,y:t.y,rotation:t.rotation})===JSON.stringify(p.event.target)&&t.spin===p.event.spin),JSON.stringify(p.event));
 }
});
test('lookup-directed landings preserve every progress-compatible outcome without accepting unreachable geometry',()=>{
 for(const state of [surface([0,0,1,1],'O'),surface([1,1,0,0],'J'),surface([2,0,0,0],'O')]){
  const root=LR.prepare(state,{center:{},right:{},allowHold:false});assert.ok(root.routes.length);
  const accepts=p=>LR.permits(root,root.progress,state,p);
  const geometry=LR.landingTargets(state,accepts,{allowHold:false});
  const targets=R.targetedPlacements(state,geometry.targets,{allowHold:false,maxNodes:100000});assert.ok(targets.complete);
  const full=R.placements(state,{allowHold:false,maxNodes:100000});
  assert.deepEqual(new Set(targets.placements.map(key)),new Set(full.placements.filter(accepts).map(key)));
  for(const p of targets.placements){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events,[p.event]);}
 }
});
test('target geometry obeys hard shared budget and complete does not mean full enumeration',()=>{
 const state=surface([1,1,0,0],'J');
 assert.equal(LR.landingTargets(state,()=>true,{maxNodes:0}).complete,false);
 assert.equal(LR.landingTargets(state,()=>true,{now:()=>10,deadline:10}).visited,0);
 const only=LR.landingTargets(state,p=>p.event.cells.every(([x])=>x<4),{allowHold:false});
 assert.ok(only.targets.length);assert.ok(only.targets.length<LR.landingTargets(state,()=>true,{allowHold:false}).targets.length);
});

test('geometry does not reject a HOLD landing using the pre-HOLD next spawn',()=>{
 const board=R.emptyBoard().map((row,y)=>y>=21?row.slice(0,6)+'X'+row.slice(7):row);
 const state=R.createState({board,active:'Z',queue:['I','O','T']});
 const played=R.replay(state,['HOLD','R','CW','HD']);
 assert.equal(played.valid,true);assert.equal(played.state.topOut,false);
 assert.equal(played.state.active.type,'O');
 assert.deepEqual(played.events[0].target,{type:'I',x:4,y:17,rotation:1});
 const geometry=LR.landingTargets(state,()=>true);
 const target=geometry.targets.find(t=>t.type==='I'&&t.x===4&&t.y===17&&t.rotation===1&&t.spin==='none');
 assert.ok(target,'held I must remain a candidate despite original queue head I colliding');
 const result=R.targetedPlacements(state,[target]);
 assert.ok(result.complete);assert.equal(result.placements.length,1);
 assert.equal(result.placements[0].state.active.type,'O');assert.equal(result.placements[0].state.topOut,false);
 assert.equal(R.replay(state,result.placements[0].witness).valid,true);
});
