/* Milestone-one finite-information coach. No fixture IDs, seeds or hidden queues. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js')):factory(root.STRules,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
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
 let sealed=0,covered=0,leftSealed=0;for(let x=0;x<10;x++)for(let y=40-heights[x];y<40;y++)if(board[y][x]==='.'){covered++;if(!air.has(y*10+x)){sealed++;if(x<7)leftSealed++;}}
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
 return {maintenanceScope,regionalSupport,regionImbalance,channel:{column:7,height:heights[7],openBelowStack:heights[7]<=Math.min(leftHeight,centerHeight)-2},heights,maxHeight,headroom:20-maxHeight,sealed,leftSealed,covered,left:{height:leftHeight,roughness},center:{height:centerHeight,profile:center,partnerDeficit,partnerStatus:partnerDeficit?'unfinished-open-surface':'level-surface'},right:{height:rightHeight,slots:uniqueSlots},
  obligations:uniqueSlots.map(s=>({kind:'T-slot',demands:['T'],status:'unresolved',at:[s.x,s.y],note:'Geometric slot; arrival and executable entry not yet proved.'})).concat(partnerDeficit?[{kind:'center-partner',demands:[],openSurfaceCells:partnerDeficit,status:'unresolved',note:'Uneven center surface, not a requirement to fill every gap; compatible piece identity must be established by a checked continuation, not guessed from a silhouette.'}]:[]),
  estimate:-leftSealed*12-(sealed-leftSealed)*2-covered-roughness*1.3-imbalance*4-regionImbalance*4-maxHeight*.3,
  assumptions:['Structural estimates are heuristic; only the returned input prefix is verified.']};
}
function context(s){return JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);}
function stateKey(s){return JSON.stringify([s.rules,s.board,s.active,s.hold,s.canHold,s.queue,s.bag??null]);}
function extendForced(state){if(!state.bag)return state;const t=B.forcedNext(state.bag);if(!t)return state;return {...state,queue:[...state.queue,t],bag:B.consume(state.bag,t)};}
function compare(a,b){for(let i=0;i<a.rank.length;i++)if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];return a.key.localeCompare(b.key);}
function nodeFor(p,parent,initial,rootIndex){const assessment=assess(p.state.board),path=[...(parent?.path??[]),p],tsds=path.filter(v=>v.event.spin==='full'&&v.event.lines===2).length;
 const damage=Math.max(0,assessment.leftSealed-initial.leftSealed),safe=assessment.maxHeight<20&&!p.event.topOut;
 // Top-out cannot be bought with points. Cavity costs are endpoint heuristics,
 // not hard gates: ST reservoir vacancies may be repaid by later cleanup.
 p.structuralEvidence={centerPartnerDeficitBefore:(parent?.assessment??initial).center.partnerDeficit,centerPartnerDeficitAfter:assessment.center.partnerDeficit,placedPiece:p.event.type};
 const rank=[safe?1:0,assessment.regionalSupport?1:0,tsds>0?1:0,assessment.estimate-damage*4, -path.reduce((n,v)=>n+v.witness.length+(v.hold?2:0),0),path.reduce((n,v)=>n+v.event.lines,0)];
 return{state:p.state,path,assessment,rank,baseEstimateRank:rank[3],qualified:!assessment.right.slots.length,rootIndex,key:JSON.stringify(path[0].target)+':'+path[0].hold};}
function diversify(nodes,width){const sorted=[...nodes].sort(compare),chosen=[],roots=new Set(),groups=new Set();
 // Protect meaningfully different construction families, not just top-scoring
 // near-identical surfaces. This is diversity, not a canned move template.
 for(const n of sorted){const first=n.path[0],g=[first.target.type,first.hold,n.assessment.right.slots.length>0].join(':');if(!groups.has(g)){chosen.push(n);roots.add(n.rootIndex);groups.add(g);if(chosen.length===width)return chosen;}}
 for(const n of sorted)if(!roots.has(n.rootIndex)){chosen.push(n);roots.add(n.rootIndex);if(chosen.length===width)return chosen;}
 const keys=new Set(chosen.map(n=>stateKey(n.state)));for(const n of sorted)if(!keys.has(stateKey(n.state))){chosen.push(n);keys.add(stateKey(n.state));if(chosen.length===width)break;}return chosen;}
function plan(raw,options={}){
 const started=Date.now(),now=options.now??(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 let s;try{s=observe(raw);}catch(e){return{status:'invalid-input',revision:raw?.revision??0,target:null,reason:'The supplied observation is not valid.',errors:[e.message]};}
 const errors=R.validate(s);if(s.bag)errors.push(...B.validate(s.bag));
 const base={revision:s.revision,target:null,hold:false,witness:[],continuation:[],reason:'',metrics:{nodes:0,roots:0,rootExpanded:0,depth:0,completeDepth:0,elapsedMs:0},context:context(s)};
 if(errors.length)return{...base,status:errors.includes('unsupported-profile')?'unsupported-profile':'invalid-input',reason:errors.join('; '),errors};
 if(s.topOut)return{...base,status:'no-supported-continuation-found',reason:'This position has topped out under the selected rules.'};
 if(!s.active)return{...base,status:'insufficient-known-pieces',reason:'No active piece is available in this observation.'};
 if(s.board.every(r=>r==='..........'))return{...base,status:'unsupported-position',reason:'Opening construction is outside milestone one. Choose an established-stack fixture.'};
 const initial=assess(s.board);
 if(!initial.maintenanceScope)return{...base,status:'unsupported-position',reason:initial.left.height<2||initial.center.height<3?'This stack is below the established-stack maintenance profile. Choose another fixture or rebuild manually; opening construction is not coached.':'This position is outside the initial right-hand ST maintenance profile: established left/center stack and lower column-eight scoring channel required.',assessment:initial};
 const limit=options.maxNodes??45000,maxDepth=options.depth??3,width=options.width??8,expandedRoots=new Set(),accessCache=new Map();let stopped=false;
 base.metrics.accessNodes=0;
 const optimistic=n=>({...n,rank:n.rank.map((v,i)=>i===3&&!n.qualified?v+24:v)});
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
   n.rank[3]=n.baseEstimateRank+(access.reachable===true?24:access.reachable===false?-12:0);
   n.assessment.obligations=n.assessment.obligations.map(o=>o.kind!=='T-slot'?o:({...o,status:access.reachable===true&&o.at[0]===access.event.target.x&&o.at[1]===access.event.target.y?'entry-verified-arrival-unresolved':access.reachable===false?'entry-blocked':'unresolved',note:'Counterfactual T entry is checked separately from whether a T arrives in time.'}));
  };
  // Evaluate the best member of each distinct root construction family too.
  const groups=new Map();for(const n of pending){const f=n.path[0],g=[f.target.type,f.hold,n.assessment.right.slots.length>0].join(':');if(!groups.has(g))groups.set(g,[]);groups.get(g).push(n);}
  for(const group of groups.values()){group.sort(order);while(group[0]&&!group[0].qualified&&!stopped){verify(group[0]);group.sort(order);}if(stopped)break;}
  while(pending.length&&selected.length<width*2&&!stopped){pending.sort(order);const n=pending[0];if(!n.qualified){verify(n);continue;}selected.push(pending.shift());}
  // On interruption, retain already evaluated evidence. An unknown geometric
  // candidate has no reward, and incomplete work remains explicitly reported.
  for(const n of nodes)if(n.qualified&&!selected.includes(n))selected.push(n);
  if(!selected.length&&nodes.length)selected.push([...nodes].sort(compare)[0]);
  return selected;
 };
 s=extendForced(s);
 const enumerate=state=>{const remaining=limit-base.metrics.nodes;if(remaining<=0||now()>=deadline){stopped=true;return{placements:[],complete:false};}const r=R.placements(state,{allowHold:options.allowHold!==false,maxNodes:remaining,deadline,now});base.metrics.nodes+=r.visited;if(!r.complete)stopped=true;return r;};
 const root=enumerate(s);base.metrics.roots=root.placements.length;
 let frontier=qualify(root.placements.map((p,i)=>nodeFor(p,null,initial,i)));
 let best=frontier.length?[...frontier].sort(compare)[0]:null;base.metrics.depth=best?1:0;base.metrics.completeDepth=root.complete&&best&&!stopped?1:0;
 let layer=diversify(frontier,width);
 for(let depth=2;depth<=maxDepth&&!stopped&&layer.length;depth++){
  const next=[],seen=new Map();let complete=true;
  for(const n of layer){if(!n.state.active)continue;expandedRoots.add(n.rootIndex);const e=enumerate(n.state);if(!e.complete)complete=false;
   for(const p of e.placements){const child=nodeFor(p,n,initial,n.rootIndex),key=stateKey(child.state),prior=seen.get(key);if(!prior||compare(child,prior)<0)seen.set(key,child);}
   if(stopped)break;
  }
  next.push(...qualify([...seen.values()]));if(stopped)complete=false;if(next.length){const candidate=[...next].sort(compare)[0];base.metrics.depth=depth;if(complete){best=candidate;base.metrics.completeDepth=depth;}}
  layer=diversify(next,width);
 }
 if(now()>=deadline)stopped=true;
 base.metrics.rootExpanded=expandedRoots.size;base.metrics.elapsedMs=Date.now()-started;
 if(!best)return{...base,status:stopped?'budget-exhausted':'no-supported-continuation-found',reason:stopped?'Search budget ended before an executable continuation was established.':'No supported continuation was found in the checked moves; this is not proof that none exists.'};
 if(best.assessment.maxHeight>=20||!best.assessment.regionalSupport)return{...base,status:'no-supported-continuation-found',reason:'Checked continuations do not preserve the supported regional profile and headroom; no supported ST recommendation was established.',assessment:best.assessment};
 const first=best.path[0],verified=R.replay(s,first.witness);if(!verified.valid)return{...base,status:'invalid-witness',reason:'Internal witness validation failed; no advice is displayed.'};
 const tsdAt=best.path.findIndex(p=>p.event.spin==='full'&&p.event.lines===2);
 const reason=tsdAt>=0?`${first.hold?'Hold first. ':''}${tsdAt===0?'Execute the T-spin double.':`This placement has a checked T-spin double within ${tsdAt+1} locks.`}`:
 `${first.hold?'Hold first. ':''}${first.event.lines===0?'Place without clearing. ':'Place here. '}${best.assessment.right.entry?.status==='reachable-if-T-available'?'The checked endpoint preserves executable T-double entry when a T is available.':best.assessment.channel.openBelowStack?'The checked endpoint keeps column eight below the left/center stack.':'The checked endpoint needs a scoring-channel rebuild; its structure is uncertain.'}`;
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,witness:first.witness,reason,
 continuation:best.path.map(p=>({target:p.target,hold:p.hold,witness:p.witness,event:p.event,structuralEvidence:p.structuralEvidence})),
 evidence:{verifiedLocks:best.path.length,tsdAt:tsdAt>=0?tsdAt+1:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:root.complete,budgetExhausted:stopped,informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:best.assessment.regionalSupport,channel:best.assessment.channel,endpointTEntry:best.assessment.right.entry?.status??'not-established',unresolvedObligations:best.assessment.obligations,claim:'Finite executable prefix; endpoint estimates are not a sustainability guarantee.'},assessment:best.assessment};
}
// Keep a committed target through an exactly followed input, including HOLD.
// The entire remaining prefix is replayed from the new observation, so a newly
// revealed piece cannot silently preserve an obsolete proof.
function advance(raw,previous,action){
 if(!previous?.target||action==='HD'||previous.witness?.[0]!==action)return null;
 let state;try{state=observe(raw);}catch{return null;}
 if(R.validate(state).length||(state.bag&&B.validate(state.bag).length))return null;
 const witness=previous.witness.slice(1);if(!witness.length)return null;
 const steps=previous.continuation.map((step,i)=>({...step,witness:i?step.witness:witness,hold:i?step.hold:witness.includes('HOLD')}));
 let current=state;for(const step of steps){const replay=R.replay(current,step.witness);
  if(!replay.valid||replay.events.length!==1||JSON.stringify(replay.events[0])!==JSON.stringify(step.event))return null;
  current=replay.state;
 }
 return{...previous,revision:state.revision,context:context(state),witness,hold:witness.includes('HOLD'),continuation:steps,
  reason:previous.reason.replace(/^Hold first\. /,''),retained:true,
  evidence:{...previous.evidence,knownPieceHorizon:state.queue.length+1}};
}
function revalidate(raw,previous,options={}){
 let s;try{s=observe(raw);}catch{return null;}if(!previous?.target||context(s)!==previous.context||R.validate(s).length)return null;
 const enumeration=R.placements(s,{maxNodes:options.maxNodes??8000,deadline:options.deadline,now:options.now});
 const p=enumeration.placements.find(p=>p.hold===previous.hold&&JSON.stringify(p.target)===JSON.stringify(previous.target)&&p.event.spin===previous.continuation?.[0]?.event.spin&&p.event.lines===previous.continuation?.[0]?.event.lines);
 if(!p)return null;return{...previous,revision:s.revision,witness:p.witness,continuation:[{...previous.continuation[0],target:p.target,hold:p.hold,witness:p.witness,event:p.event},...previous.continuation.slice(1)],metrics:{...previous.metrics,revalidationNodes:enumeration.visited},retained:true};
}
return Object.freeze({observe,assess,plan,revalidate,advance});
});
