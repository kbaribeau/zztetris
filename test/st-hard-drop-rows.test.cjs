'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../st-rules');
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};

test('st-hard-drop/rows: imported full rows above and below a landing clear in original order',()=>{
 const board=R.emptyBoard();board[3]='...J......';board[5]='##########';
 board[36]='.........Z';board[37]='....######';board[38]='IJLOSTZ###';board[39]='#.........';
 const s=freeze(R.createState({board,active:{type:'I',x:0,y:30,rotation:0,lastRotation:null},queue:['T','L'],revision:7,streamCursor:9}));
 const next=R.move(s,'HD'),expected=R.emptyBoard();expected[6]='...J......';expected[38]='.........Z';expected[39]='#.........';
 assert.deepEqual(next.board,expected);
 assert.deepEqual(next.lastEvent,{type:'I',target:{type:'I',x:0,y:36,rotation:0},cells:[[0,37],[1,37],[2,37],[3,37]],lines:3,clearedRows:[5,37,38],spin:'none',topOut:false});
 assert.equal(next.revision,8);assert.equal(next.streamCursor,10);assert.equal(next.active.type,'T');assert.deepEqual(next.queue,['L']);
 assert.deepEqual(s.board,board);assert.equal(s.lastEvent,null);
});

test('st-hard-drop/rows: untouched imported full rows clear even when no locked row becomes full',()=>{
 const board=R.emptyBoard();board[4]='IJLOSTZ#XX';board[35]='##########';
 const s=freeze(R.createState({board,active:{type:'O',x:0,y:25,rotation:0,lastRotation:null}})),next=R.move(s,'HD');
 const expected=R.emptyBoard();expected[34]='.OO.......';expected[35]='.OO.......';
 assert.deepEqual(next.board,expected);assert.deepEqual(next.lastEvent.clearedRows,[4,35]);
 assert.deepEqual(next.lastEvent.cells,[[1,33],[2,33],[1,34],[2,34]]);assert.equal(next.lastEvent.lines,2);assert.equal(next.topOut,false);
 assert.deepEqual(s.board,board);
});

test('st-hard-drop/rows: lock-out uses pre-clear cells even when an imported shelf clears',()=>{
 const board=R.emptyBoard();board[20]='##########';
 const s=freeze(R.createState({board,active:'O',queue:['I']})),next=R.move(s,'HD'),expected=R.emptyBoard();
 expected[19]='....OO....';expected[20]='....OO....';
 assert.deepEqual(next.board,expected);assert.deepEqual(next.lastEvent.cells,[[4,18],[5,18],[4,19],[5,19]]);
 assert.deepEqual(next.lastEvent.clearedRows,[20]);assert.equal(next.topOut,true);assert.equal(next.lastEvent.topOut,true);
 assert.deepEqual(s.board,board);
});

test('st-hard-drop/rows: actual-pose locks keep frozen inputs and sibling candidates independent',()=>{
 const s=freeze(R.createState({active:{type:'O',x:0,y:25,rotation:0,lastRotation:null},hold:'T',queue:['I','S'],revision:12,streamCursor:4}));
 const snapshot=JSON.stringify(s),left=freeze(R.move(s,'HD')),leftSnapshot=JSON.stringify(left);
 const right=R.move(R.move(s,'R'),'HD'),held=R.move(R.move(s,'HOLD'),'HD');
 assert.deepEqual(left.board.slice(38),['.OO.......','.OO.......']);assert.deepEqual(right.board.slice(38),['..OO......','..OO......']);
 assert.notEqual(right.board,left.board);assert.notEqual(right.board,s.board);assert.notEqual(held.board,left.board);
 right.board[39]='##########';right.lastEvent.cells[0][0]=9;
 assert.equal(JSON.stringify(left),leftSnapshot);assert.equal(JSON.stringify(s),snapshot);
 assert.equal(held.lastEvent.type,'T');assert.equal(held.hold,'O');assert.equal(held.active.type,'I');assert.equal(held.streamCursor,5);
});
