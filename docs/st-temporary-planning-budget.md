# Planning allowance, safeguards and historical measurements

On 2026-11-15 Kevin rejected timeout-derived numerical goals and acceptance gates. The earlier 750 ms restoration target is superseded. Planning deadlines and watchdogs are operational safeguards, not coach correctness or quality goals or acceptance criteria. No replacement numerical target is established. Evaluate coaching against the [ST Lab vision](st-lab-vision.md): supported doubles-focused continuation, straightforward execution, truthful brief explanations, optional advice and better independent player judgment. Preserve honest abstention when a continuation is unsupported; reducing abstention counts alone is not success.

The page and simulation production configuration still use **1500 ms**, with the existing **45,000-node cap**, width 8 maintenance setting and **2.5-second worker watchdog** unchanged. These are operational limits, not guaranteed end-to-end latency. This guidance changes no runtime limit or watchdog. The October 24 relaxation and the measurements below remain historical evidence at their recorded configurations.

The shared runtime allowance is `STCoachConfig.SEARCH_TIME_MS` in
`st-coach-config.js`; the worker, simulations and timed regressions use that
constant. The [test-suite watchdog](../TESTING.md#results-and-failures) is separate,
and constrained research probes and internal sub-searches retain their own limits.

Ordinary maintenance search now follows the finite public-piece horizon rather than stopping at three locks. Active, HOLD, preview and a logically forced bag tail are the only available supply. The production setting is `depth: null`; explicit finite depth overrides remain available for constrained tests. Reset likewise no longer defaults to three locks, but still uses only literal observed supply and its existing seven-lock proof limit. Local repair/certification grammars retain their existing separate bounds, including seven-lock proof limits. Deeper search can consume the same node/time budget sooner and is not a promise of better play.

## Timeout continuation-library check

Make library-hit inspection a standard timeout diagnostic:

1. Capture the exact replay-backed public request: board/active pose, HOLD,
   visible queue, bag and obligation accounting, coach phase and retained advice.
   Record source revision, time/node budgets and any nested proof limit or worker
   watchdog that stopped work. Keep unseen order evaluator-side.
2. Inspect the actual Left/Center lookup path. Record the exact route or completion
   identifier and whether it was missing, matched, disqualified (with reason),
   admitted or used in the returned witness. Distinguish a stored route from a
   generated Center motif/pair completion; report when no comparable library
   entry exists. A lookup match or generic query-cache hit is not a selected,
   replay-verified continuation.
3. Separate retrieval from placement search and resource/access proof costs.
   Record total decision time/nodes plus route-lane and admission work, including
   failed attempts; do not sum overlapping timings. Fewer nodes need not mean a
   faster response.
4. When useful, temporarily remove or mask only the exact hit in an isolated
   checkout and run serial, paired, interleaved remove/restore trials with the
   same state, visible supply, budgets and cache/warmup conditions. Verify real
   hit versus absence, unchanged neighboring entries, and byte-for-byte
   restoration. Controlled-clock, equal-node-budget checks can separate search
   work from timing noise; verify restored advice against the untouched baseline.
5. Compare abstention, work and time at comparable quality: replay actual locks
   and canonical clears, protected notches, resource obligations and Left/Center
   endpoints. Different prefixes are not a same-quality speed comparison. A
   finite repair or longer checked prefix is not proof of stable resolution;
   report incomplete proofs and limits on generalization.

This diagnostic authorizes no automatic library admission or default-budget
change. Review and validate any proposed stable witness separately, including
normal preview reveals. Wall-clock measurements remain diagnostics, never test
thresholds or correctness gates. Use the [research process](st-research-workflow.md)
for bounded experiments and retain evidence outside Git.

## Historical evidence and limits

The [predeclared twelve-call comparison](st-planning-budget-comparison-2026-10-24.json) used three exact public roots on frozen 266282c, fresh actual workers, ABBA 750/1500/1500/750 order and the same node cap. The O6 opening closure completed identically under either allowance. Maintenance24 produced one budget abstention and one verified prefix at 750 ms, versus two valid caps with two completed layers at 1500 ms. Maintenance41 chose the same S but completed an additional layer with the larger allowance. Observed 1500 ms decisions could finish just beyond their soft deadline. More search completion is not a demonstrated long-run strategic improvement.

All earlier matched cohorts remain 750 ms trials. Their failed runs, severe timing-boundary abstentions and mixed outcomes are preserved. These recorded comparisons did not establish broad strategic acceptance. Every simulation manifest records its actual configuration; comparing different budgets as though they were the same is rejected.

## Original profiling lead

A [single profiled maintenance24 call](st-planning-setup-profile-2026-10-24.json) sampled roughly 498 ms inside enumeration, including 336 ms in a cleanup-before-cap callback; actual placement enumeration was roughly 159 ms and root assessment roughly 203 ms. These inclusive measurements overlap and must not be summed. Profiling adds overhead and one sample is not a calibrated benchmark.

The callback computed full structural transitions for roots before asking whether they prepare an outer-I cleanup. That category requires an I, while this exact root has no visible I. This identified a semantics-preserving prerequisite optimization. Separately, the recorded seven-input Z-cap passed actual movement, inherited-notch/cycle and access checks with zero access-search nodes, with no competing I-cleanup obligation. These were investigation leads at the time of the original profile, not proof of a general fallback rule.

## Implemented bounded follow-up

Cleanup qualification now skips non-I events and I placements outside the actual preparation column before doing the full transition check. This uses the emitted event rather than preview membership, so empty HOLD exposing I remains covered. An exact, fully certified one-lock Z cap may be retained before optional preparation, only as a backup when ordinary search has no checked result and no saved goal or cleanup commitment would be displaced. Actual root completeness, canonical/notch/cavity/strict endpoint/T-entry/access checks remain required.

Four fresh matched 1500 ms development pairs compared `075c4c7` with `e3b20fe`: all 794 locks and event sequences were identical, with 397 locks per version. There were 21 verified backups and none selected. This preserves the tested trajectories but does not demonstrate a long-run rescue; deadline resilience is established only by the controlled low-budget cases. Later maintenance telemetry is opt-in and reports inclusive preprocessing boundaries without pretending overlapping timings are additive causal costs. Full decision accounting includes failed final access work and selected construction proof costs.

The separate [level-two re-entry result](st-level-base-reentry.md#matched-production-budget-result) repairs a specific rejected saved S goal. It does not broaden this fallback; its recorded time budget is historical context, not a restoration requirement.

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

## Ongoing engineering guidance

Use usage/eligibility/rejection/cost telemetry to identify unnecessary work, then verify semantic equivalence or explicitly test changed search behavior. Do not delete rare safety guards or tests simply because a small cohort did not exercise them. Preserve actual resource/goal commitments and correctness checks. Compare matched configurations and retain failures and incomplete evidence; timing can affect which supported continuation is discovered. Keep fresh validation inputs untouched until development results support the claim being tested. Do not turn a deadline, watchdog, faster run or lower abstention count into a quality gate. See the separate [Reset coach contract](st-reset-coach.md) for its current scope.

## November 20–22 development evidence

These checks used the published runtime at `6a404328` unless otherwise noted.
None of the experiments below changes the search defaults or approves a
continuation-library entry.

- A disposable route-allocation comparison changed the initial contour lane
  from half to a quarter of the shared limits. In the fresh six-seed cohort,
  one run improved (37 to 80 locks, 6 to 26 lines); two regressed (90 to 77
  locks, 28 to 26 lines; 90 to 82 locks, 30 to 28 lines); three were unchanged.
  The earlier cohort included a separate 43-to-90-lock improvement. Keep the
  existing default. Matched first-divergence checks showed the new allocation
  could change general search later in the decision without selecting a stored
  route. One improved example is not a release gate.
- Seed 2026116329 had two checked lines from the exact same pre-lock-74
  request. An in-region L and a crossing L both paid the same exact S and
  scored full doubles at locks 76 and 82. The crossing paid that S at lock
  77 rather than 79. The crossing then exhausted 45,000 nodes before lock
  83 with both the normal clock and a longer clock. A diagnostic 120,000-node
  allowance found a checked Center L, after which ordinary limits yielded
  seven more legal locks, repaid a new S at lock 84, and scored a third full
  double at lock 86. This is evidence that the search stop wasn't a dead
  end in that sequence, not a reason to prefer crossing or expand the
  default budget.
- Actual post-Reset play gives a useful contrast. Seed 2026116207 made the
  second qualifying Left T at lock 78 and scored a full double with the
  ordinary coach at lock 90. A separate seed, 2026116229, completed Reset
  but still had no supported move before lock 83. Its checked node count
  stayed at 19,540 at both 45,000 and 120,000 allowance with the wall cutoff
  disabled. That differs from the crossing's node-limited stop and does
  not prove that no playable continuation exists.
- In a diagnostic prototype, replaying positive Right-access witnesses could
  remove work, but one expensive abstention became slower and the positive
  control's time barely changed despite fewer nodes. Failed replays still
  needed the existing proof; do not cache a negative answer or deploy this
  as a practical speedup.

The established timeout diagnostic remains the right first check: preserve an
exact native checkpoint; identify a genuine selected library hit or absence;
split clock and node limits; then replay the proposed path under actual public
reveals before considering it for the library.
