# ST-stacking video references

[`sm22939781.fumen`](sm22939781.fumen) reconstructs the complete placement sequence
of the Marathon run in [NicoNico video sm22939781](https://www.nicovideo.jp/watch/sm22939781).
It contains **400 placements, 65 clear events and 152 cleared lines** in 401 pages;
the last page is the final settled board. The clear counts are one single,
52 doubles, 11 quads and one triple. The source ends with a T-spin triple and a
completion screen, then returns to its replay menu. There is one game.

Open [Fumen](https://fumen.sixwi.de/), paste the raw file into **Load Data**, and
step through the pages. [`sm22939781.json`](sm22939781.json) maps each placement
page to a zero-based source frame/time, operation and cleared rows. Arrays in
its final board run bottom to top; coordinates use `x=0` at the left and `y=0`
at the bottom. Observation times identify evidence frames, not exact lock times.
The JSON records the raw file's SHA-256, including its final newline.

## Suggested use for future ST lab work

Use this as an inspectable reference for recurring stack shapes, filler
allocation, clear sequences and possible future regression examples. Compare
specific positions with the source before turning them into independently
reviewed fixtures or general advice. See [ST-LAB.md](../../ST-LAB.md) for the
current continuation contract; this replay includes other geometry and a triple.
Mirroring a picture or reproducing a board does not establish reachable input
paths, strategic usefulness or a correct advice rule.

This data is not loaded by the runtime, a scripted lesson, an authored gameplay
start, or a normative `STCore.advise()` oracle. It does not supply the lab's
piece-instance IDs, hold state or ordered preview contract.

## Reconstruction and validation

The sequence was reconstructed from a user-supplied copy of the cited video,
with actual frame colours checked for every placement and pre/post evidence
for every clear. Temporal inspection resolved lock flashes, ghost/active
pieces and overlays before continuing. The first 55 placements were validated
separately and preserved in the combined export. No unresolved placement or
clear was retained.

Validation used `knewjade/tetris-fumen` 1.1.3: exact v115 encode/decode roundtrip,
all fit/support/collision and clear transitions, 400 placement-board comparisons,
and the final board. Fumen's editor loaded all 401 pages and displayed the
matching endpoint. Conservation is 1,600 placed cells minus 1,520 cleared cells
= 80 final cells. These checks supplement the video observations; matching the
endpoint or passing legality alone would not verify the sequence.

Movement inputs, holds, kick paths, exact lock timing and scoring classification
are not reconstructed. Fumen uses canonical orientations for symmetric pieces.
The source game's T-spin labels are not a reimplementation of its scoring rules.
This is an assisted reference transcription, not a general video converter or
proof that the lab's SRS+ rules reproduce the original game.

## Provenance

Original source: <https://www.nicovideo.jp/watch/sm22939781>.
The directory contains newly reconstructed placement data and documentation;
it redistributes no video, audio or source screenshots. Attribution does not
assert a license grant for the original video or game media. The repository's
existing license is unchanged.

## 40-line sprint: hXc2nbXcXOc

[`hXc2nbXcXOc.fumen`](hXc2nbXcXOc.fumen) reconstructs the complete run in
[ST Stacking 21.309 seconds (5.26 PPS)](https://www.youtube.com/watch?v=hXc2nbXcXOc):
**112 placements, 17 clear events and 40 cleared lines** in 113 pages, including
the final settled board. The clears are 14 doubles and three quads.
[`hXc2nbXcXOc.json`](hXc2nbXcXOc.json) records operations, zero-based evidence
frames/times, clear rows, provenance and the export hash. The final placement's
evidence is pre-clear; the earlier placement evidence is post-placement.

Reconstruction used a user-supplied 1280×720, 30 fps copy of the video. Every
placement board was compared with video evidence. The final T matches its
colored pre-clear frames, and all 48 occupied cells of the reconstructed
endpoint match the gray completion board. Independent review checked all 111
earlier placement HUD counts and all 16 earlier clear-event HUDs; the final
HUD confirms 112 placements and 21.309 seconds. No unresolved placement remains.

The repository's bundled Fumen library passed exact encode/decode roundtrip,
all field/operation comparisons, fit/support/collision and clear transitions.
Conservation is 448 placed cells minus 400 cleared cells = 48 final cells.
The viewer UI was not verified; this is decode/replay and video evidence, not
a claim of browser-editor testing. Open Fumen and paste the raw file into
**Load Data** to inspect it.

As with the Marathon reference, this is reference data only, not an ST lab
advice oracle or a reconstruction of holds, input paths, kicks, exact lock
timing or scoring. Canonical symmetric rotations may differ from the inputs.
Fit/support checks alone do not prove input reachability. No original media
is redistributed and no source-media license grant is asserted.
