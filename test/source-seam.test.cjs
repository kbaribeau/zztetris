const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const prettier = require('prettier');
const sourceSeam = require('./support/source-seam.cjs');

test('source-seam/instrumentation survives formatting and executes exactly once', async () => {
  const compact =
    'function compute(items){const result=items.map(x=>x+1);return result;}';
  const formatted = await prettier.format(compact, { parser: 'babel' });
  for (const source of [compact, formatted]) {
    const seam = sourceSeam(source, 'const result=items.map(x=>x+1);');
    let calls = 0;
    const realm = { observed: () => calls++ };
    vm.runInNewContext(source.replace(seam, seam + 'observed();'), realm);
    assert.deepEqual(Array.from(realm.compute([1, 2])), [2, 3]);
    assert.equal(calls, 1);
  }
});

test('source-seam/missing, ambiguous and literal-containing seams fail closed', () => {
  assert.throws(
    () => sourceSeam('const other = 1;', 'const result=1;'),
    /Review changed/,
  );
  assert.throws(
    () => sourceSeam('const result=1; const result = 1;', 'const result=1;'),
    /ambiguous/,
  );
  assert.throws(
    () => sourceSeam("const result='a b';", "const result='ab';"),
    /code-only/,
  );
});
