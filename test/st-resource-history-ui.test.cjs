'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { withPage } = require('./support/page.cjs');
const R = require('../st-rules');
const H = require('../st-resource-history');
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const resources = g => clone(g.window.stLab.resources);
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
    constructor() { all.push(this); }
    postMessage(message) { this.message = clone(message); }
    terminate() { this.terminated = true; }
    respond(result) {
      this.onmessage({ data: { type: 'result', id: this.message.id,
        revision: this.message.observation.revision, result } });
    }
  };
  return all;
}
const request = (g, all) => { g.advance(40); return all.at(-1).message; };
const allocationFacts = diagnostic => ({ locks: diagnostic.locks, center: diagnostic.center,
  hangingS: diagnostic.hangingS, extraZ: diagnostic.extraZ });

// Captured from the actual unmodified controller at local d836598 / public
// 7401810 (tree 2edd62c6), seed 42, with the exact actions below. These are
// observable worker-message hashes, not source-code snapshots. No planner is
// mocked to change the message content. The new replay context is checked
// independently, while every pre-existing message field retains this oracle.
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

test('resource history UI: replay context is validated while prior worker fields remain identical through HOLD, locks, Undo, branch, restarts and import', () => withPage('st-lab.html', { seed: 42 }, g => {
  const all = workers(g), actual = [];
  const capture = () => {
    const message=request(g,all),proof=message.options.resourceContext;
    assert.ok(proof,'Every active observation carries its bounded replay context');
    assert.deepEqual(H.resolve(message.observation,H.importContext(message.observation,proof)),resources(g));
    const prior=clone(message);delete prior.options.resourceContext;actual.push(hash(prior));
  };
  select(g, 'empty'); capture();
  for (const action of ['HOLD', 'L', 'CW', 'HD', 'HOLD', 'HOLD', 'R', 'HD', 'UNDO', 'R180', 'HD']) {
    g.window.stLab.act(action); capture();
  }
  g.click('#st-reset'); capture();
  g.tap('KeyR'); capture();
  select(g, 'marathon-rebuild'); capture();
  g.click('#st-export'); g.click('#st-import'); capture();
  assert.deepEqual(actual, BASELINE_REQUESTS);
  const message = all.at(-1).message;
  for (const section of [message, message.observation, message.options]) {
    for (const key of ['resources', 'resourceHistory', 'hangingS', 'extraZ', 'pieceOrigins', 'future']) {
      assert.equal(key in section, false, `Unvalidated diagnostic claims must not enter the planner: ${key}`);
    }
  }
}));

test('resource history UI: local empty origin is known but imported and stable history remain unknown', () => withPage('st-lab.html', { seed: 42 }, g => {
  assert.equal(resources(g).coverage.status, 'partial');
  select(g, 'empty');
  const known = resources(g), visible = g.snapshot();
  assert.equal(known.coverage.status, 'complete');
  assert.equal(known.locks, 0); assert.equal(known.actions, 0);
  assert.equal(known.instances.active.type, visible.active.type);
  assert.equal(known.instances.hold, null);
  assert.deepEqual(known.instances.queue.map(p => p.type), visible.queue);
  assert.equal(new Set([known.instances.active, ...known.instances.queue].map(p => p.id)).size, 7);
  assert.equal(known.extraZ.status, 'unknown', 'Empty origin is not a verified Midgame baseline');
  importState(g, { ...visible, resources: known, resourceHistory: known,
    hangingS: { status: 'none-observed' }, extraZ: { status: 'available' } });
  const imported = resources(g);
  assert.equal(imported.coverage.status, 'partial');
  assert.equal(imported.extraZ.status, 'unknown');
  assert.equal(imported.hangingS.status, 'unknown');
  assert.equal(imported.locks, 0);
  select(g, 'marathon-rebuild');
  assert.equal(resources(g).coverage.status, 'partial');
  assert.equal(resources(g).extraZ.status, 'unknown');
}));

test('resource history UI: unlimited HOLD preserves observed identities and movement never consumes allocations', () => withPage('st-lab.html', { seed: 42 }, g => {
  select(g, 'empty');
  const start = resources(g), first = start.instances.active, next = start.instances.queue[0];
  g.window.stLab.act('HOLD');
  const held = resources(g);
  assert.equal(held.instances.hold.id, first.id);
  assert.equal(held.instances.active.id, next.id);
  assert.deepEqual(allocationFacts(held), allocationFacts(start));
  for (let i = 0; i < 4; i++) g.window.stLab.act('HOLD');
  const repeated = resources(g);
  assert.deepEqual(repeated.instances, held.instances);
  for (const action of ['L', 'CW', 'R', 'SD']) g.window.stLab.act(action);
  assert.deepEqual(resources(g).instances, repeated.instances);
  assert.deepEqual(allocationFacts(resources(g)), allocationFacts(start));
  g.window.stLab.act('HD');
  assert.equal(resources(g).locks, 1);
  assert.equal(resources(g).instances.hold.id, first.id);
  assert.notEqual(resources(g).instances.active.id, next.id, 'Locked identity cannot remain active');
}));

test('resource history UI: identical-letter HOLD swaps distinct instances without inventing known age', () => withPage('st-lab.html', {}, g => {
  importState(g, R.createState({ active: 'S', hold: 'S', queue: ['L', 'I', 'O', 'T', 'Z', 'J'] }));
  const start = resources(g), a = start.instances.active.id, h = start.instances.hold.id;
  assert.notEqual(a, h);
  assert.equal(start.coverage.status, 'partial');
  g.window.stLab.act('HOLD');
  let current = resources(g);
  assert.equal(current.instances.active.id, h); assert.equal(current.instances.hold.id, a);
  assert.deepEqual(current.instances.queue, start.instances.queue);
  g.window.stLab.act('HOLD'); current = resources(g);
  assert.deepEqual(current.instances, start.instances);
  assert.equal(current.hangingS.status, 'unknown'); assert.equal(current.extraZ.status, 'unknown');
  assert.equal(current.locks, 0);
}));

test('resource history UI: Undo restores the pre-turn history including HOLD and branched identities', () => withPage('st-lab.html', { seed: 42 }, g => {
  select(g, 'empty'); const start = resources(g);
  for (const action of ['HOLD', 'L', 'CW', 'HD']) g.window.stLab.act(action);
  assert.equal(resources(g).locks, 1);
  g.window.stLab.act('UNDO'); assert.deepEqual(resources(g), start);
  g.window.stLab.act('R'); g.window.stLab.act('HD'); const branch = resources(g);
  assert.equal(branch.locks, 1); assert.equal(branch.instances.hold, null);
  g.window.stLab.act('UNDO'); assert.deepEqual(resources(g), start);
  g.window.stLab.act('R'); g.window.stLab.act('HD'); assert.deepEqual(resources(g), branch);
}));

test('resource history UI: top-out lock is counted exactly once and Undo restores missing-history status', () => withPage('st-lab.html', {}, g => {
  const board = R.emptyBoard(); board[20] = 'XXXXXXXXX.';
  importState(g, R.createState({ board, active: 'O', queue: [] }));
  const start = resources(g);
  g.window.stLab.act('HD');
  assert.equal(g.snapshot().topOut, true);
  assert.equal(resources(g).terminal, true);
  assert.match(g.element('#st-resource-summary').textContent, /Game ended; historical facts only/);
  assert.equal(resources(g).locks, 1);
  const ended = resources(g); g.window.stLab.act('HD');
  assert.deepEqual(resources(g), ended, 'Terminal repeated action must not duplicate accounting');
  g.window.stLab.act('UNDO'); assert.deepEqual(resources(g), start);
}));

test('resource history UI: replay-current, fresh restart, and mode changes discard prior counters', () => withPage('st-lab.html', { seed: 42 }, g => {
  select(g, 'empty'); const first = resources(g);
  g.window.stLab.act('HD'); assert.equal(resources(g).locks, 1);
  g.click('#st-reset');
  assert.equal(resources(g).locks, 0); assert.equal(resources(g).actions, 0);
  assert.equal(resources(g).coverage.status, 'complete');
  assert.deepEqual(resources(g).instances, first.instances);
  g.window.stLab.act('HD'); g.tap('KeyR');
  assert.equal(resources(g).locks, 0); assert.equal(resources(g).actions, 0);
  assert.equal(resources(g).coverage.status, 'complete');
  assert.equal(resources(g).instances.active.type, g.snapshot().active.type);
  select(g, 'marathon-rebuild'); g.window.stLab.act('HD'); g.tap('KeyR');
  assert.equal(resources(g).locks, 0);
  assert.equal(resources(g).coverage.status, 'partial', 'Fresh pieces do not establish a preexisting board history');
  assert.equal(resources(g).extraZ.status, 'unknown');
}));

test('resource history UI: diagnostics stay outside snapshots and ignore stale or injected worker fields', () => withPage('st-lab.html', { seed: 42 }, g => {
  const all = workers(g); select(g, 'empty'); request(g, all);
  const stale = all.at(-1), before = resources(g);
  g.window.stLab.act('HOLD'); request(g, all); const held = resources(g);
  const forged = { status: 'no-supported-continuation-found', reason: 'Test result',
    resources: { coverage: { status: 'complete' }, extraZ: { status: 'available' }, locks: 900 },
    resourceHistory: { extraZ: { status: 'available' } } };
  stale.respond(forged); assert.deepEqual(resources(g), held);
  all.at(-1).respond(forged); assert.deepEqual(resources(g), held);
  g.click('#st-export');
  const exported = JSON.parse(g.element('#st-snapshot').value);
  assert.deepEqual(exported, {...g.snapshot(),suggestedFileName:'st-lab-coaching-export.json'});
  for (const key of ['resources', 'resourceHistory', 'hangingS', 'extraZ', 'pieceOrigins']) assert.equal(key in exported, false);
  const display = JSON.parse(g.element('#st-diagnostic-text').textContent);
  assert.deepEqual(display.resources, held);
  // A caller receives diagnostics, not the mutable trusted reducer state.
  const exposed = g.window.stLab.resources;
  try { exposed.extraZ.status = 'available'; exposed.locks = 123; } catch { /* Frozen copies are valid too. */ }
  assert.deepEqual(resources(g), held);
  assert.equal(before.locks, 0);
}));

test('resource history UI: starting in maintenance does not invent an observed opening handoff', () => withPage('st-lab.html', {}, g => {
  const all = workers(g); select(g, 'marathon-rebuild'); request(g, all);
  assert.equal(resources(g).milestones.maintenanceHandoff, null);
  all.at(-1).respond({ status: 'no-supported-continuation-found', reason: 'No checked continuation.' });
  assert.equal(resources(g).milestones.maintenanceHandoff, null,
    'An unsupported response in an already-maintenance fixture is not a verified phase transition');
  assert.equal(resources(g).milestones.firstTsd, null);
  assert.equal(resources(g).extraZ.status, 'unknown');
}));

test('resource history UI: ignored movement and unsupported actions cannot duplicate history', () => withPage('st-lab.html', { seed: 42 }, g => {
  select(g, 'empty');
  for (let i = 0; i < 10; i++) g.window.stLab.act('L');
  const atWall = resources(g), state = g.snapshot();
  for (const action of ['L', 'L', 'NOT_AN_ACTION']) g.window.stLab.act(action);
  assert.deepEqual(g.snapshot(), state);
  assert.deepEqual(resources(g), atWall);
  assert.equal(resources(g).locks, 0);
}));
