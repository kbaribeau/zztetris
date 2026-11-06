'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),B=require('../st-bag');
const clone=x=>JSON.parse(JSON.stringify(x));
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};return all;}
function chooseEmpty(g){g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
test('public inventory/page: reveal frontier is incremental through actual HOLD, locks, Undo, replay and restart',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g),f=require('./support/st-undo-opening.json'),randomValues=[];
 for(const desired of f.bags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);assert.ok(j<=i);randomValues.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>{assert.ok(randomValues.length);return randomValues.shift();};
 const native=g.window.STBag,initializations=[];
 g.window.STBag={...native,fromObserved:options=>{initializations.push(options.observed.length);assert.ok(options.observed.length<=7,'Live play must not rederive knowledge from an ever-growing observed stream');return native.fromObserved(options);}};
 chooseEmpty(g);const initial=g.snapshot(),initialCount=initializations.length;let observed=[initial.active.type,...initial.queue],checkpoints=[];
 for(const witness of f.witnesses){
  checkpoints.push({state:g.snapshot(),observed:observed.slice()});
  for(const action of witness){const before=g.snapshot();g.window.stLab.act(action);const after=g.snapshot(),drawn=after.streamCursor-before.streamCursor,revealed=after.queue.slice(before.queue.length-drawn);observed.push(...revealed);assert.deepEqual(after.bag,B.fromObserved({observed,startPhase:0}));}
 }
 assert.equal(initializations.length,initialCount,'No reset/import occurred, so no initial history should be consulted again');
 const final=g.snapshot();assert.ok(final.bag.observedCount>21);
 g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot().bag,checkpoints.at(-1).state.bag);
 for(const action of f.witnesses.at(-1))g.window.stLab.act(action);assert.deepEqual(g.snapshot().bag,final.bag);
 for(let i=0;i<f.witnesses.length;i++)g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot().bag,initial.bag);
 g.window.stLab.act('HOLD');const held=g.snapshot();assert.deepEqual(held.bag,B.consume(initial.bag,held.queue.at(-1)));
 for(let i=0;i<12;i++)g.window.stLab.act('HOLD');assert.deepEqual(g.snapshot().bag,held.bag,'An occupied HOLD swaps existing identities without observing a draw');
 g.advance(40);const request=all.at(-1).message;assert.deepEqual(request.observation.bag,g.snapshot().bag);assert.equal(request.observation.queue.length,6);assert.equal('observed' in request.observation,false);assert.equal('future' in request.observation,false);
 g.click('#st-reset');assert.deepEqual(g.snapshot().bag,initial.bag);assert.ok(initializations.length>initialCount);
}));

test('public inventory/page: controller owns one transition per input and restores it with Undo and session import',()=>withPage('st-lab.html',{},g=>{
 workers(g);const I=g.window.STPublicInventory,H=g.window.STResourceHistory,operations=[];let current=null,advances=0;
 g.window.STPublicInventory={...I,transition(...args){advances++;return I.transition(...args);}};
 g.window.STResourceHistory={...H,start(raw,options){assert.ok(options.inventory);current=options.inventory;return H.start(raw,options);},applyAction(history,before,action,after,options){const op=options.inventoryTransition;assert.ok(I.matchesTransition(op,current,before,action,after));operations.push(op);current=op.next;const next=H.applyAction(history,before,action,after,options);assert.equal(next.inventory,current);return next;}};
 chooseEmpty(g);const original=clone(g.window.stLab.publicInventory);
 for(const action of ['HOLD','HOLD','R','L','HD'])g.window.stLab.act(action);
 assert.equal(advances,5);assert.equal(operations.length,5);assert.equal(operations.filter(op=>op.locked).length,1);assert.equal(operations.flatMap(op=>op.revealed).length,2);assert.deepEqual(clone(g.window.stLab.publicInventory),clone(current));
 const savedSession=g.window.stLab.exportSession(),after=clone(g.window.stLab.publicInventory);
 g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.publicInventory),original);assert.equal(advances,5,'Undo restores caller snapshot instead of replaying identity flow');
 g.window.STResourceHistory=H;g.element('#st-snapshot').value=JSON.stringify(savedSession);g.click('#st-import');assert.deepEqual(clone(g.window.stLab.publicInventory),after);
 g.window.stLab.act('HOLD');assert.equal(advances,6);assert.equal(g.window.stLab.publicInventory.active.id,after.hold.id);
 g.click('#st-reset');assert.deepEqual(clone(g.window.stLab.publicInventory),after,'Imported session remains the restart origin');
}));
test('public inventory/page: stale accounting transition cannot reverse a lock or stop independent current inventory',()=>withPage('st-lab.html',{},g=>{
 workers(g);chooseEmpty(g);const H=g.window.STResourceHistory,first=clone(g.window.stLab.publicInventory),before=g.snapshot();
 g.window.STResourceHistory={...H,applyAction(history,a,action,b){return H.applyAction(history,a,action,b,{inventoryTransition:{}});}};
 g.window.stLab.act('HD');const locked=g.snapshot(),after=clone(g.window.stLab.publicInventory);assert.notDeepEqual(locked.board,before.board);assert.equal(after.active.id,first.queue[0].id);assert.equal(after.nextId,first.nextId+1);assert.equal(g.window.stLab.resources.coverage.status,'invalid');
 g.window.stLab.act('HOLD');assert.equal(g.window.stLab.publicInventory.hold.id,after.active.id);assert.equal(g.window.stLab.publicInventory.active.id,after.queue[0].id);
 g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.publicInventory),first);assert.deepEqual(g.snapshot().board,before.board);assert.equal(g.window.stLab.resources.coverage.status,'complete');
}));
test('public inventory/page: current identities continue after legacy action coverage truncates',()=>withPage('st-lab.html',{},g=>{
 workers(g);chooseEmpty(g);const first=clone(g.window.stLab.publicInventory);
 for(let i=0;i<4100;i++)g.window.stLab.act(i%2?'CCW':'CW');assert.equal(g.window.stLab.resources.coverage.status,'truncated');assert.deepEqual(clone(g.window.stLab.publicInventory),first);
 g.window.stLab.act('HD');assert.equal(g.window.stLab.publicInventory.active.id,first.queue[0].id);assert.equal(g.window.stLab.publicInventory.nextId,first.nextId+1);
 g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.publicInventory),first);assert.equal(g.window.stLab.resources.coverage.status,'complete');
}));
test('public inventory/page: repeated IDs after Undo do not authorize a prior-branch receipt',()=>withPage('st-lab.html',{},g=>{
 workers(g);chooseEmpty(g);const H=g.window.STResourceHistory,I=g.window.STPublicInventory;let first=null,useStale=false;
 g.window.STResourceHistory={...H,applyAction(history,before,action,after,options){const current=options.inventoryTransition;if(!first)first=current;if(useStale){assert.equal(current.locked.id,first.locked.id);assert.equal(I.matchesTransition(first,current.prior,before,action,after),false);return H.applyAction(history,before,action,after,{inventoryTransition:first});}return H.applyAction(history,before,action,after,options);}};
 g.window.stLab.act('HD');const original=clone(g.window.stLab.publicInventory);g.window.stLab.act('UNDO');useStale=true;g.window.stLab.act('HD');
 assert.deepEqual(clone(g.window.stLab.publicInventory),original);assert.equal(g.window.stLab.resources.coverage.status,'invalid');
}));
test('public inventory/page: live HOLD and draws survive legacy lock cap, and Undo restores compact current subjects',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 const R=require('../st-rules'),fixture={id:'inventory-squares',label:'Squares',observation:R.createState({active:'O',queue:Array(6).fill('O')}),future:Array(530).fill('O')},original=g.window.STFixtures;
 g.window.STFixtures={...original,get:id=>id===fixture.id?fixture:original.get(id)};g.window.stLab.loadFixture(fixture.id);
 let boundary;
 for(let i=0;i<515;i++){const dx=(i%5)*2-4;for(let n=0;n<Math.abs(dx);n++)g.window.stLab.act(dx<0?'L':'R');g.window.stLab.act('HD');if(i===513)boundary=clone(g.window.stLab.publicInventory);}
 assert.equal(g.snapshot().topOut,false);assert.equal(g.window.stLab.resources.coverage.status,'truncated');const before=clone(g.window.stLab.publicInventory);assert.equal(before.nextId,523);assert.equal(before.originKnown,false);assert.equal(before.queue.length,6);
 g.window.stLab.act('HOLD');g.window.stLab.act('HD');assert.equal(g.window.stLab.publicInventory.hold.id,before.active.id);assert.equal(g.window.stLab.publicInventory.nextId,before.nextId+2);
 g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.publicInventory),before);g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.publicInventory),boundary);
}));
test('public inventory/page: partial-origin session retains public bag uncertainty and live subjects on import',()=>withPage('st-lab.html',{},g=>{
 const R=require('../st-rules');workers(g);const state=R.createState({active:'I',hold:'O',queue:[...'JLOST'],streamCursor:100,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})});
 g.element('#st-snapshot').value=JSON.stringify(state);g.click('#st-import');const initial=clone(g.window.stLab.publicInventory),saved=g.window.stLab.exportSession();
 assert.equal(initial.originKnown,false);assert.ok(initial.knowledge);g.window.stLab.act('HD');g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');
 assert.deepEqual(clone(g.window.stLab.publicInventory),initial);g.window.stLab.act('HOLD');assert.equal(g.window.stLab.publicInventory.active.id,initial.hold.id);assert.equal(g.window.stLab.resources.coverage.status,'partial');
}));
