/* Compact opening allocation, conserved Z account and active Reset duty.
 * Shared factual component; the controller and coaches own route selection.
 *
 * The caller authenticates each actual lock/public identity exactly once and
 * owns inventory, phase/Reset selection, Center/S/L/safety reducers and Undo.
 * Supply the AFTER-lock Center/S/L classifications and this lock's Center
 * effects. In particular, debt-invalidated is an operation fact, not a query
 * of an old closure archive. The board predicates below are factual copies of
 * resource-history's predicates, not strategic placement or Reset selection.
 *
 * State contains no board, public inventory, bag archive, spent-piece list,
 * completed Reset, milestone timestamp, total earned/spent count or tape.
 * Pre-clear T/Z thresholds and S-minus-L imbalance are needed only while their
 * conditions remain live. The first Reset T ID is retained only until this
 * Reset ends; cross-episode identity uniqueness belongs to public inventory.
 * Effects describe ONE operation and must not be appended to this state.
 *
 * Integration boundaries still requiring joint migration:
 * - resource-history observeOpening/observeReset/zAccount/profileLost and tapes;
 * - opening/planner consumers: st-opening-eligibility exposes finite exact-T
 *   retention and delayed-quality predicates without historical arrays;
 * - Center/S/L update order and caller-selected phase changes;
 * - ResetPolicy's current-board decision, covered-cell owner and phase changes;
 * - resource monitoring's credit/spend identity arrays: use operation effects;
 * - badges/diagnostics showing capacity, timestamps or completed episode counts.
 * resolve intentionally does not fabricate those historical fields. An inactive
 * Reset has progress zero; completion is an effect, not a retained episode.
 * Trusted snapshots undergo structural checks, never provenance replay.
 * Unknown-origin observation diagnostics (for example an observed TSD without
 * opening authority) remain caller-owned; this slice keeps no unknown-origin
 * allocation account and does not infer eligibility from later geometry.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-reset-policy')):factory(root.STResetPolicy);if(typeof module==='object'&&module.exports)module.exports=api;else root.STOpeningObligations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(ResetPolicy){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),TYPES='IJLOSTZ';
const heights=b=>Array.from({length:10},(_,x)=>{const y=b.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
const canonical=e=>e.lines===0||(e.type==='T'&&e.spin==='full'&&e.lines===2&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7))||(e.type==='I'&&e.lines===4&&e.cells.every(([x])=>x>=7));
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&canonical(e);
const region=e=>e.cells.every(([x])=>x<4)?'left':e.cells.every(([x])=>x>=4&&x<7)?'center':e.cells.every(([x])=>x<7)?'left-center':e.cells.every(([x])=>x>=7)?'right':'cross-right';
function cap(board){const h=heights(board),top=40-h[9];return h[7]===0&&h[8]>=2&&h[9]===h[8]+1&&board.slice(40-h[8]).every(r=>r[8]!=='.')&&board[top][9]!=='.'&&board[top+1][9]!=='.'&&board.slice(top+2).every(r=>r[9]==='.');}
function quality(board){const h=heights(board);return h[4]===h[5]&&h[5]===h[6]&&Math.abs(Math.max(...h.slice(0,4))-Math.max(...h.slice(4,7)))<=3;}
const translate=(cells,rows)=>cells.filter(([,y])=>!rows.includes(y)).map(([x,y])=>[x,y+rows.filter(r=>r>y).length]);
const integer=n=>Number.isSafeInteger(n);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function shape(x,keys,label){if(!object(x)||Object.keys(x).length!==keys.length||!keys.every(key=>Object.prototype.propertyIsEnumerable.call(x,key)))throw TypeError('Invalid '+label+' shape.');}
function check(ok,label){if(!ok)throw TypeError('Invalid '+label+'.');}
function cells(value,label){check(Array.isArray(value)&&value.every(c=>Array.isArray(c)&&c.length===2&&integer(c[0])&&c[0]>=0&&c[0]<10&&integer(c[1])&&c[1]>=0&&c[1]<40)&&new Set(value.map(c=>c.join(','))).size===value.length,label);}
function board(value){check(Array.isArray(value)&&value.length===40&&value.every(r=>typeof r==='string'&&/^[.XIJLOSTZ#]{10}$/.test(r)),'public board');}
function validate(state,projected=false){
 shape(state,['schemaVersion','known','firstTsd','allocationVerified','mandatoryZ','thirdTWindow','qualityCandidate','opening','profile','z','reset',...(projected?['domain']:[])],'account');
 if(projected)check(state.domain==='projection','projected account domain');
 check(state.schemaVersion===1&&typeof state.known==='boolean'&&typeof state.firstTsd==='boolean'&&typeof state.allocationVerified==='boolean'&&typeof state.mandatoryZ==='boolean'&&typeof state.thirdTWindow==='boolean'&&typeof state.qualityCandidate==='boolean','account flags');
 shape(state.profile,['violation','departure','before','capEstablished'],'profile');
 for(const key of ['violation','departure','capEstablished'])check(typeof state.profile[key]==='boolean','profile '+key);
 const before=state.profile.before;
 if(before!==null&&before!=='overused'){shape(before,['t','z','checkpoint'],'pre-clear thresholds');check(integer(before.t)&&before.t>=0&&before.t<=2&&integer(before.z)&&before.z>=0&&before.z<=1&&typeof before.checkpoint==='boolean','pre-clear thresholds');}
 const o=state.opening;
 if(o!==null){
  check(object(o)&&['allocation','quality'].includes(o.kind),'opening duty');
  shape(o,o.kind==='allocation'?['kind','rightZ','imbalance','roof']:['kind','imbalance'],'opening duty');
  check(integer(o.imbalance),'S-minus-L imbalance');
  if(o.kind==='allocation'){check([0,1].includes(o.rightZ),'opening allocation');if(o.roof!==null){cells(o.roof,'cap roof');check(o.roof.length<=2,'cap roof');}}
 }
 shape(state.z,['remaining','uncredited'],'Z account');check(state.z.remaining===null||integer(state.z.remaining),'Z balance');check(['none','one','multiple'].includes(state.z.uncredited),'uncredited Z category');
 const reset=state.reset;check(object(reset)&&['inactive','active','invalid'].includes(reset.status),'Reset status');
 shape(reset,reset.status==='active'?['status','remaining','firstTId','inheritedCovered']:['status'],'Reset duty');
 if(reset.status==='active'){
  check([1,2].includes(reset.remaining),'Reset remaining');check(reset.remaining===2?reset.firstTId===null:integer(reset.firstTId)&&(projected?reset.firstTId!==0:reset.firstTId>=1),'current Reset first T');cells(reset.inheritedCovered,'inherited covered cells');
 }
 // Internal references/unions must be coherent, but none requires a history.
 check(!state.allocationVerified||state.firstTsd,'verified allocation boundary');
 check(!state.mandatoryZ||state.allocationVerified,'mandatory Z boundary');
 check(!state.thirdTWindow||state.known&&state.allocationVerified,'third-T allocation window');
 check(!state.qualityCandidate||state.known&&state.allocationVerified&&state.z.remaining===null&&state.z.uncredited==='none'&&!state.profile.departure,'consumer quality candidate');
 check(!state.firstTsd||before===null,'retired pre-clear thresholds');
 check(!o||o.kind!=='allocation'||!state.firstTsd&&object(before),'allocation thresholds');
 check(!o||o.kind!=='quality'||state.allocationVerified&&state.z.remaining===null&&state.qualityCandidate&&!state.profile.violation,'quality boundary');
 check(!state.qualityCandidate||o?.kind==='quality'||state.profile.violation,'consumer quality duty or source violation');
 check(state.z.remaining===null||state.allocationVerified&&!state.mandatoryZ&&o===null&&state.z.uncredited==='none','established Z account');
 check(reset.status!=='active'||state.z.remaining!==null,'Reset account');
 return state;
}
function importState(snapshot){validate(snapshot);return clone(snapshot);}
function importProjection(snapshot){validate(snapshot,true);return clone(snapshot);}
function exportState(state){return importState(state);}
const ownedProjections=new WeakSet();
const freezeProjection=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freezeProjection);Object.freeze(x);}return x;};
function ownProjection(raw){
 if(ownedProjections.has(raw))return raw;
 // Validate both the input and serialized copy: toJSON/getters on an external
 // object are not permission to mint a trusted invalid component.
 validate(raw,true);return finishProjection(raw);
}
function finishProjection(raw){const state=clone(raw);validate(state,true);freezeProjection(state);ownedProjections.add(state);return state;}
function copyProjection(s){return{...s,opening:s.opening?{...s.opening,...(s.opening.kind==='allocation'?{roof:s.opening.roof?.map(c=>c.slice())??null}:{})}:null,profile:{...s.profile,before:s.profile.before&&typeof s.profile.before==='object'?{...s.profile.before}:s.profile.before},z:{...s.z},reset:{...s.reset,...(s.reset.status==='active'?{inheritedCovered:s.reset.inheritedCovered.map(c=>c.slice())}:{})}};}
function projectTransitionOwned(current,operation,context){
 if(!ownedProjections.has(current))return projectTransition(current,operation,context);
 const result=reduce(current,operation,context,true,true);
 return{state:finishProjection(result.state),effects:result.effects};
}
function resolveProjectionOwned(state,context){return resolveState(state,context,true,ownedProjections.has(state));}

function start({known=false}={}){
 check(typeof known==='boolean','known-origin flag');
 return{schemaVersion:1,known,firstTsd:false,allocationVerified:false,mandatoryZ:false,thirdTWindow:false,qualityCandidate:false,
  opening:known?{kind:'allocation',rightZ:0,imbalance:0,roof:null}:null,
  profile:{violation:false,departure:false,before:known?{t:0,z:0,checkpoint:false}:null,capEstablished:false},
  z:{remaining:null,uncredited:'none'},reset:{status:'inactive'}};
}
function profileLost(state){return Boolean(state.profile.violation||state.profile.departure||state.profile.before==='overused'||state.reset.status==='invalid'||(state.z.remaining!==null?state.z.remaining<0:state.z.uncredited==='multiple'));}
function resolveState(state,{board:currentBoard}={},projected=false,owned=false){
 if(!owned)validate(state,projected);
 let status='unknown',requiredNonRightT=null,requiredNonRightZ=null;
 if(state.known){
  if(state.firstTsd){
   status=state.allocationVerified?(state.mandatoryZ?(!state.profile.violation&&!state.profile.departure?'pending-opening-z':'out-of-profile'):'verified-first-tsd'):'out-of-profile';
   requiredNonRightZ=status==='pending-opening-z'?1:state.allocationVerified&&!state.mandatoryZ?0:null;
  }else if(state.opening?.kind==='allocation'){
   if(currentBoard!==undefined)board(currentBoard);
   const p=state.profile.before;
   status=p.t===2&&p.z===1&&state.opening.rightZ===1&&currentBoard!==undefined&&cap(currentBoard)?'ready-for-first-tsd':'pending';
   requiredNonRightT=2-p.t;requiredNonRightZ=1-p.z;
  }else status='out-of-profile';
 }
 const baseline=state.known&&state.z.remaining!==null;
 return{openingAllocation:{status,requiredNonRightT,requiredNonRightZ},qualityPending:state.opening?.kind==='quality',firstTsd:state.firstTsd,
  extraZ:{status:!baseline?'unknown':profileLost(state)?'out-of-profile':state.reset.status==='active'||state.z.remaining===0?'used':'available',baseline,remaining:baseline?state.z.remaining:null},
  reset:{status:state.reset.status,progress:state.reset.status==='active'?2-state.reset.remaining:0},profileLost:profileLost(state)};
}
function resolve(state,context){return resolveState(state,context);}
function resolveProjection(state,context){return resolveState(state,context,true);}
function addEffect(effects,status,data={}){effects.push({status,...data});}
function disqualifyQuality(state,effects,reason){if(state.opening?.kind==='quality'){state.opening=null;addEffect(effects,'quality-disqualified',{reason});}}
function baseline(state,effects){state.qualityCandidate=false;state.z.remaining=1;state.z.uncredited='none';state.opening=null;addEffect(effects,'baseline-established',{delta:1});}
function invalidateReset(state,effects,reason){if(state.reset.status!=='invalid'){state.reset={status:'invalid'};addEffect(effects,'reset-invalidated',{reason});}}
function begin(current,{candidate,inheritedCovered=[]}={},projected=false){
 const state=projected?importProjection(current):importState(current);check(typeof candidate==='boolean','caller Reset decision');cells(inheritedCovered,'inherited covered cells');
 if(state.reset.status==='active')return{state,effects:[]};
 if(!state.known||!candidate||state.z.remaining!==0||profileLost(state))return{state,effects:[{status:'reset-rejected',reason:'Reset requires a current caller-selected candidate and an eligible exhausted Z account.'}]};
 state.reset={status:'active',remaining:2,firstTId:null,inheritedCovered:clone(inheritedCovered)};
 return{state,effects:[{status:'reset-started'}]};
}
function reduce(current,operation,context,projected=false,owned=false){
 const state=owned?copyProjection(current):projected?importProjection(current):importState(current),effects=[];
 check(operation?.kind==='lock','operation kind');
 const {piece,event:e}=operation;
 check(object(e)&&typeof e.type==='string'&&TYPES.includes(e.type)&&e.type.length===1&&integer(e.lines)&&e.lines>=0&&e.lines<=40&&['none','mini','full'].includes(e.spin)&&typeof e.topOut==='boolean','lock event');
 cells(e.cells,'lock cells');check(e.cells.length===4,'lock cells');
 check(Array.isArray(e.clearedRows)&&e.clearedRows.length===e.lines&&e.clearedRows.every(y=>integer(y)&&y>=0&&y<40)&&new Set(e.clearedRows).size===e.clearedRows.length,'cleared rows');
 check(object(piece)&&piece.type===e.type&&integer(piece.id)&&(piece.id>=1||projected&&piece.id<0&&piece.bag===null)&&(piece.bag===null||integer(piece.bag)&&piece.bag>=0),'locked public identity');
 board(context?.before?.board);board(context?.after?.board);
 const after=context.after;check(typeof after.topOut==='boolean','after top-out');
 check(Array.isArray(after.center?.pending)&&Array.isArray(after.center?.debt)&&Array.isArray(operation.centerEffects),'current Center facts');
 for(const kind of ['hangingS','hangingL'])check(['none-observed','hanging','unknown','out-of-profile'].includes(after.sl?.[kind]?.status),'current '+kind+' classification');
 if(state.reset.status==='active')cells(after.coveredCells,'current covered cells');
 if(!state.known)return{state,effects};
 const wasFirst=state.firstTsd,wasActive=state.reset.status==='active',isTsd=tsd(e),isCanonical=canonical(e),nonRight=e.cells.every(([x])=>x<7),rightZ=e.type==='Z'&&e.lines===0&&e.cells.every(([x])=>x>=8),place=region(e);
 let credited=false;
 if(wasActive){
  if(!isCanonical||e.topOut)invalidateReset(state,effects,'noncanonical-clear-or-top-out');
  else if(e.type==='T'){
   // M's finite route already credits a qualifying synthetic Left T. Keep
   // that explicit projection rule separate from actual observed-bag credit.
   if(!ResetPolicy.qualifies(e)||(!projected&&piece.bag===null)||piece.id===state.reset.firstTId)invalidateReset(state,effects,'T-must-be-distinct-observed-Left-nonclear');
   else{
    state.z.remaining++;credited=true;state.reset.remaining--;addEffect(effects,'reset-T-credited',{pieceId:piece.id,delta:1});
    if(state.reset.remaining===0){state.reset={status:'inactive'};addEffect(effects,'reset-completed');}
    else state.reset.firstTId=piece.id;
   }
  }
 }
 const o=state.opening;
 if(o){if(e.type==='S')o.imbalance++;else if(e.type==='L')o.imbalance--;}
 const priorViolation=state.profile.violation;
 if(!isCanonical||e.topOut||after.topOut)state.profile.violation=true;
 if(e.type==='T'&&!(e.lines===0&&nonRight)&&!isTsd)state.profile.violation=true;
 if(e.type==='Z'){
  if(e.lines===0&&nonRight){}
  else if(rightZ){
   if(!state.profile.capEstablished){
    if(cap(after.board)){state.profile.capEstablished=true;if(o?.kind==='allocation')o.roof=e.cells.filter(([x])=>x===9).map(c=>c.slice());}
    else state.profile.violation=true;
   }
   if(o?.kind==='allocation'){if(o.rightZ===1)state.opening=null;else o.rightZ=1;}
  }else state.profile.violation=true;
 }
 if(!wasFirst&&object(state.profile.before)){
  const p=state.profile.before;
  if(e.lines===0&&nonRight){if(e.type==='T')p.t++;else if(e.type==='Z')p.z++;}
  if(p.t>2||p.z>1){state.profile.before='overused';if(p.checkpoint)state.profile.violation=true;state.opening=null;}
 }
 if(state.profile.violation){
  if(state.opening?.kind==='allocation')state.opening=null;
  if(!wasFirst)state.profile.before=null;
  if(!priorViolation)addEffect(effects,'profile-violation',{pieceId:piece.id});
 }
 if(!wasFirst&&isTsd){
  state.firstTsd=true;addEffect(effects,'first-tsd');
  const duty=state.opening,p=state.profile.before;
  const exactCap=duty?.kind==='allocation'&&duty.roof?.length===2&&cap(context.before.board)&&duty.roof.every(([x,y])=>context.before.board[y]?.[x]==='Z'&&e.clearedRows.includes(y));
  if(duty?.kind==='allocation'&&!state.profile.violation&&p.t===2&&duty.rightZ===1&&exactCap){
   state.allocationVerified=true;state.mandatoryZ=p.z===0;state.thirdTWindow=true;state.qualityCandidate=true;
   state.opening={kind:'quality',imbalance:duty.imbalance};
   addEffect(effects,'opening-allocation-verified',{mandatoryZ:state.mandatoryZ});
   if(!state.mandatoryZ&&p.checkpoint)baseline(state,effects);
  }else state.opening=null;
  state.profile.before=null;
 }else if(!wasFirst&&state.opening?.kind==='allocation'){
  const duty=state.opening,p=state.profile.before;
  if(p.t===2&&p.z===1&&duty.rightZ===1&&cap(after.board)&&duty.imbalance===0&&quality(after.board))p.checkpoint=true;
  if(duty.roof)duty.roof=translate(duty.roof,e.clearedRows);
 }
 if(wasFirst){
  // The old retention gate requires exactly three Ts and non-Right T/Z=2/1.
  // Any later T closes it. A non-Right Z CLEAR does not increment that old
  // nonclear count; the mandatory first Z must not close the window either.
  if(e.type==='T'||e.type==='Z'&&nonRight&&e.lines===0&&!state.mandatoryZ)state.thirdTWindow=false;
  if(e.type==='Z'&&nonRight){
   if(state.mandatoryZ&&e.lines===0){state.mandatoryZ=false;addEffect(effects,'opening-Z-paid',{pieceId:piece.id});}
   else{
    if(state.z.remaining!==null)state.z.remaining--;
    else state.z.uncredited=state.z.uncredited==='none'?'one':'multiple';
    addEffect(effects,'optional-Z-debited',{pieceId:piece.id,delta:-1});
   }
  }
  if(!isCanonical||(place==='right'&&!'ZIT'.includes(e.type))||(place==='cross-right'&&!isTsd)||(e.type==='T'&&!isTsd&&!credited)||(e.type==='Z'&&!nonRight&&!e.cells.every(([x])=>x>=8))||e.topOut){
   if(!state.profile.departure)addEffect(effects,'profile-departure',{pieceId:piece.id});
   state.profile.departure=true;
  }
 }
 // Consumer priority is deliberately broader than baseline eligibility. The
 // legacy gate ignores source violations; do not substitute the quality duty
 // (which correctly retires on them) or infer permission to grant a baseline.
 if(state.qualityCandidate&&(state.z.uncredited!=='none'||state.profile.departure||operation.centerEffects.some(p=>p.status==='debt-invalidated')))state.qualityCandidate=false;
 if(state.opening?.kind==='quality'){
  if(state.profile.violation||state.profile.departure||state.z.uncredited!=='none')disqualifyQuality(state,effects,'allocation-or-profile-departure');
  else if(operation.centerEffects.some(p=>p.status==='debt-invalidated'))disqualifyQuality(state,effects,'invalidated-Center-debt');
  else if(!state.mandatoryZ&&state.opening.imbalance===0&&!after.center.pending.length&&!after.center.debt.length&&after.sl.hangingS.status==='none-observed'&&after.sl.hangingL.status==='none-observed'&&quality(after.board))baseline(state,effects);
 }
 if(wasActive&&(state.profile.departure||state.z.remaining<0))invalidateReset(state,effects,'profile-departure-or-Z-overspend');
 if(wasActive&&state.reset.status==='active'){
  const live=new Set(after.coveredCells.map(c=>c.join(',')));
  state.reset.inheritedCovered=translate(state.reset.inheritedCovered,e.clearedRows).filter(c=>live.has(c.join(',')));
 }
 validate(state,projected);
 return{state,effects};
}
function transition(current,operation,context){return reduce(current,operation,context);}
function projectTransition(current,operation,context){return reduce(current,operation,context,true);}
function beginReset(current,options){return begin(current,options);}
function beginProjectedReset(current,options){return begin(current,options,true);}
return Object.freeze({ownProjection,projectTransitionOwned,resolveProjectionOwned,start,transition,projectTransition,beginReset,beginProjectedReset,resolve,resolveProjection,profileLost,exportState,importState,importProjection,predicates:Object.freeze({canonical,tsd,region,cap,quality})});
});
