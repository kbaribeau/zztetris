# Infinite TST video reference

[`RA8YaBH-5zQ.fumen`](RA8YaBH-5zQ.fumen) reconstructs the placement sequence in
[Infinite TST Marathon [PPT]](https://www.youtube.com/watch?v=RA8YaBH-5zQ) by
Nilgiri306. It contains **400 placements and 150 cleared lines** in 401 pages,
including a final-board page. There are **48 three-line clears and three two-line
clears**, all made with T pieces. The source ends with Marathon completion at
150 lines; its final HUD shows time 4:57.08 and score 1,808,342.

Paste the raw file into **Load Data** at [Fumen](https://fumen.sixwi.de/) to step
through the run. [`RA8YaBH-5zQ.json`](RA8YaBH-5zQ.json) contains canonical Fumen
operations, cleared rows, zero-based evidence frames, provenance, source/export
hashes and the final board. Coordinates use `x=0` at the left and `y=0` at the
bottom. Final-board rows and the explicitly named overlay-cell pairs are ordered
bottom to top / `[y,x]` respectively. Evidence times refer to observed poses or
boards, **not exact lock times**. The MP4 has 60 frames per second.

## Intended use

This is an inspectable reference for a future infinite-TST/tower lab: repeated
triple structures, supporting stack shapes and piece allocation. It is separate
from the ST-stacking references and is not loaded by the runtime or used to tune
the current ST coach. It adds no starting positions, gameplay changes or advice
rules. Review individual positions before adopting them as independent fixtures
or normative coaching examples.

## Reconstruction and validation

The sequence was reconstructed from the user-supplied copy of the linked video.
All 20 visible rows were retained; the post-clear stack reaches 19 rows. Temporal
backtracking distinguishes tentative active-piece poses from subsequent settled
placements. Colour evidence distinguishes pieces whose cells disappear in a
clear; occupancy alone cannot distinguish some T and L hypotheses.

- Every placement's replayed occupied cells have a matching full-colour video
  observation. For the first 399 boards, up to four additional sampled cells
  can belong to the next active piece or visual effects; no occupied replay
  cell is omitted from comparison.
- All 51 pre-clear boards match the video exactly, including the clearing
  piece and all occupied/empty cells, before the animation.
- For the final board, all 100 occupied cells match frame 17621. Six extra
  classified cells in otherwise-empty top rows are the victory text, not
  stack cells. The JSON records their `[y,x]` positions. Later character
  animation obscures the board, so this is not a claim of an unobstructed
  end-screen comparison.
- Fumen encode/decode round-trips exactly. Every placement fits, has support,
  clears the recorded rows and yields the next field. Conservation is
  `400 × 4 − 150 × 10 = 100` final occupied cells.

Run `node references/infinite-tst/validate.cjs` from the repository root to check
the committed Fumen against its JSON and replay every transition. This checks
artifact consistency, **not** the original video transcription by itself.

## Limits and provenance

Movement inputs, hold/queue history, rotation/kick paths and exact lock timing
are not reconstructed. Symmetric piece orientations are canonicalized. A legal
final placement is not proof of its original input path. T-spin eligibility,
back-to-back state, scoring and timing are not simulated; the source's on-screen
labels are not a reimplementation of PPT's rules. The in-game clock and media
timestamps are different and must not be treated as interchangeable.

Original source: <https://www.youtube.com/watch?v=RA8YaBH-5zQ>.
Only newly reconstructed placement data and documentation are included. No
original video, audio or screenshots are redistributed. Attribution does not
assert a licence grant for the source media; the repository licence is unchanged.
