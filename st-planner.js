/* Milestone-one finite-information coach. No fixture IDs, seeds or hidden queues. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js'),require('./st-structure.js')):factory(root.STRules,root.STBag,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,S){
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
function context(s){return JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);}
function stateKey(s){return JSON.stringify([s.rules,s.board,s.active,s.hold,s.canHold,s.queue,s.bag??null]);}
function extendForced(state){if(!state.bag)return state;const t=B.forcedNext(state.bag);if(!t)return state;return {...state,queue:[...state.queue,t],bag:B.consume(state.bag,t)};}
function compare(a,b){for(let i=0;i<a.rank.length;i++)if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];return a.key.localeCompare(b.key);}
function nodeFor(p,parent,initial,rootIndex){
 const assessment=assess(p.state.board),path=[...(parent?.path??[]),p];
 const structure=S.assess(p.state),before=parent?.state??initial.state;
 const transition=S.transition(before,p,structure);
 // A crossing placement is not forbidden. Track its outstanding dependency,
 // rather than rewarding a short tactical event regardless of the rebuild.
 const dependencyDebt=Math.max(0,(parent?.dependencyDebt??0)+transition.dependencyDebt);
 const priorAssessment=parent?.assessment??initial;
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
 p.structuralEvidence={...transition,centerPartnerDeficitBefore:(parent?.assessment??initial).center.partnerDeficit,centerPartnerDeficitAfter:assessment.center.partnerDeficit,placedPiece:p.event.type,structure,dependencyDebt,entryDebt,nonclearScoringGeometryLost:losesEntry};
 // Nearby structural estimates are deliberately comparable. The finite
 // executable TSD then breaks ties; it cannot buy a poorer structural band.
 const cycleDebt=(parent?.cycleDebt??0)+transition.cycleViolations.length;
 const rank=[safe?1:0,assessment.regionalSupport?1:0,cycleDebt?-cycleDebt:0,Math.floor(structuralScore/4),tsds*2,-path.reduce((n,v)=>n+v.witness.length+holdCount(v)*2,0),path.reduce((n,v)=>n+v.event.lines,0)];
 return{state:p.state,path,assessment,rank,structuralScore,dependencyDebt,entryDebt,cycleDebt,baseEstimateRank:rank[4],qualified:!assessment.right.slots.length,rootIndex,key:JSON.stringify(path[0].target)+':'+holdCount(path[0])};
}
function diversify(nodes,width){const sorted=[...nodes].sort(compare),chosen=[],roots=new Set(),groups=new Set();
 // Protect meaningfully different construction families, not just top-scoring
 // near-identical surfaces. This is diversity, not a canned move template.
 for(const n of sorted){const first=n.path[0],g=[first.target.type,holdCount(first),n.assessment.right.slots.length>0].join(':');if(!groups.has(g)){chosen.push(n);roots.add(n.rootIndex);groups.add(g);if(chosen.length===width)return chosen;}}
 for(const n of sorted)if(!roots.has(n.rootIndex)){chosen.push(n);roots.add(n.rootIndex);if(chosen.length===width)return chosen;}
 const keys=new Set(chosen.map(n=>stateKey(n.state)));for(const n of sorted)if(!keys.has(stateKey(n.state))){chosen.push(n);keys.add(stateKey(n.state));if(chosen.length===width)break;}return chosen;}
function plan(raw,options={}){
 const started=Date.now(),now=options.now??(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 let s;try{s=observe(raw);}catch(e){return{status:'invalid-input',revision:raw?.revision??0,target:null,reason:'The supplied observation is not valid.',errors:[e.message]};}
 const errors=R.validate(s);if(s.bag)errors.push(...B.validate(s.bag));
 const base={revision:s.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],reason:'',metrics:{nodes:0,roots:0,rootExpanded:0,depth:0,completeDepth:0,elapsedMs:0},context:context(s)};
 if(errors.length)return{...base,status:errors.includes('unsupported-profile')?'unsupported-profile':'invalid-input',reason:errors.join('; '),errors};
 if(s.topOut)return{...base,status:'no-supported-continuation-found',reason:'This position has topped out under the selected rules.'};
 if(!s.active)return{...base,status:'insufficient-known-pieces',reason:'No active piece is available in this observation.'};
 if(s.board.every(r=>r==='..........'))return{...base,status:'unsupported-position',reason:'Opening construction is outside milestone one. Choose an established-stack fixture.'};
 const initial=assess(s.board);initial.state=s;
 if(!initial.maintenanceScope)return{...base,status:'unsupported-position',reason:initial.left.height<2||initial.center.height<3?'This stack is below the established-stack maintenance profile. Choose another fixture or rebuild manually; opening construction is not coached.':'This position is outside the initial right-hand ST maintenance profile: established left/center stack and lower column-eight scoring channel required.',assessment:initial};
 const limit=options.maxNodes??45000,maxDepth=options.depth??3,width=options.width??8,expandedRoots=new Set(),accessCache=new Map();let stopped=false;
 base.metrics.accessNodes=0;
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
   if(!access){access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline,now});base.metrics.accessNodes+=access.visited;base.metrics.nodes+=access.visited;if(access.complete)accessCache.set(key,access);else stopped=true;}
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
 const enumerate=state=>{const remaining=limit-base.metrics.nodes;if(remaining<=0||now()>=deadline){stopped=true;return{placements:[],complete:false};}const r=R.placements(state,{allowHold:options.allowHold!==false,maxNodes:remaining,deadline,now});base.metrics.nodes+=r.visited;if(!r.complete)stopped=true;const caps=S.geometry(state.board).right.completions;const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));const availableCap=r.placements.some(p=>p.event.type==='Z'&&caps.some(c=>sameCells(p.event.cells,c.cells)));for(const p of r.placements)p.availableCap=availableCap;
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
    const access=R.tDoubleAccess(held.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline,now});
    base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
    if(!access.complete){preparationUnresolved=true;continue;}
    if(!access.reachable)continue;
    const witness=['HOLD',...access.witness],t=R.replay(z.state,witness);
    if(!t.valid||t.events.length!==1||!S.canonicalClear(t.events[0])||t.events[0].lines!==2||t.state.topOut)continue;
    const second={target:z.events[0].target,hold:false,holdCount:0,witness:cap.witness.slice(),state:z.state,event:z.events[0],availableCap:true};
    const third={target:t.events[0].target,hold:true,holdCount:1,witness,state:t.state,event:t.events[0]};
    let n=nodeFor(first,null,initial,i);n=nodeFor(second,n,initial,i);n=nodeFor(third,n,initial,i);
    if(n.cycleDebt===0&&n.assessment.regionalSupport&&n.assessment.maxHeight<20)preparation=n;
   }
  }
 }
 const spendsReservedT=p=>(preparation||preparationUnresolved)&&p.event.type==='T'&&p.event.lines===0;
 let frontier=qualify(root.placements.filter(p=>S.canonicalClear(p.event)&&!spendsReservedT(p)).map((p,i)=>nodeFor(p,null,initial,i)));
 if(preparation){preparation=qualify([preparation])[0]??preparation;base.metrics.preparationProofLocks=3;}

 const cleanBest=nodes=>nodes.filter(n=>n.cycleDebt===0).sort(compare)[0]??null;
 let best=preparation??cleanBest(frontier);base.metrics.depth=best?best.path.length:0;base.metrics.completeDepth=root.complete&&best&&!stopped?1:0;
 let layer=diversify(frontier,width);
 for(let depth=2;depth<=maxDepth&&!stopped&&layer.length;depth++){
  const next=[],seen=new Map();let complete=true;
  for(const n of layer){if(!n.state.active)continue;expandedRoots.add(n.rootIndex);const e=enumerate(n.state);if(!e.complete)complete=false;
   for(const p of e.placements){if(!S.canonicalClear(p.event))continue;const child=nodeFor(p,n,initial,n.rootIndex),key=stateKey(child.state),prior=seen.get(key);if(!prior||compare(child,prior)<0)seen.set(key,child);}
   if(stopped)break;
  }
  next.push(...qualify([...seen.values()]));if(stopped)complete=false;if(next.length){const candidate=cleanBest(next);base.metrics.depth=Math.max(base.metrics.depth,depth);if(complete&&candidate){best=preparation&&depth<preparation.path.length?preparation:candidate;base.metrics.completeDepth=depth;}}
  layer=diversify(next,width);
 }
 if(now()>=deadline)stopped=true;
 base.metrics.rootExpanded=expandedRoots.size;base.metrics.elapsedMs=Date.now()-started;
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
 evidence:{strategy:'canonical-right-ST',preparationProof:preparation?{kind:'visible-I-Z-held-T',locks:3,claim:'Executed preparation preserves the current T for a checked double.'}:null,cycleDebt:best.cycleDebt,clearPolicy:'right-region full T-spin doubles and I tetrises only',verifiedLocks:best.path.length,tsdAt:tsdAt>=0?tsdAt+1:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:root.complete,budgetExhausted:stopped,informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:best.assessment.regionalSupport,channel:best.assessment.channel,endpointTEntry:best.assessment.right.entry?.status??'not-established',unresolvedObligations:best.assessment.obligations,structuralScore:best.structuralScore,structuralRank:best.rank,structure:best.assessment.structure,dependencyDebt:best.dependencyDebt,claim:'Finite executable prefix; endpoint estimates are not a sustainability guarantee.'},assessment:best.assessment};
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
 let current=state;for(const step of steps){const replay=R.replay(current,step.witness);
  if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;
  current=replay.state;
 }
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
 let current=s;for(const step of continuation){const replay=R.replay(current,step.witness);if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;current=replay.state;}
 return{...previous,revision:s.revision,hold:p.hold,holdCount:holdCount(p),witness:p.witness,continuation,metrics:{...previous.metrics,revalidationNodes:enumeration.visited},retained:true};
}
return Object.freeze({observe,assess,plan,revalidate,advance});
});
