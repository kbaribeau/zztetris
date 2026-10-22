# Reservoir clear-order mechanics

The former **Mechanics · Reservoir clear order** playable example has been removed from the ST lab. The existing `fixtures.cap.before` board remains in mechanics tests only, outside the unchanged 24-position evaluation corpus. It is **not** “Rebuild the right cap.”

The board starts with active **T**, held **Z**, and preview **O I J L S T**. The preview is synthetic and finite; no source-video bag history or hidden continuation is claimed.

This is a **mechanics example, not a recommended ST pattern**. In particular, the O placement at columns 5–6 is not established as a supported center pattern. Neither the test position nor its previously generated replay-state diagram is evidence of good ST strategy.

## Retained test sequences

The unit tests independently replay both paths from the same starting state. Column numbers below are one-based. “Down” means move down one cell without locking; only hard drop locks.

Both paths begin:
1. Hold to select Z.
2. Move right four times, rotate clockwise once, and hard drop. Z caps columns 9–10.

### A: Z → T-spin double → O

3. Hold to select T. Move right three times, rotate clockwise, move down 18 cells, rotate clockwise again, and hard drop. This clears the double.
4. Hold to select O. Hard drop without moving horizontally, at columns 5–6.

### B: Z → O → T-spin double

3. Hard drop O without moving horizontally, at columns 5–6.
4. Hold to select T. Move right three times, rotate clockwise, move down 18 cells, rotate clockwise again, and hard drop.

The explicit 18-cell path above is the independently replayed test witness, not an instruction to select a playable example.

After three locks, both paths have the exact same board, active **J**, held **I**, remaining preview **L S T**, hold availability and draw cursor. Their clear timing and last-event/history differ. No back-to-back state is modeled, so this is not a claim of equivalence under scoring rules absent from the lab.

## What the tests establish

The direct Z → T-spin double legality test remains and contains no O placement. The separate O-before/after-clear test proves only mechanical state identity under the current rules. It does not constrain planner recommendations or establish strategic quality.

The recommendation test prescribing a double within three locks and the exact Z/T/O endpoint has been removed. A legal shared endpoint is not enough to justify recommending that O placement. No replacement strategic answer is asserted for this synthetic position.

Other existing planner and closed-loop tests still check executable recommendations, actual T-spin doubles and supported rebuilds. In particular, the existing higher-cap sequence retains coverage for a temporary sealed vacancy that is repaid by a double. No new starting positions or ranking changes were introduced for this cleanup.

This change does not resolve the separate longer-stream sustainability regression. Browser pixels and manual play remain separate checks from the executable rules and UI-harness tests.
