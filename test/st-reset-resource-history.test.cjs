'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Context=require('../st-obligation-context'),R=require('../st-rules'),Provider=require('../st-resource-provider'),Policy=require('../st-reset-policy');
const clone=x=>JSON.parse(JSON.stringify(x)),fixture=require('./support/st-resource-trial-1.json'),leftT=['L','L','L','HD'];
// Entry permission is explicit in these accounting cases. Reset strategy timing
// stays separately tested by st-reset-coach; this driver does not replace it.
function run(until=24){const x=require('./support/current-player.cjs')(fixture.initial);for(const step of fixture.steps){if(x.locks>=until)break;x.act(step.action,step.revealed);}return x;}
const facts=x=>Context.resolve(x.context,{position:x.position});
test('Reset current account: two actual Left Ts credit once each, preserving intervening spending',()=>{
 const x=run(),before=clone(x.state);x.begin();assert.equal(x.state.account.reset.remaining,2);
 assert.deepEqual(x.state.center,before.center);assert.deepEqual(x.state.sl,before.sl,'Entering Reset cannot erase current S/L duties');
 const effects=[],lock=w=>{x.lock(w);effects.push(...x.last.effects);};
 lock(leftT);assert.equal(x.state.account.reset.remaining,1);const first=x.state.account.reset.firstTId;assert.equal(facts(x).extraZ.remaining,1);
 for(let i=0;i<4;i++)lock(['HD']);assert.equal(facts(x).extraZ.remaining,0);lock(leftT);
 assert.equal(x.state.account.reset.status,'inactive');assert.equal(facts(x).extraZ.remaining,1);const credit=x.last.effects.find(e=>e.status==='reset-T-credited');assert(credit);assert.notEqual(credit.pieceId,first);
 const oldS=effects.find(e=>e.domain==='sl'&&e.status==='compacted'&&e.subject?.sId===25);assert.ok(oldS,'Actual invalidation compacts S25 rather than paying or erasing it');
 assert.ok(x.state.sl.uncertainty.S[oldS.severity]>0,'Its unresolved consequence survives Reset completion as a current count');
 assert.deepEqual(Context.importState(Context.exportState(x.context),{position:x.position}),x.context);
});
test('Reset current account: repeated marker and HOLD cannot duplicate credits; caller snapshot restores duties',()=>{
 const x=run();x.begin();const saved=Context.snapshot(x.context,{position:x.position}),id=x.inventory.active.id;x.begin();assert.deepEqual(x.last.effects,[]);x.act('HOLD');x.act('HOLD');assert.equal(x.inventory.active.id,id);assert.equal(x.state.account.reset.remaining,2);x.lock(leftT);assert.equal(x.state.account.reset.firstTId,id);assert.equal(x.state.account.reset.remaining,1);const restored=Context.restore(clone(saved));assert.equal(restored.context.state.account.reset.remaining,2);assert.equal(restored.context.state.account.z.remaining,0);
});
test('Reset current account: non-Left and scoring Ts invalidate without granting credit',()=>{
 const x=run();x.begin();x.lock(['HD']);assert.equal(facts(x).reset.status,'invalid');assert.equal(facts(x).extraZ.status,'out-of-profile');const unmarked=run();unmarked.lock(leftT);assert.equal(facts(unmarked).reset.progress,1);assert.equal(facts(unmarked).extraZ.remaining,1);assert.equal(facts(unmarked).profileLost,false);const scoring=run();scoring.begin();let locks=0;for(const step of fixture.steps){if(locks===24)scoring.act(step.action,step.revealed);if(step.action==='HD')locks++;if(locks===25)break;}assert.equal(scoring.position.lastEvent.lines,2);assert.equal(facts(scoring).reset.status,'invalid');
});
test('Reset current account: unknown and declined entry never create an active duty',()=>{
 const x=run(),policy=Policy.consider(x.position,facts(x));assert.ok(['ordinary-preferred','ordinary-rebuild-preferred'].includes(policy.status),'The original supported ordinary control still declines production entry: '+policy.reason);
 x.begin(policy.status==='candidate');assert.equal(x.state.account.reset.status,'inactive');assert.equal(x.last.effects[0].status,'reset-rejected');
 const early=run(15);assert.equal(facts(early).extraZ.remaining,1);early.begin();assert.equal(early.state.account.reset.status,'inactive','Even explicit candidate entry cannot bypass the early account');
 const unknown=Context.start(x.position);const refused=Context.beginReset(unknown,{position:x.position,candidate:true});assert.notEqual(refused.context.state.account.reset.status,'active');assert.throws(()=>Context.beginReset(clone(x.context),{position:x.position,candidate:true}));
});
test('Reset current account: Right Z is not optional spending and earns no fixed renewal adjustment',()=>{
 const x=run();x.begin();x.lock(leftT);for(let i=0;i<3;i++)x.lock(['HD']);x.lock(['CW','R','R','R','R','HD']);assert.equal(facts(x).extraZ.remaining,1);x.lock(leftT);assert.equal(facts(x).reset.status,'inactive');assert.equal(facts(x).extraZ.remaining,2);
});
test('Reset current account: actual overspending is retained in the balance when a later T starts a new Reset',()=>{
 const x=run();x.begin();x.act('HOLD');for(let i=0;i<5;i++)x.lock(['HD']);assert.equal(x.position.lastEvent.type,'Z');assert.equal(facts(x).extraZ.remaining,-1);assert.equal(facts(x).reset.status,'invalid');x.lock(leftT);assert.equal(facts(x).reset.status,'active');assert.equal(facts(x).reset.progress,1);const imported=Context.importState(Context.exportState(x.context),{position:x.position});assert.equal(Context.resolve(imported,{position:x.position}).extraZ.remaining,0);
});
test('Reset current account: inherited coverage never absorbs newly created roofs',()=>{
 const f=require('./fixtures/resource-projection-history.json').cases[1],x=require('./support/current-player.cjs')(f.observation,{snapshot:f.obligationContext});assert.deepEqual(x.state.account.reset.inheritedCovered,[]);x.lock(f.witness);assert.deepEqual(x.state.safety.coveredCells,[[3,24]]);assert.deepEqual(x.state.account.reset.inheritedCovered,[]);
});
test('Reset current account: observed bag constraints and identities survive HOLD and transport',()=>{
 const x=run(),read=()=>Provider.facts(Provider.prepare(x.position,{obligationContext:Context.exportState(x.context)})),before=clone(read().publicBag);x.act('HOLD');assert.deepEqual(read().publicBag,before);x.act('HOLD');assert.deepEqual(read().publicBag,before);const imported=Context.importState(Context.exportState(x.context),{position:x.position});assert.deepEqual(imported.inventory,x.inventory);assert.equal(Context.start(x.position).inventory.originKnown,false);
});
