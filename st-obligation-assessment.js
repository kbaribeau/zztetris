/* UNWIRED request-local policy assessment for projected current obligations.
 * The caller owns factual accounting, supply, replay, phase and admission.
 * This module retains only a fixed request root and the current bounded plan
 * dependencies. It stores no board, inventory, event/closure tape or receipts.
 * Compaction is not payment. Exact one-operation effects reconcile current
 * uncertainty; anonymous root buckets never acquire invented identities.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-obligation-admission'),require('./st-center-obligations'),require('./st-structure')):factory(root.STObligationAdmission,root.STCenterObligations,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationAssessment=api;})(typeof globalThis!=='undefined'?globalThis:this,function(A,C,S){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),kinds=['S','L'];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const empty=()=>({S:[0,0,0,0],L:[0]});
const check=(ok,reason)=>{if(!ok)throw Error('Invalid obligation assessment: '+reason);};
const idKey=kind=>kind==='S'?'sId':'lId',severity=p=>(p.requiresAccommodation?1:0)+(p.invalidated?2:0);
const live=supply=>[supply?.active,supply?.hold,...(supply?.queue||[])].filter(Boolean);
const subjectId=n=>Number.isSafeInteger(n)&&n!==0;
const cellKey=cells=>JSON.stringify(cells.slice().sort(([x,y],[u,v])=>x-u||y-v));
const left=e=>e.cells.every(([x])=>x<4),center=e=>e.cells.every(([x])=>x>=4&&x<7),nonRight=e=>e.cells.every(([x])=>x<7);
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&S.canonicalClear(e);
const fact=p=>{const {category,...out}=clone(p);return out;};
const exactKey=(kind,p)=>A.uncertaintyKey(kind,p);
function counts(value,kind){
 check(Array.isArray(value)&&value.length===(kind==='S'?4:1),'uncertainty bucket shape');let total=0;
 for(const n of value){check(Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER-total,'uncertainty bucket total');total+=n;}
 return value.slice();
}
function classified(view){
 const out={hanging:{S:[],L:[]},uncertain:{S:[],L:[]},anonymous:empty()};
 for(const kind of kinds){
  const source=view?.['hanging'+kind];check(!Array.isArray(source),'current compact classification required');
  const u=A.uncertainty(view,kind);check(Number.isSafeInteger(u.count),'uncertainty total');out.anonymous[kind]=counts(u.aggregate,kind);
  out.hanging[kind]=clone(source?.evidence||[]);out.uncertain[kind]=u.named.map(p=>({key:exactKey(kind,p),fact:p,storage:'named'}));
  check(new Set(out.uncertain[kind].map(p=>p.key)).size===out.uncertain[kind].length,'duplicate current uncertainty');
 }
 return out;
}
function rootBag(p,state,supply){
 if(p.rootBag!==undefined)return p.rootBag;
 const type=p.family==='SL'?'S':p.family==='LO'?'L':null;
 const b=type&&state?.sl?.residuals?.find(b=>b[type]?.id===p.rootId);
 return b?b.bag:live(supply).find(s=>s.id===p.rootId)?.bag??null;
}
function start(view,{supply,state,horizon=7,planReferences=[]}={}){
 check(Number.isSafeInteger(horizon)&&horizon>0,'finite request horizon');
 check(Array.isArray(planReferences)&&planReferences.every(subjectId),'plan references');
 const current=classified(view),pendingCenter=(view?.center?.pending||[]).map(p=>({rootId:p.rootId,bag:rootBag(p,state,supply),family:p.family,alternatives:clone(p.alternatives),created:false}));
 const dutyIds=kinds.flatMap(kind=>current.hanging[kind].flatMap(p=>[p.sId,p.lId]));
 const uncertainIds=kinds.flatMap(kind=>current.uncertain[kind].flatMap(p=>[p.fact.sId,p.fact.lId]));
 const root={uncertaintyKeys:kinds.flatMap(kind=>current.uncertain[kind].map(p=>p.key)).sort(),anonymous:clone(current.anonymous),
  duties:{center:pendingCenter.map(p=>({rootId:p.rootId})),S:current.hanging.S.map(p=>({id:p.sId??null,bag:p.bag})),L:current.hanging.L.map(p=>({id:p.lId??null,bag:p.bag}))},
  references:[...new Set([...planReferences,...dutyIds,...uncertainIds,...pendingCenter.map(p=>p.rootId)].filter(subjectId))].sort((a,b)=>a-b)};
 const z=view?.extraZ||{},reset=view?.reset||{};check(reset.status!=='active'||[0,1].includes(reset.progress),'active Reset progress');
 return{schemaVersion:1,horizon,root,current,pendingCenter,pendingLDiverted:false,
  z:{status:z.status||'unknown',remaining:Number.isSafeInteger(z.remaining)?z.remaining:null},
  reset:{active:reset.status==='active',progress:reset.status==='active'?reset.progress||0:0,completed:false},
  schedule:{locks:0,tsds:[],quads:[]},violations:[]};
}
// Effects describe the immediate transition BEFORE GC. A tagged compacted row
// is still a current consequence, never another aggregate count or an archive.
function reconcile(prior,view,effects){
 const after=classified(view),out=clone(prior),maps=Object.fromEntries(kinds.map(k=>[k,new Map(out.uncertain[k].map(p=>[p.key,p]))]));
 for(const e of effects.filter(e=>e.domain===undefined||e.domain==='sl')){
  if(e.status==='opening-exempted'){
   out.anonymous=empty();for(const kind of kinds)for(const [key,row]of maps[kind])if(row.storage==='compacted')maps[kind].delete(key);
  }else if(e.status==='classification-changed'&&kinds.includes(e.kind)){
   const map=maps[e.kind];if(e.before?.category==='unclassified')map.delete(exactKey(e.kind,e.before));
   if(e.after?.category==='unclassified'){const p=fact(e.after),key=exactKey(e.kind,p);map.set(key,{key,fact:p,storage:'named'});}
  }else if(e.status==='compacted'&&kinds.includes(e.kind)){
   check(e.subject?.category==='unclassified','compaction must retain an uncertain consequence');
   const p=fact(e.subject),key=exactKey(e.kind,p);maps[e.kind].set(key,{key,fact:p,storage:'compacted'});
  }
 }
 for(const kind of kinds){
  for(const [key,row]of maps[kind])if(row.storage==='named')maps[kind].delete(key);
  for(const row of after.uncertain[kind]){check(!maps[kind].has(row.key),'uncertainty both named and compacted');maps[kind].set(row.key,row);}
  out.uncertain[kind]=[...maps[kind].values()].sort((a,b)=>a.key.localeCompare(b.key));out.hanging[kind]=after.hanging[kind];
  const total=out.anonymous[kind].slice();for(const row of out.uncertain[kind])if(row.storage==='compacted')total[kind==='S'?severity(row.fact):0]++;
  counts(total,kind);check(JSON.stringify(total)===JSON.stringify(after.anonymous[kind]),'unexplained '+kind+' aggregate change; exact operation effects required');
 }
 return out;
}
function matchesCurrent(current,view){
 const input=classified(view);
 for(const kind of kinds){
  const exact=current.uncertain[kind].filter(p=>p.storage==='named').slice().sort((a,b)=>a.key.localeCompare(b.key));
  check(same(exact,input.uncertain[kind].slice().sort((a,b)=>a.key.localeCompare(b.key)))&&same(current.hanging[kind],input.hanging[kind]),'before '+kind+' classification mismatch');
  const aggregate=current.anonymous[kind].slice();for(const row of current.uncertain[kind])if(row.storage==='compacted')aggregate[kind==='S'?severity(row.fact):0]++;
  check(same(aggregate,input.anonymous[kind]),'before '+kind+' aggregate mismatch');
 }
}
function advanceCenter(prior,before,after,event,locked){
 const frame=C.frame(before.board,after.board,event,prior),finished=prior.filter(p=>C.inspect(p,frame).finished);
 const pending=prior.filter(p=>!finished.includes(p)).map(p=>{const r=C.inspect(p,frame);return r.removed?null:{...clone(p),alternatives:r.alternatives,lost:Boolean(p.lost)||!r.live.length};}).filter(Boolean);
 if(center(event)&&!event.lines&&S.CENTER_PAIRS[event.type]){
  const alternatives=C.completions(after.board,[],event.type);
  if(alternatives.length&&!pending.some(p=>cellKey(p.alternatives[0].cells)===cellKey(alternatives[0].cells)))pending.push({rootId:locked.id,bag:locked.bag??null,family:S.centerPairFamily(event.type),alternatives,created:true});
 }
 return{pending,finished,diverted:event.type==='L'&&prior.some(p=>p.family==='SL'&&!p.lost&&!finished.some(f=>f.rootId===p.rootId))};
}
function transition(current,{before,after,locked,event=after?.position?.lastEvent,effects=[]}={}){
 check(current?.schemaVersion===1&&current.schedule.locks<current.horizon,'request horizon exhausted');
 check(before?.position?.board&&after?.position?.board&&before.view&&after.view,'before/after current facts and positions');
 check(locked&&subjectId(locked.id)&&locked.type===event?.type,'locked subject');
 check(Array.isArray(event.cells)&&event.cells.length===4&&Array.isArray(effects),'event/effects');
 matchesCurrent(current.current,before.view);
 const state=clone(current),reject=reason=>{if(!state.violations.includes(reason))state.violations.push(reason);};
 const count=++state.schedule.locks,wasReset=state.reset.active;
 if(event.type==='T'){
  if(wasReset){
   if(event.lines===0&&left(event)&&state.reset.progress<2){
    state.reset.progress++;if(state.z.remaining!==null)state.z.remaining++;
    if(state.reset.progress===2){state.reset.active=false;state.reset.completed=true;}
   }else reject('reset-T-must-be-zero-clear-Left');
  }else if(tsd(event))state.schedule.tsds.push({at:count,pieceId:locked.id});else reject('ordinary-T-must-score');
 }
 if(event.type==='I'&&event.lines===4&&S.canonicalClear(event))state.schedule.quads.push({at:count,pieceId:locked.id});
 if(event.type==='Z'){
  if(nonRight(event)){
   if(state.z.remaining!==null?state.z.remaining<=0:state.z.status!=='available')reject('extra-Z-not-available');
   if(state.z.remaining!==null)state.z.remaining--;
   state.z.status=state.z.remaining>0?'available':'used';
  }else if(!event.cells.every(([x])=>x>=8))reject('ordinary-Z-outside-reviewed-Right-role');
 }
 const route=advanceCenter(current.pendingCenter,before.position,after.position,event,locked);
 state.pendingCenter=route.pending;state.pendingLDiverted=state.pendingLDiverted||route.diverted;
 state.current=reconcile(current.current,after.view,effects);
 const knownToUnclassified=A.knownToUnclassified(before.view,after.view,effects),newlyLostCenter=A.newlyLostCenter(current.pendingCenter,state.pendingCenter);
 // The route projection deliberately counts a qualifying unknown-origin T.
 // Actual account validity and its completion effects remain factual inputs,
 // not permission to renew a request-root Z budget or reset progress twice.
 return{state,step:{knownToUnclassified,newlyLostCenter,resetLosesObligation:knownToUnclassified||newlyLostCenter,resetCompleted:!current.reset.completed&&state.reset.completed}};
}
function uncertainty(state,kind){
 const rows=state.current.uncertain[kind],aggregate=state.current.anonymous[kind].slice(),named=rows.map(p=>clone(p.fact));
 return{named,aggregate,count:named.length+aggregate.reduce((a,b)=>a+b,0),severeCount:kind==='S'?named.filter(p=>severity(p)>0).length+aggregate.slice(1).reduce((a,b)=>a+b,0):0};
}
function originalOutstanding(state){
 const r=state.root.duties,c=state.current,has=(kind,id)=>c.hanging[kind].some(p=>p[idKey(kind)]===id)||c.uncertain[kind].some(p=>p.fact[idKey(kind)]===id);
 return[...r.center.filter(p=>state.pendingCenter.some(q=>q.rootId===p.rootId)||c.uncertain.S.some(q=>q.fact.sId===p.rootId&&q.fact.invalidated)).map(p=>'center:'+p.rootId),
  ...r.S.filter(p=>has('S',p.id)).map(p=>'S:'+p.id),...r.L.filter(p=>has('L',p.id)).map(p=>'L:'+p.id)].sort();
}
// Necessary public piece-flow feasibility, not a placement or arrival proof.
function partnerAccessible(supply,pieces){
 const seen=new Set(),todo=[{a:supply?.active?.type??null,h:supply?.hold?.type??null,q:(supply?.queue||[]).map(p=>p.type)}];
 for(let i=0;i<todo.length;i++){
  const n=todo[i],key=JSON.stringify(n);if(seen.has(key))continue;seen.add(key);if(pieces.includes(n.a))return true;
  if(n.a&&n.a!=='T'&&n.q.length)todo.push({a:n.q[0],h:n.h,q:n.q.slice(1)});
  if(n.a&&n.h)todo.push({a:n.h,h:n.a,q:n.q});else if(n.a&&n.q.length)todo.push({a:n.q[0],h:n.a,q:n.q.slice(1)});
 }
 return false;
}
function resolve(state,{supply}={}){
 const s=uncertainty(state,'S'),l=uncertainty(state,'L'),ids=new Set(live(supply).map(p=>p.id)),pendingT=live(supply).some(p=>p.type==='T');
 const hanging=kind=>state.current.hanging[kind].map(p=>({id:p[idKey(kind)]??null,bag:p.bag,known:true}));
 const hangingS=hanging('S'),hangingL=hanging('L'),keys=kinds.flatMap(kind=>state.current.uncertain[kind].map(p=>p.key));
 return{extraZ:state.z.status,extraZRemaining:state.z.remaining,resetActive:state.reset.active,resetProgress:state.reset.progress,resetCompleted:state.reset.completed,
  pendingCenter:clone(state.pendingCenter),pendingLDiverted:state.pendingLDiverted,hangingS,hangingL,unclassifiedS:s.named,unclassifiedL:l.named,
  uncertainty:{S:s,L:l},hasUnclassified:s.count+l.count>0,hasSevereS:s.severeCount>0,
  initialUnclassified:state.root.uncertaintyKeys.slice(),introducedUnclassified:A.introducedUnclassified(keys,state.root.uncertaintyKeys).sort(),
  originalOutstanding:originalOutstanding(state),violations:state.violations.slice(),scoredTs:state.schedule.tsds.map(p=>p.pieceId),schedule:clone(state.schedule),
  centerBlocked:state.pendingCenter.some(p=>p.lost||!state.reset.active&&pendingT&&!partnerAccessible(supply,p.alternatives.map(c=>c.piece))),
  tCollision:supply?.active?.type==='T'&&supply?.hold?.type==='T',hangingLive:hangingS.filter(p=>ids.has(p.id))};
}
function references(state,{supply,planReferences=[]}={}){
 check(Array.isArray(planReferences)&&planReferences.every(subjectId),'plan references');
 return[...new Set([...state.root.references,...planReferences,...live(supply).map(p=>p.id),...state.pendingCenter.map(p=>p.rootId)].filter(subjectId))].sort((a,b)=>a-b);
}
function binding(state,{supply}={}){
 // Include only current/root dependencies and bounded score identity schedule.
 // Caller also binds factual state; this key is not an authentication token.
 return JSON.stringify(canonical([state,supply?{active:supply.active??null,hold:supply.hold??null,queue:supply.queue||[]}:null]));
}
return Object.freeze({start,transition,resolve,references,binding,originalOutstanding,partnerAccessible});
});
