const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const FakeTimers = require('@sinonjs/fake-timers');
const { ALL_PAGES, SEED } = require('./pages.cjs');

const ROOT = path.resolve(__dirname, '../..');
const ORIGIN = 'https://zztetris.test/';
const JQUERY = 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js';
const ANIMATE = 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css';
const files = [...new Set([
  'rotationSystem.js', 'io.js', 'utils.js', 'tetris-fumen.js', 'tetrio.js',
  ...ALL_PAGES.flatMap(({ engine, mode }) => [engine, mode]),
  'st-core.js', 'st-binding.js', 'st-lab.js', 'training-settings.js', 'styles/st-lab.css',
  'navigation.js', 'styles/navigation.css',
  'styles/zztetris.css', 'styles/paint_bucket.css',
  'styles/import_export.css', 'styles/board_settings.css',
])];
const resources = new Map(files.map(file => [new URL(file, ORIGIN).href, path.join(ROOT, file)]));
resources.set(JQUERY, require.resolve('jquery/dist/jquery.js'));
const spriteFiles = ['grid', 'z', 'l', 'o', 's', 'i', 'j', 't', 'm']
  .map(name => `assets/pieceSprite/${name}.png`);
const audioFiles = ['Move', 'Rotate', 'Hold', 'HardDrop', 'ClearTetra', 'PerfectClear']
  .map(name => `assets/sfx/${name}.wav`);

// Only host effects are substituted. In particular render/checkShift/game stay real.
async function boot(page, { storage = {}, seed = SEED, autoLoadImages = true } = {}) {
  assert.ok(page === 'controls.html' || ALL_PAGES.some(p => p.page === page), `Unknown page: ${page}`);
  const errors = [], requests = [], trace = [], images = [], sounds = [];
  const previewDraws = { n: [], h: [] }; // actual canvas calls, not pixel emulation
  let dom, clock, window, loadTimer, navigationExpected = false, navigationCount = 0, disposed = false;
  let randomState = seed >>> 0, randomCalls = 0;
  const fail = message => { const error = new Error(message); errors.push(error); throw error; };
  const console = new VirtualConsole();
  console.on('jsdomError', error => {
    // location.reload is unforgeable in jsdom. Accept exactly this expected host
    // diagnostic during the real Reset onclick; assert it occurred, then re-boot.
    if (navigationExpected && error.type === 'not-implemented' && /navigation/i.test(error.message)) {
      navigationCount++;
    } else errors.push(error);
  });
  console.on('error', (...args) => errors.push(new Error(args.join(' '))));
  const clean = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(loadTimer);
    try { clock?.reset(); clock?.uninstall(); } finally { window?.close(); }
  };
  const healthy = () => {
    if (errors.length) throw new AggregateError(errors, `Host errors on ${page}: ${errors.map(e => e.message).join('; ')}`);
  };
  try {
    dom = new JSDOM(fs.readFileSync(path.join(ROOT, page), 'utf8'), {
      url: new URL(page, ORIGIN).href,
      runScripts: 'dangerously', // trusted repository HTML only; enables actual inline handlers
      pretendToBeVisual: true,
      virtualConsole: console,
      resources: { interceptors: [requestInterceptor(request => {
        requests.push(request.url);
        if (request.url === ANIMATE) return new Response('', { headers: { 'content-type': 'text/css' } });
        const file = resources.get(request.url);
        if (!file) {
          errors.push(new Error(`Denied resource: ${request.url}`));
          return new Response('Denied', { status: 403 }); // never fall through to network
        }
        return new Response(fs.readFileSync(file), {
          headers: { 'content-type': file.endsWith('.css') ? 'text/css' : 'application/javascript' },
        });
      })] },
      beforeParse(w) {
        window = w;
        clock = FakeTimers.withGlobal(w).install({ now: 0, loopLimit: 2000,
          toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval',
            'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        for (const [key, value] of Object.entries(storage)) w.localStorage.setItem(key, value);
        w.Math.random = () => {
          if (++randomCalls > 10000) return fail('Random-call budget exceeded');
          randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
          return randomState / 2 ** 32;
        };
        w.addEventListener('error', event => errors.push(event.error || new Error(event.message)));
        w.addEventListener('unhandledrejection', event => errors.push(event.reason));
        // Synchronous XHR bypasses jsdom interceptors; forbid ALL explicit network clients.
        w.XMLHttpRequest = class { open() { fail('XMLHttpRequest forbidden'); } send() { fail('XMLHttpRequest forbidden'); } };
        w.WebSocket = class { constructor() { fail('WebSocket forbidden'); } };
        w.fetch = () => fail('fetch forbidden');
        w.navigator.sendBeacon = () => fail('sendBeacon forbidden');
        w.alert = text => trace.push({ alert: String(text) }); // existing first-run 3w/cancelling notice
        w.prompt = () => fail('Unexpected prompt');
        w.open = () => fail('Unexpected popup');
        Object.defineProperty(w.navigator, 'clipboard', { value: {
          readText: () => fail('Unexpected clipboard read'), writeText: () => fail('Unexpected clipboard write'),
        } });
        const asset = (value, allowlist) => {
          const url = new URL(value, w.location.href);
          const name = url.pathname.slice(1);
          if (url.origin !== new URL(ORIGIN).origin || !allowlist.includes(name)) fail(`Denied asset: ${url.href}`);
          fs.accessSync(path.join(ROOT, name));
          return url.href;
        };
        w.Image = class {
          constructor() { this.complete = false; images.push(this); }
          set src(value) { this.url = asset(value, spriteFiles); }
          get src() { return this.url; }
        };
        w.Audio = class {
          constructor(src) { this.src = asset(src, audioFiles); this.volume = 1; this.currentTime = 0; }
          play() { sounds.push({ src: this.src, volume: this.volume }); return Promise.resolve(); }
        };
        w.HTMLCanvasElement.prototype.getContext = function (type) {
          if (type !== '2d') fail(`Unsupported canvas context: ${type}`);
          const draws = previewDraws[this.id];
          let path = [];
          return new Proxy({
            fillStyle: '', strokeStyle: '', lineWidth: 1,
            fillRect() {}, strokeRect() {},
            clearRect() { if (draws) draws.length = 0; },
            beginPath() { path = []; },
            moveTo(x, y) { path.push([x, y]); },
            lineTo(x, y) { path.push([x, y]); },
            stroke() { if (draws) draws.push({ path: [...path], width: this.lineWidth, color: this.strokeStyle }); },
            createPattern() { return 'test-pattern'; },
            drawImage(image, x, y) {
              if (!(image instanceof w.Image) || !image.complete) fail('Drawing an unloaded image');
              if (draws) draws.push({ piece: new URL(image.src).pathname.match(/\/([a-z])\.png$/)?.[1]?.toUpperCase(), x, y });
            },
          }, {
            get(target, name) { if (!(name in target)) fail(`Unsupported canvas method: ${String(name)}`); return target[name]; },
            set(target, name, value) { if (!(name in target)) fail(`Unsupported canvas property: ${String(name)}`); target[name] = value; return true; },
          });
        };
      },
    });
    await new Promise((resolve, reject) => {
      loadTimer = setTimeout(() => reject(new Error(`Page load timeout: ${page}`)), 3000);
      window.addEventListener('load', resolve, { once: true });
    });
    clearTimeout(loadTimer);
    healthy();
    if (autoLoadImages) {
      for (const image of images) { image.complete = true; image.onload?.(); }
      clock.tick(250); // actual sprite onload -> timeout -> game() -> callback()
      healthy();
    }
    const element = selector => {
      const result = window.document.querySelector(selector);
      assert.ok(result, `Missing element ${selector} in ${page}`);
      return result;
    };
    const driver = {
      page, window, clock, requests, sounds, trace, images,
      element,
      preview() { return JSON.parse(JSON.stringify(previewDraws)); },
      healthy,
      storage() { return Object.fromEntries(Object.keys(window.localStorage).sort().map(k => [k, window.localStorage.getItem(k)])); },
      advance(ms) {
        assert.ok(Number.isInteger(ms) && ms >= 0 && ms <= 5000, 'Bounded virtual time required');
        trace.push({ advance: ms }); clock.tick(ms); healthy();
      },
      key(type, code, repeat = false) {
        trace.push({ type, code, repeat });
        window.document.dispatchEvent(new window.KeyboardEvent(type, { code, repeat, bubbles: true })); healthy();
      },
      tap(code) { this.key('keydown', code); this.key('keyup', code); },
      click(selector) { trace.push({ click: selector }); element(selector).click(); healthy(); },
      input(selector, value) {
        trace.push({ input: selector, value });
        const el = element(selector); el.value = value;
        el.dispatchEvent(new window.Event('input', { bubbles: true })); healthy();
      },
      resetControls() {
        const reset = [...window.document.querySelectorAll('a, button')].find(a => a.textContent === 'Reset to Defaults');
        assert.ok(reset); const before = navigationCount;
        navigationExpected = true;
        try { reset.click(); healthy(); assert.equal(navigationCount, before + 1); }
        finally { navigationExpected = false; }
      },
      snapshot() {
        // A semantic projection of rendered/persisted game state, not a second engine.
        return JSON.parse(JSON.stringify({
          heap: window.board?.map(row => row.map(c => c.t === 1 ? c.c : '.').join('')),
          piece: window.piece, queue: window.queue, hold: window.holdP,
          x: window.xPOS, y: window.yPOS, rotation: window.rot,
          ghost: [window.xGHO, window.yGHO], history: window.histPos,
        }));
      },
      dispose({ checkErrors = true } = {}) { try { if (checkErrors) healthy(); } finally { clean(); } },
    };
    return driver;
  } catch (error) { clean(); throw error; }
}

async function withPage(page, options, check) {
  const game = await boot(page, options);
  let failed = false;
  try { await check(game); game.healthy(); }
  catch (error) {
    failed = true;
    error.message += `\npage=${page} seed=${options?.seed ?? SEED}\ntrace=${JSON.stringify(game.trace)}\nstate=${JSON.stringify(game.snapshot())}`;
    throw error;
  } finally { game.dispose({ checkErrors: !failed }); }
}
module.exports = { boot, withPage, JQUERY };
