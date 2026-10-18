const test = require('node:test');
const assert = require('node:assert/strict');
const { ENGINES, settings } = require('./support/pages.cjs');
const { withPage } = require('./support/page.cjs');

for (const page of ENGINES) for (const order of ['in-order', 'last-listed-first']) {
  test(`image-startup/${page}/${order}: wait for every sprite, then start once`, () =>
    withPage(page, { storage: settings({ gravity: 'false' }), autoLoadImages: false }, g => {
      const w = g.window;
      let starts = 0, frames = 0;
      // Observe calls while still executing the actual game entry and frame scheduler.
      const game = w.game, requestFrame = w.requestAnimationFrame;
      w.game = (...args) => { starts++; return game(...args); };
      w.requestAnimationFrame = callback => { frames++; return requestFrame(callback); };
      // A literal two-bag fixture guarantees that pending Z is needed by NEXT,
      // rather than accidentally being the active piece (a masking condition).
      w.queue = w.Array.from('IZLOSTJ|IZLOSTJ|');
      const pending = g.images.find(image => image.src.endsWith('/z.png'));
      assert.ok(pending);
      assert.ok(g.images.at(-1).src.endsWith(page === 'index.html' ? '/m.png' : '/t.png'));
      const load = image => { image.complete = true; image.onload(); };
      const notStarted = () => {
        assert.equal(starts, 0);
        assert.equal(w.hist.length, 0);
        assert.equal(frames, 0);
        assert.equal(g.preview().n.length, 0);
      };
      notStarted();
      if (order === 'last-listed-first') {
        for (const image of [...g.images].reverse()) if (image !== pending) load(image);
        g.advance(1000); // past the old 250ms last-listed-sprite grace period
        notStarted();
        assert.equal(pending.complete, false);
        load(pending);
      } else {
        for (const image of g.images) load(image);
      }
      notStarted(); // preserve the existing delay, but only after readiness
      g.advance(250);
      assert.equal(starts, 1);
      assert.equal(w.hist.length, 1);
      assert.equal(w.histPos, 0);
      assert.ok(w.board.flat().some(cell => cell.t === 2));
      assert.ok(frames > 0, 'board frame scheduled');
      assert.equal(g.preview().n.filter(call => call.piece).length, 6);
      assert.ok(g.images.every(image => image.complete));
      g.healthy(); // canvas adapter rejects URL strings and incomplete image arguments
      g.advance(1000);
      assert.equal(starts, 1, 'no second startup after further timers/frames');
      assert.ok(frames > 1, 'real board render loop runs');
    }));
}
