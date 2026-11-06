'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const SL=require('../st-sl-obligations'),H=require('../st-resource-history'),R=require('../st-rules'),I=require('../st-public-inventory'),C=require('../st-center-obligations');
const copy=x=>JSON.parse(JSON.stringify(x)),emptyCenter=()=>({pending:[],debt:[]});
const cells={left:[[0,38],[1,38],[1,39],[2,39]],center:[[4,38],[5,38],[5,39],[6,39]],cross:[[3,38],[4,38],[4,39],[5,39]],right:[[7,38],[8,38],[8,39],[9,39]]};
const piece=(type,bag)=>({id:bag*7+(type==='S'?1:type==='L'?2:3),type,bag,observedOrder:bag*7});
const target=(family,p)=>({id:'piece-'+p.id,rootId:p.id,family,alternatives:[]});
const inventory=pieces=>({originKnown:true,active:pieces[0]??null,hold:pieces[1]??null,queue:pieces.slice(2),frontier:{bag:1000000,seenMask:0}});
const severity=p=>(p.requiresAccommodation?1:0)+(p.invalidated?2:0);
function canonicalCompact(summary){return Object.fromEntries(['S','L'].map(kind=>{
 const f=summary['hanging'+kind],counts=f.aggregate.slice();for(const p of f.unclassified)counts[kind==='S'?severity(p):0]++;
 return[kind,{status:f.status,evidence:f.evidence.slice().sort((a,b)=>a.bag-b.bag),uncertainty:counts}];
}));}
function canonicalLegacy(facts){
 const summary=H.classifySL(facts);return Object.fromEntries(['S','L'].map(kind=>{
  const f=summary['hanging'+kind],counts=kind==='S'?[0,0,0,0]:[0];
  for(const p of f.unclassified){const invalidated=kind==='S'&&p.sId!==undefined&&facts.center.closed.some(c=>c.family==='SL'&&c.rootId===p.sId&&c.status==='invalidated');counts[kind==='S'?severity({...p,invalidated}):0]++;}
  return[kind,{status:f.status,evidence:f.evidence.map(({at,reason,...p})=>p).sort((a,b)=>a.bag-b.bag),uncertainty:counts}];
 }));
}
// Independent old-classifier oracle is confined to tests. Component operations
// get only current public inventory, lock and Center results, never this tape.
function literal({bags=[1],foundationClosed=true,review='unreviewed'}={}){
 const all=bags.flatMap(b=>[piece('S',b),piece('L',b),piece('O',b)]);let supply=all.slice(),center=emptyCenter(),state=SL.start({known:true}),at=0,last;
 const facts={fresh:true,pieces:Object.fromEntries(all.map(p=>[p.id,{...p,allocation:null,pair:null}])),center:{...emptyCenter(),closed:[]},milestones:{},profileLost:false};
 const ctx=()=>({inventory:inventory(supply),center});
 function check(){assert.deepEqual(canonicalCompact(SL.resolve(state,ctx())),canonicalLegacy(facts));}
 function observe(operation={kind:'observe'}){if(operation.firstBagReview==='reviewed'){facts.milestones.sourcePattern={at:7,id:'literal'};at=Math.max(at,7);}const context=ctx();last=SL.transition(state,operation,{before:context,after:context});state=last.state;check();return last;}
 if(foundationClosed){facts.milestones.firstTsd={at:0};observe({kind:'observe',closeFoundation:true,firstBagReview:review});}
 return{
  lock(type,bag,where,{pending=[],effects=[],pairs=[],closeFoundation=false,firstBagReview}={}){
   const p=piece(type,bag);supply=[...supply.filter(v=>v.id===p.id),...supply.filter(v=>v.id!==p.id)];const before=ctx(),event={type,cells:copy(cells[where]),lines:0,spin:'none',clearedRows:[]};at++;
   const wasKnown=H.classifySL(facts).hangingS.evidence.some(s=>s.sId===p.id);
   const region=where==='cross'?'left-center':where;facts.pieces[p.id].allocation={at,pieceId:p.id,type,region,cells:copy(event.cells)};
   for(const pair of pairs){const value={...pair,at};for(const id of [pair.rootId,pair.partnerId])if(facts.pieces[id])facts.pieces[id].pair=value;}
   facts.center.closed.push(...effects.filter(e=>!['created','diverted'].includes(e.status)).map(e=>({...e,at})));
   center={pending:copy(pending),debt:[]};facts.center.pending=copy(pending);
   if(wasKnown&&region!=='left'&&facts.pieces[p.id].pair?.family!=='SL'&&!pending.some(t=>t.family==='SL'&&t.rootId===p.id))facts.pieces[p.id].allocation.requiresAccommodation=true;
   if(closeFoundation)facts.milestones.firstTsd={at};
   if(firstBagReview==='reviewed')facts.milestones.sourcePattern={at:7,id:'literal'};
   supply=supply.filter(v=>v.id!==p.id);
   last=SL.transition(state,{kind:'lock',piece:p,event,pairs,centerEffects:effects,closeFoundation,firstBagReview},{before,after:ctx()});state=last.state;check();return last;
  },
  handoff(){const before=ctx();facts.milestones.maintenanceHandoff??={at};last=SL.transition(state,{kind:'handoff'},{before,after:ctx()});state=last.state;check();return last;},
  observe,check,get state(){return state;},get facts(){return facts;},get context(){return ctx();},get last(){return last;}
 };
}

test('shared SL: all same-bag allocation orders and regions match current policy',()=>{
 for(const first of ['S','L'])for(const one of Object.keys(cells))for(const two of Object.keys(cells)){
  const x=literal();x.lock(first,1,one);x.lock(first==='S'?'L':'S',1,two);assert.equal(x.state.residuals.length,0);
 }
});
test('shared SL: latent consumed S becomes uncertainty when its later L is spent',()=>{
 const x=literal();x.lock('S',1,'center');assert.equal(x.state.residuals.length,1);assert.deepEqual(x.state.uncertainty.S,[0,0,0,0]);
 const result=x.lock('L',1,'cross');assert.equal(result.state.residuals.length,0);assert.deepEqual(result.state.uncertainty.S,[1,0,0,0]);
 assert.equal(result.effects.find(e=>e.introducedUnclassified).after.sId,piece('S',1).id);
 assert.equal(result.effects.find(e=>e.introducedUnclassified).knownToUnclassified,false);
});
test('shared SL: known-to-unclassified survives immediate aggregation and immutable branches',()=>{
 const x=literal();x.lock('L',1,'left');const saved=copy(x.state);const result=x.lock('S',1,'cross');
 assert.deepEqual(saved.residuals[0].S,null);assert.deepEqual(result.state.uncertainty.S,[0,1,0,0]);
 const effect=result.effects.find(e=>e.knownToUnclassified);assert.equal(effect.kind,'S');assert.equal(effect.after.sId,piece('S',1).id);
 const y=literal();y.lock('S',1,'left');const l=y.lock('L',1,'cross');assert.ok(l.effects.some(e=>e.kind==='L'&&e.knownToUnclassified));assert.deepEqual(l.state.uncertainty.L,[1]);
});
test('shared SL: foundation exemption depends on S allocation timing and owed target at L consumption',()=>{
 const a=literal({foundationClosed:false});a.lock('S',1,'center');a.lock('L',1,'left',{firstBagReview:'unreviewed'});assert.deepEqual(a.state.uncertainty.S,[0,0,0,0]);
 const b=literal({foundationClosed:false}),s=piece('S',1),t=target('SL',s);b.lock('S',1,'center',{pending:[t],closeFoundation:true});
 b.lock('L',1,'left',{pending:[t],firstBagReview:'unreviewed'});assert.equal(b.state.residuals.length,1);assert.equal(b.state.residuals[0].sOwedSinceL,true);
 // Remove the target with a separate actual component lock from another bag.
 const c=literal({bags:[1,2],foundationClosed:false});c.lock('S',1,'center',{pending:[t]});c.lock('L',1,'left',{pending:[t]});
 c.lock('S',2,'left',{effects:[{...t,status:'invalidated'}],firstBagReview:'unreviewed'});assert.deepEqual(c.state.uncertainty.S,[0,0,1,0]);
 const d=literal({bags:[1,2],foundationClosed:false});d.lock('S',1,'center',{pending:[t]});d.lock('S',2,'left',{effects:[{...t,status:'invalidated'}]});d.lock('L',1,'left',{firstBagReview:'unreviewed'});assert.deepEqual(d.state.uncertainty.S,[0,0,0,0],'Target lost BEFORE own L does not make foundation owed');
});
test('shared SL: foreign SL payment changes both bags and preserves L order asymmetry',()=>{
 for(const earlyOwnL of [false,true]){
  const x=literal({bags:[1,2]}),s=piece('S',1),foreign=piece('L',2),t=target('SL',s);
  x.lock('S',1,'center',{pending:[t]});if(earlyOwnL)x.lock('L',1,'cross',{pending:[t]});
  x.lock('L',2,'center',{pairs:[{family:'SL',rootId:s.id,partnerId:foreign.id}],effects:[{...t,status:'fulfilled',partnerId:foreign.id}]});
  const result=SL.resolve(x.state,x.context);assert.equal(result.hangingS.evidence[0].bag,2);assert.equal(result.hangingL.evidence.length,earlyOwnL?0:1);
 }
});
test('shared SL: pending LO is accommodation until actual O payment; invalidation is uncertain',()=>{
 for(const fulfilled of [false,true]){
  const x=literal({bags:[1,2]}),l=piece('L',1),t=target('LO',l);x.lock('S',1,'left');x.lock('L',1,'center',{pending:[t]});
  assert.equal(SL.resolve(x.state,x.context).hangingL.evidence[0].pendingAccommodation,'LO');
  // Center facts are injected literally here; actual geometric proof belongs
  // to Center's suite and the full public replay parity checks below.
  const p=piece('O',2);x.lock('O',2,'left',{pairs:fulfilled?[{family:'LO',rootId:l.id,partnerId:p.id}]:[],effects:[{...t,status:fulfilled?'fulfilled':'invalidated',partnerId:p.id}]});
  assert.equal(SL.resolve(x.state,x.context).hangingL.unclassifiedCount,fulfilled?0:1);
 }
});
test('shared SL: opening handoff rebases consumed pairs, preserves unused partners and is idempotent',()=>{
 for(const used of ['S','L'])for(const where of Object.keys(cells)){
  const x=literal();x.lock(used,1,where);x.handoff();assert.equal(SL.resolve(x.state,x.context)['hanging'+(used==='S'?'L':'S')].evidence.length,1);const saved=copy(x.state);x.handoff();assert.deepEqual(x.state,saved);
 }
 const x=literal();x.lock('L',1,'left');x.lock('S',1,'cross');assert.deepEqual(x.state.uncertainty.S,[0,1,0,0]);x.handoff();assert.deepEqual(x.state.uncertainty.S,[0,0,0,0]);
 const y=literal({bags:[1,2]});y.lock('S',1,'center',{pending:[target('SL',piece('S',1))]});y.lock('L',1,'cross',{pending:[target('SL',piece('S',1))]});y.handoff();assert.equal(y.state.residuals.length,1,'Exact pending root remains current even though S/L classification is exempt');
});
test('shared SL: current plan references delay compaction without copying plans or keeping a closed archive',()=>{
 const x=literal();x.lock('S',1,'left');const l=piece('L',1),before=x.context,after={inventory:inventory([]),center:emptyCenter()};
 const result=SL.transition(x.state,{kind:'lock',piece:l,event:{type:'L',cells:cells.cross}},{before,after,references:[l.id]});
 assert.equal(result.state.residuals.length,1);assert.deepEqual(result.state.uncertainty.L,[0]);
 const compacted=SL.transition(result.state,{kind:'observe'},{before:after,after});assert.equal(compacted.state.residuals.length,0);assert.deepEqual(compacted.state.uncertainty.L,[1]);
});
test('shared SL: missing observed counterpart is not fabricated as deferred',()=>{
 const p=piece('L',1),ctx={inventory:inventory([p]),center:emptyCenter()};
 assert.throws(()=>SL.transition(SL.start({known:true}),{kind:'lock',piece:p,event:{type:'L',cells:cells.left}},{before:ctx,after:{...ctx,inventory:inventory([])}}),/Missing consumed S/);
 assert.equal(SL.start().status,'unknown');const unknown=SL.start({known:false});assert.deepEqual(SL.transition(unknown,{kind:'observe'},{before:ctx,after:ctx}).state,unknown);
});
test('shared SL: exact first-bag review removes only its opening severity exception',()=>{
 const x=literal({bags:[0],foundationClosed:false});x.lock('L',0,'left');x.lock('S',0,'cross');
 assert.equal(x.state.residuals.length,1,'Wait for the first-bag review before merging a severity that can change');
 assert.equal(SL.resolve(x.state,x.context).hangingS.unclassified[0].requiresAccommodation,true);
 x.observe({kind:'observe',closeFoundation:true,firstBagReview:'reviewed'});
 assert.equal(x.state.residuals.length,0);assert.deepEqual(x.state.uncertainty.S,[1,0,0,0]);
 const y=literal({bags:[0],foundationClosed:false});y.observe({kind:'observe',closeFoundation:true,firstBagReview:'reviewed'});y.lock('L',0,'left');y.lock('S',0,'cross');assert.deepEqual(y.state.uncertainty.S,[0,1,0,0],'A late held first-bag S was not allocated within the reviewed first seven locks');
});
test('shared SL: deferred reveal and repeated HOLD keep the same current bag duty',()=>{
 const l=piece('L',2),s=piece('S',2),center=emptyCenter(),frontier={bag:2,seenMask:1<<'IJLOSTZ'.indexOf('L')};
 const before={inventory:{...inventory([l]),frontier},center},after={inventory:{...inventory([]),frontier},center};
 let state=SL.transition(SL.start({known:true}),{kind:'lock',piece:l,event:{type:'L',cells:cells.left}},{before,after}).state;
 assert.deepEqual(SL.resolve(state,after).hangingS.evidence,[{bag:2,sId:null,lId:l.id,deferred:true}]);
 const revealed={inventory:{...inventory([s]),frontier:{bag:2,seenMask:frontier.seenMask|1<<'IJLOSTZ'.indexOf('S')}},center};
 const result=SL.transition(state,{kind:'observe'},{before:after,after:revealed});state=result.state;
 assert.deepEqual(SL.resolve(state,revealed).hangingS.evidence,[{bag:2,sId:s.id,lId:l.id}]);
 const held={inventory:{...revealed.inventory,active:null,hold:s},center};
 for(let i=0;i<40;i++){state=SL.transition(state,{kind:'observe'},{before:revealed,after:held}).state;state=SL.transition(state,{kind:'observe'},{before:held,after:revealed}).state;}
 assert.equal(state.residuals.length,1);assert.deepEqual(state,result.state);
});
test('shared SL: long settled cycles and dead uncertainty use fixed categories with exact new effects',()=>{
 let state=SL.start({known:true}),center=emptyCenter();
 const context=pieces=>({inventory:inventory(pieces),center});
 state=SL.transition(state,{kind:'observe',closeFoundation:true,firstBagReview:'unreviewed'},{before:context([]),after:context([])}).state;
 const stable=copy(state);
 for(let b=1;b<=1000;b++){
  const s=piece('S',b),l=piece('L',b),one=context([s,l]),two=context([l]),three=context([]);
  const first=SL.transition(state,{kind:'lock',piece:s,event:{type:'S',cells:cells.left}},{before:one,after:two});
  const settled=SL.transition(first.state,{kind:'lock',piece:l,event:{type:'L',cells:cells.left}},{before:two,after:three});state=settled.state;
  assert.deepEqual(state,stable);
 }
 for(let b=1001;b<=2000;b++){
  const s=piece('S',b),l=piece('L',b),one=context([l,s]),two=context([s]),three=context([]);
  state=SL.transition(state,{kind:'lock',piece:l,event:{type:'L',cells:cells.left}},{before:one,after:two}).state;
  const result=SL.transition(state,{kind:'lock',piece:s,event:{type:'S',cells:cells.cross}},{before:two,after:three});state=result.state;
  assert.equal(state.residuals.length,0);assert.deepEqual(state.uncertainty.S,[0,b-1000,0,0]);
  assert.equal(result.effects.find(e=>e.knownToUnclassified).after.sId,s.id,'An existing aggregate does not hide a newly uncertain candidate identity');
 }
 assert.ok(JSON.stringify(state).length<250);assert.equal('pieces' in state,false);assert.equal('closed' in state,false);
});
function replayPublic(context,tail=[]){
 let raw=R.createState(context.origin),inv=I.start(raw,{fresh:context.fresh}),history=H.start(raw,{fresh:context.fresh,inventory:inv}),center=C.start(raw.board),state=SL.start({known:inv.originKnown}),locks=0,last;
 const current=()=>({inventory:inv,center});
 function check(label){
  const facts={fresh:history.fresh,pieces:history.pieces,center:history.center,milestones:history.milestones,profileLost:false};
  const compact=SL.resolve(state,current());assert.deepEqual(canonicalCompact(compact),canonicalLegacy(facts),label);
  const legacy=H.classifySL(facts),kept=new Set(state.residuals.map(b=>b.bag));
  for(const kind of ['S','L'])assert.deepEqual(compact['hanging'+kind].unclassified,legacy['hanging'+kind].unclassified.filter(p=>kept.has(p.bag)).map(({reason,...p})=>({...p,...(kind==='S'&&p.sId!==undefined&&facts.center.closed.some(c=>c.family==='SL'&&c.rootId===p.sId&&c.status==='invalidated')?{invalidated:true}:{})})),label+' exact retained '+kind);
  assert.deepEqual(canonicalCompact(SL.resolve(state,{...current(),profileLost:true})),canonicalLegacy({...facts,profileLost:true}),label+' profile loss');
 }
 function handoff(){const c=current();state=SL.transition(state,{kind:'handoff'},{before:c,after:c}).state;history=H.markHandoff(history,raw);check('handoff');}
 if(context.handoffAtAction===0)handoff();
 const steps=[...context.steps,...tail.map(action=>({action,revealed:[]}))];
 for(let i=0;i<steps.length;i++){
  const {action,revealed}=steps[i],prior=current(),before=raw,previousMilestones=history.milestones;
  const moved=R.move(raw,action);assert.notEqual(moved,raw);raw={...moved,queue:[...moved.queue,...revealed]};
  const operation=I.transition(inv,before,action,raw);assert.equal(operation.status,'available');inv=operation.next;
  history=H.applyAction(history,before,action,raw,{inventoryTransition:operation});assert.equal(history.coverage.status,'complete');
  if(action==='HD'){
   locks++;const result=C.apply(center,before.board,raw.board,raw.lastEvent,{pieceId:operation.locked.id,at:locks});center=result.state;
   const closeFoundation=Boolean(!previousMilestones.firstTsd&&history.milestones.firstTsd||!previousMilestones.sourcePattern&&history.milestones.sourcePattern);
   last=SL.transition(state,{kind:'lock',piece:operation.locked,event:raw.lastEvent,centerEffects:result.effects,pairs:result.pairs,closeFoundation,...(locks===7?{firstBagReview:history.milestones.sourcePattern?.at===7?'reviewed':'unreviewed'}:{})},{before:prior,after:current()});
  }else last=SL.transition(state,{kind:'observe'},{before:prior,after:current()});
  state=last.state;check('public action '+i+' '+action);
  if(context.handoffAtAction===i+1)handoff();
 }
 return{state,last,summary:SL.resolve(state,current()),history};
}
for(const f of require('./fixtures/resource-projection-history.json').cases)test('shared SL public parity: '+f.id,()=>{
 const result=replayPublic(f.resourceContext,f.witness),introduced=result.last.effects.filter(e=>e.introducedUnclassified);
 assert.ok(introduced.length);assert.ok(introduced.some(e=>e.after.sId===85||e.after.lId===37));
});
for(const f of require('./fixtures/deferred-sl-reveals.json').cases)test('shared SL public parity: deferred reveal seed '+f.seed,()=>{replayPublic(f.afterContext);});
test('shared SL public parity: actual opening handoff rebase',()=>{const f=require('./fixtures/opening-handoff-sl-h01.json');replayPublic(f.resourceContext);});
test('shared SL: a foreign SL partner may also become an LO root without erasing its own S consequence',()=>{
 const x=literal({bags:[1,2]}),s=piece('S',1),l=piece('L',2),o=piece('O',2),sl=target('SL',s),lo=target('LO',l);
 x.lock('S',1,'center',{pending:[sl]});
 x.lock('L',2,'center',{pending:[lo],pairs:[{family:'SL',rootId:s.id,partnerId:l.id}],effects:[{...sl,status:'fulfilled',partnerId:l.id},{...lo,status:'created'}]});
 const before=SL.resolve(x.state,x.context);assert.deepEqual(before.hangingS.evidence,[{bag:2,sId:piece('S',2).id,lId:l.id}]);
 x.lock('O',2,'center',{pairs:[{family:'LO',rootId:l.id,partnerId:o.id}],effects:[{...lo,status:'fulfilled',partnerId:o.id}]});
 assert.deepEqual(SL.resolve(x.state,x.context).hangingS.evidence,before.hangingS.evidence);
 x.lock('S',2,'cross');assert.deepEqual(x.state.uncertainty.S,[0,1,0,0]);
});
test('shared SL: deterministic typed-event permutations preserve coupled pair, loss and handoff consequences',()=>{
 // This checks reducer sufficiency against the legacy classifier over supplied
 // Center outcomes, not that these abstract boards/targets are reachable play.
 let seed=31021;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let scenario=0;scenario<80;scenario++){
  const x=literal({bags:[1,2,3]}),order=[1,2,3].flatMap(b=>['S','L','O'].map(type=>({type,bag:b})));let pending=[];
  for(let i=order.length-1;i>0;i--){const j=next()%(i+1);[order[i],order[j]]=[order[j],order[i]];}
  for(let i=0;i<order.length;i++){
   const p=order[i],id=piece(p.type,p.bag).id,where=Object.keys(cells)[next()%4],effects=[],pairs=[];
   const family=p.type==='L'?'SL':p.type==='O'?'LO':null,paid=where==='center'?pending.find(t=>t.family===family):null;
   if(paid){pairs.push({family:paid.family,rootId:paid.rootId,partnerId:id});effects.push({...paid,status:'fulfilled',partnerId:id});pending=pending.filter(t=>t!==paid);}
   if(pending.length&&next()%3===0){const lost=pending[next()%pending.length];effects.push({...lost,status:'invalidated'});pending=pending.filter(t=>t!==lost);}
   if(where==='center'&&'SL'.includes(p.type)){const t=target(p.type==='S'?'SL':'LO',piece(p.type,p.bag));pending.push(t);effects.push({...t,status:'created'});}
   x.lock(p.type,p.bag,where,{pending,effects,pairs});if(i===scenario%9)x.handoff();
  }
 }
});
test('shared SL: loss on the same lock as L diversion is owed and invalidated, never foundation-forgiven',()=>{
 const x=literal({foundationClosed:false}),s=piece('S',1),t=target('SL',s);x.lock('S',1,'center',{pending:[t]});
 x.lock('L',1,'left',{effects:[{...t,status:'diverted'},{...t,status:'invalidated'},{...t,status:'debt-invalidated'}],firstBagReview:'unreviewed'});
 assert.equal(x.state.residuals.length,0);assert.deepEqual(x.state.uncertainty.S,[0,0,1,0]);
});
function currentSnapshot(){
 const x=literal({bags:[1,2]}),sl=target('SL',piece('S',1)),lo=target('LO',piece('L',2));
 x.lock('S',1,'center',{pending:[sl]});x.lock('L',1,'cross',{pending:[sl]});x.lock('S',2,'left',{pending:[sl]});x.lock('L',2,'center',{pending:[sl,lo]});
 const state=copy(x.state);state.uncertainty={S:[3,4,5,6],L:[7]};return{state,context:x.context};
}
test('shared SL snapshots: trusted facts round-trip without an action tape or board proof',()=>{
 const {state,context}=currentSnapshot(),raw=copy(state);
 raw.residuals[0].S.invalidated=true;raw.residuals[0].S.requiresAccommodation=true;
 // These imported current facts remain authoritative even though an attached
 // empty board, absent tape and fabricated historical summary contradict them.
 raw.board=Array(40).fill('..........');raw.resourceContext={steps:[]};raw.center={pending:[],debt:[],closed:[]};raw.summary={hangingS:{status:'none-observed'}};
 const imported=SL.importState(raw);assert.equal(imported.residuals.length,2);assert.deepEqual(imported.uncertainty,state.uncertainty);
 assert.equal(imported.residuals[0].S.invalidated,true);assert.equal(imported.residuals[0].S.requiresAccommodation,true);
 const status=SL.resolve(imported,{...context,board:raw.board});assert.equal(status.hangingS.evidence[0].sId,piece('S',1).id);assert.equal(status.hangingL.evidence[0].lId,piece('L',2).id);
 assert.deepEqual(SL.importState(JSON.parse(JSON.stringify(SL.exportState(imported)))),imported);
 assert.deepEqual(SL.importState(SL.exportState(SL.start())),SL.start(),'The known-empty/unknown distinction survives transport');
});
test('shared SL snapshots: stale extra archives are ignored, not cloned, executed or retained',()=>{
 const {state}=currentSnapshot(),raw=copy(state);raw.residuals[0].allocations=['old'];raw.residuals[0].S.cells=cells.left;raw.residuals[1].L.pairArchive=['old'];
 raw.archives=raw;Object.defineProperty(raw,'pieces',{get(){throw Error('Historical pieces must not be read.');}});
 const imported=SL.importState(raw);assert.deepEqual(imported,state);assert.deepEqual(SL.exportState(raw),state);assert.doesNotThrow(()=>JSON.stringify(imported));
});
test('shared SL snapshots: imports and exports own independent mutable snapshots',()=>{
 const {state}=currentSnapshot(),saved=copy(state),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 freeze(state);const imported=SL.importState(state),exported=SL.exportState(state);assert.deepEqual(state,saved);
 imported.residuals[0].S.invalidated=true;imported.uncertainty.S[0]++;exported.residuals[0].L.id=99999;exported.uncertainty.L[0]++;
 assert.deepEqual(state,saved);assert.equal(exported.residuals[0].S.invalidated,false);assert.equal(imported.residuals[0].L.id,saved.residuals[0].L.id);
});
test('shared SL snapshots: malformed enums, counts and references fail without changing their input',()=>{
 const changes=[
  s=>{s.handoff=true;s.foundationOpen=true;},s=>s.schemaVersion=2,s=>s.status='partial',s=>s.foundationOpen=0,s=>s.handoff='yes',s=>s.firstBagReview='maybe',s=>s.residuals=null,
  s=>s.uncertainty=null,s=>s.uncertainty.S.pop(),s=>s.uncertainty.L.push(0),s=>delete s.uncertainty.S[0],s=>s.uncertainty.S[0]=-1,s=>s.uncertainty.S[0]=1.5,s=>s.uncertainty.S[0]=Number.MAX_SAFE_INTEGER+1,
  s=>s.residuals[0].bag=-1,s=>s.residuals[0].bag='1',s=>s.residuals.push(copy(s.residuals[0])),s=>s.residuals[1].L.id=s.residuals[0].S.id,
  s=>s.residuals[0].S.id=0,s=>s.residuals[0].S.id=Infinity,s=>s.residuals[0].S.region='elsewhere',s=>s.residuals[0].S.invalidated=1,s=>s.residuals[0].S.pair='LO',
  s=>s.residuals[0].L.nonRight=false,s=>s.residuals[0].order=null,s=>s.residuals[0].order='simultaneous',s=>s.residuals[0].lBeforeSPair=true,
  s=>s.residuals[0].S.pair='same',s=>s.residuals[0].L.pair='same',s=>{s.residuals[0].S=null;s.residuals[0].L=null;s.residuals[0].order=null;},
  s=>{s.residuals[0].L=null;s.residuals[0].order=null;},s=>s.status='unknown'
 ];
 for(const change of changes){const {state}=currentSnapshot();change(state);const saved=structuredClone(state);assert.throws(()=>SL.importState(state),/Invalid S\/L snapshot/);assert.deepEqual(state,saved);assert.throws(()=>SL.exportState(state),/Invalid S\/L snapshot/);}
 for(const raw of [null,[],{},NaN])assert.throws(()=>SL.importState(raw),/Invalid S\/L snapshot/);
});
test('shared SL snapshots: same-bag SL payment followed by LO is reference-consistent',()=>{
 const {state}=currentSnapshot(),b=state.residuals[0];b.S.pair='same';b.L.pair='LO';b.lBeforeSPair=false;
 assert.deepEqual(SL.importState(state),state,'The L pair tag may legitimately change after paying its own S');
 b.S.pair='foreign';b.L.pair='foreign';b.lBeforeSPair=true;assert.deepEqual(SL.importState(state),state,'A foreign counterpart need not remain as a historical identity reference');
});
test('shared SL snapshots: thousands of distinct current relationships and all category counts survive without a cap',()=>{
 const state=SL.start({known:true});state.foundationOpen=false;state.firstBagReview='unreviewed';
 state.residuals=Array.from({length:6000},(_,n)=>({bag:n,S:{id:n+1,region:'left',opening:true,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:false,invalidated:false},L:null,order:null,sOwedSinceL:false,lBeforeSPair:false}));
 state.uncertainty={S:[123,456,789,1011],L:[1213]};
 const imported=SL.importState(state);assert.equal(imported.residuals.length,6000);assert.deepEqual(imported,state);assert.deepEqual(SL.exportState(imported),state);
});
test('shared SL snapshots: unrepresentable count increments fail atomically instead of truncating',()=>{
 const x=literal();x.lock('L',1,'left');const raw=copy(x.state);raw.uncertainty.S[1]=Number.MAX_SAFE_INTEGER;const state=SL.importState(raw),saved=copy(state),s=piece('S',1);
 assert.throws(()=>SL.transition(state,{kind:'lock',piece:s,event:{type:'S',cells:cells.cross}},{before:x.context,after:{inventory:inventory([piece('O',1)]),center:emptyCenter()}}),/exact integer range/);
 assert.deepEqual(state,saved);assert.equal(SL.exportState(state).uncertainty.S[1],Number.MAX_SAFE_INTEGER);
});
test('shared SL snapshots: individually safe uncertainty buckets cannot report an unsafe combined total',()=>{
 const state=SL.start({known:true});state.uncertainty.S=[Number.MAX_SAFE_INTEGER,1,0,0];const saved=copy(state),context={inventory:inventory([]),center:emptyCenter()};
 assert.throws(()=>SL.importState(state),/Invalid S\/L snapshot.*total exceeds/);assert.throws(()=>SL.exportState(state),/Invalid S\/L snapshot.*total exceeds/);
 assert.throws(()=>SL.resolve(state,context),/uncertainty total exceeds/);assert.throws(()=>SL.transition(state,{kind:'observe'},{before:context,after:context}),/uncertainty total exceeds/);
 assert.deepEqual(state,saved);
});
test('shared SL snapshots: aggregate plus retained uncertainty stays exact or fails atomically',()=>{
 const x=literal();x.lock('L',1,'left');const raw=copy(x.state);raw.uncertainty.S=[Number.MAX_SAFE_INTEGER,0,0,0];
 const state=SL.importState(raw),saved=copy(state),s=piece('S',1),after={inventory:inventory([piece('O',1)]),center:emptyCenter()};
 // A plan reference would retain the new identity rather than compact it. The
 // total still must be checked before returning this otherwise-valid child.
 assert.throws(()=>SL.transition(state,{kind:'lock',piece:s,event:{type:'S',cells:cells.cross}},{before:x.context,after,references:[s.id]}),/uncertainty total exceeds/);assert.deepEqual(state,saved);
 const ordinary=SL.transition(x.state,{kind:'lock',piece:s,event:{type:'S',cells:cells.cross}},{before:x.context,after,references:[s.id]}).state;
 ordinary.uncertainty.S=[Number.MAX_SAFE_INTEGER-1,0,0,0];const near=SL.importState(ordinary);assert.equal(SL.resolve(near,after).hangingS.unclassifiedCount,Number.MAX_SAFE_INTEGER);
 ordinary.uncertainty.S[0]++;const imported=SL.importState(ordinary);
 assert.equal(imported.residuals.length,1,'Import retains the exact fact without attempting context-dependent classification');
 assert.throws(()=>SL.resolve(imported,after),/uncertainty total exceeds/);assert.throws(()=>SL.transition(imported,{kind:'observe'},{before:after,after,references:[s.id]}),/uncertainty total exceeds/);
 assert.deepEqual(imported,ordinary);
});
