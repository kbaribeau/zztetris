'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../scripts/lib/st-simulation.cjs'),R=require('../st-rules'),P=require('../st-planner');
const api={...P,startOpeningSession:()=>({active:true,clear:null}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,advance:()=>null,cycleResources:()=>({tsds:0,quads:0,pocket:0,centerCompletions:0})};
function advice(state,witness){const proof=R.replay(state,witness);assert.ok(proof.valid);return{status:'test-only',target:proof.events[0].target,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,continuation:[],evidence:{opening:true}};}
test('public inventory/simulation: actual HOLD and lock consume the controller-owned public subjects without protocol duplication',()=>{
 const session=E.createSession(E.makeInput('empty',123,3),api),initial=session.publicInventory;
 const effects=[];session.onObligationEffect(effect=>effects.push(effect));session.execute(advice(session.state,['HOLD','HOLD','HD']));
 const after=session.publicInventory;assert.equal(after.hold.id,initial.queue[0].id);assert.equal(after.active.id,initial.queue[1].id);assert.equal(after.nextId,initial.nextId+2);assert.equal(effects.find(x=>x.operation.kind==='lock').operation.piece.id,initial.active.id);
 assert.deepEqual(after.queue.map(p=>p.id),session.resources.instances.queue.map(p=>p.id));
 const request=session.request(1,E.CONFIG);for(const key of ['inventory','publicInventory','inventoryTransition']){assert.equal(key in request,false);assert.equal(key in request.observation,false);assert.equal(key in request.options,false);}
 const copy=session.publicInventory;copy.queue[0].id=-1;assert.notEqual(session.publicInventory.queue[0].id,-1);
});
test('public inventory/simulation: past the former action cap preserves the actual lock, draws and continuing inventory',()=>{
 const session=E.createSession(E.makeInput('empty',123,4),api),initial=session.publicInventory,events=[];session.onTrackingEvent(event=>events.push(event));
 const witness=Array.from({length:4100},(_,i)=>i%2?'CCW':'CW').concat('HD'),actual=session.execute(advice(session.state,witness),{lock:1});
 assert.equal(session.resources.availability,'known');assert.ok(actual.event);assert.equal(actual.actions.length,4101);assert.equal(session.publicInventory.active.id,initial.queue[0].id);assert.equal(session.publicInventory.nextId,initial.nextId+1);assert.equal(session.cursor,1);assert.deepEqual(events,[]);
 const before=session.publicInventory;session.execute(advice(session.state,['HOLD','HD']),{lock:2});assert.equal(session.publicInventory.hold.id,before.active.id);assert.equal(session.publicInventory.nextId,before.nextId+2);assert.equal(session.cursor,3);assert.equal(session.resources.availability,'known');
});

test('public inventory/simulation: unavailable imported accounting advances current inventory without restarting',()=>{
 const Context=require('../st-obligation-context'),input=E.makeInput('empty',123,3),snapshot=Context.exportState(Context.start(input.initial,{fresh:true}));
 Object.assign(snapshot,{status:'unavailable',state:null,reason:'Injected unavailable current account'});input.obligationContext=snapshot;
 const session=E.createSession(input,api),before=session.publicInventory;session.execute(advice(session.state,['HOLD','HD']));
 assert.equal(session.obligationContext.status,'unavailable');assert.equal(session.obligationContext.state,null);assert.equal(session.obligationContext.reason,snapshot.reason);
 assert.equal(session.publicInventory.nextId,before.nextId+2);assert.equal(session.actualLocks,1);assert.equal(session.cursor,2);
 assert.equal('resourceContext'in session.request(2,E.CONFIG).options,false);
});
