'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../st-left-obligations');
const clone=x=>JSON.parse(JSON.stringify(x));
const stack=p=>Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>x<4&&40-y<=p[x]?'X':'.').join(''));
const put=(b,c)=>b.map((r,y)=>[...r].map((v,x)=>c.some(([cx,cy])=>cx===x&&cy===y)?'J':v).join(''));
const repair={cells:[[1,29],[1,30],[0,31],[1,31]],resultProfile:[9,11,11,11]};
// Literal minimized public board, seed 4053663259 lock 62, retained source:
// resource-tracking-investigation-2026-11-06/visible-j-public-request-empty-4053663259-62.json
const authentic=[...Array(29).fill('..........'),'..II......','..II......','..II......','OOIILLL...','OOJJLSS...','OOJJSS....','OOJJLLL...','OOJJLSS...','JJJJLSS.Z.','JSSILOO.Z.','IOOIJZZ.Z.'];
const accept=(board=authentic,goals=[],r=repair)=>L.accept(goals,{board,repair:r,checked:true});
const move=(goals,b,c,rows=[])=>{const locked=put(b,c),after=locked.filter((_,y)=>!rows.includes(y));while(after.length<40)after.unshift('..........');return L.advance(goals,{beforeBoard:b,event:{cells:c,clearedRows:rows},afterBoard:after});};
test('Left goals / authentic accepted J is partial improvement, not flattening or identity',()=>{
 const a=accept();assert.equal(a.goalId,'left-1');assert.deepEqual(a.goals[0],{id:'left-1',rule:L.RULE,deepColumns:[0,1],deficitRegion:[[0,29],[0,30],[0,31],[1,29],[1,30],[1,31]],referenceProfile:[8,8,11,11],status:'open'});
 assert.deepEqual(move(a.goals,authentic,repair.cells),{goals:[],effects:[{kind:'fulfilled',goalId:'left-1'}]});
 assert.deepEqual(a.goals[0].referenceProfile,[8,8,11,11],'immutable inputs');
});
test('Left goals / alternate literal deep deficit repairs only part of the valley',()=>{
 const b=stack([11,9,9,13]),r={cells:[[1,30],[2,28],[2,29],[2,30]],resultProfile:[11,10,12,13]},a=accept(b,[],r);
 assert.deepEqual(a.goals[0].deepColumns,[1,2]);assert.equal(move(a.goals,b,r.cells).effects[0].kind,'fulfilled');
});
test('Left goals / geometry opportunities and unchecked repairs create no job',()=>{
 assert.deepEqual(L.accept([],{board:authentic,repair,checked:false}).goals,[]);
 assert.equal(L.accept([],{board:authentic,repair:{...repair,resultProfile:[11,11,11,11]},checked:true}).goalId,null);
});
test('Left goals / repeated acceptance and replacement retains one current ID without archives',()=>{
 let a=accept();const initial=clone(a.goals);
 for(let i=0;i<2000;i++)a=accept(authentic,a.goals);
 assert.deepEqual(a.goals,initial);
 const o={cells:[[0,30],[1,30],[0,31],[1,31]],resultProfile:[10,10,11,11]};
 assert.equal(accept(authentic,a.goals,o).goalId,a.goalId);
 assert.equal(move(a.goals,authentic,o.cells).effects[0].kind,'fulfilled','manual different piece satisfies declared condition');
 assert.equal(accept(authentic).goalId,'left-1','no lifetime ID registry');
});
test('Left goals / stale plans and unrelated actual placements preserve the selected job',()=>{
 const a=accept(),c=[[4,31],[5,31],[6,31],[7,31]];
 assert.deepEqual(move(a.goals,authentic,c).goals,a.goals);
 const supplied=clone(a.goals);supplied[0].deficitRegion=[[0,29],[0,30],[0,31]];supplied[0].deepColumns=[0];
 const elsewhere=[[1,28],[1,29],[1,30],[1,31]];
 assert.equal(move(supplied,authentic,elsewhere).goals.length,1,'different deep column cannot pay this imported job');
});
test('Left goals / added cover and cells above reference peak do not pay',()=>{
 const a=accept();for(const c of [[[0,29],[1,29],[1,30],[1,31]],[[0,28],[0,29],[0,30],[0,31]]])assert.equal(move(a.goals,authentic,c).goals.length,1);
});
test('Left goals / partial obstruction remains blocked and rediscovery never expands old promise',()=>{
 const b=stack([8,8,11,11]),a=accept(b),cells=[[0,31],[2,28],[3,28],[3,27]],after=put(b,cells),next=move(a.goals,b,cells);
 assert.equal(next.goals[0].status,'blocked');
 // Raised reference peak permits a new geometrical repair, but the original
 // peak/region condition remains authoritative, not a freshly enlarged job.
 const r={cells:[[1,29],[1,30],[0,30],[1,31]],resultProfile:[10,11,12,13]};
 const adopted=accept(after,next.goals,r);assert.equal(adopted.goals.length,1);assert.equal(adopted.goalId,a.goalId);assert.deepEqual(adopted.goals[0].referenceProfile,[8,8,11,11]);
});
test('Left goals / trusted imports preserve current facts without plans or historical proof',()=>{
 const a=accept().goals;assert.deepEqual(L.importGoals(a),a);const saved=L.exportGoals(a);saved[0].status='blocked';assert.equal(a[0].status,'open');
 for(const patch of [g=>g.deepColumns=[9],g=>g.rule='unknown',g=>g.deficitRegion=[],g=>g.pieceId=23]){const bad=clone(a);patch(bad[0]);assert.throws(()=>L.importGoals(bad),/Invalid/);}
 assert.throws(()=>L.importGoals([...a,...a]),/Invalid/);
});
function clearBoard(row){const b=stack([8,8,11,11]);b[row]='XXXXXX....';return b;}
test('Left goals / clear translates surviving deficit and reference profile once',()=>{
 const b=clearBoard(39),a=accept(b),next=move(a.goals,b,[[6,39],[7,39],[8,39],[9,39]],[39]);
 assert.deepEqual(next.goals[0].referenceProfile,[7,7,10,10]);assert.deepEqual(next.goals[0].deficitRegion,[[0,30],[0,31],[0,32],[1,30],[1,31],[1,32]]);assert.equal(next.effects[0].kind,'translated');
});
test('Left goals / whole removed region retires distinctly, partial loss stays blocked',()=>{
 const b=clearBoard(30),g=accept().goals;g[0].deficitRegion=[[0,30],[1,30]];
 assert.deepEqual(move(g,b,[[6,30],[7,30],[8,30],[9,30]],[30]),{goals:[],effects:[{kind:'removed-by-clear',goalId:'left-1'}]});
 g[0].deficitRegion.push([0,31]);const next=move(g,b,[[6,30],[7,30],[8,30],[9,30]],[30]);assert.equal(next.goals.length,1);assert.deepEqual(next.goals[0].deficitRegion,[[0,31]]);
});
test('Left goals / equivalent current jobs reconcile with ephemeral reference remap only',()=>{
 const a=accept(),g=clone(a.goals[0]);g.id='other';const next=move([...a.goals,g],authentic,[[4,31],[5,31],[6,31],[7,31]]);
 assert.equal(next.goals.length,1);assert.deepEqual(next.effects,[{kind:'merged',goalId:'other',intoGoalId:'left-1'}]);assert.equal(next.goals[0].aliases,undefined);
});
test('Left goals / inconsistent clearing evidence cannot erase a supplied job',()=>{
 const a=accept();assert.throws(()=>L.advance(a.goals,{beforeBoard:authentic,afterBoard:authentic,event:{cells:repair.cells,clearedRows:[29,30,31]}}),/Inconsistent/);
});
test('Left goals / repeated real clears preserve one surviving deficit without accumulated lineage',()=>{
 let b=stack([8,8,11,11]).map((r,y)=>y>=32?r.slice(0,4)+'XX....':r),goals=accept(b).goals;
 const cells=[[6,39],[7,39],[8,39],[9,39]];
 for(let i=0;i<8;i++){
  const next=move(goals,b,cells,[39]);goals=next.goals;b=put(b,cells).slice(0,39);b.unshift('..........');
  assert.equal(goals.length,1);assert.equal(goals[0].id,'left-1');assert.equal(goals[0].deficitRegion.length,6);assert.equal(next.effects.length,1);
 }
 assert.deepEqual(goals[0].referenceProfile,[0,0,3,3]);assert.deepEqual(goals[0].deficitRegion,[[0,37],[0,38],[0,39],[1,37],[1,38],[1,39]]);
});
test('Left goals / genuinely distinct supplied current jobs have no arbitrary count cap',()=>{
 const g=accept().goals[0],goals=Array.from({length:100},(_,i)=>({...clone(g),id:`job-${i}`,deepColumns:[i%4],deficitRegion:[[i%4,Math.floor(i/4)]]}));
 assert.equal(L.importGoals(goals).length,100);
 const next=move(goals,authentic,[[4,31],[5,31],[6,31],[7,31]]);assert.equal(next.goals.length,100);assert.equal(next.effects.length,50);assert.ok(next.effects.every(e=>e.kind==='blocked'));
});
test('Left goals / creation identifies affected deep columns, not other valleys elsewhere',()=>{
 const b=stack([8,8,11,8]),r={...repair,resultProfile:[9,11,11,8]},a=accept(b,[],r);
 assert.deepEqual(a.goals[0].deepColumns,[0,1]);assert.ok(a.goals[0].deficitRegion.every(([x])=>x!==3));
});
test('Left goals / exact current job wins over earlier incompatible overlapping import',()=>{
 const exact=accept().goals[0],blocked={...clone(exact),id:'lower-peak',referenceProfile:[8,8,10,10],status:'blocked'};
 for(const current of [[blocked,exact],[exact,blocked]]){
  const before=clone(current),a=accept(authentic,current);
  assert.equal(a.goalId,exact.id);assert.deepEqual(a.effects,[{kind:'reused',goalId:exact.id}]);
  assert.deepEqual(a.goals,before,'distinct overlapping jobs are not merged or erased');assert.deepEqual(current,before);
 }
});
test('Left goals / exact match precedes compatible overlap, which precedes blocked overlap',()=>{
 const exact=accept().goals[0],compatible={...clone(exact),id:'narrow-job',deepColumns:[1],deficitRegion:[[1,29],[1,30],[1,31]]},blocked={...clone(exact),id:'lower-peak',referenceProfile:[8,8,10,10],status:'blocked'};
 const all=accept(authentic,[blocked,compatible,exact]);assert.equal(all.goalId,exact.id);assert.equal(all.goals.length,3);
 for(const current of [[blocked,compatible],[compatible,blocked]]){
  const a=accept(authentic,current);assert.equal(a.goalId,compatible.id);assert.equal(a.goals.length,2);
  assert.deepEqual(a.effects,[{kind:'reused',goalId:compatible.id}]);assert.deepEqual(a.goals,current);
 }
 const fallback=accept(authentic,[blocked]);assert.equal(fallback.goalId,blocked.id);assert.equal(fallback.goals.length,1);assert.deepEqual(fallback.effects,[{kind:'reused-blocked',goalId:blocked.id}]);
});
