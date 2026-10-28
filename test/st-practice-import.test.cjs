'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),H=require('../st-resource-history'),Session=require('../st-session'),Practice=require('../st-practice');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),semantic=s=>({...clone(s),revision:0});
function packageFor(tail=['T','O','I','J','L','S','Z'],{hold=null,known=true}={}){
 const state=R.createState({rules:R.PROFILE.id,board:R.emptyBoard(),active:{type:'I',x:3,y:17,rotation:0,lastRotation:null},hold,canHold:true,queue:['J','L','O','S','T','Z'],streamCursor:1,...(known?{bag:B.fromObserved({observed:['I','J','L','O','S','T','Z'],startPhase:0})}:{})});
 return Practice.create(Session.create(state,{resourceHistory:H.start(state),resourceOriginBag:state.bag??null}),tail);
}
function workers(g){const all=[];g.window.Worker=class{constructor(){all.push(this);}postMessage(m){this.message=clone(m);}terminate(){this.terminated=true;}respond(result){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result}});}};g.click('#st-reset');g.advance(40);return all;}
function importText(g,value){const text=typeof value==='string'?value:JSON.stringify(value);g.element('#st-snapshot').value=text;g.click('#st-import');return text;}
function request(m){const {id,type,...rest}=m;return rest;}
function noPrivate(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){assert.equal(['privatePractice','tail','future','seed'].includes(key),false,'private key leaked: '+key);noPrivate(child);}}
function dropAtSide(g,index){for(let i=0;i<8;i++)g.window.stLab.act(index%2?'R':'L');g.window.stLab.act('HD');}
test('practice/page repeated imports are exact, cancel prior workers and retain only public worker inputs',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),packed=packageFor(),old=ws.at(-1);importText(g,packed);assert.match(g.element('#st-import-status').textContent,/imported/i);assert.equal(old.terminated,true);g.advance(40);
 const first=ws.at(-1).message;assert.deepEqual(g.snapshot(),packed.session.position);assert.deepEqual(first.observation.queue,['J','L','O','S','T','Z']);noPrivate(first);
 assert.equal(g.window.stLab.resources.coverage.status,'partial');assert.equal(g.window.stLab.resources.extraZ.status,'unknown');
 const pending=ws.at(-1);g.window.stLab.act('HD');importText(g,packed);assert.equal(pending.terminated,true);g.advance(40);assert.deepEqual(request(ws.at(-1).message),request(first));
 old.respond({reason:'STALE',status:'stale'});assert.equal(g.window.stLab.result,null);
 const alternate=packageFor(['O','T','Z','S','L','J','I']);importText(g,alternate);g.advance(40);assert.deepEqual(request(ws.at(-1).message),request(first),'different hidden tails cannot affect initial planning requests');
 g.window.stLab.act('HD');g.advance(40);assert.deepEqual(ws.at(-1).message.observation.queue,['L','O','S','T','Z','O']);noPrivate(ws.at(-1).message);
}));
test('practice/page malformed and contradictory packages reject transactionally without changing input, game, history or worker',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),packed=packageFor();importText(g,packed);g.window.stLab.act('HD');g.advance(40);
 const before=g.snapshot(),evidence=g.window.stLab.exportSession(),resources=clone(g.window.stLab.resources),current=ws.at(-1);
 const malformed=clone(packed);malformed.privatePractice.tail=['T','T'];
 const unsupported=clone(packed);unsupported.schemaVersion=99;
 const nested=clone(packed);nested.session.coaching.resourceContext.steps.push({action:'INVALID',revealed:[]});
 for(const bad of [malformed,unsupported,nested,'{not json']){
  const text=importText(g,bad);assert.match(g.element('#st-import-status').textContent,/rejected/i);assert.equal(g.element('#st-snapshot').value,text);
  assert.deepEqual(g.snapshot(),before);assert.deepEqual(g.window.stLab.exportSession(),evidence);assert.deepEqual(clone(g.window.stLab.resources),resources);assert.equal(current.terminated,undefined);assert.equal(g.element('#st-undo').disabled,false);
 }
 g.window.stLab.act('UNDO');assert.deepEqual(semantic(g.snapshot()),semantic(packed.session.position));
 g.window.stLab.act('HD');assert.deepEqual(semantic(g.snapshot()),semantic(before),'rejected imports did not replace the private cursor');
}));
test('practice/page empty hold draws once, occupied hold never draws, Undo restores cursor and history and Reset restores the exact package',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),packed=packageFor();importText(g,packed);g.advance(40);const initialRequest=request(ws.at(-1).message),initialResources=clone(g.window.stLab.resources);
 g.tap('ShiftLeft');const held=g.snapshot();assert.equal(held.hold,'I');assert.equal(held.active.type,'J');assert.equal(held.streamCursor,2);assert.deepEqual(held.queue,['L','O','S','T','Z','T']);
 g.tap('ShiftLeft');const swapped=g.snapshot();assert.equal(swapped.hold,'J');assert.equal(swapped.active.type,'I');assert.equal(swapped.streamCursor,held.streamCursor);assert.deepEqual(swapped.queue,held.queue);assert.deepEqual(swapped.bag,held.bag);
 g.tap('Space');const locked=g.snapshot(),lockedResources=clone(g.window.stLab.resources);assert.equal(locked.active.type,'L');assert.equal(locked.streamCursor,3);assert.deepEqual(locked.queue,['O','S','T','Z','T','O']);
 g.click('#st-undo');assert.deepEqual(semantic(g.snapshot()),semantic(packed.session.position));assert.deepEqual(clone(g.window.stLab.resources),initialResources);
 g.tap('ShiftLeft');g.tap('ShiftLeft');g.tap('Space');assert.deepEqual(semantic(g.snapshot()),semantic(locked));assert.deepEqual(clone(g.window.stLab.resources),lockedResources);
 for(const reset of [()=>g.click('#st-reset'),()=>g.tap('KeyR')]){reset();g.advance(40);assert.deepEqual(request(ws.at(-1).message),initialRequest);assert.deepEqual(g.snapshot(),packed.session.position);g.tap('ShiftLeft');assert.deepEqual(semantic(g.snapshot()),semantic(held));}
}));
test('practice/page finite tail exhaustion never materializes a forced remainder or random substitute; Undo and Reset still work',()=>withPage('st-lab.html',{},g=>{
 const packed=packageFor(['I','J','L','O','S','T']);importText(g,packed);let randomCalls=0;g.window.Math.random=()=>{randomCalls++;return .5;};
 const actual=[];let beforeFinal;
 for(let i=0;i<13;i++){assert.ok(g.snapshot().active,'piece '+i+' available');actual.push(g.snapshot().active.type);beforeFinal=g.snapshot();dropAtSide(g,i);assert.equal(g.snapshot().topOut,false,'finite supply is exhausted before top-out');}
 assert.deepEqual(actual,['I','J','L','O','S','T','Z','I','J','L','O','S','T']);assert.equal(g.snapshot().active,null);assert.deepEqual(g.snapshot().queue,[]);assert.equal(B.forcedNext(g.snapshot().bag),'Z','remaining Z is knowable but is not part of the supplied package');assert.equal(randomCalls,0);
 assert.equal(g.element('#st-status').dataset.result,'insufficient-known-pieces');assert.match(g.element('#st-status').textContent,/ended|exhaust/i);
 const terminal=g.snapshot();g.tap('Space');assert.deepEqual(g.snapshot(),terminal);
 g.click('#st-undo');assert.deepEqual(semantic(g.snapshot()),semantic(beforeFinal));dropAtSide(g,12);assert.deepEqual(semantic(g.snapshot()),semantic(terminal));
 g.click('#st-reset');assert.deepEqual(g.snapshot(),packed.session.position);dropAtSide(g,0);assert.deepEqual(g.snapshot().queue,['L','O','S','T','Z','I']);assert.equal(randomCalls,0);
}));
test('practice/page normal exports omit private supply and ordinary session imports remain finite and unchanged',()=>withPage('st-lab.html',{},g=>{
 const packed=packageFor();importText(g,packed);
 g.click('#st-export-session');const saved=JSON.parse(g.element('#st-snapshot').value);assert.deepEqual(saved,packed.session);noPrivate(saved);assert.equal(saved.format,Session.FORMAT);
 g.click('#st-export');const position=JSON.parse(g.element('#st-snapshot').value);assert.deepEqual(position,packed.session.position);noPrivate(position);
 importText(g,saved);g.tap('Space');assert.equal(g.snapshot().queue.length,5,'ordinary session did not retain previously imported private tail');
 importText(g,packageFor([]));g.tap('Space');assert.equal(g.snapshot().queue.length,5,'explicit empty private tail is finite too');
 const forced=clone(position);forced.queue=[];forced.bag=B.fromObserved({observed:['I','J','L','O','S','T'],startPhase:0});importText(g,forced);assert.deepEqual(g.snapshot().queue,['Z'],'plain snapshot restores its legacy forced-remainder behavior');
 importText(g,packed);let randomCalls=0;g.window.Math.random=()=>{randomCalls++;return .5;};const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));assert.equal(randomCalls,6,'mode change starts a fresh random bag');
 const fresh=g.snapshot();assert.ok(fresh.board.every(row=>row==='..........'));g.tap('Space');assert.equal(randomCalls,12,'normal mode replenishes with a random bag, not the old private tail');assert.equal(g.snapshot().queue.length,6);
 g.tap('KeyR');assert.equal(randomCalls,18,'normal mode keyboard reset remains a fresh random start');
}));
