'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const R=require('../st-rules'),Production=require('../st-resource-history'),fixture=require('./support/st-resource-trial-1.json');
const clone=x=>JSON.parse(JSON.stringify(x));
// Isolate lifecycle/accounting from timing policy. All origins, inputs, locks,
// preview identities and transport replay remain real. Production-policy entry
// rejection is separately covered; this is not a positive strategic fixture.
function isolated(){const file=path.resolve(__dirname,'../st-resource-history.js'),req=createRequire(file),box={module:{exports:{}},require:n=>n==='./st-reset-policy'?{consider:()=>({status:'candidate'})}:req(n)};vm.runInNewContext(fs.readFileSync(file,'utf8'),box);return box.module.exports;}
function run(H=isolated(),until=24){
 let state=R.createState(fixture.initial),history=H.start(state,{fresh:true});
 function act(action,revealed=[]){const next=R.move(state,action);assert.notEqual(next,state,'actual input '+action);const after={...next,queue:[...next.queue,...revealed]};history=H.applyAction(history,state,action,after);state=after;assert.equal(H.resolve(state,history).coverage.status,'complete');return H.resolve(state,history);}
 for(const step of fixture.steps){if(history.locks>=until)break;act(step.action,step.revealed);}
 return{H,act,lock:w=>{for(const a of w)act(a);return H.resolve(state,history);},begin:()=>{history=H.beginReset(history,state);return H.resolve(state,history);},get state(){return state;},get history(){return history;},get summary(){return H.resolve(state,history);}};
}
const leftT=['L','L','L','HD'];
test('Reset ledger: actual two Left Ts complete immediately, retaining pre-spent and inter-T Z allocations',()=>{
 const a=run(),before=a.summary;assert.equal(before.extraZ.remaining,0);assert.equal(before.extraZ.allocations.length,1);
 const begun=a.begin();assert.equal(begun.reset.status,'active');assert.equal(begun.extraZ.remaining,0);
 assert.deepEqual(clone(begun.center),clone(before.center));assert.deepEqual(clone(begun.observedSL),clone(before.observedSL));
 const first=a.lock(leftT);assert.equal(first.reset.progress,1);assert.equal(first.reset.status,'active');assert.equal(first.extraZ.remaining,1);assert.equal(first.extraZ.status,'used','Active Reset retains late dispatch');
 for(let i=0;i<4;i++)a.lock(['HD']);const spent=a.summary;assert.equal(spent.extraZ.allocations.length,2);assert.equal(spent.extraZ.remaining,0);
 const second=a.lock(leftT);assert.equal(second.reset.status,'inactive');assert.equal(second.reset.progress,2);assert.equal(second.reset.completedAt,second.locks);assert.equal(second.allocations.at(-1).lines,0);assert.equal(second.extraZ.capacity,3);assert.equal(second.extraZ.remaining,1);assert.equal(second.extraZ.status,'available');
 assert.deepEqual(clone(second.reset.credits.map(c=>c.bag)),[3,4]);assert.equal(new Set(second.reset.credits.map(c=>c.pieceId)).size,2);
 assert.deepEqual(clone(second.extraZ.allocations[0]),clone(before.extraZ.allocations[0]));
 assert.ok([...second.hangingS.evidence,...second.hangingS.unclassified].some(e=>e.sId===25),'The old S identity remains accounted for even when actual filler invalidates its geometric role');
 assert.ok(second.center.closed.some(e=>e.rootId===25),'Actual old Center history is retained, not erased');
 const context=clone(a.H.exportContext(a.state,a.history));assert.equal(context.resetAtActions.length,1);
 assert.deepEqual(clone(a.H.resolve(a.state,a.H.importContext(a.state,context))),clone(second));
});
test('Reset ledger: HOLD and marker idempotence cannot duplicate identity credits; Undo restores old immutable state',()=>{
 const a=run();a.begin();const saved={state:clone(a.state),history:a.history};const id=a.summary.instances.active.id;
 assert.equal(a.H.beginReset(a.history,a.state),a.history);a.act('HOLD');a.act('HOLD');assert.equal(a.summary.instances.active.id,id);assert.equal(a.summary.reset.credits.length,0);
 a.lock(leftT);assert.equal(a.summary.reset.credits.length,1);assert.equal(a.summary.reset.credits[0].pieceId,id);
 const old=a.H.resolve(saved.state,saved.history);assert.equal(old.reset.progress,0);assert.equal(old.extraZ.remaining,0);assert.equal(old.reset.credits.length,0);
 const reconstructed=a.H.resolve(a.state,a.H.importContext(a.state,clone(a.H.exportContext(a.state,a.history))));assert.equal(reconstructed.reset.progress,1);assert.equal(reconstructed.reset.credits.length,1);
});
test('Reset ledger: non-Left T invalidates without credit, and an unmarked Left T remains ordinary-profile departure',()=>{
 const a=run();a.begin();const wrong=a.lock(['HD']);assert.equal(wrong.reset.status,'invalid');assert.equal(wrong.reset.progress,0);assert.equal(wrong.reset.credits.length,0);assert.equal(wrong.extraZ.status,'out-of-profile');
 const unmarked=run();const d=unmarked.lock(leftT);assert.equal(d.reset.credits.length,0);assert.equal(d.extraZ.status,'out-of-profile');
});
test('Reset ledger: unknown, early, forged and unsupported production origins cannot begin Reset',()=>{
 const a=run(Production),s=a.state;assert.equal(Production.beginReset(a.history,s).coverage.status,'invalid','Real timing policy declines this supported ordinary control');
 assert.equal(Production.beginReset(Production.start(s),s).coverage.status,'invalid');assert.equal(Production.beginReset(clone(a.history),s).coverage.status,'invalid');
 const early=run(isolated(),15);assert.equal(early.summary.extraZ.status,'available');assert.equal(early.H.beginReset(early.history,early.state).coverage.status,'invalid','Even isolated timing cannot override early/late account');
});
test('Reset ledger: replay validates marker timing/order and never trusts serialized reset or balance flags',()=>{
 const a=run();a.begin();a.lock(leftT);const context=clone(a.H.exportContext(a.state,a.history));
 for(const markers of [[0],[context.resetAtActions[0],context.resetAtActions[0]],[-1],[context.steps.length+1]]){const bad={...clone(context),resetAtActions:markers};assert.equal(a.H.importContext(a.state,bad).coverage.status,'invalid');}
 const fake={...clone(context),reset:{status:'inactive',progress:2,credits:Array(10).fill({pieceId:1})},extraZ:{remaining:999}};
 const d=a.H.resolve(a.state,a.H.importContext(a.state,fake));assert.equal(d.reset.progress,1);assert.equal(d.extraZ.remaining,1);
 const removed={...clone(context),resetAtActions:[]};assert.equal(a.H.resolve(a.state,a.H.importContext(a.state,removed)).extraZ.status,'out-of-profile');
});

test('Reset ledger: no fixed award or silent cap subtraction when the intervening Z stays Right',()=>{
 const a=run();a.begin();a.lock(leftT);for(let i=0;i<3;i++)a.lock(['HD']);
 a.lock(['CW','R','R','R','R','HD']);const before=a.summary;assert.equal(before.extraZ.allocations.length,1);
 const done=a.lock(leftT);assert.equal(done.reset.status,'inactive');assert.equal(done.extraZ.capacity,3);assert.equal(done.extraZ.remaining,2,'Two actual Ts minus only the earlier spent Z, not fixed one-credit renewal');
 assert.equal(done.allocations.at(-2).region,'right','Actual Right Z inventory is not counted again as optional spending');
});

test('Reset ledger: actual Z overspend is permanently invalid, not repaired by later T credit',()=>{
 const a=run();a.begin();a.act('HOLD');for(let i=0;i<5;i++)a.lock(['HD']);
 assert.equal(a.state.lastEvent.type,'Z');assert.equal(a.summary.extraZ.remaining,-1);assert.equal(a.summary.reset.status,'invalid');
 const after=a.lock(leftT);assert.equal(after.reset.credits.length,0);assert.equal(after.reset.status,'invalid');assert.equal(after.extraZ.status,'out-of-profile');
 const restored=a.H.resolve(a.state,a.H.importContext(a.state,clone(a.H.exportContext(a.state,a.history))));assert.equal(restored.reset.status,'invalid');assert.equal(restored.extraZ.remaining,-1);
});
test('Reset ledger: actual scoring T is invalid during Reset, not a completed Left T',()=>{
 const a=run();a.begin();let locks=0;for(const step of fixture.steps){if(locks===24)a.act(step.action,step.revealed);if(step.action==='HD')locks++;if(locks===25)break;}
 assert.equal(a.state.lastEvent.type,'T');assert.equal(a.state.lastEvent.lines,2);assert.equal(a.summary.reset.status,'invalid');assert.equal(a.summary.reset.credits.length,0);
});

test('Reset ledger: inherited coverage is captured once and does not absorb roofs created during Reset',()=>{
 const a=run();const before=clone(a.summary.coveredRepair.cells);a.begin();assert.deepEqual(clone(a.summary.reset.inheritedCovered),before);
 for(const witness of [leftT,['HD'],['HD'],['HD'],['HD'],leftT]){
  const old=clone(a.summary.reset.inheritedCovered),d=a.lock(witness),rows=a.state.lastEvent.clearedRows,live=new Set(d.coveredRepair.cells.map(([x,y])=>x+','+y));
  const translated=old.filter(([,y])=>!rows.includes(y)).map(([x,y])=>[x,y+rows.filter(r=>r>y).length]).filter(([x,y])=>live.has(x+','+y));
  assert.deepEqual(clone(d.reset.inheritedCovered),translated);
 }
 assert.equal(a.summary.reset.inheritedCovered.length,0,'Newly created covered cells cannot become inherited debt');
});

test('Reset ledger: repeated entry retains cumulative credits and spending, and both markers replay',()=>{
 const H=isolated(),f=require('./support/st-reset-live-cycle.json');let state=R.createState(f.initial),history=H.importContext(state,clone(f.resourceContext));
 function act(action,revealed=[]){const next=R.move(state,action);assert.notEqual(next,state);const after={...next,queue:[...next.queue,...revealed]};history=H.applyAction(history,state,action,after);state=after;assert.equal(H.resolve(state,history).coverage.status,'complete');}
 history=H.beginReset(history,state);
 for(const step of f.steps)for(const a of step.actions)act(a.action,a.revealed);
 const completed=H.resolve(state,history);assert.equal(completed.reset.episodes.length,1);assert.equal(completed.extraZ.remaining,2);
 // Supply a valid public continuation from the still-unfinished observed bag.
 // These are new reveals after locks, never retroactive or planner-known supply.
 const continuation=[
  [['CW','L','L','HD'],'Z'],[['CW','L','L','L','L','HD'],'I'],
  [['L','L','HD'],'J'],[['CW','L','L','HD'],'L'],[['R','HD'],'S'],
  [['L','L','L','L','HD'],'Z'],[['HOLD','R180','L','L','L','HD'],'T'],[['R','HD'],'I'],
 ];
 for(const [witness,revealed]of continuation){for(const action of witness)act(action,action==='HD'?[revealed]:[]);assert.equal(state.topOut,false);}
 const late=H.resolve(state,history);assert.equal(late.extraZ.remaining,0);assert.equal(late.extraZ.status,'used');
 history=H.beginReset(history,state);const second=H.resolve(state,history);assert.equal(second.reset.status,'active');assert.equal(second.reset.progress,0);assert.deepEqual(clone(second.reset.credits),clone(completed.reset.credits));assert.equal(second.reset.episodes.length,1);assert.equal(second.extraZ.allocations.length,3);
 const context=clone(H.exportContext(state,history));assert.equal(context.resetAtActions.length,2);assert.deepEqual(clone(H.resolve(state,H.importContext(state,context))),clone(second));
});

test('Reset ledger: public remaining bag follows observed draw identities, never HOLD order or raw bag claims',()=>{
 const a=run(),before=clone(a.summary.publicBag);assert.equal(before.status,'known');a.act('HOLD');assert.deepEqual(clone(a.summary.publicBag),before);a.act('HOLD');
 const fake={...a.state,bag:{remaining:[],status:'invented'}};assert.deepEqual(clone(a.H.resolve(fake,a.history).publicBag),before,'History view binds public pieces; optional raw bag metadata cannot grant a different constraint');
 const reconstructed=a.H.resolve(a.state,a.H.importContext(a.state,clone(a.H.exportContext(a.state,a.history))));assert.deepEqual(clone(reconstructed.publicBag),before);
 const empty=R.createState(fixture.initial),h=a.H.start(empty,{fresh:true});assert.deepEqual(clone(a.H.resolve(empty,h).publicBag.remainingTypes),['I','J','L','O','S','T','Z'],'Seven observed first-bag pieces imply a fresh unknown next bag');
 assert.equal(a.H.resolve(a.state,a.H.start(a.state)).publicBag.status,'unknown');
});
