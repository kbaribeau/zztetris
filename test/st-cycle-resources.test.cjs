'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure');
const cases=require('./support/st-cycle-resources.json');
const config={depth:3,width:8,maxNodes:45000,timeMs:SEARCH_TIME_MS,now:()=>0};
const continueFixed=(before,after,advice,event=after?.lastEvent)=>P.continueCommitment(before,after,advice,event,{now:()=>0,deadline:Infinity,maxNodes:12000});
function follow(s,a){const r=R.replay(s,a.witness);assert.ok(r.valid);assert.equal(r.events.length,1);return r.state;}
test('cycle resources reserve held I through the double and Pocket, rejecting forged commitments',()=>{
 const s=P.observe(cases.holdI.snapshot),a=P.plan(s,config);assert.ok(a.target,a.reason);
 assert.equal(a.continuation[0].event.type,'L');assert.equal(a.hold,true);
 assert.deepEqual(a.continuation.map(p=>[p.event.type,p.event.lines]),[['L',0],['T',2],['I',0]]);
 assert.equal(a.evidence.cycleResources.pocket,1);assert.equal(a.evidence.cycleResources.iFillers,0);
 // Reuse the checked held-I route for adversarial commitment controls.
 const next=follow(s,a);assert.ok(continueFixed(s,next,a));
 const fake=JSON.parse(JSON.stringify(a));fake.continuation[1].witness=['HD'];assert.equal(continueFixed(s,next,fake),null);
 const changed={...next,hold:next.hold==='I'?'O':'I'};assert.equal(continueFixed(s,changed,a),null);
 const noGoal={...a,continuation:a.continuation.slice(0,1)};assert.equal(continueFixed(s,next,noGoal),null);
 const observed=P.observe({...s,cycleResources:{tsds:999},commitment:fake});assert.equal(observed.cycleResources,undefined);assert.equal(observed.commitment,undefined);
 let state=s,advice=a;for(let i=0;i<2;i++){const next=follow(state,advice),suffix=continueFixed(state,next,advice);assert.ok(suffix);
  const fresh=P.plan(next,{...config,commitment:{observation:next,advice:suffix}});assert.ok(fresh.target);assert.equal(fresh.continuation[0].event.type,i===0?'T':'I');state=next;advice=fresh;}
 const end=follow(state,advice);assert.equal(continueFixed(state,end,advice),null);
});
test('an older saved-T proof cannot retain a move that strands a center cell',()=>{
 const A=require('../st-access'),s=P.observe(cases.savedT.snapshot),a=cases.savedT.advice,next=follow(s,a);
 assert.equal(continueFixed(s,next,a),null);
 const old=R.replay(next,a.continuation[1].witness),proof=A.check(next,{state:old.state,event:old.events[0]});
 assert.equal(proof.reachable,false);assert.ok(proof.unreachable.some(([x,y])=>x===4&&y===26));
 const fresh=P.plan(next,config);if(fresh.target){const r=R.replay(next,fresh.witness);assert.equal(A.check(next,{state:r.state,event:r.events[0]}).reachable,true);}
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
for(const original of require('./support/st-commitment-comparison.json')){const c=comparisonControl(original);
 if(c.name==='incidental I repair before a T goal'){
  test('milestone scope: inherited off-pattern column-seven vacancy is not a required I-recovery admission',()=>{
   const state=R.createState(c.snapshot),phase=S.notchPattern(state.board),i=R.replay(state,['CCW','HD']);
   assert.ok(i.valid);assert.deepEqual(i.events[0].target,c.expectedTarget);
   assert.deepEqual(S.centerFoundation(state.board,phase).vacancies,[[6,28]]);
   const next=S.advanceNotches(state.board,{state:i.state,event:i.events[0]},phase);assert.ok(next.valid);
   assert.deepEqual(S.centerFoundation(i.state.board,next.pattern).vacancies,[[6,28]]);
   assert.equal(S.geometry(i.state.board,{notches:next.pattern}).center.patternSupport,'reference-supported');
   assert.equal(P.ordinaryCenterEligible(state,{state:i.state,event:i.events[0]},phase),false);
   const goal=c.previous.continuation.find(p=>p.event.type==='T'&&p.event.lines===2),t=R.replay(i.state,goal.witness);
   assert.ok(t.valid);assert.equal(t.events[0].spin,'full');assert.equal(t.events[0].lines,2);
   assert.ok(S.advanceNotches(i.state.board,{state:t.state,event:t.events[0]},next.pattern).valid);
  });continue;
 }
 test('same-horizon commitment replacement: '+c.name,()=>{
 const suffix=continueFixed(c.before,c.snapshot,c.previous,c.event);assert.ok(suffix);
 // Fixed node budget removes host-timing noise from this policy regression.
 const a=P.plan(c.snapshot,{...config,now:()=>0,commitment:{observation:c.snapshot,advice:suffix}});
 assert.ok(a.target,a.reason);
 // Neutral effort ranking now keeps this exact saved I route: the historical
 // alternative is no longer preferred. The inverse, real replacement control
 // below still exercises the same-horizon replacement branch.
 assert.deepEqual(a.target,suffix.target);assert.equal(a.metrics.commitmentComparison.replacement,false);
 if(c.name==='equal-length scoring alternatives'){assert.equal(a.metrics.commitmentComparison.rankingPreferred,false);assert.deepEqual(a.continuation.map(p=>p.event),suffix.continuation.map(p=>p.event));}
 assert.equal(a.metrics.commitmentComparison.freshHorizon,a.metrics.commitmentComparison.savedHorizon);
 assert.equal(a.metrics.commitmentComparison.freshSettled,true);assert.equal(a.metrics.commitmentComparison.savedSettled,true);
 assert.ok(P.resourceGoalPrefix(a.continuation,suffix.continuation));
 let s=P.observe(c.snapshot);for(const step of a.continuation){const r=R.replay(s,step.witness);assert.ok(r.valid);assert.deepEqual(r.events,[step.event]);assert.ok(S.canonicalClear(r.events[0]));s=r.state;}
});}
test('same-horizon commitment replacement: a certified alternative can replace a lower-ranked saved scoring route',()=>{
 const c=require('./support/st-commitment-comparison.json')[0],module={exports:{}};
 // Admit the previously reviewed alternate I placement using real rules and
 // proofs. Restrict only root enumeration, not rank, resource or safety checks.
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,Date,performance,require:id=>id==='./st-rules.js'?{...R,placements:(state,options)=>{
  const found=R.placements(state,options);return JSON.stringify(state.board)===JSON.stringify(c.snapshot.board)?{...found,placements:found.placements.filter(p=>JSON.stringify(p.target)===JSON.stringify(c.expectedTarget))}:found;
 }}:require(id.replace('./','../'))});
 const saved=JSON.parse(JSON.stringify(module.exports.plan(c.snapshot,{...config,deadline:Infinity})));
 assert.deepEqual(saved.target,c.expectedTarget);assert.equal(saved.continuation.length,3);assert.ok(P.revalidate(c.snapshot,saved,{...config,deadline:Infinity}));
 const a=P.plan(c.snapshot,{...config,deadline:Infinity,commitment:{observation:c.snapshot,advice:saved}}),m=a.metrics.commitmentComparison;
 assert.ok(a.target,a.reason);assert.notDeepEqual(a.target,saved.target);assert.equal(m.rankingPreferred,true);assert.equal(m.replacement,true);
 assert.equal(m.freshHorizon,m.savedHorizon);assert.equal(m.freshHorizon,3);assert.equal(m.freshSettled,true);assert.equal(m.savedSettled,true);
 assert.ok(P.resourceGoalPrefix(a.continuation,saved.continuation));assert.equal(m.scoringTiming.allowed,true);assert.deepEqual(m.scoringTiming.delayed,[]);
 for(const advice of [saved,a]){let state=P.observe(c.snapshot);for(const step of advice.continuation){const r=R.replay(state,step.witness);assert.ok(r.valid);assert.deepEqual(r.events,[step.event]);assert.ok(S.canonicalClear(r.events[0]));state=r.state;}}
 const schedule=advice=>advice.continuation.flatMap((p,i)=>p.event.spin==='full'&&p.event.lines===2?[i+1]:[]);
 assert.deepEqual(schedule(saved),[3]);assert.deepEqual(schedule(a),schedule(saved));
});
test('original quad suffix cannot promise an O hidden behind a T bottleneck',()=>{
 const c=require('./support/st-commitment-comparison.json')[1];assert.equal(continueFixed(c.before,c.snapshot,c.previous,c.event),null);
 const control=comparisonControl(c),suffix=continueFixed(control.before,control.snapshot,control.previous,control.event);assert.ok(suffix);
 let state=control.snapshot;for(const p of suffix.continuation)state=R.replay(state,p.witness).state;
 assert.equal(state.active.type,'O');const completion=S.geometry(state.board).center.completions.find(c=>c.piece==='O'&&c.patternSupport==='reference-supported');assert.ok(completion);
 const finish=R.replay(state,completion.witness);assert.ok(finish.valid);assert.deepEqual(finish.events[0].cells,completion.cells);assert.equal(S.geometry(finish.state.board).center.status,'level');
});
test('interrupted fresh comparison keeps the executable saved resource proof',()=>{
 const c=require('./support/st-commitment-comparison.json')[0],suffix=continueFixed(c.before,c.snapshot,c.previous,c.event);assert.ok(suffix);
 const a=P.plan(c.snapshot,{...config,now:Date.now,timeMs:0,commitment:{observation:c.snapshot,advice:suffix}});
 assert.ok(a.target);assert.deepEqual(a.target,suffix.target);assert.equal(a.evidence.commitmentRetained,true);assert.equal(a.metrics.commitmentComparison.replacement,false);
});

test('cycle resources production retention returns a checked scoring suffix or exhausts its unchanged deadline',()=>{
 const s=P.observe(cases.holdI.snapshot),a=P.plan(s,config),next=follow(s,a),fixed=continueFixed(s,next,a);assert(fixed);
 const started=Date.now(),timed=P.continueCommitment(s,next,a),elapsed=Date.now()-started;
 if(timed){assert.deepEqual(timed.continuation.map(p=>p.event),fixed.continuation.map(p=>p.event));assert(timed.metrics.revalidationNodes<=12000);assert(P.revalidate(next,timed,{now:()=>0,deadline:Infinity,maxNodes:45000}));}else assert(elapsed>=150,'The semantic positive may be withheld only after its production retention deadline');
});
