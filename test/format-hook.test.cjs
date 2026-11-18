const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'zztetris-hook-test-'),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const env = {
    ...process.env,
    HUSKY: '1',
    HUSKY_SKIP_HOOKS: '',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  for (const key of Object.keys(env)) {
    if (
      /^GIT_(DIR|WORK_TREE|INDEX_FILE|PREFIX|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(
        key,
      )
    )
      delete env[key];
  }
  function run(command, args) {
    return spawnSync(command, args, { cwd: directory, env, encoding: 'utf8' });
  }
  function git(...args) {
    const result = run('git', args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  function write(file, content) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), content);
  }
  git('init', '-q');
  git('config', 'user.name', 'Formatting test');
  git('config', 'user.email', 'format-test@example.invalid');
  for (const file of [
    'package.json',
    '.prettierignore',
    '.husky/pre-commit',
    'scripts/check-staged-format.cjs',
  ]) {
    write(file, fs.readFileSync(path.join(root, file)));
  }
  write('.gitignore', 'node_modules/\n.husky/_/\n');
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(directory, 'node_modules'),
    'dir',
  );
  // The same lifecycle command as npm ci, without network during offline tests.
  const prepared = run('npm', ['run', 'prepare']);
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.equal(git('config', '--get', 'core.hooksPath').trim(), '.husky/_');
  git('add', '.');
  git('commit', '-qm', 'Bootstrap hook');
  return { directory, git, write, run };
}

function commit(f) {
  return f.run('git', ['commit', '-qm', 'Exercise hook']);
}
function state(f) {
  return {
    head: f.git('rev-parse', 'HEAD'),
    index: f.git('write-tree'),
    work: f.git('diff', '--binary'),
    status: f.git('status', '--porcelain'),
  };
}

test('format-hook/rejects unformatted index despite formatted worktree without mutations', (t) => {
  const f = fixture(t);
  f.write('sample.js', 'const value={a:1}\n');
  f.git('add', 'sample.js');
  f.write('sample.js', 'const value = { a: 1 };\n');
  const before = state(f);
  const result = commit(f);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Staged formatting failed/);
  assert.deepEqual(state(f), before);
});

test('format-hook/commits formatted index and preserves unstaged edits', (t) => {
  const f = fixture(t);
  const staged = 'const value = { a: 1 };\n';
  const unstaged = 'const value={a:2}\n';
  f.write('sample.js', staged);
  f.git('add', 'sample.js');
  f.write('sample.js', unstaged);
  assert.equal(commit(f).status, 0);
  assert.equal(f.git('show', 'HEAD:sample.js'), staged);
  assert.equal(
    fs.readFileSync(path.join(f.directory, 'sample.js'), 'utf8'),
    unstaged,
  );
  assert.equal(f.git('diff', '--cached'), '');
});

test('format-hook/uses staged config and ignores rather than unstaged copies', (t) => {
  const f = fixture(t);
  const config = JSON.parse(
    fs.readFileSync(path.join(f.directory, 'package.json')),
  );
  config.prettier.singleQuote = false;
  f.write('package.json', JSON.stringify(config, null, 2) + '\n');
  f.write('.prettierignore', 'ignored.js\n');
  f.write('sample.js', 'const value = "quoted";\n');
  f.write('ignored.js', 'const ignored={a:1}\n');
  f.git('add', '.');
  config.prettier.singleQuote = true;
  f.write('package.json', JSON.stringify(config, null, 2) + '\n');
  f.write('.prettierignore', 'sample.js\n');
  assert.equal(commit(f).status, 0);
  assert.equal(f.git('show', 'HEAD:sample.js'), 'const value = "quoted";\n');
  f.write('bad.js', 'const bad={a:1}\n');
  f.git('add', 'bad.js');
  f.write('.prettierignore', 'bad.js\n');
  assert.notEqual(commit(f).status, 0);
});

test('format-hook/handles spaces, newlines, leading dashes, renames, deletions and unknown types', (t) => {
  const f = fixture(t);
  for (const name of ['space name.js', 'line\nbreak.js', '-leading.js']) {
    f.write(name, 'const value = 1;\n');
  }
  f.write('unknown.bin', Buffer.from([0, 255, 1]));
  f.git('add', '.');
  assert.equal(commit(f).status, 0);
  f.git('mv', 'space name.js', 'renamed file.js');
  f.git('rm', 'line\nbreak.js');
  assert.equal(commit(f).status, 0);
});

test('format-hook/checks a symlink replaced by a regular source file', (t) => {
  const f = fixture(t);
  fs.symlinkSync('missing-target', path.join(f.directory, 'converted.js'));
  f.git('add', 'converted.js');
  assert.equal(commit(f).status, 0);
  fs.unlinkSync(path.join(f.directory, 'converted.js'));
  f.write('converted.js', 'const value={a:1}\n');
  f.git('add', 'converted.js');
  assert.match(
    f.git('diff', '--cached', '--name-status'),
    /^T\s+converted.js/m,
  );
  const before = state(f);
  assert.notEqual(commit(f).status, 0);
  assert.deepEqual(state(f), before);
  f.write('converted.js', 'const value = { a: 1 };\n');
  f.git('add', 'converted.js');
  assert.equal(commit(f).status, 0);
});
