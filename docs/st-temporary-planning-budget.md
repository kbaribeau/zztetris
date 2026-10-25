# Temporary planning allowance and performance debt

On 2026-10-24 the user explicitly authorized temporarily relaxing the planning deadline while opening development continues. The page and simulation production configuration now use **1500 ms**, with the existing **45,000-node cap**, depth 3/width 8 maintenance settings and **2.5-second worker watchdog** unchanged. These are soft planning/operational limits, not guaranteed end-to-end latency. The original **750 ms goal remains the restoration target**, not a deleted requirement.

## Evidence and limits

The [predeclared twelve-call comparison](st-planning-budget-comparison-2026-10-24.json) used three exact public roots on frozen 266282c, fresh actual workers, ABBA 750/1500/1500/750 order and the same node cap. The O6 opening closure completed identically under either allowance. Maintenance24 produced one budget abstention and one verified prefix at 750 ms, versus two valid caps with two completed layers at 1500 ms. Maintenance41 chose the same S but completed an additional layer with the larger allowance. Observed 1500 ms decisions could finish just beyond their soft deadline. More search completion is not a demonstrated long-run strategic improvement.

All earlier matched cohorts remain 750 ms trials. Their failed runs, severe timing-boundary abstentions and mixed outcomes are preserved. There has been no new broad 1500 ms acceptance campaign. Every simulation manifest records its actual configuration; comparing different budgets as though they were the same is rejected.

## Original profiling lead

A [single profiled maintenance24 call](st-planning-setup-profile-2026-10-24.json) sampled roughly 498 ms inside enumeration, including 336 ms in a cleanup-before-cap callback; actual placement enumeration was roughly 159 ms and root assessment roughly 203 ms. These inclusive measurements overlap and must not be summed. Profiling adds overhead and one sample is not a calibrated benchmark.

The callback computed full structural transitions for roots before asking whether they prepare an outer-I cleanup. That category requires an I, while this exact root has no visible I. This identified a semantics-preserving prerequisite optimization. Separately, the recorded seven-input Z-cap passed actual movement, inherited-notch/cycle and access checks with zero access-search nodes, with no competing I-cleanup obligation. These were investigation leads at the time of the original profile, not proof of a general fallback rule.

## Implemented bounded follow-up

Cleanup qualification now skips non-I events and I placements outside the actual preparation column before doing the full transition check. This uses the emitted event rather than preview membership, so empty HOLD exposing I remains covered. An exact, fully certified one-lock Z cap may be retained before optional preparation, only as a backup when ordinary search has no checked result and no saved goal or cleanup commitment would be displaced. Actual root completeness, canonical/notch/cavity/strict endpoint/T-entry/access checks remain required.

Four fresh matched 1500 ms development pairs compared `075c4c7` with `e3b20fe`: all 794 locks and event sequences were identical, with 397 locks per version. There were 21 verified backups and none selected. This preserves the tested trajectories but does not demonstrate a long-run rescue; deadline resilience is established only by the controlled low-budget cases. Later maintenance telemetry is opt-in and reports inclusive preprocessing boundaries without pretending overlapping timings are additive causal costs. Full decision accounting includes failed final access work and selected construction proof costs.

The separate [level-two re-entry result](st-level-base-reentry.md#matched-production-budget-result) repairs a specific rejected saved S goal. It does not broaden this fallback or restore the original time budget.

## Rejected global flood optimization

The full maintenance assessment intentionally still uses its earlier flood.
This is not an overlooked untested shortcut: the `9aca81e` bundle already
substituted the exact faster flood globally. Independent complete-assessment and
fixed-node comparisons matched, but timed development streams changed, including
502400001 falling from 116 to 43 locks. The extra eight-stream sample also had
mixed gains and losses. `266282c` restored full `P.assess` byte-for-byte to the
prior implementation and kept the optimization in the opening-only query.
See the [preserved closure ablation and timing review](st-visible-closure-review-2026-10-24.md).
Do not reintroduce this discarded global change merely because its facts or
fixed-node advice are equivalent: changing cutoff timing can change policy.

## Returning to 750 ms

Use usage/eligibility/rejection/cost telemetry to identify unnecessary work, then verify semantic equivalence or explicitly test changed search behavior. Do not delete rare safety guards or tests simply because a small cohort did not exercise them. Restore 750 ms after focused root coverage and representative matched development checks fit reliably, preserving actual resource/goal commitments and safety gates. Keep the final validation set untouched until development results support a genuine reliability claim. A dedicated Reset coach remains deferred.
