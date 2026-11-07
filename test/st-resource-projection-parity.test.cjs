'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),C=require('../st-obligation-context'),M=require('../st-obligation-resources'),P=require('../st-planner'),Reset=require('../st-reset-coach');
const {facts,actual}=require('./support/current-resource-test.cjs');
const cases=require('./fixtures/resource-projection-history.json').cases,copy=x=>JSON.parse(JSON.stringify(x));
function root(f){const state=R.createState(f.observation),current=C.importState(f.obligationContext,{position:state});assert.equal(current.status,'available');return{state,current};}
function execute(r,witness){let {state,current}=r;for(const action of witness){const after=R.move(state,action);current=actual(current,state,action,after);state=after;}return{state,current};}
function projected(r,witness,prior=M.start(r.state,r.current)){const p=R.replay(M.position(prior),witness);assert.equal(p.valid,true);assert.equal(p.events.length,1);return M.step(M.position(prior),{state:p.state,event:p.events[0],witness},prior);}
const ids=(resource,kind)=>resource['unclassified'+kind].map(p=>p[kind==='S'?'sId':'lId']);
test('resource projection: consumed unpaired S remains tracked after the later same-bag L',()=>{
 const f=cases[0],r=root(f),before=M.start(r.state,r.current),saved=copy(before),after=execute(r,f.witness),p=projected(r,f.witness,before),observed=M.start(after.state,after.current);
 assert.deepEqual(f.witness,['R180','HD']);assert.deepEqual(ids(p,'S'),[85]);assert.equal(p.uncertainty.S.count,1);assert.equal(observed.uncertainty.S.count,1);assert.equal(observed.uncertainty.S.aggregate[0],1,'Actual state retires the consumed identity without retiring its uncertainty');
 assert.deepEqual(p.hangingS,[]);assert.equal(M.newUnclassified(p),true);assert.equal(M.repair(M.position(p),p).uncertainty.S.count,1,'No-repair-needed shortcut still discloses unresolved accommodation');
 assert.deepEqual(before,saved,'A hypothetical child cannot mutate its root or sibling');
 const all=M.checkPath(r.state,f.continuation,r.current);assert.ok(ids(all.resource,'S').includes(85),'A fixed request retains its named introduced uncertainty');
 assert.notEqual(M.binding(before),M.binding(p));
 const candidate=copy(f.advice);delete candidate.evidence.resourceObligations.binding;
 const retained=P.revalidate(r.state,candidate,{obligationContext:f.obligationContext,deadline:Infinity,now:()=>0,maxNodes:45000});assert.ok(retained?.target,'Fresh ordinary admission stays intact');assert.equal(retained.evidence.resourceObligations.uncertainty.S.count,1);assert.equal(retained.evidence.resourceObligations.uncertainty.S.severeCount,0);assert.match(retained.reason,/S85/);assert.ok(retained.recommendation.hazards.some(h=>h.code==='unclassified-SL-accommodation'));assert.deepEqual(C.exportState(r.current),f.obligationContext);
 const wire=copy(f.obligationContext);wire.hangingS={status:'none-observed',unclassified:[]};assert.throws(()=>C.importState(wire,{position:r.state}),/envelope shape/,'Obsolete derived annotations are not part of the native schema');
});
test('resource projection: current allocation facts participate in branch and compatibility bindings',()=>{
 const r=root(cases[0]),one=M.start(r.state,r.current),changed=C.exportState(r.current);changed.state.sl.residuals.find(b=>b.S?.id===85).S.region='left';
 const two=M.start(r.state,C.importState(changed,{position:r.state}));assert.notEqual(M.rootBinding(one),M.rootBinding(two));assert.notEqual(M.binding(one),M.binding(two));
 assert.deepEqual(ids(projected(r,cases[0].witness,one),'S'),[85]);assert.deepEqual(ids(projected(r,cases[0].witness,two),'S'),[],'Trusted current Left accommodation differs from a consumed unpaired S');
});
test('resource projection: Reset cannot certify newly unclassified known Hanging L',()=>{
 const f=cases[1],r=root(f);assert.deepEqual(facts(r.state,r.current).hangingL.evidence.map(p=>p.lId),[37]);
 const after=execute(r,f.witness),p=projected(r,f.witness);assert.deepEqual(ids(p,'L'),[37]);assert.equal(p.uncertainty.L.count,1);assert.equal(M.newUnclassified(p),true);
 const check=Reset.check(r.state,f.continuation,{obligationContext:f.obligationContext,now:()=>0});assert.equal(check.valid,false);assert.equal(check.reason,'reset-transition-invalid');
 assert.equal(Reset.retain(r.state,f.advice,{obligationContext:f.obligationContext,now:()=>0}),null,'Retained labels do not bypass fresh admission');
 const carried=M.start(after.state,after.current);assert.equal(M.newUnclassified(carried),false,'Already uncertain roots remain disclosed without an invented new violation');assert.equal(carried.uncertainty.L.count,1);assert.deepEqual(carried.uncertainty.L.aggregate,[1]);
 const path=f.continuation.slice(1),old=f.advice,advice={...old,target:path[0].target,witness:path[0].witness,continuation:path,evidence:{...old.evidence,gapAccess:{...old.evidence.gapAccess,steps:old.evidence.gapAccess.steps.slice(1)}}};
 const retained=Reset.retain(after.state,advice,{obligationContext:C.exportState(after.current),now:()=>0});
 assert.ok(retained?.target,'An already uncertain root may continue without pretending L37 was repaired');assert.deepEqual(retained.evidence.resourceObligations.unclassifiedL,[]);assert.equal(retained.evidence.resourceObligations.uncertainty.L.count,1);assert.match(retained.reason,/1 additional L accommodation \(identity unavailable\)/);assert.equal(retained.evidence.resourceObligations.uncertainty.S.count,0);
});
test('resource disclosure: repeated presentation is immutable and does not duplicate or keep a stale warning',()=>{
 const cleanInput={target:{type:'J'},evidence:{resourceObligations:{unclassifiedS:[],unclassifiedL:[]}}};assert.equal(M.discloseAdvice(cleanInput),cleanInput);
 const input={target:{type:'J'},reason:'Checked finite prefix.',recommendation:{kind:'supported',hazards:[]},evidence:{resourceObligations:{unclassifiedS:[{sId:85,bag:12}],unclassifiedL:[]}}},saved=copy(input);
 const once=M.discloseAdvice(input),twice=M.discloseAdvice(once);assert.deepEqual(input,saved);assert.deepEqual(twice,once);assert.equal(twice.recommendation.hazards.length,1);assert.match(twice.reason,/S85/);
 const clean=M.discloseAdvice({...once,evidence:{...once.evidence,resourceObligations:{unclassifiedS:[],unclassifiedL:[]}}});assert.equal(clean.reason,input.reason);assert.deepEqual(clean.recommendation.hazards,[]);const partial=M.discloseAdvice({...input,evidence:{resourceObligations:{unclassifiedS:[{lId:86,bag:12}],unclassifiedL:[]}}});assert.match(partial.reason,/S \(bag 12, L86\)/);
});
