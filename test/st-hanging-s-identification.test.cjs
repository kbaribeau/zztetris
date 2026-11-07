'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources');
const trial=require('./support/st-resource-trial-1.json');
const copy=x=>JSON.parse(JSON.stringify(x));
function prefix(locks,fixture=trial){
 let state=R.createState(fixture.initial),history=Current.start(state,{fresh:true}),count=0;
 for(const step of fixture.steps){if(count===locks)break;const next=R.move(state,step.action);const after={...next,queue:[...next.queue,...step.revealed],...(next.bag?{bag:step.revealed.reduce((bag,type)=>B.consume(bag,type),next.bag)}:{})};history=Current.applyActual(history,{before:state,action:step.action,after:after}).context;state=after;if(step.action==='HD')count++;}
 return{state,history};
}
function execute(root,witness){let {state,history}=root;for(const action of witness){const after=R.move(state,action);history=Current.applyActual(history,{before:state,action:action,after:after}).context;state=after;}return{state,history,summary:CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}))};}
const root=prefix(22),summary=CurrentProvider.facts(CurrentProvider.prepare(root.state,{obligationContext:Current.exportState(root.history)}));
const ids=r=>r.hangingS.map(s=>s.id),observedIds=d=>d.hangingS.evidence.map(s=>s.sId);
test('Hanging-S identification: crossing L consumes its exact bag partner before repair geometry is known',()=>{
 assert.equal(summary.instances.active.id,24);assert.equal(summary.instances.active.bag,3);
 const after=execute(root,['HD']);assert.deepEqual(after.state.lastEvent.cells,[[5,27],[3,28],[4,28],[5,28]]);
 assert.equal(after.summary.hangingS.status,'hanging');assert.deepEqual(observedIds(after.summary),[25]);assert.equal(after.summary.center.pending.length,0,'Identity is not an invented Center repair shape');
 const projected=M.checkPath(root.state,[{witness:['HD'],event:after.state.lastEvent}],root.history);assert.equal(projected.valid,true);assert.deepEqual(ids(projected.resource),[25]);
 const proof=M.repair(after.state,projected.resource,{maxNodes:4000,depth:4});assert.equal(proof.valid,true);assert.equal(proof.status,'visible-left-S-repair');assert.ok(proof.visited>0,'Identified surplus engages real repair search, not the no-obligation shortcut');
 const repaired=M.checkPath(after.state,proof.path,after.history);assert.equal(repaired.valid,true);assert.deepEqual(ids(repaired.resource),[]);
 assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(after.state,{obligationContext:Current.exportState(Current.importState(copy(Current.exportState(after.history)),{position:after.state}))})),after.summary,'Worker replay derives the same identity rather than trusting a status flag');
 assert.equal(CurrentProvider.facts(CurrentProvider.prepare(after.state,{obligationContext:Current.exportState(Current.start(after.state))})).hangingS.status,'unknown','Public import cannot recover the observed allocation');
 assert.equal(CurrentProvider.facts(CurrentProvider.prepare(root.state,{obligationContext:Current.exportState(root.history)})).hangingS.status,summary.hangingS.status,'Immutable pre-lock history remains usable for Undo');
 assert.equal(CurrentProvider.facts(CurrentProvider.prepare(after.state,{obligationContext:Current.exportState(root.history)})).status,'unavailable','Old supply cannot bind after a completed lock');
});
test('Hanging-S identification: every non-Right L rotation accounts for the still-live same-bag S',()=>{
 const placements=R.placements(root.state,{allowHold:false,maxNodes:45000}).placements.filter(p=>p.event.type==='L'&&p.event.cells.every(([x])=>x<7));
 const crossing=placements.filter(p=>p.event.cells.some(([x])=>x<4)&&p.event.cells.some(([x])=>x>=4));assert.ok(crossing.length);assert.equal(new Set(crossing.map(p=>p.target.rotation)).size,4);
 for(const p of placements){const after=execute(root,p.witness),projected=M.checkPath(root.state,[p],root.history);assert.deepEqual(observedIds(after.summary),[25]);assert.deepEqual(ids(projected.resource),[25]);}
});
test('Hanging-S identification: an S already accommodated on Left is not recreated by a crossing L',()=>{
 const before=prefix(18),d=CurrentProvider.facts(CurrentProvider.prepare(before.state,{obligationContext:Current.exportState(before.history)}));
 const s=R.placements(before.state,{maxNodes:45000}).placements.find(p=>p.event.type==='S'&&p.event.cells.every(([x])=>x<4));assert.ok(s);
 const afterS=execute(before,s.witness);assert.equal(d.instances.active.id,20);assert.equal(afterS.state.lastEvent.type,'S');
 const l=R.placements(afterS.state,{maxNodes:45000}).placements.find(p=>p.event.type==='L'&&p.event.cells.every(([x])=>x<7)&&p.event.cells.some(([x])=>x<4)&&p.event.cells.some(([x])=>x>=4));assert.ok(l);
 const afterL=execute(afterS,l.witness);assert.deepEqual(observedIds(afterL.summary),[]);
 const projected=M.checkPath(before.state,[s,l],before.history);assert.deepEqual(ids(projected.resource),[]);
});
test('Hanging-S identification: actual cross-bag SL completion transfers only the identified surplus',()=>{
 const before=prefix(27),d=CurrentProvider.facts(CurrentProvider.prepare(before.state,{obligationContext:Current.exportState(before.history)}));assert.deepEqual(observedIds(d),[25]);
 let locks=0,at=0;for(;at<trial.steps.length&&locks<27;at++)if(trial.steps[at].action==='HD')locks++;
 const witness=[];for(;at<trial.steps.length;at++){witness.push(trial.steps[at].action);if(trial.steps[at].action==='HD')break;}
 const after=execute(before,witness);assert.deepEqual(observedIds(after.summary),[35]);
 const projected=M.checkPath(before.state,[{witness,event:after.state.lastEvent}],before.history);assert.deepEqual(ids(projected.resource),[35]);assert.ok(!ids(projected.resource).includes(25),'Completing S25 is not merely reducing an anonymous count');
});
test('Hanging-S identification: an unreviewed crossing S remains unknown rather than an invented matching pair',()=>{
 const before=prefix(18),d=CurrentProvider.facts(CurrentProvider.prepare(before.state,{obligationContext:Current.exportState(before.history)}));
 const s=R.placements(before.state,{allowHold:false,maxNodes:45000}).placements.find(p=>p.event.cells.every(([x])=>x<7)&&p.event.cells.some(([x])=>x<4)&&p.event.cells.some(([x])=>x>=4));assert.ok(s);
 const afterS=execute(before,s.witness);
 const l=R.placements(afterS.state,{allowHold:false,maxNodes:45000}).placements.find(p=>p.event.type==='L'&&p.event.cells.every(([x])=>x<7));assert.ok(l);
 const afterL=execute(afterS,l.witness);assert.equal(afterL.summary.hangingS.status,'unknown');assert.deepEqual(observedIds(afterL.summary),[]);assert.equal(afterL.summary.hangingS.unclassifiedCount,1);
 const checked=M.checkPath(before.state,[s,l],before.history);assert.deepEqual(ids(checked.resource),[]);assert.ok(checked.resource.unclassifiedS.some(p=>p.sId===20));assert.equal(checked.resource.uncertainty.S.count,afterL.summary.hangingS.unclassifiedCount,'Immediate collection preserves the same current uncertainty count');assert.equal(M.newUnclassified(checked.resource),true);
});
test('Hanging-S identification: held S plus two preview S pieces does not fabricate imported placement history',()=>{
 const state=R.createState({rules:'st-zero-v2',board:[...Array(32).fill('..........'),'....LOO...','.SS.LOO...','SSOOLL....','LJOOLOO...','LJJJLOO...','IJSLOOJ.Z.','SSLLLSS.Z.','IJLLOOJ.Z.'],active:{type:'I',x:3,y:17,rotation:0,lastRotation:null},hold:'S',canHold:true,queue:['S','Z','J','L','Z','S'],revision:640,streamCursor:60,bag:{remaining:[43],observedCount:66,provenance:'known-phase'}});
 const h=Current.start(state),d=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(h)}));assert.equal(d.hangingS.status,'unknown');assert.equal(h.inventory.originKnown,false);assert.equal(d.instances.hold.bag,null);assert.deepEqual(h.state.sl.residuals,[]);assert.equal(d.extraZ.status,'unknown');
 const held=execute({state,history:h},['HOLD']);assert.equal(held.summary.instances.active.id,d.instances.hold.id);assert.equal(held.summary.hangingS.status,'unknown');assert.deepEqual(ids(M.start(held.state,held.history)),[]);
});
test('Hanging-S identification: Left repair clears one exact identity, not another same-bag label',()=>{
 const after=execute(root,['HD']),resource=M.start(after.state,after.history);
 const s=R.placements(after.state,{allowHold:false,maxNodes:45000}).placements.find(p=>p.event.type==='S'&&p.event.cells.every(([x])=>x<4));assert.ok(s);
 assert.equal(M.repairGoal(s.event,{id:2500,type:'S',bag:3},resource),false,'Even equal bag metadata cannot pay a different S identity');
 assert.throws(()=>M.step(after.state,s,{...resource,hangingS:[{id:2500,bag:3,known:true}]}),/current projected resource/,'Copied view cannot replace the factual route');
 const result=M.step(after.state,s,resource);assert.deepEqual(ids(result),[]);
 const observed=execute(after,s.witness);assert.deepEqual(observedIds(observed.summary),[]);assert.deepEqual(observedIds(CurrentProvider.facts(CurrentProvider.prepare(after.state,{obligationContext:Current.exportState(after.history)}))),[25]);
});
test('Hanging-S identification: same-bag pending S is completed or left unaccompanied by the actual L allocation',()=>{
 const before=prefix(25,require('./support/st-resource-trial-2.json')),d=CurrentProvider.facts(CurrentProvider.prepare(before.state,{obligationContext:Current.exportState(before.history)}));
 assert.equal(d.instances.active.id,27);assert.equal(d.center.pending[0].rootId,24);
 const placements=R.placements(before.state,{allowHold:false,maxNodes:45000}).placements;
 for(const left of [false,true]){
  const target=d.center.pending[0].alternatives[0].cells;
  const p=placements.find(p=>p.event.type==='L'&&(left?p.event.cells.every(([x])=>x<4):JSON.stringify(p.event.cells)===JSON.stringify(target)));assert.ok(p);
  const actual=execute(before,p.witness),projected=M.checkPath(before.state,[p],before.history);
  assert.deepEqual(observedIds(actual.summary),left?[24]:[]);assert.deepEqual(ids(projected.resource),left?[24]:[]);
 }
});
