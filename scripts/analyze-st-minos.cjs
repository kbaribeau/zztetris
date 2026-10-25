#!/usr/bin/env node
'use strict';
// Post-processing only: never run planner search or decisions or modify the recorded episode.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const L=require('./lib/st-mino-ledger.cjs'),O=require('./lib/st-mino-origins.cjs');
const ROOT=path.resolve(__dirname,'..'),MAX_FILE=64*1024*1024;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function bytes(file){if(fs.statSync(file).size>MAX_FILE)throw Error('Artifact exceeds 64 MiB: '+file);return fs.readFileSync(file);}
function parse(args){const o={};for(let i=0;i<args.length;i++){const key=args[i];if(key==='--help'){o.help=true;continue;}if(!['--episode','--out','--prefix-locks','--windows'].includes(key))throw Error('Unknown option '+key);const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+key);o[key.slice(2)]=value;}return o;}
function analyzeDirectory(directory,{out=null,prefixLocks=null,windowSizes=[7,14,28]}={}){
 const inputBytes=bytes(path.join(directory,'input.json')),traceBytes=bytes(path.join(directory,'trace.jsonl'));
 const input=JSON.parse(inputBytes),all=traceBytes.toString('utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
 let records=all;
 if(prefixLocks!==null){if(!Number.isSafeInteger(prefixLocks)||prefixLocks<0||prefixLocks>2000)throw Error('prefix-locks must be an integer 0..2000');const locks=all.filter(r=>r.kind==='lock');if(prefixLocks>locks.length)throw Error('Prefix exceeds recorded locks');records=prefixLocks===0?[]:all.slice(0,all.indexOf(locks[prefixLocks-1])+1);}
 const sourceFiles=['scripts/analyze-st-minos.cjs','scripts/lib/st-mino-ledger.cjs','scripts/lib/st-mino-origins.cjs','scripts/lib/st-simulation.cjs','st-rules.js','st-bag.js','st-fixtures.js'];
 const sources=()=>Object.fromEntries(sourceFiles.map(f=>[f,digest(fs.readFileSync(path.join(ROOT,f)))]));
 const before=sources(),ledger=L.analyze(input,records,{origins:O.resolve(input),windowSizes});
 if(JSON.stringify(before)!==JSON.stringify(sources()))throw Error('Analysis source changed during replay');
 const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
 ledger.artifact={inputSha256:digest(inputBytes),traceSha256:digest(traceBytes),commit:git('rev-parse','HEAD'),dirty:Boolean(git('status','--porcelain')),node:process.version,sources:before,prefixLocks};
 const output=path.resolve(out||path.join(directory,'mino-ledger-'+new Date().toISOString().replaceAll(':','-')));
 // Refuse to replace an existing analysis, including a failure from an earlier run.
 fs.mkdirSync(output,{recursive:false});
 fs.writeFileSync(path.join(output,'ledger.json'),JSON.stringify(ledger,null,2)+'\n');
 for(const[name,csv]of Object.entries(L.csvFiles(ledger)))fs.writeFileSync(path.join(output,name+'.csv'),csv);
 return{output,coverage:ledger.coverage,provenance:ledger.provenance,totals:ledger.totals};
}
function main(args=process.argv.slice(2)){
 const o=parse(args);if(o.help){console.log('Offline regional mino accounting, without planner search.\n\nnpm run minos:st -- --episode EPISODE_DIRECTORY [--out NEW_DIRECTORY]\nOptions: --prefix-locks N (reconstruct an earlier recorded state), --windows 7,14,28.\nExports ledger.json, locks.csv, bags.csv and windows.csv.\nOrigins are known only after exact generator replay; imported origins remain unknown.\nThe source input and trace are read-only. Existing output directories are never replaced.');return;}
 if(!o.episode)throw Error('--episode is required');
 const result=analyzeDirectory(path.resolve(o.episode),{out:o.out,prefixLocks:o['prefix-locks']===undefined?null:Number(o['prefix-locks']),windowSizes:o.windows===undefined?[7,14,28]:o.windows.split(',').map(Number)});
 console.log(JSON.stringify(result,null,2));return result;
}
if(require.main===module){try{main();}catch(error){console.error(error.stack);process.exitCode=1;}}
module.exports={parse,analyzeDirectory,main};
