#!/usr/bin/env node
"use strict";
// Offline observations, never a planner input or universal dependency claim.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const C = require("../st-left-contours.js");
const S = require("../st-structure.js");
const root = path.resolve(__dirname, "..");
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isGreat = (key) =>
  ["SS", "S"].includes(
    S.leftSurface.classify(key.split(",").map(Number))?.tier,
  );
const markers = [
  "  // BEGIN RECORDED TRANSITIONS",
  "  // END RECORDED TRANSITIONS",
];

function observe(rows) {
  const heights = [0, 0, 0, 0];
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < 4; x++) if (rows[y][x] !== "_") heights[x] = y + 1;
  const base = Math.min(...heights);
  let covered = 0;
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < heights[x]; y++) if (rows[y][x] === "_") covered++;
  return {
    key: heights.map((h) => h - base).join(","),
    base,
    covered,
    heights,
  };
}

function readShocky() {
  const file = "references/st-stacking/jstris-26536180.fumen";
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(
    digest(bytes),
    C.source.sourceSha256,
    "Unexpected Shocky source bytes",
  );
  const codec = vm.runInNewContext(
    fs.readFileSync(path.join(root, "tetris-fumen.js"), "utf8"),
    { window: {} },
  )(2);
  const pages = codec.decoder.decode(bytes.toString().trim());
  const rows = (field) =>
    Array.from({ length: 23 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => field.at(x, y)).join(""),
    );
  const events = [];
  let prior = null,
    lines = 0,
    openingBoundary = null;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i],
      op = p.operation,
      before = rows(p.field),
      lock = i + 1;
    assert.ok(op, `Missing operation at ${lock}`);
    assert.equal(p.flags.lock, true);
    assert.equal(p.flags.mirror, false);
    assert.equal(p.flags.rise, false);
    if (prior)
      assert.deepEqual(before, prior, `Disconnected source at ${lock}`);
    else assert.ok(before.every((row) => row === "__________"));
    assert.equal(p.field.canFill(op), true, `Overlap at ${lock}`);
    assert.equal(p.field.canLock(op), true, `Unsupported lock at ${lock}`);
    // Explicit placement and row removal, independently compared with the codec.
    const cells = Array.from(op.positions(), ({ x, y }) => [x, y]).sort(
      (a, b) => a[1] - b[1] || a[0] - b[0],
    );
    const placed = before.map((row) => row.split(""));
    for (const [x, y] of cells) {
      assert.ok(x >= 0 && x < 10 && y >= 0 && y < 23);
      assert.equal(placed[y][x], "_");
      placed[y][x] = op.type;
    }
    const clearedRows = placed.flatMap((row, y) =>
      row.every((cell) => cell !== "_") ? [y] : [],
    );
    const after = placed
      .filter((_, y) => !clearedRows.includes(y))
      .map((row) => row.join(""));
    while (after.length < 23) after.push("__________");
    const checked = p.field.copy();
    checked.fill(op);
    checked.clearLine();
    assert.deepEqual(rows(checked), after, `Clear mismatch at ${lock}`);
    lines += clearedRows.length;
    assert.equal(
      after.join("").replaceAll("_", "").length,
      4 * lock - 10 * lines,
    );
    if (
      openingBoundary === null &&
      op.type === "T" &&
      clearedRows.length === 2 &&
      cells.every(([x]) => x >= 6)
    )
      openingBoundary = lock;
    const region = cells.every(([x]) => x < 4)
      ? "left-only"
      : cells.some(([x]) => x < 4)
        ? "left-center-crossing"
        : "outside-left";
    events.push({
      lock,
      piece: op.type,
      rotation: op.rotation,
      x: op.x,
      y: op.y,
      cells,
      region,
      clearedRows,
      before: observe(before),
      after: observe(after),
    });
    prior = after;
  }
  assert.equal(events.length, 2519);
  assert.equal(lines, 1000);
  assert.equal(openingBoundary, 17);
  return {
    source: {
      id: "shocky-1000",
      player: "Supershocky",
      title: "Sprint 1000L",
      sourceFile: file,
      sourceSha256: digest(bytes),
      sourceUrl: C.source.sourceUrl,
      status: "complete-recorded-placement-corpus",
      placements: events.length,
      lines,
      openingBoundary: {
        firstLaterLock: openingBoundary,
        basis:
          "First recorded right-side T two-line clear, as in the original contour catalog; not an engine phase or verified spin classification.",
      },
      limits: [
        "Converted Fumen; native input stream and hold/queue metadata not independently verified.",
        "Observed lock poses and full-board line clears, not input paths or universal reachability.",
        "Source lock numbers are one-based Fumen pages; the final page is a placement, not a post-clear snapshot.",
      ],
    },
    events,
  };
}

function descriptor(key) {
  const profile = key.split(",").map(Number),
    entry = C.lookup(profile),
    known = S.leftSurface.classify(profile);
  return {
    key,
    contourId: entry?.id ?? null,
    knownShape: known?.id ?? null,
    knownTier: known?.tier ?? null,
  };
}
function move(event) {
  return {
    piece: event.piece,
    rotation: event.rotation,
    x: event.x,
    yFromLeftBase: event.y - event.before.base,
    cellsFromLeftBase: event.cells.map(([x, y]) => [x, y - event.before.base]),
    clearedRowsFromLeftBase: event.clearedRows.map(
      (y) => y - event.before.base,
    ),
    resultBaseDelta: event.after.base - event.before.base,
  };
}

function extract(events, source) {
  const groups = new Map(),
    outsideCounterexamples = [],
    unchangedLeftLocks = [],
    blockedPairs = [];
  let priorLeft = null,
    outside = [],
    outsideLocks = 0,
    outsideClearLocks = 0,
    outsideClearedLines = 0;
  const add = (steps, ignored) => {
    const first = steps[0],
      last = steps.at(-1),
      boundary = source.openingBoundary.firstLaterLock;
    const phase =
      last.lock < boundary
        ? "opening"
        : first.lock < boundary
          ? "opening-boundary"
          : "later";
    const placementClass = steps.some(
      (e) => e.region === "left-center-crossing",
    )
      ? "left-center-crossing"
      : "left-only";
    const route = {
      sourceId: source.id,
      phase,
      placementClass,
      contours: [
        descriptor(first.before.key),
        ...steps.map((e) => descriptor(e.after.key)),
      ],
      moves: steps.map(move),
    };
    // Include source, phase, every intermediate contour and exact normalized
    // pose/clear geometry. Piece names alone must never merge different routes.
    const key = JSON.stringify(route);
    if (!groups.has(key)) groups.set(key, { ...route, occurrences: [] });
    groups.get(key).occurrences.push({
      locks: steps.map((e) => e.lock),
      leftBasesBefore: steps.map((e) => e.before.base),
      coveredBefore: steps.map((e) => e.before.covered),
      coveredAfter: steps.map((e) => e.after.covered),
      ignoredLocks: ignored.map((e) => e.lock),
      ignoredClearLocks: ignored
        .filter((e) => e.clearedRows.length)
        .map((e) => e.lock),
    });
  };
  for (const event of events) {
    if (event.region === "outside-left") {
      outsideLocks++;
      if (event.clearedRows.length) {
        outsideClearLocks++;
        outsideClearedLines += event.clearedRows.length;
      }
      if (event.before.key !== event.after.key) {
        outsideCounterexamples.push({
          lock: event.lock,
          piece: event.piece,
          before: event.before,
          after: event.after,
          clearedRows: event.clearedRows,
        });
        if (priorLeft)
          blockedPairs.push({
            firstLock: priorLeft.lock,
            interruptionLock: event.lock,
            reason: "outside-left-contour-change",
          });
        priorLeft = null;
        outside = [];
      } else if (priorLeft) outside.push(event);
      continue;
    }
    if (event.before.key === event.after.key) {
      unchangedLeftLocks.push(event.lock);
      if (priorLeft)
        blockedPairs.push({
          firstLock: priorLeft.lock,
          interruptionLock: event.lock,
          reason: "unchanged-left-placement",
        });
      priorLeft = null;
      outside = [];
      continue;
    }
    if (isGreat(event.after.key)) {
      add([event], []);
      if (priorLeft) {
        assert.equal(
          priorLeft.after.key,
          event.before.key,
          "A contour-changing interruption cannot be ignored",
        );
        add([priorLeft, event], outside);
      }
    }
    // The intermediate tier is unrestricted, including unknown and C/D.
    priorLeft = event;
    outside = [];
  }
  return {
    routes: [...groups.values()],
    audit: {
      sourceId: source.id,
      inspectedLocks: events.length,
      leftOnlyLocks: events.filter((e) => e.region === "left-only").length,
      leftCenterCrossingLocks: events.filter(
        (e) => e.region === "left-center-crossing",
      ).length,
      outsideLeftLocks: outsideLocks,
      outsideClearLocks,
      outsideClearedLines,
      outsideContourCounterexamples: outsideCounterexamples,
      unchangedLeftLocks,
      blockedPairs,
    },
  };
}
function summarize(routes) {
  const occurrences = (items) =>
    items.reduce((n, r) => n + r.occurrences.length, 0);
  const count = (items) => ({
    uniqueRoutes: items.length,
    occurrences: occurrences(items),
  });
  return {
    ...count(routes),
    byPhase: Object.fromEntries(
      ["opening", "opening-boundary", "later"].map((p) => [
        p,
        count(routes.filter((r) => r.phase === p)),
      ]),
    ),
    byPlacementClass: Object.fromEntries(
      ["left-only", "left-center-crossing"].map((p) => [
        p,
        count(routes.filter((r) => r.placementClass === p)),
      ]),
    ),
    byLength: Object.fromEntries(
      [1, 2].map((n) => [n, count(routes.filter((r) => r.moves.length === n))]),
    ),
    sameContourCycles: count(
      routes.filter((r) => r.contours[0].key === r.contours.at(-1).key),
    ),
    ungradedStarts: count(
      routes.filter((r) => r.contours[0].knownTier === null),
    ),
    greatViaKnownCDToGreat: count(
      routes.filter(
        (r) =>
          r.moves.length === 2 &&
          ["SS", "S"].includes(r.contours[0].knownTier) &&
          ["C", "D"].includes(r.contours[1].knownTier),
      ),
    ),
  };
}
function buildEvidence() {
  const shocky = readShocky(),
    extracted = extract(shocky.events, shocky.source);
  const routes = extracted.routes.map((route, i) => ({
    id: "LCT-" + String(i + 1).padStart(3, "0"),
    ...route,
  }));
  return {
    schemaVersion: 1,
    scope:
      "Source-specific observed routes; no universal dependency, strategic safety, piece-availability or continuation claim.",
    policy: {
      targetTiers: ["SS", "S"],
      startTiers: "Any known tier or explicitly ungraded contour",
      leftColumnsZeroBased: [0, 1, 2, 3],
      placementCount: [1, 2],
      sequence:
        "Consecutive contour-changing Left-touching placements; an unchanged Left placement interrupts rather than being counted or skipped.",
      ignored:
        "Only intervening outside-Left placements whose normalized contour is verified unchanged; all full-board effects remain in source replay.",
      crossing:
        "Any piece with cells both in Left and beyond column 4 belongs to the separate left-center-crossing class, including mixed two-piece routes.",
      cycles:
        "Two changes may return to the exact starting contour; unchanged single-piece loops are excluded.",
      phase:
        "Opening and later catalogs use each source's first right-side T double boundary; straddling routes have a separate opening-boundary catalog.",
      coordinates:
        "Fumen x is zero-based from the left, y is zero-based upward from the floor. Move y/cell/clear rows are relative to the Left minimum immediately before that move; optional external evidence supplies each occurrence's leftBasesBefore to recover absolute poses.",
      context:
        "The runtime catalog stores unique routes and aggregate counts only. Optional external evidence regenerates exact source locks, per-occurrence bases, covered counts and ignored locks from the pinned full-board recording. The skyline alone is not sufficient.",
      deduplication:
        "Within one source and phase/class, identical ordered contour path and normalized pose/cell/clear geometry share a route. Covered variants and exact boards remain occurrence-specific in optional external evidence. Routes from different sources never merge.",
      tiers:
        "Only STStructure.leftSurface's existing oriented catalog is used; null means ungraded, not bad. No intermediate tier restriction.",
    },
    sources: [shocky.source],
    audits: [extracted.audit],
    summary: summarize(routes),
    catalogs: Object.fromEntries(
      ["opening", "opening-boundary", "later"].map((phase) => [
        phase,
        {
          leftOnly: routes.filter(
            (r) => r.phase === phase && r.placementClass === "left-only",
          ),
          leftCenterCrossing: routes.filter(
            (r) =>
              r.phase === phase && r.placementClass === "left-center-crossing",
          ),
        },
      ]),
    ),
  };
}
function build() {
  const evidence = buildEvidence();
  return {
    ...evidence,
    audits: evidence.audits.map(
      ({
        outsideContourCounterexamples,
        unchangedLeftLocks,
        blockedPairs,
        ...audit
      }) => ({
        ...audit,
        outsideContourCounterexampleCount: outsideContourCounterexamples.length,
        unchangedLeftCount: unchangedLeftLocks.length,
        blockedPairCount: blockedPairs.length,
      }),
    ),
    catalogs: Object.fromEntries(
      Object.entries(evidence.catalogs).map(([phase, groups]) => [
        phase,
        Object.fromEntries(
          Object.entries(groups).map(([kind, routes]) => [
            kind,
            routes.map(({ occurrences, ...route }) => ({
              ...route,
              observedCount: occurrences.length,
            })),
          ]),
        ),
      ]),
    ),
  };
}
function writeEvidence(destination) {
  const file = path.resolve(destination),
    parent = fs.realpathSync(path.dirname(file));
  // Resolve symlinks first and check any repository, not just this worktree.
  let inside;
  try {
    inside = execFileSync(
      "git",
      ["-C", parent, "rev-parse", "--is-inside-work-tree"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (error) {
    if (!String(error.stderr).includes("not a git repository")) throw error;
  }
  assert.notEqual(
    inside,
    "true",
    "Keep research evidence outside every Git worktree",
  );
  fs.writeFileSync(file, JSON.stringify(buildEvidence(), null, 2) + "\n", {
    flag: "wx",
  });
}
function main(args = process.argv.slice(2)) {
  assert.ok(
    [1, 3].includes(args.length) &&
      ["--write", "--check"].includes(args[0]) &&
      (args.length === 1 || args[1] === "--evidence"),
    "Use --write or --check, optionally followed by --evidence NEW_FILE_OUTSIDE_REPO",
  );
  const result = build(),
    file = path.join(root, "st-left-contours.js");
  if (args[0] === "--write") {
    const text = fs.readFileSync(file, "utf8"),
      start = text.indexOf(markers[0]),
      end = text.indexOf(markers[1]);
    assert.ok(
      start >= 0 && end > start,
      "Missing or out-of-order generated markers",
    );
    fs.writeFileSync(
      file,
      text.slice(0, start) +
        markers[0] +
        "\n  const transitions = " +
        JSON.stringify(result, null, 2) +
        ";\n" +
        text.slice(end),
    );
  } else
    assert.deepEqual(
      C.transitions,
      result,
      "Stored transition catalog is stale",
    );
  if (args.length === 3) writeEvidence(args[2]);
  console.log(
    JSON.stringify(
      {
        ...result.summary,
        sourceCoverage: result.sources.map(({ id, status, placements }) => ({
          id,
          status,
          placements,
        })),
        fileBytes: fs.statSync(file).size,
        compactTransitionJsonBytes: Buffer.byteLength(JSON.stringify(result)),
      },
      null,
      2,
    ),
  );
}
if (require.main === module) main();
module.exports = {
  observe,
  readShocky,
  descriptor,
  move,
  extract,
  summarize,
  buildEvidence,
  writeEvidence,
  build,
};
