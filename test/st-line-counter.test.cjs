'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules'),F=require('../st-fixtures');
function importState(g,s){g.element('#st-snapshot').value=JSON.stringify(s);g.click('#st-import');}
function count(g,n,label='Lines since import'){assert.equal(g.element('#st-lines').textContent,`${label}: ${n}`);assert.equal(g.element('#st-lines').hidden,false);}
function well(rows){const board=R.emptyBoard();for(let i=0;i<rows;i++)board[39-i]='####.#####';return R.createState({board,active:{type:'I',x:2,y:17,rotation:1,lastRotation:null},queue:['I','O']});}
function select(g,value){g.element('#st-fixture').value=value;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
test('line counter: actual single/double/triple/quad clears accumulate and undo with the placement',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 for(let lines=0;lines<=4;lines++){
  importState(g,well(lines));count(g,0);g.window.stLab.act('HD');count(g,lines);g.click('#st-undo');count(g,0);
 }
 importState(g,well(8));g.window.stLab.act('HD');count(g,4);
 // The next I spawns horizontal one column to the right of the vertical well.
 for(const action of ['CW','L','HD'])g.window.stLab.act(action);count(g,8);
 g.window.stLab.act('UNDO');count(g,4);for(const action of ['CW','L','HD'])g.window.stLab.act(action);count(g,8);
 const badge=g.element('#st-lines');assert.equal(badge.getAttribute('role'),'status');assert.equal(badge.getAttribute('aria-live'),'polite');assert.equal(badge.getAttribute('aria-atomic'),'true');
 // A real T-spin event counts its two cleared rows, not the spin or one lock.
 importState(g,F.get('direct-double').observation);
 const p=R.placements(g.snapshot(),{maxNodes:12000}).placements.find(p=>p.event.lines===2&&p.event.spin==='full');assert.ok(p);
 for(const action of p.witness)g.window.stLab.act(action);count(g,2);g.click('#st-undo');count(g,0);
}));
test('line counter: restart, random reset, modes and imports establish explicit zero baselines',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 count(g,0,'Lines since start');
 for(const reset of [()=>g.click('#st-reset'),()=>g.tap('KeyR')]){
  importState(g,well(4));g.window.stLab.act('HD');count(g,4);reset();count(g,0);assert.equal(g.element('#st-undo').disabled,true);
 }
 importState(g,well(4));g.window.stLab.act('HD');count(g,4);
 const before=g.snapshot();importState(g,{board:[]});count(g,4);assert.deepEqual(g.snapshot(),before,'rejected import leaves the session intact');
 g.click('#st-export');const exported=JSON.parse(g.element('#st-snapshot').value);assert.deepEqual(exported,g.snapshot());assert.equal('clearedLines' in exported,false);
 importState(g,{...exported,clearedLines:999});count(g,0,'Lines since import');
 importState(g,well(4));g.window.stLab.act('HD');count(g,4);
 select(g,'empty');count(g,0,'Lines cleared');g.window.stLab.act('HD');g.tap('KeyR');count(g,0,'Lines cleared');
 select(g,'marathon-rebuild');count(g,0,'Lines since start');
}));
test('line counter: movement, hold, failed actions, nonclears and terminal actions do not add lines',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 importState(g,well(4));g.window.stLab.act('HD');count(g,4);
 for(const action of ['L','L','L','L','L','L','CW','CCW','SD','HOLD','HOLD','HD'])g.window.stLab.act(action);count(g,4);
 const board=R.emptyBoard();board[20]='XXXXXXXXX.';importState(g,R.createState({board,active:'O',queue:['I']}));
 g.window.stLab.act('HD');assert.equal(g.snapshot().topOut,true);count(g,0);
 for(const action of ['HD','HOLD','L','CW'])g.window.stLab.act(action);count(g,0);g.click('#st-undo');count(g,0);assert.equal(g.snapshot().topOut,false);
 // A clear that really happens before the next spawn blocks still counts once.
 const ending=well(4);ending.board[14]='....#.....';ending.active.y=30;ending.queue=['O'];
 importState(g,ending);g.window.stLab.act('HD');assert.equal(g.snapshot().topOut,true);count(g,4);g.window.stLab.act('HD');count(g,4);g.click('#st-undo');count(g,0);
 importState(g,R.createState({active:'O',queue:[]}));g.window.stLab.act('HD');assert.equal(g.snapshot().active,null);g.window.stLab.act('HD');count(g,0);
}));
