'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../st-left-contours'),D=require('../st-left-dependencies'),R=require('../st-rules'),Routes=require('../st-left-routes');
const key=r=>[r.from,r.pieces.join(''),...r.contours].join(':');
test('coach catalogs partition all observed routes without granting unresolved routes',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(C.continuationSets).map(([k,v])=>[k,v.length])),{opener:3,midgame:124,reset:4,unresolved:2});
 const all=Object.values(C.continuationSets).flat().map(key);assert.equal(new Set(all).size,133);
 for(const coach of ['opener','midgame','reset']){
  const found=C.catalog.flatMap(c=>C.lookup(c.profile,coach).dependencies.alternatives.flatMap(a=>a.paths.map(p=>key({from:c.id,pieces:a.pieces,...p}))));
  assert.deepEqual(found.sort(),C.continuationSets[coach].map(key).sort());
  for(const r of C.continuationSets.unresolved)assert.ok(!found.includes(key(r)));
 }
 assert.ok(Object.isFrozen(C.continuationSets.reset));
});
test('Reset T discovery requires admitted Reset progress; ordinary midgame excludes it',()=>{
 const c=C.catalog.find(c=>c.id==='LC-024'),s=R.createState({active:'T',queue:['I']});
 s.board=s.board.map((row,y)=>c.profile.map(h=>y>=40-h?'X':'.').join('')+row.slice(4));
 const options={heights:c.profile,center:{},right:{},allowHold:false};
 assert.equal(D.query(s,{...options,coach:'midgame'}).alternatives.length,0);
 for(const resource of [{resetActive:false,resetProgress:1},{resetActive:true,resetProgress:0}])assert.equal(D.query(s,{...options,coach:'reset',resources:resource}).alternatives.length,0);
 const root=Routes.prepare(s,{...options,coach:'reset',resources:{resetActive:true,resetProgress:1}});
 assert.ok(root.routes.some(r=>r.pieces.join('')==='T'));assert.equal(root.stats.coach,'reset');
});
test('opener catalog is explicit discovery and is not a pooled visible-piece plan',()=>{
 const s=R.createState({active:'L',queue:['I']});
 assert.equal(Routes.prepare(s,{center:{},right:{},allowHold:false}).routes.length,0);
 const root=Routes.prepare(s,{coach:'opener',center:{},right:{},allowHold:false});
 assert.ok(root.routes.some(r=>r.pieces.join('')==='L'));assert.equal(root.coach,'opener');
});
