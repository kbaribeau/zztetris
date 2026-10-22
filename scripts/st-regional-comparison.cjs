'use strict';
// Existing manual-playtest cases only. These are development regressions, not a
// new held-out corpus. The planner receives observations, never reference moves.
const R=require('../st-rules'),P=require('../st-planner'),F=require('../st-fixtures');
const CONFIG=Object.freeze({depth:3,width:8,maxNodes:45000});
const CASES=Object.freeze([
 ['direct-double','Reference takes immediate TSD; investigate renewable right structure rather than only the next hypothetical T entry.'],
 ['s-after-double','Reference places S entirely in center columns 5–7; compare continued center completion to I/J right cavity.'],
 ['higher-double','Reference takes held TSD immediately; no B2B state is modeled in this comparison.'],
 ['after-quad','Reference uses S then later L entirely in center columns 5–7; compare this supported pair to left/center coupling.'],
 ['late-held-double','Reference takes held TSD immediately. TSD then J/O in the center is a legal reviewed alternative, not literal replay imitation.'],
 ['actual-pose-double','Reference immediate TSD remains reachable from the moved pose; require an actual-pose witness.'],
 ['marathon-preparation','Reference uses horizontal I in left columns 1–4; compare left flatness and allocation.'],
 ['marathon-rebuild','Reference uses Z on right before later left I; immediate horizontal I in columns 1–4 is another reviewed legal alternative.']
]);
function placement(event,hold,witness){return {type:event.type,columns:[...new Set(event.cells.map(([x])=>x+1))].sort((a,b)=>a-b),hold:!!hold,lines:event.lines,spin:event.spin,target:event.target,witness};}
function compareCase(id,note,config=CONFIG){const f=F.get(id),initial=R.createState(f.observation),advice=P.plan(P.observe(initial),config);let state=initial,valid=true;const continuation=[];
 for(const step of advice.continuation??[]){const replay=R.replay(state,step.witness);const event=replay.events[0];const verified=replay.valid&&replay.events.length===1&&JSON.stringify(event)===JSON.stringify(step.event)&&R.validate(replay.state).length===0;valid=valid&&verified;
  continuation.push({...placement(step.event,step.hold,step.witness),verified,structuralEvidence:step.structuralEvidence??null});state=replay.state;
 }
 const ref=R.replay(initial,f.expectations.referenceWitness);if(!ref.valid||ref.events.length!==1)throw new Error('Invalid reference witness: '+id);
 return {id,label:f.label,developmentCase:true,note,observation:{active:initial.active,hold:initial.hold,canHold:initial.canHold,queue:initial.queue,bag:initial.bag},status:advice.status,reason:advice.reason,first:continuation[0]??null,continuation,validWitness:!!advice.target&&valid,reference:placement(ref.events[0],f.expectations.referenceWitness.includes('HOLD'),f.expectations.referenceWitness),evidence:advice.evidence??null,metrics:advice.metrics,assessment:advice.assessment??null,referenceAssessment:P.assess(ref.state.board),provenance:f.provenance};
}
function evaluate(config=CONFIG){return {description:'Existing starting-position comparison; no B2B modeling and no new generalization cases.',config,environment:{node:process.version,platform:process.platform},cases:CASES.map(([id,note])=>compareCase(id,note,config))};}
if(require.main===module){const report=evaluate();console.log(JSON.stringify(report,null,2));if(report.cases.some(c=>!c.validWitness))process.exitCode=1;}
module.exports={CONFIG,CASES,compareCase,evaluate};
