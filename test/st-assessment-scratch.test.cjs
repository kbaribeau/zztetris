'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),P=require('../st-planner'),F=require('../st-fixtures');
// Deliberately simple independent DFS, not the production queue implementation.
function reference(board){
 const reached=new Set(),stack=[];
 for(let x=0;x<10;x++)stack.push([x,0]);
 while(stack.length){const [x,y]=stack.pop(),id=`${x},${y}`;
  if(x<0||x>=10||y<0||y>=40||board[y][x]!=='.'||reached.has(id))continue;
  reached.add(id);stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
 }
 const sealedCells=[];let covered=0,leftSealed=0;
 for(let x=0;x<10;x++){let below=false;for(let y=0;y<40;y++){
  if(board[y][x]!=='.')below=true;
  else{if(below)covered++;if(!reached.has(`${x},${y}`)){sealedCells.push([x,y]);if(x<7)leftSealed++;}}
 }}
 return{sealedCells,sealed:sealedCells.length,leftSealed,covered};
}
function corpus(){
 const out=[R.emptyBoard(),Array(40).fill('XXXXXXXXXX'),...F.list.map(f=>f.observation.board)];let seed=20261026;
 for(let n=0;n<64;n++){const board=R.emptyBoard();for(let y=n%3?20:0;y<40;y++){
  let row='';for(let x=0;x<10;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;row+=(seed>>>28)<6?'IJLOSTZ'[seed%7]:'.';}board[y]=row;
 }out.push(board);}return out;
}
test('st-assessment-scratch/independent flood facts retain exact cell order on varied boards',()=>{
 for(const board of corpus()){
  const before=board.slice(),expected=reference(board),actual=P.assess(board);
  assert.deepEqual({sealedCells:actual.sealedCells,sealed:actual.sealed,leftSealed:actual.leftSealed,covered:actual.covered},expected);
  assert.deepEqual(P.assess(board,{cavitiesOnly:true}),{sealedCells:expected.sealedCells});
  assert.deepEqual(board,before);
 }
});
test('st-assessment-scratch/reused scratch does not alias facts or cache mutable boards',()=>{
 const board=Array(40).fill('XXXXXXXXXX');board[39]='X.XXXXXXXX';const first=P.assess(board),snapshot=structuredClone(first);
 for(const other of corpus())P.assess(other);
 assert.deepEqual(first,snapshot);first.sealedCells[0][0]=99;
 assert.deepEqual(P.assess(board),snapshot);
 board[39]='XXXXXXXXXX';assert.equal(P.assess(board).sealed,0);
 board[0]='..........';assert.deepEqual(P.assess(board).sealedCells,reference(board).sealedCells);
 const frozen=Object.freeze(board.slice());assert.deepEqual(P.assess(frozen),P.assess(board));
});
test('st-assessment-scratch/nested and throwing board reads cannot corrupt a leased flood',()=>{
 const board=R.emptyBoard();board[20]='XXXX.XXXXX';board[22]='XXXXXXXXXX';board[30]='X.X.X.X.X.';
 const expected=P.assess(board),other=Array(40).fill('XXXXXXXXXX');other[39]='X.XXXXXXXX';
 let reads=0,nested=false;
 const reentrant=new Proxy(board,{get(target,key,receiver){if(key==='0'&&++reads===15){nested=true;assert.equal(P.assess(other).sealed,1);}return Reflect.get(target,key,receiver);}});
 assert.deepEqual(P.assess(reentrant),expected);assert.equal(nested,true);
 reads=0;const throwing=new Proxy(board,{get(target,key,receiver){if(key==='0'&&++reads===15)throw new Error('board read');return Reflect.get(target,key,receiver);}});
 assert.throws(()=>P.assess(throwing),/board read/);
 assert.deepEqual(P.assess(board),expected);assert.equal(P.assess(other).sealed,1);
});
