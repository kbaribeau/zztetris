'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const S = require('../st-session'),
  R = require('../st-rules'),
  C = require('../st-obligation-context');
const { withPage } = require('./support/page.cjs');
const fixture = require('./fixtures/seed10331-session-checkpoints.json');
const clone = (x) => JSON.parse(JSON.stringify(x)),
  hidden = { storage: { stGuideVisible: 'false' } };
function install(g, x) {
  g.element('#st-snapshot').value = JSON.stringify(x);
  g.click('#st-import');
  assert.doesNotMatch(g.element('#st-import-status').textContent, /rejected/i);
}
function read(g) {
  const x = clone(g.window.stLab.exportSession()),
    got = S.prepare(x),
    proof = S.replay.validate(x.replay, got.state, got.obligationContext);
  assert.deepEqual(proof.state, g.snapshot());
  assert.deepEqual(
    C.exportState(proof.obligationContext),
    clone(g.window.stLab.obligationContext),
  );
  return { x, got, proof };
}
function mode(g, id) {
  const e = g.element('#st-fixture');
  e.value = id;
  e.dispatchEvent(new g.window.Event('change'));
}

test('session replay: old seed10331 checkpoints remain absent; endpoint TSD records exact played actions and accounting', () =>
  withPage('st-lab.html', hidden, (g) => {
    for (const name of ['beforeLock65', 'endpoint']) {
      const raw = fixture[name],
        got = S.prepare(raw);
      assert.equal(got.replay, null);
      assert.equal(S.create(got.state, got).replay, undefined);
      install(g, raw);
      const origin = read(g);
      assert.equal(origin.x.replay.boundary, 'import');
      assert.deepEqual(origin.x.replay.steps, []);
      assert.equal(
        origin.x.replay.origin.position.streamCursor,
        raw.position.streamCursor,
      );
      if (name === 'endpoint') {
        for (const a of fixture.tsd.witness) g.window.stLab.act(a);
        const after = read(g);
        assert.deepEqual(after.proof.events, [fixture.tsd.event]);
        assert.deepEqual(
          after.x.replay.steps.map((s) => s.action),
          fixture.tsd.witness,
        );
        assert.equal(after.x.position.active.type, 'L');
        assert.equal(after.x.position.hold, 'O');
        assert.equal(
          after.x.position.board.join('').replaceAll('.', '').length,
          44,
        );
        assert.deepEqual(
          after.x.replay.steps.at(-1).revealed,
          ['Z'],
          'forced public-bag reveal, not private future',
        );
      } else {
        for (const a of ['HOLD', 'CW', 'R180', 'CCW', 'L', 'HD'])
          g.window.stLab.act(a);
        assert.equal(read(g).proof.events.length, 1);
      }
    }
  }));

test('session replay: actual private reveals, empty/repeated hold, partial turn, undo branches, restart and imports', () =>
  withPage('st-lab.html', hidden, (g) => {
    mode(g, 'empty');
    const initial = read(g);
    assert.equal(initial.x.replay.boundary, 'start');
    for (const a of ['HOLD', 'HOLD', 'HOLD', 'L', 'CW', 'HD'])
      g.window.stLab.act(a);
    const first = read(g);
    assert.equal(first.proof.events.length, 1);
    assert.equal(
      first.x.replay.steps.flatMap((s) => s.revealed || []).length,
      2,
    );
    for (const a of ['R', 'HD', 'HOLD', 'CW']) g.window.stLab.act(a);
    g.window.stLab.act('UNDO');
    const undone = read(g);
    assert.equal(undone.proof.events.length, 1);
    assert.equal(undone.x.replay.steps.at(-1).boundary, 'undo');
    assert.deepEqual(undone.x.position.board, first.x.position.board);
    assert.deepEqual(
      undone.x.coaching.obligationContext,
      first.x.coaching.obligationContext,
    );
    for (const a of ['L', 'CCW', 'HD']) g.window.stLab.act(a);
    assert.equal(read(g).proof.events.length, 2);
    const saved = read(g).x;
    install(g, saved);
    assert.deepEqual(read(g).x.replay, saved.replay);
    g.window.stLab.act('L');
    g.window.stLab.act('RESET');
    const restart = read(g);
    assert.equal(restart.x.replay.steps.at(-1).boundary, 'restart');
    assert.deepEqual(restart.x.position, saved.position);
    install(g, fixture.endpoint.position);
    assert.equal(read(g).x.replay.boundary, 'import');
    assert.deepEqual(read(g).x.replay.steps, []);
    mode(g, 'marathon-rebuild');
    assert.equal(read(g).x.replay.boundary, 'mode');
    g.window.stLab.act('HD');
    g.window.stLab.act('RESET');
    assert.equal(read(g).x.replay.boundary, 'restart');
    assert.equal(read(g).proof.events.length, 0);
  }));

test('session replay: finite practice only records revealed letters and never reaches planner requests', () =>
  withPage('st-lab.html', {}, (g) => {
    const Practice = require('../st-practice'),
      requests = [];
    g.window.Worker = class {
      postMessage(m) {
        requests.push(clone(m));
      }
      terminate() {}
    };
    const packed = Practice.create(fixture.beforeLock65, [
      'O',
      'T',
      'I',
      'J',
      'L',
      'S',
      'Z',
    ]);
    install(g, packed);
    g.window.stLab.act('HOLD');
    g.window.stLab.act('HD');
    g.advance(40);
    const saved = read(g).x;
    assert.deepEqual(
      saved.replay.steps.flatMap((s) => s.revealed),
      ['O'],
    );
    assert.equal(saved.privatePractice, undefined);
    assert.equal(saved.replay.origin.position.queue.length, 6);
    for (const request of requests) {
      assert.equal(request.replay, undefined);
      assert.equal(request.options.replay, undefined);
      assert(!JSON.stringify(request).includes('privatePractice'));
    }
    // Same present observation/accounting, regardless of whether a tape is supplied.
    const expected = requests.at(-1);
    const absent = clone(saved);
    delete absent.replay;
    install(g, absent);
    g.advance(40);
    const actual = requests.at(-1);
    for (const key of ['observation', 'options', 'previous', 'commitment'])
      assert.deepEqual(actual[key], expected[key]);
  }));

test('session replay: tampered, incomplete, oversized and hidden-field payloads reject atomically', () =>
  withPage('st-lab.html', hidden, (g) => {
    install(g, fixture.endpoint);
    for (const a of fixture.tsd.witness) g.window.stLab.act(a);
    const valid = read(g).x;
    const changes = [
      (x) => x.replay.schemaVersion++,
      (x) => x.replay.steps.pop(),
      (x) => (x.replay.steps[0].action = 'NOPE'),
      (x) => (x.replay.steps[1].revealed = ['I']),
      (x) => (x.replay.steps.at(-1).revealed = ['I']),
      (x) => x.replay.steps.at(-1).revealed.push('J'),
      (x) => x.replay.origin.position.queue.push('I'),
      (x) => (x.replay.origin.position.future = ['I']),
      (x) => (x.replay.steps[0].future = ['T']),
      (x) => (x.replay.origin.obligationContext.inventory.active.id = 999),
      (x) => (x.replay.coverage = 'complete-game'),
      (x) =>
        (x.replay.steps = Array(S.replay.LIMITS.steps + 1).fill({
          action: 'L',
          revealed: [],
        })),
      (x) => (x.replay.steps[1] = { boundary: 'undo', revision: 0 }),
      (x) => (x.replay.steps[1] = { marker: 'imagined-reset' }),
    ];
    for (const change of changes) {
      const bad = clone(valid);
      change(bad);
      assert.throws(() => S.prepare(bad));
      const prior = g.snapshot();
      g.element('#st-snapshot').value = JSON.stringify(bad);
      g.click('#st-import');
      assert.match(g.element('#st-import-status').textContent, /rejected/i);
      assert.deepEqual(g.snapshot(), prior);
    }
    const mismatched = clone(valid);
    mismatched.coaching.obligationContext.state.sl.uncertainty.L = [1];
    assert.throws(() => S.prepare(mismatched), /endpoint accounting mismatch/);
    const before = g.snapshot();
    g.element('#st-snapshot').value = JSON.stringify(mismatched);
    g.click('#st-import');
    assert.match(
      g.element('#st-import-status').textContent,
      /endpoint accounting mismatch/,
    );
    assert.deepEqual(g.snapshot(), before);
    const got = S.prepare(valid);
    assert.deepEqual(S.create(got.state, got), valid);
  }));

test('session replay: bounded recording discloses truncation and retains a replayable suffix', () => {
  let state = R.createState({
      active: 'O',
      queue: ['I', 'J', 'L', 'S', 'T', 'Z'],
    }),
    context = C.start(state),
    tape = S.replay.start(state, context, 'start');
  for (let i = 0; i < S.replay.LIMITS.steps + 7; i++) {
    const before = state,
      prior = context,
      action = i % 2 ? 'R' : 'L';
    state = R.move(state, action);
    context = C.applyActual(context, { before, action, after: state }).context;
    tape = S.replay.record(tape, before, prior, { action, revealed: [] });
  }
  const got = S.replay.validate(tape, state, context);
  assert.equal(got.coverage, 'truncated');
  assert.equal(tape.boundary, 'limit');
  assert.equal(tape.steps.length, 7);
  assert(tape.origin.position.revision > 0);
  assert(JSON.stringify(tape).length < S.replay.LIMITS.bytes);
});

test('session replay: short imported preview may reveal a forced public remainder on movement', () =>
  withPage('st-lab.html', hidden, (g) => {
    const B = require('../st-bag'),
      state = R.createState({
        active: 'I',
        queue: ['J'],
        bag: B.fromObserved({
          observed: ['I', 'J', 'L', 'O', 'S', 'T'],
          startPhase: 0,
        }),
      });
    install(g, S.create(state));
    g.window.stLab.act('L');
    const saved = read(g);
    assert.deepEqual(saved.x.replay.steps, [{ action: 'L', revealed: ['Z'] }]);
    assert.deepEqual(saved.x.position.queue, ['J', 'Z']);
  }));

test('session replay: accepted accounting markers replay, then Undo discards the abandoned markers', () =>
  withPage('st-lab.html', {}, (g) => {
    const all = [];
    g.window.Worker = class {
      constructor() {
        all.push(this);
      }
      postMessage(m) {
        this.message = clone(m);
      }
      terminate() {}
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
    mode(g, 'empty');
    g.window.stLab.act('HD');
    g.advance(40);
    const w = all.at(-1),
      r = R.replay(w.message.observation, ['HD']);
    const P = g.window.STPlanner;
    g.window.STPlanner = {
      ...P,
      acceptOpeningResult: (s) => ({ ...s, active: false }),
    };
    try {
      w.respond({
        status: 'recommended-with-verified-prefix',
        target: r.events[0].target,
        witness: ['HD'],
        hold: false,
        reason: 'Controlled handoff',
        evidence: { opening: true },
      });
    } finally {
      g.window.STPlanner = P;
    }
    const marked = read(g);
    assert.equal(marked.x.replay.steps.at(-1).marker, 'handoff');
    assert.equal(marked.got.obligationContext.state.sl.handoff, true);
    g.window.stLab.act('UNDO');
    const undone = read(g);
    assert(!undone.x.replay.steps.some((s) => s.marker));
    assert.equal(undone.got.obligationContext.state.sl.handoff, false);
    // A current checkpoint can enter the already-supported Reset marker via
    // controlled advice; the replay stores the event, never the advice tree.
    install(g, fixture.beforeLock65);
    g.window.stLab.act('L');
    g.advance(40);
    const reset = all.at(-1),
      rr = R.replay(reset.message.observation, ['HD']);
    reset.respond({
      status: 'recommended-with-verified-prefix',
      target: rr.events[0].target,
      witness: ['HD'],
      hold: false,
      reason: 'Controlled Reset marker',
      evidence: { strategy: 'reset-coach' },
    });
    assert.equal(read(g).x.replay.steps.at(-1).marker, 'begin-reset');
  }));

test('session replay: large valid old checkpoints preserve import and gameplay with explicit unavailable history', () =>
  withPage('st-lab.html', hidden, (g) => {
    const raw = clone(fixture.beforeLock65);
    Object.assign(raw.coaching.obligationContext, {
      status: 'unavailable',
      reason: 'x'.repeat(S.replay.LIMITS.bytes + 1000),
      state: null,
    });
    S.prepare(raw);
    install(g, raw);
    const saved = clone(g.window.stLab.exportSession());
    assert.deepEqual(saved.position, raw.position);
    assert.deepEqual(
      saved.coaching.obligationContext,
      raw.coaching.obligationContext,
    );
    assert.deepEqual(saved.replay, {
      schemaVersion: 1,
      coverage: 'unavailable',
      reason: 'checkpoint-limit',
    });
    assert.equal(S.prepare(saved).replay.coverage, 'unavailable');
    g.window.stLab.act('L');
    g.window.stLab.act('HD');
    const played = clone(g.window.stLab.exportSession());
    assert.equal(played.replay.coverage, 'unavailable');
    assert.equal(played.coaching.obligationContext.status, 'unavailable');
    S.prepare(played);
  }));

test('session replay: selected Left repair marker uses bounded public cells, survives actions and rejects extra properties', () =>
  withPage('st-lab.html', {}, (g) => {
    const f = require('./fixtures/current-left-goal.json'),
      all = [];
    g.window.Worker = class {
      constructor() {
        all.push(this);
      }
      postMessage(m) {
        this.message = clone(m);
      }
      terminate() {}
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
    install(g, f.observation);
    g.advance(40);
    all.at(-1).respond(f.advice);
    const selected = read(g);
    assert.equal(selected.x.replay.steps.at(-1).marker, 'accept-left-repair');
    assert.equal(selected.got.obligationContext.state.leftGoals.length, 1);
    const bad = clone(selected.x);
    bad.replay.steps.at(-1).repair.future = ['I'];
    assert.throws(() => S.prepare(bad), /Left repair/);
    for (const a of f.advice.witness) g.window.stLab.act(a);
    assert.equal(read(g).proof.events.length, 1);
  }));

test('session replay: keyboard fresh-piece restarts identify restart boundaries', () =>
  withPage('st-lab.html', hidden, (g) => {
    for (const id of ['empty', 'marathon-rebuild']) {
      mode(g, id);
      g.window.stLab.act('L');
      g.tap('KeyR');
      const saved = read(g);
      assert.equal(saved.x.replay.boundary, 'restart');
      assert.deepEqual(saved.x.replay.steps, []);
    }
  }));
