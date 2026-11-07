'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),RH=require('../st-resource-history'),S=require('../st-structure'),Session=require('../st-session');
const f=require('./fixtures/visible-left-repair.json'),clone=x=>JSON.parse(JSON.stringify(x));
const root=()=>R.createState(f.observation);
const opts=()=>({...clone(f.options),depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});
const key=c=>c.map(p=>p.join(',')).sort().join(';');
let cached;const advice=()=>clone(cached??=P.decide(root(),opts()));
const partial=s=>({...opts(),resourceContext:RH.exportContext(s,RH.start(s))});
// The fixture contains only a public observation and replayable observed history,
// never saved advice, search answers or an unseen generator tail.
test('visible Left repair / normal decision executes an identified J after Center and Right preparations',()=>{
 const s=root(),a=advice();assert.equal(a.recommendation.kind,'supported');assert.equal(a.metrics.visibleLeftRepair.selected,true);assert.ok(a.metrics.nodes<=45000);
 assert.deepEqual(a.continuation.map(p=>p.event.type),['L','Z','O','J']);assert.equal(P.cycleResources(a.continuation).leftRepairs,1);
 assert.ok(a.continuation.slice(0,-1).every(p=>p.event.cells.every(([x])=>x>=4)&&p.event.lines===0));
 const goal=a.continuation.at(-1).structuralEvidence.leftRepair;
 const history=RH.resolve(s,RH.importContext(s,f.options.resourceContext));assert.equal(history.coverage.status,'complete');
 assert.equal(goal.piece,'J');assert.equal(key(goal.cells),key(a.continuation.at(-1).event.cells));
 assert.ok(S.geometry(s.board).left.completions.some(c=>c.piece==='J'&&key(c.cells)===key(goal.cells)));
 const baseline=P.decide(s,{...opts(),disableVisibleLeftRepair:true});
 assert.ok(a.assessment.maxHeight<=baseline.assessment.maxHeight);assert.ok(a.assessment.left.roughness<baseline.assessment.left.roughness);
 assert.equal(a.evidence.strategy,'canonical-right-ST');assert.deepEqual(a.evidence.resourceObligations.unclassifiedS.map(p=>p.sId),[15]);assert.match(a.reason,/S15/);assert.ok(a.recommendation.hazards.some(h=>h.code==='unclassified-SL-accommodation'),'Finite J repair is not a claim that the historical S accommodation was repaired');assert.equal(a.evidence.pendingLSelection,undefined);assert.equal(a.evidence.preparationProof,undefined);
 const r=R.replay(s,a.continuation.flatMap(p=>p.witness));assert.ok(r.valid);assert.equal(r.events.length,4);assert.ok(r.events.every(S.canonicalClear));
 assert.deepEqual(S.geometry(r.state.board).left.profile,goal.resultProfile);assert.ok(P.revalidate(s,a,opts()));
});
test('visible Left repair / node-bounded serialized Worker finds the route from public history alone',()=>{
 const worker=require('../scripts/lib/st-simulation.cjs').workerPlanner({disableSearchTimeout:true});
 const a=worker({type:'plan',id:203,observation:root(),previous:null,commitment:null,options:{...f.options,depth:3,width:8,maxNodes:45000,timeMs:1500}});
 assert.equal(a.metrics.visibleLeftRepair?.selected,true);assert.equal(P.cycleResources(a.continuation).leftRepairs,1);assert.ok(a.metrics.nodes<=45000);
 assert.deepEqual(a.continuation.map(p=>p.event.type),['L','Z','O','J']);
 assert.ok(R.replay(root(),a.continuation.flatMap(p=>p.witness)).valid);
});
test('visible Left repair / production Worker keeps its wall budget without claiming an unfinished J repair',()=>{
 const q={type:'plan',id:204,observation:root(),previous:null,commitment:null,options:{...f.options,depth:3,width:8,maxNodes:45000,timeMs:1500}},a=require('../scripts/lib/st-simulation.cjs').workerPlanner()(q),selected=a.metrics.visibleLeftRepair?.selected===true;
 require('./support/st-production-budget.cjs').verify(q.observation,a,q.options,selected);
 if(selected){assert.deepEqual(a.continuation.map(p=>p.event.type),['L','Z','O','J']);assert.equal(P.cycleResources(a.continuation).leftRepairs,1);assert.equal(a.metrics.visibleLeftRepair.paymentLock,4);}
});
function execute(reveals=false){
 let s=root(),h=RH.importContext(s,f.options.resourceContext),a=advice();const original=clone(a.continuation.at(-1).structuralEvidence.leftRepair);
 for(let lock=0;lock<4;lock++){
  const beforeLock=s,old=a;for(const action of old.witness){const before=s;s=R.move(s,action);assert.notEqual(s,before);
   if(action==='HD'&&reveals)s={...s,queue:[...s.queue,['T','Z','S','J'][lock]]};
   h=RH.applyAction(h,before,action,s);
   if(action!=='HD'){a=P.advance(s,a,action,{...opts(),resourceContext:RH.exportContext(s,h)});assert.ok(a,`movement ${lock+1} ${action}`);}
  }
  a=P.continueCommitment(beforeLock,s,old,s.lastEvent,{...opts(),resourceContext:RH.exportContext(s,h)});
  if(lock<3){assert.ok(a,`retained after lock ${lock+1}`);assert.equal(a.continuation.length,3-lock);assert.deepEqual(a.continuation.at(-1).structuralEvidence.leftRepair,original);}
  else assert.equal(a,null,'the actual J completes the obligation');
 }
 return {s,h};
}
test('visible Left repair / exact movements and HOLD retain the same goal until actual J lock',()=>execute());
test('visible Left repair / later public reveals preserve the finite goal and do not create stale credit',()=>{
 const {s,h}=execute(true);assert.equal(s.queue.length,6);
 const next=P.decide(s,{...opts(),resourceContext:RH.exportContext(s,h)});
 assert.ok(!next.evidence?.commitmentRetained);assert.equal(P.cycleResources([]).leftRepairs,0);
 if(next.target)assert.ok(P.revalidate(s,next,{...opts(),resourceContext:RH.exportContext(s,h)}));
});
test('visible Left repair / exact goal comparison rejects another J, landing or unfinished prefix',()=>{
 const path=advice().continuation;assert.equal(P.resourceGoalPrefix(path,path),4);assert.equal(P.resourceGoalPrefix(path.slice(0,3),path),null);
 for(const change of [g=>g.pieceId++,g=>g.cells[0][1]--]){const other=clone(path);change(other.at(-1).structuralEvidence.leftRepair);assert.equal(P.cycleResources(other).leftRepairs,1);assert.equal(P.resourceGoalPrefix(other,path),null);}
});
test('visible Left repair / revalidation rejects forged identities, profiles, witnesses and stale history',()=>{
 for(const change of [g=>g.pieceId++,g=>g.piece='O',g=>g.cells[0][1]--,g=>g.beforeProfile[0]++,g=>g.resultProfile[0]++]){
  const a=advice();change(a.continuation.at(-1).structuralEvidence.leftRepair);assert.equal(P.revalidate(root(),a,opts()),null);
 }
 const a=advice();a.continuation.at(-1).witness=['HD'];assert.equal(P.revalidate(root(),a,opts()),null);
 const o=opts();o.resourceContext.steps.at(-1).action='L';assert.equal(P.revalidate(root(),advice(),o),null);
 const missing=root();missing.queue=missing.queue.map(p=>p==='J'?'S':p);assert.equal(P.revalidate(missing,advice(),partial(missing)),null);
 const blocked=root();blocked.board[34]='X'+blocked.board[34].slice(1);assert.equal(P.revalidate(blocked,advice(),partial(blocked)),null);
});
test('visible Left repair / partial histories do not borrow missing supply and held J is executable',()=>{
 const missing=R.createState({...f.observation,queue:['Z','L','S','S','I','O']});
 const a=P.decide(missing,partial(missing));assert.notEqual(a.metrics.visibleLeftRepair?.selected,true);assert.equal(P.cycleResources(a.continuation).leftRepairs,0);
 const held=R.createState({...f.observation,active:'L',hold:'J',queue:['Z','O','L','S','I','O']});
 const b=P.decide(held,partial(held));assert.ok(b.target);assert.ok(R.replay(held,b.continuation.flatMap(p=>p.witness)).valid);
 assert.ok(P.revalidate(held,b,partial(held)));assert.equal(P.cycleResources(b.continuation).leftRepairs,1);
});
test('visible Left repair / zero, tiny and expired shared budgets cannot claim repair',()=>{
 for(const patch of [{maxNodes:0},{maxNodes:1},{now:()=>1,deadline:0}]){const a=P.decide(root(),{...opts(),...patch});assert.notEqual(a.metrics.visibleLeftRepair?.selected,true);assert.equal(P.cycleResources(a.continuation||[]).leftRepairs,0);}
});
function savedSession(){
 const B=require('../st-bag'),s=root(),origin=f.options.resourceContext.origin;
 const originBag=B.fromObserved({observed:[origin.active.type,...origin.queue],startPhase:0});s.bag=clone(originBag);
 for(const step of f.options.resourceContext.steps)for(const piece of step.revealed)s.bag=B.consume(s.bag,piece);
 const h=RH.importContext(s,f.options.resourceContext);return Session.create(s,{resourceHistory:h,resourceOriginBag:originBag,openingPhase:false,previous:P.decide(s,opts())});
}
test('visible Left repair / session round trip keeps current obligations, not forged goal authority',()=>{
 const saved=savedSession();
 const restored=Session.parse(JSON.stringify(saved)),o={...opts(),resourceContext:undefined,obligationContext:restored.obligationContext};
 assert.ok(P.revalidate(restored.state,restored.previous,o));
 const forged=clone(restored.previous);forged.continuation.at(-1).structuralEvidence.leftRepair.pieceId++;
 assert.equal(P.revalidate(restored.state,forged,o),null);
 const stale=clone(saved);stale.engineVersion='old-coach';assert.equal(Session.parse(JSON.stringify(stale)).previous,null);
});

test('visible Left repair / page lifecycle carries the J-only suffix and clears it after repair or reset',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const saved=savedSession(),a=saved.coaching.previous;
 g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');g.advance(40);workers.at(-1).respond(a);
 for(const step of a.continuation.slice(0,3))for(const action of step.witness)g.window.stLab.act(action);
 g.advance(40);const request=workers.at(-1).message;assert.ok(request.commitment);assert.equal(request.commitment.advice.continuation.length,1);
 assert.equal(P.cycleResources(request.commitment.advice.continuation).leftRepairs,1);
 workers.at(-1).respond(request.commitment.advice);for(const action of request.commitment.advice.witness)g.window.stLab.act(action);
 g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
 g.click('#st-reset');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));
test('visible Left repair / a legal competing Center J cannot replace the promised Left landing',()=>{
 const a=advice(),prefix=a.continuation.slice(0,3),s=R.replay(root(),prefix.flatMap(p=>p.witness)).state;
 const center=R.placements(s).placements.find(p=>p.event.type==='J'&&p.event.cells.every(([x])=>x>=4&&x<=6)&&P.ordinaryCenterEligible(s,p));
 assert.ok(center,'an actually reachable, ordinary Center J competes for the same piece');
 const replacement=[...prefix,{...center,structuralEvidence:{}}];assert.equal(P.resourceGoalPrefix(replacement,a.continuation),null);
 const forged=clone(a);forged.continuation[3]={...center,structuralEvidence:{leftRepair:clone(a.continuation[3].structuralEvidence.leftRepair)}};
 assert.equal(P.revalidate(root(),forged,opts()),null,'the old goal label cannot bless a different actual landing');
});
test('visible Left repair / uniquely forced but unseen J is not a visible reservation',()=>{
 const B=require('../st-bag'),s=R.createState({...f.observation,queue:['Z','S','I','T'],bag:B.fromObserved({observed:['O','L','Z','S','I','T'],startPhase:0})});
 assert.equal(B.forcedNext(s.bag),'J');assert.ok(![s.active.type,s.hold,...s.queue].includes('J'));
 const a=P.decide(s,partial(s));assert.notEqual(a.metrics.visibleLeftRepair?.selected,true);
 assert.equal(P.cycleResources(a.continuation||[]).leftRepairs,0,'bag deduction cannot invent an observed J identity');
});
test('visible Left repair / malformed serialized goal cells fail closed without throwing',()=>{
 for(const cells of [null,{},'bad',[],[[0,34]],[[0,34],[1,34],[0,35],null],[[0,34],[1,34],[0,35],[0,400]]]){
  const a=advice();a.continuation.at(-1).structuralEvidence.leftRepair.cells=cells;
  assert.doesNotThrow(()=>P.cycleResources(a.continuation));assert.equal(P.cycleResources(a.continuation).leftRepairs,0);
  assert.equal(P.resourceGoalPrefix(a.continuation,advice().continuation),null);assert.equal(P.revalidate(root(),a,opts()),null);
 }
});
test('visible Left repair / altered HOLD and queue order invalidate the old goal before fresh planning',()=>{
 for(const patch of [{hold:'J',queue:['Z','L','O','S','I','O']},{queue:['Z','J','L','S','I','O']}]){
  const s=R.createState({...f.observation,...patch}),o=partial(s);assert.equal(P.revalidate(s,advice(),o),null);
  const fresh=P.decide(s,o);if(fresh.target){assert.ok(R.replay(s,fresh.continuation.flatMap(p=>p.witness)).valid);assert.ok(P.revalidate(s,fresh,o));}
 }
 const s=root(),after=R.move(s,'HOLD'),h=RH.applyAction(RH.importContext(s,f.options.resourceContext),s,'HOLD',after);
 assert.equal(P.advance(after,advice(),'HOLD',{...opts(),resourceContext:RH.exportContext(after,h)}),null,'an unplanned actual HOLD invalidates the saved movement path');
});

test('visible Left repair / missing labels are regenerated from actual replay, not copied authority',()=>{
 const a=advice();for(const p of a.continuation)delete p.structuralEvidence.leftRepair;
 a.evidence.cycleResources.leftRepairs=0;
 const rebuilt=P.revalidate(root(),a,opts());assert.ok(rebuilt);assert.equal(P.cycleResources(rebuilt.continuation).leftRepairs,1);assert.equal(rebuilt.evidence.cycleResources.leftRepairs,1);
 const disabled=P.revalidate(root(),rebuilt,{...opts(),disableVisibleLeftRepair:true});assert.ok(disabled);assert.equal(P.cycleResources(disabled.continuation).leftRepairs,1,'Disabling optional discovery does not discard an actual existing goal');
});
