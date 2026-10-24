'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../st-planner'),R=require('../st-rules'),S=require('../st-structure');
const initial=require('./support/st-user-clean-center.json');
function replay(steps){let state=P.observe(initial),phase=S.notchPattern(state.board);for(const step of steps){const r=R.replay(state,step.witness);assert.ok(r.valid);assert.equal(r.events.length,1);assert.ok(S.canonicalClear(r.events[0]));const n=S.advanceNotches(state.board,{event:r.events[0],state:r.state},phase);assert.ok(n.valid);phase=n.pattern;state=r.state;}return {state,phase};}
test('3A does not preserve a clean center at the cost of a newly inaccessible left cell',()=>{
 const A=require('../st-access'),advice=P.plan(initial,{maxNodes:45000});assert.ok(advice.target);
 const first=R.replay(initial,advice.witness);assert.equal(A.check(initial,{state:first.state,event:first.events[0]}).reachable,true);
 const old=R.placements(initial).placements.find(p=>p.target.type==='Z'&&p.target.x===1&&p.target.y===25&&p.target.rotation===0);assert.ok(old);
 const bad=A.check(initial,old);assert.equal(bad.reachable,false);assert.deepEqual(bad.unreachable,[[1,27]]);
 // The earlier exact winner was our inference, not a recorded reference move.
 // Center cleanliness cannot justify a movement-inaccessible Left vacancy.
 assert.notDeepEqual(advice.target,old.target);replay(advice.continuation);
});
test('3A old crossing Z remains legal but has an unresolved endpoint, not a forbidden move',()=>{
 const z=R.placements(initial).placements.find(p=>p.target.type==='Z'&&p.target.x===3&&p.target.y===24&&p.target.rotation===1);assert.ok(z);
 const phase=S.advanceNotches(initial.board,z);assert.ok(phase.valid);assert.equal(S.transition(initial,z).cycleViolations.length,0);
 assert.equal(S.geometry(z.state.board,{notches:phase.pattern}).center.status,'unrecognized');
 assert.equal(S.geometry(initial.board).center.status,'supported-partner-completion');
});
test('center continuity distinguishes witnessed disruption, clear-only change, and unknown imported history',()=>{
 const good={status:'supported-partner-completion',patternSupport:'reference-supported'},unknown={status:'unrecognized',patternSupport:'unrecognized'},flatUnknown={status:'level',patternSupport:'unrecognized'};
 assert.equal(P.centerContinuityStep(good,unknown,{lines:0}),true);
 assert.equal(P.centerContinuityStep(good,unknown,{lines:2}),false);
 assert.equal(P.centerContinuityStep(unknown,flatUnknown,{lines:2},true),true,'flat skyline alone does not certify restoration');
 assert.equal(P.centerContinuityStep(unknown,unknown,{lines:0}),false,'imported unknown geometry does not invent prior disruption');
 assert.equal(P.centerContinuityStep(unknown,good,{lines:0},true),false);
});
test('reference J/Z and clear-then-repair constructions remain legal and discharge temporary continuity debt',()=>{
 const fs=require('fs'),vm=require('vm'),codec=vm.runInNewContext(fs.readFileSync(require.resolve('../tetris-fumen.js'),'utf8'),{window:{}})(2);
 const pages=codec.decoder.decode(fs.readFileSync(require.resolve('../references/st-stacking/jstris-26536180.fumen'),'utf8').trim());
 const board=p=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>y<17?'.':p.field.at(x,39-y).replace('_','.')).join(''));
 const key=c=>c.map(x=>x.join(',')).sort().join(';');
 for(const [first,last] of [[369,370],[346,348]]){
  let b=board(pages[first-1]),phase=S.notchPattern(b),debt=false;const trace=[];
  for(let page=first;page<=last;page++){
   const source=pages[page-1],cells=source.operation.positions().map(({x,y})=>[x,39-y]),s=R.createState({board:b,active:source.operation.type,canHold:false});
   const p=R.placements(s,{allowHold:false}).placements.find(p=>key(p.event.cells)===key(cells)&&S.canonicalClear(p.event));assert.ok(p,'source placement has an actual canonical witness');
   const n=S.advanceNotches(b,p,phase);assert.ok(n.valid);const before=S.geometry(b,{notches:phase}).center,after=S.geometry(p.state.board,{notches:n.pattern}).center;
   debt=P.centerContinuityStep(before,after,p.event,debt);trace.push({debt,lines:p.event.lines});b=p.state.board;phase=n.pattern;
  }
  assert.equal(debt,false,'the actual reference endpoint repays temporary construction');
  if(first===346)assert.equal(trace[0].debt,false,'a clear alone must not invent disruption');
 }
});
test('a shallow recognized motif does not repay a deep unresolved column beneath it',()=>{
 const good={status:'level',patternSupport:'reference-supported',profile:[8,8,8]},falsePartner={status:'supported-partner-completion',patternSupport:'reference-supported',profile:[12,10,6]};
 assert.equal(P.centerContinuityStep(good,falsePartner,{lines:0}),true);
 const legitimateZJ={...falsePartner,profile:[4,6,7]};
 assert.equal(P.centerContinuityStep(falsePartner,legitimateZJ,{lines:0},true),false);
});
