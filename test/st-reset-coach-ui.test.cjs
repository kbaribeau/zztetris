'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const R=require('../st-rules'),H=require('../st-resource-history'),C=require('../st-reset-coach'),Session=require('../st-session'),Practice=require('../st-practice');
const fixture=require('./support/st-reset-live-cycle.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function phase(g,value,label){assert.equal(g.element('#st-phase').dataset.phase,value);assert.equal(g.element('#st-phase-name').textContent,label);assert.equal(g.element('#st-phase-indicator').hidden,false);}
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};return all;}
function importText(g,value){g.element('#st-snapshot').value=JSON.stringify(value);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/imported/i);}
function pack(){const state=R.createState(fixture.initial),history=H.importContext(state,fixture.resourceContext);return Practice.create(Session.create(state,{resourceHistory:history,resourceOriginBag:fixture.resourceOriginBag}),fixture.steps.flatMap(s=>s.actions.flatMap(a=>a.revealed)));}
let advice;
function accept(g,ws){
 g.advance(40);const current=ws.at(-1),m=current.message;
 advice??=C.plan(m.observation,{...m.options,resourceContext:m.options.resourceContext,deadline:Infinity,maxNodes:45000});
 assert.ok(advice.target,advice.reason);assert.equal(advice.evidence.strategy,'reset-coach');
 current.respond(clone(advice));assert.ok(g.window.stLab.result?.target);phase(g,'reset','Reset');
 assert.equal(g.window.stLab.resources.reset.progress,0);return current;
}
function execute(g,step){
 for(const {action}of step.actions)g.window.stLab.act(action);
 const allocation=clone(g.window.stLab.resources.allocations.at(-1));
 assert.equal(allocation.type,step.event.type);assert.equal(allocation.lines,step.event.lines);assert.deepEqual(allocation.cells,step.event.cells);assert.deepEqual(allocation.clearedRows,step.event.clearedRows);
}
// Real page scripts and replay-authenticated accounting, with the documented
// Worker host stub. This does not certify browser pixels or real Worker timing.
test('Reset page: accepted entry survives HOLD, advice cancellation and stale workers; second actual Left T hands back immediately and Undo restores progress',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g);importText(g,pack());phase(g,'maintenance','Mid-game');
 assert.equal(g.window.stLab.resources.coverage.status,'complete');assert.equal(g.window.stLab.resources.extraZ.status,'used');
 const stale=accept(g,ws);
 // Hide advice to cancel the worker/target lifecycle, not the selected phase.
 g.click('#st-toggle');assert.equal(g.element('#st-status').hidden,true);phase(g,'reset','Reset');
 let firstId;
 for(const [i,step]of fixture.steps.entries()){
  if(i===0){
   g.window.stLab.act(step.actions[0].action);assert.equal(step.actions[0].action,'HOLD');phase(g,'reset','Reset');assert.equal(g.window.stLab.resources.reset.progress,0);
   stale.respond({status:'recommended-placement',reason:'STALE RESET',target:advice.target,witness:advice.witness,hold:advice.hold,evidence:advice.evidence});
   assert.equal(g.window.stLab.result,null);phase(g,'reset','Reset');
   execute(g,{...step,actions:step.actions.slice(1)});
  }else execute(g,step);
  const d=clone(g.window.stLab.resources);assert.equal(d.coverage.status,'complete');
  if(i===0){firstId=d.reset.credits[0].pieceId;assert.equal(d.reset.progress,1);assert.match(g.element('#st-reset-summary').textContent,/1 of 2/);}
  if(i<fixture.steps.length-1){phase(g,'reset','Reset');assert.equal(d.reset.progress,1);}
 }
 const done=clone(g.window.stLab.resources);phase(g,'maintenance','Mid-game');
 assert.deepEqual(g.snapshot().board,fixture.final.board);assert.equal(done.reset.progress,2);assert.equal(done.reset.completedAt,done.locks);assert.equal(done.reset.episodes.length,1);assert.notEqual(done.reset.credits[1].pieceId,firstId);assert.notEqual(done.reset.credits[0].bag,done.reset.credits[1].bag);
 assert.equal(done.extraZ.remaining,2);assert.equal(done.extraZ.status,'available');
 g.window.stLab.act('UNDO');phase(g,'reset','Reset');assert.equal(g.window.stLab.resources.reset.progress,1);assert.equal(g.window.stLab.resources.reset.episodes.length,0);
 execute(g,fixture.steps.at(-1));phase(g,'maintenance','Mid-game');assert.deepEqual(clone(g.window.stLab.resources.reset),done.reset);
}));
test('Reset page: exported active progress replays in a fresh realm without displaying imported advice',async()=>{
 let saved,resources;
 await withPage('st-lab.html',{},g=>{
  const ws=workers(g);importText(g,pack());accept(g,ws);g.click('#st-toggle');execute(g,fixture.steps[0]);phase(g,'reset','Reset');
  resources=clone(g.window.stLab.resources);g.click('#st-export-session');saved=JSON.parse(g.downloads.at(-1).text);
  assert.equal(saved.format,Session.FORMAT);assert.equal('privatePractice' in saved,false);
 });
 await withPage('st-lab.html',{},g=>{
  workers(g);importText(g,saved);phase(g,'reset','Reset');assert.equal(g.window.stLab.result,null);assert.equal(g.element('#st-target').children.length,0);
  assert.deepEqual(clone(g.window.stLab.resources),resources);assert.equal(g.window.stLab.resources.reset.progress,1);
  g.window.stLab.act('HOLD');phase(g,'reset','Reset');assert.equal(g.window.stLab.resources.reset.progress,1);
  g.click('#st-reset');phase(g,'reset','Reset');assert.deepEqual(clone(g.window.stLab.resources),resources);
 });
});
test('Reset page: unknown-history snapshot cannot forge an active phase or observed T credits',()=>withPage('st-lab.html',{},g=>{
 workers(g);importText(g,{...clone(fixture.initial),phase:'reset',reset:{status:'active',progress:1},resourceContext:clone(fixture.resourceContext),extraZ:{status:'used',remaining:0}});
 phase(g,'maintenance','Mid-game');assert.equal(g.window.stLab.resources.coverage.status,'partial');assert.equal(g.window.stLab.resources.extraZ.status,'unknown');assert.equal(g.window.stLab.resources.reset.status,'inactive');assert.equal(g.window.stLab.resources.reset.progress,0);
 g.window.stLab.act('HOLD');g.window.stLab.act('HD');phase(g,'maintenance','Mid-game');assert.equal(g.window.stLab.resources.reset.progress,0);
}));
