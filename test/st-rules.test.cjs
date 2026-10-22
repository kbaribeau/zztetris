const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules');
const {fixtures}=require('./support/st-fixtures.cjs');
const state=(input={})=>R.createState({active:'T',...input});

test('st-rules/data: SRS+ shapes and all kick transitions match retained engine data',()=>{
 const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('rotationSystem.js','utf8'),context);
 for(const t of 'IJLOSTZ')assert.deepEqual(R.pieces[t],JSON.parse(JSON.stringify(context.pieces[t])));
 assert.deepEqual(R.kicks,JSON.parse(JSON.stringify(context.kicksets['SRS+'])));
 assert.equal(R.PROFILE.id,'st-zero-v1');assert.equal(R.PROFILE.hold,'once-per-lock');
});
test('st-rules/immutability and strict input validation',()=>{
 const s=state(),json=JSON.stringify(s);R.move(s,'R');R.move(s,'HD');assert.equal(JSON.stringify(s),json);
 assert.deepEqual(R.validate(s),[]);
 assert.ok(R.validate({...s,board:['bad']}).includes('invalid-board'));
 assert.ok(R.validate({...s,queue:['?']}).includes('invalid-queue'));
 assert.ok(R.validate({...s,rules:'gravity'}).includes('unsupported-profile'));
 assert.ok(R.validate({...s,canHold:'yes'}).includes('invalid-hold-availability'));
 assert.ok(R.validate({...s,active:{type:'T',x:3,y:17,rotation:7}}).includes('invalid-active'));
});
test('st-rules/hold: empty draws, occupied swaps, only one per lock',()=>{
 const s=state({queue:['I','O','L']});const h=R.move(s,'HOLD');assert.equal(h.active.type,'I');assert.equal(h.hold,'T');assert.deepEqual(h.queue,['O','L']);assert.equal(h.streamCursor,1);assert.equal(h.canHold,false);assert.equal(R.move(h,'HOLD'),h);
 const locked=R.move(h,'HD');assert.equal(locked.active.type,'O');assert.equal(locked.canHold,true);assert.equal(locked.streamCursor,2);
 const swapped=R.move(locked,'HOLD');assert.equal(swapped.active.type,'T');assert.equal(swapped.hold,'O');assert.deepEqual(swapped.queue,['L']);assert.equal(swapped.streamCursor,2);
 assert.equal(R.move(state(),'HOLD').active.type,'T','empty hold cannot invent unknown next piece');
});
test('st-rules/line counts: independently specified row patterns clear 0 through 4',()=>{
 for(let lines=0;lines<=4;lines++){
  const board=R.emptyBoard();for(let i=0;i<lines;i++)board[39-i]='####.#####';
  const s=state({board,active:{type:'I',x:2,y:17,rotation:1,lastRotation:null}});const n=R.move(s,'HD');assert.equal(n.lastEvent.lines,lines);assert.equal(n.active,null);assert.equal(n.board.length,40);assert.equal(n.lastEvent.spin,'none');assert.equal(n.board.join('').replace(/\./g,'').length,4+9*lines-10*lines);
 }
});
test('st-rules/top-out: block-out after lock, occupied hold spawn, lock-out',()=>{
 const board=R.emptyBoard();board[18]='....#.....';
 const s=state({board,active:{type:'O',x:0,y:30,rotation:0,lastRotation:null},queue:['T']});assert.equal(R.move(s,'HD').topOut,true);
 assert.equal(R.move(state({board,active:{type:'O',x:0,y:30,rotation:0,lastRotation:null},hold:'T'}),'HOLD').topOut,true);
 const shelf=R.emptyBoard();shelf[20]='##########';const n=R.move(state({board:shelf,active:'O'}),'HD');assert.equal(n.topOut,true);
});
test('st-rules/spin: actual rotated witness clears independent expected TSD board',()=>{
 const s=state({board:fixtures.cap.afterCap});const p=R.placements(s,{allowHold:false});assert.equal(p.complete,true);
 const target=p.placements.find(x=>x.event.lines===2&&x.event.spin==='full');assert.ok(target);assert.deepEqual(target.event.cells.slice().sort(),fixtures.cap.spinCells.slice().sort());assert.deepEqual(target.state.board.map(r=>r.replace(/[^.]/g,'#')),fixtures.cap.after);
 const replay=R.replay(s,target.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,target.state);
 const beforeLock=R.replay(s,target.witness.slice(0,-1)).state;assert.ok(beforeLock.active.lastRotation);assert.equal(R.move(beforeLock,'HD').lastEvent.spin,'full','zero-distance hard drop preserves rotation');
 assert.equal(R.move({...beforeLock,active:{...beforeLock.active,lastRotation:null}},'HD').lastEvent.spin,'none');
});
test('st-rules/spin evidence: front corners and quarter-turn fifth kick only',()=>{
 const board=R.emptyBoard();board[36]='...#.#....';board[38]='...#......';
 const a={type:'T',x:3,y:35,rotation:2,lastRotation:{from:1,to:2,kickIndex:0}};
 assert.equal(R.spin(board,a),'mini');assert.equal(R.spin(board,{...a,lastRotation:{from:1,to:2,kickIndex:4}}),'full');
 assert.equal(R.spin(board,{...a,lastRotation:{from:0,to:2,kickIndex:4}}),'mini');
 const elevated=state({active:{...a,y:20}});assert.equal(R.move(elevated,'HD').lastEvent.spin,'none');
});
test('st-rules/placements: every actual-pose witness legal, no input mutation or spawn teleport',()=>{
 const s=state({board:fixtures.cap.before,active:{type:'O',x:7,y:25,rotation:0,lastRotation:null},hold:'Z',queue:['T','I']});const original=JSON.stringify(s),p=R.placements(s);assert.ok(p.placements.length>0);assert.equal(JSON.stringify(s),original);
 assert.ok(p.placements.some(x=>x.witness.length===1&&x.witness[0]==='HD'&&x.event.lines===0));
 assert.ok(p.placements.some(x=>x.hold));
 for(const candidate of p.placements){const r=R.replay(s,candidate.witness);assert.equal(r.valid,true);assert.deepEqual(r.state,candidate.state);assert.deepEqual(candidate.target,candidate.event.target);}
 const partial=R.placements(s,{maxNodes:1});assert.equal(partial.complete,false);assert.equal(partial.visited,1);
 assert.equal(R.placements(s,{deadline:0}).complete,false);
});
test('st-rules/hidden future: constructors discard extraneous hidden RNG fields',()=>{
 const a=R.createState({active:'I',queue:['O'],seed:123,hiddenQueue:['T']});const b=R.createState({active:'I',queue:['O'],seed:987,hiddenQueue:['Z']});assert.deepEqual(a,b);assert.deepEqual(R.placements(a,{maxNodes:100}),R.placements(b,{maxNodes:100}));
});
test('st-rules/rotation and boundaries: legal kick and strict blocked action',()=>{
 let s=state({active:'I'});for(let i=0;i<3;i++)s=R.move(s,'L');assert.equal(s.active.x,0);s=R.move(s,'CW');s=R.move(s,'L');s=R.move(s,'L');assert.equal(s.active.x,-2);const kicked=R.move(s,'CCW');assert.equal(kicked.active.rotation,0);assert.ok(kicked.active.lastRotation.kickIndex>0);assert.ok(R.fits(kicked.board,kicked.active));
 assert.equal(R.replay(kicked,['L','L','L','L','L','L','L','L','L','L']).valid,false);
});
test('st-rules/property: reachable outcomes conserve cells and every witness replays',()=>{
 let s=state({active:'I',queue:[...'OTJLSZIOJT']});
 for(let step=0;step<7;step++){
  const before=s.board.join('').replace(/\./g,'').length;const result=R.placements(s,{allowHold:false});assert.equal(result.complete,true);
  for(const p of result.placements){assert.equal(p.state.board.join('').replace(/\./g,'').length,before+4-10*p.event.lines);assert.ok(p.state.board.every(r=>r.length===10));assert.equal(R.replay(s,p.witness).valid,true);assert.equal(p.event.cells.length,4);assert.ok(R.validate(p.state).length===0);}
  s=result.placements[(step*7)%result.placements.length].state;
 }
});
test('st-rules/rotation metadata rejects impossible kick indices',()=>{
 assert.ok(R.validate(state({active:{type:'T',x:3,y:17,rotation:1,lastRotation:{from:0,to:1,kickIndex:999}}})).includes('invalid-rotation-evidence'));
 assert.ok(R.validate(state({active:{type:'T',x:3,y:17,rotation:0,lastRotation:{from:0,to:0,kickIndex:0}}})).includes('invalid-rotation-evidence'));
});
test('st-rules/rotation metadata requires integer transition fields and selected-table bounds',()=>{
 for(const lastRotation of [{from:'0',to:1,kickIndex:0},{from:0,to:'1',kickIndex:0},{from:0,to:1,kickIndex:'4'},{from:0,to:1,kickIndex:-1},{from:0,to:1,kickIndex:5},{from:5,to:1,kickIndex:0}]){
  assert.ok(R.validate(state({active:{type:'T',x:3,y:17,rotation:1,lastRotation}})).includes('invalid-rotation-evidence'));
 }
});
test('hypothetical T access matches full enumeration across every curated board',()=>{
 const F=require('../st-fixtures');for(const f of F.list){const s=R.createState({board:f.observation.board,active:'T',canHold:false}),q=R.tDoubleAccess(s.board),full=R.placements(s,{allowHold:false});assert.equal(full.complete,true);assert.equal(q.reachable,full.placements.some(p=>p.event.spin==='full'&&p.event.lines===2),f.id);if(q.reachable){const replay=R.replay(s,q.witness);assert.equal(replay.valid,true);assert.equal(replay.state.lastEvent.spin,'full');assert.equal(replay.state.lastEvent.lines,2);}}
});
test('hypothetical T access budgets are unknown, never false impossibility',()=>{
 const b=require('../st-fixtures').get('direct-double').observation.board;
 assert.equal(R.tDoubleAccess(b,{maxNodes:0}).reachable,null);assert.equal(R.tDoubleAccess(b,{deadline:1,now:()=>1}).complete,false);assert.equal(R.tDoubleAccess(['bad']).reachable,null);
});

test('T access distinguishes an executable slot from the reward-farming cavity',()=>{
 const good=["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","OO..LLL...","OOOOLSS...","ZZOOSS....","ITTTLSS..J","ITTTSS...Z","ITJJJOO.ZZ","IIIIJOO.Z."],bad=["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","OO..LLL...","OOOOLSS..Z","ZZOOSS..ZZ","ITTTLSS.ZJ","ITTTSS...Z","ITJJJOO.ZZ","IIIIJOO.Z."];
 assert.equal(R.tDoubleAccess(good).reachable,true);assert.equal(R.tDoubleAccess(bad).reachable,false);
});
test('T access optimization agrees on mirrored and high-stack transformed boards',()=>{
 const F=require('../st-fixtures');for(const f of F.list.slice(0,12))for(const board of [f.observation.board.map(r=>[...r].reverse().join('')),f.observation.board.slice(12).concat(Array(12).fill('..........'))]){
  const s=R.createState({board,active:'T',canHold:false}),q=R.tDoubleAccess(board),full=R.placements(s,{allowHold:false});assert.equal(full.complete,true);assert.equal(q.reachable,full.placements.some(p=>p.event.spin==='full'&&p.event.lines===2),f.id);if(q.reachable)assert.equal(R.replay(s,q.witness).valid,true);
 }
});
