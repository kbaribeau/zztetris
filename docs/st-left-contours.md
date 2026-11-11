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
const contours = require('../st-left-contours.js');
contours.lookup([7, 7, 8, 8]); // LC-001, normalized key "0,0,1,1"
contours.lookup([8, 8, 7, 7]); // LC-002, not a mirrored LC-001
contours.lookup([0, 0, 0, 99]); // null: not in this observed catalog
```

`normalize` returns a fresh four-height array; `key` returns its comma-separated
key. Invalid inputs return `null`. `lookup` performs fixed-size normalization
and a single Map lookup, returning the same deeply frozen record each time.
`catalog` and `source` are also deeply frozen. IDs remain the original
`LC-001`–`LC-090` review IDs, not a preference ranking.

## Observation metadata

All 2,519 post-lock, post-line-clear states and the initial empty board are
represented. Repeated states after moves outside Left still count. Each entry
retains source lock indices, counts, height/covered ranges, occupancy-variant
count, and the source-based opening partition:

- 79 later-only contours and 7 seen both during opening and later play.
- 3 opening-only contours: LC-076 `[2,1,0,3]` at lock 7, LC-081 `[4,1,0,1]`
  at lock 11, and LC-072 `[1,0,0,5]` at lock 15.
- LC-090 `[0,0,0,0]` is initial-only, with zero post-lock observations.

The boundary is lock 17, the first recorded right-side T two-line clear. It is
not a reconstruction of the engine's phase badge, a spin classification, or a
claim that these contours can only occur in those phases. Later play includes
resets. A translated flat surface still matches LC-090, but this recording only
observed the empty-board instance.

`cleanCount` and `holeCount` count **post-lock observations**, not cells;
`coveredRange` counts empty cells below a roof across all observations.
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
the committed Fumen, verifies all 90 entries and their source positions, checks
the opening/covered metadata and existing skyline matches, and exercises
unknown/known alternative schemas, repeated pieces, immutability, translation,
orientation, invalid inputs, and browser/worker-style loading. Run the normal
repository delivery suite with `npm test` on the pinned Node version.
