/* UNWIRED compact request adapter. Factual projection and route permission are
 * separate: a newly projected account credit is not permission to spend it.
 * This finite request owns no actual receipt, session or lifetime history.
 * Production M/planner authority is unchanged until all consumers migrate.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-obligation-projection'),require('./st-obligation-assessment'),require('./st-obligation-context'),require('./st-rules')):factory(root.STObligationProjection,root.STObligationAssessment,root.STObligationContext,root.STRules);if(typeof module==='object'&&module.exports)module.exports=api;else root.STObligationRoute=api;})(typeof globalThis!=='undefined'?globalThis:this,function(P,A,C,R){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(ok,reason)=>{if(!ok)throw Error('Invalid obligation route: '+reason);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const strip=p=>({state:p.state,supply:p.supply,position:p.position});
function frame(projection){return{...projection,view:P.resolve(projection)};}
function initialize(projection,{horizon=7,planReferences=[],openingBoundary}={}){
 check(openingBoundary&&typeof openingBoundary.sourcePatternSeen==='boolean','current opening boundary required');
 check(projection.supply.originKnown?Number.isInteger(openingBoundary.firstBagLocks)&&openingBoundary.firstBagLocks>=0&&openingBoundary.firstBagLocks<=7:openingBoundary.firstBagLocks===null,'opening boundary origin');
 if(projection.state.availability==='known'){check((openingBoundary.firstBagLocks===7)===(projection.state.sl.firstBagReview!=='pending'),'opening boundary review');check(projection.state.sl.firstBagReview!=='reviewed'||openingBoundary.sourcePatternSeen,'reviewed source boundary');check(!openingBoundary.sourcePatternSeen||!projection.state.sl.foundationOpen,'source boundary foundation');}
 check(Array.isArray(planReferences)&&planReferences.every(n=>Number.isSafeInteger(n)&&n!==0),'plan references');
 projection=P.extendForced(projection);
 const assessment=A.start(P.resolve(projection),{state:projection.state,supply:projection.supply,horizon,planReferences});
 return freeze({schemaVersion:1,domain:'projection-route',projection:strip(projection),assessment,openingBoundary:clone(openingBoundary),planReferences:[...new Set(planReferences)].sort((a,b)=>a-b)});
}
function start(state,{position,inventory,horizon=7,planReferences=[],openingBoundary}={}){return initialize(P.start(state,{position,inventory}),{horizon,planReferences,openingBoundary});}
function startUnknown(position,options={}){return initialize(P.startUnknown(position),{openingBoundary:{firstBagLocks:null,sourcePatternSeen:false},...options});}
function read(route){check(route?.schemaVersion===1&&route.domain==='projection-route'&&route.projection&&route.assessment&&Array.isArray(route.planReferences),'request envelope');return route;}
function step(current,{witness,event}={}){
 const route=read(current),before=frame(route.projection),references=A.references(route.assessment,{supply:before.supply,planReferences:route.planReferences});
 const replay=R.replay(route.projection.position,witness);check(replay.valid&&replay.events.length===1,'one legal lock witness required');
 const advanced=C.advanceBoundary(route.openingBoundary,replay.state);
 const projected=P.project(route.projection,{witness,boundary:advanced.operation,references});
 if(event!==undefined)check(same(event,projected.position.lastEvent),'reported event does not replay');
 const next=P.extendForced(strip(projected)),after=frame(next);
 const assessed=A.transition(route.assessment,{before,after,locked:projected.locked,event:projected.position.lastEvent,effects:projected.effects});
 const result=freeze({schemaVersion:1,domain:'projection-route',projection:strip(next),assessment:assessed.state,openingBoundary:advanced.boundary,planReferences:route.planReferences.slice()});
 return{route:result,effects:clone(projected.effects),locked:clone(projected.locked),assessmentStep:clone(assessed.step)};
}
function resolve(current){const route=read(current);return{facts:P.resolve(route.projection),resources:A.resolve(route.assessment,{supply:route.projection.supply})};}
function references(current){const route=read(current);return A.references(route.assessment,{supply:route.projection.supply,planReferences:route.planReferences});}
function binding(current){const route=read(current);return JSON.stringify([route.projection.state,route.projection.supply,route.openingBoundary,A.binding(route.assessment,{supply:route.projection.supply})]);}
// Mirrors the ordinary finite resource check only. It does not enforce every
// planner gate, promise Reset admission, or turn an unresolved prefix into a
// repair proof. Reset callers separately inspect each assessmentStep loss.
function checkPath(current,path){
 read(current);if(!Array.isArray(path))return{valid:false,reason:'invalid-resource-path',route:current};
 let route=current;const steps=[];
 try{
  for(const p of path){const result=step(route,{witness:p.witness,event:p.event});route=result.route;steps.push(result.assessmentStep);const resources=resolve(route).resources;if(resources.violations.length)return{valid:false,reason:resources.violations[0],route,steps};}
 }catch(error){return{valid:false,reason:'invalid-resource-witness',detail:error.message,route,steps};}
 const resources=resolve(route).resources;return{valid:!resources.centerBlocked,reason:resources.centerBlocked?'center-partner-blocked-by-T-or-unseen':null,route,steps};
}
return Object.freeze({start,startUnknown,step,resolve,references,binding,checkPath});
});
