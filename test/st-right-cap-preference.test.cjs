'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),RH=require('../st-resource-history'),PH=require('../st-pattern-history'),B=require('../st-bag');
const f=require('./fixtures/right-cap-score.json'),timing=require('./fixtures/timely-scoring.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={depth:3,width:8,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
const decide=(extra={},q=f.request,planner=P)=>planner.decide(q.observation,{...q.options,...bounds,previous:q.previous,commitment:q.commitment,...extra});
const cells=x=>JSON.stringify(x.slice().sort(([a,b],[c,d])=>a-c||b-d));
function replay(raw,a){let state=R.createState(raw),lines=0;for(const step of a.continuation){const r=R.replay(state,step.witness);assert(r.valid);assert.equal(r.events.length,1);assert.deepEqual(r.events[0],step.event);assert(S.canonicalClear(step.event));lines+=step.event.lines;state=r.state;}return{state,lines};}
function withoutMetrics(a){return JSON.parse(JSON.stringify({...a,metrics:undefined}));}
function isolatedPlanner(overrides){const filename=path.resolve(__dirname,'../st-planner.js'),m=new Module(filename,module),req=Module.createRequire(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m.require=id=>id==='./st-rules.js'?Object.freeze({...R,...overrides}):req(id);m._compile(fs.readFileSync(filename,'utf8'),filename);return m.exports;}
function capBoard(){let s=R.createState(f.request.observation);for(const w of [['L','L','HD'],['CW','R','R','R','R','HD']]){const r=R.replay(s,w);assert(r.valid);s=r.state;}return s.board;}

test('Right cap preference: a certified visible cap and held-T score replace only the goal-free Right filler',()=>{
 const old=decide({disableRightCapPreference:true}),a=decide();
 assert.equal(old.target.type,'O');assert.equal(old.target.x,7);assert.equal(P.resourceGoal(old.continuation),false);
 assert.equal(a.metrics.rightCapPreference.selected,true);assert.equal(cells(a.continuation[0].event.cells),cells(f.expectedFirstCells));
 assert.equal(cells(a.continuation[1].event.cells),cells(f.expectedCapCells));
 assert.deepEqual(a.continuation.map(p=>[p.event.type,p.event.lines]),[['O',0],['Z',0],['T',2]]);
 assert.equal(a.continuation[2].holdCount,1);assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);assert(a.metrics.nodes<=45000);
 assert.equal(replay(f.request.observation,a).lines,2);assert.equal(replay(f.request.observation,old).lines,0);
 // Occupied cap cells, not a shape label, establish the lost opportunity.
 assert(old.continuation[0].event.cells.some(c=>f.expectedCapCells.some(d=>cells([c])===cells([d]))));
});

test('Right cap preference: the accessible Left overhang remains allowed, unlike sealed alternatives',()=>{
 const a=decide(),first=a.continuation[0],r=R.replay(R.createState(f.request.observation),first.witness);
 const before=P.assess(f.request.observation.board),after=P.assess(r.state.board);
 assert(after.covered>before.covered);assert.equal(after.leftSealed,before.leftSealed);assert.deepEqual(P.cavityRepairDebt(before,after,r.events[0],[]),[]);
 assert.equal(a.evidence.gapAccess.reachable,true);
});

test('Right cap preference: public movement does not lose the current-piece proof or history binding',()=>{
 const q=clone(f.request),previous=decide(),before=R.createState(q.observation),h=RH.importContext(before,q.options.resourceContext),moved=R.move(before,'L');assert.notEqual(moved,before);
 q.observation=P.observe(moved);q.options.resourceContext=RH.exportContext(moved,RH.applyAction(h,before,'L',moved));
 const advanced=P.advance(moved,previous,'L',{...q.options,...bounds});assert(advanced);assert.deepEqual(advanced.witness,previous.witness.slice(1));replay(q.observation,advanced);
 const a=decide({},q);assert(a.target,a.reason);assert.equal(a.metrics.rightCapPreference?.selected,true);assert.equal(cells(a.continuation[0].event.cells),cells(f.expectedFirstCells));replay(q.observation,a);
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

test('Right cap preference: unknown optional access returns the exact already certified incumbent',()=>{
 const wanted=JSON.stringify(capBoard());let interrupted=0;
 const planner=isolatedPlanner({tDoubleAccess(board,options){if(JSON.stringify(board)===wanted){interrupted++;return{reachable:null,complete:false,witness:[],event:null,visited:Math.min(7,options.maxNodes)};}return R.tDoubleAccess(board,options);}});
 const old=decide({disableRightCapPreference:true}),a=decide({},f.request,planner);
 assert(interrupted>0);assert.equal(a.metrics.rightCapPreference?.selected,false);assert(a.metrics.rightCapPreference.unknown>0);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));assert(a.metrics.nodes<=45000);replay(f.request.observation,a);
});

test('Right cap preference: exhausted optional work cannot force reproof of its incumbent',()=>{
 const wanted=JSON.stringify(capBoard());let spent=0;
 const planner=isolatedPlanner({tDoubleAccess(board,options){if(JSON.stringify(board)===wanted){spent=options.maxNodes;return{reachable:null,complete:false,witness:[],event:null,visited:options.maxNodes};}return R.tDoubleAccess(board,options);}});
 const old=decide({disableRightCapPreference:true}),a=decide({},f.request,planner);
 assert(spent>0);assert.equal(a.metrics.nodes,45000);assert.equal(a.metrics.rightCapPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));
});

test('Right cap preference: optional proof crossing the wall deadline preserves its checked incumbent',()=>{
 const wanted=JSON.stringify(capBoard()),deadline=100000;let clock=0,expired=0;
 const planner=isolatedPlanner({tDoubleAccess(board,options){if(JSON.stringify(board)===wanted){expired++;clock=deadline+1;return{reachable:null,complete:false,witness:[],event:null,visited:Math.min(7,options.maxNodes)};}return R.tDoubleAccess(board,options);}});
 const old=decide({disableRightCapPreference:true,deadline}),a=decide({now:()=>clock,deadline},f.request,planner);
 assert(expired>0);assert(clock>deadline);assert.equal(a.metrics.rightCapPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));assert(a.metrics.nodes<=45000);
});

test('Right cap preference: complete negative optional entry also preserves the incumbent',()=>{
 const wanted=JSON.stringify(capBoard());let denied=0;
 const planner=isolatedPlanner({tDoubleAccess(board,options){if(JSON.stringify(board)===wanted){denied++;return{reachable:false,complete:true,witness:[],event:null,visited:0};}return R.tDoubleAccess(board,options);}});
 const old=decide({disableRightCapPreference:true}),a=decide({},f.request,planner);assert(denied>0);assert.equal(a.metrics.rightCapPreference.selected,false);assert.deepEqual(withoutMetrics(a),withoutMetrics(old));
});

test('Right cap preference: caller/imported metadata is not optional admission authority',()=>{
 const a=decide({rightCapAdmission:()=>{throw Error('caller callback must not run');},rightCapPreference:{selected:true,lostCapCells:[]}});
 assert.equal(a.metrics.rightCapPreference.selected,true);assert.equal(a.continuation[2].event.lines,2);
 const q=clone(f.request);q.options.resourceContext.steps[0].action='BOGUS';const invalid=decide({},q);assert.equal(invalid.target,null);assert.notEqual(invalid.metrics.rightCapPreference?.selected,true);
});

test('Right cap preference: copied selection metadata cannot rescue a stale or forged continuation',()=>{
 const a=decide(),q=clone(f.request),forged=clone(a);forged.continuation[1].witness=['HD'];
 assert.equal(P.revalidate(q.observation,forged,{...q.options,...bounds}),null);
 const fresh=decide({previous:forged});assert.equal(fresh.metrics.rightCapPreference.selected,true);assert.deepEqual(withoutMetrics(fresh),withoutMetrics(a));
 const stale=clone(a);stale.context='not-the-current-public-request';assert.equal(P.revalidate(q.observation,stale,{...q.options,...bounds}),null);
});

test('Right cap preference: depth and construction controls preserve their original decision path',()=>{
 for(const control of [{depth:2},{disableConstruction:true},{allowHold:false}]){const off=decide({...control,disableRightCapPreference:true}),on=decide(control);assert.equal(on.metrics.rightCapPreference,undefined);assert.deepEqual(withoutMetrics(on),withoutMetrics(off));}
});

test('Right cap preference: existing actual scoring commitment is not replaced by the new preference',()=>{
 const a=decide({},timing.request),off=decide({disableRightCapPreference:true},timing.request);assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.lines,2);assert.equal(a.metrics.rightCapPreference,undefined);assert.deepEqual(withoutMetrics(a),withoutMetrics(off));
});
