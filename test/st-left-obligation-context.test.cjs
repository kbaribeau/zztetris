'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),C=require('../st-obligation-context'),Q=require('../st-obligation-state'),P=require('../st-obligation-projection'),T=require('../st-obligation-tracking');
const copy=x=>JSON.parse(JSON.stringify(x));
const board=()=>Array.from({length:40},(_,y)=>[8,8,11,11,0,0,0,0,0,0].map(h=>40-y<=h?'X':'.').join(''));
const repair={cells:[[1,29],[1,30],[0,31],[1,31]],resultProfile:[9,11,11,11]},witness=['CCW','L','L','L','HD'];
const frame=(context,position)=>({status:context.status,state:context.state,view:C.resolve(context,{position})});
function issues(record){const events=[],m=T.create();m.subscribe(e=>events.push(e));m.transition(record.before,record.after,record.options);return events;}
function setup(active='J',b=board()){
 let position=R.createState({board:b,active,queue:['O','T']}),context=C.start(position),last;
 return{get position(){return position;},get context(){return context;},
  accept(){const before=frame(context,position),result=C.acceptLeftRepair(context,{position,repair,checked:true});context=result.context;last={before,after:frame(context,position),options:{operation:{kind:'accept-left-repair',repair,checked:true},effects:result.effects}};return{...last,goalId:result.goalId};},
  install(raw){context=C.importState(raw,{position});},
  act(action){const prior=position,before=frame(context,position);position=R.move(position,action);const result=C.applyActual(context,{before:prior,after:position,action});assert.equal(result.context.status,'available',result.context.reason);context=result.context;last={before,after:frame(context,position),options:{operation:action==='HD'?{kind:'lock',piece:result.receipt.locked,event:position.lastEvent}:{kind:'observe'},effects:result.effects}};return last;},
  lock(path){for(const a of path){last=this.act(a);assert.deepEqual(issues(last),[]);}return last;}
 };
}
test('Left context / marker creates only checked current work; actual and projection share fulfillment',()=>{
 const x=setup(),unchecked=C.acceptLeftRepair(x.context,{position:x.position,repair,checked:false});assert.equal(unchecked.goalId,null);assert.deepEqual(unchecked.context.state.leftGoals,[]);
 const accepted=x.accept();assert.equal(accepted.goalId,'left-1');assert.deepEqual(issues(accepted),[]);assert.equal(x.context.state.schemaVersion,2);
 const reused=x.accept();assert.deepEqual(issues(reused),[]);assert.equal(reused.goalId,accepted.goalId);
 const projected=P.project(P.start(x.context.state,{position:x.position,inventory:x.context.inventory}),{witness});
 const snapshot=C.snapshot(x.context,{position:x.position}),actual=x.lock(witness);
 assert.deepEqual(actual.after.state.leftGoals,[]);assert.deepEqual(projected.state.leftGoals,[]);assert.deepEqual(projected.effects,actual.options.effects);
 assert.deepEqual(C.restore(copy(snapshot)).context.state.leftGoals,snapshot.context.state.leftGoals);
 assert.equal(T.status(actual.after).obligations.leftGoals.length,0);
});
test('Left context / stale plan has no state authority; manual alternate O satisfies same partial promise',()=>{
 const x=setup('O');x.accept();const saved=C.exportState(x.context);assert.equal(saved.state.leftGoals.length,1);
 const imported=C.importState(copy(saved),{position:x.position});assert.equal(C.resolve(imported,{position:x.position}).leftGoals.length,1);
 const actual=x.lock(['L','L','L','L','HD']);assert.deepEqual(actual.after.state.leftGoals,[]);assert.ok(actual.options.effects.some(e=>e.domain==='left'&&e.kind==='fulfilled'));
});
test('Left context / trusted v2 facts need no plan or supporting board; strict v1 migration adds only empty jobs',()=>{
 const x=setup();x.accept();const raw=C.exportState(x.context),other=R.createState({active:'J',queue:['O','T']});
 const preserved=C.importState(raw,{position:other});assert.deepEqual(preserved.state.leftGoals,raw.state.leftGoals);
 const old=copy(raw);old.state.schemaVersion=1;delete old.state.leftGoals;const migrated=C.importState(old,{position:other});assert.equal(migrated.state.schemaVersion,2);assert.deepEqual(migrated.state.leftGoals,[]);
 for(const mutate of [s=>s.leftGoals=[],s=>delete s.account,s=>s.account.known='yes']){const bad=copy(old);mutate(bad.state);assert.throws(()=>C.importState(bad));}
 const missing=copy(raw);delete missing.state.leftGoals;assert.throws(()=>C.importState(missing));
 const projected=Q.toProjection(raw.state);assert.deepEqual(projected.leftGoals,raw.state.leftGoals);projected.schemaVersion=1;delete projected.leftGoals;assert.deepEqual(Q.importProjection(projected).leftGoals,[]);
});
test('Left context / actual clear translates and removes current jobs with silent monitoring',()=>{
 const b=board();b[39]='XXXXXX....';
 for(const kind of ['translate','remove','partial']){
  const x=setup('I',b);x.accept();const raw=C.exportState(x.context);
  if(kind==='remove')raw.state.leftGoals[0].deficitRegion=[[0,39],[1,39]];
  if(kind==='partial')raw.state.leftGoals[0].deficitRegion=[[0,38],[1,39]];
  x.install(raw);const actual=x.lock(['R','R','R','HD']),left=actual.options.effects.filter(e=>e.domain==='left');
  if(kind==='remove'){assert.deepEqual(actual.after.state.leftGoals,[]);assert.equal(left[0].kind,'removed-by-clear');}
  else{assert.equal(actual.after.state.leftGoals.length,1);assert.equal(left[0].kind,'translated');assert.deepEqual(actual.after.state.leftGoals[0].referenceProfile,[7,7,10,10]);}
 }
});
test('Left tracking / missing and forged lifecycle effects cannot conceal current job loss or creation',()=>{
 const x=setup(),created=x.accept();assert.deepEqual(issues(created),[]);
 const missing=copy(created);missing.options.effects=[];assert.ok(issues(missing).some(e=>e.code==='left-created-without-effect'));
 const actual=x.lock(witness),lost=copy(actual);lost.options.effects=lost.options.effects.filter(e=>e.domain!=='left');assert.ok(issues(lost).some(e=>e.code==='left-obligation-lost'));
 const forged=copy(actual);forged.options.operation={kind:'observe'};assert.ok(issues(forged).some(e=>e.code==='left-effect-mismatch'));
 const mutated=copy(created);mutated.before=copy(created.after);mutated.after=copy(created.after);mutated.options={operation:{kind:'observe'},effects:[]};mutated.after.state.leftGoals[0].referenceProfile[0]++;mutated.after.view.leftGoals=copy(mutated.after.state.leftGoals);assert.ok(issues(mutated).some(e=>e.code==='left-current-fact-mismatch'));
});
test('Left tracking / reconciliation emits only ephemeral remap, and forged merges are rejected',()=>{
 const x=setup('I');x.accept();const raw=C.exportState(x.context);raw.state.leftGoals.push({...copy(raw.state.leftGoals[0]),id:'duplicate',deepColumns:[1,0],deficitRegion:copy(raw.state.leftGoals[0].deficitRegion).reverse()});x.install(raw);
 const actual=x.lock(['R','R','R','HD']);assert.equal(actual.after.state.leftGoals.length,1);assert.ok(actual.options.effects.some(e=>e.domain==='left'&&e.kind==='merged'));
 const bad=copy(actual);bad.options.effects.find(e=>e.kind==='merged').intoGoalId='missing';assert.ok(issues(bad).some(e=>e.code==='left-effect-mismatch'));
});
test('Left context / actual top-out retains the job and empty jobs do not add an event gate',()=>{
 const b=board();b[18]='....XX....';
 const position=R.createState({board:b,active:{type:'J',x:0,y:0,rotation:3,lastRotation:null},queue:['O']}),root=C.start(position);
 const accepted=C.acceptLeftRepair(root,{position,repair,checked:true}),after=R.move(position,'HD');assert.equal(after.topOut,true);
 for(const context of [root,accepted.context]){
  const result=C.applyActual(context,{before:position,after,action:'HD'});assert.equal(result.context.status,'available',result.context.reason);
  assert.equal(result.context.state.leftGoals.length,context.state.leftGoals.length);assert.ok(!result.effects.some(e=>e.domain==='left'&&e.kind==='fulfilled'));
  const record={before:frame(context,position),after:frame(result.context,after),options:{operation:{kind:'lock',piece:result.receipt.locked,event:after.lastEvent},effects:result.effects}};assert.deepEqual(issues(record),[]);
 }
});
