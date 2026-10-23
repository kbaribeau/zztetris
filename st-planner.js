/* Milestone-one finite-information coach. No fixture IDs, seeds or hidden queues. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js'),require('./st-structure.js'),require('./st-paired-repair.js')):factory(root.STRules,root.STBag,root.STStructure,root.STPairedRepair);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,S,X){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const holdCount=p=>p.holdCount??p.witness.filter(a=>a==='HOLD').length;
const holdPrompt=p=>holdCount(p)===2?'Hold twice. ':holdCount(p)?'Hold first. ':'';
function observe(input){
 const s=R.createState({rules:input.rules,board:input.board,active:input.active,hold:input.hold,canHold:input.canHold,queue:input.queue,revision:input.revision,streamCursor:input.streamCursor,topOut:input.topOut});
 if(input.bag)s.bag=clone(input.bag);return s;
}
function assess(board){
 const heights=Array.from({length:10},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
 // Air flood identifies sealed cavities, not every roofed cell. A T-slot under
 // an overhang can be accessible from the side and is not automatically bad.
 const air=new Set(),todo=[];for(let x=0;x<10;x++)if(board[0][x]==='.')todo.push([x,0]);
 for(let i=0;i<todo.length;i++){const[x,y]=todo[i],key=y*10+x;if(air.has(key))continue;air.add(key);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,c=y+dy;if(a>=0&&a<10&&c>=0&&c<40&&board[c][a]==='.'&&!air.has(c*10+a))todo.push([a,c]);}}
 const sealedCells=[];let sealed=0,covered=0,leftSealed=0;for(let x=0;x<10;x++)for(let y=40-heights[x];y<40;y++)if(board[y][x]==='.'){covered++;if(!air.has(y*10+x)){sealed++;sealedCells.push([x,y]);if(x<7)leftSealed++;}}
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
// Only newly sealed internal construction cells create repair debt. Existing
// imported damage is not silently reclassified, and intentional right-region
// reservoirs are governed by their separate cap/T-double proofs.
function cavityRepairDebt(before,after,event,debt=[]){
 const cleared=event.clearedRows||[];
 const translate=cells=>cells.filter(([,y])=>!cleared.includes(y)).map(([x,y])=>[x,y+cleared.filter(r=>r>y).length]);
 const key=([x,y])=>x+','+y;
 const old=new Set(translate(before.sealedCells.filter(([x])=>x<7)).map(key));
 const current=after.sealedCells.filter(([x])=>x<7),sealed=new Set(current.map(key));
 return [...new Map([...translate(debt),...current.filter(c=>!old.has(key(c)))].filter(c=>sealed.has(key(c))).map(c=>[key(c),c])).values()];
}
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
function cycleResources(path){
 const events=path.map(p=>p.event),tsds=events.filter(e=>e.type==='T'&&e.spin==='full'&&e.lines===2).length;
 const quads=events.filter(e=>e.type==='I'&&e.lines===4).length;
 const pocket=path.filter(p=>p.event.type==='I'&&!p.event.lines&&p.structuralEvidence?.allocation==='quad-preparation').length;
 let outstandingPocket=0;for(const p of path){if(p.event.type==='I'&&!p.event.lines&&p.structuralEvidence?.allocation==='quad-preparation')outstandingPocket++;if(p.event.type==='I'&&p.event.lines===4)outstandingPocket=Math.max(0,outstandingPocket-1);}
 return {centerCompletions:centerGoalKeys(path).length,locks:path.length,lines:events.reduce((n,e)=>n+e.lines,0),materialDelta:4*path.length-10*events.reduce((n,e)=>n+e.lines,0),tsds,quads,pocket,outstandingPocket,
  tFillers:events.filter(e=>e.type==='T'&&!e.lines).length,iFillers:events.filter(e=>e.type==='I'&&!e.lines&&e.cells.some(([x])=>x<7)).length};
}
function resourceGoal(path){const r=cycleResources(path);return r.tsds+r.quads+r.pocket+r.centerCompletions>0;}
// Compare only the resources protected by the outstanding goal. Incidental I
// use on a T-only route is not an I reservation. Trailing post-goal filler must
// not make an otherwise equivalent proof appear longer or more wasteful.
function resourceGoalPrefix(path,goal){
 const centerGoals=centerGoalKeys(goal),hasCenter=prefix=>centerGoals.every(key=>centerGoalKeys(prefix).includes(key));
 const required=cycleResources(goal),fulfils=a=>a.tsds>=required.tsds&&a.quads>=required.quads&&a.outstandingPocket+Math.max(0,a.quads-required.quads)>=required.outstandingPocket;
 let b=required;for(let length=1;length<=goal.length;length++){const prefix=cycleResources(goal.slice(0,length));if(fulfils(prefix)&&hasCenter(goal.slice(0,length))){b=prefix;break;}}
 for(let length=1;length<=path.length;length++){
  const a=cycleResources(path.slice(0,length));
  if(fulfils(a)&&hasCenter(path.slice(0,length))&&
   (!b.tsds||a.tFillers<=b.tFillers)&&(!(b.quads+b.outstandingPocket)||a.iFillers<=b.iFillers))return length;
 }
 return null;
}
function coversResourceGoal(candidate,committed){return resourceGoalPrefix(candidate.path,committed.path)!==null;}
function sameObservedResult(expected,actual){return expected.rules===actual.rules&&JSON.stringify(expected.board)===JSON.stringify(actual.board)&&expected.hold===actual.hold&&expected.active?.type===actual.active?.type&&expected.canHold===actual.canHold&&expected.topOut===actual.topOut&&expected.queue.every((t,i)=>actual.queue[i]===t);}
function committedNode(s,proof,roots,initial){
 if(!proof?.observation||!proof.advice?.continuation?.length)return null;
 let origin;try{origin=observe(proof.observation);}catch{return null;}if(R.validate(origin).length)return null;
 const steps=proof.advice.continuation;if(steps.length>7||!resourceGoal(steps))return null;
 const expected=R.replay(origin,steps[0].witness);if(!expected.valid||expected.events.length!==1)return null;
 let first=roots.find(p=>JSON.stringify(p.event)===JSON.stringify(expected.events[0])&&sameObservedResult(expected.state,p.state));
 // A budget-truncated enumeration must not discard an already executable
 // exact witness. Replay is bounded by the saved public prefix, not search.
 if(!first){const r=R.replay(s,steps[0].witness);if(r.valid&&r.events.length===1&&JSON.stringify(r.events[0])===JSON.stringify(expected.events[0])&&sameObservedResult(expected.state,r.state))first={state:r.state,event:r.events[0],target:r.events[0].target,witness:steps[0].witness,hold:steps[0].witness.includes('HOLD')};}
 if(!first)return null;const rootIndex=roots.indexOf(first),flags=policyWitnesses(s);
 first={...first,availableCap:first.availableCap||flags.availableCap,availableCleanupPreparation:first.availableCleanupPreparation||flags.availableCleanupPreparation};
 let n=nodeFor(first,null,initial,rootIndex);
 for(const step of steps.slice(1)){const r=R.replay(n.state,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event))return null;
  n=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(n.state)},n,initial,n.rootIndex);
 }
 return resourceGoal(n.path)&&n.path.every(p=>S.canonicalClear(p.event))&&n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport?n:null;
}
// Construction history is an executable public proof, never an imported mode.
// Recreate its complete route and bind the consumed prefix to the current board.
function constructionAdvice(s,proof,deadline=Infinity,now=()=>Date.now()){
 if(!proof||!Number.isInteger(proof.consumed)||proof.consumed<0||proof.consumed>=proof.steps?.length)return null;
 const verified=X.validateCertificate(proof.origin,proof.steps,{kind:proof.kind,timeMs:Math.max(0,Math.min(750,deadline-now()))});if(!verified.valid)return null;
 let expected=observe(proof.origin);
 for(const step of proof.steps.slice(0,proof.consumed))expected=R.replay(expected,step.witness).state;
 if(!sameObservedResult(expected,s))return null;
 let current=s;const continuation=[];
 for(const step of verified.continuation.slice(proof.consumed)){
  const r=R.replay(current,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event))return null;
  current=r.state;continuation.push({...step,target:step.event.target,hold:step.witness.includes('HOLD'),holdCount:holdCount(step),resultContext:context(current)});
 }
 const first=continuation[0],done=verified.continuation.slice(0,proof.consumed);
 const parity=done.filter(p=>p.event.type==='T'&&!p.event.lines).reduce((v,p)=>v+p.event.cells.reduce((n,[x,y])=>n+((x+y)%2?1:-1),0),0);
 return {status:'recommended-with-verified-prefix',revision:s.revision,context:context(s),target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation,
  reason:proof.kind==='cap-deferral'?'Use the verified replacement Z to repay the exact right cap, then take the checked T-spin double.':'Build the verified regional repair, preserving the paired T balance and center completion before the checked T-spin double.',
  metrics:{nodes:0,endpointMass:current.board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0),depth:continuation.length,completeDepth:continuation.length,elapsedMs:verified.elapsedMs},assessment:assess(current.board),
  evidence:{strategy:proof.kind==='cap-deferral'?'finite-cap-deferral':'finite-regional-repair',construction:clone(proof),cycleResources:cycleResources(continuation),cycleDebt:0,verifiedLocks:continuation.length,knownPieceHorizon:s.queue.length+1,
   constructionStage:{parity,capDebt:verified.cap&&proof.consumed<=verified.cap.paidAt?verified.cap.targets:[],remainingLocks:continuation.length,zAllocation:'Only the executed public route is reserved; no Extra-Z history is inferred.',completion:'Finite supported TSD endpoint, not a completed Reset.'},claim:'Finite executable regional repair; continued play is not guaranteed.'}};
}
function continueConstruction(before,after,advice,event){
 const proof=advice?.evidence?.construction;if(!proof)return null;
 const verified=X.validateCertificate(proof.origin,proof.steps,{kind:proof.kind});if(!verified.valid||!Number.isInteger(proof.consumed)||proof.consumed<0)return null;
 const expected=verified.continuation.slice(proof.consumed);
 if(!expected.length||JSON.stringify(expected.map(p=>p.event))!==JSON.stringify(advice.continuation.map(p=>p.event)))return null;
 const r=R.replay(observe(before),advice.witness);
 if(!r.valid||r.events.length!==1||JSON.stringify(expected[0].event)!==JSON.stringify(event)||JSON.stringify(r.events[0])!==JSON.stringify(event)||!sameObservedResult(r.state,observe(after)))return null;
 return constructionAdvice(observe(after),{...proof,consumed:proof.consumed+1});
}
function continueCommitment(before,after,advice,actualEvent=after?.lastEvent){
 if(advice?.evidence?.construction)return continueConstruction(before,after,advice,actualEvent);
 if(!advice?.continuation?.length||advice.continuation.length<2)return null;
 let origin,s;try{origin=observe(before);s=observe(after);}catch{return null;}if(R.validate(origin).length||R.validate(s).length)return null;
 const first=R.replay(origin,advice.continuation[0].witness);if(!first.valid||first.events.length!==1||!actualEvent||JSON.stringify(first.events[0])!==JSON.stringify(actualEvent)||!S.canonicalClear(actualEvent)||!sameObservedResult(first.state,s))return null;
 const steps=advice.continuation.slice(1);if(!resourceGoal(steps))return null;
 let current=s,notches=S.notchPattern(s.board),debt=[],centerDebt=centerReservationStep(origin,{event:first.events[0],state:first.state}).debt,prior=assess(s.board);const continuation=[];
 for(const step of steps){const r=R.replay(current,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!S.canonicalClear(r.events[0]))return null;
  const policy=policyWitnesses(current),transition=S.transition(current,{event:r.events[0],state:r.state,...policy});if(transition.cycleViolations.length)return null;
  const centerReservation=centerReservationStep(current,{event:r.events[0],state:r.state},centerDebt,notches);centerDebt=centerReservation.debt;
  const previousState=current,check=S.advanceNotches(current.board,{event:r.events[0],state:r.state},notches),a=assess(r.state.board);if(!check.valid||a.maxHeight>=20)return null;
  debt=cavityRepairDebt(prior,a,r.events[0],debt);if(!continuation.length&&debt.length)return null;notches=check.pattern;prior=a;current=r.state;
  continuation.push({...step,resultContext:context(current),structuralEvidence:{...step.structuralEvidence,centerReservation,allocation:S.transition(previousState,{event:r.events[0],state:r.state}).allocation}});
 }
 if(debt.length||centerDebt.length||!prior.regionalSupport||!resourceGoal(continuation))return null;
 const head=continuation[0];return {...advice,target:head.target,witness:head.witness,hold:head.witness.includes('HOLD'),holdCount:holdCount(head),continuation,context:context(s),revision:s.revision,
  reason:'Continue the verified scoring and cleanup route.',evidence:{...advice.evidence,cycleResources:cycleResources(continuation),commitmentRetained:true}};
}
function context(s){return JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);}
function stateKey(s){return JSON.stringify([s.rules,s.board,s.active,s.hold,s.canHold,s.queue,s.bag??null]);}
function nodeKey(n){return stateKey(n.state)+':notches:'+n.notches.status+':'+n.notches.anchorRow+':cavities:'+JSON.stringify(n.cavityDebt.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by))+':center:'+JSON.stringify(n.centerDebt)+':rootSeal:'+Boolean(n.path[0].structuralEvidence.cavityRepair.cells.length);}
function extendForced(state){if(!state.bag)return state;const t=B.forcedNext(state.bag);if(!t)return state;return {...state,queue:[...state.queue,t],bag:B.consume(state.bag,t)};}
function compare(a,b){for(let i=0;i<a.rank.length;i++)if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];return a.key.localeCompare(b.key);}
function nodeFor(p,parent,initial,rootIndex){
 const assessment=assess(p.state.board),path=[...(parent?.path??[]),p];
 const before=parent?.state??initial.state,priorNotches=parent?.notches??initial.notches;
 const notchCheck=S.advanceNotches(before.board,p,priorNotches);
 const structure=S.assess(p.state,{notches:notchCheck.pattern});
 const transition=S.transition(before,p,structure,{notches:priorNotches});
 transition.futureNotches=notchCheck;
 // A crossing placement is not forbidden. Track its outstanding dependency,
 // rather than rewarding a short tactical event regardless of the rebuild.
 const dependencyDebt=Math.max(0,(parent?.dependencyDebt??0)+transition.dependencyDebt);
 const priorAssessment=parent?.assessment??initial;
 const cavityDebt=cavityRepairDebt(priorAssessment,assessment,p.event,parent?.cavityDebt);
 const centerReservation=centerReservationStep(before,p,parent?.centerDebt,priorNotches),centerDebt=centerReservation.debt;
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
 const structuralScore=structure.supportEstimate+assessment.estimate-damage*4-dependencyDebt*3-headroomRisk-entryDebt*12;
 assessment.structure.headroomRisk=headroomRisk;
 const tsds=path.filter(v=>v.event.spin==='full'&&v.event.lines===2).length;
 p.structuralEvidence={...transition,centerPartnerDeficitBefore:(parent?.assessment??initial).center.partnerDeficit,centerPartnerDeficitAfter:assessment.center.partnerDeficit,placedPiece:p.event.type,structure,dependencyDebt,entryDebt,nonclearScoringGeometryLost:losesEntry,centerReservation,cavityRepair:{status:cavityDebt.length?'requires-executed-repair':'no-outstanding-new-internal-cavity',cells:cavityDebt}};
 // Nearby structural estimates are deliberately comparable. The finite
 // executable TSD then breaks ties; it cannot buy a poorer structural band.
 const cycleDebt=(parent?.cycleDebt??0)+transition.cycleViolations.length+(notchCheck.valid?0:1);
 const rank=[safe?1:0,assessment.regionalSupport?1:0,cycleDebt?-cycleDebt:0,Math.floor(structuralScore/4),tsds*2,-path.reduce((n,v)=>n+v.witness.length+holdCount(v)*2,0),path.reduce((n,v)=>n+v.event.lines,0)];
 return{state:p.state,path,notches:notchCheck.pattern,notchValid:notchCheck.valid,assessment,rank,structuralScore,dependencyDebt,entryDebt,cycleDebt,cavityDebt,centerDebt,baseEstimateRank:rank[4],qualified:!assessment.right.slots.length,rootIndex,key:JSON.stringify(path[0].target)+':'+holdCount(path[0])};
}
function diversify(nodes,width){const sorted=[...nodes].sort(compare),chosen=[],roots=new Set(),groups=new Set();
 // Protect meaningfully different construction families, not just top-scoring
 // near-identical surfaces. This is diversity, not a canned move template.
 for(const n of sorted){const first=n.path[0],g=[first.target.type,holdCount(first),n.assessment.right.slots.length>0].join(':');if(!groups.has(g)){chosen.push(n);roots.add(n.rootIndex);groups.add(g);if(chosen.length===width)return chosen;}}
 for(const n of sorted)if(!roots.has(n.rootIndex)){chosen.push(n);roots.add(n.rootIndex);if(chosen.length===width)return chosen;}
 const keys=new Set(chosen.map(n=>nodeKey(n)));for(const n of sorted)if(!keys.has(nodeKey(n))){chosen.push(n);keys.add(nodeKey(n));if(chosen.length===width)break;}return chosen;}
function plan(raw,options={}){
 const started=Date.now(),now=options.now??(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 let s;try{s=observe(raw);}catch(e){return{status:'invalid-input',revision:raw?.revision??0,target:null,reason:'The supplied observation is not valid.',errors:[e.message]};}
 const errors=R.validate(s);if(s.bag)errors.push(...B.validate(s.bag));
 const base={revision:s.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],reason:'',metrics:{nodes:0,roots:0,rootExpanded:0,depth:0,completeDepth:0,elapsedMs:0},context:context(s)};
 if(errors.length)return{...base,status:errors.includes('unsupported-profile')?'unsupported-profile':'invalid-input',reason:errors.join('; '),errors};
 if(s.topOut)return{...base,status:'no-supported-continuation-found',reason:'This position has topped out under the selected rules.'};
 if(!s.active)return{...base,status:'insufficient-known-pieces',reason:'No active piece is available in this observation.'};
 if(s.board.every(r=>r==='..........'))return{...base,status:'unsupported-position',reason:'Opening construction is outside milestone one. Choose an established-stack fixture.'};
 const initial=assess(s.board);initial.state=s;initial.notches=S.notchPattern(s.board);
 if(!options.disableConstruction&&options.constructionPrevious?.evidence?.construction){const prior=options.constructionPrevious,proof=prior.evidence.construction;
  const cert=X.validateCertificate(proof.origin,proof.steps,{kind:proof.kind,timeMs:Math.max(0,deadline-now())});if(cert.valid&&JSON.stringify(cert.continuation.slice(proof.consumed).map(p=>p.event))===JSON.stringify(prior.continuation.map(p=>p.event))){const retained=revalidate(s,prior,{...options,deadline,maxNodes:Math.min(options.maxNodes??45000,8000)});if(retained)return retained;}
 }
 if(!options.disableConstruction&&options.commitment?.advice?.evidence?.construction){
  const proof=options.commitment.advice.evidence.construction,saved=constructionAdvice(s,proof,deadline,now);
  if(saved){
   // Consider ordinary scoring at the SAME executed horizon. A replacement
   // must re-certify the original public construction and dominate its endpoint,
   // rather than silently abandoning a pending parity/center/Z obligation.
   if(initial.maintenanceScope&&saved.continuation.length<=s.queue.length+1&&deadline-now()>100){
    const ordinary=plan(s,{...options,disableConstruction:true,deadline,commitment:null,constructionPrevious:null,depth:saved.continuation.length});
    if(ordinary.target&&ordinary.continuation.length===saved.continuation.length){
     const candidateProof={...proof,steps:[...proof.steps.slice(0,proof.consumed),...ordinary.continuation.map(p=>({witness:p.witness}))]},replacement=constructionAdvice(s,candidateProof,deadline,now);
     if(replacement){const a=replacement.assessment,b=saved.assessment,ma=replacement.metrics.endpointMass,mb=saved.metrics.endpointMass;
      if(a.maxHeight<=b.maxHeight&&ma<=mb&&(a.maxHeight<b.maxHeight||ma<mb))return replacement;
     }
    }
   }
   saved.metrics.elapsedMs=now()-started;return saved;
  }
 }
 if(initial.notches.status==='broken')return{...base,status:'no-supported-continuation-found',reason:'An established column-seven notch is already filled. Normal ST continuation is not certified; this planner does not establish a repair for the broken pattern.',assessment:initial};
 if(!options.disableConstruction&&!initial.maintenanceScope&&initial.center.height<3&&X&&initial.left.height>=2&&initial.notches.status==='established'&&S.geometry(s.board).right.shapeStatus==='staggered-scoring-wall'){
  const repair=X.search(s,{timeMs:Math.max(0,Math.min(680,deadline-now()-70)),maxNodes:options.maxNodes??45000});
  if(repair.valid){const advice=constructionAdvice(s,{origin:observe(s),steps:repair.continuation.map(p=>({witness:p.witness})),consumed:0},deadline,now);if(advice){advice.metrics.search=repair.search;advice.metrics.nodes=repair.search?.visited||0;advice.metrics.elapsedMs=now()-started;return advice;}}
 }
 if(!initial.maintenanceScope)return{...base,status:'unsupported-position',reason:initial.left.height<2||initial.center.height<3?'This stack is below the established-stack maintenance profile. Choose another fixture or rebuild manually; opening construction is not coached.':'This position is outside the initial right-hand ST maintenance profile: established left/center stack and lower column-eight scoring channel required.',assessment:initial};
 const limit=options.maxNodes??45000,maxDepth=options.depth??3,width=options.width??8,expandedRoots=new Set(),accessCache=new Map();let stopped=false;
 base.metrics.accessNodes=0;let searchDeadline=deadline;
 const optimistic=n=>({...n,rank:n.rank.map((v,i)=>{
  if(n.qualified)return v;
  const cavity=n.assessment.structure.right.reservoir;
  if(i===3&&cavity)return Math.floor((n.structuralScore+cavity.cells.length*3)/4);
  return i===4?v+1:v;
 })});
 const qualify=nodes=>{
  // Geometry is only an upper bound. Resolve the most promising candidates
  // lazily; inaccessible cavities must never earn a T-slot reward.
  const pending=nodes.slice(),selected=[];
  const order=(a,b)=>compare(optimistic(a),optimistic(b));
  const verify=n=>{
   if(n.qualified)return;
   const key=n.state.board.map(row=>row.replace(/[IJLOSTZX#]/g,'#')).join('');
   let access=accessCache.get(key);
   if(!access){access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.accessNodes+=access.visited;base.metrics.nodes+=access.visited;if(access.complete)accessCache.set(key,access);else stopped=true;}
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
 const enumerate=state=>{const remaining=limit-base.metrics.nodes;if(remaining<=0||now()>=searchDeadline){stopped=true;return{placements:[],complete:false};}const r=R.placements(state,{allowHold:options.allowHold!==false,maxNodes:remaining,deadline:searchDeadline,now});base.metrics.nodes+=r.visited;if(!r.complete)stopped=true;const caps=S.geometry(state.board).right.completions;const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));const availableCap=r.placements.some(p=>p.event.type==='Z'&&caps.some(c=>sameCells(p.event.cells,c.cells)));for(const p of r.placements)p.availableCap=availableCap;
 // The cap must not seal a currently executable outer-I cleanup preparation.
 // Establish both placements from actual supply; a geometric I silhouette or
 // a hypothetical future Z is insufficient to constrain another root move.
 const cleanupBeforeCap=r.placements.some(first=>{
  if(S.transition(state,first).allocation!=='quad-preparation'||S.geometry(first.state.board).right.cycle.phase!=='cap-rebuild-with-cleanup-prepared')return false;
  let after=first.state,prefix=[];
  if(after.active?.type!=='Z'){if(options.allowHold===false||after.hold!=='Z')return false;const held=R.move(after,'HOLD');if(held===after||held.topOut)return false;after=held;prefix=['HOLD'];}
  return S.geometry(after.board).right.completions.some(cap=>{const r=R.replay(first.state,[...prefix,...cap.witness]);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&!r.events[0].lines&&!r.state.topOut;});
 });
 for(const p of r.placements)p.availableCleanupPreparation=cleanupBeforeCap;
 return r;};
 const root=enumerate(s);base.metrics.roots=root.placements.length;
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
      const candidate=constructionAdvice(s,proof,capDeadline,now);if(candidate)capStages.push(candidate);
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
     const child=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness,hold:prefix.length>0,...policyWitnesses(n.state)},n,initial,n.rootIndex);
     if(child.cycleDebt===0&&child.notchValid&&child.assessment.maxHeight<20&&child.centerDebt.length<n.centerDebt.length)choices.push(child);
    }
   }
   n=choices.sort(compare)[0];if(!n)return null;
  }
  return n.centerDebt.length?null:n;
 };
 const commitment=committedNode(s,options.commitment,root.placements,initial);
 // A narrow constructive obligation, not a blanket ban on pre-cap T filler.
 // Prove the available I -> Z -> saved T route before beam pruning can discard
 // its unfinished cap. Every action uses the real observation and visible queue.
 // An interrupted proof earns no credit; conflicting T advice is withheld.
 // A completed failed proof does not reserve the T.
 let preparation=null,preparationUnresolved=false;
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
    let n=nodeFor(first,null,initial,i);n=nodeFor(second,n,initial,i);n=nodeFor(third,n,initial,i);
    n=finishCenterDebt(n);if(n&&n.cycleDebt===0&&certifiedCavities(n)&&n.assessment.regionalSupport&&n.assessment.maxHeight<20)preparation=n;
   }
  }
 }
 // Extend cap preparation through a bounded prefix of the visible queue. This
 // is a constructive search, not a global T penalty: only a replayed Z cap and
 // the actual saved T double create an obligation. The small beam may miss a
 // route; a failed search is never evidence that no route exists.
 let cleanupCommitment=null;
 // Reserve an available I across an actual upcoming double when that clear
 // opens the Pocket. This proof uses the real held I, not a later copy in bag.
 if(maxDepth>=3&&options.allowHold!==false&&(s.active.type==='I'||s.hold==='I')){
  const candidates=root.placements.filter(p=>p.event.type!=='I'&&p.state.hold==='I'&&p.state.active?.type==='T'&&S.canonicalClear(p.event)).map((p,i)=>nodeFor(p,null,initial,i)).filter(n=>n.cycleDebt===0&&certifiedCavities(n)&&n.assessment.maxHeight<20).sort(compare).slice(0,4);
  for(const n of candidates){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   const access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
   if(!access.complete||!access.reachable)continue;
   const t=R.replay(n.state,access.witness);if(!t.valid||t.events.length!==1||t.events[0].type!=='T'||t.events[0].lines!==2||t.events[0].spin!=='full')continue;
   const scored=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness:access.witness,hold:false},n,initial,n.rootIndex);
   let active=R.move(t.state,'HOLD'),witness=['HOLD'];if(active===t.state||active.topOut||active.active?.type!=='I')continue;
   let next=R.move(active,'CW');if(next===active)continue;active=next;witness.push('CW');
   while(active.active.x!==7){const a=active.active.x<7?'R':'L';next=R.move(active,a);if(next===active)break;active=next;witness.push(a);}
   if(active.active.x!==7)continue;const r=R.replay(t.state,[...witness,'HD']);if(!r.valid||r.events.length!==1)continue;
   const end=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:[...witness,'HD'],hold:true},scored,initial,n.rootIndex);
   if(end.cycleDebt===0&&end.notchValid&&certifiedCavities(end)&&end.assessment.maxHeight<20&&end.assessment.regionalSupport&&end.path.at(-1).structuralEvidence.allocation==='quad-preparation'&&(!cleanupCommitment||compare(end,cleanupCommitment)<0))cleanupCommitment=end;
  }
 }
 let preparationKind='visible-I-Z-held-T';
 const visible=[s.active.type,...s.queue],tIndex=s.hold==='T'?-1:visible.indexOf('T'),zIndex=s.hold==='Z'?-1:visible.indexOf('Z');
 const capPending=S.geometry(s.board).right.cycle.phase.startsWith('cap-rebuild')||S.geometry(s.board).right.cycle.phase==='post-clear-rebuild';
 if(!preparation&&!preparationUnresolved&&maxDepth>=3&&options.allowHold!==false&&capPending&&(tIndex>=0||s.hold==='T')&&(zIndex>tIndex||s.hold==='Z')&&zIndex<=5&&(zIndex<=3||tIndex===0||s.hold==='T'||s.hold==='Z')&&s.active.type!=='Z'){
  const admissible=n=>n.cycleDebt===0&&n.notchValid&&n.assessment.maxHeight<20;
  let candidates=root.placements.filter(p=>p.event.type!=='T'&&S.canonicalClear(p.event)).map((p,i)=>nodeFor(p,null,initial,i)).filter(admissible);
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
       let terminal=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness,hold:prefix.length>0},n,initial,n.rootIndex);
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
     const capNode=nodeFor(second,n,initial,n.rootIndex);if(!admissible(capNode)||depth+2>maxProofLocks)continue;
     const held=R.move(z.state,'HOLD');if(held===z.state||held.topOut||held.active?.type!=='T')continue;
     const access=R.tDoubleAccess(held.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
     if(!access.complete){proofStopped=true;break;}if(!access.reachable)continue;
     const witness=['HOLD',...access.witness],t=R.replay(z.state,witness);
     if(!t.valid||t.events.length!==1||!S.canonicalClear(t.events[0])||t.events[0].lines!==2||t.state.topOut)continue;
     let terminal=nodeFor({target:t.events[0].target,hold:true,holdCount:1,witness,state:t.state,event:t.events[0]},capNode,initial,n.rootIndex);
     terminal=finishCenterDebt(terminal);
       if(terminal&&admissible(terminal)&&certifiedCavities(terminal)&&terminal.assessment.regionalSupport&&(!preparation||compareProof(terminal,preparation)<0)){preparation=terminal;preparationKind='visible-prefix-Z-saved-T';}
    }
    if(preparation||proofStopped)continue;
    if(!n.state.active||depth+2>=maxProofLocks)continue;
    const e=enumerate(n.state);if(!e.complete)proofStopped=true;
    for(const p of e.placements){if(p.event.type==='T'||!S.canonicalClear(p.event))continue;const child=nodeFor(p,n,initial,n.rootIndex);if(admissible(child))next.push(child);}
   }
   const unique=new Map();for(const n of next){const key=nodeKey(n),prior=unique.get(key);if(!prior||compare(n,prior)<0)unique.set(key,n);}beam=diversify([...unique.values()],4);
  }
  preparationUnresolved=proofStopped&&!preparation;
 }
 const spendsReservedT=(p,parent=null)=>(preparation||preparationUnresolved)&&p.event.type==='T'&&p.event.lines===0&&!parent?.path.some(step=>step.event.type==='T'&&step.event.lines===2&&step.event.spin==='full');
 let frontier=qualify(root.placements.filter(p=>S.canonicalClear(p.event)&&!spendsReservedT(p)).map((p,i)=>nodeFor(p,null,initial,i)).filter(n=>n.notchValid));
 if(preparation){preparation=qualify([preparation])[0]??preparation;base.metrics.preparationProofLocks=preparation.path.length;}

 const cleanBest=nodes=>nodes.filter(n=>n.cycleDebt===0&&certifiedCavities(n)).sort(compare)[0]??null;
 let best=preparation??cleanBest(frontier);base.metrics.depth=best?best.path.length:0;base.metrics.completeDepth=root.complete&&best&&!stopped?1:0;
 let layer=diversify(frontier,width),comparisonLayer=frontier;
 for(let depth=2;depth<=maxDepth&&!stopped&&layer.length;depth++){
  const next=[],seen=new Map();let complete=true;
  for(const n of layer){if(!n.state.active)continue;expandedRoots.add(n.rootIndex);const e=enumerate(n.state);if(!e.complete)complete=false;
   for(const p of e.placements){if(!S.canonicalClear(p.event)||spendsReservedT(p,n))continue;const child=nodeFor(p,n,initial,n.rootIndex);if(!child.notchValid)continue;const key=nodeKey(child),prior=seen.get(key);if(!prior||compare(child,prior)<0)seen.set(key,child);}
   if(stopped)break;
  }
  next.push(...qualify([...seen.values()]));if(stopped)complete=false;if(next.length){const candidate=cleanBest(next);base.metrics.depth=Math.max(base.metrics.depth,depth);if(complete&&candidate){best=preparation&&depth<preparation.path.length?preparation:candidate;base.metrics.completeDepth=depth;comparisonLayer=next;}}
  layer=diversify(next,width);
 }
 if(cleanupCommitment&&(!best||!coversResourceGoal(best,cleanupCommitment)))best=cleanupCommitment;
 if(commitment){
  // The saved suffix may end at its goal while the fresh search already sees
  // another ordinary piece. Compare both choices at that same lock horizon,
  // reusing searched descendants of the exact saved proof rather than hiding
  // the fresh lookahead or inventing an unsearched continuation.
  const matchesSaved=n=>n.path.length>=commitment.path.length&&commitment.path.every((p,i)=>JSON.stringify(p.event)===JSON.stringify(n.path[i].event)&&sameObservedResult(p.state,n.path[i].state));
  let saved=commitment,fresh=best,replacement=false;
  if(fresh&&coversResourceGoal(fresh,commitment)&&fresh.path.length>saved.path.length){
   const candidates=comparisonLayer.filter(n=>n.path.length===fresh.path.length&&matchesSaved(n)&&n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport);
   const qualified=qualify(candidates).filter(n=>n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget');
   saved=qualified.sort(compare)[0]??saved;
  }
  if(fresh&&coversResourceGoal(fresh,commitment)&&fresh.path.length===saved.path.length&&fresh.assessment.maxHeight<20&&fresh.assessment.regionalSupport){
   qualify([fresh,saved]);
   const settled=n=>n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget';
   replacement=settled(fresh)&&settled(saved)&&compare(fresh,saved)<0;
  }
  base.metrics.commitmentComparison={freshGoalLocks:fresh?resourceGoalPrefix(fresh.path,commitment.path):null,savedGoalLocks:resourceGoalPrefix(commitment.path,commitment.path),
   freshHorizon:fresh?.path.length??null,savedHorizon:saved.path.length,replacement,
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
    ordinary=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(ordinary.state)},ordinary,initial,ordinary.rootIndex);
   }
   if(ordinary&&(ordinary.cycleDebt||!ordinary.notchValid||!certifiedCavities(ordinary)||JSON.stringify(ordinary.state.board)!==JSON.stringify(JSON.parse(candidate.continuation.at(-1).resultContext)[1])))ordinary=null;
   if(ordinary)best=ordinary;
  }
  if(!ordinary||ordinary.path.length!==candidate.continuation.length)continue;
  const mass=ordinary.state.board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0),cm=candidate.metrics.endpointMass;
  if(candidate.assessment.maxHeight<=ordinary.assessment.maxHeight&&cm<=mass&&(candidate.assessment.maxHeight<ordinary.assessment.maxHeight||cm<mass)){candidate.metrics.elapsedMs=now()-started;return candidate;}
 }
 if(!best)return{...base,status:stopped?'budget-exhausted':'no-supported-continuation-found',reason:stopped?'Search budget ended before an executable continuation was established.':'No canonical ST continuation preserving the recognized piece obligations was found in the checked moves; this is not proof that none exists.'};
 if(best.assessment.maxHeight>=20||!best.assessment.regionalSupport)return{...base,status:'no-supported-continuation-found',reason:'Checked continuations do not preserve the supported regional profile and headroom; no supported ST recommendation was established.',assessment:best.assessment};
 const first=best.path[0],verified=R.replay(s,first.witness);if(!verified.valid)return{...base,status:'invalid-witness',reason:'Internal witness validation failed; no advice is displayed.'};
 const tsdAt=best.path.findIndex(p=>p.event.spin==='full'&&p.event.lines===2);
 const tacticalReason=tsdAt>=0?`${holdPrompt(first)}${tsdAt===0?'Execute the T-spin double.':`This placement has a checked T-spin double within ${tsdAt+1} locks.`}`:
 `${holdPrompt(first)}${first.event.lines===0?'Place without clearing. ':'Place here. '}${best.assessment.right.entry?.status==='reachable-if-T-available'?'The checked endpoint preserves executable T-double entry when a T is available.':best.assessment.channel.openBelowStack?'The checked endpoint keeps column eight below the left/center stack.':'The checked endpoint needs a scoring-channel rebuild; its structure is uncertain.'}`;
 const facts=first.structuralEvidence;
 // Describe the selected executed sequence, not the union of hypothetical
 // pieces that could complete different center surfaces. Pair order matters.
 const orderedPartner=S.CENTER_PAIRS[first.event.type];
 const centerOnly=p=>p.event.cells.every(([x])=>x>=4&&x<=6);
 const cellKey=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
 let pairReason=null;
 if(centerOnly(first)&&first.event.lines===0&&orderedPartner){
  for(let i=1;i<best.path.length;i++){
   const next=best.path[i];
   if(next.event.lines!==0)break;
   if(next.event.cells.some(([x])=>x>=4&&x<=6)){
    const completion=facts.structure.center.completions.find(c=>c.piece===orderedPartner&&c.resultStatus==='level'&&cellKey(c.cells)===cellKey(next.event.cells));
    if(centerOnly(next)&&next.event.type===orderedPartner&&completion){
     facts.pairProgress={...facts.pairProgress,orderedPieces:[first.event.type,orderedPartner],step:1,status:'completed-in-checked-prefix',completionLock:i+1};
     next.structuralEvidence.pairFamily=first.event.type+orderedPartner;
     next.structuralEvidence.pairProgress={orderedPieces:[first.event.type,orderedPartner],step:2,status:'completed',preparationCells:first.event.cells,completionCells:next.event.cells};
     pairReason=`Place ${first.event.type} in the center to start an ${first.event.type}/${orderedPartner} pair. ${i===1?'The next '+orderedPartner:'The checked continuation’s '+orderedPartner} completes it.`;
    }
    break;
   }
  }
 }
 const leftFollow=best.path.slice(1);
 const capReason=facts.allocation==='right-cap-preparation'&&leftFollow.length&&leftFollow.every(p=>p.event.lines===0&&p.event.cells.every(([x])=>x<4))?`Reserve ${first.event.type} for the right cap. The checked continuation fills the left with ${leftFollow.map(p=>p.event.type).join(' then ')}.`:null;
 const structuralReason=pairReason||capReason||(facts.allocation==='horizontal-left-I'&&facts.structure.left.flat?'Keep the left region flat.':
  facts.allocation==='center-partner-preparation'?'Prepare the center surface; its next completion is not established by this checked prefix.':
  facts.allocation==='center-completion'?(new Set(facts.structure.center.profile).size===1?'Complete a level center surface.':'Advance the center into a supported preparation surface.'):
  facts.allocation==='quad-preparation'?'Prepare the right-side I cleanup while keeping column eight open.':
  facts.allocation==='right-cap-preparation'?'Rebuild the right scoring structure.':
  facts.allocation==='left-filler'?'Build the left region without crossing into the center.':null);
 const reason=structuralReason?`${holdPrompt(first)}${structuralReason} ${tacticalReason.replace(/^Hold (?:first|twice)\. /,'')}`:tacticalReason;
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,reason,
 continuation:best.path.map(p=>({target:p.target,hold:p.hold,holdCount:holdCount(p),witness:p.witness,event:p.event,resultContext:context(p.state),structuralEvidence:p.structuralEvidence})),
 evidence:{strategy:'canonical-right-ST',cycleResources:cycleResources(best.path),commitmentRetained:best===commitment,futureNotches:best.notches,preparationProof:preparation&&preparation.path.every((p,i)=>best.path[i]&&p.event.type===best.path[i].event.type&&p.event.lines===best.path[i].event.lines&&p.event.spin===best.path[i].event.spin&&JSON.stringify(p.state.board)===JSON.stringify(best.path[i].state.board)&&p.state.hold===best.path[i].state.hold&&JSON.stringify(p.state.queue)===JSON.stringify(best.path[i].state.queue))?{kind:preparationKind,locks:preparation.path.length,claim:'Executed preparation preserves an available T for a checked double.'}:null,cycleDebt:best.cycleDebt,cavityRepair:{status:'verified-prefix-repaired',outstandingCells:best.cavityDebt},clearPolicy:'right-region full T-spin doubles and I tetrises only',verifiedLocks:best.path.length,tsdAt:tsdAt>=0?tsdAt+1:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:root.complete,budgetExhausted:stopped,informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:best.assessment.regionalSupport,channel:best.assessment.channel,endpointTEntry:best.assessment.right.entry?.status??'not-established',unresolvedObligations:best.assessment.obligations,structuralScore:best.structuralScore,structuralRank:best.rank,structure:best.assessment.structure,dependencyDebt:best.dependencyDebt,claim:'Finite executable prefix; endpoint estimates are not a sustainability guarantee.'},assessment:best.assessment};
}
// Keep a committed target through an exactly followed input, including HOLD.
// The entire remaining prefix is replayed from the new observation, so a newly
// revealed piece cannot silently preserve an obsolete proof.
function advance(raw,previous,action){
 if(previous?.evidence?.cycleDebt>0)return null;
 if(!previous?.target||action==='HD'||previous.witness?.[0]!==action)return null;
 let state;try{state=observe(raw);}catch{return null;}
 if(R.validate(state).length||(state.bag&&B.validate(state.bag).length))return null;
 const witness=previous.witness.slice(1);if(!witness.length)return null;
 const steps=previous.continuation.map((step,i)=>({...step,witness:i?step.witness:witness,hold:i?step.hold:witness.includes('HOLD'),holdCount:i?holdCount(step):witness.filter(a=>a==='HOLD').length}));
 let current=state,notches=S.notchPattern(state.board);for(const step of steps){const replay=R.replay(current,step.witness);
  if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;
  const check=S.advanceNotches(current.board,{event:replay.events[0],state:replay.state},notches);if(!check.valid)return null;notches=check.pattern;
  current=replay.state;
 }
 if(!repairedPrefix(state,steps))return null;
 return{...previous,revision:state.revision,context:context(state),witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,continuation:steps,
  reason:holdPrompt({witness})+previous.reason.replace(/^Hold (?:first|twice)\. /,''),retained:true,
  evidence:{...previous.evidence,knownPieceHorizon:state.queue.length+1}};
}
function revalidate(raw,previous,options={}){
 let s;try{s=observe(raw);}catch{return null;}if(previous?.evidence?.cycleDebt>0||previous?.continuation?.some(p=>!S.canonicalClear(p.event)))return null;if(!previous?.target||context(s)!==previous.context||R.validate(s).length)return null;
 const enumeration=R.placements(s,{maxNodes:options.maxNodes??8000,deadline:options.deadline,now:options.now});
 const p=enumeration.placements.find(p=>S.canonicalClear(p.event)&&holdCount(p)===holdCount(previous)&&JSON.stringify(p.target)===JSON.stringify(previous.target)&&p.event.spin===previous.continuation?.[0]?.event.spin&&p.event.lines===previous.continuation?.[0]?.event.lines);
 if(!p)return null;
 const continuation=[{...previous.continuation[0],target:p.target,hold:p.hold,holdCount:holdCount(p),witness:p.witness,event:p.event},...previous.continuation.slice(1)];
 let current=s,notches=S.notchPattern(s.board);for(const step of continuation){const replay=R.replay(current,step.witness);if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;const check=S.advanceNotches(current.board,{event:replay.events[0],state:replay.state},notches);if(!check.valid)return null;notches=check.pattern;current=replay.state;}
 if(!repairedPrefix(s,continuation))return null;
 return{...previous,revision:s.revision,hold:p.hold,holdCount:holdCount(p),witness:p.witness,continuation,metrics:{...previous.metrics,revalidationNodes:enumeration.visited},retained:true};
}
return Object.freeze({observe,assess,plan,revalidate,advance,cavityRepairDebt,continueCommitment,cycleResources,resourceGoalPrefix,centerReservationStep});
});
