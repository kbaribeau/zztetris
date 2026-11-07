'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),P=require('../st-planner'),Reset=require('../st-reset-coach');
const cases=require('./fixtures/resource-projection-history.json').cases,copy=x=>JSON.parse(JSON.stringify(x));
function root(f){const state=R.createState(f.observation),history=H.importContext(state,f.resourceContext),summary=H.resolve(state,history);assert.equal(summary.coverage.status,'complete');return{state,history,summary};}
function actual(r,witness){let {state,history}=r;for(const action of witness){const after=R.move(state,action);history=H.applyAction(history,state,action,after);state=after;}return{state,history,summary:H.resolve(state,history)};}
function projected(r,witness,prior=M.start(r.state,r.summary)){const p=R.replay(r.state,witness);assert.equal(p.valid,true);assert.equal(p.events.length,1);return M.step(r.state,{state:p.state,event:p.events[0],witness},prior);}
const ids=(resource,kind)=>resource['unclassified'+kind].map(p=>p[kind==='S'?'sId':'lId']);
test('resource projection: consumed unpaired S is classified identically after the later same-bag L',()=>{
 const f=cases[0],r=root(f),before=M.start(r.state,r.summary),saved=copy(before),after=actual(r,f.witness),p=projected(r,f.witness,before);
 assert.deepEqual(f.witness,['R180','HD']);assert.deepEqual(ids(p,'S'),[85]);assert.deepEqual(p.unclassifiedS,after.summary.hangingS.unclassified);
 assert.deepEqual(p.hangingS,[]);assert.equal(M.newUnclassified(p),true);assert.deepEqual(M.repair(after.state,p).unclassifiedS,p.unclassifiedS,'No-repair-needed shortcut still discloses unclassified history');
 assert.deepEqual(before,saved,'A hypothetical child cannot mutate its root or sibling');
 const all=M.checkPath(r.state,f.continuation,r.summary);assert.ok(ids(all.resource,'S').includes(85),'Returned continuation must not erase the same uncertainty');
 assert.notEqual(M.binding(before),M.binding(p));assert.equal(f.advice.evidence.resourceObligations.binding,M.start(M.extendForced(r.state),r.summary).originKey);const retained=P.revalidate(r.state,f.advice,{resourceContext:f.resourceContext,deadline:Infinity,now:()=>0,maxNodes:45000});assert.ok(retained?.target,'Existing ordinary admission stays intact');assert.deepEqual(retained.evidence.resourceObligations.unclassifiedS,p.unclassifiedS.map(({reason,...fact})=>fact));assert.equal(retained.evidence.resourceObligations.uncertainty.S.count,p.unclassifiedS.length);assert.equal(retained.evidence.resourceObligations.uncertainty.S.severeCount,p.unclassifiedS.filter(p=>p.invalidated||p.requiresAccommodation).length);assert.match(retained.reason,/S85/);assert.ok(retained.recommendation.hazards.some(h=>h.code==='unclassified-SL-accommodation')); assert.deepEqual(H.resolve(r.state,r.history),r.summary,'Undo/root history remains unchanged');
 const wire=copy(f.resourceContext);wire.hangingS={status:'none-observed',unclassified:[]};wire.slHistory={pieces:{}};
 assert.deepEqual(H.resolve(r.state,H.importContext(r.state,wire)),r.summary,'Imported derived fields grant no accounting authority');
});
test('resource projection: latent allocations participate in branch bindings without changing the compatibility tag',()=>{
 const r=root(cases[0]),one=M.start(r.state,r.summary),changed=copy(r.summary);changed.allocations.find(a=>a.pieceId===85).region='left';
 const two=M.start(r.state,changed);assert.equal(one.originKey,two.originKey);assert.notEqual(M.binding(one),M.binding(two));
 const oneChild=projected(r,cases[0].witness,one),twoChild=projected(r,cases[0].witness,two);assert.deepEqual(ids(oneChild,'S'),[85]);assert.deepEqual(ids(twoChild,'S'),[],'Component counterfactual distinguishes a certified Left accommodation from consumed unpaired S');
});
test('resource projection: Reset cannot certify newly unclassified known Hanging L',()=>{
 const f=cases[1],r=root(f);assert.deepEqual(r.summary.hangingL.evidence.map(p=>p.lId),[37]);
 const after=actual(r,f.witness),p=projected(r,f.witness);assert.deepEqual(ids(p,'L'),[37]);assert.deepEqual(p.unclassifiedL,after.summary.hangingL.unclassified);assert.equal(M.newUnclassified(p),true);
 const check=Reset.check(r.state,f.continuation,{resourceContext:f.resourceContext,now:()=>0});assert.equal(check.valid,false);assert.equal(check.reason,'reset-transition-invalid');
 assert.equal(Reset.retain(r.state,f.advice,{resourceContext:f.resourceContext,now:()=>0}),null,'Retained checked labels do not bypass fresh admission');
 const carried=M.start(after.state,after.summary);assert.equal(M.newUnclassified(carried),false,'Pre-existing uncertainty remains disclosed rather than becoming an invented new violation');assert.deepEqual(carried.unclassifiedL,p.unclassifiedL);
 const path=f.continuation.slice(1),old=f.advice,advice={...old,target:path[0].target,witness:path[0].witness,continuation:path,evidence:{...old.evidence,gapAccess:{...old.evidence.gapAccess,steps:old.evidence.gapAccess.steps.slice(1)}}};
 const retained=Reset.retain(after.state,advice,{resourceContext:H.exportContext(after.state,after.history),now:()=>0});
 assert.ok(retained?.target,'An already uncertain root may continue without pretending the past L was repaired');assert.deepEqual(retained.evidence.resourceObligations.unclassifiedL,[],'Retired L37 is not fabricated as a live named obligation');assert.equal(retained.evidence.resourceObligations.uncertainty.L.count,p.unclassifiedL.length);assert.deepEqual(retained.evidence.resourceObligations.uncertainty.L.aggregate,[1]);assert.match(retained.reason,/1 additional L accommodation \(identity unavailable\)/);assert.equal(retained.evidence.resourceObligations.uncertainty.S.count,0);assert.deepEqual(retained.evidence.resourceObligations.unclassifiedS,[]);
});
test('resource disclosure: repeated presentation is immutable and does not duplicate or keep a stale warning',()=>{
 const cleanInput={target:{type:'J'},evidence:{resourceObligations:{unclassifiedS:[],unclassifiedL:[]}}};assert.equal(M.discloseAdvice(cleanInput),cleanInput,'No uncertainty must preserve the exact admitted incumbent');
 const input={target:{type:'J'},reason:'Checked finite prefix.',recommendation:{kind:'supported',hazards:[]},evidence:{resourceObligations:{unclassifiedS:[{sId:85,bag:12}],unclassifiedL:[]}}},saved=copy(input);
 const once=M.discloseAdvice(input),twice=M.discloseAdvice(once);assert.deepEqual(input,saved);assert.deepEqual(twice,once);assert.equal(twice.recommendation.hazards.length,1);assert.match(twice.reason,/S85/);
 const clean=M.discloseAdvice({...once,evidence:{...once.evidence,resourceObligations:{unclassifiedS:[],unclassifiedL:[]}}});assert.equal(clean.reason,input.reason);assert.deepEqual(clean.recommendation.hazards,[]);const partial=M.discloseAdvice({...input,evidence:{resourceObligations:{unclassifiedS:[{lId:86,bag:12}],unclassifiedL:[]}}});assert.match(partial.reason,/S \(bag 12, L86\)/);
});
