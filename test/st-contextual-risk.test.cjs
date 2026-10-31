'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),RH=require('../st-resource-history'),f=require('./fixtures/contextual-risk-S.json'),clone=x=>JSON.parse(JSON.stringify(x));
const root=()=>R.createState(f.observation),options=s=>({openingPhase:false,resourceContext:RH.exportContext(s,RH.start(s)),depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});
let cached;function pair(){if(!cached){const s=root(),o=options(s);cached={s,o,supported:P.decide(s,{...o,disableContextualRisk:true}),risk:P.decide(s,o)};}return clone(cached);}
function harness(){const fs=require('fs'),path=require('path'),vm=require('vm'),filename=require.resolve('../st-planner'),m={exports:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8').replace('return Object.freeze({dPatternAdmission,','return Object.freeze({contextualRiskPreference,riskyFallback,'),{module:m,require:id=>require(path.resolve(path.dirname(filename),id)),Date,performance});return m.exports;}
function compare(changeState=s=>s,changeSupported=a=>a,extra={}){const q=pair(),s=changeState(q.s),o=options(s),support=changeSupported({...q.supported,metrics:{nodes:100}}),r=R.replay(s,q.risk.witness);assert(r.valid);const p={state:r.state,event:r.events[0],target:r.events[0].target,witness:q.risk.witness};return{support,result:harness().contextualRiskPreference(s,support,{...o,...extra},{key:null,placements:[p],complete:true})};}
test('contextual risk / excess public S can outrank supported HOLD while D remains explicit',()=>{
 const {s,supported,risk}=pair();assert.equal(supported.recommendation.kind,'supported');assert.equal(supported.target.type,'O');assert.equal(risk.target.type,'S');assert.equal(risk.recommendation.kind,'risky');assert.equal(risk.metrics.certifiedHorizon,0);assert.ok(risk.metrics.nodes<=45000);assert.equal(risk.metrics.supportedSearch.certifiedHorizon,supported.metrics.certifiedHorizon);
 assert.equal(risk.recommendation.search.saferAlternative,'supported-finite-alternative-ranked-lower');assert.equal(risk.evidence.riskComparison.excessBefore,2);assert.equal(risk.evidence.riskComparison.excessAfter,1);assert.match(risk.reason,/supported finite alternative was found/i);assert.doesNotMatch(risk.reason,/search did not certify one/);assert.ok(risk.recommendation.hazards.some(h=>h.code==='D-J-exit-unresolved'&&h.availability==='absent-from-public-supply'));assert.equal(risk.continuation.length,1);assert(R.replay(s,risk.witness).valid);
 assert.equal(P.revalidate(s,risk,options(s)),null);assert.equal(P.advance(s,risk,risk.witness[0],options(s)),null);
});
test('contextual risk / available L or only one S preserves supported alternative',()=>{
 for(const edit of [s=>({...s,queue:['I','L','S','Z','T','I']}),s=>({...s,queue:['I','O','O','Z','T','I']})]){const {support,result}=compare(edit);assert.deepEqual(result.target,support.target);assert.notEqual(result.recommendation?.kind,'risky');}
});
test('contextual risk / retained advice and commitments cannot be displaced',()=>{
 for(const edit of [a=>({...a,retained:true}),a=>({...a,evidence:{...a.evidence,commitmentRetained:true}}),a=>({...a,evidence:{...a.evidence,reservedPiecePlan:{}}})]){const {support,result}=compare(s=>s,edit);assert.deepEqual(result.target,support.target);}
 const {support,result}=compare(s=>s,a=>a,{commitment:{},maxNodes:45000});assert.deepEqual(result.target,support.target);
});
test('contextual risk / shared budget and malformed same-draw candidate retain incumbent',()=>{
 const q=compare(s=>s,a=>a,{deadline:0});assert.deepEqual(q.result.target,q.support.target);
 const {s,supported,risk}=pair(),r=R.replay(s,risk.witness),p={state:{...r.state,queue:['J']},event:r.events[0],witness:risk.witness};const out=harness().contextualRiskPreference(s,supported,options(s),{placements:[p],complete:true});assert.deepEqual(out.target,supported.target);
});
test('contextual risk / fresh Worker keeps shared budget and explicit supported comparison',()=>{
 const s=root(),o=options(s),worker=require('../scripts/lib/st-simulation.cjs').workerPlanner(),request={type:'plan',id:92,observation:s,previous:null,commitment:null,options:{...o,timeMs:1500}};
 const result=worker(clone(request));assert.equal(result.target.type,'S');assert.equal(result.recommendation.kind,'risky');assert.ok(result.metrics.nodes<=45000);assert.equal(result.recommendation.search.saferAlternative,'supported-finite-alternative-ranked-lower');
});
test('contextual risk / synthetic collector gate rejects higher Left hidden by taller Right',()=>{
 const {s,supported,risk}=pair();s.board[24]=s.board[24].slice(0,9)+'Z';const r=R.replay(s,risk.witness),board=r.state.board.slice();
 for(let x=0;x<4;x++){const y=board.findIndex(row=>row[x]!=='.');assert(y>0);board[y-1]=board[y-1].slice(0,x)+'S'+board[y-1].slice(x+1);}
 const candidate={...r.state,board},base=R.replay(s,supported.witness).state;
 assert.equal(P.assess(candidate.board).maxHeight,P.assess(base.board).maxHeight);assert(P.assess(candidate.board).left.height>P.assess(base.board).left.height);
 const p={state:candidate,event:r.events[0],witness:risk.witness},out=harness().contextualRiskPreference(s,supported,options(s),{placements:[p],complete:true});assert.deepEqual(out.target,supported.target);
});

test('contextual risk / authentic pending Center and covered repair obligations block override',()=>{
 const fixture=require('./fixtures/reserved-piece-plan.json');let s=R.createState(fixture.observation),history=RH.importContext(s,fixture.options.resourceContext),summary=RH.resolve(s,history);assert(require('../st-midgame-resources').start(s,summary).pendingCenter.length>0);
 const support=pair().supported,call=()=>harness().contextualRiskPreference(s,support,{...options(s),resourceContext:RH.exportContext(s,history)},{placements:[{}]});assert.deepEqual(call().target,support.target);
 for(const witness of fixture.witnesses.slice(0,2))for(const action of witness){const before=s;s=R.move(s,action);history=RH.applyAction(history,before,action,s);}
 summary=RH.resolve(s,history);assert(summary.coveredRepair.cells.length>0);assert.deepEqual(call().target,support.target);
});
test('contextual risk / certified immediate J exit is not misrepresented as unresolved D',()=>{
 const {s,supported,risk}=pair();s.hold='J';const r=R.replay(s,risk.witness);assert(r.valid);const p={state:r.state,event:r.events[0],witness:risk.witness,target:r.events[0].target};
 const result=harness().riskyFallback(s,{...supported,metrics:{nodes:100}},options(s),{placements:[p],complete:true},{excessBefore:2,excessAfter:1});
 assert.deepEqual(result.target,supported.target);assert.notEqual(result.recommendation.kind,'risky');assert.equal(result.metrics.riskFallback.rejections['no-unresolved-D-risk'],1);
});
