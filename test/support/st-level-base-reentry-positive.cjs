'use strict';
// Synthetic positive control derived from the recorded broken-boundary case.
// Move its single existing Left gap from (3,36), which the future L seals,
// to (0,39), which is already sealed. Preserve the same Center and Left debt
// count, so the tests still require reentry without pretending to repair Left.
const f=structuredClone(require('./st-level-base-reentry.json'));
const adjust=board=>{board[36]='OOJI......';board[39]='.LLILSS...';};
// The current notch checkpoint survives these Left-only board adjustments.
adjust(f.observation.board);
f.observation.queue=['L',...f.observation.queue.slice(1)];
const context=JSON.parse(f.savedStep.resultContext);adjust(context[1]);
f.savedStep.resultContext=JSON.stringify(context);
module.exports=f;
