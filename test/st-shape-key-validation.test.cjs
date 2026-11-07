'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),I=require('../st-public-inventory'),Q=require('../st-obligation-state'),P=require('../st-obligation-projection'),O=require('../st-opening-obligations');
const copy=x=>JSON.parse(JSON.stringify(x));
function roots(){const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),inventory=I.start(position,{fresh:true}),state=Q.start(position,{inventory});return{state,projection:P.start(state,{position,inventory})};}
for(const kind of ['state','account','supply','subject']){
 function fixture(){const {state,projection}=roots();if(kind==='state')return{value:state,read:Q.importState};if(kind==='account')return{value:state.account,read:O.importState};const key=kind==='supply'?'supply':'active';return{value:kind==='supply'?projection.supply:projection.supply.active,read:value=>{const p=copy(projection);if(key==='supply')p.supply=value;else p.supply.active=value;return P.resolve(p);}};}
 test('shape keys: '+kind+' accepts reordered own enumerable keys and ignores unrelated nonenumerables, symbols and prototypes',()=>{
  const {value,read}=fixture(),expected=read(copy(value));const reordered=Object.fromEntries(Object.entries(value).reverse());Object.setPrototypeOf(reordered,{unrelated:true});Object.defineProperty(reordered,'hidden',{value:1});reordered[Symbol('ignored')]=1;assert.deepEqual(read(reordered),expected);
  const nullPrototype=Object.assign(Object.create(null),value);assert.deepEqual(read(nullPrototype),expected);assert.deepEqual(read(Object.freeze(copy(value))),expected);
 });
 test('shape keys: '+kind+' rejects absent, added, renamed, inherited and hidden required keys',()=>{
  const {value,read}=fixture(),key=Object.keys(value)[0];for(const alter of [v=>{delete v[key];},v=>{v.extra=true;},v=>{v.extra=v[key];delete v[key];},v=>{const prior=v[key];delete v[key];Object.setPrototypeOf(v,{[key]:prior});},v=>{Object.defineProperty(v,key,{value:v[key],enumerable:false});}]){const v=copy(value);alter(v);assert.throws(()=>read(v),/shape/);}
  for(const value of [null,[],0,'invalid'])assert.throws(()=>read(value));
 });
}
