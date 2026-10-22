# Cap allocation and ordered center-pair review

This revision uses only the original source-derived starting positions and existing streams. The reservoir board remains only in mechanics tests, not in the starting-position selector or generalization corpus. No third Fumen or back-to-back model is used.

## Changes

- A cap-preparation surface now has concrete fresh-spawn Z placement witnesses. A right-side Z is called a cap only if its resulting wall is the recognized staggered scoring wall. Other right-region placements still require repair evidence.
- Distinct-instance allocation prioritizes essential cap supply over optional left filling and uses arrival estimates to prefer current/available-held pieces. Spending the sole known Z outside its cap role adds opportunity cost; unknown post-clear future supply is a modest uncertainty cost, not proof that taking a double is bad.
- A bounded two-drop geometric search exposes alternative left fills, including J then O on **Rebuild the right cap**. These are explicitly hypothetical until the actual selected search prefix verifies piece order, hold and access. Filling scoring rows does not mean producing a perfectly flat left region.
- The common center grammar is ordered: **L→O, O→J, S→L, Z→J**. Preparation and finishing cells are checked. Advice names a pair only when the selected executable prefix actually completes it; a shallow prefix does not promise an unsearched partner. Finishing a shape alone does not invent its earlier construction history.
- The reservoir playable example has been removed. Its direct Z-to-double legality and clear-order equivalence tests remain mechanics-only; the O-containing endpoint is not a recommendation oracle. See [mechanics test scope](st-reservoir-review.md).

## Targeted results and limits

At depth 3, width 8 and 45,000 nodes, **Rebuild the right cap** chooses Z in columns 9–10, then J and O in the left region. **Rebuild after quad cleanup** uses held L then O in the center and identifies that L/O order.

The existing **marathon-later-double** changes from immediate TSD then Z/J left to Z/J left then TSD. Both three-lock continuations reach the same board, active piece, hold, preview, hold availability and draw cursor. This is ordering equivalence under the current rules, not back-to-back scoring equivalence.

A too-strong initial missing-Z penalty was rejected during validation because it discouraged a successful reservoir clear. The shipped version puts the strong cost on spending a known scarce Z, not on every unknown future rebuild.

The 750 ms production deadline may stop at a shallower completed horizon and choose a different valid preparation. In a concurrent-load diagnostic, all three affected starts returned bounded prefixes in approximately 773–833 ms; after-quad selected S with an explicitly unproved completion instead of making the depth-3 L/O claim. This is not a latency guarantee. Assessment helpers have coarse deadline boundaries.

Arrival estimates are not a full future scheduler, and known Z far down the preview is not treated identically to absent Z. Only executed prefixes prove timely arrival and actual access. These improvements do not establish sustainable multi-bag play; existing long-stream results remain a separate acceptance concern.

Actual-page selector/reset tests verify behavior, not painted pixels. Cloud rendering could not be checked: terminal targeting was ambiguous, file navigation was denied, and the browser could not reach the separate shell server. No security settings were changed. The provided board diagram is generated from independently replayed rules states, not a browser screenshot.

## Existing-stream comparison

The [retained before/after summary](st-cap-pair-comparison.json) compares d8a01ac with this revision at the same depth 3 / width 8 / 45,000-node budget. All original 24 starts are retained: 23 executable recommendations and the expected unsupported left-side diagnostic, with no invalid witnesses.

All three existing streams complete 36 locks without witness failures:

| Existing stream | Old ending height → new | Old TSD count → new |
| --- | --- | --- |
| o-filler | 19 → 17 | 2 → 2 |
| marathon-rebuild | 18 → 14 | 2 → 3 |
| marathon-preparation | 17 → 15 | 3 → 4 |

All three final endpoints still lack reachable hypothetical T-double entry in a completed search. These are improvements over the immediately preceding regional revision, not recovery of the older pre-regional results or proof of sustainability.

The additional changed first move **empty-hold** also deserves manual review: old TSD→S→L versus new held S→L→TSD reaches the same board but not the same full piece state. Using an initially empty hold draws one extra piece: old ends active I / empty hold / preview Z J O; new ends active Z / held I / preview J O. Both execute a double within three locks. Do not describe this as full-state equivalence.
