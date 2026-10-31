/* Milestone-one finite-information coach. No fixture IDs, seeds or hidden queues. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js'),require('./st-structure.js'),require('./st-paired-repair.js'),require('./st-access.js'),require('./st-pattern-history.js'),require('./st-left-foundation.js'),require('./st-resource-history.js'),require('./st-midgame-resources.js'),require('./st-left-context.js')):factory(root.STRules,root.STBag,root.STStructure,root.STPairedRepair,root.STAccess,root.STPatternHistory,root.STLeftFoundation,root.STResourceHistory,root.STMidgameResources,root.STLeftContext);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,S,X,A,H,Y,RH,M,L){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
// Ordinary midgame assigns Right (columns 8–10) to Z, T and I. Inspect the
// actual lock, including HOLD and boundary-crossing minos; existing board
// colors, target origins and claimed region/repair labels are not authority.
function ordinaryRightEligible(event){return !event.cells.some(([x])=>x>=7)||['Z','T','I'].includes(event.type);}
// The shared construction presenter also serves the existing paired-T recovery.
// Only a freshly replay-verified, Reset-eligible proof receives this private
// scope. No serialized construction kind or caller option can exempt a route.
const pairedResetProofs=new WeakSet(),pairedResetScope=Symbol('paired-reset-scope'),pendingLStageDisabled=Symbol('pending-L-stage-disabled'),pendingLSelections=new WeakSet(),pendingLHint=Symbol('pending-L-replay-hint');
function constructionPolicyOptions(advice,options){return{...options,[pairedResetScope]:pairedResetProofs.has(advice?.evidence?.construction),[pendingLStageDisabled]:Boolean(advice?.evidence?.construction)};}
function resourceSummary(raw,options={}){return RH.resolve(raw,options.resourceContext?RH.importContext(raw,options.resourceContext):RH.start(raw));}
function ordinaryResourceCheck(raw,path,options={}){const summary=resourceSummary(raw,options);if(options.resourceContext&&summary.coverage?.status==='invalid')return{valid:false,reason:'invalid-resource-context'};return M.checkPath(raw,path,summary);}
function checkedResourceEndpoint(raw,path,options={}){const result=resourceEndpointCore(raw,path,options);if(options.budgetTracker)options.budgetTracker.nodes+=(result.visited||0);return result;}
function resourceEndpointCore(raw,path,options={}){
 const checked=ordinaryResourceCheck(raw,path,options);if(!checked.valid&&(options[pendingLStageDisabled]||checked.reason!=='center-partner-blocked-by-T-or-unseen'||!M.pendingLStageEligible(checked.state,checked.resource)))return{...checked,visited:0};
 let visited=0;const delayedDPlans=[];const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??45000;

 const observed=resourceSummary(raw,options);
 let dPending=observed.dPattern?.pending===true,centerDeparture=false,virtual=extendForced(observe(raw)),notches=H.resolve(observe(raw),options.patternHistory),projected=M.start(virtual,observed);for(const [index,step] of path.entries()){const r=R.replay(virtual,step.witness);if(!r.valid||r.events.length!==1)return{...checked,valid:false,visited,reason:'invalid-resource-witness'};if(!options[pairedResetScope]&&!ordinaryRightEligible(r.events[0]))return{...checked,valid:false,visited,reason:'ordinary-right-requires-Z-T-I'};const phase=S.advanceNotches(virtual.board,{state:r.state,event:r.events[0]},notches);if(!phase.valid)return{...checked,valid:false,visited,reason:'invalid-resource-repair-phase'};notches=phase.pattern;
  dPending=L.isD(r.state.board); // Current D needs a usable J for support even when its creator is unknown.
  if(dPending){
   // An actually executed next J exit can be proved by this whole public
   // path, including its later reserved-piece restoration. The isolated
   // immediate-J helper deliberately has a shorter/hole-free grammar.
   // No saved flag grants this exception: full resource, repair and access
   // validation below still applies to every lock and the final endpoint.
   const exit=path[index+1]&&R.replay(r.state,path[index+1].witness);
   const executedExit=exit?.valid&&exit.events.length===1&&exit.events[0].type==='J'&&
    exit.events[0].cells.every(([x])=>x<4)&&!L.isD(exit.state.board)&&
    JSON.stringify(exit.events[0])===JSON.stringify(path[index+1].event);
   if(!executedExit){
    const dAdmission=dPatternExitAdmission(virtual,{state:r.state,event:r.events[0],witness:step.witness},{...options,notches,maxNodes:Math.max(0,limit-visited),deadline,now,resource:projected});visited+=dAdmission.visited;
    if(!dAdmission.valid)return{...checked,valid:false,visited,reason:dAdmission.reason};
    if(dAdmission.delayedPlan)delayedDPlans.push({afterLock:index+1,...dAdmission.delayedPlan});
   }
  }
  const next=M.step(virtual,{...step,state:r.state,event:r.events[0]},projected),event=r.events[0];
  // A literal payment of an authenticated retained SL target is not new
  // unsupported construction merely because the post-clear motif is absent.
  // It cannot erase an unrelated earlier departure, manufacture a stage, or
  // forgive a lost target: exact generated geometry and actual closure agree.
  const exactSL=event.type==='L'&&event.lines===0&&projected.pendingCenter.some(p=>p.family==='SL'&&Number.isInteger(p.rootId)&&p.rootId>0&&!p.lost&&
   !next.pendingCenter.some(q=>q.rootId===p.rootId)&&p.alternatives.some(a=>a.piece==='L'&&centerCellsKey(a.cells)===centerCellsKey(event.cells))&&
   S.geometry(virtual.board).center.completions.some(c=>S.supportedCenterCompletion(c,[p])&&c.piece==='L'&&centerCellsKey(c.cells)===centerCellsKey(event.cells)));
  const center=S.geometry(r.state.board,{notches}).center;
  if(event.lines===0&&event.cells.every(([x])=>x>=4&&x<=6)&&!supportedCenterPattern(center)&&!exactSL)centerDeparture=true;
  projected=next;
  if(supportedCenterPattern(center))centerDeparture=false;
  virtual=r.state;}
 // Retention cannot turn imported claims into an eligibility exception. An
 // exceptional intermediate Center must actually return to a supported shape
 // in this replayed visible prefix; all existing resource/access checks remain.
 if(centerDeparture)return{...checked,valid:false,visited,reason:'unsupported-center-without-executed-repair'};
 // Shared by fresh advice AND construction/ordinary retention. A replayed
 // construction flag cannot make an observed pre-existing obligation vanish.
 if(options.resourceContext&&!['complete','partial'].includes(observed.coverage.status))return{...checked,valid:false,visited,reason:'unverified-covered-repair-history'};
 const restoration=A.repairPrefix(extendForced(observe(raw)),path,{notches:H.resolve(raw,options.patternHistory),initialDebt:observed.coveredRepair?.cells,stages:observed.center?.pending});
 if(!restoration.valid)return{...checked,valid:false,visited,reason:'unresolved-covered-cells',coveredRepair:restoration};
 if(checked.resource.tCollision){
  const access=R.tDoubleAccess(checked.state.board,{maxNodes:Math.max(0,limit-visited),deadline,now});visited+=access.visited;
  const replay=access.reachable?R.replay(checked.state,access.witness):null;
  if(!replay?.valid||replay.events.length!==1||replay.events[0].type!=='T'||replay.events[0].spin!=='full'||replay.events[0].lines!==2)return{...checked,valid:false,visited,reason:'pending-T-collision-without-score'};
 }
 const repair=resourceRepair(checked.state,checked.resource,{...options,notches,coveredDebt:restoration.outstandingCells,maxNodes:Math.min(4000,Math.max(0,limit-visited)),deadline,now});visited+=repair.visited;
 return{...checked,valid:repair.valid===true,reason:repair.valid===true?null:repair.status,visited,repair,delayedDPlans};
}
// Chapter 3.3's D caveat is an admission condition, not a reward. This
// bounded certificate uses post-creation public inventory and an actual J
// exit, either next or after one exact authenticated Center payment. Mere
// preview presence and hypothetical spawns cannot discharge it.
function dPatternAdmission(before,p,options={}){
 if(!L.createsD(before.board,p.state.board))return{valid:true,visited:0,reason:'no-new-D-pattern'};
 return dPatternExitAdmission(before,p,options);
}
function immediateDPatternExitAdmission(before,p,options={}){
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??4000;
 const rejected=new Set(),key=exit=>JSON.stringify([exit.state.board,exit.state.active,exit.state.hold,exit.state.queue]);
 let visited=0,lastReason=null;
 while(true){
  const proof=L.dExit(p.state,{...options,now,deadline,maxNodes:Math.max(0,limit-visited),acceptExit:e=>!rejected.has(key(e))});visited+=proof.visited;
  if(!proof.valid)return{...proof,visited,reason:proof.complete&&lastReason?lastReason:proof.reason};
  const phase=S.advanceNotches(p.state.board,proof.exit,options.notches??S.notchPattern(p.state.board));
  let reason=null;
  if(!phase.valid||S.transition(p.state,proof.exit,undefined,{notches:options.notches}).cycleViolations.length)reason='D-J-exit-conflicts-with-cycle';
  const prior=options.resource?M.step(before,p,options.resource):M.start(p.state,resourceSummary(p.state,options));
  const next=M.step(p.state,proof.exit,prior);
  if(next.violations.length)reason='D-J-exit-resource-conflict';
  if(!reason){
   // Supporting replacement cannot recursively borrow another unproved D.
   // Do not reuse the weaker resourceRepair cache for this stronger grammar.
   const repair=M.repair(proof.exit.state,next,{...options,notches:phase.pattern,maxNodes:Math.max(0,limit-visited),acceptStep:(s,p)=>!L.createsD(s.board,p.state.board)});visited+=repair.visited;
   if(repair.valid)return{...proof,valid:true,visited};
   reason='D-J-exit-resources-unrepaired';
  }
  lastReason=reason;rejected.add(key(proof.exit));
  if(visited>=limit||now()>=deadline)return{valid:false,complete:false,visited,reason:'D-J-exit-budget-unfinished'};
 }
}
// A delayed J is supported only via one concrete, authenticated Center
// payment that leaves Left unchanged, followed by the old strict J proof.
// No arbitrary waiting search or preview-type promise supplies permission.
function dPatternExitAdmission(before,p,options={}){
 const immediate=immediateDPatternExitAdmission(before,p,options);
 if(immediate.valid||options.disableDelayedJPlan||immediate.reason!=='D-created-without-immediate-J')return immediate;
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??4000;
 let visited=immediate.visited||0;if(now()>=deadline||visited>=limit)return{...immediate,complete:false,visited,reason:'D-J-exit-budget-unfinished'};
 const summary=resourceSummary(before,options),prior=options.resource||M.start(before,summary);
 if(!['complete','partial'].includes(summary.coverage.status)&&!options.resource)return immediate;
 const actual=R.replay(before,p.witness);if(!actual.valid||actual.events.length!==1||JSON.stringify(actual.events[0])!==JSON.stringify(p.event)||JSON.stringify(actual.state.board)!==JSON.stringify(p.state.board))return immediate;
 const state=actual.state,resource=M.step(before,{...p,state,event:actual.events[0]},prior),notches=options.notches??S.notchPattern(state.board);
 if(resource.violations.length||!L.isD(state.board))return immediate;
 for(const pending of resource.pendingCenter){
  if(!Number.isInteger(pending.rootId)||pending.rootId<=0||pending.lost)continue;
  for(const c of S.geometry(state.board,{notches}).center.completions){
   if(c.piece!==state.active?.type||!S.supportedCenterCompletion(c,[pending])||c.witness.includes('HOLD'))continue;
   if(now()>=deadline||visited+c.witness.length>limit)return{...immediate,complete:false,visited,reason:'D-J-exit-budget-unfinished'};
   visited+=c.witness.length;const paid=R.replay(state,c.witness);if(!paid.valid||paid.events.length!==1)continue;
   const event=paid.events[0],step={state:paid.state,event,witness:c.witness};
   if(event.lines||!event.cells.every(([x])=>x>=4&&x<7)||!pending.alternatives.some(a=>a.piece===event.type&&centerCellsKey(a.cells)===centerCellsKey(event.cells))||!paid.state.board.every((row,y)=>row.slice(0,4)===state.board[y].slice(0,4)))continue;
   const phase=S.advanceNotches(state.board,step,notches);if(!phase.valid||S.transition(state,step,undefined,{notches}).cycleViolations.length||A.newlyCovered(state.board,paid.state.board,event,phase.pattern).length||S.cavityRepairDebt(S.cavityFacts(state.board),S.cavityFacts(paid.state.board),event).length)continue;
   const next=M.step(state,step,resource);if(next.violations.length||next.pendingCenter.some(q=>q.rootId===pending.rootId)||next.pendingCenter.some(q=>!resource.pendingCenter.some(old=>old.rootId===q.rootId)))continue;
   // Direct call prevents recursive waiting and retains J/Center identity checks.
   const exit=immediateDPatternExitAdmission(state,step,{...options,resource,notches:phase.pattern,maxNodes:Math.max(0,limit-visited),now,deadline});visited+=exit.visited||0;
   if(!exit.valid){if(exit.complete===false)return{...exit,visited};continue;}
   const path=[step,exit.exit],access=A.prefix(state,path,{notches,maxNodes:Math.max(0,limit-visited),now,deadline});visited+=access.visited||0;
   if(access.reachable!==true||now()>=deadline||visited>limit)continue;
   const j=placedResource(next,exit.exit.witness);
   return{...exit,valid:true,complete:true,visited,reason:'executed-Center-payment-then-J-exit',delayedPlan:{origin:observe(state),resourceBinding:resource.originKey,paidRootId:pending.rootId,paidPieceId:placedResource(resource,step.witness)?.id,jPieceId:j?.id,steps:path.map(q=>({witness:q.witness.slice(),event:clone(q.event)})),claim:'One exact public Center payment followed by an actual J exit; no unknown arrival or indefinite waiting.'}};
  }
 }
 return{...immediate,visited};
}
// Successful completion witnesses may be reused only inside one synchronous plan.
// Bind the actual pose, inventory, resource identities and phase; caller evidence
// never supplies this private cache and failed/budget-limited probes are not saved.
const resourceRepairCache=Symbol('resource-repair-cache'),rightCapAdmission=Symbol('right-cap-admission'),supportedSLAdmission=Symbol('supported-SL-admission');
function resourceRepair(state,resource,options){
 options={...options,waitingHint:options[pendingLHint]??null};
 const cache=options[resourceRepairCache],key=JSON.stringify([observe(state),M.binding(resource),options.notches,options.coveredDebt||[],Boolean(resource.pendingLDiverted),Boolean(options[pendingLStageDisabled]),options.waitingHint]);
 if(cache?.has(key))return{...cache.get(key),visited:0,reused:true};
 const eligible=!options[pendingLStageDisabled]&&M.pendingLStageEligible(state,resource),hasL=[resource.active,resource.hold,...resource.queue].some(p=>p?.type==='L');
 let proof=eligible&&!hasL?M.pendingLStage(state,resource,options):M.repair(state,resource,options);
 if(!proof.valid&&eligible&&hasL&&(proof.visited||0)<options.maxNodes){const extra=M.pendingLStage(state,resource,{...options,maxNodes:Math.max(0,options.maxNodes-(proof.visited||0))});proof={...extra,visited:(proof.visited||0)+(extra.visited||0)};}
 if(proof.valid)cache?.set(key,proof);return proof;
}
function pendingLProof(proof){return proof?.waitingStage?{status:proof.status,rootId:proof.rootId,origin:clone(proof.origin),hintReplayed:proof.hintReplayed||0,target:clone(proof.target),endpointTarget:clone(proof.endpointTarget),waiting:proof.path.map(p=>({witness:p.witness.slice(),event:clone(p.event)})),publicDrawsExhausted:proof.publicDrawsExhausted,parkedHold:proof.parkedHold,arrival:'not-established',scope:proof.scope}:null;}

function pendingLPresentation(path,assessment,construction,proof,delayedDPlans=[]){const result=advicePresentation(path,assessment,construction);if(delayedDPlans.length)result.reason+=' A public Center completion followed by J Left has been checked for the D surface.';if(proof?.waitingStage)result.reason+=' The exact Center L target remains pending; the visible intervening pieces have a checked waiting route. L arrival is not yet established.';return result;}

function resourceBinding(raw,options={}){return M.start(extendForced(raw),resourceSummary(raw,options)).originKey;}

const holdCount=p=>p.holdCount??p.witness.filter(a=>a==='HOLD').length;
const holdPrompt=p=>holdCount(p)===2?'Hold twice. ':holdCount(p)?'Hold once. ':'';
const ADVICE_SOURCES={
  "SHOCKY-1": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 1: The ST Stacking Timeline and Anatomy",
    "id": "SHOCKY-1",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Defines Left as columns 1–4, Center as 5–7, Right as 8–10, Pocket as column 10, Well as column 8, and a Z covering the Pocket as capped. Supports terminology, not this checked cap-replacement sequence."
  },
  "SHOCKY-3.1": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 3.1: The Right",
    "id": "SHOCKY-3.1",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Describes repeated Z-cap/T-spin-double play and I placement in Pocket/Well. Prefer the Pocket when both I placements are available. Does not certify a particular computed route."
  },
  "SHOCKY-3.2": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 3.2: The Center",
    "id": "SHOCKY-3.2",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Describes SL, OJ, LO and ZJ overhang pairs. LO can leave a Hanging S; ZJ needs contextual Z accounting. ZJ can be built in either order, and placement order depends on the position. A matching shape alone does not establish whole-run piece balance."
  },
  "SHOCKY-4": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 4: The Reset",
    "id": "SHOCKY-4",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Describes using two T pieces with Z pieces to rebuild Left/Center, and distinguishes mino parity from S/L parity. The project’s finite paired-T repair is not proof of a completed Reset."
  },
  "SHOCKY-8": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapters 8: The Extra Z and 9: Remembering What You’ve Forgotten",
    "id": "SHOCKY-8",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Discusses one Extra Z in the Midgame and observable piece-flow clues. A local cap replacement is not sufficient evidence that the historical Extra Z remains available."
  },
  "FLAME-TETRIS": {
    "url": "https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking",
    "section": "Tetrising",
    "id": "FLAME-TETRIS",
    "label": "Flamewheel's ST Stacking Guide",
    "scope": "Explains I-piece clears of right-side residue and prefers the rightmost option when both are available. Timing advice is written for timed Ultra and is not a universal survival rule."
  },
  "FLAME-CENTER": {
    "url": "https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking",
    "section": "Center Stacking",
    "id": "FLAME-CENTER",
    "label": "Flamewheel's ST Stacking Guide",
    "scope": "Explains two-piece center combinations with an open lower-right corner and a level three-wide top; capping here means finishing a combination. Its color-based piece names differ from current Guideline letters."
  },
  "FLAME-LEFT": {
    "url": "https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking",
    "section": "Left-Side Stacking",
    "id": "FLAME-LEFT",
    "label": "Flamewheel's ST Stacking Guide",
    "scope": "Describes shaped left surfaces and accommodation for awkward pieces, not a universal rule to keep all four left columns flat."
  },
  "SHOCKY-LEFT": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapters 3.3: The Left; 5: The Inconvenient I Piece; 6: The Pesky O Piece",
    "id": "SHOCKY-LEFT",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Normal Left is not fully flat; local O-friendly surfaces matter; horizontal I placements are exceptional."
  }
};

// Presentation only: source background never supplies a move or changes ranking.
function advicePresentation(path,assessment={},construction=null){
 const first=path[0];if(!first)return{reason:'No checked move is available.',sources:[]};
 const ids=new Set(),add=(...keys)=>keys.forEach(k=>ids.add(k));
 const facts=first.structuralEvidence??{},center=p=>p.event.cells.every(([x])=>x>=4&&x<7);
 const tsdAt=path.findIndex(p=>p.event.spin==='full'&&p.event.lines===2);
 const region=[...new Set(first.event.cells.map(([x])=>x<4?'Left (columns 1–4)':x<7?'Center (columns 5–7)':'Right (columns 8–10)'))].join(' / ');
 let structural='';
 if(construction){
  const tRepairs=path.filter(p=>p.event.type==='T'&&p.event.lines===0).length;
  if(first.event.spin==='full'&&first.event.lines===2){structural='Take the checked T-spin double.';add('SHOCKY-3.1');}
  else if(construction.kind==='cap-deferral'){
   const capAt=path.findIndex(p=>p.event.type==='Z'&&p.event.cells.some(([x])=>x>=7));
   structural=capAt===0?'Place Z on the Right to restore the cap over the Pocket (column 10).':`Place ${first.event.type} in the ${region} as shown.`;
   if(capAt>0)structural+=` The checked sequence restores the Z cap in ${capAt+1} placements, including this one.`;
   add('SHOCKY-1');
  }else{
   structural=first.event.type==='T'&&!first.event.lines?(tRepairs>1?`Place T in the ${region} to begin the checked paired-T mino-parity repair.`:`Place T in the ${region} to balance the checked pair of T placements.`):`Build the ${region} with ${first.event.type} as shown.`;
   if(tRepairs)add('SHOCKY-4');if(center(first))add('SHOCKY-3.2','FLAME-CENTER');
  }
  if(construction.kind==='left-scoring-foundation')structural+=' This I supplies the missing Left cells in the checked Z/T scoring rows; it replaces optional preparation, not an existing cleanup I.';
  if(construction.kind==='left-support')structural+=' Fill the checked Left support before covering it; a distinct visible I completes the original Right preparation at the end of this finite route.';
  if(construction.kind==='left-foundation')structural+=' This checked pair fills the missing Left cells beside the next scoring rows; it does not yet complete the Center or prove the next score.';
  if(tsdAt>0){structural+=` This checked sequence reaches a T-spin double in ${tsdAt+1} placements, including this one.`;add('SHOCKY-3.1');}
  structural+=construction.kind==='left-scoring-foundation'?' This finite scoring construction does not certify the exposed Center motif or continued play.':construction.kind==='cap-deferral'?' This verifies a visible cap replacement, not whether an Extra Z remains available.':' This finite repair is not proof of a completed Reset.';
 }else{
  let pair=facts.pairProgress;
  // A scored first lock can expose a center-only suffix that was not the
  // original root pair. Describe its actual checked cells, without mutating
  // planner evidence or assuming preparation history from a piece letter.
  const partner=S.CENTER_PAIRS[first.event.type];
  if(center(first)&&first.event.lines===0&&partner&&facts.structure?.center.patternSupport==='reference-supported'){
   const key=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
   // A checked S/L completion can follow a real TSD. Translate the original
   // S's exact supported targets, never infer a different later pair or trust
   // a copied completed-in-prefix label after its L step has been removed.
   if(first.event.type==='S'&&pair?.status==='completed-in-checked-prefix')pair=null;
   let alternatives=facts.structure.center.completions.filter(c=>c.piece===partner&&c.resultStatus==='level'&&c.patternSupport==='reference-supported').map(c=>c.cells);
   for(let i=1;i<path.length;i++){
    const next=path[i];if(next.event.lines){if(first.event.type!=='S')break;const rows=next.event.clearedRows||[];alternatives=alternatives.map(cells=>cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(r=>r>y).length])).filter(cells=>cells.every(([,y])=>y>=0));continue;}
    if(next.event.cells.some(([x])=>x>=4&&x<7)){
     if(center(next)&&next.event.type===partner&&alternatives.some(cells=>key(cells)===key(next.event.cells)))pair={status:'completed-in-checked-prefix',step:1,orderedPieces:[first.event.type,partner],completionLock:i+1};
     break;
    }
   }
  }
  if(pair?.status==='completed-in-checked-prefix'&&pair.step===1){
   const [a,b]=pair.orderedPieces;structural=`Place ${a} in the Center. ${pair.completionLock===2?'Then place '+b:'The checked sequence later places '+b} to complete the ${a}/${b} overhang.`;add('SHOCKY-3.2','FLAME-CENTER');
  }else if(pair?.status==='completed'&&pair.step===2){structural=`Complete the ${pair.orderedPieces.join('/')} center overhang as shown.`;add('SHOCKY-3.2','FLAME-CENTER');}
  else if(facts.allocation==='horizontal-left-I'&&facts.structure?.left.flat){structural='Place I across the Left as shown.';add('SHOCKY-LEFT','FLAME-LEFT');}
  else if(facts.allocation==='center-partner-preparation'){structural='Build the Center as shown. A completing placement has not been checked yet.';add('SHOCKY-3.2','FLAME-CENTER');}
  else if(facts.allocation==='center-completion'){structural=new Set(facts.structure?.center.profile).size===1?'Complete the center overhang with a level top.':'Build the Center as shown; more work is needed to finish the overhang.';add('SHOCKY-3.2','FLAME-CENTER');}
  else if(facts.allocation==='quad-preparation'){structural='Prepare the I-piece Tetris on the Right, keeping the Well (column 8) open.';add('SHOCKY-3.1','FLAME-TETRIS');}
  else if(facts.allocation==='right-cap-preparation'){structural='Rebuild the Z cap over the Pocket (column 10) as shown.';add('SHOCKY-1');
   const follow=path.slice(1);if(follow.length&&follow.every(p=>!p.event.lines&&p.event.cells.every(([x])=>x<4)))structural+=` Then build the Left with ${follow.map(p=>p.event.type).join(' then ')}.`;
  }else if(facts.allocation==='left-filler'){structural='Build within the Left four columns.';add('SHOCKY-LEFT');}
  let tactical;
  if(tsdAt>=0){tactical=tsdAt===0?'Take the T-spin double.':`This checked sequence reaches a T-spin double in ${tsdAt+1} placements, including this one.`;add('SHOCKY-3.1');}
  else{
   const quad=first.event.type==='I'&&first.event.lines===4;
   const column=first.event.cells[0][0]+1;
   tactical=quad?`Take the Tetris in ${column===8?'the Well (column 8)':column===10?'the Pocket (column 10)':'column '+column}. `:first.event.lines===0?'Place here without clearing a line. ':'Place here. ';
   if(assessment.right?.entry?.status==='reachable-if-T-available')tactical+='At the end of this sequence, a T-spin-double entry is reachable if a T is available.';
   else if(assessment.channel?.openBelowStack){tactical+='At the end of this sequence, the Well (column 8) stays below the Left and Center stacks.';add('SHOCKY-1');}
   else tactical+='The end position still needs rebuilding on the Right. Continued ST play is not established.';
   if(first.event.type==='I'&&first.event.lines===4)add('SHOCKY-3.1','FLAME-TETRIS');
  }
  structural=[structural,tactical].filter(Boolean).join(' ');
 }
 if(facts.levelBaseReentry)structural+=' This one placement restores a recognized Center pattern from the level-two base. It does not repair existing Left gaps or prove the next score.';
 return{reason:holdPrompt(first)+structural,sources:[...ids].map(id=>({...ADVICE_SOURCES[id]}))};
}
function observe(input){
 const s=R.createState({rules:input.rules,board:input.board,active:input.active,hold:input.hold,canHold:input.canHold,queue:input.queue,revision:input.revision,streamCursor:input.streamCursor,topOut:input.topOut});
 if(input.bag)s.bag=clone(input.bag);return s;
}
// Opening-only cavity query; independent reference tests bind both assessment
// modes to the same top-connected sealed-air set.
function cavityAssessment(board){
 const air=new Uint8Array(400),todo=new Uint16Array(400);let tail=0;
 for(let x=0;x<10;x++)if(board[0][x]==='.') {air[x]=1;todo[tail++]=x;}
 // Enqueue each reachable cell once. This is the same top-connected air
 // flood, not tetromino access; marking on enqueue avoids duplicate work.
 for(let i=0;i<tail;i++){const key=todo[i],x=key%10,y=Math.floor(key/10);
  if(x>0&&!air[key-1]&&board[y][x-1]==='.') {air[key-1]=1;todo[tail++]=key-1;}
  if(x<9&&!air[key+1]&&board[y][x+1]==='.') {air[key+1]=1;todo[tail++]=key+1;}
  if(y>0&&!air[key-10]&&board[y-1][x]==='.') {air[key-10]=1;todo[tail++]=key-10;}
  if(y<39&&!air[key+10]&&board[y+1][x]==='.') {air[key+10]=1;todo[tail++]=key+10;}
 }
 const sealedCells=[];for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(board[y][x]==='.'&&!air[y*10+x])sealedCells.push([x,y]);
 return{sealedCells};
}
function assess(board,{cavitiesOnly=false}={}){
 if(cavitiesOnly)return cavityAssessment(board);
 const heights=Array.from({length:10},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
 // Air flood identifies sealed cavities, not every roofed cell. A T-slot under
 // an overhang can be accessible from the side and is not automatically bad.
 const {sealedCells,sealed,covered,leftSealed}=S.cavityFacts(board,heights);
 const slots=[];for(let y=Math.max(17,40-Math.max(...heights)-4);y<39;y++)for(let x=5;x<9;x++)for(let rotation=0;rotation<4;rotation++){
  const a={type:'T',x,y,rotation,lastRotation:{from:(rotation+3)%4,to:rotation,kickIndex:0}};
  if(!R.fits(board,a)||R.fits(board,{...a,y:y+1})||R.spin(board,a)==='none')continue;
  const cells=R.cells(a),rowSet=new Set(cells.map(c=>c[1]));let lines=0;for(const ry of rowSet)if([...board[ry]].every((v,cx)=>v!=='.'||cells.some(([xx,yy])=>xx===cx&&yy===ry)))lines++;
  if(lines===2)slots.push({x,y,rotation,lines,access:'geometry-only'});
 }
 const uniqueSlots=[...new Map(slots.map(s=>[`${s.x},${s.y}`,s])).values()];
 const left=heights.slice(0,4),center=heights.slice(4,7),right=heights.slice(7);
 const roughness=left.slice(1).reduce((n,h,i)=>n+Math.abs(h-left[i]),0);
 const maxHeight=Math.max(...heights), rightHeight=Math.max(...right),leftHeight=Math.max(...left),centerHeight=Math.max(...center);
 // Right-hand ST reservoir: estimate, not legality or a proof of continuation.
 const imbalance=Math.max(0,rightHeight-Math.max(leftHeight,centerHeight)+3);
 const regionImbalance=Math.max(0,Math.abs(centerHeight-leftHeight)-4);
 const partnerDeficit=center.reduce((sum,h)=>sum+centerHeight-h,0);
 const establishedBase=leftHeight>=2&&centerHeight>=3&&heights.slice(0,7).filter(h=>h>=2).length>=5;
 // Input may be between stable shapes after a checked clear. Broader admission
 // does not certify it: the returned endpoint must still satisfy strict support.
 const recoverableBase=establishedBase||(leftHeight>=1&&centerHeight>=5&&heights.slice(0,7).filter(h=>h>=1).length>=4);
 const maintenanceScope=recoverableBase&&heights[7]<Math.max(leftHeight,centerHeight);
 const regionalSupport=establishedBase&&heights[7]<=Math.min(leftHeight,centerHeight)-2;
 return {maintenanceScope,regionalSupport,regionImbalance,channel:{column:7,height:heights[7],openBelowStack:heights[7]<=Math.min(leftHeight,centerHeight)-2},heights,maxHeight,headroom:20-maxHeight,sealed,sealedCells,leftSealed,covered,damageSealed:sealed,damageCovered:covered,left:{height:leftHeight,roughness},center:{height:centerHeight,profile:center,partnerDeficit,partnerStatus:partnerDeficit?'unfinished-open-surface':'level-surface'},right:{height:rightHeight,slots:uniqueSlots},
  obligations:uniqueSlots.map(s=>({kind:'T-slot',demands:['T'],status:'unresolved',at:[s.x,s.y],note:'Geometric slot; arrival and executable entry not yet proved.'})).concat(partnerDeficit?[{kind:'center-partner',demands:[],openSurfaceCells:partnerDeficit,status:'unresolved',note:'Uneven center surface, not a requirement to fill every gap; compatible piece identity must be established by a checked continuation, not guessed from a silhouette.'}]:[]),
  estimate:-leftSealed*12-(sealed-leftSealed)*2-covered-roughness*1.3-imbalance*4-regionImbalance*4-maxHeight*.3,
  assumptions:['Structural estimates are heuristic; only the returned input prefix is verified.']};
}
// Full assessment depends only on the raw board and the fixed full mode. Phase,
// supply and mutable candidate annotations are added later and are not cached.
// A reader belongs to one planCore invocation, including a separate reader for
// nested plans. Never expose its pristine bases to callers or keep it globally.
function createAssessmentReader(read=assess){const cache=new Map();
 const copy=value=>{if(Array.isArray(value))return value.map(copy);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value))out[key]=copy(value[key]);return out;}return value;};
 return board=>{const key='full:'+board.join('');let base=cache.get(key);
  if(base===undefined){base=read(board);if(cache.size>=256)cache.delete(cache.keys().next().value);}
  else cache.delete(key);
  cache.set(key,base);
  // Preserve numeric identity (including -0); JSON cloning would change it.
  return copy(base);
 };
}
const cavityRepairDebt=S.cavityRepairDebt;
const centerCellsKey=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
function centerReservationStep(before,p,inherited=[],notches){
 // Reserve only known finishing placements, not every hypothetical preparatory
 // silhouette. Ordinary shape transformations remain governed by geometry.
 const completions=S.geometry(before.board,{notches:notches??S.notchPattern(before.board)}).center.completions.filter(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported');
 const matches=c=>c.piece===p.event.type&&centerCellsKey(c.cells)===centerCellsKey(p.event.cells);
 const completed=completions.filter(matches).map(c=>({piece:c.piece,cells:c.cells.map(c=>c.slice())}));
 // The target must still be a recognized safe completion after any support
 // changes, not merely the same tetromino placed at remembered coordinates.
 let debt=inherited.filter(group=>!completed.length||!group.alternatives.some(matches));
 const cleared=p.event.clearedRows||[];
 const translate=cells=>cells.map(([x,y])=>[x,y<0||cleared.includes(y)?-1:y+cleared.filter(r=>r>y).length]);
 if(!completed.length&&completions.some(c=>c.piece===p.event.type)){
  const alternatives=completions.map(c=>({piece:c.piece,cells:c.cells.map(c=>c.slice())}));
  const key=JSON.stringify(alternatives);if(!debt.some(g=>JSON.stringify(g.alternatives)===key))debt=[...debt,{alternatives}];
 }
 debt=debt.map(group=>({alternatives:group.alternatives.map(c=>({...c,cells:translate(c.cells)}))}));
 return {debt,completed};
}
// Normalize completion identity through the exact clear map, not total lines.
// New rows entering the top have no root-cell identity and cannot substitute
// for an older reservation merely because their coordinates happen to match.
function centerGoalKeys(path){let rows=Array.from({length:40},(_,y)=>y);const keys=[];
 for(const p of path){for(const goal of p.structuralEvidence?.centerReservation?.completed||[]){
  if(goal.cells.every(([,y])=>rows[y]!==null&&rows[y]!==undefined))keys.push(goal.piece+':'+centerCellsKey(goal.cells.map(([x,y])=>[x,rows[y]])));
 }const cleared=p.event.clearedRows||[];rows=[...Array(cleared.length).fill(null),...rows.filter((_,y)=>!cleared.includes(y))];}
 return [...new Set(keys)];
}
// A finite preparation is the executed placement, not a promise that its
// hypothetical partner arrives. Normalize identities through actual clears.
function centerStageKeys(path){let rows=Array.from({length:40},(_,y)=>y);const keys=[];
 for(const p of path){const t=p.structuralEvidence,c=t?.structure?.center;
  if(t?.pairProgress?.step===1&&Array.isArray(t.pairProgress.completion?.cells)&&c&&reusableCenter(c)&&p.event.cells.every(([,y])=>rows[y]!=null)){
   const partner=t.pairProgress.completion;
   if(partner.cells.every(([,y])=>rows[y]!=null))keys.push(p.event.type+':'+centerCellsKey(p.event.cells.map(([x,y])=>[x,rows[y]]))+':'+partner.piece+':'+centerCellsKey(partner.cells.map(([x,y])=>[x,rows[y]])));
  }
  const cleared=p.event.clearedRows||[];rows=[...Array(cleared.length).fill(null),...rows.filter((_,y)=>!cleared.includes(y))];
 }return [...new Set(keys)];
}
function certifiedCavities(n){
 // Replanning begins after every lock. Do not issue a first placement with
 // unresolved new sealing debt: a later repair witness is not a persistent
 // commitment in the next observation. This is uncertified, not illegal.
 return !n.centerDebt.length&&!n.cavityDebt.length&&!n.path[0].structuralEvidence.cavityRepair.cells.length;
}
function repairedPrefix(state,steps){
 let before=assess(state.board),debt=[],centerDebt=[];
 for(let i=0;i<steps.length;i++){const replay=R.replay(state,steps[i].witness);if(!replay.valid||replay.events.length!==1)return false;const after=assess(replay.state.board);centerDebt=centerReservationStep(state,{state:replay.state,event:replay.events[0]},centerDebt).debt;debt=cavityRepairDebt(before,after,replay.events[0],debt);if(i===0&&debt.length)return false;state=replay.state;before=after;}
 return debt.length===0&&centerDebt.length===0;
}
// Resource accounting describes executed locks, not a quota or a ban on Reset
// fillers. Only a verified route creates a reservation across replanning.
function policyWitnesses(state){
 const starts=[{state,witness:[]}];let held=state;
 for(let i=1;i<=2;i++){const next=R.move(held,'HOLD');if(next===held||next.topOut)break;held=next;starts.push({state:held,witness:Array(i).fill('HOLD')});}
 const hasCap=from=>S.geometry(from.board).right.completions.some(c=>{
  const r=R.replay(from,c.witness);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&!r.events[0].lines&&JSON.stringify(r.events[0].cells)===JSON.stringify(c.cells);
 });
 const availableCap=starts.some(a=>a.state.active?.type==='Z'&&hasCap(a.state));
 let availableCleanupPreparation=false;
 if(S.geometry(state.board).right.cycle.prepareColumn!==null)for(const a of starts){
  if(a.state.active?.type!=='I')continue;let cur=a.state,witness=a.witness.slice();
  for(let turns=0;turns<4&&cur.active.rotation!==1;turns++){const n=R.move(cur,'CW');if(n===cur)break;cur=n;witness.push('CW');}
  while(cur.active.x!==7){const move=cur.active.x<7?'R':'L',n=R.move(cur,move);if(n===cur)break;cur=n;witness.push(move);}
  if(cur.active.rotation!==1||cur.active.x!==7)continue;
  const r=R.replay(state,[...witness,'HD']);if(!r.valid||r.events.length!==1||S.transition(state,{state:r.state,event:r.events[0]}).allocation!=='quad-preparation')continue;
  let z=r.state;if(z.active?.type!=='Z')z=R.move(z,'HOLD');
  if(z.active?.type==='Z'&&!z.topOut&&hasCap(z)){availableCleanupPreparation=true;break;}
 }
 return {availableCap,availableCleanupPreparation};
}
// A finite covered-cell repair carries its ORIGINAL public input and witnesses.
// Recreate the certificate on every retention; neither a copied flag nor a
// newly revealed queue can turn a hypothetical movement route into supply.
function repairStepEvidence(proof,index,initialDebt=[]){
 const record=proof.steps[index],entering=index?proof.steps[index-1].outstanding:initialDebt;
 return{created:record.created,outstanding:record.outstanding,required:Boolean(entering.length||record.created.length),stage:Boolean(index===proof.steps.length-1&&proof.stage)};
}
function checkedCoveredRepair(raw,steps,options={},saved=null){
 const validSteps=value=>Array.isArray(value)&&value.length>0&&value.length<=7&&value.every(p=>p&&Array.isArray(p.witness)&&p.witness.length>0&&p.witness.length<=256);
 if(!validSteps(steps)||saved&&!validSteps(saved.steps))return null;
 let rawState;try{rawState=observe(raw);}catch{return null;}const state=extendForced(rawState);
 let origin=rawState,whole=steps,consumed=0,originOptions=options;
 if(saved){
  if(!Number.isInteger(saved.consumed)||saved.consumed<0||!Array.isArray(saved.steps)||saved.steps.length>7||saved.consumed>=saved.steps.length)return null;
  try{origin=observe(saved.origin);}catch{return null;}
  if(R.validate(origin).length||origin.bag&&B.validate(origin.bag).length)return null;
  whole=saved.steps;consumed=saved.consumed;originOptions={...options,patternHistory:saved.patternHistory,resourceContext:saved.resourceContext};
  if(steps.length!==whole.length-consumed)return null;
  let current=extendForced(origin);
  for(let i=0;i<consumed;i++){const r=R.replay(current,whole[i].witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(whole[i].event))return null;current=r.state;}
  // HOLD and mid-piece movement may consume part of this lock's witness.
  // Only its original inventory states can bind; extra preview is a reveal,
  // never an inserted earlier supply or changed board.
  let bound=sameObservedResult(current,state);
  for(const action of whole[consumed].witness){if(action==='HD')break;current=R.move(current,action);bound=bound||sameObservedResult(current,state);}
  if(!bound)return null;
  current=state;
  for(let i=0;i<steps.length;i++){const r=R.replay(current,steps[i].witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(whole[consumed+i].event))return null;current=r.state;}
 }
 const observed=resourceSummary(origin,originOptions);
 if(originOptions.resourceContext&&!['complete','partial'].includes(observed.coverage.status))return null;
 const initialDebt=observed.coveredRepair?.cells||[];
 const proof=A.repairPrefix(extendForced(origin),whole,{notches:H.resolve(origin,originOptions.patternHistory),initialDebt,stages:observed.center?.pending});
 if(!proof.valid)return null;
 const relevant=proof.steps.slice(consumed).map((p,i)=>repairStepEvidence(proof,consumed+i,initialDebt));
 const needed=relevant.some(p=>p.required);
 if(saved){
  const resource=ordinaryResourceCheck(origin,whole,originOptions);
  if(!resource.valid&&(resource.reason!=='center-partner-blocked-by-T-or-unseen'||!M.pendingLStageEligible(resource.state,resource.resource)))return null;
 }
 const plan=needed?{origin:observe(origin),steps:whole.map(p=>({witness:p.witness.slice(),event:clone(p.event)})),consumed,patternHistory:clone(originOptions.patternHistory??null),resourceContext:clone(originOptions.resourceContext??null)}:null;
 return{proof,plan,steps:steps.map((p,i)=>({...p,structuralEvidence:{...p.structuralEvidence,coveredRepair:relevant[i]}}))};
}
function cycleResources(path){
 const events=path.map(p=>p.event),tsds=events.filter(e=>e.type==='T'&&e.spin==='full'&&e.lines===2).length;
 const quads=events.filter(e=>e.type==='I'&&e.lines===4).length;
 const pocket=path.filter(p=>p.event.type==='I'&&!p.event.lines&&p.structuralEvidence?.allocation==='quad-preparation').length;
 let outstandingPocket=0;for(const p of path){if(p.event.type==='I'&&!p.event.lines&&p.structuralEvidence?.allocation==='quad-preparation')outstandingPocket++;if(p.event.type==='I'&&p.event.lines===4)outstandingPocket=Math.max(0,outstandingPocket-1);}
 return {leftFoundations:path.filter(p=>p.structuralEvidence?.leftFoundation?.completed).length,centerPreparations:centerStageKeys(path).length,centerCompletions:centerGoalKeys(path).length,locks:path.length,lines:events.reduce((n,e)=>n+e.lines,0),materialDelta:4*path.length-10*events.reduce((n,e)=>n+e.lines,0),tsds,quads,pocket,outstandingPocket,
  tFillers:events.filter(e=>e.type==='T'&&!e.lines).length,iFillers:events.filter(e=>e.type==='I'&&!e.lines&&e.cells.some(([x])=>x<7)).length};
}
function resourceGoal(path){const r=cycleResources(path);return r.tsds+r.quads+r.pocket+r.centerCompletions+r.centerPreparations+r.leftFoundations>0||path.some(p=>p.structuralEvidence?.coveredRepair?.required);}
// Compare only the resources protected by the outstanding goal. Incidental I
// use on a T-only route is not an I reservation. Trailing post-goal filler must
// not make an otherwise equivalent proof appear longer or more wasteful.
function resourceGoalPrefix(path,goal){
 const centerGoals=centerGoalKeys(goal),primary=cycleResources(goal),stageGoals=primary.tsds+primary.quads+primary.pocket+primary.centerCompletions?[]:centerStageKeys(goal),hasCenter=prefix=>centerGoals.every(key=>centerGoalKeys(prefix).includes(key))&&stageGoals.every(key=>centerStageKeys(prefix).includes(key));
 const repairRequired=goal.some(p=>p.structuralEvidence?.coveredRepair?.required),hasRepair=prefix=>{if(!repairRequired)return true;const end=prefix.at(-1)?.structuralEvidence?.coveredRepair;return Boolean(prefix.some(p=>p.structuralEvidence?.coveredRepair?.required)&&end&&(!end.outstanding.length||end.stage));};
 const required=cycleResources(goal),fulfils=a=>a.tsds>=required.tsds&&a.quads>=required.quads&&a.outstandingPocket+Math.max(0,a.quads-required.quads)>=required.outstandingPocket;
 let b=required;for(let length=1;length<=goal.length;length++){const prefix=cycleResources(goal.slice(0,length));if(fulfils(prefix)&&hasCenter(goal.slice(0,length))&&hasRepair(goal.slice(0,length))){b=prefix;break;}}
 for(let length=1;length<=path.length;length++){
  const a=cycleResources(path.slice(0,length));
  if(fulfils(a)&&hasCenter(path.slice(0,length))&&hasRepair(path.slice(0,length))&&
   (!b.tsds||a.tFillers<=b.tFillers)&&(!(b.quads+b.outstandingPocket)||a.iFillers<=b.iFillers))return length;
 }
 return null;
}
// A saved executable score has a timing promise as well as a count. Compare
// each required TSD/quad separately: a later mixed Center/Pocket goal must not
// hide delaying an earlier score. This is a replacement rule, not a global
// preference to score immediately or authority supplied by imported telemetry.
function scoringSchedule(path){
 const schedule={tsds:[],quads:[]};path.forEach((p,i)=>{if(p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2)schedule.tsds.push(i+1);if(p.event.type==='I'&&p.event.lines===4)schedule.quads.push(i+1);});return schedule;
}
function scoringReplacement(candidate,saved,goal){
 const required=scoringSchedule(goal.path),fresh=scoringSchedule(candidate.path),delayed=[];
 for(const kind of ['tsds','quads'])for(let i=0;i<required[kind].length;i++)if(fresh[kind][i]===undefined||fresh[kind][i]>required[kind][i])delayed.push({kind,index:i+1,savedLock:required[kind][i],freshLock:fresh[kind][i]??null});
 if(!delayed.length)return{allowed:true,reason:'no-protected-score-delay',required,fresh,delayed};
 if(delayed.some(p=>p.freshLock===null))return{allowed:false,reason:'missing-protected-score',required,fresh,delayed};
 if(candidate.path.length!==saved.path.length)return{allowed:false,reason:'no-equal-horizon-benefit-proof',required,fresh,delayed};
 const a=candidate.assessment,b=saved.assessment,mass=n=>n.state.board.reduce((sum,row)=>sum+[...row].filter(c=>c!=='.').length,0),am=mass(candidate),bm=mass(saved);
 // Reuse the conservative construction dominance precedent. A blended
 // structural estimate, more Center height, or fewer inputs alone is not
 // concrete evidence for delaying the score. Final admission still proves
 // all actual movement, resource, cavity and notch obligations.
 const noRegression=a.maxHeight<=b.maxHeight&&am<=bm&&a.sealed<=b.sealed&&a.structure.left.covered<=b.structure.left.covered&&(candidate.centerContinuity??0)>=(saved.centerContinuity??0);
 const benefit=noRegression&&(a.maxHeight<b.maxHeight||am<bm);
 return{allowed:benefit,reason:benefit?'endpoint-dominance':'delay-without-concrete-benefit',required,fresh,delayed,endpoint:{fresh:{maxHeight:a.maxHeight,mass:am,sealed:a.sealed,leftCovered:a.structure.left.covered,centerContinuity:candidate.centerContinuity??0},saved:{maxHeight:b.maxHeight,mass:bm,sealed:b.sealed,leftCovered:b.structure.left.covered,centerContinuity:saved.centerContinuity??0}}};
}
function coversResourceGoal(candidate,committed){
 // nodeFor rebuilds BOTH fresh and saved nodes from actual current history.
 // A promised SL payment cannot be replaced by an unrelated LO completion.
 // Future interchangeable S identities are not fixed before actual placement.
 return resourceGoalPrefix(candidate.path,committed.path)!==null&&
  (!committed.ordinarySAllocationEnabled||(candidate.slAllocation?.paid.length??0)>=(committed.slAllocation?.paid.length??0));
}
function sameObservedResult(expected,actual){return expected.rules===actual.rules&&JSON.stringify(expected.board)===JSON.stringify(actual.board)&&expected.hold===actual.hold&&expected.active?.type===actual.active?.type&&expected.canHold===actual.canHold&&expected.topOut===actual.topOut&&expected.queue.every((t,i)=>actual.queue[i]===t);}
function committedNode(s,proof,roots,initial,readAssessment=assess){
 if(!proof?.observation||!proof.advice?.continuation?.length)return null;
 let origin;try{origin=observe(proof.observation);}catch{return null;}if(R.validate(origin).length)return null;
 const steps=proof.advice.continuation;if(steps.length>7||!resourceGoal(steps))return null;
 const expected=R.replay(origin,steps[0].witness);if(!expected.valid||expected.events.length!==1)return null;
 let first=roots.find(p=>JSON.stringify(p.event)===JSON.stringify(expected.events[0])&&sameObservedResult(expected.state,p.state));
 // A budget-truncated enumeration must not discard an already executable
 // exact witness. Replay is bounded by the saved public prefix, not search.
 if(!first){const r=R.replay(s,steps[0].witness);if(r.valid&&r.events.length===1&&JSON.stringify(r.events[0])===JSON.stringify(expected.events[0])&&sameObservedResult(expected.state,r.state))first={state:r.state,event:r.events[0],target:r.events[0].target,witness:steps[0].witness,hold:steps[0].witness.includes('HOLD')};}
 if(!first||!ordinaryRightEligible(first.event))return null;const rootIndex=roots.indexOf(first),flags=policyWitnesses(s);
 first={...first,availableCap:first.availableCap||flags.availableCap,availableCleanupPreparation:first.availableCleanupPreparation||flags.availableCleanupPreparation};
 let n=nodeFor(first,null,initial,rootIndex,readAssessment);
 for(const step of steps.slice(1)){const r=R.replay(n.state,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!ordinaryRightEligible(r.events[0]))return null;
  n=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(n.state)},n,initial,n.rootIndex,readAssessment);
 }
 const repair=A.repairPrefix(s,n.path,{notches:initial.notches,initialDebt:initial.coveredRepair?.cells,stages:initial.coveredStages});
 if(!repair.valid)return null;
 // Only an already observed obligation promotes an otherwise goal-free saved
 // suffix. A merely proposed future roof is not a mandatory construction.
 if(initial.coveredRepair?.cells.length)n.path=n.path.map((p,i)=>({...p,structuralEvidence:{...p.structuralEvidence,coveredRepair:repairStepEvidence(repair,i,initial.coveredRepair.cells)}}));
 return resourceGoal(n.path)&&n.path.every(p=>S.canonicalClear(p.event))&&n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport?n:null;
}
function sameConstructionResult(expected,actual){
 if(expected.rules!==actual.rules||JSON.stringify(expected.board)!==JSON.stringify(actual.board)||expected.hold!==actual.hold||expected.canHold!==actual.canHold||expected.topOut!==actual.topOut||(expected.active&&expected.active.type!==actual.active?.type)||!expected.queue.every((t,i)=>actual.queue[i]===t))return false;
 if(expected.bag){if(!actual.bag)return false;let bag=expected.bag;const revealed=expected.active?actual.queue.slice(expected.queue.length):[...(actual.active?[actual.active.type]:[]),...actual.queue];for(const t of revealed)bag=B.consume(bag,t);if(JSON.stringify(bag)!==JSON.stringify(actual.bag))return false;}
 return true;
}
// A deliberately narrow Reset-entry policy, not a universal timing rule.
// Shocky Ch4 motivates rebuilding depleted Center support; page366 is the
// finite recovery example and page813 is the ordinary-scoring counterexample.
// The height cutoffs below describe THIS coach's coverage, not community laws.
function resetCandidate(s,initial){
 const result=(status,reason)=>({policy:'joint-low-visible-pair-v2',status,reason,
  ordinaryComparison:initial.maintenanceScope?'ordinary-geometric-profile':'ordinary-profile-unsupported',
  source:'SHOCKY-4',claim:'Finite recovery preference within coach coverage; not proof that ordinary play is impossible or a complete Reset.',
  resourceRenewal:false});
 if(s.topOut||!s.active)return result('out-of-scope','A live active piece is required.');
 if(['broken','invalid-history'].includes(initial.notches.status))return result('out-of-scope','Scoring-notch history is broken or unverified; do not initiate recovery.');
 if(initial.maintenanceScope)return result('ordinary-preferred','Ordinary geometric profile is present; this is not proof of an executable maintenance continuation.');
 if(initial.left.height>initial.right.height+2||initial.center.height>initial.right.height+2||Math.abs(initial.left.height-initial.center.height)>3)return result('not-ready','Right must have nearly caught both Left and Center, with Left/Center mutually balanced; this is a narrow engineering envelope, not a universal Reset timing rule.');
 if(initial.left.height<2||initial.center.height>=3||initial.notches.status!=='established')return result('out-of-scope','This is not the supported established-stack depleted-Center case.');
 const right=S.geometry(s.board).right;
 if(right.shapeStatus!=='staggered-scoring-wall')return result('out-of-scope','An established staggered scoring wall is required.');
 if(right.completions.length||right.cycle.prepareColumn!==null||right.cycle.cleanupColumns.length)return result('competing-demand','Cap or I cleanup demand must not be displaced by this recovery.');
 const visible=[s.active.type,s.hold,...s.queue].filter(Boolean);
 if(visible.filter(p=>p==='T').length<3)return result('visible-supply-unproved','Two repair Ts and a scoring T are not all visible; do not assume future arrivals.');
 return result('candidate','Center is below the supported maintenance profile; a complete visible paired-T recovery must still be proved.');
}
function resetSelection(raw,options={}){
 let s;try{s=observe(raw);if(R.validate(s).length||(s.bag&&B.validate(s.bag).length))throw new Error('invalid');}catch{return{policy:'joint-low-visible-pair-v2',status:'invalid-observation',resourceRenewal:false};}
 return resetCandidate(s,{...assess(s.board),notches:H.resolve(s,options.patternHistory)});
}
// Construction history is an executable public proof, never an imported mode.
// Recreate its complete route and bind the consumed prefix to the current board.
function verifyConstruction(proof,options={}){return proof.kind==='left-scoring-foundation'?Y.scoringValidate(proof.origin,proof.steps,{...options,patternHistory:proof.patternHistory}):proof.kind==='left-support'?Y.supportValidate(proof.origin,proof.steps,options):proof.kind==='left-foundation'?Y.validate(proof.origin,proof.steps,options):X.validateCertificate(proof.origin,proof.steps,{...options,kind:proof.kind});}
// A chosen macro retains its proof-specific fields, but never discards work
// already spent searching and certifying competing continuations.
function constructionMetrics(candidate,spent,elapsedMs){return{...spent,...candidate.metrics,nodes:spent.nodes,elapsedMs};}
// Bind this new exception to the actual originally observed inventory. A
// later refill cannot be inserted retroactively into a copied proof origin.
function supportHistoryBinding(s,proof,verified,options,deadline,now,maxNodes){
 const prior=proof.resourceContext,current=options.resourceContext,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);let visited=0;
 const fail=()=>({valid:false,visited});
 try{
  if(!prior||!current||!Array.isArray(prior.steps)||!Array.isArray(current.steps)||prior.steps.length>current.steps.length||!same(prior.origin,current.origin)||prior.fresh!==current.fresh||prior.handoffAtAction!==current.handoffAtAction||!same(current.steps.slice(0,prior.steps.length),prior.steps))return fail();
  if(![...(proof.kind==='left-scoring-foundation'?['partial']:[]),'complete'].includes(resourceSummary(proof.origin,{resourceContext:prior}).coverage.status)||![...(proof.kind==='left-scoring-foundation'?['partial']:[]),'complete'].includes(resourceSummary(s,options).coverage.status))return fail();
  const tail=current.steps.slice(prior.steps.length);if(tail.length>1792||tail.filter(p=>p.action==='HD').length!==proof.consumed)return fail();
  let state=observe(proof.origin),locked=0,actionsSinceLock=[];
  for(const step of tail){if(now()>=deadline||visited>=maxNodes)return fail();visited++;const next=R.move(state,step.action);if(next===state)return fail();
   if(step.action==='HD'){if(!same(next.lastEvent,verified.continuation[locked++]?.event))return fail();actionsSinceLock=[];}else actionsSinceLock.push(step.action);
   state={...next,queue:[...next.queue,...step.revealed]};for(const piece of step.revealed)if(state.bag)state={...state,bag:B.consume(state.bag,piece)};
  }
  const actual=observe(state),expected=observe(s);delete actual.revision;delete expected.revision;return{valid:same(actual,expected),visited,actionsSinceLock};
 }catch{return fail();}
}
function constructionAdvice(s,proof,deadline=Infinity,now=()=>Date.now(),maxNodes=12000,budgetTracker=null,historyOptions={}){
 if(proof?.kind==='left-support'&&historyOptions.allowHold===false)return null;
 if(!proof||proof.kind!==undefined&&!['cap-deferral','left-support','left-foundation','left-scoring-foundation'].includes(proof.kind)||!Number.isInteger(proof.consumed)||proof.consumed<0||proof.consumed>=proof.steps?.length)return null;
 let visited=0,followedActions=[];const charge=n=>{visited+=n||0;if(budgetTracker)budgetTracker.nodes+=n||0;};
 if(!proof.kind&&resetSelection(proof.origin).status!=='candidate')return null;
 const verified=verifyConstruction(proof,{timeMs:Math.max(0,Math.min(750,deadline-now())),deadline,now,maxNodes,allowHold:historyOptions.allowHold});charge(verified.visited);if(!verified.valid)return null;
 if(!A.repairPrefix(extendForced(observe(proof.origin)),verified.continuation,{notches:H.resolve(proof.origin,proof.patternHistory)}).valid)return null;
 if(proof.kind!==undefined&&verified.continuation.slice(proof.consumed).some(p=>!ordinaryRightEligible(p.event)))return null;
 if(['left-support','left-scoring-foundation'].includes(proof.kind)){
  const binding=supportHistoryBinding(s,proof,verified,historyOptions,deadline,now,Math.max(0,maxNodes-visited));charge(binding.visited);if(!binding.valid)return null;followedActions=binding.actionsSinceLock;
  const replayUnits=verified.continuation.reduce((n,p)=>n+p.witness.length,0);if(now()>=deadline||visited+replayUnits>maxNodes)return null;charge(replayUnits);
  const paid=ordinaryResourceCheck(proof.origin,verified.continuation,{resourceContext:proof.resourceContext}),r=paid.resource;
  if(!paid.valid||!r||r.pendingCenter.length||r.hangingS.length||r.centerBlocked||r.tCollision||r.unclassifiedS?.some(p=>p.invalidated||p.requiresAccommodation))return null;
 }

 const replay=(state,witness)=>{if(proof.kind==='left-scoring-foundation'){if(now()>=deadline||visited+witness.length>maxNodes)return{valid:false,events:[]};charge(witness.length);}return R.replay(state,witness);};
 let expected=observe(proof.origin);
 for(const step of verified.continuation.slice(0,proof.consumed)){const r=replay(expected,step.witness);if(!r.valid)return null;expected=r.state;}
 if(JSON.stringify(expected.board)!==JSON.stringify(s.board))return null;
 let current=s;const continuation=[];
 for(const [index,step]of verified.continuation.slice(proof.consumed).entries()){
  const future=replay(expected,step.witness);if(!future.valid)return null;const expectedAfter=future.state;
  const matches=r=>r.valid&&r.events.length===1&&JSON.stringify(r.events[0])===JSON.stringify(step.event)&&sameConstructionResult(expectedAfter,r.state);
  let witness=step.witness;
  // Exact followed HOLD cycles can return to the same public pose. Prefer the
  // authenticated action suffix, not a replayable full witness that repeats it.
  if(proof.kind==='left-scoring-foundation'&&index===0&&followedActions.length&&followedActions.every((a,i)=>step.witness[i]===a))witness=step.witness.slice(followedActions.length);
  let r=replay(current,witness);
  if(!matches(r)&&index===0){
   // The user may already have followed HOLD/movement inputs, or switched
   // active and held pieces. Bind an equivalent actual first-lock witness to
   // the SAME verified event and public result, never just a saved mode flag.
   for(let k=1;k<step.witness.length;k++){const prefix=replay(expected,step.witness.slice(0,k));if(!prefix.valid||!sameObservedResult(prefix.state,current))continue;
    const trial=replay(current,step.witness.slice(k));if(matches(trial)){witness=step.witness.slice(k);r=trial;break;}
   }
   if(!matches(r)&&now()<deadline&&visited<maxNodes){const e=R.placements(current,{deadline,now,maxNodes:maxNodes-visited,...(proof.kind==='left-scoring-foundation'?{allowHold:historyOptions.allowHold}:{} )});charge(e.visited);const found=e.placements.find(p=>JSON.stringify(p.event)===JSON.stringify(step.event)&&sameConstructionResult(expectedAfter,p.state));if(found){witness=found.witness;r={valid:true,state:found.state,events:[found.event]};}}
  }
  if(!matches(r))return null;
  current=r.state;expected=expectedAfter;continuation.push({...step,witness,target:step.event.target,hold:witness.includes('HOLD'),holdCount:holdCount({witness}),resultContext:context(current)});
 }
 if(['left-support','left-scoring-foundation'].includes(proof.kind)&&(now()>=deadline||visited>maxNodes))return null;
 const first=continuation[0],done=verified.continuation.slice(0,proof.consumed);
 const resetOrigin=!proof.kind?resetSelection(proof.origin):null;
 const resetDecision=resetOrigin?.status==='candidate'?{...resetOrigin,status:proof.consumed?'continuing':'selected',
  reason:'Prefer the checked paired-T recovery to abstention outside the ordinary maintenance profile.',
  certifiedLocks:verified.continuation.length,consumedLocks:proof.consumed}:null;
 const admittedProof=clone(proof);if(proof.kind===undefined)pairedResetProofs.add(admittedProof);
 const presentation=advicePresentation(continuation,assess(current.board),proof);
 if(resetDecision)presentation.reason+=' '+(proof.consumed?'Continue the checked depleted-Center recovery.':'Use this recovery because Center is below the coach’s ordinary maintenance profile, not because all ordinary play is impossible.');
 const parity=done.filter(p=>p.event.type==='T'&&!p.event.lines).reduce((v,p)=>v+p.event.cells.reduce((n,[x,y])=>n+((x+y)%2?1:-1),0),0);
 return {status:'recommended-with-verified-prefix',revision:s.revision,context:context(s),target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation,
  ...presentation,
  metrics:{nodes:visited,endpointMass:current.board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0),depth:continuation.length,completeDepth:continuation.length,elapsedMs:verified.elapsedMs},assessment:assess(current.board),
  evidence:{strategy:proof.kind==='cap-deferral'?'finite-cap-deferral':'finite-regional-repair',...(resetDecision?{resetSelection:resetDecision}:{}),construction:admittedProof,cycleResources:cycleResources(continuation),cycleDebt:0,verifiedLocks:continuation.length,knownPieceHorizon:s.queue.length+1,
   constructionStage:{parity,capDebt:verified.cap&&proof.consumed<=verified.cap.paidAt?verified.cap.targets:[],remainingLocks:continuation.length,zAllocation:'Only the executed public route is reserved; no Extra-Z history is inferred.',completion:proof.kind==='left-scoring-foundation'?'Finite visible I/Z/T score completed; exposed Center geometry and continued play remain uncertain.':proof.kind==='left-support'?'Finite Left support and actual Right-I replacement completed; no score or continued play is promised.':proof.kind==='left-foundation'?'Finite Left foundation completed; Center partner and future scoring remain unproved.':'Finite supported TSD endpoint, not a completed Reset.'},claim:'Finite executable regional repair; continued play is not guaranteed.'}};
}
function continueConstruction(before,after,advice,event,options={}){
 const proof=advice?.evidence?.construction;if(!proof)return null;
 const verified=verifyConstruction(proof,options);if(!verified.valid||!Number.isInteger(proof.consumed)||proof.consumed<0)return null;
 const expected=verified.continuation.slice(proof.consumed);
 if(!expected.length||JSON.stringify(expected.map(p=>p.event))!==JSON.stringify(advice.continuation.map(p=>p.event)))return null;
 const replayUnits=proof.kind==='left-scoring-foundation'?advice.witness.length:0;
 if(replayUnits&&((options.now||(()=>Date.now()))()>=(options.deadline??Infinity)||(verified.visited||0)+replayUnits>(options.maxNodes??12000)))return null;
 const r=R.replay(observe(before),advice.witness);
 if(!r.valid||r.events.length!==1||JSON.stringify(expected[0].event)!==JSON.stringify(event)||JSON.stringify(r.events[0])!==JSON.stringify(event)||proof.kind!==undefined&&!ordinaryRightEligible(r.events[0])||!sameObservedResult(r.state,observe(after)))return null;
 const tracker={nodes:(verified.visited||0)+replayUnits},suffix=constructionAdvice(observe(after),{...proof,consumed:proof.consumed+1},options.deadline,options.now,Math.max(0,(options.maxNodes??12000)-tracker.nodes),tracker,options);if(suffix)suffix.metrics.nodes=tracker.nodes;return suffix;
}
function continueCommitment(before,after,advice,actualEvent=after?.lastEvent,options={}){
 if(advice?.recommendation?.kind==='risky'||advice?.status==='recommended-risky-placement')return null;
 options={...options,[pendingLHint]:advice?.evidence?.pendingLStage};
 if(advice?.evidence?.construction){
  const now=options.now||(()=>Date.now()),deadline=options.deadline??now()+150,maxNodes=options.maxNodes??12000,suffix=continueConstruction(before,after,advice,actualEvent,{...options,now,deadline,maxNodes});if(!suffix)return null;
  const resources=checkedResourceEndpoint(after,suffix.continuation,constructionPolicyOptions(suffix,{...options,now,deadline,maxNodes:Math.max(0,maxNodes-suffix.metrics.nodes)}));suffix.metrics.nodes+=resources.visited||0;if(!resources.valid)return null;
  const access=A.prefix(observe(after),suffix.continuation,{notches:H.resolve(after,options.patternHistory),deadline,now,maxNodes:Math.max(0,maxNodes-suffix.metrics.nodes)});suffix.metrics.nodes+=access.visited;if(access.reachable!==true)return null;
  if(['left-support','left-scoring-foundation'].includes(advice.evidence.construction.kind)&&(now()>=deadline||suffix.metrics.nodes>maxNodes))return null;
  return{...suffix,metrics:{...suffix.metrics,certifiedHorizon:suffix.continuation.length},evidence:{...suffix.evidence,resourceObligations:{status:'checked',binding:resources.resource.originKey,delayedDPlans:resources.delayedDPlans}}};
 }
 if(!advice?.continuation?.length||advice.continuation.length<2)return null;
 let origin,s;try{origin=observe(before);s=observe(after);}catch{return null;}if(R.validate(origin).length||R.validate(s).length)return null;
 const first=R.replay(origin,advice.continuation[0].witness);if(!first.valid||first.events.length!==1||!actualEvent||JSON.stringify(first.events[0])!==JSON.stringify(actualEvent)||!S.canonicalClear(actualEvent)||!ordinaryRightEligible(first.events[0])||!sameObservedResult(first.state,s))return null;
 const savedRepair=advice.evidence?.coveredRepairPlan;
 // options belongs to AFTER the lock. Do not validate that history against
 // the old observation when there was no original repair plan to preserve.
 const originalRepair=savedRepair?checkedCoveredRepair(origin,advice.continuation,options,savedRepair):null;if(savedRepair&&!originalRepair)return null;
 // A genuine newly admitted roof carries its original certificate. Legacy
 // or forged advice without it cannot create an unrecorded repair exception.
 if(!savedRepair&&A.newlyCovered(origin.board,first.state.board,first.events[0],S.advanceNotches(origin.board,{state:first.state,event:first.events[0]}).pattern).length)return null;
 const afterDebt=originalRepair?.proof.steps[originalRepair.plan?.consumed??0]?.outstanding||[];
 const pendingPlan=originalRepair?.plan&&afterDebt.length?{...originalRepair.plan,consumed:originalRepair.plan.consumed+1}:null;
 const steps=advice.continuation.slice(1);if(!resourceGoal(steps)&&!pendingPlan)return null;
 let current=extendForced(s),notches=H.resolve(s,options.patternHistory),debt=[],centerDebt=centerReservationStep(origin,{event:first.events[0],state:first.state}).debt,prior=assess(s.board);const continuation=[];if(['broken','invalid-history'].includes(notches.status))return null;
 for(const step of steps){const r=R.replay(current,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!S.canonicalClear(r.events[0])||!ordinaryRightEligible(r.events[0]))return null;
  const nextPhase=S.advanceNotches(current.board,{event:r.events[0],state:r.state},notches);if(!nextPhase.valid)return null;
  const policy=policyWitnesses(current),transition=S.transition(current,{event:r.events[0],state:r.state,...policy},S.assess(r.state,{notches:nextPhase.pattern}),{notches});if(transition.cycleViolations.length)return null;
  const centerReservation=centerReservationStep(current,{event:r.events[0],state:r.state},centerDebt,notches);centerDebt=centerReservation.debt;
  const previousState=current,previousNotches=notches,check=S.advanceNotches(current.board,{event:r.events[0],state:r.state},notches),a=assess(r.state.board);if(!check.valid||a.maxHeight>=20)return null;
  debt=cavityRepairDebt(prior,a,r.events[0],debt);if(!continuation.length&&debt.length)return null;notches=check.pattern;prior=a;current=r.state;
  continuation.push({...step,resultContext:context(current),structuralEvidence:{...S.transition(previousState,{event:r.events[0],state:r.state},S.assess(r.state,{notches}),{notches:previousNotches}),structure:S.assess(r.state,{notches}),centerReservation}});
 }
 const bounds={...options,maxNodes:options.maxNodes??12000,deadline:options.deadline??Date.now()+150},resources=checkedResourceEndpoint(s,continuation,bounds);if(!resources.valid)return null;
 if(debt.length||centerDebt.length||!prior.regionalSupport||!resourceGoal(continuation)&&!pendingPlan)return null;
 const repair=checkedCoveredRepair(s,continuation,options,pendingPlan);if(!repair)return null;
 const head=continuation[0],access=A.prefix(s,continuation,{...bounds,notches:H.resolve(s,options.patternHistory),maxNodes:Math.max(0,bounds.maxNodes-resources.visited)});if(access.reachable!==true)return null;return {...advice,target:head.target,witness:head.witness,hold:head.witness.includes('HOLD'),holdCount:holdCount(head),continuation:repair.steps,context:context(s),revision:s.revision,metrics:{...advice.metrics,certifiedHorizon:continuation.length,revalidationNodes:resources.visited+access.visited},
  ...pendingLPresentation(continuation,prior,null,resources.repair,resources.delayedDPlans),evidence:{...advice.evidence,pendingLSelection:null,coveredRepair:repair.proof,coveredRepairPlan:repair.plan,pendingLStage:pendingLProof(resources.repair),cycleResources:cycleResources(continuation),commitmentRetained:true,resourceObligations:{status:'checked',binding:resourceBinding(s,options),delayedDPlans:resources.delayedDPlans}}};
}
function context(s){return JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);}
function stateKey(s){return JSON.stringify([s.rules,s.board,s.active,s.hold,s.canHold,s.queue,s.bag??null]);}
function nodeKey(n){return stateKey(n.state)+':pendingD:'+Boolean(n.dPending)+':notches:'+n.notches.status+':'+n.notches.anchorRow+':cavities:'+JSON.stringify(n.cavityDebt.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by))+':coveredRepair:'+JSON.stringify((n.coveredRepairDebt||[]).slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by))+':center:'+JSON.stringify(n.centerDebt)+':centerContinuity:'+Boolean(n.centerContinuityDebt)+':rootSeal:'+Boolean(n.path[0].structuralEvidence.cavityRepair.cells.length)+':resources:'+(n.resources?M.binding(n.resources):'none');}
function extendForced(state){return M.extendForced(state);}
// Only an actually verified first-TSD allocation can leave this narrow quality
// obligation pending. Projected progress is a preference, never an allowance or
// a replacement for the existing access, cycle, notch and resource certificates.
function openingQualityOrder(a,b){
 if(a.openingQualityProgress==null||b.openingQualityProgress==null)return 0;
 const center=(b.centerContinuity??0)-(a.centerContinuity??0);
 return center||b.openingQualityProgress-a.openingQualityProgress;
}
function compare(a,b){for(let i=0;i<a.rank.length;i++){if(i===3){const quality=openingQualityOrder(a,b);if(quality)return quality;}if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return a.key.localeCompare(b.key);}
// A three-row motif cannot certify a deeper missing column beneath it.
// Ordered center partners fit within a tetromino-height (three-step) envelope;
// taller open deficits remain legal, but require an actually completed repair.
const reusableCenter=c=>(!c.foundation||c.foundation.status==='aligned')&&c.status!=='unrecognized'&&c.patternSupport==='reference-supported'&&(!c.profile||Math.max(...c.profile)-Math.min(...c.profile)<=3);
// Ordinary Center search uses positive modular-pattern evidence, not merely a
// score penalty for an arbitrary silhouette. This is a conservative engine
// admission boundary, not a claim that other legal constructions are impossible.
// Keep this out of nodeFor/shared roots: independently replayed finite repair
// producers must retain their non-modular intermediate placements (e.g. OSIO).
const supportedCenterPattern=c=>c.patternSupport==='reference-supported'&&c.foundation?.status==='aligned';
function ordinaryCenterEligible(before,p,notches){
 if(p.event.lines!==0||!p.event.cells.every(([x])=>x>=4&&x<=6))return true;
 const phase=S.advanceNotches(before.board,p,notches??S.notchPattern(before.board));
 return phase.valid&&supportedCenterPattern(S.geometry(p.state.board,{notches:phase.pattern}).center);
}
function centerContinuityStep(before,after,event,debt=false){
 return !reusableCenter(after)&&(debt||(event.lines===0&&reusableCenter(before)));
}
function compareConstruction(a,b){for(let i=0;i<a.rank.length;i++){
 // Do not trade an established reusable center for unresolved construction
 // merely to improve an endpoint score or cash a nearby double. Temporary
 // departures remain legal and regain this preference after actual repair.
 if(i===3&&(a.centerContinuity??0)!==(b.centerContinuity??0))return (b.centerContinuity??0)-(a.centerContinuity??0);
 if(i===3){const quality=openingQualityOrder(a,b);if(quality)return quality;}
 if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return a.key.localeCompare(b.key);}
// Keep the legacy comparator (and its deterministic fallback) unchanged.
// Reorder only slots belonging to the SAME complete continuation equivalence
// class. A pairwise "same horizon" comparator would not be transitive when a
// third, unequal-horizon candidate is interleaved by its target key.
function extraZTieClass(n){
 const r=n.resources,a=n.assessment;
 if(!n.extraZPreservable||!r||!['available','used'].includes(r.extraZ)||!n.path.length||
    !n.qualified||!n.notchValid||n.cycleDebt||!certifiedCavities(n)||a.maxHeight>=20||!a.regionalSupport||
    a.right.entry?.status==='unresolved-budget'||r.violations.length||r.centerBlocked||r.tCollision||
    r.pendingCenter.length||r.hangingS.length||r.hangingL.length||r.unclassifiedS?.length||r.unclassifiedL?.length)return null;
 // Exact existing quality values, horizon, debt and live identity supply must
 // match. Neither a structural-band tie alone nor an unused physical Z is
 // equivalent. No arbitrary ordering is introduced between different classes.
 return JSON.stringify([n.path.length,n.path.map((_,i)=>cycleResources(n.path.slice(0,i+1))),n.rank,n.structuralScore,n.centerContinuity,n.openingQualityProgress,
  n.dependencyDebt,n.entryDebt,a.maxHeight,a.sealed,a.covered,a.estimate,
  r.originKey,r.active,r.hold,r.queue,r.scoredTs]);
}
function orderContinuations(nodes){
 const ordered=[...nodes].sort(compareConstruction),groups=new Map();
 for(let i=0;i<ordered.length;i++){
  const key=ordered[i].continuationChecked===true?extraZTieClass(ordered[i]):null;if(key===null)continue;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 for(const slots of groups.values()){
  const members=slots.map(i=>ordered[i]);
  if(!members.some(n=>n.resources.extraZ==='available')||!members.some(n=>n.resources.extraZ==='used'))continue;
  const preferred=members.filter(n=>n.resources.extraZ==='available').concat(members.filter(n=>n.resources.extraZ==='used'));
  slots.forEach((slot,i)=>{ordered[slot]=preferred[i];});
 }
 return ordered;
}
// Certify the legacy winner first. A speculative preserving challenger may
// exhaust a proof budget, but cannot take away an already executable route.
function preserveExtraZ(baseline,nodes,{protect,certify}){
 const key=baseline&&extraZTieClass(baseline);
 if(key==null||baseline.resources.extraZ!=='used')return baseline;
 const challengers=nodes.filter(n=>n!==baseline&&n.resources?.extraZ==='available'&&extraZTieClass(n)===key).sort(compareConstruction);
 if(!challengers.length||!protect(baseline))return baseline;
 for(const n of challengers)if(certify(n))return n;
 return baseline;
}
// Compare only identities drawn from the literal public observation. Forced
// bag extensions and empty-HOLD extra draws cannot buy a longer horizon.
// Certification/replay is separate; this helper never supplies admission.
function publicDrawHorizon(raw,path,summary){
 const r=M.start(raw,summary),forcedTail=extendForced(raw).queue.slice(raw.queue.length),drawn=[],placed=[];let active=r.active,hold=r.hold,queue=r.queue.slice();
 const draw=()=>{const p=queue.shift()??null;if(p)drawn.push(p.id);return p;};
 for(const p of path){
  for(const action of p.witness)if(action==='HOLD'){
   if(!active)return null;
   if(hold){const previous=active;active=hold;hold=previous;}else{hold=active;active=draw();}
  }
  if(!active||active.type!==p.event.type||!Number.isInteger(active.id)||active.id<=0)return null;
  placed.push(active.id);active=draw();
  // A generated node may include a uniquely forced tail; it is not part of
  // this deliberately literal visible comparison, even if no lock used it.
  if((active?.type??null)!==(p.state.active?.type??null)||(hold?.type??null)!==p.state.hold||JSON.stringify([...queue.map(v=>v.type),...forcedTail])!==JSON.stringify(p.state.queue))return null;
 }
 return{draws:drawn.length,drawn,placed,active,hold,queue};
}
function exactAllocationPrefix(node,prefix){return node.path.length>=prefix.path.length&&prefix.path.every((p,i)=>JSON.stringify(p.witness)===JSON.stringify(node.path[i].witness)&&JSON.stringify(p.event)===JSON.stringify(node.path[i].event)&&stateKey(p.state)===stateKey(node.path[i].state));}
// Deliberately certify only the strongest already compatible reference. A
// failed/unfinished proof must not silently choose a weaker comparison target.
function certifyStrongestAllocation(nodes,certify){const strongest=orderContinuations(nodes)[0];return strongest&&certify(strongest)===true?strongest:null;}
function supportedSLComparison(candidate,reference,{candidateDraw,referenceDraw,original=reference,initialResources=null}={}){
 const result={allowed:false,reason:'comparison-unknown',candidateHorizon:candidate?.path.length??null,referenceHorizon:reference?.path.length??null,candidateDraw: candidateDraw??null,referenceDraw:referenceDraw??null};
 if(!candidate||!reference)return{...result,reason:'missing-equal-horizon-reference'};
 if(candidate.path.length!==reference.path.length)return{...result,reason:'unequal-lock-horizon'};
 if(!candidateDraw||!referenceDraw)return{...result,reason:'unknown-public-draw-horizon'};
 if(candidateDraw.draws!==referenceDraw.draws||JSON.stringify(candidateDraw.drawn)!==JSON.stringify(referenceDraw.drawn))return{...result,reason:'unequal-public-draw-horizon'};
 const certified=n=>n.continuationChecked===true&&n.qualified&&n.notchValid&&!n.cycleDebt&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport&&n.assessment.right.entry?.status!=='unresolved-budget';
 if(!certified(candidate)||!certified(reference))return{...result,reason:'uncertified-comparison'};
 const outstanding=n=>{
  const r=n.resources,root=initialResources;if(!root||!r)return[];
  return [...root.pendingCenter.filter(p=>r.pendingCenter.some(q=>q.rootId===p.rootId)||r.unclassifiedS?.some(q=>q.sId===p.rootId&&q.invalidated)).map(p=>'center:'+p.rootId),
   ...root.hangingS.filter(p=>r.hangingS.some(q=>q.id===p.id)||r.unclassifiedS?.some(q=>q.sId===p.id)).map(p=>'S:'+p.id),
   ...root.hangingL.filter(p=>r.hangingL.some(q=>q.id===p.id)||r.unclassifiedL?.some(q=>q.lId===p.id)).map(p=>'L:'+p.id)].sort();
 };
 const facts=n=>({leftScore:n.assessment.leftContext?.score,leftContext:n.assessment.leftContext,leftCovered:n.assessment.structure.left.covered,leftSealed:n.assessment.leftSealed,
  maxHeight:n.assessment.maxHeight,sealed:n.assessment.sealed,covered:n.assessment.covered,damageSealed:n.assessment.damageSealed,damageCovered:n.assessment.damageCovered,
  structuralScore:n.structuralScore,structuralRank:n.rank,centerContinuity:n.centerContinuity,dependencyDebt:n.dependencyDebt,entryDebt:n.entryDebt,
  center:n.assessment.structure.center,right:n.assessment.structure.right,entry:n.assessment.right.entry??null,intentionalReservoir:n.assessment.intentionalReservoir??null,originalOutstanding:outstanding(n),schedule:scoringSchedule(n.path),resources:cycleResources(n.path),extraZ:n.resources?.extraZ});
 const a=facts(candidate),b=facts(reference);Object.assign(result,{candidate:a,reference:b});
 if(!Number.isFinite(a.leftScore)||!Number.isFinite(b.leftScore))return{...result,reason:'unknown-left-evaluation'};
 const schedule=scoringReplacement(candidate,reference,reference),goal=original&&coversResourceGoal(candidate,original);
 // Stricter than the general retained-goal delay exception: this optional
 // preference never delays any actual canonical score in its reference.
 if(!goal||!schedule.allowed||schedule.delayed.length||a.resources.tsds<b.resources.tsds||a.resources.quads<b.resources.quads)return{...result,reason:'score-or-original-goal-regression'};
 if(a.originalOutstanding.some(key=>!b.originalOutstanding.includes(key)))return{...result,reason:'original-resource-obligation-regression'};
 if(a.resources.quads+a.resources.outstandingPocket<b.resources.quads+b.resources.outstandingPocket)return{...result,reason:'cleanup-progress-regression'};
 if(a.leftCovered>b.leftCovered||a.leftSealed>b.leftSealed||a.maxHeight>b.maxHeight||a.sealed>b.sealed||a.damageSealed>b.damageSealed||a.centerContinuity<b.centerContinuity||a.dependencyDebt>b.dependencyDebt||a.entryDebt>b.entryDebt)return{...result,reason:'explicit-safety-quality-regression'};
 if(a.leftScore<b.leftScore)return{...result,reason:'left-allocation-worse'};
 const earlier=['tsds','quads'].some(kind=>a.schedule[kind].length>b.schedule[kind].length||a.schedule[kind].some((lock,i)=>b.schedule[kind][i]!==undefined&&lock<b.schedule[kind][i]));
 if(a.leftScore===b.leftScore&&!earlier)return{...result,reason:'no-strict-left-or-score-gain'};
 return{...result,allowed:true,reason:a.leftScore>b.leftScore?'strict-left-allocation-gain':'earlier-or-additional-actual-score'};
}
// Observed identities are replay bindings, not bag guesses or transferable
// permission. This describes actual supported SL payments and Left S use.
function placedResource(resource,witness){
 if(!resource)return null;let active=resource.active,hold=resource.hold,queue=resource.queue.slice();
 for(const action of witness)if(action==='HOLD'){if(hold){const prior=active;active=hold;hold=prior;}else{hold=active;active=queue.shift()??null;}}
 return active;
}
function slAllocationStep(before,p,prior,next,notches,inherited={paid:[],left:[]}){
 const out={paid:inherited.paid.slice(),left:inherited.left.slice()},piece=placedResource(prior,p.witness);
 if(!piece||piece.type!==p.event.type||!next)return out;
 if(piece.type==='S'&&!p.event.lines&&p.event.cells.every(([x])=>x<4))out.left.push({sId:piece.id,bag:piece.bag,confirmedHanging:prior.hangingS.some(h=>h.id===piece.id)});
 if(piece.type==='L'&&!p.event.lines){
  const completions=S.geometry(before.board,{notches}).center.completions;
  for(const pending of prior.pendingCenter.filter(c=>c.family==='SL')){
   const exact=c=>c.piece==='L'&&centerCellsKey(c.cells)===centerCellsKey(p.event.cells);
   if(pending.alternatives.some(exact)&&completions.some(c=>exact(c)&&c.patternSupport==='reference-supported'&&c.resultStatus==='level')&&!next.pendingCenter.some(c=>c.rootId===pending.rootId))
    out.paid.push({sId:pending.rootId,sBag:pending.bag,lId:piece.id,lBag:piece.bag});
  }
 }
 return out;
}
function ordinarySAllocationComparison(candidate,reference,options={}){
 const base=supportedSLComparison(candidate,reference,options),a=candidate?.slAllocation,b=reference?.slAllocation,cd=options.candidateDraw,rd=options.referenceDraw;
 // Reuse every score, resource and hard quality veto. Only the existing Left
 // tier/effort preference is superseded by this explicit allocation policy.
 if(!base.allowed&&!['left-allocation-worse','no-strict-left-or-score-gain'].includes(base.reason))return base;
 const ids=d=>d&&JSON.stringify({placed:d.placed.slice().sort((a,b)=>a-b),active:d.active,hold:d.hold,queue:d.queue});
 if(!cd||!rd||ids(cd)!==ids(rd))return{...base,allowed:false,reason:'unequal-observed-allocation-inventory'};
 if(!a||!b||new Set(a.paid.map(p=>p.sId)).size!==a.paid.length||new Set(a.paid.map(p=>p.lId)).size!==a.paid.length)return{...base,allowed:false,reason:'unknown-or-duplicated-SL-allocation'};
 // Merely swapping which of two S pieces goes Left/Center is neutral. Keep
 // existing confirmed Hanging-S accommodation available without a penalty.
 const spared=b.left.filter(p=>!p.confirmedHanging&&a.paid.some(q=>q.sId===p.sId));
 const gain=a.paid.length>b.paid.length&&a.left.length<b.left.length;
 return{...base,allowed:gain&&spared.length>0,reason:gain&&spared.length?'preferred-complete-SL-allocation':'no-complete-SL-allocation-gain',allocation:{candidate:a,reference:b,sparedS:spared.map(p=>p.sId)},leftTierTradeoff:(base.candidate?.leftScore??0)-(base.reference?.leftScore??0)};
}
// This comparator is local to actual finite tail endpoints. Preserve the
// existing safety/Center/structural/scoring priorities, then compare realized
// Left value before input effort. It is not a change to main-beam ranking.
function compareSLTail(a,b){
 for(let i=0;i<5;i++){
  if(i===3){const center=(b.centerContinuity??0)-(a.centerContinuity??0);if(center)return center;const quality=openingQualityOrder(a,b);if(quality)return quality;}
  if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];
 }
 const left=(b.assessment.leftContext?.score??-Infinity)-(a.assessment.leftContext?.score??-Infinity);
 return left||compareConstruction(a,b);
}
function qualifiedSLTailOrder(nodes,qualify){
 for(const node of nodes)if(qualify(node)!==true)return null;
 return nodes.slice().sort(compareSLTail);
}
function visibleSLTailComparison(candidate,reference,options={}){
 const base=supportedSLComparison(candidate,reference,options),cd=options.candidateDraw,rd=options.referenceDraw;
 if(!base.allowed)return base;
 if(resourceGoalPrefix(candidate.path,candidate.path)!==candidate.path.length)return{...base,allowed:false,reason:'tail-not-retained-by-resource-goal'};
 const inventory=d=>d&&JSON.stringify({placed:d.placed.slice().sort((a,b)=>a-b),drawn:d.drawn,active:d.active,hold:d.hold,queue:d.queue});
 if(!cd||!rd||inventory(cd)!==inventory(rd))return{...base,allowed:false,reason:'unequal-observed-tail-inventory'};
 const paid=n=>JSON.stringify((n.slAllocation?.paid??[]).map(p=>[p.sId,p.lId]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
 if(!candidate.slAllocation?.paid.length||paid(candidate)!==paid(reference)||candidate.slAllocation.left.length!==reference.slAllocation.left.length)return{...base,allowed:false,reason:'unequal-completed-SL-allocation'};
 if(candidate.rank[3]<reference.rank[3])return{...base,allowed:false,reason:'tail-structural-band-regression'};
 if(!(base.candidate.leftScore>base.reference.leftScore))return{...base,allowed:false,reason:'no-realized-tail-left-gain'};
 return{...base,allowed:true,reason:'strict-visible-tail-left-gain'};
}
// Same paid pair, different surrounding allocation. The S must already be an
// observed root obligation; a new Center S or a guessed future L is no credit.
function pendingSLAllocationComparison(candidate,reference,options={}){
 const base=visibleSLTailComparison(candidate,reference,options);if(!base.allowed)return base;
 const root=options.initialResources,pending=root?.pendingCenter.filter(p=>p.family==='SL')??[];
 if(pending.length!==1||root.pendingCenter.length!==1||!Number.isInteger(pending[0].rootId)||pending[0].rootId<=0||pending[0].lost)return{...base,allowed:false,reason:'unknown-original-pending-SL'};
 const visible=new Set([root.active,root.hold,...root.queue].filter(p=>p?.type==='L'&&Number.isInteger(p.id)&&p.id>0).map(p=>p.id));
 const paid=candidate.slAllocation.paid.filter(p=>p.sId===pending[0].rootId&&visible.has(p.lId));
 if(paid.length!==1||candidate.slAllocation.paid.length!==1||candidate.slAllocation.left.length||candidate.path.at(-1).event.type!=='L'||options.candidateDraw.placed.at(-1)!==paid[0].lId||candidate.resources.pendingCenter.length)return{...base,allowed:false,reason:'missing-actual-last-L-payment'};
 const noNewObligation=n=>['hangingS','hangingL','unclassifiedS','unclassifiedL'].every(key=>(n.resources[key]??[]).every(p=>(root[key]??[]).some(q=>JSON.stringify(p)===JSON.stringify(q))));
 if(!noNewObligation(candidate)||!noNewObligation(reference))return{...base,allowed:false,reason:'new-pending-SL-resource-obligation'};
 if(M.binding(candidate.resources)!==M.binding(reference.resources))return{...base,allowed:false,reason:'unequal-pending-SL-resource-binding'};
 return{...base,allowed:true,reason:'strict-pending-SL-surrounding-gain',paid:clone(paid[0])};
}
function nodeFor(p,parent,initial,rootIndex,readAssessment=assess){
 const assessment=readAssessment(p.state.board),path=[...(parent?.path??[]),p];
 const before=parent?.state??initial.state,priorNotches=parent?.notches??initial.notches;
 const notchCheck=S.advanceNotches(before.board,p,priorNotches);
 const structure=S.assess(p.state,{notches:notchCheck.pattern});
 const transition=S.transition(before,p,structure,{notches:priorNotches});
 if(!ordinaryRightEligible(p.event))transition.cycleViolations.push('ordinary-right-requires-Z-T-I');
 const dPending=L.isD(p.state.board); // Geometry is known; no creation history is inferred.

 transition.futureNotches=notchCheck;
 // Eligible crossings still carry their outstanding dependencies. The Right
 // role gate has no repair/benefit exception for an S/J/L/O crossing.
 const dependencyDebt=Math.max(0,(parent?.dependencyDebt??0)+transition.dependencyDebt);
 const priorAssessment=parent?.assessment??initial;
 const cavityDebt=cavityRepairDebt(priorAssessment,assessment,p.event,parent?.cavityDebt);
 const coveredRepairDebt=A.repairStep(before.board,p.state.board,p.event,parent?.coveredRepairDebt??initial.coveredRepair?.cells??[],notchCheck.pattern);
 const centerReservation=centerReservationStep(before,p,parent?.centerDebt,priorNotches),centerDebt=centerReservation.debt;
 const resources=initial.resources?M.step(before,p,parent?.resources??initial.resources):null;
 // Search eligibility only: the endpoint proof must replay exact Center
 // payment and strict J exit. A matching preview type alone never certifies.
 const delayedCandidate=initial.disableDelayedJPlan!==true&&resources?.queue[0]?.type==='J'&&resources.pendingCenter.some(q=>Number.isInteger(q.rootId)&&q.rootId>0&&!q.lost&&q.alternatives.some(a=>a.piece===p.state.active?.type));
 if(dPending&&!L.immediateJStarts(p.state).length&&!delayedCandidate)transition.cycleViolations.push('D-without-immediate-J');
 const slAllocation=slAllocationStep(before,p,parent?.resources??initial.resources,resources,priorNotches,parent?.slAllocation);
 // A prepared scoring cavity is an access obligation, not just an endpoint
 // bonus. Losing its geometry without clearing is a repair commitment; a later
 // checked rebuilding prefix can restore it. Geometry alone is not entry proof.
 const losesEntry=priorAssessment.right.slots.length>0&&!assessment.right.slots.length&&p.event.lines===0;
 const scoredCycle=(p.event.spin==='full'&&p.event.lines===2)||p.event.lines===4;
 const entryDebt=assessment.right.slots.length||scoredCycle?0:Math.max(parent?.entryDebt??0,losesEntry?1:0);
 assessment.structure=structure;
 assessment.obligations=structure.obligations.concat(assessment.obligations.filter(o=>o.kind==='T-slot'));
 const damage=Math.max(0,assessment.leftSealed-initial.leftSealed);
 const safe=assessment.maxHeight<20&&!p.event.topOut;
 const headroomRisk=Math.max(0,assessment.maxHeight-14)**2;
 const leftContext=L.evaluate(p.state,{heights:assessment.heights.slice(0,4),covered:structure.left.covered,resources,centerDebt,center:structure.center,right:structure.right});
 const structuralScore=structure.supportEstimate+assessment.estimate-damage*4-dependencyDebt*3-headroomRisk-entryDebt*12;
 assessment.leftContext=leftContext;
 assessment.structure.headroomRisk=headroomRisk;
 const tsds=path.filter(v=>v.event.spin==='full'&&v.event.lines===2).length;
 p.structuralEvidence={...transition,centerPartnerDeficitBefore:(parent?.assessment??initial).center.partnerDeficit,centerPartnerDeficitAfter:assessment.center.partnerDeficit,placedPiece:p.event.type,structure,dependencyDebt,entryDebt,nonclearScoringGeometryLost:losesEntry,centerReservation,cavityRepair:{status:cavityDebt.length?'requires-executed-repair':'no-outstanding-new-internal-cavity',cells:cavityDebt}};
 // General source/queue preferences only break ties after the numeric
 // priorities, including executed TSD, verified entry and input effort. The
 // replay-bound pending-opening quality preference is compared separately,
 // after safety/cycle/Center continuity and before optional structural growth.
 // Nearby structural estimates are deliberately comparable. The finite
 // executable TSD then breaks ties; it cannot buy a poorer structural band.
 const cycleDebt=(parent?.cycleDebt??0)+transition.cycleViolations.length+(notchCheck.valid?0:1)+(resources?.violations.length||0);
 const rank=[safe?1:0,assessment.regionalSupport?1:0,cycleDebt?-cycleDebt:0,Math.floor(structuralScore/4),tsds*2,-path.reduce((n,v)=>n+v.witness.length+holdCount(v)*2,0),path.reduce((n,v)=>n+v.event.lines,0),leftContext.score];
 const priorCenter=(parent?.assessment.structure??S.geometry(before.board,{notches:priorNotches})).center;
 const centerDisrupted=p.event.lines===0&&reusableCenter(priorCenter)&&!reusableCenter(structure.center);
 const centerContinuityDebt=centerContinuityStep(priorCenter,structure.center,p.event,parent?.centerContinuityDebt);
 const centerContinuity=centerContinuityDebt?-1:0;
 assessment.structure.centerContinuity={disruptedWithoutClear:centerDisrupted,unresolved:centerContinuityDebt,endpointReusable:reusableCenter(structure.center),preference:centerContinuity};
 // Keep unclassified dispositions unresolved: dropping an identity from the
 // live list is not evidence that it was accommodated. No projected endpoint
 // updates the real replay ledger or manufactures Extra-Z eligibility.
 const openingQualityProgress=initial.openingQualityPending&&resources?-(resources.hangingS.length+resources.pendingCenter.length+resources.hangingL.length+(resources.unclassifiedS?.length||0)+(resources.unclassifiedL?.length||0)):null;
 if(openingQualityProgress!==null)assessment.structure.openingQuality={status:'pending-observed-quality',projectedUnresolved:-openingQualityProgress,baselineGranted:false};
 return{dPending,resources,slAllocation,ordinarySAllocationEnabled:initial.ordinarySAllocationEnabled===true,extraZPreservable:initial.extraZPreservable===true,openingQualityProgress,centerContinuity,centerContinuityDebt,state:p.state,path,notches:notchCheck.pattern,notchValid:notchCheck.valid,assessment,rank,structuralScore,dependencyDebt,entryDebt,cycleDebt,cavityDebt,coveredRepairDebt,centerDebt,baseEstimateRank:rank[4],qualified:!assessment.right.slots.length,rootIndex,key:JSON.stringify(path[0].target)+':'+holdCount(path[0])};
}
function diversify(nodes,width){const sorted=[...nodes].sort(compare),chosen=[],roots=new Set(),groups=new Set();
 // Protect meaningfully different construction families, not just top-scoring
 // near-identical surfaces. This is diversity, not a canned move template.
 for(const n of sorted){const first=n.path[0],g=[first.target.type,holdCount(first),n.assessment.right.slots.length>0].join(':');if(!groups.has(g)){chosen.push(n);roots.add(n.rootIndex);groups.add(g);if(chosen.length===width)return chosen;}}
 for(const n of sorted)if(!roots.has(n.rootIndex)){chosen.push(n);roots.add(n.rootIndex);if(chosen.length===width)return chosen;}
 const keys=new Set(chosen.map(n=>nodeKey(n)));for(const n of sorted)if(!keys.has(nodeKey(n))){chosen.push(n);keys.add(nodeKey(n));if(chosen.length===width)break;}return chosen;}
// An exact level-two Center is a construction state, not generic maintenance
// readiness. Admit only a checked one-lock return to the existing strict shape
// contract. Neither assess(), opening handoff nor the ordinary beam is widened.
function levelBaseReentry(s,initial,base,options,readAssessment=assess){
 if(options.disableConstruction||options.constructionPrevious||initial.maintenanceScope||initial.left.height<2)return null;
 const level=S.centerLevelBase(s.board,initial.notches),right=S.geometry(s.board,{notches:initial.notches}).right;
 if(level.status!=='phase-aligned-level-base'||level.level!==2||right.shapeStatus!=='cleared-base')return null;
 // A saved one-lock re-entry remains a Center resource goal through movement
 // and HOLD. Other pending goals cannot be displaced by this shorter proof.
 const saved=options.commitment;
 if(saved&&saved.advice?.continuation?.length!==1)return null;
 const now=options.now,deadline=options.deadline,limit=options.maxNodes??45000;
 const metrics={attempted:1,examined:0,verified:0,selected:false,candidateScanComplete:false};
 base.metrics.levelBaseReentry=metrics;
 const root=R.placements(s,{allowHold:options.allowHold!==false,deadline,now,maxNodes:Math.max(0,limit-base.metrics.nodes)});
 base.metrics.nodes+=root.visited;base.metrics.roots=root.placements.length;
 const unavailable=()=>({...base,status:root.complete&&metrics.candidateScanComplete?'unsupported-position':'budget-exhausted',reason:'No checked one-placement return from this level-two Center base was found. Other continuations may exist.',assessment:initial});
 if(!root.complete)return unavailable();
 // A floor-based Right may not expose a geometric capDemand yet. Do not
 // spend or postpone an actually playable Z cap to broaden this S-only fix.
 // Availability comes from these real roots, including empty/double HOLD.
 if(root.placements.some(p=>p.event.type==='Z'&&!p.event.lines&&p.event.cells.every(([x])=>x>=7)&&S.advanceNotches(s.board,p,initial.notches).valid&&S.transition(s,p,undefined,{notches:initial.notches}).allocation==='right-cap-preparation')){
  metrics.blockedByAvailableCap=true;
  return{...base,status:'no-supported-continuation-found',reason:'An executable Z cap takes priority over optional Center re-entry. No supported one-lock continuation was certified.',assessment:initial};
 }
 const candidates=[];
 for(const [index,p]of root.placements.entries()){
  if(now()>=deadline)break;
  metrics.examined++;
  if(p.event.lines||!S.canonicalClear(p.event)||p.event.type!=='S'||!p.event.cells.every(([x])=>x>=4&&x<7))continue;
  const n=nodeFor({...p},null,initial,index,readAssessment);
  if(n.cycleDebt||!n.notchValid||!certifiedCavities(n)||n.assessment.maxHeight>=20||!n.assessment.regionalSupport||!reusableCenter(n.assessment.structure.center)||n.assessment.right.slots.length)continue;
  // Existing imported Left damage remains in the assessment. A reserved
  // notch is not access debt, but any other newly roofed cell blocks this
  // deliberately narrow admission rather than borrowing an unproved repair.
  if(A.newlyCovered(s.board,p.state.board,p.event,n.notches).length)continue;
  candidates.push(n);metrics.verified++;
 }
 metrics.candidateScanComplete=metrics.examined===root.placements.length;
 let best=candidates.sort(compareConstruction)[0];
 if(saved){
  const committed=committedNode(s,saved,root.placements,initial,readAssessment);
  best=committed&&candidates.find(n=>JSON.stringify(n.path[0].event)===JSON.stringify(committed.path[0].event)&&sameObservedResult(committed.state,n.state));
 }
 if(!best)return unavailable();
 const first=best.path[0],proof={status:'checked-one-lock-return',level:level.level,anchorRow:level.anchorRow,existingLeftCovered:best.assessment.structure.left.covered};
 first.structuralEvidence.levelBaseReentry=proof;
 metrics.selected=true;base.metrics.depth=1;base.metrics.completeDepth=metrics.candidateScanComplete?1:0;
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,...advicePresentation(best.path,best.assessment),
  continuation:[{target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,event:first.event,resultContext:context(first.state),structuralEvidence:first.structuralEvidence}],assessment:best.assessment,
  evidence:{strategy:'canonical-right-ST',levelBaseReentry:proof,cycleResources:cycleResources(best.path),commitmentRetained:Boolean(saved),futureNotches:best.notches,cycleDebt:0,cavityRepair:{status:'verified-prefix-repaired',outstandingCells:[]},verifiedLocks:1,tsdAt:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:true,budgetExhausted:!metrics.candidateScanComplete||now()>=deadline,informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:true,channel:best.assessment.channel,endpointTEntry:'not-established',unresolvedObligations:best.assessment.obligations,structure:best.assessment.structure,claim:'One executable return to a recognized Center pattern; existing damage and future scoring remain unresolved.'}};
}
function planCore(raw,options={}){
 const started=Date.now(),now=options.now??(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 let s;try{s=observe(raw);}catch(e){return{status:'invalid-input',revision:raw?.revision??0,target:null,reason:'This snapshot could not be read. Check its format and try again.',errors:[e.message]};}
 const errors=R.validate(s);if(s.bag)errors.push(...B.validate(s.bag));
 const base={revision:s.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],reason:'',metrics:{nodes:0,roots:0,rootExpanded:0,depth:0,completeDepth:0,elapsedMs:0},context:context(s)};
 if(errors.length)return{...base,status:errors.includes('unsupported-profile')?'unsupported-profile':'invalid-input',reason:'Unsupported or invalid snapshot: '+errors.map(e=>e.replaceAll('-',' ')).join('; ')+'.',errors};
 if(s.topOut)return{...base,status:'no-supported-continuation-found',reason:'This position has topped out. Reset to continue.'};
 if(!s.active)return{...base,status:'insufficient-known-pieces',reason:'This snapshot has no active piece. Import another position or reset.'};
 const observedPattern=H.resolve(s,options.patternHistory);if(['invalid-history','broken'].includes(observedPattern.status))return{...base,status:'no-supported-continuation-found',reason:observedPattern.status==='broken'?'A recognized T-slot opening in column 7 is filled. The coach does not support repairing this pattern yet.':'The recorded scoring-pattern evidence could not be verified. Reset or import a fresh snapshot before continuing.'};
 if(!options.disableOpening&&(options.openingPhase||s.board.every(r=>r==='..........'))){const opening=typeof module==='object'&&module.exports?require('./st-opening.js'):globalThis.STOpening;return opening.plan(s,{...options,deadline});}
 if(options.resourceContext&&resourceSummary(s,options).coverage.status==='invalid')return{...base,status:'no-supported-continuation-found',reason:'The observed resource history could not be verified for this position.'};
 // Actual repair obligations come from authenticated history, not a pinned
 // old witness. Fresh alternatives must certify those same current cells.
 const summary=resourceSummary(s,options);s=extendForced(s);
 const readAssessment=createAssessmentReader(),initial=readAssessment(s.board);initial.state=s;initial.notches=H.resolve(s,options.patternHistory);initial.coveredRepair=summary.coveredRepair;initial.coveredStages=summary.center?.pending;initial.resources=M.start(s,summary);initial.dPending=summary.dPattern?.pending===true;initial.ordinarySAllocationEnabled=!options.disableOrdinarySAllocation;initial.disableDelayedJPlan=Boolean(options.disableDelayedJPlan);
 initial.extraZPreservable=summary.coverage?.status==='complete'&&summary.extraZ?.status==='available'&&Boolean(summary.extraZ.baseline);
 initial.openingQualityPending=summary.coverage?.status==='complete'&&summary.openingAllocation?.status==='verified-first-tsd'&&summary.extraZ?.status==='unknown'&&summary.extraZ.baseline===null&&!summary.extraZ.allocations.length&&!summary.extraZ.departures.length&&!summary.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>=summary.openingAllocation.firstTsdAt);
 if(!options.disableConstruction&&options.constructionPrevious?.evidence?.construction){const tracker={nodes:0},retained=revalidate(['left-support','left-scoring-foundation'].includes(options.constructionPrevious.evidence.construction.kind)?observe(raw):s,options.constructionPrevious,{...options,deadline,budgetTracker:tracker,maxNodes:Math.min(8000,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes))});base.metrics.nodes+=tracker.nodes;if(retained){retained.metrics.nodes=base.metrics.nodes;return retained;}}

 if(!options.disableConstruction&&options.commitment?.advice?.evidence?.construction){
  const proof=options.commitment.advice.evidence.construction,tracker={nodes:0},saved=constructionAdvice(['left-support','left-scoring-foundation'].includes(proof.kind)?observe(raw):s,proof,deadline,now,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes),tracker,options);base.metrics.nodes+=tracker.nodes;
  if(saved){
   // Consider ordinary scoring at the SAME executed horizon. A replacement
   // must re-certify the original public construction and dominate its endpoint,
   // rather than silently abandoning a pending parity/center/Z obligation.
   if(!['left-support','left-scoring-foundation'].includes(proof.kind)&&initial.maintenanceScope&&saved.continuation.length<=s.queue.length+1&&deadline-now()>100){
    const ordinary=plan(s,{...options,disableConstruction:true,deadline,commitment:null,constructionPrevious:null,depth:saved.continuation.length,maxNodes:Math.max(0,(options.maxNodes??45000)-base.metrics.nodes)});base.metrics.nodes+=ordinary.metrics?.nodes||0;
    if(ordinary.target&&ordinary.continuation.length===saved.continuation.length){
     const candidateProof={...proof,steps:[...proof.steps.slice(0,proof.consumed),...ordinary.continuation.map(p=>({witness:p.witness}))]},tracker={nodes:0},replacement=constructionAdvice(s,candidateProof,deadline,now,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;
     if(replacement){const a=replacement.assessment,b=saved.assessment,ma=replacement.metrics.endpointMass,mb=saved.metrics.endpointMass;
      if(a.maxHeight<=b.maxHeight&&ma<=mb&&(a.maxHeight<b.maxHeight||ma<mb)){replacement.metrics.nodes=base.metrics.nodes;return replacement;}
     }
    }
   }
   saved.metrics.elapsedMs=now()-started;saved.metrics.nodes=base.metrics.nodes;return saved;
  }
 }
 if(initial.notches.status==='broken'||initial.notches.status==='invalid-history')return{...base,status:'no-supported-continuation-found',reason:'A recognized T-slot opening in column 7 is filled. The coach does not support repairing this pattern yet.',assessment:initial};
 const resetDecision=resetCandidate(s,initial);
 base.evidence={resetSelection:resetDecision};
 const reentry=levelBaseReentry(s,initial,base,{...options,now,deadline},readAssessment);if(reentry){reentry.evidence={...reentry.evidence,resetSelection:{...resetDecision,status:reentry.target?'ordinary-rebuild-preferred':'uncertified',reason:reentry.target?'A checked one-lock Center rebuild takes precedence over paired-T recovery.':'The one-lock Center rebuild was not certified; this does not authorize paired-T recovery.'}};reentry.metrics.elapsedMs=Date.now()-started;return reentry;}
 if(!options.disableConstruction&&resetDecision.status==='candidate'&&X){
  const repair=X.search(s,{timeMs:Math.max(0,Math.min(680,deadline-now()-70)),maxNodes:Math.max(0,(options.maxNodes??45000)-base.metrics.nodes)});base.metrics.nodes+=repair.search?.visited||0;
  if(repair.valid){const tracker={nodes:0},advice=constructionAdvice(s,{origin:observe(s),steps:repair.continuation.map(p=>({witness:p.witness})),consumed:0},deadline,now,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;if(advice){advice.metrics.search=repair.search;advice.metrics.nodes=base.metrics.nodes;advice.metrics.elapsedMs=now()-started;return advice;}}
 }
 if(resetDecision.status==='candidate')base.evidence.resetSelection={...resetDecision,status:options.disableConstruction?'disabled':'uncertified',reason:options.disableConstruction?'Construction search is disabled; no Reset entry was selected.':'No complete recovery was certified within the available search budget; a route may still exist.'};
 if(!initial.maintenanceScope)return{...base,status:'unsupported-position',reason:initial.left.height<2||initial.center.height<3?'The stack is too low for the coach’s supported maintenance patterns. Rebuild manually or choose another position.':'This position is outside the supported right-side ST patterns. The coach expects established left and center stacks with a lower channel in column 8.',assessment:initial};
 const limit=options.maxNodes??45000,maxDepth=options.depth??3,width=options.width??8,expandedRoots=new Set(),accessCache=new Map();let stopped=false;
 base.metrics.accessNodes=0;let searchDeadline=deadline;
 const usage=options.usageTelemetry?{schemaVersion:1,scope:'maintenance',families:{
  cleanupBeforeCap:{attempted:0,examined:0,nonISkipped:0,iColumnSkipped:0,iTransitionChecked:0,verified:0,unknown:0},
  earlyCapFallback:{scanEligible:0,attempted:0,verified:0,selected:0,nodes:0},
  visibleCyclePreparation:{eligible:0,attempted:0,verified:0,selected:0,nodes:0,unknown:0}
 },costsMs:{cleanupBeforeCap:0,earlyCapFallback:0,visibleCyclePreparation:0},selected:null}:null;
 if(usage)base.metrics.usage=usage;
 // Profiling uses a real clock, never the caller's injected deadline clock.
 // Inclusive family boundaries overlap; they are not additive rule costs.
 const usageNow=()=>typeof performance==='object'&&performance.now?performance.now():Date.now();
 const optimistic=n=>({...n,rank:n.rank.map((v,i)=>{
  if(n.qualified)return v;
  const cavity=n.assessment.structure.right.reservoir;
  if(i===3&&cavity)return Math.floor((n.structuralScore+cavity.cells.length*3)/4);
  return i===4?v+1:v;
 })});
 const qualify=(nodes,nodeLimit=limit)=>{
  // Geometry is only an upper bound. Resolve the most promising candidates
  // lazily; inaccessible cavities must never earn a T-slot reward.
  const pending=nodes.slice(),selected=[];
  const order=(a,b)=>compare(optimistic(a),optimistic(b));
  const verify=n=>{
   if(n.qualified)return;
   const key=n.state.board.map(row=>row.replace(/[IJLOSTZX#]/g,'#')).join('');
   let access=accessCache.get(key);
   if(!access){access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,nodeLimit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.accessNodes+=access.visited;base.metrics.nodes+=access.visited;if(access.complete)accessCache.set(key,access);else stopped=true;}
   n.qualified=true;n.assessment.right.entry={status:access.reachable===true?'reachable-if-T-available':access.reachable===false?'unreachable':'unresolved-budget',witness:access.witness||null,target:access.event?.target||null};
   // A failed entry proof is structural repair work, not merely a lost
   // tactical tie-break. Otherwise inaccessible cavities can look renewable.
   if(access.reachable===false){n.structuralScore-=16;n.rank[3]=Math.floor(n.structuralScore/4);n.assessment.structure.blockedEntryRepair=16;}
   // Refund damage only for the exact recognized reservoir cells, after a
   // counterfactual T has a real input witness and its clear reopens the shaft.
   // T arrival is a separate obligation: this establishes geometry, not supply.
   const cavity=n.assessment.structure.right.reservoir;
   if(cavity&&access.reachable===true){
    const replay=R.replay(R.createState({board:n.state.board,active:'T',canHold:false}),access.witness);
    const event=replay.events[0],post=replay.valid?assess(replay.state.board):null;
    const keys=new Set(n.assessment.sealedCells.map(([x,y])=>x+','+y));
    const reopened=post&&event?.spin==='full'&&event.lines===2&&event.clearedRows.includes(cavity.roofRow)&&
     cavity.cells.every(([x,y])=>keys.has(x+','+y)&&replay.state.board[y][x]==='.'&&!post.sealedCells.some(([a,b])=>a===x&&b===y));
    if(reopened){
     const count=cavity.cells.length,credit=count*3;
     n.assessment.structure.right={...n.assessment.structure.right,reservoir:{...cavity,status:'verified-clear-reopens-reservoir',witness:access.witness.slice(),clearRows:event.clearedRows.slice()}};
     n.assessment.intentionalReservoir={cells:cavity.cells.map(c=>c.slice()),sealedExempt:count,coveredExempt:count,credit,proof:'reachable counterfactual T-double reopens these cells; arrival not established'};
     n.assessment.damageSealed=n.assessment.sealed-count;n.assessment.damageCovered=n.assessment.covered-count;
     n.assessment.estimate+=credit;n.structuralScore+=credit;n.rank[3]=Math.floor(n.structuralScore/4);
    }
   }
   n.rank[4]=n.baseEstimateRank+(access.reachable===true?1:0);
   n.assessment.obligations=n.assessment.obligations.map(o=>o.kind!=='T-slot'?o:({...o,status:access.reachable===true&&o.at[0]===access.event.target.x&&o.at[1]===access.event.target.y?'entry-verified-arrival-unresolved':access.reachable===false?'entry-blocked':'unresolved',note:'Counterfactual T entry is checked separately from whether a T arrives in time.'}));
  };
  // Evaluate the best member of each distinct root construction family too.
  const groups=new Map();for(const n of pending){const f=n.path[0],g=[f.target.type,holdCount(f),n.assessment.right.slots.length>0].join(':');if(!groups.has(g))groups.set(g,[]);groups.get(g).push(n);}
  for(const group of groups.values()){group.sort(order);while(group[0]&&!group[0].qualified&&!stopped){verify(group[0]);group.sort(order);}if(stopped)break;}
  while(pending.length&&selected.length<width*2&&!stopped){pending.sort(order);const n=pending[0];if(!n.qualified){verify(n);continue;}selected.push(pending.shift());}
  // On interruption, retain already evaluated evidence. An unknown geometric
  // candidate has no reward, and incomplete work remains explicitly reported.
  for(const n of nodes)if(n.qualified&&!selected.includes(n))selected.push(n);
  if(!selected.length&&nodes.length)selected.push([...nodes].sort(compare)[0]);
  return selected;
 };
 s=extendForced(s);
 const enumerate=state=>{const remaining=limit-base.metrics.nodes;if(remaining<=0||now()>=searchDeadline){stopped=true;return{placements:[],complete:false};}const r=R.placements(state,{allowHold:options.allowHold!==false,maxNodes:remaining,deadline:searchDeadline,now});base.metrics.nodes+=r.visited;if(!r.complete)stopped=true;r.placements=r.placements.filter(p=>ordinaryRightEligible(p.event));const priorGeometry=S.geometry(state.board),caps=priorGeometry.right.completions;const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));const availableCap=r.placements.some(p=>p.event.type==='Z'&&caps.some(c=>sameCells(p.event.cells,c.cells)));for(const p of r.placements)p.availableCap=availableCap;
 // The cap must not seal a currently executable outer-I cleanup preparation.
 // Establish both placements from actual supply; a geometric I silhouette or
 // a hypothetical future Z is insufficient to constrain another root move.
 const cleanupStarted=usage?usageNow():0;
 if(usage)usage.families.cleanupBeforeCap.attempted++;
 const cleanupBeforeCap=r.placements.some(first=>{
  if(usage)usage.families.cleanupBeforeCap.examined++;
  // Only an actual I lock can prepare cleanup. Test the emitted event, not
  // preview membership: empty HOLD may expose a currently executable I.
  // The current preparation column is also a necessary condition, not a
  // substitute for full scoring precedence and post-placement qualification.
  if(first.event.type!=='I'){if(usage)usage.families.cleanupBeforeCap.nonISkipped++;return false;}
  if(priorGeometry.right.cycle.prepareColumn===null||!first.event.cells.every(([x])=>x===priorGeometry.right.cycle.prepareColumn)){if(usage)usage.families.cleanupBeforeCap.iColumnSkipped++;return false;}
  if(usage)usage.families.cleanupBeforeCap.iTransitionChecked++;
  if(S.transition(state,first).allocation!=='quad-preparation'||S.geometry(first.state.board).right.cycle.phase!=='cap-rebuild-with-cleanup-prepared')return false;
  let after=first.state,prefix=[];
  if(after.active?.type!=='Z'){if(options.allowHold===false||after.hold!=='Z')return false;const held=R.move(after,'HOLD');if(held===after||held.topOut)return false;after=held;prefix=['HOLD'];}
  return S.geometry(after.board).right.completions.some(cap=>{const r=R.replay(first.state,[...prefix,...cap.witness]);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&!r.events[0].lines&&!r.state.topOut;});
 });
 if(usage){usage.families.cleanupBeforeCap.verified+=Number(cleanupBeforeCap);usage.families.cleanupBeforeCap.unknown+=Number(!r.complete&&!cleanupBeforeCap);usage.costsMs.cleanupBeforeCap+=usageNow()-cleanupStarted;}
 for(const p of r.placements)p.availableCleanupPreparation=cleanupBeforeCap;
 return r;};
 const root=enumerate(s);base.metrics.roots=root.placements.length;
 if(options[riskRootCollector]?.key===stateKey(s)){options[riskRootCollector].placements=root.placements;options[riskRootCollector].complete=root.complete;}
 // Save a fully checked one-lock cap before optional multi-lock preparation.
 // This is a backup, never an early return or authority to skip a saved goal.
 // Actual root enumeration establishes any competing executable cleanup I.
 let earlyCapFallback=null;
 const fallbackMetrics={attempted:0,verified:0,selected:false,nodes:0};
 if(root.complete&&!options.commitment&&!options.constructionPrevious){
  const fallbackStarted=usage?usageNow():0;if(usage)usage.families.earlyCapFallback.scanEligible=1;
  const startNodes=base.metrics.nodes,caps=S.geometry(s.board).right.completions;
  const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));
  for(const [index,p]of root.placements.entries()){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   if(p.event.type!=='Z'||p.event.lines||!p.event.cells.every(([x])=>x>=7)||!caps.some(c=>sameCells(c.cells,p.event.cells)))continue;
   fallbackMetrics.attempted++;
   const n=nodeFor({...p},null,initial,index,readAssessment);
   if(n.path[0].structuralEvidence.allocation!=='right-cap-preparation'||n.cycleDebt||!n.notchValid||!certifiedCavities(n)||n.assessment.maxHeight>=20||!n.assessment.regionalSupport)continue;
   qualify([n]);
   if(!n.qualified||n.assessment.right.entry?.status==='unresolved-budget')continue;
   const proof=A.prefix(s,n.path,{notches:initial.notches,deadline,now,maxNodes:Math.max(0,limit-base.metrics.nodes)});
   base.metrics.nodes+=proof.visited;base.metrics.gapAccessNodes=(base.metrics.gapAccessNodes||0)+proof.visited;
   if(proof.reachable!==true)continue;
   n.path[0].gapAccess=proof;earlyCapFallback=n;fallbackMetrics.verified=1;break;
  }
  fallbackMetrics.nodes=base.metrics.nodes-startNodes;
  if(usage){Object.assign(usage.families.earlyCapFallback,{attempted:fallbackMetrics.attempted,verified:fallbackMetrics.verified,nodes:fallbackMetrics.nodes});usage.costsMs.earlyCapFallback+=usageNow()-fallbackStarted;}
 }
 base.metrics.earlyCapFallback=fallbackMetrics;
 let foundationStage=null;
 if(!options.disableConstruction&&!options.commitment&&Y){const stage=Y.search(initial.state,root.placements,{rootComplete:root.complete,deadline:Number.isFinite(deadline)?Math.min(deadline-25,now()+100):Infinity,now,maxNodes:Math.min(12000,Math.max(0,limit-base.metrics.nodes))});base.metrics.nodes+=stage.visited;if(stage.candidate){const tracker={nodes:0};foundationStage=constructionAdvice(s,stage.candidate,deadline,now,Math.max(0,limit-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;}base.metrics.leftFoundationCandidate=Boolean(foundationStage);}
 // Reuse the already enumerated first moves. This short construction macro
 // proves an optional Z allocation followed by the ACTUAL other Z's exact cap
 // and an available T double. It cannot borrow an unseen future Z or T.
 const capStages=[],capDeadline=Math.min(deadline-25,now()+120);
 if(!options.disableConstruction&&X&&S.geometry(s.board).right.completions.length&&[s.active.type,s.hold,...s.queue].filter(t=>t==='Z').length>=2){
  const capRoots=root.placements.filter(p=>p.event.type==='Z'&&!p.event.lines&&p.event.cells.every(([x])=>x<7)).sort((a,b)=>S.geometry(b.state.board).supportEstimate-S.geometry(a.state.board).supportEstimate);
  for(const first of capRoots){
   if(now()>=capDeadline||base.metrics.nodes>=limit||capStages.length>=3)break;
   if(first.event.type!=='Z'||first.event.lines||first.event.cells.some(([x])=>x>=7))continue;
   for(const hold of [[],['HOLD'],['HOLD','HOLD']]){
    if(now()>=capDeadline||capStages.length>=3)break;
    const ready=R.replay(first.state,hold);if(!ready.valid||ready.state.active?.type!=='Z')continue;
    for(const cap of S.geometry(first.state.board).right.completions){
     const second=R.replay(first.state,[...hold,...cap.witness]);if(!second.valid||second.events.length!==1)continue;
     for(const tHold of [[],['HOLD'],['HOLD','HOLD']]){
      if(now()>=capDeadline||capStages.length>=3)break;
      const t=R.replay(second.state,tHold);if(!t.valid||t.state.active?.type!=='T')continue;
      const access=R.tDoubleAccess(t.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:capDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
      if(!access.complete||!access.reachable)continue;
      const proof={kind:'cap-deferral',origin:observe(s),steps:[{witness:first.witness},{witness:[...hold,...cap.witness]},{witness:[...tHold,...access.witness]}],consumed:0};
      const tracker={nodes:0},candidate=constructionAdvice(s,proof,capDeadline,now,Math.max(0,limit-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;if(candidate)capStages.push(candidate);
     }
    }
   }
  }
 }

 if(capStages.length)searchDeadline=deadline-25;
 // Extend a checked resource proof only with actual visible partner locks.
 // Completion targets are concrete cells; a missing route is uncertified.
 const finishCenterDebt=start=>{
  let n=start;
  while(n.centerDebt.length&&n.path.length<Math.min(7,s.queue.length+1)){
   if(now()>=deadline||base.metrics.nodes>=limit)return null;
   const choices=[];
   for(const c of S.geometry(n.state.board,{notches:n.notches}).center.completions){
    if(!n.centerDebt.some(g=>g.alternatives.some(a=>a.piece===c.piece&&centerCellsKey(a.cells)===centerCellsKey(c.cells))))continue;
    for(const prefix of [[],['HOLD'],['HOLD','HOLD']]){
     const ready=R.replay(n.state,prefix);if(!ready.valid||ready.state.active?.type!==c.piece)continue;
     const witness=[...prefix,...c.witness],r=R.replay(n.state,witness);if(!r.valid||r.events.length!==1||!S.canonicalClear(r.events[0]))continue;
     const child=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness,hold:prefix.length>0,...policyWitnesses(n.state)},n,initial,n.rootIndex,readAssessment);
     if(child.cycleDebt===0&&child.notchValid&&child.assessment.maxHeight<20&&child.centerDebt.length<n.centerDebt.length)choices.push(child);
    }
   }
   n=choices.sort(compare)[0];if(!n)return null;
  }
  return n.centerDebt.length?null:n;
 };
 let preparation=null,preparationUnresolved=false,cleanupCommitment=null,preparationKind='visible-I-Z-held-T';
 let admittedNode=null;
 const remember=n=>{
  if(!n||options.commitment&&n!==commitment||options.constructionPrevious||cleanupCommitment&&n!==cleanupCommitment||!options.admitMaintenance)return;
  if(n.assessment.maxHeight>=20||!n.assessment.regionalSupport||now()>=deadline||base.metrics.nodes>=limit)return;
  if(admittedNode&&n.path.length<admittedNode.path.length)return;
  if(admittedNode&&n.path.length===admittedNode.path.length&&(n===admittedNode||orderContinuations([admittedNode,n])[0]!==n))return;
  const checked=options.admitMaintenance(describeNode(clone(n),n===commitment));
  base.metrics.nodes=checked.metrics?.nodes??base.metrics.nodes;
  base.metrics.admissionAttempts=(base.metrics.admissionAttempts||0)+1;
  if(checked.target){admittedNode=n;base.metrics.firstCertified??={nodes:base.metrics.nodes,...(options.usageTelemetry?{elapsedMs:now()-started}:{}),locks:n.path.length};}
  else base.metrics.admissionFailures=(base.metrics.admissionFailures||0)+1;
 };
 const commitment=committedNode(s,options.commitment,root.placements,initial,readAssessment);
 remember(commitment);
 // A narrow constructive obligation, not a blanket ban on pre-cap T filler.
 // Prove the available I -> Z -> saved T route before beam pruning can discard
 // its unfinished cap. Every action uses the real observation and visible queue.
 // An interrupted proof earns no credit; conflicting T advice is withheld.
 // A completed failed proof does not reserve the T.
 if(maxDepth>=3&&options.allowHold!==false&&s.active.type==='T'&&s.hold==='I'&&S.geometry(s.board).right.cycle.prepareColumn!==null){
  preparationUnresolved=!root.complete;
  for(let i=0;i<root.placements.length&&!preparation;i++){
   const first=root.placements[i];
   if(first.event.type!=='I'||first.event.lines||first.state.hold!=='T'||first.state.active?.type!=='Z'||S.geometry(first.state.board).right.cycle.phase!=='cap-rebuild-with-cleanup-prepared')continue;
   if(S.transition(s,first).allocation!=='quad-preparation')continue;
   for(const cap of S.geometry(first.state.board).right.completions){
    if(now()>=deadline||base.metrics.nodes>=limit){preparationUnresolved=true;break;}
    const z=R.replay(first.state,cap.witness);
    if(!z.valid||z.events.length!==1||z.events[0].type!=='Z'||z.events[0].lines||z.state.topOut)continue;
    const held=R.move(z.state,'HOLD');
    if(held===z.state||held.topOut||held.active?.type!=='T')continue;
    const access=R.tDoubleAccess(held.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});
    base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
    if(!access.complete){preparationUnresolved=true;continue;}
    if(!access.reachable)continue;
    const witness=['HOLD',...access.witness],t=R.replay(z.state,witness);
    if(!t.valid||t.events.length!==1||!S.canonicalClear(t.events[0])||t.events[0].lines!==2||t.state.topOut)continue;
    const second={target:z.events[0].target,hold:false,holdCount:0,witness:cap.witness.slice(),state:z.state,event:z.events[0],availableCap:true};
    const third={target:t.events[0].target,hold:true,holdCount:1,witness,state:t.state,event:t.events[0]};
    let n=nodeFor(first,null,initial,i,readAssessment);n=nodeFor(second,n,initial,i,readAssessment);n=nodeFor(third,n,initial,i,readAssessment);
    n=finishCenterDebt(n);if(n&&n.cycleDebt===0&&certifiedCavities(n)&&n.assessment.regionalSupport&&n.assessment.maxHeight<20)preparation=n;
   }
  }
 }
 // Extend cap preparation through a bounded prefix of the visible queue. This
 // is a constructive search, not a global T penalty: only a replayed Z cap and
 // the actual saved T double create an obligation. The small beam may miss a
 // route; a failed search is never evidence that no route exists.
 // Reserve an available I across an actual upcoming double when that clear
 // opens the Pocket. This proof uses the real held I, not a later copy in bag.
 if(maxDepth>=3&&options.allowHold!==false&&(s.active.type==='I'||s.hold==='I')){
  const candidates=root.placements.filter(p=>p.event.type!=='I'&&p.state.hold==='I'&&p.state.active?.type==='T'&&S.canonicalClear(p.event)).map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(n=>n.cycleDebt===0&&certifiedCavities(n)&&n.assessment.maxHeight<20).sort(compare).slice(0,4);
  for(const n of candidates){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   const access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
   if(!access.complete||!access.reachable)continue;
   const t=R.replay(n.state,access.witness);if(!t.valid||t.events.length!==1||t.events[0].type!=='T'||t.events[0].lines!==2||t.events[0].spin!=='full')continue;
   const scored=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness:access.witness,hold:false},n,initial,n.rootIndex,readAssessment);
   let active=R.move(t.state,'HOLD'),witness=['HOLD'];if(active===t.state||active.topOut||active.active?.type!=='I')continue;
   let next=R.move(active,'CW');if(next===active)continue;active=next;witness.push('CW');
   while(active.active.x!==7){const a=active.active.x<7?'R':'L';next=R.move(active,a);if(next===active)break;active=next;witness.push(a);}
   if(active.active.x!==7)continue;const r=R.replay(t.state,[...witness,'HD']);if(!r.valid||r.events.length!==1)continue;
   const end=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:[...witness,'HD'],hold:true},scored,initial,n.rootIndex,readAssessment);
   if(end.cycleDebt===0&&end.notchValid&&certifiedCavities(end)&&end.assessment.maxHeight<20&&end.assessment.regionalSupport&&end.path.at(-1).structuralEvidence.allocation==='quad-preparation'&&(!cleanupCommitment||compare(end,cleanupCommitment)<0))cleanupCommitment=end;
  }
 }
 remember(cleanupCommitment);
 const visible=[s.active.type,...s.queue],tIndex=s.hold==='T'?-1:visible.indexOf('T'),zIndex=s.hold==='Z'?-1:visible.indexOf('Z');
 const capPending=S.geometry(s.board).right.cycle.phase.startsWith('cap-rebuild')||S.geometry(s.board).right.cycle.phase==='post-clear-rebuild';
 if(!preparation&&!preparationUnresolved&&maxDepth>=3&&options.allowHold!==false&&capPending&&(tIndex>=0||s.hold==='T')&&(zIndex>tIndex||s.hold==='Z')&&zIndex<=5&&(zIndex<=3||tIndex===0||s.hold==='T'||s.hold==='Z')&&s.active.type!=='Z'){
  const preparationStarted=usage?usageNow():0,preparationStartNodes=base.metrics.nodes;
  if(usage){usage.families.visibleCyclePreparation.eligible=1;usage.families.visibleCyclePreparation.attempted=1;}
  const admissible=n=>n.cycleDebt===0&&n.notchValid&&n.assessment.maxHeight<20;
  let candidates=root.placements.filter(p=>p.event.type!=='T'&&S.canonicalClear(p.event)).map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(admissible);
  const rootBands=new Map(candidates.map(n=>[n.rootIndex,n.rank[3]]));
  // Among witnessed cap/T routes retain stronger immediate supported structure
  // before comparing endpoint estimates. This is not a center-piece override.
  const compareProof=(a,b)=>(rootBands.get(b.rootIndex)-rootBands.get(a.rootIndex))||compare(a,b);
  let beam=diversify(candidates,4),proofStopped=!root.complete;
  const maxProofLocks=Math.min(7,s.queue.length+1);
  for(let depth=1;depth<maxProofLocks&&beam.length&&!preparation&&!proofStopped;depth++){
   const next=[];
   for(const n of beam){
    if(now()>=deadline||base.metrics.nodes>=limit){proofStopped=true;break;}
    // A previously held Z may already have formed the cap in this prefix.
    // Recognize the actual T now available, rather than requiring Z in active.
    if(n.state.active?.type==='T'||n.state.hold==='T'){
     const prefix=n.state.active?.type==='T'?[]:['HOLD'],ready=prefix.length?R.move(n.state,'HOLD'):n.state;
     if(ready!==n.state||!prefix.length){const access=R.tDoubleAccess(ready.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
      if(!access.complete)proofStopped=true;
      if(access.reachable){const witness=[...prefix,...access.witness],t=R.replay(n.state,witness);if(t.valid&&t.events.length===1&&t.events[0].type==='T'&&t.events[0].lines===2&&t.events[0].spin==='full'){
       let terminal=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness,hold:prefix.length>0},n,initial,n.rootIndex,readAssessment);
       terminal=finishCenterDebt(terminal);
       if(terminal&&admissible(terminal)&&certifiedCavities(terminal)&&terminal.assessment.regionalSupport&&(!preparation||compareProof(terminal,preparation)<0)){preparation=terminal;preparationKind='visible-cycle-T-conservation';}
      }}
     }
    }
    // A cap is accepted only when the immediately subsequent held T is real.
    if(n.state.active?.type==='Z'&&n.state.hold==='T')for(const cap of S.geometry(n.state.board).right.completions){
     const z=R.replay(n.state,cap.witness);
     if(!z.valid||z.events.length!==1||z.events[0].type!=='Z'||z.events[0].lines||z.state.topOut)continue;
     // Active Z plus occupied held T excludes an executable I, even with unlimited swaps.
     const second={target:z.events[0].target,hold:false,holdCount:0,witness:cap.witness.slice(),state:z.state,event:z.events[0],availableCleanupPreparation:false};
     const capNode=nodeFor(second,n,initial,n.rootIndex,readAssessment);if(!admissible(capNode)||depth+2>maxProofLocks)continue;
     const held=R.move(z.state,'HOLD');if(held===z.state||held.topOut||held.active?.type!=='T')continue;
     const access=R.tDoubleAccess(held.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
     if(!access.complete){proofStopped=true;break;}if(!access.reachable)continue;
     const witness=['HOLD',...access.witness],t=R.replay(z.state,witness);
     if(!t.valid||t.events.length!==1||!S.canonicalClear(t.events[0])||t.events[0].lines!==2||t.state.topOut)continue;
     let terminal=nodeFor({target:t.events[0].target,hold:true,holdCount:1,witness,state:t.state,event:t.events[0]},capNode,initial,n.rootIndex,readAssessment);
     terminal=finishCenterDebt(terminal);
       if(terminal&&admissible(terminal)&&certifiedCavities(terminal)&&terminal.assessment.regionalSupport&&(!preparation||compareProof(terminal,preparation)<0)){preparation=terminal;preparationKind='visible-prefix-Z-saved-T';}
    }
    if(preparation||proofStopped)continue;
    if(!n.state.active||depth+2>=maxProofLocks)continue;
    const e=enumerate(n.state);if(!e.complete)proofStopped=true;
    for(const p of e.placements){if(p.event.type==='T'||!S.canonicalClear(p.event))continue;const child=nodeFor(p,n,initial,n.rootIndex,readAssessment);if(admissible(child))next.push(child);}
   }
   const unique=new Map();for(const n of next){const key=nodeKey(n),prior=unique.get(key);if(!prior||compare(n,prior)<0)unique.set(key,n);}beam=diversify([...unique.values()],4);
  }
  preparationUnresolved=proofStopped&&!preparation;
  if(usage){Object.assign(usage.families.visibleCyclePreparation,{verified:Number(Boolean(preparation)),unknown:Number(preparationUnresolved),nodes:base.metrics.nodes-preparationStartNodes});usage.costsMs.visibleCyclePreparation+=usageNow()-preparationStarted;}
 }
 // An unsafe preparation is not an incumbent: let ordinary alternatives be
 // considered instead of selecting it only to reject it at final admission.
 if(preparation&&!A.repairPrefix(s,preparation.path,{notches:initial.notches,initialDebt:initial.coveredRepair?.cells,stages:initial.coveredStages}).valid)preparation=null;
 const spendsReservedT=(p,parent=null)=>(preparation||preparationUnresolved)&&p.event.type==='T'&&p.event.lines===0&&!parent?.path.some(step=>step.event.type==='T'&&step.event.lines===2&&step.event.spin==='full');
 let frontier=qualify(root.placements.filter(p=>S.canonicalClear(p.event)&&!spendsReservedT(p)&&ordinaryCenterEligible(s,p,initial.notches)).map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(n=>n.notchValid&&n.cycleDebt===0));
 if(preparation){preparation=qualify([preparation])[0]??preparation;base.metrics.preparationProofLocks=preparation.path.length;}

 let screeningLimit=limit;
 const screeningAllowance=limit>=20000&&!options.disableOpening&&!options.disableConstruction?Math.min(6000,Math.floor(limit/5)):Infinity;
 const screening=base.metrics.proofScheduling={enabled:Number.isFinite(screeningAllowance),allowance:Number.isFinite(screeningAllowance)?screeningAllowance:null,calls:0,nodes:0,unfinished:0,budgetStops:0};
 const accessSafe=n=>{const restoration=A.repairPrefix(s,n.path,{notches:initial.notches,initialDebt:initial.coveredRepair?.cells,stages:initial.coveredStages});if(!restoration.valid)return false;n.coveredRepairProof=restoration;if(initial.coveredRepair?.cells.length)n.path=n.path.map((p,i)=>({...p,structuralEvidence:{...p.structuralEvidence,coveredRepair:repairStepEvidence(restoration,i,initial.coveredRepair.cells)}}));const proof=A.prefix(s,n.path,{notches:initial.notches,deadline,now,maxNodes:Math.max(0,Math.min(limit,screeningLimit)-base.metrics.nodes)});base.metrics.nodes+=proof.visited;if(proof.reachable===null)screening.unfinished++;base.metrics.gapAccessNodes=(base.metrics.gapAccessNodes||0)+proof.visited;n.path[0].gapAccess=proof;return proof.reachable===true;};
 const repairCache=new Map();
 const resourceSafe=n=>{
  const restoration=n.coveredRepairProof||A.repairPrefix(s,n.path,{notches:initial.notches,initialDebt:initial.coveredRepair?.cells,stages:initial.coveredStages});if(!restoration.valid)return false;n.coveredRepairProof=restoration;
  if(n.resources?.centerBlocked&&!M.pendingLStageEligible(n.state,n.resources)||n.resources?.unclassifiedS?.some(s=>s.invalidated||s.requiresAccommodation))return false;
  if(n.resources?.tCollision&&n.assessment.right.entry?.status!=='reachable-if-T-available')return false;
  if(!n.resources?.hangingS.length&&!n.resources?.pendingCenter.length)return true;
  const key=JSON.stringify([observe(n.state),M.binding(n.resources),n.notches,n.coveredRepairProof?.outstandingCells||[],options[pendingLHint]??null]);let proof=repairCache.get(key);
  if(!proof){proof=resourceRepair(n.state,n.resources,{...options,notches:n.notches,coveredDebt:n.coveredRepairProof?.outstandingCells||[],maxNodes:Math.min(4000,Math.max(0,Math.min(limit,screeningLimit)-base.metrics.nodes)),deadline,now});base.metrics.nodes+=proof.visited;if(proof.valid!==null)repairCache.set(key,proof);}
  n.resourceRepair=proof;if(proof.valid===null)screening.unfinished++;return proof.valid===true;
 };
 // Early endpoint screening must leave work for the next beam layer. A
 // bounded unfinished proof stays unknown and is never cached as rejection.
 // Ranking and all acceptance checks are unchanged; final-layer screening
 // and final admission may use the rest of the shared request budget.
 const certifyContinuation=n=>{
  if(!accessSafe(n)||!resourceSafe(n))return false;
  n.continuationChecked=true;return true;
 };
 const currentLTargets=(summary.center?.pending||[]).filter(p=>p.family==='SL'&&p.rootId!==null).map(p=>({rootId:p.rootId,alternatives:clone(p.alternatives)}));
 const currentLClosureLocks=n=>{let targets=clone(currentLTargets),closed=[];for(const [index,step]of n.path.entries()){const e=step.event,rows=e.clearedRows||[];targets=targets.filter(p=>{if(e.type==='L'&&p.alternatives.some(c=>centerCellsKey(c.cells)===centerCellsKey(e.cells))){closed.push(index+1);return false;}return true;}).map(p=>({...p,alternatives:p.alternatives.map(c=>({...c,cells:c.cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(v=>v>y).length])}))}));}return closed;};
 const pendingLOrder=(a,b)=>{const x=currentLClosureLocks(a),y=currentLClosureLocks(b);if(x.length!==y.length)return y.length-x.length;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return compareConstruction(a,b);};

 const cleanBest=(nodes,allowance=Infinity)=>{
  const start=base.metrics.nodes,prior=screeningLimit;screening.calls++;
  screeningLimit=Math.min(prior,start+allowance);
  try{const ordered=nodes.filter(n=>n.cycleDebt===0&&certifiedCavities(n)).sort(pendingLOrder);let unknownHigher=0;for(const n of ordered){
   if(now()>=deadline){screening.budgetStops++;return null;}
   const beforeUnknown=screening.unfinished;
   if(certifyContinuation(n)){if(n.resourceRepair?.waitingStage)n.pendingLSelection={scope:'same-horizon-searched-candidates',horizon:n.path.length,currentPendingClosures:currentLClosureLocks(n).length,currentPendingClosureLocks:currentLClosureLocks(n),higherRankedUnresolved:unknownHigher,globallyOptimal:false};return preserveExtraZ(n,ordered,{protect:incumbent=>{remember(incumbent);return admittedNode===incumbent;},certify:candidate=>now()<deadline&&base.metrics.nodes<limit&&certifyContinuation(candidate)});}
   if(screening.unfinished>beforeUnknown)unknownHigher++;
   // Completed cached/no-work proofs remain usable at zero remaining nodes.
   // A zero allowance cannot turn an unfinished query into negative evidence.
   if(base.metrics.nodes>=screeningLimit&&screening.unfinished>beforeUnknown)screening.budgetStops++;
  }return null;}finally{screening.nodes+=base.metrics.nodes-start;screeningLimit=prior;}
 };
 const rootScreenIncomplete=screening.unfinished+screening.budgetStops;
 let best=preparation&&resourceSafe(preparation)?preparation:cleanBest(frontier,screeningAllowance);base.metrics.depth=best?best.path.length:0;base.metrics.completeDepth=root.complete&&best&&!stopped&&screening.unfinished+screening.budgetStops===rootScreenIncomplete?1:0;
 base.metrics.completedBeamDepth=root.complete?1:0;
 remember(best);
 // References only: do not change ordinary beam generation or proof scheduling.
 let layer=diversify(frontier,width),comparisonLayer=frontier;const completedSLLayers=root.complete?[frontier]:[];
 for(let depth=2;depth<=maxDepth&&!stopped&&layer.length;depth++){
  const next=[],seen=new Map();let complete=true;
  for(const n of layer){if(!n.state.active)continue;expandedRoots.add(n.rootIndex);const e=enumerate(n.state);if(!e.complete)complete=false;
   for(const p of e.placements){if(!S.canonicalClear(p.event)||spendsReservedT(p,n)||!ordinaryCenterEligible(n.state,p,n.notches))continue;const child=nodeFor(p,n,initial,n.rootIndex,readAssessment);if(!child.notchValid||child.cycleDebt)continue;const key=nodeKey(child),prior=seen.get(key);if(!prior||compare(child,prior)<0)seen.set(key,child);}
   if(stopped)break;
  }
  next.push(...qualify([...seen.values()]));if(stopped)complete=false;
  if(complete){base.metrics.completedBeamDepth=depth;completedSLLayers.push(next);}
  if(next.length){
   const beforeIncomplete=screening.unfinished+screening.budgetStops;
   const candidate=cleanBest(next,depth<maxDepth?screeningAllowance:Infinity);
   const screeningComplete=screening.unfinished+screening.budgetStops===beforeIncomplete;
   remember(candidate);base.metrics.depth=Math.max(base.metrics.depth,depth);
   // Unknown competing endpoint proofs limit coverage, not this candidate's
   // own positive certificate. Preserve the completed expansion-layer choice;
   // report screening completeness separately and still require final admission.
   if(complete&&candidate){
    best=preparation&&depth<preparation.path.length?preparation:candidate;comparisonLayer=next;
    if(screeningComplete)base.metrics.completeDepth=depth;
   }
  }
  layer=diversify(next,width);
 }
 if(cleanupCommitment&&(!best||!coversResourceGoal(best,cleanupCommitment)))best=cleanupCommitment;
 let comparisonSaved=commitment;
 const comparisonProofs=new Map(),timingDecisions=new Map();
 const recordTiming=(candidate,saved,result)=>{if(!timingDecisions.has(candidate))timingDecisions.set(candidate,new Map());timingDecisions.get(candidate).set(saved,result);return result;};
 const timingDecision=(candidate,saved=comparisonSaved)=>{
  const result=scoringReplacement(candidate,saved,commitment);
  if(!result.allowed||!result.delayed.length)return recordTiming(candidate,saved,result);
  // A favorable number on a speculative descendant is not a proved benefit.
  // Certify the equal-horizon original-goal route once, charging the same
  // shared budget. Unknown rejects this exception, never the saved goal.
  if(!comparisonProofs.has(saved))comparisonProofs.set(saved,Boolean(saved.qualified&&saved.assessment.right.entry?.status!=='unresolved-budget'&&accessSafe(saved)&&resourceSafe(saved)));
  const referenceCertified=comparisonProofs.get(saved);
  return recordTiming(candidate,saved,{...result,allowed:referenceCertified,referenceCertified,reason:referenceCertified?'certified-endpoint-dominance':'unproved-equal-horizon-reference',referencePrefix:saved.path.map(p=>({witness:p.witness,event:p.event}))});
 };
 const timingDescription=(candidate,saved)=>{const checked=timingDecisions.get(candidate)?.get(saved);if(checked)return checked;const result=scoringReplacement(candidate,saved,commitment);return result.allowed&&result.delayed.length?{...result,allowed:false,reason:'endpoint-comparison-not-run',referenceCertified:null}:result;};
 const timelyReplacement=(candidate,saved=comparisonSaved)=>!commitment||options.disableTimelyScoring||timingDecision(candidate,saved).allowed;
 if(commitment){
  // The saved suffix may end at its goal while the fresh search already sees
  // another ordinary piece. Compare both choices at that same lock horizon,
  // reusing searched descendants of the exact saved proof rather than hiding
  // the fresh lookahead or inventing an unsearched continuation.
  const matchesSaved=n=>n.path.length>=commitment.path.length&&commitment.path.every((p,i)=>JSON.stringify(p.event)===JSON.stringify(n.path[i].event)&&sameObservedResult(p.state,n.path[i].state));
  let saved=commitment,fresh=best,replacement=false,rankingPreferred=false;
  if(fresh&&coversResourceGoal(fresh,commitment)&&fresh.path.length>saved.path.length){
   const candidates=comparisonLayer.filter(n=>n.path.length===fresh.path.length&&matchesSaved(n)&&n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport);
   const qualified=qualify(candidates).filter(n=>n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget');
   saved=orderContinuations(qualified)[0]??saved;
  }
  if(fresh&&coversResourceGoal(fresh,commitment)&&fresh.path.length===saved.path.length&&fresh.assessment.maxHeight<20&&fresh.assessment.regionalSupport){
   qualify([fresh,saved]);
   const settled=n=>n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget';
   rankingPreferred=fresh!==saved&&settled(fresh)&&settled(saved)&&orderContinuations([saved,fresh])[0]===fresh;
   replacement=rankingPreferred&&timelyReplacement(fresh,saved);
  }
  // Preserve a certified concrete completion of the same saved Center goal
  // against spending that partner first and recreating the goal as a wait.
  // This is goal preservation, not unequal-horizon endpoint dominance.
  let pendingLCompletionPreserved=false;
  if(replacement&&fresh.resourceRepair?.waitingStage&&coversResourceGoal(fresh,commitment)&&
   commitment.resources?.pendingCenter.some(p=>p.family==='SL')&&
   accessSafe(commitment)&&resourceSafe(commitment)){
   const proof=commitment.resourceRepair;
   pendingLCompletionPreserved=Boolean(proof?.valid===true&&!proof.waitingStage&&
    proof.status==='visible-Center-and-S-repair'&&proof.path?.some(p=>p.event.type==='L'));
   if(pendingLCompletionPreserved)replacement=false;
  }
  comparisonSaved=saved;
  base.metrics.commitmentComparison={slAllocation:{enabled:commitment.ordinarySAllocationEnabled===true,savedPaid:commitment.slAllocation?.paid.length??0,freshPaid:fresh?.slAllocation?.paid.length??0,retentionBlocked:Boolean(commitment.ordinarySAllocationEnabled&&fresh&&resourceGoalPrefix(fresh.path,commitment.path)!==null&&(fresh.slAllocation?.paid.length??0)<(commitment.slAllocation?.paid.length??0))},scoringTiming:!options.disableTimelyScoring&&fresh?timingDescription(fresh,saved):null,freshGoalLocks:fresh?resourceGoalPrefix(fresh.path,commitment.path):null,savedGoalLocks:resourceGoalPrefix(commitment.path,commitment.path),
   freshHorizon:fresh?.path.length??null,savedHorizon:saved.path.length,replacement,rankingPreferred,pendingLCompletionPreserved,delayPrevented:Boolean(!options.disableTimelyScoring&&rankingPreferred&&!replacement&&!pendingLCompletionPreserved),
   freshSettled:Boolean(fresh?.qualified&&fresh.assessment.right.entry?.status!=='unresolved-budget'),savedSettled:Boolean(saved?.qualified&&saved.assessment.right.entry?.status!=='unresolved-budget')};
  if(!replacement)best=commitment;
 }

 if(now()>=deadline)stopped=true;
 base.metrics.rootExpanded=expandedRoots.size;base.metrics.elapsedMs=Date.now()-started;
 // Compare cap deferral with ordinary play at equal completed locks. If the
 // ordinary prefix commutes with the macro, replay its remaining witness to
 // complete the same endpoint rather than compare three locks against two.
 base.metrics.capStageCandidates=capStages.length;
 for(const candidate of capStages){
  if(now()>=deadline)break;
  if(!best)continue;
  let ordinary=best;
  if(ordinary.path.length<candidate.continuation.length){
   for(const step of candidate.continuation.slice(ordinary.path.length)){
    if(now()>=deadline){ordinary=null;break;}
    const r=R.replay(ordinary.state,step.witness);if(!r.valid||r.events.length!==1||!S.canonicalClear(r.events[0])){ordinary=null;break;}
    ordinary=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(ordinary.state)},ordinary,initial,ordinary.rootIndex,readAssessment);
   }
   if(ordinary&&(ordinary.cycleDebt||!ordinary.notchValid||!certifiedCavities(ordinary)||JSON.stringify(ordinary.state.board)!==JSON.stringify(JSON.parse(candidate.continuation.at(-1).resultContext)[1])))ordinary=null;
   if(ordinary)best=ordinary;
  }
  if(!ordinary||ordinary.path.length!==candidate.continuation.length)continue;
  const mass=ordinary.state.board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0),cm=candidate.metrics.endpointMass;
  let capTiming=null;
  if(commitment){
   // Construction advice intentionally has a smaller endpoint assessment.
   // Rebuild the comparison facts from its actual public witness rather than
   // assuming absent Center/Left facts are favorable or trusting advice flags.
   let capNode=null,prior=s,valid=true;
   for(const step of candidate.continuation){const r=R.replay(prior,step.witness);if(!r.valid||r.events.length!==1){valid=false;break;}capNode=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(prior)},capNode,initial,-1,readAssessment);prior=r.state;}
   if(!valid||!capNode||!coversResourceGoal(capNode,commitment)||!timelyReplacement(capNode))continue;
   if(!options.disableTimelyScoring)capTiming=timingDecision(capNode);
  }
  if(candidate.assessment.maxHeight<=ordinary.assessment.maxHeight&&cm<=mass&&(candidate.assessment.maxHeight<ordinary.assessment.maxHeight||cm<mass)){candidate.metrics=constructionMetrics(candidate,base.metrics,now()-started);if(capTiming)candidate.metrics.commitmentComparison={...base.metrics.commitmentComparison,selectedScoringTiming:capTiming};if(usage){usage.selected={path:'cap-deferral',locks:candidate.continuation.length};candidate.metrics.usage=usage;}return candidate;}
 }
 if(foundationStage){
  // Admission is a complete finite alternative, not proof that an unknown
  // ordinary continuation is impossible. Never discard an existing score or
  // protected Center/I/resource goal for this shorter Left-only construction.
  let replace=!best;
  if(best&&!resourceGoal(best.path)){
   if(best.path.length<2)replace=true;
   else{const r=R.replay(s,best.path.slice(0,2).flatMap(p=>p.witness)),end=JSON.parse(foundationStage.continuation.at(-1).resultContext)[1];
    if(r.valid){const a=assess(end),b=assess(r.state.board),phase=initial.notches,ga=S.geometry(end,{notches:phase}).center,gb=S.geometry(r.state.board,{notches:phase}).center,quality=c=>c.patternSupport==='reference-supported'?(c.status==='level'?2:c.status==='unrecognized'?0:1):0;
     replace=a.maxHeight<=b.maxHeight&&Y.leftCovered(end)<=Y.leftCovered(r.state.board)&&Math.abs(Y.parity(end))<=Math.abs(Y.parity(r.state.board))&&Y.deficits(end,phase).length<=Y.deficits(r.state.board,phase).length&&quality(ga)>=quality(gb)&&(Y.deficits(end,phase).length<Y.deficits(r.state.board,phase).length||Y.leftCovered(end)<Y.leftCovered(r.state.board)||Math.abs(Y.parity(end))<Math.abs(Y.parity(r.state.board)));
    }
   }
  }
  if(replace){if(usage)usage.selected={path:'left-foundation',locks:foundationStage.continuation.length};foundationStage.metrics={...constructionMetrics(foundationStage,base.metrics,now()-started),depth:base.metrics.depth,completeDepth:base.metrics.completeDepth,stageProofLocks:2};return foundationStage;}
 }
 if(best&&(!accessSafe(best)||!resourceSafe(best))){
  // Final screening may exhaust its budget after the saved-goal comparison.
  // A shorter legal fallback is not a replacement for that protected goal.
  // Recheck alternatives at the selected horizon with every goal preserved;
  // if none can be certified, abstain rather than silently dropping the proof.
  const horizon=best.path.length,alternatives=[...comparisonLayer,...frontier].filter(n=>(!commitment||n.path.length===horizon&&coversResourceGoal(n,commitment)&&timelyReplacement(n))&&(!cleanupCommitment||n.path.length===horizon&&coversResourceGoal(n,cleanupCommitment)));
  best=cleanBest(alternatives);
 }
 if(!best&&earlyCapFallback&&!commitment&&!cleanupCommitment&&resourceSafe(earlyCapFallback)){best=earlyCapFallback;fallbackMetrics.selected=true;base.metrics.depth=Math.max(base.metrics.depth,1);}
 if(best?.resourceRepair?.waitingStage&&!best.pendingLSelection){const horizon=best.path.length;best=cleanBest([...comparisonLayer,...frontier,best].filter(n=>n.path.length===horizon&&(!commitment||coversResourceGoal(n,commitment)&&timelyReplacement(n))&&(!cleanupCommitment||coversResourceGoal(n,cleanupCommitment))));}
 // A rejected endpoint does not complete other budget-truncated proofs.
 // Classify abstention only; a certified best move below remains unchanged.
 const searchIncomplete=Boolean(stopped||screening.unfinished||screening.budgetStops);
 const abstentionStatus=searchIncomplete?'budget-exhausted':'no-supported-continuation-found';
 const incompleteReason='The search limit was reached before finding a checked move. A valid continuation may still exist.';
 if(!best)return{...base,status:abstentionStatus,reason:searchIncomplete?incompleteReason:'No supported ST sequence was found within this search. Other continuations may exist.'};
 if(best.assessment.maxHeight>=20||!best.assessment.regionalSupport)return{...base,status:abstentionStatus,reason:searchIncomplete?incompleteReason:'The checked sequences did not retain enough space and a supported stack shape. No move is recommended.',assessment:best.assessment};
 if(commitment&&!options.disableTimelyScoring)base.metrics.commitmentComparison.selectedScoringTiming=timingDecision(best);
 // A visible cap is not authority by shape alone. Only the fully replayed
 // current-piece / actual next Z / actually held T route below can prefer it
 // to a goal-free filler which occupies that cap's cells. Run this late so
 // an unfinished optional proof cannot starve or revoke ordinary admission.
 const literal=observe(raw),first=best.path[0];
 if(!options.disableRightCapPreference&&!options.disableConstruction&&maxDepth>=3&&options.openingPhase===false&&options.allowHold!==false&&options.resourceContext&&['complete','partial'].includes(summary.coverage?.status)&&
    !options.commitment&&!options.constructionPrevious&&!commitment&&!cleanupCommitment&&!resourceGoal(best.path)&&options[rightCapAdmission]&&
    'IJO'.includes(literal.active?.type)&&literal.hold==='T'&&literal.queue[0]==='Z'&&first.event.type===literal.active.type&&!first.event.lines&&!holdCount(first)&&
    first.event.cells.some(([x])=>x>=7)){
  const lostCaps=S.geometry(literal.board,{notches:initial.notches}).right.completions.filter(cap=>first.event.cells.some(([x,y])=>cap.cells.some(([cx,cy])=>x===cx&&y===cy)));
  if(!lostCaps.length)return describeNode(best);
  const startNodes=base.metrics.nodes,preference={attempted:true,selected:false,candidates:0,proofs:0,unknown:0,nodes:0,scope:'late current-Left-piece / next-visible-Z cap / held-T double; unchanged goal-free incumbent on unknown',incumbentPrefix:best.path.map(p=>({witness:p.witness.slice(),event:clone(p.event)})),lostCapCells:lostCaps.map(c=>clone(c.cells))};
  const incumbent=options[rightCapAdmission](describeNode(clone(best)));base.metrics.nodes=incumbent.metrics?.nodes??base.metrics.nodes;
  if(!incumbent.target)return incumbent;
  const finish=result=>{preference.nodes=base.metrics.nodes-startNodes;result.metrics={...result.metrics,nodes:base.metrics.nodes,elapsedMs:Date.now()-started,rightCapPreference:preference};return result;};
  const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([cx,cy])=>x===cx&&y===cy));
  const replay=(before,witness)=>{if(now()>=deadline||base.metrics.nodes+witness.length>limit)return null;base.metrics.nodes+=witness.length;return R.replay(before,witness);};
  const alternatives=root.placements.filter(p=>p.event.type===literal.active.type&&!p.event.lines&&!holdCount(p)&&p.event.cells.every(([x])=>x<4)&&p.state.active?.type==='Z'&&p.state.hold==='T')
   .map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(n=>n.notchValid&&!n.cycleDebt&&certifiedCavities(n)&&n.assessment.maxHeight<20).sort(compareConstruction);
  preference.candidates=alternatives.length;
  for(const n of alternatives){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   for(const cap of lostCaps){
    const z=replay(n.state,cap.witness);if(!z?.valid||z.events.length!==1||z.events[0].type!=='Z'||z.events[0].lines||!sameCells(z.events[0].cells,cap.cells))continue;
    const capStep={state:z.state,event:z.events[0],target:z.events[0].target,witness:cap.witness.slice(),hold:false,holdCount:0,availableCleanupPreparation:false};
    const capped=nodeFor(capStep,n,initial,n.rootIndex,readAssessment);if(!capped.notchValid||capped.cycleDebt||!certifiedCavities(capped)||capped.assessment.maxHeight>=20)continue;
    const held=replay(z.state,['HOLD']),ready=held?.state;if(!held?.valid||held.events.length||ready.topOut||ready.active?.type!=='T')continue;
    const access=R.tDoubleAccess(ready.board,{deadline,now,maxNodes:Math.max(0,limit-base.metrics.nodes)});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;preference.proofs++;preference.unknown+=Number(!access.complete);
    if(access.reachable!==true||!access.complete)continue;
    const witness=['HOLD',...access.witness],t=replay(ready,access.witness);if(!t?.valid||t.events.length!==1||t.events[0].type!=='T'||t.events[0].spin!=='full'||t.events[0].lines!==2||!S.canonicalClear(t.events[0]))continue;
    const scored=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness,hold:true,holdCount:1},capped,initial,n.rootIndex,readAssessment);
    if(!scored.notchValid||scored.cycleDebt||!certifiedCavities(scored)||!scored.assessment.regionalSupport||scored.assessment.maxHeight>=20)continue;
    if(!scored.qualified)qualify([scored]);
    if(!scored.qualified||scored.assessment.right.entry?.status==='unresolved-budget'||!accessSafe(scored)||!resourceSafe(scored))continue;
    const candidate=options[rightCapAdmission](describeNode(clone(scored),false));base.metrics.nodes=candidate.metrics?.nodes??base.metrics.nodes;
    if(candidate.target&&now()<deadline&&base.metrics.nodes<=limit){preference.selected=true;preference.capLock=2;preference.scoreLock=3;return finish(candidate);}
   }
  }
  return finish(incumbent);
 }
 // Ordinary S allocation is a plan-level decision: an O/J root may spend S
 // on Left later in its prefix. Certify that incumbent first, then compare
 // complete visible allocations without changing main beam ranking/depth.
 const ordinaryLeftS=best.slAllocation?.left.filter(p=>!p.confirmedHanging)??[];
 const ordinaryRootResources=M.start(literal,summary),ordinaryVisibleL=new Set([ordinaryRootResources.active,ordinaryRootResources.hold,...ordinaryRootResources.queue].filter(p=>p?.type==='L'&&p.id>0).map(p=>p.id));
 const ordinaryPreserves=n=>ordinaryLeftS.some(p=>[n.resources?.active,n.resources?.hold].some(q=>q?.id===p.sId))&&[n.resources?.active,n.resources?.hold,...(n.resources?.queue??[])].some(p=>ordinaryVisibleL.has(p?.id));
 const legacySLApplicable=!options.disableSupportedSLPreference&&!resourceGoal(best.path)&&[literal.active?.type,literal.hold].includes('S')&&ordinaryVisibleL.size;
 const possibleLeftSupport=first.event.type==='I'&&first.structuralEvidence?.allocation==='quad-preparation';
 const ordinaryAllocationSeeds=ordinaryLeftS.length&&ordinaryVisibleL.size?[...new Set(completedSLLayers.flat())].filter(n=>n.path.length===best.path.length&&ordinaryPreserves(n)&&n.notchValid&&!n.cycleDebt&&n.assessment.maxHeight<20&&n.assessment.regionalSupport&&certifiedCavities(n)&&scoringReplacement(n,best,best).allowed):[];
 if(!options.disableOrdinarySAllocation&&!legacySLApplicable&&!possibleLeftSupport&&options.openingPhase===false&&options.resourceContext&&['complete','partial'].includes(summary.coverage?.status)&&
    options.allowHold!==false&&!options.commitment&&!options.constructionPrevious&&!commitment&&!cleanupCommitment&&ordinaryAllocationSeeds.length&&options[supportedSLAdmission]){
  const startNodes=base.metrics.nodes,prefix=n=>n.path.map(p=>({witness:p.witness.slice(),event:clone(p.event),resultContext:context(p.state)}));
  const telemetry={attempted:true,selected:false,reason:'no-certified-S-preserving-allocation',nodes:0,candidates:0,referenceScans:0,unfinished:0,comparisons:[],incumbentPrefix:prefix(best),scope:'ordinary actual S Left versus complete visible SL at equal placed/drawn identities and inventory; exact incumbent fallback'};
  const incumbent=options[supportedSLAdmission](describeNode(clone(best)));base.metrics.nodes=incumbent.metrics?.nodes??base.metrics.nodes;
  if(!incumbent.target)return incumbent;best.continuationChecked=true;
  const admission=a=>({continuation:clone(a.continuation),evidence:clone(a.evidence),assessment:clone(a.assessment)});telemetry.incumbentAdmission=admission(incumbent);
  telemetry.rootVisibleSL=[ordinaryRootResources.active,ordinaryRootResources.hold,...ordinaryRootResources.queue].filter(p=>p&&['S','L'].includes(p.type)).map(p=>clone(p));
  const finish=result=>{telemetry.nodes=base.metrics.nodes-startNodes;result.metrics={...result.metrics,nodes:base.metrics.nodes,elapsedMs:Date.now()-started,ordinarySAllocation:telemetry};return result;};
  const available=()=>now()<deadline&&base.metrics.nodes<limit;
  const policyCache=new Map(),flags=state=>{const key=stateKey(state);if(!policyCache.has(key))policyCache.set(key,policyWitnesses(state));return policyCache.get(key);};
  const admissible=n=>n.notchValid&&!n.cycleDebt&&n.assessment.maxHeight<20&&n.assessment.regionalSupport&&certifiedCavities(n);
  const stepAllowed=(before,p,notches)=>S.canonicalClear(p.event)&&!p.event.topOut&&ordinaryRightEligible(p.event)&&ordinaryCenterEligible(before,p,notches);
  const append=(n,p)=>{
   if(!available()||!stepAllowed(n.state,p,n.notches))return null;
   const child=nodeFor({...p,...flags(n.state)},n,initial,n.rootIndex,readAssessment);
   return admissible(child)&&publicDrawHorizon(literal,child.path,summary)?child:null;
  };
  const extend=n=>{
   if(!available())return null;
   const e=R.placements(n.state,{allowHold:true,deadline,now,maxNodes:Math.max(0,limit-base.metrics.nodes)});base.metrics.nodes+=e.visited;
   if(!e.complete){telemetry.unfinished++;return null;}
   const children=[];for(const p of e.placements){if(!available()){telemetry.unfinished++;return null;}const child=append(n,p);if(child)children.push(child);}return children;
  };
  const certify=n=>{
   if(!available())return null;if(!n.qualified)qualify([n]);
   if(!n.qualified||n.assessment.right.entry?.status==='unresolved-budget'||!certifyContinuation(n))return null;
   const advice=options[supportedSLAdmission](describeNode(clone(n),false));base.metrics.nodes=advice.metrics?.nodes??base.metrics.nodes;
   return advice.target&&available()?advice:null;
  };
  const visibleL=ordinaryVisibleL;
  // A small late proof, not a second unbounded beam. Only complete-layer
  // alternatives at the incumbent's horizon may enter. Extensions stay within
  // the original seven literal-known-piece envelope and residual budget.
  const alternatives=orderContinuations(ordinaryAllocationSeeds.filter(n=>admissible(n)&&scoringReplacement(n,best,best).allowed)).slice(0,4);
  telemetry.candidates=alternatives.length;const completedAllocations=[];
  for(const alternative of alternatives){
   if(!available())break;
   const children=extend(alternative);if(!children){telemetry.reason='candidate-extension-unknown';return finish(incumbent);}
   const starts=orderContinuations(children.filter(n=>{const p=n.path.at(-1),piece=placedResource(alternative.resources,p.witness);return p.event.type==='S'&&!p.event.lines&&p.event.cells.every(([x])=>x>=4&&x<=6)&&ordinaryLeftS.some(s=>s.sId===piece?.id)&&n.resources.pendingCenter.some(c=>c.family==='SL'&&c.rootId===piece.id)&&supportedCenterPattern(n.assessment.structure.center);}));
   for(const start of starts){
    if(!available())break;
    const proof=M.repair(start.state,start.resources,{notches:start.notches,depth:Math.max(0,7-start.path.length),maxNodes:Math.max(0,limit-base.metrics.nodes),deadline,now,acceptStep:stepAllowed});base.metrics.nodes+=proof.visited;
    if(proof.valid!==true){telemetry.unfinished+=Number(proof.valid===null);telemetry.reason=proof.valid===null?'SL-completion-proof-unknown':'SL-completion-proof-rejected';continue;}
    let candidate=start;for(const step of proof.path??[]){
     if(!candidate||!available()||base.metrics.nodes+step.witness.length>limit){candidate=null;break;}base.metrics.nodes+=step.witness.length;
     const replay=R.replay(candidate.state,step.witness);
     if(!replay.valid||replay.events.length!==1||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||stateKey(replay.state)!==stateKey(step.state)){candidate=null;break;}
     candidate=append(candidate,{...step,state:replay.state,event:replay.events[0]});
    }
    if(!candidate||candidate.path.length>7||!candidate.slAllocation.paid.some(p=>visibleL.has(p.lId)&&ordinaryLeftS.some(s=>s.sId===p.sId))||candidate.resources.pendingCenter.length)continue;
    if(publicDrawHorizon(literal,candidate.path,summary))completedAllocations.push(candidate);
   }
  }
  // Rank whole completed allocations, not their shorter pre-S prefixes. This
  // avoids choosing a worse Left arrangement merely because its first inputs
  // were cheaper before the common S/L completion was included.
  telemetry.completedCandidates=completedAllocations.length;
  for(const candidate of orderContinuations(completedAllocations)){
    if(!available())break;
    const draw=publicDrawHorizon(literal,candidate.path,summary);if(!draw)continue;
    // Certify the strongest exact-prefix reference at the same used inventory.
    // A failed/unfinished reference cannot be replaced by an easier opponent.
    let layer=[best];for(let depth=best.path.length;depth<candidate.path.length;depth++){
     const next=[];for(const n of layer){const children=extend(n);telemetry.referenceScans++;if(!children){telemetry.reason='reference-extension-unknown';return finish(incumbent);}next.push(...children);}
     const used=new Set(draw.placed);layer=orderContinuations(next.filter(n=>{const d=publicDrawHorizon(literal,n.path,summary);return d&&d.placed.every(id=>used.has(id));})).slice(0,8);
     if(!layer.length)break;
    }
    const sameInventory=d=>d&&JSON.stringify({placed:d.placed.slice().sort((a,b)=>a-b),active:d.active,hold:d.hold,queue:d.queue,drawn:d.drawn})===JSON.stringify({placed:draw.placed.slice().sort((a,b)=>a-b),active:draw.active,hold:draw.hold,queue:draw.queue,drawn:draw.drawn});
    const references=orderContinuations(layer.filter(n=>n.path.length===candidate.path.length&&sameInventory(publicDrawHorizon(literal,n.path,summary))));
    const reference=references[0];if(!reference){telemetry.reason='no-equal-inventory-reference';continue;}
    const referenceAdvice=certify(reference);if(!referenceAdvice){telemetry.reason='reference-certificate-unavailable';return finish(incumbent);}
    const candidateAdvice=certify(candidate);if(!candidateAdvice){telemetry.reason='candidate-certificate-unavailable';return finish(incumbent);}
    const comparison=ordinarySAllocationComparison(candidate,reference,{candidateDraw:draw,referenceDraw:publicDrawHorizon(literal,reference.path,summary),original:best,initialResources:initial.resources});telemetry.comparisons.push(comparison);telemetry.reason=comparison.reason;
    if(!comparison.allowed)continue;
    telemetry.selected=true;telemetry.candidatePrefix=prefix(candidate);telemetry.referencePrefix=prefix(reference);telemetry.comparison=comparison;telemetry.referenceAdmission=admission(referenceAdvice);telemetry.candidateAdmission=admission(candidateAdvice);
    // Finish the old selection first. Optional tail work may never replace
    // this private, fully checked result by the earlier S-Left incumbent.
    if(options.disableVisibleSLTail)return finish(candidateAdvice);
    const remaining=[candidate.resources.active,candidate.resources.hold,...candidate.resources.queue].filter(Boolean),io=remaining.filter(p=>'IO'.includes(p.type));
    if(io.length<1||io.length>2||!io.some(p=>p.type==='O')||io.some(p=>!Number.isInteger(p.id)||p.id<=0)||remaining.some(p=>!'IOTZ'.includes(p.type))||candidate.path.length+io.length>7)return finish(candidateAdvice);
    const tailStart=base.metrics.nodes,tail={attempted:true,selected:false,reason:'no-certified-tail-gain',nodes:0,prefixLimit:4,width:2,prefixes:[],priorAdmission:admission(candidateAdvice),priorPrefix:prefix(candidate),literalTailIds:io.map(p=>p.id),scope:'same paid SL and literal I/O tail; strongest bounded exact-prefix extension; selected SL fallback on unknown'};
    telemetry.visibleTail=tail;
    const tailFinish=result=>{tail.nodes=base.metrics.nodes-tailStart;return finish(result);};
    const inventory=d=>d&&JSON.stringify({placed:d.placed.slice().sort((a,b)=>a-b),active:d.active,hold:d.hold,queue:d.queue,drawn:d.drawn});
    const startingInventory=inventory(draw),paid=n=>JSON.stringify(n.slAllocation.paid.map(p=>[p.sId,p.lId]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
    const seen=new Set([nodeKey(candidate)]),tailPrefixes=[candidate];
    let compatiblePrefixCount=1;
    for(const n of orderContinuations(completedAllocations)){
     const key=nodeKey(n);if(seen.has(key)||n.path.length!==candidate.path.length||inventory(publicDrawHorizon(literal,n.path,summary))!==startingInventory||paid(n)!==paid(candidate))continue;
     seen.add(key);compatiblePrefixCount++;if(tailPrefixes.length<4)tailPrefixes.push(n);
    }
    tail.compatiblePrefixes=compatiblePrefixCount;tail.retainedPrefixes=tailPrefixes.length;tail.omittedPrefixes=compatiblePrefixCount-tailPrefixes.length;
    const tailIds=new Set(io.map(p=>p.id)),tailEndpoints=[];
    for(const start of tailPrefixes){
     if(!available()){tail.reason='tail-budget-unknown';return tailFinish(candidateAdvice);}
     const prefixAdmission=start===candidate?candidateAdvice:certify(start);
     if(!prefixAdmission){tail.reason='tail-prefix-certificate-unavailable';return tailFinish(candidateAdvice);}
     const record={prefix:prefix(start),prefixAdmission:admission(prefixAdmission),startNodes:base.metrics.nodes,layers:[]};tail.prefixes.push(record);
     let layer=[start];
     for(let depth=0;depth<io.length;depth++){
      const next=[];
      for(const n of layer){
       const children=extend(n);if(!children){tail.reason='tail-extension-unknown';return tailFinish(candidateAdvice);}
       // Never hide an actual scoring competitor by declaring its T/Z outside
       // this I/O comparison. Decline the optional stage instead.
       if(children.some(v=>v.path.at(-1).event.lines&&!tailIds.has(placedResource(n.resources,v.path.at(-1).witness)?.id))){tail.reason='tail-competing-score';return tailFinish(candidateAdvice);}
       next.push(...children.filter(v=>tailIds.has(placedResource(n.resources,v.path.at(-1).witness)?.id)));
      }
      const unique=new Map();for(const n of next.sort(compareSLTail)){const key=nodeKey(n);if(!unique.has(key))unique.set(key,n);}
      record.layers.push({nodes:base.metrics.nodes,generated:next.length,distinct:unique.size,retained:Math.min(2,unique.size)});layer=[...unique.values()].slice(0,2);
      if(!layer.length)break;
     }
     if(!layer.length){tail.reason='tail-no-compatible-extension';return tailFinish(candidateAdvice);}
     // Entry qualification can change the structural band. Resolve every
     // retained final endpoint before ordering; unknown is not a low score.
     const ordered=qualifiedSLTailOrder(layer,n=>{if(!available())return false;if(!n.qualified)qualify([n]);return n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget';});
     if(!ordered){tail.reason='tail-qualification-unknown';return tailFinish(candidateAdvice);}
     record.qualifiedEndpoints=ordered.length;record.endpointOrder=ordered.map(n=>({prefix:prefix(n),rank:n.rank.slice(),leftScore:n.assessment.leftContext?.score,centerContinuity:n.centerContinuity,structuralScore:n.structuralScore,entry:n.assessment.right.entry??null}));
     // Certify the strongest bounded endpoint, never an easier weaker one.
     const endpoint=ordered[0];
     record.endNodes=base.metrics.nodes;record.endpointPrefix=prefix(endpoint);record.draw=publicDrawHorizon(literal,endpoint.path,summary);
     tailEndpoints.push({node:endpoint,record});
    }
    const tailReference=tailEndpoints[0],choice=tailEndpoints.slice(1).sort((a,b)=>compareSLTail(a.node,b.node))[0];
    if(!choice){tail.reason='tail-no-competing-prefix';return tailFinish(candidateAdvice);}
    // Certify only the strongest bounded reference and challenger. A failed
    // strongest certificate never causes selection of an easier weaker one.
    tailReference.advice=certify(tailReference.node);
    if(!tailReference.advice){tail.reason='tail-reference-certificate-unavailable';return tailFinish(candidateAdvice);}
    choice.advice=certify(choice.node);
    if(!choice.advice){tail.reason='tail-candidate-certificate-unavailable';return tailFinish(candidateAdvice);}
    tail.referencePrefix=prefix(tailReference.node);tail.referenceAdmission=admission(tailReference.advice);
    tailReference.record.endpointAdmission=admission(tailReference.advice);choice.record.endpointAdmission=admission(choice.advice);
    const result=visibleSLTailComparison(choice.node,tailReference.node,{candidateDraw:publicDrawHorizon(literal,choice.node.path,summary),referenceDraw:publicDrawHorizon(literal,tailReference.node.path,summary),original:candidate,initialResources:initial.resources});tail.comparison=result;tail.reason=result.reason;
    if(!result.allowed)return tailFinish(candidateAdvice);
    tail.selected=true;tail.candidatePrefix=prefix(choice.node);tail.candidateAdmission=admission(choice.advice);
    // Keep the original S-allocation comparison describing its real five-lock
    // proof; the selected seven-lock admission is separately replayable here.
    return tailFinish(choice.advice);
  }
  return finish(incumbent);
 }
 // An S already on the board needs surrounding allocation, not another S
 // bonus. Keep its actual L payment last so the existing Center goal retains
 // the whole finite route, including an intervening canonical score.
 const pendingSL=ordinaryRootResources.pendingCenter.filter(p=>p.family==='SL'),pendingPair=pendingSL.length===1&&pendingSL[0].rootId>0&&!pendingSL[0].lost?best.slAllocation?.paid.find(p=>p.sId===pendingSL[0].rootId&&ordinaryVisibleL.has(p.lId)):null;
 if(!options.disablePendingSLAllocation&&pendingPair&&ordinaryRootResources.pendingCenter.length===1&&!ordinaryLeftS.length&&
    options.openingPhase===false&&options.resourceContext&&['complete','partial'].includes(summary.coverage?.status)&&options.allowHold!==false&&
    !options.commitment&&!options.constructionPrevious&&!commitment&&!cleanupCommitment&&best.path.length>=2&&options[supportedSLAdmission]){
  const prefix=n=>n.path.map(p=>({witness:p.witness.slice(),event:clone(p.event),resultContext:context(p.state)}));
  const admission=a=>({continuation:clone(a.continuation),evidence:clone(a.evidence),assessment:clone(a.assessment)});
  const horizon=Math.min(7,best.path.length+2),seedDepth=best.path.length-1;
  const incumbent=options[supportedSLAdmission](describeNode(clone(best)));base.metrics.nodes=incumbent.metrics?.nodes??base.metrics.nodes;
  if(!incumbent.target)return incumbent;
  const startNodes=base.metrics.nodes,optionalLimit=Math.min(limit,startNodes+18000);
  const telemetry={attempted:true,selected:false,reason:'no-certified-surrounding-gain',nodes:0,startNodes,nodeLimit:optionalLimit,nodeCap:18000,prefixLimit:2,width:2,horizon,seedDepth,unfinished:0,enumerations:0,prefixes:[],comparisons:[],pendingPair:clone(pendingPair),historyCoverage:summary.coverage.status,incumbentPrefix:prefix(best),incumbentAdmission:admission(incumbent),scope:'existing observed pending SL; actual L goal last; strongest bounded exact-incumbent extension; equal literal final inventory/accounting; exact incumbent on unknown'};
  const finish=result=>{telemetry.nodes=base.metrics.nodes-startNodes;result.metrics={...result.metrics,nodes:base.metrics.nodes,elapsedMs:Date.now()-started,pendingSLAllocation:telemetry};return result;};
  const available=()=>now()<deadline&&base.metrics.nodes<optionalLimit;
  const admissible=n=>n.notchValid&&!n.cycleDebt&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport;
  const live=n=>n.resources.pendingCenter.length===1&&n.resources.pendingCenter.some(p=>p.family==='SL'&&p.rootId===pendingPair.sId&&!p.lost)&&[n.resources.active,n.resources.hold,...n.resources.queue].some(p=>p?.id===pendingPair.lId)&&!n.slAllocation.paid.length&&!n.slAllocation.left.length;
  const inventory=d=>d&&JSON.stringify({placed:d.placed.slice().sort((a,b)=>a-b),drawn:d.drawn,active:d.active,hold:d.hold,queue:d.queue});
  const seeds=completedSLLayers.flat().filter(n=>n.path.length===seedDepth&&admissible(n)&&live(n)&&n.path.every(p=>!['S','L'].includes(p.event.type))&&publicDrawHorizon(literal,n.path,summary));
  const uniqueSeeds=[...new Map(seeds.map(n=>[nodeKey(n),n])).values()],starts=diversify(uniqueSeeds,2).map(clone);
  telemetry.eligiblePrefixes=uniqueSeeds.length;telemetry.retainedPrefixes=starts.length;telemetry.omittedPrefixes=uniqueSeeds.length-starts.length;
  if(!starts.length){telemetry.reason='no-completed-pending-prefix';return finish(incumbent);}
  const policyCache=new Map(),flags=state=>{const key=stateKey(state);if(!policyCache.has(key))policyCache.set(key,policyWitnesses(state));return policyCache.get(key);};
  const extend=(n,candidate,used=null)=>{
   if(!available())return null;
   const e=R.placements(n.state,{allowHold:true,deadline,now,maxNodes:Math.max(0,optionalLimit-base.metrics.nodes)});base.metrics.nodes+=e.visited;telemetry.enumerations++;
   if(!e.complete){telemetry.unfinished++;return null;}
   const children=[];
   for(const p of e.placements){
    if(!available()){telemetry.unfinished++;return null;}
    if(!S.canonicalClear(p.event)||p.event.topOut||!ordinaryRightEligible(p.event)||!ordinaryCenterEligible(n.state,p,n.notches))continue;
    const piece=placedResource(n.resources,p.witness);if(!piece||piece.id<=0||used&&!used.has(piece.id))continue;
    if(candidate&&(p.event.type==='S'||p.event.type==='L'&&(n.path.length+1!==horizon||piece.id!==pendingPair.lId)))continue;
    const child=nodeFor({...p,...flags(n.state)},n,initial,n.rootIndex,readAssessment);
    if(!admissible(child)||!publicDrawHorizon(literal,child.path,summary))continue;
    if(candidate){
     if(child.path.length<horizon&&!live(child))continue;
     if(child.path.length===horizon&&(p.event.type!=='L'||piece.id!==pendingPair.lId||child.resources.pendingCenter.length||!child.slAllocation.paid.some(pair=>pair.sId===pendingPair.sId&&pair.lId===pendingPair.lId)))continue;
    }
    children.push(child);
   }
   return children;
  };
  const endpointRecord=n=>({prefix:prefix(n),rank:n.rank.slice(),leftContext:clone(n.assessment.leftContext),leftScore:n.assessment.leftContext?.score,structuralScore:n.structuralScore,centerContinuity:n.centerContinuity,entry:clone(n.assessment.right.entry??null),draw:publicDrawHorizon(literal,n.path,summary),resourceBinding:M.binding(n.resources)});
  const boundedLayer=(nodes,final)=>{
   // Deduplication merges the same physical/resource endpoint, whose entry
   // qualification is identical. Never truncate distinct FINAL endpoints by
   // optimistic rank: every compatible one is qualified before ordering.
   const unique=new Map();for(const n of nodes.sort(compareSLTail)){const key=nodeKey(n);if(!unique.has(key))unique.set(key,n);}
   const distinct=[...unique.values()],ordered=final?qualifyAll(distinct):distinct;
   return ordered?{layer:ordered.slice(0,2),distinct:unique.size,...(final?{qualified:ordered.length,endpointOrder:ordered.map(endpointRecord)}:{})}:null;
  };
  const grow=(start,candidate,used=null,compatibleEnd=null)=>{
   const record={kind:candidate?'challenger':'exact-incumbent-reference',prefix:prefix(start),layers:[]};telemetry.prefixes.push(record);let layer=[start];
   for(let depth=start.path.length;depth<horizon;depth++){
    const next=[];for(const n of layer){const children=extend(n,candidate,used);if(!children)return null;next.push(...children);}
    const final=depth+1===horizon,compatible=final&&compatibleEnd?next.filter(compatibleEnd):next,selected=boundedLayer(compatible,final);
    if(!selected){telemetry.reason=candidate?'candidate-qualification-unknown':'reference-qualification-unknown';return null;}
    layer=selected.layer;record.layers.push({depth:depth+1,generated:next.length,compatible:compatible.length,distinct:selected.distinct,retained:layer.length,...(final?{qualified:selected.qualified,endpointOrder:selected.endpointOrder}:{})});
    if(!layer.length)break;
   }
   return layer.filter(n=>n.path.length===horizon);
  };
  const qualifyAll=nodes=>qualifiedSLTailOrder(nodes,n=>{
   if(!available())return false;if(!n.qualified)qualify([n],optionalLimit);
   return n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget'&&available();
  });
  const certify=n=>{
   if(!available())return null;
   const previousLimit=screeningLimit;screeningLimit=optionalLimit;
   let checked;try{checked=certifyContinuation(n);}finally{screeningLimit=previousLimit;}
   if(!checked||!available())return null;
   const result=options[supportedSLAdmission](describeNode(clone(n),false),optionalLimit);base.metrics.nodes=result.metrics?.nodes??base.metrics.nodes;
   return result.target&&available()?result:null;
  };
  const endpoints=[];
  for(const start of starts){const found=grow(start,true);if(!found){if(telemetry.reason!=='candidate-qualification-unknown')telemetry.reason='candidate-extension-unknown';return finish(incumbent);}endpoints.push(...found);}
  if(!endpoints.length){telemetry.reason='no-complete-goal-last-endpoint';return finish(incumbent);}
  const ordered=qualifyAll(endpoints);if(!ordered){telemetry.reason='candidate-qualification-unknown';return finish(incumbent);}
  // Pick once from the declared bounded pool. Neither a failed strongest
  // candidate nor a missing matching reference authorizes an easier opponent.
  const candidate=ordered[0],candidateDraw=publicDrawHorizon(literal,candidate.path,summary);
  telemetry.candidateOrder=ordered.map(endpointRecord);
  const sameEndpointClass=n=>inventory(publicDrawHorizon(literal,n.path,summary))===inventory(candidateDraw)&&M.binding(n.resources)===M.binding(candidate.resources);
  const referenceEndpoints=grow(clone(best),false,new Set(candidateDraw.placed),sameEndpointClass);
  if(!referenceEndpoints){if(telemetry.reason!=='reference-qualification-unknown')telemetry.reason='reference-extension-unknown';return finish(incumbent);}
  const compatible=referenceEndpoints.filter(sameEndpointClass);
  if(!compatible.length){telemetry.reason='no-equal-inventory-reference';return finish(incumbent);}
  const references=qualifyAll(compatible);if(!references){telemetry.reason='reference-qualification-unknown';return finish(incumbent);}
  const reference=references[0];telemetry.referenceOrder=references.map(endpointRecord);
  telemetry.referencePrefix=prefix(reference);telemetry.candidatePrefix=prefix(candidate);
  const referenceAdvice=certify(reference);if(!referenceAdvice){telemetry.reason='reference-certificate-unavailable';return finish(incumbent);}
  telemetry.referenceAdmission=admission(referenceAdvice);
  const candidateAdvice=certify(candidate);if(!candidateAdvice){telemetry.reason='candidate-certificate-unavailable';return finish(incumbent);}
  telemetry.candidateAdmission=admission(candidateAdvice);
  const comparison=pendingSLAllocationComparison(candidate,reference,{candidateDraw,referenceDraw:publicDrawHorizon(literal,reference.path,summary),original:best,initialResources:ordinaryRootResources});telemetry.comparisons.push(comparison);telemetry.comparison=comparison;telemetry.reason=comparison.reason;
  if(!comparison.allowed)return finish(incumbent);
  telemetry.selected=true;return finish(candidateAdvice);
 }
 // Compare a genuinely executable S/L allocation only after the unchanged
 // filler incumbent has passed the final boundary. This is not a beam bonus,
 // a new ordinary admission rule, or permission to postpone an existing goal.
 const literalResource=M.start(literal,summary),visibleLIds=new Set([literalResource.active,literalResource.hold,...literalResource.queue].filter(p=>p?.type==='L'&&Number.isInteger(p.id)&&p.id>0).map(p=>p.id));
 if(!options.disableSupportedSLPreference&&options.resourceContext&&['complete','partial'].includes(summary.coverage?.status)&&options.openingPhase===false&&options.allowHold!==false&&!options.commitment&&!options.constructionPrevious&&!commitment&&!cleanupCommitment&&!resourceGoal(best.path)&&[literal.active?.type,literal.hold].includes('S')&&visibleLIds.size&&options[supportedSLAdmission]){
  const prefix=n=>n.path.map(p=>({witness:p.witness.slice(),event:clone(p.event),resultContext:context(p.state)}));
  const startNodes=base.metrics.nodes,preference={comparisons:[],reason:'no-admissible-paid-pair',attempted:true,selected:false,checked:0,proofs:0,unfinishedProofs:0,nodes:0,retainedDepths:completedSLLayers.map(layer=>layer[0]?.path.length).filter(Number.isInteger),repairProofLocks:0,historyCoverage:summary.coverage.status,incumbentPrefix:prefix(best),scope:'late actual visible S/L payment versus certified equal-lock/equal-public-draw incumbent; strict Left or actual-score gain; exact incumbent on tie/unknown'};
  const incumbent=options[supportedSLAdmission](describeNode(clone(best)));base.metrics.nodes=incumbent.metrics?.nodes??base.metrics.nodes;
  if(!incumbent.target)return incumbent;best.continuationChecked=true;
  const admission=a=>({continuation:clone(a.continuation),evidence:clone(a.evidence),assessment:clone(a.assessment)});preference.incumbentAdmission=admission(incumbent);
  const finish=result=>{preference.nodes=base.metrics.nodes-startNodes;result.metrics={...result.metrics,nodes:base.metrics.nodes,elapsedMs:Date.now()-started,supportedSLPreference:preference};return result;};
  const policyCache=new Map(),flags=before=>{const key=JSON.stringify(observe(before));if(!policyCache.has(key))policyCache.set(key,policyWitnesses(before));return policyCache.get(key);};
  // Restrict this newly preferred finite path, never the ordinary fallback.
  // Otherwise a Center pair could hide an unrelated unsupported Right filler.
  const acceptStep=(before,p,notches)=>{
   if(!S.canonicalClear(p.event)||p.event.topOut||!ordinaryRightEligible(p.event)||!ordinaryCenterEligible(before,p,notches))return false;
   const transition=S.transition(before,{...p,...flags(before)},undefined,{notches});
   if(transition.cycleViolations.length||readAssessment(p.state.board).maxHeight>=20)return false;
   if(!p.event.lines&&p.event.cells.some(([x])=>x>=7))return p.event.type==='I'&&transition.allocation==='quad-preparation'||p.event.type==='Z'&&transition.allocation==='right-cap-preparation';
   return true;
  };
  const placed=(resource,witness)=>{let active=resource.active,hold=resource.hold,queue=resource.queue.slice();for(const action of witness)if(action==='HOLD'){if(hold){const prior=active;active=hold;hold=prior;}else{hold=active;active=queue.shift()??null;}}return active;};
  const cellKey=cells=>JSON.stringify(cells.slice().sort(([x,y],[u,v])=>x-u||y-v));
  const pairFacts=path=>{
   if(!path.length||path[0].event.type!=='S'||path[0].event.lines||!path[0].event.cells.every(([x])=>x>=4&&x<=6))return null;
   let state=s,resource=initial.resources,notches=initial.notches,reservation=null,firstS=null,paidL=null,paymentLock=null;
   for(const [i,p]of path.entries()){
    if(!acceptStep(state,p,notches))return null;
    const piece=placed(resource,p.witness);if(!piece||piece.type!==p.event.type)return null;
    const pending=reservation&&resource.pendingCenter.find(c=>c.rootId===reservation.rootId&&c.family==='SL');
    const completion=pending&&p.event.type==='L'&&p.event.lines===0&&pending.alternatives.some(c=>c.piece==='L'&&cellKey(c.cells)===cellKey(p.event.cells))&&S.geometry(state.board,{notches}).center.completions.some(c=>c.piece==='L'&&c.patternSupport==='reference-supported'&&c.resultStatus==='level'&&cellKey(c.cells)===cellKey(p.event.cells));
    const next=M.step(state,p,resource);if(next.violations.length)return null;
    const phase=S.advanceNotches(state.board,p,notches);if(!phase.valid)return null;
    if(i===0){reservation=next.pendingCenter.find(c=>c.rootId===piece.id&&c.family==='SL'&&!resource.pendingCenter.some(old=>old.rootId===c.rootId));if(!reservation||!Number.isInteger(piece.id)||piece.id<=0||!supportedCenterPattern(S.geometry(p.state.board,{notches:phase.pattern}).center))return null;firstS={id:piece.id,bag:piece.bag};}
    if(completion){if(!visibleLIds.has(piece.id))return null;paidL={id:piece.id,bag:piece.bag};paymentLock=i+1;}
    resource=next;state=p.state;notches=phase.pattern;
   }
   return{firstS,paidL,paymentLock,reservation:reservation.rootId,pending:resource.pendingCenter.some(c=>c.rootId===reservation.rootId),endpointSupported:supportedCenterPattern(S.geometry(state.board,{notches}).center)&&S.geometry(state.board,{notches}).center.status==='level'};
  };
  const alternatives=[];
  for(const n of new Set(completedSLLayers.flat())){if(now()>=deadline||base.metrics.nodes>=limit)break;if(n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport&&pairFacts(n.path))alternatives.push(n);}
  // Prefer already paid candidates so speculative long repair cannot hide a
  // directly comparable complete-layer pair. No weight changes ordinary search.
  alternatives.sort((a,b)=>Number(Boolean(pairFacts(b.path)?.paidL))-Number(Boolean(pairFacts(a.path)?.paidL))||Math.abs(a.path.length-best.path.length)-Math.abs(b.path.length-best.path.length)||compareConstruction(a,b));
  preference.candidates=alternatives.length;
  for(const n of alternatives){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   // No caller flag can waive repair grammar. The optional callback only
   // rejects steps which violate actual cap/cleanup or this finite Right role.
   const proof=M.repair(n.state,n.resources,{notches:n.notches,depth:4,maxNodes:Math.max(0,limit-base.metrics.nodes),deadline,now,acceptStep});base.metrics.nodes+=proof.visited;preference.proofs++;preference.lastProofStatus=proof.status;preference.unfinishedProofs+=Number(proof.valid===null);
   if(proof.valid!==true){preference.reason=proof.valid===null?'optional-repair-unknown':'optional-repair-rejected';continue;}
   const repair=proof.path||[];if(n.path.length+repair.length>7)continue;
   let completed=n;
   for(const step of repair){
    if(now()>=deadline||base.metrics.nodes+step.witness.length>limit){completed=null;break;}
    base.metrics.nodes+=step.witness.length;
    const r=R.replay(completed.state,step.witness);
    if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||stateKey(r.state)!==stateKey(step.state)){completed=null;break;}
    completed=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness.slice(),hold:step.witness.includes('HOLD'),holdCount:holdCount(step),...flags(completed.state)},completed,initial,n.rootIndex,readAssessment);
    if(completed.cycleDebt||!completed.notchValid||completed.assessment.maxHeight>=20){completed=null;break;}
   }
   const paid=completed&&pairFacts(completed.path);
   if(!paid?.paidL||paid.pending||!paid.endpointSupported||!certifiedCavities(completed)||!completed.assessment.regionalSupport)continue;
   // A shorter paid pair needs an already searched exact-prefix descendant;
   // never pad it or truncate the incumbent to manufacture equal horizons.
   if(completed.path.length<best.path.length){
    const descendants=completedSLLayers.flat().filter(v=>v.path.length===best.path.length&&exactAllocationPrefix(v,completed));
    completed=orderContinuations(descendants)[0]??null;
    if(!completed){preference.reason='missing-paid-candidate-descendant';preference.comparisons.push({allowed:false,reason:preference.reason,candidateHorizon:paid.paymentLock,referenceHorizon:best.path.length});return finish(incumbent);}
   }
   const facts=pairFacts(completed.path),candidateDraw=publicDrawHorizon(literal,completed.path,summary);
   if(!facts?.paidL||facts.pending||!facts.endpointSupported)continue;
   const referenceCandidates=completed.path.length===best.path.length?[best]:completedSLLayers.flat().filter(v=>v.path.length===completed.path.length&&exactAllocationPrefix(v,best));
   // Do not filter away unproved safety/entry/resource facts before choosing
   // the strongest compatible reference. Its unknown proof cannot authorize
   // substitution of an easier, weaker opponent.
   const compatible=referenceCandidates.filter(v=>{const draw=publicDrawHorizon(literal,v.path,summary);return candidateDraw&&draw&&candidateDraw.draws===draw.draws&&JSON.stringify(candidateDraw.drawn)===JSON.stringify(draw.drawn);});
   if(!compatible.length){preference.reason=referenceCandidates.length?'unequal-or-unknown-public-draw-horizon':'missing-equal-horizon-reference';preference.comparisons.push({allowed:false,reason:preference.reason,candidateHorizon:completed.path.length,referenceHorizon:best.path.length,candidateDraw,referenceDraws:referenceCandidates.map(v=>publicDrawHorizon(literal,v.path,summary))});return finish(incumbent);}
   const reference=certifyStrongestAllocation(compatible,reference=>{
    preference.referencePrefix=prefix(reference);preference.referenceSource=reference===best?'exact-incumbent':'completed-layer-exact-prefix-descendant';
    if(reference===best)preference.referenceAdmission=admission(incumbent);
    if(now()>=deadline||base.metrics.nodes>=limit){preference.reason='optional-comparison-budget';return false;}
    // The exact incumbent already passed final admission. A descendant needs
    // every ordinary certificate under the original residual request budget.
    if(reference!==best){
     if(!reference.qualified)qualify([reference]);
     if(!reference.qualified||reference.assessment.right.entry?.status==='unresolved-budget'||reference.cycleDebt||!reference.notchValid||!certifiedCavities(reference)||!certifyContinuation(reference)){
      preference.reason='reference-certificate-unavailable';preference.comparisons.push({allowed:false,reason:preference.reason,candidateHorizon:completed.path.length,referenceHorizon:reference.path.length});return false;
     }
     const admitted=options[supportedSLAdmission](describeNode(clone(reference),false));base.metrics.nodes=admitted.metrics?.nodes??base.metrics.nodes;
     if(!admitted.target||now()>=deadline||base.metrics.nodes>limit){preference.reason='reference-final-admission-unavailable';return false;}preference.referenceAdmission=admission(admitted);
    }
    return true;
   });
   if(!reference)return finish(incumbent);
   if(!completed.qualified)qualify([completed]);
   if(!completed.qualified||completed.assessment.right.entry?.status==='unresolved-budget'||!certifyContinuation(completed)){
    preference.reason='candidate-certificate-unavailable';preference.comparisons.push({allowed:false,reason:preference.reason,candidateHorizon:completed.path.length,referenceHorizon:reference.path.length});return finish(incumbent);
   }
   const comparison=supportedSLComparison(completed,reference,{candidateDraw,referenceDraw:publicDrawHorizon(literal,reference.path,summary),original:best,initialResources:initial.resources});
   preference.comparisons.push(comparison);preference.reason=comparison.reason;preference.checked++;
   if(!comparison.allowed)continue;
   const candidate=options[supportedSLAdmission](describeNode(clone(completed),false));base.metrics.nodes=candidate.metrics?.nodes??base.metrics.nodes;
   if(candidate.target&&now()<deadline&&base.metrics.nodes<=limit){preference.selected=true;preference.comparison=comparison;preference.repairProofLocks=repair.length;preference.firstS=facts.firstS;preference.paidL=facts.paidL;preference.paymentLock=facts.paymentLock;return finish(candidate);}
   preference.reason='candidate-final-admission-unavailable';return finish(incumbent);
  }
  return finish(incumbent);
 }
 return describeNode(best);
 function describeNode(best,retained=best===commitment){
 const first=best.path[0],verified=R.replay(s,first.witness);if(!verified.valid)return{...base,status:'invalid-witness',reason:'The suggested input sequence failed validation, so it is not shown.'};
 const tsdAt=best.path.findIndex(p=>p.event.spin==='full'&&p.event.lines===2);
 const facts=first.structuralEvidence;
 // Describe the selected executed sequence, not the union of hypothetical
 // pieces that could complete different center surfaces. Pair order matters.
 const orderedPartner=S.CENTER_PAIRS[first.event.type];
 const centerOnly=p=>p.event.cells.every(([x])=>x>=4&&x<=6);
 const cellKey=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));

 if(centerOnly(first)&&first.event.lines===0&&orderedPartner&&facts.structure?.center.patternSupport==='reference-supported'){
  for(let i=1;i<best.path.length;i++){
   const next=best.path[i];
   if(next.event.lines!==0)break;
   if(next.event.cells.some(([x])=>x>=4&&x<=6)){
    const completion=facts.structure.center.completions.find(c=>c.piece===orderedPartner&&c.resultStatus==='level'&&c.patternSupport==='reference-supported'&&cellKey(c.cells)===cellKey(next.event.cells));
    if(centerOnly(next)&&next.event.type===orderedPartner&&completion){
     facts.pairProgress={...facts.pairProgress,orderedPieces:[first.event.type,orderedPartner],step:1,status:'completed-in-checked-prefix',completionLock:i+1};
     next.structuralEvidence.pairFamily=first.event.type+orderedPartner;
     next.structuralEvidence.pairProgress={orderedPieces:[first.event.type,orderedPartner],step:2,status:'completed',preparationCells:first.event.cells,completionCells:next.event.cells};
    }
    break;
   }
  }
 }
 const preparationProof=preparation&&preparation.path.every((p,i)=>best.path[i]&&p.event.type===best.path[i].event.type&&p.event.lines===best.path[i].event.lines&&p.event.spin===best.path[i].event.spin&&JSON.stringify(p.state.board)===JSON.stringify(best.path[i].state.board)&&p.state.hold===best.path[i].state.hold&&JSON.stringify(p.state.queue)===JSON.stringify(best.path[i].state.queue))?{kind:preparationKind,locks:preparation.path.length,claim:'Executed preparation preserves an available T for a checked double.'}:null;
 if(usage){
  usage.families.earlyCapFallback.selected=Number(fallbackMetrics.selected);
  usage.families.visibleCyclePreparation.selected=Number(Boolean(preparationProof&&preparationKind!=='visible-I-Z-held-T'));
  usage.selected={path:fallbackMetrics.selected?'early-cap-fallback':retained?'retained-commitment':preparationProof?'preparation:'+preparationKind:'ordinary',locks:best.path.length,rank:best.rank.slice()};
 }
 const presentation=advicePresentation(best.path,best.assessment);
 const described={...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,...presentation,
 continuation:best.path.map(p=>({target:p.target,hold:p.hold,holdCount:holdCount(p),witness:p.witness,event:p.event,resultContext:context(p.state),structuralEvidence:p.structuralEvidence})),
 evidence:{pendingLSelection:best.pendingLSelection??null,resetSelection:resetDecision,strategy:'canonical-right-ST',cycleResources:cycleResources(best.path),commitmentRetained:retained,futureNotches:best.notches,preparationProof,cycleDebt:best.cycleDebt,cavityRepair:{status:'verified-prefix-repaired',outstandingCells:best.cavityDebt},clearPolicy:'right-region full T-spin doubles and I tetrises only',verifiedLocks:best.path.length,tsdAt:tsdAt>=0?tsdAt+1:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:root.complete,budgetExhausted:stopped||Boolean(base.metrics.proofScheduling?.unfinished||base.metrics.proofScheduling?.budgetStops),searchIncomplete:Boolean(base.metrics.proofScheduling?.unfinished||base.metrics.proofScheduling?.budgetStops),informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:best.assessment.regionalSupport,channel:best.assessment.channel,endpointTEntry:best.assessment.right.entry?.status??'not-established',unresolvedObligations:best.assessment.obligations,structuralScore:best.structuralScore,structuralRank:best.rank,structure:best.assessment.structure,dependencyDebt:best.dependencyDebt,claim:'Finite executable prefix; endpoint estimates are not a sustainability guarantee.'},assessment:best.assessment};
 if(best.pendingLSelection)pendingLSelections.add(described);return described;
}
}
function plan(raw,options={}){return queryRequest(()=>planRequest(raw,options));}
function queryRequest(run){if(!R.withQueries)return run();return R.withQueries(()=>{const result=run();result.metrics={...result.metrics,queries:R.queryMetrics()};return result;});}
function planRequest(raw,options={}){
 options={...options,[resourceRepairCache]:new Map(),[pendingLHint]:options.previous?.evidence?.pendingLStage??options.commitment?.advice?.evidence?.pendingLStage??options.pendingLHint};
 const now=options.now||(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 // Only this synchronous invocation can reuse its own fully checked ordinary
 // fallback. Serialized evidence, caller callbacks and imported advice carry
 // no authority. The exact returned object AND continuation remain bound.
 let ordinaryFallback=null,ordinarySignature=null,retainedFallback=null,retainedSignature=null,maintenanceFallback=null,maintenanceSignature=null;
 const signature=r=>JSON.stringify([observe(raw),{...r,metrics:undefined}]);
 const capAdmissions=new WeakMap(),capSignature=r=>JSON.stringify([observe(raw),options.resourceContext??null,options.patternHistory??null,{...r,metrics:undefined}]);
 const admitRightCap=candidate=>{const checked=finalCheck(candidate);if(!checked?.target)return checked;const result=clone(checked);capAdmissions.set(result,capSignature(result));return result;};
 const slAdmissions=new WeakMap(),slSignature=r=>JSON.stringify([observe(raw),options.resourceContext??null,options.patternHistory??null,{...r,metrics:undefined}]);
 const admitSupportedSL=(candidate,nodeLimit)=>{const checked=finalCheck(candidate,nodeLimit);if(!checked?.target)return checked;const result=clone(checked);slAdmissions.set(result,slSignature(result));return result;};
 const admitMaintenance=candidate=>{const checked=finalCheck(candidate);if(checked?.target){maintenanceFallback=clone(checked);maintenanceSignature=signature(maintenanceFallback);}return checked;};
 const normalOpeningDecision=()=>{const result=plan(raw,{...options,deadline,disableSourceScoring:true,openingSource:null});ordinaryFallback=result;ordinarySignature=JSON.stringify([observe(raw),{...result,metrics:undefined}]);return result;};
 const sameOrdinary=()=>ordinaryFallback&&ordinarySignature===JSON.stringify([observe(raw),{...ordinaryFallback,metrics:undefined}]);
 const sameRetained=()=>retainedFallback&&retainedSignature===JSON.stringify([observe(raw),{...retainedFallback,metrics:undefined}]);
 // Only an internal producer can register a fallback, and registration itself
 // performs the full final boundary check within this request's shared budget.
 const checkOpeningFallback=candidate=>{const checked=finalCheck(candidate);if(checked?.target){retainedFallback=checked;retainedSignature=JSON.stringify([observe(raw),{...checked,metrics:undefined}]);}return checked;};
 const result=planCore(raw,{...options,deadline,normalOpeningDecision,checkOpeningFallback,admitMaintenance,[rightCapAdmission]:admitRightCap,[supportedSLAdmission]:admitSupportedSL});
 if(result===ordinaryFallback&&sameOrdinary()||result===retainedFallback&&sameRetained()||capAdmissions.has(result)&&capAdmissions.get(result)===capSignature(result)||slAdmissions.has(result)&&slAdmissions.get(result)===slSignature(result))return result;
 const checked=finalCheck(result);
 if(!checked?.target&&maintenanceFallback&&signature(maintenanceFallback)===maintenanceSignature){
  // Only this invocation's admitted clone can survive later interrupted work.
  // Preserve actual spent nodes and search-depth completeness, not the old
  // incumbent's cheaper metrics. No imported certificate supplies authority.
  return{...maintenanceFallback,metrics:{...checked.metrics,...(checked.metrics?.usage?{usage:{...checked.metrics.usage,selected:maintenanceFallback.metrics.usage?.selected??null}}:{}),firstCertified:result.metrics?.firstCertified,admissionAttempts:result.metrics?.admissionAttempts,admissionFailures:result.metrics?.admissionFailures,certifiedHorizon:maintenanceFallback.continuation.length,certifiedFallback:{selected:true,locks:maintenanceFallback.continuation.length}},evidence:{...maintenanceFallback.evidence,budgetExhausted:checked.status==='budget-exhausted'||Boolean(result.evidence?.budgetExhausted),searchIncomplete:true}};
 }
 return supportPreference(scoringPreference(checked));
 function scoringPreference(checked){
  // This separate finite goal is considered only AFTER the ordinary incumbent
  // has passed final admission. Optional work cannot starve or revoke it.
  if(!checked?.target||options.openingPhase!==false||options.disableLeftScoringFoundation||options.disableConstruction||options.commitment||options.constructionPrevious||checked.evidence?.opening||checked.evidence?.construction||checked.evidence?.commitmentRetained||!options.resourceContext)return checked;
  const goal=cycleResources(checked.continuation||[]),first=checked.continuation?.[0];
  if(goal.tsds||goal.quads||goal.centerPreparations||goal.centerCompletions||goal.leftFoundations||goal.outstandingPocket!==1||first?.event.type!=='I'||first.structuralEvidence?.allocation!=='quad-preparation'||!Y.scoringEligibility(raw,options))return checked;
  const scoringSignature=r=>JSON.stringify([signature(r),options.resourceContext,options.patternHistory]);
  const incumbent=clone(checked),bound=scoringSignature(incumbent),limit=options.maxNodes??45000,optionalStarted=now();let used=checked.metrics?.nodes||0;
  const telemetry={attempted:true,selected:false,nodes:0,reason:'not-certified',scope:'exact-visible-I-Left-Z-Right-TSD; prospective preparation only; existing cleanup and retained goals protected',incumbentPrefix:clone(incumbent.continuation),incumbentAdmission:{evidence:clone(incumbent.evidence),assessment:clone(incumbent.assessment)}};
  const finish=result=>{telemetry.nodes=used-(checked.metrics?.nodes||0);return{...result,metrics:{...result.metrics,nodes:used,elapsedMs:(checked.metrics?.elapsedMs||0)+Math.max(0,now()-optionalStarted),leftScoringFoundation:telemetry}};};
  const fallback=()=>scoringSignature(incumbent)===bound?finish(incumbent):{...checked,target:null,witness:[],continuation:[],status:'invalid-input',reason:'The public request changed during optional scoring verification.',metrics:{...checked.metrics,nodes:used,certifiedHorizon:0}};
  if(now()>=deadline||used>=limit){telemetry.reason='shared-budget';return fallback();}
  const found=Y.scoringSearch(observe(raw),{...options,deadline,now,maxNodes:Math.max(0,limit-used)});used+=found.visited;telemetry.reason=found.reason;
  if(!found.candidate||now()>=deadline||used>=limit)return fallback();
  found.candidate.resourceContext=clone(options.resourceContext);
  const tracker={nodes:0},candidate=constructionAdvice(observe(raw),found.candidate,deadline,now,Math.max(0,limit-used),tracker,options);used+=tracker.nodes;
  if(!candidate||now()>=deadline||used>=limit){telemetry.reason='construction-not-certified';return fallback();}
  const a=candidate.assessment,b=checked.assessment;
  if(a.maxHeight>b.maxHeight||a.sealed>b.sealed||a.leftSealed>b.leftSealed){telemetry.reason='endpoint-quality-regression';return fallback();}
  candidate.metrics={...incumbent.metrics,...candidate.metrics,nodes:used,stageProofLocks:candidate.continuation.length};
  const admitted=finalCheck(candidate);used=admitted.metrics?.nodes??used;
  if(!admitted.target||now()>=deadline||used>limit){telemetry.reason=admitted.evidence?.resourceObligations?.reason||'final-admission-unavailable';return fallback();}
  telemetry.selected=true;telemetry.reason='actual-scoring-row-foundation';telemetry.scoreLock=3;telemetry.foundationCells=clone(candidate.continuation[0].structuralEvidence.scoringFoundation.cells);return finish(admitted);
 }
 function supportPreference(checked){
  // Optional work starts only after the unchanged ordinary result is fully
  // admitted. It cannot consume the incumbent's proof budget or revoke it.
  if(!checked?.target||options.openingPhase!==false||options.allowHold===false||options.disableLeftSupport||options.disableConstruction||options.commitment||options.constructionPrevious||checked.evidence?.opening||checked.evidence?.construction||checked.evidence?.commitmentRetained)return checked;
  const goal=cycleResources(checked.continuation||[]),first=checked.continuation?.[0];
  if(goal.tsds||goal.quads||goal.centerPreparations||goal.centerCompletions||goal.leftFoundations||goal.outstandingPocket!==1||first?.event.type!=='I'||first.structuralEvidence?.allocation!=='quad-preparation'||!options.resourceContext||resourceSummary(raw,options).coverage.status!=='complete'||!Y.supportEligibility(raw))return checked;
  const incumbent=clone(checked),bound=signature(incumbent),limit=options.maxNodes??45000,optionalStarted=now();let used=checked.metrics?.nodes||0;
  const telemetry={attempted:true,selected:false,nodes:0,scope:'finite-open-Left-support-with-actual-visible-Right-I-replacement',incumbentRightCells:clone(first.event.cells),incumbentFirst:{witness:first.witness.slice(),event:clone(first.event)}};
  const finish=result=>{telemetry.nodes=used-(checked.metrics?.nodes||0);return{...result,metrics:{...result.metrics,nodes:used,elapsedMs:(checked.metrics?.elapsedMs||0)+Math.max(0,now()-optionalStarted),leftSupportPreference:telemetry}};};
  const fallback=()=>signature(incumbent)===bound?finish(incumbent):{...checked,target:null,witness:[],continuation:[],status:'invalid-input',reason:'The public request changed during optional support verification.',metrics:{...checked.metrics,nodes:used,certifiedHorizon:0}};
  if(now()>=deadline||used>=limit)return fallback();
  const found=Y.supportSearch(observe(raw),{deadline,now,maxNodes:Math.max(0,limit-used)});used+=found.visited;
  if(!found.candidate||now()>=deadline||used>=limit)return fallback();
  found.candidate.resourceContext=clone(options.resourceContext);
  const tracker={nodes:0},candidate=constructionAdvice(observe(raw),found.candidate,deadline,now,Math.max(0,limit-used),tracker,options);used+=tracker.nodes;
  const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));
  if(!candidate||!sameCells(candidate.continuation.at(-1).event.cells,first.event.cells)||now()>=deadline||used>=limit)return fallback();
  candidate.metrics={...incumbent.metrics,...candidate.metrics,nodes:used,stageProofLocks:candidate.continuation.length};
  const admitted=finalCheck(candidate);used=admitted.metrics?.nodes??used;
  if(!admitted.target||now()>=deadline||used>limit)return fallback();
  telemetry.selected=true;telemetry.locks=admitted.continuation.length;return finish(admitted);
 }
 function finalCheck(result,nodeLimit=options.maxNodes??45000){
 if(!result?.target)return result;
 const pendingLSelected=pendingLSelections.has(result);
 const finalLimit=Math.min(options.maxNodes??45000,nodeLimit);
 if(!result.evidence?.opening){
  const resource=checkedResourceEndpoint(raw,result.continuation||[],constructionPolicyOptions(result,{...options,deadline,maxNodes:Math.max(0,finalLimit-(result.metrics?.nodes||0))}));
  result={...result,metrics:{...result.metrics,nodes:(result.metrics?.nodes||0)+(resource.visited||0),resourceProofNodes:resource.visited||0}};
  if(resource.repair?.waitingStage&&!pendingLSelected)return{...result,status:'no-supported-continuation-found',target:null,witness:[],continuation:[],metrics:{...result.metrics,certifiedHorizon:0},reason:'A safe pending-L wait was not selected by a completed same-horizon comparison.'};
  if(!resource.valid){
   for(const name of ['sourceConstruction','earlyCapFallback','levelBaseReentry','tieExtension'])if(result.metrics[name])result.metrics[name]={...result.metrics[name],selected:false};
   if(result.metrics.usage?.scope==='maintenance')result.metrics.usage={...result.metrics.usage,selected:null,families:Object.fromEntries(Object.entries(result.metrics.usage.families).map(([name,family])=>[name,'selected'in family?{...family,selected:0}:family]))};
   return{...result,status:'no-supported-continuation-found',metrics:{...result.metrics,certifiedHorizon:0},target:null,witness:[],continuation:[],reason:resource.reason==='unresolved-covered-cells'?'No supported restoration plan for the actual newly covered cells was verified.':'No ordinary-midgame route preserving the observed T, Z and Center obligations was verified.',evidence:{...result.evidence,...(resource.coveredRepair?{coveredRepair:resource.coveredRepair}:{}),resourceObligations:{status:'rejected',reason:resource.reason}}};
  }
  result={...result,reason:result.reason+(resource.delayedDPlans.length?' A public Center completion followed by J Left has been checked for the D surface.':'')+(resource.repair?.waitingStage?' The exact Center L target remains pending; the visible intervening pieces have a checked waiting route. L arrival is not yet established.':''),evidence:{...result.evidence,pendingLStage:pendingLProof(resource.repair),resourceObligations:{status:'checked',binding:resource.resource.originKey,delayedDPlans:resource.delayedDPlans,extraZ:resource.resource.extraZ,pendingCenter:resource.resource.pendingCenter,hangingS:resource.resource.hangingS,unclassifiedS:resource.resource.unclassifiedS,hangingL:resource.resource.hangingL}}};
 }
 if(!result.evidence?.opening){
  const repair=checkedCoveredRepair(raw,result.continuation||[],{...options,deadline},result.evidence?.coveredRepairPlan);
  if(!repair)return{...result,status:'no-supported-continuation-found',target:null,witness:[],continuation:[],metrics:{...result.metrics,certifiedHorizon:0},reason:'No supported restoration plan for the actual newly covered cells was verified.',evidence:{...result.evidence,coveredRepair:{status:'unresolved-covered-cells'}}};
  result={...result,continuation:repair.steps,evidence:{...result.evidence,coveredRepair:repair.proof,coveredRepairPlan:result.evidence?.construction?null:repair.plan}};
 }
 const state=observe(raw),scoring=Boolean(result.evidence?.opening?.scoringPlan),replayUnits=scoring?(result.continuation||[]).reduce((n,p)=>n+p.witness.length,0):0,used=result.metrics?.nodes||0,limit=finalLimit;
 const canCheck=!scoring||now()<deadline&&used+replayUnits<=limit;
 const check=canCheck?A.prefix(state,result.continuation||[],{notches:H.resolve(state,options.patternHistory),deadline,now,maxNodes:Math.max(0,limit-used-replayUnits)}):{reachable:null,visited:0,status:'unknown-access-budget'};
 const finalMetrics={...result.metrics,certifiedHorizon:0,nodes:used+(canCheck?replayUnits:0)+(check?.visited||0)};
 if(check?.reachable===true&&(!scoring||now()<deadline&&finalMetrics.nodes<=limit))return{...result,evidence:{...result.evidence,gapAccess:check},metrics:{...finalMetrics,certifiedHorizon:result.continuation.length}};
 // Failed experimental final validation cannot erase the unchanged ordinary
 // decision already proved in this exact invocation. Never trust copied flags.
 const checkedFallback=sameRetained()?retainedFallback:sameOrdinary()?ordinaryFallback:null;
 if(scoring&&checkedFallback){checkedFallback.metrics={...checkedFallback.metrics,nodes:finalMetrics.nodes,elapsedMs:finalMetrics.elapsedMs,sourceScoring:{...finalMetrics.sourceScoring,selected:null,finalValidationFallback:true}};return checkedFallback;}
 if(finalMetrics.sourceConstruction)finalMetrics.sourceConstruction.selected=false;
 if(finalMetrics.usage?.scope==='opening'&&finalMetrics.usage.selected?.path==='verified-source-pattern'){finalMetrics.usage.selected=null;if(finalMetrics.usage.families.sourcePattern)finalMetrics.usage.families.sourcePattern.selected=0;}
 if(finalMetrics.earlyCapFallback)finalMetrics.earlyCapFallback.selected=false;
 if(finalMetrics.levelBaseReentry)finalMetrics.levelBaseReentry.selected=false;
 if(finalMetrics.tieExtension)finalMetrics.tieExtension.selected=false;
 if(finalMetrics.usage?.scope==='maintenance'){finalMetrics.usage.selected=null;for(const family of Object.values(finalMetrics.usage.families))if('selected'in family)family.selected=0;}
 return{...result,metrics:finalMetrics,status:check?.reachable===false?'no-supported-continuation-found':'budget-exhausted',target:null,witness:[],continuation:[],reason:'No move with checked access to its newly covered construction cells was found. A different repair may exist.',evidence:{gapAccess:check}};
}
}
// Keep a committed target through an exactly followed input, including HOLD.
// The entire remaining prefix is replayed from the new observation, so a newly
// revealed piece cannot silently preserve an obsolete proof.
function advance(raw,previous,action,options={}){
 if(previous?.recommendation?.kind==='risky'||previous?.status==='recommended-risky-placement')return null;
 options={...options,[pendingLHint]:previous?.evidence?.pendingLStage};
 if(previous?.evidence?.opening?.scoringPlan)return openingModule().retainScoring(raw,previous,options,action);
 if(previous?.evidence?.opening?.sourcePlan)return openingModule().retainSource(raw,previous,options,action);
 if(previous?.evidence?.opening)return null;
 if(previous?.evidence?.cycleDebt>0)return null;
 if(!previous?.target||action==='HD'||previous.witness?.[0]!==action)return null;
 let state;try{state=observe(raw);}catch{return null;}
 if(R.validate(state).length||(state.bag&&B.validate(state.bag).length))return null;
 const witness=previous.witness.slice(1);if(!witness.length)return null;
 if(previous.evidence?.construction){
  // Recreate every shared construction proof before assigning its scope.
  // A copied kind/progress flag cannot exempt ordinary locks during movement.
  const now=options.now||(()=>Date.now()),deadline=options.deadline??now()+150,limit=options.maxNodes??12000,tracker={nodes:0};
  const refreshed=constructionAdvice(state,previous.evidence.construction,deadline,now,limit,tracker,options);
  if(!refreshed||JSON.stringify(refreshed.witness)!==JSON.stringify(witness)||JSON.stringify(refreshed.continuation.map(p=>p.event))!==JSON.stringify(previous.continuation.map(p=>p.event)))return null;
  const bounds={...options,now,deadline,maxNodes:Math.max(0,limit-tracker.nodes)},resources=checkedResourceEndpoint(state,refreshed.continuation,constructionPolicyOptions(refreshed,bounds));tracker.nodes+=resources.visited||0;if(!resources.valid)return null;
  const access=A.prefix(state,refreshed.continuation,{...bounds,notches:H.resolve(state,options.patternHistory),maxNodes:Math.max(0,limit-tracker.nodes)});tracker.nodes+=access.visited;
  if(access.reachable!==true||['left-support','left-scoring-foundation'].includes(previous.evidence.construction.kind)&&(now()>=deadline||tracker.nodes>limit))return null;
  return{...refreshed,retained:true,metrics:{...refreshed.metrics,certifiedHorizon:refreshed.continuation.length,revalidationNodes:tracker.nodes},evidence:{...refreshed.evidence,resourceObligations:{status:'checked',binding:resourceBinding(state,options),delayedDPlans:resources.delayedDPlans}}};
 }
 const steps=previous.continuation.map((step,i)=>({...step,witness:i?step.witness:witness,hold:i?step.hold:witness.includes('HOLD'),holdCount:i?holdCount(step):witness.filter(a=>a==='HOLD').length}));
 let current=extendForced(state),notches=H.resolve(state,options.patternHistory);if(notches.status==='invalid-history'||notches.status==='broken')return null;for(const step of steps){const replay=R.replay(current,step.witness);
  if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||!ordinaryRightEligible(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;
  const check=S.advanceNotches(current.board,{event:replay.events[0],state:replay.state},notches);if(!check.valid)return null;notches=check.pattern;
  current=replay.state;
 }
 const bounds={...options,maxNodes:options.maxNodes??12000,deadline:options.deadline??Date.now()+150},resources=checkedResourceEndpoint(state,steps,bounds);if(!resources.valid)return null;
 if(!repairedPrefix(state,steps))return null;
 const access=A.prefix(state,steps,{...bounds,maxNodes:Math.max(0,bounds.maxNodes-resources.visited),notches:H.resolve(state,options.patternHistory)});if(access.reachable!==true)return null;
 const repair=checkedCoveredRepair(state,steps,options,previous.evidence?.coveredRepairPlan);if(!repair)return null;
 return{...previous,revision:state.revision,context:context(state),witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,continuation:repair.steps,
  ...pendingLPresentation(steps,previous.assessment,previous.evidence?.construction,resources.repair,resources.delayedDPlans),retained:true,metrics:{...previous.metrics,certifiedHorizon:steps.length,revalidationNodes:resources.visited+access.visited},
  evidence:{...previous.evidence,pendingLSelection:null,coveredRepair:repair.proof,coveredRepairPlan:repair.plan,pendingLStage:pendingLProof(resources.repair),knownPieceHorizon:state.queue.length+1,resourceObligations:{status:'checked',binding:resourceBinding(state,options),delayedDPlans:resources.delayedDPlans}}};
}
function revalidate(raw,previous,options={}){
 if(previous?.recommendation?.kind==='risky'||previous?.status==='recommended-risky-placement')return null;
 options={...options,[pendingLHint]:previous?.evidence?.pendingLStage};
 const now=options.now||(()=>Date.now());options={...options,deadline:options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs),now};
 if(previous?.evidence?.opening?.scoringPlan)return openingModule().retainScoring(raw,previous,options);
 if(previous?.evidence?.opening?.sourcePlan)return openingModule().retainSource(raw,previous,options);
 if(previous?.evidence?.opening)return null;
 let s;try{s=observe(raw);}catch{return null;}if(previous?.evidence?.cycleDebt>0||previous?.continuation?.some(p=>!S.canonicalClear(p.event)))return null;if(!previous?.target||context(s)!==previous.context||R.validate(s).length)return null;
 if(previous.evidence?.resourceObligations?.binding&&previous.evidence.resourceObligations.binding!==resourceBinding(s,options))return null;

 if(previous.evidence?.construction){
  const tracker={nodes:0},refreshed=constructionAdvice(s,previous.evidence.construction,options.deadline,now,options.maxNodes??8000,tracker,options);if(options.budgetTracker)options.budgetTracker.nodes+=tracker.nodes;
  if(!refreshed||JSON.stringify(refreshed.continuation.map(p=>p.event))!==JSON.stringify(previous.continuation.map(p=>p.event)))return null;
  const resource=checkedResourceEndpoint(s,refreshed.continuation,constructionPolicyOptions(refreshed,{...options,maxNodes:Math.max(0,(options.maxNodes??8000)-tracker.nodes)}));tracker.nodes+=resource.visited||0;if(!resource.valid)return null;
  const access=A.prefix(s,refreshed.continuation,{...options,notches:H.resolve(s,options.patternHistory),maxNodes:Math.max(0,(options.maxNodes??8000)-tracker.nodes)});if(options.budgetTracker)options.budgetTracker.nodes+=access.visited;
  if(['left-support','left-scoring-foundation'].includes(previous.evidence.construction.kind)&&(now()>=options.deadline||tracker.nodes+access.visited>(options.maxNodes??8000)))return null;
  return access.reachable===true?{...refreshed,retained:true,metrics:{...refreshed.metrics,certifiedHorizon:refreshed.continuation.length,nodes:tracker.nodes+access.visited,revalidationNodes:tracker.nodes,gapAccessNodes:access.visited}}:null;
 }

 const enumeration=R.placements(extendForced(s),{maxNodes:options.maxNodes??8000,deadline:options.deadline,now:options.now});
 if(options.budgetTracker)options.budgetTracker.nodes+=enumeration.visited;
 const p=enumeration.placements.find(p=>S.canonicalClear(p.event)&&holdCount(p)===holdCount(previous)&&JSON.stringify(p.target)===JSON.stringify(previous.target)&&p.event.spin===previous.continuation?.[0]?.event.spin&&p.event.lines===previous.continuation?.[0]?.event.lines);
 if(!p)return null;
 const continuation=[{...previous.continuation[0],target:p.target,hold:p.hold,holdCount:holdCount(p),witness:p.witness,event:p.event},...previous.continuation.slice(1)];
 let current=extendForced(s),notches=H.resolve(s,options.patternHistory);if(notches.status==='invalid-history'||notches.status==='broken')return null;for(const step of continuation){const replay=R.replay(current,step.witness);if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||!ordinaryRightEligible(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;const check=S.advanceNotches(current.board,{event:replay.events[0],state:replay.state},notches);if(!check.valid)return null;notches=check.pattern;current=replay.state;}
 const resources=checkedResourceEndpoint(s,continuation,{...options,maxNodes:Math.max(0,(options.maxNodes??8000)-enumeration.visited)});if(!resources.valid)return null;
 if(!repairedPrefix(s,continuation))return null;
 const access=A.prefix(s,continuation,{...options,notches:H.resolve(s,options.patternHistory),maxNodes:Math.max(0,(options.maxNodes??8000)-enumeration.visited-resources.visited)});if(options.budgetTracker)options.budgetTracker.nodes+=access.visited;if(access.reachable!==true)return null;
 const repair=checkedCoveredRepair(s,continuation,options,previous.evidence?.coveredRepairPlan);if(!repair)return null;
 return{...previous,revision:s.revision,hold:p.hold,holdCount:holdCount(p),witness:p.witness,continuation:repair.steps,evidence:{...previous.evidence,pendingLSelection:null,coveredRepair:repair.proof,coveredRepairPlan:repair.plan,pendingLStage:pendingLProof(resources.repair),resourceObligations:{status:'checked',binding:resourceBinding(s,options),delayedDPlans:resources.delayedDPlans}},...pendingLPresentation(continuation,previous.assessment,previous.evidence?.construction,resources.repair,resources.delayedDPlans),metrics:{...previous.metrics,certifiedHorizon:continuation.length,nodes:enumeration.visited+resources.visited+access.visited,revalidationNodes:enumeration.visited+resources.visited,gapAccessNodes:access.visited},retained:true};
}
// Shared UI/simulator transport helper. This bounded copy is only a routing
// candidate: no resource identity, historical status or certificate is trusted.
function captureHandoffRecovery(raw,advice,resourceContext){
 try{
  if(advice?.evidence?.openingHandoff?.recovery!=='shared-after-legacy-budget-miss'||!Array.isArray(advice.continuation)||advice.continuation.length!==2)return null;
  // Capture only before the real handoff mark; a mid-piece worker reply must
  // not overwrite the original observation/history binding with a later one.
  if(resourceContext!=null&&resourceContext.handoffAtAction!==null)return null;
  const observation=observe(raw);if(observation.queue.length>6)return null;
  const value={observation,advice,resourceContext},seen=new Set();let nodes=0,characters=0;
  const bounded=(v,depth)=>{
   if(++nodes>50000||depth>64)throw Error('Recovery candidate exceeds structural bounds');
   if(typeof v==='string'){characters+=v.length;if(characters>1048576)throw Error('Recovery candidate exceeds text bounds');return;}
   if(v===null||v===undefined||typeof v==='boolean'||typeof v==='number')return;
   if(typeof v!=='object'||seen.has(v)||Array.isArray(v)&&v.length>4096)throw Error('Invalid recovery candidate');
   seen.add(v);for(const [key,item]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid recovery property');characters+=key.length;bounded(item,depth+1);}seen.delete(v);
  };
  bounded(value,0);const encoded=JSON.stringify(value);return encoded.length<=1048576?JSON.parse(encoded):null;
 }catch{return null;}
}
// A recovered handoff may supply a candidate, never a trusted goal flag. Only
// one immediate payment of the same replay-known Hanging S is retained here.
// All work belongs to the next decide request; ordinary goal/rank policy is unchanged.
function retainHandoffRecovery(raw,options,work){
 const tracker=options.budgetTracker,limit=options.maxNodes,now=options.now,deadline=options.deadline,start=tracker.nodes;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),left=()=>Math.max(0,limit-tracker.nodes);
 const fail=reason=>{work.reason=reason;return null;};
 const spend=n=>{if(now()>=deadline||n>left())return false;tracker.nodes+=n;return true;};
 try{
  if(now()>=deadline||left()<=0)return fail('shared-budget');
  const candidate=options.handoffRecovery,advice=candidate?.advice,steps=advice?.continuation;
  if(options.openingPhase!==false||advice?.evidence?.openingHandoff?.recovery!=='shared-after-legacy-budget-miss'||advice.evidence.opening||advice.evidence.construction||!Array.isArray(steps)||steps.length!==2)return fail('candidate-shape');
  if(!same(advice.witness,steps[0].witness)||!same(advice.target,steps[0].target)||advice.hold!==steps[0].hold||holdCount(advice)!==holdCount(steps[0]))return fail('candidate-shape');
  for(const step of steps)if(!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||step.witness.slice(0,-1).includes('HD')||!same(step.target,step.event?.target)||step.hold!==step.witness.includes('HOLD')||holdCount(step)!==step.witness.filter(a=>a==='HOLD').length)return fail('candidate-shape');
  const pay=steps[1];if(pay.event?.type!=='S'||pay.event.lines!==0||!Array.isArray(pay.event.cells)||pay.event.cells.length!==4||!pay.event.cells.every(([x])=>x>=0&&x<4))return fail('not-immediate-left-S');
  const origin=observe(candidate.observation),state=observe(raw);
  if(R.validate(origin).length||R.validate(state).length||origin.queue.length>6||state.queue.length>6||!origin.active||!state.active||origin.topOut||state.topOut||(origin.bag&&B.validate(origin.bag).length)||(state.bag&&B.validate(state.bag).length)||advice.context!==context(origin))return fail('observation');
  const priorContext=candidate.resourceContext,currentContext=options.resourceContext;
  const priorSummary=resourceSummary(origin,{resourceContext:priorContext}),summary=resourceSummary(state,options);
  if(priorSummary.coverage?.status!=='complete'||summary.coverage?.status!=='complete'||!priorContext||!currentContext)return fail('resource-history');
  // Follow an actual connected one-lock history, not necessarily the same
  // movement route. Replaying its exact event/result below permits a legal
  // detour, but never another HD, post-lock movement or guessed reveals.
  const actualSteps=currentContext.steps.slice(priorContext.steps.length);
  if(priorContext.handoffAtAction!==null||currentContext.handoffAtAction!==priorContext.steps.length||!same(priorContext.origin,currentContext.origin)||priorContext.fresh!==currentContext.fresh||!actualSteps.length||actualSteps.length>256||actualSteps.at(-1).action!=='HD'||actualSteps.slice(0,-1).some(s=>s.action==='HD')||!same(currentContext.steps.slice(0,priorContext.steps.length),priorContext.steps)||summary.locks!==priorSummary.locks+1||summary.milestones?.maintenanceHandoff?.at!==priorSummary.locks)return fail('history-not-connected');
  if(priorSummary.openingAllocation?.status!=='verified-first-tsd'||priorSummary.openingAllocation.requiredNonRightZ!==0||!priorSummary.extraZ?.baseline||!['available','used'].includes(priorSummary.extraZ.status)||!openingModule().handoffGeometry(origin))return fail('source-eligibility');
  const known=priorSummary.hangingS?.evidence?.[0];
  const live=(view,id)=>[view.instances?.active,view.instances?.hold,...(view.instances?.queue||[])].find(p=>p?.id===id&&p.type==='S');
  if(priorSummary.hangingS?.status!=='hanging'||priorSummary.hangingS.evidence.length!==1||priorSummary.hangingS.unclassified?.length||!Number.isInteger(known?.sId)||known.sId<=0||!Number.isInteger(known.bag)||known.bag<0||!live(priorSummary,known.sId)||summary.hangingS?.status!=='hanging'||summary.hangingS.unclassified?.length||!summary.hangingS.evidence.some(s=>s.sId===known.sId&&s.bag===known.bag&&s.lId===known.lId)||!live(summary,known.sId))return fail('known-S-identity');
  if(advice.evidence.resourceObligations?.status!=='checked'||advice.evidence.resourceObligations.binding!==resourceBinding(origin,{resourceContext:priorContext}))return fail('origin-resource-binding');
  const rootPattern=H.resolve(origin,null),currentPattern=H.resolve(state,options.patternHistory);
  if(rootPattern.status!=='established'||currentPattern.status!=='established')return fail('pattern-history');
  if(!spend(actualSteps.length+steps.reduce((n,p)=>n+p.witness.length,0)))return fail('shared-budget');
  // Reconstruct ordinary structural and resource policy, rather than accepting
  // serialized cycleDebt, pair or gapAccess claims from the old advice.
  const makeInitial=(s,view,notches)=>{const a=assess(s.board);a.state=extendForced(s);a.notches=notches;a.resources=M.start(a.state,view);return a;};
  const initial=makeInitial(origin,priorSummary,rootPattern);let node=null,first=null;
  for(const step of steps){const before=node?.state??initial.state,r=R.replay(before,step.witness);if(!r.valid||r.events.length!==1||!same(r.events[0],step.event)||!S.canonicalClear(r.events[0])||step.resultContext!==context(r.state))return fail('origin-prefix');
   node=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.hold,holdCount:holdCount(step),...policyWitnesses(before)},node,initial,0);if(!first)first=node;
   if(!node.notchValid||node.cycleDebt||node.assessment.maxHeight>=20)return fail('origin-policy');
  }
  if(!certifiedCavities(node)||!node.assessment.regionalSupport)return fail('origin-policy');
  let actual=origin;for(const step of actualSteps){const next=R.move(actual,step.action);if(next===actual)return fail('actual-lock');actual={...next,queue:[...next.queue,...step.revealed]};for(const piece of step.revealed)if(actual.bag)actual={...actual,bag:B.consume(actual.bag,piece)};}
  if(!same(actual.lastEvent,candidate.actualEvent)||!same(first.path[0].event,actual.lastEvent)||!sameConstructionResult(first.state,state)||context(actual)!==context(state)||!same(actual.active,state.active)||actual.streamCursor!==state.streamCursor)return fail('actual-lock');
  const phase=first.notches;if(phase.status!==currentPattern.status||phase.anchorRow!==currentPattern.anchorRow||!same(phase.protectedRows,currentPattern.protectedRows))return fail('pattern-history');
  const priorOptions={...options,resourceContext:priorContext,patternHistory:null,maxNodes:left()};
  const oldResource=checkedResourceEndpoint(origin,steps,priorOptions);if(!oldResource.valid)return fail('origin-resource-proof');
  const oldAccess=A.prefix(origin,steps,{now,deadline,maxNodes:left(),notches:rootPattern});tracker.nodes+=oldAccess.visited;
  if(oldAccess.reachable!==true)return fail('origin-access');
  if(now()>=deadline||left()<=0)return fail('shared-budget');
  const actualInitial=makeInitial(state,summary,currentPattern),supply=actualInitial.resources;
  let active=supply.active,held=supply.hold,queue=supply.queue.slice();for(const action of pay.witness)if(action==='HOLD'){if(held){const swap=active;active=held;held=swap;}else{held=active;active=queue.shift();}}
  if(active?.id!==known.sId||active?.bag!==known.bag)return fail('different-S-identity');
  if(!spend(pay.witness.length))return fail('shared-budget');
  const replay=R.replay(actualInitial.state,pay.witness);if(!replay.valid||replay.events.length!==1||!same(replay.events[0],pay.event))return fail('current-suffix');
  const suffixNode=nodeFor({state:replay.state,event:replay.events[0],target:replay.events[0].target,witness:pay.witness,hold:pay.hold,holdCount:holdCount(pay),...policyWitnesses(actualInitial.state)},null,actualInitial,0);
  if(!suffixNode.notchValid||suffixNode.cycleDebt||!certifiedCavities(suffixNode)||!suffixNode.assessment.regionalSupport||suffixNode.assessment.maxHeight>=20||suffixNode.resources.hangingS.some(s=>s.id===known.sId)||suffixNode.resources.unclassifiedS.some(s=>s.sId===known.sId))return fail('current-payment-policy');
  const step={...suffixNode.path[0],resultContext:context(replay.state)};delete step.state;
  const evidence={strategy:'canonical-right-ST',cycleDebt:0,resourceObligations:{status:'checked',binding:resourceBinding(state,options)},handoffRecovery:{status:'observed-S-payment-candidate',sId:known.sId,bag:known.bag}};
  const next={status:'recommended-with-verified-prefix',revision:state.revision,context:context(state),target:step.target,witness:step.witness,hold:step.hold,holdCount:holdCount(step),continuation:[step],metrics:{nodes:0,depth:1,completeDepth:0,certifiedHorizon:0},assessment:suffixNode.assessment,evidence,...advicePresentation([step],suffixNode.assessment)};
  const checked=revalidate(state,next,{...options,maxNodes:left()});
  if(!checked||now()>=deadline||tracker.nodes>limit)return fail('current-revalidation');
  checked.evidence.handoffRecovery.status='observed-S-payment-retained';work.retained=true;work.reason='same-observed-S-paid';return checked;
 }catch{return fail('invalid-candidate');}
 finally{work.nodes=tracker.nodes-start;}
}
function openingModule(){return typeof module==='object'&&module.exports?require('./st-opening.js'):globalThis.STOpening;}
function startOpeningSession(raw,options){return openingModule().startSession(raw,options);}
function updateOpeningSession(session,before,after,event){return openingModule().updateSession(session,before,after,event);}
function acceptOpeningResult(session,result){return openingModule().acceptResult(session,result);}
// Risk is a separate one-lock recommendation, never a weaker supported proof.
// The collector is private to a decide request and only holds already enumerated
// placements at its exact public root. Nested planning cannot consume a risky
// result as a certificate. No supported-search budget is reserved or enlarged.
const riskRootCollector=Symbol('risk-root-collector');
function classifySupported(result){
 if(!result?.target||result.recommendation?.kind==='risky')return result;
 return{...result,recommendation:{kind:'supported',hazards:[],claim:'A checked finite continuation, not a guarantee of continued survival.'}};
}
function riskyDAdmission(before,p,resource,options){
 // The current silhouette is observable even if its creator is unknown. Only
 // this explicit risk channel may continue it without the strict J certificate.
 if(!L.isD(p.state.board))return{valid:true,visited:0,hazards:[]};
 const checked=dPatternExitAdmission(before,p,{...options,resource});
 if(checked.valid)return{...checked,hazards:[]};
 const after=p.state,immediate=L.immediateJStarts(after).length>0;
 const publicJ=after.active?.type==='J'||after.hold==='J'||after.queue.includes('J');
 const availability=!publicJ?'absent-from-public-supply':!immediate?'visible-but-delayed':checked.complete===false?'immediate-exit-proof-unfinished':'immediate-exit-not-established';
 const detail=!publicJ?'No supported immediate J exit is established for the Left D pattern, and no J is in the current public active, HOLD or preview; its arrival is unknown.':!immediate?'A J is known later in the public sequence, but cannot be used before another lock; the Left D pattern must wait.':checked.complete===false?'A J is immediately accessible, but its legal, resource-compatible D exit proof was unfinished within budget.':'A J is immediately accessible, but a usable, resource-compatible D exit was not established by the checked continuations.';
 const hazards=[{code:'D-J-exit-unresolved',availability,proofStatus:checked.complete===false?'unfinished':'not-established',detail,downside:'The D surface may become harder to accommodate or inaccessible before the needed J can repair it.'}];
 const next=M.step(before,p,resource),geometry=S.geometry(after.board,{notches:options.notches});
 if(next.pendingCenter.some(q=>q.alternatives.some(a=>a.piece==='J')))hazards.push({code:'D-J-competes-with-Center',detail:'A J is also recorded as a Center partner; it is not a free Left repair.',downside:'Spending the same J on Left can leave Center unfinished; a separate executable replacement is not promised.'});
 const cycle=geometry.right.cycle;
 if(cycle.prepareColumn!==null||cycle.cleanupColumns.length)hazards.push({code:'D-I-parking-competes-with-cleanup',detail:'Right has an observed I cleanup/preparation demand while Left waits for J.',downside:'Using I to park or reshape Left can delay Right cleanup; one I is not permission for both jobs.'});
 hazards.push({code:'D-waiting-space-unproved',detail:`Left reaches ${Math.max(...geometry.left.profile)} rows; no route for parking intervening pieces while waiting for J is certified.`,downside:'Visible pieces may exhaust the available space before the D exit becomes usable.'});
 return{...checked,valid:true,visited:checked.visited||0,hazards};
}
function riskyFallback(raw,supported,options,collector,comparison=null){
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??45000;
 const fallbackStarted=Date.now(),spent=supported.metrics?.nodes||0,telemetry={attempted:false,considered:0,nodes:0,source:'existing-root-enumeration',supportedStatus:supported.status,truncated:false,proofIncomplete:false,dProofNodes:0,rejections:{}};
 const finish=result=>{telemetry.elapsedMs=Math.max(0,Date.now()-fallbackStarted);return{...result,metrics:{...result.metrics,nodes:spent+telemetry.nodes,elapsedMs:collector.started===undefined?(supported.metrics?.elapsedMs||0)+telemetry.elapsedMs:Math.max(0,Date.now()-collector.started),riskFallback:telemetry}};};
 if(supported.target&&!comparison||!collector.placements?.length||now()>=deadline||spent>=limit)return finish(supported);
 let state;try{state=extendForced(observe(raw));}catch{return finish(supported);}
 if(R.validate(state).length||(state.bag&&B.validate(state.bag).length)||state.topOut||!state.active||options.openingPhase===true)return finish(supported);
 const summary=resourceSummary(observe(raw),options),notches=H.resolve(observe(raw),options.patternHistory);
 if(summary.coverage?.status==='invalid'||['invalid-history','broken'].includes(notches.status))return finish(supported);
 const resource=M.start(state,summary),beforeCavities=S.cavityFacts(state.board),initialDebt=summary.coveredRepair?.cells||[];
 const incomplete=supported.status==='budget-exhausted'||Boolean(supported.evidence?.searchIncomplete||supported.evidence?.budgetExhausted||supported.metrics?.proofScheduling?.unfinished||supported.metrics?.queries?.unfinished||!collector.complete);
 const candidates=[];telemetry.attempted=true;const reject=reason=>{telemetry.rejections[reason]=(telemetry.rejections[reason]||0)+1;};
 for(const p of collector.placements.slice(0,64)){
  const cost=p.witness.length;if(now()>=deadline||spent+telemetry.nodes+cost>limit){telemetry.truncated=true;break;}telemetry.nodes+=cost;telemetry.considered++;
  const replay=R.replay(state,p.witness);if(!replay.valid||replay.events.length!==1||JSON.stringify(replay.events[0])!==JSON.stringify(p.event)){reject('invalid-witness');continue;}
  const event=replay.events[0],nextState=replay.state;if(event.topOut||nextState.topOut||!S.canonicalClear(event)||!ordinaryRightEligible(event)){reject('hard-cycle-or-topout');continue;}
  const phase=S.advanceNotches(state.board,{state:nextState,event},notches);if(!phase.valid)continue;
  const next=M.step(state,{...p,state:nextState,event},resource);if(next.violations.length){reject('resource-permission');continue;}
  const facts=assess(nextState.board),afterCavities=S.cavityFacts(nextState.board);
  // Conservative prototype bounds, not source claims: reject sealed damage,
  // near-topout targets and large new repair burdens rather than risk every stop.
  const sealedDebt=S.cavityRepairDebt(beforeCavities,afterCavities,event);
  const created=A.newlyCovered(state.board,nextState.board,event,phase.pattern),debt=A.repairStep(state.board,nextState.board,event,initialDebt,phase.pattern);
  if(sealedDebt.length||facts.maxHeight>=19||created.length>4||debt.length>6){reject('conservative-structural-bound');continue;}
  const d=riskyDAdmission(state,{...p,state:nextState,event},resource,{...options,notches:phase.pattern,pendingD:summary.dPattern?.pending===true,maxNodes:Math.min(Math.max(0,4000-telemetry.dProofNodes),Math.max(0,limit-spent-telemetry.nodes)),now,deadline});telemetry.nodes+=d.visited||0;telemetry.dProofNodes+=d.visited||0;if(d.complete===false)telemetry.proofIncomplete=true;if(!d.valid){reject(d.reason||'D-exit-unproved');continue;}if(now()>=deadline||spent+telemetry.nodes>limit){telemetry.truncated=true;break;}
  if(comparison&&!(d.hazards||[]).some(h=>h.code==='D-J-exit-unresolved')){reject('no-unresolved-D-risk');continue;}
  const hazards=[...(d.hazards||[])];
  if(debt.length)hazards.push({code:'unresolved-covered-cells',cells:debt,detail:`${debt.length} covered cell(s) remain without a verified restoration plan.`,downside:'The needed repair pieces may be unavailable or the gaps may become inaccessible.'});
  const lost=next.pendingCenter.filter(p=>p.lost),live=next.pendingCenter.filter(p=>!p.lost);
  if(lost.length)hazards.push({code:'lost-center-target',detail:'An exact recorded Center partner target is no longer supported or reachable; its repair is unverified.',downside:'A later partner piece alone may not restore the lost target.'});
  if(live.length){const pieces=[...new Set(live.flatMap(p=>p.alternatives.map(a=>a.piece)))],supply=[next.active,next.hold,...next.queue].filter(Boolean),counts=Object.fromEntries(pieces.map(type=>[type,supply.filter(p=>p.type===type).length]));hazards.push({code:'pending-center-partner',pieces,publicCounts:counts,detail:`A Center ${pieces.join('/')} obligation remains; public supply has ${pieces.map(p=>counts[p]+' '+p).join(', ')} but no complete follow-up is certified.`,downside:'The partner may be inaccessible in time or compete with another region.'});}
  const unresolved=[...(next.unclassifiedS||[]),...(next.unclassifiedL||[])];
  if(unresolved.some(p=>p.invalidated||p.requiresAccommodation))hazards.push({code:'unresolved-observed-accommodation',detail:'An observed S/L accommodation remains unresolved or was invalidated; no replacement repair is proved.',downside:'Later pieces may be needed to repair this known obligation, not available as spare pieces.'});
  else if(unresolved.length)hazards.push({code:'allocation-history-unknown',detail:'Some earlier S/L allocations remain unclassified; no spare-piece allowance is granted.',downside:'Using later S/L pieces elsewhere may leave an unmet partner obligation.'});
  if(!facts.regionalSupport)hazards.push({code:'unsupported-stack-shape',detail:'The resulting regional stack is outside the checked continuation shapes.',downside:'Visible pieces may not fit while preserving the ST scoring channel.'});
  // A clean payment must not lose solely because it removes the last known
  // hazard. Uncertified continuation is disclosed without inventing damage.
  const paid=['complete','partial'].includes(summary.coverage?.status)?resource.pendingCenter.filter(o=>Number.isInteger(o.rootId)&&o.rootId>0&&!o.lost&&!next.pendingCenter.some(n=>n.rootId===o.rootId)&&o.alternatives.some(a=>a.piece===event.type&&a.cells.length===event.cells.length&&a.cells.every(([x,y])=>event.cells.some(([ex,ey])=>x===ex&&y===ey)))).map(o=>o.rootId):[];
  hazards.push({code:'continuation-unverified',detail:comparison?'Only this risky placement is verified; its continuation is not certified.':'Only this placement is verified; no supported continuation was certified in this bounded search.',downside:'Further play may require an awkward repair or an early stop.'});
  const score=[debt.length,next.pendingCenter.filter(p=>p.lost).length,afterCavities.sealed,facts.maxHeight,-paid.length,-event.lines,-facts.estimate,p.witness.length];
  candidates.push({p:{...p,state:nextState,event},hazards,facts,score,paid});
 }
 telemetry.truncated=telemetry.truncated||collector.placements.length>64;
 candidates.sort((a,b)=>{for(let i=0;i<a.score.length;i++)if(a.score[i]!==b.score[i])return a.score[i]-b.score[i];return 0;});
 const chosen=candidates[0];if(!chosen&&supported.target)return finish(supported);if(!chosen)return finish({...supported,reason:supported.reason+' No risky fallback passed the remaining-budget and conservative legality/resource/structure checks.'});
 const {p,hazards,facts,paid}=chosen,step={target:p.event.target,witness:p.witness.slice(),event:p.event,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length,resultContext:context(p.state)};
 const search={status:supported.status,incomplete:incomplete||telemetry.truncated||telemetry.proofIncomplete,saferAlternative:comparison?'supported-finite-alternative-ranked-lower':'not-certified-within-bounded-search',candidateLimit:64,...(comparison?{comparison}: {})};
 const region=p.event.cells.every(([x])=>x<4)?'Left':p.event.cells.every(([x])=>x>=4&&x<7)?'Center':p.event.cells.every(([x])=>x>=7)?'Right':'across regions';
 return finish({status:'recommended-risky-placement',revision:raw.revision,context:context(observe(raw)),target:step.target,witness:step.witness,hold:step.hold,holdCount:step.holdCount,continuation:[step],assessment:facts,
  reason:`Risky: ${holdPrompt(step)}Place ${p.event.type} in ${region}. ${hazards.map(h=>h.detail+' '+h.downside).join(' ')} ${comparison?`A supported finite alternative was found but holds this S instead. Placing S now reduces the public S-minus-L surplus from ${comparison.excessBefore} to ${comparison.excessAfter}, accepting the stated D risk. This is not proof that the supported alternative is worse over future play.`:'A safer move may exist; the search did not certify one.'}`,sources:[],
  recommendation:{kind:'risky',riskBasis:hazards.length===1&&hazards[0].code==='continuation-unverified'?'uncertified-follow-up-only':'identified-dependency',hazards,search,claim:'Legal current placement only; restoration, continued survival and future piece arrival are not proved.'},
  evidence:{strategy:comparison?'contextual-risk-allocation':'explicit-risk-fallback',...(comparison?{riskComparison:comparison}:{}),verifiedLocks:1,resourcePermissions:'unchanged',actualPartnerPayments:paid,risk:{hazards,search},claim:'No supported repair certificate is supplied.'},metrics:{...(comparison?{nodes:supported.metrics?.nodes||0,elapsedMs:supported.metrics?.elapsedMs||0,supportedSearch:clone(supported.metrics||{})}:supported.metrics),certifiedHorizon:0,legalHorizon:1}});
}

// Optional exact-public repair search. It only extends the already selected
// first placement, retaining one O instance until it actually repays covered
// cells. Seven locks/width four are engineering bounds, not source criteria.
function reservedPiecePlan(raw,incumbent,options,collector){
 if(!incumbent?.target||options.disableReservedPiecePlan||options.allowHold===false||options.openingPhase!==false||options.commitment||incumbent.evidence?.construction||incumbent.evidence?.opening)return incumbent;
 const s=extendForced(observe(raw)),summary=resourceSummary(raw,options),root=M.start(s,summary),pending=root.pendingCenter;
 const reserve=[root.active,root.hold].find(p=>p?.type==='O'),extraS=[root.active,root.hold,...root.queue].filter(p=>p?.type==='S');
 if(!reserve||pending.length!==1||pending[0].family!=='SL'||pending[0].lost||!extraS.length||!['complete','partial'].includes(summary.coverage.status)||!collector.placements?.length)return incumbent;
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,total=options.maxNodes??45000,spent=incumbent.metrics?.nodes||0,cap=Math.min(12000,Math.max(0,total-spent));
 let used=0,incomplete=false;const started=Date.now(),phase=H.resolve(raw,options.patternHistory),maxDepth=Math.min(7,1+s.queue.length+(s.hold?1:0));
 const telemetry={attempted:true,selected:false,reason:'no-complete-reserved-repair',nodeCap:cap,width:4,maxDepth,visited:0,rootId:pending[0].rootId,reservedId:reserve.id,scope:'same-first-placement; actual reserved-O repair and known-SL closure; public-only'};
 const finish=result=>({...result,metrics:{...result.metrics,nodes:spent+used,elapsedMs:(incumbent.metrics?.elapsedMs||0)+Math.max(0,Date.now()-started),reservedPiecePlan:{...telemetry,visited:used,incomplete}}});
 const bounded=()=>now()<deadline&&used<cap;
 if(!bounded()){telemetry.reason='shared-budget';return finish(incumbent);}
 const first=collector.placements.filter(p=>JSON.stringify(p.event)===JSON.stringify(incumbent.continuation?.[0]?.event)&&holdCount(p)===holdCount(incumbent));
 let layer=[{state:s,resource:root,notches:phase,path:[],debt:summary.coveredRepair?.cells||[],everDebt:false,paid:false,extraPaid:false,score:0}];
 for(let depth=0;depth<maxDepth&&layer.length&&bounded();depth++){
  const children=[];
  for(const n of layer){
   if(!bounded()){incomplete=true;break;}
   const canPay=n.everDebt&&n.debt.length&&!n.resource.pendingCenter.length&&n.extraPaid;
   const enumeration=depth===0?{placements:first,visited:0,complete:true}:R.placements(n.state,{allowHold:canPay,maxNodes:cap-used,deadline,now});used+=enumeration.visited;if(!enumeration.complete)incomplete=true;
   telemetry.depth=depth+1;
   for(const p of enumeration.placements){
    if(!bounded()){incomplete=true;break;}
    const piece=placedResource(n.resource,p.witness),event=p.event;
    if(!piece||!S.canonicalClear(event)||event.topOut||!ordinaryRightEligible(event)||assess(p.state.board).maxHeight>=19)continue;
    const nextPhase=S.advanceNotches(n.state.board,p,n.notches);if(!nextPhase.valid||S.transition(n.state,p,undefined,{notches:n.notches}).cycleViolations.length)continue;
    const resource=M.step(n.state,p,n.resource);if(resource.violations.length||resource.pendingCenter.some(q=>q.lost)||resource.unclassifiedS.some(q=>q.invalidated||q.requiresAccommodation))continue;
    const debt=A.repairStep(n.state.board,p.state.board,event,n.debt,nextPhase.pattern),created=A.newlyCovered(n.state.board,p.state.board,event,nextPhase.pattern);
    if(debt.length>4||S.cavityRepairDebt(S.cavityFacts(n.state.board),S.cavityFacts(p.state.board),event).length)continue;
    const payment=piece.id===reserve.id;
    // Merely consuming O is not paying a plan. It must fill the outstanding
    // actual repair cells, rather than erase them through a guessed future.
    if(payment&&(!n.everDebt||!n.debt.length||debt.length||event.lines))continue;
    const paid=n.paid||payment,extraPaid=n.extraPaid||extraS.some(q=>q.id===piece.id),path=[...n.path,p];
    const g=S.geometry(p.state.board,{notches:nextPhase.pattern});
    const child={state:p.state,resource,notches:nextPhase.pattern,path,debt,everDebt:n.everDebt||created.length>0,paid,extraPaid,
     score:resource.pendingCenter.length*8+debt.length*2+Math.max(...g.left.profile)+g.left.roughness-3*path.reduce((sum,q)=>sum+q.event.lines,0)};
    if(paid&&extraPaid&&!resource.pendingCenter.length&&!debt.length&&!L.isD(p.state.board)&&assess(p.state.board).regionalSupport){
     const initial={...assess(s.board),state:s,notches:phase,resources:root,coveredRepair:summary.coveredRepair};let assembled=null;
     for(const step of path)assembled=nodeFor({...step,...policyWitnesses(assembled?.state??s)},assembled,initial,0);
     if(assembled.cycleDebt||!assembled.notchValid||!certifiedCavities(assembled))continue;
     const steps=assembled.path.map(({state,...p})=>({...p,resultContext:context(state)}));
     const resourceProof=checkedResourceEndpoint(s,steps,{...options,maxNodes:cap-used,deadline,now});used+=resourceProof.visited||0;
     const repair=checkedCoveredRepair(s,steps,options),access=resourceProof.valid&&repair?A.prefix(s,steps,{notches:phase,maxNodes:cap-used,deadline,now}):null;used+=access?.visited||0;
     if(resourceProof.valid&&repair&&access?.reachable===true&&used<=cap&&now()<deadline){
      telemetry.selected=true;telemetry.reason='reserved-O-restores-actual-covered-cells';
      const assessment=assembled.assessment,presentation=advicePresentation(steps,assessment),first=steps[0];
      return finish({...incumbent,...presentation,target:first.target,witness:first.witness,hold:first.hold,holdCount:holdCount(first),continuation:repair.steps,assessment,reason:presentation.reason+' Keep the O reserved for the checked repair later in this sequence.',evidence:{strategy:'canonical-right-ST',verifiedLocks:steps.length,knownPieceHorizon:s.queue.length+1,cycleDebt:0,cycleResources:cycleResources(steps),futureNotches:assembled.notches,structure:assessment.structure,structuralScore:assembled.structuralScore,structuralRank:assembled.rank,regionalSupport:assessment.regionalSupport,initialSealed:assess(s.board).sealed,endpointSealed:assessment.sealed,coveredRepair:repair.proof,coveredRepairPlan:repair.plan,resourceObligations:{status:'checked',binding:resourceProof.resource.originKey},gapAccess:access,reservedPiecePlan:{reservedId:reserve.id,paymentLock:path.length,claim:'Actual public finite repair, not indefinite sustainability.'},claim:'Finite executable prefix; endpoint estimates are not a sustainability guarantee.'},metrics:{...incumbent.metrics,certifiedHorizon:steps.length}});
     }
    }
    if(!paid)children.push(child);
   }
  }
  const seen=new Set();layer=children.sort((a,b)=>a.score-b.score).filter(n=>{const key=JSON.stringify([n.state.board,M.binding(n.resource),n.debt]);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,4);
 }
 if(!bounded())incomplete=true;return finish(incumbent);
}

// A scoped allocation tradeoff, not a universal risky-over-supported rule.
// Actual S placement can relieve a public S/L supply imbalance that the
// supported HOLD move postpones. The newly created D remains an explicit risk.
function contextualRiskPreference(raw,supported,options,collector){
 if(!supported?.target||supported.retained||options.disableContextualRisk||options.openingPhase!==false||options.allowHold===false||options.commitment||supported.evidence?.opening||supported.evidence?.construction||supported.evidence?.commitmentRetained||supported.evidence?.reservedPiecePlan||!collector.placements?.length)return supported;
 const state=observe(raw),summary=resourceSummary(state,options),supply=M.start(state,summary),visible=[supply.active,supply.hold,...supply.queue].filter(Boolean),counts=type=>visible.filter(p=>p.type===type).length;
 if(!['complete','partial'].includes(summary.coverage.status)||counts('S')-counts('L')<2||summary.coveredRepair?.cells.length||supply.pendingCenter.length||supply.violations.length)return supported;
 const first=supported.continuation?.[0],replay=first&&R.replay(extendForced(state),first.witness);
 if(!replay?.valid||replay.events.length!==1||replay.events[0].type==='S'||replay.events[0].lines||!replay.events[0].cells.every(([x])=>x<4)||replay.state.hold!=='S')return supported;
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity;
 if(now()>=deadline||(supported.metrics?.nodes||0)>=(options.maxNodes??45000))return supported;
 const baseline=replay.state,old=assess(baseline.board),phase=H.resolve(state,options.patternHistory),oldSealed=S.cavityFacts(state.board).sealed,sameOutsideLeft=b=>b.every((row,y)=>row.slice(4)===baseline.board[y].slice(4)),placements=[];
 for(const p of collector.placements){
  if(now()>=deadline)return supported;
  if(p.event.type!=='S'||p.event.lines||!p.event.cells.every(([x])=>x<4)||!L.createsD(state.board,p.state.board)||p.state.active?.type!==baseline.active?.type||JSON.stringify(p.state.queue)!==JSON.stringify(baseline.queue)||p.state.streamCursor!==baseline.streamCursor||!sameOutsideLeft(p.state.board))continue;
  const facts=assess(p.state.board);
  if(facts.maxHeight>old.maxHeight||facts.left.height>old.left.height||A.newlyCovered(state.board,p.state.board,p.event,phase).length||S.cavityFacts(p.state.board).sealed>oldSealed)continue;
  placements.push(p);
 }
 if(!placements.length)return supported;
 const comparison={scope:'same-public-draw; first-lock Left-only accommodation',reason:'place-visible-S-instead-of-postponing-it-in-HOLD',visibleS:counts('S'),visibleL:counts('L'),excessBefore:counts('S')-counts('L'),excessAfter:counts('S')-counts('L')-1,
  supportedAlternative:{target:clone(first.target),holdCount:holdCount(first),verifiedLocks:supported.continuation.length,metrics:{certifiedHorizon:supported.metrics?.certifiedHorizon??null,nodes:supported.metrics?.nodes??null},claim:'A supported finite alternative was found, not a guarantee of sustainability.'}};
 return riskyFallback(raw,supported,options,{...collector,placements},comparison);
}

function decide(raw,options={}){return queryRequest(()=>{const now=options.now||(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs),collector={key:null,placements:null,complete:false,started:Date.now()};try{collector.key=stateKey(extendForced(observe(raw)));}catch{}options={...options,now,deadline,[riskRootCollector]:collector};const initial=decideRequest(raw,options),result=reservedPiecePlan(raw,initial,options,collector);return result.target?classifySupported(contextualRiskPreference(raw,result,options,collector)):riskyFallback(raw,result,options,collector);});}
function decideRequest(raw,options={}){
 const now=options.now||(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs),budgetTracker={nodes:0},limit=options.maxNodes??45000;
 options={...options,now,deadline};const previous=options.previous;
 const recovery=options.handoffRecovery?{attempted:true,retained:false,nodes:0,reason:options.commitment?'existing-commitment':'not-checked'}:null;
 const recovered=recovery&&!options.commitment?retainHandoffRecovery(raw,{...options,budgetTracker,maxNodes:limit},recovery):null;
 if(recovered)return{...recovered,metrics:{...recovered.metrics,nodes:budgetTracker.nodes,revalidationNodes:budgetTracker.nodes,handoffRecovery:recovery}};
 if(previous?.evidence?.construction)options={...options,constructionPrevious:previous};
 const retained=!options.commitment&&previous?revalidate(raw,previous,{...options,budgetTracker,maxNodes:Math.max(0,limit-budgetTracker.nodes)}):null;
 if(retained&&!retained.evidence?.pendingLStage)return recovery?{...retained,metrics:{...retained.metrics,nodes:budgetTracker.nodes,revalidationNodes:budgetTracker.nodes,handoffRecovery:recovery}}:retained;
 const result=plan(raw,{...options,handoffRecovery:null,maxNodes:Math.max(0,limit-budgetTracker.nodes)});
 return budgetTracker.nodes||recovery?{...result,metrics:{...result.metrics,nodes:(result.metrics?.nodes||0)+budgetTracker.nodes,revalidationNodes:budgetTracker.nodes,...(recovery?{handoffRecovery:recovery}:{})}}:result;
}

return Object.freeze({dPatternAdmission,checkedCoveredRepair,pendingSLAllocationComparison,qualifiedSLTailOrder,compareSLTail,visibleSLTailComparison,ordinarySAllocationComparison,slAllocationStep,placedResource,certifyStrongestAllocation,publicDrawHorizon,exactAllocationPrefix,supportedSLComparison,preserveExtraZ,orderContinuations,advicePresentation,observe,assess,plan,decide,captureHandoffRecovery,resetSelection,startPatternHistory:H.start,updatePatternHistory:H.update,resolvePatternHistory:H.resolve,gapAccess:A.check,checkAccessPrefix:A.prefix,startOpeningSession,updateOpeningSession,acceptOpeningResult,revalidate,advance,cavityRepairDebt,continueCommitment,cycleResources,resourceGoal,resourceGoalPrefix,scoringSchedule,scoringReplacement,centerReservationStep,centerContinuityStep,ordinaryCenterEligible,ordinaryRightEligible});
});
