'use strict';
// TEST ONLY: archived handoff routes are now geometrically unsafe. This loader
// isolates transport/identity/budget bookkeeping from the covered-cell gate;
// it is NOT evidence that those routes have strategic production admission.
// Real rules, resource-history authentication, reachability and other gates
// remain in use. Production negatives and real repair positives live separately.
const fs=require('node:fs'),A=require('../../st-access');
function access(overrides={}){return{...A,repairPrefix:(...args)=>{const actual=A.repairPrefix(...args);if(actual.status!=='unresolved-covered-cells')return actual;return{...actual,valid:true,status:'TEST-ONLY-covered-geometry-isolated',outstandingCells:[],steps:actual.steps.map(s=>({...s,created:[],outstanding:[]})),stage:null};},...overrides};}
function planner(overrides={}){const module={exports:{}};new Function('module','require',fs.readFileSync(require.resolve('../../st-planner'),'utf8'))(module,id=>id==='./st-access.js'?access(overrides):require('../../'+id.replace('./','')));return module.exports;}
module.exports={planner,access};
