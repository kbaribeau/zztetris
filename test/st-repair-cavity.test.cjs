'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources'),P=require('../st-planner'),PH=require('../st-pattern-history'),f=require('./fixtures/repair-cavity.json');
test('repair admission: visible S repair cannot promise a newly sealed first-move cavity',()=>{
 const q=f.request,s=q.observation,h=CurrentProvider.facts(CurrentProvider.prepare(s,{obligationContext:Current.exportState(Current.importState(q.options.obligationContext,{position:s}))})),resource=M.start(s,Current.importState(q.options.obligationContext,{position:s})),notches=PH.resolve(s,q.options.patternHistory);
 const bad=R.replay(s,f.rejectedWitness);assert.equal(bad.valid,true);assert.equal(bad.events.length,1);
 assert.deepEqual(P.cavityRepairDebt(P.assess(s.board),P.assess(bad.state.board),bad.events[0]),f.newCavity);
 const proof=M.repair(s,resource,{maxNodes:4000,deadline:Infinity,notches});
 if(proof.valid){let before=s;for(const p of proof.path){assert.deepEqual(P.cavityRepairDebt(P.assess(before.board),P.assess(p.state.board),p.event),[],'Every proposed repair lock must pass ordinary newly-sealed-cell admission');before=p.state;}}
 else assert.ok(['no-visible-resource-repair','resource-repair-budget'].includes(proof.status));
});
