# Finite construction stages

This extends established-game recovery, not general opening coaching or a full
Midgame → Reset → Midgame recognizer.

## Architecture

Ordinary scoring still uses its existing depth-three beam. A separate bounded
construction search can discover seven legal locks from the active piece, hold
and six-piece public preview. It explores reachable rotation/shift seeds, lowers
pieces to the surface, then explores local slides and rotations, including tucks.
This restricted enumeration is explicitly incomplete. Missing a route means
uncertified, never impossible.

Search orders candidates by paired-T progress, geometric scoring-row deficit and
existing support. Those priorities only guide discovery. Acceptance requires a
complete replay certificate: two opposite-parity Left Ts, no new internal cavity,
valid column-seven phase, discharged center reservations, respected Z/cap/I
obligations and a supported right T-spin double. The terminal double establishes
finite usable progress, not completion of a multi-bag Reset.

Default initiation is deliberately narrow: an established scoring wall and notch
phase, a built Left region, and Center below the ordinary maintenance threshold.
Supported ordinary scoring positions do not automatically divert Ts. The 1000-line
reference's page 366 geometry is now discoverable without injecting its moves;
page 813 remains an ordinary-scoring control.

The explicit `depleted-center-visible-pair-v1` selection policy prefers supported
ordinary maintenance and one-lock Center re-entry. Only the existing depleted-
Center case may request paired recovery; competing cap/I demands and fewer than
three visible Ts decline initiation. A candidate is not selected until the full
legal certificate passes. Diagnostics distinguish candidate, selected/continuing,
missing supply, out-of-scope and inconclusive/disabled search. The numerical
height cutoffs describe current coach coverage, not a community Reset formula.
This prefers a checked recovery to unsupported ordinary-profile abstention; it
never claims ordinary play is impossible, a complete Reset, or resource renewal.


## Persistent obligations and comparisons

Advice retains the original public observation, complete legal input proof and a
consumed-lock index. Each actual lock must match its replayed event and resulting
public state. The complete original proof is regenerated before retaining a suffix.
This preserves pending parity, exact center construction and the checked Z role
without guessing prior Extra-Z history or promising an unseen piece.

HOLD, movement and refreshed previews do not rewrite the original supply proof.
Manual deviation, reset and import cannot silently revive it. A longer preview
revealed during play is not retroactively inserted into the certified origin.

A supported ordinary replacement must finish at the same number of locks,
re-certify the original construction, and improve occupied material or maximum
height without worsening the other. This is a conservative dominance rule, not
a universal ranking of unlike Reset and scoring horizons.

The worker's existing 750 ms response budget remains. Discovery reserves time for
validation and shares a fixed node bound; recursive comparison uses the same
absolute deadline. No unlimited search or hidden future is introduced.

## Remaining limits

- Only completely visible paired repair is initiated. Partial multi-bag Reset
  initiation with an unseen partner remains unsupported.
- No inferred Z quota, broad T/Z policy exemption, or cavity relaxation is added.
- A terminal TSD may leave further rebuilding necessary.
- Surface enumeration and a narrow stage beam can miss valid alternatives.
- Reference quiz-state tests are synthetic public observations, not independently
  verified original-player preview/hold history.

Tests cover independent route discovery, parity through real locks, wrong events,
forged progress, missing supply, zero-budget requests, ordinary scoring and the
browser's HOLD/worker/preview/import/reset lifecycle. Longer-play measurements
must be reported separately from these finite proof checks.

## Visible replacement-Z stages

A second finite stage now considers an optional non-right Z placement only when
another actual visible Z can repay the original cap cells and an available T
then performs a real double. It reuses already enumerated root moves, actual hold
operations, cap witnesses and T-entry proofs. Up to three certificates receive
at most 120 ms of the shared response budget; the final comparison reserves a
small part of that same deadline. This is not an unlimited second search.

The original cap cells remain debt until the replacement Z occupies them. No
clear before repayment, intervening cap-target substitution, pending I cleanup,
noncanonical clear or T discard is exempted. Those variants are uncertified,
not declared impossible. The origin/proof/consumed-index lifecycle also retains
this exact cap debt through real locks and preview refreshes.

Deferral is compared with ordinary play at equal completed locks. Where the
ordinary prefix commutes with the macro, its remaining legal witness can complete
the same endpoint rather than comparing two ordinary locks with three stage
locks. An equal result keeps the ordinary cap-first order. A deferral must improve
occupied material or maximum height without worsening the other to replace it.

At the synthetic page-1554 setup, both orders can reach a three-lock TSD endpoint
with 44 occupied cells and maximum height 9. The default keeps cap-first. The
recorded alternative three placements also pass the finite validator, without
being treated as universally optimal. Original player preview remains unverified.

This does not implement conditional two-bag Reset initiation or infer a prepaid
Extra-Z count. Those require explicit observed allocation history plus a safe
policy for newly revealed pieces, rather than assuming an eventual bag guarantee
is an immediately executable repair.
