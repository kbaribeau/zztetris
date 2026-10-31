'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),F=require('../st-fixtures'),LC=require('../st-left-context');
const I=require('./support/st-user-cleanup-i.json');
const alternatives=require('./support/st-accepted-cycle-alternatives.json');
const config={depth:3,width:8,maxNodes:45000};
function replay(s,a){assert.ok(a.target,a.reason);for(const p of a.continuation){assert.equal(S.canonicalClear(p.event),true,'normal advice admits only right TSD/quad clears');const r=R.replay(s,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events[0],p.event);s=r.state;}return s;}
for(const id of ['restore-the-right-cap','center-before-quad-cleanup','double-above-the-cleanup-i'])for(const timed of [false,true])test(`cycle regression: ${id}, ${timed?`production ${SEARCH_TIME_MS}ms`:'full bounded search'}`,()=>{
 const f=F.get(id),a=P.plan(f.observation,{...config,...(timed?{timeMs:SEARCH_TIME_MS}:{})});
 replay(R.createState(f.observation),a);
 assert.deepEqual(a.target,R.replay(R.createState(f.observation),f.expectations.referenceWitness).events[0].target);
 assert.equal(a.hold,f.expectations.referenceWitness.includes('HOLD'));
 if(!timed){assert.equal(a.metrics.completeDepth,3);assert.equal(a.evidence.budgetExhausted,false);}
 assert.deepEqual(a.continuation[0].structuralEvidence.cycleViolations,[]);
});
test('cycle: visible later Z is not evidence that spending the current cap Z is timely',()=>{
 const s=F.get('restore-the-right-cap').observation;assert.ok(s.queue.includes('Z'));
 const e=R.placements(s).placements.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x<4));assert.ok(e);
 assert.ok(S.transition(s,e).cycleViolations.includes('spent-cap-Z-on-optional-work'));
});
test('cycle: raised cleanup I is a legitimate scoring phase and its double is not repair damage',()=>{
 const f=F.get('double-above-the-cleanup-i'),s=R.createState(f.observation),r=R.replay(s,f.expectations.referenceWitness);
 assert.equal(S.assess(s).right.cycle.phase,'scoring-above-cleanup-I');
 const t=S.transition(s,{state:r.state,event:r.events[0]});assert.equal(t.regionalRepair,0);assert.equal(t.allocation,'scoring-double');
});
function assertCleanupPreparation(before,p){
 assert.equal(p.event.type,'I');assert.ok(p.event.cells.every(([x])=>x===9));assert.equal(S.transition(before,p).allocation,'quad-preparation');assert.deepEqual(S.transition(before,p).cycleViolations,[]);
 const after=p.state;assert.equal(after.board.every(row=>row[7]==='.'),true);
 const z=R.placements(R.createState({board:after.board,active:'Z',canHold:false})).placements.find(q=>q.event.cells.every(([x])=>x>=8)&&S.geometry(q.state.board).right.shapeStatus==='staggered-scoring-wall');assert.ok(z,'cleanup preparation must still admit the Z cap');
}
for(const timed of [false,true])test(`cycle: inherited D is exited before the same supplied I preparation (${timed?'timed':'full'})`,()=>{
 const before=R.createState(I),literal=R.replay(before,['HD']);assert.ok(literal.valid);assert.equal(literal.events.length,1);
 // Preserve the original I-column10/column8/Z-access mechanics independently
 // of the supported selector. This old snapshot already has D and no next J.
 assertCleanupPreparation(before,{state:literal.state,event:literal.events[0]});assert.equal(LC.isD(before.board),true);assert.equal(LC.isD(literal.state.board),true);assert.equal(LC.immediateJStarts(literal.state).length,0);
 const a=P.plan(I,{...config,...(timed?{timeMs:SEARCH_TIME_MS}:{})});replay(before,a);assert.deepEqual(a.target,{type:'S',x:2,y:23,rotation:3});assert.equal(a.hold,true);
 const exit=R.replay(before,a.witness).state;assert.equal(LC.isD(exit.board),false,'The supported S actually exits inherited D');
 const second=a.continuation[1],r=R.replay(exit,second.witness);assert.ok(r.valid);assert.deepEqual(second.target,literal.events[0].target);assertCleanupPreparation(exit,{state:r.state,event:r.events[0]});assert.equal(second.structuralEvidence.allocation,'quad-preparation');
});
test('cycle: immediate usable held J preserves a genuine supported I-first preparation',()=>{
 // Explicit synthetic supply variant of the same reviewed board: held J instead
 // of S, with a distinct visible J still available for Center. No history claim.
 const supplied={...I,hold:'J'},before=R.createState(supplied),a=P.plan(supplied,config);replay(before,a);assert.deepEqual(a.target,{type:'I',x:7,y:36,rotation:1});
 const r=R.replay(before,a.witness);assertCleanupPreparation(before,{state:r.state,event:r.events[0]});assert.equal(LC.isD(r.state.board),true);assert.ok(LC.immediateJStarts(r.state).length>0);assert.ok(P.revalidate(before,a,{maxNodes:45000}));
});
for(const f of alternatives)test(`cycle accepted alternative remains available: ${f.id}`,()=>{
 const a=P.plan(f.observation,config);const end=replay(R.createState(f.observation),a);
 if(f.id==='sprint-28'){assert.equal(a.target.type,'I');assert.ok(a.continuation[0].event.cells.every(([x])=>x<4));}
 if(f.id==='marathon-48'){assert.equal(a.target.type,'J');assert.ok(a.continuation.some(p=>p.event.type==='I'&&p.event.lines===4));}
 if(f.id==='ultra-25'){assert.notEqual(a.continuation[0].event.spin,'full');assert.ok(end.hold==='T'||end.active?.type==='T'||a.continuation.some(p=>p.event.spin==='full'&&p.event.lines===2),'delayed T remains reserved or scores');}
});
test('cycle: reported normal advice has no spent scoring obligations at any checked lock',()=>{
 for(const id of ['restore-the-right-cap','center-before-quad-cleanup','double-above-the-cleanup-i']){
  const a=P.plan(F.get(id).observation,{depth:2,width:8,maxNodes:20000});
  assert.equal(a.evidence.strategy,'canonical-right-ST');assert.equal(a.evidence.cycleDebt,0);
  assert.ok(a.continuation.every(p=>p.structuralEvidence.cycleViolations.length===0));
 }
});
test('cycle clear policy rejects noncanonical clears without banning zero-clear preparation',()=>{
 const event=(type,lines,spin,x)=>({type,lines,spin,cells:[[x,39],[x,38],[x,37],[x,36]]});
 for(const lines of [1,2,3])assert.equal(S.canonicalClear(event('I',lines,'none',7)),false);
 assert.equal(S.canonicalClear(event('T',2,'none',7)),false);
 assert.equal(S.canonicalClear(event('T',2,'full',2)),false);
 assert.equal(S.canonicalClear(event('I',4,'none',1)),false);
 assert.equal(S.canonicalClear(event('T',2,'full',7)),true);
 assert.equal(S.canonicalClear(event('I',4,'none',7)),true);
 assert.equal(S.canonicalClear(event('S',0,'none',4)),true);
});
// Search-mechanics tests restrict enumerated *real legal moves* on already
// reviewed positions. They introduce neither invented boards nor new fixtures.
function plannerWithPlacements(select){
 const fs=require('node:fs'),vm=require('node:vm'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:p=>p==='./st-rules.js'?{...R,placements:(s,o)=>{const e=R.placements(s,o);return {...e,placements:select(s,e.placements)};}}:require('../'+p.replace('./',''))});
 return module.exports;
}
test('cycle search retains a shorter clean prefix when deeper enumerated moves divert a reserved T',()=>{
 const f=F.get('restore-the-right-cap'),ref=R.replay(R.createState(f.observation),f.expectations.referenceWitness).events[0].target;
 const p=plannerWithPlacements((s,moves)=>s.revision===f.observation.revision?moves.filter(p=>JSON.stringify(p.target)===JSON.stringify(ref)):moves.filter(p=>p.event.type==='T'&&p.event.cells.every(([x])=>x<4)));
 const a=p.plan(f.observation,{...config,depth:2});assert.ok(a.target,a.reason);assert.equal(a.continuation.length,1);assert.equal(a.metrics.completeDepth,1);assert.equal(a.evidence.cycleDebt,0);
});
test('cycle search abstains when only obligation-diverting root moves are enumerated',()=>{
 const s=F.get('double-above-the-cleanup-i').observation;
 const p=plannerWithPlacements((s,moves)=>moves.filter(p=>p.event.type==='T'&&p.event.cells.every(([x])=>x<4)));
 const a=p.plan(s,{...config,depth:1});assert.equal(a.target,null);assert.equal(a.status,'no-supported-continuation-found');assert.match(a.reason,/supported ST sequence/);
});
test('cycle cadence: already-reviewed early preparation and later left I have distinct roles',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const codec=vm.runInNewContext(fs.readFileSync(require.resolve('../tetris-fumen.js'),'utf8'),{window:{}})(2);
 const pages=codec.decoder.decode(fs.readFileSync(require.resolve('../references/st-stacking/hXc2nbXcXOc.fumen'),'utf8').trim());
 for(const [number,column,role] of [[91,9,'quad-preparation'],[95,0,'left-filler']]){
  const f=pages[number-1].field,board=Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>39-y<23?f.at(x,39-y):'_').join('').replace(/_/g,'.'));
  const s=R.createState({board,active:'I',canHold:false}),p=R.placements(s).placements.find(p=>p.event.cells.every(([x])=>x===column));assert.ok(p);
  const transition=S.transition(s,p);assert.equal(transition.allocation,role);assert.deepEqual(transition.cycleViolations,[]);
  // The early outer I is ready, but the three-cell wall still needs its Z cap.
  if(number===91){assert.equal(S.geometry(p.state.board).right.cycle.phase,'cap-rebuild-with-cleanup-prepared');assert.deepEqual(S.geometry(p.state.board).right.cycle.cleanupColumns,[]);}
 }
});
test('cycle revalidation does not retain a noncanonical later clear from stale advice',()=>{
 const f=F.get('center-before-quad-cleanup'),a=P.plan(f.observation,{...config,depth:2});assert.equal(a.continuation.length,2);
 const stale=structuredClone(a);stale.continuation[1].event.lines=1;
 assert.equal(P.revalidate(f.observation,stale),null);
});
