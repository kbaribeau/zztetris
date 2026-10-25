'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules'),F=require('../st-fixtures');
const clone=x=>JSON.parse(JSON.stringify(x));
function select(g,value){g.element('#st-fixture').value=value;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
function importState(g,value){g.element('#st-snapshot').value=JSON.stringify(value);g.click('#st-import');}
function phase(g,value,label){
 assert.equal(g.element('#st-phase-indicator').hidden,false);
 assert.equal(g.element('#st-phase').dataset.phase,value);
 assert.equal(g.element('#st-phase-name').textContent,label);
 assert.equal(g.window.document.querySelector('#st-phase-label'),null,'phase is the first equal badge, without a redundant caption');
 assert.match(g.element('#st-phase-indicator').getAttribute('aria-label'),/Coaching phase and observed resources/);
 assert.equal(g.element('#st-phase-symbol').getAttribute('aria-hidden'),'true');
}
function workers(g){
 const all=[];
 g.window.Worker=class{
  constructor(){all.push(this);}
  postMessage(message){this.message=clone(message);}
  terminate(){}
  respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}
 };
 return all;
}
for(const saved of [undefined,'empty','marathon-rebuild'])
test(`coaching phase: startup and mode/import changes use session state (${saved??'default'})`,()=>withPage('st-lab.html',{storage:saved?{stLabMode:saved}:{}},g=>{
 phase(g,saved==='empty'?'opening':'maintenance',saved==='empty'?'Opening':'Mid-game');
 select(g,'empty');phase(g,'opening','Opening');
 g.window.stLab.act('HOLD');g.window.stLab.act('L');g.window.stLab.act('HD');phase(g,'opening','Opening');
 g.click('#st-reset');phase(g,'opening','Opening');
 // Imports derive the session from public geometry, not asserted phase flags.
 importState(g,{...F.get('marathon-rebuild').observation,openingPhase:true,phase:'reset'});phase(g,'maintenance','Mid-game');
 assert.equal(g.element('#st-fixture').value,'','an import is not a selected play mode');
 importState(g,{...R.createState({active:'I',queue:[...'OZJSLT']}),openingPhase:false,phase:'reset'});phase(g,'opening','Opening');
 select(g,'marathon-rebuild');phase(g,'maintenance','Mid-game');
 const before=g.snapshot();importState(g,{board:[]});phase(g,'maintenance','Mid-game');assert.deepEqual(g.snapshot(),before);
}));
for(const mode of ['empty','marathon-rebuild'])
test(`coaching phase: advice hiding leaves ${mode} context visible and state unchanged`,()=>withPage('st-lab.html',{storage:{stLabMode:mode,stGuideVisible:'false'}},g=>{
 const value=mode==='empty'?'opening':'maintenance',label=mode==='empty'?'Opening':'Mid-game',before=g.snapshot();
 phase(g,value,label);assert.equal(g.element('#st-status').hidden,true);
 g.click('#st-toggle');phase(g,value,label);assert.equal(g.element('#st-status').hidden,false);
 g.tap('KeyA');phase(g,value,label);assert.equal(g.element('#st-status').hidden,true);
 g.window.localStorage.setItem('stGuideVisible','true');
 g.window.dispatchEvent(new g.window.StorageEvent('storage',{key:'stGuideVisible',storageArea:g.window.localStorage}));
 phase(g,value,label);assert.equal(g.element('#st-status').hidden,false);assert.deepEqual(g.snapshot(),before);
}));
test('coaching phase: pending, unsupported, stale and error responses do not become Reset or finish opening',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);g.click('#st-reset');g.advance(40);const stale=all.at(-1);
 select(g,'empty');phase(g,'opening','Opening');assert.equal(g.element('#st-status').dataset.result,'thinking');g.advance(40);
 stale.respond({phase:'maintenance',evidence:{openingHandoff:{}},status:'recommended-with-verified-prefix'});phase(g,'opening','Opening');
 all.at(-1).respond({phase:'maintenance',status:'no-supported-continuation-found',target:null,reason:'No checked continuation.'});phase(g,'opening','Opening');
 g.window.stLab.act('R');g.advance(40);all.at(-1).onerror({preventDefault(){}});phase(g,'opening','Opening');
 g.window.stLab.act('L');g.advance(3000);assert.equal(g.element('#st-status').dataset.result,'budget-exhausted');phase(g,'opening','Opening');
}));
test('coaching phase: finite-queue exhaustion, top-out and restart are not a Reset coaching phase',()=>withPage('st-lab.html',{},g=>{
 const s=clone(F.get('marathon-rebuild').observation);delete s.bag;s.hold=null;s.queue=[];
 importState(g,s);g.window.stLab.act('HD');assert.equal(g.element('#st-status').dataset.result,'insufficient-known-pieces');phase(g,'maintenance','Mid-game');
 g.click('#st-reset');phase(g,'maintenance','Mid-game');
 const board=R.emptyBoard();board[20]='XXXXXXXXX.';
 importState(g,R.createState({board,active:'O',queue:[]}));g.window.stLab.act('HD');assert.equal(g.snapshot().topOut,true);phase(g,'maintenance','Mid-game');
 g.window.stLab.act('UNDO');assert.equal(g.snapshot().topOut,false);phase(g,'maintenance','Mid-game');
 g.click('#st-reset');phase(g,'maintenance','Mid-game');
}));
