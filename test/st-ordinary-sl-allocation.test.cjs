'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),M=require('../st-obligation-resources'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),H=require('../st-pattern-history');
const fixture=require('./fixtures/ordinary-sl-allocation.json'),clone=x=>JSON.parse(JSON.stringify(x));
// Isolate the optional SL comparator and its saved-goal lifecycle from the
// preceding contour lane; fresh contour selection has separate integration tests.
const bounds={disableContourRoutes:true,depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity},opts=(extra={})=>({...fixture.options,...bounds,disableVisibleSLTail:true,...extra});
const current=()=>Current.importState(fixture.options.obligationContext,{position:fixture.observation});
const sum=()=>CurrentProvider.facts(CurrentProvider.prepare(fixture.observation,{obligationContext:Current.exportState(Current.importState(fixture.options.obligationContext,{position:fixture.observation}))}));
const cache=new Map(),plan=(off=false)=>{if(!cache.has(off))cache.set(off,P.plan(fixture.observation,opts({disableOrdinarySAllocation:off})));return clone(cache.get(off));};
function moduleWith(replacements){const module={exports:{}},requireAt=require('node:module').createRequire(require.resolve('../st-planner'));vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,exports:module.exports,require:n=>replacements[n]||requireAt(n),Date,performance,globalThis:{}});return module.exports;}
function replaySteps(steps){let state=P.observe(fixture.observation),notches=H.resolve(state,fixture.options.patternHistory),resource=M.start(state,current()),allocation;
 const path=steps.map(step=>{const r=R.replay(state,step.witness);assert(r.valid);assert.deepEqual(r.events,[step.event]);const p={...clone(step),state:r.state},next=M.step(state,p,resource);allocation=P.slAllocationStep(state,p,resource,next,notches,allocation);const phase=S.advanceNotches(state.board,p,notches);assert(phase.valid);state=r.state;notches=phase.pattern;resource=next;return p;});return{path,state,resource,allocation};}
function node(advice,details){const r=replaySteps(advice.continuation);return{path:r.path,state:r.state,resources:r.resource,slAllocation:r.allocation,assessment:clone(advice.assessment),rank:clone(advice.evidence.structuralRank),structuralScore:advice.evidence.structuralScore,centerContinuity:details.centerContinuity,dependencyDebt:details.dependencyDebt,entryDebt:details.entryDebt,notchValid:true,qualified:true,continuationChecked:true,cycleDebt:0,centerDebt:[],cavityDebt:[],key:'unit-comparison'};}
function pair(){const a=plan(),m=a.metrics.ordinarySAllocation;assert(m?.selected);const c=node(a,m.comparison.candidate),r=node(m.referenceAdmission,m.comparison.reference);return{a,m,c,r,options:{candidateDraw:P.publicDrawHorizon(fixture.observation,c.path,sum()),referenceDraw:P.publicDrawHorizon(fixture.observation,r.path,sum()),initialResources:M.start(fixture.observation,current()),original:{path:replaySteps(plan(true).continuation).path}}};}
const noMetrics=a=>clone({...a,metrics:undefined});

test('ordinary SL allocation: exact human five-lock route is certified under candidate history without hidden refill',()=>{
 const r=replaySteps(fixture.humanSteps),first=r.path[0],advice={target:first.event.target,witness:first.witness,hold:true,holdCount:1,context:JSON.stringify([fixture.observation.rules,fixture.observation.board,fixture.observation.hold,fixture.observation.canHold,fixture.observation.queue,fixture.observation.bag??null,fixture.observation.active.type]),continuation:r.path,evidence:{cycleDebt:0},assessment:P.assess(r.state.board),metrics:{nodes:0}};
 // Supply actual structural facts only for presentation; revalidate independently
 // replays the route, not these caller descriptions, for policy authority.
 let state=P.observe(fixture.observation),notches=H.resolve(state,fixture.options.patternHistory);for(const p of r.path){const phase=S.advanceNotches(state.board,p,notches);p.structuralEvidence=S.transition(state,p,S.assess(p.state,{notches:phase.pattern}),{notches});state=p.state;notches=phase.pattern;}
 const valid=P.revalidate(fixture.observation,advice,opts());assert(valid);assert.equal(valid.metrics.certifiedHorizon,5);assert.deepEqual(r.state.queue,['T']);assert.equal(r.state.active.type,'O');assert.equal(r.state.hold,'I');assert.equal(r.resource.pendingCenter.length,0);assert.equal(r.allocation.paid.length,1);assert.equal(r.allocation.paid[0].sBag,null);
});
test('ordinary SL allocation: J/O root chooses a fully paid visible SL allocation over spending S Left',()=>{
 const a=plan(),off=plan(true),m=a.metrics.ordinarySAllocation;assert(m?.selected);assert.equal(m.reason,'preferred-complete-SL-allocation');assert.equal(fixture.observation.active.type,'J');assert.equal(fixture.observation.hold,'O');assert.equal(off.target.type,'J');assert(['O','J'].includes(a.target.type));
 assert.deepEqual(a.continuation.slice(0,2).map(p=>p.event.type).sort(),['J','O']);assert.deepEqual(a.continuation.slice(2).map(p=>p.event.type),['T','S','L']);assert.deepEqual(a.continuation.filter(p=>p.event.lines).map(p=>[p.event.type,p.event.spin,p.event.lines]),[['T','full',2]]);assert.equal(m.comparison.candidate.schedule.tsds[0],3);assert.equal(m.comparison.reference.schedule.tsds[0],3);
 assert.equal(m.comparison.allocation.candidate.paid.length,1);assert.equal(m.comparison.allocation.reference.paid.length,0);assert.equal(m.comparison.allocation.reference.left.length,1);assert(Number.isFinite(m.comparison.candidate.leftScore));assert(a.metrics.nodes<=45000);assert.equal(a.metrics.completedBeamDepth,off.metrics.completedBeamDepth);assert(P.revalidate(fixture.observation,a,opts()));
});
test('ordinary SL comparator: identical supply, paid pair and fewer Left S required; interchangeable S order is neutral',()=>{
 const {c,r,options}=pair();assert(P.ordinarySAllocationComparison(c,r,options).allowed);const lowerTier=clone(c);lowerTier.assessment.leftContext.score=r.assessment.leftContext.score-1;assert(P.ordinarySAllocationComparison(lowerTier,r,options).allowed,'minor tier is below actual allocation preference');
 const changed=clone(options);changed.candidateDraw.hold.id++;assert.equal(P.ordinarySAllocationComparison(c,r,changed).reason,'unequal-observed-allocation-inventory');
 const pending=clone(c);pending.slAllocation.paid=[];assert.equal(P.ordinarySAllocationComparison(pending,r,options).allowed,false);
 const duplicate=clone(c);duplicate.slAllocation.paid.push(clone(duplicate.slAllocation.paid[0]));assert.equal(P.ordinarySAllocationComparison(duplicate,r,options).reason,'unknown-or-duplicated-SL-allocation');
 // Isolated comparison controls, not invented physical witnesses. Equal counts
 // with swapped S identities cannot earn a preference when both already paid SL.
 const equivalent=clone(r);equivalent.slAllocation.paid=[{sId:999,lId:998}];equivalent.slAllocation.left=[{sId:c.slAllocation.paid[0].sId,confirmedHanging:false}];const swapped=clone(c);swapped.slAllocation.left=[{sId:999,confirmedHanging:false}];assert.equal(P.ordinarySAllocationComparison(swapped,equivalent,options).allowed,false);
 const accommodation=clone(r);accommodation.slAllocation.left.forEach(s=>s.confirmedHanging=true);assert.equal(P.ordinarySAllocationComparison(c,accommodation,options).allowed,false);
});
test('ordinary SL comparator: score timing, support, debt and complete proof remain stronger than Center preference',()=>{
 const {c,r,options}=pair();for(const mutate of [n=>n.assessment.structure.left.covered++,n=>n.assessment.leftSealed++,n=>n.assessment.maxHeight=r.assessment.maxHeight+1,n=>n.entryDebt++,n=>n.centerContinuity--,n=>n.continuationChecked=false]){const bad=clone(c);mutate(bad);assert.equal(P.ordinarySAllocationComparison(bad,r,options).allowed,false);}
 const delayed=clone(c);[delayed.path[2],delayed.path[3]]=[delayed.path[3],delayed.path[2]];assert.equal(P.ordinarySAllocationComparison(delayed,r,options).reason,'score-or-original-goal-regression');
});
test('ordinary SL payment tracking: unknown bags and visible cross-bag L stay distinct from guessed future authority',()=>{
 const a=plan(),steps=replaySteps(a.continuation).path;let state=P.observe(fixture.observation),res=M.start(state,current()),notches=H.resolve(state,fixture.options.patternHistory),allocation;
 // Explicit trusted projection fixture supplies coherent cross-bag facts,
 // not a claimed natural history or a mutation of an authenticated view.
 const projection=clone(res.route.projection);projection.supply.originKnown=true;projection.supply.frontier={bag:5,seenMask:0};
 for(const piece of [projection.supply.active,projection.supply.hold,...projection.supply.queue].filter(Boolean)){piece.bag=piece.type==='S'?3:piece.type==='L'?4:2;piece.observedOrder=piece.id-1;}
 res=M.fromProjection(projection,{openingBoundary:{firstBagLocks:7,sourcePatternSeen:false},extendForced:false});
 for(const p of steps){const next=M.step(state,p,res);allocation=P.slAllocationStep(state,p,res,next,notches,allocation);notches=S.advanceNotches(state.board,p,notches).pattern;state=p.state;res=next;}
 assert.equal(allocation.paid.length,1);assert.equal(allocation.paid[0].sBag,3);assert.equal(allocation.paid[0].lBag,4);
 const fake={...clone(steps.at(-1)),structuralEvidence:{slPayment:{sId:1,lId:2}}};const unchanged=P.slAllocationStep(state,fake,{...res,pendingCenter:[]},res,notches);assert.equal(unchanged.paid.length,0);
});
test('ordinary SL unavailable L and incomplete optional proof retain a certified ordinary choice',()=>{
 const baseline=plan(true);let clock=0,calls=0;const api=moduleWith({'./st-obligation-resources.js':{...require('../st-obligation-resources'),repair:(state,res,options)=>{if(options.acceptStep){calls++;clock=1500;return{valid:null,visited:19,status:'resource-repair-budget'};}return require('../st-obligation-resources').repair(state,res,options);}}});
 const result=api.plan(fixture.observation,opts({now:()=>clock,deadline:1500}));assert(calls);assert.equal(result.metrics.ordinarySAllocation.selected,false);assert.deepEqual(noMetrics(result),noMetrics(baseline));assert(result.metrics.nodes<=45000);
 const state=clone(fixture.observation);state.queue=state.queue.map(t=>t==='L'?'O':t);state.bag=null;const history=Current.start(state);const missing=P.plan(state,opts({obligationContext:Current.exportState(history),patternHistory:H.start(state)}));assert.notEqual(missing.metrics.ordinarySAllocation?.selected,true);
});
test('ordinary SL lifecycle: real HOLD/movement and fresh replanning preserve the paid SL goal through TSD',()=>{
 let state=clone(fixture.observation),history=Current.importState(fixture.options.obligationContext,{position:state}),patterns=clone(fixture.options.patternHistory),advice=plan();const expected=advice.continuation.map(p=>p.event);let locks=0,holds=0;
 while(advice){const before=clone(state),original=advice;for(const action of original.witness){const prior=state;state=R.move(state,action);history=Current.applyActual(history,{before:prior,action:action,after:state}).context;const options={...bounds,openingPhase:false,patternHistory:patterns,obligationContext:Current.exportState(history)};
  if(action==='HD'){assert.deepEqual(state.lastEvent,expected[locks]);locks++;patterns=H.update(patterns,prior,state,state.lastEvent);advice=P.continueCommitment(before,state,original,state.lastEvent,{...options,patternHistory:patterns});if(locks<expected.length)assert(advice,'lost SL suffix after lock '+locks);
   if(locks===3){assert.equal(state.lastEvent.lines,2);const fresh=P.plan(state,{...options,patternHistory:patterns,commitment:{observation:clone(state),advice:clone(advice)}});assert(fresh.target);let current=P.observe(state),notches=H.resolve(state,patterns),res=M.start(state,history),allocation;for(const p of fresh.continuation){const r=R.replay(current,p.witness);assert(r.valid);const step={...p,state:r.state},next=M.step(current,step,res);allocation=P.slAllocationStep(current,step,res,next,notches,allocation);notches=S.advanceNotches(current.board,step,notches).pattern;current=r.state;res=next;}assert.equal(allocation.paid.length,1,'fresh ordinary path cannot replace promised SL by an unrelated LO');}
  }else{if(action==='HOLD')holds++;advice=P.advance(state,advice,action,options);assert(advice,'lost ordinary SL route during '+action);}
 }}assert.equal(locks,5);assert(holds);assert.equal(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)})).center.pending.length,0);
});
test('ordinary SL copied payment telemetry never supplies retained authority',()=>{
 const baseline=plan(true),saved={observation:clone(fixture.observation),advice:clone(baseline)};
 const original=P.plan(fixture.observation,opts({commitment:clone(saved)}));saved.advice.slAllocation={paid:[{sId:20,lId:22}],left:[]};saved.advice.evidence.ordinarySAllocation={selected:true,paid:[{sId:20,lId:22}]};for(const p of saved.advice.continuation)p.structuralEvidence.slPayment={sId:20,lId:22};
 const forged=P.plan(fixture.observation,opts({commitment:saved}));assert.deepEqual(noMetrics(forged),noMetrics(original));
});
test('ordinary SL precedence: existing selected root-S preference keeps its exact reference decision',()=>{
 const q=require('./fixtures/sl-full-allocation.json').equal,on=P.plan(q.observation,{...q.options,...bounds}),off=P.plan(q.observation,{...q.options,...bounds,disableOrdinarySAllocation:true});assert.equal(on.metrics.supportedSLPreference.selected,true);assert.equal(on.metrics.ordinarySAllocation,undefined);assert.deepEqual(noMetrics(on),noMetrics(off));
});
