'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),I=require('../st-public-inventory'),C=require('../st-handoff-continuity');
const clone=x=>JSON.parse(JSON.stringify(x));
function setup({mark=true}={}){
 const state=R.createState({board:R.emptyBoard(),active:{type:'I',x:3,y:17,rotation:0,lastRotation:null},queue:['J','L','O','S','T','Z'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOSTZ'],startPhase:0})});
 const inventory=I.start(state,{fresh:true}),execution=C.start(state,inventory);
 return{origin:state,originInventory:inventory,state,inventory,execution:mark?C.markHandoff(execution,state,inventory):execution};
}
function move(q,action,revealed=[]){
 const before=q.state,next=R.move(before,action),after={...next,queue:[...next.queue,...revealed]};
 for(const type of revealed)if(after.bag)after.bag=B.consume(after.bag,type);
 const receipt=I.transition(q.inventory,before,action,after);
 assert.equal(receipt.status,'available');
 q.execution=C.advance(q.execution,before,action,after,receipt);q.inventory=receipt.next;q.state=after;
 return{before,after,receipt};
}
test('handoff continuity: authentic detours and HOLD reveal keep only root/current facts and one final lock',()=>{
 const q=setup();move(q,'L');move(q,'R');move(q,'HOLD',['I']);move(q,'HOLD');move(q,'HOLD');
 assert.equal(C.exportConnected(q.execution),null);move(q,'HD',['J']);
 const value=C.exportConnected(q.execution);assert(value);assert.equal(value.actions,6);assert.equal(value.locked.id,2);assert.equal(value.locked.bag,0);
 assert.equal(C.connected(value,q.origin,q.state,q.originInventory,q.inventory),true);assert.equal(C.matchesEndpoint(value,q.state,q.state.lastEvent),true);
 assert.deepEqual(Object.keys(value).sort(),['actions','current','currentSupply','event','locked','marked','origin','originSupply','schemaVersion'].sort());
 assert.equal(JSON.stringify(value).includes('revealed'),false);assert.equal(JSON.stringify(value).includes('steps'),false);
 assert.equal(C.exportConnected(clone(q.execution)),null,'JSON is not a local receipt capability');
 assert.equal(C.advance(clone(q.execution),q.state,'L',R.move(q.state,'L'),null),null);
});
test('handoff continuity: copied, foreign-identity, skipped and duplicate receipts cannot connect execution',()=>{
 const q=setup(),before=q.state,after=R.move(before,'L'),receipt=I.transition(q.inventory,before,'L',after);
 assert.equal(C.advance(q.execution,before,'L',after,clone(receipt)),null);
 const foreign=I.importState(I.exportState(q.inventory)),other=I.transition(foreign,before,'L',after);
 assert.equal(C.advance(q.execution,before,'L',after,other),null,'Equal identity numbers from a different controller lineage are insufficient');
 const valid=C.advance(q.execution,before,'L',after,receipt);assert(valid);
 assert.equal(C.advance(valid,before,'L',after,receipt),null,'Cannot apply one operation twice');
 const skipped=R.move(after,'R'),skipReceipt=I.transition(q.inventory,after,'R',skipped);
 assert.equal(C.advance(q.execution,after,'R',skipped,skipReceipt),null,'Equal eventual pose cannot replace followed operations');
});
test('handoff continuity: accepted marker must precede inputs and cannot be copied or rebound',()=>{
 const q=setup({mark:false});assert.equal(C.exportConnected(q.execution),null);
 assert.equal(C.markHandoff(clone(q.execution),q.state,q.inventory),null);
 assert.equal(C.markHandoff(q.execution,q.state,I.importState(I.exportState(q.inventory))),null);
 move(q,'L');assert.equal(q.execution,null);
 const good=setup();assert.equal(C.markHandoff(good.execution,good.state,good.inventory),null);
});
test('handoff continuity: scope admits 256 actual inputs but stores no input tape and retires beyond it',()=>{
 const q=setup(),size=JSON.stringify(q.execution).length;
 for(let n=0;n<127;n++){move(q,'L');move(q,'R');}
 move(q,'L');assert.equal(q.execution.actions,255);assert.ok(JSON.stringify(q.execution).length<size+20);
 move(q,'HD',['I']);assert.equal(C.exportConnected(q.execution).actions,256);
 const over=setup();for(let n=0;n<128;n++){move(over,'L');move(over,'R');}move(over,'HD',['I']);assert.equal(over.execution,null);
});
test('handoff continuity: one lock closes the connector, including a second lock or post-lock movement',()=>{
 for(const action of ['L','HD']){const q=setup();move(q,'HD',['I']);assert(C.exportConnected(q.execution));move(q,action,action==='HD'?['J']:[]);assert.equal(q.execution,null);}
});
test('handoff continuity: no-op inputs do not consume scope or create a lock',()=>{
 const q=setup();while(R.move(q.state,'L')!==q.state)move(q,'L');const saved=q.execution;
 move(q,'L');assert.equal(q.execution,saved);assert.equal(C.exportConnected(q.execution),null);
});
test('handoff continuity: transport binds root/current identity, actual pose, bag and event, not a boolean',()=>{
 const q=setup();move(q,'HD',['I']);const value=C.exportConnected(q.execution);
 assert.equal(C.connected({marked:true},q.origin,q.state,q.originInventory,q.inventory),false);
 for(const mutate of [v=>v.origin.active.x++,v=>v.originSupply.active.id++,v=>v.currentSupply.active.id++,v=>v.actions=257,v=>v.locked.bag=null,v=>v.current.revision--]){const bad=clone(value);mutate(bad);assert.equal(C.connected(bad,q.origin,q.state,q.originInventory,q.inventory),false);}
 for(const mutate of [v=>v.current.active.x++,v=>v.current.bag.remaining=[2],v=>v.event.lines++]){const bad=clone(value);mutate(bad);assert.equal(C.matchesEndpoint(bad,q.state,q.state.lastEvent),false);}
});

test('handoff continuity: only current public fields enter the finite connector',()=>{
 const q=setup({mark:false}),raw=clone(q.state);raw.privateFuture=['Z'];raw.active.oldInputs=Array(500).fill('L');raw.bag.oldInputs=Array(500).fill('HOLD');
 const current=C.start(raw,q.inventory);assert(current);assert.equal(current.origin.privateFuture,undefined);assert.equal(current.origin.active.oldInputs,undefined);assert.equal(current.origin.bag.oldInputs,undefined);
 assert.ok(JSON.stringify(current).length<2500);
 for(const change of [{hold:[['S']]},{queue:[['S']]},{active:{...raw.active,type:[['I']]}}]){const malformed={...raw,...change},matching=I.start(malformed);assert.equal(I.bound(matching,malformed),true,'Exercise the connector guard beyond permissive rules validation');assert.equal(C.start(malformed,matching),null);}
 for(const topOut of [{oldInputs:Array(500).fill('L')},Array(500).fill('L')])assert.equal(C.start({...raw,topOut},q.inventory),null);
 for(const key of ['error','observedCount','provenance']){const malformed=clone(raw);malformed.bag[key]=Array(500).fill('L');assert.equal(C.start(malformed,q.inventory),null);}
});

test('handoff continuity: same-letter old HOLD pays the actually swapped subject, not the visible type',()=>{
 const state=R.createState({active:'S',hold:'S',queue:[...'IJLOTZ'],streamCursor:9}),piece=(id,type,bag)=>({id,type,bag,observedOrder:id-1});
 const inventory=I.importState({schemaVersion:1,status:'available',originKnown:true,nextId:9,streamCursor:9,active:piece(1,'S',0),hold:piece(2,'S',1),queue:[...'IJLOTZ'].map((type,n)=>piece(n+3,type,1)),frontier:{bag:2,seenMask:0},knowledge:null});
 assert.equal(inventory.status,'available');const root=C.start(state,inventory),q={origin:state,originInventory:inventory,state,inventory,execution:C.markHandoff(root,state,inventory)};
 move(q,'HOLD');assert.equal(q.state.active.type,'S');assert.equal(q.inventory.active.id,2);assert.equal(q.inventory.hold.id,1);
 move(q,'HD',['I']);const value=C.exportConnected(q.execution);assert.equal(value.locked.id,2);assert.equal(value.locked.bag,1);assert.equal(value.currentSupply.hold.id,1);assert.equal(C.connected(value,state,q.state,inventory,q.inventory),true);
});

test('handoff continuity: authentic identity receipt cannot substitute guessed or stale bag knowledge',()=>{
 for(const action of ['L','HOLD','HD']){
  const q=setup(),before=q.state,next=R.move(before,action),after={...next,queue:action==='L'?next.queue:[...next.queue,'I'],bag:{remaining:[2],observedCount:999,provenance:'forged'}};
  const receipt=I.transition(q.inventory,before,action,after);assert.equal(receipt.status,'available');assert.equal(I.matchesTransition(receipt,q.inventory,before,action,after),true);
  assert.equal(C.advance(q.execution,before,action,after,receipt),null,'The connector must check current bag progression, not merely receipt provenance');
 }
 const q=setup();while(R.move(q.state,'L')!==q.state)move(q,'L');const after={...q.state,bag:{remaining:[2],observedCount:999,provenance:'forged'}},receipt=I.transition(q.inventory,q.state,'L',after);
 assert.equal(receipt.accepted,false);assert.equal(C.advance(q.execution,q.state,'L',after,receipt),null,'A rejected input cannot change bag knowledge');
});
