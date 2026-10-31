'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),S=require('../st-structure'),H=require('../st-resource-history'),M=require('../st-midgame-resources'),A=require('../st-access'),P=require('../st-planner'),Session=require('../st-session'),f=require('./fixtures/pending-L-clear-completion.json'),clone=x=>JSON.parse(JSON.stringify(x));
const key=c=>JSON.stringify(c.slice().sort(([x,y],[u,v])=>x-u||y-v));
function replay(){const start=Session.prepare(f.session);let state=start.state,history=start.resourceHistory,resource=M.start(state,H.resolve(state,history));const snapshots=[];
 for(const witness of f.witnesses){const before=state,r=R.replay(state,witness);assert.ok(r.valid);assert.equal(r.events.length,1);const p={witness,event:r.events[0],state:r.state};resource=M.step(before,p,resource);
  for(const action of witness){const old=state;state=R.move(state,action);history=H.applyAction(history,old,action,state);}
  snapshots.push({state,history,resource,p,summary:H.resolve(state,history)});
 }return{start,snapshots};}
test('pending L clear / exact authentic R2 route retains translated target and actually pays L78',()=>{
 const {start,snapshots:s}=replay();assert.equal(f.session.coaching.resourceContext.steps.length,495);assert.equal(s[0].summary.coverage.status,'partial');
 const target=[[4,32],[5,32],[6,32],[4,33]],shifted=[[4,34],[5,34],[6,34],[4,35]],root=s[0].summary.center.pending[0].rootId;assert.ok(root>0);
 for(let i=0;i<6;i++){const expected=i<2?target:shifted;assert.equal(s[i].summary.center.pending.length,1,'Exact pending L must survive lock '+(72+i));assert.equal(s[i].summary.center.pending[0].rootId,root);assert.equal(key(s[i].summary.center.pending[0].alternatives[0].cells),key(expected));assert.equal(s[i].resource.pendingCenter[0].lost??false,false);assert.deepEqual(s[i].summary.coveredRepair.cells,[]);}
 assert.equal(s[2].p.event.lines,2);const c=S.geometry(s[2].state.board).center.completions.find(c=>key(c.cells)===key(shifted));assert.ok(c);assert.equal(c.patternSupport,'unrecognized','Do not silently expand the global motif catalogue');
 assert.equal(s[5].resource.pendingLDiverted,true,'Spending the first L Left still forbids the missing-partner waiting exception');assert.equal(M.pendingLStageEligible(s[5].state,s[5].resource),false);
 assert.equal(key(s[6].p.event.cells),key(shifted));assert.equal(s[6].p.event.type,'L');assert.deepEqual(s[6].summary.center.pending,[]);assert.deepEqual(s[6].summary.center.debt,[]);assert.deepEqual(s[6].resource.pendingCenter,[]);
 const steps=s.map(n=>n.p);assert.equal(M.checkPath(start.state,steps,H.resolve(start.state,start.resourceHistory)).valid,true);assert.equal(A.repairPrefix(start.state,steps).valid,true);assert.deepEqual(S.geometry(s[6].state.board).center.profile,[6,6,6]);
});
test('pending L clear / postclear fresh history import retains original identity, unknown silhouette does not',()=>{
 const n=replay().snapshots[2],pending=n.summary.center.pending;const transported=H.exportContext(n.state,n.history),restored=H.importContext(n.state,clone(transported));assert.deepEqual(H.resolve(n.state,restored).center.pending,pending);
 const fresh=H.resolve(n.state,H.start(n.state));assert.equal(fresh.center.pending.some(p=>p.family==='SL'&&p.rootId>0),false);
 const forged=clone(transported);forged.steps[0].action='TELEPORT';assert.equal(H.resolve(n.state,H.importContext(n.state,forged)).coverage.status,'invalid');
 const c=S.geometry(n.state.board).center.completions.find(c=>key(c.cells)===key(pending[0].alternatives[0].cells));assert.equal(S.supportedCenterCompletion(c),false);
 for(const change of [p=>p.rootId=null,p=>p.rootId=-1,p=>p.family=null,p=>p.lost=true,p=>p.alternatives[0].piece='J',p=>p.alternatives[0].cells[0][0]--]){const p=clone(pending[0]);change(p);assert.equal(S.supportedCenterCompletion(c,[p]),false);}
});
test('pending L clear / blocked and previously lost targets cannot be revived or falsely paid',()=>{
 const n=replay().snapshots[2],pending=n.summary.center.pending[0],blocked=clone(n.state),[x,y]=pending.alternatives[0].cells[0];blocked.board[y]=blocked.board[y].slice(0,x)+'X'+blocked.board[y].slice(x+1);
 assert.equal(S.geometry(blocked.board).center.completions.some(c=>S.supportedCenterCompletion(c,[pending])&&key(c.cells)===key(pending.alternatives[0].cells)),false);
 assert.equal(M.pendingLStage(blocked,n.resource,{maxNodes:4000,now:()=>0}).valid,false);
 const end=replay().snapshots,prior=clone(end[5].resource);prior.pendingCenter[0].lost=true;const next=M.step(end[5].state,end[6].p,prior);assert.equal(next.pendingCenter.length,1);assert.equal(next.pendingCenter[0].lost,true,'An exact-looking later L is not authority to resurrect an invalidated stage');
 const fake=clone(end[6].state);fake.board[39]='..........';const before=end[5].state,last=f.witnesses[6];let state=before,history=end[5].history;for(const action of last.slice(0,-1)){const old=state;state=R.move(state,action);history=H.applyAction(history,old,action,state);}assert.equal(H.resolve(fake,H.applyAction(history,state,'HD',fake)).coverage.status,'invalid');
});
test('pending L clear / actual page replay and serialized request keep target through TSD and import',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=clone(m);}terminate(){}};
 g.element('#st-snapshot').value=JSON.stringify(f.session);g.click('#st-import');g.advance(40);
 for(const witness of f.witnesses.slice(0,3))for(const action of witness)g.window.stLab.act(action);g.advance(40);
 const req=workers.at(-1).message,summary=H.resolve(req.observation,H.importContext(req.observation,req.options.resourceContext));assert.equal(summary.center.pending.length,1);assert.equal(key(summary.center.pending[0].alternatives[0].cells),key([[4,34],[5,34],[6,34],[4,35]]));
 const saved=g.window.stLab.exportSession();g.window.stLab.act('UNDO');g.advance(40);g.element('#st-snapshot').value=JSON.stringify(saved);g.click('#st-import');g.advance(40);
 const imported=workers.at(-1).message;assert.deepEqual(H.resolve(imported.observation,H.importContext(imported.observation,imported.options.resourceContext)).center.pending,summary.center.pending);
}));

test('pending L clear / full admission accepts exact seven-lock closure and authenticated postclear suffix',()=>{
 const {start,snapshots}=replay(),context=s=>JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);
 for(const i of [0,3]){const root=i?snapshots[i-1]:{state:start.state,history:start.resourceHistory},steps=snapshots.slice(i).map(n=>({...n.p,target:n.p.event.target,hold:n.p.witness.includes('HOLD'),holdCount:n.p.witness.filter(a=>a==='HOLD').length,resultContext:context(n.state)}));
  const a={target:steps[0].target,witness:steps[0].witness,hold:steps[0].hold,holdCount:steps[0].holdCount,continuation:steps,context:context(root.state),evidence:{}},options={openingPhase:false,maxNodes:45000,now:()=>0,deadline:Infinity,resourceContext:H.exportContext(root.state,root.history)};
  assert.ok(P.revalidate(root.state,a,options),'Literal full-policy closure from lock '+(71+i));
  const forged=clone(a);forged.continuation.at(-1).event.cells[0][0]--;assert.equal(P.revalidate(root.state,forged,options),null);
  if(i===3){assert.equal(P.revalidate(root.state,a,{...options,resourceContext:undefined}),null,'Snapshot alone cannot authorize the retained unrecognized completion');}
 }
});
