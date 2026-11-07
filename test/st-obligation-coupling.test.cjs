'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),I=require('../st-public-inventory'),C=require('../st-center-obligations');
const SL=require('../st-sl-obligations'),O=require('../st-opening-obligations'),Context=require('../st-obligation-context');
const S=require('../st-structure'),A=require('../st-access'),Patterns=require('../st-opening-patterns');
const opening=require('./fixtures/opening-z-allocation.json'),copy=x=>JSON.parse(JSON.stringify(x));
function compactSL(summary,closed=[]){return Object.fromEntries(['S','L'].map(kind=>{
 const f=summary['hanging'+kind],counts=f.aggregate?.slice()||(kind==='S'?[0,0,0,0]:[0]);
 for(const p of f.unclassified){const invalidated=p.invalidated||closed.some(c=>c.family==='SL'&&c.rootId===p.sId&&c.status==='invalidated');counts[kind==='S'?(p.requiresAccommodation?1:0)+(invalidated?2:0):0]++;}
 return[kind,{status:f.status,evidence:f.evidence.map(({at,reason,...p})=>p).sort((a,b)=>a.bag-b.bag),uncertainty:counts}];
}));}
function replay(position,snapshot){
 const x=require('./support/current-player.cjs')(position,{snapshot});
 return{act:x.act,lock:x.lock,handoff:x.handoff,beginReset:x.begin,check(){return Context.resolve(x.context,{position:x.position});},get account(){return x.state.account;},get center(){return x.state.center;},get sl(){return compactSL(Context.resolve(x.context,{position:x.position}));},get raw(){return x.position;},get last(){return x.last;},get covered(){return x.state.safety.coveredCells;},get locks(){return x.locks;}};
}
const recorded=()=>replay(opening.request.observation,opening.request.options.obligationContext);

test('coupled obligations: delayed quality waits for actual Center payment and S/L settlement',()=>{
 const a=recorded();for(const i of [0,1])a.lock(opening.steps[i].witness);
 assert.equal(a.account.opening.kind,'quality');assert.equal(a.account.z.remaining,null);assert.equal(a.account.mandatoryZ,false);
 assert.deepEqual(a.center.pending.map(p=>[p.rootId,p.family]),[[12,'ZJ']]);
 for(const i of [2,3]){a.lock(opening.steps[i].witness);assert.equal(a.account.z.remaining,null);}
 assert.ok(a.last.effects.some(e=>e.domain==='center'&&e.family==='ZJ'&&e.rootId===12&&e.partnerId===21&&e.status==='fulfilled'));
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
 assert.deepEqual(lost.center,{pending:[],debt:[]});assert.equal(lost.last.effects.some(e=>e.status==='fulfilled'),false);
 assert.ok(lost.last.effects.some(e=>e.status==='quality-disqualified'&&e.reason==='invalidated-Center-debt'));
 lost.lock(['HOLD','L','L','L','HD']);assert.equal(lost.account.z.remaining,null);assert.equal(lost.account.opening,null);
 assert.equal(lost.check().openingAllocation.status,'verified-first-tsd');
});

test('coupled obligations: H01 controller handoff rebases S/L without paying Center or granting Z',()=>{
 const f=require('./fixtures/opening-handoff-sl-h01.json'),a=replay(f.position||f.initial,f.obligationContext);
 const before=copy({center:a.center,covered:a.covered,account:a.account});assert.equal(a.locks,0);
 assert.deepEqual(a.sl.S,{status:'unknown',evidence:[],uncertainty:[0,0,1,0]});assert.equal(a.account.z.remaining,1);
 a.handoff();assert.deepEqual(a.sl.S,{status:'none-observed',evidence:[],uncertainty:[0,0,0,0]});
 assert.deepEqual(a.sl.L.evidence,[{bag:2,lId:17,sId:15}]);assert.deepEqual(a.sl.L.uncertainty,[0]);
 assert.deepEqual({center:a.center,covered:a.covered,account:a.account},before);
 const settled=copy(a.sl);a.handoff();assert.deepEqual(a.sl,settled,'Repeated marker cannot duplicate or repay a duty');
});

test('coupled obligations: real Reset credits distinct actual Ts and retires only its active duty',()=>{
 const f=require('./support/st-reset-live-cycle.json'),a=replay(f.position||f.initial,f.obligationContext);
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
 assert.deepEqual(a.raw.board,f.final.board);assert.equal(a.locks,8);
 // A second recorded controller marker isolates new covered cells during an
 // active Reset: they must not become inherited debt or erase L uncertainty.
 const g=require('./fixtures/resource-projection-history.json').cases[1],b=replay(g.observation,g.obligationContext);
 assert.deepEqual(b.account.reset,{status:'active',remaining:1,firstTId:40,inheritedCovered:[]});
 b.lock(g.witness);assert.deepEqual(b.covered,[[3,24]]);assert.deepEqual(b.account.reset.inheritedCovered,[]);
 assert.deepEqual(b.sl.L,{status:'unknown',evidence:[],uncertainty:[1]});assert.equal(b.account.z.remaining,1);
});
