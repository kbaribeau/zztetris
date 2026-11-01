#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const V=require('./lib/st-evaluation.cjs');
const read=file=>{if(fs.statSync(file).size>64*1024*1024)throw Error('Artifact exceeds 64 MiB');return JSON.parse(fs.readFileSync(file,'utf8'));};
function loadRun(directory,{legacy=false}={}){
 if(fs.statSync(directory).isFile()){if(legacy)throw Error('Legacy adapter requires original run directory');const o=read(directory);V.validateObservation(o);return o;}
 const manifest=read(path.join(directory,'manifest.json'));
 const inputs=manifest.episodes.map(e=>{if(!['empty','stable'].includes(e.scenario)||!Number.isSafeInteger(e.seed)||e.seed<0)throw Error('Invalid episode path');return read(path.join(directory,e.scenario+'-'+e.seed,'input.json'));});
 const rebuilt=V.normalize(manifest,inputs,{legacy});
 const normalized=path.join(directory,'observations.json');if(!legacy&&fs.existsSync(normalized)){const o=read(normalized);V.validateObservation(o);if(V.stringify(o)!==V.stringify(rebuilt))throw Error('Normalized observations disagree with original manifest/input artifacts');return o;}return rebuilt;
}
function receipts(file){if(!file)return[];const rows=read(file);if(!Array.isArray(rows))throw Error('Receipt index must be an array');return rows.map(r=>{const value={...r};if(value.evidence?.file){const p=path.resolve(path.dirname(file),value.evidence.file);if(fs.statSync(p).size>64*1024*1024)throw Error('Receipt evidence exceeds 64 MiB');value.evidence={sha256:value.evidence.sha256,contents:fs.readFileSync(p,'utf8')};}return value;});}
function main(args=process.argv.slice(2)){
 const o={};for(let i=0;i<args.length;i++){const key=args[i];if(key==='--help'){o.help=true;continue;}if(key==='--legacy'){o.legacy=true;continue;}if(key==='--sources'){o.sources=true;continue;}if(!['--protocol','--baseline','--candidate','--receipts','--exploration','--out','--adapt','--freeze'].includes(key))throw Error('Unknown option '+key);const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+key);o[key.slice(2)]=value;}
 if(o.help){console.log('ST evaluation v1\nSources: node scripts/evaluate-st-protocol.cjs --sources --out NEW_DIRECTORY\nValidate/freeze: node scripts/evaluate-st-protocol.cjs --freeze DRAFT_PROTOCOL --out NEW_DIRECTORY\nValidate/report: node scripts/evaluate-st-protocol.cjs --protocol protocol.json --baseline BASE_RUN --candidate CANDIDATE_RUN [--receipts receipts.json] [--exploration findings.json] --out NEW_DIRECTORY\nLegacy adapter: node scripts/evaluate-st-protocol.cjs --adapt OLD_RUN --out NEW_DIRECTORY\n--legacy on reporting explicitly adapts both saved runs as retrospective. No retrospective report can pass predeclared acceptance.\nThe executable protocol schema, supported rules and provenance semantics are documented in docs/st-evaluation-contract.md. No default acceptance thresholds.');return;}
 if(!o.out)throw Error('--out is required (new directory; never overwrites)');
 if(o.sources||o.freeze){
  const allowed=o.sources?['sources','out']:['freeze','out'];
  if(Object.keys(o).some(k=>!allowed.includes(k)))throw Error('Source snapshot and freeze are exclusive modes');
  const result=o.sources?require('./lib/st-simulation.cjs').sourceHashes():V.validateProtocol(read(o.freeze));
  fs.mkdirSync(o.out);fs.writeFileSync(path.join(o.out,o.sources?'sources.json':'protocol.json'),V.stringify(result),{flag:'wx'});
  if(o.freeze)fs.writeFileSync(path.join(o.out,'freeze.json'),V.stringify({schemaVersion:1,kind:'st-protocol-freeze',protocolHash:V.hash(result),provenance:'Validated snapshot only; predeclaration requires simulator binding before planner execution.'}),{flag:'wx'});
  console.log(JSON.stringify({out:path.resolve(o.out),status:o.sources?'source-snapshot':'validated-protocol',sha256:V.hash(result)}));return result;
 }
 let result;
 if(o.adapt){if(o.protocol||o.baseline||o.candidate||o.receipts||o.exploration)throw Error('--adapt cannot be combined with evaluation');result=loadRun(path.resolve(o.adapt),{legacy:true});}
 else{if(!o.protocol||!o.baseline||!o.candidate)throw Error('Protocol, baseline and candidate are required');result=V.evaluate(read(o.protocol),loadRun(path.resolve(o.baseline),{legacy:!!o.legacy}),loadRun(path.resolve(o.candidate),{legacy:!!o.legacy}),receipts(o.receipts),o.exploration?read(o.exploration):[]);}
 fs.mkdirSync(o.out);fs.writeFileSync(path.join(o.out,o.adapt?'observations.json':'evaluation.json'),V.stringify(result),{flag:'wx'});if(!o.adapt)fs.writeFileSync(path.join(o.out,'evaluation.md'),V.render(result),{flag:'wx'});console.log(JSON.stringify({out:path.resolve(o.out),status:result.status??'retrospective-adapter'}));if(!o.adapt&&result.status!=='pass')process.exitCode=2;return result;
}
if(require.main===module)try{main();}catch(error){console.error(error.stack);process.exitCode=1;}
module.exports={loadRun,receipts,main};
