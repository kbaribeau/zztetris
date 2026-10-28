'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history'),Session=require('../st-session'),{withPage}=require('./support/page.cjs');
const fixture=require('./fixtures/forced-bag-resource-binding.json'),clone=x=>JSON.parse(JSON.stringify(x));
function setup(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const f=clone(fixture),history=H.importContext(f.observation,f.options.resourceContext),origin=f.options.resourceContext.origin;
 const envelope=Session.create(f.observation,{resourceHistory:history,resourceOriginBag:B.fromObserved({observed:[origin.active.type,...origin.queue],startPhase:0}),patternHistory:f.options.patternHistory,openingPhase:true});
 g.element('#st-snapshot').value=JSON.stringify(envelope);g.click('#st-import');g.advance(40);assert.match(g.element('#st-import-status').textContent,/Session imported/);
 const advice=f.advice;advice.phase='maintenance';advice.evidence.openingHandoff={status:'checked-after-observed-opening-quality',recovery:'shared-after-legacy-budget-miss'};all.at(-1).respond(advice);return{all,advice,originContext:f.options.resourceContext};}
test('handoff recovery UI: actual first HOLD/movement/refill carries original evidence once to the next real worker request',()=>withPage('st-lab.html',{},g=>{
 const {all,advice,originContext}=setup(g);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
 g.window.stLab.act(advice.witness[0]);g.advance(40);const mid=all.at(-1).message;assert(mid.previous);all.at(-1).respond(mid.previous);
 for(const action of advice.witness.slice(1))g.window.stLab.act(action);g.advance(40);
 const request=all.at(-1).message;assert.equal(request.previous,null);assert.equal(request.commitment,null);assert.equal(request.options.openingPhase,false);assert.deepEqual(request.options.handoffRecovery.resourceContext,originContext);assert.equal(request.options.handoffRecovery.resourceContext.handoffAtAction,null);
 const a=P.decide(request.observation,{...request.options,deadline:Infinity,now:()=>0,previous:request.previous,commitment:request.commitment});assert.equal(a.metrics.handoffRecovery.retained,true);assert.deepEqual(a.target,advice.continuation[1].target);all.at(-1).respond(a);
 for(const action of a.witness)g.window.stLab.act(action);g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);assert.equal(g.window.stLab.resources.hangingS.evidence.length,0);
}));
test('handoff recovery UI: export/import, reset and Undo cannot restore transient routing authority',()=>withPage('st-lab.html',{},g=>{
 const {all,advice}=setup(g);g.click('#st-export-session');const saved=JSON.parse(g.element('#st-snapshot').value);assert.equal(saved.coaching.previous.evidence.openingHandoff.recovery,undefined);assert.equal(saved.coaching.handoffRecovery,undefined);
 for(const action of advice.witness)g.window.stLab.act(action);g.advance(40);assert(all.at(-1).message.options.handoffRecovery);
 g.window.stLab.act('UNDO');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
 saved.coaching.previous.evidence.openingHandoff.recovery='shared-after-legacy-budget-miss';saved.coaching.handoffRecovery={invented:true};g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);assert.equal(all.at(-1).message.previous.evidence.openingHandoff.recovery,undefined);assert.match(g.element('#st-import-status').textContent,/Transient handoff routing was discarded/);
 g.click('#st-reset');g.advance(40);assert.equal(all.at(-1).message.options.handoffRecovery,undefined);
}));
