'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),Provider=require('../st-resource-provider'),C=require('../st-obligation-context'),Session=require('../st-session'),harness=require('./support/st-risk-harness.cjs'),fixture=require('./fixtures/covered-repair-plan.json'),clone=x=>JSON.parse(JSON.stringify(x));
const q=fixture.cases[0],root=()=>R.createState(q.observation);
const placement=(s,w)=>{const r=R.replay(s,w);assert.ok(r.valid);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0],target:r.events[0].target,witness:w};};
const stopped={status:'no-supported-continuation-found',target:null,witness:[],continuation:[],reason:'No supported continuation certified.',metrics:{nodes:100}};
function risky(options={},candidate=null){const s=root(),p=candidate||placement(s,q.steps[0].witness);return harness().riskyFallback(s,clone(stopped),{...q.options,openingPhase:false,maxNodes:45000,deadline:Infinity,now:()=>0,...options},{placements:[p],complete:true});}
test('risk / literal unresolved roof is explicit risk, never a forged restoration certificate',()=>{
 const a=risky();assert.ok(a.target);assert.equal(a.status,'recommended-risky-placement');assert.equal(a.recommendation.kind,'risky');assert.match(a.reason,/^Risky: Hold once\. Place S/);assert.match(a.reason,/safer move may exist/i);assert.equal(a.continuation.length,1);assert.equal(a.metrics.certifiedHorizon,0);assert.ok(a.recommendation.hazards.some(h=>h.code==='unresolved-covered-cells'));assert.equal(a.evidence.coveredRepairPlan,undefined);assert.equal(a.evidence.resourceObligations.status,'unverified');assert.equal(a.evidence.resourceObligations.binding,undefined);assert.ok(Array.isArray(a.evidence.resourceObligations.unclassifiedS));assert.ok(Array.isArray(a.evidence.resourceObligations.unclassifiedL));assert.equal(R.replay(root(),a.witness).valid,true);
 assert.equal(P.revalidate(root(),clone(a),q.options),null);assert.equal(P.advance(root(),clone(a),'L',q.options),null);assert.equal(P.continueCommitment(root(),root(),clone(a),null,q.options),null);
});
test('risk / supported incumbent is never downgraded or charged fallback work',()=>{
 const a={...stopped,target:{type:'S'},metrics:{nodes:300},evidence:{claim:'already certified'}},p=placement(root(),q.steps[0].witness),out=harness().riskyFallback(root(),a,{maxNodes:45000,now:()=>0},{placements:[p],complete:true});assert.deepEqual(out.target,a.target);assert.equal(out.metrics.riskFallback.attempted,false);assert.equal(out.metrics.nodes,300);
});
test('risk / exhausted or zero budget and invalid replay cannot manufacture recommendation',()=>{
 assert.equal(risky({maxNodes:100}).target,null);assert.equal(risky({deadline:0}).target,null);
 const fake=placement(root(),q.steps[0].witness);fake.event=clone(fake.event);fake.event.cells[0][0]--;assert.equal(risky({},fake).target,null);
 const bad=clone(q.options.obligationContext);if(bad){bad.state.sl.status='invalid';assert.equal(risky({obligationContext:bad}).target,null);}
 assert.doesNotThrow(()=>P.decide({board:['bad']},{maxNodes:0}));
});
test('risk / a descriptive D silhouette no longer invents a J-specific hazard',()=>{
 for(const f of require('./fixtures/st-d-admission.json')){
  const s=R.createState({board:[...Array(20).fill('..........'),...f.board],active:f.active,hold:f.hold,queue:f.queue}),p=placement(s,f.witness);
  const result=harness().riskyFallback(s,clone(stopped),{maxNodes:45000,now:()=>0,deadline:Infinity,openingPhase:false},{placements:[p],complete:true});
  assert.equal((result.recommendation?.hazards||[]).some(h=>h.code.startsWith('D-')),false);
  if(result.target){assert.equal(result.recommendation.kind,'risky');assert.equal(R.replay(s,result.witness).valid,true);assert.equal(result.evidence.resourceObligations.status,'unverified');}
 }
});
test('risk / unknown Extra Z is not a risky permission',()=>{
 const s=R.createState({active:'Z',queue:['O','I']}),p=placement(s,['L','L','L','HD']),out=harness().riskyFallback(s,clone(stopped),{maxNodes:45000,now:()=>0,deadline:Infinity},{placements:[p],complete:true});assert.equal(out.target,null);assert.equal(out.metrics.riskFallback.rejections['resource-permission'],1);
});
test('risk / serialized risk and copied supported labels cannot become retained authority',()=>{
 const a=risky(),s=root(),history=Current.start(s),saved=Session.create(s,{obligationContext:history,openingPhase:false,previous:a,commitment:{observation:s,advice:a}}),restored=Session.parse(JSON.stringify(saved));assert.equal(restored.previous,null);assert.equal(restored.commitment,null);assert.ok(restored.warnings.some(w=>/risky advice/.test(w)));
 const forged=clone(a);forged.recommendation.kind='supported';forged.status='recommended-with-verified-prefix';assert.equal(P.revalidate(s,forged,q.options),null,'Relabeling unplanned roof cannot create a supported proof');
});
test('risk / actual page warning remains explicit then clears on movement and import',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};
 const s=root(),session=Session.create(s,{obligationContext:Current.start(s),openingPhase:false});g.element('#st-snapshot').value=JSON.stringify(session);g.click('#st-import');g.advance(40);const worker=workers.at(-1),a=risky();worker.onmessage({data:{type:'result',id:worker.message.id,revision:worker.message.observation.revision,result:a}});assert.match(g.element('#st-status').textContent,/^Risky:/);assert.equal(g.element('#st-status').dataset.result,'recommended-risky-placement');
 g.window.stLab.act(a.witness[0]);assert.doesNotMatch(g.element('#st-status').textContent,/^Risky:/);g.advance(40);assert.ok(workers.length>=2);assert.equal(workers.at(-1).message.commitment,null);
 // A late reply from the pre-HOLD worker cannot repaint the old risk target.
 worker.onmessage({data:{type:'result',id:worker.message.id,revision:worker.message.observation.revision,result:a}});assert.doesNotMatch(g.element('#st-status').textContent,/^Risky:/);
 for(const action of a.witness.slice(1))g.window.stLab.act(action);g.advance(40);
 const after=workers.at(-1).message;assert.equal(after.commitment,null);assert.deepEqual(after.observation.board,R.replay(s,a.witness).state.board);assert.equal('resourceContext' in after.options,false);const current=C.importState(after.options.obligationContext,{position:after.observation});assert.equal(current.inventory.active.type,after.observation.active.type);assert.notDeepEqual(current.inventory,C.importState(worker.message.options.obligationContext,{position:worker.message.observation}).inventory);assert.equal(C.resolve(current,{position:after.observation}).status,'available');
 g.window.stLab.act('UNDO');g.advance(40);assert.deepEqual(workers.at(-1).message.observation.board,s.board);assert.doesNotMatch(g.element('#st-status').textContent,/^Risky:/);
 g.element('#st-snapshot').value=JSON.stringify(session);g.click('#st-import');g.advance(40);assert.doesNotMatch(g.element('#st-status').textContent,/^Risky:/);
}));
test('risk / real supported decision retains classification and its original physical witness',()=>{
 const f=require('./support/st-fixtures.cjs').fixtures,s=R.createState({board:f.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']}),a=P.decide(s,{depth:2,width:3,maxNodes:15000,now:()=>0,deadline:Infinity});assert.ok(a.target);assert.equal(a.recommendation.kind,'supported');assert.ok(a.metrics.certifiedHorizon>0);assert.equal(R.replay(s,a.witness).valid,true);
});

test('risk / clean legal candidate discloses only continuation uncertainty, not invented damage',()=>{
 const f=require('./support/st-fixtures.cjs').fixtures,s=R.createState({board:f.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']}),p=placement(s,['R','R','R','R','CW','HD']);
 const out=harness().riskyFallback(s,clone(stopped),{maxNodes:45000,now:()=>0,deadline:Infinity,openingPhase:false},{placements:[p],complete:true});assert.equal(out.recommendation.kind,'risky');assert.deepEqual(Array.from(out.recommendation.hazards,h=>h.code),['continuation-unverified']);assert.equal(out.metrics.certifiedHorizon,0);assert.equal(out.evidence.resourceObligations.status,'unverified');assert.equal(out.evidence.resourceObligations.binding,undefined);assert.match(out.reason,/no supported continuation was certified/);
});
test('risk / incomplete query work and truncation remain explicit, no hidden metadata can grant certainty',()=>{
 const s=root(),p=placement(s,q.steps[0].witness),a=harness().riskyFallback({...s,seed:999,hiddenQueue:['J','J']},{...clone(stopped),metrics:{nodes:100,queries:{unfinished:1}}},{...q.options,maxNodes:45000,now:()=>0,deadline:Infinity},{placements:[p],complete:true});assert.ok(a.target);assert.equal(a.recommendation.search.incomplete,true);assert.equal(a.recommendation.search.saferAlternative,'not-certified-within-bounded-search');assert.equal(a.recommendation.claim.includes('future piece arrival are not proved'),true);
});
test('risk / actual supported search abstention reaches collector fallback in decide and a node-bounded serialized Worker',()=>{
 const options={...q.options,depth:3,width:8,maxNodes:45000,timeMs:1500,openingPhase:false},strict=P.plan(q.observation,{...options,now:()=>0,deadline:Infinity});assert.equal(strict.target,null,'This developed root has no supported recommendation in the fixed bound');
 const direct=P.decide(q.observation,{...options,now:()=>0,deadline:Infinity});assert.equal(direct.recommendation.kind,'risky');assert.equal(direct.metrics.riskFallback.source,'existing-root-enumeration');assert.ok(direct.metrics.riskFallback.considered>0);assert.ok(direct.metrics.nodes<=45000);assert.equal(direct.recommendation.search.incomplete,true);
 const request=JSON.parse(JSON.stringify({type:'plan',id:7,observation:q.observation,previous:null,commitment:null,options})),actual=require('../scripts/lib/st-simulation.cjs').workerPlanner({disableSearchTimeout:true})(request);
 assert.equal(actual.recommendation.kind,'risky');assert.deepEqual(actual.target,direct.target);assert.equal(actual.target.x,4);assert.equal(actual.target.y,32);assert.equal(actual.recommendation.hazards.some(h=>h.code==='unresolved-covered-cells'),false,'Recognized Center S stage is not an arbitrary roof');const pending=actual.recommendation.hazards.find(h=>h.code==='pending-center-partner');assert.deepEqual(pending.pieces,['L']);assert.equal(pending.publicCounts.L,1);assert.equal(actual.metrics.certifiedHorizon,0);assert.ok(actual.metrics.nodes<=45000);assert.ok(actual.metrics.elapsedMs>=actual.metrics.riskFallback.elapsedMs);assert.equal(R.replay(q.observation,actual.witness).valid,true);assert.match(actual.reason,/^Risky: Hold once/);assert.match(actual.reason,/safer move may exist/);
});

test('risk / exact authentic known-L completion cannot lose because it removes the last hazard',()=>{
 const f=require('./fixtures/risk-known-l-completion.json'),s=R.createState(f.observation),payment=placement(s,f.payment),diversion=placement(s,f.diversion),h=harness(),options={...f.options,maxNodes:45000,now:()=>0,deadline:Infinity};
 const actual=h.riskyFallback(s,clone(stopped),options,{placements:[diversion,payment],complete:true});assert.deepEqual(actual.target,{type:'L',x:4,y:33,rotation:2});assert.equal(actual.recommendation.kind,'risky');assert.deepEqual(Array.from(actual.recommendation.hazards,h=>h.code),['continuation-unverified']);assert.deepEqual(actual.evidence.actualPartnerPayments,[122]);assert.equal(actual.recommendation.riskBasis,'uncertified-follow-up-only');assert.equal(actual.metrics.certifiedHorizon,0);assert.equal(actual.evidence.resourceObligations.status,'unverified');assert.equal(actual.evidence.resourceObligations.binding,undefined);assert.equal(P.revalidate(s,actual,options),null);
 const M=require('../st-obligation-resources'),summary=CurrentProvider.facts(CurrentProvider.prepare(s,{obligationContext:Current.exportState(Current.importState(f.options.obligationContext,{position:s}))})),before=M.start(s,Current.importState(f.options.obligationContext,{position:s}),{extendForced:false}),after=M.step(s,payment,before);assert.equal(before.pendingCenter[0].rootId,122);assert.equal(after.pendingCenter.length,0);assert.deepEqual(after.violations,[]);assert.deepEqual(P.assess(payment.state.board).center.profile,[5,5,5]);
 const natural=P.decide(s,{...options,depth:3,width:8});assert.deepEqual(natural.target,actual.target);assert.equal(natural.recommendation.kind,'risky');assert.equal(natural.recommendation.riskBasis,'uncertified-follow-up-only');assert.deepEqual(natural.evidence.actualPartnerPayments,[122]);assert.ok(natural.metrics.nodes<=45000);
 const worker=require('../scripts/lib/st-simulation.cjs').workerPlanner({disableSearchTimeout:true})({type:'plan',id:321127,observation:f.observation,previous:null,commitment:null,options:{...f.options,depth:3,width:8,maxNodes:45000,timeMs:1500}});assert.deepEqual(worker.target,actual.target);assert.equal(worker.recommendation.riskBasis,'uncertified-follow-up-only');assert.deepEqual(worker.evidence.actualPartnerPayments,[122]);assert.equal(worker.metrics.certifiedHorizon,0);
 const forged=clone(f.options.obligationContext);forged.state.sl.status='invalid';assert.equal(h.riskyFallback(s,clone(stopped),{...options,obligationContext:forged},{placements:[payment],complete:true}).target,null,'An invalid imported root cannot earn payment credit or advice');
 const unpaid=h.riskyFallback(s,clone(stopped),options,{placements:[diversion],complete:true});assert.deepEqual(unpaid.evidence.actualPartnerPayments,[]);assert.equal(unpaid.recommendation.riskBasis,'identified-dependency');assert.ok(unpaid.recommendation.hazards.some(h=>h.code==='pending-center-partner'));
 assert.equal(h.riskyFallback(s,clone(stopped),{...options,maxNodes:100},{placements:[payment],complete:true}).target,null);
 const fake={...payment,event:clone(payment.event)};fake.event.cells[0][0]--;assert.equal(h.riskyFallback(s,clone(stopped),options,{placements:[fake],complete:true}).target,null);
});

for(const [name,fixture,expected] of [['supported-search risk',q,{type:'S',x:4,y:32}],['known L payment',require('./fixtures/risk-known-l-completion.json'),{type:'L',x:4,y:33,rotation:2}]])test('risk production budget / '+name+' preserves proof honesty when search is unfinished',()=>{
 const options={...fixture.options,depth:3,width:8,maxNodes:45000,timeMs:1500,openingPhase:false},a=require('../scripts/lib/st-simulation.cjs').workerPlanner()({type:'plan',id:991,observation:fixture.observation,previous:null,commitment:null,options});
 const selected=Object.entries(expected).every(([k,v])=>a.target?.[k]===v)&&a.recommendation?.kind==='risky';require('./support/st-production-budget.cjs').verify(fixture.observation,a,options,selected);
 if(name==='known L payment'&&selected){assert.deepEqual(a.evidence.actualPartnerPayments,[122]);assert.equal(a.recommendation.riskBasis,'uncertified-follow-up-only');}
});
