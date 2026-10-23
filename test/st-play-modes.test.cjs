'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),F=require('../st-fixtures');
const same=s=>({...s,revision:0});
function select(g,value){g.element('#st-fixture').value=value;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
test('st-modes: exactly two choices, stable Independent rebuild default, internal fixtures retained',()=>withPage('st-lab.html',{},g=>{
 assert.deepEqual([...g.element('#st-fixture').options].map(o=>[o.value,o.textContent]),[['empty','Empty board'],['marathon-rebuild','Stable ST stack']]);
 assert.equal(g.window.document.querySelector('#st-empty'),null);
 assert.deepEqual(g.snapshot().board,F.get('marathon-rebuild').observation.board);
 assert.equal(F.list.length,27);
 const initial=g.snapshot();g.tap('Space');g.click('#st-reset');assert.deepEqual(same(g.snapshot()),same(initial));
 assert.equal(g.element('#st-fixture').value,'marathon-rebuild');
}));
for(const saved of ['empty','marathon-rebuild','o-before-double','unknown',''])
test('st-modes: persisted mode is safely whitelisted '+JSON.stringify(saved),()=>withPage('st-lab.html',{storage:{stLabMode:saved}},g=>{
 const expected=saved==='empty'?'empty':'marathon-rebuild';
 assert.equal(g.element('#st-fixture').value,expected);
 assert.equal(g.snapshot().board.every(r=>r==='..........'),expected==='empty');
 select(g,'empty');assert.equal(g.storage().stLabMode,'empty');
 const empty=g.snapshot();g.tap('ShiftLeft');g.tap('ShiftLeft');assert.equal(g.snapshot().canHold,true);
 g.tap('Space');g.click('#st-reset');assert.deepEqual(same(g.snapshot()),same(empty));
 assert.match(g.element('#st-position-note').textContent,/Opening advice is not supported yet/);
 select(g,'marathon-rebuild');assert.equal(g.storage().stLabMode,'marathon-rebuild');
 assert.deepEqual(g.snapshot().board,F.get('marathon-rebuild').observation.board);
}));
test('st-modes: import is a debugging tool, not a third preset; reset retains import and mode replaces it',()=>withPage('st-lab.html',{},g=>{
 select(g,'empty');
 const imported=F.get('direct-double').observation;
 g.element('#st-snapshot').value=JSON.stringify(imported);g.click('#st-import');
 const origin=g.snapshot();
 assert.deepEqual(origin.board,imported.board);
 assert.equal(g.element('#st-fixture').value,'');
 assert.match(g.element('#st-position-note').textContent,/Imported visible snapshot/);
 assert.equal(g.element('#st-fixture').options.length,2);
 assert.equal(g.storage().stLabMode,'empty','import must not become persisted play mode');
 g.tap('Space');g.click('#st-reset');assert.deepEqual(same(g.snapshot()),same(origin));
 select(g,'marathon-rebuild');assert.deepEqual(g.snapshot().board,F.get('marathon-rebuild').observation.board);
 assert.equal(g.element('#st-import-status').textContent,'');
}));
test('st-modes: injected obsolete selector value cannot load a removed preset',()=>withPage('st-lab.html',{},g=>{
 const option=g.window.document.createElement('option');option.value='o-before-double';
 g.element('#st-fixture').append(option);select(g,'o-before-double');
 assert.deepEqual(g.snapshot().board,F.get('marathon-rebuild').observation.board);
 assert.equal(g.storage().stLabMode,'marathon-rebuild');
}));
