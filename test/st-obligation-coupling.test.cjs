'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),I=require('../st-public-inventory'),C=require('../st-center-obligations');
const SL=require('../st-sl-obligations'),O=require('../st-opening-obligations'),H=require('../st-resource-history');
const S=require('../st-structure'),A=require('../st-access'),Patterns=require('../st-opening-patterns');
const opening=require('./fixtures/opening-z-allocation.json'),copy=x=>JSON.parse(JSON.stringify(x));
function compactSL(summary,closed=[]){return Object.fromEntries(['S','L'].map(kind=>{
 const f=summary['hanging'+kind],counts=f.aggregate?.slice()||(kind==='S'?[0,0,0,0]:[0]);
 for(const p of f.unclassified){const invalidated=p.invalidated||closed.some(c=>c.family==='SL'&&c.rootId===p.sId&&c.status==='invalidated');counts[kind==='S'?(p.requiresAccommodation?1:0)+(invalidated?2:0):0]++;}
 return[kind,{status:f.status,evidence:f.evidence.map(({at,reason,...p})=>p).sort((a,b)=>a.bag-b.bag),uncertainty:counts}];
}));}
function legacyProfile(h){const remaining=h.extraZ.baseline?1+h.reset.credits.length-h.extraZ.allocations.length:null;
 return Boolean(h.opening.violations.length||h.extraZ.departures.length||h.reset.status==='invalid'||(h.extraZ.baseline?remaining<0:h.extraZ.allocations.length>1)||(!h.milestones.firstTsd&&(h.opening.counts.TNonRight>2||h.opening.counts.ZNonRight>1)));}
// Test-only composition of the deliberately unwired reducers. Legacy history
// receives the same actual actions, but supplies no component state or inputs.
// Existing public fixtures supply reveal timing and controller phase markers;
// no search, private future or strategy mocks. Literal identity/outcome checks
// below remain useful after the temporary legacy comparisons are retired.
function replay(context){
 let raw=R.createState(context.origin),inv=I.start(raw,{fresh:context.fresh});raw={...raw,bag:inv.knowledge};
 let history=H.start(raw,{fresh:context.fresh,inventory:inv});
 let center=C.start(raw.board),sl=SL.start({known:inv.originKnown}),account=O.start({known:inv.originKnown});
 let covered=[],notches=S.notchPattern(raw.board),actions=0,locks=0,sourceSeen=false,last={effects:[],pairs:[]};
 const current=()=>({inventory:inv,center});
 const summary=()=>O.resolve(account,{board:raw.board});
 function check(){
  const old=H.resolve(raw,history),now=summary(),label='action '+actions+' / lock '+locks;
  assert.equal(old.coverage.status,'complete',label);
  assert.deepEqual(now.openingAllocation,Object.fromEntries(['status','requiredNonRightT','requiredNonRightZ'].map(k=>[k,old.openingAllocation[k]])),label+' opening');
  assert.deepEqual(now.extraZ,{status:old.extraZ.status,baseline:Boolean(old.extraZ.baseline),remaining:old.extraZ.remaining},label+' Z');
  assert.equal(now.firstTsd,Boolean(history.milestones.firstTsd),label+' first TSD');
  assert.equal(now.profileLost,legacyProfile(history),label+' profile');assert.equal(now.reset.status,old.reset.status,label+' Reset');
  if(now.reset.status==='active'){assert.equal(now.reset.progress,old.reset.progress,label);assert.deepEqual(account.reset.inheritedCovered,old.reset.inheritedCovered,label+' inherited cells');}
  assert.deepEqual(center,{pending:history.center.pending,debt:history.center.debt},label+' Center');
  assert.deepEqual(covered,old.coveredRepair.cells,label+' covered cells');
  assert.deepEqual(compactSL(SL.resolve(sl,{...current(),profileLost:now.profileLost})),compactSL(old,history.center.closed),label+' S/L');
  return now;
 }
 function handoff(){const c=current();sl=SL.transition(sl,{kind:'handoff'},{before:c,after:c}).state;history=H.markHandoff(history,raw);check();}
 function beginReset(){
  history=H.beginReset(history,raw);assert.equal(history.coverage.status,'complete','Real Reset policy accepts the supplied controller marker');
  const result=O.beginReset(account,{candidate:true,inheritedCovered:covered});account=result.state;last={...result,pairs:[]};check();
 }
 function markers(){if(context.handoffAtAction===actions)handoff();if(context.resetAtActions?.includes(actions))beginReset();}
 function act(action,revealed=[]){
  const prior=current(),before=raw,next=R.move(raw,action);assert.notEqual(next,raw,'Accepted public action '+action);
  raw={...next,revision:before.revision+1,queue:[...next.queue,...revealed],bag:revealed.reduce((bag,type)=>B.consume(bag,type),next.bag)};
  const receipt=I.transition(inv,before,action,raw);assert.equal(receipt.status,'available');inv=receipt.next;
  assert.deepEqual(raw.bag,inv.knowledge,'Public bag advances only by this action’s revealed suffix');
  history=H.applyAction(history,before,action,raw,{inventoryTransition:receipt});actions++;
  if(action==='HD'){
   locks++;const event=raw.lastEvent,c=C.apply(center,before.board,raw.board,event,{pieceId:receipt.locked.id,at:locks});center=c.state;
   const sourceMatch=!sourceSeen&&Patterns.patterns.some(p=>JSON.stringify(raw.board)===JSON.stringify(Array(40-p.rows.length).fill('..........').concat(p.rows)));
   const closeFoundation=sourceMatch||(!account.firstTsd&&O.predicates.tsd(event));sourceSeen||=sourceMatch;
   const s=SL.transition(sl,{kind:'lock',piece:receipt.locked,event,centerEffects:c.effects,pairs:c.pairs,closeFoundation,...(locks===7?{firstBagReview:sourceMatch?'reviewed':'unreviewed'}:{})},{before:prior,after:current()});sl=s.state;
   notches=S.advanceNotches(before.board,{state:raw,event},notches).pattern;covered=A.repairStep(before.board,raw.board,event,covered,notches);
   const o=O.transition(account,{kind:'lock',piece:receipt.locked,event,centerEffects:c.effects},{before:{board:before.board},after:{board:raw.board,topOut:raw.topOut,center,sl:SL.resolve(sl,current()),coveredCells:covered}});account=o.state;
   last={effects:[...c.effects,...s.effects,...o.effects],pairs:c.pairs};
  }else sl=SL.transition(sl,{kind:'observe'},{before:prior,after:current()}).state;
  check();markers();return last;
 }
 markers();check();for(const step of context.steps)act(step.action,step.revealed);
 return{act,handoff,beginReset,check,lock(witness){for(const action of witness)act(action);return last;},get account(){return account;},get center(){return center;},get sl(){return compactSL(SL.resolve(sl,{...current(),profileLost:O.profileLost(account)}));},get raw(){return raw;},get last(){return last;},get covered(){return covered;},get locks(){return locks;}};
}
const recorded=()=>replay(opening.request.options.resourceContext);

test('coupled obligations: delayed quality waits for actual Center payment and S/L settlement',()=>{
 const a=recorded();for(const i of [0,1])a.lock(opening.steps[i].witness);
 assert.equal(a.account.opening.kind,'quality');assert.equal(a.account.z.remaining,null);assert.equal(a.account.mandatoryZ,false);
 assert.deepEqual(a.center.pending.map(p=>[p.rootId,p.family]),[[12,'ZJ']]);
 for(const i of [2,3]){a.lock(opening.steps[i].witness);assert.equal(a.account.z.remaining,null);}
 assert.deepEqual(a.last.pairs,[{family:'ZJ',rootId:12,partnerId:21,at:20}]);
 assert.deepEqual(a.sl.S.evidence,[{bag:2,sId:18,lId:17}],'Exact Center payment still leaves the actual S duty');
 a.lock(opening.steps[4].witness);
 assert.equal(a.account.z.remaining,1);assert.equal(a.account.opening,null);assert.deepEqual(a.center,{pending:[],debt:[]});
 assert.equal(a.last.effects.filter(e=>e.status==='baseline-established').length,1);
 assert.equal(a.sl.S.status,'none-observed');assert.equal(a.sl.L.status,'none-observed');
});

test('coupled obligations: mandatory Z payment and invalidated Center debt have distinct outcomes',()=>{
 const paid=recorded();paid.lock(['L','L','L','HD']);paid.lock(opening.steps[1].witness);
 assert.equal(paid.account.mandatoryZ,true);assert.equal(paid.check().openingAllocation.requiredNonRightZ,1);
 paid.lock(opening.steps[0].witness.slice(1));
 assert.equal(paid.account.mandatoryZ,false);assert.equal(paid.account.z.uncredited,'none');assert.equal(paid.account.z.remaining,null);
 assert.equal(paid.last.effects.filter(e=>e.status==='opening-Z-paid').length,1);
 paid.lock(opening.steps[3].witness);assert.equal(paid.account.z.remaining,1);
 const lost=recorded();for(const i of [0,1,2])lost.lock(opening.steps[i].witness);lost.lock(['L','L','L','HD']);
 assert.equal(lost.account.opening.kind,'quality');assert.equal(lost.center.debt.length,1);
 lost.lock(['CW','R','HD']);
 assert.deepEqual(lost.last.effects.filter(e=>e.rootId===12).map(e=>e.status),['invalidated','debt-invalidated']);
 assert.deepEqual(lost.center,{pending:[],debt:[]});assert.deepEqual(lost.last.pairs,[]);
 assert.ok(lost.last.effects.some(e=>e.status==='quality-disqualified'&&e.reason==='invalidated-Center-debt'));
 lost.lock(['HOLD','L','L','L','HD']);assert.equal(lost.account.z.remaining,null);assert.equal(lost.account.opening,null);
 assert.equal(lost.check().openingAllocation.status,'verified-first-tsd');
});

test('coupled obligations: H01 controller handoff rebases S/L without paying Center or granting Z',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),a=replay(f.resourceContext);
 const before=copy({center:a.center,covered:a.covered,account:a.account});assert.equal(a.locks,17);
 assert.deepEqual(a.sl.S,{status:'unknown',evidence:[],uncertainty:[0,0,1,0]});assert.equal(a.account.z.remaining,1);
 a.handoff();assert.deepEqual(a.sl.S,{status:'none-observed',evidence:[],uncertainty:[0,0,0,0]});
 assert.deepEqual(a.sl.L.evidence,[{bag:2,lId:17,sId:15}]);assert.deepEqual(a.sl.L.uncertainty,[0]);
 assert.deepEqual({center:a.center,covered:a.covered,account:a.account},before);
 const settled=copy(a.sl);a.handoff();assert.deepEqual(a.sl,settled,'Repeated marker cannot duplicate or repay a duty');
});

test('coupled obligations: real Reset credits distinct actual Ts and retires only its active duty',()=>{
 const f=require('./support/st-reset-live-cycle.json'),a=replay(f.resourceContext);
 assert.equal(a.account.z.remaining,0);a.beginReset();assert.equal(a.account.reset.remaining,2);
 const inherited=copy(a.covered);assert.deepEqual(a.account.reset.inheritedCovered,inherited);
 const credits=[];
 for(const [i,step]of f.steps.entries()){
  for(const {action,revealed}of step.actions)a.act(action,revealed);
  assert.deepEqual(a.raw.lastEvent,step.event);
  credits.push(...a.last.effects.filter(e=>e.status==='reset-T-credited').map(e=>[e.pieceId,e.delta]));
  if(i<f.steps.length-1){assert.equal(a.account.reset.status,'active');assert.equal(a.account.reset.remaining,1);}
 }
 assert.deepEqual(credits,[[57,1],[65,1]],'Two distinct public T identities earn exactly one credit each');
 assert.deepEqual(a.account.reset,{status:'inactive'});assert.equal(a.account.z.remaining,2);assert.equal(a.check().extraZ.status,'available');
 assert.equal(a.last.effects.filter(e=>e.status==='reset-completed').length,1);assert.equal(a.last.effects.filter(e=>e.delta===1).length,1);
 assert.deepEqual(a.raw.board,f.final.board);assert.equal(a.locks,64);
 // A second recorded controller marker isolates new covered cells during an
 // active Reset: they must not become inherited debt or erase L uncertainty.
 const g=require('./fixtures/resource-projection-history.json').cases[1],b=replay(g.resourceContext);
 assert.deepEqual(b.account.reset,{status:'active',remaining:1,firstTId:40,inheritedCovered:[]});
 b.lock(g.witness);assert.deepEqual(b.covered,[[3,24]]);assert.deepEqual(b.account.reset.inheritedCovered,[]);
 assert.deepEqual(b.sl.L,{status:'unknown',evidence:[],uncertainty:[1]});assert.equal(b.account.z.remaining,1);
});
