'use strict';
// Aggregate the shared coach's anomaly events, not a second resource ledger.
// Counts are exact. Only the diagnostic examples have a bounded detail budget.
const EXAMPLE_LIMIT=8,DETAIL_BUDGET=2048;
function validateEvent(event){
 if(!event||typeof event!=='object'||Array.isArray(event)||typeof event.code!=='string'||!event.code.length||event.code.length>128||typeof event.stage!=='string'||!event.stage.length||event.stage.length>64||!Number.isSafeInteger(event.lock)||event.lock<0)throw Error('Malformed tracking event');
 return event;
}
function example(event){
 let budget=DETAIL_BUDGET;
 const bounded=(value,depth=0)=>{
  if(budget<=0)return '[truncated]';
  if(value===null||typeof value==='boolean'||typeof value==='number'){budget-=16;return typeof value==='number'&&!Number.isFinite(value)?String(value):value;}
  if(typeof value==='string'){const max=Math.max(0,Math.min(256,budget));budget-=Math.min(value.length,max)+8;return value.length>max?value.slice(0,max)+'…':value;}
  if(typeof value!=='object')return String(value).slice(0,64);
  if(depth>=3){budget-=16;return '[truncated]';}
  if(Array.isArray(value)){const items=[];for(const item of value.slice(0,8)){if(budget<=0)break;items.push(bounded(item,depth+1));}if(items.length<value.length)items.push('[truncated]');return items;}
  const entries=[];for(const [key,item]of Object.entries(value).slice(0,8)){if(budget<=0)break;budget-=key.length+8;entries.push([key.slice(0,64),bounded(item,depth+1)]);}return Object.fromEntries(entries);
 };
 return{code:event.code,stage:event.stage,lock:event.lock,...(event.identity!==undefined?{identity:bounded(event.identity)}:{}),...(event.details!==undefined?{details:bounded(event.details)}:{})};
}
function create(){
 const counts=new Map(),examples=[];let total=0;
 return{
  record(event){validateEvent(event);total++;counts.set(event.code,(counts.get(event.code)||0)+1);if(examples.length<EXAMPLE_LIMIT)examples.push(example(event));},
  snapshot({scope='entire-run',throughLock}={}){
   if(!['entire-run','retained-prefix'].includes(scope))throw Error('Invalid tracking metric scope');
   if(throughLock!==undefined&&(!Number.isSafeInteger(throughLock)||throughLock<0))throw Error('Invalid tracking lock boundary');
   return{schemaVersion:1,scope,...(throughLock!==undefined?{throughLock}:{}),total,counts:Object.fromEntries(counts),examples:JSON.parse(JSON.stringify(examples)),examplesOmitted:total-examples.length};
  }
 };
}
function unavailable(reason){return{schemaVersion:1,scope:'unavailable',throughLock:null,total:null,counts:null,examples:[],examplesOmitted:null,reason};}
module.exports={EXAMPLE_LIMIT,create,validateEvent,unavailable};
