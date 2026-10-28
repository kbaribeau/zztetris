'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),H=require('../st-resource-history');
const fixture=require('./fixtures/timely-scoring.json'),clone=x=>JSON.parse(JSON.stringify(x));

// Abstract contract records, NOT physically replayable alternative routes.
// Exercise both independent guards without claiming an Extra-Z policy benefit.
const filler=()=>({event:{type:'O',lines:0,spin:'none',cells:[]},structuralEvidence:{cavityRepair:{cells:[]}}});
const score=type=>({...filler(),event:{type,lines:type==='T'?2:4,spin:type==='T'?'full':'none',cells:[]}});
function record(key,path,extraZ='used'){
 return{key,path,extraZPreservable:true,continuationChecked:true,state:{board:['XXXX']},
  rank:[1,1,0,10,2,-20,2,0],structuralScore:40,centerContinuity:0,openingQualityProgress:null,
  qualified:true,notchValid:true,cycleDebt:0,cavityDebt:[],centerDebt:[],dependencyDebt:0,entryDebt:0,
  assessment:{maxHeight:8,regionalSupport:true,sealed:0,covered:0,estimate:20,right:{},structure:{left:{covered:0}}},
  resources:{extraZ,originKey:'abstract same verified root',active:{type:'I',id:5,bag:1},hold:{type:'Z',id:4,bag:1},queue:[],scoredTs:[3],
   violations:[],pendingCenter:[],hangingS:[],hangingL:[],unclassifiedS:[],unclassifiedL:[]}};
}

test('timely / Extra-Z contract: allowance cannot justify a delayed TSD or quad',()=>{
 for(const type of ['T','I']){
  const saved=record('a',[score(type),filler(),filler()]),fresh=record('z',[filler(),score(type),filler()],'available');
  assert.equal(P.orderContinuations([fresh,saved])[0],saved,'Different score schedules are not a preservation tie');
  assert.equal(P.preserveExtraZ(saved,[fresh,saved],{protect:()=>{throw Error('No equivalent challenger');},certify:()=>{throw Error('No equivalent challenger');}}),saved);
  assert.equal(P.scoringReplacement(fresh,saved,saved).allowed,false);
  // Even an ordinary numeric ranking advantage is not an exception to timing.
  fresh.rank[3]++;
  assert.equal(P.orderContinuations([fresh,saved])[0],fresh);
  assert.equal(P.scoringReplacement(fresh,saved,saved).reason,'delay-without-concrete-benefit');
 }
});

test('timely / Extra-Z contract: an exact score schedule still permits certified preservation',()=>{
 const saved=record('a',[score('T'),filler(),score('I')]),fresh=record('z',clone(saved.path),'available'),calls=[];
 assert.equal(P.orderContinuations([saved,fresh])[0],fresh);
 const timing=P.scoringReplacement(fresh,saved,saved);
 assert.equal(timing.allowed,true);assert.equal(timing.reason,'no-protected-score-delay');
 assert.deepEqual(timing.required,{tsds:[1],quads:[3]});
 assert.equal(P.preserveExtraZ(saved,[fresh,saved],{protect:n=>{calls.push('protect '+n.key);return true;},certify:n=>{calls.push('certify '+n.key);return true;}}),fresh);
 assert.deepEqual(calls,['protect a','certify z']);
 fresh.continuationChecked=false;
 assert.equal(P.orderContinuations([fresh,saved])[0],saved,'Equal timing cannot substitute for private continuation certification');
});

test('timely / Extra-Z contract: earlier scoring is allowed but not mislabelled an exact preservation tie',()=>{
 const saved=record('a',[filler(),score('T'),score('I')]),fresh=record('z',[score('T'),filler(),score('I')],'available');
 assert.equal(P.scoringReplacement(fresh,saved,saved).allowed,true);
 assert.equal(P.orderContinuations([fresh,saved])[0],saved,'Timing permission does not broaden the exact Extra-Z equivalence class');
});

const bounds={depth:3,width:8,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
function replay(raw,advice){
 let state=R.createState(raw);
 for(const step of advice.continuation){const next=R.replay(state,step.witness);assert.equal(next.valid,true);assert.equal(next.events.length,1);assert.deepEqual(next.events[0],step.event);state=next.state;}
 return state;
}

test('timely / Extra-Z integration: real q11 retains its score and its actual partial root history',()=>{
 const q=clone(fixture.request),before=clone(q),state=R.createState(q.observation),history=H.importContext(state,q.options.resourceContext),summary=H.resolve(state,history);
 assert.equal(summary.coverage.status,'partial');assert.equal(summary.extraZ.status,'unknown');assert.equal(summary.extraZ.baseline,null);
 const result=P.decide(q.observation,{...q.options,...bounds,commitment:q.commitment});
 assert.ok(result.target,result.reason);assert.equal(result.continuation[0].event.type,'T');assert.equal(result.continuation[0].event.spin,'full');assert.equal(result.continuation[0].event.lines,2);
 assert.equal(result.metrics.commitmentComparison.replacement,false);assert.equal(result.metrics.commitmentComparison.scoringTiming.reason,'delay-without-concrete-benefit');
 assert.equal(result.evidence.resourceObligations.status,'checked');assert.equal(result.evidence.resourceObligations.extraZ,'unknown');assert.equal(result.evidence.gapAccess.reachable,true);
 assert.ok(result.metrics.nodes<=bounds.maxNodes);replay(q.observation,result);
 assert.deepEqual(q,before,'No fabricated complete history or available Extra-Z flag is introduced into the fixture');
 assert.equal(H.resolve(state,history).extraZ.status,'unknown');
});

test('timely / Extra-Z orchestration seam: unknown optional work cannot erase the admitted original scoring commitment',()=>{
 // Deliberately inject only a callback exercise at the optional selector seam.
 // q11 is NOT claimed to have available Extra-Z or a natural preserving tie.
 // Its actual request/history and all original-commitment admission checks stay
 // intact. No geometry, resource permission, ranking or timing result is forged.
 const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),A=require('../st-access');
 const plannerPath=require.resolve('../st-planner'),localRequire=createRequire(plannerPath),q=clone(fixture.request),before=clone(q);
 let clock=0,committed=null,attempts=0,protectedCount=0,callerCalls=0;
 const selector='function preserveExtraZ(baseline,nodes,{protect,certify}){',admission='remember(commitment);';
 let source=fs.readFileSync(plannerPath,'utf8');
 assert.equal(source.split(selector).length,2,'Selector seam is uniquely installed');assert.equal(source.split(admission).length,2,'Admission observer is uniquely installed');
 source=source.replace(admission,admission+' integrationCommitment(commitment);').replace(selector,selector+' return integrationOptionalProbe(baseline,nodes,{protect,certify});');
 const mod={exports:{}},access={...A,prefix:(...args)=>clock>=50?{reachable:null,complete:false,visited:0,status:'unknown-access-budget'}:A.prefix(...args)};
 vm.runInNewContext(source,{module:mod,require:id=>id==='./st-access.js'?access:localRequire(id),Date,performance,
  integrationCommitment:n=>{committed=n;},
  integrationOptionalProbe:(baseline,nodes,{protect,certify})=>{
   if(attempts++)return baseline;
   assert.ok(committed,'The real saved scoring commitment was reconstructed first');
   assert.equal(protect(committed),true,'Original commitment completes real private final admission before optional exhaustion');protectedCount++;
   clock=100;
   assert.equal(certify(committed),false,'Optional certification respects the same exhausted deadline');
   return baseline;
  }});
 const result=mod.exports.decide(q.observation,{...q.options,...bounds,commitment:q.commitment,deadline:50,now:()=>clock,
  admitMaintenance:()=>{callerCalls++;throw Error('Caller admission must not supply authority');}});
 assert.equal(protectedCount,1);assert.equal(callerCalls,0);assert.ok(result.target,result.reason);
 assert.equal(result.metrics.certifiedFallback?.selected,true);assert.equal(result.evidence.searchIncomplete,true);
 assert.equal(result.continuation[0].event.type,'T');assert.equal(result.continuation[0].event.spin,'full');assert.equal(result.continuation[0].event.lines,2);
 assert.equal(result.evidence.resourceObligations.status,'checked');assert.equal(result.evidence.resourceObligations.extraZ,'unknown');assert.equal(result.evidence.gapAccess.reachable,true);
 assert.ok(result.metrics.nodes<=bounds.maxNodes);replay(q.observation,clone(result));assert.deepEqual(q,before);
});
