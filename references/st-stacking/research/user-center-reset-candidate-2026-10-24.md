# Future Reset research: Center construction and two visible Ts/Zs

[Exact supplied snapshot](user-center-reset-candidate-2026-10-24.json), received from the user on 2026-10-24. Source message: `Sentinel_b3977468b2508191bf650db3e83fb663`.

Research only: no policy, UI starting mode, expected recommendation or completed Reset certificate is introduced. All supplied pose, hold, preview, counters and bag metadata are retained. No private future is inferred.

## User observation and question, verbatim

> Here is another potential candidate position where we could consider a reset. This time we have two visible Ts and two visible Zs, but no way to fill the center region while maintaining the notch in column 7 using a known center region pattern.
>
> To solve this problem we could plan a reset using the two Ts to keep parity in the left region; but I'm not clear on what the drawbacks of that are.

The public active/hold/preview does contain two Ts and two Zs. The claimed absence of a known notch-compatible Center completion is a hypothesis pending geometry and actual-access review, not proof that no legal construction exists. HOLD must be included in any visible-supply comparison.

A bounded review should distinguish paired-T parity cancellation from completion of Center repair, any current Right cap/cleanup duty, the opportunity cost of spending the visible scoring Ts, increased regional height/headroom consumption, and the remaining legal route to resumed scoring. Two Ts and two Zs alone do not certify a community Reset or its desirability. The earlier [Z/T allocation question](user-z-t-reset-timing-2026-10-24.md) also records Center Z/J construction as a distinct use of Z.

## Bounded replay findings (2026-10-24)

Independent replay found that a notch-compatible S/L completion **does** exist. The recognized phase anchor is row36 in the zero-based40-row board; protected column-seven blanks are at rows36,33,30, etc. The checked L fills row31, not the protected row30. Thus the user's initial absence-of-a-known-pattern hypothesis is not confirmed.

Starting from the exact supplied moved T pose and public supply:

1. `CW, HD` places T at x1,y31,rotation1. Left profile becomes[8,7,8,7], maximum height8, no covered Left cells and no clear. Left mino balance becomes−2.
2. `R180, R, HD` places the actual next L at x4,y29,rotation2. Center becomes[9,9,9], reference-supported with aligned lower foundation. Maximum height9 leaves11rows of headroom; Left balance remains−2, with no covered Left cells and no clear.

Held J is retained. The resulting active piece is Z and remaining known preview is O,J,T,Z. This is a legal finite construction and Center-completion witness, **not** a completed paired-T repair, resumed-scoring proof, full Reset or demonstrated improvement in survival. In particular the second T still needs an executable balancing placement, and spending two scoring Ts has an opportunity cost. No policy or expected recommendation was changed from this finding. The first research case's Center Z/J allocation question remains unanswered.

Additional finite-supply limit: if both currently visible Ts are committed to Left parity repair, no currently visible T remains for resumed scoring. Likewise, the two Zs cannot each be counted simultaneously toward Right cap preparation and Center/Left construction. These are resource-accounting limits on a proof, not evidence that the proposed Reset is strategically bad or that the next unseen bag cannot help.
