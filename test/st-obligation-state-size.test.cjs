'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../st-rules'),C=require('../st-obligation-context');
test('current core / long movement history does not enlarge an unchanged simple state',()=>{
 let s=R.createState({active:'O',queue:Array(6).fill('O')}),c=C.start(s);const initial=JSON.stringify(c.state);let short;
 for(let i=0;i<5000;i++){const before=s;s=R.move(s,i%2?'R':'L');const out=C.applyActual(c,{before,action:i%2?'R':'L',after:s});assert.equal(out.context.status,'available',out.context.reason);c=out.context;if(i===49)short=JSON.stringify(c.state);}
 assert.equal(short,initial);assert.equal(JSON.stringify(c.state),short);assert.equal('steps' in c,false);assert.equal('history' in c.state,false);
});
test('current core / repeated clear cycles retire work without accumulating prior locks or empty jobs',()=>{
 let s=R.createState({active:'O',queue:Array(6).fill('O')}),c=C.start(s),short;
 function action(a){const before=s;let next=R.move(s,a);if(next===s)return;if(a==='HD')next={...next,queue:[...next.queue,'O']};s=next;const out=C.applyActual(c,{before,action:a,after:s});assert.equal(out.context.status,'available',out.context.reason);c=out.context;}
 // Two cycles settle the finite sticky notch state; later equal duties must not retain past cycles.
 for(let lock=0;lock<500;lock++){const x=(lock%5)*2-4;for(let n=0;n<Math.abs(x);n++)action(x<0?'L':'R');action('HD');if(lock===9)short=JSON.stringify(c.state);if(lock>=9&&lock%5===4){assert(s.board.every(r=>r==='..........'));assert.equal(JSON.stringify(c.state),short);}}
 assert.deepEqual(c.state.leftGoals,[]);assert.deepEqual(c.state.center,{pending:[],debt:[]});assert.equal(c.inventory.nextId,508,'controller owns current supply allocator, not core piece history');
});
