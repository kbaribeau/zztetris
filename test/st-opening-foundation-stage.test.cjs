'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),O=require('../st-opening'),R=require('../st-rules'),S=require('../st-structure'),A=require('../st-access'),f=require('./support/st-opening-foundation-stage.json');
const clone=x=>JSON.parse(JSON.stringify(x)),options={deadline:Infinity,maxNodes:45000,openingPhase:true};
function replay(state,path){let n=S.notchPattern(state.board);for(const p of path){const r=R.replay(state,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);const next=S.advanceNotches(state.board,{state:r.state,event:r.events[0]},n);assert.ok(next.valid);n=next.pattern;state=r.state;}return state;}
test('opening foundation stage discovers a completed child that ordinary beam pruning loses, at the same lock horizon',()=>{
 S.clearCache();A.clearCache();const ordinary=P.plan(f.observation,{...options,disableOpeningStages:true});S.clearCache();A.clearCache();const a=P.plan(f.observation,options);
 assert.equal(ordinary.continuation.length,3);assert.equal(a.continuation.length,3);assert.equal(a.metrics.completeDepth,3);assert.ok(a.metrics.foundationStageSelected);assert.ok(a.metrics.foundationStages.queued>0);
 assert.deepEqual(a.continuation.map(p=>p.event),f.expected.map(p=>p.event));const end=replay(f.observation,a.continuation);assert.deepEqual(end.board,f.endpointBoard);
 assert.equal(A.prefix(f.observation,a.continuation).reachable,true);assert.equal(O.facts(end.board).centerFoundationStatus,'aligned');assert.equal(P.assess(end.board).maxHeight,2);
 assert.equal(a.evidence.opening.repair.goal.endpoint,'finite-foundation');assert.equal(S.geometry(end.board).center.patternSupport,'unrecognized');assert.equal(O.handoffGeometry(end),false);
 assert.ok(a.metrics.nodes<=45000);assert.ok(a.metrics.foundationStages.nodes<=2000);assert.notDeepEqual(ordinary.target,a.target);
});
test('opening foundation stage requires the actual available partner, exact target provenance and bounded replay',()=>{
 let state=f.observation;for(const p of f.expected.slice(0,2))state=R.replay(state,p.witness).state;
 const n=S.notchPattern(state.board),target=O.foundationTargets(state.board,n);assert.deepEqual(target.cells,[[4,38],[4,39]]);
 const find=s=>O.foundationWitnesses(s,target.cells,{deadline:Infinity,now:()=>Date.now(),maxNodes:2000}).hits.filter(p=>O.foundationTransition(s.board,p,n));
 assert.ok(find(state).some(p=>p.witness.includes('HOLD')&&p.event.type==='J'));
 const unavailable={...state,queue:['S','T','Z']};assert.equal(find(unavailable).length,0);assert.equal(find({...unavailable,hiddenQueue:['J']}).length,0);
 const tiny=O.foundationWitnesses(state,target.cells,{deadline:Infinity,now:()=>Date.now(),maxNodes:0});assert.equal(tiny.unknown,true);assert.equal(tiny.visited,0);
 const path=clone(f.expected);let replayed=f.observation;for(const step of path){const r=R.replay(replayed,step.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],step.event);step.board=r.state.board;replayed=r.state;}
 path.at(-1).foundationStage={targets:[[4,38],[4,39]],level:2};assert.ok(O.repairCertificate(f.observation,path),'unmodified literal proof must be accepted before testing forgeries');
 const wrong=clone(path);wrong.at(-1).foundationStage.targets=[[5,38]];assert.equal(O.repairCertificate(f.observation,wrong),null);
 wrong.at(-1).foundationStage=clone(path.at(-1).foundationStage);wrong.at(-1).foundationStage.level++;assert.equal(O.repairCertificate(f.observation,wrong),null);
});
test('opening foundation goal survives real page preview refresh/HOLD/Undo and retires only at actual completion',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(a){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(a)}});}};
 const values=[];for(const desired of ['OILJTSZ','IJSZTLO','JLOTISZ']){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);values.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}g.window.Math.random=()=>values.shift();
 const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));
 // Seed the literal generic repair fixture, not today's empty-root ranking.
 // All subsequent requests keep source guidance enabled: it must not take
 // over this already-pending foundation goal through HOLD/refill/Undo.
 const req=()=>{g.advance(40);return workers.at(-1).message;};let q=req(),a=P.decide(q.observation,{...q.options,...options,disableOpeningSources:true});assert.equal(a.evidence.opening.repair.goal.endpoint,'finite-foundation');workers.at(-1).respond(a);
 for(let i=0;i<2;i++){for(const action of a.witness)g.window.stLab.act(action);q=req();assert.equal(q.observation.queue.length,6);assert.equal(q.options.openingRepair.consumed,i+1);a=P.decide(q.observation,{...q.options,...options});workers.at(-1).respond(a);}
 assert.equal(a.target.type,'J');assert.equal(a.witness[0],'HOLD');g.window.stLab.act('HOLD');q=req();const checked=O.checkedRepair(q.options.openingRepair,q.observation);assert.ok(checked);assert.equal(checked.path[0].holdCount,0);
 a=P.decide(q.observation,{...q.options,...options});workers.at(-1).respond(a);for(const action of a.witness)g.window.stLab.act(action);q=req();assert.equal(q.options.openingRepair,null);assert.deepEqual(q.observation.board,f.endpointBoard);
 g.click('#st-undo');q=req();assert.ok(q.options.openingRepair);g.window.stLab.act('HD');q=req();assert.equal(q.options.openingRepair,null);
 g.click('#st-reset');q=req();assert.equal(q.options.openingRepair,null);assert.ok(q.observation.board.every(r=>r==='..........'));
 g.element('#st-snapshot').value=JSON.stringify({...q.observation,openingRepair:a.evidence.opening.repair});g.click('#st-import');q=req();assert.equal(q.options.openingRepair,null);
}));
test('opening foundation stage: recorded Sprint, mirrored Marathon and1000-line transitions retain compatible finite foundations',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const codec=vm.runInNewContext(fs.readFileSync(path.join(root,'tetris-fumen.js'),'utf8'),{window:{}})(2),swap={J:'L',L:'J',S:'Z',Z:'S'};
 for(const [file,mirror,pages] of [['hXc2nbXcXOc.fumen',false,[3,20]],['sm22939781.fumen',true,[35]],['jstris-26536180.fumen',false,[4,6,26]]]){
  const decoded=codec.decoder.decode(fs.readFileSync(path.join(root,'references/st-stacking',file),'utf8').trim());
  const board=p=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>{const c=y<17?'.':p.field.at(mirror?9-x:x,39-y).replace('_','.');return mirror?(swap[c]||c):c;}).join(''));
  for(const page of pages){const before=board(decoded[page-1]),after=board(decoded[page]),op=decoded[page-1].operation,cells=Array.from(op.positions(),({x,y})=>[mirror?9-x:x,39-y]),event={type:mirror?(swap[op.type]||op.type):op.type,cells,lines:0,clearedRows:[],spin:'none',topOut:false};
   const n=S.notchPattern(before),stage=O.foundationTransition(before,{state:{board:after},event},n);assert.ok(stage,`${file} page${page}`);assert.equal(S.centerFoundation(after,n).status,'aligned');
  }
 }
 // This is recorded occupancy/placement compatibility, not invented original hold or preview.
});
