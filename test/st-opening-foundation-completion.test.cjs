'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),O=require('../st-opening');
const f=require('./support/st-known-foundation-completion.json');
test('opening completion: balanced top pattern cannot retire known buried Center debt',()=>{
 assert.equal(O.repairCertificate(f.origin,f.steps),null);
 assert.equal(O.checkedRepair(f.proof,f.suffixObservation),null);
 let state=f.origin;for(const p of f.steps){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);state=r.state;}
 assert.equal(O.balance(state.board),0);assert.equal(S.geometry(state.board).center.status,'level');
 assert.deepEqual(O.facts(state.board).buriedCenterVacancies,[[6,29],[6,30]]);
 assert.equal(O.goalPaid(f.origin,f.steps,{balance:true,center:null}),false);
});
test('opening completion: actual temporary foundation gap may be filled before the endpoint',()=>{
 const {origin,steps}=f.temporary;let state=origin;
 for(const p of steps){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);state=r.state;}
 const intermediate=R.replay(origin,steps[0].witness).state;
 assert.equal(O.repairEndpoint(intermediate.board),false);assert.equal(O.repairEndpoint(state.board),true);
 assert.equal(O.goalPaid(origin,steps.slice(0,1),{balance:false,center:null}),false);
 assert.equal(O.goalPaid(origin,steps,{balance:false,center:null}),true);
});
test('opening completion: unknown phase is not an aligned foundation and cannot erase inherited evidence',()=>{
 let state=f.origin;for(const p of f.steps)state=R.replay(state,p.witness).state;
 const pattern=S.notchPattern(state.board),unanchored=state.board.map(r=>r.slice(0,7)+'...');unanchored[39]=unanchored[39].slice(0,7)+'J..';
 assert.equal(S.notchPattern(unanchored).status,'unanchored');
 assert.equal(O.facts(unanchored).centerFoundationStatus,'unknown-phase');
 assert.equal(O.facts(unanchored,pattern).centerFoundationStatus,'unfinished-lower-foundation');
 assert.equal(O.repairEndpoint(unanchored,pattern),false);
 const unknownOrigin={...f.origin,board:f.origin.board.map(r=>r.slice(0,7)+'...')};unknownOrigin.board[39]=unknownOrigin.board[39].slice(0,7)+'J..';
 let replay=unknownOrigin;for(const step of f.steps){const r=R.replay(replay,step.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],step.event);replay=r.state;}
 assert.ok(O.repairCertificate(unknownOrigin,f.steps),'unknown phase supports only the finite top-pattern/parity claim');
 assert.equal(O.repairCertificate(unknownOrigin,f.steps,null,S.notchPattern(f.origin.board)),null,'known history cannot be downgraded to unknown during retention');
 const recolored=state.board.map(r=>r.replace(/[IJLOSTZ]/g,'J'));
 assert.deepEqual(O.facts(recolored).buriedCenterVacancies,O.facts(state.board).buriedCenterVacancies);
});

test('opening completion: advice reports known lower debt despite a level top',()=>{
 const P=require('../st-planner'),a=P.plan(f.origin,{openingPhase:true,maxNodes:15000,deadline:Infinity});assert.ok(a.target);assert.equal(a.evidence.opening.repair,null);assert.match(a.reason,/The lower Center still has unfilled cells/);assert.doesNotMatch(a.reason,/balanced Left minos and a level Center/);
});
