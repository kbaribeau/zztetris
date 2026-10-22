/* Small, explicit ST regional grammar. Positive local evidence, never a proof
 * that an unrecognized position is impossible. No fixture IDs or hidden stream. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js')):factory(root.STRules,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STStructure=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B){
'use strict';
const cache=new Map(),clone=x=>JSON.parse(JSON.stringify(x));
const heights=board=>Array.from({length:10},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
const rough=p=>p.slice(1).reduce((n,h,i)=>n+Math.abs(h-p[i]),0);
// Positive three-row center motifs observed in the two existing Fumen sources.
// Local occupancy only: no board height, left/right state, fixture ID or move
// sequence. Unknown motifs remain legal; this is a deliberately small grammar.
const CENTER_MOTIFS=new Set(['###/###/##.','.##/##./###','#../###/##.','..#/.##/.#.','.#./.##/###','.##/.##/.#.','##./##./###','###/##./###','.##/###/###','#../#../##.','.#./.#./.##','.#./##./###','.#./###/###','.#./.##/.##','..#/..#/###','..#/###/###']);
function centerMotif(board){const rows=board.map(r=>r.slice(4,7).replace(/[^.]/g,'#')),top=rows.findIndex(r=>r!=='...');return top<0?'empty':rows.slice(top,top+3).join('/');}

function covered(board,cols){const h=heights(board);let n=0;for(const x of cols)for(let y=40-h[x];y<40;y++)if(board[y][x]==='.')n++;return n;}
// Count genuinely sealed voids separately from covered but side-accessible
// scoring cavities. Air reachability is necessary, not sufficient, piece access.
function sealed(board,cols){const top=Math.max(0,39-Math.max(...heights(board))),seen=new Uint8Array(400),q=[];for(let x=0;x<10;x++)if(board[top][x]==='.') {seen[top*10+x]=1;q.push(top*10+x);}
 for(let i=0;i<q.length;i++){const n=q[i],x=n%10,y=Math.floor(n/10);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*10+xx;if(xx>=0&&xx<10&&yy>=top&&yy<40&&!seen[k]&&board[yy][xx]==='.') {seen[k]=1;q.push(k);}}}
 let n=0;for(const x of cols)for(let y=top;y<40;y++)if(board[y][x]==='.'&&!seen[y*10+x])n++;return n;}
// Straight-drop witnesses from a hypothetical fresh piece. The actual active
// pose and the order in which this piece becomes available are checked by search.
function completions(board,lo,hi,pieces){const h0=heights(board),protectedCols=lo===4?[4,5]:[0,1,2,3],out=[],seen=new Set();
 for(const piece of pieces)for(let rotation=0;rotation<4;rotation++){
  const offsets=R.cells({type:piece,x:0,y:0,rotation}),minX=Math.min(...offsets.map(c=>c[0])),maxX=Math.max(...offsets.map(c=>c[0]));
  for(let x=lo-minX;x<=hi-maxX;x++){
   // A straight drop lands above the first occupied cell of each touched
   // column. Check inexpensive height/void invariants before executing a path.
   const y=Math.min(...offsets.map(([dx,dy])=>40-h0[x+dx]-dy-1)),cells=offsets.map(([dx,dy])=>[x+dx,y+dy]);
   if(y<0)continue;const h=h0.slice();for(const[cx,cy]of cells)h[cx]=Math.max(h[cx],40-cy);
   const profile=h.slice(lo,hi+1),level=new Set(profile).size===1;
   const nextSL=lo===4&&profile[0]+1===profile[1]&&profile[1]===profile[2];
   // A non-level repair must fill an existing deep left deficit, not merely
   // add arbitrary surface filler. Keep every new cell below the old peak
   // and improve a column at least three rows below it without roofing holes.
   const oldPeak=Math.max(...h0.slice(lo,hi+1));
   const partialRepair=lo===0&&!level&&cells.every(([,cy])=>40-cy<=oldPeak)&&
    protectedCols.some(cx=>oldPeak-h0[cx]>=3&&h[cx]>h0[cx])&&rough(profile)<rough(h0.slice(lo,hi+1));
   if(!level&&!nextSL&&!partialRepair)continue;
   const addsCover=protectedCols.some(cx=>h[cx]-h0[cx]>cells.filter(c=>c[0]===cx).length);
   if(addsCover){if(lo!==4)continue;const projected=board.map(r=>r.split(''));for(const[cx,cy]of cells)projected[cy][cx]=piece;if(sealed(projected.map(r=>r.join('')),[4,5,6])>sealed(board,[4,5,6]))continue;}
   const key=cells.map(c=>c.join(',')).sort().join(';');if(seen.has(key))continue;
   let state=R.createState({board,active:piece,canHold:false});if(!R.fits(board,state.active))continue;const witness=[];
   const turn=rotation===1?'CW':rotation===2?'R180':rotation===3?'CCW':null;if(turn){const n=R.move(state,turn);if(n===state)continue;state=n;witness.push(turn);}
   while(state.active.x!==x){const action=state.active.x>x?'L':'R',n=R.move(state,action);if(n===state)break;state=n;witness.push(action);}
   if(state.active.x!==x)continue;const n=R.move(state,'HD'),e=n.lastEvent;
   if(!e||e.lines||e.topOut||e.target.rotation!==rotation||e.target.x!==x||e.target.y!==y)continue;
   seen.add(key);out.push({piece,family:lo===4?({S:'S–L',L:'S–L',O:'O–J',J:'O–J'}[piece]||null):null,target:e.target,cells:e.cells,witness:[...witness,'HD'],access:'hypothetical-spawn-straight-drop',resultProfile:h.slice(lo,hi+1),resultStatus:level?'level':partialRepair?'partial-repair':'SL-preparation-surface',patternSupport:lo!==4?null:CENTER_MOTIFS.has(centerMotif(n.board))?'reference-supported':'unrecognized',preserveCells:e.cells.map(c=>c.slice())});
  }
 }return out;
}
function geometry(board){const key=board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')).join('');if(cache.has(key))return cache.get(key);
 const h=heights(board),left=h.slice(0,4),center=h.slice(4,7),right=h.slice(7),flatLeft=new Set(left).size===1,flatCenter=new Set(center).size===1;
 const centerCompletions=flatCenter?[]:completions(board,4,6,'SLOJ');
 const leftCompletions=flatLeft?[]:completions(board,0,3,'IJLOSTZ');
 const centerInternal=sealed(board,[4,5,6]);const leftInternal=covered(board,[0,1,2,3]);
 const [channel,pedestal,cap]=right;const normalBase=channel===0;
 const rightShape=normalBase&&pedestal===0&&cap===0?'cleared-base':normalBase&&cap===0&&pedestal>0?'cap-preparation':normalBase&&cap===pedestal+1?'staggered-scoring-wall':'unrecognized';
 // Excess right-wall discontinuity creates an extra repair obligation. It is
 // evidence against the small grammar, not proof of an inaccessible T slot.
 const renewalDebt=rightShape==='unrecognized'?Math.max(1,channel+Math.abs(cap-pedestal-1)):0;
 const motif=centerMotif(board),motifSupported=CENTER_MOTIFS.has(motif);
 const centerStatus=flatCenter?'level':centerCompletions.some(c=>c.patternSupport==='reference-supported')?'supported-partner-completion':'unrecognized';
 // Regional maxima hide a deep well that prevents the scoring rows filling.
 // Permit a one-I-height offset; larger bottlenecks require concrete repair.
 const frontierDebt=Math.max(0,Math.max(...center)-Math.min(...left)-4);
 const scoringRowDebt=Math.max(0,Math.max(...right)-Math.min(...h.slice(0,7))-1);
 const g={frontierDebt,scoringRowDebt,left:{profile:left,flat:flatLeft,roughness:rough(left),covered:leftInternal,horizontalI:flatLeft?{status:'straight-drop-platform',columns:[1,2,3,4]}:null,completions:leftCompletions},center:{profile:center,status:centerStatus,motif,patternSupport:motifSupported?'reference-supported':'unrecognized',coveredInternal:centerInternal,sealedVoids:centerInternal,coveredCavities:covered(board,[4,5,6]),completionDebt:centerStatus==='unrecognized'?1:0,completions:centerCompletions},right:{profile:right,shapeStatus:rightShape,renewalDebt},supportEstimate:(flatLeft?2:0)-rough(left)*1.5-leftInternal*8+(motifSupported?(flatCenter?4:2):centerCompletions.some(c=>c.patternSupport==='reference-supported')?0:-8)-centerInternal*6-renewalDebt*6-frontierDebt*4-scoringRowDebt*3,uncertainty:rightShape==='unrecognized'||centerStatus==='unrecognized'||!motifSupported};
 if(cache.size>=2048)cache.clear();cache.set(key,g);return g;
}
function instances(state){const out=[];if(state.active)out.push({id:'active',piece:state.active.type,source:'active',available:'now'});if(state.hold)out.push({id:'hold',piece:state.hold,source:'hold',available:state.canHold?'hold-now':'after-next-lock'});(state.queue||[]).forEach((piece,i)=>out.push({id:'queue:'+i,piece,source:'visible',drawOffset:i+1,available:'when-drawn'}));if(state.bag){const p=B.forcedNext(state.bag);if(p)out.push({id:'forced-next',piece:p,source:'forced-beyond-preview',available:'after-preview'});}return out;}
function allocate(obligations,supply){const assignments=[],conflicts=[];let best=[];function walk(i,used,a){if(i===obligations.length){if(a.length>best.length)best=a.slice();return;}const o=obligations[i];for(const p of supply)if(!used.has(p.id)&&o.alternatives.includes(p.piece)){used.add(p.id);a.push({obligation:o.kind,instance:p.id,piece:p.piece});walk(i+1,used,a);a.pop();used.delete(p.id);}walk(i+1,used,a);}walk(0,new Set(),[]);assignments.push(...best);for(let i=0;i<obligations.length;i++)for(let j=i+1;j<obligations.length;j++){const a=supply.filter(p=>obligations[i].alternatives.includes(p.piece)),b=supply.filter(p=>obligations[j].alternatives.includes(p.piece));if(a.length&&b.length&&new Set([...a,...b].map(p=>p.id)).size<2)conflicts.push({obligations:[obligations[i].kind,obligations[j].kind],instances:[...new Set([...a,...b].map(p=>p.id))]});}return{assignments,conflicts,matched:best.length,timing:'Identity allocation only; arrival order and execution still require search.'};}
function assess(stateOrBoard){const state=Array.isArray(stateOrBoard)?{board:stateOrBoard}:stateOrBoard,g=clone(geometry(state.board)),obligations=[];
 if(g.center.completions.length)obligations.push({kind:'center-partner',alternatives:[...new Set(g.center.completions.map(c=>c.piece))],completions:g.center.completions,note:'Exact straight-drop completion of the current center surface; keep completion cells free.'});
 if(!g.left.flat&&g.left.completions.length)obligations.push({kind:'left-surface',alternatives:[...new Set(g.left.completions.map(c=>c.piece))],completions:g.left.completions,note:'Optional left-surface improvement, not a mandatory immediate fill.'});
 if(g.right.shapeStatus==='staggered-scoring-wall')obligations.push({kind:'scoring-cycle',alternatives:['T'],completions:[],note:'Normal scoring-wall shape; actual T-spin entry and line completion require execution verification.'});
 const supply=instances(state),allocation=allocate(obligations,supply);for(const o of obligations){o.supply=supply.filter(p=>o.alternatives.includes(p.piece));o.status=o.supply.length?'known-piece-identity':'future-supply-unresolved';}
 const center=obligations.find(o=>o.kind==='center-partner'),supplyBurden=!center?0:!center.supply.length?2:center.supply.some(p=>p.source==='active'||p.source==='hold')?0:center.supply.some(p=>p.source==='visible')?0.5:1;
 return{...g,centerCompletionDebt:g.center.completionDebt,supplyBurden,obligations,supply:{instances:supply,...allocation,conflictCount:allocation.conflicts.length},supportEstimate:g.supportEstimate-allocation.conflicts.length*3-supplyBurden,claim:'Local regional support estimate, not a sustainability guarantee.'};
}
function transition(before,p,afterStructure){const cells=p.event.cells,regions=[...new Set(cells.map(([x])=>x<4?'left':x<7?'center':'right'))],after=afterStructure||geometry(p.state.board),prior=geometry(before.board);let allocation='unrecognized-role',debt=0;
 const pure=regions.length===1?regions[0]:null,type=p.event.type;
 if(p.event.spin==='full'&&p.event.lines===2){allocation='scoring-double';}
 else if(type==='I'&&p.event.lines===4){allocation='quad-cleanup';}
 else if(pure==='left'&&type==='T'&&prior.right.shapeStatus==='staggered-scoring-wall'){allocation='scoring-T-diversion';debt+=6;}
 else if(pure==='left'){allocation='left-filler';if(type==='I'&&cells.every(([,y])=>y===cells[0][1]))allocation='horizontal-left-I';}
 else if(pure==='center'&&'SLOJ'.includes(type)&&(after.center.status!=='unrecognized'))allocation=after.center.status==='level'?'center-completion':'center-partner-preparation';
 else if(type==='Z'&&cells.every(([x])=>x>=7)){
  if(prior.right.shapeStatus==='staggered-scoring-wall'&&Math.max(...after.right.profile)>Math.max(...prior.right.profile)&&p.event.lines===0){allocation='right-cap-extension';debt+=3;}
  else allocation='right-cap-preparation';
 }
 else {debt+=regions.includes('right')?5:3;if(regions.includes('left')&&regions.includes('center'))debt+=3;}
 const newlyCovered=Math.max(0,after.left.covered-prior.left.covered)+Math.max(0,after.center.coveredInternal-prior.center.coveredInternal);
 const regionalRepair=Math.max(0,after.right.renewalDebt-prior.right.renewalDebt);
 const repaired=Math.max(0,prior.right.renewalDebt-after.right.renewalDebt)+Math.max(0,prior.left.covered-after.left.covered)+Math.max(0,prior.center.coveredInternal-after.center.coveredInternal);
 debt+=newlyCovered*3+regionalRepair*2-Math.min(8,repaired*2);
 const finish=prior.center.completions.find(c=>c.piece===type&&JSON.stringify(c.cells.slice().sort())===JSON.stringify(cells.slice().sort())),partner=after.center.completions.find(c=>({S:'L',L:'S',O:'J',J:'O'})[type]===c.piece);
 const pairFamily=pure==='center'?(partner?('SL'.includes(type)?'SL':'OJ'):finish?('SL'.includes(type)?'SL':'OJ'):null):null;
 if(finish&&pure==='center')allocation='center-completion';
 const reason=allocation==='horizontal-left-I'?'Keep the left region flat.':allocation==='center-partner-preparation'?'Prepare a center pattern with a checked '+[...new Set(after.center.completions.map(c=>c.piece))].join('/')+' completion.':allocation==='center-completion'?'Complete the center pattern.':allocation==='scoring-double'?'Take the T-spin double and assess its rebuild.':allocation==='scoring-T-diversion'?'Diverts a T from the scoring role; another T may remain, but its timely use is not established.':allocation==='quad-cleanup'?'Clear the scoring channel with a quad.':allocation==='unrecognized-role'?'This allocation needs additional regional repair evidence.':allocation==='right-cap-extension'?'Extends an existing cap; renewed entry still needs checking.':'Preserve a supported regional piece role.';
 return{reason,pairFamily,pairEvidence:pairFamily?(finish?'matches checked finishing placement':'actual preparation plus checked partner placement'):null,regions,crossRegion:regions.length>1,allocation,status:['unrecognized-role','scoring-T-diversion','right-cap-extension'].includes(allocation)?'requires-repair-evidence':'supported-local-role',dependencyDebt:debt,newlyCovered,regionalRepair,repairCredit:Math.min(8,repaired*2),note:'Crossing a boundary is not forbidden. Debt measures unsupported allocation and new structural repair burden; a later checked repair may repay it.'};
}
return Object.freeze({assess,transition,geometry,instances,allocate,clearCache:()=>cache.clear()});
});
