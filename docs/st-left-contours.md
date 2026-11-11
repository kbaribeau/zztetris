# Observed Left contour registry

`st-left-contours.js` stores the 90 oriented Left skylines discovered in
[Supershocky's Sprint 1000L replay 26536180](https://jstris.jezevec10.com/replay/26536180).
The source is the existing `references/st-stacking/jstris-26536180.fumen`,
SHA-256 `b62f906ee217ab121e96e71f5348e4e778d045607e2ddea994dc8e4390b36ae4`,
as analyzed at commit `3f5627a52446bc8d099d34dc94c6ca2c3b7d66e2`.
The neighboring source JSON documents conversion and verification limits.

## Identity and lookup

Take the highest occupied cell in each of columns 1–4, expressed as four
nonnegative integer heights from the floor. Subtract their minimum and preserve
left-to-right orientation. Color, absolute height, and mirroring are not part of
normalization. Covered cells are separate facts, not encoded in the skyline.

The module works with CommonJS `require('./st-left-contours.js')`, a classic
browser script, or a worker's `importScripts`. Browser/worker exports are under
`STLeftContours`. It has no DOM, other-module, network, or search dependencies.

```js
const contours = require("../st-left-contours.js");
contours.lookup([7, 7, 8, 8]); // LC-001, normalized key "0,0,1,1"
contours.lookup([8, 8, 7, 7]); // LC-002, not a mirrored LC-001
contours.lookup([0, 0, 0, 99]); // null: not in this observed catalog
```

`normalize` returns a fresh four-height array; `key` returns its comma-separated
key. Invalid inputs return `null`. `lookup` performs fixed-size normalization
and a single Map lookup, returning the same deeply frozen record each time.
`catalog` and `source` are also deeply frozen. IDs remain the original
`LC-001`–`LC-090` review IDs, not a preference ranking.

## Source coverage

All 2,519 post-lock, post-line-clear states and the initial empty board are
represented. Repeated states after moves outside Left still count. Entries
contain identity, profile, existing shape/tier matches, and dependencies only;
the per-entry `observations` field is omitted. Aggregate source statistics
remain under `source`, and the tests reconstruct them from the pinned Fumen,
including this source-based opening partition:

- 79 later-only contours and 7 seen both during opening and later play.
- 3 opening-only contours: LC-076 `[2,1,0,3]` at lock 7, LC-081 `[4,1,0,1]`
  at lock 11, and LC-072 `[1,0,0,5]` at lock 15.
- LC-090 `[0,0,0,0]` is initial-only, with zero post-lock observations.

The boundary is lock 17, the first recorded right-side T two-line clear. It is
not a reconstruction of the engine's phase badge, a spin classification, or a
claim that these contours can only occur in those phases. Later play includes
resets. A translated flat surface still matches LC-090, but this recording only
observed the empty-board instance.

There are 65 covered observations, 19 contours with covered observations, and
16 contours seen only with covered cells. Three contours have both clean and
covered observations. These are 90 skylines but 93 distinct occupancy variants.
The registry does not store full boards or assert that any covered cell is
inaccessible.

`knownShape` and `knownTier` retain the 12 existing matches in
`STStructure.leftSurface.catalog`. They are skyline metadata, not reviewed
dependencies, safety ratings for covered variants, or newly inferred tiers.
Unknown matches remain `null`.

## Dependencies and alternatives

All 90 entries currently have `{ status: 'unknown', alternatives: [] }`.
No dependencies were supplied in the annotation catalog. Unknown means
**unreviewed**, never "needs no pieces". Existing coaching rules are not copied
into universally applicable dependencies for every board with the same skyline.

After a dependency is explicitly reviewed, `status: 'known'` requires one or
more complete alternatives, with all pieces required within each alternative.
The following is a **schema example only**, not a claim about any contour:

```js
{
  status: 'known',
  alternatives: [
    { pieces: ['J'], order: 'unordered', conditions: 'Reviewed condition A',
      evidence: 'Review/source identifying this alternative' },
    { pieces: ['I', 'I', 'O'], order: 'ordered', conditions: 'Reviewed condition B',
      evidence: 'Review/source identifying this alternative' }
  ]
}
```

Alternatives are OR choices. Each `pieces` array is an AND requirement, keeping
repeated pieces and, when ordered, their sequence. `unordered` does not claim
that every order is executable. `conditions` must be supplied explicitly (an
empty string means no recorded qualification); `evidence` must be nonempty.
A reviewed dependency-free case uses one alternative with `pieces: []`, not an
unknown record. `validateDependencies` checks this data shape but does not prove
the claim, movement, availability, resource allocation, or a safe continuation.

This commit is storage and lookup only. No planner, evaluator, page loader, or
worker pipeline consumes this catalog yet. It does not change advice, ranking,
legality, admission, reset behavior, or the existing 12-shape tier catalog.

## Verification

`test/st-left-contours.test.cjs` reconstructs every settled source board using
the committed Fumen, verifies all 90 identities/profiles, checks aggregate
opening/covered source statistics and existing skyline matches, requires that
entries omit `observations`, and exercises
unknown/known alternative schemas, repeated pieces, immutability, translation,
orientation, invalid inputs, and browser/worker-style loading. Run the normal
repository delivery suite with `npm test` on the pinned Node version.

## Recorded one- and two-piece transitions

The deeply frozen `transitions` export adds a reproducible, source-specific
catalog of routes ending at an existing **SS or S** skyline. It contains **133
distinct routes and 717 observed occurrences** from all 2,519 locks of the
Shocky 1000-line recording. No tier is invented for an unrecognized skyline:
`knownTier: null` means ungraded, not bad. The 90 contour identities/profiles,
dependency unknowns and alternative schema remain unchanged.

- 39 distinct one-piece routes / 359 occurrences.
- 94 distinct two-piece routes / 358 occurrences.
- 132 Left-only routes / 716 occurrences; one Left/Center-crossing route /
  one occurrence, stored separately.
- 129 later-play routes / 713 occurrences; three opening routes / three
  occurrences. The pair at locks 16 and 21 straddles the original opening
  boundary at lock 17 and has its own `opening-boundary` catalog.
- One exact-contour return route occurs three times: O then O, S → A → S,
  at locks 228/229, 423/435 and 572/574. Intermediate C/D and ungraded contours
  are also retained when the endpoint is SS/S.

A piece counts only if it touches columns 1–4 **and changes the normalized
contour**. Two-piece routes use consecutive such Left placements, ignoring
intervening pieces wholly outside Left only when their contour is verified
unchanged. A Left-touching placement that does not change the contour is an
interruption, not a piece to skip: this occurs at J1560 and I1581. A crossing
placement is never silently skipped to join two pure-Left moves; any route
containing one belongs to `leftCenterCrossing`. The intermediate grade is
unrestricted, and two contour changes may return to the starting contour.

### Recorded moves, context and deduplication

Every route is stored once with source identity, phase, placement class, the
ordered contour path, actual recorded piece/rotation/pose/cell geometry and an
aggregate `observedCount`. The runtime catalog contains **no per-occurrence
references**: no source-lock lists, absolute bases, covered-count arrays or
ignored-lock lists for its 717 observations. All 133 geometries are distinct,
even when source, phase and placement class are ignored.

Vertical coordinates and cleared rows are relative to the Left minimum
immediately before each placement. Exact boards and source-lock provenance can
be regenerated from the pinned Fumen with the extractor's optional external
evidence output. That research file preserves every occurrence's one-based
source locks, per-move absolute minimum, covered-cell counts and ignored locks.
It remains outside Git and is not loaded by the runtime module. Add its
`leftBasesBefore[i]` to the route's relative y values to recover actual poses.

Replaying **all** intervening locks recovers center/right support and line
clears; ignoring a lock for the one/two-piece count does not remove its board
effects. The pre-lock board is the corresponding Fumen page field. Its
post-lock board is that field after placement and line clear, including the
final page. These are lock poses, not verified controller input sequences.

Identical ordered geometry shares a route only within the same source,
phase and placement class. Different moves, intermediate contours or clear
geometry stay separate even when their start/end and piece names match.
Covered/full-board variants are context-specific observations, never a claim
that a route works for every board with the same skyline. A one-piece suffix
and its two-piece route are intentionally different observations.

### Clear-invariance check and limits

All **1,506 outside-Left locks**, including **417 line-clear events / 1,000
lines**, preserve the normalized contour in this recording. There are no
corpus counterexamples. This is a measured property, not a universal theorem:
if a clear removes a column's highest cell and exposes covered empty space
below, column heights need not all decrease by the same scalar. A supported
right-only I clear in the synthetic regression changes Left heights
`[3,3,4,4]` to `[0,2,3,3]`, changing the normalized contour. The extractor audits
all outside locks and explicitly records and breaks a route at any such
counterexample instead of assuming it cannot happen.

This is descriptive data, not an exhaustive search or coaching integration.
An observed route does not prove future piece availability, resource permission,
strategic safety, a safe continuation, universal reachability or a dependency
alternative. No planner or browser/worker production loader consumes the new
transition data.

### Reproduce and verify

Run `node scripts/record-st-left-transitions.cjs --check` to rebuild the data
in memory and compare it with the stored payload, or `--write` to regenerate
only the marked transition section, preserving the observation-free contour
entries. Run Prettier on the changed source after
writing; the check compares parsed values rather than formatting. The script
accepts `--evidence /absolute/path/outside/repo/new-file.json` to retain the
regenerated occurrence evidence without adding it to the runtime catalog. It
never overwrites an existing evidence file. The script also reports
route/occurrence counts, full JavaScript file bytes and compact
transition JSON bytes. The file remains a JavaScript module, not a standalone
`.json` file.

`test/st-left-transitions.test.cjs` checks exact generated data, independent
nearest-Left occurrence enumeration, all unique moves and regenerated occurrence contexts against
source replay, deduplication, phase boundaries, crossing segregation, cycles,
ungraded and C/D intermediates, unchanged-Left interruptions and the synthetic
clear counterexample. The existing contour suite independently reconstructs
all settled boards and verifies that the original inventory is unchanged.
