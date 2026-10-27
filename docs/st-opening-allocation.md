# Observed opening allocation and delayed quality

## Community criteria and scope

[Shocky's guide](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit), chapter 2, distinguishes the required opening allocation (two non-Right Ts, one non-Right Z, and the Right Z supporting the third-T first TSD) from additional good-opener quality (balanced S/L use and comparable Left/Center heights). Chapter 7 permits a temporary Hanging S and recommends resolving it promptly. The guide does not explicitly require the non-Right Z or every quality obligation to be finished before the first TSD. The user clarified that mandatory allocation has priority when incompatible with scoring, but either order is valid when both are fulfilled.

This implementation is narrower than a general opening evaluator. Only a complete, replay-verified empty-start history establishes these allocation facts. A board import, source-pattern match, first TSD alone, or serialized status does not. Unknown history retains the existing geometric construction behavior. This is not a Reset detector or an allowance renewal.

## Search behavior

When both non-Right Ts have actually been used, the first Right cap is present, and the opening Z is still owed, checked non-Right Z progress precedes optional structural growth. Existing safety, covered-Left and parity bands remain ahead of this preference. Spending another T outside Right does not count as progress. A checked prefix may score first and pay the Z afterward; one such competitor remains inside the existing beam width so allocation priority does not prune every scoring-first ordering. Scoring alone never erases the outstanding Z obligation.

A known Center partner may lie one lock beyond the ordinary three-lock opening horizon. In that case the search may compare **all retained competitors** at one additional completed layer, using the same beam slots and request allowance. A partner indication only triggers search; legal poses and access still require replay. A partial layer or expired node/time allowance retains the completed nominal result. This does not increase the live 1,500 ms / 45,000-node limits.

After a verified first-TSD allocation, the opening phase protects the exact observed pending Center partner from optional diversion. Once actual quality is observed, a historical handoff still requires a fresh maintenance proof; geometry or a fabricated summary alone cannot trigger it. A narrowly scoped maintenance quality preference reduces observed Center/S/L obligations before optional structural growth. It remains below safety, cycle and reusable-Center priorities, uses the existing resource/access validation, and does not project an Extra-Z allowance into hypothetical play.

## Observed resource checkpoints

The first actual TSD records an immutable checkpoint only if the third T clears the original normal Z cap and exactly two non-Right Ts have been used. The required non-Right Z may already be present or still be owed. Its first actual later allocation pays mandatory debt, not optional Extra Z. The existing pre-clear quality baseline remains valid.

If allocation or quality was not yet complete, later canonical TSDs do not expire that obligation. A later **observed** lock may establish the baseline only after mandatory allocation is complete and before optional non-Right Z spending or an ordinary-profile departure. No unresolved Center/S/L obligation may remain, and no Center debt may have been invalidated since the first TSD. The Center must be level, S/L counts balanced, and Left/Center maximum heights within three rows. That numeric tolerance is an engineering interpretation, not a quoted community rule. Eligibility is never granted retrospectively to earlier decisions, from a forecast, or by clearing lines again.

Session schema remains 1. Engine-version provenance changes; imports rebuild these facts from the action tape rather than accepting saved derived flags. Undo restores the earlier bound tape and therefore removes a later checkpoint.

## Regression example and limits

The public pre-lock-17 fixture reproduces an opening that had used two Ts outside Right but no Z there. The old recommendation placed S Left and then cleared with T. The new worker discovers a legal Z-Center / TSD / held-S-Left / J-Center prefix, using only the original public inventory. A separate real-worker regression retains the original S/TSD order, then automatically places Z Center and its exact J partner before a replay-certified historical handoff. Actual replanning is checked separately because finding the first move is not proof the controller follows or pays every later obligation.

Tests cover observed accounting, delayed completion, unknown/forged/truncated histories, lost Center debt, Undo, node/clock rollback, causal search ablations and ordinary live-worker behavior. Matched closed-loop measurements are development evidence, not proof of indefinite survival, optimality, or all-opening coverage.
