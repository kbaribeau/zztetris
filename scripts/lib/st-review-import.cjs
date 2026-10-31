'use strict';
// Packet-authoring helper, not a gameplay or Worker dependency.
const Practice = require('../../st-practice');
const Session = require('../../st-session');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function create(session, tail, caseId) {
  if (typeof caseId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,89}$/.test(caseId)) throw new Error('A short stable case/position ID is required');
  return Practice.create(session, tail, {suggestedFileName: Session.exportFilename(caseId + '-coaching-export.json')});
}
function controls(practice, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('A safe unique control ID is required');
  const parsed = Practice.prepare(practice);
  if (!practice.suggestedFileName || parsed.session.suggestedFileName === Session.DEFAULT_EXPORT_FILENAME) throw new Error('A descriptive continuation-export filename is required');
  const json = escape(JSON.stringify(practice));
  // The packet's clipboard handler uses data-copy, json-ID and status-ID.
  // A selectable fallback is deliberately not a competing import button.
  return `<div class="actions"><button data-copy="${id}">Copy import JSON — long practice</button></div><p>Suggested export filename: <code>${escape(parsed.session.suggestedFileName)}</code></p><p class="status" id="status-${id}" role="status">Ready to copy.</p><details><summary>Selectable long-practice JSON</summary><textarea id="json-${id}" readonly>${json}</textarea></details>`;
}
module.exports = {create, controls};
