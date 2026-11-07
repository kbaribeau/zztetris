/* Caller-owned, local Undo receipts for immutable current obligation payloads.
 * This module does not apply game moves, choose checkpoints, or store history.
 * The caller owns the session handle and its finite receipt stack. The session
 * retains ONE current payload reference; receipts retain only changed before-
 * images, identity/cursor metadata, and their owning session. No receipt points
 * to another receipt, an old payload, a board, or a private future sequence.
 *
 * start(importedContext) establishes a new local session. Structural imports
 * remain trusted independently of receipt authentication. record() runs after
 * a successful immutable Context transition. compose keeps the original turn
 * checkpoint and supersedes its prior receipt. Start it with piece:null, then
 * bind the actual HD receipt.locked, which may differ after HOLD. Later marker
 * changes may compose, but a bound piece cannot be replaced by another lock.
 *
 * A provisional next turn can be undone with piece:null before the last sealed
 * turn. Prefer undo(...,{receipt,tail}) for one atomic return to the older
 * placement checkpoint, including validation failure. join() instead folds
 * between-turn markers into the prior receipt before the next checkpoint.
 * Position, phase, future, plans, and checkpoint/retention policy stay outside.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationInverse=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=1,sessions=new WeakMap(),receipts=new WeakMap();let nextSession=1;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const check=(ok,reason)=>{if(!ok)throw Error('Invalid obligation inverse: '+reason);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const put=(x,k,value)=>Object.defineProperty(x,k,{value,writable:true,enumerable:true,configurable:true});
function clone(x){if(!x||typeof x!=='object')return x;if(Array.isArray(x))return x.map(clone);const out={};for(const k of Object.keys(x))put(out,k,clone(x[k]));return out;}
function same(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>own(b,k)&&same(a[k],b[k]));
}
// Identity checks are exact, not hash-based. Deep immutability makes a session's
// current object reference a sufficient local content boundary. Import through
// the domain validator before start(); this module does not infer provenance.
function immutableJson(x,ancestors=new Set()){
 if(x===null||typeof x==='string'||typeof x==='boolean')return;
 if(typeof x==='number'){check(Number.isFinite(x),'finite JSON number required');return;}
 check(x&&typeof x==='object'&&!ancestors.has(x),'acyclic JSON data required');
 check(Object.isFrozen(x),'current payload must be deeply immutable');
 check(Object.getOwnPropertySymbols(x).length===0,'JSON symbols are unsupported');
 const proto=Object.getPrototypeOf(x);
 check(Array.isArray(x)||proto===null||Object.getPrototypeOf(proto)===null,'plain JSON object required');
 const keys=Object.keys(x),names=Object.getOwnPropertyNames(x);
 if(Array.isArray(x))check(names.length===x.length+1&&keys.length===x.length&&keys.every((k,i)=>k===String(i)),'dense JSON array required');
 else check(names.length===keys.length,'enumerable JSON properties required');
 ancestors.add(x);
 for(const k of keys){const d=Object.getOwnPropertyDescriptor(x,k);check(d&&own(d,'value'),'JSON accessors are unsupported');immutableJson(d.value,ancestors);}
 ancestors.delete(x);
}
function payload(x){check(object(x),'current payload must be an object');immutableJson(x);}
function subject(p){
 if(p===null)return null;
 check(object(p)&&Number.isSafeInteger(p.id)&&p.id>0&&typeof p.type==='string'&&p.type.length===1&&'IJLOSTZ'.includes(p.type)&&(p.bag===null||Number.isSafeInteger(p.bag)&&p.bag>=0)&&(p.observedOrder===null||Number.isSafeInteger(p.observedOrder)&&p.observedOrder>=0),'piece identity/type/bag required');
 return{id:p.id,type:p.type,bag:p.bag,observedOrder:p.observedOrder};
}
// Paths address own JSON properties only. Arrays retain unchanged prefixes and
// suffixes; changes within the shared middle are recursive scalar/property
// edits, and only inserted/deleted excess items require a splice before-image.
function difference(before,after,path=[],out=[]){
 if(same(before,after))return out;
 if(Array.isArray(before)&&Array.isArray(after)){
  let start=0,end=0;
  while(start<before.length&&start<after.length&&same(before[start],after[start]))start++;
  while(end<before.length-start&&end<after.length-start&&same(before[before.length-1-end],after[after.length-1-end]))end++;
  const oldLength=before.length-start-end,newLength=after.length-start-end,shared=Math.min(oldLength,newLength);
  for(let i=0;i<shared;i++)difference(before[start+i],after[start+i],[...path,start+i],out);
  if(oldLength!==newLength)out.push({kind:'splice',path:path.slice(),index:start+shared,deleteCount:newLength-shared,values:clone(before.slice(start+shared,start+oldLength))});
 }else if(object(before)&&object(after)){
  for(const key of Object.keys(before))if(own(after,key))difference(before[key],after[key],[...path,key],out);else out.push({kind:'set',path:[...path,key],value:clone(before[key])});
  for(const key of Object.keys(after))if(!own(before,key))out.push({kind:'remove',path:[...path,key]});
 }else out.push({kind:'set',path:path.slice(),value:clone(before)});
 return out;
}
function inverse(current,changes){
 const result=clone(current);
 for(const change of changes){
  const path=change.path;check(path.length>0||change.kind==='splice','root replacement is unsupported');
  let parent=result;
  const stop=change.kind==='splice'?path.length:path.length-1;
  for(let i=0;i<stop;i++){check(parent&&typeof parent==='object'&&own(parent,path[i]),'inverse path missing');parent=parent[path[i]];}
  if(change.kind==='splice'){
   check(Array.isArray(parent)&&change.index<=parent.length&&change.index+change.deleteCount<=parent.length,'inverse array boundary');
   parent.splice(change.index,change.deleteCount,...clone(change.values));
  }else{check(parent&&typeof parent==='object','inverse parent missing');if(change.kind==='set')put(parent,path.at(-1),clone(change.value));else{check(own(parent,path.at(-1)),'inverse created property missing');delete parent[path.at(-1)];}}
 }
 return result;
}
function sessionState(session){const state=sessions.get(session);check(state,'local session required');return state;}
function epoch(value,current,strict=false){check(Number.isSafeInteger(value)&&value>=0&&(strict?value>current:value>=current),'stale request epoch');return value;}
function guard(state,{expectedToken,expectedCursor}={}){
 if(expectedToken!==undefined)check(expectedToken===state.token,'stale semantic token');
 if(expectedCursor!==undefined)check(expectedCursor===state.cursor,'stale stack cursor');
}
function live(session,receipt){const meta=receipt&&receipts.get(receipt);check(meta&&meta.session===session,'authentic receipt from this session required');check(meta.active,'receipt already used or superseded');return meta;}
function atHead(state,receipt){check(receipt.afterToken===state.token&&receipt.afterCursor===state.cursor,'receipt is not at the current stack cursor');}
function provisionalTail(session,state,receipt,tail){
 const meta=live(session,tail);atHead(state,tail);
 check(receipt!==tail&&tail.piece===null,'only an unbound provisional tail may join');
 check(receipt.afterCursor===tail.beforeCursor&&receipt.afterToken===tail.beforeToken,'nonadjacent checkpoint receipts');return meta;
}
function status(session){const s=sessionState(session);return Object.freeze({semanticToken:s.token,cursor:s.cursor,requestEpoch:s.epoch});}
function start(current,{requestEpoch=0}={}){
 payload(current);epoch(requestEpoch,0);check(Number.isSafeInteger(nextSession),'session identity range exhausted');
 const session=Object.freeze({version:VERSION,id:nextSession++});
 sessions.set(session,{current,token:0,cursor:0,epoch:requestEpoch,nextToken:1,nextCursor:1,nextOperation:1});return session;
}
function counters(state,changed){check(Number.isSafeInteger(state.nextCursor)&&Number.isSafeInteger(state.nextOperation)&&(!changed||Number.isSafeInteger(state.nextToken)),'local identity range exhausted');}
function make(session,state,{beforeToken,beforeCursor,afterToken,piece,changes}){
 return freeze({version:VERSION,sessionId:session.id,operationId:state.nextOperation,beforeToken,afterToken,beforeCursor,afterCursor:state.nextCursor,piece,inverse:changes});
}
function install(session,state,receipt,current,requestEpoch,changed,retire=[]){
 for(const old of retire)receipts.get(old).active=false;
 receipts.set(receipt,{session,active:true});state.current=current;state.token=receipt.afterToken;state.cursor=receipt.afterCursor;state.epoch=requestEpoch;
 state.nextCursor++;state.nextOperation++;if(changed)state.nextToken++;
 return Object.freeze({receipt,...status(session),changed});
}
function record(session,{before,after,piece,requestEpoch,compose=null,...expected}={}){
 const state=sessionState(session);check(!state.busy,'session operation in progress');guard(state,expected);check(before===state.current,'current payload boundary mismatch');payload(after);
 const nextEpoch=epoch(requestEpoch===undefined?state.epoch:requestEpoch,state.epoch);
 let original=before,beforeToken=state.token,beforeCursor=state.cursor,boundPiece=piece===undefined?null:subject(piece);
 if(compose){
  live(session,compose);atHead(state,compose);
  if(compose.piece!==null){check(piece===undefined||same(boundPiece,compose.piece),'sealed locked piece cannot change');boundPiece=clone(compose.piece);}
  original=inverse(before,compose.inverse);beforeToken=compose.beforeToken;beforeCursor=compose.beforeCursor;
 }
 const changed=!same(before,after),changes=difference(original,after);counters(state,changed);
 const receipt=make(session,state,{beforeToken,beforeCursor,afterToken:changed?state.nextToken:state.token,piece:boundPiece,changes});
 return install(session,state,receipt,after,nextEpoch,changed,compose?[compose]:[]);
}
// Join is only for one provisional tail, never for erasing a completed lock.
// It does not change semantic content or request epoch. Superseded receipts
// become unusable; the caller replaces them with the returned receipt.
function join(session,{receipt,tail,...expected}={}){
 const state=sessionState(session);check(!state.busy,'session operation in progress');guard(state,expected);live(session,receipt);provisionalTail(session,state,receipt,tail);
 const original=inverse(inverse(state.current,tail.inverse),receipt.inverse),changes=difference(original,state.current);counters(state,false);
 const combined=make(session,state,{beforeToken:receipt.beforeToken,beforeCursor:receipt.beforeCursor,afterToken:state.token,piece:clone(receipt.piece),changes});
 return install(session,state,combined,state.current,state.epoch,false,[receipt,tail]);
}
function undo(session,current,{piece,receipt,tail=null,requestEpoch,restore,...expected}={}){
 const state=sessionState(session);check(!state.busy,'session operation in progress');guard(state,expected);const meta=live(session,receipt);
 let tailMeta=null;if(tail!==null)tailMeta=provisionalTail(session,state,receipt,tail);else atHead(state,receipt);
 check(current===state.current,'current payload boundary mismatch');check(piece!==undefined&&same(subject(piece),receipt.piece),'Undo piece does not match bound locked piece');
 const nextEpoch=epoch(requestEpoch,state.epoch,true),raw=freeze(inverse(tailMeta?inverse(current,tail.inverse):current,receipt.inverse));
 // Validate/import before committing anything. A validator must preserve the
 // semantic payload and have no caller side effects. It may restore domain-local
 // capabilities (for example Context.importState(raw,{position:checkpoint})).
 let restored;state.busy=true;
 try{restored=restore===undefined?raw:(check(typeof restore==='function','restore validator required'),restore(raw));payload(restored);check(same(raw,restored),'restore validator changed semantic payload');}finally{state.busy=false;}
 meta.active=false;if(tailMeta)tailMeta.active=false;
 state.current=restored;state.token=receipt.beforeToken;state.cursor=receipt.beforeCursor;state.epoch=nextEpoch;
 return Object.freeze({state:restored,...status(session)});
}
return Object.freeze({VERSION,start,status,record,join,undo});
});
