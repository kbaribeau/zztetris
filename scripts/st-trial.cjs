// Offline, actual-engine closed-loop trial. No trial RNG or hidden queue is
// supplied to STCore. Established heap injection is explicit, not a natural
// opening. Stop at FIRST abstention (no handpicked fallback or seed filtering).
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {withPage}=require('../test/support/page.cjs');
const {fixtures}=require('../test/support/st-fixtures.cjs');
const {core,input,replay,heap,json}=require('../test/support/st-driver.cjs');
const {execFileSync}=require('node:child_process');
async function trial(seed,maxLocks=56) {
  let output;
  await withPage('st-lab.html',{seed,storage:{stGuideVisible:'false'}},g=>{
    const w=g.window;w.clearActive();w.board=fixtures.cap.before.map(r=>[...r].map(c=>({t:c==='#'?1:0,c:c==='#'?'X':''})));w.updateGhost();w.setShape();
    const p=core(g),decisions=[];let doubles=0,quads=0;
    for(let i=0;i<maxLocks;i++) {
      const s=input(g),start=performance.now(),a=p.advise(s),ms=performance.now()-start;
      decisions.push({input:s,result:json(a),ms});
      if(a.kind!=='target')break;
      replay(g,a);assert.deepEqual(heap(g),json(a.heap));
      assert.equal(w.cleared,a.expected.cleared);assert.equal(w.tspin,a.expected.tspin);assert.equal(w.mini,a.expected.mini);
      assert.notEqual(g.element('#notif').textContent,'TOP OUT');
      doubles+=Number(w.tspin&&w.cleared===2);quads+=Number(w.cleared===4);
    }
    const accepted=decisions.filter(d=>d.result.kind==='target').length;
    output={seed,maxLocks,locks:accepted,doubles,quads,stop:accepted===maxLocks?'trial-cap':decisions.at(-1).result.diagnostics?.stopReason,decisions};
  });
  return output;
}
async function main() {
  const results=[];for(const seed of [1,2,3,4,2000,2001,2002,2003,2004,2005,2006,2007])results.push(await trial(seed));
  const output={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),node:process.version,
    protocol:'Twelve fixed seeds, established cap-base heap; normal generator, no hidden suffix in advisor; up to 56 locks, first abstention stops. All twelve seeds are now seen development evidence, not a new held-out evaluation. Earlier 1000-series exploratory runs remain separate seen evidence. Locks are not bag boundaries.',results};
  const filename=process.argv[2]||'test-results/st-trial.json';fs.mkdirSync(require('node:path').dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(results.map(({decisions,...r})=>({...r,maxMs:Math.max(...decisions.map(d=>d.ms))})),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={trial};
