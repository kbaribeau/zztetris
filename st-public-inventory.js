/* Current public identities and seven-bag frontier only. No generator, old
 * pieces, allocation facts, action tape or Undo stack belongs in this adapter.
 * Controllers own snapshots and pass one-operation transitions to consumers. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-bag')):factory(root.STRules,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPublicInventory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B){
'use strict';
const TYPES='IJLOSTZ',ALL=127,ACTIONS=['L','R','SD','HD','HOLD','CW','CCW','R180'];
const trusted=new WeakSet(),transitions=new WeakMap(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const seal=x=>{freeze(x);trusted.add(x);return x;};
const invalid=reason=>seal({schemaVersion:1,status:'invalid',reason});
const bit=type=>1<<TYPES.indexOf(type);
const view=s=>({rules:s.rules,board:s.board,active:s.active,hold:s.hold??null,canHold:s.canHold,queue:s.queue,streamCursor:s.streamCursor||0,topOut:Boolean(s.topOut)});
function knowledge(raw){
 if(raw===null||raw===undefined)return null;
 if(!Array.isArray(raw.remaining)||raw.remaining.length>128||raw.remaining.some(n=>!Number.isInteger(n)||n<0||n>ALL)||new Set(raw.remaining).size!==raw.remaining.length||!Number.isSafeInteger(raw.observedCount??0)||(raw.observedCount??0)<0||typeof (raw.provenance??'observed')!=='string'||(raw.provenance??'observed').length>128)throw Error('Invalid public bag frontier.');
 if((raw.error!==undefined&&!['contradictory-observed-stream','invalid-bag-knowledge'].includes(raw.error))||(!raw.remaining.length&&!raw.error)||(raw.remaining.length&&raw.error))throw Error('Invalid public bag frontier.');
 return {remaining:raw.remaining.slice(),...(raw.error?{error:raw.error}:{}),...(!raw.error?{observedCount:raw.observedCount??0,provenance:raw.provenance??'observed'}:{})};
}
function add(h,type){
 const id=h.nextId++,observedOrder=h.originKnown?id-1:null;
 if(!Number.isSafeInteger(h.nextId))throw Error('Public identity range exhausted.');
 const p={id,type,observedOrder,bag:h.frontier?.bag??null};
 if(h.frontier){
  if(h.frontier.seenMask&bit(type))throw Error('Observed stream contradicts the known seven-bag origin.');
  const seenMask=h.frontier.seenMask|bit(type);
  h.frontier=seenMask===ALL?{bag:h.frontier.bag+1,seenMask:0}:{bag:h.frontier.bag,seenMask};
 }
 return p;
}
function start(raw,{fresh=false}={}){
 try{
  if(R.validate(raw).length||raw.queue.length>6)return invalid('Invalid public origin or oversized preview.');
  const known=Boolean(fresh&&raw.board.every(r=>r==='..........')&&raw.active&&raw.hold===null&&raw.streamCursor===1&&raw.queue.length===6&&new Set([raw.active.type,...raw.queue]).size===7);
  const h={schemaVersion:1,status:'available',originKnown:known,nextId:1,streamCursor:raw.streamCursor,active:null,hold:null,queue:[],frontier:known?{bag:0,seenMask:0}:null,knowledge:known?B.fromObserved({observed:[raw.active.type,...raw.queue],startPhase:0}):knowledge(raw.bag)};
  if(raw.active)h.active=add(h,raw.active.type);
  if(raw.hold)h.hold=add(h,raw.hold);
  h.queue=raw.queue.map(type=>add(h,type));
  return seal(h);
 }catch(error){return invalid(error.message||'Could not initialize public inventory.');}
}
function bound(h,raw){
 try{return trusted.has(h)&&h.status==='available'&&R.validate(raw).length===0&&h.streamCursor===raw.streamCursor&&(h.active?.type??null)===(raw.active?.type??null)&&(h.hold?.type??null)===(raw.hold??null)&&same(h.queue.map(p=>p.type),raw.queue);}catch{return false;}
}
// Receipts are current-operation capabilities, not a journal. The weak entry
// retains only boundary signatures; neither inventory holds its predecessor.
const boundary=(s,lock=false)=>{
 const a=s.active,r=a?.lastRotation,active=a?{type:a.type,x:a.x,y:a.y,rotation:a.rotation,lastRotation:r?{from:r.from,to:r.to,kickIndex:r.kickIndex}:null}:null;
 return JSON.stringify([{...view(s),active},s.revision,knowledge(s.bag),lock?s.lastEvent??null:null]);
};
function transition(inventory,before,action,after){
 const failed=reason=>freeze({status:'invalid',reason,next:invalid(reason)});
 if(!bound(inventory,before))return failed('Missing or mismatched public inventory.');
 try{
  if(!ACTIONS.includes(action)||R.validate(after).length||after.queue.length>6)return failed('Invalid public transition.');
  const initial=R.createState(before),expected=R.move(initial,action),ev=view(expected),av=view(after);
  if(!same({...ev,queue:[]},{...av,queue:[]})||!same(av.queue.slice(0,ev.queue.length),ev.queue))return failed('Public action, draw or reveal does not replay.');
  if(action==='HD'&&expected!==initial&&(!expected.lastEvent||!same(expected.lastEvent,after.lastEvent??expected.lastEvent)))return failed('Public lock event does not replay.');
  const finish=(next,accepted,locked=null,revealed=[])=>{
   const result=freeze({status:'available',prior:inventory,next,action,accepted,locked,revealed});
   transitions.set(result,{before:boundary(before),after:boundary(after,action==='HD')});return result;
  };
  if(expected===initial)return same(view(before),av)?finish(inventory,false):failed('A rejected input cannot reveal supply.');
  const added=av.queue.slice(ev.queue.length);
  if(action!=='HOLD'&&action!=='HD'&&!added.length)return finish(inventory,true);
  const h={...inventory,queue:inventory.queue.slice(),streamCursor:after.streamCursor},revealed=[];
  const draw=()=>{const p=h.queue.shift();if(!p)throw Error('Missing observed draw identity.');return p;};
  if(action==='HOLD'){
   if(h.hold)[h.active,h.hold]=[h.hold,h.active];else{h.hold=h.active;h.active=draw();}
  }else if(action==='HD')h.active=expected.active?draw():null;
  for(const type of added){const p=add(h,type);h.queue.push(p);revealed.push(p);if(h.knowledge)h.knowledge=B.consume(h.knowledge,type);}
  if((h.active?.type??null)!==(av.active?.type??null)||(h.hold?.type??null)!==av.hold||!same(h.queue.map(p=>p.type),av.queue))return failed('Public identity continuity failed.');
  return finish(seal(h),true,action==='HD'?inventory.active:null,revealed);
 }catch(error){return failed(error.message||'Could not apply public transition.');}
}
function matchesTransition(operation,current,before,action,after){
 try{const saved=transitions.get(operation);return Boolean(saved&&operation.prior===current&&operation.action===action&&saved.before===boundary(before)&&saved.after===boundary(after,action==='HD'));}catch{return false;}
}
function applyAction(inventory,before,action,after){return transition(inventory,before,action,after).next;}
// Imported facts are trusted after shape/reference validation, not replayed or
// downgraded because their history is absent. Only current fields are retained.
function importState(raw){
 try{
  if(!raw||raw.schemaVersion!==1||raw.status!=='available'||typeof raw.originKnown!=='boolean'||!Number.isSafeInteger(raw.nextId)||raw.nextId<1||!Number.isSafeInteger(raw.streamCursor)||raw.streamCursor<0||!Array.isArray(raw.queue)||raw.queue.length>6)throw Error('Invalid inventory snapshot.');
  const ids=new Set();
  const piece=p=>{
   if(p===null)return null;
   if(!p||!Number.isSafeInteger(p.id)||p.id<1||p.id>=raw.nextId||ids.has(p.id)||typeof p.type!=='string'||p.type.length!==1||!TYPES.includes(p.type)||(p.observedOrder!==null&&(!Number.isSafeInteger(p.observedOrder)||p.observedOrder<0))||(p.bag!==null&&(!Number.isSafeInteger(p.bag)||p.bag<0))||(raw.originKnown&&(p.bag===null||p.observedOrder===null))||(!raw.originKnown&&(p.bag!==null||p.observedOrder!==null)))throw Error('Invalid live identity.');
   ids.add(p.id);return{id:p.id,type:p.type,observedOrder:p.observedOrder,bag:p.bag};
  };
  const f=raw.frontier;
  if(raw.originKnown?(!f||!Number.isSafeInteger(f.bag)||f.bag<0||!Number.isInteger(f.seenMask)||f.seenMask<0||f.seenMask>=ALL):f!==null)throw Error('Invalid known bag frontier.');
  const h={schemaVersion:1,status:'available',originKnown:raw.originKnown,nextId:raw.nextId,streamCursor:raw.streamCursor,active:piece(raw.active),hold:piece(raw.hold),queue:raw.queue.map(p=>{if(p===null)throw Error('Missing preview identity.');return piece(p);}),frontier:f?{bag:f.bag,seenMask:f.seenMask}:null,knowledge:knowledge(raw.knowledge)};
  if(h.frontier&&[h.active,h.hold,...h.queue].filter(Boolean).some(p=>p.bag>h.frontier.bag||(p.bag===h.frontier.bag&&!(h.frontier.seenMask&bit(p.type)))))throw Error('Live identity exceeds the public bag frontier.');
  return seal(h);
 }catch(error){return invalid(error.message||'Could not import public inventory.');}
}
function exportState(h){return trusted.has(h)&&h.status==='available'?JSON.parse(JSON.stringify(h)):null;}
function remainingTypes(h){return trusted.has(h)&&h.status==='available'&&h.frontier?[...TYPES].filter(t=>!(h.frontier.seenMask&bit(t))):null;}
return Object.freeze({start,transition,matchesTransition,applyAction,bound,exportState,importState,remainingTypes});
});
