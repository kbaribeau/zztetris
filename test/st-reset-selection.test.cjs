'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),X=require('../st-paired-repair');
const recovery=require('./support/st-construction-recovery.json').initial;
const ordinary=require('./support/st-construction-ordinary-control.json').initial;
const cap=require('./support/st-visible-z-deferral.json').initial;
const clone=x=>JSON.parse(JSON.stringify(x));
// Literal legal inputs from source pages366–372. The converted quiz's supply
// is synthetic, not the original player's verified HOLD/preview. A research
// certificate remains valid even when policy must decline its initiation.
const steps=[['HOLD','L','L','HD'],['L','CCW','HD'],['L','L','L','CCW','HD'],['CW','HD'],['R','R','CW',...Array(18).fill('SD'),'L','HD'],['HOLD','CW','HD'],['R','R','R','CW',...Array(19).fill('SD'),'CW','HD']].map(witness=>({witness}));
test('Reset entry declines the old high-Left case despite a legal paired-T research certificate',()=>{
 const a=P.assess(recovery.board);assert.deepEqual(a.heights,[10,8,8,8,1,1,1,0,1,2]);
 const cert=X.validateCertificate(recovery,steps);assert.ok(cert.valid,cert.reason);assert.equal(cert.continuation.at(-1).event.spin,'full');assert.equal(cert.continuation.at(-1).event.lines,2);
 const gate=P.resetSelection(recovery);assert.equal(gate.status,'not-ready');assert.equal(gate.ordinaryComparison,'ordinary-profile-unsupported');assert.equal(gate.resourceRenewal,false);
 const advice=P.plan(recovery,{timeMs:750});assert.equal(advice.target,null);assert.equal(advice.evidence.resetSelection.status,'not-ready');
});
test('Reset entry keeps source ordinary-scoring and cap-first controls ordinary without claiming executable support',()=>{
 for(const state of [ordinary,cap]){
  const gate=P.resetSelection(state);assert.equal(gate.status,'ordinary-preferred');assert.equal(gate.ordinaryComparison,'ordinary-geometric-profile');assert.match(gate.reason,/not proof of an executable/);
  const a=P.plan(state,{timeMs:750});assert.notEqual(a.evidence?.resetSelection?.status,'selected');assert.notEqual(a.evidence?.strategy,'finite-regional-repair');
 }
});
test('Reset entry does not turn extra Z or T congestion into geometric readiness',()=>{
 for(const queue of [['Z','Z','T','T','T','Z'],['T','T','T','T','T','T']]){
  const s={...clone(recovery),queue,resetSelection:{status:'selected',resourceRenewal:true}};
  assert.equal(P.resetSelection(s).status,'not-ready');const a=P.plan(s,{timeMs:750});assert.equal(a.target,null);assert.equal(a.evidence.resetSelection.resourceRenewal,false);
 }
});
test('Reset entry remains declined with disabled construction or exhausted search',()=>{
 for(const options of [{timeMs:0},{timeMs:750,maxNodes:0},{timeMs:750,disableConstruction:true}]){
  const a=P.plan(recovery,options);assert.equal(a.target,null);assert.equal(a.evidence.resetSelection.resourceRenewal,false);assert.notEqual(a.evidence.resetSelection.status,'selected');
 }
});
test('Reset entry never trusts empty, invalid, terminal or broken-notch observations',()=>{
 assert.equal(P.resetSelection(null).status,'invalid-observation');
 assert.equal(P.resetSelection({...recovery,board:R.emptyBoard()}).status,'out-of-scope');
 const s=clone(recovery);s.active.type='?';assert.equal(P.resetSelection(s).status,'invalid-observation');
 assert.equal(P.resetSelection(ordinary,{patternHistory:{version:999}}).status,'out-of-scope');
 assert.equal(P.resetSelection({...ordinary,topOut:true}).status,'out-of-scope');
});
test('a previously certified high-Left construction cannot bypass new Reset readiness through retention',()=>{
 const cert=X.validateCertificate(recovery,steps);assert.ok(cert.valid,cert.reason);const first=cert.continuation[0];
 const advice={target:first.event.target,witness:first.witness,continuation:cert.continuation,evidence:{construction:{origin:recovery,steps,consumed:0},resetSelection:{status:'selected',resourceRenewal:true}}};
 const r=R.replay(recovery,first.witness);assert.ok(r.valid);assert.equal(P.continueCommitment(recovery,r.state,advice,r.events[0]),null);
 assert.equal(P.revalidate(recovery,{...advice,context:P.plan(recovery,{timeMs:0}).context}),null);
});
test('source134 near-catch-up geometry alone is not an automatic Reset or a fresh resource allowance',()=>{
 // Source placement134, before its first diverted T: Left3, Center6, Right4.
 // This motivates the conservative +2 gap envelope, not a universal threshold.
 const rows=['....LLL...','....LSS...','....SS...Z','JJ..LLL.ZZ','JJOOLSS.Z.','JJOOLSS.Z.'];
 const s=R.createState({board:Array(40-rows.length).fill('..........').concat(rows),active:'T',hold:'T',queue:['I','Z','T','I','Z','L']});
 const a=P.assess(s.board);assert.equal(a.left.height,3);assert.equal(a.center.height,6);assert.equal(a.right.height,4);assert.ok(a.left.height<=a.right.height+2&&a.center.height<=a.right.height+2);
 const gate=P.resetSelection(s);assert.equal(gate.status,'ordinary-preferred');assert.equal(gate.resourceRenewal,false,'Near-catch-up geometry does not certify a full recovery or reset allowance');
});
test('Reset policy preserves one-lock Center rebuild precedence without inventing a proof on timeout',()=>{
 const f=require('./support/st-level-base-reentry.json');
 const timely={...f.observation,queue:['L','Z','J','O','I','J']};
 const good=P.plan(timely,{maxNodes:45000,deadline:Infinity});assert.ok(good.target);assert.equal(good.evidence.resetSelection.status,'ordinary-rebuild-preferred');assert.equal(good.continuation.length,1);
 const timed=P.plan(f.observation,{timeMs:0});assert.equal(timed.target,null);assert.equal(timed.evidence.resetSelection.status,'uncertified');assert.match(timed.evidence.resetSelection.reason,/not certified/);
});
