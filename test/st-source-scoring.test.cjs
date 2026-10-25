'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),P=require('../st-planner'),Q=require('../st-source-scoring'),Sim=require('../scripts/lib/st-simulation.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),config={...Sim.CONFIG,now:()=>0};
let fixture;
function actualRoot(){
 const session=Sim.createSession(Sim.makeInput('empty',2026114046,24));
 for(let lock=1;lock<=14;lock++){
  const request=session.request(lock,config),advice=P.decide(request.observation,request.options);
  assert.ok(advice.evidence?.opening?.sourcePlan,'actual source construction at '+lock);
  session.execute(advice);
 }
 assert.equal(session.opening.source.history.steps.length,7);
 assert.equal(session.opening.source.continuationSteps.length,7);
 assert.deepEqual(session.opening.source.scoringSteps,[]);
 return session;
}
function base(){
 if(!fixture){const session=actualRoot(),request=session.request(15,config),advice=P.decide(request.observation,request.options);assert.ok(advice.evidence?.opening?.scoringPlan);fixture={request,advice};}
 const request=clone(fixture.request),advice=clone(fixture.advice);request.options.now=()=>0;
 const accepted=P.acceptOpeningResult({active:true,clear:null,repair:null,source:request.options.openingSource},advice);
 return{request,advice,options:{...request.options,openingSource:accepted.source}};
}
function syncSource(advice,options){options.openingSource=clone(advice.evidence.opening.scoringPlan.source);}

test('source scoring: actual source history reaches first TSD through live movement/HOLD/refill and only then normal handoff',()=>{
 const session=actualRoot();let types=[],holds=0,advanced=0,draws=session.cursor;
 for(let lock=15;lock<=20;lock++){
  const request=session.request(lock,Sim.CONFIG),advice=P.decide(request.observation,request.options);
  assert.ok(advice.evidence?.opening?.scoringPlan,'scoring proof at '+lock);
  assert.equal(advice.phase,'opening');assert.equal(session.opening.active,true);assert.equal(session.opening.clear,null);
  assert.ok(advice.metrics.nodes<=Sim.CONFIG.maxNodes);assert.ok(advice.continuation.length<=21-lock);
  const actual=session.execute(advice);types.push(actual.event.type);holds+=actual.actions.filter(x=>x.action==='HOLD').length;
  for(const action of actual.actions.filter(x=>x.action!=='HD')){assert.equal(action.adviceAdvanced,true,lock+' '+action.action+' retained within the real default 100ms allowance');advanced++;}
  assert.equal(actual.event.lines,lock===20?2:0);
  if(lock===20){assert.equal(actual.event.spin,'full');assert.ok(actual.event.cells.every(([x])=>x>=6));}
  assert.equal(session.opening.active,true,'actual clear alone does not declare handoff');
 }
 assert.deepEqual(types,['O','S','I','J','L','T']);assert.ok(holds>0&&advanced>0&&session.cursor>draws);
 assert.equal(session.opening.clear.event.lines,2);assert.equal(session.opening.source,null);
 const request=session.request(21,Sim.CONFIG),next=P.decide(request.observation,request.options);
 assert.equal(next.phase,'maintenance');assert.ok(next.evidence.openingHandoff);
 assert.equal(P.acceptOpeningResult(session.opening,next).active,false);
});

test('source scoring: copied public state retains only with connected live source authority; imports/reset and Undo-style revisions fail closed',()=>{
 const {request,advice,options}=base();assert.ok(P.revalidate(request.observation,advice,options));
 for(const openingSource of [null,undefined,{pattern:options.openingSource.pattern}])assert.equal(P.revalidate(request.observation,advice,{...options,openingSource}),null);
 const imported=P.startOpeningSession(request.observation,{emptyMode:true});assert.equal(imported.source,null);
 assert.equal(P.revalidate(request.observation,advice,{...options,openingSource:imported.source}),null);
 const revised=clone(request.observation);revised.revision++;assert.equal(P.revalidate(revised,advice,options),null,'same board restored under a new Undo revision is not the bound history');
 for(const flag of ['disableOpeningSources','disableSourceScoring','disableOpening'])assert.equal(P.revalidate(request.observation,advice,{...options,[flag]:true}),null);
 assert.equal(P.revalidate(request.observation,advice,{...options,openingPhase:false}),null);
 assert.equal(P.advance(request.observation,advice,'HD',options),null);
 const wrong=advice.witness[0]==='L'?'R':'L';assert.equal(P.advance(request.observation,advice,wrong,options),null);
});

test('source scoring: forged displayed target, event, HOLD flags, history and bound suffix cannot acquire proof authority',()=>{
 const cases={
  'displayed target':a=>{a.target.x++;},
  'displayed hold':a=>{a.hold=!a.hold;},
  'displayed hold count':a=>{a.holdCount++;},
  'proof event':a=>{a.evidence.opening.scoringPlan.steps[0].event.cells[0][0]++;},
  'proof target':a=>{a.evidence.opening.scoringPlan.steps[0].target.x++;},
  'historical event':(a,o)=>{a.evidence.opening.scoringPlan.source.history.steps[0].event.cells[0][0]++;syncSource(a,o);},
  'disconnected second history':(a,o)=>{a.evidence.opening.scoringPlan.source.continuationSteps[0].after.revision++;syncSource(a,o);},
  'shortened advertised suffix':a=>{a.evidence.opening.scoringPlan.steps.pop();a.continuation.pop();},
  'forged bound route':(a,o)=>{a.evidence.opening.scoringPlan.source.scoringRoute.steps.at(-1).board[39]='..........';syncSource(a,o);},
  'root preview over six':(a,o)=>{a.evidence.opening.scoringPlan.source.scoringRoute.origin.queue.push('I');syncSource(a,o);},
  'origin preview over six':a=>{a.evidence.opening.scoringPlan.origin.queue.push('I');},
  'invented consumed input':a=>{a.evidence.opening.scoringPlan.consumed++;}
 };
 for(const [label,mutate]of Object.entries(cases)){const {request,advice,options}=base();mutate(advice,options);assert.equal(P.revalidate(request.observation,advice,options),null,label);}
});

test('source scoring: a later actual refill cannot manufacture a route absent from original root-visible supply',()=>{
 const session=actualRoot();let request=session.request(15,config),advice=P.decide(request.observation,request.options);session.execute(advice);
 request=session.request(16,config);advice=P.decide(request.observation,request.options);assert.ok(advice.evidence?.opening?.scoringPlan);
 const options={...request.options,openingSource:P.acceptOpeningResult(session.opening,advice).source},forged=clone(advice),source=forged.evidence.opening.scoringPlan.source;
 const prior=source.continuationSteps.at(-2).after,last=source.continuationSteps.at(-1),unrefilled=R.replay(prior,last.witness);
 assert.ok(unrefilled.valid);assert.equal(unrefilled.state.queue.length,5);assert.deepEqual(unrefilled.state.board,last.after.board);
 source.continuationSteps.at(-1).after=clone(unrefilled.state);source.scoringRoute.origin=clone(unrefilled.state);syncSource(forged,options);
 const whole=R.replay(unrefilled.state,source.scoringRoute.steps.flatMap(s=>s.witness));
 assert.ok(!whole.valid||!whole.state.active,'the shortened original supply cannot certify the full route');
 assert.ok(R.replay(request.observation,forged.continuation.flatMap(s=>s.witness)).valid,'actual later refills can execute the remaining suffix, but cannot renew root authority');
 assert.equal(P.revalidate(request.observation,forged,options),null);
});

test('source scoring: exhausted node/time budgets retain no unsafe proof and charge failed work',()=>{
 const {request,advice,options}=base();
 for(const limit of [0,1,16,64]){const tracker={nodes:0};assert.equal(P.revalidate(request.observation,advice,{...options,maxNodes:limit,budgetTracker:tracker}),null);assert.ok(tracker.nodes<=limit);}
 const tracker={nodes:0};assert.equal(P.revalidate(request.observation,advice,{...options,now:()=>100,deadline:100,budgetTracker:tracker}),null);assert.equal(tracker.nodes,0);
 const bad=clone(advice);bad.evidence.opening.scoringPlan.source.continuationSteps.at(-1).event.type='I';const badOptions={...options};syncSource(bad,badOptions);const failed={nodes:0};assert.equal(P.revalidate(request.observation,bad,{...badOptions,budgetTracker:failed}),null);assert.ok(failed.nodes>0);
 for(const maxNodes of [0,1,16]){const result=P.decide(request.observation,{...request.options,maxNodes});assert.equal(result.evidence?.opening?.scoringPlan,undefined);assert.ok(result.metrics.nodes<=maxNodes);}
 const direct=Q.search(R.createState(request.observation),{notches:{status:'established'},counts:{},maxNodes:0,now:()=>0});assert.equal(direct.candidate,null);assert.equal(direct.unknown,true);assert.equal(direct.visited,0);
});

test('source scoring: hidden future fields cannot change source-qualified discovery or exact retained target',()=>{
 const {request,advice,options}=base(),secret={...clone(request.observation),future:['Z','Z','Z'],hiddenQueue:['I'],seed:17};
 const plain=P.decide(request.observation,request.options),hidden=P.decide(secret,{...request.options,future:['S'],privateSeed:999});
 assert.ok(plain.evidence?.opening?.scoringPlan);assert.deepEqual(hidden.target,plain.target);assert.deepEqual(hidden.continuation,plain.continuation);assert.deepEqual(hidden.evidence,plain.evidence);assert.equal(hidden.metrics.nodes,plain.metrics.nodes);
 const retained=P.revalidate(secret,advice,options);assert.ok(retained);assert.deepEqual(retained.target,advice.target);
 for(const flag of ['disableOpeningSources','disableSourceScoring']){const result=P.decide(request.observation,{...request.options,[flag]:true});assert.equal(result.evidence?.opening?.scoringPlan,undefined);}
});


// Controlled provider seam tests the outer access boundary, not source geometry.
// Both recommendations below are actual legal rules-kernel placements.
function fallbackBoundary(mode){
 const state=R.createState({active:'O',queue:['I','T']}),make=actions=>{const r=R.replay(state,actions);assert.ok(r.valid);const e=r.events[0];return{status:'recommended-with-verified-prefix',target:e.target,hold:false,holdCount:0,witness:actions,continuation:[{board:r.state.board,target:e.target,witness:actions,event:e,hold:false,holdCount:0}],metrics:{nodes:10},evidence:{opening:{status:'controlled-ordinary'}}};};
 let clock=0,checks=0,callerCalls=0,ordinary;
 const access={...require('../st-access'),prefix:()=>{checks++;return{reachable:checks===1&&clock<50?true:mode==='new-candidate'?false:null,visited:checks===1?7:3};}};
 const opening={plan:(_s,options)=>{
  if(options.disableSourceScoring)return make(['HD']);
  if(mode==='serialized-marker'){clock=100;const result=make(['HD']);result.evidence.gapAccess={reachable:true,visited:0};result.evidence.finalAccessChecked=true;return result;}
  ordinary=options.normalOpeningDecision();clock=mode.startsWith('new-candidate')?40:100;
  if(mode==='witness')ordinary.witness=['L','HD'];
  if(mode==='continuation')ordinary.continuation[0].witness=['L','HD'];
  if(mode==='evidence')ordinary.evidence.opening.status='modified-after-check';
  if(mode==='clone')return clone(ordinary);
  if(mode.startsWith('new-candidate')||mode==='timeout-newcandidate'){const next=make(['L','HD']);next.metrics.nodes=ordinary.metrics.nodes+11;next.evidence.opening.status='controlled-new-candidate';next.evidence.opening.scoringPlan={kind:'controlled'};return next;}
  return ordinary;
 }};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module:mod,require:id=>id==='./st-access.js'?access:id==='./st-opening.js'?opening:require(id.replace('./','../')),Date,performance});
 const result=mod.exports.plan(state,{openingPhase:true,maxNodes:100,deadline:50,now:()=>clock,normalOpeningDecision:()=>{callerCalls++;throw Error('caller callback must never provide proof authority');}});
 return{result,checks,callerCalls,ordinary};
}

test('source scoring: an exhausted experimental budget preserves the exact already-checked ordinary fallback without a second access charge',()=>{
 const {result,checks,callerCalls,ordinary}=fallbackBoundary('exact');assert.equal(checks,1);assert.equal(callerCalls,0);assert.equal(result,ordinary);assert.ok(result.target);assert.equal(result.metrics.nodes,17);
});

test('source scoring: modified or merely serialized fallback claims cannot bypass the final access boundary',()=>{
 for(const mode of ['witness','continuation','evidence']){const {result,checks,callerCalls}=fallbackBoundary(mode);assert.equal(checks,2,mode);assert.equal(callerCalls,0);assert.equal(result.target,null,mode);}
 const copied=fallbackBoundary('clone');assert.equal(copied.checks,2,'a serialized copy itself carries no checked-object authority');assert.equal(copied.callerCalls,0);assert.equal(copied.result.target,null,'arbitrary ordinary copies cannot acquire experimental-fallback privilege');
 const marker=fallbackBoundary('serialized-marker');assert.equal(marker.checks,1);assert.equal(marker.callerCalls,0);assert.equal(marker.result.target,null);
});

test('source scoring: a new candidate failing final access returns the checked ordinary fallback and retains all spent work',()=>{
 for(const mode of ['new-candidate','new-candidate-unknown']){const {result,checks,callerCalls,ordinary}=fallbackBoundary(mode);assert.equal(checks,2);assert.equal(callerCalls,0);assert.deepEqual(result.target,ordinary.target);assert.deepEqual(result.witness,['HD']);assert.equal(result.evidence.opening.status,'controlled-ordinary');assert.equal(result.metrics.nodes,33,'10 ordinary + 7 ordinary access + 11 experiment + 2 explicit replay + 3 rejected final access');}
 const timed=fallbackBoundary('timeout-newcandidate');assert.equal(timed.checks,1,'expired budget avoids a second access call');assert.equal(timed.callerCalls,0);assert.deepEqual(timed.result.target,timed.ordinary.target);assert.deepEqual(timed.result.witness,['HD']);assert.equal(timed.result.metrics.nodes,28);
});

function sourceRootFor(seed){
 const session=Sim.createSession(Sim.makeInput('empty',seed,24));
 for(let lock=1;lock<=14;lock++){const request=session.request(lock,config);session.execute(P.decide(request.observation,request.options));}
 assert.equal(session.opening.source.continuationSteps.length,7);return session;
}

test('source scoring v2: new actual lock may replace only the unexecuted goal suffix with a root-reproved complete A prefix',()=>{
 const session=sourceRootFor(2026103510),root=session.request(15,config),initial=P.decide(root.observation,root.options);
 assert.deepEqual(initial.continuation.map(p=>p.event.type),['O','J','T']);
 const oldRoute=clone(initial.evidence.opening.scoringPlan.source.scoringRoute),oldJ=clone(initial.continuation[1].target);
 session.execute(initial);const request=session.request(16,config),replacement=P.decide(request.observation,request.options);
 assert.equal(replacement.metrics.sourceScoring.replacement,true);
 assert.deepEqual(replacement.continuation.map(p=>p.event.type),['J','T']);
 assert.deepEqual(replacement.target,{type:'J',x:2,y:29,rotation:3});assert.notDeepEqual(replacement.target,oldJ);
 const source=replacement.evidence.opening.scoringPlan.source,route=source.scoringRoute;
 assert.deepEqual(route.origin,oldRoute.origin);assert.deepEqual(route.steps[0],oldRoute.steps[0]);
 assert.deepEqual(source.scoringSteps,request.options.openingSource.scoringSteps);assert.equal(route.steps.length,3);
 const full=R.replay(route.origin,route.steps.flatMap(p=>p.witness));assert.ok(full.valid&&full.state.active);assert.equal(full.events.at(-1).lines,2);
 assert.deepEqual(full.state.board,Array(31).fill('..........').concat(['....LLL...','...JLSS...','...JSS....','..JJJJJ...','..OOOOJ...','ZZOOOO....','IZZTIOO...','ITTTIOO...','LLLJJJS.Z.']));
 const accepted=P.acceptOpeningResult(session.opening,replacement);assert.ok(accepted.source);assert.equal(accepted.source.scoringDecisionOffset,1);
 const repeat=P.plan(request.observation,{...request.options,openingSource:accepted.source});assert.equal(repeat.metrics.sourceScoring.ordinaryReplan,false);assert.deepEqual(repeat.target,replacement.target);
 const options={...request.options,openingSource:accepted.source};assert.ok(P.revalidate(request.observation,replacement,options));
 const sameDecision=P.decide(request.observation,{...options,previous:replacement});assert.deepEqual(sameDecision.target,replacement.target);assert.equal(sameDecision.retained,true);
 const bad=clone(replacement);bad.evidence.opening.scoringPlan.source.scoringRoute.steps[0].witness=['HD'];const badOptions={...options};syncSource(bad,badOptions);assert.equal(P.revalidate(request.observation,bad,badOptions),null,'cannot rewrite consumed actual prefix');
 const altered=clone(replacement);altered.evidence.opening.scoringPlan.source.scoringRoute.origin.queue.reverse();const alteredOptions={...options};syncSource(altered,alteredOptions);assert.equal(P.revalidate(request.observation,altered,alteredOptions),null,'cannot rewrite original public supply');
 session.execute(replacement);const last=session.request(17,config),final=P.decide(last.observation,last.options);assert.equal(final.continuation.length,1);assert.equal(final.continuation[0].event.lines,2);session.execute(final);
 const next=session.request(18,config),handoff=P.decide(next.observation,next.options);assert.equal(handoff.phase,'maintenance');assert.ok(handoff.evidence.openingHandoff);
});

test('source scoring v2: incomplete ordinary prefix cannot discard a complete retained goal at the next lock',()=>{
 const session=actualRoot(),first=session.request(15,config),initial=P.decide(first.observation,first.options);session.execute(initial);
 const request=session.request(16,config),ordinary=P.plan(request.observation,{...request.options,disableSourceScoring:true,openingSource:null});assert.equal(ordinary.continuation.some(p=>p.event.lines===2),false);
 const retained=P.decide(request.observation,request.options);assert.equal(retained.metrics.sourceScoring.ordinaryReplan,true);assert.equal(retained.metrics.sourceScoring.replacement,false);
 assert.deepEqual(retained.continuation.map(p=>p.event.type),['S','I','J','L','T']);assert.deepEqual(retained.target,initial.continuation[1].target);
 assert.ok(retained.metrics.nodes>ordinary.metrics.nodes,'retained and failed exploration work is charged');assert.ok(retained.metrics.nodes<=45000);
});

function retainedBoundary(mode){
 const state=R.createState({active:'O',queue:['I','T']}),make=actions=>{const r=R.replay(state,actions);assert.ok(r.valid);const e=r.events[0];return{status:'recommended-with-verified-prefix',target:e.target,hold:false,holdCount:0,witness:actions,continuation:[{board:r.state.board,target:e.target,witness:actions,event:e,hold:false,holdCount:0}],metrics:{nodes:10},evidence:{opening:{status:'controlled-retained',scoringPlan:{kind:'controlled'}}}};};
 let clock=0,checks=0,callerCalls=0,retained;
 const access={...require('../st-access'),prefix:()=>{checks++;return{reachable:checks===1&&clock<50?true:mode==='new-candidate-false'?false:null,visited:checks===1?7:3};}};
 const opening={plan:(_s,options)=>{
  if(mode==='serialized-marker'){clock=100;const r=make(['HD']);r.evidence.gapAccess={reachable:true};r.evidence.finalAccessChecked=true;return r;}
  retained=options.checkOpeningFallback(make(['HD']));assert.ok(retained.target);clock=mode.startsWith('new-candidate')?40:100;
  // Seven units of hypothetical failed ordinary work must survive fallback.
  retained.metrics.nodes+=7;
  if(mode==='witness')retained.witness=['L','HD'];
  if(mode==='continuation')retained.continuation[0].witness=['L','HD'];
  if(mode==='evidence')retained.evidence.opening.status='modified';
  if(mode==='clone')return clone(retained);
  if(mode.startsWith('new-candidate')||mode==='timeout-newcandidate'){const next=make(['L','HD']);next.metrics.nodes=retained.metrics.nodes+11;return next;}
  return retained;
 }};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module:mod,require:id=>id==='./st-access.js'?access:id==='./st-opening.js'?opening:require(id.replace('./','../')),Date,performance});
 const result=mod.exports.plan(state,{openingPhase:true,maxNodes:100,deadline:50,now:()=>clock,checkOpeningFallback:()=>{callerCalls++;throw Error('caller must not register fallback authority');}});
 return{result,checks,callerCalls,retained};
}

test('source scoring v2: retained fallback survives ordinary budget exhaustion only with invocation-local checked-object authority',()=>{
 const exact=retainedBoundary('exact');assert.equal(exact.result,exact.retained);assert.equal(exact.checks,1);assert.equal(exact.callerCalls,0);assert.equal(exact.result.metrics.nodes,25,'10 provider + 1 replay + 7 access + 7 ordinary');
 for(const mode of ['witness','continuation','evidence']){const r=retainedBoundary(mode);assert.equal(r.checks,1,mode+' expired budget does not run access again');assert.equal(r.callerCalls,0);assert.equal(r.result.target,null,mode);}
 const copy=retainedBoundary('clone');assert.equal(copy.result,copy.retained,'copied result does not carry authority, but original unchanged registered object remains safe fallback');assert.equal(copy.result.metrics.sourceScoring.finalValidationFallback,true);assert.equal(copy.checks,1);
 const flag=retainedBoundary('serialized-marker');assert.equal(flag.result.target,null);assert.equal(flag.checks,0);assert.equal(flag.callerCalls,0);
 for(const mode of ['new-candidate-false','new-candidate-unknown']){const r=retainedBoundary(mode);assert.equal(r.result,r.retained);assert.equal(r.checks,2);assert.equal(r.callerCalls,0);assert.deepEqual(r.result.witness,['HD']);assert.equal(r.result.metrics.nodes,41,'25 spent + 11 new work + 2 replay + 3 failed access');}
 const expired=retainedBoundary('timeout-newcandidate');assert.equal(expired.result,expired.retained);assert.equal(expired.checks,1);assert.equal(expired.result.metrics.nodes,36);
});

test('source scoring v2: ordinary sequences are cut at first canonical Right TSD, never an instruction after the clear',()=>{
 // Exercise the actual helper used at both activation and replacement; the
 // separate live test proves ordinary handoff after that first actual clear.
 const Module=require('node:module'),file=require.resolve('../st-opening'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
 m._compile(fs.readFileSync(file,'utf8').replace('return Object.freeze({retainScoring,','return Object.freeze({firstScoringPrefix,retainScoring,'),file);
 const {advice}=base(),complete=advice.continuation,after={event:{type:'I',lines:0,cells:[[0,1]]},witness:['HD']};
 assert.deepEqual(m.exports.firstScoringPrefix([...complete,after]),complete);
 assert.equal(m.exports.firstScoringPrefix(complete.slice(0,-1)),null);
 assert.equal(m.exports.firstScoringPrefix([{event:{type:'T',lines:2,spin:'full',cells:[[0,1],[1,1],[2,1],[1,2]]}}]),null,'Left TSD is not canonical Right goal');
 const {request,options}=base(),forged=clone(advice);forged.evidence.opening.scoringPlan.source.scoringRoute.steps.push(clone(after));syncSource(forged,options);
 assert.equal(forged.evidence.opening.scoringPlan.source.scoringRoute.steps.length,7);assert.equal(P.revalidate(request.observation,forged,options),null,'six-lock original-root horizon cannot reset after a replacement');
});
