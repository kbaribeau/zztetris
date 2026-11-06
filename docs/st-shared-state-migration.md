# Shared-state migration progress

This records implementation of the [shared obligation contract](st-shared-state-contract.md). The baseline is `022290b4f10917f6f1831a03c7c907f84f5d356a`. The existing monitoring-boundary fix on that baseline is unchanged. Work remains local until publication is separately approved.

## First checkpoint: current inventory and Center transitions

- `st-public-inventory.js` owns live identity assignment, active/HOLD/preview flow and the incremental public bag frontier. It has no old-piece table, action tape or generator access. A portable current snapshot is imported directly after shape/reference checks, without provenance replay.
- Legacy resource accounting consumes these subjects and retains its old historical allocation/pair archive while those consumers are migrated. At this first checkpoint the inventory was temporarily held by that compatibility layer. The second checkpoint below moves ownership to the real callers.
- The page controller no longer accumulates an `observed[]` draw history merely to recompute bag knowledge. Initial public knowledge is seeded once, each actual reveal advances it, and existing caller snapshots restore it on Undo.
- `st-center-obligations.js` updates current exact Center targets and diversion debts, returning this operation's creation, diversion, closure and pair effects separately. No closure archive is retained in its state. Actual accounting uses that reducer; projected routes share its geometry/payment facts while retaining their own lost-target admission diagnostics.
- Payment, diversion and invalidation remain distinct. A genuine replacement pays the pending and diverted facets once without inventing a second pair. Old resource-summary fields and coaching policies remain compatible.

Focused coverage includes HOLD age and original bags, unknown/deferred/forced supply, trusted inventory snapshots, invalid flows, immutable Undo branches, actual controller reveal/restart/Undo, exact Center payment versus diversion, loss, and same-state repeated cycles. New inventory tests cross 4,200 movement inputs and 700 locks without retaining past identities; the Center component returns to empty current state after each of 1,000 equivalent settlement cycles. These are component lifetime tests, not claims of long simulated survival.

Independent baseline comparisons found identical full resource summaries after 2,066 trial actions and 65 existing replay contexts. Separate frozen-source comparisons covered 142 actual locks and 109 full projected resource states, including S85/L86, Reset L37 and the translated pending-L continuation. Generated comparison scripts and evidence remain outside Git.

## Second checkpoint: caller ownership and compact notch state

The page controller and simulator now own the current public inventory. Each accepted input produces one bounded transition receipt containing the prior/next inventory, locked subject and newly revealed subjects. Resource accounting consumes that receipt rather than applying identity flow again. Receipts bind to the actual public boundary and revision; they are not a journal and are not stored inside the next inventory. Legacy resource replay uses the same adapter internally until its transport is replaced.

The caller checkpoints inventory directly for Undo. Session installation restores the imported live inventory, including public bag knowledge for partial origins, without turning a deduced next type into an invented original bag. Current inventory continues across the legacy accounting cap or an accounting failure; an executed legal move is not rolled back. New tests exercise copied/stale receipts, reused numeric IDs on a new Undo branch, real page and simulator flow, and continued draws after the existing action/lock limits.

`st-pattern-history.js` keeps its public API but emits compact version-2 notch checkpoints: current status, anchor, blocked rows and diagnostic source. Protected rows are derived from the current anchor. Live play no longer stores origin boards or a lock tape and no longer has the old 128-lock limit. The supplied current facts are trusted without proving their history; shape checks and future movement/strategy checks remain.

Old notch tapes remain a compatibility input. They still validate under their original finite contract, then session import/export and the next live update replace them with current facts. The outer session schema stays at version one with a versioned nested checkpoint; an older tape-only reader rejects the new payload rather than silently re-anchoring it. Full resource session accounting is still legacy/replay-backed.

Notch tests cover canonical TSD/quad translation, newly established phases, sticky broken facts, trusted import, invalid shapes, legacy tampering, page/Worker transport and Undo. A 1,000-lock manual O-only cycle retains fixed-size current facts beyond the former tape limit. Independent comparison found 375 identical phase results across 365 locks and ten legacy conversions. Newly added source files are included in simulation source hashes and the worker loader; missing/changed dependency hashes fail frozen-source binding.

## Third checkpoint: isolated S/L and opening account reducers

`st-sl-obligations.js` implements current same-bag counterpart consequences separately from production consumers. A consumed counterpart remains only while an unconsumed counterpart, exact Center target, unresolved first-bag decision or live caller reference can still distinguish it. Once those distinctions end, unresolved consequences move into fixed type/severity counters. Compaction is not payment. Operation-local classification effects preserve a newly uncertain identity even when it immediately becomes an aggregate, so later consumer migration can still distinguish inherited uncertainty from a new loss.

The component preserves the existing asymmetric S/L policies, foundation and first-bag exemptions, foreign-bag payment ordering, pending LO accommodation and exactly-once opening handoff rebase. Trusted snapshots validate their current shape and internal references without proving their history or consulting a board. No live-record count limit is imposed. Numeric representation failures are explicit rather than silently rounding or dropping a consequence.

`st-opening-obligations.js` implements temporary allocation/quality duties, the mandatory opening Z, a net conserved Z balance, sticky eligibility facts and only the active Reset duty. Each actual qualifying Left T credits one Z. Completion emits an effect and retires that Reset's temporary identity and inherited-covered-cell references; it does not award two more credits or retain an episode list. Current facts import directly. Current public identity and exactly-once delivery, Reset selection, unknown-origin observation diagnostics and historical display totals remain caller responsibilities.

These two components are deliberately **not loaded by the page, worker or simulator yet**. They are phase-three building blocks, not replacement planner authorities. Their tests compare canonical current facts against the old classifier over literal transitions and public replays, plus lifecycle size checks. Aggregate uncertainty cannot simply replace the old identity arrays in admission or beam keys. Those consumers and effect-based monitoring must migrate together before production compaction is enabled.

## Remaining migration

The whole migration is not complete. In particular, production S/L and opening/Z/Reset consumers, coupled factual orchestration, safety/Left-goal ownership, trusted complete session snapshots, inverse receipts and effect-based monitoring still need their planned migration and retirement checks. The legacy resource action/lock caps and allocation tape still exist. Do not describe this checkpoint as cap-free resource accounting or as completed trusted session import.

Subsequent work must remove compatibility archives rather than leave the new components as wrappers over old history indefinitely. The standalone S/L and opening account components are not yet planner or actual-accounting authorities.

Full-suite and end-of-block validation results will be recorded after the implementation checkpoint is stable. No real-browser rendering or production-performance acceptance is claimed by these component tests.
