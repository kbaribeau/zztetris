'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');

async function controlledRun(t,{workers,counts={tests:1,failed:0,passed:1,skipped:0,todo:0,cancelled:0},success=true,summary=true,abort=false}={}){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zztetris-runner-control-')),script=require.resolve('../scripts/test.cjs');
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const process={env:{ZZTETRIS_TEST_RESULTS_DIR:temp,NODE_DISABLE_COMPILE_CACHE:'1',...(workers===undefined?{}:{ZZTETRIS_TEST_CONCURRENCY:workers})},pid:17,version:'v24.22.0',platform:'test',execPath:'controlled-node',chdir(){},stdout:{write(){}},exitCode:undefined};
 let options,watchdog,watchdogMs,cleared=false;const listeners={};
 const child={execFileSync:(command,args)=>{assert.equal(command,'git');return args[0]==='status'?'':'controlled-git';}};
 const mocks={'node:test':{run:settings=>{
  options=settings;
  return{on(name,callback){listeners[name]=callback;},async *compose(){
   if(abort){watchdog();throw options.signal.reason;}
   listeners['test:pass']({name:'controlled case',file:path.resolve(__dirname,'st-natural.test.cjs'),details:{duration_ms:3}});
   if(summary)listeners['test:summary']({success,counts});
   yield '# controlled reporter output\n';
  }};
 }},'node:test/reporters':{tap:null},'node:child_process':child,'../test/support/pages.cjs':{SEED:1},'../test/support/st-natural.cjs':{seed:2}};
 await vm.runInNewContext(fs.readFileSync(script,'utf8'),{require:id=>mocks[id]||require(id),__dirname:path.dirname(script),process,console:{log(){},error(){}},AbortController,setTimeout:(callback,ms)=>{watchdog=callback;watchdogMs=ms;return 17;},clearTimeout:id=>{if(id===17)cleared=true;}});
 const dirs=fs.readdirSync(temp);assert.equal(dirs.length,1);
 const manifest=JSON.parse(fs.readFileSync(path.join(temp,dirs[0],'manifest.json'),'utf8'));
 const transcript=fs.readFileSync(path.join(temp,dirs[0],'results.tap'),'utf8');
 return{manifest,transcript,options,process,watchdogMs,cleared};
}

test('runner defaults to serial process isolation and retains every discovered test file',async t=>{
 const r=await controlledRun(t),files=fs.readdirSync(path.join(__dirname)).filter(file=>file.endsWith('.test.cjs')).sort().map(file=>`test/${file}`);
 assert.equal(r.process.exitCode,0);assert.equal(r.manifest.exitCode,0);
 assert.deepEqual(r.manifest.execution,{concurrency:1,isolation:'process'});
 assert.deepEqual(r.manifest.testFiles,files);assert.deepEqual(Array.from(r.options.files),files);
 assert.equal(r.options.concurrency,1);assert.equal(r.options.isolation,'process');assert.equal(r.options.timeout,15000);
 assert.equal(r.watchdogMs,1800000);assert.equal(r.cleared,true);assert.equal(r.options.signal.aborted,false);
 assert.deepEqual(r.manifest.seeds,[1,2]);assert.equal(r.manifest.cases[0].seed,2);
 assert.match(r.transcript,/controlled reporter output/);
});

test('runner uses explicit bounded worker counts without changing discovery, seeds or timeouts',async t=>{
 for(const workers of ['2','4','32']){
  const r=await controlledRun(t,{workers});
  assert.equal(r.process.exitCode,0);assert.equal(r.manifest.execution.concurrency,Number(workers));
  assert.equal(r.options.concurrency,Number(workers));assert.equal(r.options.isolation,'process');
  assert.equal(r.options.timeout,15000);assert.equal(r.watchdogMs,1800000);
  assert.deepEqual(Array.from(r.options.files),r.manifest.testFiles);assert.equal(r.manifest.cases[0].seed,2);
 }
});

test('runner rejects invalid worker settings before starting children and keeps failure evidence',async t=>{
 for(const workers of ['','0','-1','33','1.5','NaN','Infinity','true','2e0',' 2 ','9007199254740992']){
  const r=await controlledRun(t,{workers});
  assert.equal(r.options,undefined);assert.equal(r.process.exitCode,1);assert.equal(r.manifest.exitCode,1);
  assert.match(r.manifest.error,/ZZTETRIS_TEST_CONCURRENCY must be an integer 1\.\.32/);
  assert.match(r.transcript,/Runner error:/);
 }
});

test('parallel runner preserves strict failed, skipped, TODO, cancelled and empty-suite exit status',async t=>{
 const base={tests:1,failed:0,passed:1,skipped:0,todo:0,cancelled:0};
 for(const overrides of [{success:false},{counts:{...base,failed:1} ,success:false},{counts:{...base,skipped:1}},{counts:{...base,todo:1}},{counts:{...base,cancelled:1}},{counts:{...base,tests:0}},{summary:false}]){
  const r=await controlledRun(t,{workers:'2',...overrides});
  assert.equal(r.process.exitCode,1);assert.equal(r.manifest.exitCode,1);
 }
});

test('parallel runner keeps the whole-suite abort and durable error manifest',async t=>{
 const r=await controlledRun(t,{workers:'2',abort:true});
 assert.equal(r.options.signal.aborted,true);assert.equal(r.cleared,true);
 assert.equal(r.process.exitCode,1);assert.equal(r.manifest.exitCode,1);
 assert.match(r.manifest.error,/Suite exceeded 1800 seconds/);assert.match(r.transcript,/Runner error:/);
});

test('runner keeps a durable failed manifest when its bounded compile-cache probe fails',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zztetris-runner-control-')),script=require.resolve('../scripts/test.cjs');
 let cache,probe=false;const process={env:{ZZTETRIS_TEST_RESULTS_DIR:temp},pid:17,version:'v24.22.0',platform:'test',execPath:'controlled-node',chdir(){},stdout:{write(){}},exitCode:undefined};
 const child={execFileSync:(command,args,opts)=>{if(command==='git')return args[0]==='status'?'':'controlled-git';assert.equal(command,process.execPath);assert.equal(opts.timeout,3000);probe=true;throw new Error('controlled compile probe failure');}};
 const mocks={'node:test':{run:()=>{throw new Error('Tests must not start after failed probe');}},'node:test/reporters':{tap:null},'node:child_process':child,'node:fs':{...fs,mkdtempSync:prefix=>{cache=fs.mkdtempSync(prefix);return cache;}},'../test/support/pages.cjs':{SEED:1},'../test/support/st-natural.cjs':{seed:2}};
 try{
  await vm.runInNewContext(fs.readFileSync(script,'utf8'),{require:id=>mocks[id]||require(id),__dirname:path.dirname(script),process,console:{log(){},error(){}},AbortController,setTimeout,clearTimeout});
  assert.equal(probe,true);assert.equal(process.exitCode,1);const dirs=fs.readdirSync(temp);assert.equal(dirs.length,1);
  const manifest=JSON.parse(fs.readFileSync(path.join(temp,dirs[0],'manifest.json'),'utf8'));assert.equal(manifest.exitCode,1);assert.match(manifest.error,/controlled compile probe failure/);
  assert.deepEqual(manifest.compileCache,{enabled:false,coldPerRun:true,cleaned:true});assert.equal(fs.existsSync(cache),false);
 }finally{fs.rmSync(temp,{recursive:true,force:true});if(cache)fs.rmSync(cache,{recursive:true,force:true});}
});
