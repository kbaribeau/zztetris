'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../st-rules'),F=require('../st-fixtures');
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};

// Deliberately eager reference: use only public moves, complete action arrays,
// and textual identities. It retains the established interleaved BFS ordering,
// but does not use the production landing/locking split or numeric identities.
const pose=a=>JSON.stringify([a.type,a.x,a.y,a.rotation,a.type==='T'&&a.lastRotation?((a.lastRotation.to-a.lastRotation.from+4)%4!==2&&a.lastRotation.kickIndex===4?'fifth':'rotation'):'none']);
function eagerPlacements(s,options={},stats={}){
 const out=[],outcomes=new Map();let visited=0,complete=true;
 const maxNodes=options.maxNodes??16000,deadline=options.deadline??Infinity,now=options.now??(()=>0),stopWhen=typeof options.stopWhen==='function'?options.stopWhen:null;
 if(R.validate(s).length||!s.active||s.topOut)return{placements:out,visited,complete:true};
 const unlimited=s.rules===R.PROFILE.id,rootKey=s=>JSON.stringify([pose(s.active),s.hold,s.queue,s.canHold,s.streamCursor]);
 const roots=[{state:s,actions:[],hold:false,holdCount:0}],rootSeen=new Set([rootKey(s)]);
 if(options.allowHold!==false){let state=s;
  for(let count=1;count<=(unlimited?2:1);count++){
   const next=R.move(state,'HOLD');if(next===state||next.topOut)break;state=next;
   const key=rootKey(state);if(rootSeen.has(key))continue;rootSeen.add(key);
   roots.push({state,actions:Array(count).fill('HOLD'),hold:true,holdCount:count});
  }
 }
 const queues=roots.map(r=>[{state:r.state,actions:r.actions}]),seen=roots.map(r=>new Set([pose(r.state.active)])),heads=roots.map(()=>0);
 outer:while(queues.some((q,i)=>heads[i]<q.length))for(let k=0;k<queues.length;k++){
  if(heads[k]>=queues[k].length)continue;
  if(visited>=maxNodes||now()>=deadline){complete=false;break outer;}
  const n=queues[k][heads[k]++];visited++;
  const locked=R.move(n.state,'HD'),event=locked.lastEvent;
  if(event&&!event.topOut){
   const id=JSON.stringify(unlimited?[event.target,event.spin,n.state.hold,n.state.queue,n.state.streamCursor]:[roots[k].hold,event.target,event.spin]),index=outcomes.get(id);
   if(index===undefined||n.actions.length+1<out[index].witness.length){
    const placement={target:event.target,hold:roots[k].hold,holdCount:roots[k].holdCount,witness:n.actions.concat('HD'),state:locked,event};
    if(index===undefined){outcomes.set(id,out.length);out.push(placement);if(stopWhen?.(placement)===true)return{placements:out,complete:false,visited,stopReason:'placement-predicate'};}
    else {stats.replacements=(stats.replacements??0)+1;out[index]=placement;}
   }
  }
  for(const action of ['L','R','CW','CCW','R180','SD']){
   const next=R.move(n.state,action);if(next===n.state)continue;const key=pose(next.active);if(seen[k].has(key))continue;seen[k].add(key);
   queues[k].push({state:next,actions:n.actions.concat(action)});
  }
 }
 return{placements:out,complete,visited};
}
function compare(s,options={}){
 const snapshot=JSON.stringify(s),expected=eagerPlacements(s,options),actual=R.placements(s,{now:()=>0,...options});
 assert.deepEqual(actual,expected);assert.equal(JSON.stringify(s),snapshot);
 for(const p of actual.placements){const replay=R.replay(s,p.witness);assert.equal(replay.valid,true);assert.deepEqual(replay.state,p.state);}
 return actual;
}

test('st-hard-drop/dedup: exact eager enumeration parity across every curated board and both rules profiles',()=>{
 for(const fixture of F.list)for(const s of [R.createState(fixture.observation),R.migrateState(fixture.observation)])compare(freeze(s));
});

test('st-hard-drop/dedup: identical partial ordering, node limits, deadline calls and stop predicates',()=>{
 const states=[R.createState({active:'O',queue:['O','T','I']}),R.migrateState(F.get('actual-pose-double').observation)];
 for(const s of states)for(const allowHold of [false,true]){
  for(const maxNodes of [0,1,2,3,11,70,16000])compare(s,{allowHold,maxNodes});
  for(const deadline of [0,1,2,3,17,100]){
   let expectedCalls=0,actualCalls=0;
   const expected=eagerPlacements(s,{allowHold,deadline,now:()=>expectedCalls++}),actual=R.placements(s,{allowHold,deadline,now:()=>actualCalls++});
   assert.deepEqual(actual,expected);assert.equal(actualCalls,expectedCalls);
  }
  for(const predicate of [()=>true,p=>p.event.lines===2&&p.event.spin==='full',()=>false]){
   const expectedCalls=[],actualCalls=[];
   const expected=eagerPlacements(s,{allowHold,stopWhen:p=>{expectedCalls.push(structuredClone(p));return predicate(p);}});
   const actual=R.placements(s,{allowHold,now:()=>0,stopWhen:p=>{actualCalls.push(structuredClone(p));return predicate(p);}});
   assert.deepEqual(actual,expected);assert.deepEqual(actualCalls,expectedCalls);
  }
 }
});

test('st-hard-drop/dedup: retains shorter swap-back witnesses, spin evidence and distinct post-HOLD supply',()=>{
 const states=[R.createState({active:'O',queue:['O','T','I']}),R.createState({active:{type:'L',x:0,y:30,rotation:0,lastRotation:null},hold:'I',queue:['S','T']})];
 let replacements=0;
 for(const s of states){const stats={};assert.deepEqual(R.placements(s,{now:()=>0}),eagerPlacements(s,{},stats));replacements+=stats.replacements??0;}
 assert.ok(replacements>0,'the corpus exercises replacement of an existing longer witness');
 const board=R.emptyBoard();board[36]='...#.#....';board[38]='...#......';
 for(const lastRotation of [null,{from:1,to:2,kickIndex:0},{from:1,to:2,kickIndex:4},{from:0,to:2,kickIndex:4}]){
  const s=R.createState({board,active:{type:'T',x:3,y:35,rotation:2,lastRotation},queue:['I','O']});
  const result=compare(s,{allowHold:false});assert.equal(result.placements[0].event.spin,lastRotation===null?'none':lastRotation.from===1&&lastRotation.kickIndex===4?'full':'mini');
 }
});

test('st-hard-drop/dedup: imported full rows, lock-out, blocked spawn and negative origins match eager locks',()=>{
 const imported=R.emptyBoard();imported[4]='IJLOSTZ#XX';imported[35]='##########';
 compare(R.createState({board:imported,active:{type:'O',x:0,y:25,rotation:0,lastRotation:null},hold:'T',queue:['I','O']}));
 const shelf=R.emptyBoard();shelf[20]='##########';compare(R.createState({board:shelf,active:'O',queue:['I']}));
 const blocked=R.emptyBoard();blocked[18]='....#.....';compare(R.createState({board:blocked,active:{type:'O',x:0,y:30,rotation:0,lastRotation:null},queue:['T']}));
 for(const [type,x,y,rotation]of [['I',-2,0,1],['I',8,0,3],['I',3,-1,0],['T',3,-2,2],['O',3,-1,0],['I',3,38,0]])compare(R.createState({active:{type,x,y,rotation,lastRotation:null},hold:'T',queue:['O','I','S']}));
 for(const s of [R.createState(),R.createState({active:'O',topOut:true}),{...R.createState({active:'I'}),rules:'unsupported'}])compare(s);
});

test('st-hard-drop/dedup: duplicate landings do not construct discarded boards or alias returned outcomes',()=>{
 const s=R.createState({active:'O',queue:['I','T'],revision:10,streamCursor:5}),snapshot=JSON.stringify(s);let copies=0;
 s.board=new Proxy(s.board,{get(target,key,receiver){if(key==='slice')return(...args)=>{copies++;return target.slice(...args);};return Reflect.get(target,key,receiver);}});
 const result=R.placements(s,{allowHold:false,now:()=>0});
 assert.ok(result.visited>10*result.placements.length,'the case has many duplicate landings');
 assert.equal(copies,result.placements.length,'only retained lock outcomes allocate board copies');
 assert.equal(JSON.stringify(s),snapshot);
 const first=result.placements[0],second=result.placements[1],secondSnapshot=JSON.stringify(second);
 first.state.board[39]='##########';first.event.cells[0][0]=9;
 assert.equal(JSON.stringify(second),secondSnapshot);assert.equal(JSON.stringify(s),snapshot);
});
