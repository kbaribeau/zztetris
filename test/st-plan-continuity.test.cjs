'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),B=require('../st-bag'),I=require('../st-public-inventory'),Context=require('../st-obligation-context'),PC=require('../st-plan-continuity'),Legacy=require('../st-resource-legacy'),RH=require('../st-resource-history');
const clone=x=>JSON.parse(JSON.stringify(x));
function setup({steps=[['HOLD','HOLD','HD'],['HD'],['HD']],held=true}={}){
 let state=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOSTZ'],startPhase:0})}),context=Context.start(state,{fresh:true});
 if(held){const before=state;state=R.move(before,'HOLD');context=Context.applyActual(context,{before,action:'HOLD',after:state}).context;}
 const proof={kind:'left-support',origin:clone(state),steps:steps.map(witness=>({witness})),consumed:0,obligationContext:Context.exportState(context)};
 let virtual=state;const continuation=proof.steps.map(step=>{const result=R.replay(virtual,step.witness);assert(result.valid);assert.equal(result.events.length,1);virtual=result.state;return{witness:step.witness.slice(),event:result.events[0]};});
 return{state,inventory:context.inventory,origin:clone(state),proof,continuation,cursor:PC.start(state,context.inventory,proof)};
}
function move(q,action,revealed=[]){
 const before=q.state,next=R.move(before,action),after={...next,queue:[...next.queue,...revealed]};
 for(const type of revealed)if(after.bag)after.bag=B.consume(after.bag,type);
 const receipt=I.transition(q.inventory,before,action,after);assert.equal(receipt.status,'available',receipt.reason);
 q.cursor=PC.advance(q.cursor,before,action,after,receipt);q.inventory=receipt.next;q.state=after;
 if(receipt.accepted&&action==='HD')q.proof={...q.proof,consumed:q.proof.consumed+1};
 return{before,after,receipt};
}
const matches=q=>PC.matches(PC.exportState(q.cursor),q.proof,q.continuation,q.state,q.inventory);

test('plan continuity: same-pose HOLD cycles retain actual order and completed turns retain only locks',()=>{
 const q=setup();assert(q.cursor);const original=clone(q.state);
 move(q,'HOLD');move(q,'HOLD');assert.deepEqual({...q.state,revision:0},{...original,revision:0});
 assert.deepEqual(matches(q),{valid:true,visited:2,actionsSinceLock:['HOLD','HOLD']});
 move(q,'L');move(q,'R');assert.deepEqual(matches(q).actionsSinceLock,['HOLD','HOLD','L','R']);
 move(q,'HD',['I']);assert(matches(q).valid);const value=PC.exportState(q.cursor);
 assert.equal(value.locks.length,1);assert.deepEqual(value.actionsSinceLock,[]);assert.equal(value.actions,5);assert.equal(value.locks[0].locked.id,2);
 assert.deepEqual(Object.keys(value).sort(),['schemaVersion','plan','origin','current','originSupply','currentSupply','locks','actionsSinceLock','actions'].sort());
 assert.deepEqual(value.plan,{kind:'left-support',steps:q.proof.steps});assert.equal(value.currentSupply.queue.length,5);assert.equal(value.originSupply.queue.length,5);
 assert.equal(JSON.stringify(value).includes('revealed'),false);assert.equal(value.plan.rootContext,undefined);assert.equal(value.resourceContext,undefined);
 move(q,'HD',['J']);assert(matches(q).valid);move(q,'HD',['L']);assert.equal(q.cursor,null,'Completing the selected plan retires its cursor');
});

test('plan continuity: authentic detours are accepted but wrong consumed events do not bind the selected route',()=>{
 const q=setup({steps:[['HD'],['HD']]});move(q,'L');move(q,'R');assert(matches(q).valid);
 move(q,'L');move(q,'HD');assert(q.cursor,'Cursor records actual execution without granting route admission');assert.equal(matches(q).valid,false);
});

test('plan continuity: copied, foreign, duplicate and skipped receipts cannot advance local execution',()=>{
 const q=setup(),before=q.state,after=R.move(before,'L'),receipt=I.transition(q.inventory,before,'L',after);
 assert.equal(PC.advance(q.cursor,before,'L',after,clone(receipt)),null);
 const foreign=I.importState(I.exportState(q.inventory)),other=I.transition(foreign,before,'L',after);
 assert.equal(PC.advance(q.cursor,before,'L',after,other),null);
 assert.equal(PC.advance(clone(q.cursor),before,'L',after,receipt),null);assert.equal(PC.exportState(clone(q.cursor)),null);
 const advanced=PC.advance(q.cursor,before,'L',after,receipt);assert(advanced);assert.equal(PC.advance(advanced,before,'L',after,receipt),null);
 const skipped=R.move(after,'R'),skipReceipt=I.transition(q.inventory,after,'R',skipped);assert.equal(PC.advance(q.cursor,after,'R',skipped,skipReceipt),null);
});

test('plan continuity: bag progression comes from actual reveals, never a guessed receipt-adjacent field',()=>{
 for(const action of ['L','HOLD','HD']){
  const q=setup(),before=q.state,next=R.move(before,action),after={...next,bag:{remaining:[2],observedCount:999,provenance:'forged'}},receipt=I.transition(q.inventory,before,action,after);
  assert.equal(receipt.status,'available');assert.equal(PC.advance(q.cursor,before,action,after,receipt),null);
 }
 const q=setup();while(R.move(q.state,'L')!==q.state)move(q,'L');const before=q.state,saved=q.cursor;move(q,'L');assert.equal(q.cursor,saved,'Rejected input leaves scope unchanged');
 const after={...before,bag:{remaining:[2],observedCount:999,provenance:'forged'}},receipt=I.transition(q.inventory,before,'L',after);assert.equal(receipt.accepted,false);assert.equal(PC.advance(q.cursor,before,'L',after,receipt),null);
});

test('plan continuity: original public visibility survives refill and copied proof changes reject',()=>{
 const q=setup({steps:[['HD'],['HD'],['HD']]});move(q,'HD',['I','J']);assert(matches(q).valid);assert.equal(q.state.queue.length,6);
 const value=PC.exportState(q.cursor);assert.equal(value.origin.queue.length,5);assert.equal(value.originSupply.queue.length,5);
 for(const mutate of [p=>p.origin.queue.push('I'),p=>p.origin.hold='Z',p=>p.origin.bag.remaining=[1],p=>p.steps[0].witness.unshift('L','R'),p=>p.kind='left-foundation',p=>p.consumed=0,p=>p.obligationContext.inventory.hold.id=99]){
  const bad=clone(q.proof);mutate(bad);assert.equal(PC.matches(value,bad,q.continuation,q.state,q.inventory).valid,false);
 }
 const missingRoot=clone(q.proof);missingRoot.obligationContext=null;assert.equal(PC.matches(value,missingRoot,q.continuation,q.state,q.inventory).valid,false);
 assert.equal(PC.start(q.state,q.inventory,q.proof),null,'Consumed proof cannot mint a new origin cursor');
});

test('plan continuity: current snapshots restore without ancestry and rebind only the current revision',()=>{
 const q=setup();move(q,'HOLD');move(q,'HOLD');move(q,'HD',['I']);move(q,'L');const payload=PC.exportState(q.cursor),restored={...q.state,revision:q.state.revision+100},inventory=I.importState(I.exportState(q.inventory));
 assert.equal(PC.matches(payload,q.proof,q.continuation,restored,inventory).valid,false,'Worker endpoints still bind the exact current revision');
 const imported=PC.importState(clone(payload),{position:restored,inventory,proof:clone(q.proof)});assert(imported);assert.equal(imported.current.revision,restored.revision);assert.deepEqual(imported.origin,payload.origin);
 assert(PC.matches(PC.exportState(imported),q.proof,q.continuation,restored,inventory).valid);
 const after=R.move(restored,'R'),receipt=I.transition(inventory,restored,'R',after);assert(PC.advance(imported,restored,'R',after,receipt));
 assert.equal(PC.importState(payload,{position:after,inventory,proof:q.proof}),null,'A changed pose is not an Undo revision');
 const changed=clone(payload);changed.currentSupply.active.id++;assert.equal(PC.importState(changed,{position:restored,inventory,proof:q.proof}),null);
});

test('plan continuity: finite scope limits selected execution only and prior turn inputs are discarded',()=>{
 const q=setup({steps:Array(7).fill(null).map(()=>['HD']),held:false});
 for(let turn=0;turn<6;turn++){
  for(let n=0;n<127;n++){move(q,'L');move(q,'R');}move(q,'L');move(q,'HD',turn<5?['IJLOST'[turn]]:[]);
  // The exact route intentionally differs; this test checks only cursor size
  // and actual operation limits, not planner admission or obligations.
  assert(q.cursor);assert.equal(q.cursor.actionsSinceLock.length,0);assert.equal(q.cursor.locks.length,turn+1);assert.equal(q.cursor.actions,(turn+1)*256);
 }
 const value=PC.exportState(q.cursor);assert.equal(value.actions,1536);assert.equal(value.locks.length,6);assert(JSON.stringify(value).length<6500);
 const over=setup();for(let n=0;n<128;n++){move(over,'L');move(over,'R');}assert.equal(over.cursor.actionsSinceLock.length,256);move(over,'L');assert.equal(over.cursor,null);
 const malformed=clone(value);malformed.actions=PC.MAX_ACTIONS+1;assert.equal(PC.importState(malformed,{position:q.state,inventory:q.inventory,proof:q.proof}),null);
});

test('plan continuity: only finite public scalars and selected witnesses enter cursor transport',()=>{
 const q=setup(),raw=clone(q.state),proof=clone(q.proof);raw.privateFuture=Array(500).fill('Z');raw.active.oldInputs=Array(500).fill('L');raw.bag.oldInputs=Array(500).fill('HOLD');proof.history=Array(500).fill('HOLD');proof.steps[0].oldInputs=Array(500).fill('R');
 const cursor=PC.start(raw,q.inventory,proof);assert(cursor);const payload=PC.exportState(cursor);assert.equal(payload.origin.privateFuture,undefined);assert.equal(payload.origin.active.oldInputs,undefined);assert.equal(payload.origin.bag.oldInputs,undefined);assert.equal(payload.plan.steps[0].oldInputs,undefined);
 for(const mutate of [p=>p.oldInputs=Array(500).fill('L'),p=>p.current.active.oldInputs=['L'],p=>p.origin.bag.oldInputs=['L'],p=>p.originSupply.active.oldInputs=['L'],p=>p.plan.steps[0].oldInputs=['L'],p=>p.actionsSinceLock=[['HOLD']],p=>p.actionsSinceLock=['HD'],p=>p.plan.kind={history:['L']}]){
  const bad=clone(payload);mutate(bad);assert.equal(PC.importState(bad,{position:q.state,inventory:q.inventory,proof:q.proof}),null);
 }
 for(const change of [{hold:[['I']]},{queue:[['S']]},{active:{...raw.active,type:[['J']]}},{topOut:{history:['HD']}}])assert.equal(PC.start({...raw,...change},q.inventory,proof),null);
 for(const key of ['error','observedCount','provenance']){const bad=clone(raw);bad.bag[key]=Array(500).fill('L');assert.equal(PC.start(bad,q.inventory,proof),null);}
});

test('plan continuity: same-letter HOLD records the actual subject and rejects namespace substitutions',()=>{
 const state=R.createState({active:'S',hold:'S',queue:[...'IJLOTZ'],streamCursor:9}),piece=(id,type,bag)=>({id,type,bag,observedOrder:id-1}),inventory=I.importState({schemaVersion:1,status:'available',originKnown:true,nextId:9,streamCursor:9,active:piece(1,'S',0),hold:piece(2,'S',1),queue:[...'IJLOTZ'].map((type,n)=>piece(n+3,type,1)),frontier:{bag:2,seenMask:0},knowledge:null});
 const proof={kind:'left-support',origin:state,steps:[{witness:['HOLD','HD']},{witness:['HD']}],consumed:0},first=R.replay(state,proof.steps[0].witness),continuation=[{event:first.events[0]},{event:R.replay(first.state,['HD']).events[0]}],q={state,inventory,proof,continuation,cursor:PC.start(state,inventory,proof)};
 move(q,'HOLD');move(q,'HD',['I']);assert(matches(q).valid);const payload=PC.exportState(q.cursor);assert.equal(payload.locks[0].locked.id,2);assert.equal(payload.locks[0].locked.bag,1);assert.equal(payload.currentSupply.hold.id,1);
 const bad=clone(payload);bad.locks[0].locked.id=1;assert.equal(PC.importState(bad,{position:q.state,inventory:q.inventory,proof:q.proof}),null);
});

test('plan continuity: legacy compatibility converts actual finite order once and preserves original refills',()=>{
 const fixture=require('./fixtures/left-scoring-foundation.json'),proof={kind:'left-scoring-foundation',origin:clone(fixture.observation),steps:clone(fixture.steps),consumed:0,resourceContext:clone(fixture.options.resourceContext)};proof.steps[0].witness.unshift('HOLD','HOLD');
 let state=clone(fixture.observation),history=RH.importContext(state,proof.resourceContext);const continuation=[];let virtual=state;
 for(const step of proof.steps){const replay=R.replay(virtual,step.witness);assert(replay.valid);continuation.push({event:replay.events[0]});virtual=replay.state;}
 for(const action of proof.steps[0].witness){const before=state;state=R.move(state,action);if(action==='HD')state={...state,queue:[...state.queue,'O'],bag:B.consume(state.bag,'O')};history=RH.applyAction(history,before,action,state);}
 proof.consumed=1;const current=RH.exportContext(state,history),converted=Legacy.planContinuity(state,current,proof);assert.equal(converted.status,'available',converted.reason);assert.equal(converted.proof.resourceContext,undefined);assert(converted.proof.obligationContext);
 assert.equal(converted.planContinuity.actions,proof.steps[0].witness.length);assert.equal(converted.planContinuity.locks.length,1);assert.equal(converted.planContinuity.origin.queue.length,6);assert.equal(converted.planContinuity.originSupply.queue.length,6);
 const inventory=Context.importState(Legacy.convert(state,current).context,{position:state}).inventory;
 assert(PC.matches(converted.planContinuity,converted.proof,continuation,state,inventory).valid);
 const disconnected=clone(current);disconnected.steps[0].action='R';assert.equal(Legacy.planContinuity(state,disconnected,proof).status,'unavailable');
 const bad=clone(proof);bad.origin.queue[0]='O';assert.equal(Legacy.planContinuity(state,current,bad).status,'unavailable');
 const moved=R.move(state,'L'),tape=clone(current);tape.steps.push({action:'L',revealed:[]});const detour=Legacy.planContinuity(moved,tape,proof);assert.equal(detour.status,'available',detour.reason);assert.deepEqual(detour.planContinuity.actionsSinceLock,['L']);
});

test('plan continuity: classic script export matches the CommonJS transport contract',()=>{
 const scope={STRules:R,STPublicInventory:I,STBag:B,STObligationContext:Context};vm.runInNewContext(fs.readFileSync(require.resolve('../st-plan-continuity'),'utf8'),scope);
 const q=setup(),cursor=scope.STPlanContinuity.start(q.state,q.inventory,q.proof);assert(cursor);assert.deepEqual(clone(scope.STPlanContinuity.exportState(cursor)),PC.exportState(q.cursor));assert(scope.STPlanContinuity.matches(scope.STPlanContinuity.exportState(cursor),q.proof,q.continuation,q.state,q.inventory).valid);
});

test('plan continuity: known Left support converts old history without retaining the old action prefix',()=>{
 const fixture=require('./fixtures/left-support-visible-I.json'),root=fixture.finite,proof={kind:'left-support',origin:clone(root.observation),steps:clone(fixture.steps),consumed:0,resourceContext:clone(root.options.resourceContext)};
 const converted=Legacy.planContinuity(root.observation,root.options.resourceContext,proof);assert.equal(converted.status,'available',converted.reason);assert.equal(converted.proof.obligationContext.state.availability,'known');assert.equal(converted.planContinuity.actions,0);assert.equal(converted.planContinuity.originSupply.active.type,'I');assert.notEqual(converted.planContinuity.originSupply.active.bag,null);
 assert.equal(converted.planContinuity.origin.queue.length,5);assert.equal(converted.proof.resourceContext,undefined);assert(!JSON.stringify(converted.planContinuity).includes('revealed'));
 let state=clone(root.observation),history=RH.importContext(state,root.options.resourceContext);const continuation=[];let virtual=state;
 for(const step of proof.steps){const replay=R.replay(virtual,step.witness);assert(replay.valid);continuation.push({event:replay.events[0]});virtual=replay.state;}
 for(const action of proof.steps[0].witness){const before=state;state=R.move(state,action);if(action==='HD')state={...state,queue:[...state.queue,'O'],bag:B.consume(state.bag,'O')};history=RH.applyAction(history,before,action,state);}
 proof.consumed=1;const current=RH.exportContext(state,history),retained=Legacy.planContinuity(state,current,proof);assert.equal(retained.status,'available',retained.reason);assert.equal(retained.planContinuity.origin.queue.length,5);assert.equal(retained.planContinuity.actions,proof.steps[0].witness.length);
 assert(PC.matches(retained.planContinuity,retained.proof,continuation,state,Legacy.convert(state,current).context.inventory).valid);
 const copied=clone(retained.proof);copied.origin.queue.push('O');assert.equal(PC.matches(retained.planContinuity,copied,continuation,state,Legacy.convert(state,current).context.inventory).valid,false);
});
