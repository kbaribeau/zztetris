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
test('resource context: actual page sends replay-bound history through HOLD, Undo, import and mode changes',()=>{
 const {withPage}=require('./support/page.cjs');
 return withPage('st-lab.html',{},g=>{
  const messages=[];
  g.window.Worker=class {postMessage(m){messages.push(clone(m));}terminate(){}};
  g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
  const read=()=>{const m=messages.at(-1);return {m,d:H.resolve(m.observation,H.importContext(m.observation,m.options.resourceContext))};};
  const initial=read();assert.equal(initial.d.coverage.status,'complete');assert.equal(initial.m.options.resourceContext.steps.length,0);
  g.tap('ShiftLeft');g.advance(40);const held=read();assert.equal(held.d.instances.hold.type,initial.m.observation.active.type);assert.equal(held.m.options.resourceContext.steps.at(-1).action,'HOLD');
  g.tap('Space');g.advance(40);assert.equal(read().d.locks,1);
  g.tap('KeyT');g.advance(40);assert.equal(read().d.locks,0);assert.equal(read().d.coverage.status,'complete');
  const snapshot=g.snapshot();snapshot.resourceContext=initial.m.options.resourceContext;snapshot.extraZ={status:'available'};
  g.element('#st-snapshot').value=JSON.stringify(snapshot);g.click('#st-import');g.advance(40);
  assert.equal(read().d.coverage.status,'partial');assert.equal(read().d.extraZ.status,'unknown');assert.equal(read().m.options.resourceContext.fresh,false);
  g.element('#st-fixture').value='marathon-rebuild';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
  assert.equal(read().d.coverage.status,'partial');assert.equal(read().m.options.resourceContext.steps.length,0);
 });
});

test('resource context: Center obligation bag identities derive from replayed roots, not serialized claims',()=>{
 const {state,history}=observed(1,{until:21}),d=H.resolve(state,history);
 assert.equal(d.center.pending.length,1);assert.equal(d.center.pending[0].rootBag,3);
 for(const obligation of [...d.center.pending,...d.center.debt])assert.equal(obligation.rootBag,history.pieces[obligation.rootId]?.bag??null);
 const imported=H.resolve(state,H.start(state));
 for(const obligation of imported.center.pending)assert.equal(obligation.rootBag,null);
});

test('resource context: invalid transport cannot strip Center debt from legacy retained advice',()=>{
 const P=require('../st-planner'),state=require('./support/st-opening-handoff.json').after,bounds={disableOpening:true,maxNodes:45000,deadline:Infinity};
 const advice=P.plan(state,bounds);assert.ok(advice.target);assert.ok(H.resolve(state,H.start(state)).center.pending.length);
 // Old cached advice has no resource binding, so the endpoint check itself
 // must reject invalid transport rather than silently erase imported geometry.
 delete advice.evidence.resourceObligations;
 assert.ok(P.revalidate(state,advice,bounds));
 const action=advice.witness[0],moved=R.move(R.createState(state),action);
 assert.ok(P.advance(moved,advice,action,bounds));
 const locked=R.replay(state,advice.witness);assert.ok(locked.valid);
 assert.ok(P.continueCommitment(state,locked.state,advice,locked.events[0],bounds));
 const invalid={schemaVersion:1,origin:state,fresh:false,steps:[{action:'TELEPORT',revealed:[]}],handoffAtAction:null};
 for(const raw of [state,moved,locked.state])assert.equal(H.resolve(raw,H.importContext(raw,invalid)).coverage.status,'invalid');
 const options={...bounds,resourceContext:invalid};
 assert.equal(P.revalidate(state,advice,options),null);
 assert.equal(P.advance(moved,advice,action,options),null);
 assert.equal(P.continueCommitment(state,locked.state,advice,locked.events[0],options),null);
});
