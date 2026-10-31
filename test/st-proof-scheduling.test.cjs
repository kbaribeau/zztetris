'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),A=require('../st-access'),M=require('../st-midgame-resources'),fixtures=require('./fixtures/scheduling-roots.json');
function assertRisk(state,a){assert.equal(a.status,'recommended-risky-placement');assert.equal(a.recommendation.kind,'risky');assert.equal(a.metrics.certifiedHorizon,0);assert.equal(a.continuation.length,1);assert.ok(a.metrics.nodes<=45000);assert.equal(a.evidence.resourceObligations,undefined);assert.equal(a.evidence.coveredRepairPlan,undefined);assert.equal(R.replay(state,a.witness).valid,true);assert.equal(P.revalidate(state,a),null);assert.match(a.reason,/^Risky:/);assert.match(a.reason,/safer move may exist/);}
for(const f of fixtures)test(`proof scheduling: old seed ${f.seed} route cannot replace actual repair with hypothetical access`,()=>{
 const q=f.request,options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined,now:()=>0};
 const old=require('./fixtures/unsafe-scheduling-repair-prefixes.json').find(p=>p.seed===f.seed),H=require('../st-resource-history');
 const summary=H.resolve(q.observation,H.importContext(q.observation,q.options.resourceContext));
 const proof=A.repairPrefix(M.extendForced(q.observation),old.steps,{initialDebt:summary.coveredRepair.cells,stages:summary.center.pending});
 assert.equal(proof.valid,false);assert.deepEqual(proof.outstandingCells,old.outstanding);
 assert.equal(P.checkedCoveredRepair(q.observation,old.steps,options),null);
 // Supported admission still rejects the archived hypothetical repair. The
 // explicitly risky recommendation is a different, one-lock contract. The
 // clean-candidate correction no longer forces a pending-O defect at0001.
 const strict=P.plan(q.observation,options);assert.equal(strict.target,null);assert.ok(['no-supported-continuation-found','budget-exhausted'].includes(strict.status));
 const a=P.decide(q.observation,options);assertRisk(q.observation,a);
 if(f.seed===2449480001){assert.deepEqual(a.target,{type:'L',x:1,y:24,rotation:2});assert.equal(a.recommendation.riskBasis,'uncertified-follow-up-only');assert.deepEqual(a.recommendation.hazards.map(h=>h.code),['continuation-unverified']);assert.equal(a.recommendation.search.incomplete,true);}
 else{assert.deepEqual(a.target,{type:'L',x:0,y:21,rotation:2});assert.deepEqual(a.recommendation.hazards.find(h=>h.code==='unresolved-covered-cells').cells,[[3,28]]);assert.ok(a.recommendation.hazards.some(h=>h.code==='allocation-history-unknown'));}

});
test('proof scheduling: deliberately unfinished access remains unknown, never a supported certificate',()=>{
 const f=fixtures[0],q=f.request,calls=[];const access={...A,prefix:(state,path,options)=>{calls.push(options.maxNodes);return{reachable:null,complete:false,visited:Math.min(1000,options.maxNodes),status:'unknown-access-budget'};}};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module:mod,require:id=>id==='./st-access.js'?access:require(id.replace('./','../')),Date,performance});
 const options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined,now:()=>0};const strict=mod.exports.plan(q.observation,options);assert.equal(strict.target,null);assert.equal(strict.status,'budget-exhausted');
 const a=mod.exports.decide(q.observation,options);assertRisk(q.observation,a);assert.deepEqual(a.target,{type:'L',x:1,y:24,rotation:2});assert.equal(a.recommendation.search.status,'budget-exhausted');assert.equal(a.recommendation.search.incomplete,true);assert.equal(a.recommendation.riskBasis,'uncertified-follow-up-only');assert.deepEqual(Array.from(a.recommendation.hazards,h=>h.code),['continuation-unverified']);assert.ok(a.metrics.nodes<=45000);assert.equal(a.metrics.completeDepth,0);assert.ok(a.metrics.proofScheduling.unfinished>0);assert.ok(calls.some(n=>n<=6000));assert.ok(a.metrics.rootExpanded>0,'Unfinished screening leaves budget for ordinary expansion');
});

for(const f of require('./fixtures/scheduling-selection-roots.json'))test(`proof scheduling: certified selection and incomplete coverage remain distinct at ${f.seed}/${f.lock}`,()=>{
 // These fixtures specify node-only selection. Control nested handoff clocks,
 // too; an infinite outer deadline alone still leaves their 200-ms wall timer.
 const q=f.request,options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined,now:()=>0};
 const a=P.decide(q.observation,options);
 assert.deepEqual(a.target,f.expectedTarget);
 assert.ok(a.metrics.nodes<=45000);
 assert.ok(a.metrics.certifiedHorizon>=a.metrics.completeDepth);
 if(f.seed!==2449482139)assert.ok(a.metrics.certifiedHorizon>a.metrics.completeDepth,'Incomplete competing proofs cannot inflate completeDepth');
 assert.equal(a.metrics.certifiedHorizon,a.continuation.length);
 assert.ok(a.metrics.completedBeamDepth>=a.metrics.certifiedHorizon);
 assert.equal(a.evidence.searchIncomplete,true);
 assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);
 // Two roots include a uniquely deduced final bag member. Producer and
 // retention now normalize that same public supply; no binding is ignored.
 // This intentionally fixes their former exact-context retention rejection.
 const retained=P.revalidate(q.observation,a,options);assert.ok(retained?.target);
 assert.deepEqual(retained.target,a.target);assert.deepEqual(retained.continuation.map(p=>p.event),a.continuation.map(p=>p.event));
 let normalized=M.extendForced(R.createState(q.observation));
 for(const step of retained.continuation){const replay=R.replay(normalized,step.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.events,[step.event]);normalized=replay.state;
  assert.equal(JSON.stringify([normalized.rules,normalized.board,normalized.hold,normalized.canHold,normalized.queue,normalized.bag??null,normalized.active?.type]),step.resultContext,'Every retained result context uses the same exact public deduction');
 }
 const forged=JSON.parse(JSON.stringify(a));forged.evidence.resourceObligations.binding+='forged';
 assert.equal(P.revalidate(q.observation,forged,options),null,'A resource binding is still mandatory when supplied');
 assert.equal(P.revalidate({...q.observation,hold:q.observation.hold==='T'?'I':'T'},a,{...options,maxNodes:0}),null);
 const r=R.replay(q.observation,a.continuation.flatMap(p=>p.witness));assert.equal(r.valid,true);assert.equal(r.events.length,a.metrics.certifiedHorizon);
 if(f.seed===2449482139)assert.equal(a.metrics.proofScheduling.enabled,false,'Internal subprobe retains original allocation');
});

for(const f of require('./fixtures/scheduling-selection-roots.json').slice(0,1))test(`proof scheduling: safe certified horizon follows executed suffix at ${f.seed}`,()=>{
 const H=require('../st-resource-history'),PH=require('../st-pattern-history');
 const q=f.request,options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined};
 const a=P.decide(q.observation,{...options,now:()=>0});assert.ok(a.target);const horizon=a.continuation.length;assert.ok(horizon>=2);assert.equal(a.metrics.certifiedHorizon,horizon);
 let state=q.observation,history=H.importContext(state,q.options.resourceContext),pattern=q.options.patternHistory;
 for(const action of a.witness){const before=state;state=R.move(state,action);history=H.applyAction(history,before,action,state);if(action==='HD')pattern=PH.update(pattern,before,state,state.lastEvent);}
 const nextOptions={...options,patternHistory:pattern,resourceContext:H.exportContext(state,history)};
 const suffix=P.continueCommitment(q.observation,state,a,state.lastEvent,nextOptions);
 assert.ok(suffix);assert.equal(suffix.continuation.length,horizon-1);assert.equal(suffix.metrics.certifiedHorizon,horizon-1);
 const forgedCount={...suffix,metrics:{...suffix.metrics,certifiedHorizon:99}};
 const checked=P.revalidate(state,forgedCount,nextOptions);assert.ok(checked);assert.equal(checked.metrics.certifiedHorizon,horizon-1);
 const action=suffix.witness[0];if(action!=='HD'){
  const moved=R.move(state,action),movedHistory=H.applyAction(history,state,action,moved);
  const advanced=P.advance(moved,forgedCount,action,{...nextOptions,resourceContext:H.exportContext(moved,movedHistory)});
  assert.ok(advanced);assert.equal(advanced.metrics.certifiedHorizon,advanced.continuation.length);assert.equal(advanced.metrics.certifiedHorizon,horizon-1);
 }
});
