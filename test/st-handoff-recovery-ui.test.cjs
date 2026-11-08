'use strict';
function expectedDiagnostic(g,pattern,action){
 const original=g.window.console.error,entries=[];g.window.console.error=(...args)=>entries.push(args);
 try{action();}finally{g.window.console.error=original;}
 assert.ok(entries.length>0,'Expected exception logged');
 for(const entry of entries){assert.equal(entry[0],'[ZZTetris diagnostic]');assert.match(entry[1].error.message,pattern);}
}

const test=require('node:test'),assert=require('node:assert/strict');
const P=require('./support/repair-isolated-planner.cjs').planner(),R=require('../st-rules'),B=require('../st-bag'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources'),Provider=require('../st-resource-provider'),Current=require('../st-obligation-resources'),Ctx=require('../st-obligation-context'),Session=require('../st-session'),{withPage}=require('./support/page.cjs');
const fixture=require('./fixtures/forced-bag-resource-binding.json'),clone=x=>JSON.parse(JSON.stringify(x));
function setup(g){g.window.STPlanner=P;const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const f=clone(fixture),history=Ctx.importState(f.options.obligationContext,{position:f.observation});
 const envelope=Session.create(f.observation,{obligationContext:history,patternHistory:f.options.patternHistory,openingPhase:true});
 g.element('#st-snapshot').value=JSON.stringify(envelope);g.click('#st-import');g.advance(40);assert.match(g.element('#st-import-status').textContent,/Session imported/);
 // The archived routing fixture receives freshly derived boundary evidence,
 // just as the actual first maintenance planner now provides.
 const advice=f.advice;const input=Provider.prepare(f.observation,{obligationContext:f.options.obligationContext});advice.evidence.resourceObligations.binding=Current.rootBinding(Provider.startRoute(Provider.projectHandoff(input)));advice.phase='maintenance';advice.evidence.openingHandoff={status:'checked-after-observed-opening-quality',recovery:'shared-after-legacy-budget-miss'};all.at(-1).respond(advice);return{all,advice,originContext:Provider.exportActual(input)};}
test('handoff UI transport (covered-geometry isolated): actual first HOLD/movement/refill carries original evidence once to the next real worker request',()=>withPage('st-lab.html',{},g=>{
 const {all,advice,originContext}=setup(g),original=clone(all.at(-1).message.observation);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
 g.window.stLab.act(advice.witness[0]);g.advance(40);const mid=all.at(-1).message;assert(mid.previous);all.at(-1).respond(mid.previous);
 for(const action of advice.witness.slice(1))g.window.stLab.act(action);g.advance(40);
 const request=all.at(-1).message;assert.equal(request.previous,null);assert.equal(request.commitment,null);assert.equal(request.options.openingPhase,false);assert.deepEqual(request.options.handoffRecovery.obligationContext,originContext);assert.equal(request.options.handoffRecovery.obligationContext.state.sl.handoff,false);assert.deepEqual(request.options.handoffRecovery.continuity.origin,P.observe(original));assert.equal(request.options.handoffRecovery.continuity.actions,advice.witness.length);assert.deepEqual(request.options.handoffRecovery.continuity.current,P.observe(request.observation));
 const a=P.decide(request.observation,{...request.options,deadline:Infinity,now:()=>0,previous:request.previous,commitment:request.commitment});assert.equal(a.metrics.handoffRecovery.retained,true);assert.deepEqual(a.target,advice.continuation[1].target);all.at(-1).respond(a);
 for(const action of a.witness)g.window.stLab.act(action);g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);assert.equal(g.window.stLab.resources.hangingS.evidence.length,0);
}));
test('handoff UI transport (covered-geometry isolated): export/import, reset and Undo cannot restore transient routing authority',()=>withPage('st-lab.html',{},g=>{
 const {all,advice}=setup(g);g.click('#st-export-session');const saved=JSON.parse(g.downloads.at(-1).text);assert.equal(saved.coaching.previous.evidence.openingHandoff.recovery,undefined);assert.equal(saved.coaching.handoffRecovery,undefined);assert.equal(saved.coaching.continuity,undefined);assert.equal(saved.coaching.previous.continuity,undefined);
 for(const action of advice.witness)g.window.stLab.act(action);g.advance(40);assert(all.at(-1).message.options.handoffRecovery);
 g.window.stLab.act('UNDO');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
 saved.coaching.previous.evidence.openingHandoff.recovery='shared-after-legacy-budget-miss';saved.coaching.handoffRecovery={invented:true};g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);assert.equal(all.at(-1).message.previous.evidence.openingHandoff.recovery,undefined);assert.match(g.element('#st-import-status').textContent,/Transient handoff routing was discarded/);
 g.click('#st-reset');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
}));

test('handoff UI transport: stale same-revision worker after import cannot resurrect consumed execution',()=>withPage('st-lab.html',{},g=>{
 const {all,advice}=setup(g);
 for(const action of advice.witness)g.window.stLab.act(action);g.advance(40);
 const stale=all.at(-1),request=stale.message;assert(request.options.handoffRecovery?.continuity);
 const reply=P.decide(request.observation,{...request.options,deadline:Infinity,now:()=>0});assert(reply.target);
 g.click('#st-export-session');const saved=JSON.parse(g.downloads.at(-1).text);
 // Reuse the exact saved revision and identities, as a genuine session import
 // can. Worker object identity, not numeric freshness alone, must isolate it.
 saved.coaching.handoffRecovery=clone(request.options.handoffRecovery);
 g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');g.advance(40);
 assert.equal(all.at(-1).message.observation.revision,request.observation.revision);
 assert.equal(all.at(-1).message.options.handoffRecovery,undefined);assert.equal(g.window.stLab.result,null);
 stale.respond(reply);assert.equal(g.window.stLab.result,null);
 g.window.stLab.act('L');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
}));

test('handoff UI transport: error and incompatible mid-piece advice retire execution without forgiving the S duty',()=>withPage('st-lab.html',{},g=>{
 for(const failure of ['error','incompatible']){
  const {all,advice}=setup(g);g.window.stLab.act(advice.witness[0]);g.advance(40);const worker=all.at(-1);
  if(failure==='error')expectedDiagnostic(g,/Worker failed/,()=>worker.onmessage({data:{type:'error',id:worker.message.id,revision:worker.message.observation.revision}}));
  else{const changed=clone(worker.message.previous);delete changed.evidence.openingHandoff.recovery;worker.respond(changed);}
  for(const action of advice.witness.slice(1))g.window.stLab.act(action);g.advance(40);
  assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
  assert.equal(g.window.stLab.resources.hangingS.evidence.some(p=>p.sId===21),true,'Connector invalidation is not payment');
 }
}));

test('handoff UI transport: post-lock input retires the pending connector and ignores its stale response',()=>withPage('st-lab.html',{},g=>{
 const {all,advice}=setup(g);for(const action of advice.witness)g.window.stLab.act(action);g.advance(40);
 const stale=all.at(-1);assert(stale.message.options.handoffRecovery.continuity);
 g.window.stLab.act('L');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
 stale.respond(advice);assert.equal(g.window.stLab.result,null);
 assert.equal(g.window.stLab.resources.hangingS.evidence.some(p=>p.sId===21),true);
}));
