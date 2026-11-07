'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history');
const clone=x=>JSON.parse(JSON.stringify(x));
function observed(n=1,{fresh=true,until=Infinity}={}){
 const f=require('./support/st-resource-trial-'+n+'.json');
 let state=R.createState(f.initial),history=H.start(state,{fresh}),locks=0;
 for(const step of f.steps){if(locks>=until)break;const before=state;state=R.move(state,step.action);state={...state,queue:[...state.queue,...step.revealed]};history=H.applyAction(history,before,step.action,state);if(step.action==='HD')locks++;}
 assert.notEqual(H.resolve(state,history).coverage.status,'invalid');
 return {state,history};
}
test('resource context: worker clone replays identities, spent Z, Hanging S and handoff instead of trusting status flags',()=>{
 const {state,history:raw}=observed(),history=H.markHandoff(raw,state);
 const context=H.exportContext(state,history),copy=clone(context);
 assert.ok(Object.isFrozen(context));assert.ok(context.steps.length>30);assert.equal(context.fresh,true);
 assert.equal(copy.extraZ,undefined);assert.equal(copy.pieces,undefined);assert.equal(copy.observation,undefined);
 const restored=H.importContext(state,copy);
 assert.equal(H.importContext(state,copy),restored,'A repeated unchanged proof reuses only its verified result');
 assert.deepEqual(H.resolve(state,restored),H.resolve(state,history));
 copy.extraZ={status:'available'};copy.hangingS={status:'none-observed'};
 assert.equal(H.resolve(state,H.importContext(state,copy)).extraZ.status,'used','Imported diagnostic flags have no authority');
 copy.steps[0].action='TELEPORT';assert.equal(H.resolve(state,H.importContext(state,copy)).coverage.status,'invalid','A mutable worker copy cannot reuse validation after proof mutation');
});
test('resource context: malformed action, reveal, stale board and hidden origin supply fail closed',()=>{
 const {state,history}=observed(),context=clone(H.exportContext(state,history));
 for(const change of [c=>c.steps[0].action='TELEPORT',c=>c.steps[0].revealed=['T','T','T','T','T','T','T'],c=>c.origin.queue.push('T'),c=>c.steps.pop(),c=>c.handoffAtAction=c.steps.length+1]){
  const c=clone(context);change(c);const d=H.resolve(state,H.importContext(state,c));assert.equal(d.coverage.status,'invalid');assert.equal(d.extraZ.status,'unknown');
 }
 const board=state.board.slice();board[0]='X.........';const stale={...state,board};
 assert.equal(H.resolve(stale,H.importContext(stale,context)).coverage.status,'invalid');
 const c=clone(context);c.steps=Array(H.limits.actions+1).fill({action:'L',revealed:[]});
 assert.equal(H.resolve(state,H.importContext(state,c)).coverage.status,'invalid');
});
test('resource context: immutable snapshots support Undo and movement requires a newly bound context',()=>{
 const {state,history}=observed(1,{until:20}),old=H.exportContext(state,history);
 const next=R.move(state,'HOLD');assert.notEqual(next,state);
 const changed=H.applyAction(history,state,'HOLD',next),current=H.exportContext(next,changed);
 assert.equal(H.resolve(next,H.importContext(next,old)).coverage.status,'invalid');
 assert.deepEqual(H.resolve(next,H.importContext(next,clone(current))),H.resolve(next,changed));
 assert.deepEqual(H.resolve(state,H.importContext(state,clone(old))),H.resolve(state,history),'Undo restores the saved observation-bound history, not later allocations');
});
test('resource context: imported origin cannot claim source availability or known bags through forged fresh metadata',()=>{
 const original=observed(1,{until:20});
 const unknown=H.start(original.state),context=clone(H.exportContext(original.state,unknown));
 context.extraZ={status:'available'};context.origin.resourceHistory=clone(original.history);
 const d=H.resolve(original.state,H.importContext(original.state,context));
 assert.equal(d.coverage.status,'partial');assert.equal(d.extraZ.status,'unknown');assert.equal(d.flow.ageKnown,false);
 context.fresh=true;
 assert.equal(H.resolve(original.state,H.importContext(original.state,context)).coverage.status,'invalid');
});
test('resource context: a handoff marker does not establish an Extra-Z baseline',()=>{
 const {state,history}=observed(1,{until:7}),c=clone(H.exportContext(state,history));c.handoffAtAction=c.steps.length;
 const d=H.resolve(state,H.importContext(state,c));
 assert.equal(d.milestones.maintenanceHandoff.at,7);assert.equal(d.extraZ.status,'unknown');
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

test('resource context: Center obligation bag identities derive from replayed roots, not serialized claims',()=>{
 const {state,history}=observed(1,{until:21}),d=H.resolve(state,history);
 assert.equal(d.center.pending.length,1);assert.equal(d.center.pending[0].rootBag,3);
 for(const obligation of [...d.center.pending,...d.center.debt])assert.equal(obligation.rootBag,history.pieces[obligation.rootId]?.bag??null);
 const imported=H.resolve(state,H.start(state));
 for(const obligation of imported.center.pending)assert.equal(obligation.rootBag,null);
});
