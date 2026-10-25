// Node owns test execution/reporting; this wrapper only binds durable results to a revision.
const { run } = require('node:test');
const { tap } = require('node:test/reporters');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { inspect } = require('node:util');
const { SEED } = require('../test/support/pages.cjs');
const { seed: naturalReplaySeed } = require('../test/support/st-natural.cjs');
const seedsByFile = { 'test/st-natural.test.cjs': naturalReplaySeed };

const root = path.resolve(__dirname, '..');
process.chdir(root);
const id = `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const directory = path.join(process.env.ZZTETRIS_TEST_RESULTS_DIR || path.join(root, 'test-results'), id);
fs.mkdirSync(directory, { recursive: true });
const transcript = path.join(directory, 'results.tap');
fs.writeFileSync(transcript, '');
const result = { schemaVersion: 1, id, command: 'npm test', startedAt: new Date().toISOString(),
  node: process.version, platform: process.platform, seeds: [...new Set([SEED, ...Object.values(seedsByFile)])], cases: [], exitCode: 1 };

async function main() {
  const controller = new AbortController();
  let deadline, compileCache;
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    result.commit = git('rev-parse', 'HEAD');
    result.dirty = git('status', '--porcelain').length > 0;
    result.lockSha256 = createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex');
    result.testFiles = fs.readdirSync('test').filter(file => file.endsWith('.test.cjs')).sort().map(file => `test/${file}`);
    if (process.version !== 'v24.20.0') throw new Error('Use the pinned Node version from .nvmrc (24.20.0)');
    if (!result.testFiles.length) throw new Error('No test files found');
    // Cache compiled code only, never module instances: test children and
    // jsdom realms retain their original isolation. Start cold on every run.
    // V8 coverage must opt out because cached code can reduce its precision.
    const coverage = Boolean(process.env.NODE_V8_COVERAGE);
    if (coverage || process.env.NODE_DISABLE_COMPILE_CACHE === '1') {
      process.env.NODE_DISABLE_COMPILE_CACHE = '1';
      result.compileCache = { enabled: false, reason: coverage ? 'V8 coverage' : 'explicit opt-out' };
    } else {
      result.compileCache = { enabled: false, coldPerRun: true };
      compileCache = fs.mkdtempSync(path.join(os.tmpdir(), 'zztetris-test-compile-'));
      process.env.NODE_COMPILE_CACHE = compileCache;
      const probe = JSON.parse(execFileSync(process.execPath, ['-e',
        'const m=require("node:module");process.stdout.write(JSON.stringify({directory:m.getCompileCacheDir(),status:m.enableCompileCache().status}))'], { encoding: 'utf8', timeout: 3000 }));
      result.compileCache = { enabled: Boolean(probe.directory), coldPerRun: true, childStatus: probe.status };
      if (!probe.directory?.startsWith(compileCache + path.sep)) throw new Error('Child compile cache did not use the private run directory');
    }
    // Parent watchdog also bounds a child stuck in synchronous product code.
    // Regional-model regressions add real bounded searches; retain the tighter
    // per-file deadline below while allowing the larger serial suite to finish.
    deadline = setTimeout(() => controller.abort(new Error('Suite exceeded 300 seconds')), 300000);
    const stream = run({ files: result.testFiles, concurrency: 1, timeout: 15000, signal: controller.signal });
    for (const outcome of ['pass', 'fail']) stream.on(`test:${outcome}`, data => {
      const file = path.relative(root, data.file || '');
      result.cases.push({ id: data.name, file, seed: seedsByFile[file] ?? SEED,
        outcome: data.skip ? 'skip' : data.todo ? 'todo' : outcome,
        durationMs: data.details.duration_ms,
        ...(data.details.error ? { failure: inspect(data.details.error, { depth: 6 }) } : {}),
      });
    });
    stream.on('test:summary', summary => { if (!summary.file) result.summary = summary; });
    for await (const chunk of stream.compose(tap)) {
      fs.appendFileSync(transcript, chunk);
      process.stdout.write(chunk);
    }
    const counts = result.summary?.counts;
    result.exitCode = result.summary?.success && counts.tests > 0 &&
      counts.skipped === 0 && counts.todo === 0 && counts.cancelled === 0 ? 0 : 1;
  } catch (error) {
    result.error = inspect(error, { depth: 6 });
    fs.appendFileSync(transcript, `\n# Runner error: ${result.error}\n`);
    console.error(error);
  } finally {
    clearTimeout(deadline);
    if (compileCache) {
      try { fs.rmSync(compileCache, { recursive: true, force: true }); result.compileCache.cleaned = true; }
      catch (error) { result.compileCache.cleanupError = String(error); }
    }
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(`\nResults: ${directory}`);
    process.exitCode = result.exitCode;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
