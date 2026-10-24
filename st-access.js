/* Geometry and actual SRS movement are different tests. No piece supply claim. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure')):factory(root.STRules,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STAccess=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S){
'use strict';
const cache=new Map(),key=c=>c.join(',');
function covered(board){const out=[];for(let x=0;x<7;x++){let roof=false;for(let y=0;y<40;y++){if(board[y][x]!=='.')roof=true;else if(roof)out.push([x,y]);}}return out;}
function newlyCovered(before,after,event,notches){const rows=event.clearedRows||[],old=new Set(covered(before).filter(([,y])=>!rows.includes(y)).map(([x,y])=>key([x,y+rows.filter(r=>r>y).length])));const pattern=notches||S.notchPattern(after);return covered(after).filter(c=>!old.has(key(c))&&!(c[0]===6&&pattern.protectedRows.includes(c[1])));}
function access(board,cells,options={}){
 if(!cells.length)return{status:'no-new-roofed-cells',complete:true,reachable:true,cells:[],visited:0};
 const id=JSON.stringify([options.rules||R.PROFILE.id,board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')),cells]);if(cache.has(id))return{...cache.get(id),visited:0,cached:true};
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??12000;
 if(now()>=deadline||limit<=0)return{status:'unknown-access-budget',complete:false,reachable:null,cells,unreachable:[],witnesses:[],visited:0};
 const missing=new Set(cells.map(key)),possible=new Set();let visited=0;
 // A shape must geometrically fit at rest before movement search is relevant.
 for(const type of 'IJLOSTZ')for(let rotation=0;rotation<4;rotation++){
  const offsets=R.cells({type,x:0,y:0,rotation});
  for(const [cx,cy]of cells)for(const [dx,dy]of offsets){const pose={type,x:cx-dx,y:cy-dy,rotation};if(R.fits(board,pose)&&!R.fits(board,{...pose,y:pose.y+1}))possible.add(type);}
 }
 let complete=true;const witnesses=[];
 for(const type of possible){if(now()>=deadline||visited>=limit){complete=false;break;}
  const state=R.createState({rules:options.rules,board,active:type,queue:['I']}),e=R.placements(state,{allowHold:false,maxNodes:limit-visited,deadline,now});visited+=e.visited;
  for(const p of e.placements){const hit=p.event.cells.filter(c=>missing.has(key(c)));if(hit.length){hit.forEach(c=>missing.delete(key(c)));witnesses.push({piece:type,cells:hit,witness:p.witness,target:p.target});}}
  if(!missing.size)break;if(!e.complete){complete=false;break;}
 }
 const result={status:!missing.size?'movement-access-witnessed':complete?'no-current-tetromino-access':'unknown-access-budget',complete:!missing.size||complete,reachable:!missing.size?true:complete?false:null,cells,unreachable:complete?[...missing].map(s=>s.split(',').map(Number)):[],witnesses,visited};
 if(result.complete){if(cache.size>4096)cache.clear();cache.set(id,{...result,visited:0});}return result;
}
function check(before,p,options={}){const n=S.advanceNotches(before.board,p,options.notches||S.notchPattern(before.board));return access(p.state.board,newlyCovered(before.board,p.state.board,p.event,n.pattern),{...options,rules:before.rules});}
function prefix(before,steps,options={}){
 let state=before,notches=options.notches||S.notchPattern(before.board),visited=0;const proofs=[];
 if(['broken','invalid-history'].includes(notches.status))return{reachable:false,complete:true,visited,status:'invalid-observed-pattern',steps:proofs};
 for(const [index,step]of steps.entries()){
  const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return{reachable:false,complete:true,visited,status:'invalid-prefix-witness',failedStep:index+1,steps:proofs};
  const p={state:r.state,event:r.events[0]},n=S.advanceNotches(state.board,p,notches);if(!n.valid)return{reachable:false,complete:true,visited,status:'violates-observed-pattern',failedStep:index+1,steps:proofs};
  const proof=check(state,p,{...options,notches,maxNodes:Math.max(0,(options.maxNodes??12000)-visited)});visited+=proof.visited;proofs.push(proof);
  if(proof.reachable!==true)return{reachable:proof.reachable,complete:proof.complete,visited,status:proof.status,failedStep:index+1,steps:proofs};
  state=r.state;notches=n.pattern;
 }
 return{reachable:true,complete:true,visited,status:'prefix-movement-access-witnessed',steps:proofs};
}
return Object.freeze({covered,newlyCovered,access,check,prefix,clearCache:()=>cache.clear()});
});
