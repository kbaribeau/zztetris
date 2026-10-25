'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const select=(g,id)=>{g.element('#st-fixture').value=id;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));};
const evidence=g=>clone(g.window.stLab.resetEvidence);
test('Reset diagnostics UI: readable unknown history, ordinary input, Undo, import and fresh restart remain local',()=>withPage('st-lab.html',{seed:42},g=>{
 assert.match(g.element('#st-reset-summary').textContent,/Earlier Reset history is unknown/);
 select(g,'empty');assert.equal(evidence(g).status,'no-reset-evidence');assert.match(g.element('#st-reset-summary').textContent,/No allowance is renewed/);
 const initial=evidence(g);for(const action of ['HOLD','HOLD','L','HD'])g.window.stLab.act(action);
 assert.equal(evidence(g).locks,1);g.window.stLab.act('UNDO');assert.deepEqual(evidence(g),initial);
 g.element('#st-snapshot').value=JSON.stringify({...g.window.stLab.snapshot(),resetEvidence:{status:'candidate-evidence',phaseBoundary:'complete',allowanceRenewal:true}});g.click('#st-import');
 assert.equal(evidence(g).status,'unknown');assert.equal(evidence(g).allowanceRenewal,false);assert.equal(evidence(g).pairs.length,0);
 select(g,'empty');g.window.stLab.act('HD');g.tap('KeyR');assert.equal(evidence(g).locks,0);assert.equal(evidence(g).status,'no-reset-evidence');
 g.window.stLab.act('HD');g.click('#st-reset');assert.equal(evidence(g).locks,0);assert.equal(evidence(g).pairs.length,0);
 const exportBefore=g.window.stLab.snapshot();g.click('#st-export');assert.deepEqual(JSON.parse(g.element('#st-snapshot').value),clone(exportBefore));assert.equal('resetEvidence' in exportBefore,false);
}));
test('Reset diagnostics UI: exact state/history cache avoids repeat derivation, invalidates on actions and Undo, and returns defensive copies',()=>withPage('st-lab.html',{seed:42},g=>{
 select(g,'empty');const original=g.window.STResetDiagnostics;let calls=0;
 g.window.STResetDiagnostics={resolve(...args){calls++;return original.resolve(...args);}};
 g.window.stLab.act('L');const afterMove=calls;assert.equal(afterMove,1);
 for(let i=0;i<20;i++){g.window.stLab.render();evidence(g);}assert.equal(calls,afterMove);
 g.window.stLab.act('HD');assert.equal(calls,afterMove+1);g.window.stLab.act('UNDO');assert.equal(calls,afterMove+2);
 const x=g.window.stLab.resetEvidence;x.observed.tDiversions.push({forged:true});x.phaseBoundary='complete';assert.equal(evidence(g).phaseBoundary,'unknown');assert.equal(evidence(g).observed.tDiversions.length,0);
 g.click('#st-export');g.click('#st-import');assert.equal(calls,afterMove+3);assert.equal(evidence(g).status,'unknown');
}));
