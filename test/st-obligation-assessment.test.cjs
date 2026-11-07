'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../st-obligation-assessment'),SL=require('../st-sl-obligations'),C=require('../st-center-obligations'),R=require('../st-rules'),F=require('../st-fixtures'),M=require('../st-obligation-resources');
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const blank=()=>({board:Array(40).fill('..........')});
const piece=(type='I',id=100,bag=10)=>({type,id,bag});
const supply=(active=piece(),hold=null,queue=[])=>({active,hold,queue});
function view({s=[],l=[],hs=[],hl=[],sa=[0,0,0,0],la=[0],pending=[],extraZ={status:'unknown',remaining:null},reset={status:'inactive',progress:0}}={}){
 return{center:{pending:clone(pending),debt:[]},hangingS:{evidence:clone(hs),unclassified:clone(s),aggregate:sa.slice()},hangingL:{evidence:clone(hl),unclassified:clone(l),aggregate:la.slice()},extraZ,reset};
}
const event=(type='I')=>({type,cells:[[0,36],[0,37],[0,38],[0,39]],lines:0,clearedRows:[],spin:'none',topOut:false});
// Literal component boundaries isolate policy from gameplay reachability.
// Real Center transition witnesses appear separately below; no planner runs.
function step(state,beforeView,afterView,{effects=[],e=event(),locked=piece(e.type),before=blank(),after=blank(),beforeSupply=supply(locked),afterSupply=supply()}={}){
 return A.transition(state,{before:{position:before,supply:beforeSupply,view:beforeView},after:{position:after,supply:afterSupply,view:afterView},locked,event:e,effects});
}
const change=(kind,before,after)=>({domain:'sl',status:'classification-changed',kind,before,after});
const uncertain=p=>({category:'unclassified',...p});
const hanging=p=>({category:'hanging',...p});
const compact=(kind,p)=>({domain:'sl',status:'compacted',kind,subject:uncertain(p)});

test('assessment: anonymous root buckets remain inherited and disclose every severity without IDs',()=>{
 const v=view({sa:[2,3,4,5],la:[6]}),root=A.start(v,{supply:supply()}),r=A.resolve(root,{supply:supply()});
 assert.deepEqual(r.unclassifiedS,[]);assert.deepEqual(r.unclassifiedL,[]);assert.deepEqual(r.introducedUnclassified,[]);
 assert.equal(r.uncertainty.S.count,14);assert.equal(r.uncertainty.S.severeCount,12);assert.equal(r.uncertainty.L.count,6);assert.equal(r.hasSevereS,true);
 assert.deepEqual(root.root.references,[]);assert.deepEqual(A.originalOutstanding(root),[]);
 const carried=step(root,v,v);assert.equal(carried.step.resetLosesObligation,false);assert.deepEqual(A.resolve(carried.state).violations,[]);
});
test('assessment: generic uncertainty carries without severe-S or blanket Reset veto',()=>{
 const v=view({s:[{sId:8,lId:9,bag:1}],sa:[3,0,0,0],la:[2]}),root=A.start(v),out=step(root,v,v);
 assert.equal(A.resolve(out.state).hasUnclassified,true);assert.equal(A.resolve(out.state).hasSevereS,false);assert.equal(out.step.resetLosesObligation,false);
 assert.deepEqual(out.state.violations,[]);assert.equal(A.resolve(out.state).uncertainty.S.count,4);
});
test('assessment: fixed root distinguishes same-count replacement and removes resolved new uncertainty',()=>{
 const inherited={sId:8,lId:9,bag:1},fresh={sId:15,lId:16,bag:2},v=view({s:[inherited]}),replacement=view({s:[fresh]});
 const root=A.start(v),one=step(root,v,replacement,{effects:[change('S',uncertain(inherited),null),change('S',null,uncertain(fresh))]}).state;
 assert.deepEqual(A.resolve(one).introducedUnclassified,['S:15:16:2']);
 const two=step(one,replacement,view(),{effects:[change('S',uncertain(fresh),null)]}).state;
 assert.deepEqual(A.resolve(two).introducedUnclassified,[]);assert.deepEqual(two.current.uncertain.S,[]);
 assert.deepEqual(two.root.uncertaintyKeys,['S:8:9:1']);
});
test('assessment: inherited uncertainty becoming known then uncertain remains inherited',()=>{
 const p={sId:8,lId:9,bag:1},v=view({s:[p]}),known=view({hs:[p]}),root=A.start(v);
 const one=step(root,v,known,{effects:[change('S',uncertain(p),hanging(p))]}).state;
 const two=step(one,known,v,{effects:[change('S',hanging(p),uncertain(p))]});
 assert.deepEqual(A.resolve(two.state).introducedUnclassified,[]);assert.equal(two.step.resetLosesObligation,true,'Reset checks this step, not request-root novelty');
});
test('assessment: severity-only changes are not new keys but still affect finite S repair',()=>{
 const p={sId:8,lId:9,bag:1},severe={...p,invalidated:true},v=view({s:[p]}),after=view({s:[severe]}),root=A.start(v);
 const out=step(root,v,after,{effects:[change('S',uncertain(p),uncertain(severe))]});
 assert.deepEqual(A.resolve(out.state).introducedUnclassified,[]);assert.equal(A.resolve(out.state).hasSevereS,true);assert.equal(out.step.resetLosesObligation,false);
});
test('assessment: newly uncertain immediate compaction retains exact identity without double counting',()=>{
 const p={sId:36,lId:37,bag:5},before=view({hl:[p],la:[4]}),after=view({la:[5]}),root=A.start(before);
 const out=step(root,before,after,{effects:[change('L',hanging(p),uncertain(p)),compact('L',p)]}),r=A.resolve(out.state);
 assert.equal(out.step.resetLosesObligation,true);assert.deepEqual(r.introducedUnclassified,['L:36:37:5']);
 assert.equal(r.uncertainty.L.count,5);assert.deepEqual(r.uncertainty.L.aggregate,[4]);assert.equal(r.unclassifiedL.length,1);
 assert.deepEqual(r.originalOutstanding,['L:37']);assert.equal(out.state.current.uncertain.L[0].storage,'compacted');
 const again=step(out.state,after,after);assert.deepEqual(A.resolve(again.state).introducedUnclassified,['L:36:37:5']);assert.equal(again.step.resetLosesObligation,false);
 assert.throws(()=>step(root,before,after),/exact operation effects required/);
});
test('assessment: real S/L reducer effects retain L37 through immediate collection',()=>{
 const s=piece('S',36,5),l=piece('L',37,5),inventory=pieces=>({originKnown:true,active:pieces[0]??null,hold:null,queue:pieces.slice(1),frontier:{bag:6,seenMask:0}}),context=pieces=>({inventory:inventory(pieces),center:{pending:[],debt:[]}});
 const all=context([s,l]),next=context([l]),done=context([]);let state=SL.transition(SL.start({known:true}),{kind:'observe',closeFoundation:true,firstBagReview:'unreviewed'},{before:all,after:all}).state;
 state=SL.transition(state,{kind:'lock',piece:s,event:{...event('S'),cells:[[0,38],[1,38],[1,39],[2,39]]}},{before:all,after:next}).state;
 const before={...view(),...SL.resolve(state,next)},e={...event('L'),cells:[[3,38],[4,38],[4,39],[5,39]]};
 const result=SL.transition(state,{kind:'lock',piece:l,event:e},{before:next,after:done}),after={...view(),...SL.resolve(result.state,done)};
 assert.equal(result.state.residuals.length,0);assert.deepEqual(after.hangingL.aggregate,[1]);
 const out=step(A.start(before),before,after,{e,locked:l,effects:result.effects});assert.equal(out.step.resetLosesObligation,true);assert.deepEqual(A.resolve(out.state).originalOutstanding,['L:37']);
});
test('assessment: anonymous exemption removes current compacted tags but does not rewrite the fixed root',()=>{
 const p={sId:8,lId:9,bag:1},v=view({s:[p],sa:[1,0,0,0]}),after=view({sa:[2,0,0,0]}),root=A.start(v);
 const one=step(root,v,after,{effects:[compact('S',p)]}).state;
 const two=step(one,after,view(),{effects:[{domain:'sl',status:'opening-exempted',counts:{S:[2,0,0,0],L:[0]}}]}).state;
 assert.equal(A.resolve(two).uncertainty.S.count,0);assert.deepEqual(two.root.uncertaintyKeys,['S:8:9:1']);
 assert.throws(()=>step(two,view(),v,{effects:[]}),/exact operation effects required/,'Anonymous root buckets cannot resurrect without factual effects');
});
test('assessment: original duties survive uncertainty and do not transfer to unrelated named subjects',()=>{
 const rootS={sId:8,lId:9,bag:1},rootL={sId:15,lId:16,bag:2},v=view({hs:[rootS],hl:[rootL]}),root=A.start(v);
 const after=view({s:[rootS],l:[rootL]}),out=step(root,v,after,{effects:[change('S',hanging(rootS),uncertain(rootS)),change('L',hanging(rootL),uncertain(rootL))]}).state;
 assert.deepEqual(A.originalOutstanding(out),['L:16','S:8']);
 const replaced=view({s:[{sId:22,lId:23,bag:3}],l:[{sId:29,lId:30,bag:4}]}),other=step(out,after,replaced).state;
 assert.deepEqual(A.originalOutstanding(other),[]);assert.deepEqual(A.references(other,{supply:supply(null)}),[8,9,15,16]);
});
function example(){
 const before=R.createState({board:F.get('cap-rebuild').observation.board,active:'J',queue:['Z'],canHold:false});
 const j=R.replay(before,['CW','HD']),z=R.replay(j.state,['R','R','CW',...Array(7).fill('SD'),'L','HD']);assert.equal(j.valid,true);assert.equal(z.valid,true);
 const created=C.apply(C.start(before.board),before.board,j.state.board,j.events[0],{pieceId:1});return{before,j,z,created};
}
test('assessment: actual J/Z route creates and pays exact current target without retaining a closure',()=>{
 const {before,j,z,created}=example(),v=view({extraZ:{status:'available',remaining:1}}),after=view({pending:created.state.pending}),root=A.start(v);
 const one=step(root,v,after,{before,after:j.state,e:j.events[0],locked:piece('J',1,null)}).state;
 assert.equal(one.pendingCenter[0].rootId,1);assert.equal(one.pendingCenter[0].created,true);
 const two=step(one,after,view(),{before:j.state,after:z.state,e:z.events[0],locked:piece('Z',2,null)}).state;
 assert.deepEqual(two.pendingCenter,[]);assert.equal('closed' in two,false);assert.equal('effects' in two,false);
});
test('assessment: route loss is sticky but wholly cleared target retirement is not a loss',()=>{
 const {j,z,created}=example(),v=view({pending:created.state.pending}),root=A.start(v),board=j.state.board.slice();board[25]=board[25].slice(0,6)+'X'+board[25].slice(7);
 const lost=step(root,v,view(),{before:j.state,after:{board},effects:[{domain:'center',status:'invalidated',rootId:1}]}),r=A.resolve(lost.state);
 assert.equal(lost.step.newlyLostCenter,true);assert.equal(r.pendingCenter[0].lost,true);assert.equal(r.centerBlocked,true);assert.deepEqual(r.originalOutstanding,['center:1']);
 const attempted=step(lost.state,view(),view(),{before:j.state,after:z.state,e:z.events[0],locked:piece('Z',2)});assert.equal(attempted.state.pendingCenter[0].lost,true,'Exact-looking later payment cannot revive a lost stage');
 const e={...event(),lines:3,clearedRows:[25,26,27]},removed=step(root,v,view(),{before:j.state,after:blank(),e,effects:[{domain:'center',status:'invalidated',rootId:1}]});
 assert.deepEqual(removed.state.pendingCenter,[]);assert.equal(removed.step.newlyLostCenter,false);assert.equal(removed.step.resetLosesObligation,false);
});
test('assessment: invalidated exact S consequence keeps original Center duty outstanding after target retirement',()=>{
 const target={rootId:8,family:'SL',alternatives:[{piece:'L',cells:[[4,37],[4,38],[4,39],[5,39]]}]},p={sId:8,lId:9,bag:1,invalidated:true},v=view({pending:[target]}),root=A.start(v);
 const out=step(root,v,view({sa:[0,0,1,0]}),{e:{...event(),lines:3,clearedRows:[37,38,39]},effects:[change('S',null,uncertain(p)),compact('S',p)]}).state;
 assert.deepEqual(out.pendingCenter,[]);assert.deepEqual(A.originalOutstanding(out),['center:8']);assert.equal(A.resolve(out).uncertainty.S.count,1);
});
test('assessment: proposed L diversion stays request-local and SL/LO root bags use retained residuals',()=>{
 const target={rootId:8,family:'SL',alternatives:[{piece:'L',cells:[[4,37],[4,38],[4,39],[5,39]]}]},v=view({pending:[target]}),facts={sl:{residuals:[{bag:6,S:{id:8},L:null}]}},root=A.start(v,{state:facts});
 assert.equal(root.pendingCenter[0].bag,6);
 const out=step(root,v,view(),{e:event('L'),locked:piece('L',9,7)}).state;assert.equal(out.pendingLDiverted,true);
 assert.equal(A.start(view()).pendingLDiverted,false);assert.equal('pendingLDiverted' in facts,false);
});
test('assessment: fixed-root spending cannot cash a newly factual baseline',()=>{
 const v=view(),newBaseline=view({extraZ:{status:'available',remaining:1}}),root=A.start(v),one=step(root,v,newBaseline).state;
 assert.equal(A.resolve(one).extraZRemaining,null);assert.equal(A.resolve(one).extraZ,'unknown');
 const two=step(one,newBaseline,newBaseline,{e:event('Z'),locked:piece('Z')}).state;assert.deepEqual(two.violations,['extra-Z-not-available']);
 const available=view({extraZ:{status:'available'}}),first=step(A.start(available),available,available,{e:event('Z'),locked:piece('Z')}).state;
 assert.deepEqual(first.violations,[]);assert.equal(first.z.status,'used');assert.equal(first.z.remaining,null);
 assert.deepEqual(step(first,available,available,{e:event('Z'),locked:piece('Z',101)}).state.violations,['extra-Z-not-available']);
});
test('assessment: Reset credits unknown projected Ts once, keeps legacy Z label and completion progress 2',()=>{
 const v=view({extraZ:{status:'used',remaining:0},reset:{status:'active',progress:0}}),root=A.start(v);
 const first=step(root,v,v,{e:event('T'),locked:piece('T',-1,null),effects:[{domain:'account',status:'reset-T-credited',delta:1}]}).state;
 assert.equal(first.z.remaining,1);assert.equal(first.z.status,'used');assert.equal(first.reset.progress,1);
 const inactive=view({extraZ:{status:'available',remaining:2}}),out=step(first,v,inactive,{e:event('T'),locked:piece('T',-2,null),effects:[{domain:'account',status:'reset-T-credited',delta:1},{domain:'account',status:'reset-completed'}]});
 assert.equal(out.step.resetCompleted,true);assert.equal(out.state.z.remaining,2);assert.equal(out.state.reset.active,false);assert.equal(A.resolve(out.state).resetProgress,2);
 const again=step(out.state,inactive,inactive);assert.equal(again.step.resetCompleted,false);assert.equal(again.state.z.remaining,2);
 const spent=step(first,v,v,{e:event('Z'),locked:piece('Z',-3,null)}).state;assert.deepEqual(spent.violations,[]);assert.equal(spent.z.remaining,0);
});
test('assessment: T score identity, collision and partner ordering match existing route predicates',()=>{
 const blocked=supply(piece('I',1),piece('T',2),['J','O','O','T','L'].map((t,i)=>piece(t,i+3))),open={...blocked,queue:['J','O','O','L','T'].map((t,i)=>piece(t,i+3))};
 for(const s of [blocked,open])assert.equal(A.partnerAccessible(s,['L']),M.partnerAccessible(s,['L']));
 assert.equal(A.partnerAccessible(blocked,['L']),false);assert.equal(A.partnerAccessible(open,['L']),true);
 const v=view(),root=A.start(v),ordinary=step(root,v,v,{e:event('T'),locked:piece('T')});assert.deepEqual(ordinary.state.violations,['ordinary-T-must-score']);
 const e={...event('T'),cells:[[6,39],[7,38],[7,39],[8,39]],lines:2,clearedRows:[38,39],spin:'full'},scored=step(root,v,v,{e,locked:piece('T',11)}).state;
 assert.deepEqual(scored.violations,[]);assert.deepEqual(A.resolve(scored).scoredTs,[11]);assert.deepEqual(A.resolve(scored).schedule.tsds,[{at:1,pieceId:11}]);
 assert.equal(A.resolve(scored,{supply:supply(piece('T',12),piece('T',13))}).tCollision,true);
});
test('assessment: request references and score storage are bounded by explicit root/horizon dependencies',()=>{
 const v=view({s:[{sId:8,lId:9,bag:1}]}),root=A.start(v,{supply:supply(piece('I',20)),planReferences:[40],horizon:9});
 assert.deepEqual(A.references(root,{supply:supply(piece('I',20)),planReferences:[50]}),[8,9,20,40,50]);
 let current=root;for(let i=0;i<9;i++)current=step(current,v,v,{locked:piece('I',100+i)}).state;
 assert.deepEqual(A.references(current,{supply:supply(piece('I',109))}),[8,9,40,109]);assert.equal(current.schedule.locks,9);assert.deepEqual(current.schedule.tsds,[]);
 assert.throws(()=>step(current,v,v),/request horizon exhausted/);
 for(const forbidden of ['events','effects','receipts','allocations','observedSL','slHistory','closed','history'])assert.equal(forbidden in current,false);
});
test('assessment: root, siblings, supplied facts and returned views do not mutate each other',()=>{
 const p={sId:8,lId:9,bag:1},v=view({s:[p]}),root=A.start(v),input={v,root},saved=clone(input);freeze(input);
 const a=step(root,v,v).state,b=step(root,v,view()).state;assert.equal(A.resolve(a).uncertainty.S.count,1);assert.equal(A.resolve(b).uncertainty.S.count,0);assert.deepEqual(input,saved);
 const r=A.resolve(a);r.unclassifiedS[0].sId=700;r.uncertainty.S.aggregate[0]=500;r.initialUnclassified.push('bad');assert.deepEqual(input,saved);assert.equal(A.resolve(a).unclassifiedS[0].sId,8);
 assert.notEqual(A.binding(a),A.binding(b));assert.equal(A.binding(a),A.binding(clone(a)));
});
test('assessment: stale before facts cannot hide an immediate identity loss',()=>{
 const p={sId:36,lId:37,bag:5},before=view({hl:[p]}),after=view({l:[p]}),root=A.start(before);
 assert.throws(()=>step(root,view(),after,{effects:[change('L',hanging(p),uncertain(p))]}),/before L classification mismatch/);
 const aggregated=view({la:[2]}),a=A.start(aggregated);assert.throws(()=>step(a,view(),aggregated),/before L aggregate mismatch/);
});
test('assessment: semantic bindings ignore object property order while retaining current supply identity',()=>{
 const a=A.start(view({s:[{sId:8,lId:9,bag:1}]})),b=clone(a);
 b.current.uncertain.S[0].fact={bag:1,lId:9,sId:8};
 assert.equal(A.binding(a,{supply:supply({id:10,type:'S',bag:2})}),A.binding(b,{supply:supply({bag:2,type:'S',id:10})}));
 assert.notEqual(A.binding(a,{supply:supply(piece('S',10,2))}),A.binding(a,{supply:supply(piece('S',11,2))}));
 assert.throws(()=>A.start(view({s:[{sId:8,lId:9,bag:1}],sa:[Number.MAX_SAFE_INTEGER,0,0,0]})),/uncertainty total/);
});
