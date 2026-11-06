#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {setMaxListeners}=require('node:events');
const Runner=require('./lib/st-simulation-runner.cjs');
const E=require('./lib/st-simulation.cjs');
const V=require('./lib/st-evaluation.cjs');
const TM=require('./lib/st-tracking-metrics.cjs');
const T=require('../st-resource-tracking');
const ROOT=path.resolve(__dirname,'..'),MAX_FILE=64*1024*1024,MAX_TRACE_FILE=512*1024*1024;
const json=file=>{if(fs.statSync(file).size>MAX_FILE)throw Error('Artifact exceeds 64 MiB: '+file);return JSON.parse(fs.readFileSync(file,'utf8'));};
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function readTrace(file){if(fs.statSync(file).size>MAX_FILE)throw Error('Trace exceeds 64 MiB');return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
// Long runs use bounded streaming reads; legacy eager readTrace stays at 64 MiB.
function* streamTrace(file){
  if(fs.statSync(file).size>MAX_TRACE_FILE)throw Error('Trace exceeds 512 MiB');
  const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(64*1024);
  const decoder=new(require('node:string_decoder').StringDecoder)('utf8');let pending='';
  try{
    for(;;){const n=fs.readSync(fd,buffer,0,buffer.length,null);if(!n)break;pending+=decoder.write(buffer.subarray(0,n));let newline;
      while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);if(line.trim())yield JSON.parse(line);}}
    pending+=decoder.end();if(pending.trim())yield JSON.parse(pending);
  }finally{fs.closeSync(fd);}
}
function integer(value,name,min,max){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${name} must be an integer ${min}..${max}`);return n;}
function parse(args) {
  const out={};
  for(let i=0;i<args.length;i++) {
    const key=args[i];
    if(key==='--help'){out.help=true;continue;}
    if(key==='--usage-telemetry'||key==='--mino-ledger'||key==='--no-search-timeout'){out[key.slice(2)]=true;continue;}
    if(key==='--compare'){out.compare=[args[++i],args[++i]];if(out.compare.some(x=>!x||x.startsWith('--')))throw Error('--compare requires two run directories');continue;}
    if(!['--preset','--scenario','--seeds','--locks','--out','--replay','--rerun','--episode-ms','--lane','--child','--protocol','--side','--parallel','--opening-locks','--post-handoff-locks'].includes(key))throw Error('Unknown option '+key);
    const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+key);out[key.slice(2)]=value;
  }
  return out;
}
function configuration(options={}){return{...E.CONFIG,...(options['usage-telemetry']?{usageTelemetry:true}:{}),...(options['no-search-timeout']?{timeMs:null}:{})};}
function failure(summary){return ['invalid-recommendation','execution-error','policy-violation','planner-error','planner-timeout','runner-error','artifact-limit','source-changed'].includes(summary.stop);}
function compare(a,b) {
  if(a.episodes.length===0||b.episodes.length===0)throw Error('Comparison requires nonempty cohorts');
  if(!a.complete||!b.complete)throw Error('Comparison requires complete run manifests');
  if(a.schemaVersion!==1||b.schemaVersion!==1)throw Error('Unsupported manifest schema');
  const contract=m=>({schemaVersion:m.schemaVersion,config:m.config,locks:m.locks,rng:m.rng,lane:m.lane,execution:m.execution,parallel:m.parallel??1,decisionWatchdogMs:m.decisionWatchdogMs===undefined?2500:m.decisionWatchdogMs,episodeMs:m.episodeMs});
  if(JSON.stringify(contract(a))!==JSON.stringify(contract(b)))throw Error('Incompatible budgets, caps, RNG, lane or execution protocol');
  const am=new Map(a.episodes.map(x=>[x.scenario+':'+x.seed,x]));
  if(am.size!==a.episodes.length||new Set(b.episodes.map(x=>x.scenario+':'+x.seed)).size!==b.episodes.length||a.episodes.length!==b.episodes.length)throw Error('Episode cohorts differ or contain duplicate seeds');
  const pairs=[];
  for(const y of b.episodes) {
    const key=y.scenario+':'+y.seed,x=am.get(key);
    if(!x||x.inputHash!==y.inputHash||JSON.stringify(x.phaseCap??null)!==JSON.stringify(y.phaseCap??null))throw Error('Private/public episode inputs differ: '+key);
    if(failure(x)||failure(y)||x.stop==='wall-cap'||y.stop==='wall-cap')throw Error('Cannot summarize policy quality with infrastructure/safety failures or unequal wall censoring: '+key);
    const horizon=Math.min(x.locks,y.locks),px=x.profile[horizon-1],py=y.profile[horizon-1];
    pairs.push({key,scenario:y.scenario,baselineLocks:x.locks,candidateLocks:y.locks,delta:y.locks-x.locks,baselineStop:x.stop,candidateStop:y.stop,commonHorizon:horizon,commonLinesDelta:horizon?py.lines-px.lines:0,commonHeightDelta:horizon?py.height-px.height:null,commonMeanSkylineDelta:horizon?py.meanSkylineHeight-px.meanSkylineHeight:null,commonOccupiedRowsDelta:horizon?py.occupiedRowsEquivalent-px.occupiedRowsEquivalent:null});
  }
  const cohorts={};
  for(const scenario of [...new Set(pairs.map(p=>p.scenario))]) {
    const ps=pairs.filter(p=>p.scenario===scenario),d=ps.map(p=>p.delta),mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
    const rng=E.random(20261023),samples=[];
    for(let i=0;i<2000;i++)samples.push(mean(d.map(()=>d[Math.floor(rng()*d.length)])));
    samples.sort((x,y)=>x-y);
    const survival=side=>{const rows=ps.map(p=>side==='baseline'?am.get(p.key):b.episodes.find(e=>e.scenario+':'+e.seed===p.key));const stops=rows.filter(r=>!r.censored).map(r=>r.locks).sort((x,y)=>x-y);return{restrictedMeanLocks:mean(rows.map(r=>r.locks)),medianStopLock:stops.length>=Math.ceil(rows.length/2)?stops[Math.ceil(rows.length/2)-1]:null,capped:rows.filter(r=>r.censored).length};};
    cohorts[scenario]={n:d.length,wins:d.filter(v=>v>0).length,ties:d.filter(v=>v===0).length,losses:d.filter(v=>v<0).length,meanPairedLockDelta:mean(d),pairedSeedBootstrap95:[samples[50],samples[1949]],baseline:survival('baseline'),candidate:survival('candidate')};
  }
  return {mode:'paired-comparison',cohorts,pairs,note:'Restricted mean is bounded by the common lock cap; null median means not reached. Seed-level bootstrap is exploratory, especially for tiny development cohorts. Wall-clock search variation remains; repeat matched runs. Diagnostic parallel/timeout-disabled comparisons are not production-budget acceptance evidence. No indefinite-survival or Reset certification.'};
}
function child(specPath) {
  const spec=json(specPath),input=json(spec.input),trace=path.join(spec.directory,'trace.jsonl');let bytes=0;
  if(spec.sources&&JSON.stringify(E.sourceHashes())!==JSON.stringify(spec.sources))throw Error('Source changed before child startup');
  if(spec.evaluationBinding)V.validateBoundEpisode(spec.evaluationBinding,E.sourceHashes(),{...spec.execution,config:spec.config},input);
  fs.writeFileSync(trace,'');
  try {
    const summary=E.runEpisode(input,{config:spec.config,onRecord:record=>{const line=JSON.stringify(record)+'\n';bytes+=Buffer.byteLength(line);if(bytes>MAX_TRACE_FILE)throw Object.assign(Error('Trace reached 512 MiB limit'),{code:'ARTIFACT_LIMIT'});fs.appendFileSync(trace,line);}});
    write(path.join(spec.directory,'summary.json'),summary);
  } catch(error) {
    write(path.join(spec.directory,'error.json'),{stop:error.code==='ARTIFACT_LIMIT'?'artifact-limit':'runner-error',message:error.stack});process.exitCode=1;
  }
}
function recoverTracking(){
  const metrics=TM.create();let rows=0,instrumented=false,metricsStopped=false,throughLock=0,statusRows=0,reason,lastStatus,statusError;
  return{
    record(record){
      rows++;
      if(rows===1&&record?.kind==='tracking-start'&&record.schemaVersion===1){instrumented=true;return;}
      if(record?.kind==='lock'){
        // The helper imports/replays public resource facts. It never asks the
        // planner or trusts a stored obligation count as an authentication step.
        try{
          if(record.lock!==++statusRows)throw Error('Noncontiguous retained lock label');
          lastStatus=E.recoverTrackingStatus(record);statusError=null;
        }
        catch(error){statusError=error.message;}
      }
      if(!instrumented||metricsStopped)return;
      try{
        if(record?.kind==='tracking-start')throw Error('Repeated or unsupported tracking-start marker');
        if(!record||typeof record!=='object'||Array.isArray(record)||!['lock','stop','summary'].includes(record.kind))throw Error('Malformed tracking trace row');
        if(record?.trackingEvents!==undefined){
          if(!Array.isArray(record.trackingEvents))throw Error('Malformed trackingEvents row');
          // Validate the complete row before counting any of it.
          record.trackingEvents.forEach(TM.validateEvent);
        }
        if(record?.kind==='lock'&&record.lock!==throughLock+1)throw Error('Noncontiguous tracking lock sequence');
        if(record.kind==='stop'&&record.lock!==throughLock)throw Error('Tracking stop does not match retained lock boundary');
        if(record.kind==='summary'&&record.summary?.locks!==throughLock)throw Error('Tracking summary does not match retained lock boundary');
        for(const event of record.trackingEvents||[]){
          const boundary=record.kind==='lock'?record.lock:throughLock;
          if(!['lock','handoff','reset'].includes(event.stage)||event.lock>boundary||record.kind==='lock'&&event.stage==='lock'&&event.lock!==record.lock)throw Error('Tracking event does not match retained row lock boundary');
        }
        for(const event of record?.trackingEvents||[])metrics.record(event);
        if(record?.kind==='lock')throughLock=record.lock;
      }catch(error){metricsStopped=true;reason=error.message;}
    },
    finish(){
      const prefixReason='Recorded prefix only; interruption may omit events after its last retained row.';
      const tracking=instrumented?{...metrics.snapshot({scope:'retained-prefix',throughLock}),reason:reason?prefixReason+' '+reason:prefixReason}:TM.unavailable('Missing initial tracking-start schemaVersion 1 marker; legacy or missing instrumentation cannot establish zero anomalies.');
      const finalObligations=lastStatus?{...lastStatus,scope:'partial',reason:'Last authenticated retained lock only; later actions and terminal status may be unobserved.'+(statusError?' Later lock could not be authenticated: '+statusError:'')}:T.status(null,{scope:'unavailable',reason:'No retained lock has authenticated resource status.'+(statusError?' '+statusError:'')});
      return{tracking,finalObligations};
    }
  };
}
function fallback(directory,input,result) {
  const trace=path.join(directory,'trace.jsonl'),profile=[],artifactErrors=[],tracking=recoverTracking();let last;
  // Failure recovery may retain a valid prefix of a killed child's partial file.
  // Ordinary streamTrace/replay remain strict, and the original bytes stay intact.
  if(fs.existsSync(trace))try{
    for(const record of streamTrace(trace)){
      tracking.record(record);
      if(record?.kind==='lock'){last=record;profile.push(record.metrics);}
    }
  }catch(error){artifactErrors.push({file:'trace.jsonl',message:error.message,retainedLocks:profile.length});}
  const errFile=path.join(directory,'error.json');
  let detail={message:result.error?.message||result.stderr||result.signal||('Child exited with status '+result.status)};
  if(fs.existsSync(errFile))try{
    const parsed=json(errFile);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid child error artifact');detail=parsed;
  }catch(error){artifactErrors.push({file:'error.json',message:error.message});}
  if(result.error?.code==='INVALID_SUMMARY')artifactErrors.push({file:'summary.child.json',message:result.error.message});
  if(artifactErrors.length)detail={...detail,artifactRecovery:{complete:false,errors:artifactErrors}};
  const stop=result.error?.code==='ETIMEDOUT'?'wall-cap':failure({stop:detail.stop})?detail.stop:'runner-error';
  return{schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,stop,censored:stop==='wall-cap',locks:profile.length,lines:last?.metrics?.lines||0,tsds:last?.metrics?.tsds||0,quads:last?.metrics?.quads||0,profile,detail,...tracking.finish(),...(last?.coachEntries?{partialCoachMetrics:{coachEntries:last.coachEntries,currentCoach:last.currentCoach,coachTransitions:last.coachTransitions,coachHistoryScope:last.coachHistoryScope,throughLock:last.lock,reason:"Last retained lock only; terminal dispatcher ownership may be unobserved."}}:{})};
}
function preserveChildSummary(directory){
  const source=path.join(directory,'summary.json'),retained=path.join(directory,'summary.child.json');
  if(!fs.existsSync(source))return;
  // Only the finished child writes this directory. Never replace earlier evidence.
  if(fs.existsSync(retained))throw Error('Refusing to replace retained child summary: '+retained);
  fs.renameSync(source,retained);
}
function recoverSummary(directory,input,result){
  const file=path.join(directory,'summary.json');
  if(!result.error&&result.status===0&&fs.existsSync(file))try{
    const summary=json(file);
    if(summary.schemaVersion!==1||summary.scenario!==input.scenario||summary.seed!==input.seed||summary.inputHash!==input.inputHash||summary.cap!==input.locks||!V.STOPS.includes(summary.stop)||!Number.isSafeInteger(summary.locks)||summary.locks<0||summary.locks>input.locks||!Array.isArray(summary.profile)||summary.profile.length!==summary.locks||summary.censored!==['phase-cap','lock-cap','wall-cap'].includes(summary.stop))throw Error('Invalid or mismatched child summary');
    return{...summary,tracking:summary.tracking??TM.unavailable('Summary predates tracking instrumentation.'),finalObligations:summary.finalObligations??T.status(null,{scope:'unavailable',reason:'Summary does not retain an authenticated final resource status.'})};
  }catch(error){result={...result,error:Object.assign(Error('Invalid child summary: '+error.message),{code:'INVALID_SUMMARY'})};}
  preserveChildSummary(directory);
  return fallback(directory,input,result);
}
function trackingReport(summary){
  const metrics=summary.tracking,status=summary.finalObligations,obligations=status?.obligations;
  const anomalies=Number.isSafeInteger(metrics?.total)&&metrics.total>=0&&['entire-run','retained-prefix'].includes(metrics.scope)?`${metrics.total} anomalies${metrics.scope==='retained-prefix'?` (retained prefix through lock ${metrics.throughLock})`:''}`:'unavailable';
  const scope=status?.scope??'unavailable',boundary=scope==='partial'?` through lock ${status.throughLock}`:'';
  if(!obligations)return`tracking ${anomalies}; final status ${scope}${boundary}, obligations unavailable`;
  const count=values=>Array.isArray(values)?values.length:'?';
  return`tracking ${anomalies}; final status ${scope}${boundary}/${status.coverage?.status??'unavailable'}: S/L ${count(obligations.hangingS?.known)}/${count(obligations.hangingL?.known)}, unclassified ${count(obligations.hangingS?.unclassified)}/${count(obligations.hangingL?.unclassified)}, Center ${count(obligations.center?.pending)} pending/${count(obligations.center?.debt)} debt, extra Z ${obligations.extraZ?.status??'unknown'} (${obligations.extraZ?.remaining??'?'}), Reset ${obligations.reset?.status??'unknown'}`;
}
function exportMinoLedgers(directory,episodes){
  // Deliberately after every timed episode, never between planning requests.
  const {analyzeDirectory}=require('./analyze-st-minos.cjs');
  return episodes.map(episode=>{const key=episode.scenario+'-'+episode.seed,dir=path.join(directory,key);try{return{key,...analyzeDirectory(dir,{out:path.join(dir,'mino-ledger')})};}catch(error){process.exitCode=1;return{key,error:error.message};}});
}
function main(args=process.argv.slice(2)) {
  const o=parse(args);
  if(o['usage-telemetry']&&(o.replay||o.compare))throw Error('--usage-telemetry instruments new decisions; use it with a run or --rerun, not replay/compare');
  if(o['mino-ledger']&&(o.replay||o.compare||o.child))throw Error('--mino-ledger is post-processing for a run or --rerun; use minos:st for existing traces');
  const parallel=Runner.concurrency(o.parallel);
  if((o.parallel!==undefined||o['no-search-timeout'])&&(o.replay||o.compare||o.child))throw Error('--parallel and --no-search-timeout apply to new runs or --rerun, not replay/compare/child');
  if(o.protocol&&(parallel!==1||o['no-search-timeout']))throw Error('Production evaluation protocols require serial execution and the configured search timeout; diagnostic options are not acceptance evidence');
  const protocol=o.protocol?V.validateProtocol(json(path.resolve(o.protocol))):null;
  const config=protocol?protocol.execution.config:configuration(o);
  if(protocol&&o['usage-telemetry'])throw Error('Protocol owns telemetry configuration');
  if(Boolean(protocol)!==Boolean(o.side))throw Error('--protocol and --side must be supplied together');
  if(protocol&&(o.replay||o.rerun||o.compare||o.child||o.seeds||o.scenario||o.locks||o.preset||o['opening-locks']||o['post-handoff-locks']))throw Error('Protocol owns cohort, roots and caps; do not override them');
  if(['compare','replay','rerun','child'].filter(key=>o[key]).length>1)throw Error('Choose one of --compare, --replay or --rerun');
  if(o.help){console.log(`ST closed-loop evaluation (Node 24.22.0; no browser/dependencies)\n\nnpm run sim:st -- --preset quick [--scenario empty|stable|both]\nnpm run sim:st -- --preset research [--seeds 1,2] [--locks 500]\nnpm run sim:st -- --replay test-results/simulation/RUN/empty-1\nnpm run sim:st -- --rerun test-results/simulation/RUN/empty-1\nnpm run sim:st -- --compare BASELINE_RUN CANDIDATE_RUN\n\nProtocol: --protocol protocol.json --side baseline|candidate (protocol owns the input cohort).\nOptions: --out parent-directory, --episode-ms wall-watchdog, --lane production, --usage-telemetry, --mino-ledger.\nDiagnostic options: --parallel N (1..32, default 1), --no-search-timeout.\n--no-search-timeout removes the 1500 ms planner deadline and 2500 ms decision VM cutoff.\nNode/depth/width limits, nested production timers and the episode watchdog remain.\nParallel or timeout-disabled runs are diagnostic; no deterministic or production-budget claim.\nMino ledgers are offline exports after all timed episodes; use minos:st for existing traces.\nUsage counters are opt-in and recorded in run configuration; measure overhead before timed comparisons.\nDefault: serial production wall-clock lane; fixed seeds are not deterministic search.\nQuick: 2 development seeds × 24 locks. Research: 16 seeds × 500 locks.\nDefaults start empty. Stable uses the public marathon-rebuild position with a seeded valid continuation, not its fixed demo tail.\nAbstention is a measured outcome, not a failing command or a top-out. Safety/runner failures exit nonzero.`);return;}
  if(o.child){child(o.child);return;}
  if(process.version!=='v24.22.0')throw Error('Use Node 24.22.0 from .nvmrc; current '+process.version);
  if(o.compare){const report=compare(...o.compare.map(d=>json(path.join(d,'manifest.json'))));console.log(JSON.stringify(report,null,2));return report;}
  if(o.replay){const dir=path.resolve(o.replay),result=E.replayRecords(json(path.join(dir,'input.json')),streamTrace(path.join(dir,'trace.jsonl')));console.log(JSON.stringify(result,null,2));return result;}
  if(o.lane&&o.lane!=='production')throw Error('Only --lane production is supported. Nested wall timers are not controlled; no deterministic-budget claim.');
  const diagnostic=parallel>1||config.timeMs===null;
  if(diagnostic&&o.lane==='production')throw Error('Diagnostic options cannot be labeled --lane production');
  const preset=o.preset||'quick';if(!E.PRESETS[preset])throw Error('Unknown preset '+preset);
  const p=E.PRESETS[preset],scenario=o.scenario||'empty';if(!['empty','stable','both'].includes(scenario))throw Error('Unknown scenario '+scenario);
  const locks=integer(o.locks||p.locks,'locks',1,2000);
  const seeds=o.seeds?o.seeds.split(',').map(v=>integer(v,'seed',0,4294967295)):p.seeds;
  if(!seeds.length||seeds.length>100||new Set(seeds).size!==seeds.length)throw Error('Provide 1..100 distinct seeds');
  const rerun=o.rerun?json(path.join(path.resolve(o.rerun),'input.json')):null;
  if(rerun&&(o.seeds||o.scenario||o.locks||o['opening-locks']||o['post-handoff-locks']))throw Error('--rerun preserves recorded input and cap; do not override seeds/scenario/locks');
  const inputs=protocol?V.pairs(protocol).map(p=>p.input):rerun?[rerun]:(scenario==='both'?['empty','stable']:[scenario]).flatMap(s=>seeds.map(seed=>E.makeInput(s,seed,locks)));
  if(o['opening-locks']||o['post-handoff-locks']){
    if(!o['opening-locks']||!o['post-handoff-locks'])throw Error('Both phase cap options are required');
    for(const input of inputs){input.phaseCap={openingLocks:integer(o['opening-locks'],'opening-locks',1,2000),postHandoffLocks:integer(o['post-handoff-locks'],'post-handoff-locks',1,2000)};E.validatePhaseCap(input);}
  }
  const cap=protocol?protocol.execution.locks:rerun?rerun.locks:locks,episodeMs=integer(o['episode-ms']||(protocol?protocol.execution.episodeMs:null)||Math.ceil(cap*((config.timeMs??E.CONFIG.timeMs)+1750)+5000),'episode-ms',100,7200000);
  const directory=Runner.createRunDirectory(path.resolve(o.out||path.join(ROOT,'test-results/simulation'))),id=path.basename(directory);
  const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
  const manifest={schemaVersion:1,id,command:args,startedAt:new Date().toISOString(),commit:git('rev-parse','HEAD'),dirty:Boolean(git('status','--porcelain')),node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,lockHash:E.digest(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8')),sources:E.sourceHashes(),preset:rerun?'recorded-input-rerun':preset,config,locks:cap,rng:E.RNG_VERSION,lane:diagnostic?'diagnostic-wall-clock':'production-wall-clock',parallel,decisionWatchdogMs:config.timeMs===null?null:2500,execution:'rapid-uninterrupted-actual-witness-v1',episodeMs,episodes:[],complete:false};
  if(protocol)manifest.evaluationBinding=V.bindProtocol(protocol,o.side,manifest.sources,V.manifestExecution(manifest),inputs);
  const manifestPath=path.join(directory,'manifest.json');write(manifestPath,manifest);
  if(protocol)fs.writeFileSync(path.join(directory,'protocol.json'),V.stringify(protocol),{flag:'wx'});
  console.log('Results: '+directory);
  if(diagnostic)console.warn('Diagnostic run: CPU contention and nested wall timers can change decisions; not production-budget acceptance evidence.');
  return finishRun({o,inputs,config,parallel,episodeMs,directory,manifest,manifestPath});
}
async function finishRun({o,inputs,config,parallel,episodeMs,directory,manifest,manifestPath}){
  const controller=new AbortController(),summaries=new Array(inputs.length);let runError,interrupted;
  setMaxListeners(parallel+1,controller.signal);
  const interrupt=signal=>{interrupted=signal;controller.abort();};
  const onInt=()=>interrupt('SIGINT'),onTerm=()=>interrupt('SIGTERM');
  process.once('SIGINT',onInt);process.once('SIGTERM',onTerm);
  const sourcesChanged=()=>JSON.stringify(E.sourceHashes())!==JSON.stringify(manifest.sources);
  try{
    await Runner.runPool(inputs,parallel,async(input,index)=>{
      if(sourcesChanged())throw Error('Source changed during evaluation; restart after edits settle. Partial manifest retained.');
      const episodeDir=path.join(directory,`${input.scenario}-${input.seed}`);fs.mkdirSync(episodeDir);
      const inputPath=path.join(episodeDir,'input.json'),specPath=path.join(episodeDir,'spec.json');
      write(inputPath,input);write(specPath,{input:inputPath,directory:episodeDir,config,sources:manifest.sources,...(manifest.evaluationBinding?{evaluationBinding:manifest.evaluationBinding,execution:V.manifestExecution(manifest)}:{})});
      const result=await Runner.runChild(process.execPath,['--max-old-space-size=512',__filename,'--child',specPath],{cwd:ROOT,timeoutMs:episodeMs,signal:controller.signal});
      const summaryPath=path.join(episodeDir,'summary.json');
      let summary=recoverSummary(episodeDir,input,result);
      if(sourcesChanged()){
        if(fs.existsSync(summaryPath))preserveChildSummary(episodeDir);
        summary.stop='source-changed';summary.censored=false;summary.detail='Source files changed during episode; result is not revision-bound.';
        controller.abort();
      }
      write(summaryPath,summary);summaries[index]=summary;manifest.episodes=summaries.filter(Boolean);write(manifestPath,manifest);
      console.log(`${input.scenario} seed ${input.seed}: ${summary.locks}/${input.locks} locks, ${summary.lines} lines, ${summary.stop}${summary.censored?' (censored)':''}; ${trackingReport(summary)}`);
      if(failure(summary))process.exitCode=1;
      return summary;
    },{signal:controller.signal,onError:()=>controller.abort()});
  }catch(error){runError=error;manifest.error=error.stack;process.exitCode=1;}
  finally{
    process.removeListener('SIGINT',onInt);process.removeListener('SIGTERM',onTerm);
    if(interrupted){manifest.interrupted=interrupted;process.exitCode=interrupted==='SIGINT'?130:143;}
    manifest.finishedAt=new Date().toISOString();manifest.complete=!controller.signal.aborted&&manifest.episodes.length===inputs.length;
    manifest.exitCode=process.exitCode||0;write(manifestPath,manifest);
  }
  // Normalize only after every timed child has ended, outside planner budgets.
  const lines=['# ST simulation',`Revision: ${manifest.commit}${manifest.dirty?' (dirty; diagnostic only)':''}`,`Lane: ${manifest.lane}; parallel: ${manifest.parallel}; search timeout: ${manifest.config.timeMs===null?'disabled':manifest.config.timeMs+' ms'}; decision watchdog: ${manifest.decisionWatchdogMs===null?'disabled':manifest.decisionWatchdogMs+' ms'}; episode watchdog: ${manifest.episodeMs} ms. Fixed seeds do not imply deterministic search.`,...(manifest.lane==='diagnostic-wall-clock'?['Diagnostic only: not production-budget acceptance evidence.']:[]),...(!manifest.complete?['Incomplete run: see manifest and retained episode artifacts.']:[]),...manifest.episodes.map(e=>`- ${e.scenario}, seed ${e.seed}: ${e.locks}/${e.cap} locks, ${e.lines} lines; ${e.stop}${e.censored?' (censored)':''}; ${trackingReport(e)}.`),'','## Observed coach entries',...V.coachEntryReport(manifest.episodes.map(e=>({label:e.scenario+', seed '+e.seed,currentCoach:e.currentCoach,coachHistoryScope:e.coachHistoryScope,measurements:Object.fromEntries(Object.entries(V.COACH_ENTRY_METRICS).map(([metric,coach])=>[metric,e.coachEntries?.[coach]??null]))}))), '','No capped run certifies indefinite sustainability or a full Reset. Recorded-action replay verifies actions; rerun asks the current timed engine again.'];fs.writeFileSync(path.join(directory,'report.md'),lines.join('\n')+'\n');
  if(o['mino-ledger']&&!controller.signal.aborted){manifest.regionalMinoAnalysis={mode:'offline-after-all-episodes',episodes:exportMinoLedgers(directory,manifest.episodes),finishedAt:new Date().toISOString()};manifest.exitCode=process.exitCode||0;write(manifestPath,manifest);}
  if(manifest.complete)fs.writeFileSync(path.join(directory,'observations.json'),V.stringify(V.normalize(manifest,inputs)));
  if(runError)throw runError;
  return manifest;
}
if(require.main===module)Promise.resolve().then(()=>main()).catch(error=>{console.error(error.stack);process.exitCode||=1;});
module.exports={parse,compare,main,failure,readTrace,streamTrace,configuration,exportMinoLedgers,recoverSummary,recoverTracking,trackingReport};
