/* Bounded opening construction, distinct from established-stack maintenance.
 * Only actual board, active/hold and six public previews enter this search. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-paired-repair'),()=>require('./st-planner')):factory(root.STRules,root.STStructure,root.STPairedRepair,()=>root.STPlanner);if(typeof module==='object'&&module.exports)module.exports=api;else root.STOpening=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,X,getPlanner){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function balance(board){let n=0;for(let y=0;y<40;y++)for(let x=0;x<4;x++)if(board[y][x]!=='.')n+=(x+y)%2?1:-1;return n;}
function features(board){
 const h=Array.from({length:10},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
 const max=Math.max(...h),left=h.slice(0,4),center=h.slice(4,7);
 let mass=0,covered=0,leftCovered=0,channel=0;for(let y=40-max;y<40;y++)for(let x=0;x<10;x++){if(board[y][x]!=='.')mass++;else if(y>=40-h[x]){covered++;if(x<4)leftCovered++;}if(x===7&&board[y][x]!=='.')channel++;}
 let scoringDebt=0;const anchored=S.notchPattern(board);if(anchored.status==='established'&&anchored.anchorRow<39){for(const y of [anchored.anchorRow,anchored.anchorRow+1])for(let x=0;x<7;x++)if(!(x===6&&y===anchored.anchorRow)&&board[y][x]==='.')scoringDebt++;}
 const parity=balance(board),rough=left.slice(1).reduce((n,v,i)=>n+Math.abs(v-left[i]),0);
 // Distance to a two-filled/one-open column-seven wall, choosing no phase
 // until actual right geometry anchors it. This is ranking, never a certificate.
 const notch=S.notchPattern(board);let grammar=Infinity;
 const phases=notch.status==='established'?[((39-notch.anchorRow)%3+3)%3]:[0,1,2];
 for(const phase of phases){let bad=0;for(let k=0;k<Math.min(...center);k++){const y=39-k;if(board[y][4]==='.')bad++;if(board[y][5]==='.')bad++;if((board[y][6]==='.')!==(k%3===phase))bad++;}grammar=Math.min(grammar,bad);}
 let baseDebt=0;for(let y=(notch.status==='established'?notch.anchorRow+1:38);y<40;y++)for(let x=4;x<7;x++)if(board[y][x]==='.')baseDebt++;
 let foundationDebt=0;const top=Math.max(...center),level=notch.status==='established'?39-notch.anchorRow:2,target=Math.max(level,level+3*Math.ceil((top-level)/3));for(let k=0;k<target;k++)for(let x=4;x<=6;x++){const expected=x<6||!notch.protectedRows.includes(39-k);if(expected&&board[39-k][x]==='.')foundationDebt++;}
 const buriedCenterVacancies=S.centerFoundation(board,notch).vacancies;
 return{buriedCenterVacancies,baseDebt,foundationDebt,scoringDebt,heights:h,maxHeight:max,left,center,mass,covered,leftCovered,channel,parity,roughness:rough,grammar:Number.isFinite(grammar)?grammar:0,notches:notch};
}
function foundationAccess(board,f){
 const missing=[];for(let y=f.notches.anchorRow+1;y<40;y++)for(let x=4;x<7;x++)if(board[y][x]==='.')missing.push([x,y]);
 if(!missing.length)return 2;if(missing.length>4||f.notches.status!=='established')return 0;
 for(const type of 'IJLOSZ')for(let rotation=0;rotation<4;rotation++)for(let x=-1;x<7;x++)for(let y=34;y<39;y++){
  const a={type,x,y,rotation},cells=R.cells(a);
  if(cells.some(([cx,cy])=>cx>=7||cx===6&&f.notches.protectedRows.includes(cy)))continue;
  if(!missing.every(([mx,my])=>cells.some(([cx,cy])=>cx===mx&&cy===my)))continue;
  if(R.fits(board,a)&&!R.fits(board,{...a,y:y+1}))return 1;
 }
 return -1;
}
function facts(board,notches=S.notchPattern(board)){const f=features(board),g=S.geometry(board,{notches}),foundation=S.centerFoundation(board,notches);return{...f,notches,buriedCenterVacancies:foundation.vacancies,centerFoundationStatus:foundation.status,centerStatus:g.center.status,centerPartners:g.center.completions.filter(c=>c.resultStatus==='level').map(c=>({piece:c.piece,cells:c.cells})),right:g.right.shapeStatus};}
function compare(a,b){for(let i=0;i<a.rank.length;i++){if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return a.key.localeCompare(b.key);}
function rank(f,event,path){
 const low=Math.min(...f.heights.slice(0,7)),high=Math.max(...f.heights.slice(0,7));
 const centerSpan=Math.max(...f.center)-Math.min(...f.center),gap=Math.abs(Math.max(...f.left)-Math.max(...f.center));
 const rawScore=path.reduce((n,p)=>n+p.event.lines,0);
 const board=path.at(-1).board,g=S.geometry(board),foundation=foundationAccess(board,f),centerQuality=g.center.status==='unrecognized'?-4:g.center.patternSupport==='reference-supported'?(g.center.status==='level'?2:1):-2;
 const score=f.parity===0&&g.center.patternSupport==='reference-supported'&&g.center.status!=='unrecognized'&&f.notches.status==='established'&&!f.buriedCenterVacancies.length?rawScore:0;
 return[-f.channel,-f.leftCovered,foundation<0?-1:0,-(Math.abs(f.parity)%2),
  -Math.max(0,Math.abs(f.parity)-2),
  centerQuality*3-f.baseDebt*15-f.foundationDebt*5-f.grammar*8-f.scoringDebt*3+score*8+Math.min(low,5)*3-Math.abs(f.parity)*3-f.roughness*1.2-centerSpan*2-Math.max(0,gap-2)*3-f.maxHeight*.8-f.covered,
  -Math.abs(f.parity),-path.reduce((n,p)=>n+p.witness.length,0)];
}
function centerReady(board,notches=S.notchPattern(board)){const g=S.geometry(board,{notches});return g.center.patternSupport==='reference-supported'&&g.center.status!=='unrecognized';}
// Unknown phase permits a finite top-pattern/parity goal, never an alignment
// claim. Positively known buried debt cannot count as a completed repair.
function repairEndpoint(board,notches=S.notchPattern(board)){return centerReady(board,notches)&&S.centerFoundation(board,notches).status!=='unfinished-lower-foundation';}
function handoffGeometry(state){const f=facts(state.board),a=getPlanner().assess(state.board);return f.parity===0&&centerReady(state.board)&&f.notches.status==='established'&&!f.buriedCenterVacancies.length&&a.regionalSupport&&!a.leftSealed;}
function sameCells(a,b){return JSON.stringify(a.map(c=>c.join(',')).sort())===JSON.stringify(b.map(c=>c.join(',')).sort());}
function publicMatch(expected,actual){return JSON.stringify(expected.board)===JSON.stringify(actual.board)&&JSON.stringify(expected.active)===JSON.stringify(actual.active)&&expected.hold===actual.hold&&expected.canHold===actual.canHold&&expected.streamCursor===actual.streamCursor&&expected.topOut===actual.topOut&&expected.queue.every((t,i)=>actual.queue[i]===t);}
function validStep(before,p,notches){
 const P=getPlanner(),e=p.event;if(p.state.topOut||!p.state.active||!S.canonicalClear(e))return null;
 if(e.type==='T'&&!e.lines&&!e.cells.every(([x])=>x<4))return null;
 if(e.lines&&!e.cells.some(([x])=>x>=7))return null;
 if(!e.lines&&e.cells.some(([x])=>x>=7)){
  if(e.type==='I'){const c=S.geometry(before).right.cycle.prepareColumn;if(c===null||!e.cells.every(([x])=>x===c))return null;}
  else if(e.type!=='Z'||!e.cells.every(([x])=>x>=8))return null;
 }
 const n=S.advanceNotches(before,p,notches);if(!n.valid)return null;
 const f=features(p.state.board);if(f.maxHeight>=20||f.channel>features(before).channel)return null;
 if(P.cavityRepairDebt(P.assess(before),P.assess(p.state.board),e).length)return null;
 return n.pattern;
}
function remainingGoal(origin,path,goal){
 let state=origin,cells=goal.center?.cells.map(c=>c.slice()),centerPaid=!cells;
 for(const step of path){const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return null;const e=r.events[0];
  if(!centerPaid){if(e.type===goal.center.piece&&sameCells(e.cells,cells))centerPaid=true;
   else {if(cells.some(([,y])=>e.clearedRows.includes(y)))return null;cells=cells.map(([x,y])=>[x,y+e.clearedRows.filter(row=>row>y).length]);}}
  state=r.state;
 }
 return{balance:goal.balance,center:centerPaid?null:{piece:goal.center.piece,cells}};
}
function goalPaid(origin,path,goal,notches=S.notchPattern(origin.board)){const remaining=remainingGoal(origin,path,goal);if(!remaining||remaining.center)return false;let state=origin;for(const step of path){const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return false;const n=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},notches);if(!n.valid)return false;notches=n.pattern;state=r.state;}return(!remaining.balance||balance(state.board)===0)&&repairEndpoint(state.board,notches);}
function betterRank(a,b){for(let i=0;i<a.rank.length;i++)if(a.rank[i]!==b.rank[i])return a.rank[i]>b.rank[i];return false;}
function proofDepth(proof){let n=0;for(;proof;proof=proof.basis)if(++n>4)break;return n;}
// A repair is an actual finite construction improvement, not a quota of Ts or
// a promise that an unseen partner will arrive. Center identity is exact.
function repairCertificate(origin,path,requiredGoal=null,initialNotches=S.notchPattern(origin.board)){
 if(!path?.length||path.length>4)return null;
 const fresh=S.notchPattern(origin.board);
 // A retained proof must regenerate its authority from its immutable origin.
 // Do not silently downgrade history-only established evidence to unknown.
 if(initialNotches.status==='broken'||initialNotches.status==='established'&&(fresh.status!=='established'||fresh.anchorRow!==initialNotches.anchorRow))return null;
 let state=origin,notches=initialNotches,debt=balance(origin.board)!==0,center=null,cleared=false;
 for(let i=0;i<path.length;i++){
  const step=path[i];if(!Array.isArray(step.witness)||step.witness.length>256)return null;const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1||step.witness.at(-1)!=='HD'||JSON.stringify(r.events[0])!==JSON.stringify(step.event))return null;
  const e=r.events[0],g=S.geometry(state.board,{notches});
  if(!cleared&&!e.lines&&g.center.patternSupport==='reference-supported'){
   const c=g.center.completions.find(c=>c.resultStatus==='level'&&c.piece===e.type&&sameCells(c.cells,e.cells));if(c)center={piece:c.piece,cells:c.cells.map(c=>c.slice())};
  }
  notches=validStep(state.board,{state:r.state,event:e},notches);if(!notches)return null;
  state=r.state;debt=debt||balance(state.board)!==0;cleared=cleared||e.lines>0;
  const goal={balance:balance(state.board)===0,center};
  if(requiredGoal?goalPaid(origin,path.slice(0,i+1),requiredGoal,initialNotches):(((debt&&goal.balance)||goal.center)&&repairEndpoint(state.board,notches)))return{origin:clone(origin),steps:clone(path.slice(0,i+1)),goal:clone(requiredGoal||goal),consumed:0};
 }
 return null;
}
function checkedRepair(proof,current,depth=0){
 if(depth>=4||!proof||!Number.isInteger(proof.consumed)||proof.consumed<0)return null;
 const P=getPlanner();let origin;try{origin=P.observe(proof.origin);}catch{return null;}
 if(R.validate(origin).length||origin.queue.length>6)return null;
 const basis=proof.basis?checkedRepair(proof.basis,origin,depth+1):null;if(proof.basis&&!basis)return null;
 const cert=repairCertificate(origin,proof.steps,basis?.goal);if(!cert||cert.steps.length!==proof.steps.length||proof.consumed>=cert.steps.length)return null;
 let expected=origin,consumedPattern=S.notchPattern(origin.board);for(const step of cert.steps.slice(0,proof.consumed)){const r=R.replay(expected,step.witness),n=S.advanceNotches(expected.board,{state:r.state,event:r.events[0]},consumedPattern);if(!n.valid)return null;consumedPattern=n.pattern;expected=r.state;}
 // Exact saved input prefixes permit following HOLD/rotations. A different
 // manual path may safely drop the proof rather than inventing a pose bridge.
 const first=cert.steps[proof.consumed],prefix=[];let aligned=-1;
 for(let i=0;i<first.witness.length;i++){
  const pose=R.replay(expected,prefix);if(pose.valid&&publicMatch(pose.state,current)){aligned=i;break;}prefix.push(first.witness[i]);
 }
 if(aligned<0)return null;
 const path=clone(cert.steps.slice(proof.consumed));path[0].witness=path[0].witness.slice(aligned);
 let state=current,n=consumedPattern;for(const step of path){const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event))return null;n=validStep(state.board,{state:r.state,event:r.events[0]},n);if(!n)return null;step.board=r.state.board;step.holdCount=step.witness.filter(a=>a==='HOLD').length;step.hold=step.holdCount>0;state=r.state;}
 // Center goals admitted here have no earlier clear, so their exact rows are
 // unchanged at consumption. A clear before repayment is checked, not waived.
 const goal=remainingGoal(origin,cert.steps.slice(0,proof.consumed),cert.goal);if(!goal||!goalPaid(current,path,goal,consumedPattern))return null;
 return{proof:{...cert,consumed:proof.consumed,...(basis?{basis:clone(proof.basis)}:{})},goal,path,state,f:features(state.board),notches:n,key:'saved-repair',rank:rank(features(state.board),path.at(-1).event,path)};
}
function startSession(raw,{emptyMode=false}={}){
 const a=getPlanner().assess(raw.board),empty=raw.board.every(r=>r==='..........');
 return{active:Boolean(emptyMode||empty||(!a.maintenanceScope&&a.maxHeight<=4&&a.left.height<2)),clear:null,repair:null};
}
function updateSession(session,before,after,event){
 if(!session?.active)return{active:false,clear:null,repair:null};
 let repair=null;const old=session.repair;
 if(old){const checked=checkedRepair(old,before);if(checked&&JSON.stringify(checked.path[0].event)===JSON.stringify(event)){
   const r=R.replay(before,['HD']);if(r.valid&&publicMatch(r.state,after)&&old.consumed+1<old.steps.length)repair={...checked.proof,consumed:old.consumed+1};
 }}
 return{active:true,clear:event?.lines&&S.canonicalClear(event)?{before:clone(before),event:clone(event)}:null,repair};
}
function acceptResult(session,result){
 if(session?.active&&result?.phase==='maintenance'&&result?.evidence?.openingHandoff)return{active:false,clear:null,repair:null};
 if(session?.active&&result?.evidence?.opening)return{...session,repair:result.evidence.opening.repair?clone(result.evidence.opening.repair):null};
 return session;
}
function handoff(state,proof,options){
 const P=getPlanner();if(!proof?.before||!proof.event)return null;
 let before;try{before=P.observe(proof.before);}catch{return null;}
 if(R.validate(before).length)return null;
 const r=R.replay(before,['HD']),event=r.events[0];
 if(!r.valid||r.events.length!==1||JSON.stringify(event)!==JSON.stringify(proof.event)||!event.lines||!S.canonicalClear(event))return null;
 if(JSON.stringify(r.state.board)!==JSON.stringify(state.board)||r.state.active?.type!==state.active?.type||r.state.hold!==state.hold||r.state.canHold!==state.canHold||r.state.queue.some((t,i)=>state.queue[i]!==t))return null;
 const f=facts(state.board);if(!handoffGeometry(state))return null;
 const now=options.now??(()=>Date.now()),deadline=options.deadline??Infinity;
 if(now()>=deadline)return null;
 const result=P.plan(state,{...options,disableOpening:true,openingPhase:false,openingClear:null,previous:null,commitment:null,constructionPrevious:null,maxNodes:Math.min(12000,options.maxNodes??45000),deadline:Math.min(deadline,now()+200)});
 if(!result?.target)return null;
 return{...result,phase:'maintenance',evidence:{...result.evidence,openingHandoff:{status:'checked-after-actual-clear',event:clone(event),balance:f.parity}},reason:'Opening handoff checked after the clear. '+result.reason};
}
function plan(raw,options={}){
 const P=getPlanner(),now=options.now??(()=>Date.now()),started=now(),deadline=options.deadline??started+(options.timeMs??750);
 const limit=Math.min(45000,Math.max(0,options.maxNodes??45000)),width=Math.min(10,Math.max(1,options.openingWidth??6)),depth=Math.min(4,Math.max(1,options.openingDepth??3));
 let state;try{state=P.observe(raw);}catch{return null;}
 const base={status:'no-supported-continuation-found',revision:state.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],phase:'opening',reason:'No checked opening construction was found within this search. You can continue manually.',metrics:{nodes:0,depth:0,completeDepth:0,elapsedMs:0},sources:[]};
 if(R.validate(state).length||state.queue.length>6||!state.active||state.topOut)return base;
 if(now()>=deadline||!limit)return{...base,status:'budget-exhausted'};
 const accepted=handoff(state,options.openingClear,{...options,deadline});if(accepted)return accepted;
 // Reserve the complete handoff allowance even when an attempt abstains.
 const reserved=options.openingClear?Math.min(12000,limit):0;base.metrics.handoffReservedNodes=reserved;
 const initial=P.assess(state.board),initialFacts=facts(state.board,P.resolvePatternHistory(state,options.patternHistory));
 if(initial.maxHeight>=20||initialFacts.notches.status==='broken')return{...base,reason:'This opening needs a repair outside the supported construction search.'};
 let saved=checkedRepair(options.openingRepair,state);
 const mayClear=initialFacts.notches.status==='established'&&[state.active.type,state.hold,...state.queue.slice(0,3)].some(t=>t==='T'||t==='I');
 const probeReserve=mayClear?Math.min(6000,Math.max(0,limit-reserved)):0,searchLimit=limit-probeReserve;
 const searchDeadline=mayClear&&Number.isFinite(deadline)?deadline-Math.min(120,Math.max(0,deadline-now())/4):deadline;
 base.metrics.handoffProbeReservedNodes=probeReserve;
 let beam=[{state,path:[],f:initialFacts,notches:initialFacts.notches,key:'',rank:[]}],best=null,stopped=false;const clearCandidates=[],repairCandidates=[];
 const accessSafe=node=>{if(node.accessProof?.reachable===true||node.accessProof?.reachable===false)return node.accessProof.reachable;const proof=P.checkAccessPrefix(state,node.path,{notches:initialFacts.notches,deadline,now,maxNodes:Math.max(0,limit-reserved-base.metrics.nodes)});base.metrics.nodes+=proof.visited;base.metrics.gapAccessNodes=(base.metrics.gapAccessNodes||0)+proof.visited;node.accessProof=proof;return proof.reachable===true;};
 if(saved&&!accessSafe(saved))saved=null;
 for(let d=0;d<depth;d++){
  const nodes=[];
  for(const parent of beam){
   if(now()>=searchDeadline||base.metrics.nodes+reserved>=searchLimit){stopped=true;break;}
   const enumDeadline=performance.now()+Math.max(0,searchDeadline-now());
   const e=X.stagePlacements(parent.state,{deadline:enumDeadline,maxNodes:Math.min(2500,searchLimit-reserved-base.metrics.nodes)});base.metrics.nodes+=e.visited;if(!e.envelopeComplete)stopped=true;
   for(const p of e.placements){
    if(now()>=searchDeadline){stopped=true;break;}
    const pattern=validStep(parent.state.board,p,parent.notches);if(!pattern)continue;
    const notch={pattern},f=features(p.state.board);
    const step={board:p.state.board,target:p.event.target,witness:p.witness,event:p.event,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length};
    const path=[...parent.path,step],key=JSON.stringify([p.state.board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')),p.state.active?.type,p.state.hold,p.state.queue,notch.pattern]);
    nodes.push({state:p.state,path,f,notches:notch.pattern,key,rank:rank(f,p.event,path)});
   }
  }
  if(!nodes.length)break;
  const unique=[...new Map(nodes.sort(compare).reverse().map(n=>[n.key,n])).values()].sort(compare);
  for(const node of unique){if(now()>=deadline){stopped=true;break;}if(node.path.at(-1).event.lines&&handoffGeometry(node.state))clearCandidates.push(node);if(saved&&node.path.length===saved.path.length&&goalPaid(state,node.path,saved.goal,initialFacts.notches))repairCandidates.push(node);}
  best=unique.find(node=>now()<deadline&&accessSafe(node))||best;base.metrics.depth=d+1;if(!stopped)base.metrics.completeDepth=d+1;
  base.metrics.enumeration='reduced-stage-envelope-not-exhaustive';
  // Keep different first-piece/region/parity families alive, not just adjacent
  // poses of one greedy foundation. This does not make enumeration exhaustive.
  // A definitively rejected executed prefix cannot become returnable by adding
  // descendants under the current no-delayed-access-repair policy. Unknown
  // checks remain candidates; this is not an endpoint-shape pruning rule.
  const expandable=unique.filter(n=>n.accessProof?.reachable!==false);base.metrics.accessPrunedPrefixes=(base.metrics.accessPrunedPrefixes||0)+unique.length-expandable.length;
  const chosen=[],groups=new Set();for(const n of expandable){const e=n.path[0].event,g=[e.type,Math.floor(e.cells.reduce((s,c)=>s+c[0],0)/4/4),Math.sign(n.f.parity)].join(':');if(!groups.has(g)){chosen.push(n);groups.add(g);if(chosen.length>=width)break;}}
  for(const n of expandable)if(chosen.length<width&&!chosen.includes(n))chosen.push(n);
  beam=chosen;if(stopped)break;
 }
 // Probe only actual candidate post-clear public states, within this request's
 // remaining time/nodes. An unprobed or failed bounded search is not impossible.
 let verified=null,probeNodes=0;const seen=new Set(),probeResults=[];
 for(const node of clearCandidates.sort(compare)){
  if(now()>=deadline)break;if(!accessSafe(node))continue;
  const key=JSON.stringify([node.state.board,node.state.active,node.state.hold,node.state.queue]);if(seen.has(key))continue;seen.add(key);
  if(probeResults.length>=2||now()>=deadline||base.metrics.nodes+reserved>=limit)break;
  const allowance=Math.min(6000-probeNodes,limit-reserved-base.metrics.nodes);if(allowance<=0)break;
  let virtual=state,history=options.patternHistory||P.startPatternHistory(state);for(const step of node.path){const pre=R.replay(virtual,step.witness.slice(0,-1)).state,r=R.replay(pre,['HD']);history=P.updatePatternHistory(history,pre,r.state,r.events[0]);virtual=r.state;}
  const result=P.plan(node.state,{...options,patternHistory:history,disableOpening:true,openingPhase:false,openingClear:null,openingRepair:null,previous:null,commitment:null,constructionPrevious:null,deadline,maxNodes:allowance});
  const spent=result.metrics?.nodes||0;probeNodes+=spent;base.metrics.nodes+=spent;
  probeResults.push({status:result.target?'verified':'unknown-bounded-search',locks:node.path.length,nodes:spent});
  if(result.target){node.handoffContinuation=result.continuation;verified=node;break;}
 }
 base.metrics.handoffProbes=probeResults;
 if(verified)best=verified;
 let retained=false;
 if(saved){
  // A checked complete handoff is a stronger fulfilled goal. Otherwise compare
  // only equal-lock repair endpoints; unseen/pruned alternatives cannot win.
  if(!(verified&&proofDepth(saved.proof)<4&&goalPaid(state,verified.path,saved.goal,initialFacts.notches))){
   const replacement=repairCandidates.sort(compare).find(node=>now()<deadline&&accessSafe(node));
   if(replacement&&proofDepth(saved.proof)<4&&betterRank(replacement,saved))best=replacement;else{best=saved;retained=true;}
  }
 }
 base.metrics.elapsedMs=now()-started;base.metrics.repairRetained=retained;base.metrics.searchLimitReached=stopped;
 if(!best)return{...base,status:stopped?'budget-exhausted':base.status};
 const freshRepair=repairCertificate(state,best.path,saved&&!retained?saved.goal:null,initialFacts.notches);
 const repair=retained?saved.proof:freshRepair&&saved?{...freshRepair,basis:clone(saved.proof)}:freshRepair;
 const first=best.path[0],end=facts(best.state.board,best.notches),hold=first.holdCount===2?'Hold twice. ':first.holdCount?'Hold once. ':'';
 const region=first.event.cells.every(([x])=>x<4)?'Left':first.event.cells.every(([x])=>x>=4&&x<7)?'Center':first.event.cells.every(([x])=>x>=7)?'Right':'foundation';
 const pending=[];if(end.parity)pending.push(`Left mino balance is ${end.parity>0?'+':''}${end.parity}; its repair is not yet proved`);if(end.centerStatus!=='level')pending.push('the Center top pattern is still under construction');if(end.centerFoundationStatus==='unfinished-lower-foundation')pending.push('the lower Center still has unfilled cells outside the intended notches');else if(end.centerFoundationStatus==='unknown-phase')pending.push('the lower Center foundation is not yet phase-verified');
 const reason=hold+(retained?'Continue the checked construction repair. ':'')+(first.event.lines?`Take the checked ${first.event.lines===4?'Tetris':'T-spin double'} while building the opening.`:`Place ${first.event.type} in the ${region} to build the ST opening.`)+` Checked ${best.path.length} legal placement${best.path.length===1?'':'s'} using only visible pieces. `+(pending.length?pending.join('; ').replace(/^./,c=>c.toUpperCase())+'. ':'This prefix has balanced Left minos and a level Center. ')+ (best.handoffContinuation?'This prefix reaches a checked maintenance continuation; the handoff will be rechecked after the actual clear. ':'')+'This is partial construction, not a completed opening or proof of future piece availability.';
 const sources=[{id:'SHOCKY-OPENING',label:"Shocky's ST Stacking Guide",url:'https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',section:'Chapters 1–4: regions, construction and mino parity',scope:'Community background for opening construction. The coach checks this finite prefix; the guide does not certify this exact move or future availability.'}];
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:best.path,reason,sources,assessment:P.assess(best.state.board),evidence:{opening:{status:'partial-construction',initial:initialFacts,endpoint:end,unresolved:pending,repair,handoffCandidate:best.handoffContinuation?{status:'verified-public-post-clear-continuation',continuation:best.handoffContinuation}:null},knownPieceHorizon:state.queue.length+1}};
}
return Object.freeze({balance,features,facts,repairEndpoint,handoffGeometry,handoff,plan,startSession,updateSession,acceptResult,repairCertificate,checkedRepair,goalPaid});
});
