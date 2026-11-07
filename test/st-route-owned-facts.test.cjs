'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../st-rules'),C=require('../st-obligation-context'),P=require('../st-obligation-projection'),A=require('../st-obligation-assessment'),Route=require('../st-obligation-route');
const copy=x=>JSON.parse(JSON.stringify(x));
function frozen(x){if(!x||typeof x!=='object')return;assert.ok(Object.isFrozen(x));for(const value of Object.values(x))frozen(value);}
function root(api=Route){const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),context=C.start(position,{fresh:true});return api.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary,horizon:14});}
function spy(){
 const calls={resolve:0,transition:0,views:[]},module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../st-obligation-route.js'),'utf8'),{module,require:id=>id==='./st-obligation-projection'?{...P,resolve:(...args)=>{calls.resolve++;return P.resolve(...args);}}:id==='./st-obligation-assessment'?{...A,transition:(s,c)=>{calls.transition++;frozen(c.after.view);calls.views.push(c.after.view);return A.transition(s,c);}}:require(path.join(__dirname,'..',id))});return{Route:module.exports,calls};
}
test('owned route facts: only exact successful step routes reuse deeply frozen private views',()=>{
 const {Route:r,calls}=spy(),initial=root(r);calls.resolve=0;r.resolve(initial);assert.equal(calls.resolve,1);
 const step=r.step(initial,{witness:['L','R','HD']});assert.equal(calls.resolve,2);frozen(step.route);frozen(calls.views[0]);calls.resolve=0;
 const first=r.resolve(step.route),second=r.resolve(step.route);assert.equal(calls.resolve,0);assert.deepEqual(copy(first),copy(second));assert.notEqual(first.facts,second.facts);assert.notEqual(first.facts.center,second.facts.center);
 r.step(step.route,{witness:['L','R','HD']});assert.equal(calls.resolve,0);assert.equal(calls.transition,2);
});
test('owned route facts: raw, copied, frozen and proxied envelopes cannot carry the cache capability',()=>{
 const {Route:r,calls}=spy(),step=r.step(root(r),{witness:['HD']});
 const rawEnvelope={...step.route},frozenEnvelope=Object.freeze({...step.route}),cloned=copy(step.route),proxy=new Proxy(step.route,{});
 for(const value of [rawEnvelope,frozenEnvelope,cloned,proxy]){calls.resolve=0;assert.deepEqual(copy(r.resolve(value)),copy(r.resolve(step.route)));assert.equal(calls.resolve,1);calls.resolve=0;r.step(value,{witness:['HD']});assert.equal(calls.resolve,1);}
 const from=r.fromProjection(step.route.projection,{openingBoundary:step.route.openingBoundary,extendForced:false});calls.resolve=0;r.resolve(from);assert.equal(calls.resolve,1);
 assert.throws(()=>r.resolve({...step.route,schemaVersion:0}),/request envelope/);assert.throws(()=>r.resolve(step),/request envelope/);
});
test('owned route facts: returned mutable facts and resources never corrupt a cached route or sibling',()=>{
 const initial=root(),child=Route.step(initial,{witness:['HD']}).route,sibling=Route.step(initial,{witness:['L','HD']}).route,before=copy(child),other=copy(Route.resolve(sibling)),expected=copy(Route.resolve(child));
 const result=Route.resolve(child);result.facts.dPattern.pending=true;result.facts.center.pending.push({fake:true});result.facts.hangingS.aggregate[0]=999;result.facts.leftGoals.push({fake:true});result.facts.coveredRepair.cells.push([0,0]);result.resources.violations.push('caller-only');
 assert.deepEqual(Route.resolve(child),expected);assert.deepEqual(child,before);assert.deepEqual(Route.resolve(sibling),other);assert.throws(()=>{child.projection.state.dPending=true;});assert.throws(()=>{child.projection.supply.active.id=999;});
});
test('owned route facts: shallow-frozen fromProjection aliases retain public validation on every resolve',()=>{
 const {Route:r,calls}=spy(),child=r.step(root(r),{witness:['HD']}).route,projection=copy(child.projection);Object.freeze(projection.state);
 const from=r.fromProjection(projection,{openingBoundary:child.openingBoundary,extendForced:false});assert.equal(Object.isFrozen(projection.state.account.profile),false);calls.resolve=0;
 assert.equal(r.resolve(from).facts.profileLost,false);projection.state.account.profile.violation=true;assert.equal(r.resolve(from).facts.profileLost,true);assert.equal(calls.resolve,2);
 for(const wrap of [x=>x,x=>Object.freeze(x)]){
  const raw=copy(child);let reads=0;Object.defineProperty(raw.projection.state,'dPending',{enumerable:true,get(){return ++reads===1?false:'forged';}});assert.throws(()=>r.resolve(wrap(raw)),/version\/availability\/D/);
 }
 const invalid=copy(child),saved=copy(invalid.projection.supply.queue[0]);Object.defineProperty(invalid.projection.supply.queue[0],'toJSON',{value:()=>({...saved,id:0})});assert.throws(()=>r.step(invalid,{witness:['HD']}),/subject identity/);
});
test('owned route facts: complete current duty continuations and bindings equal the uncached raw path',()=>{
 for(const f of require('./fixtures/resource-projection-history.json').cases){const position=R.createState(f.observation),context=C.importState(f.obligationContext,{position});let fast=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary}),slow=copy(fast);
  for(const p of f.continuation){const a=Route.step(fast,{witness:p.witness,event:p.event}),b=Route.step(slow,{witness:p.witness,event:p.event});assert.deepEqual(a,b);assert.deepEqual(Route.resolve(a.route),Route.resolve(copy(b.route)));assert.equal(Route.binding(a.route),Route.binding(b.route));assert.deepEqual(Route.references(a.route),Route.references(b.route));fast=a.route;slow=copy(b.route);}
 }
});
test('owned route facts: unknown and forced supply stay distinct; rejected work has no externally visible effects',()=>{
 const B=require('../st-bag'),position=R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}),initial=Route.startUnknown(position),before=copy(initial),child=Route.step(initial,{witness:['HOLD','L','R','HD']});
 assert.equal(child.locked.id<0,true);assert.equal(child.locked.bag,null);assert.deepEqual(Route.resolve(child.route),Route.resolve(copy(child.route)));assert.deepEqual(initial,before);
 const rootSaved=copy(child.route),facts=copy(Route.resolve(child.route));for(const opts of [{witness:['BAD','HD']},{witness:['HD'],event:{type:'I',lines:99}}])assert.throws(()=>Route.step(child.route,opts));assert.deepEqual(child.route,rootSaved);assert.deepEqual(Route.resolve(child.route),facts);
 const limited={...child.route,assessment:{...child.route.assessment,horizon:1}};assert.throws(()=>Route.step(limited,{witness:['HD']}),/horizon/);
});
test('owned route facts: public selector shape exactly matches P.resolve for known, unknown and synthetic cases',()=>{
 const B=require('../st-bag'),unknown=Route.startUnknown(R.createState({active:'I',hold:'I',queue:['O','T']})),forced=Route.startUnknown(R.createState({active:'I',queue:[...'JLOST'],streamCursor:1,bag:B.fromObserved({observed:[...'IJLOST'],startPhase:0})}));
 for(const initial of [root(),unknown,forced]){const child=Route.step(initial,{witness:['HD']}).route;assert.deepStrictEqual(Route.resolve(child).facts,P.resolve(child.projection));assert.deepStrictEqual(Route.resolve(child).facts,P.resolve(child.projection));}
 for(const f of require('./fixtures/resource-projection-history.json').cases){const position=R.createState(f.observation),context=C.importState(f.obligationContext,{position}),initial=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary}),child=Route.step(initial,{witness:f.witness}).route;assert.deepStrictEqual(Route.resolve(child).facts,P.resolve(child.projection));}
});
test('owned route facts: a trusted broken notch preserves signed zero in the exact public view',()=>{
 const initial=root(),projection=copy(initial.projection);projection.state.safety.notches={version:2,status:'broken',anchorRow:-0,blockedRows:[-0],source:'imported-current-state'};
 const imported=Route.fromProjection(projection,{openingBoundary:initial.openingBoundary,extendForced:false}),child=Route.step(imported,{witness:['HD']}).route,expected=P.resolve(child.projection);
 assert.equal(Object.is(expected.coveredRepair.notches.anchorRow,-0),true);assert.equal(Object.is(expected.coveredRepair.notches.protectedRows[0],-0),true);assert.deepStrictEqual(Route.resolve(child).facts,expected);
});
test('owned route facts: queue normalization cannot retain a caller map or frozen accessor subject',()=>{
 const initial=root(),projection=copy(initial.projection),queued=projection.supply.queue[0];let backingId=queued.id,mapCalls=0;
 const subject=Object.freeze({get id(){return backingId;},type:queued.type,bag:queued.bag,observedOrder:queued.observedOrder}),queue=projection.supply.queue.slice();queue[0]=subject;
 Object.defineProperty(queue,'map',{value:function(callback,thisArg){mapCalls++;const ordinary=Array.prototype.map.call(this,callback,thisArg);return ordinary.every(x=>x&&typeof x==='object')?this:ordinary;}});Object.freeze(queue);projection.supply.queue=queue;
 const imported=Route.fromProjection(projection,{openingBoundary:initial.openingBoundary,extendForced:false}),child=Route.step(imported,{witness:['HD']}).route;
 assert.notEqual(child.projection.supply.active,subject);assert.equal(Object.getOwnPropertyDescriptor(child.projection.supply.active,'id').get,undefined);assert.equal(mapCalls,0);const expected=Route.resolve(child);
 backingId=child.projection.supply.nextObservedId+100;assert.equal(child.projection.supply.active.id,queued.id);assert.deepStrictEqual(Route.resolve(child),expected);assert.deepStrictEqual(Route.resolve(child).facts,P.resolve(child.projection));assert.throws(()=>P.resolve(imported.projection),/observed allocator/);
});
test('owned route facts: detached queue construction does not invoke caller iterator or species',()=>{
 const initial=root(),projection=copy(initial.projection);let iterated=0,constructed=0;const queue=projection.supply.queue;
 Object.defineProperty(queue,Symbol.iterator,{value:function*(){iterated++;yield* Array.prototype.values.call(this);}});Object.defineProperty(queue,'constructor',{get(){constructed++;throw Error('Caller array species must not be used');}});
 const projected=P.project(projection,{witness:['HD']});assert.equal(constructed,0);assert.equal(iterated,0);assert.notEqual(projected.supply.active,queue[0]);assert.deepStrictEqual(projected.supply.active,queue[0]);
});
