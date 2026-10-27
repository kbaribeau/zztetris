'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),F=require('../st-fixtures');
function reference(board){
 const heights=Array(10).fill(0);for(let y=39;y>=0;y--)for(let x=0;x<10;x++)if(board[y][x]!=='.')heights[x]=40-y;
 const reached=new Set(),stack=Array.from({length:10},(_,x)=>[x,0]);
 while(stack.length){const [x,y]=stack.pop(),key=x+','+y;if(x<0||x>=10||y<0||y>=40||board[y][x]!=='.'||reached.has(key))continue;reached.add(key);stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);}
 let centerSealed=0;for(let y=0;y<40;y++)for(let x=4;x<7;x++)if(board[y][x]==='.'&&!reached.has(x+','+y))centerSealed++;
 return{heights,centerSealed};
}
function boards(){const out=[R.emptyBoard(),Array(40).fill('XXXXXXXXXX'),...F.list.map(f=>f.observation.board)];let seed=7092026;
 for(let i=0;i<40;i++){const b=R.emptyBoard();for(let y=i%3?20:0;y<40;y++){let row='';for(let x=0;x<10;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;row+=(seed>>>28)<6?'IJLOSTZ'[seed%7]:'.';}b[y]=row;}out.push(b);}return out;}
test('regional scans match independent heights and DFS on empty, sealed, boundary and colored boards',()=>{
 for(const board of boards()){S.clearCache();const before=board.slice(),expected=reference(board),g=S.geometry(board);assert.deepEqual([...g.left.profile,...g.center.profile,...g.right.profile],expected.heights);assert.equal(g.center.sealedVoids,expected.centerSealed);assert.deepEqual(board,before);}
});
test('regional scans keep mutation, nested reads and thrown reads isolated',()=>{
 const board=R.emptyBoard();board[20]='XXXX.XXXXX';board[22]='XXXXXXXXXX';board[39]='X.X.X.X.X.';S.clearCache();const expected=structuredClone(S.geometry(board));
 const other=Array(40).fill('XXXXXXXXXX');other[39]='XXXX.XXXXX';let nested=false;
 S.clearCache();const proxy=new Proxy(board,{get(target,key,receiver){if(key==='0'&&!nested){nested=true;assert.equal(S.geometry(other).center.sealedVoids,1);}return Reflect.get(target,key,receiver);}});assert.deepEqual(S.geometry(proxy),expected);assert.equal(nested,true);
 S.clearCache();assert.throws(()=>S.geometry(new Proxy(board,{get(target,key,receiver){if(key==='0')throw Error('read failed');return Reflect.get(target,key,receiver);}})),/read failed/);
 assert.deepEqual(S.geometry(board),expected);board[20]='XXXXXXXXXX';S.clearCache();assert.equal(S.geometry(board).center.sealedVoids,reference(board).centerSealed);
});
