'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),I=require('../st-public-inventory'),Q=require('../st-obligation-state'),P=require('../st-obligation-projection');
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function origin(){const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),inventory=I.start(position,{fresh:true}),state=Q.start(position,{inventory});return{position,inventory,state};}
for(const witness of [['L','L','HD'],['HOLD','L','HD'],['HOLD','HOLD','R','HD'],['CW','CCW','R','L','HD']])test('projection local transition normalization: '+witness.join(','),()=>{
 const {position,inventory,state}=origin(),root=freeze(P.start(state,{position,inventory})),saved=copy(root),result=P.project(root,{witness});
 assert.deepEqual(result.state,Q.importProjection(result.state));assert.deepEqual(root,saved);assert.notEqual(result.state,root.state);assert.notEqual(result.supply,root.supply);
 const expected=Q.project(state,{position,inventory,witness});assert.deepEqual(result.state,Q.toProjection(expected.state));assert.deepEqual(result.effects,expected.effects);assert.deepEqual(result.position,expected.position);
 const resultSaved=copy(result),sibling=P.project(root,{witness});result.state.account.profile.violation=true;result.supply.queue.length=0;result.effects.push({status:'caller-only'});assert.deepEqual(root,saved);assert.deepEqual(sibling,resultSaved);assert.deepEqual(P.project(root,{witness}),resultSaved);
});
test('projection local transition normalization: public entries still reject malformed domain and aliased mutable state',()=>{
 const {position,inventory,state}=origin(),root=P.start(state,{position,inventory});P.project(root,{witness:['HD']});root.state.account.schemaVersion=99;assert.throws(()=>P.project(root,{witness:['HD']}));assert.throws(()=>P.resolve(root));
 const valid=P.start(state,{position,inventory});assert.throws(()=>P.project({...valid,state},{witness:['HD']}));assert.throws(()=>P.project(valid,{witness:['INVALID','HD']}));
});
test('projection public resolve retains validation after caller getters are normalized',()=>{
 const {position,inventory,state}=origin(),root=P.start(state,{position,inventory});
 let reads=0;Object.defineProperty(root.state,'dPending',{enumerable:true,get(){return ++reads===1?false:'forged';}});
 assert.throws(()=>P.resolve(root),/version\/availability\/D/);
});
test('projection local supply rejects values changed by public serialization hooks',()=>{
 const {position,inventory,state}=origin();
 for(const key of ['queue','active','hold']){
  const root=P.start(state,{position,inventory});
  if(key==='hold'){const valid=P.project(root,{witness:['HOLD','L','HD']});Object.assign(root,valid);}
  const subject=key==='queue'?root.supply.queue[0]:root.supply[key],saved=copy(subject);
  Object.defineProperty(subject,'toJSON',{value(){return{...saved,id:0};}});
  assert.throws(()=>P.project(root,{witness:['R','HD']}),/subject identity/);
 }
});
test('projection local supply keeps unknown IDs separate through repeated HOLD',()=>{
 const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),root=freeze(P.startUnknown(position)),saved=copy(root),witness=['HOLD','HOLD','HOLD','R','HD'];
 const result=P.project(root,{witness}),expected=R.replay(root.position,witness);assert.equal(expected.valid,true);assert.deepEqual(result.position,expected.state);assert.equal(result.locked.id,-2);assert.equal(result.supply.hold.id,-1);assert.equal(result.supply.active.id,-3);assert.deepEqual(result.supply.queue.map(p=>p.id),[-4,-5,-6,-7]);assert.deepEqual(result.state,Q.importProjection(result.state));assert.deepEqual(root,saved);
 result.position.board[0]='XXXXXXXXXX';result.supply.queue[0].type='I';result.supply.active.id=-999;assert.deepEqual(root,saved);assert.deepEqual(P.project(root,{witness}).position,expected.state);
});
test('projection local supply rejects invalid witnesses and consumes no caller state',()=>{
 const {position,inventory,state}=origin(),root=freeze(P.start(state,{position,inventory})),saved=copy(root);
 for(const witness of [[],['HD','HD'],['L','INVALID','HD'],['L','L','L','L','L','HD']])assert.throws(()=>P.project(root,{witness}));assert.deepEqual(root,saved);
 const malformed=copy(root);malformed.supply.queue[0].id=malformed.supply.active.id;assert.throws(()=>P.project(malformed,{witness:['HD']}),/subject identity/);
});
test('projection combined local view and extension equal separate public operations',()=>{
 const {position,inventory,state}=origin(),root=freeze(P.start(state,{position,inventory})),saved=copy(root);
 for(const witness of [['HD'],['HOLD','HOLD','R','HD']])for(const extendForced of [false,true]){
  const ordinary=P.project(root,{witness}),projection=extendForced?P.extendForced(ordinary):ordinary,combined=P.project(root,{witness,extendForced,resolveView:true});
  assert.deepEqual(combined,{state:projection.state,supply:projection.supply,position:projection.position,effects:ordinary.effects,locked:ordinary.locked,view:P.resolve(projection)});assert.deepEqual(root,saved);
 }
 for(const options of [{extendForced:'yes'},{resolveView:1}])assert.throws(()=>P.project(root,{witness:['HD'],...options}),/local output options/);
});
test('projection combined view extends a uniquely forced synthetic draw without advancing frontier',()=>{
 const B=require('../st-bag'),position=R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}),root=freeze(P.startUnknown(position)),saved=copy(root),witness=['HD'];
 const plain=P.project(root,{witness}),separate=P.extendForced(plain),combined=P.project(root,{witness,extendForced:true,resolveView:true});
 assert.equal(separate.supply.queue.length,plain.supply.queue.length+1);assert.equal(separate.supply.queue.at(-1).type,'Z');assert.equal(separate.supply.queue.at(-1).id,plain.supply.nextSyntheticId);assert.equal(separate.supply.queue.at(-1).bag,null);assert.deepEqual(separate.supply.frontier,plain.supply.frontier);
 assert.deepEqual(combined,{state:separate.state,supply:separate.supply,position:separate.position,effects:plain.effects,locked:plain.locked,view:P.resolve(separate)});assert.deepEqual(root,saved);assert.equal(combined.supply.nextObservedId,root.supply.nextObservedId);
});
test('projection private supply sharing never reaches roots or siblings',()=>{
 const {position,inventory,state}=origin(),root=freeze(P.start(state,{position,inventory})),saved=copy(root),witness=['HOLD','R','HD'],result=P.project(root,{witness}),sibling=P.project(root,{witness}),expected=copy(sibling);
 result.supply.active.id=99;result.supply.hold.type='Z';result.supply.queue[0].bag=999;result.supply.frontier.bag=99;result.supply.knowledge.remaining.length=0;result.position.queue.length=0;
 assert.deepEqual(root,saved);assert.deepEqual(sibling,expected);assert.deepEqual(P.project(root,{witness}),expected);
});
