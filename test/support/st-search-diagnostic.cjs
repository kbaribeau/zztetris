"use strict";
const assert=require('node:assert/strict');
const {inspect}=require('node:util');
// Format only a failing assertion: successful timed searches pay no serialization cost.
// No truncation: retain the complete public request/result, including stop telemetry.
function check(value,label,evidence){
 assert.ok(value,value?label:label+'\nSEARCH DIAGNOSTIC\n'+inspect(evidence,{depth:null,maxArrayLength:null,maxStringLength:null,compact:false,sorted:true}));
}
function validatedCache(create,validate){
 let cached;
 return()=>{if(cached===undefined){const candidate=create();validate(candidate);cached=candidate;}return cached;};
}
module.exports={check,validatedCache};
