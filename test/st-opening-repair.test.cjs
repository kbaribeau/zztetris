'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),O=require('../st-opening');
const controls=require('./support/st-opening-round1.json'),c=controls.repairControl,clone=x=>JSON.parse(JSON.stringify(x));
function saved(){const proof=O.repairCertificate(c.originObservation,c.continuation);assert.ok(proof);const before=R.replay(c.originObservation,c.continuation[0].witness.slice(0,-1)).state;return O.updateSession({active:true,clear:null,repair:proof},before,c.afterLockObservation,c.actualEvent);}
test('opening repair: frozen39 mechanical handoffs retain legal proofs; five incomplete foundations are not yet ready',()=>{
 assert.equal(controls.successfulHandoffs.length,39);assert.equal(controls.failedClearObservations.length,8);assert.equal(controls.failedOpeningEndpoints.length,11);
 assert.equal(controls.successfulHandoffs.filter(h=>O.handoffGeometry(h.observation)).length,34);
 for(const h of controls.successfulHandoffs){assert.equal(O.handoffGeometry(h.observation),O.facts(h.observation.board).buriedCenterVacancies.length===0,String(h.seed));const clear=R.replay(h.actualClearProof.before,['HD']);assert.ok(clear.valid);assert.deepEqual(clear.events[0],h.actualClearProof.event);let state=h.observation;for(const p of h.continuation){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);state=r.state;}}
 for(const h of controls.failedClearObservations)assert.equal(O.handoffGeometry(h.observation),false,String(h.seed));
});
test('opening repair: actual lock preserves known cancelling T instead of losing finite construction at replan',()=>{
 const session=saved(),checked=O.checkedRepair(session.repair,c.afterLockObservation);assert.ok(checked);assert.equal(checked.proof.consumed,1);assert.equal(checked.path[0].event.type,'T');
 let state=c.afterLockObservation,sess=session;for(let i=0;i<2;i++){const a=P.plan(state,{openingPhase:true,openingRepair:sess.repair,maxNodes:45000});assert.ok(a.target,a.reason);assert.equal(a.metrics.rootTies,undefined);assert.equal(a.metrics.tieExtension,undefined);sess=O.acceptResult(sess,a);const before=R.replay(state,a.witness.slice(0,-1)).state,r=R.replay(before,['HD']);assert.ok(r.valid);state=r.state;sess=O.updateSession(sess,before,state,r.events[0]);}
 assert.equal(O.balance(state.board),0);assert.equal(S.geometry(state.board).center.patternSupport,'reference-supported');assert.notEqual(S.geometry(state.board).center.status,'unrecognized');assert.ok(P.assess(state.board).maxHeight<=10);assert.equal(sess.repair,null);
});
test('opening repair: visible witness prefixes survive HOLD/rotation; forged index, absent supply and wrong actual lock fail',()=>{
 const session=saved(),s=c.afterLockObservation,proof=session.repair,a=O.checkedRepair(proof,s);assert.ok(a);
 for(let i=0;i<a.path[0].witness.length;i++){const pose=R.replay(s,a.path[0].witness.slice(0,i));assert.ok(pose.valid);assert.ok(O.checkedRepair(proof,pose.state));}
 assert.equal(O.checkedRepair({...proof,consumed:99},s),null);assert.equal(O.checkedRepair(proof,{...s,queue:[]}),null);
 const wrong=R.replay(s,['HD']);assert.equal(O.updateSession(session,s,wrong.state,wrong.events[0]).repair,null);
 assert.equal(P.plan(s,{openingPhase:true,openingRepair:proof,maxNodes:0,timeMs:0}).target,null);
 assert.equal(O.startSession({...s,openingRepair:proof}).repair,null);
});
test('opening repair: exact Center goal translates through canonical clear, not a scalar replacement cavity',()=>{
 const initial=require('./support/st-user-center-cap.json'),w=require('./support/st-center-deferral-witness.json').witnesses;let state=initial,path=[];
 for(const witness of w){const r=R.replay(state,witness);assert.ok(r.valid);path.push({witness,event:r.events[0]});state=r.state;}
 const c=S.geometry(initial.board).center.completions.find(x=>x.piece==='L'&&x.resultStatus==='level');assert.ok(c);
 assert.equal(O.goalPaid(initial,path,{balance:false,center:{piece:'L',cells:c.cells}}),true);
 assert.equal(O.goalPaid(initial,path,{balance:false,center:{piece:'L',cells:c.cells.map(([x,y])=>[x,y-1])}}),false);
});

test('opening handoff: reference first-double foundations preserve intended notches without buried non-notch vacancies',()=>{
 const refs=require('./support/st-opening-geometry.json').filter(c=>c.tag==='after-first-double');assert.equal(refs.length,4);for(const c of refs)assert.deepEqual(O.facts(c.board).buriedCenterVacancies,[],c.id);
 const h=controls.successfulHandoffs.find(c=>c.seed===506379703);assert.deepEqual(O.facts(h.observation.board).buriedCenterVacancies,[[6,31],[6,32]]);assert.equal(O.handoffGeometry(h.observation),false);
});
test('opening repair: replacement authority cannot retire at an earlier unrelated Center improvement',()=>{
 const f=require('./support/st-opening-replacement-goal.json'),generic=O.repairCertificate(f.origin,f.path);assert.equal(generic.steps.length,1);assert.equal(generic.goal.balance,false);
 const bound=O.repairCertificate(f.origin,f.path,f.basis.goal),proof={...bound,basis:f.basis};assert.equal(bound.steps.length,2);
 const checked=O.checkedRepair(proof,f.origin);assert.ok(checked);assert.equal(checked.goal.balance,true);
 const first=f.path[0],before=R.replay(f.origin,first.witness.slice(0,-1)).state,r=R.replay(before,['HD']);assert.notEqual(O.balance(r.state.board),0);
 const next=O.updateSession({active:true,repair:proof},before,r.state,r.events[0]);assert.equal(next.repair.consumed,1);assert.ok(O.checkedRepair(next.repair,r.state));
 assert.equal(O.checkedRepair({...proof,steps:proof.steps.slice(0,1)},f.origin),null);
 const forged=clone(proof);forged.basis.steps[0].event.spin='full';assert.equal(O.checkedRepair(forged,f.origin),null);
 const changedGoal=clone(proof);changedGoal.goal.balance=false;assert.equal(O.checkedRepair(changedGoal,f.origin).goal.balance,true,'serialized goal flags are not trusted');
});
test('opening clear: a checked hypothetical maintenance continuation ranks a clear but cannot itself switch phase',()=>{
 const f=require('./support/st-opening-handoff.json'),a=P.plan(f.before,{openingPhase:true,maxNodes:45000});assert.ok(a.target,a.reason);assert.equal(a.phase,'opening');assert.ok(a.evidence.opening.handoffCandidate);
 let state=f.before;for(const step of a.continuation){const r=R.replay(state,step.witness);assert.ok(r.valid);state=r.state;}
 assert.ok(a.continuation.at(-1).event.lines);assert.equal(O.handoffGeometry(state),true);
 for(const step of a.evidence.opening.handoffCandidate.continuation){const r=R.replay(state,step.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],step.event);state=r.state;}
 assert.equal(O.acceptResult({active:true,clear:null,repair:null},a).active,true);
 assert.ok(a.metrics.nodes+a.metrics.handoffReservedNodes<=45000);assert.equal(a.metrics.handoffProbes.at(-1).status,'verified');
});

test('opening clear: hypothetical handoff projects public resource history without changing live authority',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),RH=require('../st-resource-history'),f=require('./support/st-opening-handoff.json');
 const resourceContext=RH.exportContext(f.before,RH.start(f.before)),original=JSON.stringify(resourceContext),probes=[];
 const planner={...P,plan(state,options){if(options.disableOpening){const h=RH.importContext(state,options.resourceContext),summary=RH.resolve(state,h);probes.push(summary);assert.equal(summary.coverage.status,'partial');assert.ok(summary.locks>0);assert.equal(summary.extraZ.status,'unknown');}return P.plan(state,options);}};
 const sandbox={performance,module:{exports:{}},require:name=>name==='./st-planner'?planner:require('../'+name.replace(/^\.\//,''))};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),sandbox);
 const a=sandbox.module.exports.plan(f.before,{openingPhase:true,maxNodes:45000,deadline:Infinity,resourceContext});
 assert.ok(a.target);assert.ok(probes.length);assert.equal(a.phase,'opening');assert.equal(JSON.stringify(resourceContext),original);
 assert.equal(RH.resolve(f.before,RH.importContext(f.before,resourceContext)).locks,0);
});
