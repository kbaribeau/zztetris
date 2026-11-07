'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../st-obligation-admission'),SL=require('../st-sl-obligations');
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const legacy=(s=[],l=[])=>({hangingS:[],hangingL:[],unclassifiedS:s,unclassifiedL:l,pendingCenter:[]});
const compact=(s=[0,0,0,0],l=[0])=>({hangingS:{status:'unknown',evidence:[],unclassified:[],aggregate:s,unclassifiedCount:s.reduce((a,b)=>a+b,0)},hangingL:{status:'unknown',evidence:[],unclassified:[],aggregate:l,unclassifiedCount:l[0]},center:{pending:[],debt:[]}});

test('admission: exact and compact S distinguish all four severity categories',()=>{
 for(let severity=0;severity<4;severity++){
  const row={sId:8,lId:9,bag:1,requiresAccommodation:Boolean(severity&1),invalidated:Boolean(severity&2)};
  const buckets=[0,0,0,0];buckets[severity]=1;
  for(const view of [legacy([row]),compact(buckets)]){
   assert.equal(A.hasUnclassified(view),true);
   assert.equal(A.hasUnclassified(view,'S'),true);
   assert.equal(A.hasSevereS(view),severity!==0);
   assert.equal(A.uncertainty(view,'S').count,1);
   assert.equal(A.uncertainty(view,'S').severeCount,severity===0?0:1);
  }
 }
});
test('admission: named rows and aggregate buckets are additive, not alternatives',()=>{
 const view=compact([2,3,4,5],[6]);view.hangingS.unclassified=[{sId:8,bag:1},{sId:15,bag:2,invalidated:true}];view.hangingS.unclassifiedCount=16;
 assert.equal(A.uncertainty(view,'S').count,16);assert.equal(A.uncertainty(view,'S').severeCount,13);
 assert.equal(A.uncertainty(view,'L').count,6);
 assert.equal(A.hasUnclassified(view,'L'),true);
});
test('admission: generic S and unknown L carry uncertainty without a blanket repair or Reset ban',()=>{
 for(const view of [legacy([{sId:8,bag:1}],[{lId:37,sId:36,bag:5}]),compact([1,0,0,0],[1])]){
  assert.equal(A.hasUnclassified(view),true);assert.equal(A.hasSevereS(view),false);
  assert.equal(A.resetLosesObligation(view,view),false);
 }
 const inherited=compact([0,0,1,0]);assert.equal(A.hasSevereS(inherited),true);
 assert.equal(A.resetLosesObligation(inherited,inherited),false,'Reset is not the severe-S finite-repair predicate');
 assert.equal(A.hasUnclassified(compact()),false,'unknown availability is not a fabricated uncertain identity');
});
test('admission: Reset rejects known identities newly uncertain, not inherited or deferred uncertainty',()=>{
 for(const kind of ['S','L']){
  const idKey=kind==='S'?'sId':'lId',before=legacy(),after=legacy();before['hanging'+kind]=[{id:37,bag:5}];after['unclassified'+kind]=[{[idKey]:37,bag:5}];
  assert.equal(A.knownToUnclassified(before,after),true);assert.equal(A.resetLosesObligation(before,after),true);
  before['hanging'+kind]=[{id:null,bag:5}];after['unclassified'+kind]=[{[idKey]:null,bag:5}];assert.equal(A.knownToUnclassified(before,after),false);
 }
});
// Exercise real reducer ordering, including classification BEFORE immediate GC.
// IDs deliberately match the L37 identity of the observed Reset regression.
function knownL37(){
 const s={id:36,type:'S',bag:5},l={id:37,type:'L',bag:5};
 const inventory=pieces=>({originKnown:true,active:pieces[0]??null,hold:null,queue:pieces.slice(1),frontier:{bag:6,seenMask:0}});
 const context=pieces=>({inventory:inventory(pieces),center:{pending:[],debt:[]}});
 const all=context([s,l]),afterS=context([l]),afterL=context([]);
 let state=SL.transition(SL.start({known:true}),{kind:'observe',closeFoundation:true,firstBagReview:'unreviewed'},{before:all,after:all}).state;
 const event=(type,cells)=>({type,cells,lines:0,spin:'none',clearedRows:[]});
 state=SL.transition(state,{kind:'lock',piece:s,event:event('S',[[0,38],[1,38],[1,39],[2,39]])},{before:all,after:afterS}).state;
 const before=SL.resolve(state,afterS);
 const result=SL.transition(state,{kind:'lock',piece:l,event:event('L',[[3,38],[4,38],[4,39],[5,39]])},{before:afterS,after:afterL});
 return{before,after:SL.resolve(result.state,afterL),result};
}
test('admission: actual L37 known-to-unknown effect survives immediate compaction',()=>{
 const {before,after,result}=knownL37();
 assert.equal(before.hangingL.evidence[0].lId,37);assert.deepEqual(after.hangingL.unclassified,[]);
 assert.deepEqual(after.hangingL.aggregate,[1]);assert.equal(result.state.residuals.length,0);
 assert.ok(result.effects.some(e=>e.status==='compacted'&&e.subject.lId===37));
 assert.equal(A.knownToUnclassified(before,after),false,'compact snapshots alone cannot recover a new exact loss');
 assert.equal(A.knownToUnclassified(before,after,result.effects),true);
 assert.equal(A.resetLosesObligation(before,after,result.effects.map(e=>({domain:'sl',...e}))),true);
 assert.equal(A.knownToUnclassified(before,after,result.effects.map(e=>({domain:'other',...e}))),false);
});
test('admission: request uncertainty compares current keys to the fixed initial root',()=>{
 const inherited={sId:8,lId:9,bag:1},replacement={sId:15,lId:16,bag:2};
 const root=A.uncertaintyKeys(legacy([inherited]));assert.deepEqual(root,['S:8:9:1']);
 assert.deepEqual(A.introducedUnclassified(root,root),[]);
 const equalTotal=A.uncertaintyKeys(legacy([replacement]));assert.equal(equalTotal.length,root.length);
 assert.deepEqual(A.introducedUnclassified(equalTotal,root),['S:15:16:2']);
 assert.deepEqual(A.introducedUnclassified([],root),[],'inherited uncertainty temporarily becomes known');
 assert.deepEqual(A.introducedUnclassified(root,root),[],'same root key becomes uncertain again and stays inherited');
 assert.deepEqual(A.introducedUnclassified([...root,...equalTotal],root),equalTotal,'new current key persists beyond introduction step');
 assert.deepEqual(A.introducedUnclassified(root,root),[],'new uncertainty disappears when no longer current');
 assert.equal(A.uncertaintyKey('L',{sId:8,lId:null,bag:1}),'L:8::1');
});
test('admission: compact identity keys are explicitly unsupported, never synthesized',()=>{
 assert.deepEqual(A.uncertaintyKeys(compact()),[]);
 for(const view of [compact([1,0,0,0]),compact([0,0,0,0],[1])])assert.throws(()=>A.uncertaintyKeys(view),/caller-owned request tracking required/);
 const {after}=knownL37();assert.throws(()=>A.uncertaintyKeys(after),/after compaction/);
});
test('admission: Reset uses newly lost route targets, not inherited loss or raw Center invalidation',()=>{
 const before=legacy(),after=legacy();before.pendingCenter=[{rootId:8,lost:true},{rootId:15}];after.pendingCenter=clone(before.pendingCenter);
 assert.equal(A.newlyLostCenter(before,after),false);
 after.pendingCenter[1].lost=true;assert.equal(A.newlyLostCenter(before,after),true);assert.equal(A.resetLosesObligation(before,after),true);
 after.pendingCenter=[];assert.equal(A.newlyLostCenter(before,after),false,'wholly cleared target may retire without lost overlay');
 assert.equal(A.resetLosesObligation(compact(),compact(),[{domain:'center',status:'invalidated',rootId:15}]),false,'raw invalidation does not stand in for route policy');
});
test('admission: input views, effects and exact root keys remain immutable',()=>{
 const {before,after,result}=knownL37(),root=['L::37:5'],current=['L::37:5','S:8:9:1'];
 const input={before,after,effects:result.effects,root,current},saved=clone(input);freeze(input);
 assert.equal(A.resetLosesObligation(before,after,input.effects),true);
 assert.deepEqual(A.introducedUnclassified(current,root),['S:8:9:1']);
 const normalized=A.uncertainty(after,'L');normalized.aggregate[0]=100;normalized.named.push({lId:999});
 assert.deepEqual(input,saved);
 const named=freeze(legacy([{sId:8,bag:1,details:{value:1}}]));const copy=A.uncertainty(named,'S');copy.named[0].details.value=9;assert.equal(named.unclassifiedS[0].details.value,1);
});

test('admission: absent optional resources and unrelated effects do not manufacture losses',()=>{
 for(const view of [null,undefined]){assert.equal(A.hasSevereS(view),false);assert.equal(A.hasUnclassified(view),false);assert.equal(A.resetLosesObligation(view,view),false);}
 const {after,result}=knownL37();assert.equal(A.knownToUnclassified(compact(),after,result.effects),false,'effect must match the supplied immediately prior known subject');
 assert.equal(A.newlyLostCenter([{rootId:8,lost:true}],[{rootId:8,lost:true}]),false);
 assert.equal(A.newlyLostCenter([{rootId:8}],[{rootId:8,lost:true}]),true);
});
