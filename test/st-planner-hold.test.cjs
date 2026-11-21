'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const R = require('../st-rules'),
  P = require('../st-planner'),
  F = require('../st-fixtures');
function doubleHoldAdvice() {
  const s = R.migrateState({
    ...F.get('o-before-double').observation,
    hold: null,
  });
  const scoped = {
    ...R,
    placements: (state, options) => {
      const e = R.placements(state, options);
      return {
        ...e,
        placements: e.placements.filter((p) => p.holdCount === 2),
      };
    },
  };
  const box = {
    module: { exports: {} },
    exports: {},
    require: (p) => (p === './st-rules.js' ? scoped : require('../' + p)),
    Date,
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../st-planner'), 'utf8'),
    box,
  );
  const a = JSON.parse(
    JSON.stringify(box.module.exports.plan(s, { depth: 1 })),
  );
  assert.ok(a.target, a.reason);
  return { s, a };
}
test('planner describes and retains only the remaining meaningful holds', () => {
  const { s, a } = doubleHoldAdvice();
  assert.equal(a.holdCount, 2);
  assert.match(a.reason, /^Hold twice\./);
  const once = R.move(s, 'HOLD'),
    next = P.advance(once, a, 'HOLD');
  assert.ok(next);
  assert.equal(next.holdCount, 1);
  assert.match(next.reason, /^Hold once\./);
  const twice = R.move(once, 'HOLD'),
    last = P.advance(twice, next, 'HOLD');
  assert.ok(last);
  assert.equal(last.holdCount, 0);
  assert.equal(last.hold, false);
  assert.doesNotMatch(last.reason, /^Hold/);
  assert.equal(twice.streamCursor, s.streamCursor + 1);
  assert.equal(twice.hold, s.queue[0]);
});
test('revalidation preserves swap-back semantic result, not only matching placement cells', () => {
  const { s, a } = doubleHoldAdvice();
  const valid = P.revalidate(s, a);
  assert.ok(valid);
  assert.equal(valid.holdCount, 2);
  const counterfeit = { ...a, holdCount: 0, hold: false };
  assert.equal(
    P.revalidate(s, counterfeit),
    null,
    'same cells without stashing the next piece are a different result',
  );
  const stale = structuredClone(a);
  stale.continuation[0].resultContext = 'stale';
  assert.equal(P.revalidate(s, stale), null);
});

// Seed 2026113207, native pre-lock 41; the Center fork uses only public S/L.
const identityHoldRoot = {
  observation: {
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
      '..........',
      '..........',
      '..........',
      '..........',
      '....JJJ...',
      '....OOJ...',
      '....OO....',
      '.SS.LLL...',
      'SSOOLSS...',
      'IJOOSS....',
      'IJJJLLL...',
      'IJOOLSS...',
    ],
    active: {
      type: 'S',
      x: 3,
      y: 17,
      rotation: 0,
      lastRotation: null,
    },
    hold: 'L',
    canHold: true,
    queue: ['L', 'T', 'J', 'O', 'S', 'I'],
    revision: 470,
    streamCursor: 42,
    topOut: false,
    bag: {
      remaining: [64],
      observedCount: 48,
      provenance: 'known-phase',
    },
  },
  options: {
    depth: null,
    width: 8,
    maxNodes: 45000,
    timeMs: 1500,
    obligationContext: {
      schemaVersion: 1,
      status: 'available',
      reason: null,
      inventory: {
        schemaVersion: 1,
        status: 'available',
        originKnown: true,
        nextId: 49,
        streamCursor: 42,
        active: {
          id: 42,
          type: 'S',
          observedOrder: 41,
          bag: 5,
        },
        hold: {
          id: 38,
          type: 'L',
          observedOrder: 37,
          bag: 5,
        },
        queue: [
          {
            id: 43,
            type: 'L',
            observedOrder: 42,
            bag: 6,
          },
          {
            id: 44,
            type: 'T',
            observedOrder: 43,
            bag: 6,
          },
          {
            id: 45,
            type: 'J',
            observedOrder: 44,
            bag: 6,
          },
          {
            id: 46,
            type: 'O',
            observedOrder: 45,
            bag: 6,
          },
          {
            id: 47,
            type: 'S',
            observedOrder: 46,
            bag: 6,
          },
          {
            id: 48,
            type: 'I',
            observedOrder: 47,
            bag: 6,
          },
        ],
        frontier: {
          bag: 6,
          seenMask: 63,
        },
        knowledge: {
          remaining: [64],
          observedCount: 48,
          provenance: 'known-phase',
        },
      },
      state: {
        schemaVersion: 2,
        availability: 'known',
        center: {
          pending: [],
          debt: [],
        },
        sl: {
          schemaVersion: 1,
          status: 'known',
          foundationOpen: false,
          firstBagReview: 'reviewed',
          handoff: true,
          residuals: [],
          uncertainty: {
            S: [0, 0, 0, 0],
            L: [0],
          },
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
          z: {
            remaining: 0,
            uncredited: 'none',
          },
          reset: {
            status: 'inactive',
          },
        },
        safety: {
          notches: {
            version: 2,
            status: 'established',
            anchorRow: 37,
            blockedRows: [],
            source: 'witnessed-floor-Z-cap',
          },
          coveredCells: [],
        },
        dPending: true,
        leftGoals: [],
      },
      boundary: {
        firstBagLocks: 7,
        sourcePatternSeen: true,
      },
    },
    patternHistory: {
      version: 2,
      status: 'established',
      anchorRow: 37,
      blockedRows: [],
      source: 'witnessed-floor-Z-cap',
    },
    openingPhase: false,
    openingSource: null,
    openingClear: null,
    openingRepair: null,
  },
};

function identityHoldCase() {
  const C = require('../st-obligation-context'),
    B = require('../st-bag'),
    Session = require('../st-session');
  const native = Session.create(R.createState(identityHoldRoot.observation), {
    obligationContext: identityHoldRoot.options.obligationContext,
  });
  const restored = Session.prepare(JSON.parse(JSON.stringify(native)));
  let state = restored.state,
    current = restored.obligationContext;
  for (const action of ['R', 'HD']) {
    const before = state;
    state = { ...R.move(state, action), revision: state.revision + 1 };
    if (action === 'HD')
      state = {
        ...state,
        queue: state.queue.concat('Z'),
        bag: B.consume(state.bag, 'Z'),
      };
    current = C.applyActual(current, { before, action, after: state }).context;
  }
  const options = {
    ...identityHoldRoot.options,
    obligationContext: C.exportState(current),
    patternHistory: current.state.safety.notches,
    now: () => 0,
    deadline: Infinity,
    maxNodes: 45000,
  };
  function draft(hold = true) {
    const witness = [...(hold ? ['HOLD'] : []), 'R', 'R180', 'HD'],
      replay = R.replay(state, witness);
    assert.ok(replay.valid);
    return {
      context: JSON.stringify([
        state.rules,
        state.board,
        state.hold,
        state.canHold,
        state.queue,
        state.bag ?? null,
        state.active?.type,
      ]),
      target: replay.events[0].target,
      witness,
      hold,
      holdCount: Number(hold),
      continuation: [{ witness, event: replay.events[0], state: replay.state }],
      evidence: {},
    };
  }
  return { state, current, options, draft };
}
test('identity Hold: native Center fork pays with held L38, not geometrically identical active L43', () => {
  const C = require('../st-obligation-context'),
    M = require('../st-obligation-resources'),
    { state, current, options, draft } = identityHoldCase();
  assert.equal(current.inventory.active.id, 43);
  assert.equal(current.inventory.hold.id, 38);
  const held = draft(),
    active = draft(false);
  assert.deepEqual(held.target, active.target);
  const enumeration = R.placements(state, {
    now: () => 0,
    deadline: Infinity,
    maxNodes: 45000,
  });
  assert.ok(enumeration.complete);
  assert.equal(
    enumeration.placements.filter((p) => p.holdCount === 1).length,
    0,
  );
  const checked = P.revalidate(state, held, options);
  assert.ok(checked);
  assert.deepEqual(checked.witness, held.witness);
  assert.equal(checked.metrics.nodes, 475);
  const path = M.checkPath(state, checked.continuation, current);
  assert.ok(path.valid);
  assert.equal(path.resource.pendingCenter.length, 0);
  assert.equal(path.resource.hangingS.length, 0);
  assert.equal(path.resource.hangingL.length, 0);
  assert.equal(P.revalidate(state, active, options), null);
  const other = M.checkPath(state, active.continuation, current);
  assert.ok(other.resource.hangingL.some((p) => p.id === 38));
  assert.ok(other.resource.hangingS.some((p) => p.id === 47));
  let actual = state,
    context = current;
  for (const action of checked.witness) {
    const before = actual;
    actual = { ...R.move(actual, action), revision: actual.revision + 1 };
    context = C.applyActual(context, { before, action, after: actual }).context;
  }
  assert.equal(
    C.resolve(context, { position: actual }).center.pending.length,
    0,
  );
  assert.equal(context.inventory.hold.id, 43);
});
test('identity Hold: stale identity, wrong target, changed event, disabled Hold and exhausted work fail closed', () => {
  const { state, options, draft } = identityHoldCase(),
    good = P.revalidate(state, draft(), options);
  assert.ok(good);
  const C = require('../st-obligation-context');
  const current = C.importState(options.obligationContext, { position: state });
  const swapped = { ...R.move(state, 'HOLD'), revision: state.revision + 1 };
  const swappedContext = C.applyActual(current, {
    before: state,
    action: 'HOLD',
    after: swapped,
  }).context;
  assert.equal(
    P.revalidate(swapped, good, {
      ...options,
      obligationContext: C.exportState(swappedContext),
    }),
    null,
    'actual same-type swap changes certificate identity binding',
  );
  const unknownOptions = { ...options };
  delete unknownOptions.obligationContext;
  assert.equal(P.revalidate(state, draft(), unknownOptions), null);
  const stale = structuredClone(good);
  stale.evidence.resourceObligations.binding += 'stale';
  assert.equal(P.revalidate(state, stale, options), null);
  const wrong = structuredClone(good);
  wrong.target.x--;
  assert.equal(P.revalidate(state, wrong, options), null);
  const event = structuredClone(good);
  event.continuation[0].event.cells[0][0]--;
  assert.equal(P.revalidate(state, event, options), null);
  const witness = structuredClone(good);
  witness.witness = ['HOLD', 'HD', 'HD'];
  assert.equal(P.revalidate(state, witness, options), null);
  assert.equal(
    P.revalidate(state, draft(), { ...options, allowHold: false }),
    null,
  );
  assert.equal(P.revalidate(state, draft(), { ...options, maxNodes: 0 }), null);
  assert.equal(P.revalidate(state, draft(), { ...options, deadline: 0 }), null);
});
test('identity Hold: ordinary same-type geometric enumeration remains deduplicated', () => {
  const state = R.createState({
    ...F.get('o-before-double').observation,
    rules: R.PROFILE.id,
    board: Array(40).fill('..........'),
    active: { type: 'L', x: 3, y: 17, rotation: 0, lastRotation: null },
    hold: 'L',
    queue: ['T', 'O', 'S', 'Z', 'J', 'I'],
  });
  const out = R.placements(state, {
    now: () => 0,
    deadline: Infinity,
    maxNodes: 45000,
  });
  assert.ok(out.complete);
  assert.ok(out.placements.length);
  assert.ok(out.placements.every((p) => p.holdCount === 0));
});
