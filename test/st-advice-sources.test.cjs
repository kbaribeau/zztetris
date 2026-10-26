'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
// X.search research certificates retain their separate 750 ms sub-search ceiling.
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
test('research paired-repair wording follows actual remaining T and center stages without claiming policy eligibility',()=>{
 const cert=X.search(recovery.initial,{timeMs:750});assert.ok(cert.valid,cert.reason);
 let state=P.observe(recovery.initial),remainingTs=2;
 for(let i=0;i<cert.continuation.length;i++){
  const continuation=cert.continuation.slice(i),first=continuation[0],advice=P.advicePresentation(continuation,P.assess(cert.end.board),{}),holds=first.witness.filter(x=>x==='HOLD').length;
  sources(advice);assert.equal(/^Hold once\./.test(advice.reason),holds===1);assert.equal(/^Hold twice\./.test(advice.reason),holds===2);
  if(first.event.type==='T'&&!first.event.lines){assert.match(advice.reason,remainingTs===2?/begin the checked paired-T mino-parity repair/:/balance the checked pair/);remainingTs--;}
  else assert.doesNotMatch(advice.reason,/begin the checked paired-T|balance the checked pair/);
  if(i===6){assert.match(advice.reason,/Take the checked T-spin double/);assert.doesNotMatch(advice.reason,/SHOCKY/);assert.equal(advice.sources.some(s=>s.id==='SHOCKY-4'),false);}
  assert.match(advice.reason,/not proof of a completed Reset/);
  const r=R.replay(state,first.witness);assert.ok(r.valid);assert.deepEqual(r.events,[first.event]);state=r.state;
 }
 assert.equal(P.plan(recovery.initial,{timeMs:SEARCH_TIME_MS}).target,null,'Presentation of a research proof does not make its high-Left start policy-eligible');
});
test('research cap-deferral wording stops claiming a pending replacement after actual repayment',()=>{
 const cert=X.search(cap.initial,{kind:'cap-deferral',timeMs:750});assert.ok(cert.valid);
 let state=P.observe(cap.initial);
 for(let i=0;i<cert.continuation.length;i++){
  const continuation=cert.continuation.slice(i),a=P.advicePresentation(continuation,P.assess(cert.end.board),{kind:'cap-deferral'});sources(a);
  if(i===0)assert.match(a.reason,/restores the Z cap in 2 placements/);
  if(i===1)assert.match(a.reason,/restore the cap over the Pocket/);
  if(i===2){assert.match(a.reason,/Take the checked T-spin double/);assert.doesNotMatch(a.reason,/restores the Z cap in|restore the cap over/);}
  const r=R.replay(state,continuation[0].witness);assert.ok(r.valid);assert.deepEqual(r.events,[continuation[0].event]);state=r.state;
 }
 const a=P.plan(cap.initial,{timeMs:SEARCH_TIME_MS});if(a.target)assert.notEqual(a.evidence.strategy,'finite-cap-deferral','Unknown Extra-Z history must not authorize the research route');
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
