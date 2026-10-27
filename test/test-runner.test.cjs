'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');

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
