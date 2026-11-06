/* Public, observed resource history. Planning context is accepted only by replay.
 * Histories are immutable local capabilities, not trusted imported JSON. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-opening-patterns'),require('./st-access'),require('./st-reset-policy')):factory(root.STRules,root.STStructure,root.STSourcePatterns,root.STAccess,root.STResetPolicy);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResourceHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,Patterns,A,ResetPolicy){
'use strict';
const transport=new WeakMap(),exported=new WeakMap(),localContexts=new WeakMap(),validatedContexts=new WeakMap();
const trusted=new WeakSet(),clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const MAX_ACTIONS=4096,MAX_LOCKS=512;
const SOURCE='https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit';
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const seal=h=>{freeze(h);trusted.add(h);return h;};
const view=o=>({rules:o.rules,board:o.board.slice(),active:o.active?clone(o.active):null,hold:o.hold??null,canHold:o.canHold,queue:o.queue.slice(),streamCursor:o.streamCursor||0,topOut:Boolean(o.topOut)});
const bound=(h,o)=>{try{return trusted.has(h)&&h.observation&&R.validate(o).length===0&&same(h.observation,view(o));}catch{return false;}};
const cellsKey=c=>JSON.stringify(c.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
const heights=b=>Array.from({length:10},(_,x)=>{const y=b.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
// Shared skyline fact only; history never imports preference or exit proofs.
const leftD=S.leftSurface.isD;
const canonical=e=>e.lines===0||(e.type==='T'&&e.spin==='full'&&e.lines===2&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7))||(e.type==='I'&&e.lines===4&&e.cells.every(([x])=>x>=7));
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&canonical(e);
const whole=e=>e.cells.every(([x])=>x<4)?'left':e.cells.every(([x])=>x>=4&&x<7)?'center':e.cells.every(([x])=>x<7)?'left-center':e.cells.every(([x])=>x>=7)?'right':'cross-right';
function cap(board){const h=heights(board),top=40-h[9];return h[7]===0&&h[8]>=2&&h[9]===h[8]+1&&board.slice(40-h[8]).every(r=>r[8]!=='.')&&board[top][9]!=='.'&&board[top+1][9]!=='.'&&board.slice(top+2).every(r=>r[9]==='.');}
function quality(board,counts){const h=heights(board);return h[4]===h[5]&&h[5]===h[6]&&counts.S===counts.L&&Math.abs(Math.max(...h.slice(0,4))-Math.max(...h.slice(4,7)))<=3;}
function addPiece(h,type,ageKnown=true){const id=h.nextId++,order=h.observedCount++;h.pieces[id]={id,type,observedOrder:ageKnown?order:null,bag:h.fresh?Math.floor(order/7):null,allocation:null,pair:null};return id;}
function invalid(raw,reason,status='invalid'){let observation=null;try{observation=view(raw);}catch{}return seal({schemaVersion:1,coverage:{status,reason},observation,actions:0,locks:0});}
function start(raw,{fresh=false}={}){
 try{if(R.validate(raw).length)return invalid(raw,'Invalid public origin.');const o=view(raw);
  // Only the caller's actual new empty session may establish observed bag zero.
  // Imported snapshots, including forged flags, use the default unknown origin.
  fresh=Boolean(fresh&&o.board.every(r=>r==='..........')&&o.active&&o.hold===null&&o.streamCursor===1&&o.queue.length===6&&new Set([o.active.type,...o.queue]).size===7);
  const h={schemaVersion:1,coverage:{status:fresh?'complete':'partial',reason:fresh?'Observed from a local empty seven-bag start.':'Earlier placements and held-piece age are unknown.'},observation:o,fresh,nextId:1,observedCount:0,pieces:{},active:null,hold:null,queue:[],actions:0,locks:0,allocations:[],pairs:[],dPattern:{pending:false,createdAt:null},center:{pending:[],debt:[],closed:[]},coveredRepair:{cells:[],notches:S.notchPattern(o.board)},milestones:{sourcePattern:null,firstTsd:null,maintenanceHandoff:null},opening:{counts:{S:0,L:0,T:0,Z:0,TNonRight:0,ZNonRight:0,ZRight:0},violations:[],cap:null,quality:null,allocation:null,completedAt:null},extraZ:{baseline:null,allocations:[],departures:[]},reset:{status:'inactive',progress:0,startedAt:null,completedAt:null,episodes:[],credits:[]}};
  if(o.active)h.active=addPiece(h,o.active.type,fresh);if(o.hold)h.hold=addPiece(h,o.hold,false);h.queue=o.queue.map(type=>addPiece(h,type,fresh));
  // Imported geometry is factual even though its producing piece identity is not.
  h.center.pending=initialPending(o.board);
  const result=seal(h);transport.set(result,{origin:o,fresh,parent:null,step:null,length:0,handoffAtAction:null,resetAtActions:[]});return result;
 }catch{return invalid(raw,'Could not validate public origin.');}
}
function completionList(board,stages=[],first=null){return S.geometry(board).center.completions.filter(c=>S.supportedCenterCompletion(c,stages)&&(!first||S.centerPairCompletion(first,c))).map(c=>({piece:c.piece,cells:clone(c.cells)}));}
function initialPending(board){const alternatives=completionList(board);return alternatives.length?[{id:'origin',rootId:null,family:null,createdAt:0,alternatives}]:[];}
function matching(c,e){return c.piece===e.type&&cellsKey(c.cells)===cellsKey(e.cells);}
function translate(cells,rows){return cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(r=>r>y).length]);}
function updateCenter(h,before,after,e,id){
 const rows=e.clearedRows||[],prior=[...h.center.pending,...h.center.debt];
 const movedPrior=prior.map(p=>({...p,alternatives:p.alternatives.map(c=>({...c,cells:translate(c.cells,rows)}))}));
 const available=completionList(before.board,prior),afterAvailable=completionList(after.board,movedPrior);
 const completed=available.filter(c=>matching(c,e));
 const old=h.center.pending,remaining=[];
 for(const p of old){
  const supported=p.alternatives.filter(c=>available.some(a=>a.piece===c.piece&&cellsKey(a.cells)===cellsKey(c.cells)));
  const finished=supported.some(c=>matching(c,e));
  if(finished){
   h.center.closed.push({...p,status:'fulfilled',at:h.locks,partnerId:id});
   if(p.rootId!==null&&p.family){const pair={family:p.family,rootId:p.rootId,partnerId:id,at:h.locks};h.pairs.push(pair);h.pieces[p.rootId].pair=pair;h.pieces[id].pair=pair;}
   continue;
  }
  if(supported.some(c=>c.piece===e.type)&&!completed.length&&!h.center.debt.some(d=>d.id===p.id))h.center.debt.push({...clone(p),divertedAt:h.locks,divertedPieceId:id});
  const moved=p.alternatives.map(c=>({...c,cells:translate(c.cells,rows)}));
  const live=moved.filter(c=>c.cells.every(([,y])=>y>=0)&&afterAvailable.some(a=>a.piece===c.piece&&cellsKey(a.cells)===cellsKey(c.cells)));
  if(live.length)remaining.push({...p,alternatives:live});else h.center.closed.push({...p,status:'invalidated',at:h.locks,reason:rows.some(y=>p.alternatives.some(c=>c.cells.some(([,cy])=>cy===y)))?'Clear removed target cells.':'Exact supported completion is no longer present.'});
 }
 const nextDebt=[];
 for(const d of h.center.debt){
  if(d.alternatives.some(c=>matching(c,e))&&completed.length){h.center.closed.push({...d,status:'debt-fulfilled',at:h.locks,partnerId:id});continue;}
  const moved=d.alternatives.map(c=>({...c,cells:translate(c.cells,rows)}));
  const live=moved.filter(c=>c.cells.every(([,y])=>y>=0)&&afterAvailable.some(a=>a.piece===c.piece&&cellsKey(a.cells)===cellsKey(c.cells)));
  if(live.length)nextDebt.push({...d,alternatives:live});else h.center.closed.push({...d,status:'debt-invalidated',at:h.locks,reason:'The original supported target was lost, not repaid.'});
 }
 h.center.debt=nextDebt;
 if(whole(e)==='center'&&S.CENTER_PAIRS[e.type]){
  const alternatives=completionList(after.board,[],e.type);
  if(alternatives.length&&!remaining.some(p=>same(p.alternatives,alternatives)))remaining.push({id:'piece-'+id,rootId:id,family:S.centerPairFamily(e.type),createdAt:h.locks,alternatives});
 }
 h.center.pending=remaining;
}
// Credit is a conserved allocation fact attached to an actual T identity, never
// a fixed award on phase completion. Right cap/access remains a separate duty.
function zAccount(h){
 const capacity=h.extraZ.baseline?1+(h.reset?.credits.length||0):null;
 return {capacity,remaining:capacity===null?null:capacity-h.extraZ.allocations.length};
}
function profileLost(h){return Boolean(h.opening.violations.length||h.extraZ.departures.length||h.reset?.status==='invalid'||(h.extraZ.baseline?zAccount(h).remaining<0:h.extraZ.allocations.length>1)||(!h.milestones.firstTsd&&(h.opening.counts.TNonRight>2||h.opening.counts.ZNonRight>1)));}
function observeReset(h,e,id){
 const reset=h.reset;if(reset.status!=='active')return;
 if(!canonical(e)||e.topOut){reset.status='invalid';reset.reason='Reset encountered a noncanonical clear or top-out.';return;}
 if(e.type!=='T')return;
 const piece=h.pieces[id];
 if(e.lines!==0||whole(e)!=='left'||!piece||piece.bag===null||reset.credits.some(c=>c.pieceId===id)){
  reset.status='invalid';reset.reason='Reset T must be a distinct observed identity locked wholly Left without clearing.';return;
 }
 reset.credits.push({pieceId:id,bag:piece.bag,at:h.locks});reset.progress++;
 if(reset.progress===2){
  reset.completedAt=h.locks;reset.status='inactive';
  reset.episodes.push({startedAt:reset.startedAt,completedAt:h.locks,tIds:reset.credits.slice(-2).map(c=>c.pieceId)});
 }
}
function observeOpening(h,before,after,e){
 const o=h.opening,c=o.counts,region=whole(e),nonRight=e.cells.every(([x])=>x<7);
 if(e.type in c)c[e.type]++;
 if(!canonical(e)||e.topOut||after.topOut)o.violations.push({at:h.locks,reason:canonical(e)?'top-out':'noncanonical-clear'});
 if(e.type==='T'){
  if(e.lines===0&&nonRight)c.TNonRight++;
  else if(!tsd(e))o.violations.push({at:h.locks,reason:'T outside the source allocation'});
 }
 if(e.type==='Z'){
  if(e.lines===0&&nonRight)c.ZNonRight++;
  else if(e.lines===0&&e.cells.every(([x])=>x>=8)){
   c.ZRight++;
   if(!o.cap&&cap(after.board))o.cap={at:h.locks,roof:e.cells.filter(([x])=>x===9).map(c=>c.slice())};
   else if(!o.cap)o.violations.push({at:h.locks,reason:'Z did not establish the normal Right cap'});
  }else o.violations.push({at:h.locks,reason:'Z outside the source allocation'});
 }
 if(!h.milestones.firstTsd&&o.quality&&(c.TNonRight>2||c.ZNonRight>1))o.violations.push({at:h.locks,reason:'The observed opener departed from its recorded source allocation checkpoint.'});
 if(!h.milestones.firstTsd&&!tsd(e)&&!o.violations.length&&c.T===2&&c.TNonRight===2&&c.ZNonRight===1&&c.ZRight===1&&cap(after.board)&&quality(after.board,c))o.quality={at:h.locks,counts:clone(c),maxHeightDifference:3};
 if(tsd(e)&&!h.milestones.firstTsd){
  h.milestones.firstTsd={at:h.locks};
  const roof=o.cap?.roof||[],exactCap=roof.length===2&&cap(before.board)&&roof.every(([x,y])=>before.board[y]?.[x]==='Z'&&e.clearedRows.includes(y));
  // Verify the actual third-T score and original Right cap separately from
  // the mandatory non-Right Z. The Z may still be owed after this clear;
  // a forecast or the clear alone never pays it or grants an Extra Z.
  if(h.fresh&&h.coverage.status==='complete'&&!o.violations.length&&c.T===3&&c.TNonRight===2&&c.ZNonRight<=1&&c.ZRight===1&&exactCap){o.allocation={at:h.locks,capAt:o.cap.at,counts:clone(c)};if(c.ZNonRight===1)o.completedAt=h.locks;}
  if(o.completedAt!==null&&o.quality&&o.quality.at<h.locks){
   h.extraZ.baseline={at:h.locks,qualityAt:o.quality.at,capAt:o.cap.at,counts:clone(c),source:SOURCE,scope:'Observed source Chapter 2 allocation and balanced flat-Center checkpoint; three-row height tolerance is an engineering interpretation.'};
  }
 }
 if(o.cap&&(e.clearedRows||[]).length)o.cap.roof=translate(o.cap.roof,e.clearedRows).filter(([,y])=>y>=0);
 if(!h.milestones.sourcePattern){const match=Patterns?.patterns?.find(p=>same(after.board,Array(40-p.rows.length).fill('..........').concat(p.rows)));if(match)h.milestones.sourcePattern={at:h.locks,id:match.id};}
 // First-TSD is a diagnostic boundary even when baseline eligibility is unknown.
 if(h.milestones.firstTsd&&h.locks>h.milestones.firstTsd.at){
  if(e.type==='Z'&&nonRight){
   // The first observed non-Right Z pays a known opening debt, even when it
   // follows the first TSD. Only subsequent Zs consume optional allocations.
   if(o.allocation&&o.completedAt===null&&c.ZNonRight===1)o.completedAt=h.locks;
   else h.extraZ.allocations.push({at:h.locks,pieceId:h.active,type:'Z',region,cells:clone(e.cells)});
  }
  if(!canonical(e)||(region==='right'&&!'ZIT'.includes(e.type))||(region==='cross-right'&&!tsd(e))||(e.type==='T'&&!tsd(e)&&!h.reset.credits.some(c=>c.pieceId===h.active&&c.at===h.locks))||(e.type==='Z'&&!nonRight&&!e.cells.every(([x])=>x>=8))||e.topOut)h.extraZ.departures.push({at:h.locks,reason:'Observed departure from the ordinary Midgame profile; no Reset inferred.'});
 }
 // Good-opener quality is additional to both the first TSD and mandatory Z.
 // It may be completed by observed early-midgame locks, never by a forecast or
 // an imported status. Later canonical TSDs do not erase a still-owed Z.
 // Keep this narrow: no optional Z, non-scoring T diversion, departure,
 // unresolved Center debt or S/L identity may be laundered into a new baseline.
 if(!h.extraZ.baseline&&o.allocation&&o.completedAt!==null&&c.TNonRight===2&&c.ZNonRight===1&&!o.violations.length&&!h.extraZ.allocations.length&&!h.extraZ.departures.length&&!h.center.pending.length&&!h.center.debt.length&&!h.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>=o.allocation.at)&&quality(after.board,c)&&hanging(h).status==='none-observed'&&hangingL(h).status==='none-observed'){
  o.quality={at:h.locks,counts:clone(c),maxHeightDifference:3};
  h.extraZ.baseline={at:h.locks,firstTsdAt:o.allocation.at,allocationCompletedAt:o.completedAt,qualityAt:h.locks,capAt:o.allocation.capAt,counts:clone(c),source:SOURCE,scope:'Observed third-T first TSD, mandatory non-Right opening Z and balanced flat-Center checkpoint; the Z may precede or follow that clear, and later canonical TSDs do not erase the debt. No optional Z allocation, non-scoring T diversion, profile departure or invalidated Center debt intervenes, and no unresolved Center or S/L obligation remains. Three-row height tolerance is an engineering interpretation.'};
 }
}
function applyAction(history,before,action,after){
 if(!bound(history,before))return invalid(after,'Missing, forged, or stale local event history.');
 if(!['complete','partial'].includes(history.coverage.status))return invalid(after,history.coverage.reason,history.coverage.status);
 if(history.actions>=MAX_ACTIONS||history.locks>=MAX_LOCKS)return invalid(after,'Observed history limit reached; cumulative resources cannot be re-anchored from a board.','truncated');
 try{
  if(!['L','R','SD','HD','HOLD','CW','CCW','R180'].includes(action)||R.validate(after).length)return invalid(after,'Invalid action or resulting public state.');
  const initial=R.createState(before),expected=R.move(initial,action),ev=view(expected),av=view(after);
  if(!same({...ev,queue:[]},{...av,queue:[]})||!same(av.queue.slice(0,ev.queue.length),ev.queue)||av.queue.length>6)return invalid(after,'Action, draw, or resulting state does not replay.');
  if(action==='HD'&&(!expected.lastEvent||!same(expected.lastEvent,after.lastEvent??expected.lastEvent)))return invalid(after,'Lock event does not replay.');
  if(expected===initial)return same(view(before),av)?history:invalid(after,'A rejected input cannot change observations.');
  // Movement cannot alter accumulated allocations. Share frozen facts rather
  // than copying the entire run on every key repeat; lock updates remain private.
  const h=action==='HD'?clone(history):{...history,queue:history.queue.slice()};h.actions++;
  const draw=()=>{const id=h.queue.shift();if(id===undefined)throw Error('Missing observed draw identity');return id;};
  const lockedId=h.active;
  if(action==='HOLD'){
   if(h.hold!==null){const held=h.hold;h.hold=h.active;h.active=held;}else{h.hold=h.active;h.active=draw();}
  }else if(action==='HD'){
   const e=expected.lastEvent,knownSurplus=e.type==='S'&&hanging(history).evidence.some(s=>s.sId===lockedId);h.locks++;
   const allocation={at:h.locks,pieceId:lockedId,type:e.type,region:whole(e),cells:clone(e.cells),lines:e.lines,spin:e.spin,clearedRows:e.clearedRows.slice()};
   h.allocations.push(allocation);h.pieces[lockedId].allocation=allocation;
   updateCenter(h,before,after,e,lockedId);observeReset(h,e,lockedId);observeOpening(h,before,after,e);
   if(history.reset.status==='active'&&(h.extraZ.departures.length||zAccount(h).remaining<0)){h.reset.status='invalid';h.reset.reason='Reset left the supported allocation profile or overspent its conserved Z balance.';}
   // Event-authenticated debt survives discarded advice, failed continuation
   // checks and fresh worker realms. Imported origin damage starts unclaimed.
   const phase=S.advanceNotches(before.board,{state:after,event:e},h.coveredRepair.notches);
   h.coveredRepair={cells:A.repairStep(before.board,after.board,e,h.coveredRepair.cells,phase.pattern),notches:phase.pattern};
   if(history.reset.status==='active'){const live=new Set(h.coveredRepair.cells.map(([x,y])=>x+','+y));h.reset.inheritedCovered=translate(history.reset.inheritedCovered||[],e.clearedRows||[]).filter(([x,y])=>y>=0&&live.has(x+','+y));}
   // Only an observed non-D -> D lock establishes this obligation. Importing
   // an already-D board does not fabricate its creator or a prior promise.
   if(!leftD(after.board))h.dPattern={pending:false,createdAt:null};
   else if(!leftD(before.board))h.dPattern={pending:true,createdAt:h.locks};
   // Reconstruct only an observed known-to-unreviewed transition. This flag
   // is derived from replay, never accepted from a serialized summary.
   if(knownSurplus&&allocation.region!=='left'&&h.pieces[lockedId].pair?.family!=='SL'&&!h.center.pending.some(p=>p.family==='SL'&&p.rootId===lockedId))allocation.requiresAccommodation=true;
   h.active=expected.active?draw():null;
  }
  const added=av.queue.slice(ev.queue.length);if(added.length){if(action!=='HD')h.pieces={...h.pieces};h.queue.push(...added.map(type=>addPiece(h,type,h.fresh)));}
  if(h.active!==null&&h.pieces[h.active].type!==av.active?.type||h.hold!==null&&h.pieces[h.hold].type!==av.hold||!same(h.queue.map(id=>h.pieces[id].type),av.queue))return invalid(after,'Observed identity continuity failed.');
  // Known bag grouping comes only from actual observed draw order, never locks/7.
  if(h.fresh&&added.length){const bags=new Map();for(const p of Object.values(h.pieces)){const set=bags.get(p.bag)||new Set();if(set.has(p.type))return invalid(after,'Observed stream contradicts the known seven-bag origin.');set.add(p.type);bags.set(p.bag,set);}}
  h.observation=av;const result=seal(h),prior=transport.get(history);
  if(prior)transport.set(result,{origin:prior.origin,fresh:prior.fresh,parent:prior,step:{action,revealed:added.slice()},length:prior.length+1,handoffAtAction:prior.handoffAtAction,resetAtActions:prior.resetAtActions});
  return result;
 }catch{return invalid(after,'Could not replay the observed resource event.');}
}
function markHandoff(history,raw){if(!bound(history,raw)||!history.pieces)return invalid(raw,'Untrusted maintenance handoff history.');if(history.milestones.maintenanceHandoff)return history;const h=clone(history);h.milestones.maintenanceHandoff={at:h.locks};const result=seal(h),prior=transport.get(history);if(prior)transport.set(result,{...prior,handoffAtAction:prior.length});return result;}
function beginReset(history,raw){
 if(!bound(history,raw)||!history.pieces||!history.fresh||history.coverage.status!=='complete')return invalid(raw,'Reset requires complete observed empty-origin history.');
 if(history.reset.status==='active')return history;
 const summary=resolve(raw,history);
 if(summary.extraZ.status!=='used'||summary.extraZ.remaining!==0||profileLost(history)||ResetPolicy?.consider(raw,summary)?.status!=='candidate')return invalid(raw,'Reset handoff is not eligible from this observed state.');
 const prior=transport.get(history);if(!prior)return invalid(raw,'Reset requires replayable history.');
 const h=clone(history);h.reset={...h.reset,status:'active',progress:0,startedAt:h.locks,completedAt:null,inheritedCovered:clone(h.coveredRepair.cells)};
 const result=seal(h);transport.set(result,{...prior,resetAtActions:[...prior.resetAtActions,prior.length]});return result;
}
// A cloneable proof consists only of the public origin, actual inputs and newly
// revealed preview suffixes. Derived status flags never cross the trust boundary.
// Keeping a linked private ledger avoids copying an ever-growing tape on movement.
function exportContext(raw,history){
 if(!bound(history,raw)||!history.pieces)return null;
 const cached=exported.get(history);if(cached)return cached;
 const tail=transport.get(history);if(!tail||tail.length>MAX_ACTIONS)return null;
 const steps=[];for(let n=tail;n&&n.step;n=n.parent)steps.push(clone(n.step));steps.reverse();
 const context=freeze({schemaVersion:1,origin:clone(tail.origin),fresh:tail.fresh,steps,handoffAtAction:tail.handoffAtAction,...(tail.resetAtActions.length?{resetAtActions:tail.resetAtActions.slice()}:{})});
 exported.set(history,context);localContexts.set(context,history);return context;
}
function importContext(raw,context){
 try{
  const local=localContexts.get(context);if(local&&bound(local,raw))return local;
  if(!context||context.schemaVersion!==1||!Array.isArray(context.steps)||context.steps.length>MAX_ACTIONS||typeof context.fresh!=='boolean')return invalid(raw,'Missing or invalid resource replay context.');
  const marker=context.handoffAtAction,resetMarkers=context.resetAtActions??[];
  if(!Array.isArray(resetMarkers)||resetMarkers.some((n,i)=>!Number.isInteger(n)||n<0||n>context.steps.length||(i>0&&n<=resetMarkers[i-1])))return invalid(raw,'Invalid Reset decision markers.');
  if(marker!==null&&(!Number.isInteger(marker)||marker<0||marker>context.steps.length))return invalid(raw,'Invalid resource handoff marker.');
  if(!context.origin||!Array.isArray(context.origin.queue)||context.origin.queue.length>6)return invalid(raw,'Resource origin exceeds the public preview.');
  // One decide call can validate a root several times. Cache only after full
  // replay, and recheck the complete proof bytes so later mutation cannot keep
  // the authority of a previously valid clone. Observation binding still applies.
  const signature=JSON.stringify([context.origin,context.fresh,context.steps,marker,resetMarkers]),cached=validatedContexts.get(context);
  if(cached&&cached.signature===signature&&bound(cached.history,raw))return cached.history;
  let state=R.createState(context.origin),history=start(state,{fresh:context.fresh});
  if(!history.pieces||context.fresh&&!history.fresh)return invalid(raw,'Resource origin cannot establish the claimed observed history.');
  if(marker===0)history=markHandoff(history,state);
  if(resetMarkers.includes(0))history=beginReset(history,state);
  if(!history.pieces)return invalid(raw,'Reset decision marker failed validation.');
  for(let i=0;i<context.steps.length;i++){
   const step=context.steps[i];
   if(!step||!['L','R','SD','HD','HOLD','CW','CCW','R180'].includes(step.action)||!Array.isArray(step.revealed)||step.revealed.length>6||step.revealed.some(p=>typeof p!=='string'||!['I','J','L','O','S','T','Z'].includes(p)))return invalid(raw,'Invalid resource replay input.');
   const before=state,next=R.move(state,step.action);
   if(next===state)return invalid(raw,'Resource replay contains a rejected input.');
   state={...next,queue:[...next.queue,...step.revealed]};
   history=applyAction(history,before,step.action,state);
   if(!history.pieces)return invalid(raw,'Resource replay failed: '+history.coverage.reason);
   if(marker===i+1)history=markHandoff(history,state);
   if(resetMarkers.includes(i+1)){if(history.reset.status==='active')return invalid(raw,'Repeated Reset marker during an active Reset.');history=beginReset(history,state);if(!history.pieces)return invalid(raw,'Reset decision marker failed validation.');}
  }
  if(!bound(history,raw))return invalid(raw,'Resource replay does not match the current public observation.');
  validatedContexts.set(context,{signature,history});return history;
 }catch{return invalid(raw,'Could not validate resource replay context.');}
}
// Opening allocation has no S/L pairing requirement. At the exact maintenance
// boundary, an unused piece inherits only its own bag partner's consumed status.
// A held piece keeps its observed bag, even after newer bags become active.
function openingPartnerUsed(h,p){const at=h.milestones.maintenanceHandoff?.at;return at!==undefined&&p?.allocation&&p.allocation.at<=at;}
function hanging(h){
 if(!h.fresh)return{status:'unknown',evidence:[],reason:'Earlier S/L allocations and identities are unknown; geometry alone cannot establish surplus.'};
 const since=0,bags=new Map(),evidence=[],unclassified=[];
 for(const p of Object.values(h.pieces)){if(!'SL'.includes(p.type))continue;const b=bags.get(p.bag)||{};b[p.type]=p;bags.set(p.bag,b);}
 for(const [bag,{S:s,L:l}] of bags){
  if(!l?.allocation)continue;
  const inherited=openingPartnerUsed(h,l);
  if(inherited&&openingPartnerUsed(h,s))continue;
  const pending=s&&h.center.pending.some(p=>p.family==='SL'&&p.rootId===s.id);
  // An opener foundation S already consumed before this L is not retroactive
  // debt. A still-pending exact SL root, however, survives a diverted L.
  const owedAtDiversion=pending||s&&h.center.closed.some(p=>p.family==='SL'&&p.rootId===s.id&&p.at>=l.allocation.at);
  const foundationEnd=Math.min(h.milestones.sourcePattern?.at??Infinity,h.milestones.firstTsd?.at??Infinity,h.milestones.maintenanceHandoff?.at??Infinity);
  if(!inherited&&s?.allocation?.region==='center'&&s.allocation.at<=foundationEnd&&s.allocation.at<l.allocation.at&&!owedAtDiversion&&!s.pair)continue;
  const disposed=s&&(s.allocation?.region==='left'||s.pair?.family==='SL');
  if(disposed)continue;
  // A consumed L is unavailable to its own S even when it crosses the
  // Left/Center boundary. Region classification is not piece accounting.
  const diverted=inherited||l.allocation.cells.every(([x])=>x<7)&&!(l.pair?.family==='SL'&&l.pair.rootId===s?.id);
  // A positively recognized first-bag source foundation retains its existing
  // opening allocation policy; it is not a maintenance disposal certificate.
  const reviewedFoundation=bag===0&&h.milestones.sourcePattern?.at===7&&s?.allocation?.at<=7;
  if(diverted&&s?.allocation&&!h.center.pending.some(p=>p.family==='SL'&&p.rootId===s.id)){unclassified.push({bag,sId:s.id,lId:l.id,...(s.allocation.requiresAccommodation&&!reviewedFoundation?{requiresAccommodation:true}:{}),reason:'The previously surplus S was placed in an unreviewed allocation; whether it was accommodated is unknown.'});continue;}
  if(diverted)evidence.push({bag,sId:s?.id??null,lId:l.id,at:l.allocation.at,...(!s?{deferred:true}:{}),reason:inherited?'The same-bag L was used during opening while this S remained unused at handoff.':l.pair?.family==='SL'?'The L completed a different observed S.':'The L was allocated outside its observed S/L pair.'});
  else if(l.allocation.region!=='center'||l.pair?.family!=='SL')unclassified.push({bag,lId:l.id,reason:'The L allocation has no reviewed S/L role.'});
 }
 const lostProfile=h.profileLost??profileLost(h);
 return{status:lostProfile||evidence.length>1?'out-of-profile':evidence.length?'hanging':unclassified.length?'unknown':'none-observed',evidence,unclassified,since,reason:evidence.length?'Source-backed observed surplus; exact Center completion debt is a separate fact.':'No supported Hanging-S event in the reviewed interval; this is not proof of globally balanced arbitrary play.'};
}
// L identification is deliberately not a mirrored repair strategy. A supported
// pending SL is a construction awaiting L, not an extra L. Only actual disposal
// of its own S (Left or an exact foreign-bag SL pair) establishes surplus.
function hangingL(h){
 if(!h.fresh)return{status:'unknown',evidence:[],reason:'Earlier S/L allocations and identities are unknown; geometry alone cannot establish surplus.'};
 const bags=new Map(),evidence=[],unclassified=[];
 for(const p of Object.values(h.pieces)){if(!'SL'.includes(p.type))continue;const b=bags.get(p.bag)||{};b[p.type]=p;bags.set(p.bag,b);}
 for(const [bag,{S:s,L:l}] of bags){
  if(!s?.allocation)continue;
  const inherited=openingPartnerUsed(h,s);
  if(inherited&&openingPartnerUsed(h,l))continue;
  if(l?.allocation?.region==='left'||['SL','LO'].includes(l?.pair?.family))continue;
  const paired=s.pair?.family==='SL',at=!inherited&&paired?s.pair.at:s.allocation.at;
  if(l?.allocation&&l.allocation.at<at)continue;
  const diverted=inherited||s.allocation.region==='left'||paired&&s.pair.partnerId!==l?.id;
  if(!diverted)continue;
  const pendingLO=h.center.pending.some(p=>p.family==='LO'&&p.rootId===l?.id);
  if(l?.allocation&&!pendingLO){unclassified.push({bag,lId:l.id,sId:s.id,reason:'The previously surplus L was placed in an unreviewed accommodation; no L repair strategy is inferred.'});continue;}
  evidence.push({bag,lId:l?.id??null,sId:s.id,at,...(!l?{deferred:true}:{}),...(pendingLO?{pendingAccommodation:'LO'}:{}),reason:inherited?'The same-bag S was used during opening while this L remained unused at handoff.':paired?'The S completed a pair with a different observed L.':'The S was accommodated on Left instead of using its observed L.'});
 }
 const lostProfile=h.profileLost??profileLost(h);
 return{status:lostProfile||evidence.length>1?'out-of-profile':evidence.length?'hanging':unclassified.length?'unknown':'none-observed',evidence,unclassified,since:0,reason:evidence.length?'Observed surplus L identity; pending Center SL and repair capability are separate facts.':'No supported Hanging-L event in the observed interval; no symmetric L repair strategy is assumed.'};
}
// Pure classification shared with hypothetical planning. This returns no trusted
// history capability: callers still authenticate public action tapes separately.
function advanceSLMilestones(prior,board,event,at){
 const milestones=clone(prior);
 if(!milestones.firstTsd&&tsd(event))milestones.firstTsd={at};
 if(!milestones.sourcePattern){const match=Patterns?.patterns?.find(p=>same(board,Array(40-p.rows.length).fill('..........').concat(p.rows)));if(match)milestones.sourcePattern={at,id:match.id};}
 return milestones;
}
function classifySL(facts){
 const h={fresh:facts.fresh,pieces:facts.pieces,center:facts.center,milestones:facts.milestones,profileLost:Boolean(facts.profileLost)};
 return{hangingS:hanging(h),hangingL:hangingL(h)};
}
function openingAllocation(h){
 const unknown={status:'unknown',counts:null,requiredNonRightZ:null,requiredNonRightT:null,firstTsdAt:null,completedAt:null,qualityAt:null,checkpoint:null};
 if(!h?.pieces||!h.fresh||h.coverage.status!=='complete')return unknown;
 const o=h.opening,c=o.counts,first=h.milestones.firstTsd;
 const departed=o.violations.length||c.TNonRight>2||c.ZNonRight>1||c.ZRight>1||c.T>2;
 const pendingZ=o.allocation&&o.completedAt===null&&c.TNonRight===2&&c.ZNonRight===0&&!o.violations.length&&!h.extraZ.departures.length;
 const status=first?(o.allocation?(o.completedAt!==null?'verified-first-tsd':pendingZ?'pending-opening-z':'out-of-profile'):'out-of-profile'):departed?'out-of-profile':c.TNonRight===2&&c.ZNonRight===1&&c.ZRight===1&&cap(h.observation.board)?'ready-for-first-tsd':'pending';
 const before=!first&&!departed;
 return{status,counts:clone(c),requiredNonRightZ:before?1-c.ZNonRight:pendingZ?1:o.completedAt!==null?0:null,requiredNonRightT:before?2-c.TNonRight:null,firstTsdAt:first?.at??null,completedAt:o.completedAt,qualityAt:o.quality?.at??null,checkpoint:clone(o.allocation)};
}
function publicBag(h){
 if(!h.fresh||h.coverage.status!=='complete')return {status:'unknown',remainingTypes:null};
 const bag=Math.floor(h.observedCount/7),seen=new Set(Object.values(h.pieces).filter(p=>p.bag===bag).map(p=>p.type));
 return {status:'known',remainingTypes:['I','J','L','O','S','T','Z'].filter(type=>!seen.has(type)),scope:'After all observed draws, including the current preview; HOLD does not consume a draw.'};
}
function resolve(raw,history){
 if(!bound(history,raw))return{coverage:{status:'invalid',reason:'Missing, forged, or stale local event history.'},openingAllocation:openingAllocation(),hangingS:{status:'unknown',evidence:[]},hangingL:{status:'unknown',evidence:[]},extraZ:{status:'unknown',baseline:null,allocations:[]}};
 if(!history.pieces)return{coverage:clone(history.coverage),actions:history.actions,locks:history.locks,openingAllocation:openingAllocation(),hangingS:{status:'unknown',evidence:[]},hangingL:{status:'unknown',evidence:[]},extraZ:{status:'unknown',baseline:null,allocations:[]}};
 const h=history,instance=id=>id===null?null:clone(h.pieces[id]);
 const center=clone(h.center);for(const list of ['pending','debt'])for(const obligation of center[list])obligation.rootBag=h.pieces[obligation.rootId]?.bag??null;
 const account=zAccount(h),extraStatus=!h.extraZ.baseline?'unknown':profileLost(h)?'out-of-profile':h.reset.status==='active'||account.remaining===0?'used':'available';
 return{schemaVersion:1,terminal:Boolean(h.observation.topOut),coverage:clone(h.coverage),actions:h.actions,locks:h.locks,dPattern:clone(h.dPattern),reset:clone(h.reset),publicBag:publicBag(h),openingAllocation:openingAllocation(h),instances:{active:instance(h.active),hold:instance(h.hold),queue:h.queue.map(instance)},observedSL:h.fresh?Object.values(h.pieces).filter(p=>'SL'.includes(p.type)).map(p=>({id:p.id,type:p.type,bag:p.bag})):[],flow:{ageKnown:h.fresh,oldestFirst:[h.active,h.hold,...h.queue].filter(id=>id!==null).map(instance).sort((a,b)=>(a.observedOrder??Infinity)-(b.observedOrder??Infinity))},center,coveredRepair:clone(h.coveredRepair),hangingS:hanging(h),hangingL:hangingL(h),extraZ:{status:extraStatus,...clone(h.extraZ),...account,reason:!h.extraZ.baseline?'First TSD and source pattern are not sufficient: the source allocation/quality baseline must be verified.':'Conserved opening allowance plus actual Reset Left-T identities minus all subsequent non-Right Z allocations. Current Right duties remain independent.'},milestones:clone(h.milestones),allocations:clone(h.allocations),pairs:clone(h.pairs),source:{url:SOURCE,sections:['2','3.2','7','8','9','10']},note:'Observed resource evidence; planner validates replay context separately. Reset markers and allocations are replay-validated; no fixed completion allowance is granted.'};
}
return Object.freeze({start,applyAction,markHandoff,beginReset,resolve,exportContext,importContext,classifySL,advanceSLMilestones,limits:Object.freeze({actions:MAX_ACTIONS,locks:MAX_LOCKS})});
});
