'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),A=require('../st-access');
const f=require('./support/st-early-cap-fallback.json');
const fallback=require('./support/st-fallback-harness.cjs')();
const config={depth:3,width:8,deadline:Infinity,patternHistory:f.patternHistory};
function replay(a,state=f.observation){assert.ok(a.target,a.reason);const r=R.replay(state,a.witness);assert.ok(r.valid);assert.deepEqual(r.events,[a.continuation[0].event]);return r;}
test('early cap fallback branch: certified action survives withheld optional result after search exhausts nodes',()=>{
 const root=R.placements(f.observation),limit=root.visited+300;assert.ok(root.complete);
 const a=fallback.plan(f.observation,{...config,maxNodes:limit}),r=replay(a);
 assert.deepEqual(r.events,R.replay(f.observation,f.witness).events);
 assert.equal(a.metrics.earlyCapFallback.verified,1);assert.equal(a.metrics.earlyCapFallback.selected,true);
 assert.ok(a.metrics.earlyCapFallback.nodes>0);assert.ok(a.metrics.nodes<=limit);
 assert.equal(a.metrics.completeDepth,0);assert.equal(a.continuation.length,1);assert.equal(a.evidence.preparationProof,null);
 assert.equal(a.evidence.budgetExhausted,true);assert.deepEqual(a.continuation[0].structuralEvidence.cycleViolations,[]);
 assert.equal(a.continuation[0].structuralEvidence.allocation,'right-cap-preparation');
 assert.equal(A.prefix(f.observation,a.continuation,{notches:P.resolvePatternHistory(f.observation,f.patternHistory),maxNodes:0}).reachable,true);
 assert.equal(a.evidence.endpointTEntry,'reachable-if-T-available','hypothetical entry is not an actual future scoring promise');
});
test('early cap fallback does not turn incomplete qualification or root enumeration into a certificate',()=>{
 const root=R.placements(f.observation);
 const unknown=fallback.plan(f.observation,{...config,maxNodes:root.visited+100});
 assert.equal(unknown.target,null);assert.equal(unknown.metrics.earlyCapFallback.verified,0);assert.equal(unknown.metrics.earlyCapFallback.selected,false);
 const partial=fallback.plan(f.observation,{...config,maxNodes:1});
 assert.equal(partial.metrics.earlyCapFallback.attempted,0);assert.equal(partial.metrics.earlyCapFallback.selected,false);
});
test('early cap fallback leaves a later checked continuation in control',()=>{
 const a=P.plan(f.observation,{...config,maxNodes:45000});replay(a);
 assert.equal(a.metrics.earlyCapFallback.verified,1);assert.equal(a.metrics.earlyCapFallback.selected,false);
 assert.ok(a.metrics.completeDepth>0);assert.ok(a.continuation.length>1);
});
test('early cap fallback begins at the actual moved pose and respects disabled hold',()=>{
 const moved=R.move(R.createState(f.observation),'L');assert.notDeepEqual(moved.active,f.observation.active);
 const root=R.placements(moved),a=fallback.plan(moved,{...config,maxNodes:root.visited+300});replay(a,moved);
 assert.equal(a.metrics.earlyCapFallback.selected,true);assert.equal(a.witness[0],'HOLD');
 const noHold=P.plan(f.observation,{...config,allowHold:false,maxNodes:1500});
 assert.equal(noHold.metrics.earlyCapFallback.attempted,0);assert.ok(!noHold.target||noHold.target.type!=='Z');
});
test('early cap fallback does not cap before actual empty-HOLD cleanup I',()=>{
 const source=require('./support/st-user-held-t-preparation.json');
 const s=R.createState({board:source.board,active:'Z',hold:null,queue:['I','L','J','T','Z','O']});
 const a=P.plan(s,{depth:1,width:8,maxNodes:8000});replay(a,s);
 assert.equal(a.target.type,'I');assert.equal(a.metrics.earlyCapFallback.verified,0);assert.equal(a.metrics.earlyCapFallback.selected,false);
 assert.equal(a.continuation[0].structuralEvidence.allocation,'quad-preparation');
});
test('early cap fallback cannot grant authority to invalid inherited phase or an incoming commitment',()=>{
 const invalid={...f.patternHistory,origin:Array(40).fill('..........')};
 const broken=P.plan(f.observation,{...config,patternHistory:invalid,maxNodes:1500});assert.equal(broken.target,null);
 const saved=P.plan(f.observation,{...config,maxNodes:1234});assert.ok(saved.target);
 const a=P.plan(f.observation,{...config,maxNodes:1234,commitment:{observation:f.observation,advice:saved}});
 assert.equal(a.metrics.earlyCapFallback.attempted,0);assert.equal(a.metrics.earlyCapFallback.selected,false);
});

test('early cap default policy may keep ordinary advice without borrowing an incomplete fallback certificate',()=>{
 const root=R.placements(f.observation),a=P.plan(f.observation,{...config,maxNodes:root.visited+100});
 replay(a);assert.equal(a.metrics.earlyCapFallback.verified,0);assert.equal(a.metrics.earlyCapFallback.selected,false);
 assert.notEqual(a.evidence.endpointTEntry,'reachable-if-T-available','Unfinished fallback qualification cannot certify counterfactual T entry');
});
