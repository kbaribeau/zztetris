# Opening development checkpoint: 2026-10-24

## What changed

- Reject proposed prefixes that create newly roofed non-right vacancies with no demonstrated current tetromino access. Flood connectivity alone was insufficient for the reported column-three gap. This does not classify every already-existing access loss or promise that a hypothetical repair piece is available.
- Preserve and regenerate actual scoring-notch history through real locks and clears, including the observed quad followed by an otherwise invalid L placement. Reset/import/Undo and manual deviations have explicit boundaries.
- Discover and retain a finite two-visible-T Left-foundation construction when it pays the observed scoring-row deficit without displacing checked scoring, cap, I-cleanup or Center goals. This is not a full Reset coach.
- Do not certify an opening repair as completed when its top motif is level but known lower Center debt remains. Unknown phase remains explicitly unknown; temporary debt that is actually repaired by the endpoint remains valid.
- Avoid expanding a node whose executed prefix has already received a definitive negative access result. Unknown checks are not pruned. This is a sound allocation change under the current no-delayed-repair policy, not a demonstrated performance gain.
- Add offline followed-decision usage summaries, and make recorded-action replay ignore only regenerated elapsed-time metadata while retaining exact substantive request/event/state checks.

The opening fixture was reduced from 1,358,616 to 216,816 readable bytes without dropping consumed controls or tests. Its old large version was removed from the published ancestry, with a local backup retained. No heuristic or test was deleted based on low usage.

## Versions and protocol

The latest evaluated engine is local `e44daadb3e7db9cbf7adc81f991d4d4bd72daa08`, tree `e75ee04dd7f6ab3bf3c72185e3bad53a88bb88c7`. Its full suite passed 507/507 in 115.3 seconds. Independent focused reviews covered access/history, construction lifecycle, fixture projection, replay semantics and pruning.

The published checkpoint at the time of this report is `93b6f17233874f48b863bd6a4c71ca26f23119da`, tree-equivalent to local `eb3c9c3`, with 500/500 tests. The later completion/replay/pruning work is a separate local checkpoint, not silently represented as already published. Older local version identifiers below refer to preserved research archives, not a promise that all were published commits.

Runs used the actual fresh worker/controller lifecycle, unlimited hold, six visible previews, a 45,000-node/750ms planning allowance and150-lock cap. Future stream pieces were private to the simulator and revealed only by actual draws. Inputs were fixed before outcomes; there were no result-replacing retries. Wall-clock budgets are not hard process-runtime guarantees. All 817 actual locks in the final15 runs were independently replayed.

The joint criterion is a checked opening handoff followed by two Tetrises with an intervening full T-spin double. It is stricter than merely finding the first scoring clear, but it is not indefinite-play proof.

## Results, with separate baselines

[Compact per-seed results](st-opening-development-2026-10-24.csv) include every run and equal-exposure lines, mass and height. This small summary deliberately excludes bulky traces and unused advice metadata.

| Cohort | Baseline | Handoffs before → after | Joint successes before → after |
|---|---|---:|---:|
| Seven repeated development streams | `eb3c9c3` |5→4|4→3|
| Eight predeclared additional development streams | `c209e600` |4→3|1→0|

Do not pool those different baseline comparisons into a causal improvement estimate. All 15 final runs abstained. None ended with an illegal move, top-out, recorded policy violation or harness failure, but that does not mean all construction debts were repaired or all positions remained strategically healthy. The selected development sample does not establish the requested >99% success rate at 95% confidence. No dedicated Reset coach was started.

Two concrete positive mechanisms were observed:

- Stream 502400001 autonomously selected the new pair at locks 13–14. Compared with the earlier `493b82a`13-lock stop, it reached 130 locks, 38 lines and three Tetrises. Later structural debt still developed and it eventually abstained. The finite pair and the later trajectory are different claims.
- The predeclared stream 503552020 independently selected the same general stage at13–14 and improved from 13 to 70 locks, but completed only one Tetris and did not meet the joint criterion.

The final same-seven regression was503237833:86 locks with a joint success became 29 without handoff. Its first differing move occurred on the identical empty state before any access pruning or repair retention. Both timed runs completed depth 2 and stopped during depth 3. The additional503656749 regression also first differed at a timed initial decision. These findings do not excuse the failures, but they prevent attributing them to a guard that had not fired.

## Fixed-root diagnosis, not a new production policy

Three fresh-worker diagnostic searches on the503237833 root used the same45,000-node allowance with the wall cutoff enlarged only for this isolated experiment. Depth 2 completed in 514ms and chose O-center. Fully completed depths3 and4 took 809ms and 1008ms and both chose the horizontal I. All returned continuations were replayed. These diagnostic calls did not replace any rollout or change production depth/budgets.

At equal three-lock exposure, both recorded O-first and I-first routes had height 3, balanced Left parity and no covered cells. O-first retained I; I-first retained L. The current rank favors I-first by 4.2 points, largely from two fewer empty scoring-row cells and slightly lower Left roughness. Thus the problem is not simply an unfinished search layer: a completed deeper search also prefers that short-horizon endpoint. The particular shapes and future repair resources matter beyond the empty-cell count; one private continuation is not enough to justify a universal I-holding bonus.

A last-completed-layer selection policy is a reasonable future ablation, but it can discard useful checked deeper routes and remains timing-sensitive when completed depth differs. It was not rushed into production. Nor was a blanket I-left rule, a T-pair exception, or a larger lookahead default added to force the successful development branch.

## Usage and remaining limits

Offline telemetry recorded 817 followed decisions, 15 abstentions, four Left-foundation stage markers across two streams, 146 retained commitments and 35 retained opening repairs. The new stage is rare but demonstrably useful; low frequency alone is not evidence of unnecessary code.

Explicit limit flags appeared on 34/362 opening decisions and 446/470 maintenance decisions. These are not all abstentions and are not a complete profile of rule cost. Pruning was reported for 35 prefixes across 15 decisions in four streams, with no demonstrated outcome benefit in this sample. The telemetry identifies reported families/certificates/citations, not internal causal rule firings or per-rule eligibility. Those must be instrumented and measured before evidence-based removal or matched ablation.

Real-browser verification of the latest copy was blocked by preview-network isolation. The supported browser existed, but could not reach the isolated local server; a separate sandboxed Chromium launch was also unavailable. Actual controller/DOM tests and production-advice checks passed. No live rendered check or screenshot is claimed for this checkpoint.

Next work should distinguish short-horizon ranking from cutoff effects, measure actual eligible/fired/cost data for expensive rules, and study visible-supply repair demand before changing resource priorities. Preserve the recorded failures and use untouched validation only after development behavior is substantially more reliable.

## Earlier cause of the late maintenance defect

In the improved502400001 trajectory, the first buried Center vacancy appears at J105, but the earlier departure is S99. The Center after TSD98 is aligned, reference-supported S/L geometry with profile[3,4,4]. S99 crosses columns4–6, changes it to an unrecognized[5,5,4] pattern and changes Left balance from0 to1. The advice was only a one-lock fallback after one of73 roots was expanded; it did not certify later restoration. O103 creates a shallow partner-shaped top without genuine reusable support, and J105 finally roofs the remaining non-notch cell.

Actual S-left alternatives exist on that same board and preserve the Center, but the low ones create a J-dependent Left pocket. A bounded visible-supply S/I/Z/TSD/J counterfactual legally fills that exact pocket after the clear translates it from[3,36] to[3,38]. The first tested horizontal-I variant creates another pocket and is explicitly incomplete. A vertical-I variant leaves no covered Left cells, but still ends with an unrecognized Center[4,2,2] and Left balance1. Both variants are preserved in the research evidence; neither establishes a complete rescue, superiority or longer survival. No new priority rule was added from them.

This reinforces the next investigation: finite repair obligations must include the resulting geometry and actual available resources, rather than equating a hypothetical access witness, a flat skyline or one repaired cell with sustainable construction.
