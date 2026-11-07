'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const U=require('../st-obligation-inverse'),C=require('../st-obligation-context'),R=require('../st-rules');
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const frozen=x=>freeze(copy(x));
const piece=(id=1,type='I',bag=0)=>({id,type,bag,observedOrder:id-1});
const target=(id,rootId,y=30)=>({id,rootId,family:'OJ',alternatives:[{piece:'J',cells:[[4,y],[4,y+1],[5,y+1],[6,y+1]]}]});
const simple=n=>frozen({state:{count:n},inventory:{active:piece(n+1)},boundary:{firstBagLocks:n}});
const record=(session,before,after,p=piece(),extra={})=>U.record(session,{before,after,piece:p,...extra});
const undo=(session,current,receipt,p=receipt.piece,extra={})=>U.undo(session,current,{piece:p,receipt,requestEpoch:U.status(session).requestEpoch+1,...extra});

test('inverse: changed before-images restore exact targets, sticky accounts, safety and compacted S/L',()=>{
 const paid=target('paid',11),translated=target('translated',12,25),created=target('created',15,33);
 const before=frozen({
  state:{center:{pending:[paid,translated],debt:[{...paid,divertedPieceId:14}]},
   account:{remaining:0,baselineBlocked:false,invalidity:{profile:false,overspent:false},reset:{status:'active',remaining:1,firstTId:13}},
   safety:{notches:{status:'established',anchorRow:25,blockedRows:[]},coveredCells:[[1,37]]},
   sl:{residuals:[{bag:0,S:{id:5,unclassified:true},L:null},{bag:1,S:null,L:{id:10,owed:true}}],uncertain:{S:2,L:0}}},
  unchanged:{large:'untouched-live-duty-sentinel',exact:[[2,3],[5,6]]}
 });
 const next=copy(before);next.state.center={pending:[target('translated',12,27),created],debt:[]};
 next.state.account.remaining=1;next.state.account.baselineBlocked=true;next.state.account.invalidity.profile=true;next.state.account.reset={status:'inactive'};
 next.state.safety.notches={status:'broken',anchorRow:27,blockedRows:[26]};next.state.safety.coveredCells.push([3,38]);
 next.state.sl.residuals.shift();next.state.sl.uncertain.S=3;
 const after=freeze(next),session=U.start(before),receipt=record(session,before,after,piece(14,'T',1)).receipt;
 const serialized=JSON.stringify(receipt);assert.equal(serialized.includes('untouched-live-duty-sentinel'),false);
 assert.equal(serialized.includes('unchanged'),false);assert.equal('state'in receipt,false);assert.equal('context'in receipt,false);
 assert.equal(receipt.inverse.some(e=>e.path.join('.')==='state.account.remaining'&&e.value===0),true);
 assert.ok(Object.isFrozen(receipt)&&Object.isFrozen(receipt.inverse)&&Object.isFrozen(receipt.piece));
 assert.deepEqual(undo(session,after,receipt).state,before);assert.equal(after.state.center.pending[1].id,'created');
});

test('inverse: arrays use bounded changed segments and recursively retain only altered fields',()=>{
 const fixed={id:'unchanged-entry',cells:[[1,2],[3,4]]};
 const before=frozen({rows:[0,1,2,3],objects:[{id:'changed',flag:false,stable:'do-not-copy'},fixed],cells:[[4,30],[5,30]],removed:{leaf:7}});
 const after=frozen({rows:[0,8,9,1,2,3],objects:[{id:'changed',flag:true,stable:'do-not-copy'},fixed],cells:[[4,31]],added:{leaf:99}});
 const session=U.start(before),{receipt}=record(session,before,after);
 assert.ok(receipt.inverse.some(e=>e.kind==='splice'&&e.path.join('.')==='rows'&&e.index===1&&e.deleteCount===2&&e.values.length===0));
 assert.ok(receipt.inverse.some(e=>e.kind==='set'&&e.path.join('.')==='objects.0.flag'&&e.value===false));
 assert.equal(JSON.stringify(receipt).includes('do-not-copy'),false);assert.equal(JSON.stringify(receipt).includes('unchanged-entry'),false);
 assert.deepEqual(undo(session,after,receipt).state,before);
});

test('inverse: nested arrays and empty/object/scalar type replacements reverse without aliasing',()=>{
 const examples=[
  [{a:[]},{a:[1,2,3]}],
  [{a:[1,2,3]},{a:[]}],
  [{a:[{cells:[[1,2],[3,4]]},[8,9],10]},{a:[{cells:[[1,7]]},[8,10,11]]}],
  [{a:[1,2,3,4]},{a:[4,1]}],
  [{a:null,b:{old:1},c:3},{a:{new:1},b:false,c:[4]}],
  [{a:{x:{removed:true},y:[]}},{}]
 ];
 for(const [a,b]of examples){const before=frozen(a),after=frozen(b),session=U.start(before),{receipt}=record(session,before,after),restored=undo(session,after,receipt).state;
  assert.deepEqual(restored,before);assert.notEqual(restored,before);assert.deepEqual(after,b);assert.ok(Object.isFrozen(restored));}
});

test('inverse: repeated Undo restores predecessor semantic token while request epochs increase',()=>{
 const a=simple(0),b=simple(1),c=simple(2),session=U.start(a,{requestEpoch:10});
 const first=record(session,a,b,piece(1),{requestEpoch:11}),second=record(session,b,c,piece(2,'J'),{requestEpoch:12});
 assert.notEqual(first.semanticToken,second.semanticToken);
 const one=undo(session,c,second.receipt,undefined,{requestEpoch:13});assert.equal(one.semanticToken,first.semanticToken);assert.equal(one.cursor,first.cursor);assert.deepEqual(one.state,b);
 const two=undo(session,one.state,first.receipt,undefined,{requestEpoch:14});assert.equal(two.semanticToken,0);assert.equal(two.cursor,0);assert.equal(two.requestEpoch,14);assert.deepEqual(two.state,a);
 assert.throws(()=>undo(session,two.state,first.receipt),/already used/);
 assert.throws(()=>undo(session,two.state,second.receipt),/already used/);
});

test('inverse: new branches reject discarded suffixes and old workers but keep reachable predecessors',()=>{
 const a=simple(0),b=simple(1),c=simple(2),d=simple(8),session=U.start(a);
 const first=record(session,a,b,piece(1),{requestEpoch:1}),oldBranch=record(session,b,c,piece(2,'J'),{requestEpoch:2});
 const reverted=undo(session,c,oldBranch.receipt,undefined,{requestEpoch:3});
 assert.throws(()=>record(session,reverted.state,c,piece(2,'J'),{requestEpoch:2,expectedToken:first.semanticToken}),/stale request epoch/);
 const newBranch=record(session,reverted.state,d,piece(2,'J'),{requestEpoch:4,expectedToken:first.semanticToken});
 assert.notEqual(newBranch.semanticToken,oldBranch.semanticToken);assert.notEqual(newBranch.cursor,oldBranch.cursor);
 assert.throws(()=>undo(session,d,oldBranch.receipt),/already used/);
 assert.throws(()=>undo(session,d,first.receipt),/stack cursor/);
 const back=undo(session,d,newBranch.receipt);assert.deepEqual(back.state,b);
 assert.deepEqual(undo(session,back.state,first.receipt).state,a);
});

test('inverse: duplicate, copied, wrong-session, wrong-piece and stale requests fail atomically',()=>{
 const a=simple(0),b=simple(1),session=U.start(a),p=piece(1),{receipt}=record(session,a,b,p,{requestEpoch:7}),saved=U.status(session);
 const attempts=[
  ()=>undo(session,b,copy(receipt),p),
  ()=>undo(U.start(b),b,receipt,p),
  ()=>undo(session,frozen(b),receipt,p),
  ()=>undo(session,b,receipt,{...p,id:9}),
  ()=>undo(session,b,receipt,{...p,type:'Z'}),
  ()=>undo(session,b,receipt,{...p,bag:1}),
  ()=>undo(session,b,receipt,{...p,observedOrder:99}),
  ()=>undo(session,b,receipt,null),
  ()=>U.undo(session,b,{receipt,requestEpoch:8}),
  ()=>undo(session,b,receipt,p,{requestEpoch:7}),
  ()=>undo(session,b,receipt,p,{expectedToken:0}),
  ()=>undo(session,b,receipt,p,{expectedCursor:0})
 ];
 for(const attempt of attempts){assert.throws(attempt,/Invalid obligation inverse/);assert.deepEqual(U.status(session),saved);assert.deepEqual(b,simple(1));}
 assert.deepEqual(undo(session,b,receipt,p).state,a);
});

test('inverse: no-op changes keep semantic token while exact cursor orders no-op checkpoints',()=>{
 const a=frozen({state:{flag:false}}),equivalent=frozen({state:{flag:false}}),session=U.start(a);
 const first=record(session,a,equivalent,null),second=record(session,equivalent,equivalent,null);
 assert.equal(first.changed,false);assert.equal(second.semanticToken,0);assert.deepEqual(first.receipt.inverse,[]);assert.deepEqual(second.receipt.inverse,[]);
 assert.notEqual(first.cursor,second.cursor);assert.throws(()=>undo(session,equivalent,first.receipt,null),/stack cursor/);
 const one=undo(session,equivalent,second.receipt,null),two=undo(session,one.state,first.receipt,null);
 assert.equal(two.semanticToken,0);assert.equal(two.cursor,0);assert.equal(two.requestEpoch,2);assert.deepEqual(two.state,a);
});

test('inverse: composition keeps original checkpoint and removes transient/canceled before-images',()=>{
 const a=frozen({state:{flag:false,count:0},inventory:{hold:null}}),b=frozen({state:{flag:true,count:0},inventory:{hold:piece(1)}}),c=frozen({state:{flag:false,count:1},inventory:{hold:piece(1)}});
 const session=U.start(a),partial=record(session,a,b,null),locked=record(session,b,c,piece(2,'J'),{compose:partial.receipt});
 assert.equal(locked.receipt.beforeToken,0);assert.equal(locked.receipt.beforeCursor,0);assert.equal(locked.receipt.piece.id,2);
 assert.equal(JSON.stringify(locked.receipt.inverse).includes('flag'),false);
 assert.throws(()=>undo(session,c,partial.receipt,null),/superseded/);
 assert.deepEqual(undo(session,c,locked.receipt,piece(2,'J')).state,a);
});

test('inverse: actual empty and repeated HOLD bind the HD subject, not initial active',()=>{
 for(const actions of [['HOLD','L','HD'],['HOLD','HOLD','R','HD']]){
  let position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),context=C.start(position,{fresh:true});
  const origin=context,checkpoint=copy(position),session=U.start(context);let receipt,locked;
  for(const action of actions){const before=context,next=R.move(position,action),result=C.applyActual(context,{before:position,action,after:next});
   context=result.context;position=next;locked=result.receipt.locked||locked;
   receipt=U.record(session,{before,after:context,...(action==='HD'?{piece:locked}:{}),compose:receipt}).receipt;
  }
  assert.equal(receipt.piece.id,actions.length===3?2:1);assert.equal(context.boundary.firstBagLocks,1);
  const restored=undo(session,context,receipt,locked,{restore:raw=>C.importState(raw,{position:checkpoint})});
  assert.deepEqual(C.exportState(restored.state),C.exportState(origin));assert.equal(C.resolve(restored.state,{position:checkpoint}).availability,'known');
 }
});

test('inverse: marker and reveal changes compose but cannot silently replace a sealed lock',()=>{
 const a=simple(0),b=simple(1),next=copy(b);next.state.handoff=true;next.state.reset={remaining:2};next.inventory.revealed=piece(9,'S',1);
 const c=freeze(next),session=U.start(a),locked=record(session,a,b,piece(1));
 assert.throws(()=>record(session,b,c,piece(2,'J'),{compose:locked.receipt}),/sealed locked piece/);
 assert.throws(()=>record(session,b,c,null,{compose:locked.receipt}),/sealed locked piece/);
 const marker=U.record(session,{before:b,after:c,compose:locked.receipt});assert.deepEqual(marker.receipt.piece,piece(1));
 assert.deepEqual(undo(session,c,marker.receipt).state,a);
});

test('inverse: partial next turn reverses before completed lock and respects earlier marker baseline',()=>{
 const root=simple(0),baseline=frozen({...copy(root),marker:'accepted-before-first-input'}),locked=simple(1),partial=simple(2),session=U.start(root);
 record(session,root,baseline,null);
 const turn=record(session,baseline,locked,piece(1)),tail=record(session,locked,partial,null);
 assert.throws(()=>undo(session,partial,turn.receipt),/stack cursor/);
 const atLock=undo(session,partial,tail.receipt,null),restored=undo(session,atLock.state,turn.receipt);
 assert.deepEqual(restored.state,baseline);assert.equal(restored.state.marker,'accepted-before-first-input');
});

test('inverse: join atomically coalesces unbound next-turn changes and rejects other lock boundaries',()=>{
 const a=simple(0),b=simple(1),c=simple(2),d=simple(3),session=U.start(a);
 const earlier=record(session,a,b,piece(1)),turn=record(session,b,c,piece(2,'J')),tail=record(session,c,d,null);
 assert.throws(()=>U.join(session,{receipt:earlier.receipt,tail:tail.receipt}),/nonadjacent/);
 const combined=U.join(session,{receipt:turn.receipt,tail:tail.receipt});assert.equal(combined.changed,false);assert.equal(combined.semanticToken,tail.semanticToken);
 assert.deepEqual(combined.receipt.piece,piece(2,'J'));
 assert.throws(()=>undo(session,d,tail.receipt,null),/superseded/);assert.throws(()=>undo(session,d,turn.receipt),/superseded/);
 const back=undo(session,d,combined.receipt);assert.deepEqual(back.state,b);assert.deepEqual(undo(session,back.state,earlier.receipt).state,a);
 const x=U.start(a),one=record(x,a,b,piece(1)),two=record(x,b,c,piece(2,'J'));
 assert.throws(()=>U.join(x,{receipt:one.receipt,tail:two.receipt}),/unbound provisional/);
});

test('inverse: atomic tail Undo validates before consuming either boundary or advancing epoch',()=>{
 const a=simple(0),b=simple(1),c=simple(2),d=simple(3),session=U.start(a);
 const earlier=record(session,a,b,piece(1)),turn=record(session,b,c,piece(2,'J')),tail=record(session,c,d,null),saved=U.status(session);
 for(const restore of [()=>{throw Error('domain import rejected');},raw=>frozen({...raw,changed:true})]){
  assert.throws(()=>undo(session,d,turn.receipt,undefined,{tail:tail.receipt,restore}));assert.deepEqual(U.status(session),saved);
 }
 const restored=undo(session,d,turn.receipt,undefined,{tail:tail.receipt,restore:raw=>frozen(raw)});
 assert.deepEqual(restored.state,b);assert.equal(restored.semanticToken,earlier.semanticToken);assert.equal(restored.cursor,earlier.cursor);assert.equal(restored.requestEpoch,saved.requestEpoch+1);
 assert.throws(()=>undo(session,restored.state,tail.receipt,null),/already used/);assert.throws(()=>undo(session,restored.state,turn.receipt),/already used/);
 assert.deepEqual(undo(session,restored.state,earlier.receipt).state,a);
});

test('inverse: failed atomic tail Undo still permits forward play from the original partial-turn checkpoint',()=>{
 const a=simple(0),b=simple(1),c=simple(2),d=simple(3),session=U.start(a);
 const first=record(session,a,b,piece(1)),partial=record(session,b,c,null),saved=U.status(session);
 assert.throws(()=>undo(session,c,first.receipt,undefined,{tail:partial.receipt,restore:()=>{throw Error('rejected');}}),/rejected/);
 assert.deepEqual(U.status(session),saved);
 const second=record(session,c,d,piece(2,'J'),{compose:partial.receipt});
 assert.equal(second.receipt.beforeToken,first.semanticToken);assert.equal(second.receipt.beforeCursor,first.cursor);
 const one=undo(session,d,second.receipt);assert.deepEqual(one.state,b,'Second turn still starts before its partial input');
 assert.deepEqual(undo(session,one.state,first.receipt).state,a);
});

test('inverse: atomic tail Undo rejects copied, sealed, nonadjacent and wrong-session tails',()=>{
 const a=simple(0),b=simple(1),c=simple(2),d=simple(3),session=U.start(a);
 const first=record(session,a,b,piece(1)),second=record(session,b,c,piece(2,'J')),tail=record(session,c,d,null),saved=U.status(session);
 const other=U.start(c),foreign=record(other,c,d,null);
 for(const [receipt,extra]of [[first.receipt,{tail:tail.receipt}],[second.receipt,{tail:copy(tail.receipt)}],[second.receipt,{tail:foreign.receipt}],[tail.receipt,{tail:tail.receipt}],[second.receipt,{tail:tail.receipt,piece:piece(9,'Z')}]]){
  assert.throws(()=>undo(session,d,receipt,extra.piece??receipt.piece,extra));assert.deepEqual(U.status(session),saved);
 }
 const restored=undo(session,d,second.receipt,undefined,{tail:tail.receipt});assert.deepEqual(restored.state,b);
 const sealed=record(session,restored.state,c,piece(3,'L'));
 assert.throws(()=>undo(session,c,first.receipt,undefined,{tail:sealed.receipt}),/unbound provisional/);
});

test('inverse: rejected restore validation, semantic rewriting and reentrancy leave receipt usable',()=>{
 const a=simple(0),b=simple(1),session=U.start(a),{receipt}=record(session,a,b),saved=U.status(session);
 const restores=[
  ()=>{throw Error('domain import rejected');},
  raw=>{const changed=copy(raw);changed.state.count=100;return freeze(changed);},
  raw=>copy(raw),
  raw=>{raw.state.count=100;return raw;},
  ()=>{record(session,b,simple(2));return a;},
  ()=>{undo(session,b,receipt);return a;}
 ];
 for(const restore of restores){assert.throws(()=>undo(session,b,receipt,undefined,{restore}));assert.deepEqual(U.status(session),saved);}
 assert.deepEqual(undo(session,b,receipt,undefined,{restore:raw=>frozen(raw)}).state,a);
});

test('inverse: structural imports are trusted independently while old session receipts cannot follow them',()=>{
 const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),origin=C.start(position,{fresh:true}),raw=C.exportState(origin);
 raw.state.dPending=true;raw.inventory.nextId=200;raw.state.center.pending=[target('trusted-current-only',101)];
 const imported=C.importState(raw,{position}),session=U.start(imported),afterRaw=C.exportState(imported);afterRaw.state.dPending=false;
 const after=C.importState(afterRaw,{position}),{receipt}=record(session,imported,after),newImport=C.importState(C.exportState(after),{position}),newSession=U.start(newImport);
 assert.throws(()=>undo(newSession,newImport,receipt),/this session/);
 const restored=undo(session,after,receipt,undefined,{restore:value=>C.importState(value,{position})}).state;
 assert.deepEqual(C.exportState(restored),raw);assert.equal(C.resolve(restored,{position}).center.pending[0].id,'trusted-current-only');
});

test('inverse: caller receipt pruning never caps or erases live obligations',()=>{
 let current=frozen({state:{center:{pending:[]}}}),last;
 const session=U.start(current);for(let n=1;n<=150;n++){
  const next=frozen({state:{center:{pending:[...current.state.center.pending,target('live-'+n,n)]}}});
  last=record(session,current,next,piece(n,'O',Math.floor((n-1)/7))).receipt;current=next;
 }
 assert.equal(current.state.center.pending.length,150);assert.equal(last.inverse.length,1);assert.equal(last.inverse[0].values.length,0);
 const restored=undo(session,current,last).state;assert.equal(restored.state.center.pending.length,149);assert.equal(restored.state.center.pending[0].id,'live-1');
});

test('inverse: reject mutable, cyclic, non-JSON and accessor payloads without invoking getters',()=>{
 assert.throws(()=>U.start({a:1}),/immutable/);assert.throws(()=>U.start(Object.freeze({a:{b:1}})),/immutable/);
 const cyclic={};cyclic.self=cyclic;Object.freeze(cyclic);assert.throws(()=>U.start(cyclic),/acyclic/);
 for(const value of [undefined,NaN,Infinity,1n,()=>1])assert.throws(()=>U.start(Object.freeze({value})),/JSON/);
 const sparse=Object.freeze({value:Object.freeze(Array(1))});assert.throws(()=>U.start(sparse),/dense/);
 let called=0;const getter=Object.freeze(Object.defineProperty({},'value',{get(){called++;return 1;},enumerable:true}));assert.throws(()=>U.start(getter),/accessors/);assert.equal(called,0);
 const before=freeze(JSON.parse('{"__proto__":{"data":1},"constructor":1}')),after=freeze(JSON.parse('{"__proto__":{"data":2},"constructor":2}')),session=U.start(before),{receipt}=record(session,before,after);
 const restored=undo(session,after,receipt).state;assert.equal(Object.getPrototypeOf(restored),Object.prototype);assert.deepEqual(restored,before);assert.equal({}.data,undefined);
});

test('inverse: classic-script export uses the same isolated local session contract',()=>{
 const realm=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../st-obligation-inverse'),'utf8'),realm);
 const api=realm.STObligationInverse,a=frozen({flag:false}),b=frozen({flag:true}),session=api.start(a),receipt=api.record(session,{before:a,after:b,piece:piece()}).receipt;
 assert.deepEqual(copy(api.undo(session,b,{piece:piece(),receipt,requestEpoch:1}).state),a);
 assert.throws(()=>U.status(session),/local session/);
});
