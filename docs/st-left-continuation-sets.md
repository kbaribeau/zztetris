# Coach-specific Left continuation sets

Stored Left and Center continuations are mostly an optimization, and also a library of known good play. They could support an education tool for human players, but that feature has not been developed. This document describes the Left catalog mechanics; catalog membership does not establish current move permission.

The 133 stored source-specific routes retain their archival identities. Runtime
catalog membership is explicit: 3 opener, 124 midgame, 4 Reset, and 2 unresolved
phase-straddling routes. Unresolved routes remain in the archival union but are
excluded from runtime coach catalogs. Membership is context, not move permission.

Ordinary midgame requests its own catalog. Reset requests the Reset catalog only
after existing admission; its T discovery requires active Reset at progress 1.
Actual locks still verify movement, resource identity, zero-clear Left T scope,
access and obligations. Route progress breaks ties after Reset progress and the
existing score; it does not replace those priorities.

The opener does not consume these catalogs as a stored-contour or pooled-piece
planner. Its established source patterns and sourceConstruction are unchanged.
Explicit opener lookup remains a discovery API, not an integration into advice.

The recovered catalog preserves the reviewed route membership and excludes the
two ambiguous transitions rather than inferring permission from their endpoints.
Later target generation and physical rules remain separate from catalog lookup.

## Recorded candidate: two Left Ts, D → B

**Reset-only geometric candidate; excluded from runtime.** Kevin submitted a
post-placement position on 2026-11-20. Reconstruction on `a4aa946` verifies both
orders below; neither is an observed historical sequence. These two candidate
paths are documentation only, outside the 133 stored routes and all runtime
membership counts above.

| Placement order | Contour path             | Normalized profiles                     |
| --------------- | ------------------------ | --------------------------------------- |
| Left T, right T | LC-009 → LC-027 → LC-007 | `[0,1,1,0]` → `[3,2,1,0]` → `[1,0,0,1]` |
| Right T, left T | LC-009 → LC-032 → LC-007 | `[0,1,1,0]` → `[0,1,2,3]` → `[1,0,0,1]` |

The start is existing D-tier LC-009; the endpoint is existing B-tier LC-007.
Both intermediate contours are ungraded. Absolute Left heights change from
`[9,10,10,9]` to `[12,11,11,12]`, without covered Left cells. This is a verified
contour improvement, not proof of stable ordinary play after Reset.

### Reproducible geometry

The submitted board has 28 empty rows followed by these 12 rows, top to bottom:

```text
T..T......
TTTT......
TSSTLLL...
SSOOLSS...
JJOOSS....
JOOILLL...
JOOILSS...
JJLISS...Z
JJLILLL.ZZ
JJLLLSS.Z.
OOSSOOJ.Z.
IJJJLSS.Z.
```

Removing all eight T-colored cells yields the reconstructed starting board.
There is exactly one partition of those cells into two intact T tetrominoes:
using one-based columns and full-board rows, the left T occupies
`(1,29),(1,30),(2,30),(1,31)` and the right T occupies
`(4,29),(3,30),(4,30),(4,31)`. This uniqueness assumes intact pieces; it does not
recover actual order, earlier clears, intervening moves or piece identities.

Under `st-zero-v2`, independently spawning a T for each geometric test verifies
these witnesses in either order:

- Left T: `L L L CW L HD`.
- Right T: `L CCW HD`.

Both locks clear zero lines, lie wholly in Left and preserve the established
notch. They satisfy the qualifying Reset-T footprint predicate. The test's two
fresh Ts are hypothetical supply, not evidence of historical availability or
permission to spend them. The submitted **post-position** has active Z, held I
and preview `J O S Z L T`; these must not be assigned to the reconstructed start.

### Limits and possible activation

The post-position does not establish the native opening boundary, Reset progress,
Z account, original S/L obligations or the two T identities and arrivals.
Before treating this as an admitted Reset example, verify a native pre-first-T
checkpoint and its recorded actions/reveals through both locks. An ordinary
scoring follow-up with remaining obligations tracked would support a claim of a
good Reset exit; geometric D → B alone does not establish that claim.

The current dependency validator requires S/SS endpoints, so neither B-ending
path can be added as an active dependency unchanged. Existing pose enumeration,
contour lookup and Reset validation can supply the mechanics, but active use
would need an explicit Reset-specific completion contract for a B endpoint,
without relaxing ordinary dependency validation or Reset entry. A narrower
`LC-027 → LC-007` or `LC-032 → LC-007` second-T route is a natural candidate:
current Reset T discovery already requires active Reset at progress 1. Its
validator would still need actual available T identity, zero-clear Left placement,
notch/access/headroom and resource checks, followed by the existing second-T
handoff. Runtime completion would not imply ordinary stability.

LC-007 already has ordinary recovery dependencies, including S → LC-001 (SS).
This is a possible follow-up to verify with an actually eligible S and legal
intervening moves. The visible post-position S is not immediately active, and its
historical resource eligibility is unknown; no `TT S` historical replay or
complete scoring continuation is claimed here.
