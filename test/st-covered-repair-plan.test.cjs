'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access'),P=require('../st-planner');
const fixture=require('./fixtures/covered-repair-plan.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function path(state,witnesses){return witnesses.map(witness=>{const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);state=r.state;return{witness,event:r.events[0],target:r.events[0].target,state};});}
function simple(){const state=R.createState({active:'S',queue:['L','O','I']});return{state,steps:path(state,[['L','L','L','HD'],[...Array(20).fill('SD'),'L','HD']])};}
for(const f of fixture.cases)test('covered repair / '+f.label+' is not repaired by the nearby double',()=>{
 const proof=A.repairPrefix(f.observation,f.steps,{notches:require('../st-pattern-history').resolve(f.observation,f.options.patternHistory)});
 assert.equal(proof.valid,false);assert.equal(proof.status,'unresolved-covered-cells');
 const creation=f.label.startsWith('J19')?1:0;
 assert.ok(proof.steps[creation].created.some(c=>JSON.stringify(c)===JSON.stringify(f.roofCellAfterCreation)));
 assert.ok(proof.outstandingCells.some(([x])=>x===3));
 const steps=path(f.observation,f.steps.map(p=>p.witness));assert.ok(steps.some(p=>p.event.lines===2));
 assert.equal(S.cavityFacts(steps[creation].state.board).sealedCells.some(([x,y])=>x===f.roofCellAfterCreation[0]&&y===f.roofCellAfterCreation[1]),false);
 assert.equal(P.checkedCoveredRepair(f.observation,f.steps,f.options),null);
 const q=f.observation,bad={target:f.steps[0].event.target,witness:f.steps[0].witness,hold:f.steps[0].witness.includes('HOLD'),continuation:f.steps,context:JSON.stringify([q.rules,q.board,q.hold,q.canHold,q.queue,q.bag??null,q.active.type]),assessment:P.assess(steps.at(-1).state.board),evidence:{}};
 assert.equal(P.revalidate(q,bad,{...f.options,maxNodes:45000}),null,'Actual retained-advice admission rejects the exact old creation route');
});
test('covered repair / actual supplied S then L repairs the exact temporary roof',()=>{
 const {state,steps}=simple();assert.deepEqual(A.covered(steps[0].state.board),[[2,39]]);
 assert.deepEqual(steps[1].state.board.slice(38),['.SS.L.....','SSLLL.....']);
 assert.equal(A.repairPrefix(state,steps.slice(0,1)).valid,false);
 const proof=A.repairPrefix(state,steps);assert.equal(proof.valid,true);assert.deepEqual(proof.outstandingCells,[]);
 const certificate=P.checkedCoveredRepair(state,steps);assert.ok(certificate?.plan);assert.equal(P.resourceGoal(certificate.steps),true);
 // A hypothetical replacement I is not supply; changing the actual L makes
 // the literal repair invalid even if the original movement witness is copied.
 assert.equal(P.checkedCoveredRepair({...state,queue:['I','O','I']},steps),null);
});
test('covered repair / unrelated clear translates identity and air access does not repay it',()=>{
 const before=R.emptyBoard();before[30]='...S......';
 const after=R.emptyBoard();after[32]='...S......';
 const debt=A.repairStep(before,after,{clearedRows:[37,39]},[[3,31]]);
 assert.ok(debt.some(c=>c[0]===3&&c[1]===33));
 assert.equal(S.cavityFacts(after).sealed,0);
 const filled=after.slice();filled[33]='...L......';
 assert.ok(!A.repairStep(after,filled,{clearedRows:[]},debt).some(c=>c[0]===3&&c[1]===33));
 assert.deepEqual(A.repairStep(after,R.emptyBoard(),{clearedRows:[]},debt),[],'Removing the roof resolves the actual defect, unlike opening its side');
});
test('covered repair / original proof survives consumed lock, refreshed preview, movement and HOLD',()=>{
 const {state,steps}=simple(),cert=P.checkedCoveredRepair(state,steps);assert.ok(cert?.plan);
 const saved={...cert.plan,consumed:1},after={...steps[0].state,queue:[...steps[0].state.queue,'J']};
 assert.ok(P.checkedCoveredRepair(after,[steps[1]],{},saved));
 const moved=R.move(after,'SD'),suffix={...steps[1],witness:steps[1].witness.slice(1)};assert.ok(P.checkedCoveredRepair(moved,[suffix],{},saved));
 const held=R.move(after,'HOLD');assert.equal(P.checkedCoveredRepair(held,[steps[1]],{},saved),null,'A changed active/hold inventory is not this original proof');
 const damaged=clone(after);damaged.board[39]='SS.X......';assert.equal(P.checkedCoveredRepair(damaged,[steps[1]],{},saved),null);
 const forged=clone(saved);forged.steps[1].witness=['HD'];assert.equal(P.checkedCoveredRepair(after,[steps[1]],{},forged),null);
 const missing=clone(saved);missing.steps.pop();assert.equal(P.checkedCoveredRepair(after,[steps[1]],{},missing),null);
});
test('covered repair / user position01 remains an unfinished supported ordinary Center stage',()=>{
 const f=fixture.ordinaryCenter,steps=path(f.observation,f.steps.map(p=>p.witness));
 const proof=A.repairPrefix(f.observation,steps);assert.equal(proof.valid,true);
 assert.equal(steps.reduce((n,p)=>n+p.event.lines,0),6);assert.equal(P.assess(steps.at(-1).state.board).maxHeight,11);
 const completion=S.geometry(steps.at(-1).state.board).center.completions.find(c=>c.piece==='L'&&c.resultStatus==='level');assert.ok(completion);
 assert.ok(![steps.at(-1).state.active?.type,steps.at(-1).state.hold,...steps.at(-1).state.queue].includes('L'),'The pending L is not fabricated as supplied');
 const RH=require('../st-resource-history'),M=require('../st-midgame-resources');
 assert.equal(M.checkPath(f.observation,steps,RH.resolve(f.observation,RH.start(f.observation))).valid,true,'The actual supplied prefix preserves ordinary resource obligations');
 assert.notEqual(proof.status,'full-reset-complete');
});
test('covered repair / existing imported damage is not reclassified and Right is separately scoped',()=>{
 const board=R.emptyBoard();board[37]='...S.....Z';
 assert.deepEqual(A.repairStep(board,board,{clearedRows:[]}),[]);
 const after=board.slice();after[36]='.........Z';assert.deepEqual(A.repairStep(board,after,{clearedRows:[]}),[]);
});
test('covered repair / replay history survives lost commitment and refuses copied debt flags',()=>{
 const RH=require('../st-resource-history'),{state,steps}=simple();let h=RH.start(state),current=state;
 for(const action of steps[0].witness){const before=current;current=R.move(current,action);h=RH.applyAction(h,before,action,current);}
 const exported=RH.exportContext(current,h),summary=RH.resolve(current,RH.importContext(current,clone(exported)));
 assert.deepEqual(summary.coveredRepair.cells,[[2,39]]);
 // No saved advice or commitment: history is independently sufficient to
 // reject a legal nearby placement that leaves the original roof untouched.
 const bad=path(current,[['R','R','HD']]);
 assert.equal(P.checkedCoveredRepair(current,bad,{resourceContext:exported}),null);
 assert.ok(P.checkedCoveredRepair(current,[steps[1]],{resourceContext:exported}));
 const forged=clone(exported);forged.coveredRepair={cells:[]};assert.deepEqual(RH.resolve(current,RH.importContext(current,forged)).coveredRepair.cells,[[2,39]]);
 const invalid=clone(exported);invalid.steps[0].action='BOGUS';assert.equal(P.checkedCoveredRepair(current,[steps[1]],{resourceContext:invalid}),null);
 assert.deepEqual(RH.resolve(current,RH.start(current)).coveredRepair.cells,[],'A position-only import honestly has unknown earlier provenance');
 for(const action of steps[1].witness){const before=current;current=R.move(current,action);h=RH.applyAction(h,before,action,current);}
 assert.deepEqual(RH.resolve(current,h).coveredRepair.cells,[],'Only the actual filling lock discharges the recorded cell');
});
test('covered repair / ordinary admission retains a real temporary roof through lock and fresh worker request',()=>{
 const board=R.emptyBoard();for(let y=36;y<40;y++)board[y]='XXXXXXX...';board[37]='XXXXXX....';
 const state=R.createState({board,active:'S',queue:['L','O','I']}),steps=path(state,[['L','L','L','HD'],[...Array(16).fill('SD'),'L','HD']]);
 const cert=P.checkedCoveredRepair(state,steps);assert.ok(cert?.plan);
 const advice={target:steps[0].target,witness:steps[0].witness,hold:false,continuation:cert.steps,context:JSON.stringify([state.rules,state.board,state.hold,state.canHold,state.queue,null,state.active.type]),assessment:P.assess(steps.at(-1).state.board),evidence:{coveredRepairPlan:cert.plan,coveredRepair:cert.proof}};
 const checked=P.revalidate(state,advice,{maxNodes:45000});assert.ok(checked,'The temporary roof is an actual admitted repair, not only legal geometry');
 const RH=require('../st-resource-history');let current=state,h=RH.start(state);
 for(const action of steps[0].witness){const before=current;current=R.move(current,action);h=RH.applyAction(h,before,action,current);}
 const options={resourceContext:RH.exportContext(current,h),maxNodes:45000},suffix=P.continueCommitment(state,current,checked,current.lastEvent,options);assert.ok(suffix,'The original exact repair survives the creator lock');
 assert.ok(P.revalidate(current,suffix,options));
 const fresh=P.decide(current,{...options,openingPhase:false,commitment:{observation:current,advice:suffix}});assert.ok(fresh.target);assert.deepEqual(fresh.target,steps[1].target);
 const stale=clone(checked);stale.continuation[1].witness=['HD'];
 assert.equal(P.continueCommitment(state,current,stale,current.lastEvent,options),null);
 assert.deepEqual(RH.resolve(current,RH.importContext(current,options.resourceContext)).coveredRepair.cells,[[2,35]],'A failed continuation does not erase actual debt');
});
test('covered repair / controller sends observed debt even with no retained advice',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};
 const {state,steps}=simple();g.element('#st-snapshot').value=JSON.stringify(state);g.click('#st-import');
 for(const action of steps[0].witness)g.window.stLab.act(action);g.advance(40);
 const request=all.at(-1).message,RH=require('../st-resource-history');
 assert.deepEqual(RH.resolve(request.observation,RH.importContext(request.observation,request.options.resourceContext)).coveredRepair.cells,[[2,39]]);
 const bad=path(request.observation,[['R','R','HD']]);assert.equal(P.checkedCoveredRepair(request.observation,bad,request.options),null);
}));

test('covered repair / former cap-first S route keeps its actual Left defect after the score',()=>{
 const initial=require('./support/st-visible-z-deferral.json').initial;
 const steps=path(initial,[['R','R','R','R','CW','HD'],['L','L','L','HD'],['R','R','R','CW',...Array(16).fill('SD'),'CW','HD']]);
 const proof=A.repairPrefix(initial,steps);assert.equal(steps.at(-1).event.lines,2);
 assert.deepEqual(proof.steps[1].created,[[2,32]]);assert.deepEqual(proof.outstandingCells,[[2,34]]);assert.equal(proof.valid,false);
});

test('covered repair / retained-advice hard gate rejects actual S22 even when copied evidence claims repair',()=>{
 const f=fixture.cases[0],q=f.observation,steps=path(q,f.steps.map(p=>p.witness));
 const bad={target:steps[0].target,witness:steps[0].witness,hold:true,continuation:steps,context:JSON.stringify([q.rules,q.board,q.hold,q.canHold,q.queue,q.bag??null,q.active.type]),assessment:P.assess(steps.at(-1).state.board),evidence:{coveredRepair:{valid:true,status:'actual-covered-cells-repaired',outstandingCells:[]}}};
 assert.equal(P.revalidate(q,bad,{...f.options,maxNodes:45000}),null);
});
test('covered repair / cross-region S84 Center defect survives both nearby TSD and quad',()=>{
 const f=fixture.centerCrossing,steps=path(f.observation,f.steps.map(p=>p.witness)),options={patternHistory:f.patternHistory};
 const proof=A.repairPrefix(f.observation,steps,{notches:require('../st-pattern-history').resolve(f.observation,f.patternHistory)});
 assert.deepEqual(proof.steps[0].created,f.createdCells);assert.equal(steps[3].event.lines,2);assert.equal(steps[4].event.lines,4);
 for(const cell of f.translatedCells)assert.ok(proof.outstandingCells.some(c=>JSON.stringify(c)===JSON.stringify(cell)));
 assert.equal(proof.valid,false);assert.equal(P.checkedCoveredRepair(f.observation,steps,options),null);
});
