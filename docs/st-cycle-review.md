# Reviewed scoring-cycle policy

This revision implements Kevin's manually reviewed cycle feedback. The three added starts are development regressions, not new generalization evidence. No fixture ID, reference answer, future stream or source page enters the planner.

## Changes

- Recognize normal scoring, cap rebuilding, early column-ten I preparation, a prepared bottom-four cleanup, scoring above an existing column-eight I, and post-clear rebuilding. Use occupancy rather than piece colours or a rigid count of four doubles.
- A column-ten I can be prepared against a solid three-cell wall before the fourth cleanup row is ready. That state remains a scoring phase, not an immediately executable quad. An I can still be used on the left while the cleanup is not ready, as in the already reviewed sprint placements 91/95.
- Prefer a cap Z that actual-pose/hold enumeration proves executable over optional filler. Merely recognizing a hypothetical spawn cap is insufficient for that precedence. A later visible Z does not by itself excuse spending the current cap piece elsewhere. Actual TSD/quad work and recognized I preparation are not classified as optional cap postponement.
- Preserve a T's scoring role in recognized scoring phases, including above a cleanup I. Preserve an eligible I cleanup role rather than spending it on optional filler. A held T can wait while useful preparation happens; this is not an always-immediate-TSD rule.
- Normal search admits zero-clear preparation, right-region full TSDs, and right-region I tetrises. Ordinary singles/doubles/triples, left-side clears and non-spin doubles are not presented as normal ST. This is a policy restriction, not a claim those moves are illegal under the rules kernel.
- Recognized obligation compliance precedes heuristic structure/tactical ranking. Keep a shorter compliant checked prefix when deeper search finds only obligation-diverting lines. If no compliant prefix is established, abstain with `no-supported-continuation-found`; no recovery strategy is silently substituted.

## Important boundary

Cap-rebuild geometry alone does **not** establish imminent T timing. The previously approved L-center → T-left → Z-cap sequence remains supported: its Z is not active/held until the third lock, and its earlier right geometry is not yet a scoring phase. Extending T reservation to every cap-rebuild state initially regressed this case; that overbroad rule was removed rather than weakening its existing expected-move test or retuning center/roughness weights. This revision does not solve every pre-cap T supply conflict.

Cleanup recognition is a small supported geometry grammar, not proof of indefinite sustainability or of future arrival. Preparation and an immediately executable quad remain distinct. The supplied I snapshot now prepares column ten while preserving the open column-eight channel and a legal Z cap. The finite continuation does not claim that the later I or a complete canonical cycle has been proven.

## Focused checks

- Restore the right cap (sprint 83): exact approved Z cap at full bounded search and production 750 ms soft limit.
- Center before quad cleanup (sprint 92): exact approved center S, not ordinary-single → quad.
- Double above the cleanup I (mirrored Marathon 145): exact approved full TSD; its legitimate phase change is no longer repair damage.
- Existing accepted alternatives: sprint 28 keeps different left construction; Marathon 48 keeps left fill then supported I quad; Ultra 25 may delay the TSD while preserving the T.
- Supplied I snapshot chooses column ten. Early preparation and later left-I allocation on the already reviewed sprint 91/95 retain their distinct roles.
- Prior L-center/cap-reservoir regression retains its original expected move, score and exact-cell exemption. Only its diagnostic rank assertion gains a zero cycle-debt axis.
- Tests replay every advice prefix; negative clear-policy, clean shorter-prefix, and no-supported mechanics are tested using existing known positions and filtered real legal moves, not invented boards.
- All 24 original fixture objects and their original construction steps remain unchanged. The three additional playable positions have descriptive names and explicit synthetic queue/hold provenance. Source reconstruction coverage extends to sprint 92 and mirrored Marathon 145, with independent Fumen comparisons and UI privacy checks.

## Broader validation

Compared with `f4f526e` on Node 24.20.0, depth 3, width 8 and 45,000 visited poses:

- All original 24 starting-position outcomes, first targets/witnesses, checked locks and budget flags are unchanged: 23 executable recommendations and the expected unsupported left-side diagnostic.
- `o-filler`, 36 locks: TSDs 4 → 5; quads 0 → 0; ending height 14 → 13; noncanonical clears 2 → 0.
- `marathon-rebuild`, 36 locks: TSDs 3 → 3; quads 0 → 1; ending height 17 → 16; noncanonical clears 3 → 0.
- `marathon-preparation`, 36 locks: TSDs 4 → 4; quads 0 → 1; ending height 16 → 16; noncanonical clears 3 → 0.

All three runs finish the 36-lock limit with zero witness failures. The fixture streams are unchanged. These finite runs support the targeted policy change, but are not an indefinite-sustainability or unseen-generalization result. Fresh generalization remains reserved for manual playtesting.

The aggregate suite is run on pinned Node 24.20.0. Focused tests exercise both deterministic full search and real 750 ms production budgets. Independent fresh-process checks also exercise cold-cache timing; a budget-truncated result may retain the same approved first move at a shorter verified horizon. The 750 ms limit remains soft, not a hard wall-clock guarantee.
