# Milestone-one reachable ST corpus

`st-fixtures.js` provides 27 midgame observations: the original 24 cases plus three manually reviewed development regressions. The original collection contains 11 development, 12 historically held-out, and one scope diagnostic; reviewed cases are not fresh generalization evidence. None is an empty-board coaching problem. The planner must receive only `fixture.observation`, never its ID, provenance, reference witness, expectations, construction, or private `future` tail.

## Provenance, and what is not known

The boards come from the independently decoded repository Fumen references:

- `references/st-stacking/hXc2nbXcXOc.fumen`: sprint, right-side scoring. The first 92 locks have saved executable witnesses.
- `references/st-stacking/sm22939781.fumen`: independent Marathon source, left-side scoring. A 145-lock prefix is reflected horizontally into right-side scoring; a separate 21-lock original-orientation prefix supplies the unsupported-scope diagnostic. Reflection swaps J/L and S/Z. Reflected input witnesses were searched again under the actual kick rules, not assumed valid by swapping left/right inputs.

These videos' exports give locked placement types and boards, not the original active/hold/preview state or keypresses. A synthetic original draw stream and once-per-lock hold sequence was reconstructed by searching valid seven-bag permutations consistent with the placement-type sequence. The sprint reconstruction delays its first empty hold until placement 21, giving a nontrivial midgame empty-hold example. The Marathon reconstruction is independent.

Every stored construction starts empty, spawns the first draw, and executes recorded legal inputs through `st-zero-v1`. Movement witnesses were discovered by reachable-state search and then stored. At each lock, the colored resulting board and clear count are compared with the independent Fumen decoder. The expected boards are source data, not merely serialized rules-kernel output. Tests cover all 258 saved lock witnesses. These are proofs of legal *synthetic* provenance, not claims to reproduce the players' original inputs, random seeds, hold decisions, or gravity timings.

All fixture previews contain six visible pieces. The separate `future` tail is only for the game host to reveal after actual consumption. Known bag evidence is computed from the synthetic draw history through the end of the visible preview. It therefore describes the bag frontier after the preview, not after the active piece. The unknown-history case uses only its visible preview with unknown bag phase; it does not reinterpret reordered active/held pieces as a draw history.

## Cases

Development cases include O and J/L fillers, empty hold, occupied hold, direct and held T-spin doubles, and post-clear rebuilding. Several boards permit multiple sensible moves; the stored reference witness is not a unique-answer requirement.

Held-out sprint cases vary stack height and phase, include post-quad and post-double states, unknown bag history, and a currently moved active T. Four independent Marathon cases add preparation, immediate T-spin doubles at two different points, and post-double rebuilding. Their Fumen source differs from the development source. Do not tune planner weights against held-out outcomes and then describe the same evaluation as unseen.

`left-side-diagnostic` intentionally retains the original Marathon orientation. Initial milestone coaching targets right-side ST; this case checks scope honesty. A diagnostic result is preferable to claiming that a reachable left-side board has no continuation. The recorded legal full TSD remains available as a rules/provenance check.

`deviated-o-recovery` is a development-only modest damaged-stack case. After 12 proven sprint locks, an alternate legal O placement (`L L L L HD`) puts O in columns 1–2. Its left roughness is 3 instead of the source placement's 1, with zero left sealed cavities and an open scoring channel. The next active J can be held to place a preview O using `HOLD L L HD`, returning roughness to 1. This is an existence witness, not a required answer. Acceptance is structural: regional support retained, scoring channel open, zero left sealed cells, height below 20. The provenance records the extra lock separately; the deviated board and recovery are explicitly synthetic, not claimed to match the video.

This corpus is small, curated, and does not establish broad strategy quality, general damaged-stack recovery, stochastic robustness, or an infinite sustainable cycle. The modest O-placement recovery does not establish recovery from sealed cavities or major damage. Held-out results should be reported per case with resource limits and evidence horizons, not as a blanket certification.

## API and validation

Browser global `STFixtures` and CommonJS exports expose:

- `list`: metadata, observations, private game tails and reference expectations.
- `get(id)` / `create(id)`: deep-cloned fixture, with `state` aliasing its cloned `observation` for the game host.
- `constructions`: the three audited synthetic reconstructions.
- `construction`: backwards-compatible alias of the sprint construction.

`test/st-fixtures.test.cjs` validates independent source boards/clear counts; seven-bag stream validity; complete empty-board replay; snapshot active pose, hold eligibility and stream cursor; exact visible/private queue partition; bag evidence; every reference witness; and clone isolation. A reference-only closed-loop test runs two nonclearing placements, a full T-spin double, and a nonclearing rebuild while revealing private future pieces only as needed. This proves that the playable fixture stream supports the cycle, not that the planner selects it. Separate planner and UI acceptance must establish coaching behavior and target stability.

Run: `node --test test/st-fixtures.test.cjs`.

## Reviewed scoring-cycle cases

The internal regression fixtures use descriptive names, not reference page numbers. See [ST lab](../ST-LAB.md) for the selectable play modes.

- **Restore the right cap**: sprint placement 83, a usable Z cap should precede optional filling.
- **Center before quad cleanup**: sprint placement 92, center S instead of an ordinary single followed by a quad.
- **Double above the cleanup I**: mirrored Marathon placement 145, a ready T-double above an existing column-eight I.

All original 24 fixture objects remain unchanged. The additional construction witnesses extend the existing synthetic streams; they do not claim to recover original preview or hold history. The three new cases are reviewed regressions, not untouched validation. See [cycle policy and validation](st-cycle-review.md).
