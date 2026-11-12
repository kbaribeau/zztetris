'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const P=require('../st-planner'),R=require('../st-rules'),C=require('../st-left-contours'),S=require('../st-structure'),Current=require('../st-obligation-context');
const {fixtures}=require('./support/st-fixtures.cjs');
const options={depth:2,width:1,maxNodes:12000,allowHold:false,now:()=>0,deadline:Infinity};
function position(queue=['J'],heights=[4,4,5,5],active='O',base=fixtures.cap.before){
 return R.createState({board:base.map((row,y)=>heights.map(h=>y>=40-h?'X':'.').join('')+row.slice(4)),active,queue});
}
function replay(state,advice){
 const contours=[];
 for(const step of advice.continuation||[]){const r=R.replay(state,step.witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);assert.deepEqual(JSON.parse(JSON.stringify(r.events[0])),JSON.parse(JSON.stringify(step.event)));state=r.state;contours.push(C.lookup(S.leftSurface.heights(state.board))?.id);}
 return {state,contours};
}
// Observation-only hooks, plus an exported scheduler for an isolated priority
// regression. No admission predicate, resource rule or placement is replaced.
function instrument(){
 const filename=require.resolve('../st-planner'),calls=[],groups=[];
 let source=fs.readFileSync(filename,'utf8').replace('return Object.freeze({importCandidateResources,','return Object.freeze({diversify,importCandidateResources,');
 source=source.replace('const pending=nodes.slice(),selected=[];','observeQualification(nodes,routeFirst);const pending=nodes.slice(),selected=[];');
 const m={exports:{}};
 vm.runInNewContext(source,{module:m,Date,performance,observeQualification:(nodes,routeFirst)=>{if(routeFirst)groups.push(nodes);},require:id=>{
  const real=require(path.resolve(path.dirname(filename),id));
  if(id==='./st-left-routes.js')return {...real,prepare:(...args)=>{calls.push('lookup');return real.prepare(...args);}};
  if(id==='./st-rules.js')return {...real,placements:(...args)=>{calls.push('enumeration');return real.placements(...args);}};
  return real;
 }});
 return {planner:m.exports,calls,groups};
}

test('contour route search: root lookup precedes movement enumeration and certifies OJ',()=>{
 const h=instrument(),state=position(),result=h.planner.plan(state,options),route=result.evidence.contourRoute;
 assert.equal(h.calls[0],'lookup');assert.equal(h.calls.filter(c=>c==='lookup').length,1);
 assert.ok(h.calls.includes('enumeration'));assert.equal(result.metrics.contourRoutes.selected,true);
 assert.equal(route.root,'LC-001');assert.deepEqual(Array.from(route.completed[0].pieces),['O','J']);
 assert.deepEqual(replay(state,result).contours,['LC-002','LC-003']);
 assert.equal(result.continuation.length,2);assert.equal(result.metrics.contourRoutes.admissionAttempts,1);
 assert.ok(result.evidence.resourceObligations);assert.ok(result.metrics.nodes<=options.maxNodes);
});

test('contour route search: narrow beam preserves an advanced route independently of numeric score',()=>{
 const h=instrument(),state=position(),result=h.planner.plan(state,options);
 assert.equal(result.metrics.contourRoutes.selected,true);
 const actual=h.groups[0].find(n=>n.leftRoutes.some(p=>p.index===1));assert.ok(actual);
 assert.equal(actual.qualified,true);
 const preferred={...actual,rank:actual.rank.map(()=>-1000),structuralScore:-1000};
 const ordinary={...actual,leftRoutes:[],rank:actual.rank.map(()=>1000),structuralScore:1000,rootIndex:999};
 const before=JSON.stringify([preferred.rank,ordinary.rank]);
 assert.equal(h.planner.diversify([ordinary,preferred],1,false,true)[0],preferred);
 assert.equal(h.planner.diversify([ordinary,preferred],1,false,false)[0],ordinary);
 assert.equal(JSON.stringify([preferred.rank,ordinary.rank]),before,'route ordering does not rewrite scores');
});

test('contour route search: OO returns to the source once without a route cycle loop',()=>{
 const state=position(['O']),result=P.plan(state,{...options,depth:6});
 assert.equal(result.metrics.contourRoutes.selected,true);assert.equal(result.metrics.contourRoutes.locks,2);
 assert.deepEqual(replay(state,result).contours,['LC-002','LC-001']);
 assert.equal(result.continuation.length,2);assert.equal(result.metrics.contourRoutes.expanded,1);
});

test('contour route search: a horizon too short for the recorded route retains ordinary fallback',()=>{
 const state=position(),result=P.plan(state,{...options,depth:1}),ordinary=P.plan(state,{...options,depth:1,disableContourRoutes:true});
 assert.equal(result.metrics.contourRoutes.attempted,true);assert.equal(result.metrics.contourRoutes.selected,false);
 assert.equal(result.metrics.contourRoutes.completed,0);assert.equal(result.evidence.contourRoute,undefined);
 assert.ok(result.target);assert.deepEqual(result.target,ordinary.target);assert.equal(result.continuation.length,1);replay(state,result);
});

test('contour route search: zero, node and time budgets are shared with fallback',()=>{
 const state=position();
 for(const maxNodes of [0,1,560,600]){
  const result=P.plan(state,{...options,maxNodes});assert.ok(result.metrics.nodes<=maxNodes,`${result.metrics.nodes} <= ${maxNodes}`);
  assert.equal(result.metrics.contourRoutes.selected,false);
  if(result.metrics.contourRoutes.attempted)assert.ok(result.metrics.contourRoutes.nodes<=result.metrics.contourRoutes.nodeAllowance);
  if(maxNodes===0){assert.equal(result.target,null);assert.equal(result.metrics.nodes,0);}
 }
 const exhausted=P.plan(state,{...options,now:()=>10,deadline:10});assert.equal(exhausted.target,null);assert.equal(exhausted.metrics.nodes,0);
 let tick=0;const timed=P.plan(state,{...options,now:()=>tick++,deadline:100});
 assert.equal(timed.metrics.contourRoutes.selected,false);assert.ok(timed.metrics.nodes<=options.maxNodes);
 assert.equal(timed.evidence.contourRoute,undefined);
});

test('contour route search: public Center reservation and Right I cycle remain protected',()=>{
 const state=position(),context=Current.exportState(Current.start(state));
 context.inventory.nextId=100;
 context.state.center.pending=[{id:'current-OJ',rootId:99,family:'OJ',alternatives:[{piece:'J',cells:[[5,27],[6,27],[5,28],[5,29]]}]}];
 const reserved=P.plan(state,{...options,obligationContext:context});
 assert.equal(reserved.metrics.contourRoutes.routes,0);assert.equal(reserved.metrics.contourRoutes.attempted,false);
 const cycle=position([],[6,6,6,4],'I',fixtures.pocket.before),result=P.plan(cycle,options);
 assert.equal(C.lookup(S.leftSurface.heights(cycle.board)).id,'LC-006');
 assert.equal(result.metrics.contourRoutes.routes,0);assert.equal(result.metrics.contourRoutes.selected,false);
 assert.ok(result.target);assert.ok(result.continuation[0].event.cells.every(([x])=>x>=7));replay(cycle,result);
 // A merely visible L is not a known hanging L and cannot activate D→L.
 const d=position([],[4,5,5,4],'L'),unclassified=P.plan(d,options);
 assert.equal(unclassified.metrics.contourRoutes.routes,0);assert.equal(unclassified.metrics.contourRoutes.selected,false);
});

test('contour route search: hidden future cannot manufacture a missing dependency',()=>{
 const state=position([]),clean=P.plan(state,options),hidden=P.plan({...state,hiddenQueue:['J'],seed:99,generator:{future:['J']}},options);
 assert.equal(clean.metrics.contourRoutes.routes,0);assert.equal(hidden.metrics.contourRoutes.routes,0);
 assert.deepEqual(hidden.target,clean.target);assert.deepEqual(hidden.continuation,clean.continuation);
 assert.deepEqual(hidden.metrics.contourRoutes,clean.metrics.contourRoutes);
});

test('contour route search: imported current hanging L enables the general D-to-L resolution',()=>{
 // Public inventory and same-bag S-already-accommodated facts are independent
 // current input, not a synthetic exemption in the planner. Use an ordinary
 // supported board with D Left, inactive Reset, and its actual notch pattern.
 const fixture=require('./fixtures/resource-projection-history.json').cases[1];
 const state=R.createState({...fixture.observation,board:position([],[4,5,5,4],'L').board});
 const context=JSON.parse(JSON.stringify(fixture.obligationContext));
 context.state.account.reset={status:'inactive'};
 context.state.safety=Current.exportState(Current.start(state)).state.safety;
 const resources=require('../st-obligation-resources').start(state,Current.importState(context,{position:state}));
 assert.deepEqual(resources.hangingL,[{id:37,bag:5,known:true}]);
 const result=P.plan(state,{...options,allowHold:true,obligationContext:context});
 assert.equal(result.metrics.contourRoutes.selected,true);
 assert.equal(result.evidence.contourRoute.root,'LC-009');
 assert.deepEqual(result.evidence.contourRoute.completed[0].pieces,['L']);
 assert.deepEqual(result.continuation[0].witness,['HOLD','L','L','L','R180','HD']);
 assert.equal(replay(state,result).contours[0],'LC-006');
 assert.ok(result.continuation.length>=1&&result.continuation.length<=options.depth);
});

function semantic(value){
 const result=JSON.parse(JSON.stringify(value));
 function visit(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(k==='elapsedMs'||k==='costsMs')delete v[k];else visit(v[k]);}}
 visit(result);return result;
}
test('contour route search: decide retains the certified route with trace on or off',()=>{
 const Trace=require('../st-search-trace'),state=position(),plain=P.decide(state,options),trace=Trace.create({limit:3000});
 const traced=P.decide(state,{...options,searchTrace:trace});
 assert.equal(plain.metrics.contourRoutes.selected,true);assert.equal(traced.metrics.contourRoutes.selected,true);
 assert.deepEqual(semantic(traced),semantic(plain));assert.deepEqual(replay(state,traced).contours,['LC-002','LC-003']);
 const receipt=trace.finish(traced),candidates=receipt.events.filter(e=>e.kind==='candidate');
 assert.ok(candidates.length);
 for(const candidate of candidates){
  const origin=receipt.searches.find(s=>s.id===candidate.searchId);assert.ok(origin,'every traced candidate has a registered search origin');
  const end=replay(origin.observation,{continuation:candidate.path});assert.deepEqual(end.state.board,candidate.board);
 }
});

test('lookup diagnostics retain all returned root routes in order without a presentation query',()=>{
 const h=instrument(),state=position(),result=h.planner.plan(state,options);
 const expected=require('../st-left-routes').prepare(P.observe(state),{allowHold:false});
 assert.equal(result.lookupContinuations.status,'queried');
 assert.deepEqual(JSON.parse(JSON.stringify(result.lookupContinuations.routes)),expected.routes);
 assert.equal(h.calls.filter(x=>x==='lookup').length,1);
 assert.equal(result.lookupContinuations.queries.length,1);
 assert.match(result.lookupContinuations.claim,/not verified legal or selected/);
 const disabled=h.planner.plan(state,{...options,disableContourRoutes:true});
 assert.equal(disabled.lookupContinuations.status,'not-queried');assert.deepEqual(Array.from(disabled.lookupContinuations.routes),[]);
 const empty=h.planner.plan(position(['I']),{...options,allowHold:false});
 assert.equal(empty.lookupContinuations.status,'queried');assert.deepEqual(Array.from(empty.lookupContinuations.routes),[]);
});

test('lookup diagnostics exclude nested future roots and release collector after errors',()=>{
 const filename=require.resolve('../st-planner'),m={exports:{}};
 const source=fs.readFileSync(filename,'utf8').replace('return Object.freeze({importCandidateResources,','return Object.freeze({withLookupDiagnostics,recordLookup,importCandidateResources,');
 vm.runInNewContext(source,{module:m,Date,performance,require:id=>require(path.resolve(path.dirname(filename),id))});
 const h=m.exports,state=position(),future=position(['I']),prepared={stats:{queries:1,complete:true,status:'matched',routes:1},query:{contour:'LC-001'},routes:[{id:'root-route',pieces:['O','J'],contours:['LC-002','LC-003']}]};
 const result=h.withLookupDiagnostics(state,()=>{
  h.recordLookup(state,prepared);
  h.withLookupDiagnostics(future,()=>{h.recordLookup(future,{...prepared,routes:[{id:'future-route'}]});return {};});
  h.recordLookup(state,prepared);return {};
 });
 assert.deepEqual(JSON.parse(JSON.stringify(result.lookupContinuations.routes)),prepared.routes);
 assert.equal(result.lookupContinuations.queries.length,2);
 assert.throws(()=>h.withLookupDiagnostics(state,()=>{h.recordLookup(state,prepared);throw Error('test failure');}),/test failure/);
 assert.equal(h.withLookupDiagnostics(state,()=>({})).lookupContinuations.status,'not-queried');
});
