'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../st-planner');
function reference(board){const air=new Set(),queue=[];for(let x=0;x<10;x++)if(board[0][x]==='.')queue.push([x,0]);for(let i=0;i<queue.length;i++){const[x,y]=queue[i],key=y*10+x;if(air.has(key))continue;air.add(key);for(const[xx,yy]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx>=0&&xx<10&&yy>=0&&yy<40&&board[yy][xx]==='.'&&!air.has(yy*10+xx))queue.push([xx,yy]);}const cells=[];for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(board[y][x]==='.'&&!air.has(y*10+x))cells.push([x,y]);return cells;}
test('minimal cavity analysis preserves exact four-connected top-air flood, boundaries and x-major output',()=>{
 let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const boards=[Array(40).fill('..........'),Array(40).fill('IIIIIIIIII'),...Array.from({length:40},()=>Array.from({length:40},(_,y)=>Array.from({length:10},()=>y<20?'.':random()<.4?'I':'.').join('')))];
 const edge=Array(40).fill('IIIIIIIIII');edge[0]='IIIIIIIII.';edge[1]='.IIIIIIIII';boards.push(edge);
 const closedTop=Array(40).fill('..........');closedTop[0]='IIIIIIIIII';boards.push(closedTop);
 const roof=Array(40).fill('..........');roof[37]='.III......';roof[38]='.I.I......';roof[39]='.III......';boards.push(roof);
 for(const board of boards){const before=board.slice(),expected=reference(board),full=P.assess(board),minimal=P.assess(board,{cavitiesOnly:true});assert.deepEqual(full.sealedCells,expected);assert.deepEqual(minimal,{sealedCells:expected});assert.equal(full.sealed,expected.length);assert.ok(Array.isArray(full.heights));assert.deepEqual(board,before);minimal.sealedCells.push([9,0]);assert.deepEqual(P.assess(board,{cavitiesOnly:true}).sealedCells,expected,'per-call buffers and results never leak');}
});
