const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const {fixtures}=require('./support/st-fixtures.cjs');
const {arrange,core,input,replay,heap,json}=require('./support/st-driver.cjs');
const {trial}=require('../scripts/st-trial.cjs');

test('st-continuation/staged well: well-first I is a valid intermediate state, not a lost matcher phase',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
  const rows=fixtures.pocket.before.map((r,y)=>y>=36?r.slice(0,7)+'#'+r.slice(8):r);
  arrange(g,rows,{active:'I',hold:'O',next:['J','L','T','S','Z','I']});
  const p=core(g),a=p.advise({...input(g),preferredTarget:{kind:'I',cells:fixtures.pocket.pocketCells}});
  assert.equal(a.kind,'target');assert.equal(a.rule,'cleanup');replay(g,a);assert.equal(g.window.cleared,4);
  for(const s of a.witness.steps.slice(1)){replay(g,s);assert.deepEqual(heap(g),json(s.heap));}
}));

test('st-continuation/terminal access: hypothetical probe really spins, but its resources are not claimed available',()=>withPage('st-lab.html',{storage:{stGuideVisible:'false'}},g=>{
  arrange(g,fixtures.cap.before,{active:'Z',hold:'T',next:['O','I','J','L','S','T']});
  const a=core(g).advise(input(g));assert.equal(a.kind,'target');const end=a.witness.endpoint,o=end.opportunity;
  assert.equal(o.resourceStatus,'unverified-beyond-horizon');
  let board=end.heap;
  for(const probe of [...(o.setup?[o.setup]:[]),o]) {
    arrange(g,board,{active:probe.piece,hold:'',next:['O','I','J','L','S','T']});
    replay(g,{kind:'target',piece:{kind:probe.piece},prelude:[],cells:probe.cells,pose:probe.pose,path:probe.path});board=heap(g);
  }
  assert.equal(g.window.cleared,2);assert.equal(g.window.tspin,true);assert.equal(g.window.mini,false);
}));

for(const seed of [2000,2005])test(`st-continuation/held-out closed loop seed ${seed}: every issued move replays, abstentions retained`,async t=>{
  const result=await trial(seed,28);
  assert.ok(result.decisions.length>0);assert.ok(result.locks>0);
  for(const {input:s,result:a} of result.decisions){assert.ok(s.visibleNext.length<=6);if(a.kind==='target'){assert.equal(a.witness.steps.length,3);assert.equal(a.diagnostics.effectiveHorizon,3);}}
  t.diagnostic(JSON.stringify({seed,locks:result.locks,doubles:result.doubles,quads:result.quads,stop:result.stop}));
});
