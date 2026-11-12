const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../st-opening-obligations.js');
const {withPage}=require('./support/page.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
test('opening checklist uses observed thresholds, verified retired allocation and no predicted placements',()=>{
 const s=O.start({known:true}),before=clone(s);
 assert.deepEqual(O.checklist(s).map(x=>x.complete),[false,false,false,false]);assert.deepEqual(s,before);
 s.profile.before.t=1;s.profile.before.z=1;s.profile.capEstablished=true;
 assert.equal(O.checklist(s)[0].progress,'1/2');assert.deepEqual(O.checklist(s).map(x=>x.complete),[false,true,true,false]);
 s.profile.before.t=2;assert.equal(O.checklist(s)[0].complete,true);
 s.profile.before=null;s.firstTsd=true;s.allocationVerified=true;s.mandatoryZ=true;
 assert.deepEqual(O.checklist(s).map(x=>x.complete),[true,false,true,true]);
 s.mandatoryZ=false;assert.ok(O.checklist(s).every(x=>x.complete));
});
test('opening checklist does not invent allocation from unknown or retired unsupported history',()=>{
 const s=O.start({known:false});s.firstTsd=true;
 assert.deepEqual(O.checklist(s).map(x=>x.complete),[false,false,false,true]);assert.equal(O.checklist(s)[0].progress,'not confirmed');
 assert.ok(O.checklist(null).every(x=>!x.complete));
 s.profile.before='overused';assert.equal(O.checklist(s)[0].complete,false);
});
test('opening tile checklist follows actual locks, Undo, fresh restart and session import',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
 const source=require('./support/st-resource-trial-1.json'),stream=[source.initial.active.type,...source.initial.queue,...source.steps.flatMap(s=>s.revealed)],random=[];
 for(let k=0;k<stream.length;k+=7){const desired=stream.slice(k,k+7);desired.push(...[...'IJLOSTZ'].filter(p=>!desired.includes(p)));const bag=[...'IJLOSTZ'];for(let i=6;i>0;i--){const j=bag.indexOf(desired[i]);assert.ok(j<=i);random.push((j+.25)/(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 g.window.Math.random=()=>random.length?random.shift():.5;g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));
 const detail=()=>g.element('#st-phase-detail').textContent,initial=detail();assert.equal(initial.split('\n').length,4);assert.equal((initial.match(/❌/g)||[]).length,4);
 let last,locks=0;
 for(const step of source.steps){if(locks===24)break;if(step.action==='HD')last=detail();g.window.stLab.act(step.action);if(step.action==='HD'){locks++;const rows=O.checklist(g.window.stLab.exportSession().coaching.obligationContext.state.account);assert.equal(detail(),rows.map(x=>`${x.complete?'✅':'❌'} ${x.label}${x.progress?' ('+x.progress+')':''}`).join('\n'));}}
 const session=g.window.stLab.exportSession(),completed=detail();assert.match(completed,/✅ First T-spin double/);
 g.window.stLab.act('UNDO');assert.equal(detail(),last);
 g.element('#st-snapshot').value=JSON.stringify(session);g.click('#st-import');assert.equal(detail(),completed);
 g.click('#st-reset');assert.equal(detail(),completed);
 g.element('#st-fixture').value='empty';g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));assert.equal(detail(),initial);
 assert.equal(g.element('#st-phase').getAttribute('aria-describedby'),'st-phase-detail');
}));
