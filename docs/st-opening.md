# Bounded empty-board opening coaching

Empty board now uses `st-opening.js`, separately from established-stack maintenance. It does not remove maintenance admission rules or reinterpret every unsupported imported board as an opening. Empty imports and very low foundation imports qualify; the existing established-wall finite recovery remains on its original path.

## What is checked

Each proposed move has a replayable legal input witness. Search uses only the active piece, hold and six visible preview pieces. It evaluates a reduced placement envelope, normally three locks deep with six retained families, under the same 750 ms / 45,000-node request budget. Completing this envelope is not exhaustive movement search. A miss is lack of a checked move, not proof that the position cannot be played.

Construction diagnostics use occupied cells rather than colors: Left checkerboard balance, Center foundation coverage, anchored column-seven cadence, scoring-row coverage, reachable versus sealed vacancies and regional height. Nonzero balance is reported as unresolved; no unseen T is promised. A hypothetical geometric foundation fit is a ranking signal only, never an available piece or an executed continuation. The search does not require the first two Ts to go left, an exactly flat Left, or a replay-specific prefix.

This initial canonical subset only diverts non-clearing Ts entirely into the Left, preserves the right scoring channel and established notches, and rejects new sealed internal cells. It does not cover every legitimate opening, including the early single clear in the Marathon reference. The foundation-fit probe is deliberately small and incomplete. Construction weights are experimental, not a complete ST grammar or Reset recognizer.

## Phase lifecycle and handoff

`STPlanner.decide` is the shared worker decision entry point. `startOpeningSession`, `updateOpeningSession` and `acceptOpeningResult` manage the public session. Actual lock events are captured before/after preview replenishment. Imported phase flags or claimed clears are ignored. Reset restores the original mode/import; manual movement is freshly planned rather than replaying stale opening advice. There remain exactly two selectable play modes.

Opening remains active until an actual canonical scoring clear is replay-verified against its preceding public pose, the resulting geometry has balanced Left cells, a supported Center motif and established notches, the aligned lower Center has no non-notch vacancies below its shared surface, and maintenance produces an executable continuation from the newly visible state. A mere slot or height threshold is insufficient. The legacy maintenance check shares the deadline and reserves at most 12,000 nodes from the opening budget; its reserved allowance is reported separately from visited nodes. A failed handoff retains opening or honestly abstains. A narrowly admitted shared-budget recovery is described below.

### Experimental forecast-first revalidation

On the forecast-first experiment branch, an opening advice that has already found a public post-clear maintenance prefix can carry that route transiently across its exact executed inputs. After the matching actual clear, the existing handoff geometry/allocation gates still apply. The route is then rebuilt from the actual public state and current resource/pattern histories, with ordinary structural, endpoint-entry, resource, covered-repair and access checks. No saved admission flags are trusted. Construction-specific and pending-L-selection exceptions are not reused by this route.

This attempt and fresh-search fallback share the existing 200 ms / 12,000-node handoff allowance, including failed proof work. `metrics.handoffWork.legacy.forecast` reports attempts, retention, charged nodes and reason; `source` distinguishes forecast reuse from fresh search. The envelope contains only observed inputs and is discarded on deviation, Undo, reset, import or successful handoff. It is not exported. This changes proof order, not the handoff geometry or ordinary placement policy; finite revalidation is not a promise of sustained play.

### Observed Hanging-S handoff recovery

The original 12,000-node / 200-ms probe runs first. A successful original prefix
is preserved as the checked fallback. The separate fresh-maintenance decision
below may replace it; Hanging-S recovery never lengthens a successful prefix.
Only its budget exhaustion, together with replay-complete historical opening
allocation and quality, can trigger recovery for one still-live, known Hanging S.
Unknown or unclassified S accounting does not qualify. Recovery uses two thirds
of the remaining nodes and time, not another full request, and leaves the rest
for ordinary fallback. All visited work is charged to the original allowance.

The accepted recovery has at most two locks and ends by placing that exact owed
S on Left. For a two-lock path, the controller may carry a bounded, ephemeral
candidate across the actual first lock. On the next request the worker rebuilds
the original and current history, piece identities, legal events, resource policy
and access checks before retaining the S payment. This is not a new generic
filler commitment, and a saved marker is not proof. A different legal movement
route to the same first lock is allowed; disconnected history, post-lock input,
unknown identities, changed results and exhausted proof budgets reject it.

Undo, reset, import and worker failures clear this transient routing. Session
exports do not preserve it. Ordinary resource goals and strategic ranking remain
unchanged. Focused proof/lifecycle tests and finite paired simulations are separate
acceptance checks; a legal two-lock payment does not establish better survival.

Advice calls these results partial construction, not a completed opening, completed Reset or guarantee of future supply. Community links provide background from [Shocky's guide, Chapters 1–4](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit), not certification of a specific runtime move.

## Evidence and limits

Four recorded opening prefixes provide occupancy-only controls for cross-region foundations, delayed balancing Ts and early slots with unresolved parity. These fixtures do not invent the original player's preview, hold or rotation inputs. Three development streams reached their first full T-spin doubles at locks 15, 18 and 19, then passed the checked handoff and reached a second double. They informed development and are not held-out performance evidence.

The separate simulation runner supplies fresh-worker, seeded closed-loop evidence. Any abstention, height drift or capped run must be reported alongside successes. This first opening implementation is bounded and heuristic; it does not establish reliable survival for arbitrary bags, contingent multi-bag planning, or full Midgame→Reset→Midgame control.

Fresh-worker quick smoke on two different seeded streams reached the 24-lock cap in both runs. First full T-spin doubles and checked handoffs occurred after locks 23 and 14, with 2 and 4 total cleared lines at the cap. These are short censored runs, not survival guarantees. The largest measured request was 803 ms including VM setup; 750 ms is a cooperative search budget, not a hard end-to-end latency guarantee. Source hashes and action traces are retained in the simulation manifests.

## Handoff-aware clears and retained repairs

See [the opening repair changes](st-opening-repair.md) for exact goal retention, shared-budget candidate-clear probes, and the stricter lower-foundation handoff criterion. These do not certify the acceptance target of reliable opening plus two subsequent Tetrises.

## Bounded visible five-lock closure

A narrow optional extension addresses a measured horizon failure, not a preferred first piece. After a completed three-lock reduced search layer, a retained candidate may expose an actual next Left T that cancels the observed checkerboard imbalance, followed by an executable exact Center partner. Discovery uses only the original public active/hold/preview state. It stops after the first fully replayed, access-positive witness, so it is an existence trigger rather than exhaustive closure enumeration.

The extension preserves the ordinary beam and evaluates all retained competitors through the same five-lock horizon with the existing rank. It returns a closure only after both additional reduced layers complete and the selected endpoint passes the combined certificate. A time/node cutoff returns the already checked nominal advice, even if deeper partial candidates looked better. `completeDepth` describes completed reduced layers, not necessarily the length of that fallback promise. The closure itself does not raise the configured deadline or node limit. A separately authorized temporary 1500 ms production allowance is documented in the [budget decision](st-temporary-planning-budget.md); all earlier 750 ms comparisons keep their original budgets. Only an unused speculative handoff-time reserve may be released after a certified closure and no handoff-eligible nominal clear candidate; a final validation margin remains. Metrics disclose that released time.

This subset requires five nonclearing locks, observed initial Left imbalance of two, no unresolved internal sealed debt, a balanced unroofed Left endpoint, an aligned recognized level Center, and the preserved scoring wall. Its retained goal combines the actual balancing T and exact Center completion. Paying parity alone does not retire the Center obligation. Actual HOLD, public preview refresh, lock events, Undo and deviations revalidate the same proof; arbitrary imported metadata cannot authorize it. An ordinary shorter plan cannot replace a still-longer saved goal without a checked equal-horizon comparison. This is deliberately conservative and is not a Reset, handoff, or indefinite-survival certificate.

Development evidence is seed 502609459 before O6. Forcing only the checked O-center move, then resuming unchanged policy, reached the 45-lock diagnostic cap with handoff19 and14 lines; the original autonomous route abstained30 without clearing. The successful continuation replanned flexible Left placements rather than following the first hand-written witness. The fixed-node discovery and fresh-worker probe are separate from autonomous matched validation. The final scoped development comparison retained the target gain but also recorded a severe timing-boundary control failure. The feature remains enabled as bounded development behavior, not a validated overall-reliability improvement. See the [full review and all three separate cohorts](st-visible-closure-review-2026-10-24.md).

### Cavity-analysis cost

Opening transition checks reuse a request-private minimal `sealedCells` assessment instead of computing unrelated geometric T slots. Full and minimal assessments implement the same top-connected four-neighbor air definition. The ordinary full assessment retains its prior implementation; only the opening-only query uses the optimized flood, isolating maintenance search timing from this change. A per-call 400-cell queue marks cells on enqueue, with explicit row boundaries; output remains x-major. Minimal analysis scans empty cells without computing heights: every empty cell above a column's first occupied cell has a straight path to the top. Independent equivalence tests cover both implementations. This is an exact flood optimization, not tetromino reachability, a new gap exemption, or a strategic ranking change. Independent frozen full-assessment and fixed-node advice comparisons accompany regression tests for boundaries, sealed/side-accessible pockets and buffer isolation.

### S/L accounting at maintenance entry

Opening placements need not form S/L pairs. Immediately before the first
maintenance probe, the observed lock history is interpreted at the proposed
handoff boundary. For each original observed bag, both S and L already locked
means no inherited hanging-piece obligation; exactly one locked means its unused
counterpart is hanging; neither locked means no inherited obligation. HOLD is
unused and keeps its original bag identity. An older held S and a current-bag S
can therefore both be hanging. Two or more retain the existing `out-of-profile`
label while all identities remain tracked; this does not broaden repair policy.

This settles allocation bookkeeping, not the board. Exact Center targets,
diverted-partner debt, covered cells and other repair facts remain. Actual
post-handoff placements use the existing identity-specific accommodation rules.
Unknown origins stay unknown; an as-yet-unobserved counterpart stays deferred
until its actual reveal. No private future or arrival order is inferred.

Forecast-first validation, fresh probing, shared-budget recovery and hypothetical
post-clear forecasts use the same boundary ledger. A failed probe does not change
live history. Acceptance retains that marker, and Undo and session replay derive
the same result. The action-tape schema is unchanged; the coach compatibility
stamp changes so older cached advice is discarded while replayable history stays.

`handoffAtAction` is a recorded phase-transition input, not an authenticated proof
that this was the only possible handoff time or that a coach approved it. Imported
action tapes can describe alternative phase histories. Changing that input
changes which locks belong to opening, but cannot rewrite actual allocations or
certify repaired Center/covered geometry. Normal planner admission still checks
its own resource, structural and access evidence.

### Fresh supported maintenance selection

At an eligible handoff, the ordinary planner first fully admits the existing
forecast or legacy maintenance prefix against the marked boundary ledger. It
then offers a fresh supported maintenance decision the remaining outer request
nodes and original deadline. The fresh request has no opening forecast, previous
advice, or commitment. Ordinary maintenance owns piece allocation and finite
repair goals; the handoff has no J-specific rule.

A completed supported decision is authoritative, rather than being required to
dominate every endpoint measure of a shorter forecast. Risky placement and Reset
selection are excluded. The separate Hanging-S recovery route keeps its exact
required payment. If fresh work cannot finish, the already admitted fallback
survives unchanged, with all attempted work included in total node accounting.
`metrics.handoffWork.fresh` records its attempt, remaining allowance, spent nodes
and selection; fresh advice never claims its selected route was a revalidated
forecast. Only the actual opening producer in the current invocation can enable
this step; imported phase/evidence labels cannot authorize it.

These are finite proof and budget contracts. E01 is an inspected development
regression, not evidence of general survival improvement.

### Retaining the visible first-double route

Once complete public resource history verifies the two non-Right Ts and the
opening Z allocation, an ordinary checked route to the first Right T-spin double
can survive replanning after its preparatory locks. This does not change opening
ranking or reserve a future piece that has not been revealed.

The transient forecast preserves the original visible route, exact actual
inputs and newly public draws. Revalidation replays the original route without
later reveals, binds the consumed actions to the current pose and bag, and
replays the remaining witnesses with the current identity-bearing resource
ledger. The final first-double allocation and access checks must succeed within
a 2,000-node/120-ms slice of the existing request allowance. Failure leaves the
remaining request budget to ordinary opening search. The original height and
broken-notch guards still apply.

A failed hypothetical maintenance probe does not invalidate this construction
route. A completed construction forecast cannot authorize maintenance; the
ordinary actual-clear or observed-quality handoff checks remain separate. When
a route already carries a checked maintenance forecast, that separate payload
is preserved. Deviation, Undo and imports use the existing transient forecast
lifecycle rather than granting a new persisted session capability.
