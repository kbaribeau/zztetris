const test = require('node:test');
const assert = require('node:assert/strict');
const { ALL_PAGES, PAGES, ENGINES, settings, DEFAULT_CONFIG } = require('./support/pages.cjs');
const { boot, withPage } = require('./support/page.cjs');
const paths = g => g.preview().n.filter(call => call.path);
const sprites = g => g.preview().n.filter(call => call.piece);
const state = g => JSON.stringify([g.snapshot(), g.window.board, g.window.hist, g.window.lastAction, g.window.held]);
// jsdom windows do not share storage. Deliver the platform's cross-window event
// after copying the saved value; real browser popup propagation is checked separately.
function receive(g, key, value) {
  const w = g.window, oldValue = w.localStorage.getItem(key);
  if (value === null) w.localStorage.removeItem(key); else w.localStorage.setItem(key, value);
  w.dispatchEvent(new w.StorageEvent('storage', { key, oldValue, newValue: value, storageArea: w.localStorage }));
}

for (const { page } of PAGES) {
  for (const preference of [undefined, 'false', 'true']) {
    test(`training/${page}/${preference ?? 'missing'}: bag preference, immediate redraw, state preservation and reload`, async () => {
      const config = [...DEFAULT_CONFIG]; config[1] = 'KeyD';
      const storage = settings({ gravity: 'false', config: JSON.stringify(config), stAdviceKey: 'KeyB', unrelated: 'keep' });
      if (preference !== undefined) storage.bagBoundaries = preference;
      let saved;
      await withPage(page, { storage }, g => {
        assert.equal(g.window.TrainingSettings.bagBoundaries, preference === 'true');
        assert.equal(paths(g).length, preference === 'true' && page !== 'cancellingsickness.html' ? 1 : 0);
        // Both leading (outgoing top cue) and short explicit custom segments.
        g.window.queue = g.window.JSON.parse(JSON.stringify('|I|TS|OJLZ'.split('')));
        g.window.updateQueue();
        const before = state(g), pieces = sprites(g);
        assert.equal(pieces.length, 6);
        for (const enabled of [true, false, true, false]) {
          receive(g, 'bagBoundaries', String(enabled));
          assert.equal(paths(g).length, enabled ? 3 : 0);
          if (enabled) {
            assert.deepEqual(paths(g).map(c => c.path[0][1]), [2, 58, 178]);
            assert.ok(paths(g).every(c => c.width === 2 && c.path[0][0] === 70));
          }
          assert.deepEqual(sprites(g), pieces);
          assert.equal(state(g), before, 'no board/queue/hold/ghost/history mutation');
        }
        assert.equal(g.storage().config, storage.config);
        assert.equal(g.storage().stAdviceKey, 'KeyB');
        assert.equal(g.storage().version, storage.version);
        assert.equal(g.storage().unrelated, 'keep');
        saved = g.storage();
      });
      await withPage(page, { storage: saved }, g => {
        assert.equal(g.window.TrainingSettings.bagBoundaries, false);
        assert.equal(paths(g).length, 0);
        receive(g, 'bagBoundaries', null);
        assert.equal(paths(g).length, 0, 'removing preference restores default off');
      });
    });
  }
}

for (const page of ENGINES) {
  test(`training/${page}: popup close after display-only edits does not reload/restart`, () => withPage(page, { storage: settings({ gravity: 'false' }) }, g => {
    const popup = { closed: false };
    g.window.open = (url, name) => { assert.equal(url, 'controls.html'); assert.equal(name, 'popup'); return popup; };
    g.window.ctrlsPopup();
    const before = state(g);
    receive(g, 'bagBoundaries', 'true'); receive(g, 'stGuideVisible', 'false');
    popup.closed = true; g.advance(100);
    assert.equal(state(g), before); // unexpected navigation also fails the harness
    assert.equal(paths(g).length, page === 'cancellingsickness.html' ? 0 : 1);
  }));

  test(`training/${page}: on/off have identical gameplay, hold, history, shuffle and mirror`, async () => {
    const results = [];
    for (const bagBoundaries of ['false', 'true']) await withPage(page, { storage: settings({ gravity: 'false', bagBoundaries }) }, g => {
      g.tap('ShiftLeft'); g.tap('ShiftLeft'); g.tap('Space'); g.tap('KeyT'); g.tap('KeyY');
      g.window.mirror(); g.window.shuffleQueue();
      results.push([state(g), sprites(g)]);
    });
    assert.deepEqual(results[0], results[1]);
  });
}

for (const bag of [undefined, 'true', 'false']) for (const guide of [undefined, 'true', 'false']) {
  test(`training/controls: grouped, labeled, persisted and reloaded (${bag}/${guide})`, async () => {
    const storage = settings({ stAdviceKey: 'KeyB' });
    if (bag !== undefined) storage.bagBoundaries = bag;
    if (guide !== undefined) storage.stGuideVisible = guide;
    let saved;
    await withPage('controls.html', { storage }, g => {
      const heading = g.element('#training-heading'), table = heading.closest('table');
      assert.equal(heading.textContent, 'Training');
      for (const id of ['bag-boundaries', 'st-guide-visible']) {
        const input = g.element('#' + id);
        assert.equal(input.closest('table'), table);
        assert.ok(heading.compareDocumentPosition(input) & g.window.Node.DOCUMENT_POSITION_FOLLOWING);
        assert.ok(g.element(`label[for="${id}"]`).textContent.length);
        assert.ok(g.element('#' + input.getAttribute('aria-describedby')).textContent.length);
      }
      assert.equal(g.element('#bag-boundaries').checked, bag === 'true');
      assert.equal(g.element('#st-guide-visible').checked, guide !== 'false');
      assert.match(g.element('#st-guide-help').textContent, /ST lab free play only, never other modes/);
      g.click('#bag-boundaries'); g.click('#st-guide-visible');
      saved = g.storage();
      assert.equal(saved.bagBoundaries, String(bag !== 'true'));
      assert.equal(saved.stGuideVisible, String(guide === 'false'));
      assert.equal(saved.config, storage.config); assert.equal(saved.stAdviceKey, 'KeyB');
      receive(g, 'stGuideVisible', 'true'); assert.equal(g.element('#st-guide-visible').checked, true);
      receive(g, 'stGuideVisible', 'false'); assert.equal(g.element('#st-guide-visible').checked, false);
    });
    await withPage('controls.html', { storage: saved }, g => {
      assert.equal(g.element('#bag-boundaries').checked, saved.bagBoundaries === 'true');
      assert.equal(g.element('#st-guide-visible').checked, saved.stGuideVisible === 'true');
    });
  });
}

for (const preference of [undefined, 'true', 'false']) {
  test(`training/lab/${preference ?? 'missing'}: shared setting, hotkey and button stay synchronized through entry/reload`, async () => {
    const storage = settings({ stAdviceKey: 'KeyB' });
    if (preference !== undefined) storage.stGuideVisible = preference;
    const controls = await boot('controls.html', { storage });
    let saved;
    try {
      await withPage('st-lab.html', { storage }, g => {
        g.window.stLab.loadFixture('o-filler');
        const check = enabled => {
          assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'), String(enabled));
          assert.equal(g.element('#st-target').children.length, 0);
        };
        check(preference !== 'false');
        const before = state(g);
        controls.click('#st-guide-visible');
        receive(g, 'stGuideVisible', controls.storage().stGuideVisible);
        check(preference === 'false');
        assert.equal(state(g), before);
        g.tap('KeyB'); check(preference !== 'false');
        receive(controls, 'stGuideVisible', g.storage().stGuideVisible);
        assert.equal(controls.element('#st-guide-visible').checked, preference !== 'false');
        g.key('keydown', 'KeyB', true); g.key('keyup', 'KeyB'); check(preference !== 'false');
        g.click('#st-toggle'); check(preference === 'false');
        assert.equal(state(g), before);
        g.tap('KeyR'); g.window.stLab.loadFixture('o-filler'); check(preference === 'false'); // restart preserves the preference even while coaching is unavailable
        saved = g.storage();
      });
      await withPage('st-lab.html', { storage: saved }, g => {
        g.window.stLab.loadFixture('o-filler'); assert.equal(g.element('#st-toggle').getAttribute('aria-pressed'), saved.stGuideVisible);
      });
    } finally { controls.dispose(); }
  });
}

for (const { page } of PAGES) test(`training/${page}: guide preference and key never create normal-play advice`, () => withPage(page, { storage: settings({ gravity: 'false', stGuideVisible: 'true' }) }, g => {
  const before = state(g);
  g.tap('KeyA'); receive(g, 'stGuideVisible', 'false'); receive(g, 'stGuideVisible', 'true');
  assert.equal(state(g), before); assert.equal(g.window.stLab, undefined);
  assert.equal(g.window.document.querySelector('#st-target'), null);
}));

test('training/controls: explicit reset restores both defaults without deleting unrelated settings', async () => {
  let saved;
  await withPage('controls.html', { storage: settings({ bagBoundaries: 'true', stGuideVisible: 'false', gravity: 'false', unrelated: 'keep' }) }, g => {
    g.resetControls(); saved = g.storage();
    assert.deepEqual(saved, { gravity: 'false', unrelated: 'keep' });
  });
  await withPage('controls.html', { storage: saved }, g => {
    assert.equal(g.element('#bag-boundaries').checked, false);
    assert.equal(g.element('#st-guide-visible').checked, true);
  });
});
