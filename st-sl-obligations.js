/* Current S/L counterpart consequences, not a piece or closed-event history.
 * Shared factual component. Request assessment separately preserves exact
 * identity distinctions needed for admission, binding and fixed-root comparison;
 * aggregate counts alone do not replace those current relationships.
 *
 * The caller supplies public inventory, exact current Center duties, this
 * lock's Center effects/pairs and opening boundary facts. It owns validation of
 * actual moves, exactly-once transactions, plan references and Undo. Boundary
 * facts are closeFoundation (first source pattern/TSD, or handoff) and the
 * firstBagReview decision made at lock seven. No milestones/timestamps, boards,
 * inventory copies, receipts, historical pieces or closure archive are stored.
 *
 * A residual lives until BOTH partners were consumed and no exact target, live
 * caller reference or first-bag exemption decision can distinguish it. Its dead
 * uncertainty then becomes a fixed type/severity count. Before handoff those
 * counts describe both-consumed opening bags, so the existing handoff rule
 * exempts them all. After handoff they remain adverse current consequences.
 * Compaction is not payment. Effects preserve newly introduced exact identities
 * for request-local comparisons, even when that identity immediately compacts.
 *
 * Current Context and projected routes share these facts. Resource history,
 * slHistory reconstruction and allocation archives are retired. Planner/Reset
 * admission and badge/explanation consumers use count-aware current selectors
 * plus request-local effects; replacing exact current identities with aggregate
 * counts alone would change policy. Opening
 * and profile/account eligibility remain caller-owned. This module grants no
 * repair capability, admission or new opening/Reset allowance.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STSLObligations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),TYPES='IJLOSTZ';
const emptyCounts=()=>({S:[0,0,0,0],L:[0]});
const region=e=>e.cells.every(([x])=>x<4)?'left':e.cells.every(([x])=>x>=4&&x<7)?'center':e.cells.every(([x])=>x<7)?'left-center':e.cells.every(([x])=>x>=7)?'right':'cross-right';
const live=inventory=>[inventory.active,inventory.hold,...inventory.queue].filter(Boolean);
const pending=(center,family,id)=>id!==undefined&&center.pending.some(p=>p.family===family&&p.rootId===id);
const severity=e=>(e.requiresAccommodation?1:0)+(e.invalidated?2:0);
const sum=(values,addition=0)=>{let total=addition;for(const value of values){if(!Number.isSafeInteger(value)||value<0||value>Number.MAX_SAFE_INTEGER-total)throw Error('S/L uncertainty total exceeds the exact integer range.');total+=value;}return total;};
const uncertaintyKey=p=>p?.category==='unclassified'?JSON.stringify([p.sId??null,p.lId??null,p.bag]):null;
function start({known=false}={}){return{schemaVersion:1,status:known?'known':'unknown',foundationOpen:true,firstBagReview:'pending',handoff:false,residuals:[],uncertainty:emptyCounts()};}
// Trusted current snapshots: validate structure and reference consistency, not
// their producing moves, geometry or provenance. Import/export never classify,
// compact, infer an exemption, or require a history. Unknown schema-1 state has
// no classified facts; partial known-record transport needs a separate schema.
// Throwing leaves installation atomic and lets the caller report unavailable
// accounting instead of silently dropping a malformed or unrepresentable fact.
function readState(raw,projected=false){
 const fail=reason=>{throw Error('Invalid S/L snapshot: '+reason);};
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const bool=(v,name)=>{if(typeof v!=='boolean')fail(name+' must be boolean.');return v;};
 const number=(v,name,min=0)=>{if(!Number.isSafeInteger(v)||v<min)fail(name+' must be a nonnegative safe integer.');return v===0?0:v;};
 const choice=(v,values,name)=>{if(!values.includes(v))fail('Unknown '+name+'.');return v;};
 if(!object(raw)||raw.schemaVersion!==1||(projected?raw.domain!=='projection':raw.domain!==undefined))fail('Unsupported schema/domain.');
 const state={schemaVersion:1,...(projected?{domain:'projection'}:{}),status:choice(raw.status,['known','unknown'],'availability'),foundationOpen:bool(raw.foundationOpen,'foundationOpen'),firstBagReview:choice(raw.firstBagReview,['pending','reviewed','unreviewed'],'first-bag review'),handoff:bool(raw.handoff,'handoff'),residuals:[],uncertainty:emptyCounts()};
 if(state.handoff&&state.foundationOpen)fail('A handed-off state cannot have an open foundation phase.');
 if(!Array.isArray(raw.residuals)||!object(raw.uncertainty))fail('Missing current residuals or uncertainty.');
 for(const kind of ['S','L']){
  const counts=raw.uncertainty[kind];if(!Array.isArray(counts)||counts.length!==(kind==='S'?4:1))fail('Invalid '+kind+' uncertainty categories.');
  state.uncertainty[kind]=Array.from(counts,n=>number(n,kind+' uncertainty'));
  try{sum(state.uncertainty[kind]);}catch{fail(kind+' uncertainty total exceeds the exact integer range.');}
 }
 const bags=new Set(),ids=new Set();
 const disposition=(p,type)=>{
  if(p===null)return null;if(!object(p))fail('Missing '+type+' disposition.');
  const id=number(p.id,type+' subject',1);if(ids.has(id))fail('Duplicate subject reference.');ids.add(id);
  const out={id,region:choice(p.region,['left','center','left-center','right','cross-right'],'region'),opening:bool(p.opening,'opening allocation'),pair:choice(p.pair,type==='S'?[null,'same','foreign']:[null,'same','foreign','LO'],'pair disposition')};
  if(type==='S')for(const key of ['foundationEligible','firstBagEligible','requiresAccommodation','invalidated'])out[key]=bool(p[key],key);
  else{out.nonRight=bool(p.nonRight,'nonRight');if(out.nonRight!==['left','center','left-center'].includes(out.region))fail('L region and nonRight disagree.');}
  return out;
 };
 for(const value of raw.residuals){
  if(!object(value))fail('Invalid counterpart record.');
  const bag=number(value.bag,'bag');if(bags.has(bag))fail('Duplicate bag relationship.');bags.add(bag);
  const b={bag,S:disposition(value.S,'S'),L:disposition(value.L,'L'),order:choice(value.order,[null,'S-first','L-first'],'same-bag order'),sOwedSinceL:bool(value.sOwedSinceL,'sOwedSinceL'),lBeforeSPair:bool(value.lBeforeSPair,'lBeforeSPair')};
  if(!b.S&&!b.L)fail('Empty counterpart relationship.');
  if(Boolean(b.S&&b.L)!==(b.order!==null))fail('Same-bag order lacks its consumed counterparts.');
  if(b.sOwedSinceL&&(!b.S||!b.L))fail('Owed-since-L lacks its consumed counterparts.');
  if(b.lBeforeSPair&&(!b.L||b.S?.pair!=='foreign'))fail('Pair-order flag lacks its foreign-paired S and consumed L.');
  if(b.S?.pair==='same'&&(!b.L||!['same','LO'].includes(b.L.pair))||b.L?.pair==='same'&&b.S?.pair!=='same')fail('Same-bag pairing references disagree.');
  state.residuals.push(b);
 }
 if(state.status==='unknown'&&(state.residuals.length||[...state.uncertainty.S,...state.uncertainty.L].some(n=>n!==0)))fail('Unknown state cannot carry classified facts in this schema.');
 return state;
}
function importState(raw){return readState(raw);}
function importProjection(raw){return readState(raw,true);}
function exportState(state){return importState(state);}
// Only private normalized snapshots carry this identity. Public codecs still
// return detached mutable data, including when their input is owned.
const ownedProjections=new WeakSet();
const freezeProjection=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freezeProjection);Object.freeze(x);}return x;};
function ownProjection(raw){if(ownedProjections.has(raw))return raw;const state=importProjection(raw);freezeProjection(state);ownedProjections.add(state);return state;}
function copyProjection(state){return{...state,residuals:state.residuals.map(b=>({...b,S:b.S?{...b.S}:null,L:b.L?{...b.L}:null})),uncertainty:{S:state.uncertainty.S.slice(),L:state.uncertainty.L.slice()}};}
function projectTransitionOwned(current,operation,context){
 if(!ownedProjections.has(current))return projectTransition(current,operation,context);
 const result=reduce(current,operation,context,true,true);
 return{state:ownProjection(result.state),effects:result.effects};
}
function resolveProjectionOwned(state,context){return ownedProjections.has(state)?resolveState(state,context):resolveProjection(state,context);}

function counterpart(b,type,inventory){
 const used=b[type];if(used)return used;
 const p=live(inventory).find(p=>p.type===type&&p.bag===b.bag);if(p)return p;
 const f=inventory.frontier,seen=f&&(b.bag<f.bag||b.bag===f.bag&&(f.seenMask&(1<<TYPES.indexOf(type))));
 if(seen)throw Error('Missing consumed '+type+' consequence for observed bag '+b.bag+'.');
 return null;
}
function classifyBag(state,b,{inventory,center}){
 const s=b.S,l=b.L,sp=counterpart(b,'S',inventory),lp=counterpart(b,'L',inventory),out={S:null,L:null};
 const inheritedS=state.handoff&&s?.opening,inheritedL=state.handoff&&l?.opening;
 if(inheritedS&&inheritedL)return out;
 if(l){
  const owed=pending(center,'SL',s?.id)||b.sOwedSinceL;
  const foundation=!inheritedL&&s?.region==='center'&&s.foundationEligible&&b.order==='S-first'&&!owed&&!s.pair;
  if(!foundation&&s?.region!=='left'&&!s?.pair){
   const diverted=inheritedL||l.nonRight&&l.pair!=='same';
   if(diverted){
    const common={bag:b.bag,sId:sp?.id??null,lId:l.id};
    if(s&&!pending(center,'SL',s.id)){
     const reviewed=b.bag===0&&state.firstBagReview==='reviewed'&&s.firstBagEligible;
     out.S={category:'unclassified',...common,...(s.requiresAccommodation&&!reviewed?{requiresAccommodation:true}:{}),...(s.invalidated?{invalidated:true}:{})};
    }else out.S={category:'hanging',...common,...(!sp?{deferred:true}:{})};
   }else if(l.region!=='center'||!['same','foreign'].includes(l.pair))out.S={category:'unclassified',bag:b.bag,lId:l.id};
  }
 }
 if(s&&l?.region!=='left'&&!['same','foreign','LO'].includes(l?.pair)){
  const earlier=l&&(inheritedS||!s.pair?b.order==='L-first':b.lBeforeSPair);
  const diverted=inheritedS||s.region==='left'||s.pair==='foreign';
  if(!earlier&&diverted){
   const common={bag:b.bag,lId:lp?.id??null,sId:s.id},lo=pending(center,'LO',l?.id);
   out.L=l&&!lo?{category:'unclassified',...common}:{category:'hanging',...common,...(!lp?{deferred:true}:{}),...(lo?{pendingAccommodation:'LO'}:{})};
  }
 }
 return out;
}
function classify(state,context){return new Map(state.residuals.map(b=>[b.bag,classifyBag(state,b,context)]));}
function resolveState(state,{inventory,center,profileLost=false}){
 const classified=state.status==='known'?classify(state,{inventory,center}):new Map(),result={};
 for(const kind of ['S','L']){
  const all=[...classified.values()].map(p=>p[kind]).filter(Boolean);
  const evidence=all.filter(p=>p.category==='hanging').map(({category,...p})=>p);
  const unclassified=all.filter(p=>p.category==='unclassified').map(({category,...p})=>p),aggregate=state.uncertainty[kind].slice();
  const count=sum(aggregate,unclassified.length);
  result['hanging'+kind]={status:state.status!=='known'?'unknown':profileLost||evidence.length>1?'out-of-profile':evidence.length?'hanging':count?'unknown':'none-observed',evidence,unclassified,aggregate,unclassifiedCount:count};
 }
 return result;
}
function resolve(state,context){if(state.domain!==undefined)throw Error('Projected S/L state requires the projection selector.');return resolveState(state,context);}
function resolveProjection(state,context){return resolveState(importProjection(state),context);}
function validateContext(context){
 for(const side of ['before','after']){
  const c=context?.[side];if(!c?.inventory||!Array.isArray(c.inventory.queue)||!Array.isArray(c.center?.pending)||!Array.isArray(c.center?.debt))throw Error('Missing current public '+side+' context.');
 }
}
function reduce(current,operation,context,projected=false,owned=false){
 const copy=owned?copyProjection:clone;
 validateContext(context);
 if(projected?current.domain!=='projection':current.domain!==undefined)throw Error('Invalid S/L transition domain.');
 if(!['lock','observe','handoff'].includes(operation?.kind))throw Error('Unknown S/L operation.');
 if(current.status!=='known')return{state:copy(current),effects:[]};
 if(!context.before.inventory.originKnown||!context.after.inventory.originKnown||!context.before.inventory.frontier||!context.after.inventory.frontier)throw Error('Known S/L facts require known public identities and frontier.');
 if(operation.kind==='handoff'&&current.handoff)return{state:copy(current),effects:[]};
 const before=classify(current,context.before),state=copy(current),effects=[];
 if(operation.kind==='handoff'){
  state.handoff=true;state.foundationOpen=false;
  if([...state.uncertainty.S,...state.uncertainty.L].some(n=>n!==0))effects.push({status:'opening-exempted',counts:clone(state.uncertainty)});
  state.uncertainty=emptyCounts();
 }
 if(operation.kind==='lock'){
  const {piece,event}=operation;
  if(!piece||piece.type!==event?.type||!(Number.isInteger(piece.bag)||projected&&piece.bag===null)||!Number.isInteger(piece.id)||!(piece.id>0||projected&&piece.id<0&&piece.bag===null)||!Array.isArray(event.cells)||event.cells.length!==4||!(context.before.inventory.active?.id===piece.id&&context.before.inventory.active.type===piece.type&&context.before.inventory.active.bag===piece.bag))throw Error('Missing or mismatched public locked identity.');
  let bag=state.residuals.find(b=>b.bag===piece.bag);
  // Unknown projected origin never becomes a same-bag relationship. Still
  // process its exact Center payment/loss below against every known root.
  if('SL'.includes(piece.type)&&piece.bag!==null){
   if(!bag){bag={bag:piece.bag,S:null,L:null,order:null,sOwedSinceL:false,lBeforeSPair:false};state.residuals.push(bag);}
   if(bag[piece.type])throw Error('The same bag/type was already consumed.');
   // Check the counterpart before mutating: absence is deferred only if it has
   // not crossed the caller's public frontier. Do not invent a lost identity.
   counterpart(bag,piece.type==='S'?'L':'S',context.before.inventory);
   const allocation={id:piece.id,region:region(event),opening:!state.handoff,pair:null};
   if(piece.type==='S')Object.assign(allocation,{foundationEligible:state.foundationOpen,firstBagEligible:state.firstBagReview==='pending',requiresAccommodation:false,invalidated:false});
   else allocation.nonRight=event.cells.every(([x])=>x<7);
   bag[piece.type]=allocation;
   if(bag.S&&bag.L)bag.order=piece.type==='S'?'L-first':'S-first';
  }
  for(const pair of operation.pairs||[]){
   if(pair.partnerId!==piece.id)throw Error('Center pair does not belong to this lock.');
   if(pair.family==='SL'){
    if(piece.type!=='L')throw Error('An SL pair must consume L.');
    const root=state.residuals.find(b=>b.S?.id===pair.rootId);
    if(root){root.S.pair=root.bag===piece.bag?'same':'foreign';root.lBeforeSPair=Boolean(root.L&&root.L.id!==piece.id);}
    if(bag?.L&&piece.type==='L')bag.L.pair=bag.S?.id===pair.rootId?'same':'foreign';
   }else if(pair.family==='LO'){
    if(piece.type!=='O')throw Error('An LO pair must consume O.');
    const root=state.residuals.find(b=>b.L?.id===pair.rootId);if(root)root.L.pair='LO';
   }
  }
  for(const e of operation.centerEffects||[]){
   if(e.family!=='SL')continue;
   const root=state.residuals.find(b=>b.S?.id===e.rootId);if(!root)continue;
   if(!['created','diverted'].includes(e.status)&&root.L)root.sOwedSinceL=true;
   if(e.status==='invalidated')root.S.invalidated=true;
  }
  if(bag?.L&&pending(context.after.center,'SL',bag.S?.id))bag.sOwedSinceL=true;
  if(piece.type==='S'&&before.get(piece.bag)?.S?.category==='hanging'&&bag.S.region!=='left'&&!bag.S.pair&&!pending(context.after.center,'SL',piece.id))bag.S.requiresAccommodation=true;
 }
 if(operation.closeFoundation)state.foundationOpen=false;
 if(operation.firstBagReview!==undefined){
  if(!['reviewed','unreviewed'].includes(operation.firstBagReview)||state.firstBagReview!=='pending'&&state.firstBagReview!==operation.firstBagReview)throw Error('Invalid first-bag review boundary.');
  state.firstBagReview=operation.firstBagReview;
 }
 const after=classify(state,context.after);
 // Import cannot classify retained records without caller context. Once it is
 // supplied, validate the reported total before publishing any changed state,
 // including uncertainty that stays exact because a target/plan retains it.
 for(const kind of ['S','L'])sum(state.uncertainty[kind],[...after.values()].filter(f=>f[kind]?.category==='unclassified').length);
 for(const bag of new Set([...before.keys(),...after.keys()]))for(const kind of ['S','L']){
  const old=before.get(bag)?.[kind]??null,next=after.get(bag)?.[kind]??null;
  if(JSON.stringify(old)!==JSON.stringify(next))effects.push({status:'classification-changed',kind,bag,before:clone(old),after:clone(next),cause:operation.kind,introducedUnclassified:next?.category==='unclassified'&&uncertaintyKey(old)!==uncertaintyKey(next),knownToUnclassified:old?.category==='hanging'&&next?.category==='unclassified'});
 }
 const refs=new Set(context.references||[]),targets=new Set([...context.after.center.pending,...context.after.center.debt].map(p=>p.rootId));
 state.residuals=state.residuals.filter(b=>{
  if(!b.S||!b.L||targets.has(b.S.id)||targets.has(b.L.id)||refs.has(b.S.id)||refs.has(b.L.id)||b.bag===0&&state.firstBagReview==='pending')return true;
  for(const kind of ['S','L']){
   const fact=after.get(b.bag)?.[kind];
   if(fact?.category==='hanging')throw Error('A hanging consequence lost its live dependency.');
   if(fact){const index=kind==='S'?severity(fact):0;sum(state.uncertainty[kind],1);state.uncertainty[kind][index]++;effects.push({status:'compacted',kind,subject:clone(fact),severity:index});}
  }
  return false;
 });
 return{state,effects};
}
function transition(current,operation,context){return reduce(current,operation,context);}
function projectTransition(current,operation,context){const result=reduce(importProjection(current),operation,context,true);return{state:importProjection(result.state),effects:result.effects};}
return Object.freeze({ownProjection,projectTransitionOwned,resolveProjectionOwned,start,transition,projectTransition,resolve,resolveProjection,importState,importProjection,exportState});
});
