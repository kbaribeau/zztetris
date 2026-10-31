# ST research: process and evidence contract

This defines **how to investigate and verify**, not the result of any particular experiment. Use it with the repository's collaborative-review or controlled-experiment skill. Current work assignments, personal execution preferences, deadlines, authority, artifact paths and experiment outcomes are not repository rules.

## Authoritative mechanics

- [ST architecture and session format](../ST-LAB.md), [rules contract](st-rules-contract.md), and [acceptance map](st-milestone-acceptance.md).
- [Test execution and verification limits](../TESTING.md): `.nvmrc`, `package.json`, the unfiltered delivery command, manifest semantics and browser limitations.
- [Simulation contract](st-simulation.md): commands, production budgets, stop reasons, source hashing, replay versus rerun, and paired comparisons. Read the current configuration rather than copying a historical profile.
- [Community wording and source links](st-community-advice.md), [source corpus provenance](st-fixture-corpus.md), and [regional mino accounting](st-regional-mino-ledger.md).

Use repository tools where they already implement these contracts. Inspect available interfaces before invoking them; no particular assistant connector or assumed CLI credential is required by this process.

## Evidence and information boundaries

Keep four claims separate:

1. **Community criterion:** a source-backed strategic concept, cited to the relevant source/section.
2. **Operational interpretation:** a testable engineering threshold or conservative certificate, with its rationale and limits. A numeric bound used by this engine is not automatically a rule stated by Shocky's guide.
3. **Observed result:** what actual recorded actions, tests or measurements establish for identified inputs and sources.
4. **Hypothesis:** an explanation or proposed change not yet established by those observations.

The worker may receive only the supported public observation and validated public coaching context. Seed, generator state, private evaluator input and reference answers remain evaluator-only. Hidden future pieces remain outside the coach: evaluator-only during evaluation, or controller-only in the supported private practice wrapper. Revealed pieces enter public history at the actual draw boundary, never retroactively. A full replay can audit earlier decisions, but later facts cannot authorize a move at its earlier decision boundary.

Track geometry, actual reachability, piece-instance supply, HOLD/draw ordering, original-bag accounting, resource permission and bounded proof completion separately. Unknown/truncated history remains unknown. A completed finite repair is not a community Reset, indefinite sustainability, or a guarantee that a bounded planner will find the route.

## Source control versus local evidence

**Commit-able definitions:** operating-mode skills, this process, maintained schemas/helpers, and deliberately minimized regression fixtures needed by executable tests. Fixtures should have an independently justified oracle and disclosed synthetic context. They must not become a seed/board answer lookup consulted by the coach.

**Do not commit or push generated evidence:** raw logs/TAP/manifests, run protocols and result summaries, traces and private input streams, Fumens and coaching-session exports, screenshots, ad hoc experiment scripts, validation receipts, source bundles and archives. Keep these in a local evidence directory **outside every Git worktree**. Local evidence may be temporary and eventually lost; this workflow does not promise permanent retention or authorize uploading it elsewhere.

Use a fresh subdirectory for each attempt; never overwrite a losing/crashed run with a later success. Record where the evidence is in a local index. Before staging, inspect exact paths and diff: a directory being ignored does not make an accidental forced add acceptable. Existing versioned historical evidence is not permission to add new raw evidence; do not remove unrelated historical files as part of an experiment.

Do not copy the whole conversation into a skill. Keep active priorities and one-time permissions in the current task, procedural knowledge here, and observations in local evidence.

## Local experiment index

The index should let another agent reconstruct the case without conversation history. Use actual verified paths; placeholders below describe fields, not a preapproved run:

| Record | Required content |
| --- | --- |
| Scope | Question/hypothesis, authorized actions, allowed sources, stopping condition and any current deadline. |
| Sources | Baseline/candidate commit and tree IDs, dirty status, changed-file hashes, dependency lock hash, source snapshot or recoverable revision, and which files were frozen. |
| Protocol | Predeclared cohort/scenarios and selection reason, baseline/candidate order, pinned runtime, host/load, depth/width/nodes/time budgets, caps/watchdogs, execution model, metrics, controls, repeats and acceptance rules. |
| Inputs | Original initial states and private evaluator streams, hashes, origin/bag-history confidence and public/private separation. |
| Attempts | Every invocation and its source identity, start/end, exit/signal, completion status, stdout/stderr, partial traces and outcome paths—including abandoned variants and interruptions. |
| Reproduction | Exact commands with working directory/runtime, recorded-action replay receipts, summary reconciliation and display/session verification. |
| Decision | Measured comparisons, independent review, focused/full-suite receipts, browser result or blocker, accepted/rejected/inconclusive scope and unresolved questions. |
| Delivery | Local commit and clean-suite bindings when authorized; remote expected parent/result only if publication was separately authorized. |

Hashing demonstrates byte identity, not authenticity or correctness. Keep original records alongside derived summaries. Distinguish a summary inspected by a reviewer from a test the reviewer actually ran.

## Review packet and counterfactuals

1. Identify the exact pre-lock public observation and connected resource/pattern/opening history. Use the production `st-session.js` contract described in `ST-LAB.md`; a plain snapshot cannot reconstruct omitted history.
2. Encode a compact public session without pruning valid history or importing derived permission flags as truth. The public session format has limits and no hidden future/Undo tape. For finite private practice, the separate [private practice wrapper](../ST-LAB.md#private-practice-imports) carries a controller-only tail; it does not change the public session or coach information boundary. If the available history cannot fit or validate, report the limitation; do not claim a full-history round trip.
3. Use the [visual packet reference](../.agents/skills/st-collaborative-review/references/review-packet.md) for the player-facing README, case index, SVG sources and PNG overviews. These generated artifacts stay outside Git with the sessions and evidence. Supply an English-commented Fumen with explicit before/after labels, active/HOLD/preview information as useful, event/clear annotations, and the mapping between one-based page numbers and actual locks. State whether a page depicts a recorded board or an operation to apply.
4. Decode and compare every exported field/operation and relevant comment against the recorded states. Parse/import the session through production validation and compare the resulting public position and coaching context. Report discarded stale advice and compatibility warnings. A text-only validation is not proof that the live browser imported or painted it.
5. Replay proposed alternatives with the real rules and reveal schedule from the identical boundary. When comparing orderings, verify both actual sequences and resource identity/accounting; do not infer legality from matching final silhouettes.
6. Stop the counterfactual at its declared scope. A visible legal route, policy selection under production limits and longer-run outcomes are different experiments. Never feed the known future of a saved trace into the coach to force the desired answer.

## Controlled execution

Use separate worktrees for independently changing candidates; inspect status and preserve unrelated work before creating or switching branches. Do not reset, clean, stash or cherry-pick another agent's changes without agreement. Keep a small local ownership record for shared timed CPU use.

Predeclare one defensible hypothesis and acceptance gate before the quality cohort. Freeze the candidate after focused checks. Compare revisions on identical actual inputs, caps, budgets, runtime and execution protocol; verify input and source hashes, not just seed labels. Keep empty/stable cohorts distinct. Run timed work serially without concurrent planners, suites or performance experiments. Coordinate potentially expensive replay/session validation with the timed-work owner too: no new policy search does not mean no CPU load. Changes during a run invalidate its revision binding.

Production search is wall-clock-sensitive, including nested proofs. Fixed seeds do not imply deterministic policy. Record repetitions and their timing sensitivity; do not substitute a fake outer clock or a larger budget and call it the same production experiment. Deterministic unit-test clocks are a separate test seam and must not weaken the production contract.

Store outputs outside the checkout with the supported flags:

```sh
# Resolve these absolute paths locally before use; EVIDENCE_ROOT is outside Git.
ZZTETRIS_TEST_RESULTS_DIR="$EVIDENCE_ROOT/full-suite" npm test
npm run sim:st -- --preset quick --out "$EVIDENCE_ROOT/simulation"
npm run sim:st -- --replay "$EPISODE_DIR"
npm run sim:st -- --compare "$BASELINE_RUN" "$CANDIDATE_RUN"
```

These are interface examples, not an instruction to launch a workload or use the quick preset as an acceptance gate. Capture the real exit code when redirecting output; a pipeline must not hide a failed command. Preserve partial files when stopping; do not fabricate a complete manifest after interruption.

## Paired results and honest stops

Reconcile totals against actual lock/clear events. Report each declared pair, not just an aggregate or best run. At minimum include placements, lines, TSDs/quads, first scoring events, relevant resource/structure violations, stop reason and censoring; add latency/nodes/budget-hit metrics for a performance claim. Compare height/debt at a shared placement horizon when runs have different lengths. Keep safety, local geometry, runtime and longer-run strategy quality separate.

| Classification | What it establishes—and does not |
| --- | --- |
| Top-out | The actual rules state topped out; not a synonym for a missing recommendation. |
| Abstention | The planner returned no target. Retain its exact status/reason; this does not prove no legal or good move exists. |
| Unsupported | A contract/profile/history boundary was unsupported; do not call it geometric impossibility. |
| Unfinished proof / budget reached | The search did not complete the relevant certificate. Do not report a proof failure as a proof of absence. |
| Lock cap | A right-censored run reached its declared cap; not indefinite success. |
| Wall cap / interruption | Time-limited or interrupted evidence, with partial progress retained; not a successful cap or top-out. |
| Invalid witness / policy violation | A safety or policy failure, kept explicitly even if later metrics look favorable. |
| Crash / error / source change | Infrastructure or evidence failure, not an abstention or silently omitted pair. |

Use the simulator's exact stop fields alongside this interpretation. An episode may stop by abstention with an unsupported or unfinished-proof reason; do not invent a new simulator enum. Exit zero means the evaluation completed, not that strategy acceptance passed. Invalid or wall-censored pairs are not valid quality comparisons; preserve and investigate them without cherry-picking replacements.

Inspected/tuned seeds are development evidence. A repeat of the same seed can expose gross instability but is not a fresh holdout or independent generalization evidence. Many correlated locks do not become many independent samples. Report losses, unchanged controls, known baseline defects and remaining worst cases. A run may improve one metric yet still fail its predeclared acceptance gate.

Matched inputs do not establish a policy-clean baseline. If a later resource audit finds baseline defects, retain the observed raw delta but disclose the defects and reassess the safety/acceptance gate; do not certify the whole baseline route or silently treat its violation as permission for the candidate. A valid action replay and a favorable aggregate cannot erase an unproved permission at an earlier lock.

## Acceptance, review and publication

- Require focused behavioral regression coverage for the mechanism and negative/control cases. Assert observable outcomes with an independent oracle, not source-text matches or the implementation copied into its own expected result.
- Before proposing an engine change as accepted, run the full unfiltered suite and have an independent reviewer inspect the exact source diff and raw evidence. Do not give the reviewer only favorable summaries or the desired verdict. Address substantive findings and revalidate affected claims after changes.
- Keep full-suite, recorded replay, policy quality, real-browser/Worker behavior, and player learning/usefulness separate. Run change-appropriate browser checks; if blocked, record the exact blocker and narrow acceptance rather than declaring a browser pass.
- Preserve dirty-source experiment identity. If a local commit is authorized, verify that the committed source hashes match the evaluated candidate, then run the clean-revision full suite and retain its manifest/transcript outside Git. Do not relabel an earlier dirty run as clean. Documentation-only work needs link/schema/content checks and an appropriate independent cold-start exercise, not a timed strategy cohort merely because this process describes one.
- Two independently accepted changes are not automatically an accepted combination. Integrate deliberately, inspect conflicts and run the checks required by the combined behavior before making combined claims.
- Stage only intended source/process/test-fixture files. A request to investigate, review or commit is not permission to publish, merge, deploy, upload evidence, or continue beyond the current scope.
- When publication is authorized, discover a working supported tool, read the current remote head, and preserve an expected-parent relationship. Use a non-forcing update that rejects unexpected ancestry; if the head changed, inspect and integrate rather than overwrite. Verify the exact remote commit/tree and applicable checks before reporting publication. Never assume that an available connector implies CLI credentials or vice versa.
- Finish with what changed, measured scope, tests actually run, evidence location and limitations. Mark blocked/not-run checks explicitly. If the current work window closes, stop and retain partial evidence; do not turn its deadline or permission into a permanent skill rule.
