const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const destinations = ['index.html', 'cheese.html', '4w.html', 'grav.html', 'pc.html', 'st-lab.html'];
const labels = ['practice', 'cheese', '4w', 'grav', 'pc', 'ST lab'];
const userPages = [...destinations, '3w.html', 'cancellingsickness.html', '4w4res.html', '4w5res.html', '4w6res.html'];
function nav(page) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, attrs, text]) => ({
    href: attrs.match(/href=["']([^"']+)["']/i)?.[1], label: text.replace(/<[^>]*>/g, '').trim(), attrs,
  })).filter(({ href }) => destinations.includes(href));
}
test('actual app pages expose the same ordered navigation destinations and labels', () => {
  for (const page of userPages) assert.deepEqual(nav(page).map(({ href, label }) => [href, label]), destinations.map((href, i) => [href, labels[i]]), page);
});
test('support/settings page retains popup-return behavior and links back to practice', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'controls.html'), 'utf8');
  assert.match(html, /window\.close/);
  assert.match(html, /Reset to Defaults/);
});
