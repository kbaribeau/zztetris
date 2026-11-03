/* Reset consideration is a public support-risk test, not a placement proof.
 * The caller must obtain resources from replay-authenticated empty-origin history. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-rules'),require('./st-structure'),require('./st-bag')):factory(root.STRules,root.STStructure,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STResetPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,S,B){
'use strict';
const qualifies=e=>Boolean(e&&e.type==='T'&&e.lines===0&&e.cells?.length===4&&e.cells.every(([x])=>x>=0&&x<4));
function consider(raw,resources){
 const result=(status,reason,extra={})=>({policy:'late-support-arrival-risk-v1',status,reason,resourceRenewal:false,...extra});
 if(!raw||R.validate(raw).length||raw.bag&&B.validate(raw.bag).length)return result('invalid-observation','A valid public observation is required.');
 if(!raw.active||raw.topOut)return result('out-of-scope','A live position is required.');
 if(resources?.coverage?.status!=='complete'||!resources.extraZ?.baseline)return result('unknown-history','Reset requires verified empty-board opening and allocation history.');
 if(resources.reset?.status==='active')return result('active','Continue the selected Reset until its second qualifying T.',{progress:resources.reset.progress});
 if(resources.extraZ.status!=='used')return result('ordinary-preferred','Only late Midgame considers Reset.');
 const phase=S.notchPattern(raw.board);
 if(phase.status!=='established')return result('out-of-scope','The scoring-row phase must be established.');
 // A next TSD clears these two rows. Columns 6..8 contain the T itself;
 // support in Left and the two full Center columns is necessary independently.
 const rows=[phase.anchorRow,phase.anchorRow+1].filter(y=>y>=0&&y<40);
 const missing=cols=>rows.flatMap(y=>cols.filter(x=>raw.board[y][x]==='.').map(x=>[x,y]));
 const left=missing([0,1,2,3]),center=missing([4,5]);
 if(phase.anchorRow+1<40&&raw.board[phase.anchorRow+1][6]==='.')center.push([6,phase.anchorRow+1]);
 if(!left.length&&!center.length)return result('ordinary-preferred','Both regions already support the next scoring rows.',{deficit:{left:0,center:0}});
 const supply=[raw.active.type,...raw.queue],visibleT=supply.indexOf('T');
 // HOLD is an actually available T, not another draw. If no T is visible,
 // only the earliest possible public bag member is considered, never a seed.
 let beforeT=raw.hold==='T'?0:visibleT>=0?visibleT:supply.length;
 let arrival=raw.hold==='T'?'held-T':visibleT>=0?'visible-T':'unseen-order-not-assumed';
 if(visibleT<0&&raw.hold!=='T'){
  // Derive the bag frontier from authenticated observed identities, not raw
  // imported bag metadata: replayed selection markers see the same evidence.
  const remaining=resources.publicBag?.remainingTypes,forced=remaining?.length===1?remaining[0]:null;
  if(forced&&forced!=='T'){beforeT++;arrival='public-forced-non-T-before-unseen-T';}
 }
 // An optimistic cell capacity is a negative control, never a geometric
 // promise. When it cannot cover either regional deficit in time, risk is real.
 // The active T may be held, but that does not make its support ready now.
 const capacity=beforeT*4,atRisk=left.length>capacity||center.length>capacity;
 return result(atRisk?'candidate':'ordinary-rebuild-preferred',atRisk?'Left or Center support may not be ready when the next T arrives.':'The public interval before T still permits rebuilding; Reset is not selected by height alone.',{deficit:{left:left.length,center:center.length},supportCells:{left,center},arrival:{kind:arrival,nonTBefore:beforeT,optimisticCapacity:capacity},claim:'Necessary support and public arrival risk, not proof that ordinary play is impossible.'});
}
return Object.freeze({consider,qualifies});
});
