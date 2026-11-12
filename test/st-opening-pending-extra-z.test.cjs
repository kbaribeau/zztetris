'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),C=require('../st-obligation-context'),Provider=require('../st-resource-provider');
const player=require('./support/current-player.cjs'),fixture=require('./fixtures/opening-pending-extra-z.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const options={openingPhase:true,obligationContext:fixture.obligationContext,width:8,depth:3,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
function start(){return player(fixture.position,{snapshot:fixture.obligationContext});}
function oldPath(){const a=start();return fixture.witnesses.map(witness=>{a.lock(witness);return{witness,event:copy(a.position.lastEvent)};});}
test('opening pending extra Z: manual early spend preserves opening duty and settles to an exhausted balance',()=>{
 const a=start(),before=C.resolve(a.context,{position:a.position});
 assert.equal(before.extraZ.remaining,null);assert.equal(before.qualityPending,true);assert.equal(before.hangingL.status,'hanging');
 a.lock(fixture.witnesses[0]);assert.equal(a.context.status,'available');assert.equal(a.state.account.z.uncredited,1);assert.equal(a.state.account.opening.kind,'quality');
 for(const w of fixture.witnesses.slice(1))a.lock(w);
 assert.equal(C.resolve(a.context,{position:a.position}).hangingL.status,'none-observed');assert.equal(a.state.account.z.remaining,0);assert.equal(C.resolve(a.context,{position:a.position}).extraZ.status,'used');
 const checked=Provider.checkOpeningZPrefix(Provider.prepare(fixture.position,options),oldPath(),options);
 assert.equal(checked.valid,false);assert.equal(checked.reason,'opening-extra-Z-before-baseline');
});
test('opening pending extra Z: actual planner resolves held L before spending and leaves root untouched',()=>{
 const initial=JSON.stringify(fixture),result=P.decide(fixture.position,options);
 assert.ok(result.target);assert.equal(result.target.type,'L');assert.ok(result.metrics.nodes<=45000);assert.ok(result.metrics.openingAllocation.zRejected>0);
 const a=start();let paid=false;
 for(const step of result.continuation){
  if(step.event.type==='Z'&&step.event.cells.every(([x])=>x<7)){assert.equal(a.state.account.z.remaining,1);paid=true;}
  a.lock(step.witness);assert.equal(a.context.status,'available');assert.deepEqual(a.position.lastEvent,step.event);
 }
 assert.equal(paid,true);assert.equal(a.state.account.z.remaining,0);assert.equal(C.resolve(a.context,{position:a.position}).extraZ.status,'used');assert.equal(JSON.stringify(fixture),initial);
});
test('opening pending extra Z: mandatory Z still allowed, unknown origin unchanged, and work remains bounded',()=>{
 const path=oldPath(),raw=copy(fixture.obligationContext);raw.state.account.mandatoryZ=true;
 const mandatory=Provider.prepare(fixture.position,{obligationContext:raw});assert.equal(mandatory.status,'available');
 assert.equal(Provider.checkOpeningZPrefix(mandatory,path,options).valid,true);
 const unknown=Provider.prepare(fixture.position);assert.equal(Provider.checkOpeningZPrefix(unknown,path,options).valid,true);
 const advice=P.decide(fixture.position,options),input=Provider.prepare(fixture.position,options);
 const limited=Provider.checkOpeningZPrefix(input,advice.continuation,{maxNodes:0,now:()=>0,deadline:Infinity});assert.equal(limited.valid,false);assert.equal(limited.reason,'opening-Z-check-budget');assert.equal(limited.visited,0);
 const deadline=Provider.checkOpeningZPrefix(input,advice.continuation,{now:()=>1,deadline:1});assert.equal(deadline.valid,false);assert.equal(deadline.visited,0);
});
test('opening pending extra Z: fresh Worker and small request budget cannot emit the saved premature spend',()=>{
 const worker=require('./support/st-fixed-clock-worker.cjs');
 const result=worker({type:'plan',id:1,observation:P.observe(fixture.position),previous:null,commitment:null,options:{openingPhase:true,obligationContext:fixture.obligationContext,width:8,depth:3,maxNodes:45000,timeMs:1500}});
 assert.equal(result.target.type,'L');assert.ok(result.metrics.nodes<=45000);
 const input=Provider.prepare(fixture.position,options);
 assert.equal(Provider.checkOpeningZPrefix(input,result.continuation,options).valid,true);
 const small=P.decide(fixture.position,{...options,maxNodes:100});
 assert.ok(small.metrics.nodes<=100);if(small.target)assert.equal(Provider.checkOpeningZPrefix(input,small.continuation,options).valid,true);
});
test('opening pending extra Z: exact debt survives JSON, projections, handoff, monitoring and Undo',()=>{
 const Tracking=require('../st-obligation-tracking'),Inverse=require('../st-obligation-inverse');
 const a=start(),original=copy(a.context),monitor=Tracking.create(),issues=[];monitor.subscribe(e=>issues.push(e));
 const session=Inverse.start(a.context),receipts=[];
 const frame=()=>({status:a.context.status,reason:a.context.reason,state:a.state,view:C.resolve(a.context,{position:a.position})});
 for(const witness of fixture.witnesses){
  const beforeTurn=a.context,position=copy(a.position);
  for(const action of witness){const before=frame(),r=a.act(action);if(r.receipt.accepted)monitor.transition(before,frame(),{effects:r.effects,operation:action==='HD'?{kind:'lock',piece:r.receipt.locked,event:a.position.lastEvent}:{kind:'observe'}});}
  receipts.push({position,receipt:Inverse.record(session,{before:beforeTurn,after:a.context,piece:a.last.receipt.locked}).receipt});
  const restored=C.importState(copy(a.context),{position:a.position});assert.deepEqual(restored,a.context);
  const projection=Provider.prepare(a.position,{obligationContext:restored});assert.deepEqual(Provider.projectHandoff(projection.frame).state.account.z,a.state.account.z);
 }
 assert.deepEqual(issues,[]);assert.equal(a.state.account.z.remaining,0);
 let current=a.context;
 for(const {receipt,position} of receipts.reverse())current=Inverse.undo(session,current,{receipt,piece:receipt.piece,requestEpoch:Inverse.status(session).requestEpoch+1,restore:raw=>C.importState(raw,{position})}).state;
 assert.deepEqual(current,original);
 const replay=player(fixture.position,{snapshot:current});for(const w of fixture.witnesses)replay.lock(w);assert.equal(replay.state.account.z.remaining,0);
});
test('opening pending extra Z: repeated early spends are exact, never clamped or minted as unused credit',()=>{
 // Trusted current counter isolates settlement arithmetic, not a fabricated move history.
 const raw=copy(fixture.obligationContext);raw.state.account.z.uncredited=2;
 const a=player(fixture.position,{snapshot:raw});a.lock(fixture.witnesses[0]);assert.equal(a.state.account.z.uncredited,3);assert.equal(a.state.account.opening.kind,'quality');
 for(const w of fixture.witnesses.slice(1))a.lock(w);
 assert.equal(a.state.account.z.remaining,-2);assert.equal(a.state.account.z.uncredited,'none');assert.equal(C.resolve(a.context,{position:a.position}).extraZ.status,'out-of-profile');
 const legacy=copy(raw);legacy.state.account.z.uncredited='multiple';assert.throws(()=>C.importState(legacy,{position:fixture.position}),/quality/);
 const unknown=player(fixture.position,{fresh:false});for(const w of fixture.witnesses)unknown.lock(w);assert.equal(unknown.state.account.z.remaining,null);
});
test('opening pending extra Z: simultaneous debit and settlement credits once; ambiguous legacy count cannot pass monitoring',()=>{
 const O=require('../st-opening-obligations'),Tracking=require('../st-obligation-tracking');
 const a=start();for(const w of fixture.witnesses)a.lock(w);
 const current=copy(fixture.obligationContext.state.account);current.opening.imbalance=0;
 const event=oldPath()[0].event,operation={kind:'lock',piece:{id:22,type:'Z',bag:3},event,centerEffects:[]};
 const context={before:{board:a.position.board},after:{board:a.position.board,topOut:false,center:{pending:[],debt:[]},sl:{hangingS:{status:'none-observed'},hangingL:{status:'none-observed'}},coveredCells:[]}};
 const settled=O.transition(current,operation,context);assert.equal(settled.state.z.remaining,0);assert.equal(settled.effects.filter(e=>e.status==='baseline-established').length,1);
 const again=O.transition(settled.state,{...operation,piece:{id:23,type:'J',bag:3},event:{...oldPath()[1].event}},context);assert.equal(again.state.z.remaining,0);assert.equal(again.effects.some(e=>e.status==='baseline-established'),false);
 const b=copy(fixture.obligationContext.state);b.account={...current,qualityCandidate:false,opening:null,z:{remaining:null,uncredited:'multiple'}};
 const after=copy(b);after.account=settled.state;
 const frame=state=>({status:'available',reason:null,state,view:C.resolve(C.importState({...copy(fixture.obligationContext),state},{position:fixture.position}),{position:fixture.position})});
 const monitor=Tracking.create(),issues=[];monitor.subscribe(e=>issues.push(e));
 monitor.transition(frame(b),frame(after),{operation,effects:settled.effects.map(e=>({...e,domain:'account'}))});assert.ok(issues.some(e=>e.code==='effect-mismatch'));
});
