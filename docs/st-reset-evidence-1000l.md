# Paired T/Z construction evidence from the 1000-line reference

Historical research at commit 20b23a5: bounded evidence and certificate experiments,
not a complete Reset recognizer. That study left the default engine unchanged.
For the subsequent scoped default recovery integration, see
[Finite construction stages](st-construction-stages.md).
The committed source is `references/st-stacking/jstris-26536180.fumen`.
Page numbers below are one-based lock/placement pages, not video frames.

## What the longer reference establishes

The structurally checked export contains 2,519 locks and 1,000 cleared lines:
334 two-line clears and 83 quads. All 334 double-clear boards admit a full right
T-spin double under an exhaustive fresh-T probe of the lab rules. This establishes
lab geometry/access, not the original game's input history or official spin credit.

Of 360 T locks, 334 clear two lines. The other 26 are entirely in the Left region.
They occur as an opening pair plus twelve later pairs. All twelve later pairs
cancel checkerboard imbalance with no intervening clear. Their 24 T placements
introduce no new internally sealed cells. Four pairs are not directly adjacent,
so a connected two-T shape is not a necessary certificate condition.

| First T | Second T | Lines before first T | First later T double |
| --- | --- | --- | --- |
| 134 | 142 | 50 | 153 |
| 366 | 367 | 142 | 372 |
| 559 | 560 | 218 | 571 |
| 813 | 814 | 318 | 819 |
| 938 | 942 | 366 | 949 |
| 1181 | 1183 | 464 | 1192 |
| 1410 | 1420 | 558 | 1427 |
| 1597 | 1605 | 632 | 1615 |
| 1844 | 1849 | 730 | 1858 |
| 2049 | 2056 | 812 | 2063 |
| 2250 | 2260 | 894 | 2264 |
| 2479 | 2488 | 984 | 2498 |

There are 25 non-right Z placements: one in the opening and 24 afterward.
That is consistent with the guide's two-Z allocation per full Reset cycle,
including Extra Z played earlier during scoring. Only 14 occur in the immediate
no-T-double windows around the pairs; ten occur amid otherwise scoring play.
This is evidence for staged accounting, not a local two-Z quota or proof that
these inferred windows are officially annotated Resets.

## Conditions that do not identify when to reset

Use L = minimum Left height (columns 1–4), C = minimum height of columns 5–6,
and A = next notch's one-based height from the recognized scoring phase.
Let R count phase-aligned empty column-seven notches with both rows immediately
above fully occupied in columns 5–7. R is geometry, not guaranteed future scores.

First-T positions 559 and 813 have (L−A, C−A, R) = (1, 5, 2), and both already
permit an immediate full TSD. Ordinary scoring controls 78 and 310 have the same
metric tuple. Excluding doubles within twenty pages of any T/Z diversion leaves
211 ordinary controls; 23 share a candidate's (min(L,C)−A, R) pair. Thus low gap,
small reserve, or absence of immediate scoring is not a universal trigger.

Do not estimate residual red-wall height from column heights alone. At 938,
column ten's four cells are a prepared I, not the Z roof suggested by H9=3,
H10=4. Setup phases and actual scoring roofs need distinct interpretation.
The first diverted T can also occur after Reset-related construction has begun:
Z937 precedes T938; Z1177 and other preparation precede T1181.

Nor does the second T, or the first subsequent double, establish completion.
At 366/367 the center reserve remains zero after the pair. Construction enables
TSD372 with one interval, and that clear leaves zero again. Building continues
until three intervals exist before TSD383. Requiring three intervals before any
resumed score would reject the recorded intermediate score.

## Bounded, visible-supply counterfactuals

The following experiments form candidate observations from the converted Fumen
quiz state, truncate preview to six pieces, and never replenish it from the
recorded future. They use lab unlimited-hold rules. The converter's quiz/hold
metadata has not been independently checked against native input/playback, so
these are synthetic candidate observations, not verified original-player preview.

At page 366, exact legal replay of T,T,S,J,Z,L,T reaches a full lab TSD in seven
locks. The two nonclearing Ts repay parity, and all notch checks pass. The default
coach refuses the initial board before searching because Center height one falls
below its established-stack maintenance profile, despite an established right
wall and a tall Left region. This is a concrete candidate for certified recovery
of an established game, not general empty-board coaching.

At page 813 the default coach instead follows T,O,S,Z,I,L,T and scores two doubles
within the same seven locks. It finishes with 56 occupied cells, height 10 and mean
column height 5.7. The source's paired-T route scores one double and finishes with
76 occupied cells, height 12 and mean 7.7. This short comparison does not establish
long-run superiority, but it strongly rejects forcing reference T diversion solely
because the source did it.

## Safe next boundary

A replay certificate can establish that a visible paired-T construction is safe
and reaches a real score without relaxing notch, cavity or center obligations.
It cannot by itself establish that initiating Reset is necessary or preferable.
Any search must generate routes from the supplied public state, not retrieve
recorded witnesses by page. Any future integration must retain parity and regional
obligations across actual locks and replanning, and compare against ordinary
alternatives at a fair horizon. Cases needing unseen supply remain unresolved.

No general Jstris adapter, import UI, reference-format migration, default policy
change or long-run sustainability claim is part of this experiment.

## Implemented research helper, not a coach change

`st-paired-repair.js` is an opt-in CommonJS research module. The default planner
and browser do not load it. Its certificate validator regenerates events from
actual legal inputs, requires two opposite-parity nonclearing Left Ts followed
by a supported right-region full TSD, and checks canonical clears, notch phase,
internal cavities, center-partner obligations and the visible supply. It rejects
competing cap/I demands conservatively instead of waiving their existing rules.
It does not certify a complete Reset or decide that a certified route is best.

The supplied page 366 seven-lock witness validates in approximately 27–33 ms.
This proves a finite recovery continuation under the synthetic public setup,
not that the coach discovered it or that it leads to indefinite play. The lab
replay proves that particular route under lab movement/hold rules, not original
Jstris input equivalence or original spin credit.

An optional generic beam search uses actual legal placements and existing
structural ranking, without fixture identifiers or recorded paths. A bounded
attempt at width 8, depth 7, 45,000 movement nodes and 750 ms did not discover the
known certificate: it completed depth 3, visited about 27,005 movement nodes and
expired at approximately 750 ms. This is a meaningful discovery-budget limitation,
not evidence the continuation is impossible. No fallback silently installs the
recorded route.

Eight focused tests cover the positive legal certificate, forged events/input,
hidden-supply rejection, partial obligations, geometry/budget failures and search
bounds. Independent review passed these controls. No identical-engine long-run
audit is warranted because default behavior is unchanged.

## Priorities for longer play

1. Develop efficient structural construction search for the narrowly demonstrated
   established-game recovery gap, rather than opening general empty-board scope.
2. Track staged parity and regional replenishment obligations across observed
   locks; do not require an entire multi-bag Reset inside six preview pieces.
3. Distinguish prepaid Extra-Z from pending cap demand using validated history
   and geometry. Six recorded nonright Z placements currently meet the existing
   spent-cap-Z guard, so a blanket T-only exception cannot cover the source.
4. Compare discovered repair routes with ordinary scoring at equal horizons,
   then test matched longer trajectories before changing default selection.

The present hard scoring-T guard rejects 16 of 24 post-opening paired-T placements;
that establishes a coverage gap, not permission to prefer every such placement.
The observed 334 T-piece double clears are not independently verified original
spin inputs; selected lab certificates have stronger, replay-based spin proof.
