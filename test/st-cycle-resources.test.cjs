'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure');
const cases=require('./support/st-cycle-resources.json');
const config={depth:3,width:8,maxNodes:45000,timeMs:750,now:()=>0};
function follow(s,a){const r=R.replay(s,a.witness);assert.ok(r.valid);assert.equal(r.events.length,1);return r.state;}
test('cycle resources reserve the held I through the visible T double until Pocket opens',()=>{
 const s=P.observe(cases.holdI.snapshot),a=P.plan(s,config);assert.ok(a.target,a.reason);
 assert.equal(a.continuation[0].event.type,'L');assert.equal(a.hold,true);
 assert.deepEqual(a.continuation.map(p=>[p.event.type,p.event.lines]),[['L',0],['T',2],['I',0]]);
 assert.equal(a.evidence.cycleResources.pocket,1);assert.equal(a.evidence.cycleResources.iFillers,0);
 let state=s,advice=a;for(let i=0;i<2;i++){const next=follow(state,advice),suffix=P.continueCommitment(state,next,advice);assert.ok(suffix);
  const fresh=P.plan(next,{...config,commitment:{observation:next,advice:suffix}});assert.ok(fresh.target);assert.equal(fresh.continuation[0].event.type,i===0?'T':'I');state=next;advice=fresh;}
 const end=follow(state,advice);assert.equal(P.continueCommitment(state,end,advice),null);
});
test('an older saved-T proof cannot retain a move that strands a center cell',()=>{
 const A=require('../st-access'),s=P.observe(cases.savedT.snapshot),a=cases.savedT.advice,next=follow(s,a);
 assert.equal(P.continueCommitment(s,next,a),null);
 const old=R.replay(next,a.continuation[1].witness),proof=A.check(next,{state:old.state,event:old.events[0]});
 assert.equal(proof.reachable,false);assert.ok(proof.unreachable.some(([x,y])=>x===4&&y===26));
 const fresh=P.plan(next,config);if(fresh.target){const r=R.replay(next,fresh.witness);assert.equal(A.check(next,{state:r.state,event:r.events[0]}).reachable,true);}
});
test('commitments are replayed, not trusted goal metadata or arbitrary imported history',()=>{
 const s=P.observe(cases.holdI.snapshot),a=P.plan(s,{depth:3,width:8,maxNodes:45000}),next=follow(s,a);assert.ok(P.continueCommitment(s,next,a));
 const fake=JSON.parse(JSON.stringify(a));fake.continuation[1].witness=['HD'];assert.equal(P.continueCommitment(s,next,fake),null);
 const changed={...next,hold:next.hold==='I'?'O':'I'};assert.equal(P.continueCommitment(s,changed,a),null);
 const noGoal={...a,continuation:a.continuation.slice(0,1)};assert.equal(P.continueCommitment(s,next,noGoal),null);
 const observed=P.observe({...s,cycleResources:{tsds:999},commitment:fake});assert.equal(observed.cycleResources,undefined);assert.equal(observed.commitment,undefined);
});
test('resource accounting reports material and allows nonclearing Reset Ts without a quota',()=>{
 const events=[{type:'T',lines:0,cells:[[0,30]]},{type:'T',lines:0,cells:[[1,29]]},{type:'I',lines:4,cells:[[7,36]]}];
 const r=P.cycleResources(events.map(event=>({event})));assert.equal(r.tFillers,2);assert.equal(r.quads,1);assert.equal(r.materialDelta,-28);assert.equal(r.locks,3);
});
test('known reference paired-T placements remain an explicit unsupported-policy limitation',()=>{
 const controls=require('./support/st-reference-reset-limitations.json');assert.equal(controls.length,4);
 for(const c of controls){const s=R.createState({board:c.before,active:'T'}),r=R.replay(s,c.witness);assert.ok(r.valid,`${c.source} ${c.page}`);assert.deepEqual(r.state.board,c.after);
  const transition=S.transition(s,{state:r.state,event:r.events[0]});assert.ok(transition.cycleViolations.includes('spent-scoring-T-without-double'));
  assert.ok(r.events[0].cells.every(([x])=>x<4));assert.equal(r.events[0].lines,0);
 }
});

test('quad consumes a prior Pocket preparation rather than counting two outstanding goals',()=>{
 const prepared={event:{type:'I',lines:0,cells:[[9,36]]},structuralEvidence:{allocation:'quad-preparation'}},quad={event:{type:'I',lines:4,cells:[[7,36]]}};
 assert.equal(P.cycleResources([prepared]).outstandingPocket,1);
 const completed=P.cycleResources([prepared,quad]);assert.equal(completed.pocket,1);assert.equal(completed.quads,1);assert.equal(completed.outstandingPocket,0);
 assert.equal(P.cycleResources([quad,prepared]).outstandingPocket,1);
});

test('goal comparison trims post-goal filler and only reserves relevant resource roles',()=>{
 const t={event:{type:'T',spin:'full',lines:2,cells:[[7,35]]}},i={event:{type:'I',lines:0,cells:[[0,30]]}},f={event:{type:'L',lines:0,cells:[[0,31]]}};
 const q={event:{type:'I',lines:4,cells:[[7,36]]}},p={event:{type:'I',lines:0,cells:[[9,36]]},structuralEvidence:{allocation:'quad-preparation'}};
 const wasteT={event:{type:'T',lines:0,cells:[[0,30]]}};
 assert.equal(P.resourceGoalPrefix([f,q,f],[f,q]),2);
 assert.equal(P.resourceGoalPrefix([i,t,f],[t]),2,'an unrelated I repair does not spend a T reservation');
 assert.equal(P.resourceGoalPrefix([wasteT,t],[t]),null,'do not waste the reserved T and substitute a later T');
 assert.equal(P.resourceGoalPrefix([i,p],[p]),null,'do not waste the reserved I and substitute a later I');
 assert.equal(P.resourceGoalPrefix([i,t,p],[t,p]),null,'mixed goals retain both resource protections');
 assert.equal(P.resourceGoalPrefix([q,f],[p,q]),1,'a completed quad consumes the preparation obligation');
 assert.equal(P.resourceGoalPrefix([wasteT,t],[t,wasteT]),null,'post-goal T waste cannot fund an earlier substitution');
 assert.equal(P.resourceGoalPrefix([i,q],[q,i]),null,'post-goal I waste cannot fund an earlier substitution');
});

function comparisonControl(original){
 if(original.name!=='quad goal before trailing filler')return original;
 // Explicit public-supply control: finishing O is active after the quad,
 // rather than blocked behind S,T while Z occupies HOLD.
 const c=JSON.parse(JSON.stringify(original));c.before.queue=['Z','I','O','S','T','J'];c.snapshot.queue=['I','O','S','T','J','L'];delete c.before.bag;delete c.snapshot.bag;return c;
}
for(const original of require('./support/st-commitment-comparison.json')){const c=comparisonControl(original);test('same-horizon commitment replacement: '+c.name,()=>{
 const suffix=P.continueCommitment(c.before,c.snapshot,c.previous,c.event);assert.ok(suffix);
 // Fixed node budget removes host-timing noise from this policy regression.
 const a=P.plan(c.snapshot,{...config,now:()=>0,commitment:{observation:c.snapshot,advice:suffix}});
 assert.ok(a.target,a.reason);assert.deepEqual(a.target,c.name==='quad goal before trailing filler'?suffix.target:c.expectedTarget);assert.equal(a.metrics.commitmentComparison.replacement,c.name!=='quad goal before trailing filler');
 assert.equal(a.metrics.commitmentComparison.freshHorizon,a.metrics.commitmentComparison.savedHorizon);
 assert.equal(a.metrics.commitmentComparison.freshSettled,true);assert.equal(a.metrics.commitmentComparison.savedSettled,true);
 assert.ok(P.resourceGoalPrefix(a.continuation,suffix.continuation));
 let s=P.observe(c.snapshot);for(const step of a.continuation){const r=R.replay(s,step.witness);assert.ok(r.valid);assert.ok(S.canonicalClear(r.events[0]));s=r.state;}
});}
test('original quad suffix cannot promise an O hidden behind a T bottleneck',()=>{
 const c=require('./support/st-commitment-comparison.json')[1];assert.equal(P.continueCommitment(c.before,c.snapshot,c.previous,c.event),null);
 const control=comparisonControl(c),suffix=P.continueCommitment(control.before,control.snapshot,control.previous,control.event);assert.ok(suffix);
 let state=control.snapshot;for(const p of suffix.continuation)state=R.replay(state,p.witness).state;
 assert.equal(state.active.type,'O');const completion=S.geometry(state.board).center.completions.find(c=>c.piece==='O'&&c.patternSupport==='reference-supported');assert.ok(completion);
 const finish=R.replay(state,completion.witness);assert.ok(finish.valid);assert.deepEqual(finish.events[0].cells,completion.cells);assert.equal(S.geometry(finish.state.board).center.status,'level');
});
test('interrupted fresh comparison keeps the executable saved resource proof',()=>{
 const c=require('./support/st-commitment-comparison.json')[0],suffix=P.continueCommitment(c.before,c.snapshot,c.previous,c.event);assert.ok(suffix);
 const a=P.plan(c.snapshot,{...config,now:Date.now,timeMs:0,commitment:{observation:c.snapshot,advice:suffix}});
 assert.ok(a.target);assert.deepEqual(a.target,suffix.target);assert.equal(a.evidence.commitmentRetained,true);assert.equal(a.metrics.commitmentComparison.replacement,false);
});
