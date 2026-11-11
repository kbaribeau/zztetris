'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawn}=require('node:child_process');
const Runner=require('../scripts/lib/st-simulation-runner.cjs');
const CLI=require('../scripts/simulate-st.cjs'),E=require('../scripts/lib/st-simulation.cjs'),V=require('../scripts/lib/st-evaluation.cjs');
const {SEARCH_TIME_MS}=require('../st-coach-config');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-runner-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}

test('simulation/diagnostic options are explicit, bounded and leave production budgets unchanged',()=>{
 assert.deepEqual(CLI.parse(['--parallel','3','--no-search-timeout']),{parallel:'3','no-search-timeout':true});
 assert.equal(Runner.concurrency(),1);assert.equal(Runner.concurrency('32'),32);
 for(const value of ['0','-1','33','1.5','NaN','Infinity',''])assert.throws(()=>Runner.concurrency(value),/integer 1..32/);
 assert.throws(()=>CLI.parse(['--parallel']),/Missing/);
 assert.deepEqual(CLI.configuration(),E.CONFIG);
 const config=CLI.configuration({'no-search-timeout':true,'usage-telemetry':true});
 assert.deepEqual(config,{depth:null,width:8,maxNodes:45000,timeMs:null,usageTelemetry:true});
 assert.equal(SEARCH_TIME_MS,1500);assert.equal(E.CONFIG.timeMs,1500);
 for(const mode of [['--replay','unused'],['--compare','one','two'],['--child','unused']]){
  assert.throws(()=>CLI.main([...mode,'--parallel','2']),/new runs/);
  assert.throws(()=>CLI.main([...mode,'--no-search-timeout']),/new runs/);
 }
 for(const flags of [['--parallel','2'],['--no-search-timeout']]){
  assert.throws(()=>CLI.main(['--protocol','not-opened','--side','candidate',...flags]),/Production evaluation protocols/);
  assert.throws(()=>CLI.main(['--lane','production',...flags]),/cannot be labeled/);
 }
});

test('simulation/worker disables outer and VM decision deadlines only in its explicit diagnostic mode',t=>{
 const original=vm.Script.prototype.runInContext,seen=[];
 t.mock.method(vm.Script.prototype,'runInContext',function(context,options){
  if(context.request){
   seen.push(options);
   // Observe the real worker dispatcher options without running a strategy search.
   context.STPlanner={decide:(_state,o)=>({status:'observed-worker-options',unbounded:!Number.isFinite(o.deadline),timeMs:o.timeMs===Infinity?'infinity':o.timeMs,maxNodes:o.maxNodes})};
  }
  return original.call(this,context,options);
 });
 const request={type:'plan',id:1,observation:E.makeInput('empty',1,1).initial,options:{...E.CONFIG}};
 const normal=E.workerPlanner()(request);
 assert.equal(normal.unbounded,false);assert.equal(normal.timeMs,1500);assert.deepEqual(seen.pop(),{timeout:2500});
 const diagnostic={...request,options:CLI.configuration({'no-search-timeout':true})};
 const noTimeout=E.workerPlanner({disableSearchTimeout:true})(diagnostic);
 assert.equal(noTimeout.unbounded,true);assert.equal(noTimeout.timeMs,'infinity');assert.equal(noTimeout.maxNodes,45000);
 assert.deepEqual(seen.pop(),{});assert.equal(diagnostic.options.timeMs,null);
 const after=E.workerPlanner()(request);assert.equal(after.unbounded,false);assert.equal(after.timeMs,1500);
});

test('simulation/pool limits live tasks and preserves input order despite out-of-order completion',async()=>{
 const gates=Array.from({length:4},deferred),started=[],finished=[];let active=0,peak=0;
 const pending=Runner.runPool([0,1,2,3],2,async value=>{
  started.push(value);active++;peak=Math.max(peak,active);await gates[value].promise;active--;finished.push(value);return 'result-'+value;
 });
 assert.deepEqual(started,[0,1]);gates[1].resolve();await tick();assert.deepEqual(started,[0,1,2]);
 gates[2].resolve();await tick();assert.deepEqual(started,[0,1,2,3]);
 gates[3].resolve();gates[0].resolve();assert.deepEqual(await pending,['result-0','result-1','result-2','result-3']);
 assert.equal(peak,2);assert.deepEqual(finished,[1,2,3,0]);
 let serial=0;
 await Runner.runPool([1,2,3],1,async()=>{assert.equal(serial++,0);await tick();serial--;});
 assert.equal(serial,0);
});

test('simulation/pool stops queued work on failure and waits for already-started tasks',async()=>{
 const gate=deferred(),started=[],controller=new AbortController();let settled=false;
 const pending=Runner.runPool([0,1,2],2,async value=>{started.push(value);if(value===0)throw Error('expected failure');await gate.promise;settled=true;},{signal:controller.signal,onError:()=>controller.abort()});
 // Attach the rejection handler before allowing the other task to settle.
 const rejected=assert.rejects(pending,/expected failure/);
 await tick();assert.deepEqual(started,[0,1]);assert.equal(settled,false);gate.resolve();await rejected;assert.equal(settled,true);
});

test('simulation/child watchdog, spawn failure, nonzero exit and output bound are distinct',async()=>{
 const timed=await Runner.runChild(process.execPath,['-e','while(true){}'],{timeoutMs:100});
 assert.equal(timed.error.code,'ETIMEDOUT');assert.equal(timed.signal,'SIGKILL');
 const missing=await Runner.runChild('/nonexistent/st-runner-node',[],{timeoutMs:1000});assert.equal(missing.error.code,'ENOENT');
 const failed=await Runner.runChild(process.execPath,['-e','console.error("failure detail");process.exit(7)'],{timeoutMs:2000});
 assert.equal(failed.status,7);assert.match(failed.stderr,/failure detail/);assert.equal(failed.error,undefined);
 const noisy=await Runner.runChild(process.execPath,['-e','process.stdout.write("x".repeat(100000));setInterval(()=>{},1000)'],{timeoutMs:2000,maxOutput:100});
 assert.equal(noisy.error.code,'ENOBUFS');assert.equal(noisy.stdout.length,100);
 const controller=new AbortController();
 const running=Runner.runChild(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:2000,signal:controller.signal});
 controller.abort();const stopped=await running;assert.equal(stopped.error.code,'ABORT_ERR');assert.equal(stopped.signal,'SIGKILL');
});

test('simulation/run directories remain unique for repeated same-process invocations',t=>{
 const parent=temporary(t),a=Runner.createRunDirectory(parent),b=Runner.createRunDirectory(parent);
 assert.notEqual(a,b);assert.equal(fs.statSync(a).isDirectory(),true);assert.equal(fs.statSync(b).isDirectory(),true);
});

test('simulation/parallel no-timeout CLI retains inputs, ordered manifests and diagnostic metadata',async t=>{
 const parent=temporary(t),original=E.makeInput;
 t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
 t.mock.method(E,'makeInput',(...args)=>{
  const input=original(...args);input.initial.topOut=true;input.inputHash=E.digest(input);return input;
 });
 const result=await CLI.main(['--seeds','7,8,9','--locks','1','--parallel','2','--no-search-timeout','--out',parent]);
 assert.equal(result.complete,true);assert.equal(result.exitCode,0);assert.equal(result.parallel,2);
 assert.equal(result.lane,'diagnostic-wall-clock');assert.equal(result.config.timeMs,null);assert.equal(result.config.maxNodes,45000);
 assert.equal(result.decisionWatchdogMs,null);assert.equal(result.episodeMs,8250);
 assert.deepEqual(result.episodes.map(e=>e.seed),[7,8,9]);assert.equal(result.episodes.every(e=>e.stop==='top-out'),true);
 const observations=JSON.parse(fs.readFileSync(path.join(parent,result.id,'observations.json')));
 assert.equal(observations.provenance.execution.parallel,2);assert.equal(observations.provenance.execution.decisionWatchdogMs,null);
 for(const seed of [7,8,9]){
  const dir=path.join(parent,result.id,'empty-'+seed),input=JSON.parse(fs.readFileSync(path.join(dir,'input.json'))),spec=JSON.parse(fs.readFileSync(path.join(dir,'spec.json')));
  assert.equal(input.seed,seed);assert.equal(spec.config.timeMs,null);assert.deepEqual(spec.sources,result.sources);
  assert.equal(fs.existsSync(path.join(dir,'trace.jsonl')),true);
 }
 const serial=await CLI.main(['--seeds','7','--locks','1','--out',parent]);
 assert.equal(serial.parallel,1);assert.equal(serial.lane,'production-wall-clock');assert.equal(serial.config.timeMs,1500);assert.equal(serial.decisionWatchdogMs,2500);
 assert.equal('parallel' in V.manifestExecution(serial),false); // Existing protocol shape remains valid.
});

test('simulation/source changes abort queued work and retain an incomplete manifest',async t=>{
 const parent=temporary(t),original=E.sourceHashes,oldExit=process.exitCode;let calls=0;
 t.after(()=>{process.exitCode=oldExit;});t.mock.method(console,'log',()=>{});
 t.mock.method(E,'sourceHashes',()=>{const hashes=original();if(calls++)hashes['st-worker.js']='0'.repeat(64);return hashes;});
 await assert.rejects(CLI.main(['--seeds','7,8','--locks','1','--out',parent]),/Source changed/);
 const dir=path.join(parent,fs.readdirSync(parent)[0]),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 assert.equal(manifest.complete,false);assert.equal(manifest.exitCode,1);assert.deepEqual(manifest.episodes,[]);
 assert.equal(fs.existsSync(path.join(dir,'observations.json')),false);
});

test('simulation/comparison rejects different concurrency, watchdogs and timeout modes',()=>{
 const episode={scenario:'empty',seed:1,inputHash:'same',locks:1,stop:'lock-cap',censored:true,profile:[{lines:0,height:1}]};
 const base={schemaVersion:1,complete:true,config:E.CONFIG,locks:1,rng:E.RNG_VERSION,lane:'production-wall-clock',execution:'rapid-uninterrupted-actual-witness-v1',episodes:[episode]};
 assert.doesNotThrow(()=>CLI.compare(base,{...base,parallel:1,decisionWatchdogMs:2500}));
 for(const change of [{parallel:2},{decisionWatchdogMs:null},{episodeMs:100},{config:CLI.configuration({'no-search-timeout':true})}])assert.throws(()=>CLI.compare(base,{...base,...change}),/Incompatible budgets/);
});

test('simulation/partial failed-child artifacts preserve raw bytes and do not drop healthy episodes',async t=>{
 const parent=temporary(t),oldExit=process.exitCode,started=[];
 t.after(()=>{process.exitCode=oldExit;});t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
 const brokenTrace=JSON.stringify({kind:'lock',metrics:{lines:0,tsds:0,quads:0}})+'\n{"kind":"lock","request":';
 t.mock.method(Runner,'runChild',async(_command,args)=>{
  const spec=JSON.parse(fs.readFileSync(args.at(-1))),input=JSON.parse(fs.readFileSync(spec.input));started.push(input.seed);
  if(input.seed===7){fs.writeFileSync(path.join(spec.directory,'trace.jsonl'),brokenTrace);return{status:null,error:Object.assign(Error('watchdog'),{code:'ETIMEDOUT'})};}
  if(input.seed===9){fs.writeFileSync(path.join(spec.directory,'summary.json'),'{"schemaVersion":');return{status:0};}
  if(input.seed===10){fs.writeFileSync(path.join(spec.directory,'error.json'),'{"stop":');return{status:1};}
  fs.writeFileSync(path.join(spec.directory,'summary.json'),JSON.stringify({schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,stop:'top-out',censored:false,locks:0,lines:0,profile:[]}));
  return{status:0};
 });
 const manifest=await CLI.main(['--seeds','7,8,9,10,11','--locks','2','--parallel','2','--out',parent]);
 assert.deepEqual(started,[7,8,9,10,11]);assert.equal(manifest.complete,true);assert.equal(manifest.exitCode,1);
 assert.deepEqual(manifest.episodes.map(e=>e.stop),['wall-cap','top-out','runner-error','runner-error','top-out']);
 const [timed,,summaryError,errorError]=manifest.episodes;
 assert.equal(timed.locks,1);assert.equal(timed.censored,true);assert.equal(timed.detail.artifactRecovery.complete,false);
 assert.equal(summaryError.detail.artifactRecovery.errors[0].file,'summary.child.json');
 assert.equal(errorError.detail.artifactRecovery.errors[0].file,'error.json');
 const root=path.join(parent,manifest.id);
 assert.equal(fs.readFileSync(path.join(root,'empty-7','trace.jsonl'),'utf8'),brokenTrace);
 assert.equal(fs.readFileSync(path.join(root,'empty-9','summary.child.json'),'utf8'),'{"schemaVersion":');
 assert.equal(fs.readFileSync(path.join(root,'empty-10','error.json'),'utf8'),'{"stop":');
 assert.throws(()=>Array.from(CLI.streamTrace(path.join(root,'empty-7','trace.jsonl'))),/JSON/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'observations.json'))).episodes.length,5);
});

test('simulation/source changes with active children stop the queue and preserve both failures',async t=>{
 const parent=temporary(t),oldExit=process.exitCode,original=E.sourceHashes,gate=deferred(),started=[];let changed=false;
 t.after(()=>{process.exitCode=oldExit;});t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
 t.mock.method(E,'sourceHashes',()=>{const hashes=original();if(changed)hashes['st-worker.js']='0'.repeat(64);return hashes;});
 t.mock.method(Runner,'runChild',async(_command,args,{signal})=>{
  const spec=JSON.parse(fs.readFileSync(args.at(-1))),input=JSON.parse(fs.readFileSync(spec.input));started.push(input.seed);
  if(started.length===2)gate.resolve();
  if(input.seed===7){
   await gate.promise;
   fs.writeFileSync(path.join(spec.directory,'summary.json'),JSON.stringify({schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,stop:'top-out',censored:false,locks:0,lines:0,profile:[]}));
   changed=true;return{status:0};
  }
  await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
  return{status:null,error:Object.assign(Error('interrupted'),{code:'ABORT_ERR'})};
 });
 const manifest=await CLI.main(['--seeds','7,8,9','--locks','1','--parallel','2','--out',parent]);
 assert.deepEqual(started,[7,8]);assert.equal(manifest.complete,false);assert.equal(manifest.exitCode,1);
 assert.deepEqual(manifest.episodes.map(e=>e.stop),['source-changed','source-changed']);
 const root=path.join(parent,manifest.id);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'empty-7','summary.child.json'))).stop,'top-out');
 assert.equal(fs.existsSync(path.join(root,'empty-9')),false);
});

test('simulation/real interrupt signals retain partial traces and return 130 or 143',async t=>{
 const root=path.resolve(__dirname,'..');
 for(const [signal,exitCode]of [['SIGINT',130],['SIGTERM',143]]){
  const parent=temporary(t);
  // A controlled child substitute waits for the real CLI process signal. No
  // planner work or actual runaway episode is needed to test finalization.
  const script=`
   const fs=require('node:fs'),path=require('node:path');
   const Runner=require('./scripts/lib/st-simulation-runner.cjs');
   Runner.runChild=async(_command,args,{signal})=>{
    const spec=JSON.parse(fs.readFileSync(args.at(-1)));
    fs.writeFileSync(path.join(spec.directory,'trace.jsonl'),'\\u007b"kind":"lock","request":');
    await new Promise(resolve=>{const keepAlive=setInterval(()=>{},1000);signal.addEventListener('abort',()=>{clearInterval(keepAlive);resolve();},{once:true});console.log('READY FOR SIGNAL');});
    return{status:null,error:Object.assign(Error('interrupted'),{code:'ABORT_ERR'})};
   };
   require('./scripts/simulate-st.cjs').main(['--seeds','7,8','--locks','1','--out',${JSON.stringify(parent)}]).catch(error=>{console.error(error);process.exitCode||=1;});
  `;
  const result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['-e',script],{cwd:root,stdio:['ignore','pipe','pipe']});let output='',errors='',sent=false;
   const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Signal regression test exceeded 5 seconds'));},5000);
   child.stdout.on('data',chunk=>{output+=chunk;if(!sent&&output.includes('READY FOR SIGNAL')){sent=true;child.kill(signal);}});
   child.stderr.on('data',chunk=>{errors+=chunk;});child.on('error',reject);
   child.on('close',(code,exitSignal)=>{clearTimeout(timer);resolve({code,exitSignal,errors});});
  });
  assert.equal(result.code,exitCode,result.errors);assert.equal(result.exitSignal,null);
  const dir=path.join(parent,fs.readdirSync(parent)[0]),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
  assert.equal(manifest.interrupted,signal);assert.equal(manifest.complete,false);assert.equal(manifest.exitCode,exitCode);
  assert.equal(manifest.episodes.length,1);assert.equal(manifest.episodes[0].stop,'runner-error');
  assert.equal(manifest.episodes[0].detail.artifactRecovery.complete,false);
  assert.equal(fs.existsSync(path.join(dir,'empty-8')),false);
 }
});
