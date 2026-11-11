"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  crypto = require("node:crypto");
const C = require("../st-left-contours.js"),
  S = require("../st-structure.js");
const root = path.resolve(__dirname, ".."),
  script = fs.readFileSync(path.join(root, "st-left-contours.js"), "utf8");

test("Left contours: exact observed inventory, stable identities and descriptive limits", () => {
  assert.equal(C.schemaVersion, 1);
  assert.equal(C.catalog.length, 90);
  assert.deepEqual(
    C.catalog.map((c) => c.id),
    Array.from(
      { length: 90 },
      (_, i) => "LC-" + String(i + 1).padStart(3, "0"),
    ),
  );
  assert.equal(new Set(C.catalog.map((c) => c.key)).size, 90);
  for (const c of C.catalog) {
    assert.equal(c.key, c.profile.join(","));
    assert.equal(Math.min(...c.profile), 0);
    assert.equal(C.lookup(c.profile), c);
    assert.equal(C.lookup(c.profile.map((h) => h + 12)), c);
    assert.deepEqual(c.dependencies, { status: "unknown", alternatives: [] });
    assert.equal(C.validateDependencies(c.dependencies), true);
    assert.equal(Object.hasOwn(c, "observations"), false);
    const match = S.leftSurface.classify(c.profile);
    assert.equal(c.knownShape, match?.id ?? null);
    assert.equal(c.knownTier, match?.tier ?? null);
  }
  assert.equal(C.catalog.filter((c) => c.knownShape).length, 12);
  assert.equal(C.lookup([0, 0, 1, 1]).id, "LC-001");
  assert.equal(C.lookup([1, 1, 0, 0]).id, "LC-002");
  assert.equal(C.lookup([0, 0, 0, 0]).id, "LC-090");
  assert.equal(C.lookup([0, 0, 0, 99]), null);
  assert.equal(
    C.lookup([0, 1, 1, 0]).dependencies.status,
    "unknown",
    "D skyline tier is not a universal dependency claim",
  );
});

test("Left contours: invalid inputs cannot alias an observed contour", () => {
  for (const h of [
    null,
    undefined,
    "0,0,1,1",
    {},
    [],
    [0, 0, 1],
    [0, 0, 1, 1, 0],
    [0, 0, 1, NaN],
    [0, 0, 1, Infinity],
    [0, 0, 1, -1],
    [0, 0, 1, 1.5],
    [0, 0, 1, "1"],
    [0, 0, 1, Number.MAX_SAFE_INTEGER + 1],
    Array(4),
    [0, , 1, 1],
  ]) {
    assert.equal(C.normalize(h), null);
    assert.equal(C.key(h), null);
    assert.equal(C.lookup(h), null);
  }
  const input = [7, 7, 8, 8],
    normalized = C.normalize(input);
  assert.deepEqual(normalized, [0, 0, 1, 1]);
  assert.deepEqual(input, [7, 7, 8, 8]);
  normalized[0] = 9;
  assert.equal(C.key(input), "0,0,1,1");
  assert.equal(
    C.key([
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ]),
    "0,0,0,0",
  );
});

test("Left contours: alternatives retain AND pieces, OR choices, ordering and repeated pieces", () => {
  const a = (pieces, order = "unordered") => ({
    pieces,
    order,
    conditions: "",
    evidence: "Synthetic schema fixture; not a contour claim",
  });
  const values = [
    { status: "unknown", alternatives: [] },
    {
      status: "known",
      alternatives: [a(["J"]), a(["I", "I", "O"], "ordered")],
    },
    { status: "known", alternatives: [a([])] },
  ];
  for (const v of values) {
    const before = JSON.stringify(v);
    assert.equal(C.validateDependencies(v), true);
    assert.equal(JSON.stringify(v), before);
  }
  assert.deepEqual(values[1].alternatives[1].pieces, ["I", "I", "O"]);
  for (const v of [
    null,
    {},
    [],
    { status: "unknown", alternatives: [a(["J"])] },
    { status: "known", alternatives: [] },
    { status: "guess", alternatives: [] },
    { status: "known", alternatives: [["J"]] },
    { status: "known", alternatives: [a(["JJ"])] },
    { status: "known", alternatives: [a(["j"])] },
    { status: "known", alternatives: [a(["J"], null)] },
    { status: "known", alternatives: [{ pieces: ["J"], order: "ordered" }] },
    { status: "known", alternatives: [{ ...a(["J"]), evidence: "  " }] },
    { status: "known", alternatives: [a(Array(1))] },
  ])
    assert.equal(C.validateDependencies(v), false);
  assert.equal(
    C.catalog.every(
      (c) =>
        c.dependencies.status === "unknown" &&
        c.dependencies.alternatives.length === 0,
    ),
    true,
  );
});

test("Left contours: records and source metadata cannot be mutated through lookup", () => {
  function frozen(value) {
    if (!value || typeof value !== "object") return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) frozen(child);
  }
  frozen(C.catalog);
  frozen(C.source);
  assert.equal(Object.isFrozen(C), true);
  const c = C.lookup([7, 7, 8, 8]);
  assert.throws(() => (c.profile[0] = 1), TypeError);
  assert.throws(() => c.dependencies.alternatives.push({}), TypeError);
  assert.throws(() => (c.observations = {}), TypeError);
  assert.throws(() => C.catalog.push(c), TypeError);
  assert.equal(C.lookup([0, 0, 1, 1]), c);
});

test("Left contours: classic browser and worker loading need no DOM, modules or network", () => {
  const browser = vm.createContext({});
  vm.runInContext("window=globalThis", browser);
  vm.runInContext(script, browser);
  const worker = vm.createContext({});
  worker.importScripts = (name) => {
    assert.equal(name, "st-left-contours.js");
    vm.runInContext(script, worker);
  };
  vm.runInContext(
    "self=globalThis; importScripts('st-left-contours.js')",
    worker,
  );
  for (const realm of [browser, worker]) {
    assert.equal(realm.STLeftContours.lookup([7, 7, 8, 8]).id, "LC-001");
    assert.equal(realm.STLeftContours.lookup([0, 0, 0, 99]), null);
    assert.equal(
      JSON.stringify(realm.STLeftContours.catalog),
      JSON.stringify(C.catalog),
    );
    assert.equal(
      JSON.stringify(realm.STLeftContours.source),
      JSON.stringify(C.source),
    );
  }
});

test("Left contours: inventory and source totals agree with independently reconstructed source boards", () => {
  const bytes = fs.readFileSync(path.join(root, C.source.sourceFile));
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    C.source.sourceSha256,
  );
  const codec = vm.runInNewContext(
    fs.readFileSync(path.join(root, "tetris-fumen.js"), "utf8"),
    { window: {} },
  )(2);
  const pages = codec.decoder.decode(bytes.toString().trim()),
    observed = new Map();
  let firstRightTDouble = null,
    lines = 0,
    prior = null,
    coveredStates = 0;
  const rows = (field) =>
    Array.from({ length: 23 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => field.at(x, y)).join(""),
    );
  function observe(board, lock) {
    // Independent bottom-up scan, rather than the registry's normalization or
    // production height helper. Source rows ascend from the floor.
    const heights = [0, 0, 0, 0];
    for (let y = 0; y < 23; y++)
      for (let x = 0; x < 4; x++) if (board[y][x] !== "_") heights[x] = y + 1;
    const base = Math.min(...heights),
      profile = heights.map((h) => h - base),
      key = profile.join(",");
    let holes = 0;
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < heights[x]; y++) if (board[y][x] === "_") holes++;
    if (lock && holes) coveredStates++;
    const occupancy = board
      .slice(0, Math.max(...heights))
      .map((r) => r.slice(0, 4).replace(/[^_]/g, "#"));
    while (occupancy[0] === "####") occupancy.shift();
    if (!observed.has(key))
      observed.set(key, { profile, states: [], variants: new Set() });
    const c = observed.get(key);
    c.states.push({ lock, base, holes });
    c.variants.add(occupancy.join("/"));
  }
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i],
      before = rows(p.field),
      op = p.operation;
    assert.ok(op);
    assert.equal(p.flags.lock, true);
    assert.equal(p.flags.mirror, false);
    assert.equal(p.flags.rise, false);
    if (prior) assert.deepEqual(before, prior);
    else {
      assert.ok(before.every((row) => row === "__________"));
      observe(before, 0);
    }
    assert.equal(p.field.canFill(op), true);
    assert.equal(p.field.canLock(op), true);
    const placed = before.map((row) => row.split(""));
    for (const { x, y } of op.positions()) {
      assert.equal(placed[y][x], "_");
      placed[y][x] = op.type;
    }
    const kept = placed.filter((row) => row.some((cell) => cell === "_")),
      cleared = 23 - kept.length;
    const after = kept.map((row) => row.join(""));
    while (after.length < 23) after.push("__________");
    const codecAfter = p.field.copy();
    codecAfter.fill(op);
    codecAfter.clearLine();
    assert.deepEqual(rows(codecAfter), after);
    if (
      firstRightTDouble === null &&
      op.type === "T" &&
      cleared === 2 &&
      op.positions().every(({ x }) => x >= 6)
    )
      firstRightTDouble = i + 1;
    lines += cleared;
    observe(after, i + 1);
    prior = after;
  }
  assert.equal(pages.length, 2519);
  assert.equal(lines, 1000);
  assert.equal(firstRightTDouble, 17);
  assert.equal(observed.size, 90);
  assert.equal(coveredStates, 65);
  const ordered = [...observed.entries()].sort(
    (a, b) =>
      b[1].states.filter((s) => s.lock).length -
        a[1].states.filter((s) => s.lock).length || a[0].localeCompare(b[0]),
  );
  const reconstructed = [];
  for (const [i, [key, c]] of ordered.entries()) {
    const entry = C.lookup(c.profile),
      post = c.states.filter((s) => s.lock),
      opening = post.filter((s) => s.lock < firstRightTDouble),
      later = post.filter((s) => s.lock >= firstRightTDouble);
    assert.ok(entry, key);
    assert.equal(entry.id, "LC-" + String(i + 1).padStart(3, "0"));
    assert.deepEqual(entry.profile, c.profile);
    reconstructed.push({
      id: entry.id,
      key,
      knownShape: entry.knownShape,
      postLockCount: post.length,
      includingInitialCount: c.states.length,
      cleanCount: post.filter((s) => !s.holes).length,
      holeCount: post.filter((s) => s.holes).length,
      firstAfterLock: c.states[0].lock,
      postLocks: post.map((s) => s.lock),
      minBase: Math.min(...c.states.map((s) => s.base)),
      maxBase: Math.max(...c.states.map((s) => s.base)),
      coveredRange: [
        Math.min(...c.states.map((s) => s.holes)),
        Math.max(...c.states.map((s) => s.holes)),
      ],
      openingPostLocks: opening.map((s) => s.lock),
      phaseGroup: !post.length
        ? "initial-only"
        : !later.length
          ? "opening-only"
          : opening.length
            ? "opening-and-later"
            : "later-only",
      laterCount: later.length,
      occupancyVariants: c.variants.size,
    });
  }
  const sum = (field) => reconstructed.reduce((n, c) => n + c[field], 0),
    count = (predicate) => reconstructed.filter(predicate).length;
  assert.equal(sum("postLockCount"), C.source.postLockStates);
  assert.equal(sum("includingInitialCount"), C.source.states);
  assert.equal(C.source.initialStates, 1);
  assert.equal(C.source.placements, pages.length);
  assert.equal(C.source.contours, C.catalog.length);
  assert.equal(C.source.lines, lines);
  assert.equal(sum("holeCount"), C.source.postLockCoveredStates);
  assert.equal(sum("occupancyVariants"), C.source.occupancyVariants);
  assert.equal(
    count((c) => c.holeCount > 0),
    C.source.contoursWithCoveredStates,
  );
  assert.equal(
    count((c) => c.holeCount > 0 && c.cleanCount === 0),
    C.source.contoursOnlyCovered,
  );
  assert.equal(
    count((c) => c.knownShape),
    C.source.knownContours,
  );
  assert.deepEqual(C.source.phaseCounts, {
    "initial-only": 1,
    "opening-only": 3,
    "opening-and-later": 7,
    "later-only": 79,
  });
  for (const [group, n] of Object.entries(C.source.phaseCounts))
    assert.equal(
      count((c) => c.phaseGroup === group),
      n,
    );
  assert.equal(
    C.source.openingBoundary.firstRightTDoubleLock,
    firstRightTDouble,
  );
  assert.deepEqual(C.source.openingBoundary.openingPostLocks, [1, 16]);
  assert.deepEqual(C.source.openingBoundary.laterPostLocks, [17, 2519]);
  assert.deepEqual(
    reconstructed
      .filter((c) => c.phaseGroup === "opening-only")
      .map((c) => [c.id, c.key, c.postLocks]),
    [
      ["LC-072", "1,0,0,5", [15]],
      ["LC-076", "2,1,0,3", [7]],
      ["LC-081", "4,1,0,1", [11]],
    ],
  );
});
