const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, withPage } = require('./support/page.cjs');
const { settings, SEED } = require('./support/pages.cjs');

test('host/isolation: fresh realms reset prototypes, storage, clocks and seeded state', async () => {
  let initial;
  const nodeShuffle = Array.prototype.shuffle;
  await withPage('index.html', { seed: SEED, storage: settings() }, g => {
    initial = g.snapshot();
    assert.equal(g.clock.now, 250);
    g.window.localStorage.setItem('leak', 'no');
    g.window.Array.prototype.realmOnly = true;
    g.tap('Space'); g.advance(1000);
  });
  await withPage('index.html', { seed: SEED, storage: settings() }, g => {
    assert.deepEqual(g.snapshot(), initial);
    assert.equal(g.clock.now, 250);
    assert.equal(g.storage().leak, undefined);
    assert.equal(g.window.Array.prototype.realmOnly, undefined);
  });
  assert.equal(Array.prototype.shuffle, nodeShuffle);
  assert.equal(Array.prototype.realmOnly, undefined);
});

test('host/offline: unknown resource requests fail closed without network fallback', async () => {
  const g = await boot('index.html', { storage: settings() });
  try {
    const script = g.window.document.createElement('script');
    script.src = 'https://not-allowed.invalid/never-fetch.js';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Denied script did not settle')), 1000);
      script.addEventListener('error', () => { clearTimeout(timeout); resolve(); }, { once: true });
      g.window.document.head.append(script);
    });
    assert.ok(g.requests.includes(script.src));
    assert.throws(() => g.healthy(), /Denied resource/);
  } finally { assert.throws(() => g.dispose(), /Denied resource/); }
});

test('host/errors: unexpected explicit network and unhandled event errors cannot pass', async () => {
  const g = await boot('index.html', { storage: settings() });
  try {
    assert.throws(() => new g.window.XMLHttpRequest().open('GET', 'https://not-allowed.invalid', false), /forbidden/);
    g.window.addEventListener('synthetic-error', () => { throw new Error('sentinel event failure'); });
    g.window.dispatchEvent(new g.window.Event('synthetic-error'));
    assert.throws(() => g.healthy(), /sentinel event failure/);
  } finally { assert.throws(() => g.dispose(), /sentinel event failure/); }
});
