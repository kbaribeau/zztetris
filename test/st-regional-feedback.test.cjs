'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../scripts/st-regional-comparison.cjs');
// These eight already-published starts are now development regressions following
// Kevin's manual feedback. They are not new generalization or held-out cases.
for(const [id,note] of C.CASES)test(`regional feedback: ${id} retains an executable regional alternative`,()=>{
 const c=C.compareCase(id,note);
 assert.equal(c.validWitness,true,c.reason);
 assert.equal(c.evidence.regionalSupport,true);
 assert.ok(c.assessment.structure);
 assert.ok(c.continuation.every(p=>p.verified));
 const first=c.first;
 assert.equal(first.type==='I'&&first.columns.every(x=>x>=8),false,'avoid speculative right I-wall');
 assert.equal(first.type==='I'&&first.lines===1,false,'avoid unsupported I-single detour');
 if(id==='direct-double'||id==='actual-pose-double')assert.equal(first.spin==='full'&&first.lines===2,true);
 if(id==='after-quad'){assert.ok(['S','L'].includes(first.type),'S/L preparation must stay in the center');assert.ok(first.columns.every(x=>x>=5&&x<=7));assert.equal(first.structuralEvidence.pairFamily,'SL');}
 if(id==='marathon-preparation'){assert.equal(first.type,'I');assert.deepEqual(first.columns,[1,2,3,4]);}
 if(id==='marathon-rebuild')assert.ok((first.type==='Z'&&first.columns.every(x=>x>=8))||(first.type==='I'&&JSON.stringify(first.columns)==='[1,2,3,4]'));
});
