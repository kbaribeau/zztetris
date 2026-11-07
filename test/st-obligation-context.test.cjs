'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../st-obligation-context'),Q=require('../st-obligation-state'),I=require('../st-public-inventory'),R=require('../st-rules'),H=require('../st-resource-history'),Patterns=require('../st-opening-patterns');
const copy=x=>JSON.parse(JSON.stringify(x));
const first=()=>R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1});
function player(origin=first(),fresh=true){
 let position=R.createState(origin),context=C.start(position,{fresh}),locks=0,last;
 return{act(action,revealed=[],supplied=false){const before=position,next=R.move(before,action),after={...next,queue:[...next.queue,...revealed]};const receipt=supplied?I.transition(context.inventory,before,action,after):undefined;last=C.applyActual(context,{before,action,after,...(receipt?{receipt}:{})});assert.equal(last.context.status,'available',last.context.reason);context=last.context;position=after;if(action==='HD'&&last.receipt.accepted)locks++;return last;},lock(witness){for(const a of witness)this.act(a);return last;},handoff(){last=C.handoff(context,{position});context=last.context;return last;},begin(candidate=true){last=C.beginReset(context,{position,candidate});context=last.context;return last;},install(raw){const restored=C.restore(raw);position=restored.position;context=restored.context;},get context(){return context;},get position(){return position;},get locks(){return locks;}};
}
function trial(n,until=Infinity){const f=require('./support/st-resource-trial-'+n+'.json'),x=player(f.initial);for(const s of f.steps){if(x.locks>=until)break;x.act(s.action,s.revealed);}return x;}
function sourcePrefix(){
 const pattern=Patterns.patterns[0],types='IJLOSTZ';let mask=0,path=[];
 // Existing source edges are legal witness data, not search/advice policy.
 function find(m){if(m===127)return true;for(const [from,type,witness]of pattern.edges){if(from!==m||m&(1<<types.indexOf(type)))continue;path.push({type,witness});if(find(m|(1<<types.indexOf(type))))return true;path.pop();}return false;}
 assert.ok(find(mask));return path;
}
function decoded(witness){return[...witness].map(a=>Patterns.actionCodes[a]);}

test('context: known and unknown starts remain distinct and immutable',()=>{
 const p=first(),known=C.start(p,{fresh:true}),unknown=C.start(p);
 assert.equal(known.state.availability,'known');assert.equal(unknown.state.availability,'unknown');
 assert.deepEqual(known.boundary,{firstBagLocks:0,sourcePatternSeen:false});assert.deepEqual(unknown.boundary,{firstBagLocks:null,sourcePatternSeen:false});
 assert.ok(Object.isFrozen(known)&&Object.isFrozen(known.state.account)&&Object.isFrozen(known.inventory.queue));
 assert.throws(()=>{known.state.sl.residuals.push({});},TypeError);
 assert.equal(C.resolve(unknown,{position:p}).availability,'unknown');
 assert.throws(()=>C.resolve(copy(known),{position:p}),/matching current/);
 assert.deepEqual(C.importState(C.exportState(known),{position:p}),known);
});
test('context: each accepted move, empty/repeated HOLD and HD consumes one genuine receipt',()=>{
 const x=player(),origin=C.snapshot(x.context,{position:x.position});
 for(const action of ['HOLD','HOLD','CW','CCW','R180','L','R','SD','HD']){
  const before=x.position,inventory=x.context.inventory,result=x.act(action,[],true);
  assert.ok(I.matchesTransition(result.receipt,inventory,before,action,x.position));assert.equal(result.context.inventory,result.receipt.next);
  assert.equal('receipt'in result.context,false);assert.equal('effects'in result.context,false);
 }
 assert.equal(x.context.inventory.hold.id,2);assert.equal(x.context.inventory.active.id,3);assert.equal(x.context.boundary.firstBagLocks,1);
 assert.equal(origin.context.inventory.active.id,1);assert.equal(origin.context.boundary.firstBagLocks,0);
 const restored=C.restore(copy(origin));assert.deepEqual(C.snapshot(restored.context,{position:restored.position}),origin);
});
test('context: rejected actions do not advance duties or lock-seven progress',()=>{
 const x=player();for(let n=0;n<5;n++)x.act('L');const before=x.context,result=x.act('L');assert.equal(result.receipt.accepted,false);assert.equal(result.context,before);assert.deepEqual(result.effects,[]);assert.equal(before.boundary.firstBagLocks,0);
});
test('context: copied and stale receipts cannot install an unrelated current inventory',()=>{
 const before=first(),root=C.start(before,{fresh:true}),after=R.move(before,'HD'),receipt=I.transition(root.inventory,before,'HD',after);
 assert.throws(()=>C.applyActual(root,{before,after,action:'HD',receipt:copy(receipt)}),/genuine/);
 const result=C.applyActual(root,{before,after,action:'HD',receipt});
 const next=R.move(after,'HD');assert.throws(()=>C.applyActual(result.context,{before:after,after:next,action:'HD',receipt}),/genuine/);
 assert.deepEqual(root,C.start(before,{fresh:true}));assert.equal(result.context.inventory,receipt.next);
});
test('context: caller-owned whole-turn snapshots restore exact poses, branches and current duties',()=>{
 const x=trial(1,10),checkpoint=C.snapshot(x.context,{position:x.position}),saved=copy(checkpoint);
 x.act('HOLD');x.act('L');x.act('HD');const branchA=copy(x.context);
 x.install(copy(checkpoint));assert.deepEqual(C.snapshot(x.context,{position:x.position}),saved);
 x.act('R');x.act('HD');assert.notDeepEqual(x.context.state,branchA.state);assert.deepEqual(checkpoint,saved);
 assert.equal('history'in x.context,false);assert.equal('position'in x.context.state,false);
 const bad=copy(checkpoint);bad.position.hold='T';assert.throws(()=>C.restore(bad),/snapshot public position/);
});
test('context: paired import trusts exact Center, safety and current duties without board replay',()=>{
 const p=first(),raw=C.exportState(C.start(p,{fresh:true}));raw.inventory.nextId=200;
 const target={id:'trusted-target',rootId:100,family:'OJ',alternatives:[{piece:'J',cells:[[4,30],[4,31],[5,31],[6,31]]}]};
 raw.state.center={pending:[target],debt:[{...copy(target),divertedPieceId:101}]};raw.state.safety.coveredCells=[[1,37]];raw.state.safety.notches={version:2,status:'established',anchorRow:35,blockedRows:[],source:'trusted-current'};raw.state.dPending=true;
 const imported=C.importState(raw,{position:p});assert.deepEqual(C.exportState(imported),raw);assert.equal(imported.boundary.firstBagLocks,0,'Allocator age must not infer elapsed locks');
 const status=C.resolve(imported,{position:p});assert.deepEqual(status.center,raw.state.center);assert.deepEqual(status.coveredRepair.cells,[[1,37]]);
 raw.state.center.pending[0].alternatives[0].cells[0][0]=6;assert.equal(imported.state.center.pending[0].alternatives[0].cells[0][0],4);
});
test('context: paired import rejects each consumed reference colliding with live IDs or allocator',()=>{
 const x=trial(1,24),base=C.exportState(x.context);base.inventory.nextId+=20;
 base.state.center={pending:[{id:'imported',rootId:base.inventory.nextId-2,family:'OJ',alternatives:[{piece:'J',cells:[[4,30],[4,31],[5,31],[6,31]]}]}],debt:[]};
 base.state.center.debt=[{...copy(base.state.center.pending[0]),divertedPieceId:base.inventory.nextId-1}];
 base.state.account.reset={status:'active',remaining:1,firstTId:base.inventory.nextId-3,inheritedCovered:[]};
 base.state.sl.residuals.push({bag:1000,S:{id:base.inventory.nextId-4,region:'left',opening:false,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:false,invalidated:false},L:null,order:null,sOwedSinceL:false,lBeforeSPair:false});
 assert.doesNotThrow(()=>C.importState(base,{position:x.position}));
 const setters=[(s,id)=>{s.state.center.pending[0].rootId=id;s.state.center.debt[0].rootId=id;},(s,id)=>s.state.center.debt[0].divertedPieceId=id,(s,id)=>s.state.account.reset.firstTId=id,(s,id)=>s.state.sl.residuals.at(-1).S.id=id];
 for(const set of setters)for(const id of [base.inventory.active.id,base.inventory.nextId,base.inventory.nextId+10]){const bad=copy(base);set(bad,id);assert.throws(()=>C.importState(bad),/consumed subject collides/);}
});
test('context: current import rejects structural damage atomically, not missing historical provenance',()=>{
 const x=trial(1,10),good=C.exportState(x.context),saved=copy(good);
 for(const edit of [s=>s.history=[],s=>s.boundary.firstBagLocks=8,s=>s.boundary.firstBagLocks=0,s=>s.inventory.queue[0].id=s.inventory.active.id,s=>s.reason='stale',s=>s.state.account.known=false]){const bad=copy(good);edit(bad);assert.throws(()=>C.importState(bad));assert.deepEqual(C.exportState(x.context),saved);}
});
test('context: source-pattern match at lock seven reviews exactly that first bag',()=>{
 const path=sourcePrefix(),x=player(R.createState({active:path[0].type,queue:path.slice(1).map(s=>s.type),streamCursor:1}));
 for(let n=0;n<path.length;n++){x.lock(decoded(path[n].witness));assert.equal(x.context.boundary.firstBagLocks,n+1);if(n<6)assert.equal(x.context.state.sl.firstBagReview,'pending');}
 assert.equal(x.context.boundary.sourcePatternSeen,true);assert.equal(x.context.state.sl.firstBagReview,'reviewed');assert.equal(x.context.state.sl.foundationOpen,false);
});
test('context: a later first source match closes foundation but never reviews lock seven retroactively',()=>{
 const path=sourcePrefix(),x=player(R.createState({active:path[0].type,queue:path.slice(1).map(s=>s.type),streamCursor:1}));
 for(const step of path.slice(0,6))x.lock(decoded(step.witness));
 const checkpoint=copy(C.snapshot(x.context,{position:x.position}));checkpoint.context.boundary.firstBagLocks=7;checkpoint.context.state.sl.firstBagReview='unreviewed';x.install(checkpoint);
 x.lock(decoded(path[6].witness));assert.equal(x.context.boundary.sourcePatternSeen,true);assert.equal(x.context.state.sl.firstBagReview,'unreviewed');assert.equal(x.context.state.sl.foundationOpen,false);
});
test('context: bounded source metadata matches legacy first-source facts across public replays',()=>{
 for(const n of [1,2,5]){
  const f=require('./support/st-resource-trial-'+n+'.json'),x=player(f.initial);let h=H.start(x.position,{fresh:true,inventory:x.context.inventory});
  for(const step of f.steps){const before=x.position,result=x.act(step.action,step.revealed,true);h=H.applyAction(h,before,step.action,x.position,{inventoryTransition:result.receipt});assert.equal(h.coverage.status,'complete');
   assert.equal(x.context.boundary.firstBagLocks,Math.min(h.locks,7));assert.equal(x.context.boundary.sourcePatternSeen,Boolean(h.milestones.sourcePattern));
   if(h.locks>=7)assert.equal(x.context.state.sl.firstBagReview,h.milestones.sourcePattern?.at===7?'reviewed':'unreviewed');
   assert.deepEqual(C.importState(C.exportState(x.context),{position:x.position}),x.context);
  }
 }
});
test('context: actual handoff is idempotent and preserves Center, safety and account facts',()=>{
 const x=trial(1,10),before=copy(x.context),once=x.handoff(),twice=x.handoff();assert.equal(once.context.state.sl.handoff,true);assert.deepEqual(twice.effects,[]);assert.deepEqual(twice.context,once.context);
 for(const field of ['center','safety','account','dPending'])assert.deepEqual(x.context.state[field],before.state[field]);assert.deepEqual(x.context.inventory,before.inventory);
});
test('context: BeginReset, actual qualifying Ts, completion and caller restore have real lifecycle effects',()=>{
 const x=trial(1,24),before=C.snapshot(x.context,{position:x.position});assert.equal(x.context.state.account.z.remaining,0);
 assert.equal(x.begin(false).effects[0].status,'reset-rejected');const begun=x.begin();assert.equal(begun.context.state.account.reset.remaining,2);assert.equal(begun.effects[0].status,'reset-started');assert.deepEqual(x.begin().effects,[]);
 x.lock(['L','L','L','HD']);assert.equal(x.context.state.account.reset.remaining,1);assert.equal(x.context.state.account.z.remaining,1);
 for(let n=0;n<4;n++)x.lock(['HD']);const done=x.lock(['L','L','L','HD']);assert.deepEqual(x.context.state.account.reset,{status:'inactive'});assert.equal(done.effects.filter(e=>e.status==='reset-completed').length,1);assert.equal(done.effects.filter(e=>e.status==='reset-T-credited').length,1);
 x.install(copy(before));assert.deepEqual(C.snapshot(x.context,{position:x.position}),before);assert.equal(x.context.state.account.z.remaining,0);
});
test('context: accounting failure keeps the real move and advanced inventory, remains unavailable without re-anchoring',()=>{
 const source=fs.readFileSync(require.resolve('../st-obligation-context'),'utf8'),sandbox={module:{exports:{}},require:name=>name==='./st-obligation-state'?{...Q,applyActual(){throw Error('Injected accounting fault');}}:require('../'+name.replace('./',''))};vm.runInNewContext(source,sandbox);const Fault=sandbox.module.exports;
 const before=first(),root=Fault.start(before,{fresh:true}),after={...R.move(before,'HD'),queue:[...'LOSTZI']},receipt=I.transition(root.inventory,before,'HD',after),saved=copy(after);
 const result=Fault.applyActual(root,{before,action:'HD',after,receipt});assert.equal(result.context.status,'unavailable');assert.equal(result.context.inventory,receipt.next);assert.equal(result.context.inventory.nextId,9);assert.equal(result.context.state,null);assert.deepEqual(after,saved);assert.equal(result.effects[0].status,'unavailable');assert.equal(Fault.resolve(result.context,{position:after}).availability,'unavailable');
 const next={...R.move(after,'HD'),queue:[...'OSTZIJ']},continued=Fault.applyActual(result.context,{before:after,action:'HD',after:next});assert.equal(continued.context.status,'unavailable');assert.equal(continued.context.inventory.nextId,10);assert.equal(continued.context.state,null);assert.equal(continued.context.boundary.firstBagLocks,2);
 assert.equal(Fault.importState(Fault.exportState(continued.context),{position:next}).status,'unavailable');assert.throws(()=>Fault.handoff(continued.context,{position:next}),/accounting is unavailable/);
 assert.equal(Fault.restore(Fault.snapshot(root,{position:before})).context.status,'available');
});
test('context: long actual movement and 700-lock cycles retain only current work, with no old H cap',()=>{
 const x=player(R.createState({active:'O',queue:Array(6).fill('O'),streamCursor:1}),false);const empty=copy(x.context.state);let firstCycle;
 for(let n=0;n<4200;n++)x.act(n%2?'R':'L');
 assert.equal(x.context.boundary.firstBagLocks,null);assert.deepEqual(x.context.state,empty);
 for(let cycle=0;cycle<140;cycle++){
  for(const shift of [-4,-2,0,2,4]){for(let n=0;n<Math.abs(shift);n++)x.act(shift<0?'L':'R');x.act('HD',['O']);}
  assert.ok(x.position.board.every(r=>r==='..........'));if(cycle===1)firstCycle=copy(x.context.state);else if(cycle>1)assert.deepEqual(x.context.state,firstCycle);
 }
 assert.equal(x.locks,700);assert.equal(x.context.status,'available');assert.equal(x.context.inventory.nextId,708);assert.equal(x.context.state.availability,'unknown');assert.equal(x.context.inventory.active.bag,null);assert.equal(x.context.boundary.firstBagLocks,null);
 assert.equal('history'in x.context,false);assert.equal('receipts'in x.context,false);assert.equal('allocations'in x.context,false);
});

test('context: real S/L integer exhaustion is unavailable accounting, never a rollback or fresh origin',()=>{
 const x=player(R.createState({active:'L',queue:[...'SIJOTZ'],streamCursor:1}));x.lock(['L','L','L','HD']);
 const raw=copy(C.snapshot(x.context,{position:x.position}));raw.context.state.sl.uncertainty.S[0]=Number.MAX_SAFE_INTEGER;x.install(raw);
 for(let n=0;n<3;n++)x.act('R');
 const before=x.position,prior=x.context,moved=R.move(before,'HD'),after={...moved,queue:[...moved.queue,'I']},receipt=I.transition(prior.inventory,before,'HD',after);
 const result=C.applyActual(prior,{before,action:'HD',after,receipt});assert.equal(result.context.status,'unavailable');assert.match(result.context.reason,/exact integer range/);assert.equal(result.context.inventory,receipt.next);assert.equal(result.context.inventory.nextId,9);assert.equal(result.context.state,null);assert.notDeepEqual(after.board,before.board);
 assert.equal(prior.state.sl.uncertainty.S[0],Number.MAX_SAFE_INTEGER);assert.equal(result.context.boundary.firstBagLocks,2);
});
test('context: an already-seen source cannot turn a later lock-seven match into a reviewed first bag',()=>{
 const path=sourcePrefix(),x=player(R.createState({active:path[0].type,queue:path.slice(1).map(s=>s.type),streamCursor:1}));
 for(const step of path.slice(0,6))x.lock(decoded(step.witness));
 const checkpoint=copy(C.snapshot(x.context,{position:x.position}));checkpoint.context.boundary.sourcePatternSeen=true;checkpoint.context.state.sl.foundationOpen=false;x.install(checkpoint);
 x.lock(decoded(path[6].witness));assert.equal(x.context.boundary.firstBagLocks,7);assert.equal(x.context.state.sl.firstBagReview,'unreviewed');
});
test('context: UMD loading uses the same seam without production controller wiring',()=>{
 const realm=vm.createContext({});
 for(const name of ['st-rules','st-bag','st-structure','st-access','st-pattern-history','st-reset-policy','st-opening-patterns','st-public-inventory','st-center-obligations','st-sl-obligations','st-opening-obligations','st-obligation-state','st-obligation-context'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),realm,{filename:name+'.js'});
 const position=first(),current=realm.STObligationContext.start(position,{fresh:true}),after=R.move(position,'HD');const result=realm.STObligationContext.applyActual(current,{before:position,action:'HD',after});
 const node=C.applyActual(C.start(position,{fresh:true}),{before:position,action:'HD',after});assert.deepEqual(copy(result.context),copy(node.context));assert.deepEqual(copy(result.effects),copy(node.effects));
});

test('context: two sequential caller snapshots restore across handoff, Reset and partial next-turn input',()=>{
 const x=trial(1,24),firstCheckpoint=C.snapshot(x.context,{position:x.position});
 assert.equal(firstCheckpoint.context.state.sl.handoff,false);assert.equal(firstCheckpoint.context.state.account.reset.status,'inactive');
 x.handoff();x.begin();x.lock(['L','L','L','HD']);
 // This checkpoint was chosen AFTER the markers and first Reset T. Restoring
 // it must retain those facts, not impose a different whole-turn policy.
 const secondCheckpoint=C.snapshot(x.context,{position:x.position});
 assert.equal(secondCheckpoint.context.state.sl.handoff,true);assert.equal(secondCheckpoint.context.state.account.reset.remaining,1);
 x.act('HOLD');x.act('L');x.act('HD');x.act('HOLD');x.act('R');
 assert.notDeepEqual(x.position,secondCheckpoint.position);assert.notDeepEqual(x.context.inventory,secondCheckpoint.context.inventory);
 x.install(copy(secondCheckpoint));
 assert.deepEqual(x.position,secondCheckpoint.position);assert.deepEqual(x.context.inventory,secondCheckpoint.context.inventory);assert.deepEqual(x.context.state,secondCheckpoint.context.state);assert.deepEqual(C.snapshot(x.context,{position:x.position}),secondCheckpoint);
 assert.equal(x.context.state.sl.handoff,true);assert.equal(x.context.state.account.reset.remaining,1);assert.equal(x.context.state.account.reset.firstTId,secondCheckpoint.context.state.account.reset.firstTId);
 // The older checkpoint predates both markers. A second restore must remove
 // the later handoff/Reset facts and both later locks, including partial input.
 x.install(copy(firstCheckpoint));
 assert.deepEqual(x.position,firstCheckpoint.position);assert.deepEqual(x.context.inventory,firstCheckpoint.context.inventory);assert.deepEqual(x.context.state,firstCheckpoint.context.state);assert.deepEqual(C.snapshot(x.context,{position:x.position}),firstCheckpoint);
 assert.equal(x.context.state.sl.handoff,false);assert.equal(x.context.state.account.reset.status,'inactive');assert.equal(x.context.state.account.z.remaining,0);
});

test('context: consumed role types reject contradictions while preserving shared and anonymous facets',()=>{
 const x=trial(1,24),raw=C.exportState(x.context);raw.inventory.nextId=200;
 raw.state.sl.residuals=[
  {bag:1000,S:{id:100,region:'left',opening:false,pair:null,foundationEligible:false,firstBagEligible:false,requiresAccommodation:false,invalidated:false},L:null,order:null,sOwedSinceL:false,lBeforeSPair:false},
  {bag:1001,S:null,L:{id:101,region:'left',opening:false,pair:null,nonRight:true},order:null,sOwedSinceL:false,lBeforeSPair:false}
 ];
 const target=(id,rootId,family,piece)=>({id,rootId,family,alternatives:[{piece,cells:[[4,30],[4,31],[5,31],[6,31]]}]});
 raw.state.center.pending=[target('s',100,'SL','L'),target('l',101,'LO','O'),target('o',102,'OJ','J'),target('j',103,'ZJ','Z'),target('z',104,'ZJ','J'),target('origin',null,null,'J')];
 raw.state.center.debt=raw.state.center.pending.map((p,i)=>({...copy(p),divertedPieceId:[101,102,103,104,105,101][i]}));
 raw.state.account.reset={status:'active',remaining:1,firstTId:110,inheritedCovered:[]};
 // L101 can be an SL diversion, a LO root and an anonymous origin diversion
 // simultaneously. The anonymous target now offers J only, but cannot prove
 // what type was offered when its diversion happened. Import must not replay
 // or recover discarded alternatives to authenticate that consumed subject.
 const imported=C.importState(raw,{position:x.position});assert.deepEqual(C.exportState(imported),raw);
 assert.equal(imported.state.center.debt.at(-1).divertedPieceId,101);
 const edits=[
  s=>s.state.account.reset.firstTId=100,
  s=>s.state.account.reset.firstTId=101,
  s=>s.state.center.pending.push(target('conflicting-O',100,'OJ','J')),
  s=>s.state.center.debt[0].divertedPieceId=100,
  s=>s.state.center.debt[1].divertedPieceId=101,
  s=>s.state.center.debt[2].divertedPieceId=102,
  s=>s.state.center.pending.push(target('conflicting-ZJ',100,'ZJ','J')),
  s=>s.state.center.debt[3].divertedPieceId=100
 ];
 for(const edit of edits){const bad=copy(raw);edit(bad);assert.throws(()=>C.importState(bad),/contradictory current type roles/);assert.deepEqual(C.exportState(imported),raw);}
});
