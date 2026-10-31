'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),Y=require('../st-left-foundation'),R=require('../st-rules'),S=require('../st-structure'),RH=require('../st-resource-history'),PH=require('../st-pattern-history'),M=require('../st-midgame-resources');
const fixture=require('./fixtures/left-scoring-foundation.json'),clone=x=>JSON.parse(JSON.stringify(x)),config={depth:3,width:8,maxNodes:45000,now:()=>0},opts={...fixture.options,...config};
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
function proofAdvice(steps=fixture.steps){const checked=Y.scoringValidate(fixture.observation,steps,opts);assert(checked.valid,checked.reason);const first=checked.continuation[0];return{revision:fixture.observation.revision,context:context(fixture.observation),target:first.event.target,hold:first.witness.includes('HOLD'),holdCount:first.witness.filter(a=>a==='HOLD').length,witness:first.witness,continuation:checked.continuation,evidence:{cycleDebt:0,construction:{kind:'left-scoring-foundation',origin:clone(fixture.observation),patternHistory:clone(fixture.options.patternHistory),steps:clone(steps),consumed:0,resourceContext:clone(fixture.options.resourceContext)}}};}
test('actual engine pre50 I51 supplies x0,row34 for literal Z52/T53 double, without reclassifying Center',()=>{
 const proof=Y.scoringValidate(fixture.observation,fixture.steps,opts);assert(proof.valid,proof.reason);assert.deepEqual(proof.targets,[[0,34]]);assert.deepEqual(proof.continuation.map(p=>p.event.type),['I','Z','T']);assert.deepEqual(proof.continuation[2].event.clearedRows,[34,35]);assert.equal(proof.end.active.type,'L');assert.equal(proof.end.hold,'O');assert.deepEqual(proof.end.queue,['J','S','I']);
 assert(proof.continuation[0].structuralEvidence.cycleViolations.includes('spent-cleanup-I-on-optional-work'),'ordinary guard remains visible');assert.equal(S.geometry(proof.end.board).center.patternSupport,'unrecognized');assert.equal(S.geometry(fixture.observation.board).right.cycle.cleanupColumns.length,0);
 let state=clone(fixture.observation),resource=M.start(state,RH.resolve(state,RH.importContext(state,fixture.options.resourceContext))),placed=[];
 for(const p of proof.continuation){const next=R.replay(state,p.witness);placed.push(P.placedResource(resource,p.witness).id);resource=M.step(state,{...p,state:next.state},resource);state=next.state;}
 assert.deepEqual(placed,[51,52,53]);assert.deepEqual(resource.queue.map(p=>p.id),[55,56,57]);assert.equal(resource.active.id,54);assert.equal(resource.hold.id,50);assert.deepEqual(resource.violations,[]);
 const advice=P.revalidate(fixture.observation,proofAdvice(),opts);assert(advice,'full final resource/access admission');assert.equal(advice.evidence.construction.kind,'left-scoring-foundation');assert.match(advice.reason,/missing Left cells/);assert.match(advice.reason,/does not certify the exposed Center/);
});
test('search generates a scoring foundation from the actual public position, not fixture targets',()=>{
 const found=Y.scoringSearch(fixture.observation,opts);assert(found.candidate,found.reason);assert(found.visited>0&&found.visited<=45000);assert(Y.scoringValidate(found.candidate.origin,found.candidate.steps,opts).valid);
});
test('existing cleanup, missing Z/T, failed score and a nonfoundation I cannot earn the finite exception',()=>{
 const root=clone(fixture.observation),right=R.replay(root,['CW','R','R','R','R','HD']);assert(right.valid);assert.equal(S.geometry(right.state.board).right.cycle.phase,'cap-rebuild-with-cleanup-prepared');assert.equal(Y.scoringEligibility(right.state),null);
 const cleanup=R.replay(require('./support/st-user-cleanup-i.json'),['HD']);assert(cleanup.valid);assert(S.geometry(cleanup.state.board).right.cycle.cleanupColumns.length,'genuine four-row cleanup obligation');assert.equal(Y.scoringEligibility(cleanup.state),null);
 for(const type of ['Z','T']){const s=clone(root);s.queue=s.queue.map(t=>t===type?'O':t);s.hiddenQueue=[type];assert.equal(Y.scoringEligibility(s),null);assert.equal(Y.scoringValidate(s,fixture.steps,opts).valid,false);}
 const bad=clone(fixture.steps);bad[2].witness=['HD'];assert.equal(Y.scoringValidate(root,bad,opts).valid,false);
 const mismatch=clone(root);mismatch.board[34]='I'+mismatch.board[34].slice(1);assert.equal(Y.scoringValidate(mismatch,fixture.steps,opts).valid,false);
 const wrong=clone(fixture.steps);wrong[0].witness=['CW','L','L','L','HD'];assert.equal(Y.scoringValidate(root,wrong,opts).valid,false);
 assert.equal(Y.scoringValidate(root,fixture.steps,{...opts,deadline:0}).valid,false);assert.equal(Y.scoringSearch(root,{...opts,maxNodes:1}).candidate,null);
});
test('actual HOLD, movements, first-lock retention and Z/T score rederive the whole finite origin proof',()=>{
 const steps=clone(fixture.steps);steps[0].witness.unshift('HOLD','HOLD');let state=clone(fixture.observation),history=RH.importContext(state,fixture.options.resourceContext),patterns=fixture.options.patternHistory,advice=P.revalidate(state,proofAdvice(steps),opts);assert(advice);let locks=0,holds=0;
 while(advice){const before=clone(state),original=advice,inputs=advice.witness.slice();for(const action of inputs){const prior=state;state=R.move(state,action);history=RH.applyAction(history,prior,action,state);const options={...config,patternHistory:patterns,resourceContext:RH.exportContext(state,history)};
  if(action==='HD'){patterns=PH.update(patterns,prior,state,state.lastEvent);locks++;advice=P.continueCommitment(before,state,original,state.lastEvent,{...options,patternHistory:patterns});if(locks<3){assert(advice,'finite goal lost after lock '+locks);const retained=P.decide(state,{...options,patternHistory:patterns,openingPhase:false,commitment:{observation:clone(state),advice}});assert.equal(retained.evidence?.construction?.consumed,locks);assert.deepEqual(retained.continuation.map(p=>p.event),advice.continuation.map(p=>p.event));}}
  else{holds+=Number(action==='HOLD');advice=P.advance(state,advice,action,options);assert(advice,'finite goal lost during '+action);}
 }}
 assert.equal(locks,3);assert.equal(holds,4);assert.equal(state.lastEvent.lines,2);assert.equal(state.lastEvent.spin,'full');assert.deepEqual(state.queue,['J','S','I']);assert.equal(RH.resolve(state,history).coverage.status,'partial');
});
test('forged, stale, hidden-refilled and disconnected construction claims are not authority',()=>{
 for(const mutate of [p=>p.evidence.construction.steps.pop(),p=>p.evidence.construction.consumed=1,p=>p.evidence.construction.origin.queue.push('T'),p=>p.evidence.construction.origin.hold='I',p=>p.evidence.construction.resourceContext.steps.pop(),p=>p.evidence.construction.patternHistory.origin[34]='..........']){const bad=proofAdvice();mutate(bad);assert.equal(P.revalidate(fixture.observation,bad,opts),null);}
 const forgedFacts=proofAdvice();forgedFacts.continuation[0].structuralEvidence.scoringFoundation={cells:[[3,39]],scoreLock:1,clearedRows:[38,39]};const refreshed=P.revalidate(fixture.observation,forgedFacts,opts);assert(refreshed);assert.deepEqual(refreshed.continuation[0].structuralEvidence.scoringFoundation,{cells:[[0,34]],scoreLock:3,clearedRows:[34,35]},'copied diagnostic facts are replaced, never authority');
 assert.equal(P.revalidate(fixture.observation,proofAdvice(),{...opts,deadline:0}),null);assert.equal(P.revalidate(fixture.observation,proofAdvice(),{...opts,maxNodes:1}),null);
 const steps=clone(fixture.steps);steps[0].witness.unshift('HOLD','HOLD');assert.equal(P.revalidate(fixture.observation,proofAdvice(steps),{...opts,allowHold:false}),null);
});
test('normal plan prefers the certified actual score over only prospective I preparation, never a retained pocket',()=>{
 const baseline=P.plan(fixture.observation,{...opts,disableLeftScoringFoundation:true});assert(baseline.target);assert.equal(baseline.continuation[0].structuralEvidence.allocation,'quad-preparation');assert.equal(P.cycleResources(baseline.continuation).tsds,0);
 const candidate=P.plan(fixture.observation,opts);assert.equal(candidate.evidence?.construction?.kind,'left-scoring-foundation',JSON.stringify(candidate.metrics.leftScoringFoundation));assert.equal(candidate.metrics.leftScoringFoundation.selected,true);assert.equal(P.cycleResources(candidate.continuation).tsds,1);assert(candidate.metrics.nodes<=45000);
 const retained=P.plan(fixture.observation,{...opts,commitment:{observation:clone(fixture.observation),advice:baseline}});assert.notEqual(retained.evidence?.construction?.kind,'left-scoring-foundation');assert(P.cycleResources(retained.continuation).outstandingPocket>=1);
});
test('unknown or expired optional search returns the exact private admitted incumbent and charges spent work',()=>{
 const baseline=P.plan(fixture.observation,{...opts,disableLeftScoringFoundation:true});assert(baseline.target);let clock=0,attempted=false;
 const replacement={...Y,scoringSearch:()=>{attempted=true;clock=999999;return{candidate:null,visited:101,reason:'score-access-unknown'};}};
 const module={exports:{}},load=name=>name==='./st-left-foundation.js'?replacement:require('../'+name.replace(/^\.\//,''));vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,exports:module.exports,require:load,Date,performance,globalThis:{}});
 const result=module.exports.plan(fixture.observation,{...fixture.options,...config,now:()=>clock,deadline:1500});assert(attempted);assert.deepEqual(clone(result.target),baseline.target);assert.deepEqual(clone(result.continuation),baseline.continuation);assert.equal(result.metrics.leftScoringFoundation.selected,false);assert.equal(result.metrics.leftScoringFoundation.nodes,101);
});
test('native finite-session import, HOLD, Undo and re-export preserve the authenticated finite goal',()=>{
 const Session=require('../st-session'),q=fixture,a=P.revalidate(q.observation,proofAdvice(),opts);assert(a);
 const history=RH.importContext(q.observation,q.options.resourceContext),saved=Session.create(q.observation,{resourceHistory:history,resourceOriginBag:q.resourceOriginBag,patternHistory:q.options.patternHistory,openingPhase:false,previous:a,search:Session.defaults()}),raw=JSON.stringify(saved),restored=Session.parse(raw);
 assert.deepEqual(restored.previous.evidence.construction,a.evidence.construction);assert.deepEqual(Session.create(restored.state,restored),saved);assert(P.revalidate(restored.state,restored.previous,{...config,patternHistory:restored.patternHistory,resourceContext:RH.exportContext(restored.state,restored.resourceHistory)}));
 return require('./support/page.cjs').withPage('st-lab.html',{},g=>{
  const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
  g.element('#st-snapshot').value=raw;g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/^Session imported\./);g.advance(40);
  const request=()=>{g.advance(40);return workers.at(-1).message;};
  const respond=()=>{const req=request(),previous=req.previous||req.commitment?.advice;assert(previous);const advice=P.revalidate(req.observation,previous,{...req.options,...config});assert(advice);workers.at(-1).respond(advice);return advice;};
  let advice=respond(),afterFirst;
  for(let lock=0;lock<2;lock++){for(const action of advice.witness)g.window.stLab.act(action);if(!lock)afterFirst=clone(g.snapshot());advice=respond();assert.equal(advice.evidence.construction.consumed,lock+1);assert.equal(advice.evidence.construction.origin.queue.length,6);assert.deepEqual(clone(request().observation.queue),lock===0?['T','L','J','S','I','O']:['L','J','S','I','O'],'native import reveals only the unique public O, then consumes finite supply');}
  assert.equal(advice.witness[0],'HOLD');g.window.stLab.act('HOLD');const held=request();assert.equal(held.previous?.evidence?.construction?.kind,'left-scoring-foundation');
  g.click('#st-undo');const undo=request();assert.deepEqual({...undo.observation,revision:afterFirst.revision},afterFirst);assert.equal(undo.commitment.advice.evidence.construction.consumed,1);assert.equal(undo.options.openingPhase,false);
  g.click('#st-export-session');const round=Session.parse(g.element('#st-snapshot').value);assert.deepEqual(round.state,undo.observation);assert.equal(round.commitment.advice.evidence.construction.kind,'left-scoring-foundation');assert.equal(RH.resolve(round.state,round.resourceHistory).coverage.status,'partial');
 });
});
test('newly revealed public singleton is not retroactive proof supply',()=>{
 const B=require('../st-bag'),q=fixture,a=P.revalidate(q.observation,proofAdvice(),opts);let state=clone(q.observation),history=RH.importContext(state,q.options.resourceContext),patterns=q.options.patternHistory;
 for(const action of a.witness){const before=state;state=R.move(state,action);if(action==='HD'){state={...state,queue:[...state.queue,'O'],bag:B.consume(state.bag,'O')};patterns=PH.update(patterns,before,state,state.lastEvent);}history=RH.applyAction(history,before,action,state);}
 const options={...config,openingPhase:false,patternHistory:patterns,resourceContext:RH.exportContext(state,history)},suffix=P.continueCommitment(q.observation,state,a,state.lastEvent,options);assert(suffix);assert.deepEqual(suffix.evidence.construction.origin.queue,['Z','T','L','J','S','I']);assert.equal(state.queue.length,6);
 const forged=clone(suffix);forged.evidence.construction.origin.queue.push('O');assert.equal(P.revalidate(state,forged,options),null);
 const broken=clone(options);broken.patternHistory.origin[34]='..........';assert.equal(P.revalidate(state,suffix,broken),null);
});
test('actual first-step HOLD adaptation cannot override a no-HOLD caller',()=>{
 const steps=clone(fixture.steps);steps[2].witness=steps[2].witness.slice(3);assert(!steps.some(p=>p.witness.includes('HOLD')));const advice=proofAdvice(steps),before=fixture.observation,state=R.move(before,'HOLD'),history=RH.applyAction(RH.importContext(before,fixture.options.resourceContext),before,'HOLD',state),options={...opts,resourceContext:RH.exportContext(state,history),commitment:{observation:clone(before),advice}};
 const allowed=P.plan(state,options);assert.equal(allowed.evidence?.construction?.kind,'left-scoring-foundation');assert.equal(allowed.witness[0],'HOLD');
 const blocked=P.plan(state,{...options,allowHold:false});assert.notEqual(blocked.evidence?.construction?.kind,'left-scoring-foundation');assert(!blocked.witness.includes('HOLD'));
});
