'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../st-rules'),I=require('../st-public-inventory'),Q=require('../st-obligation-state'),P=require('../st-obligation-projection'),C=require('../st-obligation-context'),Route=require('../st-obligation-route');
const copy=x=>JSON.parse(JSON.stringify(x));
function frozen(x){if(x&&typeof x==='object'){assert.ok(Object.isFrozen(x));for(const value of Object.values(x))frozen(value);}}
function origin(active='I'){const position=R.createState({active,queue:[...'IJLOSTZ'].filter(t=>t!==active),streamCursor:1}),inventory=I.start(position,{fresh:true});return P.start(Q.start(position,{inventory}),{position,inventory});}
function spy(){const calls={imports:0,operations:[]},module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../st-obligation-projection.js'),'utf8'),{module,require:id=>id==='./st-obligation-state'?{...Q,importProjection:(...args)=>{calls.imports++;return Q.importProjection(...args);},projectTransition:(s,o,c)=>{calls.operations.push({kind:o.kind,hold:c.before.position.hold!==c.after.position.hold});return Q.projectTransition(s,o,c);},projectTransitionOwned:(s,o,c)=>{calls.operations.push({kind:o.kind,hold:c.before.position.hold!==c.after.position.hold});return Q.projectTransitionOwned(s,o,c);}}:require(path.join(__dirname,'..',id))});return{P:module.exports,calls};}
function parity(root,options){const raw=P.project(root,options),owned=P.projectOwned(root,options),{effects,locked,view,...projection}=raw;assert.deepStrictEqual(owned,{projection,effects,locked,...(options.resolveView?{view}:{})});return owned;}
test('owned frame: only an exact completed private frame skips the initial public import',()=>{
 const {P:p,calls}=spy(),first=p.projectOwned(origin(),{witness:['HD']});assert.equal(calls.imports,1);frozen(first.projection);
 calls.imports=0;p.projectOwned(first.projection,{witness:['HD']});assert.equal(calls.imports,0);
 for(const raw of [{...first.projection},Object.freeze({...first.projection}),copy(first.projection),new Proxy(first.projection,{})]){calls.imports=0;p.projectOwned(raw,{witness:['HD']});assert.equal(calls.imports,1);}
 calls.imports=0;const legacy=p.project(first.projection,{witness:['HD']});assert.equal(calls.imports,1);assert.equal(Object.isFrozen(legacy),false);assert.equal(Object.isFrozen(legacy.state),false);assert.equal(Object.isFrozen(legacy.supply.active),false);
 assert.throws(()=>Q.importState(first.projection.state),/envelope shape/);assert.throws(()=>p.projectOwned(first.projection,{witness:['HD'],position:origin().position}),/explicit position differs/);
});
test('owned frame: full results match public projection for movements, HOLD, forced supply and continuation',()=>{
 const B=require('../st-bag'),unknown=P.startUnknown(R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}));
 for(const root of [origin(),unknown])for(const witness of [['HD'],['L','R','CW','CCW','SD','R180','R180','HD'],['HOLD','L','R','HOLD','L','R','HD']]){
  const saved=copy(root),options={witness,extendForced:true,resolveView:true,references:P.referenceSnapshot([])},first=parity(root,options);frozen(first.projection);assert.deepEqual(root,saved);parity(first.projection,{...options,witness:['L','R','HD']});
 }
 for(const f of require('./fixtures/resource-projection-history.json').cases){const position=R.createState(f.observation),context=C.importState(f.obligationContext,{position});let current=P.start(context.state,{position,inventory:context.inventory});for(const move of f.continuation)current=parity(current,{witness:move.witness,resolveView:true,extendForced:true}).projection;}
});
test('owned frame: frame, caller, mutable views and siblings remain isolated',()=>{
 const root=origin(),saved=copy(root),first=P.projectOwned(root,{witness:['HD'],resolveView:true}),expected=copy(first.projection),sibling=P.projectOwned(root,{witness:['L','HD'],resolveView:true}),siblingSaved=copy(sibling);
 root.supply.queue[0].id=99;root.state.account.profile.violation=true;assert.deepEqual(first.projection,expected);
 first.effects.push({caller:true});first.locked.id=999;first.view.center.pending.push({caller:true});first.view.leftGoals.push({caller:true});first.view.coveredRepair.cells.push([0,0]);assert.deepEqual(first.projection,expected);assert.deepEqual(sibling,siblingSaved);
 assert.throws(()=>{first.projection.supply.active.id=99;});assert.throws(()=>{first.projection.state.account.profile.violation=true;});
 const legacy=P.project(first.projection,{witness:['HD']});legacy.supply.active.id=999;legacy.state.account.profile.violation=true;assert.deepEqual(first.projection,expected);assert.deepEqual(saved.supply.active.id,1);
});
test('owned frame: every witness retains first observe and every HOLD/HD reduction',()=>{
 const {P:p,calls}=spy(),first=p.projectOwned(origin(),{witness:['HD']});calls.operations.length=0;
 p.projectOwned(first.projection,{witness:['L','R','HOLD','L','R','HOLD','L','R','HD'],references:p.referenceSnapshot([])});
 assert.deepEqual(calls.operations.map(x=>x.kind),['observe','observe','observe','lock']);assert.equal(calls.operations.filter(x=>x.hold).length,2);
});
test('owned frame: changed references still compact on the next first observe before lock effects',()=>{
 const root=origin('S');for(const p of [root.supply.active,...root.supply.queue]){p.id+=20;p.bag=2;p.observedOrder+=14;}root.supply.nextObservedId+=20;root.supply.frontier={bag:3,seenMask:0};root.state.sl.foundationOpen=false;root.state.sl.firstBagReview='unreviewed';
 root.state.sl.residuals=[{bag:1,S:{id:8,region:'left-center',opening:true,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:true,invalidated:false},L:{id:9,region:'left',opening:true,pair:null,nonRight:true},order:'L-first',sOwedSinceL:false,lBeforeSPair:false}];
 const first=parity(root,{witness:['L','L','HD'],references:P.referenceSnapshot([8])});assert.ok(first.projection.state.sl.residuals.some(b=>b.bag===1));
 const next=parity(first.projection,{witness:['L','R','HD'],references:P.referenceSnapshot([])});assert.deepEqual(next.effects[0],{domain:'sl',status:'compacted',kind:'S',subject:{category:'unclassified',bag:1,sId:8,lId:9,requiresAccommodation:true},severity:1});
});
test('owned frame: empty custom iterators never brand or freeze a raw no-lock result',()=>{
 const {P:p,calls}=spy(),root=origin(),witness=['HD'];witness[Symbol.iterator]=function*(){};const empty=p.projectOwned(root,{witness});assert.equal(empty.locked,null);assert.equal(Object.isFrozen(empty.projection),false);assert.equal(Object.isFrozen(root.state),false);
 calls.imports=0;p.projectOwned(empty.projection,{witness:['HD']});assert.equal(calls.imports,1);
 const first=p.projectOwned(root,{witness:['HD']}),saved=copy(first.projection),noLock=p.projectOwned(first.projection,{witness,extendForced:true});assert.equal(noLock.locked,null);assert.deepEqual(copy(first.projection),saved);assert.equal(Object.isFrozen(noLock.projection.position),false);
});
test('owned frame: raw serialization/getter guards and signed-zero current notches survive',()=>{
 for(const api of [P.project,P.projectOwned]){
  const root=origin();let reads=0;Object.defineProperty(root.state,'dPending',{enumerable:true,get:()=>++reads===1?false:'forged'});assert.throws(()=>api(root,{witness:['HD']}),/version\/availability\/D/);
  const raw=origin(),subject=copy(raw.supply.queue[0]);Object.defineProperty(raw.supply.queue[0],'toJSON',{value:()=>({...subject,id:0})});assert.throws(()=>api(raw,{witness:['HD']}),/subject identity/);
 }
 const raw=origin();raw.state.safety.notches={version:2,status:'broken',anchorRow:-0,blockedRows:[-0],source:'imported-current-state'};const first=parity(raw,{witness:['HD'],resolveView:true}),second=parity(first.projection,{witness:['HD'],resolveView:true});assert.ok(Object.is(second.view.coveredRepair.notches.anchorRow,-0));assert.ok(Object.is(second.view.coveredRepair.notches.protectedRows[0],-0));
});
test('resource-only selector: exact resources, mutable returns and unchanged raw validation',()=>{
 const calls={resolve:0},module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../st-obligation-route.js'),'utf8'),{module,require:id=>id==='./st-obligation-projection'?{...P,resolve:(...args)=>{calls.resolve++;return P.resolve(...args);}}:require(path.join(__dirname,'..',id))});const route=module.exports,position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),context=C.start(position,{fresh:true}),root=route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary}),child=route.step(root,{witness:['HD']}).route;
 calls.resolve=0;assert.deepStrictEqual(route.resolveResources(child),route.resolve(child).resources);assert.equal(calls.resolve,0);const value=route.resolveResources(child);value.violations.push('caller');assert.notDeepEqual(value,route.resolveResources(child));
 for(const raw of [root,{...child},Object.freeze({...child}),copy(child),new Proxy(child,{}),route.fromProjection(child.projection,{openingBoundary:child.openingBoundary,extendForced:false})]){calls.resolve=0;assert.deepStrictEqual(route.resolveResources(raw),route.resolve(child===raw?child:raw).resources);assert.equal(calls.resolve,2);}
 const invalid=copy(child);invalid.projection.state.dPending='forged';assert.throws(()=>route.resolveResources(invalid),/version\/availability\/D/);
});
