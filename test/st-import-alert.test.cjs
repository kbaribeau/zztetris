'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function attempt(g,input){
 const text=typeof input==='string'?input:JSON.stringify(input);
 g.input('#st-snapshot',text);g.click('#st-import');return text;
}
function rejection(g,message){
 const status=g.element('#st-import-status'),result=g.element('#st-import-result'),field=g.element('#st-snapshot');
 assert.equal(status.textContent,message);
 assert.equal(result.dataset.result,'rejected');
 assert.equal(status.getAttribute('role'),'alert');assert.equal(status.getAttribute('aria-live'),'assertive');assert.equal(status.getAttribute('aria-atomic'),'true');
 assert.equal(g.element('#st-import-error-title').hidden,false);assert.equal(g.element('#st-import-error-note').hidden,false);
 assert.equal(g.element('#st-import-options').open,true);assert.equal(g.element('#st-import-error-indicator').hidden,false);
 assert.equal(field.getAttribute('aria-invalid'),'true');assert.equal(field.getAttribute('aria-describedby'),status.id);
 assert.ok(field.compareDocumentPosition(result)&g.window.Node.DOCUMENT_POSITION_FOLLOWING,'result follows JSON');
 assert.ok(result.compareDocumentPosition(g.element('#st-import'))&g.window.Node.DOCUMENT_POSITION_FOLLOWING,'result precedes Import');
 assert.equal(result.querySelectorAll('button, a').length,0,'selected A has no Edit JSON or other new action');
 assert.equal([...g.window.document.querySelectorAll('button')].some(b=>/edit json/i.test(b.textContent)),false);
}
function notice(g,pattern){
 const status=g.element('#st-import-status');assert.match(status.textContent,pattern);
 assert.equal(status.getAttribute('role'),'status');assert.equal(status.getAttribute('aria-live'),'polite');
 assert.equal(g.element('#st-import-result').dataset.result,'notice');
 for(const id of ['st-import-error-title','st-import-error-note','st-import-error-indicator'])assert.equal(g.element('#'+id).hidden,true);
 assert.equal(g.element('#st-snapshot').hasAttribute('aria-invalid'),false);assert.equal(g.element('#st-snapshot').hasAttribute('aria-describedby'),false);
}
test('st-import-alert/parse rejection is prominent, preserves JSON/game and leaves keyboard focus alone',()=>withPage('st-lab.html',{},g=>{
 const before=g.snapshot(),field=g.element('#st-snapshot');field.focus();field.value='{"board":';field.setSelectionRange(2,5);
 g.click('#st-import');rejection(g,'Import rejected: Unexpected end of JSON input');
 assert.equal(field.value,'{"board":');assert.deepEqual(g.snapshot(),before);assert.equal(g.window.document.activeElement,field);assert.equal(field.selectionStart,2);assert.equal(field.selectionEnd,5);
 const saved=g.element('#st-import-status').textContent;g.input('#st-snapshot','{"board":[]}');assert.equal(g.element('#st-import-status').textContent,saved,'editing retains the previous rejection');assert.equal(field.readOnly,false);assert.equal(field.disabled,false);assert.match(g.element('#st-import-error-note').textContent,/Previous import attempt.*not been revalidated/);
 g.element('#st-import-options').open=false;assert.equal(g.element('#st-import-error-indicator').hidden,false,'collapsed summary keeps textual failure cue');
}));
test('st-import-alert/actual multiple position failures retain exact codes and do not cancel a live worker',()=>withPage('st-lab.html',{},g=>{
 const ws=[];g.window.Worker=class{constructor(){ws.push(this);}postMessage(){}terminate(){this.terminated=true;}};
 g.click('#st-reset');g.advance(40);const worker=ws.at(-1),before=g.snapshot();assert.ok(worker);
 const bad={...clone(before),rules:'st-zero-v99',board:[],queue:['Q'],hold:'Q',canHold:'yes',revision:-1,streamCursor:-1};
 const text=attempt(g,bad);rejection(g,'Import rejected: unsupported-profile; invalid-board; invalid-queue; invalid-hold; invalid-hold-availability; invalid-revision; invalid-stream-cursor');
 assert.equal(g.element('#st-snapshot').value,text);assert.deepEqual(g.snapshot(),before);assert.equal(worker.terminated,undefined);
 const long={...before,queue:['I','J','L','O','S','T','Z']};attempt(g,long);rejection(g,'Import rejected: Only six visible preview pieces may be imported; bag knowledge must refer to that frontier.');assert.deepEqual(g.snapshot(),before);
}));
test('st-import-alert/session schema, settings and replay rejections remain atomic and exact',()=>withPage('st-lab.html',{},g=>{
 const before=g.snapshot(),saved=clone(g.window.stLab.exportSession());
 const cases=[
  [{...saved,schemaVersion:99},'Unsupported session format version.'],
  [{...saved,search:{...saved.search,timeMs:99999}},'Unsupported session search settings; current coach settings are required.'],
  [{...saved,position:{...saved.position,board:[]}},'Invalid session position.'],
 ];
 const replay=clone(saved);replay.coaching.resourceContext.steps.push({action:'INVALID',revealed:[]});
 // The existing replay validator supplies the reason; the UI must preserve it,
 // not reinterpret or downgrade invalid history into an accepted warning.
 let replayMessage;try{g.window.STSession.prepare(replay);assert.fail('invalid replay accepted');}catch(error){replayMessage=error.message;}
 cases.push([replay,replayMessage]);
 for(const [bad,message] of cases){const text=attempt(g,bad);rejection(g,'Import rejected: '+message);assert.equal(g.element('#st-snapshot').value,text);assert.deepEqual(g.snapshot(),before);}
}));
test('st-import-alert/repeated identical failures generate fresh text mutations without focus or input loss',()=>withPage('st-lab.html',{},async g=>{
 const status=g.element('#st-import-status'),records=[],observer=new g.window.MutationObserver(r=>records.push(...r));observer.observe(status,{childList:true});
 attempt(g,'{"board":');await Promise.resolve();const first=records.length;assert.ok(first>0);
 const field=g.element('#st-snapshot');field.focus();g.click('#st-import');await Promise.resolve();assert.ok(records.length>first,'a second identical rejection must update the live region');
 rejection(g,'Import rejected: Unexpected end of JSON input');assert.equal(g.window.document.activeElement,field);assert.equal(field.value,'{"board":');observer.disconnect();
}));
test('st-import-alert/parser messages containing markup are rendered only as text',()=>withPage('st-lab.html',{},g=>{
 const bad='<img src=x onerror="window.importInjected=true">';let message;try{JSON.parse(bad);}catch(error){message=error.message;}
 attempt(g,bad);rejection(g,'Import rejected: '+message);
 assert.match(g.element('#st-import-status').textContent,/<img/);assert.equal(g.element('#st-import-status').children.length,0);assert.equal(g.window.importInjected,undefined);assert.equal(g.element('#st-snapshot').value,bad);
}));
test('st-import-alert/success, accepted-session warnings, exports and mode changes clear only rejection presentation',()=>withPage('st-lab.html',{},g=>{
 const position=g.snapshot(),session=clone(g.window.stLab.exportSession());
 attempt(g,'{');attempt(g,position);notice(g,/^Snapshot imported\.$/);
 attempt(g,'{');attempt(g,{...session,engineVersion:'older-readable-coach'});notice(g,/^Session imported\..*different coach version.*history and settings are preserved/);
 assert.deepEqual(g.snapshot(),session.position,'accepted warning still installs validated position');
 attempt(g,'{');attempt(g,session);notice(g,/^Session imported\. Advice will be revalidated\.$/);
 for(const [button,pattern] of [['#st-export',/^Exported visible state only/],['#st-export-session',/^Exported visible position and coaching evidence/]]){
  attempt(g,'{');g.click(button);notice(g,pattern);assert.doesNotThrow(()=>JSON.parse(g.element('#st-snapshot').value));
 }
 // Export availability is a notice, not a false claim that an import failed.
 attempt(g,'{');const original=g.window.STSession;g.window.STSession={...original,create(){throw new Error('test export unavailable');}};g.click('#st-export-session');notice(g,/^Session export unavailable: test export unavailable$/);g.window.STSession=original;
 attempt(g,'{');const mode=g.element('#st-fixture');mode.value='empty';mode.dispatchEvent(new g.window.Event('change'));notice(g,/^$/);assert.ok(g.snapshot().board.every(row=>row==='..........'));
}));
