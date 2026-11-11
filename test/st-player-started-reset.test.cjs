'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),C=require('../st-obligation-context'),Provider=require('../st-resource-provider'),M=require('../st-obligation-resources'),Policy=require('../st-reset-policy'),Session=require('../st-session');
const player=require('./support/current-player.cjs'),{withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),left=['L','L','L','HD'],f=require('./support/st-reset-live-cycle.json');
function trial(until=24){const source=require('./support/st-resource-trial-1.json'),x=player(source.initial);for(const step of source.steps){if(x.locks===until)break;x.act(step.action,step.revealed);}return x;}
const facts=x=>C.resolve(x.context,{position:x.position});
const firstWitness=f.steps[0].actions.map(a=>a.action);
function imported(g,value){g.element('#st-snapshot').value=JSON.stringify(value);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/i);}

test('player Reset: declined ordinary control recognizes the first Left T without a selected marker',()=>{
 const x=trial(),before=C.exportState(x.context),input=Provider.prepare(x.position,{obligationContext:before});
 assert.ok(['ordinary-preferred','ordinary-rebuild-preferred'].includes(Policy.consider(x.position,facts(x)).status));
 const projected=Provider.project(input,{witness:left}),route=M.start(x.position,x.context),replay=R.replay(x.position,left),assessed=M.step(x.position,{...replay,event:replay.events[0],witness:left},route);
 assert.ok(assessed.violations.includes('ordinary-T-must-score'),'Observed projection must not authorize ordinary non-scoring Ts');
 const id=x.inventory.active.id;x.lock(left);
 assert.equal(x.context.status,'available',x.context.reason);assert.deepEqual(facts(x).reset,{status:'active',progress:1});assert.equal(facts(x).extraZ.remaining,1);assert.equal(facts(x).profileLost,false);
 assert.deepEqual(x.last.effects.filter(e=>e.status.startsWith('reset-')).map(e=>e.status),['reset-started','reset-T-observed','reset-T-credited']);assert.equal(x.state.account.reset.firstTId,id);
 assert.deepEqual(Provider.facts(projected).reset,{...facts(x).reset,inheritedCovered:x.state.account.reset.inheritedCovered});assert.equal(Provider.facts(projected).extraZ.remaining,1);
 assert.deepEqual(before.state.account.reset,{status:'inactive'},'Pure projection leaves its actual root unchanged');
 const restored=C.restore(C.snapshot(x.context,{position:x.position}));assert.deepEqual(restored.context,x.context);
});

test('player Reset: early balance is conserved, and selected-marker and observed paths preserve the same unrelated duties',()=>{
 const raw=clone(f.obligationContext),known=player(f.initial,{snapshot:raw});known.begin();for(const a of f.steps[0].actions)known.act(a.action,a.revealed);
 raw.state.account.z.remaining=1;const early=player(f.initial,{snapshot:raw});assert.equal(Policy.consider(early.position,facts(early)).status,'ordinary-preferred');
 for(const a of f.steps[0].actions)early.act(a.action,a.revealed);
 assert.equal(facts(early).extraZ.remaining,2);assert.equal(facts(early).reset.progress,1);
 for(const key of ['sl','center','leftGoals','safety','dPending'])assert.deepEqual(early.state[key],known.state[key],key+' is not cleared by observed entry');
 assert.deepEqual(early.inventory,known.inventory);
});

test('player Reset: opening Ts and ambiguous position-only imports do not invent an episode or Z history',()=>{
 const x=trial(0),source=require('./support/st-resource-trial-1.json');let ts=0;
 for(const step of source.steps){if(x.locks===14)break;x.act(step.action,step.revealed);if(step.action==='HD'){if(x.position.lastEvent.type==='T')ts++;assert.equal(facts(x).reset.status,'inactive');}}
 assert.equal(ts,2);
 const unknown=player(f.initial,{fresh:false});unknown.lock(firstWitness);assert.equal(facts(unknown).reset.status,'inactive');assert.equal(facts(unknown).extraZ.remaining,null);assert.equal(facts(unknown).availability,'unknown');
});

test('player Reset: explicit unknown-origin handoff tracks both Ts without inventing numeric credit',()=>{
 const x=player(f.initial,{fresh:false});x.handoff();const effects=[];
 for(const step of f.steps)for(const a of step.actions){x.act(a.action,a.revealed);effects.push(...x.last.effects);}
 assert.equal(x.context.status,'available',x.context.reason);assert.equal(effects.filter(e=>e.status==='reset-started').length,1);assert.equal(effects.filter(e=>e.status==='reset-T-observed').length,2);assert.equal(effects.filter(e=>e.status==='reset-T-credited').length,0);assert.equal(effects.filter(e=>e.status==='reset-completed').length,1);
 assert.deepEqual(facts(x).extraZ,{status:'unknown',baseline:false,remaining:null});assert.equal(facts(x).availability,'unknown');assert.equal(x.state.account.allocationVerified,false);
});

test('player Reset: observed unknown-origin TSD establishes a boundary, not an opening allowance',()=>{
 const source=require('../st-fixtures').get('direct-double').observation,position=R.migrateState({...source,queue:['T','I'],bag:null}),x=player(position,{fresh:false});
 const score=R.placements(position,{maxNodes:12000}).placements.find(p=>p.event.lines===2&&p.event.spin==='full');assert.ok(score);x.lock(score.witness);
 assert.equal(facts(x).firstTsd,true);assert.equal(x.state.account.allocationVerified,false);assert.equal(facts(x).extraZ.remaining,null);
 x.lock(left);assert.equal(facts(x).reset.progress,1);assert.equal(facts(x).extraZ.remaining,null);assert.equal(Policy.consider(x.position,facts(x)).status,'unknown-history');
 const saved=Session.create(x.position,{obligationContext:C.exportState(x.context)}),prepared=Session.prepare(saved);assert.deepEqual(prepared.obligationContext.state.account,x.state.account);
});

test('player Reset: non-Left, line-clearing, and terminal T locks do not start Reset',()=>{
 const x=trial();x.lock(['HD']);assert.equal(facts(x).reset.status,'inactive');assert.equal(facts(x).extraZ.remaining,0);
 const y=trial(),source=require('./support/st-resource-trial-1.json');let locks=0;for(const step of source.steps){if(locks===24)y.act(step.action,step.revealed);if(step.action==='HD')locks++;if(locks===25)break;}assert.equal(y.position.lastEvent.lines,2);assert.equal(facts(y).reset.status,'inactive');assert.equal(facts(y).extraZ.remaining,0);
 const O=require('../st-opening-obligations'),account=clone(f.obligationContext.state.account),empty=R.emptyBoard();
 for(const event of [{lines:1,clearedRows:[39],topOut:false},{lines:0,clearedRows:[],topOut:true}]){const out=O.transition(account,{kind:'lock',piece:{id:1000,type:'T',bag:100},event:{type:'T',cells:[[0,38],[1,38],[2,38],[1,39]],spin:'none',...event},centerEffects:[]},{before:{board:empty},after:{board:empty,topOut:event.topOut,coveredCells:[],center:{pending:[],debt:[]},sl:{hangingS:{status:'none-observed'},hangingL:{status:'none-observed'}}}});assert.equal(out.state.reset.status,'inactive');assert.equal(out.state.z.remaining,0);}
});

test('player Reset UI: advice-hidden manual entry, import, Undo and replay retain exactly one first-T credit',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 imported(g,Session.create(f.initial,{obligationContext:f.obligationContext}));const initial=clone(g.window.stLab.exportSession()),events=[];g.window.stLab.onTrackingEvent(e=>events.push(e));
 for(const a of firstWitness)g.window.stLab.act(a);
 assert.equal(g.element('#st-phase-name').textContent,'Reset');assert.match(g.element('#st-reset-summary').textContent,/1 of 2/);assert.equal(g.window.stLab.resources.extraZ.remaining,1);assert.equal(g.window.stLab.resources.reset.progress,1);assert.deepEqual(events,[]);
 const after=clone(g.window.stLab.exportSession());g.window.stLab.act('UNDO');assert.equal(g.element('#st-phase-name').textContent,'Mid-game');assert.deepEqual(clone(g.window.stLab.obligationContext.state),initial.coaching.obligationContext.state);
 for(const a of firstWitness)g.window.stLab.act(a);assert.equal(g.window.stLab.resources.extraZ.remaining,1);assert.deepEqual(clone(g.window.stLab.obligationContext.state),after.coaching.obligationContext.state);
 imported(g,after);assert.equal(g.element('#st-phase-name').textContent,'Reset');assert.equal(g.window.stLab.resources.reset.progress,1);assert.equal(g.window.stLab.resources.extraZ.remaining,1);g.click('#st-reset');assert.equal(g.window.stLab.resources.reset.progress,1);
}));

test('player Reset UI: unknown observed balance says unknown rather than null',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 const x=player(f.initial,{fresh:false});x.handoff();imported(g,Session.create(x.position,{obligationContext:C.exportState(x.context)}));
 for(const a of firstWitness)g.window.stLab.act(a);
 assert.equal(g.element('#st-phase-name').textContent,'Reset');assert.match(g.element('#st-reset-summary').textContent,/balance: unknown/);assert.match(g.element('#st-extra-z-detail').textContent,/earlier Z balance unknown/);assert.equal(g.window.stLab.resources.extraZ.remaining,null);
 const before=clone(g.window.stLab.exportSession());imported(g,before);assert.equal(g.window.stLab.resources.reset.progress,1);assert.equal(g.window.stLab.resources.extraZ.remaining,null);
}));

test('player Reset: out-of-profile and unknown facts do not bypass Reset advice admission',()=>{
 const P=require('../st-planner');
 for(const unknown of [false,true]){
  const x=player(f.initial,unknown?{fresh:false}:{snapshot:f.obligationContext});if(unknown)x.handoff();x.lock(firstWitness);
  const raw=C.exportState(x.context);if(!unknown)raw.state.account.profile.departure=true;
  const current=C.importState(raw,{position:x.position}),summary=C.resolve(current,{position:x.position}),decision=Policy.consider(x.position,summary);
  assert.equal(summary.reset.status,'active');assert.equal(decision.status,unknown?'unknown-history':'out-of-profile');
  const advice=P.decide(x.position,{obligationContext:raw,maxNodes:0});assert.equal(advice.target,null);assert.equal(advice.evidence.strategy,'reset-coach');assert.equal(advice.evidence.reset.progress,1);assert.equal(advice.evidence.resetSelection.status,decision.status);assert.match(advice.reason,/Reset is observed/);
 }
});
