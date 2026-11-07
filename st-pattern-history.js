/* Current notch facts. Board/lock tapes are unsupported. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure')):factory(root.STRules,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPatternHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S){
'use strict';
const VERSION=2,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const invalid=()=>({status:'invalid-history',protectedRows:[],anchorRow:null});
const invalidSnapshot=()=>({version:VERSION,status:'invalid-history'});
function rows(anchorRow){const result=[];for(let y=anchorRow;y>=0;y-=3)result.push(y);return result;}
function checkpoint(pattern){
 if(pattern.status==='invalid-history')return invalidSnapshot();
 if(pattern.status==='unanchored')return null;
 return{version:VERSION,status:pattern.status,anchorRow:pattern.anchorRow,blockedRows:pattern.blockedRows.slice(),source:pattern.source};
}
function current(history){
 // These are schema checks, not authentication against the board or a past
 // witness. A supplied current phase is authoritative even on a board whose
 // remaining geometry cannot independently establish it.
 if(history.version!==VERSION||Object.keys(history).some(k=>!['version','status','anchorRow','blockedRows','source'].includes(k))||
  !['established','broken'].includes(history.status)||!Number.isInteger(history.anchorRow)||history.anchorRow< -3||history.anchorRow>=40||
  !Array.isArray(history.blockedRows)||(history.source!==undefined&&(typeof history.source!=='string'||!history.source.length)))return invalid();
 const protectedRows=rows(history.anchorRow),blocked=history.blockedRows;
 if(blocked.some(y=>!Number.isInteger(y)||!protectedRows.includes(y))||new Set(blocked).size!==blocked.length||
  (history.status==='broken')!==(blocked.length>0))return invalid();
 return{status:history.status,anchorRow:history.anchorRow,protectedRows,blockedRows:protectedRows.filter(y=>blocked.includes(y)),source:history.source??'imported-current-state'};
}
function start(raw){return checkpoint(S.notchPattern(raw.board));}
function resolve(raw,history){
 if(history===null||history===undefined)return S.notchPattern(raw.board);
 if(typeof history!=='object'||Array.isArray(history))return invalid();
 return current(history);
}
// Absence retains fresh-recognition semantics.
function snapshot(raw,history){return history===null||history===undefined?null:checkpoint(resolve(raw,history));}
function update(history,before,after,event){
 const old=resolve(before,history);if(old.status==='invalid-history')return invalidSnapshot();
 let r;try{r=R.replay(before,['HD']);}catch{return invalidSnapshot();}
 if(!r.valid||r.events.length!==1||!same(r.events[0],event)||!same(r.state.board,after.board))return invalidSnapshot();
 const next=S.advanceNotches(before.board,{state:r.state,event},old).pattern,fresh=S.notchPattern(after.board);
 // Preserve the former updater's diagnostic source when fresh recognition
 // agrees. Otherwise keep translated or sticky broken facts, not a replay.
 return checkpoint(next.status==='established'&&fresh.status==='established'&&next.anchorRow===fresh.anchorRow?fresh:next);
}
return Object.freeze({VERSION,start,resolve,snapshot,update});
});
