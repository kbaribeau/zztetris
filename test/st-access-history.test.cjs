'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),A=require('../st-access'),H=require('../st-pattern-history'),F=require('./support/st-gap-phase.json');
function placement(s,w){const r=R.replay(s,w);assert.ok(r.valid);return{state:r.state,event:r.events[0]};}
test('actual movement rejects the flood-connected column-three gap',()=>{
 const s=F.gap.observation,p=placement(s,F.gap.witness),c=A.check(s,p);
 assert.deepEqual(c.cells,[[2,37]]);assert.equal(c.reachable,false);assert.equal(c.complete,true);
 assert.equal(A.access(s.board,[[2,37]]).reachable,true);
 const a=P.plan(s,{maxNodes:45000});assert.ok(a.target);const actual=placement(s,a.witness);assert.equal(A.check(s,actual).reachable,true);assert.notDeepEqual(a.target,p.event.target);
});
test('unknown access budget is not cached as safe or impossible',()=>{
 A.clearCache();const p=placement(F.gap.observation,F.gap.witness);
 assert.equal(A.check(F.gap.observation,p,{maxNodes:0}).reachable,null);
 assert.equal(A.check(F.gap.observation,p).reachable,false);
});
test('roofed-cell identity translates through clears and excludes established notches',()=>{
 const s=F.quad.observation,p=placement(s,F.quad.witness),n=S.advanceNotches(s.board,p);
 const cells=A.newlyCovered(s.board,p.state.board,p.event,n.pattern);assert.ok(cells.every(([x,y])=>x!==6||!n.pattern.protectedRows.includes(y)));
 const old=new Set(A.covered(s.board).filter(([,y])=>!p.event.clearedRows.includes(y)).map(([x,y])=>`${x},${y+p.event.clearedRows.filter(r=>r>y).length}`));assert.ok(cells.every(c=>!old.has(c.join(','))));
});
test('actual quad preserves established pattern even when fresh recognition loses it',()=>{
 const s=F.quad.observation,pre=R.replay(s,F.quad.witness.slice(0,-1)).state,p=placement(pre,['HD']);
 const h=H.update(H.start(s),pre,p.state,p.event),pattern=H.resolve(p.state,h);
 assert.equal(pattern.anchorRow,38);assert.equal(pattern.status,'established');assert.notEqual(S.notchPattern(p.state.board).status,'established');
 const bad=placement(F.after.observation,F.after.witness);assert.equal(S.advanceNotches(p.state.board,bad,pattern).valid,false);
 const a=P.plan(F.after.observation,{patternHistory:h,maxNodes:45000});if(a.target)assert.equal(S.advanceNotches(p.state.board,placement(F.after.observation,a.witness),pattern).valid,true);
 assert.equal(H.resolve(p.state,{...h,origin:R.emptyBoard()}).status,'invalid-history');assert.equal(H.resolve(p.state,{...h,steps:[null]}).status,'invalid-history');
 assert.equal(H.resolve(p.state,null).status,S.notchPattern(p.state.board).status);
});
test('real page retains phase across manual quad, undo and cosmetic inputs, but resets imported provenance',()=>require('./support/page.cjs').withPage('st-lab.html',{},g=>{
 const workers=[];g.window.Worker=class{constructor(){workers.push(this);}postMessage(m){this.message=JSON.parse(JSON.stringify(m));}terminate(){}};
 const request=()=>{g.advance(40);return workers.at(-1).message;};
 g.element('#st-snapshot').value=JSON.stringify(F.quad.observation);g.click('#st-import');let req=request();assert.equal(H.resolve(req.observation,req.options.patternHistory).anchorRow,34);
 for(const a of F.quad.witness)g.window.stLab.act(a);req=request();assert.equal(H.resolve(req.observation,req.options.patternHistory).anchorRow,38);
 g.window.stLab.act('L');req=request();assert.equal(H.resolve(req.observation,req.options.patternHistory).anchorRow,38);
 g.click('#st-undo');req=request();assert.equal(H.resolve(req.observation,req.options.patternHistory).anchorRow,34);
 for(const a of F.quad.witness)g.window.stLab.act(a);req=request();assert.equal(H.resolve(req.observation,req.options.patternHistory).anchorRow,38);
 g.element('#st-snapshot').value=JSON.stringify({...req.observation,patternHistory:req.options.patternHistory});g.click('#st-import');req=request();assert.equal(req.options.patternHistory,null);
 g.click('#st-reset');req=request();assert.equal(req.options.patternHistory,null);
}));
test('reference temporary pockets remain physically accessible rather than blanket banned',()=>{
 const controls=require('./support/st-access-reference.json');assert.ok(controls.length>=2);
 for(const c of controls){const proof=A.access(c.board,c.cells);assert.equal(proof.reachable,true,`${c.source}:${c.page}`);assert.ok(proof.witnesses.length);}
});
test('fresh production worker cannot recommend S13 with a cold access cache',()=>{
 const run=require('../scripts/lib/st-simulation.cjs').workerPlanner(),s=F.gap.observation;
 const a=run({type:'plan',id:1,observation:s,previous:null,commitment:null,options:{timeMs:750,maxNodes:45000}});
 if(a.target){const p=placement(s,a.witness);assert.equal(A.check(s,p).reachable,true);assert.notDeepEqual(a.target,placement(s,F.gap.witness).event.target);}
 else assert.ok(['budget-exhausted','no-supported-continuation-found'].includes(a.status));
});
test('retained advice and opening early return cannot bypass observed phase',()=>{
 const s=F.quad.observation,pre=R.replay(s,F.quad.witness.slice(0,-1)).state,p=placement(pre,['HD']),history=H.update(H.start(s),pre,p.state,p.event);
 const after=F.after.observation,old=placement(after,F.after.witness);
 const bad={target:old.event.target,witness:F.after.witness,continuation:[{witness:F.after.witness,event:old.event}],context:JSON.stringify([after.rules,after.board,after.hold,after.canHold,after.queue,after.bag??null,after.active.type]),evidence:{},hold:false};
 assert.equal(P.revalidate(after,bad,{patternHistory:history}),null);
 const a=P.plan(after,{openingPhase:true,patternHistory:history,maxNodes:8000});if(a.target)assert.equal(S.advanceNotches(after.board,placement(after,a.witness),H.resolve(after,history)).valid,true);
});
