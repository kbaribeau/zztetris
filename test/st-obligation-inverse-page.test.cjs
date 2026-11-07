'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules');
const copy=x=>JSON.parse(JSON.stringify(x)),semantic=x=>({...copy(x),revision:0}),hidden={storage:{stGuideVisible:'false'}};
function empty(g){const menu=g.element('#st-fixture');menu.value='empty';menu.dispatchEvent(new g.window.Event('change'));}
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(message){this.message=copy(message);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};return all;}
function hd(position,extra={}){const replay=R.replay(position,['HD']);assert.equal(replay.valid,true);return{status:'recommended-with-verified-prefix',target:replay.events[0].target,witness:['HD'],hold:false,reason:'Controlled legal test move.',evidence:{opening:true},...extra};}
function handoff(g,all){g.advance(40);const worker=all.at(-1),P=g.window.STPlanner;g.window.STPlanner={...P,acceptOpeningResult:s=>({...s,active:false})};try{worker.respond(hd(worker.message.observation));}finally{g.window.STPlanner=P;}}
function squares(g,count=120){const fixture={id:'inverse-squares',label:'Squares',observation:R.createState({active:'O',queue:Array(6).fill('O')}),future:Array(count).fill('O')},F=g.window.STFixtures;g.window.STFixtures={...F,get:id=>id===fixture.id?copy(fixture):F.get(id)};g.window.stLab.loadFixture(fixture.id);}
function square(g,index){const dx=(index%5)*2-4;for(let n=0;n<Math.abs(dx);n++)g.window.stLab.act(dx<0?'L':'R');g.window.stLab.act('HD');}

test('inverse page: HD binds actual held subject and atomic Undo includes partial next-turn input',()=>withPage('st-lab.html',hidden,g=>{
 empty(g);const initial=g.snapshot(),current=copy(g.window.stLab.obligationContext),U=g.window.STObligationInverse,records=[],undos=[];
 g.window.STObligationInverse={...U,record(session,options){const out=U.record(session,options);records.push({options,out});return out;},undo(session,context,options){undos.push(options);return U.undo(session,context,options);}};
 for(const action of ['HOLD','L','HD'])g.window.stLab.act(action);
 const sealed=records.at(-1).out.receipt;assert.equal(sealed.piece.id,current.inventory.queue[0].id);assert.notEqual(sealed.piece.id,current.inventory.active.id);
 assert.deepEqual(copy(sealed.piece),copy(records.at(-1).options.piece));
 for(const action of ['HOLD','HOLD','R','CW'])g.window.stLab.act(action);
 const partial=records.at(-1).out.receipt;assert.equal(partial.piece,null);const revision=g.snapshot().revision;
 g.window.stLab.act('UNDO');assert.equal(undos[0].receipt,sealed);assert.equal(undos[0].tail,partial);assert.deepEqual(copy(undos[0].piece),copy(sealed.piece));
 assert.deepEqual(semantic(g.snapshot()),semantic(initial));assert.deepEqual(copy(g.window.stLab.obligationContext),current);assert.ok(g.snapshot().revision>revision);
 assert.equal(g.element('#st-undo').disabled,true);assert.equal(g.window.stLab.result,null);
 const exported=JSON.stringify(g.window.stLab.exportSession());for(const name of ['inverseReceipt','semanticToken','lockedPiece','pendingInverse'])assert.equal(exported.includes(name),false);
}));

test('inverse page: between-turn handoff joins older receipt before the next checkpoint',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);empty(g);const initial=g.snapshot(),initialContext=copy(g.window.stLab.obligationContext),U=g.window.STObligationInverse,joins=[];
 g.window.STObligationInverse={...U,join(session,options){joins.push(options);return U.join(session,options);}};
 g.window.stLab.act('HD');handoff(g,all);const baseline=g.snapshot(),boundary=copy(g.window.stLab.obligationContext);
 assert.equal(boundary.state.sl.handoff,true);assert.equal(g.window.stLab.exportSession().coaching.openingPhase,false);
 g.window.stLab.act('L');assert.equal(joins.length,1);assert.notEqual(joins[0].receipt.piece,null);assert.equal(joins[0].tail.piece,null);
 g.window.stLab.act('HD');g.window.stLab.act('UNDO');
 assert.deepEqual(semantic(g.snapshot()),semantic(baseline));assert.deepEqual(copy(g.window.stLab.obligationContext),boundary);assert.equal(g.window.stLab.exportSession().coaching.openingPhase,false);
 g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(initial));assert.deepEqual(copy(g.window.stLab.obligationContext),initialContext);assert.equal(g.window.stLab.exportSession().coaching.openingPhase,true);
}));

test('inverse page: handoff after lock or after partial input reverses with the same saved placement',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);
 for(const partial of [[],['HOLD','R']]){
  empty(g);const initial=g.snapshot(),current=copy(g.window.stLab.obligationContext);
  g.window.stLab.act('HD');for(const action of partial)g.window.stLab.act(action);handoff(g,all);
  assert.equal(g.window.stLab.obligationContext.state.sl.handoff,true);g.window.stLab.act('UNDO');
  assert.deepEqual(semantic(g.snapshot()),semantic(initial));assert.deepEqual(copy(g.window.stLab.obligationContext),current);assert.equal(g.window.stLab.exportSession().coaching.openingPhase,true);
 }
}));

test('inverse page: markers before the first accepted input remain that turn baseline',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);empty(g);handoff(g,all);const baseline=g.snapshot(),current=copy(g.window.stLab.obligationContext),U=g.window.STObligationInverse;
 let joins=0;g.window.STObligationInverse={...U,join(...args){joins++;return U.join(...args);}};
 for(const action of ['HOLD','HOLD','L','HD'])g.window.stLab.act(action);g.window.stLab.act('UNDO');
 assert.equal(joins,0);assert.deepEqual(semantic(g.snapshot()),semantic(baseline));assert.deepEqual(copy(g.window.stLab.obligationContext),current);
 assert.equal(current.state.sl.handoff,true);assert.equal(g.window.stLab.exportSession().coaching.openingPhase,false);
}));

test('inverse page: accepted Begin Reset marker is reversed with the pre-input checkpoint without credit',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);empty(g);const current=copy(g.window.stLab.obligationContext),account=current.state.account;
 // Trusted current account, not a fabricated allocation replay or strategy
 // result. Controlled advice isolates the already-supported marker lifecycle.
 Object.assign(account,{firstTsd:true,allocationVerified:true,mandatoryZ:false,thirdTWindow:false,qualityCandidate:false,opening:null});
 account.profile={violation:false,departure:false,before:null,capEstablished:false};account.z={remaining:0,uncredited:'none'};current.state.sl.foundationOpen=false;
 const Session=require('../st-session'),saved=Session.create(g.snapshot(),{obligationContext:current,openingPhase:false});
 g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/i);
 const baseline=g.snapshot(),root=copy(g.window.stLab.obligationContext);g.window.stLab.act('L');g.advance(40);
 const worker=all.at(-1);worker.respond(hd(worker.message.observation,{evidence:{strategy:'reset-coach'}}));
 assert.equal(g.window.stLab.obligationContext.state.account.reset.status,'active');assert.equal(g.window.stLab.obligationContext.state.account.z.remaining,0);
 g.window.stLab.act('HD');g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(baseline));assert.deepEqual(copy(g.window.stLab.obligationContext),root);
}));

test('inverse page: repeated Undo and branching replay the same finite private draws across bag boundaries',()=>withPage('st-lab.html',hidden,g=>{
 const source=require('./support/st-resource-trial-1.json'),fixture={id:'inverse-private-draws',label:'Private draws',observation:source.initial,future:source.steps.flatMap(s=>s.revealed)},F=g.window.STFixtures;
 g.window.STFixtures={...F,get:id=>id===fixture.id?copy(fixture):F.get(id)};g.window.stLab.loadFixture(fixture.id);
 const initial=g.snapshot(),current=copy(g.window.stLab.obligationContext),turns=[];let witness=[];
 for(const step of source.steps){witness.push(step.action);g.window.stLab.act(step.action);if(step.action==='HD'){turns.push({witness,position:g.snapshot(),context:copy(g.window.stLab.obligationContext)});witness=[];if(turns.length===12)break;}}
 for(let i=0;i<turns.length;i++)g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(initial));assert.deepEqual(copy(g.window.stLab.obligationContext),current);
 for(const turn of turns){for(const action of turn.witness)g.window.stLab.act(action);assert.deepEqual(semantic(g.snapshot()),semantic(turn.position));assert.deepEqual(copy(g.window.stLab.obligationContext),turn.context);}
 g.window.stLab.act('UNDO');const branch=g.snapshot(),branchContext=copy(g.window.stLab.obligationContext);g.window.stLab.act('HOLD');g.window.stLab.act('HD');g.window.stLab.act('UNDO');
 assert.deepEqual(semantic(g.snapshot()),semantic(branch));assert.deepEqual(copy(g.window.stLab.obligationContext),branchContext);
}));

test('inverse page: failed restored Context import preserves stack, epoch and partial-turn checkpoint',()=>withPage('st-lab.html',hidden,g=>{
 squares(g);const origin=g.snapshot(),originContext=copy(g.window.stLab.obligationContext);square(g,0);
 const first=g.snapshot(),firstContext=copy(g.window.stLab.obligationContext);g.window.stLab.act('HOLD');g.window.stLab.act('L');
 const partial=g.snapshot(),partialContext=copy(g.window.stLab.obligationContext),C=g.window.STObligationContext;
 g.window.STObligationContext={...C,importState(){throw Error('Injected inverse import failure');}};
 assert.throws(()=>g.window.stLab.act('UNDO'),/inverse import failure/);g.window.STObligationContext=C;
 assert.deepEqual(g.snapshot(),partial);assert.deepEqual(copy(g.window.stLab.obligationContext),partialContext);assert.equal(g.element('#st-undo').disabled,false);
 g.window.stLab.act('HD');g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(first));assert.deepEqual(copy(g.window.stLab.obligationContext),firstContext);
 g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(origin));assert.deepEqual(copy(g.window.stLab.obligationContext),originContext);
}));

test('inverse page: wrong actual piece cannot pop a checkpoint and the same receipt remains usable',()=>withPage('st-lab.html',hidden,g=>{
 empty(g);const origin=g.snapshot(),originContext=copy(g.window.stLab.obligationContext);g.window.stLab.act('HD');
 const locked=g.snapshot(),current=copy(g.window.stLab.obligationContext),U=g.window.STObligationInverse;
 g.window.STObligationInverse={...U,undo(session,state,options){return U.undo(session,state,{...options,piece:{...options.piece,id:options.piece.id+1000}});}};
 assert.throws(()=>g.window.stLab.act('UNDO'),/does not match/);assert.deepEqual(g.snapshot(),locked);assert.deepEqual(copy(g.window.stLab.obligationContext),current);
 g.window.STObligationInverse=U;g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(origin));assert.deepEqual(copy(g.window.stLab.obligationContext),originContext);
}));

test('inverse page: observer or routing failure after accepted Context never loses its inverse',()=>withPage('st-lab.html',hidden,g=>{
 for(const stage of ['observer','routing']){
  const T=g.window.STObligationTracking,P=g.window.STPlanContinuity;
  if(stage==='observer')g.window.STObligationTracking={...T,create(){const observer=T.create();return{...observer,transition(){throw Error('Injected observer failure');}};}};
  squares(g);const origin=g.snapshot(),current=copy(g.window.stLab.obligationContext);
  if(stage==='routing')g.window.STPlanContinuity={...P,advance(){throw Error('Injected routing failure');}};
  assert.throws(()=>g.window.stLab.act('HD'),new RegExp(stage+' failure'));
  assert.notDeepEqual(g.snapshot().board,origin.board);assert.notDeepEqual(copy(g.window.stLab.obligationContext.inventory),current.inventory);
  g.window.STObligationTracking=T;g.window.STPlanContinuity=P;
  g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(origin));assert.deepEqual(copy(g.window.stLab.obligationContext),current);
 }
}));

test('inverse page: late callback failure redraws accepted state and removes stale visible advice',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);squares(g);g.advance(40);const worker=all.at(-1),initial=g.snapshot(),planner=g.window.STPlanner;
 const hint={rootId:99,origin:worker.message.observation,target:{cells:[[4,30],[4,31],[5,31],[6,31]]},waiting:[]};
 // Seed both caller-owned transients without asking a planner to find a route.
 g.window.STPlanner={...planner,resourceGoal:()=>true};worker.respond(hd(worker.message.observation,{evidence:{pendingLStage:hint}}));g.window.STPlanner=planner;
 const selected=g.window.stLab.exportSession();assert.ok(selected.coaching.commitment);assert.ok(selected.coaching.pendingLHint);
 assert.equal(g.element('#st-target').children.length,4);assert.equal(g.element('#st-pieces-value').textContent,'0');
 const P=g.window.STPlanContinuity;g.window.STPlanContinuity={...P,advance(){throw Error('Injected after-Context routing failure');}};
 assert.throws(()=>g.window.stLab.act('HD'),/after-Context routing failure/);g.window.STPlanContinuity=P;
 assert.notDeepEqual(g.snapshot().board,initial.board);assert.equal(g.element('#st-target').children.length,0);assert.equal(g.element('#st-pieces-value').textContent,'1');
 assert.equal(g.element('#st-status').dataset.result,'interrupted');assert.match(g.element('#st-status').textContent,/current position/);
 assert.equal(JSON.parse(g.element('#st-diagnostic-text').textContent).revision,g.snapshot().revision);assert.equal(g.element('#st-undo').disabled,false);
 const failed=g.window.stLab.exportSession();assert.equal(failed.coaching.commitment,null);assert.equal(failed.coaching.pendingLHint,null);assert.equal(failed.coaching.previous,null);assert.equal(failed.coaching.planContinuity,null);
 g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(initial));assert.equal(g.element('#st-pieces-value').textContent,'0');
}));

test('inverse page: async Left marker callback faults retain current work and repaint without stale advice',()=>withPage('st-lab.html',{},g=>{
 const f=require('./fixtures/current-left-goal.json'),all=workers(g),T=g.window.STObligationTracking,U=g.window.STObligationInverse;
 for(const stage of ['observer','inverse']){
  let markedReceipt=null;
  g.window.STObligationTracking={...T,create(){const observer=T.create();return{...observer,transition(before,after,operation){if(stage==='observer'&&operation.operation.kind==='accept-left-repair')throw Error('Injected async Left observer failure');return observer.transition(before,after,operation);}};}};
  g.window.STObligationInverse={...U,record(session,options){const result=U.record(session,options);if(options.after.state?.leftGoals.length>options.before.state?.leftGoals.length){markedReceipt=result.receipt;if(stage==='inverse')throw Error('Injected async Left inverse failure');}return result;}};
  g.element('#st-snapshot').value=JSON.stringify(f.observation);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/i);
  const checkpoint=g.snapshot(),checkpointContext=copy(g.window.stLab.obligationContext);
  g.window.stLab.act('R');g.window.stLab.act('L');g.advance(40);const worker=all.at(-1),before=g.snapshot(),beforeContext=copy(g.window.stLab.obligationContext);
  assert.doesNotThrow(()=>worker.respond(copy(f.advice)),'Async marker failure is reported without an unhandled Worker callback error');
  const current=copy(g.window.stLab.obligationContext);assert.equal(current.state.leftGoals.length,1);assert.ok(markedReceipt);assert.equal(markedReceipt.piece,null);
  assert.deepEqual(g.snapshot(),before);assert.deepEqual(current.inventory,beforeContext.inventory);assert.deepEqual(current.boundary,beforeContext.boundary);
  assert.equal(g.window.stLab.result,null);assert.equal(g.element('#st-target').children.length,0);assert.equal(g.element('#st-status').dataset.result,'interrupted');assert.match(g.element('#st-status').textContent,/current position/);
  assert.equal(JSON.parse(g.element('#st-diagnostic-text').textContent).resources.leftGoals.length,1);
  const saved=g.window.stLab.exportSession();assert.equal(saved.coaching.previous,null);assert.equal(saved.coaching.commitment,null);assert.equal(saved.coaching.planContinuity,null);
  if(stage==='inverse'){assert.equal(g.element('#st-undo').disabled,true);assert.match(g.element('#st-game-status').textContent,/Undo is unavailable/);}
  g.window.STObligationTracking=T;g.window.STObligationInverse=U;
  // The first preparatory S leaves the accepted Left defect open. A successful
  // observer receipt still returns to the original pre-input checkpoint; a
  // failed receipt creates the explicitly reported new baseline instead.
  for(const action of f.advice.witness)g.window.stLab.act(action);g.window.stLab.act('UNDO');
  assert.deepEqual(semantic(g.snapshot()),semantic(stage==='observer'?checkpoint:before));
  assert.deepEqual(copy(g.window.stLab.obligationContext),stage==='observer'?checkpointContext:current);
 }
}));

test('inverse page: inverse recording failure preserves installed facts and starts an explicit new Undo boundary',()=>withPage('st-lab.html',hidden,g=>{
 squares(g);square(g,0);const before=g.snapshot(),prior=copy(g.window.stLab.obligationContext),U=g.window.STObligationInverse;
 g.window.STObligationInverse={...U,record(...args){U.record(...args);throw Error('Injected inverse recording failure');}};
 assert.throws(()=>g.window.stLab.act('HD'),/inverse recording failure/);g.window.STObligationInverse=U;
 const accepted=g.snapshot(),current=copy(g.window.stLab.obligationContext);assert.notDeepEqual(accepted.board,before.board);assert.notDeepEqual(current.inventory,prior.inventory);
 assert.equal(g.element('#st-undo').disabled,true);assert.match(g.element('#st-game-status').textContent,/Undo is unavailable/);
 g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot(),accepted);assert.deepEqual(copy(g.window.stLab.obligationContext),current);
 g.window.stLab.act('R');g.window.stLab.act('HD');g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(accepted));assert.deepEqual(copy(g.window.stLab.obligationContext),current);
}));

test('inverse page: 100-entry caller pruning leaves current duties and reachable older receipts intact',()=>withPage('st-lab.html',hidden,g=>{
 squares(g);let retained,retainedContext;const U=g.window.STObligationInverse;let undoCount=0;
 g.window.STObligationInverse={...U,undo(...args){undoCount++;return U.undo(...args);}};
 for(let i=0;i<105;i++){square(g,i);if(i===4){retained=g.snapshot();retainedContext=copy(g.window.stLab.obligationContext);}}
 assert.equal(g.element('#st-pieces-value').textContent,'105');assert.equal(g.snapshot().topOut,false);
 for(let i=0;i<100;i++)g.window.stLab.act('UNDO');assert.equal(undoCount,100);assert.equal(g.element('#st-pieces-value').textContent,'5');assert.equal(g.element('#st-undo').disabled,true);
 assert.deepEqual(semantic(g.snapshot()),semantic(retained));assert.deepEqual(copy(g.window.stLab.obligationContext),retainedContext);
 g.window.stLab.act('UNDO');assert.equal(undoCount,100);square(g,5);g.window.stLab.act('UNDO');assert.deepEqual(copy(g.window.stLab.obligationContext),retainedContext);
}));

test('inverse page: old Worker results after Undo and new branching cannot restore marker or advice',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);empty(g);g.advance(40);const oldest=all.at(-1);g.window.stLab.act('HD');g.advance(40);const stale=all.at(-1);
 const lockedRevision=g.snapshot().revision;g.window.stLab.act('UNDO');const restoredRevision=g.snapshot().revision;assert.ok(restoredRevision>lockedRevision);
 g.window.stLab.act('L');g.window.stLab.act('HD');g.advance(40);const latest=all.at(-1),current=g.snapshot(),context=copy(g.window.stLab.obligationContext),P=g.window.STPlanner;
 g.window.STPlanner={...P,acceptOpeningResult:s=>({...s,active:false})};
 oldest.respond(hd(oldest.message.observation));stale.respond(hd(stale.message.observation));g.window.STPlanner=P;
 assert.deepEqual(g.snapshot(),current);assert.deepEqual(copy(g.window.stLab.obligationContext),context);assert.equal(g.window.stLab.result,null);
 assert.equal(oldest.terminated,true);assert.equal(stale.terminated,true);assert.ok(latest.message.observation.revision>restoredRevision);
 g.window.stLab.act('UNDO');assert.equal(g.window.stLab.obligationContext.state.sl.handoff,false);
}));
