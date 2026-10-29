'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules'),F=require('../st-fixtures'),Practice=require('../st-practice');
function imported(g,state){g.element('#st-snapshot').value=JSON.stringify(state);g.click('#st-import');}
function totals(g,pieces,lines=0,scope='since import'){
 const p=g.element('#st-pieces'),l=g.element('#st-lines');
 assert.ok(p,'persistent piece counter is present');
 assert.equal(g.element('#st-pieces-label').textContent,'Pieces locked');
 assert.equal(g.element('#st-pieces-value').textContent,pieces.toLocaleString('en-US'));
 assert.equal(g.element('#st-lines-value').textContent,lines.toLocaleString('en-US'));
 assert.equal(g.element('#st-lines-scope').textContent,scope);
 assert.equal(g.element('#st-lines-scope').hidden,false);
 assert.equal(p.getAttribute('aria-label'),`${pieces.toLocaleString('en-US')} ${pieces===1?'piece':'pieces'} locked ${scope}`);
 assert.equal(l.getAttribute('aria-label'),`${lines.toLocaleString('en-US')} ${lines===1?'line':'lines'} cleared ${scope}`);
 for(const node of [p,l]){assert.equal(node.getAttribute('role'),'status');assert.equal(node.getAttribute('aria-live'),'polite');assert.equal(node.getAttribute('aria-atomic'),'true');assert.equal(node.hidden,false);}
}
function mode(g,value){g.element('#st-fixture').value=value;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
function well(rows){const board=R.emptyBoard();for(let n=0;n<rows;n++)board[39-n]='####.#####';return R.createState({board,active:{type:'I',x:2,y:17,rotation:1,lastRotation:null},queue:['I','O']});}
test('piece counter: locks are distinct from prefilled heap, draw cursor, active, held and cleared lines',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 totals(g,0,0,'since start');assert.ok(g.snapshot().board.some(r=>r!=='..........'));assert.equal(g.snapshot().streamCursor,23);
 imported(g,R.createState({active:'O',queue:['I','T','L','J','S','Z']}));totals(g,0);
 g.window.stLab.act('HOLD');assert.equal(g.snapshot().streamCursor,1);totals(g,0);
 for(const action of ['HOLD','HOLD','L','R','CW','CCW','SD','not-an-action'])g.window.stLab.act(action);totals(g,0);
 g.window.stLab.act('HD');totals(g,1);g.window.stLab.act('UNDO');totals(g,0);
 assert.equal(g.snapshot().hold,null,'Undo goes back before the empty hold');
 g.window.stLab.act('HD');totals(g,1);g.window.stLab.act('UNDO');g.window.stLab.act('L');g.window.stLab.act('HD');totals(g,1);
 for(let rows=1;rows<=4;rows++){imported(g,well(rows));g.window.stLab.act('HD');totals(g,1,rows);g.window.stLab.act('UNDO');totals(g,0);}
 imported(g,F.get('direct-double').observation);
 const tsd=R.placements(g.snapshot(),{maxNodes:12000}).placements.find(p=>p.event.spin==='full'&&p.event.lines===2);assert.ok(tsd);
 for(const a of tsd.witness)g.window.stLab.act(a);totals(g,1,2);
}));
test('piece counter: position/session imports, exports, rejection, restart and mode baselines stay honest',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 imported(g,well(4));g.window.stLab.act('HD');totals(g,1,4);
 g.click('#st-export');const position=JSON.parse(g.element('#st-snapshot').value);assert.equal('lockCount' in position,false);
 g.click('#st-export-session');const session=JSON.parse(g.element('#st-snapshot').value);assert.equal('lockCount' in session,false);assert.equal('lockCount' in session.position,false);
 const before=g.snapshot();imported(g,{board:[]});assert.deepEqual(g.snapshot(),before);totals(g,1,4);
 imported(g,{...position,lockCount:999,clearedLines:999});totals(g,0);g.window.stLab.act('HD');totals(g,1);
 imported(g,session);totals(g,0);g.window.stLab.act('HD');totals(g,1);g.click('#st-reset');totals(g,0);g.window.stLab.act('HD');g.tap('KeyR');totals(g,0);
 for(const selected of ['empty','marathon-rebuild']){mode(g,selected);totals(g,0,0,'since start');g.window.stLab.act('HD');totals(g,1,0,'since start');g.click('#st-reset');totals(g,0,0,'since start');g.window.stLab.act('HD');g.tap('KeyR');totals(g,0,0,'since start');}
}));
test('piece counter: private practice starts zero since import and restart replays without restoring diagnostic totals',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 imported(g,R.createState({active:'O',queue:Array(6).fill('O')}));
 const packed=Practice.create(g.window.stLab.exportSession(),Array(10).fill('O'));
 imported(g,packed);totals(g,0);g.window.stLab.act('HD');totals(g,1);
 const invalid=JSON.parse(JSON.stringify(packed));invalid.privatePractice.tail=['Q'];imported(g,invalid);totals(g,1);
 g.click('#st-reset');totals(g,0);g.window.stLab.act('HD');totals(g,1);
 g.click('#st-export-session');const saved=JSON.parse(g.element('#st-snapshot').value);assert.equal('lockCount' in saved,false);assert.equal('lockCount' in saved.position,false);
 imported(g,saved);totals(g,0);g.window.stLab.act('HD');totals(g,1);g.window.stLab.act('UNDO');totals(g,0);
}));
test('piece counter: a terminal lock counts once; exhausted queue and blocked actions never repeat it',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 const ending=well(4);ending.board[14]='....#.....';ending.active.y=30;ending.queue=['O'];imported(g,ending);
 g.window.stLab.act('HD');assert.equal(g.snapshot().topOut,true);totals(g,1,4);
 for(const a of ['HD','HD','HOLD','L','CW'])g.window.stLab.act(a);totals(g,1,4);
 g.window.stLab.act('UNDO');totals(g,0);assert.equal(g.snapshot().topOut,false);
 imported(g,R.createState({active:'O',queue:[]}));g.window.stLab.act('HD');assert.equal(g.snapshot().active,null);totals(g,1);
 g.window.stLab.act('HD');totals(g,1);g.window.stLab.act('UNDO');totals(g,0);
}));
test('piece counter: shared board footer preserves both totals, visible scope and all four resource badges with advice hidden',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 const footer=g.element('#st-counters'),board=g.element('#b').parentElement;
 assert.equal(footer.previousElementSibling,board);assert.equal(footer.parentElement,board.parentElement);
 for(const id of ['#st-pieces','#st-lines','#st-lines-scope'])assert.equal(g.element(id).parentElement,footer);
 assert.equal(footer.getAttribute('role'),'group');assert.equal(footer.getAttribute('aria-describedby'),'st-lines-scope');
 assert.equal(board.contains(footer),false);assert.equal(g.element('#st-target').parentElement,board);
 const badges=()=>[...g.element('#st-phase-indicator').children].map(e=>({id:e.id,name:e.getAttribute('aria-label'),text:e.textContent}));
 const before=badges();assert.equal(before.length,4);totals(g,0,0,'since start');
 g.click('#st-toggle');g.click('#st-toggle');assert.deepEqual(badges(),before);totals(g,0,0,'since start');
}));
test('piece counter: ten thousand actual locks format fully and Undo retains the cumulative total beyond history pruning',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 // Diagnostic O-only supply is synthetic, not claimed seven-bag provenance.
 const fixture={id:'piece-count-squares',label:'Squares',observation:R.createState({active:'O',queue:Array(6).fill('O')}),future:Array(10005).fill('O')};
 const original=g.window.STFixtures;g.window.STFixtures={...original,get:id=>id===fixture.id?fixture:original.get(id)};g.window.stLab.loadFixture(fixture.id);
 for(let i=0;i<10005;i++){const dx=(i%5)*2-4;for(let n=0;n<Math.abs(dx);n++)g.window.stLab.act(dx<0?'L':'R');g.window.stLab.act('HD');}
 assert.equal(g.snapshot().topOut,false);totals(g,10005,4002,'since start');assert.equal(g.element('#st-counters').classList.contains('lab-counters-large'),true);
 g.window.stLab.act('UNDO');totals(g,10004,4000,'since start');for(let n=0;n<4;n++)g.window.stLab.act('R');g.window.stLab.act('HD');totals(g,10005,4002,'since start');
 for(let i=0;i<100;i++)g.window.stLab.act('UNDO');totals(g,9905,3962,'since start');assert.equal(g.element('#st-undo').disabled,true);
 assert.equal(g.element('#st-counters').classList.contains('lab-counters-large'),false);g.click('#st-reset');totals(g,0,0,'since start');
}));
