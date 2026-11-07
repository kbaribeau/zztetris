'use strict';
// Evaluation owns the stream; only public worker messages cross the policy boundary.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const R = require('../../st-rules');
const {SEARCH_TIME_MS} = require('../../st-coach-config');
const B = require('../../st-bag');
const P = require('../../st-planner');
const S = require('../../st-structure');
const Context = require('../../st-obligation-context');
const Legacy = require('../../st-resource-legacy');
const Inventory = require('../../st-public-inventory');
const Handoff = require('../../st-handoff-continuity');
const PlanContinuity = require('../../st-plan-continuity');
const LeftPlan = require('../../st-left-plan');
const Tracking = require('../../st-obligation-tracking');
const TrackingMetrics = require('./st-tracking-metrics.cjs');
const F = require('../../st-fixtures');
const LS = require('./st-left-shape-metrics.cjs');
const CE = require('./st-coach-entry-metrics.cjs');
const root = path.resolve(__dirname, '../..');
const clone = x => JSON.parse(JSON.stringify(x));
// P.observe normalizes through createState, which adds lastEvent:null; the page
// intentionally omits that field from its worker message. Match that boundary.
function publicObservation(state){const observation=P.observe(state);delete observation.lastEvent;return observation;}
const digest = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const SOURCE_FILES = ['st-lab.html','st-practice.js','st-reset-diagnostics.js','st-piece-ledger.js','st-plan-continuity.js','st-obligation-inverse.js','st-left-obligations.js','st-left-plan.js','st-sl-obligations.js','st-opening-obligations.js','st-obligation-state.js','st-obligation-context.js','st-obligation-projection.js','st-obligation-assessment.js','st-obligation-route.js','st-obligation-resources.js','st-opening-eligibility.js','st-resource-legacy.js','st-resource-provider.js','st-obligation-tracking.js','st-coach-config.js', 'st-rules.js', 'st-bag.js', 'st-structure.js', 'st-paired-repair.js', 'st-access.js', 'st-pattern-history.js', 'st-left-foundation.js', 'st-left-context.js', 'st-midgame-coaches.js','st-reset-coach.js', 'st-planner.js', 'st-opening-patterns.js','st-opening-continuations.js','st-opening-sources.js','st-source-scoring.js', 'st-opening.js', 'st-reset-policy.js','st-public-inventory.js','st-center-obligations.js','st-resource-history.js','st-handoff-continuity.js', 'st-obligation-admission.js', 'st-resource-search.js', 'st-midgame-resources.js', 'st-resource-tracking.js', 'st-worker.js', 'st-lab.js', 'st-session.js', 'st-fixtures.js', 'scripts/lib/st-simulation.cjs', 'scripts/lib/st-simulation-runner.cjs', 'scripts/lib/st-left-shape-metrics.cjs', 'scripts/lib/st-coach-entry-metrics.cjs', 'scripts/lib/st-tracking-metrics.cjs', 'scripts/lib/st-evaluation.cjs', 'scripts/evaluate-st-protocol.cjs', 'scripts/simulate-st.cjs'];
const CONFIG = Object.freeze({depth:3, width:8, maxNodes:45000, timeMs:SEARCH_TIME_MS});
const PRESETS = Object.freeze({quick:{seeds:[10331, 20333], locks:24}, research:{seeds:Array.from({length:16}, (_,i) => 810001 + i * 997), locks:500}});
const RNG_VERSION = 'mulberry32-seven-bag-v1';
function random(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function sourceHashes() { return Object.fromEntries(SOURCE_FILES.map(f => [f,digest(fs.readFileSync(path.join(root,f),'utf8'))])); }
function makeInput(scenario, seed, locks, {withOrigins=false}={}) {
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
  const initialRemainder=[...'IJLOSTZ'].filter((_,i)=>mask & 1<<i).length;
  const future=[];
  for (let i=0;i<locks*7+14;i++) {
    if (!mask) mask=127;
    const choices=[...'IJLOSTZ'].filter((_,j)=>mask & 1<<j);
    const piece=choices[Math.floor(rng()*choices.length)];
    mask ^= 1 << 'IJLOSTZ'.indexOf(piece); future.push(piece);
  }
  let knowledge=state.bag;
  for (const piece of future) { knowledge=B.consume(knowledge,piece); assert.deepEqual(B.validate(knowledge),[]); }
  const input={schemaVersion:1, scenario, seed, rng:RNG_VERSION, locks, initial:publicObservation(state), future, inputHash:digest({scenario,initial:state,future})};
  // Evaluator-only provenance. Default inputs, RNG draws and worker messages
  // are unchanged; no unobserved piece types are added by this metadata.
  if(withOrigins)input.pieceOrigins={schemaVersion:1,initialBagKnown:scenario==='empty',futureFirstBag:initialRemainder?0:1,futureFirstSlot:initialRemainder?7-initialRemainder:0};
  return input;
}
function workerPlanner({timeoutMs=2500,disableSearchTimeout=false}={}) {
  const sources=Object.fromEntries(SOURCE_FILES.filter(f=>f.endsWith('.js')&&fs.existsSync(path.join(root,f))).map(f=>[f,new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f})]));
  return request => {
    let response;
    const context=vm.createContext({performance:require('node:perf_hooks').performance,self:{postMessage:message=>{response=clone(message);}}});
    context.importScripts=(...files)=>{for(const file of files){if(!sources[file])throw Error('Unexpected worker import '+file); sources[file].runInContext(context,{timeout:timeoutMs});}};
    sources['st-worker.js'].runInContext(context,{timeout:timeoutMs});
    // Fresh context mirrors the page's fresh Worker and prevents cache/timer leakage.
    context.request=clone(request);
    // Infinity is installed only inside this simulation realm, after JSON cloning.
    // Artifacts retain timeMs:null; browser worker defaults are never changed.
    const invoke=(disableSearchTimeout?'request.options={...(request.options||{}),timeMs:Infinity};':'')+'self.onmessage({data:request})';
    new vm.Script(invoke).runInContext(context,disableSearchTimeout?{}:{timeout:timeoutMs});
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
function accountingFrame(current,position){return{status:current.status,state:current.state,reason:current.reason,view:Context.resolve(current,{position})};}
function importCurrent(snapshot,position){const current=Context.importState(snapshot,{position});if(position.bag)assert.deepEqual(clone(position.bag),clone(current.inventory.knowledge),'Current public bag disagrees with supplied inventory');return current;}
function createSession(input, api=P) {
  if(typeof api.startOpeningSession!=='function')throw Error('Shared opening session API is not available');
  let state=R.createState(clone(input.initial)), cursor=0, commitment=null, previous=null, pendingLHint=null, pendingHandoffRecovery=null, openingForecast=null,planContinuity=null;
  let current=Object.hasOwn(input,'obligationContext')?importCurrent(input.obligationContext,publicObservation(state)):Context.start(publicObservation(state),{fresh:input.scenario==='empty'});
  let patternHistory=current.status==='available'?clone(current.state.safety.notches):null,actualLocks=0,actualLines=0;
  const tracking=Tracking.create(),effectListeners=new Set();let effectFailure=null;
  let opening=api.startOpeningSession(publicObservation(state),{emptyMode:input.scenario==='empty'});
  function adoptPlan(advice){const proof=advice?.evidence?.construction;planContinuity=proof?PlanContinuity.importState(PlanContinuity.exportState(planContinuity),{position:publicObservation(state),inventory:current.inventory,proof})||PlanContinuity.start(publicObservation(state),current.inventory,proof):null;}
  function resources(){return{...Context.resolve(current,{position:publicObservation(state)}),instances:{active:current.inventory.active,hold:current.inventory.hold,queue:current.inventory.queue},terminal:Boolean(state.topOut||!state.active)};}
  function installTransition(prior,before,transition,operation,lock){
    current=transition.context;
    if(current.status==='available')patternHistory=clone(current.state.safety.notches);
    tracking.transition(accountingFrame(prior,before),accountingFrame(current,publicObservation(state)),{operation,effects:transition.effects,lock});
    for(const listener of effectListeners)try{listener(clone({operation,effects:transition.effects,lock,lines:actualLines}));}catch(error){effectListeners.delete(listener);effectFailure??=String(error?.message??error);}
  }
  function mark(kind){
    if(current.status!=='available'||kind==='handoff'&&current.state.sl.handoff||kind==='begin-reset'&&current.state.account.reset.status==='active')return;
    const prior=current,before=publicObservation(state),transition=kind==='handoff'?Context.handoff(prior,{position:before}):Context.beginReset(prior,{position:before,candidate:true});
    installTransition(prior,before,transition,{kind},actualLocks);
  }
  function replenish() {
    while(state.queue.length<6) {
      if(cursor>=input.future.length)throw Object.assign(Error('Private input exhausted'),{code:'INPUT_EXHAUSTED'});
      const type=input.future[cursor++]; state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};
      assert.deepEqual(B.validate(state.bag),[]);
    }
  }
  return {
    onTrackingEvent:listener=>tracking.subscribe(listener),
    onObligationEffect(listener){effectListeners.add(listener);return()=>effectListeners.delete(listener);},
    get trackingHealth(){return effectFailure?{status:'failed',reason:effectFailure}:tracking.health();},
    get publicInventory(){return Inventory.exportState(current.inventory);},
    get obligationContext(){return Context.exportState(current);},
    get frame(){return accountingFrame(current,publicObservation(state));},
    get actualLocks(){return actualLocks;},
    get resources(){return resources();}, get state(){return state;}, get cursor(){return cursor;}, get opening(){return clone(opening);},
    request(id,options) { const {handoffRecovery:ignored,pendingLHint:ignoredHint,openingForecast:ignoredForecast,resourceContext:ignoredLegacy,obligationContext:ignoredCurrent,resourceInput:ignoredInput,planContinuity:ignoredPlan,...settings}=options||{};return {type:'plan',id,observation:publicObservation(state),previous:previous?clone(previous):null,commitment:commitment?clone(commitment):null,options:{...settings,...(planContinuity?{planContinuity:PlanContinuity.exportState(planContinuity)}:{}),...(openingForecast?{openingForecast:clone(openingForecast)}:{}),...(pendingLHint?{pendingLHint:clone(pendingLHint)}:{}),...(pendingHandoffRecovery?{handoffRecovery:clone(pendingHandoffRecovery)}:{}),obligationContext:Context.exportState(current),patternHistory:patternHistory?clone(patternHistory):null,openingPhase:opening.active,openingSource:opening.source?clone(opening.source):null,openingClear:opening.clear?clone(opening.clear):null,openingRepair:opening.repair?clone(opening.repair):null}}; },
    execute(advice,{onCoach=()=>{},lock=actualLocks+1}={}) {
      try{
      const proof=validateAdvice(state,advice);
      const requiredDraws=state.queue.length-proof.state.queue.length;
      if(input.future.length-cursor<requiredDraws)throw Object.assign(Error('Private stream cannot replenish this witness; no actions applied'),{code:'INPUT_EXHAUSTED'});
      pendingHandoffRecovery=null;
      for(const repair of LeftPlan.selectedRepairs(publicObservation(state),advice,{checked:true})){
        if(current.status!=='available')break;
        const prior=current,before=publicObservation(state),transition=Context.acceptLeftRepair(prior,{position:before,repair,checked:true});
        installTransition(prior,before,transition,{kind:'accept-left-repair',repair,checked:true},actualLocks);
      }
      adoptPlan(advice);
      if(typeof api.captureOpeningForecast==='function')openingForecast=api.captureOpeningForecast(publicObservation(state),advice)||openingForecast;
      const recovery=typeof api.captureHandoffRecovery==='function'?api.captureHandoffRecovery(publicObservation(state),advice,Context.exportState(current)):null;
      let recoveryExecution=recovery?Handoff.start(publicObservation(state),current.inventory):null;
      if(advice.evidence?.strategy==='reset-coach')mark('begin-reset');
      const wasOpening=opening.active;opening=api.acceptOpeningResult(opening,advice);
      if(!opening.active)openingForecast=null;
      if(wasOpening&&!opening.active){mark('handoff');recoveryExecution=Handoff.markHandoff(recoveryExecution,publicObservation(state),current.inventory);}
      const coachBeforeLock=CE.phase(opening,resources());
      onCoach(coachBeforeLock,false);
      previous={...clone(advice),revision:state.revision};pendingLHint=advice.evidence?.pendingLStage?clone(advice.evidence.pendingLStage):null;
      commitment=advice.recommendation?.kind!=='risky'&&!advice.evidence?.opening && (advice.evidence?.strategy==='reset-coach'||api.resourceGoal(advice.continuation||[])) ? {observation:clone(publicObservation(state)),advice:clone(advice)} : null;
      let displayed=advice, event=null;
      const actions=[];
      for(const action of advice.witness) {
        const before=publicObservation(state),prior=current,next=R.move(state,action);
        if(next===state)throw Error('Witness action did not execute: '+action);
        state={...next,revision:state.revision+1};
        replenish();
        const after={...publicObservation(state),lastEvent:state.lastEvent},transition=Context.applyActual(prior,{before,action,after});
        if(action==='HD'){actualLocks++;actualLines+=state.lastEvent.lines;}
        installTransition(prior,before,transition,action==='HD'?{kind:'lock',piece:transition.receipt.locked,event:state.lastEvent}:{kind:'observe'},action==='HD'?actualLocks:actualLocks+1);
        recoveryExecution=Handoff.advance(recoveryExecution,before,action,after,transition.receipt);
        planContinuity=PlanContinuity.advance(planContinuity,before,action,after,transition.receipt);
        if(openingForecast)openingForecast=typeof api.advanceOpeningForecast==='function'?api.advanceOpeningForecast(openingForecast,before,publicObservation(state),action):null;
        if(action==='HD') {
          onCoach(CE.phase(opening,resources()),true);
          event=clone(state.lastEvent); previous=null;
          const continuity=Handoff.exportConnected(recoveryExecution);
          pendingHandoffRecovery=recovery&&continuity?{...clone(recovery),actualEvent:clone(event),continuity}:null;recoveryExecution=null;
          opening=api.updateOpeningSession(opening,before,publicObservation(state),event);
          if(!opening.active)openingForecast=null;
          const suffix=commitment?api.continueCommitment(commitment.observation,publicObservation(state),commitment.advice,event,{patternHistory,obligationContext:Context.exportState(current),planContinuity:PlanContinuity.exportState(planContinuity)}):null;
          commitment=suffix?{observation:clone(publicObservation(state)),advice:clone(suffix)}:null;adoptPlan(suffix);
          displayed=null;
        } else {
          const advanced=displayed?api.advance(publicObservation(state),displayed,action,{patternHistory,openingPhase:opening.active,openingSource:opening.source,obligationContext:Context.exportState(current),planContinuity:PlanContinuity.exportState(planContinuity)}):null;
          if(advanced){displayed=advanced;previous=advanced;}
          else displayed=null;
        }
        actions.push({action,draws:cursor,adviceAdvanced:action==='HD'?null:Boolean(displayed),observationHash:digest(publicObservation(state))});
      }
      assert.deepEqual(event,clone(proof.events[0]));
      assert.deepEqual(state.board,proof.state.board);
      assert.deepEqual(R.validate(state),[]);
      return {event,actions,coachBeforeLock};
      }catch(error){pendingHandoffRecovery=null;openingForecast=null;planContinuity=null;throw error;}
    }
  };
}
// Evaluator-only cap; never added to a public planner request.
function validatePhaseCap(input) {
  if(input.phaseCap===undefined)return;
  const c=input.phaseCap;
  if(!c||Object.keys(c).sort().join(',')!=='openingLocks,postHandoffLocks'||input.scenario!=='empty'||!Number.isSafeInteger(c.openingLocks)||c.openingLocks<1||!Number.isSafeInteger(c.postHandoffLocks)||c.postHandoffLocks<1||input.locks!==c.openingLocks+c.postHandoffLocks)throw Error('Invalid phase cap');
}
function phaseCapStatus(input,locks,transitions) {
  if(!input.phaseCap)return null;
  const handoff=transitions.find(t=>t.coach!=='opening');
  const handoffAfterLock=handoff?.afterLock??null;
  const reason=handoff? (locks>=handoffAfterLock+input.phaseCap.postHandoffLocks?'post-handoff-lock-cap':null):(locks>=input.phaseCap.openingLocks?'opening-lock-cap':null);
  return {reason,handoffAfterLock,...input.phaseCap};
}
function runEpisode(input, {config=CONFIG, planner=workerPlanner({disableSearchTimeout:config.timeMs===null}), onRecord=()=>{}, api=P}={}) {
  validatePhaseCap(input);
  const session=createSession(input,api), started=performance.now();
  const summary={schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,config,stop:'lock-cap',censored:true,locks:0,lines:0,tsds:0,quads:0,invalidRecommendations:0,budgetHits:0,firstTsdAt:null,firstQuadAt:null,rebuildAfterTsdEvents:0,holds:0,nodes:0,peakHeight:boardMetrics(session.state).height,profile:[],latencies:[]};
  if(input.phaseCap)summary.phaseCap=clone(input.phaseCap);
  summary.reset={starts:[],completions:[],firstCompletion:null,postFirstLines:null,postFirstLocks:null,intervals:[]};
  session.onObligationEffect(({effects,lock,lines})=>{
    for(const effect of effects){
      if(effect.domain!=='account')continue;
      if(effect.status==='reset-started')summary.reset.starts.push({at:lock,firstLock:lock+1,linesBefore:lines});
      if(effect.status==='reset-completed'){
        const completion={completedAt:lock,lines,remainingZ:session.resources.extraZ.remaining};summary.reset.completions.push(completion);
        if(summary.reset.firstCompletion===null)summary.reset.firstCompletion=completion;
        else{const prior=summary.reset.completions.at(-2);summary.reset.intervals.push({from:prior.completedAt,to:lock,locks:lock-prior.completedAt,lines:lines-prior.lines});}
      }
    }
  });
  const coaches=CE.create(CE.phase(session.opening,session.resources),{imported:input.scenario!=='empty'});
  const tracking=TrackingMetrics.create(),trackingEvents=[];
  session.onTrackingEvent(event=>{tracking.record(event);trackingEvents.push(event);});
  const record=value=>onRecord({...value,...coaches.snapshot(),...(trackingEvents.length?{trackingEvents:trackingEvents.splice(0)}:{})});
  record({kind:'tracking-start',schemaVersion:1});
  const leftShapes=LS.create(session.state.board);
  let notches=S.notchPattern(session.state.board), cavityDebt=[], centerDebt=[], awaitingRebuild=false;
  const stop=(kind,detail)=>{summary.stop=kind;summary.censored=false;summary.detail=detail;};
  for(let lock=0;lock<input.locks;lock++) {
    if(session.state.topOut){stop('top-out');break;}
    if(!session.state.active){stop('input-exhausted');break;}
    const request=session.request(lock+1,config), before=publicObservation(session.state), preAssessment=P.assess(before.board);
    let advice, elapsedMs;
    try {const t=performance.now();advice=planner(request);elapsedMs=performance.now()-t;}
    catch(error){stop(error.code==='ERR_SCRIPT_EXECUTION_TIMEOUT'?'planner-timeout':'planner-error',error.message);record({kind:'stop',lock,request,error:summary.detail});break;}
    summary.latencies.push(elapsedMs);
    // The final dispatcher result owns the request even when it abstains.
    // Ordinary probes and projected Reset assessments do not enter a coach.
    if(advice?.evidence?.strategy==='reset-coach')coaches.enter('reset',summary.locks,'reset-dispatch');
    if(!advice?.target){stop('abstention',{status:advice?.status||'missing-result',reason:advice?.reason});record({kind:'stop',lock,request,advice,elapsedMs});break;}
    try {validateAdvice(session.state,advice);}catch(error){summary.invalidRecommendations++;stop('invalid-recommendation',error.message);record({kind:'stop',lock,request,advice,error:error.message});break;}
    let actual;
    try {actual=session.execute(advice,{lock:summary.locks+1,onCoach:(coach,locked)=>coaches.enter(coach,summary.locks+Number(locked),locked?'actual-lock':'accepted-handoff')});}catch(error){stop(error.code==='INPUT_EXHAUSTED'?'input-exhausted':'execution-error',error.message);record({kind:'stop',lock,request,advice,error:error.message});break;}
    summary.locks++;
    coaches.enter(CE.phase(session.opening,session.resources),summary.locks,'actual-lock');
    const after=publicObservation(session.state), metrics=boardMetrics(after), assessment=P.assess(after.board),event=actual.event;
    metrics.leftShape=LS.classify(after.board);LS.add(leftShapes,metrics.leftShape);
    const check=S.advanceNotches(before.board,{state:session.state,event},notches), fresh=S.notchPattern(after.board);
    cavityDebt=P.cavityRepairDebt(preAssessment,assessment,event,cavityDebt);
    centerDebt=P.centerReservationStep(before,{state:session.state,event},centerDebt,notches).debt;
    const flags=[];
    if(!S.canonicalClear(event))flags.push('noncanonical-clear');
    // Opening has no inherited maintenance cycle. Do not call recognition changes blocked notches.
    if(!request.options.openingPhase && !check.valid)flags.push('notch-transition');
    if(cavityDebt.length)flags.push('unrepaired-cavity-debt');
    summary.lines+=event.lines;
    summary.tsds+=Number(event.lines===2&&event.spin==='full');summary.quads+=Number(event.lines===4);
    if(event.lines===2&&event.spin==='full'){if(summary.firstTsdAt===null)summary.firstTsdAt=summary.locks;awaitingRebuild=true;}
    if(event.lines===4&&summary.firstQuadAt===null)summary.firstQuadAt=summary.locks;
    if(awaitingRebuild&&event.lines===0&&metrics.regionalSupport){summary.rebuildAfterTsdEvents++;awaitingRebuild=false;}
    summary.holds+=advice.witness.filter(a=>a==='HOLD').length;summary.nodes+=advice.metrics?.nodes||0;
    summary.budgetHits+=Number(Boolean(advice.evidence?.budgetExhausted));summary.peakHeight=Math.max(summary.peakHeight,metrics.height);
    const profile={lock:summary.locks,lines:summary.lines,tsds:summary.tsds,quads:summary.quads,...metrics,centerDebt:centerDebt.length,cavityDebt:cavityDebt.length};
    summary.profile.push(profile);
    record({kind:'lock',lock:summary.locks,request,advice,elapsedMs,event,actions:actual.actions,after,opening:session.opening,draws:session.cursor,metrics:profile,flags,phaseDiagnostic:{fresh,inherited:check.pattern,rawMismatch:fresh.anchorRow!==check.pattern.anchorRow||fresh.status!==check.pattern.status}});
    notches=check.pattern;
    if(session.state.topOut){stop('top-out');break;}
    if(flags.some(f=>f==='noncanonical-clear'||f==='notch-transition')){stop('policy-violation',flags);break;}
    const boundary=phaseCapStatus(input,summary.locks,coaches.snapshot().coachTransitions);
    if(boundary?.reason){summary.stop='phase-cap';summary.censored=true;summary.detail=boundary;record({kind:'stop',lock:summary.locks,detail:boundary});break;}
  }
  if(summary.reset.firstCompletion){summary.reset.postFirstLines=summary.lines-summary.reset.firstCompletion.lines;summary.reset.postFirstLocks=summary.locks-summary.reset.firstCompletion.completedAt;}
  summary.reset.finalStatus=session.resources.reset?.status??'unknown';summary.reset.finalProgress=session.resources.reset?.progress??null;
  Object.assign(summary,coaches.snapshot());
  const interrupted=summary.stop==='execution-error',resourceLock=session.actualLocks;
  summary.tracking=session.trackingHealth.status==='failed'?TrackingMetrics.unavailable('Tracking event delivery failed; recorded totals may be incomplete.'):tracking.snapshot({scope:interrupted?'retained-prefix':'entire-run',throughLock:resourceLock});
  summary.finalObligations=Tracking.status(session.frame,{scope:session.frame.status==='unavailable'?'unavailable':interrupted?'partial':'current',throughLock:resourceLock,coverage:{status:session.frame.view.availability,origin:input.obligationContext?'imported-current':input.scenario==='empty'?'fresh':'unknown-prior',throughLock:resourceLock},terminal:{stop:summary.stop,censored:summary.censored,cap:input.locks,topOut:Boolean(session.state.topOut),inputExhausted:!session.state.active},...(interrupted?{reason:'Execution interrupted; current accounting includes its last accepted action, which may exceed the completed runner lock count.'}:{})});
  summary.leftShapes=LS.finish(leftShapes);
  summary.elapsedMs=performance.now()-started;summary.final=boardMetrics(session.state);summary.finalObservation=publicObservation(session.state);
  const times=summary.latencies.slice().sort((a,b)=>a-b);
  summary.timing={plans:times.length,medianMs:times.length?times[Math.floor(times.length/2)]:null,p95Ms:times.length?times[Math.ceil(times.length*.95)-1]:null,maxMs:times.at(-1)??null};
  delete summary.latencies;
  record({kind:'summary',summary});return summary;
}
// A retained suffix is re-certified during replay, so its elapsed duration is
// regenerated. Exclude only that measurement, never goals, witnesses or supply.
function replayRequest(request){const value=clone(request);if(value.commitment?.advice?.metrics)delete value.commitment.advice.metrics.elapsedMs;return value;}
function replayRecords(input, records, api=P) {
  const session=createSession(input,api);let locks=0;const adviceAdvanceMismatches=[];
  // Per-input display retention has a real wall-clock budget. It does not
  // change the recorded uninterrupted witness or the rules state. Keep every
  // action/draw/public-state check strict, but report this timing diagnostic.
  const replayActions=actions=>actions.map(({adviceAdvanced,...action})=>{
    assert.equal(action.action==='HD'?adviceAdvanced===null:typeof adviceAdvanced==='boolean',true,'Malformed advice advancement diagnostic');
    return action;
  });
  for(const record of records)if(record.kind==='lock') {
    assert.deepEqual(replayRequest(session.request(record.lock,record.request.options)),replayRequest(record.request),'Public decision state diverged before lock '+record.lock);
    const actual=session.execute(record.advice);
    assert.deepEqual(actual.event,record.event);assert.deepEqual(replayActions(actual.actions),replayActions(record.actions));
    actual.actions.forEach((action,index)=>{if(action.adviceAdvanced!==record.actions[index].adviceAdvanced)adviceAdvanceMismatches.push({lock:record.lock,index,action:action.action,recorded:record.actions[index].adviceAdvanced,replayed:action.adviceAdvanced});});
    assert.deepEqual(publicObservation(session.state),record.after);locks++;
  }
  return {mode:'recorded-action-replay',locks,verified:true,finalObservation:publicObservation(session.state),ignoredVolatileRequestFields:['commitment.advice.metrics.elapsedMs'],ignoredVolatileActionFields:['adviceAdvanced'],adviceAdvanceMismatches,note:'No planner search rerun; exact actions/events/draws/public state and non-timing request data are checked. Regenerated commitment duration and wall-clock display-retention flags are excluded from equality; every display-retention difference is reported. This verifies rapid uninterrupted recorded witnesses, not slower interactive replanning.'};
}
// Trust one current checkpoint and verify only its finite retained action tail.
// Native recovery never reconstructs the run's past; old requests convert once.
function recoverTrackingStatus(record) {
  if(record?.kind!=='lock'||!Number.isSafeInteger(record.lock)||record.lock<1||record.request?.id!==record.lock)throw Error('Invalid retained lock boundary');
  const options=record.request.options||{};let state=R.createState(record.request.observation),current;
  if(Object.hasOwn(options,'obligationContext'))current=importCurrent(options.obligationContext,state);
  else if(options.resourceContext){const converted=Legacy.convert(state,options.resourceContext);if(converted.status!=='available')throw Error(converted.reason);current=converted.context;}
  else throw Error('No retained current obligation checkpoint');
  for(const repair of LeftPlan.selectedRepairs(state,record.advice,{checked:true}))if(current.status==='available')current=Context.acceptLeftRepair(current,{position:state,repair,checked:true}).context;
  if(record.advice?.evidence?.strategy==='reset-coach'&&current.status==='available')current=Context.beginReset(current,{position:state,candidate:true}).context;
  if(options.openingPhase){const accepted=P.acceptOpeningResult({active:true,source:options.openingSource??null},record.advice);if(!accepted.active&&current.status==='available')current=Context.handoff(current,{position:state}).context;}
  if(!Array.isArray(record.actions)||!sameActions(record.actions.map(a=>a.action),record.advice?.witness))throw Error('Recorded actions differ from advice');
  const proof=validateAdvice(state,record.advice);
  const needed=6-proof.state.queue.length,revealed=needed?record.after?.queue?.slice(-needed)||[]:[];
  if(needed<0||needed>2||revealed.length!==needed)throw Error('Invalid retained reveal suffix');
  let cursor=0;
  for(const action of record.actions){const before=publicObservation(state),next=R.move(state,action.action);if(next===state)throw Error('Retained action did not execute');state={...next,revision:state.revision+1};while(state.queue.length<6){const type=revealed[cursor++];if(!type)throw Error('Missing retained reveal');state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};}if(digest(publicObservation(state))!==action.observationHash)throw Error('Retained action hash mismatch');current=Context.applyActual(current,{before,action:action.action,after:{...publicObservation(state),lastEvent:state.lastEvent}}).context;}
  assert.deepEqual(publicObservation(state),record.after);assert.deepEqual(state.lastEvent,record.event);
  if(cursor!==needed)throw Error('Retained lock could not be checked');
  return Tracking.status(accountingFrame(current,publicObservation(state)),{scope:current.status==='unavailable'?'unavailable':'partial',throughLock:record.lock,coverage:{status:current.status==='available'?current.state.availability:'unavailable',origin:'retained-current-checkpoint',throughLock:record.lock},terminal:{status:'unobserved'},reason:'Last checked retained lock; later transitions may be unobserved.'});
}
function sameActions(a,b){return JSON.stringify(a)===JSON.stringify(b);}
module.exports={recoverTrackingStatus,validatePhaseCap,phaseCapStatus,publicObservation,CONFIG,PRESETS,RNG_VERSION,SOURCE_FILES,clone,digest,random,sourceHashes,makeInput,workerPlanner,validateAdvice,boardMetrics,createSession,runEpisode,replayRecords};
