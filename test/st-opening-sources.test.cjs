'use strict';
const {SEARCH_TIME_MS}=require('../st-coach-config');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),B=require('../st-bag'),P=require('../st-planner'),O=require('../st-opening-sources'),D=require('../st-opening-patterns'),Sim=require('../scripts/lib/st-simulation.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
// These cases exercise actual opening proofs. Supply live phase independently
// so proof-corruption checks do not short-circuit at the ordinary-mode boundary.
const retainOpening=(state,advice,opts={})=>P.revalidate(state,advice,{openingPhase:true,...opts});
const advanceOpening=(state,advice,action,opts={})=>P.advance(state,advice,action,{openingPhase:true,...opts});
function initial(bag){return R.createState({active:bag[0],queue:[...bag.slice(1)],streamCursor:1,revision:1,bag:B.fromObserved({observed:[...bag],startPhase:0})});}
function options(state,extra={}){const opening=P.startOpeningSession(state,{emptyMode:true});return{openingPhase:true,openingSource:opening.source,maxNodes:45000,timeMs:SEARCH_TIME_MS,...extra};}
function input(bag,seed=1){const base=Sim.makeInput('empty',seed,32);return{...base,initial:Sim.publicObservation(initial(bag)),future:[...'IJLOSTZ'.repeat(40)]};}
function literalBoard(rows){return Array(40-rows.length).fill('..........').concat(rows);}
const buri01=literalBoard(['....LLL...','.T..LSS...','.TT.SS...Z','.TJJJOO.ZZ','IIIIJOO.Z.']);
test('source opening: eight full diagrams and compact immutable facts exclude partial cells and extra occupancy',()=>{
 assert.equal(D.patterns.length,8);assert.deepEqual(O.pattern('buri-01').board,buri01);
 assert.equal(O.compatible(buri01,'buri-01')[0].mask,127);
 for(const [x,y,value]of [[6,37,'I'],[7,39,'I'],[0,39,'.'],[0,39,'Z']]){const board=buri01.slice(),row=[...board[y]];row[x]=value;board[y]=row.join('');assert.equal(O.compatible(board,'buri-01').length,0);}
 const meta=O.pattern('buri-01');meta.board[39]='..........';meta.targets.I[0][0]=9;assert.deepEqual(O.pattern('buri-01').board,buri01);assert.equal(Object.isFrozen(D.patterns[0].edges[0]),true);
 assert.ok(fs.statSync(require.resolve('../st-opening-patterns')).size<40000);
});
test('source opening: eligibility starts only in the observed empty known first-bag session',()=>{
 const s=initial('IJLOSTZ');assert.equal(O.eligible(s),true);assert.deepEqual(P.startOpeningSession(s,{emptyMode:true}).source,{pattern:null});assert.equal(P.startOpeningSession(s).source,null);
 const unknown=clone(s);unknown.bag=B.fromObserved({observed:['I',...s.queue]});assert.equal(O.eligible(unknown),false);assert.equal(P.startOpeningSession(unknown,{emptyMode:true}).source,null);
 const imported=clone(s);imported.board[39]='IIII......';assert.equal(P.startOpeningSession(imported,{emptyMode:true}).source,null);
});
test('source opening: visible discovery never fabricates an eighth type or executable terminal HOLD',()=>{
 for(const bag of ['IJLOSTZ','ZOTLJSI','TLSZOJI','LSOIJZT']){const s=initial(bag),r=O.solve(s,{maxNodes:45000});assert.ok(r.candidate,bag);let current=s;
  for(const step of r.candidate.steps){const replay=R.replay(current,step.witness);assert.ok(replay.valid);assert.deepEqual(replay.events[0],step.event);assert.deepEqual(replay.state.board,step.board);current=replay.state;}
  assert.equal(current.active,null);assert.equal(current.queue.length,0);if(r.candidate.pending){assert.equal(r.candidate.pending.type,current.hold);assert.equal(r.candidate.pending.to,127);}else assert.equal(O.compatible(current.board,r.candidate.id)[0].mask,127);
 }
});
test('source opening: nine actual first bags reach full B at seven locks while phase remains opening',()=>{
 for(const bag of ['IJLOSTZ','ZOTLJSI','TLSZOJI','LSOIJZT','IOTJSLZ','JSLIOTZ','OTJSLZI','SZLJITO','ZTLSOJI']){
  const session=Sim.createSession(input(bag));let family=null;
  for(let lock=1;lock<=7;lock++){const req=session.request(lock,{...Sim.CONFIG,timeMs:undefined}),a=P.decide(req.observation,req.options);assert.ok(a.evidence.opening.sourcePlan,bag+' lock '+lock);const id=a.evidence.opening.sourcePlan.id;if(family)assert.equal(id,family);family=id;
   for(const step of a.continuation)assert.ok(R.replay(req.observation,a.continuation.slice(0,a.continuation.indexOf(step)+1).flatMap(p=>p.witness)).state.active,'no terminal prefix advertised');
   const actual=session.execute(a);assert.ok(actual.actions.filter(x=>x.action!=='HD').every(x=>x.adviceAdvanced),bag+' exact inputs retain their target');
  }
  assert.equal(O.compatible(session.state.board,family)[0].mask,127,bag);assert.equal(session.opening.active,true);if(['buri-01','buri-02'].includes(family)){assert.equal(session.opening.source.continuationFrom,family);assert.equal(session.opening.source.history.steps.length,7);}else assert.equal(session.opening.source,null);assert.equal(session.opening.clear,null);
 }
});
test('source opening: exact source advice survives actual witnessed movement, HOLD, refill and worker revalidation',()=>{
 const session=Sim.createSession(input('ZOTLJSI')),req=session.request(1,Sim.CONFIG),a=P.decide(req.observation,req.options);assert.ok(a.evidence.opening.sourcePlan);
 let state=R.createState(req.observation),shown=a,future=[...'IJLOSTZ'];
 for(const action of a.witness.slice(0,-1)){state=R.move(state,action);while(state.queue.length<6){const type=future.shift();state={...state,queue:[...state.queue,type],bag:B.consume(state.bag,type)};}const next=advanceOpening(state,shown,action);assert.ok(next,action);assert.deepEqual(next.target,a.target);assert.equal(next.evidence.opening.sourcePlan.id,a.evidence.opening.sourcePlan.id);shown=next;}
 const retained=retainOpening(state,{...shown,metrics:{...shown.metrics,certifiedHorizon:99}},{maxNodes:45000,timeMs:SEARCH_TIME_MS});assert.ok(retained);assert.deepEqual(retained.target,a.target);assert.equal(retained.metrics.certifiedHorizon,retained.continuation.length);
});
test('source opening: wrong input, stale inventory, altered board, goal and forged proof fail retention',()=>{
 const s=initial('IJLOSTZ'),a=P.plan(s,options(s));assert.ok(a.evidence.opening.sourcePlan);
 assert.equal(advanceOpening(s,a,'HD'),null);const wrong=clone(s);wrong.hold='T';assert.equal(retainOpening(wrong,a),null);
 const bag=clone(s);bag.bag.remaining=[1];assert.equal(retainOpening(bag,a),null);
 const board=clone(s);board.board[39]='X.........';assert.equal(retainOpening(board,a),null);
 const forged=clone(a);forged.evidence.opening.sourcePlan.steps[0].event.cells[0][0]++;assert.equal(retainOpening(s,forged),null);
 const family=clone(a);family.evidence.opening.sourcePlan.id='not-a-source';assert.equal(retainOpening(s,family),null);assert.equal(retainOpening(s,a,{openingSource:{pattern:'not-the-retained-family'}}),null);
 const target=clone(a);target.target.x++;target.evidence.opening.sourcePlan.steps[0].target.x++;target.continuation[0].target.x++;assert.equal(retainOpening(s,target),null);
 const flags=clone(a);flags.hold=!flags.hold;assert.equal(retainOpening(s,flags),null);
 const metadata=clone(a);metadata.continuation[0].witness=['HD'];assert.equal(retainOpening(s,metadata),null);
 const invalid=clone(s);invalid.bag.remaining=[];const invalidProof=clone(a);invalidProof.evidence.opening.sourcePlan.origin.bag.remaining=[];assert.equal(retainOpening(invalid,invalidProof),null);
 const legacy=clone(s);legacy.rules=R.LEGACY_PROFILE.id;const legacyProof=clone(a);legacyProof.evidence.opening.sourcePlan.origin.rules=R.LEGACY_PROFILE.id;assert.equal(retainOpening(legacy,legacyProof),null);
 const tracker={nodes:0},late=clone(a);late.evidence.opening.sourcePlan.steps.at(-1).board[39]='..........';late.continuation.at(-1).board[39]='..........';assert.equal(retainOpening(s,late,{budgetTracker:tracker}),null);assert.ok(tracker.nodes>0,'failed replay work is charged before fallback');

});
test('source opening: held same-letter actual pieces and manual HOLD do not imply an identity swap',()=>{
 const board=buri01.map(row=>row.replaceAll('T','.')),s=R.createState({board,active:'T',hold:'T',queue:[...'IJLOSZ'],streamCursor:8,bag:B.fromObserved({observed:[...'IJLOSTZT'],startPhase:0})});
 const opts={openingPhase:true,openingSource:{pattern:'buri-01'},maxNodes:45000,timeMs:SEARCH_TIME_MS};
 const a=P.plan(s,opts),held=R.move(s,'HOLD'),b=P.plan(held,opts);assert.ok(a.evidence.opening.sourcePlan);assert.ok(b.evidence.opening.sourcePlan);assert.deepEqual(a.target,b.target);assert.equal(held.streamCursor,s.streamCursor);assert.equal(held.revision,s.revision+1);
 assert.deepEqual(R.replay(s,a.witness).state.board,buri01);assert.deepEqual(R.replay(held,b.witness).state.board,buri01);
});
test('source opening: unknown access and exhausted budgets never become source recommendations',()=>{
 const s=initial('IJLOSTZ');assert.equal(P.plan(s,options(s,{maxNodes:0,timeMs:0})).target,null);assert.equal(O.solve(s,{maxNodes:1}).unknown,true);
 const module={exports:{}},filename=require.resolve('../st-opening');vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:id=>id==='./st-planner'?{...P,checkAccessPrefix:()=>({reachable:null,visited:1})}:require(id.replace('./','../')),Date,performance});
 const a=module.exports.plan(s,options(s,{maxNodes:3000,timeMs:undefined}));assert.equal(a.evidence?.opening?.sourcePlan,undefined);
});
test('source opening: pending repairs, unknown imports and exact full goals keep the ordinary lifecycle',()=>{
 const s=initial('IJLOSTZ'),a=P.plan(s,options(s,{openingRepair:{invalid:true}}));assert.equal(a.evidence?.opening?.sourcePlan,undefined);
 const imported=P.startOpeningSession(s),b=P.plan(s,{openingPhase:true,openingSource:imported.source,maxNodes:4000});assert.equal(b.evidence?.opening?.sourcePlan,undefined);
 const whole=R.createState({board:buri01,active:'T',queue:[...'IJLOSZ']});const r=O.solve(whole,{preferredId:'buri-01'});assert.equal(r.candidate.status,'exact-goal');assert.deepEqual(r.candidate.steps,[]);
});
test('source opening: source-family priority is deterministic and hidden future fields cannot affect it',()=>{
 const s=initial('TLSZOJI'),a=O.solve(s),b=O.solve({...s,hiddenQueue:['I','I'],future:['Z'],seed:99});assert.deepEqual(a,b);
 const id=a.candidate.id,off=clone(s);off.board[39]='X.........';assert.equal(O.solve(off,{preferredId:id}).candidate,null);
 assert.equal(O.solve(s,{preferredId:'missing-source'}).candidate,null);
});

test('source opening: actual fresh classic worker loads compact data and completes a full source pattern',()=>{
 const session=Sim.createSession(input('TLSZOJI')),planner=Sim.workerPlanner();let family;
 for(let lock=1;lock<=7;lock++){const req=session.request(lock,Sim.CONFIG),a=planner(req);assert.ok(a.evidence.opening.sourcePlan);family??=a.evidence.opening.sourcePlan.id;assert.equal(a.evidence.opening.sourcePlan.id,family);session.execute(a);}
 assert.equal(O.compatible(session.state.board,family)[0].mask,127);assert.equal(session.opening.active,true);
});

test('source opening: retention rederives remaining inventory feasibility and refreshes pending metadata',()=>{
 const s=initial('IJLOSTZ'),a=P.plan(s,options(s)),short=clone(a),starved=clone(s);
 starved.queue=Array(6).fill('I');short.evidence.opening.sourcePlan.origin=clone(starved);short.evidence.opening.sourcePlan.steps=short.evidence.opening.sourcePlan.steps.slice(0,1);short.continuation=short.continuation.slice(0,1);
 const budgetTracker={nodes:0};assert.equal(retainOpening(starved,short,{budgetTracker,maxNodes:45000}),null);assert.ok(budgetTracker.nodes>short.witness.length);
 const stale=clone(a);stale.evidence.opening.sourcePlan.pending={kind:'invented-future',type:'X',spawnWitness:['HD']};
 const retained=retainOpening(s,stale,{maxNodes:45000,timeMs:SEARCH_TIME_MS});assert.ok(retained);assert.notEqual(retained.evidence.opening.sourcePlan.pending?.kind,'invented-future');assert.notEqual(retained.evidence.opening.sourcePlan.pending?.type,'X');assert.deepEqual(retained.target,a.target);
});

test('source opening: final access rejection clears source selection without erasing attempted work',()=>{
 const A=require('../st-access'),state=R.createState({active:'O',queue:['I']}),r=R.replay(state,['HD']);assert.ok(r.valid);
 const supplied={status:'recommended-with-verified-prefix',target:r.events[0].target,witness:['HD'],continuation:[{witness:['HD'],event:r.events[0]}],metrics:{nodes:100,sourceConstruction:{nodes:100,selected:true,verifiedLocks:1},usage:{scope:'opening',selected:{path:'verified-source-pattern'},families:{sourcePattern:{selected:1,nodes:100}}}},evidence:{opening:{sourcePlan:{id:'controlled-provider'}}}};
 for(const reachable of [true,false,null]){const module={exports:{}},access={...A,prefix:()=>({reachable,visited:7})};
  vm.runInNewContext(fs.readFileSync(require.resolve('../st-planner'),'utf8'),{module,require:id=>id==='./st-access.js'?access:id==='./st-opening.js'?{plan:()=>clone(supplied)}:require(id.replace('./','../')),Date,performance});
  const result=module.exports.plan(state,{maxNodes:150,deadline:Infinity});assert.equal(Boolean(result.target),reachable===true);assert.equal(result.metrics.sourceConstruction.selected,reachable===true);assert.equal(result.metrics.usage.families.sourcePattern.selected,Number(reachable===true));assert.equal(result.metrics.usage.selected?.path??null,reachable===true?'verified-source-pattern':null);assert.equal(result.metrics.nodes,107);assert.equal(result.metrics.sourceConstruction.verifiedLocks,1);if(reachable!==true)assert.equal(result.evidence.opening,undefined);
 }
});


test('source opening: an authentic source proof cannot retain after an explicit ordinary-phase boundary',()=>{
 const state=initial('IJLOSTZ'),opts=options(state,{now:()=>0,deadline:Infinity}),a=P.plan(state,opts);assert.ok(a.evidence.opening.sourcePlan);assert.ok(P.revalidate(state,a,opts));
 const action=a.witness[0];assert.notEqual(action,'HD');const moved=R.move(state,action);assert.notEqual(moved,state);assert.ok(P.advance(moved,a,action,opts));
 assert.equal(P.revalidate(state,a),null);assert.equal(P.advance(moved,a,action),null);
 for(const boundary of [{openingPhase:false},{openingPhase:undefined},{disableOpening:true}]){
  assert.equal(P.revalidate(state,a,{...opts,...boundary}),null);
  assert.equal(P.advance(moved,a,action,{...opts,...boundary}),null);
 }
});
