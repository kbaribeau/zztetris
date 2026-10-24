# Temporary planning allowance and performance debt

On 2026-10-24 the user explicitly authorized temporarily relaxing the planning deadline while opening development continues. The page and simulation production configuration now use **1500 ms**, with the existing **45,000-node cap**, depth 3/width 8 maintenance settings and **2.5-second worker watchdog** unchanged. These are soft planning/operational limits, not guaranteed end-to-end latency. The original **750 ms goal remains the restoration target**, not a deleted requirement.

## Evidence and limits

The [predeclared twelve-call comparison](st-planning-budget-comparison-2026-10-24.json) used three exact public roots on frozen 266282c, fresh actual workers, ABBA 750/1500/1500/750 order and the same node cap. The O6 opening closure completed identically under either allowance. Maintenance24 produced one budget abstention and one verified prefix at 750 ms, versus two valid caps with two completed layers at 1500 ms. Maintenance41 chose the same S but completed an additional layer with the larger allowance. Observed 1500 ms decisions could finish just beyond their soft deadline. More search completion is not a demonstrated long-run strategic improvement.

All earlier matched cohorts remain 750 ms trials. Their failed runs, severe timing-boundary abstentions and mixed outcomes are preserved. There has been no new broad 1500 ms acceptance campaign. Every simulation manifest records its actual configuration; comparing different budgets as though they were the same is rejected.

## Concrete optimization lead, not an implemented policy change

A [single profiled maintenance24 call](st-planning-setup-profile-2026-10-24.json) sampled roughly 498 ms inside enumeration, including 336 ms in a cleanup-before-cap callback; actual placement enumeration was roughly 159 ms and root assessment roughly 203 ms. These inclusive measurements overlap and must not be summed. Profiling adds overhead and one sample is not a calibrated benchmark.

The callback computes full structural transitions for roots before asking whether they prepare an outer-I cleanup. That category requires an I, while this exact root has no visible I. A type-I prerequisite is a concrete semantics-preserving optimization candidate, not yet implemented. Separately, the recorded seven-input Z-cap passes actual movement, inherited-notch/cycle and access checks with zero access-search nodes; there is no competing I-cleanup obligation at this root. Certifying and preserving such a fallback before optional long preparation is worth investigating, but no general fallback rule is proved or added here.

## Returning to 750 ms

Use usage/eligibility/rejection/cost telemetry to identify unnecessary work, then verify semantic equivalence or explicitly test changed search behavior. Do not delete rare safety guards or tests simply because a small cohort did not exercise them. Restore 750 ms after focused root coverage and representative matched development checks fit reliably, preserving actual resource/goal commitments and safety gates. Keep the final validation set untouched until development results support a genuine reliability claim. A dedicated Reset coach remains deferred.
