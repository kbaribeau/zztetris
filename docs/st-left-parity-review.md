# Existing left parity: evidence before a priority rule

The supplied board has a color-independent checkerboard imbalance of +2 in
columns 1–4. Its active T can legally cancel that imbalance and flatten the left
skyline from [9,8,7,8] to [9,9,9,9], without increasing maximum height or creating
new internal sealing. The witness is left, left, 180-degree rotation, hard drop.
An immediate full T-spin double instead preserves the imbalance.

This is not an inference from colored T cells. The occupied cells establish the
imbalance. The reference evidence supports the mechanism: all 26 left-T locks in
the 1000-line example form 13 opposing parity pairs; Ultra167/168 and reflected
Marathon226/227 likewise cancel their left imbalance. Some valid second Ts do
not flatten the left. These observations do not establish the original preview,
prove every pair is a complete Reset, or justify a rule for every nonzero parity.

## Finite continuations

Using only the supplied visible pieces, scoring first yields two doubles in
seven locks, height8 and residual left imbalance+2. A verified repair-first route
can yield one double, level center9, height10 and parity0. Thus a short horizon
necessarily charges the repair for the immediately forfeited double and cannot
settle its longer tiling benefit.

## Matched longer initial-choice experiment

The experiment forced only the first legal placement, not a preferred seven-lock
route. Every later move came from the unchanged d81558e engine, with actual hold,
six-piece preview, 750 ms / 45,000-node search, fresh caches and the browser's
commitment lifecycle. Each pair received the same evaluator-private valid bag
extension. Three existing development seeds were used, with 70 total locks per
branch or earlier abstention. No branch or timeout was discarded.

| Seed | Scoring-first locks / lines | Repair-first locks / lines | Common horizon | Maximum height at common horizon, scoring → repair | Occupied cells, scoring → repair |
| --- | --- | --- | --- | --- | --- |
| 10331 | 48 / 12 | 42 / 8 | 42 | 18 → 18 | 102 → 142 |
| 10333 | 49 / 12 | 57 / 18 | 49 | 19 → 16 | 130 → 90 |
| 20333 | 40 / 8 | 70 cap / 22 | 40 | 19 → 12 | 134 → 74 |

Repair helped two streams and harmed one. It maintained parity0 throughout all
three repair branches. There were no canonical-clear, notch, new-internal-sealing,
top-out or later structural-policy failures, and no unpaid center/cavity debt at
termination. Its forced first move is explicitly an exception to the existing
spent-scoring-T guard, not an engine-generated recommendation. Five branches
abstained; the sixth reached the observation cap. Abstention does not prove that
no legal continuation exists. Wall-clock cutoffs and the small selected sample
limit causal and generalization claims.

## Decision

No behavioral parity rule is added. The evidence supports developing a checked
single-T parity-repair candidate, not unconditional priority over a double. A
candidate would need to cancel an observed magnitude-two imbalance, preserve
notches and exact center/right obligations, avoid new sealing, and demonstrate a
visible legal supported continuation. Its selection still needs a defensible
structural criterion that distinguishes the losing stream without using hidden
future or a seed-specific exception. A two-of-three result is not that criterion.

The paired initial state, witnesses, public search settings, evaluator-only
extensions and matched-horizon summaries are preserved in
[evidence/left-parity-comparison.json](evidence/left-parity-comparison.json).
This is research evidence, not a runtime fixture or a general replay adapter.
