'use strict';
const assert = require('node:assert/strict');

// Locate a unique test-only instrumentation seam despite formatter whitespace,
// trailing commas, and parentheses around a single arrow parameter. Deliberately
// limited to code snippets without literals/comments: never normalize their data.
module.exports = function sourceSeam(source, snippet) {
  assert.doesNotMatch(snippet, /["'`]|\/\*|\/\//, 'Use a code-only seam');
  const tokens = snippet.match(
    /\.\.\.|=>|===|!==|==|!=|&&|\|\||\?\?|[A-Za-z_$][\w$]*|\d+|[^\s]/g,
  );
  const pattern = tokens
    .map((token, index) => {
      let escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (tokens[index + 1] === '=>' && /^[A-Za-z_$][\w$]*$/.test(token)) {
        escaped = `\\(?\\s*${escaped}\\s*\\)?`;
      }
      if (
        [')', '}', ']'].includes(token) &&
        !['(', '{', '[', ','].includes(tokens[index - 1])
      ) {
        escaped = `,?\\s*${escaped}`;
      }
      return escaped;
    })
    .join('\\s*');
  const matches = [...source.matchAll(new RegExp(pattern, 'g'))];
  assert.equal(
    matches.length,
    1,
    `Review changed or ambiguous source seam: ${snippet}`,
  );
  return matches[0][0];
};
