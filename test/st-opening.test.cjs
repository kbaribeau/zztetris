'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),O=require('../st-opening'),F=require('../st-fixtures');
const controls=require('./support/st-opening-geometry.json');
const options={maxNodes:20000,openingDepth:3,openingWidth:4};
function replay(state,advice){let notch=S.notchPattern(state.board);for(const step of advice.continuation){const r=R.replay(state,step.witness);assert.ok(r.valid);assert.equal(r.events.length,1);assert.deepEqual(r.events[0],step.event);assert.ok(S.canonicalClear(step.event));const n=S.advanceNotches(state.board,{state:r.state,event:step.event},notch);assert.ok(n.valid);assert.deepEqual(P.cavityRepairDebt(P.assess(state.board),P.assess(r.state.board),step.event),[]);state=r.state;notch=n.pattern;}return state;}
test('opening: four valid different first bags produce legal visible construction, not claimed completed openings',()=>{
 for(const pieces of ['IJLOSTZ','ZOTLJSI','TLSZOJI','LSOIJZT']){
  const state=R.createState({active:pieces[0],queue:[...pieces.slice(1)]}),a=P.plan(state,options);
  assert.ok(a.target,pieces);assert.equal(a.phase,'opening');assert.equal(a.evidence.opening.status,'partial-construction');
  const end=replay(state,a);assert.equal(a.evidence.opening.endpoint.parity,O.balance(end.board));assert.match(a.reason,/partial construction/);assert.ok(a.sources.every(s=>s.url.startsWith('https://docs.google.com/')));
 }
});
test('opening: source occupancy parity and cross-boundary foundations are not a mandatory two-T or flat-left rule',()=>{
 for(const c of controls){assert.equal(O.balance(c.board),O.balance(c.neutralBoard),c.id);if(c.tag==='balanced-left'||c.tag==='after-first-double')assert.equal(O.balance(c.board),0,c.id);if(c.tag==='one-left-t-debt'||c.tag==='geometric-slot-with-parity-debt')assert.equal(Math.abs(O.balance(c.board)),2,c.id);}
 assert.ok(controls.filter(c=>c.tag==='cross-region-foundation').length===4);
 const delayed=controls.find(c=>c.id==='1000l-before-balancing-t');assert.equal(delayed.afterLock,11);assert.equal(Math.abs(O.balance(delayed.board)),2);
});
test('opening: future fields and untrusted phase metadata do not influence the public deterministic search',()=>{
 const state=R.createState({active:'O',queue:['J','L','I','S','Z','T']});
 const a=P.plan({...state,hiddenQueue:['T','T'],opening:{completed:true}},options),b=P.plan({...state,hiddenQueue:['Z','Z'],opening:{completed:false}},options);
 delete a.metrics.elapsedMs;delete b.metrics.elapsedMs;assert.deepEqual(a,b);
 assert.equal('opening' in P.observe({...state,opening:{completed:true}}),false);
});
test('opening: bounds and missing visible supply abstain without promising hypothetical repair',()=>{
 const state=R.createState({active:'T',queue:['I','O','J','L','S','Z']});
 assert.equal(P.plan(state,{maxNodes:0,timeMs:0}).target,null);
 assert.equal(P.plan(R.createState({active:'T'}),options).target,null);
 const a=P.plan(state,options);assert.equal(a.metrics.enumeration,'reduced-stage-envelope-not-exhaustive');
});
test('opening: established fixtures and existing low-center repair are not reclassified by import',()=>{
 assert.equal(P.startOpeningSession(F.get('marathon-rebuild').observation).active,false);
 const repair=require('./support/st-construction-recovery.json');
 // Source repair may wrap its observation; importing its established wall must not invent an opening history.
 const raw=repair.observation||repair.state||repair.initial||repair;
 if(raw.board)assert.equal(P.startOpeningSession(raw).active,false);
 const c=controls.find(c=>c.tag==='geometric-slot-with-parity-debt'),state=R.createState({board:c.board,active:'T',queue:['I','L','J','O','S','Z']});
 assert.equal(O.handoff(state,null,options),null,'a slot alone is not a completed opening');
});
test('opening: actual canonical clear plus fresh supported maintenance proof permits handoff; fabricated event does not',()=>{
 const f=require('./support/st-opening-handoff.json'),session=P.updateOpeningSession({active:true,clear:null},f.before,f.after,f.event);
 const a=P.plan(f.after,{...options,openingPhase:true,openingClear:session.clear,timeMs:SEARCH_TIME_MS});
 assert.equal(a.phase,'maintenance');assert.equal(a.evidence.openingHandoff.status,'checked-after-actual-clear');replay(f.after,a);
 assert.equal(P.acceptOpeningResult(session,a).active,false);
 assert.equal(O.handoff(f.after,{...session.clear,event:{...f.event,spin:'none'}},options),null);
 const wrong=JSON.parse(JSON.stringify(f.after));wrong.board[39]='..........';
 assert.equal(O.handoff(wrong,session.clear,options),null);
 assert.equal(P.updateOpeningSession(session,f.before,f.after,{...f.event,lines:1}).clear,null);
 assert.equal(P.startOpeningSession(R.createState({active:'T'}),{emptyMode:true}).active,true);
});
