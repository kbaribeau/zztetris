/* Request-local factual projection and supply. This is not an actual
 * inventory, receipt, persisted session or route-admission decision. Observed
 * subjects retain their original positive identity/bag. A publicly forced or
 * identity-unavailable subject is negative, with no invented original bag.
 *
 * The observed frontier never advances here. Only request-local bag knowledge
 * consumes a unique forced deduction. HOLD changes possession before a lock
 * is identified. All factual changes use the shared explicit projection codec;
 * actual imports reject this domain even when every subject is observed.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-bag'),require('./st-public-inventory'),require('./st-obligation-state')):factory(root.STRules,root.STBag,root.STPublicInventory,root.STObligationState);if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationProjection=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,I,Q){
'use strict';
const TYPES='IJLOSTZ',clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(ok,reason)=>{if(!ok)throw Error('Invalid obligation projection: '+reason);};
const integer=Number.isSafeInteger,object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function shape(x,keys,label){check(object(x)&&Object.keys(x).length===keys.length&&keys.every(key=>Object.prototype.propertyIsEnumerable.call(x,key)),label+' shape');}
function knowledge(raw){
 if(raw===null)return null;
 check(object(raw)&&Array.isArray(raw.remaining)&&raw.remaining.length<=128&&raw.remaining.every(n=>integer(n)&&n>=0&&n<=127)&&new Set(raw.remaining).size===raw.remaining.length,'bag knowledge');
 check(raw.error?['contradictory-observed-stream','invalid-bag-knowledge'].includes(raw.error)&&raw.remaining.length===0:raw.remaining.length>0,'bag knowledge availability');
 if(!raw.error)check(integer(raw.observedCount??0)&&(raw.observedCount??0)>=0&&typeof(raw.provenance??'observed')==='string'&&(raw.provenance??'observed').length<=128,'bag knowledge metadata');
 return clone(raw);
}
function readSupply(raw){
 shape(raw,['schemaVersion','domain','originKnown','nextObservedId','nextSyntheticId','streamCursor','active','hold','queue','frontier','knowledge'],'supply');
 check(raw.schemaVersion===1&&raw.domain==='projection'&&typeof raw.originKnown==='boolean','supply domain');
 check(integer(raw.nextObservedId)&&raw.nextObservedId>0&&integer(raw.nextSyntheticId)&&raw.nextSyntheticId<0&&integer(raw.streamCursor)&&raw.streamCursor>=0,'supply allocators/cursor');
 check(Array.isArray(raw.queue)&&raw.queue.length<=7,'request preview');
 const ids=new Set();
 const subject=p=>{
  if(p===null)return null;
  shape(p,['id','type','bag','observedOrder'],'subject');
  check(integer(p.id)&&p.id!==0&&!ids.has(p.id)&&typeof p.type==='string'&&p.type.length===1&&TYPES.includes(p.type),'subject identity/type');ids.add(p.id);
  if(p.id<0)check(p.id>raw.nextSyntheticId&&p.bag===null&&p.observedOrder===null,'synthetic subject origin');
  else{
   check(p.id<raw.nextObservedId,'observed allocator');
   check(raw.originKnown?integer(p.bag)&&p.bag>=0&&integer(p.observedOrder)&&p.observedOrder>=0:p.bag===null&&p.observedOrder===null,'observed subject origin');
  }
  return clone(p);
 };
 let frontier=null;
 if(raw.originKnown){shape(raw.frontier,['bag','seenMask'],'observed frontier');check(integer(raw.frontier.bag)&&raw.frontier.bag>=0&&integer(raw.frontier.seenMask)&&raw.frontier.seenMask>=0&&raw.frontier.seenMask<127,'observed frontier');frontier=clone(raw.frontier);}
 else check(raw.frontier===null,'unknown observed frontier');
 const supply={schemaVersion:1,domain:'projection',originKnown:raw.originKnown,nextObservedId:raw.nextObservedId,nextSyntheticId:raw.nextSyntheticId,streamCursor:raw.streamCursor,active:subject(raw.active),hold:subject(raw.hold),queue:raw.queue.map(p=>{check(p!==null,'missing queued subject');return subject(p);}),frontier,knowledge:knowledge(raw.knowledge)};
 if(frontier)for(const p of [supply.active,supply.hold,...supply.queue].filter(p=>p&&p.id>0))check(p.bag<frontier.bag||p.bag===frontier.bag&&Boolean(frontier.seenMask&(1<<TYPES.indexOf(p.type))),'observed subject exceeds frontier');
 return supply;
}
function bound(supply,position){
 check(R.validate(position).length===0,'public position');
 check(supply.streamCursor===position.streamCursor&&(supply.active?.type??null)===(position.active?.type??null)&&(supply.hold?.type??null)===(position.hold??null)&&same(supply.queue.map(p=>p.type),position.queue),'position/supply boundary');
}
// Same current-role checks as actual Context, but the negative allocator is a
// disjoint request namespace. No consumed history or original-bag guess needed.
function namespace(state,supply){
 const live=new Set([supply.active,supply.hold,...supply.queue].filter(Boolean).map(p=>p.id)),roles=new Map();
 const rootTypes={SL:'S',LO:'L',OJ:'O',ZJ:'JZ'},partnerTypes={SL:'L',LO:'O',OJ:'J',ZJ:'JZ'};
 const consumed=(id,types)=>{
  if(id===null)return;
  check(integer(id)&&id!==0&&(id>0?id<supply.nextObservedId:id>supply.nextSyntheticId)&&!live.has(id),'consumed subject collides with supply/allocator');
  const compatible=[...(roles.get(id)||types)].filter(t=>types.includes(t)).join('');check(compatible.length>0,'contradictory consumed subject roles');roles.set(id,compatible);
 };
 for(const b of state.sl.residuals)for(const t of ['S','L'])if(b[t])consumed(b[t].id,t);
 for(const p of [...state.center.pending,...state.center.debt]){consumed(p.rootId,rootTypes[p.family]);if(p.divertedPieceId!==undefined)consumed(p.divertedPieceId,partnerTypes[p.family]||TYPES);}
 if(state.account.reset.status==='active')consumed(state.account.reset.firstTId,'T');
 check(state.availability!=='known'||supply.originKnown,'known facts require the observed origin');
}
function read(current,{position}={}){
 check(object(current),'request state');
 const state=Q.importProjection(current.state),supply=readSupply(current.supply),p=clone(current.position);
 if(position!==undefined)check(same(position,p),'explicit position differs from request state');
 bound(supply,p);namespace(state,supply);return{state,supply,position:p};
}
// Q.projectTransition has already normalized and validated this fresh local
// state. Retain supply, position and cross-component checks without importing
// that state a second time. No caller-provided state reaches this helper.
function readTransition(state,supply,position){
 // supply is a detached copy of this call's validated supply, advanced only
 // by moving its existing subjects. position is the matching R.move result.
 // Neither is exposed to the caller until this entire witness completes.
 bound(supply,position);namespace(state,supply);return{state,supply,position};
}
function start(actualFacts,{position,inventory}={}){
 check(I.bound(inventory,position),'matching actual public inventory');
 const inv=I.exportState(inventory),supply={schemaVersion:1,domain:'projection',originKnown:inv.originKnown,nextObservedId:inv.nextId,nextSyntheticId:-1,streamCursor:inv.streamCursor,active:inv.active,hold:inv.hold,queue:inv.queue,frontier:inv.frontier,knowledge:inv.knowledge};
 return read({state:Q.toProjection(actualFacts),supply,position});
}
function startUnknown(position){
 // Establish only an explicitly unknown factual origin. I.start observes the
 // public shape but issues no operation receipt; its temporary IDs are not
 // promoted into this request's unavailable-identity fallback.
 const inventory=I.start(position);check(inventory.status==='available','unknown public origin');
 const projection=start(Q.start(position,{inventory}),{position,inventory});let next=-1;
 const subject=p=>p?{id:next--,type:p.type,bag:null,observedOrder:null}:null;
 projection.supply.active=subject(projection.supply.active);projection.supply.hold=subject(projection.supply.hold);projection.supply.queue=projection.supply.queue.map(subject);projection.supply.nextObservedId=1;projection.supply.nextSyntheticId=next;
 return read(projection);
}
function extendLocal(projection){
 const {supply,position}=projection,type=supply.knowledge&&!supply.knowledge.error?B.forcedNext(supply.knowledge):null;
 if(!type)return projection;
 check(supply.queue.length<7,'forced request preview');
 const id=supply.nextSyntheticId--;check(integer(supply.nextSyntheticId),'synthetic identity range exhausted');
 supply.queue.push({id,type,bag:null,observedOrder:null});supply.knowledge=B.consume(supply.knowledge,type);
 position.queue.push(type);position.bag=clone(supply.knowledge);
 // A deduction is not a newly observed identity. It cannot change the known
 // S/L counterpart frontier or create an actual inventory capability.
 return read(projection);
}
function extendForced(current,options={}){return extendLocal(read(current,options));}
function project(current,{position,witness,boundary={},references=[],extendForced=false,resolveView=false}={}){
 check(typeof extendForced==='boolean'&&typeof resolveView==='boolean','local output options');
 let projection=read(current,{position});const out=[];let locked=null;
 // Public getters/serialization hooks can change values during the first read.
 // Admit only the detached, revalidated result to this private local path.
 projection.supply=readSupply(projection.supply);
 check(Array.isArray(witness)&&witness.length>0&&witness.length<=256&&witness.at(-1)==='HD'&&witness.filter(a=>a==='HD').length===1,'one-lock witness');
 for(const action of witness){
  const before=projection,after=R.move(before.position,action);check(after!==before.position,'rejected projected input');
  // Existing subjects, frontier and knowledge stay read-only within this
  // call. Only possession, the copied queue and the cursor advance.
  const supply={...before.supply,queue:before.supply.queue.slice()};
  if(action==='HOLD'){if(supply.hold)[supply.active,supply.hold]=[supply.hold,supply.active];else{supply.hold=supply.active;supply.active=supply.queue.shift();check(supply.active,'missing projected HOLD draw');}}
  if(action==='HD'){locked=supply.active;supply.active=after.active?supply.queue.shift():null;check(!after.active||supply.active,'missing projected lock draw');}
  supply.streamCursor=after.streamCursor;bound(supply,after);
  const operation=action==='HD'?{...boundary,kind:'lock',piece:locked,event:after.lastEvent}:{kind:'observe'};
  const result=Q.projectTransition(before.state,operation,{before:{position:before.position,inventory:before.supply},after:{position:after,inventory:supply},references});
  projection=readTransition(result.state,supply,after);out.push(...result.effects);
 }
 // These are fresh local values; combining their optional extension/view
 // avoids routing them back through public imports between adjacent steps.
 if(extendForced)projection=extendLocal(projection);
 const view=resolveView?Q.resolveProjection(projection.state,{position:projection.position,inventory:projection.supply}):null;
 return{...projection,effects:out,locked:clone(locked),...(resolveView?{view}:{})};
}
function resolve(current,options){
 const projection=read(current,options);
 return Q.resolveProjection(projection.state,{position:projection.position,inventory:projection.supply});
}
return Object.freeze({start,startUnknown,extendForced,project,resolve});
});
