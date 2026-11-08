/* Opt-in, bounded diagnostic receipt. Never used as planning evidence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STSearchTrace=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const copy=value=>JSON.parse(JSON.stringify(value));
const priorityOrder={ordinary:['safety','regional support','negative cycle debt','structural band','verified scoring / T-entry tie-break','Left-context score','neutral execution slot','total cleared lines'],opening:['negative channel occupancy','negative covered Left','foundation access','parity feasibility','excess parity debt','construction quality','negative absolute parity','negative input effort']};
function create({limit=1200}={}){
 limit=Number.isFinite(limit)?Math.max(1,Math.min(3000,Math.floor(limit))):1200;
 const events=[],searches=[];let omitted=0;
 function record(kind,scope,make){if(events.length>=limit){omitted++;return;}events.push({id:events.length+1,kind,scope,...copy(make())});}
 function candidate(scope,node,outcome,extra={}){record('candidate',scope,()=>({path:node.path.map(p=>({event:p.event,witness:p.witness})),board:node.state.board,priority:{rank:node.rank||null,labels:priorityOrder[scope]||[],order:'Higher is preferred lexicographically. Eligibility and proof checks are separate; diversity scheduling is not pure rank order.',insertedPreference:scope==='ordinary'?'When both carry pending opening quality, Center continuity then opening quality precede structural band.':'Allocation rank precedes construction quality.',allocationRank:node.allocationRank||null,centerContinuity:node.centerContinuity??null,openingQualityProgress:node.openingQualityProgress??null},outcome,...extra}));}
 function start(scope,observation){
  // Separate roots for projected handoff probes; a path is local to this root.
  // Bound roots as well as events, including when a family emits no candidates.
  if(searches.length>=limit)return{start,record(){omitted++;},candidate(){omitted++;}};
  const searchId=searches.length+1;searches.push({id:searchId,scope,observation:copy(observation)});
  return{start,record:(kind,area,make)=>record(kind,area,()=>({searchId,...make()})),candidate:(area,node,outcome,extra={})=>candidate(area,node,outcome,{searchId,...extra})};
 }
 return{record,candidate,start,finish(result){return{version:1,scope:'Ordinary and opening beam candidates only; nested resource, access, retention, Reset and special construction searches are summarized by final evidence, not fully traced.',limit,truncated:omitted>0,omitted,events,searches,result:copy({status:result.status,reason:result.reason,metrics:result.metrics,evidence:result.evidence}),selected:copy(result.continuation||[]),limits:'This is a bounded, instrumented decision, not an exhaustive game tree. Beam pruning, unvisited candidates and unfinished proofs do not establish impossibility. Capture overhead can change wall-clock cutoffs.'};}};
}
return Object.freeze({create});
});
