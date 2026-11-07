/* Finite controller-owned execution cursor for one selected construction.
 * Root/current public facts, actual consumed locks and the current turn's
 * accepted inputs survive. Completed turns have no action tape. This is not
 * obligation authority or a route certificate: the planner checks the saved
 * root and future witnesses independently. Portable current facts are trusted
 * after shape/binding validation; local advances require genuine receipts.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-public-inventory'),require('./st-bag'),require('./st-obligation-context')):factory(root.STRules,root.STPublicInventory,root.STBag,root.STObligationContext);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPlanContinuity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,I,B,C){
'use strict';
const VERSION=1,MAX_LOCKS=7,MAX_TURN_ACTIONS=256,MAX_ACTIONS=1792;
const ACTIONS=['L','R','SD','HD','HOLD','CW','CCW','R180'],KINDS=[null,'cap-deferral','left-support','left-foundation','left-scoring-foundation'];
const local=new WeakMap(),clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(ok,message)=>{if(!ok)throw Error('Invalid plan continuity: '+message);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const seal=(value,inventory)=>{const result=freeze(value);local.set(result,inventory);return result;};
const shape=(x,keys)=>check(x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'object shape');
function position(raw){
 check(raw&&typeof raw.topOut==='boolean'&&(raw.hold===null||typeof raw.hold==='string')&&Array.isArray(raw.queue)&&raw.queue.every(t=>typeof t==='string')&&(!raw.active||typeof raw.active.type==='string'),'public scalars');
 const a=raw.active,r=a?.lastRotation,active=a?{type:a.type,x:a.x,y:a.y,rotation:a.rotation,lastRotation:r?{from:r.from,to:r.to,kickIndex:r.kickIndex}:null}:null;
 check(Number.isSafeInteger(raw.revision)&&raw.revision>=0&&Number.isSafeInteger(raw.streamCursor)&&raw.streamCursor>=0,'public counters');
 // Do not clone arbitrary nested properties in an otherwise valid position.
 const s=R.createState({rules:raw.rules,board:raw.board,active,hold:raw.hold,canHold:raw.canHold,queue:raw.queue,revision:raw.revision,streamCursor:raw.streamCursor,topOut:raw.topOut});
 if(raw.bag){const k=raw.bag;check(Array.isArray(k.remaining)&&k.remaining.length<=128&&k.remaining.every(n=>Number.isInteger(n)&&n>=0&&n<=127)&&(k.error===undefined||typeof k.error==='string'&&k.error.length<=128)&&(k.observedCount===undefined||Number.isSafeInteger(k.observedCount)&&k.observedCount>=0)&&(k.provenance===undefined||typeof k.provenance==='string'&&k.provenance.length<=128),'public bag');s.bag={remaining:k.remaining.slice(),...(k.error!==undefined?{error:k.error}:{}),...(k.observedCount!==undefined?{observedCount:k.observedCount}:{}),...(k.provenance!==undefined?{provenance:k.provenance}:{})};}
 check(R.validate(s).length===0&&s.queue.length<=6,'public position');return s;
}
const semanticPosition=(a,b)=>same({...a,revision:0},{...b,revision:0});
function subject(p){
 if(p===null)return null;
 check(p&&Number.isSafeInteger(p.id)&&p.id>0&&typeof p.type==='string'&&p.type.length===1&&'IJLOSTZ'.includes(p.type)&&(p.bag===null||Number.isSafeInteger(p.bag)&&p.bag>=0)&&(p.observedOrder===null||Number.isSafeInteger(p.observedOrder)&&p.observedOrder>=0),'public subject');
 return{id:p.id,type:p.type,bag:p.bag,observedOrder:p.observedOrder};
}
function supply(raw){
 check(raw&&Array.isArray(raw.queue)&&raw.queue.length<=6,'supply');
 const value={active:subject(raw.active),hold:subject(raw.hold),queue:raw.queue.map(p=>{check(p!==null,'preview subject');return subject(p);})},ids=[value.active,value.hold,...value.queue].filter(Boolean).map(p=>p.id);
 check(new Set(ids).size===ids.length,'distinct live subjects');return value;
}
function supplyBound(raw,s){return(raw.active?.type??null)===(s.active?.type??null)&&(raw.hold?.type??null)===s.hold&&same(raw.queue.map(p=>p.type),s.queue);}
function plan(proof){
 check(proof&&KINDS.includes(proof.kind??null)&&Array.isArray(proof.steps)&&proof.steps.length>0&&proof.steps.length<=MAX_LOCKS&&Number.isInteger(proof.consumed)&&proof.consumed>=0&&proof.consumed<proof.steps.length,'selected construction');
 const steps=proof.steps.map(p=>{const w=p?.witness;check(Array.isArray(w)&&w.length>0&&w.length<=MAX_TURN_ACTIONS&&w.at(-1)==='HD'&&w.slice(0,-1).every(a=>ACTIONS.includes(a)&&a!=='HD'),'original witness');return{witness:w.slice()};});
 return{kind:proof.kind??null,steps};
}
function event(raw){
 const t=raw?.target,cell=c=>Array.isArray(c)&&c.length===2&&Number.isInteger(c[0])&&c[0]>=0&&c[0]<10&&Number.isInteger(c[1])&&c[1]>=0&&c[1]<40;
 check(raw&&typeof raw.type==='string'&&raw.type.length===1&&'IJLOSTZ'.includes(raw.type)&&t&&t.type===raw.type&&Number.isInteger(t.x)&&t.x>=-3&&t.x<=9&&Number.isInteger(t.y)&&t.y>=-3&&t.y<40&&Number.isInteger(t.rotation)&&t.rotation>=0&&t.rotation<4&&Array.isArray(raw.cells)&&raw.cells.length===4&&raw.cells.every(cell)&&Array.isArray(raw.clearedRows)&&raw.clearedRows.length<=40&&raw.clearedRows.every((y,i)=>Number.isInteger(y)&&y>=0&&y<40&&(!i||y>raw.clearedRows[i-1]))&&raw.lines===raw.clearedRows.length&&['none','mini','full'].includes(raw.spin)&&typeof raw.topOut==='boolean','lock event');
 const target={type:t.type,x:t.x,y:t.y,rotation:t.rotation};check(same(R.cells(target),raw.cells),'lock cells');
 return{type:raw.type,target,cells:raw.cells.map(c=>c.slice()),lines:raw.lines,clearedRows:raw.clearedRows.slice(),spin:raw.spin,topOut:raw.topOut};
}
function rootSupply(proof){
 if(proof.obligationContext===undefined)return null;
 const context=C.importState(proof.obligationContext,{position:position(proof.origin)});
 check(context.status==='available','saved root accounting');return supply(context.inventory);
}
function start(raw,inventory,proof){
 try{
  check(I.bound(inventory,raw)&&proof?.consumed===0,'current origin inventory');const origin=position(raw),original=position(proof.origin),identity=plan(proof),visible=supply(inventory),bound=rootSupply(proof);
  check(same(origin,original)&&(!bound||same(bound,visible)),'original position/supply');
  return seal({schemaVersion:VERSION,plan:identity,origin,current:origin,originSupply:visible,currentSupply:visible,locks:[],actionsSinceLock:[],actions:0},inventory);
 }catch{return null;}
}
function advance(current,before,action,after,receipt){
 try{
  const inventory=current&&local.get(current);check(inventory&&same(current.current,position(before))&&receipt?.status==='available'&&I.matchesTransition(receipt,inventory,before,action,after),'genuine current operation');
  const observed=position(after);if(!receipt.accepted)return same(current.current,observed)?current:null;
  let bag=current.current.bag;for(const piece of receipt.revealed)if(bag)bag=B.consume(bag,piece.type);check(same(bag??null,observed.bag??null),'actual bag progression');
  check(current.actions<MAX_ACTIONS&&current.actionsSinceLock.length<MAX_TURN_ACTIONS,'finite selected-plan scope');
  const locks=current.locks.slice();let actionsSinceLock;
  if(action==='HD'){
   const actual=event(after.lastEvent),locked=subject(receipt.locked);check(locked&&actual.type===locked.type&&!locks.some(p=>p.locked.id===locked.id),'actual locked subject');
   locks.push({event:actual,locked});if(locks.length>=current.plan.steps.length)return null;actionsSinceLock=[];
  }else actionsSinceLock=[...current.actionsSinceLock,action];
  return seal({...current,current:observed,currentSupply:supply(receipt.next),locks,actionsSinceLock,actions:current.actions+1},receipt.next);
 }catch{return null;}
}
function exportState(current){return current&&local.has(current)?clone(current):null;}
function read(payload,proof,raw,inventory,{rebindRevision=false}={}){
 shape(payload,['schemaVersion','plan','origin','current','originSupply','currentSupply','locks','actionsSinceLock','actions']);
 check(payload.schemaVersion===VERSION&&I.bound(inventory,raw),'current inventory');
 const identity=plan(proof),origin=position(payload.origin),current=position(payload.current),observed=position(raw),original=position(proof.origin),originSupply=supply(payload.originSupply),currentSupply=supply(payload.currentSupply),bound=rootSupply(proof);
 check(same(payload.plan,identity)&&same(payload.origin,origin)&&same(payload.current,current)&&same(payload.originSupply,originSupply)&&same(payload.currentSupply,currentSupply),'canonical current fields');
 check(same(origin,original)&&supplyBound(originSupply,origin)&&same(currentSupply,supply(inventory))&&(!bound||same(bound,originSupply)),'original/current supply binding');
 check(rebindRevision?semanticPosition(current,observed):same(current,observed),'current position binding');
 check(Array.isArray(payload.locks)&&payload.locks.length===proof.consumed&&payload.locks.length<identity.steps.length&&Array.isArray(payload.actionsSinceLock)&&payload.actionsSinceLock.length<=MAX_TURN_ACTIONS&&payload.actionsSinceLock.every(a=>ACTIONS.includes(a)&&a!=='HD')&&Number.isInteger(payload.actions)&&payload.actions>=payload.locks.length+payload.actionsSinceLock.length&&payload.actions<=payload.locks.length*MAX_TURN_ACTIONS+payload.actionsSinceLock.length&&payload.actions<=MAX_ACTIONS,'finite progress');
 // Retain only the selected plan's consumed identities. Current imports trust
 // these facts, but contradictory current namespaces are still malformed.
 const live=[inventory.active,inventory.hold,...inventory.queue].filter(Boolean),seen=new Set(),known=inventory.originKnown;
 const checkSubject=p=>check(p.id<inventory.nextId&&(known?p.bag!==null&&p.observedOrder!==null:p.bag===null&&p.observedOrder===null),'subject namespace');
 for(const p of [originSupply.active,originSupply.hold,...originSupply.queue].filter(Boolean)){
  checkSubject(p);const now=live.find(q=>q.id===p.id);check(!now||same(subject(now),p),'surviving original subject');
 }
 const locks=payload.locks.map(p=>{shape(p,['event','locked']);const actual=event(p.event),locked=subject(p.locked);check(locked&&same(p.event,actual)&&same(p.locked,locked)&&actual.type===locked.type&&!seen.has(locked.id)&&!live.some(q=>q.id===locked.id),'consumed lock');checkSubject(locked);seen.add(locked.id);const original=[originSupply.active,originSupply.hold,...originSupply.queue].find(q=>q?.id===locked.id);check(!original||same(original,locked),'original locked subject');return{event:actual,locked};});
 check(payload.actions!==0||!locks.length&&!payload.actionsSinceLock.length&&semanticPosition(origin,current)&&same(originSupply,currentSupply),'zero-operation origin');
 return{schemaVersion:VERSION,plan:identity,origin,current:observed,originSupply,currentSupply,locks,actionsSinceLock:payload.actionsSinceLock.slice(),actions:payload.actions};
}
function importState(payload,{position:raw,inventory,proof}={}){try{return seal(read(payload,proof,raw,inventory,{rebindRevision:true}),inventory);}catch{return null;}}
// This gate consumes trusted controller transport, not arbitrary provenance.
// The caller independently validates the complete original/future route first.
function matches(payload,proof,verifiedContinuation,raw,inventory){
 try{
  const value=read(payload,proof,raw,inventory),steps=Array.isArray(verifiedContinuation)?verifiedContinuation:verifiedContinuation?.continuation;
  check(Array.isArray(steps)&&steps.length===value.plan.steps.length,'verified construction length');
  for(let i=0;i<value.locks.length;i++)check(same(value.locks[i].event,event(steps[i]?.event)),'actual selected lock');
  // Preserve the old finite executed-suffix budget charge. Removing replay
  // must not silently buy extra search nodes for this strategy exception.
  return{valid:true,visited:value.actions,actionsSinceLock:value.actionsSinceLock.slice()};
 }catch{return{valid:false,visited:0,actionsSinceLock:[]};}
}
return Object.freeze({VERSION,MAX_LOCKS,MAX_TURN_ACTIONS,MAX_ACTIONS,start,advance,exportState,importState,matches});
});
