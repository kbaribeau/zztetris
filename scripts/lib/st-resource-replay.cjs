'use strict';
// Offline sidecar. Reconstruct only actual actions and pieces already exposed
// in the public trace; generator seeds/original-bag oracle metadata are ignored.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const R=require('../../st-rules'),B=require('../../st-bag'),H=require('../../st-resource-history');
const Reset=require('../../st-reset-diagnostics');
const clone=x=>JSON.parse(JSON.stringify(x)),digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function publicState(s){return{rules:s.rules,board:s.board.slice(),active:s.active?clone(s.active):null,hold:s.hold,canHold:s.canHold,queue:s.queue.slice(0,6),revision:s.revision,streamCursor:s.streamCursor||0,topOut:Boolean(s.topOut),...(s.bag?{bag:clone(s.bag)}:{})};}
function analyzeRecords(records,{observedEmptyStart=false}={}){
 assert.ok(Array.isArray(records)&&records.length<=H.limits.locks+2,'Recording exceeds the bounded resource history');
 const locks=[];let terminal=null,summary=null;
 for(const r of records){assert.ok(r&&typeof r==='object'&&!Array.isArray(r),'Invalid trace record');assert.equal(summary,null,'Record follows terminal summary');if(r.kind==='summary'){assert.ok(r.summary&&typeof r.summary==='object'&&!Array.isArray(r.summary),'Invalid summary');summary=r.summary;}else if(r.kind==='stop'){assert.equal(terminal,null,'Duplicate stop');terminal=r;}else{assert.equal(r.kind,'lock','Unknown record kind');assert.equal(terminal,null,'Lock follows terminal stop');locks.push(r);}}
 assert.ok(locks.length,'No lock records');
 assert.ok(locks.every(r=>Array.isArray(r.actions)&&r.actions.length<=1000)&&locks.reduce((n,r)=>n+r.actions.length,0)<=H.limits.actions,'Too many recorded actions');
 let state=R.createState(locks[0].request.observation),history=H.start(publicState(state),{fresh:observedEmptyStart}),cursor=0,actions=0;const timeline=[];
 for(const [index,record]of locks.entries()){
  assert.equal(record.lock,index+1,'Lock order must be contiguous');assert.deepEqual(publicState(state),record.request.observation,'Public request discontinuity');
  assert.ok(Array.isArray(record.actions)&&record.actions.length,'Missing actual actions');
  assert.ok(Number.isInteger(record.draws)&&record.draws>=cursor&&record.draws-cursor<=6,'Invalid public reveal cursor');
  const count=record.draws-cursor,reveals=count?record.after.queue.slice(-count):[];assert.equal(reveals.length,count,'Missing newly visible pieces');let revealed=0,event=null;
  for(const [i,entry]of record.actions.entries()){
   const before=state,next=R.move(state,entry.action);assert.notEqual(next,state,'Recorded input did not execute');state=next;
   assert.ok(Number.isInteger(entry.draws)&&entry.draws>=cursor&&entry.draws<=record.draws,'Invalid action reveal cursor');
   const added=entry.draws-cursor;assert.equal(added,6-state.queue.length,'Only newly exposed preview positions may be filled');
   for(let j=0;j<added;j++){const type=reveals[revealed++];assert.match(type,/^[IJLOSTZ]$/);state={...state,queue:[...state.queue,type],...(state.bag?{bag:B.consume(state.bag,type)}:{})};}
   cursor=entry.draws;assert.equal(digest(publicState(state)),entry.observationHash,'Actual action state hash differs');
   history=H.applyAction(history,publicState(before),entry.action,{...publicState(state),lastEvent:state.lastEvent});
   assert.ok(!['invalid','truncated'].includes(H.resolve(publicState(state),history).coverage.status),'Resource replay failed or exceeded its declared bounded history');
   if(entry.action==='HD'){assert.equal(i,record.actions.length-1,'Only the final input may lock');event=state.lastEvent;}
   actions++;
  }
  assert.deepEqual(event,record.event,'Actual lock event differs');assert.deepEqual(publicState(state),record.after,'Final public state differs');
  const d=H.resolve(publicState(state),history);timeline.push({lock:record.lock,coverage:d.coverage.status,hangingS:d.hangingS,extraZ:{status:d.extraZ.status,baselineAt:d.extraZ.baseline?.at??null,used:d.extraZ.allocations.length},center:{pending:d.center.pending.length,debt:d.center.debt.length},milestones:d.milestones});
 }
 const final=H.resolve(publicState(state),history);
 if(terminal){assert.equal(terminal.lock,locks.length,'Terminal lock count differs');assert.deepEqual(terminal.request?.observation,publicState(state),'Terminal request differs');}
 if(summary){assert.equal(summary.schemaVersion,1,'Unsupported summary');assert.equal(summary.locks,locks.length,'Summary lock count differs');assert.equal(summary.lines,locks.reduce((n,r)=>n+r.event.lines,0),'Summary line count differs');assert.deepEqual(summary.finalObservation,publicState(state),'Summary final state differs');assert.ok(['lock-cap','top-out','input-exhausted','planner-timeout','planner-error','abstention','invalid-recommendation','execution-error','policy-violation'].includes(summary.stop),'Unknown stop');assert.equal(summary.censored,summary.stop==='lock-cap','Summary censoring differs');if(summary.stop==='lock-cap'){assert.equal(summary.cap,locks.length);assert.equal(terminal,null);assert.equal(state.topOut,false);}if(summary.stop==='top-out')assert.equal(state.topOut,true);if(summary.stop==='abstention')assert.ok(terminal&&!terminal.advice?.target&&!terminal.error,'Missing abstention terminal');}
 return{schemaVersion:1,kind:'observed-st-resource-sidecar',locks:locks.length,verifiedActions:actions,coverage:final.coverage,recording:{kind:summary?'terminal-state-verified':'verified-recorded-prefix',terminalStateVerified:Boolean(summary)},unknown:{hangingS:timeline.filter(r=>r.hangingS.status==='unknown').length,extraZ:timeline.filter(r=>r.extraZ.status==='unknown').length},timeline,final,resetEvidence:Reset.resolve(publicState(state),history),scope:'Post-processing only. Public draw-order identities are not generator provenance. No source/ranking decisions were rerun or modified.'};
}
module.exports={analyzeRecords};
