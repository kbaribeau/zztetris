'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),F=require('../st-fixtures'),X=require('../st-paired-repair');
const recovery=require('./support/st-construction-recovery.json'),cap=require('./support/st-visible-z-deferral.json');
const urls=new Set(['https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit','https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking']);
let centerAdvice;
function actualCenterAdvice(){if(!centerAdvice){centerAdvice=P.plan(F.get('center-j').observation,{maxNodes:45000});assert.ok(centerAdvice.target);}return JSON.parse(JSON.stringify(centerAdvice));}
function sources(a){assert.ok(a.sources.length);for(const s of a.sources){assert.ok(urls.has(s.url));assert.ok(s.label&&s.section&&s.scope);assert.equal(typeof s.id,'string');}assert.equal(new Set(a.sources.map(s=>s.id)).size,a.sources.length);}
test('actual center and right advice cites community concepts without universal flat-left claims',()=>{
 const center=actualCenterAdvice();sources(center);assert.ok(center.sources.some(s=>s.id==='SHOCKY-3.2'));assert.match(center.reason,/overhang/);
 const right=P.plan(F.get('cap-rebuild').observation,{maxNodes:45000});sources(right);assert.match(right.reason,/Pocket \(column 10\)/);assert.doesNotMatch(right.reason,/Keep the left region flat/);
});
test('paired repair wording follows actual remaining T and center stages through every lock',()=>{
 let state=P.observe(recovery.initial),advice=P.plan(state,{timeMs:750});assert.ok(advice.evidence.construction);let remainingTs=2;
 for(let i=0;i<7;i++){
  sources(advice);const first=advice.continuation[0],holds=first.witness.filter(x=>x==='HOLD').length;
  assert.equal(/^Hold once\./.test(advice.reason),holds===1);assert.equal(/^Hold twice\./.test(advice.reason),holds===2);
  if(first.event.type==='T'&&!first.event.lines){assert.match(advice.reason,remainingTs===2?/begin the checked paired-T mino-parity repair/:/balance the checked pair/);remainingTs--;}
  else assert.doesNotMatch(advice.reason,/begin the checked paired-T|balance the checked pair/);
  if(i===6){assert.match(advice.reason,/Take the checked T-spin double/);assert.doesNotMatch(advice.reason,/SHOCKY/);assert.equal(advice.sources.some(s=>s.id==='SHOCKY-4'),false);}
  assert.match(advice.reason,/not proof of a completed Reset/);
  const r=R.replay(state,advice.witness);assert.ok(r.valid);const suffix=P.continueCommitment(state,r.state,advice,r.events[0]);state=r.state;if(i<6){assert.ok(suffix);advice=suffix;}else assert.equal(suffix,null);
 }
});
test('cap-deferral wording stops claiming a pending replacement after actual repayment',()=>{
 const cert=X.search(cap.initial,{kind:'cap-deferral',timeMs:750});assert.ok(cert.valid);
 const construction={kind:'cap-deferral',origin:P.observe(cap.initial),steps:cert.continuation.map(p=>({witness:p.witness})),consumed:0};
 let state=P.observe(cap.initial),a=P.plan(state,{timeMs:750,commitment:{observation:state,advice:{evidence:{construction}}}});assert.ok(a.target);
 assert.match(a.reason,/restores the Z cap in 2 placements/);
 let r=R.replay(state,a.witness);a=P.continueCommitment(state,r.state,a,r.events[0]);state=r.state;assert.match(a.reason,/restore the cap over the Pocket/);
 r=R.replay(state,a.witness);a=P.continueCommitment(state,r.state,a,r.events[0]);assert.match(a.reason,/Take the checked T-spin double/);assert.doesNotMatch(a.reason,/restores the Z cap in|restore the cap over/);sources(a);
});
test('ordinary revalidation regenerates stale HOLD text and arbitrary imported source descriptors',()=>{
 const state=F.get('center-j').observation,a=actualCenterAdvice();
 const stale={...a,reason:'Hold twice. Bad stale advice.',sources:[{id:'bad',url:'javascript:alert(1)'}]};
 const valid=P.revalidate(state,stale);assert.ok(valid);assert.doesNotMatch(valid.reason,/Bad stale/);sources(valid);assert.ok(valid.sources.every(s=>s.id!=='bad'));
});
test('a replayed scoring-first route describes its remaining S/L pair rather than an unchecked completion',()=>{
 const S=require('../st-structure'),witnesses=require('./support/st-empty-hold-orders.json').orders.scoreFirst;
 const origin=P.observe(F.get('empty-hold').observation);let state=origin;const path=[];
 for(const witness of witnesses){const r=R.replay(state,witness);assert.ok(r.valid);const event=r.events[0],transition=S.transition(state,{state:r.state,event});
  path.push({target:event.target,witness,event,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,structuralEvidence:{...transition,structure:S.geometry(r.state.board)}});state=r.state;
 }
 const first=R.replay(origin,path[0].witness),current=P.observe(first.state);
 const context=JSON.stringify([current.rules,current.board,current.hold,current.canHold,current.queue,current.bag??null,current.active.type]);
 const advice={...path[1],continuation:path.slice(1),context,assessment:P.assess(state.board),evidence:{cycleDebt:0}};
 const suffix=P.revalidate(current,advice);assert.ok(suffix);assert.equal(suffix.continuation[0].event.type,'S');assert.equal(suffix.continuation[1].event.type,'L');
 assert.match(suffix.reason,/Then place L to complete the S\/L overhang/);assert.doesNotMatch(suffix.reason,/has not been checked|scoring and cleanup/);sources(suffix);
});
