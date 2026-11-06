'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),I=require('../st-public-inventory'),H=require('../st-resource-history');
const clone=x=>JSON.parse(JSON.stringify(x));
const live=h=>[h.active,h.hold,...h.queue].filter(Boolean);
function run(initial,{fresh=false}={}){
 let state=R.createState(initial),inventory=I.start(state,{fresh});
 function act(action,revealed=[]){const before=state,expected=R.move(state,action);state={...expected,queue:[...expected.queue,...revealed]};inventory=I.applyAction(inventory,before,action,state);assert.equal(inventory.status,'available',inventory.reason);return inventory;}
 return{act,get state(){return state;},get inventory(){return inventory;}};
}
const first=()=>R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1});
test('public inventory: fresh origin assigns literal identities and a bounded next-bag frontier',()=>{
 const state=first(),h=I.start(state,{fresh:true});
 assert.deepEqual(live(h).map(p=>[p.id,p.type,p.bag,p.observedOrder]),[[1,'I',0,0],[2,'J',0,1],[3,'L',0,2],[4,'O',0,3],[5,'S',0,4],[6,'T',0,5],[7,'Z',0,6]]);
 assert.deepEqual(h.frontier,{bag:1,seenMask:0});assert.deepEqual(I.remainingTypes(h),[...'IJLOSTZ']);assert.deepEqual(h.knowledge,{remaining:[0],observedCount:7,provenance:'known-phase'});
 assert.equal(Object.isFrozen(h),true);assert.equal(Object.isFrozen(h.queue[0]),true);assert.equal(Object.isFrozen(h.knowledge.remaining),true);
 assert.equal('board' in h,false);assert.equal('observation' in h,false);assert.equal('pieces' in h,false);
});
test('public inventory: unlimited HOLD preserves original subjects and original bags across new bags',()=>{
 const f=require('./support/st-shadow-cross-bag.json'),r=run(f.initial,{fresh:true});let locks=0;
 for(const step of f.steps){r.act(step.action,step.revealed);if(step.action==='HD'&&++locks===7)break;}
 assert.equal(r.inventory.hold.id,7);assert.equal(r.inventory.hold.bag,0);assert.equal(r.inventory.active.bag,1);
 const old=r.inventory,held=old.hold,active=old.active,knowledge=old.knowledge;
 r.act('HOLD');assert.equal(r.inventory.active,held);assert.equal(r.inventory.hold,active);
 for(let i=0;i<51;i++)r.act('HOLD');assert.equal(r.inventory.hold,held);assert.equal(r.inventory.active,active);assert.equal(r.inventory.knowledge,knowledge);
 assert.equal(r.inventory.nextId,old.nextId);assert.deepEqual(r.inventory.frontier,old.frontier);
});
test('public inventory: deferred and forced public supply gets an identity only on reveal',()=>{
 const bag=B.fromObserved({observed:[...'IJLOST'],startPhase:0});assert.equal(B.forcedNext(bag),'Z');
 const r=run({active:'I',queue:[...'JLOST'],streamCursor:1,bag});
 assert.equal(r.inventory.originKnown,false);assert.equal(r.inventory.frontier,null);assert.equal(r.inventory.knowledge.remaining[0],64);assert.ok(!live(r.inventory).some(p=>p.type==='Z'));
 const before=r.inventory;r.act('HOLD',['Z']);assert.deepEqual(r.inventory.queue.at(-1),{id:7,type:'Z',bag:null,observedOrder:null});assert.deepEqual(r.inventory.knowledge,{remaining:[0],observedCount:7,provenance:'known-phase'});
 assert.equal(before.nextId,7);assert.equal(before.queue.length,5);assert.ok(live(r.inventory).every(p=>p.bag===null),'Known next type does not fabricate an original bag or prior allocation');
 const finite=run({active:'I',queue:[],bag});finite.act('HD');assert.equal(finite.inventory.active,null);assert.equal(finite.inventory.nextId,2);assert.equal(B.forcedNext(finite.inventory.knowledge),'Z','Forced knowledge alone cannot create a private-practice draw');
});
test('public inventory: incremental fresh frontier rejects repeated type after the earlier identity was consumed',()=>{
 const r=run(first(),{fresh:true});r.act('HOLD',['I']);
 const before=r.state,inventory=r.inventory,after=R.move(before,'HD');
 const invalid=I.applyAction(inventory,before,'HD',{...after,queue:[...after.queue,'I']});
 assert.equal(invalid.status,'invalid');assert.match(invalid.reason,/seven-bag/);assert.equal(inventory.nextId,9);assert.deepEqual(inventory.frontier,{bag:1,seenMask:1});
});
test('public inventory: unknown-origin HOLD age stays unknown even for seven distinct visible types',()=>{
 const r=run({...first(),hold:'S',streamCursor:2000},{fresh:true});
 assert.equal(r.inventory.originKnown,false);assert.deepEqual(r.inventory.hold,{id:2,type:'S',bag:null,observedOrder:null});assert.ok(live(r.inventory).every(p=>p.bag===null&&p.observedOrder===null));
 r.act('HOLD');assert.equal(r.inventory.active.id,2);assert.equal(r.inventory.hold.id,1);assert.equal(I.remainingTypes(r.inventory),null);
});
test('public inventory: mismatched actions, draws, locks, stale supplies and rejected-input reveals fail atomically',()=>{
 const state=first(),h=I.start(state,{fresh:true}),next=R.move(state,'R'),locked=R.move(state,'HD');
 for(const result of [I.applyAction(h,state,'L',next),I.applyAction(h,state,'HD',{...locked,lastEvent:{...locked.lastEvent,lines:4}}),I.applyAction(h,state,'R',{...next,queue:[...'JLOSTI']}),I.applyAction(h,{...state,hold:'O'},'HOLD',R.move({...state,hold:'O'},'HOLD')),I.applyAction(h,state,'NOPE',state)])assert.equal(result.status,'invalid');
 const stopped=run({active:'O',queue:[]});for(let n=0;n<8;n++)stopped.act('L');
 const old=stopped.inventory,s=stopped.state;assert.equal(R.move(s,'L'),s);assert.equal(I.applyAction(old,s,'L',s),old);assert.equal(I.applyAction(old,s,'L',{...s,queue:['I']}).status,'invalid');
 assert.deepEqual(h.queue.map(p=>p.id),[2,3,4,5,6,7]);assert.equal(I.applyAction(clone(h),state,'R',next).status,'invalid','Portable facts require explicit import, not an unvalidated object');
});
test('public inventory: current snapshots import directly without provenance replay and discard unrelated history',()=>{
 const r=run(first(),{fresh:true});r.act('HOLD',['S']);r.act('R');
 const exported=I.exportState(r.inventory),copy={...clone(exported),oldPieces:Array(50).fill('not current'),actionTape:['HD']},restored=I.importState(copy);
 assert.deepEqual(restored,r.inventory);assert.equal(I.bound(restored,r.state),true);assert.equal('oldPieces' in restored,false);assert.equal('actionTape' in restored,false);
 exported.queue[0].id=1000;assert.notEqual(r.inventory.queue[0].id,1000);
 const after=R.move(r.state,'HOLD');assert.deepEqual(I.applyAction(restored,r.state,'HOLD',after),I.applyAction(r.inventory,r.state,'HOLD',after));
 for(const edit of [x=>x.queue.push(...x.queue),x=>x.active.id=x.hold.id,x=>x.nextId=1,x=>x.frontier.seenMask=127,x=>x.knowledge.remaining=Array(129).fill(1),x=>x.knowledge.error={past:Array(500).fill('old')},x=>x.queue[0].type='no']){const broken=clone(restored);edit(broken);assert.equal(I.importState(broken).status,'invalid');}
});
test('public inventory: caller-owned Undo snapshots restore exact flow and support independent new branches',()=>{
 const state=first(),h=I.start(state,{fresh:true}),held=R.move(state,'HOLD'),next={...held,queue:[...held.queue,'S']},forward=I.applyAction(h,state,'HOLD',next);
 const undo=I.importState(I.exportState(h));assert.deepEqual(undo,h);
 const branchState=R.move(state,'HD'),branch=I.applyAction(undo,state,'HD',{...branchState,queue:[...branchState.queue,'L']});
 assert.equal(branch.hold,null);assert.equal(branch.queue.at(-1).type,'L');assert.equal(branch.queue.at(-1).id,8);assert.equal(forward.hold.id,1);assert.equal(forward.queue.at(-1).type,'S');
 assert.deepEqual(h,I.start(state,{fresh:true}));
});
test('public inventory: long equivalent play keeps only current identities and no duration-sized collection',()=>{
 const r=run({active:'O',queue:Array(6).fill('O')});const origin=r.inventory;
 for(let i=0;i<4200;i++)r.act(i%2?'R':'L');assert.equal(r.inventory,origin,'Movement carries no inventory history or movement count');
 const shape=h=>JSON.stringify(h,(key,value)=>['id','nextId','streamCursor','observedOrder','bag'].includes(key)&&typeof value==='number'?0:value);
 const initialShape=shape(origin),sizes=[];
 for(let lock=0;lock<700;lock++){
  for(let i=0;i<4;i++)r.act('L');for(let i=0;i<(lock%5)*2;i++)r.act('R');r.act('HD',['O']);
  assert.equal(live(r.inventory).length,7);assert.equal(r.inventory.queue.length,6);
  if(lock%5===4)sizes.push(shape(r.inventory).length);
 }
 assert.equal(r.state.topOut,false);assert.equal(shape(r.inventory),initialShape);assert.ok(sizes.every(n=>n===initialShape.length));assert.equal(r.inventory.nextId,708);
});
test('public inventory: legacy allocation history consumes adapter subjects without changing public summaries',()=>{
 const f=require('./support/st-resource-trial-1.json');let state=R.createState(f.initial),history=H.start(state,{fresh:true});
 for(const step of f.steps){const before=state,expected=R.move(before,step.action);state={...expected,queue:[...expected.queue,...step.revealed]};history=H.applyAction(history,before,step.action,state);assert.equal(history.coverage.status,'complete');
  const current=history.inventory,summary=H.resolve(state,history);assert.equal(current.active?.id??null,summary.instances.active?.id??null);assert.equal(current.hold?.id??null,summary.instances.hold?.id??null);assert.deepEqual(current.queue.map(p=>p.id),summary.instances.queue.map(p=>p.id));assert.deepEqual(summary.publicBag.remainingTypes,I.remainingTypes(current));
 }
 assert.ok(Object.keys(history.pieces).length>live(history.inventory).length,'Unmigrated obligations retain their separate legacy historical source');
 const marked=H.markHandoff(history,state);assert.equal(marked.inventory,history.inventory);assert.equal(I.bound(marked.inventory,state),true);
});

test('public inventory: one-operation bundle carries exact lock and reveal subjects without retaining a state chain',()=>{
 const before=first(),current=I.start(before,{fresh:true}),raw=R.move(before,'HD'),after={...raw,queue:[...raw.queue,'S']};
 const operation=I.transition(current,before,'HD',after);
 assert.equal(operation.prior,current);assert.equal(operation.locked,current.active);assert.equal(operation.accepted,true);assert.equal(operation.next.active,current.queue[0]);assert.equal(operation.revealed.length,1);assert.equal(operation.revealed[0],operation.next.queue.at(-1));assert.deepEqual(operation.revealed[0],{id:8,type:'S',observedOrder:7,bag:1});
 assert.equal(I.matchesTransition(operation,current,before,'HD',after),true);assert.equal(Object.isFrozen(operation),true);assert.equal(Object.isFrozen(operation.revealed),true);assert.equal('prior' in operation.next,false);assert.equal('operation' in operation.next,false);
 const h=H.start(before,{fresh:true,inventory:current}),updated=H.applyAction(h,before,'HD',after,{inventoryTransition:operation});
 assert.equal(updated.inventory,operation.next,'Supplied identity flow is consumed directly, not independently advanced again');assert.equal(updated.allocations[0].pieceId,operation.locked.id);assert.equal(updated.pieces[8].type,'S');
});
test('public inventory: receipts bind the exact current snapshot, accepted input and public revision boundary',()=>{
 const before=first(),current=I.start(before,{fresh:true}),after=R.move(before,'R'),op=I.transition(current,before,'R',after);
 assert.equal(op.next,current,'Movement does not replace the inventory');assert.equal(op.locked,null);assert.deepEqual(op.revealed,[]);
 for(const [candidate,inventory,a,action,b] of [[clone(op),current,before,'R',after],[op,I.importState(I.exportState(current)),before,'R',after],[op,current,before,'L',after],[op,current,{...before,revision:5},'R',{...after,revision:6}],[op,current,before,'R',{...after,bag:{remaining:[0],observedCount:7,provenance:'known-phase'}}]])assert.equal(I.matchesTransition(candidate,inventory,a,action,b),false);
 const h=H.start(before,{fresh:true,inventory:current});assert.equal(H.applyAction(h,{...before,revision:5},'R',{...after,revision:6},{inventoryTransition:op}).coverage.status,'invalid');
 const accepted=H.applyAction(h,before,'R',after,{inventoryTransition:op});assert.equal(accepted.coverage.status,'complete');
 const left=R.move(after,'L'),back=I.transition(current,after,'L',left),returned=H.applyAction(accepted,after,'L',left,{inventoryTransition:back});
 assert.equal(returned.inventory,current);assert.equal(H.applyAction(returned,left,'R',R.move(left,'R'),{inventoryTransition:op}).coverage.status,'invalid','Returning to the same pose cannot reuse an older operation');
 const restored=I.importState(I.exportState(current)),restoredOperation=I.transition(restored,before,'R',after);assert.equal(restoredOperation.status,'available','Trusted snapshot import needs no prior operation capability');
});
test('public inventory: rejected inputs produce no lock/reveal effect and stale accounting never changes actual gameplay',()=>{
 const before=R.createState({active:'O',queue:[]}),atWall={...before,active:{...before.active,x:-1}},current=I.start(atWall),noop=I.transition(current,atWall,'L',atWall);
 assert.equal(noop.accepted,false);assert.equal(noop.next,current);assert.equal(noop.locked,null);assert.deepEqual(noop.revealed,[]);
 const state=first(),inventory=I.start(state,{fresh:true}),h=H.start(state,{fresh:true,inventory}),locked=R.move(state,'HD'),after={...locked,queue:[...locked.queue,'S']},actual=clone(after),operation=I.transition(inventory,state,'HD',after);
 const bad=H.applyAction(h,state,'HD',after,{inventoryTransition:noop});assert.equal(bad.coverage.status,'invalid');assert.deepEqual(after,actual);assert.equal(operation.next.active.id,2);
 const next=R.move(after,'HOLD'),following=I.transition(operation.next,after,'HOLD',{...next,queue:[...next.queue,'L']});assert.equal(following.status,'available');assert.equal(following.next.hold.id,2);assert.equal(following.next.active.id,3);
});
test('public inventory: legacy partial-origin replay restores current forced-public knowledge without inventing prior bag identities',()=>{
 const bag=B.fromObserved({observed:[...'IJLOST'],startPhase:0}),state=R.createState({active:'I',hold:'O',queue:[...'JLOST'],streamCursor:100,bag}),h=H.start(state),context=clone(H.exportContext(state,h));
 const imported=H.importContext(state,context);assert.equal(imported.coverage.status,'partial');assert.deepEqual(imported.inventory.knowledge,bag);assert.equal(B.forcedNext(imported.inventory.knowledge),'Z');assert.ok(live(imported.inventory).every(p=>p.bag===null&&p.observedOrder===null));
 assert.deepEqual(H.resolve(state,imported),H.resolve(state,h));
 const raw=R.move(state,'HOLD'),next={...raw,queue:raw.queue.slice()},operation=I.transition(imported.inventory,state,'HOLD',next);assert.equal(operation.status,'available');assert.deepEqual(operation.next.knowledge,bag);assert.equal(H.applyAction(imported,state,'HOLD',next,{inventoryTransition:operation}).coverage.status,'partial');
 const heldHistory=H.applyAction(imported,state,'HOLD',next,{inventoryTransition:operation}),lock=R.move(next,'HD'),revealed={...lock,queue:[...lock.queue,'Z'],bag:B.consume(bag,'Z')},reveal=I.transition(operation.next,next,'HD',revealed),advanced=H.applyAction(heldHistory,next,'HD',revealed,{inventoryTransition:reveal});
 assert.equal(advanced.coverage.status,'partial');assert.equal(reveal.revealed[0].type,'Z');assert.equal(reveal.revealed[0].bag,null);assert.deepEqual(advanced.inventory.knowledge,B.consume(bag,'Z'));
 const other={...state,bag:B.fromObserved({observed:[...'IJLOSZ'],startPhase:0})};assert.equal(B.forcedNext(H.importContext(other,context).inventory.knowledge),'T','A cached legacy context cannot hide changed current bag facts');
});
test('public inventory: partial-origin import cache clears deliberately absent current bag knowledge',()=>{
 const state=R.createState({active:'I',hold:'O',queue:[...'JLOST'],streamCursor:100,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}),original=H.start(state),local=H.exportContext(state,original);
 const absent={...state};delete absent.bag;
 for(const context of [local,clone(local)])for(const raw of [absent,{...absent,bag:null}]){
  const known=H.importContext(state,context);assert.equal(B.forcedNext(known.inventory.knowledge),'Z');
  const cleared=H.importContext(raw,context);assert.equal(cleared.inventory.knowledge,null,'Current absence must override earlier cached partial-origin knowledge');assert.deepEqual(live(cleared.inventory),live(known.inventory));assert.deepEqual(H.resolve(raw,cleared),H.resolve(state,known));assert.deepEqual(H.exportContext(raw,cleared),local);
  assert.deepEqual(H.importContext(state,context).inventory.knowledge,state.bag,'Later explicitly supplied knowledge can be restored without changing subjects');
 }
 const fresh=first(),freshHistory=H.start(fresh,{fresh:true}),freshContext=clone(H.exportContext(fresh,freshHistory));
 assert.deepEqual(H.importContext(fresh,freshContext).inventory.knowledge,freshHistory.inventory.knowledge,'Known fresh origin keeps its independently observed seven-bag frontier');
});
