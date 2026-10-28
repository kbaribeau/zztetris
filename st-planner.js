/* Milestone-one finite-information coach. No fixture IDs, seeds or hidden queues. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules.js'),require('./st-bag.js'),require('./st-structure.js'),require('./st-paired-repair.js'),require('./st-access.js'),require('./st-pattern-history.js'),require('./st-left-foundation.js'),require('./st-resource-history.js'),require('./st-midgame-resources.js'),require('./st-left-context.js')):factory(root.STRules,root.STBag,root.STStructure,root.STPairedRepair,root.STAccess,root.STPatternHistory,root.STLeftFoundation,root.STResourceHistory,root.STMidgameResources,root.STLeftContext);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,B,S,X,A,H,Y,RH,M,L){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function resourceSummary(raw,options={}){return RH.resolve(raw,options.resourceContext?RH.importContext(raw,options.resourceContext):RH.start(raw));}
function ordinaryResourceCheck(raw,path,options={}){const summary=resourceSummary(raw,options);if(options.resourceContext&&summary.coverage?.status==='invalid')return{valid:false,reason:'invalid-resource-context'};return M.checkPath(raw,path,summary);}
function checkedResourceEndpoint(raw,path,options={}){const result=resourceEndpointCore(raw,path,options);if(options.budgetTracker)options.budgetTracker.nodes+=(result.visited||0);return result;}
function resourceEndpointCore(raw,path,options={}){
 const checked=ordinaryResourceCheck(raw,path,options);if(!checked.valid)return{...checked,visited:0};
 let visited=0;const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,limit=options.maxNodes??45000;
 if(checked.resource.tCollision){
  const access=R.tDoubleAccess(checked.state.board,{maxNodes:Math.max(0,limit-visited),deadline,now});visited+=access.visited;
  const replay=access.reachable?R.replay(checked.state,access.witness):null;
  if(!replay?.valid||replay.events.length!==1||replay.events[0].type!=='T'||replay.events[0].spin!=='full'||replay.events[0].lines!==2)return{...checked,valid:false,visited,reason:'pending-T-collision-without-score'};
 }
 let centerDeparture=false,virtual=extendForced(observe(raw)),notches=H.resolve(observe(raw),options.patternHistory);for(const step of path){const r=R.replay(virtual,step.witness);if(!r.valid||r.events.length!==1)return{...checked,valid:false,visited,reason:'invalid-resource-witness'};const phase=S.advanceNotches(virtual.board,{state:r.state,event:r.events[0]},notches);if(!phase.valid)return{...checked,valid:false,visited,reason:'invalid-resource-repair-phase'};notches=phase.pattern;
  const center=S.geometry(r.state.board,{notches}).center;
  if(r.events[0].lines===0&&r.events[0].cells.every(([x])=>x>=4&&x<=6)&&!supportedCenterPattern(center))centerDeparture=true;
  if(supportedCenterPattern(center))centerDeparture=false;
  virtual=r.state;}
 // Retention cannot turn imported claims into an eligibility exception. An
 // exceptional intermediate Center must actually return to a supported shape
 // in this replayed visible prefix; all existing resource/access checks remain.
 if(centerDeparture)return{...checked,valid:false,visited,reason:'unsupported-center-without-executed-repair'};
 const repair=resourceRepair(checked.state,checked.resource,{...options,notches,maxNodes:Math.min(4000,Math.max(0,limit-visited)),deadline,now});visited+=repair.visited;
 return{...checked,valid:repair.valid===true,reason:repair.valid===true?null:repair.status,visited,repair};
}
// Successful completion witnesses may be reused only inside one synchronous plan.
// Bind the actual pose, inventory, resource identities and phase; caller evidence
// never supplies this private cache and failed/budget-limited probes are not saved.
const resourceRepairCache=Symbol('resource-repair-cache');
function resourceRepair(state,resource,options){
 const cache=options[resourceRepairCache],key=JSON.stringify([observe(state),M.binding(resource),options.notches]);
 if(cache?.has(key))return{...cache.get(key),visited:0,reused:true};
 const proof=M.repair(state,resource,options);if(proof.valid)cache?.set(key,proof);return proof;
}
function resourceBinding(raw,options={}){return M.start(extendForced(raw),resourceSummary(raw,options)).originKey;}

const holdCount=p=>p.holdCount??p.witness.filter(a=>a==='HOLD').length;
const holdPrompt=p=>holdCount(p)===2?'Hold twice. ':holdCount(p)?'Hold once. ':'';
const ADVICE_SOURCES={
  "SHOCKY-1": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 1: The ST Stacking Timeline and Anatomy",
    "id": "SHOCKY-1",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Defines Left as columns 1–4, Center as 5–7, Right as 8–10, Pocket as column 10, Well as column 8, and a Z covering the Pocket as capped. Supports terminology, not this checked cap-replacement sequence."
  },
  "SHOCKY-3.1": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 3.1: The Right",
    "id": "SHOCKY-3.1",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Describes repeated Z-cap/T-spin-double play and I placement in Pocket/Well. Prefer the Pocket when both I placements are available. Does not certify a particular computed route."
  },
  "SHOCKY-3.2": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 3.2: The Center",
    "id": "SHOCKY-3.2",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Describes SL, OJ, LO and ZJ overhang pairs. LO can leave a Hanging S; ZJ needs contextual Z accounting. ZJ can be built in either order, and placement order depends on the position. A matching shape alone does not establish whole-run piece balance."
  },
  "SHOCKY-4": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapter 4: The Reset",
    "id": "SHOCKY-4",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Describes using two T pieces with Z pieces to rebuild Left/Center, and distinguishes mino parity from S/L parity. The project’s finite paired-T repair is not proof of a completed Reset."
  },
  "SHOCKY-8": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapters 8: The Extra Z and 9: Remembering What You’ve Forgotten",
    "id": "SHOCKY-8",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Discusses one Extra Z in the Midgame and observable piece-flow clues. A local cap replacement is not sufficient evidence that the historical Extra Z remains available."
  },
  "FLAME-TETRIS": {
    "url": "https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking",
    "section": "Tetrising",
    "id": "FLAME-TETRIS",
    "label": "Flamewheel's ST Stacking Guide",
    "scope": "Explains I-piece clears of right-side residue and prefers the rightmost option when both are available. Timing advice is written for timed Ultra and is not a universal survival rule."
  },
  "FLAME-CENTER": {
    "url": "https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking",
    "section": "Center Stacking",
    "id": "FLAME-CENTER",
    "label": "Flamewheel's ST Stacking Guide",
    "scope": "Explains two-piece center combinations with an open lower-right corner and a level three-wide top; capping here means finishing a combination. Its color-based piece names differ from current Guideline letters."
  },
  "FLAME-LEFT": {
    "url": "https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking",
    "section": "Left-Side Stacking",
    "id": "FLAME-LEFT",
    "label": "Flamewheel's ST Stacking Guide",
    "scope": "Describes shaped left surfaces and accommodation for awkward pieces, not a universal rule to keep all four left columns flat."
  },
  "SHOCKY-LEFT": {
    "url": "https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit",
    "section": "Chapters 3.3: The Left; 5: The Inconvenient I Piece; 6: The Pesky O Piece",
    "id": "SHOCKY-LEFT",
    "label": "Shocky's ST Stacking Guide",
    "scope": "Normal Left is not fully flat; local O-friendly surfaces matter; horizontal I placements are exceptional."
  }
};

// Presentation only: source background never supplies a move or changes ranking.
function advicePresentation(path,assessment={},construction=null){
 const first=path[0];if(!first)return{reason:'No checked move is available.',sources:[]};
 const ids=new Set(),add=(...keys)=>keys.forEach(k=>ids.add(k));
 const facts=first.structuralEvidence??{},center=p=>p.event.cells.every(([x])=>x>=4&&x<7);
 const tsdAt=path.findIndex(p=>p.event.spin==='full'&&p.event.lines===2);
 const region=[...new Set(first.event.cells.map(([x])=>x<4?'Left (columns 1–4)':x<7?'Center (columns 5–7)':'Right (columns 8–10)'))].join(' / ');
 let structural='';
 if(construction){
  const tRepairs=path.filter(p=>p.event.type==='T'&&p.event.lines===0).length;
  if(first.event.spin==='full'&&first.event.lines===2){structural='Take the checked T-spin double.';add('SHOCKY-3.1');}
  else if(construction.kind==='cap-deferral'){
   const capAt=path.findIndex(p=>p.event.type==='Z'&&p.event.cells.some(([x])=>x>=7));
   structural=capAt===0?'Place Z on the Right to restore the cap over the Pocket (column 10).':`Place ${first.event.type} in the ${region} as shown.`;
   if(capAt>0)structural+=` The checked sequence restores the Z cap in ${capAt+1} placements, including this one.`;
   add('SHOCKY-1');
  }else{
   structural=first.event.type==='T'&&!first.event.lines?(tRepairs>1?`Place T in the ${region} to begin the checked paired-T mino-parity repair.`:`Place T in the ${region} to balance the checked pair of T placements.`):`Build the ${region} with ${first.event.type} as shown.`;
   if(tRepairs)add('SHOCKY-4');if(center(first))add('SHOCKY-3.2','FLAME-CENTER');
  }
  if(construction.kind==='left-support')structural+=' Fill the checked Left support before covering it; a distinct visible I completes the original Right preparation at the end of this finite route.';
  if(construction.kind==='left-foundation')structural+=' This checked pair fills the missing Left cells beside the next scoring rows; it does not yet complete the Center or prove the next score.';
  if(tsdAt>0){structural+=` This checked sequence reaches a T-spin double in ${tsdAt+1} placements, including this one.`;add('SHOCKY-3.1');}
  structural+=construction.kind==='cap-deferral'?' This verifies a visible cap replacement, not whether an Extra Z remains available.':' This finite repair is not proof of a completed Reset.';
 }else{
  let pair=facts.pairProgress;
  // A scored first lock can expose a center-only suffix that was not the
  // original root pair. Describe its actual checked cells, without mutating
  // planner evidence or assuming preparation history from a piece letter.
  const partner=S.CENTER_PAIRS[first.event.type];
  if(center(first)&&first.event.lines===0&&partner&&facts.structure?.center.patternSupport==='reference-supported'){
   const key=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
   for(let i=1;i<path.length;i++){
    const next=path[i];if(next.event.lines)break;
    if(next.event.cells.some(([x])=>x>=4&&x<7)){
     if(center(next)&&next.event.type===partner&&facts.structure?.center.completions.some(c=>c.piece===partner&&c.resultStatus==='level'&&c.patternSupport==='reference-supported'&&key(c.cells)===key(next.event.cells)))pair={status:'completed-in-checked-prefix',step:1,orderedPieces:[first.event.type,partner],completionLock:i+1};
     break;
    }
   }
  }
  if(pair?.status==='completed-in-checked-prefix'&&pair.step===1){
   const [a,b]=pair.orderedPieces;structural=`Place ${a} in the Center. ${pair.completionLock===2?'Then place '+b:'The checked sequence later places '+b} to complete the ${a}/${b} overhang.`;add('SHOCKY-3.2','FLAME-CENTER');
  }else if(pair?.status==='completed'&&pair.step===2){structural=`Complete the ${pair.orderedPieces.join('/')} center overhang as shown.`;add('SHOCKY-3.2','FLAME-CENTER');}
  else if(facts.allocation==='horizontal-left-I'&&facts.structure?.left.flat){structural='Place I across the Left as shown.';add('SHOCKY-LEFT','FLAME-LEFT');}
  else if(facts.allocation==='center-partner-preparation'){structural='Build the Center as shown. A completing placement has not been checked yet.';add('SHOCKY-3.2','FLAME-CENTER');}
  else if(facts.allocation==='center-completion'){structural=new Set(facts.structure?.center.profile).size===1?'Complete the center overhang with a level top.':'Build the Center as shown; more work is needed to finish the overhang.';add('SHOCKY-3.2','FLAME-CENTER');}
  else if(facts.allocation==='quad-preparation'){structural='Prepare the I-piece Tetris on the Right, keeping the Well (column 8) open.';add('SHOCKY-3.1','FLAME-TETRIS');}
  else if(facts.allocation==='right-cap-preparation'){structural='Rebuild the Z cap over the Pocket (column 10) as shown.';add('SHOCKY-1');
   const follow=path.slice(1);if(follow.length&&follow.every(p=>!p.event.lines&&p.event.cells.every(([x])=>x<4)))structural+=` Then build the Left with ${follow.map(p=>p.event.type).join(' then ')}.`;
  }else if(facts.allocation==='left-filler'){structural='Build within the Left four columns.';add('SHOCKY-LEFT');}
  let tactical;
  if(tsdAt>=0){tactical=tsdAt===0?'Take the T-spin double.':`This checked sequence reaches a T-spin double in ${tsdAt+1} placements, including this one.`;add('SHOCKY-3.1');}
  else{
   const quad=first.event.type==='I'&&first.event.lines===4;
   const column=first.event.cells[0][0]+1;
   tactical=quad?`Take the Tetris in ${column===8?'the Well (column 8)':column===10?'the Pocket (column 10)':'column '+column}. `:first.event.lines===0?'Place here without clearing a line. ':'Place here. ';
   if(assessment.right?.entry?.status==='reachable-if-T-available')tactical+='At the end of this sequence, a T-spin-double entry is reachable if a T is available.';
   else if(assessment.channel?.openBelowStack){tactical+='At the end of this sequence, the Well (column 8) stays below the Left and Center stacks.';add('SHOCKY-1');}
   else tactical+='The end position still needs rebuilding on the Right. Continued ST play is not established.';
   if(first.event.type==='I'&&first.event.lines===4)add('SHOCKY-3.1','FLAME-TETRIS');
  }
  structural=[structural,tactical].filter(Boolean).join(' ');
 }
 if(facts.levelBaseReentry)structural+=' This one placement restores a recognized Center pattern from the level-two base. It does not repair existing Left gaps or prove the next score.';
 return{reason:holdPrompt(first)+structural,sources:[...ids].map(id=>({...ADVICE_SOURCES[id]}))};
}
function observe(input){
 const s=R.createState({rules:input.rules,board:input.board,active:input.active,hold:input.hold,canHold:input.canHold,queue:input.queue,revision:input.revision,streamCursor:input.streamCursor,topOut:input.topOut});
 if(input.bag)s.bag=clone(input.bag);return s;
}
// Opening-only cavity query; independent reference tests bind both assessment
// modes to the same top-connected sealed-air set.
function cavityAssessment(board){
 const air=new Uint8Array(400),todo=new Uint16Array(400);let tail=0;
 for(let x=0;x<10;x++)if(board[0][x]==='.') {air[x]=1;todo[tail++]=x;}
 // Enqueue each reachable cell once. This is the same top-connected air
 // flood, not tetromino access; marking on enqueue avoids duplicate work.
 for(let i=0;i<tail;i++){const key=todo[i],x=key%10,y=Math.floor(key/10);
  if(x>0&&!air[key-1]&&board[y][x-1]==='.') {air[key-1]=1;todo[tail++]=key-1;}
  if(x<9&&!air[key+1]&&board[y][x+1]==='.') {air[key+1]=1;todo[tail++]=key+1;}
  if(y>0&&!air[key-10]&&board[y-1][x]==='.') {air[key-10]=1;todo[tail++]=key-10;}
  if(y<39&&!air[key+10]&&board[y+1][x]==='.') {air[key+10]=1;todo[tail++]=key+10;}
 }
 const sealedCells=[];for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(board[y][x]==='.'&&!air[y*10+x])sealedCells.push([x,y]);
 return{sealedCells};
}
function assess(board,{cavitiesOnly=false}={}){
 if(cavitiesOnly)return cavityAssessment(board);
 const heights=Array.from({length:10},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
 // Air flood identifies sealed cavities, not every roofed cell. A T-slot under
 // an overhang can be accessible from the side and is not automatically bad.
 const {sealedCells,sealed,covered,leftSealed}=S.cavityFacts(board,heights);
 const slots=[];for(let y=Math.max(17,40-Math.max(...heights)-4);y<39;y++)for(let x=5;x<9;x++)for(let rotation=0;rotation<4;rotation++){
  const a={type:'T',x,y,rotation,lastRotation:{from:(rotation+3)%4,to:rotation,kickIndex:0}};
  if(!R.fits(board,a)||R.fits(board,{...a,y:y+1})||R.spin(board,a)==='none')continue;
  const cells=R.cells(a),rowSet=new Set(cells.map(c=>c[1]));let lines=0;for(const ry of rowSet)if([...board[ry]].every((v,cx)=>v!=='.'||cells.some(([xx,yy])=>xx===cx&&yy===ry)))lines++;
  if(lines===2)slots.push({x,y,rotation,lines,access:'geometry-only'});
 }
 const uniqueSlots=[...new Map(slots.map(s=>[`${s.x},${s.y}`,s])).values()];
 const left=heights.slice(0,4),center=heights.slice(4,7),right=heights.slice(7);
 const roughness=left.slice(1).reduce((n,h,i)=>n+Math.abs(h-left[i]),0);
 const maxHeight=Math.max(...heights), rightHeight=Math.max(...right),leftHeight=Math.max(...left),centerHeight=Math.max(...center);
 // Right-hand ST reservoir: estimate, not legality or a proof of continuation.
 const imbalance=Math.max(0,rightHeight-Math.max(leftHeight,centerHeight)+3);
 const regionImbalance=Math.max(0,Math.abs(centerHeight-leftHeight)-4);
 const partnerDeficit=center.reduce((sum,h)=>sum+centerHeight-h,0);
 const establishedBase=leftHeight>=2&&centerHeight>=3&&heights.slice(0,7).filter(h=>h>=2).length>=5;
 // Input may be between stable shapes after a checked clear. Broader admission
 // does not certify it: the returned endpoint must still satisfy strict support.
 const recoverableBase=establishedBase||(leftHeight>=1&&centerHeight>=5&&heights.slice(0,7).filter(h=>h>=1).length>=4);
 const maintenanceScope=recoverableBase&&heights[7]<Math.max(leftHeight,centerHeight);
 const regionalSupport=establishedBase&&heights[7]<=Math.min(leftHeight,centerHeight)-2;
 return {maintenanceScope,regionalSupport,regionImbalance,channel:{column:7,height:heights[7],openBelowStack:heights[7]<=Math.min(leftHeight,centerHeight)-2},heights,maxHeight,headroom:20-maxHeight,sealed,sealedCells,leftSealed,covered,damageSealed:sealed,damageCovered:covered,left:{height:leftHeight,roughness},center:{height:centerHeight,profile:center,partnerDeficit,partnerStatus:partnerDeficit?'unfinished-open-surface':'level-surface'},right:{height:rightHeight,slots:uniqueSlots},
  obligations:uniqueSlots.map(s=>({kind:'T-slot',demands:['T'],status:'unresolved',at:[s.x,s.y],note:'Geometric slot; arrival and executable entry not yet proved.'})).concat(partnerDeficit?[{kind:'center-partner',demands:[],openSurfaceCells:partnerDeficit,status:'unresolved',note:'Uneven center surface, not a requirement to fill every gap; compatible piece identity must be established by a checked continuation, not guessed from a silhouette.'}]:[]),
  estimate:-leftSealed*12-(sealed-leftSealed)*2-covered-roughness*1.3-imbalance*4-regionImbalance*4-maxHeight*.3,
  assumptions:['Structural estimates are heuristic; only the returned input prefix is verified.']};
}
// Full assessment depends only on the raw board and the fixed full mode. Phase,
// supply and mutable candidate annotations are added later and are not cached.
// A reader belongs to one planCore invocation, including a separate reader for
// nested plans. Never expose its pristine bases to callers or keep it globally.
function createAssessmentReader(read=assess){const cache=new Map();
 const copy=value=>{if(Array.isArray(value))return value.map(copy);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value))out[key]=copy(value[key]);return out;}return value;};
 return board=>{const key='full:'+board.join('');let base=cache.get(key);
  if(base===undefined){base=read(board);if(cache.size>=256)cache.delete(cache.keys().next().value);}
  else cache.delete(key);
  cache.set(key,base);
  // Preserve numeric identity (including -0); JSON cloning would change it.
  return copy(base);
 };
}
const cavityRepairDebt=S.cavityRepairDebt;
const centerCellsKey=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));
function centerReservationStep(before,p,inherited=[],notches){
 // Reserve only known finishing placements, not every hypothetical preparatory
 // silhouette. Ordinary shape transformations remain governed by geometry.
 const completions=S.geometry(before.board,{notches:notches??S.notchPattern(before.board)}).center.completions.filter(c=>c.resultStatus==='level'&&c.patternSupport==='reference-supported');
 const matches=c=>c.piece===p.event.type&&centerCellsKey(c.cells)===centerCellsKey(p.event.cells);
 const completed=completions.filter(matches).map(c=>({piece:c.piece,cells:c.cells.map(c=>c.slice())}));
 // The target must still be a recognized safe completion after any support
 // changes, not merely the same tetromino placed at remembered coordinates.
 let debt=inherited.filter(group=>!completed.length||!group.alternatives.some(matches));
 const cleared=p.event.clearedRows||[];
 const translate=cells=>cells.map(([x,y])=>[x,y<0||cleared.includes(y)?-1:y+cleared.filter(r=>r>y).length]);
 if(!completed.length&&completions.some(c=>c.piece===p.event.type)){
  const alternatives=completions.map(c=>({piece:c.piece,cells:c.cells.map(c=>c.slice())}));
  const key=JSON.stringify(alternatives);if(!debt.some(g=>JSON.stringify(g.alternatives)===key))debt=[...debt,{alternatives}];
 }
 debt=debt.map(group=>({alternatives:group.alternatives.map(c=>({...c,cells:translate(c.cells)}))}));
 return {debt,completed};
}
// Normalize completion identity through the exact clear map, not total lines.
// New rows entering the top have no root-cell identity and cannot substitute
// for an older reservation merely because their coordinates happen to match.
function centerGoalKeys(path){let rows=Array.from({length:40},(_,y)=>y);const keys=[];
 for(const p of path){for(const goal of p.structuralEvidence?.centerReservation?.completed||[]){
  if(goal.cells.every(([,y])=>rows[y]!==null&&rows[y]!==undefined))keys.push(goal.piece+':'+centerCellsKey(goal.cells.map(([x,y])=>[x,rows[y]])));
 }const cleared=p.event.clearedRows||[];rows=[...Array(cleared.length).fill(null),...rows.filter((_,y)=>!cleared.includes(y))];}
 return [...new Set(keys)];
}
// A finite preparation is the executed placement, not a promise that its
// hypothetical partner arrives. Normalize identities through actual clears.
function centerStageKeys(path){let rows=Array.from({length:40},(_,y)=>y);const keys=[];
 for(const p of path){const t=p.structuralEvidence,c=t?.structure?.center;
  if(t?.pairProgress?.step===1&&Array.isArray(t.pairProgress.completion?.cells)&&c&&reusableCenter(c)&&p.event.cells.every(([,y])=>rows[y]!=null)){
   const partner=t.pairProgress.completion;
   if(partner.cells.every(([,y])=>rows[y]!=null))keys.push(p.event.type+':'+centerCellsKey(p.event.cells.map(([x,y])=>[x,rows[y]]))+':'+partner.piece+':'+centerCellsKey(partner.cells.map(([x,y])=>[x,rows[y]])));
  }
  const cleared=p.event.clearedRows||[];rows=[...Array(cleared.length).fill(null),...rows.filter((_,y)=>!cleared.includes(y))];
 }return [...new Set(keys)];
}
function certifiedCavities(n){
 // Replanning begins after every lock. Do not issue a first placement with
 // unresolved new sealing debt: a later repair witness is not a persistent
 // commitment in the next observation. This is uncertified, not illegal.
 return !n.centerDebt.length&&!n.cavityDebt.length&&!n.path[0].structuralEvidence.cavityRepair.cells.length;
}
function repairedPrefix(state,steps){
 let before=assess(state.board),debt=[],centerDebt=[];
 for(let i=0;i<steps.length;i++){const replay=R.replay(state,steps[i].witness);if(!replay.valid||replay.events.length!==1)return false;const after=assess(replay.state.board);centerDebt=centerReservationStep(state,{state:replay.state,event:replay.events[0]},centerDebt).debt;debt=cavityRepairDebt(before,after,replay.events[0],debt);if(i===0&&debt.length)return false;state=replay.state;before=after;}
 return debt.length===0&&centerDebt.length===0;
}
// Resource accounting describes executed locks, not a quota or a ban on Reset
// fillers. Only a verified route creates a reservation across replanning.
function policyWitnesses(state){
 const starts=[{state,witness:[]}];let held=state;
 for(let i=1;i<=2;i++){const next=R.move(held,'HOLD');if(next===held||next.topOut)break;held=next;starts.push({state:held,witness:Array(i).fill('HOLD')});}
 const hasCap=from=>S.geometry(from.board).right.completions.some(c=>{
  const r=R.replay(from,c.witness);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&!r.events[0].lines&&JSON.stringify(r.events[0].cells)===JSON.stringify(c.cells);
 });
 const availableCap=starts.some(a=>a.state.active?.type==='Z'&&hasCap(a.state));
 let availableCleanupPreparation=false;
 if(S.geometry(state.board).right.cycle.prepareColumn!==null)for(const a of starts){
  if(a.state.active?.type!=='I')continue;let cur=a.state,witness=a.witness.slice();
  for(let turns=0;turns<4&&cur.active.rotation!==1;turns++){const n=R.move(cur,'CW');if(n===cur)break;cur=n;witness.push('CW');}
  while(cur.active.x!==7){const move=cur.active.x<7?'R':'L',n=R.move(cur,move);if(n===cur)break;cur=n;witness.push(move);}
  if(cur.active.rotation!==1||cur.active.x!==7)continue;
  const r=R.replay(state,[...witness,'HD']);if(!r.valid||r.events.length!==1||S.transition(state,{state:r.state,event:r.events[0]}).allocation!=='quad-preparation')continue;
  let z=r.state;if(z.active?.type!=='Z')z=R.move(z,'HOLD');
  if(z.active?.type==='Z'&&!z.topOut&&hasCap(z)){availableCleanupPreparation=true;break;}
 }
 return {availableCap,availableCleanupPreparation};
}
function cycleResources(path){
 const events=path.map(p=>p.event),tsds=events.filter(e=>e.type==='T'&&e.spin==='full'&&e.lines===2).length;
 const quads=events.filter(e=>e.type==='I'&&e.lines===4).length;
 const pocket=path.filter(p=>p.event.type==='I'&&!p.event.lines&&p.structuralEvidence?.allocation==='quad-preparation').length;
 let outstandingPocket=0;for(const p of path){if(p.event.type==='I'&&!p.event.lines&&p.structuralEvidence?.allocation==='quad-preparation')outstandingPocket++;if(p.event.type==='I'&&p.event.lines===4)outstandingPocket=Math.max(0,outstandingPocket-1);}
 return {leftFoundations:path.filter(p=>p.structuralEvidence?.leftFoundation?.completed).length,centerPreparations:centerStageKeys(path).length,centerCompletions:centerGoalKeys(path).length,locks:path.length,lines:events.reduce((n,e)=>n+e.lines,0),materialDelta:4*path.length-10*events.reduce((n,e)=>n+e.lines,0),tsds,quads,pocket,outstandingPocket,
  tFillers:events.filter(e=>e.type==='T'&&!e.lines).length,iFillers:events.filter(e=>e.type==='I'&&!e.lines&&e.cells.some(([x])=>x<7)).length};
}
function resourceGoal(path){const r=cycleResources(path);return r.tsds+r.quads+r.pocket+r.centerCompletions+r.centerPreparations+r.leftFoundations>0;}
// Compare only the resources protected by the outstanding goal. Incidental I
// use on a T-only route is not an I reservation. Trailing post-goal filler must
// not make an otherwise equivalent proof appear longer or more wasteful.
function resourceGoalPrefix(path,goal){
 const centerGoals=centerGoalKeys(goal),primary=cycleResources(goal),stageGoals=primary.tsds+primary.quads+primary.pocket+primary.centerCompletions?[]:centerStageKeys(goal),hasCenter=prefix=>centerGoals.every(key=>centerGoalKeys(prefix).includes(key))&&stageGoals.every(key=>centerStageKeys(prefix).includes(key));
 const required=cycleResources(goal),fulfils=a=>a.tsds>=required.tsds&&a.quads>=required.quads&&a.outstandingPocket+Math.max(0,a.quads-required.quads)>=required.outstandingPocket;
 let b=required;for(let length=1;length<=goal.length;length++){const prefix=cycleResources(goal.slice(0,length));if(fulfils(prefix)&&hasCenter(goal.slice(0,length))){b=prefix;break;}}
 for(let length=1;length<=path.length;length++){
  const a=cycleResources(path.slice(0,length));
  if(fulfils(a)&&hasCenter(path.slice(0,length))&&
   (!b.tsds||a.tFillers<=b.tFillers)&&(!(b.quads+b.outstandingPocket)||a.iFillers<=b.iFillers))return length;
 }
 return null;
}
// A saved executable score has a timing promise as well as a count. Compare
// each required TSD/quad separately: a later mixed Center/Pocket goal must not
// hide delaying an earlier score. This is a replacement rule, not a global
// preference to score immediately or authority supplied by imported telemetry.
function scoringSchedule(path){
 const schedule={tsds:[],quads:[]};path.forEach((p,i)=>{if(p.event.type==='T'&&p.event.spin==='full'&&p.event.lines===2)schedule.tsds.push(i+1);if(p.event.type==='I'&&p.event.lines===4)schedule.quads.push(i+1);});return schedule;
}
function scoringReplacement(candidate,saved,goal){
 const required=scoringSchedule(goal.path),fresh=scoringSchedule(candidate.path),delayed=[];
 for(const kind of ['tsds','quads'])for(let i=0;i<required[kind].length;i++)if(fresh[kind][i]===undefined||fresh[kind][i]>required[kind][i])delayed.push({kind,index:i+1,savedLock:required[kind][i],freshLock:fresh[kind][i]??null});
 if(!delayed.length)return{allowed:true,reason:'no-protected-score-delay',required,fresh,delayed};
 if(delayed.some(p=>p.freshLock===null))return{allowed:false,reason:'missing-protected-score',required,fresh,delayed};
 if(candidate.path.length!==saved.path.length)return{allowed:false,reason:'no-equal-horizon-benefit-proof',required,fresh,delayed};
 const a=candidate.assessment,b=saved.assessment,mass=n=>n.state.board.reduce((sum,row)=>sum+[...row].filter(c=>c!=='.').length,0),am=mass(candidate),bm=mass(saved);
 // Reuse the conservative construction dominance precedent. A blended
 // structural estimate, more Center height, or fewer inputs alone is not
 // concrete evidence for delaying the score. Final admission still proves
 // all actual movement, resource, cavity and notch obligations.
 const noRegression=a.maxHeight<=b.maxHeight&&am<=bm&&a.sealed<=b.sealed&&a.structure.left.covered<=b.structure.left.covered&&(candidate.centerContinuity??0)>=(saved.centerContinuity??0);
 const benefit=noRegression&&(a.maxHeight<b.maxHeight||am<bm);
 return{allowed:benefit,reason:benefit?'endpoint-dominance':'delay-without-concrete-benefit',required,fresh,delayed,endpoint:{fresh:{maxHeight:a.maxHeight,mass:am,sealed:a.sealed,leftCovered:a.structure.left.covered,centerContinuity:candidate.centerContinuity??0},saved:{maxHeight:b.maxHeight,mass:bm,sealed:b.sealed,leftCovered:b.structure.left.covered,centerContinuity:saved.centerContinuity??0}}};
}
function coversResourceGoal(candidate,committed){return resourceGoalPrefix(candidate.path,committed.path)!==null;}
function sameObservedResult(expected,actual){return expected.rules===actual.rules&&JSON.stringify(expected.board)===JSON.stringify(actual.board)&&expected.hold===actual.hold&&expected.active?.type===actual.active?.type&&expected.canHold===actual.canHold&&expected.topOut===actual.topOut&&expected.queue.every((t,i)=>actual.queue[i]===t);}
function committedNode(s,proof,roots,initial,readAssessment=assess){
 if(!proof?.observation||!proof.advice?.continuation?.length)return null;
 let origin;try{origin=observe(proof.observation);}catch{return null;}if(R.validate(origin).length)return null;
 const steps=proof.advice.continuation;if(steps.length>7||!resourceGoal(steps))return null;
 const expected=R.replay(origin,steps[0].witness);if(!expected.valid||expected.events.length!==1)return null;
 let first=roots.find(p=>JSON.stringify(p.event)===JSON.stringify(expected.events[0])&&sameObservedResult(expected.state,p.state));
 // A budget-truncated enumeration must not discard an already executable
 // exact witness. Replay is bounded by the saved public prefix, not search.
 if(!first){const r=R.replay(s,steps[0].witness);if(r.valid&&r.events.length===1&&JSON.stringify(r.events[0])===JSON.stringify(expected.events[0])&&sameObservedResult(expected.state,r.state))first={state:r.state,event:r.events[0],target:r.events[0].target,witness:steps[0].witness,hold:steps[0].witness.includes('HOLD')};}
 if(!first)return null;const rootIndex=roots.indexOf(first),flags=policyWitnesses(s);
 first={...first,availableCap:first.availableCap||flags.availableCap,availableCleanupPreparation:first.availableCleanupPreparation||flags.availableCleanupPreparation};
 let n=nodeFor(first,null,initial,rootIndex,readAssessment);
 for(const step of steps.slice(1)){const r=R.replay(n.state,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event))return null;
  n=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(n.state)},n,initial,n.rootIndex,readAssessment);
 }
 return resourceGoal(n.path)&&n.path.every(p=>S.canonicalClear(p.event))&&n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport?n:null;
}
function sameConstructionResult(expected,actual){
 if(expected.rules!==actual.rules||JSON.stringify(expected.board)!==JSON.stringify(actual.board)||expected.hold!==actual.hold||expected.canHold!==actual.canHold||expected.topOut!==actual.topOut||(expected.active&&expected.active.type!==actual.active?.type)||!expected.queue.every((t,i)=>actual.queue[i]===t))return false;
 if(expected.bag){if(!actual.bag)return false;let bag=expected.bag;const revealed=expected.active?actual.queue.slice(expected.queue.length):[...(actual.active?[actual.active.type]:[]),...actual.queue];for(const t of revealed)bag=B.consume(bag,t);if(JSON.stringify(bag)!==JSON.stringify(actual.bag))return false;}
 return true;
}
// A deliberately narrow Reset-entry policy, not a universal timing rule.
// Shocky Ch4 motivates rebuilding depleted Center support; page366 is the
// finite recovery example and page813 is the ordinary-scoring counterexample.
// The height cutoffs below describe THIS coach's coverage, not community laws.
function resetCandidate(s,initial){
 const result=(status,reason)=>({policy:'joint-low-visible-pair-v2',status,reason,
  ordinaryComparison:initial.maintenanceScope?'ordinary-geometric-profile':'ordinary-profile-unsupported',
  source:'SHOCKY-4',claim:'Finite recovery preference within coach coverage; not proof that ordinary play is impossible or a complete Reset.',
  resourceRenewal:false});
 if(s.topOut||!s.active)return result('out-of-scope','A live active piece is required.');
 if(['broken','invalid-history'].includes(initial.notches.status))return result('out-of-scope','Scoring-notch history is broken or unverified; do not initiate recovery.');
 if(initial.maintenanceScope)return result('ordinary-preferred','Ordinary geometric profile is present; this is not proof of an executable maintenance continuation.');
 if(initial.left.height>initial.right.height+2||initial.center.height>initial.right.height+2||Math.abs(initial.left.height-initial.center.height)>3)return result('not-ready','Right must have nearly caught both Left and Center, with Left/Center mutually balanced; this is a narrow engineering envelope, not a universal Reset timing rule.');
 if(initial.left.height<2||initial.center.height>=3||initial.notches.status!=='established')return result('out-of-scope','This is not the supported established-stack depleted-Center case.');
 const right=S.geometry(s.board).right;
 if(right.shapeStatus!=='staggered-scoring-wall')return result('out-of-scope','An established staggered scoring wall is required.');
 if(right.completions.length||right.cycle.prepareColumn!==null||right.cycle.cleanupColumns.length)return result('competing-demand','Cap or I cleanup demand must not be displaced by this recovery.');
 const visible=[s.active.type,s.hold,...s.queue].filter(Boolean);
 if(visible.filter(p=>p==='T').length<3)return result('visible-supply-unproved','Two repair Ts and a scoring T are not all visible; do not assume future arrivals.');
 return result('candidate','Center is below the supported maintenance profile; a complete visible paired-T recovery must still be proved.');
}
function resetSelection(raw,options={}){
 let s;try{s=observe(raw);if(R.validate(s).length||(s.bag&&B.validate(s.bag).length))throw new Error('invalid');}catch{return{policy:'joint-low-visible-pair-v2',status:'invalid-observation',resourceRenewal:false};}
 return resetCandidate(s,{...assess(s.board),notches:H.resolve(s,options.patternHistory)});
}
// Construction history is an executable public proof, never an imported mode.
// Recreate its complete route and bind the consumed prefix to the current board.
function verifyConstruction(proof,options={}){return proof.kind==='left-support'?Y.supportValidate(proof.origin,proof.steps,options):proof.kind==='left-foundation'?Y.validate(proof.origin,proof.steps,options):X.validateCertificate(proof.origin,proof.steps,{...options,kind:proof.kind});}
// A chosen macro retains its proof-specific fields, but never discards work
// already spent searching and certifying competing continuations.
function constructionMetrics(candidate,spent,elapsedMs){return{...spent,...candidate.metrics,nodes:spent.nodes,elapsedMs};}
// Bind this new exception to the actual originally observed inventory. A
// later refill cannot be inserted retroactively into a copied proof origin.
function supportHistoryBinding(s,proof,verified,options,deadline,now,maxNodes){
 const prior=proof.resourceContext,current=options.resourceContext,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);let visited=0;
 const fail=()=>({valid:false,visited});
 try{
  if(!prior||!current||!Array.isArray(prior.steps)||!Array.isArray(current.steps)||prior.steps.length>current.steps.length||!same(prior.origin,current.origin)||prior.fresh!==current.fresh||prior.handoffAtAction!==current.handoffAtAction||!same(current.steps.slice(0,prior.steps.length),prior.steps))return fail();
  if(resourceSummary(proof.origin,{resourceContext:prior}).coverage.status!=='complete'||resourceSummary(s,options).coverage.status!=='complete')return fail();
  const tail=current.steps.slice(prior.steps.length);if(tail.length>1792||tail.filter(p=>p.action==='HD').length!==proof.consumed)return fail();
  let state=observe(proof.origin),locked=0;
  for(const step of tail){if(now()>=deadline||visited>=maxNodes)return fail();visited++;const next=R.move(state,step.action);if(next===state)return fail();
   if(step.action==='HD'&&!same(next.lastEvent,verified.continuation[locked++]?.event))return fail();
   state={...next,queue:[...next.queue,...step.revealed]};for(const piece of step.revealed)if(state.bag)state={...state,bag:B.consume(state.bag,piece)};
  }
  const actual=observe(state),expected=observe(s);delete actual.revision;delete expected.revision;return{valid:same(actual,expected),visited};
 }catch{return fail();}
}
function constructionAdvice(s,proof,deadline=Infinity,now=()=>Date.now(),maxNodes=12000,budgetTracker=null,historyOptions={}){
 if(proof?.kind==='left-support'&&historyOptions.allowHold===false)return null;
 if(!proof||!Number.isInteger(proof.consumed)||proof.consumed<0||proof.consumed>=proof.steps?.length)return null;
 let visited=0;const charge=n=>{visited+=n||0;if(budgetTracker)budgetTracker.nodes+=n||0;};
 if(!proof.kind&&resetSelection(proof.origin).status!=='candidate')return null;
 const verified=verifyConstruction(proof,{timeMs:Math.max(0,Math.min(750,deadline-now())),deadline,now,maxNodes});charge(verified.visited);if(!verified.valid)return null;
 if(proof.kind==='left-support'){
  const binding=supportHistoryBinding(s,proof,verified,historyOptions,deadline,now,Math.max(0,maxNodes-visited));charge(binding.visited);if(!binding.valid)return null;
  const replayUnits=verified.continuation.reduce((n,p)=>n+p.witness.length,0);if(now()>=deadline||visited+replayUnits>maxNodes)return null;charge(replayUnits);
  const paid=ordinaryResourceCheck(proof.origin,verified.continuation,{resourceContext:proof.resourceContext}),r=paid.resource;
  if(!paid.valid||!r||r.pendingCenter.length||r.hangingS.length||r.centerBlocked||r.tCollision||r.unclassifiedS?.some(p=>p.invalidated||p.requiresAccommodation))return null;
 }

 let expected=observe(proof.origin);
 for(const step of verified.continuation.slice(0,proof.consumed))expected=R.replay(expected,step.witness).state;
 if(JSON.stringify(expected.board)!==JSON.stringify(s.board))return null;
 let current=s;const continuation=[];
 for(const [index,step]of verified.continuation.slice(proof.consumed).entries()){
  const expectedAfter=R.replay(expected,step.witness).state;
  const matches=r=>r.valid&&r.events.length===1&&JSON.stringify(r.events[0])===JSON.stringify(step.event)&&sameConstructionResult(expectedAfter,r.state);
  let witness=step.witness,r=R.replay(current,witness);
  if(!matches(r)&&index===0){
   // The user may already have followed HOLD/movement inputs, or switched
   // active and held pieces. Bind an equivalent actual first-lock witness to
   // the SAME verified event and public result, never just a saved mode flag.
   for(let k=1;k<step.witness.length;k++){const prefix=R.replay(expected,step.witness.slice(0,k));if(!prefix.valid||!sameObservedResult(prefix.state,current))continue;
    const trial=R.replay(current,step.witness.slice(k));if(matches(trial)){witness=step.witness.slice(k);r=trial;break;}
   }
   if(!matches(r)&&now()<deadline&&visited<maxNodes){const e=R.placements(current,{deadline,now,maxNodes:maxNodes-visited});charge(e.visited);const found=e.placements.find(p=>JSON.stringify(p.event)===JSON.stringify(step.event)&&sameConstructionResult(expectedAfter,p.state));if(found){witness=found.witness;r={valid:true,state:found.state,events:[found.event]};}}
  }
  if(!matches(r))return null;
  current=r.state;expected=expectedAfter;continuation.push({...step,witness,target:step.event.target,hold:witness.includes('HOLD'),holdCount:holdCount({witness}),resultContext:context(current)});
 }
 if(proof.kind==='left-support'&&(now()>=deadline||visited>maxNodes))return null;
 const first=continuation[0],done=verified.continuation.slice(0,proof.consumed);
 const resetOrigin=!proof.kind?resetSelection(proof.origin):null;
 const resetDecision=resetOrigin?.status==='candidate'?{...resetOrigin,status:proof.consumed?'continuing':'selected',
  reason:'Prefer the checked paired-T recovery to abstention outside the ordinary maintenance profile.',
  certifiedLocks:verified.continuation.length,consumedLocks:proof.consumed}:null;
 const presentation=advicePresentation(continuation,assess(current.board),proof);
 if(resetDecision)presentation.reason+=' '+(proof.consumed?'Continue the checked depleted-Center recovery.':'Use this recovery because Center is below the coach’s ordinary maintenance profile, not because all ordinary play is impossible.');
 const parity=done.filter(p=>p.event.type==='T'&&!p.event.lines).reduce((v,p)=>v+p.event.cells.reduce((n,[x,y])=>n+((x+y)%2?1:-1),0),0);
 return {status:'recommended-with-verified-prefix',revision:s.revision,context:context(s),target:first.target,hold:first.hold,holdCount:first.holdCount,witness:first.witness,continuation,
  ...presentation,
  metrics:{nodes:visited,endpointMass:current.board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0),depth:continuation.length,completeDepth:continuation.length,elapsedMs:verified.elapsedMs},assessment:assess(current.board),
  evidence:{strategy:proof.kind==='cap-deferral'?'finite-cap-deferral':'finite-regional-repair',...(resetDecision?{resetSelection:resetDecision}:{}),construction:clone(proof),cycleResources:cycleResources(continuation),cycleDebt:0,verifiedLocks:continuation.length,knownPieceHorizon:s.queue.length+1,
   constructionStage:{parity,capDebt:verified.cap&&proof.consumed<=verified.cap.paidAt?verified.cap.targets:[],remainingLocks:continuation.length,zAllocation:'Only the executed public route is reserved; no Extra-Z history is inferred.',completion:proof.kind==='left-support'?'Finite Left support and actual Right-I replacement completed; no score or continued play is promised.':proof.kind==='left-foundation'?'Finite Left foundation completed; Center partner and future scoring remain unproved.':'Finite supported TSD endpoint, not a completed Reset.'},claim:'Finite executable regional repair; continued play is not guaranteed.'}};
}
function continueConstruction(before,after,advice,event,options={}){
 const proof=advice?.evidence?.construction;if(!proof)return null;
 const verified=verifyConstruction(proof,options);if(!verified.valid||!Number.isInteger(proof.consumed)||proof.consumed<0)return null;
 const expected=verified.continuation.slice(proof.consumed);
 if(!expected.length||JSON.stringify(expected.map(p=>p.event))!==JSON.stringify(advice.continuation.map(p=>p.event)))return null;
 const r=R.replay(observe(before),advice.witness);
 if(!r.valid||r.events.length!==1||JSON.stringify(expected[0].event)!==JSON.stringify(event)||JSON.stringify(r.events[0])!==JSON.stringify(event)||!sameObservedResult(r.state,observe(after)))return null;
 const tracker={nodes:verified.visited||0},suffix=constructionAdvice(observe(after),{...proof,consumed:proof.consumed+1},options.deadline,options.now,Math.max(0,(options.maxNodes??12000)-tracker.nodes),tracker,options);if(suffix)suffix.metrics.nodes=tracker.nodes;return suffix;
}
function continueCommitment(before,after,advice,actualEvent=after?.lastEvent,options={}){
 if(advice?.evidence?.construction){
  const now=options.now||(()=>Date.now()),deadline=options.deadline??now()+150,maxNodes=options.maxNodes??12000,suffix=continueConstruction(before,after,advice,actualEvent,{...options,now,deadline,maxNodes});if(!suffix)return null;
  const resources=checkedResourceEndpoint(after,suffix.continuation,{...options,now,deadline,maxNodes:Math.max(0,maxNodes-suffix.metrics.nodes)});suffix.metrics.nodes+=resources.visited||0;if(!resources.valid)return null;
  const access=A.prefix(observe(after),suffix.continuation,{notches:H.resolve(after,options.patternHistory),deadline,now,maxNodes:Math.max(0,maxNodes-suffix.metrics.nodes)});suffix.metrics.nodes+=access.visited;if(access.reachable!==true)return null;
  if(advice.evidence.construction.kind==='left-support'&&(now()>=deadline||suffix.metrics.nodes>maxNodes))return null;
  return{...suffix,metrics:{...suffix.metrics,certifiedHorizon:suffix.continuation.length},evidence:{...suffix.evidence,resourceObligations:{status:'checked',binding:resources.resource.originKey}}};
 }
 if(!advice?.continuation?.length||advice.continuation.length<2)return null;
 let origin,s;try{origin=observe(before);s=observe(after);}catch{return null;}if(R.validate(origin).length||R.validate(s).length)return null;
 const first=R.replay(origin,advice.continuation[0].witness);if(!first.valid||first.events.length!==1||!actualEvent||JSON.stringify(first.events[0])!==JSON.stringify(actualEvent)||!S.canonicalClear(actualEvent)||!sameObservedResult(first.state,s))return null;
 const steps=advice.continuation.slice(1);if(!resourceGoal(steps))return null;
 let current=extendForced(s),notches=H.resolve(s,options.patternHistory),debt=[],centerDebt=centerReservationStep(origin,{event:first.events[0],state:first.state}).debt,prior=assess(s.board);const continuation=[];if(['broken','invalid-history'].includes(notches.status))return null;
 for(const step of steps){const r=R.replay(current,step.witness);if(!r.valid||r.events.length!==1||JSON.stringify(r.events[0])!==JSON.stringify(step.event)||!S.canonicalClear(r.events[0]))return null;
  const nextPhase=S.advanceNotches(current.board,{event:r.events[0],state:r.state},notches);if(!nextPhase.valid)return null;
  const policy=policyWitnesses(current),transition=S.transition(current,{event:r.events[0],state:r.state,...policy},S.assess(r.state,{notches:nextPhase.pattern}),{notches});if(transition.cycleViolations.length)return null;
  const centerReservation=centerReservationStep(current,{event:r.events[0],state:r.state},centerDebt,notches);centerDebt=centerReservation.debt;
  const previousState=current,previousNotches=notches,check=S.advanceNotches(current.board,{event:r.events[0],state:r.state},notches),a=assess(r.state.board);if(!check.valid||a.maxHeight>=20)return null;
  debt=cavityRepairDebt(prior,a,r.events[0],debt);if(!continuation.length&&debt.length)return null;notches=check.pattern;prior=a;current=r.state;
  continuation.push({...step,resultContext:context(current),structuralEvidence:{...S.transition(previousState,{event:r.events[0],state:r.state},S.assess(r.state,{notches}),{notches:previousNotches}),structure:S.assess(r.state,{notches}),centerReservation}});
 }
 const bounds={...options,maxNodes:options.maxNodes??12000,deadline:options.deadline??Date.now()+150},resources=checkedResourceEndpoint(s,continuation,bounds);if(!resources.valid)return null;
 if(debt.length||centerDebt.length||!prior.regionalSupport||!resourceGoal(continuation))return null;
 const head=continuation[0],access=A.prefix(s,continuation,{...bounds,notches:H.resolve(s,options.patternHistory),maxNodes:Math.max(0,bounds.maxNodes-resources.visited)});if(access.reachable!==true)return null;return {...advice,target:head.target,witness:head.witness,hold:head.witness.includes('HOLD'),holdCount:holdCount(head),continuation,context:context(s),revision:s.revision,metrics:{...advice.metrics,certifiedHorizon:continuation.length,revalidationNodes:resources.visited+access.visited},
  ...advicePresentation(continuation,prior),evidence:{...advice.evidence,cycleResources:cycleResources(continuation),commitmentRetained:true,resourceObligations:{status:'checked',binding:resourceBinding(s,options)}}};
}
function context(s){return JSON.stringify([s.rules,s.board,s.hold,s.canHold,s.queue,s.bag??null,s.active?.type]);}
function stateKey(s){return JSON.stringify([s.rules,s.board,s.active,s.hold,s.canHold,s.queue,s.bag??null]);}
function nodeKey(n){return stateKey(n.state)+':notches:'+n.notches.status+':'+n.notches.anchorRow+':cavities:'+JSON.stringify(n.cavityDebt.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by))+':center:'+JSON.stringify(n.centerDebt)+':centerContinuity:'+Boolean(n.centerContinuityDebt)+':rootSeal:'+Boolean(n.path[0].structuralEvidence.cavityRepair.cells.length)+':resources:'+(n.resources?M.binding(n.resources):'none');}
function extendForced(state){return M.extendForced(state);}
// Only an actually verified first-TSD allocation can leave this narrow quality
// obligation pending. Projected progress is a preference, never an allowance or
// a replacement for the existing access, cycle, notch and resource certificates.
function openingQualityOrder(a,b){
 if(a.openingQualityProgress==null||b.openingQualityProgress==null)return 0;
 const center=(b.centerContinuity??0)-(a.centerContinuity??0);
 return center||b.openingQualityProgress-a.openingQualityProgress;
}
function compare(a,b){for(let i=0;i<a.rank.length;i++){if(i===3){const quality=openingQualityOrder(a,b);if(quality)return quality;}if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return a.key.localeCompare(b.key);}
// A three-row motif cannot certify a deeper missing column beneath it.
// Ordered center partners fit within a tetromino-height (three-step) envelope;
// taller open deficits remain legal, but require an actually completed repair.
const reusableCenter=c=>(!c.foundation||c.foundation.status==='aligned')&&c.status!=='unrecognized'&&c.patternSupport==='reference-supported'&&(!c.profile||Math.max(...c.profile)-Math.min(...c.profile)<=3);
// Ordinary Center search uses positive modular-pattern evidence, not merely a
// score penalty for an arbitrary silhouette. This is a conservative engine
// admission boundary, not a claim that other legal constructions are impossible.
// Keep this out of nodeFor/shared roots: independently replayed finite repair
// producers must retain their non-modular intermediate placements (e.g. OSIO).
const supportedCenterPattern=c=>c.patternSupport==='reference-supported'&&c.foundation?.status==='aligned';
function ordinaryCenterEligible(before,p,notches){
 if(p.event.lines!==0||!p.event.cells.every(([x])=>x>=4&&x<=6))return true;
 const phase=S.advanceNotches(before.board,p,notches??S.notchPattern(before.board));
 return phase.valid&&supportedCenterPattern(S.geometry(p.state.board,{notches:phase.pattern}).center);
}
function centerContinuityStep(before,after,event,debt=false){
 return !reusableCenter(after)&&(debt||(event.lines===0&&reusableCenter(before)));
}
function compareConstruction(a,b){for(let i=0;i<a.rank.length;i++){
 // Do not trade an established reusable center for unresolved construction
 // merely to improve an endpoint score or cash a nearby double. Temporary
 // departures remain legal and regain this preference after actual repair.
 if(i===3&&(a.centerContinuity??0)!==(b.centerContinuity??0))return (b.centerContinuity??0)-(a.centerContinuity??0);
 if(i===3){const quality=openingQualityOrder(a,b);if(quality)return quality;}
 if(a.rank[i]!==b.rank[i])return b.rank[i]-a.rank[i];}return a.key.localeCompare(b.key);}
// Keep the legacy comparator (and its deterministic fallback) unchanged.
// Reorder only slots belonging to the SAME complete continuation equivalence
// class. A pairwise "same horizon" comparator would not be transitive when a
// third, unequal-horizon candidate is interleaved by its target key.
function extraZTieClass(n){
 const r=n.resources,a=n.assessment;
 if(!n.extraZPreservable||!r||!['available','used'].includes(r.extraZ)||!n.path.length||
    !n.qualified||!n.notchValid||n.cycleDebt||!certifiedCavities(n)||a.maxHeight>=20||!a.regionalSupport||
    a.right.entry?.status==='unresolved-budget'||r.violations.length||r.centerBlocked||r.tCollision||
    r.pendingCenter.length||r.hangingS.length||r.hangingL.length||r.unclassifiedS?.length||r.unclassifiedL?.length)return null;
 // Exact existing quality values, horizon, debt and live identity supply must
 // match. Neither a structural-band tie alone nor an unused physical Z is
 // equivalent. No arbitrary ordering is introduced between different classes.
 return JSON.stringify([n.path.length,n.path.map((_,i)=>cycleResources(n.path.slice(0,i+1))),n.rank,n.structuralScore,n.centerContinuity,n.openingQualityProgress,
  n.dependencyDebt,n.entryDebt,a.maxHeight,a.sealed,a.covered,a.estimate,
  r.originKey,r.active,r.hold,r.queue,r.scoredTs]);
}
function orderContinuations(nodes){
 const ordered=[...nodes].sort(compareConstruction),groups=new Map();
 for(let i=0;i<ordered.length;i++){
  const key=ordered[i].continuationChecked===true?extraZTieClass(ordered[i]):null;if(key===null)continue;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 for(const slots of groups.values()){
  const members=slots.map(i=>ordered[i]);
  if(!members.some(n=>n.resources.extraZ==='available')||!members.some(n=>n.resources.extraZ==='used'))continue;
  const preferred=members.filter(n=>n.resources.extraZ==='available').concat(members.filter(n=>n.resources.extraZ==='used'));
  slots.forEach((slot,i)=>{ordered[slot]=preferred[i];});
 }
 return ordered;
}
// Certify the legacy winner first. A speculative preserving challenger may
// exhaust a proof budget, but cannot take away an already executable route.
function preserveExtraZ(baseline,nodes,{protect,certify}){
 const key=baseline&&extraZTieClass(baseline);
 if(key==null||baseline.resources.extraZ!=='used')return baseline;
 const challengers=nodes.filter(n=>n!==baseline&&n.resources?.extraZ==='available'&&extraZTieClass(n)===key).sort(compareConstruction);
 if(!challengers.length||!protect(baseline))return baseline;
 for(const n of challengers)if(certify(n))return n;
 return baseline;
}
function nodeFor(p,parent,initial,rootIndex,readAssessment=assess){
 const assessment=readAssessment(p.state.board),path=[...(parent?.path??[]),p];
 const before=parent?.state??initial.state,priorNotches=parent?.notches??initial.notches;
 const notchCheck=S.advanceNotches(before.board,p,priorNotches);
 const structure=S.assess(p.state,{notches:notchCheck.pattern});
 const transition=S.transition(before,p,structure,{notches:priorNotches});
 transition.futureNotches=notchCheck;
 // A crossing placement is not forbidden. Track its outstanding dependency,
 // rather than rewarding a short tactical event regardless of the rebuild.
 const dependencyDebt=Math.max(0,(parent?.dependencyDebt??0)+transition.dependencyDebt);
 const priorAssessment=parent?.assessment??initial;
 const cavityDebt=cavityRepairDebt(priorAssessment,assessment,p.event,parent?.cavityDebt);
 const centerReservation=centerReservationStep(before,p,parent?.centerDebt,priorNotches),centerDebt=centerReservation.debt;
 const resources=initial.resources?M.step(before,p,parent?.resources??initial.resources):null;
 // A prepared scoring cavity is an access obligation, not just an endpoint
 // bonus. Losing its geometry without clearing is a repair commitment; a later
 // checked rebuilding prefix can restore it. Geometry alone is not entry proof.
 const losesEntry=priorAssessment.right.slots.length>0&&!assessment.right.slots.length&&p.event.lines===0;
 const scoredCycle=(p.event.spin==='full'&&p.event.lines===2)||p.event.lines===4;
 const entryDebt=assessment.right.slots.length||scoredCycle?0:Math.max(parent?.entryDebt??0,losesEntry?1:0);
 assessment.structure=structure;
 assessment.obligations=structure.obligations.concat(assessment.obligations.filter(o=>o.kind==='T-slot'));
 const damage=Math.max(0,assessment.leftSealed-initial.leftSealed);
 const safe=assessment.maxHeight<20&&!p.event.topOut;
 const headroomRisk=Math.max(0,assessment.maxHeight-14)**2;
 const leftContext=L.evaluate(p.state,{heights:assessment.heights.slice(0,4),covered:structure.left.covered,resources,centerDebt,center:structure.center,right:structure.right});
 const structuralScore=structure.supportEstimate+assessment.estimate-damage*4-dependencyDebt*3-headroomRisk-entryDebt*12;
 assessment.leftContext=leftContext;
 assessment.structure.headroomRisk=headroomRisk;
 const tsds=path.filter(v=>v.event.spin==='full'&&v.event.lines===2).length;
 p.structuralEvidence={...transition,centerPartnerDeficitBefore:(parent?.assessment??initial).center.partnerDeficit,centerPartnerDeficitAfter:assessment.center.partnerDeficit,placedPiece:p.event.type,structure,dependencyDebt,entryDebt,nonclearScoringGeometryLost:losesEntry,centerReservation,cavityRepair:{status:cavityDebt.length?'requires-executed-repair':'no-outstanding-new-internal-cavity',cells:cavityDebt}};
 // General source/queue preferences only break ties after the numeric
 // priorities, including executed TSD, verified entry and input effort. The
 // replay-bound pending-opening quality preference is compared separately,
 // after safety/cycle/Center continuity and before optional structural growth.
 // Nearby structural estimates are deliberately comparable. The finite
 // executable TSD then breaks ties; it cannot buy a poorer structural band.
 const cycleDebt=(parent?.cycleDebt??0)+transition.cycleViolations.length+(notchCheck.valid?0:1)+(resources?.violations.length||0);
 const rank=[safe?1:0,assessment.regionalSupport?1:0,cycleDebt?-cycleDebt:0,Math.floor(structuralScore/4),tsds*2,-path.reduce((n,v)=>n+v.witness.length+holdCount(v)*2,0),path.reduce((n,v)=>n+v.event.lines,0),leftContext.score];
 const priorCenter=(parent?.assessment.structure??S.geometry(before.board,{notches:priorNotches})).center;
 const centerDisrupted=p.event.lines===0&&reusableCenter(priorCenter)&&!reusableCenter(structure.center);
 const centerContinuityDebt=centerContinuityStep(priorCenter,structure.center,p.event,parent?.centerContinuityDebt);
 const centerContinuity=centerContinuityDebt?-1:0;
 assessment.structure.centerContinuity={disruptedWithoutClear:centerDisrupted,unresolved:centerContinuityDebt,endpointReusable:reusableCenter(structure.center),preference:centerContinuity};
 // Keep unclassified dispositions unresolved: dropping an identity from the
 // live list is not evidence that it was accommodated. No projected endpoint
 // updates the real replay ledger or manufactures Extra-Z eligibility.
 const openingQualityProgress=initial.openingQualityPending&&resources?-(resources.hangingS.length+resources.pendingCenter.length+resources.hangingL.length+(resources.unclassifiedS?.length||0)+(resources.unclassifiedL?.length||0)):null;
 if(openingQualityProgress!==null)assessment.structure.openingQuality={status:'pending-observed-quality',projectedUnresolved:-openingQualityProgress,baselineGranted:false};
 return{resources,extraZPreservable:initial.extraZPreservable===true,openingQualityProgress,centerContinuity,centerContinuityDebt,state:p.state,path,notches:notchCheck.pattern,notchValid:notchCheck.valid,assessment,rank,structuralScore,dependencyDebt,entryDebt,cycleDebt,cavityDebt,centerDebt,baseEstimateRank:rank[4],qualified:!assessment.right.slots.length,rootIndex,key:JSON.stringify(path[0].target)+':'+holdCount(path[0])};
}
function diversify(nodes,width){const sorted=[...nodes].sort(compare),chosen=[],roots=new Set(),groups=new Set();
 // Protect meaningfully different construction families, not just top-scoring
 // near-identical surfaces. This is diversity, not a canned move template.
 for(const n of sorted){const first=n.path[0],g=[first.target.type,holdCount(first),n.assessment.right.slots.length>0].join(':');if(!groups.has(g)){chosen.push(n);roots.add(n.rootIndex);groups.add(g);if(chosen.length===width)return chosen;}}
 for(const n of sorted)if(!roots.has(n.rootIndex)){chosen.push(n);roots.add(n.rootIndex);if(chosen.length===width)return chosen;}
 const keys=new Set(chosen.map(n=>nodeKey(n)));for(const n of sorted)if(!keys.has(nodeKey(n))){chosen.push(n);keys.add(nodeKey(n));if(chosen.length===width)break;}return chosen;}
// An exact level-two Center is a construction state, not generic maintenance
// readiness. Admit only a checked one-lock return to the existing strict shape
// contract. Neither assess(), opening handoff nor the ordinary beam is widened.
function levelBaseReentry(s,initial,base,options,readAssessment=assess){
 if(options.disableConstruction||options.constructionPrevious||initial.maintenanceScope||initial.left.height<2)return null;
 const level=S.centerLevelBase(s.board,initial.notches),right=S.geometry(s.board,{notches:initial.notches}).right;
 if(level.status!=='phase-aligned-level-base'||level.level!==2||right.shapeStatus!=='cleared-base')return null;
 // A saved one-lock re-entry remains a Center resource goal through movement
 // and HOLD. Other pending goals cannot be displaced by this shorter proof.
 const saved=options.commitment;
 if(saved&&saved.advice?.continuation?.length!==1)return null;
 const now=options.now,deadline=options.deadline,limit=options.maxNodes??45000;
 const metrics={attempted:1,examined:0,verified:0,selected:false,candidateScanComplete:false};
 base.metrics.levelBaseReentry=metrics;
 const root=R.placements(s,{allowHold:options.allowHold!==false,deadline,now,maxNodes:Math.max(0,limit-base.metrics.nodes)});
 base.metrics.nodes+=root.visited;base.metrics.roots=root.placements.length;
 const unavailable=()=>({...base,status:root.complete&&metrics.candidateScanComplete?'unsupported-position':'budget-exhausted',reason:'No checked one-placement return from this level-two Center base was found. Other continuations may exist.',assessment:initial});
 if(!root.complete)return unavailable();
 // A floor-based Right may not expose a geometric capDemand yet. Do not
 // spend or postpone an actually playable Z cap to broaden this S-only fix.
 // Availability comes from these real roots, including empty/double HOLD.
 if(root.placements.some(p=>p.event.type==='Z'&&!p.event.lines&&p.event.cells.every(([x])=>x>=7)&&S.advanceNotches(s.board,p,initial.notches).valid&&S.transition(s,p,undefined,{notches:initial.notches}).allocation==='right-cap-preparation')){
  metrics.blockedByAvailableCap=true;
  return{...base,status:'no-supported-continuation-found',reason:'An executable Z cap takes priority over optional Center re-entry. No supported one-lock continuation was certified.',assessment:initial};
 }
 const candidates=[];
 for(const [index,p]of root.placements.entries()){
  if(now()>=deadline)break;
  metrics.examined++;
  if(p.event.lines||!S.canonicalClear(p.event)||p.event.type!=='S'||!p.event.cells.every(([x])=>x>=4&&x<7))continue;
  const n=nodeFor({...p},null,initial,index,readAssessment);
  if(n.cycleDebt||!n.notchValid||!certifiedCavities(n)||n.assessment.maxHeight>=20||!n.assessment.regionalSupport||!reusableCenter(n.assessment.structure.center)||n.assessment.right.slots.length)continue;
  // Existing imported Left damage remains in the assessment. A reserved
  // notch is not access debt, but any other newly roofed cell blocks this
  // deliberately narrow admission rather than borrowing an unproved repair.
  if(A.newlyCovered(s.board,p.state.board,p.event,n.notches).length)continue;
  candidates.push(n);metrics.verified++;
 }
 metrics.candidateScanComplete=metrics.examined===root.placements.length;
 let best=candidates.sort(compareConstruction)[0];
 if(saved){
  const committed=committedNode(s,saved,root.placements,initial,readAssessment);
  best=committed&&candidates.find(n=>JSON.stringify(n.path[0].event)===JSON.stringify(committed.path[0].event)&&sameObservedResult(committed.state,n.state));
 }
 if(!best)return unavailable();
 const first=best.path[0],proof={status:'checked-one-lock-return',level:level.level,anchorRow:level.anchorRow,existingLeftCovered:best.assessment.structure.left.covered};
 first.structuralEvidence.levelBaseReentry=proof;
 metrics.selected=true;base.metrics.depth=1;base.metrics.completeDepth=metrics.candidateScanComplete?1:0;
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,...advicePresentation(best.path,best.assessment),
  continuation:[{target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,event:first.event,resultContext:context(first.state),structuralEvidence:first.structuralEvidence}],assessment:best.assessment,
  evidence:{strategy:'canonical-right-ST',levelBaseReentry:proof,cycleResources:cycleResources(best.path),commitmentRetained:Boolean(saved),futureNotches:best.notches,cycleDebt:0,cavityRepair:{status:'verified-prefix-repaired',outstandingCells:[]},verifiedLocks:1,tsdAt:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:true,budgetExhausted:!metrics.candidateScanComplete||now()>=deadline,informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:true,channel:best.assessment.channel,endpointTEntry:'not-established',unresolvedObligations:best.assessment.obligations,structure:best.assessment.structure,claim:'One executable return to a recognized Center pattern; existing damage and future scoring remain unresolved.'}};
}
function planCore(raw,options={}){
 const started=Date.now(),now=options.now??(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 let s;try{s=observe(raw);}catch(e){return{status:'invalid-input',revision:raw?.revision??0,target:null,reason:'This snapshot could not be read. Check its format and try again.',errors:[e.message]};}
 const errors=R.validate(s);if(s.bag)errors.push(...B.validate(s.bag));
 const base={revision:s.revision,target:null,hold:false,holdCount:0,witness:[],continuation:[],reason:'',metrics:{nodes:0,roots:0,rootExpanded:0,depth:0,completeDepth:0,elapsedMs:0},context:context(s)};
 if(errors.length)return{...base,status:errors.includes('unsupported-profile')?'unsupported-profile':'invalid-input',reason:'Unsupported or invalid snapshot: '+errors.map(e=>e.replaceAll('-',' ')).join('; ')+'.',errors};
 if(s.topOut)return{...base,status:'no-supported-continuation-found',reason:'This position has topped out. Reset to continue.'};
 if(!s.active)return{...base,status:'insufficient-known-pieces',reason:'This snapshot has no active piece. Import another position or reset.'};
 const observedPattern=H.resolve(s,options.patternHistory);if(['invalid-history','broken'].includes(observedPattern.status))return{...base,status:'no-supported-continuation-found',reason:observedPattern.status==='broken'?'A recognized T-slot opening in column 7 is filled. The coach does not support repairing this pattern yet.':'The recorded scoring-pattern evidence could not be verified. Reset or import a fresh snapshot before continuing.'};
 if(!options.disableOpening&&(options.openingPhase||s.board.every(r=>r==='..........'))){const opening=typeof module==='object'&&module.exports?require('./st-opening.js'):globalThis.STOpening;return opening.plan(s,{...options,deadline});}
 if(options.resourceContext&&resourceSummary(s,options).coverage.status==='invalid')return{...base,status:'no-supported-continuation-found',reason:'The observed resource history could not be verified for this position.'};
 const summary=resourceSummary(s,options);s=extendForced(s);
 const readAssessment=createAssessmentReader(),initial=readAssessment(s.board);initial.state=s;initial.notches=H.resolve(s,options.patternHistory);initial.resources=M.start(s,summary);
 initial.extraZPreservable=summary.coverage?.status==='complete'&&summary.extraZ?.status==='available'&&Boolean(summary.extraZ.baseline);
 initial.openingQualityPending=summary.coverage?.status==='complete'&&summary.openingAllocation?.status==='verified-first-tsd'&&summary.extraZ?.status==='unknown'&&summary.extraZ.baseline===null&&!summary.extraZ.allocations.length&&!summary.extraZ.departures.length&&!summary.center.closed.some(p=>p.status==='debt-invalidated'&&p.at>=summary.openingAllocation.firstTsdAt);
 if(!options.disableConstruction&&options.constructionPrevious?.evidence?.construction){const tracker={nodes:0},retained=revalidate(options.constructionPrevious.evidence.construction.kind==='left-support'?observe(raw):s,options.constructionPrevious,{...options,deadline,budgetTracker:tracker,maxNodes:Math.min(8000,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes))});base.metrics.nodes+=tracker.nodes;if(retained){retained.metrics.nodes=base.metrics.nodes;return retained;}}

 if(!options.disableConstruction&&options.commitment?.advice?.evidence?.construction){
  const proof=options.commitment.advice.evidence.construction,tracker={nodes:0},saved=constructionAdvice(proof.kind==='left-support'?observe(raw):s,proof,deadline,now,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes),tracker,options);base.metrics.nodes+=tracker.nodes;
  if(saved){
   // Consider ordinary scoring at the SAME executed horizon. A replacement
   // must re-certify the original public construction and dominate its endpoint,
   // rather than silently abandoning a pending parity/center/Z obligation.
   if(proof.kind!=='left-support'&&initial.maintenanceScope&&saved.continuation.length<=s.queue.length+1&&deadline-now()>100){
    const ordinary=plan(s,{...options,disableConstruction:true,deadline,commitment:null,constructionPrevious:null,depth:saved.continuation.length,maxNodes:Math.max(0,(options.maxNodes??45000)-base.metrics.nodes)});base.metrics.nodes+=ordinary.metrics?.nodes||0;
    if(ordinary.target&&ordinary.continuation.length===saved.continuation.length){
     const candidateProof={...proof,steps:[...proof.steps.slice(0,proof.consumed),...ordinary.continuation.map(p=>({witness:p.witness}))]},tracker={nodes:0},replacement=constructionAdvice(s,candidateProof,deadline,now,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;
     if(replacement){const a=replacement.assessment,b=saved.assessment,ma=replacement.metrics.endpointMass,mb=saved.metrics.endpointMass;
      if(a.maxHeight<=b.maxHeight&&ma<=mb&&(a.maxHeight<b.maxHeight||ma<mb)){replacement.metrics.nodes=base.metrics.nodes;return replacement;}
     }
    }
   }
   saved.metrics.elapsedMs=now()-started;saved.metrics.nodes=base.metrics.nodes;return saved;
  }
 }
 if(initial.notches.status==='broken'||initial.notches.status==='invalid-history')return{...base,status:'no-supported-continuation-found',reason:'A recognized T-slot opening in column 7 is filled. The coach does not support repairing this pattern yet.',assessment:initial};
 const resetDecision=resetCandidate(s,initial);
 base.evidence={resetSelection:resetDecision};
 const reentry=levelBaseReentry(s,initial,base,{...options,now,deadline},readAssessment);if(reentry){reentry.evidence={...reentry.evidence,resetSelection:{...resetDecision,status:reentry.target?'ordinary-rebuild-preferred':'uncertified',reason:reentry.target?'A checked one-lock Center rebuild takes precedence over paired-T recovery.':'The one-lock Center rebuild was not certified; this does not authorize paired-T recovery.'}};reentry.metrics.elapsedMs=Date.now()-started;return reentry;}
 if(!options.disableConstruction&&resetDecision.status==='candidate'&&X){
  const repair=X.search(s,{timeMs:Math.max(0,Math.min(680,deadline-now()-70)),maxNodes:Math.max(0,(options.maxNodes??45000)-base.metrics.nodes)});base.metrics.nodes+=repair.search?.visited||0;
  if(repair.valid){const tracker={nodes:0},advice=constructionAdvice(s,{origin:observe(s),steps:repair.continuation.map(p=>({witness:p.witness})),consumed:0},deadline,now,Math.max(0,(options.maxNodes??45000)-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;if(advice){advice.metrics.search=repair.search;advice.metrics.nodes=base.metrics.nodes;advice.metrics.elapsedMs=now()-started;return advice;}}
 }
 if(resetDecision.status==='candidate')base.evidence.resetSelection={...resetDecision,status:options.disableConstruction?'disabled':'uncertified',reason:options.disableConstruction?'Construction search is disabled; no Reset entry was selected.':'No complete recovery was certified within the available search budget; a route may still exist.'};
 if(!initial.maintenanceScope)return{...base,status:'unsupported-position',reason:initial.left.height<2||initial.center.height<3?'The stack is too low for the coach’s supported maintenance patterns. Rebuild manually or choose another position.':'This position is outside the supported right-side ST patterns. The coach expects established left and center stacks with a lower channel in column 8.',assessment:initial};
 const limit=options.maxNodes??45000,maxDepth=options.depth??3,width=options.width??8,expandedRoots=new Set(),accessCache=new Map();let stopped=false;
 base.metrics.accessNodes=0;let searchDeadline=deadline;
 const usage=options.usageTelemetry?{schemaVersion:1,scope:'maintenance',families:{
  cleanupBeforeCap:{attempted:0,examined:0,nonISkipped:0,iColumnSkipped:0,iTransitionChecked:0,verified:0,unknown:0},
  earlyCapFallback:{scanEligible:0,attempted:0,verified:0,selected:0,nodes:0},
  visibleCyclePreparation:{eligible:0,attempted:0,verified:0,selected:0,nodes:0,unknown:0}
 },costsMs:{cleanupBeforeCap:0,earlyCapFallback:0,visibleCyclePreparation:0},selected:null}:null;
 if(usage)base.metrics.usage=usage;
 // Profiling uses a real clock, never the caller's injected deadline clock.
 // Inclusive family boundaries overlap; they are not additive rule costs.
 const usageNow=()=>typeof performance==='object'&&performance.now?performance.now():Date.now();
 const optimistic=n=>({...n,rank:n.rank.map((v,i)=>{
  if(n.qualified)return v;
  const cavity=n.assessment.structure.right.reservoir;
  if(i===3&&cavity)return Math.floor((n.structuralScore+cavity.cells.length*3)/4);
  return i===4?v+1:v;
 })});
 const qualify=nodes=>{
  // Geometry is only an upper bound. Resolve the most promising candidates
  // lazily; inaccessible cavities must never earn a T-slot reward.
  const pending=nodes.slice(),selected=[];
  const order=(a,b)=>compare(optimistic(a),optimistic(b));
  const verify=n=>{
   if(n.qualified)return;
   const key=n.state.board.map(row=>row.replace(/[IJLOSTZX#]/g,'#')).join('');
   let access=accessCache.get(key);
   if(!access){access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.accessNodes+=access.visited;base.metrics.nodes+=access.visited;if(access.complete)accessCache.set(key,access);else stopped=true;}
   n.qualified=true;n.assessment.right.entry={status:access.reachable===true?'reachable-if-T-available':access.reachable===false?'unreachable':'unresolved-budget',witness:access.witness||null,target:access.event?.target||null};
   // A failed entry proof is structural repair work, not merely a lost
   // tactical tie-break. Otherwise inaccessible cavities can look renewable.
   if(access.reachable===false){n.structuralScore-=16;n.rank[3]=Math.floor(n.structuralScore/4);n.assessment.structure.blockedEntryRepair=16;}
   // Refund damage only for the exact recognized reservoir cells, after a
   // counterfactual T has a real input witness and its clear reopens the shaft.
   // T arrival is a separate obligation: this establishes geometry, not supply.
   const cavity=n.assessment.structure.right.reservoir;
   if(cavity&&access.reachable===true){
    const replay=R.replay(R.createState({board:n.state.board,active:'T',canHold:false}),access.witness);
    const event=replay.events[0],post=replay.valid?assess(replay.state.board):null;
    const keys=new Set(n.assessment.sealedCells.map(([x,y])=>x+','+y));
    const reopened=post&&event?.spin==='full'&&event.lines===2&&event.clearedRows.includes(cavity.roofRow)&&
     cavity.cells.every(([x,y])=>keys.has(x+','+y)&&replay.state.board[y][x]==='.'&&!post.sealedCells.some(([a,b])=>a===x&&b===y));
    if(reopened){
     const count=cavity.cells.length,credit=count*3;
     n.assessment.structure.right={...n.assessment.structure.right,reservoir:{...cavity,status:'verified-clear-reopens-reservoir',witness:access.witness.slice(),clearRows:event.clearedRows.slice()}};
     n.assessment.intentionalReservoir={cells:cavity.cells.map(c=>c.slice()),sealedExempt:count,coveredExempt:count,credit,proof:'reachable counterfactual T-double reopens these cells; arrival not established'};
     n.assessment.damageSealed=n.assessment.sealed-count;n.assessment.damageCovered=n.assessment.covered-count;
     n.assessment.estimate+=credit;n.structuralScore+=credit;n.rank[3]=Math.floor(n.structuralScore/4);
    }
   }
   n.rank[4]=n.baseEstimateRank+(access.reachable===true?1:0);
   n.assessment.obligations=n.assessment.obligations.map(o=>o.kind!=='T-slot'?o:({...o,status:access.reachable===true&&o.at[0]===access.event.target.x&&o.at[1]===access.event.target.y?'entry-verified-arrival-unresolved':access.reachable===false?'entry-blocked':'unresolved',note:'Counterfactual T entry is checked separately from whether a T arrives in time.'}));
  };
  // Evaluate the best member of each distinct root construction family too.
  const groups=new Map();for(const n of pending){const f=n.path[0],g=[f.target.type,holdCount(f),n.assessment.right.slots.length>0].join(':');if(!groups.has(g))groups.set(g,[]);groups.get(g).push(n);}
  for(const group of groups.values()){group.sort(order);while(group[0]&&!group[0].qualified&&!stopped){verify(group[0]);group.sort(order);}if(stopped)break;}
  while(pending.length&&selected.length<width*2&&!stopped){pending.sort(order);const n=pending[0];if(!n.qualified){verify(n);continue;}selected.push(pending.shift());}
  // On interruption, retain already evaluated evidence. An unknown geometric
  // candidate has no reward, and incomplete work remains explicitly reported.
  for(const n of nodes)if(n.qualified&&!selected.includes(n))selected.push(n);
  if(!selected.length&&nodes.length)selected.push([...nodes].sort(compare)[0]);
  return selected;
 };
 s=extendForced(s);
 const enumerate=state=>{const remaining=limit-base.metrics.nodes;if(remaining<=0||now()>=searchDeadline){stopped=true;return{placements:[],complete:false};}const r=R.placements(state,{allowHold:options.allowHold!==false,maxNodes:remaining,deadline:searchDeadline,now});base.metrics.nodes+=r.visited;if(!r.complete)stopped=true;const priorGeometry=S.geometry(state.board),caps=priorGeometry.right.completions;const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));const availableCap=r.placements.some(p=>p.event.type==='Z'&&caps.some(c=>sameCells(p.event.cells,c.cells)));for(const p of r.placements)p.availableCap=availableCap;
 // The cap must not seal a currently executable outer-I cleanup preparation.
 // Establish both placements from actual supply; a geometric I silhouette or
 // a hypothetical future Z is insufficient to constrain another root move.
 const cleanupStarted=usage?usageNow():0;
 if(usage)usage.families.cleanupBeforeCap.attempted++;
 const cleanupBeforeCap=r.placements.some(first=>{
  if(usage)usage.families.cleanupBeforeCap.examined++;
  // Only an actual I lock can prepare cleanup. Test the emitted event, not
  // preview membership: empty HOLD may expose a currently executable I.
  // The current preparation column is also a necessary condition, not a
  // substitute for full scoring precedence and post-placement qualification.
  if(first.event.type!=='I'){if(usage)usage.families.cleanupBeforeCap.nonISkipped++;return false;}
  if(priorGeometry.right.cycle.prepareColumn===null||!first.event.cells.every(([x])=>x===priorGeometry.right.cycle.prepareColumn)){if(usage)usage.families.cleanupBeforeCap.iColumnSkipped++;return false;}
  if(usage)usage.families.cleanupBeforeCap.iTransitionChecked++;
  if(S.transition(state,first).allocation!=='quad-preparation'||S.geometry(first.state.board).right.cycle.phase!=='cap-rebuild-with-cleanup-prepared')return false;
  let after=first.state,prefix=[];
  if(after.active?.type!=='Z'){if(options.allowHold===false||after.hold!=='Z')return false;const held=R.move(after,'HOLD');if(held===after||held.topOut)return false;after=held;prefix=['HOLD'];}
  return S.geometry(after.board).right.completions.some(cap=>{const r=R.replay(first.state,[...prefix,...cap.witness]);return r.valid&&r.events.length===1&&r.events[0].type==='Z'&&!r.events[0].lines&&!r.state.topOut;});
 });
 if(usage){usage.families.cleanupBeforeCap.verified+=Number(cleanupBeforeCap);usage.families.cleanupBeforeCap.unknown+=Number(!r.complete&&!cleanupBeforeCap);usage.costsMs.cleanupBeforeCap+=usageNow()-cleanupStarted;}
 for(const p of r.placements)p.availableCleanupPreparation=cleanupBeforeCap;
 return r;};
 const root=enumerate(s);base.metrics.roots=root.placements.length;
 // Save a fully checked one-lock cap before optional multi-lock preparation.
 // This is a backup, never an early return or authority to skip a saved goal.
 // Actual root enumeration establishes any competing executable cleanup I.
 let earlyCapFallback=null;
 const fallbackMetrics={attempted:0,verified:0,selected:false,nodes:0};
 if(root.complete&&!options.commitment&&!options.constructionPrevious){
  const fallbackStarted=usage?usageNow():0;if(usage)usage.families.earlyCapFallback.scanEligible=1;
  const startNodes=base.metrics.nodes,caps=S.geometry(s.board).right.completions;
  const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));
  for(const [index,p]of root.placements.entries()){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   if(p.event.type!=='Z'||p.event.lines||!p.event.cells.every(([x])=>x>=7)||!caps.some(c=>sameCells(c.cells,p.event.cells)))continue;
   fallbackMetrics.attempted++;
   const n=nodeFor({...p},null,initial,index,readAssessment);
   if(n.path[0].structuralEvidence.allocation!=='right-cap-preparation'||n.cycleDebt||!n.notchValid||!certifiedCavities(n)||n.assessment.maxHeight>=20||!n.assessment.regionalSupport)continue;
   qualify([n]);
   if(!n.qualified||n.assessment.right.entry?.status==='unresolved-budget')continue;
   const proof=A.prefix(s,n.path,{notches:initial.notches,deadline,now,maxNodes:Math.max(0,limit-base.metrics.nodes)});
   base.metrics.nodes+=proof.visited;base.metrics.gapAccessNodes=(base.metrics.gapAccessNodes||0)+proof.visited;
   if(proof.reachable!==true)continue;
   n.path[0].gapAccess=proof;earlyCapFallback=n;fallbackMetrics.verified=1;break;
  }
  fallbackMetrics.nodes=base.metrics.nodes-startNodes;
  if(usage){Object.assign(usage.families.earlyCapFallback,{attempted:fallbackMetrics.attempted,verified:fallbackMetrics.verified,nodes:fallbackMetrics.nodes});usage.costsMs.earlyCapFallback+=usageNow()-fallbackStarted;}
 }
 base.metrics.earlyCapFallback=fallbackMetrics;
 let foundationStage=null;
 if(!options.disableConstruction&&!options.commitment&&Y){const stage=Y.search(initial.state,root.placements,{rootComplete:root.complete,deadline:Number.isFinite(deadline)?Math.min(deadline-25,now()+100):Infinity,now,maxNodes:Math.min(12000,Math.max(0,limit-base.metrics.nodes))});base.metrics.nodes+=stage.visited;if(stage.candidate){const tracker={nodes:0};foundationStage=constructionAdvice(s,stage.candidate,deadline,now,Math.max(0,limit-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;}base.metrics.leftFoundationCandidate=Boolean(foundationStage);}
 // Reuse the already enumerated first moves. This short construction macro
 // proves an optional Z allocation followed by the ACTUAL other Z's exact cap
 // and an available T double. It cannot borrow an unseen future Z or T.
 const capStages=[],capDeadline=Math.min(deadline-25,now()+120);
 if(!options.disableConstruction&&X&&S.geometry(s.board).right.completions.length&&[s.active.type,s.hold,...s.queue].filter(t=>t==='Z').length>=2){
  const capRoots=root.placements.filter(p=>p.event.type==='Z'&&!p.event.lines&&p.event.cells.every(([x])=>x<7)).sort((a,b)=>S.geometry(b.state.board).supportEstimate-S.geometry(a.state.board).supportEstimate);
  for(const first of capRoots){
   if(now()>=capDeadline||base.metrics.nodes>=limit||capStages.length>=3)break;
   if(first.event.type!=='Z'||first.event.lines||first.event.cells.some(([x])=>x>=7))continue;
   for(const hold of [[],['HOLD'],['HOLD','HOLD']]){
    if(now()>=capDeadline||capStages.length>=3)break;
    const ready=R.replay(first.state,hold);if(!ready.valid||ready.state.active?.type!=='Z')continue;
    for(const cap of S.geometry(first.state.board).right.completions){
     const second=R.replay(first.state,[...hold,...cap.witness]);if(!second.valid||second.events.length!==1)continue;
     for(const tHold of [[],['HOLD'],['HOLD','HOLD']]){
      if(now()>=capDeadline||capStages.length>=3)break;
      const t=R.replay(second.state,tHold);if(!t.valid||t.state.active?.type!=='T')continue;
      const access=R.tDoubleAccess(t.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:capDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
      if(!access.complete||!access.reachable)continue;
      const proof={kind:'cap-deferral',origin:observe(s),steps:[{witness:first.witness},{witness:[...hold,...cap.witness]},{witness:[...tHold,...access.witness]}],consumed:0};
      const tracker={nodes:0},candidate=constructionAdvice(s,proof,capDeadline,now,Math.max(0,limit-base.metrics.nodes),tracker);base.metrics.nodes+=tracker.nodes;if(candidate)capStages.push(candidate);
     }
    }
   }
  }
 }

 if(capStages.length)searchDeadline=deadline-25;
 // Extend a checked resource proof only with actual visible partner locks.
 // Completion targets are concrete cells; a missing route is uncertified.
 const finishCenterDebt=start=>{
  let n=start;
  while(n.centerDebt.length&&n.path.length<Math.min(7,s.queue.length+1)){
   if(now()>=deadline||base.metrics.nodes>=limit)return null;
   const choices=[];
   for(const c of S.geometry(n.state.board,{notches:n.notches}).center.completions){
    if(!n.centerDebt.some(g=>g.alternatives.some(a=>a.piece===c.piece&&centerCellsKey(a.cells)===centerCellsKey(c.cells))))continue;
    for(const prefix of [[],['HOLD'],['HOLD','HOLD']]){
     const ready=R.replay(n.state,prefix);if(!ready.valid||ready.state.active?.type!==c.piece)continue;
     const witness=[...prefix,...c.witness],r=R.replay(n.state,witness);if(!r.valid||r.events.length!==1||!S.canonicalClear(r.events[0]))continue;
     const child=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness,hold:prefix.length>0,...policyWitnesses(n.state)},n,initial,n.rootIndex,readAssessment);
     if(child.cycleDebt===0&&child.notchValid&&child.assessment.maxHeight<20&&child.centerDebt.length<n.centerDebt.length)choices.push(child);
    }
   }
   n=choices.sort(compare)[0];if(!n)return null;
  }
  return n.centerDebt.length?null:n;
 };
 let preparation=null,preparationUnresolved=false,cleanupCommitment=null,preparationKind='visible-I-Z-held-T';
 let admittedNode=null;
 const remember=n=>{
  if(!n||options.commitment&&n!==commitment||options.constructionPrevious||cleanupCommitment&&n!==cleanupCommitment||!options.admitMaintenance)return;
  if(n.assessment.maxHeight>=20||!n.assessment.regionalSupport||now()>=deadline||base.metrics.nodes>=limit)return;
  if(admittedNode&&n.path.length<admittedNode.path.length)return;
  if(admittedNode&&n.path.length===admittedNode.path.length&&(n===admittedNode||orderContinuations([admittedNode,n])[0]!==n))return;
  const checked=options.admitMaintenance(describeNode(clone(n),n===commitment));
  base.metrics.nodes=checked.metrics?.nodes??base.metrics.nodes;
  base.metrics.admissionAttempts=(base.metrics.admissionAttempts||0)+1;
  if(checked.target){admittedNode=n;base.metrics.firstCertified??={nodes:base.metrics.nodes,...(options.usageTelemetry?{elapsedMs:now()-started}:{}),locks:n.path.length};}
  else base.metrics.admissionFailures=(base.metrics.admissionFailures||0)+1;
 };
 const commitment=committedNode(s,options.commitment,root.placements,initial,readAssessment);
 remember(commitment);
 // A narrow constructive obligation, not a blanket ban on pre-cap T filler.
 // Prove the available I -> Z -> saved T route before beam pruning can discard
 // its unfinished cap. Every action uses the real observation and visible queue.
 // An interrupted proof earns no credit; conflicting T advice is withheld.
 // A completed failed proof does not reserve the T.
 if(maxDepth>=3&&options.allowHold!==false&&s.active.type==='T'&&s.hold==='I'&&S.geometry(s.board).right.cycle.prepareColumn!==null){
  preparationUnresolved=!root.complete;
  for(let i=0;i<root.placements.length&&!preparation;i++){
   const first=root.placements[i];
   if(first.event.type!=='I'||first.event.lines||first.state.hold!=='T'||first.state.active?.type!=='Z'||S.geometry(first.state.board).right.cycle.phase!=='cap-rebuild-with-cleanup-prepared')continue;
   if(S.transition(s,first).allocation!=='quad-preparation')continue;
   for(const cap of S.geometry(first.state.board).right.completions){
    if(now()>=deadline||base.metrics.nodes>=limit){preparationUnresolved=true;break;}
    const z=R.replay(first.state,cap.witness);
    if(!z.valid||z.events.length!==1||z.events[0].type!=='Z'||z.events[0].lines||z.state.topOut)continue;
    const held=R.move(z.state,'HOLD');
    if(held===z.state||held.topOut||held.active?.type!=='T')continue;
    const access=R.tDoubleAccess(held.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});
    base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
    if(!access.complete){preparationUnresolved=true;continue;}
    if(!access.reachable)continue;
    const witness=['HOLD',...access.witness],t=R.replay(z.state,witness);
    if(!t.valid||t.events.length!==1||!S.canonicalClear(t.events[0])||t.events[0].lines!==2||t.state.topOut)continue;
    const second={target:z.events[0].target,hold:false,holdCount:0,witness:cap.witness.slice(),state:z.state,event:z.events[0],availableCap:true};
    const third={target:t.events[0].target,hold:true,holdCount:1,witness,state:t.state,event:t.events[0]};
    let n=nodeFor(first,null,initial,i,readAssessment);n=nodeFor(second,n,initial,i,readAssessment);n=nodeFor(third,n,initial,i,readAssessment);
    n=finishCenterDebt(n);if(n&&n.cycleDebt===0&&certifiedCavities(n)&&n.assessment.regionalSupport&&n.assessment.maxHeight<20)preparation=n;
   }
  }
 }
 // Extend cap preparation through a bounded prefix of the visible queue. This
 // is a constructive search, not a global T penalty: only a replayed Z cap and
 // the actual saved T double create an obligation. The small beam may miss a
 // route; a failed search is never evidence that no route exists.
 // Reserve an available I across an actual upcoming double when that clear
 // opens the Pocket. This proof uses the real held I, not a later copy in bag.
 if(maxDepth>=3&&options.allowHold!==false&&(s.active.type==='I'||s.hold==='I')){
  const candidates=root.placements.filter(p=>p.event.type!=='I'&&p.state.hold==='I'&&p.state.active?.type==='T'&&S.canonicalClear(p.event)).map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(n=>n.cycleDebt===0&&certifiedCavities(n)&&n.assessment.maxHeight<20).sort(compare).slice(0,4);
  for(const n of candidates){
   if(now()>=deadline||base.metrics.nodes>=limit)break;
   const access=R.tDoubleAccess(n.state.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
   if(!access.complete||!access.reachable)continue;
   const t=R.replay(n.state,access.witness);if(!t.valid||t.events.length!==1||t.events[0].type!=='T'||t.events[0].lines!==2||t.events[0].spin!=='full')continue;
   const scored=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness:access.witness,hold:false},n,initial,n.rootIndex,readAssessment);
   let active=R.move(t.state,'HOLD'),witness=['HOLD'];if(active===t.state||active.topOut||active.active?.type!=='I')continue;
   let next=R.move(active,'CW');if(next===active)continue;active=next;witness.push('CW');
   while(active.active.x!==7){const a=active.active.x<7?'R':'L';next=R.move(active,a);if(next===active)break;active=next;witness.push(a);}
   if(active.active.x!==7)continue;const r=R.replay(t.state,[...witness,'HD']);if(!r.valid||r.events.length!==1)continue;
   const end=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:[...witness,'HD'],hold:true},scored,initial,n.rootIndex,readAssessment);
   if(end.cycleDebt===0&&end.notchValid&&certifiedCavities(end)&&end.assessment.maxHeight<20&&end.assessment.regionalSupport&&end.path.at(-1).structuralEvidence.allocation==='quad-preparation'&&(!cleanupCommitment||compare(end,cleanupCommitment)<0))cleanupCommitment=end;
  }
 }
 remember(cleanupCommitment);
 const visible=[s.active.type,...s.queue],tIndex=s.hold==='T'?-1:visible.indexOf('T'),zIndex=s.hold==='Z'?-1:visible.indexOf('Z');
 const capPending=S.geometry(s.board).right.cycle.phase.startsWith('cap-rebuild')||S.geometry(s.board).right.cycle.phase==='post-clear-rebuild';
 if(!preparation&&!preparationUnresolved&&maxDepth>=3&&options.allowHold!==false&&capPending&&(tIndex>=0||s.hold==='T')&&(zIndex>tIndex||s.hold==='Z')&&zIndex<=5&&(zIndex<=3||tIndex===0||s.hold==='T'||s.hold==='Z')&&s.active.type!=='Z'){
  const preparationStarted=usage?usageNow():0,preparationStartNodes=base.metrics.nodes;
  if(usage){usage.families.visibleCyclePreparation.eligible=1;usage.families.visibleCyclePreparation.attempted=1;}
  const admissible=n=>n.cycleDebt===0&&n.notchValid&&n.assessment.maxHeight<20;
  let candidates=root.placements.filter(p=>p.event.type!=='T'&&S.canonicalClear(p.event)).map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(admissible);
  const rootBands=new Map(candidates.map(n=>[n.rootIndex,n.rank[3]]));
  // Among witnessed cap/T routes retain stronger immediate supported structure
  // before comparing endpoint estimates. This is not a center-piece override.
  const compareProof=(a,b)=>(rootBands.get(b.rootIndex)-rootBands.get(a.rootIndex))||compare(a,b);
  let beam=diversify(candidates,4),proofStopped=!root.complete;
  const maxProofLocks=Math.min(7,s.queue.length+1);
  for(let depth=1;depth<maxProofLocks&&beam.length&&!preparation&&!proofStopped;depth++){
   const next=[];
   for(const n of beam){
    if(now()>=deadline||base.metrics.nodes>=limit){proofStopped=true;break;}
    // A previously held Z may already have formed the cap in this prefix.
    // Recognize the actual T now available, rather than requiring Z in active.
    if(n.state.active?.type==='T'||n.state.hold==='T'){
     const prefix=n.state.active?.type==='T'?[]:['HOLD'],ready=prefix.length?R.move(n.state,'HOLD'):n.state;
     if(ready!==n.state||!prefix.length){const access=R.tDoubleAccess(ready.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
      if(!access.complete)proofStopped=true;
      if(access.reachable){const witness=[...prefix,...access.witness],t=R.replay(n.state,witness);if(t.valid&&t.events.length===1&&t.events[0].type==='T'&&t.events[0].lines===2&&t.events[0].spin==='full'){
       let terminal=nodeFor({state:t.state,event:t.events[0],target:t.events[0].target,witness,hold:prefix.length>0},n,initial,n.rootIndex,readAssessment);
       terminal=finishCenterDebt(terminal);
       if(terminal&&admissible(terminal)&&certifiedCavities(terminal)&&terminal.assessment.regionalSupport&&(!preparation||compareProof(terminal,preparation)<0)){preparation=terminal;preparationKind='visible-cycle-T-conservation';}
      }}
     }
    }
    // A cap is accepted only when the immediately subsequent held T is real.
    if(n.state.active?.type==='Z'&&n.state.hold==='T')for(const cap of S.geometry(n.state.board).right.completions){
     const z=R.replay(n.state,cap.witness);
     if(!z.valid||z.events.length!==1||z.events[0].type!=='Z'||z.events[0].lines||z.state.topOut)continue;
     // Active Z plus occupied held T excludes an executable I, even with unlimited swaps.
     const second={target:z.events[0].target,hold:false,holdCount:0,witness:cap.witness.slice(),state:z.state,event:z.events[0],availableCleanupPreparation:false};
     const capNode=nodeFor(second,n,initial,n.rootIndex,readAssessment);if(!admissible(capNode)||depth+2>maxProofLocks)continue;
     const held=R.move(z.state,'HOLD');if(held===z.state||held.topOut||held.active?.type!=='T')continue;
     const access=R.tDoubleAccess(held.board,{maxNodes:Math.max(0,limit-base.metrics.nodes),deadline:searchDeadline,now});base.metrics.nodes+=access.visited;base.metrics.accessNodes+=access.visited;
     if(!access.complete){proofStopped=true;break;}if(!access.reachable)continue;
     const witness=['HOLD',...access.witness],t=R.replay(z.state,witness);
     if(!t.valid||t.events.length!==1||!S.canonicalClear(t.events[0])||t.events[0].lines!==2||t.state.topOut)continue;
     let terminal=nodeFor({target:t.events[0].target,hold:true,holdCount:1,witness,state:t.state,event:t.events[0]},capNode,initial,n.rootIndex,readAssessment);
     terminal=finishCenterDebt(terminal);
       if(terminal&&admissible(terminal)&&certifiedCavities(terminal)&&terminal.assessment.regionalSupport&&(!preparation||compareProof(terminal,preparation)<0)){preparation=terminal;preparationKind='visible-prefix-Z-saved-T';}
    }
    if(preparation||proofStopped)continue;
    if(!n.state.active||depth+2>=maxProofLocks)continue;
    const e=enumerate(n.state);if(!e.complete)proofStopped=true;
    for(const p of e.placements){if(p.event.type==='T'||!S.canonicalClear(p.event))continue;const child=nodeFor(p,n,initial,n.rootIndex,readAssessment);if(admissible(child))next.push(child);}
   }
   const unique=new Map();for(const n of next){const key=nodeKey(n),prior=unique.get(key);if(!prior||compare(n,prior)<0)unique.set(key,n);}beam=diversify([...unique.values()],4);
  }
  preparationUnresolved=proofStopped&&!preparation;
  if(usage){Object.assign(usage.families.visibleCyclePreparation,{verified:Number(Boolean(preparation)),unknown:Number(preparationUnresolved),nodes:base.metrics.nodes-preparationStartNodes});usage.costsMs.visibleCyclePreparation+=usageNow()-preparationStarted;}
 }
 const spendsReservedT=(p,parent=null)=>(preparation||preparationUnresolved)&&p.event.type==='T'&&p.event.lines===0&&!parent?.path.some(step=>step.event.type==='T'&&step.event.lines===2&&step.event.spin==='full');
 let frontier=qualify(root.placements.filter(p=>S.canonicalClear(p.event)&&!spendsReservedT(p)&&ordinaryCenterEligible(s,p,initial.notches)).map((p,i)=>nodeFor(p,null,initial,i,readAssessment)).filter(n=>n.notchValid&&n.cycleDebt===0));
 if(preparation){preparation=qualify([preparation])[0]??preparation;base.metrics.preparationProofLocks=preparation.path.length;}

 let screeningLimit=limit;
 const screeningAllowance=limit>=20000&&!options.disableOpening&&!options.disableConstruction?Math.min(6000,Math.floor(limit/5)):Infinity;
 const screening=base.metrics.proofScheduling={enabled:Number.isFinite(screeningAllowance),allowance:Number.isFinite(screeningAllowance)?screeningAllowance:null,calls:0,nodes:0,unfinished:0,budgetStops:0};
 const accessSafe=n=>{const proof=A.prefix(s,n.path,{notches:initial.notches,deadline,now,maxNodes:Math.max(0,Math.min(limit,screeningLimit)-base.metrics.nodes)});base.metrics.nodes+=proof.visited;if(proof.reachable===null)screening.unfinished++;base.metrics.gapAccessNodes=(base.metrics.gapAccessNodes||0)+proof.visited;n.path[0].gapAccess=proof;return proof.reachable===true;};
 const repairCache=new Map();
 const resourceSafe=n=>{
  if(n.resources?.centerBlocked||n.resources?.unclassifiedS?.some(s=>s.invalidated||s.requiresAccommodation))return false;
  if(n.resources?.tCollision&&n.assessment.right.entry?.status!=='reachable-if-T-available')return false;
  if(!n.resources?.hangingS.length&&!n.resources?.pendingCenter.length)return true;
  const key=JSON.stringify([observe(n.state),M.binding(n.resources),n.notches]);let proof=repairCache.get(key);
  if(!proof){proof=resourceRepair(n.state,n.resources,{...options,notches:n.notches,maxNodes:Math.min(4000,Math.max(0,Math.min(limit,screeningLimit)-base.metrics.nodes)),deadline,now});base.metrics.nodes+=proof.visited;if(proof.valid!==null)repairCache.set(key,proof);}
  n.resourceRepair=proof;if(proof.valid===null)screening.unfinished++;return proof.valid===true;
 };
 // Early endpoint screening must leave work for the next beam layer. A
 // bounded unfinished proof stays unknown and is never cached as rejection.
 // Ranking and all acceptance checks are unchanged; final-layer screening
 // and final admission may use the rest of the shared request budget.
 const certifyContinuation=n=>{
  if(!accessSafe(n)||!resourceSafe(n))return false;
  n.continuationChecked=true;return true;
 };
 const cleanBest=(nodes,allowance=Infinity)=>{
  const start=base.metrics.nodes,prior=screeningLimit;screening.calls++;
  screeningLimit=Math.min(prior,start+allowance);
  try{const ordered=nodes.filter(n=>n.cycleDebt===0&&certifiedCavities(n)).sort(compareConstruction);for(const n of ordered){
   if(now()>=deadline){screening.budgetStops++;return null;}
   const beforeUnknown=screening.unfinished;
   if(certifyContinuation(n))return preserveExtraZ(n,ordered,{protect:incumbent=>{remember(incumbent);return admittedNode===incumbent;},certify:candidate=>now()<deadline&&base.metrics.nodes<limit&&certifyContinuation(candidate)});
   // Completed cached/no-work proofs remain usable at zero remaining nodes.
   // A zero allowance cannot turn an unfinished query into negative evidence.
   if(base.metrics.nodes>=screeningLimit&&screening.unfinished>beforeUnknown)screening.budgetStops++;
  }return null;}finally{screening.nodes+=base.metrics.nodes-start;screeningLimit=prior;}
 };
 const rootScreenIncomplete=screening.unfinished+screening.budgetStops;
 let best=preparation&&resourceSafe(preparation)?preparation:cleanBest(frontier,screeningAllowance);base.metrics.depth=best?best.path.length:0;base.metrics.completeDepth=root.complete&&best&&!stopped&&screening.unfinished+screening.budgetStops===rootScreenIncomplete?1:0;
 base.metrics.completedBeamDepth=root.complete?1:0;
 remember(best);
 let layer=diversify(frontier,width),comparisonLayer=frontier;
 for(let depth=2;depth<=maxDepth&&!stopped&&layer.length;depth++){
  const next=[],seen=new Map();let complete=true;
  for(const n of layer){if(!n.state.active)continue;expandedRoots.add(n.rootIndex);const e=enumerate(n.state);if(!e.complete)complete=false;
   for(const p of e.placements){if(!S.canonicalClear(p.event)||spendsReservedT(p,n)||!ordinaryCenterEligible(n.state,p,n.notches))continue;const child=nodeFor(p,n,initial,n.rootIndex,readAssessment);if(!child.notchValid||child.cycleDebt)continue;const key=nodeKey(child),prior=seen.get(key);if(!prior||compare(child,prior)<0)seen.set(key,child);}
   if(stopped)break;
  }
  next.push(...qualify([...seen.values()]));if(stopped)complete=false;
  if(complete)base.metrics.completedBeamDepth=depth;
  if(next.length){
   const beforeIncomplete=screening.unfinished+screening.budgetStops;
   const candidate=cleanBest(next,depth<maxDepth?screeningAllowance:Infinity);
   const screeningComplete=screening.unfinished+screening.budgetStops===beforeIncomplete;
   remember(candidate);base.metrics.depth=Math.max(base.metrics.depth,depth);
   // Unknown competing endpoint proofs limit coverage, not this candidate's
   // own positive certificate. Preserve the completed expansion-layer choice;
   // report screening completeness separately and still require final admission.
   if(complete&&candidate){
    best=preparation&&depth<preparation.path.length?preparation:candidate;comparisonLayer=next;
    if(screeningComplete)base.metrics.completeDepth=depth;
   }
  }
  layer=diversify(next,width);
 }
 if(cleanupCommitment&&(!best||!coversResourceGoal(best,cleanupCommitment)))best=cleanupCommitment;
 let comparisonSaved=commitment;
 const comparisonProofs=new Map(),timingDecisions=new Map();
 const recordTiming=(candidate,saved,result)=>{if(!timingDecisions.has(candidate))timingDecisions.set(candidate,new Map());timingDecisions.get(candidate).set(saved,result);return result;};
 const timingDecision=(candidate,saved=comparisonSaved)=>{
  const result=scoringReplacement(candidate,saved,commitment);
  if(!result.allowed||!result.delayed.length)return recordTiming(candidate,saved,result);
  // A favorable number on a speculative descendant is not a proved benefit.
  // Certify the equal-horizon original-goal route once, charging the same
  // shared budget. Unknown rejects this exception, never the saved goal.
  if(!comparisonProofs.has(saved))comparisonProofs.set(saved,Boolean(saved.qualified&&saved.assessment.right.entry?.status!=='unresolved-budget'&&accessSafe(saved)&&resourceSafe(saved)));
  const referenceCertified=comparisonProofs.get(saved);
  return recordTiming(candidate,saved,{...result,allowed:referenceCertified,referenceCertified,reason:referenceCertified?'certified-endpoint-dominance':'unproved-equal-horizon-reference',referencePrefix:saved.path.map(p=>({witness:p.witness,event:p.event}))});
 };
 const timingDescription=(candidate,saved)=>{const checked=timingDecisions.get(candidate)?.get(saved);if(checked)return checked;const result=scoringReplacement(candidate,saved,commitment);return result.allowed&&result.delayed.length?{...result,allowed:false,reason:'endpoint-comparison-not-run',referenceCertified:null}:result;};
 const timelyReplacement=(candidate,saved=comparisonSaved)=>!commitment||options.disableTimelyScoring||timingDecision(candidate,saved).allowed;
 if(commitment){
  // The saved suffix may end at its goal while the fresh search already sees
  // another ordinary piece. Compare both choices at that same lock horizon,
  // reusing searched descendants of the exact saved proof rather than hiding
  // the fresh lookahead or inventing an unsearched continuation.
  const matchesSaved=n=>n.path.length>=commitment.path.length&&commitment.path.every((p,i)=>JSON.stringify(p.event)===JSON.stringify(n.path[i].event)&&sameObservedResult(p.state,n.path[i].state));
  let saved=commitment,fresh=best,replacement=false,rankingPreferred=false;
  if(fresh&&coversResourceGoal(fresh,commitment)&&fresh.path.length>saved.path.length){
   const candidates=comparisonLayer.filter(n=>n.path.length===fresh.path.length&&matchesSaved(n)&&n.cycleDebt===0&&n.notchValid&&certifiedCavities(n)&&n.assessment.maxHeight<20&&n.assessment.regionalSupport);
   const qualified=qualify(candidates).filter(n=>n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget');
   saved=orderContinuations(qualified)[0]??saved;
  }
  if(fresh&&coversResourceGoal(fresh,commitment)&&fresh.path.length===saved.path.length&&fresh.assessment.maxHeight<20&&fresh.assessment.regionalSupport){
   qualify([fresh,saved]);
   const settled=n=>n.qualified&&n.assessment.right.entry?.status!=='unresolved-budget';
   rankingPreferred=fresh!==saved&&settled(fresh)&&settled(saved)&&orderContinuations([saved,fresh])[0]===fresh;
   replacement=rankingPreferred&&timelyReplacement(fresh,saved);
  }
  comparisonSaved=saved;
  base.metrics.commitmentComparison={scoringTiming:!options.disableTimelyScoring&&fresh?timingDescription(fresh,saved):null,freshGoalLocks:fresh?resourceGoalPrefix(fresh.path,commitment.path):null,savedGoalLocks:resourceGoalPrefix(commitment.path,commitment.path),
   freshHorizon:fresh?.path.length??null,savedHorizon:saved.path.length,replacement,rankingPreferred,delayPrevented:Boolean(!options.disableTimelyScoring&&rankingPreferred&&!replacement),
   freshSettled:Boolean(fresh?.qualified&&fresh.assessment.right.entry?.status!=='unresolved-budget'),savedSettled:Boolean(saved?.qualified&&saved.assessment.right.entry?.status!=='unresolved-budget')};
  if(!replacement)best=commitment;
 }

 if(now()>=deadline)stopped=true;
 base.metrics.rootExpanded=expandedRoots.size;base.metrics.elapsedMs=Date.now()-started;
 // Compare cap deferral with ordinary play at equal completed locks. If the
 // ordinary prefix commutes with the macro, replay its remaining witness to
 // complete the same endpoint rather than compare three locks against two.
 base.metrics.capStageCandidates=capStages.length;
 for(const candidate of capStages){
  if(now()>=deadline)break;
  if(!best)continue;
  let ordinary=best;
  if(ordinary.path.length<candidate.continuation.length){
   for(const step of candidate.continuation.slice(ordinary.path.length)){
    if(now()>=deadline){ordinary=null;break;}
    const r=R.replay(ordinary.state,step.witness);if(!r.valid||r.events.length!==1||!S.canonicalClear(r.events[0])){ordinary=null;break;}
    ordinary=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(ordinary.state)},ordinary,initial,ordinary.rootIndex,readAssessment);
   }
   if(ordinary&&(ordinary.cycleDebt||!ordinary.notchValid||!certifiedCavities(ordinary)||JSON.stringify(ordinary.state.board)!==JSON.stringify(JSON.parse(candidate.continuation.at(-1).resultContext)[1])))ordinary=null;
   if(ordinary)best=ordinary;
  }
  if(!ordinary||ordinary.path.length!==candidate.continuation.length)continue;
  const mass=ordinary.state.board.reduce((n,row)=>n+[...row].filter(c=>c!=='.').length,0),cm=candidate.metrics.endpointMass;
  let capTiming=null;
  if(commitment){
   // Construction advice intentionally has a smaller endpoint assessment.
   // Rebuild the comparison facts from its actual public witness rather than
   // assuming absent Center/Left facts are favorable or trusting advice flags.
   let capNode=null,prior=s,valid=true;
   for(const step of candidate.continuation){const r=R.replay(prior,step.witness);if(!r.valid||r.events.length!==1){valid=false;break;}capNode=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.witness.includes('HOLD'),...policyWitnesses(prior)},capNode,initial,-1,readAssessment);prior=r.state;}
   if(!valid||!capNode||!coversResourceGoal(capNode,commitment)||!timelyReplacement(capNode))continue;
   if(!options.disableTimelyScoring)capTiming=timingDecision(capNode);
  }
  if(candidate.assessment.maxHeight<=ordinary.assessment.maxHeight&&cm<=mass&&(candidate.assessment.maxHeight<ordinary.assessment.maxHeight||cm<mass)){candidate.metrics=constructionMetrics(candidate,base.metrics,now()-started);if(capTiming)candidate.metrics.commitmentComparison={...base.metrics.commitmentComparison,selectedScoringTiming:capTiming};if(usage){usage.selected={path:'cap-deferral',locks:candidate.continuation.length};candidate.metrics.usage=usage;}return candidate;}
 }
 if(foundationStage){
  // Admission is a complete finite alternative, not proof that an unknown
  // ordinary continuation is impossible. Never discard an existing score or
  // protected Center/I/resource goal for this shorter Left-only construction.
  let replace=!best;
  if(best&&!resourceGoal(best.path)){
   if(best.path.length<2)replace=true;
   else{const r=R.replay(s,best.path.slice(0,2).flatMap(p=>p.witness)),end=JSON.parse(foundationStage.continuation.at(-1).resultContext)[1];
    if(r.valid){const a=assess(end),b=assess(r.state.board),phase=initial.notches,ga=S.geometry(end,{notches:phase}).center,gb=S.geometry(r.state.board,{notches:phase}).center,quality=c=>c.patternSupport==='reference-supported'?(c.status==='level'?2:c.status==='unrecognized'?0:1):0;
     replace=a.maxHeight<=b.maxHeight&&Y.leftCovered(end)<=Y.leftCovered(r.state.board)&&Math.abs(Y.parity(end))<=Math.abs(Y.parity(r.state.board))&&Y.deficits(end,phase).length<=Y.deficits(r.state.board,phase).length&&quality(ga)>=quality(gb)&&(Y.deficits(end,phase).length<Y.deficits(r.state.board,phase).length||Y.leftCovered(end)<Y.leftCovered(r.state.board)||Math.abs(Y.parity(end))<Math.abs(Y.parity(r.state.board)));
    }
   }
  }
  if(replace){if(usage)usage.selected={path:'left-foundation',locks:foundationStage.continuation.length};foundationStage.metrics={...constructionMetrics(foundationStage,base.metrics,now()-started),depth:base.metrics.depth,completeDepth:base.metrics.completeDepth,stageProofLocks:2};return foundationStage;}
 }
 if(best&&(!accessSafe(best)||!resourceSafe(best))){
  // Final screening may exhaust its budget after the saved-goal comparison.
  // A shorter legal fallback is not a replacement for that protected goal.
  // Recheck alternatives at the selected horizon with every goal preserved;
  // if none can be certified, abstain rather than silently dropping the proof.
  const horizon=best.path.length,alternatives=[...comparisonLayer,...frontier].filter(n=>(!commitment||n.path.length===horizon&&coversResourceGoal(n,commitment)&&timelyReplacement(n))&&(!cleanupCommitment||n.path.length===horizon&&coversResourceGoal(n,cleanupCommitment)));
  best=cleanBest(alternatives);
 }
 if(!best&&earlyCapFallback&&!commitment&&!cleanupCommitment&&resourceSafe(earlyCapFallback)){best=earlyCapFallback;fallbackMetrics.selected=true;base.metrics.depth=Math.max(base.metrics.depth,1);}
 // A rejected endpoint does not complete other budget-truncated proofs.
 // Classify abstention only; a certified best move below remains unchanged.
 const searchIncomplete=Boolean(stopped||screening.unfinished||screening.budgetStops);
 const abstentionStatus=searchIncomplete?'budget-exhausted':'no-supported-continuation-found';
 const incompleteReason='The search limit was reached before finding a checked move. A valid continuation may still exist.';
 if(!best)return{...base,status:abstentionStatus,reason:searchIncomplete?incompleteReason:'No supported ST sequence was found within this search. Other continuations may exist.'};
 if(best.assessment.maxHeight>=20||!best.assessment.regionalSupport)return{...base,status:abstentionStatus,reason:searchIncomplete?incompleteReason:'The checked sequences did not retain enough space and a supported stack shape. No move is recommended.',assessment:best.assessment};
 if(commitment&&!options.disableTimelyScoring)base.metrics.commitmentComparison.selectedScoringTiming=timingDecision(best);
 return describeNode(best);
 function describeNode(best,retained=best===commitment){
 const first=best.path[0],verified=R.replay(s,first.witness);if(!verified.valid)return{...base,status:'invalid-witness',reason:'The suggested input sequence failed validation, so it is not shown.'};
 const tsdAt=best.path.findIndex(p=>p.event.spin==='full'&&p.event.lines===2);
 const facts=first.structuralEvidence;
 // Describe the selected executed sequence, not the union of hypothetical
 // pieces that could complete different center surfaces. Pair order matters.
 const orderedPartner=S.CENTER_PAIRS[first.event.type];
 const centerOnly=p=>p.event.cells.every(([x])=>x>=4&&x<=6);
 const cellKey=cells=>JSON.stringify(cells.slice().sort(([ax,ay],[bx,by])=>ax-bx||ay-by));

 if(centerOnly(first)&&first.event.lines===0&&orderedPartner&&facts.structure?.center.patternSupport==='reference-supported'){
  for(let i=1;i<best.path.length;i++){
   const next=best.path[i];
   if(next.event.lines!==0)break;
   if(next.event.cells.some(([x])=>x>=4&&x<=6)){
    const completion=facts.structure.center.completions.find(c=>c.piece===orderedPartner&&c.resultStatus==='level'&&c.patternSupport==='reference-supported'&&cellKey(c.cells)===cellKey(next.event.cells));
    if(centerOnly(next)&&next.event.type===orderedPartner&&completion){
     facts.pairProgress={...facts.pairProgress,orderedPieces:[first.event.type,orderedPartner],step:1,status:'completed-in-checked-prefix',completionLock:i+1};
     next.structuralEvidence.pairFamily=first.event.type+orderedPartner;
     next.structuralEvidence.pairProgress={orderedPieces:[first.event.type,orderedPartner],step:2,status:'completed',preparationCells:first.event.cells,completionCells:next.event.cells};
    }
    break;
   }
  }
 }
 const preparationProof=preparation&&preparation.path.every((p,i)=>best.path[i]&&p.event.type===best.path[i].event.type&&p.event.lines===best.path[i].event.lines&&p.event.spin===best.path[i].event.spin&&JSON.stringify(p.state.board)===JSON.stringify(best.path[i].state.board)&&p.state.hold===best.path[i].state.hold&&JSON.stringify(p.state.queue)===JSON.stringify(best.path[i].state.queue))?{kind:preparationKind,locks:preparation.path.length,claim:'Executed preparation preserves an available T for a checked double.'}:null;
 if(usage){
  usage.families.earlyCapFallback.selected=Number(fallbackMetrics.selected);
  usage.families.visibleCyclePreparation.selected=Number(Boolean(preparationProof&&preparationKind!=='visible-I-Z-held-T'));
  usage.selected={path:fallbackMetrics.selected?'early-cap-fallback':retained?'retained-commitment':preparationProof?'preparation:'+preparationKind:'ordinary',locks:best.path.length,rank:best.rank.slice()};
 }
 const presentation=advicePresentation(best.path,best.assessment);
 return{...base,status:'recommended-with-verified-prefix',target:first.target,hold:first.hold,holdCount:holdCount(first),witness:first.witness,...presentation,
 continuation:best.path.map(p=>({target:p.target,hold:p.hold,holdCount:holdCount(p),witness:p.witness,event:p.event,resultContext:context(p.state),structuralEvidence:p.structuralEvidence})),
 evidence:{resetSelection:resetDecision,strategy:'canonical-right-ST',cycleResources:cycleResources(best.path),commitmentRetained:retained,futureNotches:best.notches,preparationProof,cycleDebt:best.cycleDebt,cavityRepair:{status:'verified-prefix-repaired',outstandingCells:best.cavityDebt},clearPolicy:'right-region full T-spin doubles and I tetrises only',verifiedLocks:best.path.length,tsdAt:tsdAt>=0?tsdAt+1:null,knownPieceHorizon:s.queue.length+1,rootEnumerationComplete:root.complete,budgetExhausted:stopped||Boolean(base.metrics.proofScheduling?.unfinished||base.metrics.proofScheduling?.budgetStops),searchIncomplete:Boolean(base.metrics.proofScheduling?.unfinished||base.metrics.proofScheduling?.budgetStops),informationBoundary:!best.state.active,initialSealed:initial.sealed,endpointSealed:best.assessment.sealed,regionalSupport:best.assessment.regionalSupport,channel:best.assessment.channel,endpointTEntry:best.assessment.right.entry?.status??'not-established',unresolvedObligations:best.assessment.obligations,structuralScore:best.structuralScore,structuralRank:best.rank,structure:best.assessment.structure,dependencyDebt:best.dependencyDebt,claim:'Finite executable prefix; endpoint estimates are not a sustainability guarantee.'},assessment:best.assessment};
}
}
function plan(raw,options={}){return queryRequest(()=>planRequest(raw,options));}
function queryRequest(run){if(!R.withQueries)return run();return R.withQueries(()=>{const result=run();result.metrics={...result.metrics,queries:R.queryMetrics()};return result;});}
function planRequest(raw,options={}){
 options={...options,[resourceRepairCache]:new Map()};
 const now=options.now||(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs);
 // Only this synchronous invocation can reuse its own fully checked ordinary
 // fallback. Serialized evidence, caller callbacks and imported advice carry
 // no authority. The exact returned object AND continuation remain bound.
 let ordinaryFallback=null,ordinarySignature=null,retainedFallback=null,retainedSignature=null,maintenanceFallback=null,maintenanceSignature=null;
 const signature=r=>JSON.stringify([observe(raw),{...r,metrics:undefined}]);
 const admitMaintenance=candidate=>{const checked=finalCheck(candidate);if(checked?.target){maintenanceFallback=clone(checked);maintenanceSignature=signature(maintenanceFallback);}return checked;};
 const normalOpeningDecision=()=>{const result=plan(raw,{...options,deadline,disableSourceScoring:true,openingSource:null});ordinaryFallback=result;ordinarySignature=JSON.stringify([observe(raw),{...result,metrics:undefined}]);return result;};
 const sameOrdinary=()=>ordinaryFallback&&ordinarySignature===JSON.stringify([observe(raw),{...ordinaryFallback,metrics:undefined}]);
 const sameRetained=()=>retainedFallback&&retainedSignature===JSON.stringify([observe(raw),{...retainedFallback,metrics:undefined}]);
 // Only an internal producer can register a fallback, and registration itself
 // performs the full final boundary check within this request's shared budget.
 const checkOpeningFallback=candidate=>{const checked=finalCheck(candidate);if(checked?.target){retainedFallback=checked;retainedSignature=JSON.stringify([observe(raw),{...checked,metrics:undefined}]);}return checked;};
 const result=planCore(raw,{...options,deadline,normalOpeningDecision,checkOpeningFallback,admitMaintenance});
 if(result===ordinaryFallback&&sameOrdinary()||result===retainedFallback&&sameRetained())return result;
 const checked=finalCheck(result);
 if(!checked?.target&&maintenanceFallback&&signature(maintenanceFallback)===maintenanceSignature){
  // Only this invocation's admitted clone can survive later interrupted work.
  // Preserve actual spent nodes and search-depth completeness, not the old
  // incumbent's cheaper metrics. No imported certificate supplies authority.
  return{...maintenanceFallback,metrics:{...checked.metrics,...(checked.metrics?.usage?{usage:{...checked.metrics.usage,selected:maintenanceFallback.metrics.usage?.selected??null}}:{}),firstCertified:result.metrics?.firstCertified,admissionAttempts:result.metrics?.admissionAttempts,admissionFailures:result.metrics?.admissionFailures,certifiedHorizon:maintenanceFallback.continuation.length,certifiedFallback:{selected:true,locks:maintenanceFallback.continuation.length}},evidence:{...maintenanceFallback.evidence,budgetExhausted:checked.status==='budget-exhausted'||Boolean(result.evidence?.budgetExhausted),searchIncomplete:true}};
 }
 return supportPreference(checked);
 function supportPreference(checked){
  // Optional work starts only after the unchanged ordinary result is fully
  // admitted. It cannot consume the incumbent's proof budget or revoke it.
  if(!checked?.target||options.openingPhase!==false||options.allowHold===false||options.disableLeftSupport||options.disableConstruction||options.commitment||options.constructionPrevious||checked.evidence?.opening||checked.evidence?.construction||checked.evidence?.commitmentRetained)return checked;
  const goal=cycleResources(checked.continuation||[]),first=checked.continuation?.[0];
  if(goal.tsds||goal.quads||goal.centerPreparations||goal.centerCompletions||goal.leftFoundations||goal.outstandingPocket!==1||first?.event.type!=='I'||first.structuralEvidence?.allocation!=='quad-preparation'||!options.resourceContext||resourceSummary(raw,options).coverage.status!=='complete'||!Y.supportEligibility(raw))return checked;
  const incumbent=clone(checked),bound=signature(incumbent),limit=options.maxNodes??45000,optionalStarted=now();let used=checked.metrics?.nodes||0;
  const telemetry={attempted:true,selected:false,nodes:0,scope:'finite-open-Left-support-with-actual-visible-Right-I-replacement',incumbentRightCells:clone(first.event.cells),incumbentFirst:{witness:first.witness.slice(),event:clone(first.event)}};
  const finish=result=>{telemetry.nodes=used-(checked.metrics?.nodes||0);return{...result,metrics:{...result.metrics,nodes:used,elapsedMs:(checked.metrics?.elapsedMs||0)+Math.max(0,now()-optionalStarted),leftSupportPreference:telemetry}};};
  const fallback=()=>signature(incumbent)===bound?finish(incumbent):{...checked,target:null,witness:[],continuation:[],status:'invalid-input',reason:'The public request changed during optional support verification.',metrics:{...checked.metrics,nodes:used,certifiedHorizon:0}};
  if(now()>=deadline||used>=limit)return fallback();
  const found=Y.supportSearch(observe(raw),{deadline,now,maxNodes:Math.max(0,limit-used)});used+=found.visited;
  if(!found.candidate||now()>=deadline||used>=limit)return fallback();
  found.candidate.resourceContext=clone(options.resourceContext);
  const tracker={nodes:0},candidate=constructionAdvice(observe(raw),found.candidate,deadline,now,Math.max(0,limit-used),tracker,options);used+=tracker.nodes;
  const sameCells=(a,b)=>a.length===b.length&&a.every(([x,y])=>b.some(([u,v])=>x===u&&y===v));
  if(!candidate||!sameCells(candidate.continuation.at(-1).event.cells,first.event.cells)||now()>=deadline||used>=limit)return fallback();
  candidate.metrics={...incumbent.metrics,...candidate.metrics,nodes:used,stageProofLocks:candidate.continuation.length};
  const admitted=finalCheck(candidate);used=admitted.metrics?.nodes??used;
  if(!admitted.target||now()>=deadline||used>limit)return fallback();
  telemetry.selected=true;telemetry.locks=admitted.continuation.length;return finish(admitted);
 }
 function finalCheck(result){
 if(!result?.target)return result;
 if(!result.evidence?.opening){
  const resource=checkedResourceEndpoint(raw,result.continuation||[],{...options,deadline,maxNodes:Math.max(0,(options.maxNodes??45000)-(result.metrics?.nodes||0))});
  result={...result,metrics:{...result.metrics,nodes:(result.metrics?.nodes||0)+(resource.visited||0),resourceProofNodes:resource.visited||0}};
  if(!resource.valid){
   for(const name of ['sourceConstruction','earlyCapFallback','levelBaseReentry','tieExtension'])if(result.metrics[name])result.metrics[name]={...result.metrics[name],selected:false};
   if(result.metrics.usage?.scope==='maintenance')result.metrics.usage={...result.metrics.usage,selected:null,families:Object.fromEntries(Object.entries(result.metrics.usage.families).map(([name,family])=>[name,'selected'in family?{...family,selected:0}:family]))};
   return{...result,status:'no-supported-continuation-found',metrics:{...result.metrics,certifiedHorizon:0},target:null,witness:[],continuation:[],reason:'No ordinary-midgame route preserving the observed T, Z and Center obligations was verified.',evidence:{...result.evidence,resourceObligations:{status:'rejected',reason:resource.reason}}};
  }
  result={...result,evidence:{...result.evidence,resourceObligations:{status:'checked',binding:resource.resource.originKey,extraZ:resource.resource.extraZ,pendingCenter:resource.resource.pendingCenter,hangingS:resource.resource.hangingS,unclassifiedS:resource.resource.unclassifiedS,hangingL:resource.resource.hangingL}}};
 }
 const state=observe(raw),scoring=Boolean(result.evidence?.opening?.scoringPlan),replayUnits=scoring?(result.continuation||[]).reduce((n,p)=>n+p.witness.length,0):0,used=result.metrics?.nodes||0,limit=options.maxNodes??45000;
 const canCheck=!scoring||now()<deadline&&used+replayUnits<=limit;
 const check=canCheck?A.prefix(state,result.continuation||[],{notches:H.resolve(state,options.patternHistory),deadline,now,maxNodes:Math.max(0,limit-used-replayUnits)}):{reachable:null,visited:0,status:'unknown-access-budget'};
 const finalMetrics={...result.metrics,certifiedHorizon:0,nodes:used+(canCheck?replayUnits:0)+(check?.visited||0)};
 if(check?.reachable===true&&(!scoring||now()<deadline&&finalMetrics.nodes<=limit))return{...result,evidence:{...result.evidence,gapAccess:check},metrics:{...finalMetrics,certifiedHorizon:result.continuation.length}};
 // Failed experimental final validation cannot erase the unchanged ordinary
 // decision already proved in this exact invocation. Never trust copied flags.
 const checkedFallback=sameRetained()?retainedFallback:sameOrdinary()?ordinaryFallback:null;
 if(scoring&&checkedFallback){checkedFallback.metrics={...checkedFallback.metrics,nodes:finalMetrics.nodes,elapsedMs:finalMetrics.elapsedMs,sourceScoring:{...finalMetrics.sourceScoring,selected:null,finalValidationFallback:true}};return checkedFallback;}
 if(finalMetrics.sourceConstruction)finalMetrics.sourceConstruction.selected=false;
 if(finalMetrics.usage?.scope==='opening'&&finalMetrics.usage.selected?.path==='verified-source-pattern'){finalMetrics.usage.selected=null;if(finalMetrics.usage.families.sourcePattern)finalMetrics.usage.families.sourcePattern.selected=0;}
 if(finalMetrics.earlyCapFallback)finalMetrics.earlyCapFallback.selected=false;
 if(finalMetrics.levelBaseReentry)finalMetrics.levelBaseReentry.selected=false;
 if(finalMetrics.tieExtension)finalMetrics.tieExtension.selected=false;
 if(finalMetrics.usage?.scope==='maintenance'){finalMetrics.usage.selected=null;for(const family of Object.values(finalMetrics.usage.families))if('selected'in family)family.selected=0;}
 return{...result,metrics:finalMetrics,status:check?.reachable===false?'no-supported-continuation-found':'budget-exhausted',target:null,witness:[],continuation:[],reason:'No move with checked access to its newly covered construction cells was found. A different repair may exist.',evidence:{gapAccess:check}};
}
}
// Keep a committed target through an exactly followed input, including HOLD.
// The entire remaining prefix is replayed from the new observation, so a newly
// revealed piece cannot silently preserve an obsolete proof.
function advance(raw,previous,action,options={}){
 if(previous?.evidence?.opening?.scoringPlan)return openingModule().retainScoring(raw,previous,options,action);
 if(previous?.evidence?.opening?.sourcePlan)return openingModule().retainSource(raw,previous,options,action);
 if(previous?.evidence?.opening)return null;
 if(previous?.evidence?.cycleDebt>0)return null;
 if(!previous?.target||action==='HD'||previous.witness?.[0]!==action)return null;
 let state;try{state=observe(raw);}catch{return null;}
 if(R.validate(state).length||(state.bag&&B.validate(state.bag).length))return null;
 const witness=previous.witness.slice(1);if(!witness.length)return null;
 if(previous.evidence?.construction?.kind==='left-support'){
  // A copied kind/consumed flag cannot authorize the first-I exception during
  // HOLD or movement. Recreate the full original visible proof first.
  const now=options.now||(()=>Date.now()),deadline=options.deadline??now()+150,limit=options.maxNodes??12000,tracker={nodes:0};
  const refreshed=constructionAdvice(state,previous.evidence.construction,deadline,now,limit,tracker,options);
  if(!refreshed||JSON.stringify(refreshed.witness)!==JSON.stringify(witness)||JSON.stringify(refreshed.continuation.map(p=>p.event))!==JSON.stringify(previous.continuation.map(p=>p.event)))return null;
  const bounds={...options,now,deadline,maxNodes:Math.max(0,limit-tracker.nodes)},resources=checkedResourceEndpoint(state,refreshed.continuation,bounds);tracker.nodes+=resources.visited||0;if(!resources.valid)return null;
  const access=A.prefix(state,refreshed.continuation,{...bounds,notches:H.resolve(state,options.patternHistory),maxNodes:Math.max(0,limit-tracker.nodes)});tracker.nodes+=access.visited;
  if(access.reachable!==true||now()>=deadline||tracker.nodes>limit)return null;
  return{...refreshed,retained:true,metrics:{...refreshed.metrics,certifiedHorizon:refreshed.continuation.length,revalidationNodes:tracker.nodes},evidence:{...refreshed.evidence,resourceObligations:{status:'checked',binding:resourceBinding(state,options)}}};
 }
 const steps=previous.continuation.map((step,i)=>({...step,witness:i?step.witness:witness,hold:i?step.hold:witness.includes('HOLD'),holdCount:i?holdCount(step):witness.filter(a=>a==='HOLD').length}));
 let current=extendForced(state),notches=H.resolve(state,options.patternHistory);if(notches.status==='invalid-history'||notches.status==='broken')return null;for(const step of steps){const replay=R.replay(current,step.witness);
  if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;
  const check=S.advanceNotches(current.board,{event:replay.events[0],state:replay.state},notches);if(!check.valid)return null;notches=check.pattern;
  current=replay.state;
 }
 const bounds={...options,maxNodes:options.maxNodes??12000,deadline:options.deadline??Date.now()+150},resources=checkedResourceEndpoint(state,steps,bounds);if(!resources.valid)return null;
 if(!repairedPrefix(state,steps))return null;
 const access=A.prefix(state,steps,{...bounds,maxNodes:Math.max(0,bounds.maxNodes-resources.visited),notches:H.resolve(state,options.patternHistory)});if(access.reachable!==true)return null;
 return{...previous,revision:state.revision,context:context(state),witness,hold:witness.includes('HOLD'),holdCount:witness.filter(a=>a==='HOLD').length,continuation:steps,
  ...advicePresentation(steps,previous.assessment,previous.evidence?.construction),retained:true,metrics:{...previous.metrics,certifiedHorizon:steps.length,revalidationNodes:resources.visited+access.visited},
  evidence:{...previous.evidence,knownPieceHorizon:state.queue.length+1,resourceObligations:{status:'checked',binding:resourceBinding(state,options)}}};
}
function revalidate(raw,previous,options={}){
 const now=options.now||(()=>Date.now());options={...options,deadline:options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs),now};
 if(previous?.evidence?.opening?.scoringPlan)return openingModule().retainScoring(raw,previous,options);
 if(previous?.evidence?.opening?.sourcePlan)return openingModule().retainSource(raw,previous,options);
 if(previous?.evidence?.opening)return null;
 let s;try{s=observe(raw);}catch{return null;}if(previous?.evidence?.cycleDebt>0||previous?.continuation?.some(p=>!S.canonicalClear(p.event)))return null;if(!previous?.target||context(s)!==previous.context||R.validate(s).length)return null;
 if(previous.evidence?.resourceObligations?.binding&&previous.evidence.resourceObligations.binding!==resourceBinding(s,options))return null;

 if(previous.evidence?.construction){
  const tracker={nodes:0},refreshed=constructionAdvice(s,previous.evidence.construction,options.deadline,now,options.maxNodes??8000,tracker,options);if(options.budgetTracker)options.budgetTracker.nodes+=tracker.nodes;
  if(!refreshed||JSON.stringify(refreshed.continuation.map(p=>p.event))!==JSON.stringify(previous.continuation.map(p=>p.event)))return null;
  const resource=checkedResourceEndpoint(s,refreshed.continuation,{...options,maxNodes:Math.max(0,(options.maxNodes??8000)-tracker.nodes)});tracker.nodes+=resource.visited||0;if(!resource.valid)return null;
  const access=A.prefix(s,refreshed.continuation,{...options,notches:H.resolve(s,options.patternHistory),maxNodes:Math.max(0,(options.maxNodes??8000)-tracker.nodes)});if(options.budgetTracker)options.budgetTracker.nodes+=access.visited;
  if(previous.evidence.construction.kind==='left-support'&&(now()>=options.deadline||tracker.nodes+access.visited>(options.maxNodes??8000)))return null;
  return access.reachable===true?{...refreshed,retained:true,metrics:{...refreshed.metrics,certifiedHorizon:refreshed.continuation.length,nodes:tracker.nodes+access.visited,revalidationNodes:tracker.nodes,gapAccessNodes:access.visited}}:null;
 }

 const enumeration=R.placements(extendForced(s),{maxNodes:options.maxNodes??8000,deadline:options.deadline,now:options.now});
 if(options.budgetTracker)options.budgetTracker.nodes+=enumeration.visited;
 const p=enumeration.placements.find(p=>S.canonicalClear(p.event)&&holdCount(p)===holdCount(previous)&&JSON.stringify(p.target)===JSON.stringify(previous.target)&&p.event.spin===previous.continuation?.[0]?.event.spin&&p.event.lines===previous.continuation?.[0]?.event.lines);
 if(!p)return null;
 const continuation=[{...previous.continuation[0],target:p.target,hold:p.hold,holdCount:holdCount(p),witness:p.witness,event:p.event},...previous.continuation.slice(1)];
 let current=extendForced(s),notches=H.resolve(s,options.patternHistory);if(notches.status==='invalid-history'||notches.status==='broken')return null;for(const step of continuation){const replay=R.replay(current,step.witness);if(!replay.valid||replay.events.length!==1||!S.canonicalClear(replay.events[0])||JSON.stringify(replay.events[0])!==JSON.stringify(step.event)||(step.resultContext&&context(replay.state)!==step.resultContext))return null;const check=S.advanceNotches(current.board,{event:replay.events[0],state:replay.state},notches);if(!check.valid)return null;notches=check.pattern;current=replay.state;}
 const resources=checkedResourceEndpoint(s,continuation,{...options,maxNodes:Math.max(0,(options.maxNodes??8000)-enumeration.visited)});if(!resources.valid)return null;
 if(!repairedPrefix(s,continuation))return null;
 const access=A.prefix(s,continuation,{...options,notches:H.resolve(s,options.patternHistory),maxNodes:Math.max(0,(options.maxNodes??8000)-enumeration.visited-resources.visited)});if(options.budgetTracker)options.budgetTracker.nodes+=access.visited;if(access.reachable!==true)return null;
 return{...previous,revision:s.revision,hold:p.hold,holdCount:holdCount(p),witness:p.witness,continuation,...advicePresentation(continuation,previous.assessment,previous.evidence?.construction),metrics:{...previous.metrics,certifiedHorizon:continuation.length,nodes:enumeration.visited+resources.visited+access.visited,revalidationNodes:enumeration.visited+resources.visited,gapAccessNodes:access.visited},retained:true};
}
// Shared UI/simulator transport helper. This bounded copy is only a routing
// candidate: no resource identity, historical status or certificate is trusted.
function captureHandoffRecovery(raw,advice,resourceContext){
 try{
  if(advice?.evidence?.openingHandoff?.recovery!=='shared-after-legacy-budget-miss'||!Array.isArray(advice.continuation)||advice.continuation.length!==2)return null;
  // Capture only before the real handoff mark; a mid-piece worker reply must
  // not overwrite the original observation/history binding with a later one.
  if(resourceContext!=null&&resourceContext.handoffAtAction!==null)return null;
  const observation=observe(raw);if(observation.queue.length>6)return null;
  const value={observation,advice,resourceContext},seen=new Set();let nodes=0,characters=0;
  const bounded=(v,depth)=>{
   if(++nodes>50000||depth>64)throw Error('Recovery candidate exceeds structural bounds');
   if(typeof v==='string'){characters+=v.length;if(characters>1048576)throw Error('Recovery candidate exceeds text bounds');return;}
   if(v===null||v===undefined||typeof v==='boolean'||typeof v==='number')return;
   if(typeof v!=='object'||seen.has(v)||Array.isArray(v)&&v.length>4096)throw Error('Invalid recovery candidate');
   seen.add(v);for(const [key,item]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid recovery property');characters+=key.length;bounded(item,depth+1);}seen.delete(v);
  };
  bounded(value,0);const encoded=JSON.stringify(value);return encoded.length<=1048576?JSON.parse(encoded):null;
 }catch{return null;}
}
// A recovered handoff may supply a candidate, never a trusted goal flag. Only
// one immediate payment of the same replay-known Hanging S is retained here.
// All work belongs to the next decide request; ordinary goal/rank policy is unchanged.
function retainHandoffRecovery(raw,options,work){
 const tracker=options.budgetTracker,limit=options.maxNodes,now=options.now,deadline=options.deadline,start=tracker.nodes;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),left=()=>Math.max(0,limit-tracker.nodes);
 const fail=reason=>{work.reason=reason;return null;};
 const spend=n=>{if(now()>=deadline||n>left())return false;tracker.nodes+=n;return true;};
 try{
  if(now()>=deadline||left()<=0)return fail('shared-budget');
  const candidate=options.handoffRecovery,advice=candidate?.advice,steps=advice?.continuation;
  if(options.openingPhase!==false||advice?.evidence?.openingHandoff?.recovery!=='shared-after-legacy-budget-miss'||advice.evidence.opening||advice.evidence.construction||!Array.isArray(steps)||steps.length!==2)return fail('candidate-shape');
  if(!same(advice.witness,steps[0].witness)||!same(advice.target,steps[0].target)||advice.hold!==steps[0].hold||holdCount(advice)!==holdCount(steps[0]))return fail('candidate-shape');
  for(const step of steps)if(!Array.isArray(step.witness)||!step.witness.length||step.witness.length>256||step.witness.at(-1)!=='HD'||step.witness.slice(0,-1).includes('HD')||!same(step.target,step.event?.target)||step.hold!==step.witness.includes('HOLD')||holdCount(step)!==step.witness.filter(a=>a==='HOLD').length)return fail('candidate-shape');
  const pay=steps[1];if(pay.event?.type!=='S'||pay.event.lines!==0||!Array.isArray(pay.event.cells)||pay.event.cells.length!==4||!pay.event.cells.every(([x])=>x>=0&&x<4))return fail('not-immediate-left-S');
  const origin=observe(candidate.observation),state=observe(raw);
  if(R.validate(origin).length||R.validate(state).length||origin.queue.length>6||state.queue.length>6||!origin.active||!state.active||origin.topOut||state.topOut||(origin.bag&&B.validate(origin.bag).length)||(state.bag&&B.validate(state.bag).length)||advice.context!==context(origin))return fail('observation');
  const priorContext=candidate.resourceContext,currentContext=options.resourceContext;
  const priorSummary=resourceSummary(origin,{resourceContext:priorContext}),summary=resourceSummary(state,options);
  if(priorSummary.coverage?.status!=='complete'||summary.coverage?.status!=='complete'||!priorContext||!currentContext)return fail('resource-history');
  // Follow an actual connected one-lock history, not necessarily the same
  // movement route. Replaying its exact event/result below permits a legal
  // detour, but never another HD, post-lock movement or guessed reveals.
  const actualSteps=currentContext.steps.slice(priorContext.steps.length);
  if(priorContext.handoffAtAction!==null||currentContext.handoffAtAction!==priorContext.steps.length||!same(priorContext.origin,currentContext.origin)||priorContext.fresh!==currentContext.fresh||!actualSteps.length||actualSteps.length>256||actualSteps.at(-1).action!=='HD'||actualSteps.slice(0,-1).some(s=>s.action==='HD')||!same(currentContext.steps.slice(0,priorContext.steps.length),priorContext.steps)||summary.locks!==priorSummary.locks+1||summary.milestones?.maintenanceHandoff?.at!==priorSummary.locks)return fail('history-not-connected');
  if(priorSummary.openingAllocation?.status!=='verified-first-tsd'||priorSummary.openingAllocation.requiredNonRightZ!==0||!priorSummary.extraZ?.baseline||!['available','used'].includes(priorSummary.extraZ.status)||!openingModule().handoffGeometry(origin))return fail('source-eligibility');
  const known=priorSummary.hangingS?.evidence?.[0];
  const live=(view,id)=>[view.instances?.active,view.instances?.hold,...(view.instances?.queue||[])].find(p=>p?.id===id&&p.type==='S');
  if(priorSummary.hangingS?.status!=='hanging'||priorSummary.hangingS.evidence.length!==1||priorSummary.hangingS.unclassified?.length||!Number.isInteger(known?.sId)||known.sId<=0||!Number.isInteger(known.bag)||known.bag<0||!live(priorSummary,known.sId)||summary.hangingS?.status!=='hanging'||summary.hangingS.unclassified?.length||!summary.hangingS.evidence.some(s=>s.sId===known.sId&&s.bag===known.bag&&s.lId===known.lId)||!live(summary,known.sId))return fail('known-S-identity');
  if(advice.evidence.resourceObligations?.status!=='checked'||advice.evidence.resourceObligations.binding!==resourceBinding(origin,{resourceContext:priorContext}))return fail('origin-resource-binding');
  const rootPattern=H.resolve(origin,null),currentPattern=H.resolve(state,options.patternHistory);
  if(rootPattern.status!=='established'||currentPattern.status!=='established')return fail('pattern-history');
  if(!spend(actualSteps.length+steps.reduce((n,p)=>n+p.witness.length,0)))return fail('shared-budget');
  // Reconstruct ordinary structural and resource policy, rather than accepting
  // serialized cycleDebt, pair or gapAccess claims from the old advice.
  const makeInitial=(s,view,notches)=>{const a=assess(s.board);a.state=extendForced(s);a.notches=notches;a.resources=M.start(a.state,view);return a;};
  const initial=makeInitial(origin,priorSummary,rootPattern);let node=null,first=null;
  for(const step of steps){const before=node?.state??initial.state,r=R.replay(before,step.witness);if(!r.valid||r.events.length!==1||!same(r.events[0],step.event)||!S.canonicalClear(r.events[0])||step.resultContext!==context(r.state))return fail('origin-prefix');
   node=nodeFor({state:r.state,event:r.events[0],target:r.events[0].target,witness:step.witness,hold:step.hold,holdCount:holdCount(step),...policyWitnesses(before)},node,initial,0);if(!first)first=node;
   if(!node.notchValid||node.cycleDebt||node.assessment.maxHeight>=20)return fail('origin-policy');
  }
  if(!certifiedCavities(node)||!node.assessment.regionalSupport)return fail('origin-policy');
  let actual=origin;for(const step of actualSteps){const next=R.move(actual,step.action);if(next===actual)return fail('actual-lock');actual={...next,queue:[...next.queue,...step.revealed]};for(const piece of step.revealed)if(actual.bag)actual={...actual,bag:B.consume(actual.bag,piece)};}
  if(!same(actual.lastEvent,candidate.actualEvent)||!same(first.path[0].event,actual.lastEvent)||!sameConstructionResult(first.state,state)||context(actual)!==context(state)||!same(actual.active,state.active)||actual.streamCursor!==state.streamCursor)return fail('actual-lock');
  const phase=first.notches;if(phase.status!==currentPattern.status||phase.anchorRow!==currentPattern.anchorRow||!same(phase.protectedRows,currentPattern.protectedRows))return fail('pattern-history');
  const priorOptions={...options,resourceContext:priorContext,patternHistory:null,maxNodes:left()};
  const oldResource=checkedResourceEndpoint(origin,steps,priorOptions);if(!oldResource.valid)return fail('origin-resource-proof');
  const oldAccess=A.prefix(origin,steps,{now,deadline,maxNodes:left(),notches:rootPattern});tracker.nodes+=oldAccess.visited;
  if(oldAccess.reachable!==true)return fail('origin-access');
  if(now()>=deadline||left()<=0)return fail('shared-budget');
  const actualInitial=makeInitial(state,summary,currentPattern),supply=actualInitial.resources;
  let active=supply.active,held=supply.hold,queue=supply.queue.slice();for(const action of pay.witness)if(action==='HOLD'){if(held){const swap=active;active=held;held=swap;}else{held=active;active=queue.shift();}}
  if(active?.id!==known.sId||active?.bag!==known.bag)return fail('different-S-identity');
  if(!spend(pay.witness.length))return fail('shared-budget');
  const replay=R.replay(actualInitial.state,pay.witness);if(!replay.valid||replay.events.length!==1||!same(replay.events[0],pay.event))return fail('current-suffix');
  const suffixNode=nodeFor({state:replay.state,event:replay.events[0],target:replay.events[0].target,witness:pay.witness,hold:pay.hold,holdCount:holdCount(pay),...policyWitnesses(actualInitial.state)},null,actualInitial,0);
  if(!suffixNode.notchValid||suffixNode.cycleDebt||!certifiedCavities(suffixNode)||!suffixNode.assessment.regionalSupport||suffixNode.assessment.maxHeight>=20||suffixNode.resources.hangingS.some(s=>s.id===known.sId)||suffixNode.resources.unclassifiedS.some(s=>s.sId===known.sId))return fail('current-payment-policy');
  const step={...suffixNode.path[0],resultContext:context(replay.state)};delete step.state;
  const evidence={strategy:'canonical-right-ST',cycleDebt:0,resourceObligations:{status:'checked',binding:resourceBinding(state,options)},handoffRecovery:{status:'observed-S-payment-candidate',sId:known.sId,bag:known.bag}};
  const next={status:'recommended-with-verified-prefix',revision:state.revision,context:context(state),target:step.target,witness:step.witness,hold:step.hold,holdCount:holdCount(step),continuation:[step],metrics:{nodes:0,depth:1,completeDepth:0,certifiedHorizon:0},assessment:suffixNode.assessment,evidence,...advicePresentation([step],suffixNode.assessment)};
  const checked=revalidate(state,next,{...options,maxNodes:left()});
  if(!checked||now()>=deadline||tracker.nodes>limit)return fail('current-revalidation');
  checked.evidence.handoffRecovery.status='observed-S-payment-retained';work.retained=true;work.reason='same-observed-S-paid';return checked;
 }catch{return fail('invalid-candidate');}
 finally{work.nodes=tracker.nodes-start;}
}
function openingModule(){return typeof module==='object'&&module.exports?require('./st-opening.js'):globalThis.STOpening;}
function startOpeningSession(raw,options){return openingModule().startSession(raw,options);}
function updateOpeningSession(session,before,after,event){return openingModule().updateSession(session,before,after,event);}
function acceptOpeningResult(session,result){return openingModule().acceptResult(session,result);}
function decide(raw,options={}){return queryRequest(()=>decideRequest(raw,options));}
function decideRequest(raw,options={}){
 const now=options.now||(()=>Date.now()),deadline=options.deadline??(options.timeMs===undefined?Infinity:now()+options.timeMs),budgetTracker={nodes:0},limit=options.maxNodes??45000;
 options={...options,now,deadline};const previous=options.previous;
 const recovery=options.handoffRecovery?{attempted:true,retained:false,nodes:0,reason:options.commitment?'existing-commitment':'not-checked'}:null;
 const recovered=recovery&&!options.commitment?retainHandoffRecovery(raw,{...options,budgetTracker,maxNodes:limit},recovery):null;
 if(recovered)return{...recovered,metrics:{...recovered.metrics,nodes:budgetTracker.nodes,revalidationNodes:budgetTracker.nodes,handoffRecovery:recovery}};
 if(previous?.evidence?.construction)options={...options,constructionPrevious:previous};
 const retained=!options.commitment&&previous?revalidate(raw,previous,{...options,budgetTracker,maxNodes:Math.max(0,limit-budgetTracker.nodes)}):null;
 if(retained)return recovery?{...retained,metrics:{...retained.metrics,nodes:budgetTracker.nodes,revalidationNodes:budgetTracker.nodes,handoffRecovery:recovery}}:retained;
 const result=plan(raw,{...options,handoffRecovery:null,maxNodes:Math.max(0,limit-budgetTracker.nodes)});
 return budgetTracker.nodes||recovery?{...result,metrics:{...result.metrics,nodes:(result.metrics?.nodes||0)+budgetTracker.nodes,revalidationNodes:budgetTracker.nodes,...(recovery?{handoffRecovery:recovery}:{})}}:result;
}

return Object.freeze({preserveExtraZ,orderContinuations,advicePresentation,observe,assess,plan,decide,captureHandoffRecovery,resetSelection,startPatternHistory:H.start,updatePatternHistory:H.update,resolvePatternHistory:H.resolve,gapAccess:A.check,checkAccessPrefix:A.prefix,startOpeningSession,updateOpeningSession,acceptOpeningResult,revalidate,advance,cavityRepairDebt,continueCommitment,cycleResources,resourceGoal,resourceGoalPrefix,scoringSchedule,scoringReplacement,centerReservationStep,centerContinuityStep,ordinaryCenterEligible});
});
