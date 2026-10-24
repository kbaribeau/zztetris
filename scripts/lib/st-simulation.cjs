'use strict';
// Evaluation owns the stream; only public worker messages cross the policy boundary.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const R = require('../../st-rules');
const B = require('../../st-bag');
const P = require('../../st-planner');
const S = require('../../st-structure');
const F = require('../../st-fixtures');
const root = path.resolve(__dirname, '../..');
const clone = x => JSON.parse(JSON.stringify(x));
// P.observe normalizes through createState, which adds lastEvent:null; the page
// intentionally omits that field from its worker message. Match that boundary.
function publicObservation(state){const observation=P.observe(state);delete observation.lastEvent;return observation;}
const digest = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const SOURCE_FILES = ['st-rules.js', 'st-bag.js', 'st-structure.js', 'st-paired-repair.js', 'st-access.js', 'st-pattern-history.js', 'st-left-foundation.js', 'st-planner.js', 'st-opening.js', 'st-worker.js', 'st-lab.js', 'st-fixtures.js', 'scripts/lib/st-simulation.cjs', 'scripts/simulate-st.cjs'];
const CONFIG = Object.freeze({depth:3, width:8, maxNodes:45000, timeMs:750});
const PRESETS = Object.freeze({quick:{seeds:[10331, 20333], locks:24}, research:{seeds:Array.from({length:16}, (_,i) => 810001 + i * 997), locks:500}});
const RNG_VERSION = 'mulberry32-seven-bag-v1';
function random(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function sourceHashes() { return Object.fromEntries(SOURCE_FILES.filter(f => fs.existsSync(path.join(root,f))).map(f => [f,digest(fs.readFileSync(path.join(root,f),'utf8'))])); }
function makeInput(scenario, seed, locks) {
  const rng = random(seed);
  const nextBag = () => { const bag = [...'IJLOSTZ']; for (let i=6;i>0;i--) { const j=Math.floor(rng()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; } return bag; };
  let state;
  if (scenario === 'empty') {
    const bag = nextBag();
    state = R.createState({active:bag[0], queue:bag.slice(1), streamCursor:1, revision:1, bag:B.fromObserved({observed:bag,startPhase:0})});
  } else if (scenario === 'stable') {
    // Same public stable start, randomized valid continuation, NOT the fixture's prescribed tail.
    state = R.migrateState(F.get('marathon-rebuild').observation);
    state.revision = 1;
  } else throw Error('Unknown scenario: ' + scenario);
  assert.deepEqual(R.validate(state), []);
  assert.deepEqual(B.validate(state.bag), []);
  let mask = state.bag.remaining[Math.floor(rng()*state.bag.remaining.length)];
  const future=[];
  for (let i=0;i<locks*7+14;i++) {
    if (!mask) mask=127;
    const choices=[...'IJLOSTZ'].filter((_,j)=>mask & 1<<j);
    const piece=choices[Math.floor(rng()*choices.length)];
    mask ^= 1 << 'IJLOSTZ'.indexOf(piece); future.push(piece);
  }
  let knowledge=state.bag;
  for (const piece of future) { knowledge=B.consume(knowledge,piece); assert.deepEqual(B.validate(knowledge),[]); }
  return {schemaVersion:1, scenario, seed, rng:RNG_VERSION, locks, initial:publicObservation(state), future, inputHash:digest({scenario,initial:state,future})};
}
function workerPlanner({timeoutMs=2500}={}) {
  const sources=Object.fromEntries(SOURCE_FILES.filter(f=>f.endsWith('.js')&&fs.existsSync(path.join(root,f))).map(f=>[f,new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f})]));
  return request => {
    let response;
    const context=vm.createContext({performance:require('node:perf_hooks').performance,self:{postMessage:message=>{response=clone(message);}}});
    context.importScripts=(...files)=>{for(const file of files){if(!sources[file])throw Error('Unexpected worker import '+file); sources[file].runInContext(context,{timeout:timeoutMs});}};
    sources['st-worker.js'].runInContext(context,{timeout:timeoutMs});
    // Fresh context mirrors the page's fresh Worker and prevents cache/timer leakage.
    context.request=clone(request);
    new vm.Script('self.onmessage({data:request})').runInContext(context,{timeout:timeoutMs});
    if(!response || response.id!==request.id || response.revision!==request.observation.revision)throw Error('Worker protocol mismatch');
    if(response.type==='error')throw Error('Planner worker: '+response.message);
    if(response.type!=='result')throw Error('Unexpected worker response');
    return response.result;
  };
}
function validateAdvice(state, advice) {
  if(!advice?.target || !Array.isArray(advice.witness) || !advice.witness.length || advice.witness.at(-1)!=='HD')throw Error('Missing target or final hard drop');
  const proof=R.replay(publicObservation(state),advice.witness);
  if(!proof.valid || proof.events.length!==1 || R.validate(proof.state).length)throw Error('Invalid actual-pose witness');
  if(Boolean(advice.hold)!==advice.witness.includes('HOLD'))throw Error('Hold flag mismatch');
  if(advice.holdCount!==undefined && advice.holdCount!==advice.witness.filter(a=>a==='HOLD').length)throw Error('Hold count mismatch');
  for(const key of ['type','x','y','rotation'])if(proof.events[0].target[key]!==advice.target[key])throw Error('Target mismatch: '+key);
  return proof;
}
function boardMetrics(state) {
  const assessment=P.assess(state.board);
  let parity=0;
  state.board.forEach((row,y)=>[...row].slice(0,4).forEach((cell,x)=>{if(cell!=='.')parity+=(x+y)%2?1:-1;}));
  const heights=Array.from({length:10},(_,x)=>{const y=state.board.findIndex(row=>row[x]!=='.');return y<0?0:40-y;});
  const mass=state.board.join('').replaceAll('.','').length;
  return {height:assessment.maxHeight, meanSkylineHeight:heights.reduce((a,b)=>a+b,0)/10, occupiedRowsEquivalent:mass/10, mass, sealed:assessment.sealed, leftSealed:assessment.leftSealed, parity, regionalSupport:assessment.regionalSupport, maintenanceScope:assessment.maintenanceScope};
}
function createSession(input, api=P) {
  if(typeof api.startOpeningSession!=='function')throw Error('Shared opening session API is not available');
  let state=R.createState(clone(input.initial)), cursor=0, commitment=null, previous=null;
  let patternHistory=api.startPatternHistory(publicObservation(state));
  let opening=api.startOpeningSession(publicObservation(state),{emptyMode:input.scenario==='empty'});
  function replenish() {
    while(state.queue.length<6) {
      if(cursor>=input.future.length)throw Object.assign(Error('Private input exhausted'),{code:'INPUT_EXHAUSTED'});
      const type=input.future[cursor++]; state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};
      assert.deepEqual(B.validate(state.bag),[]);
    }
  }
  return {
    get state(){return state;}, get cursor(){return cursor;}, get opening(){return clone(opening);},
    request(id,options) { return {type:'plan',id,observation:publicObservation(state),previous:previous?clone(previous):null,commitment:commitment?clone(commitment):null,options:{...options,patternHistory:patternHistory?clone(patternHistory):null,openingPhase:opening.active,openingClear:opening.clear?clone(opening.clear):null,openingRepair:opening.repair?clone(opening.repair):null}}; },
    execute(advice) {
      const proof=validateAdvice(state,advice);
      const requiredDraws=state.queue.length-proof.state.queue.length;
      if(input.future.length-cursor<requiredDraws)throw Object.assign(Error('Private stream cannot replenish this witness; no actions applied'),{code:'INPUT_EXHAUSTED'});
      opening=api.acceptOpeningResult(opening,advice);
      previous={...clone(advice),revision:state.revision};

      commitment=!advice.evidence?.opening && api.resourceGoal(advice.continuation||[]) ? {observation:clone(publicObservation(state)),advice:clone(advice)} : null;
      let displayed=advice, event=null;
      const actions=[];
      for(const action of advice.witness) {
        const before=publicObservation(state),next=R.move(state,action);
        if(next===state)throw Error('Witness action did not execute: '+action);
        state={...next,revision:state.revision+1};
        replenish();
        if(action==='HD') {
          event=clone(state.lastEvent); previous=null;
          patternHistory=api.updatePatternHistory(patternHistory,before,publicObservation(state),event);
          opening=api.updateOpeningSession(opening,before,publicObservation(state),event);
          const suffix=commitment?api.continueCommitment(commitment.observation,publicObservation(state),commitment.advice,event,{patternHistory}):null;
          commitment=suffix?{observation:clone(publicObservation(state)),advice:clone(suffix)}:null;
          displayed=null;
        } else {
          const advanced=displayed?api.advance(publicObservation(state),displayed,action,{patternHistory}):null;
          if(advanced){displayed=advanced;previous=advanced;}
          else displayed=null;
        }
        actions.push({action,draws:cursor,adviceAdvanced:action==='HD'?null:Boolean(displayed),observationHash:digest(publicObservation(state))});
      }
      assert.deepEqual(event,clone(proof.events[0]));
      assert.deepEqual(state.board,proof.state.board);
      assert.deepEqual(R.validate(state),[]);
      return {event,actions};
    }
  };
}
function runEpisode(input, {config=CONFIG, planner=workerPlanner(), onRecord=()=>{}, api=P}={}) {
  const session=createSession(input,api), started=performance.now();
  const summary={schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,config,stop:'lock-cap',censored:true,locks:0,lines:0,tsds:0,quads:0,invalidRecommendations:0,budgetHits:0,openingCompletedAt:null,firstTsdAt:null,firstQuadAt:null,rebuildAfterTsdEvents:0,holds:0,nodes:0,peakHeight:boardMetrics(session.state).height,profile:[],latencies:[]};
  let notches=S.notchPattern(session.state.board), cavityDebt=[], centerDebt=[], awaitingRebuild=false;
  const stop=(kind,detail)=>{summary.stop=kind;summary.censored=false;summary.detail=detail;};
  for(let lock=0;lock<input.locks;lock++) {
    if(session.state.topOut){stop('top-out');break;}
    if(!session.state.active){stop('input-exhausted');break;}
    const request=session.request(lock+1,config), before=publicObservation(session.state), preAssessment=P.assess(before.board);
    let advice, elapsedMs;
    try {const t=performance.now();advice=planner(request);elapsedMs=performance.now()-t;}
    catch(error){stop(error.code==='ERR_SCRIPT_EXECUTION_TIMEOUT'?'planner-timeout':'planner-error',error.message);onRecord({kind:'stop',lock,request,error:summary.detail});break;}
    summary.latencies.push(elapsedMs);
    if(!advice?.target){stop('abstention',{status:advice?.status||'missing-result',reason:advice?.reason});onRecord({kind:'stop',lock,request,advice,elapsedMs});break;}
    try {validateAdvice(session.state,advice);}catch(error){summary.invalidRecommendations++;stop('invalid-recommendation',error.message);onRecord({kind:'stop',lock,request,advice,error:error.message});break;}
    let actual;
    try {actual=session.execute(advice);}catch(error){stop(error.code==='INPUT_EXHAUSTED'?'input-exhausted':'execution-error',error.message);onRecord({kind:'stop',lock,request,advice,error:error.message});break;}
    summary.locks++;
    const after=publicObservation(session.state), metrics=boardMetrics(after), assessment=P.assess(after.board),event=actual.event;
    const check=S.advanceNotches(before.board,{state:session.state,event},notches), fresh=S.notchPattern(after.board);
    cavityDebt=P.cavityRepairDebt(preAssessment,assessment,event,cavityDebt);
    centerDebt=P.centerReservationStep(before,{state:session.state,event},centerDebt,notches).debt;
    const flags=[];
    if(!S.canonicalClear(event))flags.push('noncanonical-clear');
    // Opening has no inherited maintenance cycle. Do not call recognition changes blocked notches.
    if(!request.options.openingPhase && !check.valid)flags.push('notch-transition');
    if(cavityDebt.length)flags.push('unrepaired-cavity-debt');
    summary.lines+=event.lines;summary.tsds+=Number(event.lines===2&&event.spin==='full');summary.quads+=Number(event.lines===4);
    if(event.lines===2&&event.spin==='full'){if(summary.firstTsdAt===null)summary.firstTsdAt=summary.locks;awaitingRebuild=true;}
    if(event.lines===4&&summary.firstQuadAt===null)summary.firstQuadAt=summary.locks;
    if(awaitingRebuild&&event.lines===0&&metrics.regionalSupport){summary.rebuildAfterTsdEvents++;awaitingRebuild=false;}
    summary.holds+=advice.witness.filter(a=>a==='HOLD').length;summary.nodes+=advice.metrics?.nodes||0;
    summary.budgetHits+=Number(Boolean(advice.evidence?.budgetExhausted));summary.peakHeight=Math.max(summary.peakHeight,metrics.height);
    if(request.options.openingPhase&&!session.opening.active&&summary.openingCompletedAt===null)summary.openingCompletedAt=lock;
    const profile={lock:summary.locks,lines:summary.lines,tsds:summary.tsds,quads:summary.quads,...metrics,centerDebt:centerDebt.length,cavityDebt:cavityDebt.length};
    summary.profile.push(profile);
    onRecord({kind:'lock',lock:summary.locks,request,advice,elapsedMs,event,actions:actual.actions,after,opening:session.opening,draws:session.cursor,metrics:profile,flags,phaseDiagnostic:{fresh,inherited:check.pattern,rawMismatch:fresh.anchorRow!==check.pattern.anchorRow||fresh.status!==check.pattern.status}});
    notches=check.pattern;
    if(session.state.topOut){stop('top-out');break;}
    if(flags.some(f=>f==='noncanonical-clear'||f==='notch-transition')){stop('policy-violation',flags);break;}
  }
  summary.elapsedMs=performance.now()-started;summary.final=boardMetrics(session.state);summary.finalObservation=publicObservation(session.state);
  const times=summary.latencies.slice().sort((a,b)=>a-b);
  summary.timing={plans:times.length,medianMs:times.length?times[Math.floor(times.length/2)]:null,p95Ms:times.length?times[Math.ceil(times.length*.95)-1]:null,maxMs:times.at(-1)??null};
  delete summary.latencies;
  onRecord({kind:'summary',summary});return summary;
}
function replayRecords(input, records, api=P) {
  const session=createSession(input,api);let locks=0;
  for(const record of records)if(record.kind==='lock') {
    assert.deepEqual(session.request(record.lock,record.request.options),record.request,'Public decision state diverged before lock '+record.lock);
    const actual=session.execute(record.advice);
    assert.deepEqual(actual.event,record.event);assert.deepEqual(actual.actions,record.actions);
    assert.deepEqual(publicObservation(session.state),record.after);locks++;
  }
  return {mode:'recorded-action-replay',locks,verified:true,finalObservation:publicObservation(session.state),note:'No search rerun; this validates the saved actions against the current rules/controller.'};
}
module.exports={publicObservation,CONFIG,PRESETS,RNG_VERSION,SOURCE_FILES,clone,digest,random,sourceHashes,makeInput,workerPlanner,validateAdvice,boardMetrics,createSession,runEpisode,replayRecords};
