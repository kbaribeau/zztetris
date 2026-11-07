'use strict';
// Test setup uses only maintained current APIs. Recorded actions are inputs,
// not an alternate history ledger; each accepted input advances one Context.
const assert=require('node:assert/strict');
const Rules=require('../../st-rules'),Context=require('../../st-obligation-context'),Provider=require('../../st-resource-provider'),Resources=require('../../st-obligation-resources');
const copy=x=>JSON.parse(JSON.stringify(x));
function importCurrent(position,options){return Context.importState(options.obligationContext,{position});}
function facts(position,current){return Provider.facts(Provider.prepare(position,{obligationContext:Context.exportState(current)}));}
function actual(current,before,action,after){const result=Context.applyActual(current,{before,action,after});assert.equal(result.context.status,'available',result.context.reason);return result.context;}
function extendPublic(position){return Resources.position(Resources.startUnknown(Rules.createState(position)));}
function replayCurrent(position,current,witness){for(const action of witness){const before=position;position=Rules.move(before,action);assert.notEqual(position,before,'Recorded input executes');current=actual(current,before,action,position);}return{position,current,facts:facts(position,current)};}
module.exports={Rules,Context,Provider,Resources,copy,importCurrent,facts,actual,extendPublic,replayCurrent};
// Explicit trusted component fixture, not inferred gameplay provenance. Tests
// that need real observation history use actual() instead of this constructor.
function allowanceFixture(position,remaining){
 const current=Context.exportState(Context.start(position));
 if(remaining===null)return Context.importState(current,{position});
 current.inventory.originKnown=true;let bag=0,mask=0;
 for(const p of [current.inventory.active,current.inventory.hold,...current.inventory.queue].filter(Boolean)){const bit=1<<'IJLOSTZ'.indexOf(p.type);if(mask&bit){bag++;mask=0;}p.bag=bag;p.observedOrder=p.id-1;mask|=bit;}
 current.inventory.frontier=mask===127?{bag:bag+1,seenMask:0}:{bag,seenMask:mask};current.state.availability='known';current.state.sl.status='known';current.state.sl.foundationOpen=false;current.state.sl.firstBagReview='unreviewed';
 current.boundary={firstBagLocks:7,sourcePatternSeen:false};
 Object.assign(current.state.account,{known:true,firstTsd:true,allocationVerified:true,opening:null});current.state.account.profile.before=null;current.state.account.z.remaining=remaining;
 return Context.importState(current,{position});
}
module.exports.allowanceFixture=allowanceFixture;
