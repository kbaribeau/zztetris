'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),M=require('../st-obligation-resources'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),H=require('../st-pattern-history');
const fixture=require('./fixtures/ordinary-sl-allocation.json'),clone=x=>JSON.parse(JSON.stringify(x));
const bounds={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity},opts=extra=>({...fixture.options,...bounds,...extra});
const current=()=>Current.importState(fixture.options.obligationContext,{position:fixture.observation});
const sum=()=>CurrentProvider.facts(CurrentProvider.prepare(fixture.observation,{obligationContext:Current.exportState(Current.importState(fixture.options.obligationContext,{position:fixture.observation}))}));
const cache=new Map(),plan=(off=false)=>{if(!cache.has(off))cache.set(off,P.plan(fixture.observation,opts({disableVisibleSLTail:off})));return clone(cache.get(off));};
const noMetrics=a=>clone({...a,metrics:undefined});
function moduleWith(replacements){const module={exports:{}},req=require('node:module').createRequire(require.resolve('../st-planner'));vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,exports:module.exports,require:n=>replacements[n]||req(n),Date,performance,globalThis:{}});return module.exports;}
function node(advice,facts){let state=P.observe(fixture.observation),resource=M.start(state,current()),notches=H.resolve(state,fixture.options.patternHistory),allocation;
 const path=advice.continuation.map(p=>{const r=R.replay(state,p.witness);assert(r.valid);assert.deepEqual(r.events,[p.event]);const step={...p,state:r.state},next=M.step(state,step,resource);allocation=P.slAllocationStep(state,step,resource,next,notches,allocation);notches=S.advanceNotches(state.board,step,notches).pattern;state=r.state;resource=next;return step;});
 return{path,state,resources:resource,slAllocation:allocation,assessment:clone(advice.assessment),rank:clone(advice.evidence.structuralRank),structuralScore:advice.evidence.structuralScore,centerContinuity:facts.centerContinuity,dependencyDebt:facts.dependencyDebt,entryDebt:facts.entryDebt,notchValid:true,qualified:true,continuationChecked:true,cycleDebt:0,centerDebt:[],cavityDebt:[],key:'tail-comparison'};
}

// These two historical routes are independent literal component inputs, not
// expected unrestricted policy choices. Depth seven exposes their complete
// public I/O allocation to the current admission machinery; production depth
// remains three and the shared node ceiling stays 45,000.
const controlledPlanner=require('./support/st-controlled-placements.cjs');
const tailRoutes={"candidate":[["HOLD","L","L","L","HD"],["HOLD","L","L","L","CW","L","HD"],["R","R","R","CW","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CW","HD"],["HOLD","R","HD"],["HOLD","R180","R","HD"],["L","L","HD"],["HOLD","R","R","R","CW","R","HD"]],"reference":[["L","L","CW","HD"],["HOLD","L","L","L","L","HD"],["R","R","R","CW","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CW","HD"],["HOLD","R","HD"],["HOLD","R180","R","HD"],["L","L","L","L","HD"],["HOLD","R","R","R","CW","R","HD"]]};
let componentPair;
function admittedRoute(witnesses){
 const advice=clone(controlledPlanner(fixture.observation,[witnesses]).plan(fixture.observation,opts({depth:7,disableVisibleSLTail:true})));
 assert.equal(advice.continuation.length,7,'The complete literal route must pass current admission');
 // Rotation/shift order may differ while reaching the same literal moves.
 let state=P.observe(fixture.observation);const events=witnesses.map(witness=>{const replay=R.replay(state,witness);assert(replay.valid);state=replay.state;return replay.events[0];});
 assert.deepEqual(advice.continuation.map(p=>p.event),events);
 assert(advice.metrics.nodes<=45000);assert(P.revalidate(fixture.observation,advice,opts()));
 return advice;
}
function facts(advice){return{centerContinuity:advice.assessment.structure.centerContinuity.preference,dependencyDebt:advice.evidence.dependencyDebt,entryDebt:advice.continuation.at(-1).structuralEvidence.entryDebt};}

function pair(){
 if(!componentPair){
  const a=admittedRoute(tailRoutes.candidate),reference=admittedRoute(tailRoutes.reference),c=node(a,facts(a)),r=node(reference,facts(reference));
  const options={candidateDraw:P.publicDrawHorizon(fixture.observation,c.path,sum()),referenceDraw:P.publicDrawHorizon(fixture.observation,r.path,sum()),initialResources:M.start(fixture.observation,current()),original:{...r,path:r.path.slice(0,5)}};
  componentPair={a,reference,c,r,options};
 }
 return componentPair;
}

test('visible SL tail: fixed admitted I/O routes retain the same paid SL and TSD while improving Left',()=>{
 const {a,c,r,options}=pair(),comparison=P.visibleSLTailComparison(c,r,options);
 assert.equal(comparison.allowed,true);assert.equal(comparison.reason,'strict-visible-tail-left-gain');
 assert.equal(comparison.candidate.leftScore,4);assert.equal(comparison.reference.leftScore,2);assert.deepEqual(comparison.candidate.schedule,comparison.reference.schedule);assert.deepEqual(comparison.candidate.schedule.tsds,[3]);assert.deepEqual(c.slAllocation,r.slAllocation);assert.deepEqual(c.state.active,null);assert.equal(c.state.hold,'T');assert.deepEqual(c.state.queue,[]);assert.equal(c.path.at(-1).structuralEvidence.allocation,'quad-preparation');assert.equal(P.resourceGoalPrefix(c.path,c.path),7);
 assert.deepEqual(options.candidateDraw.drawn,options.referenceDraw.drawn);assert.deepEqual(options.candidateDraw.placed.slice().sort(),options.referenceDraw.placed.slice().sort());assert(P.revalidate(fixture.observation,a,opts()));
});
test('visible SL tail: unrestricted Left-first search retains the admitted S-tier goal when a tail is not retained',()=>{
 const a=plan(),off=plan(true),t=a.metrics.ordinarySAllocation.visibleTail;
 assert.equal(a.continuation.length,5);assert.equal(t.selected,false);assert.equal(t.reason,'tail-not-retained-by-resource-goal');assert.deepEqual(noMetrics(a),noMetrics(off));
 assert.deepEqual(t.priorAdmission.continuation,off.continuation);assert.equal(t.comparison.reference.leftScore,2);assert.equal(t.comparison.candidate.leftScore,4);
 // This is the reviewed fresh J/O order, not the historical O/J choice. The
 // optional seven-lock tail still cannot replace the admitted resource goal.
 assert.deepEqual(a.continuation.map(p=>p.event.type),['J','O','T','S','L']);assert.equal(a.assessment.leftContext.tier,'S');assert.deepEqual(a.assessment.leftContext.profile,[0,0,1,1]);
 assert.equal(P.resourceGoalPrefix(a.continuation,a.continuation),5);assert.deepEqual(t.comparison.candidate.schedule,t.comparison.reference.schedule);assert.deepEqual(t.comparison.candidate.schedule.tsds,[3]);
 node(a,facts(a)); // Replay every event through the real rules and accounting.
 assert.equal(t.compatiblePrefixes,2);assert.equal(t.omittedPrefixes,0);assert(t.prefixes.every(p=>p.qualifiedEndpoints===2&&p.layers.every(l=>l.retained<=2)));assert(a.metrics.nodes<=45000);assert(P.revalidate(fixture.observation,a,opts()));
});
test('visible SL tail: former third compatible prefix creates D without immediate J',()=>{
 let state=P.observe(fixture.observation);const first=R.replay(state,['L','L','L','HD']);assert(first.valid);assert.equal(first.events[0].type,'J');state=first.state;
 const witness=['HOLD','L','L','L','HD'],r=R.replay(state,witness);assert(r.valid);assert.equal(r.events[0].type,'O');
 const h=Array.from({length:4},(_,x)=>40-r.state.board.findIndex(row=>row[x]!=='.'));assert.deepEqual(h.map(v=>v-Math.min(...h)),[0,1,1,0]);
 assert.equal(P.dPatternAdmission(state,{state:r.state,event:r.events[0],witness},{now:()=>0,deadline:Infinity,maxNodes:8000}).reason,'D-created-without-immediate-J');
 assert.equal(r.state.active.type,'T');assert.equal(r.state.hold,'S');assert.deepEqual(r.state.queue,['L','I','O','T']);
});
test('visible SL tail comparator: no additional SL reward, identity substitution, delayed score or weakened quality',()=>{
 const {c,r,options}=pair();assert(P.visibleSLTailComparison(c,r,options).allowed);
 for(const change of [n=>n.assessment.leftContext.score=r.assessment.leftContext.score,n=>n.assessment.structure.left.covered++,n=>n.assessment.leftSealed++,n=>n.assessment.maxHeight=r.assessment.maxHeight+1,n=>n.centerContinuity--,n=>n.dependencyDebt++,n=>n.entryDebt++,n=>n.rank[3]=r.rank[3]-1,n=>n.slAllocation.paid[0].lId++,n=>n.slAllocation.paid=[]]){const bad=clone(c);change(bad);assert.equal(P.visibleSLTailComparison(bad,r,options).allowed,false);}
 const different=clone(options);different.candidateDraw.hold.id++;assert.equal(P.visibleSLTailComparison(c,r,different).reason,'unequal-observed-tail-inventory');
 const delayed=clone(c);[delayed.path[2],delayed.path[3]]=[delayed.path[3],delayed.path[2]];assert.equal(P.visibleSLTailComparison(delayed,r,options).reason,'score-or-original-goal-regression');
 const spentI=clone(c);spentI.path.at(-1).structuralEvidence.allocation='left-filler';assert.equal(P.visibleSLTailComparison(spentI,r,options).reason,'cleanup-progress-regression');
});
test('visible SL endpoint order: Center continuity and structural/scoring bands precede Left and effort',()=>{
 const {c}=pair(),center=clone(c),left=clone(c);center.centerContinuity=0;left.centerContinuity=-1;left.assessment.leftContext.score=999;assert(P.compareSLTail(center,left)<0,'a Center-support role is not discarded for a better Left surface');
 const score=clone(c);score.rank[4]++;score.assessment.leftContext.score=-999;assert(P.compareSLTail(score,c)<0);const effort=clone(c);effort.rank[6]+=100;effort.assessment.leftContext.score--;assert(P.compareSLTail(c,effort)<0);
});
test('visible SL tail unfinished enumeration retains the exact already selected five-lock SL admission',()=>{
 const off=plan(true);let clock=0,stopped=0;const api=moduleWith({'./st-rules.js':{...R,placements:(state,options)=>{if(state.active?.type==='O'&&state.hold==='I'&&JSON.stringify(state.queue)==='["T"]'){clock=1500;stopped++;return{placements:[],visited:19,complete:false};}return R.placements(state,options);}}});
 const a=api.plan(fixture.observation,opts({now:()=>clock,deadline:1500}));assert(stopped);assert.equal(a.metrics.ordinarySAllocation.visibleTail.selected,false);assert.deepEqual(noMetrics(a),noMetrics(off));assert.equal(a.continuation.length,5);assert(a.metrics.nodes<=45000);
});
test('visible SL tail failed strongest terminal proof cannot select a weaker challenger or lose the prior SL',()=>{
 const off=plan(true);let rejected=0;const api=moduleWith({'./st-obligation-resources.js':{...require('../st-obligation-resources'),checkPath:(raw,path,summary)=>{if(path.length===7){rejected++;return{valid:false,reason:'test-terminal-proof-rejected'};}return require('../st-obligation-resources').checkPath(raw,path,summary);}}});
 const a=api.plan(fixture.observation,opts());assert(rejected);assert.equal(a.metrics.ordinarySAllocation.visibleTail.selected,false);assert.deepEqual(noMetrics(a),noMetrics(off));
});
test('visible SL tail lifecycle: actual input and HOLD retain O→I cleanup after the L payment',()=>{
 let state=clone(fixture.observation),history=Current.importState(fixture.options.obligationContext,{position:state}),patterns=clone(fixture.options.patternHistory),advice=pair().a,locks=0,holds=0;const expected=advice.continuation.map(p=>p.event);
 while(advice){const before=clone(state),original=advice;for(const action of original.witness){const prior=state;state=R.move(state,action);history=Current.applyActual(history,{before:prior,action:action,after:state}).context;const options={...bounds,openingPhase:false,patternHistory:patterns,obligationContext:Current.exportState(history)};
  if(action==='HD'){assert.deepEqual(state.lastEvent,expected[locks]);locks++;patterns=H.update(patterns,prior,state,state.lastEvent);advice=P.continueCommitment(before,state,original,state.lastEvent,{...options,patternHistory:patterns});if(locks<expected.length)assert(advice,'lost actual tail after lock '+locks);if(locks===5){assert.deepEqual(advice.continuation.map(p=>p.event.type),['O','I']);assert.equal(P.resourceGoalPrefix(advice.continuation,advice.continuation),2);}}
  else{if(action==='HOLD')holds++;advice=P.advance(state,advice,action,options);assert(advice,'lost tail during '+action);}
 }}assert.equal(locks,7);assert(holds);assert.equal(state.active,null);assert.equal(state.hold,'T');assert.equal(CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)})).center.pending.length,0);
});
test('visible SL strongest endpoint ordering uses qualification changes and treats unknown as unknown',()=>{
 const {c}=pair(),initialLeader=clone(c),afterProofWinner=clone(c);initialLeader.rank[3]=20;afterProofWinner.rank[3]=10;const seen=[];
 const order=P.qualifiedSLTailOrder([initialLeader,afterProofWinner],n=>{seen.push(n);if(n===initialLeader)n.rank[3]=0;return true;});assert.equal(seen.length,2);assert.equal(order[0],afterProofWinner);
 assert.equal(P.qualifiedSLTailOrder([initialLeader,afterProofWinner],n=>n!==afterProofWinner),null);
});
test('visible SL unknown endpoint qualification preserves the private prior SL choice',()=>{
 const off=plan(true);let tail=false,unknown=0;const api=moduleWith({'./st-rules.js':{...R,placements:(state,options)=>{if(state.active?.type==='O'&&state.hold==='I'&&JSON.stringify(state.queue)==='["T"]')tail=true;return R.placements(state,options);},tDoubleAccess:(board,options)=>{if(tail){unknown++;return{complete:false,reachable:null,visited:7};}return R.tDoubleAccess(board,options);}}});
 const a=api.plan(fixture.observation,opts());assert(unknown);assert.equal(a.metrics.ordinarySAllocation.visibleTail.reason,'tail-qualification-unknown');assert.deepEqual(noMetrics(a),noMetrics(off));
});
