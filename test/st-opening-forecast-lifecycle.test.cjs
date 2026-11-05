'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),E=require('../scripts/lib/st-simulation.cjs');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function advice(raw,witness=['HD']){const proof=R.replay(raw,witness);assert.equal(proof.valid,true);return{status:'test-only',target:proof.events[0].target,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(x=>x==='HOLD').length,continuation:[],evidence:{opening:true}};}
function lifecycle(api){
 const calls=[],control={capture:true,reject:false,handoff:false};
 return{calls,control,api:{...api,
  captureOpeningForecast(raw){calls.push({kind:'capture',raw:clone(raw)});return control.capture?{testForecast:true,actions:[],complete:false}:null;},
  advanceOpeningForecast(candidate,before,after,action){calls.push({kind:'advance',before:clone(before),after:clone(after),action});return control.reject?null:{...candidate,actions:[...candidate.actions,action],complete:action==='HD'};},
  acceptOpeningResult(session){calls.push({kind:'accept'});return{...session,active:!control.handoff};},
  updateOpeningSession:session=>session,advance:()=>null,
 }};
}
test('opening forecast lifecycle/UI passes replenished public state, retains completed candidates and clears on deviation, undo, reset and imports',()=>withPage('st-lab.html',{},g=>{
 const workers=[],mock=lifecycle(g.window.STPlanner);g.window.STPlanner=mock.api;
 g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));
 let req=request();assert.equal(req.options.openingForecast,undefined);
 const initial=clone(req.observation),a=advice(initial,['HOLD','HD']);workers.at(-1).respond(a);
 assert.deepEqual(mock.calls.slice(0,2).map(x=>x.kind),['capture','accept']);assert.deepEqual(mock.calls[0].raw,initial);
 for(const action of a.witness)g.window.stLab.act(action);
 req=request();assert.deepEqual(req.options.openingForecast,{testForecast:true,actions:['HOLD','HD'],complete:true});
 const advances=mock.calls.filter(x=>x.kind==='advance');assert.equal(advances.length,2);
 for(const call of advances){assert.equal(call.before.queue.length,6);assert.equal(call.after.queue.length,6);assert.equal(call.after.bag.observedCount,call.before.bag.observedCount+1);for(const key of ['future','seed','rng','inputHash'])assert.equal(key in call.after,false);}
 assert.equal(JSON.stringify(g.window.stLab.exportSession()).includes('testForecast'),false);
 mock.control.capture=false;workers.at(-1).respond(advice(req.observation));g.window.stLab.act('L');req=request();assert.equal(req.options.openingForecast.complete,false);assert.deepEqual(req.options.openingForecast.actions,['HOLD','HD','L']);
 mock.control.reject=true;g.window.stLab.act('R');req=request();assert.equal(req.options.openingForecast,undefined);
 mock.control.capture=true;mock.control.reject=false;workers.at(-1).respond(advice(req.observation));g.window.stLab.act('HD');req=request();assert.ok(req.options.openingForecast);
 g.window.stLab.act('UNDO');req=request();assert.equal(req.options.openingForecast,undefined,'Undo cannot resurrect the transient candidate');
 const recapture=()=>{workers.at(-1).respond(advice(req.observation));g.window.stLab.act('L');req=request();assert.ok(req.options.openingForecast);};
 recapture();const stale=workers.at(-1),staleAdvice=advice(req.observation);g.click('#st-reset');req=request();assert.equal(req.options.openingForecast,undefined);
 const captureCount=mock.calls.filter(x=>x.kind==='capture').length;stale.respond(staleAdvice);assert.equal(mock.calls.filter(x=>x.kind==='capture').length,captureCount,'Stale replies cannot restore a forecast after reset');
 recapture();const envelope=g.window.stLab.exportSession();g.element('#st-snapshot').value=JSON.stringify(envelope);g.click('#st-import');req=request();assert.equal(req.options.openingForecast,undefined);
 recapture();g.element('#st-snapshot').value=JSON.stringify(initial);g.click('#st-import');req=request();assert.equal(req.options.openingForecast,undefined);
 recapture();mock.control.handoff=true;workers.at(-1).respond(advice(req.observation));g.window.stLab.act('R');req=request();assert.equal(req.options.openingForecast,undefined);assert.equal(req.options.openingPhase,false);
}));
test('opening forecast lifecycle/simulation captures before accept, advances every action and supports old planner APIs',()=>{
 const input=E.makeInput('empty',123,5),mock=lifecycle(P),session=E.createSession(input,mock.api);
 assert.equal(session.request(1,{openingForecast:{forged:true}}).options.openingForecast,undefined);
 session.execute(advice(session.state,['HOLD','HD']));
 assert.deepEqual(mock.calls.slice(0,2).map(x=>x.kind),['capture','accept']);assert.deepEqual(mock.calls[0].raw,input.initial);
 let candidate=session.request(2).options.openingForecast;assert.deepEqual(candidate,{testForecast:true,actions:['HOLD','HD'],complete:true});
 for(const call of mock.calls.filter(x=>x.kind==='advance')){assert.equal(call.before.queue.length,6);assert.equal(call.after.queue.length,6);assert.equal(call.after.bag.observedCount,call.before.bag.observedCount+1);assert.equal('future' in call.after,false);}
 candidate.actions.push('FORGED');assert.deepEqual(session.request(2).options.openingForecast.actions,['HOLD','HD'],'Requests cannot mutate the retained candidate');
 mock.control.capture=false;session.execute(advice(session.state));assert.deepEqual(session.request(3).options.openingForecast.actions,['HOLD','HD','HD']);
 mock.control.reject=true;session.execute(advice(session.state));assert.equal(session.request(4).options.openingForecast,undefined);
 mock.control.capture=true;mock.control.reject=false;mock.control.handoff=true;session.execute(advice(session.state));assert.equal(session.request(5).options.openingForecast,undefined);
 const old={...mock.api};delete old.captureOpeningForecast;delete old.advanceOpeningForecast;const baseline=E.createSession(input,old);baseline.execute(advice(baseline.state));assert.equal(baseline.request(2).options.openingForecast,undefined);
});
