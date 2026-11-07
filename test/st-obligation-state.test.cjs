'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Q=require('../st-obligation-state'),R=require('../st-rules'),I=require('../st-public-inventory'),H=require('../st-resource-history'),O=require('../st-opening-obligations'),SL=require('../st-sl-obligations'),S=require('../st-structure'),F=require('../st-fixtures'),B=require('../st-bag'),PH=require('../st-pattern-history');
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const first=()=>R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1});
function actual(root,position,inventory,witness,boundary={}){
 let state=root,out=[];for(const action of witness){const before=position;position=R.move(before,action);assert.notEqual(position,before);const receipt=I.transition(inventory,before,action,position);assert.equal(receipt.status,'available');const result=Q.applyActual(state,{before,after:position,inventory,receipt,action,boundary:action==='HD'?boundary:{}});state=result.state;out.push(...result.effects);inventory=receipt.next;}
 return{state,position,inventory,effects:out};
}
function parity(root,position,inventory,witness,boundary={}){
 const saved=copy({root,position,inventory});freeze(root);freeze(position);
 const projected=Q.project(root,{position,inventory,witness,boundary});
 const observed=actual(root,position,inventory,witness,boundary);
 assert.deepEqual(projected.state,observed.state);assert.deepEqual(projected.effects,observed.effects);assert.deepEqual(projected.position,observed.position);assert.deepEqual(projected.inventory,observed.inventory);
 assert.deepEqual({root,position,inventory},saved);return projected;
}
// Legacy history supplies only the caller's source/lock-seven boundary facts in
// this test helper. It is not an input to the current-fact module or its state.
function replay(origin){
 let position=R.createState(origin),inventory=I.start(position,{fresh:true}),state=Q.start(position,{inventory}),history=H.start(position,{fresh:true,inventory}),locks=0,last;
 function act(action,revealed=[]){
  const before=position,old=history,raw=R.move(before,action);assert.notEqual(raw,before);
  const after={...raw,queue:[...raw.queue,...revealed]},receipt=I.transition(inventory,before,action,after);assert.equal(receipt.status,'available');
  history=H.applyAction(history,before,action,after,{inventoryTransition:receipt});assert.equal(history.coverage.status,'complete');
  const boundary={};if(action==='HD'){locks++;boundary.closeFoundation=Boolean(!old.milestones.sourcePattern&&history.milestones.sourcePattern);if(locks===7)boundary.firstBagReview=history.milestones.sourcePattern?.at===7?'reviewed':'unreviewed';}
  last=Q.applyActual(state,{before,after,inventory,receipt,action,boundary});state=last.state;position=after;inventory=receipt.next;return last;
 }
 return{act,lock(witness){for(const action of witness)act(action);return last;},
  handoff(){const c={position,inventory};last=Q.transition(state,{kind:'handoff'},{before:c,after:c});state=last.state;history=H.markHandoff(history,position);return last;},
  begin(candidate=true){const c={position,inventory};last=Q.transition(state,{kind:'begin-reset',candidate},{before:c,after:c});state=last.state;return last;},
  load(context){if(context.handoffAtAction===0)this.handoff();for(const [i,step]of context.steps.entries()){act(step.action,step.revealed);if(context.handoffAtAction===i+1)this.handoff();}return this;},
  get state(){return state;},get position(){return position;},get inventory(){return inventory;},get history(){return history;},get locks(){return locks;},get last(){return last;}};
}
function trial(n,until=Infinity){const f=require('./support/st-resource-trial-'+n+'.json'),x=replay(f.initial);for(const step of f.steps){if(x.locks>=until)break;x.act(step.action,step.revealed);}return x;}
const context=x=>({position:x.position,inventory:x.inventory});

test('shared state: actual receipt and known observed projection share exact state and effects',()=>{
 const p=first(),inventory=I.start(p,{fresh:true}),root=Q.start(p,{inventory});
 const a=parity(root,p,inventory,['L','HD']);assert.equal(a.locked.id,1);assert.equal(a.locked.bag,0);
 const b=parity(root,p,inventory,['R','HD']);assert.notDeepEqual(a.position.board,b.position.board);assert.deepEqual(root,Q.start(p,{inventory}));
 assert.deepEqual(Q.importState(copy(a.state)),a.state);assert.equal('position' in a.state,false);assert.equal('inventory' in a.state,false);assert.equal('effects' in a.state,false);
});
test('shared state: empty and two HOLD witnesses lock the post-HOLD subject without synthetic receipts',()=>{
 const p=first(),inventory=I.start(p,{fresh:true}),root=Q.start(p,{inventory});
 const empty=parity(root,p,inventory,['HOLD','L','HD']);assert.equal(empty.locked.id,2);assert.equal(empty.inventory.hold.id,1);assert.equal(empty.inventory.nextId,8);
 const twice=parity(root,p,inventory,['HOLD','HOLD','HD']);assert.equal(twice.locked.id,1);assert.equal(twice.inventory.hold.id,2);assert.equal(twice.inventory.active.id,3);
 assert.equal(I.matchesTransition(twice,inventory,p,'HD',twice.position),false);
});
test('shared state: old held piece retains original bag in actual and projected lock',()=>{
 const f=require('./support/st-shadow-cross-bag.json'),x=replay(f.initial);for(const step of f.steps){x.act(step.action,step.revealed);if(x.locks===7)break;}
 assert.equal(x.inventory.hold.bag,0);assert.equal(x.inventory.active.bag,1);
 const result=parity(x.state,x.position,x.inventory,['HOLD','HD']);assert.equal(result.locked.id,7);assert.equal(result.locked.bag,0);assert.equal(result.inventory.hold.bag,1);
});
test('shared state: unsupported unknown, forced or expanded projected supply fails before mutation',()=>{
 const position=R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}),inventory=I.start(position),root=Q.start(position,{inventory}),saved=copy({position,inventory,root});
 assert.equal(B.forcedNext(inventory.knowledge),'Z');assert.throws(()=>Q.project(root,{position,inventory,witness:['HD']}),/already-observed known/);assert.deepEqual({position,inventory,root},saved);
 const p=first(),known=I.start(p,{fresh:true}),state=Q.start(p,{inventory:known});
 assert.throws(()=>Q.project(state,{position:{...p,queue:[...p.queue,'I']},inventory:known,witness:['HD']}),/already-observed known/);
 assert.throws(()=>Q.project(state,{position:p,inventory:copy(known),witness:['HD']}),/already-observed known/);
 assert.throws(()=>Q.project(state,{position:p,inventory:known,witness:['HOLD','TELEPORT','HD']}),/rejected projected/);assert.deepEqual(state,Q.start(p,{inventory:known}));
 const unknownActual=actual(root,position,inventory,['HD']);assert.equal(unknownActual.state.availability,'unknown');assert.equal(unknownActual.state.account.known,false);
});
test('shared state: stale/copied actual receipts reject accounting without rolling back the move',()=>{
 const before=first(),inventory=I.start(before,{fresh:true}),root=Q.start(before,{inventory}),after=R.move(before,'HD'),saved=copy(after),receipt=I.transition(inventory,before,'HD',after);
 for(const data of [{receipt:copy(receipt)},{inventory:I.importState(I.exportState(inventory))},{before:{...before,revision:99}},{after:{...after,revision:99}},{action:'HOLD'}])assert.throws(()=>Q.applyActual(root,{before,after,inventory,receipt,action:'HD',...data}),/actual controller receipt/);
 assert.deepEqual(after,saved);assert.equal(receipt.next.active.id,2);assert.deepEqual(root,Q.start(before,{inventory}));
 const accepted=Q.applyActual(root,{before,after,inventory,receipt,action:'HD'});assert.throws(()=>Q.applyActual(accepted.state,{before:after,after:R.move(after,'HD'),inventory:receipt.next,receipt,action:'HD'}),/actual controller receipt/);
 const following=I.transition(receipt.next,after,'HOLD',R.move(after,'HOLD'));assert.equal(following.status,'available','Caller inventory continues independently of accounting failures');
});
test('shared state: exact Center payment clears both current facets once and never stores timestamps',()=>{
 const p=R.createState({board:F.get('cap-rebuild').observation.board,active:'J',queue:[...'ZLIOTS'],streamCursor:1});
 const fresh=R.createState({...p,board:Array(40).fill('..........')}),inventory=I.start(fresh,{fresh:true}),snapshot=Q.start(fresh,{inventory});
 // This known nonempty fixture explicitly supplies trusted current facts; a
 // known inventory alone must not reset accounting on an imported board.
 snapshot.safety.notches=PH.start(p);const root=Q.importState(snapshot);
 const created=parity(root,p,inventory,['CW','HD']);assert.equal(created.state.center.pending.length,1);assert.equal(created.state.center.pending[0].family,'ZJ');assert.equal('createdAt' in created.state.center.pending[0],false);
 const copied=copy(created.state);copied.center.debt=[{...copy(copied.center.pending[0]),divertedPieceId:90}];const imported=Q.importState(copied);
 const result=parity(imported,created.position,created.inventory,['R','R','CW',...Array(7).fill('SD'),'L','HD']);
 assert.deepEqual(result.state.center,{pending:[],debt:[]});assert.deepEqual(result.effects.filter(e=>e.domain==='center').map(e=>e.status),['fulfilled','debt-fulfilled']);assert.equal(result.effects.some(e=>'at'in e),false);
});
test('shared state: coupled public replays preserve Center, opening account and compact S/L facts',()=>{
 for(const n of [1,2,5]){
  const f=require('./support/st-resource-trial-'+n+'.json'),x=replay(f.initial);
  for(const step of f.steps){x.act(step.action,step.revealed);if(step.action!=='HD')continue;
   const old=H.resolve(x.position,x.history),now=O.resolve(x.state.account,{board:x.position.board});
   assert.deepEqual(now.openingAllocation,Object.fromEntries(['status','requiredNonRightT','requiredNonRightZ'].map(k=>[k,old.openingAllocation[k]])));
   assert.deepEqual(now.extraZ,{status:old.extraZ.status,baseline:Boolean(old.extraZ.baseline),remaining:old.extraZ.remaining});
   assert.deepEqual(x.state.center.pending.map(p=>[p.rootId,p.family,p.alternatives]),old.center.pending.map(p=>[p.rootId,p.family,p.alternatives]));
   const sl=SL.resolve(x.state.sl,{inventory:x.inventory,center:x.state.center,profileLost:O.profileLost(x.state.account)});
   for(const kind of ['S','L']){assert.equal(sl['hanging'+kind].status,old['hanging'+kind].status);assert.equal(sl['hanging'+kind].unclassifiedCount,old['hanging'+kind].unclassified.length);}
   assert.deepEqual(Q.importState(copy(x.state)),x.state);
  }
 }
});
test('shared state: Center pair payment updates S/L before delayed quality without granting route permission',()=>{
 const f=require('./fixtures/opening-z-allocation.json'),x=replay(f.request.options.resourceContext.origin).load(f.request.options.resourceContext);
 let projected={state:x.state,position:x.position,inventory:x.inventory};
 for(const [i,step]of f.steps.entries()){
  projected=parity(projected.state,projected.position,projected.inventory,step.witness);
  if(i<4)assert.equal(projected.state.account.z.remaining,null);
 }
 assert.equal(projected.state.account.z.remaining,1);assert.equal(projected.state.account.opening,null);assert.ok(projected.effects.some(e=>e.status==='baseline-established'));
 assert.equal('routeAssessment'in projected,false);assert.equal('admitted'in projected,false);assert.equal(x.state.account.z.remaining,null,'Root has not earned a hypothetical allowance');
});
test('shared state: trusted current JSON imports retain current duties without geometry provenance or history',()=>{
 const x=trial(1,24),portable=copy(x.state);portable.safety.coveredCells=[[1,37]];portable.safety.notches={version:2,status:'established',anchorRow:35,blockedRows:[],source:'trusted-current'};portable.dPending=true;
 const imported=Q.importState(portable);assert.deepEqual(imported,portable);assert.equal(imported.dPending,true);portable.safety.coveredCells[0][0]=3;assert.deepEqual(imported.safety.coveredCells,[[1,37]]);
 const c=context(x),begun=Q.transition(imported,{kind:'begin-reset',candidate:true},{before:c,after:c});assert.deepEqual(begun.state.account.reset.inheritedCovered,[[1,37]]);
 for(const edit of [s=>s.history=[],s=>s.safety.notches={origin:x.position.board,steps:[]},s=>s.center.pending.push({id:'bad',rootId:999,family:'SL',alternatives:[{piece:'L',cells:[[4,30],[5,30],[6,30],[4,31]]}]}),s=>s.account.reset.inheritedCovered.push([2,36])]){const bad=copy(begun.state);edit(bad);assert.throws(()=>Q.importState(bad));}
});
test('shared state: actual Reset completion retires only its duty and emits one credit and completion',()=>{
 const x=trial(1,24);assert.equal(x.state.account.z.remaining,0);x.begin();const start=copy(x.state);assert.equal(start.account.reset.remaining,2);
 const one=parity(x.state,x.position,x.inventory,['L','L','L','HD']);assert.equal(one.state.account.reset.remaining,1);assert.equal(one.state.account.z.remaining,1);
 x.lock(['L','L','L','HD']);for(let n=0;n<4;n++)x.lock(['HD']);assert.equal(x.state.account.reset.status,'active');assert.equal(x.state.account.z.remaining,0);
 const before=copy(x.state),result=parity(x.state,x.position,x.inventory,['L','L','L','HD']);assert.deepEqual(result.state.account.reset,{status:'inactive'});assert.equal(result.state.account.z.remaining,1);
 assert.equal(result.effects.filter(e=>e.status==='reset-completed').length,1);assert.equal(result.effects.filter(e=>e.status==='reset-T-credited').length,1);assert.equal(before.account.reset.remaining,1);assert.equal(start.account.reset.remaining,2);
});
test('shared state: handoff rebases S/L exactly once and retains other current work',()=>{
 const x=trial(1,10),before=copy(x.state),a=x.handoff(),b=x.handoff();assert.equal(a.state.sl.handoff,true);assert.equal(a.state.sl.foundationOpen,false);assert.deepEqual(b.state,a.state);assert.deepEqual(b.effects,[]);
 for(const key of ['center','account','safety','dPending'])assert.deepEqual(a.state[key],before[key]);
});
test('shared state: observed D creation persists across a D lock, imported D geometry is unclaimed',()=>{
 const fixture=require('./fixtures/st-d-admission.json')[1],position=R.createState({board:[...Array(20).fill('..........'),...fixture.board],active:fixture.active,hold:fixture.hold,queue:fixture.queue}),inventory=I.start(position),root=Q.start(position,{inventory});
 assert.equal(S.leftSurface.isD(position.board),false);const created=actual(root,position,inventory,fixture.witness);assert.equal(created.state.dPending,true);assert.ok(created.effects.some(e=>e.domain==='D'&&e.status==='created'));
 assert.equal(Q.start(created.position,{inventory:created.inventory}).dPending,false);assert.equal(Q.importState(copy(created.state)).dPending,true);
 const next=actual(created.state,created.position,created.inventory,['R','R','HD']);assert.equal(S.leftSurface.isD(next.position.board),true);assert.equal(next.state.dPending,true);
 const h=[6,4,6,6,4,1,2,0,0,0],p=R.createState({board:Array.from({length:40},(_,y)=>h.map(v=>y>=40-v?'X':'.').join('')),active:'J',hold:'O',queue:['J','J','O']}),inv=I.start(p),initial=Q.start(p,{inventory:inv});
 const pending=actual(initial,p,inv,['L','L','L','CW','HD']),paid=actual(pending.state,pending.position,pending.inventory,['L','L','R180','HD']);assert.equal(S.leftSurface.isD(paid.position.board),false);assert.equal(paid.state.dPending,false);assert.ok(paid.effects.some(e=>e.domain==='D'&&e.status==='cleared'));
});

test('shared state: first canonical TSD closes foundation without a repeated caller boundary',()=>{
 const x=trial(1,14),root=copy(x.state);root.sl.foundationOpen=true;const f=require('./support/st-resource-trial-1.json');let count=0,witness=[];for(const step of f.steps){if(count===14)witness.push(step.action);if(step.action==='HD')count++;if(count===15)break;}
 const next=parity(root,x.position,x.inventory,witness);assert.equal(next.state.account.firstTsd,true);assert.equal(next.state.sl.foundationOpen,false);
});
test('shared state: pure seam rejects non-lock board changes and validates explicit current boundary facts',()=>{
 const position=first(),inventory=I.start(position,{fresh:true}),root=Q.start(position,{inventory}),before={position,inventory},after={position:R.move(position,'HD'),inventory:null};after.inventory=I.applyAction(inventory,position,'HD',after.position);
 assert.throws(()=>Q.transition(root,{kind:'observe'},{before,after}),/non-lock board/);
 assert.throws(()=>Q.transition(root,{kind:'observe',firstBagReview:'guessed'},{before,after:before}),/firstBagReview/);
 assert.throws(()=>Q.transition(root,{kind:'observe'},{before,after:before,references:[-1]}),/caller references/);
 const moved={position:R.move(position,'R'),inventory};assert.throws(()=>Q.transition(root,{kind:'handoff'},{before,after:moved}),/handoff boundary/);
});

test('shared state: 1000 actual O-only manual locks retain equivalent current facts without archives',()=>{
 // Reuses the notch lifecycle cycle: five legal O locks clear two rows and
 // return to the empty board. This is NOT seven-bag supply or ST strategy.
 let position=R.createState({active:'O',queue:['O']}),inventory=I.start(position),state=Q.start(position,{inventory}),stable,bytes;const saved=[];
 for(let n=0;n<1000;n++){
  const offset=[-4,-2,0,2,4][n%5],witness=[...Array(Math.abs(offset)).fill(offset<0?'L':'R'),'HD'];
  for(const action of witness){
   const before=position,raw=R.move(before,action);assert.notEqual(raw,before);const after=action==='HD'?{...raw,queue:[...raw.queue,'O']}:raw;
   const receipt=I.transition(inventory,before,action,after);assert.equal(receipt.status,'available');
   const result=Q.applyActual(state,{before,after,inventory,receipt,action});position=after;inventory=receipt.next;state=result.state;
  }
  if(n<10)saved.push(copy(state));
  if(n%5===4){
   assert.deepEqual(position.board,R.emptyBoard());
   if(n===9){stable=copy(state);bytes=JSON.stringify(state).length;}
   if(n>=9){assert.deepEqual(state,stable);assert.equal(JSON.stringify(state).length,bytes);}
  }
 }
 assert.equal(inventory.nextId,1003);assert.equal(inventory.active.id,1001);assert.equal(state.availability,'unknown');assert.equal(state.safety.notches.status,'broken');
 assert.deepEqual(Object.keys(state),['schemaVersion','availability','center','sl','account','safety','dPending']);assert.deepEqual(state.center,{pending:[],debt:[]});assert.deepEqual(state.sl.residuals,[]);
 for(const snapshot of saved)assert.deepEqual(Q.importState(copy(snapshot)),snapshot,'Caller-owned old snapshots remain independently importable');
});

test('shared state: a known progressed inventory cannot reset existing duties through start',()=>{
 const x=trial(1,10);assert.throws(()=>Q.start(x.position,{inventory:x.inventory}),/fresh first-bag origin/);
 const p=first(),inventory=I.start(p,{fresh:true}),nonempty={...p,board:p.board.slice()};nonempty.board[39]='X.........';assert.throws(()=>Q.start(nonempty,{inventory}),/fresh first-bag origin/);
 const held=R.move(p,'HOLD'),afterHold=I.applyAction(inventory,p,'HOLD',held);assert.throws(()=>Q.start(held,{inventory:afterHold}),/fresh first-bag origin/);
 const saved=Q.importState(copy(x.state));assert.deepEqual(saved,x.state,'Existing known facts remain supported through explicit trusted import');
 const invalid=copy(saved);invalid.safety.coveredCells=[[7,39]];assert.throws(()=>Q.importState(invalid),/Left\/Center covered/);
});
