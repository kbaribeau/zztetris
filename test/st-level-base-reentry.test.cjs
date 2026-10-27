'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),A=require('../st-access');
const original=require('./support/st-level-base-reentry.json');
// Keep the established Left damage, but remove the boundary void that the
// promised L would newly seal. The original board remains a negative control.
const f=require('./support/st-level-base-reentry-positive.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const config={deadline:Infinity,maxNodes:45000,patternHistory:f.patternHistory};
const saved=()=>({observation:clone(f.observation),advice:{target:f.event.target,witness:f.witness,continuation:[clone(f.savedStep)],evidence:clone(f.savedEvidence)}});
function checked(a,s=f.observation){assert.ok(a.target,a.reason);const r=R.replay(s,a.witness);assert.ok(r.valid);assert.deepEqual(r.events,[a.continuation[0].event]);assert.equal(a.continuation.length,1);return r;}

test('original delayed partner with held T is not a certified Center preparation',()=>{
 const a=P.plan(original.observation,{deadline:Infinity,maxNodes:45000});
 assert.equal(a.target,null);assert.equal(a.metrics.levelBaseReentry.selected,false);
});

test('immediate Center partner is not a proof when it newly seals the Left boundary',()=>{
 const s={...original.observation,queue:['L',...original.observation.queue.slice(1)]};
 const stage=R.replay(s,original.witness);assert.equal(stage.valid,true);
 const c=S.geometry(stage.state.board).center.completions.find(c=>c.piece==='L');assert.ok(c);
 const end=R.replay(stage.state,c.witness);assert.equal(end.valid,true);
 assert.deepEqual(P.cavityRepairDebt(P.assess(stage.state.board),P.assess(end.state.board),end.events[0]),[[3,36]]);
 const a=P.plan(s,{deadline:Infinity,maxNodes:45000});assert.equal(a.target,null);
});

test('immediate-partner control has an independently replayed actual Center completion',()=>{
 const a=P.plan(f.observation,config),r=checked(a),before=S.geometry(r.state.board);
 const completion=before.center.completions.find(c=>c.piece==='L');assert.ok(completion);
 const done=R.replay(r.state,completion.witness);assert.ok(done.valid);assert.equal(done.events.length,1);
 assert.deepEqual(done.events[0].cells.slice().sort(),completion.cells.slice().sort());
 assert.ok(S.geometry(done.state.board).center.patternSupport==='reference-supported');
 assert.deepEqual(P.cavityRepairDebt(P.assess(r.state.board),P.assess(done.state.board),done.events[0]),[]);
 assert.equal(A.prefix(r.state,[{state:done.state,event:done.events[0],witness:completion.witness}],{deadline:Infinity,maxNodes:45000}).reachable,true);
});

test('level-two re-entry preserves the already committed actual S stage, not stale scoring claims',()=>{
 assert.equal(P.assess(f.observation.board).maintenanceScope,false);
 const prior=saved();assert.equal(prior.advice.evidence.levelBaseReentry,undefined);assert.equal(P.resourceGoal(prior.advice.continuation),true);
 const a=P.decide(f.observation,{...config,commitment:prior}),r=checked(a);
 assert.deepEqual(r.events,[f.event]);assert.deepEqual(a.witness,f.witness);
 assert.equal(a.evidence.commitmentRetained,true);assert.equal(a.evidence.verifiedLocks,1);assert.ok(!a.evidence.tsdAt);
 assert.equal(a.evidence.cycleResources.tsds,0);assert.equal(a.evidence.cycleResources.centerPreparations,1);
 assert.equal(a.evidence.levelBaseReentry.level,2);assert.equal(a.evidence.levelBaseReentry.existingLeftCovered,1);
 assert.equal(a.assessment.structure.left.covered,1);assert.equal(a.evidence.regionalSupport,true);
 assert.equal(a.assessment.structure.center.foundation.status,'aligned');assert.equal(a.assessment.structure.center.patternSupport,'reference-supported');
 assert.deepEqual(a.continuation[0].structuralEvidence.cycleViolations,[]);assert.deepEqual(a.evidence.cavityRepair.outstandingCells,[]);
 assert.equal(a.evidence.gapAccess.reachable,true);assert.deepEqual(a.evidence.gapAccess.steps[0].cells,[]);
 assert.equal(r.state.hold,'T');assert.equal(r.state.active.type,'L');assert.deepEqual(r.state.queue,['Z','J','O','L','J']);
 assert.equal(a.metrics.levelBaseReentry.selected,true);assert.equal(a.metrics.completeDepth,1);
 assert.match(a.reason,/does not repair existing Left gaps or prove the next score/);
});

test('level-two re-entry discovers the same checked action without history or future knowledge',()=>{
 const a=P.plan(f.observation,{deadline:Infinity,maxNodes:45000});checked(a);assert.deepEqual(a.continuation[0].event,f.event);
 const extra={...clone(f.observation),hiddenQueue:['T','I','Z'],seed:9,mode:'Reset'};
 const b=P.plan(extra,{deadline:Infinity,maxNodes:45000});assert.deepEqual(b.continuation,a.continuation);assert.deepEqual(b.witness,a.witness);
 assert.equal(a.evidence.commitmentRetained,false);assert.equal(a.evidence.endpointTEntry,'not-established');
});

test('level-two re-entry is not generic low-stack, flatness, phase or opening readiness',()=>{
 const partial=P.plan(f.laterPartialBase,{deadline:Infinity,maxNodes:8000});assert.equal(partial.target,null);assert.equal(partial.metrics.levelBaseReentry,undefined);
 const hole=clone(f.observation);hole.board[39]=hole.board[39].slice(0,4)+'.'+hole.board[39].slice(5);
 assert.equal(P.plan(hole,{deadline:Infinity,maxNodes:8000}).target,null);
 const flat=clone(f.observation);flat.board[37]='JJJISSS...';
 assert.notEqual(S.centerLevelBase(flat.board).status,'phase-aligned-level-base');
 assert.equal(P.plan(f.observation,{...config,disableConstruction:true}).target,null);
 const badPhase={origin:Array(40).fill('..........'),steps:[]};
 assert.equal(P.plan(f.observation,{...config,patternHistory:badPhase}).target,null);
 assert.equal(P.assess(f.observation.board).regionalSupport,false,'the diagnostic does not grant generic readiness');
});

test('level-two re-entry cannot replace another or longer pending resource goal',()=>{
 const longer=saved();longer.advice.continuation.push(clone(f.savedStep));
 assert.equal(P.plan(f.observation,{...config,commitment:longer}).target,null);
 const changed=saved();changed.observation.hold='I';
 assert.equal(P.plan(f.observation,{...config,commitment:changed}).target,null);
 const noGoal=saved();delete noGoal.advice.continuation[0].structuralEvidence;
 assert.equal(P.plan(f.observation,{...config,commitment:noGoal}).target,null);
 const construction={evidence:{construction:{kind:'left-foundation',origin:f.observation,steps:[],consumed:0}}};
 assert.equal(P.plan(f.observation,{...config,constructionPrevious:construction}).target,null);
});

test('level-two S re-entry cannot spend or postpone an actually reachable floor Z cap',()=>{
 const activeZ=R.createState({...f.observation,active:'Z',hold:null,queue:[]});
 const cap=R.placements(activeZ,{allowHold:false}).placements.find(p=>p.event.type==='Z'&&!p.event.lines&&p.event.cells.every(([x])=>x>=7)&&S.transition(activeZ,p).allocation==='right-cap-preparation');assert.ok(cap,'the competing cap is an actual input witness, not an assumed future Z');
 for(const s of [activeZ,R.createState({...f.observation,hold:'Z'}),R.createState({...f.observation,hold:null,queue:['Z','I','T']})]){
  const a=P.plan(s,{deadline:Infinity,maxNodes:45000});assert.equal(a.target,null);assert.equal(a.metrics.levelBaseReentry.blockedByAvailableCap,true);
 }
 const unavailableZ=R.createState({...f.observation,hold:'Z'}),a=P.plan(unavailableZ,{deadline:Infinity,maxNodes:45000,allowHold:false});checked(a,unavailableZ);assert.equal(a.target.type,'S');
 for(const type of ['I','J','L','O','T','Z']){
  const s=R.createState({...f.observation,active:type,hold:null,queue:[]});assert.equal(P.plan(s,{deadline:Infinity,maxNodes:8000,allowHold:false}).target,null,type);
 }
});

test('level-two re-entry requires completed actual-pose enumeration and honors HOLD restrictions',()=>{
 for(const opts of [{maxNodes:0},{maxNodes:1},{timeMs:0,deadline:undefined}]){
  const a=P.plan(f.observation,{...config,...opts});assert.equal(a.target,null);assert.equal(a.status,'budget-exhausted');assert.equal(a.metrics.levelBaseReentry.selected,false);assert.ok(a.metrics.nodes<=(opts.maxNodes??45000));
 }
 const moved=R.move(R.createState(f.observation),'R'),a=P.plan(moved,config);checked(a,moved);assert.deepEqual(a.witness,['HD']);
 const held=R.move(R.createState(f.observation),'HOLD'),b=P.plan(held,config);checked(b,held);assert.equal(b.witness[0],'HOLD');
 const blocked=P.plan(held,{...config,allowHold:false});assert.equal(blocked.target,null);
 const noHold=R.move(R.createState({...f.observation,rules:'st-zero-v1'}),'HOLD');assert.equal(noHold.canHold,false);assert.equal(P.plan(noHold,config).target,null);
});

test('level-two re-entry retains its exact goal through movement and HOLD, then retires after the lock',()=>{
 for(const start of [R.createState(f.observation),R.move(R.createState(f.observation),'HOLD')]){
  let s=start,a=P.decide(s,config);checked(a,s);let commitment={observation:clone(s),advice:clone(a)};
  while(a.witness.length>1){const action=a.witness[0];s=R.move(s,action);const advanced=P.advance(s,a,action,config);assert.ok(advanced);
   a=P.decide(s,{...config,previous:advanced,commitment});checked(a,s);assert.equal(a.evidence.commitmentRetained,true);assert.deepEqual(a.target,f.event.target);
   commitment={observation:clone(s),advice:clone(a)};
  }
  const r=R.replay(s,a.witness);assert.equal(P.continueCommitment(s,r.state,a,r.events[0],config),null);
 }
});

test('level-two final access rejection clears selection and counts all failed proof work',()=>{
 for(const reachable of [false,null]){
  const module={exports:{}},realAccess={...A,prefix:(s,steps,options)=>({reachable,complete:reachable===false,visited:7,status:'controlled-final-access'})};
  vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:id=>id==='./st-access.js'?realAccess:require(id.replace('./','../')),Date,performance});
  const a=module.exports.plan(f.observation,config),enumeration=R.placements(f.observation);
  assert.equal(a.target,null);assert.equal(a.metrics.levelBaseReentry.selected,false);assert.equal(a.metrics.resourceProofNodes,1);assert.equal(a.metrics.nodes,enumeration.visited+7+a.metrics.resourceProofNodes);
 }
});

test('level-two re-entry cannot certify completion after its final candidate crosses the deadline',()=>{
 const module={exports:{}},root=R.placements(f.observation);let enumerated=false,calls=0;
 const rules={...R,placements:(state,options)=>{const r=R.placements(state,{...options,deadline:Infinity,now:()=>0});enumerated=true;return r;}};
 const now=()=>enumerated&&++calls>root.placements.length?100:0;
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:id=>id==='./st-rules.js'?rules:require(id.replace('./','../')),Date,performance});
 const a=module.exports.plan(f.observation,{...config,now,deadline:100});assert.equal(a.target,null);assert.equal(a.metrics.levelBaseReentry.selected,false);
 assert.equal(a.evidence.resourceObligations.reason,'resource-repair-budget');
 assert.equal(a.metrics.levelBaseReentry.candidateScanComplete,true);assert.equal(a.metrics.completeDepth,1);assert.equal(a.evidence.budgetExhausted,true);assert.equal(a.metrics.nodes,root.visited);
});

test('st-lab level-two re-entry survives fresh worker movement, lock and Undo requests',()=>{
 const {withPage}=require('./support/page.cjs');
 return withPage('st-lab.html',{},g=>{
  const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
  g.element('#st-snapshot').value=JSON.stringify(f.observation);g.click('#st-import');
  const respond=()=>{g.advance(40);const worker=all.at(-1),m=worker.message,a=P.decide(m.observation,{...m.options,timeMs:undefined,previous:m.previous,commitment:m.commitment});checked(a,m.observation);worker.respond(a);return{m,a};};
  const first=respond();assert.equal(first.m.commitment,null);assert.deepEqual(first.a.target,f.event.target);
  g.window.stLab.act('R');const moved=respond();assert.ok(moved.m.commitment);assert.equal(moved.a.evidence.commitmentRetained,true);assert.deepEqual(moved.a.witness,['HD']);
  g.window.stLab.act('HD');g.advance(40);assert.equal(all.at(-1).message.commitment,null);assert.equal(all.at(-1).message.options.openingPhase,false);
  g.window.stLab.act('UNDO');const restored=respond();assert.ok(restored.m.commitment);assert.deepEqual(restored.a.target,f.event.target);assert.equal(restored.a.evidence.verifiedLocks,1);
 });
});
