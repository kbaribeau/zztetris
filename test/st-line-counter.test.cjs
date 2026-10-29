'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules'),F=require('../st-fixtures');
function importState(g,s){g.element('#st-snapshot').value=JSON.stringify(s);g.click('#st-import');}
function count(g,n,label='Lines since import'){
 const scope=label.replace('Lines ','');
 const counter=g.element('#st-lines'),formatted=n.toLocaleString('en-US');
 assert.equal(g.element('#st-lines-label').textContent,'Lines cleared');
 assert.equal(g.element('#st-lines-value').textContent,formatted);
 assert.equal(g.element('#st-lines-scope').textContent,scope);
 assert.equal(g.element('#st-lines-scope').hidden,false);
 assert.equal(counter.getAttribute('aria-label'),`${formatted} ${n===1?'line':'lines'} cleared${scope?' '+scope:''}`);
 assert.equal(counter.hidden,false);
}
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
 select(g,'empty');count(g,0,'Lines since start');
 for(const reset of [()=>g.click('#st-reset'),()=>g.tap('KeyR')]){
  g.window.stLab.act('HD');count(g,0,'Lines since start');assert.equal(g.element('#st-undo').disabled,false);
  reset();count(g,0,'Lines since start');assert.equal(g.element('#st-undo').disabled,true);
 }
 select(g,'marathon-rebuild');count(g,0,'Lines since start');
}));
test('line counter: footer stays attached to the board, outside the collision/target layer and resource badges',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 const counter=g.element('#st-lines'),board=g.element('#b').parentElement,footer=g.element('#st-counters');
 assert.equal(footer.previousElementSibling,board);
 assert.equal(footer.parentElement,board.parentElement);
 assert.equal(counter.parentElement,footer);
 assert.equal(board.contains(counter),false);
 assert.equal(g.element('#st-phase-indicator').contains(counter),false);
 assert.equal(counter.closest('.lab-field'),board.closest('.lab-field'));
 assert.equal(g.element('#st-target').parentElement,board);
 count(g,0,'Lines since start');
 g.click('#st-toggle');g.click('#st-toggle');count(g,0,'Lines since start');
}));
test('line counter: thousands of actual cleared rows format fully and survive Undo pruning',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 // Synthetic O-only fixture supply is not a seven-bag or imported history.
 // Five legal square locks clear two rows; no counter/state fields are injected.
 const fixture={id:'line-count-squares',label:'Squares',observation:R.createState({active:'O',queue:Array(6).fill('O')}),future:Array(3085).fill('O')};
 const original=g.window.STFixtures;
 g.window.STFixtures={...original,get:id=>id===fixture.id?JSON.parse(JSON.stringify(fixture)):original.get(id)};
 g.window.stLab.loadFixture(fixture.id);
 for(let i=0;i<3085;i++){
  const offset=(i%5)*2-4;
  for(let n=0;n<Math.abs(offset);n++)g.window.stLab.act(offset<0?'L':'R');
  g.window.stLab.act('HD');
 }
 assert.equal(g.snapshot().topOut,false);count(g,1234,'Lines since start');
 g.window.stLab.act('UNDO');count(g,1232,'Lines since start');
 for(let n=0;n<4;n++)g.window.stLab.act('R');g.window.stLab.act('HD');count(g,1234,'Lines since start');
 g.click('#st-reset');count(g,0,'Lines since start');
}));
test('line counter: coaching-session imports and restart preserve an honest zero-since-import baseline',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 importState(g,well(4));g.click('#st-export-session');const envelope=JSON.parse(g.element('#st-snapshot').value);
 g.window.stLab.act('HD');count(g,4);
 importState(g,envelope);count(g,0);g.window.stLab.act('HD');count(g,4);
 g.click('#st-reset');count(g,0);g.window.stLab.act('HD');count(g,4);
 g.click('#st-export-session');const exported=JSON.parse(g.element('#st-snapshot').value);
 assert.equal('clearedLines' in exported,false);assert.equal('clearedLines' in exported.position,false);
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
