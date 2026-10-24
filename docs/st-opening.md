# Bounded empty-board opening coaching

Empty board now uses `st-opening.js`, separately from established-stack maintenance. It does not remove maintenance admission rules or reinterpret every unsupported imported board as an opening. Empty imports and very low foundation imports qualify; the existing established-wall finite recovery remains on its original path.

## What is checked

Each proposed move has a replayable legal input witness. Search uses only the active piece, hold and six visible preview pieces. It evaluates a reduced placement envelope, normally three locks deep with six retained families, under the same 750 ms / 45,000-node request budget. Completing this envelope is not exhaustive movement search. A miss is lack of a checked move, not proof that the position cannot be played.

Construction diagnostics use occupied cells rather than colors: Left checkerboard balance, Center foundation coverage, anchored column-seven cadence, scoring-row coverage, reachable versus sealed vacancies and regional height. Nonzero balance is reported as unresolved; no unseen T is promised. A hypothetical geometric foundation fit is a ranking signal only, never an available piece or an executed continuation. The search does not require the first two Ts to go left, an exactly flat Left, or a replay-specific prefix.

This initial canonical subset only diverts non-clearing Ts entirely into the Left, preserves the right scoring channel and established notches, and rejects new sealed internal cells. It does not cover every legitimate opening, including the early single clear in the Marathon reference. The foundation-fit probe is deliberately small and incomplete. Construction weights are experimental, not a complete ST grammar or Reset recognizer.

## Phase lifecycle and handoff

`STPlanner.decide` is the shared worker decision entry point. `startOpeningSession`, `updateOpeningSession` and `acceptOpeningResult` manage the public session. Actual lock events are captured before/after preview replenishment. Imported phase flags or claimed clears are ignored. Reset restores the original mode/import; manual movement is freshly planned rather than replaying stale opening advice. There remain exactly two selectable play modes.

Opening remains active until an actual canonical scoring clear is replay-verified against its preceding public pose, the resulting geometry has balanced Left cells, a supported Center motif and established notches, and maintenance produces an executable continuation from the newly visible state. A mere slot or height threshold is insufficient. Maintenance checking shares the deadline and reserves at most 12,000 nodes from the opening budget; its reserved allowance is reported separately from visited nodes. A failed handoff retains opening or honestly abstains.

Advice calls these results partial construction, not a completed opening, completed Reset or guarantee of future supply. Community links provide background from [Shocky's guide, Chapters 1–4](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit), not certification of a specific runtime move.

## Evidence and limits

Four recorded opening prefixes provide occupancy-only controls for cross-region foundations, delayed balancing Ts and early slots with unresolved parity. These fixtures do not invent the original player's preview, hold or rotation inputs. Three development streams reached their first full T-spin doubles at locks 15, 18 and 19, then passed the checked handoff and reached a second double. They informed development and are not held-out performance evidence.

The separate simulation runner supplies fresh-worker, seeded closed-loop evidence. Any abstention, height drift or capped run must be reported alongside successes. This first opening implementation is bounded and heuristic; it does not establish reliable survival for arbitrary bags, contingent multi-bag planning, or full Midgame→Reset→Midgame control.

Fresh-worker quick smoke on two different seeded streams reached the 24-lock cap in both runs. First full T-spin doubles and checked handoffs occurred after locks 23 and 14, with 2 and 4 total cleared lines at the cap. These are short censored runs, not survival guarantees. The largest measured request was 803 ms including VM setup; 750 ms is a cooperative search budget, not a hard end-to-end latency guarantee. Source hashes and action traces are retained in the simulation manifests.
