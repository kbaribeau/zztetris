'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),Y=require('../st-left-foundation'),R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access');
const initial=require('./support/st-gap-phase.json').gap.observation,score=require('./support/st-left-foundation-score-control.json');
const config={maxNodes:45000,depth:3,width:8},clone=x=>JSON.parse(JSON.stringify(x));
let foundationProof;
function researchFoundation(){if(!foundationProof){const found=discovered();foundationProof=Y.validate(initial,found.candidate.steps);assert.ok(foundationProof.valid);}return clone(foundationProof);}
function researchAdvice(){const cert=researchFoundation(),first=cert.continuation[0];return{target:first.event.target,witness:first.witness,continuation:cert.continuation,evidence:{construction:{kind:'left-foundation',origin:P.observe(initial),steps:cert.continuation.map(p=>({witness:p.witness})),consumed:0}}};}
function discovered(s=initial){const root=R.placements(s),found=Y.search(s,root.placements,{rootComplete:root.complete,deadline:Infinity,maxNodes:12000});assert.ok(found.candidate);return found;}
test('visible paired stage discovers exact Left foundation completion without a supplied route',()=>{
 const found=discovered(),cert=Y.validate(initial,found.candidate.steps);assert.ok(cert.valid);assert.equal(cert.continuation.length,2);
 assert.equal(cert.targets.length,6);assert.equal(Y.parity(cert.end.board),0);assert.equal(Y.leftCovered(cert.end.board),0);assert.equal(P.assess(cert.end.board).maxHeight,5);
 assert.ok(cert.end.board.every((row,y)=>row.slice(4)===initial.board[y].slice(4)));assert.equal(S.centerFoundation(cert.end.board).vacancies.length,0);
 assert.equal(A.prefix(initial,cert.continuation).reachable,true);
 const neutral={...initial,board:initial.board.map(r=>r.replace(/[IJLOSTZ]/g,'#'))};assert.ok(Y.validate(neutral,found.candidate.steps).valid);
 assert.equal(P.cycleResources(cert.continuation).leftFoundations,1);assert.equal(P.cycleResources(cert.continuation).tsds,0);const presentation=P.advicePresentation(cert.continuation,P.assess(cert.end.board),{kind:'left-foundation'});assert.match(presentation.reason,/does not yet complete the Center/);
 const advice=P.plan(initial,config);assert.equal(advice.target,null,'Ordinary-midgame T scoring obligation forbids this non-scoring pair');
});
test('foundation stage refuses absent visible mate, immediate scoring, inherited roofs and forged steps',()=>{
 const found=discovered();assert.equal(Y.validate({...initial,queue:['L','L','O','I','J','S']},found.candidate.steps).valid,false);
 assert.equal(Y.eligibility(score),null);const ordinary=P.plan(score,config);assert.equal(ordinary.target,null);assert.notEqual(ordinary.evidence?.construction?.kind,'left-foundation');
 // The old TSD then filler route was not a safe ordinary positive: the
 // fillers roof these exact cells. TSD alone passes the new gate but lacks
 // the older visible-resource endpoint completion (also rejected at baseline).
 const old=require('./fixtures/foundation-score-unsafe-prefix.json'),repair=A.repairPrefix(score,old);assert.equal(repair.valid,false);assert.deepEqual(repair.outstandingCells,[[2,28],[2,29],[2,25]]);assert.equal(A.repairPrefix(score,old.slice(0,1)).valid,true);
 const M=require('../st-midgame-resources'),H=require('../st-resource-history'),checked=M.checkPath(score,old.slice(0,1),H.resolve(score,H.start(score)));assert.equal(checked.valid,true);assert.equal(M.repair(checked.state,checked.resource,{maxNodes:4000,now:()=>0}).valid,false);
 const bad=R.replay(initial,['HOLD','L','L','L','CCW','HD']).state;assert.equal(Y.eligibility(bad),null);
 const wrong=clone(found.candidate.steps);wrong[1].witness=['HD'];assert.equal(Y.validate(initial,wrong).valid,false);
 assert.equal(Y.validate(initial,found.candidate.steps,{timeMs:0}).valid,false);
 const root=R.placements(initial);assert.equal(Y.search(initial,root.placements,{rootComplete:false}).candidate,null);
});
test('research foundation retains exact parity after actual first T, without granting a production exception',()=>{
 const cert=researchFoundation(),a=researchAdvice(),first=R.replay(initial,a.witness),next={...first.state,queue:[...first.state.queue,'Z'],bag:require('../st-bag').consume(first.state.bag,'Z')};
 assert.equal(Math.abs(Y.parity(next.board)),2);const end=R.replay(next,cert.continuation[1].witness);assert.ok(end.valid);assert.equal(Y.parity(end.state.board),0);assert.equal(Y.leftCovered(end.state.board),0);
 assert.equal(P.continueCommitment(initial,next,a,first.events[0]),null,'Executing a first off-profile T manually does not authorize the next nonscoring T');
 const fresh=P.plan(next,{...config,commitment:{observation:next,advice:{...a,evidence:{construction:{...a.evidence.construction,consumed:1}}}}});assert.equal(fresh.target,null,'A remembered construction cannot bypass the T scoring obligation');
 const forged=clone(a);forged.evidence.construction.consumed=1;assert.equal(P.revalidate(initial,forged),null);
 const wrong=R.replay(initial,['HD']);assert.equal(P.continueCommitment(initial,wrong.state,a,wrong.events[0]),null);
});
test('real page refuses a non-scoring foundation recommendation and keeps Undo/reset/import histories independent',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
 g.window.STFixtures={...g.window.STFixtures,get:()=>({observation:initial,future:['Z','I','J'],label:'Public foundation control'})};g.window.stLab.loadFixture('internal-control');
 const request=()=>{g.advance(40);return workers.at(-1).message;};let req=request(),a=P.decide(req.observation,{...config,...req.options,timeMs:SEARCH_TIME_MS,commitment:req.commitment});assert.equal(a.target,null);workers.at(-1).respond(a);assert.equal(req.commitment,null);assert.deepEqual(req.observation.board,initial.board);
 // Manual inputs remain allowed; they do not fabricate advice authority.
 const research=researchAdvice();for(const action of research.witness)g.window.stLab.act(action);req=request();assert.equal(req.observation.queue.length,6);assert.equal(req.commitment,null);assert.equal(Math.abs(Y.parity(req.observation.board)),2);
 g.click('#st-undo');req=request();assert.equal(req.commitment,null);assert.deepEqual(req.observation.board,initial.board);
 g.click('#st-reset');req=request();assert.equal(req.commitment,null);assert.deepEqual(req.observation.board,initial.board);
 g.element('#st-snapshot').value=JSON.stringify({...req.observation,construction:research.evidence.construction});g.click('#st-import');req=request();assert.equal(req.commitment,null);
 const imported=P.decide(req.observation,{...config,...req.options});assert.equal(imported.target,null,'Imported proof metadata cannot restore a forbidden T allocation');
}));
test('two-lock discovery respects empty-hold supply and distinct resulting hold states',()=>{
 const s=R.createState({...initial,hold:null,queue:['O','T','L','I','J','S'],bag:undefined}),found=discovered(s),cert=Y.validate(s,found.candidate.steps);
 assert.ok(cert.valid);assert.ok(cert.continuation.some(p=>p.witness.includes('HOLD')));assert.equal(cert.end.hold,'O');assert.equal(cert.end.active.type,'L');
 const roots=R.placements(s,{allowHold:false}),later=Y.search(s,roots.placements,{rootComplete:roots.complete,deadline:Infinity,maxNodes:12000});assert.ok(later.candidate);assert.ok(later.candidate.steps[1].witness.includes('HOLD'));
});
test('occupied HOLD preserves research mate identity but cannot authorize an ordinary nonscoring T',()=>{
 const cert=researchFoundation(),a=researchAdvice(),first=R.replay(initial,a.witness),swapped=R.move(first.state,'HOLD');
 const secondEvent=cert.continuation[1].event,placements=R.placements(swapped,{maxNodes:8000}).placements;
 const mate=placements.find(p=>JSON.stringify(p.event)===JSON.stringify(secondEvent));assert.ok(mate,'The same physical mate is reachable after HOLD');
 assert.equal(Y.parity(mate.state.board),0);assert.equal(mate.state.hold,'S');
 const twice=R.move(swapped,'HOLD'),again=R.replay(twice,cert.continuation[1].witness);assert.ok(again.valid);assert.equal(Y.parity(again.state.board),0);
 const commitment={observation:first.state,advice:{...a,continuation:cert.continuation.slice(1),evidence:{construction:{...a.evidence.construction,consumed:1}}}};
 const tiny=P.plan(swapped,{maxNodes:1,timeMs:SEARCH_TIME_MS,commitment});assert.equal(tiny.target,null);assert.ok(tiny.metrics.nodes<=1);
 for(const changed of [swapped,twice,{...first.state,hold:'I'},{...first.state,queue:['Z',...first.state.queue.slice(1)]}]){
  // Deliberately constrained stale-proof safety probe, not a live-coach success budget.
  const r=P.plan(changed,{maxNodes:8000,timeMs:150,commitment});
  if(r.target){assert.notEqual(r.evidence?.construction?.kind,'left-foundation');assert.ok(r.continuation.every(p=>p.event.type!=='T'||p.event.spin==='full'&&p.event.lines===2));}
 }
});
