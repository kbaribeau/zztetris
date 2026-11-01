#!/usr/bin/env node
'use strict';
// Offline board observations only; source episodes are never rewritten.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const L=require('./lib/st-left-shape-metrics.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function bytes(file){if(fs.statSync(file).size>64*1024*1024)throw Error('Artifact exceeds 64 MiB: '+file);return fs.readFileSync(file);}
function parse(args){const out={};for(let i=0;i<args.length;i++){
 const key=args[i];if(key==='--help'){out.help=true;continue;}
 if(!['--episode','--out','--prefix-locks'].includes(key))throw Error('Unknown option '+key);
 const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+key);out[key.slice(2)]=value;
}return out;}
function analyzeDirectory(directory,{out=null,prefixLocks=null}={}){
 const inputBytes=bytes(path.join(directory,'input.json')),traceBytes=bytes(path.join(directory,'trace.jsonl'));
 const input=JSON.parse(inputBytes),records=traceBytes.toString('utf8').split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line));
 const result=L.analyze(input,records,{prefixLocks});
 result.artifact={inputSha256:digest(inputBytes),traceSha256:digest(traceBytes),node:process.version,sources:Object.fromEntries(['scripts/analyze-st-left-shapes.cjs','scripts/lib/st-left-shape-metrics.cjs','st-left-context.js','st-structure.js','st-rules.js','st-bag.js'].map(file=>[file,digest(fs.readFileSync(path.join(__dirname,'..',file)))]))};
 if(out)fs.writeFileSync(path.resolve(out),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
function main(args=process.argv.slice(2)){
 const o=parse(args);if(o.help){console.log('Count observed Left shapes without planner search.\n\nnpm run left-shapes:st -- --episode EPISODE_DIRECTORY [--out NEW_JSON_FILE] [--prefix-locks N]\nHoles in columns 1–4 always count as other. Initial board is separate.\nWithout --out prints JSON; existing output files are never replaced.');return;}
 if(!o.episode)throw Error('--episode is required');
 const result=analyzeDirectory(path.resolve(o.episode),{out:o.out,prefixLocks:o['prefix-locks']===undefined?null:Number(o['prefix-locks'])});
 console.log(o.out?JSON.stringify({output:path.resolve(o.out),observations:result.observations,countsByShape:result.countsByShape,countsByTier:result.countsByTier},null,2):JSON.stringify(result,null,2));return result;
}
if(require.main===module){try{main();}catch(error){console.error(error.stack);process.exitCode=1;}}
module.exports={parse,analyzeDirectory,main};
