const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{withPage}=require('./support/page.cjs');
const Import=require('../scripts/lib/st-review-import.cjs'),S=require('../st-session'),P=require('../st-practice'),R=require('../st-rules'),B=require('../st-bag');
function sample(){const s=R.createState({active:'I',queue:['J','L','O','S','T','Z'],streamCursor:1});s.bag=B.fromObserved({observed:['I',...s.queue],startPhase:0});return S.create(s);}
test('review packet offers only named long practice and preserves its complete payload',()=>{
 const session=sample(),practice=Import.create(session,['I','J','L','O','S','T','Z'],'R433-before-36');
 const dom=new JSDOM(Import.controls(practice,'R433-before-36-long-practice')),d=dom.window.document;
 assert.equal(d.querySelectorAll('button').length,1);assert.equal(d.querySelectorAll('a[download]').length,0);
 assert.equal(d.querySelector('button').dataset.copy,'R433-before-36-long-practice');
 const copied=JSON.parse(d.querySelector('textarea').value);assert.deepEqual(copied,practice);assert.deepEqual(copied.session,session);
 assert.equal(P.prepare(copied).session.suggestedFileName,'R433-before-36-coaching-export.json');
 assert.throws(()=>Import.create(session,[],'../unsafe'),/ID/);assert.throws(()=>Import.controls(practice,'"bad'),/ID/);
 assert.throws(()=>Import.controls(P.create(session,[]),'old'),/filename/);dom.window.close();
});
test('review packet copied import exports the named current session without private future',()=>withPage('st-lab.html',{},g=>{
 const practice=Import.create(sample(),['I','J','L','O','S','T','Z'],'R353-candidate-before-15'),requests=[];
 g.window.Worker=class{postMessage(m){requests.push(JSON.stringify(m));}terminate(){}};
 g.element('#st-snapshot').value=JSON.stringify(practice);g.click('#st-import');assert.doesNotMatch(g.element('#st-import-status').textContent,/rejected/);
 g.window.stLab.act('HD');g.advance(40);g.click('#st-export-session');const download=g.downloads.at(-1),saved=JSON.parse(download.text);
 assert.equal(download.filename,'R353-candidate-before-15-coaching-export.json');assert.deepEqual(saved.position,g.snapshot());S.prepare(saved);
 for(const value of [download.text,...requests])assert(!/privatePractice|"tail"/.test(value));
 assert(!requests.join('').includes('suggestedFileName'));
}));
