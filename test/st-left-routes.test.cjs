"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const R = require("../st-rules"), S = require("../st-structure"), C = require("../st-left-contours"), T = require("../st-left-routes");
function state(heights, active, queue = [], hold = null) {
  const s = R.createState({ active, queue, hold });
  s.board = s.board.map((row, y) => heights.map(h => y >= 40 - h ? "X" : ".").join("") + row.slice(4));
  return s;
}
const opts = { center: {}, right: {}, allowHold: false };
function lock(s, contour, outside = false) {
  const p = R.placements(s, { allowHold: false }).placements.find(p =>
    (outside ? p.event.cells.every(([x]) => x >= 4) : p.event.cells.every(([x]) => x < 4)) &&
    (!contour || C.lookup(S.leftSurface.heights(p.state.board))?.id === contour));
  assert.ok(p, `legal ${s.active.type} placement to ${contour}`);
  const replay = R.replay(s, p.witness);
  assert.equal(replay.valid, true);
  assert.deepEqual(replay.events, [p.event]);
  return p;
}
const select = (root, sequence) => root.progress.filter(p => root.routes.find(r => r.id === p.routeId).pieces.join("") === sequence);

test("root routes keep both legal OJ targets and advance only on real locks", () => {
  const s = state([0, 0, 1, 1], "O", ["J"]), root = T.prepare(s, opts);
  const initial = select(root, "OJ");
  assert.equal(initial.length, 2);
  const o = lock(s, "LC-002"), progress = T.advance(root, initial, s, o);
  assert.deepEqual(progress.map(p => p.index), [1, 1]);
  for (const target of ["LC-003", "LC-006"]) {
    const j = lock(o.state, target), done = T.advance(root, progress, o.state, j);
    assert.equal(done.length, 1);
    assert.equal(done[0].complete, true);
    assert.equal(done[0].index, 2);
    assert.ok(T.compare(done, progress) < 0);
    assert.notEqual(T.key(done), T.key(progress));
  }
  assert.equal(T.signatures(progress).length, 2);
  assert.equal(T.key(progress), T.key(progress.slice().reverse()));
  assert.equal(T.advance(root, initial, s, { state: R.move(s, "HOLD") }), initial);
});

test("outside-Left locks preserve a route, wrong Left piece or contour abandons it", () => {
  const s = state([0, 0, 1, 1], "O", ["T", "J"]), root = T.prepare(s, opts);
  const initial = select(root, "OJ"), o = lock(s, "LC-002");
  const progress = T.advance(root, initial, s, o), t = lock(o.state, null, true);
  assert.deepEqual(T.advance(root, progress, o.state, t), progress);
  const j = lock(t.state, "LC-003");
  assert.equal(T.advance(root, progress, t.state, j)[0].complete, true);
  const badO = lock(s, "LC-016");
  assert.deepEqual(T.advance(root, initial, s, badO), []);
  const leftT = R.placements(o.state, { allowHold: false }).placements.find(p => p.event.cells.some(([x]) => x < 4));
  assert.ok(leftT);
  assert.deepEqual(T.advance(root, progress, o.state, leftT), []);
  // Even an outside lock cannot preserve progress if its resulting contour changed.
  assert.deepEqual(T.advance(root, progress, o.state, { ...t, state: badO.state }), []);
});

test("legal OO cycle completes once and retains history without restarting", () => {
  const s = state([0, 0, 1, 1], "O", ["O", "O"]), root = T.prepare(s, opts);
  const first = lock(s, "LC-002"), second = lock(first.state, "LC-001");
  const progress = T.advance(root, select(root, "OO"), s, first);
  const done = T.advance(root, progress, first.state, second);
  assert.equal(done[0].complete, true);
  const third = lock(second.state, "LC-002");
  assert.deepEqual(T.advance(root, done, second.state, third), done);
  assert.equal(done[0].index, 2);
});

test("D-to-L requires an actually available eligible identity, not the one schedule witness", () => {
  const s = state([0, 1, 1, 0], "L", ["L"]);
  const resources = { active: { type: "L", id: 1 }, queue: [{ type: "L", id: 2 }], hangingL: [{ id: 1 }, { id: 2 }] };
  const root = T.prepare(s, { ...opts, resources }), p = lock(s, "LC-006"), initial = select(root, "L");
  assert.equal(initial.length, 1);
  assert.equal(T.advance(root, initial, s, p, resources.active)[0].complete, true);
  assert.deepEqual(T.advance(root, initial, s, p, { type: "L", id: 9 }), []);
  assert.deepEqual(T.advance(root, initial, s, p), []);
  // A different eligible instance is legal after the first L is used outside Left.
  const outside = lock(s, null, true);
  const continued = T.advance(root, initial, s, outside, resources.active);
  const second = lock(outside.state, "LC-006");
  assert.equal(T.advance(root, continued, outside.state, second, resources.queue[0])[0].complete, true);
  assert.equal(T.prepare(s, opts).routes.length, 0);
});

test("root lookup uses literal public supply and preserves incomplete/unknown status", () => {
  const s = state([0, 0, 1, 1], "O");
  const ordinary = T.prepare(s, opts), hidden = T.prepare({ ...s, hiddenQueue: ["J"], seed: 42 }, opts);
  assert.deepEqual(hidden, ordinary);
  assert.equal(ordinary.routes.length, 0);
  assert.equal(ordinary.stats.queries, 1);
  assert.equal(ordinary.query.complete, true);
  const incomplete = T.prepare(state([0, 0, 1, 1], "O", ["J"]), { ...opts, maxStates: 0 });
  assert.equal(incomplete.query.complete, false);
  assert.deepEqual(incomplete.routes, []);
  assert.equal(incomplete.stats.status, "known");
  assert.equal(T.prepare(state([0, 0, 0, 9], "O"), opts).query.status, "unlisted");
  assert.ok(T.compare([{ routeId: "example", index: 0, complete: false }], []) < 0);
});

test("dependency query runs once at prepare, never again while progressing or starting", () => {
  const fs = require("node:fs"), vm = require("node:vm"), D = require("../st-left-dependencies");
  let calls = 0;
  const context = { module: { exports: {} }, require: name => name === "./st-left-dependencies" ? {
    query: (s, options) => { calls++; assert.equal(options.allowIntervening, true); return D.query(s, options); },
  } : require("../" + name.slice(2)) };
  vm.runInNewContext(fs.readFileSync(require.resolve("../st-left-routes"), "utf8"), context);
  const tracker = context.module.exports;
  const s = state([0, 0, 1, 1], "O", ["J"]), root = tracker.prepare(s, opts);
  const o = lock(s, "LC-002"), progress = tracker.advance(root, tracker.start(root), s, o);
  const j = lock(o.state, "LC-003");
  assert.ok(tracker.advance(root, progress, o.state, j).some(p => p.complete));
  tracker.start(root);
  assert.equal(calls, 1);
});
