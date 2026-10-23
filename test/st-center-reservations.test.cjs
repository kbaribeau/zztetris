'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure');
const snapshot=require('./support/st-user-center-cap.json');
const config={depth:3,width:8,maxNodes:45000};
const key=c=>JSON.stringify(c.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
let cached;const plan=()=>cached??=(P.plan(snapshot,config));
test('center reservation permits L diversion only with its exact visible replacement completion',()=>{
 const a=plan();assert.ok(a.target,a.reason);assert.equal(a.continuation.length,5);
 assert.deepEqual(a.continuation.map(p=>p.event.type),['L','I','Z','T','L']);assert.ok(a.continuation[0].event.cells.every(([x])=>x<4));
 const original=S.geometry(snapshot.board).center.completions.find(c=>c.piece==='L');assert.ok(original);
 let debt=[],s=snapshot,translated=original.cells.map(c=>c.slice());
 for(const [i,step]of a.continuation.entries()){const r=R.replay(s,step.witness);assert.ok(r.valid);assert.ok(S.canonicalClear(r.events[0]));const next=P.centerReservationStep(s,{state:r.state,event:r.events[0]},debt);debt=next.debt;
  if(i<4)assert.ok(debt.length,'uncompleted reservation survives fillers and scoring');else{assert.equal(debt.length,0);assert.equal(key(step.event.cells),key(translated));}
  translated=translated.map(([x,y])=>[x,y+r.events[0].clearedRows.filter(row=>row>y).length]);s=r.state;
 }
 assert.equal(P.cycleResources(a.continuation).centerCompletions,1);
});
test('center-only suffix survives the double and retires only after actual completion',()=>{
 let a=plan(),s=snapshot;
 for(let i=0;i<5;i++){const r=R.replay(s,a.witness);assert.ok(r.valid);const next=P.continueCommitment(s,r.state,a,r.events[0]);s=r.state;
  if(i<4)assert.ok(next);else assert.equal(next,null);
  if(i===3){assert.equal(next.continuation.length,1);assert.equal(next.evidence.cycleResources.tsds,0);assert.equal(next.evidence.cycleResources.centerCompletions,1);assert.equal(next.target.type,'L');}
  a=next;
 }
});
test('replacement goal comparison requires the same completion cells after exact clear translation',()=>{
 const a=plan().continuation,without=a.slice(0,4);assert.equal(P.resourceGoalPrefix(without,a),null);
 const wrong=JSON.parse(JSON.stringify(a));wrong[4].structuralEvidence.centerReservation.completed[0].cells=wrong[4].event.cells.map(([x,y])=>[x,y-1]);
 assert.equal(P.cycleResources(wrong).centerCompletions,1);assert.equal(P.resourceGoalPrefix(wrong,a),null,'counting a different completion does not discharge the original');
 assert.equal(P.resourceGoalPrefix(a,a),5);
});
test('missing replacement supply does not license the original L-left diversion',()=>{
 const s={...snapshot,queue:['T','Z','S','O','I','J']};delete s.bag;
 const a=P.plan(s,config);if(a.target){let current=s,debt=[];for(const step of a.continuation){const r=R.replay(current,step.witness);assert.ok(r.valid);debt=P.centerReservationStep(current,{event:r.events[0],state:r.state},debt).debt;current=r.state;}assert.equal(debt.length,0);assert.notDeepEqual(a.target,plan().target);}else assert.ok(['no-supported-continuation-found','budget-exhausted'].includes(a.status),a.status);
});
test('an unrelated center completion and a clear through target cells do not erase debt',()=>{
 const first=plan().continuation[0],r=R.replay(snapshot,first.witness),debt=P.centerReservationStep(snapshot,{event:r.events[0],state:r.state}).debt;assert.ok(debt.length);
 const unrelated={type:'O',cells:[[4,1],[5,1],[4,2],[5,2]],clearedRows:[39],lines:4};
 const next=P.centerReservationStep(r.state,{event:unrelated,state:r.state},debt).debt;assert.equal(next.length,debt.length);assert.equal(next[0].alternatives[0].cells[0][1],debt[0].alternatives[0].cells[0][1]+1);
 const removed=P.centerReservationStep(r.state,{event:{...unrelated,clearedRows:[27]},state:r.state},debt).debt;assert.ok(removed[0].alternatives[0].cells.some(([,y])=>y===-1));
});
test('a different piece cannot erase an already created concrete reservation',()=>{
 const first=R.replay(snapshot,plan().witness),debt=P.centerReservationStep(snapshot,{event:first.events[0],state:first.state}).debt;assert.ok(debt.length);
 const p=R.placements(first.state).placements.find(p=>p.event.type==='I'&&p.event.cells.some(([x])=>x>=4&&x<=6)&&S.advanceNotches(first.state.board,p).valid);assert.ok(p);
 const check=P.centerReservationStep(first.state,p,debt);assert.ok(check.debt.length);assert.equal(check.completed.length,0);
});
test('page lifecycle keeps the center-only obligation after a real double and fresh worker request',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=JSON.parse(JSON.stringify(message));}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 g.element('#st-snapshot').value=JSON.stringify(snapshot);g.click('#st-import');g.advance(40);
 const a=plan();workers.at(-1).respond(a);
 for(let i=0;i<4;i++)for(const action of a.continuation[i].witness)g.window.stLab.act(action);
 g.advance(40);const request=workers.at(-1).message;assert.ok(request.commitment);assert.equal(request.commitment.advice.continuation.length,1);
 assert.equal(P.cycleResources(request.commitment.advice.continuation).tsds,0);assert.equal(P.cycleResources(request.commitment.advice.continuation).centerCompletions,1);
 const savedObservation=JSON.parse(JSON.stringify(request.observation));
 const refreshed=P.plan(request.observation,{...config,commitment:request.commitment});assert.ok(refreshed.target);assert.deepEqual(refreshed.target,a.continuation[4].target);
 workers.at(-1).respond(refreshed);for(const action of refreshed.witness)g.window.stLab.act(action);g.advance(40);
 assert.equal(workers.at(-1).message.commitment,null);
 g.element('#st-snapshot').value=JSON.stringify(savedObservation);g.click('#st-import');g.advance(40);
 workers.at(-1).respond(request.commitment.advice);
 assert.notDeepEqual(R.replay(savedObservation,['HD']).events[0].target,request.commitment.advice.target);
 g.window.stLab.act('HD');g.advance(40);assert.equal(workers.at(-1).message.commitment,null,'a different actual lock invalidates the center-only promise');
 g.element('#st-snapshot').value=JSON.stringify({...savedObservation,commitment:request.commitment});g.click('#st-import');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
 workers.at(-1).respond(request.commitment.advice);g.click('#st-reset');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));
