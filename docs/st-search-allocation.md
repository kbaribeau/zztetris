# Search-allocation follow-up

Branch-only follow-up to the delivered candidate
`0f7ca19898fd9d621125d5684d22f8e064ea01be`. No merge, deployment or replacement
acceptance. The captain authorized calculation-local reuse, initial fair root
allocation, deterministic promising-search preference with periodic revisits,
and unchanged separation of heuristic ranking from verified acceptance.

## Implementation

[ST-LAB.md](../ST-LAB.md#implementation-and-work-limits) specifies the scheduler,
cache keys, bounds and diagnostics. The external `create` / `start` / `advise`
interface is unchanged. The browser adapter is unchanged too: approximately
4-ms slices, at most 16,384 yielded units per render, 750-ms elapsed deadline,
snapshot cancellation and no provisional targets.

- Movement traversal resumes across placement requests on the **same heap,
  kind, pose and last action**. The first BFS path to each grounded cell set is
  indexed; a non-mini T-spin path is a separate goal. No changed rule tables,
  teleports, assumed rotations or skipped intervening spawns.
- Geometry/clear facts are reusable for the same heap and kind. Resource-dependent
  spawn and translated-debt checks are recalculated. Equal cells do not merge
  different held instances, hold preludes or ordered remaining previews.
- Each retained root initially gets up to 512 charged units. Remaining turns use
  a deterministic 3:1 promising/revisit schedule. Depth and best observed rank
  are only priority signals; even failed subtrees can look promising. Deeper
  searches remain width-limited DFS. This is not exhaustive or optimal search.
- Caches are bounded, LRU, and calculation-local; no persistent game history or
  hidden bag inference. Evicted work counts again if recomputed. Each real pose
  expansion, lock-path attempt, geometry enumeration, resource-dependent
  placement check and virtual terminal query is charged to the shared limits.

The numerical ceilings remain **60,000 movement expansions, 600 lock-path
attempts, 120,000 geometric checks, width 12, depth three**. The terminal
predicate and unpaid-construction rules are unchanged. A high rank, partial
BFS, reachable first lock or hypothetical future piece cannot authorize advice.
Only a full three-lock witness can be displayed. A verified fallback may be
retained while revalidating the old preferred target; it remains a complete
witness even if the extra preference search exhausts its budget.

## Frozen replay comparison — not player prediction accuracy

We recovered the original comparison's hash-checked evidence capsule and reused
its `run.cjs`, `verify.cjs`, input cases, rule tables, recorded-placement paths
and source annotations. The pinned baseline source remains unchanged. Re-running
both original input protocols reproduced **all 762 baseline outputs exactly**,
excluding elapsed time. Original root traces were separately parity-checked by
that experiment; they supply the baseline root-attempt counts below.

Window: **381 positions, source p10–390**, mirrored to right scoring. Each case
starts from its recorded preboard and an assumed normal active spawn, empty hold
and no prior preferred target. These are teacher-forced decisions, **not a
closed-loop replay**. Protocol B uses the next up-to-six **recorded lock kinds**
as a **synthetic hindsight preview**. The recording does not supply draw order,
hold, actual active pose or visible preview. No p391+ piece repairs the tail.
Protocol A supplies no future pieces and both engines abstain on all 381 cases.

| Protocol B, same work ceilings | Unchanged baseline | Revised |
| --- | ---: | ---: |
| Recommendations / 381 | 244 (64.0%) | 262 (68.8%) |
| Exact recorded first placement | 111 | 117 |
| Other executable target | 133 | 145 |
| Abstentions | 137 | 119 |
| Pose / lock / geometry budget stops | 124 / 0 / 10 | 48 / 36 / 32 |
| Insufficient-prefix tail cases | 3 | 3 |
| Actual witness locks replayed | 732 | 786 |
| Separate hypothetical probe locks replayed | 301 | 319 |
| Observed execution failures | 0 | 0 |

**Twenty prior abstentions recovered, two prior targets lost (p32 and p364).**
This is a coverage tradeoff, not universal superiority. All 381 recorded source
placements also replayed successfully in both actual game-engine checks. Exact
agreement is a secondary diagnostic, not optimality or learning benefit.

The baseline's 134 budget failures tried only one to four roots: 47 tried one,
56 two, 26 three, five four. All **116 revised work-budget failures started all
12 retained roots**. All 380 positions with any retained roots started 12; p390
has none because the next spawn is unknown. Starting a root does not mean
exhaustively searching its descendants. In particular, p23 and p177 still
abstain despite their previously demonstrated forced-first alternatives; their
branches now receive work but not enough to establish a witness. p34 now returns
a different fully verified route without forcing or imitating the source move.

The revised search uses less mean movement work (26,137 → 21,303), but more
lock-path attempts (99 → 200) and geometric checks (32,618 → 45,844). Reuse changes
which limit binds; it does not make the units equivalent CPU-time measures.
Fresh-child Node measurements in paired concurrent batches were median/p95/max
**27.0/135.7/162.1 ms baseline**, **25.9/148.1/168.6 ms revised**. There is no
uniform speedup claim, and these are not browser-deadline measurements.

## Real browser: coverage gain is small and median latency is worse

Both unchanged browser adapters also ran all **381 protocol-B positions**,
sequentially in the same isolated Chrome session at **1440×1100**, with real
frame scheduling and the unchanged elapsed deadline. Each successful decision's
three locks then executed through the actual game controls with exact boards,
spin/mini and clears. No execution failure occurred.

| Browser result | Baseline | Revised |
| --- | ---: | ---: |
| Recommendations | 212 | 215 |
| Exact source placement | 95 | 98 |
| Abstentions | 169 | 166 |
| Elapsed-deadline abstentions | 164 | 164 |
| Decision elapsed median / p95 / max (ms) | 344 / 802 / 821 | 523 / 799 / 817 |
| Decision CPU median / p95 / max (ms) | 38 / 98 / 114 | 55 / 96 / 129 |
| Largest observed slice (ms) | 13.2 | 5.6 |
| Largest observed animation-frame interval (ms) | 83.4 | 116.7 |

Timeouts are observed at the next scheduled frame, so returns can exceed 750 ms.
This single paired sample is **not** evidence of a uniform responsiveness gain,
strict 4-ms slices, smooth 60-fps rendering or physical-mobile performance.
Offline gains do not all survive the browser deadline. Earlier-root initial
sharing adds work before some easy answers; this is a real tradeoff for playtest.

The four documented examples still produced targets at desktop width. At
emulated **390×844**, the Center example completed in 122 ms in a fresh page;
its target and explanation remained legible, movement retained the freshly
validated target, and toggling did not shift board/HOLD/NEXT rectangles. A pending
edited-board search cancelled on hide, stayed hidden after 900 ms, and restart
returned to empty-board abstention. Desktop and narrow screenshots were inspected
and retained. The viewport change reloaded the page; the test helper was
reinstalled before capturing the narrow state.

## Continued play and regressions

The same twelve fixed-seed, 56-lock-cap established-stack trials now reach
**103 locks, eleven doubles, zero quads** versus the baseline's **55/eight/zero**.
Seeds 1–4 reach `4,13,5,7`; 2000–2007 reach `7,9,6,3,6,10,7,26`. Eleven runs stop
at a work budget; seed 2007 stops with no suitable witness. Every run still
abstains before its cap. No fallback or seed filtering. This does **not** prove
sustained multi-bag coaching. Baseline and follow-up measurements are retained
separately rather than rewriting the earlier limitations.

`test/st-allocation.test.cjs` exercises initial allocation and revisits on three
observed starvation cases, p34's new full witness (fails against the unchanged
baseline), bounded caches, resource-distinct roots, interleaved calculations,
abandonment, fresh-calculation determinism, exact charged/yielded work and
actual-pose ROT versus SD scoring. Existing obligation, path/spawn, short-prefix,
stable-target, cancellation and deadline tests remain unchanged and passing.

For playtesting use the [four established-stack examples](st-playtest.md), then
try your own inputs. Original replay inputs and full before/after results,
actual-engine replay logs, browser measurements and screenshots are retained
with the task's delivery evidence. GitHub CI is absent: local validation is the
accepted evidence, never an empty checks list described as green.
