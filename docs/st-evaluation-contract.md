# Executable ST evaluation contract (v1)

The executable schema, validation, computations and renderer live in
[`scripts/lib/st-evaluation.cjs`](../scripts/lib/st-evaluation.cjs). Its strict
`validateProtocol` is the authority; it returns a deeply frozen copy. The CLI is
[`scripts/evaluate-st-protocol.cjs`](../scripts/evaluate-st-protocol.cjs). Do not
hand-author a separate Markdown verdict or infer acceptance from a simulation's
exit code. No acceptance thresholds are supplied by the tool.

## Workflow

1. Snapshot each checkout with `node scripts/evaluate-st-protocol.cjs --sources --out NEW_DIRECTORY`. Validate and save a canonical protocol with `node scripts/evaluate-st-protocol.cjs --freeze DRAFT_PROTOCOL --out NEW_DIRECTORY`. These commands never overwrite directories. A frozen file is not proof of predeclaration: only the simulator can bind it before execution.

   Freeze baseline/candidate sources, actual inputs and a justified protocol
   **before either run**. Keep it outside Git. Use `sourceHashes()` and
   `makeInput()` from `scripts/lib/st-simulation.cjs`; use `hash()` from the
   evaluation module for canonical whole-input identities. Keep development and
   fresh-validation cohorts separate. Preserve all attempts and failed evidence.
2. Run each revision serially, with its own checkout and the same protocol:

   ```sh
   node scripts/simulate-st.cjs --protocol /evidence/protocol.json --side baseline --out /evidence/baseline
   node scripts/simulate-st.cjs --protocol /evidence/protocol.json --side candidate --out /evidence/candidate
   ```

   Protocol mode owns actual inputs, config, cap and watchdog. Existing quick,
   research, replay, rerun and compare commands remain available. Config includes
   all outer planner budgets; internal proof limits remain bound by source hashes.
   The parent binds source/config/input identities before spawning any planner;
   each child checks its actual config, sources and input again before execution.
   A mismatch aborts. `protocol.json` and the binding are retained with the run.
   Changed source during execution invalidates evidence. The protocol must use
   the actual Node runtime. Timed search is not deterministic across hosts/load.
3. The simulator emits `observations.json` **after all timed children end**.
   Existing manifests and summaries remain unchanged except additive binding
   metadata. Normalization does not spend the planner's search budget. Root,
   bag/history confidence, full private input, sources, budgets, caps and raw
   summaries remain available. These artifacts belong outside Git.
4. Import source-bound test/replay/audit receipts; generate JSON and Markdown:

   ```sh
   node scripts/evaluate-st-protocol.cjs --protocol /evidence/protocol.json --baseline BASE_RUN --candidate CANDIDATE_RUN --receipts /evidence/receipts.json --exploration /evidence/findings.json --out /evidence/new-report
   ```

   Baseline/candidate may also be `observations.json` files. Directory loading
   crosschecks normalized observations against original manifest/input artifacts.
   Output directories must be new. Exit 0 means all declared gates pass, 2 means
   fail/incomplete, 1 means invalid evidence or invocation. JSON is canonical;
   JSON and Markdown are byte-identical for identical evidence, with no clock,
   host path or random generation timestamp added by the evaluator.

## Protocol schema

Every field below is required. Unknown fields/rules are rejected. JSON values
must be finite; no strings masquerading as numbers. The executable validator is
also available to callers before saving a protocol.

- `schemaVersion: 1`, `kind: "st-evaluation-protocol"`, nonempty `id`.
- `sources: {baseline: {relativePath: sha256, ...}, candidate: {...}}`.
  The required current source closure is `REQUIRED_SOURCES`; a prospective run
  additionally requires exact equality with the runner's entire current source
  map, including evaluation code and any newly loaded coach modules. Missing
  required files fail hashing rather than being silently omitted. Explicitly adapted historical source maps are validated as nonempty SHA-256 maps rather than requiring files that did not exist then. Both sides must be explicitly adapted for this retrospective protocol route. Historical
  source maps never receive fabricated hashes for newly introduced tools.
- `execution: {config, locks, rng, lane, execution, episodeMs, node}`.
  Config requires nonnegative numeric `depth`, `width`, `maxNodes`, `timeMs`,
  optional boolean `usageTelemetry`. Other config keys are unsupported. RNG is
  `mulberry32-seven-bag-v1`, lane `production-wall-clock`, execution
  `rapid-uninterrupted-actual-witness-v1`. Locks and watchdog are positive
  integers (watchdog at least 100 ms); Node is the exact version string.
- `cohorts: [{id, kind, pairs, criteria}, ...]`. Kind is `development` or
  `fresh-validation`. Neither may omit criteria or pairs. A fresh designation
  is a declaration, not proof the cases were unseen.
- Each pair: `{id, input, inputHash}`. Input is the existing v1 simulator input
  (including initial public root/bag, scenario, seed, RNG, lock cap and private
  future); `inputHash` is the evaluation module's canonical hash of **all** input
  fields. IDs, input hashes and scenario/seed identities must be unique across
  cohorts. Root/rules/bag validation runs before execution. Stable imports have
  no prior action history; the tool never invents verified history. The old
  input's inner `inputHash` is order-sensitive legacy metadata, crosschecked
  against its summary but not used as canonical identity or authentication.
- Criterion: `{id, metric, aggregate, operator, threshold, uncertainty}`.
  Supported metrics are exported as `METRICS`: `locks`, `lines`, `tsds`, `quads`,
  `nodes`, `peakHeight`, `budgetExhaustedSuccessfulLocks`, stop indicators `topOut`, `plannerTimeout`, `wallCap`, and per-episode `medianPlanMs`, `p95PlanMs`, `maxPlanMs`. Timing aggregates compare episode summaries, not pooled lock percentiles. Missing legacy timings remain missing; VM timeouts and wall caps are distinct from mixed budget-exhaustion flags. Aggregate is
  `mean-paired-delta` (candidate minus baseline); operator is `at-least` or
  `at-most`; threshold must be explicitly justified and numeric. Missing
  measurements yield incomplete, never zero or pass.
- Uncertainty is `{method: "none"}` or
  `{method: "paired-bootstrap-percentile", confidence, samples, seed, minPairs}`.
  Confidence is strictly between 0 and 1, samples 100–100000, seed uint32,
  minPairs integer at least 2. The declared seed controls deterministic paired
  resampling. Lower interval endpoint must meet `at-least`; upper must meet
  `at-most`. Too few pairs means incomplete. Sampling units are seed pairs,
  never correlated locks. Bootstrap cannot repair biased case selection,
  dependence, tiny samples or wall-clock variability.
- `correctness: [{id, kind, side}, ...]`, nonempty. Kind is `test`, `replay` or
  `audit`; side is `baseline` or `candidate`. Missing declared receipts are
  incomplete, regardless of simulation results.

## Correctness receipts

The receipt index is an array. Each receipt requires
`{schemaVersion:1, kind, id, side, sources, complete, checks, defects, evidence}`.
IDs/kind/side match protocol requirements; sources exactly match the named side.
Checks are a nonempty array of `{id, status}` where status is pass/fail/unknown.
Defects are `{id, classification, description}` with new/pre-existing/unknown
classification. Evidence is `{sha256, file}` in a CLI index (path relative to the
index), or `{sha256, contents}` for library use. The CLI reads bytes and checks
SHA-256. Preserve actual transcripts/replay/audit findings; a wrapper's pass
claim is not an independently rerun check.

Failed checks/new defects fail correctness. Incomplete checks, known pre-existing
or unknown defects prevent an unqualified pass. Recorded policy violations or
invalid recommendations also fail correctness, independently of imported green
receipts. Baseline violations are labeled pre-existing; candidate classification
remains unknown without an audit proving whether it is new. The evaluator does
not infer defect novelty merely from matching stop labels.

Hashes establish byte identity, not authorship, trustworthiness, correctness, or
proof of a historical timestamp. Predeclared means this implementation bound the
protocol before its planner calls. A forged binding is not cryptographically
prevented. Inspect original artifacts and source receipts independently.

## Verdict boundaries and compatibility

Correctness, aggregate regression and exploration have separate result fields.
Every cohort must meet every declared criterion. An individual worse run is not
an extra acceptance veto: declared aggregate rules govern. Missing/incomplete
runs, wall caps, input exhaustion, crashes and safety failures cannot become an
aggregate pass. Explicit safety failures also remain in correctness.

Lock-cap counts are right-censored restricted observations, not indefinite
survival. Stops, raw counts and censoring are preserved. `budgetHits` becomes
`budgetExhaustedSuccessfulLocks`: it conflates exhaustion causes and excludes
terminal abstentions, so it is **not** wall-clock timeout frequency. Phase/reset
interpretations are annotations. The 85-line post-first-reset goal supplies no
implicit branch gate. Exploratory JSON is displayed separately and is never read
by aggregate or correctness computations.

Use the explicit legacy adapter for existing saved runs:

```sh
node scripts/evaluate-st-protocol.cjs --adapt OLD_RUN --out NEW_ADAPTER_DIRECTORY
node scripts/evaluate-st-protocol.cjs --legacy --protocol retrospective.json --baseline OLD_BASE --candidate OLD_CANDIDATE --receipts receipts.json --out NEW_REPORT
```

Old artifacts remain retrospective even when later supplied a matching protocol.
Retrospective numeric criteria may pass, but the aggregate acceptance status
remains incomplete. Unsupported old input/source contracts must be migrated
explicitly; this adapter does not guess missing measurements or roots.
