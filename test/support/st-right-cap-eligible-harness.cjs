'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const R=require('../../st-rules'),H=require('../../st-resource-history'),PH=require('../../st-pattern-history');
const source=require('../fixtures/right-cap-score.json');
// Explicit synthetic inventory on the unchanged source board. Discard the
// original O's known bag/tape: only a new partial public origin is asserted.
function request(){const observation=R.createState({...source.request.observation,active:'I',bag:null});return{observation,previous:null,commitment:null,options:{depth:3,width:8,maxNodes:45000,timeMs:1500,openingPhase:false,resourceContext:H.exportContext(observation,H.start(observation)),patternHistory:PH.start(observation)}};}
function planner(overrides={},leftContext=null){
 const filename=require.resolve('../../st-planner'),m=new Module(filename,module),req=Module.createRequire(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m.rightCapOptional=false;
 // Faults apply only to the later optional query, never to qualification of
 // the real incumbent. Every initial/final resource/access guard is unchanged.
 const rules={...R};for(const [name,override]of Object.entries(overrides))rules[name]=(...args)=>m.rightCapOptional?override(...args):R[name](...args);
 m.require=id=>id==='./st-rules.js'?Object.freeze(rules):id==='./st-left-context.js'&&leftContext?leftContext:req(id);
 let code=fs.readFileSync(filename,'utf8');
 const seam='const literal=observe(raw),first=best.path[0];',optional='preference.candidates=alternatives.length;';
 if(code.split(seam).length!==2||code.split(optional).length!==2)throw Error('Right-cap branch seam changed; review the eligibility harness.');
 // Orchestration coverage, NOT natural ranking evidence: choose one actual
 // enumerated goal-free I root, then run its normal qualification and all
 // subsequent production admission/preference/fallback checks unchanged.
 code=code.replace(seam,`const controlledRoot=root.placements.find(p=>p.event.type==='I'&&!p.event.lines&&!holdCount(p)&&p.event.cells.every(([x])=>x===9));
 if(!controlledRoot)throw Error('Missing actual I control');
 const controlled=nodeFor({...controlledRoot},null,initial,root.placements.indexOf(controlledRoot),readAssessment);
 if(controlled.cycleDebt||!controlled.notchValid||!certifiedCavities(controlled)||controlled.assessment.maxHeight>=20||!controlled.assessment.regionalSupport)throw Error('I control fails ordinary guards');
 qualify([controlled]);
 if(!controlled.qualified||controlled.assessment.right.entry?.status==='unresolved-budget'||!accessSafe(controlled)||!resourceSafe(controlled))throw Error('I control lacks ordinary proof');
 best=controlled;
 ${seam}`).replace(optional,optional+'module.rightCapOptional=true;');
 m._compile(code,filename);return m.exports;
}
function capBoard(){let state=request().observation;for(const witness of [['L','L','CCW','HD'],['CW','R','R','R','R','HD']]){const r=R.replay(state,witness);if(!r.valid||r.events.length!==1)throw Error('Invalid source-derived I control witness');state=r.state;}return state.board;}
module.exports={request,planner,capBoard,incumbentWitness:['CW','R','R','R','R','HD'],firstCells:[[2,25],[2,26],[2,27],[2,28]]};
