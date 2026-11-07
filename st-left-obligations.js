/* Selected current Left deficits, independent of exact payer and checked plan.
 * Completion means one qualifying partial improvement, not filling every
 * deficit cell or flattening Left.
 * This component does not generate candidates or decide strategic admission.
 * Caller-owned effects/inverse receipts are not retained in the current jobs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STLeftObligations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const RULE='deep-deficit-partial-repair-v1',clone=x=>JSON.parse(JSON.stringify(x));
const integer=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const key=c=>JSON.stringify(c.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
const rough=p=>p.slice(1).reduce((n,h,i)=>n+Math.abs(h-p[i]),0);
function boardValid(b){return Array.isArray(b)&&b.length===40&&b.every(r=>typeof r==='string'&&r.length===10);}
function profile(b){return [0,1,2,3].map(x=>{const y=b.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});}
function cellsValid(c){return Array.isArray(c)&&c.length>0&&c.every(p=>Array.isArray(p)&&p.length===2&&integer(p[0],0,3)&&integer(p[1],0,39))&&new Set(c.map(String)).size===c.length;}
function definition(board,cells){
 const referenceProfile=profile(board),peak=Math.max(...referenceProfile),deepColumns=[0,1,2,3].filter(x=>peak-referenceProfile[x]>=3&&cells.some(([cx])=>cx===x)),deficitRegion=[];
 for(const x of deepColumns)for(let y=40-peak;y<40-referenceProfile[x];y++)deficitRegion.push([x,y]);
 return{rule:RULE,deepColumns,deficitRegion,referenceProfile};
}
function signature(g){return JSON.stringify([g.rule,g.deepColumns.slice().sort(),key(g.deficitRegion),g.referenceProfile]);}
// Import trusts supplied current facts. No historical proof, plan or board
// match is required. Reject unsupported shapes rather than silently dropping work.
function importGoals(input){
 if(!Array.isArray(input))throw new Error('Invalid Left goals');
 const ids=new Set();
 for(const g of input){
  if(!g||Object.keys(g).some(k=>!['id','rule','deepColumns','deficitRegion','referenceProfile','status'].includes(k))||typeof g.id!=='string'||!g.id||ids.has(g.id)||g.rule!==RULE||!['open','blocked'].includes(g.status)||
   !Array.isArray(g.referenceProfile)||g.referenceProfile.length!==4||!g.referenceProfile.every(h=>integer(h,0,40))||
   !Array.isArray(g.deepColumns)||!g.deepColumns.length||!g.deepColumns.every(x=>integer(x,0,3))||new Set(g.deepColumns).size!==g.deepColumns.length||
   !cellsValid(g.deficitRegion)||!g.deficitRegion.every(([x])=>g.deepColumns.includes(x))||!g.deepColumns.every(x=>g.deficitRegion.some(([cx])=>cx===x)))throw new Error('Invalid Left goal');
  ids.add(g.id);
 }
 return clone(input);
}
function reconcile(goals,effects){
 const out=[];
 for(const g of goals){const same=out.find(p=>signature(p)===signature(g));if(same){if(g.status==='blocked')same.status='blocked';effects.push({kind:'merged',goalId:g.id,intoGoalId:same.id});}else out.push(g);}
 return out;
}
// Predicate is piece-agnostic for actual payment only. It does not introduce
// I/L candidates or weaken the caller's existing checked route admission.
function qualifies(g,before,after,cells){
 if(!cellsValid(cells))return false;
 const a=profile(before),b=profile(after),peak=Math.max(...g.referenceProfile);
 if(!cells.some(([x,y])=>g.deficitRegion.some(([gx,gy])=>gx===x&&gy===y)))return false;
 if(!g.deepColumns.some(x=>peak-g.referenceProfile[x]>=3&&b[x]>a[x]&&b[x]>g.referenceProfile[x]))return false;
 if(cells.some(([,y])=>40-y>peak)||rough(b)>=rough(a)||rough(b)>=rough(g.referenceProfile))return false;
 return b.every((h,x)=>h-a[x]===cells.filter(([cx])=>cx===x).length);
}
function placed(board,cells,type='X'){
 const b=board.map(r=>r.split(''));
 for(const [x,y]of cells){if(b[y][x]!=='.')throw new Error('Left event overlaps occupied cell');b[y][x]=type;}
 return b.map(r=>r.join(''));
}
function accept(current,{board,repair,checked}={}){
 const goals=importGoals(current),effects=[];
 if(!boardValid(board))throw new Error('Invalid Left board');
 if(checked!==true||!repair||!cellsValid(repair.cells)||repair.cells.length!==4)return{goals,goalId:null,effects};
 const d=definition(board,repair.cells);if(!d.deepColumns.length)return{goals,goalId:null,effects};
 let after;try{after=placed(board,repair.cells);}catch{return{goals,goalId:null,effects};}
 if(!qualifies(d,board,after,repair.cells)||JSON.stringify(profile(after))!==JSON.stringify(repair.resultProfile))return{goals,goalId:null,effects};
 // A replacement can address a surviving current region even when its current
// profile differs from the stored reference; it must still pay that same job.
 const overlaps=g=>g.deficitRegion.some(([x,y])=>d.deficitRegion.some(([cx,cy])=>cx===x&&cy===y));
 // Imported overlapping jobs may have different promises. Prefer the exact
 // current job, then a compatible overlap, before retaining a blocked one.
 const existing=goals.find(g=>signature(g)===signature(d))||
  goals.find(g=>overlaps(g)&&qualifies(g,board,after,repair.cells))||goals.find(overlaps);
 if(existing){const compatible=qualifies(existing,board,after,repair.cells);existing.status=compatible?'open':'blocked';return{goals,goalId:existing.id,effects:[{kind:compatible?'reused':'reused-blocked',goalId:existing.id}]};}
 let n=1;while(goals.some(g=>g.id===`left-${n}`))n++;
 const goal={id:`left-${n}`,...d,status:'open'};goals.push(goal);effects.push({kind:'created',goalId:goal.id});return{goals,goalId:goal.id,effects};
}
function advance(current,{beforeBoard,event,afterBoard}={}){
 let goals=importGoals(current);const effects=[];
 if(!goals.length)return{goals,effects};
 if(!boardValid(beforeBoard)||!boardValid(afterBoard)||!event||!Array.isArray(event.cells)||event.cells.length!==4||!event.cells.every(p=>Array.isArray(p)&&p.length===2&&integer(p[0],0,9)&&integer(p[1],0,39))||new Set(event.cells.map(String)).size!==4||
  !Array.isArray(event.clearedRows)||!event.clearedRows.every(y=>integer(y,0,39))||new Set(event.clearedRows).size!==event.clearedRows.length)throw new Error('Invalid Left transition');
 const locked=placed(beforeBoard,event.cells),rows=event.clearedRows;
 const actualRows=locked.flatMap((r,y)=>r.includes('.')?[]:[y]);
 // Verify occupancy, not piece color. A malformed clear cannot retire work.
 const cleared=locked.filter((_,y)=>!rows.includes(y));while(cleared.length<40)cleared.unshift('..........');
 if(JSON.stringify(actualRows)!==JSON.stringify(rows.slice().sort((a,b)=>a-b))||cleared.some((r,y)=>[...r].some((v,x)=>(v==='.')!==(afterBoard[y][x]==='.'))))throw new Error('Inconsistent Left clear transition');
 const out=[];
 for(const g of goals){
  if(!rows.length&&!event.topOut&&qualifies(g,beforeBoard,afterBoard,event.cells)){effects.push({kind:'fulfilled',goalId:g.id});continue;}
  if(rows.length){
   const surviving=g.deficitRegion.filter(([,y])=>!rows.includes(y));
   if(!surviving.length){effects.push({kind:'removed-by-clear',goalId:g.id});continue;}
   g.deficitRegion=surviving.map(([x,y])=>[x,y+rows.filter(r=>r>y).length]);
   g.deepColumns=g.deepColumns.filter(x=>g.deficitRegion.some(([cx])=>cx===x));
   // Reference solid columns translate by deleting their occupied rows.
   g.referenceProfile=g.referenceProfile.map(h=>h-rows.filter(y=>y>=40-h).length);
   effects.push({kind:'translated',goalId:g.id});
  }
  // Retain an ambiguous/obstructed deficit, including occupied cells, rather
  // than inferring payment from a stale plan or unrelated surface change.
  if(g.deficitRegion.some(([x,y])=>afterBoard[y][x]!=='.')||!g.deepColumns.some(x=>Math.max(...g.referenceProfile)-g.referenceProfile[x]>=3)){
   if(g.status!=='blocked')effects.push({kind:'blocked',goalId:g.id});g.status='blocked';
  }
  out.push(g);
 }
 goals=reconcile(out,effects);return{goals,effects};
}
return{RULE,accept,advance,importGoals,exportGoals:importGoals};
});
