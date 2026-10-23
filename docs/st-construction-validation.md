# Construction-stage validation

## First reviewed implementation

Commit `380c200` adds finite paired-T established-center recovery. Full suite:
407 passing tests. Independent stage and actual-page lifecycle review: 19 passing
checks. It discovers a seven-lock route without source moves in about 397 ms cold
and 157 ms warm in the initial measurements.

The ordinary beam remains depth three. The construction-stage search can reach
seven locks under the same response budget. Restricted surface/tuck enumeration
and stage priorities, not merely raising the ordinary depth number, enable this.

## Matched timed continuation comparison

Baseline `20b23a5` versus `380c200`, identical existing streams, 750 ms, 45,000
movement nodes, fresh structural caches, actual commitment/preview lifecycle,
130-lock cap. Total comparison time was about 9.5 minutes. The converted-quiz
continuation is explicitly synthetic and carries no original-player input claim.

| Case | Baseline locks | Candidate locks | Baseline/candidate mean height at common endpoint |
| --- | ---: | ---: | --- |
| Preparation, seed 10333 | 130 | 54 | 10.5 / 15.3 |
| Rebuild, seed 20333 | 130 | 66 | 8.3 / 15.4 |
| Direct double, seed 20339 | 127 | 127 | 14.4 / 14.8 |
| Right cap, seed 20336 | 101 | 101 | 14.9 / 14.9 |
| Synthetic recovery from page 366 | 0 | 55 | No shared completed-lock endpoint |

Stops below 130 were abstentions, not topouts. No illegal witness, noncanonical
clear, protected-notch breach or newly sealed internal cavity was observed.

None of the four existing-seed runs invoked construction. Their early differences
arose when the wall-clock cutoff changed completed ordinary depth or the retained
continuation. In one case the candidate searched deeper yet later stopped sooner.
At all three distinct first-continuation-divergence snapshots, equal 45,000-node
runs without the wall-clock cutoff returned identical complete continuations.
This isolates important timing sensitivity but does not erase the raw timed
regressions or establish overall longer-play improvement.

The synthetic recovery run did use the seven-lock stage and continued to 55 locks
where the baseline refused the initial geometry. This demonstrates a real scope
improvement on that supplied setup, not indefinite sustainability.

## Subsequent replacement-Z work

The later finite replacement-Z addition needs its own tests and bounded sanity
comparison; do not attribute the table above to that later revision. Its short
macro retains a 120 ms wall-clock allocation even when an external caller omits a
main time limit, so “fixed-node” alone is not deterministic for eligible cap cases.

The final replacement-Z revision passed the full 413-test suite (92.24 seconds)
and an independent 25-test construction/UI run (17.28 seconds). This includes
actual refreshed preview, manual deviation, incorrect cap repayment, forged
stage kind, and competing I-cleanup negatives. The source-1554 synthetic public
observation admits a checked three-lock diversion, but ordinary cap-first reaches
the same 44-cell, height-9 endpoint and remains preferred. These results establish
finite proof and lifecycle correctness, not a general Reset policy.

## Final short sanity check (4f6803b)

A separate 24-lock, 750 ms matched check compared the final Z revision with
20b23a5 on the same four existing seeds plus an explicitly synthetic replacement-Z
stream. All ten trajectories completed 24 locks. There were no illegal witnesses,
noncanonical clears, protected-notch violations, topouts or new internal seals.

Rebuild, direct-double, right-cap and synthetic-Z endpoints had identical occupied
material and mean height. Preparation retained 102 cells in both versions, but
mean height increased from 10.5 to 11.0 and maximum height from 16 to 17. No finite
construction route was selected in these short runs. The Z control considered
three certified alternatives and retained ordinary cap-first; both versions ended
with 108 cells and mean height 12.7. The synthetic refill was a declared repeating
seven-piece permutation, not reconstructed original-player input.

This small check does not replace the longer comparison above or demonstrate a
general survival gain. The concrete advance is discovering and retaining a safe
seven-lock recovery previously rejected, and admitting finite visible-Z deferral
for fair comparison without forcing it when ordinary play is equivalent.
