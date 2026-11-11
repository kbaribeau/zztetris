'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Context=require('../st-obligation-context'),player=require('./support/current-player.cjs');
const fixture=require('./fixtures/opening-z-allocation.json'),clone=x=>JSON.parse(JSON.stringify(x));
const heights=board=>Array.from({length:10},(_,x)=>{const y=board.findIndex(row=>row[x]!=='.');return y<0?0:40-y;});
// Literal current outcomes replace historical timestamp/counter assertions.
// No old ledger, historical claims or action-tape accounting is reconstructed.
function recorded(){
 const p=player(fixture.request.observation,{snapshot:fixture.request.options.obligationContext});
 const api={act(...args){const r=p.act(...args);assert.equal(p.context.status,'available',p.context.reason);return r;},lock(witness,event){for(const action of witness)api.act(action);if(event)assert.deepEqual(p.position.lastEvent,event);return api.diagnostics;},step:i=>api.lock(fixture.steps[i].witness,fixture.steps[i].event),get state(){return p.position;},get context(){return p.context;},get account(){return p.state.account;},get effects(){return p.last.effects;},get diagnostics(){return Context.resolve(p.context,{position:p.position});}};return api;
}
function priorTrial(n,until=Infinity){const f=require('./support/st-resource-trial-'+n+'.json'),p=player(f.initial);for(const step of f.steps){if(p.locks>=until)break;p.act(step.action,step.revealed);assert.equal(p.context.status,'available',p.context.reason);}return Context.resolve(p.context,{position:p.position});}
const has=(a,status)=>a.effects.some(e=>e.domain==='account'&&e.status===status);

test('opener resources: allocation verifies at first TSD but delayed quality waits for actual S and Center resolution',()=>{
 const a=recorded();assert.deepEqual(a.diagnostics.openingAllocation,{status:'pending',requiredNonRightZ:1,requiredNonRightT:0});
 const z=a.step(0);assert.equal(z.openingAllocation.status,'ready-for-first-tsd');assert.equal(z.extraZ.status,'unknown');
 const first=a.step(1);assert.deepEqual(first.openingAllocation,{status:'verified-first-tsd',requiredNonRightZ:0,requiredNonRightT:null});assert.equal(first.firstTsd,true);assert.equal(a.account.allocationVerified,true);assert.equal(has(a,'opening-allocation-verified'),true);
 assert.equal(first.extraZ.baseline,false);assert.equal(first.qualityPending,true);assert.equal(first.hangingS.status,'hanging');assert.ok(first.center.pending.some(p=>p.family==='ZJ'));
 for(const i of [2,3]){const d=a.step(i);assert.equal(d.extraZ.status,'unknown');assert.equal(d.qualityPending,true);assert.equal(has(a,'baseline-established'),false);}
 const final=a.step(4);assert.deepEqual(final.extraZ,{status:'available',baseline:true,remaining:1});assert.equal(has(a,'baseline-established'),true);assert.equal(a.account.opening,null);assert.equal(final.qualityPending,false);
 assert.deepEqual(heights(a.state.board).slice(0,7),[8,9,9,8,9,9,9]);assert.equal(final.hangingS.status,'none-observed');assert.equal(final.hangingL.status,'none-observed');assert.deepEqual(final.center.pending,[]);assert.deepEqual(final.center.debt,[]);
});

test('opener resources: TSD first carries mandatory Z; paying it is not optional spending or renewed credit',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);const first=a.lock(fixture.steps[1].witness);
 assert.deepEqual(first.openingAllocation,{status:'pending-opening-z',requiredNonRightZ:1,requiredNonRightT:null});assert.equal(a.account.mandatoryZ,true);assert.equal(a.account.z.uncredited,'none');assert.equal(first.extraZ.baseline,false);
 const undo=Context.snapshot(a.context,{position:a.state});
 const paid=a.lock(fixture.steps[0].witness.slice(1));assert.equal(paid.openingAllocation.status,'verified-first-tsd');assert.equal(paid.openingAllocation.requiredNonRightZ,0);assert.equal(a.account.z.uncredited,'none');assert.equal(has(a,'opening-Z-paid'),true);assert.equal(has(a,'optional-Z-debited'),false);assert.equal(paid.extraZ.baseline,false);
 const final=a.lock(fixture.steps[3].witness);assert.equal(final.extraZ.remaining,1);assert.equal(has(a,'baseline-established'),true);assert.equal(final.hangingS.status,'none-observed');assert.equal(final.hangingL.status,'none-observed');
 assert.deepEqual(Context.resolve(Context.importState(Context.exportState(a.context),{position:a.state}),{position:a.state}),final);
 const restored=Context.restore(undo),old=Context.resolve(restored.context,{position:restored.position});assert.equal(old.openingAllocation.requiredNonRightZ,1);assert.equal(old.extraZ.status,'unknown');
 const used=a.lock(['HOLD','L','L','CW','HD']);assert.deepEqual(used.extraZ,{status:'used',baseline:true,remaining:0});assert.equal(has(a,'optional-Z-debited'),true);assert.equal(has(a,'baseline-established'),false);assert.equal(used.openingAllocation.requiredNonRightZ,0);
});

test('opener resources: absent current origin cannot infer credit from post-TSD geometry or descriptive claims',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);
 const p=player({...a.state,openingAllocation:{status:'verified-first-tsd'},extraZ:{status:'available'}},{fresh:false});
 for(const witness of [fixture.steps[0].witness.slice(1),fixture.steps[3].witness])p.lock(witness);
 const view=Context.resolve(p.context,{position:p.position});assert.equal(view.availability,'unknown');assert.equal(view.openingAllocation.status,'unknown');assert.equal(view.openingAllocation.requiredNonRightZ,null);assert.equal(view.extraZ.status,'unknown');
});

test('opener resources: trusted current duties are authoritative, while extra historical claims reject structurally',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);
 const raw=Context.exportState(a.context),trusted=clone(raw);trusted.state.account.mandatoryZ=false;
 const accepted=Context.importState(trusted,{position:a.state});assert.equal(Context.resolve(accepted,{position:a.state}).openingAllocation.requiredNonRightZ,0,'Import trusts a coherent current duty, not an ancestry proof');assert.equal(a.account.mandatoryZ,true,'Import does not mutate the root');
 for(const key of ['openingAllocation','extraZ','steps','origin']){const invalid=clone(raw);invalid[key]={status:'available'};assert.throws(()=>Context.importState(invalid,{position:a.state}),/shape/);}
 assert.equal(Context.resolve(Context.importState(raw,{position:a.state}),{position:a.state}).openingAllocation.requiredNonRightZ,1);
});

test('opener resources: a second late non-Right Z remains optional and cannot create a fresh baseline',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);a.lock(fixture.steps[0].witness.slice(1));
 const extra=a.lock(['HOLD','L','L','CW','HD']);assert.equal(extra.openingAllocation.requiredNonRightZ,0);assert.equal(a.account.z.uncredited,'one');assert.equal(has(a,'optional-Z-debited'),true);
 a.lock(['HOLD',...fixture.steps[3].witness]);assert.deepEqual(a.diagnostics.center.pending,[]);assert.equal(a.diagnostics.extraZ.status,'unknown');assert.equal(a.diagnostics.extraZ.baseline,false);assert.equal(a.account.z.uncredited,'one');assert.equal(a.account.qualityCandidate,false);
});

test('opener resources: a second actual scoring TSD cannot erase unpaid mandatory Z',()=>{
 const a=recorded();for(const action of ['L','L','L'])a.act(action);a.act('HD',['Z']);a.lock(fixture.steps[1].witness);
 for(const witness of [fixture.steps[2].witness,['L','L','R180','HD'],['L','L','HD'],['L','L','HD'],['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']])a.lock(witness);
 assert.equal(a.state.lastEvent.type,'T');assert.equal(a.state.lastEvent.lines,2);assert.equal(a.state.lastEvent.spin,'full');assert.equal(a.account.thirdTWindow,false);assert.equal(a.account.mandatoryZ,true);assert.equal(a.account.z.uncredited,'none');assert.equal(a.diagnostics.extraZ.status,'unknown');
 assert.equal(Context.resolve(Context.importState(Context.exportState(a.context),{position:a.state}),{position:a.state}).openingAllocation.requiredNonRightZ,1);
 const paid=a.lock(['HOLD',...fixture.steps[0].witness.slice(1)]);assert.equal(paid.openingAllocation.requiredNonRightZ,0);assert.equal(a.account.z.uncredited,'none');assert.equal(has(a,'opening-Z-paid'),true);assert.equal(paid.extraZ.baseline,false);
});

test('opener resources: optional Z before delayed quality cannot be laundered into unused allowance',()=>{
 const a=recorded();a.step(0);a.step(1);a.lock(['L','L','CW','HD']);assert.equal(has(a,'optional-Z-debited'),true);a.step(3);a.lock(fixture.steps[4].witness);const d=a.diagnostics;
 assert.deepEqual(heights(a.state.board).slice(0,7),[10,11,11,11,9,9,9]);assert.equal(d.hangingS.status,'none-observed');assert.equal(d.hangingL.status,'none-observed');assert.deepEqual(d.center.debt,[]);assert.equal(d.openingAllocation.status,'verified-first-tsd');assert.equal(d.extraZ.baseline,false);assert.equal(d.extraZ.status,'unknown');assert.equal(a.account.z.uncredited,'one');assert.equal(a.account.qualityCandidate,false);
});

test('opener resources: actual before-clear quality credit and nonrenewal have literal current outcomes',()=>{
 const one=priorTrial(1,15);assert.deepEqual(one.extraZ,{status:'available',baseline:true,remaining:1});assert.equal(one.openingAllocation.status,'verified-first-tsd');
 assert.deepEqual(priorTrial(1).extraZ,{status:'used',baseline:true,remaining:0});assert.deepEqual(priorTrial(2).extraZ,{status:'available',baseline:true,remaining:1});
 const bad=priorTrial(5);assert.equal(bad.openingAllocation.status,'out-of-profile');assert.equal(bad.extraZ.baseline,false);assert.equal(bad.extraZ.status,'unknown');
});

test('opener resources: intervening non-scoring T keeps settled allocation but blocks delayed credit',()=>{
 const a=recorded();for(let i=0;i<4;i++)a.step(i);for(let i=0;i<3;i++)a.lock(['L','L','L','HD']);
 assert.equal(a.state.lastEvent.type,'T');assert.equal(a.state.lastEvent.lines,0);assert.equal(a.account.profile.departure,false);assert.equal(a.account.reset.remaining,1);assert.equal(a.account.allocationVerified,true);assert.equal(a.account.mandatoryZ,false);assert.equal(a.account.qualityCandidate,false);assert.equal(a.diagnostics.extraZ.status,'unknown');assert.equal(a.diagnostics.extraZ.baseline,false);
});

test('opener resources: invalidated diverted Center debt is an effect and cannot pay delayed quality',()=>{
 const a=recorded();for(let i=0;i<3;i++)a.step(i);const diverted=a.lock(['L','L','L','HD']);assert.equal(a.state.lastEvent.type,'J');assert.equal(diverted.center.debt.length,1);assert.equal(diverted.center.pending.length,1);
 const lost=a.lock(['CW','R','HD']);assert.equal(a.state.lastEvent.type,'L');assert.deepEqual(lost.center.debt,[]);assert.deepEqual(lost.center.pending,[]);assert.ok(a.effects.some(e=>e.domain==='center'&&e.status==='debt-invalidated'));assert.equal(a.account.qualityCandidate,false);assert.equal(has(a,'baseline-established'),false);
 a.lock(['HOLD','L','L','L','HD']);assert.equal(a.diagnostics.openingAllocation.status,'verified-first-tsd');assert.equal(a.diagnostics.extraZ.baseline,false);assert.equal(a.diagnostics.extraZ.status,'unknown');
});

test('opener resources: JSON current checkpoint resumes delayed quality without retaining archived facts',()=>{
 const a=recorded();for(let i=0;i<4;i++)a.step(i);const saved=Context.snapshot(a.context,{position:a.state}),p=player(saved.position,{snapshot:clone(saved.context)});
 p.lock(fixture.steps[4].witness);a.step(4);assert.deepEqual(Context.exportState(p.context),Context.exportState(a.context));assert.deepEqual(p.position,a.state);assert.equal(p.state.account.z.remaining,1);
 assert.equal(saved.context.state.account.z.remaining,null);assert.equal(saved.context.state.account.opening.kind,'quality');
 for(const field of ['allocations','closed','locks','milestones','steps'])assert.equal(Object.hasOwn(p.state,field),false);
});

test('opener resources: malformed current snapshots fail closed; long movement does not truncate current duties',()=>{
 const a=recorded(),raw=Context.exportState(a.context);for(const mutate of [c=>c.schemaVersion=99,c=>c.state.account.mandatoryZ=true,c=>c.state.account.history=[],c=>c.inventory.active.id=c.inventory.nextId]){const bad=clone(raw);mutate(bad);assert.throws(()=>Context.importState(bad,{position:a.state}));}
 const original=clone(a.context.state);for(let i=0;i<4100;i++)a.act(i%2?'R':'L');assert.deepEqual(a.context.state,original);assert.equal(a.context.status,'available');assert.equal(a.diagnostics.openingAllocation.requiredNonRightZ,1);
});

test('opener resources: whole-turn snapshot restore and movement preserve exact current quality state',()=>{
 const a=recorded();for(let i=0;i<4;i++)a.step(i);const before=Context.snapshot(a.context,{position:a.state});a.step(4);assert.equal(a.account.z.remaining,1);a.act('HOLD');assert.equal(a.account.z.remaining,1);assert.equal(has(a,'baseline-established'),false);
 const restored=Context.restore(clone(before));assert.equal(restored.context.state.account.z.remaining,null);assert.equal(restored.context.state.account.opening.kind,'quality');assert.throws(()=>Context.importState(before.context,{position:a.state}),/snapshot public position/);
});
