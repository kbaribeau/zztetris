"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../st-left-contours"),
  D = require("../st-left-dependencies"),
  R = require("../st-rules");
const supply = (active, hold, queue, canHold = true) => ({
  active,
  hold,
  queue,
  canHold,
});
const p = (type, id) => ({ type, id });
const seq = (pieces, s, options) => C.schedule([...pieces], s, options);
const choices = (result) => result.alternatives.map((a) => a.pieces.join(""));
const state = (active, hold = null, queue = [], extra = {}) =>
  R.createState({ active, hold, queue, ...extra });
const options = { heights: [0, 0, 1, 1], center: {}, right: {} };

test("Left dependency query: ordered finite supply, repeated identities and HOLD transitions", () => {
  const s = supply(p("O", 1), p("J", 2), [p("O", 3)]);
  assert.deepEqual(
    seq("OO", s).map((s) => s.piece.id),
    [1, 3],
  );
  assert.equal(seq("OOO", s), null);
  assert.equal(
    seq("OJ", supply("O", "J", [])),
    null,
    "stranded HOLD cannot spawn after finite exhaustion",
  );
  assert.equal(seq("OJ", supply("O", "I", ["T", "J"])), null);
  const delayed = seq("OJ", supply("O", "I", ["T", "J"]), {
    allowIntervening: true,
  });
  assert.deepEqual(
    delayed.filter((s) => s.dependency).map((s) => s.piece.type),
    ["O", "J"],
  );
  assert.ok(delayed.some((s) => !s.dependency));
  assert.equal(seq("J", supply("T", "J", [], false)), null);
  assert.equal(
    seq("J", supply("T", "J", [], false), { unlimitedHold: true })[0].holds,
    1,
  );
  assert.equal(seq("J", supply("T", "J", []), { allowHold: false }), null);
  // Swap back after empty HOLD keeps I active while retaining J for a later lock.
  const swapped = seq("IJ", supply("I", null, ["J", "O"]), {
    unlimitedHold: true,
    canUse: (p, i, steps) => i !== 1 || steps[0].holds === 2,
  });
  assert.deepEqual(
    swapped.map((s) => [s.piece.type, s.holds]),
    [
      ["I", 2],
      ["J", 1],
    ],
  );
  assert.equal(
    seq("IJ", supply("I", null, ["J", "O"]), {
      canUse: (p, i, steps) => i !== 1 || steps[0].holds === 2,
    }),
    null,
  );
});

test("Left dependency query: translated contours, path alternatives and unknown remain distinct", () => {
  const result = C.candidates([12, 12, 13, 13], supply("O", null, ["J"]));
  assert.equal(result.contour, "LC-001");
  assert.equal(result.status, "known");
  assert.equal(
    result.alternatives.find((a) => a.pieces.join("") === "OJ").paths.length,
    2,
  );
  assert.equal(
    C.candidates([0, 0, 1, 1], supply("T", null, [])).status,
    "known",
  );
  assert.equal(
    C.candidates([0, 0, 1, 1], supply("T", null, [])).alternatives.length,
    0,
  );
  const unknown = C.catalog.find((c) => c.dependencies.status === "unknown");
  assert.equal(
    C.candidates(unknown.profile, supply("O", null, ["J"])).status,
    "unknown",
  );
  assert.equal(
    C.candidates([0, 0, 0, 99], supply("O", null, ["J"])).status,
    "unlisted",
  );
  assert.equal(
    C.candidates([0, 0, 0, 0], supply("L", null, [])).alternatives.length,
    0,
  );
  assert.equal(
    C.candidates([0, 0, 0, 0], supply("L", null, []), { allowCrossing: true })
      .alternatives[0].paths[0].crossesCenter,
    true,
  );
});

test("Left dependency query: public role reservations and profile-specific HOLD are honored", () => {
  const o = state("O", null, ["J"]);
  assert.ok(choices(D.query(o, options)).includes("OJ"));
  for (const opts of [
    { resources: { pendingCenter: [{ alternatives: [{ piece: "J" }] }] } },
    { centerDebt: [{ alternatives: [{ piece: "J" }] }] },
    {
      center: {
        status: "supported-partner-completion",
        completions: [{ piece: "J", patternSupport: "reference-supported" }],
      },
    },
  ])
    assert.ok(!choices(D.query(o, { ...options, ...opts })).includes("OJ"));
  assert.ok(
    choices(
      D.query(o, {
        ...options,
        center: {
          status: "supported-partner-completion",
          completions: [{ piece: "J", patternSupport: "unsupported" }],
        },
      }),
    ).includes("OJ"),
  );
  const l = state("T", "L", [], { canHold: false });
  const resources = { hold: p("L", 9), hangingL: [{ id: 9 }] };
  assert.ok(choices(D.query(l, { ...options, resources })).includes("L"));
  assert.ok(
    !choices(
      D.query({ ...l, rules: R.LEGACY_PROFILE.id }, { ...options, resources }),
    ).includes("L"),
  );
  for (const bad of [
    { hold: p("L", 8), hangingL: [{ id: 9 }] },
    { hold: p("S", 9), hangingL: [{ id: 9 }] },
    { hangingL: [{ id: 9 }] },
  ])
    assert.ok(
      !choices(D.query(l, { ...options, resources: bad })).includes("L"),
    );
  const withHidden = { ...o, hiddenQueue: ["I", "I"], seed: 42 };
  assert.deepEqual(D.query(withHidden, options), D.query(o, options));
});

test("Left dependency query: I and Z reservations and covered cells do not change contour applicability", () => {
  for (const [piece, restriction] of [
    ["I", { cycle: { prepareColumn: 0 } }],
    ["I", { cycle: { cleanupColumns: [9] } }],
    ["Z", { completions: [{}] }],
  ]) {
    const contour = C.catalog.find((c) =>
      c.dependencies.alternatives.some(
        (a) => a.pieces.join("") === (piece === "Z" ? "ZJ" : piece),
      ),
    );
    assert.ok(contour, piece);
    const sequence = piece === "Z" ? "ZJ" : piece;
    const s = state(piece, null, piece === "Z" ? ["J"] : []),
      opts = {
        ...options,
        heights: contour.profile,
        resources: { extraZ: "available", extraZRemaining: 1 },
      };
    assert.ok(choices(D.query(s, opts)).includes(sequence));
    assert.ok(
      !choices(D.query(s, { ...opts, right: restriction })).includes(sequence),
    );
    if (piece === "Z")
      assert.ok(
        !choices(
          D.query(s, { ...opts, resources: { extraZ: "used" } }),
        ).includes(sequence),
      );
  }
  const a = state("O", null, ["J"]),
    b = { ...a, board: a.board.map((r, y) => (y === 38 ? "X........." : r)) };
  assert.deepEqual(
    D.query(a, options),
    D.query(b, options),
    "same supplied contour has the same alternatives regardless of covered cells",
  );
});
