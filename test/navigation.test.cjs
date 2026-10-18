const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ALL_PAGES, settings } = require('./support/pages.cjs');
const { withPage } = require('./support/page.cjs');

const pages = [...ALL_PAGES.map(p => p.page), 'controls.html'];
const expected = [
  ['About', 'https://github.com/swng/zztetris#readme'],
  ['Game Settings', null],
  ['practice', 'index.html'], ['cheese', 'cheese.html'], ['4w', '4w.html'],
  ['grav', 'grav.html'], ['pc', 'pc.html'], ['ST lab', 'st-lab.html'],
];

test('navigation/inventory: every shipped HTML screen has behavioral coverage', () => {
  assert.deepEqual(fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.html')).sort(), [...pages].sort());
});

for (const page of pages) test(`navigation/${page}: actual runtime menu, destinations, focus and settings activation`, () =>
  withPage(page, { storage: settings({ gravity: 'false' }) }, g => {
    const nav = g.element('nav[aria-label="Main navigation"]');
    const entries = [...nav.querySelectorAll('a, button')];
    assert.deepEqual(entries.map(el => [el.textContent.trim(), el.getAttribute('href')]), expected);
    assert.equal(g.window.document.querySelectorAll('nav[aria-label="Main navigation"]').length, 1);
    assert.equal(nav.parentElement, g.window.document.body, 'one top-level section on every page');
    assert.equal(entries[0].target, '_blank');
    assert.ok(entries[0].relList.contains('noopener'));
    for (const el of entries) {
      assert.ok(!el.disabled && el.tabIndex >= 0);
      el.focus(); assert.equal(g.window.document.activeElement, el);
    }
    for (const link of entries.filter(el => el.getAttribute('href')?.endsWith('.html'))) {
      assert.ok(pages.includes(path.basename(new URL(link.href).pathname)));
      // Observe actual click/default navigation at the host boundary. jsdom does
      // not implement browsing; destination pages themselves boot in this matrix.
      let activation;
      const host = event => { activation = { href: link.href, prevented: event.defaultPrevented }; event.preventDefault(); };
      g.window.addEventListener('click', host, { once: true });
      link.click();
      assert.deepEqual(activation, { href: new URL(link.getAttribute('href'), g.window.location.href).href, prevented: false });
    }
    const current = nav.querySelector('[aria-current="page"]');
    if (expected.some(([, href]) => href === page)) assert.equal(current?.getAttribute('href'), page);
    const before = g.snapshot();
    for (const code of ['Space', 'ArrowLeft', 'KeyR', 'KeyA']) {
      entries[1].dispatchEvent(new g.window.KeyboardEvent('keydown', { code, bubbles: true }));
      g.advance(20);
      entries[1].dispatchEvent(new g.window.KeyboardEvent('keyup', { code, bubbles: true }));
    }
    assert.deepEqual(g.snapshot(), before, 'focused navigation must not drop, move, restart or toggle the game');
    let opened;
    g.window.open = (...args) => { opened = args; return { closed: false }; };
    entries[1].click();
    if (page === 'controls.html') {
      assert.equal(opened, undefined, 'settings never opens another settings popup');
      assert.equal(g.window.document.activeElement, g.element('#das'));
    } else assert.deepEqual(opened, ['controls.html', 'popup', 'width=1200,height=800']);
    assert.deepEqual(g.snapshot(), before, 'navigation focus/settings leaves gameplay unchanged');
  }));

test('navigation/controls: popup mode link returns to opener, saving settings and closing once', () =>
  withPage('controls.html', { storage: settings() }, g => {
    const destinations = [];
    g.window.opener = { closed: false, location: { assign: href => destinations.push(href) } };
    const originalClose = g.window.close;
    let closed = 0; g.window.close = () => closed++;
    g.input('#das', '185'); g.click('#bag-boundaries');
    const link = g.element('nav a[href="st-lab.html"]');
    const event = new g.window.MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(destinations, ['https://zztetris.test/st-lab.html']);
    assert.equal(closed, 1);
    assert.equal(JSON.parse(g.storage().config)[11], '185');
    assert.equal(g.storage().bagBoundaries, 'true');
    const save = [...g.window.document.querySelectorAll('a, button')].find(el => el.textContent === 'Save & Close');
    assert.ok(save); save.click(); assert.equal(closed, 2, 'existing Save & Close still works');
    g.window.close = originalClose;
  }));

test('navigation/controls: modified link keeps native new-tab behavior even in popup', () =>
  withPage('controls.html', { storage: settings() }, g => {
    g.window.opener = { closed: false, location: { assign: () => assert.fail('must not redirect opener') } };
    const originalClose = g.window.close;
    let closed = 0; g.window.close = () => closed++;
    let prevented;
    g.window.addEventListener('click', e => { prevented = e.defaultPrevented; e.preventDefault(); }, { once: true });
    g.element('nav a[href="cheese.html"]').dispatchEvent(new g.window.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    assert.equal(prevented, false);
    assert.equal(closed, 0);
    g.window.close = originalClose;
  }));
