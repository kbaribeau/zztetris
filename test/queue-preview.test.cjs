const test = require('node:test');
const assert = require('node:assert/strict');
const { PAGES, ENGINES, settings } = require('./support/pages.cjs');
const { withPage } = require('./support/page.cjs');

const noGravity = { storage: settings({ gravity: 'false' }) };
const strokes = g => g.preview().n.filter(call => call.path);
const sprites = g => g.preview().n.filter(call => call.piece).map(({ piece, x, y }) => [piece, x, y]);
const marker = y => ({ path: [[70, y], [88, y], [88, y === 2 ? 18 : y - 16]], width: 2, color: '#fff' });
const setQueue = (g, tokens) => {
  g.window.queue = g.window.JSON.parse(JSON.stringify(tokens));
  g.window.updateQueue();
};

for (const { page } of PAGES) {
  test(`preview/${page}: all six sprites and both explicit short-segment boundaries`, () => withPage(page, noGravity, g => {
    setQueue(g, 'I|TS|OJLZIT|'.split(''));
    assert.deepEqual(sprites(g), ['I', 'T', 'S', 'O', 'J', 'L'].map((p, i) => [p, 0, i * 60]));
    assert.deepEqual(strokes(g), [marker(58), marker(178)]);
    assert.equal(g.preview().h.length, 0);
  }));
}

for (const page of ENGINES) {
  test(`preview/${page}: top/bottom, repeated/trailing, unknown and absent boundaries`, () => withPage(page, noGravity, g => {
    setQueue(g, '|OIJLZTS|'.split(''));
    assert.deepEqual(strokes(g), [marker(2)]); // outgoing piece is active
    assert.deepEqual(sprites(g).map(([p]) => p), ['O', 'I', 'J', 'L', 'Z', 'T']);
    setQueue(g, 'IJLZTS|O'.split(''));
    assert.deepEqual(strokes(g), [marker(358)]); // visible sixth-piece corner, inside canvas
    setQueue(g, 'T||O'.split(''));
    assert.deepEqual(strokes(g), [marker(58)]); // repeated separator does not draw twice
    setQueue(g, 'TOIJSZ'.split(''));
    assert.deepEqual(strokes(g), []); // no inferred bag after six pieces
    setQueue(g, ['?', 'T', '|', 'O']);
    assert.deepEqual(sprites(g), [['T', 0, 60], ['O', 0, 120]]); // unknown import retains slot
    assert.deepEqual(strokes(g), [marker(118)]);
  }));

  test(`preview/${page}: spawn, both holds, history, reset, reshuffle and mirror redraw`, () => withPage(page, noGravity, g => {
    const w = g.window;
    w.queue = w.JSON.parse(JSON.stringify('OILTSZJ|OILTSZJ|OILTSZJ|'.split('')));
    w.holdP = '';
    w.newPiece();
    w.updateHistory(); // establish an actual history frame for this arranged queue
    assert.equal(w.piece, 'O'); assert.deepEqual(strokes(g), [marker(358)]);
    g.tap('ShiftLeft'); // empty hold consumes I
    assert.equal(w.piece, 'I'); assert.deepEqual(strokes(g), [marker(298)]);
    assert.deepEqual(g.preview().h.filter(call => call.piece).map(call => call.piece), ['O']);
    g.tap('ShiftLeft'); // occupied hold swaps without consuming queue
    assert.equal(w.piece, 'O'); assert.deepEqual(strokes(g), [marker(298)]);
    g.tap('Space'); // locks O and spawns L
    assert.equal(w.piece, 'L'); assert.deepEqual(strokes(g), [marker(238)]);
    g.tap('KeyT'); // undo restores the arranged queue (holds are not separate history frames)
    assert.deepEqual(strokes(g), [marker(358)]);
    g.tap('KeyY');
    assert.deepEqual(strokes(g), [marker(238)]);
    w.mirror();
    assert.deepEqual(strokes(g), [marker(238)]);
    if (page === 'cancellingsickness.html') g.input('#CancelStreak', '0');
    g.tap('KeyR'); // restart regenerates a normal seven-piece segment
    assert.deepEqual(strokes(g), [marker(358)]);
    w.shuffleQueue();
    assert.deepEqual(strokes(g), [marker(358)]);
  }));
}

test('preview/index.html: queue-edit prompt is a segment, not a fabricated seven-bag', () => withPage('index.html', noGravity, g => {
  g.window.prompt = () => 'TTOM';
  g.click('#n');
  assert.equal(g.window.piece, 'T');
  assert.deepEqual(sprites(g).map(([p]) => p).slice(0, 3), ['T', 'O', 'M']);
  assert.deepEqual(strokes(g), [marker(178)]);
}));

test('preview/index.html: separator-free TETRIO import clears a former marker', async () => withPage('index.html', noGravity, async g => {
  setQueue(g, 'T|OIJLZS'.split(''));
  assert.deepEqual(strokes(g), [marker(58)]);
  g.window.navigator.clipboard.readText = async () => '_'.repeat(400) + '?otij';
  await g.window.importTetrio();
  assert.deepEqual(sprites(g).map(([p]) => p), ['O', 'T', 'I', 'J']);
  assert.deepEqual(strokes(g), []);
}));

test('preview/pc.html: partial and special preset segment ends', () => withPage('pc.html', noGravity, g => {
  g.window.PC(2);
  assert.equal(g.window.queue.indexOf('|'), 3);
  assert.deepEqual(strokes(g), [marker(178)]);
  g.window.PC(9);
  assert.equal(g.window.queue.indexOf('|'), 3);
  assert.deepEqual(strokes(g), [marker(178)]);
}));

test('preview/cancellingsickness.html: augmented batches do not imply a six-slot seam', () => withPage('cancellingsickness.html', noGravity, g => {
  g.input('#CancelStreak', '20');
  g.tap('KeyR');
  assert.equal(g.window.queue.indexOf('|'), 7);
  assert.deepEqual(strokes(g), []);
  g.tap('Space');
  assert.equal(g.window.queue.indexOf('|'), 6);
  assert.deepEqual(strokes(g), [marker(358)]);
}));
