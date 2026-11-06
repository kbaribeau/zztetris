'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),T=require('../st-resource-tracking');
const copy=x=>JSON.parse(JSON.stringify(x));
function fresh(types=['S','L','I','J','O','T','Z']){
 let state=R.createState({active:types[0],queue:types.slice(1),streamCursor:1}),history=H.start(state,{fresh:true});
 const events=[],monitor=T.create();monitor.subscribe(e=>events.push(e));
 return{events,monitor,get state(){return state;},get history(){return history;},get summary(){return H.resolve(state,history);},
  play(witness){for(const action of witness){const before=state,prior=history;state=R.move(state,action);assert.notEqual(state,before);history=H.applyAction(history,before,action,state);if(action==='HD')monitor.executedLock(before,prior,state,history,state.lastEvent);}},
  handoff(){const before=H.resolve(state,history);history=H.markHandoff(history,state);monitor.transition(before,H.resolve(state,history),{stage:'handoff'});},
 };
}
const left=['L','L','L','HD'];
test('tracking events: actual creation, exact payment and carried uncertainty stay silent',()=>{
 for(const types of [['S','L','I','J','O','T','Z'],['L','S','I','J','O','T','Z']]){
  const a=fresh(types);a.play(left);assert.equal(a.summary['hanging'+types[1]].evidence.length,1);a.play(left);assert.equal(a.summary['hanging'+types[1]].evidence.length,0);assert.deepEqual(a.events,[]);
 }
 const a=fresh();a.play(left);a.play(['HD']);assert.equal(a.summary.hangingL.unclassified[0].lId,2);assert.deepEqual(a.events,[]);
});
test('tracking events: loss of known or uncertain S/L is detected once until recovered',()=>{
 for(const kind of ['S','L'])for(const unknown of [false,true]){
  const a=fresh(kind==='L'?['S','L','I','J','O','T','Z']:['L','S','I','J','O','T','Z']);a.play(left);
  let before=a.summary;if(unknown){before=copy(before);before['hanging'+kind].unclassified=before['hanging'+kind].evidence;before['hanging'+kind].evidence=[];}
  const broken=copy(before);broken['hanging'+kind].evidence=[];broken['hanging'+kind].unclassified=[];
  a.monitor.check(before,broken);a.monitor.check(before,broken);assert.equal(a.events.length,1);assert.equal(a.events[0].code,'obligation-lost');assert.equal(a.events[0].identity.type,kind);
  a.monitor.check(before,before);a.monitor.check(before,broken);assert.equal(a.events.length,2,'A newly recurring loss is a new event');
 }
});
test('tracking events: handoff preserves unused identities but explicitly exempts consumed opening partners',()=>{
 const a=fresh();a.play(left);const before=a.summary;a.handoff();assert.equal(a.summary.hangingL.evidence[0].lId,2);assert.deepEqual(a.events,[]);
 const broken=copy(a.summary);broken.hangingL.evidence=[];a.monitor.check(before,broken,{stage:'handoff'});assert.equal(a.events[0].code,'obligation-lost');
 const b=fresh();b.play(left);b.play(['HD']);assert.equal(b.summary.hangingL.unclassified.length,1);b.handoff();assert.equal(b.summary.hangingL.unclassified.length,0);assert.deepEqual(b.events,[]);
});
test('tracking events: one-lock projection mismatch is independently injected, deduplicated and observational',()=>{
 const a=fresh();a.play(left);const before=a.summary,projected=M.start(a.state,before),saved=copy(before);projected.hangingL=[];
 a.monitor.check(before,before,{projected});a.monitor.transition(before,before,{stage:'reset'});a.monitor.check(before,before,{projected});assert.equal(a.events.length,1);assert.equal(a.events[0].code,'projection-mismatch');assert.equal(a.events[0].identity.field,'hangingL');assert.deepEqual(before,saved);
 const unsubscribe=a.monitor.subscribe(()=>assert.fail('unsubscribed listener called'));unsubscribe();a.monitor.check(before,before);
});
test('tracking events: authentic S85 and Reset L37 public locks match despite uncertainty',()=>{
 for(const f of require('./fixtures/resource-projection-history.json').cases){
  let state=R.createState(f.observation),history=H.importContext(state,f.resourceContext);assert.equal(history.coverage.status,'complete');const events=[],monitor=T.create();monitor.subscribe(e=>events.push(e));
  for(const action of f.witness){const before=state,prior=history;state=R.move(state,action);history=H.applyAction(history,before,action,state);if(action==='HD')monitor.executedLock(before,prior,state,history,state.lastEvent);}
  assert.deepEqual(events,[]);assert.ok(H.resolve(state,history).hangingS.unclassified.length||H.resolve(state,history).hangingL.unclassified.length);
 }
});
test('tracking events: closed Center obligations are not erased, and missing closure is caught',()=>{
 const a=fresh(),before=a.summary;before.center.pending=[{id:'piece-8',rootId:8,family:'SL',createdAt:2,alternatives:[]}];const after=copy(before);after.center.pending=[];after.center.closed=[{...before.center.pending[0],status:'invalidated',at:3}];a.monitor.check(before,after);assert.deepEqual(a.events,[]);after.center.closed=[];a.monitor.check(before,after);assert.equal(a.events[0].code,'center-obligation-lost');
});
test('tracking events: unavailable coverage emits one diagnostic, not fictitious per-piece losses',()=>{
 const a=fresh();a.play(left);const before=a.summary,after={coverage:{status:'truncated',reason:'History limit'},locks:2};a.monitor.check(before,after);a.monitor.check(before,after);assert.equal(a.events.length,1);assert.equal(a.events[0].code,'coverage-degraded');assert.equal(T.status(after).obligations,null);
 const partial=H.resolve(a.state,H.start(a.state));a.monitor.check(partial,partial);assert.equal(a.events.length,1);assert.equal(T.status(partial).obligations.hangingL.status,'unknown');
});
test('tracking status: compact snapshot distinguishes unknown balances, live identities and missing status',()=>{
 const a=fresh();a.play(left);const s=T.status(a.summary);assert.equal(s.scope,'current');assert.equal(s.throughLock,1);assert.equal(s.coverage.status,'complete');assert.equal(s.obligations.extraZ.remaining,null);assert.equal(s.obligations.hangingL.known[0].lId,2);assert.equal(s.allocations,undefined);assert.equal(s.pairs,undefined);assert.equal(s.observation,undefined);
 const missing=T.status(null,{scope:'unavailable',reason:'Killed before retained lock'});assert.equal(missing.obligations,null);assert.equal(missing.throughLock,null);s.obligations.hangingL.known.length=0;assert.equal(a.summary.hangingL.evidence.length,1);
});
test('tracking events: Extra-Z allocation conservation is separate from source-profile status',()=>{
 const a=fresh(),before=a.summary;before.extraZ={status:'available',baseline:{at:1},allocations:[],remaining:1};const after=copy(before);after.extraZ.status='out-of-profile';a.monitor.check(before,after);assert.deepEqual(a.events,[]);after.extraZ.remaining=2;a.monitor.check(before,after);assert.equal(a.events[0].code,'extra-z-balance-mismatch');after.extraZ.baseline=null;a.monitor.check(before,after);assert.equal(a.events[1].code,'extra-z-baseline-lost');
});

test('tracking events: failing observers and checks cannot interrupt actual-state handling',()=>{
 const a=fresh();a.play(left);const before=a.summary,broken=copy(before);broken.hangingL.evidence=[];a.monitor.subscribe(()=>{throw Error('Consumer failed');});assert.doesNotThrow(()=>a.monitor.check(before,broken));assert.deepEqual(a.events.map(e=>e.code),['obligation-lost','tracking-observer-failed']);assert.deepEqual(a.summary,before);assert.equal(a.monitor.health().status,'failed');
 a.monitor.subscribe(()=>{throw null;});a.monitor.check(before,before);assert.doesNotThrow(()=>a.monitor.check(before,broken));assert.equal(a.events.at(-1).code,'tracking-observer-failed');
 const bad=copy(before);bad.observedSL={};assert.doesNotThrow(()=>a.monitor.check(bad,before));assert.equal(a.events.at(-1).code,'tracking-check-failed');
 a.play(['HD']);assert.equal(a.summary.locks,2);assert.equal(a.summary.hangingL.unclassified[0].lId,2);
});

test('tracking events: conserved actual Reset credits cannot disappear behind a consistent new balance',()=>{
 const a=fresh(),before=a.summary;before.reset.credits=[{pieceId:8,bag:1,at:8}];before.extraZ={status:'available',baseline:{at:1},allocations:[],remaining:2};const after=copy(before);after.reset.credits=[];after.extraZ.remaining=1;a.monitor.check(before,after);assert.equal(a.events.length,1);assert.equal(a.events[0].code,'reset-credit-lost');
});

test('tracking events: exact allocation mutations and duplicate projected identities cannot hide behind matching IDs',()=>{
 const a=fresh();a.play(left);const before=a.summary,after=copy(before);after.allocations[0].region='center';a.monitor.check(before,after);assert.equal(a.events[0].code,'allocation-history-changed');const projected=M.start(a.state,before);projected.hangingL.push({...projected.hangingL[0]});a.monitor.check(before,before,{projected});assert.equal(a.events[1].code,'projection-mismatch');assert.equal(a.events[1].details.projectedCount,2);assert.equal(a.events[1].details.actualCount,1);
});

test('tracking events: actual resource history limit reports coverage loss at the executed lock, not a generic check error',()=>{
 const a=fresh();a.play(left);while(a.history.actions<H.limits.actions)a.play([a.history.actions%2?'CCW':'CW']);assert.equal(a.history.locks,1);a.play(['HD']);assert.equal(a.history.coverage.status,'truncated');assert.equal(a.events.length,1);assert.equal(a.events[0].code,'coverage-degraded');assert.equal(a.events[0].lock,2);assert.equal(T.status(a.summary,{throughLock:2}).obligations,null);
});

test('tracking events: a failed sole subscriber leaves explicit unhealthy instrumentation',()=>{const a=fresh();a.play(left);const monitor=T.create(),before=a.summary,broken=copy(before);broken.hangingL.evidence=[];monitor.subscribe(()=>{throw undefined;});assert.doesNotThrow(()=>monitor.check(before,broken));assert.equal(monitor.health().status,'failed');assert.equal(monitor.health().firstFailure.lock,1);});
