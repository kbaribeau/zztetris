/* Actual-boundary diagnostics for compact current obligations.
 *
 * transition(before, after, {operation, effects, lock, projected}) consumes ONE
 * accepted Context operation. Frames are {status, state, view, reason?}:
 * status is Context.status; state is Context.state; view is Context.resolve.
 * Unavailable frames use state:null and an unavailable view. No history is an
 * input. The caller authenticates actual delivery and supplies lock/coverage.
 * operation is {kind:'lock',piece,event}, {kind:'observe'}, {kind:'handoff'}, or
 * {kind:'begin-reset'}. piece is the authentic receipt's locked subject. Call
 * for accepted movement/HOLD as observe, not hypothetical search branches.
 *
 * Optional projected is the same factual frame at the SAME public boundary as
 * after. Only pass it for an observed actual lock, with identical observed
 * identities. Projection domain tags are ignored; policy/route fields are not
 * compared. A new reveal must not be compared with an unrevealed projection.
 *
 * Checks reconcile local effects against both supplied current frames. They do
 * not replay source transitions, infer provenance, apply strategy, or retain a
 * second ledger. Exact geometry/support of Center invalidation is owned by the
 * factual reducer/caller; these board-free checks validate its current target
 * identity and effect, not geometric provenance. Retained data is subscribers, CURRENT fixed-stage issue keys,
 * and the first observer failure. Imports/Undo/restarts establish a new caller
 * observation boundary; never feed them as forward accounting transitions.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationTracking=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const key=x=>JSON.stringify(canonical(x)),same=(a,b)=>key(a)===key(b);
const kinds=['S','L'],stages=['action','lock','handoff','begin-reset'];
const stageFor=kind=>kind==='observe'?'action':kind;
const severity=p=>(p.requiresAccommodation?1:0)+(p.invalidated?2:0);
const cellKey=cells=>key(cells.slice().sort(([x,y],[u,v])=>x-u||y-v));
const sameCells=(a,b)=>cellKey(a)===cellKey(b);
const target=p=>({id:p.id,rootId:p.rootId,family:p.family,alternatives:p.alternatives,...(p.divertedPieceId!==undefined?{divertedPieceId:p.divertedPieceId}:{})});
const availability=frame=>frame?.status==='available'?frame.view?.availability??'unavailable':'unavailable';
const identified=(kind,p)=>({kind,bag:p.bag??null,sId:p.sId??null,lId:p.lId??null});
function requireFrame(frame,{projected=false}={}){
 if(!frame||!['available','unavailable'].includes(frame.status))throw Error('Explicit Context availability required.');
 if(frame.status==='unavailable'){
  if(frame.state!==null||frame.view?.availability!=='unavailable')throw Error('Unavailable accounting cannot claim current facts.');
  return;
 }
 const s=frame.state,v=frame.view;
 if(!projected&&(s?.domain!==undefined||s?.sl?.domain!==undefined||s?.account?.domain!==undefined))throw Error('Hypothetical facts cannot be observed as an actual transition.');
 if(!s||!v||!['known','unknown'].includes(s.availability)||s.availability!==v.availability)throw Error('Matching current state and resolved availability required.');
 if(!same(s.center,v.center)||(s.account.known?s.account.z.remaining:null)!==v.extraZ?.remaining||s.account.reset.status!==v.reset?.status||s.dPending!==v.dPattern?.pending||!same(s.safety.coveredCells,v.coveredRepair?.cells))throw Error('Current state and view disagree.');
 for(const kind of kinds){
  const p=v['hanging'+kind];
  if(!p||!Array.isArray(p.evidence)||!Array.isArray(p.unclassified)||!same(p.aggregate,s.sl.uncertainty[kind])||p.unclassifiedCount!==p.unclassified.length+p.aggregate.reduce((a,b)=>a+b,0))throw Error('Current S/L view and aggregates required.');
 }
}
function classified(frame,kind){
 const p=frame.view['hanging'+kind],rows=[...p.evidence.map(p=>({category:'hanging',...p})),...p.unclassified.map(p=>({category:'unclassified',...p}))];
 const map=new Map();for(const row of rows){if(map.has(row.bag))throw Error('Duplicate current S/L classification.');map.set(row.bag,row);}return map;
}
function slIssues(before,after,effects,operation,add){
 const b=before.state.sl,a=after.state.sl,sl=effects.filter(e=>e.domain==='sl');
 const handoff=operation.kind==='handoff'&&!b.handoff&&a.handoff;
 if(a.handoff!==b.handoff&&!handoff||operation.kind==='handoff'&&!a.handoff)add('handoff-mismatch');
 // A residual can carry a future counterpart consequence even when the current
 // selector has no hanging row. Dropping it cannot be excused by equal counts.
 for(const row of b.residuals){
  const next=a.residuals.find(p=>p.bag===row.bag);
  if(next){for(const kind of kinds)if(row[kind]&&next[kind]?.id!==row[kind].id)add('counterpart-identity-lost',{kind,bag:row.bag,id:row[kind].id});}
  else{
   const completing=operation.kind==='lock'&&operation.piece?.bag===row.bag&&kinds.includes(operation.piece.type)&&!row[operation.piece.type];
   const targetLive=[...after.state.center.pending,...after.state.center.debt].some(p=>[row.S?.id,row.L?.id].includes(p.rootId));
   if(!(row.S&&row.L||completing)||targetLive)add('counterpart-obligation-lost',{bag:row.bag,sId:row.S?.id??null,lId:row.L?.id??null});
  }
 }
 for(const row of a.residuals)for(const kind of kinds){
  const prior=b.residuals.find(p=>p.bag===row.bag)?.[kind];
  if(row[kind]&&!prior&&!(operation.kind==='lock'&&operation.piece?.id===row[kind].id&&operation.piece.type===kind&&operation.piece.bag===row.bag))add('counterpart-created-without-lock',{kind,bag:row.bag,id:row[kind].id});
 }
 if(operation.kind==='lock'&&kinds.includes(operation.piece?.type)&&b.status==='known'){
  const type=operation.piece.type,bag=operation.piece.bag,prior=b.residuals.find(p=>p.bag===bag),next=a.residuals.find(p=>p.bag===bag);
  if(!next&&!prior?.[type==='S'?'L':'S'])add('counterpart-lock-unaccounted',{kind:type,bag,id:operation.piece.id});
 }
 const exemptions=sl.filter(e=>e.status==='opening-exempted');
 if(exemptions.length>1)add('effect-mismatch',{domain:'sl',status:'opening-exempted'});
 for(const e of exemptions)if(!handoff||!same(e.counts,b.uncertainty)||![...b.uncertainty.S,...b.uncertainty.L].some(Boolean))add('effect-mismatch',{domain:'sl',status:e.status});
 for(const kind of kinds){
  const expected=classified(before,kind),actual=classified(after,kind),aggregate=b.uncertainty[kind].slice();
  if(exemptions.length===1&&handoff&&same(exemptions[0].counts,b.uncertainty))aggregate.fill(0);
  const changes=new Set(),compactions=new Set();
  for(const e of sl){
   if(e.kind!==kind)continue;
   if(e.status==='classification-changed'){
    const old=expected.get(e.bag)??null,next=e.after;
    const knownToUnclassified=old?.category==='hanging'&&next?.category==='unclassified';
    const uncertaintyId=p=>p?.category==='unclassified'?key([p.sId??null,p.lId??null,p.bag]):null;
    if(changes.has(e.bag)||!same(old,e.before)||e.cause!==operation.kind||!same(Boolean(e.knownToUnclassified),Boolean(knownToUnclassified))||e.introducedUnclassified!==(next?.category==='unclassified'&&uncertaintyId(old)!==uncertaintyId(next))||next&&(!['hanging','unclassified'].includes(next.category)||next.bag!==e.bag)||same(old,next)){
     add('effect-mismatch',{domain:'sl',status:e.status,kind,bag:e.bag});continue;
    }
    changes.add(e.bag);
    if(old&&!next){
     const left=operation.kind==='lock'&&operation.piece?.type===kind&&operation.piece.bag===e.bag&&(old[kind==='S'?'sId':'lId']==null||old[kind==='S'?'sId':'lId']===operation.piece.id)&&operation.event?.cells.every(([x])=>x<4);
     const paid=effects.some(p=>p.domain==='center'&&p.status==='fulfilled'&&((kind==='S'&&p.family==='SL'&&p.rootId===old.sId)||(kind==='L'&&((p.family==='SL'&&p.partnerId===old.lId)||(p.family==='LO'&&p.rootId===old.lId)))));
     const row=b.residuals.find(p=>p.bag===e.bag),exempt=handoff&&row?.S?.opening&&row?.L?.opening;
     if(!left&&!paid&&!exempt)add('obligation-resolution-unexplained',identified(kind,old));
    }
    if(next)expected.set(e.bag,clone(next));else expected.delete(e.bag);
   }else if(e.status==='compacted'){
    const p=e.subject,old=p&&expected.get(p.bag),index=kind==='S'?severity(p||{}):0;
    const row=p&&b.residuals.find(b=>b.bag===p.bag),locked=operation.kind==='lock'&&operation.piece?.bag===p?.bag?operation.piece.type:null;
    const bothConsumed=row&&(row.S||locked==='S')&&(row.L||locked==='L');
    const retained=p&&a.residuals.some(b=>b.bag===p.bag);
    if(!p||p.category!=='unclassified'||!same(old,p)||e.severity!==index||compactions.has(p.bag)||!bothConsumed||retained){
     add('effect-mismatch',{domain:'sl',status:e.status,kind,bag:p?.bag??null});continue;
    }
    compactions.add(p.bag);expected.delete(p.bag);aggregate[index]++;
   }
  }
  for(const bag of new Set([...expected.keys(),...actual.keys()]))if(!same(expected.get(bag)??null,actual.get(bag)??null)){
   const prior=expected.get(bag),next=actual.get(bag);
   add(prior&&!next?'obligation-lost':'classification-effect-mismatch',identified(kind,prior||next),{expected:prior??null,actual:next??null});
  }
  if(!same(aggregate,a.uncertainty[kind]))add('uncertainty-balance-mismatch',{kind},{expected:aggregate,actual:a.uncertainty[kind]});
 }
 for(const e of sl)if(!['classification-changed','compacted','opening-exempted'].includes(e.status)||e.status!=='opening-exempted'&&!kinds.includes(e.kind))add('effect-mismatch',{domain:'sl',status:e.status});
}
function centerIssues(before,after,effects,operation,add){
 const expected={pending:new Map(before.state.center.pending.map(p=>[p.id,clone(p)])),debt:new Map(before.state.center.debt.map(p=>[p.id,clone(p)]))};
 const isLock=operation.kind==='lock',event=operation.event,piece=operation.piece;
 const seen=new Set(),created=new Set();
 for(const e of effects.filter(e=>e.domain==='center')){
  const id=key([e.status,e.id]);if(seen.has(id)){add('effect-mismatch',{domain:'center',status:e.status,id:e.id});continue;}seen.add(id);
  const list=e.status.startsWith('debt-')?'debt':'pending',prior=expected[list].get(e.id);
  let valid=isLock;
  if(e.status==='created'){
   valid=valid&&!prior&&e.rootId===piece?.id&&e.id==='piece-'+piece?.id&&event.cells.every(([x])=>x>=4&&x<7);
   if(valid){expected.pending.set(e.id,target(e));created.add(e.id);}
  }else if(e.status==='diverted'){
   const {divertedPieceId,...plain}=target(e);
   valid=valid&&prior&&same(target(prior),plain)&&!expected.debt.has(e.id)&&e.divertedPieceId===piece?.id;
   if(valid)expected.debt.set(e.id,target(e));
  }else if(['fulfilled','debt-fulfilled','invalidated','debt-invalidated'].includes(e.status)){
   valid=valid&&prior&&same(target(prior),target(e));
   if(e.status.endsWith('fulfilled'))valid=valid&&e.partnerId===piece?.id&&e.alternatives.some(p=>p.piece===event.type&&sameCells(p.cells,event.cells));
   if(valid)expected[list].delete(e.id);
  }else valid=false;
  if(!valid)add('effect-mismatch',{domain:'center',status:e.status,id:e.id??null});
 }
 for(const list of ['pending','debt']){
  const actual=new Map(after.state.center[list].map(p=>[p.id,p]));
  for(const [id,p]of expected[list]){
   const next=actual.get(id);
   if(!next){add('center-obligation-lost',{kind:list,id,rootId:p.rootId,family:p.family});continue;}
   const rows=isLock&&!(list==='pending'&&created.has(id))?event.clearedRows:[],translated=p.alternatives.map(a=>({...a,cells:a.cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(r=>r>y).length])}));
   const identity=q=>({id:q.id,rootId:q.rootId,family:q.family,divertedPieceId:q.divertedPieceId??null});
   if(!same(identity(p),identity(next))||!next.alternatives.length||next.alternatives.some(a=>!translated.some(b=>a.piece===b.piece&&sameCells(a.cells,b.cells))))add('center-effect-mismatch',{kind:list,id});
  }
  for(const [id,p]of actual)if(!expected[list].has(id))add('center-created-without-effect',{kind:list,id,rootId:p.rootId});
 }
}
function accountIssues(before,after,effects,operation,add){
 const b=before.state.account,a=after.state.account,account=effects.filter(e=>e.domain==='account'),isLock=operation.kind==='lock',p=operation.piece,event=operation.event;
 const get=status=>account.filter(e=>e.status===status),has=status=>get(status).length===1;
 const supported=['baseline-established','reset-T-credited','reset-completed','reset-started','reset-invalidated','reset-rejected','opening-Z-paid','optional-Z-debited','first-tsd','opening-allocation-verified','profile-violation','profile-departure','quality-disqualified'];
 for(const status of new Set(account.map(e=>e.status)))if(!supported.includes(status)||get(status).length!==1)add('effect-mismatch',{domain:'account',status});
 const qualified=isLock&&p?.type==='T'&&p.bag!==null&&event.type==='T'&&event.lines===0&&!event.topOut&&event.cells.every(([x])=>x<4)&&b.reset.status==='active'&&p.id!==b.reset.firstTId;
 for(const e of get('reset-T-credited'))if(!qualified||e.pieceId!==p.id||e.delta!==1)add('effect-mismatch',{domain:'account',status:e.status,pieceId:e.pieceId??null});
 for(const e of get('optional-Z-debited'))if(!isLock||!b.firstTsd||p?.type!=='Z'||!event.cells.every(([x])=>x<7)||b.mandatoryZ&&event.lines===0||e.pieceId!==p.id||e.delta!==-1)add('effect-mismatch',{domain:'account',status:e.status,pieceId:e.pieceId??null});
 for(const e of get('baseline-established'))if(!isLock||b.z.remaining!==null||a.z.remaining!==1||e.delta!==1)add('effect-mismatch',{domain:'account',status:e.status});
 if(b.z.remaining!==null){
  const expected=b.z.remaining+get('reset-T-credited').reduce((n,e)=>n+(e.delta===1?1:0),0)-get('optional-Z-debited').reduce((n,e)=>n+(e.delta===-1?1:0),0);
  if(a.z.remaining!==expected)add('extra-z-balance-mismatch',null,{expected,actual:a.z.remaining});
 }else if(a.z.remaining!==null&&!has('baseline-established'))add('extra-z-balance-mismatch',null,{expected:null,actual:a.z.remaining});
 else if(a.z.remaining===null){
  const expected=has('optional-Z-debited')?(b.z.uncredited==='none'?'one':'multiple'):b.z.uncredited;
  if(a.z.uncredited!==expected)add('uncredited-z-mismatch',null,{expected,actual:a.z.uncredited});
 }
 if(b.reset.status==='active'){
  const remaining=b.reset.remaining-(has('reset-T-credited')?1:0);
  if(a.reset.status==='active'){
   if(a.reset.remaining!==remaining||a.reset.firstTId!==(has('reset-T-credited')?p?.id:b.reset.firstTId))add('reset-progress-mismatch');
   const rows=isLock?event.clearedRows:[],live=new Set(after.state.safety.coveredCells.map(c=>c.join(',')));
   const expected=isLock?b.reset.inheritedCovered.filter(([,y])=>!rows.includes(y)).map(([x,y])=>[x,y+rows.filter(r=>r>y).length]).filter(c=>live.has(c.join(','))):b.reset.inheritedCovered;
   if(!same(expected,a.reset.inheritedCovered))add('reset-covered-obligation-mismatch',null,{expected,actual:a.reset.inheritedCovered});
  }else if(a.reset.status==='inactive'){
   if(remaining!==0||!has('reset-completed'))add('reset-duty-lost');
  }else if(!has('reset-invalidated'))add('reset-duty-lost');
 }else if(a.reset.status==='active'){
  if(operation.kind!=='begin-reset'||!has('reset-started')||a.reset.remaining!==2||a.reset.firstTId!==null||b.z.remaining!==0)add('reset-start-mismatch');
 }
 for(const e of get('reset-completed'))if(b.reset.status!=='active'||b.reset.remaining!==1||!has('reset-T-credited')||a.reset.status==='active')add('effect-mismatch',{domain:'account',status:e.status});
 for(const e of get('reset-invalidated'))if(b.reset.status!=='active'||a.reset.status!=='invalid')add('effect-mismatch',{domain:'account',status:e.status});
 for(const e of get('reset-started'))if(operation.kind!=='begin-reset'||b.reset.status==='active'||a.reset.status!=='active')add('effect-mismatch',{domain:'account',status:e.status});
 for(const e of get('reset-rejected'))if(operation.kind!=='begin-reset'||!same(a,b))add('effect-mismatch',{domain:'account',status:e.status});
 const flags=[['firstTsd','first-tsd'],['allocationVerified','opening-allocation-verified']];
 for(const [field,status]of flags)if(b[field]&&!a[field]||!b[field]&&a[field]!==has(status)||has(status)&&b[field])add('account-effect-mismatch',{field,status});
 for(const field of ['violation','departure']){
  const status='profile-'+field;
  if(b.profile[field]&&!a.profile[field]||!b.profile[field]&&a.profile[field]!==has(status)||has(status)&&b.profile[field])add('account-effect-mismatch',{field:'profile.'+field,status});
  for(const e of get(status))if(!isLock||e.pieceId!==p?.id)add('effect-mismatch',{domain:'account',status});
 }
 if(b.mandatoryZ&&!a.mandatoryZ&&!has('opening-Z-paid'))add('opening-z-duty-lost');
 for(const e of get('opening-Z-paid'))if(!isLock||p?.type!=='Z'||!b.mandatoryZ||a.mandatoryZ||event.lines!==0||!event.cells.every(([x])=>x<7)||e.pieceId!==p.id)add('effect-mismatch',{domain:'account',status:e.status});
 for(const e of get('first-tsd'))if(!isLock||event.type!=='T'||event.lines!==2||event.spin!=='full')add('effect-mismatch',{domain:'account',status:e.status});
 for(const e of get('opening-allocation-verified'))if(!has('first-tsd')||e.mandatoryZ!==a.mandatoryZ)add('effect-mismatch',{domain:'account',status:e.status});
 for(const e of get('quality-disqualified'))if(!(b.opening?.kind==='quality'||has('opening-allocation-verified'))||a.opening!==null)add('effect-mismatch',{domain:'account',status:e.status});
 // These finite eligibility facts are live consumer permissions, not retained
 // history. Check their one-lock retirement conditions without re-running the
 // opening accountant or treating source-profile loss as generic prohibition.
 const verified=has('opening-allocation-verified'),nonRight=isLock&&event.cells.every(([x])=>x<7);
 const closesThird=b.firstTsd&&isLock&&(event.type==='T'||event.type==='Z'&&nonRight&&event.lines===0&&!b.mandatoryZ);
 if(a.thirdTWindow!==(verified?true:b.thirdTWindow&&!closesThird))add('account-effect-mismatch',{field:'thirdTWindow'});
 const closesQuality=has('baseline-established')||a.z.uncredited!=='none'||a.profile.departure||effects.some(e=>e.domain==='center'&&e.status==='debt-invalidated');
 if(a.qualityCandidate!==((b.qualityCandidate||verified)&&!closesQuality))add('account-effect-mismatch',{field:'qualityCandidate'});
 if(!b.mandatoryZ&&a.mandatoryZ&&!verified)add('account-effect-mismatch',{field:'mandatoryZ'});
 const rightZ=isLock&&event.type==='Z'&&event.lines===0&&event.cells.every(([x])=>x>=8);
 if(b.opening?.kind==='allocation'&&a.opening===null&&!has('first-tsd')&&!a.profile.violation&&a.profile.before!=='overused'&&!(rightZ&&b.opening.rightZ===1))add('opening-duty-lost',{kind:'allocation'});
 if(b.opening?.kind==='quality'&&a.opening===null&&!has('baseline-established')&&!has('quality-disqualified'))add('opening-duty-lost',{kind:'quality'});
 if(a.opening&&a.opening.kind!==b.opening?.kind&&!(a.opening.kind==='quality'&&verified))add('opening-duty-created-without-effect',{kind:a.opening.kind});
 if(a.opening&&b.opening){
  const expected=b.opening.imbalance+(isLock&&event.type==='S'?1:isLock&&event.type==='L'?-1:0);
  if(a.opening.imbalance!==expected)add('opening-imbalance-mismatch',null,{expected,actual:a.opening.imbalance});
  if(a.opening.kind==='allocation'){
   if(a.opening.rightZ!==(rightZ?1:b.opening.rightZ))add('account-effect-mismatch',{field:'opening.rightZ'});
   if(b.opening.roof){const rows=isLock?event.clearedRows:[],roof=b.opening.roof.filter(([,y])=>!rows.includes(y)).map(([x,y])=>[x,y+rows.filter(r=>r>y).length]);if(!same(roof,a.opening.roof))add('opening-roof-lost');}
  }
 }
 if(!b.known&&(!same(a,b)||account.length))add('unknown-account-changed');
 if(!isLock&&operation.kind!=='begin-reset'&&!same(a,b))add('account-changed-without-lock');
}
function currentFacts(frame){
 const s=clone(frame.state);delete s.domain;delete s.sl.domain;delete s.account.domain;
 return{state:s,view:compactView(frame.view)};
}
function compactView(v){return{
 availability:v.availability,opening:clone(v.openingAllocation),qualityPending:v.qualityPending,firstTsd:v.firstTsd,profileLost:v.profileLost,
 extraZ:clone(v.extraZ),hangingS:clone(v.hangingS),hangingL:clone(v.hangingL),center:clone(v.center),
 dPattern:clone(v.dPattern),coveredRepair:clone(v.coveredRepair),reset:clone(v.reset),
 };}
function inspect(before,after,{effects=[],operation,projected=null}){
 requireFrame(before);requireFrame(after);
 if(!operation||!['lock','observe','handoff','begin-reset'].includes(operation.kind)||!Array.isArray(effects))throw Error('One actual operation and its effects required.');
 if(operation.kind==='lock'&&(!operation.piece||!operation.event||operation.piece.type!==operation.event.type))throw Error('Actual locked subject and event required.');
 const issues=[],add=(code,identity,details)=>issues.push({code,...(identity?{identity}:{}),...(details?{details}:{})});
 const ba=availability(before),aa=availability(after);
 if(ba!==aa){add('availability-changed',null,{before:ba,after:aa,reason:after.reason??after.view?.reason??null});return issues;}
 if(aa==='unavailable')return issues;
 for(const e of effects)if(!e||!['sl','center','account','safety','D'].includes(e.domain))add('effect-mismatch',{domain:e?.domain??null,status:e?.status??null});
 slIssues(before,after,effects,operation,add);centerIssues(before,after,effects,operation,add);accountIssues(before,after,effects,operation,add);
 for(const [domain,changed,status]of [['safety',!same(before.state.safety,after.state.safety),'current-safety-changed'],['D',before.state.dPending!==after.state.dPending,after.state.dPending?'created':'cleared']]){
  const rows=effects.filter(e=>e.domain===domain&&e.status!=='notch-violation');
  if(rows.length!==(changed?1:0)||changed&&rows[0]?.status!==status||changed&&operation.kind!=='lock')add('current-duty-effect-mismatch',{domain});
 }
 if(operation.kind==='handoff')for(const field of ['center','account','safety','dPending'])if(!same(before.state[field],after.state[field]))add('handoff-changed-unrelated-duty',{field});
 if(projected){
  if(operation.kind!=='lock')throw Error('Projection comparison requires an observed actual lock.');requireFrame(projected,{projected:true});
  if(availability(projected)!==aa)add('projection-mismatch',{field:'availability'});
  else{const a=currentFacts(after),p=currentFacts(projected);for(const field of Object.keys(a.state))if(!same(a.state[field],p.state[field]))add('projection-mismatch',{field:'state.'+field},{projected:p.state[field],actual:a.state[field]});for(const field of Object.keys(a.view))if(!same(a.view[field],p.view[field]))add('projection-mismatch',{field:'view.'+field},{projected:p.view[field],actual:a.view[field]});}
 }
 return issues;
}
// Final status is a supplied current snapshot, never a cached last-good ledger.
// Coverage, censoring, terminal state and throughLock are explicit caller data.
function status(frame,{scope='current',throughLock=null,coverage=null,terminal=null,reason=null}={}){
 if(!['current','partial','unavailable'].includes(scope))throw Error('Invalid tracking status scope.');requireFrame(frame);
 return{schemaVersion:1,scope,throughLock,coverage:clone(coverage),terminal:clone(terminal),availability:availability(frame),reason:reason??frame.reason??frame.view?.reason??null,
  obligations:scope==='unavailable'||frame.status==='unavailable'?null:compactView(frame.view)};
}
function create(){
 const listeners=new Set(),active=new Map(stages.map(stage=>[stage,new Set()]));let observerFailure=null;
 function emit(issues,stage,lock){
  const previous=active.get(stage),next=new Set();
  for(const issue of issues){const id=key(issue);if(next.has(id))continue;next.add(id);if(previous.has(id))continue;
   const failures=[];
   for(const listener of listeners)try{listener(clone({...issue,stage,lock}));}catch(error){listeners.delete(listener);const message=String(error?.message??error).slice(0,256);observerFailure??={stage,lock,message};failures.push(message);}
   for(const message of failures)for(const listener of listeners)try{listener({code:'tracking-observer-failed',stage,lock,details:{message}});}catch{listeners.delete(listener);observerFailure??={stage,lock,message:'Diagnostic failure notification could not be delivered.'};}
  }
  active.set(stage,next);
 }
 return Object.freeze({
  subscribe(listener){if(typeof listener!=='function')throw Error('Tracking subscriber must be a function.');listeners.add(listener);return()=>listeners.delete(listener);},
  health(){return{status:observerFailure?'failed':'ok',activeIssues:[...active.values()].reduce((n,s)=>n+s.size,0),...(observerFailure?{firstFailure:clone(observerFailure)}:{})};},
  transition(before,after,options={}){
   if(!listeners.size)return;
   const stage=options.stage??stageFor(options.operation?.kind),lock=options.lock??null;
   // Fixed stages prevent caller lock/identity labels from becoming an archive.
   const actualStage=stages.includes(stage)?stage:'action';let issues;
   try{if(!stages.includes(stage))throw Error('Invalid actual tracking stage.');issues=inspect(before,after,options);}catch(error){issues=[{code:'tracking-check-failed',details:{message:String(error?.message??error).slice(0,256)}}];}
   emit(issues,actualStage,lock);
  },
 });
}
return Object.freeze({create,status});
});
