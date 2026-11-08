'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {withPage}=require('./support/page.cjs'),Config=require('../st-coach-config');
const input=require('./fixtures/empty-browser-coach-request.json');
const root=path.resolve(__dirname,'..'),base='https://zztetris.test/';
function worker(url,{omitResources=false}={}){
 const imports=[],sent=[],location=new URL(url,base),context=vm.createContext({Date:class extends Date{static now(){return 0;}},performance,self:{location,postMessage:m=>sent.push(structuredClone(m))}});
 context.importScripts=(...files)=>{for(const file of files){
   const u=new URL(file,location);assert.equal(u.origin,new URL(base).origin);assert.equal(u.search,'?v='+Config.ASSET_VERSION);
   imports.push(u.pathname.slice(1));
   vm.runInContext(fs.readFileSync(path.join(root,u.pathname),'utf8'),context,{filename:u.href});
   // Simulate the old worker dependency graph's absent resource binding.
   if(omitResources&&u.pathname==='/st-obligation-resources.js')context.STObligationResources=undefined;
 }};
 vm.runInContext(fs.readFileSync(path.join(root,'st-worker.js'),'utf8'),context,{filename:location.href});
 return {imports,sent,send:data=>context.self.onmessage({data:structuredClone(data)})};
}
test('worker release: actual page versions local scripts, styles, coach and explorer entry points',()=>withPage('st-lab.html',{},g=>{
 const urls=[];g.window.Worker=class{constructor(url){urls.push(url);}postMessage(){}terminate(){}};
 for(const element of g.window.document.querySelectorAll('script[src],link[rel="stylesheet"]')){
   const u=new URL(element.src||element.href);if(u.origin===new URL(base).origin)assert.equal(u.search,'?v='+Config.ASSET_VERSION,u.href);
 }
 g.click('#st-reset');g.advance(40);assert.equal(urls.at(-1),'st-worker.js?v='+Config.ASSET_VERSION);
 // Exact user public request, excluding browser metadata, timestamps and report history.
 const w=worker(urls.at(-1));w.send(input);
 assert.equal(w.sent.length,1);assert.equal(w.sent[0].type,'result',JSON.stringify(w.sent[0]));assert.ok(w.sent[0].result.target,'empty position receives a recommendation');
 assert.ok(w.imports.indexOf('st-obligation-resources.js')<w.imports.indexOf('st-planner.js'));
 // Lazy explorer imports carry the same version without changing ordinary imports.
 assert.equal(w.imports.includes('st-search-trace.js'),false);
 w.send({...input,type:'explore',traceLimit:1,options:{...input.options,timeMs:0,maxNodes:0}});
 assert.equal(w.sent.at(-1).type,'exploration');assert.ok(w.imports.includes('st-search-trace.js'));
 g.click('#st-explore-capture');assert.equal(urls.at(-1),'st-worker.js?v='+Config.ASSET_VERSION);assert.equal(urls.length,2);
}));
test('worker release: missing resource binding reproduces captured exception and preserves details',()=>{
 const w=worker('st-worker.js?v='+Config.ASSET_VERSION,{omitResources:true});w.send(input);
 assert.equal(w.sent[0].type,'error');assert.match(w.sent[0].message,/discloseAdvice/);assert.equal(w.sent[0].stage,'worker-evaluation');assert.ok(w.sent[0].error.stack);
});
