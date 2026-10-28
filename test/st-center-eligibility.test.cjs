const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../st-fixtures'),R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner');
const replay=(s,witness)=>{const r=R.replay(s,witness);assert.equal(r.valid,true);assert.equal(r.events.length,1);return {state:r.state,event:r.events[0],witness,target:r.events[0].target};};
test('center eligibility keeps actual horizontal SL preparation and its exact L finish',()=>{
 const s=F.get('after-quad').observation,p=replay(s,['R','HD']);
 assert.equal(p.event.type,'S');assert.equal(p.event.target.rotation,0);assert.equal(P.ordinaryCenterEligible(s,p),true);
 const phase=S.advanceNotches(s.board,p).pattern,c=S.geometry(p.state.board,{notches:phase}).center.completions.find(c=>c.piece==='L'&&c.resultStatus==='level');assert.ok(c);
 const l=R.createState({board:p.state.board,active:'L',canHold:false}),q=replay(l,c.witness);
 assert.equal(P.ordinaryCenterEligible(l,q,phase),true);assert.equal(S.transition(s,p).pairFamily,'SL');
});
test('center eligibility preserves recognized incomplete SL without pretending L is visible',()=>{
 const s=R.createState({...F.get('after-quad').observation,active:'S',hold:null,queue:[],bag:null,canHold:false}),p=replay(s,['R','HD']);
 assert.equal(p.state.active,null);assert.equal(P.ordinaryCenterEligible(s,p),true);
 assert.equal(S.geometry(p.state.board).center.status,'supported-partner-completion');
});
test('center eligibility rejects generic vertical S plus hypothetical leveling L as ordinary SL',()=>{
 const s=F.get('after-quad').observation,p=replay(s,['CW','HD']),c=S.geometry(p.state.board).center;
 assert.equal(p.event.type,'S');assert.ok(c.completions.some(c=>c.piece==='L'&&c.resultStatus==='level'),'physical hypothetical L exists');
 assert.equal(c.motif,'#../##./.#.');assert.equal(P.ordinaryCenterEligible(s,p),false);assert.equal(S.transition(s,p).pairFamily,null);
 assert.equal(P.ordinaryCenterEligible(s,{...p,repair:true,preparationProof:true,structuralEvidence:{pairFamily:'SL'}}),false,'serialized labels grant no admission');
});
test('center eligibility retains source OSIO vertical S and all actual partials without one-piece-finisher requirement',()=>{
 // Literal FOUR OSIO geometry on a synthetic aligned foundation. This asserts
 // geometry and admission, not original-bag/resource permission or policy choice.
 const rows=['XXXX......','XXXX......','XXXX......','XXXX......','XXXX......','XXXX.....X','XXXXXXX.XX','XXXXXXX.X.'];
 let s=R.createState({board:[...Array(32).fill('..........'),...rows],active:'O',queue:['S','I','O'],canHold:false}),phase=S.notchPattern(s.board);
 for(const [i,w]of [['HD'],['R','CW','HD'],['L','CW','HD'],['R','HD']].entries()){
  const p=replay(s,w);assert.equal(P.ordinaryCenterEligible(s,p,phase),true);phase=S.advanceNotches(s.board,p,phase).pattern;s=p.state;
  if(i===1){assert.equal(p.event.target.rotation,1);assert.equal(S.geometry(s.board,{notches:phase}).center.status,'unrecognized','multi-piece advanced partial lacks immediate finisher');}
 }
 assert.deepEqual(s.board.slice(32),['XXXXIOO...','XXXXIOO...','XXXXIS....','XXXXISS...','XXXXOOS...','XXXXOO...X','XXXXXXX.XX','XXXXXXX.X.']);
});
test('center eligibility does not turn recognized top motif above lower damage into ordinary support',()=>{
 const original=F.get('after-quad').observation,board=original.board.slice();
 const y=board.findLastIndex(row=>row[4]!=='.');assert.ok(y>=0);board[y]=board[y].slice(0,4)+'.'+board[y].slice(5);
 const s=R.createState({...original,board,active:'S',canHold:false}),p=replay(s,['R','HD']);
 assert.equal(S.geometry(p.state.board).center.patternSupport,'reference-supported');assert.equal(P.ordinaryCenterEligible(s,p),false);
});
test('center eligibility leaves non-Center and canonical scoring work outside this narrow gate',()=>{
 const s=F.get('direct-double').observation,ps=R.placements(s).placements;
 const t=ps.find(p=>p.event.spin==='full'&&p.event.lines===2),left=ps.find(p=>p.event.cells.every(([x])=>x<4));assert.ok(t);assert.ok(left);
 assert.equal(P.ordinaryCenterEligible(s,t),true);assert.equal(P.ordinaryCenterEligible(s,left),true);
});
