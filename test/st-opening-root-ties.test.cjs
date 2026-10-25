'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const O=require('../st-opening'),P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure'),X=require('../st-paired-repair'),A=require('../st-access');
const f=require('./support/st-opening-root-ties.json'),config={openingPhase:true,deadline:Infinity,timeMs:Infinity,maxNodes:45000,patternHistory:f.patternHistory};
const clone=x=>JSON.parse(JSON.stringify(x)),cells=c=>c.map(x=>x.join(',')).sort();
let cached;
function setup(){if(!cached){cached={nominal:P.plan(f.observation,{...config,disableOpeningTieExtension:true}),adaptive:P.plan(f.observation,config)};}return clone(cached);}
function replay(a,s=f.observation){assert.ok(a.target,a.reason);for(const p of a.continuation){const r=R.replay(s,p.witness);assert.ok(r.valid);assert.deepEqual(r.events[0],p.event);s=r.state;}return s;}

test('opening root ties add bounded coverage, not a rank bonus or fixed piece order',()=>{
 const {nominal,adaptive:a}=setup();replay(nominal);const end=replay(a);
 assert.equal(nominal.continuation.length,3);assert.notDeepEqual(cells(nominal.continuation[0].event.cells),cells(f.expectedFirstCells));
 assert.deepEqual(cells(a.continuation[0].event.cells),cells(f.expectedFirstCells));assert.deepEqual(a.continuation.map(p=>p.event.type),f.expectedPieces);
 assert.equal(a.metrics.rootTies.added,1);assert.equal(a.metrics.rootTies.total,a.metrics.rootTies.originalWidth+1);
 assert.equal(a.metrics.completeDepth,4);assert.equal(a.metrics.tieExtension.selected,true);assert.equal(a.metrics.tieExtension.complete,true);
 assert.ok(a.metrics.tieExtension.nodes>0&&a.metrics.tieExtension.nodes<=6000);assert.ok(a.metrics.nodes<=45000);
 assert.equal(a.evidence.opening.repair,null,'the four-lock prefix is not imposed as a rigid repair commitment');
 assert.equal(a.evidence.opening.handoffCandidate,null);assert.equal(a.phase,'opening');assert.equal(a.evidence.opening.endpoint.parity,-2,'eligibility parity0 does not require all prefixes to stay balanced');
 assert.equal(S.geometry(end.board).center.patternSupport,'reference-supported');assert.equal(a.evidence.gapAccess.reachable,true);
});

test('opening tied-family advice stays on its target after exact alignment and at landing',()=>{
 const {adaptive:a}=setup();
 for(const count of [5,a.witness.length-1]){
  const moved=R.replay(f.observation,a.witness.slice(0,count));assert.ok(moved.valid);
  const next=P.decide(moved.state,{...config,previous:a});replay(next,moved.state);
  assert.deepEqual(cells(next.continuation[0].event.cells),cells(f.expectedFirstCells),'followed input count '+count);
 }
});

test('opening incomplete extra layer restores nominal advice and keeps spent work',()=>{
 const {nominal}=setup(),limit=nominal.metrics.nodes+6000+200;
 const bounded=P.plan(f.observation,{...config,maxNodes:limit});replay(bounded);
 assert.deepEqual(bounded.continuation,nominal.continuation);assert.equal(bounded.metrics.tieExtension.selected,false);assert.equal(bounded.metrics.tieExtension.complete,false);
 assert.ok(bounded.metrics.nodes>nominal.metrics.nodes);assert.ok(bounded.metrics.nodes<=limit);assert.deepEqual(bounded.metrics.handoffProbes,[]);
 let time=0,interrupted=false;const module={exports:{}},paired={...X,stagePlacements:(s,o)=>{if(s.queue.length===3){time=1000;interrupted=true;return X.stagePlacements(s,{...o,deadline:performance.now()-1});}return X.stagePlacements(s,o);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../st-opening'),'utf8'),{module,require:id=>id==='./st-paired-repair'?paired:require(id.replace('./','../')),Date,performance});
 const timed=module.exports.plan(f.observation,{...config,now:()=>time,deadline:1000});replay(clone(timed));
 assert.equal(interrupted,true);assert.deepEqual(clone(timed.continuation),nominal.continuation);assert.equal(timed.metrics.tieExtension.selected,false);assert.equal(timed.metrics.tieExtension.complete,false);assert.deepEqual(clone(timed.metrics.handoffProbes),[]);
});

test('opening root-tie extension leaves ineligible construction unchanged',()=>{
 const state=clone(f.observation);state.board[39]='I..ZLLL...';
 const normalized=a=>{a=clone(a);delete a.metrics.elapsedMs;return a;};
 S.clearCache();A.clearCache();const a=P.plan(state,{...config,patternHistory:null,maxNodes:8000});
 S.clearCache();A.clearCache();const b=P.plan(state,{...config,patternHistory:null,maxNodes:8000,disableOpeningRootTies:true});
 assert.equal(a.metrics.rootTies,undefined);assert.equal(a.metrics.tieExtension,undefined);assert.deepEqual(normalized(a),normalized(b));
});


test('opening tie coverage cannot enter covered-Left, buried-Center or supplied-repair roots',()=>{
 for(const [y,row,field] of [[38,'XX.ZZ.L...','leftCovered'],[36,'....XX....','buriedCenterVacancies']]){
  const s=clone(f.observation);s.board[y]=row;const facts=O.facts(s.board);
  assert.equal(facts.parity,0);assert.ok(facts.baseDebt>0);assert.ok(Array.isArray(facts[field])?facts[field].length:facts[field]);
  const a=P.plan(s,{...config,patternHistory:null,maxNodes:8000});assert.equal(a.metrics.rootTies,undefined);assert.equal(a.metrics.tieExtension,undefined);
 }
 const a=P.plan(f.observation,{...config,openingRepair:{kind:'untrusted'},maxNodes:8000});assert.equal(a.metrics.rootTies,undefined);assert.equal(a.metrics.tieExtension,undefined);
});

test('real page keeps the ambiguous target through HOLD, alignment, actual lock and Undo',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}respond(a){this.onmessage({data:{type:'result',id:this.message.id,revision:this.message.observation.revision,result:clone(a)}});}};
 const values=[];for(const desired of f.uiBags){const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);values.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}g.window.Math.random=()=>values.shift();
 const select=g.element('#st-fixture');select.value='empty';select.dispatchEvent(new g.window.Event('change'));
 const req=()=>{g.advance(40);return workers.at(-1).message;};req();for(const witness of f.uiPrefix){for(const action of witness)g.window.stLab.act(action);req();}
 let q=req();assert.deepEqual(q.observation.board,f.observation.board);assert.deepEqual(q.observation.queue,f.observation.queue);assert.equal(q.options.openingPhase,true);
 const respond=()=>{q=req();const a=P.decide(q.observation,{...q.options,...config,patternHistory:q.options.patternHistory,previous:q.previous,commitment:q.commitment});assert.deepEqual(cells(a.continuation[0].event.cells),cells(f.expectedFirstCells));workers.at(-1).respond(a);return a;};
 let a=respond();assert.equal(a.evidence.opening.repair,null);g.window.stLab.act('HOLD');a=respond();assert.equal(a.witness[0],'HOLD');g.window.stLab.act('HOLD');
 for(const action of setup().adaptive.witness.slice(0,5))g.window.stLab.act(action);a=respond();
 for(const action of a.witness)g.window.stLab.act(action);q=req();assert.equal(q.options.openingPhase,true);assert.equal(q.options.openingRepair,null);assert.equal(q.commitment,null,'not a rigid four-lock commitment');
 g.click('#st-undo');q=req();assert.deepEqual(q.observation.board,f.observation.board);assert.equal(q.options.openingRepair,null);respond();
}));

test('opening final selection cannot turn an unrelated deeper handoff priority into a tie-extension win',()=>{
 const {nominal,adaptive}=setup(),module={exports:{}},source=fs.readFileSync(require.resolve('../st-opening'),'utf8'),seam='if(verified)best=verified;';
 assert.equal(source.split(seam).length,2);let nominated=null;
 // Selection-order unit control only: substitute an actually searched legal
 // competitor after handoff priority. This is NOT a claimed real clear/handoff.
 const controlled=source.replace(seam,`${seam} if(tieExtension&&base.metrics.tieExtension.complete){const other=beam.find(n=>n.path.length===4&&!ambiguousRoots.has(n.path[0]));if(!other)throw new Error('Missing control competitor');record(other.path);best=verified=other;}`);
 vm.runInNewContext(controlled,{module,require:id=>require(id.replace('./','../')),Date,performance,record:path=>{nominated=clone(path);}});
 const a=clone(module.exports.plan(f.observation,config));assert.ok(nominated);replay({target:nominated[0].target,continuation:nominated});replay(a);
 assert.deepEqual(a.continuation,nominal.continuation);assert.equal(a.metrics.tieExtension.complete,true);assert.equal(a.metrics.tieExtension.selected,false);assert.equal(a.metrics.tieExtension.nonAmbiguousRootWon,true);
 assert.equal(a.evidence.opening.handoffCandidate,null);assert.ok(a.metrics.nodes>=adaptive.metrics.nodes);
});


test('opening ambiguity is limited to uncapped floor with positive partner-completion support',()=>{
 const c=require('./support/st-opening-capped-control.json'),base={...config,patternHistory:c.patternHistory};
 const a=P.plan(c.observation,base),b=P.plan(c.observation,{...base,disableOpeningRootTies:true});replay(a,c.observation);
 assert.deepEqual(cells(a.continuation[0].event.cells),cells(c.expectedFirstCells));assert.equal(a.metrics.rootTies,undefined);assert.equal(a.metrics.tieExtension,undefined);
 assert.deepEqual(a.continuation,b.continuation);
 const capped=clone(f.observation);for(const [x,y]of [[9,37],[8,38],[9,38],[8,39]])capped.board[y]=capped.board[y].slice(0,x)+'Z'+capped.board[y].slice(x+1);
 const unsupported=clone(c.observation);unsupported.board=unsupported.board.map(r=>r.slice(0,7)+'...');
 for(const [state,hasPartner,isUncapped]of [[capped,true,false],[unsupported,false,true]]){
  const facts=O.facts(state.board);assert.equal(facts.centerStatus==='supported-partner-completion',hasPartner);assert.equal(facts.right==='cleared-base',isUncapped);
  assert.equal(facts.notches.status,'established');assert.equal(facts.notches.anchorRow,S.notchPattern(state.board).anchorRow);assert.ok(facts.center.some(h=>h>0));assert.ok(facts.baseDebt>0);assert.deepEqual(facts.buriedCenterVacancies,[]);assert.equal(facts.leftCovered,0);assert.equal(facts.parity,0);
  const n=P.plan(state,{...config,patternHistory:null,maxNodes:8000});assert.equal(n.metrics.rootTies,undefined);assert.equal(n.metrics.tieExtension,undefined);
 }
});
