'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),Current=require('../st-obligation-context'),CurrentProvider=require('../st-resource-provider'),M=require('../st-obligation-resources');
const clone=x=>JSON.parse(JSON.stringify(x));
function observed(initial,steps=[]){
 let state=R.createState(initial),history=Current.start(state,{fresh:true}),effects=[];
 function act(action,revealed=[]){const next=R.move(state,action);assert.notEqual(next,state);let after=next;for(const type of revealed)after={...after,queue:[...after.queue,type],...(after.bag?{bag:B.consume(after.bag,type)}:{})};const result=Current.applyActual(history,{before:state,action,after});history=result.context;effects.push(...result.effects);state=after;assert.equal(history.status,'available');}
 for(const s of steps)act(s.action,s.revealed);
 return{act,get effects(){return effects;},get state(){return state;},get history(){return history;},get summary(){return CurrentProvider.facts(CurrentProvider.prepare(state,{obligationContext:Current.exportState(history)}));},handoff(){history=Current.handoff(history,{position:state}).context;}};
}
function fresh(types){return observed({active:types[0],queue:types.slice(1),streamCursor:1});}
function prefix(n,locks){const f=require('./support/st-resource-trial-'+n+'.json'),steps=[];let count=0;for(const s of f.steps){if(count===locks)break;steps.push(s);if(s.action==='HD')count++;}return observed(f.initial,steps);}
const left=['L','L','L','HD'];
function play(a,witness,revealed=[]){const before=a.state,summary=a.summary,replay=R.replay(before,witness);assert.equal(replay.valid,true);assert.equal(replay.events.length,1);const projected=M.step(before,{witness,event:replay.events[0],state:replay.state},M.start(before,a.history,{extendForced:false}));for(const action of witness)a.act(action,action==='HD'?revealed:[]);return projected;}
const ids=(x,type)=>x['hanging'+type].evidence.map(e=>e[type.toLowerCase()+'Id']);
test('opener SL: fresh causal S and L surplus survive a handoff marker without quality or Extra-Z baseline',()=>{
 for(const [first,other]of[['L','S'],['S','L']]){
  const a=fresh([first,other,'I','J','O','T','Z']);play(a,left);
  assert.equal(a.history.state.account.z.remaining,null);assert.equal(a.summary.extraZ.status,'unknown');assert.deepEqual(ids(a.summary,other),[2]);
  a.handoff();assert.equal(a.history.state.sl.handoff,true);assert.deepEqual(ids(a.summary,other),[2]);assert.equal(a.summary.extraZ.status,'unknown');
  const context=clone(Current.exportState(a.history)),restored=CurrentProvider.facts(CurrentProvider.prepare(a.state,{obligationContext:Current.exportState(Current.importState(context,{position:a.state}))}));assert.deepEqual(restored,a.summary);
  const p=M.start(a.state,a.history,{extendForced:false});assert.deepEqual(p['hanging'+other].map(x=>x.id),[2]);
  assert.equal(CurrentProvider.facts(CurrentProvider.prepare(a.state,{obligationContext:Current.exportState(Current.start(a.state))}))['hanging'+other].status,'unknown','An identical import cannot inherit the replay');
  play(a,left);assert.deepEqual(ids(a.summary,'S'),[]);assert.deepEqual(ids(a.summary,'L'),[]);
 }
});
test('opener SL: consumed foundation and unrelated opener quality failures manufacture no surplus identities',()=>{
 const foundation=prefix(1,2);assert.equal(foundation.history.state.account.z.remaining,null);assert.deepEqual(ids(foundation.summary,'S'),[]);assert.deepEqual(ids(foundation.summary,'L'),[]);assert.equal(foundation.summary.hangingS.status,'none-observed','Earlier unsupported foundation S is not retroactive debt');
 const a=fresh(['T','Z','S','L','I','J','O']);play(a,['R','R','R','R','HD']);play(a,['HD']);assert.equal(a.history.state.account.z.remaining,null);assert.equal(a.history.state.account.profile.violation,true,'Bad T/Z geometry remains a current eligibility flag');assert.deepEqual(ids(a.summary,'S'),[]);assert.deepEqual(ids(a.summary,'L'),[]);assert.equal(a.summary.extraZ.status,'unknown');
});
test('opener SL: ordinary pending SL reserves L; known L surplus requires exact Left or LO accommodation',()=>{
 const ordinary=prefix(2,23);assert.ok(ordinary.summary.center.pending.some(p=>p.family==='SL'));assert.equal(ordinary.summary.hangingL.status,'none-observed');
 const a=prefix(2,14);let p=play(a,['HOLD',...left]);assert.deepEqual(ids(a.summary,'L'),[16]);assert.deepEqual(p.hangingL.map(x=>x.id),[16]);
 p=play(a,['HOLD','CW','HD']);assert.equal(a.summary.hangingL.evidence[0].pendingAccommodation,'LO');assert.deepEqual(p.hangingL.map(x=>x.id),[16]);assert.ok(a.summary.center.pending.some(p=>p.family==='LO'&&p.rootId===16));
 p=play(a,['HOLD','R','HD']);assert.deepEqual(ids(a.summary,'L'),[]);assert.deepEqual(p.hangingL,[]);assert.ok(a.effects.some(p=>p.domain==='center'&&p.status==='fulfilled'&&p.family==='LO'&&p.rootId===16&&p.partnerId===17));assert.deepEqual(ids(a.summary,'S'),[]);
});
test('opener SL: L-only evidence changes binding but does not enable a mirrored repair search or rejection',()=>{
 const a=fresh(['S','L','I','J','O','T','Z']);play(a,left);const resource=M.start(a.state,a.history,{extendForced:false});
 assert.deepEqual(resource.hangingS,[]);assert.equal(resource.pendingCenter.length,0);assert.equal(resource.hangingL.length,1);
 assert.equal(M.repair(a.state,resource,{maxNodes:0}).status,'no-new-resource-repair-needed');assert.throws(()=>M.binding({...resource,hangingL:[]}),/current projected resource/);
 const unknown=M.start(a.state,Current.start(a.state),{extendForced:false});assert.notEqual(M.rootBinding(resource),M.rootBinding(unknown));
 const p=play(a,['HD']);assert.deepEqual(p.violations,[],'L diagnosis is not a new placement guard');assert.equal(a.summary.hangingL.status,'unknown');assert.equal(p.unclassifiedL[0].lId,2);
});

test('opener SL: actual first-clear handoff carries cross-bag S debt despite no qualified checkpoint',()=>{
 const f=require('./support/st-opener-sl-unqualified.json'),a=observed(f.initial,f.steps.slice(0,-1)),before=a.state,last=f.steps.at(-1);assert.equal(last.action,'HD');
 a.act(last.action,last.revealed);const d=a.summary;
 assert.equal(a.history.state.account.z.remaining,null);assert.equal(d.extraZ.status,'unknown');assert.equal(a.history.boundary.sourcePatternSeen,true);assert.equal(a.history.state.account.firstTsd,true);assert.deepEqual(ids(d,'S'),[18]);assert.ok(a.effects.some(p=>p.domain==='center'&&p.status==='fulfilled'&&p.family==='SL'&&p.rootId===11&&p.partnerId===15),'Actual foreign-bag completion transfers S11 debt to S18');
 const O=require('../st-opening'),obligationContext=Current.exportState(a.history);
 const result=O.handoff(a.state,{before,event:a.state.lastEvent},{maxNodes:12000,deadline:Infinity,now:()=>0,obligationContext});
 assert.ok(result?.target,'Current handoff requires an actual clear and a fresh checked maintenance continuation');assert.equal(result.evidence.openingHandoff.status,'checked-after-actual-clear');
 // The projected endpoint may legitimately pay S18. Independently execute the
 // returned inputs into a separate ledger; a smaller debt list must be caused
 // by an actual identity-specific Left allocation or exact supported SL pair.
 let virtual=a.state,virtualHistory=a.history,virtualEffects=[],placed=[];
 for(const step of result.continuation){const checked=R.replay(virtual,step.witness);assert.equal(checked.valid,true);assert.equal(checked.events.length,1);assert.deepEqual(checked.events[0],step.event);
  for(const action of step.witness){const next=R.move(virtual,action);assert.notEqual(next,virtual);const update=Current.applyActual(virtualHistory,{before:virtual,action,after:next});virtualHistory=update.context;virtualEffects.push(...update.effects);if(update.receipt.locked)placed.push({piece:update.receipt.locked,event:next.lastEvent});virtual=next;assert.equal(virtualHistory.status,'available');}
 }
 const endpoint=CurrentProvider.facts(CurrentProvider.prepare(virtual,{obligationContext:Current.exportState(virtualHistory)}));
 assert.deepEqual(result.evidence.resourceObligations.hangingS.map(x=>x.id),ids(endpoint,'S'));
 for(const id of ids(d,'S').filter(id=>!ids(endpoint,'S').includes(id))){
  const leftPaid=placed.some(p=>p.piece.id===id&&p.piece.type==='S'&&p.event.cells.every(([x])=>x<4));
  const pairPaid=virtualEffects.some(p=>p.domain==='center'&&p.status==='fulfilled'&&p.family==='SL'&&p.rootId===id);
  assert.ok(leftPaid||pairPaid,'A removed S identity must actually be accommodated in the checked prefix');
  assert.equal(endpoint.hangingS.unclassifiedCount,d.hangingS.unclassifiedCount,'Unclassified disposal cannot hide in aggregate payment');
 }
 assert.deepEqual(a.summary,d,'Planning and hypothetical replay do not mutate the live observed ledger');assert.deepEqual(ids(a.summary,'S'),[18]);
 a.handoff();const restored=CurrentProvider.facts(CurrentProvider.prepare(a.state,{obligationContext:Current.exportState(Current.importState(clone(Current.exportState(a.history)),{position:a.state}))}));assert.equal(a.history.state.sl.handoff,true);assert.deepEqual(ids(restored,'S'),[18]);assert.equal(restored.extraZ.status,'unknown');
});

test('opener SL: invalidating a pending target cannot erase a previously established S obligation',()=>{
 const a=prefix(2,25);play(a,left);assert.deepEqual(ids(a.summary,'S'),[24]);
 play(a,['HD']);assert.equal(a.summary.hangingS.status,'unknown');assert.equal(a.summary.hangingS.unclassifiedCount,1);assert.ok(a.effects.some(p=>p.domain==='center'&&p.rootId===24&&p.status==='invalidated'));
});

test('opener SL: losing a proposed LO accommodation makes live and projected L diagnostics uncertain',()=>{
 const a=prefix(2,14);play(a,['HOLD',...left]);play(a,['HOLD','CW','HD']);
 const p=play(a,['HOLD','HD']);assert.equal(a.summary.hangingL.status,'unknown');assert.equal(a.summary.hangingL.unclassifiedCount,1);assert.deepEqual(p.hangingL,[]);assert.equal(p.unclassifiedL[0].lId,16);
});

test('opener SL: exact cross-bag SL completion transfers surplus L rather than erasing or duplicating it',()=>{
 const a=prefix(2,22),f=require('./support/st-resource-trial-2.json'),reveals=f.steps.filter(s=>s.action==='HD').slice(22).map(s=>s.revealed);
 // Deliberate literal Left fillers isolate identity accounting, not recommended
 // play. Retain L27 in HOLD, then use it for next-bag S30 while L35 is visible.
 const witnesses=[left,['L','L','L','CCW','L','HD'],left,['HOLD',...left],['R','R','R','R','CW','HD'],left,['R','HD'],['HOLD','R','R180','HD']];
 for(let i=0;i<witnesses.length;i++){const p=play(a,witnesses[i],reveals[i]);assert.deepEqual(p.hangingL.map(x=>x.id),ids(a.summary,'L'));if(i<7)assert.deepEqual(ids(a.summary,'L'),[27]);}
 assert.deepEqual(ids(a.summary,'L'),[35]);assert.deepEqual(ids(a.summary,'S'),[]);assert.ok(a.effects.some(p=>p.domain==='center'&&p.status==='fulfilled'&&p.family==='SL'&&p.rootId===30&&p.partnerId===27));assert.equal(a.summary.center.pending.length,0);
});

test('opener SL: unsupported midgame Center S is not mistaken for an early opener foundation',()=>{
 const a=prefix(1,18);play(a,['CW','HD']);play(a,left);assert.equal(a.summary.hangingS.status,'unknown');assert.equal(a.summary.hangingS.unclassifiedCount,1);assert.deepEqual(ids(a.summary,'S'),[]);
});
