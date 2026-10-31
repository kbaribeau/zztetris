'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources');
const clone=x=>JSON.parse(JSON.stringify(x));
// Synthetic comparison records isolate policy ordering, not a claimed legal
// strategic route. Actual replay/history permission is checked separately below.
function node(key,extraZ='used',patch={}){
 return {key,extraZPreservable:true,path:Array.from({length:3},()=>({event:{type:'O',lines:0,cells:[]},structuralEvidence:{cavityRepair:{cells:[]}}})),
 rank:[1,1,0,10,2,-20,2,0],structuralScore:40,centerContinuity:0,openingQualityProgress:null,
 continuationChecked:true,qualified:true,notchValid:true,cycleDebt:0,cavityDebt:[],centerDebt:[],dependencyDebt:0,entryDebt:0,
 assessment:{maxHeight:8,regionalSupport:true,sealed:0,covered:0,estimate:20,right:{}},
 resources:{extraZ,originKey:'same replay-validated root',active:{type:'I',id:5,bag:1},hold:{type:'Z',id:4,bag:1},queue:[],scoredTs:[3],
 violations:[],pendingCenter:[],hangingS:[],hangingL:[],unclassifiedS:[],unclassifiedL:[]},...patch};
}
const order=nodes=>P.orderContinuations(nodes).map(n=>n.key);
test('Extra-Z ties: an otherwise equivalent whole continuation preserves available permission',()=>{
 const spent=node('a'),saved=node('z','available');assert.deepEqual(order([spent,saved]),['z','a']);
 assert.deepEqual(order([saved,spent]),['z','a']);assert.equal(spent.resources.extraZ,'used');
});
test('Extra-Z ties: no contrast preserves the original deterministic target order',()=>{
 for(const status of ['available','used','unknown','out-of-profile'])assert.deepEqual(order([node('z',status),node('a',status)]),['a','z']);
 const a=node('a'),z=node('z','available',{extraZPreservable:false});assert.deepEqual(order([z,a]),['a','z']);
});
test('Extra-Z ties: every existing numeric priority dominates preservation, including necessary spending',()=>{
 for(let i=0;i<8;i++){
  const spend=node('z'),save=node('a','available');spend.rank[i]++;
  assert.deepEqual(order([save,spend]),['z','a'],'rank '+i+' remains stronger');
 }
 const spend=node('z'),save=node('a','available');save.centerContinuity=-1;
 assert.deepEqual(order([save,spend]),['z','a'],'reusable Center is not sacrificed');
 spend.openingQualityProgress=0;save.openingQualityProgress=-1;save.centerContinuity=0;
 assert.deepEqual(order([save,spend]),['z','a'],'observed opening quality remains stronger');
});
test('Extra-Z ties: scoring and cleanup timing are not otherwise-equivalent',()=>{
 const a=node('a'),z=node('z','available');a.path[0].event={type:'T',spin:'full',lines:2,cells:[]};z.path[2].event={type:'T',spin:'full',lines:2,cells:[]};
 assert.deepEqual(order([z,a]),['a','z'],'Equal endpoint totals cannot postpone an earlier TSD for allowance');
 a.path[0].event={type:'I',lines:0,cells:[]};a.path[0].structuralEvidence.allocation='quad-preparation';
 z.path[2].event={type:'I',lines:0,cells:[]};z.path[2].structuralEvidence.allocation='quad-preparation';
 assert.deepEqual(order([z,a]),['a','z'],'Cleanup preparation schedule is protected');
});
test('Extra-Z ties: unequal horizons never earn a preservation preference',()=>{
 for(const length of [1,2,4]){
  const a=node('a'),z=node('z','available');z.path=Array.from({length},()=>clone(z.path[0]));
  assert.deepEqual(order([z,a]),['a','z']);
 }
});
test('Extra-Z ties: exact endpoint quality, not merely a structural band, must agree',()=>{
 for(const field of ['structuralScore','dependencyDebt','entryDebt']){
  const a=node('a'),z=node('z','available');z[field]++;assert.deepEqual(order([z,a]),['a','z'],field);
 }
 for(const field of ['maxHeight','sealed','covered','estimate']){
  const a=node('a'),z=node('z','available');z.assessment[field]++;assert.deepEqual(order([z,a]),['a','z'],field);
 }
});
test('Extra-Z ties: unresolved access, repair and resource obligations cannot win a tie',()=>{
 const edits=[n=>n.qualified=false,n=>n.notchValid=false,n=>n.cycleDebt=1,n=>n.centerDebt.push({}),n=>n.cavityDebt.push([1,1]),
 n=>n.path[0].structuralEvidence.cavityRepair.cells.push([1,1]),n=>n.assessment.right.entry={status:'unresolved-budget'},
 n=>n.resources.centerBlocked=true,n=>n.resources.tCollision=true,
 ...['violations','pendingCenter','hangingS','hangingL','unclassifiedS','unclassifiedL'].map(field=>n=>n.resources[field].push({}))];
 for(const edit of edits){const a=node('a'),z=node('z','available');edit(z);assert.deepEqual(order([z,a]),['a','z']);}
});
test('Extra-Z ties: held Z and differing piece or history identities do not imply equivalence',()=>{
 const edits=[n=>n.resources.hold.id++,n=>n.resources.active.id++,n=>n.resources.hold.bag++,n=>n.resources.queue.push({type:'Z',id:9}),
 n=>n.resources.scoredTs=[99],n=>n.resources.originKey='other root'];
 for(const edit of edits){const a=node('a'),z=node('z','available');edit(z);assert.deepEqual(order([z,a]),['a','z']);}
 const a=node('a','used'),z=node('z','unknown');assert.deepEqual(order([z,a]),['a','z'],'physical Z remains irrelevant with unknown permission');
});
test('Extra-Z ties: disjoint equivalence classes retain slots and deterministic within-status ties',()=>{
 const a=node('a'),b=node('b','available'),c=node('c','available'),d=node('d','available');b.path.push(clone(b.path[0]));
 const inputs=[a,b,c,d];assert.deepEqual(order(inputs),['c','b','d','a']);
 for(const permutation of [[d,c,b,a],[b,d,a,c],[c,a,d,b]])assert.deepEqual(order(permutation),['c','b','d','a']);
 assert.deepEqual(P.orderContinuations(P.orderContinuations(inputs)).map(n=>n.key),['c','b','d','a']);
});
test('Extra-Z ties: a failed or unfinished challenger retains the fully admitted spending continuation',()=>{
 const a=node('a'),z=node('z','available');let calls=[];
 const chosen=P.preserveExtraZ(a,[z,a],{protect:n=>{calls.push('admit '+n.key);return true;},certify:n=>{calls.push('check '+n.key);return false;}});
 assert.equal(chosen,a);assert.deepEqual(calls,['admit a','check z']);
 calls=[];assert.equal(P.preserveExtraZ(a,[z,a],{protect:n=>{calls.push(n.key);return false;},certify:()=>{throw new Error('No protected fallback');}}),a);assert.deepEqual(calls,['a']);
 assert.equal(P.preserveExtraZ(a,[z,a],{protect:()=>true,certify:()=>true}),z);
 assert.equal(P.preserveExtraZ(a,[a,a],{protect:()=>{throw new Error('same node is not a contrast');}}),a);
 const unchecked=node('z','available',{continuationChecked:false});assert.deepEqual(order([a,unchecked]),['a','z'],'Ordering alone cannot promote an unchecked continuation');
});
function verifiedRoot(){
 const f=require('./fixtures/opening-z-allocation.json');let state=R.createState(f.request.observation),history=H.importContext(state,clone(f.request.options.resourceContext));
 for(const witness of [['L','L','L','HD'],f.steps[1].witness,f.steps[0].witness.slice(1),f.steps[3].witness])for(const action of witness){const next=R.move(state,action);assert.notEqual(next,state);history=H.applyAction(history,state,action,next);state=next;}
 const summary=H.resolve(state,history);assert.equal(summary.coverage.status,'complete');assert.equal(summary.extraZ.status,'available');assert.ok(summary.extraZ.baseline);
 return {state,history,summary};
}
test('Extra-Z ties: actual validated history supplies allowance, not the Z held or queued',()=>{
 const {state,history,summary}=verifiedRoot();const resource=M.start(state,summary);assert.equal(resource.extraZ,'available');
 const unknown=H.resolve(state,H.start(state));assert.equal(unknown.extraZ.status,'unknown');assert.equal(M.start(state,unknown).extraZ,'unknown');
 const context=clone(H.exportContext(state,history));context.extraZ={status:'available',baseline:{at:0}};
 const forged=H.resolve(state,H.importContext(state,{...context,steps:[]}));
 assert.notEqual(forged.extraZ.status,'available','Broken replay cannot supply a known allowance');
 const leftZ=R.placements(state,{maxNodes:45000}).placements.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x<4));
 assert.ok(leftZ,'Actual HOLD/draw witness can spend the observed Z');
 const spent=M.step(state,leftZ,resource);assert.equal(spent.extraZ,'used');assert.deepEqual(spent.violations,[]);
 assert.equal(M.step(state,leftZ,M.start(state,unknown)).violations.includes('extra-Z-not-available'),true);
 assert.equal(H.resolve(state,history).extraZ.status,'available','Projection never changes real history or renews allowance');
});

test('Extra-Z ties: optional challenger exhaustion preserves the fully admitted outer planner fallback',()=>{
 // Orchestration seam, NOT natural policy-benefit evidence: present a synthetic
 // tie at the selector boundary while retaining a real ordinary incumbent and
 // the production protect/certify callbacks, outer admission and replay rules.
 const fs=require('node:fs'),vm=require('node:vm'),A=require('../st-access'),{fixtures}=require('./support/st-fixtures.cjs');
 const state=R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']});
 let clock=0,injections=0,protectedCount=0,callerCalls=0;
 const source=fs.readFileSync(require.resolve('../st-planner'),'utf8').replace(
  'function preserveExtraZ(baseline,nodes,{protect,certify}){',
  'function preserveExtraZ(baseline,nodes,{protect,certify}){ return extraZTieProbe(baseline,nodes,{protect,certify});');
 const mod={exports:{}};
 const access={...A,prefix:(...args)=>clock>=50?{reachable:null,complete:false,visited:0,status:'unknown-access-budget'}:A.prefix(...args)};
 vm.runInNewContext(source,{module:mod,require:id=>id==='./st-access.js'?access:require(id.replace('./','../')),Date,performance,
  extraZTieProbe:(baseline,nodes,{protect,certify})=>{
   if(injections++)return baseline;
   assert.equal(protect(baseline),true,'Real incumbent completes outer resource/replay/access admission before optional work');protectedCount++;
   clock=100;assert.equal(certify(baseline),false,'Optional work is bounded after exhaustion');return baseline;
  }});
 const result=mod.exports.plan(state,{depth:3,width:3,maxNodes:15000,deadline:50,now:()=>clock,admitMaintenance:()=>{callerCalls++;throw Error('Untrusted admission');}});
 assert.equal(protectedCount,1);assert.equal(callerCalls,0);assert.ok(result.target,result.reason);
 assert.equal(result.metrics.certifiedFallback?.selected,true);assert.equal(result.evidence.searchIncomplete,true);
 assert.equal(result.evidence.resourceObligations.status,'checked');assert.equal(result.evidence.gapAccess.reachable,true);
 assert.equal(R.replay(state,result.continuation.flatMap(p=>p.witness)).valid,true);
});
