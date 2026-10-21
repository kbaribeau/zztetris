# ST lab — continuation-engine playtest branch

**Experimental replacement, not a deployment or acceptance decision.** The
captain will playtest and decide whether to replace the previous matcher.
[Agreed vision](docs/st-lab-vision.md) remains direction, not authority to expand
this increment. [Launch and reproducible examples](docs/st-playtest.md).

This branch recommends one placement backed by **three actual locks**, using the
current heap, actual pose, hold and ordered visible preview. It can recommend
non-scoring freestyle, temporary vacancies with checked repairs, Center pair
starts/completions, Z caps, non-mini T-spin doubles and I cleanup. There is no
old-pattern priority or blanket visible-S veto for LO. There is no opening,
left-scoring, gravity-on, triple or generic survival policy. Empty-board starts
still use normal shuffled bags. **Abstentions are common**, including positions
where a human or a larger/different search can continue.

## Play and controls

Amber inset dashed cells are the suggested destination, separate from the gray
outer hard-drop ghost and the colored active piece. Advice never moves a piece.
`HOLD FIRST` names the held/next-0 piece; `HOLD TWICE` uses this trainer's unlimited
swaps to respawn the original piece. A later preview piece is not a menu item.
For a TSD, finish grounded with a rotation, then hard drop without moving down.

**A** (`KeyA`) or the advice button hides **both** target and explanation. This
is the saved **Game Settings → Training → ST guide** choice (default on).
Showing it starts fresh analysis. The off message is not coaching. Rebind in
Game Settings → ST lab advice; conflicts disable only the shortcut. The binding
uses `localStorage.stAdviceKey`, not the legacy 16-slot config. Reset to Defaults
clears it. Bag markers are a separate preference, default off.

Movement, hold, drawing, imports, undo/redo, mirror, queue editing and restart
remain normal engine actions. The lab temporarily starts with **SRS+, gravity
off**, without rewriting saved normal-play preferences. Other rules disable
advice; restart does not silently restore them. Normal modes do not load STCore.
Text inputs, focused controls, repeat and modified advice keys retain their
input guards. The advice panel follows the field, so wrapping does not move the
board/HOLD/NEXT. Large cells and narrow viewports scroll, not rescale collisions.

Changed snapshots immediately hide the old target while checking. A prior
target gets search priority, but appears again only after its entire fresh route
passes. No stale background result can paint over an edit, hold, undo or toggle.
Unchanged frames reuse the answer without rewriting the live region or SVG.

## What is proved — and what isn't

Every displayed route checks, for **each of its three actual locks**:

- Legal current/held/empty-hold/two-hold access, all intermediate spawns, and
  ordered prefix consumption. Every instance is used at most once.
- A reachable actual SRS+ input path (`L R SD CW CCW R180`, then grounded `HD`),
  collisions, exact clears and this trainer's spin/mini rules.
- The piece that must spawn **after the last lock** too. Unknown next spawn
  means no witness; a held piece cannot bypass a failed intervening spawn.

No queue suffix, bag membership, remembered allocation phase or invented future
piece enters the search. Locks are not bag boundaries. The internal instance IDs
are snapshot-local identities, not persistent gameplay history.

### Declared endpoint contract

All coordinates are zero-based, top-down on the 40×10 board. This deliberately
narrow structural contract is **not a theorem of ST sustainability**:

1. **Freestyle (x=0..3):** no buried empty cells at the endpoint. No newly created
   one-column surface channel remains. A channel includes even a **one-cell**
   depression; the freestyle strip's edges count as walls. Initial channels may
   remain only at the same cells, translated through actual clears. Filling one
   channel while creating another does not pay the obligation. This conservative
   strip definition can reject useful cross-region or shallow-notch play.
2. **Center (x=4..6):** a solid ladder of `###` / `##.` rows, with each notch
   supported by `###` below, no other unfinished row, and at least one covered
   notch. A newly raised top must be flat `###`; an existing top `##.` cut may
   remain at its original clear-translated height. A newly placed O or incomplete
   pair cannot qualify merely by receiving a high heuristic score.
3. **Right (x=7..9):** well x=7 clear, spine x=8 contiguous to the floor, and
   pocket x=9 either bottom-filled/open or roofed only by the two-cell Z cap.
   This excludes many valid alternate ST geometries. All locked cells remain
   at y≥18; actual final spawn must fit independently of this headroom test.
4. **Access, not imaginary score:** the endpoint must also admit an actual SRS+
   path from spawn for a non-mini double (possibly after a hypothetical Z cap),
   or an I quad. Those virtual probes share the decision budget and simulate
   their exact clears. They are **not actual locks in the witness** and **do not
   establish that Z/T/I is available**. The diagnostic explicitly labels their
   resource status `unverified-beyond-horizon`.

The actual finite route is verified through H, not through those hypothetical
future resources. New freestyle vacancies/channels and unfinished Center work
must be **paid at H**, possibly by a later lock in the witness. An intermediate
step's new obligations are labelled **verified-payable-within-horizon**, never
paid by an estimate. Existing channels and intentional completed Center notches,
Z caps and cleanup residue can remain; their future resource obligations are
**unverified beyond H**, disclosed separately. The endpoint does not promise
another available double, replenishment or indefinite play.

### Four concepts and explanations

- **Scoring cycle and cleanup:** actual cap/double/staging/quad transitions,
  with exact scoring and intentional residue distinguished.
- **Center overhang construction:** completed ladder/notches and repayment of
  unfinished construction, without requiring every filler to score immediately.
- **Repairable freestyle filler:** specific new vacancies/channels tracked to
  an executed repair or clear, rather than a generic flatness reward.
- **Cross-region allocation/headroom:** one ordered route assigns distinct
  resources across regions; the search compares their relative surface heights
  and validates every spawn. It does not infer player intent or historical debt.

The short reason names checked facts, not a numeric quality score. Diagnostics
contain all intermediate cells, paths, heaps, identity assignments, obligations,
terminal geometry and hypothetical-access evidence. A route is **a** supported
finite continuation, not an optimal move or proof that discarded choices fail.

## Implementation and work limits

`STCore.create(pieces, srsPlusKicks)` copies the actual immutable rule tables.
`advise(input)` returns a target/witness or abstention synchronously for tests
and offline tools. `start(input)` returns a resumable generator of the **same**
operation; its yields carry no provisional recommendation. The browser alone
owns scheduling. No new production dependency, worker, service, learned
coefficient or Cold Clear code is used.

Input: locked-only `heap` of forty ten-character `#`/`.` rows; active
`{id,kind,x,y,rotation,lastAction}`; held instance or null; at most six ordered
`visibleNext` instances; `holdRule:'unlimited-swap'`; and
`rules:{version:STCore.version,mode:'st-lab',kickset:'SRS+',gravity:false}`.
Duplicate IDs, invalid poses/rules, overlapping active pieces, malformed preview
and pre-existing full editor rows reject. `visiblePreview(queue)` alone projects
the renderer's seven raw entries/six clipped slots; ambiguous separators reject.

Search independently enumerates grounded placements and their clear results.
Non-clearing construction stays in x≤6; Right candidates are Z caps, vertical I
staging/cleanup and exact doubles. No old matcher is called. The lexicographic
candidate ordering remains: revalidate preferred target, fewer buried Left cells,
fewer new channels/vacancies, less unfinished Center work, preserved Right geometry,
smaller Left/Center height difference, fewer holds, then clears and fixed pose
order. These are engineering search heuristics, **not acceptance predicates or
learned weights**.

Each retained first move owns a resumable depth-first continuation. Initially
each receives up to **512 charged units**, in rank order, unless a complete
acceptable witness or the shared budget ends the decision. Thereafter three of
four turns favor an unfinished search by preferred-target status, maximum depth
reached, best geometric rank seen, then original root order. Every fourth turn
revisits unfinished alternatives round-robin. These signals can favor fruitless
subtrees; they are not proof of a future endpoint. Suspended searches resume,
not restart. All roots share the original whole-decision limits below.

A BFS indexed by heap, piece kind, actual pose and last action serves multiple
placement requests, keeping unrestricted and non-mini-spin paths distinct.
Only grounded placement/clear facts are shared by heap and kind. Hold, identities,
ordered preview, following spawns and clear-translated obligations remain separate
for every candidate, even when its cells match another's. Paths remain short BFS
command routes, not a human timing guarantee.

The first complete acceptable witness normally wins. A fully verified alternative
may wait while an old preferred target receives fresh validation; it is usable
if preferred searches finish without a witness or the work budget ends. A partial
route or high rank never becomes advice. Comparison of every viable first move
or exact optimality is not claimed. See [allocation measurements](docs/st-search-allocation.md).

Whole-decision defaults/ceilings:

| Limit | Value |
| --- | ---: |
| Actual locks | 3 |
| Expanded movement poses, including failed/virtual probes | 60,000 |
| Attempted lock-path candidates | 600 |
| Geometric candidate probes | 120,000 |
| Candidates retained per state | 12 |

Smaller nonnegative work limits, depth 1–3 and width 1–12 are supported for
experiments. No per-node reset. Calculation-local LRU caches index at most **16
movement graphs and 16 geometry entries**; suspended roots may each reference one
additional evicted traversal. Each graph has at most 3,200 pose/action states;
each geometry enumeration considers at most 1,152 poses. No cache survives a
calculation or caches a resource-state acceptance result. Evicted work, if needed
again, is recomputed and charged again.

Each real movement expansion and lock-path attempt is charged. Geometric charges
include newly enumerated poses, resource-dependent placement/spawn/debt checks
(even on a geometry hit), and hypothetical terminal queries. Reused work is not
charged as though it were recomputed; the unchanged ceilings now buy different
amounts of useful search. These units are not equivalent CPU-time promises.
Exhaustion never emits an incomplete target. Width
pruning and these limits can miss good continuations. Empty/mirrored or otherwise
unestablished Right stacks abstain before search.

`st-lab.js` resumes at most 16,384 charged units and approximately **4 ms** per
render, with a **750 ms elapsed decision deadline**. These are scheduling limits,
not hard real-time guarantees: a unit or GC can overrun a slice. Real-browser
synchronous stress decisions motivated slicing; see retained playtest evidence.
Snapshot changes cancel the old generator, including while hidden. No async
completion callback or hidden-state cache exists.

`stLab.diagnostics()` returns a copy of the current result and adapter counters:
requested/effective **verified** horizon, maximum reached depth, work counts,
width/path/spawn/endpoint rejection counts, stop reason, full witness, elapsed
and CPU work time, maximum observed slice, cancellations and target churn. Root
diagnostics report retained resource-distinct candidates, initial/total work,
turns, reached depth and completion status; cache build/reuse/eviction counts and
indexed entry counts describe calculation-local reuse. `searchStop` can record
budget exhaustion while preserving an already fully verified fallback witness.
Abstentions have effective verified horizon zero, even if a rejected branch
reached depth three. `no-core-fit-found` is the retained UI reason code, not a
claim that no continuation exists. Time/work exhaustion is reported separately.

## Sources, tests and remaining decision

Terminology/geometry derive from [Hard Drop ST Stacking rev 37604](https://harddrop.com/w/index.php?title=ST_Stacking&oldid=37604)
and [Shocky's ST Stacking Guide](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit),
including §3.2 pairs, §3.3 freestyle and §§5–7 resource conflicts. The retained
[Marathon reference](references/st-stacking/README.md) supplies observed endpoints,
not recovered queues or player intent. The four-concept analysis informed the
obligation vocabulary; the independent implementation does not copy/translate
Cold Clear's MPL implementation or coefficients.

See [TESTING.md](TESTING.md#st-lab-behavioral-coverage), `npm test`, and
`node scripts/st-trial.cjs`. Independent literal fixtures remain test-only, not
runtime start certificates. Old matcher-output assertions were replaced
intentionally; actual-engine/control safety checks were retained and extended.
A legal old quad without an ST ladder now abstains, and a visible S no longer
blanket-vetoes LO. These are intended changes, not compatibility regressions.

This is a static GitHub Pages app with no build step. This branch is for an
isolated local playtest and PR review only; no production deployment or merge is
authorized. Coverage, closed-loop abstentions and browser limitations are reported
in the [playtest handoff](docs/st-playtest.md), not concealed as universal wins.
