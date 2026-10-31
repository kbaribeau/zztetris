'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),P=require('../st-planner'),O=require('../st-opening-sources'),D=require('../st-opening-continuations'),Sim=require('../scripts/lib/st-simulation.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const retainOpening=(state,advice,opts={})=>P.revalidate(state,advice,{openingPhase:true,...opts});
const config={...Sim.CONFIG,timeMs:undefined};
// Discover each seed's opening once, but replay it into a fresh session per caller.
// Live replay rebuilds observation authority; never clone/cache a mutable session
// or deserialize trusted history. Later advice and refills remain independent.
const firstBagCheckpoints=new Map();
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function firstBag(seed){
 const session=Sim.createSession(Sim.makeInput('empty',seed,150)),cached=firstBagCheckpoints.get(seed),plans=[];
 for(let i=1;i<=7;i++){
  const q=cached?null:session.request(i,config),a=cached?clone(cached.plans[i-1]):P.decide(q.observation,q.options);
  assert.ok(a.evidence?.opening?.sourcePlan,'first-bag source lock '+i);session.execute(a);
  if(!cached)plans.push(clone(a));
 }
 if(cached)assert.deepEqual(session.request(8,config),cached.request,'replayed checkpoint preserves public state and live history');
 else firstBagCheckpoints.set(seed,freeze({plans,request:session.request(8,config)}));
 return session;
}
function advice(session){const q=session.request(8,config);return P.decide(q.observation,q.options);}
function sourceOnly(state,source){return P.plan(state,{...config,openingPhase:true,openingSource:source,maxNodes:3000});}
test('second-bag source: exact base colors and whole added pieces define separate conditional goals',()=>{
 assert.equal(D.patterns.length,4);
 for(const p of D.patterns){assert.ok(['buri-01','buri-02'].includes(p.basePattern));assert.equal(p.stage,'second-bag');assert.equal(O.compatible(p.baseBoard,p.id)[0].mask,0);assert.equal(O.compatible(O.pattern(p.id).board,p.id)[0].mask,127);
  const broken=p.baseBoard.slice();broken[39]='..........';assert.deepEqual(O.compatible(broken,p.id),[]);
  const partial=p.baseBoard.slice(),[x,y]=p.targets.T[0];partial[y]=partial[y].slice(0,x)+'T'+partial[y].slice(x+1);assert.deepEqual(O.compatible(partial,p.id),[]);
  assert.equal(Object.isFrozen(p.edges[0]),true);assert.equal(O.pattern(p.id).variant,p.variant);
 }
 assert.equal(O.compatible(D.patterns[0].baseBoard).length>0,true,'default compatibility remains first-bag only');
});
test('second-bag source: actual seventh lock qualifies history, imported matching footprint does not',()=>{
 const s=firstBag(2026103510),peer=firstBag(2026103510),source=s.opening.source;
 assert.notEqual(peer.state,s.state);assert.notEqual(peer.state.board,s.state.board);assert.notEqual(peer.state.queue,s.state.queue);
 peer.state.board[0]='I.........';peer.state.queue[0]='T';
 assert.equal(s.state.board[0],'..........');assert.deepEqual(firstBag(2026103510).request(8,config),s.request(8,config),'caller mutation cannot poison another session or the cached checkpoint');assert.ok(source);assert.equal(source.history.steps.length,7);assert.ok(['buri-01','buri-02'].includes(source.continuationFrom));assert.equal(source.pattern,null);assert.equal(s.opening.active,true);
 assert.equal(P.startOpeningSession(s.state,{emptyMode:true}).source,null);
 for(const bad of [null,{pattern:null,continuationFrom:source.continuationFrom},{pattern:D.patterns.find(p=>p.basePattern===source.continuationFrom).id}])assert.equal(sourceOnly(s.state,bad).evidence?.opening?.sourcePlan,undefined);
 const disconnected=clone(s.state);disconnected.hold=disconnected.hold==='T'?'I':'T';assert.equal(sourceOnly(disconnected,source).evidence?.opening?.sourcePlan,undefined);
 const forged=clone(source);forged.history.steps[0].witness=['HD'];assert.equal(sourceOnly(s.state,forged).evidence?.opening?.sourcePlan,undefined);
 const broken=clone(source);broken.history.steps[3].after.revision++;assert.equal(sourceOnly(s.state,broken).evidence?.opening?.sourcePlan,undefined);
 const oversized=clone(source);oversized.history.steps[0].after.queue.push('I');assert.equal(sourceOnly(s.state,oversized).evidence?.opening?.sourcePlan,undefined);
 const missing=clone(source);missing.history.steps.pop();assert.equal(sourceOnly(s.state,missing).evidence?.opening?.sourcePlan,undefined);
});
test('second-bag source: derived visible prefixes exclude the terminal refill action and keep all guards',()=>{
 for(const seed of [2026103510,2026104519]){
  const s=firstBag(seed),a=advice(s);assert.equal(a.evidence?.opening?.sourcePlan?.stage,'second-bag',String(seed));assert.equal(a.evidence.opening.sourcePlan.variant,'derived-OJ-SL');assert.equal(a.continuation.length,6);assert.match(a.reason,/derived/);assert.match(a.reason,/second T to Left/);
  let state=s.state;for(const step of a.continuation){const r=R.replay(state,step.witness);assert.equal(r.events.length,1);assert.ok(r.state.active);assert.deepEqual(r.events[0],step.event);state=r.state;}
  assert.equal(P.checkAccessPrefix(s.state,a.continuation,{maxNodes:45000}).reachable,true);assert.equal(a.phase,'opening');assert.equal(a.evidence.opening.handoffCandidate,null);
  const forged=clone(a);delete forged.evidence.opening.sourcePlan.history;assert.equal(retainOpening(s.state,forged,{maxNodes:45000}),null);
  const alternate=clone(s.state);alternate.future=['I','I'];alternate.hiddenQueue=['Z'];const q=s.request(8,config);const hidden=P.decide(alternate,q.options);assert.deepEqual(hidden.target,a.target,'private fields cannot change source selection');assert.deepEqual(hidden.witness,a.witness);assert.deepEqual(hidden.evidence.opening.sourcePlan,a.evidence.opening.sourcePlan);
 }
});
test('second-bag source: unavailable literal and guarded negative roots fall back without bypass',()=>{
 for(const seed of [2026103510,2026104519,2026105528,2026107546]){
  const s=firstBag(seed),source=s.opening.source,literal=D.patterns.find(p=>p.basePattern===source.continuationFrom&&p.variant==='literal-SL-OJ');assert.equal(O.solve(s.state,{preferredId:literal.id}).candidate,null);
  if([2026105528,2026107546].includes(seed))assert.equal(advice(s).evidence?.opening?.sourcePlan,undefined);
 }
});
test('second-bag source: actual refills retain witnessed inputs and complete without automatic handoff',()=>{
 for(const seed of [2026103510,2026104519]){
  const s=firstBag(seed);let id;
  for(let lock=8;lock<=14;lock++){
   const q=s.request(lock,config),a=P.decide(q.observation,q.options);assert.equal(a.evidence?.opening?.sourcePlan?.stage,'second-bag',seed+' lock '+lock);id??=a.evidence.opening.sourcePlan.id;assert.equal(a.evidence.opening.sourcePlan.id,id);
   const actual=s.execute(a);assert.ok(actual.actions.filter(x=>x.action!=='HD').every(x=>x.adviceAdvanced),'real HOLD/draw prefix retains checked advice');
  }
  assert.equal(O.compatible(s.state.board,id)[0].mask,127);assert.equal(s.opening.source.continuationSteps.length,7);assert.deepEqual(s.opening.source.scoringSteps,[]);assert.equal(s.opening.active,true);assert.equal(s.opening.clear,null);
 }
});
test('second-bag source: history and source authority revalidate a copied public snapshot but not reset/import',()=>{
 const s=firstBag(2026103510),q=s.request(8,config),a=P.decide(q.observation,q.options),snapshot=clone({state:q.observation,options:q.options});
 s.execute(a);const restored=P.decide(snapshot.state,snapshot.options);assert.deepEqual(restored.target,a.target);assert.deepEqual(restored.witness,a.witness);assert.equal(restored.evidence.opening.sourcePlan.id,a.evidence.opening.sourcePlan.id);
 const reset=P.startOpeningSession(snapshot.state,{emptyMode:true});assert.equal(reset.source,null);assert.equal(sourceOnly(snapshot.state,reset.source).evidence?.opening?.sourcePlan,undefined);
 assert.equal(retainOpening(snapshot.state,a,{maxNodes:45000}),null,'stale proof without live session authority fails closed');
 const liveSource={...clone(snapshot.options.openingSource),pattern:a.evidence.opening.sourcePlan.id};assert.ok(retainOpening(snapshot.state,a,{maxNodes:45000,openingSource:liveSource}));
 const wrong=clone(a);wrong.evidence.opening.sourcePlan.history.steps[2].after.bag.remaining=[];assert.equal(retainOpening(snapshot.state,wrong,{maxNodes:45000}),null);
 const source=clone(snapshot.options.openingSource);source.continuationFrom='buri-03';assert.equal(sourceOnly(snapshot.state,source).evidence?.opening?.sourcePlan,undefined);
 const tracker={nodes:0},late=clone(a);late.evidence.opening.sourcePlan.history.steps[6].event.type='I';const live={...clone(snapshot.options.openingSource),pattern:late.evidence.opening.sourcePlan.id,history:clone(late.evidence.opening.sourcePlan.history)};assert.equal(retainOpening(snapshot.state,late,{maxNodes:45000,budgetTracker:tracker,openingSource:live}),null);assert.ok(tracker.nodes>0);
});
test('second-bag source: every bag-compatible first actual refill is revalidated without hidden discovery',()=>{
 const start=firstBag(2026103510);let checked=0;
 for(const type of 'IJLOSTZ'){
  const bag=B.consume(start.state.bag,type);if(B.validate(bag).length||!bag.remaining.length)continue;
  let state=R.createState(start.state),session=start.opening,history=P.startPatternHistory(state),injected=false,id;
  for(let lock=0;lock<7;lock++){
   const a=P.plan(state,{...config,openingPhase:true,openingSource:session.source,patternHistory:history});assert.equal(a.evidence?.opening?.sourcePlan?.stage,'second-bag',type+' lock '+lock);id??=a.evidence.opening.sourcePlan.id;
   session=P.acceptOpeningResult(session,a);let displayed=a;
   for(const action of a.witness){const before=state;state=R.move(state,action);if(!injected&&state.queue.length<6){state={...state,queue:state.queue.concat(type),bag:B.consume(state.bag,type)};injected=true;}
    if(action==='HD'){history=P.updatePatternHistory(history,before,state,state.lastEvent);session=P.updateOpeningSession(session,before,state,state.lastEvent);}
    else{displayed=P.advance(state,displayed,action,{openingPhase:session.active,openingSource:session.source,patternHistory:history,maxNodes:45000});assert.ok(displayed,type+' '+action);}
   }
  }
  assert.equal(O.compatible(state.board,id)[0].mask,127);assert.equal(session.source.continuationSteps.length,7);assert.deepEqual(session.source.scoringSteps,[]);assert.equal(session.active,true);checked++;
 }
 assert.equal(checked,6);
});
