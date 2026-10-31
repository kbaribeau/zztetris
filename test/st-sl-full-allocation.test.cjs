'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),M=require('../st-midgame-resources'),RH=require('../st-resource-history'),PH=require('../st-pattern-history'),B=require('../st-bag');
const fixture=require('./fixtures/sl-full-allocation.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity},options=q=>({...q.options,...bounds}),cache=new Map();
const withoutMetrics=a=>clone({...a,metrics:undefined});
function plan(name,off=false){const key=name+off;if(!cache.has(key)){const q=fixture[name];cache.set(key,P.plan(q.observation,{...options(q),disableSupportedSLPreference:off}));}return clone(cache.get(key));}
function summary(q){return RH.resolve(q.observation,RH.importContext(q.observation,q.options.resourceContext));}
function path(q,steps){let state=M.extendForced(P.observe(q.observation));return steps.map(p=>{const r=R.replay(state,p.witness);assert(r.valid);assert.deepEqual(r.events,[p.event]);const out={...clone(p),state:r.state,target:p.event.target,hold:p.witness.includes('HOLD')};state=r.state;return out;});}
function node(q,a,details){return{path:path(q,a.continuation),state:path(q,a.continuation).at(-1).state,assessment:clone(a.assessment),rank:clone(a.evidence.structuralRank),structuralScore:a.evidence.structuralScore,
 centerContinuity:details.centerContinuity,dependencyDebt:details.dependencyDebt,entryDebt:details.entryDebt,resources:M.checkPath(q.observation,a.continuation,summary(q)).resource,
 notchValid:true,qualified:true,continuationChecked:true,cycleDebt:0,centerDebt:[],cavityDebt:[],key:'comparison-test'};}
function comparisonPair(){const q=fixture.equal,a=plan('equal'),m=a.metrics.supportedSLPreference,c=node(q,a,m.comparison.candidate),r=node(q,m.referenceAdmission,m.comparison.reference);return{q,a,c,r,opts:{candidateDraw:P.publicDrawHorizon(q.observation,c.path,summary(q)),referenceDraw:P.publicDrawHorizon(q.observation,r.path,summary(q)),initialResources:M.start(q.observation,summary(q))}};}
function moduleWith(replacements){const module={exports:{}},requireAt=require('node:module').createRequire(require.resolve('../st-planner'));
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,exports:module.exports,require:n=>replacements[n]||requireAt(n),Date,performance,globalThis:{}});return module.exports;}

test('SL full allocation: default-on pays actual visible L and improves existing Left at equal public horizon',()=>{
 const q=fixture.equal,a=plan('equal'),off=plan('equal',true),m=a.metrics.supportedSLPreference;
 assert.equal(off.metrics.supportedSLPreference,undefined);assert.equal(m.selected,true);assert.equal(m.reason,'strict-left-allocation-gain');assert.equal(m.referenceSource,'exact-incumbent');
 assert.deepEqual(a.continuation.map(p=>p.event.type),['S','Z','L']);assert.deepEqual(off.continuation.map(p=>p.event.type),['L','Z','O']);
 assert.equal(m.comparison.candidateHorizon,3);assert.equal(m.comparison.referenceHorizon,3);assert.deepEqual(m.comparison.candidateDraw.drawn,m.comparison.referenceDraw.drawn);
 assert.equal(m.comparison.candidate.leftScore,7);assert.equal(m.comparison.reference.leftScore,5.4);assert(m.comparison.candidate.structuralScore<m.comparison.reference.structuralScore);
 assert.deepEqual(m.incumbentPrefix,m.referencePrefix);assert.deepEqual(m.incumbentAdmission.continuation,off.continuation);assert.equal(m.referenceAdmission.evidence.gapAccess.reachable,true);
 assert(a.metrics.nodes<=45000);assert.equal(a.metrics.completedBeamDepth,off.metrics.completedBeamDepth);assert(P.revalidate(q.observation,a,options(q)));
 const resources=M.start(q.observation,summary(q)),visible=[resources.active,resources.hold,...resources.queue];assert(visible.some(p=>p?.id===m.paidL.id&&p.type==='L'));assert(m.paidL.id>0);assert(m.firstS.id>0);assert.equal(m.paymentLock,3);
 let before=M.extendForced(P.observe(q.observation)),res=resources,reservation;for(const [i,p]of path(q,a.continuation).entries()){
  if(i===2){assert.equal(res.hold.id,m.paidL.id);assert(p.witness.includes('HOLD'));const debt=res.pendingCenter.find(c=>c.rootId===reservation);assert(debt.alternatives.some(c=>JSON.stringify(c.cells.slice().sort())===JSON.stringify(p.event.cells.slice().sort())));}
  res=M.step(before,p,res);if(!i){reservation=m.firstS.id;assert(res.pendingCenter.some(c=>c.rootId===reservation));}before=p.state;
 }assert(!res.pendingCenter.some(c=>c.rootId===reservation));
});
test('SL full allocation: non-Left covered tradeoff is explicit, while sealed/Left damage and headroom remain vetoes',()=>{
 const {c,r,opts}=comparisonPair(),actual=P.supportedSLComparison(c,r,opts);assert(actual.allowed);assert(actual.candidate.covered>actual.reference.covered);assert(actual.candidate.damageCovered>actual.reference.damageCovered);assert.equal(actual.candidate.leftCovered,actual.reference.leftCovered);assert.equal(actual.candidate.sealed,actual.reference.sealed);
 // Guard-level mutations isolate comparator boundaries; they are not claimed
 // physical routes or admission certificates. The positive above is authentic.
 for(const mutate of [n=>n.assessment.sealed++,n=>n.assessment.damageSealed++,n=>n.assessment.leftSealed++,n=>n.assessment.structure.left.covered++,n=>n.assessment.maxHeight=r.assessment.maxHeight+1,n=>n.entryDebt++,n=>n.dependencyDebt++,n=>n.centerContinuity--]){
  const bad=clone(c);mutate(bad);assert.equal(P.supportedSLComparison(bad,r,opts).allowed,false);
 }
 const debt=clone(c);debt.cavityDebt.push([0,39]);assert.equal(P.supportedSLComparison(debt,r,opts).reason,'uncertified-comparison');
});
test('SL comparison: strict better, tie, worse, missing/unknown proof and unequal lock/draw horizons',()=>{
 const {c,r,opts}=comparisonPair();assert(P.supportedSLComparison(c,r,opts).allowed);
 const tie=clone(c);tie.assessment.leftContext.score=r.assessment.leftContext.score;tie.key='lexically-preferred';assert.equal(P.supportedSLComparison(tie,r,opts).reason,'no-strict-left-or-score-gain');
 const worse=clone(c);worse.assessment.leftContext.score=r.assessment.leftContext.score-1;assert.equal(P.supportedSLComparison(worse,r,opts).reason,'left-allocation-worse');
 assert.equal(P.supportedSLComparison(c,null,opts).reason,'missing-equal-horizon-reference');
 const unknown=clone(r);unknown.continuationChecked=false;assert.equal(P.supportedSLComparison(c,unknown,opts).reason,'uncertified-comparison');
 const short=clone(c);short.path.pop();assert.equal(P.supportedSLComparison(short,r,opts).reason,'unequal-lock-horizon');
 assert.equal(P.supportedSLComparison(c,r,{...opts,candidateDraw:null}).reason,'unknown-public-draw-horizon');
 assert.equal(P.supportedSLComparison(c,r,{...opts,candidateDraw:{...opts.candidateDraw,draws:opts.candidateDraw.draws+1}}).reason,'unequal-public-draw-horizon');
});
test('SL comparison: actual canonical score schedule and original cleanup obligations cannot be traded away',()=>{
 const {c,r,opts}=comparisonPair();
 for(const event of [{type:'T',spin:'full',lines:2,cells:[]},{type:'I',spin:'none',lines:4,cells:[]}]){
  const saved=clone(r),fresh=clone(c);saved.path[0].event=event;fresh.path[2].event=event;assert.equal(P.supportedSLComparison(fresh,saved,opts).reason,'score-or-original-goal-regression');
 }
 const saved=clone(r);saved.path[2].event={type:'I',spin:'none',lines:0,cells:[]};saved.path[2].structuralEvidence.allocation='quad-preparation';assert.equal(P.supportedSLComparison(c,saved,opts).allowed,false);
});
test('SL horizons: actual empty HOLD consumes an extra public draw and exact prefix includes same-type HOLD identity',()=>{
 const state=R.createState({active:'O',hold:null,queue:['O','J','I','T','S','L'],canHold:true}),q={observation:state},sum=RH.resolve(state,RH.start(state));
 const a=R.replay(state,['HD']),b=R.replay(state,['HOLD','HD']);assert(a.valid&&b.valid);
 const ap=[{witness:['HD'],event:a.events[0],state:a.state}],bp=[{witness:['HOLD','HD'],event:b.events[0],state:b.state}],ad=P.publicDrawHorizon(state,ap,sum),bd=P.publicDrawHorizon(state,bp,sum);
 assert.equal(ad.draws,1);assert.equal(bd.draws,2);assert.notDeepEqual(ad.placed,bd.placed);
 const n={path:ap},same=clone(n);same.path[0].witness=['HOLD','HOLD','HD'];assert.equal(P.exactAllocationPrefix(n,same),false);assert(P.exactAllocationPrefix(n,n));
});
test('SL horizons: untouched uniquely forced public tail is not a hidden extra draw',()=>{
 const state=R.createState({active:'O',hold:'J',queue:['I','S','T','Z'],canHold:true});state.bag=B.fromObserved({observed:['O','J','I','S','T','Z'],startPhase:0});assert.equal(B.forcedNext(state.bag),'L');
 const sum=RH.resolve(state,RH.start(state)),extended=M.extendForced(state),r=R.replay(extended,['HD']);assert(r.valid);const draw=P.publicDrawHorizon(state,[{witness:['HD'],event:r.events[0],state:r.state}],sum);assert(draw);assert.equal(draw.draws,1);assert.equal(draw.queue.length,3);
});
test('SL optional failure: deadline exhaustion returns exact privately admitted incumbent without a second proof',()=>{
 const q=fixture.equal,baseline=plan('equal',true);let clock=0,attempts=0;
 const api=moduleWith({'./st-midgame-resources.js':{...M,repair:(s,r,o)=>{if(o.acceptStep){attempts++;clock=1500;return{valid:null,visited:127,status:'resource-repair-budget'};}return M.repair(s,r,o);}}});
 const actual=api.plan(q.observation,{...options(q),now:()=>clock,deadline:1500});assert(attempts>0);assert.equal(actual.metrics.supportedSLPreference.selected,false);assert.deepEqual(withoutMetrics(actual),withoutMetrics(baseline));assert.equal(actual.metrics.nodes,baseline.metrics.nodes+127);assert(actual.metrics.nodes<=45000);
});
test('SL optional failure: copied positive repair flag and candidate certificate failure cannot replace incumbent',()=>{
 const q=fixture.short,baseline=plan('short',true);let calls=0;
 const api=moduleWith({'./st-midgame-resources.js':{...M,repair:(s,r,o)=>{if(o.acceptStep){calls++;return{valid:true,visited:0,path:[],status:'flag-without-payment'};}return M.repair(s,r,o);}}}),a=api.plan(q.observation,options(q));assert(calls);assert.equal(a.metrics.supportedSLPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(baseline));
 const equal=fixture.equal;let reject=false;const access=require('../st-access');const failed=moduleWith({'./st-midgame-resources.js':{...M,repair:(s,r,o)=>{if(o.acceptStep)reject=true;return M.repair(s,r,o);}},'./st-access.js':{...access,prefix:(...args)=>reject?{reachable:null,visited:0,status:'unknown-test-certificate'}:access.prefix(...args)}}).plan(equal.observation,options(equal));
 assert.equal(failed.metrics.supportedSLPreference.selected,false);assert.equal(failed.metrics.supportedSLPreference.reason,'candidate-certificate-unavailable');assert.deepEqual(withoutMetrics(failed),withoutMetrics(plan('equal',true)));
});
test('SL applicability: absent/invalid history, unavailable visible L, no HOLD and opening are not authority',()=>{
 const q=fixture.equal;for(const extra of [{resourceContext:undefined},{resourceContext:{}},{allowHold:false},{openingPhase:true}])assert.notEqual(P.plan(q.observation,{...options(q),...extra}).metrics.supportedSLPreference?.selected,true);
 const state={...clone(q.observation),hold:'O',queue:q.observation.queue.map(t=>t==='L'?'O':t),bag:null},history=RH.start(state);assert.notEqual(P.plan(state,{...options(q),resourceContext:RH.exportContext(state,history)}).metrics.supportedSLPreference?.selected,true);
});
test('SL actual partial history stays partial and never mints Extra Z or a forced-L identity',()=>{
 const q=fixture.equal,s=summary(q),a=plan('equal'),m=a.metrics.supportedSLPreference;assert.equal(s.coverage.status,'partial');assert.equal(m.historyCoverage,'partial');assert.equal(m.firstS.bag,null);assert.equal(m.paidL.bag,null);assert.equal(s.extraZ.status,'unknown');assert.equal(a.evidence.resourceObligations.extraZ,'unknown');assert.equal(summary(q).coverage.status,'partial');
 const raw={...clone(q.observation),hold:'O',queue:[],bag:B.fromObserved({observed:['I','J','O','S','T','Z'],startPhase:0})},history=RH.start(raw);assert.equal(B.forcedNext(raw.bag),'L');assert.notEqual(P.plan(raw,{...options(q),resourceContext:RH.exportContext(raw,history)}).metrics.supportedSLPreference?.selected,true);
});
test('SL optional repair filter can only reject and does not waive normal grammar',()=>{
 const q=fixture.short,steps=path(q,q.steps),r=M.step(q.observation,steps[0],M.start(q.observation,summary(q))),notches=S.advanceNotches(q.observation.board,steps[0],PH.resolve(q.observation,q.options.patternHistory)).pattern;
 const normal=M.repair(steps[0].state,r,{...bounds,notches}),same=M.repair(steps[0].state,r,{...bounds,notches,acceptStep:()=>true}),denied=M.repair(steps[0].state,r,{...bounds,notches,acceptStep:()=>false});assert(normal.valid);assert.deepEqual(same.path,normal.path);assert.notEqual(denied.valid,true);assert.equal(same.scope.additionalStepFilter,true);
});
test('SL existing retained score commitment remains independent of optional preference',()=>{
 const q=require('./fixtures/timely-scoring.json').request,on=P.decide(q.observation,{...options(q),commitment:q.commitment,previous:q.previous}),off=P.decide(q.observation,{...options(q),commitment:q.commitment,previous:q.previous,disableSupportedSLPreference:true});assert.deepEqual(withoutMetrics(on),withoutMetrics(off));assert.equal(on.continuation[0].event.type,'T');assert.equal(on.continuation[0].event.lines,2);assert.notEqual(on.metrics.supportedSLPreference?.attempted,true);
});

const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
function certifiedLiteral(name){
 const q=fixture[name];let current=M.extendForced(P.observe(q.observation)),notches=PH.resolve(q.observation,q.options.patternHistory),debt=[];
 const steps=q.steps.map(p=>{const before=current,r=R.replay(current,p.witness);assert(r.valid);assert.deepEqual(r.events,[p.event]);const check=S.advanceNotches(before.board,{event:r.events[0],state:r.state},notches),centerReservation=P.centerReservationStep(before,{event:r.events[0],state:r.state},debt,notches);debt=centerReservation.debt;
  const structure=S.assess(r.state,{notches:check.pattern}),structuralEvidence={...S.transition(before,{event:r.events[0],state:r.state},structure,{notches}),structure,centerReservation};notches=check.pattern;current=r.state;
  return{...clone(p),target:p.event.target,hold:p.witness.includes('HOLD'),resultContext:context(r.state),structuralEvidence};});
 const first=steps[0],raw={target:first.target,witness:first.witness,hold:first.hold,holdCount:first.witness.filter(x=>x==='HOLD').length,continuation:steps,context:context(q.observation),assessment:P.assess(current.board),evidence:{cycleDebt:0},metrics:{}};
 const checked=P.revalidate(q.observation,raw,options(q));assert(checked,'the literal fixture must independently pass finite-path certification');return checked;
}
test('SL mechanics: actual six-lock translated L payment remains valid without an unequal-horizon selection oracle',()=>{
 const q=fixture.translated,a=certifiedLiteral('translated'),steps=path(q,a.continuation);assert.equal(a.continuation.length,6);assert.match(a.reason,/later places L to complete/);
 const s=summary(q);let resource=M.start(q.observation,s),before=M.extendForced(P.observe(q.observation)),rootId,originalCells;
 for(const [i,p]of steps.entries()){
  if(i===5){const pending=resource.pendingCenter.find(c=>c.rootId===rootId);assert(pending);assert.notDeepEqual(pending.alternatives[0].cells,originalCells);assert(pending.alternatives.some(c=>JSON.stringify(c.cells.slice().sort())===JSON.stringify(p.event.cells.slice().sort())));}
  resource=M.step(before,p,resource);if(!i){rootId=resource.pendingCenter.find(c=>c.family==='SL').rootId;originalCells=clone(resource.pendingCenter.find(c=>c.rootId===rootId).alternatives[0].cells);}before=p.state;
 }assert.equal(steps[3].event.lines,2);assert.equal(steps[5].event.type,'L');assert(!resource.pendingCenter.some(c=>c.rootId===rootId));
 const trimmed=clone(a);trimmed.continuation.pop();assert.doesNotMatch(P.advicePresentation(trimmed.continuation,trimmed.assessment).reason,/later places L to complete/);
 const unpaid=M.checkPath(q.observation,trimmed.continuation,s);assert(unpaid.resource.pendingCenter.some(c=>c.rootId===rootId));
 for(const mutate of [v=>v.continuation.at(-1).witness=['HD'],v=>v.continuation.at(-1).event.cells[0][0]=0]){const bad=clone(a);mutate(bad);assert.equal(P.revalidate(q.observation,bad,options(q)),null);}
 const chosen=plan('translated');assert.notEqual(chosen.metrics.supportedSLPreference?.selected,true);assert.equal(chosen.continuation.length,3);
 const held=certifiedLiteral('held'),heldResources=M.checkPath(fixture.held.observation,held.continuation,summary(fixture.held));assert.equal(held.continuation.at(-1).event.type,'J');assert(heldResources.resource.pendingCenter.some(c=>c.family==='SL'));assert.doesNotMatch(held.reason,/later places L to complete/);
});
test('SL retention: selected and directly certified translated paths keep the actual L through HOLD and every real lock',()=>{
 for(const name of ['equal','translated']){
  const q=fixture[name];let state=clone(q.observation),history=RH.importContext(state,q.options.resourceContext),patterns=q.options.patternHistory,advice=name==='equal'?plan(name):certifiedLiteral(name),locks=0,holds=0;
  const expected=advice.continuation.map(p=>p.event);while(advice){const before=clone(state),original=advice;
   for(const action of original.witness){const prior=state;state=R.move(state,action);history=RH.applyAction(history,prior,action,state);const opt={...bounds,patternHistory:patterns,resourceContext:RH.exportContext(state,history)};
    if(action==='HD'){assert.deepEqual(state.lastEvent,expected[locks]);locks++;patterns=PH.update(patterns,prior,state,state.lastEvent);advice=P.continueCommitment(before,state,original,state.lastEvent,{...opt,patternHistory:patterns});if(locks<expected.length)assert(advice,'lost actual L goal after '+name+' lock '+locks);}
    else{if(action==='HOLD')holds++;advice=P.advance(state,advice,action,opt);assert(advice,'lost actual prefix during '+name+' '+action);}
   }
  }assert.equal(locks,expected.length);assert(holds);assert(!RH.resolve(state,history).center.pending.some(c=>c.family==='SL'));
 }
});
test('SL session and actual page preserve selected proof through import, HOLD and Undo',()=>{
 const Session=require('../st-session'),q=fixture.equal,a=plan('equal'),history=RH.importContext(q.observation,q.options.resourceContext),saved=Session.create(q.observation,{resourceHistory:history,resourceOriginBag:q.resourceOriginBag,patternHistory:q.options.patternHistory,openingPhase:false,previous:a,search:Session.defaults()}),raw=JSON.stringify(saved),restored=Session.parse(raw);
 assert.deepEqual(restored.state,q.observation);assert.match(Session.ENGINE,/visible-sl-tail-experiment/);
 return require('./support/page.cjs').withPage('st-lab.html',{},g=>{
  const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
  g.element('#st-snapshot').value=raw;g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/^Session imported\./);
  const request=()=>{g.advance(40);return workers.at(-1).message;},respond=()=>{const req=request(),previous=req.previous||req.commitment?.advice;assert(previous);const advice=P.revalidate(req.observation,previous,{...req.options,...bounds});assert(advice);workers.at(-1).respond(advice);return advice;};
  let advice=respond();for(const action of advice.witness)g.window.stLab.act(action);advice=respond();const afterFirst=clone(g.snapshot());for(const action of advice.witness)g.window.stLab.act(action);advice=respond();
  assert.equal(advice.continuation[0].event.type,'L');assert.equal(advice.witness[0],'HOLD');g.window.stLab.act('HOLD');const held=request();assert.equal(held.observation.active.type,'L');assert(held.previous?.continuation.some(p=>p.event.type==='L'));
  g.click('#st-undo');const undo=request();assert.deepEqual({...undo.observation,revision:afterFirst.revision},afterFirst);assert.equal(undo.options.openingPhase,false);assert(undo.commitment.advice.continuation.some(p=>p.event.type==='L'));g.click('#st-export-session');const round=Session.parse(g.element('#st-snapshot').value);assert.deepEqual(round.state,undo.observation);
 });
});
test('SL optional failure: exact remaining node-limit exhaustion retains incumbent with truthful cumulative nodes',()=>{
 const q=fixture.equal,baseline=plan('equal',true);let attempts=0;
 const api=moduleWith({'./st-midgame-resources.js':{...M,repair:(s,r,o)=>{if(o.acceptStep){attempts++;return{valid:null,visited:o.maxNodes,status:'resource-repair-budget'};}return M.repair(s,r,o);}}}),actual=api.plan(q.observation,options(q));
 assert.equal(attempts,1);assert.equal(actual.metrics.nodes,45000);assert.equal(actual.metrics.supportedSLPreference.selected,false);assert.deepEqual(withoutMetrics(actual),withoutMetrics(baseline));
});
test('SL strongest reference: one unknown proof never falls through to a weaker exact-prefix descendant',()=>{
 const {r}=comparisonPair(),incumbent={path:r.path.slice(0,1)},strong=clone(r),weak=clone(r);strong.key='strong';weak.key='weak';strong.rank[3]++;weak.rank[3]--;
 // Both records carry the same authentic replayed L/Z/O descendant. The
 // artificial rank contrast isolates orchestration, not two physical outcomes.
 assert(P.exactAllocationPrefix(strong,incumbent));assert(P.exactAllocationPrefix(weak,incumbent));
 for(const outcome of [false,null,undefined]){const calls=[];const reference=P.certifyStrongestAllocation([weak,strong],n=>{calls.push(n.key);return n===strong?outcome:true;});assert.equal(reference,null);assert.deepEqual(calls,['strong']);}
 const calls=[];assert.equal(P.certifyStrongestAllocation([weak,strong],n=>{calls.push(n.key);return true;}),strong);assert.deepEqual(calls,['strong']);
 assert.equal(P.certifyStrongestAllocation([],()=>{throw Error('no reference exists');}),null);
});
test('SL unknown public horizon returns exact incumbent, and caller/copied admission metadata grants no authority',()=>{
 const q=fixture.equal,filename=require.resolve('../st-planner'),module={exports:{}},requireAt=require('node:module').createRequire(filename),source=fs.readFileSync(filename,'utf8');
 const seam='function publicDrawHorizon(raw,path,summary){';assert(source.includes(seam));vm.runInNewContext(source.replace(seam,seam+'return null;'),{module,exports:module.exports,require:requireAt,Date,performance,globalThis:{}});
 const actual=module.exports.plan(q.observation,{...options(q),supportedSLAdmission:()=>plan('equal'),supportedSLPreference:{selected:true}});assert.equal(actual.metrics.supportedSLPreference.selected,false);assert.equal(actual.metrics.supportedSLPreference.reason,'unequal-or-unknown-public-draw-horizon');assert.deepEqual(withoutMetrics(actual),withoutMetrics(plan('equal',true)));
});
