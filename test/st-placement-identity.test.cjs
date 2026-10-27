'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),F=require('../st-fixtures');
const identity=p=>JSON.stringify([p.event,p.state.active,p.state.hold,p.state.queue,p.state.streamCursor]);
// Independently enumerate each legal HOLD root without HOLD, then merge the
// complete semantic outcomes. This checks compact identity without reusing it.
function reference(start){
 const result=new Map();let state=start;
 for(let holds=0;holds<=2;holds++){
  if(holds){const next=R.move(state,'HOLD');if(next===state||next.topOut)break;state=next;}
  const scan=R.placements(state,{allowHold:false,maxNodes:16000,now:()=>0});assert.equal(scan.complete,true);
  for(const p of scan.placements){const key=identity(p),length=holds+p.witness.length;result.set(key,Math.min(result.get(key)??Infinity,length));}
 }return result;
}
test('placement identities preserve exact outcomes and shortest witnesses across HOLD roots',()=>{
 const states=F.list.map(f=>R.migrateState(f.observation));
 states.push(R.createState({active:'T',hold:null,queue:['T','T','I']}),R.createState({active:'O',hold:'O',queue:[]}),R.move(R.createState({active:'L',hold:'I',queue:['S','T']}),'L'));
 for(const s of states){
  const input=JSON.stringify(s),expected=reference(s),actual=R.placements(s,{maxNodes:16000,now:()=>0});assert.equal(actual.complete,true);
  assert.equal(actual.placements.length,expected.size);assert.equal(new Set(actual.placements.map(identity)).size,actual.placements.length);
  for(const p of actual.placements){assert.equal(p.witness.length,expected.get(identity(p)));const replay=R.replay(s,p.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,p.state);}
  assert.equal(JSON.stringify(s),input);
 }
});
test('placement identities retain spin distinctions and empty-HOLD supply at an identical target',()=>{
 const spin=R.migrateState(F.get('actual-pose-double').observation),placements=R.placements(spin,{maxNodes:16000,now:()=>0}).placements;
 assert.ok(placements.some(p=>p.event.spin==='full'&&p.event.lines===2));
 const s=R.createState({active:'O',queue:['O','T','I']}),out=R.placements(s,{now:()=>0}).placements;
 const same=out.filter(p=>JSON.stringify(p.target)===JSON.stringify(out[0].target));
 assert.ok(same.some(p=>p.state.hold===null));assert.ok(same.some(p=>p.state.hold==='O'));
 assert.ok(new Set(same.map(p=>p.state.streamCursor)).size>1);
 for(const p of same)assert.deepEqual(R.replay(s,p.witness).state,p.state);
});

test('placement identities preserve negative origins, edge columns and low landings',()=>{
 const cases=[['I',-2,0,1],['I',8,0,3],['I',3,-1,0],['T',3,-2,2],['O',3,-1,0],['I',3,38,0],['T',3,37,0]];
 for(const [type,x,y,rotation]of cases){
  const s=R.createState({active:{type,x,y,rotation,lastRotation:null},hold:'T',queue:['O','I','S']});assert.deepEqual(R.validate(s),[]);
  const expected=reference(s),actual=R.placements(s,{maxNodes:16000,now:()=>0});assert.equal(actual.complete,true);assert.equal(actual.placements.length,expected.size);
  for(const p of actual.placements){assert.equal(p.witness.length,expected.get(identity(p)));assert.deepEqual(R.replay(s,p.witness).state,p.state);}
 }
});
