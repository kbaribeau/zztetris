'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-obligation-projection'),Q=require('../st-obligation-state'),X=require('../st-obligation-context'),I=require('../st-public-inventory'),R=require('../st-rules'),B=require('../st-bag'),F=require('../st-fixtures'),A=require('../st-obligation-admission');
const copy=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const first=()=>R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1});
function actual(origin,steps,until=Infinity,markers={}){
 let position=R.createState(origin),context=X.start(position,{fresh:true}),locks=0;
 if(markers.handoffAtAction===0)context=X.handoff(context,{position}).context;
 for(const [i,s]of steps.entries()){
  if(locks>=until)break;
  const after=R.move(position,s.action);assert.notEqual(after,position);const next={...after,queue:[...after.queue,...s.revealed]};
  context=X.applyActual(context,{before:position,action:s.action,after:next}).context;assert.equal(context.status,'available',context.reason);position=next;
  if(s.action==='HD')locks++;
  if(markers.handoffAtAction===i+1)context=X.handoff(context,{position}).context;
 }
 return{position,context};
}
function trial(name,until){const f=require('./support/'+name+'.json');return actual(f.initial,f.steps,until);}
const projectRoot=({position,context})=>P.start(context.state,{position,inventory:context.inventory});
function withoutDomain(state){const out=copy(state);delete out.domain;delete out.sl.domain;delete out.account.domain;return out;}
function checkedKnown(position,{active,hold=null,queue=[],frontier,nextId,knowledge=null,state}={}){
 const inventory=I.importState({schemaVersion:1,status:'available',originKnown:true,nextId,streamCursor:position.streamCursor,active,hold,queue,frontier,knowledge});assert.equal(inventory.status,'available',inventory.reason);
 return P.start(state,{position,inventory});
}
const observed=(id,type,bag)=>({id,type,bag,observedOrder:id-1});
const established=()=>{const p=first(),inv=I.start(p,{fresh:true}),s=Q.start(p,{inventory:inv});s.sl.foundationOpen=false;s.account.firstTsd=true;s.account.allocationVerified=true;s.account.opening=null;s.account.profile.before=null;s.account.profile.capEstablished=true;s.account.z.remaining=0;return Q.importState(s);};

test('projection: known observed moves share facts/effects with existing projection and actual receipt path',()=>{
 const position=first(),inventory=I.start(position,{fresh:true}),state=Q.start(position,{inventory}),root=freeze(P.start(state,{position,inventory})),saved=copy(root);
 for(const witness of [['L','HD'],['R','HD'],['HOLD','L','HD'],['HOLD','HOLD','HD']]){
  const next=P.project(root,{witness}),old=Q.project(state,{position,inventory,witness});
  assert.deepEqual(withoutDomain(next.state),old.state);assert.deepEqual(next.effects,old.effects);assert.deepEqual(next.locked,old.locked);assert.deepEqual(next.position,old.position);
  for(const key of ['active','hold','queue','frontier','knowledge','streamCursor'])assert.deepEqual(next.supply[key],old.inventory[key]);
  assert.deepEqual(P.resolve(next),Q.resolve(old.state,{position:old.position,inventory:old.inventory}));
 }
 assert.deepEqual(root,saved);
});
test('projection: all-positive hypothetical envelopes and supply cannot be imported or applied as actual',()=>{
 const position=first(),inventory=I.start(position,{fresh:true}),state=Q.start(position,{inventory}),root=P.start(state,{position,inventory}),next=P.project(root,{witness:['HD']});
 assert.equal(next.state.domain,'projection');assert.ok([next.supply.active,...next.supply.queue].every(p=>p.id>0));
 assert.throws(()=>Q.importState(next.state),/shape/);assert.throws(()=>Q.transition(next.state,{kind:'observe'},{before:{position:next.position,inventory},after:{position:next.position,inventory}}),/shape/);
 assert.equal(I.importState(next.supply).status,'invalid');assert.equal(I.exportState(next.supply),null);assert.equal(I.matchesTransition(next,inventory,position,'HD',next.position),false);
 assert.throws(()=>Q.applyActual(state,{before:position,after:next.position,action:'HD',inventory,receipt:next}),/actual controller receipt/);
 const snapshot=X.exportState(X.start(position,{fresh:true}));snapshot.state=next.state;assert.throws(()=>X.importState(snapshot),/shape/);
 const SL=require('../st-sl-obligations'),O=require('../st-opening-obligations');assert.throws(()=>SL.importState(next.state.sl),/domain/);assert.throws(()=>O.importState(next.state.account),/shape/);
});
test('projection: observed unknown origin and unavailable-identity fallback remain explicitly unknown',()=>{
 const position=R.createState({active:'S',hold:'S',queue:['L','O'],streamCursor:12}),inventory=I.start(position),state=Q.start(position,{inventory});
 const observedRoot=P.start(state,{position,inventory}),unknown=P.startUnknown(position);
 assert.equal(observedRoot.supply.active.id,1);assert.equal(observedRoot.supply.active.bag,null);assert.equal(unknown.supply.active.id,-1);assert.equal(unknown.supply.hold.id,-2);
 const next=P.project(unknown,{witness:['HOLD','L','L','L','HD']});assert.equal(next.locked.id,-2);assert.equal(next.supply.hold.id,-1);assert.equal(next.state.availability,'unknown');assert.equal(next.state.account.known,false);assert.deepEqual(next.state.sl.residuals,[]);assert.equal(P.resolve(next).extraZ.status,'unknown');
 assert.equal(P.project(observedRoot,{witness:['L','L','L','HD']}).state.availability,'unknown');
});
test('projection: forced deduction allocates once without advancing observed frontier or inventing a bag',()=>{
 const position=R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}),root=freeze(P.startUnknown(position)),saved=copy(root),next=P.extendForced(root);
 assert.equal(next.position.queue.at(-1),'Z');assert.deepEqual(next.supply.queue.at(-1),{id:-7,type:'Z',bag:null,observedOrder:null});assert.equal(next.supply.nextSyntheticId,-8);assert.equal(next.supply.frontier,null);assert.equal(next.supply.originKnown,false);
 assert.deepEqual(P.extendForced(next),next);assert.deepEqual(root,saved);assert.equal(next.supply.knowledge.observedCount,7);assert.equal(root.supply.knowledge.observedCount,6);
 const ambiguous=P.startUnknown(R.createState({active:'I',queue:[],bag:B.fromObserved({observed:['I'],startPhase:null})}));assert.deepEqual(P.extendForced(ambiguous),ambiguous);
 const error=P.startUnknown(R.createState({active:'I',queue:[],bag:{remaining:[],error:'contradictory-observed-stream'}}));assert.deepEqual(P.extendForced(error),error);
});
test('projection: old same-letter HOLD has distinct subject and original bag after one or two holds',()=>{
 const x=trial('st-shadow-cross-bag',6),root=freeze(projectRoot(x)),saved=copy(root);assert.equal(root.supply.active.type,'L');assert.equal(root.supply.hold.type,'L');assert.notEqual(root.supply.active.bag,root.supply.hold.bag);
 const one=P.project(root,{witness:['HOLD','R','R180','HD']}),two=P.project(root,{witness:['HOLD','HOLD','R','R180','HD']});
 assert.equal(one.locked.id,root.supply.hold.id);assert.equal(one.locked.bag,0);assert.equal(two.locked.id,root.supply.active.id);assert.equal(two.locked.bag,1);assert.deepEqual(root,saved);
});
test('projection: synthetic L pays known exact S and debt as foreign without a null-bag residual',()=>{
 const x=trial('st-shadow-cross-bag',6),state=copy(x.context.state),target=state.center.pending.find(p=>p.family==='SL');assert.equal(target.rootId,3);
 state.center.debt=[{...copy(target),divertedPieceId:6}];
 const position=R.createState({...x.position,active:'I',hold:'L',queue:[],streamCursor:8});
 const root=checkedKnown(position,{state,active:observed(8,'I',1),hold:observed(7,'L',0),nextId:14,frontier:{bag:1,seenMask:127^(1<<2)},knowledge:{remaining:[1<<2],observedCount:13,provenance:'known-phase'}});
 const extended=P.extendForced(root),before=P.project(extended,{witness:['L','L','L','CW','HD']});assert.equal(before.supply.active.id,-1);assert.equal(before.state.center.pending[0].rootId,3);
 const paid=P.project(before,{witness:['R','R180','HD']});assert.equal(paid.locked.id,-1);assert.equal(paid.locked.bag,null);
 assert.deepEqual(paid.effects.filter(e=>e.domain==='center'&&e.rootId===3).map(e=>e.status),['fulfilled','debt-fulfilled']);
 assert.equal(paid.state.sl.residuals.find(b=>b.S?.id===3).S.pair,'foreign');assert.ok(paid.state.sl.residuals.every(b=>Number.isInteger(b.bag)));assert.equal(P.resolve(paid).hangingL.evidence[0].lId,7);
 assert.deepEqual(paid.supply.frontier,root.supply.frontier);assert.equal(root.state.center.pending.length,1);assert.equal(root.state.center.debt.length,1);
 const diverted=P.project(before,{witness:['L','L','L','HD']});assert.equal(diverted.effects.some(e=>e.domain==='center'&&e.status==='fulfilled'),false);assert.equal(diverted.state.center.pending[0].rootId,3);
});
test('projection: synthetic Center roots remain exact and settle without an observed identity',()=>{
 const position=R.createState({board:F.get('cap-rebuild').observation.board,active:'J',queue:['Z'],streamCursor:1}),root=P.startUnknown(position),created=P.project(root,{witness:['CW','HD']});
 assert.equal(created.state.center.pending[0].rootId,-1);assert.equal(created.state.center.pending[0].family,'ZJ');assert.throws(()=>Q.importState(created.state));
 const paid=P.project(created,{witness:['R','R','CW',...Array(7).fill('SD'),'L','HD']});assert.deepEqual(paid.state.center,{pending:[],debt:[]});assert.equal(paid.effects.find(e=>e.status==='fulfilled').partnerId,-2);assert.equal(paid.state.availability,'unknown');
});
test('projection: a forced synthetic Reset T gets one credit and completion, without changing actual origin facts',()=>{
 const state=established();state.account.reset={status:'active',remaining:2,firstTId:null,inheritedCovered:[]};
 const position=R.createState({active:'T',queue:['I'],streamCursor:6}),root=checkedKnown(position,{state,active:observed(6,'T',0),queue:[observed(8,'I',1)],nextId:14,frontier:{bag:1,seenMask:127^(1<<5)},knowledge:{remaining:[1<<5],observedCount:13,provenance:'known-phase'}}),extended=P.extendForced(root);
 const one=P.project(extended,{witness:['L','L','L','HD']});assert.equal(one.state.account.reset.firstTId,6);assert.equal(one.state.account.z.remaining,1);
 const filler=P.project(one,{witness:['CW','HD']}),two=P.project(filler,{witness:['L','L','HD']});
 assert.equal(two.locked.id,-1);assert.equal(two.state.account.z.remaining,2);assert.deepEqual(two.state.account.reset,{status:'inactive'});assert.equal(two.effects.filter(e=>e.status==='reset-T-credited').length,1);assert.equal(two.effects.filter(e=>e.status==='reset-completed').length,1);assert.equal(root.state.account.z.remaining,0);assert.deepEqual(two.supply.frontier,root.supply.frontier);
});
for(const f of require('./fixtures/resource-projection-history.json').cases)test('projection: known-to-unclassified effects survive compaction '+f.id,()=>{
 const x=actual(f.resourceContext.origin,f.resourceContext.steps,Infinity,f.resourceContext),root=projectRoot(x),before=P.resolve(root),next=P.project(root,{witness:f.witness}),after=P.resolve(next);
 assert.ok(next.effects.some(e=>e.domain==='sl'&&e.introducedUnclassified));
 const expected=Q.project(x.context.state,{position:x.position,inventory:x.context.inventory,witness:f.witness});assert.deepEqual(withoutDomain(next.state),expected.state);assert.deepEqual(next.effects,expected.effects);
 if(f.id.includes('lock-40')){assert.equal(A.knownToUnclassified(before,after,next.effects),true);assert.ok(next.effects.some(e=>e.status==='compacted'&&e.kind==='L'));}
});
test('projection: invalid witnesses, supply mismatches and namespace collisions fail atomically',()=>{
 const root=freeze(P.startUnknown(R.createState({active:'I',queue:['O']}))),saved=copy(root);
 for(const witness of [[],['HD','HD'],['TELEPORT','HD'],['L']])assert.throws(()=>P.project(root,{witness}));
 assert.throws(()=>P.project(root,{position:{...root.position,revision:99},witness:['HD']}),/explicit position/);
 for(const mutate of [p=>p.supply.queue[0].id=p.supply.active.id,p=>p.supply.active.bag=0,p=>p.supply.nextSyntheticId=0,p=>p.supply.queue[0].type='T']){const bad=copy(root);mutate(bad);assert.throws(()=>P.project(bad,{witness:['HD']}));}
 assert.deepEqual(root,saved);
});
test('projection: synthetic O pays a known LO root and updates its retained L disposition',()=>{
 const x=trial('st-resource-trial-2',15),state=copy(x.context.state),position=R.createState({...x.position,active:'I',hold:'S',queue:[],streamCursor:22});
 const root=checkedKnown(position,{state,active:observed(22,'I',3),hold:observed(15,'S',2),nextId:28,frontier:{bag:3,seenMask:127^(1<<3)},knowledge:{remaining:[1<<3],observedCount:27,provenance:'known-phase'}});
 const filler=P.project(P.extendForced(root),{witness:['L','L','L','HD']}),paid=P.project(filler,{witness:['R','HD']});
 assert.equal(paid.locked.type,'O');assert.equal(paid.locked.id,-1);assert.equal(paid.state.center.pending.some(p=>p.family==='LO'&&p.rootId===16),false);assert.equal(paid.state.sl.residuals.find(b=>b.L?.id===16).L.pair,'LO');assert.equal(paid.effects.filter(e=>e.status==='fulfilled'&&e.rootId===16).length,1);
});
test('projection: synthetic SL and LO targets can exist beside known accounting without invented residuals',()=>{
 for(const [name,until,type,witness,family]of [['st-shadow-cross-bag',5,'S',['HOLD','R','HD'],'SL'],['st-resource-trial-2',14,'L',['HOLD','CW','HD'],'LO']]){
  const x=trial(name,until),state=copy(x.context.state);
  // Supply a trusted CURRENT known checkpoint with no live same-bag duties.
  // The next publicly forced piece is a separate, unobserved subject, not the
  // historical fixture piece that produced the board shape used by this test.
  state.sl.residuals=[];state.center={pending:[],debt:[]};
  const mask=1<<'IJLOSTZ'.indexOf(type),position=R.createState({...x.position,active:'I',hold:null,queue:[],streamCursor:36});
  const root=checkedKnown(position,{state,active:observed(36,'I',5),nextId:42,frontier:{bag:5,seenMask:127^mask},knowledge:{remaining:[mask],observedCount:41,provenance:'known-phase'}}),next=P.project(P.extendForced(root),{witness});
  assert.equal(next.locked.id,-1);assert.equal(next.state.availability,'known');assert.ok(next.state.center.pending.some(p=>p.rootId===-1&&p.family===family),family+' target');assert.deepEqual(next.state.sl.residuals,[]);assert.deepEqual(Q.importProjection(copy(next.state)),next.state);assert.throws(()=>Q.importState(next.state));
 }
});
test('projection: a later actual reveal creates its own observed subject and never promotes the forced ID',()=>{
 const position=R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}),inventory=I.start(position),state=Q.start(position,{inventory}),root=P.start(state,{position,inventory}),forced=P.extendForced(root),saved=copy(forced);
 assert.equal(forced.supply.queue.at(-1).id,-1);assert.equal(forced.supply.nextObservedId,7);
 const moved=R.move(position,'HD'),after={...moved,queue:[...moved.queue,'Z'],bag:B.consume(position.bag,'Z')},receipt=I.transition(inventory,position,'HD',after);assert.equal(receipt.status,'available');
 const actual=Q.applyActual(state,{inventory,before:position,action:'HD',after,receipt}),fresh=P.start(actual.state,{position:after,inventory:receipt.next});
 assert.equal(fresh.supply.queue.at(-1).id,7);assert.equal(fresh.supply.queue.at(-1).bag,null);assert.equal(fresh.supply.nextSyntheticId,-1);assert.deepEqual(forced,saved);
 const unsupported=copy(root);unsupported.position.queue.push('Z');assert.throws(()=>P.project(unsupported,{witness:['HD']}),/position\/supply/);
});
test('projection: tagged codecs preserve positive root references and reject invented synthetic bag relations',()=>{
 const x=trial('st-shadow-cross-bag',6),root=projectRoot(x),snapshot=copy(root.state);
 snapshot.sl.residuals=[];assert.throws(()=>Q.importProjection(snapshot),/Center S\/L root reference/);
 const bad=copy(root.state);bad.sl.residuals[0].S.id=-1;assert.throws(()=>Q.importProjection(bad),/subject/);
 const unknown=P.startUnknown(R.createState({active:'J',queue:['O']}));
 unknown.state.center.pending=[{id:'collides',rootId:-1,family:'OJ',alternatives:[{piece:'J',cells:[[4,36],[4,37],[5,37],[6,37]]}]}];
 assert.throws(()=>P.resolve(unknown),/collides/);
});
