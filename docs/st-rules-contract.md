# Milestone-one rules and observation contract

`st-rules.js` is pure UMD/CommonJS (`STRules` in a browser). It imports no DOM, RNG, generator or global game state. Static shape and SRS+ kick data are copied from the existing `rotationSystem.js` and regression-compared exactly. Ordinary trainer modes are not changed.

## Explicit profile `st-zero-v1`

- Board: 10 columns × 40 rows, downwards Y, hidden rows 0–19; spawn matrix origin `(3,17)`, rotation 0.
- Zero gravity, no automatic lock or lock delay, manual hard-drop lock. CW, CCW and the copied SRS+ 180° kicks are supported. SRS+ is not called plain SRS.
- One hold per lock. Empty hold draws the next known piece; occupied hold swaps without consuming the stream. Lock resets availability. Unknown next pieces are never invented.
- Positive-distance translation/drop clears rotation evidence. Failed moves and zero-distance hard drop retain it. T-spin classification uses three occupied/out-of-bounds corners around the T pivot; full if both facing corners are occupied, or a quarter-turn used the fifth kick; otherwise mini. The fifth-kick exception does not apply to 180°. This explicit profile differs from the old trainer's omitted mini exceptions.
- Lock clears any 0–4 completed rows, including quads; no strategy restriction belongs in the kernel. `lastEvent` records exact clear rows, classification, piece, landing and cells. The coaching milestone uses event classification, not legacy score/combo arithmetic.
- Top-out: blocked spawn after draw/hold, or all locked minos above visible row 20 (pre-clear). No automatic garbage insertion or restart. Top-out states stop accepting actions.

## State and public API

`createState({board, active, hold, canHold, queue, revision, streamCursor, rules, bag})` copies inputs and drops extraneous generator/seed fields. Board is 40 strings of 10 cells, `.` empty and `#`, `X`, or piece letters occupied. `active` can be a type string for spawn, a `{type,x,y,rotation,lastRotation}` pose, or null at the known-information horizon. Hold is null or a type. Queue is only the known upcoming prefix. `lastRotation` is null or `{from,to,kickIndex}` with zero-based kick index. State revision increments on successful actions. `streamCursor` counts additional draws; its initial offset is supplied by the caller, not inferred from placed-piece count.

- `validate(state)` returns errors; validate imported observations before transitions/search.
- `cells(active)` returns absolute `[x,y]` coordinates; `fits(board,active)` checks boundaries/collision.
- `move(state, action)` returns a new state on success or the identical state on blocked/unknown input. Actions: `L R SD CW CCW R180 HOLD HD`. Inputs are never mutated. `HD` sets `lastEvent`; other successful actions clear it.
- `replay(state, actions)` returns `{state,events,valid,failedAt}`. Strict witnesses reject no-op/blocked actions.
- `placements(state, {allowHold,maxNodes,deadline,now})` returns `{placements,visited,complete}`. Each placement contains `{target,hold,witness,state,event}`. `state` is after the lock; `target` is its landing pose. Default node limit is 16,000. Deadline is an absolute value in the supplied clock's units (`Date.now` milliseconds by default).

Movement BFS starts at the supplied actual pose and interleaves no-hold and legal-hold roots. It retains distinct spin-semantic routes to identical geometry, with full exact witnesses. Rotation history is collapsed in deduplication only when outcome-equivalent: non-T ignores it, T distinguishes absent / ordinary rotation / quarter-turn fifth-kick upgrade. All non-clearing placements remain candidates. Placements causing top-out are not offered. `complete:false` means the enumeration budget ended, not that no placement exists. A known queue ending after lock yields null active, not a guessed next piece.

## Bag knowledge and information boundary

`st-bag.js` (`STBag`) represents possible *remaining sets* after all observed original draw positions, including preview. `fromObserved({observed:[types...],startPhase})` accepts original draw order, **not placement order**. A trusted `startPhase:0` means the first observed draw starts a fresh bag; 1–6 identify a known partial-bag phase. `null` preserves all compatible phases and remaining sets. This is conservative exact set inference for a contiguous observed stream.

`consume(knowledge,type)` applies one newly observed draw; `possibilities` returns the union of possible next kinds; `forcedNext` returns a kind only when every compatible state forces it. A zero remaining mask marks a completed bag; the next draw may be any kind. Contradictory evidence produces an explicit error and no deduction.

The UI must feed each draw position once, maintaining provenance separately. Moving preview to active, or active to hold, is not a new observation. With unavailable history use unknown-phase evidence; never recover history from hidden generator state. Knowledge on a coach observation describes the frontier **after its visible queue**, not its current active piece. Search may consume a forced inferred kind beyond that frontier, but must not consume the already-accounted visible queue again. No inference module reads a generator, seed, hidden queue, or scripted fixture solution.

## Hypothetical T entry proof

`tDoubleAccess(board, {maxNodes, deadline, now})` searches a fresh T at the profile spawn, without hold or hidden queue information. It returns `{reachable, witness, event, visited, complete}`. `reachable: true` includes an executable witness for a full TSD; `false` means exhaustive search found none from that hypothetical spawn on the unchanged board. Budget exhaustion or invalid board returns `null`, never false proof. This says nothing about when a T arrives or whether the board remains usable until then.

The query avoids locking at every explored pose: only grounded full-spin poses are checked for two completed rows, then locked to obtain an event. It descends through empty air to a four-row-clear plane above the highest cell, retaining actual SD inputs. All T orientations and horizontal positions can be reached in that empty band, so climbing above it is unnecessary. If the stack reaches the spawn region, the clipping optimization is disabled. Movement and rotation evidence semantics are otherwise identical to placements. Tests compare the optimized result to full enumeration on curated, mirrored, high-stack and inaccessible-cavity boards.
