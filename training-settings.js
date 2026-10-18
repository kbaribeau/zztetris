/* Display-only preferences, shared by game pages and the Game Settings popup.
 * Separate keys preserve the existing versioned controls/handling configuration.
 */
'use strict';
(() => {
  const preferences = {
    bagBoundaries: { id: 'bag-boundaries', defaultValue: false },
    stGuideVisible: { id: 'st-guide-visible', defaultValue: true },
  };
  const read = key => {
    const value = localStorage.getItem(key);
    return value === null ? preferences[key].defaultValue : value === 'true';
  };
  function syncControls() {
    for (const [key, { id }] of Object.entries(preferences)) {
      const input = document.getElementById(id);
      if (input) input.checked = read(key);
    }
  }
  function changed(key) {
    syncControls();
    // Before startup there is nothing to redraw. Never start the engine here.
    if ((key === 'bagBoundaries' || key === null) && window.hist?.length) window.updateQueue();
    if (key === 'stGuideVisible' || key === null) window.stLab?.render();
  }
  function write(key, value) {
    localStorage.setItem(key, String(Boolean(value)));
    changed(key);
  }
  window.TrainingSettings = Object.freeze({
    get bagBoundaries() { return read('bagBoundaries'); },
    get guideVisible() { return read('stGuideVisible'); },
    setBagBoundaries(value) { write('bagBoundaries', value); },
    setGuideVisible(value) { write('stGuideVisible', value); },
  });
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === null || Object.hasOwn(preferences, event.key))) changed(event.key);
  });
  document.addEventListener('DOMContentLoaded', () => {
    syncControls();
    for (const [key, { id }] of Object.entries(preferences)) {
      document.getElementById(id)?.addEventListener('change', event => write(key, event.target.checked));
    }
  });
})();
