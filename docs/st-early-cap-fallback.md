# Checked cap fallback before optional preparation

Development change, 2026-10-24. This is not an opening handoff rule, future T-arrival certificate, or sustainability guarantee.

## Motivation and scope

The saved development seed 503552020 before lock 24 had an executable held-Z cap, but a timed maintenance decision exhausted its budget before ordinary frontier expansion. Root enumeration and optional visible-resource preparation had already consumed substantial work. The recorded failure remains an adverse result; subsequent successful root calls do not replace it.

Two changes are kept distinct:

1. Cleanup prerequisite analysis skips emitted non-I events before calling the full structural transition. Only an actual I lock entirely in the current non-null preparation column can receive the existing `quad-preparation` allocation. The already computed current geometry supplies that column; the full transition still decides scoring precedence and the post-placement condition. This tests the emitted piece, not active/hold/preview membership, so an I exposed by empty HOLD is retained. No movement-node accounting, rank, or cycle policy changes.
2. After complete root enumeration, the planner may certify one exact nonclearing right-Z cap before optional multi-lock work. It uses the normal node assessment, settled T-entry qualification, canonical/phase/cycle checks, cavity and Center reservations, headroom/regional support, and actual access-prefix check. It stores a backup rather than returning early or giving caps a ranking bonus.

The backup is not discovered with an incoming commitment or construction proof. It is used only if no checked best remains and neither a saved commitment nor cleanup commitment takes precedence. It cannot spend a reserved T or cap before an actually executable competing cleanup I. A later valid longer route remains in control. A best path rejected solely by the final height/support check is not rescued by this narrow null-best fallback.

All work shares the existing deadline and node allowance. Incomplete qualification/access is unknown, not a certificate. A returned one-lock backup does not imply a completed search layer: `completeDepth` can remain zero. The ordinary final replay/access wrapper still checks it. Hypothetical T-entry access is not a claim that a T arrives or a full double is playable with the public supply.

## Attribution and verification

Raw `metrics.earlyCapFallback` reports attempted cap candidates, a verified backup (0/1), whether the backup was actually selected, and its charged movement/access nodes. These counters are not total CPU cost or causal importance. Selected advice is still distinct from a move followed in a simulation.

Five fixed-node maintenance roots, including the exact saved failure and actual I-cleanup controls, produced identical full advice before/after the non-I prerequisite change after removing only elapsed time. I-transition counts and search nodes were unchanged for the first type-only optimization. A follow-on exact-column prerequisite also preserves all five full fixed-node outputs and search counts; it skips I placements which cannot meet the literal preparation-column condition (the cleanup-I control drops from 704 to 352 total I-transition calls). The exact failure root reduced total transition calls from 4,324 to 2,177. A separate four-call 1500 ms ABBA probe returned the same cap and completed depth two in both versions; overlapping work counts do not establish a calibrated throughput gain.

The fallback regression uses the original public observation and validated history. At 1,234 nodes, the prerequisite-only planner abstains while the backup version returns the checked cap after 209 qualification nodes, with `completeDepth=0`. At 1,034 nodes, qualification is incomplete and both abstain. At 45,000 nodes, both return the same three-lock route using 33,172 nodes; the backup is verified but not selected. Tests also cover moved active pose, disabled HOLD, empty-HOLD I priority, invalid phase and incoming commitment exclusions.

The temporary production configuration remains 1500 ms / 45,000 nodes with a separate 2500 ms worker watchdog. The original 750 ms objective remains performance debt. Certifying a backup earlier changes budget allocation and requires matched timed controls; semantic equivalence of the type prerequisite alone does not prove equivalence or gameplay improvement for the combined fallback.

## Matched development result and accounting follow-up

The first frozen combined candidate `e3b20fe` was compared with published-equivalent local `075c4c7` on four exact saved streams at the same temporary 1500 ms / 45,000-node settings. All eight arms were independently replayed, 794 locks total. Each pair had identical actual event sequences and endpoints: seeds 503552020, 502609459, 502400001 and 503237833 stopped after 68, 125, 98 and 106 locks respectively. All handed off; only 503552020 missed the two-quad/intervening-TSD milestone. All ultimately abstained. None ended from budget exhaustion in this cohort; the low-Center unsupported stop and later structural debt remain separate problems.

Across 339 candidate decisions reporting backup metrics, 21 backups were verified and none selected. Their 3,729 charged access nodes are not CPU time. This is non-regression evidence on selected development controls, not a demonstrated gameplay improvement or proof that the fallback is unnecessary.

The later exact-column prerequisite and opt-in maintenance telemetry are separate changes, not retroactive explanations of that trial. Maintenance telemetry records actual cleanup short-circuit partitions, backup scan/selection, visible-cycle preparation and inclusive family boundary times. It does not change ranking or fabricate counters for earlier unsupported/retained-construction returns that never reach the instrumented search.

Review also found two remaining accounting defects: choosing a cap-deferral macro discarded earlier ordinary-search work from reported nodes, and rejected/unknown final access checks omitted their visited nodes. Both are charged now, including the outer wrapper's remaining allowance. A pure metrics-helper test covers the macro bookkeeping without forcing a cap-deferral winner; actual cap certificates and ordinary comparisons remain separately tested. Failed final validation clears selected-backup telemetry as well as the target.
