/* UNWIRED controller seam. Own one current inventory and obligation payload,
 * plus the bounded first-source/lock-seven boundary facts. No history, private
 * generator, phase, accepted plan, Undo stack or run/cap metadata lives here.
 *
 * applyActual consumes one genuine inventory receipt (or creates it once).
 * An accounting failure after an accepted move retains the advanced inventory
 * and explicitly makes accounting unavailable. It never rolls back the move,
 * silently starts new duties, or presents stale duties as current. The caller
 * still owns its actual position, receipt lifetime and whole-turn Undo policy.
 *
 * JSON import trusts current facts, checking structure and current namespaces,
 * not provenance, old geometry or a replay. Snapshots are caller-owned values;
 * restoring one does not require a receipt, history or ancestry capability.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-public-inventory'),require('./st-obligation-state'),require('./st-opening-patterns')):factory(root.STRules,root.STPublicInventory,root.STObligationState,root.STSourcePatterns);if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationContext=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,I,Q,Patterns){
'use strict';
const VERSION=1,trusted=new WeakSet(),clone=x=>JSON.parse(JSON.stringify(x));
const check=(ok,reason)=>{if(!ok)throw Error('Invalid obligation context: '+reason);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const seal=x=>{freeze(x);trusted.add(x);return x;};
function shape(x,keys,label){check(x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),label+' shape');}
function bound(current,position){check(trusted.has(current)&&I.bound(current.inventory,position),'matching current public position/inventory required');}
// References name consumed subjects. Sharing the same consumed subject between
// facets is fine; sharing it with a live piece or future allocator slot is not.
// No ever-used identity set or inference from allocation age is necessary.
function namespace(inventory,state){
 const live=new Set([inventory.active,inventory.hold,...inventory.queue].filter(Boolean).map(p=>p.id));
 const roles=new Map(),rootTypes={SL:'S',LO:'L',OJ:'O',ZJ:'JZ'},partnerTypes={SL:'L',LO:'O',OJ:'J',ZJ:'JZ'};
 const consumed=(id,types)=>{
  if(id===null)return;
  check(Number.isSafeInteger(id)&&id>0&&id<inventory.nextId&&!live.has(id),'consumed subject collides with live inventory or allocator');
  const compatible=[...(roles.get(id)||types)].filter(type=>types.includes(type)).join('');
  check(compatible.length>0,'consumed subject has contradictory current type roles');roles.set(id,compatible);
 };
 for(const b of state.sl.residuals)for(const type of ['S','L'])if(b[type])consumed(b[type].id,type);
 for(const p of [...state.center.pending,...state.center.debt]){
  consumed(p.rootId,rootTypes[p.family]);
  // Exact alternatives can narrow AFTER a diversion. Do not infer that old
  // subject's type from the current target shape. A named family carries its
  // partner type; anonymous origin targets do not. ZJ supports either order.
  if(p.divertedPieceId!==undefined)consumed(p.divertedPieceId,partnerTypes[p.family]||'IJLOSTZ');
 }
 if(state.account.reset.status==='active')consumed(state.account.reset.firstTId,'T');
 check(state.availability!=='known'||inventory.originKnown,'known obligations require known public supply');
}
function importBoundary(raw,inventory,state){
 shape(raw,['firstBagLocks','sourcePatternSeen'],'boundary');
 check(typeof raw.sourcePatternSeen==='boolean','source-pattern flag');
 check(inventory.originKnown?Number.isInteger(raw.firstBagLocks)&&raw.firstBagLocks>=0&&raw.firstBagLocks<=7:raw.firstBagLocks===null,'bounded first-bag lock progress');
 if(state?.availability==='known'){
  check((raw.firstBagLocks===7)===(state.sl.firstBagReview!=='pending'),'first-bag review/progress disagreement');
  check(state.sl.firstBagReview!=='reviewed'||raw.sourcePatternSeen,'reviewed source boundary missing');
 }
 return{firstBagLocks:raw.firstBagLocks,sourcePatternSeen:raw.sourcePatternSeen};
}
function importState(raw,{position}={}){
 shape(raw,['schemaVersion','status','reason','inventory','state','boundary'],'envelope');
 check(raw.schemaVersion===VERSION&&['available','unavailable'].includes(raw.status),'version/availability');
 check(raw.status==='available'?raw.reason===null:typeof raw.reason==='string'&&raw.reason.length>0,'availability reason');
 const inventory=I.importState(raw.inventory);check(inventory.status==='available','public inventory snapshot');
 const state=raw.status==='available'?Q.importState(raw.state):null;
 if(state)namespace(inventory,state);else check(raw.state===null,'unavailable accounting cannot claim current duties');
 const boundary=importBoundary(raw.boundary,inventory,state);
 if(position!==undefined)check(I.bound(inventory,position),'snapshot public position');
 return seal({schemaVersion:VERSION,status:raw.status,reason:raw.reason,inventory,state,boundary});
}
function exportState(current){check(trusted.has(current),'import current context before export');return clone(current);}
function start(position,{fresh=false}={}){
 const inventory=I.start(position,{fresh});check(inventory.status==='available',inventory.reason||'initial inventory');
 return importState({schemaVersion:VERSION,status:'available',reason:null,inventory:I.exportState(inventory),state:Q.start(position,{inventory}),boundary:{firstBagLocks:inventory.originKnown?0:null,sourcePatternSeen:false}},{position});
}
function lockBoundary(current,after){
 const boundary={...current.boundary},operation={};
 // Match exactly the existing source-pattern rule: the first full board match
 // on an actual lock closes foundation; only a FIRST match at lock 7 reviews
 // bag zero. A later match must never retroactively review the first bag.
 const source=!boundary.sourcePatternSeen&&Patterns.patterns.some(p=>after.board.length===40&&after.board.every((row,i)=>row===(i<40-p.rows.length?'..........':p.rows[i-(40-p.rows.length)])));
 if(source){boundary.sourcePatternSeen=true;operation.closeFoundation=true;}
 if(boundary.firstBagLocks!==null&&boundary.firstBagLocks<7){
  boundary.firstBagLocks++;
  if(boundary.firstBagLocks===7)operation.firstBagReview=source?'reviewed':'unreviewed';
 }
 return{boundary,operation};
}
function unavailable(current,inventory,boundary,error){
 const reason=error?.message||String(error)||'Current obligation accounting failed.';
 return seal({schemaVersion:VERSION,status:'unavailable',reason,inventory,state:null,boundary:freeze({...boundary})});
}
function applyActual(current,{before,action,after,receipt,references=[]}={}){
 bound(current,before);
 const actual=receipt===undefined?I.transition(current.inventory,before,action,after):receipt;
 // Authentication failure is not an accounting transition. In particular a
 // copied/stale receipt cannot be used to install somebody else's inventory.
 check(actual.status==='available'&&I.matchesTransition(actual,current.inventory,before,action,after),'genuine current inventory receipt required');
 if(!actual.accepted)return{context:current,effects:[],receipt:actual};
 const {boundary,operation}=action==='HD'?lockBoundary(current,after):{boundary:current.boundary,operation:{}};
 if(current.status==='unavailable')return{context:unavailable(current,actual.next,boundary,current.reason),effects:[],receipt:actual};
 try{
  const result=Q.applyActual(current.state,{inventory:current.inventory,before,action,after,receipt:actual,boundary:operation,references});
  namespace(actual.next,result.state);
  const context=seal({schemaVersion:VERSION,status:'available',reason:null,inventory:actual.next,state:result.state,boundary:freeze({...boundary})});
  return{context,effects:result.effects,receipt:actual};
 }catch(error){
  return{context:unavailable(current,actual.next,boundary,error),effects:[{domain:'accounting',status:'unavailable',reason:error.message||String(error)}],receipt:actual};
 }
}
function marker(current,position,operation,references){
 bound(current,position);check(current.status==='available','accounting is unavailable; import a current checkpoint to restore it');
 const publicContext={position,inventory:current.inventory};
 const result=Q.transition(current.state,operation,{before:publicContext,after:publicContext,references});
 namespace(current.inventory,result.state);
 return{context:seal({...current,state:result.state}),effects:result.effects};
}
function handoff(current,{position,references=[]}={}){return marker(current,position,{kind:'handoff'},references);}
function beginReset(current,{position,candidate,references=[]}={}){return marker(current,position,{kind:'begin-reset',candidate},references);}
function resolve(current,{position}={}){
 bound(current,position);
 if(current.status==='unavailable')return{status:'unavailable',reason:current.reason,availability:'unavailable'};
 return{status:'available',reason:null,...Q.resolve(current.state,{position,inventory:current.inventory})};
}
// A whole-turn caller can save one of these before its first HOLD/movement and
// later restore it. No receipt chain, turn grouping, stack or retention cap is
// imposed here, and the exact active pose and last lock event are preserved.
function snapshot(current,{position}={}){bound(current,position);return freeze({schemaVersion:VERSION,position:clone(position),context:exportState(current)});}
function restore(raw){
 shape(raw,['schemaVersion','position','context'],'caller snapshot');check(raw.schemaVersion===VERSION,'caller snapshot version');
 const position=clone(raw.position),context=importState(raw.context,{position});
 return{position:freeze(position),context};
}
return Object.freeze({VERSION,start,applyActual,handoff,beginReset,resolve,snapshot,restore,importState,exportState});
});
