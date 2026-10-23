# Phase-compatible center partner evidence

The user-supplied O-active, held-S position exposed a mismatch between preparation evidence and actual search legality. A second O stacked in columns 5–6 was credited with an O/J preparation. Its advertised hypothetical J filled column 7 at zero-based row 26, which the inherited scoring cadence reserved as a notch. The actual J would be rejected later, but its promise had already improved the O's structural evaluation.

## Change

Center-completion witnesses now execute through the rules kernel and must satisfy the canonical-clear and inherited column-seven notch checks before contributing to geometry, obligations, partner preparation, or scoring. `geometry` and `assess` accept an optional `notches` context; `transition` receives the phase before the actual placement and translates it for the resulting board. The planner passes its inherited phase, rather than allowing every hypothetical partner to reconstruct an unrelated phase. Geometry cache identity includes that phase.

This does not ban stacked Os, force immediate pair completion, or require every unfinished tooth to be filled. A physically legal move remains physically legal. A missing compatible partner is missing evidence, not a proof that repair or continued play is impossible. Unknown phase retains the existing conservative anchoring behavior.

## Regression evidence

`test/st-center-partner-phase.test.cjs` uses the supplied snapshot in `test/support/st-user-o-partner-phase.json` and checks:

- The existing O's J completion remains valid, while the stacked O receives no incompatible O/J pair credit.
- Other legal S/L completions remain available.
- Identical occupancy under distinct inherited phases does not share cached completion evidence.
- Four-row cleanup translates the original compatible J completion correctly.
- The depth-3 recommendation uses O in columns 3–4, then the available I in column 8 for a tetris.
- Existing incomplete construction and checked S/L pair evidence remain available. Existing center-advice tests also cover a checked L/O pair.

Before the fix, cold and unrestricted depth-3 searches chose O in columns 5–6. A seven-lock diagnostic could reach a tetris and T-spin double from either first placement, so the center O was not established as dead. The left route ended one row lower in those tested continuations. These are finite diagnostic results, not indefinite sustainability claims.

## Legacy geometry expectations reconciled

The original structure suite included physically executable continuations whose center-partner claims predated notch enforcement. Both late-held J/O routes first put a J into protected column-seven row 28. Their O continuations still replay and retain the old level/SL-ready geometry and void checks, but no longer count as compatible partner evidence through an already broken phase. The old left-L/O preparation had an O filling protected row 25; the old horizontal center Z filled protected row 27. Dedicated negative assertions now preserve those witnesses and identify the exact conflicts.

All four ordered-family positive tests remain, now checking notch validity of both legs. The L/O witness uses the already-existing after-quad `HOLD,CW,HD` route; Z/J uses the already-existing cap-rebuild `R,CW,HD` route. No starting positions or planner exceptions were added to make these tests pass.
