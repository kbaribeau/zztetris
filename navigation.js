// Shared by every static app page. Keep mode-specific controls outside this menu.
(() => {
  const nav = document.querySelector('nav[aria-label="Main navigation"]');
  if (!nav) return;
  // Keep Space/button activation and focused-link keys out of gameplay handlers.
  // Keyup still bubbles so releasing a previously held movement clears it.
  nav.addEventListener('keydown', event => event.stopPropagation());
  const page = location.pathname.split('/').pop() || 'index.html';
  const inSettings = page === 'controls.html';
  const entries = [
    ['About', 'https://github.com/swng/zztetris#readme'],
    ['Game Settings', null],
    ['practice', 'index.html'], ['cheese', 'cheese.html'], ['4w', '4w.html'],
    ['grav', 'grav.html'], ['pc', 'pc.html'], ['ST lab', 'st-lab.html'],
  ];
  for (const [label, href] of entries) {
    const entry = document.createElement(href ? 'a' : 'button');
    entry.className = 'button';
    entry.textContent = label;
    if (href) {
      entry.href = href;
      if (href.startsWith('https:')) {
        entry.target = '_blank';
        entry.rel = 'noopener';
      } else {
        if (href === page) entry.setAttribute('aria-current', 'page');
        // A settings popup returns to its game window, just like Save & Close.
        // Standalone settings and modified/new-tab clicks remain ordinary links.
        if (inSettings) entry.addEventListener('click', event => {
          if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          if (!window.opener || window.opener.closed) return;
          try { window.opener.location.assign(entry.href); }
          catch (_) { return; } // inaccessible opener: retain native navigation
          event.preventDefault();
          window.close();
        });
      }
    } else {
      entry.type = 'button';
      if (inSettings) entry.setAttribute('aria-current', 'page');
      entry.addEventListener('click', () => {
        if (inSettings) document.getElementById('das').focus();
        else window.ctrlsPopup(); // preserve engine save/reload and Training behavior
      });
    }
    nav.append(entry);
  }
})();
