const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),L=require('../st-left-context'),P=require('../st-planner');
const fixtures=require('./fixtures/st-d-admission.json');
const state=f=>R.createState({board:[...Array(20).fill('..........'),...f.board],active:f.active,hold:f.hold,queue:f.queue});
const profile=board=>{const h=Array.from({length:4},(_,x)=>40-board.findIndex(r=>r[x]!=='.'));return h.map(v=>v-Math.min(...h));};
const solid=h=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>x<4&&y>=40-h[x]?'X':'.').join(''));
const dState=(extra={})=>R.createState({board:solid([3,4,4,3]),active:'J',queue:['O','T'],...extra});
for(const f of fixtures)test('D admission: exact '+f.name+' creation cannot borrow distant or consumed J',()=>{
 // Minimized original public board/inventory + exact recorded creation witness.
 // The imported seven-bag/history is deliberately unknown; no private future.
 const before=state(f),r=R.replay(before,f.witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);
 assert.notDeepEqual(profile(before.board),[0,1,1,0]);assert.deepEqual(profile(r.state.board),[0,1,1,0]);
 assert.equal(L.createsD(before.board,r.state.board),true);
 const proof=P.dPatternAdmission(before,{state:r.state,event:r.events[0],witness:f.witness},{now:()=>0,deadline:1,maxNodes:4000});
 assert.equal(proof.valid,false);assert.equal(proof.reason,'D-created-without-immediate-J');assert.equal(proof.visited,0);
 if(f.active==='J'){assert.equal(r.state.active.type,'S');assert.equal(r.state.hold,'Z');assert.ok(!r.state.queue.includes('J'));}
});
test('D admission: immediate active, held and empty-HOLD J have replayable clean one-lock exits',()=>{
 for(const extra of [{},{active:'T',hold:'J'},{active:'T',hold:null,queue:['J','O','T']},{active:'T',hold:'J',canHold:false}]){
  const s=dState(extra),proof=L.dExit(s,{now:()=>0,deadline:1,maxNodes:4000});assert.equal(proof.valid,true,JSON.stringify(extra));
  const r=R.replay(s,proof.exit.witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);assert.equal(r.events[0].type,'J');assert.equal(r.events[0].lines,0);
  assert.ok(r.events[0].cells.every(([x])=>x<4));assert.notDeepEqual(profile(r.state.board),[0,1,1,0]);
  assert.deepEqual(profile(r.state.board),[0,2,2,2]); // independent source A silhouette
 }
});
test('D admission: occupied non-J HOLD, late preview, unknown future and legacy unavailable HOLD are not immediate',()=>{
 for(const extra of [{active:'T',hold:'O',queue:['J','S']},{active:'T',hold:null,queue:['O','J']},{active:'T',queue:[],hiddenQueue:['J']},{rules:R.LEGACY_PROFILE.id,active:'T',hold:'J',canHold:false}])assert.equal(L.immediateJStarts(dState(extra)).length,0);
});
test('D admission: presence is not reachability, and unfinished proof is not absence',()=>{
 assert.equal(L.dExit(dState({active:'T',hold:'J'}),{allowHold:false}).reason,'D-created-without-immediate-J');
 const s=dState(),limited=L.dExit(s,{now:()=>0,deadline:1,maxNodes:0});assert.equal(limited.valid,false);assert.equal(limited.complete,false);assert.equal(limited.reason,'D-J-exit-budget-unfinished');
 const high=dState({board:solid([19,20,20,19])});const p=L.dExit(high,{now:()=>0,deadline:1,maxNodes:4000});assert.equal(p.valid,false);
});
test('D admission: old D is not a new obligation; roofs cannot hide the D silhouette',()=>{
 const s=dState({active:'O',hold:'T',queue:['S']}),unchanged={state:s,event:{},witness:[]};
 assert.deepEqual(P.dPatternAdmission(s,unchanged),{valid:true,visited:0,reason:'no-new-D-pattern'});
 const roof=dState().board.slice();roof[39]='.XXX......';assert.equal(L.createsD(solid([2,2,2,2]),roof),true);
});
test('D admission: stale recommendation and in-flight retention cannot waive creation check',()=>{
 const f=fixtures[1],before=state(f),r=R.replay(before,f.witness),step={target:r.events[0].target,witness:f.witness,event:r.events[0],hold:false,holdCount:0};
 // Deliberately untrusted saved claims: target/event remain legal, but the
 // post-lock J inventory does not support the claimed repair.
 const previous={target:step.target,witness:f.witness,hold:false,holdCount:0,continuation:[step],context:JSON.stringify([before.rules,before.board,before.hold,before.canHold,before.queue,before.bag??null,before.active.type]),metrics:{},evidence:{cycleDebt:0,cavityRepair:{status:'verified-prefix-repaired'}}};
 assert.equal(P.revalidate(before,previous,{now:()=>0,deadline:1,maxNodes:8000}),null);
 const next=R.move(before,'L');assert.notEqual(next,before);
 assert.equal(P.advance(next,previous,'L',{now:()=>0,deadline:1,maxNodes:8000}),null);
});
test('D admission: full policy accepts actual immediate J exits, not only geometry helper',()=>{
 const f=fixtures[1],before=state({...f,queue:['J','S','O','T','I','S']}),r=R.replay(before,f.witness);
 assert.equal(r.valid,true);assert.equal(r.state.active.type,'J');
 const p={state:r.state,event:r.events[0],witness:f.witness};
 const proof=P.dPatternAdmission(before,p,{now:()=>0,deadline:1,maxNodes:8000});assert.equal(proof.valid,true,proof.reason);
 assert.equal(R.replay(r.state,proof.exit.witness).valid,true);
});
test('D admission: one J cannot pay Left and Center; a distinct executable replacement can',()=>{
 const M=require('../st-midgame-resources');
 const heights=[6,4,6,6,4,1,2,0,0,0],board=Array.from({length:40},(_,y)=>heights.map(h=>y>=40-h?'X':'.').join(''));
 const cells=[[5,36],[6,36],[5,37],[5,38]],witness=['L','L','L','CW','HD'];
 for(const replacement of [false,true]){
  const before=R.createState({board,active:'J',hold:'O',queue:replacement?['J','J','O']:['J','O']}),r=R.replay(before,witness);
  // Synthetic explicit pending Center obligation, not asserted historical OJ
  // provenance. Literal target is independently replayed in the positive arm.
  const resource=M.start(before,{center:{pending:[{rootId:99,rootBag:null,family:'OJ',alternatives:[{piece:'J',cells}]}]}});
  const proof=P.dPatternAdmission(before,{state:r.state,event:r.events[0],witness},{resource,now:()=>0,deadline:1,maxNodes:8000});
  assert.equal(proof.valid,replacement,proof.reason);
  if(replacement){const finish=R.replay(proof.exit.state,['CW','R','HD']);assert.equal(finish.valid,true);assert.deepEqual(finish.events[0].cells,cells);}
  else assert.equal(proof.reason,'D-J-exit-resources-unrepaired');
 }
});
