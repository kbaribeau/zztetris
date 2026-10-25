'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),H=require('../st-resource-history'),D=require('../st-reset-diagnostics');
const corpus=require('./support/st-reset-observed-cycles.json'),clone=x=>JSON.parse(JSON.stringify(x));
const fixture=id=>corpus.fixtures.find(f=>f.id===id);
function replay(f,{until=Infinity,initial=f.initial,steps=f.steps,fresh=false}={}){
 const tail=initial.queue.slice(6);let state=R.createState({...initial,queue:initial.queue.slice(0,6)}),history=H.start(state,{fresh});let count=0;const checkpoints=[];
 function act(action){const before=state;state=R.move(state,action);assert.notEqual(state,before,'Literal witness must execute');while(state.queue.length<6&&tail.length)state={...state,queue:state.queue.concat(tail.shift())};history=H.applyAction(history,before,action,state);assert.ok(['complete','partial'].includes(H.resolve(state,history).coverage.status));return state;}
 for(const step of steps){if(count>=until)break;for(const action of step.witness)act(action);assert.deepEqual(state.lastEvent,step.event,'Actual event must match source geometry');count++;checkpoints.push({state,history});}
 return{act,checkpoints,get state(){return state;},get history(){return history;},get evidence(){return D.resolve(state,history);}};
}
test('Reset evidence: traditional source window is an inferred candidate, never a completion or renewal',()=>{
 const a=replay(fixture('traditional-with-scoring-prefix')),d=a.evidence,p=d.pairs[0];
 assert.deepEqual(a.state.board,fixture('traditional-with-scoring-prefix').finalBoard);
 assert.equal(d.status,'candidate-evidence');assert.deepEqual([p.first.at,p.second.at,p.priorRightTsdAt],[4,12,1]);
 assert.deepEqual(p.parity.contributions,[-2,2]);assert.equal(p.parity.net,0);assert.deepEqual(p.zWindow.observations.map(x=>x.at),[6,18]);
 assert.equal(p.resourceInterpretation.kind,'traditional-count-compatible');assert.equal(p.resourceInterpretation.verified,false);
 assert.equal(p.subsequentScoring[0].at,23);assert.equal(p.subsequentScoring.at(-1).at,55);assert.equal(p.subsequentScoring.at(-1).type,'right-tetris');
 assert.equal(p.completionVerified,false);assert.equal(d.allowanceRenewal,false);assert.equal(d.phaseBoundary,'unknown');assert.equal(H.resolve(a.state,a.history).extraZ.baseline,null);
 assert.equal(d.currentGeometry.at,55);assert.match(d.currentGeometry.scope,/Current board only/);
 const beforeScore=a.checkpoints[17],prefix=D.resolve(beforeScore.state,beforeScore.history);assert.equal(prefix.pairs[0].subsequentScoring.length,0);assert.equal(prefix.pairs[0].completionVerified,false,'Matching counts without later score cannot manufacture completion');
});
test('Reset evidence: earlier observed Z is factual, not imported Extra-Z eligibility',()=>{
 const a=replay(fixture('extra-z-with-observed-prefix')),p=a.evidence.pairs[0];
 assert.deepEqual([p.first.at,p.second.at,p.priorRightTsdAt],[204,206,196]);assert.deepEqual(p.zWindow.observations.map(x=>x.at),[200]);assert.deepEqual(p.zWindow.earlierOutsideWindowObserved.map(x=>x.at),[5]);
 assert.equal(p.resourceInterpretation.kind,'extra-z-count-compatible-if-earlier-use');assert.equal(p.resourceInterpretation.earlierUse,'unknown-for-this-candidate');assert.equal(p.resourceInterpretation.verified,false);
 assert.deepEqual(p.subsequentScoring.map(x=>[x.at,x.type]),[[209,'right-tetris'],[215,'right-tsd']]);
 assert.equal(H.resolve(a.state,a.history).extraZ.status,'unknown');assert.deepEqual(a.state.board,fixture('extra-z-with-observed-prefix').finalBoard);
});
test('Reset evidence: overlapping source allocation boundaries remain ambiguous and never renew',()=>{
 const a=replay(fixture('overlap-with-observed-prefix')),p=a.evidence.pairs[0];
 assert.deepEqual(p.zWindow.observations.map(x=>x.at),[49,60]);assert.deepEqual(p.zWindow.earlierOutsideWindowObserved.map(x=>x.at),[2]);
 assert.equal(p.resourceInterpretation.kind,'ambiguous');assert.equal(p.resourceInterpretation.ambiguousEarlierActivity,true);
 const adjacent=replay(fixture('adjacent-ambiguous-episodes')),pairs=adjacent.evidence.pairs;
 assert.equal(pairs.length,3);assert.equal(pairs[1].status,'unclassified');assert.ok(pairs[1].interveningClears.length>0);
 assert.deepEqual([pairs[2].first.at,pairs[2].second.at],[249,254]);assert.equal(pairs[2].resourceInterpretation.earlierUse,'unknown-for-this-candidate');assert.equal(adjacent.evidence.allowanceRenewal,false);assert.equal(H.resolve(adjacent.state,adjacent.history).extraZ.baseline,null);
 assert.deepEqual(adjacent.state.board,fixture('adjacent-ambiguous-episodes').finalBoard);
});
test('Reset evidence: a pair, an Extra Z alone and an ordinary quad are insufficient',()=>{
 const p=replay(fixture('paired-t-with-scoring-prefix')).evidence.pairs[0];assert.equal(p.status,'paired-t-evidence-only');assert.equal(p.subsequentScoring.length,0);assert.equal(p.completionVerified,false);
 for(const id of ['extra-z-only','ordinary-quad']){const d=replay(fixture(id)).evidence;assert.equal(d.pairs.length,0);assert.equal(d.status,'unknown');assert.equal(d.allowanceRenewal,false);}
});
test('Reset evidence: the known empty-board source opener is not a Reset',()=>{
 const f=require('./support/st-resource-trial-1.json');let s=R.createState(f.initial),h=H.start(s,{fresh:true}),locks=0;
 for(const step of f.steps){const b=s;s=R.move(s,step.action);for(const type of step.revealed||[])s={...s,queue:s.queue.concat(type)};h=H.applyAction(h,b,step.action,s);if(step.action==='HD'&&++locks===14)break;}
 const d=D.resolve(s,h);assert.ok(d.observed.tDiversions.length===2);assert.equal(d.pairs.filter(p=>p.status==='reset-like-candidate').length,0);assert.ok(d.pairs[0].reasons.some(x=>/No prior Right TSD/.test(x)));assert.equal(d.allowanceRenewal,false);
});
test('Reset evidence: unsupported T regions and noncancelling parity remain unclassified',()=>{
 const f=fixture('traditional-with-scoring-prefix'),a=replay(f,{until:1,initial:{...f.initial,queue:['T','T','T','Z','I','O']}});
 a.act('HD');a.act('HD');let p=a.evidence.pairs[0];assert.equal(p.status,'unclassified');assert.equal(p.parity.net,4);assert.ok(p.reasons.some(x=>/straddling/.test(x)));
 a.act('HD');assert.ok(a.evidence.pairs.every(p=>p.status==='unclassified'));assert.ok(a.evidence.pairs.some(p=>p.reasons.some(x=>/overlaps/.test(x))));
});
test('Reset evidence: immutable event history supports Undo and rejects forged, stale or imported metadata',()=>{
 const a=replay(fixture('traditional-with-scoring-prefix')),d=a.evidence,undo=a.checkpoints[11];const older=D.resolve(undo.state,undo.history);
 assert.equal(older.locks,12);assert.equal(older.pairs[0].subsequentScoring.length,0);assert.equal(d.locks,55);assert.equal(D.resolve(a.state,undo.history).status,'unknown');
 assert.equal(D.resolve(a.state,clone(a.history)).status,'unknown');
 for(const raw of [null,{}, {...a.state,board:[]}])assert.equal(D.resolve(raw,a.history).status,'unknown');
 const imported={...a.state,resetEvidence:d,resources:H.resolve(a.state,a.history),history:clone(a.history)},freshHistory=H.start(imported);const fresh=D.resolve(imported,freshHistory);assert.equal(fresh.status,'unknown');assert.equal(fresh.pairs.length,0);
 const before=H.resolve(a.state,a.history);d.pairs[0].zWindow.observations.length=0;d.currentGeometry.leftProfile.length=0;
 assert.equal(a.evidence.pairs[0].zWindow.observations.length,2);assert.deepEqual(H.resolve(a.state,a.history),before,'Diagnostics cannot mutate source allowances or obligations');
});
test('Reset evidence: truncated histories stay unknown instead of deriving a new phase from the board',()=>{
 const f=require('./support/st-resource-trial-1.json');let s=R.createState(f.initial),h=H.start(s,{fresh:true});for(let i=0;i<=H.limits.actions;i++){const b=s;s=R.move(s,i%2?'R':'L');h=H.applyAction(h,b,i%2?'R':'L',s);}const d=D.resolve(s,h);assert.equal(d.coverage.status,'truncated');assert.equal(d.status,'unknown');assert.equal(d.pairs.length,0);assert.equal(d.allowanceRenewal,false);
});

test('Reset evidence: an intervening cross-Right non-scoring T cannot be silently skipped',()=>{
 const f=fixture('traditional-with-scoring-prefix'),a=replay(f,{until:1,initial:{...f.initial,queue:['T','T','T','Z','I','O']}});
 for(const action of ['L','L','HD','R','R','HD','L','L','L','HD','HD'])a.act(action);
 const d=a.evidence;assert.deepEqual(d.observed.nonScoringTs.map(e=>[e.at,e.region]),[[2,'left'],[3,'cross-right'],[4,'left']]);
 assert.deepEqual(d.observed.tDiversions.map(e=>e.at),[2,4]);assert.equal(d.pairs.length,2);assert.ok(d.pairs.every(p=>p.status==='unclassified'));assert.equal(d.pairs.some(p=>p.first.at===2&&p.second.at===4),false,'The unreviewed third T must interrupt pairing');
 assert.equal(d.allowanceRenewal,false);
});
