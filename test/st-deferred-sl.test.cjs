'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),B=require('../st-bag'),Session=require('../st-session');
const cases=require('./fixtures/deferred-sl-reveals.json').cases;
const summary=(state,context)=>H.resolve(state,H.importContext(state,JSON.parse(JSON.stringify(context))));
for(const f of cases)test(`deferred SL: seed ${f.seed} lock ${f.lock} preserves debt across the actual S reveal`,()=>{
 const before=summary(f.before,f.beforeContext),after=summary(f.after,f.afterContext);
 assert.equal(before.coverage.status,'complete');assert.equal(after.coverage.status,'complete');
 assert.ok(!before.observedSL.some(p=>p.type==='S'&&p.bag===f.bag));
 assert.ok(after.observedSL.some(p=>p.id===f.revealedId&&p.type==='S'&&p.bag===f.bag));
 const oldProof=M.checkPath(f.before,f.path,before),revealedProof=M.checkPath(f.after,f.path.slice(1),after);
 assert.equal(oldProof.valid,true,'The old sequence is physically/resource-path legal; debt-free certification is separate');
 assert.equal(revealedProof.valid,true);
 assert.deepEqual(oldProof.resource.hangingS.filter(s=>s.bag===f.bag),[{id:null,bag:f.bag,known:true}]);
 assert.deepEqual(revealedProof.resource.hangingS.filter(s=>s.bag===f.bag),[{id:f.revealedId,bag:f.bag,known:true}]);
 assert.notEqual(M.repair(oldProof.state,oldProof.resource,{maxNodes:4000,deadline:Infinity}).valid,true,'Unseen counterpart cannot be certified as already repaired');
 // JSON contains only the public replay tape. Derived fields are rebuilt and
 // forged annotations do not get authority during worker/session transport.
 const forged=JSON.parse(JSON.stringify(f.beforeContext));forged.observedSL=[];forged.hangingS=[];
 assert.deepEqual(summary(f.before,forged),before);
});
function known(type,otherSeen=false){
 const state=R.createState({active:type,queue:['I','J','O','Z','T','I']});
 const instance={id:10,type,bag:1};
 const s={coverage:{status:'complete'},instances:{active:instance},observedSL:[instance,...(otherSeen?[{id:9,type:type==='L'?'S':'L',bag:1}]:[])]};
 const p=R.placements(state,{allowHold:false,maxNodes:45000}).placements.find(p=>p.event.cells.every(([x])=>x<4));assert.ok(p);
 return{state,s,p};
}
test('deferred SL: unseen counterparts differ from already consumed counterparts and unknown imports',()=>{
 for(const type of ['L','S']){
  const field=type==='L'?'hangingS':'hangingL';
  const absent=known(type),projected=M.checkPath(absent.state,[absent.p],absent.s);
  assert.deepEqual(projected.resource[field],[{id:null,bag:1,known:true}]);
  const consumed=known(type,true);assert.deepEqual(M.checkPath(consumed.state,[consumed.p],consumed.s).resource[field],[],'A previously observed consumed counterpart is not an unseen piece');
  for(const s of [{},H.resolve(absent.state,H.start(absent.state)),{...absent.s,coverage:{status:'partial'}}])assert.deepEqual(M.checkPath(absent.state,[absent.p],s).resource[field],[],'Unknown provenance cannot create deferred bag debt');
 }
});
test('deferred SL: an unrelated Left S cannot pay another bags deferred S',()=>{
 const {state,s,p}=known('S');s.hangingS={evidence:[{sId:null,bag:2}]};
 assert.deepEqual(M.checkPath(state,[p],s).resource.hangingS,[{id:null,bag:2,known:true}]);
});
test('deferred SL: observed counterpart identity can be legitimately accommodated',()=>{
 const {state,s,p}=known('S');s.hangingS={evidence:[{sId:10,bag:1}]};
 const result=M.checkPath(state,[p],s);assert.equal(result.valid,true);assert.deepEqual(result.resource.hangingS,[]);
});
test('deferred SL: an older envelope still requires a valid full session',()=>{
 assert.throws(()=>Session.prepare({format:Session.FORMAT,schemaVersion:Session.VERSION,engineVersion:'st-coach-session-2026-10-26-left-context-v2'}),/Invalid session position/);
});

for(const f of cases)test(`deferred SL: observed history binds seed ${f.seed} without serializing invented identities`,()=>{
 const replay=reveal=>{let state=R.createState(f.before),history=H.importContext(state,JSON.parse(JSON.stringify(f.beforeContext)));const actions=f.path.flatMap(p=>p.witness);
  actions.forEach((action,i)=>{const before=state;state=R.move(state,action);assert.notEqual(state,before);
   if(reveal&&i===actions.length-1)state={...state,queue:[...state.queue,'S'],bag:B.consume(state.bag,'S')};
   history=H.applyAction(history,before,action,state);
  });
  const d=H.resolve(state,history);assert.equal(d.coverage.status,'complete');
  const tape=JSON.parse(JSON.stringify(H.exportContext(state,history)));
  assert.deepEqual(H.resolve(state,H.importContext(state,tape)),d,'Replay transport reconstructs deferred or bound obligations');
  return d.hangingS.evidence.find(e=>e.bag===f.bag);
 };
 const deferred=replay(false),bound=replay(true);assert.equal(deferred.sId,null);assert.equal(deferred.deferred,true);assert.equal(bound.sId,f.revealedId);assert.equal(bound.deferred,undefined);
});
