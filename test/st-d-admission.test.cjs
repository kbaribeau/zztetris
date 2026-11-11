'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../st-rules'),L=require('../st-left-context'),C=require('../st-obligation-context');
const fixtures=require('./fixtures/st-d-admission.json');
// Expose the shared endpoint boundary, not a bypass for its resource checks.
function planner(){const filename=require.resolve('../st-planner'),source=fs.readFileSync(filename,'utf8'),m={exports:{}};vm.runInNewContext(source.replace('return Object.freeze({importCandidateResources,','return Object.freeze({checkedResourceEndpoint,importCandidateResources,'),{module:m,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance});return m.exports;}
const options={now:()=>0,deadline:Infinity,maxNodes:30000};
function steps(origin,witnesses){let s=origin;return witnesses.map(witness=>{const r=R.replay(s,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);s=r.state;return{witness,event:r.events[0],target:r.events[0].target};});}
for(const f of fixtures)test('Left contour admission / '+f.name+' is not rejected for absent immediate J',()=>{
 const s=R.createState({board:[...Array(20).fill('..........'),...f.board],active:f.active,hold:f.hold,queue:f.queue}),route=steps(s,[f.witness]),after=R.replay(s,f.witness).state;
 assert(L.createsD(s.board,after.board));assert.notEqual(after.active?.type,'J');assert.notEqual(after.hold,'J');if(after.hold===null)assert.notEqual(after.queue[0],'J');
 const result=planner().checkedResourceEndpoint(s,route,options);assert.equal(result.valid,true,result.reason);assert.equal(result.resource.violations.length,0);
 // A legal silhouette never authenticates a changed event or illegal witness.
 const forged=JSON.parse(JSON.stringify(route));forged[0].event.type='T';assert.equal(planner().checkedResourceEndpoint(s,forged,options).valid,false);
 const illegal=JSON.parse(JSON.stringify(route));illegal[0].witness=['TELEPORT','HD'];assert.equal(planner().checkedResourceEndpoint(s,illegal,options).valid,false);
});
const creator=['L','L','L','CW','HD'],centerJ=['CW','R','HD'],leftJ=['L','L','R180','HD'];
function origin(queue){const h=[6,4,6,6,4,1,2,0,0,0];return R.createState({board:Array.from({length:40},(_,y)=>h.map(v=>y>=40-v?'X':'.').join('')),active:'J',hold:'O',queue});}
function current(s){const c=C.exportState(C.start(s));c.inventory.nextId=100;c.state.center.pending=[{id:'explicit-current-OJ',rootId:99,family:'OJ',alternatives:[{piece:'J',cells:[[5,36],[6,36],[5,37],[5,38]]}]}];return c;}
test('Left contour admission / actual Center payment may leave D without reserving another J',()=>{
 const s=origin(['J','O']),route=steps(s,[creator,centerJ]),after=R.replay(s,route.flatMap(p=>p.witness)).state;
 assert(L.isD(after.board));assert.notEqual(after.active?.type,'J');assert.notEqual(after.hold,'J');if(after.hold===null)assert.notEqual(after.queue[0],'J');
 const result=planner().checkedResourceEndpoint(s,route,{...options,obligationContext:current(s)});assert.equal(result.valid,true,result.reason);assert.deepEqual(Array.from(result.resource.pendingCenter),[]);assert.equal(result.resource.violations.length,0);
});
test('Left contour admission / a J spent on Left still cannot pay an authenticated Center obligation',()=>{
 const s=origin(['J','O']),route=steps(s,[creator,leftJ]),result=planner().checkedResourceEndpoint(s,route,{...options,obligationContext:current(s)});
 assert.equal(L.isD(R.replay(s,route.flatMap(p=>p.witness)).state.board),false);assert.equal(result.valid,false);assert.equal(result.reason,'no-visible-resource-repair');
 const replacement=origin(['J','J','O']),paid=steps(replacement,[creator,leftJ,centerJ]),ok=planner().checkedResourceEndpoint(replacement,paid,{...options,obligationContext:current(replacement)});assert.equal(ok.valid,true,ok.reason);assert.equal(ok.resource.pendingCenter.length,0);
});
test('Left contour history / legacy D facts roundtrip without becoming admission permission',()=>{
 const s=origin(['J','O']);let position=s,history=C.start(s);
 for(const action of creator){const after=R.move(position,action);history=C.applyActual(history,{before:position,action,after}).context;position=after;}
 assert.deepEqual(C.resolve(history,{position}).dPattern,{pending:true});const exported=C.exportState(history),restored=C.importState(JSON.parse(JSON.stringify(exported)),{position});assert.deepEqual(C.resolve(restored,{position}).dPattern,{pending:true});
 assert.deepEqual(C.resolve(C.start(position),{position}).dPattern,{pending:false});
 const route=steps(position,[centerJ]);for(const obligationContext of [exported,C.exportState(C.start(position))])assert.equal(planner().checkedResourceEndpoint(position,route,{...options,obligationContext}).valid,true);
 assert.throws(()=>C.importState({...exported,dPattern:{pending:false}},{position}),/envelope shape/);
});
