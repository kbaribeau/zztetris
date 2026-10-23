'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const R = require('../st-rules');
const S = require('../st-structure');
const P = require('../st-planner');

// Page numbers are 1-based placement pages, matching the source JSON. Decode
// boards independently; no copied fixture boards or inferred original queue,
// hold state, or input sequence. Each source placement gets a fresh piece and
// a newly checked input witness under the lab rules. This proves geometry and
// reachability, not that a planner can see the recorded future piece supply.
const codec = vm.runInNewContext(fs.readFileSync(require.resolve('../tetris-fumen.js'), 'utf8'), {window: {}})(2);
const sources = new Map();
const reflection = {I: 'I', O: 'O', T: 'T', S: 'Z', Z: 'S', J: 'L', L: 'J', '.': '.'};
const cellKey = cells => cells.map(cell => cell.join(',')).sort().join(';');

function source(id, mirrored = false) {
  const key = `${id}:${mirrored}`;
  if (!sources.has(key)) {
    const prefix = `../references/st-stacking/${id}`;
    const pages = codec.decoder.decode(fs.readFileSync(require.resolve(`${prefix}.fumen`), 'utf8').trim());
    const metadata = JSON.parse(fs.readFileSync(require.resolve(`${prefix}.json`), 'utf8'));
    const board = page => Array.from({length: 40}, (_, y) => Array.from({length: 10}, (_, x) => {
      const cell = y < 17 ? '.' : page.field.at(mirrored ? 9 - x : x, 39 - y).replace('_', '.');
      return mirrored ? reflection[cell] : cell;
    }).join(''));
    const placement = page => ({
      type: mirrored ? reflection[page.operation.type] : page.operation.type,
      cells: Array.from(page.operation.positions(), ({x, y}) => [mirrored ? 9 - x : x, 39 - y]),
    });
    sources.set(key, {pages, metadata, board, placement});
  }
  return sources.get(key);
}

function checkedCompletion(board, cells, notches) {
  const completion = S.geometry(board, {notches}).center.completions.find(c =>
    c.piece === 'L' && c.resultStatus === 'level' && cellKey(c.cells) === cellKey(cells));
  assert.ok(completion, 'the same exact pending L completion remains available');
  assert.equal(completion.patternSupport, 'reference-supported');
  const replay = R.replay(R.createState({board, active: 'L', canHold: false}), completion.witness);
  assert.equal(replay.valid, true, 'hypothetical fresh-L completion has an input witness');
  assert.equal(cellKey(replay.events[0].cells), cellKey(cells));
  assert.equal(S.advanceNotches(board, {state: replay.state, event: replay.events[0]}, notches).valid, true);
  return completion;
}

function replayReference(id, firstPage, lastPage, mirrored = false) {
  const reference = source(id, mirrored);
  let board = reference.board(reference.pages[firstPage - 1]);
  let notches = S.notchPattern(board);
  let pending = null;
  let debt = [];
  const steps = [];
  for (let number = firstPage; number <= lastPage; number++) {
    const page = reference.pages[number - 1];
    const recorded = reference.placement(page);
    assert.equal(reference.metadata.pages[number - 1].page, number);
    assert.deepEqual(board, reference.board(page), `source board before page ${number}`);
    if (pending) checkedCompletion(board, pending, notches);
    const before = R.createState({board, active: recorded.type, canHold: false});
    const enumerated = R.placements(before, {allowHold: false});
    assert.equal(enumerated.complete, true);
    const candidates = enumerated.placements.filter(p => cellKey(p.event.cells) === cellKey(recorded.cells));
    // Prefer an available full-T witness when the source geometry is a double;
    // the Fumen does not reconstruct the original player's rotation inputs.
    const placement = candidates.find(p => p.event.spin === 'full') || candidates[0];
    assert.ok(placement, `source placement ${number} is reachable under lab rules`);
    const replay = R.replay(before, placement.witness);
    assert.equal(replay.valid, true);
    assert.deepEqual(replay.events[0], placement.event);
    assert.deepEqual(replay.state.board, reference.board(reference.pages[number]), `source board after page ${number}`);
    assert.deepEqual(placement.event.clearedRows, reference.metadata.pages[number - 1].clearedRows.map(y => 39 - y).sort((a, b) => a - b));
    const priorNotches = notches;
    const reservation = P.centerReservationStep(before, placement, debt, priorNotches);
    debt = reservation.debt;
    const check = S.advanceNotches(board, placement, priorNotches);
    assert.equal(check.valid, true, `source page ${number}: ${check.violation}`);
    notches = check.pattern;
    const pendingBefore = pending && pending.map(cell => cell.slice());
    if (number === firstPage) {
      assert.equal(placement.event.type, 'S');
      assert.ok(placement.event.cells.every(([x]) => x >= 4 && x <= 6));
      const completion = S.geometry(placement.state.board, {notches}).center.completions.find(c => c.piece === 'L' && c.resultStatus === 'level');
      assert.ok(completion, 'source S starts a checked ordered S/L construction');
      pending = completion.cells.map(cell => cell.slice());
    } else if (number === lastPage) {
      assert.equal(placement.event.type, 'L');
      assert.equal(cellKey(placement.event.cells), cellKey(pending), 'final L fulfills the exact pending center completion');
      assert.ok(reservation.completed.some(c => c.piece === 'L' && cellKey(c.cells) === cellKey(pending)));
      assert.equal(new Set(S.geometry(placement.state.board, {notches}).center.profile).size, 1);
      pending = null;
    } else {
      const cleared = placement.event.clearedRows;
      assert.ok(pending.every(([, y]) => !cleared.includes(y)), 'these source clears preserve all four pending completion cells');
      pending = pending.map(([x, y]) => [x, y + cleared.filter(row => row > y).length]);
    }
    if (pending) checkedCompletion(placement.state.board, pending, notches);
    steps.push({page: number, before, placement, priorNotches, notches, reservation, pendingBefore, pendingAfter: pending && pending.map(cell => cell.slice())});
    board = placement.state.board;
  }
  assert.equal(pending, null);
  assert.deepEqual(debt, [], 'the source endpoint leaves no unpaid center diversion');
  return steps;
}

test('center reference: sprint pages 59-60 completes the exact S/L center directly', () => {
  const steps = replayReference('hXc2nbXcXOc', 59, 60);
  assert.deepEqual(S.geometry(steps[0].placement.state.board).center.profile, [11, 12, 12]);
  assert.equal(S.geometry(steps[0].placement.state.board).center.motif, '.##/##./###');
  assert.deepEqual(S.geometry(steps[1].placement.state.board).center.profile, [13, 13, 13]);
  assert.ok(steps.every(step => step.reservation.debt.length === 0));
  assert.ok(steps.every(step => S.canonicalClear(step.placement.event)));
});

test('center reference: sprint pages 28-33 preserves the same L target through J/I/I/O left fillers', () => {
  const steps = replayReference('hXc2nbXcXOc', 28, 33);
  assert.deepEqual(steps.map(step => step.placement.event.type), ['S', 'J', 'I', 'I', 'O', 'L']);
  assert.deepEqual(S.geometry(steps[0].placement.state.board).center.profile, [11, 12, 12]);
  for (const step of steps.slice(1, -1)) {
    assert.ok(step.placement.event.cells.every(([x]) => x < 4));
    assert.equal(cellKey(step.pendingAfter), cellKey(steps[0].pendingAfter));
  }
  assert.ok(steps.every(step => step.reservation.debt.length === 0), 'unrelated left fillers do not spend the required L');
  assert.ok(steps.every(step => S.canonicalClear(step.placement.event)));
});

test('center reference: mirrored Marathon pages 3-8 spends a different L left before completing the center', () => {
  const steps = replayReference('sm22939781', 3, 8, true);
  assert.deepEqual(steps.map(step => step.placement.event.type), ['S', 'I', 'Z', 'L', 'T', 'L']);
  const spentLeft = steps.find(step => step.page === 6);
  assert.ok(spentLeft.placement.event.cells.every(([x]) => x < 4));
  assert.notEqual(cellKey(spentLeft.placement.event.cells), cellKey(spentLeft.pendingBefore));
  assert.equal(cellKey(spentLeft.pendingAfter), cellKey(spentLeft.pendingBefore));
  assert.equal(spentLeft.reservation.debt.length, 1);
  assert.ok(spentLeft.reservation.debt[0].alternatives.some(c => c.piece === 'L' && cellKey(c.cells) === cellKey(spentLeft.pendingAfter)));
  // This opening is source geometry evidence, not a new canonical-ST advice
  // fixture: its phase is initially unanchored and page 7 is an ordinary single.
  assert.equal(steps[0].priorNotches.status, 'unanchored');
  const single = steps.find(step => step.page === 7);
  assert.equal(single.placement.event.lines, 1);
  assert.equal(S.canonicalClear(single.placement.event), false);
  assert.deepEqual(single.pendingAfter, single.pendingBefore.map(([x, y]) => [x, y + 1]));
  assert.ok(single.reservation.debt[0].alternatives.some(c => c.piece === 'L' && cellKey(c.cells) === cellKey(single.pendingAfter)));
  assert.deepEqual(steps.at(-1).reservation.debt, [], 'the different later center L actually repays the reservation');
});

test('center reference: sprint pages 49-52 translates the pending L through a canonical T-spin double', () => {
  const steps = replayReference('hXc2nbXcXOc', 49, 52);
  const double = steps.find(step => step.page === 51);
  assert.equal(double.placement.event.lines, 2);
  assert.equal(double.placement.event.spin, 'full');
  assert.deepEqual(double.pendingAfter, double.pendingBefore.map(([x, y]) => [x, y + 2]));
  assert.ok(steps.every(step => S.canonicalClear(step.placement.event)));
  // Seed an exact obligation derived from the source S, to exercise debt
  // transport through this real canonical clear. The source itself did not
  // divert an L in this span; this is an API control, not invented source play.
  let carried = [{alternatives: [{piece: 'L', cells: steps[0].pendingAfter}]}];
  for (const step of steps.slice(1)) {
    const reservation = P.centerReservationStep(step.before, step.placement, carried, step.priorNotches);
    carried = reservation.debt;
    if (step.pendingAfter) {
      assert.equal(carried.length, 1);
      assert.equal(cellKey(carried[0].alternatives[0].cells), cellKey(step.pendingAfter));
    }
  }
  assert.deepEqual(carried, []);
});
