/* Local shadow observations only. Never serialized into planner requests or used
 * to select moves. Immutable checkpoints support Undo without a lifetime tape. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure')):factory(root.STRules,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPieceLedger=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S){
'use strict';
const trusted=new WeakSet(),TYPES=['I','J','L','O','S','T','Z'],LIMIT=64;
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const seal=x=>{freeze(x);trusted.add(x);return x;};
const view=s=>({rules:s.rules,board:s.board.slice(),active:s.active?clone(s.active):null,hold:s.hold??null,queue:s.queue.slice(),canHold:s.canHold,streamCursor:s.streamCursor||0,topOut:Boolean(s.topOut)});
const key=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
const completion=board=>S.geometry(board).center.completions.filter(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported').map(c=>({piece:c.piece,cells:clone(c.cells)}));
const matches=(a,b)=>a.piece===b.type&&key(a.cells)===key(b.cells);
const translate=(cells,rows)=>cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(r=>r>y).length]);
function invalid(raw,reason){let observation=null;try{observation=view(raw);}catch{}return seal({version:1,coverage:'invalid',reason,observation});}
function bound(h,raw){try{return trusted.has(h)&&h.coverage!=='invalid'&&R.validate(raw).length===0&&same(h.observation,view(raw));}catch{return false;}}
function piece(h,type){const id=h.nextId++;return{id,type,bag:h.originKnown?Math.floor((id-1)/7):null,acquired:false};}
function acquire(h,p){if(p&&!p.acquired){p.acquired=true;h.inventory[p.type].entered++;}}
function pendingOrigin(board){const alternatives=completion(board);return alternatives.length?[{root:null,family:null,alternatives}]:[];}
function start(raw,{fresh=false}={}){
 try{
  if(R.validate(raw).length||raw.queue.length>6)return invalid(raw,'Invalid public observation or oversized preview.');
  const o=view(raw),known=Boolean(fresh&&o.board.every(r=>r==='..........')&&o.active&&o.hold===null&&o.streamCursor===1&&o.queue.length===6&&new Set([o.active.type,...o.queue]).size===7);
  const h={version:1,coverage:known?'from-empty':'since-observation',originKnown:known,observation:o,nextId:1,actions:0,locks:0,inventory:Object.fromEntries(TYPES.map(t=>[t,{entered:0,locked:0}])),active:null,hold:null,queue:[],bagFrontier:{index:known?0:null,seen:[]},structure:{left:{S:0,L:0},pairs:{SL:0,LO:0,OJ:0,ZJ:0},pending:pendingOrigin(o.board),unresolved:{count:0,byType:{S:0,L:0},examples:[],identityOverflow:false}},zDiversions:{beforeFirstTsd:0,afterFirstTsd:0,firstTsdObserved:false}};
  if(o.active){h.active=piece(h,o.active.type);acquire(h,h.active);}if(o.hold){h.hold=piece(h,o.hold);acquire(h,h.hold);}h.queue=o.queue.map(t=>piece(h,t));
  if(known)h.bagFrontier.seen=[o.active.type,...o.queue];
  return seal(h);
 }catch{return invalid(raw,'Could not initialize shadow observations.');}
}
function unresolved(h,root,reason){
 if(!root||!['S','L'].includes(root.type))return;
 const u=h.structure.unresolved;u.count++;u.byType[root.type]++;
 if(u.examples.length<LIMIT)u.examples.push({id:root.id,type:root.type,bag:root.bag,at:h.locks,reason});else u.identityOverflow=true;
}
function observeStructure(h,before,after,e,p){
 const available=completion(before.board),afterAvailable=completion(after.board),rows=e.clearedRows||[],remaining=[];
 let paired=false;
 for(const old of h.structure.pending){
  const supported=old.alternatives.filter(c=>available.some(a=>a.piece===c.piece&&key(a.cells)===key(c.cells)));
  if(supported.some(c=>matches(c,e))){
   if(old.family){h.structure.pairs[old.family]++;paired=true;}
   continue;
  }
  const alternatives=old.alternatives.map(c=>({...c,cells:translate(c.cells,rows)})).filter(c=>c.cells.every(([,y])=>y>=0)&&afterAvailable.some(a=>a.piece===c.piece&&key(a.cells)===key(c.cells)));
  if(alternatives.length)remaining.push({...old,alternatives});
  else unresolved(h,old.root,'A supported Center completion was lost without an observed completion.');
 }
 const left=e.cells.every(([x])=>x<4),center=e.cells.every(([x])=>x>=4&&x<7);
 if(['S','L'].includes(p.type)&&left)h.structure.left[p.type]++;
 let started=false;
 if(center&&S.CENTER_PAIRS[p.type]){
  const alternatives=afterAvailable.filter(c=>c.piece===S.CENTER_PAIRS[p.type]);
  if(alternatives.length&&!remaining.some(old=>same(old.alternatives,alternatives))){remaining.push({root:clone(p),family:p.type+S.CENTER_PAIRS[p.type],alternatives});started=true;}
 }
 if(['S','L'].includes(p.type)&&!left&&!paired&&!started)unresolved(h,p,'This S/L allocation has no recognized Left or Center pairing accommodation.');
 h.structure.pending=remaining;
}
function applyAction(history,before,action,after){
 if(!bound(history,before))return invalid(after,'Missing, stale or untrusted shadow checkpoint.');
 try{
  if(!['L','R','SD','HD','HOLD','CW','CCW','R180'].includes(action)||R.validate(after).length)return invalid(after,'Invalid shadow transition.');
  const initial=R.createState(before),expected=R.move(initial,action),ev=view(expected),av=view(after);
  if(!same({...ev,queue:[]},{...av,queue:[]})||!same(av.queue.slice(0,ev.queue.length),ev.queue)||av.queue.length>6)return invalid(after,'Shadow action or revealed supply does not replay.');
  if(action==='HD'&&(!expected.lastEvent||!same(expected.lastEvent,after.lastEvent??expected.lastEvent)))return invalid(after,'Shadow lock event does not replay.');
  if(expected===initial)return history;
  const h=clone(history);h.actions++;
  const draw=()=>{const p=h.queue.shift();if(!p)throw Error('Missing preview identity');acquire(h,p);return p;};
  if(action==='HOLD'){if(h.hold){[h.active,h.hold]=[h.hold,h.active];}else{h.hold=h.active;h.active=draw();}}
  if(action==='HD'){
   const p=h.active,e=expected.lastEvent;h.locks++;h.inventory[p.type].locked++;
   observeStructure(h,before,after,e,p);
   if(e.type==='Z'&&e.cells.every(([x])=>x<7))h.zDiversions[h.zDiversions.firstTsdObserved?'afterFirstTsd':'beforeFirstTsd']++;
   if(e.type==='T'&&e.spin==='full'&&e.lines===2&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7))h.zDiversions.firstTsdObserved=true;
   h.active=expected.active?draw():null;
  }
  for(const type of av.queue.slice(ev.queue.length)){
   const p=piece(h,type);h.queue.push(p);
   if(h.originKnown){if(p.bag!==h.bagFrontier.index)h.bagFrontier={index:p.bag,seen:[]};if(h.bagFrontier.seen.includes(type))return invalid(after,'Observed supply contradicts the seven-bag origin.');h.bagFrontier.seen.push(type);}
  }
  if(h.active?.type!==(av.active?.type)|| (h.hold?.type??null)!==av.hold||!same(h.queue.map(p=>p.type),av.queue))return invalid(after,'Shadow identity continuity failed.');
  h.observation=av;return seal(h);
 }catch{return invalid(after,'Could not replay shadow transition.');}
}
function resolve(raw,h){
 if(!bound(h,raw))return{version:1,coverage:'invalid',reason:h?.reason||'Missing, stale or untrusted shadow checkpoint.'};
 const inventory=clone(h.inventory);for(const t of TYPES)inventory[t].outstanding=inventory[t].entered-inventory[t].locked;
 const live=[h.active,h.hold].filter(Boolean),s=live.find(p=>p.type==='S'),l=live.find(p=>p.type==='L');
 const pendingSL=h.structure.pending.find(p=>p.family==='SL');
 // A candidate is compatibility evidence, not a legal move certificate or a
 // surplus verdict. Only active/held inventory is used, never unseen supply.
 const pairingCandidates=[];
 if(pendingSL&&l)pairingCandidates.push({kind:'pending-SL',sId:pendingSL.root.id,lId:l.id,executionVerified:false});
 else if(!h.structure.pending.length&&S.geometry(raw.board).center.status==='level'&&s&&l)pairingCandidates.push({kind:'available-SL',sId:s.id,lId:l.id,executionVerified:false});
 return{version:1,coverage:h.coverage,originKnown:h.originKnown,actions:h.actions,locks:h.locks,inventory,instances:{active:clone(h.active),hold:clone(h.hold),queue:clone(h.queue)},structure:{...clone(h.structure),pairingCandidates},zDiversions:clone(h.zDiversions),note:'Observation-only counters and pairing facts. Not hanging-status or Extra-Z eligibility; no planner authority. Imported history remains unknown.'};
}
return Object.freeze({start,applyAction,resolve,limits:Object.freeze({unresolvedExamples:LIMIT})});
});
