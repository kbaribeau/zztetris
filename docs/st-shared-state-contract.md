# Shared obligation state contract and migration plan

Status: Implementation started on November 6, 2026 following Kevin's approval. This contract preserves existing gameplay policy; see [migration progress](st-shared-state-migration.md) for implemented scope and remaining work.

Source baseline: `022290b4f10917f6f1831a03c7c907f84f5d356a`, inspected November 6, 2026. Source references describe that baseline, not a completed migration.

## Purpose and review guide

Replace history-backed obligation reconstruction with an obligation-only authoritative core shared by the opening, midgame and Reset coaches. Keep public inventory, generic opening/coach state and plan execution outside it. Obligations must survive coach changes, discarded advice and worker restarts. The core must not contain a piece history or action tape, and its record count must follow current work rather than game duration.

This revision makes the ownership choice explicit, replaces a general Opening section with temporary duties/account eligibility, adds cleanup and size acceptance tests, and identifies the code that the migration must remove or consolidate. The expected result is a simpler accounting/transport subsystem, not a simpler Tetris strategy. Temporary migration adapters should disappear rather than become another permanent layer.

The core distinction is between **an unfinished job**, **the current plan for doing it**, and **whether a proposed route is admissible**. Losing a plan does not establish payment. Accurate tracking does not, by itself, impose a new movement restriction.

The design follows Kevin's direction:

- Trust imported shared state directly, without historical replay or provenance verification.
- Keep piece history out of the authoritative state.
- Supply current public inventory from the controller instead of duplicating it in shared state.
- Represent opening work as temporary obligations and resource-account conditions, not a general opening-state object.
- Use no storage cap to discard live work. A longer history must not add records to an otherwise equivalent current state.
- Pass the piece into Undo. The external inverse receipt described below is a proposed way to supply other information that cannot be recovered from the piece alone.
- Track the underlying Left deficit independently of a replaceable checked repair plan.
- Preserve existing coaching policies during migration. Generalizing D exits or adding new I/L repair strategies is deferred.

For a first review, read **State ownership**, **Size and cleanup contract**, **Migration plan**, **Expected codebase simplification**, and **Review decisions**. The operation/rule catalog and examples define the detailed acceptance criteria.

## State ownership

The game controller owns the board, active pose, HOLD and preview flow, live public identities/bags, private generator, phase, user input and Undo stack. It supplies actual public changes to the obligation updater. The updater owns current obligation and accounting consequences. Coaches read that state and evaluate candidate routes against cloned state and cloned public inventory.

| Concern | Authoritative owner | Boundary |
| --- | --- | --- |
| Board, pose, draw and HOLD flow, public identities | Game controller / rules kernel | Supplied as current public position/inventory and actual event; no hidden future enters coaching |
| Current obligations and accounts | Shared state updater | Updated once for each accepted operation |
| Proposed routes and executable witnesses | Coach / plan store | Bind to a state revision; cannot mutate live state |
| Selected goal and plan association | Goal in shared state; association/reservations in plan store | Goal survives plan invalidation; exact future witnesses and reservation bookkeeping remain outside the core |
| Coach phase, exact-once boundary and request freshness | Controller/session envelope | Supplied to updates; no general coach/session object inside the core |
| Undo receipts and game restoration | Caller | Never embedded as a history in shared state |
| Anomaly counts, optional traces and historical diagnostics | Runner / diagnostic consumer | Not required to decide the next move |

This is one source of truth, not another ledger alongside the old one. During migration, the old ledger may run as a temporary comparison oracle. Once a consumer is switched, it must not independently reconstruct authoritative facts from a different history.

### What the core contains

The logical payload is a set of typed current obligation records. A small version/availability envelope distinguishes known-empty state from partial or missing state. Session identity, semantic Undo token, phase and request epoch are caller-owned envelope metadata, not another core ledger.

"Obligation-only" includes the conserved accounts and conditional consequences required to honor current duties. It does not mean pretending an available resource balance is itself a debt. Use concrete typed records, not a general workflow language or serialized predicates.

| Record category | Current data only | Retirement |
| --- | --- | --- |
| Placement/repair duty | Subject/root reference, exact target or deficit, alternatives and current status | Actual resolution or explicit rule-defined invalidation/supersession; retain any still-relevant consequence |
| Conditional counterpart duty | Residual same-bag relationship needed for a live/deferred counterpart or target | No future reveal, completion, invalidation or boundary can distinguish the relationship |
| Temporary opening duty | Remaining mandatory placements, first-clear cap target or pending quality eligibility with only necessary counters/flags | Resolved or permanently ineligible; transfer any enduring consequence to the account or affected duty |
| Resource account | Current Z allowance/eligibility and required validity flags | Replace current values; never append earned/spent event records |
| Active Reset duty | Remaining qualifying T placements and inherited covered-cell references | Completion/invalidation updates account and phase; no completed-episode list |
| Safety duty | Outstanding covered cells and current reserved notch phase | Fill/clear/uncover or current phase transition |
| Accepted Left deficit goal | Identified current deficit and its completion condition | Actual checked resolution or explicit retirement; selected route is separate |
| Equivalent uncertainty | Fixed-category counts/flags for indistinguishable residual uncertainty | Update or resolve under declared rules; never hide it by deleting details |

No active/HOLD/preview registry lives here. Obligation records contain only necessary subject references, using a stable piece ID or a unique known `(bag, type)` reference. A deferred reference identifies its known bag/type without inventing a revealed piece. The controller supplies the current mapping. Today's raw game state has types/poses but not authoritative IDs, so the migration must move live identity assignment out of resource history into that controller adapter, not merely delete it.

There is no general Opening object. For example, after the first TSD the core may contain `mandatory non-Right Z: 1` and a separate pending allowance-quality condition. Paying that Z removes its duty without optional spending. Once quality is decided, discard its temporary T/Z predicates, S-minus-L imbalance and cap/checkpoint details when no current dependency still needs them. Historical milestone snapshots and source-stage execution tapes are not carried forward. The controller can retain current source-plan progress outside the core; it must not rebuild an unbounded history there.

### Obligation record

Common fields:

- `id`: stable across movement, planning and coach transitions.
- `kind`, `region`, `ruleVersion`: identify the typed lifecycle rule.
- `status`: open, blocked or uncertain; this is not a blanket admission policy.
- `subject`: the relevant piece/root reference, or deferred bag/type expectation.
- `target`: typed completion condition and any exact current cells or alternatives.
- `dependsOn`: other live obligation IDs, not copies of their state.
- `cause`: a compact reason needed to interpret this job, not a list of prior events.

The plan store maps a goal ID to its current route. This avoids making installation of a plan mutate an otherwise unchanged obligation.

Resolution, invalidation, exemption and supersession are distinct transition outcomes. Resolved records need not remain in the live map. The operation result and external Undo receipt carry the information needed to explain and reverse their removal. If an invalidated target leaves an unresolved accommodation or blocks later baseline eligibility, that **current consequence** remains after the obsolete target record is compacted.

For Center, validity of the exact target and whether a partner was diverted are separate facts. For S/L, known surplus, deferred identity and unclassified accommodation are separate states. For a Left repair, the goal is the deficit condition; the particular J and landing belong to its plan.

### Counterpart consequences without piece history

Current inventory alone is insufficient. For example, an S consumed in an unreviewed role may not become classified as unresolved until its same-bag L is later used. The updater must remember the remaining consequence, not recover the old piece from history.

Use a residual record for an unsettled bag relationship: whether each counterpart is unseen, live, settled, awaiting an exact target or unreviewed; relevant root/subject references; and the foundation/handoff exemption predicates still applicable. Cross-bag pairing updates both affected relationships. A held old-bag piece remains attached to its original relationship. A deferred counterpart binds only on actual reveal.

The implementation must derive the smallest sufficient predicates from the current classifier, including consumption ordering that affects foreign pairing and foundation exemptions. Replacing this with balanced S/L counts is not equivalent. Once a relationship cannot affect any current or future obligation, discard it rather than retaining a completed bag record.

Sufficiency test: equal current public position/supply and equal canonical shared state must produce equal obligation results and preserve policy-relevant admission/ranking facts for the same next operation, apart from retired historical diagnostic names. This does not promise identical incidental beam membership under the old history-sensitive keys. A residual relationship is removable only when no later reveal, exact target completion/invalidation or handoff can change its consequence. Test this property before replacing the old classifier's historical inputs.

## Size and cleanup contract

Core size must be a function of distinguishable current work and a fixed amount of rule context, not the number of locks already played. There is no action limit, lock limit, obligation-count cap, age eviction or truncation that makes accounting forget live work. More simultaneously meaningful obligations may require more records; completing them must release those records.

No ever-seen/used-ID set, resolved tombstones, paid-pair list, historical invalidation list, accumulated receipts or past-bag registry belongs in the core. Identifier/token representations need only distinguish relevant live/stale work; they must not encode a growing lineage. The caller owns request freshness and external Undo storage.

A simple position reached after a long run must not carry more historical records than the equivalent short-run position. Current board geometry alone cannot decide every resource obligation, so the comparison includes current inventory, duties and eligibility. This distinction is not permission to keep old objects indefinitely. Genuinely equivalent historical uncertainties must be compacted as described below.

### Cleanup rules

1. Remove resolved placement targets and temporary opening duties. Do not keep their closed records in the core for audit or Undo.
2. Delete settled bag relationships once no live/deferred counterpart, exact target, pending exemption/handoff decision or accepted goal can distinguish them.
3. Keep a remaining balance and necessary eligibility flags, not lists of credited Ts, spent Zs or finished Reset episodes. Controller identity continuity and operation exactly-once handling prevent duplicate credit; Undo reverses the actual transaction.
4. Replace historical invalidations with only their still-applicable current consequences, such as blocked baseline eligibility or uncertain accommodation. Do not treat invalidation as payment.
5. Keep exact identity while it still identifies distinguishable work. Once an old consumed identity cannot affect a future payment or dependency, merge equivalent uncertainty into a fixed set of type/severity counts or flags. Preserve multiplicity where current ranking/status uses it; use a flag where only presence matters.
6. Keep exact newly introduced identities in the current transition effects or short-lived plan comparison, not an accumulating core archive. A count staying unchanged can hide one debt closing while another opens; counts alone do not prove conservation.
7. Remove obsolete plan-store references so finished plans cannot keep otherwise dead obligation objects alive. Optional diagnostics and caller Undo data are separate, with explicit lifetimes, not hidden caches required for current-state authority.

Compacting uncertainty is not resolution or forgiveness. Its adverse current effect remains. Retaining historical identity names for every old uncertainty would require external diagnostic data; normal current-state reporting should use aggregate uncertainty when identity no longer matters.

These rules are not a drop-in deletion of today's arrays. Existing comparisons use identity-sensitive sets. Their replacements must preserve which planning-root obligations remained unpaid and which new consequences were introduced, using transition effects and request-local comparisons before details are discarded.

### Size acceptance tests

- Repeat a literal cycle that returns public position/inventory and all obligations/accounts to an equivalent state. Core record count and normalized serialized size must not grow after many repetitions. Ignore opaque identifier digits and envelope counters when comparing semantics, but inspect retained objects/caches for hidden growth.
- Compare equivalent simple states reached by short and long histories; canonical core records must match after reference normalization.
- Create several simultaneous distinguishable duties, then pay them. The core grows with live work and shrinks when it ends, without dropping any duty prematurely.
- Accumulate equivalent dead-identity uncertainty. The number of core records remains fixed by categories, while required counts/flags stay accurate; no identity list grows per event.
- With an uncertainty bucket already present, introduce another known-to-uncertain transition in a candidate. Preserve that new effect and the existing Reset/ordinary admission distinction even if its details will be merged. Closing one debt while opening another must not pass as an unchanged state solely because counts match.
- Exercise long HOLD, deferred reveal, cross-bag pairing, pending targets and opening handoff before deleting counterpart facts. Prove future transitions still match the uncompressed reference semantics.
- Prune diagnostic traces and caller Undo entries independently. Neither may change current obligations or the next transition.
- Repeatedly accept, invalidate and rediscover a plan for the same current Left deficit. Keep one underlying goal and no chain of stale plan references; separately test two genuinely distinct deficits.

A fixed set of scalar values may change numerically; that is not an ever-growing collection. Do not introduce cumulative counters that no current rule/status needs. The contract is about no historical record growth, not an artificial fixed-bit limit on every exact number.

## Operation contract

Conceptually:

```text
apply(currentState, operation, publicContext)
  -> { nextState, effects, inverseReceipt }

project(currentState, proposedOperation, publicContext)
  -> { projectedState, effects, routeAssessment }

undo(currentState, { piece, inverseReceipt }, restoredPublicContext)
  -> restoredSemanticState

exportState(currentState) -> portableSnapshot
importState(portableSnapshot) -> currentState
status(currentState, callerMetadata) -> compactCurrentStatus
```

These are proposed interfaces, not implemented exports. `publicContext` contains only the before/after public position facts needed by the rules. The core need not retain those boards afterward.

The interfaces describe the combined workflow, not a single all-purpose module. The core transition function consumes obligation records, a meaningful event and supplied public context, returning next records and effects/inverse deltas. Controller code handles transaction tokens, inventory, phase and receipt storage. Coach code handles route assessment and plan applicability. `status` combines obligation results with supplied phase/availability metadata.

Plan applicability binds to relevant canonical obligation facts and public position, not an old allocation tape or the metadata describing its own installation. At atomic plan acceptance, confirm those checked dependencies still match and bind the accepted plan to the resulting state. Installing an external plan association must not immediately stale the plan. Any later change to a relevant target, inventory, reservation or safety fact requires ordinary revalidation; this is not permission to ignore meaningful changes. Compaction must not spuriously invalidate a route or merge policy-distinct states. Removing redundant historical distinctions may change old beam buckets or tie outcomes; measure and explain those differences rather than promising byte-identical search behavior.

Each operation carries its identity, expected semantic token and current caller request epoch. A duplicate operation must not earn a second credit or apply a second target translation. Out-of-order/stale operations fail atomically. A no-op input does not create a semantic transition. The semantic token identifies current content within the Undo lineage; it is not proof of historical authenticity. The caller's separate request epoch rejects stale work even when Undo restores an older semantic token.

### Operation types

| Operation | Required information | Main effect |
| --- | --- | --- |
| Movement | Actual accepted input and public position binding | Controller/plan handling only unless a separate meaningful event occurs; no core accounting change |
| HOLD | Actual identity swap/draw result | Controller updates live inventory; no allocation, credit or payment; any reveal is handled separately |
| Reveal | Newly public identity/type/bag information | Controller extends supply; updater binds matching deferred expectations exactly once |
| Lock | Actual piece identity/type/bag, exact event/cells/clear rows, before/after public context | Update allocations' current consequences, targets, accounts, safety and affected goals atomically |
| Accept goal or replace plan | Goal definition, selected plan reference and checked current-state binding | New goal enters the core if needed; plan association stays external; no actual payment |
| Opening handoff | Accepted boundary and current state | Apply the existing S/L boundary rule once and preserve unrelated duties; controller switches policy owner |
| Begin Reset | Accepted eligible Reset decision | Enter active Reset; no Z credit and no debt erasure |
| Invalidate plan | Plan ID and reason | Plan store removes executable/reservation claim; underlying core job remains unresolved |
| Import or restart | Trusted snapshot or explicit new-session state | Replace state and rebase observers; not a forward gameplay transition |
| Undo | Piece plus external inverse receipt and restored public context | Restore changed semantic state and predecessor token atomically; caller advances its request epoch |

The controller may batch input, reveal and lock effects into one transaction. If it does, their ordering must match the real public flow. The locked piece is the identity consumed before the next draw. HOLD/reveals before a lock cannot be reconstructed from final piece type alone.

### Lock ordering and atomicity

Preserve the existing actual update dependencies: identify the consumed piece from supplied context; update exact Center payments/diversions; apply qualifying Reset progress/credit; update temporary opening allocation and quality consequences; evaluate profile/Reset invalidity; update covered cells and notch phase; update D; update S/L residual classifications, coherently with the controller's inventory transition. Eligibility that depends on a later substep must use the same boundary as the existing code, not whichever intermediate state is convenient.

Only the completed transition is visible. A lock that pays one target, creates another and earns a Reset credit cannot publish half of those effects. The migration tests must explicitly cover these coupled cases, including ordering-sensitive opening quality and consumed-counterpart classification.

Malformed/stale operation input must not partially install shared state. If a real game move has already committed and accounting fails, preserve the legal game result but mark accounting unavailable at that boundary and emit the monitoring failure; never present the old ledger as current or silently roll back the player's move.

### Facts and route assessment

Actual legal player moves are recorded even when unsupported by a coach. The updater does not reject a legal game move because its strategy is poor. A projected route uses the same factual transition rules, then the existing coach-specific admission checks.

Keep proposal-only context outside persistent facts. In particular, `pendingLDiverted` means this candidate spent a usable L and cannot claim a missing-partner waiting exception. Current tests allow a later fresh request to reconsider the real still-pending target. Turning this flag into a permanent ban would change policy.

Similarly, Center invalidation can be one shared fact while ordinary projection remembers that the proposed route newly lost a target. Preserve the current admission distinction rather than forcing actual-state reporting and projected-route acceptance into one boolean.

## Carry and resolution rules

The following rules preserve the inspected implementation unless explicitly labelled as a proposed representation change.

### Opening allocation and quality

1. Track two opening non-Right zero-clear Ts, one mandatory non-Right zero-clear Z, and the Right cap. Actual accounting's non-Right region is columns 0 through 6. Opening coaching's narrower Left-T grammar remains a separate admission rule.
2. The first canonical third-T Right TSD must remove the recorded original cap roof to establish the allocation checkpoint. The mandatory non-Right Z may still be owed afterward.
3. The first subsequent qualifying non-Right Z pays that opening duty. Later canonical TSDs do not erase it. Additional non-Right Zs are optional account spending, not repeated payment.
4. Allocation completion, quality eligibility and handoff are distinct facts. Preserve the existing pre-clear and delayed-quality paths, including their different predicates.
5. Quality uses equal Center heights, equal actual S/L counts and a Left/Center height difference no greater than three. Delayed baseline eligibility is barred by intervening optional Z, T diversion/profile departure, pending Center work, relevant invalidated diversion debt and unresolved S/L.
6. A failed or changed plan never manufactures an allocation/quality checkpoint. Preserve the separate resource `sourcePattern` milestone that current accounting establishes on an actual exact diagram match. That milestone alone does not establish allocation, quality or executed source-plan progress; accepted source-stage progress remains a separate current consequence.

### Opening handoff

Known mandatory Z still owed blocks handoff. Preserve actual-clear geometry plus checked maintenance admission, and the separate historical/no-current-clear path requiring completed allocation and eligible baseline. Do not replace both with a universal baseline prerequisite.

At the accepted boundary, apply the same-bag S/L rule once:

- Both consumed: settle the opening pair relationship without demanding an actual SL pair.
- One consumed: carry its unused counterpart, including held or not-yet-observed identity.
- Neither consumed: no inherited surplus.

Do not rebase Center, covered cells, D or Z accounts. The first maintenance probe must see the same boundary state that actual acceptance will install. Failed probes must not mutate live state. Imported snapshots already containing the boundary do not reapply it.

### Extra Z and Reset

The conserved account is `remaining = openingAllowance + earnedResetCredits - optionalZSpent`. Unknown eligibility is not zero and is not an allowance. Right cap Z is independent of this balance. A piece spanning Left/Center spends once.

Reset entry requires the existing eligible exhausted account and public support/arrival-risk decision. Entry gives no credit. Each distinct actual qualifying zero-clear Left T gives one credit; the second ends Reset immediately. Completion adds no extra award and does not require a balanced endpoint or later TSD. Preserve current dispatch preference for certified ordinary scoring or retained repair before starting a new Reset.

Wrong T role, noncanonical clear, top-out, profile departure or overspend invalidates Reset under existing rules. Later credit does not erase earlier invalidity. Existing S/L, Center and covered obligations carry through Reset. Keep the inherited-covered subset separate from newly created Reset roofs. Reset admission remains stricter than ordinary admission about a known S/L becoming unclassified and newly lost Center targets.

### Center

Supported ordered families are S→L, L→O, O→J, Z→J and J→Z. Create the exact currently supported target alternatives with their root relationship. Geometry-only origins may have anonymous targets; they do not invent known root identities.

Payment is the actual matching partner type at the exact currently supported cells. Translate surviving targets through clear rows once. Preserve the special retained exact-SL target after a clear removes the general recognized motif; anonymous or lost targets do not acquire that exception.

Using an available required type elsewhere can create diversion debt. Losing the original target is invalidation, never payment. Retain its consequences for S/L classification, baseline eligibility and current diagnostics. A fully removed invalid target must not be reported as an executed partner completion. Current projected-loss admission remains a route assessment, separate from the actual invalidation record.

### S and L

- A non-Right L consumed outside its own pair can leave its same-bag S owed. Foreign-bag SL payment settles the root S while updating the consumed L's own counterpart relationship.
- A surplus S is paid only by its actual Left consumption or exact SL pairing. Unreviewed consumption or target loss becomes uncertain accommodation, not spare supply or silent payment.
- S used Left, or paired with a foreign L, can leave its unused same-bag L owed. An L already consumed before that event is not retroactive surplus.
- Surplus L is paid by its actual Left consumption, SL partner use or exact LO completion. Pending LO keeps the accommodation open; lost LO becomes uncertain.
- Preserve deferred identities, old held-bag identities, narrow foundation exemptions, and the distinction between generic uncertainty and known-surplus accommodation that became unreviewed.
- Preserve the current asymmetry: Hanging L is diagnostic, not a mirrored S-repair search or a blanket ordinary-placement rejection.

No change to these classifications permits one actual piece to pay two incompatible placements. Cross-bag relationships must update together. Multiple obligations must remain distinct even when they share a letter or an aggregate count.

### Left D

Keep D separate from the deficit-repair goal below. Existing actual behavior creates D on a non-D→D lock, carries D→D, and clears the flag on any actual non-D result. Supported planning still checks current D even without a known creator.

Preserve the current checked immediate J, one exact Center payment then J, and checked immediate I exit grammars, including headroom, access and competing Right-I restrictions. This contract does not generalize D or infer new L/I alternatives. Handoff and plan loss do not themselves pay D.

### Left repair goals

**Proposed representation change implementing the requested goal/plan separation:** persist the accepted underlying Left deficit with a stable goal ID. Exact payer, landing and input route are a replaceable plan for that goal, not the definition of the goal itself.

Create this selected goal when the coach's checked repair is accepted for execution. Do not turn every optional surface improvement listed by geometry into mandatory debt. The first supported rule is the existing deep-deficit partial repair: improve a column at least three rows below the reference peak, keep new cells at or below that peak, reduce roughness and create no covered cells, together with the existing endpoint/resource/access checks. This is a finite partial improvement, not a promise to flatten all of Left.

The goal payload needs the affected columns/deficit region, current coordinate lineage, reference profile and named completion rule. The selected plan stores J identity, exact target cells, resulting profile, reservations and witnesses. The initial implementation must supply literal goal fixtures defining which defect is being repaired; an unrelated roughness reduction elsewhere cannot pay it.

A replacement must address the same tracked deficit and pass the existing supported repair grammar, resource obligations, cap/cleanup precedence, access and endpoint checks. Replace the plan atomically, retaining the goal ID and updating reservations. A budget miss, stale plan, changed supply or spent J leaves the goal open/blocked; it is not payment. A manual actual move can satisfy the goal only if the same declared completion condition is established from its actual result.

Rediscovering the same current deficit reuses its existing goal rather than creating another record. Changing plans must not accumulate duplicate goals, old reservations or superseded-plan links. If clear translation or other changes establish that two blocked goals now describe the same current work, reconcile them explicitly, remap live references and preserve the merged consequence in the inverse receipt. Do not keep a permanent alias/tombstone list. Distinct simultaneous deficits remain distinguishable; canonical matching must not merge unrelated jobs merely because both are in Left.

The contract permits replacement, but does not authorize broader candidate generation, new I/L repair strategies or a new global admission ban. Migration must distinguish tracking-only differences from selection changes. An unchanged valid selected plan retains its current exact identity/landing guarantee.

Line clears translate the goal's surviving region. If the relevant deficiency disappears by a clear, record a distinct `removed-by-clear` outcome only when that disappearance is established; do not invent a J payment. If identity of the original deficit can no longer be determined, retain a blocked/uncertain goal for explicit reconciliation rather than silently resolving it. This target-matching detail is a review item below.

### Safety and other selected goals

Covered-cell debt uses exact cells. It resolves when filled, cleared away or genuinely uncovered; movement access alone is insufficient. Preserve the defined unfinished Center-partner stage exception, not a general exception for Left roofs.

Carry established notch phase directly. Translate surviving reserved rows after clears; only the current canonical TSD may consume its arm notch. Preserve current checks for broken/conflicting phase and nonclearing phase loss.

Derive current Right cap, I cleanup/preparation and scoring-access duties from the restored/current board. Preserve distinct-piece replacement exceptions already proved by Left foundation and paired-repair construction. Hypothetical access establishes neither arrival nor payment.

Other selected commitments retain their existing typed goals: opening parity/Center repair, finite foundation, visible closure, source stages/scoring, Center preparation/completion, Left foundation, Hanging-S accommodation, TSD/quad schedule, I-pocket preparation and covered repair. Existing same-goal and scoring-timing replacement conditions remain. Transient forecasts are not obligations. General durability of every optional selected goal is not introduced implicitly by the Left change; retain each existing lifetime until its own rule is specified.

## Trusted import and export

Export a versioned snapshot of current obligations/accounts, with no old pieces, old boards or action tape. The session envelope separately carries current public position/inventory and controller phase; it must preserve the references used by obligations. Import accepts those contained facts directly. It does not replay history, authenticate provenance, recompute earned allowances from past moves, or downgrade known imported facts merely because they were imported.

Basic parsing and supported-version dispatch are necessary to interpret bytes, not verification of their truth. Unsupported versions fail clearly or use an explicit version migration. A position-only import with no obligation payload still has missing accounting information; do not invent it from geometry.

Plans are separate: importing a pending goal does not certify a future move. Recompute or revalidate executable advice under ordinary current-position rules before displaying it. An unavailable or incompatible saved plan must not delete compatible imported obligations. Import/restart rebases monitoring and clears the current controller Undo stack as today.

Legacy session/action-tape migration is an adapter outside the core contract. New state authority must not depend on keeping that adapter or its history alive.

One current consumer needs an explicit replacement: retained handoff recovery compares historical context prefixes and exactly one actual intervening lock. Replace that connector with a bounded controller/plan-store receipt linking the relevant before/after semantic states and exact actual lock, with the same public identity/result checks. It is a transient one-lock continuity fact, not a shared-state history or resource permission. Clear it on import/restart and after its permitted recovery window, as current transient routing does; trusted imported obligations remain valid independently of it.

## Undo

### Proposed external inverse receipt

The piece supplies identity, type, bag and the actual lock/event information. It does not reveal a target deleted by payment, the former notch phase, or the earlier value of a sticky eligibility flag. Reversal therefore needs externally supplied information in addition to the piece.

On apply, return an immutable inverse receipt containing only affected before-images/deltas:

- IDs created by this transaction and prior versions of changed/deleted obligations and residual relationships.
- Old values of changed accounts, temporary-duty eligibility fields and goal records.
- Target and safety changes that cannot be reconstructed from the restored public board.
- Deferred subject bindings changed by a reveal; controller-owned inventory/phase and plan-store restoration belong to their corresponding caller receipts.
- Operation identity, before/after semantic tokens, session identity and receipt version.

The receipt lives in the caller's Undo stack, never in authoritative state or the normal exported snapshot. It is not a second current ledger. Compose command receipts into the existing placement boundary: before the first effective movement/HOLD of that turn, through reveals and lock. Include accepted handoff, Begin Reset, goal/plan changes and any partial actions on the next piece that occurred before Undo is invoked. Undo returns to the saved placement checkpoint, not merely the instant before HD. Empty HOLD must restore the prior draw/frontier and deferred identity binding, not merely swap active and held pieces.

Undo checks the caller-owned stack cursor, session and expected current semantic token, then restores before-images and the receipt's predecessor semantic token atomically. The caller increments its request epoch instead of rolling it back. If A produced token a and B produced token b, undoing B restores a; the next older receipt for A can therefore still be applied despite the fresh request epoch. Coalescing or reversing intervening commands brings the state to each receipt's expected semantic boundary first. New forward play after Undo starts a new receipt suffix and discards any redo suffix; older reachable Undo checkpoints remain usable.

Do not accept a receipt twice, apply one to a different session, or resurrect stale worker advice. These are consistency checks on the Undo operation, not historical verification of imported state. Tests must cover repeated Undo, Undo followed by new forward play, and old worker results arriving after both.

The caller restores board, cleared-row contents, active pose, HOLD/preview/bag position and draw cursor using its game Undo data. Preserve the existing private future sequence rather than rerolling. Plans restored from receipts are candidates for current-position validation; displayed advice and transient forecasts are cleared. Monitoring rebases at the restored state instead of reporting ordinary backward changes as losses.

### Example

Before a lock, Center root C is pending, S is known surplus and the Z balance is zero. The actual move can complete C, settle S, translate another target and establish a checkpoint. Undo receives the piece plus that transaction's inverse receipt, restores those particular prior facts and removes effects created by the move. It does not search old pieces or attempt to infer the old state by subtracting one from counters.

## Monitoring and status

`effects` are internal transition results used for accounting, inverse construction and invariant checks. They are not an unbounded public event log. Normal creation/payment does not emit a subscribed anomaly event.

The actual-session observer checks lifecycle conservation: every removed/changed obligation has a declared transition, balances agree, bindings are coherent, handoff carries required jobs and projected/actual consequences agree where they should. Faults emit compact deduplicated anomaly events. Hypothetical branches and import processing do not emit gameplay anomalies.

Observer/subscriber failure is separate from accounting failure. Quarantine a failed listener and report diagnostic health without rolling back the move or invalidating successfully committed accounting. A failed status consumer must not turn known obligations into unavailable state.

Current append-only history-loss checks must be replaced before legitimate compaction is enabled; otherwise deletion of settled history would be falsely reported as tracking loss. Retain independent fault-injection tests and literal transition expectations so using the same reducer twice is not mistaken for independent proof.

End-of-run obligation status comes directly from the core: known, uncertain and blocked duties and accounts. The caller adds current phase and accounting availability. Distinguish a run stopped at its simulation cap from a complete gameplay outcome, and partial/unavailable status from zero obligations. A simulation stopping cap is unrelated to a storage cap. Normal runs need compact counts/status, not every lifecycle event in traces or Git.

## Worked acceptance examples

1. **Late opening Z:** third T scores before mandatory Z. Z remains owed after another TSD. Actual first non-Right Z pays it without optional spending; quality and handoff remain separately evaluated.
2. **Handoff with held L:** S was consumed during opening, its same-bag L is held. Boundary creates/carries that exact L accommodation. A second handoff call changes nothing. Center and covered debt survive.
3. **Latent consumed S:** S85 has an unreviewed consumed disposition but no current surplus yet. Later same-bag L86 consumption produces unclassified S85. No piece history is consulted.
4. **Foreign pair:** L from bag B pays S from bag A. A's S closes; B's own S consequence remains/appears. No duplicate or fabricated identity is introduced.
5. **Lost Center target:** a move destroys an exact SL target. Report invalidation, preserve any applicable unresolved accommodation and baseline consequences, and assess proposed-route loss separately. A baseline blocker specifically depends on relevant diversion debt invalidated since the allocation checkpoint; accommodation depends on the counterpart relationship. Do not report fulfillment.
6. **Pending LO:** a known hanging L enters supported LO. It remains pending accommodation until actual O payment; losing LO becomes uncertain, without inventing mirrored L repair search.
7. **J23 repair:** accepted L→Z→O→J route has a persistent Left goal and plan reserving J23. L/Z/O keep the job open. A stale route loses plan applicability, not the job. A checked replacement retains the goal ID. Actual qualifying repair resolves only that job, leaving unrelated S15 uncertainty.
8. **D:** D→D carries the flag, actual non-D clears it under current rules. A plan's failure does not clear it. No new generalized D strategy follows from the Left-goal contract.
9. **Reset:** first qualifying Left T adds one credit; second adds one and exits Reset. No extra completion award. Undo of the second restores active progress one and the previous balance, with all unrelated jobs intact.
10. **Coupled Undo:** a clearing lock pays one target and removes/translates others. Piece plus inverse receipt restores every affected record, the pre-turn HOLD/draw state and counters, with a fresh revision and no stale worker response.
11. **Trusted snapshot:** import a known pending Left goal and account with no history and no plan. Keep both facts. Fresh advice still passes ordinary movement and strategy checks.
12. **Long run:** repeat cycles returning to equivalent current work without growing core records. Prune optional traces and external Undo receipts without changing obligations. Inject an unexplained disappearance to prove the anomaly subscriber still detects it.
13. **Obsolete identity:** an old unclassified S has no live counterpart, target or plan reference. Merge it into the appropriate uncertainty category without claiming payment or removing its eligibility effect. Introducing a new known-to-uncertain S in the next candidate must still produce a distinguishable transition.
14. **Opening retirement:** finish mandatory placements and settle quality eligibility. Remove temporary opening counters and the original cap target; retain only the resulting account condition and any independently live counterpart duty. An equivalent later position has no accumulated opening archive.
15. **Repeated advice:** discard and rediscover the route for one unchanged Left deficit many times. Reuse the same live goal; do not append another obligation for each accepted recommendation.

## Review decisions

The strategic direction is settled: an obligation-only core with controller-supplied public inventory, temporary opening duties/accounts, trusted imports, no piece history or duration-driven record growth, underlying Left deficit separated from its replaceable checked plan, and no D generalization during migration. There is no proposal for a storage cap.

The draft proposes these concrete defaults for Kevin's review:

1. **Undo payload:** piece plus caller-owned inverse receipt; preserve existing turn-level Undo. Piece alone cannot reverse removed/overwritten state.
2. **Left goal activation:** create the durable selected job when a checked repair is accepted, not for every possible surface improvement.
3. **Left goal equivalence:** replacement must repair the same identified deficit under the current partial-repair rule and existing safety/resource checks. Literal fixtures must pin down affected-region identity and clear translation. No generic roughness improvement or new I/L grammar counts by itself.
4. **Clear removal:** a demonstrably removed Left deficit may retire as `removed-by-clear`, distinct from a placement payment; ambiguous remapping remains unresolved. This is proposed lifecycle semantics, not an existing exact-J-plan rule.

There is no request to decide existing S/L asymmetry, opening handoff exemption, Z credit arithmetic or D retirement again. If implementation discovers that a compact predicate cannot preserve those rules, bring that specific conflict back rather than silently simplify it.

## Migration plan

The migration is incremental, but its end state has one factual updater. A phase is complete only when its acceptance checks pass and its temporary duplication has an identified removal point. Keep changes local until separately authorized for publication.

### Phase one Freeze semantic expectations

Build literal before/event/after fixtures for every catalog rule, the size examples and the consumed-S85/later-L86 projection mismatch plus Reset L37 known-to-unclassified regression in `test/st-resource-projection-parity.test.cjs`. Define canonical comparison views that preserve counts, eligibility, exact live subjects/targets and transition outcomes without demanding historical-ID strings for compacted uncertainty. Include ordinary versus Reset admission and ranking, not just state shape.

Exit: each retained field has a named current consumer and retirement condition; every discarded historical field has either no current effect or an explicit compact replacement. Do not claim a minimal schema is proved just because it is shorter.

### Phase two Establish controller supplied context

Move live piece identity/bag flow to a small controller-owned adapter. Supply only active/HOLD/preview and known public frontier to actual updates and projected clones. Preserve original bags across HOLD, deferred reveals, forced-public uncertainty and Undo. Do not reintroduce a resource-history table as the adapter. Update bag knowledge incrementally rather than retaining the controller's `observed[]` array solely to rederive its frontier.

The session envelope owns phase, exactly-once boundaries, semantic token and request epoch. Current position/inventory and obligations must export/import together with consistent reference names; imported facts remain trusted.

Exit: identical public flow and piece subjects on existing tests; no hidden generator/future enters requests; no duplicated authoritative active/HOLD/preview registry in the obligation core.

### Phase three Implement factual transitions and cleanup

Implement the concrete typed obligations/accounts, using existing geometry and rule helpers. Consolidate actual Center/S/L/Z/Reset/opening/safety consequences behind one pure transition path. Add compaction as part of the lifecycle, not as a later memory optimization. Keep current identities only while distinguishable and fold obsolete uncertainty into policy-equivalent categories.

Temporarily compare with the old actual ledger on existing public replays within its current limits. Keep that oracle outside the new state. Beyond those limits, use independent literal transitions and repeated semantic cycles; absence of an old-ledger answer is not proof the new state is correct.

Exit: factual parity and cleanup/sufficiency tests pass, including all coupled payment/creation/clear events and sticky eligibility. Core state remains independent of optional traces and grows/shrinks only with current work.

### Phase four Migrate projection and coaching consumers

Have speculative branches call the same factual transition function on copies. Keep route-only context, admission and search in the coaches: pending-L diversion, newly lost targets, known-to-uncertain Reset rejection, scoring schedules and resource competition. Change bindings, beam keys and root-obligation comparisons to canonical state plus current transition effects instead of historical arrays.

Represent opening duties as temporary records; source-plan progress remains current controller/plan context, not a shared Opening object. Update badges, status and explanations to read selectors over the new records. Aggregate obsolete uncertainty honestly rather than invent historical piece names.

Exit: equivalent typed eligibility, admission, ranking facts and retained-plan applicability for matched frozen candidates. Report any changed selected route, including changes from canonical beam keys or ties. Behavioral divergence is explained and separately reviewed; do not silently loosen rules to obtain parity or blame every difference on runtime budgets.

### Phase five Transport Undo and finite continuity

Replace replay-authenticated obligation import/export with trusted current snapshots. Implement caller-owned inverse receipt composition, multi-Undo, partial-next-turn reversal and fresh worker epochs. Replace the one-lock handoff-recovery history-prefix connector with its bounded transient receipt. Retain normal validation of future executable advice.

Legacy action-tape imports, if retained, use an explicit adapter that ends by producing current state; the live engine must not consult that tape afterward. Do not require legacy support to preserve new snapshot authority.

Exit: state and game/controller context round-trip exactly, without stale worker resurrection or double handoff/Reset credit. Missing/incompatible plans leave imported duties intact. No full past tape is required for a new-format session.

### Phase six Separate the Left goal from its route

Persist accepted underlying Left deficits while leaving exact piece/landing/witness reservations in the plan store. Implement explicit checked replacement and lifecycle outcomes using the existing repair grammar. Do not introduce new I/L candidates, generalize D, or turn every optional improvement into a hard debt.

Exit: the J23 fixture, plan invalidation, replacement, clear mapping and Undo tests preserve the underlying job. Distinguish the intended tracking change from any proposed route-selection change.

### Phase seven Remove duplicate machinery and complete acceptance

Replace append-only history-loss monitoring with effect/conservation checks before enabling production compaction. Remove obsolete actual/projected bookkeeping, replay caches, history-derived bindings and accounting caps. Remove temporary parity adapters from the production path. Decide separately which historical diagnostic displays remain optional external features; do not retain full accounting history for a small badge or explanation.

Exit: one source of current facts, no lifetime history dependency, no cap that changes accounting availability, no record growth in the size tests, and independent fault-injection coverage. A wrapper over the old histories does not satisfy this phase.

### Final acceptance

- Complete unfiltered unit suite, exact public replays and independent literal transition/fault tests.
- UI/controller tests for actual HOLD/reveals, advice-hidden play, import, phase boundaries, repeated Undo, new forward branches and stale workers; relevant real-browser checks remain separate from DOM tests.
- Canonical no-growth tests after short and long equivalent runs, plus genuinely complex current-obligation cases and compaction of obsolete uncertainty.
- Matched bounded simulations with frozen seeds, metrics, caps and baseline/candidate revisions. Routine diagnostic batches may use four workers; production timing comparisons remain controlled/serial. A stopped simulation is censored evidence, not a memory-bound test by itself.
- Monitor performance, but do not make optimization or a performance threshold a merge blocker. State-lifetime correctness and lost obligations are correctness requirements, not deferred performance work.

The contract was independently reviewed before implementation. Subsequent code, validation and remaining phases are recorded in [migration progress](st-shared-state-migration.md).

## Expected codebase simplification

**Yes, this is likely to simplify the accounting architecture and session transport once the old paths are removed. It will not remove the hard strategy/search rules, and net line-count reduction is not yet measured.** The migration will temporarily be more complex while old/new comparison exists.

| Current complexity | Intended end state | What must remain |
| --- | --- | --- |
| `st-resource-history.js` stores lifetime pieces/allocations/pairs, reconstructs classifications and authenticates replay contexts | Replace with current typed transitions/selectors; remove history capabilities, WeakMap caches, linked tape, replay imports and action/lock truncation | Actual allocation rules, identity continuity at controller boundary, unknown/partial handling |
| `st-midgame-resources.js` reconstructs `slHistory` and duplicates factual progression for speculative branches | Call the shared reducer on a clone; remove parallel Center/S/L/Z accounting and history-dependent bindings | Repair search, partner accessibility, proposal-only flags and coach admission |
| `st-pattern-history.js` replays a past board/lock tape to recover notch phase | Carry the current notch obligation and update it once | Exact notch translation and safety checks |
| `st-session.js` replays history, bag provenance and markers to restore obligation authority | Import/export trusted current payload plus controller context | Version handling, atomic installation, future-advice validation and an optional legacy adapter |
| UI/runner invoke several state reconstructions and pass large historical contexts | Update current facts once, publish selectors and small transition effects | Real public inventory, asynchronous freshness, counters/status and caller Undo |
| `st-resource-tracking.js` scans append-only identity/allocation/pair/closure arrays | Check explicit lifecycle outcomes and conserved balances, with independent fault tests | Anomaly subscription, deduplication, observer isolation and honest final status |
| Retained handoff recovery compares full tape prefixes | Bounded one-lock continuity receipt outside the core | Exact current applicability and public result checks |
| A separate shadow piece ledger duplicates observations for diagnostics | Retire duplicated evolution where selectors/effect subscribers provide the required display; otherwise retain only an explicit optional diagnostic with no coaching authority | Any still-needed independent diagnostic checks, not a second authoritative ledger |

The main gain is fewer places that must agree about whether a debt exists or was paid. Changes to a factual rule should not require matching edits to history reconstruction, hypothetical reconstruction, transport replay and diagnostic reconstruction.

Necessary complexity remains: typed conditional duties, exact targets and clear translation, S/L exemptions/counterparts, conservation, different ordinary/Reset admission, movement and access proofs, and safe plan retention. External inverse Undo and persistent Left-goal identity add real responsibilities. They should be small explicit components, not a generic event-sourcing framework, a configurable rule language or an additional parallel ledger.

Do not claim whole-file deletion merely from current line counts. The planner and opening modules contain thousands of lines of strategy/search that remain. Before calling the migration simpler, verify that old entry points and their live dependencies are actually removed, count independent transition implementations, and review the new call paths. Avoid trading fewer lines for less explicit correctness checks.

## Source map

References are relative to this repository and the baseline named above.

| Topic | Implementation | Existing test foundations |
| --- | --- | --- |
| Opening allocation and baseline | resource history (retired implementation), lines 94–142 and 313–334 | [opening baseline](../test/st-opening-resource-baseline.test.cjs), [quality priority](../test/st-opening-quality-priority.test.cjs) |
| Opening handoff | [opening coach](../st-opening.js), lines 734–783; [controller](../st-lab.js), lines 134–143 | [handoff boundary](../test/st-handoff-sl-boundary.test.cjs), [opening allocation](../test/st-opening-allocation.test.cjs) |
| Center | resource history (retired implementation), lines 39–71; [structure](../st-structure.js), lines 129–150; projection (retired implementation), lines 47–99 | [retained SL after clear](../test/st-pending-L-clear-completion.test.cjs), [resource history](../test/st-resource-history.test.cjs) |
| S and L | resource history (retired implementation), lines 245–311; projection (retired implementation), lines 100–168 | [projection parity](../test/st-resource-projection-parity.test.cjs), [opener SL](../test/st-opener-sl-tracking.test.cjs), [deferred SL](../test/st-deferred-sl.test.cjs), [unclassified S](../test/st-unclassified-s.test.cjs) |
| Proposal-only waiting | projection (retired implementation), lines 247–282 | [pending L stage](../test/st-pending-L-stage.test.cjs), lines 99–106 |
| Reset | resource history (retired implementation), lines 73–92 and 192–199; [Reset policy](../st-reset-policy.js); [Reset coach](../st-reset-coach.js), lines 31–87 | [Reset history](../test/st-reset-resource-history.test.cjs), [Reset coach](../test/st-reset-coach.test.cjs) |
| D exits | [planner](../st-planner.js), lines 24–183; [Left context](../st-left-context.js), lines 86–115 | [D admission](../test/st-d-admission.test.cjs), [delayed J](../test/st-delayed-J-plan.test.cjs), [checked I](../test/st-checked-I-exit.test.cjs) |
| Left deficit | [structure](../st-structure.js), lines 91–125; [planner](../st-planner.js), lines 413–449 and 2638–2700 | [visible Left repair](../test/st-visible-left-repair.test.cjs), [fresh maintenance](../test/st-fresh-maintenance-handoff.test.cjs) |
| Other selected goals | [opening coach](../st-opening.js), lines 122–330 and 363–654; [planner](../st-planner.js), lines 565–642 | [opening repair](../test/st-opening-repair.test.cjs), [opening closure](../test/st-opening-closure.test.cjs), [source scoring](../test/st-source-scoring.test.cjs) |
| Safety | [access](../st-access.js), lines 5–71; [structure](../st-structure.js), lines 211–310; [pattern history](../st-pattern-history.js) | [covered repair](../test/st-covered-repair-plan.test.cjs), [future notches](../test/st-future-notch.test.cjs), [cycle](../test/st-cycle.test.cjs) |
| Undo and transport | [controller](../st-lab.js), lines 221–274; [current session format](../st-session.js), lines 55–79 | [Undo](../test/st-undo.test.cjs), [resource context](../test/st-resource-context.test.cjs) |
| Current inventory and diagnostic duplication | piece ledger (retired implementation), lines 16–26 and 57–93; [bag inference](../st-bag.js); [controller](../st-lab.js), lines 175–195 | [handoff boundary](../test/st-handoff-sl-boundary.test.cjs), [deferred SL](../test/st-deferred-sl.test.cjs) |
| One-lock handoff recovery | [planner](../st-planner.js), lines 2504–2519 | [handoff recovery UI](../test/st-handoff-recovery-ui.test.cjs) |
| Monitoring | resource tracking (retired implementation), lines 29–92 and 94–134 | [tracking tests](../test/st-obligation-tracking.test.cjs) |
