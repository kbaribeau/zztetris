'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../st-opening-eligibility'),O=require('../st-opening-obligations'),Q=require('../st-obligation-state'),Context=require('../st-obligation-context'),Projection=require('../st-obligation-projection');
const fixture=require('./fixtures/opening-z-allocation.json'),copy=x=>JSON.parse(JSON.stringify(x));
// Actual fixture moves run only through the native controller. Literal component
// transactions isolate eligibility rules; they claim no route or supply proof.
const player=require('./support/current-player.cjs');
function replay(origin,options={}){
 const a=player(origin,options),api={act(...args){const result=a.act(...args);assert.equal(result.context.status,'available',result.context.reason);assert.equal(result.receipt.accepted,true,'Recorded input executes: '+args[0]);return result;},lock(w){for(const action of w)api.act(action);return api;},handoff:()=>a.handoff(),begin:()=>a.begin(),get position(){return a.position;},get context(){return a.context;},get locks(){return a.locks;},get view(){return E.resolve(a.state.account,{board:a.position.board,center:a.state.center,right:'cap-preparation'});}};
 return api;
}
const recorded=()=>replay(fixture.request.observation,{snapshot:fixture.request.options.obligationContext});
function trial(n,limit=Infinity){const f=require('./support/st-resource-trial-'+n+'.json'),a=replay(f.initial);for(const step of f.steps){if(a.locks>=limit)break;a.act(step.action,step.revealed);}return a;}
function component(a){return{account:copy(a.context.state.account),center:copy(a.context.state.center),board:a.position.board.slice()};}
const cells={Z:[[0,38],[1,38],[1,39],[2,39]],T:[[0,38],[1,38],[2,38],[1,39]],I:[[0,36],[0,37],[0,38],[0,39]],J:[[0,38],[0,39],[1,39],[2,39]]};
function literal(current,type,{event={},centerEffects=[]}={}){
 const board=current.board.slice(),center=copy(current.center),e={type,cells:copy(cells[type]),lines:0,spin:'none',clearedRows:[],topOut:false,...event};
 const result=O.transition(current.account,{kind:'lock',piece:{id:90001,type,bag:10000},event:e,centerEffects},{before:{board},after:{board,topOut:false,center,sl:{hangingS:{status:'hanging'},hangingL:{status:'hanging'}},coveredCells:[]}});
 return{account:result.state,center,board,effects:result.effects};
}

test('opening eligibility: retained public trials finish with literal native eligibility outcomes',()=>{
 const a=trial(1),b=trial(2),bad=trial(5);assert.equal(a.locks+b.locks+bad.locks,96);
 assert.equal(a.view.historicalHandoff,true);assert.equal(a.view.thirdTComplete,false);
 assert.equal(b.view.historicalHandoff,true);assert.equal(b.view.qualityPending,false);
 assert.equal(bad.view.historicalHandoff,false);assert.equal(bad.view.thirdTReady,false);assert.equal(bad.view.qualityPending,false);
});
test('opening eligibility: mandatory Z, delayed quality and exact third-T retention are separate',()=>{
 const a=recorded();assert.equal(a.view.allocationRequired,true);assert.equal(a.view.thirdTReady,false);
 a.lock(['L','L','L','HD']);a.lock(fixture.steps[1].witness);assert.equal(a.view.mandatoryZPending,true);assert.equal(a.view.thirdTComplete,false);assert.equal(a.view.qualityPending,false);assert.equal(a.context.state.account.thirdTWindow,true);
 a.lock(fixture.steps[0].witness.slice(1));assert.equal(a.view.mandatoryZPending,false);assert.equal(a.view.thirdTComplete,true);assert.equal(a.view.qualityPending,true);assert.equal(a.view.historicalHandoff,false);
 a.lock(fixture.steps[3].witness);assert.equal(a.view.qualityPending,false);assert.equal(a.view.historicalHandoff,true);assert.equal(a.view.thirdTComplete,true);
 a.lock(['HOLD','L','L','CW','HD']);assert.equal(a.view.thirdTComplete,false);assert.equal(a.view.historicalHandoff,true,'Using the established allowance still permits the post-quality handoff');
});
test('opening eligibility: only eligible Right preparation activates current mandatory Z preference',()=>{
 const pending=recorded(),afterTsd=recorded().lock(['L','L','L','HD']).lock(fixture.steps[1].witness),paid=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness);
 for(const [label,a,requiresZ]of [['pre-TSD',pending,true],['post-TSD unpaid',afterTsd,true],['post-TSD paid',paid,false],['ready',trial(1,14),false],['unknown',replay({active:'T',queue:['Z']},{fresh:false}),false]]){
  const {allocationRequired,...unchanged}=a.view;
  for(const [right,eligible]of [['staggered-scoring-wall',true],['cap-preparation',true],['cleared-base',false],[null,false],['unknown',false]]){
   const view=E.resolve(a.context.state.account,{board:a.position.board,center:a.context.state.center,right});
   assert.equal(view.allocationRequired,requiresZ&&eligible,label+' / '+right);
   const {allocationRequired:ignored,...rest}=view;assert.deepEqual(rest,unchanged,'Right preparation changes no other factual eligibility');
  }
 }
});
test('opening eligibility: later canonical TSD retires exact-third-T but never mandatory Z or quality',()=>{
 const a=recorded();for(const action of ['L','L','L'])a.act(action);a.act('HD',['Z']);a.lock(fixture.steps[1].witness);
 for(const witness of [fixture.steps[2].witness,['L','L','R180','HD'],['L','L','HD'],['L','L','HD'],['R','R','R','CW',...Array(17).fill('SD'),'CW','HD']])a.lock(witness);
 assert.equal(a.position.lastEvent.lines,2);assert.equal(a.context.state.account.thirdTWindow,false);assert.equal(a.view.mandatoryZPending,true);assert.equal(a.view.qualityPending,false);assert.equal(a.context.state.account.qualityCandidate,true);
 a.lock(['HOLD',...fixture.steps[0].witness.slice(1)]);assert.equal(a.view.mandatoryZPending,false);assert.equal(a.view.thirdTComplete,false);assert.equal(a.view.qualityPending,true);assert.equal(a.context.state.account.z.remaining,null);
});
test('opening eligibility: preclear readiness, retained fulfillment and later-T rejection keep exact eligibility scopes',()=>{
 const ready=trial(1,14),complete=trial(1,15);assert.equal(ready.view.thirdTReady,true);assert.equal(complete.view.thirdTComplete,true);
 const proof=E.conservationStep(complete.context.state.account,{board:complete.position.board},E.conservationStep(ready.context.state.account,{board:ready.position.board}));assert.deepEqual(proof,{safe:true,fulfilled:true});
 const later=literal(component(complete),'T',{event:{cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'}});
 assert.equal(E.resolve(later.account,{board:later.board,center:later.center}).thirdTComplete,false);
 assert.deepEqual(E.conservationStep(later.account,{board:later.board},proof),proof,'Already fulfilled branch short-circuits later allocation checks');
 assert.deepEqual(E.conservationStep(complete.context.state.account,{board:complete.position.board},{safe:false,fulfilled:false}),{safe:false,fulfilled:false},'A failed prefix does not revive');
});
test('opening eligibility: non-Right Z clears, extra Right Z and every later T preserve finite count distinctions',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),root=component(a);assert.equal(a.view.thirdTComplete,true);assert.equal(a.view.qualityPending,true);
 for(const event of [{lines:1,clearedRows:[39]},{cells:[[9,36],[8,37],[9,37],[8,38]]}]){
  const next=literal(root,'Z',{event});assert.equal(next.account.thirdTWindow,true);assert.equal(E.resolve(next.account,{board:next.board,center:next.center}).thirdTComplete,true);
 }
 assert.equal(literal(root,'Z').account.thirdTWindow,false);
 for(const event of [{},{cells:[[7,38],[8,38],[9,38],[8,39]]},{cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'}])assert.equal(literal(root,'T',{event}).account.thirdTWindow,false);
 const unpaid=recorded().lock(['L','L','L','HD']).lock(fixture.steps[1].witness),bad=literal(component(unpaid),'Z',{event:{lines:1,clearedRows:[39]}});
 assert.equal(bad.account.mandatoryZ,true);assert.equal(bad.account.thirdTWindow,true);assert.equal(bad.account.qualityCandidate,false);
 const paid=literal(bad,'Z');assert.equal(paid.account.mandatoryZ,false);assert.equal(E.resolve(paid.account,{board:paid.board,center:paid.center}).thirdTComplete,true,'A clear did not consume the finite nonclear allocation window');
});
test('opening eligibility: source violation is not consumer quality invalidation or baseline permission',()=>{
 const a=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness),root=component(a);
 root.account.profile.violation=true;root.account.opening=null;
 const trusted=O.importState(root.account);assert.equal(E.resolve(trusted,{board:root.board,center:root.center}).qualityPending,true);assert.equal(O.resolve(trusted,{board:root.board}).qualityPending,false);assert.equal(trusted.z.remaining,null);
 const kept=literal(root,'J');assert.equal(kept.account.qualityCandidate,true);assert.equal(kept.account.z.remaining,null);
 const invalidated=literal(root,'J',{centerEffects:[{status:'debt-invalidated'}]});assert.equal(invalidated.account.qualityCandidate,false);assert.equal(invalidated.account.thirdTWindow,true);
 assert.equal(root.account.qualityCandidate,true,'A different branch losing debt cannot mutate the root');
});
test('opening eligibility: actual lost Center debt and optional Z permanently retire delayed preference',()=>{
 const lost=recorded();for(const i of [0,1,2])lost.lock(fixture.steps[i].witness);lost.lock(['L','L','L','HD']);assert.equal(lost.view.qualityPending,true);lost.lock(['CW','R','HD']);assert.equal(lost.view.qualityPending,false);assert.equal(lost.context.state.account.qualityCandidate,false);
 const spent=recorded().lock(fixture.steps[0].witness).lock(fixture.steps[1].witness);spent.lock(['L','L','CW','HD']);assert.equal(spent.view.qualityPending,false);assert.equal(spent.context.state.account.z.uncredited,'one');
});
test('opening eligibility: invalid original cap and unusual prefirst Right T cannot invent third-T readiness',()=>{
 const before=trial(1,14),root=component(before);root.account.opening.roof=[[9,0],[9,1]];
 const score={cells:[[7,37],[6,38],[7,38],[8,38]],lines:2,clearedRows:[37,38],spin:'full'},bad=literal(root,'T',{event:score});assert.equal(bad.account.allocationVerified,false);assert.equal(bad.account.thirdTWindow,false);assert.equal(bad.account.qualityCandidate,false);
 for(const event of [{cells:[[7,38],[8,38],[9,38],[8,39]]},score]){const next=literal(component(before),'T',{event});assert.equal(E.resolve(next.account,{board:next.board,center:next.center}).thirdTReady,false);}
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
