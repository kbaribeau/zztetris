'use strict';
// Observed post-clear boards only. Never feeds a planner score or request.
const L=require('../../st-left-context');
const tiers=['SS','S','A','B','C','D','other'];
const catalog=L.catalog.map(({id,tier,profile})=>({id,tier,profile:[...profile]}));
function classify(board){
 if(!Array.isArray(board)||board.length!==40||board.some(row=>typeof row!=='string'||row.length!==10))throw Error('Left metrics require a 40 by 10 board');
 const heights=[],covered=[];
 for(let x=0;x<4;x++){
  const first=board.findIndex(row=>row[x]!=='.');heights.push(first<0?0:40-first);
  if(first>=0)for(let y=first+1;y<40;y++)if(board[y][x]==='.')covered.push([x,y]);
 }
 const minimum=Math.min(...heights),profile=heights.map(h=>h-minimum),shape=covered.length?null:L.classify(heights);
 return{shape:shape?.id||'other',tier:shape?.tier||'other',profile,heights,coveredCells:covered.length,reason:covered.length?'left-holes':shape?'catalog-shape':'unranked-shape'};
}
function create(initialBoard){return{schemaVersion:1,sampling:'post-lock-post-line-clear',initial:classify(initialBoard),observations:0,countsByShape:Object.fromEntries([...catalog.map(s=>s.id),'other'].map(id=>[id,0])),countsByTier:Object.fromEntries(tiers.map(t=>[t,0])),leftHoleObservations:0};}
function add(counts,observation){
 if(!(observation.shape in counts.countsByShape)||!(observation.tier in counts.countsByTier))throw Error('Unknown Left shape observation');
 counts.observations++;counts.countsByShape[observation.shape]++;counts.countsByTier[observation.tier]++;
 counts.leftHoleObservations+=Number(observation.coveredCells>0);
}
function finish(counts){
 const percentage=values=>Object.fromEntries(Object.entries(values).map(([key,n])=>[key,counts.observations?100*n/counts.observations:0]));
 return{...counts,countsByShape:{...counts.countsByShape},countsByTier:{...counts.countsByTier},percentByShape:percentage(counts.countsByShape),percentByTier:percentage(counts.countsByTier)};
}
function analyze(input,records,{prefixLocks=null}={}){
 const locks=records.filter(r=>r.kind==='lock');
 if(prefixLocks!==null&&(!Number.isSafeInteger(prefixLocks)||prefixLocks<0||prefixLocks>locks.length))throw Error('prefix-locks must be between zero and the recorded lock count');
 const counts=create(input.initial.board),perLock=[];
 for(const [i,record]of locks.entries()){
  if(record.lock!==i+1)throw Error('Noncontiguous recorded lock sequence');
  if(prefixLocks!==null&&i>=prefixLocks)continue;
  const observation=classify(record.after?.board);add(counts,observation);perLock.push({lock:record.lock,...observation});
 }
 const terminal=records.filter(r=>r.kind==='summary').at(-1)?.summary;
 if(terminal&&terminal.locks!==locks.length)throw Error('Summary and trace lock counts differ');
 return{...finish(counts),catalog,perLock,coverage:{recordedLocks:locks.length,prefixLocks,terminalSummaryPresent:Boolean(terminal)},note:'Counts describe recorded post-clear boards, not candidate search or proof of safe play. Every Left shape containing covered holes is other. Initial board is separate.'};
}
module.exports={catalog,classify,create,add,finish,analyze};
