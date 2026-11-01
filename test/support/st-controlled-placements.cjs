'use strict';
// Component-test control only: replay independently specified literal routes,
// then limit candidate enumeration to their actual targets. Physics, regional
// admission, resource/access proofs and lifecycle code remain production code.
// This does not test which unrestricted route the coach prefers.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const R=require('../../st-rules'),M=require('../../st-midgame-resources');
const key=s=>JSON.stringify([s.board,s.active?.type,s.hold,s.queue,s.canHold]);
module.exports=(observation,routes)=>{
 const allowed=new Map();
 for(const route of routes){let state=M.extendForced(R.createState(observation));for(const witness of route){const replay=R.replay(state,witness);assert(replay.valid&&replay.events.length===1);const k=key(state);if(!allowed.has(k))allowed.set(k,new Set());allowed.get(k).add(JSON.stringify(replay.events[0].target));state=replay.state;}}
 const rules={...R,placements:(state,options)=>{const result=R.placements(state,options),targets=allowed.get(key(state));return{...result,placements:result.placements.filter(p=>targets?.has(JSON.stringify(p.target)))};}};
 const module={exports:{}},req=require('node:module').createRequire(require.resolve('../../st-planner'));
 vm.runInNewContext(fs.readFileSync(require.resolve('../../st-planner'),'utf8'),{module,require:id=>id==='./st-rules.js'?rules:req(id)});
 return module.exports;
};
