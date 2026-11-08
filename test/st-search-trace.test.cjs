const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../st-search-trace'),P=require('../st-planner'),R=require('../st-rules');
const {fixtures}=require('./support/st-fixtures.cjs');
const state=()=>R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:['O','I','J','L','S','T']});
function semantic(value){const out=JSON.parse(JSON.stringify(value));function visit(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(k==='elapsedMs'||k==='costsMs')delete v[k];else visit(v[k]);}}visit(out);return out;}
test('st-search-trace/opt-in: bounded capture preserves deterministic ordinary decision and replayable paths',()=>{
 const s=state(),opts={depth:2,width:3,maxNodes:15000,now:()=>0},plain=P.decide(s,opts),trace=T.create({limit:3000});
 const result=P.decide(s,{...opts,searchTrace:trace});assert.deepEqual(semantic(result),semantic(plain));
 const receipt=trace.finish(result);assert.ok(receipt.events.length);assert.match(receipt.scope,/not fully traced/);assert.match(receipt.limits,/do not establish impossibility/);
 const candidates=receipt.events.filter(e=>e.kind==='candidate');assert.ok(candidates.some(e=>e.outcome==='beam-retained'));assert.ok(candidates.some(e=>e.outcome==='beam-pruned'));
 for(const c of candidates){let current=receipt.searches.find(r=>r.id===c.searchId).observation;for(const p of c.path){const r=R.replay(current,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events[0],p.event);current=r.state;}assert.deepEqual(current.board,c.board);}
 assert.equal('searchTrace' in result,false);
});
test('st-search-trace/bound: truncation is explicit and never evaluates omitted payloads',()=>{
 const t=T.create({limit:1});t.record('test','test',()=>({value:1}));t.record('test','test',()=>{throw Error('must not build omitted entry');});
 const receipt=t.finish({status:'budget-exhausted',continuation:[]});assert.equal(receipt.limit,1);assert.equal(receipt.events.length,1);assert.equal(receipt.truncated,true);assert.equal(receipt.omitted,1);assert.equal(receipt.result.status,'budget-exhausted');
});
test('st-search-trace/zero budget: no candidate capture never claims search completeness',()=>{
 const t=T.create(),result=P.decide(state(),{maxNodes:0,searchTrace:t,now:()=>0});const receipt=t.finish(result);
 assert.equal(result.target,null);assert.match(receipt.limits,/not an exhaustive/);assert.equal(receipt.selected.length,0);
});
test('st-search-trace/opening: actual staged candidates and priorities survive serialization',()=>{
 const s=R.createState({active:'I',queue:['J','L','O','S','T','Z']}),opts={maxNodes:12000,openingDepth:2,openingWidth:3,now:()=>0},trace=T.create();
 const plain=P.plan(s,opts),result=P.plan(s,{...opts,searchTrace:trace});assert.deepEqual(semantic(result),semantic(plain));
 const receipt=JSON.parse(JSON.stringify(trace.finish(result))),candidates=receipt.events.filter(e=>e.scope==='opening'&&e.kind==='candidate');assert.ok(candidates.length);assert.ok(candidates.some(e=>Array.isArray(e.priority.rank)));
 for(const c of candidates){let current=receipt.searches.find(r=>r.id===c.searchId).observation;for(const p of c.path){const r=R.replay(current,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events[0],p.event);current=r.state;}assert.deepEqual(current.board,c.board);}
});
test('st-search-trace/worker: capture is explicit and cannot leak into ordinary requests',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');let sent;const context=vm.createContext({self:{postMessage:value=>{sent=value;}},Date,performance});
 context.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context,{filename:f});};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../st-worker.js'),'utf8'),context);
 const request={id:1,observation:state(),options:{maxNodes:0,timeMs:0}};
 context.self.onmessage({data:{...request,type:'plan'}});assert.equal(sent.type,'result');assert.equal('trace' in sent,false);
 context.self.onmessage({data:{...request,type:'explore',traceLimit:2}});assert.equal(sent.type,'exploration');assert.equal(sent.trace.limit,2);assert.equal(sent.revision,request.observation.revision);assert.equal(sent.result.target,null);
});

test('st-search-trace/roots: separate projected searches keep immutable local origins',()=>{
 const trace=T.create({limit:10}),a=state(),b=R.move(a,'L');
 const x=trace.start('ordinary',P.observe(a)),y=x.start('ordinary',P.observe(b));
 x.record('layer','ordinary',()=>({depth:1}));y.record('layer','ordinary',()=>({depth:1}));
 const receipt=trace.finish({status:'test'});assert.deepEqual(receipt.events.map(e=>e.searchId),[1,2]);assert.notDeepEqual(receipt.searches[0].observation.active,receipt.searches[1].observation.active);
 a.board[0]='##########';assert.notEqual(receipt.searches[0].observation.board[0],a.board[0]);
});
