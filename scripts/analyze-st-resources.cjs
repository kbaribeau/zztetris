#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),{analyzeRecords}=require('./lib/st-resource-replay.cjs');
const args=process.argv.slice(2),known=args.includes('--observed-empty-start'),files=args.filter(a=>!a.startsWith('--'));
if(files.length!==1||args.some(a=>a.startsWith('--')&&a!=='--observed-empty-start')){
 console.error('Usage: node scripts/analyze-st-resources.cjs replay.jsonl [--observed-empty-start]');
 console.error('Use --observed-empty-start only for a recording known to begin at a new empty seven-bag game; imports remain unknown by default.');process.exitCode=2;
}else try{if(fs.statSync(files[0]).size>32*1024*1024)throw Error('Trace exceeds 32MiB limit');const records=fs.readFileSync(files[0],'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);process.stdout.write(JSON.stringify(analyzeRecords(records,{observedEmptyStart:known}),null,2)+'\n');}catch(error){console.error('Resource replay rejected: '+error.message);process.exitCode=1;}
