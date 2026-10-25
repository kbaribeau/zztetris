'use strict';
// Offline accounting only. No planner dependency, search, score or strategy.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const R=require('../../st-rules'),B=require('../../st-bag'),TYPES='IJLOSTZ';
const REGIONS=Object.freeze([{id:'left',columns:[1,4],width:4},{id:'center',columns:[5,7],width:3},{id:'right',columns:[8,10],width:3}].map(r=>Object.freeze({...r,columns:Object.freeze(r.columns)})));
const clone=x=>JSON.parse(JSON.stringify(x)),zero=()=>[0,0,0],region=x=>x<4?0:x<7?1:2;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const identity=input=>digest({scenario:input.scenario,seed:input.seed,rng:input.rng,initial:input.initial,future:input.future});
const sum=a=>a.reduce((n,x)=>n+x,0),add=(a,b)=>a.map((v,i)=>v+b[i]),subtract=(a,b)=>a.map((v,i)=>v-b[i]);
function publicState(s){const v=R.createState(s);delete v.lastEvent;return v;}
function mass(board){const v=zero();for(const row of board)for(let x=0;x<10;x++)if(row[x]!=='.')v[region(x)]++;return v;}
function analyze(input,records,{origins=null,windowSizes=[7,14,28]}={}){
 assert.ok(input&&input.schemaVersion===1&&Number.isSafeInteger(input.locks)&&input.locks>=1&&input.locks<=2000,'Expected a bounded schema-1 episode input');
 assert.ok(input&&Array.isArray(input.future)&&input.future.length<=20000,'A bounded private source is required');
 assert.ok(input.future.every(t=>typeof t==='string'&&t.length===1&&TYPES.includes(t)),'Invalid source piece');
 assert.ok(Array.isArray(records)&&records.length<=2003&&records.filter(r=>r?.kind==='lock').length<=Math.min(2000,input.locks),'At most 2000 recorded locks within the evaluation cap are supported');
 assert.ok(Array.isArray(windowSizes)&&windowSizes.length<=16&&windowSizes.every(n=>Number.isSafeInteger(n)&&n>0&&n<=2000),'Invalid rolling windows');
 windowSizes=[...new Set(windowSizes)].sort((a,b)=>a-b);
 let state=R.createState(clone(input.initial)),cursor=0,locks=0,lines=0,actionsVerified=0;
 assert.deepEqual(R.validate(state),[]);assert.ok(state.queue.length<=6,'Only the public preview may be initially present');
 if(state.bag)assert.deepEqual(B.validate(state.bag),[]);
 const known=Boolean(origins?.known);
 if(known){assert.equal(origins.inputIdentityHash,identity(input),'Origins are not bound to these inputs');assert.equal(origins.schemaVersion,1);assert.equal(origins.method,'exact-generator-replay');assert.ok(Number.isInteger(origins.futureFirstBag)&&origins.futureFirstBag>=0);assert.ok(Number.isInteger(origins.futureFirstSlot)&&origins.futureFirstSlot>=0&&origins.futureFirstSlot<7);}
 const source=known?clone(origins):{schemaVersion:1,known:false,method:'unknown',reason:origins?.reason||'No verified original-bag provenance',inputIdentityHash:identity(input)};
 const bags=new Map(),tokens=new Map(),placed=zero(),cleared=zero(),initial=mass(state.board),rows=[],byPiece=Object.fromEntries([...TYPES].map(t=>[t,{locks:0,placed:zero()}]));
 function bagFor(index){const id=index===null?'unknown':'bag-'+(index+1);if(!bags.has(id))bags.set(id,{id,index,unknown:index===null,initial:zero(),placed:zero(),cleared:zero(),remaining:zero(),priorUnattributedPieces:index!==null&&index===source.futureFirstBag&&!source.initialBagKnown?source.futureFirstSlot:0});return bags.get(id);}
 function token(type,id,index=null,slot=null){const b=bagFor(index);assert.ok(!tokens.has(id),'Duplicate source token');const t={id,type,bagId:b.id,bagIndex:index,sourceSlot:slot===null?null:slot+1,lockedAt:null};tokens.set(id,t);return t;}
 const initialKnown=known&&source.initialBagKnown;
 if(initialKnown){assert.ok(state.board.every(r=>r==='..........'));assert.equal(state.hold,null);assert.equal(state.queue.length,6);assert.equal(state.streamCursor,1);}
 let active=state.active?token(state.active.type,initialKnown?'bag-1:piece-1':'unknown:initial-active',initialKnown?0:null,initialKnown?0:null):null;
 let held=state.hold?token(state.hold,'unknown:initial-held'):null;
 let queue=state.queue.map((t,i)=>token(t,initialKnown?`bag-1:piece-${i+2}`:`unknown:initial-preview-${i}`,initialKnown?0:null,initialKnown?i+1:null));
 let owners=state.board.map(row=>[...row].map((type,x)=>{if(type==='.')return null;const b=bagFor(null);b.initial[region(x)]++;return{type,bagId:b.id,id:null};}));
 const brief=t=>t?{id:t.id,type:t.type,bagId:t.bagId,sourceSlot:t.sourceSlot}:null;
 function reveal(type,index){if(!known)return token(type,'unknown:future-'+index);const position=source.futureFirstSlot+index,bag=source.futureFirstBag+Math.floor(position/7),slot=position%7;return token(type,`bag-${bag+1}:piece-${slot+1}`,bag,slot);}
 function reconcile(){
  assert.equal(active?.type??null,state.active?.type??null,'Active identity diverged');assert.equal(held?.type??null,state.hold,'Held identity diverged');assert.deepEqual(queue.map(t=>t.type),state.queue,'Preview identity diverged');
  assert.deepEqual(owners.map(row=>row.map(o=>o?.type||'.').join('')),state.board,'Cell owners diverged from actual board');
  for(const b of bags.values())b.remaining=zero();for(const row of owners)for(let x=0;x<10;x++)if(row[x])bags.get(row[x].bagId).remaining[region(x)]++;
  const remaining=mass(state.board);assert.deepEqual(add(initial,subtract(placed,cleared)),remaining,'Regional mass is not conserved');
  for(const b of bags.values())assert.deepEqual(add(b.initial,subtract(b.placed,b.cleared)),b.remaining,'Source-bag mass is not conserved: '+b.id);
  const pending=[active,held,...queue].filter(Boolean);assert.equal(new Set(pending.map(t=>t.id)).size,pending.length,'One source token occupies multiple inventory positions');assert.ok(pending.every(t=>t.lockedAt===null),'Locked source token returned to inventory');
  return remaining;
 }
 reconcile();
 let terminal=null,summary=null,seenSummary=false;
 for(const record of records){
  assert.ok(record&&typeof record==='object','Invalid trace record');assert.equal(seenSummary,false,'Record follows terminal summary');
  if(record.kind==='summary'){assert.ok(record.summary&&typeof record.summary==='object'&&!Array.isArray(record.summary),'Invalid terminal summary');seenSummary=true;summary=record.summary;continue;}
  if(record.kind==='stop'){assert.equal(summary,null,'Stop follows terminal summary');assert.equal(terminal,null,'Duplicate stop record');assert.equal(record.lock,locks,'Stop lock count differs');assert.deepEqual(record.request?.observation,publicState(state),'Terminal request diverged');terminal={lock:record.lock,status:record.advice?.status||record.error||null,hasTarget:Boolean(record.advice?.target),hasError:Boolean(record.error)};continue;}
  assert.equal(record.kind,'lock','Unsupported record kind');assert.equal(summary,null,'Lock follows terminal summary');assert.equal(terminal,null,'Lock follows terminal stop');assert.equal(record.lock,locks+1,'Missing or out-of-order lock');
  assert.deepEqual(record.request?.observation,publicState(state),'Public observation diverged before lock '+record.lock);
  const actions=record.actions,witness=record.advice?.witness;assert.ok(Array.isArray(actions)&&Array.isArray(witness)&&actions.length===witness.length&&actions.length<=1000&&witness.at(-1)==='HD'&&witness.filter(a=>a==='HD').length===1,'Expected one bounded actual lock witness');
  const startMass=reconcile().slice(),lockPlaced=zero(),lockCleared=zero(),clearedByBag={},holdActions=[];let locked=null,event=null;
  for(let i=0;i<actions.length;i++){
   const rec=actions[i],action=rec.action;assert.equal(action,witness[i],'Recorded action differs from witness');const next=R.move(state,action);assert.notEqual(next,state,'Recorded action did not execute');
   if(action==='HOLD'){const outgoing=active;active=held||queue.shift()||null;held=outgoing;}
   if(action==='HD'){
    event=next.lastEvent;assert.deepEqual(event,record.event,'Actual lock event differs');assert.ok(active&&active.type===event.type);locked=active;assert.equal(locked.lockedAt,null);locked.lockedAt=record.lock;byPiece[event.type].locks++;
    assert.equal(event.cells.length,4);assert.equal(new Set(event.cells.map(c=>c.join(','))).size,4);
    for(const[x,y]of event.cells){assert.equal(owners[y][x],null,'New cell overlaps an existing owner');owners[y][x]={type:event.type,bagId:locked.bagId,id:locked.id};const k=region(x);lockPlaced[k]++;placed[k]++;bags.get(locked.bagId).placed[k]++;byPiece[event.type].placed[k]++;}
    const clearedRows=new Set(event.clearedRows);assert.equal(clearedRows.size,event.lines);
    for(const y of clearedRows)for(let x=0;x<10;x++){const owner=owners[y][x];assert.ok(owner,'A claimed clear contains empty cells');const k=region(x);lockCleared[k]++;cleared[k]++;bags.get(owner.bagId).cleared[k]++;(clearedByBag[owner.bagId]??=zero())[k]++;}
    assert.deepEqual(lockCleared,REGIONS.map(r=>r.width*event.lines),'A full-row clear must remove 4/3/3 cells per line');
    owners=owners.filter((_,y)=>!clearedRows.has(y));while(owners.length<40)owners.unshift(Array(10).fill(null));active=queue.shift()||null;
   }
   state={...next,revision:state.revision+1};
   while(state.queue.length<6){assert.ok(cursor<input.future.length,'Unrecorded source exhaustion');const type=input.future[cursor];queue.push(reveal(type,cursor));cursor++;state={...state,queue:[...state.queue,type],...(state.bag?{bag:B.consume(state.bag,type)}:{})};if(state.bag)assert.deepEqual(B.validate(state.bag),[]);}
   actionsVerified++;assert.equal(rec.draws,cursor,'Recorded draw cursor differs');assert.equal(rec.observationHash,digest(publicState(state)),'Recorded action hash differs');reconcile();
   if(action==='HOLD')holdActions.push({actionIndex:i,draws:cursor,active:brief(active),held:brief(held)});
  }
  assert.ok(locked&&event);assert.equal(record.draws,cursor,'Final draw cursor differs');assert.deepEqual(record.after,publicState(state),'Recorded post-lock state differs');
  locks++;lines+=event.lines;const remaining=reconcile().slice();assert.deepEqual(add(startMass,subtract(lockPlaced,lockCleared)),remaining);
  rows.push({lock:locks,piece:locked.type,tokenId:locked.id,bagId:locked.bagId,sourceSlot:locked.sourceSlot,lines:event.lines,clearedRows:event.clearedRows.slice(),placed:lockPlaced,cleared:lockCleared,delta:subtract(lockPlaced,lockCleared),remaining,massPerColumn:remaining.map((v,i)=>v/REGIONS[i].width),clearedByBag,active:brief(active),held:brief(held),holdActions});
 }
 const finalObservation=publicState(state),remaining=reconcile().slice();
 if(summary){assert.equal(summary.schemaVersion,1,'Unsupported summary schema');for(const key of ['scenario','seed','inputHash'])assert.equal(summary[key],input[key],'Summary input differs: '+key);assert.equal(summary.cap,input.locks,'Summary cap differs');assert.ok(['lock-cap','top-out','input-exhausted','planner-timeout','planner-error','abstention','invalid-recommendation','execution-error','policy-violation'].includes(summary.stop),'Unknown terminal stop');assert.equal(summary.censored,summary.stop==='lock-cap','Summary censoring differs');if(summary.stop==='lock-cap'){assert.equal(locks,input.locks,'Cap not reached');assert.equal(terminal,null);assert.equal(state.topOut,false);}if(summary.stop==='top-out')assert.equal(state.topOut,true,'Top-out state differs');if(summary.stop==='abstention')assert.ok(terminal&&!terminal.hasTarget&&!terminal.hasError,'Missing abstention stop');assert.equal(summary.locks,locks,'Summary lock count differs');assert.equal(summary.lines,lines,'Summary line count differs');assert.deepEqual(summary.finalObservation,finalObservation,'Summary terminal public state differs');}
 const bagRows=[...bags.values()].sort((a,b)=>(a.index??Infinity)-(b.index??Infinity)).map(b=>{
  const all=[...tokens.values()].filter(t=>t.bagId===b.id),count={locked:all.filter(t=>t.lockedAt!==null).length,active:Number(active?.bagId===b.id),held:Number(held?.bagId===b.id),preview:queue.filter(t=>t.bagId===b.id).length};assert.equal(sum(Object.values(count)),all.length);
  const sourceCoverageComplete=!b.unknown&&b.priorUnattributedPieces===0&&all.length===7,allTokensLocked=sourceCoverageComplete&&count.locked===7;
  if(!b.unknown){assert.ok(all.length<=7-b.priorUnattributedPieces);assert.equal(new Set(all.map(t=>t.sourceSlot)).size,all.length);assert.equal(new Set(all.map(t=>t.type)).size,all.length,'Repeated type in an asserted original seven-bag');}
  return{...clone(b),observedTokens:all.length,pendingAndLocked:count,unrevealedSourcePieces:b.unknown?null:7-b.priorUnattributedPieces-all.length,sourceCoverageComplete,allTokensLocked,boardDepleted:allTokensLocked&&sum(b.remaining)===0,completedAtLock:allTokensLocked?Math.max(...all.map(t=>t.lockedAt)):null};
 });
 const windows=[];for(const row of rows)for(const size of windowSizes){const start=Math.max(0,row.lock-size),slice=rows.slice(start,row.lock),startMass=start?rows[start-1].remaining:initial,p=slice.reduce((v,r)=>add(v,r.placed),zero()),c=slice.reduce((v,r)=>add(v,r.cleared),zero());assert.deepEqual(add(startMass,subtract(p,c)),row.remaining);windows.push({endLock:row.lock,requestedLocks:size,startLock:start+1,actualLocks:slice.length,partial:slice.length<size,startMass:startMass.slice(),placed:p,cleared:c,delta:subtract(p,c),remaining:row.remaining.slice()});}
 return{schemaVersion:1,kind:'regional-mino-ledger',regions:clone(REGIONS),provenance:source,inputIdentityHash:identity(input),evaluationCap:input.locks??null,coverage:{locks,lines,actionsVerified,summaryReconciled:Boolean(summary),kind:summary?'complete-recorded-episode':'verified-recorded-prefix',stop:summary?.stop??terminal?.status??null,censored:summary?.censored??null},totals:{initial,placed,cleared,delta:subtract(placed,cleared),remaining,massPerColumn:remaining.map((v,i)=>v/REGIONS[i].width)},placedByPiece:byPiece,bags:bagRows,inventory:{active:brief(active),held:brief(held),preview:queue.map(brief)},locks:rows,windows,finalObservationHash:digest(finalObservation),notes:['Regions are fixed columns 1–4 / 5–7 / 8–10; straddling pieces count cellwise.','Remaining means board-resident minos, not active, held or preview inventory.','Known bag IDs follow source pieces through HOLD, never floor(lock/7). Unknown origins are not one original bag.','The long-run bounded-mass ratio is 4:3:3, not a per-bag quota or strategy recommendation.','Analysis is offline and never enters planner observations or ranking.']};
}
function csv(rows,columns){const cell=v=>{const s=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};return[columns.map(c=>cell(c[0])).join(','),...rows.map(r=>columns.map(c=>cell(c[1](r))).join(','))].join('\n')+'\n';}
function csvFiles(ledger){
 const vector=name=>REGIONS.map((r,i)=>[r.id+'_'+name,x=>x[name][i]]);
 return{locks:csv(ledger.locks,[['lock',r=>r.lock],['piece',r=>r.piece],['token_id',r=>r.tokenId],['original_bag',r=>r.bagId],['source_slot',r=>r.sourceSlot],['lines',r=>r.lines],...['placed','cleared','delta','remaining'].flatMap(vector),['held_token',r=>r.held?.id],['held_bag',r=>r.held?.bagId],['active_token',r=>r.active?.id]]),bags:csv(ledger.bags,[['original_bag',r=>r.id],['unknown_origin_bucket',r=>r.unknown],['prior_unattributed_pieces',r=>r.priorUnattributedPieces],['observed_tokens',r=>r.observedTokens],...['locked','active','held','preview'].map(k=>[k,r=>r.pendingAndLocked[k]]),['unrevealed_source_pieces',r=>r.unrevealedSourcePieces],['source_coverage_complete',r=>r.sourceCoverageComplete],['all_tokens_locked',r=>r.allTokensLocked],['board_depleted',r=>r.boardDepleted],['completed_at_lock',r=>r.completedAtLock],...['initial','placed','cleared','remaining'].flatMap(vector)]),windows:csv(ledger.windows,[['end_lock',r=>r.endLock],['requested_locks',r=>r.requestedLocks],['start_lock',r=>r.startLock],['actual_locks',r=>r.actualLocks],['partial_window',r=>r.partial],...['startMass','placed','cleared','delta','remaining'].flatMap(vector)])};
}
module.exports={REGIONS,identity,publicState,mass,analyze,csvFiles};
