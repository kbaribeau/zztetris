'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {create}=require('../st-diagnostics');
function host(){const store=new Map(),events={},logs=[];return {console:{error:(...x)=>logs.push(x)},navigator:{userAgent:'test'},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},addEventListener:(k,fn)=>{events[k]=fn;},events,logs};}
test('st-diagnostics/recorder: retains stack, cause and frozen public request locally',()=>{
 const h=host(),d=create(h),request={id:5,type:'plan',observation:{board:['..........'],queue:['I','J','L','O','S','T','Z']},options:{maxNodes:42},future:['secret']};
 d.report(new Error('broken',{cause:new Error('origin')}),{operation:'plan',request});request.observation.board[0]='##########';
 const r=d.list()[0];assert.equal(r.error.message,'broken');assert.match(r.error.stack,/broken/);assert.equal(r.error.cause.message,'origin');assert.equal(r.context.request.observation.board[0],'..........');assert.equal(r.context.request.observation.queue.length,6);assert.equal(r.context.request.future,undefined);assert.equal(h.logs.length,1);
 assert.equal(create(h).list().length,1);assert.equal(JSON.parse(d.exportJSON()).records.length,1);d.clear();assert.equal(create(h).list().length,0);
});
test('st-diagnostics/safety: bounded cycle-safe history survives storage, console and observer failures',()=>{
 const h=host();h.localStorage.setItem=()=>{throw Error('quota');};h.console.error=()=>{throw Error('console');};const d=create(h);d.subscribe(()=>{throw Error('listener');});const x={};x.loop=x;x.token='excluded';Object.defineProperty(x,'bad',{enumerable:true,get(){throw Error('getter');}});
 d.report(new Error('first'),{x});assert.equal(d.list()[0].context.x.loop,'[circular]');assert.equal(d.list()[0].context.x.token,undefined);assert.equal(d.list()[0].context.x.bad,'[accessor omitted]');
 for(let i=0;i<25;i++)d.report('error'+i,{payload:'x'.repeat(10000)});assert.equal(d.list().length,12);assert.ok(d.exportJSON().length<250000);
 const e=new Error('duplicate');d.report(e,{operation:'same'});d.report(e,{operation:'same'});assert.equal(d.list().at(-1).count,2);
});
test('st-diagnostics/globals: observable page and rejection/resource failures preserve native handling',()=>{
 const h=host(),d=create(h);d.install();h.events.error({error:new Error('sync'),filename:'https://x.test/foo.js?token=secret#hash',lineno:9});h.events.unhandledrejection({reason:'rejected'});h.events.error({target:{getAttribute:k=>k==='src'?'https://x.test/missing.js?key=secret':null}});
 assert.equal(d.list()[0].context.file,'/foo.js');assert.equal(d.list()[1].context.operation,'unhandled-rejection');assert.equal(d.list()[2].error.name,'ResourceLoadError');assert.equal(d.list()[2].context.file,'/missing.js');
});
function worker({failImport=false,postFail=false}={}){
 const sent=[],handlers={},self={postMessage:v=>{if(postFail)throw Error('clone');sent.push(v);},addEventListener:(name,fn)=>handlers[name]=fn};
 const realm=vm.createContext({self,Date,console:{error(){}}});realm.importScripts=(...files)=>{for(const f of files){if(f==='st-diagnostics.js')vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),realm);else if(failImport)throw Error('missing import');else {realm.STCoachConfig={SEARCH_TIME_MS:1500};realm.STPlanner={decide(){throw new TypeError('planner broke',{cause:Error('cause')});}};}}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),realm);return {sent,handlers,self};
}
test('st-diagnostics/worker: caught and startup errors preserve message stack cause and request identity',()=>{
 for(const failImport of [false,true]){const w=worker({failImport});w.self.onmessage({data:{type:'plan',id:9,observation:{revision:3}}});assert.equal(w.sent.length,1);const r=w.sent[0];assert.equal(r.id,9);assert.equal(r.revision,3);assert.equal(r.type,'error');assert.match(r.error.stack,failImport?/missing import/:/planner broke/);assert.equal(r.stage,failImport?'worker-import':'worker-evaluation');if(!failImport)assert.equal(r.error.cause.message,'cause');}
});
test('st-diagnostics/worker: global rejection and transport failures do not recurse',()=>{
 const w=worker();w.handlers.unhandledrejection({reason:new Error('async')});assert.equal(w.sent[0].error.message,'async');w.handlers.messageerror();assert.equal(w.sent[1].stage,'worker-messageerror');
 const failed=worker({postFail:true});assert.doesNotThrow(()=>failed.self.onmessage({data:{type:'plan',id:1,observation:{revision:0}}}));
});

test('st-diagnostics/hostile values: bad coercion, URL parameters and oversized payloads remain safe',()=>{
 const d=create(host()),bad={message:{toString(){throw Error('coercion');}}};assert.doesNotThrow(()=>d.serializeError(bad));d.report(bad);assert.equal(d.list()[0].error.message,'[unprintable]');
 d.report({message:'at https://example.test/file.js?token=secret#id',stack:'Error\n at https://example.test/file.js?key=secret:1:2'},{items:Array(500).fill('x'.repeat(8000))});
 assert.ok(d.exportJSON().length<100000);assert.ok(!d.exportJSON().includes('token=secret'));assert.ok(!d.exportJSON().includes('key=secret'));
});
