# ST free-play lab

Open **ST lab** from the [shared top menu](README.md), or [open the lab](st-lab.html).
Play begins on an empty board with the normal shuffled seven-piece bags. Build
and maintain your own stack. Occasional **amber inset dashed targets** identify
verified right-sided Z caps, non-mini T-spin doubles, pocket I fills and well
quads. Unsupported positions have **no target**, not a guessed best move.
The former named exercises, authored starts and completion flows are removed.

This is not an opener, filler or recovery coach. It does not infer parity,
Extra-Z history, strategic Reset, sustainable stacking or indefinite correctness.
A corner silhouette alone is not enough to establish a double or useful strategy.
There is no guarantee of frequent hints or of encountering every action family.

## Play

- Ordinary movement, hold, hard drop, undo/redo, drawing, imports and restart
  remain available. Restart uses the normal engine's empty-board/queue behavior;
  it never supplies an ST setup or replays a lesson.
- Amber inset dashes are separate from the **gray outer hard-drop ghost** for
  your active piece. Colored fill is the active piece. Advice never moves it.
- `HOLD FIRST · T → Z` identifies a legally held/next-0 Z, before you hold.
  `HOLD TWICE` respawns the original piece using this trainer's unlimited swaps.
  A later visible piece is not immediately selectable.
- A TSD requires a grounded final rotation then a zero-distance hard drop.
  Simply dropping a T-shaped placement is not necessarily a T-spin.
- Each target verifies the immediate placement. A setup's **following scoring
  action** is announced only if its required piece and reachable path are
  established by current hold and ordered visible preview. Otherwise the text
  explicitly says *immediate action only*. Neither statement promises a chain.

**A** (`KeyA`) and the advice button toggle the saved guide display choice in
**Game Settings → Training**. Advice defaults on; bag boundaries default off.
See [shared settings](README.md) for persistence and Reset behavior. Hiding
advice changes no moves or board state. When shown again it analyzes fresh state.
Rebind in **Game Settings → ST lab advice**; click then press an unused key.
Escape cancels capture. The binding is stored in `localStorage.stAdviceKey`, not
in the legacy 16-slot `config`. Conflicts with gameplay keys disable the shortcut
with an explanation; the button still works. Reset to Defaults clears this key.

Repeated or Ctrl/Alt/Meta-modified advice keys are ignored. Typing/selecting and
keyboard activation of focused controls do not move/drop pieces. Unmodified game
keys do not scroll the lab. Settings Save & Close, the shared menu and normal
settings persistence are unchanged. Other modes do not load the advisor.

The lab opens with temporary **SRS+ and gravity off**, without rewriting saved
normal-play preferences. Enabling gravity or applying another kickset stops
advice and explains the limitation; restart does not silently switch rules back.
Return to supported settings to re-enable recognition. Gravity-on advice is not
implemented. Ordinary Practice and other modes retain their own behavior.

## Recognized geometry and limits

Coordinates are zero-based (`x=0..9`, `y=0..39`, top-down). The current orientation
has the pocket in human column 10 and the well in column 8. Targets translate
vertically in the visible field, not horizontally or to the opposite orientation.

| Action | Required local result |
| --- | --- |
| Z cap | Z at `(9,y),(8,y+1),(9,y+1),(8,y+2)`, no clear. Leaves a reachable non-mini double-shaped T notch with the affected rows complete after T. This virtual T check does **not** assert that a T is available. |
| T-spin double | T at `(6,y),(7,y),(8,y),(7,y+1)` under the cap; a legal grounded final rotation, non-mini spin and exactly two actual completed rows. |
| Pocket I | Four rightmost pocket cells filled without a clear, beside four rows with an open column-8 well. Leaves a reachable well quad; another I is not assumed. |
| Well I | Vertical I in column 8 completes exactly four rows. |

Unrelated upper filler and stack-height variation are allowed. Required affected
rows, supports, collisions and reachable paths are checked against the **whole
current board**, not a named lesson, phase or one of five stored heaps. A missing
left cell that changes a double to a single rejects the target even when the
right corner is unchanged. Blocked pockets and unreachable cavities reject it
too. Complete editor-created rows, malformed snapshots and overlapping active
pieces are unsupported rather than counted as unrelated scoring credit.

A supported scoring action is not a judgment about allocation or strategic
usefulness. Arbitrary garbage play, other notch/pocket geometries and scoring
orientations are not covered. Empty boards and ordinary filler turns commonly
receive **No verified scoring hint**. Keep playing manually. **Search limit
reached** means incomplete analysis, not impossibility; no partial target is
shown. Nothing repairs the stack, advances a phase or automatically restarts.

### Sources

The four local mechanisms derive from [Hard Drop ST Stacking, revision
37604](https://harddrop.com/w/index.php?title=ST_Stacking&oldid=37604), zero-indexed
diagrams 0/1/4 (cap/T/residue), 9/10 (pocket I), and 13/14/cleared result (well I),
mirrored into the right-Z/T convention of [Shocky's ST Stacking
Guide](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit),
chapters 1–4. Source diagrams are not empty-board opening solutions. Independent
literal occupancy/cell transcriptions remain in `test/support/st-fixtures.cjs`
**only as tests**. Actual-engine generalized checks, not an assumption that all
mirrored kicks work identically, establish the tested examples.

## Contributor interface

`STCore.create(pieces, srsPlusKicks)` captures immutable copies of the real rule
tables and returns one pure operation: `advise(input)` → `target` or `abstain`.
There is no exercise catalog, certificate or progress transition API.

A snapshot contains the 40×10 locked-only `heap` (`#` / `.`), active instance
`{id,kind,x,y,rotation,lastAction}`, held instance or null, ordered `visibleNext`
instances, `holdRule:'unlimited-swap'`, and
`rules:{version:STCore.version,mode:'st-lab',kickset:'SRS+',gravity:false}`.
IDs are unique within a snapshot; duplicate letters are distinct instances.
Only `STCore.visiblePreview(queue)` reaches search: it mirrors the seven-raw-entry
renderer and six-slot clipping, rejects ambiguous multiple separators/unsupported
visible pieces, and never examines the hidden suffix.

Targets provide identity, `from`, 0/1/2-hold `prelude`, `cells`, landing `pose`,
executable `path` ending in zero-distance HD, `rule`, `expected` scoring,
`explanation`, `continuationVerified`, optional `continuation`, and diagnostics.
A continuation is one legally accessible scoring follow-up to a setup, not
completion, an arbitrary future-piece menu or a claim about later replenishment.

Candidates are generated from present geometry and simulated clear results.
Reachability uses actual ordered SRS+ kicks (including 180s) over
`(x,y,rotation,last-action-is-rotation)`, with stable BFS action order
`L,R,SD,CW,CCW,R180`. Current piece, one hold, then two-hold respawn are considered;
empty hold consumes only next-0. A setup also needs a reachable hypothetical
scoring placement, separately from legal piece access for a continuation.

Default hard ceilings: **30,000 expanded poses, 128 verified lock endpoints,
two actual locks including the immediate action**. Smaller nonnegative budgets
and depth 1 are supported; invalid/larger limits reject. Hypothetical setup
checks count toward those work budgets even at depth 1. Within a call, identical
heap/pose/goal searches share paths. Any exhausted budget discards all candidates.
Prefer verified continuation, fewer holds, shorter path, then rotation/x/y;
geometry, hold and BFS order break remaining ties deterministically. There is no
random search, clock tie-break, strategy framework, background service or solver.
These work limits are not a latency or completeness guarantee.

`st-lab.js` snapshots fresh board/piece/rules/visible-preview state each render
frame. Identical snapshots reuse the answer; changes recompute synchronously
before painting an independent pointer-transparent SVG at configured cell size.
There is no stale phase, history sidecar, hidden queue fingerprint or asynchronous
result to restore. Locks, clears, filler, deviations, undo/redo, branches, edits,
imports, mirror and restart all use this same recognition path. Unchanged frames
do not rewrite target DOM/live regions. Nothing enters the collision board.

## Verification

See [TESTING.md](TESTING.md#st-lab-behavioral-coverage) and `npm test` using `.nvmrc`.
Tests retain independent sourced positive/negative boards, legal hold/path and
actual scoring checks, generalized filler/height variants and the missing-left-
cell single counterexample. `test/st-natural.test.cjs` begins empty using the
actual engine's normal generated pieces (test-host seed 29); eleven legal locks
and hold lead to one verified I quad. Its literal action history is in
`test/support/st-natural.cjs`. No prerequisite board or queue is injected.
**One replay proves one occurrence, not natural frequency or an all-family chain.**

The browser-free host substitutes RNG/clocks/assets and does not render pixels.
Supplement UI changes with real desktop/narrow screenshots and controls/settings
checks as required by `.no-mistakes.yaml`. Viewport emulation is not physical
touch-device certification. Larger configured cells may scroll inside the field;
never shrink collision coordinates. Hosting remains static HTML/JS/CSS with MIT
attribution, no build step and no new production dependency.
