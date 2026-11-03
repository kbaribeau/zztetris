'use strict';
// Development diagnostics, never selection gates. Null means no double in
// the observed finite window; it must not be mislabeled as zero-lock scoring.
function summarize(steps,{cycle=null}={}){
 const doubles=steps.map((step,index)=>step.spin==='full'&&step.lines===2?index+1:null).filter(lock=>lock!==null);
 return{locks:steps.length,firstTsdLock:doubles[0]??null,tsds:doubles.length,lines:steps.reduce((sum,step)=>sum+step.lines,0),cycle};
}
module.exports={summarize};
