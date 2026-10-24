'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),A=require('../st-access');
const options={deadline:Infinity,maxNodes:20000,openingDepth:2};
function normalized(a){a=JSON.parse(JSON.stringify(a));delete a.metrics.elapsedMs;delete a.metrics.usage;return a;}
test('opening usage: opt-in counters and named score contributions do not change a fixed-node recommendation',()=>{
 const state=R.createState({active:'O',queue:['I','L','J','T','S','Z']});S.clearCache();A.clearCache();const plain=P.plan(state,options);S.clearCache();A.clearCache();const measured=P.plan(state,{...options,usageTelemetry:true});
 assert.equal(plain.metrics.usage,undefined);assert.deepEqual(normalized(measured),normalized(plain));
 const u=measured.metrics.usage;assert.equal(u.schemaVersion,1);assert.equal(u.scope,'opening');assert.equal(u.selected.path,'ordinary');assert.equal(u.selected.locks,measured.continuation.length);
 assert.equal(u.families.ordinary.examined,u.families.ordinary.admitted+Object.values(u.rejections).reduce((a,b)=>a+b,0));
 assert.ok(u.families.ordinary.ranked>0);assert.equal(u.families.ordinary.selected,1);
 assert.equal(u.access.checked,u.access.witnessed+u.access.rejected+u.access.unknown);
 assert.ok(Math.abs(Object.values(u.selected.scoreComponents).reduce((a,b)=>a+b,0)-u.selected.rank[5])<1e-9);
 assert.equal(u.selected.rank.length,8);assert.equal(u.families.retainedRepair.provided,0);
});
test('opening usage: actual-clear handoff reports its verified selection without invented opening rank components',()=>{
 const f=require('./support/st-opening-handoff.json'),session=P.updateOpeningSession({active:true,clear:null},f.before,f.after,f.event);
 const a=P.plan(f.after,{...options,openingPhase:true,openingClear:session.clear,usageTelemetry:true});
 assert.equal(a.phase,'maintenance');assert.equal(a.metrics.usage.selected.path,'actual-clear-handoff');
 assert.equal(a.metrics.usage.families.handoff.actualClearProvided,1);assert.equal(a.metrics.usage.families.handoff.selected,1);
 assert.equal(a.metrics.usage.selected.scoreComponents,undefined);
});
test('opening usage: foundation-stage counters separate checked paths from retained goals without changing selection',()=>{
 const f=require('./support/st-opening-foundation-stage.json'),O=require('../st-opening');
 const opts={deadline:Infinity,maxNodes:45000,openingPhase:true};S.clearCache();A.clearCache();const plain=P.plan(f.observation,opts);S.clearCache();A.clearCache();const measured=P.plan(f.observation,{...opts,usageTelemetry:true});
 assert.deepEqual(normalized(measured),normalized(plain));const u=measured.metrics.usage.families.foundationStage;
 for(const [key,value]of Object.entries(measured.metrics.foundationStages))assert.equal(u[key],value);
 assert.equal(u.selectedPath,1);assert.equal(u.retainedGoal,0);assert.ok(u.verified>0);assert.equal(u.completed,undefined);
 const pre=R.replay(f.observation,measured.witness.slice(0,-1)).state,first=R.replay(pre,['HD']),session=P.updateOpeningSession({active:true,clear:null,repair:measured.evidence.opening.repair},pre,first.state,first.events[0]);
 const retained=P.plan(first.state,{...opts,openingRepair:session.repair,usageTelemetry:true});assert.equal(retained.metrics.usage.families.foundationStage.retainedGoal,1);assert.ok(O.checkedRepair(session.repair,first.state));
});
