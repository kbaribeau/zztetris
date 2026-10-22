'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),F=require('../st-fixtures'),E=require('../scripts/evaluate-st.cjs');
const recorded=require('../docs/st-historical-failures.json');
for(const failure of recorded.cases)test(`historical failure remains reproducible: ${failure.fixture}`,()=>{
 const fixture=F.get(failure.fixture),future=fixture.future.slice();let state=R.createState(fixture.observation),tsds=0;
 for(const step of failure.steps){state=E.execute(state,step.witness);assert.equal(state.lastEvent.type,step.type);assert.equal(state.lastEvent.lines,step.lines);assert.equal(state.lastEvent.spin,step.spin);if(step.lines===2&&step.spin==='full')tsds++;state=E.replenish(state,future);}
 assert.equal(tsds,failure.tsds);assert.equal(failure.steps.length,failure.locks);
});
