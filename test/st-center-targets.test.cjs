'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),F=require('../st-fixtures'),LR=require('../st-left-routes');
const signature=p=>JSON.stringify([p.event.type,p.event.cells.slice().sort(),p.event.spin,p.state.hold,p.state.queue,p.state.streamCursor]);
const pure=p=>p.event.cells.every(([x])=>x>=4&&x<=6);
function replay(s,result){for(const p of result.placements){const r=R.replay(s,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.state,p.state);assert.deepEqual(r.events,[p.event]);}}

test('center targets preserve every eligible pure Center outcome across reviewed fixtures and HOLD policies',()=>{
 let checked=0;
 for(const f of F.list)for(const type of 'IJLOSTZ')for(const allowHold of [false,true]){
  const s=R.createState({...f.observation,active:type,hold:'L',queue:['Z','O']});
  const targets=S.centerTargets(s.board);if(targets===null)continue;
  const full=R.placements(s,{allowHold,maxNodes:40000});assert.equal(full.complete,true);
  const eligible=p=>pure(p)&&!p.event.lines&&P.ordinaryCenterEligible(s,p);
  const expected=new Set(full.placements.filter(eligible).map(signature));
  const direct=R.targetedPlacements(s,targets,{allowHold,directOnly:true});
  replay(s,direct);assert.equal(direct.fallbackNodes,0);
  assert.deepEqual(new Set(direct.placements.filter(eligible).map(signature)),expected,`${f.id}, ${type}, allowHold=${allowHold}`);checked++;
 }
 assert.ok(checked>100);
});

test('center targets directly replay J-first Z slide with actual active and held Z',()=>{
 const initial=R.createState({board:F.get('cap-rebuild').observation.board,active:'J',queue:['Z']});
 const j=R.replay(initial,['CW','HD']);assert.equal(j.valid,true);
 const targets=S.centerTargets(j.state.board),z=targets.find(t=>t.type==='Z'&&t.witness.includes('SD'));
 assert.ok(z);assert.ok(z.witness.includes('L'));
 for(const allowHold of [false,true]){
  const s=R.createState({...j.state,active:allowHold?'O':'Z',hold:allowHold?'Z':null,queue:['I']});
  const result=R.targetedPlacements(s,[z],{allowHold,directOnly:true});
  assert.equal(result.complete,true);assert.equal(result.placements.length,1);assert.equal(result.fallbackNodes,0);replay(s,result);
  assert.equal(result.placements[0].holdCount,allowHold?1:0);
 }
});

test('center template inventory retains non-Center and boundary-crossing candidate geometry',()=>{
 const state=R.createState({...F.get('cap-rebuild').observation,active:'J',hold:'O'});
 const accept=p=>!pure(p),old=LR.landingTargets(state,accept),next=LR.landingTargets(state,accept,{centerTemplates:true});
 assert.equal(old.complete,true);assert.equal(next.complete,true);
 const key=t=>JSON.stringify([t.type,t.x,t.y,t.rotation,t.spin]);
 assert.deepEqual(new Set(next.targets.map(key)),new Set(old.targets.map(key)));
});

test('center targets leave advanced OSIO partial to generic inventory instead of dropping its I',()=>{
 const rows=['XXXX......','XXXX......','XXXX......','XXXX......','XXXX......','XXXX.....X','XXXXXXX.XX','XXXXXXX.X.'];
 let state=R.createState({board:[...Array(32).fill('..........'),...rows],active:'O',queue:['S','I','O'],canHold:false});
 for(const actions of [['HD'],['R','CW','HD']]){const r=R.replay(state,actions);assert.equal(r.valid,true);state=r.state;}
 const played=R.replay(state,['L','CW','HD']);assert.equal(played.valid,true);
 const p={state:played.state,event:played.events[0]};assert.equal(P.ordinaryCenterEligible(state,p),true);
 const targets=S.centerTargets(state.board);
 assert.ok(targets===null||targets.some(t=>t.type==='I'&&JSON.stringify(t.cells.slice().sort())===JSON.stringify(p.event.cells.slice().sort())), 'must fallback or retain the existing eligible I');
 const collected=LR.landingTargets(state,q=>pure(q)&&P.ordinaryCenterEligible(state,q),{allowHold:false,centerTemplates:true});
 const reached=R.targetedPlacements(state,collected.targets,{allowHold:false});
 assert.ok(reached.placements.some(q=>signature(q)===signature(p)));replay(state,reached);
});

test('center targets fallback when blocked fresh spawn hides an actual moved S landing',()=>{
 const board=F.get('cap-rebuild').observation.board.slice();
 board[19]=board[19].slice(0,3)+'X'+board[19].slice(4);
 const state=R.createState({board,active:{type:'S',x:4,y:23,rotation:0,lastRotation:null},hold:null,queue:[]});
 assert.deepEqual(R.validate(state),[]);assert.equal(R.fits(board,R.spawn('S')),false);
 const played=R.replay(state,['HD']);assert.equal(played.valid,true);
 const p={state:played.state,event:played.events[0]};assert.equal(P.ordinaryCenterEligible(state,p),true);
 assert.equal(S.centerTargets(board),null,'blocked hypothetical spawn cannot certify complete center inventory');
 const accept=q=>pure(q)&&!q.event.lines&&P.ordinaryCenterEligible(state,q);
 const inventory=LR.landingTargets(state,accept,{allowHold:false,centerTemplates:true});
 assert.equal(inventory.complete,true);
 const actual=R.targetedPlacements(state,inventory.targets,{allowHold:false});
 assert.ok(actual.placements.some(q=>signature(q)===signature(p)));replay(state,actual);
});

test('center templates retain generic inventory for a non-spawn active pose',()=>{
 for(const active of [
  {type:'S',x:4,y:23,rotation:0,lastRotation:null},
  {type:'Z',x:4,y:22,rotation:1,lastRotation:{from:0,to:1,kickIndex:0}}
 ]){
  const state=R.createState({board:F.get('cap-rebuild').observation.board,active,hold:'L',queue:['O']});
  assert.deepEqual(R.validate(state),[]);assert.ok(S.centerTargets(state.board));
  const accept=()=>true;
  const before=LR.landingTargets(state,accept),after=LR.landingTargets(state,accept,{centerTemplates:true});
  assert.equal(before.complete,true);assert.equal(after.complete,true);
  assert.deepEqual(after.targets,before.targets,'moved active must use unchanged generic inventory');
  assert.equal(after.visited,before.visited);
 }
});
