'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),B=require('../st-bag'),P=require('../st-planner'),Session=require('../st-session');
const Context=require('../st-obligation-context'),Resources=require('../st-obligation-resources'),Provider=require('../st-resource-provider');
const severity=p=>Number(Boolean(p.requiresAccommodation))+2*Number(Boolean(p.invalidated));
const legacySeverity=rows=>rows.reduce((counts,p)=>(counts[severity(p)]++,counts),[0,0,0,0]);
const currentSeverity=resource=>resource.uncertainty.S.named.reduce((counts,p)=>(counts[severity(p)]++,counts),resource.uncertainty.S.aggregate.slice());
const nativeResource=(state,current)=>Resources.start(state,current,{extendForced:false});
function assertSevere(state,resource,message){const repair=Resources.repair(state,resource,{maxNodes:45000,now:()=>0});assert.equal(repair.valid,null,message);assert.equal(repair.status,'unclassified-S-accommodation');assert.equal(repair.visited,0,'Severe accommodation is rejected directly, not by a search timeout');}
const {withPage}=require('./support/page.cjs'),cases=require('./fixtures/unclassified-s.json').cases,clone=x=>JSON.parse(JSON.stringify(x));
function data(f){const s=f.request.observation,h=H.importContext(s,f.request.options.resourceContext);return{s,h,summary:H.resolve(s,h)};}
function pack(f,openingPhase=true){const {s,h}=data(f),ctx=f.request.options.resourceContext;return Session.create(s,{resourceHistory:h,resourceOriginBag:B.fromObserved({observed:[ctx.origin.active.type,...ctx.origin.queue],startPhase:0}),patternHistory:f.request.options.patternHistory,openingPhase});}
test('unclassified S: real I17 invalidation survives initialization without resurrecting SL target',()=>{
 const before=data(cases[0]),after=data(cases[1]),a=M.start(before.s,before.summary),b=M.start(after.s,after.summary);
 assert.ok(a.pendingCenter.some(p=>p.rootId===14));assert.ok(a.hangingS.some(p=>p.id===14));
 assert.ok(after.summary.center.closed.some(p=>p.rootId===14&&p.status==='invalidated'));
 assert.equal(b.pendingCenter.some(p=>p.rootId===14),false);assert.equal(b.hangingS.some(p=>p.id===14),false);
 assert.ok(b.unclassifiedS.some(p=>p.sId===14));assert.equal(M.repair(after.s,b).valid,null);assert.equal(M.repair(after.s,b).status,'unclassified-S-accommodation');
 const erased=clone(after.summary);erased.hangingS.unclassified=[];
 assert.notEqual(b.originKey,M.start(after.s,erased).originKey);assert.notEqual(M.binding(b),M.binding({...b,unclassifiedS:[]}));
 assert.equal(P.plan(after.s,{...cases[1].request.options,openingPhase:false,disableOpening:true,timeMs:undefined,maxNodes:45000}).target,null);
});
test('unclassified S: generic missing history is not fabricated confirmed or unclassified debt',()=>{
 const s=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),r=M.start(s,H.resolve(s,H.start(s)));
 assert.deepEqual(r.hangingS,[]);assert.deepEqual(r.unclassifiedS,[]);assert.equal(M.repair(s,r).valid,true);
 const known=M.start(s,{instances:{active:r.active},hangingS:{evidence:[{sId:r.active.id,bag:0}]}}),p=R.placements(s,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>x<4));
 const disposed=M.step(s,p,known);assert.deepEqual(disposed.hangingS,[]);assert.deepEqual(disposed.unclassifiedS,[],'Actual identified Left consumption is resolved, not uncertain');
});
test('unclassified S: current tape, HOLD and reveals preserve unknown past accommodation',()=>{
 const {s,h,summary}=data(cases[1]),saved=clone(H.exportContext(s,h));saved.hangingS={unclassified:[]};
 assert.deepEqual(M.start(s,H.resolve(s,H.importContext(s,saved))).unclassifiedS,M.start(s,summary).unclassifiedS);
 let current=s,history=h;for(const action of ['HOLD','HOLD']){const next=R.move(current,action);history=H.applyAction(history,current,action,next);current=next;}
 const got=H.resolve(current,history);assert.deepEqual(got.hangingS.unclassified,summary.hangingS.unclassified);
 // Historical S14 has already been consumed: an unrelated new S cannot pay it.
 const raw=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),r=M.start(raw,{hangingS:{unclassified:summary.hangingS.unclassified}}),p=R.placements(raw,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>x<4));
 assert.deepEqual(M.step(raw,p,r).unclassifiedS,r.unclassifiedS);
});
test('unclassified S: current session and real UI Undo restore named duties or retired severity',()=>withPage('st-lab.html',{},g=>{
 const saved=pack(cases[1]),prepared=Session.prepare(clone(saved)),oracle=data(cases[1]),resource=nativeResource(prepared.state,prepared.obligationContext),expected=legacySeverity(M.start(oracle.s,oracle.summary).unclassifiedS);
 assert.deepEqual(currentSeverity(resource),expected);assert.equal(resource.uncertainty.S.aggregate[2],1,'Retired S14 invalidation remains severe, without a lifetime identity');assert.equal(resource.unclassifiedS.some(x=>x.sId===14),false);assert.equal(resource.pendingCenter.some(x=>x.rootId===14),false);assertSevere(prepared.state,resource);
 g.element('#st-snapshot').value=JSON.stringify(pack(cases[0]));g.click('#st-import');
 const ctx17=cases[0].request.options.resourceContext,ctx18=cases[1].request.options.resourceContext;
 for(const step of ctx18.steps.slice(ctx17.steps.length))g.window.stLab.act(step.action);
 g.click('#st-export-session');const post=Session.prepare(JSON.parse(g.downloads.at(-1).text)),after=nativeResource(post.state,post.obligationContext);
 assert.deepEqual(currentSeverity(after),expected);assert.equal(after.uncertainty.S.aggregate[2],1);assertSevere(post.state,after);
 g.window.stLab.act('UNDO');g.click('#st-export-session');const restored=Session.prepare(JSON.parse(g.downloads.at(-1).text)),r=nativeResource(restored.state,restored.obligationContext);
 assert.ok(r.pendingCenter.some(x=>x.rootId===14));assert.deepEqual(currentSeverity(r),legacySeverity(M.start(data(cases[0]).s,data(cases[0]).summary).unclassifiedS));assert.equal(r.uncertainty.S.aggregate[2],0);
}));
for(const deferred of [false,true])test(`unclassified S: empty HOLD with ${deferred?'deferred':'observed'} surplus uses only post-lock placement facts`,()=>{
 let state=R.createState({active:'L',queue:['I','S','J','O','T','Z'],streamCursor:1}),history=H.start(state,{fresh:true});
 const act=(action,revealed=[])=>{const before=state;state=R.move(state,action);state={...state,queue:[...state.queue,...revealed]};history=H.applyAction(history,before,action,state);};
 if(!deferred)for(const action of ['L','L','L','HD'])act(action);
 else{
  // A finite public prefix, as in projected search: observe early next-bag
  // L/I/J, then make no further reveals. Its S has never been observed.
  state=R.createState({active:'I',queue:['O','T','S','Z','J','L'],streamCursor:1});history=H.start(state,{fresh:true});
  for(let lock=0;lock<8;lock++){
   const choices=R.placements(state,{allowHold:false}).placements.filter(p=>p.event.cells.every(([x])=>x<4));
   const height=p=>40-p.state.board.findIndex(r=>r!=='..........');choices.sort((a,b)=>height(a)-height(b));assert.ok(choices[0]);
   for(const action of choices[0].witness)act(action,action==='HD'&&lock<3?[['L','I','J'][lock]]:[]);
  }
 }
 const summary=H.resolve(state,history);assert.equal(state.hold,null);assert.equal(summary.hangingS.evidence.length,1);assert.equal(summary.hangingS.evidence[0].sId,deferred?null:3);
 for(const witness of [['HOLD','HD'],['HOLD','HOLD','HD']]){
  const replay=R.replay(state,witness);assert.equal(replay.valid,true);
  const got=M.checkPath(state,[{witness,event:replay.events[0]}],summary);assert.deepEqual(got.resource.violations,[]);assert.equal(got.resource.hold.type,replay.state.hold);
  if(deferred){assert.deepEqual(got.resource.hangingS,[{id:null,bag:1,known:true}]);assert.deepEqual(got.resource.unclassifiedS,[]);}
  else if(witness.length===2){assert.equal(got.resource.hangingS.length,0);assert.ok(got.resource.unclassifiedS.some(s=>s.sId===3),'Only the actual unreviewed S lock changes its classification');}
  else assert.ok(got.resource.hangingS.some(s=>s.id===3),'Swapping the S into HOLD does not consume or reclassify it');
 }
});

test('unclassified S: disposing known S55 cannot be certified by completing different S57',()=>{
 const f=require('./fixtures/unreviewed-s-disposal.json'),{s,summary}=data(f),initial=M.start(s,summary);
 assert.ok(initial.hangingS.some(x=>x.id===55));assert.ok(initial.pendingCenter.some(x=>x.rootId===57));
 const checked=M.checkPath(s,f.advice.continuation,summary);assert.equal(checked.valid,true);
 assert.ok(!checked.resource.hangingS.some(x=>x.id===55),'Consumed S is not resurrected as a live repair token');
 const repair=M.repair(checked.state,checked.resource,{maxNodes:45000,notches:f.advice.evidence.futureNotches});
 assert.equal(repair.valid,null);assert.equal(repair.queryStatus,'unfinished');
 const prepared=Session.prepare(clone(pack(f,false))),root=nativeResource(prepared.state,prepared.obligationContext),roundtrip=Resources.checkPath(prepared.state,f.advice.continuation,root);
 assert.ok(root.hangingS.some(x=>x.id===55));assert.ok(root.pendingCenter.some(x=>x.rootId===57));assert.equal(roundtrip.valid,true);
 assert.ok(roundtrip.resource.unclassifiedS.some(x=>x.sId===55&&x.requiresAccommodation),'The fixed request retains its original S55 identity');assert.ok(roundtrip.resource.pendingCenter.some(x=>x.rootId===57),'Different S57 target cannot pay S55');
 assert.deepEqual(currentSeverity(roundtrip.resource),legacySeverity(checked.resource.unclassifiedS));assert.ok(roundtrip.resource.uncertainty.S.severeCount>0);assertSevere(roundtrip.state,roundtrip.resource,'Native import preserves the same severe known-to-unknown boundary');
 const nativeOptions={...f.request.options,resourceContext:undefined,obligationContext:Context.exportState(prepared.obligationContext),maxNodes:45000,timeMs:undefined,deadline:Infinity,now:()=>0};
 const candidate=clone(f.advice);delete candidate.evidence.resourceObligations.binding;
 assert.equal(P.ordinaryRightEligible(candidate.continuation[0].event),false,'The literal S55 Right disposal also violates ordinary placement policy');
 assert.equal(P.revalidate(s,candidate,nativeOptions),null,'Binding-free imported advice remains rejected by public policy; the exact severe-resource gate is tested above');
 assert.equal(P.revalidate(s,f.advice,{...f.request.options,maxNodes:45000,timeMs:1500}),null,'Previously accepted serialized advice must fail current validation');
 assert.notEqual(M.binding(checked.resource),M.binding({...checked.resource,unclassifiedS:checked.resource.unclassifiedS.map(x=>({...x,requiresAccommodation:false}))}));
 // A later unrelated Left S must not erase the uncertain consumed identity.
 const raw=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),other=M.start(raw),p=R.placements(raw,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>x<4));
 other.unclassifiedS=clone(checked.resource.unclassifiedS);assert.deepEqual(M.step(raw,p,other).unclassifiedS,other.unclassifiedS);
 // Retired current uncertainty has no S55 token to pay. A different actual
 // Left S cannot erase its count, even in a trusted current imported origin.
 let observed=R.createState({...raw,streamCursor:1}),snapshot=Context.exportState(Context.start(observed,{fresh:true}));snapshot.state.sl.foundationOpen=false;snapshot.state.sl.handoff=true;snapshot.state.sl.uncertainty.S=legacySeverity(checked.resource.unclassifiedS);
 let current=Context.importState(snapshot,{position:observed});for(const action of p.witness){const before=observed;observed=R.move(observed,action);current=Context.applyActual(current,{before,action,after:observed}).context;}
 const unrelated=nativeResource(observed,current);assert.deepEqual(currentSeverity(unrelated),snapshot.state.sl.uncertainty.S);assert.ok(unrelated.uncertainty.S.severeCount>0);assertSevere(observed,unrelated);
});

test('unclassified S: actual disposal severity survives initialization, current session and Undo',()=>withPage('st-lab.html',{},g=>{
 const f=require('./fixtures/unreviewed-s-disposal.json'),before=Session.prepare(clone(pack(f,false))),legacy=data(f);
 let state=before.state,current=before.obligationContext,history=legacy.h;
 assert.equal(current.inventory.hold.id,55);assert.ok(current.state.center.pending.some(p=>p.rootId===57));
 assert.equal(nativeResource(state,current).uncertainty.S.aggregate[1],1,'Previously retired S26 already needs accommodation');
 for(const action of f.advice.witness){const next=R.move(state,action);current=Context.applyActual(current,{before:state,action,after:next}).context;history=H.applyAction(history,state,action,next);state=next;}
 const expected=legacySeverity(M.start(state,H.resolve(state,history)).unclassifiedS);
 const check=(s,c)=>{const resource=nativeResource(s,c);assert.deepEqual(currentSeverity(resource),expected);assert.equal(resource.uncertainty.S.aggregate[1],2,'Retired S26 plus consumed S55 retain two severe accommodation counts');assert.equal(resource.unclassifiedS.some(x=>x.sId===55),false,'Do not invent an identity after retirement');assert.ok(!resource.hangingS.some(x=>x.id===55));assert.ok(resource.uncertainty.S.severeCount>0);assertSevere(s,resource);};
 check(state,current);
 const saved=Session.create(state,{obligationContext:Context.exportState(current)}),after=Session.prepare(clone(saved));check(after.state,after.obligationContext);
 // Legacy derived flags still cannot override the finite conversion. Native
 // snapshots instead trust their explicit current counts, not those labels.
 const transport=clone(H.exportContext(state,history));transport.hangingS={unclassified:[]};const converted=Provider.prepare(state,{resourceContext:transport});assert.equal(converted.status,'available');check(state,converted.context);
 g.element('#st-snapshot').value=JSON.stringify(pack(f,false));g.click('#st-import');
 for(const action of f.advice.witness)g.window.stLab.act(action);
 g.click('#st-export-session');const actual=Session.prepare(JSON.parse(g.downloads.at(-1).text));check(actual.state,actual.obligationContext);
 g.window.stLab.act('UNDO');g.click('#st-export-session');const undo=Session.prepare(JSON.parse(g.downloads.at(-1).text)),old=nativeResource(undo.state,undo.obligationContext);
 assert.ok(old.hangingS.some(x=>x.id===55));assert.equal(undo.obligationContext.inventory.hold.id,55);assert.ok(old.pendingCenter.some(x=>x.rootId===57));assert.deepEqual(currentSeverity(old),legacySeverity(M.start(legacy.s,legacy.summary).unclassifiedS));assert.equal(old.uncertainty.S.aggregate[1],1,'Undo removes only the S55 disposal, preserving retired S26');
}));

test('unclassified S: replay does not promote a pre-existing unclassified allocation into known disposal',()=>{
 let state=R.createState({active:'S',queue:['L','I','O','J','T','Z'],streamCursor:1}),history=H.start(state,{fresh:true});
 for(const region of ['right','left']){
  const p=R.placements(state,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>region==='right'?x>=8:x<4));assert.ok(p);
  for(const action of p.witness){const next=R.move(state,action);history=H.applyAction(history,state,action,next);state=next;}
 }
 const resource=M.start(state,H.resolve(state,history));assert.ok(resource.unclassifiedS.some(x=>x.sId===1));assert.ok(resource.unclassifiedS.every(x=>!x.requiresAccommodation));
 assert.equal(M.repair(state,resource).valid,true,'No known-to-unreviewed transition occurred; do not invent confirmed historical debt');
 const imported=H.importContext(state,clone(H.exportContext(state,history)));assert.deepEqual(M.start(state,H.resolve(state,imported)).unclassifiedS,resource.unclassifiedS);
});

test('unclassified S: verified first-bag source foundation keeps existing opening allocation policy',()=>{
 const Sim=require('../scripts/lib/st-simulation.cjs'),input=Sim.makeInput('empty',2026103510,24),session=Sim.createSession(input);let state=R.createState(input.initial),history=H.start(state,{fresh:true}),cursor=0;
 for(let lock=1;lock<=7;lock++){
  const q=session.request(lock,Sim.CONFIG),advice=P.decide(q.observation,{...q.options,now:()=>0,deadline:Infinity}),actual=session.execute(advice);
  // The legacy reference consumes exactly the same actual inputs
  // and revealed pieces, not the new current controller's summary.
  for(const step of actual.actions){const before=state;state=R.move(state,step.action);for(const type of input.future.slice(cursor,step.draws))state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};cursor=step.draws;history=H.applyAction(history,before,step.action,state);}
 }
 const q=session.request(8,Sim.CONFIG),current=Context.importState(q.options.obligationContext,{position:q.observation}),resource=nativeResource(q.observation,current),oracle=H.resolve(state,history);
 assert.equal(q.options.resourceContext,undefined);assert.equal(current.boundary.firstBagLocks,7);assert.equal(current.boundary.sourcePatternSeen,true);assert.equal(current.state.sl.firstBagReview,'reviewed');
 assert.equal(oracle.milestones.sourcePattern.at,7);assert.equal(oracle.milestones.sourcePattern.id,'buri-02');assert.ok(oracle.hangingS.unclassified.some(x=>x.sId===5));
 const pattern=require('../st-opening-patterns').patterns.find(p=>p.id==='buri-02');assert.deepEqual(q.observation.board,Array(40-pattern.rows.length).fill('..........').concat(pattern.rows),'Literal source geometry still matches the reviewed first bag');
 assert.deepEqual(currentSeverity(resource),legacySeverity(M.start(state,oracle).unclassifiedS));assert.equal(resource.uncertainty.S.aggregate[0],1);assert.equal(resource.uncertainty.S.severeCount,0);assert.ok(resource.unclassifiedS.every(x=>!x.requiresAccommodation&&!x.invalidated));
});
