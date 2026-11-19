'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const P = require('../st-planner'),
  R = require('../st-rules'),
  S = require('../st-structure');
const initial = require('./support/st-user-clean-center.json');
function replay(steps) {
  let state = P.observe(initial),
    phase = S.notchPattern(state.board);
  for (const step of steps) {
    const r = R.replay(state, step.witness);
    assert.ok(r.valid);
    assert.equal(r.events.length, 1);
    assert.ok(S.canonicalClear(r.events[0]));
    const n = S.advanceNotches(
      state.board,
      { event: r.events[0], state: r.state },
      phase,
    );
    assert.ok(n.valid);
    phase = n.pattern;
    state = r.state;
  }
  return { state, phase };
}
test('3A does not preserve a clean center at the cost of a newly inaccessible left cell', () => {
  const A = require('../st-access'),
    advice = P.plan(initial, { maxNodes: 45000 });
  assert.equal(
    advice.target,
    null,
    'Unknown Extra Z cannot be spent to rescue this imported Center',
  );
  assert.equal(advice.status, 'no-supported-continuation-found');
  const old = R.placements(initial).placements.find(
    (p) =>
      p.target.type === 'Z' &&
      p.target.x === 1 &&
      p.target.y === 25 &&
      p.target.rotation === 0,
  );
  assert.ok(old);
  const bad = A.check(initial, old);
  assert.equal(bad.reachable, false);
  assert.deepEqual(bad.unreachable, [[1, 27]]);
  // The earlier exact winner was our inference, not a recorded reference move.
  // Center cleanliness cannot justify a movement-inaccessible Left vacancy.
  assert.notDeepEqual(advice.target, old.target);
  const M = require('../st-obligation-resources');
  assert.equal(
    M.checkPath(initial, [old], M.startUnknown(initial)).reason,
    'extra-Z-not-available',
  );
});
test('3A old crossing Z remains legal but has an unresolved endpoint, not a forbidden move', () => {
  const z = R.placements(initial).placements.find(
    (p) =>
      p.target.type === 'Z' &&
      p.target.x === 3 &&
      p.target.y === 24 &&
      p.target.rotation === 1,
  );
  assert.ok(z);
  const phase = S.advanceNotches(initial.board, z);
  assert.ok(phase.valid);
  assert.equal(S.transition(initial, z).cycleViolations.length, 0);
  assert.equal(
    S.geometry(z.state.board, { notches: phase.pattern }).center.status,
    'unrecognized',
  );
  assert.equal(
    S.geometry(initial.board).center.status,
    'supported-partner-completion',
  );
});
test('center continuity distinguishes witnessed disruption, clear-only change, and unknown imported history', () => {
  const good = {
      status: 'supported-partner-completion',
      patternSupport: 'reference-supported',
    },
    unknown = { status: 'unrecognized', patternSupport: 'unrecognized' },
    flatUnknown = { status: 'level', patternSupport: 'unrecognized' };
  assert.equal(P.centerContinuityStep(good, unknown, { lines: 0 }), true);
  assert.equal(P.centerContinuityStep(good, unknown, { lines: 2 }), false);
  assert.equal(
    P.centerContinuityStep(unknown, flatUnknown, { lines: 2 }, true),
    true,
    'flat skyline alone does not certify restoration',
  );
  assert.equal(
    P.centerContinuityStep(unknown, unknown, { lines: 0 }),
    false,
    'imported unknown geometry does not invent prior disruption',
  );
  assert.equal(
    P.centerContinuityStep(unknown, good, { lines: 0 }, true),
    false,
  );
});
test('reference J/Z and clear-then-repair constructions remain legal and discharge temporary continuity debt', () => {
  const fs = require('fs'),
    vm = require('vm'),
    codec = vm.runInNewContext(
      fs.readFileSync(require.resolve('../tetris-fumen.js'), 'utf8'),
      { window: {} },
    )(2);
  const pages = codec.decoder.decode(
    fs
      .readFileSync(
        require.resolve('../references/st-stacking/jstris-26536180.fumen'),
        'utf8',
      )
      .trim(),
  );
  const board = (p) =>
    Array.from({ length: 40 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) =>
        y < 17 ? '.' : p.field.at(x, 39 - y).replace('_', '.'),
      ).join(''),
    );
  const key = (c) =>
    c
      .map((x) => x.join(','))
      .sort()
      .join(';');
  for (const [first, last] of [
    [369, 370],
    [346, 348],
  ]) {
    let b = board(pages[first - 1]),
      phase = S.notchPattern(b),
      debt = false;
    const trace = [];
    for (let page = first; page <= last; page++) {
      const source = pages[page - 1],
        cells = source.operation.positions().map(({ x, y }) => [x, 39 - y]),
        s = R.createState({
          board: b,
          active: source.operation.type,
          canHold: false,
        });
      const p = R.placements(s, { allowHold: false }).placements.find(
        (p) => key(p.event.cells) === key(cells) && S.canonicalClear(p.event),
      );
      assert.ok(p, 'source placement has an actual canonical witness');
      const n = S.advanceNotches(b, p, phase);
      assert.ok(n.valid);
      const before = S.geometry(b, { notches: phase }).center,
        after = S.geometry(p.state.board, { notches: n.pattern }).center;
      debt = P.centerContinuityStep(before, after, p.event, debt);
      trace.push({ debt, lines: p.event.lines });
      b = p.state.board;
      phase = n.pattern;
    }
    assert.equal(
      debt,
      false,
      'the actual reference endpoint repays temporary construction',
    );
    if (first === 346)
      assert.equal(
        trace[0].debt,
        false,
        'a clear alone must not invent disruption',
      );
  }
});
test('a shallow recognized motif does not repay a deep unresolved column beneath it', () => {
  const good = {
      status: 'level',
      patternSupport: 'reference-supported',
      profile: [8, 8, 8],
    },
    falsePartner = {
      status: 'supported-partner-completion',
      patternSupport: 'reference-supported',
      profile: [12, 10, 6],
    };
  assert.equal(P.centerContinuityStep(good, falsePartner, { lines: 0 }), true);
  const legitimateZJ = { ...falsePartner, profile: [4, 6, 7] };
  assert.equal(
    P.centerContinuityStep(falsePartner, legitimateZJ, { lines: 0 }, true),
    false,
  );
});

// Minimized native current context and the saved three-lock crossing from the
// player-reviewed session. No hidden tail or historical transcript is needed.
const regionReview = {
  position: {
    rules: 'st-zero-v2',
    board: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      'OO........',
      'OOJJLLL...',
      'LLJJLSS...',
      'ILJJSS....',
      'ILJJLLL...',
      'IOOJLSS...',
      'IOOJSS....',
      'OOJJLLL...',
      'OOSSLSS...',
      'IJJJLOO.Z.',
      'IJJJLSS.Z.',
      'OOOOLSS.Z.',
    ],
    active: { type: 'J', x: 2, y: 17, rotation: 0, lastRotation: null },
    hold: 'I',
    canHold: true,
    queue: ['S', 'I', 'T', 'Z', 'O', 'L'],
    revision: 2171,
    streamCursor: 247,
    topOut: false,
    bag: { remaining: [123], observedCount: 253, provenance: 'known-phase' },
  },
  obligationContext: {
    schemaVersion: 1,
    status: 'available',
    reason: null,
    inventory: {
      schemaVersion: 1,
      status: 'available',
      originKnown: true,
      nextId: 254,
      streamCursor: 247,
      active: { id: 247, type: 'J', observedOrder: 246, bag: 35 },
      hold: { id: 245, type: 'I', observedOrder: 244, bag: 34 },
      queue: [
        { id: 248, type: 'S', observedOrder: 247, bag: 35 },
        { id: 249, type: 'I', observedOrder: 248, bag: 35 },
        { id: 250, type: 'T', observedOrder: 249, bag: 35 },
        { id: 251, type: 'Z', observedOrder: 250, bag: 35 },
        { id: 252, type: 'O', observedOrder: 251, bag: 35 },
        { id: 253, type: 'L', observedOrder: 252, bag: 36 },
      ],
      frontier: { bag: 36, seenMask: 4 },
      knowledge: {
        remaining: [123],
        observedCount: 253,
        provenance: 'known-phase',
      },
    },
    state: {
      schemaVersion: 2,
      availability: 'known',
      center: { pending: [], debt: [] },
      sl: {
        schemaVersion: 1,
        status: 'known',
        foundationOpen: false,
        firstBagReview: 'reviewed',
        handoff: true,
        residuals: [
          {
            bag: 35,
            S: null,
            L: {
              id: 246,
              region: 'center',
              opening: false,
              pair: 'foreign',
              nonRight: true,
            },
            order: null,
            sOwedSinceL: false,
            lBeforeSPair: false,
          },
        ],
        uncertainty: { S: [0, 0, 0, 0], L: [0] },
      },
      account: {
        schemaVersion: 1,
        known: true,
        firstTsd: true,
        allocationVerified: true,
        mandatoryZ: false,
        thirdTWindow: false,
        qualityCandidate: false,
        opening: null,
        profile: {
          violation: false,
          departure: false,
          before: null,
          capEstablished: true,
        },
        z: { remaining: 0, uncredited: 'none' },
        reset: { status: 'inactive' },
      },
      safety: {
        notches: {
          version: 2,
          status: 'established',
          anchorRow: 34,
          blockedRows: [],
          source: 'recognized-next-Z-cap',
        },
        coveredCells: [],
      },
      dPending: false,
      leftGoals: [],
    },
    boundary: { firstBagLocks: 7, sourcePatternSeen: true },
  },
  patternHistory: {
    version: 2,
    status: 'established',
    anchorRow: 34,
    blockedRows: [],
    source: 'recognized-next-Z-cap',
  },
  previous: {
    status: 'recommended-with-verified-prefix',
    revision: 2171,
    target: { type: 'J', x: 2, y: 26, rotation: 0 },
    hold: false,
    holdCount: 0,
    witness: ['HD'],
    reason:
      'Place here without clearing a line. At the end of this sequence, the Well (column 8) stays below the Left and Center stacks.',
    context:
      '["st-zero-v2",["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","OO........","OOJJLLL...","LLJJLSS...","ILJJSS....","ILJJLLL...","IOOJLSS...","IOOJSS....","OOJJLLL...","OOSSLSS...","IJJJLOO.Z.","IJJJLSS.Z.","OOOOLSS.Z."],"I",true,["S","I","T","Z","O","L"],{"remaining":[123],"observedCount":253,"provenance":"known-phase"},"J"]',
    continuation: [
      {
        target: { type: 'J', x: 2, y: 26, rotation: 0 },
        hold: false,
        holdCount: 0,
        witness: ['HD'],
        event: {
          type: 'J',
          target: { type: 'J', x: 2, y: 26, rotation: 0 },
          cells: [
            [2, 27],
            [2, 28],
            [3, 28],
            [4, 28],
          ],
          lines: 0,
          clearedRows: [],
          spin: 'none',
          topOut: false,
        },
        resultContext:
          '["st-zero-v2",["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..J.......","OOJJJ.....","OOJJLLL...","LLJJLSS...","ILJJSS....","ILJJLLL...","IOOJLSS...","IOOJSS....","OOJJLLL...","OOSSLSS...","IJJJLOO.Z.","IJJJLSS.Z.","OOOOLSS.Z."],"I",true,["I","T","Z","O","L"],{"remaining":[123],"observedCount":253,"provenance":"known-phase"},"S"]',
      },
      {
        target: { type: 'S', x: 0, y: 25, rotation: 0 },
        hold: false,
        holdCount: 0,
        witness: ['L', 'L', 'L', 'HD'],
        event: {
          type: 'S',
          target: { type: 'S', x: 0, y: 25, rotation: 0 },
          cells: [
            [1, 26],
            [2, 26],
            [0, 27],
            [1, 27],
          ],
          lines: 0,
          clearedRows: [],
          spin: 'none',
          topOut: false,
        },
        resultContext:
          '["st-zero-v2",["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........",".SS.......","SSJ.......","OOJJJ.....","OOJJLLL...","LLJJLSS...","ILJJSS....","ILJJLLL...","IOOJLSS...","IOOJSS....","OOJJLLL...","OOSSLSS...","IJJJLOO.Z.","IJJJLSS.Z.","OOOOLSS.Z."],"I",true,["T","Z","O","L"],{"remaining":[123],"observedCount":253,"provenance":"known-phase"},"I"]',
      },
      {
        target: { type: 'I', x: 7, y: 36, rotation: 1 },
        hold: false,
        holdCount: 0,
        witness: ['R', 'R', 'R', 'CW', 'R', 'HD'],
        event: {
          type: 'I',
          target: { type: 'I', x: 7, y: 36, rotation: 1 },
          cells: [
            [9, 36],
            [9, 37],
            [9, 38],
            [9, 39],
          ],
          lines: 0,
          clearedRows: [],
          spin: 'none',
          topOut: false,
        },
        resultContext:
          '["st-zero-v2",["..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........","..........",".SS.......","SSJ.......","OOJJJ.....","OOJJLLL...","LLJJLSS...","ILJJSS....","ILJJLLL...","IOOJLSS...","IOOJSS....","OOJJLLL...","OOSSLSS..I","IJJJLOO.ZI","IJJJLSS.ZI","OOOOLSS.ZI"],"I",true,["Z","O","L"],{"remaining":[123],"observedCount":253,"provenance":"known-phase"},"T"]',
      },
    ],
    evidence: { cycleDebt: 0, strategy: 'canonical-right-ST' },
  },
};

const reviewedOptions = () => ({
  depth: null,
  width: 8,
  maxNodes: 45000,
  now: () => 0,
  deadline: Infinity,
  openingPhase: false,
  obligationContext: structuredClone(regionReview.obligationContext),
  patternHistory: structuredClone(regionReview.patternHistory),
});
function reviewedPlacement(state, witness) {
  const r = R.replay(state, witness);
  assert.equal(r.valid, true);
  assert.equal(r.events.length, 1);
  return {
    state: r.state,
    event: r.events[0],
    target: r.events[0].target,
    witness,
    hold: witness.includes('HOLD'),
  };
}
function reviewedInternals(file, names) {
  const fs = require('node:fs'),
    vm = require('node:vm'),
    path = require('node:path'),
    filename = require.resolve('../' + file),
    source = fs.readFileSync(filename, 'utf8'),
    module = { exports: {} };
  assert.equal(source.split('return Object.freeze({').length, 2);
  vm.runInNewContext(
    source.replace(
      'return Object.freeze({',
      'return Object.freeze({' + names + ',',
    ),
    {
      module,
      require: (id) => require(path.resolve(path.dirname(filename), id)),
      Date,
      performance,
    },
  );
  return module.exports;
}
test('reviewed boundary J: reject the unsupported intrusion, keep the physical move and in-Left alternative legal', () => {
  for (const shift of [0, 3]) {
    const state = structuredClone(regionReview.position);
    if (shift)
      state.board = state.board.slice(shift).concat(state.board.slice(-shift));
    state.board = state.board.map((row) => row.replace(/[IJLOSTZ]/g, 'X'));
    const crossing = reviewedPlacement(state, ['HD']),
      left = reviewedPlacement(state, ['CCW', 'HD']);
    assert.deepEqual(crossing.event.cells, [
      [2, 27 - shift],
      [2, 28 - shift],
      [3, 28 - shift],
      [4, 28 - shift],
    ]);
    assert.equal(S.leftCenterJAllowed(state, crossing), false);
    assert.equal(P.ordinaryCenterEligible(state, crossing), false);
    assert(
      S.transition(state, crossing).cycleViolations.includes(
        'unsupported-left-center-J-intrusion',
      ),
    );
    assert.equal(S.leftCenterJAllowed(state, left), true);
    assert.equal(P.ordinaryCenterEligible(state, left), true);
    assert.equal(
      S.transition(state, left).cycleViolations.includes(
        'unsupported-left-center-J-intrusion',
      ),
      false,
    );
    assert(left.event.cells.every(([x]) => x < 4));
  }
});
test('reviewed boundary J: the in-Left move retains ordinary resource permission', () => {
  const M = require('../st-obligation-resources'),
    Context = require('../st-obligation-context'),
    state = regionReview.position,
    p = reviewedPlacement(state, ['CCW', 'HD']),
    current = Context.importState(regionReview.obligationContext, {
      position: state,
    });
  const checked = M.checkPath(state, [p], current);
  assert.equal(checked.valid, true);
  assert.deepEqual(checked.resource.violations, []);
  // Eligibility is not a new promise that all later S/L obligations are solved.
  assert.equal(P.ordinaryCenterEligible(state, p), true);
});
test('reviewed boundary J: hard rejection covers route nodes, final replay admission, retained advice and risky fallback', () => {
  const api = reviewedInternals(
      'st-planner.js',
      'nodeFor,checkedResourceEndpoint,riskyFallback,prepareResourceOptions',
    ),
    state = regionReview.position,
    p = reviewedPlacement(state, ['HD']),
    opts = reviewedOptions(),
    initial = {
      ...P.assess(state.board),
      state,
      notches: P.resolvePatternHistory(state, opts.patternHistory),
      resources: {},
    };
  assert.equal(api.nodeFor(p, null, initial, 0, api.assess, true), null);
  const admitted = api.checkedResourceEndpoint(
    state,
    regionReview.previous.continuation,
    opts,
  );
  assert.equal(admitted.valid, false);
  assert.equal(admitted.reason, 'unsupported-left-center-J-intrusion');
  assert.equal(P.revalidate(state, regionReview.previous, opts), null);
  const risk = api.riskyFallback(
    state,
    {
      target: null,
      status: 'no-supported-continuation-found',
      metrics: { nodes: 0 },
    },
    api.prepareResourceOptions(state, opts),
    { placements: [p], complete: true },
  );
  assert.equal(risk.target, null);
  assert.equal(
    risk.metrics.riskFallback.rejections['unsupported-left-center-J-intrusion'],
    1,
  );
  const opening = reviewedInternals('st-opening.js', 'validStep'),
    usage = { rejections: {} };
  assert.equal(
    opening.validStep(
      state.board,
      p,
      P.resolvePatternHistory(state, opts.patternHistory),
      { usage },
    ),
    null,
  );
  assert.equal(usage.rejections['unsupported-left-center-J-intrusion'], 1);
  const reset = reviewedInternals('st-reset-coach.js', 'transition');
  assert.equal(
    reset.transition(
      {
        state,
        notches: P.resolvePatternHistory(state, opts.patternHistory),
        allowHold: true,
        resource: {},
      },
      p,
    ),
    null,
  );
});
test('reviewed boundary J: current and saved-prefix searches cannot recommend the rejected placement', () => {
  for (const saved of [false, true]) {
    const options = reviewedOptions();
    if (saved) {
      options.previous = regionReview.previous;
      options.commitment = {
        observation: regionReview.position,
        advice: regionReview.previous,
      };
    }
    const a = P.decide(regionReview.position, options);
    assert.notDeepEqual(a.target, regionReview.previous.target);
    let state = regionReview.position;
    for (const step of a.continuation || []) {
      const p = reviewedPlacement(state, step.witness);
      assert(S.leftCenterJAllowed(state, p));
      state = p.state;
    }
  }
});
test('reviewed boundary J: preserve every maintained source-opening J crossing', () => {
  const D = require('../st-opening-patterns');
  let crossings = 0;
  for (const pattern of D.patterns)
    for (const [mask, type, code] of pattern.edges) {
      if (
        type !== 'J' ||
        !pattern.targets.J.some(([x]) => x < 4) ||
        !pattern.targets.J.some(([x]) => x >= 4 && x < 7)
      )
        continue;
      const board = Array.from({ length: 40 }, () => Array(10).fill('.'));
      [...D.types].forEach((piece, i) => {
        if (mask & (1 << i))
          for (const [x, y] of pattern.targets[piece]) board[y][x] = piece;
      });
      const state = R.createState({
          board: board.map((r) => r.join('')),
          active: 'J',
          queue: ['O'],
        }),
        p = reviewedPlacement(
          state,
          [...code].map((c) => D.actionCodes[c]),
        );
      assert.deepEqual(p.event.cells, pattern.targets.J);
      assert.equal(
        S.leftCenterJAllowed(state, p),
        true,
        pattern.id + ' mask ' + mask,
      );
      crossings++;
    }
  assert.equal(crossings, 50);
});
