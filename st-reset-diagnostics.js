/* Observed Reset evidence, never a planner input or a phase/allowance oracle. */
(function(root,factory){
  const api=typeof module==='object'&&module.exports
    ?factory(require('./st-resource-history'),require('./st-structure'))
    :factory(root.STResourceHistory,root.STStructure);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.STResetDiagnostics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Resources,Structure){
'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
const source='https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit';
const tsd=e=>e.type==='T'&&e.spin==='full'&&e.lines===2&&e.cells.every(([x])=>x>=6)&&e.cells.some(([x])=>x>=7);
const quad=e=>e.type==='I'&&e.lines===4&&e.cells.every(([x])=>x>=7);
const diversion=e=>e.lines===0&&e.cells.every(([x])=>x<7);
const checkerboard=cells=>cells.reduce((sum,[x,y])=>sum+((x+y)%2===0?1:-1),0);
const fact=e=>({at:e.at,pieceId:e.pieceId,type:e.type,region:e.region,cells:clone(e.cells),checkerboardContribution:checkerboard(e.cells)});
const unavailable=(coverage,reason)=>({schemaVersion:1,coverage,observed:{tDiversions:[],nonScoringTs:[],zDiversions:[],scoring:[]},pairs:[],status:'unknown',reason,phaseBoundary:'unknown',allowanceRenewal:false});

function describe(raw,resources){
  const events=resources.allocations,t=events.filter(e=>e.type==='T'&&e.lines===0),z=events.filter(e=>e.type==='Z'&&diversion(e));
  const scores=events.filter(e=>tsd(e)||quad(e)).map(e=>({at:e.at,pieceId:e.pieceId,type:tsd(e)?'right-tsd':'right-tetris',clearedRows:e.clearedRows.slice()}));
  const pairs=[];
  // Adjacent entries in the observed T-diversion stream, NOT adjacent locks.
  // Overlapping pairs in a three-T run are explicitly unclassified below.
  for(let i=0;i+1<t.length;i++){
    const a=t[i],b=t[i+1],previous=t[i-1],next=t[i+2];
    const before=events.filter(e=>e.at<a.at&&tsd(e)).at(-1);
    const interveningClears=events.filter(e=>e.at>a.at&&e.at<b.at&&e.lines>0).map(e=>({at:e.at,lines:e.lines,clearedRows:e.clearedRows.slice()}));
    const noClear=(lo,hi)=>!events.some(e=>e.at>lo&&e.at<hi&&e.lines>0);
    const overlapping=Boolean(previous&&noClear(previous.at,a.at)||next&&noClear(b.at,next.at));
    const contributions=[checkerboard(a.cells),checkerboard(b.cells)];
    const reasons=[];
    if(!before)reasons.push('No prior Right TSD was observed; this may be opening construction or unknown earlier history.');
    if(a.region!=='left'||b.region!=='left')reasons.push('Center, Right, or straddling T constructions are outside the reviewed Left-only examples, not forbidden.');
    if(interveningClears.length)reasons.push('A clear between these Ts prevents the reviewed no-clear parity comparison.');
    if(Math.abs(contributions[0])!==2||contributions[0]+contributions[1]!==0)reasons.push('These actual T cells do not have opposite checkerboard contributions.');
    if(overlapping)reasons.push('Another T diversion overlaps this no-clear sequence; pair boundaries are ambiguous.');
    // This is a visible observation window, deliberately NOT a Reset interval.
    // A source Extra Z may lie outside it, or a following Extra Z inside it.
    const lower=before?.at??0,upper=next?.at??resources.locks+1;
    const localZ=z.filter(e=>e.at>lower&&e.at<upper);
    const firstObservedTsd=scores.find(e=>e.type==='right-tsd')?.at??0;
    const priorZ=z.filter(e=>e.at>firstObservedTsd&&e.at<=lower);
    const excludedZ=z.filter(e=>e.at<=lower);
    const subsequent=scores.filter(e=>e.at>b.at&&e.at<upper);
    const eligibility=resources.extraZ.baseline;
    const ambiguousEarlierActivity=priorZ.length>0||t.some(e=>e.at>firstObservedTsd&&e.at<a.at);
    const interpretation=localZ.length===2&&!ambiguousEarlierActivity?'traditional-count-compatible':localZ.length===1?'extra-z-count-compatible-if-earlier-use':'ambiguous';
    pairs.push({
      first:fact(a),second:fact(b),priorRightTsdAt:before?.at??null,
      status:reasons.length?'unclassified':localZ.length?'reset-like-candidate':'paired-t-evidence-only',
      confidence:'phase-boundaries-unverified',reasons,
      parity:{contributions,net:contributions[0]+contributions[1],noInterveningClear:interveningClears.length===0,scope:'Only these two T placements; not proof that the whole Left region is balanced or safe.'},
      interveningClears,
      zWindow:{afterLockExclusive:lower,beforeLockExclusive:upper,boundary:'preceding-observed-Right-TSD to next-observed-T-diversion, or current recorded prefix; not a phase boundary',observations:localZ.map(fact),earlierOutsideWindowObserved:excludedZ.map(fact)},
      resourceInterpretation:{kind:interpretation,verified:false,earlierUse:'unknown-for-this-candidate',observedOpeningBaselineAt:eligibility?.at??null,ambiguousEarlierActivity,note:'Counts describe this explicitly bounded window only. Earlier or following Extra Z use can overlap it; no interval or allowance is renewed.'},
      subsequentScoring:subsequent,
      recoveryEvidence:subsequent.length?'subsequent-scoring-observed':'no-subsequent-scoring-in-this-window',
      completionVerified:false,
    });
  }
  const geometry=Structure.geometry(raw.board);
  const candidates=pairs.filter(p=>p.status==='reset-like-candidate');
  return{
    schemaVersion:1,coverage:clone(resources.coverage),locks:resources.locks,terminal:resources.terminal,
    observed:{tDiversions:t.filter(diversion).map(fact),nonScoringTs:t.map(fact),zDiversions:z.map(fact),scoring:scores},pairs,
    status:candidates.length?'candidate-evidence':pairs.length?'unclassified-pair-evidence':t.length?'single-or-unpaired-diversion':resources.coverage.status==='partial'?'unknown':'no-reset-evidence',
    currentGeometry:{at:resources.locks,scope:'Current board only, not reconstructed geometry at a pair or phase endpoint.',leftProfile:geometry.left.profile.slice(),leftCovered:geometry.left.covered,centerProfile:geometry.center.profile.slice(),centerStatus:geometry.center.status,centerPatternSupport:geometry.center.patternSupport,centerSealedVoids:geometry.center.sealedVoids,rightShape:geometry.right.shapeStatus},
    phaseBoundary:'unknown',allowanceRenewal:false,
    source:{url:source,sections:['4','8','9'],scope:'Community guidance motivates these observations. Pair/window classification is a conservative engineering interpretation, not an author-labelled Reset or a timing rule.'},
    note:'Observed evidence only. No Reset completion, automatic resource renewal, debt cancellation, guard relaxation, or recommendation change is inferred.',
  };
}
function resolve(raw,history){
  try{
    const resources=Resources.resolve(raw,history);
    if(!['complete','partial'].includes(resources.coverage.status)||!resources.allocations)return unavailable(clone(resources.coverage),'Missing, stale, forged, truncated, or otherwise unavailable observed history.');
    return describe(raw,resources);
  }catch{return unavailable({status:'invalid'},'Could not validate the observed Reset evidence.');}
}
return Object.freeze({resolve});
});
