'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),A=require('../st-access'),M=require('../st-midgame-resources'),fixtures=require('./fixtures/scheduling-roots.json');
for(const f of fixtures)test(`proof scheduling: seed ${f.seed} next ${f.nextLock} recovers within shared live node budget`,()=>{
 const q=f.request,options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined,usageTelemetry:true};
 const a=P.decide(q.observation,options);assert.ok(a.target,a.reason);assert.ok(a.metrics.nodes<=45000);assert.equal(a.metrics.proofScheduling.allowance,6000);
 assert.ok(a.metrics.proofScheduling.unfinished>0,'Earlier partial screening remains explicit');assert.equal(a.evidence.searchIncomplete,true);
 assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);
 const r=R.replay(q.observation,a.continuation.flatMap(p=>p.witness));assert.equal(r.valid,true);assert.equal(r.events.length,a.continuation.length);
 assert.ok(P.revalidate(q.observation,a,options),'The whole result passes current validation again');
 assert.equal(P.revalidate({...q.observation,hold:q.observation.hold==='T'?'I':'T'},a,{...options,maxNodes:0}),null,'A prior certificate is not authority for another inventory');
});
test('proof scheduling: deliberately unfinished access never becomes rejection or an admitted fallback',()=>{
 const f=fixtures[0],q=f.request,calls=[];const access={...A,prefix:(state,path,options)=>{calls.push(options.maxNodes);return{reachable:null,complete:false,visited:Math.min(1000,options.maxNodes),status:'unknown-access-budget'};}};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module:mod,require:id=>id==='./st-access.js'?access:require(id.replace('./','../')),Date,performance});
 const a=mod.exports.decide(q.observation,{...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined});
 assert.equal(a.target,null);assert.equal(a.status,'budget-exhausted');assert.ok(a.metrics.nodes<=45000);assert.equal(a.metrics.completeDepth,0);assert.ok(a.metrics.proofScheduling.unfinished>0);assert.ok(calls.some(n=>n<=6000));assert.ok(a.metrics.rootExpanded>0,'Unfinished screening leaves budget for ordinary expansion');
});

for(const f of require('./fixtures/scheduling-selection-roots.json'))test(`proof scheduling: certified selection and incomplete coverage remain distinct at ${f.seed}/${f.lock}`,()=>{
 const q=f.request,options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined};
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

for(const f of fixtures)test(`proof scheduling: certified horizon follows executed suffix at ${f.seed}`,()=>{
 const H=require('../st-resource-history'),PH=require('../st-pattern-history');
 const q=f.request,options={...q.options,previous:q.previous,commitment:q.commitment,deadline:Infinity,timeMs:undefined};
 const a=P.decide(q.observation,options);assert.equal(a.metrics.certifiedHorizon,3);
 let state=q.observation,history=H.importContext(state,q.options.resourceContext),pattern=q.options.patternHistory;
 for(const action of a.witness){const before=state;state=R.move(state,action);history=H.applyAction(history,before,action,state);if(action==='HD')pattern=PH.update(pattern,before,state,state.lastEvent);}
 const nextOptions={...options,patternHistory:pattern,resourceContext:H.exportContext(state,history)};
 const suffix=P.continueCommitment(q.observation,state,a,state.lastEvent,nextOptions);
 assert.ok(suffix);assert.equal(suffix.continuation.length,2);assert.equal(suffix.metrics.certifiedHorizon,2);
 const forgedCount={...suffix,metrics:{...suffix.metrics,certifiedHorizon:99}};
 const checked=P.revalidate(state,forgedCount,nextOptions);assert.ok(checked);assert.equal(checked.metrics.certifiedHorizon,2);
 const action=suffix.witness[0];if(action!=='HD'){
  const moved=R.move(state,action),movedHistory=H.applyAction(history,state,action,moved);
  const advanced=P.advance(moved,forgedCount,action,{...nextOptions,resourceContext:H.exportContext(moved,movedHistory)});
  assert.ok(advanced);assert.equal(advanced.metrics.certifiedHorizon,advanced.continuation.length);assert.equal(advanced.metrics.certifiedHorizon,2);
 }
});
