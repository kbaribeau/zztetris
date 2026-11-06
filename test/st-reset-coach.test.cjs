'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),P=require('../st-planner'),Q=require('../st-reset-policy'),C=require('../st-reset-coach'),S=require('../st-structure');
const observed=require('./support/reset-history.cjs'),clone=x=>JSON.parse(JSON.stringify(x));
test('Reset coach: actual known late history admits Left-only support risk with just one public T',()=>{
 const f=observed(),summary=H.resolve(f.state,f.history),decision=Q.consider(f.state,summary);
 assert.equal(summary.extraZ.status,'used');assert.equal(decision.status,'candidate');assert.ok(decision.deficit.left>0);assert.equal(decision.deficit.center,0);
 assert.equal([f.state.active.type,f.state.hold,...f.state.queue].filter(x=>x==='T').length,1);
 const advice=P.plan(f.state,{resourceContext:f.resourceContext,deadline:Infinity,maxNodes:45000,openingPhase:false});
 assert.ok(advice.target,advice.reason);assert.ok(Array.isArray(advice.evidence.resourceObligations.unclassifiedS));assert.ok(Array.isArray(advice.evidence.resourceObligations.unclassifiedL));assert.equal(advice.evidence.strategy,'reset-coach');assert.ok(Q.qualifies(advice.continuation[0].event));assert.ok(C.check(f.state,advice.continuation,{resourceContext:f.resourceContext,deadline:Infinity}).valid);
 assert.equal(H.resolve(f.state,f.history).reset.status,'inactive','Planning does not mutate actual progress');
});
test('Reset policy: Center-only risk includes lower scoring-row column seven; supported, early and unknown controls decline',()=>{
 const f=observed(),summary=H.resolve(f.state,f.history),s=clone(f.state),anchor=S.notchPattern(s.board).anchorRow;
 for(const y of [anchor,anchor+1]){const row=s.board[y].split('');for(let x=0;x<6;x++)row[x]='X';s.board[y]=row.join('');}
 let row=s.board[anchor+1].split('');row[6]='.';s.board[anchor+1]=row.join('');
 const center=Q.consider(s,summary);assert.equal(center.status,'candidate');assert.equal(center.deficit.left,0);assert.equal(center.deficit.center,1);
 row[6]='X';s.board[anchor+1]=row.join('');assert.equal(Q.consider(s,summary).status,'ordinary-preferred');
 assert.equal(Q.consider(f.state,{...summary,extraZ:{...summary.extraZ,status:'available',remaining:1}}).status,'ordinary-preferred');
 assert.equal(Q.consider(f.state,H.resolve(f.state,H.start(f.state))).status,'unknown-history');
 assert.equal(C.plan(f.state,{resourceContext:{...clone(f.resourceContext),fresh:false}}),null);
});
test('Reset qualification: no other region or any clearing T can count',()=>{
 const e={type:'T',lines:0,cells:[[1,35],[0,36],[1,36],[2,36]]};assert.equal(Q.qualifies(e),true);
 for(const lines of [1,2,3,4])assert.equal(Q.qualifies({...e,lines,spin:'full'}),false);
 for(const shift of [2,4,7])assert.equal(Q.qualifies({...e,cells:e.cells.map(([x,y])=>[x+shift,y])}),false);
 assert.equal(Q.qualifies({...e,type:'J'}),false);
});
test('Reset coach: exhausted proof budget cannot select entry or trust copied progress',()=>{
 const f=observed();for(const options of [{maxNodes:0},{timeMs:0}]){const a=P.plan(f.state,{resourceContext:f.resourceContext,openingPhase:false,...options});assert.equal(a.target,null);assert.equal(H.resolve(f.state,f.history).reset.progress,0);}
 const unknown={...f.state,reset:{status:'active',progress:1},extraZ:{status:'used',baseline:{}}};assert.equal(C.plan(unknown,{}),null);
});
test('Reset coach: actual HOLD and first T keep replayable progress through new preview, session transport and Undo',()=>{
 const f=observed(),a=C.plan(f.state,{resourceContext:f.resourceContext,deadline:Infinity,maxNodes:45000});assert.ok(a.target);
 let state=f.state,history=H.beginReset(f.history,state),previous=a;
 const saved={state,history};
 for(const action of a.witness){const before=state;state=R.move(state,action);assert.notEqual(state,before);history=H.applyAction(history,before,action,state);const options={resourceContext:H.exportContext(state,history),deadline:Infinity};if(action!=='HD'){const kept=P.advance(state,previous,action,options);assert.ok(kept,'retain '+action);assert.deepEqual(kept.target,a.target);previous=kept;}}
 const summary=H.resolve(state,history);assert.equal(summary.reset.status,'active');assert.equal(summary.reset.progress,1);assert.equal(summary.reset.credits[0].pieceId,H.resolve(f.state,f.history).instances.hold.id);
 const transported=H.importContext(state,clone(H.exportContext(state,history)));assert.deepEqual(H.resolve(state,transported).reset,summary.reset);
 assert.equal(H.resolve(saved.state,saved.history).reset.progress,0);
 const context=H.exportContext(state,history),moved=R.move(state,'L');assert.equal(H.resolve(moved,H.importContext(moved,context)).coverage.status,'invalid');
});
test('Reset live cycle: delayed next-bag T, permitted filler quad, actual second-T handback and session replay',()=>{
 const B=require('../st-bag'),Session=require('../st-session'),f=require('./support/st-reset-live-cycle.json');
 let state=R.createState(f.initial),history=H.importContext(state,clone(f.resourceContext));assert.equal(H.resolve(state,history).coverage.status,'complete');assert.equal(Q.consider(state,H.resolve(state,history)).status,'candidate');
 history=H.beginReset(history,state);const origin={state,history};let firstId=null;
 for(const [i,step]of f.steps.entries()){
  for(const {action,revealed}of step.actions){const before=state;state=R.move(state,action);for(const type of revealed)state={...state,queue:state.queue.concat(type),bag:B.consume(state.bag,type)};history=H.applyAction(history,before,action,state);}
  assert.deepEqual(state.lastEvent,step.event);const d=H.resolve(state,history);assert.equal(d.coverage.status,'complete');
  if(i===0){assert.equal(d.reset.progress,1);firstId=d.reset.credits[0].pieceId;}
  if(i<f.steps.length-1)assert.equal(d.reset.status,'active');
  const saved=Session.create(state,{resourceHistory:history,resourceOriginBag:f.resourceOriginBag,openingPhase:false}),imported=Session.prepare(saved);
  assert.deepEqual(H.resolve(imported.state,imported.resourceHistory).reset,d.reset,'Session handoff retains observed progress');
 }
 const d=H.resolve(state,history);assert.equal(d.reset.status,'inactive');assert.equal(d.reset.progress,2);assert.equal(d.reset.episodes.length,1);assert.equal(d.reset.completedAt,d.locks);assert.equal(d.allocations.at(-1).lines,0);assert.notEqual(d.reset.credits[1].pieceId,firstId);assert.notEqual(d.reset.credits[0].bag,d.reset.credits[1].bag);assert.deepEqual(state.board,f.final.board);
 assert.equal(d.extraZ.remaining,2);assert.equal(d.extraZ.status,'available');assert.equal(C.plan(state,{resourceContext:H.exportContext(state,history)}),null,'The Reset coach hands back immediately, not after another TSD');
 assert.equal(H.resolve(origin.state,origin.history).reset.progress,0,'Undo restores pre-first-T progress');
});
test('Reset retention: disabled HOLD cannot reuse an earlier HOLD proof',()=>{
 const f=observed(),a=C.plan(f.state,{resourceContext:f.resourceContext,deadline:Infinity});assert.ok(a.witness.includes('HOLD'));
 assert.equal(C.retain(f.state,a,{resourceContext:f.resourceContext,allowHold:false,deadline:Infinity}),null);
});
test('Reset retention: followed HOLD uses replayed access witnesses, never a new placement search',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),file=require.resolve('../st-reset-coach'),req=createRequire(file),f=observed(),a=C.plan(f.state,{resourceContext:f.resourceContext,deadline:Infinity});assert.equal(a.witness[0],'HOLD');
 let history=H.beginReset(f.history,f.state),state=R.move(f.state,'HOLD');history=H.applyAction(history,f.state,'HOLD',state);
 const box={module:{exports:{}},require:name=>name==='./st-access'?{...req(name),prefix:()=>{throw Error('Unexpected main-thread access search');}}:name==='./st-rules'?{...req(name),placements:()=>{throw Error('Unexpected main-thread placement search');}}:req(name)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),box);const kept=box.module.exports.retain(state,a,{resourceContext:H.exportContext(state,history),deadline:Infinity},'HOLD');assert.ok(kept);assert.deepEqual(JSON.parse(JSON.stringify(kept.target)),a.target);
 const forged=clone(a);forged.evidence.gapAccess={steps:[]};const hasRoof=a.evidence.gapAccess.steps.some(x=>x.cells.length);if(hasRoof)assert.equal(box.module.exports.retain(state,forged,{resourceContext:H.exportContext(state,history),deadline:Infinity},'HOLD'),null,'Missing access witnesses cannot be trusted');
});
test('Reset retention: failed saved proof and new search share the same node budget',()=>{
 const f=observed(),a=C.plan(f.state,{resourceContext:f.resourceContext,deadline:Infinity}),bad=clone(a);bad.continuation[0].event.spin='forged';const limit=a.witness.length;
 const result=P.decide(f.state,{resourceContext:f.resourceContext,previous:bad,maxNodes:limit,deadline:Infinity,openingPhase:false});
 assert.equal(result.target,null);assert.equal(result.metrics.revalidationNodes,limit);assert.ok(result.metrics.nodes<=limit);
 const missing=clone(a);delete missing.evidence.gapAccess;assert.equal(C.retain(f.state,missing,{resourceContext:f.resourceContext,deadline:Infinity}),null);
});
test('Reset certification: rejected high-ranked candidates cannot hide a checked prefix beyond beam width',()=>{
 const f=require('./support/st-reset-certification-miss.json'),options={resourceContext:f.resourceContext,depth:3,width:8,maxNodes:45000,deadline:Infinity};
 const known=C.check(f.initial,f.continuation,options);assert.equal(known.valid,true);assert.equal(known.node.resource.resetProgress,1);assert.equal(known.node.resource.extraZRemaining,1);
 const result=C.plan(f.initial,options);assert.ok(result.target,result.reason);assert.ok(result.metrics.nodes<=45000);assert.equal(C.check(f.initial,result.continuation,options).valid,true);
 assert.equal(result.evidence.reset.progress,1);assert.equal(result.evidence.resourceObligations.remainingZ,1);
 const before=H.resolve(f.initial,H.importContext(f.initial,f.resourceContext));assert.equal(before.reset.status,'active');assert.equal(before.reset.progress,1);
 assert.ok(result.evidence.resourceObligations.hangingS.some(s=>s.id===111),'The checked escape preserves the unresolved S identity');
 assert.equal(C.plan(f.initial,{...options,maxNodes:0}).target,null,'Scanning beyond rank eight does not bypass the shared budget');
 const active=P.plan(f.initial,options);assert.equal(active.evidence.strategy,'reset-coach');assert.equal(active.metrics.resetOrdinaryProbe,undefined,'An active Reset cannot switch to ordinary proof preference');
});
test('Reset consideration preserves a fresh certified public HOLD-to-TSD alternative',()=>{
 const f=require('./support/st-reset-visible-scoring-alternative.json'),options={resourceContext:f.resourceContext,patternHistory:f.patternHistory,openingPhase:false,maxNodes:45000,depth:3,width:8,deadline:Infinity};
 assert.equal(Q.consider(f.initial,H.resolve(f.initial,H.importContext(f.initial,f.resourceContext))).status,'candidate');
 const result=P.plan(f.initial,options);assert.ok(result.target,result.reason);assert.notEqual(result.evidence.strategy,'reset-coach');assert.equal(result.evidence.resetConsideration.preference.kind,'certified-visible-TSD');
 assert.ok(result.continuation.some(p=>p.event.type==='T'&&p.event.lines===2&&p.event.spin==='full'));assert.ok(result.continuation.every(p=>p.event.type!=='T'||p.event.lines===2));assert.ok(result.metrics.nodes<=45000);
 let state=R.createState(f.initial);for(const p of result.continuation){const r=R.replay(state,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[p.event]);state=r.state;}
 assert.equal(H.resolve(f.initial,H.importContext(f.initial,f.resourceContext)).reset.status,'inactive','Consideration and proof search never start actual Reset');
});
test('Reset consideration retains an exact public support repair before entry, not an arbitrary safe filler',()=>{
 const f=require('./support/st-reset-retained-support-alternative.json'),options={resourceContext:f.resourceContext,patternHistory:f.patternHistory,commitment:f.ordinaryCommitment,openingPhase:false,maxNodes:45000,depth:3,width:8,deadline:Infinity};
 const result=P.decide(f.initial,options);assert.ok(result.target,result.reason);assert.equal(result.evidence.resetConsideration.preference.kind,'retained-support-repair');assert.deepEqual(result.target,f.ordinaryCommitment.advice.target);assert.equal(result.continuation[0].event.type,'J');assert.ok(result.metrics.nodes<=45000);
 const state=R.replay(f.initial,result.witness).state,summary=H.resolve(f.initial,H.importContext(f.initial,f.resourceContext));assert.deepEqual(Q.consider(state,summary).deficit,{left:0,center:0});
 const noHold=P.decide(f.initial,{...options,allowHold:false});assert.notEqual(noHold.evidence.resetConsideration?.preference?.kind,'retained-support-repair');assert.ok((noHold.continuation||[]).every(p=>!p.witness.includes('HOLD')));
 for(const bound of [{maxNodes:0},{maxNodes:5},{deadline:0},{now:()=>100,deadline:100}]){const a=P.decide(f.initial,{...options,...bound});assert.equal(a.target,null);assert.ok(a.metrics.nodes<=(bound.maxNodes??45000));}
});
test('Reset ordinary probe charges nonzero resource verification work exactly once',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),file=require.resolve('../st-planner'),req=createRequire(file),f=require('./support/st-reset-retained-support-alternative.json');
 const source=fs.readFileSync(file,'utf8'),needle='const result=resourceEndpointCore(raw,path,options);';assert.equal(source.split(needle).length,2);
 const box={module:{exports:{}},require:req,Date};vm.runInNewContext(source.replace(needle,needle+'result.visited=(result.visited||0)+17;'),box);
 const options={resourceContext:f.resourceContext,patternHistory:f.patternHistory,commitment:f.ordinaryCommitment,openingPhase:false,maxNodes:45000,deadline:Infinity},tracker={nodes:0};
 const retained=box.module.exports.revalidate(f.initial,f.ordinaryCommitment.advice,{...options,budgetTracker:tracker});assert.ok(retained);assert.equal(tracker.nodes,retained.metrics.nodes,'Resource verification is included in the shared tracker, not only returned metrics');
 const result=box.module.exports.plan(f.initial,options),literalCost=result.continuation.reduce((sum,p)=>sum+p.witness.length,0);assert.equal(result.evidence.resetConsideration.preference.kind,'retained-support-repair');assert.equal(result.metrics.nodes,tracker.nodes+literalCost);assert.equal(result.metrics.resetOrdinaryProbe.nodes,result.metrics.nodes);
});
test('Reset comparison preserves a literal saved prefix extended to a certified visible TSD',()=>{
 const f=require('./support/st-reset-exact-prefix-scoring.json'),options={resourceContext:f.resourceContext,patternHistory:f.patternHistory,commitment:f.originalCommitment,openingPhase:false,depth:3,width:8,maxNodes:45000,deadline:Infinity};
 const saved=f.originalCommitment.advice.continuation,result=P.plan(f.initial,options);
 assert.ok(result.target,result.reason);assert.equal(result.evidence.resetConsideration?.preference?.kind,'certified-visible-TSD');assert.equal(result.metrics.commitmentComparison.resetExactPrefixExtension,true);
 for(const [i,p]of saved.entries()){assert.deepEqual(result.continuation[i].event,p.event);assert.deepEqual(result.continuation[i].witness,p.witness);}
 assert.ok(result.continuation.length>saved.length);assert.ok(result.continuation.some(p=>p.event.type==='T'&&p.event.lines===2&&p.event.spin==='full'));assert.ok(result.metrics.nodes<=45000);
 let state=R.createState(f.initial);for(const p of result.continuation){const r=R.replay(state,p.witness);assert.equal(r.valid,true);assert.deepEqual(r.events,[p.event]);state=r.state;}
});
test('Reset exact-prefix exception cannot reorder a saved Center payment or use a public opt-in flag',()=>{
 const f=require('./support/st-reset-reordered-scoring-control.json'),options={resourceContext:f.resourceContext,patternHistory:f.patternHistory,commitment:f.originalCommitment,openingPhase:false,depth:3,width:8,maxNodes:45000,deadline:Infinity,resetExactPrefixExtension:true};
 assert.equal(f.originalCommitment.advice.continuation[0].event.type,'L');assert.equal(f.capturedAdvice.continuation[0].event.type,'J');
 const result=P.plan(f.initial,options);assert.notEqual(result.evidence.resetConsideration?.preference?.kind,'certified-visible-TSD');assert.equal(result.metrics.resetOrdinaryProbe.selected,false);assert.ok(result.metrics.nodes<=45000);
});
test('Reset exact-prefix scoring cannot trust changed saved events or witnesses, disabled HOLD or expired budget',()=>{
 const f=require('./support/st-reset-exact-prefix-scoring.json'),options={resourceContext:f.resourceContext,patternHistory:f.patternHistory,commitment:f.originalCommitment,openingPhase:false,depth:3,width:8,maxNodes:45000,deadline:Infinity};
 for(const mutation of ['witness','event','same-result-witness']){const saved=clone(f.originalCommitment);if(mutation==='witness')saved.advice.continuation[0].witness=['HD'];else if(mutation==='event')saved.advice.continuation[0].event.cells[0][0]=0;else {saved.advice.continuation[0].witness=['R','L',...saved.advice.continuation[0].witness];assert.deepEqual(R.replay(f.initial,saved.advice.continuation[0].witness).events,[f.originalCommitment.advice.continuation[0].event]);}
  const a=P.plan(f.initial,{...options,commitment:saved});assert.notEqual(a.metrics.commitmentComparison?.resetExactPrefixExtension,true);assert.ok(a.metrics.nodes<=45000);
 }
 const noHold=P.plan(f.initial,{...options,allowHold:false});assert.notEqual(noHold.metrics.commitmentComparison?.resetExactPrefixExtension,true);assert.ok((noHold.continuation||[]).every(p=>!p.witness.includes('HOLD')));
 const expired=P.plan(f.initial,{...options,now:()=>123,deadline:123});assert.equal(expired.target,null);assert.ok(expired.metrics.nodes<=45000);
});
