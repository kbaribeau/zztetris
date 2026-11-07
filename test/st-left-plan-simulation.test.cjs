'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../scripts/lib/st-simulation.cjs'),B=require('../st-bag'),f=require('./fixtures/current-left-goal.json');
const clone=x=>JSON.parse(JSON.stringify(x));
test('Left plan simulator / accepted current work is counted once, survives replanning and is recovered from each finite lock',()=>{
 let knowledge=clone(f.observation.bag);const future=[];for(let i=0;i<12;i++){const mask=knowledge.remaining[0]||127,type=[...'IJLOSTZ'].find((_,j)=>mask&1<<j);future.push(type);knowledge=B.consume(knowledge,type);}
 const session=E.createSession({scenario:'stable',initial:clone(f.observation),future}),events=[],effects=[];session.onTrackingEvent(e=>events.push(e));session.onObligationEffect(e=>effects.push(...e.effects));
 for(let i=0;i<3;i++){
  const steps=clone(f.advice.continuation.slice(i)),first=steps[0],advice={target:first.event.target,witness:first.witness,hold:first.witness.includes('HOLD'),holdCount:first.witness.filter(a=>a==='HOLD').length,continuation:steps,recommendation:{kind:'supported',hazards:[]},evidence:{}};
  const request=session.request(i+1,E.CONFIG),actual=session.execute(advice),after=E.publicObservation(session.state);assert.equal(session.resources.leftGoals.length,i===2?0:1);
  const recovered=E.recoverTrackingStatus({kind:'lock',lock:i+1,request,advice,event:actual.event,actions:actual.actions,after});assert.deepEqual(recovered.obligations.leftGoals,session.resources.leftGoals);
 }
 assert.equal(effects.filter(e=>e.domain==='left'&&e.kind==='created').length,1);assert.equal(effects.filter(e=>e.domain==='left'&&e.kind==='fulfilled').length,1);assert.deepEqual(events,[]);
});
