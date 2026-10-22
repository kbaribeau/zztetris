/* Observable seven-bag inference. Never accepts a seed or reads a generator. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STBag=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TYPES='IJLOSTZ',ALL=127;
const bit=t=>typeof t==='string'&&t.length===1&&TYPES.includes(t)?1<<TYPES.indexOf(t):0;
const count=m=>m.toString(2).replace(/0/g,'').length;
function validate(k){return !k||!Array.isArray(k.remaining)||k.remaining.length===0||k.remaining.some(m=>!Number.isInteger(m)||m<0||m>127)?['invalid-bag-knowledge']:[];}
function consume(k,type){if(validate(k).length||!bit(type))return{remaining:[],error:'invalid-bag-knowledge'};const b=bit(type),remaining=[...new Set(k.remaining.map(m=>m===0?ALL:m).filter(m=>m&b).map(m=>m^b))].sort((a,b)=>a-b);return remaining.length?{remaining,observedCount:(k.observedCount??0)+1,provenance:k.provenance??'observed'}:{remaining:[],error:'contradictory-observed-stream'};}
function fromObserved({observed=[],startPhase=null}={}){if(!Array.isArray(observed)||(startPhase!==null&&(!Number.isInteger(startPhase)||startPhase<0||startPhase>6)))return{remaining:[],error:'invalid-bag-evidence'};let remaining=[];for(let m=1;m<=127;m++)if(startPhase===null||count(m)===7-startPhase)remaining.push(m);let k={remaining,observedCount:0,provenance:startPhase===null?'unknown-phase':'known-phase'};for(const t of observed){k=consume(k,t);if(k.error)break;}return k;}
function possibilities(k){if(validate(k).length)return[];let mask=0;for(const m of k.remaining)mask|=m||ALL;return[...TYPES].filter(t=>mask&bit(t));}
function forcedNext(k){const p=possibilities(k);return p.length===1?p[0]:null;}
return Object.freeze({fromObserved,consume,forcedNext,possibilities,validate});
});
