'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history');
const fixture=require('./fixtures/opening-z-allocation.json'),clone=x=>JSON.parse(JSON.stringify(x));
// These are the actual public preview suffixes observed after locks 17–21 in
// the retained branch, not generator input or a planner-visible hidden future.
const reveals=['Z','I','S','O','S'];
const bounds={depth:3,width:8,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
function observed(until=20){
 let state=R.createState(fixture.request.observation),history=H.importContext(state,clone(fixture.request.options.resourceContext)),pattern=clone(fixture.request.options.patternHistory);
 let opening={active:true,clear:null,source:null,repair:null};
 function execute(witness,reveal,{handoff=false}={}){
  if(handoff){history=H.markHandoff(history,state);opening={active:false,clear:null,source:null,repair:null};}
  for(const action of witness){const before=state,next=R.move(state,action);assert.notEqual(next,state);state=next;
   if(action==='HD'&&reveal)state={...state,queue:[...state.queue,reveal],bag:B.consume(state.bag,reveal)};
   history=H.applyAction(history,before,action,state);assert.equal(H.resolve(state,history).coverage.status,'complete');
   if(action==='HD'){pattern=P.updatePatternHistory(pattern,before,state,state.lastEvent);opening=P.updateOpeningSession(opening,before,state,state.lastEvent);}
  }
 }
 for(let i=0;i<until-16;i++)execute(fixture.steps[i].witness,reveals[i],{handoff:i===2});
 return{execute,get state(){return state;},get history(){return history;},get summary(){return H.resolve(state,history);},request(id=1){return{type:'plan',id,observation:P.observe(state),previous:null,commitment:null,options:{...fixture.request.options,resourceContext:H.exportContext(state,history),patternHistory:pattern,openingPhase:opening.active,openingClear:opening.clear,openingSource:opening.source,openingRepair:opening.repair}};}};
}
function decide(q,extra={}){return P.decide(q.observation,{...q.options,...bounds,previous:q.previous,commitment:q.commitment,...extra});}
function freshWorker(q){
 const messages=[],context={Date:class extends Date{static now(){return 0;}},performance,self:{postMessage:m=>messages.push(clone(m))}};
 vm.createContext(context);context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),context);context.self.onmessage({data:clone(q)});
 assert.equal(messages.length,1);assert.equal(messages[0].type,'result');assert.equal(messages[0].revision,q.observation.revision);return messages[0].result;
}
function oldGoal(raw,base){
 const witnesses=[['L','L','L','CW','L','HD'],['L','L','HD'],['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']];
 let state=R.createState(raw);const continuation=witnesses.map(witness=>{const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);state=r.state;return{witness,event:r.events[0],target:r.events[0].target,hold:false,holdCount:0};});
 assert.equal(continuation[2].event.type,'T');assert.equal(continuation[2].event.lines,2);assert.equal(continuation[2].event.spin,'full');
 return{...base,target:continuation[0].target,witness:continuation[0].witness,hold:false,holdCount:0,continuation,assessment:P.assess(state.board),evidence:{cycleDebt:0}};
}

test('opening quality priority: fresh worker keeps Right cap and Center completion, then actually accommodates held S',()=>{
 const a=observed(18);assert.equal(a.summary.extraZ.status,'unknown');
 for(const i of [2,3,4]){
  const q=a.request(i),advice=freshWorker(q);assert.deepEqual(advice.target,fixture.steps[i].event.target);assert.ok(advice.metrics.nodes<=45000);assert.equal(advice.evidence.resourceObligations.status,'checked');assert.equal(advice.evidence.gapAccess.reachable,true);
  assert.equal(a.summary.extraZ.status,'unknown','A projected route does not mutate the observed baseline');assert.equal(advice.evidence.structure.openingQuality.baselineGranted,false);
  if(i===4){assert.equal(advice.witness[0],'HOLD');assert.equal(advice.holdCount,1);}
  a.execute(advice.witness,reveals[i],{handoff:advice.phase==='maintenance'&&Boolean(advice.evidence.openingHandoff)});
  assert.deepEqual(a.state.lastEvent,fixture.steps[i].event);
 }
 assert.equal(a.summary.extraZ.status,'available');assert.equal(a.summary.extraZ.baseline.at,21);assert.equal(a.summary.openingAllocation.firstTsdAt,18);assert.equal(a.summary.hangingS.status,'none-observed');assert.equal(a.summary.hangingL.status,'none-observed');assert.equal(a.summary.center.pending.length,0);
});

test('opening quality priority: legal growth remains revalidatable, but same-horizon saved TSD goal prefers resolved quality',()=>{
 const a=observed(),q=a.request(),fresh=decide(q);assert.deepEqual(fresh.target,fixture.steps[4].event.target);
 const old=oldGoal(q.observation,fresh);assert.equal(P.resourceGoal(old.continuation),true);assert.ok(P.revalidate(q.observation,old,{...q.options,...bounds}),'Ranking does not turn the old legal L route into a forbidden action');
 const selected=decide({...q,commitment:{observation:q.observation,advice:old}});assert.deepEqual(selected.target,fixture.steps[4].event.target);assert.ok(selected.metrics.nodes<=45000);
 assert.equal(selected.metrics.commitmentComparison.replacement,true);assert.equal(selected.metrics.commitmentComparison.freshHorizon,3);assert.equal(selected.metrics.commitmentComparison.savedHorizon,3);assert.equal(selected.metrics.commitmentComparison.freshGoalLocks,3);assert.equal(selected.metrics.commitmentComparison.freshSettled,true);assert.equal(selected.metrics.commitmentComparison.savedSettled,true);
 assert.equal(P.resourceGoalPrefix(selected.continuation,old.continuation),3,'The old scoring goal is still paid, not replaced by an earlier S-only prefix');
 const bounded=decide({...q,commitment:{observation:q.observation,advice:old}},{maxNodes:4000});assert.deepEqual(bounded.target,old.target);assert.equal(bounded.metrics.commitmentComparison.replacement,false);assert.ok(bounded.metrics.nodes<=4000);assert.ok(P.resourceGoalPrefix(bounded.continuation,old.continuation)!==null);
 // With 500 nodes, final resource revalidation is unfinished. The old final
 // cleanBest fallback could return a one-lock S while reporting no replacement,
 // silently abandoning the saved three-lock scoring goal. Stay fail-closed.
 const tiny=decide({...q,commitment:{observation:q.observation,advice:old}},{maxNodes:500});assert.equal(tiny.target,null);assert.equal(tiny.status,'budget-exhausted');assert.equal(tiny.metrics.commitmentComparison.replacement,false);assert.ok(tiny.metrics.nodes<=500);
});

test('opening quality priority: missing or forged history cannot activate the preference or allowance',()=>{
 const a=observed(),q=a.request(),partial=H.start(q.observation),unknown={...q,options:{...q.options,resourceContext:H.exportContext(q.observation,partial),openingAllocation:a.summary.openingAllocation,openingQualityPending:true}};
 const advice=decide(unknown);assert.equal(advice.assessment?.structure?.openingQuality,undefined);assert.equal(advice.evidence?.structure?.openingQuality,undefined);
 const tampered=clone(q);tampered.options.resourceContext.steps.pop();tampered.options.resourceContext.openingAllocation=a.summary.openingAllocation;tampered.options.resourceContext.extraZ={status:'available'};
 const invalid=decide(tampered);assert.equal(invalid.target,null);assert.equal(H.resolve(q.observation,H.importContext(q.observation,tampered.options.resourceContext)).extraZ.status,'unknown');
 assert.equal(a.summary.extraZ.status,'unknown');
});

test('opening quality priority: completed quality ends the preference but another scoring T does not erase unpaid quality',()=>{
 const completed=observed();completed.execute(fixture.steps[4].witness,reveals[4]);assert.equal(completed.summary.extraZ.status,'available');const good=decide(completed.request());assert.equal(good.evidence?.structure?.openingQuality,undefined);
 const later=observed(),q=later.request(),old=oldGoal(q.observation,decide(q));for(const p of old.continuation)later.execute(p.witness,null);
 assert.equal(later.summary.openingAllocation.counts.T,4);assert.equal(later.summary.extraZ.status,'unknown');const advice=decide(later.request());assert(advice.target);assert.equal(advice.evidence?.structure?.openingQuality?.baselineGranted,false);assert.equal(later.summary.extraZ.status,'unknown');
});

test('opening quality priority: lost Center debt cannot masquerade as still-eligible delayed quality',()=>{
 const a=observed(19);a.execute(['L','L','L','HD'],'O');a.execute(['CW','R','HD'],'S');assert.ok(a.summary.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>=18));
 const advice=decide(a.request());assert.equal(advice.evidence?.structure?.openingQuality,undefined);assert.equal(a.summary.extraZ.status,'unknown');
});
