# Unlimited hold and held-T preparation review

This revision combines the requested hold restoration with a narrow preparation fix. It does not add back-to-back scoring, general O/J retuning, new held-out cases, or a new infinite-survival claim.

## Explicit practice rules

`st-zero-v2` restores main's unlimited hold: occupied hold swaps two pieces without consuming preview; empty hold consumes one piece. Every hold resets spawn pose and rotation evidence. The lab retains its stricter terminal spawn-collision rule. Legacy `st-zero-v1` keeps once-per-lock semantics in the pure kernel; the UI explicitly migrates old imports and fixtures to v2 and exports v2. Invalid/unknown profiles are not silently rewritten.

Reachability searches only zero, one, or two meaningful hold prefixes. Further swaps repeat states. Equivalent outcomes retain their shortest witness, while distinct held-piece/queue outcomes remain distinct. Advice reports “Hold twice” when necessary. Remaining-prefix and revalidation checks replay every lock and compare semantic result contexts, so a newly revealed preview or extra hold cannot silently retain stale advice.

## Preparation proof

The supplied active-T/held-I position has right profile `[0,3,0]`. After the outer I it becomes `[0,3,4]`: a cleanup I is prepared, but the cap is still pending. Previously this was mislabeled as already scoring, penalizing the necessary Z as an extension.

The planner now verifies a bounded route using the actual available pieces: hold T and place I in column ten, place the visible Z in the right cap, then retrieve T for a double. All inputs replay from the observation. A completed proof protects T from optional filler and survives an incomplete deeper beam iteration. Interrupted proof work earns no reward and does not justify spending the conflicting T. A completed failed proof does not create a blanket pre-cap T restriction.

The supplied case keeps height 11 through I/Z, reaches 9 after the double, and has a checked next held-I quad in column eight reaching height 5. The normal three-lock recommendation does not claim to have searched beyond that prefix; the fourth lock is separately regression-tested.

## Regression found and repaired during review

Correcting the phase initially exposed an order conflict in the existing marathon rollouts: capping before the available outer I lost the later quad and finished at height 19 instead of 16. Publication was held. The final fix gives I-before-Z priority only when an actual enumerated cleanup I leaves an actual available Z cap replayable. It does not relax cap urgency or broadly reward all right-side I placements. The existing rollout state at marathon-rebuild lock 25 (also reached at marathon-preparation lock 27) is retained as a regression, not as a new generalization case.

## Combined evidence

Independent comparison against local baseline `7f260ec` (published equivalent tree `a7d5877`) finds all 27 existing first recommendations unchanged under explicitly migrated v2 observations. The existing 36-lock runs retain their baseline outcomes:

- o-filler: 5 doubles, 0 quads, ending height 13.
- marathon-rebuild: 3 doubles, 1 quad, ending height 16.
- marathon-preparation: 4 doubles, 1 quad, ending height 16.

All three reach 36 locks without invalid witnesses or noncanonical clears. They are finite development evidence, not an indefinite-play guarantee. An independent enumeration audit replayed 2,326 v2 placements across the 27 starts, including 156 two-hold outcomes, with matching states and unchanged bag evidence during swaps. Tests cover both old and practice profiles, full and 750 ms planning, proof interruption, stale advice, UI hold buttons/keyboard, migrations, and the prior center-L regression.

For reproducible practice-profile rollouts, `closedLoop` in `scripts/evaluate-st.cjs` accepts `{practice:true}`. It defaults to the original legacy fixture profile so historical evaluation provenance remains explicit. Run the full `npm test` suite on the pinned Node version; the clean-commit artifact manifest is the authoritative run record. Real browser rendering and subjective playtest acceptance remain separate.
