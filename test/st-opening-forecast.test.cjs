'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),O=require('../st-opening'),R=require('../st-rules'),B=require('../st-bag'),f=require('./fixtures/opening-forecast-public.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function intercepted(extras){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-planner'?{...P,...extras}:require(id.replace('./','../')),Date});return module.exports;}
function rawAdvice(){return{continuation:f.forecast.path,evidence:{opening:{handoffCandidate:{status:'verified-public-post-clear-continuation',continuation:f.forecast.continuation}}}};}
function followed(){let c=O.captureForecast(f.forecast.origin,rawAdvice());for(const a of f.forecast.actions){const before=c.observation,r=R.replay(before,[a.action]),after={...r.state,revision:before.revision+1,queue:[...r.state.queue,...a.revealed]};for(const t of a.revealed)if(after.bag)after.bag=B.consume(after.bag,t);c=O.advanceForecast(c,before,after,a.action);assert(c);}return c;}
test('opening forecast: public exact prefix survives real reveals and becomes eligible only at the matching clear',()=>{
 const c=followed();assert.equal(c.complete,true);assert.deepEqual(c.observation.board,f.request.observation.board);assert.deepEqual(c.observation.queue,f.request.observation.queue);
 const input={...f.forecast.origin,hiddenQueue:['I'],seed:123};const captured=O.captureForecast(input,rawAdvice());assert(!('hiddenQueue' in captured.origin));assert(!('seed' in captured.origin));assert.equal(captured.complete,false);assert.equal(O.advanceForecast(c,c.observation,c.observation,'L'),null);
});
test('opening forecast: deviation, unknown version, mismatching bag and unsupported actions discard candidates',()=>{
 for(const change of [c=>c.version++,c=>c.observation.board[39]='..........',c=>c.observation.bag.remaining=[0]]){
  const c=O.captureForecast(f.forecast.origin,rawAdvice());change(c);const before=f.forecast.origin,r=R.replay(before,['R']);r.state.revision=before.revision+1;assert.equal(O.advanceForecast(c,before,r.state,'R'),null);
 }
 const c=O.captureForecast(f.forecast.origin,rawAdvice());assert.equal(O.advanceForecast(c,c.observation,c.observation,'L'),null);
 const advice=rawAdvice();advice.continuation=clone(advice.continuation);advice.continuation[0].witness=['EXEC','HD'];assert.equal(O.captureForecast(f.forecast.origin,advice),null);
});
test('opening forecast: revalidation and failed fallback share the original handoff allowance',()=>{
 const calls=[];const mock=intercepted({revalidateOpeningForecast:(_s,_p,o,w)=>{calls.push(['revalidate',o.maxNodes,o.deadline]);w.nodes=123;w.reason='controlled-rejection';return null;},plan:(_s,o)=>{calls.push(['search',o.maxNodes,o.deadline]);return{target:null,status:'budget-exhausted',metrics:{nodes:o.maxNodes}};}});
 const work={},q=f.request;assert.equal(mock.handoff(q.observation,q.options.openingClear,{...q.options,openingForecast:f.forecast,deadline:1500,now:()=>0},work),null);
 assert.equal(calls.length,2);assert.deepEqual(calls[0],['revalidate',12000-2*f.forecast.actions.length,200]);assert.deepEqual(calls[1],['search',12000-2*f.forecast.actions.length-123,200]);assert.equal(work.nodes,12000);assert.equal(work.forecast.retained,false);
});
test('opening forecast: rejected transport skips validator, keeps charged replay work, and uses normal search',()=>{
 let validated=0;const mock=intercepted({revalidateOpeningForecast:()=>{validated++;throw Error('not expected');},plan:(_s,o)=>({target:null,status:'budget-exhausted',metrics:{nodes:7}})}),q=f.request,c=clone(f.forecast);c.actions.at(-1).revealed=['T'];
 const work={};mock.handoff(q.observation,q.options.openingClear,{...q.options,openingForecast:c,deadline:1500,now:()=>0},work);assert.equal(validated,0);assert.equal(work.source,'fresh-search');assert.equal(work.forecast.nodes,2*c.actions.length);assert.equal(work.nodes,2*c.actions.length+7);
});
test('opening forecast: a retained prefix avoids fresh search and records actual-clear provenance',()=>{
 let searched=0;const target=f.forecast.continuation[0].target,mock=intercepted({revalidateOpeningForecast:(_s,steps,o,w)=>{w.nodes=19;w.retained=true;w.reason='ordinary-prefix-revalidated';return{target,continuation:steps,metrics:{nodes:19},evidence:{},reason:'Checked.'};},plan:()=>{searched++;throw Error('Fresh search not expected');}}),q=f.request,work={};
 const result=mock.handoff(q.observation,q.options.openingClear,{...q.options,openingForecast:f.forecast,deadline:1500,now:()=>0},work);assert.equal(searched,0);assert.equal(work.source,'forecast-revalidated');assert.equal(work.nodes,2*f.forecast.actions.length+19);assert.equal(result.metrics.nodes,work.nodes);assert.equal(result.evidence.openingHandoff.forecast.status,'revalidated-after-actual-clear');
});
