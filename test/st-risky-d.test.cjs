'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),L=require('../st-left-context'),C=require('../st-obligation-context'),Session=require('../st-session'),harness=require('./support/st-risk-harness.cjs'),fixture=require('./fixtures/risky-d-j17.json');
const clone=x=>JSON.parse(JSON.stringify(x)),bounded={now:()=>0,deadline:Infinity,maxNodes:45000,openingPhase:false};
function origin(){return Session.prepare(fixture.session);}
test('Former D risk / observed creation stays descriptive through current transport',()=>{
 const s=origin();let position=s.state,history=C.importState(fixture.session.coaching.obligationContext,{position});
 for(const action of fixture.witness){const next=R.move(position,action);history=C.applyActual(history,{before:position,action,after:next}).context;position=next;}
 assert(L.isD(position.board));assert.equal(C.resolve(history,{position}).dPattern.pending,true);
 const imported=C.importState(clone(C.exportState(history)),{position});assert.deepEqual(C.resolve(imported,{position}).dPattern,{pending:true});assert.deepEqual(C.resolve(C.start(position),{position}).dPattern,{pending:false});
 assert.throws(()=>C.importState({...C.exportState(history),dPattern:{pending:false}},{position}),/envelope shape/);
});
test('Former D risk / finite supported root decision uses checked replay without a J-specific hazard',()=>{
 const s=origin(),opts={...bounded,obligationContext:s.obligationContext,patternHistory:s.patternHistory,depth:3,width:8},direct=P.decide(s.state,opts);assert(direct.target);assert.equal(direct.recommendation.kind,'supported');assert(R.replay(s.state,direct.continuation.flatMap(p=>p.witness)).valid);assert(direct.metrics.nodes<=45000);assert.equal(direct.recommendation.hazards.some(h=>h.code.startsWith('D-')),false);
 const actual=require('../scripts/lib/st-simulation.cjs').workerPlanner({disableSearchTimeout:true})(clone({type:'plan',id:17,observation:s.state,previous:null,commitment:null,options:{...opts,timeMs:1500}}));assert.equal(actual.recommendation.kind,'supported');assert.deepEqual(actual.target,direct.target);assert(actual.metrics.nodes<=45000);
});
test('Former D risk / supported incumbent never becomes a risk merely because an alternative makes D',()=>{
 const s=origin(),r=R.replay(s.state,fixture.witness);assert(r.valid);assert(L.createsD(s.state.board,r.state.board));const p={state:r.state,event:r.events[0],target:r.events[0].target,witness:fixture.witness},supported={target:{type:'S'},recommendation:{kind:'supported'},metrics:{nodes:100}};
 const out=harness().riskyFallback(s.state,supported,{...bounded,obligationContext:s.obligationContext,patternHistory:s.patternHistory},{placements:[p],complete:true});assert.equal(out.recommendation.kind,'supported');assert.equal(out.metrics.riskFallback.attempted,false);assert.equal(out.metrics.nodes,100);
});
