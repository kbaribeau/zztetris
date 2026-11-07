'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../st-rules'),I=require('../st-public-inventory'),Q=require('../st-obligation-state'),P=require('../st-obligation-projection');
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function origin(active='I'){
 const position=R.createState({active,queue:[...'IJLOSTZ'].filter(t=>t!==active),streamCursor:1}),inventory=I.start(position,{fresh:true}),state=Q.start(position,{inventory});return P.start(state,{position,inventory});
}
function compactionRoot(){
 const root=origin('S');for(const p of [root.supply.active,...root.supply.queue]){p.id+=20;p.bag=2;p.observedOrder+=14;}root.supply.nextObservedId+=20;root.supply.frontier={bag:3,seenMask:0};
 root.state.sl.foundationOpen=false;root.state.sl.firstBagReview='unreviewed';
 root.state.sl.residuals=[{bag:1,S:{id:8,region:'left-center',opening:true,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:true,invalidated:false},L:{id:9,region:'left',opening:true,pair:null,nonRight:true},order:'L-first',sOwedSinceL:false,lBeforeSPair:false}];
 return root;
}
const compacted={domain:'sl',status:'compacted',kind:'S',subject:{category:'unclassified',bag:1,sId:8,lId:9,requiresAccommodation:true},severity:1};
function spy(){
 const calls=[],module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../st-obligation-projection.js'),'utf8'),{module,require:id=>id==='./st-obligation-state'?{...Q,projectTransition:(s,o,c)=>{const result=Q.projectTransition(s,o,c);calls.push({kind:o.kind,holdChanged:c.before.position.hold!==c.after.position.hold,before:copy(s),after:copy(result.state),effects:copy(result.effects)});return result;}}:require(path.join(__dirname,'..',id))});return{P:module.exports,calls};
}
function pair(root,witness,options={}){
 const references=options.references||[],before=copy(root),slow=P.project(root,{...options,witness,references}),fast=P.project(root,{...options,witness,references:P.referenceSnapshot(references)});assert.deepEqual(fast,slow);assert.deepEqual(root,before);return fast;
}
test('settled observe: literal first compaction precedes new lock effects and occurs once',()=>{
 const root=freeze(compactionRoot()),result=pair(root,['L','R','L','L','HD']);assert.deepEqual(result.effects[0],compacted);assert.equal(result.effects.filter(e=>e.status==='compacted'&&e.subject?.sId===8).length,1);assert.deepEqual(result.state.sl.uncertainty.S,[0,1,0,0]);
 assert.ok(result.effects.slice(1).some(e=>e.status==='classification-changed'),'The first observe effect must precede the new lock classification.');
});
test('settled observe: immutable snapshot is owned, detached, and cannot be forged by freezing',()=>{
 const {P:p,calls}=spy(),raw=[8],snapshot=p.referenceSnapshot(raw);assert.equal(Object.isFrozen(snapshot),true);raw[0]=9;assert.deepEqual(Array.from(snapshot),[8]);assert.throws(()=>snapshot.push(99));assert.throws(()=>{snapshot[0]=99;});
 const witness=['L','R','L','L','HD'],root=compactionRoot();p.project(root,{witness,references:snapshot});assert.deepEqual(calls.map(x=>x.kind),['observe','lock']);calls.length=0;
 for(const refs of [[8],Object.freeze([8]),new Proxy(Object.freeze([8]),{})]){p.project(root,{witness,references:refs});assert.equal(calls.length,witness.length);calls.length=0;}
 for(const refs of [null,{},[0],[NaN],[1.1],[Number.MAX_SAFE_INTEGER+1],Array(1)])assert.throws(()=>p.referenceSnapshot(refs),/current caller references/);
});
test('settled observe: HD-only adds no observe; each HOLD and HD remains a full operation',()=>{
 for(const witness of [['HD'],['L','R','HD'],['HOLD','L','R','HOLD','L','R','HD'],['L','R','HOLD','L','R','HOLD','L','R','HD']]){
  const {P:p,calls}=spy();p.project(origin(),{witness,references:p.referenceSnapshot([])});
  assert.equal(calls.filter(c=>c.kind==='lock').length,1);assert.equal(calls.filter(c=>c.holdChanged).length,witness.filter(a=>a==='HOLD').length);
  assert.equal(calls.length,1+witness.filter(a=>a==='HOLD').length+(witness[0]!=='HD'&&witness[0]!=='HOLD'?1:0));
  pair(origin(),witness);
 }
});
test('settled observe: duplicate typed-bag HOLD keeps both literal counterpart identity changes',()=>{
 const root=compactionRoot();root.state.sl.residuals[0].S=null;root.state.sl.residuals[0].order=null;root.supply.active.bag=1;root.supply.queue[0].type='S';root.supply.queue[0].bag=1;root.position.queue[0]='S';
 const result=pair(root,['L','R','HOLD','L','R','HOLD','L','L','HD'],{references:[9]});const changed=result.effects.filter(e=>e.status==='classification-changed'&&e.kind==='S');
 assert.deepEqual(changed.slice(0,2).map(e=>[e.before.sId,e.after.sId]),[[21,22],[22,21]]);
});
test('settled observe: live raw reference changes and getters retain the full public path',()=>{
 const root=compactionRoot(),refs=[8],witness=['L','R','L','L','HD'];witness[Symbol.iterator]=function*(){yield 'L';refs.length=0;yield 'R';yield 'L';yield 'L';yield 'HD';};
 const {P:p,calls}=spy(),result=p.project(root,{witness,references:refs});assert.equal(calls.length,5);assert.deepEqual(copy(result.effects[0]),compacted);assert.equal(calls[0].after.sl.residuals.length,1);assert.equal(calls[1].after.sl.residuals.length,0);
 let reads=0;const dynamic=[];Object.defineProperty(dynamic,'0',{enumerable:true,get(){return ++reads<=2?8:0;}});Object.freeze(dynamic);assert.throws(()=>P.project(root,{witness:['L','R','HD'],references:dynamic}),/current caller references/);
 const original=[8],snapshot=P.referenceSnapshot(original);original.length=0;assert.deepEqual(P.project(root,{witness:['L','R','HD'],references:snapshot}),P.project(root,{witness:['L','R','HD'],references:[8]}));
});
test('settled observe: pending review and Center references retain exact current residuals',()=>{
 const pending=compactionRoot();pending.state.sl.residuals[0].bag=0;pending.state.sl.firstBagReview='pending';
 pair(pending,['L','R','L','L','HD'],{boundary:{firstBagReview:'unreviewed'}});
 const center=compactionRoot();center.state.center.pending=[{id:'sl-8',rootId:8,family:'SL',alternatives:[{piece:'L',cells:[[4,37],[4,38],[4,39],[5,39]]}]}];
 const {P:p,calls}=spy();p.project(center,{witness:['L','R','L','L','HD'],references:p.referenceSnapshot([])});assert.equal(calls[0].after.sl.residuals.length,1);pair(center,['L','R','L','L','HD']);
});
test('settled observe: current Reset and Left duties survive plain moves without inferred history',()=>{
 const root=compactionRoot(),a=root.state.account;a.firstTsd=true;a.allocationVerified=true;a.opening=null;a.profile.before=null;a.z={remaining:0,uncredited:'none'};a.reset={status:'active',remaining:2,firstTId:null,inheritedCovered:[]};
 root.state.leftGoals=[{id:'left-1',rule:'deep-deficit-partial-repair-v1',deepColumns:[1],deficitRegion:[[1,36],[1,37],[1,38],[1,39]],referenceProfile:[4,0,0,0],status:'open'}];
 pair(root,['L','R','L','L','HD'],{resolveView:true,extendForced:true});
});
test('settled observe: first-observe overflow and missing counterpart checks cannot be skipped',()=>{
 const overflow=compactionRoot();overflow.state.sl.uncertainty.S=[Number.MAX_SAFE_INTEGER,0,0,0];const missing=compactionRoot();missing.state.sl.residuals[0].S=null;missing.state.sl.residuals[0].order=null;
 for(const [root,reason]of [[overflow,/exact integer range/],[missing,/Missing consumed S/]])for(const references of [[],P.referenceSnapshot([])])assert.throws(()=>P.project(root,{witness:['L','R','HD'],references}),reason);
});
test('settled observe: raw malformed state and public serialization hooks remain rejected',()=>{
 for(const refs of [[],P.referenceSnapshot([])]){
  const root=origin();let reads=0;Object.defineProperty(root.state,'dPending',{enumerable:true,get(){return ++reads===1?false:'forged';}});assert.throws(()=>P.project(root,{witness:['L','R','HD'],references:refs}),/version\/availability\/D/);
  const subject=origin(),saved=copy(subject.supply.queue[0]);Object.defineProperty(subject.supply.queue[0],'toJSON',{value(){return{...saved,id:0};}});assert.throws(()=>P.project(subject,{witness:['L','R','HD'],references:refs}),/subject identity/);
 }
});
test('settled observe: repeated moves, rotations, forced unknown supply and sibling mutation match full reducer',()=>{
 const B=require('../st-bag'),unknown=P.startUnknown(R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}));
 for(const root of [origin(),compactionRoot(),unknown])for(const witness of [['L','R','CW','CCW','SD','R180','R180','HD'],['HOLD','L','R','HOLD','L','R','HD'],[...Array.from({length:125},()=>['L','R']).flat(),'HD']])pair(root,witness,{extendForced:true,resolveView:true});
 const root=freeze(origin()),saved=copy(root),witness=['L','R','L','R','HD'],result=P.project(root,{witness}),sibling=P.project(root,{witness}),expected=copy(sibling);result.state.account.profile.violation=true;result.supply.active.id=99;result.position.queue.length=0;result.effects.push({callerOnly:true});assert.deepEqual(root,saved);assert.deepEqual(sibling,expected);
});
test('settled observe: rejected moves, malformed witnesses and boundary flags keep identical failures',()=>{
 const cases=[{witness:[]},{witness:['HD','HD']},{witness:['L','R','BAD','HD']},{witness:['L','L','L','L','L','HD']},{witness:['L','R','HD'],boundary:{firstBagReview:'bad'}},{witness:[...Array(256).fill('L'),'HD']}];
 const legacy=origin();legacy.position.rules=R.LEGACY_PROFILE.id;cases.push({witness:['HOLD','L','R','HOLD','HD'],root:legacy});
 for(const {root=origin(),...opts}of cases){let slow,fast;try{P.project(root,{...opts,references:[]});}catch(e){slow=e.message;}try{P.project(root,{...opts,references:P.referenceSnapshot([])});}catch(e){fast=e.message;}assert.ok(slow);assert.equal(fast,slow);}
});
test('settled observe: snapshot consumes custom values once and a proxy cannot carry its capability',()=>{
 for(const invalid of [0,1.5,NaN]){const raw=[8];raw[Symbol.iterator]=function*(){yield 8;yield invalid;};assert.throws(()=>P.referenceSnapshot(raw),/current caller references/);}
 let id=8,reads=0;const raw=[];Object.defineProperty(raw,'0',{enumerable:true,get(){reads++;return id;}});raw.map=raw.toJSON=()=>{throw Error('Caller array methods must not be trusted');};
 const snapshot=P.referenceSnapshot(raw);assert.equal(reads,1);assert.equal(Object.getPrototypeOf(snapshot),Array.prototype);assert.equal(Object.isFrozen(snapshot),true);assert.deepEqual(snapshot,[8]);id=9;
 const witness=['L','R','L','L','HD'],root=compactionRoot();assert.deepEqual(P.project(root,{witness,references:snapshot}),P.project(root,{witness,references:[8]}));assert.equal(reads,1);
 const custom=[9];custom[Symbol.iterator]=function*(){yield 8;};const customSnapshot=P.referenceSnapshot(custom);custom[Symbol.iterator]=function*(){yield 0;};assert.deepEqual(customSnapshot,[8]);assert.equal(Object.isFrozen(customSnapshot),true);
 const {P:p,calls}=spy();p.project(root,{witness,references:new Proxy(p.referenceSnapshot([8]),{})});assert.equal(calls.length,witness.length);
});
