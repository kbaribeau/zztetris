'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),Y=require('../st-left-foundation'),R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access');
const initial=require('./support/st-gap-phase.json').gap.observation,score=require('./support/st-left-foundation-score-control.json');
const config={maxNodes:45000,depth:3,width:8},clone=x=>JSON.parse(JSON.stringify(x));
let foundationAdvice;
function actualFoundationAdvice(){if(!foundationAdvice){foundationAdvice=P.plan(initial,config);assert.equal(foundationAdvice.evidence.construction.kind,'left-foundation');}return clone(foundationAdvice);}
function discovered(s=initial){const root=R.placements(s),found=Y.search(s,root.placements,{rootComplete:root.complete,deadline:Infinity,maxNodes:12000});assert.ok(found.candidate);return found;}
test('visible paired stage discovers exact Left foundation completion without a supplied route',()=>{
 const found=discovered(),cert=Y.validate(initial,found.candidate.steps);assert.ok(cert.valid);assert.equal(cert.continuation.length,2);
 assert.equal(cert.targets.length,6);assert.equal(Y.parity(cert.end.board),0);assert.equal(Y.leftCovered(cert.end.board),0);assert.equal(P.assess(cert.end.board).maxHeight,5);
 assert.ok(cert.end.board.every((row,y)=>row.slice(4)===initial.board[y].slice(4)));assert.equal(S.centerFoundation(cert.end.board).vacancies.length,0);
 assert.equal(A.prefix(initial,cert.continuation).reachable,true);
 const neutral={...initial,board:initial.board.map(r=>r.replace(/[IJLOSTZ]/g,'#'))};assert.ok(Y.validate(neutral,found.candidate.steps).valid);
 const advice=P.plan(initial,config);assert.equal(advice.evidence.construction.kind,'left-foundation');assert.equal(P.cycleResources(advice.continuation).leftFoundations,1);assert.equal(advice.evidence.cycleResources.tsds,0);assert.match(advice.reason,/does not yet complete the Center/);foundationAdvice=clone(advice);
});
test('foundation stage refuses absent visible mate, immediate scoring, inherited roofs and forged steps',()=>{
 const found=discovered();assert.equal(Y.validate({...initial,queue:['L','L','O','I','J','S']},found.candidate.steps).valid,false);
 assert.equal(Y.eligibility(score),null);const ordinary=P.plan(score,config);assert.ok(ordinary.target);assert.notEqual(ordinary.evidence?.construction?.kind,'left-foundation');
 const bad=R.replay(initial,['HOLD','L','L','L','CCW','HD']).state;assert.equal(Y.eligibility(bad),null);
 const wrong=clone(found.candidate.steps);wrong[1].witness=['HD'];assert.equal(Y.validate(initial,wrong).valid,false);
 assert.equal(Y.validate(initial,found.candidate.steps,{timeMs:0}).valid,false);
 const root=R.placements(initial);assert.equal(Y.search(initial,root.placements,{rootComplete:false}).candidate,null);
});
test('foundation obligation survives first actual T and refreshed preview, then retires',()=>{
 const a=actualFoundationAdvice(),first=R.replay(initial,a.witness),next={...first.state,queue:[...first.state.queue,'Z'],bag:require('../st-bag').consume(first.state.bag,'Z')};
 const suffix=P.continueCommitment(initial,next,a,first.events[0]);assert.ok(suffix);assert.equal(Math.abs(suffix.evidence.constructionStage.parity),2);assert.equal(suffix.continuation.length,1);
 const fresh=P.plan(next,{...config,commitment:{observation:next,advice:suffix}});assert.equal(fresh.evidence.construction.kind,'left-foundation');assert.equal(fresh.target.type,'T');
 const end=R.replay(next,fresh.witness);assert.equal(Y.parity(end.state.board),0);assert.equal(P.continueCommitment(next,end.state,fresh,end.events[0]),null);
 const forged=clone(a);forged.evidence.construction.consumed=1;assert.equal(P.revalidate(initial,forged),null);
 const wrong=R.replay(initial,['HD']);assert.equal(P.continueCommitment(initial,wrong.state,a,wrong.events[0]),null);
});
test('real page carries foundation proof through refreshed worker, Undo and reset',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(result)}});}};
 g.window.STFixtures={...g.window.STFixtures,get:()=>({observation:initial,future:['Z','I','J'],label:'Public foundation control'})};g.window.stLab.loadFixture('internal-control');
 const request=()=>{g.advance(40);return workers.at(-1).message;};let req=request(),a=P.decide(req.observation,{...config,...req.options,timeMs:750,commitment:req.commitment});assert.equal(a.evidence.construction.kind,'left-foundation');workers.at(-1).respond(a);
 for(const action of a.witness)g.window.stLab.act(action);req=request();assert.equal(req.observation.queue.length,6);assert.ok(req.commitment);assert.equal(req.commitment.advice.continuation.length,1);
 const second=P.decide(req.observation,{...req.options,commitment:req.commitment});assert.equal(second.target.type,'T');workers.at(-1).respond(second);for(const action of second.witness)g.window.stLab.act(action);req=request();assert.equal(req.commitment,null);assert.equal(Y.parity(req.observation.board),0);
 g.click('#st-undo');req=request();assert.ok(req.commitment);assert.equal(req.commitment.advice.evidence.construction.consumed,1);
 g.click('#st-reset');req=request();assert.equal(req.commitment,null);assert.deepEqual(req.observation.board,initial.board);
 g.element('#st-snapshot').value=JSON.stringify({...req.observation,construction:a.evidence.construction});g.click('#st-import');req=request();assert.equal(req.commitment,null);
}));
test('two-lock discovery respects empty-hold supply and distinct resulting hold states',()=>{
 const s=R.createState({...initial,hold:null,queue:['O','T','L','I','J','S'],bag:undefined}),found=discovered(s),cert=Y.validate(s,found.candidate.steps);
 assert.ok(cert.valid);assert.ok(cert.continuation.some(p=>p.witness.includes('HOLD')));assert.equal(cert.end.hold,'O');assert.equal(cert.end.active.type,'L');
 const roots=R.placements(s,{allowHold:false}),later=Y.search(s,roots.placements,{rootComplete:roots.complete,deadline:Infinity,maxNodes:12000});assert.ok(later.candidate);assert.ok(later.candidate.steps[1].witness.includes('HOLD'));
});
test('occupied HOLD rebinds the same mate, while unrelated hold/preview and tiny budgets cannot certify it',()=>{
 const a=actualFoundationAdvice(),first=R.replay(initial,a.witness),suffix=P.continueCommitment(initial,first.state,a,first.events[0]);assert.ok(suffix);
 const swapped=R.move(first.state,'HOLD'),commitment={observation:first.state,advice:suffix};
 const tiny=P.plan(swapped,{maxNodes:1,timeMs:750,commitment});assert.equal(tiny.target,null);assert.ok(tiny.metrics.nodes<=1);
 const resumed=P.plan(swapped,{maxNodes:8000,timeMs:750,commitment});assert.equal(resumed.evidence.construction.kind,'left-foundation');assert.equal(resumed.holdCount,1);assert.ok(resumed.metrics.nodes<=8000);
 const finished=R.replay(swapped,resumed.witness);assert.equal(Y.parity(finished.state.board),0);assert.equal(finished.state.hold,'S');
 const twice=R.move(swapped,'HOLD'),again=P.plan(twice,{maxNodes:8000,timeMs:750,commitment});assert.equal(again.evidence.construction.kind,'left-foundation');assert.equal(again.holdCount,0);
 for(const changed of [{...first.state,hold:'I'},{...first.state,queue:['Z',...first.state.queue.slice(1)]}]){
  const r=P.plan(changed,{maxNodes:8000,timeMs:150,commitment});assert.notEqual(r.evidence?.construction?.kind,'left-foundation');
 }
});
