'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history');
const fixtures=require('./fixtures/midgame-resource-cases.json').cases;
const actions={l:'L',r:'R',d:'SD',D:'HD',h:'HOLD',c:'CW',a:'CCW',b:'R180'};
const observation=s=>({rules:s.rules,board:s.board,active:s.active,hold:s.hold,canHold:s.canHold,queue:s.queue,revision:s.revision,streamCursor:s.streamCursor,topOut:s.topOut,...(s.bag?{bag:s.bag}:{})});
// Replay each exact literal fixture once. History is recursively frozen by H;
// mutable observations/diagnostics are copied so tests cannot affect each other.
const replayCache=new WeakMap(),copy=x=>JSON.parse(JSON.stringify(x));
const copyReplay=r=>({state:copy(r.state),history:r.history,diagnostics:copy(r.diagnostics)});
function replayFixture(f){
 const cached=replayCache.get(f);if(cached)return copyReplay(cached);
 let state=R.createState({...f.initial,revision:1}),history=H.start(observation(state),{fresh:true});
 for(const [i,[encoded,reveals]]of f.locks.entries()){
  let cursor=0;
  for(const code of encoded){const action=actions[code],before=observation(state),next=R.move(state,action);assert.notEqual(next,state,'Literal observed action executes');state={...next,revision:state.revision+1};
   while(state.queue.length<6){const type=reveals[cursor++];assert.ok(type,'Only actual revealed suffix refills preview');state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};}
   history=H.applyAction(history,before,action,{...observation(state),lastEvent:state.lastEvent});
  }
  assert.equal(cursor,reveals.length);if(i+1===f.handoff)history=H.markHandoff(history,observation(state));
 }
 const result={state:observation(state),history,diagnostics:H.resolve(observation(state),history)};
 assert.ok(Object.isFrozen(history),'Only immutable trusted histories may be shared');
 replayCache.set(f,result);return copyReplay(result);
}
for(const f of fixtures)test('midgame resources: literal '+f.id+' retains observed identity and resource state',()=>{
 const {state,diagnostics:d}=replayFixture(f);assert.equal(d.coverage.status,'complete');assert.equal(d.locks,f.lock-1);assert.equal(d.milestones.maintenanceHandoff.at,f.handoff);assert.equal(d.extraZ.status,f.expected.extraZ);assert.equal(d.hangingS.status,f.expected.hangingS);assert.equal(state.active.type,f.expected.active);assert.equal(state.hold,f.expected.hold);assert.deepEqual(state.queue,f.expected.queue);assert.deepEqual(state.board.filter(r=>r!=='..........'),f.expected.board);
 const result=R.replay(state,f.expected.witness);assert.equal(result.valid,true);assert.deepEqual(result.events,[f.expected.event],'Prior accepted problematic placement is still mechanically legal');
});
test('midgame resources: genuine run prefix survives worker cloning without inventing allowance',()=>{
 const {state,history,diagnostics}=replayFixture(fixtures[0]);
 const context=JSON.parse(JSON.stringify(H.exportContext(state,history)));
 const imported=H.importContext(state,context),actual=H.resolve(state,imported);
 assert.equal(actual.extraZ.status,'used');assert.deepEqual(actual.instances,diagnostics.instances);assert.deepEqual(actual.center,diagnostics.center);
 const moved=R.move(R.createState(state),'L');assert.equal(H.resolve(moved,H.importContext(moved,context)).coverage.status,'invalid','Context cannot be reused against another observed pose');
});
const M=require('../st-midgame-resources');
for(const f of fixtures)test('midgame resources: rejects observed '+f.id+' allocation rather than merely labelling it',()=>{
 const {state,diagnostics}=replayFixture(f),check=M.checkPath(state,[{witness:f.expected.witness,event:f.expected.event}],diagnostics);
 assert.equal(check.valid,false,'Previously chosen placement violates an ordinary-midgame obligation');
 const reason=f.id.startsWith('second-z')?'extra-Z-not-available':f.id.startsWith('unscored-t')?'ordinary-T-must-score':'center-partner-blocked-by-T-or-unseen';
 assert.equal(check.reason,reason);
});
test('midgame resources: a legal Left S alternative is not rejected merely because SL is blocked',()=>{
 const f=fixtures.find(f=>f.id==='sl-before-held-t-collision-run8'),{state,diagnostics}=replayFixture(f);
 const placements=R.placements(state,{maxNodes:45000}).placements;
 const p=placements.find(p=>p.event.type==='S'&&p.target.x===1&&p.target.y===26&&p.target.rotation===3&&p.event.cells.every(([x])=>x<4));
 assert.ok(p,'Actual observed-pose Left S witness exists');assert.equal(M.checkPath(state,[p],diagnostics).valid,true,'Flow guard preserves alternative; this is not a whole-route survival proof');
});
test('midgame resources: one available allowance cannot pay two non-Right Zs in the same projected prefix',()=>{
 // Isolated allowance accounting case, not an asserted historical baseline or
 // a complete supported ST construction. Both lock events are actual legal moves.
 const state=R.createState({active:'Z',queue:['Z','I','J','L','S','O']});
 const a=R.placements(state,{allowHold:false}).placements.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x<4));assert.ok(a);
 const b=R.placements(a.state,{allowHold:false}).placements.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x<4));assert.ok(b);
 const summary={extraZ:{status:'available'}};
 assert.equal(M.checkPath(state,[a],summary).valid,true);
 const twice=M.checkPath(state,[a,b],summary);assert.equal(twice.valid,false);assert.equal(twice.reason,'extra-Z-not-available');
 assert.equal(M.checkPath(state,[a],{}).reason,'extra-Z-not-available','Unknown is never an available allowance');
});
test('midgame resources: every ordinary T remains a scoring obligation even with an unrecognized Right',()=>{
 const f=fixtures.find(f=>f.id==='unscored-t-with-hanging-s-run10'),{state,diagnostics}=replayFixture(f);
 const alternatives=R.placements(state,{maxNodes:45000}).placements.filter(p=>p.event.type==='T'&&!p.event.lines);
 assert.ok(alternatives.some(p=>p.event.cells.some(([x])=>x>=7)),'Test includes non-scoring Right T placements, not only Left fillers');
 for(const p of alternatives){const out=M.checkPath(state,[p],diagnostics);assert.equal(out.valid,false);assert.ok(out.resource.violations.includes('ordinary-T-must-score'));}
});
test('midgame resources: HOLD ordering, not queue membership, determines Center-partner accessibility',()=>{
 const i=(type,id)=>({type,id});
 const blocked={active:i('I',1),hold:i('T',2),queue:['J','O','O','T','L'].map((t,n)=>i(t,n+3))};
 assert.equal(M.partnerAccessible(blocked,['L']),false);
 const reachable={...blocked,queue:['J','O','O','L','T'].map((t,n)=>i(t,n+3))};
 assert.equal(M.partnerAccessible(reachable,['L']),true,'Moving L ahead of the T collision changes necessary piece-flow feasibility only');
});
test('midgame resources: completing the actual same-bag SL pair does not invent a Hanging S',()=>{
 const f=fixtures[0],{state,diagnostics}=replayFixture({...f,locks:f.locks.slice(0,38)});
 const pending=diagnostics.center.pending.find(p=>p.family==='SL');assert.ok(pending);assert.equal(pending.rootBag,5);
 const witness=[...f.locks[38][0]].map(c=>actions[c]),r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events[0].type,'L');
 const projected=M.checkPath(state,[{witness,event:r.events[0]}],diagnostics);assert.equal(projected.valid,true);assert.deepEqual(projected.resource.hangingS,[]);
});
test('midgame resources: repairing a tracked Hanging S consumes its actual held identity',()=>{
 const f=fixtures.find(f=>f.id==='unscored-t-with-hanging-s-run10'),{state,diagnostics}=replayFixture(f);
 assert.equal(diagnostics.instances.hold.type,'S');const id=diagnostics.instances.hold.id;assert.ok(diagnostics.hangingS.evidence.some(e=>e.sId===id));
 const p=R.placements(state,{maxNodes:45000}).placements.find(p=>p.event.type==='S'&&p.event.cells.every(([x])=>x<4));assert.ok(p);
 const resource=M.start(state,diagnostics);assert.equal(M.repairGoal(p.event,diagnostics.instances.hold,resource),true);
 assert.equal(M.repairGoal(p.event,{...diagnostics.instances.hold,id:id+1000},resource),false,'A different S identity cannot discharge the same obligation');
 const projected=M.step(state,p,resource);assert.ok(!projected.hangingS.some(h=>h.id===id),'Actual held S allocated on Left discharges the tracked identity; geometry still needs its own check');
});
test('midgame resources: an executed TSD can free HOLD before a delayed Center partner',()=>{
 // Same literal board and legal recovery witnesses as the existing Center
 // deferral control, with an explicit alternate public queue. This is a finite
 // synthetic timing test, not a new source claim or an invented known bag.
 const raw={...require('./support/st-user-center-cap.json'),queue:['T','Z','T','L','I','J']};delete raw.bag;
 let state=R.createState(raw);const summary=H.resolve(state,H.start(state)),path=[];
 for(const witness of require('./support/st-center-deferral-witness.json').witnesses){const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);path.push({witness,event:r.events[0]});state=r.state;}
 assert.equal(M.checkPath(raw,path.slice(0,3),summary).reason,'center-partner-blocked-by-T-or-unseen');
 assert.equal(path[3].event.type,'T');assert.equal(path[3].event.spin,'full');assert.equal(path[3].event.lines,2);
 const complete=M.checkPath(raw,path,summary);assert.equal(complete.valid,true,'A checked scoring T genuinely clears the inventory bottleneck');assert.deepEqual(complete.resource.pendingCenter,[]);assert.equal(complete.resource.scoredTs.length,1);
});
const P=require('../st-planner');
test('midgame resources: real planner never returns the known invalid resource allocations',()=>{
 for(const f of fixtures){const {state,history,diagnostics}=replayFixture(f),resourceContext=H.exportContext(state,history);
  const advice=P.plan(state,{resourceContext,maxNodes:45000,deadline:Infinity,openingPhase:false});
  if(advice.target){if(f.id.startsWith('second-z')||f.id.startsWith('unscored-t'))assert.notDeepEqual(advice.continuation[0].event,f.expected.event,f.id+' must not preserve the invalid allocation');assert.equal(M.checkPath(state,advice.continuation,diagnostics).valid,true,f.id+' returns a resource-valid prefix');assert.ok(advice.evidence.resourceObligations);}
  else assert.ok(['no-supported-continuation-found','unsupported-position','budget-exhausted'].includes(advice.status),f.id+': '+advice.status);
 }
});
test('midgame resources: covering the reserved L cells with J does not erase an S/L obligation',()=>{
 const {state:origin,diagnostics}=replayFixture(fixtures.find(f=>f.id==='sl-before-held-t-collision-run8'));let state=origin;const path=[];
 for(const witness of [['R','HD'],['L','CCW','HD'],['R','HD']]){const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);path.push({witness,event:r.events[0]});state=r.state;}
 assert.deepEqual(path.map(p=>p.event.type),['S','I','J']);assert.ok(path.every(p=>p.event.lines===0));assert.ok(path[2].event.cells.every(([x])=>x>=4&&x<7));
 const result=M.checkPath(origin,path,diagnostics);assert.equal(result.valid,false);assert.equal(result.reason,'center-partner-blocked-by-T-or-unseen');assert.ok(result.resource.pendingCenter.some(p=>p.family==='SL'&&p.lost));
});
test('midgame resources: old mechanically valid cached advice cannot bypass current resource checks',()=>{
 for(const f of fixtures.filter(f=>f.id.startsWith('second-z')||f.id.startsWith('unscored-t'))){
  const {state,history}=replayFixture(f),step={event:f.expected.event,witness:f.expected.witness,target:f.expected.event.target,hold:f.expected.witness.includes('HOLD')};
  const previous={status:'recommended-with-verified-prefix',target:step.target,witness:step.witness,hold:step.hold,continuation:[step],context:JSON.stringify([state.rules,state.board,state.hold,state.canHold,state.queue,state.bag??null,state.active.type]),assessment:P.assess(state.board),evidence:{strategy:'canonical-right-ST',cycleDebt:0}};
  assert.equal(P.revalidate(state,previous,{resourceContext:H.exportContext(state,history),deadline:Infinity,maxNodes:45000}),null,f.id+' cannot retain an old unsafe target');
  const action=step.witness[0],next=R.move(R.createState(state),action);assert.notEqual(next,state);
  const nextHistory=H.applyAction(history,state,action,next);
  assert.equal(P.advance(next,previous,action,{resourceContext:H.exportContext(next,nextHistory),deadline:Infinity,maxNodes:45000}),null,f.id+' cannot preserve an unsafe target through actual movement');
 }
});

test('midgame resources: a Z crossing Center/Right cannot escape resource guards',()=>{
 // Mechanically legal empty-board geometry isolates the boundary predicate;
 // neither a spent allowance nor an unknown import authorizes this role.
 const state=R.createState({active:'Z',queue:['I','J','L','S','O','T']});
 const p=R.placements(state,{allowHold:false}).placements.find(p=>p.event.cells.some(([x])=>x>=4&&x<7)&&p.event.cells.some(([x])=>x>=7));
 assert.ok(p);assert.ok(R.replay(state,p.witness).valid);
 for(const status of ['used','unknown']){
  const result=M.checkPath(state,[p],{extraZ:{status}});
  assert.equal(result.valid,false);assert.equal(result.reason,'ordinary-Z-outside-reviewed-Right-role');
 }
});
test('midgame resources: absent visible T does not excuse an unfinishable Center module',()=>{
 const f=require('./support/st-center-stage.json');
 for(const available of [false,true]){
  const raw={...f.origin,queue:available?['S','L','I','O','J','Z']:['S','I','O','J','Z','I']};delete raw.bag;
  const projected=M.checkPath(raw,f.advice.continuation,H.resolve(raw,H.start(raw)));assert.equal(projected.valid,true);
  const resource=projected.resource;assert.ok(![resource.active,resource.hold,...resource.queue].some(p=>p?.type==='T'));assert.equal(resource.pendingCenter.length,1);
  const proof=M.repair(projected.state,resource,{maxNodes:10000,depth:2});assert.equal(proof.valid,available);
  if(available){assert.equal(proof.path.length,1);const r=R.replay(projected.state,proof.path[0].witness);assert.ok(r.valid);assert.equal(r.events[0].type,'L');assert.deepEqual(r.events[0].cells,resource.pendingCenter[0].alternatives[0].cells);}
  else assert.equal(proof.status,'no-visible-resource-repair');
 }
});
