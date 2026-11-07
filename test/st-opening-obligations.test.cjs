'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const O=require('../st-opening-obligations'),R=require('../st-rules');
const opening=require('./fixtures/opening-z-allocation.json'),copy=x=>JSON.parse(JSON.stringify(x));
const empty=()=>Array(40).fill('..........'),clearSL=()=>({hangingS:{status:'none-observed'},hangingL:{status:'none-observed'}});
// Exercise the actual coupled current controller. Component-only cases below
// keep literal independently specified account transactions and outcomes.
function replay(origin,{snapshot}={}){
 const x=require('./support/current-player.cjs')(origin,{snapshot});
 const result=()=>({state:x.state.account,effects:x.last?.effects||[]});
 return{act(action,revealed=[]){x.act(action,revealed);return result();},lock(actions){x.lock(actions);return result();},begin(){x.begin();return result();},handoff(){x.handoff();return result();},compare(){return O.resolve(x.state.account,{board:x.position.board});},get state(){return x.state.account;},get position(){return x.position;},get inventory(){return x.inventory;},get last(){return result();},get locks(){return x.locks;}};
}
function recorded(){return replay(opening.request.observation,{snapshot:opening.request.options.obligationContext});}
function trial(number=1,until=Infinity){const fixture=require('./support/st-resource-trial-'+number+'.json'),x=replay(fixture.initial);for(const step of fixture.steps){if(x.locks>=until)break;x.act(step.action,step.revealed);}return x;}
function established(balance=0){const state=O.start({known:true});Object.assign(state,{firstTsd:true,allocationVerified:true,opening:null});state.profile.before=null;state.profile.capEstablished=true;state.z.remaining=balance;return O.importState(state);}
const poses={T:[[0,38],[1,38],[2,38],[1,39]],Z:[[0,38],[1,38],[1,39],[2,39]],J:[[0,38],[0,39],[1,39],[2,39]],S:[[1,38],[2,38],[0,39],[1,39]],L:[[2,38],[0,39],[1,39],[2,39]]};
// Literal component transactions isolate facts already checked by the caller.
// They do not claim a legal route, seven-bag supply or strategic Reset choice.
function lock(state,type,id,{bag=0,event={},before=empty(),after=empty(),center={pending:[],debt:[]},centerEffects=[],sl=clearSL(),coveredCells=[],topOut=false}={}){
 const e={type,cells:copy(poses[type]||poses.J),lines:0,spin:'none',clearedRows:[],topOut:false,...event};
 return O.transition(state,{kind:'lock',piece:{type,id,bag},event:e,centerEffects},{before:{board:before},after:{board:after,topOut,center,sl,coveredCells}});
}

test('opening accounts: three retained trials preserve literal lock totals and current account endpoints',()=>{
 // Frozen account outcomes from the retained source trials. The first spends
 // its one allowance, the second keeps it, and the fifth never earns one.
 for(const [n,status,remaining,allocation,profileLost]of [[1,'used',0,'verified-first-tsd',false],[2,'available',1,'verified-first-tsd',false],[5,'unknown',null,'out-of-profile',true]]){
  const x=trial(n),facts=x.compare();assert.equal(x.locks,32);assert.equal(facts.firstTsd,true);
  assert.deepEqual(facts.extraZ,{status,baseline:remaining!==null,remaining});
  assert.equal(facts.openingAllocation.status,allocation);assert.equal(facts.profileLost,profileLost);
  assert.equal(x.state.opening,null);assert.equal(x.state.profile.before,null);assert.deepEqual(facts.reset,{status:'inactive',progress:0});
 }
});
test('opening accounts: pre-clear quality grants once and retires all temporary opening predicates',()=>{
 const a=trial(1,15);assert.equal(a.state.z.remaining,1);assert.equal(a.state.opening,null);assert.equal(a.state.profile.before,null);assert.equal(a.state.mandatoryZ,false);assert.ok(a.last.effects.some(e=>e.status==='baseline-established'));
 const before=O.exportState(a.state);a.act('HOLD');assert.deepEqual(a.state,before);
});
test('opening accounts: real delayed quality waits for actual Center and S/L resolution',()=>{
 const a=recorded();for(const i of [0,1])a.lock(opening.steps[i].witness);
 assert.equal(a.state.opening.kind,'quality');assert.equal(a.state.z.remaining,null);assert.equal(a.state.mandatoryZ,false);
 for(const i of [2,3]){a.lock(opening.steps[i].witness);assert.equal(a.state.z.remaining,null);}
 a.lock(opening.steps[4].witness);assert.equal(a.state.z.remaining,1);assert.equal(a.state.opening,null);assert.equal(a.last.effects.filter(e=>e.status==='baseline-established').length,1);
});
test('opening accounts: Z after first TSD pays the mandatory duty before optional spending',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(opening.steps[1].witness);const unpaid=copy(a.state);
 assert.equal(a.state.mandatoryZ,true);assert.equal(a.compare().openingAllocation.requiredNonRightZ,1);
 a.lock(opening.steps[0].witness.slice(1));assert.equal(a.state.mandatoryZ,false);assert.equal(a.state.z.uncredited,'none');assert.ok(a.last.effects.some(e=>e.status==='opening-Z-paid'));assert.equal(a.state.z.remaining,null);
 a.lock(opening.steps[3].witness);assert.equal(a.state.z.remaining,1);
 a.lock(['HOLD','L','L','CW','HD']);assert.equal(a.state.z.remaining,0);assert.ok(a.last.effects.some(e=>e.status==='optional-Z-debited'));
 assert.equal(unpaid.mandatoryZ,true);assert.deepEqual(O.importState(O.exportState(unpaid)),unpaid,'Undo can keep a separate immutable current snapshot');
});
test('opening accounts: a later real TSD cannot erase the still-unpaid mandatory Z',()=>{
 const a=recorded();for(const action of ['L','L','L'])a.act(action);a.act('HD',['Z']);a.lock(opening.steps[1].witness);
 for(const witness of [opening.steps[2].witness,['L','L','R180','HD'],['L','L','HD'],['L','L','HD'],['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']])a.lock(witness);
 assert.equal(a.position.lastEvent.lines,2);assert.equal(a.state.mandatoryZ,true);assert.equal(a.state.z.uncredited,'none');
 a.lock(['HOLD',...opening.steps[0].witness.slice(1)]);assert.equal(a.state.mandatoryZ,false);assert.equal(a.state.z.uncredited,'none');assert.equal(a.state.z.remaining,null);
});
test('opening accounts: noncanonical Z clear is a debit, not payment, and cannot erase mandatory work',()=>{
 const a=recorded();a.lock(['L','L','L','HD']);a.lock(opening.steps[1].witness);
 const bad=lock(a.state,'Z',100,{event:{lines:1,clearedRows:[39]}});
 assert.equal(bad.state.mandatoryZ,true);assert.equal(bad.state.z.uncredited,'one');assert.equal(bad.state.opening,null);assert.equal(O.resolve(bad.state).openingAllocation.status,'out-of-profile');assert.ok(bad.effects.some(e=>e.status==='optional-Z-debited'));
 const paid=lock(bad.state,'Z',101);assert.equal(paid.state.mandatoryZ,false);assert.equal(paid.state.z.uncredited,'one');assert.equal(paid.state.z.remaining,null);assert.equal(O.resolve(paid.state).openingAllocation.status,'verified-first-tsd');assert.ok(paid.effects.some(e=>e.status==='opening-Z-paid'));
});
test('opening accounts: optional Z permanently retires delayed quality but not verified allocation',()=>{
 const a=recorded();for(const i of [0,1])a.lock(opening.steps[i].witness);a.lock(['L','L','CW','HD']);
 assert.equal(a.state.opening,null);assert.equal(a.state.z.uncredited,'one');assert.ok(a.last.effects.some(e=>e.status==='quality-disqualified'));
 for(const i of [3,4])a.lock(opening.steps[i].witness);assert.equal(a.state.z.remaining,null);assert.equal(a.compare().openingAllocation.status,'verified-first-tsd');
});
test('opening accounts: actual diverted Center debt invalidation cannot become delayed quality',()=>{
 const a=recorded();for(const i of [0,1,2])a.lock(opening.steps[i].witness);a.lock(['L','L','L','HD']);assert.equal(a.state.opening.kind,'quality');
 a.lock(['CW','R','HD']);assert.equal(a.state.opening,null);assert.ok(a.last.effects.some(e=>e.status==='quality-disqualified'&&e.reason==='invalidated-Center-debt'));
 a.lock(['HOLD','L','L','L','HD']);assert.equal(a.state.z.remaining,null);assert.equal(a.compare().openingAllocation.status,'verified-first-tsd');
});
test('opening accounts: current quality blockers can resolve, but a T departure cannot',()=>{
 const waiting=established();waiting.z.remaining=null;waiting.opening={kind:'quality',imbalance:0};waiting.qualityCandidate=true;
 for(const blocker of [{center:{pending:[{id:'live'}],debt:[]}},{center:{pending:[],debt:[{id:'diverted'}]}},{sl:{hangingS:{status:'hanging'},hangingL:{status:'none-observed'}}},{sl:{hangingS:{status:'none-observed'},hangingL:{status:'unknown'}}}]){
  const blocked=lock(waiting,'J',1,blocker);assert.equal(blocked.state.z.remaining,null);assert.equal(blocked.state.opening.kind,'quality');assert.equal(lock(blocked.state,'J',2).state.z.remaining,1);
 }
 const unbalanced=copy(waiting);unbalanced.opening.imbalance=1;assert.equal(lock(unbalanced,'J',1).state.z.remaining,null);assert.equal(lock(unbalanced,'L',2).state.z.remaining,1);
 const departed=lock(waiting,'T',1);assert.equal(departed.state.opening,null);assert.equal(departed.state.profile.departure,true);assert.equal(lock(departed.state,'J',2).state.z.remaining,null);
});
test('opening accounts: pre-clear quality and delayed quality have distinct Center invalidation rules',()=>{
 const before=trial(1,14),after=trial(1,15),event=after.position.lastEvent,piece=before.inventory.active;
 assert.equal(before.state.profile.before.checkpoint,true);assert.equal(event.lines,2);
 const supplied={event,before:before.position.board,after:after.position.board,center:{pending:[{id:'live'}],debt:[]},centerEffects:[{status:'debt-invalidated'}],sl:{hangingS:{status:'hanging'},hangingL:{status:'unknown'}}};
 const immediate=lock(before.state,'T',piece.id,{...supplied,bag:piece.bag});assert.equal(immediate.state.z.remaining,1,'Recorded pre-clear quality is sufficient for immediate allowance');
 const delayed=copy(before.state);delayed.profile.before.checkpoint=false;
 const invalidated=lock(delayed,'T',piece.id,{...supplied,bag:piece.bag});assert.equal(invalidated.state.allocationVerified,true);assert.equal(invalidated.state.z.remaining,null);assert.equal(invalidated.state.opening,null);assert.ok(invalidated.effects.some(e=>e.reason==='invalidated-Center-debt'));
});
test('opening accounts: pre-first overuse retires at first TSD, but checkpoint violation is permanent',()=>{
 const score={cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'};
 let unreviewed=O.start({known:true});unreviewed.profile.before.t=2;
 unreviewed=lock(unreviewed,'T',1).state;assert.equal(O.profileLost(unreviewed),true);assert.equal(unreviewed.opening,null);
 unreviewed=lock(unreviewed,'T',2,{event:score}).state;assert.equal(O.profileLost(unreviewed),false);assert.equal(O.resolve(unreviewed).openingAllocation.status,'out-of-profile');assert.equal(unreviewed.z.remaining,null);
 let reviewed=trial(1,14).state;
 reviewed=lock(reviewed,'Z',100,{event:{cells:[[9,36],[8,37],[9,37],[8,38]]}}).state;
 assert.equal(reviewed.opening,null,'Second Right Z makes allocation ineligible');assert.equal(reviewed.profile.before.checkpoint,true,'Its existing non-Right overuse penalty is still current');
 reviewed=lock(reviewed,'T',101).state;assert.equal(reviewed.profile.violation,true);reviewed=lock(reviewed,'T',102,{event:score}).state;assert.equal(O.profileLost(reviewed),true);assert.equal(reviewed.profile.before,null);
});
test('opening accounts: current cap geometry cannot replace a lost original cap target',()=>{
 const before=trial(1,14),after=trial(1,15),event=after.position.lastEvent,piece=before.inventory.active;
 const altered=copy(before.state);altered.opening.roof=[[9,0],[9,1]];
 const rejected=lock(altered,'T',piece.id,{bag:piece.bag,event,before:before.position.board,after:after.position.board});
 assert.equal(O.predicates.cap(before.position.board),true);assert.equal(rejected.state.firstTsd,true);assert.equal(rejected.state.allocationVerified,false);assert.equal(rejected.state.z.remaining,null);
});
test('opening accounts: real Reset credits one per actual T and no bonus on completion',()=>{
 const a=trial(1,24);assert.equal(a.state.z.remaining,0);a.begin();const saved=copy(a.state);a.act('HOLD');a.act('HOLD');assert.deepEqual(a.state,saved);
 a.lock(['L','L','L','HD']);assert.equal(a.state.reset.remaining,1);assert.equal(a.state.z.remaining,1);assert.equal(a.compare().extraZ.status,'used');
 for(let i=0;i<4;i++)a.lock(['HD']);assert.equal(a.state.z.remaining,0);
 a.lock(['L','L','L','HD']);assert.deepEqual(a.state.reset,{status:'inactive'});assert.equal(a.state.z.remaining,1);assert.equal(a.last.effects.filter(e=>e.delta===1).length,1);assert.ok(a.last.effects.some(e=>e.status==='reset-completed'));
});
test('opening accounts: real Right Z during Reset is not an optional debit',()=>{
 const a=trial(1,24);a.begin();a.lock(['L','L','L','HD']);for(let i=0;i<3;i++)a.lock(['HD']);a.lock(['CW','R','R','R','R','HD']);assert.equal(a.state.z.remaining,1);
 a.lock(['L','L','L','HD']);assert.equal(a.state.z.remaining,2);assert.equal(a.state.reset.status,'inactive');
});
test('opening accounts: actual completed Reset can be spent and entered again without an episode archive',()=>{
 const f=require('./support/st-reset-live-cycle.json'),a=replay(f.initial,{snapshot:f.obligationContext});a.begin();
 for(const step of f.steps)for(const action of step.actions)a.act(action.action,action.revealed);
 assert.equal(a.state.z.remaining,2);assert.deepEqual(a.state.reset,{status:'inactive'});
 const continuation=[
  [['CW','L','L','HD'],'Z'],[['CW','L','L','L','L','HD'],'I'],
  [['L','L','HD'],'J'],[['CW','L','L','HD'],'L'],[['R','HD'],'S'],
  [['L','L','L','L','HD'],'Z'],[['HOLD','R180','L','L','L','HD'],'T'],[['R','HD'],'I'],
 ];
 for(const [witness,revealed]of continuation)for(const action of witness)a.act(action,action==='HD'?[revealed]:[]);
 assert.equal(a.state.z.remaining,0);const begun=a.begin();assert.equal(begun.state.z.remaining,0);assert.equal(begun.state.reset.remaining,2);assert.equal(begun.state.reset.firstTId,null);
});
test('opening accounts: Reset overspend and a non-Left or scoring T invalidate without repair',()=>{
 const a=trial(1,24);a.begin();a.act('HOLD');for(let i=0;i<5;i++)a.lock(['HD']);assert.equal(a.state.z.remaining,-1);assert.equal(a.state.reset.status,'invalid');a.lock(['L','L','L','HD']);assert.equal(a.state.z.remaining,-1);
 const b=trial(1,24);b.begin();b.lock(['HD']);assert.equal(b.state.reset.status,'invalid');assert.equal(b.state.z.remaining,0);
 const c=trial(1,24);c.begin();const f=require('./support/st-resource-trial-1.json');let locks=0;for(const s of f.steps){if(locks===24)c.act(s.action,s.revealed);if(s.action==='HD')locks++;if(locks===25)break;}assert.equal(c.position.lastEvent.lines,2);assert.equal(c.state.z.remaining,0);assert.equal(c.state.reset.status,'invalid');
});
test('opening accounts: current Reset rejects duplicate T and unknown bag without retaining paid lists',()=>{
 const initial=O.beginReset(established(),{candidate:true}).state,one=lock(initial,'T',91,{bag:18}).state;
 assert.equal(one.z.remaining,1);assert.equal(one.reset.firstTId,91);assert.equal(one.reset.remaining,1);
 const duplicate=lock(one,'T',91,{bag:18});assert.equal(duplicate.state.z.remaining,1);assert.equal(duplicate.state.reset.status,'invalid');assert.equal(duplicate.effects.some(e=>e.status==='reset-T-credited'),false);
 const unknown=lock(initial,'T',92,{bag:null});assert.equal(unknown.state.z.remaining,0);assert.equal(unknown.state.reset.status,'invalid');
 const distinct=lock(one,'T',92,{bag:19});assert.equal(distinct.state.z.remaining,2);assert.deepEqual(distinct.state.reset,{status:'inactive'});
});
test('opening accounts: rejected Reset entry leaves facts unchanged and re-entry is idempotent',()=>{
 for(const [state,candidate] of [[O.start(),true],[established(1),true],[established(),false]]){const result=O.beginReset(state,{candidate});assert.deepEqual(result.state,state);assert.equal(result.effects[0].status,'reset-rejected');}
 const lost=established();lost.profile.departure=true;assert.equal(O.beginReset(lost,{candidate:true}).state.reset.status,'inactive');
 const active=O.beginReset(established(),{candidate:true,inheritedCovered:[[2,38]]}).state;assert.deepEqual(O.beginReset(active,{candidate:true,inheritedCovered:[[3,39]]}),{state:active,effects:[]});
});
test('opening accounts: inherited covered cells are current Reset debt and retire on completion',()=>{
 let state=O.beginReset(established(),{candidate:true,inheritedCovered:[[0,35],[1,36],[2,38]]}).state;
 const quad={type:'I',cells:[[9,36],[9,37],[9,38],[9,39]],lines:4,clearedRows:[36,37,38,39]};
 state=lock(state,'I',1,{event:quad,coveredCells:[[0,39],[3,39]]}).state;assert.deepEqual(state.reset.inheritedCovered,[[0,39]]);
 state=lock(state,'T',2,{coveredCells:[[0,39],[3,39]]}).state;state=lock(state,'T',3,{coveredCells:[[0,39],[3,39]]}).state;assert.deepEqual(state.reset,{status:'inactive'});
});
test('opening accounts: trusted compact imports need structure, not provenance or old identities',()=>{
 const supplied=established(1234),imported=O.importState(JSON.parse(JSON.stringify(supplied)));assert.deepEqual(imported,supplied);assert.equal(O.resolve(imported).extraZ.remaining,1234);supplied.z.remaining=0;assert.equal(imported.z.remaining,1234);
 const active=O.beginReset(established(),{candidate:true}).state,one=lock(active,'T',73001,{bag:10000}).state;
 const portable=O.importState(JSON.parse(JSON.stringify(one)));assert.deepEqual(lock(portable,'T',73002,{bag:10001}).state.z,{remaining:2,uncredited:'none'});
 for(const mutate of [s=>s.schemaVersion=2,s=>s.z.remaining=NaN,s=>s.z.uncredited='invented',s=>s.history=[],s=>s.opening={kind:'quality',imbalance:0,oldBags:[]},s=>s.reset={status:'active',remaining:1,firstTId:null,inheritedCovered:[]},s=>s.reset={status:'active',remaining:2,firstTId:null,inheritedCovered:[[10,40]]}]){const bad=copy(established());mutate(bad);assert.throws(()=>O.importState(bad),TypeError);}
});
test('opening accounts: a fresh realm continues a trusted half-Reset snapshot without replay',()=>{
 const one=lock(O.beginReset(established(),{candidate:true}).state,'T',99).state;
 const file=path.resolve(__dirname,'../st-opening-obligations.js'),box={module:{exports:{}},require:createRequire(file)};vm.runInNewContext(fs.readFileSync(file,'utf8'),box);const fresh=box.module.exports;
 const imported=fresh.importState(JSON.parse(JSON.stringify(O.exportState(one))));
 const e={type:'T',cells:poses.T,lines:0,spin:'none',clearedRows:[],topOut:false};
 const next=fresh.transition(imported,{kind:'lock',piece:{id:101,type:'T',bag:1},event:e,centerEffects:[]},{before:{board:empty()},after:{board:empty(),topOut:false,center:{pending:[],debt:[]},sl:clearSL(),coveredCells:[]}});
 assert.deepEqual(copy(next.state.reset),{status:'inactive'});assert.equal(next.state.z.remaining,2);assert.equal(next.effects.filter(e=>e.status==='reset-T-credited').length,1);
});
test('opening accounts: actual imported X boards and more than four cleared rows remain accepted facts',()=>{
 const board=empty();for(let y=35;y<40;y++)board[y]='XXXXXXXXXX';
 const before=R.createState({board,active:'J',queue:['T']}),after=R.move(before,'HD');assert.deepEqual(R.validate(before),[]);assert.deepEqual(R.validate(after),[]);assert.equal(after.lastEvent.lines,5);
 const result=lock(established(1),'J',1,{event:after.lastEvent,before:before.board,after:after.board,topOut:after.topOut});assert.equal(result.state.profile.violation,true);assert.equal(result.state.profile.departure,true);assert.equal(result.state.z.remaining,1);assert.equal(O.resolve(result.state).extraZ.status,'out-of-profile');
 const unknown=O.start();assert.deepEqual(lock(unknown,'J',1,{event:after.lastEvent,before:before.board,after:after.board,topOut:after.topOut}).state,unknown,'Unknown-origin historical diagnostics are outside the account slice');
 assert.throws(()=>lock(established(),'J',1,{event:{type:5}}),TypeError);
});
test('opening accounts: uncredited spending retains only its policy category, not a growing count',()=>{
 let state=established();state.z.remaining=null;
 state=lock(state,'Z',1).state;assert.equal(state.z.uncredited,'one');assert.equal(O.profileLost(state),false);
 state=lock(state,'Z',2).state;assert.equal(state.z.uncredited,'multiple');assert.equal(O.profileLost(state),true);const expected=copy(state);
 for(let n=3;n<503;n++)state=lock(state,'Z',n).state;assert.deepEqual(state,expected);assert.equal(O.resolve(state).extraZ.status,'unknown');
});
test('opening accounts: equivalent repeated account cycles have identical state and serialized size',()=>{
 let state=established(),expected=copy(state),bytes=JSON.stringify(state).length;
 for(let n=0;n<1200;n++){
  state=O.beginReset(state,{candidate:true}).state;
  state=lock(state,'T',n*4+1,{bag:n*2}).state;state=lock(state,'Z',n*4+2,{bag:n*2}).state;
  state=lock(state,'T',n*4+3,{bag:n*2+1}).state;state=lock(state,'Z',n*4+4,{bag:n*2+1}).state;
  assert.deepEqual(state,expected);assert.equal(JSON.stringify(state).length,bytes);
 }
 // These supplied-lock lifecycle cycles are not a long survival/strategy test.
 assert.equal(state.z.remaining,0);assert.deepEqual(state.reset,{status:'inactive'});
});
test('projected opening accounts: synthetic Reset T uses a separate codec and distinct current subject',()=>{
 const actual=O.beginReset(established(),{candidate:true}).state,root=O.importProjection({...actual,domain:'projection'}),saved=copy(root);
 const project=(state,id,options={})=>{
  const event={type:'T',cells:copy(poses.T),lines:0,spin:'none',clearedRows:[],topOut:false,...options};
  return O.projectTransition(state,{kind:'lock',piece:{id,type:'T',bag:null},event,centerEffects:[]},{before:{board:empty()},after:{board:empty(),topOut:false,center:{pending:[],debt:[]},sl:clearSL(),coveredCells:[]}});
 };
 const one=project(root,-1);assert.equal(one.state.reset.firstTId,-1);assert.equal(one.state.reset.remaining,1);assert.equal(one.state.z.remaining,1);assert.deepEqual(O.importProjection(copy(one.state)),one.state);assert.throws(()=>O.importState(one.state));
 const two=project(one.state,-2);assert.equal(two.state.z.remaining,2);assert.deepEqual(two.state.reset,{status:'inactive'});assert.equal(two.effects.filter(e=>e.status==='reset-completed').length,1);
 const repeated=project(one.state,-1);assert.equal(repeated.state.reset.status,'invalid');assert.equal(repeated.state.z.remaining,1);assert.equal(repeated.effects.some(e=>e.status==='reset-T-credited'),false);
 const notLeft=project(root,-1,{cells:[[4,38],[5,38],[6,38],[5,39]]});assert.equal(notLeft.state.reset.status,'invalid');assert.equal(notLeft.state.z.remaining,0);
 assert.throws(()=>lock(actual,'T',-1,{bag:null}),/locked public identity/);assert.equal(lock(actual,'T',91,{bag:null}).state.reset.status,'invalid');assert.deepEqual(root,saved);
});
