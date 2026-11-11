'use strict';
// Observed post-clear boards only. Never feeds a planner score or request.
const L=require('../../st-structure').leftSurface;
const tiers=['SS','S','A','B','C','D','other'];
const catalog=L.catalog.map(({id,tier,profile})=>({id,tier,profile:[...profile]}));
function classify(board){
 if(!Array.isArray(board)||board.length!==40||board.some(row=>typeof row!=='string'||row.length!==10))throw Error('Left metrics require a 40 by 10 board');
 const {heights,profile,covered,shape:classified}=L.assess(board),shape=covered?null:classified;
 return{shape:shape?.id||'other',tier:shape?.tier||'other',profile,heights,coveredCells:covered,reason:covered?'left-holes':shape?'catalog-shape':'unranked-shape'};
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

// Catalog coverage at actual pre-decision roots, independently of search-node
// count, repeated internal planner calls, public supply, or execution success.
const Contours=require('../../st-left-contours');
function classifyLookup(board){
 const shape=classify(board),contour=Contours.lookup(shape.heights);
 const alternatives=contour?.dependencies.alternatives||[];
 const nonCrossingAlternatives=alternatives.filter(a=>a.paths.some(p=>!p.crossesCenter)).length;
 return{schemaVersion:1,contour:contour?.id??null,profile:shape.profile,
  status:!contour?'unlisted':alternatives.length?'recorded-resolution':'no-recorded-resolution',
  noKnownResolution:!alternatives.length,recordedAlternatives:alternatives.length,
  nonCrossingAlternatives,coveredCells:shape.coveredCells,
  availability:'not-assessed',executionVerified:false};
}
function createLookup(){return{schemaVersion:1,sampling:'actual-pre-decision-root',observations:0,noKnownResolution:0,
 unlisted:0,noRecordedResolution:0,recordedResolution:0,crossingOnly:0,leftHoleObservations:0,
 countsByContour:Object.fromEntries([...Contours.catalog.map(c=>c.id),'unlisted'].map(id=>[id,0]))};}
function addLookup(counts,observation){
 if(observation?.schemaVersion!==1||!['unlisted','no-recorded-resolution','recorded-resolution'].includes(observation.status)||
  !((observation.contour??'unlisted') in counts.countsByContour)||
  typeof observation.noKnownResolution!=='boolean'||observation.noKnownResolution!==(observation.status!=='recorded-resolution')||
  ['recordedAlternatives','nonCrossingAlternatives','coveredCells'].some(k=>!Number.isSafeInteger(observation[k])||observation[k]<0))throw Error('Invalid Left lookup observation');
 counts.observations++;counts.countsByContour[observation.contour??'unlisted']++;
 counts.noKnownResolution+=Number(observation.noKnownResolution);
 counts.unlisted+=Number(observation.status==='unlisted');
 counts.noRecordedResolution+=Number(observation.status==='no-recorded-resolution');
 counts.recordedResolution+=Number(observation.status==='recorded-resolution');
 counts.crossingOnly+=Number(observation.recordedAlternatives>0&&observation.nonCrossingAlternatives===0);
 counts.leftHoleObservations+=Number(observation.coveredCells>0);
}
function finishLookup(counts,{scope='entire-run'}={}){return{...counts,countsByContour:{...counts.countsByContour},scope,
 noKnownResolutionPercent:counts.observations?100*counts.noKnownResolution/counts.observations:0,
 note:'One encounter per actual pre-decision root, including a terminal failed decision; repeated contours at different lock boundaries count again. Search nodes, HOLD/movement and internal planner calls do not count. Missing catalog routes are not unavailable public supply, proven illegal moves, or proof that no solution exists. Covered holes are reported separately; contour routes alone do not resolve them.'};}
function unavailableLookup(reason){return{schemaVersion:1,scope:'unavailable',observations:null,noKnownResolution:null,reason};}
function recoverLookup(){
 const counts=createLookup();let rows=0,instrumented=false,stopped=false,reason,throughLock=0;
 return{record(row){
  rows++;
  if(rows===1){instrumented=row?.kind==='tracking-start'&&row.schemaVersion===1&&row.leftLookupSchemaVersion===1;return;}
  if(!instrumented||stopped)return;
  try{
   if(row?.kind==='summary'){if(row.summary?.locks!==throughLock)throw Error('Lookup summary boundary mismatch');stopped=true;return;}
   if(!['lock','stop'].includes(row?.kind))throw Error('Malformed or repeated lookup trace row');
   if(row.kind==='stop'&&!row.request){if(row.lock!==throughLock)throw Error('Lookup stop boundary mismatch');stopped=true;return;}
   if(row.lock!==(row.kind==='lock'?throughLock+1:throughLock))throw Error('Noncontiguous lookup decision sequence');
   const observation=classifyLookup(row.request?.observation?.board);
   if(JSON.stringify(observation)!==JSON.stringify(row.leftLookup))throw Error('Lookup observation does not match actual request board');
   addLookup(counts,observation);
   if(row.kind==='lock')throughLock=row.lock;else stopped=true;
  }catch(error){stopped=true;reason=error.message;}
 },finish(){return instrumented?{...finishLookup(counts,{scope:'retained-prefix'}),throughLock,
  reason:'Recorded decision rows only; an interrupted pending decision may be absent.'+(reason?' '+reason:'')}:unavailableLookup('Missing Left lookup schema marker; legacy or absent instrumentation cannot establish zero encounters.');}};
}
module.exports.lookup=Object.freeze({classify:classifyLookup,create:createLookup,add:addLookup,finish:finishLookup,recover:recoverLookup,unavailable:unavailableLookup});
