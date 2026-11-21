'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { withPage } = require('./support/page.cjs');
const R = require('../st-rules');
const Context = require('../st-obligation-context');
const PH = require('../st-pattern-history');
const PATTERN_BASELINE = require('./support/st-resource-history-ui-patterns.json');
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const resources = (g) => clone(g.window.stLab.resources);
const inventory = (g) => clone(g.window.stLab.publicInventory);
const locks = (g) =>
  Number(g.element('#st-pieces-value').textContent.replaceAll(',', ''));
const select = (g, value) => {
  g.element('#st-fixture').value = value;
  g.element('#st-fixture').dispatchEvent(new g.window.Event('change'));
};
const importState = (g, state) => {
  g.element('#st-snapshot').value = JSON.stringify(state);
  g.click('#st-import');
  assert.match(g.element('#st-import-status').textContent, /Snapshot imported/);
};
function workers(g) {
  const all = [];
  g.window.Worker = class {
    constructor() {
      all.push(this);
    }
    postMessage(message) {
      this.message = clone(message);
    }
    terminate() {
      this.terminated = true;
    }
    respond(result) {
      this.onmessage({
        data: {
          type: 'result',
          id: this.message.id,
          revision: this.message.observation.revision,
          result,
        },
      });
    }
  };
  return all;
}
const request = (g, all) => {
  g.advance(40);
  return all.at(-1).message;
};
const allocationFacts = (diagnostic) => ({
  center: diagnostic.center,
  hangingS: diagnostic.hangingS,
  extraZ: diagnostic.extraZ,
});

// Captured from the actual unmodified controller at local d836598 / public
// 7401810 (tree 2edd62c6), seed 42, with the exact actions below. These are
// observable worker-message hashes, not source-code snapshots. No planner is
// mocked to change the message content. The compact context is checked
// independently. The resource migration changes options.obligationContext,
// while the current-notch migration changes options.patternHistory. Its semantic facts are compared with the separately
// frozen old implementation's output; replacing that one transport field with
// its captured legacy payload then retains every original request hash below.
// No current product code generates the expected facts or legacy payloads.
const BASELINE_REQUESTS = [
  'f879a37bd203cac5f8e7ba4f1000d47616df377c95c79ed01dd6b0dfa8022c9e',
  '1e9afa3d8e835a04f60661abf25f6e6f9983bbdc3794f11040f41a2561695952',
  '3f680b1a1b74b7a2b9c6667b7d74dac290c1e93b96d0bfebbc7dbf28496c22c7',
  'e3358a2980d134ca9e561596c639d7a76a1903f01dac79e81e1df8f78045bbc4',
  '036cda05b587660fe0c947ca40c29be749fbd717cf9121487fd636616f1f5fb0',
  '85f213250b4f6aa9a2a38f0399ce0bd30b04d267b82e72fe138bc9548a6f7d1f',
  'ca3a773f4acc43630b50fd83665eaebce4c48d33986cd281bb8f0eb4c4754051',
  'b540aaa7c0f2e538fcfd176d13617a03c0b33f0589d1ce9b4025167e43cd4927',
  'f07cacf1a8f2b99551a185aa710ed7d4d50fbb5b693013831a3903aac6b4993f',
  '18bbe823e5406387945d3f55db90d516cedb429df38ae850567928858187e9f4',
  '66dab377bc80a0c60207ae21e4fa6a9ddba61f40bb0187e6fcfa90e879f6a1ce',
  '947d34602ce7e1f8811199ff1156982c618f0c0a72d2ae88b2f76d120fc23703',
  '98c74f047270e559084e665363f1b408fa065ab1ffd909dc367243cb1d3c9e65',
  'e0d5f27864d855d2471a477d179d7b0f7f7e6379eca59723b2f20e0cfdb09386',
  'fa34e94c90b9174189b3682ae30d1590eba2c2ff2ff0868c28d12ebd5d3146ac',
  '9340dd798a2a444ef24ebd562ebc1c53ee005ea47f6848f6c3ba2245f3c2f3a7',
];

test('current resource UI: compact context and current notch facts preserve prior accounting transport semantics through HOLD, locks, Undo, branch, restarts and import', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    const all = workers(g),
      actual = [];
    const capture = () => {
      const message = request(g, all),
        proof = message.options.obligationContext;
      assert.ok(
        proof,
        'Every active observation carries its compact current checkpoint',
      );
      assert.equal(message.options.resourceContext, undefined);
      assert.deepEqual(
        {
          ...Context.resolve(
            Context.importState(proof, { position: message.observation }),
            { position: message.observation },
          ),
          terminal: false,
        },
        resources(g),
      );
      const frozen =
        PATTERN_BASELINE.patterns[
          PATTERN_BASELINE.requestPatterns[actual.length]
        ];
      assert.ok(
        frozen,
        'Every captured request has an independent legacy notch oracle',
      );
      const current = message.options.patternHistory;
      assert.equal(current.version, 2);
      assert.equal('origin' in current, false);
      assert.equal('steps' in current, false);
      assert.deepEqual(
        PH.resolve(message.observation, current),
        frozen.facts,
        `Current notch semantics changed at request ${actual.length}`,
      );
      const prior = clone(message);
      delete prior.options.obligationContext;
      prior.options.patternHistory = clone(frozen.legacy);
      // Search depth intentionally changed; retain the independent legacy
      // transport oracle for all other fields, and assert the new default first.
      assert.equal(message.options.depth, null);
      prior.options.depth = 3;
      actual.push(hash(prior));
    };
    select(g, 'empty');
    capture();
    for (const action of [
      'HOLD',
      'L',
      'CW',
      'HD',
      'HOLD',
      'HOLD',
      'R',
      'HD',
      'UNDO',
      'R180',
      'HD',
    ]) {
      g.window.stLab.act(action);
      capture();
    }
    g.click('#st-reset');
    capture();
    g.tap('KeyR');
    capture();
    select(g, 'marathon-rebuild');
    capture();
    g.click('#st-export');
    g.click('#st-import');
    capture();
    assert.equal(
      PATTERN_BASELINE.requestPatterns.length,
      BASELINE_REQUESTS.length,
    );
    assert.deepEqual(actual, BASELINE_REQUESTS);
    const message = all.at(-1).message;
    for (const section of [message, message.observation, message.options]) {
      for (const key of [
        'resources',
        'resourceHistory',
        'hangingS',
        'extraZ',
        'pieceOrigins',
        'future',
      ]) {
        assert.equal(
          key in section,
          false,
          `Unvalidated diagnostic claims must not enter the planner: ${key}`,
        );
      }
    }
  }));

test('current resource UI: local empty origin is known but imported and stable history remain unknown', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    assert.equal(resources(g).availability, 'unknown');
    select(g, 'empty');
    const known = resources(g),
      visible = g.snapshot();
    assert.equal(known.availability, 'known');
    assert.equal(locks(g), 0);
    assert.equal(known.locks, undefined);
    assert.equal(known.actions, undefined);
    assert.equal(inventory(g).active.type, visible.active.type);
    assert.equal(inventory(g).hold, null);
    assert.deepEqual(
      inventory(g).queue.map((p) => p.type),
      visible.queue,
    );
    assert.equal(
      new Set([inventory(g).active, ...inventory(g).queue].map((p) => p.id))
        .size,
      7,
    );
    assert.equal(
      known.extraZ.status,
      'unknown',
      'Empty origin is not a verified Midgame baseline',
    );
    importState(g, {
      ...visible,
      resources: known,
      resourceHistory: known,
      hangingS: { status: 'none-observed' },
      extraZ: { status: 'available' },
    });
    const imported = resources(g);
    assert.equal(imported.availability, 'unknown');
    assert.equal(imported.extraZ.status, 'unknown');
    assert.equal(imported.hangingS.status, 'unknown');
    assert.equal(locks(g), 0);
    select(g, 'marathon-rebuild');
    assert.equal(resources(g).availability, 'unknown');
    assert.equal(resources(g).extraZ.status, 'unknown');
  }));

test('current resource UI: unlimited HOLD preserves observed identities and movement never consumes allocations', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    select(g, 'empty');
    const start = resources(g),
      first = inventory(g).active,
      next = inventory(g).queue[0];
    g.window.stLab.act('HOLD');
    const held = resources(g),
      heldInventory = inventory(g);
    assert.equal(inventory(g).hold.id, first.id);
    assert.equal(inventory(g).active.id, next.id);
    assert.deepEqual(allocationFacts(held), allocationFacts(start));
    for (let i = 0; i < 4; i++) g.window.stLab.act('HOLD');
    const repeated = resources(g);
    assert.deepEqual(inventory(g), heldInventory);
    for (const action of ['L', 'CW', 'R', 'SD']) g.window.stLab.act(action);
    assert.deepEqual(inventory(g), heldInventory);
    assert.deepEqual(allocationFacts(resources(g)), allocationFacts(start));
    g.window.stLab.act('HD');
    assert.equal(locks(g), 1);
    assert.equal(inventory(g).hold.id, first.id);
    assert.notEqual(
      inventory(g).active.id,
      next.id,
      'Locked identity cannot remain active',
    );
  }));

test('current resource UI: identical-letter HOLD swaps distinct instances without inventing known age', () =>
  withPage('st-lab.html', {}, (g) => {
    importState(
      g,
      R.createState({
        active: 'S',
        hold: 'S',
        queue: ['L', 'I', 'O', 'T', 'Z', 'J'],
      }),
    );
    const start = resources(g),
      startInventory = inventory(g),
      a = startInventory.active.id,
      h = startInventory.hold.id;
    assert.notEqual(a, h);
    assert.equal(start.availability, 'unknown');
    g.window.stLab.act('HOLD');
    let current = resources(g);
    assert.equal(inventory(g).active.id, h);
    assert.equal(inventory(g).hold.id, a);
    assert.deepEqual(inventory(g).queue, startInventory.queue);
    g.window.stLab.act('HOLD');
    current = resources(g);
    assert.deepEqual(inventory(g), startInventory);
    assert.equal(current.hangingS.status, 'unknown');
    assert.equal(current.extraZ.status, 'unknown');
    assert.equal(locks(g), 0);
  }));

test('current resource UI: Undo restores the pre-turn current state including HOLD and branched identities', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    select(g, 'empty');
    const start = resources(g);
    for (const action of ['HOLD', 'L', 'CW', 'HD']) g.window.stLab.act(action);
    assert.equal(locks(g), 1);
    g.window.stLab.act('UNDO');
    assert.deepEqual(resources(g), start);
    g.window.stLab.act('R');
    g.window.stLab.act('HD');
    const branch = resources(g);
    assert.equal(locks(g), 1);
    assert.equal(inventory(g).hold, null);
    g.window.stLab.act('UNDO');
    assert.deepEqual(resources(g), start);
    g.window.stLab.act('R');
    g.window.stLab.act('HD');
    assert.deepEqual(resources(g), branch);
  }));

test('current resource UI: top-out lock is counted exactly once and Undo restores missing-history status', () =>
  withPage('st-lab.html', {}, (g) => {
    const board = R.emptyBoard();
    board[20] = 'XXXXXXXXX.';
    importState(g, R.createState({ board, active: 'O', queue: [] }));
    const start = resources(g);
    g.window.stLab.act('HD');
    assert.equal(g.snapshot().topOut, true);
    assert.equal(resources(g).terminal, true);
    assert.match(
      g.element('#st-resource-summary').textContent,
      /Game ended; historical facts only/,
    );
    assert.equal(locks(g), 1);
    const ended = resources(g);
    g.window.stLab.act('HD');
    assert.deepEqual(
      resources(g),
      ended,
      'Terminal repeated action must not duplicate accounting',
    );
    g.window.stLab.act('UNDO');
    assert.deepEqual(resources(g), start);
  }));

test('current resource UI: replay-current, fresh restart, and mode changes reset caller counters', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    select(g, 'empty');
    const first = resources(g),
      firstInventory = inventory(g);
    g.window.stLab.act('HD');
    assert.equal(locks(g), 1);
    g.click('#st-reset');
    assert.equal(locks(g), 0);
    assert.equal(resources(g).actions, undefined);
    assert.equal(resources(g).availability, 'known');
    assert.deepEqual(inventory(g), firstInventory);
    g.window.stLab.act('HD');
    g.tap('KeyR');
    assert.equal(locks(g), 0);
    assert.equal(resources(g).actions, undefined);
    assert.equal(resources(g).availability, 'known');
    assert.equal(inventory(g).active.type, g.snapshot().active.type);
    select(g, 'marathon-rebuild');
    g.window.stLab.act('HD');
    g.tap('KeyR');
    assert.equal(locks(g), 0);
    assert.equal(
      resources(g).availability,
      'unknown',
      'Fresh pieces do not establish a preexisting board history',
    );
    assert.equal(resources(g).extraZ.status, 'unknown');
  }));

test('current resource UI: diagnostics stay outside snapshots and ignore stale or injected worker fields', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    const all = workers(g);
    select(g, 'empty');
    request(g, all);
    const stale = all.at(-1),
      before = resources(g);
    g.window.stLab.act('HOLD');
    request(g, all);
    const held = resources(g),
      heldInventory = inventory(g);
    const forged = {
      status: 'no-supported-continuation-found',
      reason: 'Test result',
      resources: {
        coverage: { status: 'complete' },
        extraZ: { status: 'available' },
        locks: 900,
      },
      resourceHistory: { extraZ: { status: 'available' } },
    };
    stale.respond(forged);
    assert.deepEqual(resources(g), held);
    all.at(-1).respond(forged);
    assert.deepEqual(resources(g), held);
    g.click('#st-export');
    const exported = JSON.parse(g.element('#st-snapshot').value);
    assert.deepEqual(exported, {
      ...g.snapshot(),
      suggestedFileName: 'st-lab-coaching-export.json',
    });
    for (const key of [
      'resources',
      'resourceHistory',
      'hangingS',
      'extraZ',
      'pieceOrigins',
    ])
      assert.equal(key in exported, false);
    const display = JSON.parse(g.element('#st-diagnostic-text').textContent);
    assert.deepEqual(display.resources, held);
    // A caller receives diagnostics, not the mutable trusted reducer state.
    const exposed = g.window.stLab.resources;
    try {
      exposed.extraZ.status = 'available';
      exposed.locks = 123;
    } catch {
      /* Frozen copies are valid too. */
    }
    assert.deepEqual(resources(g), held);
    assert.equal(locks(g), 0);
  }));

test('current resource UI: starting in maintenance does not invent an observed opening handoff', () =>
  withPage('st-lab.html', {}, (g) => {
    const all = workers(g);
    select(g, 'marathon-rebuild');
    request(g, all);
    assert.equal(g.window.stLab.obligationContext.state.sl.handoff, false);
    all.at(-1).respond({
      status: 'no-supported-continuation-found',
      reason: 'No checked continuation.',
    });
    assert.equal(
      g.window.stLab.obligationContext.state.sl.handoff,
      false,
      'An unsupported response in an already-maintenance fixture is not a verified phase transition',
    );
    assert.equal(resources(g).firstTsd, false);
    assert.equal(resources(g).extraZ.status, 'unknown');
  }));

test('current resource UI: ignored movement and unsupported actions cannot duplicate current accounting', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    select(g, 'empty');
    for (let i = 0; i < 10; i++) g.window.stLab.act('L');
    const atWall = resources(g),
      state = g.snapshot();
    for (const action of ['L', 'L', 'NOT_AN_ACTION'])
      g.window.stLab.act(action);
    assert.deepEqual(g.snapshot(), state);
    assert.deepEqual(resources(g), atWall);
    assert.equal(locks(g), 0);
  }));

// Native seed 2026112107, before lock 84 on 6a404328. Minimized actual
// checkpoint; four following locks use only their recorded public reveals.
// S84 is held while S85 enters Center; only the later held S pays Left.
const HELD_S_CHECKPOINT = {
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
      '..........',
      '..........',
      '..........',
      '..........',
      'JJ........',
      'JLLLLLL...',
      'JLOOLSS...',
      'JJOOSS....',
      'JOOJLOO...',
      'JOOJLOO...',
      'IJSILSS.Z.',
      'OOIJLSS.Z.',
    ],
    active: { type: 'S', x: 3, y: 17, rotation: 0, lastRotation: null },
    hold: 'S',
    canHold: true,
    queue: ['Z', 'O', 'J', 'T', 'L', 'I'],
    revision: 656,
    streamCursor: 85,
    topOut: false,
    bag: { remaining: [0], observedCount: 91, provenance: 'known-phase' },
  },
  context: {
    schemaVersion: 1,
    status: 'available',
    reason: null,
    inventory: {
      schemaVersion: 1,
      status: 'available',
      originKnown: true,
      nextId: 92,
      streamCursor: 85,
      active: { id: 85, type: 'S', observedOrder: 84, bag: 12 },
      hold: { id: 84, type: 'S', observedOrder: 83, bag: 11 },
      queue: [
        { id: 86, type: 'Z', observedOrder: 85, bag: 12 },
        { id: 87, type: 'O', observedOrder: 86, bag: 12 },
        { id: 88, type: 'J', observedOrder: 87, bag: 12 },
        { id: 89, type: 'T', observedOrder: 88, bag: 12 },
        { id: 90, type: 'L', observedOrder: 89, bag: 12 },
        { id: 91, type: 'I', observedOrder: 90, bag: 12 },
      ],
      frontier: { bag: 13, seenMask: 0 },
      knowledge: {
        remaining: [0],
        observedCount: 91,
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
            bag: 11,
            S: null,
            L: {
              id: 80,
              region: 'left',
              opening: false,
              pair: null,
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
          anchorRow: 35,
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
};

test('resource UI identifies the actual held S obligation, follows Hold, and clears only on its payment', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    workers(g);
    const Session = require('../st-session');
    const Practice = require('../st-practice');
    const checkpoint = HELD_S_CHECKPOINT;
    const session = Session.create(R.createState(checkpoint.position), {
      obligationContext: checkpoint.context,
      openingPhase: false,
    });
    const practice = Practice.create(session, ['T', 'Z', 'J', 'O']);
    g.element('#st-snapshot').value = JSON.stringify(practice);
    g.click('#st-import');
    const detail = () => g.element('#st-hanging-s-detail').textContent;
    const held = () => g.element('#h').getAttribute('aria-label');
    const act = (...actions) => actions.forEach((a) => g.window.stLab.act(a));
    assert.match(detail(), /obligation belongs to the S in Hold/);
    assert.match(detail(), /Playing a different S does not clear/);
    assert.doesNotMatch(detail(), /S84|S85|bag 11|bag 12/);
    assert.equal(held(), 'Held piece: S');
    assert.equal(
      g.element('#st-hanging-s').getAttribute('aria-describedby'),
      'st-hanging-s-detail',
    );
    assert.equal(g.element('#st-hanging-s').getAttribute('tabindex'), '0');
    act('HOLD');
    assert.match(detail(), /obligation belongs to the active S/);
    act('HOLD', 'R', 'HD');
    assert.match(detail(), /obligation belongs to the S in Hold/);
    assert.equal(resources(g).hangingS.evidence.length, 1);
    assert.equal(resources(g).center.pending.length, 1);
    act('R', 'R', 'R', 'R', 'CW', 'HD', 'L', 'L', 'HD');
    assert.match(detail(), /obligation belongs to the S in Hold/);
    act('HOLD', 'L', 'L', 'L', 'HD');
    assert.equal(resources(g).hangingS.evidence.length, 0);
    assert.equal(resources(g).center.pending.length, 1);
    assert.doesNotMatch(detail(), /obligation belongs/);
    assert.equal(held(), 'Held piece: J');
  }));

test('resource UI does not assign an unknown import obligation to a same-type held piece', () =>
  withPage('st-lab.html', { seed: 42 }, (g) => {
    workers(g);
    importState(g, HELD_S_CHECKPOINT.position);
    assert.equal(g.element('#h').getAttribute('aria-label'), 'Held piece: S');
    assert.doesNotMatch(
      g.element('#st-hanging-s-detail').textContent,
      /obligation belongs/,
    );
    assert.equal(resources(g).hangingS.status, 'unknown');
    select(g, 'empty');
    assert.equal(
      g.element('#h').getAttribute('aria-label'),
      'Held piece: none',
    );
  }));
