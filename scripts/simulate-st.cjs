#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync,execFileSync}=require('node:child_process');
const E=require('./lib/st-simulation.cjs');
const ROOT=path.resolve(__dirname,'..'),MAX_FILE=64*1024*1024;
const json=file=>{if(fs.statSync(file).size>MAX_FILE)throw Error('Artifact exceeds 64 MiB: '+file);return JSON.parse(fs.readFileSync(file,'utf8'));};
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function readTrace(file){if(fs.statSync(file).size>MAX_FILE)throw Error('Trace exceeds 64 MiB');return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
function integer(value,name,min,max){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${name} must be an integer ${min}..${max}`);return n;}
function parse(args) {
  const out={};
  for(let i=0;i<args.length;i++) {
    const key=args[i];
    if(key==='--help'){out.help=true;continue;}
    if(key==='--usage-telemetry'||key==='--mino-ledger'){out[key.slice(2)]=true;continue;}
    if(key==='--compare'){out.compare=[args[++i],args[++i]];if(out.compare.some(x=>!x||x.startsWith('--')))throw Error('--compare requires two run directories');continue;}
    if(!['--preset','--scenario','--seeds','--locks','--out','--replay','--rerun','--episode-ms','--lane','--child'].includes(key))throw Error('Unknown option '+key);
    const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+key);out[key.slice(2)]=value;
  }
  return out;
}
function configuration(options={}){return options['usage-telemetry']?{...E.CONFIG,usageTelemetry:true}:E.CONFIG;}
function failure(summary){return ['invalid-recommendation','execution-error','policy-violation','planner-error','planner-timeout','runner-error','artifact-limit','source-changed'].includes(summary.stop);}
function compare(a,b) {
  if(a.episodes.length===0||b.episodes.length===0)throw Error('Comparison requires nonempty cohorts');
  if(!a.complete||!b.complete)throw Error('Comparison requires complete run manifests');
  if(a.schemaVersion!==1||b.schemaVersion!==1)throw Error('Unsupported manifest schema');
  const contract=m=>({schemaVersion:m.schemaVersion,config:m.config,locks:m.locks,rng:m.rng,lane:m.lane,execution:m.execution});
  if(JSON.stringify(contract(a))!==JSON.stringify(contract(b)))throw Error('Incompatible budgets, caps, RNG, lane or execution protocol');
  const am=new Map(a.episodes.map(x=>[x.scenario+':'+x.seed,x]));
  if(am.size!==a.episodes.length||new Set(b.episodes.map(x=>x.scenario+':'+x.seed)).size!==b.episodes.length||a.episodes.length!==b.episodes.length)throw Error('Episode cohorts differ or contain duplicate seeds');
  const pairs=[];
  for(const y of b.episodes) {
    const key=y.scenario+':'+y.seed,x=am.get(key);
    if(!x||x.inputHash!==y.inputHash)throw Error('Private/public episode inputs differ: '+key);
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
  return {mode:'paired-comparison',cohorts,pairs,note:'Restricted mean is bounded by the common lock cap; null median means not reached. Seed-level bootstrap is exploratory, especially for tiny development cohorts. Wall-clock search variation remains; repeat matched runs. No indefinite-survival or Reset certification.'};
}
function child(specPath) {
  const spec=json(specPath),input=json(spec.input),trace=path.join(spec.directory,'trace.jsonl');let bytes=0;
  fs.writeFileSync(trace,'');
  try {
    const summary=E.runEpisode(input,{config:spec.config,onRecord:record=>{const line=JSON.stringify(record)+'\n';bytes+=Buffer.byteLength(line);if(bytes>MAX_FILE)throw Object.assign(Error('Trace reached 64 MiB limit'),{code:'ARTIFACT_LIMIT'});fs.appendFileSync(trace,line);}});
    write(path.join(spec.directory,'summary.json'),summary);
  } catch(error) {
    write(path.join(spec.directory,'error.json'),{stop:error.code==='ARTIFACT_LIMIT'?'artifact-limit':'runner-error',message:error.stack});process.exitCode=1;
  }
}
function fallback(directory,input,result) {
  const records=fs.existsSync(path.join(directory,'trace.jsonl'))?readTrace(path.join(directory,'trace.jsonl')):[];
  const steps=records.filter(r=>r.kind==='lock'),last=steps.at(-1),errFile=path.join(directory,'error.json');
  const detail=fs.existsSync(errFile)?json(errFile):{message:result.error?.message||result.stderr||result.signal};
  const stop=result.error?.code==='ETIMEDOUT'?'wall-cap':detail.stop||'runner-error';
  return{schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,stop,censored:stop==='wall-cap',locks:steps.length,lines:last?.metrics.lines||0,tsds:last?.metrics.tsds||0,quads:last?.metrics.quads||0,profile:steps.map(s=>s.metrics),detail};
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
  const config=configuration(o);
  if(['compare','replay','rerun','child'].filter(key=>o[key]).length>1)throw Error('Choose one of --compare, --replay or --rerun');
  if(o.help){console.log(`ST closed-loop evaluation (Node 24.22.0; no browser/dependencies)\n\nnpm run sim:st -- --preset quick [--scenario empty|stable|both]\nnpm run sim:st -- --preset research [--seeds 1,2] [--locks 500]\nnpm run sim:st -- --replay test-results/simulation/RUN/empty-1\nnpm run sim:st -- --rerun test-results/simulation/RUN/empty-1\nnpm run sim:st -- --compare BASELINE_RUN CANDIDATE_RUN\n\nOptions: --out parent-directory, --episode-ms wall-watchdog, --lane production, --usage-telemetry, --mino-ledger.\nMino ledgers are offline exports after all timed episodes; use minos:st for existing traces.\nUsage counters are opt-in and recorded in run configuration; measure overhead before timed comparisons.\nOnly production wall-clock lane is supported; fixed seeds are not deterministic search.\nQuick: 2 development seeds × 24 locks. Research: 16 seeds × 500 locks.\nDefaults start empty. Stable uses the public marathon-rebuild position with a seeded valid continuation, not its fixed demo tail.\nAbstention is a measured outcome, not a failing command or a top-out. Safety/runner failures exit nonzero.`);return;}
  if(o.child){child(o.child);return;}
  if(process.version!=='v24.22.0')throw Error('Use Node 24.22.0 from .nvmrc; current '+process.version);
  if(o.compare){const report=compare(...o.compare.map(d=>json(path.join(d,'manifest.json'))));console.log(JSON.stringify(report,null,2));return report;}
  if(o.replay){const dir=path.resolve(o.replay),result=E.replayRecords(json(path.join(dir,'input.json')),readTrace(path.join(dir,'trace.jsonl')));console.log(JSON.stringify(result,null,2));return result;}
  if(o.lane&&o.lane!=='production')throw Error('Only --lane production is supported. Nested wall timers are not controlled; no deterministic-budget claim.');
  const preset=o.preset||'quick';if(!E.PRESETS[preset])throw Error('Unknown preset '+preset);
  const p=E.PRESETS[preset],scenario=o.scenario||'empty';if(!['empty','stable','both'].includes(scenario))throw Error('Unknown scenario '+scenario);
  const locks=integer(o.locks||p.locks,'locks',1,2000);
  const seeds=o.seeds?o.seeds.split(',').map(v=>integer(v,'seed',0,4294967295)):p.seeds;
  if(!seeds.length||seeds.length>100||new Set(seeds).size!==seeds.length)throw Error('Provide 1..100 distinct seeds');
  const rerun=o.rerun?json(path.join(path.resolve(o.rerun),'input.json')):null;
  if(rerun&&(o.seeds||o.scenario||o.locks))throw Error('--rerun preserves recorded input and cap; do not override seeds/scenario/locks');
  const inputs=rerun?[rerun]:(scenario==='both'?['empty','stable']:[scenario]).flatMap(s=>seeds.map(seed=>E.makeInput(s,seed,locks)));
  const cap=rerun?rerun.locks:locks,episodeMs=integer(o['episode-ms']||Math.ceil(cap*(config.timeMs+1750)+5000),'episode-ms',100,7200000);
  const id=new Date().toISOString().replaceAll(':','-')+'-'+process.pid;
  const directory=path.resolve(o.out||path.join(ROOT,'test-results/simulation'),id);fs.mkdirSync(directory,{recursive:true});
  const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
  const manifest={schemaVersion:1,id,command:args,startedAt:new Date().toISOString(),commit:git('rev-parse','HEAD'),dirty:Boolean(git('status','--porcelain')),node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,lockHash:E.digest(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8')),sources:E.sourceHashes(),preset:rerun?'recorded-input-rerun':preset,config,locks:cap,rng:E.RNG_VERSION,lane:'production-wall-clock',execution:'rapid-uninterrupted-actual-witness-v1',episodeMs,episodes:[],complete:false};
  const manifestPath=path.join(directory,'manifest.json');write(manifestPath,manifest);
  console.log('Results: '+directory);
  for(const input of inputs) {
    if(JSON.stringify(E.sourceHashes())!==JSON.stringify(manifest.sources))throw Error('Source changed during evaluation; restart after edits settle. Partial manifest retained.');
    const episodeDir=path.join(directory,`${input.scenario}-${input.seed}`);fs.mkdirSync(episodeDir);
    const inputPath=path.join(episodeDir,'input.json'),specPath=path.join(episodeDir,'spec.json');write(inputPath,input);write(specPath,{input:inputPath,directory:episodeDir,config});
    const result=spawnSync(process.execPath,['--max-old-space-size=512',__filename,'--child',specPath],{cwd:ROOT,encoding:'utf8',timeout:episodeMs,killSignal:'SIGKILL',maxBuffer:1024*1024});
    const summaryPath=path.join(episodeDir,'summary.json');let summary=fs.existsSync(summaryPath)?json(summaryPath):fallback(episodeDir,input,result);
    if(JSON.stringify(E.sourceHashes())!==JSON.stringify(manifest.sources)){summary.stop='source-changed';summary.censored=false;summary.detail='Source files changed during episode; result is not revision-bound.';}
    write(summaryPath,summary);manifest.episodes.push(summary);write(manifestPath,manifest);
    console.log(`${input.scenario} seed ${input.seed}: ${summary.locks}/${input.locks} locks, ${summary.lines} lines, ${summary.stop}${summary.censored?' (censored)':''}`);
    if(failure(summary))process.exitCode=1;
    if(summary.stop==='source-changed')break;
  }
  manifest.finishedAt=new Date().toISOString();manifest.complete=manifest.episodes.length===inputs.length;manifest.exitCode=process.exitCode||0;write(manifestPath,manifest);
  const lines=['# ST simulation',`Revision: ${manifest.commit}${manifest.dirty?' (dirty; diagnostic only)':''}`,`Lane: ${manifest.lane}; fixed seeds do not imply deterministic search.`,...manifest.episodes.map(e=>`- ${e.scenario}, seed ${e.seed}: ${e.locks}/${e.cap} locks, ${e.lines} lines; ${e.stop}${e.censored?' (censored)':''}.`),'','No capped run certifies indefinite sustainability or a full Reset. Recorded-action replay verifies actions; rerun asks the current timed engine again.'];fs.writeFileSync(path.join(directory,'report.md'),lines.join('\n')+'\n');
  if(o['mino-ledger']){manifest.regionalMinoAnalysis={mode:'offline-after-all-episodes',episodes:exportMinoLedgers(directory,manifest.episodes),finishedAt:new Date().toISOString()};manifest.exitCode=process.exitCode||0;write(manifestPath,manifest);}
  return manifest;
}
if(require.main===module){try{main();}catch(error){console.error(error.stack);process.exitCode=1;}}
module.exports={parse,compare,main,failure,readTrace,configuration,exportMinoLedgers};
