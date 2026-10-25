'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history');
const clone=x=>JSON.parse(JSON.stringify(x));
function run(f,{fresh=true,until=Infinity}={}){
 let state=R.createState(f.initial),history=H.start(state,{fresh}),locks=0;const byLock=[];
 function act(action,revealed=[]){const before=state;let next=R.move(state,action);assert.notEqual(next,state,'Literal action must execute');for(const type of revealed)next={...next,queue:[...next.queue,type],...(next.bag?{bag:B.consume(next.bag,type)}:{})};history=H.applyAction(history,before,action,next);state=next;const d=H.resolve(state,history);assert.notEqual(d.coverage.status,'invalid',d.coverage.reason);if(action==='HD'){locks++;byLock.push(d);}return d;}
 for(const step of f.steps){if(locks>=until)break;act(step.action,step.revealed);}
 return{act,byLock,get state(){return state;},get history(){return history;},get diagnostics(){return H.resolve(state,history);}};
}
const trial=n=>require('./support/st-resource-trial-'+n+'.json');
test('resource history: verified source allocation and first actual TSD establish Extra-Z baseline, not first-bag pattern',()=>{
 const a=run(trial(1));assert.deepEqual(a.byLock[6].milestones.sourcePattern,{at:7,id:'buri-02'});assert.equal(a.byLock[6].extraZ.status,'unknown');
 assert.equal(a.byLock[13].extraZ.status,'unknown');assert.equal(a.byLock[14].extraZ.status,'available');assert.equal(a.byLock[14].extraZ.baseline.at,15);assert.equal(a.byLock[14].extraZ.baseline.capAt,4);assert.equal(a.byLock[14].extraZ.baseline.qualityAt,14);
 assert.equal(a.byLock[20].extraZ.status,'used');assert.equal(a.byLock[20].extraZ.allocations.length,1);assert.equal(a.byLock[20].extraZ.allocations[0].region,'center');
 assert.equal(a.byLock[24].allocations.at(-1).lines,2);assert.equal(a.byLock[24].extraZ.status,'used','TSD cannot replenish the optional Z');assert.equal(a.byLock[29].extraZ.status,'used');assert.equal(a.diagnostics.extraZ.allocations.length,1,'Right cap is not Extra Z');
});
test('resource history: unused optional Z remains available; known history is not itself source eligibility',()=>{
 const a=run(trial(2));assert.equal(a.byLock[19].extraZ.baseline.at,20);assert.equal(a.diagnostics.extraZ.status,'available');assert.equal(a.diagnostics.extraZ.allocations.length,0);
 const bad=run(trial(5));assert.equal(bad.diagnostics.coverage.status,'complete');assert.equal(bad.diagnostics.milestones.firstTsd.at,20);assert.equal(bad.diagnostics.extraZ.baseline,null);assert.equal(bad.diagnostics.extraZ.status,'unknown','An extra opener Z after a balanced checkpoint prevents baseline certification');assert.equal(bad.diagnostics.hangingS.status,'out-of-profile','First TSD cannot erase a previously observed source-profile departure');
});
test('resource history: imported copy of identical public play cannot inherit baseline, ages, or bag identity',()=>{
 const a=run(trial(1),{fresh:false});assert.equal(a.diagnostics.coverage.status,'partial');assert.equal(a.diagnostics.extraZ.status,'unknown');assert.equal(a.diagnostics.hangingS.status,'unknown');assert.equal(a.diagnostics.flow.ageKnown,false);assert.ok(a.diagnostics.instances.queue.every(p=>p.bag===null));
 const injected={...a.state,resourceHistory:clone(a.history),extraZ:{status:'available'}};const h=H.start(injected);assert.equal(H.resolve(injected,h).extraZ.status,'unknown');assert.equal(H.resolve(a.state,clone(a.history)).coverage.status,'invalid');
});
test('resource history: whole Z crossing Left/Center counts once and a second Z never renews allowance',()=>{
 const crossing=run(trial(1),{until:20});assert.equal(crossing.state.active.type,'Z');const used=crossing.act('HD');assert.equal(used.extraZ.status,'used');assert.equal(used.extraZ.allocations.length,1);assert.equal(used.extraZ.allocations[0].region,'left-center');
 const twice=run(trial(1),{until:28});assert.equal(twice.state.active.type,'Z');twice.act('L');twice.act('L');twice.act('L');const out=twice.act('HD');assert.equal(out.extraZ.allocations.length,2);assert.equal(out.extraZ.status,'out-of-profile');assert.equal(out.hangingS.status,'out-of-profile');
});
test('resource history: ordinary pending S/L is not Hanging S, and cross-bag completion transfers the surplus identity',()=>{
 const ordinary=run(trial(2));assert.equal(ordinary.byLock[22].hangingS.status,'none-observed');assert.ok(ordinary.byLock[22].center.pending.some(p=>p.family==='SL'));assert.equal(ordinary.byLock[22].center.debt.length,0);
 const a=run(trial(1));const before=a.byLock[23],after=a.byLock[27];assert.equal(before.hangingS.status,'hanging');assert.equal(before.hangingS.evidence[0].sId,25);assert.equal(after.center.pending.length,0);assert.equal(after.hangingS.status,'hanging');assert.equal(after.hangingS.evidence[0].sId,35);assert.equal(after.hangingS.evidence[0].lId,29);assert.ok(after.pairs.some(p=>p.rootId===25&&p.partnerId===29&&p.family==='SL'));
 assert.equal(after.center.debt.length,0,'Completing geometry does not erase the next surplus S');
});
test('resource history: completed LO and flat Center can coexist with a source-backed unaccompanied S',()=>{
 const a=run(trial(2));const d=a.byLock[15];assert.ok(d.pairs.some(p=>p.family==='LO'&&p.rootId===16&&p.partnerId===17));assert.equal(d.hangingS.status,'hanging');assert.equal(d.hangingS.evidence[0].sId,15);assert.equal(d.center.pending.length,0);assert.equal(a.byLock[18].hangingS.status,'none-observed','Actual S-left placement resolves observed surplus; a preparatory shape alone does not');
});
test('resource history: exact diverted partner debt survives filler and a canonical TSD, then actual replacement repays it',()=>{
 const snapshot=require('./support/st-user-center-cap.json'),w=require('./support/st-center-deferral-witness.json');const a=run({initial:snapshot,steps:[]},{fresh:false});
 for(let i=0;i<w.witnesses.length;i++){for(const action of w.witnesses[i])a.act(action);const d=a.diagnostics;if(i<4)assert.ok(d.center.debt.length);else{assert.equal(d.center.debt.length,0);assert.ok(d.center.closed.some(x=>x.status==='debt-fulfilled'));}assert.equal(d.hangingS.status,'unknown','Geometric L debt is not a Hanging S claim');}
 assert.equal(a.byLock[3].allocations.at(-1).lines,2);assert.notDeepEqual(a.byLock[0].center.debt[0].alternatives,a.byLock[3].center.debt[0].alternatives,'Exact target follows the real clear map');
});
test('resource history: malformed, forged, stale, or mismatched events fail closed without throwing',()=>{
 const s=R.createState(trial(1).initial),h=H.start(s,{fresh:true});for(const bad of[null,{}, {...s,board:[]}]){assert.doesNotThrow(()=>H.resolve(bad,h));assert.equal(H.resolve(bad,h).hangingS.status,'unknown');assert.doesNotThrow(()=>H.applyAction(h,bad,'L',s));}
 const next=R.move(s,'R');assert.equal(H.applyAction(clone(h),s,'R',next).coverage.status,'invalid');assert.equal(H.applyAction(h,s,'L',next).coverage.status,'invalid');assert.equal(H.resolve(next,h).coverage.status,'invalid');
 const hd=R.move(s,'HD');assert.equal(H.applyAction(h,s,'HD',{...hd,lastEvent:{...hd.lastEvent,lines:4}}).coverage.status,'invalid');
});
test('resource history: cumulative history truncation becomes unknown instead of re-anchoring from geometry',()=>{
 let s=R.createState(trial(1).initial),h=H.start(s,{fresh:true});for(let i=0;i<=H.limits.actions;i++){const n=R.move(s,i%2?'R':'L');h=H.applyAction(h,s,i%2?'R':'L',n);s=n;}const d=H.resolve(s,h);assert.equal(d.coverage.status,'truncated');assert.equal(d.extraZ.status,'unknown');assert.equal(d.hangingS.status,'unknown');
});
test('resource history: later off-profile T diversion preserves observed facts but cannot claim normal resource eligibility',()=>{
 const a=run(trial(1),{until:29});assert.equal(a.state.active.type,'T');a.act('L');a.act('L');a.act('L');const d=a.act('HD');assert.equal(d.extraZ.status,'out-of-profile');assert.equal(d.hangingS.status,'out-of-profile');assert.equal(d.extraZ.allocations.length,1);
});

test('resource history: an unreviewed advanced S disposition stays unknown instead of a confident hanging label',()=>{const a=run(trial(1),{until:23});assert.equal(a.state.active.type,'S');const d=a.act('HD');assert.equal(d.allocations.at(-1).region,'left-center');assert.equal(d.hangingS.status,'unknown');assert.ok(d.hangingS.unclassified.some(x=>x.sId===25));});

test('resource history: accommodating the later surplus S on Left does not repay an earlier exact L debt',()=>{
 const f=trial(1),a=run(f,{until:27});let locks=0,i=0;for(;i<f.steps.length&&locks<27;i++)if(f.steps[i].action==='HD')locks++;
 let revealed;for(;i<f.steps.length;i++)if(f.steps[i].action==='HD'){revealed=f.steps[i++].revealed;break;}
 for(const action of ['L','L','L','HD'])a.act(action,action==='HD'?revealed:[]);
 assert.deepEqual(a.diagnostics.hangingS.evidence.map(x=>x.sId),[25,35]);assert.equal(a.diagnostics.center.debt[0].rootId,25);
 for(;i<f.steps.length;i++)a.act(f.steps[i].action,f.steps[i].revealed);
 for(const action of ['L','L','L','HD','L','L','L','HD'])a.act(action);
 const d=a.diagnostics;assert.equal(d.allocations.at(-1).pieceId,35);assert.equal(d.allocations.at(-1).region,'left');assert.deepEqual(d.hangingS.evidence.map(x=>x.sId),[25]);assert.equal(d.center.debt[0].rootId,25,'S35-left resolves only its own surplus, not the pending L for S25');
});
test('resource history: HOLD top-out exposes terminal historical facts without inventing a lock',()=>{
 const board=R.emptyBoard();board[18]='....X.....';const s=R.createState({board,active:{type:'I',x:3,y:25,rotation:0,lastRotation:null},hold:'O',queue:['T','S','Z','L','J','I']});const h=H.start(s),next=R.move(s,'HOLD');assert.equal(next.topOut,true);const ended=H.resolve(next,H.applyAction(h,s,'HOLD',next));assert.equal(ended.terminal,true);assert.equal(ended.locks,0);assert.equal(H.resolve(s,h).terminal,false);
});
