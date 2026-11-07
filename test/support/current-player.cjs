'use strict';
// Test input driver: execute recorded public actions through the production
// controller Context. No history reconstruction or alternative accounting.
const R=require('../../st-rules'),B=require('../../st-bag'),Context=require('../../st-obligation-context');
module.exports=function currentPlayer(origin,{snapshot,fresh=true}={}){
 let position=R.createState(origin),context=snapshot?Context.importState(snapshot,{position}):Context.start(position,{fresh}),locks=0,last;
 const api={act(action,revealed=[]){const before=position,next=R.move(before,action);position={...next,queue:[...next.queue,...revealed]};for(const type of revealed)if(position.bag)position.bag=B.consume(position.bag,type);last=Context.applyActual(context,{before,action,after:position});context=last.context;if(action==='HD'&&last.receipt.accepted)locks++;return last;},lock(witness){for(const action of witness)api.act(action);return last;},handoff(){last=Context.handoff(context,{position});context=last.context;return last;},begin(candidate=true){last=Context.beginReset(context,{position,candidate});context=last.context;return last;},get context(){return context;},get state(){return context.state;},get inventory(){return context.inventory;},get position(){return position;},get locks(){return locks;},get last(){return last;}};
 return api;
};
