'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const R=require('../st-rules.js'),F=require('../st-fixtures.js');
const json=value=>JSON.parse(JSON.stringify(value));
const shockyURL='https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit';
const flameURL='https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking';
const centerSource={id:'SHOCKY-3.2',label:'Shocky’s ST Stacking Guide',url:shockyURL,section:'Chapter 3.2: The Center',scope:'Explains center overhang pairs, not proof of this particular sequence.'};
const flameSource={id:'FLAME-CENTER',label:'Flamewheel’s ST Stacking Guide',url:flameURL,section:'Center Stacking',scope:'Explains two-piece center combinations; historical piece colors differ.'};
function setup(g){
 const workers=[];
 g.window.Worker=class{
  constructor(){workers.push(this);}
  postMessage(message){this.message=json(message);}
  terminate(){this.terminated=true;}
  respond(result,patch={}){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result,...patch}});}
 };
 g.click('#st-reset');g.advance(40);return workers;
}
// These are UI protocol cases, not placement-search tests. A direct replay gives
// safeTarget a legal witness without invoking the planner's expensive search.
function advice(observation,patch={}){
 const witness=['HD'],replay=R.replay(observation,witness);
 assert.equal(replay.valid,true);assert.equal(replay.events.length,1);
 return {status:'recommended-with-verified-prefix',target:replay.events[0].target,hold:false,holdCount:0,witness,
  reason:'Place here without clearing a line.',continuation:[],sources:[centerSource],...patch};
}
const links=g=>[...g.element('#st-source-list').querySelectorAll('a')];
function assertSourcesCleared(g){
 assert.equal(g.element('#st-sources').hidden,true);
 assert.equal(g.element('#st-source-list').children.length,0);
}

test('st-sources/ui: current checked advice links to named community sections with a clear scope boundary',()=>withPage('st-lab.html',{},g=>{
 assertSourcesCleared(g);
 const workers=setup(g),worker=workers.at(-1);
 worker.respond(advice(worker.message.observation,{sources:[centerSource,flameSource,{...centerSource,label:'Duplicate must not appear'}]}));
 assert.equal(g.element('#st-sources').hidden,false);
 assert.equal(links(g).length,2);
 assert.deepEqual(links(g).map(link=>link.href),[shockyURL,flameURL]);
 assert.deepEqual(links(g).map(link=>link.textContent),[
  'Shocky’s ST Stacking Guide · Chapter 3.2: The Center',
  'Flamewheel’s ST Stacking Guide · Center Stacking'
 ]);
 assert.deepEqual(links(g).map(link=>link.title),[centerSource.scope,flameSource.scope]);
 for(const link of links(g)){
  assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
  assert.equal(link.getAttribute('href').includes('#'),false,'no invented section anchors');
 }
 assert.match(g.element('#st-sources').textContent,/community concepts, not universal placement rules/);
 assert.match(g.element('#st-sources').textContent,/coach checks this specific move; the guides do not certify it/);
 assert.equal(g.element('#st-status').querySelector('a'),null,'reason remains separate plain text');
 const before=g.snapshot();links(g)[0].focus();
 for(const code of ['Space','KeyA','ArrowRight'])links(g)[0].dispatchEvent(new g.window.KeyboardEvent('keydown',{code,bubbles:true}));
 assert.deepEqual(g.snapshot(),before,'focused references do not trigger gameplay or the advice toggle');
 assert.equal(g.element('#st-sources').hidden,false);
}));

test('st-sources/security: exact URL allowlist rejects unsafe, altered and malformed metadata; text is never HTML',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),worker=workers.at(-1);
 const html='<img src="x" onerror="window.sourceInjected=true"><script>window.sourceInjected=true</script>';
 const unsafeURLs=['javascript:alert(1)','data:text/html,<script>alert(1)</script>','https://example.com/guide',
  'http://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',
  `${shockyURL}#chapter`,`${shockyURL}?redirect=evil`,`${shockyURL}/`,`${shockyURL}\n`,
  ` ${shockyURL}`,`//tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking`,
  'https://tl.net.evil.test/forum/games/175252-10000-guide-tetris-ultra-st-stacking'];
 const maliciousText={...centerSource,label:html,section:`Chapter 3.2: ${html}`,scope:`" onmouseover="alert(1) ${html}`};
 const malformed=[null,42,'not a source',[],{},
  {...centerSource,id:''},{...centerSource,label:[]},{...centerSource,section:null},{...centerSource,scope:{html}},
  {...centerSource,url:{toString(){return shockyURL;}}}];
 worker.respond(advice(worker.message.observation,{reason:html,sources:[
  ...unsafeURLs.map((url,i)=>({...centerSource,id:`unsafe-${i}`,url})),...malformed,
  {...centerSource,url:'javascript:alert(1)'},maliciousText,flameSource
 ]}));
 assert.deepEqual(links(g).map(link=>link.href),[shockyURL,flameURL]);
 assert.equal(links(g)[0].textContent,`${html} · Chapter 3.2: ${html}`);
 assert.equal(links(g)[0].title,maliciousText.scope);
 assert.equal(g.element('#st-status').textContent,html);
 assert.equal(g.element('#st-status').children.length,0);
 assert.equal(g.element('#st-sources').querySelector('img,script,[onerror],[onmouseover]'),null);
 assert.equal(g.window.sourceInjected,undefined);
}));

test('st-sources/ui: movement, stale replies, toggles and storage changes cannot revive obsolete links',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),old=workers.at(-1),oldAdvice=advice(old.message.observation);
 old.respond(oldAdvice);assert.equal(links(g).length,1);
 g.tap('ArrowRight');assertSourcesCleared(g);
 g.advance(40);const fresh=workers.at(-1);
 old.respond(oldAdvice);assertSourcesCleared(g);
 fresh.respond(advice(fresh.message.observation,{sources:[flameSource]}));
 assert.deepEqual(links(g).map(link=>link.href),[flameURL]);
 old.respond(oldAdvice);assert.deepEqual(links(g).map(link=>link.href),[flameURL]);
 g.tap('KeyA');assertSourcesCleared(g);
 fresh.respond(advice(fresh.message.observation));assertSourcesCleared(g);
 g.tap('KeyA');assertSourcesCleared(g);g.advance(40);
 workers.at(-1).respond(advice(workers.at(-1).message.observation));assert.equal(links(g).length,1);
 g.window.localStorage.setItem('stGuideVisible','false');
 g.window.dispatchEvent(new g.window.StorageEvent('storage',{key:'stGuideVisible',storageArea:g.window.localStorage}));
 assertSourcesCleared(g);
}));

test('st-sources/ui: resets and snapshot imports discard advice metadata rather than trusting it',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g),worker=workers.at(-1);
 worker.respond(advice(worker.message.observation));
 g.click('#st-reset');assertSourcesCleared(g);g.advance(40);
 const current=workers.at(-1);current.respond(advice(current.message.observation));
 const injected=advice(g.snapshot(),{reason:'Imported advice must not be shown.'});
 g.element('#st-snapshot').value=JSON.stringify({...g.snapshot(),sources:[centerSource],result:injected,advice:injected});
 g.click('#st-import');assertSourcesCleared(g);g.advance(40);
 for(const field of ['sources','result','advice'])assert.equal(field in workers.at(-1).message.observation,false);
 assert.doesNotMatch(g.element('#st-status').textContent,/Imported advice must not be shown/);
 current.respond(injected);assertSourcesCleared(g);
}));

test('st-sources/ui: invalid, targetless and metadata-free results never retain previous references',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g);
 const respond=patch=>{g.click('#st-reset');g.advance(40);const worker=workers.at(-1);worker.respond(advice(worker.message.observation,patch));};
 workers.at(-1).respond(advice(workers.at(-1).message.observation));assert.equal(links(g).length,1);
 respond({target:{type:'O',x:-100,y:0,rotation:0}});
 assert.equal(g.element('#st-status').dataset.result,'invalid-witness');assertSourcesCleared(g);
 respond({target:null,status:'no-supported-continuation-found'});assertSourcesCleared(g);
 for(const status of ['top-out','insufficient-known-pieces','thinking','budget-exhausted','worker-error','no-supported-continuation-found']){
  respond({status});assertSourcesCleared(g);
 }
 for(const sources of [undefined,null,{},[],[{...centerSource,url:'javascript:alert(1)'}]]){
  respond({sources});assertSourcesCleared(g);
 }
}));

test('st-sources/ui: interrupted worker failures remove retained references and remain honest about search limits',()=>withPage('st-lab.html',{},g=>{
 const workers=setup(g);
 // The planner's advance path is stubbed only to arrange an already validated
 // retained target. This test exercises the actual UI's failure cleanup.
 const showRetained=()=>{
  g.click('#st-reset');g.advance(40);const worker=workers.at(-1);
  const witness=['L','HD'],replay=R.replay(worker.message.observation,witness);assert.equal(replay.valid,true);
  worker.respond(advice(worker.message.observation,{witness,target:replay.events[0].target}));
  g.window.STPlanner={...g.window.STPlanner,advance:(observation,prior)=>({...prior,witness:['HD'],retained:true})};
  g.window.stLab.act('L');assert.equal(links(g).length,1);
 };
 showRetained();g.advance(40);workers.at(-1).respond(null,{type:'error'});assertSourcesCleared(g);
 assert.equal(g.element('#st-status').textContent,'The coach could not evaluate this position. You can still practice manually.');
 showRetained();g.advance(40);workers.at(-1).onerror({preventDefault(){}});assertSourcesCleared(g);
 showRetained();g.advance(3000);assertSourcesCleared(g);
 assert.equal(g.element('#st-status').textContent,'The coach timed out. A valid continuation may still exist.');
 showRetained();g.window.Worker=class{constructor(){throw new Error('Worker could not start');}};g.advance(40);assertSourcesCleared(g);
 assert.equal(g.element('#st-target').children.length,0);
 assert.equal(g.element('#st-status').textContent,'The coach could not start. You can still practice manually.');
}));

test('st-sources/help: current unlimited HOLD practice is distinct from legacy v1 replay and ordinary practice',()=>withPage('st-lab.html',{},g=>{
 const current=g.element('#st-rules-note').textContent,legacy=g.element('#st-legacy-rules-note').textContent;
 assert.match(current,/st-zero-v2.*unlimited hold swaps/);
 assert.match(current,/Follow any Hold instruction before placing the highlighted piece/);
 assert.doesNotMatch(current,/one hold per lock|HOLD label/);
 assert.match(legacy,/st-zero-v1 uses one hold per lock for historical replay/);
 assert.match(legacy,/Importing a v1 snapshot.*migrates it to unlimited-hold st-zero-v2/);
 const ordinary=g.element('#st-ordinary-practice-note');
 assert.equal(ordinary.querySelector('a').getAttribute('href'),'index.html');
 assert.match(ordinary.textContent,/Those modes are unchanged\./);
 assert.doesNotMatch(ordinary.textContent,/unlimited-hold rules are not/);
 const snapshot=F.get('empty-hold').observation;
 g.element('#st-snapshot').value=JSON.stringify(snapshot);g.click('#st-import');
 assert.equal(g.snapshot().rules,'st-zero-v2');assert.match(g.element('#st-import-status').textContent,/migrated from v1 to unlimited-hold v2/);
 g.tap('ShiftLeft');const held=g.snapshot();g.click('[data-action="HOLD"]');
 assert.equal(g.snapshot().active.type,snapshot.active.type);assert.equal(g.snapshot().canHold,true);
 assert.deepEqual(g.snapshot().queue,held.queue);assert.equal(g.element('#st-hold-state').textContent,'Unlimited swaps');
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));assert.equal(g.element('#st-position-note').textContent,'Empty-board manual practice. Opening advice is not supported yet.');
 assert.equal(JSON.parse(g.element('#st-diagnostic-text').textContent).note,'Only the shown sequence has been checked. Continued ST play is not guaranteed.');
}));
