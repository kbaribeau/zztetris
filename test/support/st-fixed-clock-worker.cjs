'use strict';
// Semantic Worker checks keep the real JSON request and current script graph.
// A fresh realm freezes Date only, so inner deadlines cannot turn policy
// assertions into host-throughput assertions. The explicit node cap remains.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),clone=x=>JSON.parse(JSON.stringify(x));
// Emergency diagnostic watchdog only. Real production controls still use the
// simulation's unchanged 2500ms VM watchdog and the actual 1500ms request.
const diagnosticWatchdogMs=60000;
module.exports=function fixedClockWorker(request){
 assert.ok(Number.isInteger(request.options?.maxNodes)&&request.options.maxNodes>=0&&request.options.maxNodes<=45000,'Fixed-clock Workers require an explicit bounded node allowance');
 const messages=[],realm={Date:class extends Date{static now(){return 0;}},performance,self:{postMessage:message=>messages.push(clone(message))}};
 vm.createContext(realm);
 realm.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),realm,{filename:file,timeout:diagnosticWatchdogMs});};
 vm.runInContext(fs.readFileSync(path.join(root,'st-worker.js'),'utf8'),realm,{filename:'st-worker.js',timeout:diagnosticWatchdogMs});
 realm.request=clone(request);new vm.Script('self.onmessage({data:request})').runInContext(realm,{timeout:diagnosticWatchdogMs});
 assert.equal(messages.length,1);assert.equal(messages[0].type,'result',JSON.stringify(messages[0]));
 assert.equal(messages[0].id,request.id);assert.equal(messages[0].revision,request.observation.revision);
 return messages[0].result;
};
