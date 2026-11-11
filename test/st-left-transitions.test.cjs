"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const C = require("../st-left-contours.js"),
  S = require("../st-structure.js");
const E = require("../scripts/record-st-left-transitions.cjs");
const T = C.transitions,
  source = T.sources[0];
const evidence = E.buildEvidence();
const routes = Object.values(evidence.catalogs).flatMap((group) => [
  ...group.leftOnly,
  ...group.leftCenterCrossing,
]);
const corpus = E.readShocky();

// Small synthetic records exercise extraction policy, not physical placement.
const event = (
  lock,
  before,
  after,
  { region = "left-only", piece = "O", clear = false, x = 0 } = {},
) => ({
  lock,
  piece,
  rotation: "spawn",
  x,
  y: 2,
  cells: [
    [x, 2],
    [x + 1, 2],
    [x, 3],
    [x + 1, 3],
  ],
  region,
  clearedRows: clear ? [0] : [],
  before: { key: before, base: 0, covered: 0 },
  after: { key: after, base: 0, covered: 0 },
});
const syntheticSource = {
  id: "synthetic",
  openingBoundary: { firstLaterLock: 1 },
};
const SS = "0,0,0,2",
  S1 = "0,0,1,1",
  A = "1,1,0,0",
  D = "0,1,1,0",
  unknown = "0,5,6,0";

test("Left transitions: generated payload exactly matches complete pinned source and preserves dependencies", () => {
  assert.deepEqual(T, E.build());
  assert.equal(T.sources.length, 1);
  assert.equal(source.id, "shocky-1000");
  assert.equal(source.placements, 2519);
  assert.equal(source.lines, 1000);
  assert.deepEqual(T.summary.byLength, {
    1: { uniqueRoutes: 39, occurrences: 359 },
    2: { uniqueRoutes: 94, occurrences: 358 },
  });
  assert.deepEqual(T.summary.byPhase, {
    opening: { uniqueRoutes: 3, occurrences: 3 },
    "opening-boundary": { uniqueRoutes: 1, occurrences: 1 },
    later: { uniqueRoutes: 129, occurrences: 713 },
  });
  assert.equal(T.summary.uniqueRoutes, 133);
  assert.equal(T.summary.occurrences, 717);
  assert.deepEqual(T.summary.sameContourCycles, {
    uniqueRoutes: 1,
    occurrences: 3,
  });
  assert.deepEqual(T.summary.ungradedStarts, {
    uniqueRoutes: 74,
    occurrences: 183,
  });
  for (const contour of C.catalog)
    assert.deepEqual(contour.dependencies, {
      status: "unknown",
      alternatives: [],
    });
  const frozen = (value) => {
    if (value && typeof value === "object") {
      assert.ok(Object.isFrozen(value));
      Object.values(value).forEach(frozen);
    }
  };
  frozen(T);
  const stored = Object.values(T.catalogs).flatMap((group) => [
    ...group.leftOnly,
    ...group.leftCenterCrossing,
  ]);
  assert.equal(stored.length, routes.length);
  for (const route of routes) {
    const { occurrences, ...geometry } = route;
    assert.deepEqual(
      stored.find((r) => r.id === route.id),
      { ...geometry, observedCount: occurrences.length },
    );
  }
  function noReferences(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        ![
          "locks",
          "leftBasesBefore",
          "coveredBefore",
          "coveredAfter",
          "ignoredLocks",
          "ignoredClearLocks",
          "unchangedLeftLocks",
          "blockedPairs",
        ].includes(key),
        key,
      );
      if (key === "occurrences") assert.equal(typeof child, "number");
      noReferences(child);
    }
  }
  noReferences(T);
});

test("Left transitions: independent nearest-Left enumeration covers every qualifying source occurrence exactly once", () => {
  const expected = [];
  // Enumerate by source position, scanning backward to the nearest physical
  // Left-touching lock. Never use the extractor's retained predecessor state.
  for (let i = 0; i < corpus.events.length; i++) {
    const e = corpus.events[i];
    if (
      e.region === "outside-left" ||
      e.before.key === e.after.key ||
      !["SS", "S"].includes(
        S.leftSurface.classify(e.after.key.split(",").map(Number))?.tier,
      )
    )
      continue;
    expected.push(String(e.lock));
    let j = i - 1;
    while (
      j >= 0 &&
      corpus.events[j].region === "outside-left" &&
      corpus.events[j].before.key === corpus.events[j].after.key
    )
      j--;
    const prev = corpus.events[j];
    if (
      prev &&
      prev.region !== "outside-left" &&
      prev.before.key !== prev.after.key
    )
      expected.push(`${prev.lock},${e.lock}`);
  }
  const actual = routes.flatMap((r) =>
    r.occurrences.map((o) => o.locks.join(",")),
  );
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(actual.sort(), expected.sort());
  assert.equal(actual.length, 717);
});

test("Left transitions: every unique pose and regenerated occurrence context replays against the exact source", () => {
  const routeKeys = new Set();
  for (const route of routes) {
    assert.equal(route.sourceId, source.id);
    assert.ok([1, 2].includes(route.moves.length));
    assert.ok(["SS", "S"].includes(route.contours.at(-1).knownTier));
    for (const contour of route.contours) {
      const profile = contour.key.split(",").map(Number),
        known = S.leftSurface.classify(profile);
      assert.equal(contour.contourId, C.lookup(profile)?.id ?? null);
      assert.equal(contour.knownTier, known?.tier ?? null);
      assert.equal(contour.knownShape, known?.id ?? null);
    }
    const { id, occurrences, ...geometry } = route;
    assert.equal(routeKeys.has(JSON.stringify(geometry)), false, id);
    routeKeys.add(JSON.stringify(geometry));
    assert.ok(occurrences.length);
    for (const occurrence of occurrences) {
      const steps = occurrence.locks.map((lock) => corpus.events[lock - 1]);
      assert.deepEqual(
        route.contours.map((c) => c.key),
        [steps[0].before.key, ...steps.map((e) => e.after.key)],
      );
      assert.equal(
        route.phase,
        steps.at(-1).lock < 17
          ? "opening"
          : steps[0].lock < 17
            ? "opening-boundary"
            : "later",
      );
      assert.equal(
        route.placementClass,
        steps.some((e) => e.region === "left-center-crossing")
          ? "left-center-crossing"
          : "left-only",
      );
      steps.forEach((e, i) => {
        const move = route.moves[i],
          base = occurrence.leftBasesBefore[i];
        assert.notEqual(e.before.key, e.after.key);
        assert.equal(move.piece, e.piece);
        assert.equal(move.rotation, e.rotation);
        assert.equal(move.x, e.x);
        assert.equal(move.yFromLeftBase + base, e.y);
        assert.deepEqual(
          move.cellsFromLeftBase.map(([x, y]) => [x, y + base]),
          e.cells,
        );
        assert.deepEqual(
          move.clearedRowsFromLeftBase.map((y) => y + base),
          e.clearedRows,
        );
        assert.equal(move.resultBaseDelta, e.after.base - e.before.base);
        assert.equal(base, e.before.base);
        assert.equal(occurrence.coveredBefore[i], e.before.covered);
        assert.equal(occurrence.coveredAfter[i], e.after.covered);
      });
      const ignored =
        steps.length === 1
          ? []
          : corpus.events.slice(steps[0].lock, steps[1].lock - 1);
      assert.deepEqual(
        occurrence.ignoredLocks,
        ignored.map((e) => e.lock),
      );
      assert.deepEqual(
        occurrence.ignoredClearLocks,
        ignored.filter((e) => e.clearedRows.length).map((e) => e.lock),
      );
      for (const e of ignored) {
        assert.equal(e.region, "outside-left");
        assert.equal(e.before.key, e.after.key);
      }
    }
  }
  assert.equal(routeKeys.size, 133);
});

test("Left transitions: outside locks and clears are audited, unchanged Left locks interrupt, phases stay separate", () => {
  const audit = evidence.audits[0];
  assert.equal(audit.inspectedLocks, 2519);
  assert.equal(
    audit.leftOnlyLocks +
      audit.leftCenterCrossingLocks +
      audit.outsideLeftLocks,
    audit.inspectedLocks,
  );
  assert.equal(audit.outsideLeftLocks, 1506);
  assert.equal(audit.outsideClearLocks, 417);
  assert.equal(audit.outsideClearedLines, 1000);
  assert.deepEqual(audit.outsideContourCounterexamples, []);
  assert.deepEqual(audit.unchangedLeftLocks, [1560, 1581]);
  assert.deepEqual(
    evidence.catalogs["opening-boundary"].leftOnly[0].occurrences[0].locks,
    [16, 21],
  );
  assert.equal(T.catalogs.opening.leftCenterCrossing.length, 1);
  const cycles = routes.filter(
    (r) => r.contours[0].key === r.contours.at(-1).key,
  );
  assert.deepEqual(
    cycles[0].occurrences.map((o) => o.locks),
    [
      [228, 229],
      [423, 435],
      [572, 574],
    ],
  );
  assert.deepEqual(
    cycles[0].contours.map((c) => c.knownTier),
    ["S", "A", "S"],
  );
  assert.equal(
    routes.some(
      (r) =>
        r.moves.length === 2 &&
        r.contours[0].knownTier === "S" &&
        r.contours[1].knownTier === "D",
    ),
    true,
  );
});

test("Left transitions: ignore outside locks, retain unrestricted intermediate grades and reject all non-great endpoints", () => {
  const events = [
    event(1, S1, D),
    event(2, D, D, { region: "outside-left", clear: true }),
    event(3, D, SS),
    event(4, SS, unknown),
    event(5, unknown, S1),
  ];
  const result = E.extract(events, syntheticSource);
  const all = result.routes.flatMap((r) => r.occurrences);
  assert.deepEqual(
    all.map((o) => o.locks),
    [[3], [1, 3], [5], [4, 5]],
  );
  assert.deepEqual(all[1].ignoredLocks, [2]);
  assert.deepEqual(all[1].ignoredClearLocks, [2]);
  assert.equal(result.routes[2].contours[0].knownTier, null);
  assert.deepEqual(
    result.routes[1].contours.map((c) => c.knownTier),
    ["S", "D", "SS"],
  );
});

test("Left transitions: unchanged Left and outside contour changes interrupt without hiding later one-piece routes", () => {
  const unchanged = E.extract(
    [event(1, S1, A), event(2, A, A), event(3, A, S1)],
    syntheticSource,
  );
  assert.deepEqual(
    unchanged.routes.flatMap((r) => r.occurrences.map((o) => o.locks)),
    [[3]],
  );
  assert.deepEqual(unchanged.audit.unchangedLeftLocks, [2]);
  const changed = E.extract(
    [
      event(1, S1, A),
      event(2, A, D, { region: "outside-left", clear: true }),
      event(3, D, SS),
    ],
    syntheticSource,
  );
  assert.deepEqual(
    changed.routes.flatMap((r) => r.occurrences.map((o) => o.locks)),
    [[3]],
  );
  assert.equal(changed.audit.outsideContourCounterexamples.length, 1);
  assert.equal(
    changed.audit.blockedPairs[0].reason,
    "outside-left-contour-change",
  );
  assert.equal(E.extract([event(1, SS, SS)], syntheticSource).routes.length, 0);
});

test("Left transitions: dedup keeps normalized geometry, source identity, crossing and covered occurrence contexts distinct", () => {
  const e1 = event(1, A, S1),
    e2 = event(2, S1, A),
    e3 = event(3, A, S1);
  e3.before.covered = 4;
  const repeated = E.extract([e1, e2, e3], syntheticSource).routes.find(
    (r) => r.moves.length === 1,
  );
  assert.equal(repeated.occurrences.length, 2);
  assert.deepEqual(
    repeated.occurrences.map((o) => o.coveredBefore),
    [[0], [4]],
  );
  const different = E.extract(
    [e1, e2, event(3, A, S1, { x: 1 })],
    syntheticSource,
  );
  assert.equal(different.routes.filter((r) => r.moves.length === 1).length, 2);
  const crossing = E.extract(
    [event(1, S1, A, { region: "left-center-crossing" }), event(2, A, SS)],
    syntheticSource,
  );
  assert.equal(crossing.routes[0].placementClass, "left-only");
  assert.equal(crossing.routes[1].placementClass, "left-center-crossing");
  const anotherSource = E.extract([e1], { ...syntheticSource, id: "other" });
  assert.equal(anotherSource.routes[0].sourceId, "other");
});

test("Left transitions: a real supported outside-only clear can expose holes and change normalized contour", () => {
  // Independent counterexample to a universal scalar-clear assumption. A row
  // containing the top cell of column 1 clears and exposes empty space below.
  const codec = vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "tetris-fumen.js"), "utf8"),
    { window: {} },
  )(2);
  const field = codec.Field.create();
  field.set(9, 0, "X");
  field.set(9, 1, "X");
  for (let x = 0; x < 9; x++) field.set(x, 2, "X");
  field.set(1, 1, "X");
  field.set(2, 3, "X");
  field.set(3, 3, "X");
  const op = codec.Mino.from({ type: "I", rotation: "right", x: 9, y: 4 });
  assert.equal(field.canFill(op), true);
  assert.equal(field.canLock(op), true);
  assert.ok(op.positions().every(({ x }) => x >= 4));
  const rows = () =>
    Array.from({ length: 23 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => field.at(x, y)).join(""),
    );
  const before = E.observe(rows());
  field.fill(op);
  field.clearLine();
  const after = E.observe(rows());
  assert.deepEqual(before.heights, [3, 3, 4, 4]);
  assert.deepEqual(after.heights, [0, 2, 3, 3]);
  assert.equal(before.key, S1);
  assert.equal(after.key, "0,2,3,3");
});

test("Left transitions: regeneration preserves the observation-free contour catalog", () => {
  const temporary = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "left-transition-regeneration-"),
  );
  try {
    const root = path.resolve(__dirname, "..");
    for (const file of [
      "st-left-contours.js",
      "st-structure.js",
      "st-rules.js",
      "st-bag.js",
      "tetris-fumen.js",
      source.sourceFile,
      "scripts/record-st-left-transitions.cjs",
    ]) {
      const destination = path.join(temporary, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, file), destination);
    }
    const file = path.join(temporary, "st-left-contours.js"),
      before = fs.readFileSync(file, "utf8"),
      script = path.join(temporary, "scripts/record-st-left-transitions.cjs"),
      run = (mode) =>
        require("node:child_process").execFileSync(
          process.execPath,
          [script, mode],
          {
            cwd: temporary,
            encoding: "utf8",
            timeout: 10000,
          },
        );
    run("--write");
    run("--check");
    const regenerated = require(file);
    assert.deepEqual(regenerated.catalog, C.catalog);
    assert.deepEqual(regenerated.source, C.source);
    assert.deepEqual(regenerated.transitions, T);
    assert.ok(
      regenerated.catalog.every(
        (entry) => !Object.hasOwn(entry, "observations"),
      ),
    );
    const marker = "  // BEGIN RECORDED TRANSITIONS";
    assert.equal(
      fs.readFileSync(file, "utf8").split(marker)[0],
      before.split(marker)[0],
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("Left transitions: external evidence preserves provenance without overwrites or writes inside any worktree", () => {
  const temporary = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "left-transition-evidence-"),
  );
  try {
    const file = path.join(temporary, "evidence.json");
    E.writeEvidence(file);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), evidence);
    const original = fs.readFileSync(file);
    assert.throws(() => E.writeEvidence(file), /EEXIST/);
    assert.deepEqual(fs.readFileSync(file), original);
    assert.throws(
      () => E.writeEvidence(path.join(__dirname, "do-not-write.json")),
      /outside every Git worktree/,
    );
    const other = path.join(temporary, "other-repo");
    fs.mkdirSync(other);
    require("node:child_process").execFileSync("git", [
      "init",
      "--quiet",
      other,
    ]);
    assert.throws(
      () => E.writeEvidence(path.join(other, "do-not-write.json")),
      /outside every Git worktree/,
    );
    const alias = path.join(temporary, "alias");
    fs.symlinkSync(other, alias, "dir");
    assert.throws(
      () => E.writeEvidence(path.join(alias, "do-not-write.json")),
      /outside every Git worktree/,
    );
    assert.equal(fs.existsSync(path.join(other, "do-not-write.json")), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
