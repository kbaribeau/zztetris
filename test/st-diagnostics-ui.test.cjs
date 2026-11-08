const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const json=value=>JSON.parse(JSON.stringify(value));
function workers(g){
 const instances=[];
 g.window.Worker=class{
  constructor(){instances.push(this);this.terminated=false;}
  postMessage(message){this.message=json(message);}
  terminate(){this.terminated=true;}
  respond(data){this.onmessage({data:{id:this.message.id,revision:this.message.observation.revision,...data}});}
 };
 g.click('#st-reset');g.advance(40);return instances;
}
function logs(g){const entries=[];g.window.console.error=(...args)=>entries.push(args);return entries;}
test('st-diagnostics-ui/worker exception: preserves stack and frozen public request with safe text',()=>withPage('st-lab.html',{},g=>{
 const entries=logs(g),ws=workers(g),worker=ws.at(-1),before=g.snapshot();
 worker.respond({type:'error',error:{name:'TypeError',message:'<img src=x> bad calculation',stack:'TypeError at planner.js:12'},diagnosticBuild:'worker-test'});
 assert.equal(entries.length,1);assert.equal(g.element('#st-status').dataset.result,'worker-error');
 const record=g.window.STDiagnostics.list().at(-1);
 assert.equal(record.error.stack,'TypeError at planner.js:12');assert.equal(record.context.workerBuild,'worker-test');
 assert.deepEqual(json(record.context.request.observation),before);assert.equal(record.context.request.observation.queue.length,6);
 assert.equal('future' in record.context.request,false);
 assert.equal(g.element('#st-error-reports').open,true);assert.match(g.element('#st-error-latest').textContent,/<img src=x>/);assert.equal(g.element('#st-error-latest').querySelector('img'),null);
 g.window.stLab.act('R');assert.deepEqual(json(record.context.request.observation),before,'captured request does not follow live play');
}));
test('st-diagnostics-ui/stale errors and expected timeouts do not create exception reports',()=>withPage('st-lab.html',{},g=>{
 const entries=logs(g),ws=workers(g),old=ws.at(-1);
 g.window.stLab.act('R');g.advance(40);old.respond({type:'error',message:'stale failure'});old.onerror({message:'stale startup'});
 assert.equal(g.window.STDiagnostics.list().length,0);assert.equal(entries.length,0);
 g.advance(2500);assert.equal(g.element('#st-status').dataset.result,'budget-exhausted');assert.equal(g.window.STDiagnostics.list().length,0);
}));
test('st-diagnostics-ui/transport and explorer failures preserve request and recover controls',()=>withPage('st-lab.html',{},g=>{
 const entries=logs(g),ws=workers(g);ws.at(-1).onmessageerror({});
 assert.equal(g.element('#st-status').dataset.result,'worker-error');assert.equal(g.window.STDiagnostics.list().at(-1).context.operation,'coach-messageerror');
 g.click('#st-explore-capture');const explorer=ws.at(-1);explorer.respond({type:'error',message:'explorer failed',diagnosticBuild:'old-worker'});
 assert.equal(g.element('#st-explore-capture').disabled,false);assert.equal(g.window.STDiagnostics.list().at(-1).context.request.type,'explore');
 assert.equal(entries.length,2);
}));
test('st-diagnostics-ui/copy download clear: failed clipboard has manual fallback and stale copy cannot undo clear',()=>withPage('st-lab.html',{},async g=>{
 logs(g);g.window.STDiagnostics.report(new g.window.Error('one failure'),{operation:'test'});
 const before=g.snapshot();let finish;
 g.window.navigator.clipboard.writeText=()=>new Promise(resolve=>{finish=resolve;});
 g.click('#st-error-copy');g.click('#st-error-clear');finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.element('#st-error-action-status').textContent,'Local reports cleared.');assert.equal(g.window.STDiagnostics.list().length,0);
 g.window.STDiagnostics.report(new g.window.Error('second failure'),{operation:'test'});
 g.window.navigator.clipboard.writeText=async()=>{throw Error('denied');};
 g.click('#st-error-copy');await new Promise(resolve=>setImmediate(resolve));
 assert.match(g.element('#st-error-action-status').textContent,/copy it manually/);
 assert.equal(g.window.document.activeElement,g.element('#st-error-json'));
 g.click('#st-error-download');const file=g.downloads.at(-1);assert.equal(file.filename,'zztetris-diagnostics.json');
 assert.equal(JSON.parse(file.text).records.at(-1).error.message,'second failure');
 assert.deepEqual(g.snapshot(),before);assert.equal(g.element('#st-error-json').readOnly,true);
}));

test('st-diagnostics-ui/startup error: active no-id diagnostic uses pending request, stale startup ignored',()=>withPage('st-lab.html',{},g=>{
 const entries=logs(g),ws=workers(g),old=ws.at(-1);
 g.window.stLab.act('R');g.advance(40);const active=ws.at(-1),data={type:'error',startupDiagnostic:true,message:'import failed'};
 old.onmessage({data});assert.equal(entries.length,0);
 active.onmessage({data});assert.equal(entries.length,1);
 assert.equal(g.window.STDiagnostics.list().at(-1).context.request.id,active.message.id);
 g.click('#st-explore-capture');const explorer=ws.at(-1);explorer.onmessage({data});
 assert.equal(entries.length,2);assert.equal(g.element('#st-explore-capture').disabled,false);
}));
