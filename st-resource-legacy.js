/* Finite compatibility reader only. Old resource tapes are validated by the
 * retired codec, then replayed once into current Context. Neither that history
 * nor its action/lock limits enter the returned current state or live updater.
 * Native current imports never use this module. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-bag'),require('./st-resource-history'),require('./st-public-inventory'),require('./st-obligation-context'),require('./st-plan-continuity')):factory(root.STRules,root.STBag,root.STResourceHistory,root.STPublicInventory,root.STObligationContext,root.STPlanContinuity);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResourceLegacy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,H,I,C,PC){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function validateBag(tape,originBag,position){
 if(originBag!==null&&(!originBag||B.validate(originBag).length))throw Error('Invalid resource-origin bag evidence.');
 let bag=originBag?clone(originBag):null;
 if(tape.fresh){const actual=B.fromObserved({observed:[tape.origin.active.type,...tape.origin.queue],startPhase:0});if(!same(actual,bag))throw Error('Resource origin does not match the claimed first bag.');}
 for(const step of tape.steps)for(const type of step.revealed)if(bag){bag=B.consume(bag,type);if(B.validate(bag).length)throw Error('Resource draws contradict bag evidence.');}
 if(!same(bag,position.bag??null))throw Error('Resource replay does not match current bag evidence.');
}
function convert(position,tape,options={}){
 try{
  const legacy=H.importContext(position,tape),coverage=H.resolve(position,legacy).coverage;
  if(!['complete','partial'].includes(coverage.status))throw Error(coverage.reason||'Invalid resource replay.');
  if(Object.prototype.hasOwnProperty.call(options,'resourceOriginBag'))validateBag(tape,options.resourceOriginBag,position);
  let current=R.createState(tape.origin),context=C.start(current,{fresh:tape.fresh});
  const mark=at=>{
   if(tape.handoffAtAction===at)context=C.handoff(context,{position:current}).context;
   if((tape.resetAtActions||[]).includes(at))context=C.beginReset(context,{position:current,candidate:true}).context;
  };
  mark(0);
  for(const [index,step]of tape.steps.entries()){
   const before=current,next=R.move(before,step.action);current={...next,queue:[...next.queue,...step.revealed]};
   context=C.applyActual(context,{before,action:step.action,after:current}).context;
   if(context.status!=='available')throw Error(context.reason||'Current accounting could not convert the legacy replay.');
   mark(index+1);
  }
  // The legacy validator already checked the full public endpoint. Its current
  // inventory restores partial-origin bag knowledge stored beside old tapes.
  // Import only the current snapshot; no legacy capability escapes this reader.
  const snapshot=C.exportState(context),inventory=I.withKnowledge(context.inventory,legacy.inventory.knowledge);
  if(inventory.status!=='available')throw Error(inventory.reason);
  snapshot.inventory=I.exportState(inventory);context=C.importState(snapshot,{position});
  return{status:'available',reason:null,context};
 }catch(error){return{status:'unavailable',reason:error.message||'Could not convert legacy resource context.',context:null};}
}
function fromHistory(position,history,options={}){return convert(position,H.exportContext(position,history),options);}
// Old saved constructions need their actual accepted input order once. This
// compatibility boundary verifies both old tapes and their exact common prefix,
// then retains only the finite selected-plan cursor and native root snapshot.
// It never returns the lifetime tapes or installs them as current authority.
function planContinuity(position,currentTape,proof){
 try{
  const prior=proof?.resourceContext;
  if(!prior||!currentTape||!Array.isArray(prior.steps)||!Array.isArray(currentTape.steps)||prior.steps.length>currentTape.steps.length||!same(prior.origin,currentTape.origin)||prior.fresh!==currentTape.fresh||prior.handoffAtAction!==currentTape.handoffAtAction||!same(currentTape.steps.slice(0,prior.steps.length),prior.steps))throw Error('Saved construction is not connected to the legacy current input.');
  const tail=currentTape.steps.slice(prior.steps.length);
  if(tail.length>PC.MAX_ACTIONS||tail.filter(p=>p.action==='HD').length!==proof.consumed)throw Error('Legacy construction exceeds its finite scope.');
  const currentLegacy=H.importContext(position,currentTape),coverage=H.resolve(position,currentLegacy).coverage;
  if(!['complete','partial'].includes(coverage.status))throw Error(coverage.reason||'Invalid current legacy replay.');
  const root=convert(proof.origin,prior);if(root.status!=='available')throw Error(root.reason);
  const native={...clone(proof),obligationContext:C.exportState(root.context)};delete native.resourceContext;
  let state=R.createState(proof.origin),inventory=root.context.inventory,cursor=PC.start(state,inventory,{...native,consumed:0});
  if(!cursor)throw Error('Invalid original construction binding.');
  for(const step of tail){
   const before=state,next=R.move(before,step.action);state={...next,queue:[...next.queue,...step.revealed]};
   for(const type of step.revealed)if(state.bag)state.bag=B.consume(state.bag,type);
   const receipt=I.transition(inventory,before,step.action,state);
   if(receipt.status!=='available'||!receipt.accepted)throw Error('Legacy construction operation does not replay.');
   cursor=PC.advance(cursor,before,step.action,state,receipt);inventory=receipt.next;
   if(!cursor)throw Error('Legacy construction has completed or left its finite scope.');
  }
  // Rebinding revision is the same trusted-current import used by Undo. The
  // semantic endpoint, original supply and current identities still must agree.
  cursor=PC.importState(PC.exportState(cursor),{position,inventory:currentLegacy.inventory,proof:native});
  if(!cursor)throw Error('Legacy construction does not match its current endpoint.');
  return{status:'available',reason:null,proof:native,planContinuity:PC.exportState(cursor)};
 }catch(error){return{status:'unavailable',reason:error.message||'Could not convert the legacy construction.',proof:null,planContinuity:null};}
}
return Object.freeze({convert,fromHistory,planContinuity});
});
