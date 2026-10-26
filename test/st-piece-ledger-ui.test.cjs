'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules');
const clone=x=>JSON.parse(JSON.stringify(x));
function load(g,s){g.element('#st-snapshot').value=JSON.stringify(s);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/Snapshot imported/);}
const ledger=g=>clone(g.window.stLab.pieceLedger);
function square(g,i){for(let n=0;n<4;n++)g.window.stLab.act('L');for(let n=0;n<(i%5)*2;n++)g.window.stLab.act('R');g.window.stLab.act('HD');}
function stable(s){const c=clone(s);delete c.revision;return c;}
test('shadow ledger UI: 100-lock Undo cap restores exact checkpoints and pruning does not reset counts',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 // Supply a deterministic long fixture through the existing fixture loader;
 // imports intentionally cannot carry hidden future. Gameplay/Undo are real.
 const fixture={id:'undo-cap-squares',label:'Squares',observation:R.createState({active:'O',queue:Array(6).fill('O')}),future:Array(110).fill('O')};
 g.window.STFixtures={...g.window.STFixtures,get:id=>id===fixture.id?clone(fixture):g.window.STFixtures.list.find(f=>f.id===id)};
 g.window.stLab.loadFixture(fixture.id);
 const snapshots=[stable(g.snapshot())],ledgers=[ledger(g)];
 for(let i=0;i<101;i++){
  square(g,i);snapshots.push(stable(g.snapshot()));ledgers.push(ledger(g));
  if(i>=98)assert.equal(ledger(g).inventory.O.locked,i+1,'99/100/101 placements retain cumulative counts');
 }
 assert.equal(g.snapshot().topOut,false);assert.equal(g.element('#st-lines').textContent,'Lines since start: 40');
 for(let i=100;i>=1;i--){g.window.stLab.act('UNDO');assert.deepEqual(stable(g.snapshot()),snapshots[i]);assert.deepEqual(ledger(g),ledgers[i]);}
 assert.equal(g.element('#st-undo').disabled,true);g.window.stLab.act('UNDO');assert.deepEqual(stable(g.snapshot()),snapshots[1]);assert.equal(ledger(g).inventory.O.locked,1);
 square(g,1);assert.deepEqual(stable(g.snapshot()),snapshots[2]);assert.deepEqual(ledger(g),ledgers[2]);g.window.stLab.act('UNDO');assert.deepEqual(ledger(g),ledgers[1]);assert.equal(g.element('#st-undo').disabled,true);
 g.click('#st-reset');assert.equal(ledger(g).locks,0);assert.equal(g.element('#st-undo').disabled,true);
}));
test('shadow ledger UI: imports, rejected imports, reset and diagnostic readback never enter public snapshots or worker requests',()=>withPage('st-lab.html',{seed:42},g=>{
 const requests=[];g.window.Worker=class{postMessage(m){requests.push(clone(m));}terminate(){}};
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
 assert.equal(ledger(g).originKnown,true);const initial=ledger(g);g.window.stLab.act('HOLD');g.window.stLab.act('HOLD');g.advance(40);
 assert.equal(Object.values(ledger(g).inventory).reduce((s,v)=>s+v.entered,0),2);
 const current=ledger(g),publicBefore=g.snapshot();g.element('#st-snapshot').value='{}';g.click('#st-import');assert.deepEqual(ledger(g),current);assert.deepEqual(g.snapshot(),publicBefore);
 const read=g.window.stLab.pieceLedger;read.inventory.S.entered=999;assert.deepEqual(ledger(g),current);
 for(const m of requests)for(const obj of[m,m.observation,m.options])assert.equal('pieceLedger' in obj,false);
 g.click('#st-export');const exported=JSON.parse(g.element('#st-snapshot').value);assert.equal('pieceLedger' in exported,false);
 load(g,{...exported,pieceLedger:initial});assert.equal(ledger(g).originKnown,false);assert.equal(ledger(g).coverage,'since-observation');assert.equal(ledger(g).locks,0);
 g.window.stLab.act('HD');assert.equal(ledger(g).locks,1);g.tap('KeyR');assert.equal(ledger(g).locks,0);assert.equal(g.element('#st-undo').disabled,true);
}));
