'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../st-rules'),I=require('../st-public-inventory'),SL=require('../st-sl-obligations'),Q=require('../st-obligation-state'),P=require('../st-obligation-projection');
const copy=x=>JSON.parse(JSON.stringify(x));
function frozen(x){if(x&&typeof x==='object'){assert.ok(Object.isFrozen(x));for(const v of Object.values(x))frozen(v);}}
function origin(){const position=R.createState({active:'I',queue:[...'JLOSTZ'],streamCursor:1}),inventory=I.start(position,{fresh:true});return P.start(Q.start(position,{inventory}),{position,inventory});}
function contexts(root,action='observe'){const before={position:root.position,inventory:root.supply};if(action==='observe')return{before,after:before,references:[]};const position=R.move(root.position,'HD'),supply={...root.supply,queue:root.supply.queue.slice(),streamCursor:position.streamCursor};supply.active=position.active?supply.queue.shift():null;return{before,after:{position,inventory:supply},references:[]};}
function spy(){const calls={imports:0},module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../st-obligation-state.js'),'utf8'),{module,require:id=>id==='./st-sl-obligations'?{...SL,importProjection:(...args)=>{calls.imports++;return SL.importProjection(...args);}}:require(path.join(__dirname,'..',id))});return{Q:module.exports,calls};}
test('owned Q: exact capability skips only initial import, retaining every final validation',()=>{
 const {Q:q,calls}=spy(),root=origin(),state=q.ownProjection(root.state),context=contexts(root);assert.equal(calls.imports,1);frozen(state);assert.equal(q.ownProjection(state),state);
 calls.imports=0;const fast=q.projectTransitionOwned(state,{kind:'observe'},context);assert.equal(calls.imports,1);frozen(fast.state);
 for(const raw of [{...state},Object.freeze({...state}),copy(state),new Proxy(state,{})]){calls.imports=0;const out=q.projectTransitionOwned(raw,{kind:'observe'},context);assert.equal(calls.imports,2);assert.equal(Object.isFrozen(out.state),false);}
 calls.imports=0;q.projectTransition(state,{kind:'observe'},context);assert.equal(calls.imports,2);
 calls.imports=0;q.resolveProjectionOwned(state,context.before);assert.equal(calls.imports,0);q.resolveProjection(state,context.before);assert.equal(calls.imports,1);
 for(const raw of [{...state},copy(state),new Proxy(state,{})]){calls.imports=0;q.resolveProjectionOwned(raw,context.before);assert.equal(calls.imports,1);}
});
test('owned Q: materialized constructor owns ordinary values and ignores caller array methods',()=>{
 const root=origin(),state=root.state;state.center.pending=[{id:'anonymous',rootId:null,family:null,alternatives:[{piece:'J',cells:[[4,36],[4,37],[4,38],[5,38]]}]}];let row=36,callbacks=0;Object.defineProperty(state.center.pending[0].alternatives[0].cells[0],'1',{enumerable:true,get:()=>row});
 const arrays=[state.center.pending,state.center.pending[0].alternatives,state.center.pending[0].alternatives[0].cells];for(const a of arrays){a.map=a.slice=a.toJSON=()=>{callbacks++;throw Error('caller method');};a[Symbol.iterator]=()=>{callbacks++;throw Error('caller iterator');};Object.defineProperty(a,'constructor',{value:{get [Symbol.species](){callbacks++;throw Error('caller species');}}});}
 const owned=Q.ownProjection(state);assert.equal(callbacks,0);frozen(owned);row=30;assert.equal(owned.center.pending[0].alternatives[0].cells[0][1],36);assert.equal(Object.getOwnPropertyDescriptor(owned.center.pending[0].alternatives[0].cells[0],'1').get,undefined);
 for(const bad of [()=>{},Symbol('bad')]){const raw=origin().state;raw.dPending=bad;assert.throws(()=>Q.ownProjection(raw),/plain projected data/);}
 const cycle=origin().state;cycle.center.pending.push(cycle);assert.throws(()=>Q.ownProjection(cycle),/cyclic projected data/);
 const invalid=origin().state;invalid.dPending='bad';assert.throws(()=>Q.ownProjection(invalid),/version\/availability\/D/);const actual=copy(origin().state);delete actual.domain;assert.throws(()=>Q.ownProjection(actual),/envelope shape/);assert.throws(()=>Q.importState(owned),/envelope shape/);
});
test('owned Q: full lock/observe outputs and mutable selectors match public operations',()=>{
 for(const root of [origin(),P.startUnknown(R.createState({active:'I',hold:'O',queue:['J','T']}))]){
  const owned=Q.ownProjection(root.state),saved=copy(owned);
  for(const kind of ['observe','lock']){const context=contexts(root,kind),operation=kind==='lock'?{kind,piece:root.supply.active,event:context.after.position.lastEvent}:{kind};const expected=Q.projectTransition(owned,operation,context),actual=Q.projectTransitionOwned(owned,operation,context);assert.deepStrictEqual(actual,expected);frozen(actual.state);assert.deepEqual(owned,saved);const view=Q.resolveProjectionOwned(actual.state,context.after);assert.deepStrictEqual(view,Q.resolveProjection(actual.state,context.after));view.center.pending.push({caller:true});view.coveredRepair.cells.push([0,0]);view.leftGoals.push({caller:true});assert.deepStrictEqual(Q.resolveProjectionOwned(actual.state,context.after),Q.resolveProjection(actual.state,context.after));actual.effects.push({caller:true});assert.deepEqual(owned,saved);}
 }
});
test('owned Q: literal signed-zero current notches survive constructor, reducer and mutable selector',()=>{
 const root=origin();root.state.safety.notches={version:2,status:'broken',anchorRow:-0,blockedRows:[-0],source:'imported-current-state'};const state=Q.ownProjection(root.state),context=contexts(root,'lock'),result=Q.projectTransitionOwned(state,{kind:'lock',piece:root.supply.active,event:context.after.position.lastEvent},context),view=Q.resolveProjectionOwned(result.state,context.after);
 assert.ok(Object.is(state.safety.notches.anchorRow,-0));assert.ok(Object.is(result.state.safety.notches.blockedRows[0],-0));assert.ok(Object.is(view.coveredRepair.notches.anchorRow,-0));assert.ok(Object.is(view.coveredRepair.notches.protectedRows[0],-0));assert.deepStrictEqual(view,Q.resolveProjection(result.state,context.after));view.coveredRepair.notches.protectedRows[0]=9;assert.ok(Object.is(result.state.safety.notches.blockedRows[0],-0));
});
test('owned Q: early Reset and Left returns preserve validation, mutation isolation and effects',()=>{
 const root=origin(),state=root.state;state.sl.foundationOpen=false;state.account.firstTsd=true;state.account.allocationVerified=true;state.account.opening=null;state.account.profile.before=null;state.account.z.remaining=1;
 const {Q:q,calls}=spy(),owned=q.ownProjection(state),saved=copy(owned),context=contexts(root);
 for(const op of [{kind:'begin-reset',candidate:true},{kind:'accept-left-repair',checked:false,repair:null}]){calls.imports=0;const actual=q.projectTransitionOwned(owned,op,context);assert.equal(calls.imports,1);const expected=q.projectTransition(owned,op,context);assert.deepStrictEqual(copy(actual),copy(expected));frozen(actual.state);assert.deepStrictEqual(copy(owned),saved);}
 for(const op of [{kind:'begin-reset',candidate:'bad'},{kind:'observe',closeFoundation:'bad'},{kind:'observe',firstBagReview:'bad'}])assert.throws(()=>q.projectTransitionOwned(owned,op,context));assert.deepStrictEqual(copy(owned),saved);
});
test('owned Q: invalid context and state failures preserve parent and sibling',()=>{
 const root=origin(),owned=Q.ownProjection(root.state),before=copy(owned),context=contexts(root),sibling=Q.projectTransitionOwned(owned,{kind:'observe'},context),saved=copy(sibling);
 for(const c of [{...context,references:[0]},{...context,after:{...context.after,position:{...root.position,board:['X.........',...root.position.board.slice(1)]}}},{...context,after:{...context.after,inventory:{...root.supply,streamCursor:99}}}])assert.throws(()=>Q.projectTransitionOwned(owned,{kind:'observe'},c));assert.deepEqual(owned,before);assert.deepEqual(sibling,saved);
 const bad=copy(owned);bad.sl.uncertainty.S=[Number.MAX_SAFE_INTEGER+1,0,0,0];assert.throws(()=>Q.projectTransitionOwned(bad,{kind:'observe'},context));assert.deepEqual(owned,before);
});
test('owned Q: P seeds only after a real HD and leaves the raw first witness on public reducers',()=>{
 const calls=[],module={exports:{}},q={...Q,projectTransition:(s,o,c)=>{calls.push('public-'+o.kind);return Q.projectTransition(s,o,c);},projectTransitionOwned:(s,o,c)=>{calls.push('owned-'+o.kind);return Q.projectTransitionOwned(s,o,c);},ownProjection:s=>{calls.push('seed');return Q.ownProjection(s);},resolveProjectionOwned:(s,c)=>{calls.push('owned-view');return Q.resolveProjectionOwned(s,c);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../st-obligation-projection.js'),'utf8'),{module,require:id=>id==='./st-obligation-state'?q:require(path.join(__dirname,'..',id))});const p=module.exports,root=origin(),first=p.projectOwned(root,{witness:['L','R','HD'],references:p.referenceSnapshot([]),resolveView:true});assert.deepEqual(calls,['public-observe','public-lock','seed','owned-view']);
 calls.length=0;p.projectOwned(first.projection,{witness:['L','R','HD'],references:p.referenceSnapshot([]),resolveView:true});assert.deepEqual(calls,['owned-observe','owned-lock','seed','owned-view']);
 calls.length=0;const witness=['HD'];witness[Symbol.iterator]=function*(){};p.projectOwned(root,{witness});assert.deepEqual(calls,[]);
 calls.length=0;p.project(first.projection,{witness:['HD'],resolveView:true});assert.deepEqual(calls,['public-lock']);
});
