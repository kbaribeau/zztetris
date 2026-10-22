const test=require('node:test');const assert=require('node:assert/strict');
const R=require('../st-rules.js'),B=require('../st-bag.js'),P=require('../st-planner.js');
const {fixtures}=require('./support/st-fixtures.cjs');
const state=()=>R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']});
const opts={depth:2,width:3,maxNodes:15000};
test('st-planner/observation boundary: hidden generator metadata cannot change deterministic advice',()=>{
 const s=state(),a=P.plan({...s,seed:1,hiddenQueue:['T','I'],generator:{future:['O']}},opts),b=P.plan({...s,seed:99,hiddenQueue:['Z','Z'],generator:{future:['T']}},opts);
 delete a.metrics.elapsedMs;delete b.metrics.elapsedMs;assert.deepEqual(a,b);assert.equal(a.status,'recommended-with-verified-prefix');
 assert.equal('seed' in P.observe({...s,seed:1}),false);assert.equal('hiddenQueue' in P.observe({...s,hiddenQueue:[]}),false);
});
test('st-planner/prefix: every returned lock has a real replay witness and exact event',()=>{
 let s=state();const p=P.plan(s,opts);assert.ok(p.continuation.length>0);
 for(const step of p.continuation){const r=R.replay(s,step.witness);assert.equal(r.valid,true);assert.deepEqual(r.events[0],step.event);s=r.state;}
 assert.ok(p.evidence.verifiedLocks>=1);assert.match(p.evidence.claim,/not a sustainability guarantee/);
});
test('st-planner/no fake certainty: budget, unsupported rules, missing pieces and invalid knowledge',()=>{
 assert.equal(P.plan(state(),{maxNodes:0}).status,'budget-exhausted');
 assert.equal(P.plan({...state(),rules:'gravity-20'}).status,'unsupported-profile');
 assert.equal(P.plan({...state(),active:null}).status,'insufficient-known-pieces');
 assert.equal(P.plan({...state(),bag:{remaining:[]}}).status,'invalid-input');
 assert.equal(P.plan(R.createState({active:'T'})).status,'unsupported-position');
 assert.equal(P.plan({...state(),board:['bad']}).status,'invalid-input');
});
test('st-planner/frontier bag: only forced unseen pieces extend information horizon',()=>{
 const s={...state(),queue:[],bag:B.fromObserved({observed:['I','J','L','O','S','Z'],startPhase:0})};
 const p=P.plan(s,{depth:1,maxNodes:8000});assert.equal(p.evidence.knownPieceHorizon,2);
 const unknown=P.plan({...s,bag:B.fromObserved()},{depth:1,maxNodes:8000});assert.equal(unknown.evidence.knownPieceHorizon,1);
});
test('st-planner/revalidation: same sound target survives pose change, structural change invalidates it',()=>{
 const s=state(),p=P.plan(s,{depth:1,maxNodes:8000});const moved=R.move(s,'R');const kept=P.revalidate(moved,p);
 assert.ok(kept);assert.deepEqual(kept.continuation[0].structuralEvidence,p.continuation[0].structuralEvidence);assert.deepEqual(kept.target,p.target);assert.equal(kept.revision,moved.revision);assert.equal(R.replay(moved,kept.witness).valid,true);
 assert.equal(P.revalidate({...moved,queue:['I']},p),null);
});
test('st-planner/assessment: geometric cavities and heuristic estimates are not executable claims',()=>{
 const a=P.assess(fixtures.cap.afterCap);assert.ok(a.right.slots.length>0);
 assert.ok(a.obligations.every(o=>o.status==='unresolved'));assert.match(a.obligations[0].note,/not yet proved/);
 assert.ok(a.assumptions.length);assert.ok(Number.isFinite(a.estimate));
});
test('st-planner/ST scope: a nonempty generic board is not enough to claim ST support',()=>{
 const board=R.emptyBoard();board[39]='O.........';
 assert.equal(P.plan(R.createState({board,active:'T',queue:['O']})).status,'unsupported-position');
});
test('st-planner/reservoir construction: a sealed right vacancy does not prune a legal cap-to-double',()=>{
 const s=R.createState({board:fixtures.cap.before,active:'T',hold:'Z',queue:['O','I','J','L','S','T']});
 const p=P.plan(s,{depth:2,width:8,maxNodes:45000});assert.equal(p.evidence.tsdAt,2);
 let current=s;for(const step of p.continuation){const r=R.replay(current,step.witness);assert.ok(r.valid);current=r.state;}
 assert.equal(current.lastEvent.spin,'full');assert.equal(current.lastEvent.lines,2);
});
test('st-planner/commitment: following HOLD and movement keeps an executable stable target',()=>{
 let s=R.createState({board:fixtures.cap.before,active:'T',hold:'Z',queue:['O','I','J','L','S','T']});
 let p=P.plan(s,{depth:2,width:8,maxNodes:45000});const target=p.target;
 assert.equal(p.witness[0],'HOLD');
 while(p.witness.length>1){const action=p.witness[0];s=R.move(s,action);p=P.advance(s,p,action);assert.ok(p);assert.deepEqual(p.target,target);}
 assert.equal(p.hold,false);assert.equal(R.replay(s,p.witness).valid,true);
 assert.equal(P.advance(s,p,'R'),null);
});
test('st-planner/bounded iterations: partial deeper work cannot replace a completed root layer',()=>{
 const s=state(),root=P.plan(s,{depth:1,maxNodes:45000});assert.equal(root.metrics.completeDepth,1);
 const p=P.plan(s,{depth:3,width:8,maxNodes:root.metrics.nodes+100});
 assert.equal(p.evidence.budgetExhausted,true);assert.equal(p.metrics.completeDepth,1);assert.equal(p.evidence.verifiedLocks,1);
 const expired=P.plan(s,{deadline:10,now:()=>11});assert.equal(expired.status,'budget-exhausted');
 assert.doesNotMatch(expired.reason,/no move exists|impossible/i);
});
test('st-planner/incomplete rebuild: hypothetical T access is not an eligibility gate',()=>{
 const s=require('../st-fixtures').get('cap-rebuild').observation;
 assert.equal(R.tDoubleAccess(s.board).reachable,false);
 const p=P.plan(s,{depth:2,width:8,maxNodes:45000});assert.ok(p.target);assert.equal(R.replay(s,p.witness).valid,true);
});
test('st-planner/counterfactual entry never invents actual T arrival or a checked TSD',()=>{
 const s=R.createState({board:fixtures.cap.afterCap,active:'O',queue:[],hold:null});
 assert.equal(R.tDoubleAccess(s.board).reachable,true);
 const p=P.plan(s,{depth:2,width:8,maxNodes:45000});assert.ok(p.target);assert.equal(p.evidence.tsdAt,null);
 assert.equal(p.continuation.length,1);assert.equal(p.continuation[0].target.type,'O');
 assert.ok(p.assessment.obligations.every(o=>o.status!=='paid'));
 if(p.evidence.endpointTEntry==='reachable-if-T-available')assert.match(p.reason,/when a T is available/);
});
test('healthy two-row left base remains in maintenance scope after scoring',()=>{
 const heights=[2,2,2,2,6,8,8,0,1,2];
 const board=Array.from({length:40},(_,y)=>heights.map(h=>y>=40-h?'X':'.').join(''));
 const facts=P.assess(board);assert.equal(facts.regionalSupport,true);assert.equal(facts.channel.openBelowStack,true);assert.equal(facts.left.height,2);
 assert.ok(facts.obligations.some(o=>o.kind==='center-partner'&&o.status==='unresolved'&&o.demands.length===0));
});
test('center runaway is penalized even while the coarse channel profile is supported',()=>{
 const board=heights=>Array.from({length:40},(_,y)=>heights.map(h=>y>=40-h?'X':'.').join(''));
 const runaway=P.assess(board([4,4,4,4,19,19,14,0,2,3]));
 const closer=P.assess(board([12,12,12,12,19,19,14,0,2,3]));
 assert.equal(runaway.regionalSupport,true);assert.equal(closer.regionalSupport,true);
 assert.equal(runaway.regionImbalance,11);assert.ok(runaway.estimate<closer.estimate-30);
 const depleted=P.assess(board([1,1,1,1,10,11,1,0,5,4]));
 assert.equal(depleted.regionalSupport,false);assert.equal(depleted.maintenanceScope,true);
});
