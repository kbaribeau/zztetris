'use strict';
// Actual controller ownership only. Projected search-node assessments are not
// phase transitions and cannot establish entries or resource-history authority.
const COACHES=Object.freeze(['opening','earlyMidgame','lateMidgame','reset','compatibility']);
function phase(opening,resources){
 if(opening?.active)return 'opening';
 if(resources?.reset?.status==='active')return 'reset';
 if(resources?.extraZ?.status==='available')return 'earlyMidgame';
 if(resources?.extraZ?.status==='used')return 'lateMidgame';
 return 'compatibility';
}
function create(initial,{imported=false}={}){
 const entries=Object.fromEntries(COACHES.map(k=>[k,0])),transitions=[];let current=null;
 function enter(coach,afterLock,reason){
  if(!COACHES.includes(coach)||!Number.isSafeInteger(afterLock)||afterLock<0)throw Error('Invalid coach entry');
  if(coach===current)return;
  entries[coach]++;current=coach;transitions.push({coach,afterLock,reason});
 }
 enter(initial,0,'initial-observed-coach');
 return {enter,snapshot:()=>({coachEntries:{...entries},coachTransitions:transitions.map(x=>({...x})),currentCoach:current,coachHistoryScope:imported?'observed-from-import':'entire-run'})};
}
module.exports={COACHES,phase,create};
