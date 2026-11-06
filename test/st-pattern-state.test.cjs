'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),H=require('../st-pattern-history'),P=require('../st-planner'),Session=require('../st-session');
const F=require('./support/st-gap-phase.json'),clone=x=>JSON.parse(JSON.stringify(x));
function lock(state,witness=['HD']){const before=R.replay(state,witness.slice(0,-1));assert.equal(before.valid,true);const replay=R.replay(before.state,['HD']);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);return{before:before.state,after:replay.state,event:replay.events[0]};}
function quad(){return lock(R.createState(F.quad.observation),F.quad.witness);}
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

test('notch legacy adapter: valid old tapes become current facts while malformed and stale tapes still reject',()=>{
 const q=legacyQuad(),facts=H.resolve(q.after,q.history);assert.equal(facts.anchorRow,38);assert.equal(facts.source,'translated-established-cycle');
 const saved=H.snapshot(q.after,q.history);compact(saved);assert.deepEqual(H.resolve(q.after,saved),facts);assert.equal(q.history.steps.length,1);
 const mutations=[h=>h.origin=R.emptyBoard(),h=>h.origin[0]='bad',h=>h.steps=[null],h=>h.steps[0].pose.rotation=9,
  h=>h.steps[0].event.cells[0][0]=0,h=>h.steps[0].event.lines=0,h=>h.steps[0].event.spin='full',h=>h.steps[0].event.clearedRows=[],
  h=>h.steps=Array(129).fill(h.steps[0])];
 for(const mutate of mutations){const bad=clone(q.history);mutate(bad);assert.equal(H.resolve(q.after,bad).status,'invalid-history');}
 assert.equal(H.resolve(F.quad.observation,q.history).status,'invalid-history','old tapes remain bound to their replay endpoint');
 const next=lock(q.after,['L','HD']),updated=H.update(q.history,next.before,next.after,next.event);compact(updated);
 assert.deepEqual(updated,H.update(saved,next.before,next.after,next.event),'first legacy live update drops its entire tape');
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

test('notch session adapter: legacy import is immediately compact and trusted current facts round-trip without replay authority',()=>{
 const q=legacyQuad(),saved=Session.create(q.after,{patternHistory:q.history});compact(saved.coaching.patternHistory);
 const legacy=clone(saved);legacy.coaching.patternHistory=clone(q.history);const restored=Session.prepare(legacy);compact(restored.patternHistory);assert.deepEqual(restored.patternHistory,saved.coaching.patternHistory);
 const imported={version:2,status:'established',anchorRow:38,blockedRows:[]};saved.coaching.patternHistory=imported;
 const got=Session.prepare(saved);compact(got.patternHistory);assert.equal(got.patternHistory.source,'imported-current-state');assert.deepEqual(Session.prepare(Session.create(got.state,got)).patternHistory,got.patternHistory);
 const bad=clone(legacy);bad.coaching.patternHistory.steps[0].event.lines=0;assert.throws(()=>Session.prepare(bad),/pattern history/i);
 const invalid=clone(saved);invalid.coaching.patternHistory.blockedRows=[38];assert.throws(()=>Session.prepare(invalid),/notch checkpoint/i);
 // Facts do not make a supplied old placement executable. The ordinary
 // movement, access and strategy checks still reject the blocked notch.
 const rejected=lock(F.after.observation,F.after.witness),advice={target:rejected.event.target,witness:F.after.witness,continuation:[{target:rejected.event.target,witness:F.after.witness,event:rejected.event}],context:JSON.stringify([got.state.rules,got.state.board,got.state.hold,got.state.canHold,got.state.queue,got.state.bag??null,got.state.active.type]),evidence:{},hold:false};
 assert.equal(P.revalidate(got.state,advice,{patternHistory:got.patternHistory}),null);
});

test('notch transport: actual page imports legacy/current checkpoints, restores Undo, and production worker honors trusted broken facts',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(message){this.message=clone(message);}terminate(){}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 const install=value=>{g.element('#st-snapshot').value=JSON.stringify(value);g.click('#st-import');assert.match(g.element('#st-import-status').textContent,/^Session imported/);return request();};
 const q=legacyQuad(),old=Session.create(q.after,{patternHistory:q.history});old.coaching.patternHistory=clone(q.history);
 let req=install(old);compact(req.options.patternHistory);assert.equal(req.options.patternHistory.anchorRow,38);
 g.click('#st-export-session');const exported=JSON.parse(g.downloads.at(-1).text);compact(exported.coaching.patternHistory);assert.deepEqual(exported.coaching.patternHistory,req.options.patternHistory);
 const original=Session.create(F.quad.observation,{patternHistory:H.start(F.quad.observation)}),initial=install(original);
 for(const action of F.quad.witness)g.window.stLab.act(action);req=request();assert.equal(req.options.patternHistory.anchorRow,38);compact(req.options.patternHistory);
 g.window.stLab.act('L');g.click('#st-undo');req=request();assert.deepEqual(req.options.patternHistory,initial.options.patternHistory);assert.equal(req.options.patternHistory.anchorRow,34);assert.deepEqual(req.observation.board,initial.observation.board);
 const trusted=Session.create(F.after.observation,{patternHistory:{version:2,status:'broken',anchorRow:38,blockedRows:[38]}});
 req=install(trusted);assert.equal(S.notchPattern(req.observation.board).status,'unanchored');compact(req.options.patternHistory);
 const result=require('../scripts/lib/st-simulation.cjs').workerPlanner()({...req,options:{...req.options,maxNodes:1}});
 assert.equal(result.target,null);assert.match(result.reason,/column 7 is filled/,'production worker must not discard the imported sticky fact and rederive the board');
}));
