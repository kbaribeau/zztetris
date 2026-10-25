# Simulation decision-usage telemetry

Report schema2 supports legacy traces and opt-in opening search telemetry schema1.

```sh
npm run sim:st -- --preset quick --usage-telemetry
node scripts/lib/st-usage.cjs test-results/simulation/RUN > usage.json
# An individual RUN/empty-SEED directory also works.
```

The analyzer reads saved lock/stop records without rerunning search or modifying artifacts. It has no search-timing overhead and requires no dependencies. The exported `createCollector(provenance)` accepts decision-boundary records through `observe(record)` and returns a bounded `snapshot()`.

Richer engine counters require `--usage-telemetry` on a new run or rerun, which sets the explicit planner option `usageTelemetry: true` and records it in the manifest/spec configuration. It cannot be applied retroactively to replay/compare. They are **off by default**. Enabling counters is a different diagnostic configuration, even though the scoring policy is unchanged; measure overhead before making timed comparisons. No per-rule clocks were added. Existing production traces still produce useful evidence summaries, with missing detailed instrumentation reported as missing rather than zero.

## Followed decisions and evidence markers

Each executed `lock` contributes once to followed decisions. Each recorded `stop` contributes once to not-followed decisions, including abstentions, malformed advice and execution errors. Summary records are ignored. A recommendation that was not executed never counts as followed.

Markers are deduplicated per decision and grouped by actual advice phase, falling back to requested phase. Source commit, source hashes, settings, execution protocol and manifest completeness are preserved. Decision denominators are **phase-level opportunities, not eligibility counts for each heuristic**.

Marker namespaces:

- `selected-family`: explicit `evidence.strategy`, `opening`, and `construction:<kind>`. These identify a reported family, not causal scoring influence.
- `supporting-certificate`: repair/handoff evidence, retained commitments, preparation proofs and successful movement-access certificates.
- `reported-access-result`: explicit rejected or unknown movement-access results, not all rejected search branches.
- `presentation-source`: exact `sources[].id` values. A citation is not evidence that a rule fired.

## Opt-in opening search counters

The analyzer recognizes `advice.metrics.usage` with `schemaVersion: 1` and `scope: 'opening'`:

- `families.ordinary.enumerated`: candidates returned by legal enumerations.
- `examined`: candidates actually passed to step validation after the deadline check.
- `admitted` and `ranked`: valid children and their raw rank evaluations.
- `deduplicatedRanked`: unique nodes retained after deduplication.
- `budgetSkipped`: enumerated minus examined, not proof those candidates were bad.
- `selected`: whether this family supplied the selected decision.
- `families.retainedRepair`: provided, verified and selected counts.
- `families.handoff`: actual-clear input provided, probes, verified results and selections.
- `rejections`: **first failing short-circuit gate** for examined steps. These are candidate-step counts, not unique moves, all applicable violations, or per-guard eligibility counts.
- `access`: checked, witnessed, rejected, unknown and reused-proof/cache-hit counts.
- `selected`: the decision path, prefix length, full lexicographic rank and named signed scalar contributions. Actual-clear handoff deliberately need not have opening rank/components.

`searchUsage.counters` reports each field's sum, observed-decision count, nonzero-decision count and range, split by followed/not-followed outcomes. Explicit zero is an observation; an absent field is not. `selectedScoreComponents` reports signed evaluated terms with the same distinctions. Full rank vectors remain in the original trace; the aggregate counts their presence rather than treating averaged lexicographic vectors as a ranking.

`decisionCosts` summarizes existing whole-decision `nodes` and `elapsedMs` only for instrumented decisions. These are not family costs, causal costs or an additive breakdown of nested work. CPU profiles and controlled overhead measurements remain separate evidence.

Each aggregate table is bounded to256 rows. Overflow, unsupported schemas and invalid numeric fields are explicit. Free-form explanations are not parsed as identifiers. No boards, private streams, witnesses or verbose explanations are copied into the aggregate.

## Interpretation and limits

Selected numeric score contributions show what the winning endpoint was evaluated with, not why it beat every alternative or what would happen if a term were removed. Rejection counters show executed first-failing gates, not all relevant safety conditions. General rule firings, complete eligibility and per-rule cost remain incompletely instrumented.

A supporting proof may certify a multi-lock continuation that was never fully followed. Hypothetical piece access does not imply current visible supply or a complete repair schedule. Keep evaluated prefixes distinct from the actual played sequence.

Zero appearances can mean missing instrumentation, rare inputs, prior filtering, small cohorts or absent eligibility. **Do not delete heuristics or tests from these counts alone.** Keep direct rules, hold, commitment, gap, history and Undo safety tests. Development seeds are not held-out reliability certification, and timed search remains timing-sensitive.

Before pruning, measure eligible/attempted/rejected/selected behavior at the relevant rule site, profile cost separately, and perform a bounded matched ablation on fixed versions. Use fresh validation for reliability claims after tuning. Version instrumentation changes and measure their overhead rather than silently mixing configurations.

### Finite-foundation stages

The offline report keeps three different observations separate:

- `foundation-stage-in-selected-path`: the selected opening path contains a checked stage. Earlier prefix moves are not stage completions.
- `finite-foundation-provided` and `finite-foundation-goal-retained`: an incoming finite goal exists, and, separately, the engine reports retaining its proof.
- `marked-foundation-completion`: a followed lock event exactly matches the marked first continuation step. Its nonempty, unique, in-bounds Center targets must be empty in the recorded origin and occupied by that event; its level must be well formed. This reports recorded certificate execution, not an independent geometry revalidation.

A replacement can preserve and eventually pay a finite goal while omitting the original per-step stage marker. Such completion is deliberately not inferred from goal presence or a selected-path flag. Therefore marked completion counts are a lower bound on observed use, not an exhaustive count of all successful foundation repairs. A level surface alone also does not establish a recognized, reusable Center motif or maintenance handoff.

When supplied under opt-in `metrics.usage.families.foundationStage`, the existing generic family collector records the explicit stage counters, including `selectedPath` and `retainedGoal`. Stage node counts are a reported subset of whole-decision nodes, not additive independent costs. Missing groups remain uninstrumented, never zero.

## Opt-in maintenance preprocessing

The same engine schema version 1 also accepts `scope: 'maintenance'`. Aggregates key and label every counter, selected path, score component and cost by both instrumentation scope and actual advice phase. An opening handoff reported in maintenance-phase advice therefore cannot collide with ordinary maintenance instrumentation. Old opening records continue to work; missing records and unsupported schemas remain explicitly distinct.

Maintenance families are partial, site-specific observations:

- `cleanupBeforeCap`: `attempted`, callback visits `examined`, actual `nonISkipped` and `iColumnSkipped`, `iTransitionChecked`, `verified` actual I-to-cap witnesses, and `unknown` incomplete enumerations without a witness. Visits are not the complete legal root set.
- `earlyCapFallback`: `scanEligible` means the exact complete-root/no-incoming-proof scan prerequisites passed, not broad geometric eligibility. `attempted`, `verified`, `selected` and `nodes` retain their distinct meanings.
- `visibleCyclePreparation`: `eligible`, `attempted`, `verified`, `selected`, `nodes` and `unknown` are explicit reported family counts. Missing fields remain uninstrumented.

Dynamic numeric fields are retained, not guessed from prose. Counter sums count evaluations; `observations` count reporting decisions, including explicit zeros; `nonzero` counts decisions with a nonzero value. Followed and not-followed decisions remain separate. Early returns before the instrumented search may have no maintenance usage record.

`costsMs` becomes `searchUsage.familyBoundaryCosts`: nonnegative finite millisecond measurements at opt-in preprocessing boundaries. These are **inclusive**, potentially overlapping timings. Do not sum them into total runtime or interpret them as causal/per-rule costs. Whole-decision nodes and elapsed time stay separate. Instrumentation is default-off and its overhead must not be silently mixed into timing comparisons.

A raw `earlyCapFallback.selected === true` on a followed lock adds the selected-family marker `early-cap-fallback`. Verification alone, or selected metadata on a stop record, does not count as executing the backup. This marker proves neither a future T-spin Double nor a completed cycle. No heuristic or safety test should be removed from absence or low usage alone.
