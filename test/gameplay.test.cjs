const test = require('node:test');
const assert = require('node:assert/strict');
const { ENGINES, settings, DEFAULT_CONFIG } = require('./support/pages.cjs');
const { withPage } = require('./support/page.cjs');

// Independent scenario input, not an alternative collision/landing algorithm.
// Isolate shared gameplay rules from mode startup (covered separately).
function arrange(g, obstacle = false) {
  const board = Array.from({ length: 40 }, () => Array.from({ length: 10 }, () => ({ t: 0, c: '' })));
  if (obstacle) board[18][6] = { t: 1, c: 'X' }; // immediately right of the spawning O
  g.window.board = g.window.JSON.parse(JSON.stringify(board));
  g.window.queue = g.window.JSON.parse(JSON.stringify('OILTSZJ|OILTSZJ|OILTSZJ|'.split('')));
  g.window.holdP = '';
  g.window.newPiece();
  assert.equal(g.window.piece, 'O');
}
function step(g, code) {
  g.key('keydown', code); g.advance(16);
  g.key('keyup', code); g.advance(16); // render observes release before another press
}

for (const page of ENGINES) {
  test(`gameplay/${page}/collision: heap and walls block real keyboard moves`, () => withPage(page, { storage: settings({ gravity: 'false' }) }, g => {
    arrange(g, true);
    assert.equal(g.window.xPOS, 3);
    step(g, 'ArrowRight');
    assert.equal(g.window.xPOS, 3); // O cannot move into X at (6,18)
    step(g, 'ArrowLeft');
    assert.equal(g.window.xPOS, 2);
    for (let i = 0; i < 6; i++) step(g, 'ArrowLeft');
    assert.equal(g.window.xPOS, -1); // the 2x2 O occupies columns 0 and 1
    assert.equal(g.window.yGHO, 37); // the O lands in rows 38 and 39
    assert.equal(g.snapshot().heap[18], '......X...');
  }));

  test(`gameplay/${page}/hold-drop-history: semantic undo and redo`, () => withPage(page, { storage: settings({ gravity: 'false' }) }, g => {
    arrange(g);
    g.tap('ShiftLeft');
    assert.equal(g.window.holdP, 'O');
    assert.equal(g.window.piece, 'I');
    const beforeRepeat = g.snapshot();
    g.key('keydown', 'ShiftLeft', true); g.key('keyup', 'ShiftLeft');
    assert.deepEqual(g.snapshot(), beforeRepeat);
    g.tap('ShiftLeft'); // this trainer intentionally permits repeated hold before a lock
    assert.equal(g.window.holdP, 'I');
    assert.equal(g.window.piece, 'O');
    g.tap('Space');
    const first = g.snapshot();
    assert.deepEqual(first.heap, [...Array(38).fill('..........'), '....OO....', '....OO....']);
    assert.equal(first.piece, 'L');
    assert.equal(first.hold, 'I');
    assert.deepEqual([first.x, first.y, first.rotation], [3, 17, 0]);
    g.tap('Space');
    const second = g.snapshot();
    assert.equal(second.history, first.history + 1);
    assert.equal(second.piece, 'T');
    assert.notDeepEqual(second.heap, first.heap);
    g.tap('KeyT');
    assert.deepEqual(g.snapshot(), first);
    g.tap('KeyY');
    assert.deepEqual(g.snapshot(), second);
  }));

  test(`timing/${page}: custom DAS/ARR repeats and release cancels; custom SDR`, () => {
    const config = [...DEFAULT_CONFIG]; config.splice(11, 3, '185', '31', '17');
    return withPage(page, { storage: settings({ config: JSON.stringify(config), gravity: 'false' }) }, g => {
      arrange(g);
      g.key('keydown', 'ArrowRight');
      assert.equal(g.window.xPOS, 3); // horizontal processing is in render, not keydown
      g.advance(6); // first animation frame at t=256, startup completed at t=250
      assert.equal(g.window.xPOS, 4);
      g.key('keydown', 'ArrowRight', true);
      g.advance(184); assert.equal(g.window.xPOS, 4);
      g.advance(1); assert.equal(g.window.xPOS, 4); // DAS expires, ARR interval starts
      g.advance(30); assert.equal(g.window.xPOS, 4);
      g.advance(1); assert.equal(g.window.xPOS, 5);
      g.key('keyup', 'ArrowRight');
      g.advance(200); assert.equal(g.window.xPOS, 5);
      const y = g.window.yPOS;
      g.key('keydown', 'ArrowDown');
      g.advance(16); assert.equal(g.window.yPOS, y);
      g.advance(1); assert.equal(g.window.yPOS, y + 1);
      g.key('keyup', 'ArrowDown');
      g.advance(34); assert.equal(g.window.yPOS, y + 1);
    });
  });
}
