# ST core-loop lab

Open **ST lab** from [practice](index.html), or [open the lab](st-lab.html).
This is a finite **right-side Z/T scoring lab**, not an advisor for arbitrary
ongoing games. It teaches cap → T-spin double → residual pocket → I cleanup.
The stack is supplied. It does not teach openers, filler/side stacking,
replenishment, strategic Reset, arbitrary recovery or indefinite ST stacking.

## Play

1. Choose a named exercise with its fixed authored start. Read the starting
   active/held pieces, six-piece preview, finite goal and replacement notice.
2. **Start selected exercise** replaces the *lab's* board, queue and history.
   Merely opening the page or choosing an exercise does not load a drill.
3. Follow the **amber inset dashed destination**. The ordinary **gray outer
   hard-drop ghost** still belongs to the current active piece; colored fill
   remains the active piece. `HOLD FIRST · T → Z` means the amber destination is
   for Z, **before** you hold. `HOLD TWICE` means respawn the original piece using
   this trainer's existing unlimited swaps. Advice never executes an action.
4. A TSD requires a grounded final rotation followed by a zero-distance hard
   drop. Simply dropping a T shape from above is not enough. On completion,
   choose another exercise or return to practice; nothing restarts automatically.

**A** (`KeyA`) and the on-screen advice button toggle the saved guide display
choice from **Game Settings → Training**. See [shared settings](README.md) for
defaults, storage keys, persistence, live updates and training Reset behavior.
Entry and explicit exercise starts honor that choice; hiding advice never changes
legal moves or eligibility. Rebind the advice key in **Game
Settings → ST lab advice** using the same click-and-press-key convention as the
other controls. Escape cancels capture. Repeats and shortcuts using Ctrl, Alt or
Meta do not activate the toggle, and typing/selecting does not trigger game actions in the
lab. Unmodified gameplay keys move pieces without scrolling the lab page. Keyboard activation of a focused button does not hard-drop a piece first.

The extra binding lives in `localStorage.stAdviceKey`, **not** in the legacy
16-slot `config`. The default is unused by the default game controls. If a
custom gameplay binding already uses it, the advice key is disabled with an
explanation; the button still works. Rebinding refuses conflicts and never
changes an existing gameplay binding. Reset to Defaults clears the extra key
alongside controls.
Other game pages do not load the advisor or intercept this key.

The lab opens with the practice engine, **SRS+ and gravity off**. These are temporary
page settings, not writes to saved normal-play preferences. The editing panel
still allows normal operations; gravity-on or another kickset makes advice
unsupported, rather than silently changing your rules back. Only explicitly
starting an exercise reapplies its disclosed lab rules. Returning to ordinary
practice restores its usual saved gravity behavior.

### Exercises and provenance

Coordinates are zero-based (`x=0..9`, `y=0..39`, top-down). The scoring pocket is
human column 10; the well is column 8. The five named exercises cover four core
rules, each with one authored starting arrangement:

| Exercise | Active / hold | Supplied board / finite goal |
| --- | --- | --- |
| Cap → T-spin double | T / Z | Nine notch rows; Z at `(9,37),(8,38),(9,38),(8,39)`, then T at `(6,37),(7,37),(8,37),(7,38)`; finish after a non-mini double. |
| Capped notch → T-spin double | O / T | The cap is supplied; the same T double is the whole goal. |
| Three residual rows → one more double | T / Z | The notch raised over three residual rows. Cap/T targets are three rows higher. One double leaves four residual rows; stop there. |
| Pocket I → well I | I / I | Four residual rows under six notch rows. I fills `(9,36..39)` without a clear, then I at `(7,36..39)` clears four. |
| Filled pocket → well quad | O / I | The source's filled pocket/upper stack; I at `(7,36..39)` clears four. |

Literal board occupancy is transcribed from [Hard Drop ST Stacking, revision
37604](https://harddrop.com/w/index.php?title=ST_Stacking&oldid=37604), diagrams
0/1/4 (cap/T/residue), 9/10 (pocket I), and 13/14 and the cleared result (well I),
counting diagrams from zero. The diagrams score on the left; we mirror them
into the right-Z/T convention of [Shocky's ST Stacking Guide](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit),
chapters 1–4. The elevated notch and direct pocket→well finish are explicitly
bounded variants/descendants, checked by real-engine replay—not a claim that
all mirrored kicks work identically. Board occupancy/expected outcomes are
independently transcribed in `test/support/st-fixtures.cjs`.

Starting boards are **prebuilt illustrations**, not claimed solutions from an
empty board. Queues are **authored**, not random 7-bag predictions. The setup
shows the six visible upcoming pieces, `O I J L S T`; a finite tail `IOTJLSZ|IOTJLSZ|` supplies
later previews. The normal engine may append random bags after that. Advice
never reads unseen pieces or simulates a random refill. The pocket drill needs
two Is and starts with I both active and held; advice prefers a valid current
piece over an unnecessary hold.

### No-fit means abstention, not game over

There is **no dedicated retry/recovery action**:

- **No core fit found:** no reachable target for the legally accessible pieces
  under these core rules. O/J can still have ordinary legal placements. A
  broader ST solution may exist; this lab does not coach filler moves.
- **Unsupported:** board, exercise/history certificate, rules or piece is outside
  the pilot. No target. The board is never silently replaced.
- **Budget exhausted:** deterministic search reached its work limit. This is not
  proof of impossibility, and a partial search does not produce a different
  approximate target.
- **Exercise complete:** the finite goal was reached, not an invitation to assume
  a self-replenishing stack.

Existing movement, hold, undo/redo, reset, drawing and import controls remain
available. Reset clears the exercise certificate and returns an empty normal
practice board; it does **not** restart the exercise. Starting a named exercise
is always an explicit, disclosed replacement. Unsupported state is not repaired.

## Contributor interface

`st-core.js` is a pure module. `STCore.create(pieces, srsPlusKicks)` captures
immutable copies of the actual game's rule tables. Its small interface is:

- `exercise(id)`: fresh authored `heap`, `active`, `hold`, `next` and starting
  certificate; `STCore.exercises` is read-only descriptive metadata.
- `advise(input)`: `target`, `abstain` or `exercise-complete`.
- `advance(inputBeforeLock, actualLockResult)`: a new certificate **only** when
  actual target cells, clear count, T-spin status and entire resulting heap match
  a core transition; otherwise `null`.

A snapshot contains a full 40×10 locked-only `heap` (`#` / `.`), active instance
`{id,kind,x,y,rotation,lastAction}`, held instance or null, ordered `visibleNext`
instances, `holdRule:'unlimited-swap'`, a strategy certificate
`{version,orientation:'right-ZT',exerciseId,stage}`, explicit
`rules:{version,mode:'practice',kickset:'SRS+',gravity:false}`, and count limits.
Use `STCore.version` for the current policy/rules version. Slot IDs need only be
unique within the snapshot; hypothetical holds/locks preserve their identities.
Repeated letters are not interchangeable instances.

A target includes piece identity, `from`, a 0/1/2-hold `prelude`, exact `cells`,
landing `pose`, executable `path` ending in HD, `rule`, `explanation`,
`continuationVerified`, diagnostics and
`afterMatchingLock`. That last field is conditional, **not** permission to
advance state when displaying or holding. The adapter commits only via
`advance` after an actual engine lock. Advice-off still observes actual progress.

The rule predicates require the **entire certified heap and stage**, a fitting
core piece, and a reachable grounded placement (plus non-mini TSD recognition
for T). The stage is not a canned action index: current pose, hold access and
ordered preview determine whether/how a move can be advised. No recorded input
script is used at runtime. Unknown boards abstain instead of matching a few
convenient bottom cells.

Reachability searches `(x,y,rotation,last-action-is-rotation)` with actual ordered
SRS+ kicks, including 180s. Breadth-first action order is
`L, R, SD, CW, CCW, R180`. Hard drop moves zero rows at the returned endpoint.
The immediate choices are current, one hold, or two holds to respawn current.
Empty hold consumes only next-0. Repeated holds cannot skip to a later preview.

Default ceilings: **30,000 expanded poses, 128 verified lock candidates, two
locks including the immediate one**. Smaller nonnegative counts and depth 1 are
supported for deterministic tests; larger/invalid bounds are rejected. The
finite family has one core target per stage and at most three hold preludes,
so the study's proposed beam of eight is unnecessary: there is no extra beam
pruning. Candidate paths are verified from their actual poses. Prefer a verified
visible continuation/goal, then fewer holds, shortest path, rotation/x/y order;
BFS and hold enumeration break any remaining ties deterministically. There is
no wall-clock tie-break, random search, hidden mutable planner state or generic
stack-height fallback. Counts are **not** a guaranteed latency benchmark or a
completeness/optimality proof.

`STCore.visiblePreview(queue)` mirrors the existing seven-raw-entry renderer and
six-slot clipping, ignoring the hidden suffix. Ambiguous multiple separators or
unsupported visible pieces fail closed. Only this projection reaches search.
If lookahead runs out of visible pieces, stop; do not infer the next bag.

`st-lab.js` is the small gameplay adapter. It snapshots real state and paints an
independent, pointer-transparent SVG over the canvas, using configured cell
size. Nothing is inserted into the collision board. Changed snapshots recompute
before the next paint, on the same render frame as the game. Unchanged frames
do not rewrite the live region or target DOM. There is no asynchronous search
whose late result can overwrite a newer position.

A WeakMap sidecar is keyed by actual history entries plus their exact serialized
board/queue/hold/piece fingerprint, not a mutable cursor. Undo/redo restore only
matching metadata, branches/truncation keep their own entries, and full imports
or in-place history mutations invalidate it. The full queue fingerprint is used
only to check history integrity, never to choose a move. Ordinary edits are
re-evaluated against the certified full heap. Imported history carries no
strategy metadata; begin a named exercise again to establish it. Existing
export formats, normal history semantics and gameplay scoring are unchanged.

## Verification and limits

See [TESTING.md](TESTING.md) for test setup and commands, and its
[ST lab coverage](TESTING.md#st-lab-behavioral-coverage) for the executable checks.

Real-browser checks are still needed for pixels, font/CDN loading, physical
keyboard focus, popup behavior and narrow layouts. Mobile viewport emulation is
not a physical touch-device certification. Larger configured cells may require
horizontal scrolling **inside the field**, never shrinking the collision grid
under mouse coordinates. No broader ST coverage, slow-device timing guarantee,
all-kickset support or automated browser/CI certification is claimed. Hosting
remains static HTML/JS/CSS, with no production dependency or build step added.
