# Center correctness and S/L preference: research handoff

Status: 2026-10-28. This user-requested, compact handoff preserves the design
questions, rejected approaches and next-test definitions. It is not an engine
change or an acceptance report. Generated evidence remains outside Git under the
[research evidence contract](st-research-workflow.md); do not copy raw traces,
Fumens, sessions, profiles or run logs into this document.

## Revision boundaries

- Historical accepted **local**, unpublished engine baseline for the original
  experiments below:
  `c4ec6fb700580aa9933eb978c0e838b2f40bdc39` (forced-bag normalization plus narrow
  handoff recovery above `edf052e`).
- Published workflow-document revision: `e8d0f0dab4b1257795711a09dc86c8ec9d0951db`.
  It is a separate docs-only descendant of `edf052e`, not the c4 engine.
- The original isolated Center eligibility and combined V7/V8 are **rejected,
  uncommitted experiments**. Neither is the accepted baseline. A review-session import does
  not install an experimental engine.
- Support-aware dependency-before-cover work is a separate mechanism. Do not
  combine it with either task below without independent integration validation.

### Current stable-milestone follow-on

The later eligibility candidate is based on accepted local
`559c9483964370452db7457d5c5056a2370a91c3`, not the original c4-only experiment.
It remains an uncommitted candidate in `center-eligibility-stable-worktree`
(branch `experiment/center-eligibility-stable-milestone-559`).
The user accepted its 48-to-46-line performance comparison and deferred reset
work after frame 107. That removes the performance blocker; it does not turn
the historical rejection into a pass, authorize publication, or establish an
all-green suite. The latest recorded full suite had 916 passes and 3 failures
out of 919 tests. Test maintenance and final acceptance remain separate.

## 2. Center-pattern classifier correctness

**Current milestone scope (user clarification, 2026-10-28):** stable ST play,
not recovery from an already compromised stack. The inherited column-7 vacancy
repair exception below is **out of scope**: its starting board violates the
stable ST column-7 pattern. A legal TSD and absence of a new sealed void do not
establish a milestone-eligible state. Do not weaken eligibility to accommodate
this already compromised board.

**Next discussion:** trace and prevent the earlier pattern violation, and define
pattern-eligibility tests starting from verified stable ST fixtures. This is a
research direction, not a request to implement or run a new experiment. The
rejected blanket ordinary-Center gate remains rejected.

The isolated gate required a recognized motif and aligned lower foundation for
ordinary nonclearing pure-Center placements. It also corrected misleading SL
labels. But its six-pair comparison had zero line wins, five ties and one loss
(known safety case 3197651683: 48 to 16 lines); six existing full-suite tests
failed. It is not accepted pruning or a demonstrated speed improvement.

### Historical repair witness — outside the current milestone

Start from “incidental I repair before a T goal” in the existing
[commitment-comparison fixture](../test/support/st-commitment-comparison.json)
(case 237 in that experiment's suite; identify by behavior, not numeric position).
Replay CCW then hard drop to I target `(x=3,y=24,r=3)`, occupying zero-based cells
`[4,24]` through `[4,27]`. The independently checked properties are:

- Center profile improves `[12,17,16]` to `[16,17,16]` and the motif becomes
  `.#./###/###`, with an exact supported L finisher.
- The lower vacancy `[6,28]` is inherited and unchanged; no new sealed void is
  introduced, and the notch phase is preserved.
- The saved subsequent TSD executes legally and preserves phase. The inherited
  vacancy remains after translation: this is **incremental repair**, not a
  completely repaired foundation or proof of sustainability.

The rejected gate denied this I because the old vacancy remained. That was
previously described as a repair-classification false negative, but it is not a
current-milestone correctness requirement: the vacancy at zero-based `[6,28]`
is in column 7 and does not follow the stable ST pattern. Preserve the mechanics
observation and original reports as historical evidence; withdraw the proposed
eligibility exception for this milestone. These coordinates alone are not a
complete board/history and do not establish where the stack first became
compromised.

### Proposed stable-ST eligibility checks (discussion only)

1. Establish the stable ST column-7 pattern and complete starting-state
   eligibility independently of the candidate classifier. Trace the recorded
   prefix to the first departure before proposing a prevention mechanism.
   Use verified stable-ST positive fixtures and pattern-violating negative
   controls; an inherited off-pattern hole is not a positive repair exception.
   Preserve cavity, notch, resource and actual-reachability checks. Do not
   equate a flat skyline with a supported motif.
2. Retain truthful rejection/labeling of the demonstrated unsupported vertical
   S plus hypothetical leveling L: that endpoint has an unrecognized motif and
   five lower-foundation vacancies. A hypothetical partner is not actual repair.
3. Preserve recognized partial SL without requiring an unseen L. Preserve the
   literal advanced **OSIO** partial sequence, including its vertical S without
   an immediate finisher. There is **no universal vertical-S ban**.
4. Check actual row-clear translation, exact partner identity, advice
   revalidation/advancement and commitment continuation. Classify the six prior
   regressions by milestone eligibility; a failure on a compromised-board
   recovery fixture does not itself justify weakening stable-ST admission.
   Do not relax assertions merely to obtain a pass.

The safety loss does not establish that a selected unsupported Center move was
necessary: saved baseline selected maintenance prefixes all passed the new
ordinary predicate. First divergence was lock 32 (baseline advertised Left L →
Left I → TSD versus candidate immediate TSD), without a pure-Center nonclear in
that advertised prefix. Search competition/timing is plausible, not established
causation. The baseline's subsequently executed chronology was L32 → I33 → J34
→ TSD35, not the shorter advertised prefix.

Source interpretation must stay narrower than community truth. The finite
classifier is not a complete grammar of good ST play; use the existing
[Center foundation discussion](st-center-foundation.md) and
[community source index](st-community-advice.md). Advanced constructions and
freestyling preclude treating an unrecognized motif as geometric impossibility.

### Resolved bug: incomplete search reported as completed abstention

**Disposition:** initially deferred at the user's request during Center
eligibility acceptance, then explicitly authorized for a reporting-only fix.
The adjacent no-best and unsuitable-best abstention paths now share the
existing incomplete-search criterion. Safety checks, search budgets/order and
certified recommendation handling are unchanged. The original regression is
active again (no TODO), and the full suite passed before this resolution update.

- **Reproduction target:** `fresh advice avoids the observed marathon-preparation
  phase-losing placement` in
  [test/st-autoplay-lost-phase.test.cjs](../test/st-autoplay-lost-phase.test.cjs),
  case 127 in the recorded suite. Use its `marathon-preparation` case from
  `test/support/st-autoplay-lost-phase.json`, `P.observe(c.snapshot)`, and
  `P.plan` at depth 3 / width 8 / 45,000 nodes / 1,500 ms on the pinned runtime.
  Compare baseline 559 above and the frozen stable-milestone eligibility
  candidate serially; retain source hashes and actual proof counters. Real
  clocks do not guarantee identical replayed search outcomes.
- **Expected versus actual:** when the candidate abstains with scheduling
  `unfinished=2` and `budgetStops=2`, the tested contract expects
  `budget-exhausted`; actual status is `no-supported-continuation-found`, with
  no target. The matched baseline also returns no target and the latter status,
  correctly for its `unfinished=0` and `budgetStops=0`.
- **Cause and scope:** both reject the best node at `maxHeight=20`. The unchanged
  unsuitable-best return is at baseline `st-planner.js:1080` and candidate
  `:1099` in the inspected sources. It originated in
  `e34991655bc371c723170dd6658226d910a39e05`, before EDF. Eligibility exposes an
  existing reporting defect through changed proof workload; it did not add
  that return. The adjacent no-best branch already checks incompleteness.
- **Risk:** both safely abstain, but callers/UI receive misleading completed-
  search classification. This is not an illegal move, proof that a continuation
  exists, or justification to weaken shape/resource checks.
- **Later fix:** propagate relevant unfinished-search state through the
  unsuitable-best rejection; add focused positive/negative status coverage
  (unfinished versus completed) while retaining safety abstention. Do not
  delete or weaken the current expectation merely to hide the failure.

The eligibility commit kept case 127 visible as an executed TODO under an
explicit user exception, not an all-pass claim or CI waiver. The subsequent
status fix removes that pending marker without changing the assertion. New
controls cover unfinished internal/global budgets, completed unsuitable
endpoints and invalid-history precedence; existing certified-prefix tests
continue to check that unrelated unfinished work cannot erase valid advice. Exact source comparison and receipts are in the optional local locator
`center-eligibility-revalidation-evidence/post-performance-acceptance/STATUS-CAUSALITY.md`.
The original historical reports remain unchanged.

## 3. Broader S/L preference

**Decision:** broad weight changes remain on hold. The complete human-proposed
route has useful development evidence, but orientation alone has not been
isolated and the combined engine failed its natural-start gate.

V7's six shared-prefix development pairs produced three wins and three ties.
Those were conditioned on the same first 20 recorded locks, not proof that the
engine chooses the early opener. V8's actual Worker selected and retained its
intended horizontal Center S / J / I-quad / O / L route on safety seed 3197651683.
Nevertheless it still stopped at 40 locks / 10 lines versus c4's 127 / 48.
Equal totals do **not** mean the V8 preference was never invoked. V8 failed the
quality gate; its full suite and later cohorts were not run.

### Matched human-route experiment definition

Use unchanged frozen V8 in both arms with the identical evaluator-only input
stream for seed 3197651683. Replay the common first 16 locks, including the
actual Z16 opening handoff, and require equality of the **entire public request
17**, including phase and connected history. Substitute only the player's
reconstructed placements 17–21 (SCenter, LCenter, OLeft, JLeft, JLeft); original
placements remain in the control. Resume autonomous V8 at lock 22 with normal
six-piece reveal and unchanged production budgets (depth 3, width 8, 45,000
nodes, 1,500 ms; 200-lock cap in this experiment). This normal-refill
counterfactual does not imply that the user saw later previews in the original
finite-queue manual session.

The corrected pair achieved 43 locks / 12 total lines versus 40 / 10; both
abstained. This is one matched development pair, not confirmation or general
superiority. It tests a complete route including I/O/HOLD allocation, not S/L
orientation in isolation. An earlier attempt omitted the manual arm's Z16
handoff and was phase-confounded; retain it but exclude it from the conclusion.

All 83 locks in the corrected pair replayed. Its only non-Right Z in each arm
was the common authorized mandatory Z13. That clean scoped result **does not**
recertify c4's separate 48-line route: c4's Z15 permission was unproved, and the
isolated-eligibility comparison inherited that defect in both arms. Preserve
observed deltas without treating flawed baseline history as permission.

The second manual endpoint, after lock 28, matches the already recorded coach
board and the full refilled public request 29. It supplies no new treatment or
independent confirmation; no new rollout was run. A representative route is
ILeft22 → TSD23 → OLeft24 → second-ILeft25 → ZRight26 → SCenter27 → LCenter28.
The endpoint is already recognized and its S/L debt fulfilled: it is not a new
classifier false-negative witness.

### Next tests, in order

1. Finish the separate support-dependency mechanism before considering broad
   preference weights. The demonstrated I-before-cover case prevents four
   sealed Left cells; it does not prove every IRight choice is bad. Later S43
   newly covers seven vacancies, but these are not proved sealed, irrecoverable
   or the cause of failure. Treat that later case as a diagnostic, not an oracle.
2. Discuss classifier correctness using verified stable-ST fixtures and trace
   the earlier column-7 violation. Do not implement the out-of-scope inherited-
   vacancy repair exception above. Neither favorable manual endpoint proves
   that all preferred S/L branches should outrank scoring or cleanup.
3. If broader preference is investigated, predeclare one mechanism and compare
   it against the accepted baseline, without silently importing the rejected
   V8 bundle. Preserve actual scoring timing, real partner payment, public
   supply and exact incumbent fallback when alternative proof is unknown.
4. Reconstruct phase-matched development cases and both mandatory natural-start
   safety seeds (3197651683 and 3197643764), then use untouched holdouts and
   reverse-order confirmation if the gate is promising. Inspect resource
   permissions independently of lines. The already inspected inputs are not
   fresh holdouts. Follow the existing full-suite, independent-review and
   publication gates; this handoff does not authorize a new run.

V8's terminal request 41 and the corrected manual-route terminal request 44
both finished well below their search budgets with no unfinished proofs. That
is a bounded grammar/admission miss, not proof of no legal move. The exact
rejecting mechanism and a better continuation remain unresolved; merely
increasing time is not the evidence-led next test.

## Optional local evidence locators

The paths below were verified in the cloud workspace on the status date. They
are **nonportable, disposable evidence locators**, not repository links,
bootstrap dependencies or promises of permanent retention. Root:
`/workspace/scratch/9bf9eb5bd93f/zztetris-cloud-audit/`.

| Relative location | What to recover if still available |
| --- | --- |
| `center-eligibility-evidence/attempt-01/FINAL-REPORT.md` | Isolated rejection, six failures and source identities. Adjacent `incidental-i-diagnostic.json`, `retention-probe.json`, `baseline-prefix-eligibility.json` and frozen sources supply exact replay inputs. |
| `right-entry-evidence/FINAL-RESEARCH-HANDOFF-2026-10-27.md` | V7 development context and its separate rejection. |
| `right-entry-evidence/FINAL-V8-REJECTION-2026-10-27.md` | V8 rejection, actual Worker selection and terminal uncertainty. Adjacent `v8-frozen-source/` and `source-freeze-v8-sha256.txt` identify the rejected source. |
| `manual-center-review-2026-10-28/DIAGNOSIS.md` | Concrete support-before-cover counterfactual; constructed witness, not recovered user input tape. |
| `user-sl-seed1683-2026-10-28/README.md` | Corrected one-pair comparison; use `protocol-phase-controlled.json` and `paired-phase-controlled/`, not excluded `paired/`. |
| `user-sl-seed1683-second-2026-10-28/README.md` | Exact request-29 equivalence and limits of the S43 observation. |

If evidence is lost, retain these questions and case invariants, rebuild honest
minimal fixtures, and rerun under a newly declared protocol before claiming
replication. Do not reconstruct hidden history or fabricate exact source
identity from a seed label. No new simulations or engine tests were performed
for this documentation-only handoff.
