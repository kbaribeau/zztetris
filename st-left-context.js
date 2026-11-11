/* Shocky's Chapter 3.3 Left surfaces, interpreted in finite visible supply.
 * Tiers and oriented silhouettes are source facts; weights and two-lock horizon
 * are deliberately small engineering preferences, never legality certificates. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure')):factory(root.STRules,root.STStructure);if(typeof module==='object'&&module.exports)module.exports=api;else root.STLeftContext=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S){
'use strict';
const SOURCE='https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit';
const {catalog,classify,isD,createsD}=S.leftSurface;
const rough=p=>p.slice(1).reduce((n,v,i)=>n+Math.abs(v-p[i]),0);
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
 const surface=S.leftSurface.assess(state.board,{heights,covered}),h=surface.heights,shape=surface.shape;
 covered=surface.covered;
 const base={source:SOURCE,shape:shape?.id||null,tier:shape?.tier||null,profile:surface.profile,score:0,adjustment:0,context:'unlisted-neutral',horizon:2,executionVerified:false};
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
 const improvement=Math.max(0,best-shape.weight)*.6;
 const fit=first.length?(fitCount?1:-2):0;
 const score=late?improvement+fit:shape.weight+improvement+fit;
 return{...base,score,adjustment:score,context:late?'held-T-after-extra-Z':'visible-inventory',available:first.map(c=>({type:c.piece.type,held:c.held})),reserved:[...reserved].sort(),repair,fitCount};
}
return Object.freeze({catalog,source:SOURCE,classify,landings,evaluate,isD,createsD});
});
