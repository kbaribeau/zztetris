'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs'),R=require('../st-rules');
const clone=x=>JSON.parse(JSON.stringify(x));
const badge=(g,id,status,observed)=>{
 const el=g.element('#'+id);
 assert.equal(el.dataset.state,status);assert.equal(el.dataset.observed,String(observed));
 assert.equal(el.hidden,false);assert.equal(el.tabIndex,0);
 assert.equal(el.getAttribute('role'),'status');assert.equal(el.getAttribute('aria-live'),'polite');
 assert.equal(el.getAttribute('aria-describedby'),id+'-detail');
 assert.equal(g.element('#'+id+'-piece').hidden,status==='out-of-profile');
 assert.equal(g.element('#'+id+'-symbol').textContent,status==='unknown'?'?':status==='out-of-profile'?'≠':'');
 assert.equal(g.element('#'+id+'-name').textContent,id==='st-hanging-s'?'Hanging S':'Extra Z');
 assert.ok(g.element('#'+id+'-detail').textContent.startsWith(el.getAttribute('aria-label'))||g.element('#'+id+'-detail').textContent.startsWith('Game ended; historical facts only.'));
};
function select(g,value){g.element('#st-fixture').value=value;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));}
function imported(g,state){g.element('#st-snapshot').value=JSON.stringify(state);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/Snapshot imported/);}
// Reproduce retained public test supply through the real controller's shuffle,
// not by injecting a resource sidecar or replacing its resolver.
function play(g,n,until){
 const f=require('./support/st-resource-trial-'+n+'.json'),stream=[f.initial.active.type,...f.initial.queue,...f.steps.flatMap(s=>s.revealed)],random=[];
 for(let k=0;k<stream.length;k+=7){const desired=stream.slice(k,k+7);desired.push(...'IJLOSTZ'.split('').filter(p=>!desired.includes(p)));const a='IJLOSTZ'.split('');for(let i=6;i>0;i--){const j=a.indexOf(desired[i]);assert.ok(j<=i);random.push((j+.25)/(i+1));[a[i],a[j]]=[a[j],a[i]];}}
 g.window.Math.random=()=>random.length?random.shift():.5;select(g,'empty');
 const run={f,index:0,locks:0};advance(g,run,until);return run;
}
function advance(g,run,until){for(;run.index<run.f.steps.length&&run.locks<until;run.index++){const s=run.f.steps[run.index];g.window.stLab.act(s.action);if(s.action==='HD')run.locks++;}}
const hidden={storage:{stGuideVisible:'false'}};
test('resource badges: unknown history retains dim outlined pieces beside separate accessible-detail markers',()=>withPage('st-lab.html',hidden,g=>{
 const check=()=>{
  for(const id of ['st-hanging-s','st-extra-z']){
   badge(g,id,'unknown',false);
   const piece=g.element('#'+id+'-piece'),symbol=g.element('#'+id+'-symbol');
   assert.equal(piece.closest('[hidden]'),null);
   assert.notEqual(g.window.getComputedStyle(piece).display,'none');
   assert.ok(piece.querySelector('svg'));
   assert.equal(g.window.getComputedStyle(g.element('#'+id)).color,'rgb(170, 170, 170)');
   assert.notEqual(symbol.parentElement,piece.parentElement);
   assert.equal(symbol.getAttribute('aria-hidden'),'true');
   assert.notEqual(g.window.getComputedStyle(symbol).display,'none');
   assert.match(g.element('#'+id+'-detail').textContent,/unknown/);
  }
 };
 check();
 imported(g,g.snapshot());
 check();
}));
test('resource badges: initial, empty, and imported unknown are distinct from an observed negative',()=>withPage('st-lab.html',hidden,g=>{
 badge(g,'st-hanging-s','unknown',false);badge(g,'st-extra-z','unknown',false);
 select(g,'empty');badge(g,'st-hanging-s','unknown',false);badge(g,'st-extra-z','unknown',false);
 assert.match(g.element('#st-extra-z').getAttribute('aria-label'),/eligibility unknown/);
 assert.match(g.element('#st-hanging-s-detail').textContent,/checkpoint/);
 const run=play(g,2,23);assert.equal(run.locks,23);
 badge(g,'st-hanging-s','none-observed',false);badge(g,'st-extra-z','available',false);
 assert.match(g.element('#st-hanging-s').getAttribute('aria-label'),/none observed in the checked interval/);
 assert.match(g.element('#st-extra-z').getAttribute('aria-label'),/unused in the verified interval/);
 assert.ok(g.window.stLab.resources.center.pending.length,'ordinary SL debt is not itself Hanging S');
}));
test('resource badges: actual Z use highlights, movement/HOLD does not spend, Undo restores pre-turn allocation',()=>withPage('st-lab.html',hidden,g=>{
 const run=play(g,1,20),before=g.snapshot();badge(g,'st-extra-z','available',false);
 advance(g,run,21);badge(g,'st-extra-z','used',true);
 assert.match(g.element('#st-extra-z').getAttribute('aria-label'),/used in the verified interval/);
 g.window.stLab.act('UNDO');assert.deepEqual(g.snapshot().board,before.board);badge(g,'st-extra-z','available',false);
 for(const a of ['HOLD','HOLD','R','CW'])g.window.stLab.act(a);badge(g,'st-extra-z','available',false);
}));
test('resource badges: observed S highlights until actual Left accommodation; Undo restores it',()=>withPage('st-lab.html',hidden,g=>{
 const run=play(g,2,16);badge(g,'st-hanging-s','hanging',true);badge(g,'st-extra-z','unknown',false);
 advance(g,run,19);badge(g,'st-hanging-s','none-observed',false);
 g.window.stLab.act('UNDO');badge(g,'st-hanging-s','hanging',true);
}));
test('resource badges: an identical imported board loses history; restarts and mode changes do not invent allowance',()=>withPage('st-lab.html',hidden,g=>{
 play(g,1,24);badge(g,'st-hanging-s','hanging',true);badge(g,'st-extra-z','used',true);
 const s=g.snapshot();imported(g,{...s,resources:{extraZ:{status:'available'},hangingS:{status:'hanging'}}});
 assert.deepEqual(g.snapshot().board,s.board);badge(g,'st-hanging-s','unknown',false);badge(g,'st-extra-z','unknown',false);
 play(g,1,24);g.click('#st-reset');badge(g,'st-hanging-s','unknown',false);badge(g,'st-extra-z','unknown',false);
 play(g,1,24);g.tap('KeyR');badge(g,'st-hanging-s','unknown',false);badge(g,'st-extra-z','unknown',false);
 play(g,1,24);select(g,'marathon-rebuild');badge(g,'st-hanging-s','unknown',false);badge(g,'st-extra-z','unknown',false);
}));
test('resource badges: outside-profile uses a distinct mark and never implies confirmed absence',()=>withPage('st-lab.html',hidden,g=>{
 play(g,5,Infinity);badge(g,'st-hanging-s','out-of-profile',false);badge(g,'st-extra-z','unknown',false);
 assert.match(g.element('#st-hanging-s').getAttribute('aria-label'),/outside the reviewed source profile/);
}));
test('resource badges: advice hidden, hypothetical worker allocations, stale/error results never replace actual history',()=>withPage('st-lab.html',hidden,g=>{
 play(g,1,24);const state=g.snapshot(),facts=clone(g.window.stLab.resources);
 const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.m=clone(m);}terminate(){}respond(){this.onmessage({data:{type:'result',id:this.m.id,revision:this.m.observation.revision,result:{status:'no-supported-continuation-found',reason:'No checked continuation.',evidence:{resourceObligations:{extraZ:'available',hangingS:[]}}}}});}};
 g.click('#st-toggle');g.advance(40);const stale=all.at(-1);g.window.stLab.act('R');g.advance(40);stale.respond();all.at(-1).respond();
 badge(g,'st-hanging-s','hanging',true);badge(g,'st-extra-z','used',true);
 g.window.stLab.act('L');g.advance(40);all.at(-1).onerror({preventDefault(){}});
 g.click('#st-toggle');assert.equal(g.element('#st-status').hidden,true);
 badge(g,'st-hanging-s','hanging',true);badge(g,'st-extra-z','used',true);
 assert.deepEqual(g.snapshot().board,state.board);assert.equal(g.window.stLab.resources.extraZ.allocations.length,facts.extraZ.allocations.length);
}));
test('resource badges: keyboard focus exposes descriptions without gameplay, Escape dismisses until refocus',()=>withPage('st-lab.html',hidden,g=>{
 for(const id of ['st-phase','st-hanging-s','st-extra-z']){
 const el=g.element('#'+id),before=g.snapshot();el.focus();
 const tap=code=>{for(const type of ['keydown','keyup'])el.dispatchEvent(new g.window.KeyboardEvent(type,{code,bubbles:true}));};
 assert.ok(g.element('#'+el.getAttribute('aria-describedby')).textContent);
 for(const key of ['ArrowRight','Space','ShiftLeft','KeyA'])tap(key);
 assert.deepEqual(g.snapshot(),before);assert.equal(g.window.TrainingSettings.guideVisible,false);
 tap('Escape');assert.equal(el.dataset.detailDismissed,'true');el.blur();el.focus();assert.equal(el.dataset.detailDismissed,undefined);
 }
}));
test('resource badges: top-out is explicitly historical even with advice hidden; Undo removes terminal qualifier',()=>withPage('st-lab.html',hidden,g=>{
 const board=R.emptyBoard();board[20]='XXXXXXXXX.';imported(g,R.createState({board,active:'O',queue:[]}));
 g.window.stLab.act('HD');assert.equal(g.element('#st-resource-terminal').hidden,false);
 assert.match(g.element('#st-extra-z-detail').textContent,/Game ended; historical facts only/);
 g.window.stLab.act('UNDO');assert.equal(g.element('#st-resource-terminal').hidden,true);
 assert.doesNotMatch(g.element('#st-extra-z-detail').textContent,/Game ended/);
}));
