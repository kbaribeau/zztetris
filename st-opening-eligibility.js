/* UNWIRED opening/planner predicates over current obligation facts.
 * No allocation/count/closure/milestone array is reconstructed. The caller
 * owns phase, disabled options, right-side geometry, legal route proof and
 * post-clear handoff search. These selectors confer none of that authority.
 *
 * The exact third-T window and consumer quality candidate are different live
 * conditions from baseline eligibility. In particular, a later scoring T ends
 * first-TSD retention but can leave delayed quality and mandatory Z unresolved.
 * A source violation alone ends baseline eligibility, not the legacy quality
 * preference. Preserve that quirk until a separately authorized policy change.
 */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-opening-obligations'),require('./st-obligation-state'),require('./st-obligation-projection')):factory(root.STOpeningObligations,root.STObligationState,root.STObligationProjection);if(typeof module==='object'&&module.exports)module.exports=api;else root.STOpeningEligibility=api;})(typeof globalThis!=='undefined'?globalThis:this,function(O,Q,P){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function check(ok,reason){if(!ok)throw Error('Invalid opening eligibility: '+reason);}
function eligibility(current,{board,right=null}={}){
 check(Array.isArray(board)&&board.length===40&&board.every(row=>typeof row==='string'&&/^[.XIJLOSTZ#]{10}$/.test(row)),'current public board required');
 const projected=current?.domain==='projection',account=(projected?O.importProjection:O.importState)(current);
 const view=(projected?O.resolveProjection:O.resolve)(account,{board}),a=view.openingAllocation;
 const thirdTReady=account.known&&a.status==='ready-for-first-tsd';
 const thirdTComplete=account.known&&a.status==='verified-first-tsd'&&account.thirdTWindow;
 // Pending source allocation and a post-TSD mandatory Z both imply the old
 // >=2 total-T gate. An invalid/unknown allocation cannot infer it from a board.
 const allocationRequired=account.known&&a.requiredNonRightZ===1&&(a.requiredNonRightT===0||account.firstTsd&&account.allocationVerified)&&['pending','pending-opening-z'].includes(a.status)&&['staggered-scoring-wall','cap-preparation'].includes(right);
 const qualityPending=account.known&&a.status==='verified-first-tsd'&&account.qualityCandidate;
 const historicalHandoff=account.known&&a.status==='verified-first-tsd'&&view.extraZ.baseline&&['available','used'].includes(view.extraZ.status);
 return{thirdTReady,thirdTComplete,allocationRequired,qualityPending,historicalHandoff,mandatoryZPending:a.requiredNonRightZ===1};
}
// Partner reporting requires explicit current Center facts, even for a false
// quality predicate. Missing context is not evidence of an empty target set.
function resolve(current,{board,right=null,center}={}){
 check(Array.isArray(center?.pending)&&Array.isArray(center?.debt),'current Center targets required');
 const view=eligibility(current,{board,right});
 return{...view,qualityPendingPartners:view.qualityPending?clone(center.pending):[]};
}
// The existing search stops checking allocation once its first-TSD endpoint
// has been certified. Preserve that short circuit; do not turn this predicate
// into an ongoing post-clear movement ban or silently re-open a failed prefix.
// These terminal request states do not evaluate a new account or public board.
function conservationStep(current,context,previous={safe:true,fulfilled:false}){
 check(typeof previous?.safe==='boolean'&&typeof previous.fulfilled==='boolean'&&(!previous.fulfilled||previous.safe),'prior conservation result');
 if(!previous.safe||previous.fulfilled)return{safe:previous.safe,fulfilled:previous.fulfilled};
 const view=eligibility(current,context);return{safe:view.thirdTReady||view.thirdTComplete,fulfilled:view.thirdTComplete};
}
// A hypothetical accepted boundary rebases only a cloned projection. Account
// credits/mandatory Z are unchanged, and no actual receipt or phase is minted.
// A caller must still prove the existing handoff geometry and maintenance move.
function projectHandoff(current,{references=[]}={}){
 P.resolve(current);
 const boundary={position:current.position,inventory:current.supply};
 const result=Q.projectTransition(current.state,{kind:'handoff'},{before:boundary,after:boundary,references});
 const projection={state:result.state,supply:clone(current.supply),position:clone(current.position)};
 P.resolve(projection);
 return{...projection,effects:result.effects};
}
return Object.freeze({resolve,conservationStep,projectHandoff});
});
