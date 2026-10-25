/* Public, observed resource diagnostics. Never a planner input or a Reset rule.
 * Histories are immutable local capabilities, not trusted imported JSON. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-opening-patterns')):factory(root.STRules,root.STStructure,root.STSourcePatterns);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResourceHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,Patterns){
'use strict';
const trusted=new WeakSet(),clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const MAX_ACTIONS=4096,MAX_LOCKS=512;
const SOURCE='https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit';
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const seal=h=>{freeze(h);trusted.add(h);return h;};
const view=o=>({rules:o.rules,board:o.board.slice(),active:o.active?clone(o.active):null,hold:o.hold??null,canHold:o.canHold,queue:o.queue.slice(),streamCursor:o.streamCursor||0,topOut:Boolean(o.topOut)});
const bound=(h,o)=>{try{return trusted.has(h)&&h.observation&&R.validate(o).length===0&&same(h.observation,view(o));}catch{return false;}};
const cellsKey=c=>JSON.stringify(c.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
const heights=b=>Array.from({length:10},(_,x)=>{const y=b.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
const canonical=e=>e.lines===0||(e.type==='T'&&e.spin==='full'&&e.lines===2&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7))||(e.type==='I'&&e.lines===4&&e.cells.every(([x])=>x>=7));
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&canonical(e);
const whole=e=>e.cells.every(([x])=>x<4)?'left':e.cells.every(([x])=>x>=4&&x<7)?'center':e.cells.every(([x])=>x<7)?'left-center':e.cells.every(([x])=>x>=7)?'right':'cross-right';
function cap(board){const h=heights(board),top=40-h[9];return h[7]===0&&h[8]>=2&&h[9]===h[8]+1&&board.slice(40-h[8]).every(r=>r[8]!=='.')&&board[top][9]!=='.'&&board[top+1][9]!=='.'&&board.slice(top+2).every(r=>r[9]==='.');}
function quality(board,counts){const h=heights(board);return h[4]===h[5]&&h[5]===h[6]&&counts.S===counts.L&&Math.abs(Math.max(...h.slice(0,4))-Math.max(...h.slice(4,7)))<=3;}
function addPiece(h,type,ageKnown=true){const id=h.nextId++,order=h.observedCount++;h.pieces[id]={id,type,observedOrder:ageKnown?order:null,bag:h.fresh?Math.floor(order/7):null,allocation:null,pair:null};return id;}
function invalid(raw,reason,status='invalid'){let observation=null;try{observation=view(raw);}catch{}return seal({schemaVersion:1,coverage:{status,reason},observation,actions:0,locks:0});}
function start(raw,{fresh=false}={}){
 try{if(R.validate(raw).length)return invalid(raw,'Invalid public origin.');const o=view(raw);
  // Only the caller's actual new empty session may establish observed bag zero.
  // Imported snapshots, including forged flags, use the default unknown origin.
  fresh=Boolean(fresh&&o.board.every(r=>r==='..........')&&o.active&&o.hold===null&&o.streamCursor===1&&o.queue.length===6&&new Set([o.active.type,...o.queue]).size===7);
  const h={schemaVersion:1,coverage:{status:fresh?'complete':'partial',reason:fresh?'Observed from a local empty seven-bag start.':'Earlier placements and held-piece age are unknown.'},observation:o,fresh,nextId:1,observedCount:0,pieces:{},active:null,hold:null,queue:[],actions:0,locks:0,allocations:[],pairs:[],center:{pending:[],debt:[],closed:[]},milestones:{sourcePattern:null,firstTsd:null,maintenanceHandoff:null},opening:{counts:{S:0,L:0,T:0,Z:0,TNonRight:0,ZNonRight:0,ZRight:0},violations:[],cap:null,quality:null},extraZ:{baseline:null,allocations:[],departures:[]}};
  if(o.active)h.active=addPiece(h,o.active.type,fresh);if(o.hold)h.hold=addPiece(h,o.hold,false);h.queue=o.queue.map(type=>addPiece(h,type,fresh));
  // Imported geometry is factual even though its producing piece identity is not.
  h.center.pending=initialPending(o.board);
  return seal(h);
 }catch{return invalid(raw,'Could not validate public origin.');}
}
function completionList(board){return S.geometry(board).center.completions.filter(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported').map(c=>({piece:c.piece,cells:clone(c.cells)}));}
function initialPending(board){const alternatives=completionList(board);return alternatives.length?[{id:'origin',rootId:null,family:null,createdAt:0,alternatives}]:[];}
function matching(c,e){return c.piece===e.type&&cellsKey(c.cells)===cellsKey(e.cells);}
function translate(cells,rows){return cells.map(([x,y])=>[x,rows.includes(y)?-1:y+rows.filter(r=>r>y).length]);}
function updateCenter(h,before,after,e,id){
 const available=completionList(before.board),afterAvailable=completionList(after.board),rows=e.clearedRows||[];
 const completed=available.filter(c=>matching(c,e));
 const old=h.center.pending,remaining=[];
 for(const p of old){
  const supported=p.alternatives.filter(c=>available.some(a=>a.piece===c.piece&&cellsKey(a.cells)===cellsKey(c.cells)));
  const finished=supported.some(c=>matching(c,e));
  if(finished){
   h.center.closed.push({...p,status:'fulfilled',at:h.locks,partnerId:id});
   if(p.rootId!==null&&p.family){const pair={family:p.family,rootId:p.rootId,partnerId:id,at:h.locks};h.pairs.push(pair);h.pieces[p.rootId].pair=pair;h.pieces[id].pair=pair;}
   continue;
  }
  if(supported.some(c=>c.piece===e.type)&&!completed.length&&!h.center.debt.some(d=>d.id===p.id))h.center.debt.push({...clone(p),divertedAt:h.locks,divertedPieceId:id});
  const moved=p.alternatives.map(c=>({...c,cells:translate(c.cells,rows)}));
  const live=moved.filter(c=>c.cells.every(([,y])=>y>=0)&&afterAvailable.some(a=>a.piece===c.piece&&cellsKey(a.cells)===cellsKey(c.cells)));
  if(live.length)remaining.push({...p,alternatives:live});else h.center.closed.push({...p,status:'invalidated',at:h.locks,reason:rows.some(y=>p.alternatives.some(c=>c.cells.some(([,cy])=>cy===y)))?'Clear removed target cells.':'Exact supported completion is no longer present.'});
 }
 const nextDebt=[];
 for(const d of h.center.debt){
  if(d.alternatives.some(c=>matching(c,e))&&completed.length){h.center.closed.push({...d,status:'debt-fulfilled',at:h.locks,partnerId:id});continue;}
  const moved=d.alternatives.map(c=>({...c,cells:translate(c.cells,rows)}));
  const live=moved.filter(c=>c.cells.every(([,y])=>y>=0)&&afterAvailable.some(a=>a.piece===c.piece&&cellsKey(a.cells)===cellsKey(c.cells)));
  if(live.length)nextDebt.push({...d,alternatives:live});else h.center.closed.push({...d,status:'debt-invalidated',at:h.locks,reason:'The original supported target was lost, not repaid.'});
 }
 h.center.debt=nextDebt;
 if(whole(e)==='center'&&S.CENTER_PAIRS[e.type]){
  const alternatives=afterAvailable.filter(c=>c.piece===S.CENTER_PAIRS[e.type]);
  if(alternatives.length&&!remaining.some(p=>same(p.alternatives,alternatives)))remaining.push({id:'piece-'+id,rootId:id,family:e.type+S.CENTER_PAIRS[e.type],createdAt:h.locks,alternatives});
 }
 h.center.pending=remaining;
}
function observeOpening(h,before,after,e){
 const o=h.opening,c=o.counts,region=whole(e),nonRight=e.cells.every(([x])=>x<7);
 if(e.type in c)c[e.type]++;
 if(!canonical(e)||e.topOut||after.topOut)o.violations.push({at:h.locks,reason:canonical(e)?'top-out':'noncanonical-clear'});
 if(e.type==='T'){
  if(e.lines===0&&nonRight)c.TNonRight++;
  else if(!tsd(e))o.violations.push({at:h.locks,reason:'T outside the source allocation'});
 }
 if(e.type==='Z'){
  if(e.lines===0&&nonRight)c.ZNonRight++;
  else if(e.lines===0&&e.cells.every(([x])=>x>=8)){
   c.ZRight++;
   if(!o.cap&&cap(after.board))o.cap={at:h.locks,roof:e.cells.filter(([x])=>x===9).map(c=>c.slice())};
   else if(!o.cap)o.violations.push({at:h.locks,reason:'Z did not establish the normal Right cap'});
  }else o.violations.push({at:h.locks,reason:'Z outside the source allocation'});
 }
 if(!h.milestones.firstTsd&&o.quality&&(c.TNonRight>2||c.ZNonRight>1))o.violations.push({at:h.locks,reason:'The observed opener departed from its recorded source allocation checkpoint.'});
 if(!h.milestones.firstTsd&&!tsd(e)&&!o.violations.length&&c.T===2&&c.TNonRight===2&&c.ZNonRight===1&&c.ZRight===1&&cap(after.board)&&quality(after.board,c))o.quality={at:h.locks,counts:clone(c),maxHeightDifference:3};
 if(tsd(e)&&!h.milestones.firstTsd){
  h.milestones.firstTsd={at:h.locks};
  const roof=o.cap?.roof||[],exactCap=roof.length===2&&cap(before.board)&&roof.every(([x,y])=>before.board[y]?.[x]==='Z'&&e.clearedRows.includes(y));
  if(h.fresh&&!o.violations.length&&o.quality&&o.quality.at<h.locks&&c.T===3&&c.TNonRight===2&&c.ZNonRight===1&&c.ZRight===1&&exactCap){
   h.extraZ.baseline={at:h.locks,qualityAt:o.quality.at,capAt:o.cap.at,counts:clone(c),source:SOURCE,scope:'Observed source Chapter 2 allocation and balanced flat-Center checkpoint; three-row height tolerance is an engineering interpretation.'};
  }
 }
 if(o.cap&&(e.clearedRows||[]).length)o.cap.roof=translate(o.cap.roof,e.clearedRows).filter(([,y])=>y>=0);
 if(!h.milestones.sourcePattern){const match=Patterns?.patterns?.find(p=>same(after.board,Array(40-p.rows.length).fill('..........').concat(p.rows)));if(match)h.milestones.sourcePattern={at:h.locks,id:match.id};}
 // First-TSD is a diagnostic boundary even when baseline eligibility is unknown.
 if(h.milestones.firstTsd&&h.locks>h.milestones.firstTsd.at){
  if(e.type==='Z'&&nonRight)h.extraZ.allocations.push({at:h.locks,pieceId:h.active,type:'Z',region,cells:clone(e.cells)});
  if(!canonical(e)||(region==='right'&&!'ZIT'.includes(e.type))||(region==='cross-right'&&!tsd(e))||(e.type==='T'&&!tsd(e))||(e.type==='Z'&&!nonRight&&!e.cells.every(([x])=>x>=8))||e.topOut)h.extraZ.departures.push({at:h.locks,reason:'Observed departure from the ordinary Midgame profile; no Reset inferred.'});
 }
}
function applyAction(history,before,action,after){
 if(!bound(history,before))return invalid(after,'Missing, forged, or stale local event history.');
 if(!['complete','partial'].includes(history.coverage.status))return invalid(after,history.coverage.reason,history.coverage.status);
 if(history.actions>=MAX_ACTIONS||history.locks>=MAX_LOCKS)return invalid(after,'Observed history limit reached; cumulative resources cannot be re-anchored from a board.','truncated');
 try{
  if(!['L','R','SD','HD','HOLD','CW','CCW','R180'].includes(action)||R.validate(after).length)return invalid(after,'Invalid action or resulting public state.');
  const initial=R.createState(before),expected=R.move(initial,action),ev=view(expected),av=view(after);
  if(!same({...ev,queue:[]},{...av,queue:[]})||!same(av.queue.slice(0,ev.queue.length),ev.queue)||av.queue.length>6)return invalid(after,'Action, draw, or resulting state does not replay.');
  if(action==='HD'&&(!expected.lastEvent||!same(expected.lastEvent,after.lastEvent??expected.lastEvent)))return invalid(after,'Lock event does not replay.');
  if(expected===initial)return same(view(before),av)?history:invalid(after,'A rejected input cannot change observations.');
  // Movement cannot alter accumulated allocations. Share frozen facts rather
  // than copying the entire run on every key repeat; lock updates remain private.
  const h=action==='HD'?clone(history):{...history,queue:history.queue.slice()};h.actions++;
  const draw=()=>{const id=h.queue.shift();if(id===undefined)throw Error('Missing observed draw identity');return id;};
  const lockedId=h.active;
  if(action==='HOLD'){
   if(h.hold!==null){const held=h.hold;h.hold=h.active;h.active=held;}else{h.hold=h.active;h.active=draw();}
  }else if(action==='HD'){
   const e=expected.lastEvent;h.locks++;
   const allocation={at:h.locks,pieceId:lockedId,type:e.type,region:whole(e),cells:clone(e.cells),lines:e.lines,spin:e.spin,clearedRows:e.clearedRows.slice()};
   h.allocations.push(allocation);h.pieces[lockedId].allocation=allocation;
   updateCenter(h,before,after,e,lockedId);observeOpening(h,before,after,e);
   h.active=expected.active?draw():null;
  }
  const added=av.queue.slice(ev.queue.length);if(added.length){if(action!=='HD')h.pieces={...h.pieces};h.queue.push(...added.map(type=>addPiece(h,type,h.fresh)));}
  if(h.active!==null&&h.pieces[h.active].type!==av.active?.type||h.hold!==null&&h.pieces[h.hold].type!==av.hold||!same(h.queue.map(id=>h.pieces[id].type),av.queue))return invalid(after,'Observed identity continuity failed.');
  // Known bag grouping comes only from actual observed draw order, never locks/7.
  if(h.fresh&&added.length){const bags=new Map();for(const p of Object.values(h.pieces)){const set=bags.get(p.bag)||new Set();if(set.has(p.type))return invalid(after,'Observed stream contradicts the known seven-bag origin.');set.add(p.type);bags.set(p.bag,set);}}
  h.observation=av;return seal(h);
 }catch{return invalid(after,'Could not replay the observed resource event.');}
}
function markHandoff(history,raw){if(!bound(history,raw)||!history.pieces)return invalid(raw,'Untrusted maintenance handoff history.');if(history.milestones.maintenanceHandoff)return history;const h=clone(history);h.milestones.maintenanceHandoff={at:h.locks};return seal(h);}
function hanging(h){
 if(!h.fresh||!h.opening.quality)return{status:'unknown',evidence:[],reason:'No fully observed balanced flat-Center checkpoint; observed identities and geometry remain separate facts.'};
 const since=h.extraZ.baseline?.qualityAt??h.opening.quality.at,bags=new Map(),evidence=[],unclassified=[];
 for(const p of Object.values(h.pieces)){if(!'SL'.includes(p.type))continue;const b=bags.get(p.bag)||{};b[p.type]=p;bags.set(p.bag,b);}
 for(const [bag,{S:s,L:l}] of bags){
  if(!l?.allocation||l.allocation.at<=since)continue;
  const disposed=s&&(s.allocation?.region==='left'||s.pair?.family==='SL');
  if(disposed)continue;
  const diverted=l.allocation.region==='left'||l.pair?.family==='LO'||l.pair?.family==='SL'&&l.pair.rootId!==s?.id;
  if(diverted&&s?.allocation&&!h.center.pending.some(p=>p.family==='SL'&&p.rootId===s.id)){unclassified.push({bag,sId:s.id,lId:l.id,reason:'The previously surplus S was placed in an unreviewed allocation; whether it was accommodated is unknown.'});continue;}
  if(diverted)evidence.push({bag,sId:s?.id??null,lId:l.id,at:l.allocation.at,reason:l.pair?.family==='SL'?'The L completed a different observed S.':'The L was allocated outside its observed S/L pair.'});
  else if(l.allocation.region!=='center'||l.pair?.family!=='SL')unclassified.push({bag,lId:l.id,reason:'The L allocation has no reviewed S/L role.'});
 }
 const lostProfile=h.opening.violations.length||h.extraZ.departures.length||h.extraZ.allocations.length>1||(!h.milestones.firstTsd&&(h.opening.counts.TNonRight>2||h.opening.counts.ZNonRight>1));
 return{status:lostProfile||evidence.length>1?'out-of-profile':evidence.length?'hanging':unclassified.length?'unknown':'none-observed',evidence,unclassified,since,reason:evidence.length?'Source-backed observed surplus; exact Center completion debt is a separate fact.':'No supported Hanging-S event in the reviewed interval; this is not proof of globally balanced arbitrary play.'};
}
function resolve(raw,history){
 if(!bound(history,raw))return{coverage:{status:'invalid',reason:'Missing, forged, or stale local event history.'},hangingS:{status:'unknown',evidence:[]},extraZ:{status:'unknown',baseline:null,allocations:[]}};
 if(!history.pieces)return{coverage:clone(history.coverage),actions:history.actions,locks:history.locks,hangingS:{status:'unknown',evidence:[]},extraZ:{status:'unknown',baseline:null,allocations:[]}};
 const h=history,instance=id=>id===null?null:clone(h.pieces[id]);
 const extraStatus=!h.extraZ.baseline?'unknown':h.extraZ.departures.length||h.extraZ.allocations.length>1?'out-of-profile':h.extraZ.allocations.length?'used':'available';
 return{schemaVersion:1,terminal:Boolean(h.observation.topOut),coverage:clone(h.coverage),actions:h.actions,locks:h.locks,instances:{active:instance(h.active),hold:instance(h.hold),queue:h.queue.map(instance)},flow:{ageKnown:h.fresh,oldestFirst:[h.active,h.hold,...h.queue].filter(id=>id!==null).map(instance).sort((a,b)=>(a.observedOrder??Infinity)-(b.observedOrder??Infinity))},center:clone(h.center),hangingS:hanging(h),extraZ:{status:extraStatus,...clone(h.extraZ),reason:!h.extraZ.baseline?'First TSD and source pattern are not sufficient: the source allocation/quality baseline must be verified.':'One optional Left/Center Z per observed Midgame interval; clears never replenish it and no Reset is inferred.'},milestones:clone(h.milestones),allocations:clone(h.allocations),pairs:clone(h.pairs),source:{url:SOURCE,sections:['2','3.2','7','8','9']},note:'Observed diagnostics only. No recommendation ranking or planner inputs are changed.'};
}
return Object.freeze({start,applyAction,markHandoff,resolve,limits:Object.freeze({actions:MAX_ACTIONS,locks:MAX_LOCKS})});
});
