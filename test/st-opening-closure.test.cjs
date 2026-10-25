'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../st-planner'),O=require('../st-opening'),R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access'),f=require('./support/st-visible-opening-closure.json');
const clone=x=>JSON.parse(JSON.stringify(x)),config={openingPhase:true,deadline:Infinity,maxNodes:45000};
function clean(){S.clearCache();A.clearCache();}
function replay(steps){let state=f.observation;for(const p of steps){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);state=r.state;}return state;}
test('visible closure is a combined actual T-balance and Center-partner goal, not metadata',()=>{
 const cert=O.closureCertificate(f.observation,f.steps);assert.ok(cert);assert.equal(cert.steps.length,5);assert.equal(cert.goal.balance,true);assert.equal(cert.goal.center.piece,'J');assert.ok(O.checkedRepair(cert,f.observation));
 const first4=replay(f.steps.slice(0,4));assert.equal(O.balance(first4.board),0);assert.equal(O.goalPaid(f.observation,f.steps.slice(0,4),cert.goal),false);assert.equal(O.goalPaid(f.observation,f.steps,cert.goal),true);
 assert.equal(O.checkedRepair({...cert,kind:'invented'},f.observation),null);assert.equal(O.checkedRepair({...cert,basis:clone(cert)},f.observation),null);
 const wrong=clone(cert);wrong.steps[4].witness=['HD'];assert.equal(O.checkedRepair(wrong,f.observation),null);
 assert.equal(O.closureCertificate({...f.observation,queue:['Z','I','T','L','J','O']},f.steps),null);
 assert.equal(O.closureCertificate(f.observation,f.steps.slice(0,4)),null);
});
test('bounded closure compares a complete five-lock horizon while incomplete extension retains nominal advice',()=>{
 clean();const before=P.decide(f.observation,{...config,disableOpeningClosure:true});assert.equal(before.target.x,2);assert.equal(before.continuation.length,3);
 clean();const a=P.decide(f.observation,config);assert.equal(a.target.type,'O');assert.equal(a.metrics.rootTies,undefined);assert.equal(a.metrics.tieExtension,undefined);assert.equal(a.target.x,3);assert.equal(a.metrics.completeDepth,5);assert.equal(a.metrics.visibleClosure.selected,true);assert.equal(a.evidence.opening.repair.kind,'visible-closure');assert.equal(a.continuation.length,5);assert.equal(A.prefix(f.observation,a.continuation).reachable,true);
 const end=replay(a.continuation);assert.equal(O.balance(end.board),0);assert.equal(S.geometry(end.board).center.status,'level');assert.equal(S.geometry(end.board).center.foundation.status,'aligned');
 clean();const limited=P.decide(f.observation,{...config,maxNodes:14000});assert.equal(limited.metrics.visibleClosure.selected,false);assert.deepEqual(limited.target,before.target);assert.equal(limited.continuation.length,3);assert.equal(limited.evidence.opening.repair,null);
});
test('closure goal survives actual public draws, HOLD prefixes and the balancing T until J pays it',()=>{
 let state=f.observation,proof=O.closureCertificate(state,f.steps);assert.ok(proof);
 for(let i=0;i<5;i++){
  const checked=O.checkedRepair(proof,state);assert.ok(checked);const step=checked.path[0];
  for(let k=0;k<step.witness.length-1;k++){state=R.move(state,step.witness[k]);assert.ok(O.checkedRepair(proof,state),'actual cosmetic/HOLD prefix rebinds');}
  const r=R.replay(state,['HD']);assert.ok(r.valid);const session=O.updateSession({active:true,repair:proof},state,r.state,r.events[0]);state=r.state;
  if(i===4){assert.equal(session.repair,null);break;}proof=session.repair;assert.ok(proof);if(i===3){assert.equal(O.balance(state.board),0);assert.equal(proof.consumed,4);assert.ok(O.checkedRepair(proof,state).goal.center);}
 }
});
test('real page retains the exact closure through refreshed preview and T balance, with Undo and reset',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(a){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(a)}});}};
 const values=[];for(const desired of f.uiBags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);values.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}g.window.Math.random=()=>values.shift();
 const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));
 const req=()=>{g.advance(40);return workers.at(-1).message;};req();for(const p of f.uiPrefix){for(const action of p.witness)g.window.stLab.act(action);req();}
 let q=req();assert.deepEqual(q.observation.board,f.observation.board);assert.equal(q.observation.hold,f.observation.hold);assert.deepEqual(q.observation.queue,f.observation.queue);
 const a=P.decide(q.observation,{...q.options,...config});assert.equal(a.evidence.opening.repair.kind,'visible-closure');workers.at(-1).respond(a);
 for(let i=0;i<4;i++){for(const action of a.continuation[i].witness)g.window.stLab.act(action);q=req();assert.equal(q.observation.queue.length,6);assert.equal(q.options.openingRepair.consumed,i+1);assert.ok(O.checkedRepair(q.options.openingRepair,q.observation));}
 assert.equal(O.balance(q.observation.board),0);assert.ok(q.options.openingRepair.goal.center);const next=P.decide(q.observation,{...q.options,...config});assert.equal(next.target.type,'J');workers.at(-1).respond(next);for(const action of next.witness)g.window.stLab.act(action);q=req();assert.equal(q.options.openingRepair,null);
 g.click('#st-undo');q=req();assert.equal(q.options.openingRepair.consumed,4);g.window.stLab.act('L');g.window.stLab.act('HD');q=req();assert.equal(q.options.openingRepair,null,'different actual lock cannot claim the promised J');
 g.click('#st-reset');q=req();assert.equal(q.options.openingRepair,null);assert.ok(q.observation.board.every(r=>r==='..........'));
 g.element('#st-snapshot').value=JSON.stringify({...f.observation,openingRepair:a.evidence.opening.repair});g.click('#st-import');q=req();assert.equal(q.options.openingRepair,null);
}));
