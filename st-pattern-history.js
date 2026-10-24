/* Observed board/lock evidence, never an imported trusted phase flag. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure')):factory(root.STRules,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPatternHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S){
'use strict';const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function start(raw){const p=S.notchPattern(raw.board);return p.status==='established'||p.status==='broken'?{origin:raw.board.slice(),steps:[]}:null;}
function resolve(raw,history){
 if(!history)return S.notchPattern(raw.board);
 if(!Array.isArray(history.origin)||!Array.isArray(history.steps)||history.steps.length>128)return{status:'invalid-history',protectedRows:[],anchorRow:null};
 let board=history.origin.slice(),pattern;try{pattern=S.notchPattern(board);}catch{return{status:'invalid-history',protectedRows:[],anchorRow:null};}
 if(!['established','broken'].includes(pattern.status))return{status:'invalid-history',protectedRows:[],anchorRow:null};
 for(const step of history.steps){if(!step?.pose||!step?.event)return{status:'invalid-history',protectedRows:[],anchorRow:null};let state;try{state=R.createState({board,active:step.pose,queue:['I']});}catch{return{status:'invalid-history',protectedRows:[],anchorRow:null};}
  const r=R.replay(state,['HD']);if(!r.valid||r.events.length!==1||!same(r.events[0].cells,step.event.cells)||r.events[0].lines!==step.event.lines||r.events[0].spin!==step.event.spin||!same(r.events[0].clearedRows,step.event.clearedRows))return{status:'invalid-history',protectedRows:[],anchorRow:null};
  pattern=S.advanceNotches(board,{state:r.state,event:r.events[0]},pattern).pattern;board=r.state.board;
 }
 return same(board,raw.board)?pattern:{status:'invalid-history',protectedRows:[],anchorRow:null};
}
function update(history,before,after,event){
 const old=resolve(before,history),r=R.replay(before,['HD']);
 if(!r.valid||r.events.length!==1||!same(r.events[0],event)||!same(r.state.board,after.board)||old.status==='invalid-history')return{origin:[],steps:[]};
 const next=S.advanceNotches(before.board,{state:r.state,event},old).pattern,fresh=S.notchPattern(after.board);
 if(next.status==='established'&&fresh.status==='established'&&next.anchorRow===fresh.anchorRow)return start(after);
 if(!history){if(old.status!=='established'&&old.status!=='broken')return start(after);history=start(before);}
 if(history.steps.length>=128)return{...history,steps:[...history.steps,{pose:null,event:null}]};
 return{origin:history.origin.slice(),steps:[...history.steps,{pose:clone(before.active),event:clone(event)}]};
}
return Object.freeze({start,resolve,update});
});
