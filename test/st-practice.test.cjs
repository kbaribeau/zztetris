'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history'),Session=require('../st-session'),Practice=require('../st-practice');
const clone=x=>JSON.parse(JSON.stringify(x));
function session({known=true,queue=['J','L','O','S','T','Z']}={}){
 const state=R.createState({rules:R.PROFILE.id,board:R.emptyBoard(),active:{type:'I',x:3,y:17,rotation:0,lastRotation:null},hold:null,canHold:true,queue,streamCursor:1,...(known?{bag:B.fromObserved({observed:['I',...queue],startPhase:0})}:{})});
 return Session.create(state,{resourceHistory:H.start(state),resourceOriginBag:state.bag??null});
}
test('practice/package preserves the visible session and partial history without exposing the private tail to session state',()=>{
 const saved=session(),tail=['T','O','I','J','L','S','Z'],packed=Practice.create(saved,tail),prepared=Practice.parse(JSON.stringify(packed));
 assert.equal(packed.format,Practice.FORMAT);assert.equal(packed.schemaVersion,1);assert.deepEqual(packed.session,saved);assert.deepEqual(packed.privatePractice.tail,tail);
 assert.deepEqual(prepared.session.state,saved.position);assert.deepEqual(prepared.tail,tail);
 assert.equal(H.resolve(prepared.session.state,prepared.session.resourceHistory).coverage.status,'partial');
 assert.deepEqual(Session.create(prepared.session.state,prepared.session),saved);
 tail[0]='Z';packed.privatePractice.tail[0]='Z';assert.equal(prepared.tail[0],'T','prepared tail is detached from inputs');
});
test('practice/validates the whole private stream against the public bag frontier without narrowing public knowledge',()=>{
 const saved=session(),good=Practice.create(saved,['T','O','I','J','L','S','Z','Z']);
 assert.deepEqual(Practice.prepare(good).session.state.bag,saved.position.bag);
 for(const tail of [['T','T'],['T','O','I','J','L','S','Z','Z','Z']]){
  const bad=clone(good);bad.privatePractice.tail=tail;assert.throws(()=>Practice.prepare(bad),/bag|stream|sequence/i);
 }
 const uncertain=session({known:false}),got=Practice.prepare(Practice.create(uncertain,['T','O','I','J','L','S','Z']));
 assert.equal(got.session.state.bag,undefined,'private validation never upgrades unknown public bag history');
 assert.equal(H.resolve(got.session.state,got.session.resourceHistory).extraZ.status,'unknown');
});
test('practice/rejects unsupported versions, malformed types, oversized streams and nested invalid sessions',()=>{
 const valid=Practice.create(session(),['T']);
 const mutations=[x=>x.schemaVersion=2,x=>x.privatePractice=null,x=>x.privatePractice.tail='T',x=>x.privatePractice.tail=['Q'],x=>x.privatePractice.tail=[null],x=>x.privatePractice.tail=[{}],x=>x.privatePractice.tail=Array(Practice.LIMITS.pieces+1).fill('I'),x=>x.session.schemaVersion=99,x=>x.session.search.timeMs=999999,x=>x.session.position.queue.push('I'),x=>x.privatePractice.seed=123,x=>x.seed=123];
 for(const mutate of mutations){const bad=clone(valid);mutate(bad);assert.throws(()=>Practice.prepare(bad));}
 assert.throws(()=>Practice.parse(' '.repeat(Practice.LIMITS.bytes+1)),/size limit/i);
 assert.throws(()=>Practice.create(session({queue:['J']}),['L']),/six|preview/i);
 assert.deepEqual(Practice.prepare(Practice.create(session({queue:[]}),[])).tail,[],'empty finite package remains valid');
});
