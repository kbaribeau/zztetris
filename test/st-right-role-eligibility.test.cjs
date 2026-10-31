'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../st-rules'),P=require('../st-planner'),S=require('../st-structure'),RH=require('../st-resource-history');
const {fixtures}=require('./support/st-fixtures.cjs'),f=require('./fixtures/right-role-entry-loss.json');
const clone=x=>JSON.parse(JSON.stringify(x)),right=e=>e.cells.some(([x])=>x>=7);
const allowed=e=>!right(e)||['Z','T','I'].includes(e.type);
const bounds={depth:3,width:8,maxNodes:45000,now:()=>0,deadline:Infinity};
function replay(state,witness){const r=R.replay(state,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);return r;}
function advice(state,witness){const r=replay(state,witness),event=r.events[0],step={event,target:event.target,witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length};return{target:step.target,witness,hold:step.hold,holdCount:step.holdCount,context:JSON.stringify([state.rules,state.board,state.hold,state.canHold,state.queue,state.bag??null,state.active?.type]),continuation:[step],evidence:{cycleDebt:0}};}
function assertPrefix(state,result){assert.ok(result.target,result.reason);for(const p of result.continuation){const r=replay(state,p.witness);assert.deepEqual(r.events[0],p.event);assert.ok(allowed(r.events[0]));assert.ok(S.canonicalClear(r.events[0]));state=r.state;}return state;}
function isolated({structure=S,substitute=null,candidate=null}={}){
 const filename=require.resolve('../st-planner'),module={exports:{}},seam='const result=planCore(raw,{...options,deadline,normalOpeningDecision,checkOpeningFallback,admitMaintenance,[rightCapAdmission]:admitRightCap,[supportedSLAdmission]:admitSupportedSL});';let source=fs.readFileSync(filename,'utf8');
 if(substitute){assert.equal(source.split(seam).length,2,'Final-boundary fault-injection seam must be reviewed if changed');source=source.replace(seam,substitute);}
 vm.runInNewContext(source,{module,require:id=>id==='./st-structure.js'?structure:require(path.resolve(path.dirname(filename),id)),Date,performance,__candidate:candidate},{filename});return module.exports;
}

test('Right roles: all actual S/J/L/O locks touching Right are ineligible, including crossings',()=>{
 for(const type of ['S','J','L','O']){
  const state=R.createState({active:type,canHold:false}),placements=R.placements(state,{allowHold:false}).placements;
  const pure=placements.filter(p=>p.event.cells.every(([x])=>x>=7)),cross=placements.filter(p=>right(p.event)&&p.event.cells.some(([x])=>x<7));assert.ok(pure.length);assert.ok(cross.length);
  for(const p of [...pure,...cross]){assert.equal(P.ordinaryRightEligible(p.event),false);assert.equal(R.replay(state,p.witness).valid,true,'manual rules are unchanged');}
  for(const p of placements.filter(p=>!right(p.event)))assert.equal(P.ordinaryRightEligible(p.event),true,'Left/Center eligibility is not this gate');
  const held=R.createState({active:'T',hold:type}),crossHeld=R.placements(held).placements.find(p=>p.holdCount===1&&p.event.type===type&&right(p.event)&&p.event.cells.some(([x])=>x<7));assert.ok(crossHeld);assert.equal(P.ordinaryRightEligible(replay(held,crossHeld.witness).events[0]),false,'actual HOLD crossing uses emitted type');
 }
});

test('Right roles: HOLD uses the emitted piece rather than the original active or claimed target',()=>{
 for(const state of [R.createState({active:'T',hold:'S'}),R.createState({active:'Z',hold:null,queue:['O']})]){
  const p=replay(state,['HOLD','R','R','R','R','HD']);assert.ok(['S','O'].includes(p.events[0].type));assert.equal(P.ordinaryRightEligible({...p.events[0],target:{type:'T',x:0},region:'left',repair:true}),false);
 }
 const heldZ=R.createState({board:fixtures.cap.before,active:'S',hold:'Z',queue:['T']});
 const cap=replay(heldZ,['HOLD','R','R','R','R','CW','HD']);assert.equal(cap.events[0].type,'Z');assert.equal(P.ordinaryRightEligible(cap.events[0]),true);
});

test('Right roles: canonical cross-Center TSD, Z cap, nonclearing Pocket I and Well quad remain eligible',()=>{
 const z=R.createState({board:fixtures.cap.before,active:'Z',hold:'T',queue:['I']});
 const cap=replay(z,['R','R','R','R','CW','HD']);assert.equal(P.ordinaryRightEligible(cap.events[0]),true);assert.equal(cap.events[0].lines,0);
 const tsd=replay(cap.state,['HOLD','R','R','R','CW',...Array(18).fill('SD'),'CW','HD']);assert.equal(tsd.events[0].type,'T');assert.equal(tsd.events[0].spin,'full');assert.equal(tsd.events[0].lines,2);assert.ok(tsd.events[0].cells.some(([x])=>x===6));assert.equal(P.ordinaryRightEligible(tsd.events[0]),true);
 const pocket=R.createState({board:fixtures.pocket.before,active:'I',queue:['I']}),prep=replay(pocket,['CW','R','R','R','R','HD']);assert.equal(prep.events[0].lines,0);assert.ok(prep.events[0].cells.every(([x])=>x===9));assert.equal(P.ordinaryRightEligible(prep.events[0]),true);
 const quad=replay(prep.state,['CW','R','R','HD']);assert.equal(quad.events[0].lines,4);assert.ok(quad.events[0].cells.every(([x])=>x===7));assert.equal(P.ordinaryRightEligible(quad.events[0]),true);
});

test('Right roles: imported S/J/L/O cells do not globally reject legitimate I preparation and cleanup',()=>{
 const colors=['S','J','L','O'];let index=0;const board=fixtures.pocket.before.map(row=>[...row].map((c,x)=>x>=7&&c!=='.'?colors[index++%colors.length]:c).join(''));
 assert.ok(colors.every(t=>board.some(row=>row.slice(7).includes(t))));
 const state=R.createState({board,active:'I',queue:['I'],hold:null}),result=P.plan(state,{...bounds,allowHold:false,depth:1});
 const after=assertPrefix(state,result);assert.equal(result.continuation[0].event.lines,0);assert.equal(result.continuation[0].structuralEvidence.allocation,'quad-preparation');
 const cleanup=P.plan(after,{...bounds,allowHold:false,depth:1});assertPrefix(after,cleanup);assert.equal(cleanup.continuation[0].event.lines,4);
});

test('Right roles: Z/T/I type eligibility does not waive existing clear and resource guards',()=>{
 const single=R.createState({board:[...Array(39).fill('..........'),'XXXXXX...X'],active:'T',queue:['I']}),w=['R','R','R','HD'],e=replay(single,w).events[0];assert.equal(e.lines,1);assert.equal(P.ordinaryRightEligible(e),true);assert.equal(S.canonicalClear(e),false);assert.equal(P.revalidate(single,advice(single,w),bounds),null);
 const scoring=R.createState({board:fixtures.cap.afterCap,active:'T',queue:['I']}),left=['L','L','L','HD'];assert.equal(P.ordinaryRightEligible(replay(scoring,left).events[0]),true);assert.equal(P.revalidate(scoring,advice(scoring,left),bounds),null,'Allowed type does not authorize spending a scoring T');
});

test('Right roles: authentic pre7 request rejects recorded entry-blocking S before ordinary structure work',()=>{
 const q=f.request,recorded=replay(q.observation,f.recordedAdvice.witness);assert.deepEqual(recorded.events,[f.recordedAdvice.continuation[0].event]);assert.equal(q.observation.queue[1],'T');
 assert.equal(RH.resolve(q.observation,RH.importContext(q.observation,q.options.resourceContext)).coverage.status,'partial');
 assert.equal(R.tDoubleAccess(q.observation.board).reachable,true);assert.equal(R.tDoubleAccess(recorded.state.board).reachable,false);
 let forbidden=0;const planner=isolated({structure:{...S,transition(before,p,...args){if(!allowed(p.event))forbidden++;return S.transition(before,p,...args);}}});
 const result=planner.decide(q.observation,{...q.options,previous:q.previous,commitment:q.commitment});assert.equal(forbidden,0,'Forbidden ordinary candidates must not consume structural proof work');
 assert.ok(result.metrics.nodes<=45000);if(result.target)assertPrefix(q.observation,result);else assert.ok(['no-supported-continuation-found','budget-exhausted'].includes(result.status));
});

test('Right roles: recorded advice cannot survive revalidation, movement, claimed repair or saved commitment',()=>{
 const q=f.request,a=clone(f.recordedAdvice),options={...q.options,...bounds};assert.equal(P.revalidate(q.observation,a,options),null);
 const moved=R.move(q.observation,a.witness[0]),history=RH.importContext(q.observation,q.options.resourceContext),movedOptions={...options,resourceContext:RH.exportContext(moved,RH.applyAction(history,q.observation,a.witness[0],moved))};assert.equal(P.advance(moved,a,a.witness[0],movedOptions),null);
 for(const kind of [undefined,'reset','cap-deferral','left-foundation','left-support']){
  const forged=clone(a);forged.evidence={...forged.evidence,resetSelection:{status:'selected'},construction:{kind,origin:q.observation,steps:a.continuation.map(p=>({witness:p.witness})),consumed:0}};
  assert.equal(P.revalidate(q.observation,forged,options),null);
 }
 const saved=clone(a);saved.continuation[0].structuralEvidence={allocation:'quad-preparation',repair:{verified:true}};
 const result=P.plan(q.observation,{...options,commitment:{observation:q.observation,advice:saved},ordinaryRightEligible:()=>true,resetSelection:{status:'selected'}});
 if(result.target)assertPrefix(q.observation,result);assert.notEqual(result.evidence?.commitmentRetained,true);
});

test('Right roles: final admission and certified fallback independently reject a forbidden supplied candidate',()=>{
 // Boundary fault injection only: bypass discovery with the authentic old S
 // recommendation. Actual replay, resources, final admission and private
 // fallback registration are unmodified; this is not a planner-quality claim.
 for(const fallback of [false,true]){
  const candidate=clone(f.recordedAdvice);candidate.metrics={nodes:0};candidate.evidence.construction={kind:'reset',consumed:0};
  const substitute=fallback?'const result=(()=>{admitMaintenance(__candidate);return{...__candidate,target:null,status:"budget-exhausted"};})();':'const result=__candidate;';
  const planner=isolated({substitute,candidate}),result=planner.plan(f.request.observation,{...f.request.options,...bounds});assert.equal(result.target,null);assert.equal(result.metrics.certifiedFallback,undefined);
  if(!fallback)assert.equal(result.evidence.resourceObligations.reason,'ordinary-right-requires-Z-T-I');
 }
});

test('Right roles: a forbidden later suffix cannot hide behind an eligible I preparation and actual quad goal',()=>{
 // Source-backed Pocket/Well geometry; synthetic visible inventory. Both
 // sequences legally prepare I, place a filler, then execute the same quad.
 // No historical resource entitlement or successful policy choice is assumed.
 function sequence(type){
  const state=R.createState({board:fixtures.pocket.before,active:'I',queue:[type,'I','Z']}),witnesses=[['CW','R','R','R','R','HD'],type==='S'?['CW','R','R','R','R','HD']:['L','L','L','HD'],['CW','R','R','HD']];
  let current=state;const steps=[];
  for(const witness of witnesses){const before=current,r=replay(current,witness);current=r.state;const event=r.events[0];steps.push({event,target:event.target,witness,hold:false,holdCount:0,structuralEvidence:S.transition(before,{state:current,event})});}
  const result={...advice(state,witnesses[0]),continuation:steps};assert.equal(steps[0].event.lines,0);assert.equal(steps[2].event.lines,4);assert.equal(P.resourceGoal(steps.slice(1)),true);return{state,result,first:replay(state,witnesses[0])};
 }
 const good=sequence('O');assert.ok(P.continueCommitment(good.state,good.first.state,good.result,good.first.events[0],bounds),'eligible Left filler + actual quad remains retainable');
 const bad=sequence('S');assert.equal(allowed(bad.result.continuation[0].event),true);assert.equal(allowed(bad.result.continuation[1].event),false);
 assert.equal(P.revalidate(bad.state,bad.result,bounds),null);
 const action=bad.result.witness[0],moved=R.move(bad.state,action);assert.equal(P.advance(moved,bad.result,action,bounds),null);
 assert.equal(P.continueCommitment(bad.state,bad.first.state,bad.result,bad.first.events[0],bounds),null);
 const retained=P.plan(bad.state,{...bounds,depth:1,maxNodes:0,commitment:{observation:bad.state,advice:bad.result}});assert.equal(retained.target,null,'truncated enumeration must not revive a forbidden saved suffix');
});
