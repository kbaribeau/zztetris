# ST lab: established-stack coaching

The lab implements the first bounded coaching milestone: maintain an established **right-hand ST stack**, not solve empty-board openings or guarantee indefinite survival. The screen offers exactly two play modes: **Empty board** (manual opening practice; opening coaching is not yet implemented) and **Stable ST stack** (the existing Independent rebuild position, the default). The other development fixtures remain internal regression inputs, not selectable starts.

The last selected play mode is saved locally as `stLabMode`; unknown or retired values fall back to Stable ST stack. **Restart current board** restores the current starting board, including an imported snapshot. Snapshot import/export remains a diagnostic tool, not a third preset, and an import does not overwrite the saved mode. Choosing a mode replaces the imported origin. The rules, unlimited hold swaps, and coaching engine are unchanged.

## Play

- The gray outline is the ordinary hard-drop ghost. The amber outline is a separately checked coaching target. Follow the explanation, including HOLD when requested; no auto-play button executes the plan for you.
- Keyboard bindings come from Game Settings; on-page buttons provide the same manual actions. Advice defaults to `KeyA` unless rebound. Display preferences persist without changing ordinary modes.
- The lab has its own explicit `st-zero-v2` rules: 10×40 board, zero gravity, manual hard-drop lock, SRS+ kicks including 180°, and **unlimited hold swaps**. Ordinary practice is unchanged. Existing v1 fixtures and imports explicitly migrate to v2 in the lab; the kernel retains v1 for historical replay. Unlimited hold swaps the same two pieces, not the whole queue. See [rules contract](docs/st-rules-contract.md).
- Reset restarts the selected position. Empty board is available for manual play, but opener coaching is explicitly unsupported.
- Snapshot export contains only visible state and optional observed bag evidence. Import accepts at most six preview pieces. Missing history remains unknown. Full Fumen/editor/undo tools remain available through the ordinary-practice link; the lab does not pretend those legacy controls operate its new state.
- Diagnostics show checked lock horizon, node count, elapsed time, budget status and executable continuation. A geometric slot or heuristic score is not proof that its required piece will arrive or enter.

## Architecture and information contract

`st-rules.js` is an immutable rules/actual-pose reachability kernel. Every recommendation has a replayable sequence of movement, rotation, hold and hard-drop inputs. Rotation evidence is validated; non-T spin-equivalent states are collapsed during search, not geometrically impossible placements invented.

`st-bag.js` retains possible seven-bag remainders. Knowledge is at the **end of the visible preview**, so consuming active/held pieces must not consume it a second time. A future piece is usable only when all remaining possibilities force it. Unknown imports do not require a seed or original history.

`st-fixtures.js` contains legally reconstructed established positions from two independent Fumen sources. Original hold, preview and inputs were not recovered from those files: the validated seven-bag streams and witnesses are synthetic. See [corpus provenance](docs/st-fixture-corpus.md). Fixture IDs, reference answers and private future pieces never enter the planner.

`st-planner.js` evaluates separate left/center/right regions, scoring-channel height, headroom, left roughness, left/center height imbalance, sealed versus reachable cavities and geometric T-double slots. Its explicit initial support profile requires an established left/center stack (including a healthy two-high left base) and lower eighth-column scoring channel. Recovery admission also permits a depleted one-high left base beneath an established center of at least five rows. Admission permits a temporary regional imbalance with the channel still below at least one of the left/center regions; every returned endpoint must restore the stricter separation below both. This avoids rejecting a checked intermediate clear as though it were a new unsupported opening. It is a limited eligibility heuristic, not a complete ST recognizer. The separate `st-structure.js` module adds a small local regional grammar: left platforms, ordered center L/O, O/J, S/L and Z/J preparations/completions, right-wall renewal shapes, and graded crossing/repair burdens. It uses occupancy and actual finishing-placement witnesses, not fixture IDs or exact-board lookup. A missing pattern match means uncertainty, not illegality. Reservoir vacancies are not hard-rejected as holes: a legal cap can temporarily create one and repay it with a double. A canonical cap reservoir receives an exact-cell damage exemption only after a replayed counterfactual T-double reopens it; T supply is still unresolved. See [reservoir review and regression limits](docs/st-cap-reservoir-review.md).

The bounded beam preserves different piece/hold/construction families and verifies continuations over observed pieces. Recognized cycle obligations precede structural-support bands, which precede tactical TSD/slot tie-breakers; an executable hypothetical slot earns only a small tie-break, not the former dominant 24-point bonus. Regional obligations identify exact finishing placements and match distinct active/held/visible/forced piece instances. Their supply labels are not promises about arrival order: only the returned executed prefix proves timing and access. Unknown future partners remain searchable, with modest uncertainty cost. Cross-region moves remain legal and checked structural repair can repay their dependency cost. No back-to-back state or scoring is modeled. Geometric slot tie-breaks are only optimistic bounds: promising candidates are lazily checked for an executable hypothetical T-double path before any actual bonus is awarded. A blocked or unverified cavity cannot farm that reward. This hypothetical proof does not assert T availability and is never an eligibility gate for incomplete construction. A T-slot obligation stays unresolved until actual replay proves entry and clear. Only completed deeper iterations replace the prior result; partial work and budget exhaustion never mean “impossible.” Defaults are depth 3, width 8, 45,000 visited poses and a **750 ms soft search deadline**. Assessment can finish just after the deadline; the UI terminates an overdue worker at 2.5 seconds. These are operational budgets, not guaranteed response latency.

`st-worker.js` runs search outside the main thread. The controller terminates superseded workers and checks worker identity, request ID, revision and witness before displaying advice. Exactly following a checked input preserves the same target, including through HOLD; the remaining prefix is replayed before retention. A deviation hides old advice immediately and replans from the actual pose. The main thread performs only short replay/validation, never placement search.

## Evidence and limits

See the [acceptance map](docs/st-milestone-acceptance.md), [evaluation report](docs/st-evaluation.md) and run `node scripts/evaluate-st.cjs` for a repeatable corpus/closed-loop evaluation. The default demo was measured with real replanning and fresh six-piece preview after every lock: a nonclear filler, full TSD and supported nonclear rebuild, then another full TSD, through 12 locks. The production 750 ms budget also completed this cycle.

This does **not** establish robust indefinite ST play. All five measured starts now produce at least one TSD within 12 locks, after fixing a geometric-slot reward that previously produced inaccessible cavities. A low stack after successful clears can still leave the supported maintenance profile. Finite-prefix legality, corpus success and survivability are separate from strategic quality and human learning. Left-side coaching, deep stochastic futures, arbitrary damaged-stack recovery, TSTs and PCs are outside this first profile. One small legal filler deviation has a structural recovery case; that is not general recovery evidence.

The regional revision is experimental: existing 36-lock streams regress materially in ending height despite improved first moves, so it is not accepted as a sustainable-play improvement. The eight manually reviewed starts are now development regressions, not untouched generalization evidence. See [regional-feedback comparison](docs/st-regional-feedback.md) and `node scripts/st-regional-comparison.cjs`. See [cap allocation and ordered-pair review](docs/st-cap-pair-review.md) for the subsequent targeted fixes and retained reservoir mechanics tests. No new generalization corpus was added; fresh generalization is reserved for Kevin’s manual playtest.

Automated rules, corpus, planner, closed-loop and actual-page behavior tests are in `npm test`. Real browser pixels, desktop/narrow layout, real worker loading under the deployment host and subjective learning/playtest acceptance remain unverified in this cloud environment. Do not mark the overall milestone fully accepted until those checks pass. No ordinary engine, Fumen recording or legacy rotation file is changed.

## Reviewed scoring-cycle policy

The coach now recognizes bottom-four-row I cleanup preparation, scoring above an existing cleanup I, and subsequent cap rebuilding as distinct phases. Normal recommendations admit only right-region full T-spin doubles and I tetrises as clears. A zero-clear preparation is still allowed. An executable available Z cap takes precedence over optional filler, and spending a needed scoring T or eligible cleanup I does not become acceptable merely because another letter appears later in preview. Preserving T while doing useful work remains possible; there is no blanket immediate-TSD rule or four-double counter.

The planner retains a shorter compliant prefix if deeper search finds only obligation-diverting continuations, and abstains rather than silently labeling a departure as normal ST. This is not a new recovery mode. Cap-rebuild geometry alone does not establish imminent T timing: an actual I → Z → held-T proof and a bounded visible-filler-prefix extension protect verified preparation from pruning, including the timed fallback. A three-cell wall above an outer cleanup I is cap-pending, not already scoring. An available outer I takes precedence over a Z cap that would seal it only when the ensuing Z placement is actually replayable. Unproved pre-cap T supply conflicts remain unresolved. The previously reviewed L-center first move remains supported, now with an actual I-left/Z/saved-T double continuation instead of T filler. Exact scope, regression results and rollout tradeoffs are documented in [cycle review](docs/st-cycle-review.md).

See [hold and preparation review](docs/st-hold-preparation-review.md) for v2 migration, bounded-proof limits and combined regression checks.

### Column-seven scoring notches

Normal ST advice preserves the two-filled / one-empty column-seven cadence above
(and including) the next scoring arm. The phase comes from recognized scoring-wall
or next-Z-cap geometry, not an absolute height modulo three and not the visibility
of a future T. A solid outer cleanup I is distinguished from a Z roof, including
when the left scoring rows are unfinished. Empty construction cells between the
reserved notches remain allowed.

The planner carries these reserved rows through its executable prefix, translating
exactly through two- and four-line clears. The current T-spin double may occupy and
clear its own arm notch. Other placements filling reserved notches are excluded,
not merely penalized. Planner replay/revalidation checks the same constraint;
manual placement legality is unchanged. An
already-blocked established notch produces an honest no-supported-continuation
result, not a fabricated recovery. A recognized cleanup foundation retains the
next-cap phase, and an empty right
floor is anchored by an actual hypothetical Z-drop witness. Thus replanning after
I preparation or a quad does not forget the phase. Unrecognized right geometry
without a phase witness remains unanchored; this does not certify its sustainability.
The constraint targets ordinary ST double/quad cycles, not deliberate transitions
to another scoring pattern such as the Marathon reference's ending TST.

See [future-notch review](docs/st-future-notch-review.md) for reference checks,
existing-corpus results, and the remaining Marathon rollout tradeoffs.

See [autoplay structural repairs](docs/st-autoplay-repair-review.md) for buried-cycle
phase recognition and the conservative first-lock internal-cavity guard. These
address two observed autoplay failures without claiming indefinite sustainability.

[Verified resource commitments](docs/st-cycle-resource-review.md) preserve checked
T-scoring and I-Pocket routes across actual locks and fresh worker requests.
This does not yet recognize the community Midgame/Reset cycle; the known Reset
reference limitations are documented rather than hidden by a universal T rule.
