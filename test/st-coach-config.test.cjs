'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Config=require('../st-coach-config'),Sim=require('../scripts/lib/st-simulation.cjs'),{withPage}=require('./support/page.cjs');
test('coach budget: browser and simulation consume the shared production search allowance',()=>withPage('st-lab.html',{},g=>{
 assert.equal(Config.SEARCH_TIME_MS,1500,'current explicitly selected production allowance');assert.equal(Object.isFrozen(Config),true);
 assert.equal(Sim.CONFIG.timeMs,Config.SEARCH_TIME_MS);assert.ok(Sim.sourceHashes()['st-coach-config.js'],'evaluation provenance includes shared config');
 const messages=[];g.window.Worker=class{postMessage(m){messages.push(JSON.parse(JSON.stringify(m)));}terminate(){}};
 g.click('#st-reset');g.advance(40);assert.equal(messages.at(-1).options.timeMs,Config.SEARCH_TIME_MS);
 assert.equal(g.window.STCoachConfig.SEARCH_TIME_MS,Config.SEARCH_TIME_MS);assert.equal(Object.isFrozen(g.window.STCoachConfig),true);
 // An alternate injected config proves the controller consumes the binding;
 // this does not alter the production module or its frozen exported value.
 const probe=Config.SEARCH_TIME_MS+17;g.window.STCoachConfig={SEARCH_TIME_MS:probe};g.click('#st-reset');g.advance(40);assert.equal(messages.at(-1).options.timeMs,probe);
}));
test('coach budget: worker imports shared default while explicit zero/tiny overrides remain exact',()=>{
 const calls=[],messages=[],context={Date:{now:()=>100},self:{postMessage:m=>messages.push(m)},STPlanner:{decide:(o,options)=>{calls.push(options);return{status:'probe'};}}};
 vm.createContext(context);
 // This is a protocol-only test: load the real config, stub expensive planner
 // implementation imports, then execute the real worker entry point.
 context.importScripts=(...files)=>{for(const file of files)if(file==='st-coach-config.js')vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),context);
 for(const timeMs of[undefined,0,20]){context.self.onmessage({data:{type:'plan',id:1,observation:{revision:1},options:timeMs===undefined?{}:{timeMs}}});const actual=calls.at(-1),expected=timeMs??Config.SEARCH_TIME_MS;assert.equal(actual.timeMs,expected);assert.equal(actual.deadline,100+expected);}
 assert.equal(messages.length,3);assert.ok(messages.every(m=>m.type==='result'));
 const probe=Config.SEARCH_TIME_MS+17;context.STCoachConfig={SEARCH_TIME_MS:probe};context.self.onmessage({data:{type:'plan',id:2,observation:{revision:1}}});assert.equal(calls.at(-1).timeMs,probe);
});
