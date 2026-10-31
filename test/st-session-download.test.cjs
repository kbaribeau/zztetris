const test=require('node:test'),assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const Session=require('../st-session'),Practice=require('../st-practice'),R=require('../st-rules'),B=require('../st-bag');
const clone=x=>JSON.parse(JSON.stringify(x));
function sample(name){const state=R.createState({active:'I',queue:['J','L','O','S','T','Z'],streamCursor:1});state.bag=B.fromObserved({observed:['I',...state.queue],startPhase:0});return Session.create(state,{suggestedFileName:name});}
function install(g,value){g.element('#st-snapshot').value=JSON.stringify(value);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/);}
function download(g,name){const prior=g.element('#st-snapshot').value,n=g.downloads.length;g.click('#st-export-session');assert.equal(g.downloads.length,n+1);const d=g.downloads.at(-1);assert.equal(d.filename,name);assert.equal(d.type,'application/json');assert.equal(g.element('#st-snapshot').value,prior,'download never replaces import text');assert.match(g.element('#st-import-status').textContent,/Download requested/);return JSON.parse(d.text);}
test('session filename metadata is bounded, safe and backwards compatible',()=>{
 for(const [raw,expected] of [[undefined,Session.DEFAULT_EXPORT_FILENAME],[null,Session.DEFAULT_EXPORT_FILENAME],['',Session.DEFAULT_EXPORT_FILENAME],['...','st-lab-coaching-export.json'],['CON.json',Session.DEFAULT_EXPORT_FILENAME],['R433-frame21-coaching-export.json','R433-frame21-coaching-export.json'],['../../evil\\path\u0000.json','_.._evil_path_.json'],['report.JSON','report.json']])assert.equal(Session.exportFilename(raw),expected);
 for(const raw of ['x'.repeat(300),'../x.json','a\u202Etxt.json','NUL','C:\\fake\\x.json']){const name=Session.exportFilename(raw);assert(name.length<=120);assert(!/[\\/:\u0000-\u001f\u202e]/.test(name));assert.equal(Session.exportFilename(name),name);}
 const old=sample();delete old.suggestedFileName;assert.equal(Session.prepare(old).suggestedFileName,Session.DEFAULT_EXPORT_FILENAME);
 const named=sample('R433.json');assert.deepEqual(named.position,old.position);assert.deepEqual(named.coaching,old.coaching);assert.equal(Session.create(Session.prepare(named).state,Session.prepare(named)).suggestedFileName,'R433.json');
 const pack=Practice.create(named,['I','J','L','O','S','T','Z'],{suggestedFileName:'R433-practice-export.json'});assert.equal(Practice.prepare(pack).session.suggestedFileName,'R433-practice-export.json');delete pack.suggestedFileName;assert.equal(Practice.prepare(pack).session.suggestedFileName,'R433.json');delete pack.session.suggestedFileName;assert.equal(Practice.prepare(pack).session.suggestedFileName,Session.DEFAULT_EXPORT_FILENAME);
 assert.throws(()=>Practice.prepare({...pack,unknown:true}),/properties/);
});
test('download exports current played history and retains name through hold, undo, restart and reimport',()=>withPage('st-lab.html',{},g=>{
 const requests=[];g.window.Worker=class{postMessage(m){requests.push(clone(m));}terminate(){}};
 install(g,sample('R433-frame21-coaching-export.json'));g.window.stLab.act('HD');g.window.stLab.act('HOLD');g.advance(40);
 const saved=download(g,'R433-frame21-coaching-export.json');assert.deepEqual(saved.position,g.snapshot());assert.notDeepEqual(saved.position,sample().position);assert(saved.coaching.resourceContext.steps.length>0);Session.prepare(saved);
 assert(!JSON.stringify(requests).includes('suggestedFileName'),'transport hint never reaches Worker');
 install(g,saved);assert.deepEqual(download(g,saved.suggestedFileName).position,saved.position);
 g.window.stLab.act('HD');g.window.stLab.act('UNDO');download(g,saved.suggestedFileName);g.window.stLab.act('RESET');assert.deepEqual(download(g,saved.suggestedFileName).position,saved.position);
}));
test('practice download excludes hidden tail and carries wrapper name; raw snapshot and default imports work',()=>withPage('st-lab.html',{},g=>{
 const packed=Practice.create(sample(),['I','J','L','O','S','T','Z'],{suggestedFileName:'r385-frame5-coaching-export.json'});install(g,packed);g.window.stLab.act('HD');const saved=download(g,'r385-frame5-coaching-export.json');assert.equal(saved.position.queue.length,6);assert.equal(saved.privatePractice,undefined);assert.equal(saved.tail,undefined);assert(!JSON.stringify(saved).includes('privatePractice'));Session.prepare(saved);
 g.window.stLab.act('RESET');download(g,saved.suggestedFileName);
 install(g,{...sample().position,suggestedFileName:'snapshot-continuation.json'});download(g,'snapshot-continuation.json');g.window.stLab.act('RESET');download(g,'snapshot-continuation.json');g.click('#st-export');const raw=JSON.parse(g.element('#st-snapshot').value);assert.equal(raw.suggestedFileName,'snapshot-continuation.json');assert.equal(g.snapshot().suggestedFileName,undefined);install(g,raw);download(g,'snapshot-continuation.json');
 const old=sample();delete old.suggestedFileName;install(g,old);download(g,Session.DEFAULT_EXPORT_FILENAME);
 install(g,{...old.position,suggestedFileName:'../../unsafe/name.json'});download(g,Session.exportFilename('../../unsafe/name.json'));
 const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));download(g,Session.DEFAULT_EXPORT_FILENAME);
}));
test('failed export or rejected import cannot download stale JSON or replace the current name',()=>withPage('st-lab.html',{},g=>{
 install(g,sample('accepted.json'));download(g,'accepted.json');const original=g.window.STSession,n=g.downloads.length;
 g.window.STSession={...original,create(){throw Error('unavailable test');}};g.click('#st-export-session');assert.equal(g.downloads.length,n);assert.match(g.element('#st-import-status').textContent,/Session export unavailable/);g.window.STSession=original;
 g.element('#st-snapshot').value=JSON.stringify({suggestedFileName:'rejected.json'});g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/rejected/);download(g,'accepted.json');
 const createURL=g.window.URL.createObjectURL;g.window.URL.createObjectURL=()=>{throw Error('download host unavailable');};g.click('#st-export-session');assert.equal(g.downloads.length,n+1);assert.match(g.element('#st-import-status').textContent,/Session export unavailable: download host unavailable/);g.window.URL.createObjectURL=createURL;
}));
