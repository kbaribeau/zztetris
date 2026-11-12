/* One request boundary for current resource facts. Actual Context imports are
 * trusted current data; obsolete tapes are rejected at this boundary.
 * A supplied unavailable input never becomes an implicit unknown origin.
 * Literal factual frames have no ordinary-route assessment or forced tail.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-obligation-context'),require('./st-obligation-projection'),require('./st-obligation-state'),require('./st-opening-eligibility'),require('./st-obligation-resources'),require('./st-pattern-history')):factory(root.STRules,root.STObligationContext,root.STObligationProjection,root.STObligationState,root.STOpeningEligibility,root.STObligationResources,root.STPatternHistory);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResourceProvider=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,C,P,Q,E,Resources,Pattern){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),inputs=new WeakSet(),frames=new WeakSet(),origins=new WeakMap();
const check=(ok,reason)=>{if(!ok)throw Error('Invalid resource input: '+reason);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function rememberPosition(input,raw){try{origins.set(input,clone(raw));}catch{}return input;}
const strip=x=>({position:x.position,state:x.state,supply:x.supply});
function sealFrame(value,origin={supplied:true,source:'projection'}){
 P.resolve(value);const frame=freeze({...strip(value),openingBoundary:clone(value.openingBoundary)});frames.add(frame);origins.set(frame,origin);return frame;
}
function frame(value){
 if(inputs.has(value)){check(value.status==='available','current accounting unavailable: '+value.reason);return value.frame;}
 check(frames.has(value),'prepared current input or local factual frame required');return value;
}
function bound(raw,value){try{return same(R.createState(raw),R.createState(frame(value).position));}catch{return false;}}
function facts(value){
 if(inputs.has(value))return value.facts;
 const f=frame(value),view=P.resolve(f),inventory=f.supply,remaining=inventory.originKnown&&inventory.frontier?[...'IJLOSTZ'].filter(type=>!(inventory.frontier.seenMask&(1<<'IJLOSTZ'.indexOf(type)))):null;
 return freeze({status:'available',reason:null,...view,
  instances:{active:clone(inventory.active),hold:clone(inventory.hold),queue:clone(inventory.queue)},
  observedRemainingTypes:remaining,publicBag:{status:remaining?'known':'unknown',remainingTypes:remaining},
  reset:{...view.reset,...(f.state.account.reset.status==='active'?{inheritedCovered:clone(f.state.account.reset.inheritedCovered)}:{})}});
}
function input(value){const result=freeze(value);inputs.add(result);return result;}
function fromFrame(value){const f=frame(value),origin=origins.get(f);return input({kind:origin.kind||'current',status:'available',availability:f.state.availability,supplied:origin.supplied,source:origin.source,reason:null,context:null,frame:f,facts:facts(f)});}
function unavailable(source,supplied,reason,context=null){return input({kind:'unavailable',status:'unavailable',availability:'unavailable',supplied,source,reason,context,frame:null,facts:freeze({status:'unavailable',availability:'unavailable',reason})});}
function prepare(raw,options={}){
 const native=own(options,'obligationContext')&&options.obligationContext!==undefined,legacy=options.resourceContext!==null&&options.resourceContext!==undefined;
 check(!(native&&options.obligationContext!==null&&legacy),'native and legacy contexts conflict');
 if(options.resourceInput!==undefined){
  const reused=inputs.has(options.resourceInput)?options.resourceInput:fromFrame(options.resourceInput);
  // Unavailable inputs still bind their originating public observation.
  const position=origins.get(reused);check(position?same(R.createState(raw),R.createState(position)):bound(raw,reused),'prepared input differs from public position');return reused;
 }
 const source=native?'current':legacy?'legacy':'implicit',supplied=native||legacy;
 let context=null;
 try{
  check(!['resourceHistory','resourceOriginBag'].some(k=>options[k]!==undefined&&options[k]!==null),'legacy resource history is unsupported');
  check(R.validate(raw).length===0&&raw.queue.length<=6,'literal current public position required');
  if(native){check(options.obligationContext!==null,'supplied current accounting unavailable');context=C.importState(options.obligationContext,{position:raw});if(raw.bag!==undefined&&raw.bag!==null&&context.status==='available')check(same(raw.bag,context.inventory.knowledge),'current public bag disagrees with supplied inventory');}
  else if(legacy)throw Error('Legacy resource contexts are unsupported; supply a current obligationContext or explicitly import a position.');
  else context=C.start(raw,{fresh:false});
  // Old standalone callers may carry a translated/broken notch checkpoint
  // beside resource input. Accept only a current notch checkpoint at this boundary.
  // Native current Context already owns safety and ignores this sidecar.
  if(!native&&own(options,'patternHistory')){
   const notches=Pattern.snapshot(raw,options.patternHistory);check(Pattern.resolve(raw,notches).status!=='invalid-history','invalid current notch checkpoint');
   const snapshot=C.exportState(context);snapshot.state.safety.notches=notches;context=C.importState(snapshot,{position:raw});
  }
  if(context?.status==='unavailable'){const result=unavailable(source,true,context.reason,context);return rememberPosition(result,raw);}
  const kind=native?'current':'implicit-unknown',boundary=context?context.boundary:{firstBagLocks:null,sourcePatternSeen:false};
  const projection=P.start(context.state,{position:raw,inventory:context.inventory});
  // This query may deduce only the bag knowledge present in its literal
  // request. The controller's actual inventory/frontier remains unchanged.
  projection.supply.knowledge=clone(raw.bag??null);
  const f=sealFrame({...projection,openingBoundary:boundary},{supplied,source,kind});
  const result=input({kind,status:'available',availability:f.state.availability,supplied,source,reason:null,context:supplied?context:null,frame:f,facts:facts(f)});return rememberPosition(result,raw);
 }catch(error){const result=unavailable(source,supplied,error.message||'Current resource input is unavailable.');return rememberPosition(result,raw);}
}
function exportActual(value){check(inputs.has(value)&&value.context,'an actual current Context is required for a portable snapshot');return C.exportState(value.context);}
function withOptions(raw,options={}){const prepared=prepare(raw,options);return{...options,resourceInput:prepared,...(prepared.status==='available'?{patternHistory:prepared.frame.state.safety.notches}:{})};}
// Some caller boundaries historically supplied an explicitly unknown query.
// Preserve that presence distinction without granting known accounting facts.
function withFrame(value,options={}, {supplied}={}){
 check(supplied===undefined||supplied===true,'projected query may only declare supplied presence');
 const f=frame(value),origin=origins.get(f),current=supplied===true&&!origin.supplied?sealFrame(f,{...origin,supplied:true}):f;
 return{...options,resourceInput:current};
}
function project(value,{witness,event,references=[]}={}){
 const f=frame(value),replay=R.replay(f.position,witness);check(replay.valid&&replay.events.length===1,'one legal factual lock required');
 const advanced=C.advanceBoundary(f.openingBoundary,replay.state),next=P.project(f,{witness,boundary:advanced.operation,references});
 if(event!==undefined)check(same(event,next.position.lastEvent),'reported event does not replay');
 return sealFrame({...next,openingBoundary:advanced.boundary},origins.get(f));
}
function marker(value,operation,references){
 const f=frame(value),boundary={position:f.position,inventory:f.supply},next=Q.projectTransition(f.state,operation,{before:boundary,after:boundary,references});
 return sealFrame({state:next.state,supply:clone(f.supply),position:clone(f.position),openingBoundary:f.openingBoundary},origins.get(f));
}
function projectHandoff(value,{references=[]}={}){return marker(value,{kind:'handoff'},references);}
function projectBeginReset(value,{candidate,references=[]}={}){return marker(value,{kind:'begin-reset',candidate},references);}
function eligibility(value,{right=null}={}){const f=frame(value);return E.resolve(f.state.account,{board:f.position.board,right,center:f.state.center});}
function conservationStep(value,previous){const f=frame(value);return E.conservationStep(f.state.account,{board:f.position.board},previous);}
function startRoute(value,options={}){const f=frame(value);return Resources.fromProjection(strip(f),{...options,openingBoundary:f.openingBoundary});}
// Opening construction may carry unfinished quality duties, but must not
// spend an optional Z before its factual allowance exists. Check the actual
// order: a preceding lock may establish that allowance; a later lock cannot
// retroactively authorize an earlier spend. Unknown-origin play is unchanged.
function checkOpeningZPrefix(value,path,{maxNodes=Infinity,deadline=Infinity,now=()=>Date.now()}={}){
 let current=frame(value),visited=0;
 if(current.state.account.opening?.kind!=='quality'||!path.some(p=>p.event?.type==='Z'&&p.event.cells.every(([x])=>x<7)))return{valid:true,visited};
 for(const step of path){
  const account=current.state.account,e=step.event;
  if(account.z.remaining!==null)return{valid:true,visited};
  if(e.type==='Z'&&e.cells.every(([x])=>x<7)&&!(account.mandatoryZ&&e.lines===0))return{valid:false,visited,reason:'opening-extra-Z-before-baseline'};
  const work=step.witness.length*2;
  if(now()>=deadline||visited+work>maxNodes)return{valid:false,visited,reason:'opening-Z-check-budget'};
  visited+=work;
  try{current=project(current,step);}catch{return{valid:false,visited,reason:'opening-Z-check-invalid-prefix'};}
 }
 return{valid:true,visited};
}
function binding(value){const f=frame(value);return Resources.factualBinding(f.state,f.supply,f.openingBoundary);}
return Object.freeze({prepare,exportActual,withOptions,withFrame,frame,facts,bound,project,projectHandoff,projectBeginReset,eligibility,conservationStep,startRoute,binding,checkOpeningZPrefix});
});
