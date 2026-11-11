'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),C=require('../st-obligation-context'),Q=require('../st-obligation-state'),O=require('../st-opening-obligations'),T=require('../st-obligation-tracking');
const copy=x=>JSON.parse(JSON.stringify(x));
const first=()=>R.createState({active:'S',queue:[...'LIJOTZ'],streamCursor:1});
function player(origin=first(),{fresh=true,reviewed=false}={}){
 let position=R.createState(origin),context=C.start(position,{fresh}),locks=0,last;
 if(reviewed){const raw=C.exportState(context);raw.boundary.firstBagLocks=7;raw.state.sl.firstBagReview='unreviewed';raw.state.sl.foundationOpen=false;context=C.importState(raw,{position});}
 const events=[],monitor=T.create();monitor.subscribe(e=>events.push(e));
 const frame=()=>({status:context.status,reason:context.reason,state:context.state,view:C.resolve(context,{position})});
 function observe(before,result,operation){context=result.context;last={before,after:frame(),options:{effects:result.effects,operation,lock:locks}};monitor.transition(last.before,last.after,last.options);return last;}
 return{
  act(action,revealed=[]){const before=frame(),prior=position,next=R.move(prior,action);position={...next,queue:[...next.queue,...revealed]};const result=C.applyActual(context,{before:prior,after:position,action});if(action==='HD'&&result.receipt.accepted)locks++;if(!result.receipt.accepted)return null;return observe(before,result,action==='HD'?{kind:'lock',piece:result.receipt.locked,event:position.lastEvent}:{kind:'observe'});},
  lock(witness){for(const action of witness)this.act(action);return last;},
  handoff(){return observe(frame(),C.handoff(context,{position}),{kind:'handoff'});},
  begin(candidate=true){return observe(frame(),C.beginReset(context,{position,candidate}),{kind:'begin-reset'});},
  get context(){return context;},get position(){return position;},get frame(){return frame();},get locks(){return locks;},get events(){return events;},get monitor(){return monitor;},
 };
}
function trial(n,until=Infinity){const f=require('./support/st-resource-trial-'+n+'.json'),x=player(f.initial);for(const step of f.steps){if(x.locks>=until)break;x.act(step.action,step.revealed);}return x;}
function inspect(record){const events=[],m=T.create();m.subscribe(e=>events.push(e));m.transition(record.before,record.after,record.options);return events;}
function codes(record){return inspect(record).map(e=>e.code);}
const left=['L','L','L','HD'],right=['R','R','R','R','HD'];
function compaction(){const x=player(first(),{reviewed:true});const created=x.lock(left),compacted=x.lock(right);return{x,created,compacted};}
function deleteL(frame){frame.view.hangingL.evidence=[];frame.view.hangingL.status='none-observed';frame.state.sl.residuals=[];}

test('current tracking: actual supplied Context facts and all accepted inputs stay silent on public replays',()=>{
 for(const n of [1,2,5]){const x=trial(n);assert.equal(x.locks,32);assert.deepEqual(x.events,[]);assert.deepEqual(x.monitor.health(),{status:'ok',activeIssues:0});}
});
test('current tracking: real known-to-unknown compaction preserves uncertainty and is not payment or a ban',()=>{
 const {x,created,compacted}=compaction();
 assert.deepEqual(created.after.view.hangingL.evidence,[{bag:0,lId:2,sId:1}]);
 assert.deepEqual(compacted.after.state.sl.residuals,[]);assert.deepEqual(compacted.after.view.hangingL.aggregate,[1]);assert.equal(compacted.after.view.hangingL.unclassifiedCount,1);
 assert.ok(compacted.options.effects.some(e=>e.knownToUnclassified===true));assert.ok(compacted.options.effects.some(e=>e.status==='compacted'));assert.deepEqual(x.events,[]);
 const before=copy(compacted);inspect(compacted);assert.deepEqual(compacted,before,'Observer does not alter the actual facts or effects');
 const final=T.status(x.frame,{scope:'partial',throughLock:2,coverage:{status:'partial',reason:'Caller stopped the run.'},terminal:{kind:'lock-limit'}});
 assert.equal(final.obligations.hangingL.unclassifiedCount,1);assert.equal(final.availability,'known');assert.equal(final.scope,'partial');assert.deepEqual(final.terminal,{kind:'lock-limit'});
 assert.equal('admitted' in final,false);assert.equal('closedCounts' in final.obligations.center,false);
});
test('current tracking: compact severe S uncertainty keeps its exact severity bucket without rejecting the move',()=>{
 const x=player(R.createState({active:'L',queue:[...'SIJOTZ'],streamCursor:1}),{reviewed:true});x.lock(left);const record=x.lock(right);
 assert.deepEqual(x.events,[]);assert.deepEqual(record.after.view.hangingS.aggregate,[0,1,0,0]);assert.equal(record.after.view.hangingS.unclassifiedCount,1);
 const effect=record.options.effects.find(e=>e.status==='compacted'&&e.kind==='S');assert.equal(effect.subject.requiresAccommodation,true);assert.equal(effect.severity,1);
 const wrong=copy(record);wrong.options.effects.find(e=>e.status==='compacted').severity=0;assert.ok(codes(wrong).includes('effect-mismatch'));
 const lost=copy(record);lost.after.state.sl.uncertainty.S=[1,0,0,0];lost.after.view.hangingS.aggregate=[1,0,0,0];assert.ok(codes(lost).includes('uncertainty-balance-mismatch'));
});
test('current tracking: dropped live and latent counterpart duties are detected without a history',()=>{
 const {created}=compaction(),fault=copy(created);fault.before=copy(created.after);fault.after=copy(created.after);fault.options={operation:{kind:'observe'},effects:[]};deleteL(fault.after);
 assert.ok(codes(fault).includes('obligation-lost'));assert.ok(codes(fault).includes('counterpart-obligation-lost'));
 // A Center S not yet paired can be a latent counterpart consequence even when
 // no hanging row exists. Literal imported current facts are enough to inspect.
 const latent=copy(fault);latent.before.view.hangingL.evidence=[];latent.before.view.hangingL.status='none-observed';
 assert.ok(codes(latent).includes('counterpart-obligation-lost'));
});
test('current tracking: equal-count identity replacement cannot conceal the missing live duty',()=>{
 const {created}=compaction(),fault={before:copy(created.after),after:copy(created.after),options:{operation:{kind:'observe'},effects:[]}};
 fault.after.view.hangingL.evidence[0].lId=99;fault.after.state.sl.residuals[0].S.id=88;
 const events=inspect(fault);assert.ok(events.some(e=>e.code==='classification-effect-mismatch'));assert.ok(events.some(e=>e.code==='counterpart-identity-lost'));
 assert.equal(fault.before.view.hangingL.evidence.length,fault.after.view.hangingL.evidence.length);
});
test('current tracking: dropped creation, mismatched identity and omitted compaction effects are independently detected',()=>{
 const {created,compacted}=compaction();
 const missingCreation=copy(created);missingCreation.options.effects=missingCreation.options.effects.filter(e=>e.domain!=='sl');assert.ok(codes(missingCreation).includes('classification-effect-mismatch'));
 const erasedCreation=copy(missingCreation);deleteL(erasedCreation.after);assert.ok(codes(erasedCreation).includes('counterpart-lock-unaccounted'));
 const wrongCreation=copy(created);wrongCreation.options.effects.find(e=>e.domain==='sl').after.lId=200;assert.ok(codes(wrongCreation).includes('classification-effect-mismatch'));
 const omitted=copy(compacted);omitted.options.effects=omitted.options.effects.filter(e=>e.status!=='compacted');assert.ok(codes(omitted).includes('obligation-lost'));assert.ok(codes(omitted).includes('uncertainty-balance-mismatch'));
 const wrong=copy(compacted);wrong.options.effects.find(e=>e.status==='compacted').subject.lId=200;assert.ok(codes(wrong).includes('effect-mismatch'));
 const lost=copy(compacted);lost.after.state.sl.uncertainty.L=[0];Object.assign(lost.after.view.hangingL,{aggregate:[0],unclassifiedCount:0,status:'none-observed'});assert.ok(codes(lost).includes('uncertainty-balance-mismatch'));
});
test('current tracking: a fabricated paid or compacted label cannot excuse a still-live counterpart',()=>{
 const {created}=compaction(),fault={before:copy(created.after),after:copy(created.after),options:{operation:{kind:'observe'},effects:[]}};
 const old={category:'hanging',bag:0,lId:2,sId:1};deleteL(fault.after);
 fault.options.effects=[{domain:'sl',status:'classification-changed',kind:'L',bag:0,before:old,after:null,cause:'observe',introducedUnclassified:false,knownToUnclassified:false}];
 assert.ok(codes(fault).includes('obligation-resolution-unexplained'));
 const compact=copy(fault),subject={...old,category:'unclassified'};compact.options.effects[0].after=subject;compact.options.effects[0].introducedUnclassified=true;compact.options.effects[0].knownToUnclassified=true;
 compact.options.effects.push({domain:'sl',status:'compacted',kind:'L',subject,severity:0});compact.after.state.sl.uncertainty.L=[1];Object.assign(compact.after.view.hangingL,{aggregate:[1],unclassifiedCount:1,status:'unknown'});
 assert.ok(codes(compact).includes('effect-mismatch'));assert.ok(codes(compact).includes('counterpart-obligation-lost'));
});
test('current tracking: actual payment retires duties while handoff exempts current aggregates exactly once',()=>{
 const x=player(first(),{reviewed:true});x.lock(left);x.lock(left);assert.deepEqual(x.events,[]);assert.equal(x.frame.view.hangingL.evidence.length,0);
 const {x:y}=compaction(),h=y.handoff();assert.deepEqual(y.events,[]);assert.deepEqual(h.after.view.hangingL.aggregate,[0]);assert.ok(h.options.effects.some(e=>e.status==='opening-exempted'));
 y.handoff();assert.deepEqual(y.events,[]);
 const missing=copy(h);missing.options.effects=[];assert.ok(codes(missing).includes('uncertainty-balance-mismatch'));
 const unrelated=copy(h);unrelated.after.state.dPending=true;unrelated.after.view.dPattern.pending=true;assert.ok(codes(unrelated).includes('handoff-changed-unrelated-duty'));
 const repeated={before:copy(h.after),after:copy(h.after),options:copy(h.options)};assert.ok(codes(repeated).includes('effect-mismatch'));
});
test('current tracking: Left payment must use the named subject rather than only a matching bag and type',()=>{
 const x=player(first(),{reviewed:true});x.lock(left);const paid=x.lock(left);assert.deepEqual(inspect(paid),[]);
 const wrong=copy(paid);wrong.options.operation.piece.id=99;
 assert.ok(codes(wrong).includes('obligation-resolution-unexplained'));
});
test('current tracking: exact Center payment uses one-operation effects, not old closure or pair arrays',()=>{
 const x=player(),source=trial(1,10).frame;
 // Keep the independent expected target literal; no historical classifier is
 // used to derive payment. Both current facets name the same exact obligation.
 const p={id:'piece-90',rootId:90,family:'OJ',alternatives:[{piece:'J',cells:[[4,38],[4,39],[5,39],[6,39]]}]};
 const before=copy(source),after=copy(source);before.state.center={pending:[p],debt:[{...copy(p),divertedPieceId:91}]};before.view.center=copy(before.state.center);after.state.center={pending:[],debt:[]};after.view.center=copy(after.state.center);
 const event={type:'J',cells:copy(p.alternatives[0].cells),lines:0,clearedRows:[],spin:'none',topOut:false};
 const options={operation:{kind:'lock',piece:{id:92,type:'J',bag:12},event},effects:[{domain:'center',...copy(p),status:'fulfilled',partnerId:92},{domain:'center',...copy(p),divertedPieceId:91,status:'debt-fulfilled',partnerId:92}]};
 assert.deepEqual(inspect({before,after,options}),[]);
 const dropped=copy({before,after,options});dropped.options.effects.pop();assert.ok(codes(dropped).includes('center-obligation-lost'));
 const wrong=copy({before,after,options});wrong.options.effects[0].partnerId=93;assert.ok(codes(wrong).includes('effect-mismatch'));
 const swapped=copy({before,after:before,options:{operation:{kind:'observe'},effects:[]}});swapped.after.state.center.pending[0].id='piece-94';swapped.after.state.center.debt[0].id='piece-94';swapped.after.view.center=copy(swapped.after.state.center);assert.ok(codes(swapped).includes('center-obligation-lost'));
 assert.deepEqual(x.events,[]);
});
test('current tracking: actual Reset credit/completion retire one duty without awarding completion credit',()=>{
 const x=trial(1,24);assert.equal(x.context.state.account.z.remaining,0);x.begin(false);x.begin();x.begin();x.lock(left);for(let n=0;n<4;n++)x.lock(['HD']);const done=x.lock(left);
 assert.deepEqual(x.events,[]);assert.deepEqual(done.after.state.account.reset,{status:'inactive'});assert.equal(done.options.effects.filter(e=>e.status==='reset-T-credited').length,1);assert.equal(done.options.effects.filter(e=>e.status==='reset-completed').length,1);
 const double=copy(done);double.after.state.account.z.remaining+=2;double.after.view.extraZ.remaining+=2;assert.ok(codes(double).includes('extra-z-balance-mismatch'));
 const duplicated=copy(done);duplicated.options.effects.push(copy(duplicated.options.effects.find(e=>e.status==='reset-T-credited')));assert.ok(codes(duplicated).includes('effect-mismatch'));assert.ok(codes(duplicated).includes('extra-z-balance-mismatch'));
 const absent=copy(done);absent.options.effects=absent.options.effects.filter(e=>e.status!=='reset-completed');assert.ok(codes(absent).includes('reset-duty-lost'));
 const wrong=copy(done);wrong.options.effects.find(e=>e.status==='reset-T-credited').pieceId=999;assert.ok(codes(wrong).includes('effect-mismatch'));
 const replay={before:copy(done.after),after:copy(done.after),options:copy(done.options)};assert.ok(codes(replay).includes('effect-mismatch'));
});
test('current tracking: established Z balance cannot disappear while a profile-only label change is not loss',()=>{
 const before=trial(1,20).frame;assert.equal(before.state.account.z.remaining,1);
 const options={operation:{kind:'observe'},effects:[]},lost=copy(before);
 lost.state.account.z.remaining=null;lost.view.extraZ.remaining=null;
 assert.ok(codes({before,after:lost,options}).includes('extra-z-balance-mismatch'));
 const relabeled=copy(before);relabeled.view.extraZ.status='out-of-profile';
 assert.deepEqual(inspect({before,after:relabeled,options}),[],'A status label alone is not a missing balance');
 assert.deepEqual(inspect({before,after:copy(before),options}),[]);
});
test('current tracking: active Reset preserves inherited covered duties until current safety retires or translates them',()=>{
 const x=trial(1,24);x.begin();const before=copy(x.frame);before.state.center={pending:[],debt:[]};before.view.center=copy(before.state.center);
 before.state.safety.coveredCells=[[1,35]];before.view.coveredRepair.cells=[[1,35]];before.state.account.reset.inheritedCovered=[[1,35]];
 const dormant=copy(before);dormant.state.safety.coveredCells=[];dormant.view.coveredRepair.cells=[];dormant.state.account=O.importState(dormant.state.account);
 // The standalone account codec trusts these supplied references. An observer
 // must not apply lock-only reconciliation during movement or repeated Begin.
 for(const kind of ['observe','begin-reset'])assert.deepEqual(inspect({before:dormant,after:dormant,options:{operation:{kind},effects:[]}}),[]);
 const dropped=copy(before);dropped.state.account.reset.inheritedCovered=[];
 assert.ok(codes({before,after:dropped,options:{operation:{kind:'observe'},effects:[]}}).includes('reset-covered-obligation-mismatch'));
 const after=copy(before);after.state.safety.coveredCells=[[1,39]];after.view.coveredRepair.cells=[[1,39]];after.state.account.reset.inheritedCovered=[[1,39]];
 const operation={kind:'lock',piece:{type:'I',id:200,bag:28},event:{type:'I',cells:[[8,36],[8,37],[8,38],[8,39]],lines:4,clearedRows:[36,37,38,39],spin:'none',topOut:false}},effects=[{domain:'safety',status:'current-safety-changed'}];
 assert.deepEqual(inspect({before,after,options:{operation,effects}}),[]);
 const cleared=copy(after);cleared.state.safety.coveredCells=[];cleared.view.coveredRepair.cells=[];cleared.state.account.reset.inheritedCovered=[];
 assert.deepEqual(inspect({before,after:cleared,options:{operation,effects}}),[]);
});
function withAccount(frame,account,board=Array(40).fill('..........')){
 const out=copy(frame);out.state.account=O.importState(account);Object.assign(out.view,O.resolve(account,{board}));return out;
}
const ordinaryO={kind:'lock',piece:{id:5,type:'O',bag:0},event:{type:'O',cells:[[0,38],[1,38],[0,39],[1,39]],lines:0,clearedRows:[],spin:'none',topOut:false}};
test('current tracking: temporary opening duties, roof and finite permission flags cannot silently disappear',()=>{
 const source=player().frame,allocation=copy(source.state.account),options={operation:ordinaryO,effects:[]};
 assert.deepEqual(inspect({before:source,after:source,options}),[]);
 const removed=withAccount(source,{...copy(allocation),opening:null});assert.ok(codes({before:source,after:removed,options}).includes('opening-duty-lost'));
 const quality={...copy(allocation),firstTsd:true,allocationVerified:true,mandatoryZ:true,thirdTWindow:true,qualityCandidate:true,opening:{kind:'quality',imbalance:0},profile:{...allocation.profile,before:null}};
 const before=withAccount(source,quality);assert.deepEqual(inspect({before,after:before,options}),[],'Trusted current quality is observed directly, without proving its origin');
 for(const field of ['thirdTWindow','qualityCandidate']){
  const after=copy(before);after.state.account[field]=false;assert.ok(inspect({before,after,options}).some(e=>e.code==='account-effect-mismatch'&&e.identity.field===field));
 }
 const after=copy(before);after.state.account.opening=null;after.view.qualityPending=false;assert.ok(codes({before,after,options}).includes('opening-duty-lost'));
 const roof=trial(1,14).frame,missingRoof=copy(roof);missingRoof.state.account.opening.roof=null;assert.ok(codes({before:roof,after:missingRoof,options}).includes('opening-roof-lost'));
 const imbalance=copy(source);imbalance.state.account.opening.imbalance=2;assert.ok(codes({before:source,after:imbalance,options}).includes('opening-imbalance-mismatch'));
});
test('current tracking: the first TSD may create and disqualify a quality duty within the same operation',()=>{
 const x=trial(1,14),priorBoard=copy(x.position.board),fixture=require('./support/st-resource-trial-1.json');let count=0,record;
 for(const step of fixture.steps){if(count===14)record=x.act(step.action,step.revealed);if(step.action==='HD')count++;if(count===15)break;}
 assert.ok(record.options.effects.some(e=>e.status==='opening-allocation-verified'));
 const before=copy(record.before),after=copy(record.after),account=copy(before.state.account);account.profile.before.checkpoint=false;
 const debt={id:'piece-90',rootId:90,family:'OJ',divertedPieceId:91,alternatives:[{piece:'J',cells:[[4,38],[4,39],[5,39],[6,39]]}]};
 const loss={domain:'center',...copy(debt),status:'debt-invalidated',reason:'Current target was removed.'};
 before.state.center.debt.push(copy(debt));before.view.center=copy(before.state.center);
 const operation=record.options.operation,result=O.transition(account,{...operation,centerEffects:[loss]},{before:{board:priorBoard},after:{board:x.position.board,topOut:x.position.topOut,center:after.state.center,sl:after.view,coveredCells:after.state.safety.coveredCells}});
 assert.equal(result.effects.filter(e=>e.status==='quality-disqualified').length,1);assert.equal(result.state.opening,null);assert.equal(result.state.z.remaining,null);assert.equal(result.state.qualityCandidate,false);
 const options={...record.options,effects:[...record.options.effects.filter(e=>e.domain!=='account'),loss,...result.effects.map(e=>({domain:'account',...e}))]};
 assert.deepEqual(inspect({before:withAccount(before,account,priorBoard),after:withAccount(after,result.state,x.position.board),options}),[]);
});
test('current tracking: optional projection compares exact current facts only after an observed actual lock',()=>{
 const x=player(),position=x.position,current=x.context,projected=Q.project(current.state,{position,inventory:current.inventory,witness:['HD']});
 const projectedFrame={status:'available',state:Q.toProjection(projected.state),view:Q.resolve(projected.state,{position:projected.position,inventory:projected.inventory})},actual=x.lock(['HD']);
 actual.options.projected=projectedFrame;assert.deepEqual(inspect(actual),[]);
 const hypothetical={before:projectedFrame,after:projectedFrame,options:{operation:{kind:'observe'},effects:[]}};assert.ok(codes(hypothetical).includes('tracking-check-failed'));
 const mismatch=copy(actual);mismatch.options.projected.state.dPending=!mismatch.options.projected.state.dPending;mismatch.options.projected.view.dPattern.pending=mismatch.options.projected.state.dPending;assert.ok(codes(mismatch).includes('projection-mismatch'));
 const arbitrary=copy(actual);arbitrary.options.operation={kind:'observe'};assert.ok(codes(arbitrary).includes('tracking-check-failed'));
});
test('current tracking: unknown, unavailable and caller-censored final status remain distinct',()=>{
 const known=player().frame,unknown=player(first(),{fresh:false}).frame,unavailable={status:'unavailable',reason:'Accounting failure',state:null,view:{status:'unavailable',availability:'unavailable',reason:'Accounting failure'}};
 assert.deepEqual(inspect({before:unknown,after:unknown,options:{operation:{kind:'observe'},effects:[]}}),[]);
 for(const after of [unknown,unavailable])assert.ok(codes({before:known,after,options:{operation:{kind:'observe'},effects:[]}}).includes('availability-changed'));
 assert.ok(codes({before:unavailable,after:known,options:{operation:{kind:'observe'},effects:[]}}).includes('availability-changed'));
 const u=T.status(unavailable,{throughLock:14}),partial=T.status(unknown,{scope:'partial',throughLock:14,coverage:{status:'partial',reason:'Imported origin'}});
 assert.equal(u.obligations,null);assert.equal(u.availability,'unavailable');assert.equal(u.coverage,null);assert.equal(partial.availability,'unknown');assert.equal(partial.obligations.hangingS.status,'unknown');assert.equal(partial.throughLock,14);
 assert.equal(T.status(known,{scope:'unavailable'}).obligations,null);assert.throws(()=>T.status(known,{scope:'complete'}),/scope/);
});
test('current tracking: unknown-origin numeric imports reject and supported unknown facts retain no balance',()=>{
 const position=first(),context=C.start(position),raw=C.exportState(context);
 Object.assign(raw.state.account,{firstTsd:true,allocationVerified:true,opening:null,profile:{violation:false,departure:false,before:null,capEstablished:false},z:{remaining:3,uncredited:'none'}});
 assert.throws(()=>C.importState(raw,{position}),/Invalid unknown Z account/);raw.state.account.z.remaining=null;
 const supplied=C.importState(raw,{position}),frame={status:supplied.status,state:supplied.state,view:C.resolve(supplied,{position})};
 assert.equal(frame.state.account.z.remaining,null);assert.equal(frame.view.extraZ.remaining,null);assert.equal(frame.view.availability,'unknown');
 assert.deepEqual(inspect({before:frame,after:frame,options:{operation:{kind:'observe'},effects:[]}}),[]);
 const final=T.status(frame);assert.equal(final.availability,'unknown');assert.equal(final.obligations.extraZ.remaining,null);assert.equal(final.obligations.extraZ.baseline,false);
 const after=R.move(position,'HD'),result=C.applyActual(supplied,{before:position,after,action:'HD'}),next={status:result.context.status,state:result.context.state,view:C.resolve(result.context,{position:after})};
 assert.deepEqual(inspect({before:frame,after:next,options:{operation:{kind:'lock',piece:result.receipt.locked,event:after.lastEvent},effects:result.effects}}),[]);
});
test('current tracking: unchanged anomalies deduplicate, resolution clears them, and reappearance emits again',()=>{
 const {created}=compaction(),fault={before:copy(created.after),after:copy(created.after),options:{operation:{kind:'observe'},effects:[],lock:1}};deleteL(fault.after);
 const events=[],m=T.create();m.subscribe(e=>events.push(e));m.transition(fault.before,fault.after,fault.options);const first=events.length;assert.ok(first>0);
 for(let n=0;n<100;n++)m.transition(fault.before,fault.after,{...fault.options,lock:n+2});assert.equal(events.length,first);assert.equal(m.health().activeIssues,first);
 m.transition(created.after,created.after,{operation:{kind:'observe'},effects:[],lock:102});assert.equal(m.health().activeIssues,0);
 m.transition(fault.before,fault.after,{...fault.options,lock:103});assert.equal(events.length,first*2);assert.equal(events.at(-1).lock,103);
});
test('current tracking: subscribers and inspection failures cannot interrupt actual moves or mutate sibling notifications',()=>{
 const {created}=compaction(),fault={before:copy(created.after),after:copy(created.after),options:{operation:{kind:'observe'},effects:[]}};deleteL(fault.after);
 const m=T.create(),events=[];let calls=0;m.subscribe(()=>{calls++;throw Error('broken observer');});m.subscribe(e=>{e.code='mutated';});const unsubscribe=m.subscribe(e=>events.push(e));
 assert.doesNotThrow(()=>m.transition(fault.before,fault.after,fault.options));assert.equal(calls,1);assert.ok(events.some(e=>e.code==='tracking-observer-failed'));assert.ok(events.some(e=>e.code==='obligation-lost'));assert.equal(m.health().status,'failed');assert.equal(m.health().firstFailure.message,'broken observer');
 m.transition({},fault.after,fault.options);assert.ok(events.some(e=>e.code==='tracking-check-failed'));unsubscribe();assert.throws(()=>m.subscribe(null),/function/);
});
test('current tracking: repeated fixed current states and retired issue identities leave bounded status and dedup storage',()=>{
 const {x,created,compacted}=compaction(),m=T.create(),events=[];m.subscribe(e=>events.push(e));const initial=T.status(x.frame),bytes=JSON.stringify(initial).length;
 for(let n=0;n<1000;n++){
  m.transition(compacted.before,compacted.after,compacted.options);
  const status=T.status(x.frame);assert.deepEqual(status,initial);assert.equal(JSON.stringify(status).length,bytes);assert.equal(m.health().activeIssues,0);
 }
 assert.deepEqual(events,[]);
 // New anomaly IDs may be reported externally, but none survives its current
 // stage's resolution. This observer has no count of past IDs or effects.
 for(let n=0;n<1000;n++){
  const before=copy(created.after),after=copy(created.after);before.state.sl.residuals[0].S.id=n+100;before.view.hangingL.evidence[0].sId=n+100;deleteL(after);
  m.transition(before,after,{operation:{kind:'observe'},effects:[]});assert.ok(m.health().activeIssues<=3);
  m.transition(x.frame,x.frame,{operation:{kind:'observe'},effects:[]});assert.equal(m.health().activeIssues,0);
 }
 assert.equal('history' in initial,false);assert.equal('effects' in initial,false);assert.equal('closed' in initial.obligations.center,false);
});
test('current tracking: classic script exposes the same dependency-free unwired observer',()=>{
 const sandbox={};vm.runInNewContext(fs.readFileSync(require.resolve('../st-obligation-tracking'),'utf8'),sandbox);assert.equal(typeof sandbox.STObligationTracking.create,'function');assert.equal(typeof sandbox.STObligationTracking.status,'function');
 const events=[],m=sandbox.STObligationTracking.create();m.subscribe(e=>events.push(e));const frame=player().frame;m.transition(frame,frame,{operation:{kind:'observe'},effects:[]});assert.deepEqual(events,[]);
});

test('current tracking: observed Left T auto-start reconciles progress separately from known credit',()=>{
 const source=trial(1,24).frame;
 const operation={kind:'lock',piece:{id:300,type:'T',bag:42},event:{type:'T',cells:[[1,37],[0,38],[1,38],[2,38]],lines:0,clearedRows:[],spin:'none',topOut:false}};
 for(const status of ['inactive','invalid']){
  const before=copy(source);before.state.account.reset={status};before.view.reset.status=status;
  const after=copy(before);after.state.account.reset={status:'active',remaining:1,firstTId:300,inheritedCovered:copy(before.state.safety.coveredCells)};after.view.reset.status='active';after.state.account.z.remaining++;after.view.extraZ.remaining++;
  const effects=[{domain:'account',status:'reset-started',source:'observed-left-T',pieceId:300},{domain:'account',status:'reset-T-observed',pieceId:300},{domain:'account',status:'reset-T-credited',pieceId:300,delta:1}];
  const record={before,after,options:{operation,effects}};assert.deepEqual(inspect(record),[]);
  for(const status of ['reset-started','reset-T-observed','reset-T-credited']){
   const missing=copy(record);missing.options.effects=missing.options.effects.filter(e=>e.status!==status);assert.notDeepEqual(codes(missing),[],status+' missing');
   const duplicated=copy(record);duplicated.options.effects.push(copy(effects.find(e=>e.status===status)));assert.ok(codes(duplicated).includes('effect-mismatch'),status+' duplicated');
  }
  const erased=copy(record);erased.after=copy(before);erased.options.effects=[];assert.ok(codes(erased).includes('reset-progress-mismatch'));assert.ok(codes(erased).includes('reset-start-mismatch'));assert.ok(codes(erased).includes('reset-credit-mismatch'));
 }
});

test('current tracking: unknown history observes Reset progress and first TSD without inventing Z credit',()=>{
 const source=player(first(),{fresh:false}).frame;
 const event={type:'T',cells:[[1,37],[0,38],[1,38],[2,38]],lines:0,clearedRows:[],spin:'none',topOut:false};
 for(const handoff of [false,true]){
  const before=copy(source);before.state.account.firstTsd=!handoff;before.state.sl.handoff=handoff;
  const after=copy(before);after.state.account.reset={status:'active',remaining:1,firstTId:300,inheritedCovered:[]};after.view.reset.status='active';
  const record={before,after,options:{operation:{kind:'lock',piece:{id:300,type:'T',bag:null},event},effects:[{domain:'account',status:'reset-started',source:'observed-left-T',pieceId:300},{domain:'account',status:'reset-T-observed',pieceId:300}]}};
  assert.deepEqual(inspect(record),[]);assert.equal(after.state.account.z.remaining,null);
  const credited=copy(record);credited.options.effects.push({domain:'account',status:'reset-T-credited',pieceId:300,delta:1});assert.ok(codes(credited).includes('unknown-account-changed'));assert.ok(codes(credited).includes('reset-credit-mismatch'));
  const completed=copy(record);completed.before=copy(after);completed.after=copy(after);completed.after.state.account.reset={status:'inactive'};completed.after.view.reset.status='inactive';completed.options.operation.piece.id=301;completed.options.effects=[{domain:'account',status:'reset-T-observed',pieceId:301},{domain:'account',status:'reset-completed'}];assert.deepEqual(inspect(completed),[]);
 }
 const after=copy(source);after.state.account.firstTsd=true;
 assert.deepEqual(inspect({before:source,after,options:{operation:{kind:'lock',piece:{id:300,type:'T',bag:null},event:{...event,lines:2,clearedRows:[38,39],spin:'full'}},effects:[{domain:'account',status:'first-tsd',pieceId:300}]}}),[]);
});

test('current tracking: actual unknown handoff permits observed Reset without classifying historical S/L',()=>{
 const x=player(R.createState({active:'T',queue:[...'IJLOZS'],streamCursor:1}),{fresh:false});
 const original=copy(x.frame.state.sl),handoff=x.handoff();assert.equal(handoff.after.state.sl.handoff,true);assert.equal(handoff.after.state.sl.foundationOpen,false);
 assert.deepEqual(handoff.after.state.sl,{...original,handoff:true,foundationOpen:false});assert.deepEqual(x.events,[]);
 const forged=copy(handoff);forged.after.state.sl.firstBagReview='reviewed';assert.ok(codes(forged).includes('unknown-sl-changed'));
 x.handoff();const observed=x.lock(left);assert.equal(observed.after.state.account.reset.status,'active');assert.equal(observed.after.state.account.reset.remaining,1);assert.equal(observed.after.state.account.firstTsd,false);assert.equal(observed.after.state.account.z.remaining,null);
 assert.deepEqual(x.events,[]);assert.deepEqual(observed.after.state.sl,handoff.after.state.sl);
});

test('current tracking: a fresh regional departure invalidates restarted Reset despite the prior departure flag',()=>{
 const source=trial(1,24).frame,account=copy(source.state.account);account.profile.departure=true;account.reset={status:'active',remaining:1,firstTId:999,inheritedCovered:[]};
 const before=withAccount(source,account),operation={kind:'lock',piece:{id:1000,type:'J',bag:100},event:{type:'J',cells:[[8,36],[8,37],[8,38],[9,38]],lines:0,clearedRows:[],spin:'none',topOut:false}};
 const board=Array(40).fill('..........'),result=O.transition(account,{...operation,centerEffects:[]},{before:{board},after:{board,topOut:false,center:source.state.center,sl:source.view,coveredCells:[]}});
 assert.equal(result.state.reset.status,'invalid');assert.equal(result.state.profile.departure,true);assert.ok(result.effects.some(e=>e.status==='reset-invalidated'));assert.equal(result.effects.some(e=>e.status==='profile-departure'),false);
 const after=withAccount(source,result.state);assert.deepEqual(inspect({before,after,options:{operation,effects:result.effects.map(e=>({domain:'account',...e}))}}),[]);
});
