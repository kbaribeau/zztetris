'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules'),Session=require('../st-session'),Context=require('../st-obligation-context');
const clone=x=>JSON.parse(JSON.stringify(x)),hidden={storage:{stGuideVisible:'false'}};
function selectEmpty(g){const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));}
function install(g,saved){g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/i);}
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(message){this.message=clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};return all;}
function hd(state,extra={}){const witness=['HD'],proof=R.replay(state,witness);return{target:proof.events[0].target,witness,hold:false,evidence:{opening:true},...extra};}

test('current lifecycle/page: native import trusts current duties and ignores conflicting old notch sidecars',()=>withPage('st-lab.html',hidden,g=>{
 const saved=clone(g.window.stLab.exportSession()),snapshot=saved.coaching.obligationContext;snapshot.inventory.nextId=200;
 snapshot.state.center.pending=[{id:'trusted-current-center',rootId:100,family:'OJ',alternatives:[{piece:'J',cells:[[4,20],[4,21],[5,21],[6,21]]}]}];
 snapshot.state.safety.coveredCells=[[1,25]];saved.coaching.patternHistory={origin:[],steps:[]};
 install(g,saved);assert.deepEqual(clone(g.window.stLab.resources.center),snapshot.state.center);assert.deepEqual(clone(g.window.stLab.resources.coveredRepair.cells),[[1,25]]);
 const exported=g.window.stLab.exportSession();assert.equal(exported.schemaVersion,2);assert.deepEqual(clone(exported.coaching.obligationContext),snapshot);
 for(const key of ['resourceContext','resourceHistory','resourceCoverage','resourceOriginBag'])assert.equal(key in exported.coaching,false);
 assert.equal('steps'in exported.coaching.obligationContext,false);
}));

test('current lifecycle/page: anonymous accommodation counts are shown without invented identities',()=>withPage('st-lab.html',hidden,g=>{
 selectEmpty(g);const saved=g.window.stLab.exportSession();saved.coaching.obligationContext.state.sl.uncertainty.L=[3];install(g,saved);
 const current=g.window.stLab.resources.hangingL;assert.equal(current.unclassifiedCount,3);assert.equal(current.unclassified.length,0);assert.deepEqual(clone(current.aggregate),[3]);
 assert.match(g.element('#st-hanging-l').getAttribute('aria-label'),/unresolved accommodation: 3; anonymous count: 3/);
 assert.match(g.element('#st-resource-summary').textContent,/Unclassified S\/L accommodation: 0\/3/);
 assert.match(g.element('#st-reset-summary').textContent,/Historical allocation-window diagnostics are unavailable/);
}));

test('current lifecycle/page: unavailable imported accounting advances HOLD and lock without restart',()=>withPage('st-lab.html',hidden,g=>{
 selectEmpty(g);const saved=g.window.stLab.exportSession();Object.assign(saved.coaching.obligationContext,{status:'unavailable',reason:'Unavailable imported accounting',state:null});install(g,saved);
 const before=g.window.stLab.publicInventory;g.window.stLab.act('HOLD');g.window.stLab.act('HD');
 assert.equal(g.window.stLab.obligationContext.status,'unavailable');assert.equal(g.window.stLab.obligationContext.state,null);assert.equal(g.window.stLab.publicInventory.hold.id,before.active.id);assert.equal(g.window.stLab.publicInventory.active.id,before.queue[1].id);
 assert.doesNotMatch(g.element('#st-hanging-s').getAttribute('aria-label'),/confirmed count: 0/);
 g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.publicInventory),clone(before));assert.equal(g.window.stLab.obligationContext.status,'unavailable');
}));

test('current lifecycle/page: accepted handoff after first input is undone with the original whole-turn checkpoint',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);selectEmpty(g);g.advance(40);const original=clone(g.window.stLab.obligationContext);
 g.window.stLab.act('HOLD');g.advance(40);const held=all.at(-1).message;
 // Controlled accepted phase change isolates marker/Undo timing, not admission.
 const prior=g.window.STPlanner;g.window.STPlanner={...prior,acceptOpeningResult:s=>({...s,active:false})};
 all.at(-1).respond(hd(held.observation));g.window.STPlanner=prior;
 assert.equal(g.window.stLab.obligationContext.state.sl.handoff,true);
 g.window.stLab.act('HD');g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.obligationContext),original);
 g.advance(40);const request=all.at(-1).message;assert.deepEqual(request.options.obligationContext,original);assert.equal(request.options.resourceContext,undefined);assert.equal(request.options.handoffRecovery,undefined);
}));

test('current lifecycle/page: actual monitor stays silent for clean play and subscriptions survive Undo',()=>withPage('st-lab.html',hidden,g=>{
 selectEmpty(g);const events=[],unsubscribe=g.window.stLab.onTrackingEvent(event=>events.push(event));
 for(const action of ['CW','CCW','HOLD','HD','UNDO','R','HD'])g.window.stLab.act(action);
 assert.deepEqual(events,[]);unsubscribe();g.window.stLab.act('UNDO');g.window.stLab.act('HD');assert.deepEqual(events,[]);
}));

test('current lifecycle/session: structurally valid current facts round-trip without source provenance',()=>{
 const state=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),current=Context.exportState(Context.start(state,{fresh:true}));
 current.inventory.nextId=1000;current.state.center.pending=[{id:'imported',rootId:900,family:'OJ',alternatives:[{piece:'J',cells:[[4,28],[4,29],[5,29],[6,29]]}]}];
 const saved=Session.create(state,{obligationContext:current}),got=Session.prepare(saved);assert.deepEqual(Context.exportState(got.obligationContext),current);assert.deepEqual(Session.create(got.state,got),saved);assert.equal(got.resourceHistory,undefined);
});

test('current lifecycle/session: contradictory paired current bag facts reject without replay',()=>{
 const B=require('../st-bag'),state=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOSTZ'],startPhase:0})}),saved=Session.create(state,{obligationContext:Context.start(state,{fresh:true})});
 saved.position.bag.remaining=[1];assert.throws(()=>Session.prepare(saved),/public bag disagrees/);
 delete saved.position.bag;assert.doesNotThrow(()=>Session.prepare(saved),'Missing optional raw bag is not a provenance failure');
});

// These legal finite witnesses isolate controller cursor transport. The fake
// left-foundation label is not used as evidence of a strategic repair.
function construction(position,current){
 let state=R.createState(position);const continuation=[];
 for(const witness of [['R','L','HD'],['HD']]){const proof=R.replay(state,witness);assert(proof.valid);const event=proof.events[0];continuation.push({witness,event,target:event.target,hold:false,structuralEvidence:{leftFoundation:{completed:true}}});state=proof.state;}
 return{...clone(continuation[0]),continuation,revision:position.revision,evidence:{construction:{kind:'left-foundation',origin:clone(position),steps:continuation.map(p=>({witness:p.witness,event:p.event})),consumed:0,obligationContext:clone(current)}}};
}
function advanceConstruction(state,advice,action){const next=clone(advice);if(next.witness[0]!==action)return null;next.witness.shift();next.continuation[0].witness=next.witness.slice();next.revision=state.revision;return next;}
function continueConstruction(_before,after,advice){const next=clone(advice);next.continuation.shift();if(!next.continuation.length)return null;Object.assign(next,next.continuation[0],{revision:after.revision});next.evidence.construction.consumed++;return next;}

test('current lifecycle/page: finite construction cursor survives mid-piece session import and whole-turn Undo',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g),P=g.window.STPlanner;g.window.STPlanner={...P,advance:advanceConstruction,continueCommitment:continueConstruction};selectEmpty(g);g.advance(40);
 const request=all.at(-1).message,advice=construction(request.observation,request.options.obligationContext);all.at(-1).respond(advice);g.window.stLab.act('R');g.advance(40);
 const moved=all.at(-1).message;assert.deepEqual(moved.options.planContinuity.actionsSinceLock,['R']);assert.equal(moved.options.planContinuity.locks.length,0);
 const saved=clone(g.window.stLab.exportSession());assert(saved.coaching.planContinuity);install(g,saved);g.advance(40);assert.deepEqual(all.at(-1).message.options.planContinuity,saved.coaching.planContinuity);
 for(const action of ['L','HD'])g.window.stLab.act(action);g.window.stLab.act('UNDO');g.advance(40);const restored=all.at(-1).message;
 assert.deepEqual(restored.options.planContinuity.actionsSinceLock,['R']);assert.equal(restored.options.planContinuity.locks.length,0);assert.equal(restored.options.planContinuity.current.revision,restored.observation.revision);
 assert.equal(restored.options.handoffRecovery,undefined);assert.equal(restored.options.resourceContext,undefined);g.window.STPlanner=P;
}));

test('current lifecycle/simulator: the consumed finite construction cursor reaches continuation checks and retires at completion',()=>{
 const E=require('../scripts/lib/st-simulation.cjs'),P=require('../st-planner'),seen=[];
 const api={...P,startOpeningSession:()=>({active:false}),acceptOpeningResult:s=>s,updateOpeningSession:s=>s,advance:advanceConstruction,continueCommitment(before,after,advice,event,options){seen.push(clone(options.planContinuity));return continueConstruction(before,after,advice,event);}};
 const s=E.createSession(E.makeInput('empty',13,2),api),first=s.request(1,E.CONFIG),advice=construction(first.observation,first.options.obligationContext);s.execute(advice);
 assert.equal(seen[0].locks.length,1);assert.deepEqual(seen[0].actionsSinceLock,[]);const next=s.request(2,E.CONFIG);assert.equal(next.options.planContinuity.locks.length,1);
 s.execute(next.commitment.advice);assert.equal(s.request(3,E.CONFIG).options.planContinuity,undefined);assert.equal(s.obligationContext.status,'available');
});


test('current lifecycle: shipped loaders retire the old midgame authority while source hashes retain history',()=>withPage('st-lab.html',hidden,g=>{
 assert.equal(g.window.STMidgameResources,undefined);assert(g.window.STResourceProvider);assert(g.window.STObligationTracking);
 const E=require('../scripts/lib/st-simulation.cjs');assert(E.SOURCE_FILES.includes('st-midgame-resources.js'),'historical evaluation closure stays readable');
 assert.doesNotMatch(require('node:fs').readFileSync(require.resolve('../st-worker'),'utf8'),/st-midgame-resources/);
}));

test('current lifecycle: actual Context notch source preserves fresh recognition and translated sticky phase',()=>{
 const PH=require('../st-pattern-history'),F=require('./support/st-gap-phase.json');
 for(const [initial,witness]of [[require('../st-fixtures').get('direct-double').observation,['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']],[F.quad.observation,F.quad.witness]]){
  let state=R.createState(initial),current=Context.start(state),expected=PH.start(state);
  for(const action of witness){const before=state;state=R.move(state,action);current=Context.applyActual(current,{before,action,after:state}).context;if(action==='HD')expected=PH.update(expected,before,state,state.lastEvent);}
  assert.equal(current.status,'available');assert.deepEqual(current.state.safety.notches,expected);
 }
});

test('current lifecycle/simulator: paired current bag consistency is checked without provenance replay',()=>{
 const E=require('../scripts/lib/st-simulation.cjs'),input=E.makeInput('empty',13,1);input.obligationContext=E.createSession(input).obligationContext;
 input.initial.bag={provenance:input.initial.bag.provenance,observedCount:input.initial.bag.observedCount,remaining:input.initial.bag.remaining};assert.doesNotThrow(()=>E.createSession(input),'object property order is not evidence');
 input.initial.bag.remaining=[1];assert.throws(()=>E.createSession(input),/public bag disagrees/);
});


test('current lifecycle/page: post-action error retires transient construction without restarting accepted Context',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g),P=g.window.STPlanner;selectEmpty(g);g.advance(40);const first=all.at(-1).message;
 all.at(-1).respond(construction(first.observation,first.options.obligationContext));assert(g.window.stLab.exportSession().coaching.planContinuity);
 const initial=g.window.stLab.snapshot(),inventory=clone(g.window.stLab.publicInventory);
 g.window.STPlanner={...P,advance(){throw Error('Injected post-Context failure');}};
 assert.throws(()=>g.window.stLab.act('R'),/post-Context/);g.window.STPlanner=P;
 assert.equal(g.window.stLab.snapshot().active.x,initial.active.x+1);assert.deepEqual(clone(g.window.stLab.publicInventory),inventory);
 assert.equal(g.window.stLab.exportSession().coaching.planContinuity,null);assert.equal(g.window.stLab.result,null);
 g.window.stLab.act('L');g.advance(40);assert.equal(all.at(-1).message.options.planContinuity,undefined);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
}));
