// Check a disposable index snapshot; never rewrite the index or working tree.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const git = (...args) =>
  execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
let snapshot;
try {
  process.chdir(git('rev-parse', '--show-toplevel').toString().trim());
  const files = git(
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
  )
    .toString()
    .split('\0')
    .filter(Boolean);
  if (files.length) {
    const prettier = require.resolve('prettier/bin/prettier.cjs');
    snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'zztetris-format-'));
    // Include staged config and ignore files, even when their worktree copies differ.
    // checkout-index also fails closed for an unresolved merge.
    git('checkout-index', '--all', `--prefix=${snapshot}${path.sep}`);
    const regularFiles = files.filter((file) =>
      fs.lstatSync(path.join(snapshot, file)).isFile(),
    );
    for (let offset = 0; offset < regularFiles.length; offset += 50) {
      const result = spawnSync(
        process.execPath,
        [
          prettier,
          '--check',
          '--ignore-unknown',
          '--',
          ...regularFiles.slice(offset, offset + 50).map((file) => `./${file}`),
        ],
        { cwd: snapshot, stdio: 'inherit' },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) {
        process.exitCode = 1;
        console.error(
          'Staged formatting failed. Format the intended changes with npm run format, review, and stage them again.',
        );
        break;
      }
    }
  }
} catch (error) {
  console.error('Unable to check staged formatting:', error.message);
  process.exitCode = 1;
} finally {
  if (snapshot) fs.rmSync(snapshot, { recursive: true, force: true });
}
