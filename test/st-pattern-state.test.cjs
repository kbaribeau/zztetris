'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),H=require('../st-pattern-history'),P=require('../st-planner'),Session=require('../st-session');
const Context=require('../st-obligation-context');
const F=require('./support/st-gap-phase.json'),clone=x=>JSON.parse(JSON.stringify(x));
function lock(state,witness=['HD']){const before=R.replay(state,witness.slice(0,-1));assert.equal(before.valid,true);const replay=R.replay(before.state,['HD']);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);return{before:before.state,after:replay.state,event:replay.events[0]};}
function quad(){return lock(R.createState(F.quad.observation),F.quad.witness);}
function currentQuad(){const q=quad();return{...q,history:H.update(H.start(F.quad.observation),q.before,q.after,q.event)};}
function legacyQuad(){const q=quad();return{...q,history:{origin:F.quad.observation.board.slice(),steps:[{pose:clone(q.before.active),event:clone(q.event)}]}};}
function compact(value){assert.equal(value.version,H.VERSION);assert.deepEqual(Object.keys(value).sort(),['anchorRow','blockedRows','source','status','version']);assert.equal(value.origin,undefined);assert.equal(value.steps,undefined);}

test('notch current state: imported facts need no board provenance or past witnesses',()=>{
 const state=F.after.observation,imported={version:2,status:'established',anchorRow:38,blockedRows:[]},before=JSON.stringify([state,imported]);
 assert.equal(S.notchPattern(state.board).status,'unanchored');
 const facts=H.resolve(state,imported);
 assert.deepEqual(facts,{status:'established',anchorRow:38,protectedRows:[38,35,32,29,26,23,20,17,14,11,8,5,2],blockedRows:[],source:'imported-current-state'});
 const saved=H.snapshot(state,imported);compact(saved);assert.deepEqual(H.resolve(state,saved),facts);
 // This other board cannot authenticate the claimed phase either. It is a
 // trusted current obligation, not a certificate asserting board derivation.
 assert.deepEqual(H.resolve({board:R.emptyBoard()},saved),facts);
 saved.blockedRows.push(38);assert.deepEqual(imported.blockedRows,[]);assert.equal(JSON.stringify([state,imported]),before);
});

test('notch current state: malformed snapshots fail closed rather than falling back to recognition',()=>{
 const good={version:2,status:'established',anchorRow:38,blockedRows:[]};
 for(const bad of [false,[],1,'phase',{},
  {...good,version:1},{...good,status:'unanchored'},{...good,anchorRow:null},{...good,anchorRow:40},{...good,anchorRow:-4},{...good,anchorRow:1.5},
  {...good,blockedRows:null},{...good,blockedRows:[38]},{...good,status:'broken'},
  {...good,status:'broken',blockedRows:[37]},{...good,status:'broken',blockedRows:[38,38]},
  {...good,source:{}},{...good,source:''},{...good,origin:R.emptyBoard()},{...good,steps:[]},{...good,protectedRows:[]}]){
  assert.equal(H.resolve(F.after.observation,bad).status,'invalid-history',JSON.stringify(bad));
  assert.equal(H.resolve(F.after.observation,H.snapshot(F.after.observation,bad)).status,'invalid-history');
 }
 assert.equal(H.resolve(F.after.observation,{...good,anchorRow:-3}).status,'established','the existing next-cap rule can place the next arm just above the field');
 assert.deepEqual(H.resolve(F.after.observation,{...good,status:'broken',blockedRows:[2,38]}).blockedRows,[38,2]);
});

test('notch current state: actual quad checkpoints transport while obsolete tapes reject',()=>{
 const q=currentQuad(),facts=H.resolve(q.after,q.history);assert.equal(facts.anchorRow,38);assert.equal(facts.source,'translated-established-cycle');
 const saved=JSON.parse(JSON.stringify(H.snapshot(q.after,q.history)));compact(saved);assert.deepEqual(H.resolve(q.after,saved),facts);
 const legacy=legacyQuad().history;assert.equal(H.resolve(q.after,legacy).status,'invalid-history');assert.equal(H.resolve(F.quad.observation,legacy).status,'invalid-history');
 assert.equal(H.resolve(q.after,{...legacy,steps:[null]}).status,'invalid-history');
 // Event/pose authenticity remains an actual-lock contract even though current
 // snapshots no longer authenticate their facts by replaying an old tape.
 const prior=H.start(F.quad.observation);
 for(const mutate of [e=>e.cells[0][0]=0,e=>e.lines=0,e=>e.spin='full',e=>e.clearedRows=[]]){
  const event=clone(q.event);mutate(event);assert.equal(H.resolve(q.after,H.update(prior,q.before,q.after,event)).status,'invalid-history');
 }
 const wrongPose={...q.before,active:{...q.before.active,rotation:9}};assert.equal(H.resolve(q.after,H.update(prior,wrongPose,q.after,q.event)).status,'invalid-history');
 const next=lock(q.after,['L','HD']),updated=H.update(q.history,next.before,next.after,next.event);compact(updated);
 assert.deepEqual(updated,H.update(saved,next.before,next.after,next.event),'Transport preserves the next actual notch transition');
});

test('notch current state: canonical TSD consumes only its current arm and quad translates the surviving phase',()=>{
 const state=R.createState(require('../st-fixtures').get('direct-double').observation),witness=['R','R','R','CW',...Array(17).fill('SD'),'CW','HD'],q=lock(state,witness),prior=H.start(state);
 assert.deepEqual(q.event.clearedRows,[36,37]);assert.equal(q.event.spin,'full');assert.equal(prior.anchorRow,36);
 const next=H.update(prior,q.before,q.after,q.event);compact(next);assert.equal(next.anchorRow,35);assert.deepEqual(next.blockedRows,[]);
 assert.deepEqual(H.resolve(q.after,next).protectedRows,[35,32,29,26,23,20,17,14,11,8,5,2]);
 assert.equal(next.source,S.notchPattern(q.after.board).source,'fresh recognition keeps the former updater diagnostic when its anchor agrees');
 const four=quad(),translated=H.update(H.start(F.quad.observation),four.before,four.after,four.event);compact(translated);assert.equal(translated.anchorRow,38);assert.equal(translated.source,'translated-established-cycle');
 assert.equal(S.notchPattern(four.after.board).status,'unanchored');
});

test('notch current state: a real newly established cap is captured and broken facts remain sticky after clears',()=>{
 const board=R.emptyBoard();board[39]='.........X';const state=R.createState({board,active:{type:'Z',x:7,y:17,rotation:1},queue:['O']}),q=lock(state);
 assert.equal(H.start(state),null);assert.equal(H.resolve(state,null).status,'unanchored');
 const established=H.update(null,q.before,q.after,q.event);compact(established);assert.equal(established.anchorRow,37);assert.equal(established.status,'established');assert.equal(established.source,'recognized-scoring-wall');
 const broken=R.createState(F.quad.observation);broken.board[34]=broken.board[34].slice(0,6)+'X'+broken.board[34].slice(7);
 const prior=H.start(broken),four=lock(broken,F.quad.witness),sticky=H.update(prior,four.before,four.after,four.event);
 assert.equal(prior.status,'broken');assert.deepEqual(prior.blockedRows,[34]);assert.equal(four.event.lines,4);assert.equal(four.after.board[38][6],'X');
 assert.deepEqual(sticky,prior,'an already broken phase is not translated or repaired by later board changes');
 assert.equal(H.resolve(four.after,sticky).status,'broken');
});

test('notch current state: failed actual-lock checks keep an invalid snapshot instead of dropping the obligation',()=>{
 const q=quad(),prior=H.start(q.before),mutated=clone(q.event);mutated.lines=0;
 for(const next of [H.update(prior,q.before,q.after,mutated),H.update(prior,q.before,{...q.after,board:R.emptyBoard()},q.event),H.update({origin:[],steps:[]},q.before,q.after,q.event)]){
  assert.equal(next.version,H.VERSION);assert.equal(H.resolve(q.after,next).status,'invalid-history');assert.equal(next.origin,undefined);assert.equal(next.steps,undefined);
 }
});

test('notch current state: 1000 real manual locks retain fixed-size current facts beyond the legacy 128-lock limit',()=>{
 // Deliberately O-only public supply, not a seven-bag or supported ST route.
 // Every five actual locks clears two rows and returns to an empty board.
 let state=R.createState({active:'O',queue:['O']}),history=H.start(state),stable,stableBytes;const snapshots=[];
 for(let i=0;i<1000;i++){
  state={...state,queue:['O']};const offset=[-4,-2,0,2,4][i%5],q=lock(state,[...Array(Math.abs(offset)).fill(offset<0?'L':'R'),'HD']),prior=history;
  if(i<15)snapshots.push({before:q.before,history:clone(prior)});
  history=H.update(history,q.before,q.after,q.event);state=q.after;compact(history);assert.notEqual(history.status,'invalid-history');
  if(i===9){stable=clone(history);stableBytes=JSON.stringify(history).length;assert.equal(stable.status,'broken');assert.equal(stable.anchorRow,39);assert.deepEqual(stable.blockedRows,[39]);}
  if(i>=9){assert.deepEqual(history,stable);assert.equal(JSON.stringify(history).length,stableBytes);}
  if(i%5===4)assert.deepEqual(state.board,R.emptyBoard());
 }
 assert.equal(state.streamCursor,1000);
 for(const saved of snapshots.reverse())assert.notEqual(H.resolve(saved.before,saved.history).status,'invalid-history','caller-owned Undo checkpoints remain independent of later locks');
 assert.equal(snapshots.at(-1).history.status,'established');assert.equal(snapshots.at(-1).history.anchorRow,37);
});

function currentSession(position,pattern){const snapshot=Context.exportState(Context.start(position));snapshot.state.safety.notches=H.snapshot(position,pattern);return Session.create(position,{obligationContext:snapshot});}
function legacySession(position,pattern){const saved=Session.create(position);saved.schemaVersion=1;saved.engineVersion='st-coach-session-2026-11-05-handoff-sl-v1';delete saved.coaching.obligationContext;delete saved.coaching.planContinuity;saved.coaching.patternHistory=clone(pattern);return saved;}

test('notch session: actual current checkpoints round-trip and legacy sessions reject',()=>{
 const q=currentQuad(),restored=Session.prepare(currentSession(q.after,q.history));compact(restored.patternHistory);assert.deepEqual(restored.patternHistory,H.snapshot(q.after,q.history));
 const legacy=legacySession(q.after,legacyQuad().history);assert.throws(()=>Session.prepare(legacy),/legacy sessions must be explicitly imported as positions/);
 const imported={version:2,status:'established',anchorRow:38,blockedRows:[]},saved=currentSession(q.after,imported);
 const got=Session.prepare(saved);compact(got.patternHistory);assert.equal(got.patternHistory.source,'imported-current-state');assert.deepEqual(Session.prepare(Session.create(got.state,got)).patternHistory,got.patternHistory);
 const bad=clone(legacy);bad.coaching.patternHistory.steps[0].event.lines=0;assert.throws(()=>Session.prepare(bad),/legacy sessions must be explicitly imported as positions/);
 const invalid=clone(saved);invalid.coaching.obligationContext.state.safety.notches.blockedRows=[38];assert.throws(()=>Session.prepare(invalid),/notch/i);
 const ignored=clone(saved);ignored.coaching.patternHistory={origin:[],steps:[]};assert.deepEqual(Session.prepare(ignored).patternHistory,got.patternHistory,'native sidecars are not authority');
 // Facts do not make a supplied old placement executable. The ordinary
 // movement, access and strategy checks still reject the blocked notch.
 const rejected=lock(F.after.observation,F.after.witness),advice={target:rejected.event.target,witness:F.after.witness,continuation:[{target:rejected.event.target,witness:F.after.witness,event:rejected.event}],context:JSON.stringify([got.state.rules,got.state.board,got.state.hold,got.state.canHold,got.state.queue,got.state.bag??null,got.state.active.type]),evidence:{},hold:false};
 assert.equal(P.revalidate(got.state,advice,{obligationContext:Context.exportState(got.obligationContext)}),null);
});

test('notch transport: actual page rejects legacy sessions, imports current checkpoints, restores Undo and honors trusted broken facts',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=clone(message);}terminate(){}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 const install=value=>{g.element('#st-snapshot').value=JSON.stringify(value);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/^Session imported/);return request();};
 const q=currentQuad(),old=legacySession(q.after,legacyQuad().history),before=clone(g.snapshot()),workerCount=workers.length;
 g.element('#st-snapshot').value=JSON.stringify(old);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/^Import rejected: Unsupported session format version/);assert.deepEqual(g.snapshot(),before);assert.equal(workers.length,workerCount);
 let req=install(currentSession(q.after,q.history));compact(req.options.obligationContext.state.safety.notches);assert.equal(req.options.patternHistory.anchorRow,38);
 g.click('#st-export-session');const exported=JSON.parse(g.downloads.at(-1).text);compact(exported.coaching.obligationContext.state.safety.notches);assert.deepEqual(exported.coaching.obligationContext.state.safety.notches,req.options.patternHistory);
 const original=currentSession(F.quad.observation,H.start(F.quad.observation)),initial=install(original);
 for(const action of F.quad.witness)g.window.stLab.act(action);req=request();assert.equal(req.options.patternHistory.anchorRow,38);compact(req.options.patternHistory);
 g.window.stLab.act('L');g.click('#st-undo');req=request();assert.deepEqual(req.options.patternHistory,initial.options.patternHistory);assert.equal(req.options.patternHistory.anchorRow,34);assert.deepEqual(req.observation.board,initial.observation.board);
 const trusted=currentSession(F.after.observation,{version:2,status:'broken',anchorRow:38,blockedRows:[38]});
 req=install(trusted);assert.equal(S.notchPattern(req.observation.board).status,'unanchored');compact(req.options.patternHistory);
 const result=require('../scripts/lib/st-simulation.cjs').workerPlanner()({...req,options:{...req.options,maxNodes:1}});
 assert.equal(result.target,null);assert.match(result.reason,/column 7 is filled/,'production worker must not discard the imported sticky fact and rederive the board');
}));
