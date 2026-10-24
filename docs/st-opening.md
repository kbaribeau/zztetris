# Bounded empty-board opening coaching

Empty board now uses `st-opening.js`, separately from established-stack maintenance. It does not remove maintenance admission rules or reinterpret every unsupported imported board as an opening. Empty imports and very low foundation imports qualify; the existing established-wall finite recovery remains on its original path.

## What is checked

Each proposed move has a replayable legal input witness. Search uses only the active piece, hold and six visible preview pieces. It evaluates a reduced placement envelope, normally three locks deep with six retained families, under the same 750 ms / 45,000-node request budget. Completing this envelope is not exhaustive movement search. A miss is lack of a checked move, not proof that the position cannot be played.

Construction diagnostics use occupied cells rather than colors: Left checkerboard balance, Center foundation coverage, anchored column-seven cadence, scoring-row coverage, reachable versus sealed vacancies and regional height. Nonzero balance is reported as unresolved; no unseen T is promised. A hypothetical geometric foundation fit is a ranking signal only, never an available piece or an executed continuation. The search does not require the first two Ts to go left, an exactly flat Left, or a replay-specific prefix.

This initial canonical subset only diverts non-clearing Ts entirely into the Left, preserves the right scoring channel and established notches, and rejects new sealed internal cells. It does not cover every legitimate opening, including the early single clear in the Marathon reference. The foundation-fit probe is deliberately small and incomplete. Construction weights are experimental, not a complete ST grammar or Reset recognizer.

## Phase lifecycle and handoff

`STPlanner.decide` is the shared worker decision entry point. `startOpeningSession`, `updateOpeningSession` and `acceptOpeningResult` manage the public session. Actual lock events are captured before/after preview replenishment. Imported phase flags or claimed clears are ignored. Reset restores the original mode/import; manual movement is freshly planned rather than replaying stale opening advice. There remain exactly two selectable play modes.

Opening remains active until an actual canonical scoring clear is replay-verified against its preceding public pose, the resulting geometry has balanced Left cells, a supported Center motif and established notches, the aligned lower Center has no non-notch vacancies below its shared surface, and maintenance produces an executable continuation from the newly visible state. A mere slot or height threshold is insufficient. Maintenance checking shares the deadline and reserves at most 12,000 nodes from the opening budget; its reserved allowance is reported separately from visited nodes. A failed handoff retains opening or honestly abstains.

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
