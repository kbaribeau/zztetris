'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),RH=require('../st-resource-history'),PH=require('../st-pattern-history'),B=require('../st-bag');
const original=require('./fixtures/right-cap-score.json'),timing=require('./fixtures/timely-scoring.json'),clone=x=>JSON.parse(JSON.stringify(x));
// The historical OLeft route roofs four uncovered cells and has no repair.
// Preserve it below as a negative. This synthetic positive fills exactly those
// initial vacancies; O/Z/T coordinates and resource/scoring checks stay literal.
const f=clone(original);
for(let y=25;y<=28;y++)f.request.observation.board[y]=f.request.observation.board[y].slice(0,2)+'X'+f.request.observation.board[y].slice(3);
f.request.previous=null;f.request.commitment=null;
f.request.options.resourceContext=RH.exportContext(f.request.observation,RH.start(f.request.observation));
f.request.options.patternHistory=PH.start(f.request.observation);
const eligible=require('./support/st-right-cap-eligible-harness.cjs');
const bounds={depth:3,width:8,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
const decide=(extra={},q=f.request,planner=P)=>planner.decide(q.observation,{...q.options,...bounds,previous:q.previous,commitment:q.commitment,...extra});
const cells=x=>JSON.stringify(x.slice().sort(([a,b],[c,d])=>a-c||b-d));
function replay(raw,a){let state=R.createState(raw),lines=0;for(const step of a.continuation){const r=R.replay(state,step.witness);assert(r.valid);assert.equal(r.events.length,1);assert.deepEqual(r.events[0],step.event);assert(S.canonicalClear(step.event));lines+=step.event.lines;state=r.state;}return{state,lines};}
function withoutMetrics(a){return JSON.parse(JSON.stringify({...a,metrics:undefined}));}


function literalOAdvice(request=f.request){
 let state=R.createState(request.observation);const steps=[];
 for(const witness of [['L','L','HD'],['CW','R','R','R','R','HD']]){const before=state,r=R.replay(state,witness);assert(r.valid);assert.equal(r.events.length,1);state=r.state;const event=r.events[0];steps.push({target:event.target,witness,event,hold:false,holdCount:0,structuralEvidence:S.transition(before,{state,event})});}
 const access=R.tDoubleAccess(state.board);assert.equal(access.reachable,true);const witness=['HOLD',...access.witness],r=R.replay(state,witness);assert(r.valid);assert.equal(r.events.length,1);assert.equal(r.events[0].spin,'full');assert.equal(r.events[0].lines,2);steps.push({target:r.events[0].target,witness,event:r.events[0],hold:true,holdCount:1});
 const root=request.observation,first=steps[0];return{target:first.target,witness:first.witness,hold:false,holdCount:0,continuation:steps,context:JSON.stringify([root.rules,root.board,root.hold,root.canHold,root.queue,root.bag??null,root.active.type]),evidence:{cycleDebt:0}};
}

test('Right roles preserve literal OLeft/cap/held-T coordinates on a roof-free synthetic admission control',()=>{
 const a=literalOAdvice();assert.equal(cells(a.continuation[0].event.cells),cells(f.expectedFirstCells));assert.equal(cells(a.continuation[1].event.cells),cells(f.expectedCapCells));assert.equal(replay(f.request.observation,a).lines,2);assert(P.revalidate(f.request.observation,a,{...f.request.options,...bounds}));
 const moved=R.move(f.request.observation,'L'),history=RH.importContext(f.request.observation,f.request.options.resourceContext),options={...f.request.options,...bounds,resourceContext:RH.exportContext(moved,RH.applyAction(history,f.request.observation,'L',moved))};const advanced=P.advance(moved,a,'L',options);assert(advanced);assert.equal(cells(advanced.continuation[0].event.cells),cells(f.expectedFirstCells));assert.equal(replay(moved,advanced).lines,2);
});

test('Right roles supersede the old O-Right incumbent without disabling the cap/score route',()=>{
 const off=decide({disableRightCapPreference:true}),a=decide();assert.deepEqual(withoutMetrics(a),withoutMetrics(off));
 assert.equal(a.metrics.rightCapPreference,undefined,'The old O-Right branch is intentionally no longer eligible');
 assert(a.continuation[0].event.cells.every(([x])=>x<7),'The ordinary O must stay out of Right');assert.equal(cells(a.continuation[1].event.cells),cells(f.expectedCapCells));
 assert.deepEqual(a.continuation.map(p=>[p.event.type,p.event.lines]),[['O',0],['Z',0],['T',2]]);
 assert.equal(a.continuation[2].holdCount,1);assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);assert(a.metrics.nodes<=45000);assert.equal(replay(f.request.observation,a).lines,2);
 for(const p of a.continuation)assert(p.event.cells.every(([x])=>x<7)||['Z','T','I'].includes(p.event.type));
});

test('Right cap branch harness: actual goal-free I incumbent and ILeft/Z/held-T proof keep every admission guard',()=>{
 const q=eligible.request();assert.equal(q.observation.bag,undefined);assert.equal(q.options.resourceContext.fresh,false);assert.equal(q.options.resourceContext.steps.length,0);assert.equal(RH.resolve(q.observation,RH.importContext(q.observation,q.options.resourceContext)).coverage.status,'partial');
 const r=R.replay(q.observation,eligible.incumbentWitness);assert(r.valid);assert.equal(r.events[0].type,'I');assert.equal(r.events[0].lines,0);assert(r.events[0].cells.every(([x])=>x===9));
 const old=decide({disableRightCapPreference:true},q,eligible.planner());assert.equal(old.target.type,'I');assert.equal(P.resourceGoal(old.continuation),false);assert(P.revalidate(q.observation,old,{...q.options,...bounds}));
 assert(old.continuation[0].event.cells.some(c=>f.expectedCapCells.some(d=>cells([c])===cells([d]))));
 const a=decide({},q,eligible.planner());assert.equal(a.metrics.rightCapPreference.selected,true);assert.equal(cells(a.continuation[0].event.cells),cells(eligible.firstCells));assert.equal(cells(a.continuation[1].event.cells),cells(f.expectedCapCells));assert.deepEqual(a.continuation.map(p=>[p.event.type,p.event.lines]),[['I',0],['Z',0],['T',2]]);assert.equal(a.continuation[2].holdCount,1);assert.equal(replay(q.observation,a).lines,2);assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);assert(a.metrics.nodes<=45000);
});

test('Right cap preference: synthetic positive needs no repair while the original accessible roof is rejected',()=>{
 const a=decide(),first=a.continuation[0],r=R.replay(R.createState(f.request.observation),first.witness);
 const before=P.assess(f.request.observation.board),after=P.assess(r.state.board);
 assert.equal(after.covered,before.covered);assert.equal(after.leftSealed,before.leftSealed);assert.deepEqual(P.cavityRepairDebt(before,after,r.events[0],[]),[]);
 assert.equal(a.evidence.gapAccess.reachable,true);
 const old=literalOAdvice(original.request),proof=require('../st-access').repairPrefix(original.request.observation,old.continuation);
 assert.deepEqual(proof.steps[0].created,[[2,25],[2,26],[2,27],[2,28]]);assert.deepEqual(proof.outstandingCells,[[2,27],[2,28],[2,29],[2,30]]);assert.equal(proof.valid,false);
 assert.equal(P.revalidate(original.request.observation,old,{...original.request.options,...bounds}),null);
});

test('Right cap preference: public movement does not lose the current-piece proof or history binding',()=>{
 const q=clone(f.request),previous=decide(),before=R.createState(q.observation),h=RH.importContext(before,q.options.resourceContext),moved=R.move(before,'L');assert.notEqual(moved,before);
 q.observation=P.observe(moved);q.options.resourceContext=RH.exportContext(moved,RH.applyAction(h,before,'L',moved));
 const advanced=P.advance(moved,previous,'L',{...q.options,...bounds});assert(advanced);assert.deepEqual(advanced.witness,previous.witness.slice(1));replay(q.observation,advanced);
 const a=decide({},q);assert(a.target,a.reason);assert.equal(a.metrics.rightCapPreference,undefined);assert(a.continuation[0].event.cells.every(([x])=>x<7));replay(q.observation,a);
});

test('Right cap preference: actual locks, normal reveals and HOLD retain the finite score obligation',()=>{
 let state=R.createState(f.request.observation),history=RH.importContext(state,f.request.options.resourceContext),phase=f.request.options.patternHistory,advice=decide();
 const original=clone(advice.continuation);let draws=0;
 for(let i=0;i<3;i++){
  const before=state,activeAdvice=advice;
  for(const action of original[i].witness){const prior=state;state=R.move(state,action);assert.notEqual(state,prior);if(action==='HD'){state={...state,queue:[...state.queue,f.revealAfterLocks[draws]],bag:B.consume(state.bag,f.revealAfterLocks[draws])};draws++;}history=RH.applyAction(history,prior,action,state);if(action==='HD')phase=PH.update(phase,prior,state,state.lastEvent);if(i===2&&action==='HOLD'){const advanced=P.advance(state,activeAdvice,'HOLD',{...bounds,openingPhase:false,resourceContext:RH.exportContext(state,history),patternHistory:phase});assert(advanced,'real held T remains valid after the actual HOLD');assert.equal(advanced.holdCount,0);assert.equal(advanced.continuation[0].event.lines,2);}}
  assert.deepEqual(state.lastEvent,original[i].event);
  const options={...bounds,resourceContext:RH.exportContext(state,history),patternHistory:phase,openingPhase:false};
  const retained=P.continueCommitment(before,state,activeAdvice,state.lastEvent,options);
  if(i<2){assert(retained,'actual remaining cap/T goal must survive');assert.equal(retained.continuation.at(-1).event.lines,2);assert(P.revalidate(state,retained,options));advice=retained;}else assert.equal(retained,null);
 }
 assert.equal(draws,3);assert.equal(RH.resolve(state,history).coverage.status,'partial');
});

test('Right cap eligible-I branch harness: unknown optional access returns the exact already certified incumbent',()=>{
 const q=eligible.request();let interrupted=0;
 const planner=eligible.planner({tDoubleAccess(board,options){interrupted++;return{reachable:null,complete:false,witness:[],event:null,visited:Math.min(7,options.maxNodes)};}});
 const old=decide({disableRightCapPreference:true},q,eligible.planner()),a=decide({},q,planner);
 assert(interrupted>0);assert.equal(a.metrics.rightCapPreference?.selected,false);assert(a.metrics.rightCapPreference.unknown>0);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));assert(a.metrics.nodes<=45000);replay(q.observation,a);
});

test('Right cap eligible-I branch harness: exhausted optional work cannot force reproof of its incumbent',()=>{
 const q=eligible.request();let spent=0;
 const planner=eligible.planner({tDoubleAccess(board,options){spent=options.maxNodes;return{reachable:null,complete:false,witness:[],event:null,visited:options.maxNodes};}});
 const old=decide({disableRightCapPreference:true},q,eligible.planner()),a=decide({},q,planner);
 assert(spent>0);assert.equal(a.metrics.nodes,45000);assert.equal(a.metrics.rightCapPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));
});

test('Right cap eligible-I branch harness: optional proof crossing the wall deadline preserves its checked incumbent',()=>{
 const q=eligible.request(),deadline=100000;let clock=0,expired=0;
 const planner=eligible.planner({tDoubleAccess(board,options){expired++;clock=deadline+1;return{reachable:null,complete:false,witness:[],event:null,visited:Math.min(7,options.maxNodes)};}});
 const old=decide({disableRightCapPreference:true,deadline},q,eligible.planner()),a=decide({now:()=>clock,deadline},q,planner);
 assert(expired>0);assert(clock>deadline);assert.equal(a.metrics.rightCapPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));assert(a.metrics.nodes<=45000);
});

test('Right cap eligible-I branch harness: complete negative optional entry also preserves the incumbent',()=>{
 const q=eligible.request();let denied=0;
 const planner=eligible.planner({tDoubleAccess(){denied++;return{reachable:false,complete:true,witness:[],event:null,visited:0};}});
 const old=decide({disableRightCapPreference:true},q,eligible.planner()),a=decide({},q,planner);assert(denied>0);assert.equal(a.metrics.rightCapPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));
});

test('Right cap preference: caller/imported metadata is not optional admission authority',()=>{
 const a=decide({rightCapAdmission:()=>{throw Error('caller callback must not run');},rightCapPreference:{selected:true,lostCapCells:[]}});
 assert.equal(a.metrics.rightCapPreference,undefined);assert.equal(a.continuation[2].event.lines,2);
 const q=clone(f.request);q.options.resourceContext.steps.push({action:'BOGUS',revealed:[]});const invalid=decide({},q);assert.equal(invalid.target,null);assert.notEqual(invalid.metrics.rightCapPreference?.selected,true);
});

test('Right cap preference: copied selection metadata cannot rescue a stale or forged continuation',()=>{
 const a=decide(),q=clone(f.request),forged=clone(a);forged.continuation[1].witness=['HD'];
 assert.equal(P.revalidate(q.observation,forged,{...q.options,...bounds}),null);
 const fresh=decide({previous:forged});assert.equal(fresh.metrics.rightCapPreference,undefined);assert.deepEqual(withoutMetrics(fresh),withoutMetrics(a));
 const stale=clone(a);stale.context='not-the-current-public-request';assert.equal(P.revalidate(q.observation,stale,{...q.options,...bounds}),null);
});

test('Right cap preference: depth and construction controls preserve their original decision path',()=>{
 for(const control of [{depth:2},{disableConstruction:true},{allowHold:false}]){const off=decide({...control,disableRightCapPreference:true}),on=decide(control);assert.equal(on.metrics.rightCapPreference,undefined);assert.deepEqual(withoutMetrics(on),withoutMetrics(off));}
});

test('Right cap preference: existing actual scoring commitment is not replaced by the new preference',()=>{
 const a=decide({},timing.request),off=decide({disableRightCapPreference:true},timing.request);assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.lines,2);assert.equal(a.metrics.rightCapPreference,undefined);assert.deepEqual(withoutMetrics(a),withoutMetrics(off));
});

test('Right cap eligible-I branch harness: caller flags and serialized stale proofs cannot supply private admission authority',()=>{
 const q=eligible.request(),a=decide({rightCapAdmission:()=>{throw Error('caller callback must not run');},rightCapPreference:{selected:true,lostCapCells:[]}},q,eligible.planner());assert.equal(a.metrics.rightCapPreference.selected,true);
 const forged=clone(a);forged.continuation[1].witness=['HD'];assert.equal(P.revalidate(q.observation,forged,{...q.options,...bounds}),null);
 const fresh=decide({previous:forged},q,eligible.planner());assert.equal(fresh.metrics.rightCapPreference.selected,true);assert.deepEqual(withoutMetrics(fresh),withoutMetrics(a));
 const stale=clone(a);stale.context='not-the-current-public-request';assert.equal(P.revalidate(q.observation,stale,{...q.options,...bounds}),null);
 const invalid=clone(q);invalid.options.resourceContext.steps.push({action:'BOGUS',revealed:[]});assert.equal(decide({},invalid,eligible.planner()).target,null);
});
