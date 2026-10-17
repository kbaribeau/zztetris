const test = require('node:test');
const assert = require('node:assert/strict');
const { PAGES, ENGINES, DEFAULT_CONFIG, settings } = require('./support/pages.cjs');
const { withPage } = require('./support/page.cjs');

const custom = [...DEFAULT_CONFIG];
custom.splice(11, 5, '185', '31', '17', '24', '37');
const storedConfig = JSON.stringify(custom);

for (const { page, cadence } of PAGES) {
  for (const preference of [undefined, 'true', 'false']) {
    test(`settings/${page}/${preference ?? 'absent'}: restore, tick, toggle, preserve config`, () => {
      const storage = settings({ config: storedConfig });
      if (preference !== undefined) storage.gravity = preference;
      return withPage(page, { storage }, g => {
        const enabled = preference !== 'false';
        assert.equal(g.element('#grav').checked, enabled);
        assert.equal(g.storage().gravity, preference);
        assert.deepEqual([g.window.DAS, g.window.ARR, g.window.SDR, g.window.cellSize, g.window.audiolevel], [185, 31, 17, 24, 37]);
        assert.equal(g.element('#b').width, 240);
        const y = g.window.yPOS;
        g.advance(cadence - 1);
        assert.equal(g.window.yPOS, y);
        g.advance(1);
        assert.equal(g.window.yPOS, y + Number(enabled));
        g.click('#grav'); // actual checkbox activation -> jQuery change handler
        assert.equal(g.element('#grav').checked, !enabled);
        assert.equal(g.storage().gravity, String(!enabled));
        const toggledY = g.window.yPOS;
        g.advance(cadence);
        assert.equal(g.window.yPOS, toggledY + Number(!enabled));
        assert.equal(g.storage().config, storedConfig);
        assert.equal(g.storage().version, '2023-05-02a');
      });
    });
  }
}

for (const preference of ['false', 'true']) {
  test(`persistence/${preference}: modeled reload and navigation across ten pages`, async () => {
    let storage = settings({ config: storedConfig, gravity: preference === 'false' ? 'true' : 'false' });
    await withPage('index.html', { storage }, g => { g.click('#grav'); storage = g.storage(); });
    for (const { page } of PAGES) {
      await withPage(page, { storage }, g => {
        assert.equal(g.element('#grav').checked, preference === 'true');
        assert.equal(g.storage().gravity, preference);
        assert.equal(g.storage().config, storedConfig);
        assert.equal(g.storage().version, '2023-05-02a');
        storage = g.storage();
      });
    }
  });
}

test('controls/edit: actual key/input handlers save values consumed by all engines', async () => {
  let saved;
  await withPage('controls.html', { storage: settings({ gravity: 'false' }) }, g => {
    g.click('[id="2"]');
    g.key('keydown', 'KeyD'); g.key('keyup', 'KeyD');
    for (const [selector, value] of [['#das', '185'], ['#arr', '31'], ['#sdr', '17'], ['#cellpx', '24'], ['#audiolevel', '37']]) g.input(selector, value);
    saved = g.storage();
    const values = JSON.parse(saved.config);
    assert.equal(values[1], 'KeyD');
    assert.deepEqual(values.slice(11), ['185', '31', '17', '24', '37']);
    assert.equal(saved.version, '2023-05-02a');
    assert.equal(saved.gravity, 'false');
  });
  for (const page of ENGINES) await withPage(page, { storage: saved }, g => {
    const x = g.window.xPOS;
    g.key('keydown', 'ArrowRight'); g.advance(16); g.key('keyup', 'ArrowRight');
    assert.equal(g.window.xPOS, x); // old binding is no longer active
    g.key('keydown', 'KeyD'); g.advance(16); g.key('keyup', 'KeyD');
    assert.equal(g.window.xPOS, x + 1);
    assert.deepEqual([g.window.DAS, g.window.ARR, g.window.SDR, g.window.cellSize, g.window.audiolevel], [185, 31, 17, 24, 37]);
    assert.equal(g.sounds.at(-1).volume, 0.37);
  });
});

test('controls/reset: real inline onclick deletes only config/version, then defaults reload', async () => {
  let saved;
  await withPage('controls.html', { storage: settings({ config: storedConfig, gravity: 'false', unrelated: 'keep' }) }, g => {
    g.resetControls();
    saved = g.storage();
    assert.deepEqual(saved, { gravity: 'false', unrelated: 'keep' });
  });
  await withPage('controls.html', { storage: saved }, g => {
    assert.equal(g.element('#das').value, '160');
    assert.equal(g.element('#arr').value, '30');
    assert.equal(g.element('#sdr').value, '15');
    assert.equal(g.element('#cellpx').value, '20');
    assert.equal(g.element('#audiolevel').value, '100');
  });
  for (const page of ENGINES) await withPage(page, { storage: saved }, g => {
    assert.equal(g.element('#grav').checked, false);
    assert.deepEqual(JSON.parse(g.storage().config), DEFAULT_CONFIG);
    assert.equal(g.storage().unrelated, 'keep');
  });
});
