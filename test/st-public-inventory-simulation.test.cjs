'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/lib/st-simulation.cjs'),R=require('../st-rules'),P=require('../st-planner');
const api={...P,startOpeningSession:()=>({active:true,clear:null}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,advance:()=>null,cycleResources:()=>({tsds:0,quads:0,pocket:0,centerCompletions:0})};
function advice(state,witness){const proof=R.replay(state,witness);assert.ok(proof.valid);return{status:'test-only',target:proof.events[0].target,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,continuation:[],evidence:{opening:true}};}
test('public inventory/simulation: actual HOLD and lock consume the controller-owned public subjects without protocol duplication',()=>{
 const session=E.createSession(E.makeInput('empty',123,3),api),initial=session.publicInventory;
 session.execute(advice(session.state,['HOLD','HOLD','HD']));
 const after=session.publicInventory;assert.equal(after.hold.id,initial.queue[0].id);assert.equal(after.active.id,initial.queue[1].id);assert.equal(after.nextId,initial.nextId+2);assert.equal(session.resources.allocations[0].pieceId,initial.active.id);
 assert.deepEqual(after.queue.map(p=>p.id),session.resources.instances.queue.map(p=>p.id));
 const request=session.request(1,E.CONFIG);for(const key of ['inventory','publicInventory','inventoryTransition']){assert.equal(key in request,false);assert.equal(key in request.observation,false);assert.equal(key in request.options,false);}
 const copy=session.publicInventory;copy.queue[0].id=-1;assert.notEqual(session.publicInventory.queue[0].id,-1);
});
test('public inventory/simulation: real action coverage failure preserves the actual lock, draws and continuing inventory',()=>{
 const session=E.createSession(E.makeInput('empty',123,4),api),initial=session.publicInventory,events=[];session.onTrackingEvent(event=>events.push(event));
 const witness=Array.from({length:4100},(_,i)=>i%2?'CCW':'CW').concat('HD'),actual=session.execute(advice(session.state,witness),{lock:1});
 assert.equal(session.resources.coverage.status,'truncated');assert.ok(actual.event);assert.equal(actual.actions.length,4101);assert.equal(session.publicInventory.active.id,initial.queue[0].id);assert.equal(session.publicInventory.nextId,initial.nextId+1);assert.equal(session.cursor,1);assert.ok(events.some(e=>e.code==='coverage-degraded'));
 const before=session.publicInventory;session.execute(advice(session.state,['HOLD','HD']),{lock:2});assert.equal(session.publicInventory.hold.id,before.active.id);assert.equal(session.publicInventory.nextId,before.nextId+2);assert.equal(session.cursor,3);assert.equal(session.resources.coverage.status,'truncated');
});
