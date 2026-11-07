/* Controller-owned execution continuity for one accepted handoff candidate.
 * This is not an obligation ledger, route certificate or portable session.
 * Genuine public-inventory receipts connect each accepted operation locally;
 * only root/current public facts, one lock and a bounded scope count survive.
 * A Worker trusts this controller export as current execution facts, then
 * independently validates the proposed route and resource policy. There is no
 * import/restore API: Undo, reset, import and worker freshness belong to callers.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-public-inventory'),require('./st-bag')):factory(root.STRules,root.STPublicInventory,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STHandoffContinuity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,I,B){
'use strict';
const VERSION=1,MAX_ACTIONS=256,local=new WeakMap(),clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function position(raw){
 if(typeof raw.topOut!=='boolean'||raw.hold!==null&&typeof raw.hold!=='string'||!Array.isArray(raw.queue)||raw.queue.some(t=>typeof t!=='string')||raw.active&&typeof raw.active.type!=='string')throw Error('Invalid public field shape');
 const a=raw.active,r=a?.lastRotation,active=a?{type:a.type,x:a.x,y:a.y,rotation:a.rotation,lastRotation:r?{from:r.from,to:r.to,kickIndex:r.kickIndex}:null}:null;
 const s=R.createState({rules:raw.rules,board:raw.board,active,hold:raw.hold,canHold:raw.canHold,queue:raw.queue,revision:raw.revision,streamCursor:raw.streamCursor,topOut:raw.topOut});
 if(raw.bag){const k=raw.bag;if(!Array.isArray(k.remaining)||k.remaining.length>128||k.remaining.some(n=>!Number.isInteger(n)||n<0||n>127)||k.error!==undefined&&(typeof k.error!=='string'||k.error.length>128)||k.observedCount!==undefined&&(!Number.isSafeInteger(k.observedCount)||k.observedCount<0)||k.provenance!==undefined&&(typeof k.provenance!=='string'||k.provenance.length>128))throw Error('Invalid public bag');s.bag={remaining:k.remaining.slice(),...(k.error!==undefined?{error:k.error}:{}),...(k.observedCount!==undefined?{observedCount:k.observedCount}:{}),...(k.provenance!==undefined?{provenance:k.provenance}:{})};}
 if(R.validate(s).length||s.queue.length>6)throw Error('Invalid public position');
 return s;
}
function subject(p){return p?{id:p.id,type:p.type,bag:p.bag,observedOrder:p.observedOrder}:null;}
function supply(inventory){return{active:subject(inventory.active),hold:subject(inventory.hold),queue:inventory.queue.map(subject)};}
function seal(value,inventory){const result=freeze(value);local.set(result,inventory);return result;}
function start(raw,inventory){
 try{if(!I.bound(inventory,raw))return null;const origin=position(raw);return seal({schemaVersion:VERSION,origin,current:origin,originSupply:supply(inventory),currentSupply:supply(inventory),marked:false,actions:0,event:null,locked:null},inventory);}catch{return null;}
}
function markHandoff(current,raw,inventory){
 try{if(!current||local.get(current)!==inventory||current.marked||current.actions!==0||!same(current.current,position(raw))||!I.bound(inventory,raw))return null;return seal({...current,marked:true},inventory);}catch{return null;}
}
function advance(current,before,action,after,receipt){
 try{
  const inventory=current&&local.get(current);
  if(!inventory||current.event||!same(current.current,position(before))||receipt?.status!=='available'||!I.matchesTransition(receipt,inventory,before,action,after))return null;
  const observed=position(after);
  if(!receipt.accepted)return same(current.current,observed)?current:null;
  // Inventory authenticates draw identity, but its receipt deliberately does
  // not validate the caller's bag-knowledge update. Preserve that old recovery
  // replay check using only this operation's actual newly public subjects.
  let bag=current.current.bag;
  for(const piece of receipt.revealed)if(bag)bag=B.consume(bag,piece.type);
  if(!same(bag??null,observed.bag??null))return null;
  if(!current.marked||current.actions>=MAX_ACTIONS)return null;
  const event=action==='HD'?clone(after.lastEvent):null,locked=action==='HD'?subject(receipt.locked):null;
  if(action==='HD'&&(!event||!locked||event.type!==locked.type))return null;
  return seal({...current,current:observed,currentSupply:supply(receipt.next),actions:current.actions+1,event,locked},receipt.next);
 }catch{return null;}
}
function exportConnected(current){return current&&local.has(current)&&current.marked&&current.event?clone(current):null;}
// This is a transport shape/binding check, not authentication of arbitrary
// imported JSON. Only page/simulator exports enter this transient Worker field.
// A matching revision alone never establishes followed execution.
function connected(value,origin,current,originSupply,currentSupply){
 try{
  return Boolean(value&&value.schemaVersion===VERSION&&value.marked===true&&Number.isInteger(value.actions)&&value.actions>0&&value.actions<=MAX_ACTIONS&&value.event&&Number.isSafeInteger(value.locked?.id)&&value.locked.id>0&&Number.isInteger(value.locked.bag)&&value.locked.bag>=0&&value.locked.type===value.event.type&&[originSupply.active,originSupply.hold,...originSupply.queue].some(p=>same(subject(p),value.locked))&&![currentSupply.active,currentSupply.hold,...currentSupply.queue].some(p=>p?.id===value.locked.id)&&same(value.origin,position(origin))&&same(value.originSupply,supply(originSupply))&&same(value.currentSupply,supply(currentSupply))&&value.current.revision===current.revision);
 }catch{return false;}
}
function matchesEndpoint(value,current,event){try{return same(value.current,position(current))&&same(value.event,event);}catch{return false;}}
return Object.freeze({VERSION,MAX_ACTIONS,start,markHandoff,advance,exportConnected,connected,matchesEndpoint});
});
