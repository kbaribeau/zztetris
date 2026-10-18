const test = require('node:test');
const assert = require('node:assert/strict');
const { PAGES, settings } = require('./support/pages.cjs');
const { withPage, JQUERY } = require('./support/page.cjs');

for (const { page, engine, mode } of PAGES) {
  test(`boot/${page}: actual scripts and mode initialize`, () => withPage(page, {}, g => {
    const w = g.window;
    assert.equal(w.jQuery.fn.jquery, '3.6.0');
    assert.deepEqual(g.requests.filter(url => url.endsWith('.js')).map(url => url === JQUERY ? 'jquery' : new URL(url).pathname.slice(1)),
      ['jquery', 'rotationSystem.js', 'io.js', 'training-settings.js', 'utils.js', 'tetris-fumen.js', engine, 'tetrio.js', mode]);
    assert.equal(w.board.length, 40);
    assert.ok(w.board.every(row => row.length === 10));
    assert.match(w.piece, /^[ZLOSIJT]$/);
    assert.ok(w.queue.length >= 10);
    assert.ok(w.board.flat().some(cell => cell.t === 2));
    assert.ok(g.clock.countTimers() > 0);
    assert.equal(g.element('#grav').checked, true);
    assert.equal(g.storage().gravity, undefined);

    const heap = g.snapshot().heap;
    if (/^4w/.test(page)) {
      const expected = { '4w.html': 3, '4w4res.html': 4, '4w5res.html': 5, '4w6res.html': 6 }[page];
      for (const row of heap) { assert.equal(row.slice(0, 3), 'XXX'); assert.equal(row.slice(7), 'XXX'); }
      assert.equal(heap.reduce((n, row) => n + [...row.slice(3, 7)].filter(c => c === 'X').length, 0), expected);
    } else if (page === '3w.html') {
      assert.ok(heap.slice(0, 20).every(row => row === '..........'));
      assert.ok(heap.slice(20).every(row => row === 'XXX...XXXX'));
    } else if (page === 'cheese.html') {
      assert.ok(heap.slice(0, 30).every(row => row === '..........'));
      const holes = heap.slice(30).map(row => {
        assert.equal([...row].filter(c => c === 'X').length, 9);
        return row.indexOf('.');
      });
      assert.ok(holes.every((hole, i) => i === 0 || hole !== holes[i - 1]));
    } else assert.ok(heap.every(row => row === '..........'));
  }));
}

test('boot/controls.html: real inline script restores custom config', () => {
  const config = JSON.parse(settings().config); config[11] = '185';
  return withPage('controls.html', { storage: settings({ config: JSON.stringify(config) }) }, g => {
    assert.equal(g.window.jQuery.fn.jquery, '3.6.0');
    assert.equal(g.element('#das').value, '185');
    assert.equal(g.element('[id="1"]').textContent, 'ArrowLeft');
  });
});

test('mode/cancelling: threshold 19 to 20 adds exactly one O per bag', async () => {
  const bags = [];
  for (const streak of [19, 20]) {
    await withPage('cancellingsickness.html', { storage: settings({ gravity: 'false' }) }, g => {
      g.input('#CancelStreak', String(streak));
      g.tap('KeyR'); // production restart, including production bag refill
      const bag = [g.window.piece, ...g.window.queue.slice(0, g.window.queue.indexOf('|'))];
      bags.push([...bag].sort());
    });
  }
  assert.deepEqual(bags[0], ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  assert.deepEqual(bags[1], ['I', 'J', 'L', 'O', 'O', 'S', 'T', 'Z']);
});
