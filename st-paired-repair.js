/* Finite, public-supply construction proofs. Never a complete Reset claim. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),()=>require('./st-planner')):factory(root.STRules,root.STStructure,()=>root.STPlanner);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPairedRepair=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,getPlanner){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const bound=(value,fallback,max,min=0)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:fallback));
// This deliberately narrow certificate does not decide competing cap/I access.
// Those cases require exhaustive actual-pose enumeration and are uncertified.
function competingDemand(state){const right=S.geometry(state.board).right;
 return right.completions.length>0||right.cycle.prepareColumn!==null||right.cycle.cleanupColumns.length>0;
}
function validateCertificate(initial,steps,options={}){
 const P=getPlanner(),capMode=options.kind==='cap-deferral';
 const started=performance.now(),budget=bound(options.timeMs,750,750);
 const fail=(reason,lock=null)=>({valid:false,status:'uncertified',reason,lock,elapsedMs:performance.now()-started});
 if(!initial||!Array.isArray(initial.queue)||initial.queue.length>6)return fail('public-preview-must-contain-at-most-six-pieces');
 if(!Array.isArray(steps)||!steps.length||steps.length>7)return fail('certificate-must-have-one-to-seven-locks');
 let state;try{state=P.observe(initial);if(R.validate(state).length)return fail('invalid-observation');}catch{return fail('invalid-observation');}
 let notches=S.notchPattern(state.board),assessment=P.assess(state.board),centerDebt=[];
 const capTargets=S.geometry(state.board).right.completions.map(c=>clone(c.cells));let capPaidAt=null;
 const cellKey=c=>c.map(p=>p.join(',')).sort().join(';');
 if(state.topOut||notches.status!=='established'||(capMode?!capTargets.length:S.geometry(state.board).right.shapeStatus!=='staggered-scoring-wall'))return fail('established-scoring-geometry-required');
 const fillers=[],verified=[];let returnedDouble=false;
 for(let i=0;i<steps.length;i++){
  if(performance.now()-started>=budget)return fail('certificate-budget-exhausted',i);
  const witness=steps[i]?.witness;if(!Array.isArray(witness)||!witness.length||witness.length>256)return fail('bounded-input-witness-required',i);
  let replay;try{replay=R.replay(state,witness);}catch{return fail('invalid-input-witness',i);}
  if(!replay.valid||replay.events.length!==1)return fail('witness-must-execute-exactly-one-legal-lock',i);
  if(capMode&&(S.geometry(state.board).right.cycle.prepareColumn!==null||S.geometry(state.board).right.cycle.cleanupColumns.length))return fail('cap-deferral-cannot-bypass-cleanup-I',i);
  if(!capMode&&competingDemand(state))return fail('competing-cap-or-cleanup-demand-needs-access-proof',i);
  const event=replay.events[0],p={state:replay.state,event};
  if(capMode){
   if(i===0&&(event.type!=='Z'||event.lines||event.cells.some(([x])=>x>=7)))return fail('cap-deferral-must-start-with-nonright-Z',i);
   if(capPaidAt===null&&i>0&&event.type==='Z'){if(event.lines||!capTargets.some(c=>cellKey(c)===cellKey(event.cells)))return fail('replacement-Z-does-not-repay-exact-cap',i);capPaidAt=i;}
   if(capPaidAt===null&&event.lines)return fail('cap-obligation-not-repaid-before-clear',i);
  }
  if(steps[i].event&&JSON.stringify(steps[i].event)!==JSON.stringify(event))return fail('claimed-event-does-not-match-replay',i);
  if(!capMode&&event.lines&&fillers.length<2)return fail('pair-must-precede-any-clear',i);
  if(event.topOut||replay.state.topOut||!S.canonicalClear(event))return fail('noncanonical-or-topout-lock',i);
  const notch=S.advanceNotches(state.board,p,notches);if(!notch.valid)return fail('notch-transition:'+notch.violation,i);
  const next=P.assess(replay.state.board);if(next.maxHeight>=20)return fail('headroom-exhausted',i);
  if(P.cavityRepairDebt(assessment,next,event).length)return fail('new-internal-sealing',i);
  const reservation=P.centerReservationStep(state,p,centerDebt,notches);centerDebt=reservation.debt;
  const structure=S.transition(state,p,undefined,{notches});
  const leftT=event.type==='T'&&!event.lines&&event.cells.every(([x])=>x<4);
  if(event.type==='T'&&!event.lines){
   if(capMode)return fail('cap-deferral-does-not-authorize-T-discard',i);
   if(!leftT||returnedDouble||fillers.length>=2)return fail('exactly-two-left-T-fillers-required',i);
   const parity=event.cells.reduce((n,[x,y])=>n+((x+y)%2?1:-1),0);if(!parity)return fail('nonzero-T-parity-required',i);
   fillers.push({lock:i,parity,cells:clone(event.cells)});
  }
  const forbidden=structure.cycleViolations.filter(v=>!(!capMode&&leftT&&v==='spent-scoring-T-without-double')&&!(capMode&&i===0&&v==='spent-cap-Z-on-optional-work'));
  if(forbidden.length)return fail('cycle-policy:'+forbidden.join(','),i);
  if(event.type==='T'&&event.spin==='full'&&event.lines===2){
   if(capMode?capPaidAt===null:fillers.length!==2||fillers[0].parity+fillers[1].parity!==0)return fail('construction-obligation-must-precede-double',i);
   if(!event.cells.some(([x])=>x>=7))return fail('double-must-use-right-scoring-region',i);
   returnedDouble=true;
  }
  verified.push({witness:witness.slice(),event:clone(event),structuralEvidence:{...structure,centerReservation:reservation}});
  state=replay.state;notches=notch.pattern;assessment=next;
 }
 if(performance.now()-started>=budget)return fail('certificate-budget-exhausted');
 if(!returnedDouble||(capMode?capPaidAt===null:fillers.length!==2||fillers[0].parity+fillers[1].parity!==0))return fail('construction-and-subsequent-double-not-proved');
 if(verified.at(-1).event.type!=='T'||verified.at(-1).event.spin!=='full'||verified.at(-1).event.lines!==2||!assessment.regionalSupport)return fail('supported-double-endpoint-required');
 if(centerDebt.length)return fail('unresolved-center-reservation');
 return {valid:true,status:'finite-research-certificate',continuation:verified,fillers,cap:capMode?{targets:capTargets,paidAt:capPaidAt}:null,end:state,elapsedMs:performance.now()-started,resources:P.cycleResources(verified),limitations:['Supplied witness validation, not route discovery.','Competing cap or cleanup demand is conservatively uncertified, not waived.','Only this public prefix is certified; default recovery eligibility is checked separately and sustained play is not guaranteed.','A paired left-T exception is not a general Reset or Z-allocation exception.']};
}
// Construction stages prioritize repaying the pair, then actual scoring-row
// deficits. These are discovery priorities, not permission or a Reset trigger.
const poseKey=a=>[a.type,a.x,a.y,a.rotation,a.type==='T'&&a.lastRotation?((a.lastRotation.to-a.lastRotation.from+4)%4!==2&&a.lastRotation.kickIndex===4?'upgrade':'rotation'):'none'].join(',');
function stagePlacements(state,{deadline=Infinity,maxNodes=2000}={}){
 let visited=0;const out=[],outSeen=new Set(),roots=[{s:state,w:[]}],rootSeen=new Set();let hold=state;
 for(let i=1;i<=2;i++){const n=R.move(hold,'HOLD');if(n===hold||n.topOut)break;hold=n;roots.push({s:hold,w:Array(i).fill('HOLD')});}
 for(const root of roots){const rootkey=JSON.stringify([root.s.active,root.s.hold,root.s.queue]);if(rootSeen.has(rootkey))continue;rootSeen.add(rootkey);if(!root.s.active)continue;
  const air=[root],airSeen=new Set([poseKey(root.s.active)]);for(let i=0;i<air.length;i++){if(performance.now()>=deadline)return{placements:out,visited,complete:false};const n=air[i];for(const act of ['L','R','CW','CCW','R180']){const s=R.move(n.s,act);if(s===n.s||s.active.y!==root.s.active.y)continue;const k=poseKey(s.active);if(!airSeen.has(k)){airSeen.add(k);air.push({s,w:[...n.w,act]});}}}
  const q=[],seen=new Set();function addDrop(n){const run=[n];let cur=n;while(performance.now()<deadline){const s=R.move(cur.s,'SD');if(s===cur.s)break;cur={s,w:[...cur.w,'SD']};run.push(cur);}for(const k of run.slice(-4)){const key=poseKey(k.s.active);if(!seen.has(key)){seen.add(key);q.push(k);}}}
  for(const n of air)addDrop(n);
  for(let i=0;i<q.length;i++){
   if(visited++>=maxNodes||performance.now()>=deadline)return{placements:out,visited,complete:false};
   const n=q[i];if(R.move(n.s,'SD')===n.s){const s=R.move(n.s,'HD'),event=s.lastEvent;if(event&&!event.topOut){const key=JSON.stringify([event,s.active,s.hold,s.queue]);if(!outSeen.has(key)){outSeen.add(key);out.push({state:s,event,witness:[...n.w,'HD']});}}}
   for(const act of ['L','R','CW','CCW','R180']){const s=R.move(n.s,act);if(s===n.s)continue;addDrop({s,w:[...n.w,act]});}
  }
 }
 return{placements:out,visited,complete:false,envelopeComplete:true};
}
function scoringDebt(board,anchor){let best=1000;for(let y=Math.max(17,anchor-4);y<=37;y++)for(let x=5;x<=7;x++)for(let rotation=0;rotation<4;rotation++){
 const a={type:'T',x,y,rotation},cells=R.cells(a);if(cells.some(([x])=>x<6)||!R.fits(board,a)||R.fits(board,{...a,y:y+1}))continue;const rows=[...new Set(cells.map(c=>c[1]))];if(rows.length!==2)continue;let empty=0;for(const ry of rows)for(let xx=0;xx<10;xx++)if(board[ry][xx]==='.'&&!cells.some(([cx,cy])=>cx===xx&&cy===ry))empty++;
 const corners=[[x,y+1],[x+2,y+1],[x+2,y+3],[x,y+3]].filter(([xx,yy])=>xx<0||xx>=10||yy>=40||board[yy][xx]!=='.').length;
 best=Math.min(best,empty*5+Math.max(0,3-corners)*2);
 }return best;}
// Deliberately small generic beam. A miss is not an impossibility result.
function search(initial,options={}){
 const P=getPlanner(),capMode=options.kind==='cap-deferral';
 const start=performance.now(),deadline=start+bound(options.timeMs,750,750);
 const maxNodes=bound(options.maxNodes,45000,45000),depth=Math.floor(bound(options.depth,7,7));
 const width=Math.floor(bound(options.width,3,8,1));let visited=0,reachedDepth=0,incomplete=false;
 const miss=reason=>({valid:false,status:'uncertified',reason,visited,reachedDepth,elapsedMs:performance.now()-start});
 let state;try{if(!Array.isArray(initial.queue)||initial.queue.length>6)return miss('invalid-public-preview');state=P.observe(initial);if(R.validate(state).length)return miss('invalid-observation');}catch{return miss('invalid-observation');}
 const notches=S.notchPattern(state.board),capTargets=S.geometry(state.board).right.completions.map(c=>c.cells);if(notches.status!=='established'||(capMode?!capTargets.length:S.geometry(state.board).right.shapeStatus!=='staggered-scoring-wall'))return miss('established-scoring-geometry-required');
 let beam=[{state,notches,path:[],parities:[],centerDebt:[],assessment:P.assess(state.board)}];
 for(let d=0;d<depth&&beam.length;d++){
  const next=[];
  for(const n of beam){
   if(performance.now()>=deadline||visited>=maxNodes)return miss('bounded-search-budget-exhausted');
   if(capMode&&(S.geometry(n.state.board).right.cycle.prepareColumn!==null||S.geometry(n.state.board).right.cycle.cleanupColumns.length))continue;
   if(!capMode&&competingDemand(n.state))continue;
   const enumeration=stagePlacements(n.state,{maxNodes:maxNodes-visited,deadline,now:()=>performance.now()});visited+=enumeration.visited;incomplete ||= !enumeration.complete;
   for(const p of enumeration.placements){
    if(performance.now()>=deadline)return miss('bounded-search-budget-exhausted');
    const e=p.event;if(!S.canonicalClear(e)||e.topOut||(!capMode&&e.lines&&n.parities.length<2))continue;
    if(capMode&&!n.path.length&&(e.type!=='Z'||e.lines||e.cells.some(([x])=>x>=7)))continue;
    const capPaid=n.capPaid||(capMode&&n.path.length>0&&e.type==='Z'&&capTargets.some(c=>JSON.stringify(c.slice().sort())===JSON.stringify(e.cells.slice().sort())));
    if(capMode&&((e.lines&&!capPaid)||(n.path.length>0&&e.type==='Z'&&!capPaid)))continue;
    const parities=n.parities.slice(),leftT=e.type==='T'&&!e.lines&&e.cells.every(([x])=>x<4);
    if(e.type==='T'&&!e.lines){if(capMode)continue;if(!leftT||parities.length>=2)continue;parities.push(e.cells.reduce((v,[x,y])=>v+((x+y)%2?1:-1),0));if(parities.length===2&&parities[0]+parities[1]!==0)continue;}
    const notch=S.advanceNotches(n.state.board,p,n.notches);if(!notch.valid)continue;
    const a=P.assess(p.state.board);if(a.maxHeight>=20||P.cavityRepairDebt(n.assessment,a,e).length)continue;
    const structure=S.transition(n.state,p,undefined,{notches:n.notches});if(structure.cycleViolations.some(v=>!(!capMode&&leftT&&v==='spent-scoring-T-without-double')&&!(capMode&&!n.path.length&&v==='spent-cap-Z-on-optional-work')))continue;
    const centerDebt=P.centerReservationStep(n.state,p,n.centerDebt,n.notches).debt,path=[...n.path,{witness:p.witness}];
    if(e.type==='T'&&e.spin==='full'&&e.lines===2){
     const result=validateCertificate(initial,path,{kind:options.kind,timeMs:Math.max(0,deadline-performance.now())});
     if(result.valid)return {...result,search:{visited,depth:path.length,elapsedMs:performance.now()-start}};
     continue;
    }
    next.push({state:p.state,notches:notch.pattern,path,parities,capPaid,centerDebt,assessment:a,support:S.geometry(p.state.board,{notches:notch.pattern}).supportEstimate,scoringDebt:scoringDebt(p.state.board,notch.pattern.anchorRow)});
   }
  }
  reachedDepth=d+1;
  next.sort((a,b)=>Number(b.capPaid||false)-Number(a.capPaid||false)||b.parities.length-a.parities.length||a.scoringDebt-b.scoringDebt||b.support-a.support||a.assessment.maxHeight-b.assessment.maxHeight);
  const seen=new Set();beam=next.filter(n=>{const k=JSON.stringify([n.state.board,n.state.active,n.state.hold,n.state.queue,n.parities,n.capPaid,n.centerDebt]);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,width);
 }
 return miss(incomplete?'bounded-search-incomplete':'no-certificate-in-bounded-beam');
}
return Object.freeze({validateCertificate,search,stagePlacements});
});
