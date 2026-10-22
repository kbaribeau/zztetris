const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {withPage}=require('./support/page.cjs');
const {settings,DEFAULT_CONFIG}=require('./support/pages.cjs');
const R=require('../st-rules.js');
const F=require('../st-fixtures.js');
const json=x=>JSON.parse(JSON.stringify(x));
function workers(g){
 const instances=[];
 g.window.Worker=class {
  constructor(url){this.url=url;this.terminated=false;instances.push(this);}
  postMessage(message){this.message=json(message);}
  terminate(){this.terminated=true;}
  respond(result,patch={}){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result,...patch}});}
 };
 g.click('#st-reset');g.advance(40);
 return instances;
}
function legalResult(observation,predicate=()=>true){
 const p=R.placements(R.createState(observation),{maxNodes:8000}).placements.find(predicate);assert.ok(p);
 return {status:'recommended-with-verified-prefix',revision:observation.revision,target:p.target,hold:p.hold,witness:p.witness,reason:'Tested legal continuation.',metrics:{nodes:1},continuation:[{target:p.target,witness:p.witness,event:p.event}]};
}
for(const gravity of [undefined,'true','false'])test(`st-lab/isolated ${gravity??'absent'}: new rules and preferences do not mutate ordinary modes`,()=>withPage('st-lab.html',{storage:settings(gravity===undefined?{}:{gravity})},g=>{
 const before=g.storage(),s=g.snapshot();
 assert.equal(s.rules,'st-zero-v1');assert.equal(s.queue.length,6);assert.ok(s.board.some(r=>r!=='..........'));
 assert.match(g.element('#st-status').textContent,/Web Workers/);
 assert.equal(g.element('#st-status').dataset.result,'worker-unavailable');
 assert.equal(g.window.zzBot,undefined);assert.equal(g.window.board,undefined);
 g.tap('ShiftLeft');const held=g.snapshot();assert.equal(held.canHold,false);
 g.tap('ShiftLeft');assert.deepEqual(g.snapshot(),held,'second hold blocked');
 g.tap('Space');assert.equal(g.snapshot().canHold,true);
 assert.deepEqual(g.storage(),before);
 g.click('#st-reset');assert.deepEqual({...g.snapshot(),revision:0},{...s,revision:0});
}));

test('st-lab/input: focus and modifiers cannot play; release and blur stop repeats',()=>withPage('st-lab.html',{},g=>{
 const before=g.snapshot();
 for(const selector of ['#st-snapshot','#st-fixture','#st-toggle','nav button']){
  const element=g.element(selector);element.focus();
  for(const code of ['Space','KeyR','KeyX','ArrowRight','KeyA'])element.dispatchEvent(new g.window.KeyboardEvent('keydown',{code,bubbles:true}));
 }
 assert.deepEqual(g.snapshot(),before);
 g.window.document.dispatchEvent(new g.window.KeyboardEvent('keydown',{code:'ArrowRight',ctrlKey:true,bubbles:true}));assert.deepEqual(g.snapshot(),before);
 g.key('keydown','ArrowRight');g.advance(20);assert.equal(g.snapshot().active.x,before.active.x+1);
 g.key('keyup','ArrowRight');const once=g.snapshot();g.advance(200);assert.deepEqual(g.snapshot(),once);
 g.key('keydown','ArrowLeft');g.window.dispatchEvent(new g.window.Event('blur'));const blurred=g.snapshot();g.advance(200);assert.deepEqual(g.snapshot(),blurred);
}));

test('st-lab/workers: off-main requests expose only observation and cancel stale movement results',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),old=ws[0],oldResult=legalResult(old.message.observation);
 assert.equal(old.url,'st-worker.js');
 assert.equal(old.message.observation.queue.length,6);
 assert.equal('future' in old.message.observation,false);assert.equal('construction' in old.message.observation,false);assert.equal('seed' in old.message.observation,false);
 old.respond(oldResult);assert.equal(g.element('#st-target').children.length,4);
 g.tap('ArrowRight');assert.equal(g.element('#st-target').children.length,0,'invalidated immediately');
 g.advance(40);const fresh=ws.at(-1);assert.notEqual(fresh,old);assert.equal(old.terminated,true);
 old.respond(oldResult);assert.equal(g.element('#st-target').children.length,0,'stale revision cannot revive target');
 fresh.respond(legalResult(fresh.message.observation));assert.equal(g.element('#st-target').children.length,4);
}));

test('st-lab/worker safety: impossible target withheld and errors are nonfatal',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),w=ws.at(-1),bad=legalResult(w.message.observation);bad.target.x=-100;
 w.respond(bad);assert.equal(g.element('#st-status').dataset.result,'invalid-witness');assert.equal(g.element('#st-target').children.length,0);
 const before=g.snapshot();g.tap('ArrowRight');assert.notEqual(g.snapshot().active.x,before.active.x);g.advance(40);
 ws.at(-1).onerror({preventDefault(){}});assert.equal(g.element('#st-status').dataset.result,'worker-error');
}));

test('st-lab/hints: key and storage hide BOTH target and explanation; worker is cancelled',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),w=ws.at(-1);w.respond(legalResult(w.message.observation));
 g.tap('KeyA');assert.equal(g.element('#st-status').hidden,true);assert.equal(g.element('#st-diagnostics').hidden,true);assert.equal(g.element('#st-target').children.length,0);assert.equal(g.storage().stGuideVisible,'false');
 g.tap('KeyA');g.advance(40);assert.equal(g.element('#st-status').hidden,false);
 const pending=ws.at(-1);g.window.localStorage.setItem('stGuideVisible','false');g.window.dispatchEvent(new g.window.StorageEvent('storage',{key:'stGuideVisible',storageArea:g.window.localStorage}));
 assert.equal(pending.terminated,true);assert.equal(g.element('#st-status').hidden,true);
}));

test('st-lab/settings: saved bindings, timing and conflicting advice key respected',()=>{
 const config=[...DEFAULT_CONFIG];config[1]='KeyA';config[11]='185';
 return withPage('st-lab.html',{storage:settings({config:JSON.stringify(config),stAdviceKey:'KeyB'})},g=>{
  assert.equal(g.window.DAS,185);const x=g.snapshot().active.x;g.tap('KeyA');assert.equal(g.snapshot().active.x,x+1);
  const before=g.snapshot();g.tap('KeyB');assert.deepEqual(g.snapshot(),before);assert.equal(g.element('#st-status').hidden,true);
 });
});

test('st-lab/import/export: finite visible state, valid unknown history, rejected malformed input is atomic',()=>withPage('st-lab.html',{},g=>{
 g.click('#st-export');const exported=JSON.parse(g.element('#st-snapshot').value);
 assert.equal(exported.queue.length,6);assert.equal('future' in exported,false);assert.equal('seed' in exported,false);
 delete exported.bag;exported.queue=[];exported.hold=null;
 g.element('#st-snapshot').value=JSON.stringify(exported);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/imported/);
 g.tap('Space');assert.equal(g.snapshot().active,null);assert.equal(g.snapshot().queue.length,0);assert.equal(g.element('#st-status').dataset.result,'insufficient-known-pieces');
 const before=g.snapshot();g.element('#st-snapshot').value='{"board":[]}';g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/rejected/);assert.deepEqual(g.snapshot(),before);
}));

test('st-lab/fixtures: selector changes board, resets private future and rejects previous replies',()=>withPage('st-lab.html',{},g=>{
 assert.equal(F.list.length,24);
 assert.deepEqual([...g.element('#st-fixture').options].map(o=>o.value),['',...F.list.map(f=>f.id)]);
 assert.throws(()=>F.get('reservoir-order-review'),/Unknown ST fixture/);
 const ws=workers(g),old=ws[0],answer=legalResult(old.message.observation);
 const second=F.list.find(f=>f.id!==g.element('#st-fixture').value);
 g.element('#st-fixture').value=second.id;g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));
 assert.equal(old.terminated,true);assert.deepEqual(g.snapshot().board,second.observation.board);
 old.respond(answer);assert.equal(g.element('#st-target').children.length,0);
 g.click('#st-empty');assert.ok(g.snapshot().board.every(r=>r==='..........'));assert.equal(g.snapshot().queue.length,6);
 const observed=[g.snapshot().active.type,...g.snapshot().queue];assert.deepEqual(observed.slice().sort(),['I','J','L','O','S','T','Z']);
}));

test('st-lab/watchdog: stalled worker is terminated, no impossible-state claim',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g);g.advance(3000);assert.equal(ws[0].terminated,true);
 assert.equal(g.element('#st-status').dataset.result,'budget-exhausted');assert.match(g.element('#st-status').textContent,/no claim about impossibility/);
}));

test('st-worker/protocol: real worker code imports pure modules and returns revision-tagged planning result',()=>{
 const messages=[],context={Date,performance,console,self:{postMessage:data=>messages.push(data)}};
 context.globalThis=context;
 context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),context);
 const observation=json(F.list[0].observation);
 context.self.onmessage({data:{type:'plan',id:3,observation,options:{timeMs:20,maxNodes:1500,depth:1}}});
 assert.equal(messages.length,1);assert.equal(messages[0].id,3);assert.equal(messages[0].revision,observation.revision);assert.equal(messages[0].type,'result');
 assert.ok(messages[0].result.status);if(messages[0].result.target)assert.ok(R.replay(observation,messages[0].result.witness).valid);
});


test('st-lab/bag boundaries: display setting redraws only observed boundaries, never changes state',()=>withPage('st-lab.html',{},g=>{
 const before=g.snapshot();
 for(const value of ['true','false']){
  g.window.localStorage.setItem('bagBoundaries',value);
  g.window.dispatchEvent(new g.window.StorageEvent('storage',{key:'bagBoundaries',storageArea:g.window.localStorage}));
  assert.deepEqual(g.snapshot(),before);
 }
 // An imported unknown frontier remains unknown, even with boundary display on.
 const unknown={...before};delete unknown.bag;
 g.element('#st-snapshot').value=JSON.stringify(unknown);g.click('#st-import');
 g.window.localStorage.setItem('bagBoundaries','true');g.window.stLab.render();assert.equal(g.snapshot().bag,undefined);
}));

test('st-lab/zero ARR: configured DAS then wall shift, no gravity',()=>{
 const config=[...DEFAULT_CONFIG];config[12]='0';
 return withPage('st-lab.html',{storage:settings({config:JSON.stringify(config)})},g=>{
  const before=g.snapshot();g.key('keydown','ArrowRight');g.advance(160);g.key('keyup','ArrowRight');
  const after=g.snapshot();assert.equal(R.move(after,'R'),after,'at right wall');assert.equal(after.active.y,before.active.y);
 });
});


test('st-lab/import: longer preview rejected rather than using bag knowledge from wrong frontier',()=>withPage('st-lab.html',{},g=>{
 const before=g.snapshot(),input=json(before);input.queue.push('I');
 g.element('#st-snapshot').value=JSON.stringify(input);g.click('#st-import');
 assert.match(g.element('#st-import-status').textContent,/Only six/);assert.deepEqual(g.snapshot(),before);
}));


for(const hold of [false,true])test(`st-lab/stability: exact ${hold?'hold':'movement'} witness preserves visible target while revalidating`,()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),w=ws.at(-1),answer=legalResult(w.message.observation,p=>p.hold===hold&&p.witness.length>1);
 w.respond(answer);const target=g.element('#st-target').innerHTML;
 g.window.stLab.act(answer.witness[0]);
 assert.equal(g.element('#st-target').innerHTML,target,'no blank or moved target while worker is pending');
 assert.equal(g.window.stLab.result.retained,true);
 assert.deepEqual(json(g.window.stLab.result.witness),answer.witness.slice(1));
 if(hold)assert.equal(g.window.stLab.result.hold,false);
 g.advance(40);const next=ws.at(-1);assert.equal(next.message.previous.retained,true);
 const P=require('../st-planner.js');const revalidated=P.revalidate(next.message.observation,next.message.previous,{maxNodes:8000});
 assert.ok(revalidated);next.respond(revalidated);assert.equal(g.element('#st-target').innerHTML,target);
}));


test('st-lab/import: unique observed bag remainder supplies one known piece, consumed once',()=>withPage('st-lab.html',{},g=>{
 const input=g.snapshot();input.queue=[];
 const B=require('../st-bag.js');input.bag=B.fromObserved({observed:['I','J','L','O','S','T'],startPhase:0});
 assert.equal(B.forcedNext(input.bag),'Z');
 g.element('#st-snapshot').value=JSON.stringify(input);g.click('#st-import');
 assert.deepEqual(g.snapshot().queue,['Z']);assert.deepEqual(g.snapshot().bag,json(B.consume(input.bag,'Z')));
 g.tap('Space');assert.equal(g.snapshot().active.type,'Z');assert.equal(g.snapshot().queue.length,0);
}));
