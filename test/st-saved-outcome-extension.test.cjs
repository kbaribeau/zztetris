'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createRequire}=require('node:module'),file=require.resolve('../st-planner'),req=createRequire(file);
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),M=require('../st-obligation-resources');
const clone=x=>JSON.parse(JSON.stringify(x)),cells=p=>JSON.stringify(p.event.cells.slice().sort(([ax,ay],[bx,by])=>ay-by||ax-bx));
function internal(mutate=s=>s,globals={}){const module={exports:{}};let source=mutate(fs.readFileSync(file,'utf8'));source=source.replace('return Object.freeze({','return Object.freeze({nodeFor,extendSavedOutcome,prepareResourceOptions,resourceRoot,');vm.runInNewContext(source,{module,require:req,Date,performance,...globals});return module.exports;}
function placement(state,witness){const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0],target:r.events[0].target,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};}
function setup(state=R.createState({active:'O',queue:['I','T']})){
 const api=internal(),options=api.prepareResourceOptions(state),initial={...P.assess(state.board),state,notches:S.notchPattern(state.board),resources:api.resourceRoot(state,options)};
 const savedStep=placement(state,['L','L','L','R180','HD']),freshStep=placement(state,['L','L','L','HD']);
 const saved=api.nodeFor(savedStep,null,initial,0),fresh=api.nodeFor(freshStep,null,initial,0),tail=placement(fresh.state,['L','L','L','HD']),candidate=api.nodeFor(tail,fresh,initial,0);
 return{api,initial,saved,candidate};
}
function replayPath(state,path){for(const p of path){const r=R.replay(state,p.witness);assert.equal(r.valid,true);assert.deepEqual(clone(r.events),[clone(p.event)]);state=r.state;}return state;}

test('saved outcome extension: a removed symmetric pose keeps the literal prefix and rebuilds real tail resources',()=>{
 const {api,initial,saved,candidate}=setup(),snapshot=clone(saved);let used=0;
 assert.notDeepEqual(saved.path[0].event.target,candidate.path[0].event.target);assert.equal(cells(saved.path[0]),cells(candidate.path[0]));
 const result=api.extendSavedOutcome(saved,candidate,initial,n=>(used+=n,true));assert.ok(result);assert.equal(used,candidate.path[1].witness.length);
 assert.strictEqual(result.path[0],saved.path[0]);assert.notStrictEqual(result.path[1],candidate.path[1]);assert.deepEqual(clone(saved),snapshot);
 const endpoint=replayPath(initial.state,result.path);assert.deepEqual(clone(result.state),clone(endpoint));assert.equal(M.binding(result.resources),M.binding(candidate.resources));
 assert.deepEqual(clone(result.notches),clone(candidate.notches));assert.equal(result.cycleDebt,candidate.cycleDebt);assert.deepEqual(clone(result.path[1].structuralEvidence),clone(candidate.path[1].structuralEvidence));
 // A caller cannot retain copied structural proof labels on the rebuilt tail.
 candidate.path[1].structuralEvidence={leftRepair:{pieceId:999},hangingSAccommodation:{pieceId:999}};
 const checked=api.extendSavedOutcome(saved,candidate,initial,()=>true);assert.deepEqual(clone(checked.path[1].structuralEvidence),clone(result.path[1].structuralEvidence));
});

test('saved outcome extension: distinct trusted accounting stays on the saved route and cannot forgive an actual violation',()=>{
 const Context=require('../st-obligation-context'),api=internal();
 for(const next of ['I','T']){
  const state=R.createState({active:'O',queue:next==='I'?[...'ITZJLS']:[...'TIZJLS'],streamCursor:1}),known=M.start(state,Context.start(state,{fresh:true}),{extendForced:false}),unknown=M.startUnknown(state,{extendForced:false});
  const initial={...P.assess(state.board),state,notches:S.notchPattern(state.board),resources:known},otherInitial={...initial,resources:unknown};
  const saved=api.nodeFor(placement(state,['L','L','L','R180','HD']),null,initial,0),fresh=api.nodeFor(placement(state,['L','L','L','HD']),null,otherInitial,0);
  const candidate=api.nodeFor(placement(fresh.state,['L','L','L','HD']),fresh,otherInitial,0),snapshot=clone(saved);
  assert.notEqual(M.rootBinding(saved.resources),M.rootBinding(candidate.resources));
  const result=api.extendSavedOutcome(saved,candidate,initial,()=>true);
  if(next==='I'){
   assert.ok(result);assert.equal(M.rootBinding(result.resources),M.rootBinding(saved.resources));assert.notEqual(M.binding(result.resources),M.binding(candidate.resources));
   const expected=api.nodeFor(placement(saved.state,candidate.path[1].witness),saved,initial,0);assert.equal(M.binding(result.resources),M.binding(expected.resources));assert.equal(result.resources.active.id,known.queue[1].id);
  }else{assert.ok(candidate.cycleDebt>0,'the real unscored T lock violates ordinary cycle policy');assert.equal(result,null);}
  assert.deepEqual(clone(saved),snapshot,'failed optional work leaves the saved commitment unchanged');
 }
});

test('saved outcome extension: no optional replay without budget, an event alias and a valid searched tail',()=>{
 const {api,initial,saved,candidate}=setup(),snapshot=clone(saved);assert.equal(api.extendSavedOutcome(saved,candidate,initial,()=>false),null);assert.deepEqual(clone(saved),snapshot);
 const tail=placement(candidate.state,['L','L','HD']),longer=api.nodeFor(tail,candidate,initial,0);let now=0,used=0;const deadline=1;
 assert.equal(api.extendSavedOutcome(saved,longer,initial,units=>{if(now>=deadline)return false;used+=units;now++;return true;}),null);assert.equal(used,candidate.path[1].witness.length);assert.deepEqual(clone(saved),snapshot);
 const exact={...candidate,path:[saved.path[0],candidate.path[1]]};let spent=0;assert.equal(api.extendSavedOutcome(saved,exact,initial,n=>(spent+=n,true)),null);assert.equal(spent,0,'exact prefixes stay on the existing caller fast path');
 const bad={...candidate,path:[candidate.path[0],{...candidate.path[1],witness:['not-an-action','HD']}]};assert.equal(api.extendSavedOutcome(saved,bad,initial,()=>true),null);
 const changed=clone(candidate);changed.path[1].event.lines=4;assert.equal(api.extendSavedOutcome(saved,changed,initial,()=>true),null);
});

test('saved outcome extension: actual HOLD identity and empty-HOLD draw changes are not aliases',()=>{
 for(const [state,witness]of [[R.createState({active:'O',hold:'O',queue:['I','T']}),['HOLD','L','L','L','HD']],[R.createState({active:'O',queue:['I','T']}),['HOLD','HOLD','L','L','L','HD']]]){
  const {api,initial,saved,candidate}=setup(state),other=placement(state,witness);assert.equal(cells(other),cells(saved.path[0]));
  const altered={...candidate,path:[other,candidate.path[1]]};assert.equal(api.extendSavedOutcome(saved,altered,initial,()=>true),null);
  // Claimed HOLD metadata must not conceal the actual action history.
  other.holdCount=0;other.hold=false;assert.equal(api.extendSavedOutcome(saved,altered,initial,()=>true),null);
 }
});

test('saved outcome extension: real same-cell spin outcomes remain distinct',()=>{
 const board=R.emptyBoard();board[36]='...#.#....';board[38]='...#......';
 const state=R.createState({board,active:{type:'T',x:3,y:35,rotation:2,lastRotation:null},queue:['I','O']}),found=R.placements(state,{allowHold:false,maxNodes:16000,now:()=>0});assert.equal(found.complete,true);
 const plain=found.placements.find(p=>p.event.spin==='none'&&found.placements.some(q=>cells(q)===cells(p)&&q.event.spin==='mini'));
 assert.ok(plain,'actual enumeration contains a same-cell no-spin/mini pair');const spun=found.placements.find(q=>cells(q)===cells(plain)&&q.event.spin==='mini');
 assert.deepEqual(plain.state.board,spun.state.board);replayPath(state,[plain]);replayPath(state,[spun]);
 const api=internal();let spent=0;assert.equal(api.extendSavedOutcome({path:[plain]},{path:[spun,plain]},null,n=>(spent+=n,true)),null);assert.equal(spent,0);
});

test('saved outcome extension: ordinary comparison extends a noncanonical saved quad to the fresh horizon',()=>{
 // Same public-supply control as the existing quad-goal comparison: O is
 // available immediately after the quad rather than hidden behind S/T.
 const c=clone(require('./support/st-commitment-comparison.json')[1]);c.before.queue=['Z','I','O','S','T','J'];c.snapshot.queue=['I','O','S','T','J','L'];delete c.before.bag;delete c.snapshot.bag;
 const saved=P.continueCommitment(c.before,c.snapshot,c.previous,c.event,{now:()=>0,deadline:Infinity,maxNodes:12000});assert.ok(saved);assert.equal(saved.continuation.length,2);
 const before=R.replay(c.snapshot,saved.continuation[0].witness).state,last=saved.continuation[1],all=R.placements(before,{now:()=>0,maxNodes:16000}).placements;
 const alias=all.find(p=>p.target.rotation===3&&cells(p)===cells(last)&&p.holdCount===last.holdCount);assert.ok(alias);assert.ok(!P.ordinaryPlacementOutcomes(all).some(p=>JSON.stringify(p.event)===JSON.stringify(alias.event)));
 saved.continuation[1]={...last,witness:alias.witness,event:alias.event,target:alias.target};
 const options={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity,commitment:{observation:c.snapshot,advice:saved}},result=P.plan(c.snapshot,options);
 assert.equal(result.metrics.commitmentComparison.savedHorizon,3);assert.equal(result.metrics.commitmentComparison.freshHorizon,3);assert.equal(result.metrics.commitmentComparison.replacement,false);
 assert.deepEqual(result.continuation.map(p=>p.event),saved.continuation.map(p=>p.event));assert.ok(result.metrics.nodes<=45000);replayPath(c.snapshot,result.continuation);
 const disabled=internal(s=>s.replace('function extendSavedOutcome(saved,candidate,initial,spend,readAssessment=assess){','function extendSavedOutcome(saved,candidate,initial,spend,readAssessment=assess){return null;')).plan(c.snapshot,options);
 assert.equal(disabled.metrics.commitmentComparison.savedHorizon,2,'without replay recovery the physical alias cannot extend the saved comparison');
});

test('saved outcome extension: Reset extends a noncanonical saved S pose by literally replaying its prefix',()=>{
 const f=clone(require('./support/st-reset-exact-prefix-scoring.json')),saved=f.originalCommitment.advice.continuation;
 const before=R.replay(f.initial,saved[0].witness).state,all=R.placements(before,{now:()=>0,maxNodes:16000}).placements;
 const alias=all.find(p=>p.target.rotation===2&&cells(p)===cells(saved[1])&&p.holdCount===0);assert.ok(alias);assert.ok(!P.ordinaryPlacementOutcomes(all).some(p=>JSON.stringify(p.event)===JSON.stringify(alias.event)));
 saved[1]={...saved[1],witness:alias.witness,event:alias.event,target:alias.target};
 const options={obligationContext:f.obligationContext,patternHistory:f.patternHistory,commitment:f.originalCommitment,openingPhase:false,depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity},result=P.plan(f.initial,options);
 assert.ok(result.target,result.reason);assert.equal(result.metrics.commitmentComparison.resetExactPrefixExtension,true);assert.equal(result.evidence.resetConsideration.preference.kind,'certified-visible-TSD');
 for(const [i,p]of saved.entries()){assert.deepEqual(result.continuation[i].event,p.event);assert.deepEqual(result.continuation[i].witness,p.witness);}
 assert.ok(result.continuation.slice(saved.length).some(p=>p.event.spin==='full'&&p.event.lines===2));assert.ok(result.metrics.nodes<=45000);replayPath(f.initial,result.continuation);
 const disabled=internal(s=>s.replace('function extendSavedOutcome(saved,candidate,initial,spend,readAssessment=assess){','function extendSavedOutcome(saved,candidate,initial,spend,readAssessment=assess){return null;')).plan(f.initial,options);
 assert.notEqual(disabled.metrics.commitmentComparison?.resetExactPrefixExtension,true,'the real integration needs alias recovery, not just retention');
});

test('saved outcome extension: reserved O repair preserves a noncanonical incumbent first target',()=>{
 const f=clone(require('./fixtures/reserved-piece-plan.json'));let changed=false,selected;
 // Change only the already admitted first lock to an actually replayable
 // symmetric pose. The collector, complete repair search and proofs are real.
 const api=internal(s=>s.replace('const result=supportedPreferences(raw,initial,remaining,collector);','const result=supportedPreferences(raw,aliasIncumbent(raw,initial),remaining,collector);'),{aliasIncumbent:(raw,initial)=>{
  const first=initial.continuation[0],all=R.placements(raw,{maxNodes:16000,now:()=>0}).placements;
  const alias=all.find(p=>p.target.rotation!==first.target.rotation&&cells(p)===cells(first)&&p.holdCount===first.holdCount);assert.ok(alias);assert.ok(!P.ordinaryPlacementOutcomes(all).some(p=>JSON.stringify(p.event)===JSON.stringify(alias.event)));
  changed=true;selected=clone(alias);return{...initial,target:alias.target,witness:alias.witness,hold:alias.hold,holdCount:alias.holdCount,continuation:[{...first,...alias},...initial.continuation.slice(1)]};
 }});
 const result=api.decide(f.observation,{...f.options,depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});assert.equal(changed,true);assert.equal(result.metrics.reservedPiecePlan.selected,true);assert.equal(result.recommendation.kind,'supported');
 assert.deepEqual(clone(result.target),selected.target);assert.deepEqual(clone(result.witness),selected.witness);assert.equal(result.evidence.reservedPiecePlan.paymentLock,7);assert.deepEqual(clone(result.evidence.coveredRepair.outstandingCells),[]);assert.ok(result.metrics.nodes<=45000);replayPath(f.observation,result.continuation);
});
