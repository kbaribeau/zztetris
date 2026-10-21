# Live-frontier continuation follow-up

Recommendation 1 only, on the existing experimental playtest branch / [PR #16](https://github.com/kbaribeau/zztetris/pull/16).
No replacement acceptance, merge or deployment. The comparison baseline is the
corrected published candidate `efe107017b4c0e959d13de9a3fce31fe89a1019c`, not the
older pre-review allocation candidate. The measured implementation's `st-core.js`
SHA-256 is `9123ae026cd573d4360da4ceccb4cde2be206490523ffeabe53e29fbf46ed32f`.

## Selected change and unchanged boundaries

The [implementation contract](../ST-LAB.md#implementation-and-work-limits) owns
the details: prioritize the current frontier rather than historical best rank /
maximum depth; use bounded geometric repair estimates with distinct visible
instances; retain repair-family alternatives at root and below. Headroom and
covered-notch capacity participate alongside competing regional demands.
Estimates are explicitly unverified, including any omitted intervening placement.

Depth stays **three actual locks**, width 12, with shared ceilings of 60,000
movement expansions / 600 lock-path attempts / 120,000 geometric checks. Repair
probes consume that same budget. Actual movement/hold/queue/spawn/spin and
endpoint verification remain separate from ranking. No rolling history, longer
horizon, Right endpoint relaxation, simpler-route optimization or performance
tuning was selected. The adapter/deadline is unchanged.

Hypotheses, development bounds, four new test heaps and 24 seeds were frozen
before product edits. The initial implementation and its results are retained.
One predeclared causal revision changed repair-assessment allocation (an
unfillable early geometry had consumed a family's samples) and added headroom
before notch-count tie-breaking. The algorithm was then frozen before examining
the new paired-trial distribution. The twelve older seeds and replay positions
were already seen development evidence.

## Complete replay denominator

All **381 p10–390 snapshots** use the same pinned rules/inputs and budgets.
Protocol A supplies no future and both versions abstain **381/381**. Protocol B
assumes normal spawn and empty hold and supplies the next recorded lock kinds
as a **synthetic hindsight preview**. The recording does not recover actual
player pose, hold, draw order or preview. These are independent snapshot queries,
not a 381-lock coached replay or player-prediction evaluation.

| Protocol B | Corrected baseline | Live-frontier candidate |
| --- | ---: | ---: |
| Targets | 259 | 285 |
| Abstentions | 122 | 96 |
| Exact recorded first placement | 117 | 94 |
| Other verified placement | 142 | 191 |
| Pose / lock / geometry budget stops | 47 / 39 / 33 | 59 / 12 / 22 |
| No suitable witness | 3 | 3 |
| Actual witness locks replayed | 777 | 855 |
| Separate hypothetical probe locks | 316 | 357 |
| Observed replay failures | 0 | 0 |

**26 gains, zero lost targets:** p23,32,50,75,108,109,124,173,177,187,211,233,242,
244,250,304,305,312,313,325,329,344,347,363,364,385. No lost case was removed or
averaged away. All 381 recorded placements also replay successfully. Exact
agreement **declines**; neither matching the recording nor choosing a different
legal move establishes strategic superiority.

Unhinted p23 and p177 now find complete witnesses. Payable roofs at p199/p338
survive pruning and are selected without source hints. At p199 the chosen route
can clear with I before S pays the translated roof debt; repair order is not
fixed. The named longer-horizon/endpoint opportunities remain limitations:
p239 still abstains at the fixed three-lock search; no wider endpoint language
was introduced to improve the count.

## New paired continued-play panel

Four new test-only established heaps (scoring, construction, filler and
cross-region allocation), six predeclared seeds each (`900001..900024`), normal
generator, no hidden suffix supplied, first-abstention stop, 56-lock cap and no
fallback/filtering. These are not natural openings, independently annotated
optimal moves or a random-population/player-learning experiment. Every issued
three-lock witness was replayed separately as well as executing its first move
in the live closed loop.

| Measure, all 24 trials | Baseline | Candidate |
| --- | ---: | ---: |
| Total actual rolling locks | 118 | 211 |
| Median locks | 3.5 | 6 |
| Lower quartile locks | 0 | 0 |
| Doubles / quads | 8 / 0 | 16 / 1 |
| Trials reaching 56 | 0 | 0 |

Paired continuation: **12 gains, five losses, seven ties**; median paired
change +0.5 locks, lower-quartile paired change 0 (linear-interpolated quantiles).
Complete per-trial locks, in ascending seed order within each six-seed group:

| Start | Baseline | Candidate |
| --- | --- | --- |
| Scoring | 2,6,7,2,11,7 | 29,15,17,5,8,18 |
| Construction | 6,11,12,7,0,4 | 5,10,11,19,18,5 |
| Filler | 0,0,18,13,9,3 | 1,0,19,19,6,6 |
| Allocation | 0,0,0,0,0,0 | 0,0,0,0,0,0 |

The five regressions are **900005: 11→8; 900007: 6→5; 900008: 11→10;
900009: 12→11; 900017: 9→6**. All six allocation starts immediately exhaust a
budget in both versions: no success on that subgroup, and no impossibility
claim. Candidate seed900006 stops at 18 with `no-established-right-stack`,
900009 at 11 with `no-suitable-witness`; the others stop at work limits.
The unchanged zero lower quartile and universal pre-cap stops remain substantial
limits, despite the median/total improvement.

The twelve **seen** trials improve from 109 to 167 locks and eleven to twelve
doubles (zero quads). Their candidate lengths are `4,11,13,12` for seeds1–4 and
`15,18,6,25,5,22,11,25` for seeds2000–2007. Losses remain at seed2 (13→11),
2004 (6→5), 2006 (13→11) and 2007 (26→25). None reaches the cap. These are
regressions/development comparisons, not another held-out result.

## Continuity and browser limits

Within-query proof is not rolling proof continuity. A fresh snapshot can treat
an earlier newly built `##.` as its initial inherited cut, or decline to search
a transient state admitted inside an earlier witness. No history was added to
silently change that contract. The earlier seed2007 intervention that forced a
promised repair and shortened play **26→19 locks** remains negative evidence;
blind plan commitment is not justified by paying one obligation.

The existing full-browser comparison is still a disclosed regression:
**199/381 targets at original `0f7ca198`, versus 179/381 at corrected `efe1070`**,
with 200 deadline stops in the latter. Offline gains do not erase it. Browser
work is a bounded residual check, not a performance optimization or a repeat
full-corpus timing study. Current-source browser results will be recorded before
publication; no browser improvement is claimed here yet.

Local regressions cover unhinted construction recovery, roof repayment before
or after clears, live versus historical frontier state, below-root diversity,
distinct/late resource negatives, charged estimator work, stable targets and
cancellation. See [TESTING.md](../TESTING.md#st-lab-behavioral-coverage).
Full inputs, both development generations, per-case/per-trial results, failures,
replay checks and source hashes are retained in the task evidence. Skipped or
absent GitHub CI is **not green CI**. Captain playtesting remains the acceptance
step; this is not yet dependable sustained coaching.
