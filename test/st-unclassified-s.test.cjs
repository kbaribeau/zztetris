'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),B=require('../st-bag'),P=require('../st-planner'),Session=require('../st-session');
const {withPage}=require('./support/page.cjs'),cases=require('./fixtures/unclassified-s.json').cases,clone=x=>JSON.parse(JSON.stringify(x));
function data(f){const s=f.request.observation,h=H.importContext(s,f.request.options.resourceContext);return{s,h,summary:H.resolve(s,h)};}
function pack(f){const {s,h}=data(f),ctx=f.request.options.resourceContext;return Session.create(s,{resourceHistory:h,resourceOriginBag:B.fromObserved({observed:[ctx.origin.active.type,...ctx.origin.queue],startPhase:0}),patternHistory:f.request.options.patternHistory,openingPhase:true});}
test('unclassified S: real I17 invalidation survives initialization without resurrecting SL target',()=>{
 const before=data(cases[0]),after=data(cases[1]),a=M.start(before.s,before.summary),b=M.start(after.s,after.summary);
 assert.ok(a.pendingCenter.some(p=>p.rootId===14));assert.ok(a.hangingS.some(p=>p.id===14));
 assert.ok(after.summary.center.closed.some(p=>p.rootId===14&&p.status==='invalidated'));
 assert.equal(b.pendingCenter.some(p=>p.rootId===14),false);assert.equal(b.hangingS.some(p=>p.id===14),false);
 assert.ok(b.unclassifiedS.some(p=>p.sId===14));assert.equal(M.repair(after.s,b).valid,null);assert.equal(M.repair(after.s,b).status,'unclassified-S-accommodation');
 const erased=clone(after.summary);erased.hangingS.unclassified=[];
 assert.notEqual(b.originKey,M.start(after.s,erased).originKey);assert.notEqual(M.binding(b),M.binding({...b,unclassifiedS:[]}));
 assert.equal(P.plan(after.s,{...cases[1].request.options,openingPhase:false,disableOpening:true,timeMs:undefined,maxNodes:45000}).target,null);
});
test('unclassified S: generic missing history is not fabricated confirmed or unclassified debt',()=>{
 const s=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),r=M.start(s,H.resolve(s,H.start(s)));
 assert.deepEqual(r.hangingS,[]);assert.deepEqual(r.unclassifiedS,[]);assert.equal(M.repair(s,r).valid,true);
 const known=M.start(s,{instances:{active:r.active},hangingS:{evidence:[{sId:r.active.id,bag:0}]}}),p=R.placements(s,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>x<4));
 const disposed=M.step(s,p,known);assert.deepEqual(disposed.hangingS,[]);assert.deepEqual(disposed.unclassifiedS,[],'Actual identified Left consumption is resolved, not uncertain');
});
test('unclassified S: current tape, HOLD and reveals preserve unknown past accommodation',()=>{
 const {s,h,summary}=data(cases[1]),saved=clone(H.exportContext(s,h));saved.hangingS={unclassified:[]};
 assert.deepEqual(M.start(s,H.resolve(s,H.importContext(s,saved))).unclassifiedS,M.start(s,summary).unclassifiedS);
 let current=s,history=h;for(const action of ['HOLD','HOLD']){const next=R.move(current,action);history=H.applyAction(history,current,action,next);current=next;}
 const got=H.resolve(current,history);assert.deepEqual(got.hangingS.unclassified,summary.hangingS.unclassified);
 // Historical S14 has already been consumed: an unrelated new S cannot pay it.
 const raw=R.createState({active:'S',queue:['L','I','O','J','T','Z']}),r=M.start(raw,{hangingS:{unclassified:summary.hangingS.unclassified}}),p=R.placements(raw,{allowHold:false}).placements.find(p=>p.event.cells.every(([x])=>x<4));
 assert.deepEqual(M.step(raw,p,r).unclassifiedS,r.unclassifiedS);
});
test('unclassified S: session replay and real UI Undo restore the correct boundary',()=>withPage('st-lab.html',{},g=>{
 const saved=pack(cases[1]),prepared=Session.prepare(clone(saved));
 assert.deepEqual(M.start(prepared.state,H.resolve(prepared.state,prepared.resourceHistory)).unclassifiedS,M.start(data(cases[1]).s,data(cases[1]).summary).unclassifiedS);
 g.element('#st-snapshot').value=JSON.stringify(pack(cases[0]));g.click('#st-import');
 const ctx17=cases[0].request.options.resourceContext,ctx18=cases[1].request.options.resourceContext;
 for(const step of ctx18.steps.slice(ctx17.steps.length))g.window.stLab.act(step.action);
 g.click('#st-export-session');let exported=JSON.parse(g.element('#st-snapshot').value),post=Session.prepare(exported);
 assert.ok(M.start(post.state,H.resolve(post.state,post.resourceHistory)).unclassifiedS.some(x=>x.sId===14));
 g.window.stLab.act('UNDO');g.click('#st-export-session');const restored=Session.prepare(JSON.parse(g.element('#st-snapshot').value));
 const r=M.start(restored.state,H.resolve(restored.state,restored.resourceHistory));assert.ok(r.pendingCenter.some(x=>x.rootId===14));assert.ok(!r.unclassifiedS.some(x=>x.sId===14));
}));
