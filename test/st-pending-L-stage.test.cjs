'use strict';
const {extendPublic}=require('./support/current-resource-test.cjs');
const equivalent=require('./support/st-equivalent-s.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access'),M=require('../st-obligation-resources'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),PH=require('../st-pattern-history'),P=require('../st-planner');
const route=require('./fixtures/covered-repair-plan.json').ordinaryCenter,q=require('./fixtures/pending-L-visible-stage.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={maxNodes:45000,deadline:Infinity,timeMs:undefined,now:()=>0},context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
function advice(raw,steps){let state=raw;const continuation=steps.map(p=>{const r=R.replay(state,p.witness);assert(r.valid);state=r.state;return{...p,target:p.event.target,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length,resultContext:context(state)};});return{target:continuation[0].target,witness:continuation[0].witness,hold:continuation[0].hold,holdCount:continuation[0].holdCount,continuation,context:context(raw),evidence:{}};}
const current=()=>Current.importState(q.options.obligationContext,{position:q.observation});
function endpoint(n=7){return M.checkPath(q.observation,route.steps.slice(0,n),current());}
function rebase(resource,position,edit=()=>{}){const projection=clone(resource.route.projection);projection.position=clone(position);edit(projection);return M.fromProjection(projection,{openingBoundary:resource.route.openingBoundary,extendForced:false});}
function observedWithNewL({extraO=false}={}){let state=R.createState({...route.observation,bag:undefined}),history=Current.start(state),pattern=PH.start(state),locks=0;const root=state;
 for(const step of route.steps)for(const action of step.witness){const before=state;state=R.move(state,action);if(action==='HD'){locks++;if(locks===1)state={...state,queue:[...state.queue,'L']};if(locks===2&&extraO)state={...state,queue:[...state.queue,'O']};pattern=PH.update(pattern,before,state,state.lastEvent);}history=Current.applyActual(history,{before:before,action:action,after:state}).context;}
 return{state,history,pattern,root};
}
test('pending L / exact player seven-lock route passes full admission without pretending completion or arrival',()=>{
 const raw=q.observation,a=P.revalidate(raw,advice(raw,route.steps),{...q.options,...bounds});assert.ok(a);
 const end=endpoint();assert.equal(end.valid,true);assert.equal(end.resource.pendingCenter.length,1);assert.equal(end.state.hold,'Z');
 assert.equal(route.steps.reduce((n,p)=>n+p.event.lines,0),6);assert.equal(P.assess(end.state.board).maxHeight,11);
 assert.equal(a.evidence.pendingLStage.arrival,'not-established');assert.equal(a.evidence.pendingLStage.publicDrawsExhausted,true);assert.equal(a.evidence.pendingLStage.parkedHold,'Z');assert.match(a.reason,/exact Center L target remains pending/);
 assert.equal(a.evidence.pendingLStage.target.access,'conditional-fresh-L-only');
});
test('pending L / actual root selects cleaner Center S with a fully checked public waiting route',()=>{
 const a=P.decide(q.observation,{...q.options,...bounds});equivalent.sPlacement(a.continuation[0].event,[[5,23],[6,23],[4,24],[5,24]]);assert.ok(a.metrics.nodes<=45000);
 assert.equal(a.evidence.pendingLStage.waiting.length,4);assert.equal(a.evidence.pendingLSelection.horizon,3);assert.equal(a.evidence.pendingLSelection.globallyOptimal,false);
 assert.ok(Number.isInteger(a.evidence.pendingLSelection.higherRankedUnresolved));assert.ok(a.evidence.pendingLSelection.higherRankedUnresolved>=0);if(a.evidence.pendingLSelection.higherRankedUnresolved)assert.equal(a.evidence.searchIncomplete,true);
 // More reusable proofs may certify a different trailing route. The literal
 // six-line route above stays a separate positive; live selection must prove
 // all public supply safe without pinning its parked piece or optional scores.
 const joined=[...a.continuation,...a.evidence.pendingLStage.waiting],r=R.replay(q.observation,joined.flatMap(p=>p.witness));assert.equal(r.valid,true);assert.ok(r.events.every(e=>S.canonicalClear(e)&&!e.topOut));
 assert.equal(r.state.active,null);assert.deepEqual(r.state.queue,[]);assert.notEqual(r.state.hold,'L');assert.ok(P.assess(r.state.board).maxHeight<20);
 const checked=M.checkPath(q.observation,joined,current());assert.equal(checked.valid,true);assert.deepEqual(checked.resource.violations,[]);assert.equal(checked.resource.pendingCenter.length,1);assert.equal(checked.resource.pendingCenter[0].rootId,a.evidence.pendingLStage.rootId);
 const target=a.evidence.pendingLStage.endpointTarget;assert.ok(checked.resource.pendingCenter[0].alternatives.some(p=>p.piece==='L'&&JSON.stringify(p.cells.slice().sort())===JSON.stringify(target.cells.slice().sort())),'Conditional access must bind the exact authenticated pending cells');
 const conditional=R.replay(R.createState({board:r.state.board,active:'L',canHold:false}),target.witness);assert.equal(conditional.valid,true);assert.deepEqual(conditional.events[0].cells.slice().sort(),target.cells.slice().sort());assert.equal(a.evidence.pendingLStage.arrival,'not-established');
 assert.ok(P.revalidate(q.observation,a,{...q.options,...bounds}),'Fresh selection must still pass ordinary independent admission');
});
test('pending L / a deliberately unfinished higher-ranked waiting proof is disclosed, never treated as rejection',()=>{
 // The reviewed S/T setup plus this literal held-Z cap reaches the alternative
 // endpoint. Withhold only that endpoint's proof allowance, independently of
 // whether request-cache reuse normally makes its full proof affordable.
 const witness=route.steps.slice(0,2).flatMap(p=>p.witness).concat(['HOLD','R','R','R','R','CW','HD']);
 const controlled=require('./support/st-pending-L-budget.cjs')(q.observation,witness),a=clone(controlled.planner.decide(q.observation,{...q.options,...bounds}));
 assert.ok(controlled.blocked.length>0);assert.ok(controlled.blocked.every(p=>p.valid===null));assert.ok(a.target);assert.ok(a.metrics.nodes<=45000);
 assert.ok(a.evidence.pendingLSelection.higherRankedUnresolved>0);assert.equal(a.evidence.pendingLSelection.globallyOptimal,false);assert.equal(a.evidence.searchIncomplete,true);
 const selected=R.replay(extendPublic(R.createState(q.observation)),a.continuation.flatMap(p=>p.witness));assert.equal(selected.valid,true);assert.notEqual(controlled.key(selected.state),controlled.blockedKey,'An unfinished endpoint cannot be admitted');
 assert.ok(P.revalidate(q.observation,a,{...q.options,...bounds}),'The selected alternative still needs every real admission check');
});
test('pending L / full visible waiting is a positive proof; unfinished search cannot certify unaccommodated pieces',()=>{
 const e=endpoint(3),a=M.pendingLStage(e.state,e.resource,{maxNodes:4000,now:()=>0});assert.equal(a.valid,true);assert.equal(a.waitingStage,true);assert.deepEqual(a.path.map(p=>p.event.type),['O','Z','J','I']);
 for(const options of [{maxNodes:0},{maxNodes:1},{maxNodes:4000,deadline:0}]){const b=M.pendingLStage(e.state,e.resource,{now:()=>0,...options});assert.notEqual(b.valid,true);assert.equal(b.valid,null);}
 const unaccommodated=clone(e.state);unaccommodated.queue.push('T');const resource=rebase(e.resource,unaccommodated,p=>p.supply.queue.push({id:p.supply.nextSyntheticId--,type:'T',bag:null,observedOrder:null}));
 assert.notEqual(M.pendingLStage(unaccommodated,resource,{maxNodes:1,now:()=>0}).valid,true);
});
test('pending L / malformed, silhouette-only, diverted and inaccessible targets cannot acquire stage eligibility',()=>{
 const e=endpoint();assert.equal(M.pendingLStageEligible(e.state,e.resource),true);
 const silhouette=M.start(e.state,Current.start(e.state),{extendForced:false});assert.equal(M.pendingLStageEligible(e.state,silhouette),false,'Position-only geometry cannot recover the consumed S identity');
 for(const mutate of [r=>r.pendingCenter[0].rootId=null,r=>r.pendingCenter[0].family=null,r=>r.pendingCenter[0].lost=true,r=>r.pendingLDiverted=true,r=>r.hangingS.push({id:999}),r=>r.unclassifiedS.push({requiresAccommodation:true})]){const r=clone(e.resource);mutate(r);assert.throws(()=>M.pendingLStage(e.state,r,{maxNodes:4000,now:()=>0}),/current projected resource required/);}
 const blocked=clone(e.state),[x,y]=e.resource.pendingCenter[0].alternatives[0].cells[0];blocked.board[y]=blocked.board[y].slice(0,x)+'X'+blocked.board[y].slice(x+1);assert.throws(()=>M.pendingLStage(blocked,e.resource,{maxNodes:4000,now:()=>0}),/public position differs/);assert.equal(M.pendingLStage(blocked,rebase(e.resource,blocked),{maxNodes:4000,now:()=>0}).valid,false);
 assert.throws(()=>M.binding({...e.resource,pendingLDiverted:true}),/current projected resource required/,'Copied diversion flags cannot acquire a route cache identity');
});
test('pending L / actual revealed L closes the authenticated target and takes priority over continued waiting',()=>{
 const o=observedWithNewL(),summary=CurrentProvider.facts(CurrentProvider.prepare(o.state,{obligationContext:Current.exportState(o.history)}));assert.equal(summary.availability,'unknown');assert.equal(o.state.active.type,'L');assert.equal(summary.center.pending.length,1);assert.equal(summary.center.pending[0].family,'SL');
 const options={...bounds,openingPhase:false,obligationContext:Current.exportState(o.history),patternHistory:o.pattern},a=P.decide(o.state,options);assert.ok(a.target);assert.equal(a.target.type,'L');
 const target=summary.center.pending[0].alternatives.find(c=>c.piece==='L');assert.deepEqual(a.continuation[0].event.cells.slice().sort(),target.cells.slice().sort());
 let state=o.state,history=o.history;for(const action of a.witness){const before=state;state=R.move(state,action);history=Current.applyActual(history,{before:before,action:action,after:state}).context;}
 assert.equal(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)})).center.pending.length,0);assert.equal(a.evidence.pendingLStage,null);
 const forged=clone(options.obligationContext);forged.inventory.active.id=forged.inventory.nextId;assert.equal(P.decide(o.state,{...options,obligationContext:forged}).target,null);
});

test('pending L / held usable partner resolves before an otherwise legal same-horizon waiting cap',()=>{
 const o=observedWithNewL({extraO:true}),state=R.move(o.state,'HOLD'),history=Current.applyActual(o.history,{before:o.state,action:'HOLD',after:state}).context,options={...bounds,openingPhase:false,obligationContext:Current.exportState(history),patternHistory:o.pattern};
 assert.equal(state.active.type,'Z');assert.equal(state.hold,'L');assert.deepEqual(state.queue,['O']);
 const a=P.decide(state,options);assert.ok(a.target);assert.equal(a.continuation[0].event.type,'L');assert.equal(a.witness[0],'HOLD');
 assert.deepEqual(a.continuation[0].event.cells.slice().sort(),CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)})).center.pending[0].alternatives[0].cells.slice().sort());
});
test('pending L / exact target survives clears, advice loss, movement, HOLD, same-engine import and fresh page request',()=>{
 let state=R.createState({...route.observation,bag:undefined}),history=Current.start(state),pattern=PH.start(state),expected=null;const snapshots=[];
 for(const step of route.steps){for(const action of step.witness){const before=state;state=R.move(state,action);history=Current.applyActual(history,{before:before,action:action,after:state}).context;if(action==='HD')pattern=PH.update(pattern,before,state,state.lastEvent);}
  const pending=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)})).center.pending;assert.equal(pending.length,1);
  if(!expected)expected=clone(pending[0].alternatives[0].cells);else{const rows=step.event.clearedRows;expected=expected.map(([x,y])=>[x,y+rows.filter(v=>v>y).length]);}
  assert.deepEqual(pending[0].alternatives[0].cells.slice().sort(),expected.slice().sort());snapshots.push({state,history,pattern});
  const restored=Current.importState(clone(Current.exportState(history)),{position:state});assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(restored)})).center.pending,pending,'A fresh worker does not need retained advice to remember this target');
 }
 const one=snapshots[0],moved=R.move(one.state,'R'),mh=Current.applyActual(one.history,{before:one.state,action:'R',after:moved}).context,held=R.move(moved,'HOLD'),hh=Current.applyActual(mh,{before:moved,action:'HOLD',after:held}).context;
 assert.deepEqual(CurrentProvider.facts(CurrentProvider.prepare(held,{obligationContext:Current.exportState(hh)})).center.pending,CurrentProvider.facts(CurrentProvider.prepare(one.state,{obligationContext:Current.exportState(one.history)})).center.pending);
 const Session=require('../st-session'),saved=Session.create(one.state,{obligationContext:one.history,patternHistory:one.pattern,openingPhase:false}),parsed=Session.parse(JSON.stringify(saved));assert.deepEqual(parsed.state.board,one.state.board);
 const imported=Current.start(one.state);assert.equal(CurrentProvider.facts(CurrentProvider.prepare(one.state,{obligationContext:Current.exportState(imported)})).center.pending[0].family,null,'Position-only import has unknown producing history, not copied stage authority');
 return require('./support/page.cjs').withPage('st-lab.html',{},g=>{
  const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};
  g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');g.advance(40);let req=workers.at(-1).message;
  const Context=require('../st-obligation-context'),pending=r=>Context.resolve(Context.importState(r.options.obligationContext,{position:r.observation}),{position:r.observation}).center.pending,expectedPending=parsed.obligationContext.state.center.pending;
  assert.equal(req.previous,null);assert.equal(req.commitment,null);assert.deepEqual(pending(req),expectedPending);
  g.window.stLab.act('HOLD');g.advance(40);assert.equal(pending(workers.at(-1).message)[0].rootId,pending(req)[0].rootId);
  g.window.stLab.act('UNDO');g.advance(40);req=workers.at(-1).message;assert.deepEqual(pending(req),expectedPending);
 });
});
test('pending L / revalidation cannot trust copied selection, hidden future, or stale newly revealed inventory',()=>{
 const a=P.decide(q.observation,{...q.options,...bounds}),forged=clone(a);forged.evidence.pendingLSelection={globallyOptimal:true};forged.evidence.pendingLStage.arrival='L-guaranteed';
 const checked=P.revalidate({...q.observation,privateFuture:['L']},forged,{...q.options,...bounds});assert.ok(checked);assert.equal(checked.evidence.pendingLStage.arrival,'not-established');assert.equal(checked.evidence.pendingLSelection,null,'Semantic revalidation does not carry copied ranking/global-optimality claims');
 const changed=clone(q.observation);changed.queue[0]='L';assert.equal(P.revalidate(changed,forged,{...q.options,...bounds}),null);
});

test('pending L / proposed L diversion cannot acquire waiting authority; actual manual deviation retains the target',()=>{
 const o=observedWithNewL({extraO:true}),summary=CurrentProvider.facts(CurrentProvider.prepare(o.state,{obligationContext:Current.exportState(o.history)})),options={...bounds,obligationContext:Current.exportState(o.history),patternHistory:o.pattern};
 const placements=R.placements(o.state,{allowHold:false,maxNodes:4000}),left=placements.placements.find(p=>p.event.type==='L'&&p.event.cells.every(([x])=>x<4)&&A.newlyCovered(o.state.board,p.state.board,p.event).length===0);assert.ok(left,'Literal safe Left alternative isolates priority from movement legality');
 const path=[{witness:left.witness,event:left.event}],projected=M.checkPath(o.state,path,o.history);assert.equal(projected.resource.pendingLDiverted,true);assert.equal(M.pendingLStageEligible(projected.state,projected.resource),false);
 assert.equal(P.revalidate(o.state,advice(o.state,path),options),null,'A proposed choice cannot spend the usable partner then claim it is unseen');
 let state=o.state,history=o.history;for(const action of left.witness){const before=state;state=R.move(state,action);history=Current.applyActual(history,{before:before,action:action,after:state}).context;}
 const after=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(Current.importState(clone(Current.exportState(history)),{position:state}))}));assert.equal(after.center.pending[0].rootId,summary.center.pending[0].rootId);assert.equal(after.center.debt[0].rootId,summary.center.pending[0].rootId);
 const current=M.start(state,history,{extendForced:false});assert.equal(current.pendingLDiverted,false,'A new request does not pretend the manual move is proposed again');assert.equal(M.pendingLStageEligible(state,current),true,'The original target remains a repair task, not a permanent ban on safe future waiting');
});

test('pending L / authentic player S84 continuation preserves the canonical notch and completes Center with public L',()=>{
 const f=require('./fixtures/pending-L-user-S84.json'),initial=extendPublic(R.createState(f.observation));assert.equal(f.initialForcedNext,'Z');assert.equal(initial.queue.at(-1),'Z');
 // Advice binds the RAW observation while its witnessed results use only the
 // existing uniquely deduced bag member, never the user's later hidden draws.
 const input=advice(initial,f.steps.slice(0,7));input.context=context(f.observation);const full=P.revalidate(f.observation,input,{...f.options,...bounds});assert.ok(full);
 let state=initial,resource=M.start(f.observation,Current.importState(f.options.obligationContext,{position:f.observation})),notches=PH.resolve(f.observation,f.options.patternHistory),stage=null,lines=0;
 for(const [i,p]of f.steps.entries()){const r=R.replay(state,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[p.event]);const phase=S.advanceNotches(state.board,{state:r.state,event:p.event},notches);assert.equal(phase.valid,true);
  assert.deepEqual(A.newlyCovered(state.board,r.state.board,p.event,phase.pattern),[],'Normal scoring-notch coverage is not an actual restoration defect');
  resource=M.step(state,{...p,state:r.state},resource);assert.deepEqual(resource.violations,[]);lines+=p.event.lines;
  if(i===1){assert.equal(resource.pendingCenter[0].rootId,86);stage=resource.pendingCenter[0];assert.equal(resource.hold.id,85);assert.equal(resource.hold.type,'S');}
  if(i===6){assert.equal(resource.pendingCenter.length,0);assert.equal(p.event.type,'L');assert.deepEqual(S.geometry(r.state.board,{notches:phase.pattern}).center.profile,[11,11,11]);}
  state=r.state;notches=phase.pattern;
 }
 assert.ok(stage);assert.equal(lines,6);assert.equal(state.hold,'S');assert.equal(resource.hold.id,85);assert.equal(resource.pendingCenter.length,0);
});

test('pending L / a plausible stage alone cannot authorize a prefix whose visible waiting proof is unfinished',()=>{
 const one=advice(q.observation,route.steps.slice(0,1)),a=P.revalidate(q.observation,one,{...q.options,...bounds});assert.equal(a,null,'The one-lock endpoint needs more than its stage silhouette: this bounded waiting query is unfinished');
 const e=endpoint(),board=clone(e.state.board);board[39]='.'+board[39].slice(1);const inherited={...e.state,board},resource=rebase(e.resource,inherited);
 assert.equal(M.pendingLStage(inherited,resource,{maxNodes:4000,now:()=>0}).valid,true,'Unclaimed imported damage is not invented as an observed construction');
 assert.notEqual(M.pendingLStage(inherited,resource,{maxNodes:4000,now:()=>0,coveredDebt:[[0,39]]}).valid,true,'Actual non-stage debt cannot be discharged by an unrelated pending L target');
});
test('pending L / copied prior stage selection must be freshly compared rather than retaining a global-optimality claim',()=>{
 const prior=advice(q.observation,route.steps);prior.evidence.pendingLSelection={globallyOptimal:true,horizon:7};prior.evidence.pendingLStage={arrival:'guaranteed'};
 const a=P.decide(q.observation,{...q.options,...bounds,previous:prior});assert.ok(a.target);assert.ok(a.evidence.pendingLSelection,'Fresh compared result required');assert.equal(a.evidence.pendingLSelection.globallyOptimal,false);assert.equal(a.evidence.pendingLSelection.horizon,3);assert.ok(a.metrics.nodes>10000);assert.ok(a.metrics.nodes<=45000);
});
