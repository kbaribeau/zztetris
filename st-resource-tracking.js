/* Observational resource diagnostics. Subscribe at the actual session boundary,
 * never inside search or import replay. This module grants no planning authority. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-resource-history'),require('./st-midgame-resources')):factory(root.STRules,root.STResourceHistory,root.STMidgameResources);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResourceTracking=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,H,M){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const usable=s=>['complete','partial'].includes(s?.coverage?.status);
const sorted=rows=>rows.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const slRows=(s,kind)=>[...(s?.['hanging'+kind]?.evidence||[]),...(s?.['hanging'+kind]?.unclassified||[])];
const sameSL=(a,b,kind)=>{const key=kind==='S'?'sId':'lId';return a[key]!=null&&b[key]!=null?a[key]===b[key]:a.bag!=null&&a.bag===b.bag;};
const centerKey=p=>JSON.stringify([p.id??null,p.rootId??null,p.family??null,p.createdAt??null]);
function paidOrExempt(before,after,p,kind,stage){
 const id=p[kind==='S'?'sId':'lId']??after.observedSL?.find(q=>q.type===kind&&q.bag===p.bag)?.id;
 const allocation=after.allocations?.find(a=>a.pieceId===id);
 if(allocation?.region==='left'&&allocation.cells?.every(([x])=>x<4))return true;
 if(id!=null&&after.pairs?.some(q=>(kind==='S'?q.family==='SL':['SL','LO'].includes(q.family))&&(q.rootId===id||q.partnerId===id)))return true;
 const at=after.milestones?.maintenanceHandoff?.at;
 if(stage==='handoff'&&!before.milestones?.maintenanceHandoff&&at!=null){
  const pair=after.observedSL?.filter(q=>q.bag===p.bag&&'SL'.includes(q.type))||[];
  if(new Set(pair.map(q=>q.type)).size===2&&pair.every(q=>after.allocations?.some(a=>a.pieceId===q.id&&a.at<=at)))return true;
 }
 return false;
}
function coverageIssues(before,after){
 if(usable(before)&&(!usable(after)||before.coverage.status==='complete'&&after.coverage.status!=='complete')){
  return[{code:'coverage-degraded',details:{before:before.coverage.status,after:after?.coverage?.status??'unavailable'}}];
 }
 return[];
}
function transitionIssues(before,after,stage){
 const issues=coverageIssues(before,after),add=(code,identity,details)=>issues.push({code,...(identity?{identity}:{}),...(details?{details}:{} )});
 if(issues.length||!usable(before)||!usable(after))return issues;
 // History is append-only in a forward actual session. Undo/restart is a new
 // observation boundary, not a transition through this monitor.
 for(const p of before.observedSL||[])if(!after.observedSL?.some(q=>q.id===p.id&&q.type===p.type&&q.bag===p.bag))add('observed-identity-lost',{type:p.type,id:p.id,bag:p.bag});
 for(const p of before.allocations||[]){const actual=after.allocations?.find(q=>q.pieceId===p.pieceId);if(!actual)add('allocation-history-lost',{id:p.pieceId,type:p.type});else if(!same(actual,p))add('allocation-history-changed',{id:p.pieceId,type:p.type});}
 for(const p of before.pairs||[])if(!after.pairs?.some(q=>same(p,q)))add('pair-history-lost',{family:p.family,rootId:p.rootId,partnerId:p.partnerId});
 for(const p of before.center?.closed||[])if(!after.center?.closed?.some(q=>same(p,q)))add('center-closure-lost',{id:p.id??null,rootId:p.rootId??null,status:p.status,at:p.at});
 for(const kind of ['S','L'])for(const p of slRows(before,kind)){
  if(slRows(after,kind).some(q=>sameSL(p,q,kind))||paidOrExempt(before,after,p,kind,stage))continue;
  add('obligation-lost',{type:kind,id:p[kind==='S'?'sId':'lId']??null,bag:p.bag??null});
 }
 for(const list of ['pending','debt'])for(const p of before.center?.[list]||[]){
  const retained=(after.center?.[list]||[]).some(q=>centerKey(p)===centerKey(q));
  const closed=(after.center?.closed||[]).some(q=>centerKey(p)===centerKey(q)&&(list!=='debt'||q.status?.startsWith('debt-')));
  if(!retained&&!closed)add('center-obligation-lost',{kind:list,rootId:p.rootId??null,id:p.id??null,family:p.family??null});
 }
 if(before.extraZ?.baseline&&!after.extraZ?.baseline)add('extra-z-baseline-lost');
 for(const p of before.reset?.credits||[])if(!after.reset?.credits?.some(q=>same(p,q)))add('reset-credit-lost',{id:p.pieceId,bag:p.bag});
 for(const p of before.extraZ?.allocations||[])if(!after.extraZ?.allocations?.some(q=>same(p,q)))add('extra-z-allocation-lost',{id:p.pieceId});
 if(after.extraZ?.baseline){
  const expected=1+(after.reset?.credits?.length||0)-(after.extraZ.allocations?.length||0);
  if(after.extraZ.remaining!==expected)add('extra-z-balance-mismatch',null,{expected,actual:after.extraZ.remaining??null});
 }
 return issues;
}
function projectedFacts(resource,projected){
 return Object.fromEntries(['S','L'].flatMap(kind=>{
  const id=kind==='S'?'sId':'lId';
  const known=projected?resource['hanging'+kind]||[]:resource['hanging'+kind]?.evidence||[];
  const unknown=projected?resource['unclassified'+kind]||[]:resource['hanging'+kind]?.unclassified||[];
  return[['hanging'+kind,sorted(known.map(p=>({id:(projected?p.id:p[id])??null,bag:p.bag??null})))],['unclassified'+kind,sorted(unknown.map(p=>({sId:p.sId??null,lId:p.lId??null,bag:p.bag??null,requiresAccommodation:Boolean(p.requiresAccommodation)})))]];
 }));
}
function projectionIssues(projected,actual){
 if(actual?.coverage?.status!=='complete'||!projected?.slHistory)return[];
 const a=projectedFacts(projected,true),b=projectedFacts(actual,false),issues=[];
 for(const field of Object.keys(a))if(!same(a[field],b[field])){
  const key=p=>JSON.stringify(field.startsWith('hanging')?[p.id,p.bag]:[p.sId,p.lId,p.bag]);
  const ap=new Map(a[field].map(p=>[key(p),p])),bp=new Map(b[field].map(p=>[key(p),p]));
  for(const id of new Set([...ap.keys(),...bp.keys()])){const pc=a[field].filter(p=>key(p)===id).length,ac=b[field].filter(p=>key(p)===id).length;if(pc!==ac||!same(ap.get(id),bp.get(id)))issues.push({code:'projection-mismatch',identity:{field,...(bp.get(id)||ap.get(id))},details:{projected:ap.get(id)??null,actual:bp.get(id)??null,...(pc!==ac?{projectedCount:pc,actualCount:ac}:{})}});}
 }
 return issues;
}
// Current status only: no action tape, full allocation/pair arrays or boards.
// Null means unavailable, never an assertion that no obligations remain.
function status(summary,{scope='current',throughLock=summary?.locks??null,reason=null}={}){
 if(!['current','partial','unavailable'].includes(scope))throw Error('Invalid tracking status scope');
 const coverage=summary?.coverage?clone(summary.coverage):{status:'unavailable',reason:'No authenticated resource snapshot.'};
 const result={schemaVersion:1,scope,throughLock,coverage,...(reason?{reason}:{}),terminal:summary?.terminal??null};
 if(scope==='unavailable'||!usable(summary))return{...result,obligations:null};
 const identities=p=>({sId:p.sId??null,lId:p.lId??null,bag:p.bag??null,...(p.pendingAccommodation?{pendingAccommodation:p.pendingAccommodation}:{}),...(p.requiresAccommodation?{requiresAccommodation:true}:{})});
 const center=p=>({id:p.id??null,rootId:p.rootId??null,bag:p.rootBag??null,family:p.family??null,requiredTypes:[...new Set((p.alternatives||[]).map(a=>a.piece))],createdAt:p.createdAt??null});
 const closedCounts={};for(const p of summary.center?.closed||[])closedCounts[p.status]=(closedCounts[p.status]||0)+1;
 return{...result,obligations:{
  opening:clone(summary.openingAllocation??null),
  extraZ:{status:summary.extraZ?.status??'unknown',capacity:summary.extraZ?.capacity??null,remaining:summary.extraZ?.remaining??null,baselineEstablished:Boolean(summary.extraZ?.baseline)},
  hangingS:{status:summary.hangingS?.status??'unknown',known:(summary.hangingS?.evidence||[]).map(identities),unclassified:(summary.hangingS?.unclassified||[]).map(identities)},
  hangingL:{status:summary.hangingL?.status??'unknown',known:(summary.hangingL?.evidence||[]).map(identities),unclassified:(summary.hangingL?.unclassified||[]).map(identities)},
  center:{pending:(summary.center?.pending||[]).map(center),debt:(summary.center?.debt||[]).map(center),closedCounts},
  dPattern:clone(summary.dPattern??null),coveredRepair:{outstandingCells:summary.coveredRepair?.cells?.length??null},
  reset:{status:summary.reset?.status??'unknown',progress:summary.reset?.progress??null},
 }};
}
function create(){
 const listeners=new Set(),activeByStage=new Map();let observerFailure=null;
 function emit(issues,{stage,lock}){
  const next=new Set(),active=activeByStage.get(stage)||new Set();
  for(const issue of issues){const key=JSON.stringify([issue.code,issue.identity??null,issue.details??null]);if(next.has(key))continue;next.add(key);if(active.has(key))continue;
   const event={...issue,stage,lock},failed=[];
   for(const listener of listeners)try{listener(clone(event));}catch(error){listeners.delete(listener);const message=String(error?.message??error);observerFailure??={stage,lock,message:message.slice(0,256)};failed.push(message);}
   // A broken diagnostic consumer cannot interrupt an already executed move.
   // Notify surviving consumers once, without recursively dispatching failures.
   for(const message of failed)for(const listener of listeners)try{listener({code:'tracking-observer-failed',stage,lock,details:{message}});}catch{listeners.delete(listener);observerFailure??={stage,lock,message:'Diagnostic failure notification could not be delivered.'};}
  }
  activeByStage.set(stage,next);
 }
 function checked(stage,lock,inspect){if(!listeners.size)return;let issues;try{issues=inspect();}catch(error){issues=[{code:'tracking-check-failed',details:{message:String(error?.message??error)}}];}emit(issues,{stage,lock});}
 return{
  health(){return observerFailure?{status:'failed',firstFailure:clone(observerFailure)}:{status:'ok'};},
  subscribe(listener){if(typeof listener!=='function')throw Error('Tracking subscriber must be a function');listeners.add(listener);return()=>listeners.delete(listener);},
  transition(before,after,{stage,lock=after?.locks??before?.locks??0}={}){checked(stage,lock,()=>transitionIssues(before,after,stage));},
  // Actual non-HD inputs can exhaust history before the next lock. Inspect only
  // the local history coverage flags, without classifying resources per input.
  // Keep their dedup stage separate so movement cannot clear active lock issues.
  // lock identifies the witness being executed, even if its HD never completes.
  actionCoverage(beforeHistory,afterHistory,{lock=(beforeHistory?.locks??0)+1}={}){checked('action',lock,()=>coverageIssues(beforeHistory,afterHistory));},
  // Only call once the real HD succeeded. Replaying that single public action
  // excludes new hidden draws; HOLD reveals already belong to beforeRaw.
  executedLock(beforeRaw,beforeHistory,afterRaw,afterHistory,event,{lock=(beforeHistory?.locks??0)+1}={}){
   checked('lock',lock,()=>{
   const before=H.resolve(beforeRaw,beforeHistory),after=H.resolve(afterRaw,afterHistory),issues=transitionIssues(before,after,'lock');
   if(before.coverage?.status==='complete'&&after.coverage?.status==='complete'){
    const state=R.move(R.createState(beforeRaw),'HD');
    if(!same(state.lastEvent,event))throw Error('Actual lock does not match its public witness');
    const projected=M.step(beforeRaw,{state,event,witness:['HD']},M.start(beforeRaw,before));
    const history=H.applyAction(beforeHistory,beforeRaw,'HD',state),actual=H.resolve(state,history);
    if(!usable(actual))throw Error('Public lock history could not be authenticated');
    issues.push(...projectionIssues(projected,actual));
   }
   return issues;});
  },
  // A narrow diagnostic seam also permits independent fault-injection tests.
  check(before,after,{stage='lock',lock=after?.locks??0,projected=null,actualPublic=after}={}){checked(stage,lock,()=>[...transitionIssues(before,after,stage),...(projected?projectionIssues(projected,actualPublic):[])]);},
 };
}
return Object.freeze({create,status});
});
