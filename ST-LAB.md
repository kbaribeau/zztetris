# ST stacking lab

The lab offers separate bounded opening and maintenance coaching for a **right-hand ST stack**, without guaranteeing indefinite survival. The screen offers exactly two play modes: **Empty board** (partial construction using visible pieces) and **Stable ST stack** (the existing Independent rebuild position, the default). The other development fixtures remain internal regression inputs, not selectable starts.

Replay-verified [opening allocation and delayed quality](docs/st-opening-allocation.md) keep a known missing opening Z and early Center/S/L obligations distinct from optional stack growth. Imported geometry alone does not invent this history or an Extra-Z allowance.

The last selected play mode is saved locally as `stLabMode`; unknown or retired values fall back to Stable ST stack. Snapshot import/export remains a diagnostic tool, not a third preset, and an import does not overwrite the saved mode. Choosing a mode replaces the imported origin.

## Play

- The first badge above the field names the current session: **Opening** for partial construction, or **Mid-game** for the existing maintenance coaching path, without a visible “Coaching phase” caption. Mid-game is a display label, not a community-cycle classifier or a guarantee that advice is available. Only the checked opening handoff changes Opening to Mid-game; Undo and Restart restore the appropriate session. The phase does not change on a search miss, error or top-out. Placement explanations remain below the board. Community **Reset** detection is future work: finite repairs, quad cleanup and Restart are not labelled Reset.
- **Undo last placement** (configured Undo key, default T) restores the start of the previous completed placement, before its holds, moves and rotations. It also discards any movement of the current piece. Undo is available after a top-out or finite-queue exhaustion. The last 100 placements are retained; restart, mode changes and imports clear this history. Redo is not currently offered in the ST Lab.
- Undo preserves the same generated piece sequence using a private append-only tape and rewindable cursor. It restores public bag evidence, stream position, opening phase and any saved coaching commitment, then requests fresh validation. Private tape/history never enter advice requests or exported snapshots; already-seen future pieces are not treated as currently visible. Late worker replies are rejected by worker identity and request/revision checks; a session import may preserve its saved revision for source-proof replay.

- The gray outline is the ordinary hard-drop ghost. The amber outline is a separately checked coaching target. Follow the explanation, including HOLD when requested; no auto-play button executes the plan for you.
- Keyboard bindings come from Game Settings; on-page buttons provide the same manual actions. Advice defaults to `KeyA` unless rebound. Display preferences persist without changing ordinary modes.
- The lab has its own explicit `st-zero-v2` rules: 10×40 board, zero gravity, manual hard-drop lock, SRS+ kicks including 180°, and **unlimited hold swaps**. Ordinary practice is unchanged. Existing v1 fixtures and imports explicitly migrate to v2 in the lab; the kernel retains v1 for historical replay. Unlimited hold swaps the same two pieces, not the whole queue. See [rules contract](docs/st-rules-contract.md).
- **Restart current board** restores the starting position, pose, hold, preview and coaching phase, including an imported origin. The configured Reset key (default R) instead starts a fresh random piece sequence from the starting board for ordinary modes and plain position imports; for coaching sessions and private practice packages, it restores the imported session and any supplied tape exactly. Both actions reset the footer totals and Undo history. Empty-board advice checks finite legal construction prefixes, then hands off only after an actual canonical clear and a freshly checked maintenance continuation. See [opening scope and limits](docs/st-opening.md).
- **Pieces locked and cleared lines** share a neutral two-column footer attached below the board, separate from phase/resource badges. “Pieces locked” counts actual completed hard-drop placements, including non-clears and a terminal lock—not draws, previews, active pieces or HOLD swaps. “Lines cleared” remains the total actual rows cleared. Both grouped totals share a visible “since start” qualifier for fixtures and empty-board games or “since import” for imported positions/sessions/private practice, without inventing earlier history from an existing heap or imported coaching evidence. Undo restores both totals; Restart and mode changes reset them. Each polite accessible status includes its total and baseline. These session-only statistics are not exported or sent to the coach.
- Snapshot export contains only visible state and optional observed bag evidence. Import accepts at most six preview pieces. Missing history remains unknown. Full Fumen/editor/redo tools remain available through the ordinary-practice link; the lab does not pretend those legacy controls operate its new state.
- Rejected position/session imports show a persistent **Import rejected** alert between Snapshot JSON and the Import button, with the exact parser/validator message. The input and current game stay intact; edit the existing textarea and retry with the same Import action (no separate Edit JSON button). Editing retains the previous failure and marks it as not yet revalidated. Rejection opens the import section without moving keyboard focus, and a textual cue remains if it is collapsed. Repeated failures update the assertive alert; accepted-import warnings, successes and export notices use the ordinary polite status instead. No validation or import rules are relaxed.
- Diagnostics show checked lock horizon, node count, elapsed time, budget status and executable continuation. A geometric slot or heuristic score is not proof that its required piece will arrive or enter.

## Architecture and information contract

`st-rules.js` is an immutable rules/actual-pose reachability kernel. Every recommendation has a replayable sequence of movement, rotation, hold and hard-drop inputs. Rotation evidence is validated; non-T spin-equivalent states are collapsed during search, not geometrically impossible placements invented.

`st-bag.js` retains possible seven-bag remainders. Knowledge is at the **end of the visible preview**, so consuming active/held pieces must not consume it a second time. A future piece is usable only when all remaining possibilities force it. Unknown imports do not require a seed or original history.

`st-fixtures.js` contains legally reconstructed established positions from two independent Fumen sources. Original hold, preview and inputs were not recovered from those files: the validated seven-bag streams and witnesses are synthetic. See [corpus provenance](docs/st-fixture-corpus.md). Fixture IDs, reference answers and private future pieces never enter the planner.

`st-planner.js` evaluates separate left/center/right regions, scoring-channel height, headroom, left roughness, left/center height imbalance, sealed versus reachable cavities and geometric T-double slots. Its explicit initial support profile requires an established left/center stack (including a healthy two-high left base) and lower eighth-column scoring channel. Recovery admission also permits a depleted one-high left base beneath an established center of at least five rows. Admission permits a temporary regional imbalance with the channel still below at least one of the left/center regions; every returned endpoint must restore the stricter separation below both. This avoids rejecting a checked intermediate clear as though it were a new unsupported opening. It is a limited eligibility heuristic, not a complete ST recognizer. The separate `st-structure.js` module adds a small local regional grammar: left platforms, ordered center L/O, O/J, S/L and Z/J preparations/completions, right-wall renewal shapes, and graded crossing/repair burdens. It uses occupancy and actual finishing-placement witnesses, not fixture IDs or exact-board lookup. A missing pattern match means uncertainty, not illegality. Reservoir vacancies are not hard-rejected as holes: a legal cap can temporarily create one and repay it with a double. A canonical cap reservoir receives an exact-cell damage exemption only after a replayed counterfactual T-double reopens it; T supply is still unresolved. See [reservoir review and regression limits](docs/st-cap-reservoir-review.md).

The bounded beam preserves different piece/hold/construction families and verifies continuations over observed pieces. Recognized cycle obligations precede structural-support bands, which precede tactical TSD/slot tie-breakers; an executable hypothetical slot earns only a small tie-break, not the former dominant 24-point bonus. Regional obligations identify exact finishing placements and match distinct active/held/visible/forced piece instances. Their supply labels are not promises about arrival order: only the returned executed prefix proves timing and access. Unknown future partners remain searchable, with modest uncertainty cost. Cross-region moves remain legal and checked structural repair can repay their dependency cost. No back-to-back state or scoring is modeled. Geometric slot tie-breaks are only optimistic bounds: promising candidates are lazily checked for an executable hypothetical T-double path before any actual bonus is awarded. A blocked or unverified cavity cannot farm that reward. This hypothetical proof does not assert T availability and is never an eligibility gate for incomplete construction. A T-slot obligation stays unresolved until actual replay proves entry and clear. Only completed deeper iterations replace the prior result; partial work and budget exhaustion never mean “impossible.” See the [planning allowance and performance debt](docs/st-temporary-planning-budget.md) for current search budgets, worker watchdog and restoration goal. Assessment can finish just after the soft deadline; operational budgets do not guarantee response latency.

`st-worker.js` runs search outside the main thread. The controller terminates superseded workers and checks worker identity, request ID, revision and witness before displaying advice. Exactly following a checked input preserves the same target, including through HOLD; the remaining prefix is replayed before retention. A deviation hides old advice immediately and replans from the actual pose. The main thread performs only short replay/validation, never placement search.

The finite Left-context estimate may recognize an uncovered, unlisted surface
as a temporary allocation when unreserved visible I/O/J pieces can fit a
strictly smoother listed surface within two locks, including actual HOLD/queue
order. It does not assign a community tier to the unlisted starting shape.
Center partners and I pieces required for Right cleanup are not free Left
supply. This remains a secondary geometric tie estimate, not a movement or
resource certificate; original roughness/height priorities and all executable
prefix checks remain in force. Flat, covered and unrepairable unlisted surfaces
receive no new credit.

## Evidence and limits

See the [acceptance map](docs/st-milestone-acceptance.md), [evaluation report](docs/st-evaluation.md) and run `node scripts/evaluate-st.cjs` for a repeatable corpus/closed-loop evaluation. The default demo was measured with real replanning and fresh six-piece preview after every lock: a nonclear filler, full TSD and supported nonclear rebuild, then another full TSD, through 12 locks. The then-production 750 ms budget also completed this cycle; see the [planning allowance](docs/st-temporary-planning-budget.md) for current limits.

This does **not** establish robust indefinite ST play. All five measured starts now produce at least one TSD within 12 locks, after fixing a geometric-slot reward that previously produced inaccessible cavities. A low stack after successful clears can still leave the supported maintenance profile. Finite-prefix legality, corpus success and survivability are separate from strategic quality and human learning. Coaching for left-hand ST stacks, deep stochastic futures, arbitrary damaged-stack recovery, TSTs and PCs are outside this first profile. One small legal filler deviation has a structural recovery case; that is not general recovery evidence.

The regional revision is experimental: existing 36-lock streams regress materially in ending height despite improved first moves, so it is not accepted as a sustainable-play improvement. The eight manually reviewed starts are now development regressions, not untouched generalization evidence. See [regional-feedback comparison](docs/st-regional-feedback.md) and `node scripts/st-regional-comparison.cjs`. See [cap allocation and ordered-pair review](docs/st-cap-pair-review.md) for the subsequent targeted fixes and retained reservoir mechanics tests. No new generalization corpus was added; fresh generalization is reserved for Kevin’s manual playtest.

Automated rules, corpus, planner, closed-loop and actual-page behavior tests are in `npm test`. Real browser pixels, desktop/narrow layout, real worker loading under the deployment host and subjective learning/playtest acceptance remain unverified in this cloud environment. Do not mark the overall milestone fully accepted until those checks pass. No ordinary engine, Fumen recording or legacy rotation file is changed.

## Reviewed scoring-cycle policy

Ordinary-midgame recommendations allow new locks touching Right (columns 8–10) only for actual Z, T or I pieces, including HOLD and cross-boundary placements. This is a necessary eligibility check, not permission to bypass canonical clears, phase, resource, access or budget guards. Nonclearing I Pocket/Well preparation remains eligible; canonical TSDs may touch Center column 7. S/J/L/O Right locks have no later-repair exception. Existing imported cells and manual legality are unchanged; opening and separately verified paired-T recovery retain their own scope.

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

Ordinary replacement of an executable scoring commitment also preserves the
lock timing of each required TSD and I-quad. A later score needs a fully checked,
equal-horizon comparison with the original saved route: maximum height and
occupied mass must both be no worse and at least one must improve, without
increasing sealed cells, covered Left cells or unresolved Center continuity.
A better blended estimate or cheaper inputs alone does not justify delay.
This conservative endpoint-dominance exception uses the existing shared request
budget and exact certified fallback; an unfinished comparison does not invalidate
the saved goal. It is not an unconditional immediate-score rule, a physical-T
identity reservation, or a promise of better long-term survival. Separately
verified construction contracts and all existing resource/cleanup obligations
remain in force. `disableTimelyScoring` is a diagnostic control, not session
permission or an imported proof. Timing telemetry is descriptive and replayed
witnesses remain the authority.

See [temporary planning budget and measured limits](docs/st-temporary-planning-budget.md). Historical 750 ms experiments remain recorded at their original budget; more compute is not itself better strategy.

A [narrow one-lock level-base re-entry](docs/st-level-base-reentry.md) can restore
a recognized Center from an exact phase-aligned level-two base. It preserves
the same saved goal and strict endpoint checks; it does not broaden general
maintenance readiness, erase existing damage or implement Reset coaching.

[Bounded opening root ambiguity](docs/st-opening-root-ties.md) preserves a small
number of strategically tied public root shapes and may compare one extra
complete lock layer. It leaves ordinary rank, saved repairs and closure priority
intact; incomplete optional work restores the checked nominal choice.

See the [October 24–25 development block review](docs/st-work-block-review-2026-10-24.md)
for retained changes, rejected variants, matched results and publication limits.

[Regional mino accounting](docs/st-regional-mino-ledger.md) is available as offline
simulation analysis, with verified original-bag identities through HOLD and
explicit unknown imports. It does not change the live UI, planner observations,
ranking or resource rules.

### Experimental source-to-first-TSD continuation

This experimental continuation may retain a finite scoring goal after an **actually executed**
seven-lock source opening and its seven-lock conditional second-bag goal. It first
computes ordinary advice with the unchanged normal budget. Only leftover budget
can prove a first Right TSD with the required T/Z allocation, original cap-roof
clear, S/L balance, level Center and the existing three-row regional-peak quality
interpretation (not a numeric rule authored by the community source).

A complete ordinary prefix meeting those checks is preserved; otherwise a bounded
solid-Left, direct-drop filler corridor is searched with the existing comparator.
That corridor is optional, not a universal hole/resource ban. An unsuccessful
proof keeps the already-checked ordinary decision and does not invalidate the
source opening. Exact root-visible inventory and connected executed history bind
retained witnesses; later refills cannot create a previously unproved route.
Imports, stale revisions and disconnected histories cannot grant this authority.
At a new actual lock boundary, this experimental continuation can replace an unexecuted
first-TSD suffix with a complete ordinary A-qualified alternative. It first
revalidates the retained goal and its final access boundary, then spends only
the remaining shared budget on ordinary exploration. The replacement must also
replay from the unchanged original fourteen-lock root supply, with all consumed
steps preserved and at most six total closure locks. Newly observed pieces are
not retroactively added to that root; refill-only alternatives are deliberately
unsupported. Movement/HOLD and repeated same-lock requests retain the precise
target. Sequences end at the first TSD, never a forced post-clear instruction.
If replacement fails or exhausts budget, the exact already-checked retained goal
survives. This experimental continuation is not a sustained-play reliability claim.

The normal actual-clear maintenance handoff and resource diagnostics remain
separate. Publication prioritizes valid source-guided openings; matched development runs
show both improvements and later-play regressions. Sustained play is not certified.

Above the field, four equal badges show the current phase value, Hanging S,
Hanging L and Extra Z in two rows, with no inline resource-status words. The S/L/Z silhouettes are grey
outlines until a Hanging S/L is observed or Extra Z is actually used; then the
silhouette fills and the badge gains a double
contour. Eligibility alone does not highlight Extra Z. A separate **?** beside
the grey outline means unknown history, not confirmed absent or unused;
**≠** replaces the silhouette and a dashed edge marks evidence outside the
reviewed source profile. Hover or keyboard-focus a badge for its description,
including its observed interval and limitations. Escape dismisses that detail
until refocus or pointer re-entry. The badges stay
visible with advice hidden. On game end, they describe historical facts only.

The existing diagnostics retain exact Center partner debt, HOLD/draw identities,
source-backed Hanging S/L identities, and Extra Z only after a verified source opening baseline. Unknown imports
stay unknown; clears never renew the allowance. Planning now receives an
observation-bound replay of this history, not trusted serialized status flags.
Ordinary routes reject non-scoring T locks and a second non-Right Z; unknown
imports cannot claim an unused Extra Z. Center choices must preserve their exact
partner cells and a bounded actual completion route through
HOLD and the visible queue. Tracked Hanging S requires a checked Left repair.
The supplemental repair search is bounded to four visible locks and 4,000
nodes. Requiring this certificate even without a currently visible T is a
conservative engineering choice, not a source claim that unseen partners make
a construction illegal. These proofs can cause honest abstention; they do not establish sustained
play or a completed Reset. Public simulation recordings
can be checked offline with `node scripts/analyze-st-resources.cjs trace.jsonl`;
add `--observed-empty-start` only for a recording known to begin at a fresh
local empty seven-bag start. This is separate from generator-provenance mino
accounting and does not certify an arbitrary imported history.

The same details and offline sidecar also show **Reset evidence**, not a Reset
coach: observed Left-T pairs, explicitly bounded Z-allocation windows, and later
scoring markers. Imported histories and phase boundaries remain uncertain.
Opposite T checkerboard contributions do not prove a safe rebuilt stack; the
geometry summary describes the current board only. The observer never declares
a completed Reset, renews Extra Z, cancels Center debt, or changes recommendations.
Its source examples use [Shocky's guide](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit)
and [retained replay placements](https://jstris.jezevec10.com/replay/26536180).
Replay test supply is synthetic; original HOLD, preview and bag history are not
claimed. Center/cross-region T observations remain unclassified by the observer; ordinary
planner routes still require scoring Ts. Reset readiness follows Shocky’s
Right-catching-up distinction, not queue pressure. The current conservative
engineering envelope requires both Left and Center at most two rows above
Right, and at most three rows apart; these are fixture-tested operational bounds,
not universal thresholds stated by Shocky. The old high-Left source366 recovery
is no longer eligible. No new Reset allowance or general Reset coach is enabled.

Hanging-S identification accounts for each observed L's consumption independently
of its regional label, including Left/Center crossings. If its same-bag S is still
live, the S is unaccompanied; this does not itself prove a geometric repair.
Supported SL completion and Left accommodation discharge the exact S identity.
Public snapshot bag phase alone does not reconstruct earlier allocations. An
unreviewed crossing-S disposition remains uncertain; projected safety checks
conservatively retain unresolved obligations rather than assume accommodation.

S/L identity accounting begins at the fully observed empty seven-bag origin,
independently of the opener quality checkpoint and Extra-Z baseline. Actual
handoff carries unresolved identities; it does not reset or certify their
allocation. A failed height, flat-Center, or T/Z criterion is not itself evidence
of Hanging S. Already-consumed opener foundation pieces are not retroactive
surplus. A pending exact SL remains construction debt, not Hanging L.

Hanging L is identified when its observed S is accommodated on Left or completes
an exact pair with another bag's L. Actual Left allocation, exact SL completion,
or completed LO accommodation discharges that L identity; LO preparation alone
is still pending. The LO option is described in Shocky's Chapter 10. Unreviewed
accommodation stays uncertain. Hanging L is diagnostic only: it adds no mirrored
repair search, placement prohibition, urgency, or Reset trigger. Newly recognized
Hanging S can invoke the existing bounded repair check, so identification can
affect later recommendations without changing ranking or opener A/B/C rules.

### Internal piece ledger (observation only)

`st-piece-ledger.js` is an additive local observer, exposed for diagnostics by
`window.stLab.pieceLedger`. It does not feed recommendations, worker messages,
resource bindings, public snapshots, badges, or scoring. The existing resource
tracker and its limitations are unchanged.

For each piece type, `entered` increments only when an identity first enters
active/held inventory, `locked` increments on its actual lock, and `outstanding`
is their difference. Preview revelation alone is not entry. Repeated HOLD swaps
never recount an identity; a bag boundary never erases held inventory. Imports
start a `since-observation` baseline with currently active/held inventory counted,
not a claim about earlier play. Only a locally witnessed empty seven-bag start
establishes bag ages.

The compact structural ledger records Left S/L allocations, exact completed
Center pairs, current Center commitments, and unresolved accommodation counts.
Up to 64 unresolved identity examples are retained; any overflow is explicit and
its count is never discarded. Unknown accommodation is not a confirmed repair or
a confirmed hanging piece. `pairingCandidates` can associate a held L and active S
across bags, or an available L with a pending Center S. These are inventory/geometry
facts, explicitly **not** reachability proofs, reservations, or hanging-status
verdicts. Extra-Z entries are factual Left/Center diversion counts before/after an
observed first canonical TSD, not a new allowance or eligibility rule. No boundary
renews those counts.

Immutable local checkpoints retain counters without an action tape or lifetime
lock cap. Restart, new mode and import establish a new ledger; Undo restores its
saved pre-placement checkpoint. Undo retains at most the latest **100 locked
placements**, not 100 key inputs. Pruning old Undo entries does not reset current
counters. Imported/injected diagnostic JSON cannot restore prior provenance.

## Versioned coaching-session export

The import box accepts either the existing lightweight position JSON or a
`zztetris-st-session` envelope (`schemaVersion: 1`). **Export coaching session**
adds the current recommendation inputs to the visible position; **Export visible
snapshot** is unchanged. Neither exports hidden future bags/RNG, Undo history,
footer totals, or the diagnostic shadow piece ledger. Imported play has a
finite visible queue (plus the existing logically forced bag remainder).

The session contains:

- `engineVersion`: an explicit coach compatibility identifier. Bump this when a
  behavior/proof-contract change invalidates saved advice or commitments.
  A different coach version produces a warning and discards those candidates;
  validated history and supported search settings can still be imported.
  It is a compatibility version, not a Git SHA or a signature.
- `position`: rules, board, exact active pose/rotation evidence, HOLD, six-piece
  preview, bag frontier, stream cursor, top-out and revision.
- `search`: current shared search time plus depth/width/node settings. Only the
  currently supported production configuration is accepted; imports cannot
  enlarge budgets or install clock/deadline callbacks.
- `coaching`: replay-backed resource context and its original bag frontier,
  pattern history, opener phase/source/clear/repair, previous advice and retained
  construction commitment. Hanging S/L and Extra Z are reconstructed from replay,
  not restored from editable status flags.

`st-session.js` checks input size/depth, versions, the complete resource replay,
its bag frontier, pattern history and bounded opener certificates before the
controller changes state. Imported previous advice is only a bounded candidate;
its old witness can be stale after movement, and the existing planner performs
normal retention/resource/access validation before any target is displayed.
Commitment witnesses are checked at their recorded origin, preserving legal
mid-piece target re-enumeration. Invalid/stale opener metadata or malformed
candidates are discarded with a visible warning. Invalid position, resource or
pattern evidence rejects the import without changing the current game/worker.

Unknown or truncated resource history remains unknown. The existing resource
replay limits (4,096 actions / 512 locks) still apply; this feature does **not**
replace them with a trusted compact checkpoint. A valid replay proves a coherent
constructed history, not who played it. There are no imported capability tokens,
no authenticity claims from hashes, and no inferred Extra-Z allowance.

Session install is atomic after validation, cancels the old worker and preserves
its exported revision because opener certificates bind exact revisions. Worker
identity prevents a late response from an earlier session with the same revision
being accepted. Restart restores that imported session; Undo begins empty.
Plain position imports retain their existing rules migration and unknown-history
behavior. Selecting a play mode replaces the imported session origin.

Tests in `test/st-session.test.cjs` exercise actual-page request round-trips,
source progress through the second bag and first TSD, repair/commitment evidence,
mid-piece movement, stale same-revision replies, rejection atomicity and limits.
Deterministic node-budget comparisons cover recommendation equivalence; ordinary
wall-clock-limited planning may still differ with scheduling and hardware.

## Forced-supply proof retention

See [the forced-bag binding contract](docs/st-forced-bag-binding.md) for consistent
normalization of a publicly deduced piece without weakening history/identity
guards. No handoff budget or placement policy is changed by this correction.

### Experimental finite Left-support priority

A separate optional `left-support` construction can fill an open four-cell Left
support deficit with the current I before covering it, but only when a distinct
already visible I is actually replayed to the original Right preparation column.
All intervening locks are nonclearing Left-only placements with no covered Left
vacancies; Center and Right stay unchanged until that final payment. The route
ends at the replacement I, uses at most seven public locks, and is neither a
scoring proof nor a Reset. This is an engineered supported subset, not a ban on
legitimate accessible overhangs or a general preference for I on the Left.

The ordinary coach decision is fully certified first. This finite alternative
uses only remaining request nodes/time, retaining the exact private incumbent
on failure or unknown proof. The ordinary cleanup-I reservation and resource-goal
comparator are unchanged. A dedicated validator replays the complete original
visible route on admission, HOLD/movement, and every retained lock; copied kind,
consumed or completion flags grant no authority. No Center classifier, S/L weight,
opening allocation or Right-filler policy changes are included.

The generic certificate establishes a useful support fill and finite Right
repayment; it does not prove that every alternative ordering would cover those
cells or be irreparable. The demonstrated no-fill J/L seal is a separate test
case, not a theorem inferred from every selected route. Confirmed Center and
Hanging-S obligations and T collisions must be paid at the certificate endpoint;
old unclassified allocations and deferred Hanging-L diagnostics remain explicit.
Original visibility is bound to the connected actual resource-history prefix,
including draws. A deduced forced-bag search copy is not substituted for that
actual observation during retention.
The dedicated exception waives only the first I's cleanup diversion. Actual cap
availability is independently replayed from the current pose and up to two legal
HOLDs before every step; an available Z cap still forbids optional Left work.
Those finite checks share the original node/deadline budget, and unknown proof
rejects the construction. T and Z are excluded from intermediate fillers.

## Private practice imports

The existing JSON textbox and **Import position or session** button also accept
`zztetris-st-practice` schema version 1. This player-only wrapper leaves
`zztetris-st-session` version 1 unchanged:

```json
{
  "format": "zztetris-st-practice",
  "schemaVersion": 1,
  "session": { "...": "a complete zztetris-st-session envelope" },
  "privatePractice": { "tail": ["I", "J", "L", "O", "S", "T", "Z"] }
}
```

The example is schematic, not an importable session. `tail` begins **after** the
six visible preview pieces, in draw order, not placement order. A filled-hold
swap draws nothing; an empty hold draws once. Supply is bounded to 4,096 piece
letters and the entire package to the session's 4 MiB JSON limit. A nonempty tail
requires six preview pieces. Full session validation and seven-bag consistency
at the public preview frontier complete before any game/worker mutation. Missing
bag history is checked over possible preview phases, not fabricated; tail
validation never narrows the public bag or fills missing resource history.

The controller keeps the tail private and only reveals draws into its six-slot
preview. It sends no tail or seed to the coach. The sequence never cycles or
falls back to randomness or forced-bag materialization after it ends; remaining
visible pieces may be played before the finite-supply end message. Restart
(including the reset key) restores the exact imported session and tape. Undo
rewinds the draw cursor alongside the existing public/history checkpoint.
Importing another session or selecting a mode replaces that origin. Both ordinary
export actions remain visible-only and deliberately omit the tail; retain the
original package to share the same exercise. Saved advice from another coach
version remains subject to the usual discard-and-recompute policy, not a
promise that this coach will repeat the recorded continuation.

### Extra-Z continuation ties

Ordinary final continuation selection preserves a known available Extra-Z
allowance only within an otherwise-equivalent group. The root permission must
come from complete, replay-validated history with an established baseline;
unknown history and a physical Z in HOLD/NEXT do not qualify. No clear or planner
projection renews the allowance.

Equivalence requires equal executed lock horizons and scoring/cleanup schedules, every existing numeric and
Center/opening-quality priority, exact structural score and endpoint damage
metrics, the same history origin and live piece/bag identities, and settled
cavity, Center, access and resource obligations. The preference does not replace
access/resource admission, required repairs, scoring goals or cleanup protections.
It applies after existing ordering, only by exchanging members of the same
eligible group; unrelated slots, unequal horizons and deterministic ties retain
the existing ordering. Beam expansion/pruning receives no Extra-Z bonus. Before optional challenger
checks, the ordinary incumbent must pass full outer admission and be registered
as the invocation-local fallback. Unfinished optional work cannot revoke it.

### Optional visible cap-and-score preservation

Ordinary maintenance may compare a fully admitted, goal-free Right filler with one narrow finite alternative: the current I/J/O stays on Left, the **next visible Z** occupies the existing cap cells, and the **actually held T** takes a canonical double. A filler loses this opportunity only when its actual nonclearing cells occupy those cap cells; an unrecognized shape label or a failed old T witness alone is insufficient.

This comparison runs after ordinary selection and final admission. It does not change the beam, depth, structural ranking, opening, construction commitments, or existing score goals. Every alternative is replayed and receives the usual phase, cavity, resource and access checks under the original remaining node/deadline budget. Failed or unfinished optional work returns the same privately bound, already-certified incumbent; caller/imported metadata cannot supply that authority. The finite returned cap/T score is retained through normal locks and HOLD. This is not a universal Right-filler ban, a guarantee of sustainability, or permission to bypass a rejected immediate TSD endpoint.

### Experimental certified S/L allocation comparison

The late, default-on S/L comparison is limited to ordinary maintenance with
replay-validated complete or partial resource history, current/held S and an
originally visible positive-identity L. It first privately admits the unchanged,
goal-free incumbent. A candidate must execute the first S's exact supported L
payment, translated through real clears, under all ordinary Right Z/T/I,
canonical-score, notch, cycle, resource, cavity and access checks.

The full paid candidate is compared with that exact incumbent, or its strongest
already-searched exact-prefix descendant, at equal completed locks and literal
public draw identities. A shorter paid candidate likewise needs an existing
complete-layer descendant. There is no new beam, hidden refill or truncation
before payment. Missing/unknown references, unavailable certificates, ties and
budget exhaustion retain the exact admitted incumbent. Optional work uses only
the original remaining request budget; it does not increase completed beam depth.

Promotion requires no worse actual score count/schedule, original obligations,
cleanup progress, queue-aware Left evaluation, Left covered/sealed damage,
headroom, sealed damage, Center continuity or entry/dependency debt; then a
strict existing Left-score gain or an earlier/additional actual canonical score.
Completing S/L alone is not a bonus. The old aggregate structural ranking is
unchanged for ordinary search but is not an absolute veto on this explicit
regional comparison. Telemetry records structural, Center, Right and covered-cell
tradeoffs, exact public inventories, witnesses and reference certificates. This
is a conservative experimental rule, not a claim that all S/L alternatives are
searched, a source theorem, or a sustainability guarantee. Partial history and
unknown Extra-Z permission remain partial/unknown. Long historical S/L paths can
remain valid mechanics without having a comparable ordinary horizon.

### Experimental ordinary S allocation preference

A separate late ordinary-plan comparison recognizes that S may be spent on Left
inside a prefix whose active/held pieces are O/J. It first certifies the ordinary
incumbent, then examines already generated complete-layer alternatives at the
same horizon which keep that observed S available. It may extend a supported S
preparation through an actually executed visible L payment, including a visible
L from a different known bag. A same-bag L already spent Left is not a universal
prohibition; unknown bag identity stays unknown. An unseen eventual L is not a
paid pair, and a visible L cannot discharge two reservations.

Both alternative and strongest bounded incumbent extension must pass ordinary
admission at equal lock/draw horizons, identical placed observed instances and
identical ending active/HOLD/known queue. All original scoring timing, cleanup,
resource, Left covered/sealed damage, headroom, Center continuity and entry debt
checks stay ahead of this preference. A genuine increase in fully paid supported
SL allocations with fewer Left S placements then outranks input effort and the
existing minor Left-tier score difference. Merely swapping two interchangeable
S identities is neutral. Known Hanging-S Left repayment remains unpenalized.

At most four existing alternatives and width-eight reference extensions are
examined within seven literal-known locks and the original remaining request
budget. These are explicit engineered search bounds, not community laws. Unknown
or failed completion/reference proof returns the privately admitted incumbent;
it does not prove that Left S was globally necessary. Real scoring-HOLD pressure
and necessary Left support survive because a competing route must preserve those
actual obligations rather than receiving an S-only bonus. Recomputed SL payment
counts protect a selected paid-SL suffix from replacement with an unrelated LO
completion; imported payment flags confer no authority. This experiment changes
neither the initial ordinary beam comparator nor historical resource permissions.

The existing root-active/held-S preference and first-I Right-preparation support
comparison keep precedence. The new ordinary stage does not intercept their
applicable roots, so an optional failure cannot suppress the established
reference decision.

### Experimental visible I/O tail comparison after completed SL

The experimental ordinary S-allocation branch can compare remaining visible I/O
placements **after** its existing complete-SL selection has been finally
admitted. That exact selected advice is the private fallback, not the earlier
ordinary S-Left route. This does not change the main beam, the Left tier table,
or the ordinary allocation preference itself.

The additional stage considers one or two remaining observed I/O instances,
including an O, within seven total literal-known locks; any other remaining
pieces must be T/Z and remain outside the matched I/O supply. A competing actual
score outside that supply makes the optional comparison decline. Every normal
Center/Right/movement/resource/cavity gate remains applicable; O is not forced
Left and I is not treated as a free Left filler. At most four distinct completed
SL prefix/resource states enter, including the prior selection, and each tail
layer retains at most two states after complete movement enumeration. Omitted
prefixes and layer counts are reported. This is strongest-within-retained search,
not exhaustive optimality.

Each competing completed prefix is re-certified. Every retained terminal node
is entry-qualified before terminal ordering, because qualification can change
its structural band. The local terminal order retains existing safety, Center
continuity, structural-band and scoring priorities, then compares the actual
terminal Left value before input effort. Only the strongest retained reference
and strongest challenger are finally certified; an unfinished or failed proof
cannot substitute an easier, weaker comparison target. Promotion requires a
strict realized Left gain, identical observed placed/drawn supply and ending
inventory, equal actual paid S/L bindings, no original score/cleanup/resource or
explicit quality regression, and an existing resource goal reaching the end of
the selected tail. No additional SL credit is awarded. In the diagnostic route,
the final actual I Right preparation keeps the intervening O→I suffix alive
through the earlier L payment under existing commitment machinery.

All work shares the request's remaining nodes/deadline. Unknown, exhaustion,
rejection or no strict gain returns the exact privately admitted prior SL
advice. `disableVisibleSLTail` isolates this stage for regression controls.
`metrics.ordinarySAllocation.visibleTail` records the prior admission, literal
I/O IDs, retained prefix/endpoint ranks, final two certificates and comparison;
the enclosing ordinary-allocation comparison continues to describe its original
complete-SL proof. Imported telemetry provides no admission authority.

### Finite Left-I scoring foundation

A separate [three-lock scoring-foundation contract](docs/st-left-scoring-foundation.md)
may use a Left I to fill cells in an actual visible Z/T double's scoring rows
when Right has only optional I preparation. Existing cleanup columns, retained
Pocket/scoring commitments and all other resource/access/quality checks remain
protected. It does not relax the ordinary I guard or Center classifier; the
post-score Center motif can remain explicitly uncertain. The original finite
proof is rederived through input, HOLD and each lock under the shared budget.

### Experimental surrounding allocation for an existing pending S/L

A separate late bounded comparison can revisit surrounding Left allocation when
an observed S is already pending its literal-visible L. It does not reward a new
Center S or change the main beam. The ordinary incumbent is privately admitted
first. Up to two already generated penultimate-layer alternatives keep that same
S/L obligation live while extending at most three locks, width two, to an equal
horizon of at most seven literal-known locks. The candidate must actually pay
that L **last**; a canonical score may precede it. This keeps the complete route
under the existing real Center resource goal, without retaining generic filler.
Fresh ordinary planning may still replace its order under the existing checked
same-goal and scoring-timing rules; retention is not a promise of identical next
inputs or execution of the original five-lock diagnostic sequence.

The strongest qualified bounded exact-incumbent extension and candidate must
have identical actual placed identities, public draws, ending active/HOLD/queue,
paid S/L pair and resource binding. A strict realized Left-context gain must also
preserve scoring timing, cleanup obligations, Center continuity, structural band,
headroom, cavity, notch, resource and access checks. Intermediate inventories may
differ; final inventory equality is mandatory. No hidden refill or guessed L is
credited. Unknown enumeration, strongest-endpoint qualification or final proof
returns the exact admitted incumbent, not an easier weaker comparison. Optional
work is capped at 18,000 additional nodes inside the original remaining request
budget and deadline. These explicit engineered bounds establish neither a global
best allocation nor longer survival. Existing I obligations, Right roles, partial
history semantics and Reset classification are unchanged.

### Public reserved-piece repair plans

Experimental midgame advice can recognize a narrow reserved-O completion plan
when an authenticated S/L Center stage and another visible S compete for space.
After ordinary admission, a width-four search may extend that same first move
through at most seven public locks, spending at most 12,000 remaining nodes
within the unchanged shared allowance. O must actually repay tracked covered
cells; the existing S/L stage and extra S accommodation must be resolved by the
finite endpoint. No unseen pieces, future repair guesses or historical spare-Z
permissions are supplied. A failed or interrupted optional search preserves the
admitted incumbent.

A full executed continuation may demonstrate an immediate next J Left exit from
D together with its later actual restoration, rather than requiring the isolated
short J helper to discover the entire repair. All resource, notch, canonical-clear,
covered-cell and access checks still apply. The original public repair witnesses
are replayed across movement, HOLD, actual reveals and line-clear translation.
These engineered bounds and finite certificates are not a guarantee of sustained
play or a Reset policy.

### Contextual explained-risk allocation

The experimental decision layer can compare an explicit D-risk placement with
an already supported finite alternative in one narrow public-supply situation:
HOLD would postpone S while at least two more S than L are visible, and actually
placing S on Left reduces that burden. The compared first locks must leave the
same public next draw and identical Center/Right, with no increased height or
new covered/sealed damage. Existing Center/repair commitments, retained advice,
opening and construction plans remain protected. This is a conservative
allocation hypothesis, not a community rule or a promise of an arriving J/L.

The chosen D placement stays risky, with its unresolved J timing and waiting
space explained. Advice explicitly acknowledges the supported alternative found
and the S-accommodation tradeoff; it does not claim no supported move existed or
that the risky move is proved superior over unseen future play. Normal risk
import/movement/reveal rejection and fresh replanning remain unchanged.

### Experimental bounded delayed-J plan

A D surface can now be supported when the currently active piece first pays
one exact authenticated pre-existing Center target, leaves Left unchanged and
creates no new covered/Center debt, and the resulting public inventory has a
strictly verified immediate J exit. The same canonical, notch, movement,
resource identity and shared time/node checks remain mandatory. A J merely
appearing somewhere in preview is not permission; arbitrary waiting and
recursive stage chains are outside this small grammar. Recorded plan metadata
is rebuilt during retention/import validation and is never trusted authority.
The one-J shorter route is distinct from a longer route that spends one J in
Center and a second J in Left. No reset detection or benchmark change is part
of this implementation. The general 85-line target is post-first-reset, not
an acceptance target for these experimental branches or opener-root samples.
