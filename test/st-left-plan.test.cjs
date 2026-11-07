'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),C=require('../st-obligation-context'),P=require('../st-left-plan'),Provider=require('../st-resource-provider'),Resources=require('../st-obligation-resources'),Tracking=require('../st-obligation-tracking'),f=require('./fixtures/current-left-goal.json');
const clone=x=>JSON.parse(JSON.stringify(x)),repair={cells:[[1,29],[1,30],[0,31],[1,31]],resultProfile:[9,11,11,11]};
test('Left plan / authentic future J records one CURRENT deficit through untouched Center and Right preparation',()=>{
 assert.deepEqual(P.selectedRepairs(f.observation,f.advice,{checked:true}),[repair]);
 const position=R.createState(f.observation),current=C.start(position),beforeKey=Provider.binding(Provider.prepare(position,{obligationContext:C.exportState(current)})),adopted=C.acceptLeftRepair(current,{position,repair,checked:true});
 assert.equal(adopted.context.state.leftGoals.length,1);assert.equal(Provider.binding(Provider.prepare(position,{obligationContext:C.exportState(adopted.context)})),beforeKey,'observational goal cannot stale or authorize existing policy proof');
 assert.notEqual(Resources.binding(Provider.startRoute(Provider.prepare(position,{obligationContext:C.exportState(adopted.context)}))),Resources.binding(Provider.startRoute(Provider.prepare(position,{obligationContext:C.exportState(current)}))),'complete projected node still distinguishes current jobs');
 const tracker=Tracking.create(),events=[],frame=(c,s)=>({status:c.status,state:c.state,view:C.resolve(c,{position:s})});tracker.subscribe(e=>events.push(e));tracker.transition(frame(current,position),frame(adopted.context,position),{operation:{kind:'accept-left-repair',repair,checked:true},effects:adopted.effects});
 let c=adopted.context,s=position;for(const [i,step] of f.advice.continuation.entries())for(const action of step.witness){const before=s;s=R.move(s,action);const result=C.applyActual(c,{before,action,after:s});assert.equal(result.context.status,'available',result.context.reason);tracker.transition(frame(c,before),frame(result.context,s),{operation:action==='HD'?{kind:'lock',piece:result.receipt.locked,event:s.lastEvent}:{kind:'observe'},effects:result.effects});c=result.context;if(action==='HD')assert.equal(c.state.leftGoals.length,i===2?0:1);}
 assert.deepEqual(events,[]);
});
test('Left plan / cached labels, risky advice, altered profiles/events or later Left changes do not create work',()=>{
 assert.deepEqual(P.selectedRepairs(f.observation,f.advice),[]);
 for(const edit of [a=>a.recommendation.kind='risky',a=>a.continuation[2].structuralEvidence.leftRepair.beforeProfile[0]++,a=>a.continuation[2].event.cells[0][0]++,a=>a.continuation[2].witness.push('L'),a=>a.witness=['HD'],a=>a.target={...a.target,x:a.target.x+1},a=>a.continuation[2].witness=Array(257).fill('L'),a=>a.continuation=[null]]){const a=clone(f.advice);edit(a);assert.deepEqual(P.selectedRepairs(f.observation,a,{checked:true}),[]);}
 const current=R.replay(f.observation,f.advice.continuation[0].witness).state;
 assert.deepEqual(P.selectedRepairs(current,{...f.advice,target:f.advice.continuation[1].event.target,witness:f.advice.continuation[1].witness,continuation:f.advice.continuation.slice(1)},{checked:true}),[repair]);
});
