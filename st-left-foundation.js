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
return Object.freeze({eligibility,validate,search,parity,leftCovered,deficits});
});
