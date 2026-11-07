# Removed historical test contracts

The user requested removal of the old history analysis and migration to current
obligation inputs. This inventory records deliberate retirements, not waived
planner safety checks.

- `st-piece-ledger.test.cjs`: retired the separate observation-only shadow ledger.
  Identity, HOLD, bag binding and partial origins are tested by public inventory
  and current Context; long no-growth behavior is covered by obligation-state-size
  and the 4,100-action current-resource regression. No shadow ledger remains.
- `st-reset-diagnostics.test.cjs`: retired the offline inferred-window diagnostics,
  ambiguity labels, event tape validation and truncation rules. These never granted
  Reset permission. Native Reset accounting/coach/UI tests retain actual entry,
  credit, invalidation, inherited-roof and completion behavior.
- `st-reset-diagnostics-ui.test.cjs`: retired unavailable historical-window
  placeholders and their derivation cache. The actual input/HOLD/Undo, unknown
  position import, ignored forged Reset evidence, restart and visible-only export
  checks remain in `st-current-context-lifecycle.test.cjs`; actual Reset progress
  and safety remain in the Reset coach/UI and current-authority suites.
- `st-resource-replay.test.cjs`: retired the deleted offline resource-analysis
  sidecar, its inferred historical summaries, outer-record ordering and 512-lock
  analysis cap. Native simulator replay still validates action/event/draw and
  request boundaries; current simulation tracking preserves final coverage,
  interruption and authoritative actual obligations.
- Old action/lock tape caps, source timestamps, cumulative pair/credit archives,
  replay caching, and acceptance of legacy session/tape formats are no longer
  supported contracts. Current snapshot import is structurally validated trusted
  data; it deliberately does not authenticate the user's supplied facts by history.
- Native Context/core/SL differential checks no longer compare to removed engines.
  Current actual/projection equivalence, immutable siblings, typed import/receipt
  failures, literal gameplay endpoints, and a frozen 32-case region matrix replace
  those comparisons. The matrix records the reviewed baseline, not a maintained
  second implementation.

The original 208-line user example is preserved outside this conversion. Fixture
provenance is documented in `fixtures/NATIVE-OBLIGATION-FIXTURES.md`.

- `st-resource-tracking.test.cjs`: retired archive mutation and cap-loss telemetry.
  The current transition observer retains unexplained S/L loss, compaction, exact
  Center closure effects, projection mismatch, availability, issue deduplication
  and observer failure checks. A literal established Z balance disappearing is
  still an anomaly, while changing only its profile label is not.

## Native regression mapping

- `st-resource-history` and `st-resource-context`: recorded public inputs now
  advance one current Context. Literal Z balances, delayed Center debt targets,
  exact S/L identities, source eligibility, malformed inputs and caller-owned
  restoration remain assertions. Historical cumulative allocation lists and
  source-event timestamps are retired; lock counts belong to the caller.
- `st-opening-obligations`, `st-obligation-coupling`, `st-obligation-state` and
  `st-sl-obligations`: component transactions, real controller receipts,
  actual/projected equivalence and literal expected endpoints replace comparisons
  against the deleted historical engine. The 32-case S/L matrix remains frozen
  reference data, not executable historical accounting. The 80 multi-bag
  permutations compare ordinary compaction with exact referenced siblings after
  each lock and handoff, and check actual pair/loss identities and exercised
  event categories. This is a current-state conservation check, not a second
  classification implementation.
- `st-reset-resource-history`, `st-reset-coach` and `st-coach-entry-metrics`:
  distinct actual T credits, intervening Z spending, inherited coverage,
  invalidation, retained ordinary alternatives and exact budget charging remain.
  Completion is an emitted effect and immediate coach handback. The current
  account becomes inactive with progress zero instead of keeping paid episodes.
- `st-d-admission`, `st-risky-d` and `st-left-surface`: actual D creation, current
  duty transport, unknown imported origins, immediate J competition and canonical
  page/Worker loading remain. Creator timestamps are retired; extra snapshot
  fields cannot override the typed current duty.
- `st-opening-repair`: hypothetical handoff is an explicit projected query root
  and cannot mutate actual authority or turn unknown history into known supply.
  `st-resource-history-ui` keeps the frozen request/notch compatibility checks
  while independently checking native current transport, identities and Undo.
