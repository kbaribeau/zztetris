'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../st-structure'),O=require('../st-opening'),f=require('./support/st-center-level-base.json');
test('phase-aligned level base is an occupancy/validated-phase diagnostic, not flatness or whole-board readiness',()=>{
 for(const c of f.controls){const result=S.centerLevelBase(c.board,c.translatedOrSuppliedPhase);assert.equal(result.status==='phase-aligned-level-base',c.expectedLevelBase,c.id);if(c.expectedLevelBase){assert.equal(result.level,39-result.anchorRow);assert.equal(O.facts(c.board,c.translatedOrSuppliedPhase).centerBaseStatus,result.status);}}
 const original=f.controls[0],fresh=S.centerLevelBase(original.board);assert.equal(fresh.status,'phase-aligned-level-base');assert.equal(S.geometry(original.board).center.patternSupport,'unrecognized');
 assert.equal(S.centerLevelBase(original.board,{status:'unanchored'}).status,'unknown-phase');
 assert.equal(S.centerLevelBase(original.board,{status:'broken'}).status,'invalid-phase');
 assert.equal(S.centerLevelBase(original.board,{status:'established',anchorRow:40}).status,'invalid-phase');
 assert.equal(S.centerLevelBase(Array(40).fill('..........'),{status:'established',anchorRow:39}).status,'other-foundation');
 // A caller cannot smuggle imported metadata through the board-only API.
 const board=original.board.slice();board.notches={status:'established',anchorRow:33};assert.deepEqual(S.centerLevelBase(board),fresh);
});
test('phase-aligned level base source snapshot matches the recorded1000-line post-double field',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const codec=vm.runInNewContext(fs.readFileSync(path.join(root,'tetris-fumen.js'),'utf8'),{window:{}})(2),pages=codec.decoder.decode(fs.readFileSync(path.join(root,'references/st-stacking/jstris-26536180.fumen'),'utf8').trim());
 const board=Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>y<17?'.':pages[553].field.at(x,39-y).replace('_','.')).join(''));
 assert.deepEqual(board,f.controls.find(c=>c.id==='1000L-553').board);assert.equal(S.centerLevelBase(board).status,'phase-aligned-level-base');
 // Fumen occupancy/clear evidence does not reconstruct original inputs or preview.
});
