'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../st-rules'),S=require('../st-structure'),P=require('../st-planner'),F=require('../st-fixtures');
const source=fs.readFileSync(require.resolve('../st-planner.js'),'utf8');
// Expose private seams only in this test realm, as in st-maintenance-usage.
// The assessment, reader and node bodies themselves are production code.
function load({rules=R,onReader=null}={}){const module={exports:{}};let text=source.replace('return Object.freeze({observe,assess,','return Object.freeze({createAssessmentReader,nodeFor,observe,assess,');
 if(onReader)text=text.replace('function createAssessmentReader(read=assess){const cache=new Map();','function createAssessmentReader(read=assess){const cache=new Map();onReader(cache);');
 vm.runInNewContext(text,{module,require:id=>id==='./st-rules.js'?rules:require(id.replace('./','../')),Date,performance,onReader});return module.exports;
}
// Normalize realm prototypes without changing primitive values such as -0.
const plain=value=>Array.isArray(value)?Array.from(value,plain):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,plain(child)])):value;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const boards=()=>[R.emptyBoard(),...F.list.map(f=>f.observation.board)];

test('st-assessment-cache/exact full facts preserve scalar identity, ordering and frozen input',()=>{
 const api=load(),read=api.createAssessmentReader();
 for(const board of boards()){freeze(board);const before=board.join(''),expected=P.assess(board);assert.deepEqual(plain(read(board)),expected);assert.deepEqual(plain(read(board.slice())),expected);assert.equal(board.join(''),before);}
 const scalar=api.createAssessmentReader(()=>({estimate:-0}));
 assert.equal(Object.is(scalar(R.emptyBoard()).estimate,-0),true,'do not normalize -0 with JSON cloning');
 assert.equal(Object.is(scalar(R.emptyBoard()).estimate,-0),true,'cached hit retains -0 too');
});

test('st-assessment-cache/candidates own nested facts and cannot annotate pristine cached bases',()=>{
 const api=load(),board=F.get('direct-double').observation.board;let calls=0;
 const read=api.createAssessmentReader(b=>{calls++;return P.assess(b);}),a=read(board),b=read(board.slice()),expected=P.assess(board);
 assert.equal(calls,1);assert.notEqual(a,b);assert.notEqual(a.heights,b.heights);assert.notEqual(a.right,b.right);assert.notEqual(a.obligations,b.obligations);
 a.heights[0]=99;a.channel.height=99;a.center.profile[0]=99;a.sealedCells.push([99,99]);a.assumptions.push('changed');a.structure={unrelated:true};
 assert.ok(a.right.slots.length);a.right.slots[0].x=99;a.obligations[0].demands.push('BAD');a.obligations[0].at[0]=99;
 assert.deepEqual(plain(b),expected);assert.deepEqual(plain(read(board)),expected);assert.equal(calls,1);
 const colored=board.map(row=>row.replace(/[^.]/g,'I'));read(colored);assert.equal(calls,2,'raw board key does not conflate different imported contents');
});

test('st-assessment-cache/bounded LRU and nested readers have independent lifetimes',()=>{
 const api=load(),boardFor=n=>{const b=R.emptyBoard();b[39]=n.toString(2).padStart(10,'0').replaceAll('0','.').replaceAll('1','X');return b;};let calls=0;
 const read=api.createAssessmentReader(board=>({raw:board.join(''),value:-0,ordinal:++calls}));
 for(let i=0;i<256;i++)read(boardFor(i));assert.equal(calls,256);
 read(boardFor(0));read(boardFor(256));assert.equal(calls,257);
 read(boardFor(0));assert.equal(calls,257,'recently used entry survives');read(boardFor(1));assert.equal(calls,258,'least recently used entry is evicted');
 let outerCalls=0,innerCalls=0;const inner=api.createAssessmentReader(board=>{innerCalls++;return P.assess(board);});
 const outer=api.createAssessmentReader(board=>{outerCalls++;inner(board);return P.assess(board);});
 const board=R.emptyBoard();outer(board);outer(board);inner(board);assert.equal(outerCalls,1);assert.equal(innerCalls,1);
 const next=api.createAssessmentReader(board=>{outerCalls++;return P.assess(board);});next(board);assert.equal(outerCalls,2,'next decision does not inherit a prior reader');
});

test('st-assessment-cache/same-board candidates retain independent phase and supply annotations',()=>{
 const api=load(),state=P.observe(require('./support/st-user-o-partner-phase.json')),next=R.move(state,'HD');
 const placement=()=>({state:R.createState(next),event:plain(next.lastEvent),target:plain(next.lastEvent.target),witness:['HD'],hold:false,holdCount:0});
 // createState intentionally clears lastEvent; nodeFor uses the supplied event.
 const normal=S.notchPattern(state.board),alternate={status:'established',anchorRow:27,protectedRows:[27,24,21,18,15,12,9,6,3,0],blockedRows:[]};
 const read=api.createAssessmentReader(),results=[];
 for(const notches of [normal,alternate])for(const emptySupply of [false,true]){
  const initial={...P.assess(state.board),state,notches},a=placement(),b=placement();
  if(emptySupply){a.state={...a.state,active:null,hold:null,queue:[],bag:null};b.state={...b.state,active:null,hold:null,queue:[],bag:null};}
  const expected=api.nodeFor(a,null,initial,0),actual=api.nodeFor(b,null,initial,0,read);assert.deepEqual(plain(actual),plain(expected));results.push(actual);
 }
 const snapshots=results.map(plain);results[0].assessment.structure.center.profile[0]=99;results[0].assessment.obligations.push({kind:'mutated'});
 for(let i=1;i<results.length;i++)assert.deepEqual(plain(results[i]),snapshots[i]);
 assert.notDeepEqual(snapshots[0].assessment.structure.supply,snapshots[1].assessment.structure.supply);
 assert.notDeepEqual(snapshots[0].notches,snapshots[2].notches);
});

test('st-assessment-cache/actual nested and later plans construct separate private readers',()=>{
 const readers=[];let api,nested=false;
 const options={depth:3,width:8,maxNodes:45000,timeMs:1500};
 const rules={...R,placements:(state,settings)=>{if(!nested){nested=true;api.plan(F.get('direct-double').observation,options);}return R.placements(state,settings);}};
 api=load({rules,onReader:reader=>readers.push(reader)});
 api.plan(F.get('center-j').observation,options);const firstCount=readers.length;
 assert.ok(firstCount>=2,'outer and nested plan each construct a reader');assert.equal(new Set(readers).size,readers.length);
 api.plan(F.get('center-j').observation,options);assert.ok(readers.length>firstCount);assert.equal(new Set(readers).size,readers.length);
});
