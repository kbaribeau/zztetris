'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{withPage}=require('./support/page.cjs'),f=require('./fixtures/current-left-goal.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(message){this.message=clone(message);}terminate(){}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};return all;}
function load(g,data){g.element('#st-snapshot').value=JSON.stringify(data);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/i);}
test('Left plan page / selected work survives lost advice and trusted session import, actual J pays and Undo restores',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);load(g,f.observation);g.advance(40);const events=[];g.window.stLab.onTrackingEvent(e=>events.push(e));
 all.at(-1).respond({...clone(f.advice),status:'recommended-with-verified-prefix',reason:'Authentic checked current Left repair.'});
 const goals=clone(g.window.stLab.resources.leftGoals);assert.equal(goals.length,1);
 for(const action of f.advice.continuation[0].witness)g.window.stLab.act(action);g.advance(40);all.at(-1).respond({status:'no-supported-continuation',reason:'Controlled advice loss.'});
 assert.deepEqual(clone(g.window.stLab.resources.leftGoals),goals,'replacing advice does not erase current work');
 const saved=g.window.stLab.exportSession();load(g,saved);assert.deepEqual(clone(g.window.stLab.resources.leftGoals),goals);
 for(const action of f.advice.continuation[1].witness)g.window.stLab.act(action);assert.deepEqual(clone(g.window.stLab.resources.leftGoals),goals);
 for(const action of f.advice.continuation[2].witness)g.window.stLab.act(action);assert.deepEqual(clone(g.window.stLab.resources.leftGoals),[]);
 g.window.stLab.act('UNDO');assert.deepEqual(clone(g.window.stLab.resources.leftGoals),goals);assert.deepEqual(events,[]);
}));
test('Left plan page / imported cached proof labels alone do not register new work',()=>withPage('st-lab.html',{},g=>{
 const Session=require('../st-session'),current=require('../st-obligation-context'),R=require('../st-rules'),position=R.createState(f.observation);
 const saved=Session.create(position,{obligationContext:current.exportState(current.start(position)),previous:clone(f.advice)});load(g,saved);
 assert.deepEqual(clone(g.window.stLab.resources.leftGoals),[]);
}));
