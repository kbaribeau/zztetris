# Movement access and observed scoring-pattern continuity

This change addresses two independently replayed development failures. It is not a full Reset coach or a guarantee of indefinite play.

## Actual piece access, not empty-cell flood fill

A connected empty cell can still be unreachable by any tetromino. In development stream 502400001, S at lock 13 roofs column 3, row 3 above the floor. Empty-cell flood fill still reaches it through the neighboring shaft. Complete legal movement enumeration finds no current placement of any piece that fills it.

The coach now checks newly roofed cells in the Left and Center for every lock in a proposed finite prefix. It first eliminates piece types with no grounded geometric fit, then enumerates actual movements from a fresh spawn under the current rules. A negative complete result rejects the prefix; a search interrupted by its time/node budget is unknown and cannot certify advice. Complete results are cached by occupied geometry, target cells, and rules profile. Existing scoring notches are excluded, with exact row translation through clears; Right-region reservoirs remain under their separate rules.

A positive result proves current physical access by hypothetical pieces. It does not prove those pieces are available, that each target can be filled simultaneously, or that the resulting strategy is sustainable. This guard detects newly roofed cells, not every possible loss of access to a cell that was already roofed. It also does not claim a current negative is impossible under every future change to kick geometry. An explicit later-clear or blocker-assisted repair exception is not implemented.

Independent source scan: all 31 newly roofed candidate transitions across 3,448 recorded placements had actual access witnesses (Sprint 0, Ultra 0, mirrored Marathon 4, 1000-line reference 27). These are geometry/movement controls, not reconstructed original preview or hold observations.

Two older inferred regression routes were unsound under this stronger check:
- The earlier 3A Z-left/L-center/double route completed the Center but trapped a Left cell. The double translated, rather than repaired, that vacancy.
- An older saved-T route roofed a Center cell that its later double also failed to repair. Its resource goal no longer overrides movement-access safety.

Neither route was a canonical recorded-reference move. Their old exact-winner assertions are replaced by explicit negative access controls; safe commitment lifecycle tests remain separate.

## Keep independently observed notch phase through clears

In development stream 505751329, quad 74 translates the established scoring anchor from row 34 to row 38. Surviving Right-region material makes fresh geometry recognition unanchored, but that is not evidence that the old scoring pattern ceased to matter. The next L filled a protected column-7 notch when planning forgot that history.

A small session proof now retains an established origin board and actual lock poses/events. The worker regenerates the phase by legal replay and exact clear translation. It does not trust a supplied anchor number. Normal matching geometry rebases the proof; invalid evidence abstains rather than silently forgetting the constraint. The proof is bounded to 128 transitions.

The actual page and simulation controller update this proof after each lock and preview replenishment, including manual moves. Cosmetic movement and hold preserve it. Undo restores the corresponding prior proof. Reset or import reconstructs from the new board; imported arbitrary history fields are ignored. Returned finite advice and retained commitments are checked against the resolved phase.

This fixes the late history loss, not all earlier strategy in that stream. Earlier unmatched Left T use, a later covered Left cell, and an unusual J above the Right cap remain separate causes to investigate. The paired-T counterfactual before lock 51 worsened its matched finite continuation, so no universal paired-T priority is justified.

## Frozen seven-stream development pilot

A production-budget pilot compared `493b82a` with the already observed `c209e600` traces, using the same seven saved streams and a 150-lock cap. All 424 new locks replayed exactly. No illegal recommendation, pattern-policy violation or top-out occurred; all seven eventually abstained.

| Seed | Earlier stop/cap | Access/history stop | Interpretation |
|---|---:|---:|---|
| 502400001 | 13 | 13 | Original trapped gap prevented; a reachable J pocket plus active/held T timing still blocked the coach. |
| 505751329 | 75 | 87 | Identical through quad74; legal L75 replaces the former notch violation. No additional score after74. |
| 503028375 | 150 cap | 140 | Four Tetrises still reached, but later abstention. |
| 502818917 | 33 | 24 | Earlier alleged handoff depended on T11 roofing an unreachable cell that remained through its clear24. |
| 503237833 | 30 | 86 | Reached handoff and two-Tetris goal; first divergence was a timing-sensitive opening cutoff. |
| 506379703 | 37 | 37 | Still no handoff. |
| 502504730 | 71 | 37 | Early divergence coincided with completed search depth dropping from3 to2; not clean causal strategy evidence. |

Handoffs were5/7 in both versions; the joint goal (handoff, then two actual Tetrises with a full T-spin double between them) was3/7 versus2/7. These small, previously observed and timing-sensitive development runs do not establish broad reliability or a99% success rate. The later paired-foundation candidate must be tested separately rather than credited with these results.

## Opening beam allocation

An opening node whose complete executed prefix has a definitive negative movement-access result is no longer retained for later expansion. Under the current policy, every descendant would replay the same rejected lock and fail again; there is no delayed-clear or future-blocker exception that could make that prefix admissible. This does not prune a temporarily awkward endpoint, a physically accessible pocket, or an incomplete/unknown access check. The result is memoized only on that request's exact node/path.

This reallocates finite search effort to still-admissible paths without changing the safety criterion or score weights. It is not a speed guarantee: exploring additional valid alternatives can consume more nodes. The fixed-node I10 diagnostic prunes four rejected prefixes but retains the same winner. A separate complete three-placement T/T/I probe found no admissible first T under current access/sealing constraints, so no new I-priority or paired-T exception was added to force that counterfactual.

## Stop successful physical-access searches at their witnesses

The movement enumerator now offers an optional read-only placement predicate for internal existential queries. A predicate stop is explicitly incomplete enumeration, with `stopReason: placement-predicate`; ordinary callers without the option retain the same outputs and traversal order. Access checking uses it to stop once every queried cell has an actual legal placement witness. It no longer explores the rest of that piece's movement graph after its positive proof is complete.

This preserves the existing per-cell physical-access contract. Separate cells may have different hypothetical placements; it is not a jointly executable repair, a visible-supply promise or ST-strategy certification. A partial match followed by a time/node cutoff remains unknown and is not cached. Negative results still require exhaustive completion. Seven frozen positive/negative controls retain identical proof content except visited-node counts; the reported inaccessible S13 gap still requires1,603 nodes and remains rejected, while the preceding accessible cell needs24 rather than573 nodes. Hard tuck witnesses may still require most of the graph. These are bounded work observations, not a survival claim.

## Covered-cell restoration plans

Ordinary midgame admission now distinguishes hypothetical movement access from
an actual restoration plan. Every newly covered Left/Center cell (including a
side-open cell) is tracked by coordinates through actual clear rows. A nearby
TSD does not discharge it. Filling the cell, clearing its row, or removing its
roof does; merely opening a side does not. Existing imported damage is not
silently promoted to newly created debt. Canonical column-seven notches and
Right reservoirs retain their separate contracts.

The supplied executable prefix must resolve the actual new defect, or leave a
recognized ordered Center partner stage with its exact accessible completion.
The existing replay-backed resource policy independently checks partner supply
and intervening-piece accommodation. That stage is explicitly unfinished: it
neither promises an unseen arrival nor claims a completed Reset. An arbitrary
future horizontal-I landing is not a restoration certificate.

A finite repair retains the original public observation and exact lock proof.
After movement, HOLD, an actual lock, or a refreshed preview, admission recreates
the original repair and binds its remaining events to the current observation.
While that repair is pending, an unrelated scoring prefix cannot replace it.
Copied proof flags, a changed board/inventory, or an invalid history do not grant
an exception. Existing stricter newly sealed-cell admission remains unchanged;
this adds coverage for side-open roofs rather than relaxing sealed cavities.

Outstanding cells are also reconstructed from the authenticated public action
history, independently of advice. A failed/budget-limited continuation check or
manual deviation may discard a chosen route but cannot silently discharge its
actual cell obligation. A fresh Worker or same-engine session import replays
that history. A position-only import still has explicitly unknown provenance;
its already present damage is not invented as observed prior construction.

### Conditional pending-L stages

The initial covered-cell-only change left the prior supplied-partner endpoint
boundary unchanged. The separately authorized pending-L extension now admits
position01's exact seven-lock player continuation, without calling its pending
L complete or promising an unseen arrival. This is not a general missing-L
waiver: eligibility requires the replay-derived identity of an ordered Center
S→L stage and its exact still-accessible completion cells.

A bounded positive certificate must either actually complete that target with
publicly supplied L, or safely accommodate **all currently public draws**,
preserving the target, legal conditional completion access, headroom, notches,
and unrelated resource/covered-cell obligations at every waiting lock. At most
a non-L held piece may remain parked. Conditional fresh-L movement establishes
access only, never arrival or supply authority. Failed/pruned searches remain
unknown, not proof that no route exists; a complete actual witness remains
valid even when other branches were pruned. Existing request and proof budgets
are unchanged.

Fresh selection compares certified searched alternatives at the same horizon,
after existing safety/resource/protected-scoring constraints. Actual closure of
an **already observed** pending target takes priority, then earlier closure,
then existing endpoint ordering. Proposed future stages receive no such priority.
A waiting replacement also cannot downgrade the same saved Center goal from an
actually certified supplied-partner completion to an absent-partner wait. This
is preservation of the checked goal, not unequal-horizon endpoint dominance;
ordinary non-waiting replacements retain their existing comparison.
Unresolved alternatives are disclosed; selected means best certified within the
bounded searched set, not globally optimal. Semantic revalidation recomputes
safety but clears prior comparison claims, and waiting advice is freshly compared
rather than automatically retained. Copied evidence cannot supply selection
authority.

The target survives clears, advice loss, movement, HOLD and replay-backed session
import independently of advice. A proposed L diversion cannot acquire the
waiting exception. An actual manual diversion still leaves the authenticated
target unresolved; subsequent fresh planning may repair it, rather than treating
the earlier mistake as completion or imposing a permanent ban. Position-only
imports do not invent producing-piece identity. The authentic S84 player route
is a separate positive: its first seven locks complete the Center target using
public L, preserve the ordinary column-seven notch, and leave the originally
held S undecided. Neither example claims sustainable play or a completed Reset.

### Legacy handoff test boundary

The archived Z→S handoff used by transport/identity tests creates an unresolved
Left cell `[2,31]`. It is now a production-negative control. No valid end-to-end
strategic positive is currently established for that narrow archived handoff
mechanism. Explicitly labeled bookkeeping/UI tests isolate only covered-cell
geometry in a test-only planner loader; they verify real history, identity,
budget and routing contracts, **not** strategic admission. Real forced-bag
scoring-suffix and supplied S→L temporary-roof integration positives remain
unmodified. A green mechanical test cannot waive a production regression.

Preserving an obligation does not freeze its original witness. Replanning may
select a different continuation if it independently proves the same current
history-derived cells resolved or covered by an allowed exact stage. A proposed
future roof is not already-incurred debt. Repair goal lifetime includes the
closing lock, but not ordinary fillers after closure; stale historical flags
cannot keep those fillers committed. The known original repair remains a
checked alternative when actual outstanding cells still need it.

A waiting certificate also retains its bounded literal witness as a search hint
when the public preview refills. The hint is not authority: its endpoint pose,
board, HOLD state, old queue prefix and exact pending identity must align, then
every action is replayed against current supply and checked by the same waiting
rules. Replay/access work and any newly public accommodation consume the same
proof allowance. Old exhaustion flags cannot ignore a newly revealed piece.
The hint changes neither the ordinary comparison horizon nor the goal lifetime,
and does not pin the original witness over a different supported continuation.
