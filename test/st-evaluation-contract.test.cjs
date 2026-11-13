'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const V=require('../scripts/lib/st-evaluation.cjs'),E=require('../scripts/lib/st-simulation.cjs'),CLI=require('../scripts/evaluate-st-protocol.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture({count=2}={}){
 const sources=E.sourceHashes(),inputs=Array.from({length:count},(_,i)=>E.makeInput('empty',i+1,2));
 const execution={config:E.CONFIG,locks:2,rng:E.RNG_VERSION,lane:'production-wall-clock',execution:'rapid-uninterrupted-actual-witness-v1',episodeMs:11500,node:process.version};
 const p={schemaVersion:1,kind:'st-evaluation-protocol',id:'synthetic-contract-test-not-strategy-evidence',sources:{baseline:sources,candidate:sources},execution,cohorts:[{id:'development',kind:'development',pairs:inputs.map((input,i)=>({id:'pair-'+i,input,inputHash:V.hash(input)})),criteria:[{id:'locks',metric:'locks',aggregate:'mean-paired-delta',operator:'at-least',threshold:0,uncertainty:{method:'none'}}]}],correctness:[{id:'synthetic-audit',kind:'audit',side:'candidate'}]};
 const manifest=side=>({schemaVersion:1,...execution,sources,complete:true,evaluationBinding:V.bindProtocol(p,side,sources,execution,inputs),episodes:inputs.map(i=>({scenario:i.scenario,seed:i.seed,inputHash:i.inputHash,cap:i.locks,stop:'lock-cap',censored:true,locks:2,lines:0,tsds:0,quads:0,nodes:0,peakHeight:0,budgetHits:0}))});
 const receipt={schemaVersion:1,kind:'audit',id:'synthetic-audit',side:'candidate',sources,complete:true,checks:[{id:'synthetic-contract',status:'pass'}],defects:[],evidence:{sha256:V.hash('synthetic fixture only'),contents:'synthetic fixture only'}};
 const a=manifest('baseline'),b=manifest('candidate');return{p,inputs,a,b,receipt,normalized:()=>[V.normalize(a,inputs),V.normalize(b,inputs)]};
}
test('evaluation/validated protocol is deeply frozen and rejects unspecified rules',()=>{
 const f=fixture(),p=V.validateProtocol(f.p);assert.ok(Object.isFrozen(p.cohorts[0].criteria[0]));
 for(const change of [p=>p.execution.config.width=null,p=>p.execution.config.maxNodes=null,p=>p.execution.config.timeMs=null,p=>delete p.execution.config.depth,p=>p.cohorts[0].criteria=[],p=>delete p.cohorts[0].criteria[0].threshold,p=>p.cohorts[0].criteria[0].metric='madeUp',p=>p.cohorts[0].criteria[0].uncertainty={method:'normal-theory'},p=>p.sources.baseline={},p=>p.execution.config.fakeBudget=3,p=>p.execution.config.depth=.5,p=>p.cohorts[0].criteria[0].uncertainty={method:'paired-bootstrap-percentile',confidence:'0.95',samples:100,seed:1,minPairs:2}]){const p=clone(f.p);change(p);assert.throws(()=>V.validateProtocol(p));}
});
test('evaluation/public-piece depth and historical bounded depths remain distinct explicit configurations',()=>{
 const f=fixture();assert.equal(V.validateProtocol(f.p).execution.config.depth,null);
 const historical=clone(f.p);historical.execution.config.depth=3;assert.equal(V.validateProtocol(historical).execution.config.depth,3);
 assert.throws(()=>V.bindProtocol(f.p,'baseline',f.p.sources.baseline,historical.execution,f.inputs),/execution/);
});
test('evaluation/exploration cannot affect regression or correctness and rendering is byte-identical',()=>{
 const f=fixture(),o=f.normalized();const a=V.evaluate(f.p,...o,[f.receipt],[]),b=V.evaluate(f.p,...o,[f.receipt],[{finding:'awful losing run',lines:-999,status:'fail'}]);
 assert.equal(a.status,'pass');assert.deepEqual(a.regression,b.regression);assert.deepEqual(a.correctness,b.correctness);
 assert.equal(V.stringify(a),V.stringify(V.evaluate(f.p,...o,[f.receipt],[])));assert.equal(V.render(a),V.render(V.evaluate(f.p,...o,[f.receipt],[])));
});
test('evaluation/individual losses are governed by aggregate declared criteria',()=>{
 const f=fixture();f.a.episodes[0].locks=2;f.b.episodes[0].locks=1;f.a.episodes[1].locks=1;f.b.episodes[1].locks=2;f.b.episodes[0].stop='abstention';f.b.episodes[0].censored=false;f.a.episodes[1].stop='abstention';f.a.episodes[1].censored=false;
 const r=V.evaluate(f.p,...f.normalized(),[f.receipt]);assert.equal(r.regression.status,'pass');assert.equal(r.regression.cohorts[0].criteria[0].estimate,0);
});
test('evaluation/missing measurements, incomplete runs and missing correctness never silently pass',()=>{
 const f=fixture();assert.equal(V.evaluate(f.p,...f.normalized()).correctness.status,'incomplete');
 delete f.b.episodes[0].locks;assert.equal(V.evaluate(f.p,...f.normalized(),[f.receipt]).status,'incomplete');
 f.b.episodes[0].locks=2;f.b.complete=false;assert.equal(V.evaluate(f.p,...f.normalized(),[f.receipt]).regression.status,'incomplete');
});
test('evaluation/source input execution and duplicate pair mismatches are rejected before binding',()=>{
 const f=fixture();const s={...f.p.sources.baseline,'st-planner.js':'0'.repeat(64)};
 assert.throws(()=>V.bindProtocol(f.p,'baseline',s,f.p.execution,f.inputs),/source mismatch/);
 const inputs=clone(f.inputs);inputs[0].initial.topOut=true;assert.throws(()=>V.bindProtocol(f.p,'baseline',f.p.sources.baseline,f.p.execution,inputs),/inputs/);
 assert.throws(()=>V.bindProtocol(f.p,'baseline',f.p.sources.baseline,{...f.p.execution,locks:99},f.inputs),/execution/);
 assert.throws(()=>V.bindProtocol(f.p,'baseline',f.p.sources.baseline,f.p.execution,[f.inputs[0],f.inputs[0]]),/inputs/);
 const b=clone(f.b);b.episodes[1]=b.episodes[0];assert.throws(()=>V.normalize(b,f.inputs),/Duplicate/);
 const o=f.normalized();o[1].provenance.sources['st-planner.js']='0'.repeat(64);assert.throws(()=>V.evaluate(f.p,...o,[f.receipt]),/source hash mismatch/);
});
test('evaluation/shared-state dependency changes cannot escape frozen source binding',()=>{
 const f=fixture();
 for(const file of ['st-public-inventory.js','st-center-obligations.js','st-obligation-admission.js','st-resource-search.js','st-obligation-context.js','st-obligation-state.js','st-sl-obligations.js','st-opening-obligations.js','st-obligation-projection.js','st-obligation-route.js','st-obligation-assessment.js','st-obligation-resources.js','st-opening-eligibility.js','st-resource-provider.js','st-obligation-tracking.js','st-plan-continuity.js','st-handoff-continuity.js','st-obligation-inverse.js','st-left-obligations.js','st-left-plan.js']){
  assert.match(f.p.sources.candidate[file],/^[a-f0-9]{64}$/,file+' must be included in new simulation manifests');
  const changed={...f.p.sources.candidate,[file]:'0'.repeat(64)};
  assert.throws(()=>V.bindProtocol(f.p,'candidate',changed,f.p.execution,f.inputs),/source mismatch/);
  const omitted={...f.p.sources.candidate};delete omitted[file];
  assert.throws(()=>V.bindProtocol(f.p,'candidate',omitted,f.p.execution,f.inputs),/source mismatch|required source hashes/);
 }
});
test('evaluation/pre-extraction and new source closures remain prospective without weakening exact candidate binding',()=>{
 const f=fixture(),current=E.sourceHashes(),prior={...current,'st-resource-history.js':'1'.repeat(64),'st-midgame-resources.js':'2'.repeat(64)};delete prior['st-resource-search.js'];
 // Synthetic contract-only maps: the old runtime did not contain the new
 // search module. Do not invent its hash or force that side into legacy mode.
 f.p.sources={baseline:prior,candidate:current};f.receipt.sources=current;
 assert.equal(current['st-resource-search.js'],E.digest(fs.readFileSync(require.resolve('../st-resource-search.js'),'utf8')));
 assert.doesNotThrow(()=>V.validateProtocol(f.p));
 for(const [side,m]of [['baseline',f.a],['candidate',f.b]]){m.sources=f.p.sources[side];m.evaluationBinding=V.bindProtocol(f.p,side,m.sources,f.p.execution,f.inputs);}
 const observations=f.normalized(),result=V.evaluate(f.p,...observations,[f.receipt]);
 assert.equal(result.status,'pass');assert.equal(result.regression.prospective,true);
 assert.ok(observations.every(o=>o.provenance.mode==='predeclared'&&!o.provenance.legacyAdapter));
 assert.equal('st-resource-search.js'in observations[0].provenance.sources,false);
 const omitted=clone(f.p);delete omitted.sources.candidate['st-resource-search.js'];
 assert.throws(()=>V.validateProtocol(omitted),/Missing required source hashes/);
 assert.throws(()=>V.bindProtocol(omitted,'candidate',current,f.p.execution,f.inputs),/Missing required source hashes/);
 assert.throws(()=>V.bindProtocol(omitted,'candidate',omitted.sources.candidate,f.p.execution,f.inputs),/Missing required source hashes/);
 assert.equal('st-resource-history.js' in current,false);assert.equal('st-midgame-resources.js' in current,false);

});
test('evaluation/pre-route baseline omits only its nonexistent module while candidate stays exact',()=>{
 const f=fixture(),prior={...f.p.sources.baseline};delete prior['st-left-routes.js'];f.p.sources.baseline=prior;
 assert.doesNotThrow(()=>V.validateProtocol(f.p));
 const baseline=V.bindProtocol(f.p,'baseline',prior,f.p.execution,f.inputs);
 assert.doesNotThrow(()=>V.validateBoundEpisode(baseline,prior,f.p.execution,f.inputs[0]));
 const missingCore=clone(f.p);delete missingCore.sources.baseline['st-planner.js'];assert.throws(()=>V.validateProtocol(missingCore),/required source hashes/);
 const missingCandidate=clone(f.p);delete missingCandidate.sources.candidate['st-left-routes.js'];assert.throws(()=>V.validateProtocol(missingCandidate),/required source hashes/);
 const changed={...f.p.sources.candidate,'st-left-routes.js':'0'.repeat(64)};assert.throws(()=>V.bindProtocol(f.p,'candidate',changed,f.p.execution,f.inputs),/source mismatch/);
 assert.throws(()=>V.bindProtocol(f.p,'baseline',f.p.sources.candidate,f.p.execution,f.inputs),/source mismatch/);
});
test('evaluation/child validates exact binding before planner execution',()=>{
 const f=fixture();assert.doesNotThrow(()=>V.validateBoundEpisode(f.a.evaluationBinding,f.a.sources,f.p.execution,f.inputs[0]));
 const changed=clone(f.inputs[0]);changed.future[0]=changed.future[0]==='I'?'J':'I';assert.throws(()=>V.validateBoundEpisode(f.a.evaluationBinding,f.a.sources,f.p.execution,changed),/input mismatch/);
 const b=clone(f.a.evaluationBinding);b.boundBeforePlanner=false;assert.throws(()=>V.validateBoundEpisode(b,f.a.sources,f.p.execution,f.inputs[0]),/pre-execution/);
});
test('evaluation/legacy and unbound evidence stays retrospective despite a later matching protocol',()=>{
 const f=fixture(),a=V.normalize(f.a,f.inputs,{legacy:true}),b=V.normalize(f.b,f.inputs,{legacy:true});
 assert.equal(a.provenance.mode,'retrospective');assert.equal(a.provenance.binding,null);const r=V.evaluate(f.p,a,b,[f.receipt]);assert.equal(r.regression.status,'incomplete');assert.equal(r.regression.cohorts[0].status,'pass');
 a.provenance.mode='predeclared';a.provenance.binding=f.a.evaluationBinding;assert.throws(()=>V.evaluate(f.p,a,b,[f.receipt]),/Legacy/);
});
test('evaluation/correctness is independent and retains new pre-existing unknown defects',()=>{
 const f=fixture(),o=f.normalized();for(const classification of ['new','pre-existing','unknown']){const receipt=clone(f.receipt);receipt.defects=[{id:'defect',classification,description:'retained evidence'}];const r=V.evaluate(f.p,...o,[receipt]);assert.equal(r.regression.status,'pass');assert.equal(r.correctness.status,classification==='new'?'fail':'incomplete');assert.equal(r.correctness.checks[0].defects[0].classification,classification);}
 const receipt=clone(f.receipt);receipt.sources['st-rules.js']='0'.repeat(64);assert.throws(()=>V.evaluate(f.p,...o,[receipt]),/Correctness source/);
 receipt.sources=f.receipt.sources;receipt.evidence.contents='tampered';assert.throws(()=>V.evaluate(f.p,...o,[receipt]),/evidence hash/);
});
test('evaluation/multiple cohorts cannot hide missing criteria or missing pairs',()=>{
 const f=fixture();f.p.cohorts.push({id:'validation',kind:'fresh-validation',pairs:[f.p.cohorts[0].pairs.pop()],criteria:[]});assert.throws(()=>V.validateProtocol(f.p),/Missing criteria/);
 f.p.cohorts[1].criteria=clone(f.p.cohorts[0].criteria);assert.doesNotThrow(()=>V.validateProtocol(f.p));
 assert.throws(()=>V.evaluate(f.p,...f.normalized(),[f.receipt]),/binding mismatch/);
});
test('evaluation/wall censoring and safety stops remain invalid; bootstrap requires declared sample support',()=>{
 const f=fixture();f.b.episodes[0].stop='wall-cap';assert.equal(V.evaluate(f.p,...f.normalized(),[f.receipt]).regression.status,'incomplete');
 f.b.episodes[0].stop='policy-violation';f.b.episodes[0].censored=false;const violated=V.evaluate(f.p,...f.normalized(),[f.receipt]);assert.equal(violated.regression.status,'incomplete');assert.equal(violated.correctness.status,'fail');assert.equal(violated.correctness.observedSimulationViolations[0].classification,'unknown');
 f.p.cohorts[0].criteria[0].uncertainty={method:'paired-bootstrap-percentile',confidence:.95,samples:200,seed:123,minPairs:3};
 for(const [side,m]of [['baseline',f.a],['candidate',f.b]])m.evaluationBinding=V.bindProtocol(f.p,side,m.sources,f.p.execution,f.inputs);
 assert.equal(V.evaluate(f.p,...f.normalized(),[f.receipt]).regression.cohorts[0].criteria[0].status,'incomplete');
});
test('evaluation/real CLI no-search top-out fixture binds before child and supports saved-run adapter',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-evaluation-'));try{
  const f=fixture({count:1});f.inputs[0].initial.topOut=true;f.inputs[0].inputHash=E.digest({scenario:f.inputs[0].scenario,initial:require('../st-rules').createState(f.inputs[0].initial),future:f.inputs[0].future});f.p.cohorts[0].pairs[0].input=f.inputs[0];f.p.cohorts[0].pairs[0].inputHash=V.hash(f.inputs[0]);
  const protocol=path.join(dir,'protocol.json');fs.writeFileSync(protocol,V.stringify(f.p));
  const run=side=>{const out=path.join(dir,side);const child=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/simulate-st.cjs'),'--protocol',protocol,'--side',side,'--out',out,'--mino-ledger'],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);const runDir=path.join(out,fs.readdirSync(out)[0]);const observed=JSON.parse(fs.readFileSync(path.join(runDir,'observations.json')));assert.equal(observed.provenance.mode,'predeclared');assert.equal(observed.episodes[0].stop,'top-out');assert.equal(observed.episodes[0].measurements.nodes,0);return runDir;};
  const a=run('baseline'),b=run('candidate'),receiptPath=path.join(dir,'receipts.json');fs.writeFileSync(receiptPath,JSON.stringify([f.receipt]));
  const out=path.join(dir,'evaluation');const result=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/evaluate-st-protocol.cjs'),'--protocol',protocol,'--baseline',a,'--candidate',b,'--receipts',receiptPath,'--out',out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'evaluation.json'))).status,'pass');
  assert.equal(CLI.loadRun(a,{legacy:true}).provenance.mode,'retrospective');
  const legacy=JSON.parse(fs.readFileSync(path.join(a,'manifest.json')));delete legacy.evaluationBinding;delete legacy.sources['scripts/lib/st-evaluation.cjs'];delete legacy.sources['scripts/evaluate-st-protocol.cjs'];fs.writeFileSync(path.join(a,'manifest.json'),JSON.stringify(legacy));
  const adapted=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/evaluate-st-protocol.cjs'),'--adapt',a,'--out',path.join(dir,'adapted')],{encoding:'utf8'});assert.equal(adapted.status,0,adapted.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'adapted/observations.json'))).provenance.mode,'retrospective');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('evaluation/derived observations cannot contradict raw counts stops roots or censoring',()=>{
 const f=fixture();for(const change of [o=>o.episodes[0].measurements.locks=1,o=>o.episodes[0].stop='abstention',o=>o.episodes[0].rootHistory.root.topOut=true,o=>o.episodes[0].censored=false]){const o=f.normalized();change(o[1]);assert.throws(()=>V.evaluate(f.p,...o,[f.receipt]));}
 for(const change of [e=>e.locks=3,e=>e.locks=1,e=>e.nodes=-1,e=>e.lines=.5]){const f=fixture();change(f.b.episodes[0]);assert.throws(()=>f.normalized());}
});
test('evaluation/historical source maps report retrospectively without fabricated new source hashes',()=>{
 const f=fixture();for(const side of ['baseline','candidate']){delete f.p.sources[side]['scripts/lib/st-evaluation.cjs'];delete f.p.sources[side]['scripts/evaluate-st-protocol.cjs'];}
 for(const m of [f.a,f.b]){delete m.sources['scripts/lib/st-evaluation.cjs'];delete m.sources['scripts/evaluate-st-protocol.cjs'];delete m.evaluationBinding;}
 const o=[V.normalize(f.a,f.inputs,{legacy:true}),V.normalize(f.b,f.inputs,{legacy:true})];const r=V.evaluate(f.p,...o,[f.receipt]);assert.equal(r.regression.status,'incomplete');assert.equal(r.regression.cohorts[0].criteria[0].status,'pass');
});

test('evaluation/freeze and source CLI validate without granting predeclaration or overwriting',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-freeze-'));try{
  const f=fixture(),file=path.join(dir,'draft.json');fs.writeFileSync(file,V.stringify(f.p));
  const cli=(...args)=>spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/evaluate-st-protocol.cjs'),...args],{encoding:'utf8'});
  const out=path.join(dir,'frozen');assert.equal(cli('--freeze',file,'--out',out).status,0);
  const p=JSON.parse(fs.readFileSync(path.join(out,'protocol.json')));assert.deepEqual(p,f.p);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'freeze.json'))).protocolHash,V.hash(f.p));
  assert.equal(cli('--freeze',file,'--out',out).status,1);
  const sources=path.join(dir,'sources');assert.equal(cli('--sources','--out',sources).status,0);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(sources,'sources.json'))),E.sourceHashes());
  assert.equal(cli('--sources','--freeze',file,'--out',path.join(dir,'invalid')).status,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('evaluation/older source closure needs explicit adapter on both sides and never binds prospectively',()=>{
 const f=fixture(),old=Object.fromEntries(Object.entries(f.p.sources.baseline).slice(0,14));
 f.p.sources={baseline:old,candidate:old};f.receipt.sources=old;
 for(const m of [f.a,f.b]){m.sources=old;delete m.evaluationBinding;}
 assert.throws(()=>V.validateProtocol(f.p),/Missing required/);
 assert.throws(()=>V.bindProtocol(f.p,'baseline',old,f.p.execution,f.inputs),/Missing required/);
 const a=V.normalize(f.a,f.inputs,{legacy:true}),b=V.normalize(f.b,f.inputs,{legacy:true});
 assert.equal(V.evaluate(f.p,a,b,[f.receipt]).regression.status,'incomplete');
});

test('evaluation/declared timing and stop metrics retain semantics and appear in deterministic report',()=>{
 const f=fixture();f.p.cohorts[0].criteria=[{id:'latency',metric:'p95PlanMs',aggregate:'mean-paired-delta',operator:'at-most',threshold:0,uncertainty:{method:'none'}}];
 for(const [side,m]of [['baseline',f.a],['candidate',f.b]]){m.episodes.forEach(e=>e.timing={p95Ms:1.25,medianMs:.5,maxMs:1.5});m.evaluationBinding=V.bindProtocol(f.p,side,m.sources,f.p.execution,f.inputs);}
 const o=f.normalized(),r=V.evaluate(f.p,...o,[f.receipt]);assert.equal(r.regression.status,'pass');
 assert.equal(o[0].episodes[0].measurements.topOut,0);assert.equal(o[0].episodes[0].measurements.plannerTimeout,0);
 assert.equal(r.regression.cohorts[0].criteria[0].baselineMean,1.25);assert.match(V.render(r),/Baseline p95PlanMs/);
 delete f.b.episodes[0].timing;assert.equal(V.evaluate(f.p,...f.normalized(),[f.receipt]).regression.status,'incomplete');
});

test('evaluation/direct normalized files fail closed on nonboolean provenance flags',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-observation-'));try{
  for(const field of ['complete','legacyAdapter'])for(const value of ['false',1,null]){
   const f=fixture(),o=f.normalized();o[1].provenance[field]=value;
   assert.throws(()=>V.evaluate(f.p,...o,[f.receipt]),/boolean/);
   const file=path.join(dir,'observations.json');fs.writeFileSync(file,JSON.stringify(o[1]));assert.throws(()=>CLI.loadRun(file),/boolean/);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('evaluation/coach entries retain zero repeated entries and unavailable legacy evidence',()=>{
 const f=fixture();
 f.a.episodes[0].coachEntries={opening:1,earlyMidgame:1,lateMidgame:2,reset:3,compatibility:0};
 f.a.episodes[0].currentCoach='reset';f.a.episodes[0].coachHistoryScope='observed-from-import';
 f.b.episodes[0].coachEntries={opening:1,earlyMidgame:0,lateMidgame:0,reset:0,compatibility:0};f.b.episodes[0].currentCoach='opening';
 const o=f.normalized(),r=V.evaluate(f.p,...o,[f.receipt]);
 assert.equal(o[0].episodes[0].measurements.resetEntries,3);
 assert.equal(o[0].episodes[0].measurements.compatibilityEntries,0);
 assert.equal(o[0].episodes[1].measurements.resetEntries,null);
 assert.equal(r.status,'pass','Undeclared missing coach counters must not introduce a gate');
 const c=r.regression.cohorts[0];
 assert.deepEqual(c.coachEntryDistributions.resetEntries.baseline,{observed:1,unavailable:1,histogram:[{entries:3,runs:1}]});
 assert.deepEqual(c.coachEntryDistributions.resetEntries.candidate,{observed:1,unavailable:1,histogram:[{entries:0,runs:1}]});
 assert.equal(c.pairs[0].baseline.coachHistoryScope,'observed-from-import');
 const report=V.render(r);
 assert.match(report,/pair-0 baseline \| reset \| observed-from-import \| 1 \| 1 \| 2 \| 3 \| 0/);
 assert.match(report,/pair-0 candidate \| opening \| unavailable \| 1 \| 0 \| 0 \| 0 \| 0/);
 assert.match(report,/pair-1 baseline \| unavailable \| unavailable \| unavailable/);
 assert.match(report,/3 entries: 1 runs; unavailable: 1 runs/);
 assert.equal(report,V.render(V.evaluate(f.p,...f.normalized(),[f.receipt])));
});

test('evaluation/coach count distributions sort numerically and retain every run',()=>{
 const f=fixture({count:4});
 for(const m of [f.a,f.b])m.episodes.forEach((e,i)=>e.coachEntries={opening:1,earlyMidgame:[10,2,2,0][i],lateMidgame:0,reset:0,compatibility:0});
 const r=V.evaluate(f.p,...f.normalized(),[f.receipt]);
 assert.deepEqual(r.regression.cohorts[0].coachEntryDistributions.earlyMidgameEntries.candidate,{observed:4,unavailable:0,histogram:[{entries:0,runs:1},{entries:2,runs:2},{entries:10,runs:1}]});
});

test('evaluation/coach metrics can be declared but absent historical counters never pass as zero',()=>{
 const f=fixture();f.p.cohorts[0].criteria=[{id:'reset-entry-delta',metric:'resetEntries',aggregate:'mean-paired-delta',operator:'at-least',threshold:1,uncertainty:{method:'none'}}];
 for(const [side,m]of [['baseline',f.a],['candidate',f.b]]){m.episodes.forEach(e=>e.coachEntries={reset:side==='baseline'?1:2});m.evaluationBinding=V.bindProtocol(f.p,side,m.sources,f.p.execution,f.inputs);}
 let r=V.evaluate(f.p,...f.normalized(),[f.receipt]);assert.equal(r.status,'pass');assert.equal(r.regression.cohorts[0].criteria[0].estimate,1);
 delete f.b.episodes[0].coachEntries;
 r=V.evaluate(f.p,...f.normalized(),[f.receipt]);assert.equal(r.status,'incomplete');assert.equal(r.regression.cohorts[0].criteria[0].candidateMean,null);
 const old=V.normalize(f.b,f.inputs,{legacy:true});assert.equal(old.episodes[0].measurements.resetEntries,null);
});

test('evaluation/coach metrics reject invalid counts and contradictions with raw evidence',()=>{
 for(const value of [-1,.5,'1',Infinity]){const f=fixture();f.b.episodes[0].coachEntries={opening:value};assert.throws(()=>f.normalized());}
 for(const value of ['invalid',[]]){const f=fixture();f.b.episodes[0].coachEntries=value;assert.throws(()=>f.normalized(),/coachEntries must be an object/);}
 const f=fixture();f.b.episodes[0].coachEntries={opening:1};const o=f.normalized();o[1].episodes[0].measurements.openingEntries=2;assert.throws(()=>V.evaluate(f.p,...o,[f.receipt]),/Raw measurement mismatch/);
});
test('evaluation/canonical reports preserve terminal and decision budget distinctions',()=>{
 const O=require('../scripts/lib/st-outcome-metrics.cjs'),f=fixture();
 f.a.episodes[0].stop='abstention';f.a.episodes[0].censored=false;f.a.episodes[0].detail={status:'budget-exhausted'};
 f.b.episodes[0].stop='abstention';f.b.episodes[0].censored=false;
 const o=O.create();O.add(o,O.decision({target:{},evidence:{budgetExhausted:true}}));O.add(o,O.decision({evidence:{budgetExhausted:false}}));f.b.episodes[0].outcomes=o;
 const result=V.evaluate(f.p,...f.normalized(),[f.receipt]),pair=result.regression.cohorts[0].pairs[0],md=V.render(result);
 assert.equal(pair.baseline.terminalOutcome,'abstention/reported');assert.equal(pair.candidate.terminalOutcome,'abstention/not-reported');
 assert.equal(pair.candidate.outcomes.decisions,2);assert.match(md,/abstention\/not-reported/);assert.match(md,/recommendation: exhaustion reported 1/);assert.match(md,/0\/2 runs/);
});
