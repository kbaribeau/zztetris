'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),Route=require('../st-obligation-route'),Context=require('../st-obligation-context');
const clone=x=>JSON.parse(JSON.stringify(x));
const reduce=placements=>P.ordinaryPlacementOutcomes(placements);
// Independent, deliberately verbose oracle: compare terminal public facts,
// excluding only executable-witness bookkeeping and equivalent pose labels.
function key(p){
 const s=p.state,e=p.event;
 return JSON.stringify([e.type,e.cells.slice().sort(([ax,ay],[bx,by])=>ay-by||ax-bx),e.spin,e.lines,e.clearedRows,e.topOut,
  p.holdCount??p.witness.filter(a=>a==='HOLD').length,s.rules,s.board,s.active,s.hold,s.queue,s.canHold,s.streamCursor,s.bag??null,s.topOut]);
}
function groups(placements){const result=new Map();for(const p of placements){const k=key(p);if(!result.has(k))result.set(k,[]);result.get(k).push(p);}return result;}
function enumeration(state,options={}){const result=R.placements(state,{allowHold:false,maxNodes:16000,now:()=>0,...options});assert.equal(result.complete,true);return result;}
function placement(state,witness){const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0],target:r.events[0].target,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};}

test('ordinary landing outcomes: equivalent O/I/S/Z rotations keep one shortest exact executable witness',()=>{
 for(const [type,poses,physical]of [['O',36,9],['I',34,17],['S',34,17],['Z',34,17]]){
  const state=R.createState({active:type,queue:['T','L']}),raw=enumeration(state).placements,saved=clone(raw),classes=groups(raw),result=reduce(raw);
  assert.equal(raw.length,poses,type);assert.equal(result.length,physical,type);assert.equal(classes.size,physical,type);
  assert.deepEqual(new Set(result.map(key)),new Set(classes.keys()));
  for(const p of result){const candidates=classes.get(key(p)),minimum=Math.min(...candidates.map(q=>q.witness.length));assert.equal(p.witness.length,minimum);assert.strictEqual(p,candidates.find(q=>q.witness.length===minimum));const replay=R.replay(state,p.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,p.state);assert.deepEqual(replay.events,[p.event]);assert.deepEqual(p.target,p.event.target);}
  assert.deepEqual(raw,saved,'input placements remain untouched');
 }
});

test('ordinary landing outcomes: whole representatives, stable ties and availability flags survive',()=>{
 const state=R.createState({active:'O',queue:['T']}),short=placement(state,['HD']),long=placement(state,['CW','CCW','HD']);
 for(const p of [short,long])Object.assign(p,{availableCap:true,availableCleanupPreparation:true});
 const tied={...short,witness:short.witness.slice(),marker:'second equal-length witness'},input=[long,short,tied],saved=clone(input),result=reduce(input);
 assert.equal(result.length,1);assert.strictEqual(result[0],short);assert.equal(result[0].availableCap,true);assert.equal(result[0].availableCleanupPreparation,true);assert.deepEqual(input,saved);
 assert.deepEqual(reduce([]),[]);
});

test('ordinary landing outcomes: physical twins preserve different HOLD identities',()=>{
 // Public letters are identical, but HOLD swaps two different public subjects.
 const state=R.createState({active:'O',hold:'O',queue:['T','I']}),a=placement(state,['HD']),b=placement(state,['HOLD','HD']),route=Route.startUnknown(state);
 assert.deepEqual(a.event.cells,b.event.cells);assert.deepEqual(a.state.board,b.state.board);assert.equal(a.state.hold,b.state.hold);
 const pa=Route.step(route,{witness:a.witness,event:a.event}),pb=Route.step(route,{witness:b.witness,event:b.event});assert.notEqual(pa.locked.id,pb.locked.id);assert.notEqual(pa.route.projection.supply.hold.id,pb.route.projection.supply.hold.id);
 assert.deepEqual(reduce([a,b]),[a,b]);
 const empty=R.createState({active:'O',queue:['I','T']}),direct=placement(empty,['HD']),swapBack=placement(empty,['HOLD','HOLD','HD']);assert.deepEqual(direct.event.cells,swapBack.event.cells);assert.equal(reduce([direct,swapBack]).length,2);
});

test('ordinary landing outcomes: spin, clear and resulting supply facts never collide',()=>{
 // Synthetic single-field perturbations test the pure key boundary, not legality.
 const base=placement(R.createState({active:'T',queue:['O','I']}),['HD']);
 const changes=[p=>{p.event.spin='mini';},p=>{p.event.spin='full';},p=>{p.event.lines=1;p.event.clearedRows=[39];},p=>{p.event.clearedRows=[38];},p=>{p.event.topOut=true;},p=>{p.state.hold='Z';},p=>{p.state.queue=['I','O'];},p=>{p.state.streamCursor++;},p=>{p.state.canHold=false;},p=>{p.state.rules=R.LEGACY_PROFILE.id;},p=>{p.state.bag={remaining:[1],observedCount:1};},p=>{p.state.topOut=true;},p=>{p.state.active.type='Z';},p=>{p.state.board[30]='X.........';}];
 for(const change of changes){const other=clone(base);change(other);assert.equal(reduce([base,other]).length,2,change.toString());}
});

test('ordinary landing outcomes: same-parent equivalent paths project identical factual obligations',()=>{
 const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),context=Context.start(position,{fresh:true}),route=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary});
 let compared=0;
 for(const alternatives of groups(enumeration(position).placements).values()){
  assert.ok(alternatives.length>1);const expected=Route.step(route,{witness:alternatives[0].witness,event:alternatives[0].event});
  for(const p of alternatives.slice(1)){const actual=Route.step(route,{witness:p.witness,event:p.event});assert.deepEqual(actual.locked,expected.locked);assert.deepEqual(actual.route.projection.state,expected.route.projection.state);assert.deepEqual(actual.route.projection.supply,expected.route.projection.supply);assert.deepEqual(Route.resolve(actual.route),Route.resolve(expected.route));assert.deepEqual(actual.assessmentStep,expected.assessmentStep);assert.equal(Route.binding(actual.route),Route.binding(expected.route));compared++;}
 }
 assert.equal(compared,17);
});

test('ordinary landing outcomes: imported active obligations agree across equivalent pose witnesses',()=>{
 let compared=0;
 for(const f of require('./fixtures/resource-projection-history.json').cases){
  const position=R.createState(f.observation),context=Context.importState(f.obligationContext,{position}),route=Route.start(context.state,{position,inventory:context.inventory,openingBoundary:context.boundary});
  const raw=enumeration(position).placements,twins=[];
  // These imported cases start J/L, whose four rotations have different
  // silhouettes. Add an actual reversible spawn rotation as an alternate
  // movement witness instead of assuming geometric twins exist.
  for(const p of raw){const witness=['CW','CCW',...p.witness],r=R.replay(position,witness);if(!r.valid||r.events.length!==1)continue;const other={...p,witness,state:r.state,event:r.events[0],target:r.events[0].target};if(key(p)===key(other))twins.push([p,other]);if(twins.length===2)break;}
  for(const alternatives of twins){
   const a=Route.step(route,{witness:alternatives[0].witness,event:alternatives[0].event});
   for(const p of alternatives.slice(1)){const b=Route.step(route,{witness:p.witness,event:p.event});assert.deepEqual(b.route.projection.state,a.route.projection.state);assert.deepEqual(b.route.projection.supply,a.route.projection.supply);assert.deepEqual(Route.resolve(b.route),Route.resolve(a.route));assert.deepEqual(b.assessmentStep,a.assessmentStep);compared++;}
  }
 }
 assert.ok(compared>0,'exercise real imported obligations, not only empty-origin accounts');
});

test('ordinary landing outcomes: public exact rotation predicates and query cache retain full pose outputs',()=>{
 const state=R.createState({active:'O',queue:['T']});
 R.withQueries(()=>{
  const full=enumeration(state);assert.equal(full.placements.length,36);const saved=clone(full.placements);assert.equal(reduce(full.placements).length,9);
  const cached=R.placements(state,{allowHold:false,maxNodes:0});assert.equal(cached.queryCached,true);assert.deepEqual(cached.placements,saved);assert.equal(cached.visited,0);
  const stopped=R.placements(state,{allowHold:false,now:()=>0,stopWhen:p=>p.target.rotation===2});assert.equal(stopped.stopReason,'placement-predicate');assert.equal(stopped.complete,false);assert.ok(stopped.placements.some(p=>p.target.rotation===2));assert.notEqual(stopped.queryCached,true);
 });
 const partial=R.placements(state,{allowHold:false,maxNodes:1,now:()=>0}),saved=clone(partial);reduce(partial.placements);assert.deepEqual(partial,saved);assert.equal(partial.complete,false);assert.equal(partial.visited,1);
});
