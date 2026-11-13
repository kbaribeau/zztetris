'use strict';
// This module is the executable v1 contract. It intentionally has no planner dependency.
const crypto=require('node:crypto');
const Outcomes=require('./st-outcome-metrics.cjs');
const R=require('../../st-rules'),B=require('../../st-bag');
const VERSION=1;
const HISTORICAL_REQUIRED_SOURCES=Object.freeze(['st-coach-config.js', 'st-rules.js', 'st-bag.js', 'st-structure.js', 'st-paired-repair.js', 'st-access.js', 'st-pattern-history.js', 'st-left-foundation.js', 'st-left-context.js', 'st-planner.js', 'st-opening-patterns.js','st-opening-continuations.js','st-opening-sources.js','st-source-scoring.js', 'st-opening.js', 'st-resource-history.js', 'st-midgame-resources.js', 'st-worker.js', 'st-lab.js', 'st-session.js', 'st-fixtures.js', 'scripts/lib/st-simulation.cjs', 'scripts/lib/st-left-shape-metrics.cjs', 'scripts/simulate-st.cjs']);
const REQUIRED_SOURCES=require('./st-source-files.cjs');
// The pre-route baseline has no route module to hash. Candidate and actual
// current source maps remain exact; never synthesize a nonexistent old file.
const PRE_ROUTE_REQUIRED_SOURCES=Object.freeze(REQUIRED_SOURCES.filter(file=>file!=='st-left-routes.js'));
const COACH_ENTRY_METRICS=Object.freeze({openingEntries:'opening',earlyMidgameEntries:'earlyMidgame',lateMidgameEntries:'lateMidgame',resetEntries:'reset',compatibilityEntries:'compatibility'});
const METRICS=Object.freeze([...Object.keys(COACH_ENTRY_METRICS),'openingHandoff','locks','lines','tsds','quads','nodes','peakHeight','budgetExhaustedSuccessfulLocks','topOut','plannerTimeout','wallCap','medianPlanMs','p95PlanMs','maxPlanMs']);
const STOPS=Object.freeze(['phase-cap','lock-cap','abstention','top-out','input-exhausted','wall-cap','invalid-recommendation','execution-error','policy-violation','planner-error','planner-timeout','runner-error','artifact-limit','source-changed']);
const BAD_STOPS=STOPS.filter(s=>!['phase-cap','lock-cap','abstention','top-out'].includes(s));
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const stringify=value=>JSON.stringify(canonical(value),null,2)+'\n';
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:stringify(value)).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
function check(ok,message){if(!ok)throw Error(message);}
function object(x,name){check(x&&typeof x==='object'&&!Array.isArray(x),name+' must be an object');}
function exact(x,keys,name){object(x,name);check(Object.keys(x).every(k=>keys.includes(k)),name+' contains unsupported fields');check(keys.every(k=>Object.hasOwn(x,k)),name+' missing fields');}
function text(x,name){check(typeof x==='string'&&x.length>0,name+' must be nonempty text');}
function finite(x,name){check(typeof x==='number'&&Number.isFinite(x),name+' must be finite');}
function integer(x,min,name){check(Number.isSafeInteger(x)&&x>=min,name+' must be an integer >= '+min);}
function sha(x,name){check(typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),name+' must be SHA-256');}
function sources(x,{legacy=false,current=false}={}){object(x,'sources');check(Object.keys(x).length>0,'sources must not be empty');if(!legacy)check(REQUIRED_SOURCES.every(k=>Object.hasOwn(x,k))||(!current&&PRE_ROUTE_REQUIRED_SOURCES.every(k=>Object.hasOwn(x,k)))||(!current&&HISTORICAL_REQUIRED_SOURCES.every(k=>Object.hasOwn(x,k))),'Missing required source hashes');for(const [k,v]of Object.entries(x)){text(k,'source path');sha(v,'source hash');}}
function equal(a,b,message){check(stringify(a)===stringify(b),message);}
function unique(items,key,name){const ids=items.map(key);check(new Set(ids).size===ids.length,'Duplicate '+name);}
function execution(x){exact(x,['config','locks','rng','lane','execution','episodeMs','node'],'execution');object(x.config,'config');check(Object.keys(x.config).every(k=>['depth','width','maxNodes','timeMs','usageTelemetry'].includes(k)),'Unsupported config');for(const k of ['depth','width','maxNodes','timeMs']){if(k==='depth'&&x.config[k]===null)continue;finite(x.config[k],k);check(x.config[k]>=0,k+' must be nonnegative');if(k!=='timeMs')integer(x.config[k],0,k);}if('usageTelemetry'in x.config)check(typeof x.config.usageTelemetry==='boolean','usageTelemetry must be boolean');integer(x.locks,1,'locks');integer(x.episodeMs,100,'episodeMs');text(x.node,'node');check(x.rng==='mulberry32-seven-bag-v1','Unsupported RNG');check(x.lane==='production-wall-clock','Unsupported lane');check(x.execution==='rapid-uninterrupted-actual-witness-v1','Unsupported execution');}
function input(x){object(x,'input');check(x.schemaVersion===1,'Unsupported input schema');check(['empty','stable'].includes(x.scenario),'Unsupported input scenario');integer(x.seed,0,'seed');check(x.seed<=4294967295,'Seed out of range');integer(x.locks,1,'input locks');object(x.initial,'input root');check(Array.isArray(x.initial.board)&&R.validate(x.initial).length===0&&B.validate(x.initial.bag).length===0,'Invalid input root/bag history');check(Array.isArray(x.future),'Missing private input stream');check(x.future.every(p=>typeof p==='string'&&'IJLOSTZ'.includes(p)&&p.length===1),'Invalid input stream');sha(x.inputHash,'legacy input hash');if(x.phaseCap!==undefined){exact(x.phaseCap,['openingLocks','postHandoffLocks'],'phase cap');integer(x.phaseCap.openingLocks,1,'opening locks');integer(x.phaseCap.postHandoffLocks,1,'post-handoff locks');check(x.scenario==='empty'&&x.locks===x.phaseCap.openingLocks+x.phaseCap.postHandoffLocks,'Invalid phase cap');}}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function validateProtocol(raw,{legacy=false}={}){
 const p=clone(raw);exact(p,['schemaVersion','kind','id','sources','execution','cohorts','correctness'],'protocol');check(p.schemaVersion===VERSION&&p.kind==='st-evaluation-protocol','Unsupported protocol schema');text(p.id,'protocol id');exact(p.sources,['baseline','candidate'],'protocol sources');sources(p.sources.baseline,{legacy});sources(p.sources.candidate,{legacy,current:true});execution(p.execution);
 check(Array.isArray(p.cohorts)&&p.cohorts.length>0,'Missing cohorts');unique(p.cohorts,c=>c.id,'cohort');const all=[];
 for(const c of p.cohorts){exact(c,['id','kind','pairs','criteria'],'cohort');text(c.id,'cohort id');check(['development','fresh-validation'].includes(c.kind),'Unsupported cohort kind');check(Array.isArray(c.pairs)&&c.pairs.length>0,'Missing pairs');unique(c.pairs,x=>x.id,'pair');
  for(const pair of c.pairs){exact(pair,['id','input','inputHash'],'pair');text(pair.id,'pair id');input(pair.input);sha(pair.inputHash,'pair inputHash');equal(hash(pair.input),pair.inputHash,'Protocol input hash mismatch');check(pair.input.locks===p.execution.locks&&pair.input.rng===p.execution.rng,'Input cap/RNG mismatch');all.push(pair);}
  check(Array.isArray(c.criteria)&&c.criteria.length>0,'Missing criteria for '+c.id);unique(c.criteria,x=>x.id,'criterion');
  for(const r of c.criteria){exact(r,['id','metric','aggregate','operator','threshold','uncertainty'],'criterion');text(r.id,'criterion id');check(METRICS.includes(r.metric),'Unsupported metric');check(r.aggregate==='mean-paired-delta','Unsupported aggregate');check(['at-least','at-most'].includes(r.operator),'Unsupported threshold operator');finite(r.threshold,'threshold');object(r.uncertainty,'uncertainty');
   if(r.uncertainty.method==='none')exact(r.uncertainty,['method'],'uncertainty');
   else{exact(r.uncertainty,['method','confidence','samples','seed','minPairs'],'uncertainty');check(r.uncertainty.method==='paired-bootstrap-percentile','Unsupported uncertainty rule');finite(r.uncertainty.confidence,'confidence');check(r.uncertainty.confidence>0&&r.uncertainty.confidence<1,'Invalid confidence');integer(r.uncertainty.samples,100,'samples');check(r.uncertainty.samples<=100000,'Too many bootstrap samples');integer(r.uncertainty.seed,0,'bootstrap seed');check(r.uncertainty.seed<=4294967295,'Bootstrap seed out of range');integer(r.uncertainty.minPairs,2,'minPairs');}
  }
 }
 unique(all,x=>x.id,'global pair id');unique(all,x=>x.inputHash,'input across cohorts');unique(all,x=>x.input.scenario+':'+x.input.seed,'scenario/seed across cohorts');
 check(Array.isArray(p.correctness)&&p.correctness.length>0,'Missing correctness requirements');unique(p.correctness,x=>x.id,'correctness requirement');
 for(const r of p.correctness){exact(r,['id','kind','side'],'correctness requirement');text(r.id,'receipt id');check(['test','replay','audit'].includes(r.kind),'Unsupported correctness kind');check(['baseline','candidate'].includes(r.side),'Unsupported correctness side');}
 return freeze(p);
}
const pairs=p=>p.cohorts.flatMap(c=>c.pairs.map(x=>({...x,cohort:c.id})));
const manifestExecution=m=>({config:m.config,locks:m.locks,rng:m.rng,lane:m.lane,execution:m.execution,episodeMs:m.episodeMs,node:m.node,...(m.lane==='diagnostic-wall-clock'?{parallel:m.parallel,decisionWatchdogMs:m.decisionWatchdogMs}:{})});
function bindProtocol(raw,side,actualSources,actualExecution,inputs){
 const p=validateProtocol(raw);check(['baseline','candidate'].includes(side),'Choose baseline or candidate');sources(actualSources,{current:side==='candidate'});equal(actualSources,p.sources[side],'Protocol source mismatch');equal(actualExecution,p.execution,'Protocol execution mismatch');
 const expected=pairs(p).map(x=>x.inputHash).sort(),actual=inputs.map(hash).sort();equal(actual,expected,'Protocol inputs missing, duplicated or mismatched');
 return freeze({schemaVersion:VERSION,kind:'st-protocol-binding',protocol:p,protocolHash:hash(p),side,sourceHash:hash(actualSources),inputHashes:actual,execution:clone(actualExecution),boundBeforePlanner:true});
}
function validateBoundEpisode(b,actualSources,actualExecution,i){
 check(b?.schemaVersion===VERSION&&b.kind==='st-protocol-binding'&&b.boundBeforePlanner===true,'Missing pre-execution binding');
 const p=validateProtocol(b.protocol);const all=pairs(p).map(x=>x.input);const expected=bindProtocol(p,b.side,actualSources,actualExecution,all);equal(b,expected,'Child protocol binding mismatch');check(all.some(x=>hash(x)===hash(i)),'Child input mismatch');return expected;
}
function measurement(raw,k){if(k==='openingHandoff')return Array.isArray(raw.coachTransitions)&&raw.coachTransitions[0]?.coach==='opening'?Number(raw.coachTransitions.some(t=>t.coach!=='opening')):null;if(k in COACH_ENTRY_METRICS){if(raw.coachEntries!=null)object(raw.coachEntries,'coachEntries');return raw.coachEntries?.[COACH_ENTRY_METRICS[k]]??null;}if(k==='budgetExhaustedSuccessfulLocks')return raw.budgetHits??null;const stops={topOut:'top-out',plannerTimeout:'planner-timeout',wallCap:'wall-cap'};if(k in stops)return raw.stop===stops[k]?1:0;const timing={medianPlanMs:'medianMs',p95PlanMs:'p95Ms',maxPlanMs:'maxMs'};return k in timing?(raw.timing?.[timing[k]]??null):(raw[k]??null);}
function counts(m,cap,stop){for(const [k,v]of Object.entries(m))if(v!==null&&v!==undefined&&!['medianPlanMs','p95PlanMs','maxPlanMs'].includes(k))integer(v,0,k);if(m.locks!==null&&m.locks!==undefined){check(m.locks<=cap,'Locks exceed cap');if(stop==='lock-cap')check(m.locks===cap,'Lock-cap count mismatch');}}
function validatePhaseStop(raw,i){
 equal(raw.phaseCap??null,i.phaseCap??null,'Phase cap metadata mismatch');
 if(raw.stop!=='phase-cap')return;
 check(Boolean(i.phaseCap),'Phase stop without phase cap');
 const handoff=raw.coachTransitions?.find(t=>t.coach!=='opening');
 const expected=handoff?handoff.afterLock+i.phaseCap.postHandoffLocks:i.phaseCap.openingLocks;
 check(raw.locks===expected,'Phase-cap count mismatch');
 equal(raw.detail,{reason:handoff?'post-handoff-lock-cap':'opening-lock-cap',handoffAfterLock:handoff?.afterLock??null,postHandoffLocks:i.phaseCap.postHandoffLocks,openingLocks:i.phaseCap.openingLocks},'Phase-cap detail mismatch');
}
function normalize(manifest,inputs,{legacy=false}={}){
 check(manifest.schemaVersion===1,'Unsupported simulation manifest schema');sources(manifest.sources,{legacy});check(Array.isArray(manifest.episodes)&&Array.isArray(inputs),'Missing episodes/inputs');unique(inputs,x=>x.scenario+':'+x.seed,'input');unique(manifest.episodes,x=>x.scenario+':'+x.seed,'episode');
 const byKey=new Map(inputs.map(i=>[i.scenario+':'+i.seed,i]));inputs.forEach(input);check(inputs.length===manifest.episodes.length,'Missing episode/input pairs');
 let binding=null;
 if(!legacy&&manifest.evaluationBinding){const b=manifest.evaluationBinding;check(b.kind==='st-protocol-binding'&&b.schemaVersion===VERSION&&b.boundBeforePlanner===true,'Invalid protocol binding');binding=bindProtocol(b.protocol,b.side,manifest.sources,manifestExecution(manifest),inputs);equal(b,binding,'Protocol binding mismatch');}
 const episodes=manifest.episodes.map(e=>{const i=byKey.get(e.scenario+':'+e.seed);check(i&&e.inputHash===i.inputHash,'Episode input mismatch');check(e.cap===i.locks,'Episode cap mismatch');check(STOPS.includes(e.stop),'Unsupported stop');check(typeof e.censored==='boolean','Missing censoring');check(e.censored===['phase-cap','lock-cap','wall-cap'].includes(e.stop),'Inconsistent censoring');
  const measurements=Object.fromEntries(METRICS.map(k=>[k,measurement(e,k)]));for(const [k,v]of Object.entries(measurements))if(v!==null){finite(v,k);check(v>=0,k+' must be nonnegative');}
  counts(measurements,i.locks,e.stop);validatePhaseStop(e,i);
  return{key:e.scenario+':'+e.seed,input:clone(i),inputHash:hash(i),rootHistory:{root:clone(i.initial),history:i.scenario==='empty'?'fresh-empty-generated-input':'stable-import-no-prior-action-history'},stop:e.stop,censored:e.censored,detail:e.detail??null,measurements,raw:clone(e),annotations:{phaseReset:'Coach entries count observed phase entries, not planner calls, completed resets or certified cycles. Imported roots do not reconstruct prior entries. Missing historical counts are unavailable. 85 lines after first reset remains a general goal, never an implicit acceptance gate.',budgetExhaustedSuccessfulLocks:'Legacy budgetHits: successful locks only; excludes terminal abstentions and mixes exhaustion causes. Not wall-clock timeouts.'}};
 });
 return{schemaVersion:VERSION,kind:'st-simulation-observations',provenance:{mode:binding?'predeclared':'retrospective',binding,sources:clone(manifest.sources),sourceHash:hash(manifest.sources),execution:manifestExecution(manifest),commit:manifest.commit??null,dirty:manifest.dirty??null,complete:manifest.complete===true,legacyAdapter:legacy,manifestHash:hash(manifest),trust:'Hashes establish byte identity, not authenticity, correctness or proof of when a protocol was authored. Predeclared means this runner bound it before planner execution.'},episodes};
}
function validateObservation(o){
 check(o?.schemaVersion===VERSION&&o.kind==='st-simulation-observations','Unsupported observations schema');object(o.provenance,'provenance');check(typeof o.provenance.complete==='boolean','Observation completion must be boolean');check(typeof o.provenance.legacyAdapter==='boolean','Observation adapter flag must be boolean');sources(o.provenance.sources,{legacy:o.provenance.legacyAdapter===true});equal(o.provenance.sourceHash,hash(o.provenance.sources),'Observation source hash mismatch');check(Array.isArray(o.episodes),'Missing observed episodes');unique(o.episodes,e=>e.key,'observed episode');
 for(const e of o.episodes){input(e.input);equal(e.inputHash,hash(e.input),'Observation input hash mismatch');equal(e.key,e.input.scenario+':'+e.input.seed,'Observation key mismatch');check(STOPS.includes(e.stop),'Unsupported observed stop');check(e.censored===['phase-cap','lock-cap','wall-cap'].includes(e.stop),'Inconsistent observed censoring');object(e.measurements,'measurements');object(e.raw,'raw summary');validatePhaseStop(e.raw,e.input);counts(e.measurements,e.input.locks,e.stop);equal(e.raw.inputHash,e.input.inputHash,'Raw input mismatch');equal(e.raw.scenario+':'+e.raw.seed,e.key,'Raw key mismatch');equal(e.raw.cap,e.input.locks,'Raw cap mismatch');equal(e.stop,e.raw.stop,'Raw stop mismatch');equal(e.censored,e.raw.censored,'Raw censoring mismatch');equal(e.detail,e.raw.detail??null,'Raw detail mismatch');equal(e.rootHistory,{root:e.input.initial,history:e.input.scenario==='empty'?'fresh-empty-generated-input':'stable-import-no-prior-action-history'},'Root/history mismatch');for(const k of METRICS)equal(e.measurements[k]??null,measurement(e.raw,k),'Raw measurement mismatch: '+k);for(const k of METRICS){const v=e.measurements[k];if(v!==null&&v!==undefined){finite(v,k);check(v>=0,k+' must be nonnegative');}}}
}
function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function criterion(rule,deltas){
 if(deltas.some(x=>x===null))return{id:rule.id,rule,status:'incomplete',reason:'Missing declared measurement',estimate:null,interval:null};
 const estimate=mean(deltas),u=rule.uncertainty;let interval=null;
 if(u.method!=='none'){
  if(deltas.length<u.minPairs)return{id:rule.id,rule,status:'incomplete',reason:'Insufficient independent pairs for declared uncertainty rule',estimate,interval};
  const rng=random(u.seed),samples=[];for(let n=0;n<u.samples;n++)samples.push(mean(deltas.map(()=>deltas[Math.floor(rng()*deltas.length)])));samples.sort((a,b)=>a-b);const tail=(1-u.confidence)/2;interval=[samples[Math.floor(tail*(samples.length-1))],samples[Math.ceil((1-tail)*(samples.length-1))]];
 }
 const tested=interval?(rule.operator==='at-least'?interval[0]:interval[1]):estimate;
 return{id:rule.id,rule,status:(rule.operator==='at-least'?tested>=rule.threshold:tested<=rule.threshold)?'pass':'fail',estimate,interval};
}
function correctness(p,receipts){
 check(Array.isArray(receipts),'Receipts must be an array');unique(receipts,r=>r.id,'correctness receipt');check(receipts.every(r=>p.correctness.some(q=>q.id===r.id)),'Undeclared correctness receipt');
 const checks=p.correctness.map(q=>{const r=receipts.find(x=>x.id===q.id);if(!r)return{...q,status:'incomplete',reason:'Missing source-bound receipt'};
  exact(r,['schemaVersion','kind','id','side','sources','complete','checks','defects','evidence'],'receipt');check(r.schemaVersion===1&&r.kind===q.kind&&r.side===q.side,'Receipt requirement mismatch');equal(r.sources,p.sources[q.side],'Correctness source mismatch');check(typeof r.complete==='boolean','Missing receipt completion');check(Array.isArray(r.checks)&&Array.isArray(r.defects),'Missing receipt checks/defects');check(r.checks.length>0,'Empty receipt checks');unique(r.checks,x=>x.id,'receipt check');
  for(const c of r.checks){exact(c,['id','status'],'receipt check');text(c.id,'check id');check(['pass','fail','unknown'].includes(c.status),'Unsupported check status');}
  for(const d of r.defects){exact(d,['id','classification','description'],'defect');text(d.id,'defect id');text(d.description,'defect description');check(['new','pre-existing','unknown'].includes(d.classification),'Unsupported defect classification');}
  exact(r.evidence,['sha256','contents'],'receipt evidence');sha(r.evidence.sha256,'evidence hash');check(typeof r.evidence.contents==='string','Missing evidence bytes');equal(hash(r.evidence.contents),r.evidence.sha256,'Correctness evidence hash mismatch');
  let status='pass';if(r.checks.some(c=>c.status==='fail')||r.defects.some(d=>d.classification==='new'))status='fail';else if(!r.complete||r.checks.some(c=>c.status==='unknown')||r.defects.length)status='incomplete';
  return{...q,status,complete:r.complete,checks:r.checks,defects:r.defects,evidenceHash:r.evidence.sha256};
 });return{status:checks.some(c=>c.status==='fail')?'fail':checks.every(c=>c.status==='pass')?'pass':'incomplete',checks,limitations:'Imported test/replay/audit claims and supplied evidence bytes are source-bound, not authenticated. Simulation completion is not correctness evidence; pre-existing/unknown defects remain visible and prevent an unqualified correctness pass.'};
}
// Descriptive distributions never add acceptance gates or drop unavailable runs.
function coachEntryDistributions(observed){
 return Object.fromEntries(Object.keys(COACH_ENTRY_METRICS).map(metric=>[metric,Object.fromEntries(['baseline','candidate'].map(side=>{
  const values=observed.map(x=>x[side].measurements[metric]).filter(v=>typeof v==='number');
  const histogram=[...new Set(values)].sort((a,b)=>a-b).map(entries=>({entries,runs:values.filter(v=>v===entries).length}));
  return[side,{observed:values.length,unavailable:observed.length-values.length,histogram}];
 }))]));
}
function coachEntryReport(episodes){
 const value=v=>v??'unavailable';
 return ['Coach entries count observed phase entries, not planning calls or completed resets. Imported starts exclude unobserved prior history.',
  '| Run | Current coach | History scope | Opening | Early midgame | Late midgame | Reset | Compatibility |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ...episodes.map(e=>`| ${e.label} | ${value(e.currentCoach)} | ${value(e.coachHistoryScope)} | ${Object.keys(COACH_ENTRY_METRICS).map(k=>value(e.measurements[k])).join(' | ')} |`)];
}
function evaluate(raw,baseline,candidate,receipts=[],exploration=[]){
 validateObservation(baseline);validateObservation(candidate);const p=validateProtocol(raw,{legacy:baseline.provenance.legacyAdapter===true&&candidate.provenance.legacyAdapter===true});const inputs=pairs(p);const expected=inputs.map(x=>x.inputHash).sort();let prospective=true;
 for(const [side,o]of [['baseline',baseline],['candidate',candidate]]){
  equal(o.provenance.sources,p.sources[side],'Evaluation source mismatch');equal(o.provenance.execution,p.execution,'Evaluation execution mismatch');equal(o.episodes.map(e=>e.inputHash).sort(),expected,'Missing, duplicate or mismatched evaluation pairs');
  if(o.provenance.mode==='predeclared'){
   check(!o.provenance.legacyAdapter,'Legacy artifacts cannot claim predeclared');const b=bindProtocol(p,side,o.provenance.sources,o.provenance.execution,o.episodes.map(e=>e.input));equal(o.provenance.binding,b,'Evaluation protocol binding mismatch');
  }else{check(o.provenance.mode==='retrospective'&&o.provenance.binding===null,'Invalid retrospective provenance');prospective=false;}
 }
 const cohorts=p.cohorts.map(c=>{
  const observed=c.pairs.map(pair=>({id:pair.id,baseline:baseline.episodes.find(e=>e.inputHash===pair.inputHash),candidate:candidate.episodes.find(e=>e.inputHash===pair.inputHash)}));
  const invalid=observed.filter(x=>BAD_STOPS.includes(x.baseline.stop)||BAD_STOPS.includes(x.candidate.stop));
  const criteria=c.criteria.map(r=>{const deltas=observed.map(x=>{const a=x.baseline.measurements[r.metric],b=x.candidate.measurements[r.metric];return typeof a==='number'&&typeof b==='number'?b-a:null;});const result=criterion(r,deltas);for(const side of ['baseline','candidate']){const values=observed.map(x=>x[side].measurements[r.metric]);result[side+'Mean']=values.every(v=>typeof v==='number')?mean(values):null;}return result;});
  let status=criteria.some(x=>x.status==='fail')?'fail':criteria.every(x=>x.status==='pass')?'pass':'incomplete';if(invalid.length||baseline.provenance.complete!==true||candidate.provenance.complete!==true)status='incomplete';
  return{id:c.id,kind:c.kind,status,criteria,coachEntryDistributions:coachEntryDistributions(observed),pairs:observed.map(x=>({id:x.id,inputHash:x.baseline.inputHash,baseline:{stop:x.baseline.stop,terminalOutcome:Outcomes.terminal(x.baseline.raw),detail:x.baseline.detail??null,outcomes:x.baseline.raw.outcomes??null,censored:x.baseline.censored,currentCoach:x.baseline.raw.currentCoach??null,coachHistoryScope:x.baseline.raw.coachHistoryScope??null,measurements:x.baseline.measurements},candidate:{stop:x.candidate.stop,terminalOutcome:Outcomes.terminal(x.candidate.raw),detail:x.candidate.detail??null,outcomes:x.candidate.raw.outcomes??null,censored:x.candidate.censored,currentCoach:x.candidate.raw.currentCoach??null,coachHistoryScope:x.candidate.raw.coachHistoryScope??null,measurements:x.candidate.measurements}})),invalidPairs:invalid.map(x=>x.id)};
 });
 let regressionStatus=cohorts.some(c=>c.status==='fail')?'fail':cohorts.every(c=>c.status==='pass')?'pass':'incomplete';if(regressionStatus==='pass'&&!prospective)regressionStatus='incomplete';
 const correct=correctness(p,receipts);
 const violations=[];for(const [side,o]of [['baseline',baseline],['candidate',candidate]])for(const e of o.episodes)if(['policy-violation','invalid-recommendation'].includes(e.stop))violations.push({side,inputHash:e.inputHash,stop:e.stop,classification:side==='baseline'?'pre-existing':'unknown',detail:e.detail});
 correct.observedSimulationViolations=violations;if(violations.length)correct.status='fail';
 const status=correct.status==='fail'||regressionStatus==='fail'?'fail':correct.status==='pass'&&regressionStatus==='pass'?'pass':'incomplete';
 return canonical({schemaVersion:VERSION,kind:'st-evaluation-result',protocolHash:hash(p),protocol:p,status,correctness:correct,regression:{status:regressionStatus,prospective,cohorts,limitations:['Aggregate declared criteria govern; one poor run does not independently veto acceptance.','Lock caps are right-censored restricted observations. Wall caps, incomplete evidence and infrastructure/safety stops invalidate aggregate acceptance.','Seed pairs are sampling units; locks are correlated. Bootstrap does not establish generalization or remove wall-clock variation.','Fresh-validation is the declared cohort designation, not verified proof that its inputs were previously unseen.','Retrospective evidence cannot establish a predeclared acceptance pass.']},exploration:clone(exploration),provenance:{baseline:baseline.provenance,candidate:candidate.provenance},annotations:{resetGoal:'85 lines is a general post-first-reset goal, not an acceptance threshold. Phase/reset interpretations are annotations; raw counts are retained.'}});
}
function render(result){
 check(result?.kind==='st-evaluation-result'&&result.schemaVersion===VERSION,'Unsupported evaluation result');
 const lines=['# ST evaluation',`Outcome: **${result.status}**`, `Protocol SHA-256: \`${result.protocolHash}\``, '', '## Correctness',`Status: **${result.correctness.status}**`,...result.correctness.checks.map(c=>`- ${c.id} (${c.kind}, ${c.side}): ${c.status}${c.reason?'; '+c.reason:''}`),result.correctness.limitations,...(result.correctness.observedSimulationViolations||[]).map(v=>`- Observed ${v.side} ${v.stop}: ${v.classification} defect; ${v.inputHash}.`),'','## Aggregate simulation regression',`Status: **${result.regression.status}**; ${result.regression.prospective?'bound before planner calls':'retrospective evidence'}.`];
 for(const c of result.regression.cohorts){lines.push('',`### ${c.id} (${c.kind}): ${c.status}`);for(const r of c.criteria)lines.push(`- ${r.id}: ${r.status}; ${r.rule.metric}: baseline mean ${r.baselineMean??'missing'}, candidate mean ${r.candidateMean??'missing'}, mean paired delta ${r.estimate??'missing'}; interval ${r.interval?JSON.stringify(r.interval):'none'}; ${r.rule.operator} ${r.rule.threshold}${r.reason?'; '+r.reason:''}.`);lines.push('','| Pair | Baseline stop | Candidate stop | Baseline locks | Candidate locks |','| --- | --- | --- | ---: | ---: |',...c.pairs.map(p=>`| ${p.id} | ${p.baseline.terminalOutcome??p.baseline.stop} | ${p.candidate.terminalOutcome??p.candidate.stop} | ${p.baseline.measurements.locks??'missing'} | ${p.candidate.measurements.locks??'missing'} |`));for(const metric of [...new Set(c.criteria.map(r=>r.rule.metric))])lines.push('',`| Pair | Baseline ${metric} | Candidate ${metric} |`,`| --- | ---: | ---: |`,...c.pairs.map(p=>`| ${p.id} | ${p.baseline.measurements[metric]??'missing'} | ${p.candidate.measurements[metric]??'missing'} |`));for(const side of ['baseline','candidate'])lines.push('',`#### ${side} search outcomes`,...Outcomes.report(c.pairs.map(p=>p[side])).map(line=>line.startsWith('## ')?'##### '+line.slice(3):line));lines.push('','#### Observed coach entries',...coachEntryReport(c.pairs.flatMap(p=>['baseline','candidate'].map(side=>({label:p.id+' '+side,...p[side]})))));if(c.coachEntryDistributions)for(const [metric,sides]of Object.entries(c.coachEntryDistributions))for(const [side,d]of Object.entries(sides))lines.push(`- ${metric}, ${side}: ${d.histogram.map(h=>h.entries+' entries: '+h.runs+' runs').join('; ')||'no observed counts'}; unavailable: ${d.unavailable} runs.`);if(c.invalidPairs.length)lines.push('Invalid aggregate pairs: '+c.invalidPairs.join(', '));}
 lines.push('',...result.regression.limitations.map(x=>'- '+x),'','## Exploratory findings','Excluded from every aggregate acceptance calculation.','```json',stringify(result.exploration).trimEnd(),'```','',result.annotations.resetGoal,'','Hashes bind bytes; they do not establish trustworthy provenance.');return lines.join('\n')+'\n';
}
module.exports={VERSION,COACH_ENTRY_METRICS,coachEntryReport,REQUIRED_SOURCES,validateBoundEpisode,METRICS,STOPS,canonical,stringify,hash,validateProtocol,bindProtocol,normalize,validateObservation,evaluate,render,manifestExecution,pairs};
