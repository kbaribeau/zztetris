// Independently authored literal boards/endpoints. R10 is retained from the
// earlier Left experiment's unpaid-channel counterexample (not its evaluator).
// The roof/remedy is a right-reflected J/S version of Marathon p199–200,
// transplanted above an established capped stack; its queue is hypothetical.
const {pad}=require('./st-fixtures.cjs');
const dualChannel={
  before:pad(['..##......','######....','#######...','#######...','######....','#######...','#######...','######....','#######...','#######...']),
  after:pad(['#..#......','#..#......','#..#......','####......','####......','######....','#######...','#######...','######....','#######...','#######...','######....','#######...','#######...']),
  cells:[[1,29],[2,29],[0,30],[1,30]],active:'S',hold:'',next:['I','I','O','O','J','L'],
};
const roof={
  before:pad(['....###...','...####...','.#####....','#######...','#######...','######....','#######...','#######...','######...#','#######.##','#######.#.']),
  cells:[[0,29],[1,29],[0,30],[0,31]],active:'J',hold:'',next:['S','T','O','I','J','L'],
  afterRepair:pad(['#######...','#######...','######....','#######...','#######...','######....','#######...','#######...','######...#','#######.##','#######.#.']),
};
module.exports={dualChannel,roof};
