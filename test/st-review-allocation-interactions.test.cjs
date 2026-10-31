'use strict';
// Combined-only orchestration checks. The real Left estimator is observed,
// never assigned a synthetic score or certificate. Existing Right tests supply
// the direct positive physical cap/score and actual-lock retention coverage.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const R=require('../st-rules'),S=require('../st-structure'),L=require('../st-left-context');
const cap=require('./fixtures/right-cap-score.json'),timing=require('./fixtures/timely-scoring.json');
const eligible=require('./support/st-right-cap-eligible-harness.cjs');
const bounds={depth:3,width:8,maxNodes:45000,timeMs:1500,now:()=>0,deadline:Infinity};
const samePayload=a=>JSON.parse(JSON.stringify({...a,metrics:undefined}));
function observePlanner(ruleOverrides={},branch=false){
 const calls={total:0,centerReservations:0,rightCleanupContexts:0,rightCapContexts:0};
 const left=Object.freeze({...L,evaluate(state,facts){
  const value=L.evaluate(state,facts);calls.total++;
  // This return value remains a heuristic, including on a physical node whose
  // current public inventory can improve the Left. No new authority is added.
  assert.equal(value.executionVerified,false);
  const reserved=new Set((facts.resources?.pendingCenter||[]).flatMap(p=>(p.alternatives||[]).map(a=>a.piece)));
  for(const debt of facts.centerDebt||[])for(const a of debt.alternatives||[])reserved.add(a.piece);
  if(facts.center?.status==='supported-partner-completion')for(const c of facts.center.completions||[])if(c.patternSupport==='reference-supported')reserved.add(c.piece);
  const available=value.available||[];if(reserved.size)calls.centerReservations++;
  assert(available.every(p=>p.type!=='T'&&!reserved.has(p.type)));
  if(facts.right?.cycle?.prepareColumn!=null||facts.right?.cycle?.cleanupColumns?.length){calls.rightCleanupContexts++;assert(!available.some(p=>p.type==='I'));}
  if(facts.right?.completions?.length){calls.rightCapContexts++;assert(!available.some(p=>p.type==='Z'));}
  return value; // Exact real result: no altered score, reservation or proof flag.
 }});
 const filename=path.resolve(__dirname,'../st-planner.js'),m=new Module(filename,module),req=Module.createRequire(filename);
 m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
 m.require=id=>id==='./st-left-context.js'?left:id==='./st-rules.js'?Object.freeze({...R,...ruleOverrides}):req(id);
 if(branch){
  // Reuse the reviewed actual-I branch harness while observing the same real
  // Left evaluator through its dependency module. No synthetic score enters.
  return{planner:eligible.planner(ruleOverrides,left),calls};
 }
 m._compile(fs.readFileSync(filename,'utf8'),filename);return{planner:m.exports,calls};
}
function decide(p,q,extra={}){return p.decide(q.observation,{...q.options,...bounds,previous:q.previous,commitment:q.commitment,...extra});}
function actualPrefix(raw,advice){let state=R.createState(raw);for(const p of advice.continuation){const r=R.replay(state,p.witness);assert(r.valid);assert.equal(r.events.length,1);assert.deepEqual(r.events[0],p.event);assert(S.canonicalClear(p.event));state=r.state;}return state;}

test('Combined allocation: real Left estimates do not replace an existing executable scoring duty',()=>{
 const watched=observePlanner(),a=decide(watched.planner,timing.request);
 assert(watched.calls.total>0,'the production planner must actually call the real Left evaluator');
 assert.equal(a.continuation[0].event.type,'T');assert.equal(a.continuation[0].event.lines,2);
 assert.equal(a.metrics.rightCapPreference,undefined);assert.equal(a.continuation[0].event.spin,'full');
 // A fresh, equivalently immediate certified score may replace the saved
 // comparison object. Protect actual timing/goals, not metadata identity.
 assert.equal(watched.planner.scoringSchedule(a.continuation).tsds[0],1);
 assert.notEqual(watched.planner.resourceGoalPrefix(a.continuation,timing.request.commitment.advice.continuation),null);
 assert.equal(a.evidence.resourceObligations.status,'checked');assert.equal(a.evidence.gapAccess.reachable,true);actualPrefix(timing.request.observation,a);
});

test('Combined allocation eligible-I branch harness: real Left estimates cannot turn unknown optional cap proof into authority',()=>{
 const q=eligible.request();let unknown=0;
 const watched=observePlanner({tDoubleAccess(board,options){
  unknown++;return{reachable:null,complete:false,witness:[],event:null,visited:Math.min(7,options.maxNodes)};
 }},true);
 const off=observePlanner({},true),incumbent=decide(off.planner,q,{disableRightCapPreference:true}),actual=decide(watched.planner,q);
 assert(watched.calls.total>0&&off.calls.total>0);assert(unknown>0,'controlled seam must reach the optional query');
 assert.equal(actual.metrics.rightCapPreference.selected,false);assert(actual.metrics.rightCapPreference.unknown>0);
 assert.deepEqual(samePayload(actual),samePayload(incumbent));assert(actual.metrics.nodes<=45000);
 actualPrefix(q.observation,actual);
});
