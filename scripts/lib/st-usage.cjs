'use strict';
// Decision-boundary evidence, not causal attribution of the search's scoring rules.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),{isDeepStrictEqual}=require('node:util');
const SCHEMA=2,MAX_SIGNALS=256;
const safe=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(x)?x:null;
function reportedFoundationCompletion(record){
 const step=record.advice?.continuation?.[0],stage=step?.foundationStage,event=record.event,board=record.request?.observation?.board;
 if(record.kind!=='lock'||!stage||!isDeepStrictEqual(event,step.event)||event?.lines!==0||event?.type==='T'||!Array.isArray(event?.cells))return false;
 if(!Number.isInteger(stage.level)||stage.level<1||stage.level>=20||!Array.isArray(stage.targets)||!stage.targets.length||stage.targets.length>4)return false;
 const keys=new Set();for(const cell of stage.targets){if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger))return false;const [x,y]=cell,key=x+','+y;if(x<4||x>6||y<0||y>39||keys.has(key)||board?.[y]?.[x]!=='.'||!event.cells.some(c=>Array.isArray(c)&&c[0]===x&&c[1]===y))return false;keys.add(key);}
 return true;
}
function classify(record){
 const a=record.advice||{},e=a.evidence||{},signals=[];
 const add=(category,id)=>{if(safe(id))signals.push({category,id});};
 if(e.opening)add('selected-family','opening');
 if(e.strategy)add('selected-family',e.strategy);
 if(record.kind==='lock'&&a.metrics?.earlyCapFallback?.selected===true)add('selected-family','early-cap-fallback');
 if(e.construction?.kind)add('selected-family','construction:'+e.construction.kind);
 if(e.preparationProof?.kind)add('supporting-certificate','preparation:'+e.preparationProof.kind);
 if(e.opening?.repair)add('supporting-certificate','opening-repair-present');
 if(e.opening?.handoffCandidate)add('supporting-certificate','opening-handoff-candidate');
 if(e.openingHandoff?.status==='checked-after-actual-clear')add('supporting-certificate','actual-clear-handoff');
 if(e.commitmentRetained===true)add('supporting-certificate','commitment-retained');
 if(a.metrics?.repairRetained===true)add('supporting-certificate','opening-repair-retained');
 if(a.metrics?.foundationStageSelected===true)add('supporting-certificate','foundation-stage-in-selected-path');
 if(record.request?.options?.openingRepair?.goal?.endpoint==='finite-foundation'){
  add('reported-goal','finite-foundation-provided');
  if(a.metrics?.repairRetained===true)add('supporting-certificate','finite-foundation-goal-retained');
 }
 if(reportedFoundationCompletion(record))add('executed-certificate','marked-foundation-completion');
 if(e.gapAccess){const state=e.gapAccess.reachable===true?'witnessed':e.gapAccess.reachable===false?'rejected':'unknown';add(state==='witnessed'?'supporting-certificate':'reported-access-result','gap-access:'+state);}
 for(const source of Array.isArray(a.sources)?a.sources:[])add('presentation-source',source?.id);
 return [...new Map(signals.map(s=>[s.category+':'+s.id,s])).values()];
}
function createSearchCollector(){
 const counters=new Map(),scores=new Map(),paths=new Map(),costs=new Map(),boundaryCosts=new Map(),scopes=new Set();
 const coverage={observedDecisions:0,missingDecisions:0,unsupportedSchemaDecisions:0,invalidNumericFields:0,overflowRows:0,selectedWithRank:0};
 const stats=()=>({observations:0,nonzero:0,sum:0,min:null,max:null});
 function addStat(s,value){s.observations++;s.nonzero+=Number(value!==0);s.sum+=value;s.min=s.min===null?value:Math.min(s.min,value);s.max=s.max===null?value:Math.max(s.max,value);}
 function row(map,key,make){if(!map.has(key)){if(map.size>=MAX_SIGNALS){coverage.overflowRows++;return null;}map.set(key,make());}return map.get(key);}
 function numeric(value,count=false){const ok=typeof value==='number'&&Number.isFinite(value)&&(!count||(Number.isSafeInteger(value)&&value>=0));if(!ok)coverage.invalidNumericFields++;return ok;}
 function counter(scope,phase,outcome,group,family,field,value){if(!safe(family)||!safe(field)||!numeric(value,true))return;const key=[scope,phase,group,family,field].join('|'),r=row(counters,key,()=>({scope,phase,group,family,field,followed:stats(),notFollowed:stats()}));if(r)addStat(r[outcome],value);}
 function observe(record,phase,followed){
  const u=record.advice?.metrics?.usage,outcome=followed?'followed':'notFollowed';
  if(!u){coverage.missingDecisions++;return;}
  if(u.schemaVersion!==1||!['opening','maintenance'].includes(u.scope)){coverage.unsupportedSchemaDecisions++;return;}
  coverage.observedDecisions++;const scope=u.scope;scopes.add(scope);
  if(u.families&&typeof u.families==='object')for(const [family,fields]of Object.entries(u.families)){if(!fields||typeof fields!=='object')continue;for(const [field,value]of Object.entries(fields))counter(scope,phase,outcome,'families',family,field,value);}
  if(u.access&&typeof u.access==='object')for(const [field,value]of Object.entries(u.access))counter(scope,phase,outcome,'access','access',field,value);
  if(u.rejections&&typeof u.rejections==='object')for(const [reason,value]of Object.entries(u.rejections))counter(scope,phase,outcome,'first-rejection',reason,'rejected',value);
  if(safe(u.selected?.path)){const key=scope+'|'+phase+'|'+u.selected.path,r=row(paths,key,()=>({scope,phase,path:u.selected.path,followed:0,notFollowed:0}));if(r)r[outcome]++;}
  if(Array.isArray(u.selected?.rank)&&u.selected.rank.length&&u.selected.rank.every(v=>typeof v==='number'&&Number.isFinite(v)))coverage.selectedWithRank++;
  if(u.selected?.scoreComponents&&typeof u.selected.scoreComponents==='object')for(const [component,value]of Object.entries(u.selected.scoreComponents)){if(!safe(component)||!numeric(value))continue;const key=scope+'|'+phase+'|'+component,r=row(scores,key,()=>({scope,phase,component,followed:stats(),notFollowed:stats()}));if(r)addStat(r[outcome],value);}
  if(u.costsMs&&typeof u.costsMs==='object')for(const [family,value]of Object.entries(u.costsMs)){if(!safe(family))continue;if(!numeric(value)||value<0){if(typeof value==='number'&&Number.isFinite(value)&&value<0)coverage.invalidNumericFields++;continue;}const key=[scope,phase,outcome,family].join('|'),r=row(boundaryCosts,key,()=>({scope,phase,outcome,family,unit:'ms',inclusive:true,...stats()}));if(r)addStat(r,value);}
  for(const field of ['nodes','elapsedMs']){const value=record.advice.metrics[field];if(value===undefined)continue;if(!numeric(value,field==='nodes')||value<0)continue;const key=[scope,phase,outcome,field].join('|'),r=row(costs,key,()=>({scope,phase,outcome,field,...stats()}));if(r)addStat(r,value);}
 }
 function snapshot(){const sorted=m=>[...m.values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return JSON.parse(JSON.stringify({engineSchemaVersion:1,scope:scopes.size===1?[...scopes][0]:scopes.size?'mixed':null,scopes:[...scopes].sort(),coverage,counters:sorted(counters),selectedPaths:sorted(paths),selectedScoreComponents:sorted(scores),decisionCosts:sorted(costs),familyBoundaryCosts:sorted(boundaryCosts),interpretation:['Scope and runtime phase are distinct: opening handoff instrumentation may appear in maintenance-phase advice.', 'Family boundary costs are opt-in inclusive timings; nested boundaries overlap and must not be summed or treated as causal costs.', 'Counter sums are evaluations; observations count decisions reporting that field, including explicit zero. Missing fields are not zero.','Rejections identify only the first failing short-circuit gate among examined steps, not every applicable violation.','Selected signed score terms describe the evaluated winner, not causal feature importance or ablation. Full lexicographic ranks remain in original traces.','nodes and elapsedMs are whole-decision reported costs for instrumented decisions, not per-rule timing or additive family costs.']}));}
 return{observe,snapshot,hasScores:()=>scores.size>0,hasCounters:()=>counters.size>0,hasRejections:()=>[...counters.values()].some(r=>r.group==='first-rejection')};
}

function createCollector(provenance={}){
 const counts=new Map(),phases={},totals={decisions:0,followed:0,notFollowed:0,followedWithoutFamily:0},outcomes=Object.create(null),coverage={scoringContributions:'not-instrumented',internalRuleFirings:'not-instrumented',rejectedSearchBranches:'not-instrumented',heuristicEligibleOpportunities:'not-instrumented',denominator:'Recorded decisions in each phase, not per-rule eligibility.'};const searchUsage=createSearchCollector();let overflow=0;
 function observe(r){if(!['lock','stop'].includes(r.kind))return;const followed=r.kind==='lock',phase=['opening','maintenance'].includes(r.advice?.phase)?r.advice.phase:r.request?.options?.openingPhase===true?'opening':r.request?'maintenance':'unknown',key=followed?'followed':'notFollowed';
  searchUsage.observe(r,phase,followed);totals.decisions++;totals[key]++;const p=phases[phase]||(phases[phase]={decisions:0,followed:0,notFollowed:0});p.decisions++;p[key]++;
  const outcome=followed?'executed-lock':r.error?'recorded-error':safe(r.advice?.status)||'missing-advice';outcomes[outcome]=(outcomes[outcome]||0)+1;
  const signals=classify(r);if(followed&&!signals.some(s=>s.category==='selected-family'))totals.followedWithoutFamily++;
  for(const s of signals){const id=[phase,s.category,s.id].join('|');if(!counts.has(id)){if(counts.size>=MAX_SIGNALS){overflow++;continue;}counts.set(id,{phase,...s,followed:0,notFollowed:0});}counts.get(id)[key]++;}
 }
 function snapshot(){return{schemaVersion:SCHEMA,attribution:'reported-decision-evidence-only',provenance:JSON.parse(JSON.stringify(provenance)),totals:{...totals},phaseOpportunities:JSON.parse(JSON.stringify(phases)),outcomes:{...outcomes},signals:[...counts.values()].map(x=>({...x})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),overflowSignals:overflow,coverage:{...coverage,scoringContributions:searchUsage.hasScores()?'selected-signed-components-only':coverage.scoringContributions,internalRuleFirings:searchUsage.hasCounters()?'partial-reported-search-counters':coverage.internalRuleFirings,rejectedSearchBranches:searchUsage.hasRejections()?'first-failing-gate-counts-only':coverage.rejectedSearchBranches},searchUsage:searchUsage.snapshot(),limitations:['A followed lock proves execution, not that a named heuristic caused its ranking.','Supporting evidence and displayed citations are not rule firings.','Foundation completion counts only a followed event matching the marked first step with well-formed targets; this is recorded evidence, not an independent geometry proof. Replacements that omit the marker are not counted even if the finite goal is paid.','No appearance may mean missing instrumentation, rare eligibility, limited seeds, or prior filtering. Never prune code/tests from this report alone.','Partial traces remain partial; timed searches are not deterministic from seeds.']};}
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
