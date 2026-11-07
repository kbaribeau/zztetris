'use strict';
const R=require('../../st-rules'),B=require('../../st-bag'),H=require('../../st-obligation-context');
const cases=require('../fixtures/midgame-resource-cases.json').cases;
const actions={l:'L',r:'R',d:'SD',D:'HD',h:'HOLD',c:'CW',a:'CCW',b:'R180'};
module.exports=function(id='second-z-run3'){
 const f=cases.find(f=>f.id===id);let state=R.createState({...f.initial,revision:1}),history=H.start(state,{fresh:true});
 for(const [i,[encoded,reveals]]of f.locks.entries()){
  let cursor=0;
  for(const code of encoded){const action=actions[code],before=state;state={...R.move(state,action),revision:state.revision+1};while(state.queue.length<6){const type=reveals[cursor++];state={...state,queue:state.queue.concat(type),bag:B.consume(state.bag,type)};}history=H.applyActual(history,{before:before,action:action,after:state}).context;}
  if(i+1===f.handoff)history=H.handoff(history,{position:state}).context;
 }
 return{state,history,obligationContext:H.exportState(history)};
};
