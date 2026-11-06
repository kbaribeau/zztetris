# Shared-state migration progress

This records implementation of the [shared obligation contract](st-shared-state-contract.md). The baseline is `022290b4f10917f6f1831a03c7c907f84f5d356a`. The existing monitoring-boundary fix on that baseline is unchanged. Work remains local until publication is separately approved.

## First checkpoint: current inventory and Center transitions

- `st-public-inventory.js` owns live identity assignment, active/HOLD/preview flow and the incremental public bag frontier. It has no old-piece table, action tape or generator access. A portable current snapshot is imported directly after shape/reference checks, without provenance replay.
- Legacy resource accounting consumes these subjects and retains its old historical allocation/pair archive while those consumers are migrated. The inventory is temporarily held by that compatibility layer; full controller-supplied ownership is not complete.
- The page controller no longer accumulates an `observed[]` draw history merely to recompute bag knowledge. Initial public knowledge is seeded once, each actual reveal advances it, and existing caller snapshots restore it on Undo.
- `st-center-obligations.js` updates current exact Center targets and diversion debts, returning this operation's closure/pair effects separately. No closure archive is retained in its state. Actual accounting uses that reducer; projected routes share its geometry/payment facts while retaining their own lost-target admission diagnostics.
- Payment, diversion and invalidation remain distinct. A genuine replacement pays the pending and diverted facets once without inventing a second pair. Old resource-summary fields and coaching policies remain compatible.

Focused coverage includes HOLD age and original bags, unknown/deferred/forced supply, trusted inventory snapshots, invalid flows, immutable Undo branches, actual controller reveal/restart/Undo, exact Center payment versus diversion, loss, and same-state repeated cycles. New inventory tests cross 4,200 movement inputs and 700 locks without retaining past identities; the Center component returns to empty current state after each of 1,000 equivalent settlement cycles. These are component lifetime tests, not claims of long simulated survival.

Independent baseline comparisons found identical full resource summaries after 2,066 trial actions and 65 existing replay contexts. Separate frozen-source comparisons covered 142 actual locks and 109 full projected resource states, including S85/L86, Reset L37 and the translated pending-L continuation. Generated comparison scripts and evidence remain outside Git.

## Remaining migration

The whole migration is not complete. In particular, S/L residual counterpart state, opening/Z/Reset accounts, safety/Left-goal ownership, trusted complete session snapshots, inverse receipts and effect-based monitoring still need their planned migration and retirement checks. The legacy resource action/lock caps and allocation tape still exist. Do not describe this checkpoint as cap-free resource accounting or as completed trusted session import.

The next checkpoint will replace the separate live notch tape with a compact current phase checkpoint while preserving a legacy import adapter. Subsequent work must remove compatibility archives rather than leave the new components as wrappers over old history indefinitely.

Full-suite and end-of-block validation results will be recorded after the implementation checkpoint is stable. No real-browser rendering or production-performance acceptance is claimed by these component tests.
