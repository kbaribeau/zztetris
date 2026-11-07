'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Provider=require('../st-resource-provider'),Legacy=require('../st-resource-legacy'),C=require('../st-obligation-context'),Q=require('../st-obligation-state'),N=require('../st-obligation-resources'),R=require('../st-rules'),H=require('../st-resource-history'),B=require('../st-bag');
const copy=x=>JSON.parse(JSON.stringify(x)),first=()=>R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1});
const native=(position=first())=>({position,context:C.start(position,{fresh:true})});
function replay(tape){
 let position=R.createState(tape.origin),context=C.start(position,{fresh:tape.fresh});
 const mark=at=>{if(tape.handoffAtAction===at)context=C.handoff(context,{position}).context;if((tape.resetAtActions||[]).includes(at))context=C.beginReset(context,{position,candidate:true}).context;};mark(0);
 for(const [index,step]of tape.steps.entries()){const before=position,next=R.move(before,step.action);position={...next,queue:[...next.queue,...step.revealed]};context=C.applyActual(context,{before,action:step.action,after:position}).context;assert.equal(context.status,'available',context.reason);mark(index+1);}return{position,context};
}
function providerWithLegacy(convert){const sandbox={module:{exports:{}},require:name=>name==='./st-resource-legacy'?{convert}:require('../'+name.slice(2))};vm.runInNewContext(fs.readFileSync(require.resolve('../st-resource-provider'),'utf8'),sandbox);return sandbox.module.exports;}
function accountRoot(remaining=1){const position=R.createState({active:'Z',queue:[...'IJLOST'],streamCursor:1}),raw=C.exportState(C.start(position,{fresh:true}));raw.state.sl.foundationOpen=false;Object.assign(raw.state.account,{firstTsd:true,allocationVerified:true,opening:null});raw.state.account.profile.before=null;raw.state.account.profile.capEstablished=true;raw.state.account.z.remaining=remaining;return{position,context:C.importState(raw,{position})};}

test('provider: native current import is trusted structural authority and never invokes legacy replay',()=>{
 const {position,context}=native(),raw=C.exportState(context);raw.inventory.nextId=1000000;raw.state.safety.coveredCells=[[1,35]];raw.state.dPending=true;
 const api=providerWithLegacy(()=>{throw Error('Native input invoked legacy converter');}),input=api.prepare(position,{obligationContext:raw});
 assert.equal(input.kind,'current');assert.equal(input.supplied,true);assert.equal(input.status,'available');assert.equal(input.facts.availability,'known');assert.deepEqual(copy(input.facts.coveredRepair.cells),[[1,35]]);assert.equal(input.facts.dPattern.pending,true);assert.equal(input.context.inventory.nextId,1000000);
 assert.deepEqual(copy(api.exportActual(input)),raw);assert.ok(Object.isFrozen(input)&&Object.isFrozen(input.frame)&&Object.isFrozen(input.facts));
 for(const key of ['coverage','allocations','observedSL','pairs','milestones','actions','locks'])assert.equal(key in input.facts,false,key);
 assert.equal('episodes'in input.facts.reset,false);assert.equal('counts'in input.facts.openingAllocation,false);assert.equal('history'in input,false);
});
test('provider: missing, explicitly null and malformed native inputs stay distinct without restarting',()=>{
 const {position,context}=native(),implicit=Provider.prepare(position);assert.equal(implicit.kind,'implicit-unknown');assert.equal(implicit.supplied,false);assert.equal(implicit.facts.availability,'unknown');assert.ok(implicit.facts.instances.active.id>0);assert.equal(implicit.context,null);assert.throws(()=>Provider.exportActual(implicit),/actual current/);
 const unknown=Provider.prepare(position,{obligationContext:C.start(position)});assert.equal(unknown.kind,'current');assert.equal(unknown.supplied,true);assert.equal(unknown.facts.availability,'unknown');assert.ok(unknown.facts.instances.active.id>0);
 for(const raw of [null,{}, {...C.exportState(context),status:'unavailable',reason:'Retained accounting fault',state:null}]){const input=Provider.prepare(position,{obligationContext:raw});assert.equal(input.status,'unavailable');assert.equal(input.supplied,true);assert.equal(input.frame,null);assert.equal(input.facts.availability,'unavailable');assert.throws(()=>Provider.startRoute(input),/unavailable/);assert.equal(Provider.prepare(position,{resourceInput:input}),input);}
 assert.equal(Provider.prepare(position,{resourceContext:null}).supplied,false);assert.equal(Provider.prepare(position,{obligationContext:context,resourceContext:null}).status,'available');
 assert.throws(()=>Provider.prepare(position,{obligationContext:context,resourceContext:{}}),/conflict/);
 assert.equal(Provider.prepare(position,{obligationContext:null,resourceContext:{}}).status,'unavailable');
});
test('provider: malformed literal positions remain unavailable rather than throwing or claiming fresh facts',()=>{
 for(const raw of [null,{}, {...first(),queue:Array(7).fill('I')}])assert.equal(Provider.prepare(raw).status,'unavailable');
 const cyclic={};cyclic.self=cyclic;assert.equal(Provider.prepare(cyclic).status,'unavailable');
});
test('provider: prepared inputs are reused once across normalized public entry points',()=>{
 const f=require('./fixtures/forced-bag-resource-binding.json'),position=R.createState(f.observation);let calls=0;
 const api=providerWithLegacy((...args)=>{calls++;return Legacy.convert(...args);}),input=api.prepare(position,f.options);assert.equal(input.status,'available',input.reason);assert.equal(input.kind,'legacy-converted');assert.equal(calls,1);
 const options=api.withOptions(position,{...f.options,resourceInput:input});assert.equal(options.resourceInput,input);assert.equal(api.prepare({...position,lastEvent:{diagnostic:true}},options),input);assert.equal(calls,1);
 assert.throws(()=>api.prepare({...position,revision:position.revision+1},options),/differs/);assert.throws(()=>api.prepare(position,{resourceInput:copy(input)}),/prepared/);
});
test('provider: finite legacy converter preserves replayed current state, handoff, Reset and inherited cells',()=>{
 const fixtures=[require('./fixtures/forced-bag-resource-binding.json'),...require('./fixtures/resource-projection-history.json').cases];
 for(const f of fixtures){const tape=f.resourceContext||f.options.resourceContext,position=R.createState(f.observation),converted=Legacy.convert(position,tape),actual=replay(tape);assert.equal(converted.status,'available',converted.reason);assert.deepEqual(converted.context.state,actual.context.state);assert.deepEqual(converted.context.boundary,actual.context.boundary);assert.deepEqual(converted.context.inventory,actual.context.inventory);assert.equal('history'in converted,false);
  const input=Provider.prepare(position,{obligationContext:converted.context});assert.deepEqual(input.facts.observedRemainingTypes,[...'IJLOSTZ'].filter(type=>!(actual.context.inventory.frontier.seenMask&(1<<'IJLOSTZ'.indexOf(type)))));
  if(actual.context.state.account.reset.status==='active')assert.deepEqual(input.facts.reset.inheritedCovered,actual.context.state.account.reset.inheritedCovered);
 }
});
test('provider: legacy rejected inputs, mismatched endpoints, markers and finite limits remain unavailable',()=>{
 const position=first(),history=H.start(position,{fresh:true}),tape=copy(H.exportContext(position,history));
 const variants=[{...tape,steps:[{action:'NOPE',revealed:[]}]},{...tape,handoffAtAction:1},{...tape,resetAtActions:[0]},{...tape,steps:Array(4097).fill({action:'L',revealed:[]})}];
 for(const invalid of variants){assert.equal(Legacy.convert(position,invalid).status,'unavailable');assert.equal(Provider.prepare(position,{resourceContext:invalid}).supplied,true);assert.equal(Provider.prepare(position,{resourceContext:invalid}).status,'unavailable');}
 assert.equal(Legacy.convert(R.move(position,'L'),tape).status,'unavailable');assert.equal(Legacy.fromHistory(position,history).status,'available');
});
test('provider: legacy current partial-origin bag knowledge and session origin checks are retained',()=>{
 const bag=B.fromObserved({observed:['I','J','L']}),position=R.createState({active:'I',queue:['J','L'],bag}),history=H.start(position),tape=H.exportContext(position,history),result=Legacy.convert(position,tape,{resourceOriginBag:bag});
 assert.equal(result.status,'available',result.reason);assert.deepEqual(result.context.inventory.knowledge,bag);assert.equal(result.context.state.availability,'unknown');assert.equal(Legacy.convert(position,tape,{resourceOriginBag:null}).status,'unavailable');
 const f=first(),freshTape=H.exportContext(f,H.start(f,{fresh:true})),known=B.fromObserved({observed:['I',...'JLOSTZ'],startPhase:0});assert.equal(Legacy.convert({...f,bag:known},freshTape,{resourceOriginBag:known}).status,'available');assert.equal(Legacy.convert(f,freshTape,{resourceOriginBag:null}).status,'unavailable');
});
test('provider: literal facts and public frontier never include a forced synthetic tail',()=>{
 const f=require('./fixtures/forced-bag-resource-binding.json'),position=R.createState(f.observation),input=Provider.prepare(position,f.options),saved=copy(input),resource=Provider.startRoute(input);
 assert.equal(input.facts.instances.queue.length,6);assert.deepEqual(input.facts.observedRemainingTypes,['I']);assert.equal(resource.queue.length,7);assert.ok(resource.queue.at(-1).id<0);assert.deepEqual(Provider.facts(input),input.facts);assert.deepEqual(input,saved);
 const literal=Provider.startRoute(input,{extendForced:false});assert.deepEqual(N.position(literal),input.frame.position);assert.equal(literal.queue.length,6);const child=N.step(N.position(literal),{witness:['L','L','L','HD']},literal);assert.equal(child.route.extendForced,false);assert.equal(child.queue.length,5);assert.equal(child.queue.some(p=>p.id<0),false);assert.deepEqual(child.route.projection.supply.frontier,input.frame.supply.frontier);
});
test('provider: factual projections preserve boundary and never use ordinary T admission as authority',()=>{
 const position=R.createState({active:'T',queue:[...'IJLOSZ'],streamCursor:1}),context=C.start(position,{fresh:true}),input=Provider.prepare(position,{obligationContext:context}),saved=copy(input),witness=['L','L','L','HD'];
 const projected=Provider.project(input,{witness}),route=Provider.startRoute(input),assessed=N.step(N.position(route),{witness},route);assert.equal(projected.openingBoundary.firstBagLocks,1);assert.equal(projected.state.account.profile.before.t,1);assert.equal('assessment'in projected,false);assert.ok(assessed.violations.includes('ordinary-T-must-score'));assert.deepEqual(input,saved);assert.equal(Provider.facts(projected).status,'available');
 const ready=Provider.prepare(projected.position,{resourceInput:projected});assert.equal(ready.supplied,true);assert.equal(ready.context,null);assert.throws(()=>Provider.exportActual(ready),/actual current/);assert.throws(()=>C.importState(projected),/shape/);
});
test('provider: projected handoff and Begin Reset preserve origin availability and actual inherited cells',()=>{
 const unknown=Provider.prepare(first()),unknownMarked=Provider.projectHandoff(unknown),unknownInput=Provider.prepare(unknownMarked.position,{resourceInput:unknownMarked});assert.equal(unknownInput.supplied,false);assert.equal(unknownInput.kind,'implicit-unknown');assert.throws(()=>Provider.exportActual(unknownInput),/actual current/);
 const {position,context}=accountRoot(0),raw=C.exportState(context);raw.state.safety.coveredCells=[[0,30],[1,31]];const input=Provider.prepare(position,{obligationContext:raw}),marked=Provider.projectHandoff(input),reset=Provider.projectBeginReset(marked,{candidate:true});
 assert.equal(reset.state.sl.handoff,true);assert.equal(reset.state.account.reset.status,'active');assert.deepEqual(Provider.facts(reset).reset.inheritedCovered,[[0,30],[1,31]]);assert.equal(input.frame.state.account.reset.status,'inactive');
 const selected=Provider.startRoute(reset,{extendForced:false});assert.equal(selected.resetActive,true);assert.equal(selected.resetProgress,0);assert.equal(Provider.eligibility(reset).historicalHandoff,true);
});
test('provider: current safety notch state overrides a separate caller history without altering facts',()=>{
 const {position,context}=native(),raw=C.exportState(context);raw.state.safety.notches={version:2,status:'established',anchorRow:35,blockedRows:[],source:'current-trusted'};
 const options=Provider.withOptions(position,{obligationContext:raw,patternHistory:{invalid:true}});assert.deepEqual(options.patternHistory,raw.state.safety.notches);assert.deepEqual(Provider.exportActual(options.resourceInput),raw);
});
test('provider: root compatibility normalizes actual/projected tags and excludes budget, pose and plan association',()=>{
 const {position:literal,context}=native(),position={...literal,bag:copy(context.inventory.knowledge)},input=Provider.prepare(position,{obligationContext:context}),a=Provider.startRoute(input,{horizon:2}),b=Provider.startRoute(input,{horizon:20,planReferences:[1,2]});
 assert.equal(N.rootBinding(a),N.rootBinding(b));assert.equal(N.rootBinding(a),Provider.binding(input));assert.equal(N.factualBinding(context.state,context.inventory,context.boundary),Provider.binding(input));assert.notEqual(N.binding(a),N.binding(b));
 const moved=R.move(position,'L'),m=Provider.prepare(moved,{obligationContext:context});assert.equal(Provider.binding(m),Provider.binding(input));assert.equal(Provider.bound(moved,input),false);
 const raw=C.exportState(context);raw.state.dPending=true;assert.notEqual(Provider.binding(Provider.prepare(position,{obligationContext:raw})),Provider.binding(input));
 const swapped=C.exportState(context);[swapped.inventory.active.id,swapped.inventory.queue[0].id]=[swapped.inventory.queue[0].id,swapped.inventory.active.id];assert.notEqual(Provider.binding(Provider.prepare(position,{obligationContext:swapped})),Provider.binding(input));
});
test('provider: nested resource steps and checks keep their fixed root while explicit new query roots change',()=>{
 const {position,context}=native(),input=Provider.prepare(position,{obligationContext:context}),root=Provider.startRoute(input),first=N.checkPath(N.position(root),[{witness:['HD']}],root),tail=N.checkPath(first.state,[{witness:['HD']}],first.resource),whole=N.checkPath(N.position(root),[{witness:['HD']},{witness:['HD']}],root);
 assert.equal(tail.valid,whole.valid);assert.equal(N.binding(tail.resource),N.binding(whole.resource));assert.equal(N.rootBinding(tail.resource),N.rootBinding(root));assert.notEqual(N.binding(tail.resource),N.binding(root));
 const projected=Provider.project(input,{witness:['HD']}),newRoot=Provider.startRoute(Provider.projectHandoff(projected));assert.notEqual(N.rootBinding(newRoot),N.rootBinding(root));assert.equal(newRoot.schedule.locks,0);assert.equal(first.resource.schedule.locks,1);
});
test('provider: Extra-Z tie binding permits spent versus preserved account while retaining current SL and identities',()=>{
 const {position,context}=accountRoot(),input=Provider.prepare(position,{obligationContext:context}),root=Provider.startRoute(input),spent=N.step(N.position(root),{witness:['L','L','L','HD']},root),kept=N.step(N.position(root),{witness:['CW','R','R','R','R','HD']},root);
 assert.equal(spent.extraZ,'used');assert.equal(kept.extraZ,'available');assert.equal(N.rootBinding(spent),N.rootBinding(kept));assert.notEqual(N.binding(spent),N.binding(kept));assert.equal(N.spendNeutralBinding(spent),N.spendNeutralBinding(kept));assert.notEqual(N.diversityBinding(spent),N.diversityBinding(kept));
 const raw=C.exportState(context);raw.state.sl.uncertainty.S[1]=1;const uncertain=Provider.startRoute(Provider.prepare(position,{obligationContext:raw}));assert.notEqual(N.spendNeutralBinding(uncertain),N.spendNeutralBinding(root));assert.notEqual(N.diversityBinding(uncertain),N.diversityBinding(root));assert.equal(uncertain.uncertainty.S.count,1);assert.equal(uncertain.hasSevereS,true);
});
test('provider: scheduling diversity is available only after a known factual handoff',()=>{
 const {position,context}=native(),input=Provider.prepare(position,{obligationContext:context});assert.equal(N.historyDiversityEnabled(Provider.startRoute(input)),false);assert.equal(N.historyDiversityEnabled(Provider.startRoute(Provider.projectHandoff(input))),true);assert.equal(N.historyDiversityEnabled(Provider.startRoute(Provider.projectHandoff(Provider.prepare(position)))),false);
});
test('provider: classic globals expose the same current path without importing old state',()=>{
 const realm=vm.createContext({}),names=['st-rules','st-bag','st-structure','st-access','st-pattern-history','st-reset-policy','st-opening-patterns','st-public-inventory','st-center-obligations','st-resource-history','st-sl-obligations','st-opening-obligations','st-obligation-state','st-obligation-context','st-obligation-admission','st-obligation-assessment','st-obligation-projection','st-obligation-route','st-resource-search','st-obligation-resources','st-opening-eligibility','st-resource-legacy','st-resource-provider'];
 for(const name of names)vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),realm,{filename:name+'.js'});
 const {position,context}=native(),actual=realm.STResourceProvider.prepare(position,{obligationContext:C.exportState(context)}),expected=Provider.prepare(position,{obligationContext:context});assert.deepEqual(copy(actual),copy(expected));assert.equal(realm.STResourceProvider.binding(actual),Provider.binding(expected));assert.deepEqual(copy(realm.STResourceProvider.project(actual,{witness:['HD']})),copy(Provider.project(expected,{witness:['HD']})));
});


test('provider: implicit observed identities remain actual even with unknown accounting and a same-letter held piece',()=>{
 const position=R.createState({active:'I',hold:'I',queue:['O','T']}),input=Provider.prepare(position),route=Provider.startRoute(input,{extendForced:false}),next=N.step(N.position(route),{witness:['HOLD','HD']},route);
 assert.equal(input.supplied,false);assert.equal(input.availability,'unknown');assert.equal(input.facts.instances.active.id,1);assert.equal(input.facts.instances.hold.id,2);assert.equal(input.frame.supply.nextSyntheticId,-1);assert.equal(next.hold.id,1);assert.equal(next.active.id,3);assert.equal(input.context,null);
});
test('provider: explicit non-native current notch sidecars preserve carried anchors and sticky broken rows once',()=>{
 const position=first(),pattern={version:2,status:'broken',anchorRow:38,blockedRows:[38,32],source:'carried-old-checkpoint'},history=H.start(position),tape=H.exportContext(position,history);
 for(const options of [{patternHistory:pattern},{resourceContext:tape,patternHistory:pattern}]){
  const input=Provider.prepare(position,options);assert.equal(input.status,'available',input.reason);assert.equal(input.availability,'unknown');assert.deepEqual(input.frame.state.safety.notches,pattern);assert.deepEqual(Provider.withOptions(position,{...options,resourceInput:input}).patternHistory,pattern);
  const reused=Provider.prepare(position,{resourceInput:input,patternHistory:{version:2,status:'invalid-history'}});assert.equal(reused,input);assert.deepEqual(reused.frame.state.safety.notches,pattern);
 }
});
test('provider: explicit legacy notch tape becomes a current checkpoint and malformed sidecars fail closed',()=>{
 const Pattern=require('../st-pattern-history'),f=require('./support/st-gap-phase.json').quad,initial=R.createState(f.observation),before=R.replay(initial,f.witness.slice(0,-1)).state,replayed=R.replay(before,['HD']),position=replayed.state,tape={origin:initial.board.slice(),steps:[{pose:copy(before.active),event:copy(replayed.events[0])}]};
 const input=Provider.prepare(position,{patternHistory:tape});assert.equal(input.status,'available',input.reason);assert.equal(input.frame.state.safety.notches.anchorRow,38);assert.deepEqual(input.frame.state.safety.notches,Pattern.snapshot(position,tape));assert.equal('steps'in input.frame.state.safety.notches,false);
 for(const patternHistory of [false,{}, {...tape,steps:[{...tape.steps[0],event:{...tape.steps[0].event,lines:0}}]}, {version:2,status:'established',anchorRow:38,blockedRows:[38]}]){const rejected=Provider.prepare(position,{patternHistory});assert.equal(rejected.status,'unavailable');assert.match(rejected.reason,/notch checkpoint/);assert.equal(rejected.supplied,false);}
});


test('provider: omitted and null request bag cannot extend supply or change imported actual knowledge',()=>{
 const Planner=require('../st-planner'),f=require('./fixtures/forced-bag-resource-binding.json'),original=R.createState(f.observation),context=Legacy.convert(original,f.options.resourceContext).context,snapshot=C.exportState(context);
 for(const mode of ['absent','null','present']){
  const position=copy(original);if(mode==='absent')delete position.bag;else if(mode==='null')position.bag=null;
  const input=Provider.prepare(position,{obligationContext:snapshot});assert.equal(input.status,'available',input.reason);assert.deepEqual(Provider.exportActual(input),snapshot);assert.deepEqual(input.facts.observedRemainingTypes,['I']);assert.deepEqual(input.context.inventory.frontier,snapshot.inventory.frontier);
  assert.deepEqual(input.frame.supply.knowledge,mode==='present'?original.bag:null);const root=Provider.startRoute(input);assert.equal(root.queue.length,mode==='present'?7:6);assert.equal(root.queue.filter(p=>p.id<0).length,mode==='present'?1:0);
  let current=N.position(root);const path=f.advice.continuation.map(step=>{const replay=R.replay(current,step.witness);assert.equal(replay.valid,true);current=replay.state;return{witness:step.witness,event:replay.events[0],state:replay.state};});
  const checked=N.checkPath(N.position(root),path,root);assert.equal(checked.valid,true,checked.reason);assert.ok(Planner.publicDrawHorizon(position,path,input.facts),'literal draw comparison must match '+mode+' bag request');assert.deepEqual(Provider.exportActual(input),snapshot);
 }
 const conflict={...original,bag:{remaining:[2],observedCount:27,provenance:'known-phase'}};assert.equal(Provider.prepare(conflict,{obligationContext:snapshot}).status,'unavailable');
});
test('provider: explicit null old notch sidecar requests fresh geometry while absent and native preserve carried phase',()=>{
 const f=require('./support/st-gap-phase.json').quad;let position=R.createState(f.observation),history=H.start(position);
 for(const action of f.witness){const before=position;position=R.move(before,action);history=H.applyAction(history,before,action,position);}
 const resourceContext=H.exportContext(position,history),absent=Provider.prepare(position,{resourceContext}),fresh=Provider.prepare(position,{resourceContext,patternHistory:null});assert.equal(absent.status,'available',absent.reason);assert.equal(fresh.status,'available',fresh.reason);
 assert.equal(absent.frame.state.safety.notches.anchorRow,38);assert.equal(absent.facts.coveredRepair.notches.status,'established');assert.equal(fresh.frame.state.safety.notches,null);assert.equal(fresh.facts.coveredRepair.notches.status,'unanchored');
 const native=Provider.prepare(position,{obligationContext:Provider.exportActual(absent),patternHistory:null});assert.deepEqual(native.frame.state.safety.notches,absent.frame.state.safety.notches);
 const implicit=Provider.prepare(R.createState(f.observation),{patternHistory:null});assert.equal(implicit.status,'available');assert.equal(implicit.frame.state.safety.notches,null);assert.equal(implicit.facts.coveredRepair.notches.status,'established');
});
