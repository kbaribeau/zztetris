/* Bounded source-subset discovery over actual public inventory. Source pattern
 * completion is distinct from the opening-to-maintenance lifecycle. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-bag'),require('./st-opening-patterns'),require('./st-opening-continuations')):factory(root.STRules,root.STBag,root.STSourcePatterns,root.STSourceContinuations);if(typeof module==='object'&&module.exports)module.exports=api;else root.STOpeningSources=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,data,continuations){
'use strict';
function createSolver({rules:R,data}){
 const TYPES=data.types,bit=t=>1<<TYPES.indexOf(t),decode=s=>[...s].map(c=>data.actionCodes[c]);
 const patterns=data.patterns.concat(continuations.patterns).map(p=>({...p,board:Array(40-p.rows.length).fill('..........').concat(p.rows),edgeMap:new Map(p.edges.map(([mask,type,witness])=>[mask+':'+type,{from:mask,to:mask|bit(type),type,witness:decode(witness)}]))}));
 const byId=new Map(patterns.map(p=>[p.id,p]));
 const cellsKey=cells=>cells.map(c=>c.join(',')).sort().join(';');
 const sameBoard=(a,b)=>Array.isArray(a)&&a.length===40&&a.every((row,y)=>row===b[y]);
 function compatible(board,id){
  const p=byId.get(id);if(!p||!Array.isArray(board)||board.length!==40)return null;
  const counts=Object.fromEntries([...TYPES].map(t=>[t,0]));
  for(let y=0;y<40;y++){if(typeof board[y]!=='string'||board[y].length!==10)return null;for(let x=0;x<10;x++){const t=board[y][x];if(p.baseBoard?.[y][x]!==undefined&&p.baseBoard[y][x]!=='.'){if(t!==p.baseBoard[y][x])return null;continue;}if(t==='.')continue;if(t!==p.board[y][x]||!TYPES.includes(t))return null;counts[t]++;}}
  let mask=0;for(const t of TYPES){if(counts[t]!==0&&counts[t]!==4)return null;if(counts[t]===4)mask|=bit(t);}return mask;
 }
 function subsetBoard(p,mask){return p.board.map((row,y)=>[...row].map((t,x)=>p.baseBoard?.[y][x]!==undefined&&p.baseBoard[y][x]!=='.'?p.baseBoard[y][x]:t!=='.'&&(mask&bit(t))?t:'.').join(''));}
 function pattern(id){const p=byId.get(id);return p?JSON.parse(JSON.stringify({id:p.id,label:p.label||'Buri '+p.id.slice(-2),stage:p.stage||'first-bag',basePattern:p.basePattern||null,variant:p.variant||null,provenance:p.provenance||null,rows:p.rows,board:p.board,targets:p.targets,url:p.url,imageSha256:p.imageSha256})):null;}
 function solve(input,{preferredId=null,continuationFrom=null,deadline=Infinity,now=()=>Date.now(),maxNodes=45000,charge=null}={}){
  let visited=0,replayInputs=0,unknown=false,rootPoseMismatch=false;const exhausted={};
  const spend=n=>{if(now()>=deadline||visited+n>maxNodes||(charge&&charge(n)===false)){unknown=true;throw exhausted;}visited+=n;};
  if(input?.rules!==data.profile||R.validate(input).length||input.queue.length>6||input.topOut)return{candidate:null,visited,replayInputs,unknown:false,reason:'unsupported-observation',rootPoseMismatch};
  const origin=R.createState(input);
  if(preferredId&&(!byId.has(preferredId)||compatible(origin.board,preferredId)===null))return{candidate:null,visited,replayInputs,unknown:false,reason:'preferred-family-incompatible',rootPoseMismatch};
  // A retained family is exclusive. Never silently switch it after a lock.
  const ordered=preferredId?[byId.get(preferredId)]:patterns.filter(p=>continuationFrom?p.basePattern===continuationFrom:!p.basePattern).sort((a,b)=>(a.priority??0)-(b.priority??0)||a.id.localeCompare(b.id));
  // Per-call cache only. No result crosses a source/session/history revision.
  // All movement-sensitive fields are included, especially the full actual pose.
  const stateKey=(p,mask,s)=>JSON.stringify([data.provenance.guardedGraphSha256,p.id,mask,s.rules,s.board,s.active,s.hold,s.canHold,s.queue,s.streamCursor,s.topOut,s.bag??null]);
  try{for(const p of ordered){const initialMask=compatible(origin.board,p.id);if(initialMask===null)continue;const memo=new Map();
   function walk(state,mask,isRoot){
    spend(1);if(mask===127)return{steps:[],pending:null,status:'known-goal'};
    const key=stateKey(p,mask,state);if(memo.has(key))return memo.get(key);
    if(!state.active){
     // There is NO executable HOLD with active:null. This is goal discovery
     // only; wait for an actual visible draw before re-planning the final lock.
     const e=state.hold?p.edgeMap.get(mask+':'+state.hold):null;
     const result=e&&e.to===127?{steps:[],pending:{kind:'held-final',type:state.hold,from:mask,to:127,spawnWitness:e.witness.slice()},status:'held-final'}:null;
     memo.set(key,result);return result;
    }
    const roots=[{state,holds:0,prefix:[]}],seen=new Set([stateKey(p,mask,state)]);let held=state;
    for(let holds=1;holds<=2;holds++){spend(1);replayInputs++;const next=R.move(held,'HOLD');if(next===held||next.topOut)break;held=next;const hk=stateKey(p,mask,held);if(!seen.has(hk)){seen.add(hk);roots.push({state:held,holds,prefix:Array(holds).fill('HOLD')});}}
    for(const root of roots){const type=root.state.active?.type,e=type?p.edgeMap.get(mask+':'+type):null;if(!e)continue;
     const witness=root.prefix.concat(e.witness);spend(witness.length);replayInputs+=witness.length;
     // The cached spawn string is only a candidate. It is replayed from the
     // ACTUAL state, including moved coordinates and lastRotation. No reset.
     const replay=R.replay(state,witness),event=replay.events[0],expected=subsetBoard(p,e.to);
     if(!replay.valid||replay.events.length!==1||replay.state.topOut||R.validate(replay.state).length||event.type!==type||event.lines!==0||!sameBoard(replay.state.board,expected)||cellsKey(event.cells)!==cellsKey(p.targets[type])){
      if(isRoot&&root.holds===0&&JSON.stringify(state.active)!==JSON.stringify(R.spawn(state.active.type)))rootPoseMismatch=true;
      continue;
     }
     const suffix=walk(replay.state,e.to,false);if(!suffix)continue;
     const step={from:mask,to:e.to,type,holds:root.holds,witness,target:event.target,event,board:replay.state.board,state:replay.state};
     const result={...suffix,steps:[step,...suffix.steps]};memo.set(key,result);return result;
    }
    memo.set(key,null);return null;
   }
   const route=walk(origin,initialMask,true);if(route)return{candidate:{id:p.id,mask:initialMask,...route,status:initialMask===127?'exact-goal':route.status},visited,replayInputs,unknown:false,rootPoseMismatch};
  }}catch(error){if(error!==exhausted)throw error;}
  return{candidate:null,visited,replayInputs,unknown:unknown||rootPoseMismatch,rootPoseMismatch,reason:unknown?'budget-exhausted':rootPoseMismatch?'no-cached-actual-pose-bridge':'no-known-source-route'};
 }
 return Object.freeze({solve,compatible,pattern});
}

const solver=createSolver({rules:R,data});
function compatible(board,id=null){return (id?[id]:data.patterns.map(p=>p.id)).map(id=>({id,mask:solver.compatible(board,id)})).filter(p=>p.mask!==null);}
function eligible(state){return state?.rules===R.PROFILE.id&&state.board?.length===40&&state.board.every(r=>r==='..........')&&state.active&&state.hold===null&&state.canHold&&state.streamCursor===1&&state.queue?.length===6&&new Set([state.active.type,...state.queue]).size===7&&!R.validate(state).length&&!B.validate(state.bag).length&&state.bag.provenance==='known-phase'&&state.bag.observedCount===7&&JSON.stringify(state.bag.remaining)==='[0]';}
return Object.freeze({solve:solver.solve,compatible,pattern:solver.pattern,eligible});
});
