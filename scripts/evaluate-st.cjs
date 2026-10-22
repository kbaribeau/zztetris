'use strict';
// This evaluator owns the private stream. Only a fresh observation reaches plan().
const R=require('../st-rules'),B=require('../st-bag'),P=require('../st-planner'),F=require('../st-fixtures');
const CONFIG=Object.freeze({depth:3,width:8,maxNodes:45000});
function execute(state,witness){const replay=R.replay(state,witness);if(!replay.valid||R.validate(replay.state).length)throw new Error('Invalid execution witness');return replay.state;}
function replenish(state,future){let next={...state,queue:state.queue.slice()};while(next.queue.length<6&&future.length){const type=future.shift();next.queue.push(type);if(next.bag){next.bag=B.consume(next.bag,type);if(B.validate(next.bag).length)throw new Error('Contradictory newly revealed bag evidence');}}return next;}
function closedLoop(id,{locks=12,config=CONFIG,baseline=false,bagUnaware=false}={}){const fixture=F.get(id),future=fixture.future.slice(),steps=[];let state=R.createState(fixture.observation),status='lock-limit',priorNonclear=false,afterDouble=false,cycle=false;
 for(let i=0;i<locks;i++){
  const observation=P.observe(state);if(bagUnaware)delete observation.bag;
  const advice=baseline?{target:state.active,witness:['HD'],status:'hard-drop-baseline',metrics:{elapsedMs:0}}:P.plan(observation,config);
  if(!advice.target){status=advice.status;break;}
  const prior=P.assess(state.board),before={active:state.active?.type,hold:state.hold,queue:state.queue.slice(),slots:prior.right.slots,leftSealed:prior.leftSealed,sealed:prior.sealed};state=execute(state,advice.witness);const event=state.lastEvent,assessment=P.assess(state.board);
  if(event.spin==='full'&&event.lines===2&&priorNonclear)afterDouble=true;
  if(event.lines===0){if(afterDouble&&assessment.regionalSupport&&assessment.channel.openBelowStack)cycle=true;priorNonclear=true;}
  steps.push({lock:i+1,before,afterHold:state.hold,slots:assessment.right.slots,sealed:assessment.sealed,leftSealed:assessment.leftSealed,obligations:assessment.obligations,type:event.type,lines:event.lines,spin:event.spin,hold:!!advice.hold,witness:advice.witness,regionalSupport:assessment.regionalSupport,openChannel:assessment.channel.openBelowStack,maxHeight:assessment.maxHeight,elapsedMs:advice.metrics.elapsedMs,budgetExhausted:!!advice.evidence?.budgetExhausted});
  if(state.topOut){status='top-out';break;}state=replenish(state,future);
 }
 return{id,baseline,bagUnaware,witnessFailures:0,config:baseline?null:config,status,locks:steps.length,tsds:steps.filter(s=>s.spin==='full'&&s.lines===2).length,cycle,steps};
}
function evaluate(){const cases=F.list.map(f=>{const a=P.plan(P.observe(f.observation),CONFIG),post=a.target?execute(R.createState(f.observation),a.witness):null;return{id:f.id,split:f.split,status:a.status,validWitness:!!post,witnessFailures:0,verifiedLocks:a.evidence?.verifiedLocks??0,metrics:a.metrics??{},firstLines:post?.lastEvent?.lines??null,firstSpin:post?.lastEvent?.spin??null,checkedTsdAt:a.evidence?.tsdAt??null,elapsedMs:a.metrics?.elapsedMs??0,nodes:a.metrics?.nodes??0,budgetExhausted:a.evidence?.budgetExhausted??false};});
 const loops=['o-before-double','o-filler','marathon-preparation','marathon-rebuild'].flatMap(id=>[closedLoop(id),closedLoop(id,{baseline:true})]);loops.push(closedLoop('higher-cap'));
 const times=cases.map(c=>c.elapsedMs).sort((a,b)=>a-b);return{config:CONFIG,environment:{node:process.version,platform:process.platform},cases,timing:{min:times[0],median:times[Math.floor(times.length/2)],p95:times[Math.ceil(times.length*.95)-1],max:times.at(-1)},loops,ablations:[closedLoop('o-before-double',{locks:3,config:{...CONFIG,allowHold:false}}),closedLoop('o-before-double',{locks:3,bagUnaware:true})],productionLoop:closedLoop('o-before-double',{config:{...CONFIG,timeMs:750}})};}
if(require.main===module){const report=evaluate();if(process.argv.includes('--extended'))report.extended=['o-filler','marathon-rebuild','marathon-preparation'].map(id=>closedLoop(id,{locks:36}));console.log(JSON.stringify(report,null,2));}
module.exports={CONFIG,execute,replenish,closedLoop,evaluate};
