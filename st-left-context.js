/* Shocky's Chapter 3.3 Left surfaces, interpreted in finite visible supply.
 * Tiers and oriented silhouettes are source facts; weights and two-lock horizon
 * are deliberately small engineering preferences, never legality certificates. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules')):factory(root.STRules);if(typeof module==='object'&&module.exports)module.exports=api;else root.STLeftContext=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R){
'use strict';
const SOURCE='https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit';
const WEIGHTS=Object.freeze({SS:6,S:4,A:2,B:0,C:-2,D:-4});
const catalog=[['SS',[0,0,0,2]],['SS',[2,0,0,0]],['S',[0,0,1,1]],['S',[2,2,2,0]],['A',[1,1,0,0]],['A',[0,2,2,2]],['A',[0,0,2,0]],['B',[1,0,0,1]],['B',[0,2,0,0]],['B',[2,2,0,2]],['C',[2,0,2,2]],['D',[0,1,1,0]]].map(([tier,profile],i)=>Object.freeze({id:'shocky-left-'+(i+1),tier,profile:Object.freeze(profile),weight:WEIGHTS[tier]}));
Object.freeze(catalog);const byProfile=new Map(catalog.map(p=>[p.profile.join(','),p]));
const normalize=h=>{const m=Math.min(...h);return h.map(v=>v-m);};
const rough=p=>p.slice(1).reduce((n,v,i)=>n+Math.abs(v-p[i]),0);
const classify=h=>byProfile.get(normalize(h).join(','))||null;
const shapes={};for(const type of 'IJLOSZ'){
 const seen=new Set();shapes[type]=[];
 for(let rotation=0;rotation<4;rotation++){
  const raw=R.cells({type,x:0,y:0,rotation}),minX=Math.min(...raw.map(c=>c[0])),maxY=Math.max(...raw.map(c=>c[1]));
  const cells=raw.map(([x,y])=>[x-minX,maxY-y]).sort(([x,y],[u,v])=>x-u||y-v),k=JSON.stringify(cells);if(seen.has(k))continue;seen.add(k);
  const width=Math.max(...cells.map(c=>c[0]))+1,bottom=Array(width).fill(Infinity),top=Array(width).fill(-1);
  for(const[x,y]of cells){bottom[x]=Math.min(bottom[x],y);top[x]=Math.max(top[x],y);}
  shapes[type].push({width,bottom,top});
 }
}
// Solid-column straight-drop surface fits only. No SRS/tuck/access claim: the
// ordinary planner still proves every selected placement with its real pose.
function landings(heights,type){const result=[],seen=new Set();for(const shape of shapes[type]||[])for(let x=0;x<=4-shape.width;x++){
 const base=Math.max(...shape.bottom.map((v,i)=>heights[x+i]-v));
 if(shape.bottom.some((v,i)=>base+v!==heights[x+i]))continue;
 const next=heights.slice();for(let i=0;i<shape.width;i++)next[x+i]=base+shape.top[i]+1;
 if(Math.max(...next)>=20)continue;const k=next.join(',');if(!seen.has(k)){seen.add(k);result.push(next);}
}return result;}
function inventory(state,resources){
 const token=(type,p)=>type?{type,id:p?.type===type?p.id:null}:null;
 return{a:token(state.active?.type,resources?.active),h:token(state.hold,resources?.hold),q:state.queue.map((t,i)=>token(t,resources?.queue?.[i])),canHold:state.canHold!==false};
}
function choices(n){const out=[];if(n.a)out.push({piece:n.a,next:{a:n.q[0]||null,h:n.h,q:n.q.slice(1),canHold:true},held:false});
 if(n.canHold&&n.a){if(n.h)out.push({piece:n.h,next:{a:n.q[0]||null,h:n.a,q:n.q.slice(1),canHold:true},held:true});
 else if(n.q.length)out.push({piece:n.q[0],next:{a:n.q[1]||null,h:n.a,q:n.q.slice(2),canHold:true},held:true});}
 return out;
}
function evaluate(state,{heights,covered=null,resources=null,centerDebt=[],center=null,right=null}={}){
 const h=heights||Array.from({length:4},(_,x)=>{const y=state.board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
 if(covered===null)covered=h.reduce((sum,v,x)=>sum+state.board.slice(40-v).filter(r=>r[x]==='.').length,0);
 const shape=classify(h),base={source:SOURCE,shape:shape?.id||null,tier:shape?.tier||null,profile:normalize(h),score:0,adjustment:0,context:'unlisted-neutral',horizon:2,executionVerified:false};
 if(covered)return{...base,context:'covered-cells-neutral'};
 // An unlisted silhouette has no community tier. It can nevertheless be a
 // useful intermediate allocation when the actual visible I/O/J inventory
 // fits a smoother listed surface in at most two locks. Credit only that
 // conversion, never the unknown shape itself; the planner's existing
 // roughness/height scores and execution/resource checks remain unchanged.
 const unlisted=!shape,startRoughness=rough(h);
 if(unlisted&&!startRoughness)return base;
 // Never count the Center's next partner (including O/J), or I while Right has
 // an established quad demand, as a free Left repair. Conservative exclusion is
 // a scoring estimate only; the real search may prove another allocation.
 const reserved=new Set((resources?.pendingCenter||[]).flatMap(p=>(p.alternatives||[]).map(a=>a.piece)));
 for(const d of centerDebt)for(const a of d.alternatives||[])reserved.add(a.piece);
 if(center?.status==='supported-partner-completion')for(const c of center.completions||[])if(c.patternSupport==='reference-supported')reserved.add(c.piece);
 const allowed=p=>{
  if(!p||p.type==='T'||reserved.has(p.type))return false;
  if(unlisted&&!'IJO'.includes(p.type))return false;
  if(p.type==='Z')return !right?.completions?.length&&resources?.extraZ==='available';
  if(p.type==='S')return p.id!==null&&(resources?.hangingS||[]).some(s=>s.id===p.id);
  if(p.type==='L')return p.id!==null&&(resources?.hangingL||[]).some(l=>l.id===p.id);
  if(p.type==='I'&&(right?.cycle?.prepareColumn!=null||right?.cycle?.cleanupColumns?.length))return false;
  return 'IJO'.includes(p.type);
 };
 const current=inventory(state,resources),first=choices(current).filter(c=>allowed(c.piece));let best=shape?.weight??0,fitCount=0,repair=null;
 for(const c of first)for(const next of landings(h,c.piece.type)){
  fitCount++;const one=classify(next);if(one&&one.weight>best&&(!unlisted||rough(next)<startRoughness)){best=one.weight;repair={pieces:[c.piece.type],tier:one.tier,hold:c.held};}
  for(const d of choices(c.next).filter(d=>allowed(d.piece)))for(const end of landings(next,d.piece.type)){
   // Extra Z is once per interval, never one fresh allowance per probe.
   if(c.piece.type==='Z'&&d.piece.type==='Z')continue;
   const two=classify(end);if(two&&two.weight-1>best&&(!unlisted||rough(end)<startRoughness)){best=two.weight-1;repair={pieces:[c.piece.type,d.piece.type],tier:two.tier,hold:c.held};}
  }
 }
 if(unlisted){
  const score=repair?best*.6+1:0;
  return{...base,score,adjustment:score,context:repair?'unlisted-visible-conversion':'unlisted-neutral',available:first.map(c=>({type:c.piece.type,held:c.held})),reserved:[...reserved].sort(),repair,fitCount};
 }
 // The guide warns that the old tier preference is less reliable with T held
 // after Extra Z. Do not invent a second tier list: use only estimated geometric local
 // conversion improvement in that case, and retain existing generic estimate.
 const late=resources?.extraZ==='used'&&state.hold==='T';
 const immediateJ=first.some(c=>c.piece.type==='J'&&landings(h,'J').length);
 const improvement=Math.max(0,best-shape.weight)*.6;
 const fit=first.length?(fitCount?1:-2):0;
 const score=late?improvement+fit:shape.weight+improvement+fit-(shape.tier==='D'&&!immediateJ?2:0);
 return{...base,score,adjustment:score,context:late?'held-T-after-extra-Z':'visible-inventory',available:first.map(c=>({type:c.piece.type,held:c.held})),reserved:[...reserved].sort(),immediateJ,repair,fitCount};
}
// Admission is separate from the two-lock preference above. Immediate means
// before another lock, through the rules' actual HOLD transitions (including
// empty HOLD), never merely membership later in the visible queue.
const boardHeights=board=>Array.from({length:4},(_,x)=>{const y=board.findIndex(r=>r[x]!=='.');return y<0?0:40-y;});
function createsD(before,after){return classify(boardHeights(after))?.tier==='D'&&classify(boardHeights(before))?.tier!=='D';}
function immediateJStarts(state,options={}){
 const starts=[];let current=state;
 for(let count=0;count<=(options.allowHold===false?0:2);count++){
  if(!current.active||current.topOut)break;
  if(current.active.type==='J')starts.push({state:current,witness:Array(count).fill('HOLD')});
  const next=R.move(current,'HOLD');if(next===current)break;current=next;
 }
 return starts;
}
function dExit(state,options={}){
 const now=options.now||(()=>Date.now()),deadline=options.deadline??Infinity,maxNodes=options.maxNodes??4000;
 const starts=immediateJStarts(state,options);let visited=0,complete=true;
 if(!starts.length)return{valid:false,complete:true,visited,reason:'D-created-without-immediate-J'};
 const covered=board=>{const out=new Set();for(let x=0;x<4;x++){let roof=false;for(let y=0;y<40;y++){if(board[y][x]!=='.')roof=true;else if(roof)out.add(x+','+y);}}return out;};
 const oldCovered=covered(state.board);let exit=null;
 for(const start of starts){
  const e=R.placements(start.state,{allowHold:false,now,deadline,maxNodes:Math.max(0,maxNodes-visited),stopWhen:p=>{
   const h=boardHeights(p.state.board),shape=classify(h);
   if(p.event.type!=='J'||p.event.lines||p.event.topOut||!p.event.cells.every(([x])=>x<4)||Math.max(...h)>=20||!(shape&&shape.tier!=='D'||h.every(v=>v===h[0])))return false;
   if([...covered(p.state.board)].some(c=>!oldCovered.has(c)))return false;
   const candidate={...p,witness:[...start.witness,...p.witness],hold:start.witness.length>0,holdCount:start.witness.length};
   if(options.acceptExit&&!options.acceptExit(candidate))return false;exit=candidate;return true;
  }});visited+=e.visited;
  if(exit)return{valid:true,complete:true,visited,reason:'immediate-executable-J-exit',exit};
  if(!e.complete)complete=false;
 }
 return{valid:false,complete,visited,reason:complete?'D-created-without-usable-J-exit':'D-J-exit-budget-unfinished'};
}
return Object.freeze({catalog,source:SOURCE,classify,landings,evaluate,createsD,immediateJStarts,dExit});
});
