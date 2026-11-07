'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules');
const clone=x=>JSON.parse(JSON.stringify(x));
function load(g,s){g.element('#st-snapshot').value=JSON.stringify(s);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/Snapshot imported/);}
// Keep the old UI file's long Undo/import coverage against the current
// authority. The retired standalone PieceLedger is only a reference module.
const current=g=>clone(g.window.stLab.obligationContext),inventory=g=>clone(g.window.stLab.publicInventory);
function square(g,i){for(let n=0;n<4;n++)g.window.stLab.act('L');for(let n=0;n<(i%5)*2;n++)g.window.stLab.act('R');g.window.stLab.act('HD');}
function stable(s){const c=clone(s);delete c.revision;return c;}
test('current inventory UI: 100-lock Undo cap restores exact duties and public identity checkpoints',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 // Supply a deterministic long fixture through the existing fixture loader;
 // imports intentionally cannot carry hidden future. Gameplay/Undo are real.
 const fixture={id:'undo-cap-squares',label:'Squares',observation:R.createState({active:'O',queue:Array(6).fill('O')}),future:Array(110).fill('O')};
 g.window.STFixtures={...g.window.STFixtures,get:id=>id===fixture.id?clone(fixture):g.window.STFixtures.list.find(f=>f.id===id)};
 g.window.stLab.loadFixture(fixture.id);
 const snapshots=[stable(g.snapshot())],contexts=[current(g)],inventories=[inventory(g)];
 for(let i=0;i<101;i++){
  square(g,i);snapshots.push(stable(g.snapshot()));contexts.push(current(g));inventories.push(inventory(g));
  if(i>=98){assert.equal(inventory(g).active.id,i+2,'99/100/101 placements preserve the live identity after pruning');assert.equal(g.element('#st-pieces-value').textContent,String(i+1));}
 }
 assert.equal(g.snapshot().topOut,false);assert.equal(g.element('#st-lines').getAttribute('aria-label'),'40 lines cleared since start');
 for(let i=100;i>=1;i--){g.window.stLab.act('UNDO');assert.deepEqual(stable(g.snapshot()),snapshots[i]);assert.deepEqual(current(g),contexts[i]);assert.deepEqual(inventory(g),inventories[i]);}
 assert.equal(g.element('#st-undo').disabled,true);g.window.stLab.act('UNDO');assert.deepEqual(stable(g.snapshot()),snapshots[1]);assert.equal(inventory(g).active.id,2);assert.equal(g.element('#st-pieces-value').textContent,'1');
 square(g,1);assert.deepEqual(stable(g.snapshot()),snapshots[2]);assert.deepEqual(current(g),contexts[2]);g.window.stLab.act('UNDO');assert.deepEqual(current(g),contexts[1]);assert.equal(g.element('#st-undo').disabled,true);
 g.click('#st-reset');assert.deepEqual(current(g),contexts[0]);assert.deepEqual(inventory(g),inventories[0]);assert.equal(g.element('#st-pieces-value').textContent,'0');assert.equal(g.element('#st-undo').disabled,true);
}));
test('current inventory UI: imports, rejected imports, reset and readback stay isolated without shadow ledger authority',()=>withPage('st-lab.html',{seed:42},g=>{
 const requests=[];g.window.Worker=class{postMessage(m){requests.push(clone(m));}terminate(){}};
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));g.advance(40);
 assert.equal(g.window.STPieceLedger,undefined);assert.equal('pieceLedger'in g.window.stLab,false);assert.equal(inventory(g).originKnown,true);
 const initial=inventory(g);g.window.stLab.act('HOLD');g.window.stLab.act('HOLD');g.advance(40);
 assert.equal(inventory(g).active.id,initial.active.id);assert.equal(inventory(g).hold.id,initial.queue[0].id);assert.equal(inventory(g).streamCursor,initial.streamCursor+1);
 const saved=current(g),publicBefore=g.snapshot();g.element('#st-snapshot').value='{}';g.click('#st-import');assert.deepEqual(current(g),saved);assert.deepEqual(g.snapshot(),publicBefore);
 const read=g.window.stLab.obligationContext,publicRead=g.window.stLab.publicInventory;read.inventory.active.id=999;read.state.dPending=!read.state.dPending;publicRead.queue.length=0;assert.deepEqual(current(g),saved);assert.deepEqual(inventory(g),saved.inventory);
 for(const m of requests)for(const obj of[m,m.observation,m.options])assert.equal('pieceLedger' in obj,false);
 assert.deepEqual(requests.at(-1).options.obligationContext,saved);assert.equal('obligationContext'in requests.at(-1).observation,false);
 g.click('#st-export');const exported=JSON.parse(g.element('#st-snapshot').value);assert.equal('pieceLedger' in exported,false);
 load(g,{...exported,pieceLedger:{originKnown:true,locks:9999,inventory:initial}});assert.equal(inventory(g).originKnown,false);assert.equal(current(g).state.availability,'unknown');assert.equal(g.element('#st-pieces-value').textContent,'0');
 const imported=current(g),importedPosition=stable(g.snapshot());g.window.stLab.act('HD');assert.equal(g.element('#st-pieces-value').textContent,'1');g.click('#st-reset');assert.deepEqual(current(g),imported);assert.deepEqual(stable(g.snapshot()),importedPosition);assert.equal(g.element('#st-pieces-value').textContent,'0');assert.equal(g.element('#st-undo').disabled,true);
}));
