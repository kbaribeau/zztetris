'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),S=require('../st-structure'),R=require('../st-rules');
const f=require('./support/st-center-stage.json');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
// The old fixture has no visible L for the S preparation. Preserve its shape
// and witness accounting, but use an explicit alternate public queue for the
// positive retention control. The finishing L is immediately active after S;
// its actual witness is verified below, not merely its queue membership.
// No new bag/resource history is inferred.
function timelyControl(){
 const origin={...clone(f.origin),queue:['S','L','Z','O','T','J']};delete origin.bag;
 const r=R.replay(origin,f.advice.witness);assert.ok(r.valid);
 const after={...r.state,queue:[...r.state.queue,'O']};
 return{origin,after,advice:clone(f.advice),event:r.events[0]};
}
function suffix(){const c=timelyControl();return P.continueCommitment(c.origin,c.after,c.advice,c.event);}
test('center foundation distinguishes a supported top from its unfinished lower region',()=>{
 const a=S.geometry(f.after.board).center,b=S.geometry(f.distorted.board).center;
 assert.equal(a.foundation.status,'aligned');assert.equal(b.patternSupport,'reference-supported');
 assert.equal(b.foundation.status,'unfinished-lower-foundation');assert.deepEqual(b.foundation.vacancies,[[4,29]]);
 assert.equal(P.centerContinuityStep(a,b,{lines:0}),true);
 assert.equal(S.centerFoundation(f.distorted.board,{status:'unanchored'}).status,'unknown-phase');
 const recolored=f.distorted.board.map(r=>r.replace(/[^.]/g,'X'));assert.deepEqual(S.centerFoundation(recolored),b.foundation);
});
test('checked finite center preparation with a timely visible partner survives replanning and retires after actual placement',()=>{
 const c=timelyControl(),saved=suffix();assert.ok(saved);assert.equal(saved.metrics.certifiedHorizon,saved.continuation.length);assert.equal(P.cycleResources(saved.continuation).centerPreparations,1);
 const advice=P.plan(c.after,{maxNodes:45000,commitment:{observation:c.after,advice:saved}});
 assert.deepEqual(advice.target,{type:'S',x:4,y:27,rotation:0});
 // The strict-D gate can remove the formerly preferred waiting challenger.
 // The flag means a veto fired, not that every retained Center goal needs one.
 // Keep the actual same-goal/no-replacement and literal L completion oracles.
 const compared=advice.metrics.commitmentComparison;
 if(compared.rankingPreferred)assert.equal(compared.pendingLCompletionPreserved,true,'A preferred waiting replacement may not consume the protected visible L');
 else assert.equal(compared.pendingLCompletionPreserved,false,'No waiting-replacement veto is claimed when the incumbent already wins');
 assert.equal(advice.metrics.commitmentComparison.replacement,false);
 const r=R.replay(P.observe(c.after),advice.witness);assert.ok(r.valid);assert.equal(S.geometry(r.state.board).center.foundation.status,'aligned');
 const completion=advice.continuation[0].structuralEvidence.pairProgress.completion;
 assert.equal(r.state.active.type,'L');
 const finish=R.replay(r.state,['R','R180','HD']);assert.ok(finish.valid);assert.equal(finish.events[0].type,'L');
 assert.deepEqual(finish.events[0].cells,completion.cells,'Actual active-L finishing witness fills exactly the reserved cells');
 assert.equal(S.geometry(finish.state.board).center.status,'level');
 assert.equal(P.continueCommitment(c.after,r.state,saved,r.events[0]),null);
 // A failed manual lock cannot preserve the preparation authority.
 const wrong=R.replay(P.observe(f.origin),['HD']);assert.equal(P.continueCommitment(f.origin,wrong.state,f.advice,wrong.events[0]),null);
});
test('completed pair presentation metadata is not mistaken for a preparation promise',()=>{
 const a=suffix(),steps=clone(a.continuation);steps[0].structuralEvidence.pairProgress={step:2,status:'completed',orderedPieces:['S','L']};
 assert.doesNotThrow(()=>P.cycleResources(steps));assert.equal(P.cycleResources(steps).centerPreparations,0);
 assert.equal(P.resourceGoal(steps),false);
});
test('real page retains timely center preparation, then Undo restores it and imports discard it',()=>withPage('st-lab.html',{},g=>{
 const c=timelyControl(),workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(a){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:a}});}};
 g.element('#st-snapshot').value=JSON.stringify(c.origin);g.click('#st-import');g.advance(40);
 const req=workers.at(-1).message,advice=clone(c.advice);advice.revision=req.observation.revision;
 workers.at(-1).respond(advice);for(const a of advice.witness)g.window.stLab.act(a);g.advance(40);
 const next=workers.at(-1).message;assert.ok(next.commitment);assert.equal(g.window.STPlanner.cycleResources(next.commitment.advice.continuation).centerPreparations,1);
 const stage=next.commitment.advice;workers.at(-1).respond(stage);for(const a of stage.witness)g.window.stLab.act(a);g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
 g.window.stLab.act('UNDO');g.advance(40);assert.ok(workers.at(-1).message.commitment);
 g.element('#st-snapshot').value=JSON.stringify(f.after);g.click('#st-import');g.advance(40);assert.equal(workers.at(-1).message.commitment,null);
}));

test('preparation resource identity includes actual stage and partner cells through row maps',()=>{
 const goal=suffix().continuation;assert.equal(P.resourceGoalPrefix(goal,goal),1);
 const changed=clone(goal);changed[0].event.cells[0][0]--;assert.equal(P.resourceGoalPrefix(changed,goal),null);
 const partner=clone(goal);partner[0].structuralEvidence.pairProgress.completion.cells[0][0]--;assert.equal(P.resourceGoalPrefix(partner,goal),null);
 // Accounting-only control, not a claimed playable route: a canonical clear
 // shifts both actual stage and partner cell identities by exactly two rows.
 const moved=clone(goal);for(const cells of [moved[0].event.cells,moved[0].structuralEvidence.pairProgress.completion.cells])for(const c of cells)c[1]+=2;
 const clear={event:{type:'T',spin:'full',lines:2,clearedRows:[36,37],cells:[[6,36],[7,36],[8,36],[7,37]]}};
 assert.equal(P.resourceGoalPrefix([clear,...moved],goal),2);
});

test('center preparation with no accessible finishing L is not retained as a supported commitment',()=>{
 const replay=R.replay(f.origin,f.advice.continuation.flatMap(p=>p.witness));assert.ok(replay.valid,'Historical placements remain legal, not safe planning authority');
 assert.equal(S.geometry(replay.state.board).center.foundation.status,'aligned');
 assert.equal(P.continueCommitment(f.origin,f.after,f.advice,f.event),null,'A reusable-looking endpoint cannot promise an absent partner');
 const advice=P.plan(f.after,{maxNodes:45000,commitment:{observation:f.after,advice:{...clone(f.advice),continuation:f.advice.continuation.slice(1)}}});
 assert.notDeepEqual(advice.target,{type:'S',x:4,y:27,rotation:0},'Uncertified historical S target is not resurrected');
});

test('Center goal veto / isolated historical challenger cannot spend the visible L and recreate a waiting goal',()=>{
 const load=require('./support/st-center-goal-d-isolated.cjs'),c=timelyControl();
 const run=api=>{const saved=api.continueCommitment(c.origin,c.after,c.advice,c.event);assert.ok(saved);return api.plan(c.after,{maxNodes:45000,now:()=>0,deadline:Infinity,commitment:{observation:c.after,advice:saved}});};
 const kept=run(load());assert.equal(kept.metrics.commitmentComparison.pendingLCompletionPreserved,true);assert.equal(kept.metrics.commitmentComparison.replacement,false);assert.deepEqual(kept.target,{type:'S',x:4,y:27,rotation:0});
 const mutant=run(load({disablePreservation:true}));assert.equal(mutant.metrics.commitmentComparison.pendingLCompletionPreserved,false);assert.equal(mutant.metrics.commitmentComparison.replacement,true,'Disabling the real preservation guard must expose the bad waiting replacement');
});
