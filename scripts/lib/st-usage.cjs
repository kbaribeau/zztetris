'use strict';
// Decision-boundary evidence, not causal attribution of the search's scoring rules.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const SCHEMA=1,MAX_SIGNALS=256;
const safe=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(x)?x:null;
function classify(record){
 const a=record.advice||{},e=a.evidence||{},signals=[];
 const add=(category,id)=>{if(safe(id))signals.push({category,id});};
 if(e.opening)add('selected-family','opening');
 if(e.strategy)add('selected-family',e.strategy);
 if(e.construction?.kind)add('selected-family','construction:'+e.construction.kind);
 if(e.preparationProof?.kind)add('supporting-certificate','preparation:'+e.preparationProof.kind);
 if(e.opening?.repair)add('supporting-certificate','opening-repair-present');
 if(e.opening?.handoffCandidate)add('supporting-certificate','opening-handoff-candidate');
 if(e.openingHandoff?.status==='checked-after-actual-clear')add('supporting-certificate','actual-clear-handoff');
 if(e.commitmentRetained===true)add('supporting-certificate','commitment-retained');
 if(a.metrics?.repairRetained===true)add('supporting-certificate','opening-repair-retained');
 if(e.gapAccess){const state=e.gapAccess.reachable===true?'witnessed':e.gapAccess.reachable===false?'rejected':'unknown';add(state==='witnessed'?'supporting-certificate':'reported-access-result','gap-access:'+state);}
 for(const source of Array.isArray(a.sources)?a.sources:[])add('presentation-source',source?.id);
 return [...new Map(signals.map(s=>[s.category+':'+s.id,s])).values()];
}
function createCollector(provenance={}){
 const counts=new Map(),phases={},totals={decisions:0,followed:0,notFollowed:0,followedWithoutFamily:0},outcomes=Object.create(null),coverage={scoringContributions:'not-instrumented',internalRuleFirings:'not-instrumented',rejectedSearchBranches:'not-instrumented',heuristicEligibleOpportunities:'not-instrumented',denominator:'Recorded decisions in each phase, not per-rule eligibility.'};let overflow=0;
 function observe(r){if(!['lock','stop'].includes(r.kind))return;const followed=r.kind==='lock',phase=['opening','maintenance'].includes(r.advice?.phase)?r.advice.phase:r.request?.options?.openingPhase===true?'opening':r.request?'maintenance':'unknown',key=followed?'followed':'notFollowed';
  totals.decisions++;totals[key]++;const p=phases[phase]||(phases[phase]={decisions:0,followed:0,notFollowed:0});p.decisions++;p[key]++;
  const outcome=followed?'executed-lock':r.error?'recorded-error':safe(r.advice?.status)||'missing-advice';outcomes[outcome]=(outcomes[outcome]||0)+1;
  const signals=classify(r);if(followed&&!signals.some(s=>s.category==='selected-family'))totals.followedWithoutFamily++;
  for(const s of signals){const id=[phase,s.category,s.id].join('|');if(!counts.has(id)){if(counts.size>=MAX_SIGNALS){overflow++;continue;}counts.set(id,{phase,...s,followed:0,notFollowed:0});}counts.get(id)[key]++;}
 }
 function snapshot(){return{schemaVersion:SCHEMA,attribution:'reported-decision-evidence-only',provenance:JSON.parse(JSON.stringify(provenance)),totals:{...totals},phaseOpportunities:JSON.parse(JSON.stringify(phases)),outcomes:{...outcomes},signals:[...counts.values()].map(x=>({...x})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),overflowSignals:overflow,coverage:{...coverage},limitations:['A followed lock proves execution, not that a named heuristic caused its ranking.','Supporting evidence and displayed citations are not rule firings.','No appearance may mean missing instrumentation, rare eligibility, limited seeds, or prior filtering. Never prune code/tests from this report alone.','Partial traces remain partial; timed searches are not deterministic from seeds.']};}
 return{observe,snapshot};
}
async function analyzeDirectory(directory){
 directory=path.resolve(directory);let manifestPath=path.join(directory,'manifest.json'),episode=null;
 if(!fs.existsSync(manifestPath)){episode=directory;manifestPath=path.join(path.dirname(directory),'manifest.json');}
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8')),collector=createCollector({commit:manifest.commit,sources:manifest.sources,lane:manifest.lane,config:manifest.config,execution:manifest.execution,manifestComplete:manifest.complete});
 const dirs=episode?[episode]:fs.readdirSync(directory,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(directory,d.name)).filter(d=>fs.existsSync(path.join(d,'trace.jsonl')));
 if(!dirs.length)throw Error('No episode traces found');
 const episodes=[];
 for(const dir of dirs){let lines=0;const input=fs.createReadStream(path.join(dir,'trace.jsonl'),{encoding:'utf8'}),rl=readline.createInterface({input,crlfDelay:Infinity});for await(const line of rl){if(!line.trim())continue;if(Buffer.byteLength(line)>64*1024*1024)throw Error('Trace record exceeds64MiB');collector.observe(JSON.parse(line));lines++;}episodes.push({name:path.basename(dir),records:lines,summaryPresent:fs.existsSync(path.join(dir,'summary.json'))});}
 return{...collector.snapshot(),episodes};
}
module.exports={SCHEMA,classify,createCollector,analyzeDirectory};
if(require.main===module){if(process.argv.length!==3){console.error('Usage: node scripts/lib/st-usage.cjs RUN_OR_EPISODE_DIRECTORY > usage.json');process.exitCode=2;}else analyzeDirectory(process.argv[2]).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
