'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),F=require('../st-fixtures');
const {fixtures}=require('./support/st-fixtures.cjs');
function scoped(run){let metrics;const result=R.withCoachNoClear(()=>{const value=run();metrics=R.coachClearMetrics();return value;});return {result,metrics};}
const empty=()=>R.createState({active:'O',queue:['I','T']});

test('coach no-clear: complete placement outputs agree for every fixture and all seven pieces',()=>{
 let checked=0,skipped=0,fallbacks=0,right=0;
 for(const fixture of F.list)for(const type of 'IJLOSTZ'){
  const s=R.createState({...fixture.observation,active:type,hold:'L',queue:['Z','O']}),options={allowHold:true,maxNodes:100000};
  const expected=R.placements(s,options),actual=scoped(()=>R.placements(s,options));
  assert.equal(expected.complete,true,`${fixture.id}/${type} must be exhaustive`);
  assert.deepEqual(actual.result,expected,`${fixture.id}/${type}`);
  skipped+=actual.metrics.nonRightSkipped;fallbacks+=actual.metrics.nonRightFallbacks;right+=actual.metrics.rightScans;checked++;
 }
 assert.equal(checked,F.list.length*7);assert.ok(skipped>0);assert.ok(fallbacks>0);assert.ok(right>0);
 assert.equal(R.coachClearMetrics(),null);
});

test('coach no-clear: pure Left, Center, and Left/Center crossing all use safe fast path',()=>{
 for(const x of [-1,3,2]){
  const s=R.createState({active:{type:'O',x,y:20,rotation:0,lastRotation:null}});
  const expected=R.move(s,'HD'),actual=scoped(()=>R.move(s,'HD'));
  assert.deepEqual(actual.result,expected);assert.equal(expected.lastEvent.lines,0);
  assert.equal(actual.metrics.nonRightSkipped,1);assert.equal(actual.metrics.nonRightFallbacks,0);assert.equal(actual.metrics.rightScans,0);
  if(x===2){assert.ok(expected.lastEvent.cells.some(([cx])=>cx<4));assert.ok(expected.lastEvent.cells.some(([cx])=>cx>=4));}
 }
});

test('coach no-clear: Center/Right crossing T-spin double retains full clear and spin evidence',()=>{
 const s=R.createState({board:fixtures.cap.afterCap,active:'T'});
 const p=R.placements(s,{allowHold:false}).placements.find(p=>p.event.lines===2&&p.event.spin==='full');assert.ok(p);
 assert.ok(p.event.cells.some(([x])=>x<7));assert.ok(p.event.cells.some(([x])=>x>=7));
 const actual=scoped(()=>R.replay(s,p.witness));assert.equal(actual.result.valid,true);assert.deepEqual(actual.result.state,p.state);
 assert.equal(actual.metrics.rightScans,1);assert.equal(actual.metrics.nonRightSkipped,0);
});

test('coach no-clear: imported pre-existing full row away from landing still physically clears',()=>{
 const s=empty();s.board[39]='##########';
 const expected=R.move(s,'HD');assert.equal(expected.lastEvent.lines,1);
 const actual=scoped(()=>R.move(s,'HD'));assert.deepEqual(actual.result,expected);
 assert.equal(actual.metrics.nonRightFallbacks,1);assert.equal(actual.metrics.nonRightSkipped,0);
 assert.deepEqual(R.move(s,'HD'),expected,'manual physical rule unchanged after scope');
});

test('coach no-clear: absent Right gap is not mistaken for a clear or a forbidden landing',()=>{
 const s=R.createState({...F.get('left-side-diagnostic').observation,active:'I',hold:null,queue:[]});
 const actions=['L','L','L','CCW','HD'],expected=R.replay(s,actions);assert.equal(expected.valid,true);assert.equal(expected.state.lastEvent.lines,0);
 assert.ok(expected.state.lastEvent.cells.every(([x])=>x<7));
 const actual=scoped(()=>R.replay(s,actions));assert.deepEqual(actual.result,expected);
 assert.equal(actual.metrics.nonRightFallbacks,1);assert.equal(actual.metrics.nonRightSkipped,0);
});

test('coach no-clear: non-Right placement that really clears retains physical event',()=>{
 const s=R.createState({active:{type:'I',x:2,y:17,rotation:1,lastRotation:null}});s.board[39]='####.#####';
 const expected=R.move(s,'HD');assert.equal(expected.lastEvent.lines,1);assert.ok(expected.lastEvent.cells.every(([x])=>x<7));
 const actual=scoped(()=>R.move(s,'HD'));assert.deepEqual(actual.result,expected);assert.equal(actual.metrics.nonRightFallbacks,1);
});

test('coach no-clear: board facts expire between requests even when same array is edited',()=>{
 const s=empty(),first=scoped(()=>R.move(s,'HD'));assert.equal(first.metrics.boardsChecked,1);assert.equal(first.metrics.nonRightSkipped,1);
 s.board[39]='##########';
 const expected=R.move(s,'HD'),second=scoped(()=>R.move(s,'HD'));assert.equal(expected.lastEvent.lines,1);assert.deepEqual(second.result,expected);
 assert.equal(second.metrics.boardsChecked,1);assert.equal(second.metrics.nonRightSkipped,0);assert.equal(second.metrics.nonRightFallbacks,1);
});

test('coach no-clear: nesting shares scope, returns values, and finally restores on exceptions',()=>{
 const s=empty();assert.equal(R.coachClearMetrics(),null);
 const sentinel={};assert.equal(R.withCoachNoClear(()=>sentinel),sentinel);
 assert.throws(()=>R.withCoachNoClear(()=>{R.move(s,'HD');throw new Error('outer failure');}),/outer failure/);
 assert.equal(R.coachClearMetrics(),null);
 R.withCoachNoClear(()=>{
  R.move(s,'HD');assert.equal(R.coachClearMetrics().nonRightSkipped,1);
  assert.throws(()=>R.withCoachNoClear(()=>{R.move(s,'HD');throw new Error('inner failure');}),/inner failure/);
  assert.equal(R.coachClearMetrics().nonRightSkipped,2);assert.equal(R.coachClearMetrics().boardsChecked,1);
  const snapshot=R.coachClearMetrics();snapshot.nonRightSkipped=999;assert.equal(R.coachClearMetrics().nonRightSkipped,2);
 });
 assert.equal(R.coachClearMetrics(),null);assert.equal(scoped(()=>R.move(s,'HD')).metrics.nonRightSkipped,1);
});

test('coach no-clear: successor boards and createState copies reuse sound clean-board proof',()=>{
 const s=empty();R.withCoachNoClear(()=>{
  const next=R.move(s,'HD'),copy=R.createState({...next,active:'O'});
  R.move(copy,'HD');assert.equal(R.coachClearMetrics().boardsChecked,1);assert.equal(R.coachClearMetrics().nonRightSkipped,2);
 });
});

function sameQuery(actual,expected){const core=({placements,complete,scope,queryStatus})=>({placements,complete,scope,queryStatus});assert.deepEqual(core(actual),core(expected));}

test('coach no-clear: targeted queries preserve actual moved-pose witnesses and cache scope parity',()=>{
 const s=R.createState({active:{type:'O',x:2,y:28,rotation:0,lastRotation:null},hold:'I',queue:['T']});
 const full=R.placements(s,{allowHold:true}),targets=full.placements.map(p=>p.target);
 const options={allowHold:true},expected=R.withQueries(()=>R.targetedPlacements(s,targets,options));
 R.withQueries(()=>{
  sameQuery(R.targetedPlacements(s,targets,options),expected);
  sameQuery(R.withCoachNoClear(()=>R.targetedPlacements(s,targets,options)),expected);
  sameQuery(R.targetedPlacements(s,targets,options),expected);
 });
 const fresh=scoped(()=>R.withQueries(()=>R.targetedPlacements(s,targets,options)));
 sameQuery(fresh.result,expected);assert.ok(fresh.metrics.nonRightSkipped>0);assert.ok(fresh.metrics.rightScans>0);
 for(const p of fresh.result.placements){const replay=R.replay(s,p.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,p.state);}
});

test('coach no-clear: full query cache stays semantically identical across nested contexts',()=>{
 const s=R.createState({...F.get('direct-double').observation,active:'T',hold:'O'}),options={allowHold:true};
 const expected=R.withQueries(()=>R.placements(s,options));
 R.withQueries(()=>{
  sameQuery(R.withCoachNoClear(()=>R.placements(s,options)),expected);
  sameQuery(R.placements(s,options),expected);
 });
 assert.equal(R.coachClearMetrics(),null);
});

test('coach no-clear: planner, opening and reset public entry points establish request scope',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
 for(const [file,methods] of [['st-planner.js',['plan','decide']],['st-opening.js',['plan']],['st-reset-coach.js',['plan']]]){
  const filename=path.resolve(__dirname,'..',file),localRequire=createRequire(filename);let entered=0;
  const instrumentedRules={...R,withCoachNoClear:run=>{entered++;return R.withCoachNoClear(()=>{assert.notEqual(R.coachClearMetrics(),null);return run();});}};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:id=>/^\.\/st-rules(?:\.js)?$/.test(id)?instrumentedRules:localRequire(id)},{filename});
  for(const method of methods){entered=0;module.exports[method](empty(),{maxNodes:0,timeMs:0,now:()=>0});assert.ok(entered>0,`${file}.${method}`);assert.equal(R.coachClearMetrics(),null);}
 }
});
