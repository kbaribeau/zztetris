'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),RH=require('../st-resource-history'),M=require('../st-midgame-resources'),S=require('../st-structure'),L=require('../st-left-context'),Session=require('../st-session');
const fixture=require('./fixtures/checked-I-D-exit.json'),clone=x=>JSON.parse(JSON.stringify(x));
const root=()=>R.createState(fixture.observation),options=()=>({...clone(fixture.options),now:()=>0,deadline:Infinity,depth:3,width:8,maxNodes:45000});
let cached;const advice=()=>clone(cached??=P.decide(root(),options()));
function harness(){const fs=require('fs'),path=require('path'),vm=require('vm'),filename=require.resolve('../st-planner'),m={exports:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8').replace('return Object.freeze({dPatternAdmission,','return Object.freeze({immediateIDPatternExitAdmission,immediateIExitEligible,checkedResourceEndpoint,'),{module:m,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance});return m.exports;}
function creation(){let state=root(),h=RH.importContext(state,fixture.options.resourceContext),pattern=clone(fixture.options.patternHistory);for(const witness of fixture.userWitnesses.slice(0,3)){const before=state;for(const action of witness){const old=state;state=R.move(state,action);h=RH.applyAction(h,old,action,state);}pattern=P.updatePatternHistory(pattern,before,state,state.lastEvent);}const witness=fixture.userWitnesses[3],r=R.replay(state,witness);return{before:state,p:{state:r.state,event:r.events[0],witness},options:{...options(),patternHistory:pattern,notches:S.advanceNotches(state.board,{state:r.state,event:r.events[0]},P.resolvePatternHistory(state,pattern)).pattern,resource:M.start(state,RH.resolve(state,h)),resourceContext:RH.exportContext(state,h)}};}
test('checked I / fresh decision scores first then executes separate Left and Center J allocation',()=>{
 const a=advice();assert.equal(a.recommendation.kind,'supported');assert.equal(a.metrics.checkedIAllocation.selected,true);assert(a.metrics.nodes<=45000);assert.deepEqual(a.continuation.map(p=>p.event.type),['T','J','O','S','I','J']);assert.equal(a.continuation[0].event.lines,2);assert.equal(a.continuation[0].event.spin,'full');
 for(const p of a.continuation.slice(1,5))assert(p.event.cells.every(([x])=>x<4));assert(a.continuation[5].event.cells.every(([x])=>x>=4&&x<=6));
 const plan=a.evidence.checkedIAllocation;assert.notEqual(plan.leftJId,plan.centerJId);assert.equal(plan.centerRootId,20);assert.equal(plan.iExitLock,5);
 const r=R.replay(root(),a.continuation.flatMap(p=>p.witness));assert(r.valid);assert.equal(r.events.length,6);assert.equal(L.isD(r.state.board),false);
 const proof=M.checkPath(root(),a.continuation,RH.resolve(root(),RH.importContext(root(),fixture.options.resourceContext)));assert(proof.valid);assert.equal(proof.resource.pendingCenter.length,0);assert.equal(proof.resource.hangingS.length,0);assert.equal(proof.resource.violations.length,0);
 const baseline=P.decide(root(),{...options(),disableCheckedIExit:true});assert.notEqual(baseline.metrics.checkedIAllocation?.selected,true);assert.equal(baseline.target,null);
});
test('checked I / player order and scoring-first order both pass full ordinary replay admission',()=>{
 let state=root();const steps=fixture.userWitnesses.map(witness=>{const r=R.replay(state,witness);assert(r.valid);state=r.state;return{witness,event:r.events[0],target:r.events[0].target};});
 for(const route of [steps,advice().continuation]){const work={};assert(P.revalidateOpeningForecast(root(),route,options(),work));assert.equal(work.retained,true);assert.equal(P.revalidateOpeningForecast(root(),route,{...options(),disableCheckedIExit:true},{}),null);}
});
test('checked I / concrete D creation certifies held I and exact visible resource repair',()=>{
 const {before,p,options:o}=creation(),proof=P.dPatternAdmission(before,p,o);assert(L.createsD(before.board,p.state.board));assert.equal(proof.valid,true,proof.reason);assert.equal(proof.reason,'immediate-executable-I-exit');assert.equal(proof.exit.event.type,'I');assert(proof.exit.witness.includes('HOLD'));assert(proof.iExit.pieceId>0);assert(proof.iExit.maximumHeight<=16);assert.equal(L.isD(proof.exit.state.board),false);assert.equal(P.dPatternAdmission(before,p,{...o,disableCheckedIExit:true}).valid,false);
 for(const patch of [{maxNodes:0},{maxNodes:1},{deadline:0}]){const tiny=P.dPatternAdmission(before,p,{...o,...patch,disableDelayedJPlan:true});assert.equal(tiny.valid,false);assert.equal(tiny.complete,false);}
});
test('checked I / late, missing and invented I cannot substitute for an immediate public piece',()=>{
 const {before,p,options:o}=creation(),Q=harness();
 for(const patch of [{active:'O'},{active:'O',hiddenQueue:['I']},{active:'O',queue:['O','J','I'] }]){const state=R.createState({...before,...patch,bag:null}),r=R.replay(state,p.witness);assert(r.valid);assert.equal(Q.immediateIDPatternExitAdmission(state,{state:r.state,event:r.events[0],witness:p.witness},{...o,resource:M.start(state),resourceContext:null}).valid,false);}
 const fake=clone(p);fake.witness=['HD'];assert.equal(Q.immediateIDPatternExitAdmission(before,fake,o).valid,false);
});
test('checked I / headroom, covered cells, Right preparation and occupied HOLD stay guarded',()=>{
 const Q=harness(),solid=h=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>y>=40-(h[x]||0)?'X':'.').join(''));
 const state=h=>R.createState({board:solid(h),active:'I',hold:'T',queue:['O','J']});
 assert.equal(Q.immediateIExitEligible(state([17,18,18,17])),false);
 const right=state([6,7,7,6,4,4,4,0,4,0]);assert.equal(S.geometry(right.board).right.cycle.prepareColumn,9);assert.equal(Q.immediateIExitEligible(right),false);
 const blocked=state([6,7,7,6,4,4,4,4,4,0]);assert(S.geometry(blocked.board).right.cycle.cleanupColumns.length);assert.equal(Q.immediateIExitEligible(blocked),false);
 const late=R.createState({board:solid([3,4,4,3]),active:'O',hold:'T',queue:['I','J']});assert.equal(Q.immediateIExitEligible(late),false);
 const {before,p,options:o}=creation();assert.equal(Q.immediateIDPatternExitAdmission(before,p,{...o,allowHold:false}).valid,false);
});
test('checked I / a currently executable Z cap cannot be postponed by a hypothetical I exit',()=>{
 const {before,p,options:o}=creation(),changed=R.createState({...before,queue:['Z',...before.queue.slice(1)],bag:null}),resource=clone(o.resource);resource.queue[0].type='Z';
 const r=R.replay(changed,p.witness);assert(r.valid);assert.equal(r.state.active.type,'Z');assert.equal(r.state.hold,'I');assert(S.geometry(r.state.board).right.completions.some(c=>R.replay(r.state,c.witness).valid));
 const proof=harness().immediateIDPatternExitAdmission(changed,{state:r.state,event:r.events[0],witness:p.witness},{...o,resource,resourceContext:null});assert.equal(proof.valid,false);
});
test('checked I / missing second J, stale history and exhausted budgets cannot select allocation',()=>{
 const missing=R.createState({...fixture.observation,queue:fixture.observation.queue.map(t=>t==='J'?'O':t),bag:null}),partial={...options(),resourceContext:RH.exportContext(missing,RH.start(missing))};assert.notEqual(P.decide(missing,partial).metrics.checkedIAllocation?.selected,true);
 const stale=options();stale.resourceContext.steps.at(-1).action='L';assert.notEqual(P.decide(root(),stale).metrics.checkedIAllocation?.selected,true);
 for(const patch of [{maxNodes:0},{maxNodes:1},{deadline:0}]){const a=P.decide(root(),{...options(),...patch});assert.notEqual(a.metrics.checkedIAllocation?.selected,true);assert(a.metrics.nodes<=(patch.maxNodes??45000));}
});
test('checked I / malformed observations keep normal invalid-input behavior',()=>{
 for(const value of [null,{board:['bad']}]){let result;assert.doesNotThrow(()=>{result=P.decide(value,{openingPhase:false,maxNodes:0,timeMs:0});});assert.equal(result.status,'invalid-input');}
});
function execute(reveal){let state=root(),history=RH.importContext(state,fixture.options.resourceContext),pattern=clone(fixture.options.patternHistory),a=advice(),count=0;const live=()=>({...options(),resourceContext:RH.exportContext(state,history),patternHistory:pattern});while(a&&count<7){const before=state,old=a;for(const action of old.witness){const prior=state;state=R.move(state,action);if(action==='HD'&&reveal){const type=['T','Z','S','J','O','I'][count];state={...state,queue:[...state.queue,type],bag:require('../st-bag').consume(state.bag,type)};}history=RH.applyAction(history,prior,action,state);if(action==='HD')pattern=P.updatePatternHistory(pattern,prior,state,state.lastEvent);else{a=P.advance(state,a,action,live());assert(a,`movement ${count} ${action}`);assert.equal(a.evidence.checkedIAllocation,null);}}
 count++;a=P.continueCommitment(before,state,old,state.lastEvent,live());if(count<6)assert(a,`retention ${count}`);}
 assert.equal(count,6);assert.equal(a,null);const summary=RH.resolve(state,history);assert.equal(summary.center.pending.length,0);assert.equal(summary.hangingS.evidence.length,0);return{state,history};}
test('checked I / every movement HOLD and lock retains the complete route and actual payment',()=>execute(false));
test('checked I / new public reveals retain the same finite commitment without future borrowing',()=>execute(true));
test('checked I / copied allocation evidence is cleared and full route is independently revalidated',()=>{
 const a=advice();a.evidence.checkedIAllocation={leftJId:-1,centerRootId:-1,centerJId:-1,iExitLock:0};const b=P.revalidate(root(),a,options());assert(b);assert.equal(b.evidence.checkedIAllocation,null);assert.equal(b.evidence.resourceObligations.checkedIExits.length,1);
 const broken=advice();broken.continuation[4].witness=['HD'];assert.equal(P.revalidate(root(),broken,options()),null);
 const saved=Session.create(root(),{...options(),resourceHistory:RH.importContext(root(),fixture.options.resourceContext),resourceOriginBag:fixture.resourceOriginBag,previous:a}),restored=Session.parse(JSON.stringify(saved));const c=P.revalidate(restored.state,restored.previous,{...options(),resourceContext:RH.exportContext(restored.state,restored.resourceHistory)});assert(c);assert.equal(c.evidence.checkedIAllocation,null);
});
test('checked I / fresh serialized Worker discovers the same public allocation within production budget',()=>{
 const worker=require('../scripts/lib/st-simulation.cjs').workerPlanner(),request=clone({type:'plan',id:250,observation:root(),previous:null,commitment:null,options:{...fixture.options,depth:3,width:8,maxNodes:45000,timeMs:1500}}),a=worker(request);assert.equal(a.recommendation.kind,'supported');assert.equal(a.metrics.checkedIAllocation.selected,true);assert.deepEqual(a.continuation.map(p=>p.event.type),['T','J','O','S','I','J']);assert(a.metrics.nodes<=45000);
});

test('checked I / one-placement fallback does not borrow an unexecuted I exit',()=>{
 const f=require('./fixtures/contextual-risk-S.json'),state=R.createState(f.observation),o={...options(),resourceContext:RH.exportContext(state,RH.start(state)),patternHistory:P.startPatternHistory(state)},a=P.decide(state,o);
 assert.equal(a.target.type,'S');assert.equal(a.recommendation.kind,'risky');assert.equal(a.evidence.resourceObligations,undefined);assert.equal(P.revalidate(state,a,o),null);assert(R.replay(state,a.continuation.flatMap(p=>p.witness)).valid);
});

test('checked I / an unexecuted exit cannot support a D-ending prefix or alter ordinary fresh ranking',()=>{
 const f=require('./fixtures/checked-I-unexecuted-exit.json'),Q=harness(),o={...f.options,now:()=>0,deadline:Infinity,maxNodes:45000},a=P.decide(f.observation,o);
 assert.deepEqual(a.target,f.baselineTarget);assert.equal(a.evidence.resourceObligations.checkedIExits.length,0);
 const proof=Q.checkedResourceEndpoint(f.observation,f.rejectedSteps,o);assert.equal(proof.valid,false);assert.equal(proof.reason,'D-created-without-immediate-J');
 const copied=P.decide(f.observation,{...o,checkedIExitRoute:true,protectHangingSGoals:true});assert.deepEqual(copied.target,a.target,'Serialized options cannot enable private route scope');
 const route=advice().continuation;assert.equal(P.revalidateOpeningForecast(root(),route.slice(0,4),options(),{}),null,'A target ending in D cannot borrow the next I without executing it');
});
test('checked I / exact original S accommodation is a protected goal, never a copied identity claim',()=>{
 const a=advice(),s=a.continuation.find(p=>p.event.type==='S'),goal=s.structuralEvidence.hangingSAccommodation;assert.equal(goal.pieceId,27);assert.deepEqual(goal.cells,s.event.cells);assert(P.resourceGoal([s]));assert.equal(P.resourceGoalPrefix([s],[s]),1);
 const missing=clone(a.continuation);missing.splice(missing.findIndex(p=>p.event.type==='S'),1);assert.equal(P.resourceGoalPrefix(missing,a.continuation),null);
 for(const change of [g=>g.pieceId++,g=>g.cells[0][0]++,g=>g.cells=null,g=>g.piece='O']){const forged=advice();change(forged.continuation.find(p=>p.event.type==='S').structuralEvidence.hangingSAccommodation);assert.equal(P.revalidate(root(),forged,options()),null);}
});
test('checked I / an observed S-only tail survives actual earlier Center payment',()=>{
 let state=root(),history=RH.importContext(state,fixture.options.resourceContext),pattern=clone(fixture.options.patternHistory);
 const live=()=>({...options(),resourceContext:RH.exportContext(state,history),patternHistory:pattern});
 // A separately legal counterfactual allocation pays Center before the same
 // original hanging S. Its higher Left is not a preference claim.
 const prefix=[...advice().continuation.slice(0,3).map(p=>p.witness),['L','L','L','CW','L','HD'],['L','L','HD']];
 for(const witness of prefix)for(const action of witness){const before=state;state=R.move(state,action);history=RH.applyAction(history,before,action,state);if(action==='HD')pattern=P.updatePatternHistory(pattern,before,state,state.lastEvent);}
 const origin=state,o=live(),witnesses=[['R','R180','HD'],['HOLD','L','L','CCW','HD']];let virtual=state;const steps=witnesses.map(witness=>{const r=R.replay(virtual,witness);assert(r.valid);virtual=r.state;return{target:r.events[0].target,witness,event:r.events[0],hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};});steps[1].structuralEvidence={hangingSAccommodation:{pieceId:27,piece:'S',cells:steps[1].event.cells}};
 const given={...steps[0],continuation:steps,context:JSON.stringify([state.rules,state.board,state.hold,state.canHold,state.queue,state.bag??null,state.active.type]),evidence:{cycleDebt:0}},a=P.revalidate(state,given,o);assert(a);
 for(const action of a.witness){const before=state;state=R.move(state,action);history=RH.applyAction(history,before,action,state);if(action==='HD')pattern=P.updatePatternHistory(pattern,before,state,state.lastEvent);}
 assert.equal(RH.resolve(state,history).center.pending.length,0);const retained=P.continueCommitment(origin,state,a,state.lastEvent,live());assert(retained);assert.equal(retained.continuation.length,1);assert.equal(retained.target.type,'S');assert(P.resourceGoal(retained.continuation));assert(P.revalidate(state,retained,live()));
});
for(const reveal of [false,true])test('checked I / every fresh production Worker retains original S and both J jobs '+(reveal?'with actual reveals':'without new reveals'),()=>{
 let state=root(),history=RH.importContext(state,fixture.options.resourceContext),pattern=clone(fixture.options.patternHistory),commitment=null,original=null;const E=require('../scripts/lib/st-simulation.cjs'),B=require('../st-bag');
 const live=()=>({...fixture.options,resourceContext:RH.exportContext(state,history),patternHistory:pattern,depth:3,width:8,maxNodes:45000,timeMs:1500});
 // These original player-session draws are controller inputs only after each
 // actual lock. They are never present early in a Worker request.
 const reveals=['T','S','Z','L','O','J'];
 for(let index=0;index<6;index++){
  const a=E.workerPlanner()(clone({type:'plan',id:250+index,observation:state,previous:null,commitment,options:live()}));assert(a.target);assert.equal(a.recommendation.kind,'supported');assert(a.metrics.nodes<=45000);original??=clone(a.continuation);assert.deepEqual(a.continuation[0].event,original[index].event);
  const beforeLock=state;let moving=a;for(const action of a.witness){const before=state;state=R.move(state,action);if(action==='HD'&&reveal)state={...state,queue:[...state.queue,reveals[index]],bag:B.consume(state.bag,reveals[index])};history=RH.applyAction(history,before,action,state);if(action==='HD')pattern=P.updatePatternHistory(pattern,before,state,state.lastEvent);else{moving=P.advance(state,moving,action,{patternHistory:pattern,openingPhase:false,resourceContext:RH.exportContext(state,history)});assert(moving);assert(moving.metrics.revalidationNodes<=12000);}}
  const next=P.continueCommitment(beforeLock,state,a,state.lastEvent,{patternHistory:pattern,resourceContext:RH.exportContext(state,history)});if(next)assert(next.metrics.revalidationNodes<=12000);commitment=next?{observation:P.observe(state),advice:next}:null;if(index<5)assert(commitment);else assert.equal(commitment,null);
 }
 const summary=RH.resolve(state,history);assert(summary.center.closed.some(p=>p.rootId===20&&p.partnerId===31&&p.status==='fulfilled'));assert.equal(summary.center.pending.length,0);assert.equal(summary.hangingS.evidence.length,0);
});
