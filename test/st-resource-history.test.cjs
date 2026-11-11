'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),Context=require('../st-obligation-context');
const clone=x=>JSON.parse(JSON.stringify(x));
function run(f,{fresh=true,until=Infinity}={}){
 const x=require('./support/current-player.cjs')(f.initial,{fresh}),byLock=[];
 function act(action,revealed=[]){x.act(action,revealed);const facts=Context.resolve(x.context,{position:x.position});assert.equal(facts.status,'available');if(action==='HD')byLock.push(facts);return facts;}
 for(const step of f.steps){if(x.locks>=until)break;act(step.action,step.revealed);}
 return{act,byLock,get state(){return x.position;},get context(){return x.context;},get last(){return x.last;},get diagnostics(){return Context.resolve(x.context,{position:x.position});}};
}
const trial=n=>require('./support/st-resource-trial-'+n+'.json');
test('current resources: source pattern alone grants no Z; actual first TSD establishes credit and later TSD does not renew it',()=>{
 const a=run(trial(1));assert.equal(a.byLock[6].extraZ.status,'unknown');assert.equal(a.byLock[13].extraZ.status,'unknown');assert.deepEqual(a.byLock[14].extraZ,{status:'available',baseline:true,remaining:1});assert.equal(a.byLock[20].extraZ.remaining,0);assert.equal(a.byLock[24].extraZ.status,'used');assert.equal(a.byLock[29].extraZ.status,'used');assert.equal(a.diagnostics.extraZ.remaining,0);
});
test('current resources: known accounting alone does not establish source eligibility',()=>{
 const a=run(trial(2));assert.equal(a.diagnostics.extraZ.status,'available');assert.equal(a.diagnostics.extraZ.remaining,1);const bad=run(trial(5));assert.equal(bad.diagnostics.availability,'known');assert.equal(bad.diagnostics.extraZ.baseline,false);assert.equal(bad.diagnostics.extraZ.status,'unknown');assert.equal(bad.diagnostics.hangingS.status,'out-of-profile');
});
test('current resources: raw imported play has unknown origins even with injected diagnostic flags',()=>{
 const a=run(trial(1),{fresh:false});assert.equal(a.diagnostics.availability,'unknown');assert.equal(a.diagnostics.extraZ.status,'unknown');assert.equal(a.diagnostics.hangingS.status,'unknown');assert.ok(a.context.inventory.queue.every(p=>p.bag===null));const injected={...a.state,extraZ:{status:'available'}};assert.equal(Context.resolve(Context.start(injected),{position:injected}).extraZ.status,'unknown');assert.throws(()=>Context.resolve(clone(a.context),{position:a.state}));
});
test('current resources: crossing Z spends one credit and a second Z cannot renew it',()=>{
 const crossing=run(trial(1),{until:20});assert.equal(crossing.state.active.type,'Z');const used=crossing.act('HD');assert.equal(used.extraZ.status,'used');assert.equal(used.extraZ.remaining,0);const twice=run(trial(1),{until:28});for(const action of ['L','L','L','HD'])twice.act(action);assert.equal(twice.diagnostics.extraZ.status,'out-of-profile');assert.equal(twice.diagnostics.hangingS.status,'out-of-profile');
});
test('current resources: ordinary pending SL is not Hanging S; cross-bag payment transfers the exact surplus',()=>{
 const ordinary=run(trial(2));assert.equal(ordinary.byLock[22].hangingS.status,'none-observed');assert.ok(ordinary.byLock[22].center.pending.some(p=>p.family==='SL'));const a=run(trial(1)),before=a.byLock[23],after=a.byLock[27];assert.equal(before.hangingS.evidence[0].sId,25);assert.equal(after.center.pending.length,0);assert.equal(after.hangingS.evidence[0].sId,35);assert.equal(after.hangingS.evidence[0].lId,29);assert.equal(after.center.debt.length,0);
});
test('current resources: completed LO and flat Center retain the unaccompanied S until actual Left payment',()=>{
 const a=run(trial(2)),d=a.byLock[15];assert.equal(d.hangingS.status,'hanging');assert.equal(d.hangingS.evidence[0].sId,15);assert.equal(d.center.pending.length,0);assert.equal(a.byLock[18].hangingS.status,'none-observed');
});
test('current resources: exact diverted Center debt follows a clear and is paid only by actual replacement',()=>{
 const snapshot=require('./support/st-user-center-cap.json'),w=require('./support/st-center-deferral-witness.json'),a=run({initial:snapshot,steps:[]},{fresh:false});for(let i=0;i<w.witnesses.length;i++){for(const action of w.witnesses[i])a.act(action);if(i<4)assert.ok(a.diagnostics.center.debt.length);else{assert.equal(a.diagnostics.center.debt.length,0);assert.ok(a.last.effects.some(x=>x.status==='debt-fulfilled'));}assert.equal(a.diagnostics.hangingS.status,'unknown');}assert.notDeepEqual(a.byLock[0].center.debt[0].alternatives,a.byLock[3].center.debt[0].alternatives);
});
test('current resources: copied context, mismatched action and forged lock event fail before accounting advances',()=>{
 const s=R.createState(trial(1).initial),c=Context.start(s,{fresh:true}),next=R.move(s,'R');for(const [current,action,after]of [[clone(c),'R',next],[c,'L',next]])assert.throws(()=>Context.applyActual(current,{before:s,action,after}));const hd=R.move(s,'HD');assert.throws(()=>Context.applyActual(c,{before:s,action:'HD',after:{...hd,lastEvent:{...hd.lastEvent,lines:4}}}));assert.equal(c.boundary.firstBagLocks,0);
});
test('current resources: movement beyond the retired tape cap does not lose known accounting',()=>{
 const s=R.createState(trial(1).initial),x=require('./support/current-player.cjs')(s);const initial=clone(x.state);for(let i=0;i<4100;i++)x.act(i%2?'R':'L');assert.equal(x.state.availability,'known');assert.deepEqual(x.state,initial);assert.equal(x.context.boundary.firstBagLocks,0);assert.equal('steps'in x.context,false);
});
test('current resources: later non-Left non-scoring T cannot claim normal resource eligibility',()=>{
 const a=run(trial(1),{until:29});assert.equal(a.state.active.type,'T');a.act('HD');assert.equal(a.diagnostics.extraZ.status,'out-of-profile');assert.equal(a.diagnostics.hangingS.status,'out-of-profile');
});
test('current resources: an unreviewed S disposition remains explicit uncertainty',()=>{const a=run(trial(1),{until:23});assert.equal(a.state.active.type,'S');a.act('HD');assert.equal(a.diagnostics.hangingS.status,'unknown');assert.ok(a.diagnostics.hangingS.unclassifiedCount>0);});
test('current resources: HOLD top-out is an accepted terminal action without a lock',()=>{
 const board=R.emptyBoard();board[18]='....X.....';const s=R.createState({board,active:{type:'I',x:3,y:25,rotation:0,lastRotation:null},hold:'O',queue:['T','S','Z','L','J','I']}),x=require('./support/current-player.cjs')(s,{fresh:false});x.act('HOLD');assert.equal(x.position.topOut,true);assert.equal(x.locks,0);assert.equal(x.context.status,'available');assert.equal(s.topOut,false);
});
test('current resources: later surplus S Left payment cannot erase an earlier exact L debt',()=>{
 const f=trial(1),a=run(f,{until:27});let locks=0,i=0;for(;i<f.steps.length&&locks<27;i++)if(f.steps[i].action==='HD')locks++;
 let revealed;for(;i<f.steps.length;i++)if(f.steps[i].action==='HD'){revealed=f.steps[i++].revealed;break;}
 for(const action of ['L','L','L','HD'])a.act(action,action==='HD'?revealed:[]);
 assert.deepEqual(a.diagnostics.hangingS.evidence.map(x=>x.sId),[25,35]);assert.equal(a.diagnostics.center.debt[0].rootId,25);
 for(;i<f.steps.length;i++)a.act(f.steps[i].action,f.steps[i].revealed);
 for(const action of ['L','L','L','HD','L','L','L','HD'])a.act(action);
 assert.equal(a.last.receipt.locked.id,35);assert.ok(a.state.lastEvent.cells.every(([x])=>x<4));assert.deepEqual(a.diagnostics.hangingS.evidence.map(x=>x.sId),[25]);assert.equal(a.diagnostics.center.debt[0].rootId,25);
});
