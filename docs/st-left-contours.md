# Left contour dependencies

`st-left-contours.js` contains 90 oriented Left skylines with stable LC-001
through LC-090 identities. Normalize the four nonnegative column heights by
subtracting their minimum, without mirroring. `lookup` uses one indexed lookup
and returns a deeply frozen record. Invalid and unlisted inputs return `null`.

The model applies each dependency to every board with the same normalized
contour. Covered cells, absolute height, and phase do not change catalog
applicability. A dependency is not a legal movement witness: actual board,
rotation, reachability and resource admission still belong to the planner.

## Compact representation

The module stores tuples `[profile, shapeNumber, tier, alternatives]`, with the
array position defining the stable contour ID. Existing shape/tier matches are
preserved; null means ungraded. Each alternative is
`[orderedPieces, targetPaths, optionalCrossingPathIndexes]`:

- `["L", [[5]]]` reaches LC-005 using L.
- `["OO", [[2, 1]]]` passes through LC-002 and returns to LC-001.
- `["OJ", [[2, 3], [2, 6]]]` keeps both distinct target paths.

The 126 alternatives cover 57 contours and retain all 133 paths (39 one-piece,
94 two-piece). Paths preserve intermediate IDs, repeated pieces and the one
same-contour cycle. The one Center-crossing path, LC-090 → LC-001 with L,
retains its flag. No source, phase, audit, geometry, occurrence counts or
provenance fields or sidecar are retained by this datastore.

Lookup expands a tuple into the familiar identity/profile/knownShape/knownTier
record with `dependencies`. A known dependency has ordered `pieces` and `paths`,
where each path has `contours` and `crossesCenter`. Alternatives are OR choices;
all pieces in an alternative are required in order. The other 33 records use
`{ status: "unknown", alternatives: [] }`. Unknown is not dependency-free or
proof that no route exists. A known record with no usable supply match remains
known with zero current candidates. An unlisted contour has status `unlisted`.

## Finite public query

`candidates(heights, supply, options)` filters stored alternatives through
`schedule`. Supply includes active, HOLD, finite queue and current HOLD
availability. Pieces can be strings or `{type, id}` tokens. The result includes
piece instances and HOLD counts for every scheduled lock. Queue exhaustion
never invents another active piece. Ordered sequences cannot reuse a token.

By default, only consecutive dependency locks and Left-only paths match.
`allowIntervening` includes explicitly marked intervening locks; it does not
prove a safe place to park them or that they leave the contour unchanged.
`allowCrossing` includes flagged paths. `unlimitedHold` selects the current
profile's unlimited swaps; otherwise `canHold` enforces legacy one-swap rules.
`canUse` can reject an instance using the complete scheduled prefix.
`schedule` returns matched, unavailable, or incomplete plus its steps. A bounded
state budget (4,096 by default) stops expensive intervening-lock queries;
`candidates.complete: false` distinguishes unfinished matching from no match.

`st-left-dependencies.js` adapts current planner positions and projected resource
views without rebuilding accounting. Its query models the actual rules profile,
reserves Center partner types and established Right-I demands, requires matching
Hanging S/L identities, and limits Extra Z by the current allowance. Ordinary T
is not a free Left repair. This is necessary resource feasibility, not a replacement
for route projection or admission. Inputs are not mutated, hidden supply is not
read, and every candidate explicitly has `executionVerified: false`.

The modules support CommonJS, classic browser scripts and workers. Querying is
separate from live coaching policy; this conversion does not change ranking,
Reset, movement legality or resource accounting.

## Verification

Run `npm test` on the pinned runtime. Focused suites check all stable identities,
existing tiers, 57/33 status split, 126 alternatives, 133 paths, crossing/cycle
preservation, immutability, malformed inputs, finite supply, order/multiplicity,
HOLD variants, reservations and browser/worker-style loading. The old transition
extractor and its source/audit tests are removed with the obsolete representation.
