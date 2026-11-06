/* Current exact Center duties. No piece history, closed-event archive or cap.
 * Actual accounting and projected routes share these geometric transition facts.
 * Route admission and retained lost-target diagnostics remain caller-owned. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-structure')):factory(root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STCenterObligations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(S){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const cellsKey=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
const sameTarget=(a,b)=>a.piece===b.piece&&cellsKey(a.cells)===cellsKey(b.cells);
const matches=(target,event)=>target.piece===event.type&&cellsKey(target.cells)===cellsKey(event.cells);
const translate=(cells,rows)=>cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(r=>r>y).length]);
function completions(board,stages=[],first=null){
 return S.geometry(board).center.completions.filter(c=>S.supportedCenterCompletion(c,stages)&&(!first||S.centerPairCompletion(first,c))).map(c=>({piece:c.piece,cells:clone(c.cells)}));
}
function start(board){
 const alternatives=completions(board);
 return{pending:alternatives.length?[{id:'origin',rootId:null,family:null,createdAt:0,alternatives}]:[],debt:[]};
}
// One immutable fact frame can serve actual state and a projected route. The
// caller supplies current stages, including any route-only lost stage markers.
function frame(before,after,event,stages=[]){
 const rows=event.clearedRows||[],moved=stages.map(p=>({...p,alternatives:p.alternatives.map(c=>({...c,cells:translate(c.cells,rows)}))}));
 const available=completions(before,stages);
 return{event,rows,available,completed:available.filter(c=>matches(c,event)),afterAvailable:completions(after,moved)};
}
function inspect(target,facts){
 const supported=target.alternatives.filter(c=>facts.available.some(a=>sameTarget(a,c)));
 const alternatives=target.alternatives.map(c=>({...c,cells:translate(c.cells,facts.rows)}));
 const live=alternatives.filter(c=>c.cells.every(([,y])=>y>=0)&&facts.afterAvailable.some(a=>sameTarget(a,c)));
 return{finished:!target.lost&&supported.some(c=>matches(c,facts.event)),supported,alternatives,live,
  removed:alternatives.every(c=>c.cells.every(([,y])=>y<0))};
}
// Effects describe this operation only. A consumer may retain diagnostic
// history externally; it must not put those effects back in current state.
function apply(current,before,after,event,{pieceId,at}={}){
 const input=clone(current),facts=frame(before,after,event,[...input.pending,...input.debt]);
 const effects=[],pairs=[],pending=[],debt=input.debt;
 for(const p of input.pending){
  const result=inspect(p,facts);
  if(result.finished){
   effects.push({...p,status:'fulfilled',at,partnerId:pieceId});
   if(p.rootId!==null&&p.family)pairs.push({family:p.family,rootId:p.rootId,partnerId:pieceId,at});
   continue;
  }
  if(result.supported.some(c=>c.piece===event.type)&&!facts.completed.length&&!debt.some(d=>d.id===p.id)){
   const diverted={...clone(p),divertedAt:at,divertedPieceId:pieceId};debt.push(diverted);
   effects.push({...clone(diverted),status:'diverted',at});
  }
  if(result.live.length)pending.push({...p,alternatives:result.live});
  else effects.push({...p,status:'invalidated',at,reason:facts.rows.some(y=>p.alternatives.some(c=>c.cells.some(([,cy])=>cy===y)))?'Clear removed target cells.':'Exact supported completion is no longer present.'});
 }
 const nextDebt=[];
 for(const d of debt){
  if(d.alternatives.some(c=>matches(c,event))&&facts.completed.length){effects.push({...d,status:'debt-fulfilled',at,partnerId:pieceId});continue;}
  const result=inspect(d,facts);
  if(result.live.length)nextDebt.push({...d,alternatives:result.live});
  else effects.push({...d,status:'debt-invalidated',at,reason:'The original supported target was lost, not repaid.'});
 }
 if(event.cells.every(([x])=>x>=4&&x<7)&&S.CENTER_PAIRS[event.type]){
  const alternatives=completions(after,[],event.type);
  if(alternatives.length&&!pending.some(p=>JSON.stringify(p.alternatives)===JSON.stringify(alternatives))){
   const created={id:'piece-'+pieceId,rootId:pieceId,family:S.centerPairFamily(event.type),createdAt:at,alternatives};
   pending.push(created);effects.push({...clone(created),status:'created',at});
  }
 }
 return{state:{pending,debt:nextDebt},effects,pairs};
}
return Object.freeze({start,apply,frame,inspect,completions,matches,translate});
});
