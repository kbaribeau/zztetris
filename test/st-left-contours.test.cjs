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
  assert.equal(C.schemaVersion, 2);
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

test("Left contours: records cannot be mutated through lookup", () => {
  function frozen(value) {
    if (!value || typeof value !== "object") return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) frozen(child);
  }
  frozen(C.catalog);
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
  }
});

test("Left contours: compact alternatives preserve every path, repeats, cycles and crossing", () => {
  const all = C.catalog.flatMap((c) =>
    c.dependencies.alternatives.map((a) => ({ c, a })),
  );
  const paths = all.flatMap(({ c, a }) =>
    a.paths.map((p) => ({ start: c.id, pieces: a.pieces.join(""), ...p })),
  );
  assert.equal(
    C.catalog.filter((c) => c.dependencies.status === "known").length,
    57,
  );
  assert.equal(
    C.catalog.filter((c) => c.dependencies.status === "unknown").length,
    33,
  );
  assert.equal(all.length, 126);
  assert.equal(paths.length, 133);
  assert.equal(paths.filter((p) => p.contours.length === 1).length, 39);
  assert.equal(paths.filter((p) => p.contours.length === 2).length, 94);
  assert.equal(paths.filter((p) => p.crossesCenter).length, 1);
  const first = C.catalog[0].dependencies.alternatives;
  assert.deepEqual(first.find((a) => a.pieces.join("") === "OJ").paths, [
    { contours: ["LC-002", "LC-003"], crossesCenter: false },
    { contours: ["LC-002", "LC-006"], crossesCenter: false },
  ]);
  assert.deepEqual(
    paths.filter((p) => p.start === p.contours.at(-1)),
    [
      {
        start: "LC-001",
        pieces: "OO",
        contours: ["LC-002", "LC-001"],
        crossesCenter: false,
      },
    ],
  );
  assert.deepEqual(
    paths.filter((p) => p.crossesCenter),
    [
      {
        start: "LC-090",
        pieces: "L",
        contours: ["LC-001"],
        crossesCenter: true,
      },
    ],
  );
  for (const { c, a } of all) {
    assert.equal(a.order, "ordered");
    for (const p of a.paths) {
      assert.equal(p.contours.length, a.pieces.length);
      assert.ok(
        ["SS", "S"].includes(
          C.catalog.find((c) => c.id === p.contours.at(-1)).knownTier,
        ),
      );
    }
    assert.ok(C.validateDependencies(c.dependencies));
  }
  const serialized = JSON.stringify(C.catalog);
  for (const field of [
    "observations",
    "sourceId",
    "sourceFile",
    "sourceSha256",
    "observedCount",
    "phase",
    "evidence",
    "conditions",
    "rotation",
    "cells",
    "audit",
  ])
    assert.equal(serialized.includes('"' + field + '"'), false, field);
  assert.equal("source" in C, false);
  assert.equal("transitions" in C, false);
});

test("Left contours: dependency validation rejects malformed, empty-known and duplicated alternatives", () => {
  const valid = {
    status: "known",
    alternatives: [
      {
        pieces: ["O", "O"],
        order: "ordered",
        paths: [{ contours: ["LC-002", "LC-001"], crossesCenter: false }],
      },
    ],
  };
  assert.equal(C.validateDependencies(valid), true);
  assert.equal(
    C.validateDependencies({ status: "unknown", alternatives: [] }),
    true,
  );
  for (const value of [
    null,
    {},
    { status: "known", alternatives: [] },
    { status: "unknown", alternatives: valid.alternatives },
    {
      status: "known",
      alternatives: [...valid.alternatives, ...valid.alternatives],
    },
    ...[
      { pieces: ["o"] },
      { pieces: Array(2) },
      { pieces: [] },
      { order: "unordered" },
      { paths: [] },
      { paths: [{ contours: ["LC-001"], crossesCenter: false }] },
      { paths: [{ contours: ["LC-002", "LC-999"], crossesCenter: false }] },
      { paths: [{ contours: ["LC-002", "LC-002"], crossesCenter: false }] },
      { paths: [{ contours: ["LC-002", "LC-001"] }] },
    ].map((patch) => ({
      status: "known",
      alternatives: [{ ...valid.alternatives[0], ...patch }],
    })),
  ])
    assert.equal(C.validateDependencies(value), false, JSON.stringify(value));
});
