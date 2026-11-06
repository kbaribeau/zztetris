'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),B=require('../st-bag');
const clone=x=>JSON.parse(JSON.stringify(x));
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};return all;}
function chooseEmpty(g){g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
test('public inventory/page: reveal frontier is incremental through actual HOLD, locks, Undo, replay and restart',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g),f=require('./support/st-undo-opening.json'),randomValues=[];
 for(const desired of f.bags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);assert.ok(j<=i);randomValues.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>{assert.ok(randomValues.length);return randomValues.shift();};
 const native=g.window.STBag,initializations=[];
 g.window.STBag={...native,fromObserved:options=>{initializations.push(options.observed.length);assert.ok(options.observed.length<=7,'Live play must not rederive knowledge from an ever-growing observed stream');return native.fromObserved(options);}};
 chooseEmpty(g);const initial=g.snapshot(),initialCount=initializations.length;let observed=[initial.active.type,...initial.queue],checkpoints=[];
 for(const witness of f.witnesses){
  checkpoints.push({state:g.snapshot(),observed:observed.slice()});
  for(const action of witness){const before=g.snapshot();g.window.stLab.act(action);const after=g.snapshot(),drawn=after.streamCursor-before.streamCursor,revealed=after.queue.slice(before.queue.length-drawn);observed.push(...revealed);assert.deepEqual(after.bag,B.fromObserved({observed,startPhase:0}));}
 }
 assert.equal(initializations.length,initialCount,'No reset/import occurred, so no initial history should be consulted again');
 const final=g.snapshot();assert.ok(final.bag.observedCount>21);
 g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot().bag,checkpoints.at(-1).state.bag);
 for(const action of f.witnesses.at(-1))g.window.stLab.act(action);assert.deepEqual(g.snapshot().bag,final.bag);
 for(let i=0;i<f.witnesses.length;i++)g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot().bag,initial.bag);
 g.window.stLab.act('HOLD');const held=g.snapshot();assert.deepEqual(held.bag,B.consume(initial.bag,held.queue.at(-1)));
 for(let i=0;i<12;i++)g.window.stLab.act('HOLD');assert.deepEqual(g.snapshot().bag,held.bag,'An occupied HOLD swaps existing identities without observing a draw');
 g.advance(40);const request=all.at(-1).message;assert.deepEqual(request.observation.bag,g.snapshot().bag);assert.equal(request.observation.queue.length,6);assert.equal('observed' in request.observation,false);assert.equal('future' in request.observation,false);
 g.click('#st-reset');assert.deepEqual(g.snapshot().bag,initial.bag);assert.ok(initializations.length>initialCount);
}));
