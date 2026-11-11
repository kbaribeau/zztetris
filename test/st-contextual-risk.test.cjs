'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),P=require('../st-planner'),C=require('../st-obligation-context'),M=require('../st-obligation-resources'),f=require('./fixtures/contextual-risk-S.json'),clone=x=>JSON.parse(JSON.stringify(x));
const root=()=>R.createState(f.observation),options=s=>({openingPhase:false,obligationContext:C.exportState(C.start(s)),depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity});
test('Public S context / finite support is checked independently of the retired D risk override',()=>{
 const s=root(),o=options(s),a=P.decide(s,o);assert(a.target,a.reason);assert.equal(a.recommendation.kind,'supported');assert(a.metrics.nodes<=45000);assert.equal(a.recommendation.hazards.some(h=>h.code.startsWith('D-')),false);assert(R.replay(s,a.continuation.flatMap(p=>p.witness)).valid);assert(M.checkPath(s,a.continuation,C.importState(o.obligationContext,{position:s})).valid);assert(P.revalidate(s,a,o));
});
test('Public S context / node-bounded Worker returns replayable checked advice',()=>{
 const s=root(),o=options(s),a=require('../scripts/lib/st-simulation.cjs').workerPlanner({disableSearchTimeout:true})(clone({type:'plan',id:92,observation:s,previous:null,commitment:null,options:{...o,timeMs:1500}}));assert(a.target,a.reason);assert.equal(a.recommendation.kind,'supported');assert(a.metrics.nodes<=45000);assert(R.replay(s,a.continuation.flatMap(p=>p.witness)).valid);assert(P.revalidate(s,a,o));
});
test('Public S context / exhausted budget cannot invent a supported route',()=>{
 const s=root();for(const patch of [{maxNodes:0},{deadline:0}]){const a=P.decide(s,{...options(s),...patch});assert.equal(a.target,null);assert.equal(a.continuation.length,0);assert(a.metrics.nodes<=(patch.maxNodes??45000));}
});
