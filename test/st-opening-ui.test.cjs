'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),F=require('../st-fixtures');
const clone=x=>JSON.parse(JSON.stringify(x));
test('opening UI: actual worker requests recompute after manual play, reset and imported geometry',()=>withPage('st-lab.html',{},g=>{
 const workers=[];
 g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 const select=v=>{g.element('#st-fixture').value=v;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));};
 select('empty');let r=request();assert.equal(r.options.openingPhase,true);assert.equal(r.options.openingClear,null);const initial=r.observation;
 g.window.stLab.act('HOLD');g.window.stLab.act('L');g.window.stLab.act('HD');r=request();
 assert.equal(r.options.openingPhase,true);assert.equal(r.options.openingClear,null);assert.equal(r.observation.queue.length,6);assert.notDeepEqual(r.observation.board,initial.board);assert.equal(r.previous,null);
 g.click('#st-reset');r=request();assert.equal(r.options.openingPhase,true);assert.deepEqual(r.observation.board,initial.board);assert.equal(r.options.openingClear,null);
 const imported={...F.get('marathon-rebuild').observation,openingPhase:true,openingClear:{event:{lines:2}}};
 g.element('#st-snapshot').value=JSON.stringify(imported);g.click('#st-import');r=request();assert.equal(r.options.openingPhase,false);assert.equal(r.options.openingClear,null);
 g.element('#st-snapshot').value=JSON.stringify({...initial,openingPhase:false});g.click('#st-import');r=request();assert.equal(r.options.openingPhase,true);assert.equal(r.options.openingClear,null);
 select('marathon-rebuild');r=request();assert.equal(r.options.openingPhase,false);
}));
