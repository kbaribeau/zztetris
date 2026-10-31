'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),H=require('../st-resource-history'),S=require('../st-structure');
const fixture=require('./fixtures/visible-scoring-chain.json'),clone=x=>JSON.parse(JSON.stringify(x));
// This regression is node-bounded so host wall-clock jitter cannot turn an
// existing capability into an exact-selection fixture. A separate retained
// live-budget diagnostic verifies the same default behavior at 1,500 ms/45k.
const bounds={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:1500,openingPhase:false};
const centerL=e=>e.type==='L'&&!e.lines&&e.cells.every(([x])=>x>=4&&x<=6);
function start(){const state=R.createState(clone(fixture.observation));return{state,history:H.start(state),pattern:P.startPatternHistory(state)};}
function execute(q,witness){
 const replay=R.replay(q.state,witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);
 for(const action of witness){const before=q.state;q.state=R.move(before,action);assert.notEqual(q.state,before);q.history=H.applyAction(q.history,before,action,q.state);if(action==='HD')q.pattern=P.updatePatternHistory(q.pattern,before,q.state,q.state.lastEvent);}
 assert.deepEqual(q.state.board,replay.state.board);assert.deepEqual(R.validate(q.state),[]);assert.equal(H.resolve(q.state,q.history).coverage.status,'partial');return q.state.lastEvent;
}
const options=q=>({...bounds,patternHistory:q.pattern,resourceContext:H.exportContext(q.state,q.history)});

test('visible scoring chain: public quad, Center completion and TSD have a literal finite witness without inventing history',()=>{
 const q=start(),summary=H.resolve(q.state,q.history);assert.equal(summary.coverage.status,'partial');assert.equal(summary.extraZ.status,'unknown');assert.equal(summary.hangingS.status,'unknown');
 const events=fixture.reference.witnesses.map(w=>clone(execute(q,w)));
 assert.deepEqual(events.map(e=>e.type),fixture.reference.types);assert.deepEqual(events.map(e=>e.lines),fixture.reference.lines);assert.equal(events.at(-1).spin,'full');assert(events[0].cells.every(([x])=>x===9));assert(centerL(events[4]));assert(events[3].cells.every(([x])=>x>=8),'Z remains Right, not unknown Extra-Z spending');
 assert.deepEqual(q.state.board,fixture.reference.finalBoard);assert.equal(q.state.streamCursor-fixture.observation.streamCursor,6);assert.deepEqual(q.state.queue,[]);assert.equal(q.state.active.type,'L');assert.equal(q.state.hold,'S');
});

test('visible scoring chain: default planner executes quad and timely double, then retains the visible Center completion',()=>{
 const q=start(),events=[];let commitment=null,lastAdvice=null;
 for(let lock=1;lock<=6;lock++){
  const origin=P.observe(q.state),advice=P.decide(origin,{...options(q),commitment});assert(advice.target,'expected a finite public continuation at lock '+lock);assert(advice.metrics.nodes<=45000);assert.equal(advice.evidence.resourceObligations.status,'checked');
  const event=execute(q,advice.witness);assert.deepEqual(event,advice.continuation[0].event);assert(S.canonicalClear(event));events.push(clone(event));
  const suffix=P.continueCommitment(origin,P.observe(q.state),advice,event,{...options(q),maxNodes:12000});commitment=suffix?{observation:P.observe(q.state),advice:suffix}:null;lastAdvice=advice;
 }
 assert.equal(events[0].type,'I');assert.equal(events[0].lines,4);assert(events[0].cells.every(([x])=>x===9));assert(events.some(e=>e.type==='T'&&e.spin==='full'&&e.lines===2),'actual double no later than six placements');assert.equal(events.reduce((n,e)=>n+e.lines,0),6);
 if(!events.some(centerL)){
  assert(commitment,'the not-yet-played Center L must remain an actual goal');assert.equal(commitment.advice.continuation.length,1);assert(centerL(commitment.advice.continuation[0].event));assert(P.resourceGoal(commitment.advice.continuation));
  const expected=commitment.advice.continuation[0].event;assert(P.revalidate(q.state,commitment.advice,options(q)),'same ordinary resource/access contract still validates the suffix');assert.deepEqual(execute(q,commitment.advice.witness),expected);
 }
 assert.equal(S.geometry(q.state.board).center.status,'level');assert(events.filter(e=>e.type==='T').every(e=>e.spin==='full'&&e.lines===2));assert(events.filter(e=>e.type==='Z').every(e=>e.cells.every(([x])=>x>=8)));
 assert.equal(q.state.bag.observedCount,fixture.observation.bag.observedCount,'no unseen draw was revealed');assert(q.state.streamCursor-fixture.observation.streamCursor<=7);assert.equal(lastAdvice.evidence.resourceObligations.status,'checked');
});
