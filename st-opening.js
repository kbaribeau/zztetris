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
 const usage=options.usageTelemetry?{schemaVersion:1,scope:'opening',families:{ordinary:{enumerated:0,examined:0,admitted:0,ranked:0,deduplicatedRanked:0,budgetSkipped:0,selected:0},retainedRepair:{provided:Number(Boolean(options.openingRepair)),verified:0,selected:0},handoff:{actualClearProvided:Number(Boolean(options.openingClear)),probed:0,verified:0,selected:0}},rejections:{},access:{checked:0,witnessed:0,rejected:0,unknown:0,cacheHits:0},selected:null}:null;
 if(usage)base.metrics.usage=usage;
 const accepted=handoff(state,options.openingClear,{...options,deadline});if(accepted){if(usage){usage.families.handoff.verified=1;usage.families.handoff.selected=1;usage.selected={path:'actual-clear-handoff',locks:accepted.continuation?.length||0};accepted.metrics={...accepted.metrics,usage};}return accepted;}
 // Reserve the complete handoff allowance even when an attempt abstains.
 const reserved=options.openingClear?Math.min(12000,limit):0;base.metrics.handoffReservedNodes=reserved;
 const initial=P.assess(state.board),initialFacts=facts(state.board,P.resolvePatternHistory(state,options.patternHistory));
 if(initial.maxHeight>=20||initialFacts.notches.status==='broken')return{...base,reason:'This opening needs a repair outside the supported construction search.'};
 let saved=checkedRepair(options.openingRepair,state);
 const mayClear=initialFacts.notches.status==='established'&&[state.active.type,state.hold,...state.queue.slice(0,3)].some(t=>t==='T'||t==='I');
 const probeReserve=mayClear?Math.min(6000,Math.max(0,limit-reserved)):0,searchLimit=limit-probeReserve;
 let searchDeadline=mayClear&&Number.isFinite(deadline)?deadline-Math.min(120,Math.max(0,deadline-now())/4):deadline;
 base.metrics.handoffProbeReservedNodes=probeReserve;
 // Rules transitions allocate new board arrays; within this synchronous search
 // they are immutable. Cache only raw read-only board facts here, never node
 // assessments that the maintenance planner decorates with proof authority.
 const featureCache=new WeakMap(),assessmentCache=new WeakMap();
 const rawFacts={usage,features:board=>{if(!featureCache.has(board))featureCache.set(board,features(board));return featureCache.get(board);},assess:board=>{if(!assessmentCache.has(board))assessmentCache.set(board,P.assess(board,{cavitiesOnly:true}));return assessmentCache.get(board);}};
 assessmentCache.set(state.board,initial);
 let beam=[{state,path:[],f:initialFacts,notches:initialFacts.notches,key:'',rank:[]}],best=null,stopped=false,stagedNext=[],searchDepth=depth,closure=null;const clearCandidates=[],repairCandidates=[];
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
    nodes.push({state:p.state,path,f,notches:notch.pattern,key,rank:rank(f,p.event,path)});
   }
  }
  if(!nodes.length)break;
  const unique=[...new Map(nodes.sort(compare).reverse().map(n=>[n.key,n])).values()].sort(compare);
  if(usage)usage.families.ordinary.deduplicatedRanked+=unique.length;
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
     const node={state:p.state,path,f,notches:pattern,key,rank:rank(f,p.event,path)},beforeAccess=base.metrics.nodes,access=accessSafe(node,{deadline:stageDeadline,maxNodes:Math.max(0,2000-stageMetrics.nodes)});stageMetrics.nodes+=base.metrics.nodes-beforeAccess;if(!access){if(node.accessProof?.reachable===null)stageMetrics.unknown++;continue;}stageMetrics.verified++;stages.push(node);
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
    for(const node of found.candidates){const beforeAccess=base.metrics.nodes,ok=accessSafe(node,{deadline:end,maxNodes:Math.max(0,bounds-metrics.nodes)});metrics.nodes+=base.metrics.nodes-beforeAccess;if(ok){metrics.verified++;candidates.push(node);}}
    if(candidates.length)break;
   }
   if(candidates.length){closure={node:candidates.sort(compare)[0],nominal:best,clearCount:clearCandidates.length,repairCount:repairCandidates.length};searchDepth=5;
    // No actual clear candidate used the speculative probe-time reserve. Reuse
    // only that unspent window, preserving the absolute deadline and final
    // validation margin; actual-clear handoff work is never reclaimed.
    const extended=Number.isFinite(deadline)?Math.max(searchDeadline,deadline-30):searchDeadline;metrics.handoffReserveReleasedMs=Number.isFinite(deadline)?extended-searchDeadline:0;searchDeadline=extended;
   }
  }
  beam=chosen;if(stopped)break;
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
  let virtual=state,history=options.patternHistory||P.startPatternHistory(state);for(const step of node.path){const pre=R.replay(virtual,step.witness.slice(0,-1)).state,r=R.replay(pre,['HD']);history=P.updatePatternHistory(history,pre,r.state,r.events[0]);virtual=r.state;}
  const result=P.plan(node.state,{...options,patternHistory:history,disableOpening:true,openingPhase:false,openingClear:null,openingRepair:null,previous:null,commitment:null,constructionPrevious:null,deadline,maxNodes:allowance});
  const spent=result.metrics?.nodes||0;probeNodes+=spent;base.metrics.nodes+=spent;
  probeResults.push({status:result.target?'verified':'unknown-bounded-search',locks:node.path.length,nodes:spent});
  if(result.target){node.handoffContinuation=result.continuation;verified=node;break;}
 }
 base.metrics.handoffProbes=probeResults;if(usage){usage.families.handoff.probed=probeResults.length;usage.families.handoff.verified=probeResults.filter(p=>p.status==='verified').length;}
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
 if(base.metrics.visibleClosure)base.metrics.visibleClosure.selected=Boolean(best?.closureProof&&best!==verified&&!retained);
 if(usage&&base.metrics.visibleClosure)usage.families.visibleClosure={...base.metrics.visibleClosure,selected:Number(base.metrics.visibleClosure.selected)};
 if(usage){usage.families.ordinary.budgetSkipped=usage.families.ordinary.enumerated-usage.families.ordinary.examined;Object.assign(usage.families.foundationStage,stageMetrics,{selectedPath:Number(Boolean(best?.path.some(p=>p.foundationStage))),retainedGoal:Number(retained&&saved?.goal.endpoint==='finite-foundation')});}
 base.metrics.elapsedMs=now()-started;base.metrics.repairRetained=retained;base.metrics.searchLimitReached=stopped;
 if(!best)return{...base,status:stopped?'budget-exhausted':base.status};
 if(usage){const path=retained?'retained-repair':best===verified?'verified-handoff':best.closureProof?'visible-closure':saved&&repairCandidates.includes(best)?'repair-replacement':'ordinary';usage.families.retainedRepair.selected=Number(retained);usage.families.handoff.selected=Number(best===verified);usage.families.ordinary.selected=Number(!retained&&best!==verified);usage.selected={path,locks:best.path.length,rank:best.rank.slice(),scoreComponents:rankComponents(best.f,best.path)};}
 const freshRepair=best.closureProof||repairCertificate(state,best.path,saved&&!retained?saved.goal:null,initialFacts.notches);
 const repair=retained?saved.proof:freshRepair&&saved?{...freshRepair,basis:clone(saved.proof)}:freshRepair;
 const first=best.path[0],end=facts(best.state.board,best.notches),hold=first.holdCount===2?'Hold twice. ':first.holdCount?'Hold once. ':'';
 const region=first.event.cells.every(([x])=>x<4)?'Left':first.event.cells.every(([x])=>x>=4&&x<7)?'Center':first.event.cells.every(([x])=>x>=7)?'Right':'foundation';
 const pending=[];if(end.parity)pending.push(`Left mino balance is ${end.parity>0?'+':''}${end.parity}; its repair is not yet proved`);if(end.centerStatus!=='level')pending.push('the Center top pattern is still under construction');if(end.centerFoundationStatus==='unfinished-lower-foundation')pending.push('the lower Center still has unfilled cells outside the intended notches');else if(end.centerFoundationStatus==='unknown-phase')pending.push('the lower Center foundation is not yet phase-verified');
 const reason=hold+(retained?'Continue the checked construction repair. ':'')+(first.event.lines?`Take the checked ${first.event.lines===4?'Tetris':'T-spin double'} while building the opening.`:`Place ${first.event.type} in the ${region} to build the ST opening.`)+` Checked ${best.path.length} legal placement${best.path.length===1?'':'s'} using only visible pieces. `+(pending.length?pending.join('; ').replace(/^./,c=>c.toUpperCase())+'. ':'This prefix has balanced Left minos and a level Center. ')+ (best.handoffContinuation?'This prefix reaches a checked maintenance continuation; the handoff will be rechecked after the actual clear. ':'')+'This is partial construction, not a completed opening or proof of future piece availability.';
 if(best.path.some(p=>p.foundationStage))base.metrics.foundationStageSelected=true;
 const sources=[{id:'SHOCKY-OPENING',label:"Shocky's ST Stacking Guide",url:'https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',section:'Chapters 1–4: regions, construction and mino parity',scope:'Community background for opening construction. The coach checks this finite prefix; the guide does not certify this exact move or future availability.'}];
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:best.path,reason,sources,assessment:P.assess(best.state.board),evidence:{opening:{status:'partial-construction',initial:initialFacts,endpoint:end,unresolved:pending,repair,handoffCandidate:best.handoffContinuation?{status:'verified-public-post-clear-continuation',continuation:best.handoffContinuation}:null},knownPieceHorizon:state.queue.length+1}};
}
return Object.freeze({balance,features,facts,repairEndpoint,foundationTargets,foundationTransition,foundationWitnesses,handoffGeometry,handoff,plan,startSession,updateSession,acceptResult,repairCertificate,closureCertificate,checkedRepair,goalPaid});
});
