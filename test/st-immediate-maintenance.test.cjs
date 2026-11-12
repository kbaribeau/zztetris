'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),C=require('../st-obligation-context'),PH=require('../st-pattern-history'),U=require('../st-obligation-inverse');
const fixture=require('./fixtures/immediate-maintenance-m01.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const bounds={depth:null,maxNodes:6000,timeMs:undefined,deadline:Infinity,now:()=>0,width:8};
function player(){
 let position=R.createState(fixture.observation),current=C.importState(fixture.options.obligationContext,{position}),pattern=copy(fixture.options.patternHistory),last;
 return{get position(){return position;},get current(){return current;},get pattern(){return pattern;},get last(){return last;},
  act(action){const before=position;position=R.move(position,action);last=C.applyActual(current,{before,action,after:position});current=last.context;if(action==='HD')pattern=PH.update(pattern,before,position,position.lastEvent);return last;},
  lock(witness){for(const action of witness)this.act(action);},
  options(extra={}){return{...bounds,openingPhase:false,patternHistory:pattern,obligationContext:C.exportState(current),...extra};}};
}
function checked(a,kind){
 assert.ok(a.target,a.reason);assert.equal(a.recommendation.kind,'immediate');
 assert.equal(a.evidence.immediatePlacement.kind,kind);assert.equal(a.evidence.immediatePlacement.followUp,'not-certified');
 assert.equal(a.metrics.certifiedHorizon,0);assert.equal(a.metrics.legalHorizon,1);assert.equal(a.continuation.length,1);
 assert.ok(a.metrics.nodes<=bounds.maxNodes);assert.match(a.reason,/follow.?up|remaining|next|immediate/i);
}
function replay(a,p){const r=R.replay(p.position,a.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[a.continuation[0].event]);assert.equal(r.state.topOut,false);return r;}

test('immediate maintenance: M01 cap survives incomplete repair search without claiming a full continuation',()=>{
 const p=player(),a=P.decide(p.position,p.options());checked(a,'right-Z-cap');
 const r=replay(a,p);assert.equal(r.events[0].type,'Z');assert.equal(r.events[0].lines,0);assert.ok(r.events[0].cells.every(([x])=>x>=7));
 assert.deepEqual(r.events[0].cells.slice().sort(),fixture.knownSequence[0].event.cells.slice().sort());
});

test('immediate maintenance: actual Z preserves pending L and accounting through JSON and inverse Undo',()=>{
 const p=player(),a=P.decide(p.position,p.options());checked(a,'right-Z-cap');
 const initial=p.current,position=copy(p.position),before=C.resolve(initial,{position}),session=U.start(initial);
 assert.equal(before.center.pending.length,1);assert.equal(before.center.pending[0].family,'SL');
 p.lock(a.witness);const after=C.resolve(p.current,{position:p.position});
 assert.equal(after.center.pending.length,1);assert.deepEqual(after.center.pending,before.center.pending);assert.deepEqual(after.hangingL,before.hangingL);
 assert.equal(after.extraZ.remaining,before.extraZ.remaining);assert.equal(after.availability,'known');
 const restored=C.importState(copy(C.exportState(p.current)),{position:p.position});assert.deepEqual(restored,p.current);
 const receipt=U.record(session,{before:initial,after:p.current,piece:p.last.receipt.locked}).receipt;
 const undo=U.undo(session,p.current,{receipt,piece:receipt.piece,requestEpoch:U.status(session).requestEpoch+1,restore:raw=>C.importState(raw,{position})});
 assert.deepEqual(undo.state,initial);
});

test('immediate maintenance: literal recorded TSD is eligible without requiring a rebuild certificate',()=>{
 // Replay the already recorded development continuation. This is a fixed
 // seven-placement regression, not a simulation or hidden-piece experiment.
 const p=player();for(const step of fixture.knownSequence.slice(0,6))p.lock(step.witness);
 const probe=P.decide(p.position,p.options());
 assert.equal(probe.metrics.immediateMaintenance.checked,1);
 // Leave exactly the measured local-check allowance, no deeper-search budget.
 const a=P.decide(p.position,p.options({maxNodes:probe.metrics.immediateMaintenance.nodes}));checked(a,'T-spin-double');const r=replay(a,p);
 assert.equal(r.events[0].type,'T');assert.equal(r.events[0].spin,'full');assert.equal(r.events[0].lines,2);
 assert.ok(r.events[0].cells.every(([x])=>x>=6));
});

test('immediate maintenance: moved pose and HOLD revalidation recheck local facts',()=>{
 const p=player(),a=P.decide(p.position,p.options());checked(a,'right-Z-cap');
 const action=a.witness[0];p.act(action);
 const advanced=P.advance(p.position,a,action,p.options());assert.ok(advanced);checked(advanced,'right-Z-cap');replay(advanced,p);
 const rechecked=P.revalidate(p.position,advanced,p.options());assert.ok(rechecked);checked(rechecked,'right-Z-cap');replay(rechecked,p);
});

test('immediate maintenance: no fast admission for opening, unknown account or zero budget',()=>{
 const p=player();
 for(const extra of [{openingPhase:true},{obligationContext:C.exportState(C.start(p.position))},{maxNodes:0},{deadline:0}]){
  const a=P.decide(p.position,p.options(extra));assert.notEqual(a.recommendation?.kind,'immediate');assert.equal(a.evidence?.immediatePlacement,undefined);
 }
});

test('immediate maintenance: copied immediate evidence cannot authorize a different piece or position',()=>{
 const p=player(),a=P.decide(p.position,p.options());checked(a,'right-Z-cap');
 const unrelated=copy(a),r=R.replay(p.position,['HD']);assert.equal(r.valid,true);assert.equal(r.events[0].type,'Z');assert.ok(r.events[0].cells.some(([x])=>x<7));
 unrelated.continuation[0]={...unrelated.continuation[0],witness:['HD'],event:r.events[0],target:r.events[0].target};unrelated.target=r.events[0].target;unrelated.witness=['HD'];assert.equal(P.revalidate(p.position,unrelated,p.options()),null);
 const forged=copy(a);forged.continuation[0].event.type='I';assert.equal(P.revalidate(p.position,forged,p.options()),null);
 p.act('L');assert.equal(P.revalidate(p.position,a,p.options()),null,'A new pose cannot trust the old witness or local certificate');
});

test('immediate maintenance: active reset and incomplete root enumeration are ineligible',()=>{
 const p=player(),reset=C.beginReset(p.current,{position:p.position,candidate:true}).context;
 assert.equal(C.resolve(reset,{position:p.position}).reset.status,'active');
 for(const extra of [{obligationContext:C.exportState(reset)},{maxNodes:1}]){
  const a=P.decide(p.position,p.options(extra));assert.notEqual(a.recommendation?.kind,'immediate');assert.equal(a.evidence?.immediatePlacement,undefined);
 }
});

test('immediate maintenance: disabled HOLD cannot access or retain a held cap Z',()=>{
 const p=player();p.act('HOLD');assert.equal(p.position.hold,'Z');
 const unavailable=P.decide(p.position,p.options({allowHold:false}));assert.notEqual(unavailable.recommendation?.kind,'immediate');
 const a=P.decide(p.position,p.options({maxNodes:2000}));checked(a,'right-Z-cap');assert.ok(a.witness.includes('HOLD'));
 assert.equal(P.revalidate(p.position,a,p.options({allowHold:false})),null);
});

test('immediate maintenance: expired revalidation budget cannot renew a local certificate',()=>{
 const p=player(),a=P.decide(p.position,p.options());checked(a,'right-Z-cap');
 assert.equal(P.revalidate(p.position,a,p.options({deadline:undefined,timeMs:0})),null);
 assert.equal(P.revalidate(p.position,a,p.options({maxNodes:0})),null);
});
