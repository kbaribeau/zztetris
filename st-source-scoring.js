/* Optional finite first-TSD proof search after an independently verified source
 * construction. This module grants no source-history or handoff authority.
 * Solid Left is a discovery corridor, never a universal placement rule. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-access')):factory(root.STRules,root.STAccess);if(typeof module==='object'&&module.exports)module.exports=api;else root.STSourceScoring=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,A){
'use strict';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),STOP=Symbol('source-scoring-budget');
const PRIMARY=new Set(['frontierNodes','guards','replayActions','accessNodes']);
const heights=b=>[0,1,2,3].map(x=>{const y=b.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
const solid=b=>heights(b).every((h,x)=>b.slice(40-h).every(r=>r[x]!=='.'));
const tsd=e=>e.type==='T'&&e.lines===2&&e.spin==='full'&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7);
const poseKey=a=>[a.type,a.x,a.y,a.rotation,a.type==='T'&&a.lastRotation?((a.lastRotation.to-a.lastRotation.from+4)%4!==2&&a.lastRotation.kickIndex===4?'upgrade':'rotation'):'none'].join(',');
function meter(options){
 const now=options.now||(()=>performance.now()),started=now(),limit=Math.min(45000,Math.max(0,options.maxNodes??45000)),deadline=Math.min(options.deadline??Infinity,started+1500);
 const stats={frontierNodes:0,guards:0,replayActions:0,accessNodes:0,moveAttempts:0,successorStates:0};let ceiling=limit,end=deadline;
 const visited=()=>stats.frontierNodes+stats.guards+stats.replayActions+stats.accessNodes;
 function charge(key,n=1){if(now()>=end||visited()+(PRIMARY.has(key)?n:0)>ceiling)throw STOP;stats[key]=(stats[key]||0)+n;}
 const move=(state,action)=>{charge('moveAttempts');const result=R.move(state,action);if(result!==state)charge('successorStates');return result;};
 return{now,started,limit,deadline,stats,visited,charge,move,setPhase:(c,d)=>{ceiling=c;end=d;},remaining:()=>Math.max(0,ceiling-visited()),end:()=>end,finish:()=>({nodes:visited(),elapsedMs:now()-started,primaryUnits:visited(),operations:{...stats},accounting:'Primary: expanded movement/drop candidates, guards, explicit/nested-prefix replay actions and returned access nodes. Other recorded operations are telemetry, not additional node charges.'})};
}
function callbacks(options){return options.callbacks||options;}
function countsAfter(counts,e){return{...counts,[e.type]:(counts[e.type]||0)+1};}
function acceptableRoot(state,options,m){m.charge('guards');return state&&R.validate(state).length===0&&state.active&&!state.topOut&&state.queue.length<=6&&options.notches?.status==='established'&&options.counts&&typeof options.counts==='object';}
function nodeKey(n,m){m.charge('dedupKeys');return JSON.stringify([heights(n.state.board),n.state.board.map(r=>r.slice(4)),n.state.rules,n.state.active,n.state.hold,n.state.queue,n.state.canHold,n.state.streamCursor,n.state.topOut,n.state.bag,n.notches,n.counts]);}
function rankNode(n,cb,m){m.charge('rankCalls');n.f=cb.facts(n.state.board,n.notches);n.rank=cb.rank(n.f,n.path.at(-1).event,n.path);n.key=JSON.stringify([n.state.board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')),n.state.active?.type,n.state.hold,n.state.queue,n.notches]);return n;}
function replay(state,witness,m,airOnly=false){let s=state,airY=state.active?.y;const events=[];for(const [index,action]of witness.entries()){m.charge('replayActions');const next=m.move(s,action);if(next===s)return null;if(airOnly&&action!=='HD'){if(action==='HOLD'){if(index!==0)return null;airY=next.active?.y;}else if(action==='SD'||next.active?.y!==airY)return null;}s=next;if(s.lastEvent)events.push(s.lastEvent);}return{state:s,events};}
// Validation is deliberately independent of discovery's profile deduplication.
// All colored boards/events and the real public inventory are replayed exactly.
function verify(state,path,options,m){
 const cb=callbacks(options),corridor=options.corridor!==false;if(!Array.isArray(path)||!path.length||path.length>6||!acceptableRoot(state,options,m)||corridor&&!solid(state.board))return null;
 let current=state,notches=options.notches,counts={...options.counts};const checked=[];
 for(let index=0;index<path.length;index++){
  const step=path[index],w=step?.witness;if(!Array.isArray(w)||!w.length||w.length>256||w.at(-1)!=='HD'||w.filter(a=>a==='HOLD').length>1)return null;
  const result=replay(current,w,m,corridor&&index<path.length-1);if(!result||result.events.length!==1||result.state.topOut||!result.state.active)return null;
  const event=result.events[0],last=index===path.length-1;
  if(!same(event,step.event)||!same(result.state.board,step.board)||step.target&&!same(step.target,event.target))return null;
  if(last?!tsd(event):event.lines!==0)return null;
  if(corridor&&!last&&(!'IJLOS'.includes(event.type)||!event.cells.every(([x])=>x<4)||!solid(result.state.board)))return null;
  m.charge('guards');const phase=cb.validStep(current.board,{state:result.state,event},notches);if(!phase)return null;
  if(corridor&&A.newlyCovered(current.board,result.state.board,event,phase).length)return null;
  counts=countsAfter(counts,event);checked.push({...step,board:result.state.board,event,target:event.target,witness:w.slice(),hold:w.includes('HOLD'),holdCount:w.filter(a=>a==='HOLD').length});current=result.state;notches=phase;
 }
 m.charge('qualityCalls');const quality=cb.quality(current,checked,counts);if(quality!==true&&quality?.qualified!==true)return null;
 // The access helper itself replays each witness but reports access nodes only.
 // Precharge that actual nested replay so it cannot disappear from accounting.
 m.charge('replayActions',checked.reduce((n,p)=>n+p.witness.length,0));m.charge('accessCalls');
 const access=cb.checkAccessPrefix(state,checked,{notches:options.notches,now:m.now,deadline:m.end(),maxNodes:m.remaining()});m.charge('accessNodes',access.visited||0);
 if(access.reachable===null)throw STOP;if(access.reachable!==true)return null;m.charge('proofChecks');
 return{state:current,notches,counts,path:checked,quality,access};
}
function validate(state,path,options={}){const m=meter(options);let candidate=null,unknown=false;try{candidate=verify(state,path,options,m);if(candidate){candidate=rankNode(candidate,callbacks(options),m);m.charge('finalChecks');}}catch(e){if(e!==STOP)throw e;unknown=true;candidate=null;}return{valid:Boolean(candidate),candidate,visited:m.visited(),unknown,telemetry:m.finish()};}
function* enumerate(parent,m){
 const roots=[{s:parent,w:[]}],held=m.move(parent,'HOLD');if(held!==parent&&!held.topOut&&held.active)roots.push({s:held,w:['HOLD']});
 function possibleTwoRows(board){m.charge('geometryFilters');const gaps=board.map(r=>[...r].filter(c=>c==='.').length).filter(n=>n>0&&n<=3).sort((a,b)=>a-b);return gaps.length>=2&&gaps[0]+gaps[1]<=4;}
 for(const rt of roots){
  if(!'IJLOST'.includes(rt.s.active.type))continue;const isT=rt.s.active.type==='T';if(isT&&!possibleTwoRows(rt.s.board))continue;
  const air=[rt],seenAir=new Set([poseKey(rt.s.active)]);
  for(let i=0;i<air.length;i++){m.charge('frontierNodes');const n=air[i];for(const act of ['L','R','CW','CCW','R180']){const s=m.move(n.s,act);if(s===n.s||s.active.y!==rt.s.active.y)continue;const k=poseKey(s.active);if(!seenAir.has(k)){seenAir.add(k);air.push({s,w:[...n.w,act]});}}}
  if(!isT){for(const n of air){m.charge('frontierNodes');const s=m.move(n.s,'HD');if(s.lastEvent)yield{state:s,event:s.lastEvent,witness:[...n.w,'HD']};}continue;}
  const q=[],seen=new Set();function addDrop(n){m.charge('dropConstructionStates');const run=[n];let cur=n;while(true){const s=m.move(cur.s,'SD');if(s===cur.s)break;m.charge('dropConstructionStates');cur={s,w:[...cur.w,'SD']};run.push(cur);}for(const k of run.slice(-4)){const key=poseKey(k.s.active);if(!seen.has(key)){seen.add(key);q.push(k);}}}
  for(const n of air)addDrop(n);
  for(let i=0;i<q.length;i++){m.charge('frontierNodes');const n=q[i];if(m.move(n.s,'SD')===n.s){const s=m.move(n.s,'HD');if(s.lastEvent)yield{state:s,event:s.lastEvent,witness:[...n.w,'HD']};}for(const act of ['L','R','CW','CCW','R180']){const s=m.move(n.s,act);if(s!==n.s)addDrop({s,w:[...n.w,act]});}}
 }
}
function search(state,options={}){
 const m=meter(options),cb=callbacks(options);let candidate=null,unknown=false,complete=false,goals=new Map(),layers=[];
 const compare=(a,b)=>{m.charge('comparisons');return cb.compare(a,b);};
 try{
  if(!acceptableRoot(state,options,m)||!solid(state.board))return{candidate:null,visited:m.visited(),unknown:false,complete:true,telemetry:m.finish()};
  const reserve=Math.min(6000,Math.floor(m.limit*2/15)),timeReserve=Math.min(300,Math.max(0,m.deadline-m.started)/5);
  m.setPhase(m.limit-reserve,m.deadline-timeReserve);
  let beam=[{state,notches:options.notches,path:[],counts:{...options.counts}}];
  for(let depth=1;depth<=6&&beam.length;depth++){
   const next=new Map(),layer={depth,complete:false};layers.push(layer);
   for(const parent of beam){m.charge('parentStates');for(const p of enumerate(parent.state,m)){
    m.charge('candidateChecks');const e=p.event,scored=tsd(e);
    if(!scored&&(e.lines||!'IJLOS'.includes(e.type)||!e.cells.every(([x])=>x<4)||!solid(p.state.board)))continue;if(!p.state.active)continue;
    m.charge('guards');const notches=cb.validStep(parent.state.board,p,parent.notches);if(!notches)continue;m.charge('accessProjections');if(A.newlyCovered(parent.state.board,p.state.board,e,notches).length)continue;
    const step={board:p.state.board,target:e.target,witness:p.witness,event:e,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length};
    const n=rankNode({state:p.state,notches,path:[...parent.path,step],counts:countsAfter(parent.counts,e)},cb,m),key=nodeKey(n,m),map=scored?goals:next,old=map.get(key);
    if(!old||compare(n,old)<0)map.set(key,n);
   }}
   Object.assign(layer,{complete:true,retained:next.size,goalAlternatives:goals.size});beam=[...next.values()];
  }
  complete=true;m.setPhase(m.limit,m.deadline);const ranked=[...goals.values()].sort(compare);
  // Select the highest existing-comparator A-qualified goal only after the
  // entire six-lock collection completed. A budget miss is not invalidity.
  for(const n of ranked){const checked=verify(state,n.path,{...options,corridor:true},m);if(checked){candidate={...n,...checked};break;}}
  m.charge('finalChecks');
 }catch(e){if(e!==STOP)throw e;unknown=true;candidate=null;}
 return{candidate,visited:m.visited(),unknown,complete:complete&&!unknown,telemetry:{...m.finish(),collectionComplete:complete,layers,discoveredAlternatives:goals.size}};
}
return Object.freeze({search,validate});
});
