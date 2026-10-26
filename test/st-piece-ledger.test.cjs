'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),B=require('../st-bag'),P=require('../st-piece-ledger'),H=require('../st-resource-history');
const clone=x=>JSON.parse(JSON.stringify(x));
function run(f,{fresh=true,until=Infinity}={}){
 let state=R.createState(f.initial),ledger=P.start(state,{fresh}),history=H.start(state,{fresh}),locks=0;const checkpoints=[];
 function act(action,revealed=[]){const before=state;let next=R.move(state,action);for(const type of revealed)next={...next,queue:[...next.queue,type],...(next.bag?{bag:B.consume(next.bag,type)}:{})};ledger=P.applyAction(ledger,before,action,next);history=H.applyAction(history,before,action,next);state=next;const d=P.resolve(state,ledger);assert.notEqual(d.coverage,'invalid',d.reason);if(action==='HD'&&next!==before){locks++;checkpoints.push(d);}return d;}
 for(const step of f.steps){if(locks>=until)break;act(step.action,step.revealed);}
 return{act,checkpoints,get state(){return state;},get ledger(){return ledger;},get history(){return history;},get diagnostic(){return P.resolve(state,ledger);}};
}
const trial=require('./support/st-resource-trial-1.json');
test('shadow ledger: only playable entries count, HOLD identity and bag boundaries retain outstanding inventory',()=>{
 const a=run(trial,{until:0}),first=a.state.active.type,second=a.state.queue[0];
 assert.equal(a.diagnostic.inventory[first].entered,1);assert.equal(Object.values(a.diagnostic.inventory).reduce((n,x)=>n+x.entered,0),1);
 a.act('HOLD');assert.equal(a.diagnostic.inventory[second].entered,1);const held=a.diagnostic.instances.hold;
 for(let i=0;i<10;i++)a.act('HOLD');assert.deepEqual(a.diagnostic.instances.hold,held);assert.equal(Object.values(a.diagnostic.inventory).reduce((n,x)=>n+x.entered,0),2);
 const r=run(require('./support/st-shadow-cross-bag.json'));
 for(const d of r.checkpoints)for(const type of 'IJLOSTZ')assert.equal(d.inventory[type].outstanding,[d.instances.active,d.instances.hold].filter(p=>p?.type===type).length);
 const d=r.checkpoints[6];assert.equal(d.instances.hold.id,7);assert.equal(d.instances.hold.bag,0);assert.equal(d.instances.active.bag,1);assert.equal(d.inventory.L.outstanding,1);
});
test('shadow ledger: cross-bag available pair and exact pending pair are facts, not same-bag surplus',()=>{
 const r=run(require('./support/st-shadow-cross-bag.json')),a=r.checkpoints[6],b=r.checkpoints[7],c=r.checkpoints[8];
 assert.deepEqual(a.structure.pairingCandidates,[{kind:'available-SL',sId:9,lId:7,executionVerified:false}]);
 assert.ok(b.structure.pending.some(p=>p.family==='SL'&&p.root.id===9));
 assert.equal(c.structure.pairs.SL,a.structure.pairs.SL+1);assert.equal(c.structure.pending.length,0);
 assert.equal('hangingS' in c,false);assert.equal('hangingL' in c,false);
});
test('shadow ledger: unsupported accommodations remain explicit across replanning-sized intervals',()=>{
 const r=run(require('./support/st-shadow-uncertain-s.json'));
 for(const d of r.checkpoints.slice(13))assert.ok(d.structure.unresolved.examples.some(x=>x.id===14&&x.type==='S'));
 assert.ok(r.diagnostic.structure.unresolved.examples.some(x=>x.id===17&&x.type==='S'));
 const copy=clone(r.diagnostic);copy.structure.unresolved.count=0;assert.notEqual(r.diagnostic.structure.unresolved.count,0);
});
test('shadow ledger: compact facts survive old action limits and clears never renew factual Z counts',()=>{
 const r=run(trial),before=r.diagnostic;
 assert.equal(before.zDiversions.beforeFirstTsd,1);assert.equal(before.zDiversions.afterFirstTsd,1);
 for(let i=0;i<4100;i++)r.act(i%2?'R':'L');
 assert.deepEqual(r.diagnostic.inventory,before.inventory);assert.deepEqual(r.diagnostic.structure,before.structure);assert.deepEqual(r.diagnostic.zDiversions,before.zDiversions);
 assert.equal(H.resolve(r.state,r.history).coverage.status,'truncated');assert.equal(r.diagnostic.coverage,'from-empty');
 assert.ok(JSON.stringify(r.ledger).length<15000,'checkpoint contains facts, not an action tape');
});
test('shadow ledger: partial origins, forged facts, rejected input and mismatched replay do not manufacture history',()=>{
 const r=run(trial,{fresh:false,until:2});assert.equal(r.diagnostic.coverage,'since-observation');assert.equal(r.diagnostic.originKnown,false);assert.ok(r.diagnostic.instances.queue.every(p=>p.bag===null));
 assert.equal(P.resolve(r.state,clone(r.ledger)).coverage,'invalid');
 const injected=P.start({...r.state,pieceLedger:{originKnown:true,zDiversions:{afterFirstTsd:0}}});assert.equal(P.resolve(r.state,injected).originKnown,false);
 const next=R.move(r.state,'R');assert.equal(P.resolve(next,P.applyAction(r.ledger,r.state,'L',next)).coverage,'invalid');
 let s=R.createState({active:'O',queue:[]}),h=P.start(s);for(let i=0;i<10;i++){const n=R.move(s,'L');const k=P.applyAction(h,s,'L',n);if(n===s)assert.equal(k,h);s=n;h=k;}
 const n=R.move(s,'HD');h=P.applyAction(h,s,'HD',n);assert.equal(P.resolve(n,h).inventory.O.outstanding,0);assert.equal(n.active,null);
});
test('shadow ledger: local counts continue past 512 locks without retaining consumed identities',()=>{
 const a=run({initial:R.createState({active:'O',queue:Array(6).fill('O')}),steps:[]},{fresh:false});
 for(let lock=0;lock<600;lock++){
  for(let i=0;i<4;i++)a.act('L');for(let i=0;i<(lock%5)*2;i++)a.act('R');a.act('HD',['O']);
 }
 assert.equal(a.state.topOut,false);assert.equal(a.diagnostic.locks,600);assert.equal(a.diagnostic.inventory.O.locked,600);assert.equal(a.diagnostic.inventory.O.outstanding,1);
 assert.ok(JSON.stringify(a.ledger).length<15000);assert.equal(a.diagnostic.coverage,'since-observation');
});
test('shadow ledger: observed ZJ completion has a finite initialized count',()=>{
 const F=require('../st-fixtures'),S=require('../st-structure');const a=run({initial:F.get('cap-rebuild').observation,steps:[]},{fresh:false});
 for(const x of ['R','CW','HD'])a.act(x);
 assert.ok(a.diagnostic.structure.pending.some(p=>p.family==='ZJ'));
 const target=S.geometry(a.state.board).center.completions.find(x=>x.piece==='J'&&x.resultStatus==='level');assert.ok(target);
 const placement=R.placements(a.state,{maxNodes:16000}).placements.find(p=>p.event.type==='J'&&JSON.stringify(p.event.cells.slice().sort())===JSON.stringify(target.cells.slice().sort()));assert.ok(placement);
 for(const x of placement.witness)a.act(x);
 assert.equal(a.diagnostic.structure.pairs.ZJ,1);assert.ok(Object.values(a.diagnostic.structure.pairs).every(Number.isFinite));
});
