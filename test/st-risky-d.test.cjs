'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),L=require('../st-left-context'),RH=require('../st-resource-history'),M=require('../st-midgame-resources'),Session=require('../st-session'),harness=require('./support/st-risk-harness.cjs'),fixture=require('./fixtures/risky-d-j17.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const placement=(s,w)=>{const r=R.replay(s,w);assert.ok(r.valid);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0],target:r.events[0].target,witness:w};};
const stopped={status:'no-supported-continuation-found',target:null,witness:[],continuation:[],reason:'No supported continuation certified.',metrics:{nodes:100}};
const bounded={now:()=>0,deadline:Infinity,maxNodes:45000,openingPhase:false};
function origin(){const s=Session.prepare(fixture.session);return{...s,resource:M.start(s.state,RH.resolve(s.state,s.resourceHistory))};}
function options(s){return{...bounded,resourceContext:RH.exportContext(s.state,s.resourceHistory),patternHistory:s.patternHistory};}
const dHazard=a=>a.recommendation.hazards.find(h=>h.code==='D-J-exit-unresolved');
test('risky D / actual R1 J17 is a legal risk candidate without borrowing later J25',()=>{
 const s=origin(),p=placement(s.state,fixture.witness);assert.equal(s.state.active.type,'S');assert.equal(s.state.hold,'J');assert.deepEqual(s.state.queue,['T','I','L','Z','S','Z']);assert.equal(L.createsD(s.state.board,p.state.board),true);assert.equal(p.state.active.type,'T');assert.equal(p.state.hold,'S');assert.deepEqual(p.state.queue,['I','L','Z','S','Z']);
 assert.equal(P.dPatternAdmission(s.state,p,{...options(s),resource:s.resource}).valid,false,'Supported admission stays strict');
 const a=harness().riskyFallback(s.state,clone(stopped),options(s),{placements:[p],complete:true});assert.ok(a.target);assert.equal(a.recommendation.kind,'risky');assert.equal(dHazard(a).availability,'absent-from-public-supply');assert.match(a.reason,/arrival is unknown/);assert.match(a.reason,/parking intervening pieces/);assert.equal(a.evidence.resourceObligations,undefined);assert.equal(a.metrics.certifiedHorizon,0);assert.equal(P.revalidate(s.state,clone(a),options(s)),null);
 const supported={...stopped,target:{type:'S'},recommendation:{kind:'supported'},metrics:{nodes:100}},preferred=harness().riskyFallback(s.state,supported,options(s),{placements:[p],complete:true});assert.equal(preferred.recommendation.kind,'supported');assert.equal(preferred.metrics.riskFallback.attempted,false,'Risk eligibility does not force selection over a supported alternative');
});
test('risky D / absent, delayed and unfinished immediate exit are distinct public facts',()=>{
 const f=require('./fixtures/st-d-admission.json')[1],make=queue=>R.createState({board:[...Array(20).fill('..........'),...f.board],active:f.active,hold:f.hold,queue}),h=harness();
 for(const [queue,availability,nodes] of [[['S','O','T'],'absent-from-public-supply',45000],[['S','J','T'],'visible-but-delayed',45000],[['J','S','T'],'immediate-exit-proof-unfinished',0]]){
  const s=make(queue),p=placement(s,f.witness),a=h.riskyDAdmission(s,p,M.start(s),{...bounded,maxNodes:nodes});assert.equal(a.valid,true);assert.equal(a.hazards[0].availability,availability);assert.equal(a.hazards[0].proofStatus,nodes?'not-established':'unfinished');
 }
 const s=make(['J','S','O','T','I','S']),p=placement(s,f.witness),a=h.riskyDAdmission(s,p,M.start(s),bounded);assert.equal(a.valid,true);assert.equal(a.hazards.length,0,'Actually usable immediate J needs no D risk warning');assert.equal(P.dPatternAdmission(s,p,bounded).valid,true);
});
test('risky D / a usable-looking J already owed to Center is not a free Left exit',()=>{
 const heights=[6,4,6,6,4,1,2,0,0,0],board=Array.from({length:40},(_,y)=>heights.map(h=>y>=40-h?'X':'.').join('')),s=R.createState({board,active:'J',hold:'O',queue:['J','O']}),p=placement(s,['L','L','L','CW','HD']);
 // Synthetic explicit Center OJ obligation: not a historical-provenance claim.
 const resource=M.start(s,{center:{pending:[{rootId:99,rootBag:null,family:'OJ',alternatives:[{piece:'J',cells:[[5,36],[6,36],[5,37],[5,38]]}]}]}}),a=harness().riskyDAdmission(s,p,resource,bounded);assert.equal(a.valid,true);assert.ok(a.hazards.some(h=>h.code==='D-J-competes-with-Center'));assert.ok(a.hazards.some(h=>h.code==='D-J-exit-unresolved'));assert.equal(P.dPatternAdmission(s,p,{...bounded,resource}).valid,false);
});
test('risky D / observed history remains authentic, and unknown D origin is not invented',()=>{
 const s=origin(),p=placement(s.state,fixture.witness);let state=s.state,history=s.resourceHistory;for(const action of fixture.witness){const next=R.move(state,action);history=RH.applyAction(history,state,action,next);state=next;}
 const real=RH.resolve(state,history);assert.equal(real.dPattern.pending,true);const imported=RH.importContext(state,clone(RH.exportContext(state,history)));assert.deepEqual(RH.resolve(state,imported).dPattern,real.dPattern);
 const unknown=RH.resolve(state,RH.start(state));assert.deepEqual(unknown.dPattern,{pending:false,createdAt:null});assert.equal(L.isD(state.board),true);
 // Continuing actual D is a strategic risk regardless of whether a snapshot
 // knows its creator. Geometry is not permission to fabricate creation history.
 // The exact T continuation comes from the actual public R1 history fixture.
 const q=placement(state,fixture.nextWitness),a=harness().riskyDAdmission(state,q,M.start(state,unknown),bounded);assert.equal(L.isD(q.state.board),true);assert.ok(a.hazards.some(h=>h.code==='D-J-exit-unresolved'));assert.deepEqual(RH.resolve(state,RH.start(state)).dPattern,{pending:false,createdAt:null});
 const forged={...clone(RH.exportContext(state,history)),dPattern:{pending:false}};assert.deepEqual(RH.resolve(state,RH.importContext(state,forged)).dPattern,real.dPattern);
});
test('risky D / spending the immediate J in Center leaves a delayed Left exit risk',()=>{
 const heights=[6,4,6,6,4,1,2,0,0,0],board=Array.from({length:40},(_,y)=>heights.map(h=>y>=40-h?'X':'.').join('')),root=R.createState({board,active:'J',hold:'O',queue:['J','O','J']}),creator=['L','L','L','CW','HD'];
 let state=root,history=RH.start(root);for(const action of creator){const next=R.move(state,action);history=RH.applyAction(history,state,action,next);state=next;}
 assert.equal(RH.resolve(state,history).dPattern.pending,true);assert.equal(state.active.type,'J');const p=placement(state,['CW','R','HD']);assert.equal(L.isD(p.state.board),true);assert.equal(p.state.active.type,'O');assert.deepEqual(p.state.queue,['J']);
 const result=harness().riskyDAdmission(state,p,M.start(state,RH.resolve(state,history)),bounded);assert.equal(result.valid,true);assert.equal(result.hazards.find(h=>h.code==='D-J-exit-unresolved').availability,'visible-but-delayed');
});

test('risky D / real R1 decision and serialized Worker prefer a supported alternative to J17 risk',()=>{
 const s=origin(),opts={...options(s),depth:3,width:8,maxNodes:45000,timeMs:1500},direct=P.decide(s.state,{...opts,now:()=>0,deadline:Infinity});assert.ok(direct.target);assert.equal(direct.recommendation.kind,'supported');assert.deepEqual(direct.target,{type:'S',x:4,y:26,rotation:0});assert.equal(direct.metrics.riskFallback,undefined,'An existing supported choice skips risk fallback');
 const request=JSON.parse(JSON.stringify({type:'plan',id:17,observation:s.state,previous:null,commitment:null,options:opts})),actual=require('../scripts/lib/st-simulation.cjs').workerPlanner()(request);assert.equal(actual.recommendation.kind,'supported');assert.deepEqual(actual.target,direct.target);assert.ok(actual.metrics.nodes<=45000);assert.equal(R.replay(s.state,actual.witness).valid,true);assert.equal(actual.recommendation.hazards.length,0);
});
