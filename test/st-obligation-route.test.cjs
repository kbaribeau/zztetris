'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Route=require('../st-obligation-route'),Context=require('../st-obligation-context'),Q=require('../st-obligation-state'),I=require('../st-public-inventory'),R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources');
const copy=x=>JSON.parse(JSON.stringify(x)),first=()=>R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1});
function currentFromTape(tape){
 let position=R.createState(tape.origin),context=Context.start(position,{fresh:tape.fresh});
 function mark(at){if(tape.handoffAtAction===at)context=Context.handoff(context,{position}).context;if((tape.resetAtActions||[]).includes(at))context=Context.beginReset(context,{position,candidate:true}).context;}
 mark(0);
 for(const [n,input]of tape.steps.entries()){const before=position,next=R.move(before,input.action);position={...next,queue:[...next.queue,...input.revealed]};const result=Context.applyActual(context,{before,action:input.action,after:position});assert.equal(result.context.status,'available',result.context.reason);context=result.context;mark(n+1);}
 return{position,context};
}
const semanticUncertain=rows=>rows.map(({reason,at,...p})=>p).sort((a,b)=>a.bag-b.bag);
function compareResources(actual,expected){
 for(const field of ['extraZ','extraZRemaining','resetActive','resetProgress','centerBlocked','tCollision'])assert.equal(actual[field],expected[field],field);
 for(const field of ['hangingS','hangingL','hangingLive','violations','scoredTs','pendingCenter'])assert.deepEqual(actual[field],expected[field]||[],field);
 for(const field of ['unclassifiedS','unclassifiedL'])assert.deepEqual(semanticUncertain(actual[field]),semanticUncertain(expected[field]||[]),field);
 assert.deepEqual(actual.introducedUnclassified.slice().sort(),expected.introducedUnclassified.slice().sort());
}
test('route: fresh factual projection and request permission are immutable, separate and not actual state',()=>{
 const position=first(),context=Context.start(position,{fresh:true}),route=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary}),saved=copy(route);
 assert.ok(Object.isFrozen(route)&&Object.isFrozen(route.projection.state));assert.equal(route.domain,'projection-route');assert.equal(route.projection.state.domain,'projection');
 const child=Route.step(route,{witness:['HD']});assert.equal(child.locked.type,'I');assert.notEqual(Route.binding(child.route),Route.binding(route));assert.deepEqual(route,saved);
 assert.throws(()=>Q.importState(child.route.projection.state));assert.equal(I.importState(child.route.projection.supply).status,'invalid');assert.equal('effects'in child.route,false);assert.equal('effects'in child.route.projection,false);
 assert.deepEqual(Route.resolve(route).resources.violations,[]);assert.notEqual(child.route.assessment,route.assessment);
});
test('route: S85 remains disclosed during ordinary continuation and known L37 loss remains Reset-specific',()=>{
 for(const [n,f]of require('./fixtures/resource-projection-history.json').cases.entries()){
  const root=currentFromTape(f.resourceContext),state=R.createState(f.observation);assert.deepEqual(root.position.board,state.board);
  const summary=H.resolve(state,H.importContext(state,f.resourceContext)),oldRoot=M.start(M.extendForced(state),summary);
  const route=Route.start(root.context.state,{position:root.position,inventory:root.context.inventory,openingBoundary:root.context.boundary}),witness=f.witness,result=Route.step(route,{witness}),replayed=R.replay(M.extendForced(state),witness);
  const expected=M.step(M.extendForced(state),{state:replayed.state,event:replayed.events[0],witness},oldRoot);compareResources(Route.resolve(result.route).resources,expected);
  if(n===0){assert.equal(result.assessmentStep.knownToUnclassified,false);assert.ok(Route.resolve(result.route).resources.unclassifiedS.some(p=>p.sId===85));}
  else assert.equal(result.assessmentStep.resetLosesObligation,true);
 }
});
test('route: unknown-origin HOLD keeps request identities distinct without acquiring bags',()=>{
 const position=R.createState({active:'I',hold:'I',queue:['O','T']}),route=Route.startUnknown(position),old=M.start(position,{}),witness=['HOLD','HD'],p=R.replay(position,witness),next=Route.step(route,{witness});
 assert.equal(next.locked.id,-2);assert.equal(next.locked.bag,null);assert.equal(next.route.projection.supply.hold.id,-1);assert.equal(Route.resolve(next.route).facts.availability,'unknown');compareResources(Route.resolve(next.route).resources,M.step(position,{state:p.state,event:p.events[0],witness},old));
});
test('route: finite path validates events and keeps invalid hypothetical input atomic',()=>{
 const position=first(),context=Context.start(position,{fresh:true}),route=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary,horizon:1}),saved=copy(route),r=R.replay(position,['HD']),event=r.events[0];
 assert.equal(Route.checkPath(route,[{witness:['HD'],event}]).valid,true);
 const failed=Route.checkPath(route,[{witness:['HD'],event:{...event,lines:4}}]);assert.equal(failed.valid,false);assert.equal(failed.reason,'invalid-resource-witness');assert.deepEqual(route,saved);
 const one=Route.step(route,{witness:['HD']}).route;assert.throws(()=>Route.step(one,{witness:['HD']}),/horizon/);assert.deepEqual(route,saved);
});

test('route: complete public continuations preserve fixed-root uncertainty and Reset loss checks at every step',()=>{
 const cases=require('./fixtures/resource-projection-history.json').cases;
 for(const f of cases){const actual=currentFromTape(f.resourceContext),position=R.createState(f.observation),summary=H.resolve(position,H.importContext(position,f.resourceContext));
  let route=Route.start(actual.context.state,{position,inventory:actual.context.inventory,openingBoundary:actual.context.boundary}),oldPosition=M.extendForced(position),old=M.start(oldPosition,summary);
  for(const p of f.continuation){const replay=R.replay(oldPosition,p.witness);assert(replay.valid);const before=old;old=M.step(oldPosition,{state:replay.state,event:replay.events[0],witness:p.witness},old);const result=Route.step(route,{witness:p.witness,event:replay.events[0]});route=result.route;compareResources(Route.resolve(route).resources,old);assert.equal(result.assessmentStep.resetLosesObligation,M.resetLosesObligation(before,old));oldPosition=replay.state;}
 }
});
test('route: real visible-J repair stays permitted while newly uncertain S15 remains tracked',()=>{
 const f=require('./fixtures/visible-left-repair.json'),position=R.createState(f.observation),actual=currentFromTape(f.options.resourceContext),P=require('../st-planner');
 const advice=P.decide(position,{...f.options,depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});assert.equal(advice.metrics.visibleLeftRepair.selected,true);assert.equal(advice.continuation.at(-1).event.type,'J');
 const route=Route.start(actual.context.state,{position,inventory:actual.context.inventory,openingBoundary:actual.context.boundary}),before=Route.resolve(route).resources,result=Route.checkPath(route,advice.continuation);assert.equal(result.valid,true,result.detail||result.reason);
 const after=Route.resolve(result.route).resources;assert.equal(before.uncertainty.S.count,0);assert.equal(after.uncertainty.S.count,1);assert.equal(after.hasSevereS,false);assert.ok(after.unclassifiedS.some(p=>p.sId===15));assert.ok(after.introducedUnclassified.some(k=>k.startsWith('S:15:')),'New S15 consequence stays tracked through the full J repair');
});
test('route: exact source boundary at seven locks matches actual current state without storing elapsed history',()=>{
 const Patterns=require('../st-opening-patterns'),pattern=Patterns.patterns[0],types='IJLOSTZ',path=[];
 function find(mask){if(mask===127)return true;for(const [from,type,witness]of pattern.edges){const bit=1<<types.indexOf(type);if(from!==mask||mask&bit)continue;path.push({type,witness});if(find(mask|bit))return true;path.pop();}return false;}
 assert.ok(find(0));let position=R.createState({active:path[0].type,queue:path.slice(1).map(p=>p.type),streamCursor:1}),context=Context.start(position,{fresh:true}),route=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary,horizon:7});
 assert.throws(()=>Route.start(context.state,{position,inventory:context.inventory}),/opening boundary required/);
 for(const p of path){const witness=[...p.witness].map(a=>Patterns.actionCodes[a]);route=Route.step(route,{witness}).route;for(const action of witness){const before=position;position=R.move(before,action);const result=Context.applyActual(context,{before,action,after:position});assert.equal(result.context.status,'available');context=result.context;}}
 assert.deepEqual(route.openingBoundary,context.boundary);assert.equal(route.openingBoundary.firstBagLocks,7);assert.equal(route.openingBoundary.sourcePatternSeen,true);assert.equal(route.projection.state.sl.firstBagReview,'reviewed');assert.equal(route.projection.state.sl.foundationOpen,false);
});

test('route: classic global loading uses the same projected state and policy without actual receipts',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),realm=vm.createContext({});
 for(const name of ['st-rules','st-bag','st-structure','st-access','st-pattern-history','st-reset-policy','st-opening-patterns','st-public-inventory','st-center-obligations','st-sl-obligations','st-opening-obligations','st-left-obligations','st-obligation-state','st-obligation-context','st-obligation-admission','st-obligation-assessment','st-obligation-projection','st-obligation-route'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),realm,{filename:name+'.js'});
 const position=first(),native=Context.start(position,{fresh:true}),other=realm.STObligationContext.start(position,{fresh:true}),a=Route.start(native.state,{position,inventory:native.inventory,openingBoundary:native.boundary}),b=realm.STObligationRoute.start(other.state,{position,inventory:other.inventory,openingBoundary:other.boundary});
 const left=Route.step(a,{witness:['HOLD','HOLD','HD']}),right=realm.STObligationRoute.step(b,{witness:['HOLD','HOLD','HD']});assert.deepEqual(copy(right),copy(left));assert.deepEqual(copy(realm.STObligationRoute.resolve(right.route)),Route.resolve(left.route));
});
