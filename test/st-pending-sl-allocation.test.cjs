'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),M=require('../st-midgame-resources'),RH=require('../st-resource-history'),H=require('../st-pattern-history'),B=require('../st-bag'),LC=require('../st-left-context');
const fixture=require('./fixtures/pending-sl-allocation.json'),clone=x=>JSON.parse(JSON.stringify(x));
// Node-only clocks are a unit seam, not production timing or policy-quality evidence.
const bounds={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity},opts=extra=>({...fixture.options,...bounds,...extra});
const sum=()=>RH.resolve(fixture.observation,RH.importContext(fixture.observation,fixture.options.resourceContext));
const cache=new Map(),plan=(off=false)=>{if(!cache.has(off))cache.set(off,P.plan(fixture.observation,opts({disablePendingSLAllocation:off})));return clone(cache.get(off));};
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]),noMetrics=a=>clone({...a,metrics:undefined});
function moduleWith(replacements){const module={exports:{}},req=require('node:module').createRequire(require.resolve('../st-planner'));vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,exports:module.exports,require:n=>replacements[n]||req(n),Date,performance,globalThis:{}});return module.exports;}
function replay(steps){let state=P.observe(fixture.observation),resources=M.start(state,sum()),notches=H.resolve(state,fixture.options.patternHistory),slAllocation,centerDebt=[],cavityDebt=[];
 const route=steps.map(step=>{const before=state,r=R.replay(state,step.witness);assert(r.valid);assert.deepEqual(r.events,[step.event]);const p={...clone(step),state:r.state,target:r.events[0].target,hold:step.witness.includes('HOLD'),holdCount:step.witness.filter(a=>a==='HOLD').length},phase=S.advanceNotches(state.board,p,notches);assert(phase.valid);
  const reservation=P.centerReservationStep(state,p,centerDebt,notches);centerDebt=reservation.debt;cavityDebt=P.cavityRepairDebt(P.assess(before.board),P.assess(r.state.board),p.event,cavityDebt);p.structuralEvidence={...clone(step.structuralEvidence??{}),...S.transition(state,p,S.assess(r.state,{notches:phase.pattern}),{notches}),centerReservation:reservation,cavityRepair:{status:cavityDebt.length?'requires-executed-repair':'no-outstanding-new-internal-cavity',cells:clone(cavityDebt)}};
  const next=M.step(before,p,resources);slAllocation=P.slAllocationStep(before,p,resources,next,notches,slAllocation);state=r.state;resources=next;notches=phase.pattern;return p;});return{path:route,state,resources,notches,slAllocation,centerDebt,cavityDebt};
}
function fixedAdvice(steps=fixture.goalLastSteps){const r=replay(steps),first=r.path[0];return{...r,advice:{status:'regression-fixed-witness',revision:fixture.observation.revision,target:first.target,witness:first.witness,hold:first.hold,holdCount:first.holdCount,context:context(fixture.observation),continuation:r.path,assessment:P.assess(r.state.board),evidence:{cycleDebt:0},metrics:{nodes:0}}};}
function node(advice,facts){const r=replay(advice.continuation);return{...r,assessment:clone(advice.assessment),rank:clone(advice.evidence.structuralRank),structuralScore:advice.evidence.structuralScore,centerContinuity:facts.centerContinuity,dependencyDebt:facts.dependencyDebt,entryDebt:facts.entryDebt,ordinarySAllocationEnabled:true,notchValid:true,qualified:true,continuationChecked:true,cycleDebt:0,cavityDebt:r.cavityDebt,key:'pending-SL-comparison'};}
function pair(){const a=plan(),m=a.metrics.pendingSLAllocation;assert(m?.selected,JSON.stringify(m));const c=node(a,m.comparison.candidate),r=node(m.referenceAdmission,m.comparison.reference),old=replay(plan(true).continuation);return{a,m,c,r,options:{candidateDraw:P.publicDrawHorizon(fixture.observation,c.path,sum()),referenceDraw:P.publicDrawHorizon(fixture.observation,r.path,sum()),initialResources:M.start(fixture.observation,sum()),original:{path:old.path,slAllocation:old.slAllocation,ordinarySAllocationEnabled:true}}};}
function freshWorker(q){const messages=[],realm={Date:class extends Date{static now(){return 0;}},performance,self:{postMessage:m=>messages.push(clone(m))}};vm.createContext(realm);realm.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),realm,{filename:file});};vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),realm);realm.self.onmessage({data:clone(q)});assert.equal(messages.length,1);assert.equal(messages[0].type,'result',JSON.stringify(messages[0]));return messages[0].result;}

// A fresh worker may satisfy an existing Center goal after other ordinary
// work. With the earlier TSD already executed, there is no unfulfilled score
// timing promise that pins L to the next lock. Validate the exact original
// reservation, not a count or a copied completed-goal annotation.
function verifyFreshGoal(raw,fresh,saved,history,patterns,record){
 const summary=RH.resolve(raw,history),options={...bounds,openingPhase:false,patternHistory:patterns,resourceContext:RH.exportContext(raw,history)};assert(P.revalidate(raw,fresh,options));assert(M.checkPath(raw,fresh.continuation,summary).valid);
 let proofState=P.observe(raw),resource=M.start(raw,summary),phase=H.resolve(raw,patterns),allocation;const placed=[];let paymentAt=null;
 for(const [index,p]of fresh.continuation.entries()){const before=proofState,r=R.replay(before,p.witness);assert(r.valid);assert.deepEqual(r.events,[p.event]);const step={...p,state:r.state},next=M.step(before,step,resource),advanced=S.advanceNotches(before.board,step,phase);assert(advanced.valid);assert.deepEqual(S.transition(before,step,S.assess(r.state,{notches:advanced.pattern}),{notches:phase}).cycleViolations,[]);placed.push(P.placedResource(resource,p.witness).id);allocation=P.slAllocationStep(before,step,resource,next,phase,allocation);if(allocation.paid.some(pair=>pair.sId===36&&pair.lId===40)&&paymentAt===null){paymentAt=index+1;assert.deepEqual(p.event.cells,fixture.expected.completionCells);}resource=next;proofState=r.state;phase=advanced.pattern;}
 assert.deepEqual(allocation.paid.map(p=>[p.sId,p.lId]),[[36,40]]);assert.deepEqual(P.scoringSchedule(saved.continuation),{tsds:[],quads:[]});assert(P.scoringReplacement({path:fresh.continuation},{path:saved.continuation},{path:saved.continuation}).allowed);assert.equal(P.resourceGoalPrefix(fresh.continuation,saved.continuation),paymentAt);const oldFirst=R.replay(raw,['L','L','L','HD']);assert(oldFirst.valid);assert.equal(oldFirst.events[0].type,'S');assert.equal(P.dPatternAdmission(raw,{state:oldFirst.state,event:oldFirst.events[0],witness:['L','L','L','HD']},{now:()=>0,deadline:Infinity,maxNodes:8000}).reason,'D-created-without-immediate-J','the former piece43-first branch is now independently forbidden, not merely ranked lower');assert.equal(paymentAt,1,'this fixture pays L first because its old S-first branch creates unsupported D, not a general immediate-L policy');assert.deepEqual(placed.slice(0,paymentAt),[40]);record.fullRoute={placed,paid:clone(allocation.paid),paymentAt,events:fresh.continuation.map(p=>clone(p.event)),resourceValid:true,revalidated:true};
 let state=P.observe(raw),branchHistory=RH.importContext(state,RH.exportContext(raw,history)),branchPatterns=clone(patterns),advice=clone(fresh),paid=[];
 for(let lock=0;lock<paymentAt;lock++){assert(advice);const before=clone(state),original=clone(advice),beforeResource=M.start(state,RH.resolve(state,branchHistory));
  for(const action of original.witness){const prior=state;state=R.move(state,action);assert.notEqual(state,prior);let revealed=[];if(action==='HD'){const type=B.possibilities(state.bag)[0];revealed=[type];state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};assert.deepEqual(B.validate(state.bag),[]);}branchHistory=RH.applyAction(branchHistory,prior,action,state);record.actions.push({action,prior:P.observe(prior),observation:P.observe(state),revealed});assert.equal(RH.resolve(state,branchHistory).coverage.status,'partial');const nextOptions={...bounds,openingPhase:false,patternHistory:branchPatterns,resourceContext:RH.exportContext(state,branchHistory)};
   if(action==='HD'){assert.deepEqual(state.lastEvent,original.continuation[0].event);const actual=R.replay(before,original.witness),step={...original.continuation[0],state:actual.state},nextResource=M.step(before,step,beforeResource),actualPayment=P.slAllocationStep(before,step,beforeResource,nextResource,H.resolve(before,branchPatterns));paid.push(...actualPayment.paid);branchPatterns=H.update(branchPatterns,prior,state,state.lastEvent);advice=P.continueCommitment(before,state,original,state.lastEvent,{...nextOptions,patternHistory:branchPatterns});record.postLocks.push({lock:lock+1,observation:P.observe(state),resourceContext:RH.exportContext(state,branchHistory),patternHistory:clone(branchPatterns),commitment:advice?{observation:P.observe(state),advice:clone(advice)}:null});if(lock+1<paymentAt)assert(advice,'fresh actual branch lost the original pending Center goal');}
   else{advice=P.advance(state,advice,action,nextOptions);assert(advice,'fresh actual branch lost target during '+action);}
  }
 }
 assert.deepEqual(paid.map(p=>[p.sId,p.lId]),[[36,40]]);const end=RH.resolve(state,branchHistory);assert(!end.center.pending.some(p=>p.rootId===36));assert(end.center.closed.some(p=>p.family==='SL'&&p.rootId===36&&p.partnerId===40&&p.status==='fulfilled'));assert.equal(advice,null,'trailing I-Left filler does not acquire new retention authority');record.actualPaid=paid;record.complete=true;
}

test('pending SL fixed certificate: actual goal-last route pays the observed S after its TSD without new retention authority',()=>{
 const r=fixedAdvice(),checked=P.revalidate(fixture.observation,r.advice,opts());assert(checked);assert.equal(checked.metrics.certifiedHorizon,5);assert.equal(P.resourceGoalPrefix(r.path,r.path),5);assert.equal(P.resourceGoal(r.path),true);assert.deepEqual(r.centerDebt,[]);assert.deepEqual(r.path.flatMap(p=>p.structuralEvidence.cycleViolations),[]);assert(M.checkPath(fixture.observation,r.path,sum()).valid);
 assert.equal(sum().coverage.status,'partial');assert.equal(sum().extraZ.status,'unknown');assert.deepEqual(r.state.board,fixture.expected.goalLastBoard);assert.deepEqual(P.scoringSchedule(r.path).tsds,[4]);assert.deepEqual(r.path.at(-1).event.cells,fixture.expected.completionCells);assert.deepEqual(r.slAllocation.paid,[{sId:36,sBag:null,lId:40,lBag:null}]);
 const draw=P.publicDrawHorizon(fixture.observation,r.path,sum()),reference=replay(fixture.referenceSteps),rd=P.publicDrawHorizon(fixture.observation,reference.path,sum());assert.deepEqual(draw.placed,fixture.expected.placed);assert.deepEqual(draw.drawn,fixture.expected.drawn);assert.deepEqual({...draw,placed:draw.placed.slice().sort()}, {...rd,placed:rd.placed.slice().sort()});assert.equal(M.binding(r.resources),M.binding(reference.resources));
 const geometry=S.geometry(r.state.board,{notches:r.notches}),assessment=P.assess(r.state.board);assert.deepEqual(geometry.left.profile,fixture.expected.leftProfile);assert.equal(geometry.left.covered,0);assert.equal(assessment.covered,1,'the supported Center cover is not a whole-board zero-hole claim');assert.equal(LC.evaluate(r.state,{heights:assessment.heights.slice(0,4),covered:geometry.left.covered,resources:r.resources,center:geometry.center,right:geometry.right}).score,5);
});

test('pending SL discovery: generic bounded surroundings improve realized Left at the same final identity horizon',()=>{
 const {a,m,c,r,options}=pair(),off=plan(true);assert.equal(off.continuation.length,3);assert.equal(a.continuation.length,5);assert.equal(a.continuation.at(-1).event.type,'L');assert.equal(P.resourceGoalPrefix(c.path,c.path),5);assert(m.comparison.candidate.leftScore>m.comparison.reference.leftScore);assert.deepEqual(P.scoringSchedule(c.path),P.scoringSchedule(r.path));assert.deepEqual(P.scoringSchedule(c.path).tsds,[4]);
 assert.deepEqual(m.incumbentAdmission.continuation,off.continuation);assert.equal(a.metrics.completedBeamDepth,off.metrics.completedBeamDepth);assert(a.metrics.nodes<=45000);assert(m.nodes<=18000);assert(P.revalidate(fixture.observation,a,opts()));assert.equal(M.binding(c.resources),M.binding(r.resources));assert.equal(P.pendingSLAllocationComparison(c,r,options).allowed,true);
 assert.deepEqual(c.slAllocation.paid.map(p=>[p.sId,p.lId]),[[36,40]]);assert.deepEqual(options.candidateDraw.drawn,options.referenceDraw.drawn);assert.deepEqual(options.candidateDraw.placed.slice().sort(),options.referenceDraw.placed.slice().sort());assert.deepEqual([options.candidateDraw.active.id,options.candidateDraw.hold.id,options.candidateDraw.queue.map(p=>p.id)],[44,43,[45]]);
 const cd=P.publicDrawHorizon(fixture.observation,c.path.slice(0,3),sum()),rd=P.publicDrawHorizon(fixture.observation,r.path.slice(0,3),sum());assert.notDeepEqual(cd.placed.slice().sort(),rd.placed.slice().sort(),'matching only the interim inventory would erase this allocation comparison');
});

test('pending SL comparator: actual identities, original pending pair and unchanged accounting cannot be substituted',()=>{
 const {c,r,options}=pair();
 for(const mutate of [o=>o.candidateDraw.placed[0]=999,o=>o.candidateDraw.drawn[0]=999,o=>o.candidateDraw.draws++,o=>o.candidateDraw.active.id++,o=>o.candidateDraw.hold.id++,o=>o.candidateDraw.queue[0].id++,o=>o.candidateDraw=null,o=>o.initialResources.pendingCenter=[],o=>o.initialResources.pendingCenter[0].rootId++,o=>o.initialResources.queue.find(p=>p.type==='L').id=-1]){const changed=clone(options);mutate(changed);assert.equal(P.pendingSLAllocationComparison(c,r,changed).allowed,false);}
 for(const mutate of [n=>n.slAllocation.paid=[],n=>n.slAllocation.paid[0].sId++,n=>n.slAllocation.paid[0].lId++,n=>n.slAllocation.paid.push(clone(n.slAllocation.paid[0])),n=>n.resources.extraZ='available',n=>n.resources.scoredTs=[999],n=>n.resources.pendingCenter=[clone(options.initialResources.pendingCenter[0])]]){const bad=clone(c);mutate(bad);assert.equal(P.pendingSLAllocationComparison(bad,r,options).allowed,false);}
 // Matching final bindings do not excuse a new obligation on BOTH arms.
 for(const key of ['hangingS','hangingL','unclassifiedS','unclassifiedL']){const a=clone(c),b=clone(r),debt={id:999,sId:999,lId:999,bag:null,requiresAccommodation:true};a.resources[key].push(clone(debt));b.resources[key].push(clone(debt));assert.equal(M.binding(a.resources),M.binding(b.resources));assert.equal(P.pendingSLAllocationComparison(a,b,options).reason,'new-pending-SL-resource-obligation');}
});

test('pending SL comparator: actual scoring timing, cleanup, structural bands and full certification remain vetoes',()=>{
 const {c,r,options}=pair();for(const mutate of [n=>n.assessment.leftContext.score=r.assessment.leftContext.score,n=>n.assessment.structure.left.covered++,n=>n.assessment.leftSealed++,n=>n.assessment.sealed++,n=>n.assessment.damageSealed++,n=>n.assessment.maxHeight=r.assessment.maxHeight+1,n=>n.centerContinuity--,n=>n.dependencyDebt++,n=>n.entryDebt++,n=>n.rank[3]=r.rank[3]-1,n=>n.continuationChecked=false,n=>n.qualified=false,n=>n.cavityDebt.push([0,39]),n=>n.notchValid=false,n=>n.cycleDebt++]){const bad=clone(c);mutate(bad);assert.equal(P.pendingSLAllocationComparison(bad,r,options).allowed,false);}
 const delayed=clone(c);[delayed.path[3],delayed.path[4]]=[delayed.path[4],delayed.path[3]];assert.equal(P.pendingSLAllocationComparison(delayed,r,options).allowed,false);
 // Deliberate comparator-only mutations isolate protected-goal boundaries;
 // they are not represented as authentic movement/resource certificates.
 const cleanup=clone(r);cleanup.path[0].event={type:'I',lines:4,spin:'none',cells:[]};assert.equal(P.pendingSLAllocationComparison(c,cleanup,options).allowed,false);
 const prepared=clone(r);prepared.path[0].event={type:'I',lines:0,spin:'none',cells:[[8,39]]};prepared.path[0].structuralEvidence.allocation='quad-preparation';assert.equal(P.pendingSLAllocationComparison(c,prepared,options).allowed,false);
});

test('pending SL does not turn trailing ordinary filler into a protected resource goal',()=>{
 const {c,r,options}=pair(),trailing={...clone(c),...replay(fixture.trailingFillerSteps)};assert.equal(P.resourceGoalPrefix(trailing.path,trailing.path),4);assert.equal(P.visibleSLTailComparison(trailing,r,{...options,candidateDraw:P.publicDrawHorizon(fixture.observation,trailing.path,sum())}).reason,'tail-not-retained-by-resource-goal');assert.equal(P.pendingSLAllocationComparison(trailing,r,options).allowed,false);
});

test('pending SL eligibility: unknown observed origin, invalid history, opening and no-HOLD are not authority',()=>{
 const unknown=RH.start(fixture.observation),freshOptions={...opts(),resourceContext:RH.exportContext(fixture.observation,unknown)};assert.equal(RH.resolve(fixture.observation,unknown).center.pending[0].rootId,null);assert.notEqual(P.plan(fixture.observation,freshOptions).metrics.pendingSLAllocation?.selected,true);
 const broken=clone(fixture.options.resourceContext);broken.steps.pop();assert.notEqual(P.plan(fixture.observation,opts({resourceContext:broken})).metrics.pendingSLAllocation?.selected,true);
 for(const extra of [{openingPhase:true},{allowHold:false}])assert.notEqual(P.plan(fixture.observation,opts(extra)).metrics.pendingSLAllocation?.selected,true);
 const saved=plan(true),retained=P.plan(fixture.observation,opts({commitment:{observation:clone(fixture.observation),advice:saved}}));assert.notEqual(retained.metrics.pendingSLAllocation?.attempted,true);
});

test('pending SL interrupted optional extension retains the exact private certified incumbent',()=>{
 const off=plan(true);let clock=0,interrupted=0;const api=moduleWith({'./st-rules.js':{...R,placements:(state,options)=>{if(state.queue.length===3&&state.active?.type==='T'&&['L','O'].includes(state.hold)){clock=1500;interrupted++;return{placements:[],visited:19,complete:false};}return R.placements(state,options);}}});
 const a=api.plan(fixture.observation,opts({now:()=>clock,deadline:1500}));assert(interrupted);assert.equal(a.metrics.pendingSLAllocation.selected,false);assert.deepEqual(noMetrics(a),noMetrics(off));assert(a.metrics.nodes<=45000);assert(a.metrics.pendingSLAllocation.nodes>=19);
});

test('pending SL failed strongest final certificate cannot choose a weaker endpoint or erase the incumbent',()=>{
 const off=plan(true);let rejected=0;const api=moduleWith({'./st-midgame-resources.js':{...M,checkPath:(raw,route,summary)=>{if(route.length===5){rejected++;return{valid:false,reason:'test-strongest-terminal-rejected'};}return M.checkPath(raw,route,summary);}}});
 const a=api.plan(fixture.observation,opts());assert.equal(rejected,1,'failure of the selected strongest certificate terminates the optional comparison');assert.equal(a.metrics.pendingSLAllocation.selected,false);assert.deepEqual(noMetrics(a),noMetrics(off));
});

test('pending SL endpoint qualification precedes ranking and unknown is not a weaker reference',()=>{
 const {c}=pair(),before=clone(c),after=clone(c);before.rank[3]=20;after.rank[3]=10;const checked=[];const ordered=P.qualifiedSLTailOrder([before,after],n=>{checked.push(n);if(n===before)n.rank[3]=0;return true;});assert.equal(checked.length,2);assert.equal(ordered[0],after);assert.equal(P.qualifiedSLTailOrder([before,after],n=>n!==after),null);
});

test('pending SL lifecycle: actual HOLD, movement, public refill and fresh worker preserve L after the TSD',()=>{
 const evidence={schemaVersion:1,scope:'Actual selected five-lock route, controller-only synthetic reveals, and fresh production worker at the remaining one-lock Center L goal',initialObservation:clone(fixture.observation),initialOptions:clone(fixture.options),actions:[],postLocks:[],complete:false};const output=process.env.ZZ_PENDING_SL_LIFECYCLE_OUT;if(output){const dest=path.resolve(output),root=path.resolve(__dirname,'..');assert(dest!==root&&!dest.startsWith(root+path.sep),'Lifecycle evidence must remain outside the checkout');assert(!fs.existsSync(dest),'Do not overwrite a prior lifecycle attempt');}
 try{
 let state=clone(fixture.observation),history=RH.importContext(state,fixture.options.resourceContext),patterns=clone(fixture.options.patternHistory),advice=plan(),locks=0,holds=0;const initial=clone(advice);evidence.initialAdvice=clone(advice);const expected=advice.continuation.map(p=>p.event),placed=[];
 // Synthetic legal new reveals are controller-only until each actual HD.
 // They are not the inspected episode's private future and cannot change the
 // original finite proof's already-visible identities or its five-lock endpoint.
 const reveals=['I','J','L','O','S'];
 while(locks<5){assert(advice);const before=clone(state),original=clone(advice),beforeResources=M.start(state,RH.resolve(state,history));placed.push(P.placedResource(beforeResources,original.witness).id);
  for(const action of original.witness){const prior=state;state=R.move(state,action);assert.notEqual(state,prior);if(action==='HD'){const revealed=reveals[locks];state={...state,queue:[...state.queue,revealed],bag:B.consume(state.bag,revealed)};assert.deepEqual(B.validate(state.bag),[]);}history=RH.applyAction(history,prior,action,state);evidence.actions.push({action,prior:P.observe(prior),observation:P.observe(state),revealed:action==='HD'?[reveals[locks]]:[]});assert.equal(RH.resolve(state,history).coverage.status,'partial');
   const options={...bounds,openingPhase:false,patternHistory:patterns,resourceContext:RH.exportContext(state,history)};
   if(action==='HD'){assert.deepEqual(state.lastEvent,expected[locks]);locks++;patterns=H.update(patterns,prior,state,state.lastEvent);advice=P.continueCommitment(before,state,original,state.lastEvent,{...options,patternHistory:patterns});evidence.postLocks.push({lock:locks,observation:P.observe(state),patternHistory:clone(patterns),resourceContext:RH.exportContext(state,history),commitment:advice?{observation:P.observe(state),advice:clone(advice)}:null});if(locks<5)assert(advice,'lost actual goal after lock '+locks);
    if(locks===4){assert.equal(state.lastEvent.lines,2);assert.equal(advice.continuation.length,1);assert.equal(advice.continuation[0].event.type,'L');assert.equal(P.resourceGoalPrefix(advice.continuation,advice.continuation),1);const pending=RH.resolve(state,history).center.pending.find(p=>p.rootId===36);assert(pending);assert.deepEqual(pending.alternatives[0].cells,fixture.expected.completionCells);assert.deepEqual(advice.continuation[0].event.cells,fixture.expected.completionCells);
     const request={type:'plan',id:1,observation:P.observe(state),previous:null,commitment:{observation:P.observe(state),advice:clone(advice)},options:{...fixture.options,depth:3,width:8,maxNodes:45000,timeMs:1500,openingPhase:false,patternHistory:patterns,resourceContext:RH.exportContext(state,history)}};evidence.afterTsdRequest=clone(request);const fresh=freshWorker(request);evidence.afterTsdReply=clone(fresh);assert(fresh.target);assert(fresh.metrics.nodes<=45000);evidence.freshBranch={actions:[],postLocks:[]};verifyFreshGoal(state,fresh,advice,history,patterns,evidence.freshBranch);
     const forged=clone(advice);forged.continuation[0].event.cells[0][1]--;const refreshed=P.revalidate(state,forged,{...options,patternHistory:patterns});assert(refreshed,'revalidation rebuilds the first event from its actual target');assert.deepEqual(refreshed.continuation[0].event.cells,fixture.expected.completionCells);assert.notDeepEqual(refreshed.continuation[0].event.cells,forged.continuation[0].event.cells,'copied event cells never become authority');const unreachable=clone(advice);unreachable.target.x=-20;assert.equal(P.revalidate(state,unreachable,{...options,patternHistory:patterns}),null);
    }
   }else{holds+=Number(action==='HOLD');advice=P.advance(state,advice,action,options);assert(advice,'lost target during '+action);}
  }
 }
 assert(holds);assert.deepEqual(placed.slice().sort(),fixture.expected.placed.slice().sort());assert.equal(placed.at(-1),40);assert.equal(state.active.type,'I');assert.equal(state.hold,'S');assert.deepEqual(state.board,fixture.expected.goalLastBoard);assert.equal(RH.resolve(state,history).center.pending.length,0);assert.equal(RH.resolve(state,history).extraZ.status,'unknown');assert.equal(initial.continuation.length,5);assert.equal(advice,null,'the finite Center goal ends after its actual payment');evidence.complete=true;evidence.finalObservation=P.observe(state);
 }catch(error){evidence.error={name:error.name,message:error.message,stack:error.stack};throw error;}finally{if(output){const dest=path.resolve(output);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});}}
});

test('pending SL grow qualifies every distinct compatible final endpoint before retaining two',()=>{
 const {m}=pair(),finals=m.prefixes.flatMap(p=>p.layers.filter(l=>l.depth===m.horizon).map(l=>({kind:p.kind,...l})));assert(finals.length);assert(finals.some(l=>l.distinct>2),'the authentic bounded reference exposes more endpoints than its retained width');
 for(const layer of finals){assert.equal(layer.qualified,layer.distinct);assert.equal(layer.endpointOrder.length,layer.distinct);assert.equal(layer.retained,Math.min(2,layer.distinct));assert(layer.endpointOrder.every(n=>n.entry?.status!=='unresolved-budget'));}
 const reference=finals.find(l=>l.kind==='exact-incumbent-reference');assert(reference);assert.deepEqual(reference.endpointOrder[0].prefix,m.referencePrefix);assert.deepEqual(m.candidateOrder[0].prefix,m.candidatePrefix);assert.deepEqual(m.referenceOrder[0].prefix,m.referencePrefix);
});

// Synthetic proof-scheduler boundary only, NOT a new authentic T slot/route.
// The imported R functions used by planner assessment see an optimistic slot
// on physically generated final boards. Real R.placements/replay retain their
// original closed-over physics, so this cannot manufacture a movement witness.
// D silhouettes are neutralized ONLY in this synthetic scheduling harness to
// keep its >2 uncached reference-endpoint population fixed. Production D pruning
// otherwise changes query reuse/order, not the all-endpoints invariant below.
function qualificationBoundary(mode){const silhouette=fixture.expected.goalLastBoard.map(row=>row.slice(4)).join(''),referenceBoards=new Set(),finalCache=new WeakMap(),stats={calls:0,referenceCalls:0,budgets:[],firstReference:null};let finalAssessment=false;
 const key=board=>board.join(''),final=board=>{if(finalCache.has(board))return finalCache.get(board);const value=board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0)===48&&board.map(row=>row.slice(4)).join('')===silhouette;finalCache.set(board,value);return value;};
 const synthetic=p=>p?.type==='T'&&p.x===6&&p.y===36&&p.rotation===2;
 const api=moduleWith({'./st-left-context.js':{...LC,createsD:()=>false,isD:()=>false},'./st-rules.js':{...R,
  placements:(state,options)=>{const e=R.placements(state,options);if(state.queue.length===2&&state.active?.type==='S'&&state.hold==='O')for(const p of e.placements)if(p.event.type==='O'&&p.event.cells.every(([x])=>x<4)&&final(p.state.board))referenceBoards.add(key(p.state.board));return e;},
  fits:(board,p)=>{finalAssessment=final(board);if(finalAssessment&&synthetic(p))return true;if(finalAssessment&&p?.type==='T'&&p.x===6&&p.y===37&&p.rotation===2)return false;return R.fits(board,p);},
  spin:(board,p)=>final(board)&&synthetic(p)?'full':R.spin(board,p),
  cells:p=>finalAssessment&&synthetic(p)?[[7,38],[9,38],[7,39],[9,39]]:R.cells(p),
  tDoubleAccess:(board,options)=>{if(!final(board))return R.tDoubleAccess(board,options);stats.calls++;stats.budgets.push(options.maxNodes);assert(options.maxNodes<=18000,'final qualification must use remaining optional cap, not a fresh global budget');if(mode==='unknown')return{complete:false,reachable:null,visited:options.maxNodes};
   const reference=referenceBoards.has(key(board)),failed=reference&&stats.referenceCalls++===0;if(failed)stats.firstReference=key(board);return{complete:true,reachable:!failed,visited:1,witness:[],event:{target:{type:'T',x:6,y:36,rotation:2}}};}
 }});return{api,stats};}

test('pending SL actual grow path reorders final endpoints after their entry qualification changes',()=>{
 const {api,stats}=qualificationBoundary('reorder'),a=api.plan(fixture.observation,opts()),m=a.metrics.pendingSLAllocation;assert(stats.calls>0);assert(stats.referenceCalls>2,'qualify all real reference endpoints, not only a raw top two');const final=m.prefixes.find(p=>p.kind==='exact-incumbent-reference').layers.find(l=>l.depth===m.horizon);assert(final.distinct>2);assert.equal(final.qualified,final.distinct);assert.equal(final.endpointOrder.length,final.distinct);assert.equal(final.retained,2);
 assert.equal(final.endpointOrder[0].entry.status,'reachable-if-T-available');assert(final.endpointOrder.slice(1).some(n=>n.entry.status==='unreachable'),'the initially visited endpoint loses its optimistic structural band before ordering');assert.deepEqual(final.endpointOrder[0].prefix,m.referencePrefix);assert(a.metrics.nodes<=45000);assert(m.nodes<=18000);
});

test('pending SL actual grow qualification exhaustion preserves the incumbent under the shared optional cap',()=>{
 const off=plan(true),{api,stats}=qualificationBoundary('unknown'),a=api.plan(fixture.observation,opts());assert(stats.calls>0);assert.equal(a.metrics.pendingSLAllocation.selected,false);assert.equal(a.metrics.pendingSLAllocation.reason,'candidate-qualification-unknown');assert.deepEqual(noMetrics(a),noMetrics(off));assert(a.metrics.pendingSLAllocation.nodes<=18000);assert(a.metrics.nodes<=45000);assert(stats.budgets.every(n=>n>0&&n<=18000));
});

test('pending SL continuation and final-admission access each receive only the residual optional budget',()=>{
 const off=plan(true),A=require('../st-access');
 for(const stopAt of [1,2]){let calls=0,used=0;const api=moduleWith({'./st-access.js':{...A,prefix:(raw,route,options)=>{if(route.length===5&&++calls===stopAt){used=options.maxNodes;assert(used>0&&used<=18000);return{reachable:null,visited:used,status:'test-optional-access-exhausted'};}return A.prefix(raw,route,options);}}});
  const a=api.plan(fixture.observation,opts());assert.equal(calls,stopAt);assert(used);assert.equal(a.metrics.pendingSLAllocation.selected,false);assert.deepEqual(noMetrics(a),noMetrics(off));assert(a.metrics.pendingSLAllocation.nodes<=18000);assert(a.metrics.nodes<=45000);assert.equal(a.metrics.pendingSLAllocation.nodes,Math.min(18000,45000-(a.metrics.nodes-a.metrics.pendingSLAllocation.nodes)),'the access proof consumes precisely the remaining optional/global allowance');
 }
});

test('a public nodeLimit property cannot enlarge the original global request budget',()=>{
 const bounded=P.plan(fixture.observation,opts({maxNodes:2000})),forged=P.plan(fixture.observation,opts({maxNodes:2000,nodeLimit:1e9}));assert(bounded.metrics.nodes<=2000);assert(forged.metrics.nodes<=2000);assert.deepEqual(noMetrics(forged),noMetrics(bounded));
});

test('pending SL successful final admission is charged against the exact remaining optional node ceiling',()=>{
 const A=require('../st-access'),calls=[],api=moduleWith({'./st-access.js':{...A,prefix:(raw,route,options)=>{const checked=A.prefix(raw,route,options);if(route.length===5)calls.push({maxNodes:options.maxNodes,visited:checked.visited});return checked;}}});const a=api.plan(fixture.observation,opts({nodeLimit:Infinity})),m=a.metrics.pendingSLAllocation;assert(m.selected,JSON.stringify(m));assert(calls.length>=4);const last=calls.at(-1);assert.equal(last.maxNodes,m.nodeLimit-(a.metrics.nodes-last.visited));assert.equal(m.nodeLimit,Math.min(45000,m.startNodes+18000));assert.equal(m.nodes,a.metrics.nodes-m.startNodes);
});

test('pending SL node-only extension exhaustion cannot borrow a fresh 45000-node allowance',()=>{
 const off=plan(true);let stopped=0;const api=moduleWith({'./st-rules.js':{...R,placements:(state,options)=>{if(state.queue.length===3&&state.active?.type==='T'&&['L','O'].includes(state.hold)){stopped++;return{placements:[],visited:options.maxNodes,complete:false};}return R.placements(state,options);}}});const a=api.plan(fixture.observation,opts()),m=a.metrics.pendingSLAllocation;assert(stopped);assert.equal(m.selected,false);assert.equal(m.nodes,m.nodeLimit-m.startNodes);assert.equal(m.nodeLimit,Math.min(45000,m.startNodes+18000));assert(m.nodes<=18000);assert(a.metrics.nodes<=45000);assert.deepEqual(noMetrics(a),noMetrics(off));
});
