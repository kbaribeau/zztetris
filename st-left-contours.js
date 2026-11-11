/* Oriented Left contour dependencies. Numeric path IDs refer to the stable
 * LC-001..LC-090 inventory. Applicability is by normalized contour; actual
 * placement legality and resource admission remain the planner's job. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STLeftContours = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const schemaVersion = 2;
  // [profile, existing shape number, tier, alternatives].
  // Alternative: [ordered pieces, target paths, optional crossing-path indexes].
  const data = [
    [
      [0, 0, 1, 1],
      3,
      "S",
      [
        ["L", [[5]]],
        ["IL", [[38, 5]]],
        ["JO", [[15, 3]]],
        ["LI", [[4, 5]]],
        ["LO", [[5, 6]]],
        [
          "OJ",
          [
            [2, 3],
            [2, 6],
          ],
        ],
        ["OO", [[2, 1]]],
        ["SL", [[9, 6]]],
        ["ZJ", [[66, 6]]],
      ],
    ],
    [
      [1, 1, 0, 0],
      5,
      "A",
      [
        ["J", [[3], [6]]],
        ["O", [[1]]],
        ["IJ", [[17, 3]]],
        ["JI", [[6, 3]]],
        [
          "LO",
          [
            [10, 5],
            [31, 6],
          ],
        ],
        ["OL", [[1, 5]]],
      ],
    ],
    [
      [0, 0, 0, 2],
      1,
      "SS",
      [
        ["L", [[1]]],
        ["IO", [[30, 5]]],
        ["JO", [[16, 1]]],
        ["JS", [[7, 1]]],
        ["OI", [[4, 5]]],
        ["SJ", [[12, 1]]],
      ],
    ],
    [
      [0, 2, 2, 2],
      6,
      "A",
      [
        ["I", [[5]]],
        ["IO", [[5, 6]]],
        [
          "JJ",
          [
            [2, 3],
            [2, 6],
          ],
        ],
        ["JO", [[2, 1]]],
        ["OI", [[70, 6]]],
        ["OJ", [[13, 1]]],
      ],
    ],
    [
      [2, 0, 0, 0],
      2,
      "SS",
      [
        ["O", [[6]]],
        ["IO", [[42, 3]]],
        [
          "JJ",
          [
            [2, 3],
            [2, 6],
          ],
        ],
        ["JO", [[2, 1]]],
        ["LS", [[7, 1]]],
        ["OI", [[6, 3]]],
      ],
    ],
    [
      [2, 2, 2, 0],
      4,
      "S",
      [
        ["I", [[3]]],
        ["L", [[1]]],
        ["IL", [[3, 1]]],
      ],
    ],
    [
      [1, 0, 0, 1],
      8,
      "B",
      [
        ["S", [[1]]],
        ["JO", [[31, 6]]],
        ["LS", [[59, 5]]],
        ["OL", [[9, 6]]],
        ["SL", [[1, 5]]],
      ],
    ],
    [
      [0, 2, 0, 0],
      9,
      "B",
      [
        ["IO", [[10, 5]]],
        ["JL", [[18, 6]]],
        ["OI", [[4, 5]]],
      ],
    ],
    [
      [0, 1, 1, 0],
      12,
      "D",
      [
        ["L", [[6]]],
        ["IJ", [[20, 5]]],
        ["IL", [[25, 3]]],
        ["JI", [[4, 5]]],
        ["LI", [[6, 3]]],
      ],
    ],
    [
      [4, 2, 0, 0],
      null,
      null,
      [
        ["O", [[5]]],
        ["OO", [[5, 6]]],
      ],
    ],
    [[4, 3, 3, 0], null, null, [["IS", [[7, 1]]]]],
    [
      [0, 2, 3, 3],
      null,
      null,
      [
        ["J", [[1]]],
        ["JL", [[1, 5]]],
      ],
    ],
    [
      [0, 2, 4, 4],
      null,
      null,
      [
        ["J", [[1]]],
        ["JL", [[1, 5]]],
      ],
    ],
    [
      [3, 1, 0, 2],
      null,
      null,
      [
        [
          "SJ",
          [
            [2, 3],
            [2, 6],
          ],
        ],
        ["SO", [[2, 1]]],
      ],
    ],
    [[0, 0, 2, 4], null, null, [["O", [[3]]]]],
    [
      [0, 0, 3, 3],
      null,
      null,
      [
        ["O", [[1]]],
        ["OL", [[1, 5]]],
      ],
    ],
    [[1, 1, 0, 4], null, null, [["J", [[3]]]]],
    [
      [3, 3, 0, 0],
      null,
      null,
      [
        ["L", [[6]]],
        ["II", [[79, 1]]],
        [
          "OJ",
          [
            [2, 3],
            [2, 6],
          ],
        ],
      ],
    ],
    [[0, 4, 5, 5], null, null, [["I", [[1]]]]],
    [
      [4, 1, 1, 0],
      null,
      null,
      [
        ["J", [[5]]],
        ["JO", [[5, 6]]],
      ],
    ],
    [[2, 4, 4, 0], null, null, [["II", [[4, 5]]]]],
    [
      [5, 5, 4, 0],
      null,
      null,
      [
        ["IJ", [[2, 3]]],
        ["IO", [[2, 1]]],
        ["JI", [[44, 6]]],
      ],
    ],
    [[0, 3, 2, 1], null, null, []],
    [
      [1, 0, 1, 0],
      null,
      null,
      [
        ["T", [[6]]],
        ["IT", [[55, 3]]],
        ["TL", [[6, 1]]],
      ],
    ],
    [[0, 1, 1, 4], null, null, [["L", [[3]]]]],
    [
      [1, 3, 2, 0],
      null,
      null,
      [
        ["IL", [[61, 5]]],
        ["JJ", [[50, 1]]],
        ["LI", [[4, 5]]],
      ],
    ],
    [[3, 2, 1, 0], null, null, [["ST", [[24, 6]]]]],
    [
      [0, 0, 1, 5],
      null,
      null,
      [
        ["OJ", [[17, 3]]],
        ["SL", [[25, 3]]],
        ["ZJ", [[67, 3]]],
      ],
    ],
    [[0, 1, 0, 1], null, null, [["IT", [[81, 5]]]]],
    [[4, 0, 0, 2], null, null, [["O", [[5]]]]],
    [
      [0, 0, 2, 0],
      7,
      "A",
      [
        ["O", [[6]]],
        ["IO", [[15, 3]]],
        ["OI", [[6, 3]]],
      ],
    ],
    [[0, 1, 2, 3], null, null, []],
    [
      [0, 3, 3, 4],
      null,
      null,
      [
        ["IS", [[7, 1]]],
        ["SI", [[19, 1]]],
      ],
    ],
    [[1, 0, 2, 3], null, null, [["SS", [[7, 1]]]]],
    [
      [4, 4, 0, 2],
      null,
      null,
      [
        ["I", [[6]]],
        ["IL", [[6, 1]]],
        ["JO", [[2, 1]]],
      ],
    ],
    [
      [0, 4, 3, 3],
      null,
      null,
      [
        ["IJ", [[2, 3]]],
        ["IO", [[2, 1]]],
        ["OI", [[19, 1]]],
      ],
    ],
    [[2, 1, 3, 0], null, null, []],
    [
      [4, 0, 1, 1],
      null,
      null,
      [
        ["L", [[5]]],
        ["LO", [[5, 6]]],
      ],
    ],
    [[0, 2, 6, 6], null, null, [["JO", [[16, 1]]]]],
    [[4, 3, 0, 0], null, null, []],
    [[0, 4, 6, 8], null, null, []],
    [[2, 0, 0, 4], null, null, [["O", [[3]]]]],
    [
      [2, 2, 0, 2],
      10,
      "B",
      [
        ["J", [[1]]],
        ["OI", [[35, 6]]],
      ],
    ],
    [[6, 6, 6, 0], null, null, [["I", [[6]]]]],
    [[0, 2, 5, 5], null, null, [["JO", [[16, 1]]]]],
    [[0, 3, 4, 3], null, null, []],
    [[5, 1, 0, 0], null, null, [["SL", [[61, 5]]]]],
    [[0, 1, 3, 2], null, null, []],
    [[0, 1, 5, 4], null, null, []],
    [
      [4, 4, 2, 0],
      null,
      null,
      [
        ["J", [[1]]],
        ["IJ", [[43, 1]]],
      ],
    ],
    [[4, 5, 2, 0], null, null, []],
    [[4, 6, 4, 0], null, null, []],
    [[5, 5, 2, 0], null, null, []],
    [[7, 7, 4, 0], null, null, []],
    [[1, 0, 1, 4], null, null, [["T", [[3]]]]],
    [[1, 0, 3, 3], null, null, []],
    [[1, 0, 3, 7], null, null, []],
    [[3, 5, 4, 0], null, null, []],
    [
      [4, 2, 0, 1],
      null,
      null,
      [
        ["S", [[5]]],
        ["SO", [[5, 6]]],
      ],
    ],
    [[5, 1, 0, 4], null, null, []],
    [
      [5, 3, 2, 0],
      null,
      null,
      [
        ["L", [[5]]],
        ["LO", [[5, 6]]],
      ],
    ],
    [[8, 10, 8, 0], null, null, []],
    [[9, 9, 4, 0], null, null, []],
    [[0, 0, 5, 4], null, null, []],
    [[0, 0, 7, 6], null, null, []],
    [
      [0, 2, 3, 1],
      null,
      null,
      [
        ["J", [[6]]],
        ["JI", [[6, 3]]],
      ],
    ],
    [[0, 2, 3, 5], null, null, [["J", [[3]]]]],
    [[0, 2, 5, 3], null, null, [["JO", [[31, 6]]]]],
    [[0, 3, 3, 0], null, null, []],
    [[0, 4, 4, 2], null, null, [["I", [[6]]]]],
    [[0, 6, 6, 6], null, null, []],
    [[1, 0, 0, 5], null, null, [["JO", [[15, 3]]]]],
    [[1, 0, 5, 5], null, null, []],
    [[1, 2, 3, 0], null, null, []],
    [[2, 0, 2, 2], 11, "C", []],
    [[2, 1, 0, 3], null, null, []],
    [[2, 3, 3, 0], null, null, []],
    [[3, 0, 1, 2], null, null, []],
    [[3, 3, 4, 0], null, null, [["I", [[1]]]]],
    [[4, 0, 3, 3], null, null, [["IJ", [[2, 3]]]]],
    [[4, 1, 0, 1], null, null, [["T", [[5]]]]],
    [[4, 10, 8, 0], null, null, []],
    [[4, 4, 3, 0], null, null, [["JJ", [[2, 3]]]]],
    [[4, 5, 5, 0], null, null, [["LI", [[44, 6]]]]],
    [[4, 7, 7, 0], null, null, []],
    [[5, 0, 0, 1], null, null, [["SL", [[38, 5]]]]],
    [[5, 5, 0, 0], null, null, []],
    [[6, 0, 0, 0], null, null, []],
    [[8, 6, 4, 0], null, null, []],
    [[0, 0, 0, 0], null, null, [["L", [[1]], [0]]]],
  ];
  const id = (n) => "LC-" + String(n).padStart(3, "0");
  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }
  function normalize(heights) {
    if (!Array.isArray(heights) || heights.length !== 4) return null;
    for (let x = 0; x < 4; x++)
      if (!Number.isSafeInteger(heights[x]) || heights[x] < 0) return null;
    const base = Math.min(...heights);
    return heights.map((h) => h - base);
  }
  function key(heights) {
    const profile = normalize(heights);
    return profile ? profile.join(",") : null;
  }
  const pieceType = (p) => typeof p === "string" && /^[IJLOSTZ]$/.test(p);
  const catalog = data.map(([profile, shape, tier, alternatives], i) => ({
    id: id(i + 1),
    key: profile.join(","),
    profile,
    knownShape: shape === null ? null : "shocky-left-" + shape,
    knownTier: tier,
    dependencies: {
      status: alternatives.length ? "known" : "unknown",
      alternatives: alternatives.map(([sequence, paths, crossing = []]) => ({
        pieces: [...sequence],
        order: "ordered",
        paths: paths.map((targets, i) => ({
          contours: targets.map(id),
          crossesCenter: crossing.includes(i),
        })),
      })),
    },
  }));
  const byId = new Map(catalog.map((c) => [c.id, c]));
  function validateDependencies(value) {
    if (!value || !Array.isArray(value.alternatives)) return false;
    if (value.status === "unknown") return value.alternatives.length === 0;
    if (value.status !== "known" || !value.alternatives.length) return false;
    const seen = new Set();
    for (const a of value.alternatives) {
      if (
        !a ||
        a.order !== "ordered" ||
        !Array.isArray(a.pieces) ||
        !a.pieces.length ||
        !Array.from(a.pieces).every(pieceType) ||
        !Array.isArray(a.paths) ||
        !a.paths.length
      )
        return false;
      const sequence = a.pieces.join("");
      if (seen.has(sequence)) return false;
      seen.add(sequence);
      const paths = new Set();
      for (const p of a.paths) {
        if (
          !p ||
          typeof p.crossesCenter !== "boolean" ||
          !Array.isArray(p.contours) ||
          p.contours.length !== a.pieces.length ||
          !Array.from(p.contours).every((c) => byId.has(c))
        )
          return false;
        const end = byId.get(p.contours.at(-1));
        if (!["SS", "S"].includes(end.knownTier)) return false;
        const path = JSON.stringify([p.contours, p.crossesCenter]);
        if (paths.has(path)) return false;
        paths.add(path);
      }
    }
    return true;
  }
  const byKey = new Map();
  for (const c of catalog) {
    if (
      key(c.profile) !== c.key ||
      Math.min(...c.profile) !== 0 ||
      byKey.has(c.key) ||
      !validateDependencies(c.dependencies)
    )
      throw Error("Invalid Left contour: " + c.id);
    byKey.set(c.key, deepFreeze(c));
  }
  function lookup(heights) {
    const k = key(heights);
    return k === null ? null : byKey.get(k) || null;
  }
  // Necessary finite piece-flow feasibility only. Skipped locks are explicitly
  // returned, not certified placements. No bag guesses or unseen pieces enter.
  function schedule(
    pieces,
    supply,
    {
      canUse = () => true,
      allowHold = true,
      unlimitedHold = false,
      allowIntervening = false,
    } = {},
  ) {
    if (
      !Array.isArray(pieces) ||
      !pieces.length ||
      !Array.from(pieces).every(pieceType) ||
      !supply ||
      !Array.isArray(supply.queue) ||
      supply.queue.length > 14
    )
      return null;
    const token = (p, slot) => {
      if (p === null || p === undefined) return null;
      const type = typeof p === "string" ? p : p.type;
      if (!pieceType(type)) throw Error("Invalid public piece");
      return { type, id: typeof p === "object" ? (p.id ?? null) : null, slot };
    };
    let initial;
    try {
      initial = {
        a: token(supply.active, "active"),
        h: token(supply.hold, "hold"),
        q: Array.from(supply.queue, (p, i) => token(p, "queue-" + i)),
        canHold: supply.canHold !== false,
        index: 0,
        steps: [],
      };
    } catch {
      return null;
    }
    if (initial.q.some((p) => !p)) return null;
    const todo = [initial],
      seen = new Set();
    for (let i = 0; i < todo.length; i++) {
      const n = todo[i];
      if (n.index === pieces.length) return n.steps;
      if (!n.a) continue;
      const k = JSON.stringify([
        n.a.slot,
        n.h?.slot,
        n.q.map((p) => p.slot),
        n.canHold,
        n.index,
        n.steps.filter((s) => s.dependency).map((s) => s.piece.slot),
      ]);
      if (seen.has(k)) continue;
      seen.add(k);
      let choice = n;
      for (let holds = 0; holds <= 2; holds++) {
        const matched =
          choice.a.type === pieces[n.index] &&
          canUse(choice.a, n.index, n.steps);
        const next = {
          a: choice.q[0] || null,
          h: choice.h,
          q: choice.q.slice(1),
          canHold: true,
        };
        if (matched)
          todo.push({
            ...next,
            index: n.index + 1,
            steps: [...n.steps, { piece: choice.a, holds, dependency: true }],
          });
        if (allowIntervening)
          todo.push({
            ...next,
            index: n.index,
            steps: [...n.steps, { piece: choice.a, holds, dependency: false }],
          });
        if (!allowHold || (!unlimitedHold && !choice.canHold)) break;
        if (choice.h)
          choice = {
            ...choice,
            a: choice.h,
            h: choice.a,
            canHold: unlimitedHold,
          };
        else if (choice.q.length)
          choice = {
            ...choice,
            a: choice.q[0],
            h: choice.a,
            q: choice.q.slice(1),
            canHold: unlimitedHold,
          };
        else break;
      }
    }
    return null;
  }
  function candidates(heights, supply, options = {}) {
    const contour = lookup(heights);
    if (!contour)
      return { status: "unlisted", contour: null, alternatives: [] };
    const alternatives = [];
    for (const alternative of contour.dependencies.alternatives) {
      const paths = alternative.paths.filter(
        (p) => options.allowCrossing === true || !p.crossesCenter,
      );
      if (!paths.length) continue;
      const steps = schedule(alternative.pieces, supply, options);
      if (steps)
        alternatives.push({
          pieces: alternative.pieces,
          paths,
          steps,
          executionVerified: false,
        });
    }
    return {
      status: contour.dependencies.status,
      contour: contour.id,
      alternatives,
    };
  }
  return Object.freeze({
    schemaVersion,
    catalog: Object.freeze(catalog),
    normalize,
    key,
    lookup,
    validateDependencies,
    schedule,
    candidates,
  });
});
