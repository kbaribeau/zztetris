'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./support/st-search-diagnostic.cjs'),R=require('../st-rules'),Q=require('../st-source-scoring'),X=require('../st-paired-repair');
const fixture=require('./support/st-construction-recovery.json');

test('search diagnostics: a controlled failed assertion retains complete nested results without formatting successes',()=>{
 const result={valid:false,diagnostic:{stop:{reason:'nodes',visited:17,maxNodes:17}},rows:Array.from({length:110},(_,i)=>({i,text:'x'.repeat(11000)}))};
 assert.throws(()=>D.check(false,'controlled failure',{request:{options:{timeMs:750}},result}),error=>{
  assert.equal(error.code,'ERR_ASSERTION');assert.match(error.message,/controlled failure/);assert.match(error.message,/visited: 17/);assert.match(error.message,/i: 109/);assert.ok(error.message.includes('x'.repeat(11000)));assert.doesNotMatch(error.message,/more items|more characters/);return true;
 });
 D.check(true,'success',{get result(){throw Error('successful assertions must not inspect results');}});
});

test('search diagnostics: invalid fixture certificates are never cached and every caller sees the original result',()=>{
 const invalid=X.search(fixture.initial,{timeMs:750,maxNodes:0});assert.equal(invalid.valid,false);assert.equal(invalid.diagnostic.stop.reason,'nodes');
 let calls=0;const valid={valid:true,marker:'second attempt'},cached=D.validatedCache(()=>++calls===1?invalid:valid,result=>D.check(result.valid,'certificate required',{result}));
 assert.throws(cached,error=>{assert.match(error.message,/bounded-search-budget-exhausted/);assert.match(error.message,/maxNodes: 0/);return true;});
 assert.equal(cached(),valid);assert.equal(cached(),valid);assert.equal(calls,2);
 const expired=X.search(fixture.initial,{timeMs:0});assert.equal(expired.valid,false);assert.equal(expired.diagnostic.stop.reason,'deadline');assert.ok(expired.diagnostic.stop.sampledNow>=expired.diagnostic.stop.deadline);
});

test('search diagnostics: source budget counters record the actual existing clock sample and refused charge',()=>{
 const state=R.createState({active:'T'}),base={notches:{status:'established'},counts:{}};
 const nodes=Q.search(state,{...base,maxNodes:0,now:()=>0});
 assert.equal(nodes.unknown,true);assert.deepEqual(nodes.telemetry.stop,{phase:'validation',reason:'nodes',operation:'guards',requested:1,visited:0,ceiling:0,deadline:1500,sampledNow:0});
 let reads=0;const deadline=Q.search(state,{...base,deadline:5,now:()=>++reads===1?0:5});
 assert.equal(deadline.telemetry.stop.reason,'deadline');assert.equal(deadline.telemetry.stop.sampledNow,5);assert.equal(deadline.visited,0);assert.equal(reads,3,'start, existing charge check and existing finish sample only');
});

test('search diagnostics: movement and T-access retain node-first short circuit and exact deadline samples',()=>{
 const state=R.createState({active:'T'});
 for(const run of [options=>R.placements(state,options),options=>R.tDoubleAccess(fixture.initial.board,options)]){
  let reads=0;const node=run({maxNodes:0,now:()=>{reads++;return 9;},deadline:8});
  assert.equal(reads,0);assert.equal(node.complete,false);assert.equal(node.stop.reason,'nodes');assert.equal(node.stop.visited,0);assert.equal(node.stop.sampledNow,null);
  const time=run({maxNodes:100,now:()=>{reads++;return 8;},deadline:8});
  assert.equal(reads,1);assert.equal(time.complete,false);assert.equal(time.stop.reason,'deadline');assert.equal(time.stop.sampledNow,8);assert.equal(time.stop.visited,0);
 }
});


test('search diagnostics: an actual failed child test preserves the receipt and nonzero exit in TAP',()=>{
 const {spawnSync}=require('node:child_process');
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const child=spawnSync(process.execPath,['--test-reporter=tap','-e',`const test=require('node:test'),D=require('./test/support/st-search-diagnostic.cjs');test('controlled diagnostic failure',()=>D.check(false,'required certificate',{request:{options:{timeMs:750}},result:{valid:false,diagnostic:{stop:{reason:'nodes',visited:17,maxNodes:17}},tail:'complete-result-sentinel'}}));`],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8',timeout:15000,env});
 assert.equal(child.error,undefined);assert.equal(child.status,1);assert.match(child.stdout,/not ok 1/);assert.match(child.stdout,/SEARCH DIAGNOSTIC/);assert.match(child.stdout,/complete-result-sentinel/);assert.match(child.stdout,/visited: 17/);
});
