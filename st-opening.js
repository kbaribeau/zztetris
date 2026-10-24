/* Bounded opening construction, distinct from established-stack maintenance.
 * Only actual board, active/hold and six public previews enter this search. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-paired-repair'),()=>require('./st-planner')):factory(root.STRules,root.STStructure,root.STPairedRepair,()=>root.STPlanner);if(typeof module==='object'&&module.exports)module.exports=api;else root.STOpening=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,X,getPlanner){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function balance(board){let n=0;for(let y=0;y<40;y++)for(let x=0;x<4;x++)if(board[y][x]!=='.')n+=(x+y)%2?1:-1;return n;}
function features(board){
 const h=Array.from({length:10},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
 const max=Math.max(...h),left=h.slice(0,4),center=h.slice(4,7);
 let mass=0,covered=0,leftCovered=0,channel=0;for(let y=40-max;y<40;y++)for(let x=0;x<10;x++){if(board[y][x]!=='.')mass++;else if(y>=40-h[x]){covered++;if(x<4)leftCovered++;}if(x===7&&board[y][x]!=='.')channel++;}
 let scoringDebt=0;const anchored=S.notchPattern(board);if(anchored.status==='established'&&anchored.anchorRow<39){for(const y of [anchored.anchorRow,anchored.anchorRow+1])for(let x=0;x<7;x++)if(!(x===6&&y===anchored.anchorRow)&&board[y][x]==='.')scoringDebt++;}
 const parity=balance(board),rough=left.slice(1).reduce((n,v,i)=>n+Math.abs(v-left[i]),0);
 // Distance to a two-filled/one-open column-seven wall, choosing no phase
 // until actual right geometry anchors it. This is ranking, never a certificate.
 const notch=S.notchPattern(board);let grammar=Infinity;
 const phases=notch.status==='established'?[((39-notch.anchorRow)%3+3)%3]:[0,1,2];
 for(const phase of phases){let bad=0;for(let k=0;k<Math.min(...center);k++){const y=39-k;if(board[y][4]==='.')bad++;if(board[y][5]==='.')bad++;if((board[y][6]==='.')!==(k%3===phase))bad++;}grammar=Math.min(grammar,bad);}
 let baseDebt=0;for(let y=(notch.status==='established'?notch.anchorRow+1:38);y<40;y++)for(let x=4;x<7;x++)if(board[y][x]==='.')baseDebt++;
 let foundationDebt=0;const top=Math.max(...center),level=notch.status==='established'?39-notch.anchorRow:2,target=Math.max(level,level+3*Math.ceil((top-level)/3));for(let k=0;k<target;k++)for(let x=4;x<=6;x++){const expected=x<6||!notch.protectedRows.includes(39-k);if(expected&&board[39-k][x]==='.')foundationDebt++;}
 return{baseDebt,foundationDebt,scoringDebt,heights:h,maxHeight:max,left,center,mass,covered,leftCovered,channel,parity,roughness:rough,grammar:Number.isFinite(grammar)?grammar:0,notches:notch};
}
function foundationAccess(board,f){
 const missing=[];for(let y=f.notches.anchorRow+1;y<40;y++)for(let x=4;x<7;x++)if(board[y][x]==='.')missing.push([x,y]);
 if(!missing.length)return 2;if(missing.length>4||f.notches.status!=='established')return 0;
 for(const type of 'IJLOSZ')for(let rotation=0;rotation<4;rotation++)for(let x=-1;x<7;x++)for(let y=34;y<39;y++){
  const a={type,x,y,rotation},cells=R.cells(a);
  if(cells.some(([cx,cy])=>cx>=7||cx===6&&f.notches.protectedRows.includes(cy)))continue;
  if(!missing.every(([mx,my])=>cells.some(([cx,cy])=>cx===mx&&cy===my)))continue;
  if(R.fits(board,a)&&!R.fits(board,{...a,y:y+1}))return 1;
 }
 return -1;
}
function facts(board){const f=features(board),g=S.geometry(board);return{...f,centerStatus:g.center.status,centerPartners:g.center.completions.filter(c=>c.resultStatus==='level').map(c=>({piece:c.piece,cells:c.cells})),right:g.right.shapeStatus};}
function compare(a,b){for(let i=0;i<a.rank.length;i++){if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return a.key.localeCompare(b.key);}
function rank(f,event,path){
 const low=Math.min(...f.heights.slice(0,7)),high=Math.max(...f.heights.slice(0,7));
 const centerSpan=Math.max(...f.center)-Math.min(...f.center),gap=Math.abs(Math.max(...f.left)-Math.max(...f.center));
 const score=path.reduce((n,p)=>n+p.event.lines,0);
 const board=path.at(-1).board,g=S.geometry(board),foundation=foundationAccess(board,f),centerQuality=g.center.status==='unrecognized'?-4:g.center.patternSupport==='reference-supported'?(g.center.status==='level'?2:1):-2;
 return[-f.channel,-f.leftCovered,foundation<0?-1:0,-(Math.abs(f.parity)%2),
  -Math.max(0,Math.abs(f.parity)-2),
  centerQuality*3-f.baseDebt*15-f.foundationDebt*5-f.grammar*8-f.scoringDebt*3+score*8+Math.min(low,5)*3-Math.abs(f.parity)*3-f.roughness*1.2-centerSpan*2-Math.max(0,gap-2)*3-f.maxHeight*.8-f.covered,
  -Math.abs(f.parity),-path.reduce((n,p)=>n+p.witness.length,0)];
}
function startSession(raw,{emptyMode=false}={}){
 const a=getPlanner().assess(raw.board),empty=raw.board.every(r=>r==='..........');
 // Low imported foundations are eligible, but do not hijack the established
 // low-center paired-T recovery or classify arbitrary tall unknown boards.
 return{active:Boolean(emptyMode||empty||(!a.maintenanceScope&&a.maxHeight<=4&&a.left.height<2)),clear:null};
}
function updateSession(session,before,after,event){
 if(!session?.active)return{active:false,clear:null};
 return{active:true,clear:event?.lines&&S.canonicalClear(event)?{before:clone(before),event:clone(event)}:null};
}
function acceptResult(session,result){return session?.active&&result?.phase==='maintenance'&&result?.evidence?.openingHandoff?{active:false,clear:null}:session;}
function handoff(state,proof,options){
 const P=getPlanner();if(!proof?.before||!proof.event)return null;
 let before;try{before=P.observe(proof.before);}catch{return null;}
 if(R.validate(before).length)return null;
 const r=R.replay(before,['HD']),event=r.events[0];
 if(!r.valid||r.events.length!==1||JSON.stringify(event)!==JSON.stringify(proof.event)||!event.lines||!S.canonicalClear(event))return null;
 if(JSON.stringify(r.state.board)!==JSON.stringify(state.board)||r.state.active?.type!==state.active?.type||r.state.hold!==state.hold||r.state.canHold!==state.canHold||r.state.queue.some((t,i)=>state.queue[i]!==t))return null;
 const f=facts(state.board),a=P.assess(state.board);
 if(f.parity!==0||S.geometry(state.board).center.patternSupport!=='reference-supported'||f.centerStatus==='unrecognized'||f.notches.status!=='established'||!a.regionalSupport||a.leftSealed)return null;
 const now=options.now??(()=>Date.now()),deadline=options.deadline??Infinity;
 if(now()>=deadline)return null;
 const result=P.plan(state,{...options,disableOpening:true,openingPhase:false,openingClear:null,previous:null,commitment:null,constructionPrevious:null,maxNodes:Math.min(12000,options.maxNodes??45000),deadline:Math.min(deadline,now()+200)});
 if(!result?.target)return null;
 return{...result,phase:'maintenance',evidence:{...result.evidence,openingHandoff:{status:'checked-after-actual-clear',event:clone(event),balance:f.parity}},reason:'Opening handoff checked after the clear. '+result.reason};
}
function plan(raw,options={}){
 const P=getPlanner(),now=options.now??(()=>Date.now()),started=now(),deadline=options.deadline??started+(options.timeMs??750);
 const limit=Math.min(45000,Math.max(0,options.maxNodes??45000)),width=Math.min(10,Math.max(1,options.openingWidth??6)),depth=Math.min(4,Math.max(1,options.openingDepth??3));
 let state;try{state=P.observe(raw);}catch{return null;}
 const base={status:'no-supported-continuation-found',revision:state.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],phase:'opening',reason:'No checked opening construction was found within this search. You can continue manually.',metrics:{nodes:0,depth:0,completeDepth:0,elapsedMs:0},sources:[]};
 if(R.validate(state).length||state.queue.length>6||!state.active||state.topOut)return base;
 const accepted=handoff(state,options.openingClear,{...options,deadline});if(accepted)return accepted;
 // Reserve the complete handoff allowance even when an attempt abstains.
 const reserved=options.openingClear?Math.min(12000,limit):0;base.metrics.handoffReservedNodes=reserved;
 const initial=P.assess(state.board),initialFacts=facts(state.board);
 if(initial.maxHeight>=20||initialFacts.notches.status==='broken')return{...base,reason:'This opening needs a repair outside the supported construction search.'};
 let beam=[{state,path:[],f:initialFacts,notches:initialFacts.notches,key:'',rank:[]}],best=null,stopped=false;
 for(let d=0;d<depth;d++){
  const nodes=[];
  for(const parent of beam){
   if(now()>=deadline||base.metrics.nodes+reserved>=limit){stopped=true;break;}
   const enumDeadline=performance.now()+Math.max(0,deadline-now());
   const e=X.stagePlacements(parent.state,{deadline:enumDeadline,maxNodes:Math.min(2500,limit-reserved-base.metrics.nodes)});base.metrics.nodes+=e.visited;if(!e.envelopeComplete)stopped=true;
   for(const p of e.placements){
    if(now()>=deadline){stopped=true;break;}
    if(p.state.topOut||!p.state.active||!S.canonicalClear(p.event))continue;
    if(p.event.type==='T'&&!p.event.lines&&!p.event.cells.every(([x])=>x<4))continue;
    // Only right scoring clears belong to this initial canonical ST subset.
    if(p.event.lines&&!p.event.cells.some(([x])=>x>=7))continue;
    if(!p.event.lines&&p.event.cells.some(([x])=>x>=7)){
     if(p.event.type==='I'){const cycle=S.geometry(parent.state.board).right.cycle;if(cycle.prepareColumn===null||!p.event.cells.every(([x])=>x===cycle.prepareColumn))continue;}
     else if(p.event.type!=='Z'||!p.event.cells.every(([x])=>x>=8))continue;
    }
    const notch=S.advanceNotches(parent.state.board,p,parent.notches);if(!notch.valid)continue;
    const f=features(p.state.board);if(f.maxHeight>=20||f.channel>parent.f.channel)continue;
    const after=P.assess(p.state.board),before=P.assess(parent.state.board);
    if(P.cavityRepairDebt(before,after,p.event).length)continue;
    const step={board:p.state.board,target:p.event.target,witness:p.witness,event:p.event,hold:p.witness.includes('HOLD'),holdCount:p.witness.filter(a=>a==='HOLD').length};
    const path=[...parent.path,step],key=JSON.stringify([p.state.board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')),p.state.active?.type,p.state.hold,p.state.queue,notch.pattern]);
    nodes.push({state:p.state,path,f,notches:notch.pattern,key,rank:rank(f,p.event,path)});
   }
  }
  if(!nodes.length)break;
  const unique=[...new Map(nodes.sort(compare).reverse().map(n=>[n.key,n])).values()].sort(compare);
  best=unique[0];base.metrics.depth=d+1;if(!stopped)base.metrics.completeDepth=d+1;
  base.metrics.enumeration='reduced-stage-envelope-not-exhaustive';
  // Keep different first-piece/region/parity families alive, not just adjacent
  // poses of one greedy foundation. This does not make enumeration exhaustive.
  const chosen=[],groups=new Set();for(const n of unique){const e=n.path[0].event,g=[e.type,Math.floor(e.cells.reduce((s,c)=>s+c[0],0)/4/4),Math.sign(n.f.parity)].join(':');if(!groups.has(g)){chosen.push(n);groups.add(g);if(chosen.length>=width)break;}}
  for(const n of unique)if(chosen.length<width&&!chosen.includes(n))chosen.push(n);
  beam=chosen;if(stopped)break;
 }
 base.metrics.elapsedMs=now()-started;
 if(!best)return{...base,status:stopped?'budget-exhausted':base.status};
 const first=best.path[0],end=facts(best.state.board),hold=first.holdCount===2?'Hold twice. ':first.holdCount?'Hold once. ':'';
 const region=first.event.cells.every(([x])=>x<4)?'Left':first.event.cells.every(([x])=>x>=4&&x<7)?'Center':first.event.cells.every(([x])=>x>=7)?'Right':'foundation';
 const pending=[];if(end.parity)pending.push(`Left mino balance is ${end.parity>0?'+':''}${end.parity}; its repair is not yet proved`);if(end.centerStatus!=='level')pending.push('the Center is still under construction');
 const reason=hold+(first.event.lines?`Take the checked ${first.event.lines===4?'Tetris':'T-spin double'} while building the opening.`:`Place ${first.event.type} in the ${region} to build the ST opening.`)+` Checked ${best.path.length} legal placement${best.path.length===1?'':'s'} using only visible pieces. `+(pending.length?pending.join('; ')+'. ':'This prefix has balanced Left minos and a level Center. ')+ 'This is partial construction, not a completed opening or proof of future piece availability.';
 const sources=[{id:'SHOCKY-OPENING',label:"Shocky's ST Stacking Guide",url:'https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',section:'Chapters 1–4: regions, construction and mino parity',scope:'Community background for opening construction. The coach checks this finite prefix; the guide does not certify this exact move or future availability.'}];
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation:best.path,reason,sources,assessment:P.assess(best.state.board),evidence:{opening:{status:'partial-construction',initial:initialFacts,endpoint:end,unresolved:pending},knownPieceHorizon:state.queue.length+1}};
}
return Object.freeze({balance,features,facts,handoff,plan,startSession,updateSession,acceptResult});
});
