'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources'),B=require('../st-bag'),Session=require('../st-session');
const {allowanceFixture}=require('./support/current-resource-test.cjs');
const cases=require('./fixtures/deferred-sl-reveals.json').cases;
const summary=(state,context)=>CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(Current.importState(JSON.parse(JSON.stringify(context)),{position:state}))}));
for(const f of cases)test(`deferred SL: seed ${f.seed} lock ${f.lock} preserves debt across the actual S reveal`,()=>{
 const before=summary(f.before,f.beforeContext),after=summary(f.after,f.afterContext);
 assert.equal(before.availability,'known');assert.equal(after.availability,'known');
 assert.ok(![before.instances.active,before.instances.hold,...before.instances.queue].filter(Boolean).some(p=>p.type==='S'&&p.bag===f.bag));
 assert.ok([after.instances.active,after.instances.hold,...after.instances.queue].filter(Boolean).some(p=>p.id===f.revealedId&&p.type==='S'&&p.bag===f.bag));
 const oldProof=M.checkPath(f.before,f.path,Current.importState(f.beforeContext,{position:f.before})),revealedProof=M.checkPath(f.after,f.path.slice(1),Current.importState(f.afterContext,{position:f.after}));
 assert.equal(oldProof.valid,true,'The old sequence is physically/resource-path legal; debt-free certification is separate');
 assert.equal(revealedProof.valid,true);
 assert.deepEqual(oldProof.resource.hangingS.filter(s=>s.bag===f.bag),[{id:null,bag:f.bag,known:true}]);
 assert.deepEqual(revealedProof.resource.hangingS.filter(s=>s.bag===f.bag),[{id:f.revealedId,bag:f.bag,known:true}]);
 assert.notEqual(M.repair(oldProof.state,oldProof.resource,{maxNodes:4000,deadline:Infinity}).valid,true,'Unseen counterpart cannot be certified as already repaired');
 const forged=JSON.parse(JSON.stringify(f.beforeContext));forged.observedSL=[];assert.throws(()=>Current.importState(forged,{position:f.before}),/envelope shape/,'Old derived arrays are not a native snapshot');
});
const consumed=(id,type)=>({id,region:'left',opening:false,pair:null,...(type==='S'?{foundationEligible:false,firstBagEligible:false,requiresAccommodation:false,invalidated:false}:{nonRight:true})});
const residual=(bag,kind,id)=>({bag,S:kind==='S'?consumed(id,kind):null,L:kind==='L'?consumed(id,kind):null,order:null,sOwedSinceL:false,lBeforeSPair:false});
function known(type,otherSeen=false){
 const state=R.createState({active:type,queue:['I','J','O','Z','T']});
 const raw=Current.exportState(allowanceFixture(state,0));
 for(const p of [raw.inventory.active,...raw.inventory.queue]){p.id+=9;p.observedOrder+=9;p.bag++;}raw.inventory.nextId+=9;raw.inventory.frontier.bag++;
 if(otherSeen)raw.state.sl.residuals=[residual(1,type==='L'?'S':'L',9)];
 const s=Current.importState(raw,{position:state}),p=R.placements(state,{allowHold:false,maxNodes:45000}).placements.find(p=>p.event.cells.every(([x])=>x<4));assert.ok(p);
 return{state,s,p};
}
test('deferred SL: unseen counterparts differ from already consumed counterparts and unknown imports',()=>{
 for(const type of ['L','S']){
  const field=type==='L'?'hangingS':'hangingL';
  const absent=known(type),projected=M.checkPath(absent.state,[absent.p],absent.s);
  assert.deepEqual(projected.resource[field],[{id:null,bag:1,known:true}]);
  const consumed=known(type,true);assert.deepEqual(M.checkPath(consumed.state,[consumed.p],consumed.s).resource[field],[],'A previously observed consumed counterpart is not an unseen piece');
  for(const s of [Current.start(absent.state)])assert.deepEqual(M.checkPath(absent.state,[absent.p],s).resource[field],[],'Unknown provenance cannot create deferred bag debt');
 }
});
test('deferred SL: an unrelated Left S cannot pay another bags deferred S',()=>{
 const {state,s,p}=known('S'),raw=Current.exportState(s);raw.state.sl.residuals=[residual(2,'L',9)];const current=Current.importState(raw,{position:state});
 assert.deepEqual(M.checkPath(state,[p],current).resource.hangingS,[{id:null,bag:2,known:true}]);
});
test('deferred SL: observed counterpart identity can be legitimately accommodated',()=>{
 const {state,s,p}=known('S',true);assert.ok(M.start(state,s).hangingS.some(x=>x.id===10));
 const result=M.checkPath(state,[p],s);assert.equal(result.valid,true);assert.deepEqual(result.resource.hangingS,[]);
});
test('deferred SL: an older envelope still requires a valid full session',()=>{
 assert.throws(()=>Session.prepare({format:Session.FORMAT,schemaVersion:Session.VERSION,engineVersion:'st-coach-session-2026-10-26-left-context-v2'}),/Invalid session position|Unsupported|Missing|Invalid/);
});

for(const f of cases)test(`deferred SL: observed history binds seed ${f.seed} without serializing invented identities`,()=>{
 const replay=reveal=>{let state=R.createState(f.before),history=Current.importState(JSON.parse(JSON.stringify(f.beforeContext)),{position:state});const actions=f.path.flatMap(p=>p.witness);
  actions.forEach((action,i)=>{const before=state;state=R.move(state,action);assert.notEqual(state,before);
   if(reveal&&i===actions.length-1)state={...state,queue:[...state.queue,'S'],bag:B.consume(state.bag,'S')};
   history=Current.applyActual(history,{before:before,action:action,after:state}).context;
  });
  const d=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.equal(d.status,'available');
  const tape=JSON.parse(JSON.stringify(Current.exportState(history)));
  assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(Current.importState(tape,{position:state}))})),d,'Replay transport reconstructs deferred or bound obligations');
  return d.hangingS.evidence.find(e=>e.bag===f.bag);
 };
 const deferred=replay(false),bound=replay(true);assert.equal(deferred.sId,null);assert.equal(deferred.deferred,true);assert.equal(bound.sId,f.revealedId);assert.equal(bound.deferred,undefined);
});
