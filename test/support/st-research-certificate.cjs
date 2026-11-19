'use strict';
const { mock } = require('node:test');
const repair = require('../../st-paired-repair');

// These semantic checks still search the real bounded beam and replay its moves.
// Keep machine speed out of the synchronous proof; deadline tests use the real clock.
module.exports = function researchCertificate(initial, options = {}) {
  const clock = mock.method(performance, 'now', () => 0);
  try {
    return repair.search(initial, { ...options, maxNodes: 45000 });
  } finally {
    clock.mock.restore();
  }
};
