'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),Context=require('../st-obligation-context'),Route=require('../st-obligation-route'),N=require('../st-obligation-resources'),M=require('../st-midgame-resources'),H=require('../st-resource-history'),A=require('../st-access');
const copy=x=>JSON.parse(JSON.stringify(x));
// Migration test oracle only. Production compact start accepts a current
// Context directly and never reads or reconstructs this historical tape.
function currentFromTape(tape,position){
 let raw=R.createState(tape.origin),context=Context.start(raw,{fresh:tape.fresh});
 function mark(at){if(tape.handoffAtAction===at)context=Context.handoff(context,{position:raw}).context;if((tape.resetAtActions||[]).includes(at))context=Context.beginReset(context,{position:raw,candidate:true}).context;}
 mark(0);
 for(const [n,input]of tape.steps.entries()){const before=raw,next=R.move(before,input.action);raw={...next,queue:[...next.queue,...input.revealed]};const result=Context.applyActual(context,{before,action:input.action,after:raw});assert.equal(result.context.status,'available',result.context.reason);context=result.context;mark(n+1);}
 if(position){assert.deepEqual(raw.board,position.board);context=Context.importState(Context.exportState(context),{position});}
 return{position:position||raw,context};
}
function root(f){
 const request=f.request||f,position=R.createState(request.observation),{context}=currentFromTape(request.options.resourceContext,position),summary=H.resolve(position,H.importContext(position,request.options.resourceContext));
 return{position,context,legacy:M.start(M.extendForced(position),summary),compact:N.start(position,context),summary};
}
function fields(resource){return Object.fromEntries(['active','hold','queue','extraZ','extraZRemaining','resetActive','resetProgress','pendingCenter','pendingLDiverted','hangingS','hangingL','violations','scoredTs','introducedUnclassified'].map(k=>[k,k==='pendingLDiverted'?Boolean(resource[k]):resource[k]]));}
function equivalent(a,b){assert.deepEqual(fields(a),fields(b));}
function advanceBoth(r,path){
 let state=M.extendForced(r.position),legacy=r.legacy,compact=r.compact;
 for(const p of path){const replay=R.replay(state,p.witness);assert.equal(replay.valid,true);const placement={state:replay.state,event:replay.events[0],witness:p.witness};legacy=M.step(state,placement,legacy);compact=N.step(state,placement,compact);state=replay.state;equivalent(compact,legacy);}
 return{state,legacy,compact};
}
const legacyProof=({uncertainty,...result})=>result;
const options={maxNodes:4000,deadline:Infinity,now:()=>0};

test('compact resources: literal Context owns observed supply and Route alone extends a forced type',()=>{
 const f=require('./fixtures/forced-bag-resource-binding.json'),r=root(f),saved=Context.exportState(r.context),state=copy(r.position);
 equivalent(r.compact,r.legacy);assert.deepEqual(r.compact.queue.at(-1),{id:-1,type:'I',bag:null});
 assert.deepEqual(N.position(r.compact),M.extendForced(r.position));assert.ok(Object.isFrozen(r.compact)&&Object.isFrozen(r.compact.route));
 assert.throws(()=>N.start(M.extendForced(r.position),r.context),/matching current public position|public position/);
 const a=advanceBoth(r,f.advice.continuation);assert.equal(N.checkPath(r.position,f.advice.continuation,r.context).valid,true);assert.deepEqual(a.compact.hangingS,[]);
 assert.deepEqual(Context.exportState(r.context),saved);assert.deepEqual(r.position,state);
 assert.equal('slHistory'in r.compact,false);assert.equal('observedSL'in r.compact,false);assert.equal('originKey'in r.compact,false);
});
test('compact resources: nested checks preserve the fixed root, scored identities and original obligations',()=>{
 const f=require('./fixtures/forced-bag-resource-binding.json'),r=root(f),whole=N.checkPath(N.position(r.compact),f.advice.continuation,r.compact),first=N.checkPath(N.position(r.compact),f.advice.continuation.slice(0,1),r.compact),tail=N.checkPath(first.state,f.advice.continuation.slice(1),first.resource);
 assert.equal(whole.valid,true);assert.equal(tail.valid,true);assert.equal(N.binding(tail.resource),N.binding(whole.resource));
 assert.deepEqual(tail.resource.route.assessment.root,r.compact.route.assessment.root);assert.equal(tail.resource.schedule.locks,f.advice.continuation.length);
 assert.notEqual(N.binding(first.resource),N.binding(r.compact));
 assert.throws(()=>N.repair(N.position(r.compact),{...r.compact,hangingS:[]},options),/current projected resource required/,'A copied view cannot replace its factual Route authority');
 const wrong=R.createState(first.state);wrong.revision++;assert.throws(()=>N.repair(wrong,first.resource,options),/differs from projected route/);
 const supplied=R.replay(N.position(r.compact),f.advice.continuation[0].witness);supplied.state.hold='J';assert.throws(()=>N.step(N.position(r.compact),{state:supplied.state,event:supplied.events[0],witness:f.advice.continuation[0].witness},r.compact),/differs from projected route/);
});
test('compact resources: unknown same-letter old HOLD stays distinct, immutable and unobserved',()=>{
 const position=R.createState({active:'I',hold:'I',queue:['O','T']}),resource=N.startUnknown(position),saved=copy(resource),replay=R.replay(position,['HOLD','HD']);
 const child=N.step(position,{state:replay.state,event:replay.events[0],witness:['HOLD','HD']},resource);
 assert.equal(child.hold.id,-1);assert.equal(resource.hold.id,-2);assert.equal(child.route.projection.supply.originKnown,false);assert.equal(child.route.projection.supply.frontier,null);
 equivalent(child,M.step(position,{state:replay.state,event:replay.events[0],witness:['HOLD','HD']},M.start(position)));
 assert.deepEqual(resource,saved);const sibling=N.step(position,{witness:['HD']},resource);assert.equal(sibling.hold.id,-2);assert.deepEqual(resource,saved);
});
test('compact resources: exact repair goal is identity-specific and never inferred from an unrelated S',()=>{
 const f=require('./fixtures/forced-bag-resource-binding.json'),r=root(f),placements=R.placements(N.position(r.compact),{maxNodes:45000}).placements,p=placements.find(p=>p.event.type==='S'&&p.event.cells.every(([x])=>x<4));assert.ok(p);
 const subject=[r.compact.active,r.compact.hold,...r.compact.queue].find(s=>s?.id===21);assert.ok(subject);
 for(const instance of [subject,{...subject,id:99}])assert.equal(N.repairGoal(p.event,instance,r.compact),M.repairGoal(p.event,instance,r.legacy));assert.equal(N.repairGoal(p.event,subject,r.compact),true);
});
test('compact resources: ordinary repair retains exact witnesses, work counts and optional filter calls',()=>{
 for(const f of [require('./fixtures/forced-bag-resource-binding.json'),require('./fixtures/repair-cavity.json')]){
  const r=root(f),state=N.position(r.compact);
  for(const control of [{},{depth:0},{maxNodes:0},{maxNodes:1},{maxNodes:80},{deadline:0},{depth:2,centerCompletions:false},{filter:true}]){
   const run=(api,resource)=>{const calls=[];const opts={...options,...control};if(control.filter)opts.acceptStep=(s,p,n)=>{calls.push([s,p.event,n]);return p.event.type!=='I';};delete opts.filter;return{proof:legacyProof(api.repair(state,resource,opts)),calls};};
   const actual=run(N,r.compact),expected=run(M,r.legacy);assert.deepEqual(actual,expected,JSON.stringify(control));
  }
 }
});
test('compact resources: pending L search matches full waiting proof, conditional access, hints and budgets',()=>{
 const f=require('./fixtures/pending-L-visible-stage.json'),steps=require('./fixtures/covered-repair-plan.json').ordinaryCenter.steps,r=root(f),a=advanceBoth(r,steps.slice(0,3));
 assert.equal(N.pendingLStageEligible(a.state,a.compact),true);assert.equal(N.pendingLStageEligible(a.state,a.compact),M.pendingLStageEligible(a.state,a.legacy));
 const proof=N.pendingLStage(a.state,a.compact,options);assert.deepEqual(legacyProof(proof),M.pendingLStage(a.state,a.legacy,options));assert.equal(proof.valid,true);assert.equal(proof.arrival,'not-established');assert.deepEqual(proof.path.map(p=>p.event.type),['O','Z','J','I']);
 for(const opts of [{maxNodes:0},{maxNodes:1},{maxNodes:80},{deadline:0},{waitingHint:{...proof,waiting:proof.path}},{waitingHint:{...proof,waiting:[{...proof.path[0],event:{...proof.path[0].event,lines:4}}]}}])assert.deepEqual(legacyProof(N.pendingLStage(a.state,a.compact,{...options,...opts})),M.pendingLStage(a.state,a.legacy,{...options,...opts}));
 const checked=N.checkPath(a.state,proof.path,a.compact);assert.equal(checked.valid,true);assert.equal(checked.resource.schedule.locks,7);assert.deepEqual(checked.resource.route.assessment.root,r.compact.route.assessment.root);assert.equal(checked.resource.scoredTs.length,1);
 assert.equal(A.repairPrefix(a.state,proof.path,{stages:a.compact.pendingCenter}).valid,true);
});
test('compact resources: bounded request exhaustion stays unfinished rather than throwing or rejecting all routes',()=>{
 const f=require('./fixtures/pending-L-visible-stage.json'),steps=require('./fixtures/covered-repair-plan.json').ordinaryCenter.steps,r=root(f);r.compact=N.start(r.position,r.context,{horizon:3});const a=advanceBoth(r,steps.slice(0,3));
 assert.equal(N.pendingLStage(a.state,a.compact,options).valid,null);assert.equal(N.pendingLStage(a.state,a.compact,options).status,'pending-L-stage-budget');
 assert.equal(N.repair(a.state,a.compact,options).valid,null);assert.equal(N.repair(a.state,a.compact,options).status,'resource-repair-budget');assert.equal(a.compact.schedule.locks,3);
});
function anonymous(s,l=[0]){
 const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),raw=Context.exportState(Context.start(position,{fresh:true}));raw.state.sl.uncertainty={S:s,L:l};
 return{position,context:Context.importState(raw,{position})};
}
test('compact resources: anonymous severe S blocks finite repair without fabricating a named target',()=>{
 for(const counts of [[0,2,0,0],[0,0,2,0],[0,0,0,2]]){const {position,context}=anonymous(counts),resource=N.start(position,context),proof=N.repair(N.position(resource),resource,options);
  assert.equal(N.hasSevereS(resource),true);assert.equal(proof.valid,null);assert.equal(proof.status,'unclassified-S-accommodation');assert.equal(proof.queryStatus,'unfinished');assert.deepEqual(proof.unclassifiedS,[]);assert.equal(proof.uncertainty.S.count,2);assert.equal(proof.uncertainty.S.severeCount,2);assert.deepEqual(resource.introducedUnclassified,[]);
 }
});
test('compact resources: generic anonymous uncertainty carries, is inherited and remains disclosed',()=>{
 const {position,context}=anonymous([2,0,0,0],[3]),resource=N.start(position,context),proof=N.repair(N.position(resource),resource,options);
 assert.equal(N.hasSevereS(resource),false);assert.equal(proof.valid,true);assert.equal(proof.status,'no-confirmed-resource-repair-needed');assert.equal(proof.uncertainty.S.count,2);
 const checked=N.checkPath(position,[{witness:['HD']}],resource);assert.equal(checked.valid,true);assert.equal(checked.resource.uncertainty.S.count,2);assert.equal(checked.resource.uncertainty.L.count,3);assert.equal(N.newUnclassified(checked.resource),false);
 const advice={target:{type:'I'},reason:'Checked prefix.',recommendation:{kind:'supported',hazards:[]},evidence:{resourceObligations:checked.resource}},disclosed=N.discloseAdvice(advice);
 assert.match(disclosed.reason,/2 additional S accommodations/);assert.match(disclosed.reason,/3 additional L accommodations/);assert.equal(disclosed.evidence.resourceDisclosure.identities.length,2);assert.deepEqual(N.discloseAdvice(disclosed),disclosed);assert.equal(N.discloseAdvice({...advice,recommendation:{kind:'risky'}}).evidence.resourceDisclosure,undefined);
});
test('compact resources: inherited aggregate uncertainty cannot become a pending L certificate',()=>{
 const f=require('./fixtures/pending-L-visible-stage.json'),steps=require('./fixtures/covered-repair-plan.json').ordinaryCenter.steps,r=root(f),a=advanceBoth(r,steps.slice(0,3));
 // A trusted current import needs no historical origin for this exact target.
 // Use a disjoint consumed namespace beside the known live supply.
 const {position,context}=anonymous([0,1,0,0]),raw=Context.exportState(context);
 for(const p of [raw.inventory.active,...raw.inventory.queue])p.id+=100;raw.inventory.nextId+=100;
 raw.state.center=copy(a.compact.route.projection.state.center);
 raw.state.sl.residuals=[{bag:0,S:{id:raw.state.center.pending[0].rootId,region:'center',opening:false,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:false,invalidated:false},L:null,order:null,sOwedSinceL:false,lBeforeSPair:false}];
 const resource=N.start(position,Context.importState(raw,{position}));assert.equal(resource.pendingCenter.length,1);assert.equal(N.pendingLStageEligible(position,resource),false);const rejected=N.pendingLStage(position,resource,options);assert.equal(rejected.status,'ineligible-pending-L-stage');assert.equal(rejected.uncertainty.S.severeCount,1);
});
test('compact resources: unavailable current accounting is explicit, never restarted as a fresh account',()=>{
 const {position,context}=anonymous([0,0,0,0]),raw=Context.exportState(context);raw.status='unavailable';raw.reason='test current accounting unavailable';raw.state=null;
 assert.throws(()=>N.start(position,Context.importState(raw,{position})),/current accounting unavailable/);
});
test('compact resources: classic globals use the same single search grammar and compact outcomes',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),realm=vm.createContext({});
 for(const name of ['st-rules','st-bag','st-structure','st-access','st-pattern-history','st-reset-policy','st-opening-patterns','st-public-inventory','st-center-obligations','st-sl-obligations','st-opening-obligations','st-left-obligations','st-obligation-state','st-obligation-context','st-obligation-admission','st-obligation-assessment','st-obligation-projection','st-obligation-route','st-resource-search','st-obligation-resources'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),realm,{filename:name+'.js'});
 const position=R.createState({active:'I',hold:'I',queue:['O']}),resource=N.startUnknown(position),other=realm.STObligationResources.startUnknown(position);
 assert.deepEqual(copy(other),copy(resource));assert.deepEqual(copy(realm.STObligationResources.repair(position,other,options)),N.repair(position,resource,options));assert.deepEqual(copy(realm.STObligationResources.step(position,{witness:['HOLD','HD']},other)),copy(N.step(position,{witness:['HOLD','HD']},resource)));
});

test('compact resources: hypothetical handoff is a deliberate new root and never an actual Context import',()=>{
 const E=require('../st-opening-eligibility'),f=require('./fixtures/forced-bag-resource-binding.json'),r=root(f),first=N.checkPath(N.position(r.compact),f.advice.continuation.slice(0,1),r.compact),saved=copy(first.resource);
 const projected=E.projectHandoff(first.resource.route.projection),resource=N.fromProjection(projected,{openingBoundary:first.resource.route.openingBoundary});
 assert.equal(resource.route.projection.state.domain,'projection');assert.equal(resource.route.projection.state.sl.handoff,true);assert.equal(resource.schedule.locks,0);assert.equal(first.resource.schedule.locks,1);
 assert.deepEqual(resource.route.assessment.root.uncertaintyKeys,resource.initialUnclassified);assert.deepEqual(N.position(resource),first.state);assert.deepEqual(first.resource,saved);assert.equal('effects'in resource.route.projection,false);
 assert.throws(()=>Context.importState(resource.route));assert.throws(()=>N.fromProjection({...projected,state:{...projected.state,domain:'actual'}},{openingBoundary:first.resource.route.openingBoundary}),/projection domain|schema/);
 const malformed=copy(projected);malformed.supply.queue[0].id=malformed.supply.active.id;assert.throws(()=>N.fromProjection(malformed,{openingBoundary:first.resource.route.openingBoundary}),/subject identity/);
 assert.throws(()=>N.fromProjection(projected),/opening boundary required/);
 const continued=N.checkPath(first.state,f.advice.continuation.slice(1),first.resource);assert.equal(continued.resource.schedule.locks,f.advice.continuation.length,'Nested continuation still uses its existing fixed root');
});

test('compact resources: successful exact Center repair uses the same legal unknown-origin L and access proof',()=>{
 const f=require('./support/st-center-stage.json');
 for(const available of [false,true]){
  const raw={...f.origin,queue:available?['S','L','I','O','J','Z']:['S','I','O','J','Z','I']};delete raw.bag;const position=R.createState(raw),context=Context.start(position),summary=H.resolve(position,H.start(position)),r={position,context,legacy:M.start(position,summary),compact:N.start(position,context)},a=advanceBoth(r,f.advice.continuation),opts={...options,maxNodes:10000,depth:2};
  const proof=N.repair(a.state,a.compact,opts);assert.deepEqual(legacyProof(proof),M.repair(a.state,a.legacy,opts));assert.equal(proof.valid,available);
  if(available){assert.equal(proof.path.length,1);assert.equal(proof.path[0].event.type,'L');const done=N.checkPath(a.state,proof.path,a.compact);assert.equal(done.valid,true);assert.deepEqual(done.resource.pendingCenter,[]);assert.equal(done.resource.schedule.locks,f.advice.continuation.length+1);assert.equal(A.prefix(a.state,proof.path,{maxNodes:10000,now:()=>0}).reachable,true);}
 }
});

test('compact resources: successful pending L waiting preserves generic anonymous counts in the proof result',()=>{
 const f=require('./fixtures/pending-L-visible-stage.json'),steps=require('./fixtures/covered-repair-plan.json').ordinaryCenter.steps,r=root(f),a=advanceBoth(r,steps.slice(0,3)),base=anonymous([2,0,0,0],[3]),raw=Context.exportState(base.context);
 // Trusted current fixture: exact public position and target, with a separate
 // observed namespace. These supplied facts need no replayed ancestry.
 let id=101;const subject=p=>p?{id:id++,type:p.type,bag:0,observedOrder:id-2}:null;
 raw.inventory.active=subject(a.compact.active);raw.inventory.hold=subject(a.compact.hold);raw.inventory.queue=a.compact.queue.map(subject);raw.inventory.nextId=id;raw.inventory.streamCursor=a.state.streamCursor;
 raw.inventory.knowledge=a.state.bag||null;raw.inventory.frontier={bag:0,seenMask:[raw.inventory.active,raw.inventory.hold,...raw.inventory.queue,{type:'S'}].filter(Boolean).reduce((mask,p)=>mask|1<<'IJLOSTZ'.indexOf(p.type),0)};raw.state.center=copy(a.compact.route.projection.state.center);
 raw.state.sl.residuals=[{bag:0,S:{id:raw.state.center.pending[0].rootId,region:'center',opening:false,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:false,invalidated:false},L:null,order:null,sOwedSinceL:false,lBeforeSPair:false}];
 const context=Context.importState(raw,{position:a.state}),resource=N.start(a.state,context),proof=N.pendingLStage(N.position(resource),resource,options);
 assert.equal(proof.valid,true);assert.equal(proof.uncertainty.S.aggregate[0],2);assert.equal(proof.uncertainty.L.aggregate[0],3);assert.equal(proof.uncertainty.S.severeCount,0);assert.equal(proof.arrival,'not-established');
 const endpoint=N.checkPath(N.position(resource),proof.path,resource);assert.equal(endpoint.valid,true);assert.deepEqual(proof.uncertainty,endpoint.resource.uncertainty);
});
