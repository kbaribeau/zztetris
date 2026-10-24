# ST milestone evaluation

This is the historical pre-regional baseline. See [the experimental regional revision](st-regional-feedback.md) for the latest failed sustainability comparison; the baseline results below are deliberately retained.

Measured 2026-10-22, Node v24.20.0, Linux cloud checkout. Reproduce with `node scripts/evaluate-st.cjs --extended`. This report records both current bounded successes and remaining strategic limitations.

The [compact recorded results and input traces](st-evaluation-results.json) preserve the frozen run in the repository, rather than relying on temporary execution files.

## Method

Depth 3, beam width 8, 45,000 total movement/access nodes, no deadline for deterministic runs. Closed-loop evaluation executes only the first advised witness, reveals enough private future draws to restore six preview pieces, consumes bag evidence only for those new reveals, and replans. Every executed witness is independently replayed and its state validated. Fixture references, IDs, historical answers and private future never enter the planner. Streams are synthetic legal seven-bag reconstructions, not claims about historical player draws.

Rank order: survival, regional support, checked TSD, structural estimate, execution burden, cleared lines. Geometric slot count alone earns no reward. Lazy exact hypothetical T-entry qualification permits one slot reward, labels access evidence, and leaves actual T arrival unresolved. Entry probes share the node/time budget; unknown does not mean impossible. The stable support predicate accepts a two-high left base with the established center/channel conditions. Input maintenance scope is slightly broader: a temporary channel imbalance is admitted while the channel remains below the higher left/center region, but recommended endpoints must regain strict support. This avoids rejecting our own recoverable intermediate clears; empty, flat generic and left-hand cases remain excluded.

The strict cycle metric means nonclear → later full TSD → subsequent nonclear with supported structure and open channel. It is a minimum rebuild demonstration, not proof of perpetual ST maintenance or a promise of a next TSD.

## One-shot results

All 23 supported cases yield executable advice; the left-side diagnostic correctly declines outside the right-side profile. That is legality coverage, not an optimality rate. Multiple valid answers are accepted; no expected-target equality is used.

| Case | Split | Executable | First spin/lines | Checked TSD lock | ms |
| --- | --- | --- | --- | --- | --- |
| o-filler | dev | yes | none/0 | none | 705 |
| center-j | dev | yes | full/2 | 1 | 516 |
| empty-hold | dev | yes | full/2 | 1 | 568 |
| left-l | dev | yes | full/2 | 1 | 629 |
| held-t-double | dev | yes | full/2 | 1 | 573 |
| cap-rebuild | dev | yes | none/0 | none | 593 |
| o-before-double | dev | yes | none/0 | 2 | 565 |
| direct-double | dev | yes | none/0 | 2 | 536 |
| s-after-double | dev | yes | none/0 | none | 594 |
| i-via-hold | dev | yes | none/0 | none | 653 |
| higher-cap | held-out | yes | none/0 | 3 | 595 |
| higher-double | held-out | yes | none/1 | 2 | 549 |
| offset-double | held-out | yes | full/2 | 1 | 494 |
| o-rebuild | held-out | yes | none/0 | none | 448 |
| after-quad | held-out | yes | none/0 | none | 609 |
| late-held-double | held-out | yes | none/1 | 2 | 533 |
| unknown-bag-double | held-out | yes | full/2 | 1 | 531 |
| actual-pose-double | held-out | yes | none/0 | 2 | 547 |
| marathon-preparation | held-out | yes | none/1 | 2 | 707 |
| marathon-double | held-out | yes | full/2 | 1 | 569 |
| marathon-rebuild | held-out | yes | none/1 | none | 548 |
| marathon-later-double | held-out | yes | full/2 | 1 | 523 |
| left-side-diagnostic | diagnostic | unsupported-position | –/– | none | 0 |
| deviated-o-recovery | dev | yes | none/0 | none | 561 |

Sequential one-shot timing across all 24 cases: median 565 ms, p95 705 ms, maximum 707 ms, including the near-zero diagnostic. These are measured cloud results, not browser latency guarantees.

## Twelve-lock closed loops

| Start | Policy | Locks | TSDs | Ordered cycle | Stop |
| --- | --- | --- | --- | --- | --- |
| o-before-double | planner | 12 | 2 | yes | lock-limit |
| o-before-double | hard-drop baseline | 5 | 0 | no | top-out |
| o-filler | planner | 12 | 1 | yes | lock-limit |
| o-filler | hard-drop baseline | 8 | 0 | no | top-out |
| marathon-preparation | planner | 12 | 1 | no | lock-limit |
| marathon-preparation | hard-drop baseline | 7 | 0 | no | top-out |
| marathon-rebuild | planner | 12 | 1 | no | lock-limit |
| marathon-rebuild | hard-drop baseline | 8 | 0 | no | top-out |
| higher-cap | planner | 12 | 2 | yes | lock-limit |

Every tested planner start now scores at least one TSD by lock 12; three of five complete the strict ordered cycle by then. The independent Marathon starts complete that cycle later in the extended runs. These starts are a small, adaptively investigated sample, not an unbiased general success-rate estimate. Hard-drop-only is intentionally weak and not a competitive strategy baseline.

The development demo now begins O nonclear, I nonclear, T full double, J nonclear rebuild. The held-out higher-cap demo begins Z nonclear, I single, T full double, L nonclear rebuild. Both complete the strict cycle in four locks and a second TSD by lock 8.

## Production deadline

With the shipped 750 ms deadline, the demo completed 12 locks, 2 TSDs and the ordered cycle. Requests measured 469–608 ms; deadline exhaustion occurred on 0/12 requests. Deadline checks bound search work, not all finalization/transport overhead; earlier completed prefixes may be returned. Deadline exhaustion is not a proof of impossibility.

## Diagnostic ablations

Three-lock default-demo comparisons, same deterministic depth/width/node budget:
- No-hold: disables hold branches: 1 TSD; ordered cycle complete; O:0/none, T:2/full, S:0/none.
- Bag-unaware: removes bag evidence from every observation: 1 TSD; ordered cycle not yet complete; O:0/none, I:0/none, T:2/full.

This does not establish a benefit from bag inference or hold. Six visible pieces already exceed the three-lock search horizon, so beyond-preview deductions rarely affect these comparisons. The bag-unaware result reaches the TSD at lock 3 rather than completing a rebuild within this short bound.

## Extended results and remaining limits

- o-filler: 36 locks, 2 TSDs, ordered cycle achieved, stop: lock-limit; final maximum height 6.
- marathon-rebuild: 36 locks, 2 TSDs, ordered cycle achieved, stop: lock-limit; final maximum height 5.
- marathon-preparation: 36 locks, 3 TSDs, ordered cycle achieved, stop: lock-limit; final maximum height 8.

All three extended runs remain in play through 36 locks. A fresh plan after that horizon is also executable for every case and reaches strict regional support; the measurement window does not conceal an immediate unsupported-state cliff. This does not prove indefinite sustainability.

The final center/left-region imbalance penalty addresses the observed runaway center stack; it is a heuristic penalty beyond four rows of discrepancy, not a legality gate. The broader recovery input accepts a one-high left base only with a substantial remaining center and four nonempty base columns. Recommended endpoints still must regain strict stable support.

Earlier failure modes and measurements are retained below as historical evidence. The final balanced run improves Marathon rebuild from one TSD with height 16 to two with height 5, and Marathon preparation from two TSDs with height 19 to three with height 8. o-filler scores fewer TSDs than one earlier variant, but ends at height 6 and can continue instead of hitting a scope boundary. Tradeoffs are not hidden.

## Regression and validation boundary

Five closed-loop regression tests cover reveal accounting, both four-lock ordered cycles, and preservation of an actually executable hypothetical TSD through the first four o-filler decisions, plus replay of the 29-lock provenance trace followed by a fresh verified recovery. They pass in roughly 9 seconds, within the 15-second per-file limit. Separate rules tests compare the optimized entry query with full enumeration and reject the historical phantom cavity.

Browser visual playtesting, learner comprehension and actual human learning outcomes are separate acceptance evidence. This report does not claim they have occurred.

## Search and execution diagnostics

| Case | Verified locks | Complete depth | Roots / expanded roots | Access nodes | Total nodes | Budget exhausted |
| --- | --- | --- | --- | --- | --- | --- |
| o-filler | 3 | 3 | 73 / 8 | 9353 | 26822 | no |
| center-j | 3 | 3 | 83 / 8 | 7931 | 23114 | no |
| empty-hold | 3 | 3 | 84 / 8 | 11729 | 26068 | no |
| left-l | 3 | 3 | 87 / 8 | 21268 | 36270 | no |
| held-t-double | 3 | 3 | 87 / 8 | 12858 | 26768 | no |
| cap-rebuild | 3 | 3 | 80 / 8 | 24890 | 38832 | no |
| o-before-double | 3 | 3 | 74 / 8 | 6397 | 23207 | no |
| direct-double | 3 | 3 | 83 / 8 | 13518 | 28276 | no |
| s-after-double | 3 | 3 | 76 / 8 | 24195 | 38245 | no |
| i-via-hold | 2 | 2 | 80 / 8 | 30441 | 45000 | yes |
| higher-cap | 3 | 3 | 85 / 8 | 15471 | 28597 | no |
| higher-double | 3 | 3 | 82 / 8 | 16070 | 29216 | no |
| offset-double | 3 | 3 | 83 / 8 | 3940 | 17434 | no |
| o-rebuild | 3 | 3 | 74 / 8 | 1626 | 14506 | no |
| after-quad | 3 | 3 | 76 / 8 | 19879 | 35955 | no |
| late-held-double | 3 | 3 | 83 / 8 | 12648 | 26648 | no |
| unknown-bag-double | 3 | 3 | 87 / 8 | 12858 | 26768 | no |
| actual-pose-double | 3 | 3 | 83 / 8 | 13518 | 28276 | no |
| marathon-preparation | 3 | 3 | 76 / 8 | 8435 | 27550 | no |
| marathon-double | 3 | 3 | 82 / 8 | 9759 | 25696 | no |
| marathon-rebuild | 3 | 3 | 76 / 8 | 9075 | 24802 | no |
| marathon-later-double | 3 | 3 | 87 / 8 | 12787 | 23989 | no |
| deviated-o-recovery | 3 | 3 | 73 / 8 | 9247 | 25750 | no |

The unsupported diagnostic performs no search. i-via-hold exhausts the shared node budget and returns its completed two-lock prefix rather than asserting impossibility. All other supported one-shot cases complete the three-lock depth.

Witness failures: 0/209 executed planner recommendations; additionally 28 baseline locks and 9 next-horizon continuation locks replayed without failure. The evaluator is fail-fast, so an invalid witness aborts rather than silently disappearing from the sample.

Target stability and stale-result rejection are covered by deterministic controller/revalidation tests. Real-browser target churn, paint latency and human decision time remain unmeasured.

## Historical failure evidence

The actual pre-fix legal move sequences are preserved in [st-historical-failures.json](st-historical-failures.json), with replay regression coverage. These are historical evidence, not inputs or answer templates for the planner.

## Extended diagnostic: geometry-only reward failure

Extending the three unsuccessful starts revealed an actual strategic failure, not simply waiting longer for a T. On the pre-fix geometry-only heuristic, o-filler ran 36 locks with no TSD; Marathon-preparation stopped with no supported continuation after 31 locks and only its initial TSD; Marathon-rebuild stopped after 29 locks with no TSD. Multiple T arrivals were played without clearing while stacks rose to height 19.

Exhaustive hypothetical fresh-spawn T probes isolate the defect. In o-filler, after lock 3 the one geometric slot supports an executable full TSD. Lock 4 swaps I for Z and creates a second geometric slot, but the resulting board supports zero executable TSDs. Subsequent T arrivals cannot use either cavity. Marathon-rebuild similarly reports two geometric slots after lock 3 and three after lock 7, yet exhaustive T placement enumeration finds no executable full TSD at either point. These are inaccessible geometric cavities being rewarded as if useful, so regional support and open column eight are insufficient measures of healthy maintenance.

The short-loop results above remain valid observed prefixes, but do not excuse this defect. Any subsequent planner correction needs fresh evaluation; this diagnosis is retained as failure evidence rather than silently removed. The evaluator now records active piece, hold and visible queue before each lock, plus geometric slots, cavity counts and structural support before/after, allowing this failure to be reproduced without hidden-future access.

## Exact-entry repair: extended observations

After introducing lazy exact T-entry qualification, the original phantom-slot defect no longer occurs in the tested filler sequence. All first four o-filler moves retain an executable hypothetical TSD. That case now scores a full TSD at lock 8; over an extended run it scores three TSDs in 33 locks and then exits the established-stack scope after clearing down to heights `[0,0,1,1,3,3,0,0,1,1]`. This is a low-stack scope transition, not top-out or inaccessible-cavity farming.

Marathon-rebuild now scores a full TSD at lock 11 and achieves the ordered cycle shortly afterward. Marathon-preparation scores two TSDs. Their extended runs initially stop at 17 and 19 locks on the same level-left-base board, heights `[2,2,2,2,6,8,8,0,1,2]`, with zero left sealed cells and an open scoring channel. This exposes a separate scope-threshold issue: the original support predicate requires a left height of at least three, although this remaining two-high base is structurally recoverable. These observations are retained to distinguish the repaired entry defect from the scope-boundary issue; any threshold correction requires another evaluation.
