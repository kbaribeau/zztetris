const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../st-bag');
test('st-bag/known bag forces only its last remaining kind',()=>{
 const k=B.fromObserved({observed:[...'IJLOST'],startPhase:0});assert.equal(B.forcedNext(k),'Z');assert.deepEqual(B.possibilities(k),['Z']);
 const end=B.consume(k,'Z');assert.equal(B.forcedNext(end),null);assert.equal(B.possibilities(end).length,7);
});
test('st-bag/boundaries: identical adjacent pieces are valid across bag boundary',()=>{
 assert.deepEqual(B.validate(B.fromObserved({observed:[...'IJLOSTZZ'],startPhase:0})),[]);
 assert.equal(B.fromObserved({observed:['I','I'],startPhase:0}).error,'contradictory-observed-stream');
 assert.deepEqual(B.validate(B.fromObserved({observed:['I','I'],startPhase:null})),[]);
});
test('st-bag/unknown phase conservatively retains compatible states',()=>{
 const k=B.fromObserved({observed:['I','J','L','O','S','T'],startPhase:null});assert.equal(B.forcedNext(k),null);assert.ok(B.possibilities(k).length>1);
 assert.equal(B.fromObserved({observed:['I','I','I'],startPhase:null}).error,'contradictory-observed-stream');
});
test('st-bag/preview crossing boundary is consumed once by draw position',()=>{
 const all=[...'IJLOSTZZT'];const whole=B.fromObserved({observed:all,startPhase:0});let incremental=B.fromObserved({observed:all.slice(0,5),startPhase:0});for(const t of all.slice(5))incremental=B.consume(incremental,t);assert.deepEqual(incremental,whole);assert.equal(whole.observedCount,9);assert.equal(whole.remaining.length,1);assert.ok(!B.possibilities(whole).includes('Z'));assert.ok(!B.possibilities(whole).includes('T'));
 const unchanged=JSON.stringify(whole);B.consume(whole,'I');assert.equal(JSON.stringify(whole),unchanged);
});
test('st-bag/invalid evidence never invents forced piece',()=>{
 for(const input of [{observed:['?']},{startPhase:7},{startPhase:-1},{observed:'I'}]){const k=B.fromObserved(input);assert.ok(k.error);assert.equal(B.forcedNext(k),null);}
});
