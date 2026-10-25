'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{withPage}=require('./support/page.cjs');
const P=require('../st-planner'),clone=x=>JSON.parse(JSON.stringify(x));
test('source opening UI: manual HOLD, exact input target, family, Undo, reset and import provenance',()=>withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const request=()=>{g.advance(40);return workers.at(-1).message;},select=value=>{g.element('#st-fixture').value=value;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));};
 const values=[];for(const desired of ['ZOTLJSI','IJLOSTZ','TLSZOJI']){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);values.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>values.shift();select('empty');let req=request();const initial=clone(req.observation);assert.deepEqual(req.options.openingSource,{pattern:null});
 g.window.stLab.act('HOLD');req=request();assert.deepEqual(req.options.openingSource,{pattern:null});assert.equal(req.observation.hold,initial.active.type);assert.equal(req.observation.queue.length,6);
 let family,afterFirst;
 for(let lock=1;lock<=2;lock++){
  const advice=P.decide(req.observation,{...req.options,timeMs:undefined});assert.ok(advice.evidence.opening.sourcePlan);family??=advice.evidence.opening.sourcePlan.id;assert.equal(advice.evidence.opening.sourcePlan.id,family);workers.at(-1).respond(advice);
  for(const action of advice.witness){g.window.stLab.act(action);if(action!=='HD'){assert.deepEqual(clone(g.window.stLab.result.target),advice.target);assert.equal(g.window.stLab.result.retained,true);}}
  req=request();assert.equal(req.options.openingSource.pattern,family);assert.equal(req.options.openingPhase,true);if(lock===1)afterFirst=clone(req.observation);
 }
 g.window.stLab.act('UNDO');req=request();assert.deepEqual(req.observation.board,afterFirst.board);assert.equal(req.options.openingSource.pattern,family);
 const again=P.decide(req.observation,{...req.options,timeMs:undefined});assert.equal(again.evidence.opening.sourcePlan.id,family);
 g.click('#st-reset');req=request();assert.deepEqual(req.observation.board,initial.board);assert.deepEqual(req.options.openingSource,{pattern:null});
 for(const imported of [afterFirst,initial]){g.element('#st-snapshot').value=JSON.stringify({...imported,openingSource:{pattern:family},sourcePlan:again.evidence.opening.sourcePlan});g.click('#st-import');req=request();assert.equal(req.options.openingSource,null);}
 select('marathon-rebuild');req=request();assert.equal(req.options.openingPhase,false);assert.equal(req.options.openingSource,null);
}));
test('fresh-bag restart clears a source family while replay-current preserves its original bag',()=>withPage('st-lab.html',{seed:42},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));
 let req=request();const original=clone(req.observation),advice=P.decide(req.observation,{...req.options,timeMs:undefined});assert.ok(advice.evidence.opening.sourcePlan);workers.at(-1).respond(advice);
 for(const action of advice.witness)g.window.stLab.act(action);
 req=request();assert.equal(req.options.openingSource.pattern,advice.evidence.opening.sourcePlan.id);assert.equal(req.options.openingSource.history.steps.length,1);
 g.click('#st-reset');req=request();assert.deepEqual([req.observation.active.type,...req.observation.queue],[original.active.type,...original.queue]);assert.deepEqual(req.options.openingSource,{pattern:null});
 let calls=0;g.window.Math.random=()=>{calls++;return 0;};g.tap('KeyR');req=request();assert.equal(calls,6);
 assert.deepEqual(req.options.openingSource,{pattern:null});assert.equal(req.options.openingPhase,true);assert.equal(req.options.openingRepair,null);assert.equal(req.previous,null);assert.equal(req.observation.hold,null);assert.equal(req.observation.streamCursor,1);assert.ok(req.observation.board.every(row=>row==='..........'));assert.equal(g.element('#st-undo').disabled,true);
 const fresh=clone(req.observation);g.window.Math.random=()=>{throw Error('Replay-current must not generate another bag');};g.click('#st-reset');req=request();assert.deepEqual([req.observation.active.type,...req.observation.queue],[fresh.active.type,...fresh.queue]);assert.deepEqual(req.options.openingSource,{pattern:null});
}));

test('source opening UI: timed retention expiry safely replans after a normal input pause',()=>withPage('st-lab.html',{seed:42},g=>{
 const E=require('../scripts/lib/st-simulation.cjs'),R=require('../st-rules'),planner=E.workerPlanner(),workers=[];
 g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
 let request=workers.at(-1).message,advice=planner(request);assert.ok(advice.evidence.opening.sourcePlan);workers.at(-1).respond(advice);
 const family=advice.evidence.opening.sourcePlan.id,action=advice.witness[0];assert.notEqual(action,'HD');
 const normalNow=g.window.Date.now;let forced=normalNow();g.window.Date.now=()=>forced+=101;
 try{g.window.stLab.act(action);}finally{g.window.Date.now=normalNow;}
 assert.equal(g.window.stLab.result,null,'An expired retention proof must not leave a displayed target');
 g.advance(40);request=workers.at(-1).message;assert.equal(request.options.openingSource.pattern,family);
 const next=planner(request);workers.at(-1).respond(next);
 assert.ok(next.target,'Replanning from the moved pose should recover legal source guidance');
 assert.equal(next.evidence?.opening?.sourcePlan?.id,family,'The original source family must survive a human input pause');
 const proof=R.replay(request.observation,next.witness);assert.equal(proof.valid,true);assert.equal(proof.events.length,1);assert.deepEqual(proof.events[0].target,next.target);
 assert.deepEqual(clone(g.window.stLab.result.target),next.target);
}));

test('second-bag source UI: real HOLD retention, revision-changing Undo, reset and import fail safely',()=>withPage('st-lab.html',{},g=>{
 const Sim=require('../scripts/lib/st-simulation.cjs'),input=Sim.makeInput('empty',2026103510,150),workers=[],values=[];
 const bags=[[input.initial.active.type,...input.initial.queue]];for(let i=0;i+7<=input.future.length;i+=7)bags.push(input.future.slice(i,i+7));
 for(const desired of bags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);assert.ok(j>=0);values.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>{assert.ok(values.length);return values.shift();};
 g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));
 let req=request();
 for(let lock=1;lock<=7;lock++){const a=P.decide(req.observation,{...req.options,timeMs:undefined});assert.ok(a.evidence?.opening?.sourcePlan);workers.at(-1).respond(a);for(const action of a.witness)g.window.stLab.act(action);req=request();}
 assert.equal(req.options.openingSource.history.steps.length,7);assert.ok(req.options.openingSource.continuationFrom);const root=clone(req.observation),a=P.decide(req.observation,{...req.options,timeMs:undefined});assert.equal(a.evidence.opening.sourcePlan.stage,'second-bag');workers.at(-1).respond(a);
 for(const action of a.witness){g.window.stLab.act(action);if(action!=='HD'){assert.equal(g.window.stLab.result.retained,true);assert.deepEqual(clone(g.window.stLab.result.target),a.target);}}
 req=request();assert.equal(req.options.openingSource.continuationSteps.length,1);
 const undoRoot=clone(req.observation),held=P.decide(req.observation,{...req.options,timeMs:undefined});assert.ok(held.witness.includes('HOLD'));workers.at(-1).respond(held);
 for(const action of held.witness){g.window.stLab.act(action);if(action!=='HD'){assert.equal(g.window.stLab.result.retained,true);assert.deepEqual(clone(g.window.stLab.result.target),held.target);}}
 req=request();assert.equal(req.options.openingSource.continuationSteps.length,2);
 g.window.stLab.act('UNDO');req=request();assert.deepEqual(req.observation.board,undoRoot.board);assert.notEqual(req.observation.revision,undoRoot.revision);assert.equal(g.window.stLab.result,null);
 const afterUndo=P.decide(req.observation,{...req.options,timeMs:undefined});assert.equal(afterUndo.evidence?.opening?.sourcePlan,undefined,'revision-disconnected stage certificate cannot revive advice');
 g.click('#st-reset');req=request();assert.deepEqual(req.options.openingSource,{pattern:null});assert.ok(req.observation.board.every(row=>row==='..........'));
 g.element('#st-snapshot').value=JSON.stringify({...root,openingSource:a.evidence.opening.sourcePlan});g.click('#st-import');req=request();assert.equal(req.options.openingSource,null);
}));
