/* Small, explicit ST regional grammar. Positive local evidence, never a proof
 * that an unrecognized position is impossible. No fixture IDs or hidden stream. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js')):factory(root.STRules,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STStructure=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B){
'use strict';
const cache=new Map(),substituteCache=new Map(),clone=x=>JSON.parse(JSON.stringify(x));
function heights(board){const out=new Array(10);
 // Preserve column/read order without allocating a callback for every scan.
 for(let x=0;x<10;x++){const length=board.length;let y=0;while(y<length&&board[y][x]==='.')y++;out[x]=y<length?40-y:0;}
 return out;
}
const rough=p=>p.slice(1).reduce((n,h,i)=>n+Math.abs(h-p[i]),0);
// Only immutable shape facts are shared. Board, phase, supply and witness
// results remain in their existing calculation/cache scope.
const COMPLETION_POSES=Object.freeze(Object.fromEntries([...'IJLOSTZ'].map(piece=>[piece,Object.freeze(Array.from({length:4},(_,rotation)=>{
 const offsets=Object.freeze(R.cells({type:piece,x:0,y:0,rotation}).map(cell=>Object.freeze(cell)));
 return Object.freeze({offsets,minX:Math.min(...offsets.map(c=>c[0])),maxX:Math.max(...offsets.map(c=>c[0]))});
}))])));
// Positive three-row center motifs observed in the two existing Fumen sources.
// Local occupancy only: no board height, left/right state, fixture ID or move
// sequence. Unknown motifs remain legal; this is a deliberately small grammar.
const CENTER_MOTIFS=new Set(['###/###/##.','.##/##./###','#../###/##.','..#/.##/.#.','.#./.##/###','.##/.##/.#.','##./##./###','###/##./###','.##/###/###','#../#../##.','.#./.#./.##','.#./##./###','.#./###/###','.#./.##/.##','..#/..#/###','..#/###/###']);
function centerMotif(board){const rows=board.map(r=>r.slice(4,7).replace(/[^.]/g,'#')),top=rows.findIndex(r=>r!=='...');return top<0?'empty':rows.slice(top,top+3).join('/');}

// Scratch is private and leased per call: nested assessment (including a caller's
// board getters) cannot overwrite an active flood. Only scalar/owned-array facts
// escape, and a thrown read still releases the lease. No board identity is cached.
const assessmentScratch=[];
function cavityFacts(board,columnHeights=heights(board)){
 const scratch=assessmentScratch.pop()||{air:new Uint8Array(400),todo:new Uint16Array(400)};
 const {air,todo}=scratch;air.fill(0);let tail=0;
 try{
  for(let x=0;x<10;x++)if(board[0][x]==='.') {air[x]=1;todo[tail++]=x;}
  for(let i=0;i<tail;i++){const key=todo[i],x=key%10,y=Math.floor(key/10);
   if(x<9&&!air[key+1]&&board[y][x+1]==='.') {air[key+1]=1;todo[tail++]=key+1;}
   if(x>0&&!air[key-1]&&board[y][x-1]==='.') {air[key-1]=1;todo[tail++]=key-1;}
   if(y<39&&!air[key+10]&&board[y+1][x]==='.') {air[key+10]=1;todo[tail++]=key+10;}
   if(y>0&&!air[key-10]&&board[y-1][x]==='.') {air[key-10]=1;todo[tail++]=key-10;}
  }
  const sealedCells=[];let sealed=0,covered=0,leftSealed=0;
  for(let x=0;x<10;x++)for(let y=40-columnHeights[x];y<40;y++)if(board[y][x]==='.'){
   covered++;if(!air[y*10+x]){sealed++;sealedCells.push([x,y]);if(x<7)leftSealed++;}
  }
  return{sealedCells,sealed,covered,leftSealed};
 }finally{if(assessmentScratch.length<4)assessmentScratch.push(scratch);}
}
// Only newly sealed internal construction cells create repair debt. Existing
// imported damage is not silently reclassified, and intentional right-region
// reservoirs are governed by their separate cap/T-double proofs.
function cavityRepairDebt(before,after,event,debt=[]){
 const cleared=event.clearedRows||[];
 const translate=cells=>cells.filter(([,y])=>!cleared.includes(y)).map(([x,y])=>[x,y+cleared.filter(r=>r>y).length]);
 const key=([x,y])=>x+','+y;
 const old=new Set(translate(before.sealedCells.filter(([x])=>x<7)).map(key));
 const current=after.sealedCells.filter(([x])=>x<7),sealed=new Set(current.map(key));
 return [...new Map([...translate(debt),...current.filter(c=>!old.has(key(c)))].filter(c=>sealed.has(key(c))).map(c=>[key(c),c])).values()];
}
function covered(board,cols,h=heights(board)){let n=0;for(const x of cols)for(let y=40-h[x];y<40;y++)if(board[y][x]==='.')n++;return n;}
// Count genuinely sealed voids separately from covered but side-accessible
// scoring cavities. Air reachability is necessary, not sufficient, piece access.
function sealed(board,cols,h=heights(board)){const top=Math.max(0,39-Math.max(...h)),seen=new Uint8Array(400),q=[];for(let x=0;x<10;x++)if(board[top][x]==='.') {seen[top*10+x]=1;q.push(top*10+x);}
 // Keep right/left/down/up discovery order, without per-cell neighbor arrays.
 for(let i=0;i<q.length;i++){const n=q[i],x=n%10,y=Math.floor(n/10);
  if(x<9&&!seen[n+1]&&board[y][x+1]==='.') {seen[n+1]=1;q.push(n+1);}
  if(x>0&&!seen[n-1]&&board[y][x-1]==='.') {seen[n-1]=1;q.push(n-1);}
  if(y<39&&!seen[n+10]&&board[y+1][x]==='.') {seen[n+10]=1;q.push(n+10);}
  if(y>top&&!seen[n-10]&&board[y-1][x]==='.') {seen[n-10]=1;q.push(n-10);}
 }
 let n=0;for(const x of cols)for(let y=top;y<40;y++)if(board[y][x]==='.'&&!seen[y*10+x])n++;return n;}
// Straight-drop witnesses from a hypothetical fresh piece. The actual active
// pose and the order in which this piece becomes available are checked by search.
function completions(board,lo,hi,pieces,notches,h0=heights(board)){const protectedCols=lo===4?[4,5]:[0,1,2,3],out=[],seen=new Set();
 const oldProfile=h0.slice(lo,hi+1),oldPeak=Math.max(...oldProfile),oldRoughness=rough(oldProfile);let baselineSealed;
 for(const piece of pieces)for(let rotation=0;rotation<4;rotation++){
  const {offsets,minX,maxX}=COMPLETION_POSES[piece][rotation];
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
   const partialRepair=lo===0&&!level&&cells.every(([,cy])=>40-cy<=oldPeak)&&
    protectedCols.some(cx=>oldPeak-h0[cx]>=3&&h[cx]>h0[cx])&&rough(profile)<oldRoughness;
   if(!level&&!nextSL&&!partialRepair)continue;
   const addsCover=protectedCols.some(cx=>h[cx]-h0[cx]>cells.filter(c=>c[0]===cx).length);
   if(addsCover){if(lo!==4)continue;const projected=board.map(r=>r.split(''));for(const[cx,cy]of cells)projected[cy][cx]=piece;if(sealed(projected.map(r=>r.join('')),[4,5,6],h)>(baselineSealed??=sealed(board,[4,5,6],h0)))continue;}
   const key=cells.map(c=>c.join(',')).sort().join(';');if(seen.has(key))continue;
   let state=R.createState({board,active:piece,canHold:false});if(!R.fits(board,state.active))continue;const witness=[];
   const turn=rotation===1?'CW':rotation===2?'R180':rotation===3?'CCW':null;if(turn){const n=R.move(state,turn);if(n===state)continue;state=n;witness.push(turn);}
   while(state.active.x!==x){const action=state.active.x>x?'L':'R',n=R.move(state,action);if(n===state)break;state=n;witness.push(action);}
   if(state.active.x!==x)continue;const n=R.move(state,'HD'),e=n.lastEvent;
   if(!e||e.lines||e.topOut||e.target.rotation!==rotation||e.target.x!==x||e.target.y!==y)continue;
   // A geometrically legal partner is not ST support if it fills a reserved
   // notch. Execute the advertised witness and inherit the caller's cycle phase.
   if(lo===4){const replay=R.replay(R.createState({board,active:piece,canHold:false}),[...witness,'HD']);
    if(!replay.valid||replay.events.length!==1||!canonicalClear(replay.events[0])||!advanceNotches(board,{event:replay.events[0],state:replay.state},notches).valid)continue;}
   seen.add(key);out.push({piece,family:null,target:e.target,cells:e.cells,witness:[...witness,'HD'],access:'hypothetical-spawn-straight-drop',resultProfile:h.slice(lo,hi+1),resultStatus:level?'level':partialRepair?'partial-repair':'SL-preparation-surface',patternSupport:lo!==4?null:CENTER_MOTIFS.has(centerMotif(n.board))?'reference-supported':'unrecognized',preserveCells:e.cells.map(c=>c.slice())});
  }
 }return out;
}
// The pair is an ordered construction, never inferred from one finishing piece.
const CENTER_PAIRS=Object.freeze({L:'O',O:'J',S:'L',Z:'J'});
function localDrops(board,lo,hi,pieces){const out=[],seen=new Set();
 for(const type of pieces)for(let rotation=0;rotation<4;rotation++)for(let x=lo-2;x<=hi;x++){
  const cells=R.cells({type,x,y:0,rotation});if(cells.some(([cx])=>cx<lo||cx>hi))continue;
  let state=R.createState({board,active:type,canHold:false});const witness=[];
  if(!R.fits(board,state.active))continue;
  const turn=['','CW','R180','CCW'][rotation];if(turn){const next=R.move(state,turn);if(next===state)continue;state=next;witness.push(turn);}
  while(state.active.x!==x){const a=state.active.x>x?'L':'R',next=R.move(state,a);if(next===state)break;state=next;witness.push(a);}
  if(state.active.x!==x)continue;state=R.move(state,'HD');const e=state.lastEvent;
  if(!e||e.topOut||e.lines||e.target.rotation!==rotation||e.cells.some(([cx])=>cx<lo||cx>hi))continue;
  const key=e.cells.slice().sort().join(';');if(seen.has(key))continue;seen.add(key);
  out.push({piece:type,target:e.target,cells:e.cells,witness:[...witness,'HD'],board:state.board,access:'hypothetical-spawn-straight-drop'});
 }return out;
}
function capCompletions(board){return localDrops(board,8,9,'Z').filter(c=>{const h=heights(c.board);return h[9]===h[8]+1&&h[7]<h[8];}).map(({board,...c})=>c);}
// Short substitutes are positive geometry evidence, not promises about piece
// arrival. Only useful first fills (no new left holes) are extended, at most two
// locks. This deliberately does not turn a missing route into impossibility.
function leftSubstitutes(board){const key=board.join('');if(substituteCache.has(key))return substituteCache.get(key);
 const before=covered(board,[0,1,2,3]),out=[];
 for(const first of localDrops(board,0,3,'IJLOS')){
  if(covered(first.board,[0,1,2,3])>before)continue;
  for(const second of localDrops(first.board,0,3,'IJLOS')){
   const h=heights(second.board).slice(0,4),old=heights(board).slice(0,4);
   if(covered(second.board,[0,1,2,3])>before||Math.min(...h)<=Math.min(...old)||Math.max(...h)>Math.max(...old)+4||Math.max(...h)-Math.min(...h)>3)continue;
   const {board:ignored,...step}=second;
   out.push({pieces:[first.piece,second.piece],steps:[{piece:first.piece,target:first.target,cells:first.cells,witness:first.witness},step],resultProfile:h,resultStatus:new Set(h).size===1?'level':'partial-scoring-row-fill',access:'two hypothetical fresh-spawn drops; actual timing requires search'});
  }
 }
 if(substituteCache.size>=128)substituteCache.clear();const best=[...new Map(out.sort((a,b)=>rough(a.resultProfile)-rough(b.resultProfile)).reverse().map(c=>[c.pieces.join(''),c])).values()];substituteCache.set(key,best);return best;
}
// Canonical Z cap: a solid column-nine wall and exactly the two-cell roof
// in column ten. The empty shaft below that roof is only a candidate reservoir;
// the planner must verify a reachable T-double that reopens those exact cells.
function capReservoir(board,h){
 const [channel,wall,cap]=h.slice(7),top=40-cap;
 if(channel!==0||wall<2||cap!==wall+1)return null;
 if(board[top][9]==='.'||board[top+1][9]==='.')return null;
 for(let y=40-wall;y<40;y++)if(board[y][8]==='.')return null;
 const cells=[];for(let y=top+2;y<40;y++){if(board[y][9]!=='.')return null;cells.push([9,y]);}
 return {status:'clear-witness-required',cells,roofRow:top+1,pattern:'canonical-Z-cap-reservoir'};
}
// The scoring cycle includes a bottom-four-row cleanup, not just the Z roof.
// Occupancy, not piece colours or a historical clear counter, identifies its phase.
function rightCycle(board,h){
 const [channel,wall,cap]=h.slice(7),solid=(x,n)=>n===0||board.slice(40-n).every(row=>row[x]!=='.');
 const wallSolid=solid(8,wall),channelBase=channel===0||(channel%4===0&&solid(7,channel));
 const leftCenterBase=board.slice(36).every(row=>row.slice(0,7).split('').every(c=>c!=='.'));
 const cleanupRows=leftCenterBase&&solid(8,4);
 const tenFilled=solid(9,4),eightEmpty=board.every(row=>row[7]==='.'),tenEmpty=board.every(row=>row[9]==='.');
 const eightFilled=solid(7,4);
 let shape='unrecognized',phase='unrecognized';
 if(channel===0&&wall===0&&cap===0){shape='cleared-base';phase='post-clear-rebuild';}
 else if(channelBase&&wallSolid&&wall>channel&&cap===0){shape='cap-preparation';phase=channel>0?'cap-rebuild-above-cleanup-I':'cap-rebuild';}
 else if(channelBase&&wallSolid&&cap===wall+1&&wall>channel){shape='staggered-scoring-wall';phase=channel>0?'scoring-above-cleanup-I':tenFilled?'scoring-with-cleanup-prepared':'scoring';}
 // With only three wall cells, the outer I is ready but the Z cap is not.
 // This is preparation, not an inaccessible completed scoring cavity.
 if(leftCenterBase&&wallSolid&&wall===3&&channel===0&&tenFilled&&cap===4){shape='cap-preparation';phase='cap-rebuild-with-cleanup-prepared';}
 // A filled outer column is intentional cleanup preparation. It need not
 // already have a T cap above it and must not be charged as a broken wall.
 if(cleanupRows&&eightEmpty&&tenFilled&&cap===4){shape='quad-preparation';phase='cleanup-ready';}
 const cleanupColumns=[];
 if(cleanupRows&&eightEmpty&&tenFilled)cleanupColumns.push(7);
 if(cleanupRows&&tenEmpty&&eightFilled)cleanupColumns.push(9);
 // Three wall cells admit the known early I preparation: the next double
 // can finish the fourth cleanup row. This is not yet an executable quad.
 const prepareColumn=leftCenterBase&&wallSolid&&wall>=3&&eightEmpty&&tenEmpty?9:null;
 return {shape,phase,cleanupColumns,prepareColumn,wallSolid,channelBase};
}
function canonicalClear(event){return event.lines===0||
 (event.type==='T'&&event.spin==='full'&&event.lines===2&&event.cells.every(([x])=>x>=6))||
 (event.type==='I'&&event.lines===4&&event.cells.every(([x])=>x>=7));}
// The column-seven teeth belong to the scoring cycle, not an absolute board
// height modulo three. A recognized Z wall establishes the next arm notch;
// an uncapped solid wall establishes where its checked next Z cap will put it.
// Blank construction cells between teeth are allowed: only notch cells are
// reserved. Unknown geometry cannot establish this phase; an empty right
// floor is anchored only by an actual hypothetical next-Z drop witness.
function notchPattern(board){
 const h=heights(board),cycle=rightCycle(board,h);
 // A solid outer I is not a Z roof, even while left scoring rows are
 // unfinished (rightCycle's cleanup classification also requires those rows).
 const outerIPrepared=h[7]===0&&h[8]===3&&h[9]===4&&cycle.wallSolid&&board.slice(36).every(row=>row[9]!=='.');
 const cleanupReady=cycle.shape!=='staggered-scoring-wall'&&cycle.cleanupColumns.length>0&&cycle.wallSolid&&cycle.channelBase;
 const scoringRoof=cycle.shape==='staggered-scoring-wall'&&h[9]>=2&&board[40-h[9]][9]!=='.'&&board[41-h[9]][9]!=='.';
 const floorCap=cycle.shape==='cleared-base'?capCompletions(board)[0]:null;
 const floorAnchor=floorCap?Math.max(...floorCap.cells.filter(([x])=>x===8).map(([,y])=>40-y))+1:null;
 const height=floorAnchor??(outerIPrepared||cleanupReady?h[8]+3:scoringRoof?h[8]+1:cycle.shape==='cap-preparation'?h[8]+3:null);
 if(height===null){
  // A legal filler above a cap does not erase the lower scoring cycle. Inspect
  // the actual buried roof rather than only the topmost column heights. The
  // notch beside the roof, solid lower wall, open scoring channel and exact
  // reservoir/optional bottom cleanup I distinguish it from an O or I roof.
  const anchors=[];
  const shaft=(x,start)=>board.slice(start).every(r=>r[x]==='.')||
   (start<=36&&board.slice(start,36).every(r=>r[x]==='.')&&board.slice(36).every(r=>r[x]!=='.'));
  for(let y=0;y<38;y++)if(board[y][8]==='.'&&board[y][9]!=='.'&&board[y+1][9]!=='.'&&
   board.slice(y+1).every(r=>r[8]!=='.')&&shaft(7,y)&&shaft(9,y+2))anchors.push(y);
  if(anchors.length===1)return notchRows(board,anchors[0],'recognized-buried-scoring-cap');
  // The already-supported three-cell wall plus bottom outer I is pre-cap,
  // even if a filler now rises above that I. Do not misread its solid shaft
  // as a Z roof or lose the next-cap phase because its top silhouette changed.
  if(board[36][8]==='.'&&board.slice(37).every(r=>r[8]!=='.')&&
   board.slice(36).every(r=>r[7]==='.'&&r[9]!=='.'))
   return notchRows(board,34,'recognized-buried-cleanup-preparation');
  return {status:'unanchored',anchorRow:null,protectedRows:[],blockedRows:[],source:'right-cycle-phase-not-established'};
 }
 return notchRows(board,40-height,floorCap?'witnessed-floor-Z-cap':!outerIPrepared&&!cleanupReady&&scoringRoof?'recognized-scoring-wall':'recognized-next-Z-cap');
}
function notchRows(board,anchorRow,source){
 const protectedRows=[];for(let y=anchorRow;y>=0;y-=3)if(y<40)protectedRows.push(y);
 const blockedRows=protectedRows.filter(y=>board[y][6]!=='.');
 return {status:blockedRows.length?'broken':'established',anchorRow,protectedRows,blockedRows,source};
}
function advanceNotches(before,p,inherited){
 const prior=inherited&&inherited.status!=='unanchored'?inherited:notchPattern(before);
 if(prior.status==='broken')return {valid:false,violation:'existing-column-seven-notch-blocked',pattern:prior,blockedCells:prior.blockedRows.map(y=>[6,y])};
 if(prior.status==='unanchored'){
  const pattern=notchPattern(p.state.board);
  return {valid:pattern.status!=='broken',violation:pattern.status==='broken'?'established-cycle-with-blocked-notch':null,pattern,blockedCells:pattern.blockedRows.map(y=>[6,y])};
 }
 const cleared=p.event.clearedRows||[];
 const currentDouble=canonicalClear(p.event)&&p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2;
 const blockedCells=p.event.cells.filter(([x,y])=>x===6&&prior.protectedRows.includes(y)&&!(currentDouble&&y===prior.anchorRow&&cleared.includes(y)));
 // Rows above each clear move down one. The consumed current arm disappears;
 // the next surviving tooth becomes current. Extend the same phase upward,
 // including fresh rows entering the top, rather than re-anchoring modulo 3.
 const surviving=prior.protectedRows.filter(y=>!cleared.includes(y)).map(y=>y+cleared.filter(r=>r>y).length);
 const pattern=surviving.length?notchRows(p.state.board,Math.max(...surviving),'translated-established-cycle'):notchPattern(p.state.board);
 const recognized=notchPattern(p.state.board);
 // Preserving blank teeth is not enough if construction creates a different
 // positively recognized scoring cycle. Do not hand the next fresh planner a
 // contradictory anchor (for example, a four-cell I substituted for a Z wall).
 const conflict=recognized.status!=='unanchored'&&recognized.anchorRow!==pattern.anchorRow;
 // Nonclearing construction must not erase independently observed phase
 // evidence: the next fresh request would otherwise forget its reserved teeth.
 // Canonical clears retain the existing translated-prefix checks; recognizing
 // every residual post-clear shape is a separate, still incomplete grammar.
 // Buried caps/cleanup remain recognized above, and unknown roots or an
 // already-unrecognized post-clear board do not acquire an invented phase.
 const lost=p.event.lines===0&&recognized.status==='unanchored'&&notchPattern(before).status!=='unanchored';
 return {valid:!blockedCells.length&&pattern.status!=='broken'&&!conflict&&!lost,violation:blockedCells.length?'filled-protected-column-seven-notch':pattern.status==='broken'?'column-seven-notch-blocked':conflict?'changed-established-scoring-phase':lost?'lost-established-scoring-phase':null,pattern,blockedCells};
}
// The top motif is insufficient: retain the actual scoring phase and inspect
// the completed lower region, excluding only its established notch cells.
// Unknown phase is unknown evidence, never a guessed modulo or illegal board.
function centerFoundation(board,notches=notchPattern(board)){
 const profile=heights(board).slice(4,7),vacancies=[];
 if(notches.status!=='established')return {status:'unknown-phase',vacancies,profile};
 for(let y=40-Math.min(...profile);y<40;y++)for(let x=4;x<7;x++)
  if(board[y][x]==='.'&&!(x===6&&notches.protectedRows.includes(y)))vacancies.push([x,y]);
 return {status:vacancies.length?'unfinished-lower-foundation':'aligned',vacancies,profile};
}
// A phase-relative construction state, not evidence that a clear occurred.
// Callers supplying a phase must already have validated its actual history.
// This does not certify Left balance, Right duties, a full motif or handoff.
function centerLevelBase(board,notches=notchPattern(board)){
 if(notches.status==='broken')return {status:'invalid-phase'};
 if(notches.status!=='established')return {status:'unknown-phase'};
 if(!Number.isInteger(notches.anchorRow)||notches.anchorRow<0||notches.anchorRow>39)return {status:'invalid-phase'};
 const anchor=notches.anchorRow;if(anchor===39)return {status:'other-foundation',anchorRow:anchor};
 for(let y=0;y<40;y++)for(let x=4;x<7;x++)if((board[y][x]!=='.')!==(y>anchor))return {status:'other-foundation',anchorRow:anchor};
 return {status:'phase-aligned-level-base',anchorRow:anchor,level:39-anchor};
}
function geometry(board,options={}){const notches=options.notches??notchPattern(board);
 // Identical occupancy can carry a different translated scoring phase. Never
 // reuse partner evidence from another phase (or from an unanchored board).
 const key=board.map(r=>r.replace(/[IJLOSTZX#]/g,'#')).join('')+JSON.stringify([notches.status,notches.anchorRow,notches.protectedRows,notches.blockedRows]);if(cache.has(key))return cache.get(key);
 const h=heights(board),left=h.slice(0,4),center=h.slice(4,7),right=h.slice(7),flatLeft=new Set(left).size===1,flatCenter=new Set(center).size===1;
 const centerCompletions=flatCenter?[]:completions(board,4,6,'SLOJZ',notches,h);
 const leftCompletions=flatLeft?[]:completions(board,0,3,'IJLOSTZ',undefined,h);
 const centerInternal=sealed(board,[4,5,6],h);const leftInternal=covered(board,[0,1,2,3],h);
 const [channel,pedestal,cap]=right,cycle=rightCycle(board,h);
 const rightShape=cycle.shape;
 // Excess right-wall discontinuity creates an extra repair obligation. It is
 // evidence against the small grammar, not proof of an inaccessible T slot.
 const renewalDebt=rightShape==='unrecognized'?Math.max(1,channel+Math.abs(cap-pedestal-1)):0;
 const motif=centerMotif(board),motifSupported=CENTER_MOTIFS.has(motif);
 const centerStatus=flatCenter?'level':centerCompletions.some(c=>c.patternSupport==='reference-supported')?'supported-partner-completion':'unrecognized';
 // Regional maxima hide a deep well that prevents the scoring rows filling.
 // Permit a one-I-height offset; larger bottlenecks require concrete repair.
 const frontierDebt=Math.max(0,Math.max(...center)-Math.min(...left)-4);
 const scoringRowDebt=Math.max(0,Math.max(...right)-Math.min(...h.slice(0,7))-1);
 const g={frontierDebt,scoringRowDebt,left:{profile:left,flat:flatLeft,roughness:rough(left),covered:leftInternal,horizontalI:flatLeft?{status:'straight-drop-platform',columns:[1,2,3,4]}:null,completions:leftCompletions},center:{foundation:centerFoundation(board,notches),profile:center,status:centerStatus,motif,patternSupport:motifSupported?'reference-supported':'unrecognized',coveredInternal:centerInternal,sealedVoids:centerInternal,coveredCavities:covered(board,[4,5,6],h),completionDebt:centerStatus==='unrecognized'?1:0,completions:centerCompletions},right:{profile:right,shapeStatus:rightShape,cycle,renewalDebt,reservoir:capReservoir(board,h),completions:rightShape==='cap-preparation'?capCompletions(board):[]},supportEstimate:(flatLeft?2:0)-rough(left)*1.5-leftInternal*8+(motifSupported?(flatCenter?4:2):centerCompletions.some(c=>c.patternSupport==='reference-supported')?0:-8)-centerInternal*6-renewalDebt*6-frontierDebt*4-scoringRowDebt*3,uncertainty:rightShape==='unrecognized'||centerStatus==='unrecognized'||!motifSupported};
 if(cache.size>=2048)cache.clear();cache.set(key,g);return g;
}
function instances(state){const out=[];if(state.active)out.push({id:'active',piece:state.active.type,source:'active',available:'now'});if(state.hold)out.push({id:'hold',piece:state.hold,source:'hold',available:state.canHold?'hold-now':'after-next-lock'});(state.queue||[]).forEach((piece,i)=>out.push({id:'queue:'+i,piece,source:'visible',drawOffset:i+1,available:'when-drawn'}));if(state.bag){const p=B.forcedNext(state.bag);if(p)out.push({id:'forced-next',piece:p,source:'forced-beyond-preview',available:'after-preview'});}return out;}
function allocate(obligations,supply){
 const weight=o=>o.priority==='essential'?100:o.kind==='left-surface'?1:10;
 const delay=p=>p.available==='now'||p.available==='hold-now'?0:p.available==='after-next-lock'?1:p.drawOffset??8;
 let best=[],bestScore=-Infinity,bestDelay=Infinity;
 function walk(i,used,a,score,time){if(i===obligations.length){if(score>bestScore||(score===bestScore&&time<bestDelay)){best=a.slice();bestScore=score;bestDelay=time;}return;}
  const o=obligations[i];for(const p of supply)if(!used.has(p.id)&&o.alternatives.includes(p.piece)){used.add(p.id);a.push({obligation:o.kind,instance:p.id,piece:p.piece,priority:o.priority??'normal',arrival:p.available});walk(i+1,used,a,score+weight(o),time+delay(p));a.pop();used.delete(p.id);}walk(i+1,used,a,score,time);
 }walk(0,new Set(),[],0,0);
 const conflicts=[];for(let i=0;i<obligations.length;i++)for(let j=i+1;j<obligations.length;j++){const a=supply.filter(p=>obligations[i].alternatives.includes(p.piece)),b=supply.filter(p=>obligations[j].alternatives.includes(p.piece));if(a.length&&b.length&&new Set([...a,...b].map(p=>p.id)).size<2)conflicts.push({obligations:[obligations[i].kind,obligations[j].kind],instances:[...new Set([...a,...b].map(p=>p.id))]});}
 return{assignments:best,conflicts,matched:best.length,priorityScore:bestScore,arrivalEstimate:bestDelay,timing:'Distinct instances, essential-role priority and arrival estimates; execution still requires search.'};
}
function assess(stateOrBoard,options={}){const state=Array.isArray(stateOrBoard)?{board:stateOrBoard}:stateOrBoard,g=clone(geometry(state.board,options)),obligations=[];
 if(g.center.completions.length)obligations.push({kind:'center-partner',alternatives:[...new Set(g.center.completions.map(c=>c.piece))],completions:g.center.completions,note:'Exact straight-drop completion of the current center surface; keep completion cells free.'});
 if(!g.left.flat&&g.left.completions.length)obligations.push({kind:'left-surface',alternatives:[...new Set(g.left.completions.map(c=>c.piece))],completions:g.left.completions,note:'Optional left-surface improvement, not a mandatory immediate fill.'});
 if(g.right.shapeStatus==='staggered-scoring-wall')obligations.push({kind:'scoring-cycle',alternatives:['T'],completions:[],note:'Normal scoring-wall shape; actual T-spin entry and line completion require execution verification.'});
 if(g.right.cycle.cleanupColumns.length||g.right.cycle.prepareColumn!==null)obligations.unshift({kind:'right-cleanup-I',priority:'essential',alternatives:['I'],completions:[],columns:g.right.cycle.cleanupColumns.length?g.right.cycle.cleanupColumns:[g.right.cycle.prepareColumn],stage:g.right.cycle.cleanupColumns.length?'clear':'prepare',note:'Advance the recognized bottom-four-row cleanup without blocking the remaining scoring cycle.'});
 if(g.right.completions.length)obligations.unshift({kind:'right-cap',priority:'essential',alternatives:['Z'],completions:g.right.completions,note:'A checked Z cap restores the scoring wall; preserve this role before optional surface filling.'});
 const supply=instances(state),allocation=allocate(obligations,supply);for(const o of obligations){o.supply=supply.filter(p=>o.alternatives.includes(p.piece));o.status=o.supply.length?'known-piece-identity':'future-supply-unresolved';}
 const cap=obligations.find(o=>o.kind==='right-cap');
 if(cap){cap.access=cap.supply.some(p=>p.available==='now'||p.available==='hold-now')?'available-now-requires-actual-path':cap.supply.some(p=>p.source==='visible')?'visible-later-requires-order-and-access':'unresolved-future';}
 // An unresolved future cap after a successful clear is uncertainty, not a
 // failed obligation. Strong cost belongs to *spending* its known scarce Z.
 const capSupplyBurden=!cap?0:!cap.supply.length?2:cap.supply.some(p=>p.available==='now'||p.available==='hold-now')?0:1;
 const center=obligations.find(o=>o.kind==='center-partner'),supplyBurden=!center?0:!center.supply.length?2:center.supply.some(p=>p.source==='active'||p.source==='hold')?0:center.supply.some(p=>p.source==='visible')?0.5:1;
 return{...g,capSupplyBurden,centerCompletionDebt:g.center.completionDebt,supplyBurden,obligations,supply:{instances:supply,...allocation,conflictCount:allocation.conflicts.length},supportEstimate:g.supportEstimate-allocation.conflicts.length*3-supplyBurden-capSupplyBurden,claim:'Local regional support estimate, not a sustainability guarantee.'};
}
function transition(before,p,afterStructure,options={}){const beforeNotches=options.notches??notchPattern(before.board),afterNotches=advanceNotches(before.board,p,beforeNotches).pattern;const cells=p.event.cells,regions=[...new Set(cells.map(([x])=>x<4?'left':x<7?'center':'right'))],after=afterStructure||geometry(p.state.board,{notches:afterNotches}),prior=geometry(before.board,{notches:beforeNotches});let allocation='unrecognized-role',debt=0;
 const pure=regions.length===1?regions[0]:null,type=p.event.type;
 if(p.event.spin==='full'&&p.event.lines===2){allocation='scoring-double';}
 else if(type==='I'&&p.event.lines===4){allocation='quad-cleanup';}
 else if(type==='I'&&pure==='right'&&prior.right.cycle.prepareColumn!==null&&cells.every(([x])=>x===prior.right.cycle.prepareColumn)&&(after.right.cycle.cleanupColumns.length||['scoring-with-cleanup-prepared','cap-rebuild-with-cleanup-prepared'].includes(after.right.cycle.phase))){allocation='quad-preparation';}
 else if(pure==='left'&&type==='T'&&prior.right.shapeStatus==='staggered-scoring-wall'){allocation='scoring-T-diversion';debt+=6;}
 else if(pure==='left'){allocation='left-filler';if(type==='I'&&cells.every(([,y])=>y===cells[0][1]))allocation='horizontal-left-I';}
 else if(pure==='center'&&'SLOJZ'.includes(type)&&(after.center.status!=='unrecognized'))allocation=after.center.status==='level'?'center-completion':'center-partner-preparation';
 else if(type==='Z'&&cells.every(([x])=>x>=7)){
  if(prior.right.shapeStatus==='staggered-scoring-wall'&&Math.max(...after.right.profile)>Math.max(...prior.right.profile)&&p.event.lines===0){allocation='right-cap-extension';debt+=3;}
  else if(after.right.shapeStatus==='staggered-scoring-wall')allocation='right-cap-preparation';
  else {allocation='unrecognized-role';debt+=5;}
 }
 else {debt+=regions.includes('right')?5:3;if(regions.includes('left')&&regions.includes('center'))debt+=3;}
 const newlyCovered=Math.max(0,after.left.covered-prior.left.covered)+Math.max(0,after.center.coveredInternal-prior.center.coveredInternal);
 const regionalRepair=Math.max(0,after.right.renewalDebt-prior.right.renewalDebt);
 const repaired=Math.max(0,prior.right.renewalDebt-after.right.renewalDebt)+Math.max(0,prior.left.covered-after.left.covered)+Math.max(0,prior.center.coveredInternal-after.center.coveredInternal);
 debt+=newlyCovered*3+regionalRepair*2-Math.min(8,repaired*2);
 const finish=prior.center.completions.find(c=>c.piece===type&&JSON.stringify(c.cells.slice().sort())===JSON.stringify(cells.slice().sort()));
 const partner=pure==='center'?after.center.completions.find(c=>CENTER_PAIRS[type]===c.piece&&c.resultStatus==='level'):null;
 const pairFamily=partner?type+partner.piece:null;
 const pairProgress=partner?{orderedPieces:[type,partner.piece],step:1,status:'partner-placement-checked',placedCells:cells,completion:partner}:null;
 // Spending the sole observed Z on optional work destroys a concrete cap
 // opportunity. A later bag guarantee is not a timely visible replacement.
 const capDemand=prior.right.completions.length>0;
 const opportunityCost=capDemand&&type==='Z'&&allocation!=='right-cap-preparation'?4:0;
 const substitutes=capDemand&&type==='Z'?leftSubstitutes(before.board):[];
 debt+=opportunityCost;
 if(finish&&pure==='center')allocation='center-completion';
 const cycleViolations=[];
 if(p.availableCleanupPreparation===true&&allocation==='right-cap-preparation'&&prior.right.cycle.prepareColumn!==null)cycleViolations.push('capped-before-available-cleanup-I');
 if(opportunityCost)cycleViolations.push('spent-cap-Z-on-optional-work');
 // The planner supplies this only after actual-pose/hold enumeration finds
 // an executable cap. A hypothetical spawn completion alone is not access.
 const capAvailable=capDemand&&p.availableCap===true;
 if(capAvailable&&!['right-cap-preparation','quad-preparation','quad-cleanup','scoring-double'].includes(allocation))cycleViolations.push('postponed-available-cap-for-optional-work');
 if(type==='T'&&p.event.lines===0&&['scoring','scoring-above-cleanup-I','scoring-with-cleanup-prepared'].includes(prior.right.cycle.phase))cycleViolations.push('spent-scoring-T-without-double');
 if(type==='I'&&(prior.right.cycle.prepareColumn!==null||prior.right.cycle.cleanupColumns.length)&&!['quad-preparation','quad-cleanup'].includes(allocation))cycleViolations.push('spent-cleanup-I-on-optional-work');
 const reason=allocation==='horizontal-left-I'?'Keep the left region flat.':allocation==='center-partner-preparation'?partner?'Start the ordered '+type+'/'+partner.piece+' center pair.':'Prepare the center; no ordered level-finishing pair has been established.':allocation==='center-completion'?'Complete the center pattern.':allocation==='scoring-double'?'Take the T-spin double and assess its rebuild.':allocation==='scoring-T-diversion'?'Diverts a T from the scoring role; another T may remain, but its timely use is not established.':allocation==='quad-preparation'?'Prepare the right-side I cleanup while keeping column eight open.':allocation==='quad-cleanup'?'Clear the scoring channel with a quad.':allocation==='unrecognized-role'?'This allocation needs additional regional repair evidence.':allocation==='right-cap-extension'?'Extends an existing cap; renewed entry still needs checking.':'Preserve a supported regional piece role.';
 return{reason,cycleViolations,pairFamily,pairProgress,pairEvidence:pairFamily?'ordered actual preparation plus checked level-finishing placement':null,opportunityCost,leftSubstitutes:substitutes,regions,crossRegion:regions.length>1,allocation,status:['unrecognized-role','scoring-T-diversion','right-cap-extension'].includes(allocation)?'requires-repair-evidence':'supported-local-role',dependencyDebt:debt,newlyCovered,regionalRepair,repairCredit:Math.min(8,repaired*2),note:'Crossing a boundary is not forbidden. Debt measures unsupported allocation and new structural repair burden; a later checked repair may repay it.'};
}
return Object.freeze({assess,transition,geometry,cavityFacts,cavityRepairDebt,instances,allocate,canonicalClear,centerFoundation,centerLevelBase,notchPattern,advanceNotches,CENTER_PAIRS,leftSubstitutes,clearCache:()=>{cache.clear();substituteCache.clear();}});
});
