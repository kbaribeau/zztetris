/* Shared current-state accounting: current factual consequences, not route permission.
 * The controller owns positions, public inventory, phase, exactly-once delivery
 * and Undo. closeFoundation and firstBagReview are explicit current caller
 * boundary facts; this module never invents lifetime milestone timestamps.
 *
 * transition is the one pure accounting path. applyActual checks a real public
 * inventory receipt; project replays only already-observed known supply, never
 * issuing actual receipts or revealing guessed/forced pieces. Explicit
 * projectTransition/importProjection/resolveProjection APIs share the reducers
 * in a tagged, separate domain used by st-obligation-projection. Accounting errors
 * throw without mutating either public position: callers must retain an already
 * executed game move and report unavailable accounting, never roll it back.
 *
 * Imported CURRENT facts are trusted after structural/reference checks. This is
 * not a whole-session importer, legacy history converter, plan store,
 * route assessment, inverse receipt or controller freshness implementation.
 * Operation effects are transient; do not append them to the returned state.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-public-inventory'),require('./st-center-obligations'),require('./st-sl-obligations'),require('./st-opening-obligations'),require('./st-pattern-history'),require('./st-structure'),require('./st-access'),require('./st-left-obligations')):factory(root.STRules,root.STPublicInventory,root.STCenterObligations,root.STSLObligations,root.STOpeningObligations,root.STPatternHistory,root.STStructure,root.STAccess,root.STLeftObligations);if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,I,C,SL,O,PH,S,A,L){
'use strict';
const VERSION=2,clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(ok,reason)=>{if(!ok)throw Error('Invalid obligation state: '+reason);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
// This capability belongs only to fully detached, validated immutable projected
// snapshots. Public imports/transitions and caller-frozen objects cannot mint it.
const ownedProjections=new WeakSet();
class UnsupportedProjectionData extends Error{}
const plainData=(ok,reason)=>{if(!ok)throw new UnsupportedProjectionData('Invalid obligation state: '+reason);};
function materialize(value,ancestors=new Set()){
 plainData(typeof value!=='function'&&typeof value!=='symbol','plain projected data');
 if(value===null||typeof value!=='object')return value;
 plainData(!ancestors.has(value),'cyclic projected data');ancestors.add(value);let out;
 if(Array.isArray(value)){const length=value.length;out=new Array(length);for(let i=0;i<length;i++)out[i]=materialize(value[i],ancestors);}
 else{out={};for(const key of Object.keys(value))Object.defineProperty(out,key,{value:materialize(value[key],ancestors),writable:true,enumerable:true,configurable:true});}
 ancestors.delete(value);return out;
}
const freezeOwned=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeOwned);Object.freeze(value);}return value;};
function brandOwned(state){freezeOwned(state);ownedProjections.add(state);return state;}
function finishOwned(current){return brandOwned(readState(materialize(current),true,true));}
// An owned parent plus a captured semantic operation cannot introduce raw
// aliases. Reducers construct/copy every changed component; final read keeps
// all component and cross-reference checks before this result is branded.
function finishTransitionOwned(current){
 // Only the two component capabilities can bypass their codecs. The other
 // facts are detached again before checking cross-component invariants.
 const raw={...current,center:materialize(current.center),safety:materialize(current.safety),leftGoals:materialize(current.leftGoals)};
 return brandOwned(readState(raw,true,true));
}
function captureOperation(raw){
 const kind=raw?.kind,keys=['closeFoundation','firstBagReview',...(kind==='lock'?['piece','event']:kind==='begin-reset'?['candidate']:kind==='accept-left-repair'?['checked','repair']:[])],operation={kind};
 for(const key of keys)operation[key]=raw?.[key];
 return materialize(operation);
}
function ownProjection(current){return ownedProjections.has(current)?current:finishOwned(current);}

function shape(x,keys,label){check(object(x)&&Object.keys(x).length===keys.length&&keys.every(key=>Object.prototype.propertyIsEnumerable.call(x,key)),label+' shape');}
const id=n=>Number.isSafeInteger(n)&&n>0;
function cells(value){check(Array.isArray(value)&&value.every(c=>Array.isArray(c)&&c.length===2&&Number.isInteger(c[0])&&c[0]>=0&&c[0]<10&&Number.isInteger(c[1])&&c[1]>=0&&c[1]<40)&&new Set(value.map(c=>c.join(','))).size===value.length,'current cells');return clone(value);}
// Center's optional event timestamps are diagnostics, not current dependencies.
// Never copy a closure archive or route-only lost marker into this envelope.
function centerFacts(value){return{pending:value.pending.map(p=>target(p,false)),debt:value.debt.map(p=>target(p,true))};}
function target(p,debt){return{id:p.id,rootId:p.rootId,family:p.family,alternatives:clone(p.alternatives),...(debt?{divertedPieceId:p.divertedPieceId}:{})};}
function importCenter(raw,projected=false){
 const subjectId=n=>id(n)||projected&&Number.isSafeInteger(n)&&n<0;
 shape(raw,['pending','debt'],'Center');const out={pending:[],debt:[]},byId=new Map();
 for(const kind of ['pending','debt']){
  check(Array.isArray(raw[kind]),'Center '+kind);const ids=new Set();
  for(const p of raw[kind]){
   shape(p,['id','rootId','family','alternatives',...(kind==='debt'?['divertedPieceId']:[])],'Center target');
   check(typeof p.id==='string'&&p.id.length>0&&!ids.has(p.id),'Center target identity');ids.add(p.id);
   check(p.rootId===null?p.family===null:subjectId(p.rootId)&&['SL','LO','OJ','ZJ'].includes(p.family),'Center root/family');
   if(kind==='debt')check(subjectId(p.divertedPieceId),'Center diversion subject');
   check(Array.isArray(p.alternatives)&&p.alternatives.length>0,'Center alternatives');
   const alternatives=p.alternatives.map(c=>{shape(c,['piece','cells'],'Center alternative');check(typeof c.piece==='string'&&c.piece.length===1&&'IJLOSTZ'.includes(c.piece),'Center partner');const result={piece:c.piece,cells:cells(c.cells)};check(result.cells.length===4&&result.cells.every(([x])=>x>=4&&x<7),'Center target cells');check(p.family===null||({SL:'L',LO:'O',OJ:'J',ZJ:'JZ'}[p.family]).includes(c.piece),'Center family partner');return result;});
   const item={...target(p,kind==='debt'),alternatives},prior=byId.get(p.id);
   if(prior)check(same(target(prior,false),target(item,false)),'Center pending/debt reference');else byId.set(p.id,item);
   out[kind].push(item);
  }
 }
 return out;
}
function notchSnapshot(pattern){return pattern.status==='unanchored'?null:{version:PH.VERSION,status:pattern.status,anchorRow:pattern.anchorRow,blockedRows:pattern.blockedRows.slice(),source:pattern.source};}
function readState(raw,projected=false,owned=false){
 // Version one had no selected Left goals. Validate its exact old shape
 // before adding an empty feature field; never infer a goal from past play.
 const legacy=raw?.schemaVersion===1;
 shape(raw,['schemaVersion','availability','center','sl','account','safety','dPending',...(!legacy?['leftGoals']:[]),...(projected?['domain']:[])],'envelope');
 if(projected)check(raw.domain==='projection','projection domain');
 check((legacy||raw.schemaVersion===VERSION)&&['known','unknown'].includes(raw.availability)&&typeof raw.dPending==='boolean','version/availability/D');
 const center=importCenter(raw.center,projected),sl=owned?SL.ownProjection(raw.sl):projected?SL.importProjection(raw.sl):SL.importState(raw.sl),account=owned?O.ownProjection(raw.account):projected?O.importProjection(raw.account):O.importState(raw.account);
 check((sl.status==='known')===(raw.availability==='known')&&account.known===(raw.availability==='known'),'component availability');
 check(raw.availability!=='known'||!account.firstTsd||!sl.foundationOpen,'observed first TSD requires closed S/L foundation');
 shape(raw.safety,['notches','coveredCells'],'safety');let notches=null;
 if(raw.safety.notches!==null){check(raw.safety.notches?.version===PH.VERSION,'current notch version');const p=PH.resolve({},raw.safety.notches);check(p.status!=='invalid-history','current notch snapshot');notches=notchSnapshot(p);}
 const coveredCells=cells(raw.safety.coveredCells);check(coveredCells.every(([x])=>x<7),'Left/Center covered cells');
 if(account.reset.status==='active')check(account.reset.inheritedCovered.every(c=>coveredCells.some(v=>same(c,v))),'Reset inherited covered reference');
 if(sl.status==='known')for(const p of [...center.pending,...center.debt])if(['SL','LO'].includes(p.family)&&(!projected||p.rootId>0))check(sl.residuals.some(b=>(p.family==='SL'?b.S:b.L)?.id===p.rootId),'Center S/L root reference');
 return{schemaVersion:VERSION,...(projected?{domain:'projection'}:{}),availability:raw.availability,center,sl,account,safety:{notches,coveredCells},dPending:raw.dPending,leftGoals:L.importGoals(legacy?[]:raw.leftGoals)};
}
function importState(raw){return readState(raw);}
function importProjection(raw){return readState(raw,true);}
function toProjection(raw){const state=importState(raw);return importProjection({...state,domain:'projection',sl:{...state.sl,domain:'projection'},account:{...state.account,domain:'projection'}});}
function start(position,{inventory}={}){
 check(I.bound(inventory,position),'initial public inventory');
 // This constructor establishes a new accounting origin. Existing duties must
 // come through importState, not be inferred from an imported board picture.
 const known=inventory.originKnown;
 if(known){
  const first=[inventory.active,...inventory.queue];
  check(position.board.every(r=>r==='..........')&&position.streamCursor===1&&inventory.hold===null&&inventory.nextId===8&&first.length===7&&new Set(first.map(p=>p?.type)).size===7&&first.every((p,i)=>p&&p.id===i+1&&p.bag===0&&p.observedOrder===i)&&inventory.frontier?.bag===1&&inventory.frontier.seenMask===0,'known start requires a fresh first-bag origin; import existing current duties');
 }
 return importState({schemaVersion:VERSION,availability:known?'known':'unknown',center:centerFacts(C.start(position.board)),sl:SL.start({known}),account:O.start({known}),safety:{notches:PH.start(position),coveredCells:[]},dPending:false,leftGoals:[]});
}
// Projection has no actual inventory capability. Its request adapter validates
// the distinct supply schema/namespace and replays the move; this pure seam
// checks the explicit domain and public boundary without minting a receipt.
function projectedBound(inventory,position){
 try{return inventory?.domain==='projection'&&inventory.schemaVersion===1&&typeof inventory.originKnown==='boolean'&&R.validate(position).length===0&&inventory.streamCursor===position.streamCursor&&Array.isArray(inventory.queue)&&(inventory.active?.type??null)===(position.active?.type??null)&&(inventory.hold?.type??null)===(position.hold??null)&&same(inventory.queue.map(p=>p.type),position.queue);}catch{return false;}
}
function contextCheck(context,projected=false){
 for(const side of ['before','after'])check(context?.[side]&&(projected?projectedBound(context[side].inventory,context[side].position):I.bound(context[side].inventory,context[side].position)),'public '+side+' boundary');
 if(context.references!==undefined)check(Array.isArray(context.references)&&context.references.every(n=>id(n)||projected&&Number.isSafeInteger(n)&&n<0),'current caller references');
}
function effects(domain,items){return clone(items).map(e=>({domain,...e}));}
// The pure seam assumes the caller has authenticated the event. Both wrappers
// below establish that boundary before calling it. No policy admission occurs.
function reduce(current,operation,context,projected=false,owned=false){
 const read=projected?importProjection:importState,finish=owned?finishTransitionOwned:read,state=owned?{...current}:read(current);contextCheck(context,projected);
 check(['lock','observe','handoff','begin-reset','accept-left-repair'].includes(operation?.kind),'operation kind');
 if(operation.closeFoundation!==undefined)check(typeof operation.closeFoundation==='boolean','closeFoundation boundary');
 if(operation.firstBagReview!==undefined)check(['reviewed','unreviewed'].includes(operation.firstBagReview),'firstBagReview boundary');
 const before=context.before,after=context.after;
 if(operation.kind!=='lock')check(same(before.position.board,after.position.board),'non-lock board change');
 if(operation.kind==='handoff')check(same(before.position,after.position)&&same(before.inventory,after.inventory),'handoff boundary');
 if(state.availability==='known')check(before.inventory.originKnown&&after.inventory.originKnown,'known public supply');
 if(operation.kind==='accept-left-repair'){
  check(same(before.position,after.position)&&same(before.inventory,after.inventory),'Left acceptance boundary');
  const result=L.accept(state.leftGoals,{board:before.position.board,repair:operation.repair,checked:operation.checked});state.leftGoals=result.goals;
  return{state:finish(state),effects:effects('left',result.effects),goalId:result.goalId};
 }
 if(operation.kind==='begin-reset'){
  check(same(before.position,after.position)&&same(before.inventory,after.inventory),'Reset boundary');
  const result=(projected?O.beginProjectedReset:O.beginReset)(state.account,{candidate:operation.candidate,inheritedCovered:state.safety.coveredCells});state.account=result.state;
  return{state:finish(state),effects:effects('account',result.effects)};
 }
 let center={state:state.center,effects:[],pairs:[]},safety=state.safety,phase=null;
 if(operation.kind==='lock'){
  const p=operation.piece,e=operation.event,subject=before.inventory.active;
  check(subject&&(id(p?.id)||projected&&Number.isSafeInteger(p?.id)&&p.id<0&&p.bag===null)&&same(p,subject)&&e?.type===p.type&&same(e,after.position.lastEvent),'locked public subject/event');
  // The actual or projected wrapper already replays the move. This second
  // small replay is deliberately unnecessary in the pure factual function.
  center=C.apply(state.center,before.position.board,after.position.board,e,{pieceId:p.id});
  phase=S.advanceNotches(before.position.board,{state:after.position,event:e},PH.resolve(before.position,state.safety.notches));
  // Preserve the existing current-notch diagnostic source when fresh geometry
  // agrees with the carried phase. No historical replay or re-inference of a
  // disagreeing imported phase is involved.
  const fresh=S.notchPattern(after.position.board),selected=phase.pattern.status==='established'&&fresh.status==='established'&&phase.pattern.anchorRow===fresh.anchorRow?fresh:phase.pattern;
  safety={notches:notchSnapshot(selected),coveredCells:A.repairStep(before.position.board,after.position.board,e,state.safety.coveredCells,phase.pattern)};
 }
 const slContext={before:{inventory:before.inventory,center:state.center},after:{inventory:after.inventory,center:center.state},references:context.references||[]};
 const closeFoundation=operation.closeFoundation||operation.kind==='lock'&&!state.account.firstTsd&&O.predicates.tsd(operation.event);
 const sl=(owned?SL.projectTransitionOwned:projected?SL.projectTransition:SL.transition)(state.sl,{...operation,closeFoundation,centerEffects:center.effects,pairs:center.pairs},slContext);
 const out=[...effects('center',center.effects),...effects('sl',sl.effects)];
 if(operation.kind==='lock'){
  const left=L.advance(state.leftGoals,{beforeBoard:before.position.board,event:operation.event,afterBoard:after.position.board});
  state.leftGoals=left.goals;out.push(...effects('left',left.effects));
 }
 if(operation.kind==='lock'){
  const classified=(owned?SL.resolveProjectionOwned:projected?SL.resolveProjection:SL.resolve)(sl.state,{...slContext.after,profileLost:O.profileLost(state.account)});
  const account=(owned?O.projectTransitionOwned:projected?O.projectTransition:O.transition)(state.account,{...operation,centerEffects:center.effects},{before:{board:before.position.board},after:{board:after.position.board,topOut:after.position.topOut,center:center.state,sl:classified,coveredCells:safety.coveredCells}});
  state.account=account.state;out.push(...effects('account',account.effects));
  if(!same(state.safety,safety))out.push({domain:'safety',status:'current-safety-changed'});
  if(!phase.valid)out.push({domain:'safety',status:'notch-violation',reason:phase.violation});
  const pending=S.leftSurface.isD(after.position.board)&&(state.dPending||!S.leftSurface.isD(before.position.board));
  if(pending!==state.dPending)out.push({domain:'D',status:pending?'created':'cleared'});state.dPending=pending;
 }
 state.center=centerFacts(center.state);state.sl=sl.state;state.safety=safety;
 return{state:finish(state),effects:out};
}
function transition(current,operation,context){return reduce(current,operation,context);}
function projectTransition(current,operation,context){return reduce(current,operation,context,true);}
function projectTransitionOwned(current,operation,context){
 if(!ownedProjections.has(current))return projectTransition(current,operation,context);
 // This new immutable entry snapshots semantic operation data once. It does
 // not promise legacy accessor evaluation order; default APIs are unchanged.
 // Unrelated operation metadata is ignored. Unsupported nested payloads keep
 // the ordinary path and cannot mint an ownership capability.
 let captured;try{captured=captureOperation(operation);}catch(error){if(error instanceof UnsupportedProjectionData)return projectTransition(current,operation,context);throw error;}
 return reduce(current,captured,context,true,true);
}
function applyActual(current,{inventory,before,action,after,receipt,boundary={},references=[]}){
 check(I.matchesTransition(receipt,inventory,before,action,after),'actual controller receipt');
 check(receipt.status==='available','actual inventory result');
 if(!receipt.accepted)return{state:importState(current),effects:[]};
 const operation=action==='HD'?{...boundary,kind:'lock',piece:receipt.locked,event:after.lastEvent}:{...boundary,kind:'observe'};
 return transition(current,operation,{before:{position:before,inventory},after:{position:after,inventory:receipt.next},references});
}
// Clone and advance existing public identities only. No I.transition call:
// hypothetical actions must not manufacture actual operation capabilities.
function project(current,{inventory,position,witness,boundary={},references=[]}){
 check(I.bound(inventory,position)&&inventory.originKnown,'projection requires already-observed known public supply');
 check(Array.isArray(witness)&&witness.length>0&&witness.length<=256&&witness.at(-1)==='HD'&&witness.filter(a=>a==='HD').length===1,'one-lock witness');
 let state=importState(current),s=R.createState(position),inv=I.importState(I.exportState(inventory)),out=[],locked=null;
 for(const action of witness){
  const next=R.move(s,action);check(next!==s,'rejected projected input');
  const raw=I.exportState(inv);check(raw!==null,'projected inventory');
  if(action==='HOLD'){if(raw.hold)[raw.active,raw.hold]=[raw.hold,raw.active];else{raw.hold=raw.active;raw.active=raw.queue.shift();check(raw.active,'unobserved projected HOLD draw');}}
  if(action==='HD'){locked=raw.active;raw.active=next.active?raw.queue.shift():null;check(!next.active||raw.active,'unobserved projected lock draw');}
  raw.streamCursor=next.streamCursor;const nextInventory=I.importState(raw);check(I.bound(nextInventory,next),'unsupported projected supply');
  const operation=action==='HD'?{...boundary,kind:'lock',piece:locked,event:next.lastEvent}:{kind:'observe'};
  const result=transition(state,operation,{before:{position:s,inventory:inv},after:{position:next,inventory:nextInventory},references});
  state=result.state;out.push(...result.effects);s=next;inv=nextInventory;
 }
 return{state,effects:out,position:s,inventory:inv,locked};
}
// Current factual status only, not run scope, termination, admission or a
// historical ledger. Missing/mismatched caller context is an explicit error:
// absence must never become a claim of complete or known-empty accounting.
// Imported duties remain authoritative; this reads, never reconciles them
// against board provenance or mutates/compacts the supplied current state.
function resolveState(current,{position,inventory}={},projected=false,owned=false){
 const state=owned?current:projected?importProjection(current):importState(current);check(projected?projectedBound(inventory,position):I.bound(inventory,position),'status requires matching current public position/inventory');
 if(state.availability==='known')check(inventory.originKnown,'known status requires known public supply');
 const account=(owned?O.resolveProjectionOwned:projected?O.resolveProjection:O.resolve)(state.account,{board:position.board}),sl=(owned?SL.resolveProjectionOwned:projected?SL.resolveProjection:SL.resolve)(state.sl,{inventory,center:state.center,profileLost:account.profileLost});
 return{availability:state.availability,center:state.center,...sl,...account,
  coveredRepair:{cells:state.safety.coveredCells,notches:PH.resolve(position,state.safety.notches)},dPattern:{pending:state.dPending},leftGoals:state.leftGoals};
}
function resolve(current,context){return resolveState(current,context);}
function resolveProjection(current,context){return resolveState(current,context,true);}
function resolveProjectionOwned(current,context){
 if(!ownedProjections.has(current))return resolveProjection(current,context);
 const view=resolveState(current,context,true,true);
 // Other selectors, including notch arrays, already return fresh values.
 // Only these three fields alias the immutable current-state snapshot.
 return{...view,center:materialize(view.center),coveredRepair:{...view.coveredRepair,cells:materialize(view.coveredRepair.cells)},leftGoals:materialize(view.leftGoals)};
}
return Object.freeze({VERSION,start,transition,projectTransition,projectTransitionOwned,ownProjection,resolveProjectionOwned,applyActual,project,resolve,resolveProjection,importState,importProjection,toProjection,exportState:importState});
});
