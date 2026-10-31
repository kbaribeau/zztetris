'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules'),F=require('../st-fixtures');
const clone=x=>JSON.parse(JSON.stringify(x)),same=s=>({...clone(s),revision:0});
function select(g,v){g.element('#st-fixture').value=v;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};return all;}
function request(g,all){g.advance(40);return all.at(-1).message;}
function importState(g,s){g.element('#st-snapshot').value=JSON.stringify(s);g.click('#st-import');}
function advice(s){const p=R.placements(s,{maxNodes:8000}).placements[0];assert.ok(p);return{status:'recommended-with-verified-prefix',target:p.target,witness:p.witness,hold:p.hold,holdCount:p.holdCount,continuation:[{target:p.target,witness:p.witness,event:p.event}],reason:'Test advice.'};}
test('undo: restores turn start including unlimited holds and movement, using configured key',()=>withPage('st-lab.html',{},g=>{
 select(g,'empty');const initial=g.snapshot();assert.equal(g.element('#st-undo').disabled,true);
 g.window.stLab.act('HOLD');g.window.stLab.act('HOLD');g.window.stLab.act('L');g.window.stLab.act('CW');g.window.stLab.act('HD');
 assert.equal(g.element('#st-undo').disabled,false);const revision=g.snapshot().revision;
 g.tap('KeyT');assert.deepEqual(same(g.snapshot()),same(initial));assert.ok(g.snapshot().revision>revision);assert.equal(g.element('#st-undo').disabled,true);
 assert.match(g.element('#st-key-help').textContent,/KeyT: undo/);
}));
test('undo: private future tape survives bag boundaries without rerolling or leaking to requests/exports',()=>withPage('st-lab.html',{seed:42},g=>{
 const all=workers(g);let calls=0,random=g.window.Math.random;g.window.Math.random=()=>{calls++;return random();};
 select(g,'empty');const initial=g.snapshot(),trace=[];
 for(let i=0;i<12;i++){
  const s=g.snapshot(),placements=R.placements(s,{maxNodes:2500}).placements.filter(p=>!p.state.topOut);
  placements.sort((a,b)=>Math.max(...a.state.board.map((r,y)=>r!=='.'.repeat(10)?40-y:0))-Math.max(...b.state.board.map((r,y)=>r!=='.'.repeat(10)?40-y:0)));
  assert.ok(placements.length);const p=placements[0];for(const action of p.witness)g.window.stLab.act(action);trace.push({witness:p.witness,after:g.snapshot()});
 }
 const generatedCalls=calls;for(let i=0;i<12;i++)g.window.stLab.act('UNDO');assert.deepEqual(same(g.snapshot()),same(initial));
 for(const step of trace){for(const action of step.witness)g.window.stLab.act(action);assert.deepEqual(same(g.snapshot()),same(step.after));}
 assert.equal(calls,generatedCalls,'revisiting generated bags must not call Math.random again');
 g.window.stLab.act('UNDO');g.window.stLab.act('HOLD');g.window.stLab.act('HD');assert.equal(calls,generatedCalls,'a different continuation reuses already generated private bags');
 const m=request(g,all);assert.equal(m.observation.queue.length,6);for(const key of ['future','futureCursor','history','turnStart'])assert.equal(key in m.observation,false);
 g.click('#st-export');assert.deepEqual(JSON.parse(g.element('#st-snapshot').value),{...g.snapshot(),suggestedFileName:'st-lab-coaching-export.json'});
}));
test('undo: line clears and top-out are reversible, including a consumed last active piece',()=>withPage('st-lab.html',{},g=>{
 const f=F.get('direct-double').observation;importState(g,f);const initial=g.snapshot();
 const p=R.placements(initial,{maxNodes:12000}).placements.find(p=>p.event.lines===2&&p.event.spin==='full');assert.ok(p);
 for(const action of p.witness)g.window.stLab.act(action);g.click('#st-undo');assert.deepEqual(same(g.snapshot()),same(initial));
 const board=R.emptyBoard();board[20]='XXXXXXXXX.';importState(g,R.createState({board,active:'O',queue:[]}));const topOrigin=g.snapshot();g.window.stLab.act('HD');assert.equal(g.snapshot().topOut,true);assert.equal(g.snapshot().active,null);
 g.window.stLab.act('UNDO');assert.deepEqual(same(g.snapshot()),same(topOrigin));assert.equal(g.snapshot().topOut,false);
}));
test('undo: mode, restart and import discard history; no redo action is offered',()=>withPage('st-lab.html',{},g=>{
 for(const reset of [()=>g.click('#st-reset'),()=>select(g,'empty'),()=>importState(g,F.get('direct-double').observation)]){
  g.window.stLab.act('HD');assert.equal(g.element('#st-undo').disabled,false);reset();const s=g.snapshot();assert.equal(g.element('#st-undo').disabled,true);g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot(),s);
 }
 assert.equal(g.window.document.querySelector('[data-action="REDO"]'),null);assert.equal(g.element('#st-fixture').options.length,2);
}));
test('undo: cancels stale workers, restores opening session and sends saved proof for fresh validation',()=>withPage('st-lab.html',{},g=>{
 const all=workers(g);g.click('#st-reset');const first=request(g,all),plan=advice(first.observation);
 g.window.STPlanner={...g.window.STPlanner,resourceGoal:()=>true,cycleResources:()=>({tsds:1,quads:0,pocket:0}),continueCommitment:()=>null};all.at(-1).respond(plan);
 const origin=g.snapshot();for(const action of plan.witness)g.window.stLab.act(action);request(g,all);const stale=all.at(-1),stalePlan=advice(stale.message.observation);
 g.window.stLab.act('UNDO');assert.equal(stale.terminated,true);const restored=request(g,all);assert.deepEqual(same(restored.observation),same(origin));assert.deepEqual(restored.commitment.advice,plan);assert.equal(restored.previous,null);
 stale.respond(stalePlan);assert.equal(g.window.stLab.result,null,'old advice cannot reappear before restored request is checked');
 select(g,'empty');request(g,all);g.window.stLab.act('HD');request(g,all);g.window.stLab.act('UNDO');const empty=request(g,all);assert.equal(empty.options.openingPhase,true);assert.equal(empty.options.openingClear,null);
}));
test('undo: a real saved cycle route is revalidated rather than displayed from history',()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),all=workers(g);g.window.stLab.loadFixture('o-before-double');const first=request(g,all);
 const plan=P.decide(first.observation,{...first.options,timeMs:undefined});assert.ok(plan.target,plan.reason);const goals=P.cycleResources(plan.continuation);assert.ok(goals.tsds+goals.quads+goals.pocket>0);all.at(-1).respond(plan);
 for(const action of plan.witness)g.window.stLab.act(action);g.window.stLab.act('UNDO');const restored=request(g,all);assert.ok(restored.commitment);
 const checked=P.decide(restored.observation,{...restored.options,timeMs:undefined,previous:restored.previous,commitment:restored.commitment});assert.ok(checked.target,checked.reason);assert.ok(R.replay(restored.observation,checked.witness).valid);
 assert.ok(P.cycleResources(checked.continuation).tsds>0);assert.equal(g.window.stLab.result,null);all.at(-1).respond(checked);assert.deepEqual(clone(g.window.stLab.result.target),checked.target);
}));
test('undo: actual opening scoring clear and checked handoff can be undone back into opening',()=>withPage('st-lab.html',{},g=>{
 const P=require('../st-planner'),f=require('./support/st-undo-opening.json'),all=workers(g);
 // Feed the recorded private bags through the real UI generator, not through planner input.
 const randomValues=[];for(const desired of f.bags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);assert.ok(j<=i);randomValues.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>{assert.ok(randomValues.length);return randomValues.shift();};select(g,'empty');
 for(const witness of f.witnesses)for(const action of witness)g.window.stLab.act(action);
 const after=request(g,all);assert.deepEqual(same(after.observation),same(f.afterClear));assert.equal(after.options.openingClear.event.lines,2);
 assert.equal(g.element('#st-phase-name').textContent,'Opening','the actual clear alone does not finish the opening');
 const handoff=P.decide(after.observation,{...after.options,timeMs:undefined});assert.equal(handoff.phase,'maintenance');assert.equal(handoff.evidence.openingHandoff.status,'checked-after-actual-clear');all.at(-1).respond(handoff);
 assert.equal(g.element('#st-fixture').value,'empty','coaching phase can change without changing play mode');
 assert.equal(g.element('#st-phase').dataset.phase,'maintenance');assert.equal(g.element('#st-phase-name').textContent,'Mid-game');
 g.window.stLab.act('UNDO');const before=request(g,all);assert.deepEqual(same(before.observation),same(f.beforeClear));assert.equal(before.options.openingPhase,true);assert.equal(before.options.openingClear,null);assert.equal(before.commitment,null);
 assert.equal(g.element('#st-phase').dataset.phase,'opening');assert.equal(g.element('#st-phase-name').textContent,'Opening');
 for(const action of f.witnesses.at(-1))g.window.stLab.act(action);const again=request(g,all);assert.deepEqual(same(again.observation),same(f.afterClear));assert.equal(again.options.openingClear.event.lines,2);
 all.at(-1).respond(P.decide(again.observation,{...again.options,timeMs:undefined}));assert.equal(g.element('#st-phase-name').textContent,'Mid-game');
 g.click('#st-reset');assert.equal(g.element('#st-phase-name').textContent,'Opening','restart restores the opening origin');
}));

test('undo: configured binding is honored and held movement timers are cancelled',()=>withPage('st-lab.html',{storage:{config:JSON.stringify(['ArrowLeft','ArrowRight','ArrowDown','Space','ShiftLeft','KeyX','KeyZ','KeyC','KeyR','KeyU','KeyY','160','30','15','20','100'])}},g=>{
 const initial=g.snapshot();g.window.stLab.act('HD');const locked=g.snapshot();g.tap('KeyT');assert.deepEqual(g.snapshot(),locked);
 g.key('keydown','ArrowLeft');g.tap('KeyU');const restored=g.snapshot();assert.deepEqual(same(restored),same(initial));g.advance(1000);assert.deepEqual(g.snapshot(),restored);g.key('keyup','ArrowLeft');
 assert.match(g.element('#st-key-help').textContent,/KeyU: undo/);
}));
