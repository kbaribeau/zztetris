'use strict';
const {extendPublic}=require('./current-resource-test.cjs');
// Component-test budget control only. Restrict one independently replayed
// pending-L endpoint's real proof to zero nodes. Do not invent a negative
// result or alter physics, candidate order, other proofs, or final admission.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const R=require('../../st-rules'),M=require('../../st-obligation-resources'),Old=require('../../st-obligation-resources');
const key=s=>JSON.stringify([s.rules,s.board,s.active?.type,s.hold,s.queue,s.streamCursor]);
module.exports=(observation,witness)=>{
 const endpoint=R.replay(extendPublic(R.createState(observation)),witness);assert.equal(endpoint.valid,true);
 const blockedKey=key(endpoint.state),blocked=[];
 const resources={...M,pendingLStage:(state,resource,options)=>{
  if(key(state)!==blockedKey)return M.pendingLStage(state,resource,options);
  const proof=M.pendingLStage(state,resource,{...options,maxNodes:0});assert.equal(proof.valid,null);assert.equal(proof.status,'pending-L-stage-budget');blocked.push(proof);return proof;
 }};
 const filename=require.resolve('../../st-planner'),module={exports:{}},req=require('node:module').createRequire(filename);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:id=>id==='./st-obligation-resources.js'?resources:req(id)},{filename:'st-planner-pending-L-budget-control.js'});
 return{planner:module.exports,blocked,blockedKey,key};
};
