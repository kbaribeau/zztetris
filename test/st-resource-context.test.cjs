'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),Context=require('../st-obligation-context');
const clone=x=>JSON.parse(JSON.stringify(x));
function observed(n=1,{fresh=true,until=Infinity}={}){const f=require('./support/st-resource-trial-'+n+'.json'),x=require('./support/current-player.cjs')(f.initial,{fresh});for(const step of f.steps){if(x.locks>=until)break;x.act(step.action,step.revealed);}return x;}
test('resource context: worker clone retains exact current inventory, duties and phase boundary',()=>{
 const x=observed();x.handoff();const raw=Context.exportState(x.context),restored=Context.importState(clone(raw),{position:x.position});assert.deepEqual(restored,x.context);assert.equal(restored.state.sl.handoff,true);assert.equal(restored.state.account.z.remaining,0);for(const key of ['steps','pieces','allocations','origin'])assert.equal(key in raw,false);
});
test('resource context: malformed current structure and supply binding fail closed',()=>{
 const x=observed(),raw=Context.exportState(x.context);for(const mutate of [c=>c.inventory.nextId=0,c=>c.state.availability='invented',c=>c.boundary.firstBagLocks=8,c=>c.steps=[]]){const bad=clone(raw);mutate(bad);assert.throws(()=>Context.importState(bad,{position:x.position}));}const changed={...x.position,hold:'I'};if(x.position.hold!=='I')assert.throws(()=>Context.importState(raw,{position:changed}));
});
test('resource context: caller snapshots restore exact duties after movement and lock',()=>{
 const x=observed(1,{until:7}),before=Context.snapshot(x.context,{position:x.position});x.act('HOLD');x.act('HD');const restored=Context.restore(clone(before));assert.deepEqual(restored.context,before.context);assert.deepEqual(restored.position,before.position);assert.notDeepEqual(x.context,restored.context);
});
test('resource context: unknown origins remain unknown without deriving duties from geometry',()=>{
 const x=observed(1,{fresh:false,until:7});assert.equal(x.state.availability,'unknown');assert.equal(Context.resolve(x.context,{position:x.position}).extraZ.status,'unknown');assert.equal(x.inventory.originKnown,false);
});
test('resource context: handoff changes SL boundary without creating an Extra-Z baseline',()=>{
 const x=observed(1,{until:7}),before=clone(x.state.account);x.handoff();assert.equal(x.state.sl.handoff,true);assert.deepEqual(x.state.account,before);assert.equal(Context.resolve(x.context,{position:x.position}).extraZ.status,'unknown');
});
test('resource context: actual page sends only current authority through HOLD, lock, Undo, native import and modes',()=>{
 const {withPage}=require('./support/page.cjs'),Context=require('../st-obligation-context');
 return withPage('st-lab.html',{},g=>{
  const messages=[];
  g.window.Worker=class {postMessage(m){messages.push(clone(m));}terminate(){}};
  g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
  const read=()=>{const m=messages.at(-1),current=Context.importState(m.options.obligationContext,{position:m.observation});assert.equal(m.options.resourceContext,undefined);assert.equal(m.options.obligationContext.steps,undefined);return{m,current,d:Context.resolve(current,{position:m.observation})};};
  const initial=read();assert.equal(initial.d.availability,'known');assert.equal(initial.current.inventory.originKnown,true);
  g.tap('ShiftLeft');g.advance(40);const held=read();assert.deepEqual(held.current.inventory.hold,initial.current.inventory.active);assert.deepEqual(held.current.inventory.active,initial.current.inventory.queue[0]);
  g.tap('Space');g.advance(40);const locked=read();assert.deepEqual(locked.current.inventory.active,initial.current.inventory.queue[1]);assert.deepEqual(locked.current.inventory.hold,initial.current.inventory.active);assert.equal(locked.current.boundary.firstBagLocks,1);
  g.tap('KeyT');g.advance(40);const restored=read();assert.deepEqual(restored.m.options.obligationContext,initial.m.options.obligationContext);assert.equal(restored.d.availability,'known');
  const session=clone(g.window.stLab.exportSession());g.tap('ShiftLeft');g.advance(40);g.element('#st-snapshot').value=JSON.stringify(session);g.click('#st-import');g.advance(40);assert.deepEqual(read().m.options.obligationContext,session.coaching.obligationContext);
  const snapshot=g.snapshot();snapshot.obligationContext=initial.m.options.obligationContext;snapshot.extraZ={status:'available'};
  g.element('#st-snapshot').value=JSON.stringify(snapshot);g.click('#st-import');g.advance(40);
  assert.equal(read().d.availability,'unknown');assert.equal(read().d.extraZ.status,'unknown');assert.equal(read().current.inventory.originKnown,false,'Raw position flags cannot become session authority');
  g.element('#st-fixture').value='marathon-rebuild';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
  assert.equal(read().d.availability,'unknown');assert.equal(read().current.inventory.originKnown,false);assert.equal(read().current.boundary.firstBagLocks,null);
 });
});
