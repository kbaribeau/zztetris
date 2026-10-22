# Experimental regional planning revision

**Not accepted as a sustainable-play improvement.** The eight reviewed first moves improve in several respects, but the existing 36-lock streams end materially higher than the baseline. This local experiment is preserved for inspection, not claimed complete or ready to replace the baseline. No push is part of this revision.

No back-to-back state/scoring, new starting positions, untouched generalization cases or third reference are used. The eight previously published starts are development regressions. Kevin's next manual playtest remains the generalization check.

## What is implemented

- `st-structure.js` recognizes left platforms/partial repairs, concrete center S/L/O/J finishing placements, and right scoring-wall/rebuild shapes. Sixteen short, vertically translation-independent center occupancy motifs come from the two existing Fumen references. These are positive local examples, not whole-board matches, fixture-ID answers, exhaustive rules or proof of sustainable continuation.
- Completion alternatives include exact targets and replayable hypothetical-spawn input witnesses. Sealed center voids are distinguished from side-accessible covered cells. Air access alone is not tetromino access. A legal completion is separately labeled when its result is not a recognized motif; unknown motifs remain legal and uncertain.
- Active, held, visible and forced-beyond-preview pieces have distinct identities. Obligations cannot assign the same instance twice. Unknown supply is unresolved rather than impossible. Identity matching does not certify arrival order; only the returned executed prefix proves timing/access.
- Structural ranking precedes tactical TSD tie-breaks. It includes role/dependency costs, repair credits, headroom and left/frontier/scoring-row imbalance. The old 24-point hypothetical-slot bonus becomes a one-point tactical tie-break, with a structural penalty for disproved entry.
- Crossing regions is not forbidden. Nonstandard roles request stronger repair evidence. Left-T diversion is a conservative role/timing preference, not proof that another T is unavailable.

## Existing feedback starts: before and after

Reproduce with `node scripts/st-regional-comparison.cjs`: depth 3, width 8, 45,000 visited poses, no wall-clock cutoff. Baseline `7129d6b` has the same tree as published `06e8d1d`. All final prefixes replay with exact matching events. Columns are one-based.

| Existing start | Baseline first move | Experimental prefix | Interpretation |
| --- | --- | --- | --- |
| Direct T double | Held I column 10 | Immediate TSD, S center 5–7, J left 1–2 | Avoids speculative I-wall/J-cap detour. |
| S after clear | Held I column 9 | Held I column 1, J left 2–4, held S center 5–7 | Left repair precedes the center S. Not the literal reference order. |
| Higher double | I 7–10 single | Held TSD, S center, L center | Immediate score followed by checked S/L construction. No B2B rationale. |
| After quad | Held L 3–5 | Held L center 5–6, O center 6–7, Z left 2–4 | Removes the crossing placement, but does **not** execute the suggested S/L sequence. A possible S partner is not proof that the selected O continuation is preferable. |
| Later held double | I 7–10 single | Held TSD, J left 1–2, O left 3–4 | Immediate TSD is preferred; the following J/O are left fillers, not the proposed center pair. Reviewed center alternatives remain replayable in tests. |
| Moved active pose | Held I column 10 | Immediate TSD, S center, J left | Exact moved-pose witness verified. |
| Independent preparation | Held I 7–10 single | Held horizontal I 1–4, TSD, horizontal I 1–4 | Keeps the flat left platform. No B2B rationale. |
| Independent rebuild | I 7–10 single | Held Z 9–10, S center, L center | Right cap first, consistent with the existing reference. Horizontal left I remains another reviewed alternative. |

All eight formerly problematic first placements disappear. This is not a claim that every revised choice is optimal or that each suggestion was implemented literally. Absence from a positive Fumen sample is not proof a move is wrong.

## Material failed sustainability check

Same three **already-defined** streams, same 36-lock budget, six-piece preview and independent witness replay:

| Existing stream | Baseline TSDs / ending height | Experiment TSDs / ending height |
| --- | --- | --- |
| O filler | 2 / 6 | 2 / 19 |
| Marathon preparation | 3 / 8 | 3 / 17 |
| Marathon rebuild | 2 / 5 | 2 / 18 |

All experiments execute 36 locks without top-out or invalid witnesses, but all finish without executable T entry. Independent review reproduced those endpoints. Recognized center motifs and zero measured frontier/scoring-row deficits do not capture renewable scoring structure. Merely surviving these streams is not a pass.

Bounded corrections tried actual-entry penalties, preservation debt, headroom/frontier imbalance, concrete partial left repair and local center motifs. They did not eliminate the regression. No further small-weight tuning is presented as a solution. This result remains a blocker to accepting the requested sustainable recommendation improvement.

## Verification

- Full regression/integration suite: **249/250 passed**, one failed, zero cancelled/skipped, 73.59 seconds on Node 24.20.0. The existing reservoir-cap construction test expects a selected TSD at lock 2; the structural-first planner returns `tsdAt: null`. The assertion is retained, not weakened. Passing legality/integration tests does not erase this behavior regression.
- All 24 existing starting positions checked: 23 return executable advice, and the left-side diagnostic correctly rejects the unsupported profile.
- Five existing 12-lock streams complete with valid witnesses and the existing minimal nonclear→TSD→rebuild cycle: O-before-double 2 TSDs / height14; O-filler 1 /14; marathon preparation 1 /14; marathon rebuild 1 /14; higher-cap 2 /15. Three are exact 12-lock prefixes of the recorded 36-lock runs.
- Cold regional-cache checks on the eight feedback starts return replay-valid advice in **756–824 ms** with the 750 ms soft deadline. Seven complete depth1; rebuild completes depth2. At this budget, after-quad chooses S5–7 and rebuild chooses horizontal I1–4 instead of the deeper table's L and Z. Search depth and choice are budget-dependent. This is not a hard response-time promise.
- Focused final regional-model and eight-feedback regressions: **19/19 passed** (9.76 seconds). These local successes do not cancel the retained full-suite failure.
- Independent review checked scope, uncertain motif labeling and the three final 36-lock endpoints. `node --check` and `git diff --check` pass. The serial suite watchdog is 120 seconds; the existing 15-second per-file guard is unchanged.

The compact [recorded results and exact input traces](st-regional-evaluation-results.json) preserve the comparison, all existing starting-position checks and existing finite-loop traces. The historical baseline remains in [st-evaluation.md](st-evaluation.md) and its recorded results. No new future stream or untouched position was generated.

## Remaining model limitations and next decision

- The current depth-three structural heuristic needs a stronger representation of an executable **renewed scoring cycle**, including inter-region row dependencies and the actual sequence of partner arrivals. More local pattern matches alone did not solve that.
- Scoring-geometry repair debt starts on non-clearing destruction only. Ordinary clears that destroy a slot do not start that debt. A geometric slot can reset it before entry is qualified, although disproved access has its own penalty. Do not interpret this field as a complete renewal proof.
- Partner supply allocation is simultaneous identity feasibility, not a temporal schedule or full bag-aware guarantee. Concrete completion witnesses are hypothetical-spawn checks, not automatic access from the current active pose.
- Center motifs inspect only three local rows. A recognized motif can coexist with a poor complete stack or unusable right entry.
- Actual-browser visual/hosted-worker checks remain blocked by the cloud browser sandbox. Actual-page jsdom/worker integration tests are not visual evidence. Acceptance stays open.

The baseline is preserved as local branch `codex/st-lab-pre-regional-evaluation`; checking out that branch recovers it without a reset. The experiment remains on `codex/st-lab-milestone-one`. Recommended next decision: keep this work experimental and develop a bounded executable renewal objective before claiming sustainable improvement, or deliberately playtest it as an acknowledged regression experiment. Do not use a new reference as hidden validation for this revision.
