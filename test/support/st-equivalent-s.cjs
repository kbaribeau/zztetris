'use strict';
const assert=require('node:assert/strict'),R=require('../../st-rules');
const ordered=cells=>Array.from(cells,cell=>Array.from(cell)).sort(([x,y],[u,v])=>y-v||x-u);
// Only a fresh S selection may change its rotation encoding. Exact stored
// commitments, T-spin evidence and replay-to-described-event equality stay exact.
function sPlacement(event,cells){
 assert.equal(event.type,'S');assert.equal(event.target.type,'S');assert.deepEqual(ordered(R.cells(event.target)),ordered(event.cells));assert.equal(event.lines,0);assert.equal(event.spin,'none');assert.equal(event.topOut,false);
 assert.deepEqual(ordered(event.cells),ordered(cells));
}
function event(actual,expected){
 if(expected.type!=='S')return assert.deepEqual(actual,expected);
 sPlacement(actual,expected.cells);
 const project=e=>({...e,target:undefined,cells:ordered(e.cells)});
 assert.deepEqual(project(actual),project(expected));
}
module.exports={sPlacement,event};
