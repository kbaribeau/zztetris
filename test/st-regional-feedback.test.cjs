'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../scripts/st-regional-comparison.cjs'),R=require('../st-rules'),F=require('../st-fixtures');
const {summarize}=require('./support/st-selection-performance.cjs');
// These eight already-published starts are now development regressions following
// Kevin's manual feedback. They are not new generalization or held-out cases.
for(const [id,note] of C.CASES)test(`regional feedback: ${id} retains an executable regional alternative`,t=>{
 const c=C.compareCase(id,note);
 assert.equal(c.validWitness,true,c.reason);
 assert.equal(c.evidence.regionalSupport,true);
 assert.ok(c.assessment.structure);
 assert.ok(c.continuation.every(p=>p.verified));
 const first=c.first;
 assert.equal(first.type==='I'&&first.columns.every(x=>x>=8),false,'avoid speculative right I-wall');
 assert.equal(first.type==='I'&&first.lines===1,false,'avoid unsupported I-single detour');
 if(id==='direct-double'||id==='actual-pose-double'){
  // Fresh ranking may defer this opportunity. Its executable existence stays
  // a hard contract; exact saved scoring-goal timing is tested separately.
  const f=F.get(id),reference=R.replay(R.createState(f.observation),f.expectations.referenceWitness);
  assert.equal(reference.valid,true);assert.equal(reference.events.length,1);
  assert.equal(reference.events[0].spin,'full');assert.equal(reference.events[0].lines,2);
  t.diagnostic('selection-performance '+JSON.stringify({id,selected:summarize(c.continuation),reference:summarize(reference.events)}));
 }
 if(id==='after-quad'){
  // Left quality may choose the verified L/O Left allocation instead of a
  // Center preparation; do not label that allocation as a completed pair.
  assert.equal(first.type,'L');assert.ok(first.columns.every(x=>x>=1&&x<=4));assert.equal(first.structuralEvidence.pairFamily,null);
  assert.equal(c.assessment.leftSealed,0);assert.equal(c.assessment.structure.right.reservoir.status,'verified-clear-reopens-reservoir');
 }
 if(id==='marathon-preparation'){assert.equal(first.type,'I');assert.deepEqual(first.columns,[1,2,3,4]);}
 if(id==='marathon-rebuild')assert.ok((first.type==='Z'&&first.columns.every(x=>x>=8))||(first.type==='I'&&JSON.stringify(first.columns)==='[1,2,3,4]'));
});
