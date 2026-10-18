// Explicit manifest: a new page/engine needs deliberate regression coverage.
const PAGES = [
  { page: 'index.html', engine: 'base.js', mode: 'zztetris.js', cadence: 700 },
  { page: 'cheese.html', engine: 'base.js', mode: 'cheese.js', cadence: 700 },
  { page: '4w.html', engine: 'base.js', mode: '4w.js', cadence: 700 },
  { page: 'grav.html', engine: 'base.js', mode: 'grav.js', cadence: 4 },
  { page: 'pc.html', engine: 'base.js', mode: 'pc.js', cadence: 700 },
  { page: '3w.html', engine: 'base_3w.js', mode: '3w.js', cadence: 700 },
  { page: 'cancellingsickness.html', engine: 'cancellingsickness.js', mode: 'zztetris.js', cadence: 700 },
  { page: '4w4res.html', engine: 'base.js', mode: '4w4res.js', cadence: 700 },
  { page: '4w5res.html', engine: 'base.js', mode: '4w5res.js', cadence: 700 },
  { page: '4w6res.html', engine: 'base.js', mode: '4w6res.js', cadence: 700 },
];
// The lab has temporary rules and its own dedicated startup/settings cases.
const LAB_PAGE = { page:'st-lab.html', engine:'base.js', mode:'zztetris.js', cadence:700 };
const ALL_PAGES = [...PAGES, LAB_PAGE];
const ENGINES = ['index.html', '3w.html', 'cancellingsickness.html'];
const SEED = 123;
const DEFAULT_CONFIG = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Space', 'ShiftLeft',
  'KeyX', 'KeyZ', 'KeyC', 'KeyR', 'KeyT', 'KeyY', '160', '30', '15', '20', '100'];
function settings(overrides = {}) {
  return { config: JSON.stringify(DEFAULT_CONFIG), version: '2023-05-02a', ...overrides };
}
module.exports = { PAGES, ALL_PAGES, LAB_PAGE, ENGINES, SEED, DEFAULT_CONFIG, settings };
