# Native obligation fixtures

The current obligation snapshots in these regression fixtures were converted once
from committed public action fixtures at `caff3d02`. The conversion used that
revision's `ResourceProvider.prepare` and `ObligationContext.exportState`, so the
current inventory, opening boundary, safety/notch facts, and outstanding duties
are retained together. The old action envelopes were then removed. They are
available in Git at that revision, not maintained as a second test authority.

The fixtures are current trusted inputs, not provenance certificates. Tests must
assert literal expected obligations and observable decisions, validate structural
and position binding failures, and execute actual witness actions through current
Context when checking updates. They must not demand that arbitrary valid current
facts be reconstructed from a historical tape. Recorded action sequences used for
actual gameplay replay remain ordinary test inputs, not a ledger implementation.

Conversion covered 66 snapshots in 45 JSON files. Source observations, witness
paths and reviewed expected outcomes were retained. The user's original 208-line
example is not a converted fixture and was left unchanged.

Two embedded session fixtures (`risky-d-j17` and `pending-L-clear-completion`)
were migrated through that baseline's Session prepare/create boundary to native
schema 2. The already-consumed covered-repair-alternative saved construction was
converted through the baseline finite PlanContinuity converter, preserving its
actual bounded cursor. The retained-support Reset fixture's old resource-binding
string was replaced with the binding of its literal current input; tests still
replay and independently revalidate the saved witness before accepting it.

`unclassified-s.observedActionsBetweenCases` retains only the fourteen actual
inputs between the two saved current observations, verified as the exact old
common-prefix suffix. It is not an imported or replay-authenticated state source.
`sl-allocation-literals` freezes the 32 region/order outcomes checked against both
current SL accounting and the former classifier at the baseline revision.

Six remaining standalone notch tapes were frozen once through the same baseline's
PatternHistory snapshot boundary. Each had zero recorded steps and an origin
board identical to its bound observation (or finite plan origin). Conversion
checks exact resolved status, anchor, protected rows, blocked rows and source
against the current checkpoint. The level-base positive control's Left-only
geometry adjustment preserves that same notch checkpoint. Original file hashes
and semantic comparisons are retained with the external migration evidence.
No historical notch parser remains in the test or runtime dependency graph.
