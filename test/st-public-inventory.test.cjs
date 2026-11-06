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
