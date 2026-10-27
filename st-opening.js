/* Bounded opening construction, distinct from established-stack maintenance.
 * Only actual board, active/hold and six public previews enter this search. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-paired-repair'),require('./st-opening-sources'),require('./st-bag'),require('./st-source-scoring'),require('./st-resource-history'),()=>require('./st-planner')):factory(root.STRules,root.STStructure,root.STPairedRepair,root.STOpeningSources,root.STBag,root.STSourceScoring,root.STResourceHistory,()=>root.STPlanner);if(typeof module==='object'&&module.exports)module.exports=api;else root.STOpening=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,X,O,B,Q,RH,getPlanner){
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
 const notch=anchored;let grammar=Infinity;
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
function facts(board,notches=S.notchPattern(board)){const f=features(board),g=S.geometry(board,{notches}),foundation=S.centerFoundation(board,notches);return{...f,notches,buriedCenterVacancies:foundation.vacancies,centerFoundationStatus:foundation.status,centerBaseStatus:S.centerLevelBase(board,notches).status,centerStatus:g.center.status,centerPartners:g.center.completions.filter(c=>c.resultStatus==='level').map(c=>({piece:c.piece,cells:c.cells})),right:g.right.shapeStatus};}
function rankOrder(a,b){for(let i=0;i<a.rank.length;i++){if(i===5){const ar=a.allocationRank||[0,0,0,0],br=b.allocationRank||[0,0,0,0];for(let j=0;j<ar.length;j++)if(ar[j]!==br[j])return br[j]-ar[j];}if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return 0;}
function compare(a,b){return rankOrder(a,b)||a.key.localeCompare(b.key);}
// Source Chapter 2 allocation is a history fact, not something inferred from
// occupancy. Once the two non-Right Ts are observed, prefer a checked opening
// Z allocation over optional growth. Safety/parity bands remain ahead of it.
// A scoring T may precede the Z when the same checked prefix pays both duties.
// This is completion priority, not a hard first-TSD ordering rule, and does
// not claim that the whole opening or a future partner is certified.
function allocationRank(path,required,pending=[]){
 let placed=0,invalid=false;
 if(required)for(const step of path){const e=step.event,nonRight=e.cells.every(([x])=>x<7);
  if(e.type==='T'&&!e.lines&&nonRight)invalid=true;
  if(e.type==='Z'&&!e.lines&&nonRight)placed++;
 }
 const allocation=!required?0:invalid||placed>1?-1:placed===1?1:0;
 // Once the mandatory allocation is observed, preserve its exact live Center
 // partner before optional growth. This is a preference over executed cells,
 // not a projected quality baseline or a guessed future piece identity.
 let obligations=clone(pending),diverted=0;
 for(const step of path){const e=step.event,remaining=[];
  for(const debt of obligations){
   if(debt.alternatives.some(c=>c.piece===e.type&&sameCells(c.cells,e.cells)))continue;
   if(!e.lines&&debt.alternatives.some(c=>c.piece===e.type))diverted++;
   const cleared=e.clearedRows||[],alternatives=debt.alternatives.map(c=>({...c,cells:c.cells.map(([x,y])=>[x,cleared.includes(y)?-1:y+cleared.filter(r=>r>y).length])}));
   // A completely cleared debt is no longer a live partner; partial removal
   // stays unresolved and cannot masquerade as an exact accommodation.
   if(!alternatives.every(c=>c.cells.every(([,y])=>y<0)))remaining.push({...debt,alternatives});
  }
  obligations=remaining;
 }
 return [allocation,0,-diverted,-obligations.length];
}
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
// Opt-in decision evidence. These are evaluated contributions, not an ablation
// proving that one term caused the winner, and not permission to prune a rule.
function rankComponents(f,path){
 const g=S.geometry(path.at(-1).board),low=Math.min(...f.heights.slice(0,7));
 const centerQuality=g.center.status==='unrecognized'?-4:g.center.patternSupport==='reference-supported'?(g.center.status==='level'?2:1):-2;
 const score=f.parity===0&&g.center.patternSupport==='reference-supported'&&g.center.status!=='unrecognized'&&f.notches.status==='established'&&!f.buriedCenterVacancies.length?path.reduce((n,p)=>n+p.event.lines,0):0;
 return{centerPattern:centerQuality*3,baseFoundation:-f.baseDebt*15,foundationCells:-f.foundationDebt*5,notchGrammar:-f.grammar*8,scoringRowCells:-f.scoringDebt*3,qualifiedClears:score*8,lowColumns:Math.min(low,5)*3,leftParity:-Math.abs(f.parity)*3,leftRoughness:-f.roughness*1.2,centerSpan:-(Math.max(...f.center)-Math.min(...f.center))*2,regionalHeightGap:-Math.max(0,Math.abs(Math.max(...f.left)-Math.max(...f.center))-2)*3,height:-f.maxHeight*.8,covered:-f.covered};
}
function rejectedStep(raw,reason){if(raw?.usage)raw.usage.rejections[reason]=(raw.usage.rejections[reason]||0)+1;return null;}
function centerReady(board,notches=S.notchPattern(board)){const g=S.geometry(board,{notches});return g.center.patternSupport==='reference-supported'&&g.center.status!=='unrecognized';}
// Unknown phase permits a finite top-pattern/parity goal, never an alignment
// claim. Positively known buried debt cannot count as a completed repair.
function repairEndpoint(board,notches=S.notchPattern(board)){return centerReady(board,notches)&&S.centerFoundation(board,notches).status!=='unfinished-lower-foundation';}
function handoffGeometry(state){const f=facts(state.board),a=getPlanner().assess(state.board);return f.parity===0&&centerReady(state.board)&&f.notches.status==='established'&&!f.buriedCenterVacancies.length&&a.regionalSupport&&!a.leftSealed;}
function sameCells(a,b){return JSON.stringify(a.map(c=>c.join(',')).sort())===JSON.stringify(b.map(c=>c.join(',')).sort());}
function publicMatch(expected,actual){return JSON.stringify(expected.board)===JSON.stringify(actual.board)&&JSON.stringify(expected.active)===JSON.stringify(actual.active)&&expected.hold===actual.hold&&expected.canHold===actual.canHold&&expected.streamCursor===actual.streamCursor&&expected.topOut===actual.topOut&&expected.queue.every((t,i)=>actual.queue[i]===t);}
function validStep(before,p,notches,raw=null){
 const P=getPlanner(),e=p.event,feature=raw?.features||features,assessment=raw?.assess||P.assess;if(p.state.topOut||!p.state.active||!S.canonicalClear(e))return rejectedStep(raw,'noncanonical-or-terminal');
 if(e.type==='T'&&!e.lines&&!e.cells.every(([x])=>x<4))return rejectedStep(raw,'nonclearing-T-outside-Left');
 if(e.lines&&!e.cells.some(([x])=>x>=7))return rejectedStep(raw,'clear-outside-Right');
 if(!e.lines&&e.cells.some(([x])=>x>=7)){
  if(e.type==='I'){const c=S.geometry(before).right.cycle.prepareColumn;if(c===null||!e.cells.every(([x])=>x===c))return rejectedStep(raw,'unsupported-Right-I');}
  else if(e.type!=='Z'||!e.cells.every(([x])=>x>=8))return rejectedStep(raw,'unsupported-Right-placement');
 }
 const n=S.advanceNotches(before,p,notches);if(!n.valid)return rejectedStep(raw,'notch-transition');
 const f=feature(p.state.board);if(f.maxHeight>=20||f.channel>feature(before).channel)return rejectedStep(raw,'headroom-or-channel');
 if(P.cavityRepairDebt(assessment(before),assessment(p.state.board),e).length)return rejectedStep(raw,'new-internal-seal');
 return n.pattern;
}
// A finite opening foundation is narrower than a reusable Center pattern. It
// fills exact existing lower cells to the next known notch boundary, without
// adding a new upper tier or claiming future scoring availability.
function foundationTargets(board,notches){
 if(notches.status!=='established')return null;
 const fresh=S.notchPattern(board);if(fresh.status!=='established'||fresh.anchorRow!==notches.anchorRow)return null;
 const f=features(board),top=Math.max(...f.center);
 if(!top||top>=20||!notches.protectedRows.includes(39-top))return null;
 const cells=[];for(let y=40-top;y<40;y++)for(let x=4;x<7;x++)if(board[y][x]==='.'&&!(x===6&&notches.protectedRows.includes(y)))cells.push([x,y]);
 return cells.length&&cells.length<=4?{cells,level:top}:null;
}
function foundationEndpoint(board,notches){const f=features(board);return new Set(f.center).size===1&&S.centerFoundation(board,notches).status==='aligned';}
function foundationTransition(before,p,notches){
 const target=foundationTargets(before,notches);if(!target||!p?.event)return null;
 const e=p.event;if(e.lines||e.type==='T'||e.cells.some(([x])=>x>=7)||!target.cells.every(c=>e.cells.some(d=>c[0]===d[0]&&c[1]===d[1])))return null;
 const after=p.state.board,n=S.advanceNotches(before,p,notches);if(!n.valid||!foundationEndpoint(after,n.pattern))return null;
 const a=features(before),b=features(after);
 if(Math.max(...b.center)!==target.level||b.maxHeight>a.maxHeight||b.parity!==a.parity||b.leftCovered>a.leftCovered||after.some((row,y)=>row.slice(7)!==before[y].slice(7)))return null;
 return{targets:target.cells,level:target.level};
}
// Directed straight-drop witnesses are an intentionally incomplete discovery
// family. A fitting pose never counts unless the actual public pose/HOLD input
// replay reaches it. No guessed next piece or hypothetical spawn is substituted.
function foundationWitnesses(state,targets,{deadline,now,maxNodes}){
 let visited=0,unknown=false;const hits=[],roots=[{state,prefix:[]}],seenRoots=new Set(),seenPoses=new Set();let held=state;
 const budgetMove=(s,action)=>{if(now()>=deadline||visited>=maxNodes){unknown=true;return null;}visited++;return R.move(s,action);};
 if(now()>=deadline||maxNodes<=0)return{hits,visited,unknown:true};
 for(let i=1;i<=2;i++){const next=budgetMove(held,'HOLD');if(!next)return{hits,visited,unknown};if(next===held||next.topOut)break;held=next;roots.push({state:held,prefix:Array(i).fill('HOLD')});}
 for(const root of roots){
  const key=JSON.stringify([root.state.active,root.state.hold,root.state.queue]);if(seenRoots.has(key)||!root.state.active||root.state.active.type==='T')continue;seenRoots.add(key);
  for(let rotation=0;rotation<4;rotation++)for(const offset of R.cells({type:root.state.active.type,x:0,y:0,rotation})){
   if(now()>=deadline||visited>=maxNodes){unknown=true;return{hits,visited,unknown};}visited++;
   const pose={type:root.state.active.type,x:targets[0][0]-offset[0],y:targets[0][1]-offset[1],rotation},cells=R.cells(pose),pk=JSON.stringify([key,pose]);
   if(seenPoses.has(pk))continue;seenPoses.add(pk);
   if(cells.some(([x])=>x<0||x>=7)||!targets.every(c=>cells.some(d=>c[0]===d[0]&&c[1]===d[1]))||!R.fits(state.board,pose)||R.fits(state.board,{...pose,y:pose.y+1}))continue;
   const delta=(rotation-root.state.active.rotation+4)%4,rotations=delta===0?[[]]:delta===1?[['CW']]:delta===3?[['CCW']]:[['R180'],['CW','CW'],['CCW','CCW']];
   for(const turns of rotations)for(const firstShift of [false,true]){
    if(now()>=deadline||visited>=maxNodes){unknown=true;return{hits,visited,unknown};}
    let s=root.state,w=root.prefix.slice();const actions=[];
    function shift(){const dx=pose.x-s.active.x;for(let i=0;i<Math.abs(dx);i++){const action=dx<0?'L':'R',next=budgetMove(s,action);if(!next)return false;s=next;actions.push(action);}return true;}
    if(firstShift&&!shift())return{hits,visited,unknown};for(const action of turns){const next=budgetMove(s,action);if(!next)return{hits,visited,unknown};s=next;actions.push(action);}if(!shift())return{hits,visited,unknown};w.push(...actions,'HD');
    if(visited+w.length>maxNodes){unknown=true;return{hits,visited,unknown};}visited+=w.length;
    const r=R.replay(state,w);if(!r.valid||r.events.length!==1||!sameCells(r.events[0].cells,cells)||r.state.topOut)continue;
    hits.push({state:r.state,event:r.events[0],witness:w});
   }
  }
 }
 return{hits,visited,unknown};
}
// A closure is a bounded public construction, not a Reset: an observed
// two-mino Left imbalance is paid by the actual penultimate T, then the exact
// visible Center partner completes a reusable level endpoint. Its authority
// is regenerated from all five real locks, never imported goal metadata.
function closureCertificate(origin,path,initialNotches=S.notchPattern(origin.board),raw=null){
 if(path?.length!==5||Math.abs(balance(origin.board))!==2)return null;
 const fresh=S.notchPattern(origin.board),P=getPlanner();
 if(initialNotches.status!=='established'||fresh.status!=='established'||fresh.anchorRow!==initialNotches.anchorRow||P.assess(origin.board).sealedCells.some(([x])=>x<7))return null;
 let state=origin,notches=initialNotches,center=null;
 for(let i=0;i<path.length;i++){
  const step=path[i];if(!Array.isArray(step.witness)||step.witness.length>256||step.witness.at(-1)!=='HD')return null;
  const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||r.events[0].lines)return null;
  const e=r.events[0],g=S.geometry(state.board,{notches});
  if(i===3){
   if(balance(state.board)!==balance(origin.board)||e.type!=='T'||!e.cells.every(([x])=>x<4)||balance(r.state.board)!==0||features(state.board).leftCovered||features(r.state.board).leftCovered||g.center.patternSupport!=='reference-supported'||g.center.status==='unrecognized'||g.center.foundation.status!=='aligned'||g.right.shapeStatus!=='staggered-scoring-wall')return null;
  }
  if(i===4){
   const c=g.center.completions.find(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported'&&c.piece===e.type&&sameCells(c.cells,e.cells));
   if(!c||!e.cells.every(([x])=>x>=4&&x<7))return null;center={piece:e.type,cells:e.cells.map(c=>c.slice())};
  }
  const next=validStep(state.board,{state:r.state,event:e},notches,raw);if(!next)return null;notches=next;state=r.state;
 }
 const g=S.geometry(state.board,{notches}),f=features(state.board);
 if(f.parity||f.leftCovered||g.center.status!=='level'||g.center.patternSupport!=='reference-supported'||g.center.foundation.status!=='aligned'||g.right.shapeStatus!=='staggered-scoring-wall'||P.assess(state.board).sealedCells.some(([x])=>x<7))return null;
 return{kind:'visible-closure',origin:clone(origin),steps:clone(path),goal:{balance:true,center},consumed:0};
}
function closureWitness(origin,parent,{deadline,now,maxNodes,notches,raw}){
 let visited=0,unknown=false;const candidates=[];
 const g=S.geometry(parent.state.board,{notches:parent.notches});
 if(Math.abs(balance(origin.board))!==2||balance(parent.state.board)!==balance(origin.board)||parent.path.length!==3||parent.path.some(p=>p.event.lines)||features(parent.state.board).leftCovered||g.center.patternSupport!=='reference-supported'||g.center.status==='unrecognized'||g.center.foundation.status!=='aligned'||g.right.shapeStatus!=='staggered-scoring-wall')return{candidates,visited,unknown};
 if(now()>=deadline||maxNodes<=0)return{candidates,visited,unknown:true};
 const e=X.stagePlacements(parent.state,{deadline:performance.now()+Math.max(0,deadline-now()),maxNodes});visited+=e.visited;unknown=!e.envelopeComplete;
 for(const p of e.placements){
  if(now()>=deadline||visited>=maxNodes){unknown=true;break;}
  if(p.event.type!=='T'||p.event.lines||!p.event.cells.every(([x])=>x<4)||balance(p.state.board)!==0||features(p.state.board).leftCovered)continue;
  const phase=validStep(parent.state.board,p,parent.notches,raw);if(!phase)continue;
  for(const c of S.geometry(p.state.board,{notches:phase}).center.completions.filter(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported')){
   const found=foundationWitnesses(p.state,c.cells,{deadline,now,maxNodes:Math.max(0,maxNodes-visited)});visited+=found.visited;unknown=unknown||found.unknown;
   for(const q of found.hits){
    if(q.event.type!==c.piece||!sameCells(q.event.cells,c.cells))continue;
    const finalPhase=validStep(p.state.board,q,phase,raw);if(!finalPhase)continue;
    const step=v=>({board:v.state.board,target:v.event.target,witness:v.witness,event:v.event,hold:v.witness.includes('HOLD'),holdCount:v.witness.filter(a=>a==='HOLD').length});
    const path=[...parent.path,step(p),step(q)],cost=path.reduce((n,v)=>n+v.witness.length,0);
    if(now()>=deadline||visited+cost>maxNodes){unknown=true;break;}visited+=cost;
    const proof=closureCertificate(origin,path,notches,raw);if(!proof)continue;
    const accessProof=getPlanner().checkAccessPrefix(origin,path,{notches,deadline,now,maxNodes:Math.max(0,maxNodes-visited)});visited+=accessProof.visited;if(accessProof.reachable!==true){if(accessProof.reachable===null)unknown=true;continue;}
    const f=features(q.state.board),key=JSON.stringify([q.state.board,q.state.active,q.state.hold,q.state.queue,finalPhase]);
    candidates.push({state:q.state,path,f,notches:finalPhase,key,rank:rank(f,q.event,path),closureProof:proof,accessProof});
    // This is only an existential trigger. Ordinary deeper layers still
    // compare every retained competitor; duplicate witnesses add no authority.
    return{candidates,visited,unknown};
   }
  }
 }
 return{candidates,visited,unknown};
}
function remainingGoal(origin,path,goal){
 let state=origin,cells=goal.center?.cells.map(c=>c.slice()),centerPaid=!cells;
 for(const step of path){const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return null;const e=r.events[0];
  if(!centerPaid){if(e.type===goal.center.piece&&sameCells(e.cells,cells))centerPaid=true;
   else {if(cells.some(([,y])=>e.clearedRows.includes(y)))return null;cells=cells.map(([x,y])=>[x,y+e.clearedRows.filter(row=>row>y).length]);}}
  state=r.state;
 }
 return{balance:goal.balance,center:centerPaid?null:{piece:goal.center.piece,cells},...(goal.endpoint==='finite-foundation'?{endpoint:'finite-foundation'}:{})};
}
function goalPaid(origin,path,goal,notches=S.notchPattern(origin.board)){const remaining=remainingGoal(origin,path,goal);if(!remaining||remaining.center)return false;let state=origin;for(const step of path){const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return false;const n=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},notches);if(!n.valid)return false;notches=n.pattern;state=r.state;}return(!remaining.balance||balance(state.board)===0)&&(goal.endpoint==='finite-foundation'?foundationEndpoint(state.board,notches):repairEndpoint(state.board,notches));}
function betterRank(a,b){return rankOrder(a,b)<0;}
function proofDepth(proof){let n=0;for(;proof;proof=proof.basis)if(++n>4)break;return n;}
// A repair is an actual finite construction improvement, not a quota of Ts or
// a promise that an unseen partner will arrive. Center identity is exact.
function repairCertificate(origin,path,requiredGoal=null,initialNotches=S.notchPattern(origin.board)){
 if(!path?.length||path.length>4)return null;
 const fresh=S.notchPattern(origin.board);
 // A retained proof must regenerate its authority from its immutable origin.
 // Do not silently downgrade history-only established evidence to unknown.
 if(initialNotches.status==='broken'||initialNotches.status==='established'&&(fresh.status!=='established'||fresh.anchorRow!==initialNotches.anchorRow))return null;
 let state=origin,notches=initialNotches,debt=balance(origin.board)!==0,center=null,cleared=false,endpoint='supported-center';
 for(let i=0;i<path.length;i++){
  const step=path[i];if(!Array.isArray(step.witness)||step.witness.length>256)return null;const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1||step.witness.at(-1)!=='HD'||JSON.stringify(r.events[0])!==JSON.stringify(step.event))return null;
  const e=r.events[0],g=S.geometry(state.board,{notches});
  if(!cleared&&!e.lines&&g.center.patternSupport==='reference-supported'){
   const c=g.center.completions.find(c=>c.resultStatus==='level'&&c.piece===e.type&&sameCells(c.cells,e.cells));if(c)center={piece:c.piece,cells:c.cells.map(c=>c.slice())};
  }
  if(!cleared&&step.foundationStage){if(!Array.isArray(step.foundationStage.targets)||!step.foundationStage.targets.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger)))return null;const stage=foundationTransition(state.board,{state:r.state,event:e},notches);if(!stage||!sameCells(stage.targets,step.foundationStage.targets)||stage.level!==step.foundationStage.level)return null;center={piece:e.type,cells:e.cells.map(c=>c.slice())};endpoint='finite-foundation';}
  notches=validStep(state.board,{state:r.state,event:e},notches);if(!notches)return null;
  state=r.state;debt=debt||balance(state.board)!==0;cleared=cleared||e.lines>0;
  const goal={balance:balance(state.board)===0,center,...(endpoint==='finite-foundation'?{endpoint}:{})};
  if(requiredGoal?goalPaid(origin,path.slice(0,i+1),requiredGoal,initialNotches):(((debt&&goal.balance)||goal.center)&&(endpoint==='finite-foundation'?foundationEndpoint(state.board,notches):repairEndpoint(state.board,notches))))return{origin:clone(origin),steps:clone(path.slice(0,i+1)),goal:clone(requiredGoal||goal),consumed:0};
 }
 return null;
}
function checkedRepair(proof,current,depth=0){
 if(depth>=4||!proof||!Number.isInteger(proof.consumed)||proof.consumed<0||proof.kind&&proof.kind!=='visible-closure'||proof.kind==='visible-closure'&&proof.basis)return null;
 const P=getPlanner();let origin;try{origin=P.observe(proof.origin);}catch{return null;}
 if(R.validate(origin).length||origin.queue.length>6)return null;
 const basis=proof.basis?checkedRepair(proof.basis,origin,depth+1):null;if(proof.basis&&!basis)return null;
 const cert=proof.kind==='visible-closure'?closureCertificate(origin,proof.steps):repairCertificate(origin,proof.steps,basis?.goal);if(!cert||cert.steps.length!==proof.steps.length||proof.consumed>=cert.steps.length)return null;
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
 return{active:Boolean(emptyMode||empty||(!a.maintenanceScope&&a.maxHeight<=4&&a.left.height<2)),clear:null,repair:null,source:emptyMode&&O.eligible(raw)?{pattern:null}:null};
}
function updateSession(session,before,after,event){
 if(!session?.active)return{active:false,clear:null,repair:null,source:null};
 let repair=null;const old=session.repair;
 if(old){const checked=checkedRepair(old,before);if(checked&&JSON.stringify(checked.path[0].event)===JSON.stringify(event)){
   const r=R.replay(before,['HD']);if(r.valid&&publicMatch(r.state,after)&&old.consumed+1<old.steps.length)repair={...checked.proof,consumed:old.consumed+1};
 }}
 const sourceReplay=session.source&&!event?.lines?R.replay(before,['HD']):null;
 let source=null;
 if(sourceReplay?.valid&&sourceReplay.events.length===1&&JSON.stringify(sourceReplay.events[0])===JSON.stringify(event)&&sourcePublicMatch(sourceReplay.state,after)){
  const oldSource=session.source,meta=O.pattern(oldSource.pattern),matches=O.compatible(after.board,oldSource.pattern);
  if(oldSource.continuationSteps?.length===7){
   const pending=oldSource.pending,prior=oldSource.scoringSteps?.at(-1)?.after||oldSource.continuationSteps.at(-1).after;
   if(pending&&Array.isArray(oldSource.scoringSteps)&&oldSource.scoringSteps.length<6){
    const prefix=R.replay(pending.origin,pending.witness.slice(0,-1)),full=R.replay(pending.origin,pending.witness);
    if(sourcePublicMatch(prior,pending.origin)&&prefix.valid&&!prefix.events.length&&sourcePublicMatch(prefix.state,before)&&full.valid&&full.events.length===1&&JSON.stringify(full.events[0])===JSON.stringify(event)&&sourcePublicMatch(full.state,after)){
     source={...clone(oldSource),scoringSteps:oldSource.scoringSteps.concat([{witness:pending.witness.slice(),event:clone(event),after:clone(after)}])};delete source.pending;
    }
   }
   return{active:true,clear:null,repair:null,source};
  }
  if(matches.some(p=>p.mask!==127)||meta?.stage==='second-bag'&&matches.some(p=>p.mask===127))source=clone(oldSource);
  // History is attached to accepted full witnesses, never inferred from seven
  // unrelated HD poses or from an imported matching footprint.
  if(meta?.stage==='first-bag'){
   let history=null;const pending=oldSource.pending,h=oldSource.history;
   if(h&&pending&&h.steps.length<7){
    const origin=h.steps.at(-1)?.after||h.origin;
    const prefix=R.replay(pending.origin,pending.witness.slice(0,-1)),full=R.replay(pending.origin,pending.witness);
    if(sourcePublicMatch(origin,pending.origin)&&prefix.valid&&!prefix.events.length&&sourcePublicMatch(prefix.state,before)&&full.valid&&full.events.length===1&&JSON.stringify(full.events[0])===JSON.stringify(event)&&sourcePublicMatch(full.state,after))history={...clone(h),steps:h.steps.concat([{witness:pending.witness.slice(),event:clone(event),after:clone(after)}])};
   }
   if(source){source.history=history;delete source.pending;}
   if(['buri-01','buri-02'].includes(meta.id)&&matches.some(p=>p.mask===127)&&history?.steps.length===7)source={pattern:null,continuationFrom:meta.id,history,continuationSteps:[]};
  }else if(meta?.stage==='second-bag'&&source){
   const pending=oldSource.pending,origin=oldSource.continuationSteps?.at(-1)?.after||oldSource.history?.steps?.at(-1)?.after;
   if(!pending||!origin)source=null;
   else{
    const prefix=R.replay(pending.origin,pending.witness.slice(0,-1)),full=R.replay(pending.origin,pending.witness);
    if(!sourcePublicMatch(origin,pending.origin)||!prefix.valid||prefix.events.length||!sourcePublicMatch(prefix.state,before)||!full.valid||full.events.length!==1||JSON.stringify(full.events[0])!==JSON.stringify(event)||!sourcePublicMatch(full.state,after))source=null;
    else{source.continuationSteps=(oldSource.continuationSteps||[]).concat([{witness:pending.witness.slice(),event:clone(event),after:clone(after)}]);delete source.pending;if(source.continuationSteps.length===7)source.scoringSteps=[];}
   }
  }
 }

 return{active:true,clear:event?.lines&&S.canonicalClear(event)?{before:clone(before),event:clone(event)}:null,repair,source};
}
function acceptResult(session,result){
 if(session?.active&&result?.phase==='maintenance'&&result?.evidence?.openingHandoff)return{active:false,clear:null,repair:null,source:null};
 if(session?.active&&result?.evidence?.opening){
  const proof=result.evidence.opening.sourcePlan,scoring=result.evidence.opening.scoringPlan;let source=session.source||null;
  if(scoring){
   // A replacement may change only the still-unexecuted suffix. Its complete
   // original-root proof is regenerated before advice and on every retention.
   const nextRoute=scoring.source.scoringRoute,oldRoute=source?.scoringRoute,n=source?.scoringSteps?.length;
   const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
   const routeConnected=!oldRoute?n===0:same(oldRoute,nextRoute)||same(oldRoute.origin,nextRoute?.origin)&&same(oldRoute.steps.slice(0,n),nextRoute?.steps?.slice(0,n));
   source=source&&routeConnected&&scoringSourceIdentity({...source,scoringRoute:nextRoute,scoringDecisionOffset:scoring.source.scoringDecisionOffset})===scoringSourceIdentity(scoring.source)?{...clone(source),scoringRoute:clone(nextRoute),scoringDecisionOffset:scoring.source.scoringDecisionOffset,pending:{origin:clone(scoring.origin),witness:scoring.steps[0].witness.slice()},scoringRemaining:clone(scoring.steps.slice(1)),scoringCorridor:scoring.corridor}:null;
  }

  if(proof){
   const meta=O.pattern(proof.id);
   if(meta?.stage==='second-bag')source=source?.history&&source.continuationFrom===meta.basePattern?{...clone(source),pattern:proof.id,pending:{origin:clone(proof.origin),witness:proof.steps[0].witness.slice()}}:null;
   else{
    const history=source?.history||(source&&O.eligible(proof.origin)?{origin:clone(proof.origin),steps:[]}:null);
    source={pattern:proof.id,history,pending:history?{origin:clone(proof.origin),witness:proof.steps[0].witness.slice()}:null};
   }
  }
  return{...session,repair:result.evidence.opening.repair?clone(result.evidence.opening.repair):null,source};
 }
 return session;
}
function sourcePublicMatch(expected,actual){
 if(!expected||!actual||!Array.isArray(expected.queue)||!Array.isArray(actual.queue))return false;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(!publicMatch(expected,actual)||expected.rules!==actual.rules||expected.revision!==actual.revision)return false;
 let bag=expected.bag;for(const t of actual.queue.slice(expected.queue.length)){if(!bag)return false;bag=B.consume(bag,t);if(B.validate(bag).length)return false;}
 return same(bag,actual.bag);
}
// Recheck the recorded actual seven-lock construction before allowing a second
// goal. This certificate carries observations, not a generator or unseen queue.
function checkedSourceHistory(history,baseId,spend){
 if(!['buri-01','buri-02'].includes(baseId)||!history||!O.eligible(history.origin)||!Array.isArray(history.steps)||history.steps.length!==7)return false;
 let current=history.origin,mask=0;
 for(const step of history.steps){
  if(!step||!step.after||R.validate(step.after).length||B.validate(step.after.bag).length||!Array.isArray(step.after.queue)||step.after.queue.length>6||!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||!spend(step.witness.length))return false;
  const r=R.replay(current,step.witness),next=O.compatible(step.after?.board,baseId)[0]?.mask;
  if(!r.valid||r.events.length!==1||r.events[0].lines||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!sourcePublicMatch(r.state,step.after)||next===undefined||(next&mask)!==mask||next===mask||((next^mask)&((next^mask)-1)))return false;
  current=step.after;mask=next;
 }
 return mask===127;
}
function checkedContinuationSource(source,origin,spend,complete=false){
 const meta=O.pattern(source?.pattern),base=source?.continuationFrom;
 if(meta&&meta.basePattern!==base||!checkedSourceHistory(source?.history,base,spend)||!Array.isArray(source.continuationSteps)||source.continuationSteps.length>(complete?7:6))return false;
 let current=source.history.steps.at(-1).after,mask=0;
 for(const step of source.continuationSteps){
  if(!meta||!step||!step.after||R.validate(step.after).length||B.validate(step.after.bag).length||!Array.isArray(step.after.queue)||step.after.queue.length>6||!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||!spend(step.witness.length))return false;
  const r=R.replay(current,step.witness),next=O.compatible(step.after.board,meta.id)[0]?.mask;
  if(!r.valid||r.events.length!==1||r.events[0].lines||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!sourcePublicMatch(r.state,step.after)||next===undefined||(next&mask)!==mask||next===mask||((next^mask)&((next^mask)-1)))return false;
  current=step.after;mask=next;
 }
 return (!complete||source.continuationSteps.length===7&&mask===127)&&sourcePublicMatch(current,origin);
}
// Exact source patterns are finite construction goals, not permission to enter
// maintenance. Only the actual visible inventory participates in the solver.
function sourceConstruction(state,options,notches,deadline,now,maxNodes){
 const P=getPlanner(),source=options.openingSource,selected=O.pattern(source?.pattern),second=selected?.stage==='second-bag'||Boolean(source?.continuationFrom);let visited=0,exhausted=false;
 const spend=n=>{if(now()>=deadline||visited+n>maxNodes){exhausted=true;return false;}visited+=n;return true;};
 if(second&&!checkedContinuationSource(source,state,spend))return{visited,unknown:exhausted};
 const found=O.solve(state,{preferredId:source?.pattern,continuationFrom:second?source.continuationFrom:null,deadline,now,maxNodes:maxNodes-visited});visited+=found.visited;
 if(!found.candidate)return{visited,unknown:found.unknown};
 const route=found.candidate,path=[];let current=state,phase=notches;
 for(const step of route.steps){
  if(now()>=deadline||visited+step.witness.length>maxNodes)return{visited,unknown:true};
  visited+=step.witness.length;const replay=R.replay(current,step.witness);
  if(!replay.valid||replay.events.length!==1||replay.events[0].lines||!O.compatible(replay.state.board,route.id).some(p=>p.mask===step.to))return{visited,unknown:false};
  // Finite seven-piece discovery may consume the last known active. This is
  // not executable advice until a real preview refill supplies its successor.
  if(!replay.state.active)break;
  const next=validStep(current.board,{state:replay.state,event:replay.events[0]},phase);if(!next)return{visited,unknown:false};phase=next;
  const witness=step.witness.slice(),event=replay.events[0];path.push({board:replay.state.board,target:event.target,event,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length});current=replay.state;
 }
 if(!path.length||now()>=deadline||visited>=maxNodes)return{visited,unknown:true};
 const access=P.checkAccessPrefix(state,path,{notches,deadline,now,maxNodes:maxNodes-visited});visited+=access.visited;
 if(access.reachable!==true||now()>=deadline||visited>maxNodes)return{visited,unknown:access.reachable===null||now()>=deadline};
 const pattern=O.pattern(route.id),first=path[0],end=facts(current.board,phase),complete=O.compatible(current.board,route.id).some(p=>p.mask===127);
 const sourcePlan={schemaVersion:1,id:route.id,...(second?{stage:'second-bag',basePattern:source.continuationFrom,history:clone(source.history),continuationSteps:clone(source.continuationSteps),variant:pattern.variant}:{}),origin:clone(state),steps:clone(path),consumed:0,pending:route.pending?clone(route.pending):null};
 return{visited,unknown:false,advice:{status:'recommended-with-verified-prefix',revision:state.revision,phase:'opening',target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:path,
  reason:`Build ${pattern.label}${second?', a conditional second-bag '+(pattern.variant==='derived-OJ-SL'?'derived target with swapped Center roofs':'community example target')+'. The source directs the second T to Left; the full layout is an example, not a universal recipe.':', a verified community opening pattern.'} Checked ${path.length} legal placement${path.length===1?'':'s'} using only visible pieces. ${complete?(second?'This visible prefix completes this conditional construction target.':'This visible prefix completes the source diagram.'):(second?'This is partial construction toward the conditional target; recheck after actual draws.':'This is partial construction toward the full diagram; recheck after actual draws.')} A source-pattern milestone does not switch to mid-game; the normal handoff remains separate.`,
  sources:[{id:route.id,label:pattern.label,url:pattern.url,section:'Section 2-1: normal-gravity 4n+2 opening templates',scope:second?'Second T to Left is explicit source guidance; the complete layout is a conditional example. '+(pattern.variant==='derived-OJ-SL'?'The swapped Center roof order is derived, not literal source advice. ':'')+'No unseen-piece or handoff guarantee.':'Exact full source diagram as a finite construction goal, not a scored handoff or a guarantee about unseen pieces.',...(second?{stage:'second-bag',variant:pattern.variant,provenance:pattern.provenance}:{} )}],assessment:P.assess(current.board),
  evidence:{opening:{status:'partial-construction',initial:facts(state.board,notches),endpoint:end,repair:null,sourcePlan,sourceEndpoint:complete?'exact-full-pattern':'exact-source-subset',unresolved:complete?[]:[second?'conditional target not yet complete in this visible prefix':'source diagram not yet complete in this visible prefix'],handoffCandidate:null},knownPieceHorizon:state.queue.length+1}}};
}
// Follow the original input prefix, including real HOLD/draw changes. No pose
// bridge or source-family replacement is inferred from a moved observation.
function retainSource(raw,previous,options={},action=null){
 const proof=previous?.evidence?.opening?.sourcePlan,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(!proof||proof.schemaVersion!==1||!O.pattern(proof.id)||!Number.isInteger(proof.consumed)||proof.consumed<0||!Array.isArray(proof.steps)||!proof.steps.length||proof.steps.length>7)return null;
 if(options.openingSource?.pattern&&options.openingSource.pattern!==proof.id)return null;
 const sourceMeta=O.pattern(proof.id),second=sourceMeta.stage==='second-bag';
 if(second&&(proof.stage!=='second-bag'||proof.basePattern!==sourceMeta.basePattern||proof.variant!==sourceMeta.variant||options.openingSource?.pattern!==proof.id||options.openingSource.continuationFrom!==proof.basePattern||!same(options.openingSource.history,proof.history)||!same(options.openingSource.continuationSteps,proof.continuationSteps)))return null;
 const original=proof.steps[0];
 for(const step of proof.steps)if(!Array.isArray(step.witness)||step.witness.length>256||step.witness.at(-1)!=='HD'||!same(step.target,step.event?.target)||step.hold!==step.witness.includes('HOLD')||step.holdCount!==step.witness.filter(a=>a==='HOLD').length)return null;
 const expected=proof.steps.map((step,i)=>{const witness=i?step.witness:step.witness.slice(proof.consumed);return{...step,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};});
 if(!same(previous.continuation,expected)||!same(previous.witness,expected[0].witness)||!same(previous.target,original.target)||previous.hold!==expected[0].hold||previous.holdCount!==expected[0].holdCount)return null;
 if(action!==null&&(action==='HD'||previous.witness[0]!==action))return null;
 const consumed=proof.consumed+(action!==null?1:0);if(consumed>=original.witness.length)return null;
 const P=getPlanner(),now=options.now??(()=>Date.now()),deadline=options.deadline??now()+100,limit=options.maxNodes??12000;let origin,state,visited=0;
 const spend=n=>{if(now()>=deadline||visited+n>limit)return false;visited+=n;return true;};
 try{
  if(second&&!checkedContinuationSource({pattern:proof.id,continuationFrom:proof.basePattern,history:proof.history,continuationSteps:proof.continuationSteps},proof.origin,spend))return null;
  try{origin=P.observe(proof.origin);state=P.observe(raw);}catch{return null;}
  if(origin.rules!==R.PROFILE.id||state.rules!==R.PROFILE.id||R.validate(origin).length||R.validate(state).length||B.validate(origin.bag).length||B.validate(state.bag).length||origin.queue.length>6||state.queue.length>6||now()>=deadline||limit<=0||!O.compatible(origin.board,proof.id).length)return null;
  if(!spend(consumed))return null;const prefix=R.replay(origin,original.witness.slice(0,consumed));if(!prefix.valid||prefix.events.length||!sourcePublicMatch(prefix.state,state))return null;
  const notches=P.resolvePatternHistory(state,options.patternHistory);if(notches.status==='invalid-history'||notches.status==='broken')return null;
  let current=state,phase=notches;const path=[];
  for(let i=0;i<proof.steps.length;i++){
   const step=proof.steps[i],witness=i?step.witness.slice():step.witness.slice(consumed);if(!spend(witness.length))return null;
   const replay=R.replay(current,witness);if(!replay.valid||replay.events.length!==1||!same(replay.events[0],step.event)||!same(replay.events[0].target,step.target)||!same(replay.state.board,step.board)||!O.compatible(replay.state.board,proof.id).length)return null;
   const next=validStep(current.board,{state:replay.state,event:replay.events[0]},phase);if(!next)return null;phase=next;
   path.push({...clone(step),witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length});current=replay.state;
  }
  // Reprove the unadvertised remainder too. A forged shortened prefix is not
  // authority to retain a source goal that current visible supply cannot finish.
  const remaining=O.solve(current,{preferredId:proof.id,now,deadline,maxNodes:Math.max(0,limit-visited)});visited+=remaining.visited;
  if(!remaining.candidate||remaining.unknown||now()>=deadline||visited>limit)return null;
  const access=P.checkAccessPrefix(state,path,{notches,now,deadline,maxNodes:Math.max(0,limit-visited)});visited+=access.visited;
  if(access.reachable!==true||now()>=deadline||visited>limit)return null;
  const first=path[0];return{...previous,revision:state.revision,target:first.target,witness:first.witness,hold:first.hold,holdCount:first.holdCount,continuation:path,retained:true,metrics:{...previous.metrics,certifiedHorizon:path.length,nodes:visited,revalidationNodes:visited},evidence:{...previous.evidence,opening:{...previous.evidence.opening,sourcePlan:{...clone(proof),consumed,pending:remaining.candidate.pending?clone(remaining.candidate.pending):null}},knownPieceHorizon:state.queue.length+1}};
 }finally{if(options.budgetTracker)options.budgetTracker.nodes+=visited;}
}
// Source scoring is a conditional finite proof after fourteen actual source
// locks, not a new opener definition or a rule against optional Left holes.
function scoringSourceIdentity(source){return JSON.stringify(source&&{pattern:source.pattern,continuationFrom:source.continuationFrom,history:source.history,continuationSteps:source.continuationSteps,scoringSteps:source.scoringSteps,scoringRoute:source.scoringRoute,scoringDecisionOffset:source.scoringDecisionOffset});}
function checkedScoringSource(source,origin,spend,now,deadline,maxNodes,record){
 if(!source||!Array.isArray(source.scoringSteps)||source.scoringSteps.length>5||source.continuationSteps?.length!==7)return null;
 const root=source.continuationSteps.at(-1)?.after;if(!root)return null;
 if(!spend(15)||!checkedContinuationSource(source,root,spend,true))return null;
 let current=root,notches=S.notchPattern(root.board);const path=[];
 for(const step of source.scoringSteps){
  if(!step?.after||R.validate(step.after).length||B.validate(step.after.bag).length||step.after.queue.length>6||!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||!spend(step.witness.length+1))return null;
  const r=R.replay(current,step.witness);
  if(!r.valid||r.events.length!==1||r.events[0].lines||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!sourcePublicMatch(r.state,step.after))return null;
  const next=validStep(current.board,{state:r.state,event:r.events[0]},notches);if(!next)return null;notches=next;
  path.push({board:r.state.board,event:r.events[0],witness:step.witness,target:r.events[0].target});current=step.after;
 }
 if(!sourcePublicMatch(current,origin))return null;
 if(path.length){if(!spend(path.reduce((n,p)=>n+p.witness.length,0)))return null;const access=getPlanner().checkAccessPrefix(root,path,{notches:S.notchPattern(root.board),now,deadline,maxNodes:maxNodes()});if(!record(access.visited)||access.reachable!==true)return null;}
 const route=source.scoringRoute;
 if(source.scoringSteps.length&&!route)return null;
 if(route){
  if(!route.origin||JSON.stringify(getPlanner().observe(root))!==JSON.stringify(getPlanner().observe(route.origin))||typeof route.corridor!=='boolean'||!Array.isArray(route.steps)||!route.steps.length||route.steps.length>6||source.scoringSteps.length>=route.steps.length)return null;
  for(let i=0;i<source.scoringSteps.length;i++){const actual=source.scoringSteps[i],expected=route.steps[i];if(JSON.stringify(actual.witness)!==JSON.stringify(expected.witness)||JSON.stringify(actual.event)!==JSON.stringify(expected.event)||JSON.stringify(actual.after.board)!==JSON.stringify(expected.board))return null;}
  if(source.scoringSteps.length&&JSON.stringify(source.scoringRemaining)!==JSON.stringify(route.steps.slice(source.scoringSteps.length+(source.pending?1:0))))return null;
  // Reprove the entire bound route using ONLY the original root14 supply.
  // Actual later refills may validate a suffix, never create a new authority.
  const baseSource={...source,scoringSteps:[]},baseRecords=[...source.history.steps,...source.continuationSteps],counts=Object.fromEntries([...'IJLOSTZ'].map(t=>[t,baseRecords.filter(s=>s.event.type===t).length]));
  const proof=Q.validate(root,route.steps,scoringOptions(baseSource,root,S.notchPattern(root.board),counts,now,deadline,maxNodes(),route.corridor));
  if(!record(proof.visited)||!proof.valid)return null;
 }
 const records=[...source.history.steps,...source.continuationSteps,...source.scoringSteps];
 return{records,counts:Object.fromEntries([...'IJLOSTZ'].map(t=>[t,records.filter(s=>s.event.type===t).length]))};
}
function scoringRightCap(board){
 const h=features(board).heights,wall=h[8],cap=h[9];
 return h[7]===0&&wall>=2&&cap===wall+1&&board.slice(40-wall).every(r=>r[8]!=='.')&&board[40-cap][9]!=='.'&&board[41-cap][9]!=='.'&&board.slice(42-cap).every(r=>r[9]==='.');
}
// The three-row peak difference is the existing conservative engineering
// interpretation of one overhang tier; the source gives no numeric tolerance.
function scoringQuality(source,root,path){
 const history=[...source.history.steps,...source.continuationSteps,...source.scoringSteps],all=[...history,...path];
 let t=0,tn=0,zn=0,zr=0,s=0,l=0,cap=null;
 for(let i=0;i<all.length;i++){
  const step=all[i],e=step.event,board=step.after?.board||step.board,last=i===all.length-1;
  if(!e||!S.canonicalClear(e)||e.topOut||e.lines&&!last)return false;
  if(e.type==='S')s++;if(e.type==='L')l++;
  if(e.type==='T'){
   t++;if(!e.lines&&e.cells.every(([x])=>x<7))tn++;
   else if(!(last&&e.lines===2&&e.spin==='full'&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7)))return false;
  }
  if(e.type==='Z'){
   if(!e.lines&&e.cells.every(([x])=>x<7))zn++;
   else if(!e.lines&&e.cells.every(([x])=>x>=8)&&scoringRightCap(board)){zr++;if(!cap)cap=e.cells.filter(([x])=>x===9);}
   else return false;
  }
 }
 const last=path.at(-1),e=last?.event,before=path.length>1?path.at(-2).board:root.board;
 if(!last||e.type!=='T'||e.lines!==2||e.spin!=='full'||t!==3||tn!==2||zn!==1||zr!==1||s!==l||!cap||cap.length!==2||!scoringRightCap(before)||!cap.every(([x,y])=>before[y][x]==='Z'&&e.clearedRows.includes(y)))return false;
 const f=features(last.board);return new Set(f.center).size===1&&Math.abs(Math.max(...f.left)-Math.max(...f.center))<=3;
}
function scoringOptions(source,state,notches,counts,now,deadline,maxNodes,corridor=true){return{notches,counts,now,deadline,maxNodes,corridor,callbacks:{validStep,facts,rank,compare,quality:(_end,path)=>scoringQuality(source,state,path),checkAccessPrefix:getPlanner().checkAccessPrefix}};}
function scoringAdvice(state,source,candidate,corridor,visited,telemetry={}){
 const path=clone(candidate.path),first=path[0],notches=candidate.notches,end=facts(candidate.state.board,notches);
 const boundSource={...clone(source),scoringRoute:source.scoringRoute||{origin:clone(state),steps:clone(path),corridor}};
 boundSource.scoringRemaining=clone(boundSource.scoringRoute.steps.slice(source.scoringSteps.length));
 const proof={schemaVersion:1,kind:'source-first-tsd',source:boundSource,origin:clone(state),steps:clone(path),consumed:0,corridor};
 delete proof.source.pending;delete proof.source.scoringCorridor;
 return{status:'recommended-with-verified-prefix',revision:state.revision,phase:'opening',target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:path,
  reason:`${first.hold?'Hold once. ':''}${first.event.lines?'Take the checked T-spin double.':`Place ${first.event.type} as shown.`} This checked visible sequence reaches the first Right T-spin double with balanced S/L use and a level Center. The normal handoff is checked only after the actual clear.`,
  sources:[{id:'SHOCKY-OPENING',label:"Shocky's ST Stacking Guide",url:'https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',section:'Chapter 2: Opening',scope:'Required T/Z allocation and opening quality; the three-row peak tolerance is an engineering interpretation, not a numeric source rule. This finite proof does not guarantee later play.'}],
  assessment:getPlanner().assess(candidate.state.board),metrics:{nodes:visited,depth:0,completeDepth:0,sourceScoring:telemetry},evidence:{opening:{status:'verified-source-first-tsd-prefix',initial:facts(state.board),endpoint:end,repair:null,scoringPlan:proof,unresolved:[],handoffCandidate:null},knownPieceHorizon:state.queue.length+1}};
}
function firstScoringPrefix(path){
 if(!Array.isArray(path))return null;
 const index=path.findIndex(p=>p.event?.type==='T'&&p.event.lines===2&&p.event.spin==='full'&&p.event.cells.every(([x])=>x>=6)&&p.event.cells.some(([x])=>x>=7));
 return index<0?null:path.slice(0,index+1);
}
function sourceScoring(state,options,notches,deadline,now,limit){
 const started=now(),source=options.openingSource;let visited=0;
 const left=()=>Math.max(0,limit-visited),spend=n=>{if(now()>=deadline||visited+n>limit)return false;visited+=n;return true;},record=n=>{visited+=n;return now()<deadline&&visited<=limit;};
 const telemetry={policy:'root-normal-ordinary-first-then-ranked-solid-Left; retained-goal-before-lock-boundary-ordinary-replan'};
 const ordinaryPlan=(normal=false)=>{const result=normal&&options.normalOpeningDecision?options.normalOpeningDecision():getPlanner().plan(state,{...options,disableSourceScoring:true,openingSource:null,maxNodes:left(),deadline});visited+=result.metrics?.nodes||0;return result;};
 // At the activation root, preserve the unchanged ordinary budget. Experimental
 // proof work is permitted only from what that normal decision actually leaves.
 let ordinary=source.scoringSteps?.length===0?ordinaryPlan(true):null;
 const fallback=()=>{const result=ordinary||ordinaryPlan();result.metrics={...result.metrics,nodes:visited,elapsedMs:now()-started,sourceScoring:telemetry};return result;};
 if(now()>=deadline||!left())return fallback();
 const history=checkedScoringSource(source,state,spend,now,deadline,left,record);telemetry.historyVerified=Boolean(history);
 if(!history)return fallback();
 const opts=(nodes=left(),end=deadline,corridor=true)=>scoringOptions(source,state,notches,history.counts,now,end,nodes,corridor);
 const advise=(candidate,corridor,extra,boundSource=source)=>{const result=scoringAdvice(state,boundSource,candidate,corridor,visited,{...telemetry,...extra});result.metrics.elapsedMs=now()-started;return result;};
 if(source.scoringSteps.length){
  const remaining=source.scoringRoute.steps.slice(source.scoringSteps.length);
  if(!remaining.length)return fallback();
  const saved=Q.validate(state,remaining,opts(left(),deadline,source.scoringRoute.corridor));visited+=saved.visited;
  if(!saved.valid||now()>=deadline||visited>limit)return fallback();
  const n=source.scoringSteps.length,marked={...source,scoringDecisionOffset:n};
  let retained=advise(saved.candidate,source.scoringRoute.corridor,{retainedAfterLock:true},marked);
  // Register only after the planner's normal final access boundary has checked
  // this exact object. No serialized flag may bypass that boundary later.
  if(typeof options.checkOpeningFallback!=='function')return retained;
  const before=visited;retained=options.checkOpeningFallback(retained);visited+=Math.max(0,(retained?.metrics?.nodes??before)-before);
  if(!retained?.target)return fallback();
  const keep=extra=>{retained.metrics={...retained.metrics,nodes:visited,elapsedMs:now()-started,sourceScoring:{...retained.metrics.sourceScoring,...extra}};return retained;};
  // One probe after an actual new lock only. Input movement/HOLD keeps the
  // precise target; repeated requests at this same boundary do not replan.
  if(source.scoringDecisionOffset===n||now()>=deadline||!left())return keep({ordinaryReplan:false});
  ordinary=ordinaryPlan();telemetry.ordinaryNodes=ordinary.metrics?.nodes||0;
  const prefix=firstScoringPrefix(ordinary.continuation);
  if(!prefix||prefix.length+n>6||now()>=deadline||!left())return keep({ordinaryReplan:true,replacement:false});
  const check=Q.validate(state,prefix,opts(left(),deadline,false));visited+=check.visited;
  if(!check.valid||now()>=deadline||!left())return keep({ordinaryReplan:true,replacement:false});
  // Conservative authority: even if an actual refill helped ordinary discovery,
  // the alternative must still be provable from the unchanged root14 supply.
  // Never splice newly revealed pieces into a historical observation.
  const route={origin:clone(source.scoringRoute.origin),steps:[...clone(source.scoringRoute.steps.slice(0,n)),...clone(check.candidate.path)],corridor:false};
  const replacement={...marked,scoringRoute:route,scoringRemaining:clone(check.candidate.path)};
  const rebound=checkedScoringSource(replacement,state,spend,now,deadline,left,record);
  if(!rebound||now()>=deadline||visited>limit)return keep({ordinaryReplan:true,replacement:false,rootSupplyRejected:!rebound});
  return advise(check.candidate,false,{ordinaryReplan:true,replacement:true,selected:'ordinary-complete-A-root-reproved'},replacement);
 }
 telemetry.ordinaryNodes=ordinary.metrics?.nodes||0;
 const prefix=firstScoringPrefix(ordinary.continuation);
 if(prefix){
  const check=Q.validate(state,prefix,opts(left(),deadline,false));visited+=check.visited;
  if(check.valid&&now()<deadline&&visited<=limit)return advise(check.candidate,false,{selected:'ordinary-complete-A'});
 }
 const found=Q.search(state,opts());visited+=found.visited;telemetry.search=found.telemetry;telemetry.unknown=found.unknown;
 if(found.candidate&&!found.unknown&&now()<deadline&&visited<=limit)return advise(found.candidate,true,{selected:'ranked-solid-Left-A'});
 return fallback();
}
function retainScoring(raw,previous,options={},action=null){
 if(options.disableOpeningSources||options.disableSourceScoring||options.disableOpening||options.openingPhase===false)return null;
 const proof=previous?.evidence?.opening?.scoringPlan,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(!proof||proof.schemaVersion!==1||proof.kind!=='source-first-tsd'||typeof proof.corridor!=='boolean'||!Number.isInteger(proof.consumed)||proof.consumed<0||!Array.isArray(proof.steps)||!proof.steps.length||proof.steps.length>6||scoringSourceIdentity(options.openingSource)!==scoringSourceIdentity(proof.source))return null;
 for(const step of proof.steps)if(!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||!same(step.target,step.event?.target)||step.hold!==step.witness.includes('HOLD')||step.holdCount!==step.witness.filter(a=>a==='HOLD').length)return null;
 const expected=proof.steps.map((step,i)=>{const witness=i?step.witness:step.witness.slice(proof.consumed);return{...step,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};});
 if(!same(previous.continuation,expected)||!same(previous.witness,expected[0].witness)||!same(previous.target,expected[0].target)||previous.hold!==expected[0].hold||previous.holdCount!==expected[0].holdCount||action!==null&&(action==='HD'||previous.witness[0]!==action))return null;
 const consumed=proof.consumed+(action!==null?1:0);if(consumed>=proof.steps[0].witness.length)return null;
 const P=getPlanner(),now=options.now||(()=>Date.now()),deadline=options.deadline??now()+100,limit=options.maxNodes??12000;let visited=0;
 const left=()=>Math.max(0,limit-visited),spend=n=>{if(now()>=deadline||visited+n>limit)return false;visited+=n;return true;},record=n=>{visited+=n;return now()<deadline&&visited<=limit;};
 try{
  let origin,state;try{origin=P.observe(proof.origin);state=P.observe(raw);}catch{return null;}
  if(origin.rules!==R.PROFILE.id||state.rules!==R.PROFILE.id||R.validate(origin).length||R.validate(state).length||B.validate(origin.bag).length||B.validate(state.bag).length||origin.queue.length>6||state.queue.length>6)return null;
  const history=checkedScoringSource(proof.source,origin,spend,now,deadline,left,record);if(!history||proof.source.scoringSteps.length+proof.steps.length>6||!proof.source.scoringRoute||!same(proof.steps,proof.source.scoringRoute.steps.slice(proof.source.scoringSteps.length))||proof.corridor!==proof.source.scoringRoute.corridor||!spend(consumed))return null;
  const prefix=R.replay(origin,proof.steps[0].witness.slice(0,consumed));if(!prefix.valid||prefix.events.length||!sourcePublicMatch(prefix.state,state))return null;
  const notches=P.resolvePatternHistory(state,options.patternHistory);if(notches.status!=='established')return null;
  const path=proof.steps.map((step,i)=>{const witness=i?step.witness:step.witness.slice(consumed);return{...clone(step),witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};});
  const checked=Q.validate(state,path,scoringOptions(proof.source,state,notches,history.counts,now,deadline,left(),proof.corridor));visited+=checked.visited;
  if(!checked.valid||now()>=deadline||visited>limit)return null;
  const first=path[0];return{...previous,revision:state.revision,target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:path,retained:true,metrics:{...previous.metrics,certifiedHorizon:path.length,nodes:visited,revalidationNodes:visited},evidence:{...previous.evidence,opening:{...previous.evidence.opening,scoringPlan:{...clone(proof),consumed}},knownPieceHorizon:state.queue.length+1}};
 }finally{if(options.budgetTracker)options.budgetTracker.nodes+=visited;}
}

function handoff(state,proof,options){
 const P=getPlanner(),summary=options.resourceContext?RH.resolve(state,RH.importContext(state,options.resourceContext)):null;
 // A first double does not erase an observed opening-Z obligation. Unknown
 // imported history retains the legacy actual-clear/geometry handoff path.
 if(summary?.openingAllocation?.requiredNonRightZ===1)return null;
 const historical=summary?.coverage?.status==='complete'&&summary.openingAllocation?.status==='verified-first-tsd'&&summary.extraZ?.baseline&&['available','used'].includes(summary.extraZ.status);
 let event=null;
 if(proof?.before&&proof.event){try{
  const before=P.observe(proof.before);if(!R.validate(before).length){const r=R.replay(before,['HD']),e=r.events[0];
   if(r.valid&&r.events.length===1&&JSON.stringify(e)===JSON.stringify(proof.event)&&e.lines&&S.canonicalClear(e)&&JSON.stringify(r.state.board)===JSON.stringify(state.board)&&r.state.active?.type===state.active?.type&&r.state.hold===state.hold&&r.state.canHold===state.canHold&&r.state.queue.every((t,i)=>state.queue[i]===t))event=e;
  }
 }catch{}}
 if(!event&&!historical)return null;
 const f=facts(state.board);if(!handoffGeometry(state))return null;
 const now=options.now??(()=>Date.now()),deadline=options.deadline??Infinity;
 if(now()>=deadline)return null;
 const result=P.plan(state,{...options,disableOpening:true,openingPhase:false,openingClear:null,previous:null,commitment:null,constructionPrevious:null,maxNodes:Math.min(12000,options.maxNodes??45000),deadline:Math.min(deadline,now()+200)});
 if(!result?.target)return null;
 const evidence=event?{status:'checked-after-actual-clear',event:clone(event),balance:f.parity}:{status:'checked-after-observed-opening-quality',firstTsdAt:summary.openingAllocation.firstTsdAt,qualityAt:summary.extraZ.baseline.qualityAt,balance:f.parity};
 return{...result,phase:'maintenance',evidence:{...result.evidence,openingHandoff:evidence},reason:(event?'Opening handoff checked after the clear. ':'Opening handoff checked after observed allocation and quality completion. ')+result.reason};
}
function plan(raw,options={}){
 const P=getPlanner(),now=options.now??(()=>Date.now()),started=now(),deadline=options.deadline??started+(options.timeMs??750);
 const limit=Math.min(45000,Math.max(0,options.maxNodes??45000)),width=Math.min(10,Math.max(1,options.openingWidth??6)),depth=Math.min(4,Math.max(1,options.openingDepth??3));
 let state;try{state=P.observe(raw);}catch{return null;}
 const base={status:'no-supported-continuation-found',revision:state.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],phase:'opening',reason:'No checked opening construction was found within this search. You can continue manually.',metrics:{nodes:0,depth:0,completeDepth:0,elapsedMs:0},sources:[]};
 if(R.validate(state).length||state.queue.length>6||!state.active||state.topOut)return base;
 if(now()>=deadline||!limit)return{...base,status:'budget-exhausted'};
 const usage=options.usageTelemetry?{schemaVersion:1,scope:'opening',families:{ordinary:{enumerated:0,examined:0,admitted:0,ranked:0,deduplicatedRanked:0,budgetSkipped:0,selected:0},retainedRepair:{provided:Number(Boolean(options.openingRepair)),verified:0,selected:0},handoff:{actualClearProvided:Number(Boolean(options.openingClear)),probed:0,verified:0,selected:0}},rejections:{},access:{checked:0,witnessed:0,rejected:0,unknown:0,cacheHits:0},selected:null}:null;
 if(usage)base.metrics.usage=usage;
 const observedSummary=options.resourceContext?RH.resolve(state,RH.importContext(state,options.resourceContext)):null;
 const historicalHandoff=observedSummary?.coverage?.status==='complete'&&observedSummary.openingAllocation?.status==='verified-first-tsd'&&observedSummary.extraZ?.baseline&&['available','used'].includes(observedSummary.extraZ.status);
 const accepted=handoff(state,options.openingClear,{...options,deadline});if(accepted){if(usage){usage.families.handoff.verified=1;usage.families.handoff.selected=1;usage.selected={path:accepted.evidence.openingHandoff.status==='checked-after-actual-clear'?'actual-clear-handoff':'observed-quality-handoff',locks:accepted.continuation?.length||0};accepted.metrics={...accepted.metrics,usage};}return accepted;}
 // Reserve the complete handoff allowance even when an attempt abstains.
 const reserved=options.openingClear||historicalHandoff?Math.min(12000,limit):0;base.metrics.handoffReservedNodes=reserved;
 const initial=P.assess(state.board),initialFacts=facts(state.board,P.resolvePatternHistory(state,options.patternHistory));
 const observed=observedSummary?.openingAllocation;
 const allocationRequired=!options.disableOpeningAllocation&&observed?.requiredNonRightZ===1&&(observed.requiredNonRightT===0||observed.firstTsdAt!==null&&observed.counts.TNonRight===2)&&['pending','pending-opening-z'].includes(observed.status)&&observed.counts.T>=2&&['staggered-scoring-wall','cap-preparation'].includes(initialFacts.right);
 const qualityPending=observedSummary?.coverage?.status==='complete'&&observed?.status==='verified-first-tsd'&&observedSummary.extraZ?.status==='unknown'&&!observedSummary.extraZ.baseline&&!observedSummary.extraZ.allocations.length&&!observedSummary.extraZ.departures.length&&!observedSummary.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>=observed.firstTsdAt)?observedSummary.center.pending:[];
 base.metrics.openingAllocation={requiredNonRightZ:allocationRequired?1:null};
 base.metrics.openingAllocation.pendingCenterPartners=qualityPending.length;
 if(initial.maxHeight>=20||initialFacts.notches.status==='broken')return{...base,reason:'This opening needs a repair outside the supported construction search.'};
 if(!options.disableOpeningSources&&!options.disableSourceScoring&&!options.openingClear&&!options.openingRepair&&!options.commitment&&options.openingSource?.continuationSteps?.length===7){
  const scored=sourceScoring(state,options,initialFacts.notches,deadline,now,limit-reserved);
  if(scored)return scored;
 }
 // The session flag enables guidance, not an evaluator certificate. Every
 // source claim is still regenerated from literal geometry and public inputs.
 if(options.openingSource&&options.openingSource.continuationSteps?.length!==7&&(options.openingSource.continuationFrom&&!options.openingSource.pattern||!O.compatible(state.board,options.openingSource.pattern).some(p=>p.mask===127))&&!options.disableOpeningSources&&!options.openingRepair&&!options.openingClear&&!options.commitment){
  const source=sourceConstruction(state,options,initialFacts.notches,deadline,now,limit-reserved);base.metrics.nodes+=source.visited;base.metrics.sourceConstruction={nodes:source.visited,unknown:source.unknown,selected:Boolean(source.advice),verifiedLocks:source.advice?.continuation.length||0,endpointComplete:source.advice?.evidence.opening.sourceEndpoint==='exact-full-pattern'};
  if(source.advice){if(usage){usage.selected={path:'verified-source-pattern',locks:source.advice.continuation.length};usage.families.sourcePattern={selected:1,nodes:source.visited};}return{...base,...source.advice,metrics:{...base.metrics,depth:0,completeDepth:0,enumeration:'verified-source-subset-graph',elapsedMs:now()-started}};}
 }
 let saved=checkedRepair(options.openingRepair,state);
 if(saved)saved.allocationRank=allocationRank(saved.path,allocationRequired,qualityPending);
 const mayClear=initialFacts.notches.status==='established'&&[state.active.type,state.hold,...state.queue.slice(0,3)].some(t=>t==='T'||t==='I');
 const probeReserve=mayClear?Math.min(6000,Math.max(0,limit-reserved)):0;let searchLimit=limit-probeReserve;
 let searchDeadline=mayClear&&Number.isFinite(deadline)?deadline-Math.min(120,Math.max(0,deadline-now())/4):deadline;
 base.metrics.handoffProbeReservedNodes=probeReserve;
 // Rules transitions allocate new board arrays; within this synchronous search
 // they are immutable. Cache only raw read-only board facts here, never node
 // assessments that the maintenance planner decorates with proof authority.
 const featureCache=new WeakMap(),assessmentCache=new WeakMap();
 const rawFacts={usage,features:board=>{if(!featureCache.has(board))featureCache.set(board,features(board));return featureCache.get(board);},assess:board=>{if(!assessmentCache.has(board))assessmentCache.set(board,P.assess(board,{cavitiesOnly:true}));return assessmentCache.get(board);}};
 assessmentCache.set(state.board,initial);
 let beam=[{state,path:[],f:initialFacts,notches:initialFacts.notches,key:'',rank:[]}],best=null,stopped=false,stagedNext=[],searchDepth=depth,closure=null,tieExtension=null,allocationExtension=null;const extraRoots=new Set(),ambiguousRoots=new Set(),clearCandidates=[],repairCandidates=[];
 // Early, open thin-base construction only. Do not mix a fresh geometric
 // base-debt estimate with a different inherited scoring phase, or take
 // over the existing parity-repair/visible-closure families. The uncapped
 // floor must already have geometric partner-completion support; this is
 // not generic construction under an existing cap or a partner-arrival claim.
 const tieEligible=!options.disableOpeningRootTies&&!options.openingRepair&&!saved&&depth===3&&initialFacts.right==='cleared-base'&&initialFacts.centerStatus==='supported-partner-completion'&&initialFacts.notches.status==='established'&&S.notchPattern(state.board).status==='established'&&S.notchPattern(state.board).anchorRow===initialFacts.notches.anchorRow&&initialFacts.center.some(h=>h>0)&&initialFacts.baseDebt>0&&!initialFacts.buriedCenterVacancies.length&&!initialFacts.leftCovered&&initialFacts.parity===0;
 const stageMetrics={examined:0,attempted:0,verified:0,queued:0,nodes:0,unknown:0};base.metrics.foundationStages=stageMetrics;if(usage)usage.families.foundationStage={...stageMetrics,selectedPath:0,retainedGoal:0};
 const accessSafe=(node,bounds={})=>{if(node.accessProof?.reachable===true||node.accessProof?.reachable===false){if(usage)usage.access.cacheHits++;return node.accessProof.reachable;}const proof=P.checkAccessPrefix(state,node.path,{notches:initialFacts.notches,deadline:Math.min(deadline,bounds.deadline??Infinity),now,maxNodes:Math.min(bounds.maxNodes??Infinity,Math.max(0,limit-reserved-base.metrics.nodes))});base.metrics.nodes+=proof.visited;base.metrics.gapAccessNodes=(base.metrics.gapAccessNodes||0)+proof.visited;node.accessProof=proof;if(usage){usage.access.checked++;usage.access[proof.reachable===true?'witnessed':proof.reachable===false?'rejected':'unknown']++;}return proof.reachable===true;};
 if(saved&&!accessSafe(saved))saved=null;if(usage)usage.families.retainedRepair.verified=Number(Boolean(saved));
 for(let d=0;d<searchDepth;d++){
  const nodes=stagedNext;stagedNext=[];if(closure&&d===4)nodes.push(closure.node);
  for(const parent of beam){
   if(now()>=searchDeadline||base.metrics.nodes+reserved>=searchLimit){stopped=true;break;}
   const enumDeadline=performance.now()+Math.max(0,searchDeadline-now());
   const e=X.stagePlacements(parent.state,{deadline:enumDeadline,maxNodes:Math.min(2500,searchLimit-reserved-base.metrics.nodes)});base.metrics.nodes+=e.visited;if(!e.envelopeComplete)stopped=true;if(usage)usage.families.ordinary.enumerated+=e.placements.length;
   for(const p of e.placements){
    if(now()>=searchDeadline){stopped=true;break;}
    if(usage)usage.families.ordinary.examined++;
    const pattern=validStep(parent.state.board,p,parent.notches,rawFacts);if(!pattern)continue;
    const notch={pattern},f=rawFacts.features(p.state.board);
    const step={board:p.state.board,target:p.event.target,witness:p.witness,event:p.event,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length};
    if(usage){usage.families.ordinary.admitted++;usage.families.ordinary.ranked++;}
    const path=[...parent.path,step],key=JSON.stringify([p.state.board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')),p.state.active?.type,p.state.hold,p.state.queue,notch.pattern]);
    nodes.push({state:p.state,path,f,notches:notch.pattern,key,rank:rank(f,p.event,path),allocationRank:allocationRank(path,allocationRequired,qualityPending)});
   }
  }
  if(!nodes.length)break;
  // Staged/closure and retained families use the same authenticated root
  // obligation as ordinary nodes; no family silently receives a neutral rank.
  for(const node of nodes)node.allocationRank=allocationRank(node.path,allocationRequired,qualityPending);
  const unique=[...new Map(nodes.sort(compare).reverse().map(n=>[n.key,n])).values()].sort(compare);
  if(usage)usage.families.ordinary.deduplicatedRanked+=unique.length;
  for(const node of unique){if(now()>=deadline){stopped=true;break;}if(node.path.at(-1).event.lines&&handoffGeometry(node.state)&&(!allocationRequired||node.allocationRank[0]===1))clearCandidates.push(node);if(saved&&node.path.length===saved.path.length&&goalPaid(state,node.path,saved.goal,initialFacts.notches))repairCandidates.push(node);}
  best=unique.find(node=>now()<deadline&&accessSafe(node,tieExtension?{deadline:searchDeadline,maxNodes:Math.max(0,searchLimit-reserved-base.metrics.nodes)}:{}))||best;base.metrics.depth=d+1;if(!stopped)base.metrics.completeDepth=d+1;
  base.metrics.enumeration='reduced-stage-envelope-not-exhaustive';
  // Keep different first-piece/region/parity families alive, not just adjacent
  // poses of one greedy foundation. This does not make enumeration exhaustive.
  // A definitively rejected executed prefix cannot become returnable by adding
  // descendants under the current no-delayed-access-repair policy. Unknown
  // checks remain candidates; this is not an endpoint-shape pruning rule.
  const expandable=unique.filter(n=>n.accessProof?.reachable!==false);base.metrics.accessPrunedPrefixes=(base.metrics.accessPrunedPrefixes||0)+unique.length-expandable.length;
  const chosen=[],groups=new Set();for(const n of expandable){const e=n.path[0].event,g=[e.type,Math.floor(e.cells.reduce((s,c)=>s+c[0],0)/4/4),Math.sign(n.f.parity)].join(':');if(!groups.has(g)){chosen.push(n);groups.add(g);if(chosen.length>=width)break;}}
  for(const n of expandable)if(chosen.length<width&&!chosen.includes(n))chosen.push(n);
  // Completion priority must not prune every scoring-first ordering before its
  // already-visible Z can be examined. Preserve one such competitor inside the
  // SAME beam width; it earns no completed-allocation rank until an actual
  // subsequent placement pays the Z. Final selection still needs checked access.
  if(allocationRequired&&observed.firstTsdAt===null&&d+1<searchDepth){
   const scoringFirst=expandable.find(n=>n.allocationRank?.[0]===0&&n.path.some(p=>p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2)&&[n.state.active?.type,n.state.hold].includes('Z'));
   if(scoringFirst&&!chosen.includes(scoringFirst)){if(chosen.length>=width)chosen.pop();chosen.push(scoringFirst);base.metrics.openingAllocation.scoringFirstRetained=(base.metrics.openingAllocation.scoringFirstRetained||0)+1;}
  }
  if(tieEligible&&d===0){
   // Input effort alone must not collapse strategically tied root shapes.
   // Keep the original slots and at most two extra public first placements;
   // no piece/column/seed receives a score bonus or reserved winning slot.
   // Both sides belong to the ambiguity: movement can swap which witness
   // is cheaper without changing the strategic choice under examination.
   const original=chosen.slice(),family=n=>{const e=n.path[0].event;return[e.type,Math.floor(e.cells.reduce((s,c)=>s+c[0],0)/4/4),Math.sign(n.f.parity)].join(':');};
   for(const n of expandable){
    if(extraRoots.size>=2)break;if(chosen.includes(n))continue;
    const tied=original.filter(c=>family(c)===family(n)&&c.rank.slice(0,-1).every((v,i)=>v===n.rank[i]));
    if(tied.length){
     chosen.push(n);extraRoots.add(n.path[0]);ambiguousRoots.add(n.path[0]);for(const c of tied)ambiguousRoots.add(c.path[0]);
    }
   }
   base.metrics.rootTies={added:extraRoots.size,originalWidth:original.length,total:chosen.length};
  }
  // Ordinary beam slots remain intact. A checked single-lock completion of
  // an excluded foundation intermediate may enter only the NEXT lock layer.
  // Its future rank never competes against shallower nodes.
  if(!options.disableOpeningStages&&!stopped&&d+1<depth&&stageMetrics.nodes<2000){
   const stages=[],stageDeadline=Number.isFinite(searchDeadline)?Math.min(searchDeadline,now()+40):Infinity,stageFacts={...rawFacts,usage:null};let parents=0;
   for(const parent of expandable){
    if(chosen.includes(parent)||parent.path.some(p=>p.event.lines))continue;
    if(now()>=stageDeadline||base.metrics.nodes+reserved>=searchLimit||stageMetrics.nodes>=2000)break;
    const target=foundationTargets(parent.state.board,parent.notches);if(!target)continue;
    stageMetrics.examined++;if(parents>=6)break;parents++;
    const allowance=Math.min(2000-stageMetrics.nodes,searchLimit-reserved-base.metrics.nodes),found=foundationWitnesses(parent.state,target.cells,{deadline:stageDeadline,now,maxNodes:allowance});
    stageMetrics.attempted++;stageMetrics.nodes+=found.visited;base.metrics.nodes+=found.visited;if(found.unknown)stageMetrics.unknown++;
    for(const p of found.hits){
     if(now()>=stageDeadline||base.metrics.nodes+reserved>=searchLimit)break;
     const pattern=validStep(parent.state.board,p,parent.notches,stageFacts),stage=pattern&&foundationTransition(parent.state.board,p,parent.notches);if(!stage)continue;
     const step={board:p.state.board,target:p.event.target,witness:p.witness,event:p.event,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length,foundationStage:stage},path=[...parent.path,step],f=rawFacts.features(p.state.board),key=JSON.stringify([p.state.board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')),p.state.active?.type,p.state.hold,p.state.queue,pattern]);
     const node={state:p.state,path,f,notches:pattern,key,rank:rank(f,p.event,path),allocationRank:allocationRank(path,allocationRequired,qualityPending)},beforeAccess=base.metrics.nodes,access=accessSafe(node,{deadline:stageDeadline,maxNodes:Math.max(0,2000-stageMetrics.nodes)});stageMetrics.nodes+=base.metrics.nodes-beforeAccess;if(!access){if(node.accessProof?.reachable===null)stageMetrics.unknown++;continue;}stageMetrics.verified++;stages.push(node);
    }
   }
   if(stages.length){stagedNext=[stages.sort(compare)[0]];stageMetrics.queued++;}
  }
  // Optional closure extends all retained competitors at the same horizon.
  // A cutoff never replaces the checked nominal result with a partial layer.
  if(!options.disableOpeningClosure&&!saved&&!stopped&&depth===3&&d===2&&!clearCandidates.length&&Math.abs(initialFacts.parity)===2){
   const metrics={attempted:0,verified:0,nodes:0,unknown:0,selected:false};base.metrics.visibleClosure=metrics;
   const bounds=Math.min(2000,Math.max(0,searchLimit-reserved-base.metrics.nodes)),end=Number.isFinite(searchDeadline)?Math.min(searchDeadline,now()+50):Infinity,candidates=[];
   for(const parent of chosen){
    if(now()>=end||metrics.nodes>=bounds)break;metrics.attempted++;
    const found=closureWitness(state,parent,{deadline:end,now,maxNodes:bounds-metrics.nodes,notches:initialFacts.notches,raw:rawFacts});metrics.nodes+=found.visited;base.metrics.nodes+=found.visited;if(found.unknown)metrics.unknown++;
    for(const node of found.candidates){node.allocationRank=allocationRank(node.path,allocationRequired,qualityPending);const beforeAccess=base.metrics.nodes,ok=accessSafe(node,{deadline:end,maxNodes:Math.max(0,bounds-metrics.nodes)});metrics.nodes+=base.metrics.nodes-beforeAccess;if(ok){metrics.verified++;candidates.push(node);}}
    if(candidates.length)break;
   }
   if(candidates.length){closure={node:candidates.sort(compare)[0],nominal:best,clearCount:clearCandidates.length,repairCount:repairCandidates.length};searchDepth=5;
    // No actual clear candidate used the speculative probe-time reserve. Reuse
    // only that unspent window, preserving the absolute deadline and final
    // validation margin; actual-clear handoff work is never reclaimed.
    const extended=Number.isFinite(deadline)?Math.max(searchDeadline,deadline-30):searchDeadline;metrics.handoffReserveReleasedMs=Number.isFinite(deadline)?extended-searchDeadline:0;searchDeadline=extended;
   }
  }
  if(tieEligible&&!options.disableOpeningTieExtension&&extraRoots.size&&d===2&&!stopped&&!closure&&!clearCandidates.length&&!saved&&best?.path.length===3&&base.metrics.completeDepth===3&&chosen.some(n=>ambiguousRoots.has(n.path[0]))){
   // The tied coverage must still be alive. Compare every retained family
   // at one extra completed lock, keeping the nominal result on any cutoff.
   tieExtension={nominal:best,clearCount:clearCandidates.length,repairCount:repairCandidates.length,startNodes:base.metrics.nodes};searchDepth=4;
   searchLimit=Math.min(searchLimit,base.metrics.nodes+reserved+6000);searchDeadline=Number.isFinite(searchDeadline)?Math.min(searchDeadline,now()+200):Infinity;
   base.metrics.tieExtension={attempted:1,selected:false,nodes:0,complete:false};
  }
  // A known opening-Z obligation can leave its reviewed Center partner just
  // one lock beyond the nominal horizon (for example around a scoring clear).
  // Compare every retained competitor at that same extra lock, without new
  // beam slots, hidden supply or a larger request allowance. The indicated
  // partner is only a reason to search; the next layer must replay its pose.
  if(allocationRequired&&!options.disableOpeningAllocationCompletion&&!saved&&!closure&&!tieExtension&&!stopped&&depth===3&&d===2&&base.metrics.completeDepth===3&&best?.path.length===3&&chosen.some(n=>n.allocationRank?.[0]===1&&n.path.some(p=>p.event.type==='Z'&&p.event.cells.every(([x])=>x>=4&&x<7))&&S.geometry(n.state.board).center.completions.some(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported'&&[n.state.active?.type,n.state.hold].includes(c.piece)))){
   allocationExtension={nominal:best,clearCount:clearCandidates.length,repairCount:repairCandidates.length,startNodes:base.metrics.nodes};searchDepth=4;
   base.metrics.allocationCompletion={attempted:1,nominalDepth:depth,comparisonDepth:4,beamWidth:chosen.length,complete:false,selected:false,nodes:0};
  }
  beam=chosen;if(stopped)break;
 }
 if(allocationExtension){
  const complete=!stopped&&base.metrics.completeDepth===4&&best?.path.length===4&&now()<searchDeadline&&base.metrics.nodes+reserved<=searchLimit&&best.accessProof?.reachable===true;
  Object.assign(base.metrics.allocationCompletion,{nodes:base.metrics.nodes-allocationExtension.startNodes,complete,selected:complete});
  allocationExtension.candidate=complete?best:null;
  if(!complete){best=allocationExtension.nominal;clearCandidates.length=allocationExtension.clearCount;repairCandidates.length=allocationExtension.repairCount;}
 }
 if(tieExtension){
  const complete=!stopped&&base.metrics.completeDepth===4&&best?.path.length===4&&now()<searchDeadline&&base.metrics.nodes+reserved<=searchLimit&&best.accessProof?.reachable===true;
  Object.assign(base.metrics.tieExtension,{nodes:base.metrics.nodes-tieExtension.startNodes,complete,selected:complete});
  if(!complete){best=tieExtension.nominal;clearCandidates.length=tieExtension.clearCount;repairCandidates.length=tieExtension.repairCount;}
 }
 if(closure){
  const cost=best?.path.reduce((n,p)=>n+p.witness.length,0)||0;
  let proof=null;if(!stopped&&base.metrics.completeDepth===5&&now()<deadline&&base.metrics.nodes+reserved+cost<=limit){base.metrics.nodes+=cost;proof=closureCertificate(state,best.path,initialFacts.notches,rawFacts);}
  if(proof){best.closureProof=proof;base.metrics.visibleClosure.selected=true;}
  else{best=closure.nominal;clearCandidates.length=closure.clearCount;repairCandidates.length=closure.repairCount;}
 }
 // Probe only actual candidate post-clear public states, within this request's
 // remaining time/nodes. An unprobed or failed bounded search is not impossible.
 let verified=null,probeNodes=0;const seen=new Set(),probeResults=[];
 for(const node of clearCandidates.sort(compare)){
  if(now()>=deadline)break;if(!accessSafe(node))continue;
  const key=JSON.stringify([node.state.board,node.state.active,node.state.hold,node.state.queue]);if(seen.has(key))continue;seen.add(key);
  if(probeResults.length>=2||now()>=deadline||base.metrics.nodes+reserved>=limit)break;
  const allowance=Math.min(6000-probeNodes,limit-reserved-base.metrics.nodes);if(allowance<=0)break;
  // The hypothetical endpoint needs its own replay-bound history, not the
  // root's now-stale worker context. Project only public actions; no draws are
  // invented and this conditional proof never changes the live session.
  let virtual=state,history=options.patternHistory||P.startPatternHistory(state),resources=options.resourceContext?RH.importContext(state,options.resourceContext):RH.start(state);
  for(const step of node.path)for(const action of step.witness){const before=virtual,r=R.replay(before,[action]);virtual=r.state;resources=RH.applyAction(resources,before,action,virtual);if(action==='HD')history=P.updatePatternHistory(history,before,virtual,r.events[0]);}
  const resourceContext=RH.exportContext(node.state,resources);
  const result=P.plan(node.state,{...options,patternHistory:history,resourceContext,disableOpening:true,openingPhase:false,openingClear:null,openingRepair:null,previous:null,commitment:null,constructionPrevious:null,deadline,maxNodes:allowance});
  const spent=result.metrics?.nodes||0;probeNodes+=spent;base.metrics.nodes+=spent;
  probeResults.push({status:result.target?'verified':'unknown-bounded-search',locks:node.path.length,nodes:spent});
  if(result.target){node.handoffContinuation=result.continuation;verified=node;break;}
 }
 base.metrics.handoffProbes=probeResults;if(usage){usage.families.handoff.probed=probeResults.length;usage.families.handoff.verified=probeResults.filter(p=>p.status==='verified').length;}
 if(verified)best=verified;
 // An incidental deeper win outside the ambiguous group does not justify this
 // coverage-specific extension. Check after normal handoff priority too;
 // never filter or boost rivals to manufacture a tied-root winner.
 if(tieExtension&&base.metrics.tieExtension.complete&&!ambiguousRoots.has(best?.path[0])){
  best=tieExtension.nominal;verified=null;clearCandidates.length=tieExtension.clearCount;repairCandidates.length=tieExtension.repairCount;base.metrics.tieExtension.selected=false;base.metrics.tieExtension.nonAmbiguousRootWon=true;
 }
 let retained=false;
 if(saved){
  // A checked complete handoff is a stronger fulfilled goal. Otherwise compare
  // only equal-lock repair endpoints; unseen/pruned alternatives cannot win.
  if(!(verified&&proofDepth(saved.proof)<4&&goalPaid(state,verified.path,saved.goal,initialFacts.notches))){
   const replacement=repairCandidates.sort(compare).find(node=>now()<deadline&&accessSafe(node));
   if(replacement&&proofDepth(saved.proof)<4&&betterRank(replacement,saved))best=replacement;else{best=saved;retained=true;}
  }
 }
 if(base.metrics.visibleClosure)base.metrics.visibleClosure.selected=Boolean(best?.closureProof&&best!==verified&&!retained);
 if(base.metrics.allocationCompletion)base.metrics.allocationCompletion.selected=Boolean(allocationExtension.candidate&&best===allocationExtension.candidate);
 if(usage&&base.metrics.visibleClosure)usage.families.visibleClosure={...base.metrics.visibleClosure,selected:Number(base.metrics.visibleClosure.selected)};
 if(usage){usage.families.ordinary.budgetSkipped=usage.families.ordinary.enumerated-usage.families.ordinary.examined;Object.assign(usage.families.foundationStage,stageMetrics,{selectedPath:Number(Boolean(best?.path.some(p=>p.foundationStage))),retainedGoal:Number(retained&&saved?.goal.endpoint==='finite-foundation')});}
 base.metrics.elapsedMs=now()-started;base.metrics.repairRetained=retained;base.metrics.searchLimitReached=stopped;
 if(!best)return{...base,status:stopped?'budget-exhausted':base.status};
 base.metrics.openingAllocation.selectedRank=best.allocationRank||[0,0];
 if(usage){const path=retained?'retained-repair':best===verified?'verified-handoff':best.closureProof?'visible-closure':saved&&repairCandidates.includes(best)?'repair-replacement':'ordinary';usage.families.retainedRepair.selected=Number(retained);usage.families.handoff.selected=Number(best===verified);usage.families.ordinary.selected=Number(!retained&&best!==verified);usage.selected={path,locks:best.path.length,rank:best.rank.slice(),scoreComponents:rankComponents(best.f,best.path)};}
 const freshRepair=best.closureProof||repairCertificate(state,best.path,saved&&!retained?saved.goal:null,initialFacts.notches);
 const repair=retained?saved.proof:freshRepair&&saved?{...freshRepair,basis:clone(saved.proof)}:freshRepair;
 const first=best.path[0],end=facts(best.state.board,best.notches),hold=first.holdCount===2?'Hold twice. ':first.holdCount?'Hold once. ':'';
 const region=first.event.cells.every(([x])=>x<4)?'Left':first.event.cells.every(([x])=>x>=4&&x<7)?'Center':first.event.cells.every(([x])=>x>=7)?'Right':'foundation';
 const pending=[];if(end.parity)pending.push(`Left mino balance is ${end.parity>0?'+':''}${end.parity}; its repair is not yet proved`);if(end.centerStatus!=='level')pending.push('the Center top pattern is still under construction');if(end.centerFoundationStatus==='unfinished-lower-foundation')pending.push('the lower Center still has unfilled cells outside the intended notches');else if(end.centerFoundationStatus==='unknown-phase')pending.push('the lower Center foundation is not yet phase-verified');
 const allocationReason=allocationRequired&&best.allocationRank?.[0]===1?'This checked prefix pays the still-required opening Z outside the Right; scoring may come before or after it. ':'';
 const reason=hold+(retained?'Continue the checked construction repair. ':'')+allocationReason+(first.event.lines?`Take the checked ${first.event.lines===4?'Tetris':'T-spin double'} while building the opening.`:`Place ${first.event.type} in the ${region} to build the ST opening.`)+` Checked ${best.path.length} legal placement${best.path.length===1?'':'s'} using only visible pieces. `+(pending.length?pending.join('; ').replace(/^./,c=>c.toUpperCase())+'. ':'This prefix has balanced Left minos and a level Center. ')+ (best.handoffContinuation?'This prefix reaches a checked maintenance continuation; the handoff will be rechecked after the actual clear. ':'')+'This is partial construction, not a completed opening or proof of future piece availability.';
 if(best.path.some(p=>p.foundationStage))base.metrics.foundationStageSelected=true;
 const sources=[{id:'SHOCKY-OPENING',label:"Shocky's ST Stacking Guide",url:'https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',section:'Chapters 1–4: regions, construction and mino parity',scope:'Community background for opening construction. The coach checks this finite prefix; the guide does not certify this exact move or future availability.'}];
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:best.path,reason,sources,assessment:P.assess(best.state.board),evidence:{opening:{status:'partial-construction',initial:initialFacts,endpoint:end,unresolved:pending,repair,handoffCandidate:best.handoffContinuation?{status:'verified-public-post-clear-continuation',continuation:best.handoffContinuation}:null},knownPieceHorizon:state.queue.length+1}};
}

// Session imports carry evidence, never a trusted source-family flag. Reuse the
// live proof checks, with a bounded replay budget, before restoring metadata.
function validateSessionState(raw,session,{maxNodes=45000,timeMs=1500,now=()=>Date.now()}={}){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),warnings=[];
 if(!session||typeof session.active!=='boolean')throw Error('Invalid opening phase.');
 if(!session.active){if(session.clear||session.repair||session.source)throw Error('Inactive opening has contradictory coaching metadata.');return{session:{active:false,clear:null,repair:null,source:null},warnings};}
 const result={active:true,clear:null,repair:null,source:null},deadline=now()+timeMs;let visited=0;
 const spend=n=>{visited+=n;return visited<=maxNodes&&now()<deadline;},record=spend,left=()=>Math.max(0,maxNodes-visited);
 if(session.clear){try{const c=session.clear;if(R.validate(c.before).length||c.before.queue.length>6)throw Error('Invalid clear origin.');const r=R.replay(c.before,['HD']);if(r.valid&&r.events.length===1&&same(r.events[0],c.event)&&c.event.lines&&S.canonicalClear(c.event)&&same(r.state.board,raw.board)&&r.state.active?.type===raw.active?.type&&r.state.hold===raw.hold&&r.state.queue.every((t,i)=>raw.queue[i]===t))result.clear=clone(c);}catch{}if(!result.clear)warnings.push('Stale or invalid opening clear was discarded.');}
 if(session.repair){try{if(checkedRepair(session.repair,raw))result.repair=clone(session.repair);}catch{}if(!result.repair)warnings.push('Stale or invalid opening repair was discarded.');}
 if(session.source){try{
  const src=session.source,meta=O.pattern(src.pattern);let origin=src.pending?.origin||raw,valid=false;
  if(src.pending){
   const w=src.pending.witness;if(!Array.isArray(w)||!w.length||w.length>256||w.at(-1)!=='HD'||!spend(w.length))throw Error('Invalid source pending witness.');
   const full=R.replay(origin,w);if(!full.valid||full.events.length!==1)throw Error('Invalid pending source placement.');
   let current=R.createState(origin),found=sourcePublicMatch(current,raw);
   for(const action of w.slice(0,-1)){current=R.move(current,action);if(sourcePublicMatch(current,raw))found=true;}
   if(!found)throw Error('Source pending input prefix does not match position.');
  }
  if(src.continuationSteps?.length===7)valid=Boolean(checkedScoringSource(src,origin,spend,now,deadline,left,record));
  else if(src.continuationFrom)valid=checkedContinuationSource(src,origin,spend);
  else if(src.pattern===null&&!src.history&&!src.pending)valid=O.eligible(raw);
  else if(meta?.stage==='first-bag'&&src.history&&O.eligible(src.history.origin)&&Array.isArray(src.history.steps)&&src.history.steps.length<=7){
   let current=src.history.origin,mask=0;valid=true;
   for(const step of src.history.steps){
    if(!step?.after||R.validate(step.after).length||B.validate(step.after.bag).length||step.after.queue.length>6||!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||!spend(step.witness.length)){valid=false;break;}
    const r=R.replay(current,step.witness),next=O.compatible(step.after.board,meta.id)[0]?.mask;
    if(!r.valid||r.events.length!==1||r.events[0].lines||!same(r.events[0],step.event)||!sourcePublicMatch(r.state,step.after)||next===undefined||(next&mask)!==mask||next===mask||((next^mask)&((next^mask)-1))){valid=false;break;}
    current=step.after;mask=next;
   }
   valid=valid&&sourcePublicMatch(current,origin)&&O.compatible(raw.board,meta.id).length>0;
  }
  if(valid&&visited<=maxNodes&&now()<deadline)result.source=clone(src);
 }catch{}if(!result.source)warnings.push('Stale, unsupported or invalid opening source progress was discarded.');}
 return{session:result,warnings};
}

return Object.freeze({retainScoring,validateSessionState,balance,features,facts,repairEndpoint,foundationTargets,foundationTransition,foundationWitnesses,handoffGeometry,handoff,plan,retainSource,startSession,updateSession,acceptResult,repairCertificate,closureCertificate,checkedRepair,goalPaid});
});
