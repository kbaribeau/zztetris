'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const R=require('../st-rules'),B=require('../st-bag'),E=require('../scripts/lib/st-simulation.cjs');
const L=require('../scripts/lib/st-mino-ledger.cjs'),O=require('../scripts/lib/st-mino-origins.cjs'),CLI=require('../scripts/analyze-st-minos.cjs');
const contract=require('./support/st-generated-input-contract.json'),fixture=require('./support/st-mino-ledger-witnesses.json');
const clone=x=>JSON.parse(JSON.stringify(x));
// Pure rules only. These are retained actual witnesses, never newly searched advice.
function trace(input,witnesses,{summary=false}={}){
 let state=R.createState(input.initial),cursor=0,lines=0;const records=[];
 for(const witness of witnesses){const observation=L.publicState(state),actions=[];let event=null;
  for(const action of witness){const next=R.move(state,action);assert.notEqual(next,state);state=next;if(next.lastEvent)event=clone(next.lastEvent);
   while(state.queue.length<6){const piece=input.future[cursor++];assert.ok(piece);state={...state,queue:[...state.queue,piece],...(state.bag?{bag:B.consume(state.bag,piece)}:{})};}
   actions.push({action,draws:cursor,observationHash:E.digest(L.publicState(state))});
  }
  assert.ok(event);lines+=event.lines;records.push({kind:'lock',lock:records.length+1,request:{observation},advice:{witness,target:event.target},event,actions,after:L.publicState(state),draws:cursor});
 }
 if(summary)records.push({kind:'summary',summary:{schemaVersion:1,scenario:input.scenario,seed:input.seed,inputHash:input.inputHash,cap:input.locks,locks:records.length,lines,stop:state.topOut?'top-out':'lock-cap',censored:!state.topOut,finalObservation:L.publicState(state)}});
 return records;
}
function imported(initial,locks=1){return{schemaVersion:1,scenario:'imported',locks,initial:L.publicState(R.createState({queue:[...'IJLOST'],...initial})),future:[...'IJLOSTZ'.repeat(20)]};}
const input=E.makeInput('empty',fixture.seed,fixture.generationLocks);input.locks=fixture.evaluationCap;
const origins=O.resolve(input),recorded=Object.fromEntries(Object.entries(fixture.arms).map(([k,a])=>[k,trace(input,a.witnesses)]));
const ledgers=Object.fromEntries(Object.entries(recorded).map(([k,r])=>[k,L.analyze(input,r,{origins})]));
test('mino ledger/default generator bytes and public request boundary are unchanged',()=>{
 for(const c of contract.cases){const a=E.makeInput(c.scenario,c.seed,c.locks),b=E.makeInput(c.scenario,c.seed,c.locks,{withOrigins:true});assert.equal(E.digest(a),c.sha256);assert.ok(b.pieceOrigins);delete b.pieceOrigins;assert.deepEqual(a,b);assert.equal('pieceOrigins' in a,false);}
 const ordinary=E.createSession(E.makeInput('empty',123,2)).request(1,E.CONFIG),tagged=E.createSession(E.makeInput('empty',123,2,{withOrigins:true})).request(1,E.CONFIG);assert.deepEqual(tagged,ordinary);for(const forbidden of ['pieceOrigins','tokenId','bagId','future','seed'])assert.equal(JSON.stringify(tagged).includes('\"'+forbidden+'\"'),false);
 for(const [arm,l]of Object.entries(ledgers))assert.equal(l.finalObservationHash,fixture.arms[arm].finalObservationHash);
 assert.equal(origins.generationLocks,70);assert.equal(origins.evaluationCap,150);
});
test('mino ledger/original bags follow repeated HOLD and identical letters across bag boundaries',()=>{
 const b=ledgers.baseline,c=ledgers.candidate;
 assert.deepEqual(b.bags[0].placed,[13,15,0]);assert.deepEqual(c.bags[0].placed,[18,10,0]);assert.equal(b.bags[0].completedAtLock,11);assert.equal(c.bags[0].completedAtLock,7);
 const six=b.locks[5];assert.equal(six.held.type,'J');assert.equal(six.active.type,'J');assert.equal(six.held.bagId,'bag-1');assert.equal(six.active.bagId,'bag-2');assert.notEqual(six.held.id,six.active.id);
 assert.deepEqual(c.locks.slice(0,7).map(r=>r.sourceSlot),[1,3,4,5,2,7,6]);
 const at7=L.analyze(input,recorded.baseline.slice(0,7),{origins});assert.equal(at7.bags[0].sourceCoverageComplete,true);assert.equal(at7.bags[0].allTokensLocked,false);assert.equal(at7.bags[0].pendingAndLocked.held,1);
});
test('mino ledger/actual straddling cells and older source-bag clear ownership conserve mass',()=>{
 assert.throws(()=>{L.REGIONS[0].width=99;},TypeError);assert.throws(()=>{L.REGIONS[0].columns[0]=9;},TypeError);const l=ledgers.candidate;assert.deepEqual(l.totals.placed,[46,40,14]);assert.deepEqual(l.totals.cleared,[16,12,12]);assert.deepEqual(l.totals.remaining,[30,28,2]);
 assert.ok(l.locks.some(r=>r.placed.filter(Boolean).length>1));assert.ok(l.locks.some(r=>Object.keys(r.clearedByBag).some(b=>b!==r.bagId)));
 for(const b of l.bags)assert.deepEqual(b.initial.map((v,i)=>v+b.placed[i]-b.cleared[i]),b.remaining);
 for(const r of l.locks)assert.equal(r.placed.reduce((a,b)=>a+b),4);
});
test('mino ledger/empty HOLD then repeated same-type HOLD preserves source identity, not letters',()=>{
 const i=imported({active:'J',hold:null,queue:[...'JIJLOST'] .slice(0,6)}),records=trace(i,[['HOLD','HOLD','HOLD','HD']]),l=L.analyze(i,records),h=l.locks[0].holdActions;
 assert.equal(h.length,3);assert.equal(h[0].draws,1);assert.equal(h[1].draws,1);assert.equal(h[2].draws,1);
 assert.equal(h[0].active.type,h[0].held.type);assert.notEqual(h[0].active.id,h[0].held.id);assert.equal(h[1].active.id,h[0].held.id);assert.equal(h[2].active.id,h[0].active.id);assert.equal(l.locks[0].tokenId,h[2].active.id);
});
test('mino ledger/nonadjacent clears add new cells first and shift surviving owners exactly',()=>{
 const board=R.emptyBoard();board[37]=board[39]='.#########';const i=imported({board,active:{type:'I',x:-2,y:20,rotation:1,lastRotation:null}}),r=trace(i,[['HD']]),l=L.analyze(i,r);
 assert.deepEqual(r[0].event.clearedRows,[37,39]);assert.deepEqual(l.totals.initial,[6,6,6]);assert.deepEqual(l.totals.placed,[4,0,0]);assert.deepEqual(l.totals.cleared,[8,6,6]);assert.deepEqual(l.totals.remaining,[2,0,0]);assert.equal(r[0].after.board[38][0],'I');assert.equal(r[0].after.board[39][0],'I');
 assert.ok(l.windows[0].delta.some(x=>x<0));assert.deepEqual(l.windows[0].startMass,[6,6,6]);assert.equal(l.windows[0].partial,true);
});
test('mino ledger/pre-full imported rows clear unknown old cells even without a new cell there',()=>{
 const board=R.emptyBoard();board[39]='##########';const i=imported({board,active:'O'}),r=trace(i,[['HD']]),l=L.analyze(i,r);
 assert.deepEqual(r[0].event.clearedRows,[39]);assert.ok(r[0].event.cells.every(([,y])=>y!==39));assert.deepEqual(l.totals.cleared,[4,3,3]);assert.equal(l.bags.length,1);assert.equal(l.bags[0].id,'unknown');assert.equal(l.bags[0].sourceCoverageComplete,false);assert.deepEqual(l.totals.remaining,[0,4,0]);
});
test('mino ledger/imports and unmatched generation stay unknown, stable starts remain partially unattributed',()=>{
 const stable=E.makeInput('stable',123,10),o=O.resolve(stable),l=L.analyze(stable,[],{origins:o});assert.equal(o.known,true);assert.equal(o.initialBagKnown,false);assert.equal(o.futureFirstSlot,1);assert.equal(l.inventory.active.bagId,'unknown');assert.ok(l.inventory.preview.every(t=>t.bagId==='unknown'));

 stable.locks=20;const later=L.analyze(stable,trace(stable,Array.from({length:14},(_,n)=>n%3===0?['L','L','L','HD']:n%3===1?['HD']:['R','R','R','HD'])),{origins:O.resolve(stable)}),partial=later.bags.find(b=>b.id==='bag-1');assert.equal(partial.priorUnattributedPieces,1);assert.equal(partial.observedTokens,6);assert.equal(partial.pendingAndLocked.locked,6);assert.equal(partial.unrevealedSourcePieces,0);assert.equal(partial.sourceCoverageComplete,false);assert.equal(partial.allTokensLocked,false);assert.ok(later.locks.slice(0,7).every(r=>r.bagId==='unknown'));assert.deepEqual(later.locks.slice(7,13).map(r=>r.sourceSlot),[2,3,4,5,6,7]);assert.equal(later.locks[13].bagId,'bag-2');assert.equal(later.locks[13].sourceSlot,1);assert.equal(later.bags.find(b=>b.id==='bag-2').sourceCoverageComplete,true);assert.equal(later.bags.find(b=>b.id==='bag-2').allTokensLocked,false);assert.equal(later.bags.find(b=>b.id==='bag-3').observedTokens,1);

 for(const change of [x=>{x.seed++;},x=>{x.future[0]=x.future[0]==='I'?'J':'I';},x=>{x.inputHash='stale';},x=>{x.rng='other';},x=>{x.schemaVersion=99;}]){const bad=clone(input);change(bad);bad.pieceOrigins={known:true,initialBagKnown:true};assert.equal(O.resolve(bad).known,false);}
 const unknown=L.analyze(input,recorded.candidate);assert.deepEqual(unknown.totals,ledgers.candidate.totals);assert.equal(unknown.bags.length,1);assert.equal(unknown.bags[0].id,'unknown');assert.equal(unknown.bags[0].allTokensLocked,false);
 assert.throws(()=>L.analyze(input,[],{origins:{...origins,inputIdentityHash:'wrong'}}),/bound/);
});
test('mino ledger/rewinding a verified prefix restores inventory and leaves input and previous ledger immutable',()=>{
 const before=JSON.stringify({input,recorded,ledgers}),six=L.analyze(input,recorded.baseline.slice(0,6),{origins}),seven=L.analyze(input,recorded.baseline.slice(0,7),{origins});
 assert.notDeepEqual(six.inventory,seven.inventory);assert.deepEqual(L.analyze(input,recorded.baseline.slice(0,6),{origins}),six);assert.equal(six.coverage.kind,'verified-recorded-prefix');assert.equal(JSON.stringify({input,recorded,ledgers}),before);
 assert.equal(ledgers.candidate.windows.length,75);assert.equal(ledgers.candidate.windows.find(w=>w.endLock===7&&w.requestedLocks===7).partial,false);
});
test('mino ledger/top-out still owns the final four cells and records blocked spawn inventory',()=>{
 const board=R.emptyBoard();board[20]='....XX....';const i=imported({board,active:'O'}),r=trace(i,[['HD']],{summary:true}),l=L.analyze(i,r);assert.equal(r[0].event.topOut,true);assert.equal(l.coverage.summaryReconciled,true);assert.equal(l.coverage.stop,'top-out');assert.equal(l.totals.placed.reduce((a,b)=>a+b),4);assert.ok(l.inventory.active);assert.equal(l.locks.length,1);
});
test('mino ledger/corrupt actions, draw cursors, clear rows, states and terminal records are rejected',()=>{
 const single=()=>clone(recorded.candidate.slice(0,1));
 for(const change of [r=>{r[0].actions[0].observationHash='bad';},r=>{r[0].actions[0].draws++;},r=>{r[0].event.clearedRows=[39];},r=>{r[0].after.hold='T';},r=>{r[0].lock=2;},r=>{r[0].request.observation.revision++;},r=>{r[0].advice.witness[0]='BOGUS';}]){const r=single();change(r);assert.throws(()=>L.analyze(input,r,{origins}));}
 const i=E.makeInput('empty',123,1),r=trace(i,[['HD']],{summary:true});assert.equal(L.analyze(i,r,{origins:O.resolve(i)}).coverage.summaryReconciled,true);
 for(const change of [r=>{r[1].summary=null;},r=>{r[1].summary.lines++;},r=>{r[1].summary.finalObservation.revision++;},r=>{r[1].summary.cap++;},r=>{r[1].summary.censored=false;},r=>{r[1].summary.locks=0;r[1].summary.finalObservation=i.initial;r.shift();},r=>{r.push(r[0]);},r=>{r.push(r[1]);}]){const bad=clone(r);change(bad);assert.throws(()=>L.analyze(i,bad));}
 const stop={kind:'stop',lock:2,request:{observation:r[0].after},advice:{status:'stopped'}};assert.throws(()=>L.analyze(i,[r[0],stop]),/Stop lock/);assert.throws(()=>L.analyze(i,[r[0],{...stop,lock:1},{...stop,lock:1}]),/Duplicate stop/);
});
test('mino ledger/CLI exports bounded JSON and three CSVs without changing source artifacts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-mino-ledger-'));try{const i=E.makeInput('empty',123,1),r=trace(i,[['HD']],{summary:true}),inputPath=path.join(dir,'input.json'),tracePath=path.join(dir,'trace.jsonl');fs.writeFileSync(inputPath,JSON.stringify(i));fs.writeFileSync(tracePath,r.map(JSON.stringify).join('\n')+'\n');const before=[fs.readFileSync(inputPath,'utf8'),fs.readFileSync(tracePath,'utf8')];
  const out=path.join(dir,'analysis'),result=CLI.analyzeDirectory(dir,{out});assert.equal(result.coverage.locks,1);const l=JSON.parse(fs.readFileSync(path.join(out,'ledger.json')));assert.equal(l.artifact.inputSha256,E.digest(before[0]));assert.ok(l.artifact.sources['st-fixtures.js']);for(const file of ['locks.csv','bags.csv','windows.csv'])assert.ok(fs.readFileSync(path.join(out,file),'utf8').split('\n').length>2);assert.deepEqual([fs.readFileSync(inputPath,'utf8'),fs.readFileSync(tracePath,'utf8')],before);
  assert.throws(()=>CLI.analyzeDirectory(dir,{out}),/EEXIST/);const prefix=CLI.analyzeDirectory(dir,{out:path.join(dir,'prefix'),prefixLocks:0});assert.equal(prefix.coverage.kind,'verified-recorded-prefix');assert.equal(prefix.coverage.locks,0);assert.throws(()=>CLI.analyzeDirectory(dir,{out:path.join(dir,'bad'),prefixLocks:2}),/exceeds/);
  fs.writeFileSync(tracePath,[{kind:'summary',summary:r.at(-1).summary},r[0]].map(JSON.stringify).join('\n'));assert.throws(()=>CLI.analyzeDirectory(dir,{out:path.join(dir,'bad-prefix'),prefixLocks:1}),/follows terminal/);
  fs.writeFileSync(tracePath,r.map(JSON.stringify).join('\n'));const episodeDir=path.join(dir,'empty-123');fs.mkdirSync(episodeDir);for(const file of ['input.json','trace.jsonl'])fs.copyFileSync(path.join(dir,file),path.join(episodeDir,file));const exports=require('../scripts/simulate-st.cjs').exportMinoLedgers(dir,[{scenario:'empty',seed:123}]);assert.equal(exports[0].coverage.locks,1);assert.ok(fs.existsSync(path.join(episodeDir,'mino-ledger','bags.csv')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 assert.deepEqual(require('../scripts/simulate-st.cjs').parse(['--mino-ledger']),{'mino-ledger':true});assert.throws(()=>require('../scripts/simulate-st.cjs').main(['--mino-ledger','--replay','unused']),/post-processing/);assert.throws(()=>CLI.parse(['--episode']),/Missing/);assert.throws(()=>CLI.parse(['--unknown']),/Unknown/);assert.throws(()=>L.analyze(input,[],{windowSizes:[0]}),/rolling/);assert.throws(()=>L.analyze(input,Array.from({length:2001},()=>({kind:'lock'}))),/2000/);
});
