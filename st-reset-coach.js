/* Separate, bounded Reset coach. A sustainable public prefix is not a promise
 * about an unseen bag. Completion is exclusively two actual Left zero-clear Ts. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-access'),require('./st-resource-provider'),require('./st-obligation-resources'),require('./st-reset-policy'),require('./st-left-context'),()=>require('./st-left-routes')):factory(root.STRules,root.STStructure,root.STAccess,root.STResourceProvider,root.STObligationResources,root.STResetPolicy,root.STLeftContext,()=>root.STLeftRoutes);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResetCoach=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,A,Provider,M,Q,L,getLR){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
function entry(raw,options){
 const input=Provider.prepare(raw,options),decision=Q.consider(raw,input.facts);
 if(input.status!=='available'||!['candidate','active'].includes(decision.status))return{decision,summary:input.facts};
 const frame=decision.status==='active'?input.frame:Provider.projectBeginReset(input.frame,{candidate:true}),summary=Provider.facts(frame);
 // Reset uses only its literal observed supply. Unlike ordinary maintenance,
 // its historical search never appended a forced tail to the placement queue.
 return summary.reset?.status==='active'?{decision,frame,summary,resource:Provider.startRoute(frame,{horizon:7,extendForced:false})}:{decision};
}
// Same bounded literal I-then-cap witness used by ordinary policyWitnesses.
// Reset preserves cleanup-before-cap, not ordinary cap urgency on every filler.
const cleanupCache=new WeakMap();
function cleanupAvailable(state,allowHold){
 const key=allowHold!==false;if(cleanupCache.get(state)?.has(key))return cleanupCache.get(state).get(key);
 const starts=[state];if(key){let held=state;for(let i=0;i<2;i++){const next=R.move(held,'HOLD');if(next===held||next.topOut)break;starts.push(next);held=next;}}
 let found=false;
 if(S.geometry(state.board).right.cycle.prepareColumn!==null)for(const root of starts){
  if(root.active?.type!=='I')continue;let cur=root;
  for(let i=0;i<4&&cur.active.rotation!==1;i++){const next=R.move(cur,'CW');if(next===cur)break;cur=next;}
  while(cur.active.x!==7){const next=R.move(cur,cur.active.x<7?'R':'L');if(next===cur)break;cur=next;}
  if(cur.active.rotation!==1||cur.active.x!==7)continue;
  const placed=R.move(cur,'HD');if(placed===cur||S.transition(state,{state:placed,event:placed.lastEvent}).allocation!=='quad-preparation')continue;
  const candidates=[placed];if(key)candidates.push(R.move(placed,'HOLD'));
  if(candidates.some(z=>z.active?.type==='Z'&&!z.topOut&&S.geometry(z.board).right.completions.some(c=>{const r=R.replay(z,c.witness);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&JSON.stringify(r.events[0].cells)===JSON.stringify(c.cells);}))) {found=true;break;}
 }
 if(!cleanupCache.has(state))cleanupCache.set(state,new Map());cleanupCache.get(state).set(key,found);return found;
}
// Resolve the actually consumed identity through literal HOLD actions. A
// schedule's chosen S instance cannot authorize a different same-letter token.
function placedIdentity(resource,witness){let active=resource.active,hold=resource.hold,queue=resource.queue.slice();for(const action of witness)if(action==='HOLD'){if(hold){const old=active;active=hold;hold=old;}else{hold=active;active=queue.shift()||null;}}return active;}
function routeCompare(a,b){return getLR().compare(a.leftRoutes||[],b.leftRoutes||[]);}
function transition(n,p){
 const e=p.event;if(e.topOut||p.state.topOut||!S.canonicalClear(e)||e.cells.some(([x])=>x>=7)&&!'ZTI'.includes(e.type))return null;
 if(e.type==='T'&&!Q.qualifies(e))return null;
 const phase=S.advanceNotches(n.state.board,p,n.notches);if(!phase.valid)return null;
 const geom=S.geometry(p.state.board,{notches:phase.pattern});
 if(Math.max(...geom.left.profile,...geom.center.profile,...geom.right.profile)>=20)return null;
 if(S.cavityRepairDebt(S.cavityFacts(n.state.board),S.cavityFacts(p.state.board),e).length)return null;
 const structural=S.transition(n.state,{...p,availableCleanupPreparation:cleanupAvailable(n.state,n.allowHold)},undefined,{notches:n.notches});
 if(structural.cycleViolations.some(v=>!(Q.qualifies(e)&&v==='spent-scoring-T-without-double')))return null;
 let resource;try{resource=M.step(n.state,p,n.resource);}catch{return null;}
 if(resource.violations.length||M.resetLosesObligation(n.resource,resource))return null;
 const path=[...n.path,{witness:p.witness.slice(),event:clone(e),target:clone(e.target),hold:p.witness.includes('HOLD'),structuralEvidence:structural}];
 const score=L.evaluate(p.state,{resources:resource}).score;
 const leftRoutes=n.leftRouteRoot?.routes.length?getLR().advance(n.leftRouteRoot,n.leftRoutes,n.state,p,placedIdentity(n.resource,p.witness)):[];
 return{state:p.state,allowHold:n.allowHold,notches:phase.pattern,resource,path,score:score+geom.supportEstimate,done:resource.resetCompleted,leftRouteRoot:n.leftRouteRoot,leftRoutes};
}
// Replay supplied movement-access witnesses rather than enumerate on the UI
// thread. Every newly roofed cell must be covered by an actual legal witness.
function replayAccess(raw,path,proofs,{deadline,now,maxNodes}){
 let state=R.createState(raw),notches=S.notchPattern(raw.board),visited=0;const records=[];
 for(const [index,p]of path.entries()){
  const r=R.replay(state,p.witness),phase=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},notches),cells=A.newlyCovered(state.board,r.state.board,r.events[0],phase.pattern),missing=new Set(cells.map(c=>c.join(',')));
  const witnesses=proofs?.[index]?.witnesses||[];
  for(const w of witnesses){
   if(!Array.isArray(w.witness)||w.witness.length>256||w.witness.includes('HOLD')||typeof w.piece!=='string'||w.piece.length!==1||!'IJLOSTZ'.includes(w.piece))return{reachable:false,visited};
   if(visited+w.witness.length>maxNodes||now()>=deadline)return{reachable:null,visited};visited+=w.witness.length;
   const start=R.createState({rules:raw.rules,board:r.state.board,active:w.piece,queue:['I']}),replay=R.replay(start,w.witness);
   if(!replay.valid||replay.events.length!==1||replay.events[0].type!==w.piece)return{reachable:false,visited};
   for(const c of replay.events[0].cells)missing.delete(c.join(','));
  }
  if(missing.size)return{reachable:false,visited};records.push({cells,witnesses:clone(witnesses),reachable:true});state=r.state;notches=phase.pattern;
 }
 return{reachable:true,visited,steps:records,status:'replayed-movement-access-witnesses'};
}
function check(raw,steps,options={}){return checkEntry(raw,steps,options,entry(raw,options));}
function checkEntry(raw,steps,options,start){
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??45000;
 if(!start.resource)return{valid:false,reason:'reset-not-admitted',visited:0};
 if(!Array.isArray(steps)||!steps.length||steps.length>7||steps.some(p=>!Array.isArray(p.witness)||p.witness.length>256||options.allowHold===false&&p.witness.includes('HOLD')))return{valid:false,reason:'reset-prefix-limit',visited:0};
 let n={state:R.createState(raw),allowHold:options.allowHold!==false,notches:S.notchPattern(raw.board),resource:start.resource,path:[],leftRouteRoot:start.leftRouteRoot,leftRoutes:start.leftRouteRoot?.progress||[]},visited=0;
 for(const [i,step]of steps.entries()){
  if(now()>=deadline||visited+(step.witness?.length||0)>limit)return{valid:false,reason:'reset-validation-budget',visited};visited+=step.witness?.length||0;
  const r=R.replay(n.state,step.witness);if(!r.valid||r.events.length!==1||step.event&&JSON.stringify(step.event)!==JSON.stringify(r.events[0]))return{valid:false,reason:'reset-witness-mismatch',visited};
  const next=transition(n,{state:r.state,event:r.events[0],witness:step.witness});if(!next||next.done&&i!==steps.length-1)return{valid:false,reason:'reset-transition-invalid',visited};n=next;
 }
 const inherited=new Set((start.frame.state.account.reset.inheritedCovered||[]).map(c=>c.join(','))),resetDebt=(start.summary.coveredRepair?.cells||[]).filter(c=>!inherited.has(c.join(',')));
 const repair=A.repairPrefix(raw,n.path,{notches:S.notchPattern(raw.board),initialDebt:resetDebt,stages:start.summary.center?.pending});
 if(!repair.valid)return{valid:false,reason:repair.status,visited};
 const bounds={deadline,now,maxNodes:Math.max(0,limit-visited)},access=options.accessProof?replayAccess(raw,n.path,options.accessProof.steps,bounds):A.prefix(raw,n.path,bounds);visited+=access.visited;
 if(access.reachable!==true||now()>=deadline||visited>limit)return{valid:false,reason:access.status,visited};
 return{valid:true,visited,node:n,start,access,repair};
}
function advice(raw,verified,metrics={}){
 const n=verified.node,first=n.path[0],progress=verified.start.summary.reset.progress;
 return{revision:raw.revision??0,status:'recommended-placement',target:first.target,witness:first.witness,hold:first.hold,holdCount:first.witness.filter(a=>a==='HOLD').length,continuation:n.path,context:context(raw),
  reason:Q.qualifies(first.event)?`Reset: place T ${progress+1} of 2 wholly in Left without clearing lines.`:'Reset: keep the stack playable while waiting for the remaining Left T placement.',
  recommendation:{kind:'supported',hazards:[],claim:'Checked finite public prefix; unseen supply and indefinite survival are not promised.'},
  metrics:{nodes:verified.visited,roots:0,rootExpanded:0,depth:n.path.length,completeDepth:0,elapsedMs:0,certifiedHorizon:n.path.length,...metrics},
  evidence:{strategy:'reset-coach',budgetExhausted:Boolean(metrics.budgetExhausted),resetSelection:verified.start.decision,reset:{progress,projectedProgress:n.resource.resetProgress,completion:'second-actual-Left-zero-clear-T',entry:verified.start.decision.status==='candidate'},verifiedLocks:n.path.length,knownPieceHorizon:raw.queue.length+1,cycleDebt:0,gapAccess:verified.access,coveredRepair:verified.repair,resourceObligations:{status:'checked',remainingZ:n.resource.extraZRemaining,pendingCenter:clone(n.resource.pendingCenter),hangingS:clone(n.resource.hangingS),hangingL:clone(n.resource.hangingL),unclassifiedS:clone(n.resource.unclassifiedS),unclassifiedL:clone(n.resource.unclassifiedL),uncertainty:clone(n.resource.uncertainty)},claim:'Reset completes on the second qualifying actual T lock. Midgame then owns rebuilding.'}};
}
function plan(raw,options={}){
 const start=entry(raw,options);if(!start.resource){
  if(start.summary?.reset?.status!=='active')return null;
  return{revision:raw.revision??0,target:null,witness:[],continuation:[],status:'no-supported-continuation-found',context:context(raw),reason:`Reset is observed, but no supported Reset advice is available. ${start.decision.reason}`,metrics:{nodes:0,elapsedMs:0},evidence:{strategy:'reset-coach',resetSelection:start.decision,reset:{progress:start.summary.reset.progress},budgetExhausted:false}};
 }
 const now=options.now||(()=>Date.now()),began=now(),deadline=options.deadline??(began+(options.timeMs??750)),limit=options.maxNodes??45000;
 const base={revision:raw.revision??0,target:null,witness:[],continuation:[],status:'no-supported-continuation-found',context:context(raw),reason:'No sustainable Reset prefix was certified within the public supply and budget.',metrics:{nodes:0,elapsedMs:0},evidence:{strategy:'reset-coach',resetSelection:start.decision,reset:{progress:start.summary.reset.progress},budgetExhausted:false}};
 // Entry remains the only authority for Reset, including its T exception.
 // Query literal observed supply once; unfinished/no-match lookup stays neutral.
 if(!options.disableContourRoutes&&limit>0&&now()<deadline)start.leftRouteRoot=getLR().prepare(raw,{coach:'reset',resources:start.resource,allowHold:options.allowHold!==false});
 const contourMetrics=start.leftRouteRoot?{...start.leftRouteRoot.stats,selected:false}:null;
 let visited=0,beam=[{state:R.createState(raw),allowHold:options.allowHold!==false,resource:start.resource,notches:S.notchPattern(raw.board),path:[],leftRouteRoot:start.leftRouteRoot,leftRoutes:start.leftRouteRoot?.progress||[]}],best=null;
 const maxDepth=Math.min(7,Math.max(1,options.depth??(raw.queue.length+1+(raw.hold?1:0)))),width=Math.min(8,Math.max(1,options.width??4));
 for(let depth=0;depth<maxDepth&&beam.length;depth++){
  const next=[];
  for(const n of beam){
   if(now()>=deadline||visited>=limit)break;
   const enumeration=R.placements(n.state,{allowHold:options.allowHold!==false,maxNodes:Math.max(0,limit-visited),deadline,now});visited+=enumeration.visited;
   for(const p of enumeration.placements){if(now()>=deadline||visited>=limit)break;const node=transition(n,p);if(node)next.push(node);}
  }
  next.sort((a,b)=>b.resource.resetProgress-a.resource.resetProgress||b.score-a.score||routeCompare(a,b)||a.path.length-b.path.length||a.path[0].witness.length-b.path[0].witness.length);
  // Certify before spending the rest of the beam budget. A validated incumbent
  // survives incomplete deeper exploration; no unchecked fallback is admitted.
  // Beam width limits expansion, not certification of already-enumerated
  // candidates. Failed proofs must not hide a lower-ranked valid incumbent.
  for(const n of next){
   if(now()>=deadline||visited>=limit)break;
   if(best&&(n.resource.resetProgress<best.node.resource.resetProgress||n.resource.resetProgress===best.node.resource.resetProgress&&(n.score<best.node.score||n.score===best.node.score&&routeCompare(n,best.node)>=0)))continue;
   const verified=checkEntry(raw,n.path,{...options,deadline,now,maxNodes:Math.max(0,limit-visited)},start);visited+=verified.visited;
   if(verified.valid){best=verified;if(n.done)break;}
  }
  if(best?.node.done)break;
  const seen=new Set();beam=next.filter(n=>{if(n.done)return false;const key=JSON.stringify([n.state.board,n.state.active,n.state.hold,n.state.queue,M.binding(n.resource),getLR().key(n.leftRoutes)]);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,width);
 }
 if(contourMetrics)contourMetrics.selected=Boolean(best?.node.leftRoutes.some(p=>p.complete));
 base.metrics={nodes:visited,elapsedMs:now()-began,...(contourMetrics?{contourRoutes:contourMetrics}:{})};base.evidence.budgetExhausted=now()>=deadline||visited>=limit;
 return best?advice(raw,best,{...base.metrics,budgetExhausted:base.evidence.budgetExhausted}):base;
}
function retain(raw,previous,options={},action=null){
 if(previous?.evidence?.strategy!=='reset-coach'||!previous.target||!Array.isArray(previous.evidence.gapAccess?.steps))return null;
 const steps=clone(previous.continuation||[]);if(action!==null){if(previous.witness?.[0]!==action||action==='HD')return null;steps[0].witness=previous.witness.slice(1);}
 const checked=check(raw,steps,{...options,accessProof:previous.evidence.gapAccess});if(options.budgetTracker)options.budgetTracker.nodes+=checked.visited;
 return checked.valid?{...advice(raw,checked),retained:true}:null;
}
function continuation(before,after,previous,event,options={}){
 if(previous?.evidence?.strategy!=='reset-coach'||previous.continuation?.length<2||!Array.isArray(previous.evidence.gapAccess?.steps))return null;
 const replay=R.replay(before,previous.witness);
 if(!replay.valid||replay.events.length!==1||JSON.stringify(replay.events[0])!==JSON.stringify(event)||JSON.stringify(replay.state.board)!==JSON.stringify(after.board)||replay.state.active?.type!==after.active?.type||replay.state.hold!==after.hold||!replay.state.queue.every((t,i)=>after.queue[i]===t))return null;
 const steps=previous.continuation.slice(1),first=steps[0];
 return retain(after,{...previous,target:first.target,witness:first.witness,continuation:steps,evidence:{...previous.evidence,gapAccess:{...previous.evidence.gapAccess,steps:previous.evidence.gapAccess.steps.slice(1)}}},options);
}
return Object.freeze({plan:(...args)=>R.withCoachNoClear(()=>M.discloseAdvice(plan(...args))),check,retain:(...args)=>M.discloseAdvice(retain(...args)),continuation:(...args)=>M.discloseAdvice(continuation(...args)),consider:Q.consider});
});
