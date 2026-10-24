# A finite paired-T Left-foundation stage

This is a narrow construction stage, not a universal Reset coach or a rule that the first two Ts must go left.

## Observed problem and purpose

On an observed development position, the active T, held S and next T were all visible. Spending S first left both active and held pieces as T, with no immediate scoring opportunity. The old move created a genuinely inaccessible vacancy; its access-safe replacement still left an awkward piece-order problem before the later J could be used.

A legal two-T construction exists before spending S. It fills all six missing Left cells in the next scoring rows, keeps the maximum height at five, preserves every Center/Right cell, leaves no covered Left cells, and restores Left checkerboard balance to zero. A previous forced-prefix experiment continued for 40 additional locks with five full T-spin doubles and one Tetris. That intervention motivated discovery work; it was not evidence that the autonomous engine already selected it or that it works indefinitely.

## Eligibility and certificate

The stage is admitted only with an established scoring phase, an aligned supported Center, a balanced Left with no covered vacancies, and an actual missing-cell obligation in the Left portions of the next two scoring rows. It cannot compete with cap or I-cleanup obligations. Full root enumeration must complete before discovery considers it, and even a geometric immediate T-spin-double opportunity excludes the certificate.

Discovery uses actual current/hold/visible-preview states. Exactly two legal, nonclearing Left T locks must fill the observed target cells, restore parity, leave no covered Left cells, preserve Center/Right occupancy and stay within the existing maximum height. Actual movement-access and notch checks still apply. The second T may be exposed through an empty hold; result-state deduplication preserves different hold/queue outcomes.

This is a finite goal: Left foundation completion. It does not certify the next Center partner, a future T, a scoring clear, a completed opening, or a full community Reset. The reference guide supplies background about mino parity, not proof that this exact runtime move is optimal.

## Selection and lifecycle

The stage does not replace a checked ordinary route that already carries scoring, Tetris, Pocket, or concrete Center progress. If a two-lock ordinary comparison is available, both endpoints are replayed at that same horizon; the paired stage must not worsen height, covered Left cells, parity, Left scoring-row deficits or recognized Center quality, and must improve at least one of those structural measures. If only a one-lock ordinary fallback is found, admitting a checked two-lock alternative is not a claim that all longer ordinary routes are impossible.

The immutable original public proof is regenerated after the first actual T. The second-T obligation survives fresh preview, cosmetic input and checked HOLD changes. Binding checks the exact lock event and known post-lock active/hold/queue/canHold state; bag knowledge must agree with genuinely newly revealed suffix pieces. An unknown next piece beyond the original proof's endpoint is not invented. A different manual lock, unrelated hold/preview state, reset or import cannot silently retain the proof; Undo restores the corresponding saved obligation.

Normal search budgets are unchanged. Production stage discovery receives at most 100 milliseconds within the shared request deadline and at most 12,000 remaining movement nodes; it is incomplete. Fixed-node diagnostic calls use the node bound without an additional stage wall cutoff. All certification and rebinding attempts, including failures, consume the same decision allowance.

## Compact opening regression data

`test/support/st-opening-round1.json` is reduced from 1,358,616 to 216,816 bytes, retaining readable JSON. All 39 handoff observations and actual-clear proofs, all 41 consumed continuation witnesses/events, all eight failed-clear observations and the repair-control certificate remain structurally identical. Eleven count-only endpoints become seed-only records. Unused diagnostic context and duplicated evidence were removed, not the regression tests. The simulator complements these controls; it does not replace rare safety/lifecycle tests.
