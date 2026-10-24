# ST closed-loop simulation

Run from the repository root with the pinned Node 24.20.0 and existing npm installation. No browser, server, new npm dependencies or schedule is required.

```sh
npm run sim:st -- --preset quick
npm run sim:st -- --preset quick --scenario both
npm run sim:st -- --preset research
npm run sim:st -- --seeds 123,456 --locks 100 --scenario stable
```

The default is **empty-board play**. `stable` starts at the public `marathon-rebuild` fixture but samples a seeded valid continuation, **not its fixed demo tail**. `both` reports these as separate cohorts. Development quick seeds are 10331 and 20333, with a 24-lock cap. Research uses sixteen explicitly listed seeds and 500-lock caps. Those seeds are not permanently held out once inspected or used for tuning; curate a separate untouched list for validation. All seeds and caps are written to the manifest.

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

The default child-process wall watchdog is `locks × (1500 + 1750) + 5000` milliseconds per episode. Override with `--episode-ms N`; reaching it is reported as a censored `wall-cap`, not a top-out or successful lock cap. A separate 2.5-second VM watchdog catches stuck individual decisions. Each child has a 512 MiB V8 heap cap; traces are limited to 64 MiB. The runner executes episodes serially. Do not run it concurrently with other performance experiments.

Runtime is workload dependent: two 24-lock episodes imply at most 48 ordinary decisions, whose temporary nominal 1500-ms budgets alone total 72 seconds, plus loading, validation and other overhead. Early abstention reduces work. This is budget arithmetic, **not a measured performance guarantee**. A historical 750-ms dirty-tree calibration on 2026-10-23 (Node 24.20.0, cloud host) completed the default quick preset in 24.45 seconds: both seeds reached the 24-lock cap. This is one diagnostic sample, not a portable timing promise or strategy acceptance. The largest measured decision, including VM overhead, was about 803 ms, so the nominal 750-ms search budget is not a hard end-to-end latency limit. The research preset can take hours. Calibrate on the target machine before adopting a routine. No automated schedule or CI configuration is installed.

## Results and stop reasons

Artifacts default to already-ignored `test-results/simulation/<run-id>/`. Use `--out /retained/directory` for durable storage. Each run contains:

- `manifest.json`: full commit/dirty status, source hashes, lockfile hash, Node/platform/CPU, RNG version, config, seeds, caps and outcomes.
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

Compare complete manifests with identical public/private inputs, caps, budgets and execution protocol. Run each revision from an isolated checkout, serially, retaining its artifacts. Compare reports keep empty and stable cohorts separate, report paired wins/ties/losses, restricted mean placements through the common cap, median stop placement when reached, and an exploratory seed-level bootstrap interval for the paired placement delta. They also compare lines and height at each pair's shared placement horizon.

Safety/infrastructure failures and wall-censored pairs are rejected as a quality comparison instead of silently dropped. Inspect those artifacts directly. Small development samples do not establish generalization; thousands of correlated locks are not thousands of independent seeds. Repeat production-budget experiments to expose timing sensitivity and retain unfavorable runs.

A historical example explains the need: a parity repair looked locally cleaner yet, on one developed stream, stopped at 42 locks/8 lines versus 48 locks/12 lines for TSD-first. Other streams improved. Zero invalid witnesses did not imply zero abstentions or better survival. Local geometry, correctness and longer-run policy quality remain different measures.

## Relationship to unit and browser tests

`npm test` still runs the focused rules, hold, bag-information, certificates, regression, UI/worker races, settings and navigation suites. `test/st-simulation.test.cjs` checks the runner itself with cheap controlled advice and real rules; this does not launch the research workload. Simulations replace repeated ad hoc scratch scripts and manual strategy playthroughs, not these independent assertions. Minimize discovered failures into named regression fixtures. Keep change-triggered real-browser checks for visual/input/Worker fidelity.
