const test=require('node:test'),assert=require('node:assert/strict');
const L=require('../st-left-context.js');
const state=(active='J',hold=null,queue=[],canHold=true)=>({active:{type:active},hold,queue,canHold});
const evaluate=(s,extra={})=>L.evaluate(s,{heights:[3,4,4,3],covered:0,...extra});
test('Left source catalog: all twelve oriented silhouettes, translation, no mirroring or invented tier',()=>{
 const expected=[['SS',[0,0,0,2]],['SS',[2,0,0,0]],['S',[0,0,1,1]],['S',[2,2,2,0]],['A',[1,1,0,0]],['A',[0,2,2,2]],['A',[0,0,2,0]],['B',[1,0,0,1]],['B',[0,2,0,0]],['B',[2,2,0,2]],['C',[2,0,2,2]],['D',[0,1,1,0]]];
 assert.deepEqual(L.catalog.map(c=>[c.tier,[...c.profile]]),expected);
 for(const[tier,h]of expected)assert.equal(L.classify(h.map(v=>v+7)).tier,tier);
 assert.equal(L.classify([0,0,1,1]).tier,'S');assert.equal(L.classify([1,1,0,0]).tier,'A');
 assert.equal(L.classify([0,0,0,0]),null);assert.equal(L.classify([0,3,2,0]),null);
});
test('Left context: immediate J and usable HOLD, not an arbitrary deeper preview',()=>{
 const immediate=evaluate(state('J')),late=evaluate(state('T',null,['S','J'],false)),held=evaluate(state('T','J',[])),blocked=evaluate(state('T','J',[],false));
 assert.equal(immediate.immediateJ,true);assert.equal(held.immediateJ,true);assert.equal(late.immediateJ,false);assert.equal(blocked.immediateJ,false);
 assert.ok(immediate.score>late.score);assert.equal(blocked.repair,null);assert.equal(held.repair.hold,true);
 assert.equal(evaluate(state('T',null,['J'])).immediateJ,true); // empty HOLD consumes the first visible draw
 assert.equal(evaluate(state('T',null,['O','J'])).immediateJ,false);
 assert.equal(immediate.executionVerified,false);
});
test('Left context: holes and unrecognized shapes have neutral adjustment, not a new escape bonus',()=>{
 for(const options of [{covered:1},{heights:[3,6,5,3]}])assert.equal(evaluate(state(),options).adjustment,0);
 const known=evaluate(state('T',null,[],false));const unknownHeights=[3,6,5,3],rough=6;assert.ok(-rough*2.8+evaluate(state('T'),{heights:unknownHeights}).adjustment<known.score); // retain the unlisted surface's original penalty
 const board=Array(40).fill('..........');board[39]='XXXX......';board[37]='.XX.......';
 assert.equal(L.evaluate({...state(),board}).context,'covered-cells-neutral');
});
test('Left context: Center partners and Right quad demand are not free Left supply',()=>{
 assert.equal(evaluate(state('J'),{centerDebt:[{alternatives:[{piece:'J'}]}]}).available.length,0);
 assert.equal(evaluate(state('J'),{resources:{pendingCenter:[{alternatives:[{piece:'J'}]}]}}).available.length,0);
 assert.equal(evaluate(state('O'),{center:{status:'supported-partner-completion',completions:[{piece:'O',patternSupport:'reference-supported'}]}}).available.length,0);
 for(const cycle of [{prepareColumn:9},{cleanupColumns:[9]}])assert.equal(evaluate(state('I'),{right:{cycle}}).available.length,0);
 assert.equal(evaluate(state('I'),{right:{cycle:{prepareColumn:null,cleanupColumns:[]}}}).available.length,1);
});
test('Left context: T stays scoring-only and S/L need matching observed surplus identity',()=>{
 assert.equal(evaluate(state('T')).available.length,0);
 for(const[type,key]of [['S','hangingS'],['L','hangingL']]){
  assert.equal(evaluate(state(type)).available.length,0);
  const resources={active:{type,id:'p'},[key]:[{id:'p'}]};
  assert.equal(evaluate(state(type),{resources}).available.length,1);
  assert.equal(evaluate(state(type),{resources:{...resources,active:{type:'O',id:'p'}}}).available.length,0);
  assert.equal(evaluate(state(type),{resources:{...resources,[key]:[{id:'other'}]}}).available.length,0);
 }
});
test('Left context: extra Z is not assumed and Right cap reservation wins',()=>{
 assert.equal(evaluate(state('Z')).available.length,0);
 assert.equal(evaluate(state('Z'),{resources:{extraZ:'used'}}).available.length,0);
 assert.equal(evaluate(state('Z'),{resources:{extraZ:'available'}}).available.length,1);
 assert.equal(evaluate(state('Z'),{resources:{extraZ:'available'},right:{completions:[{}]}}).available.length,0);
 const late=evaluate(state('J','T'),{resources:{extraZ:'used'}});assert.equal(late.context,'held-T-after-extra-Z');
 assert.equal(late.adjustment,late.score); // original geometry retained when source tiers are less apt
});
test('Left context: unknown/truncated supply and hidden future cannot manufacture repairs',()=>{
 const s=state('T',null,[],false),a=evaluate(s),b=evaluate({...s,hiddenQueue:['J'],seed:123});assert.deepEqual(a,b);assert.equal(a.repair,null);
 for(const c of L.catalog)for(const p of 'IJLOSZ')for(const h of L.landings(c.profile.map(v=>v+3),p))assert.equal(h.reduce((a,b)=>a+b,0),c.profile.reduce((a,b)=>a+b,0)+12+4);
});
test('Left context: identical visible multiset in a different order changes the two-lock estimate',()=>{
 const a=evaluate(state('I',null,['J','T','S'],false)),b=evaluate(state('I',null,['T','S','J'],false));
 assert.ok(a.score>b.score);assert.deepEqual(a.repair.pieces,['I','J']);assert.equal(b.repair,null);
});
test('Left context: empty HOLD consumes the queue, and the one-time Z allowance cannot be spent twice',()=>{
 const a=evaluate(state('T',null,['I','J'],true));assert.deepEqual(a.repair.pieces,['I','J']);assert.equal(a.repair.hold,true);
 const b=evaluate(state('T',null,['I','T','S','J'],true));assert.equal(b.repair,null);
 for(const c of L.catalog){const r=evaluate(state('Z','Z',['Z','Z']),{heights:c.profile.map(v=>v+3),resources:{extraZ:'available'}});assert.notDeepEqual(r.repair?.pieces,['Z','Z']);}
});
test('Left context integration: source preference can choose between otherwise equally ranked verified prefixes',()=>{
 // Synthetic source-profile Left on the existing empty-hold fixture's Center/
 // Right. This proves plumbing, not a naturally reached position or survival.
 const fs=require('node:fs'),vm=require('node:vm'),P=require('../st-planner'),R=require('../st-rules'),F=require('../st-fixtures');
 const s=F.get('empty-hold').observation;delete s.bag;s.rules='st-zero-v2';
 for(let y=0;y<40;y++)s.board[y]=[7,7,7,5].map(h=>y>=40-h?'X':'.').join('')+s.board[y].slice(4);
 s.active={type:'O',x:3,y:17,rotation:0,lastRotation:null};s.hold='I';s.canHold=true;s.queue=['J','I','O','T','S','Z'];
 const module={exports:{}},requireAt=require('node:module').createRequire(require.resolve('../st-planner'));
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:name=>name==='./st-left-context.js'?{...L,evaluate:(...args)=>({...L.evaluate(...args),score:0})}:requireAt(name)});
 const options={depth:2,width:8,maxNodes:45000,disableConstruction:true},a=P.plan(s,options),b=module.exports.plan(s,options);
 assert.deepEqual([...a.evidence.structuralRank.slice(0,-1)],[...b.evidence.structuralRank.slice(0,-1)]);
 assert.equal(a.continuation[0].event.type,'O');assert.equal(b.continuation[0].event.type,'I');
 assert.ok(a.assessment.leftContext.score>b.assessment.leftContext.score);
 for(const plan of[a,b]){let current=s;for(const step of plan.continuation){const replay=R.replay(current,step.witness);assert.equal(replay.valid,true);current=replay.state;}}
});
