/* Controller adapter for freshly checked selected advice. Current Left work is
 * retained independently of the replaceable route; this grants no permission. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure')):factory(root.STRules,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STLeftPlan=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),cellsKey=a=>JSON.stringify(a.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
function selectedRepairs(position,advice,{checked=false}={}){
 if(!checked||!advice?.target||advice.recommendation?.kind==='risky'||!Array.isArray(advice.continuation)||advice.continuation.length>7)return[];
 if(!advice.continuation.length||!same(advice.continuation[0]?.witness,advice.witness)||!same(advice.continuation[0]?.event?.target,advice.target))return[];
 const result=[],seen=new Set(),root=R.createState(position),left=board=>board.map(r=>r.slice(0,4));let current=root,unchangedLeft=true;
 try{
  // Complete finite witnesses remain checked here for association, not search.
  // A serialized label alone cannot register a current goal.
  for(const step of advice.continuation){
   if(!Array.isArray(step.witness)||step.witness.length<1||step.witness.length>256)return[];
   const replay=R.replay(current,step.witness);if(!replay.valid||replay.events.length!==1||step.witness.at(-1)!=='HD'||!same(replay.events[0],step.event))return[];
   const event=replay.events[0],label=step.structuralEvidence?.leftRepair;
   if(label&&unchangedLeft&&same(left(current.board),left(root.board))&&event.type==='J'&&!event.lines&&!event.topOut&&event.cells.every(([x])=>x<4)&&label.piece==='J'&&Number.isSafeInteger(label.pieceId)&&label.pieceId>0&&Array.isArray(label.cells)&&same(label.beforeProfile,S.geometry(root.board).left.profile)&&cellsKey(label.cells)===cellsKey(event.cells)){
    const target=S.geometry(root.board).left.completions.find(c=>c.piece==='J'&&c.resultStatus==='partial-repair'&&cellsKey(c.cells)===cellsKey(event.cells)&&same(c.resultProfile,label.resultProfile));
    if(target&&!seen.has(cellsKey(target.cells))){seen.add(cellsKey(target.cells));result.push({cells:clone(target.cells),resultProfile:target.resultProfile.slice()});}
   }
   unchangedLeft=unchangedLeft&&!event.lines&&event.cells.every(([x])=>x>=4);current=replay.state;
  }
 }catch{return[];}
 return result;
}
return Object.freeze({selectedRepairs});
});
