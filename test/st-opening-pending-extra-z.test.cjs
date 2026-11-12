'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),C=require('../st-obligation-context'),Provider=require('../st-resource-provider');
const player=require('./support/current-player.cjs'),fixture=require('./fixtures/opening-pending-extra-z.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const options={openingPhase:true,obligationContext:fixture.obligationContext,width:8,depth:3,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
function start(){return player(fixture.position,{snapshot:fixture.obligationContext});}
function oldPath(){const a=start();return fixture.witnesses.map(witness=>{a.lock(witness);return{witness,event:copy(a.position.lastEvent)};});}
test('opening pending extra Z: saved recommendation spends before baseline and cannot recover it later',()=>{
 const a=start(),before=C.resolve(a.context,{position:a.position});
 assert.equal(before.extraZ.remaining,null);assert.equal(before.qualityPending,true);assert.equal(before.hangingL.status,'hanging');
 a.lock(fixture.witnesses[0]);assert.equal(a.context.status,'available');assert.equal(a.state.account.z.uncredited,'one');assert.equal(a.state.account.opening,null);
 for(const w of fixture.witnesses.slice(1))a.lock(w);
 assert.equal(C.resolve(a.context,{position:a.position}).hangingL.status,'none-observed');assert.equal(a.state.account.z.remaining,null);
 const checked=Provider.checkOpeningZPrefix(Provider.prepare(fixture.position,options),oldPath(),options);
 assert.equal(checked.valid,false);assert.equal(checked.reason,'opening-extra-Z-before-baseline');
});
test('opening pending extra Z: actual planner resolves held L before spending and leaves root untouched',()=>{
 const initial=JSON.stringify(fixture),result=P.decide(fixture.position,options);
 assert.ok(result.target);assert.equal(result.target.type,'L');assert.ok(result.metrics.nodes<=45000);assert.ok(result.metrics.openingAllocation.zRejected>0);
 const a=start();let paid=false;
 for(const step of result.continuation){
  if(step.event.type==='Z'&&step.event.cells.every(([x])=>x<7)){assert.equal(a.state.account.z.remaining,1);paid=true;}
  a.lock(step.witness);assert.equal(a.context.status,'available');assert.deepEqual(a.position.lastEvent,step.event);
 }
 assert.equal(paid,true);assert.equal(a.state.account.z.remaining,0);assert.equal(C.resolve(a.context,{position:a.position}).extraZ.status,'used');assert.equal(JSON.stringify(fixture),initial);
});
test('opening pending extra Z: mandatory Z still allowed, unknown origin unchanged, and work remains bounded',()=>{
 const path=oldPath(),raw=copy(fixture.obligationContext);raw.state.account.mandatoryZ=true;
 const mandatory=Provider.prepare(fixture.position,{obligationContext:raw});assert.equal(mandatory.status,'available');
 assert.equal(Provider.checkOpeningZPrefix(mandatory,path,options).valid,true);
 const unknown=Provider.prepare(fixture.position);assert.equal(Provider.checkOpeningZPrefix(unknown,path,options).valid,true);
 const advice=P.decide(fixture.position,options),input=Provider.prepare(fixture.position,options);
 const limited=Provider.checkOpeningZPrefix(input,advice.continuation,{maxNodes:0,now:()=>0,deadline:Infinity});assert.equal(limited.valid,false);assert.equal(limited.reason,'opening-Z-check-budget');assert.equal(limited.visited,0);
 const deadline=Provider.checkOpeningZPrefix(input,advice.continuation,{now:()=>1,deadline:1});assert.equal(deadline.valid,false);assert.equal(deadline.visited,0);
});
