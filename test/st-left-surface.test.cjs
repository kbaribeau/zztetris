'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../st-rules'),S=require('../st-structure'),L=require('../st-left-context'),RH=require('../st-obligation-context');
const board=h=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>x<4&&y>=40-h[x]?'X':'.').join(''));
test('shared Left surface / oriented classification and covered cells stay descriptive',()=>{
 const surface=S.leftSurface.assess(board([3,4,4,3]));
 assert.deepEqual(surface.heights,[3,4,4,3]);assert.deepEqual(surface.profile,[0,1,1,0]);assert.equal(surface.shape.tier,'D');assert.equal(surface.covered,0);
 const roof=board([3,4,4,3]);roof[39]='.XXX......';const damaged=S.leftSurface.assess(roof);
 assert.equal(damaged.shape.tier,'D');assert.equal(damaged.covered,1);assert.equal(L.isD(roof),true);
 assert.equal(L.evaluate(R.createState({board:roof,active:'J',queue:['O']})).context,'covered-cells-neutral');
 assert.equal(S.leftSurface.assess(board([2,5,4,2])).shape,null);
 const unknown=R.createState({board:roof,active:'J',queue:['O']});assert.deepEqual(RH.resolve(RH.start(unknown),{position:unknown}).dPattern,{pending:false});
 // Literal source tiers distinguish mirrored profiles. They are not permission.
 assert.equal(S.leftSurface.classify([0,0,1,1]).tier,'S');assert.equal(S.leftSurface.classify([1,1,0,0]).tier,'A');
 assert.equal(Object.isFrozen(S.leftSurface.catalog[0].profile),true);
});
test('shared Left dependencies / verified, unknown arrival and unfinished proof remain distinct',()=>{
 const make=extra=>R.createState({board:board([3,4,4,3]),active:'T',hold:'O',queue:['S'],...extra});
 const describe=(state,proof,resources={pendingCenter:[]})=>L.dDependencies(state,proof,{resources,geometry:S.geometry(state.board)});
 assert.deepEqual(describe(make({active:'J'}),{valid:true,complete:true}),[]);
 const unknown=describe(make({}),{valid:false,complete:true});assert.equal(unknown[0].availability,'absent-from-public-supply');assert.equal(unknown[0].proofStatus,'not-established');assert.match(unknown[0].detail,/arrival is unknown/);
 const delayed=describe(make({queue:['J']}),{valid:false,complete:true});assert.equal(delayed[0].availability,'visible-but-delayed');
 const unfinished=describe(make({active:'J'}),{valid:false,complete:false});assert.equal(unfinished[0].availability,'immediate-exit-proof-unfinished');assert.equal(unfinished[0].proofStatus,'unfinished');
 const unproved=describe(make({active:'J'}),{valid:false,complete:true});assert.equal(unproved[0].availability,'immediate-exit-not-established');assert.equal(unproved[0].proofStatus,'not-established');
 const debt=describe(make({active:'J'}),{valid:false,complete:true},{pendingCenter:[{alternatives:[{piece:'J'}]}]});assert(debt.some(h=>h.code==='D-J-competes-with-Center'));assert(debt.some(h=>h.code==='D-waiting-space-unproved'));
});
test('shared Left surface / classic page and Worker dependency orders execute current accounting before preferences',()=>{
 const root=path.resolve(__dirname,'..'),load=(name,realm)=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),realm,{filename:name});
 for(const mode of ['page','worker']){
  const realm=vm.createContext({console,Date,performance});realm.self=realm;
  let observedBeforePreference=false;
  function loadOne(name){
   if(name==='st-left-context.js'){
    assert.equal(realm.STLeftContext,undefined);assert(realm.STObligationContext);assert(realm.STStructure.leftSurface);
    const s=realm.STRules.createState({board:board([3,4,4,3]),active:'J',queue:['O']});
    assert.equal(realm.STObligationContext.resolve(realm.STObligationContext.start(s),{position:s}).dPattern.pending,false);observedBeforePreference=true;
   }
   load(name,realm);
  }
  if(mode==='worker'){realm.importScripts=(...names)=>names.forEach(loadOne);load('st-worker.js',realm);assert.equal(typeof realm.self.onmessage,'function');}
  else{
   const names=[...fs.readFileSync(path.join(root,'st-lab.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)].map(m=>new URL(m[1],'https://zztetris.test/').pathname.slice(1));
   for(const name of names.slice(names.indexOf('st-rules.js'),names.indexOf('st-planner.js')+1))loadOne(name);
  }
  assert.equal(observedBeforePreference,true);assert.equal(realm.STLeftContext.isD(board([3,4,4,3])),true);
  const s=realm.STRules.createState({board:board([3,4,4,3]),active:'J',queue:['O']}),proof=realm.STLeftContext.dExit(s,{now:()=>0,deadline:1,maxNodes:4000});
  assert.equal(proof.valid,true);assert.equal(realm.STRules.replay(s,proof.exit.witness).valid,true);
 }
});
