'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),A=require('../st-access');
const f=require('./support/st-early-cap-fallback.json');
const fallback=require('./support/st-fallback-harness.cjs')();
const normalize=a=>{const out=JSON.parse(JSON.stringify(a));delete out.metrics.elapsedMs;delete out.metrics.usage;return out;};
test('maintenance usage branch coverage reports preprocessing partitions when optional result is withheld',()=>{
 const options={deadline:Infinity,maxNodes:1234,patternHistory:f.patternHistory};
 S.clearCache();A.clearCache();const plain=fallback.plan(f.observation,options);
 S.clearCache();A.clearCache();const measured=fallback.plan(f.observation,{...options,usageTelemetry:true});
 assert.ok(plain.target);assert.equal(plain.metrics.usage,undefined);assert.deepEqual(normalize(measured),normalize(plain));
 const u=measured.metrics.usage,c=u.families.cleanupBeforeCap;
 assert.equal(u.schemaVersion,1);assert.equal(u.scope,'maintenance');
 assert.equal(c.examined,c.nonISkipped+c.iColumnSkipped+c.iTransitionChecked);
 assert.ok(c.attempted>0);assert.ok(c.nonISkipped>0);assert.equal(c.iTransitionChecked,0);
 assert.equal(u.families.earlyCapFallback.scanEligible,1);assert.equal(u.families.earlyCapFallback.verified,1);assert.equal(u.families.earlyCapFallback.selected,1);
 assert.equal(u.families.earlyCapFallback.nodes,measured.metrics.earlyCapFallback.nodes);
 assert.equal(u.families.visibleCyclePreparation.attempted,1);assert.equal(u.families.visibleCyclePreparation.unknown,1);assert.equal(u.families.visibleCyclePreparation.selected,0);
 assert.equal(u.selected.path,'early-cap-fallback');assert.equal(u.selected.locks,1);assert.deepEqual(u.selected.rank,measured.evidence.structuralRank);
 for(const cost of Object.values(u.costsMs))assert.ok(Number.isFinite(cost)&&cost>=0);
 assert.equal(R.replay(f.observation,measured.witness).valid,true);
});
test('maintenance usage preserves actual empty-HOLD cleanup qualification and rejects invalid history without counters',()=>{
 const source=require('./support/st-user-held-t-preparation.json'),s=R.createState({board:source.board,active:'Z',hold:null,queue:['I','L','J','T','Z','O']});
 const a=P.plan(s,{depth:1,maxNodes:8000,usageTelemetry:true});assert.equal(a.target.type,'I');
 const c=a.metrics.usage.families.cleanupBeforeCap;assert.ok(c.iTransitionChecked>0);assert.ok(c.verified>0);
 assert.equal(c.examined,c.nonISkipped+c.iColumnSkipped+c.iTransitionChecked);
 assert.equal(a.metrics.usage.families.earlyCapFallback.verified,0);
 const invalid=P.plan(f.observation,{patternHistory:{origin:Array(40).fill('..........'),steps:[]},usageTelemetry:true});
 assert.equal(invalid.target,null);assert.equal(invalid.metrics.usage,undefined,'branches before instrumented maintenance search are not fabricated zero observations');
});
test('final access accounting charges positive, rejected and unknown work without publishing failed advice',()=>{
 // A controlled opening provider isolates the public plan wrapper's accounting.
 // Its one-lock witness is real; search-node amounts and final check are stubs,
 // not a claim that a seven-node movement proof exists for this board.
 const state=R.createState({active:'O',queue:['I']}),witness=['L','L','L','HD'],r=R.replay(state,witness);assert.ok(r.valid);
 // Keep this accounting seam independent of ordinary Center admission: the
 // supplied real O now lies wholly on Left, rather than an unsupported empty
 // Center. All positive/rejected/unknown access and charging assertions remain.
 assert.ok(r.events[0].cells.every(([x])=>x<4));
 const supplied={status:'recommended-with-verified-prefix',target:r.events[0].target,witness,continuation:[{witness,event:r.events[0]}],metrics:{nodes:100,earlyCapFallback:{selected:true},tieExtension:{selected:true},usage:{schemaVersion:1,scope:'maintenance',selected:{path:'early-cap-fallback'},families:{earlyCapFallback:{selected:1}}}},evidence:{}};
 for(const reachable of [true,false,null]){
  let calls=0;const module={exports:{}},access={...A,prefix:(s,steps,options)=>{calls++;assert.equal(options.maxNodes,50);return{reachable,complete:reachable!==null,visited:7,status:'controlled-access-result'};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:id=>id==='./st-access.js'?access:id==='./st-opening.js'?{plan:()=>JSON.parse(JSON.stringify(supplied))}:require(id.replace('./','../')),Date,performance});
  const result=module.exports.plan(state,{maxNodes:150,deadline:Infinity});
  assert.equal(calls,1);assert.equal(result.metrics.nodes,107);
  assert.equal(Boolean(result.target),reachable===true);
  assert.equal(result.metrics.earlyCapFallback.selected,reachable===true);
  assert.equal(result.metrics.tieExtension.selected,reachable===true);
  assert.equal(result.metrics.usage.families.earlyCapFallback.selected,Number(reachable===true));
  assert.equal(result.metrics.usage.selected?.path??null,reachable===true?'early-cap-fallback':null);
  if(reachable!==true){assert.deepEqual(JSON.parse(JSON.stringify(result.witness)),[]);assert.deepEqual(JSON.parse(JSON.stringify(result.continuation)),[]);}
 }
});

test('construction metrics retain proof fields without discarding prior decision work',()=>{
 // Expose the private pure accounting helper, not a fabricated cap winner.
 // Actual certificate discovery and cap/ordinary comparison are covered by
 // st-construction-stages; no production winner is forced in this unit test.
 const module={exports:{}},source=fs.readFileSync(require.resolve('../st-planner'),'utf8').replace('return Object.freeze({','return Object.freeze({constructionMetrics,');
 vm.runInNewContext(source,{module,require:id=>require(id.replace('./','../')),Date,performance});
 const candidate=Object.freeze({metrics:Object.freeze({nodes:209,depth:3,completeDepth:3,endpointMass:44})});
 const spent=Object.freeze({nodes:11312,roots:72,rootExpanded:0,accessNodes:800,depth:1,completeDepth:0});
 const result=module.exports.constructionMetrics(candidate,spent,500);
 assert.equal(result.nodes,11312);assert.equal(result.endpointMass,44);assert.equal(result.depth,3);assert.equal(result.accessNodes,800);
 assert.equal(result.elapsedMs,500);assert.equal(candidate.metrics.nodes,209);assert.equal(spent.nodes,11312);
 assert.equal(12000-result.nodes,688,'outer validation receives only the truly remaining decision allowance');
});

test('maintenance telemetry leaves unmodified ordinary selection unchanged at the historical fallback budget',()=>{
 const options={deadline:Infinity,maxNodes:1234,patternHistory:f.patternHistory};
 S.clearCache();A.clearCache();const plain=P.plan(f.observation,options);
 S.clearCache();A.clearCache();const measured=P.plan(f.observation,{...options,usageTelemetry:true});
 assert.ok(plain.target);assert.deepEqual(normalize(measured),normalize(plain));
 assert.equal(measured.metrics.earlyCapFallback.selected,false);
 assert.equal(measured.metrics.usage.families.earlyCapFallback.selected,0);
 assert.notEqual(measured.metrics.usage.selected.path,'early-cap-fallback');
 assert.equal(R.replay(f.observation,measured.witness).valid,true);
});
