/* A visible two-T Left foundation stage, not a complete Reset. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),()=>require('./st-planner')):factory(root.STRules,root.STStructure,()=>root.STPlanner);if(typeof module==='object'&&module.exports)module.exports=api;else root.STLeftFoundation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,getPlanner){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const parity=board=>board.reduce((n,row,y)=>n+[...row.slice(0,4)].reduce((v,c,x)=>v+(c==='.'?0:(x+y)%2?1:-1),0),0);
function leftCovered(board){let count=0;for(let x=0;x<4;x++){let roof=false;for(let y=0;y<40;y++){if(board[y][x]!=='.')roof=true;else if(roof)count++;}}return count;}
function deficits(board,pattern){const out=[];for(const y of [pattern.anchorRow,pattern.anchorRow+1])if(y>=0&&y<40)for(let x=0;x<4;x++)if(board[y][x]==='.')out.push([x,y]);return out;}
function eligibility(state){
 const P=getPlanner(),pattern=S.notchPattern(state.board),g=S.geometry(state.board,{notches:pattern}),a=P.assess(state.board);
 if(pattern.status!=='established'||pattern.anchorRow>=39||g.right.shapeStatus!=='staggered-scoring-wall'||g.right.completions.length||g.right.cycle.prepareColumn!==null||g.right.cycle.cleanupColumns.length)return null;
 if(g.center.patternSupport!=='reference-supported'||g.center.status==='unrecognized'||S.centerFoundation(state.board,pattern).vacancies.length||parity(state.board)!==0||leftCovered(state.board)||a.maxHeight>=20)return null;
 const cells=deficits(state.board,pattern);if(!cells.length||cells.length>8||[state.active?.type,state.hold,...state.queue].filter(x=>x==='T').length<2)return null;
 return{pattern,cells,maxHeight:a.maxHeight,center:g.center};
}
function validate(initial,steps,options={}){
 const P=getPlanner(),now=options.now||(()=>Date.now()),started=now(),deadline=options.deadline??started+(options.timeMs??150),limit=options.maxNodes??12000;let visited=0;
 const fail=reason=>({valid:false,status:'uncertified',reason,visited,elapsedMs:now()-started});
 let state;try{state=P.observe(initial);}catch{return fail('invalid-observation');}
 if(R.validate(state).length||state.queue.length>6||!Array.isArray(steps)||steps.length!==2)return fail('two-public-locks-required');
 const g=eligibility(state);if(!g)return fail('observed-left-foundation-deficit-required');
 if(now()>=deadline||limit<=0)return fail('budget-exhausted');
 // Reject even a geometric immediate scoring opportunity. This conservative
 // subset never spends the pair instead of an already available double.
 if(P.assess(state.board).right.slots.length)return fail('immediate-scoring-opportunity-or-unknown');
 const original=state.board.slice(),verified=[];let notches=g.pattern;
 for(const [i,step]of steps.entries()){
  if(now()>=deadline)return fail('budget-exhausted');
  if(!Array.isArray(step?.witness)||step.witness.length>256||step.witness.at(-1)!=='HD')return fail('bounded-witness-required');
  const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return fail('invalid-witness');const event=r.events[0];
  if(event.type!=='T'||event.lines||event.topOut||!event.cells.every(([x])=>x<4))return fail('two-left-T-locks-required');
  const n=S.advanceNotches(state.board,{state:r.state,event},notches);if(!n.valid)return fail('changed-scoring-pattern');
  const transition=S.transition(state,{state:r.state,event},S.assess(r.state,{notches:n.pattern}),{notches});
  if(transition.cycleViolations.some(v=>v!=='spent-scoring-T-without-double'))return fail('competing-cycle-obligation');
  if(P.cavityRepairDebt(P.assess(state.board),P.assess(r.state.board),event).length)return fail('new-internal-seal');
  if(r.state.board.some((row,y)=>row.slice(4)!==original[y].slice(4)))return fail('center-or-right-changed');
  if(i===0&&Math.abs(parity(r.state.board))!==2)return fail('first-T-must-establish-balanced-pair-obligation');
  verified.push({witness:step.witness.slice(),event:clone(event),structuralEvidence:transition});state=r.state;notches=n.pattern;
 }
 if(parity(state.board)!==0||leftCovered(state.board)||g.cells.some(([x,y])=>state.board[y][x]==='.')||P.assess(state.board).maxHeight>g.maxHeight)return fail('left-foundation-goal-unpaid');
 const access=P.checkAccessPrefix(P.observe(initial),verified,{notches:g.pattern,deadline,now,maxNodes:Math.max(0,limit-visited)});visited+=access.visited;if(access.reachable!==true)return fail('movement-access-unverified');
 verified[1].structuralEvidence={...verified[1].structuralEvidence,leftFoundation:{completed:true,cells:clone(g.cells)}};
 return{valid:true,status:'finite-left-foundation-stage',continuation:verified,end:state,targets:g.cells,visited,elapsedMs:now()-started,limitations:['Only two actual visible T locks are certified.','The Center/Right are preserved, not necessarily completed.','No future T, scoring clear, full opening or Reset is promised.']};
}
function search(initial,roots,options={}){
 const P=getPlanner(),now=options.now||(()=>Date.now()),deadline=options.deadline??now()+100,limit=options.maxNodes??12000;let visited=0;
 const state=P.observe(initial),g=eligibility(state);if(!g||!options.rootComplete||roots.some(p=>p.event.lines===4||p.event.type==='T'&&p.event.lines===2&&p.event.spin==='full'))return{candidate:null,visited};
 const hits=p=>p.event.cells.filter(([x,y])=>g.cells.some(([a,b])=>a===x&&b===y)).length;
 const firsts=[...new Map(roots.slice().sort((a,b)=>b.witness.length-a.witness.length).filter(p=>p.event.type==='T'&&!p.event.lines&&p.event.cells.every(([x])=>x<4)).map(p=>[JSON.stringify([p.state.board,p.state.active,p.state.hold,p.state.canHold,p.state.queue,p.state.bag]),p])).values()].sort((a,b)=>leftCovered(a.state.board)-leftCovered(b.state.board)||hits(b)-hits(a));const candidates=[];
 for(const first of firsts.slice(0,8)){
  if(now()>=deadline||visited>=limit)break;
  const prefix=first.state.active?.type==='T'?[]:['HOLD'],secondState=prefix.length?R.move(first.state,'HOLD'):first.state;if(secondState.active?.type!=='T'||secondState.topOut)continue;
  const e=R.placements(secondState,{allowHold:false,deadline,now,maxNodes:Math.max(0,limit-visited)});visited+=e.visited;
  for(const second of e.placements){if(second.event.type!=='T'||second.event.lines||!second.event.cells.every(([x])=>x<4))continue;
   const end=second.state,a=P.assess(end.board);if(parity(end.board)||leftCovered(end.board)||a.maxHeight>g.maxHeight||g.cells.some(([x,y])=>end.board[y][x]==='.'))continue;
   candidates.push({steps:[{witness:first.witness},{witness:[...prefix,...second.witness]}],roughness:a.left.roughness,cost:first.witness.length+prefix.length+second.witness.length});
  }
  if(candidates.length)break;
 }
 for(const c of candidates.sort((a,b)=>a.roughness-b.roughness||a.cost-b.cost)){
  if(now()>=deadline||visited>=limit)break;
  const proof=validate(state,c.steps,{deadline,now,maxNodes:limit-visited});visited+=proof.visited;
  if(proof.valid)return{candidate:{origin:clone(state),steps:c.steps,consumed:0,kind:'left-foundation'},proof,visited};
 }
 return{candidate:null,visited};
}

// A separate finite support-first construction, not an ordinary I diversion.
// Its exact visible replacement I must pay the original Right preparation.
function supportEligibility(raw){
 const P=getPlanner();let state;try{state=P.observe(raw);}catch{return null;}
 if(R.validate(state).length||state.queue.length>6||!state.active||state.topOut)return null;
 const g=S.geometry(state.board),a=P.assess(state.board),pattern=S.notchPattern(state.board);
 if(pattern.status!=='established'||g.right.cycle.prepareColumn===null||g.right.cycle.cleanupColumns.length||leftCovered(state.board)||a.maxHeight>=20||!a.regionalSupport)return null;
 if([state.active.type,state.hold,...state.queue].filter(t=>t==='I').length<2)return null;
 const heights=a.heights.slice(0,4),columns=[];
 for(let x=0;x<4;x++)if(heights[x]+4<=Math.max(...heights)&&[x-1,x+1].some(y=>y>=0&&y<4&&heights[y]>=heights[x]+4))columns.push(x);
 if(!columns.length)return null;
 return{state,pattern,columns,prepareColumn:g.right.cycle.prepareColumn,maxHeight:a.maxHeight};
}
function supportFirst(before,p,g){
 const P=getPlanner(),e=p.event;
 return e.type==='I'&&!e.lines&&!e.topOut&&e.cells.length===4&&e.cells.every(([x])=>x===e.cells[0][0]&&g.columns.includes(x))&&leftCovered(p.state.board)===0&&P.assess(p.state.board).maxHeight<=g.maxHeight&&p.state.board.every((row,y)=>row.slice(4)===before.board[y].slice(4));
}
// Actual-pose cap availability, not a hypothetical Z spawn. Each attempted
// HOLD and completion witness consumes the same construction proof budget.
function supportCapAvailability(state,spend){
 const starts=[state];let held=state;
 for(let i=0;i<2;i++){
  if(!spend(1))return null;
  const next=R.move(held,'HOLD');if(next===held||next.topOut)break;
  starts.push(next);held=next;
 }
 for(const from of starts){
  if(from.active?.type!=='Z')continue;
  for(const cap of S.geometry(from.board).right.completions){
   if(!spend(cap.witness.length))return null;
   const replay=R.replay(from,cap.witness),event=replay.events?.[0];
   if(replay.valid&&replay.events.length===1&&event.type==='Z'&&!event.lines&&!event.topOut&&event.cells.length===cap.cells.length&&event.cells.every(([x,y])=>cap.cells.some(([cx,cy])=>x===cx&&y===cy)))return true;
  }
 }
 return false;
}
function supportValidate(initial,steps,options={}){
 const P=getPlanner(),now=options.now||(()=>Date.now()),started=now(),deadline=options.deadline??started+(options.timeMs??150),limit=options.maxNodes??12000;let visited=0;
 const fail=reason=>({valid:false,status:'uncertified',reason,visited,elapsedMs:now()-started});
 const g=supportEligibility(initial);if(!g)return fail('observed-support-and-distinct-visible-I-required');
 if(!Array.isArray(steps)||steps.length<2||steps.length>Math.min(7,g.state.queue.length+1))return fail('bounded-visible-support-route-required');
 let state=g.state,notches=g.pattern;const original=state.board.slice(),verified=[];
 const spend=n=>{if(now()>=deadline||visited+n>limit)return false;visited+=n;return true;};
 for(let i=0;i<steps.length;i++){
  const step=steps[i];if(!Array.isArray(step?.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||step.witness.slice(0,-1).includes('HD'))return fail('bounded-one-lock-witness-required');
  const availableCap=supportCapAvailability(state,spend);if(availableCap===null||!spend(step.witness.length))return fail('budget-exhausted');
  const r=R.replay(state,step.witness);if(!r.valid||r.events.length!==1)return fail('invalid-visible-witness');const event=r.events[0],p={state:r.state,event,availableCap};
  if(event.topOut||event.lines)return fail('nonclearing-support-and-preparation-only');
  const phase=S.advanceNotches(state.board,p,notches);if(!phase.valid)return fail('changed-scoring-pattern');
  const transition=S.transition(state,p,S.assess(r.state,{notches:phase.pattern}),{notches});
  if(transition.cycleViolations.some(v=>!(i===0&&v==='spent-cleanup-I-on-optional-work')))return fail('competing-cycle-obligation');
  if(i===0){if(!supportFirst(state,p,g))return fail('first-I-must-fill-open-Left-support');}
  else if(i===steps.length-1){
   if(event.type!=='I'||!event.cells.every(([x])=>x===g.prepareColumn)||transition.allocation!=='quad-preparation')return fail('visible-replacement-I-must-pay-original-Right');
   if(r.state.board.some((row,y)=>row.slice(0,7)!==state.board[y].slice(0,7)))return fail('replacement-changed-Left-or-Center');
  }else if(['I','T','Z'].includes(event.type)||!event.cells.every(([x])=>x<4))return fail('intermediate-Left-fillers-only');
  if(i<steps.length-1&&r.state.board.some((row,y)=>row.slice(4)!==original[y].slice(4)))return fail('Center-or-Right-changed-before-replacement');
  if(leftCovered(r.state.board)||P.assess(r.state.board).maxHeight>=20||P.cavityRepairDebt(P.assess(state.board),P.assess(r.state.board),event).length)return fail('unpaid-Left-cover-or-seal');
  verified.push({witness:step.witness.slice(),event:clone(event),structuralEvidence:transition});state=r.state;notches=phase.pattern;
 }
 if(!P.assess(state.board).regionalSupport)return fail('unsupported-endpoint');
 const access=P.checkAccessPrefix(g.state,verified,{notches:g.pattern,deadline,now,maxNodes:Math.max(0,limit-visited)});visited+=access.visited;if(access.reachable!==true||now()>=deadline||visited>limit)return fail('movement-access-unverified');
 const support=verified[0].event.cells,payment=verified.at(-1).event.cells;
 verified[0].structuralEvidence={...verified[0].structuralEvidence,leftSupport:{completed:true,cells:clone(support),replacementAt:steps.length,replacementCells:clone(payment)}};
 return{valid:true,status:'finite-Left-support-with-Right-I-replacement',continuation:verified,end:state,targets:support,replacementCells:payment,visited,elapsedMs:now()-started,limitations:['Only the originally visible route is certified.','The first I fills support; a distinct actual I pays Right preparation.','No score or indefinite survival is promised.']};
}
function supportSearch(initial,options={}){
 const P=getPlanner(),now=options.now||(()=>Date.now()),deadline=options.deadline??now()+150,limit=options.maxNodes??12000,g=supportEligibility(initial);let visited=0;
 const result=candidate=>({candidate,visited});if(!g||options.allowHold===false)return result(null);
 const spend=n=>{if(now()>=deadline||visited+n>limit)return false;visited+=n;return true;};
 // Solid Left routes need no speculative tuck search. Every generated move is
 // still replayed from the actual pose/HOLD and charged to the shared budget.
 const moves=state=>{const out=[],seen=new Set();for(const hold of [[],['HOLD']]){
  if(!spend(hold.length))return out;const held=R.replay(state,hold);if(!held.valid||!held.state.active||held.state.topOut)continue;
  if(['T','Z'].includes(held.state.active.type))continue;
  for(let turns=0;turns<4;turns++){
   let rotated=held.state,rotationWitness=hold.slice(),valid=true;
   for(let n=0;n<turns;n++){if(!spend(1))return out;const next=R.move(rotated,'CW');if(next===rotated){valid=false;break;}rotated=next;rotationWitness.push('CW');}if(!valid)continue;
   for(let x=-2;x<=8;x++){
    const cells=R.cells({...rotated.active,x});if(!cells.every(([cx])=>cx>=0&&cx<4)&&!(rotated.active.type==='I'&&cells.every(([cx])=>cx===g.prepareColumn)))continue;
    let cur=rotated,witness=rotationWitness.slice();valid=true;
    while(cur.active.x!==x){if(!spend(1))return out;const action=cur.active.x<x?'R':'L',next=R.move(cur,action);if(next===cur){valid=false;break;}cur=next;witness.push(action);}if(!valid)continue;
    witness.push('HD');if(!spend(witness.length))return out;
    const r=R.replay(state,witness);if(!r.valid||r.events.length!==1||r.events[0].lines||r.events[0].topOut)continue;
    const key=JSON.stringify([r.state.board,r.state.active,r.state.hold,r.state.queue]);if(seen.has(key))continue;seen.add(key);out.push({state:r.state,event:r.events[0],witness});
   }
  }
 }return out;};
 const firsts=moves(g.state).filter(p=>supportFirst(g.state,p,g));let layer=firsts.map(p=>({state:p.state,path:[{witness:p.witness}],notches:g.pattern}));
 const rank=n=>{const h=P.assess(n.state.board).heights.slice(0,4);return Math.max(...h)*4+h.slice(1).reduce((v,x,i)=>v+Math.abs(x-h[i]),0);};
 for(let depth=2;depth<=Math.min(7,g.state.queue.length+1)&&layer.length&&now()<deadline&&visited<limit;depth++){
  const next=[],seen=new Set();for(const n of layer){for(const p of moves(n.state)){
   const steps=[...n.path,{witness:p.witness}],phase=S.advanceNotches(n.state,p,n.notches);if(!phase.valid)continue;
   const transition=S.transition(n.state,p,S.assess(p.state,{notches:phase.pattern}),{notches:n.notches});if(transition.cycleViolations.length)continue;
   if(p.event.type==='I'&&p.event.cells.every(([x])=>x===g.prepareColumn)&&transition.allocation==='quad-preparation'){
    const proof=supportValidate(g.state,steps,{deadline,now,maxNodes:Math.max(0,limit-visited)});visited+=proof.visited;if(proof.valid)return result({kind:'left-support',origin:clone(g.state),steps,consumed:0});
   }
   if(p.event.type==='I'||!p.event.cells.every(([x])=>x<4)||leftCovered(p.state.board)||P.assess(p.state.board).maxHeight>=20||p.state.board.some((row,y)=>row.slice(4)!==g.state.board[y].slice(4)))continue;
   const key=JSON.stringify([p.state.board,p.state.active,p.state.hold,p.state.queue]);if(seen.has(key))continue;seen.add(key);next.push({state:p.state,path:steps,notches:phase.pattern});
  }if(now()>=deadline||visited>=limit)break;}
  layer=next.sort((a,b)=>rank(a)-rank(b)||JSON.stringify(a.path).localeCompare(JSON.stringify(b.path))).slice(0,8);
 }
 return result(null);
}
return Object.freeze({eligibility,validate,search,parity,leftCovered,deficits,supportEligibility,supportValidate,supportSearch});
});
