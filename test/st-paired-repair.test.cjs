'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const X=require('../st-paired-repair'),P=require('../st-planner'),R=require('../st-rules');
// Source: references/st-stacking/jstris-26536180.fumen, pages366–372.
// Candidate quiz observation reconstructed from converted Fumen: active/hold
// and six-piece preview are a synthetic test setup, NOT original player vision.
// Only input witnesses are copied. Safety/events must be independently replayed.
const fixture={"initial":{"rules":"st-zero-v2","board":["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","I.........","I.........","IOOJ......","IOOJ......","OOJJ......","OOSS......","JSSI......","JJJI......","LOOI.....Z","LOOILLL.ZZ"],"active":{"type":"L","x":3,"y":17,"rotation":0,"lastRotation":null},"hold":"T","canHold":true,"queue":["T","S","J","Z","I","T"],"revision":0,"streamCursor":0,"topOut":false,"lastEvent":null},"steps":[{"witness":["HOLD","L","L","HD"]},{"witness":["L","CCW","HD"]},{"witness":["L","L","L","CCW","HD"]},{"witness":["CW","HD"]},{"witness":["R","R","CW","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","L","HD"]},{"witness":["HOLD","CW","HD"]},{"witness":["R","R","R","CW","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","SD","CW","HD"]}]};
const clone=x=>JSON.parse(JSON.stringify(x));
test('opt-in certificate validates two balanced left Ts then an actual right TSD',()=>{
 const r=X.validateCertificate(fixture.initial,fixture.steps);assert.ok(r.valid,r.reason);
 assert.equal(r.continuation.length,7);assert.deepEqual(r.fillers.map(f=>f.parity).sort(),[-2,2]);
 assert.equal(r.resources.tsds,1);assert.equal(r.resources.tFillers,2);assert.equal(r.continuation.at(-1).event.spin,'full');
 assert.ok(r.elapsedMs<750);assert.equal(P.assess(fixture.initial.board).maintenanceScope,false,'research does not change default scope');
});
test('source flags and invented events cannot authorize a certificate',()=>{
 const steps=clone(fixture.steps);steps[0].notchValid=true;steps[0].event={type:'T',spin:'full',lines:2};
 assert.equal(X.validateCertificate(fixture.initial,steps).reason,'claimed-event-does-not-match-replay');
});
test('finite preview cannot be extended from source or import metadata',()=>{
 const more=clone(fixture.initial);more.queue.push('T');assert.equal(X.validateCertificate(more,fixture.steps).valid,false);
 const less=clone(fixture.initial);less.queue.pop();less.futureQueue=['T'];less.commitment={validated:true};
 assert.equal(X.validateCertificate(less,fixture.steps).valid,false);
});
test('a partial pair or missing later double is not a certificate',()=>{
 for(const count of [1,2,6])assert.equal(X.validateCertificate(fixture.initial,fixture.steps.slice(0,count)).valid,false);
 assert.equal(X.validateCertificate(fixture.initial,fixture.steps.concat(fixture.steps[0])).valid,false);
});
test('bad inputs, absent scoring geometry and exhausted budget are uncertified',()=>{
 const empty=clone(fixture.initial);empty.board=Array(40).fill('..........');assert.equal(X.validateCertificate(empty,fixture.steps).valid,false);
 const bad=clone(fixture.steps);bad[0].witness=['BAD'];assert.equal(X.validateCertificate(fixture.initial,bad).valid,false);
 assert.equal(X.validateCertificate(fixture.initial,fixture.steps,{timeMs:0}).reason,'certificate-budget-exhausted');
});
test('checker parity is measured from executed placements, not source labels',()=>{
 const altered=clone(fixture.steps);altered[1].witness=['L','L','HD'];altered[1].parity=2;
 const r=X.validateCertificate(fixture.initial,altered);assert.equal(r.valid,false);
});

test('competing cap or cleanup obligations are uncertified, never waived for a pair',()=>{
 const candidate={"initial":{"rules":"st-zero-v2","board":["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","...I......","...I......","...IOO....","LS.IOO...Z","LSSJLLL.ZZ","LLSJLSS.ZI","LLSJOOJ.ZI","JSSJLOO.ZI","OOSSLSS.ZI"],"active":{"type":"O","x":3,"y":17,"rotation":0,"lastRotation":null},"hold":"T","canHold":true,"queue":["J","L","S","I","Z","L"],"revision":0,"streamCursor":0,"topOut":false,"lastEvent":null},"steps":[{"witness":["HOLD","L","L","CCW","HD"]},{"witness":["R","R180","HD"]},{"witness":["CW","HD"]},{"witness":["HOLD","R","HD"]},{"witness":["L","L","L","CCW","L","HD"]},{"witness":["L","L","CCW","HD"]},{"witness":["HOLD","L","L","L","CCW","HD"]}]};
 assert.equal(X.validateCertificate(candidate.initial,candidate.steps).reason,'competing-cap-or-cleanup-demand-needs-access-proof');
});
test('invalid board is rejected safely and bounded search has no oracle fallback',()=>{
 const bad=clone(fixture.initial);bad.board=['.'];assert.equal(X.validateCertificate(bad,fixture.steps).reason,'invalid-observation');
 const r=X.search(fixture.initial,{timeMs:0});assert.equal(r.valid,false);assert.equal(r.reason,'bounded-search-budget-exhausted');assert.equal(r.visited,0);
});
