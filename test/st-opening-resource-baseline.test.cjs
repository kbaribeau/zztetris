'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history');
const fixture=require('./fixtures/opening-z-allocation.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const heights=board=>Array.from({length:10},(_,x)=>{const y=board.findIndex(row=>row[x]!=='.');return y<0?0:40-y;});
function recorded(){
 let state=R.createState(fixture.request.observation),history=H.importContext(state,clone(fixture.request.options.resourceContext));
 assert.equal(H.resolve(state,history).coverage.status,'complete');
 function act(action,revealed=[]){let next=R.move(state,action);assert.notEqual(next,state,'Literal input executes: '+action);for(const type of revealed)next={...next,queue:[...next.queue,type],...(next.bag?{bag:B.consume(next.bag,type)}:{})};history=H.applyAction(history,state,action,next);state=next;assert.equal(H.resolve(state,history).coverage.status,'complete');}
 function lock(witness,event){for(const action of witness)act(action);if(event)assert.deepEqual(state.lastEvent,event);return H.resolve(state,history);}
 return{act,lock,step:i=>lock(fixture.steps[i].witness,fixture.steps[i].event),get state(){return state;},get history(){return history;},get diagnostics(){return H.resolve(state,history);}};
}
function priorTrial(n,until=Infinity){
 const f=require('./support/st-resource-trial-'+n+'.json');let state=R.createState(f.initial),history=H.start(state,{fresh:true}),locks=0;
 for(const step of f.steps){if(locks>=until)break;const next=R.move(state,step.action);assert.notEqual(next,state);const after={...next,queue:[...next.queue,...step.revealed]};history=H.applyAction(history,state,step.action,after);state=after;if(step.action==='HD')locks++;}
 return H.resolve(state,history);
}

test('opener resources: mandatory allocation is verified at first TSD without forecasting delayed quality',()=>{
 const a=recorded(),initial=a.diagnostics.openingAllocation;
 assert.equal(initial.status,'pending');assert.equal(initial.requiredNonRightZ,1);assert.equal(initial.requiredNonRightT,0);assert.equal(initial.checkpoint,null);
 const z=a.step(0);assert.equal(z.locks,17);assert.equal(z.openingAllocation.status,'ready-for-first-tsd');assert.equal(z.openingAllocation.requiredNonRightZ,0);assert.equal(z.extraZ.status,'unknown');
 const first=a.step(1);assert.equal(first.locks,18);assert.equal(first.openingAllocation.status,'verified-first-tsd');assert.equal(first.openingAllocation.requiredNonRightZ,0);assert.equal(first.openingAllocation.requiredNonRightT,null);assert.equal(first.openingAllocation.completedAt,18);
 assert.deepEqual(first.openingAllocation.checkpoint,{at:18,capAt:1,counts:{S:2,L:3,T:3,Z:2,TNonRight:2,ZNonRight:1,ZRight:1}});
 assert.equal(first.extraZ.baseline,null);assert.equal(first.openingAllocation.qualityAt,null);assert.equal(first.hangingS.status,'hanging');assert.ok(first.center.pending.some(p=>p.family==='ZJ'));
 for(const i of [2,3]){const d=a.step(i);assert.equal(d.extraZ.status,'unknown','An actual cap or Center completion cannot predict the held S accommodation');assert.equal(d.openingAllocation.qualityAt,null);}
 const final=a.step(4);assert.equal(final.extraZ.status,'available');assert.equal(final.extraZ.baseline.at,21);assert.equal(final.extraZ.baseline.firstTsdAt,18);assert.equal(final.extraZ.baseline.qualityAt,21);assert.equal(final.extraZ.baseline.capAt,1);
 assert.deepEqual(final.openingAllocation.checkpoint,first.openingAllocation.checkpoint,'Later Right Z does not rewrite the first-clear allocation evidence');
 assert.deepEqual(heights(a.state.board).slice(0,7),[8,9,9,8,9,9,9]);assert.equal(final.openingAllocation.counts.S,3);assert.equal(final.openingAllocation.counts.L,3);assert.equal(final.hangingS.status,'none-observed');assert.equal(final.hangingL.status,'none-observed');assert.equal(final.center.pending.length,0);assert.equal(final.center.debt.length,0);
});

test('opener resources: TSD first carries the mandatory opening Z debt until its actual later allocation',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);const first=a.lock(fixture.steps[1].witness);
 assert.equal(first.milestones.firstTsd.at,18);assert.equal(first.openingAllocation.counts.ZNonRight,0);assert.equal(first.openingAllocation.status,'pending-opening-z');assert.equal(first.openingAllocation.requiredNonRightZ,1);assert.equal(first.openingAllocation.completedAt,null);assert.equal(first.openingAllocation.checkpoint.counts.ZNonRight,0);assert.equal(first.extraZ.baseline,null);
 const undo={state:clone(a.state),history:a.history,context:clone(H.exportContext(a.state,a.history))};
 const paid=a.lock(fixture.steps[0].witness.slice(1));assert.equal(paid.openingAllocation.status,'verified-first-tsd');assert.equal(paid.openingAllocation.requiredNonRightZ,0);assert.equal(paid.openingAllocation.completedAt,19);assert.equal(paid.extraZ.allocations.length,0,'The first later Z pays the mandatory opener allocation, not optional Extra Z');assert.equal(paid.extraZ.baseline,null,'The actual Z/J Center obligation remains');
 const final=a.lock(fixture.steps[3].witness);
 assert.deepEqual(heights(a.state.board).slice(0,7),[8,9,9,8,9,9,9]);assert.equal(final.openingAllocation.counts.S,final.openingAllocation.counts.L);assert.equal(final.openingAllocation.counts.ZNonRight,1);
 assert.equal(final.hangingS.status,'none-observed');assert.equal(final.hangingL.status,'none-observed');assert.equal(final.center.debt.length,0);assert.equal(final.extraZ.status,'available');assert.equal(final.extraZ.baseline.at,20);assert.equal(final.extraZ.baseline.firstTsdAt,18);assert.equal(final.extraZ.baseline.allocationCompletedAt,19);assert.deepEqual(final.openingAllocation.checkpoint,first.openingAllocation.checkpoint,'Later fulfillment never rewrites the exact first-clear proof');
 assert.deepEqual(H.resolve(a.state,H.importContext(a.state,clone(H.exportContext(a.state,a.history)))),final,'An older schema-one tape recomputes the real order rather than restoring derived flags');
 assert.equal(H.resolve(undo.state,undo.history).openingAllocation.requiredNonRightZ,1);assert.equal(H.resolve(undo.state,H.importContext(undo.state,undo.context)).extraZ.status,'unknown','Undo restores the real unpaid boundary, not later credit');
 const used=a.lock(['HOLD','L','L','CW','HD']);assert.equal(used.extraZ.status,'used');assert.equal(used.extraZ.baseline.at,20);assert.equal(used.extraZ.allocations.length,1);assert.equal(used.openingAllocation.completedAt,19,'Spending the optional Z cannot renew either checkpoint');
});

test('opener resources: uncleared or unobserved first-TSD history cannot invent post-clear opening credit',()=>{
 const uncleared=recorded(),context=clone(H.exportContext(uncleared.state,uncleared.history));context.openingAllocation={status:'verified-first-tsd',checkpoint:{at:16,counts:{T:3,ZNonRight:1}},completedAt:16};context.milestones={firstTsd:{at:16}};context.extraZ={status:'available'};
 const d=H.resolve(uncleared.state,H.importContext(uncleared.state,context));assert.equal(d.openingAllocation.status,'pending');assert.equal(d.openingAllocation.firstTsdAt,null);assert.equal(d.openingAllocation.completedAt,null);assert.equal(d.extraZ.status,'unknown');
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);let state=R.createState(a.state),history=H.start(state);
 for(const witness of [fixture.steps[0].witness.slice(1),fixture.steps[3].witness])for(const action of witness){const next=R.move(state,action);assert.notEqual(next,state);history=H.applyAction(history,state,action,next);state=next;}
 const partial=H.resolve(state,history);assert.equal(partial.coverage.status,'partial');assert.equal(partial.openingAllocation.status,'unknown');assert.equal(partial.openingAllocation.checkpoint,null);assert.equal(partial.openingAllocation.completedAt,null);assert.equal(partial.extraZ.status,'unknown');
});

test('opener resources: unresolved post-TSD opening Z debt cannot be supplied by imported claims or current geometry',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);const d=a.diagnostics;
 assert.equal(d.openingAllocation.requiredNonRightZ,1);assert.equal(d.extraZ.status,'unknown');
 const context=clone(H.exportContext(a.state,a.history));context.openingAllocation={...d.openingAllocation,requiredNonRightZ:0,completedAt:18};context.extraZ={status:'available',baseline:{at:18}};
 const replayed=H.resolve(a.state,H.importContext(a.state,context));assert.equal(replayed.openingAllocation.status,'pending-opening-z');assert.equal(replayed.openingAllocation.requiredNonRightZ,1);assert.equal(replayed.openingAllocation.completedAt,null);assert.equal(replayed.extraZ.status,'unknown');
 const partial=H.resolve(a.state,H.start(a.state));assert.equal(partial.openingAllocation.status,'unknown');assert.equal(partial.openingAllocation.requiredNonRightZ,null);assert.equal(partial.extraZ.status,'unknown');
});

test('opener resources: a second late non-Right Z remains optional and cannot create a fresh baseline',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);a.lock(fixture.steps[0].witness.slice(1));
 const extra=a.lock(['HOLD','L','L','CW','HD']);assert.equal(extra.openingAllocation.completedAt,19);assert.equal(extra.openingAllocation.counts.ZNonRight,2);assert.equal(extra.extraZ.allocations.length,1);assert.equal(extra.extraZ.allocations[0].at,20);
 a.lock(['HOLD',...fixture.steps[3].witness]);const d=a.diagnostics;assert.equal(d.center.pending.length,0);assert.equal(d.extraZ.status,'unknown');assert.equal(d.extraZ.baseline,null);assert.equal(d.extraZ.allocations.length,1);assert.equal(d.openingAllocation.requiredNonRightZ,0,'Only the mandatory debt is settled; there is no new optional allowance');
});

test('opener resources: a second actual scoring TSD cannot erase the unpaid mandatory opening Z',()=>{
 const a=recorded();for(const action of ['L','L','L'])a.act(action);a.act('HD',['Z']); // Actual public suffix after S17; no hidden supply.
 a.lock(fixture.steps[1].witness);const first=clone(a.diagnostics.openingAllocation.checkpoint);
 // Retained visible-only Z19/J20/L21/J22/T23 witness, all genuine inputs.
 for(const witness of [fixture.steps[2].witness,['L','L','R180','HD'],['L','L','HD'],['L','L','HD'],['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']])a.lock(witness);
 const second=a.diagnostics;assert.equal(second.locks,23);assert.equal(second.allocations.at(-1).type,'T');assert.equal(second.allocations.at(-1).lines,2);assert.equal(second.allocations.at(-1).spin,'full');assert.equal(second.openingAllocation.counts.T,4);assert.equal(second.openingAllocation.counts.TNonRight,2);
 assert.equal(second.openingAllocation.status,'pending-opening-z');assert.equal(second.openingAllocation.requiredNonRightZ,1);assert.equal(second.openingAllocation.completedAt,null);assert.deepEqual(second.openingAllocation.checkpoint,first);assert.equal(second.extraZ.status,'unknown');assert.equal(second.extraZ.allocations.length,0);
 assert.equal(H.resolve(a.state,H.importContext(a.state,clone(H.exportContext(a.state,a.history)))).openingAllocation.requiredNonRightZ,1,'Replay does not apply a deadline at the second TSD');
 const paid=a.lock(['HOLD',...fixture.steps[0].witness.slice(1)]);assert.equal(paid.openingAllocation.completedAt,24);assert.equal(paid.openingAllocation.requiredNonRightZ,0);assert.equal(paid.openingAllocation.counts.ZNonRight,1);assert.equal(paid.extraZ.allocations.length,0,'The first later non-Right Z is still mandatory, not optional');assert.equal(paid.extraZ.baseline,null,'Paying Z does not predict completion of the remaining real quality obligations');
});

test('opener resources: an optional Z before delayed quality cannot be laundered into an unused allowance',()=>{
 const a=recorded();a.step(0);a.step(1);a.lock(['L','L','CW','HD']);a.step(3);a.lock(fixture.steps[4].witness);const d=a.diagnostics;
 assert.deepEqual(heights(a.state.board).slice(0,7),[10,11,11,11,9,9,9]);assert.equal(d.openingAllocation.counts.S,d.openingAllocation.counts.L);assert.equal(d.hangingS.status,'none-observed');assert.equal(d.hangingL.status,'none-observed');assert.equal(d.center.debt.length,0);
 assert.equal(d.openingAllocation.status,'verified-first-tsd');assert.equal(d.openingAllocation.checkpoint.counts.ZNonRight,1);assert.equal(d.extraZ.allocations.length,1);assert.equal(d.extraZ.allocations[0].at,19);assert.equal(d.extraZ.baseline,null);assert.equal(d.extraZ.status,'unknown');
});

test('opener resources: existing before-clear quality checkpoints and nonrenewal remain unchanged',()=>{
 const one=priorTrial(1,15);assert.equal(one.extraZ.status,'available');assert.equal(one.extraZ.baseline.at,15);assert.equal(one.extraZ.baseline.qualityAt,14);assert.equal(one.extraZ.baseline.capAt,4);assert.equal(one.openingAllocation.status,'verified-first-tsd');
 const later=priorTrial(1);assert.equal(later.extraZ.status,'used');assert.equal(later.extraZ.baseline.at,15);assert.equal(later.extraZ.baseline.qualityAt,14);assert.equal(later.extraZ.allocations.length,1);
 const two=priorTrial(2);assert.equal(two.extraZ.baseline.at,20);assert.equal(two.extraZ.status,'available');
 const bad=priorTrial(5);assert.equal(bad.openingAllocation.status,'out-of-profile');assert.equal(bad.openingAllocation.checkpoint,null);assert.equal(bad.extraZ.baseline,null,'An extra pre-clear Z does not qualify at the first TSD or later');
});

test('opener resources: intervening non-scoring T preserves the mandatory checkpoint but blocks delayed credit',()=>{
 const a=recorded();for(let i=0;i<4;i++)a.step(i);const checkpoint=clone(a.diagnostics.openingAllocation.checkpoint);
 for(const witness of [['L','L','L','HD'],['L','L','L','HD'],['L','L','L','HD']])a.lock(witness);
 const d=a.diagnostics;assert.equal(d.allocations.at(-1).type,'T');assert.equal(d.allocations.at(-1).lines,0);assert.equal(d.openingAllocation.counts.T,4);assert.equal(d.openingAllocation.counts.TNonRight,3);assert.ok(d.extraZ.departures.length);
 assert.deepEqual(d.openingAllocation.checkpoint,checkpoint);assert.equal(d.extraZ.status,'unknown');assert.equal(d.extraZ.baseline,null);assert.equal(d.openingAllocation.qualityAt,null);
});

test('opener resources: invalidating a diverted Center partner is lost debt, not delayed quality repayment',()=>{
 const a=recorded();for(let i=0;i<3;i++)a.step(i);
 const diverted=a.lock(['L','L','L','HD']);assert.equal(diverted.allocations.at(-1).type,'J');assert.equal(diverted.center.debt.length,1);assert.equal(diverted.center.pending.length,1);
 const lost=a.lock(['CW','R','HD']);assert.equal(lost.allocations.at(-1).type,'L');assert.equal(lost.center.debt.length,0);assert.equal(lost.center.pending.length,0);assert.ok(lost.center.closed.some(p=>p.status==='debt-invalidated'&&p.at===21));
 a.lock(['HOLD','L','L','L','HD']);const d=a.diagnostics;assert.equal(d.openingAllocation.status,'verified-first-tsd');assert.equal(d.extraZ.baseline,null);assert.equal(d.extraZ.status,'unknown');assert.ok(d.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>d.openingAllocation.firstTsdAt));
});

test('opener resources: cloneable replay derives checkpoints and ignores serialized allocation or allowance claims',()=>{
 const a=recorded();for(let i=0;i<4;i++)a.step(i);const pending=clone(H.exportContext(a.state,a.history));
 pending.openingAllocation={status:'verified-first-tsd',qualityAt:20};pending.opening={allocation:{at:18},quality:{at:20}};pending.extraZ={baseline:{at:20},status:'available'};
 const stillPending=H.resolve(a.state,H.importContext(a.state,pending));assert.equal(stillPending.extraZ.status,'unknown');assert.equal(stillPending.openingAllocation.qualityAt,null);
 a.step(4);const context=clone(H.exportContext(a.state,a.history));context.openingAllocation={status:'unknown'};context.extraZ={status:'out-of-profile'};
 assert.deepEqual(H.resolve(a.state,H.importContext(a.state,context)),a.diagnostics,'A preexisting schema-one action tape gains only facts actually re-established by current replay');
 const tampered=clone(context);tampered.steps.pop();tampered.openingAllocation=a.diagnostics.openingAllocation;tampered.extraZ=a.diagnostics.extraZ;
 const invalid=H.resolve(a.state,H.importContext(a.state,tampered));assert.equal(invalid.coverage.status,'invalid');assert.equal(invalid.openingAllocation.status,'unknown');assert.equal(invalid.extraZ.status,'unknown');
});

test('opener resources: partial, missing, wrong-version and truncated histories cannot expose allocation credit',()=>{
 const a=recorded();for(let i=0;i<5;i++)a.step(i);const imported=H.resolve(a.state,H.start({...a.state,openingAllocation:a.diagnostics.openingAllocation,extraZ:a.diagnostics.extraZ}));
 assert.equal(imported.coverage.status,'partial');assert.equal(imported.openingAllocation.status,'unknown');assert.equal(imported.openingAllocation.counts,null);assert.equal(imported.openingAllocation.requiredNonRightZ,null);assert.equal(imported.extraZ.status,'unknown');
 assert.equal(H.resolve(a.state,clone(a.history)).openingAllocation.status,'unknown');
 const context=clone(H.exportContext(a.state,a.history));
 for(const change of [c=>c.schemaVersion=2,c=>c.origin.rules='st-zero-v1',c=>c.steps=Array(H.limits.actions+1).fill({action:'L',revealed:[]})]){const c=clone(context);change(c);const d=H.resolve(a.state,H.importContext(a.state,c));assert.equal(d.coverage.status,'invalid');assert.equal(d.openingAllocation.status,'unknown');assert.equal(d.extraZ.status,'unknown');}
 const root=R.createState(fixture.request.options.resourceContext.origin);let state=root,history=H.start(root,{fresh:true});
 for(let i=0;i<=H.limits.actions;i++){const next=R.move(state,i%2?'R':'L');assert.notEqual(next,state);history=H.applyAction(history,state,i%2?'R':'L',next);state=next;}
 const truncated=H.resolve(state,history);assert.equal(truncated.coverage.status,'truncated');assert.equal(truncated.openingAllocation.requiredNonRightZ,null);assert.equal(truncated.extraZ.status,'unknown');
});

test('opener resources: Undo and movement restore the exact observation-bound delayed quality checkpoint',()=>{
 const a=recorded();for(let i=0;i<4;i++)a.step(i);const before={state:clone(a.state),history:a.history,context:clone(H.exportContext(a.state,a.history))};
 a.step(4);assert.equal(a.diagnostics.extraZ.baseline.at,21);a.act('HOLD');assert.equal(a.diagnostics.extraZ.baseline.at,21,'Movement and HOLD do not issue a second baseline');
 assert.equal(H.resolve(before.state,before.history).extraZ.status,'unknown');assert.equal(H.resolve(before.state,H.importContext(before.state,before.context)).openingAllocation.qualityAt,null);
 assert.equal(H.resolve(a.state,H.importContext(a.state,before.context)).coverage.status,'invalid','An older checkpoint cannot bind a later observation');
});
