# Verified scoring and cleanup resource commitments

This revision addresses repeated abandonment of useful T and I routes. It does
not implement the complete community Midgame/Reset cycle or guarantee survival.

## Resource model

The planner records executed locks, lines, material delta (four cells per piece
minus ten per line), T doubles, I quads, Pocket preparations, and nonclearing T/I
allocations. These are diagnostic facts, not target quotas or universal bans.
An actual visible-input route to a T double, quad or Pocket preparation creates
a resource commitment. Board-derived cap and cleanup roles remain authoritative.

The bounded proof search can hold an available I while another visible piece
fills, execute the actual upcoming T double, and use that same held I when the
Pocket opens. This covers the confirmed seed20338 move33 counterexample. Cap
proof search also includes a held Z, later visible Z when a T must be retained,
and post-clear rebuilding. Search remains limited by the ordinary node/time
budget; no hidden future or bag seed is used.

## Surviving real replanning

The controller stores the accepted proof's public origin observation separately
from cosmetic advice. After a hard drop, it compares the actual lock event
(including spin), resulting board, active/held pieces and visible queue prefix
with the predicted event. It replays the remaining witness from the refreshed
visible state. Extra revealed pieces are allowed as new supply, not evidence of
an invented old identity. Goal-free suffixes retire.

A fresh worker still searches. It also replays the saved route from the actual
pose and checks canonical clears, notch phase, internal cavities and structural
cycle policy. The replacement must preserve the verified T-double/quad/Pocket
obligations. T-filler conservation applies to a protected T-double goal, and
I-filler conservation applies to a protected Pocket/quad goal, measured only
through goal completion. Incidental I repair does not spend a T reservation.
A quad can fulfil a Pocket-preparation obligation.

Replacement quality is compared at the same completed-lock horizon. If the saved
proof ends earlier, the planner uses already searched, fully checked descendants
of that exact proof to account for the same upcoming ordinary pieces. It does
not penalize the fresh route merely for including trailing filler or having a
higher maximum before later pieces are compared. Both endpoints receive the same
entry/reservoir qualification. Missing descendants or unresolved qualification
retain the verified suffix; absence after beam pruning is not proof of failure.
Endpoint prettiness alone still cannot erase an unfulfilled resource goal.

Reset, fixture changes and import clear the controller commitment. Exports omit
it. Standalone imported positions derive a fresh bounded proof from visible
geometry and supply. No arbitrary imported counter or historical phase claim is
trusted. A changed manual lock discards the route; another input path to the exact
same canonical event may preserve it. Worker identity/revision guards still
prevent stale replies from replacing current evidence.

## Important Reset limitation

In the linked Shocky guide, Reset is a deliberate sequence using two Ts and one
or two Zs in left/center to restore regional relationships before Midgame
resumes. It is not the ordinary I-tetris cleanup. Pocket is column ten; Well is
column eight. The guide advises retaining I until the Pocket opens or is tall
enough. Source: https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit

The preexisting scoring-phase guard rejects the actual nonclearing T placements
at Ultra167–168 and mirrored Marathon226–227. These are verified paired-T
constructions; their surrounding trajectories are consistent with Reset, but the
sources do not label those exact moves as Resets. Source-derived regression
controls document the T-diversion limitation explicitly. Their regional geometries differ,
so a universal height threshold or blanket T exception would be unjustified.
This revision adds no new T quota or blanket penalty, but it does NOT claim to
support those paired-T constructions. A full Reset recognizer remains separate future work.

## Validation scope

Exact confirmed I and saved-T counterexamples are regressions, including actual
page hard-drop, hold, preview refresh, reset/import, stale-response and invalid
manual-deviation cases. The follow-up comparison uses matched saved seeds at the
normal750ms budget and reports failures as well as material/height statistics.
Finite improved routes do not prove indefinite sustainability or robust openings.

## Follow-up phase protection

The matched continuation comparison exposed right-side T/L/J constructions that
left the existing notch cells empty but erased the board geometry establishing
their phase. The next fresh observation then treated those cells as unprotected.
An established phase must now remain independently recoverable after each advised
nonclearing construction. Canonical clears retain their translated phase checks;
some legal clears still leave geometry that a fresh snapshot cannot recognize. Existing buried-cap and cleanup-foundation recognition still applies;
unknown imported roots make no invented phase claim. This restricts normal advice,
not the legality of a player's manual move.

The narrower phase guard also removes unsafe roots from the bounded preparation
beam. In the previously reviewed S/L-center snapshot this exposes another legal
L→I→Z→T route beginning with L in the Left region. Both checked routes finish at
height12 without sealed cells; center-first has stronger immediate structure and
fewer inputs, while the new endpoint scores one structural band better. The
center-first assertion was preserved for manual review rather than forced by an
unrelated ranking adjustment. The subsequent approved reservation change below
replaces it with an executed-completion requirement.

## Center-partner reservations

A center completion is a resource obligation, not an unconditional instruction to
fill the Center before scoring or improving the Left. Kevin accepted either
order of the completed S/L construction and T-spin double in “Empty hold defers
T.” The regression checks replayed geometry and the settled board; separate tests
retain the different active/hold/queue states and legacy hold permission.

The supplied S/L snapshot has active L, held I, and visible queue T, Z, S, L, I,
J. Its exact notch-compatible center completion requires L, but a second L is
already visible. The previously checked L-left → I → Z → TSD route leaves that
second L active, able to complete the original Center on the fifth lock. A test
must therefore protect completion rather than hardcode immediate L-center.

Reference evidence supports this distinction. Sprint pages 59–60 complete S/L on
the same center profile immediately; pages 28–33 defer L across four Left
placements. Mirrored Marathon pages 3–8 even spend another L on the Left before
completing the center; that early opening span includes a noncanonical single
and is geometry evidence, not an accepted maintenance-policy route. Sprint
pages 49–52 provide a canonical TSD translation control for delayed completion.
These are placement-page numbers starting at one. They
prove legitimate construction orders, not that an unseen piece is available in
an arbitrary live observation.

The I-versus-upcoming-J decision is separate and unchanged here. The vertical I
in column 4 blocks the low J fill across columns 2–4 in both reviewed routes;
that geometric observation alone does not establish a better complete
continuation while waiting for J. Full Reset recognition likewise remains
research, not a feature of these reservations.

Reservation eligibility is deliberately narrow: recognized, reference-supported
level-finishing alternatives, not every hypothetical placement returned by the
geometry helper. Spending a matching partner elsewhere creates an exact-cell
obligation. Checked line clears translate those cells, and only executing a
still-supported finishing alternative repays it. Subsequent nonpartner moves
cannot erase an already created obligation. Ordinary supported center
transformations before resource diversion are not frozen into the old silhouette;
source replay showed that a blanket disappearance guard rejects legitimate play.

Center completions are also explicit retained goals. Their identities are mapped
through exact cleared rows, so a different later center completion cannot silently
replace the reserved one. Actual page hard drops, fresh worker requests and public
observations carry and revalidate the executable suffix. Import/reset discard
controller history rather than trusting supplied reservation metadata.

Proof remains bounded. The existing preparation search may append directly
executable finishing partners within its visible seven-lock limit; this is not a
new general long-horizon filler search. An unresolved reservation makes that
candidate uncertified, not illegal or impossible. No new regional priority weight,
I/J ranking change, or hidden piece-stream knowledge is introduced.

Validation of the reservation revision (2026-10-23): 393/393 tests pass. All 27
playable starts return replay-checked advice at the normal 750 ms budget. The
only changed first recommendation is `i-via-hold`: it now completes L-center
before O-left, I-left, Z and TSD, instead of spending the held L on the Left
without proving its replacement. The other 26 first placements are unchanged.
The fixture's historical descriptive title remains “Hold to place the I.”

A bounded sanity pass followed 24 recommendations each on existing seeds 10333,
20333 and 20339 using the real commitment/preview-refresh lifecycle. All 72 locks
completed without invalid witnesses, noncanonical clears, protected-notch
violations, new internal sealed cavities or top-outs. This is a short sanity
check, not a new matched long-run comparison or a sustainability guarantee.
