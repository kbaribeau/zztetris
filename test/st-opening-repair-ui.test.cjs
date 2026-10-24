'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{withPage}=require('./support/page.cjs');
const P=require('../st-planner'),O=require('../st-opening'),R=require('../st-rules'),c=require('./support/st-opening-round1.json').repairControl;
const clone=x=>JSON.parse(JSON.stringify(x)),same=x=>({...clone(x),revision:0});
test('opening repair UI: actual witnessed route survives refresh, movement, Undo and wrong-drop invalidation',()=>withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 const f=require('./support/st-opening-repair-ui.json'),values=[];for(const desired of f.bags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);values.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>values.shift();const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));
 for(const witness of f.witnesses)for(const action of witness)g.window.stLab.act(action);
 const origin=request();assert.deepEqual(same(origin.observation),same(c.originObservation));
 const cert=O.repairCertificate(origin.observation,c.continuation);assert.ok(cert);const first=cert.steps[0];
 const advice={status:'recommended-with-verified-prefix',phase:'opening',target:first.target,witness:first.witness,hold:first.hold,holdCount:first.holdCount,continuation:cert.steps,evidence:{opening:{repair:cert}},reason:'Checked fixture route.'};
 workers.at(-1).respond(advice);for(const action of advice.witness)g.window.stLab.act(action);
 let req=request();assert.equal(req.observation.queue.length,6);assert.equal(req.options.openingRepair.consumed,1);
 const result=P.decide(req.observation,{...req.options,maxNodes:45000,timeMs:undefined});assert.ok(result.target);workers.at(-1).respond(result);
 for(const action of result.witness)g.window.stLab.act(action);req=request();assert.equal(O.balance(req.observation.board),0);assert.equal(req.options.openingRepair,null);
 g.window.stLab.act('UNDO');req=request();assert.equal(req.options.openingRepair.consumed,1);assert.ok(O.checkedRepair(req.options.openingRepair,req.observation));
 g.window.stLab.act('HD');req=request();assert.equal(req.options.openingRepair,null);
 g.click('#st-reset');req=request();assert.equal(req.options.openingRepair,null);
}));
