'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const E=require('../st-opening-eligibility'),O=require('../st-opening-obligations'),Q=require('../st-obligation-state'),Context=require('../st-obligation-context'),Projection=require('../st-obligation-projection'),R=require('../st-rules'),H=require('../st-resource-history');
const fixture=require('./fixtures/opening-z-allocation.json'),copy=x=>JSON.parse(JSON.stringify(x));
// These are the exact consumer predicates being migrated, evaluated against
// the unchanged history implementation. Its arrays are only an external oracle.
function legacyPredicates(summary,right){
 const a=summary.openingAllocation;
 const thirdTReady=summary.coverage.status==='complete'&&a.status==='ready-for-first-tsd'&&a.counts.T===2;
 const thirdTComplete=summary.coverage.status==='complete'&&a.status==='verified-first-tsd'&&a.counts.T===3&&a.counts.TNonRight===2&&a.counts.ZNonRight===1;
 const allocationRequired=a.requiredNonRightZ===1&&(a.requiredNonRightT===0||a.firstTsdAt!==null&&a.counts.TNonRight===2)&&['pending','pending-opening-z'].includes(a.status)&&a.counts.T>=2&&['staggered-scoring-wall','cap-preparation'].includes(right);
 const qualityPending=summary.coverage.status==='complete'&&a.status==='verified-first-tsd'&&summary.extraZ.status==='unknown'&&summary.extraZ.baseline===null&&!summary.extraZ.allocations.length&&!summary.extraZ.departures.length&&!summary.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>=a.firstTsdAt);
 const historicalHandoff=summary.coverage.status==='complete'&&a.status==='verified-first-tsd'&&Boolean(summary.extraZ.baseline)&&['available','used'].includes(summary.extraZ.status);
 return{thirdTReady,thirdTComplete,allocationRequired,qualityPending,qualityPendingPartners:qualityPending?copy(summary.center.pending):[],historicalHandoff,mandatoryZPending:a.requiredNonRightZ===1};
}
function compare(account,board,summary){
 for(const right of ['staggered-scoring-wall','cap-preparation','cleared-base',null]){
  const expected=legacyPredicates(summary,right),actual=E.resolve(account,{board,right,center:summary.center});
  assert.deepEqual(actual,expected);assert.deepEqual(E.conservationStep(account,{board}),{safe:expected.thirdTReady||expected.thirdTComplete,fulfilled:expected.thirdTComplete});
 }
}
function replay(origin,{fresh=true}={}){
 let position=R.createState(origin),context=Context.start(position,{fresh}),history=H.start(position,{fresh,inventory:context.inventory}),locks=0;
 const summary=()=>H.resolve(position,history);
 function check(){compare(context.state.account,position.board,summary());}
 function act(action,revealed=[]){const before=position,next=R.move(before,action);assert.notEqual(next,before,'accepted '+action);position={...next,queue:[...next.queue,...revealed]};const result=Context.applyActual(context,{before,action,after:position});assert.equal(result.context.status,'available',result.context.reason);context=result.context;history=H.applyAction(history,before,action,position,{inventoryTransition:result.receipt});if(action==='HD'){locks++;check();}return result;}
 function handoff(){context=Context.handoff(context,{position}).context;history=H.markHandoff(history,position);check();}
 function begin(){context=Context.beginReset(context,{position,candidate:true}).context;history=H.beginReset(history,position);check();}
 function load(tape){const mark=at=>{if(tape.handoffAtAction===at)handoff();if(tape.resetAtActions?.includes(at))begin();};mark(0);tape.steps.forEach((step,i)=>{act(step.action,step.revealed);mark(i+1);});return api;}
 check();const api={act,handoff,begin,load,check,lock(witness){for(const action of witness)act(action);return api;},get position(){return position;},get context(){return context;},get history(){return history;},get summary(){return summary();},get locks(){return locks;},get view(){return E.resolve(context.state.account,{board:position.board,center:context.state.center,right:'cap-preparation'});}};return api;
}
const recorded=()=>replay(fixture.request.options.resourceContext.origin).load(fixture.request.options.resourceContext);
function trial(n,limit=Infinity){const f=require('./support/st-resource-trial-'+n+'.json'),a=replay(f.initial);for(const step of f.steps){if(a.locks>=limit)break;a.act(step.action,step.revealed);}return a;}
// Expose existing private factual functions in a test-only realm, rather than
// copying their accounting algorithm. Literal transactions below do not claim
// physical reachability, public supply or complete planner route permission.
const file=require.resolve('../st-resource-history'),box={module:{exports:{}},require:createRequire(file)};
vm.runInNewContext(fs.readFileSync(file,'utf8').replace('return Object.freeze({start,applyAction,','return Object.freeze({observeOpening,openingAllocation,profileLost,zAccount,start,applyAction,'),box,{filename:file});
const old=box.module.exports;
function component(a){return{account:copy(a.context.state.account),history:copy(a.history),board:a.position.board.slice()};}
function historicalSummary(h){const balance=old.zAccount(h);return{coverage:copy(h.coverage),openingAllocation:copy(old.openingAllocation(h)),extraZ:{...copy(h.extraZ),...copy(balance),status:!h.extraZ.baseline?'unknown':old.profileLost(h)?'out-of-profile':h.reset.status==='active'||balance.remaining===0?'used':'available'},center:copy(h.center)};}
const cells={Z:[[0,38],[1,38],[1,39],[2,39]],T:[[0,38],[1,38],[2,38],[1,39]],I:[[0,36],[0,37],[0,38],[0,39]],J:[[0,38],[0,39],[1,39],[2,39]]};
function literal(current,type,{event={},centerEffects=[]}={}){
 const account=copy(current.account),history=copy(current.history),board=current.board.slice(),e={type,cells:copy(cells[type]),lines:0,spin:'none',clearedRows:[],topOut:false,...event};history.locks++;
 history.center.closed.push(...centerEffects.map(e=>({...e,at:history.locks})));
 old.observeOpening(history,{board},{board,topOut:false},e);
 const result=O.transition(account,{kind:'lock',piece:{id:90001,type,bag:10000},event:e,centerEffects},{before:{board},after:{board,topOut:false,center:history.center,sl:{hangingS:{status:'hanging'},hangingL:{status:'hanging'}},coveredCells:[]}});
 compare(result.state,board,historicalSummary(history));return{account:result.state,history,board};
}

test('opening eligibility: exact legacy predicates match every lock in three retained public trials',()=>{
 let locks=0;for(const n of [1,2,5])locks+=trial(n).locks;assert.equal(locks,96);
});
test('opening eligibility: mandatory Z, delayed quality and exact third-T retention are separate',()=>{
 const a=recorded();assert.equal(a.view.allocationRequired,true);assert.equal(a.view.thirdTReady,false);
 a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);assert.equal(a.view.mandatoryZPending,true);assert.equal(a.view.thirdTComplete,false);assert.equal(a.view.qualityPending,false);assert.equal(a.context.state.account.thirdTWindow,true);
 a.lock(fixture.steps[0].witness.slice(1));assert.equal(a.view.mandatoryZPending,false);assert.equal(a.view.thirdTComplete,true);assert.equal(a.view.qualityPending,true);assert.equal(a.view.historicalHandoff,false);
 a.lock(fixture.steps[3].witness);assert.equal(a.view.qualityPending,false);assert.equal(a.view.historicalHandoff,true);assert.equal(a.view.thirdTComplete,true);
 a.lock(['HOLD','L','L','CW','HD']);assert.equal(a.view.thirdTComplete,false);assert.equal(a.view.historicalHandoff,true,'Using the established allowance still permits the old historical handoff');
});
test('opening eligibility: later canonical TSD retires exact-third-T but never mandatory Z or quality',()=>{
 const a=recorded();for(const action of ['L','L','L'])a.act(action);a.act('HD',['Z']);a.lock(fixture.steps[1].witness);
 for(const witness of [fixture.steps[2].witness,['L','L','R180','HD'],['L','L','HD'],['L','L','HD'],['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']])a.lock(witness);
 assert.equal(a.position.lastEvent.lines,2);assert.equal(a.context.state.account.thirdTWindow,false);assert.equal(a.view.mandatoryZPending,true);assert.equal(a.view.qualityPending,false);assert.equal(a.context.state.account.qualityCandidate,true);
 a.lock(['HOLD',...fixture.steps[0].witness.slice(1)]);assert.equal(a.view.mandatoryZPending,false);assert.equal(a.view.thirdTComplete,false);assert.equal(a.view.qualityPending,true);assert.equal(a.context.state.account.z.remaining,null);
});
test('opening eligibility: preclear readiness, retained fulfillment and later-T rejection keep exact old scopes',()=>{
 const ready=trial(1,14),complete=trial(1,15);assert.equal(ready.view.thirdTReady,true);assert.equal(complete.view.thirdTComplete,true);
 const proof=E.conservationStep(complete.context.state.account,{board:complete.position.board},E.conservationStep(ready.context.state.account,{board:ready.position.board}));assert.deepEqual(proof,{safe:true,fulfilled:true});
 const later=literal(component(complete),'T',{event:{cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'}});
 assert.equal(E.resolve(later.account,{board:later.board,center:later.history.center}).thirdTComplete,false);
 assert.deepEqual(E.conservationStep(later.account,{board:later.board},proof),proof,'Already fulfilled branch short-circuits later allocation checks');
 assert.deepEqual(E.conservationStep(complete.context.state.account,{board:complete.position.board},{safe:false,fulfilled:false}),{safe:false,fulfilled:false},'A failed prefix does not revive');
});
test('opening eligibility: non-Right Z clears, extra Right Z and every later T preserve legacy count distinctions',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),root=component(a);assert.equal(a.view.thirdTComplete,true);assert.equal(a.view.qualityPending,true);
 for(const event of [{lines:1,clearedRows:[39]},{cells:[[9,36],[8,37],[9,37],[8,38]]}]){
  const next=literal(root,'Z',{event});assert.equal(next.account.thirdTWindow,true);assert.equal(E.resolve(next.account,{board:next.board,center:next.history.center}).thirdTComplete,true);
 }
 assert.equal(literal(root,'Z').account.thirdTWindow,false);
 for(const event of [{},{cells:[[7,38],[8,38],[9,38],[8,39]]},{cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'}])assert.equal(literal(root,'T',{event}).account.thirdTWindow,false);
 const unpaid=recorded().lock(['L','L','L','HD']).lock(fixture.steps[1].witness),bad=literal(component(unpaid),'Z',{event:{lines:1,clearedRows:[39]}});
 assert.equal(bad.account.mandatoryZ,true);assert.equal(bad.account.thirdTWindow,true);assert.equal(bad.account.qualityCandidate,false);
 const paid=literal(bad,'Z');assert.equal(paid.account.mandatoryZ,false);assert.equal(E.resolve(paid.account,{board:paid.board,center:paid.history.center}).thirdTComplete,true,'A clear did not increment the historical nonclear allocation count');
});
test('opening eligibility: source violation is not consumer quality invalidation or baseline permission',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),root=component(a);
 root.account.profile.violation=true;root.account.opening=null;root.history.opening.violations.push({at:root.history.locks,reason:'supplied-current-source-violation'});
 const trusted=O.importState(root.account);compare(trusted,root.board,historicalSummary(root.history));assert.equal(E.resolve(trusted,{board:root.board,center:root.history.center}).qualityPending,true);assert.equal(O.resolve(trusted,{board:root.board}).qualityPending,false);assert.equal(trusted.z.remaining,null);
 const kept=literal(root,'J');assert.equal(kept.account.qualityCandidate,true);assert.equal(kept.account.z.remaining,null);
 const invalidated=literal(root,'J',{centerEffects:[{status:'debt-invalidated'}]});assert.equal(invalidated.account.qualityCandidate,false);assert.equal(invalidated.account.thirdTWindow,true);
 const oldLoss=component(a);oldLoss.history.center.closed.push({status:'debt-invalidated',at:oldLoss.history.milestones.firstTsd.at-1});compare(oldLoss.account,oldLoss.board,historicalSummary(oldLoss.history));assert.equal(E.resolve(oldLoss.account,{board:oldLoss.board,center:oldLoss.history.center}).qualityPending,true);
});
test('opening eligibility: actual lost Center debt and optional Z permanently retire delayed preference',()=>{
 const lost=recorded();for(const i of [0,1,2])lost.lock(fixture.steps[i].witness);lost.lock(['L','L','L','HD']);assert.equal(lost.view.qualityPending,true);lost.lock(['CW','R','HD']);assert.equal(lost.view.qualityPending,false);assert.equal(lost.context.state.account.qualityCandidate,false);
 const spent=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness);spent.lock(['L','L','CW','HD']);assert.equal(spent.view.qualityPending,false);assert.equal(spent.context.state.account.z.uncredited,'one');
});
test('opening eligibility: invalid original cap and unusual prefirst Right T cannot invent third-T readiness',()=>{
 const before=trial(1,14),root=component(before);root.account.opening.roof=[[9,0],[9,1]];root.history.opening.cap.roof=[[9,0],[9,1]];
 const score={cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'},bad=literal(root,'T',{event:score});assert.equal(bad.account.allocationVerified,false);assert.equal(bad.account.thirdTWindow,false);assert.equal(bad.account.qualityCandidate,false);
 for(const event of [{cells:[[7,38],[8,38],[9,38],[8,39]]},score]){const next=literal(component(before),'T',{event});assert.equal(E.resolve(next.account,{board:next.board,center:next.history.center}).thirdTReady,false);}
});
test('opening eligibility: hypothetical handoff matches actual current rebase without mutating its root',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),context=a.context,projection=Projection.start(context.state,{position:a.position,inventory:context.inventory}),saved=copy(projection);
 const next=E.projectHandoff(projection),actual=Context.handoff(context,{position:a.position});assert.deepEqual(next.state,Q.toProjection(actual.context.state));assert.deepEqual(next.effects,actual.effects);assert.deepEqual(next.state.account,projection.state.account);assert.deepEqual(projection,saved);assert.equal(next.state.sl.handoff,true);
 const again=E.projectHandoff(next);assert.deepEqual(again.state,next.state);assert.deepEqual(again.effects,[]);assert.throws(()=>Q.importState(next.state));assert.throws(()=>E.projectHandoff({state:context.state,supply:projection.supply,position:a.position}),/projection|shape/);assert.throws(()=>E.projectHandoff({...projection,supply:{...projection.supply,streamCursor:-1}}));
});
test('opening eligibility: trusted flags survive JSON, unknown remains unknown and contradictory unions fail',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),state=copy(a.context.state.account),restored=O.importState(copy(state));assert.deepEqual(E.resolve(restored,{board:a.position.board,center:a.context.state.center}),E.resolve(state,{board:a.position.board,center:a.context.state.center}));
 const unknown=replay({active:'T',queue:['Z']},{fresh:false});assert.equal(unknown.view.thirdTReady,false);assert.equal(unknown.view.qualityPending,false);assert.equal(unknown.view.historicalHandoff,false);
 for(const mutate of [s=>delete s.thirdTWindow,s=>s.thirdTWindow=1,s=>s.qualityCandidate='yes',s=>s.allocationVerified=false,s=>s.known=false,s=>s.profile.departure=true,s=>s.z.uncredited='one',s=>s.opening=null,s=>s.qualityCandidate=false,s=>s.history=[]]){const bad=copy(state);mutate(bad);assert.throws(()=>O.importState(bad));}
});
test('opening eligibility: retired conditions never grow with repeated later locks',()=>{
 const a=trial(1,15),ended=literal(component(a),'T'),start=copy(ended.account);let account=start;
 const event={type:'J',cells:cells.J,lines:0,spin:'none',clearedRows:[],topOut:false},context={before:{board:ended.board},after:{board:ended.board,topOut:false,center:{pending:[],debt:[]},sl:{hangingS:{status:'none-observed'},hangingL:{status:'none-observed'}},coveredCells:[]}};
 for(let n=0;n<1000;n++)account=O.transition(account,{kind:'lock',piece:{id:100+n,type:'J',bag:100+n},event,centerEffects:[]},context).state;
 assert.deepEqual(account,start);assert.equal(JSON.stringify(account).length,JSON.stringify(start).length);assert.equal(account.thirdTWindow,false);assert.equal(account.qualityCandidate,false);
});

test('opening eligibility: classic script entry uses the same finite facts and handoff domain',()=>{
 const realm=vm.createContext({});for(const name of ['st-rules','st-bag','st-structure','st-access','st-pattern-history','st-reset-policy','st-opening-patterns','st-public-inventory','st-center-obligations','st-sl-obligations','st-opening-obligations','st-left-obligations','st-obligation-state','st-obligation-context','st-obligation-projection','st-opening-eligibility'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),realm,{filename:name+'.js'});
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),options={board:a.position.board,center:a.context.state.center,right:'cap-preparation'},projection=Projection.start(a.context.state,{position:a.position,inventory:a.context.inventory});
 assert.deepEqual(copy(realm.STOpeningEligibility.resolve(copy(a.context.state.account),copy(options))),E.resolve(a.context.state.account,options));assert.deepEqual(copy(realm.STOpeningEligibility.projectHandoff(copy(projection))),E.projectHandoff(projection));
});

test('opening eligibility: partner reporting requires explicit current Center while conservation remains scalar',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),state=a.context.state.account,board=a.position.board,center=a.context.state.center,saved=copy(center);
 assert.equal(a.view.qualityPending,true);for(const missing of [undefined,null,{}, {pending:[]},{debt:[]}])assert.throws(()=>E.resolve(state,{board,center:missing}),/current Center targets required/);
 assert.throws(()=>E.resolve(O.start(),{board}),/current Center targets required/);
 assert.deepEqual(E.conservationStep(state,{board}),{safe:true,fulfilled:true});
 const report=E.resolve(state,{board,center});assert.deepEqual(report.qualityPendingPartners,center.pending);report.qualityPendingPartners.push({id:'not-current'});assert.deepEqual(center,saved);
});

test('opening eligibility: exact preclear predicates reject missing or malformed current board',()=>{
 const ready=trial(1,14),account=ready.context.state.account,center=ready.context.state.center;assert.equal(ready.view.thirdTReady,true);
 for(const board of [undefined,null,[],Array(39).fill('..........'),Array(40).fill('.........'),Array(40).fill('??????????')]){assert.throws(()=>E.resolve(account,{board,center}),/current public board required/);assert.throws(()=>E.conservationStep(account,{board}),/current public board required/);}
 assert.deepEqual(E.conservationStep(null,null,{safe:true,fulfilled:true}),{safe:true,fulfilled:true},'Already fulfilled branch never evaluates new facts');
});
