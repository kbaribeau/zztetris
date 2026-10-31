'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),Y=require('../st-left-foundation'),R=require('../st-rules'),S=require('../st-structure'),RH=require('../st-resource-history'),PH=require('../st-pattern-history');
const fixture=require('./fixtures/left-support-visible-I.json'),clone=x=>JSON.parse(JSON.stringify(x)),config={depth:3,width:8,maxNodes:45000,now:()=>0};
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
function proofAdvice(q=fixture.finite){const checked=Y.supportValidate(q.observation,fixture.steps,{now:()=>0,maxNodes:12000});assert(checked.valid,checked.reason);const first=checked.continuation[0];return{revision:q.observation.revision,context:context(q.observation),target:first.event.target,hold:first.witness.includes('HOLD'),holdCount:first.witness.filter(a=>a==='HOLD').length,witness:first.witness,continuation:checked.continuation,evidence:{cycleDebt:0,construction:{kind:'left-support',origin:clone(q.observation),steps:clone(fixture.steps),consumed:0,resourceContext:clone(q.options.resourceContext)}}};}
function fullOptions(q){return{...q.options,...config};}
test('support construction validates the actual finite visible replacement-I route without a future piece',()=>{
 for(const q of [fixture.finite,fixture.normal]){const proof=Y.supportValidate(q.observation,fixture.steps,{now:()=>0,maxNodes:12000});assert(proof.valid,proof.reason);assert.equal(proof.continuation.length,6);assert.equal(Y.leftCovered(proof.end.board),0);assert.equal(proof.continuation[0].event.type,'I');assert(proof.continuation[0].event.cells.every(([x])=>x===0));assert(proof.continuation.at(-1).event.cells.every(([x])=>x===9));assert.equal(S.geometry(proof.end.board).right.cycle.phase,'cap-rebuild-with-cleanup-prepared');assert.equal(P.cycleResources(proof.continuation).outstandingPocket,1);assert.equal(P.cycleResources(proof.continuation).tsds,0);}
});
test('support search discovers a bounded route instead of reading the supplied witness',()=>{
 const found=Y.supportSearch(fixture.finite.observation,{now:()=>0,maxNodes:18000});assert(found.candidate);assert(found.visited<=18000);const checked=Y.supportValidate(found.candidate.origin,found.candidate.steps,{now:()=>0,maxNodes:12000});assert(checked.valid);assert.equal(found.candidate.kind,'left-support');assert(found.candidate.steps.length<=6);
});
test('absent replacement I, forged payment, clear and exhausted budget earn no support exception',()=>{
 const q=fixture.finite,one={...q.observation,queue:q.observation.queue.map(t=>t==='I'?'O':t)};assert.equal(Y.supportEligibility(one),null);assert.equal(Y.supportValidate(one,fixture.steps,{now:()=>0}).valid,false);
 for(const steps of [fixture.steps.slice(0,-1),[...fixture.steps.slice(0,-1),{witness:['HD']}],fixture.steps.slice(1)])assert.equal(Y.supportValidate(q.observation,steps,{now:()=>0}).valid,false);
 assert.equal(Y.supportValidate(q.observation,fixture.steps,{now:()=>0,deadline:0}).valid,false);assert.equal(Y.supportSearch(q.observation,{now:()=>0,maxNodes:1}).candidate,null);
 const forged=proofAdvice();forged.evidence.construction.consumed=1;assert.equal(P.revalidate(q.observation,forged,fullOptions(q)),null);
 const broken=proofAdvice();broken.evidence.construction.steps.pop();assert.equal(P.revalidate(q.observation,broken,fullOptions(q)),null);
});
test('actual HOLD, each movement and each lock rederive the original finite construction',()=>{
 const q=fixture.finite;let state=clone(q.observation),history=RH.importContext(state,q.options.resourceContext),patterns=q.options.patternHistory,advice=P.revalidate(state,proofAdvice(),fullOptions(q));assert(advice);
 let held=false,locks=0;while(advice){const before=clone(state),original=advice,inputs=advice.witness.slice();
  for(const action of inputs){const prior=state;state=R.move(state,action);history=RH.applyAction(history,prior,action,state);const options={...config,patternHistory:patterns,resourceContext:RH.exportContext(state,history)};
   if(action==='HD'){patterns=PH.update(patterns,prior,state,state.lastEvent);locks++;advice=P.continueCommitment(before,state,original,state.lastEvent,{...options,patternHistory:patterns});}
   else{if(action==='HOLD')held=true;advice=P.advance(state,advice,action,options);assert(advice,'validated target lost during '+action);}
  }
 }
 assert(held);assert.equal(locks,6);assert.equal(state.active,null);assert.equal(state.hold,'T');assert.equal(Y.leftCovered(state.board),0);
});
test('copied kind or altered consumed state cannot authorize support during HOLD or movement',()=>{
 const q=fixture.finite,a=proofAdvice(),action=a.witness[0],next=R.move(q.observation,action),history=RH.applyAction(RH.importContext(q.observation,q.options.resourceContext),q.observation,action,next),options={...config,patternHistory:q.options.patternHistory,resourceContext:RH.exportContext(next,history)};
 for(const mutate of [p=>p.evidence.construction.steps.pop(),p=>p.evidence.construction.consumed=1,p=>p.evidence.construction.origin.hold='T',p=>p.evidence.construction.resourceContext.steps.pop()]){const bad=clone(a);mutate(bad);assert.equal(P.advance(next,bad,action,options),null);}
});
test('late optional work preserves exact certified incumbent on unknown or exhausted proof',()=>{
 const q=fixture.normal,baseline=P.plan(q.observation,{...fullOptions(q),disableLeftSupport:true});assert(baseline.target);let clock=0,attempted=false;
 const replacement={...Y,supportSearch:()=>{attempted=true;clock=999999;return{candidate:null,visited:100};}};
 const module={exports:{}},load=name=>name==='./st-left-foundation.js'?replacement:require('../'+name.replace(/^\.\//,''));
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,exports:module.exports,require:load,Date,performance,globalThis:{}});
 const actual=module.exports.plan(q.observation,{...q.options,depth:3,width:8,maxNodes:45000,now:()=>clock,deadline:1500});assert(attempted);assert.deepEqual(JSON.parse(JSON.stringify(actual.target)),baseline.target);assert.deepEqual(JSON.parse(JSON.stringify(actual.continuation)),baseline.continuation);assert.equal(actual.metrics.leftSupportPreference.selected,false);assert.equal(actual.metrics.leftSupportPreference.nodes,100);
});
test('new finite presentation does not claim a TSD or Reset',()=>{const a=proofAdvice(),text=P.advicePresentation(a.continuation,{},a.evidence.construction).reason;assert.match(text,/distinct visible I/);assert.match(text,/not proof of a completed Reset/);assert.doesNotMatch(text,/reaches a T-spin double/);});
test('production session and actual page preserve support proof through import, HOLD and Undo',()=>{
 const Session=require('../st-session'),B=require('../st-bag'),q=fixture.normal,a=P.revalidate(q.observation,proofAdvice(q),fullOptions(q));assert(a);
 const history=RH.importContext(q.observation,q.options.resourceContext),origin=q.options.resourceContext.origin,originBag=B.fromObserved({observed:[origin.active.type,...origin.queue],startPhase:0});
 const saved=Session.create(q.observation,{resourceHistory:history,resourceOriginBag:originBag,patternHistory:q.options.patternHistory,openingPhase:false,previous:a,search:Session.defaults()}),raw=JSON.stringify(saved),restored=Session.parse(raw);
 assert.deepEqual(restored.state,q.observation);assert.deepEqual(restored.previous.evidence.construction,a.evidence.construction);assert.deepEqual(Session.create(restored.state,restored),saved);
 assert(P.revalidate(restored.state,restored.previous,{...config,patternHistory:restored.patternHistory,resourceContext:RH.exportContext(restored.state,restored.resourceHistory)}));
 return require('./support/page.cjs').withPage('st-lab.html',{},g=>{
  const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
  g.element('#st-snapshot').value=raw;g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/^Session imported\./);g.advance(40);
  const request=()=>{g.advance(40);return workers.at(-1).message;};
  const respond=()=>{const req=request(),previous=req.previous||req.commitment?.advice;assert(previous);const advice=P.revalidate(req.observation,previous,{...req.options,...config});assert(advice);workers.at(-1).respond(advice);return advice;};
  let advice=respond(),afterFirst;
  for(let lock=0;lock<2;lock++){for(const action of advice.witness)g.window.stLab.act(action);if(!lock)afterFirst=clone(g.snapshot());advice=respond();}
  assert.equal(advice.witness[0],'HOLD');g.window.stLab.act('HOLD');const held=request();assert.equal(held.observation.active.type,'L');assert(held.previous?.evidence?.construction?.kind==='left-support','HOLD must retain the rederived construction');
  g.click('#st-undo');const undo=request();assert.deepEqual({...undo.observation,revision:afterFirst.revision},afterFirst);assert(undo.observation.revision>afterFirst.revision);assert.equal(undo.options.openingPhase,false);assert.equal(RH.resolve(undo.observation,RH.importContext(undo.observation,undo.options.resourceContext)).locks,33);assert.equal(undo.commitment.advice.evidence.construction.consumed,1);
  g.click('#st-export-session');const round=Session.parse(g.downloads.at(-1).text);assert.deepEqual(round.state,undo.observation);assert.equal(round.commitment.advice.evidence.construction.kind,'left-support');
 });
});
test('original visibility is bound to connected history, not a forged origin preview',()=>{
 const q=fixture.finite,a=P.revalidate(q.observation,proofAdvice(),fullOptions(q)),next=R.replay(q.observation,a.witness).state;let h=RH.importContext(q.observation,q.options.resourceContext),s=q.observation,patterns=q.options.patternHistory;for(const action of a.witness){const before=s;s=R.move(s,action);h=RH.applyAction(h,before,action,s);if(action==='HD')patterns=PH.update(patterns,before,s,s.lastEvent);}const opts={...config,patternHistory:patterns,resourceContext:RH.exportContext(s,h)};
 const suffix=P.continueCommitment(q.observation,s,a,s.lastEvent,opts);assert(suffix);const forged=clone(suffix);forged.evidence.construction.origin.queue.push('I');assert.equal(P.revalidate(s,forged,opts),null);
 const disconnected=clone(suffix);disconnected.evidence.construction.resourceContext.steps=[];assert.equal(P.revalidate(s,disconnected,opts),null);
});

test('the optional support mode never overrides an explicit no-HOLD caller',()=>{const q=fixture.normal;assert.equal(Y.supportSearch(q.observation,{...config,allowHold:false}).candidate,null);assert.equal(P.revalidate(q.observation,proofAdvice(q),{...fullOptions(q),allowHold:false}),null);const result=P.plan(q.observation,{...fullOptions(q),allowHold:false});assert.notEqual(result.evidence?.construction?.kind,'left-support');assert.equal(result.hold,false);});
test('a newly forced public bag member does not replace the retained construction observation',()=>{
 const B=require('../st-bag'),q=fixture.normal,a=P.revalidate(q.observation,proofAdvice(q),fullOptions(q));let state=clone(q.observation),history=RH.importContext(state,q.options.resourceContext),patterns=q.options.patternHistory;
 for(const action of a.witness){const before=state;state=R.move(state,action);if(action==='HD'){state={...state,queue:[...state.queue,'L'],bag:B.consume(state.bag,'L')};patterns=PH.update(patterns,before,state,state.lastEvent);}history=RH.applyAction(history,before,action,state);}
 assert.equal(state.queue.length,6);assert.equal(B.forcedNext(state.bag),'Z');
 const options={...fullOptions(q),patternHistory:patterns,resourceContext:RH.exportContext(state,history)},suffix=P.continueCommitment(q.observation,state,a,state.lastEvent,options);assert(suffix);
 const next=P.decide(state,{...options,commitment:{observation:clone(state),advice:suffix}});assert.equal(next.evidence?.construction?.kind,'left-support');assert.equal(next.evidence.construction.consumed,1);assert.deepEqual(next.continuation.map(p=>p.event),suffix.continuation.map(p=>p.event));assert.equal(next.evidence.knownPieceHorizon,7);
});

test('actual held-Z cap is not silently postponed by the support-I exception',()=>{
 const original=fixture.finite.observation,caps=S.geometry(original.board).right.completions;assert(caps.length,'authentic positive has a geometric cap, not an available Z');assert.notEqual(original.active.type,'Z');assert.notEqual(original.hold,'Z');
 assert(Y.supportValidate(original,fixture.steps,{now:()=>0,maxNodes:12000}).valid);
 const state={...clone(original),hold:'Z'},held=R.move(state,'HOLD');assert.equal(held.active.type,'Z');
 const cap=caps.find(c=>{const r=R.replay(held,c.witness);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&!r.events[0].lines&&JSON.stringify(r.events[0].cells)===JSON.stringify(c.cells);});assert(cap,'held Z has an actual cap witness');
 const first=R.replay(state,fixture.steps[0].witness),phase=S.advanceNotches(state.board,{state:first.state,event:first.events[0]},S.notchPattern(state.board));
 const transition=S.transition(state,{state:first.state,event:first.events[0],availableCap:true},S.assess(first.state,{notches:phase.pattern}),{notches:S.notchPattern(state.board)});
 assert(transition.cycleViolations.includes('spent-cleanup-I-on-optional-work'));assert(transition.cycleViolations.includes('postponed-available-cap-for-optional-work'));
 const rejected=Y.supportValidate(state,fixture.steps,{now:()=>0,maxNodes:12000});assert.equal(rejected.valid,false);assert.equal(rejected.reason,'competing-cycle-obligation');assert(rejected.visited<fixture.steps.reduce((n,s)=>n+s.witness.length,0),'reject at first I, not a later altered HOLD');
 const exhausted=Y.supportValidate(state,fixture.steps,{now:()=>0,maxNodes:1});assert.equal(exhausted.valid,false);assert.equal(exhausted.reason,'budget-exhausted');
});
