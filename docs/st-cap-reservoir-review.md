# Verified cap reservoir exemption

This is a narrow classification correction on top of `99a4fb7`, not a strategic retuning or proof of sustainable play.

## Rule

The existing right-wall recognizer now identifies a canonical Z-cap reservoir: column eight is empty, column nine is a continuous wall, and column ten has exactly the two-cell cap roof above an otherwise empty bottom shaft. Matching this geometry alone awards nothing.

The planner's existing, budgeted counterfactual T-entry search must produce a real input witness. Replaying it must perform a full T-spin double, remove the roof, and reopen every identified shaft cell. Only those cells are excluded from the generic sealed-cell and covered-cell costs. Raw cavity counts remain available alongside damage counts and the exact exemption proof. Unrelated holes and roofed cells retain their costs. This does not establish when another T will arrive, nor change supply obligations, headroom, entry repair, or the value of other regional patterns.

Potential credit is an optimistic bound during candidate qualification so a promising cap is not pruned before its witness is checked. Failed or interrupted proofs receive no credit. Verified proof is local to an assessment, never stored in the shared geometry cache.

## User-provided regression

The supplied moved-L snapshot is retained only in `test/support/st-user-center-cap.json`, not added as a playable starting position or new generalization case. The complete modified depth-three search now recommends hard drop into columns 5–7 to finish the S/L center. Its continuation uses T on the left and Z on the right.

The exact column-ten cells at zero-based rows 37, 38 and 39 are reopened by the witnessed double clearing rows 35 and 36. Their old generic cost was 9 points. The retained endpoint is now −11.3, rank `[1,1,-3,1,-10,0]`, rather than −20.3. Three other covered cells still count as damage. No T remains in the visible/held supply at this endpoint: the proof is expressly counterfactual.

Known sprint reference pages 34/35 and 62/65 exhibit the same cap/clear relationship. Tests also cover interrupted proof, cache isolation and the already-established inaccessible reward-farming cavity.

## Existing-case changes

Using depth 3, width 8 and 45,000 nodes on Node 24.20.0, 21 of the 24 established starting recommendations are unchanged. The three changes are:

- `o-filler`: held J on the left instead of O on the left.
- `after-quad`: S center preparation instead of held L center preparation. The selected prefix does not finish the S/L pair, and the advice says so.
- `deviated-o-recovery`: held O on the left instead of J on the left.

`cap-rebuild` still starts with Z on the right. Its deeper continuation now uses J in the center and O on the left, rather than both on the left. The prior J/O left-fill route remains independently replay-tested. Ordered L/O explanation coverage is retained using the same existing start and its two previously checked legal placements; unrestricted ordered-pair recommendation coverage now uses the existing `empty-hold` S/L route.

All three existing 36-lock streams finish with legal witnesses, but results are mixed:

| Existing stream | Before: TSDs / ending height | After: TSDs / ending height |
| --- | --- | --- |
| o-filler | 2 / 17 | 4 / 14 |
| marathon-rebuild | 3 / 14 | 3 / 17 |
| marathon-preparation | 4 / 15 | 4 / 16 |

The latter two height regressions remain disclosed, not tuned away. These are development streams, not fresh held-out generalization evidence.

## Verification

The full suite passes 269 tests on Node 24.20.0/npm 11.19.0. A fresh unrestricted run of the supplied snapshot completed depth three in 961 ms (21,846 visited nodes). A separate production-budget run returned the same center L after completing depth two, in 764 ms, explicitly reporting budget exhaustion during depth three. The 750 ms deadline remains soft; this change does not guarantee full-depth production completion.

## Limits

The exemption is deliberately conservative. Noncanonical caps, unfinished scoring rows, and entry proofs that exceed the search budget remain uncredited. The access routine returns its first reachable T-double; if that clear does not reopen this reservoir, another possible clearing route is not searched specially. Finite search, input simplicity and actual piece timing remain separate from pattern recognition. No back-to-back model, whole-repository formatting, enforcement, or new untouched cases were added.
