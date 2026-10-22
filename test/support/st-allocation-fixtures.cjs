// Observed preboards from retained ST replay p23/34/177, mirrored right.
// NEXT is the next recorded LOCK kinds: synthetic hindsight, NOT recovered
// player preview, draw order, hold or bag state. No preferred/source move supplied.
const cases=[
  {page:23,active:'S',next:'LIOJSL',bottom:[
    '#######...','#######...','######....','#######...',
    '#######...','######...#','#######.##','#######.#.']},
  {page:34,active:'Z',next:'JIJTOZ',bottom:[
    '..#.###...','###.###...','######....','#######...',
    '#######...','######....','#######...','#######...',
    '######...#','#######.##','#######.#.','#######.#.']},
  {page:177,active:'O',next:'ZLITZS',bottom:[
    '.....#....','.....##...','....###...','....##....','....###...',
    '....###...','....##....','....###...','#######...','######....',
    '#######...','#######...','#######.#.']}
];
module.exports=cases.map(c=>({...c,heap:[...Array(40-c.bottom.length).fill('..........'),...c.bottom]}));
