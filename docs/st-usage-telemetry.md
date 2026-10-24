# Simulation decision-usage telemetry (schema 1)

Run after a simulation, without rerunning the planner:

```sh
node scripts/lib/st-usage.cjs test-results/simulation/RUN > usage.json
# An individual RUN/empty-SEED directory also works.
```

This first increment analyzes existing lock/stop records. It adds **zero instrumentation inside timed search**, does not modify existing artifacts, and requires no dependencies. The exported `createCollector(provenance)` also accepts decision-boundary records with `observe(record)` and returns a bounded `snapshot()`; live runner integration is separate.

## What is counted

Each executed `lock` contributes once to the followed-decision denominator. Each recorded `stop` contributes once to not-followed decisions, including abstentions, malformed advice and execution errors. Summary records are ignored. A returned recommendation that was not executed is never counted as followed.

Markers are deduplicated within each decision and grouped by the actual advice phase (falling back to the requested phase). Output preserves the manifest's source commit, source hashes, settings, execution protocol and completeness. Recorded-decision counts are **phase-level opportunities, not eligibility counts for each heuristic**.

Stable schema-1 marker namespaces:

- `selected-family`: explicit `evidence.strategy`, `opening`, and `construction:<evidence.construction.kind>`. These identify the reported family, not its causal scoring influence.
- `supporting-certificate`: explicit opening repair/handoff evidence, retained commitments, named preparation proofs and successful movement-access certificates.
- `reported-access-result`: explicit rejected or unknown movement-access results. This is not a census of rejected search branches.
- `presentation-source`: exact existing `sources[].id` values. A citation being displayed is not proof its associated rule fired.

Free-form explanations are not parsed into IDs. At most256 phase/category/ID combinations are retained; `overflowSignals` explicitly reports truncation. Unknown/missing family attribution is counted. No boards, private streams, witnesses or verbose explanations are copied into the aggregate.

## What this cannot establish

Internal rule firings, scoring contributions, rejected candidate branches and per-rule eligible opportunities are marked `not-instrumented`. A supporting proof may certify a multi-lock continuation; its presence does not imply the entire continuation was followed. A successful access check may concern hypothetical piece access, not current visible supply or a complete repair schedule.

Zero appearances can mean missing instrumentation, rare inputs, prior filtering, small cohorts or absent eligibility. **Do not delete heuristics or tests from these counts alone.** Development seeds are not held-out reliability certification, and wall-clock search remains timing-sensitive. Keep direct rules, hold, commitment, gap, history and Undo safety tests even when simulation coverage grows.

Before pruning, add stable IDs at the actual rule/scoring/blocking site, record eligible and fired counts separately, then perform a bounded matched ablation on fixed versions and fresh validation where appropriate. Instrumentation changes must be versioned and their runtime overhead measured before comparing timed search results.
