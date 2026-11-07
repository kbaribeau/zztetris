'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner');
const M=require('../st-obligation-resources'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),A=require('../st-access'),F=require('../st-fixtures');
const {allowanceFixture}=require('./support/current-resource-test.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
// Existing reviewed geometry with explicit hypothetical public supply. This is
// not a historical source reconstruction or permission to spend an Extra Z.
function initial(order=['J','Z']){return R.createState({board:F.get('cap-rebuild').observation.board,active:order[0],queue:order.slice(1),canHold:false});}
const J=['CW','HD'],Z=['R','R','CW',...Array(7).fill('SD'),'L','HD'];
function step(s,witness){const r=R.replay(s,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);assert.equal(r.events[0].topOut,false);return{state:r.state,event:r.events[0],witness:witness.slice()};}
function setup(){const before=initial(),j=step(before,J),phase=S.advanceNotches(before.board,j,S.notchPattern(before.board));assert.equal(phase.valid,true);return{before,j,phase:phase.pattern};}
function tuck(board,notches){return S.geometry(board,notches?{notches}:{}).center.completions.find(c=>c.piece==='Z'&&c.access==='hypothetical-spawn-right-tuck');}
function setCell(board,x,y,value){return board.map((row,i)=>i===y?row.slice(0,x)+value+row.slice(x+1):row);}

test('center JZ: both literal orders reach the same full colored canonical block',()=>{
 const {before,j,phase}=setup(),z=step(j.state,Z),reverse=initial(['Z','J']);
 const firstZ=step(reverse,['R','CW','HD']),lastJ=step(firstZ.state,J);
 assert.deepEqual(z.state.board,lastJ.state.board);
 assert.equal(j.event.lines,0);assert.equal(z.event.lines,0);
 const center=S.geometry(j.state.board,{notches:phase}).center;
 assert.equal(center.motif,'##./#../#..');assert.equal(center.foundation.status,'aligned');
 assert.equal(center.patternSupport,'reference-supported');assert.equal(center.status,'supported-partner-completion');
 assert.equal(P.ordinaryCenterEligible(before,j),true);assert.equal(P.ordinaryCenterEligible(j.state,z,phase),true);
 const c=tuck(j.state.board,phase);assert.ok(c);assert.deepEqual(c.cells,z.event.cells);assert.equal(c.resultStatus,'level');
 assert.equal(S.centerPairCompletion('J',c),true);
 assert.equal(S.centerPairCompletion('J',{...c,access:'hypothetical-spawn-straight-drop'}),false);
 assert.equal(S.centerPairCompletion('Z',{piece:'J',access:'hypothetical-spawn-straight-drop'}),true);
 const hypothetical=step(R.createState({board:j.state.board,active:'Z',canHold:false}),c.witness);
 assert.deepEqual(hypothetical.event,z.event);assert.equal(S.advanceNotches(j.state.board,hypothetical,phase).valid,true);
 const endpoint=S.geometry(z.state.board).center;assert.equal(endpoint.motif,'###/###/##.');assert.equal(endpoint.foundation.status,'aligned');
 const facts=S.transition(before,j,S.assess(j.state,{notches:phase}));
 assert.equal(facts.pairFamily,'ZJ');assert.deepEqual(facts.pairProgress.orderedPieces,['J','Z']);
 assert.equal(S.CENTER_PAIRS.J,'Z');assert.equal(S.centerPairFamily('J'),'ZJ');assert.equal(S.centerPairFamily('Z'),'ZJ');
 for(const [a,b]of [['S','L'],['L','O'],['O','J']])assert.equal(S.centerPairFamily(a,b),a+b);
 assert.doesNotMatch(S.assess(j.state).obligations.find(o=>o.kind==='center-partner').note,/straight.drop/i);
});

test('center JZ: specialized support fails closed on damage, wrong phase, and blocked access',()=>{
 const {j,phase}=setup(),board=j.state.board,c=tuck(board,phase);assert.ok(c);
 const top=board.findIndex(row=>row.slice(4,7)!=='...');
 const cases=[
  ['malformed partial',setCell(board,5,top,'.')],
  ['missing lower foundation',setCell(board,4,top+4,'.')],
  ['filled reserved lower-right notch',setCell(board,6,top+2,'X')],
  ['blocked right tuck corridor',setCell(board,7,top+1,'X')],
  ['blocked hypothetical spawn',setCell(board,4,18,'X')]
 ];
 for(const [label,b]of cases){assert.equal(tuck(b,phase),undefined,label);if(label!=='malformed partial')assert.notEqual(S.geometry(b,{notches:phase}).center.patternSupport,'reference-supported',label);}
 for(const status of ['unanchored','broken'])assert.equal(tuck(board,{...phase,status}),undefined,status);
 const shifted={...phase,anchorRow:phase.anchorRow-1,protectedRows:phase.protectedRows.map(y=>y-1).filter(y=>y>=0)};
 assert.equal(tuck(board,shifted),undefined);
 assert.ok(tuck(board,phase),'a failed phase check must not poison the normal cached result');
});

test('center JZ: height-relative witnesses follow the established notch rather than absolute row modulo',()=>{
 // Independently constructed phase-aligned bases, not assertions that any
 // particular prior clear occurred. Heights include all three modulo classes.
 for(const base of [3,4,5,9]){
  let board=R.emptyBoard();const anchor=39-base;
  for(let y=anchor+1;y<40;y++)for(const x of [4,5,6,8])board=setCell(board,x,y,'X');
  board=setCell(setCell(board,9,anchor,'Z'),9,anchor+1,'Z');
  const before=R.createState({board,active:'J',queue:['Z'],canHold:false}),j=step(before,J);
  const phase=S.advanceNotches(before.board,j,S.notchPattern(before.board));assert.equal(phase.valid,true);
  assert.equal(phase.pattern.anchorRow,anchor);
  const c=tuck(j.state.board,phase.pattern);assert.ok(c,'base height '+base);
  const z=step(j.state,c.witness);assert.equal(S.advanceNotches(j.state.board,z,phase.pattern).valid,true);
  assert.deepEqual(S.geometry(z.state.board,{notches:phase.pattern}).center.profile,[base+3,base+3,base+3]);
  assert.equal(P.ordinaryCenterEligible(before,j),true);
 }
});

test('center JZ: recorded exact witnesses preserve actual pose and HOLD semantics',()=>{
 const {j}=setup(),c=tuck(j.state.board);assert.ok(c);
 const moved=R.move(j.state,'R'),real=step(moved,['R','CW',...Array(7).fill('SD'),'L','HD']);
 assert.deepEqual(real.event.cells,c.cells);
 const held=R.createState({board:j.state.board,active:'I',hold:'Z',queue:['O'],canHold:true});
 const fromHold=step(held,['HOLD',...c.witness]);assert.deepEqual(fromHold.event.cells,c.cells);assert.equal(fromHold.state.hold,'I');
 const replay=R.replay(held,clone(fromHold.witness));assert.equal(replay.valid,true);assert.deepEqual(replay.events,[fromHold.event]);
 const unavailable=R.createState({...held,rules:R.LEGACY_PROFILE.id,canHold:false}),bad=R.replay(unavailable,fromHold.witness);
 assert.ok(!bad.valid||bad.events.length!==1||JSON.stringify(bad.events[0])!==JSON.stringify(fromHold.event),'saved inputs cannot grant a disallowed HOLD');
});

test('center JZ: current identities close the canonical pair without granting Extra Z',()=>{
 let state=initial(),history=Current.start(state),effects=[];
 const start=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)})),jId=start.instances.active.id,zId=start.instances.queue[0].id;
 function act(action){const before=state,next=R.move(before,action),result=Current.applyActual(history,{before,action,after:next});history=result.context;effects.push(...result.effects);state=next;assert.equal(history.status,'available');}
 J.forEach(act);
 const pending=history.state.center.pending.find(p=>p.family==='ZJ');assert.ok(pending);assert.equal(pending.rootId,jId);assert.equal(pending.alternatives[0].piece,'Z');
 Z.forEach(act);
 const observed=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));
 assert.ok(effects.some(p=>p.domain==='center'&&p.family==='ZJ'&&p.rootId===jId&&p.partnerId===zId&&p.status==='fulfilled'));
 assert.equal(observed.center.pending.length,0);assert.equal(observed.extraZ.status,'unknown');
 assert.equal(effects.filter(p=>p.domain==='center'&&p.family==='ZJ'&&p.status==='fulfilled').length,1,'One actual completion emits one payment, not a duplicate cumulative ledger');
});

test('center JZ: resource projection charges the finishing Z independently of geometry',()=>{
 const {before,j}=setup(),z=step(j.state,Z);
 // Explicit unit inputs exercise the resource-state machine, not authenticated
 // planner authorization. The imported real-history test above remains unknown.
 for(const status of ['available','used','unknown']){
  const root=M.start(before,allowanceFixture(before,status==='available'?1:status==='used'?0:null),{extendForced:false}),pending=M.step(before,j,root);
  assert.equal(pending.pendingCenter.length,1);assert.equal(pending.pendingCenter[0].family,'ZJ');assert.equal(pending.pendingCenter[0].rootId,root.active.id);
  const done=M.step(j.state,z,pending);assert.equal(done.pendingCenter.length,0);
  assert.equal(done.violations.includes('extra-Z-not-available'),status!=='available');
  if(status==='available')assert.equal(done.extraZ,'used');
 }
 const imported=CurrentProvider.facts(CurrentProvider.prepare(before,{obligationContext:Current.exportState(Current.start(before))}));assert.equal(M.checkPath(before,[j,z],Current.start(before)).reason,'extra-Z-not-available');
});

test('center JZ: covered cells remain exact stage obligations until the Z repairs them',()=>{
 const {before,j,phase}=setup(),z=step(j.state,Z),c=tuck(j.state.board,phase);
 const created=A.newlyCovered(before.board,j.state.board,j.event,phase);assert.ok(created.length);
 assert.ok(created.every(a=>c.cells.some(b=>JSON.stringify(a)===JSON.stringify(b))));
 const partial=A.repairPrefix(before,[j]);assert.equal(partial.valid,true);assert.equal(partial.status,'defined-Center-partner-stage');assert.equal(partial.stage.piece,'Z');assert.equal(partial.stage.arrival,'not-established');
 assert.deepEqual(partial.outstandingCells,created);
 const finished=A.repairPrefix(before,[j,z]);assert.equal(finished.valid,true);assert.deepEqual(finished.outstandingCells,[]);
 const reservation=P.centerReservationStep(j.state,z);assert.equal(reservation.completed.length,1);assert.deepEqual(reservation.completed[0].cells,c.cells);
 const diversion=step(j.state,['R','R','R','R','CW','HD']);
 assert.ok(P.centerReservationStep(j.state,diversion).debt.length,'a legal Z elsewhere must not satisfy the exact Center obligation');
});

test('center JZ: authenticated Extra-Z history admits and retains the real two-lock obligation',()=>{
 const B=require('../st-bag'),fixture=require('./support/st-resource-trial-1.json');
 let state=R.createState(fixture.initial),history=Current.start(state,{fresh:true}),locks=0,effects=[];
 // Replay the existing public transcript through lock 20, including only the
 // reveals that actually occurred. No altered board, bag, supply or allowance.
 for(const input of fixture.steps){
  const before=state;let next=R.move(before,input.action);
  for(const piece of input.revealed||[])next={...next,queue:[...next.queue,piece],...(next.bag?{bag:B.consume(next.bag,piece)}:{})};
  history=Current.applyActual(history,{before:before,action:input.action,after:next}).context;state=next;
  if(input.action==='HD'&&++locks===20)break;
 }
 const root=state,summary=CurrentProvider.facts(CurrentProvider.prepare(root,{obligationContext:Current.exportState(history)}));
 assert.equal(summary.status,'available');assert.equal(summary.extraZ.status,'available');
 assert.equal(root.active.type,'Z');assert.equal(root.hold,'J');assert.equal(S.geometry(root.board).right.shapeStatus,'staggered-scoring-wall');
 const j=step(root,['HOLD',...J]),completion=tuck(j.state.board);assert.ok(completion);
 const z=step(j.state,['HOLD',...completion.witness]);
 const steps=[j,z].map(p=>({witness:p.witness,event:p.event,target:p.event.target,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length}));
 const options=()=>({obligationContext:Current.exportState(history),maxNodes:45000,now:()=>0,deadline:Infinity});
 // This is a literal candidate for the production verifier, not fabricated
 // admission evidence or a claim about unrestricted fresh-choice preference.
 const candidate={...steps[0],context:JSON.stringify([root.rules,root.board,root.hold,root.canHold,root.queue,root.bag??null,root.active.type]),continuation:steps,evidence:{},metrics:{}};
 let advice=P.revalidate(root,candidate,options());assert.ok(advice,'full policy revalidation with actual known resource history');
 assert.equal(advice.evidence.resourceObligations.status,'checked');assert.ok(advice.evidence.coveredRepairPlan);
 advice=P.revalidate(root,clone(advice),options());assert.ok(advice,'serialized evidence is replayed, not trusted');
 assert.equal(P.revalidate(root,clone(advice),{...options(),obligationContext:undefined}),null,'the same geometry cannot invent missing Extra-Z authority');
 const old=advice;
 for(const action of old.witness){const before=state;state=R.move(state,action);const result=Current.applyActual(history,{before,action,after:state});history=result.context;effects.push(...result.effects);}
 const pending=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.equal(pending.extraZ.status,'available');assert.ok(pending.center.pending.some(p=>p.family==='ZJ'));
 advice=P.continueCommitment(root,state,old,state.lastEvent,options());assert.ok(advice,'the J-first covered-cell commitment survives the real lock');
 assert.equal(advice.continuation.length,1);assert.equal(advice.target.type,'Z');
 for(const action of advice.witness){const before=state;state=R.move(state,action);const result=Current.applyActual(history,{before,action,after:state});history=result.context;effects.push(...result.effects);}
 const finished=CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));assert.equal(finished.extraZ.status,'used');assert.equal(finished.extraZ.remaining,0);
 assert.equal(finished.center.pending.length,0);assert.deepEqual(finished.coveredRepair.cells,[]);
 assert.ok(effects.some(p=>p.domain==='center'&&p.status==='fulfilled'&&p.family==='ZJ'&&p.rootId===summary.instances.hold.id&&p.partnerId===summary.instances.active.id));
});
