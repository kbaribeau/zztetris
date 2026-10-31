'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),P=require('../st-planner'),H=require('../st-resource-history'),PH=require('../st-pattern-history'),O=require('../st-opening'),Session=require('../st-session');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function trace(f,until=Infinity){let state=R.createState(f.initial),history=H.start(state,{fresh:true}),pattern=PH.start(state),locks=0;
 for(const step of f.steps){if(locks>=until)break;const before=state;state=R.move(state,step.action);for(const t of step.revealed)state={...state,queue:[...state.queue,t],...(state.bag?{bag:B.consume(state.bag,t)}:{})};history=H.applyAction(history,before,step.action,state);if(step.action==='HD'){locks++;pattern=PH.update(pattern,before,state,state.lastEvent);}}
 return{state,history,pattern,originBag:f.initial.bag??null};}
function pack(t,more={}){return Session.create(t.state,{resourceHistory:t.history,resourceOriginBag:t.originBag,patternHistory:t.pattern,...more});}
function worker(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};g.click('#st-reset');g.advance(40);return all;}
function importText(g,x){g.element('#st-snapshot').value=typeof x==='string'?x:JSON.stringify(x);g.click('#st-import');}
function inputs(m){const {id,type,...rest}=m;return rest;}
test('session/resource replay round-trips used Z, S/L identities, pending Center and uncertainty without trusting flags',()=>{
 for(const [file,locks] of [['st-resource-trial-1.json',24],['st-shadow-cross-bag.json',8],['st-shadow-uncertain-s.json',20]]){
  const t=trace(require('./support/'+file),locks),saved=pack(t),got=Session.parse(JSON.stringify(saved));
  assert.deepEqual(H.resolve(got.state,got.resourceHistory),H.resolve(t.state,t.history));assert.deepEqual(got.patternHistory,t.pattern);
  assert.deepEqual(Session.create(got.state,got),saved);
  const forged=clone(saved);forged.coaching.resourceContext.steps[0].action='HD';assert.throws(()=>Session.prepare(forged),/resource replay/i);
  const stale=clone(saved);stale.position.hold=stale.position.hold==='S'?'L':'S';assert.throws(()=>Session.prepare(stale),/resource replay/i);
 }
});
test('session/bag frontier, versions, budgets, oversized and malformed evidence reject before use',()=>{
 const t=trace(require('./support/st-resource-trial-1.json'),3),saved=pack(t);
 for(const alter of [x=>x.schemaVersion++,x=>x.engineVersion={label:'malformed'},x=>x.search.timeMs=999999,x=>x.search.maxNodes=90000,x=>x.position.queue.push('I'),x=>x.coaching.resourceContext.steps.push({action:'NO',revealed:[]}),x=>x.coaching.patternHistory={origin:[],steps:[]}]){const bad=clone(saved);alter(bad);assert.throws(()=>Session.prepare(bad));}
 const bag=clone(saved);bag.position.bag.remaining=[1];assert.throws(()=>Session.prepare(bag),/bag/i);
 const origin=clone(saved);origin.coaching.resourceOriginBag.provenance='unknown-phase';assert.throws(()=>Session.prepare(origin),/first bag/i);
 assert.throws(()=>Session.parse(' '.repeat(Session.LIMITS.bytes+1)),/size limit/);
 const deep=clone(saved);deep.padding={};let at=deep.padding;for(let i=0;i<70;i++)at=at.next={};assert.throws(()=>Session.prepare(deep),/structural/);
});
test('session/null truncated evidence stays unknown rather than restoring supplied availability flags',()=>{
 const t=trace(require('./support/st-resource-trial-1.json'),24),saved=pack(t);saved.coaching.resourceContext=null;saved.coaching.resourceOriginBag=null;saved.coaching.extraZ={status:'available'};saved.coaching.resourceCoverage={status:'truncated'};
 const got=Session.prepare(saved);assert.equal(H.resolve(got.state,got.resourceHistory).extraZ.status,'unknown');assert.match(got.warnings.join(),/unavailable/);
 assert.equal(Session.prepare(Session.create(got.state,got)).warnings.length,0,'new partial history may be replayed without inventing its past');
});
test('session/ordinary advice and retained resource commitment remain candidates with equivalent deterministic decisions',()=>{
 const state=R.migrateState(require('../st-fixtures').get('o-before-double').observation),history=H.start(state),pattern=PH.start(state),options={...Session.defaults(),resourceContext:H.exportContext(state,history),patternHistory:pattern,openingPhase:false,deadline:Infinity};
 const advice=P.decide(state,options);assert.ok(advice.target);assert.ok(P.resourceGoal(advice.continuation));
 const saved=Session.create(state,{resourceHistory:history,resourceOriginBag:state.bag??null,patternHistory:pattern,previous:advice,commitment:{observation:state,advice}}),got=Session.prepare(saved);assert.deepEqual(got.previous,advice);assert.deepEqual(got.commitment,saved.coaching.commitment);
 for(const engineVersion of ['st-coach-session-2026-10-26-v1','st-coach-session-2026-10-26-left-context-v2','future-readable-coach']){const migrated=Session.prepare({...saved,engineVersion});assert.equal(migrated.previous,null);assert.equal(migrated.commitment,null);assert.deepEqual(H.resolve(migrated.state,migrated.resourceHistory),H.resolve(state,history));}
 const a=P.decide(state,{...options,previous:advice,commitment:saved.coaching.commitment}),b=P.decide(got.state,{...options,resourceContext:H.exportContext(got.state,got.resourceHistory),previous:got.previous,commitment:got.commitment});assert.deepEqual(b.target,a.target);assert.deepEqual(b.continuation,a.continuation);
 const stale=clone(saved);stale.coaching.previous.witness=['BAD'];stale.coaching.commitment.advice.continuation[0].witness=['HD'];const rejected=Session.prepare(stale);assert.equal(rejected.previous,null);assert.equal(rejected.commitment,null);assert.equal(rejected.warnings.length,2);
});
test('session/opener source progress, exact input prefix and pending repair survive validated round-trip',()=>{
 const Sim=require('../scripts/lib/st-simulation.cjs'),input=Sim.makeInput('empty',29,32),s=Sim.createSession(input);
 // Replay two actual accepted source decisions with real reveals and identities.
 for(let i=0;i<2;i++){const req=s.request(i,Sim.CONFIG),advice=P.decide(req.observation,{...req.options,deadline:Infinity});assert.ok(advice.evidence.opening.sourcePlan);s.execute(advice);}
 const req=s.request(3,Sim.CONFIG),ctx=req.options.resourceContext,h=H.importContext(req.observation,ctx),saved=Session.create(req.observation,{resourceHistory:h,resourceOriginBag:input.initial.bag,patternHistory:req.options.patternHistory,...req.options,previous:req.previous,commitment:req.commitment});
 const got=Session.prepare(saved);assert.deepEqual(got.openingSource,req.options.openingSource);assert.equal(got.openingPhase,true);assert.deepEqual(got.warnings,[]);
 const migrated=Session.prepare({...saved,engineVersion:'st-coach-session-2026-10-26-v1'});assert.deepEqual(migrated.openingSource,got.openingSource);assert.equal(migrated.openingPhase,true);
 const forged=clone(saved);forged.coaching.openingSource.pattern='not-a-source';assert.equal(Session.prepare(forged).openingSource,null);
 const c=require('./support/st-opening-round1.json').repairControl,repair=O.repairCertificate(c.originObservation,c.continuation);assert.ok(repair);const hs=H.start(c.originObservation);
 const rp=Session.create(c.originObservation,{resourceHistory:hs,resourceOriginBag:c.originObservation.bag??null,openingPhase:true,openingRepair:repair});assert.deepEqual(Session.prepare(rp).openingRepair,repair);
});
test('session/page round-trip preserves worker inputs, rejects atomically and ignores stale same-revision workers',()=>withPage('st-lab.html',{},g=>{
 const ws=worker(g),before=ws.at(-1).message;g.click('#st-export-session');const saved=JSON.parse(g.downloads.at(-1).text),old=ws.at(-1);assert.equal(saved.format,Session.FORMAT);assert.equal('future' in saved,false);assert.equal('pieceLedger' in saved,false);
 const bad=clone(saved);bad.position.board[39]='..........';importText(g,bad);assert.match(g.element('#st-import-status').textContent,/rejected/i);assert.deepEqual(g.snapshot(),before.observation);assert.equal(old.terminated,undefined);
 importText(g,saved);assert.equal(old.terminated,true);assert.equal(g.window.stLab.result,null);g.advance(40);const after=ws.at(-1).message;assert.deepEqual(inputs(after),inputs(before));
 old.respond({target:{type:'I',x:0,y:0,rotation:0},reason:'STALE'});assert.equal(g.window.stLab.result,null);
 importText(g,saved);g.advance(40);assert.deepEqual(inputs(ws.at(-1).message),inputs(before));
 g.window.stLab.act('R');g.window.stLab.act('HD');g.window.stLab.act('UNDO');g.click('#st-reset');g.advance(40);assert.deepEqual(inputs(ws.at(-1).message),inputs(before));
 g.click('#st-export');const plain=JSON.parse(g.element('#st-snapshot').value);assert.equal(plain.format,undefined);importText(g,plain);g.advance(40);assert.equal(g.window.stLab.resources.coverage.status,'partial');assert.equal(ws.at(-1).message.previous,null);
 assert.match(g.window.document.body.textContent,/Up to 100 placements/);
}));
test('session/page accepted advice round-trips without displaying unvalidated imported targets',()=>withPage('st-lab.html',{},g=>{
 const ws=worker(g),m=ws.at(-1).message,advice=P.decide(m.observation,{...m.options,deadline:Infinity});assert.ok(advice.target);ws.at(-1).respond(advice);g.click('#st-export-session');const saved=JSON.parse(g.downloads.at(-1).text);assert.ok(saved.coaching.previous);
 importText(g,saved);assert.equal(g.element('#st-target').children.length,0);g.advance(40);const next=ws.at(-1).message;assert.deepEqual(next.previous,saved.coaching.previous);assert.deepEqual(next.commitment,saved.coaching.commitment);
}));

test('session/mid-piece movement preserves origin-bound commitment candidates and repeated keyboard reset is single-session',()=>withPage('st-lab.html',{},g=>{
 const ws=worker(g),m=ws.at(-1).message,advice=P.decide(m.observation,{...m.options,deadline:Infinity});assert.ok(advice.target);ws.at(-1).respond(advice);
 g.window.stLab.act('L');g.advance(40);const moved=ws.at(-1).message;assert.ok(moved.commitment);
 g.click('#st-export-session');const saved=JSON.parse(g.downloads.at(-1).text);importText(g,saved);g.advance(40);assert.deepEqual(inputs(ws.at(-1).message),inputs(moved));
 const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));let calls=0;g.window.Math.random=()=>{calls++;return .5;};g.tap('KeyR');assert.equal(calls,6,'one seven-piece shuffle, not two');
}));
test('session/source second bag, scoring route, movement prefix and clear evidence survive without deriving a new opener',()=>{
 const Sim=require('../scripts/lib/st-simulation.cjs'),input=Sim.makeInput('empty',2026114046,24),s=Sim.createSession(input),config={...Sim.CONFIG,now:()=>0};
 function fromRequest(req,extra={}){const h=H.importContext(req.observation,req.options.resourceContext);return Session.create(req.observation,{...req.options,resourceHistory:h,resourceOriginBag:input.initial.bag,previous:req.previous,commitment:req.commitment,...extra});}
 for(let lock=1;lock<=20;lock++){
  const req=s.request(lock,config),advice=P.decide(req.observation,req.options);assert.ok(advice.target);
  if([8,9,15,16,20].includes(lock)){const got=Session.prepare(fromRequest(req));assert.deepEqual(got.openingSource,req.options.openingSource,'source root '+lock);assert.deepEqual(got.warnings,[]);}
  if(lock===2||lock===15){
   const accepted=P.acceptOpeningResult({active:true,clear:req.options.openingClear,repair:req.options.openingRepair,source:req.options.openingSource},advice),h=H.importContext(req.observation,req.options.resourceContext);
   let state=R.move(req.observation,advice.witness[0]);const history=H.applyAction(h,req.observation,advice.witness[0],state);
   const moved=Session.create(state,{resourceHistory:history,resourceOriginBag:input.initial.bag,patternHistory:req.options.patternHistory,openingPhase:true,openingSource:accepted.source,openingClear:accepted.clear,openingRepair:accepted.repair,previous:advice});
   const got=Session.prepare(moved);assert.deepEqual(got.openingSource,clone(accepted.source),'pending source input '+lock);assert.deepEqual(got.warnings,[]);
  }
  s.execute(advice);
 }
 const final=s.request(21,config),saved=fromRequest(final),got=Session.prepare(saved);assert.equal(got.openingClear.event.lines,2);assert.deepEqual(got.openingClear,final.options.openingClear);
 const tampered=clone(saved);tampered.coaching.openingClear.event.lines=4;assert.equal(Session.prepare(tampered).openingClear,null);
});

const olderEngines=['st-coach-session-2026-10-26-v1','st-coach-session-2026-10-26-left-context-v2','future-readable-coach'];
for(const engineVersion of olderEngines)test('session/older '+engineVersion+' preserves full history and settings with or without cached advice',()=>{
 const t=trace(require('./support/st-resource-trial-1.json'),24),saved=pack(t);saved.engineVersion=engineVersion;
 for(const cached of [false,true]){
  const old=clone(saved);if(cached){old.coaching.previous={target:'obsolete'};old.coaching.commitment={observation:'obsolete'};}
  const got=Session.parse(JSON.stringify(old));
  assert.deepEqual(got.state,saved.position);assert.deepEqual(got.search,saved.search);
  assert.deepEqual(H.resolve(got.state,got.resourceHistory),H.resolve(t.state,t.history));
  assert.deepEqual(got.patternHistory,t.pattern);assert.deepEqual(got.resourceOriginBag,t.originBag);
  assert.equal(got.previous,null);assert.equal(got.commitment,null);assert.match(got.warnings.join(),/history and settings are preserved/);
  const normalized=Session.create(got.state,got);assert.equal(normalized.engineVersion,Session.ENGINE);
  assert.deepEqual(Session.create(Session.prepare(normalized).state,Session.prepare(normalized)),normalized);
 }
});
test('session/older regression exports use current live accounting without losing the supplied tape',()=>{
 const M=require('../st-midgame-resources');
 for(const f of require('./fixtures/deferred-sl-reveals.json').cases){
  const history=H.importContext(f.before,f.beforeContext),origin=f.beforeContext.origin;
  const saved=Session.create(f.before,{resourceHistory:history,resourceOriginBag:B.fromObserved({observed:[origin.active.type,...origin.queue],startPhase:0})});
  saved.engineVersion=olderEngines[1];const got=Session.prepare(saved),d=H.resolve(got.state,got.resourceHistory);
  assert.deepEqual(H.exportContext(got.state,got.resourceHistory),f.beforeContext);
  const proof=M.checkPath(got.state,f.path,d);assert.equal(proof.valid,true);
  assert.deepEqual(proof.resource.hangingS.filter(x=>x.bag===f.bag),[{id:null,bag:f.bag,known:true}]);
  const before=got.state,next=R.move(before,f.path[0].witness[0]);assert.notEqual(next,before);
  assert.equal(H.resolve(next,H.applyAction(got.resourceHistory,before,f.path[0].witness[0],next)).coverage.status,'complete');
 }
});
test('session/older unknown provenance remains unknown and malformed full history never downgrades',()=>{
 const state=R.migrateState(require('../st-fixtures').get('o-before-double').observation);
 const saved=Session.create(state,{resourceHistory:H.start(state),resourceOriginBag:state.bag??null});saved.engineVersion=olderEngines[0];
 const got=Session.prepare(saved);assert.equal(H.resolve(got.state,got.resourceHistory).coverage.status,'partial');assert.equal(H.resolve(got.state,got.resourceHistory).extraZ.status,'unknown');
 for(const alter of [x=>x.schemaVersion=99,x=>x.coaching.resourceContext.steps.push({action:'INVALID',revealed:[]}),x=>x.search.timeMs=999999,x=>x.coaching.patternHistory={origin:[],steps:[]}]){
  const bad=clone(saved);alter(bad);assert.throws(()=>Session.prepare(bad));
 }
});
test('session/older page import preserves accounting, drops cached targets, normalizes Reset and rejects atomically',()=>withPage('st-lab.html',{},g=>{
 const ws=worker(g),t=trace(require('./support/st-resource-trial-1.json'),24),saved=pack(t);saved.engineVersion=olderEngines[1];saved.coaching.previous={target:'OLD'};
 importText(g,saved);assert.match(g.element('#st-import-status').textContent,/Session imported/);assert.equal(g.window.stLab.result,null);g.advance(40);
 const first=ws.at(-1).message;assert.equal(first.previous,null);assert.equal(first.commitment,null);assert.deepEqual(first.options.resourceContext,saved.coaching.resourceContext);
 const fresh=P.decide(first.observation,{...first.options,deadline:Infinity});ws.at(-1).respond(fresh);
 g.click('#st-export-session');const normalized=JSON.parse(g.downloads.at(-1).text);assert.equal(normalized.engineVersion,Session.ENGINE);assert.deepEqual(normalized.coaching.resourceContext,saved.coaching.resourceContext);const roundTrip=Session.prepare(normalized);assert.deepEqual(H.resolve(roundTrip.state,roundTrip.resourceHistory),H.resolve(t.state,t.history));
 g.window.stLab.act('RESET');g.advance(40);assert.deepEqual(inputs(ws.at(-1).message),inputs(first));assert.doesNotMatch(g.element('#st-import-status').textContent,/different coach version/);
 const before=g.snapshot(),current=ws.at(-1),bad=clone(saved);bad.coaching.resourceContext.steps[0].action='INVALID';importText(g,bad);
 assert.match(g.element('#st-import-status').textContent,/rejected/);assert.deepEqual(g.snapshot(),before);assert.equal(current.terminated,undefined);
}));
