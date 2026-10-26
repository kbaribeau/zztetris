'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
// X.search research certificates retain their separate 750 ms sub-search ceiling.
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),X=require('../st-paired-repair');
const fixture=require('./support/st-construction-recovery.json'),ordinary=require('./support/st-construction-ordinary-control.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let recoveryCertificate;
function actualRecoveryCertificate(){if(!recoveryCertificate){S.clearCache();recoveryCertificate=X.search(fixture.initial,{timeMs:750});assert.ok(recoveryCertificate.valid,recoveryCertificate.reason);}return clone(recoveryCertificate);}
function researchAdvice(){const cert=actualRecoveryCertificate(),first=cert.continuation[0];return{target:first.event.target,witness:first.witness,continuation:cert.continuation,evidence:{construction:{origin:P.observe(fixture.initial),steps:cert.continuation.map(p=>({witness:p.witness})),consumed:0}}};}
test('research search still discovers the seven-lock recovery while production declines its high-Left start',()=>{
 S.clearCache();const started=performance.now(),cert=actualRecoveryCertificate();
 assert.equal(cert.continuation.length,7);assert.ok(performance.now()-started<850);
 assert.equal(cert.resources.tFillers,2);assert.equal(cert.resources.tsds,1);
 assert.ok(X.validateCertificate(fixture.initial,cert.continuation).valid);assert.equal(cert.search.depth,7);
 const a=P.plan(fixture.initial,{timeMs:SEARCH_TIME_MS});assert.equal(a.target,null);assert.equal(a.evidence.resetSelection.status,'not-ready');
});
test('research parity is measured through actual locks without promoting its prefix to an ordinary recommendation',()=>{
 let state=P.observe(fixture.initial),parity=0;const cert=actualRecoveryCertificate();
 for(let i=0;i<cert.continuation.length;i++){
  const step=cert.continuation[i],r=R.replay(state,step.witness);assert.ok(r.valid);assert.deepEqual(r.events,[step.event]);const e=r.events[0];
  if(e.type==='T'&&!e.lines)parity+=e.cells.reduce((n,[x,y])=>n+((x+y)%2?1:-1),0);
  if(i===0)assert.equal(Math.abs(parity),2);if(i===1)assert.equal(parity,0);
  if(i===6){assert.equal(e.spin,'full');assert.equal(e.lines,2);}state=r.state;
 }
 assert.equal(parity,0);assert.ok(P.assess(state.board).maintenanceScope);
 const advice=researchAdvice(),r=R.replay(fixture.initial,advice.witness);
 assert.equal(P.continueCommitment(fixture.initial,r.state,advice,r.events[0]),null,'A safe finite prefix is not a policy-authorized Reset');
});
test('construction refuses forged progress, wrong actual lock and absent visible parity/scoring supply',()=>{
 const a=researchAdvice(),r=R.replay(fixture.initial,a.witness);
 const forged=clone(a);forged.evidence.construction.consumed=3;
 assert.equal(P.continueCommitment(fixture.initial,r.state,forged,r.events[0]),null);
 assert.equal(P.continueCommitment(fixture.initial,r.state,a,{...r.events[0],spin:'full'}),null);
 for(const queue of [['S','J','Z','I','O','L'],['T','S','J','Z','I']]){
  const s={...fixture.initial,queue};assert.equal(X.validateCertificate(s,a.continuation).valid,false);const result=P.plan(s,{timeMs:SEARCH_TIME_MS});assert.equal(result.target,null);
 }
});
test('construction retains ordinary scoring instead of imposing a reference T diversion',()=>{
 let s=P.observe(ordinary.initial),commitment=null,lines=0;
 for(let i=0;i<7;i++){
  const a=P.plan(s,{timeMs:SEARCH_TIME_MS,commitment});assert.ok(a.target,a.reason);assert.notEqual(a.evidence.strategy,'finite-regional-repair');
  const r=R.replay(s,a.witness);assert.ok(r.valid);lines+=r.events[0].lines;const next=P.continueCommitment(s,r.state,a,r.events[0]);s=r.state;commitment=next?{observation:s,advice:next}:null;
 }
 assert.equal(lines,4);assert.equal(P.assess(s.board).maxHeight,10);
});

test('construction obeys an already exhausted response budget even with an existing proof',()=>{
 const a=researchAdvice();const start=performance.now();
 const result=P.plan(fixture.initial,{timeMs:0,commitment:{observation:fixture.initial,advice:a}});
 assert.equal(result.target,null);assert.ok(performance.now()-start<100);
});
const zFixture=require('./support/st-visible-z-deferral.json');
test('visible replacement Z creates an executable exact-cap deferral certificate',()=>{
 const a=X.search(zFixture.initial,{kind:'cap-deferral',timeMs:750});assert.ok(a.valid,a.reason);
 assert.equal(a.continuation.length,3);assert.equal(a.cap.paidAt,1);assert.equal(a.continuation[0].event.type,'Z');assert.ok(a.continuation[0].event.cells.every(([x])=>x<7));assert.equal(a.continuation.at(-1).event.spin,'full');
 const less=clone(zFixture.initial);less.hold='I';assert.equal(X.validateCertificate(less,a.continuation,{kind:'cap-deferral'}).valid,false);
 assert.equal(X.validateCertificate(zFixture.initial,a.continuation.slice(0,1),{kind:'cap-deferral'}).valid,false);
 assert.equal(X.validateCertificate(zFixture.initial,a.continuation.slice(0,2),{kind:'cap-deferral'}).valid,false);
});
test('ordinary cap-first remains usable without granting an unknown optional-Z allowance',()=>{
 // Test endpoint comparison independently of a host-dependent wall-clock cut.
 // Production responsiveness remains covered by the timed tests and rollouts.
 const a=P.plan(zFixture.initial,{maxNodes:45000});assert.ok(a.target,a.reason);assert.ok(a.metrics.capStageCandidates>0);
 assert.equal(a.continuation.length,3);assert.equal(a.continuation.at(-1).event.spin,'full');
 const state=a.continuation.reduce((s,p)=>{const r=R.replay(s,p.witness);assert.ok(r.valid);return r.state;},zFixture.initial);
 assert.ok(P.assess(state.board).maxHeight<=9);assert.equal(state.board.join('').replaceAll('.','').length,44);
 assert.equal(S.geometry(state.board).center.status,'supported-partner-completion');
 // The recorded Z deferral remains certified separately. Ordinary cap-first
 // may instead preserve the reusable S/L center and finish lower (height 7),
 // so matching the old unknown-center height-9 endpoint is not required.
 assert.ok(a.continuation[0].event.cells.some(([x])=>x>=7));
});
test('cap deferral exact debt remains verifiable but unknown history cannot authorize its optional Z',()=>{
 const cert=X.search(zFixture.initial,{kind:'cap-deferral'});assert.ok(cert.valid);
 const proof={kind:'cap-deferral',origin:P.observe(zFixture.initial),steps:cert.continuation.map(p=>({witness:p.witness})),consumed:0};
 let state=P.observe(zFixture.initial),capPaid=false;
 for(const [index,step]of cert.continuation.entries()){
  const r=R.replay(state,step.witness);assert.ok(r.valid);assert.deepEqual(r.events,[step.event]);
  if(index===0){assert.ok(step.event.cells.every(([x])=>x<7));assert.equal(capPaid,false);}
  if(index===cert.cap.paidAt){assert.ok(cert.cap.targets.some(c=>JSON.stringify(c.slice().sort())===JSON.stringify(step.event.cells.slice().sort())));capPaid=true;}
  if(step.event.lines)assert.equal(capPaid,true,'Exact cap must be repaid before the score');state=r.state;
 }
 assert.equal(capPaid,true);assert.equal(state.lastEvent.spin,'full');assert.equal(state.lastEvent.lines,2);
 const a=P.plan(zFixture.initial,{timeMs:SEARCH_TIME_MS,commitment:{observation:zFixture.initial,advice:{evidence:{construction:proof}}}});
 if(a.target){assert.notEqual(a.evidence.strategy,'finite-cap-deferral');assert.ok(a.continuation[0].event.type!=='Z'||a.continuation[0].event.cells.some(([x])=>x>=7));}
 const first=cert.continuation[0],r=R.replay(zFixture.initial,first.witness),forged={target:first.event.target,witness:first.witness,continuation:cert.continuation,evidence:{construction:proof}};
 const suffix=P.continueCommitment(zFixture.initial,r.state,forged,r.events[0]);
 if(suffix){assert.ok(suffix.continuation.every(p=>p.event.type!=='Z'||p.event.cells.some(([x])=>x>=7)));assert.ok(suffix.continuation.every(p=>p.event.type!=='T'||p.event.spin==='full'&&p.event.lines===2));assert.notEqual(suffix.evidence.resetSelection?.resourceRenewal,true,'A manual diversion may be repaired but cannot restore a fresh allowance');}
});
test('recorded long-reference Z diversion also repays the exact cap and scores',()=>{
 const fs=require('fs'),vm=require('vm'),codec=vm.runInNewContext(fs.readFileSync(require.resolve('../tetris-fumen.js'),'utf8'),{window:{}})(2);
 const pages=codec.decoder.decode(fs.readFileSync(require.resolve('../references/st-stacking/jstris-26536180.fumen'),'utf8').trim());let state=P.observe(zFixture.initial);const steps=[];
 for(const page of pages.slice(1553,1556)){
  const cells=page.operation.positions().map(({x,y})=>[x,39-y]);
  const p=R.placements(state,{maxNodes:16000}).placements.find(p=>p.event.type===page.operation.type&&p.event.cells.every(([x,y])=>cells.some(([a,b])=>a===x&&b===y))&&(p.event.type!=='T'||p.event.spin==='full'));
  assert.ok(p);steps.push({witness:p.witness});state=p.state;
 }
 assert.ok(X.validateCertificate(zFixture.initial,steps,{kind:'cap-deferral'}).valid);
 const wrong=clone(steps);wrong[1].witness=steps[0].witness;assert.equal(X.validateCertificate(zFixture.initial,wrong,{kind:'cap-deferral'}).valid,false);
});
test('cap stage cannot bypass existing I cleanup or accept a forged construction kind',()=>{
 const s=require('../st-fixtures').get('o-rebuild').observation;s.active={type:'Z',x:3,y:17,rotation:0,lastRotation:null};s.hold='Z';
 assert.equal(S.geometry(s.board).right.cycle.prepareColumn,9);
 const p=R.placements(s).placements.find(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x<7));assert.ok(p);
 assert.equal(X.validateCertificate(s,[{witness:p.witness}],{kind:'cap-deferral'}).reason,'cap-deferral-cannot-bypass-cleanup-I');
 const pair=actualRecoveryCertificate();assert.equal(X.validateCertificate(fixture.initial,pair.continuation,{kind:'cap-deferral'}).valid,false);
});
