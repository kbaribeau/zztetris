# Left surface context

`st-left-context.js` adds a soft ordinary-planner preference, not a legality rule or
new strategy phase. The opener, Reset gates, scoring-T obligation, resource guards,
real input replay, and production 1500 ms / 45,000-node limits are unchanged.

## Source and scope

Shocky's ST Stacking Guide, Chapter 3.3 (page 9), supplies twelve **oriented**
solid-column Left silhouettes and their SS–D tiers. Mirrors are not equivalent.
The captured page was checked visually; the exact profiles are executable fixtures.
Source: https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit

The guide permits a lower-tier surface when upcoming pieces quickly improve it;
its D warning specifically concerns an immediately available J. Chapters 6 and 8
stress local O accommodation and explain why tiers are less useful after spending
Extra Z when T occupies HOLD. They do not prescribe numeric evaluation weights.

## Engineering model

- Exact normalized profiles only; covered Left cells and unlisted profiles retain
  the old generic evaluation without a guessed tier.
- The source/context term breaks ties after the existing structural band and
  executed-TSD/verified-entry priority, input effort and cleared lines.
  It cannot override those priorities. Existing generic Left roughness remains
  a limitation: this is contextual ranking, not a full geometry replacement.
  The new term rewards source profiles and visible fit, not generic flatness. Numeric tier weights (6,4,2,0,-2,-4), fit adjustments and two-lock horizon
  are engineering choices, not quoted guidance.
- Estimate solid-column placements using active, HOLD, canHold and the actual
  ordered visible queue. HOLD transitions consume draws normally. No hidden
  generator or unseen piece is consulted. The probe is limited to consecutive
  Left allocations; it does not pretend to spend intervening pieces elsewhere.
- Do not count T as Left filler. S/L require the actual observed hanging token.
  Z needs the available one-time allowance and cannot be reused twice or diverted
  from a current Right cap. Center partner types and established Right I demand
  are conservatively reserved. The full planner remains the resource authority.
- With Extra Z spent and T held, retain generic geometry and use the geometric
  fit/conversion adjustment without asserting another static tier ranking.

These are **geometric estimates**, not certified repair paths. They do not model
SRS routing, active-pose access or line clearing. `executionVerified:false` makes
that boundary explicit. Only the real planner's returned replay proves moves.
Unknown historical resource identities are not fabricated. A session engine
compatibility stamp changes because otherwise identical imports can now receive
different advice; the JSON session schema is unchanged.

Focused tests: `node --test test/st-left-context.test.cjs`.

The diagnostic `adjustment` is an alias of the contextual score, **not** permission
to add it to `structuralScore`. Only the final rank entry consumes `score`.
The integration fixture uses a synthetic source-profile board and proves that
this final tie-break is active; it does not establish natural-game improvement.

## Validation and limits (2026-10-26)

The first experiment replaced generic roughness with the source term. It failed
six existing strategy assertions and regressed the declared ten-seed cohort from
537 to 511 locks, 130 to 122 lines, and 51 to 47 TSDs. Moving the term before input
effort still displaced established preparation routes. Neither experiment is the
shipped ranking; tests were not weakened to accept those changes.

The final integration preserves all existing numeric priorities. The same ten
seeds (2718280001 + 1009 × 0…9), normal 1500 ms / 45,000-node limits, depth 3,
width 8 and 2000-lock cap exactly matched baseline outcomes: 537 locks, 130 lines,
51 TSDs and 7 quads. All ten ended in abstention, not top-out. Independent replay
found no ordinary non-scoring T or repeated Left/Center Z allowance. This is
preservation evidence, **not** improved survival or Reset readiness. Nine placement
streams matched exactly; seed 2718287064 changed O/L order at locks 55–56 and
then reconverged. That production-clock difference alone does not isolate
context scoring from bounded-search timing. An isolated frozen-clock check
of that pre-lock-55 root chose L first in both engines on both repetitions;
the production difference is not established as a contextual-score effect.

A separate frozen-clock, node-bounded diagnostic used thirty baseline-observed
roots and two alternating-order repetitions. All sixty selected target sequences
matched, with valid replay witnesses. Aggregate runtime was 57.533 s versus
56.948 s (+1.03%); the median paired runtime ratio was +1.05%. These are noisy
single-machine measurements, not a performance improvement claim.

The conservative tie-break does not yet replace the general roughness model or
solve the broader whole-board/resource-priority design. That requires explicit
preparation priorities and independent validation before making source tiers
strong enough to override existing structural or input-effort preferences.
