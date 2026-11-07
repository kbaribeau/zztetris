'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources'),B=require('../st-bag'),P=require('../st-planner'),Session=require('../st-session');
const Context=require('../st-obligation-context'),Resources=require('../st-obligation-resources'),Provider=require('../st-resource-provider');
const severity=p=>Number(Boolean(p.requiresAccommodation))+2*Number(Boolean(p.invalidated));
const legacySeverity=rows=>rows.reduce((counts,p)=>(counts[severity(p)]++,counts),[0,0,0,0]);
const currentSeverity=resource=>resource.uncertainty.S.named.reduce((counts,p)=>(counts[severity(p)]++,counts),resource.uncertainty.S.aggregate.slice());
const nativeResource=(state,current)=>Resources.start(state,current,{extendForced:false});
function assertSevere(state,resource,message){const repair=Resources.repair(state,resource,{maxNodes:45000,now:()=>0});assert.equal(repair.valid,null,message);assert.equal(repair.status,'unclassified-S-accommodation');assert.equal(repair.visited,0,'Severe accommodation is rejected directly, not by a search timeout');}
const {withPage}=require('./support/page.cjs'),cases=require('./fixtures/unclassified-s.json').cases,clone=x=>JSON.parse(JSON.stringify(x));
function data(f){const s=f.request.observation,h=Current.importState(f.request.options.obligationContext,{position:s});return{s,h,summary:CurrentProvider.facts(CurrentProvider.prepare(s,{obligationContext:Current.exportState(h)}))};}
function pack(f,openingPhase=true){const {s,h}=data(f);return Session.create(s,{obligationContext:h,openingPhase});}
test('unclassified S: real I17 invalidation survives initialization without resurrecting SL target',()=>{
 const before=data(cases[0]),after=data(cases[1]),a=M.start(before.s,before.h,{extendForced:false}),b=M.start(after.s,after.h,{extendForced:false});
 assert.ok(a.pendingCenter.some(p=>p.rootId===14));assert.ok(a.hangingS.some(p=>p.id===14));
 assert.equal(after.h.state.sl.uncertainty.S[2],1,'Exact I17 invalidation is retained as severe anonymous accommodation');
 assert.equal(b.pendingCenter.some(p=>p.rootId===14),false);assert.equal(b.hangingS.some(p=>p.id===14),false);
 assert.equal(b.uncertainty.S.aggregate[2],1);assert.equal(b.unclassifiedS.some(p=>p.sId===14),false);assert.equal(M.repair(after.s,b).valid,null);assert.equal(M.repair(after.s,b).status,'unclassified-S-accommodation');
 const erased=Context.exportState(after.h);erased.state.sl.uncertainty.S[2]=0;
 assert.notEqual(M.rootBinding(b),M.rootBinding(M.start(after.s,Context.importState(erased,{position:after.s}),{extendForced:false})));assert.throws(()=>M.binding({...b,unclassifiedS:[]}),/current projected resource/);
 assert.equal(P.plan(after.s,{...cases[1].request.options,openingPhase:false,disableOpening:true,timeMs:undefined,maxNodes:45000}).target,null);
});
test('unclassified S: generic missing history is not fabricated confirmed or unclassified debt',()=>{
 const s=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),r=M.startUnknown(s);
 assert.deepEqual(r.hangingS,[]);assert.deepEqual(r.unclassifiedS,[]);assert.equal(M.repair(s,r).valid,true);assert.equal(r.uncertainty.S.count,0);
});
test('unclassified S: current snapshots and HOLD preserve unknown past accommodation',()=>{
 const {s,h}=data(cases[1]),saved=clone(Current.exportState(h));saved.hangingS={unclassified:[]};assert.throws(()=>Current.importState(saved,{position:s}),/envelope shape/);
 let current=s,history=h;for(const action of ['HOLD','HOLD']){const next=R.move(current,action);history=Current.applyActual(history,{before:current,action,after:next}).context;current=next;}
 assert.deepEqual(history.state.sl.uncertainty,h.state.sl.uncertainty);assert.equal(history.state.sl.uncertainty.S[2],1);
 const transported=Current.importState(Current.exportState(history),{position:current});assert.deepEqual(transported.state.sl.uncertainty,history.state.sl.uncertainty);
});
test('unclassified S: current session and real UI Undo restore named duties or retired severity',()=>withPage('st-lab.html',{},g=>{
 const saved=pack(cases[1]),prepared=Session.prepare(clone(saved)),oracle=data(cases[1]),resource=nativeResource(prepared.state,prepared.obligationContext),expected=[0,0,1,0];
 assert.deepEqual(currentSeverity(resource),expected);assert.equal(resource.uncertainty.S.aggregate[2],1,'Retired S14 invalidation remains severe, without a lifetime identity');assert.equal(resource.unclassifiedS.some(x=>x.sId===14),false);assert.equal(resource.pendingCenter.some(x=>x.rootId===14),false);assertSevere(prepared.state,resource);
 g.element('#st-snapshot').value=JSON.stringify(pack(cases[0]));g.click('#st-import');
 for(const step of require('./fixtures/unclassified-s.json').observedActionsBetweenCases)g.window.stLab.act(step.action);
 g.click('#st-export-session');const post=Session.prepare(JSON.parse(g.downloads.at(-1).text)),after=nativeResource(post.state,post.obligationContext);
 assert.deepEqual(currentSeverity(after),expected);assert.equal(after.uncertainty.S.aggregate[2],1);assertSevere(post.state,after);
 g.window.stLab.act('UNDO');g.click('#st-export-session');const restored=Session.prepare(JSON.parse(g.downloads.at(-1).text)),r=nativeResource(restored.state,restored.obligationContext);
 assert.ok(r.pendingCenter.some(x=>x.rootId===14));assert.deepEqual(currentSeverity(r),[0,0,0,0]);assert.equal(r.uncertainty.S.aggregate[2],0);
}));
for(const deferred of [false,true])test(`unclassified S: empty HOLD with ${deferred?'deferred':'observed'} surplus uses only post-lock placement facts`,()=>{
 let state=R.createState({active:'L',queue:['I','S','J','O','T','Z'],streamCursor:1}),history=Current.start(state,{fresh:true});
 const act=(action,revealed=[])=>{const before=state;state=R.move(state,action);state={...state,queue:[...state.queue,...revealed]};history=Current.applyActual(history,{before:before,action:action,after:state}).context;};
 if(!deferred)for(const action of ['L','L','L','HD'])act(action);
 else{
  // A finite public prefix, as in projected search: observe early next-bag
  // L/I/J, then make no further reveals. Its S has never been observed.
  state=R.createState({active:'I',queue:['O','T','S','Z','J','L'],streamCursor:1});history=Current.start(state,{fresh:true});
  for(let lock=0;lock<8;lock++){
   const choices=R.placements(state,{allowHold:false}).placements.filter(p=>p.event.cells.every(([x])=>x<4));
   const height=p=>40-p.state.board.findIndex(r=>r!=='..........');choices.sort((a,b)=>height(a)-height(b));assert.ok(choices[0]);
   for(const action of choices[0].witness)act(action,action==='HD'&&lock<3?[['L','I','J'][lock]]:[]);
  }
 }
 const summary=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.equal(state.hold,null);assert.equal(summary.hangingS.evidence.length,1);assert.equal(summary.hangingS.evidence[0].sId,deferred?null:3);
 for(const witness of [['HOLD','HD'],['HOLD','HOLD','HD']]){
  const replay=R.replay(state,witness);assert.equal(replay.valid,true);
  const got=M.checkPath(state,[{witness,event:replay.events[0]}],history);assert.deepEqual(got.resource.violations,[]);assert.equal(got.resource.hold.type,replay.state.hold);
  if(deferred){assert.deepEqual(got.resource.hangingS,[{id:null,bag:1,known:true}]);assert.deepEqual(got.resource.unclassifiedS,[]);}
  else if(witness.length===2){assert.equal(got.resource.hangingS.length,0);assert.ok(got.resource.unclassifiedS.some(s=>s.sId===3),'Only the actual unreviewed S lock changes its classification');}
  else assert.ok(got.resource.hangingS.some(s=>s.id===3),'Swapping the S into HOLD does not consume or reclassify it');
 }
});

test('unclassified S: disposing known S55 cannot be certified by completing different S57',()=>{
 const f=require('./fixtures/unreviewed-s-disposal.json'),{s,h,summary}=data(f),initial=M.start(s,h,{extendForced:false});
 assert.ok(initial.hangingS.some(x=>x.id===55));assert.ok(initial.pendingCenter.some(x=>x.rootId===57));
 const checked=M.checkPath(s,f.advice.continuation,h);assert.equal(checked.valid,true);
 assert.ok(!checked.resource.hangingS.some(x=>x.id===55),'Consumed S is not resurrected as a live repair token');
 const repair=M.repair(checked.state,checked.resource,{maxNodes:45000,notches:f.advice.evidence.futureNotches});
 assert.equal(repair.valid,null);assert.equal(repair.queryStatus,'unfinished');
 const prepared=Session.prepare(clone(pack(f,false))),root=nativeResource(prepared.state,prepared.obligationContext),roundtrip=Resources.checkPath(prepared.state,f.advice.continuation,root);
 assert.ok(root.hangingS.some(x=>x.id===55));assert.ok(root.pendingCenter.some(x=>x.rootId===57));assert.equal(roundtrip.valid,true);
 assert.ok(roundtrip.resource.unclassifiedS.some(x=>x.sId===55&&x.requiresAccommodation),'The fixed request retains its original S55 identity');assert.ok(roundtrip.resource.pendingCenter.some(x=>x.rootId===57),'Different S57 target cannot pay S55');
 assert.deepEqual(currentSeverity(roundtrip.resource),currentSeverity(checked.resource));assert.ok(roundtrip.resource.uncertainty.S.severeCount>0);assertSevere(roundtrip.state,roundtrip.resource,'Native import preserves the same severe known-to-unknown boundary');
 const nativeOptions={...f.request.options,obligationContext:Context.exportState(prepared.obligationContext),maxNodes:45000,timeMs:undefined,deadline:Infinity,now:()=>0};
 const candidate=clone(f.advice);delete candidate.evidence.resourceObligations.binding;
 assert.equal(P.ordinaryRightEligible(candidate.continuation[0].event),false,'The literal S55 Right disposal also violates ordinary placement policy');
 assert.equal(P.revalidate(s,candidate,nativeOptions),null,'Binding-free imported advice remains rejected by public policy; the exact severe-resource gate is tested above');
 assert.equal(P.revalidate(s,f.advice,{...f.request.options,maxNodes:45000,timeMs:1500}),null,'Previously accepted serialized advice must fail current validation');
 assert.throws(()=>M.binding({...checked.resource,unclassifiedS:[]}),/current projected resource/);
 const raw=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),p=R.placements(raw,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>x<4));
 // Retired current uncertainty has no S55 token to pay. A different actual
 // Left S cannot erase its count, even in a trusted current imported origin.
 let observed=R.createState({...raw,streamCursor:1}),snapshot=Context.exportState(Context.start(observed,{fresh:true}));snapshot.state.sl.foundationOpen=false;snapshot.state.sl.handoff=true;snapshot.state.sl.uncertainty.S=currentSeverity(checked.resource);
 let current=Context.importState(snapshot,{position:observed});for(const action of p.witness){const before=observed;observed=R.move(observed,action);current=Context.applyActual(current,{before,action,after:observed}).context;}
 const unrelated=nativeResource(observed,current);assert.deepEqual(currentSeverity(unrelated),snapshot.state.sl.uncertainty.S);assert.ok(unrelated.uncertainty.S.severeCount>0);assertSevere(observed,unrelated);
});

test('unclassified S: actual disposal severity survives initialization, current session and Undo',()=>withPage('st-lab.html',{},g=>{
 const f=require('./fixtures/unreviewed-s-disposal.json'),before=Session.prepare(clone(pack(f,false))),legacy=data(f);
 let state=before.state,current=before.obligationContext;
 assert.equal(current.inventory.hold.id,55);assert.ok(current.state.center.pending.some(p=>p.rootId===57));
 assert.equal(nativeResource(state,current).uncertainty.S.aggregate[1],1,'Previously retired S26 already needs accommodation');
 for(const action of f.advice.witness){const next=R.move(state,action);current=Context.applyActual(current,{before:state,action,after:next}).context;state=next;}
 const expected=[0,2,0,0];
 const check=(s,c)=>{const resource=nativeResource(s,c);assert.deepEqual(currentSeverity(resource),expected);assert.equal(resource.uncertainty.S.aggregate[1],2,'Retired S26 plus consumed S55 retain two severe accommodation counts');assert.equal(resource.unclassifiedS.some(x=>x.sId===55),false,'Do not invent an identity after retirement');assert.ok(!resource.hangingS.some(x=>x.id===55));assert.ok(resource.uncertainty.S.severeCount>0);assertSevere(s,resource);};
 check(state,current);
 const saved=Session.create(state,{obligationContext:Context.exportState(current)}),after=Session.prepare(clone(saved));check(after.state,after.obligationContext);
 const transport=Context.exportState(current);transport.hangingS={unclassified:[]};assert.equal(Provider.prepare(state,{obligationContext:transport}).status,'unavailable','Native schema rejects obsolete sidecar fields');
 g.element('#st-snapshot').value=JSON.stringify(pack(f,false));g.click('#st-import');
 for(const action of f.advice.witness)g.window.stLab.act(action);
 g.click('#st-export-session');const actual=Session.prepare(JSON.parse(g.downloads.at(-1).text));check(actual.state,actual.obligationContext);
 g.window.stLab.act('UNDO');g.click('#st-export-session');const undo=Session.prepare(JSON.parse(g.downloads.at(-1).text)),old=nativeResource(undo.state,undo.obligationContext);
 assert.ok(old.hangingS.some(x=>x.id===55));assert.equal(undo.obligationContext.inventory.hold.id,55);assert.ok(old.pendingCenter.some(x=>x.rootId===57));assert.deepEqual(currentSeverity(old),[0,1,0,0]);assert.equal(old.uncertainty.S.aggregate[1],1,'Undo removes only the S55 disposal, preserving retired S26');
}));

test('unclassified S: replay does not promote a pre-existing unclassified allocation into known disposal',()=>{
 let state=R.createState({active:'S',queue:['L','I','O','J','T','Z'],streamCursor:1}),history=Current.start(state,{fresh:true});
 for(const region of ['right','left']){
  const p=R.placements(state,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>region==='right'?x>=8:x<4));assert.ok(p);
  for(const action of p.witness){const next=R.move(state,action);history=Current.applyActual(history,{before:state,action,after:next}).context;state=next;}
 }
 const resource=M.start(state,history,{extendForced:false});assert.equal(resource.uncertainty.S.count,1);assert.equal(resource.uncertainty.S.severeCount,0);
 assert.equal(M.repair(state,resource).valid,true,'No known-to-unreviewed transition occurred; do not invent confirmed historical debt');
 const imported=Current.importState(clone(Current.exportState(history)),{position:state});assert.deepEqual(currentSeverity(M.start(state,imported,{extendForced:false})),currentSeverity(resource));
});

test('unclassified S: verified first-bag source foundation keeps existing opening allocation policy',()=>{
 const Sim=require('../scripts/lib/st-simulation.cjs'),input=Sim.makeInput('empty',2026103510,24),session=Sim.createSession(input);let state=R.createState(input.initial),history=Current.start(state,{fresh:true}),cursor=0;
 for(let lock=1;lock<=7;lock++){
  const q=session.request(lock,Sim.CONFIG),advice=P.decide(q.observation,{...q.options,now:()=>0,deadline:Infinity}),actual=session.execute(advice);
  // The second current controller consumes exactly the same actual inputs
  // and revealed pieces, not the new current controller's summary.
  for(const step of actual.actions){const before=state;state=R.move(state,step.action);for(const type of input.future.slice(cursor,step.draws))state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};cursor=step.draws;history=Current.applyActual(history,{before:before,action:step.action,after:state}).context;}
 }
 const q=session.request(8,Sim.CONFIG),current=Context.importState(q.options.obligationContext,{position:q.observation}),resource=nativeResource(q.observation,current),oracle=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));
 assert.ok(q.options.obligationContext);assert.equal(current.boundary.firstBagLocks,7);assert.equal(current.boundary.sourcePatternSeen,true);assert.equal(current.state.sl.firstBagReview,'reviewed');
 assert.equal(history.boundary.firstBagLocks,7);assert.equal(history.boundary.sourcePatternSeen,true);
 const pattern=require('../st-opening-patterns').patterns.find(p=>p.id==='buri-02');assert.deepEqual(q.observation.board,Array(40-pattern.rows.length).fill('..........').concat(pattern.rows),'Literal source geometry still matches the reviewed first bag');
 assert.deepEqual(currentSeverity(resource),[1,0,0,0]);assert.equal(resource.uncertainty.S.aggregate[0],1);assert.equal(resource.uncertainty.S.severeCount,0);assert.ok(resource.unclassifiedS.every(x=>!x.requiresAccommodation&&!x.invalidated));
});
