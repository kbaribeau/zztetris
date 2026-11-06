'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),O=require('../st-opening'),R=require('../st-rules'),H=require('../st-resource-history'),B=require('../st-bag'),f=require('./fixtures/opening-third-t-prefix.json');
const clone=x=>JSON.parse(JSON.stringify(x)),config={...f.request.options,deadline:Infinity};
function advice(){return{continuation:f.steps,evidence:{opening:{firstTsdPrefix:{status:'checked-visible-first-tsd'}}}};}
function followed(count=1,{refill=false,legacy=false}={}){
 let state=R.createState(f.request.observation),history=H.importContext(state,f.request.options.resourceContext),pattern=f.request.options.patternHistory,clear=null;
 const initial=advice();if(legacy)initial.evidence.opening.handoffCandidate={status:'verified-public-post-clear-continuation',continuation:[f.steps.at(-1)]};
 let forecast=O.captureForecast(state,initial);
 for(const step of f.steps.slice(0,count))for(const action of step.witness){
  const before=state;state=R.move(state,action);
  if(refill&&state.queue.length<before.queue.length){const piece=B.possibilities(state.bag)[0];assert(piece);state={...state,queue:[...state.queue,piece],bag:B.consume(state.bag,piece)};assert.deepEqual(B.validate(state.bag),[]);}
  history=H.applyAction(history,before,action,state);
  if(action==='HD'){pattern=P.updatePatternHistory(pattern,before,state,state.lastEvent);if(state.lastEvent.lines)clear={before:clone(before),event:clone(state.lastEvent)};}
  forecast=O.advanceForecast(forecast,before,state,action);assert(forecast);
 }
 return{state,forecast,history,clear,options:{...config,resourceContext:H.exportContext(state,history),patternHistory:pattern,openingForecast:forecast}};
}
test('first TSD retention: exact original prefix is retained independently of unknown maintenance proof',()=>{
 const a=followed(),result=P.plan(a.state,a.options);assert.equal(result.target.type,'S');assert.equal(result.phase,'opening');assert.equal(result.metrics.firstTsdRetention.retained,true);assert.equal(result.evidence.opening.handoffCandidate,null);assert.equal(result.evidence.opening.firstTsdPrefix,undefined,'Do not rebase the immutable original routing envelope');
 assert.deepEqual(result.continuation.map(p=>p.event),f.steps.slice(1).map(p=>p.event));assert(result.metrics.nodes<=45000);assert.equal(O.captureForecast(a.state,result),null);
 const b=followed(2),score=P.plan(b.state,b.options);assert.equal(score.target.type,'T');assert.equal(score.continuation[0].event.lines,2);assert.equal(score.phase,'opening');
});
test('first TSD retention: actual refill is recorded but cannot rescue an originally impossible route',()=>{
 const a=followed(1,{refill:true});assert.equal(a.state.queue.length,6);assert.equal(a.forecast.actions.at(-1).revealed.length,1);
 const retained=P.plan(a.state,a.options);assert.equal(retained.metrics.firstTsdRetention.retained,true);assert.equal(retained.target.type,'S');assert.equal(retained.continuation.at(-1).event.lines,2);
 const forged=clone(a.options);forged.deadline=Infinity;forged.openingForecast.origin.queue=[];
 const rejected=P.plan(a.state,forged);assert.equal(rejected.metrics.firstTsdRetention.retained,false);assert.match(rejected.metrics.firstTsdRetention.reason,/^original-/);
});
test('first TSD retention: incomplete legacy routing retains its independently checked maintenance continuation',()=>{
 const a=followed(1,{legacy:true});assert.equal(a.forecast.kind,undefined);const saved=clone(a.forecast.continuation);
 const result=P.plan(a.state,a.options);assert.equal(result.metrics.firstTsdRetention.retained,true);assert.equal(result.target.type,'S');assert.equal(O.captureForecast(a.state,result),null);assert.deepEqual(a.forecast.continuation,saved);
});
test('first TSD retention: mismatched event, action, bag, resource history and exhausted budgets fail closed',()=>{
 const a=followed();for(const mutate of [o=>o.openingForecast.path[1].event.lines=2,o=>o.openingForecast.actions[0].action='CW',o=>o.openingForecast.origin.bag.remaining=[-1],o=>o.resourceContext=null]){
  const options=clone(a.options);options.deadline=Infinity;mutate(options);const result=P.plan(a.state,options);assert.notEqual(result.metrics.firstTsdRetention?.retained,true);
 }
 const zero=P.plan(a.state,{...a.options,maxNodes:0});assert.equal(zero.target,null);assert.equal(zero.metrics.nodes,0);
 const expired=P.plan(a.state,{...a.options,now:()=>10,deadline:10});assert.equal(expired.target,null);
});
test('first TSD retention: completed construction route is never a maintenance forecast',()=>{
 const a=followed(3);assert(a.forecast.complete);const last=f.steps.at(-1);assert.equal(a.forecast.kind,'construction-first-tsd');
 const withBoth=advice();withBoth.evidence.opening.handoffCandidate={status:'verified-public-post-clear-continuation',continuation:[last]};assert.equal(O.captureForecast(f.request.observation,withBoth).kind,undefined,'Keep the independently checked maintenance forecast when both goals are present');
 const result=P.plan(a.state,{...a.options,openingClear:a.clear});assert.notEqual(result.metrics.firstTsdRetention?.retained,true);assert.equal(result.metrics.handoffWork.legacy.forecast.retained,false);assert.equal(result.metrics.handoffWork.legacy.forecast.reason,'no-completed-forecast');
});
