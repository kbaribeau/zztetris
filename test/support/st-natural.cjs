// One observed normal-generation replay, not an opener recommendation.
// Found by 29 bounded real-engine boots of a fixed manual construction (max 512).
// Seed is the existing test host's RNG; no predicted shuffle-call counts.
const seed=29;
const steps=[
  {active:'J',piece:'J',actions:['L','L','L','HD']},
  {active:'Z',piece:'Z',actions:['L','L','L','HD']},
  {active:'O',piece:'O',actions:['R','R','R','R','HD']},
  {active:'L',piece:'L',actions:['R','HD']},
  {active:'S',piece:'S',actions:['R','HD']},
  {active:'T',piece:'I',actions:['hold','CW','L','L','HD']},
  {active:'T',piece:'T',actions:['CCW','L','L','HD']},
  {active:'J',piece:'J',actions:['CW','L','L','L','L','HD']},
  {active:'L',piece:'T',actions:['hold','CW','HD']},
  {active:'O',piece:'O',actions:['R','R','R','R','HD']},
  {active:'S',piece:'L',actions:['hold','CCW','R','R','HD']},
];
function act(w,action) {
  if(action==='HD')w.zzBot.hardDrop();
  else if(action==='hold')w.zzBot.hold();
  else if(['L','R','SD'].includes(action))w.zzBot.move(action);
  else w.zzBot.rotate(action);
}
module.exports={seed,steps,act};
