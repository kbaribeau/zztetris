'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const R=require('../st-rules'),Context=require('../st-obligation-context'),Provider=require('../st-resource-provider'),O=require('../st-opening');
const copy=x=>JSON.parse(JSON.stringify(x)),bounds={maxNodes:45000,now:()=>0,deadline:Infinity};
function openingWithProvider(provider,plannerOverrides={}){
 const file=require.resolve('../st-opening'),req=createRequire(file),box={module:{exports:{}},performance,require:name=>name==='./st-resource-provider'?provider:name==='./st-planner'?{...req(name),...plannerOverrides}:req(name)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),box,{filename:file});return box.module.exports;
}
test('opening current authority: a native opening T remains construction, not ordinary admission',()=>{
 const state=R.createState({active:'T',queue:['T']}),context=Context.exportState(Context.start(state)),saved=copy(context);
 const opening=openingWithProvider({...Provider,startRoute:()=>{throw Error('Opening construction must not start ordinary assessment');}});
 const result=opening.plan(state,{...bounds,obligationContext:context,openingDepth:1,disableOpeningSources:true});
 assert.ok(result.target);assert.equal(result.phase,'opening');assert.equal(result.continuation.length,1);
 const event=result.continuation[0].event;assert.equal(event.type,'T');assert.equal(event.lines,0);assert.ok(event.cells.every(([x])=>x<4));
 assert.equal(result.evidence.opening.handoffCandidate,null);assert.deepEqual(context,saved);
});
test('opening current authority: native current allocation retains the exact public third-T prefix',()=>{
 const f=require('./fixtures/opening-third-t-prefix.json');
 let state=R.createState(f.request.observation),context=Provider.prepare(state,f.request.options).context;
 const original={continuation:f.steps,evidence:{opening:{firstTsdPrefix:{status:'checked-visible-first-tsd'}}}};
 let forecast=O.captureForecast(state,original);
 for(const action of f.steps[0].witness){const before=state;state=R.move(before,action);context=Context.applyActual(context,{before,action,after:state}).context;forecast=O.advanceForecast(forecast,before,state,action);}
 const snapshot=Context.exportState(context),result=O.plan(state,{...bounds,obligationContext:snapshot,openingForecast:forecast});
 assert.ok(result.target);assert.equal(result.metrics.firstTsdRetention.retained,true);assert.equal(result.phase,'opening');
 assert.deepEqual(result.continuation.map(p=>p.event),f.steps.slice(1).map(p=>p.event));assert.equal(result.evidence.opening.handoffCandidate,null);
 assert.deepEqual(Context.exportState(context),snapshot,'Hypothetical first-TSD proof never changes actual duties');
});
test('opening current authority: explicitly unavailable accounting cannot use the geometric handoff fallback',()=>{
 const f=require('./support/st-opening-handoff.json'),state=R.createState(f.after),current=Context.exportState(Context.start(state));
 current.status='unavailable';current.reason='Current accounting intentionally unavailable';current.state=null;
 const options={...bounds,obligationContext:current},proof={before:f.before,event:f.event};
 assert.equal(O.handoff(state,proof,options),null);const result=O.plan(state,{...options,openingClear:proof});
 assert.equal(result.target,null);assert.match(result.reason,/accounting is unavailable/);
});
test('opening current authority: actual no-context handoff and future supplied-unknown probe keep distinct dispatch',()=>{
 const f=require('./support/st-opening-handoff.json'),queries=[];
 const opening=openingWithProvider(Provider,{plan:(raw,options)=>{
  const input=Provider.prepare(raw,options);queries.push({supplied:input.supplied,availability:input.availability,source:input.source,resource:options.resource});
  return{target:null,status:'no-supported-continuation-found',metrics:{nodes:0}};
 }});
 assert.equal(opening.handoff(f.after,{before:f.before,event:f.event},bounds),null);
 assert.equal(queries.length,1);assert.equal(queries[0].supplied,false);assert.equal(queries[0].availability,'unknown');assert.ok(queries[0].resource);
 queries.length=0;
 opening.plan(f.before,{...bounds,openingDepth:1,disableOpeningSources:true});
 assert.ok(queries.length>0,'The literal clear reaches a hypothetical maintenance query');
 for(const input of queries){assert.equal(input.supplied,true);assert.equal(input.availability,'unknown');assert.equal(input.source,'implicit');assert.ok(input.resource);}
});
