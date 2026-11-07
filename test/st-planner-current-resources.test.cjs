'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const P=require('../st-planner'),Provider=require('../st-resource-provider'),C=require('../st-obligation-context'),M=require('../st-obligation-resources'),R=require('../st-rules'),PH=require('../st-pattern-history');
const clone=x=>JSON.parse(JSON.stringify(x)),bounds={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity};
function currentRequest(f){const input=Provider.prepare(f.observation,f.options);assert.equal(input.status,'available',input.reason);const options={...f.options,...bounds,obligationContext:Provider.exportActual(input)};delete options.resourceContext;return{observation:f.observation,options};}
function verified(raw,advice){assert(advice.target,advice.reason);let state=P.observe(raw);for(const step of advice.continuation){const r=R.replay(state,step.witness);assert(r.valid);assert.deepEqual(r.events,[step.event]);state=r.state;}return state;}
function knownCap(){
 const {fixtures}=require('./support/st-fixtures.cjs'),position=R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:[...'IJLOS'],streamCursor:1});
 const fresh=R.createState({active:'Z',queue:[...'IJLOST'],streamCursor:1}),raw=C.exportState(C.start(fresh,{fresh:true}));raw.inventory.hold=raw.inventory.queue.pop();
 raw.state.sl.foundationOpen=false;Object.assign(raw.state.account,{firstTsd:true,allocationVerified:true,opening:null});raw.state.account.profile.before=null;raw.state.account.profile.capEstablished=true;raw.state.account.z.remaining=1;raw.state.safety.notches=PH.start(position);
 return{position,raw};
}
test('current planner: native transport retains the actual paid SL route',()=>{
 const f=require('./fixtures/ordinary-sl-allocation.json'),native=currentRequest(f),old=P.plan(f.observation,{...f.options,...bounds}),current=P.plan(native.observation,native.options);
 verified(native.observation,current);assert.deepEqual(current.continuation.map(p=>p.event),old.continuation.map(p=>p.event));assert.equal(current.metrics.ordinarySAllocation?.selected,old.metrics.ordinarySAllocation?.selected);assert.equal(current.evidence.resourceObligations.binding,old.evidence.resourceObligations.binding);assert(P.revalidate(native.observation,current,native.options));
 const stale=clone(current);stale.evidence.resourceObligations.binding+='stale';assert.equal(P.revalidate(native.observation,stale,native.options),null);assert.equal(P.revalidate(f.observation,stale,{...f.options,...bounds}),null,'native transport cannot make a stale key authoritative');
});
test('current planner: obsolete resource input is rejected without invoking a legacy module',()=>{
 const f=require('./fixtures/ordinary-sl-allocation.json');
 const provider={module:{exports:{}},require:name=>{assert.doesNotMatch(name,/resource-legacy|resource-history/);return require('../'+name.slice(2));}};vm.runInNewContext(fs.readFileSync(require.resolve('../st-resource-provider'),'utf8'),provider);
 const requireAt=createRequire(require.resolve('../st-planner')),planner={module:{exports:{}},require:name=>{assert.doesNotMatch(name,/resource-legacy|resource-history/);return name==='./st-resource-provider.js'?provider.module.exports:requireAt(name);},Date,performance};vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),planner);
 const result=planner.module.exports.plan(f.observation,{...bounds,openingPhase:false,resourceContext:{origin:f.observation,steps:[]}});assert.equal(result.target,null);assert.equal(result.metrics.nodes,0);assert.equal(result.evidence.resourceObligations.status,'unavailable');
});
test('current planner: supplied unavailable accounting never falls back to legacy or geometric advice',()=>{
 const {position,raw}=knownCap(),unavailable={...raw,status:'unavailable',reason:'Explicit current accounting fault',state:null};
 for(const obligationContext of [null,{},unavailable]){const advice=P.decide(position,{...bounds,openingPhase:false,obligationContext});assert.equal(advice.target,null);assert.equal(advice.evidence.resourceObligations.status,'unavailable');assert.equal(advice.metrics.nodes,0);}
 const input=Provider.prepare(position,{obligationContext:unavailable}),again=P.plan(position,{...bounds,resourceInput:input});assert.equal(again.target,null);assert.match(again.reason,/Explicit current accounting fault/);
});
test('current planner: aggregate L uncertainty is disclosed without inventing named historical pieces',()=>{
 const {position,raw}=knownCap();raw.state.sl.uncertainty.L[0]=2;
 const advice=P.plan(position,{...bounds,openingPhase:false,disableConstruction:true,obligationContext:raw});verified(position,advice);
 assert.equal(advice.evidence.resourceObligations.uncertainty.L.count,2);assert.deepEqual(advice.evidence.resourceObligations.unclassifiedL,[]);assert.match(advice.reason,/2 additional L accommodations \(identity unavailable\)/);
});
test('current planner: original outstanding duties survive identity compaction in SL comparisons',()=>{
 const path=[{event:{type:'O',lines:0,cells:[]},structuralEvidence:{cavityRepair:{cells:[]}}}],assessment={leftContext:{score:1},structure:{left:{covered:0},center:{},right:{}},right:{},maxHeight:8,regionalSupport:true,leftSealed:0,sealed:0,covered:0,damageSealed:0,damageCovered:0};
 const node={path,assessment,resources:{extraZ:'unknown',originalOutstanding:[]},rank:[1,1,0,1],structuralScore:4,centerContinuity:0,dependencyDebt:0,entryDebt:0,continuationChecked:true,qualified:true,notchValid:true,cycleDebt:0,cavityDebt:[],centerDebt:[]};
 const candidate=clone(node);candidate.assessment.leftContext.score=2;candidate.resources.originalOutstanding=['L:37'];const draw={draws:1,drawn:[2]};
 const comparison=P.supportedSLComparison(candidate,node,{candidateDraw:draw,referenceDraw:draw,initialResources:{pendingCenter:[],hangingS:[],hangingL:[]}});assert.equal(comparison.reason,'original-resource-obligation-regression');assert.deepEqual(comparison.candidate.originalOutstanding,['L:37']);
});
test('current planner: public draw comparison uses literal observed identities before forced supply',()=>{
 const f=require('./fixtures/forced-bag-resource-binding.json'),input=Provider.prepare(f.observation,f.options),root=Provider.startRoute(input);assert.equal(root.queue.length,input.facts.instances.queue.length+1);assert(root.queue.at(-1).id<0);
 let state=M.position(root);const path=f.advice.continuation.map(step=>{const r=R.replay(state,step.witness);assert(r.valid);state=r.state;return{...step,state};});
 const horizon=P.publicDrawHorizon(f.observation,path,input.facts);assert(horizon);assert(horizon.placed.every(id=>id>0));assert(horizon.queue.every(p=>p.id>0));assert.equal(input.facts.instances.queue.length,6);
});
test('current planner: allocation equivalence excludes independently checked geometry but preserves SL consequences',()=>{
 const position=R.createState({active:'O',queue:[...'IJLSTZ'],streamCursor:1}),current=C.exportState(C.start(position,{fresh:true}));position.board[39]='X.........';
 const root=Provider.startRoute(Provider.prepare(position,{obligationContext:current}),{extendForced:false}),covered=M.step(position,{witness:['L','L','L','L','HD']},root),clear=M.step(position,{witness:['L','L','HD']},root);
 assert.notDeepEqual(M.position(covered).board,M.position(clear).board);assert.notDeepEqual(covered.route.projection.state.safety,clear.route.projection.state.safety);
 assert.notEqual(M.binding(covered),M.binding(clear),'Full node binding still separates safety consequences');assert.equal(M.allocationBinding(covered),M.allocationBinding(clear),'Equal accounting may compare different Left endpoints; this does not admit either route');
 const changed=clone(current);changed.state.sl.uncertainty.L[0]=1;const uncertain=Provider.startRoute(Provider.prepare(position,{obligationContext:changed}),{extendForced:false});
 assert.notEqual(M.allocationBinding(root),M.allocationBinding(uncertain),'Anonymous current SL consequences cannot disappear from the allocation class');
 assert.throws(()=>M.allocationBinding({...clear,introducedUnclassified:['L:unknown']}),/current projected resource required/,'Copied introduced-uncertainty metadata cannot supply a trusted allocation class');
});
