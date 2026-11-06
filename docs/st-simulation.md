# ST closed-loop simulation

Run from the repository root with the pinned Node 24.22.0 and existing npm installation. No browser, server, new npm dependencies or schedule is required.

**Use four parallel episode workers (`--parallel 4`) for routine diagnostic
simulation batches.** Pass the flag explicitly: the CLI default remains one
worker. Production-budget acceptance and latency measurements still require
serial runs with ordinary timeouts; see the [diagnostic limits below](#parallel-and-no-search-timeout-diagnostics).

```sh
npm run sim:st -- --preset quick --parallel 4
npm run sim:st -- --preset quick --scenario both --parallel 4
npm run sim:st -- --preset research --parallel 4
npm run sim:st -- --seeds 123,456 --locks 100 --scenario stable --parallel 4
```

The default is **empty-board play**. `stable` starts at the public `marathon-rebuild` fixture but samples a seeded valid continuation, **not its fixed demo tail**. `both` reports these as separate cohorts. Development quick seeds are 10331 and 20333, with a 24-lock cap. Research uses sixteen explicitly listed seeds and 500-lock caps. Those seeds are not permanently held out once inspected or used for tuning; curate a separate untouched list for validation. All seeds and caps are written to the manifest.

Concurrency is capped by the number of episodes. The default quick preset has
only two, so it uses at most two workers; `quick --scenario both` has four.

The quick preset is a bounded smoke test, not full opening/sustainability acceptance. Research's several hundred locks make longer failures observable, but neither preset proves indefinite survival or a full Reset. Count actual events, not only elapsed locks. Seventy locks is too short to certify the latter. Historical reference candidate positions are not executable certificates.

## Runtime contract

The simulator does not implement alternative Tetris physics or a second coach:

- The actual `st-worker.js` runs in a **fresh VM realm per decision**, importing the actual production modules. This shares `STPlanner.decide` with the page and resets planner caches as a fresh browser Worker would. VM time uses real wall time.
- Only `P.observe(state)`, public prior advice/commitment and public opening-session metadata enter the worker. Seed, generator and future pieces remain exclusively in the evaluator.
- Actual `R.move` actions execute the returned witness. A witness must be legal from the current pose, end in exactly one hard drop, match the advertised target and hold metadata, and produce a valid state.
- Each actual draw replenishes the six-piece preview and updates public bag evidence, including the first empty HOLD. Held swaps and cosmetic moves do not invent new draws.
- Shared opening-session helpers and the UI's resource-bearing commitment predicate preserve the same phase and post-lock continuation lifecycle. `updateOpeningSession` receives the actual pre-HD pose and public post-reveal state. An opening result is not admitted as a maintenance cycle commitment.
- The execution model is **rapid, uninterrupted completion of a verified witness**. There is no simulated human delay or asynchronous replanning halfway through that witness. `P.advance` is called on intervening actions; a false `adviceAdvanced` is recorded separately from an illegal action, and does not silently substitute a new move. This is not a test of browser Worker scheduling, key timing or painting.

Empty starts use a seeded uniform seven-bag generator. Stable starts select a private remaining-bag mask consistent with the initial public bag knowledge, then generate a valid continuation. All generated pieces are checked against the public bag model. The private input stream is saved for reproduction, but never passed to the policy.

## Budget and reproducibility limits

The production lane uses the page's maintenance configuration: depth 3, width 8, 45,000 nodes, temporarily 1500 ms. The original 750 ms goal remains explicit performance debt; see [budget decision](st-temporary-planning-budget.md). Opening/construction code retains its production internal budgets. Every run records source hashes as well as configuration. Changes during an episode invalidate its evidence.

**Fixed seeds do not make current search deterministic.** Nested repairs and certificates use wall-clock deadlines too. `--lane deterministic` is deliberately rejected. Node-only budgets or a fake outer clock would not establish control of all nested timers. Timed runs may diverge across machines, load or repetitions; compare serially under controlled conditions and retain all outcomes.

The default child-process wall watchdog is `locks × (1500 + 1750) + 5000` milliseconds per episode. Override with `--episode-ms N`; reaching it is reported as a censored `wall-cap`, not a top-out or successful lock cap. A separate 2.5-second VM watchdog catches stuck individual decisions. Each child has a 512 MiB V8 heap cap; traces are limited to 512 MiB and native replay/failure recovery streams their records. JSON artifacts and the legacy eager trace reader retain a 64 MiB limit; optional analyzers may have their own smaller limits. Without `--parallel`, the runner executes episodes serially; use the recommended `--parallel 4` for diagnostic batches. Do not run production-budget comparisons concurrently with other performance experiments. The explicit diagnostic options below do not change browser defaults.

Runtime is workload dependent: two 24-lock episodes imply at most 48 ordinary decisions, whose temporary nominal 1500-ms budgets alone total 72 seconds, plus loading, validation and other overhead. Early abstention reduces work. This is budget arithmetic, **not a measured performance guarantee**. A historical 750-ms dirty-tree calibration on 2026-10-23 (Node 24.20.0, cloud host) completed the default quick preset in 24.45 seconds: both seeds reached the 24-lock cap. This is one diagnostic sample, not a portable timing promise or strategy acceptance. The largest measured decision, including VM overhead, was about 803 ms, so the nominal 750-ms search budget is not a hard end-to-end latency limit. The research preset can take hours. Calibrate on the target machine before adopting a routine. No automated schedule or CI configuration is installed.

## Parallel and no-search-timeout diagnostics

```sh
# At most four episode processes at once, still using the production search timer:
npm run sim:st -- --preset research --parallel 4
# Optional diagnostic mode: remove the outer search deadline and decision VM cutoff:
npm run sim:st -- --preset quick --scenario both --parallel 4 --no-search-timeout
# Give slower diagnostic episodes a larger, still finite process watchdog:
npm run sim:st -- --preset quick --scenario both --parallel 4 --no-search-timeout --episode-ms 1200000
# Production-budget acceptance: one worker, ordinary search/VM timeouts:
npm run sim:st -- --preset research --parallel 1 --lane production
```

Four workers are the recommended starting point, not a portable optimum. The
retained `parallel-calibration-2026-11-05` experiment at source
`8849725b0fd4f653e9910f099be983c2a862371d` measured **3.04× wall/lock throughput**
for `--parallel 4 --no-search-timeout` versus the matching serial no-timeout mode
on that cloud host (Node 24.22.0). Across two repetitions of eight seeds in each
of the empty and stable cohorts, all 32 episode observations agreed under the
declared selected action/outcome signature. This is host-specific diagnostic
evidence, not full advice/history equality, determinism, or proof that disabling
the timeout itself makes search faster. Nested wall timers remain active.

Keep `--no-search-timeout` an explicit diagnostic choice. Parallel CPU contention
can change time-limited decisions and stop outcomes; a shorter batch is not
necessarily equivalent work or better play. The wider calibration included an
unresolved strict native replay mismatch in an eight-worker timed run. Retain
replay failures separately from successful action-ledger checks and do not use
this calibration as production acceptance.

`--parallel N` accepts integers 1–32 and defaults to 1. Each episode remains a
separate process with its own input, trace, summary, heap cap, and watchdog.
The requested order of scenarios and seeds is retained in the final manifest,
regardless of completion order. Queue time does not consume an episode's
watchdog. Run directories have collision-resistant suffixes, including repeated
invocations in one process. Concurrency cannot exceed the number of inputs;
start with four workers and reduce this on CPU- or memory-constrained hosts.
Each child may use up to 512 MiB of V8 heap, plus native memory. Parallelism is across episodes,
not within a single search or episode; `--rerun` contains one episode.

`--no-search-timeout` is simulation-only. It records `config.timeMs: null` and
`decisionWatchdogMs: null`, then installs an infinite outer deadline inside the
fresh simulation worker realm. It removes the **decision invocation's** 2.5-second
VM cutoff so a legitimate node-bounded search is not silently stopped there.
VM initialization/imports retain their 2.5-second safety limits. Node, depth,
width, production-internal proof limits and nested wall timers are unchanged.
The browser still uses 1500 ms, and future runs without the flag keep the normal
search and VM limits. This mode is **not deterministic** and does not mean every
search or the whole episode is unbounded.

The independent episode process watchdog remains mandatory. Without an explicit
`--episode-ms`, it keeps the ordinary `locks × (1500 + 1750) + 5000` default even
when the search timer is disabled. Increase it explicitly if the diagnostic work
requires more time, up to 7,200,000 ms (two hours) per episode. A stuck decision
is killed by this process watchdog and reported as `wall-cap`. Heap, trace and
output limits also remain active. SIGINT/SIGTERM stop queued work, terminate
active children, wait for their exit, and retain incomplete manifests and traces.
Source changes stop queued work and invalidate affected results. Other episode
failures remain visible and do not erase completed or queued cohort members.
A truncated/corrupt failed-child trace retains its valid prefix for failure
accounting, with an explicit artifact-recovery warning. Original trace/error
bytes are preserved, and a replaced child summary is retained as
`summary.child.json`. This recovery never relaxes strict action replay.

Parallel runs and timeout-disabled runs are marked `diagnostic-wall-clock` in
manifests, observations and reports. They cannot be combined with `--lane
production` or a production-only `--protocol`. `--parallel 1` remains serial
production execution. `--compare` requires matched concurrency, timeout mode,
decision watchdog and episode watchdog as well as existing input/config checks;
matched diagnostic comparisons are descriptive, **not production-budget
acceptance evidence**. CPU contention changes how much work fits inside real
deadlines, and nested timers still affect timeout-disabled searches. For policy
acceptance or latency claims, rerun serially with ordinary timeouts on the same
host under controlled load. Retain all attempts, not only favorable outcomes.

The options apply to new runs and `--rerun`, not action replay, comparison, or
internal child invocations. Rerun keeps saved inputs/caps but uses the options
of the new command, so repeat the diagnostic flags explicitly when desired.

## Results and stop reasons

Artifacts default to already-ignored `test-results/simulation/<run-id>/`. Use `--out /retained/directory` for durable storage. Each run contains:

- `manifest.json`: full commit/dirty status, source hashes, lockfile hash, Node/platform/CPU, RNG version, config, concurrency, decision/episode watchdogs, seeds, caps and outcomes.
- `report.md`: short human-readable outcome list.
- One directory per scenario/seed: `input.json` with the initial public state and **private evaluator stream**, `trace.jsonl`, `summary.json`, and invocation `spec.json`.

The trace records public requests, advice, actual action witnesses, intermediate reveal counts/state hashes, resulting states, phase diagnostics and metrics. It is written incrementally so completed placements survive an interrupted child. Files under `test-results` are not committed or a substitute for retained evidence. Dirty results are diagnostic only; retain a clean-commit run for delivery.

Stops are distinct:

- `abstention`: no target returned; preserves exact planner status/reason. Not proof that no legal move exists.
- `top-out`: the real rules state actually topped out.
- `invalid-recommendation`: malformed, illegal or mismatching returned target/witness, withheld before execution.
- `policy-violation`: executed noncanonical clear or failed established maintenance-notch transition.
- `input-exhausted`: insufficient supplied private stream; normally impossible with generated inputs.
- `lock-cap`: completed the predeclared placement cap, right-censored.
- `wall-cap`: process hit the explicit wall watchdog, right-censored separately.
- `planner-timeout`, `planner-error`, `execution-error`, `runner-error`, `artifact-limit`, `source-changed`: infrastructure, safety or evidence failures, never silently converted to abstention.

Abstention, top-out and caps are measured policy outcomes; the command does not fail solely because they occur. Safety/evidence/infrastructure failures exit nonzero. Thus exit code zero means the experiment ran, **not that the strategy met a quality threshold**.

Metrics include placements, cleared lines, TSDs/quads and first occurrences, opening handoff after N prior locks, supported nonclearing rebuild events after TSDs, holds, planning nodes/time/budget hits, peak/end height, mean skyline height, occupied mass divided by ten (filled-row equivalents), parity and center/cavity debt. A rebuild event is not a certified full cycle. New cavity debt is logged diagnostically, not automatically declared an illegal placement. Fresh-versus-inherited phase disagreement is also diagnostic; it is not automatically an actually blocked notch.

## Left-shape observations

Each newly simulated episode includes `summary.leftShapes`: counts for all twelve
oriented Shocky Left profiles and `other`, tier totals, percentages, and the
number of observations. Each successful lock records `metrics.leftShape` from
the **post-line-clear board**. Counts sum to executed locks, including a final
lock that ends the run. The initial board is reported separately and is not
counted. HOLD, movement, candidate search and abstentions do not add samples.

Profiles use the normalized skyline of columns 1–4, independent of elevation.
**Any covered hole in these columns makes the observation `other`**, even when
the skyline matches a ranked profile. Unranked and flat shapes also use `other`.
These are shape frequencies, not safety certificates or reset detection.

Existing traces can be analyzed without rerunning the planner:

```sh
npm run left-shapes:st -- --episode EPISODE_DIRECTORY --out NEW_JSON_FILE
npm run left-shapes:st -- --episode EPISODE_DIRECTORY --prefix-locks 40
```

The offline JSON includes the same counters, catalog, per-lock observations and
input/trace/source hashes. It reads recorded boards rather than revalidating
actions, does not modify source artifacts, and refuses to replace an existing
output file. A trace without its terminal summary is explicitly marked partial.
Compare percentages as well as counts; longer surviving runs have more samples.
For paired outcomes, also compare the shared lock horizon using `--prefix-locks`.
Keep opening/stable cohorts separate; these counts do not infer a reset phase.

## Replay versus rerun

```sh
npm run sim:st -- --replay test-results/simulation/RUN/empty-10331
npm run sim:st -- --rerun test-results/simulation/RUN/empty-10331
```

`--replay` executes **recorded actions without rerunning search**, checking their public request state, event, reveal sequence and resulting board against the trace. It verifies the recorded successful prefix under the current rules/controller; it does not independently re-establish an abstention or validate why the search chose those actions.

`--rerun` asks the **current timed engine** to play the saved initial state/private stream again with the saved cap, writing a new run. Timing may yield different choices. Both modes use current code; keep the original revision and source bundle for exact historical reconstruction. Do not confuse a matching action replay with deterministic policy replay.

## Paired comparison

```sh
npm run sim:st -- --compare BASELINE_RUN_DIRECTORY CANDIDATE_RUN_DIRECTORY
```

Compare complete manifests with identical public/private inputs, caps, budgets, concurrency, watchdogs and execution protocol. Run each revision from an isolated checkout, serially, retaining its artifacts. Compare reports keep empty and stable cohorts separate, report paired wins/ties/losses, restricted mean placements through the common cap, median stop placement when reached, and an exploratory seed-level bootstrap interval for the paired placement delta. They also compare lines and height at each pair's shared placement horizon.

Safety/infrastructure failures and wall-censored pairs are rejected as a quality comparison instead of silently dropped. Inspect those artifacts directly. Small development samples do not establish generalization; thousands of correlated locks are not thousands of independent seeds. Repeat production-budget experiments to expose timing sensitivity and retain unfavorable runs.

A historical example explains the need: a parity repair looked locally cleaner yet, on one developed stream, stopped at 42 locks/8 lines versus 48 locks/12 lines for TSD-first. Other streams improved. Zero invalid witnesses did not imply zero abstentions or better survival. Local geometry, correctness and longer-run policy quality remain different measures.

## Relationship to unit and browser tests

`npm test` still runs the focused rules, hold, bag-information, certificates, regression, UI/worker races, settings and navigation suites. `test/st-simulation.test.cjs` checks the runner itself with cheap controlled advice and real rules; this does not launch the research workload. `test/st-simulation-runner.test.cjs` covers bounded scheduling, ordered outputs, unique directories, process failures/watchdogs/cancellation, simulation-only timeout translation, CLI artifacts and compatibility guards using tiny controlled inputs. Simulations replace repeated ad hoc scratch scripts and manual strategy playthroughs, not these independent assertions. Minimize discovered failures into named regression fixtures. Keep change-triggered real-browser checks for visual/input/Worker fidelity.

## Regional material and original-bag accounting

Use `npm run minos:st -- --episode EPISODE_DIRECTORY` for offline replay/export,
or append `--mino-ledger` to a new run to export after every timed episode has
finished. This adds no planner metadata or scoring rule. The
[regional mino ledger](st-regional-mino-ledger.md) documents cellwise 4/3/3 regions,
original-bag HOLD identity where verified, honest unknown imports, rolling
windows, conservation checks and JSON/CSV fields.

## Canonical evaluation observations

New runs additionally write versioned `observations.json` after all timed episodes.
Use `--protocol FILE --side baseline|candidate` for binding before execution, and
`node scripts/evaluate-st-protocol.cjs --help` for canonical JSON/Markdown reports.
The [executable evaluation contract](st-evaluation-contract.md) owns validation,
explicit aggregate criteria, independent correctness receipts and legacy adapters.
Existing manifests, summaries and commands remain supported.

## Opening-bounded experimental evaluation

For an empty-start opening experiment, `--locks 100 --opening-locks 80
--post-handoff-locks 20` stops at 80 locks if still in Opening, otherwise at
20 actual locks after the first observed non-Opening controller transition.
Earlier abstention/top-out/safety failures remain unchanged. Both flags are
required, their positive values must sum to `--locks`, and stable starts are
rejected. The evaluator-only `input.phaseCap` travels with saved inputs and
protocol hashes, never worker requests. `phase-cap` is a right-censored stop;
`detail` records its reason and actual handoff boundary. Scoring a TSD does not
itself count as handoff. Compare handoff rates and shared-horizon outcomes,
not raw length as survival superiority when arms stop at different phase caps.
