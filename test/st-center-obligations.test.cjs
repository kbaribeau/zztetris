'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../st-center-obligations'),R=require('../st-rules'),F=require('../st-fixtures');
const clone=x=>JSON.parse(JSON.stringify(x));
const J=['CW','HD'],Z=['R','R','CW',...Array(7).fill('SD'),'L','HD'];
function step(state,witness){const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);return{state:r.state,event:r.events[0]};}
function example(){
 const before=R.createState({board:F.get('cap-rebuild').observation.board,active:'J',queue:['Z'],canHold:false});
 const j=step(before,J),z=step(j.state,Z),root=C.start(before.board);
 const created=C.apply(root,before.board,j.state.board,j.event,{pieceId:1,at:1});
 return{before,j,z,root,created};
}
const literalZ=[[6,25],[5,26],[6,26],[5,27]];
test('shared Center: exact J then Z creates and retires one live duty without history',()=>{
 const {before,j,z,root,created}=example();
 assert.deepEqual(root,{pending:[],debt:[]});
 assert.deepEqual(created.state,{pending:[{id:'piece-1',rootId:1,family:'ZJ',createdAt:1,alternatives:[{piece:'Z',cells:literalZ}]}],debt:[]});
 const paid=C.apply(created.state,j.state.board,z.state.board,z.event,{pieceId:2,at:2});
 assert.deepEqual(paid.state,{pending:[],debt:[]});
 assert.deepEqual(created.effects.map(e=>[e.status,e.rootId,e.at]),[['created',1,1]]);
 assert.deepEqual(paid.pairs,[{family:'ZJ',rootId:1,partnerId:2,at:2}]);
 assert.deepEqual(paid.effects.map(e=>[e.status,e.rootId,e.partnerId]),[['fulfilled',1,2]]);
 assert.deepEqual(C.start(before.board),root);
 assert.equal('closed' in paid.state,false);assert.equal('pieces' in paid.state,false);
});
test('shared Center: immutable inputs and supplied snapshot authority need no originating tape',()=>{
 const {j,z,created}=example(),snapshot=clone(created.state),saved=clone(snapshot);
 // The new current-state component accepts the supplied duty itself. Legacy
 // resource-history import tests separately retain their tape-format contract.
 snapshot.pending[0].id='trusted-goal';snapshot.pending[0].rootId=700;
 const paid=C.apply(snapshot,j.state.board,z.state.board,z.event,{pieceId:701,at:2});
 assert.equal(paid.effects[0].id,'trusted-goal');assert.equal(paid.pairs[0].rootId,700);
 assert.deepEqual(created.state,saved);assert.equal(snapshot.pending[0].rootId,700);
 assert.deepEqual(paid.state,{pending:[],debt:[]});
});
test('shared Center: same type elsewhere is diversion, never exact target payment',()=>{
 const {j,created}=example(),away=step(j.state,['R','R','R','R','CW','HD']);
 const result=C.apply(created.state,j.state.board,away.state.board,away.event,{pieceId:2,at:2});
 assert.equal(result.state.pending.length,1);assert.equal(result.state.debt.length,1);
 assert.equal(result.state.debt[0].divertedPieceId,2);
 assert.deepEqual(result.state.pending[0].alternatives,[{piece:'Z',cells:literalZ}]);
 assert.deepEqual(result.pairs,[]);assert.deepEqual(result.effects.map(e=>[e.status,e.rootId,e.divertedPieceId]),[['diverted',1,2]]);
 const again=C.apply(result.state,j.state.board,away.state.board,away.event,{pieceId:3,at:3});
 assert.equal(again.effects.some(e=>e.status==='diverted'),false,'An already-diverted live facet is not created again');
});
test('shared Center: exact replacement pays pending and diverted facets with only one pair',()=>{
 const {j,z,created}=example(),snapshot=clone(created.state);
 snapshot.debt=[{...clone(snapshot.pending[0]),divertedAt:2,divertedPieceId:12}];
 const result=C.apply(snapshot,j.state.board,z.state.board,z.event,{pieceId:20,at:3});
 assert.deepEqual(result.state,{pending:[],debt:[]});
 assert.deepEqual(result.effects.map(e=>e.status),['fulfilled','debt-fulfilled']);
 assert.deepEqual(result.pairs,[{family:'ZJ',rootId:1,partnerId:20,at:3}]);
 assert.equal(snapshot.debt.length,1,'Original snapshot stays reusable for Undo or another branch');
});
test('shared Center: losing supported geometry emits invalidation rather than payment',()=>{
 const {j,created}=example(),snapshot=clone(created.state),board=j.state.board.slice();
 snapshot.debt=[{...clone(snapshot.pending[0]),divertedAt:2,divertedPieceId:12}];
 // A literal component boundary: the target's top-right cell was occupied by
 // an unrelated placement. This checks the accounting consequence, not a
 // fabricated claim that a particular gameplay witness reached this board.
 board[25]=board[25].slice(0,6)+'X'+board[25].slice(7);
 const event={type:'I',cells:[[0,25],[0,26],[0,27],[0,28]],clearedRows:[],lines:0};
 const result=C.apply(snapshot,j.state.board,board,event,{pieceId:13,at:3});
 assert.deepEqual(result.state,{pending:[],debt:[]});assert.deepEqual(result.pairs,[]);
 assert.deepEqual(result.effects.map(e=>e.status),['invalidated','debt-invalidated']);
 assert.match(result.effects[1].reason,/lost, not repaid/);
});
test('shared Center: route-only lost marker cannot revive an exact-looking payment',()=>{
 const {j,z,created}=example(),target={...clone(created.state.pending[0]),lost:true};
 const facts=C.frame(j.state.board,z.state.board,z.event,[target]);
 assert.equal(C.inspect(target,facts).finished,false);
 assert.equal(C.inspect(created.state.pending[0],facts).finished,true);
});
test('shared Center: equivalent settled cycles do not retain events, identities or tombstones',()=>{
 const {before,j,z}=example();let current=C.start(before.board);
 // A repeated component cycle supplies the same public board boundaries and
 // new public identities. It is a state-lifetime test, not a simulated game.
 for(let cycle=0;cycle<1000;cycle++){
  const created=C.apply(current,before.board,j.state.board,j.event,{pieceId:cycle*2+1,at:cycle*2+1});
  assert.equal(created.state.pending.length,1);
  const paid=C.apply(created.state,j.state.board,z.state.board,z.event,{pieceId:cycle*2+2,at:cycle*2+2});
  current=paid.state;assert.deepEqual(current,{pending:[],debt:[]});
 }
 assert.equal(JSON.stringify(current),'{"pending":[],"debt":[]}');
});
