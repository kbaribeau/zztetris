/* Shared, pure admission facts. This is not a resource authority or a route
 * validator: ordinary coaching may carry uncertainty, finite S repair rejects
 * severe S accommodation, and Reset rejects only a new loss on this step.
 *
 * Inputs are either M resource views (hangingS/L and unclassifiedS/L arrays)
 * or Core.resolve views (hangingS/L status records). Operation effects belong
 * to exactly one transition, never a cumulative route tape. No board, supply,
 * legacy resource history or growing identity archive is retained here.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationAdmission=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const kinds=['S','L'],idKey=kind=>kind==='S'?'sId':'lId';
function checkKind(kind){if(!kinds.includes(kind))throw Error('Expected S or L obligation kind.');}
const severity=p=>(p.requiresAccommodation?1:0)+(p.invalidated?2:0);
// aggregate excludes named rows; unclassifiedCount includes both. The four S
// buckets are generic, accommodation, invalidated, and both, in that order.
function uncertainty(view,kind){
 checkKind(kind);
 const facts=view?.['hanging'+kind],compact=facts&&!Array.isArray(facts);
 const named=clone((compact?facts.unclassified:view?.['unclassified'+kind])||[]);
 const aggregate=compact&&facts.aggregate?facts.aggregate.slice():kind==='S'?[0,0,0,0]:[0];
 const count=named.length+aggregate.reduce((a,b)=>a+b,0);
 return{named,aggregate,count,severeCount:kind==='S'?named.filter(p=>severity(p)>0).length+aggregate.slice(1).reduce((a,b)=>a+b,0):0};
}
function hasUnclassified(view,kind){
 if(kind===undefined)return kinds.some(k=>hasUnclassified(view,k));
 checkKind(kind);const facts=view?.['hanging'+kind];
 return Boolean(facts&&!Array.isArray(facts)?facts.unclassified?.length||facts.aggregate?.some(n=>n>0):view?.['unclassified'+kind]?.length);
}
function hasSevereS(view){
 const facts=view?.hangingS;
 return Boolean(facts&&!Array.isArray(facts)?facts.unclassified?.some(p=>p.invalidated||p.requiresAccommodation)||facts.aggregate?.some((n,i)=>i>0&&n>0):view?.unclassifiedS?.some(p=>p.invalidated||p.requiresAccommodation));
}
function uncertaintyKey(kind,p){checkKind(kind);return kind+':'+(p.sId??'')+':'+(p.lId??'')+':'+p.bag;}
// Exact request-root accounting is intentionally separate from count-aware
// admission. Anonymous buckets have no invented identity. A compact caller
// must retain needed references before GC or maintain a separate bounded
// request-local effect comparison. This function cannot reconstruct them.
function uncertaintyKeys(view){
 return kinds.flatMap(kind=>{
  const facts=uncertainty(view,kind);
  if(facts.aggregate.some(n=>n>0))throw Error('Exact uncertainty keys unavailable after compaction; caller-owned request tracking required.');
  return facts.named.map(p=>uncertaintyKey(kind,p));
 });
}
// Compare CURRENT exact keys with the FIXED request root, not previous-step
// keys, introducedUnclassified effect flags, or a net count difference.
function introducedUnclassified(currentKeys,initialKeys){
 const initial=new Set(initialKeys);return currentKeys.filter(key=>!initial.has(key));
}
function hangingIds(view,kind){
 const facts=view?.['hanging'+kind];
 return Array.isArray(facts)?facts.map(p=>p.id):(facts?.evidence||[]).map(p=>p[idKey(kind)]);
}
function knownToUnclassified(before,after,effects=[]){
 return kinds.some(kind=>{
  const ids=new Set(hangingIds(before,kind).filter(id=>id!=null));
  const facts=after?.['hanging'+kind],named=(facts&&!Array.isArray(facts)?facts.unclassified:after?.['unclassified'+kind])||[];
  if(named.some(p=>ids.has(p[idKey(kind)])))return true;
  // Exact operation effects precede compaction, so L37 becoming anonymous is
  // still a new loss. Check the before identity too: a deferred null subject
  // is not the immediately prior known identity checked by Reset today.
  return effects.some(e=>(e.domain===undefined||e.domain==='sl')&&e.status==='classification-changed'&&e.kind===kind&&e.before?.category==='hanging'&&e.after?.category==='unclassified'&&ids.has(e.before[idKey(kind)])&&e.before[idKey(kind)]===e.after[idKey(kind)]);
 });
}
const pending=view=>Array.isArray(view)?view:view?.pendingCenter||view?.center?.pending||[];
// Only the route adapter knows whether target removal is a loss under its
// grammar. Core invalidation effects alone do not establish this: M retires
// wholly cleared targets without a sticky lost marker. Supply that overlay.
function newlyLostCenter(before,after){
 const alreadyLost=new Set(pending(before).filter(p=>p.lost).map(p=>p.rootId));
 return pending(after).some(p=>p.lost&&!alreadyLost.has(p.rootId));
}
function resetLosesObligation(before,after,effects=[]){return knownToUnclassified(before,after,effects)||newlyLostCenter(before,after);}
return Object.freeze({uncertainty,hasUnclassified,hasSevereS,uncertaintyKey,uncertaintyKeys,introducedUnclassified,knownToUnclassified,newlyLostCenter,resetLosesObligation});
});
