# Browser-free regression tests

Use Node **24.22.0** (`.nvmrc`) and npm **11.19.0**. With nvm, run `nvm install && nvm use` first. Node 24.22.0 bundles npm 11.19.1; this repository intentionally keeps npm 11.19.0. Select the repository npm version from the official registry before installing dependencies:

```sh
npm install --global npm@11.19.0 --registry=https://registry.npmjs.org
npm ci && npm test
```

Installation needs access to the npm registry (or a populated npm cache). **Test execution is offline**: it does not start a server, download browser binaries, or launch any browser. Production is still the same static HTML/JavaScript site; the npm dependencies are development-only. There is no build step or GitHub Actions requirement.

## Results and failures

`npm test` runs Node's built-in test runner in isolated child processes, with its TAP reporter. The small `scripts/test.cjs` wrapper also writes:

- `test-results/<run-id>/results.tap`: named checks, failures and diagnostics;
- `test-results/<run-id>/manifest.json`: full Git SHA, dirty flag, lockfile SHA-256, Node version, seed, test identifiers, durations, counts, failures and exit code.

The command exits nonzero for failed assertions, setup/unhandled errors, timeouts, missing tests, skipped/TODO cases, or the wrong Node version. Node's 15-second test timeout handles cooperative/asynchronous stalls; it cannot interrupt a child stuck in synchronous JavaScript. A parent watchdog aborts the whole suite after 1,800 seconds, including those synchronous hangs. Virtual time is separate from these real-time safety limits.

A dirty run is diagnostic evidence, not proof of a clean commit. For delivery, run again after committing and retain the manifest **and** transcript for that SHA. `test-results/` is ignored, not durable versioned storage; copy the bundle somewhere with the retention you need, or set an output parent directory:

```sh
ZZTETRIS_TEST_RESULTS_DIR=/path/to/retained-results npm test
```

Never pipe a test command into `tee` without preserving its exit status. To reproduce one case while debugging (without the revision-bound wrapper):

```sh
node --test --test-name-pattern='gameplay/index.html/collision' test/gameplay.test.cjs
```

The ordinary unfiltered `npm test` remains the delivery command. Default seed **123** and the natural ST replay's seed **29** are recorded in each manifest; the replay's case entry records 29 rather than the default. Two successful runs should agree on case ids, outcomes, counts and seeds; elapsed durations and run ids naturally differ. `host/isolation` additionally compares actual game state across two same-seed fresh realms.

## The test seam

`test/support/page.cjs` creates one fresh jsdom realm per page. jsdom **emulates DOM/HTML**, not a browser renderer. It consumes the actual repository HTML and classic scripts in their declared order, including `defer` and inline handlers such as the controls reset link. Tests execute product behavior through checkbox clicks, input events and keyboard events, then assert saved settings and semantic game state. The game code is unmodified.

Before product initialization, the host installs:

- The actual locally pinned **jQuery 3.6.0**, matching the pages' CDN version.
- A fake timeout/interval/animation-frame clock. The real `render()` still runs because it also performs horizontal input processing. Replacing it with a no-op would hide game behavior.
- A seeded, bounded random stream. Normal gameplay does not use `tetrio.js`'s separate seeded queue generator. A constant random stub can hang cheese's different-hole loop.
- A Blob/object-URL/anchor download adapter captures emitted JSON bytes, MIME type and filename for the real export handler. It does not save files or prove browser download UI behavior.
- Per-realm jsdom Storage. A modeled reload/navigation copies keys into a **fresh** same-origin realm; it is not real disk persistence, a browser reload, or a cross-tab storage event.
- Explicit non-rendering canvas, sprite and audio adapters. Sprite/audio paths must be allowlisted and exist locally. Sprites complete in order by default; `autoLoadImages: false` lets startup tests deliver the actual onload handlers in a controlled order (see [Sprite readiness regression](#sprite-readiness-regression)). Canvas requests are not pixel assertions.

Every resource request is resolved against an explicit local allowlist. The known animate.css CDN stylesheet is deliberately replaced with empty CSS because animation styling is outside these tests. Unknown URLs receive a denial and fail the case; they never fall through to the network. Explicit fetch/XHR/WebSocket/beacon calls are forbidden too (including synchronous XHR, which otherwise bypasses jsdom's request interceptors). Stylesheets are parsed, not laid out; fonts/icons are not rendered.

Unexpected host methods, resource errors, console errors and unhandled window errors fail the test. The only expected jsdom limitation accepted during a test is the navigation diagnostic emitted by the **real** controls Reset `onclick` calling `location.reload()`. The test requires that diagnostic exactly once, checks the storage deletions, then models reload with a new page. It does not swallow navigation failures elsewhere. Realm timers and windows are disposed in `finally`, including when assertions fail. Only trusted repository content should be run: jsdom is not a security sandbox.

### Fixtures and maintenance

`test/support/pages.cjs` explicitly lists the ten normal game pages and the separate ST lab page with their engines/modes/cadences. The lab has dedicated startup/settings tests because it uses a separate pure zero-gravity rules/controller pair rather than a legacy engine. Add a page deliberately, with a startup and settings case; do not treat practice as a proxy for the other engines.

Shared gameplay cases arrange an independent empty 40×10 board and a fixed queue, using the existing `newPiece()` setup function. They then drive the real keyboard handlers. The collision fixture adds one heap cell at column 6, row 18; the spawning O cannot move right into it. The hard-drop oracle is two literal `....OO....` bottom rows, not the production landing algorithm recomputed in test code. Mode-specific initial boards are checked separately.

The narrow `snapshot()` projection contains heap, piece, queue, hold, coordinates, rotation, ghost and history cursor. Undo/redo assertions compare semantic state after actual drops, not just the cursor. This does **not** claim full combo/B2B history restoration. This trainer permits unlimited hold before a lock; do not impose guideline assumptions it does not implement.

When changing tests:

1. Assert observable state, persistence, notifications or host effects. Do not grep/snapshot implementation text as proof of behavior.
2. Use reviewed literal fixtures or simple independent invariants. Do not copy collision, rotation or scoring algorithms into an oracle.
3. Keep stable, descriptive case ids. Record any intentional behavior change rather than updating expected values just to make failures disappear.
4. Update dependencies and the lockfile deliberately; recheck loader/inline handlers and host isolation after jsdom/fake-timer upgrades. jsdom 30 uses request interceptors, not the older ResourceLoader interface.
5. Check test sensitivity in a disposable checkout: for example, disable the left move in `base.js` and confirm the named practice collision case fails. Restore it and confirm green. Never ship the fault or change real game code just to satisfy a test.

## Initial behavioral coverage

The initial baseline has **58 named tests**, not a measured statement/branch coverage percentage.

| Cases | Meaningful checks |
| --- | --- |
| `boot/*` (11) | All ten game pages plus controls load real scripts; active board/piece; 4w walls and 3/4/5/6 residue counts; 3w upper/lower well; cheese ten rows with one hole and differing adjacent columns. |
| `settings/*` (30) | Absent/true/false gravity on every game page; actual checkbox change persists; config/version preserved; custom DAS/ARR/SDR/cell size/audio restored; next tick and runtime toggle; 4 ms grav vs 700 ms other modes. |
| `persistence/*` (2) | A real preference toggle, modeled same-page reload and mode navigation across all ten pages, both enabled and disabled, preserving custom config. |
| `controls/*` (2) | Actual key/input handlers save a binding and five numeric settings; all three engines consume them and honor the new key/audio volume. Actual inline Reset preserves gravity/unrelated storage; fresh pages restore defaults. |
| `gameplay/*` (6) | Each of three engines: heap/wall collision and known ghost landing; hold/repeat suppression/unlimited swap; hard drop; semantic undo and redo after two locks. |
| `timing/*` (3) | Each engine: frame-driven first movement; custom DAS=185 and ARR=31 deadlines; release cancels repeating; custom SDR=17 and release. |
| `mode/cancelling` (1) | CancelStreak 19 vs 20 produces the base seven-piece bag vs one extra O. |
| `host/*` (3) | Fresh realm/prototype/storage/clock/seed isolation; unknown resources denied; explicit network and unhandled event errors surfaced. |

The bag-boundary extension adds **20 `preview/*` cases** to that initial 58-case baseline. They inspect the actual preview canvas draw requests from all ten game pages: six sprite slots, 2px white outgoing-piece corner positions (including top/bottom edges and multiple custom segments), no invented separator, unknown piece slots, hold/spawn/reset/reshuffle/mirror/undo/redo transitions, queue editing, TETRIO import redraw, PC partial/special presets, and cancellation's augmented batch length. These draw-call assertions are not proof of painted pixels. A short real-browser check should inspect contrast, clipping, alignment and the preview at a narrow viewport whenever the preview renderer or sprites change.

Future work, **not covered by this baseline**: kick tables/rotation edge cases, line-clear/combo/B2B/T-spin/perfect-clear fixtures, full opposite-key and zero-rate input matrix, touch handlers, history branching/cap/counters, mode row-refill and garbage-replenishment transitions, higher cancellation thresholds, remaining PC digit presets, shuffle properties, broader text/image import/export, drawing and host failure paths.

Statement coverage means lines executed; branch coverage means alternatives executed. Neither measures assertion quality, every board state, or browser fidelity. No percentage gate is configured.

## ST lab milestone coverage

`st-public-horizon.test.cjs` covers ordinary default search beyond three locks, finite public supply including HOLD and forced bag deduction, unchanged node/deadline caps, partial-search fallback, real-worker configuration, and prior production session migration without losing current obligations. Historical three-lock challenger and pending-L expiry controls now declare that scope explicitly; default-route checks separately allow already-executed quads, later scoring and longer retained commitments. The resource UI legacy-message oracle normalizes only the intentionally changed depth after asserting the new setting. Explicit depth-limited strategy fixtures keep their declared scope; these checks do not prove improved long-run play.

The old advisor and its implementation-specific gates remain removed. New pure suites cover rules/rotation metadata, actual-pose witnesses, all clear counts, hold/draw accounting and uncertain bag observations. `st-fixtures.test.cjs` independently decodes source Fumens and replays legal construction from empty. Source pictures are not planner answer lookups.

`st-hard-drop-dedup.test.cjs` compares placement enumeration against an eager public-move reference on every curated board under both rules profiles. It preserves exact output/witness ordering, shortest-witness replacement, node/deadline and predicate-call accounting, spin evidence, HOLD supply, imported full rows, top-outs and immutable inputs. A board-copy observer verifies duplicate landings do not materialize discarded successors; the independent literal row fixtures remain in `st-hard-drop-rows.test.cjs`.

`st-planner.test.cjs` checks hidden-future noninterference, finite proof replay, support/budget boundaries, reservoir construction, actual-pose revalidation and stable commitment through HOLD. `st-closed-loop.test.cjs` executes the planner's own decisions with newly revealed previews through nonclear → TSD → rebuild; it does not execute reference answers. `scripts/evaluate-st.cjs` reports broader held-out/closed-loop outcomes and latency, including failures, separately from unit assertions.

`st-placement-cache-key.test.cjs` checks that prior lock events share complete ordered placement results while current rotation evidence, revisions and carried state stay distinct. More cache reuse can change which bounded planner proofs finish. Pending-L coverage therefore separates the literal six-line S/T/I Pocket route from current live selection, follows the controller's separate waiting hint after a goal-free commitment retires, and replays newly public supply. A labeled component control gives one literal S/T/Z endpoint zero proof allowance to preserve unresolved-alternative disclosure coverage; it does not fabricate rejection or change production ranking/admission.

`st-pattern-state.test.cjs` covers trusted version 2 current notch imports without provenance, malformed shapes, obsolete-tape rejection, actual TSD/quad translation, newly established caps, sticky broken state, independent Undo snapshots, and 1,000 actual O-only manual locks with fixed-size facts. The O-only case is a lifecycle/storage test, not a supported ST or seven-bag strategy. Actual-page session import/export/Undo and the production Worker verify the transport boundary. `st-access-history.test.cjs` and `st-left-scoring-foundation.test.cjs` retain explicit obsolete-tape rejection cases alongside current-state advice revalidation. Resource transport carries trusted current obligations; historical resource/session replay imports are no longer supported. See [the retirement inventory](test/LEGACY-RETIREMENT.md) for removed historical-only coverage.

`st-lab.test.cjs` covers real page scripts with deterministic Worker protocol stubs, plus worker entry code, cancellation/revision races, withheld invalid witnesses, stable targets during exact execution, imports, hidden-future exclusion, hold/reset/manual play, and settings/input guards. This is not a real browser Worker/pixel test. The natural legacy replay now runs on ordinary practice, where its unlimited-hold contract belongs.

`st-line-counter.test.cjs` covers actual clear-event accumulation (single through quad and TSD), Undo, restart/random reset, mode/position/session-import baselines, rejected imports, non-clears and terminal actions through the real page controller. It also checks the shared attached board-footer/live-region structure and accessible label, plus 1,234 actual cleared rows from a synthetic O-only fixture (not seven-bag history), grouped formatting and Undo after history pruning. `st-piece-counter.test.cjs` checks the persistent locked-piece total independently of draws/HOLD, prefilled heaps, clears and terminal no-ops; both visible/accessible baselines; import/export, resets, Undo/branching, unchanged badges/advice hiding, and 10,005 actual locks with grouped large-number display and bounded Undo. Real desktop/narrow screenshots must supplement these DOM assertions for footer alignment, large-count wrapping, unchanged board/target geometry and the above-field badges.

`st-import-alert.test.cjs` drives the actual importer through parse errors, multi-code position errors, long preview-limit messages, session schema/settings/replay rejection, accepted-session warnings, successful imports and exports. It checks retained input/game/worker state, safe text rendering, repeated live-region mutations, focus/selection preservation, previous-attempt wording during edits, collapsed-section failure cues and the absence of a new Edit JSON action. Supplement these DOM checks with desktop/narrow browser captures for contextual alert prominence, wrapping, board geometry and real keyboard focus; DOM live-region attributes alone do not certify screen-reader speech.

`st-coaching-phase.test.cjs` exercises the actual page’s compact phase badge through saved modes, imports, manual play, restart, advice hiding, pending/stale/unsupported/error results, finite-queue exhaustion and top-out. The actual opening-clear/handoff/Undo route in `st-undo.test.cjs` also checks Opening → Mid-game → Opening without changing the selected Empty board start. The phase badge is session context, not a new Reset classifier. `st-resource-badges.test.cjs` replays retained public test supply through actual controller draws to check observed S / spent Z, inactive versus unknown, source-profile departures, Undo, restart/import/mode boundaries, advice-hidden state and rejection of hypothetical worker allocations as badge truth. It also exercises confirmed Hanging S/L counts of 0, 1 and 2 through real allocations, HOLD, identity-specific repayment, Undo and imports; counts in hover/focus descriptions and accessible names; positive-count highlights despite retained profile caveats; focused-key isolation, Escape dismissal and terminal historical qualifiers. These DOM assertions do not prove rendered layout. Check the [above-field badges](ST-LAB.md), outline/fill and double-contour cues, focus/hover details, unchanged board/target alignment and wrapped toolbar at desktop and a verified narrow viewport.

See [ST-LAB.md](ST-LAB.md), [corpus provenance](docs/st-fixture-corpus.md) and [measured evaluation](docs/st-evaluation.md). Real browser visual checks and subjective learning/playtest remain separate acceptance requirements. All unrelated behavioral suites remain active. Use each run manifest for the actual count.

## Training display settings coverage

`test/training-settings.test.cjs` exercises normal pages and lab preference synchronization, while `st-lab.test.cjs` tests the lab’s observed-bag boundary rendering; together they cover all eleven game pages, the three engine copies and the real controls page. It covers missing/on/off preferences, grouped labels and descriptions, immediate marker redraw including the outgoing top cue and short custom segments, unchanged sprites/board/queue/hold/ghost/history, modeled reload, settings preservation, popup close without restart, enabled/disabled gameplay parity, guide setting/hotkey/button synchronization, restart/fresh recognition honoring the saved choice, normal-mode isolation and explicit Reset. The existing `preview/*` cases explicitly enable markers so default-off cannot weaken their geometry, import or special-segment assertions.

The harness manually delivers cross-window StorageEvents after copying values because jsdom realms do not share a browser storage area. This is behavioral script coverage, not proof of real popup event propagation, layout or painted canvas pixels. For settings changes, supplement it with a real browser popup, narrow Training layout, keyboard activation, on/off marker pixels and amber/gray separation. The separate image-startup cases below test out-of-order readiness; the settings cases retain ordinary in-order image completion.

## Sprite readiness regression

`test/image-startup.test.cjs` adds six cases: normal and last-listed-first completion on the actual practice, 3w and cancelling pages, covering all three loader copies. A literal initial queue keeps Z in NEXT. With Z still pending, completing the last-listed image and advancing 1,000 ms must not enter the game, initialize history, draw NEXT or schedule a board frame. Completing Z then allows exactly one real startup after the existing 250 ms delay, with initialized history, six valid sprite draw arguments and a running board-frame loop. Observers forward to the real game entry and frame scheduler; they do not substitute game behavior.

The new out-of-order cases reproduce the prior defect: on the unmodified base, all three throw `Drawing an unloaded image` through the preview/startup path. An in-order pass alone would not detect this race. For browser validation, serve byte-intact base/repaired snapshots while delaying the same needed sprite response beyond the last-listed sprite's completion; compare actual board/NEXT pixels and console errors with matched Training preferences. Injected delays are not normal-use failure-frequency evidence. See [README.md](./README.md) for user-facing startup behavior and failed-image limits.

## Shared navigation coverage

`navigation.js` and `styles/navigation.css` supply the same menu to all twelve shipped HTML screens, including standalone/popup settings. `test/navigation.test.cjs` boots those actual pages and checks the complete ordered menu, labels, resolved destinations, current-page marker, focusability, settings activation, focused-navigation input isolation and unchanged game state. PC-specific regressions send Digit1 with its legacy key code through focused menu entries, asserting unchanged board, queue and full history, then verify ordinary preset activation outside the menu and held-movement release on the menu. A directory inventory assertion catches newly shipped HTML screens that are missing from the behavioral matrix. The existing automatic test-file discovery includes this suite exactly once.

Normal link clicks are observed at jsdom's navigation boundary; each destination boots separately in the same matrix. Popup mode links must reach that same boundary without cancellation, opener redirection or window closure. Tests also exercise actual controls edits, immediate persistence, settings consumption by a fresh destination page, Save & Close, and Ctrl/Meta/Shift/Alt/middle-click behavior. These are runtime DOM/handler tests, not source-regex tests, simulated browser traversal or rendered-layout proof.

For browser acceptance, check Cheese, 4W, ST lab and settings at desktop and a verified narrow viewport: menu wrapping/focus, actual Tab/Enter/Space, all six mode destinations, About's new tab, and no overlap with mode controls. Exercise display-only popup edits (no restart), legacy handling edits (reload after close), reopened settings, mode selection from the popup (navigate that window, keep the opener and popup open), native modified clicks, and standalone settings navigation. The normal gameplay workspace keeps its fixed-size horizontal layout and scrolls below the wrapping menu; this change does not promise responsive gameplay. Chrome's minimum window width can exceed a requested resize; record `innerWidth` and use explicit viewport emulation before diagnosing app overflow. Three-wide/cancelling first-run welcome alerts are separate from navigation readiness and must be accepted before probing those pages. Use the [results retention](#results-and-failures) guidance for before-fix failures and clean-commit results.

Evidence from the original navigation head `f25299378c0a6e124c12cb9806ec9770a900a4ac` is historical: it predates removal of popup interception and the gameplay-specific breakpoint. Retain those records, but do not use them to validate the corrected revision; record fresh focused menu/popup/narrow results with their revision and dirty state.

## Short, change-triggered browser smoke

Do not manually replay all rules/persistence permutations after a local suite pass. Browser evidence remains for host behavior that emulation cannot establish:

| Change | Small residual check |
| --- | --- |
| HTML/CSS/canvas/sprites/deployed paths | Open an affected page under the deployed path; inspect board, ghost, hold/next, notifications and missing assets. Include narrow layout when styling changes. |
| Keyboard/touch/timer adapters | Real key hold/release and opposite-key interaction; focus/scroll behavior; touch start/end on a real touch device if touched by the change. Browser timer clamping/throttling is not virtual-clock behavior. |
| Settings or popup wiring | Edit a binding/timing, close the popup, reload and switch a mode in an actual browser profile. |
| Audio, clipboard, drawing/image import | Check audible output/autoplay, permission behavior, pixel-to-cell geometry or image decoding only for the affected path. |
| Script URLs/load strategy | Verify actual CDN/asset loading and startup, including the delayed-image comparison above when readiness changes. Controlled fake image completion does not prove browser painting or actual network behavior. |

Sprite-readiness changes require the delayed-image browser comparison above in addition to local tests. The remaining checklist is supplemental risk-based evidence, not a request for GitHub CI.

## No-mistakes validation

The suite remains independently runnable with `npm test`. Repository-specific gate instructions live in [.no-mistakes.yaml](./.no-mistakes.yaml). Follow the [results retention](#results-and-failures) guidance and [change-triggered browser checklist](#short-change-triggered-browser-smoke). Preserve the project's accepted local-only/no-CI policy; an empty forge check list is not itself evidence of passing tests.

## Closed-loop simulations

`st-visible-left-repair.test.cjs` covers the observed deep-Left J repair through
Center/Right preparation, exact piece and landing goals, movement/HOLD and
post-lock retention, changed public supply, stale/forged claims, budget limits,
and retirement after actual repair. A fresh production-budget Worker VM checks
discovery separately from recorded replay. These finite cases do not establish
general policy improvement; use the paired simulation contract below.

Use the separate [ST simulation runner](docs/st-simulation.md) for bounded seeded play, replayable action traces, and matched comparisons. It is opt-in and is not part of `npm test`; a lock cap is censored evidence, not proof of indefinite play.

Use `--parallel 4` for routine diagnostic simulation batches. For example,
`npm run sim:st -- --preset quick --scenario both --parallel 4` supplies four
episodes. This recommendation does not change the CLI's serial default or the
production acceptance requirement: use one worker with ordinary timeouts and
controlled host load for those measurements. See the runner guide for the
optional `--no-search-timeout` mode and host-specific calibration limits.


### Serial-suite compilation cache

The behavioral runner uses a new private temporary Node compilation cache for
its child processes on each invocation. This saves repeated parsing/compilation
of shared dependencies without sharing module instances, globals, jsdom realms
or planner results. Every run begins cold; the runner verifies child enablement,
records it in the manifest, and removes its cache afterward. The serial order
and 15-second file timeout remain unchanged. The parent watchdog is 1,800 seconds
because the expanded suite can exceed the previous 300-second limit. Planner
per-move budgets are unchanged.

Set `NODE_DISABLE_COMPILE_CACHE=1` to opt out. The runner also disables compilation
caching when `NODE_V8_COVERAGE` is set: Node warns that V8 coverage can be less
precise for deserialized compiled code. These behavioral test counts are not a
V8 coverage report. See [Node's compile-cache documentation](https://nodejs.org/download/release/v24.15.0/docs/api/module.html#module-compile-cache).

The shared Context/public inventory tests cover actual controller lifecycle resets,
import and exact 100-lock Undo restoration/branching. Historical ledger and tape
import tests have been retired or ported to native current checkpoints.
`st-obligation-inverse-page.test.cjs` covers caller-owned inverse receipts, partial
next-turn Undo, phase markers, stale replies and failures after accepted transitions.
`st-left-plan*.test.cjs` checks selected current Left work through page and simulation
acceptance, replanning, actual payment, recovery and Undo. `st-obligation-state-size.test.cjs`
checks unchanged core size across long movement histories and repeated clear cycles.

### Shared timed-coach allowance

`st-coach-config.js` exports the frozen `SEARCH_TIME_MS` constant (currently
1500 ms) to CommonJS and classic browser/worker scripts. The live page, worker
fallback, simulation configuration, timed evaluation loop and normal timed
planner regression tests consume it. `st-coach-config.test.cjs` verifies the real
page request and worker deadline/default plumbing, including an injected alternate
configuration to detect copied literals; explicit zero/tiny overrides remain exact.

This is not the 2500 ms worker watchdog or the 1,800-second suite watchdog. Deliberate
zero/tiny-budget safety and protocol probes, historical manifest fixtures,
incompatible-budget comparisons, fixed-node/no-wall-clock tests and internal
sub-search ceilings remain separate. Do not replace those values as if they were
production defaults. The worker's omitted-time fallback now matches the live
coach, rather than its previous independent 200 ms default. No search depth,
width, node limit or strategy was changed.

## Node runtime stability

Node 24.22.0 includes the V8 GC correction linked to
[Node issue 62393](https://github.com/nodejs/node/issues/62393) and
[backport fb0d0ca289](https://github.com/nodejs/node/commit/fb0d0ca289).
The previous 24.20.0 runtime intermittently crashed on macOS ARM64 during fresh
simulation-worker VM execution. Keep fresh contexts, shared live planner limits,
watchdogs and validators unchanged; disabling checks or forcing GC is not the
fix. See the [official 24.22.0 release](https://nodejs.org/en/blog/release/v24.22.0).

When comparing engine revisions, run both under this same pinned runtime.
Historical 24.20.0 timing and crash records remain historical evidence, not a
comparable performance baseline for 24.22.0 runs. A clean finite experiment does
not prove the runtime can never crash. The npm pin and dependency versions are
unchanged by this runtime update.

## Private practice packages

`test/st-practice.test.cjs` checks the bounded player-only wrapper, full-tail
seven-bag compatibility, invalid payload rejection and preservation of unknown
history. `test/st-practice-import.test.cjs` drives the actual lab's existing
textbox/button through repeated and rejected imports, stale worker replies,
empty/occupied hold, Undo, button/key Restart, finite exhaustion, and visible-only
exports. Paired private tails produce identical initial Worker payloads; later
requests contain only actual newly revealed previews and observed history. The
finite-end case deliberately leaves a publicly forced seventh piece unavailable:
the private package cannot silently gain a substitute draw. These actual-page
DOM/controller tests use the documented Worker host stub, not a rendered browser
or a claim about real Worker execution. Real-browser acceptance remains separate.

### Effort-neutral selection contracts

Fresh S selections are checked against reviewed occupied cells and event/supply
semantics rather than one symmetric rotation encoding. Their actual witnesses
must still replay to the exact described events. Saved commitments, remaining
witnesses, Worker requests and Undo restoration retain exact selected targets;
this is not a relaxation of T-spin access or history identity.

Fresh-choice scoring timing is a development-performance diagnostic rather than
an immediate-placement correctness gate. The `st-regional-feedback` and
`st-closed-loop` tests emit deterministic `selection-performance` JSON in TAP:
lock horizon, first TSD lock (`null` if none), TSD/line totals and cycle status.
The direct-double cases still independently replay the reviewed immediate TSD.
The fixed routes in `test/fixtures/effort-neutral-scoring-routes.json` preserve
both the earlier four-lock scoring/rebuild cycle and the effort-neutral missed
cycle as replayable historical evidence, not required current planner outputs.
A green suite therefore does not mean scoring speed recovered. Saved-goal timing,
legal execution, canonical clears, resource obligations and supported play stay
hard assertions. No horizon is enlarged to hide a missed score.

Comparison/guard tests bind authentic admitted routes and independently checked
endpoints. Their test-only controls may select a historical challenger, but do
not grant that challenger production admission or alter the shipped planner.
Interrupted optional-work accounting captures the incumbent in the same search,
charges the injected work exactly and rejects any proof after its deadline.

### Simulation coach entries

`test/st-coach-entry-metrics.test.cjs` checks actual entry counters (including
immediate abstention, repeated cycles, import compatibility and final-lock Reset
handback). The real Reset-ledger replay verifies that the second qualifying T
returns to early midgame. These metrics are simulation-only; no policy input,
ranking or planner budget is changed. See `docs/st-evaluation-contract.md` for
per-run and cohort reporting and unavailable legacy measurements.

`st-handoff-sl-boundary.test.cjs` checks the opening-to-maintenance S/L boundary:
all used/unused combinations, arbitrary opening regions, original bag identities
through repeated HOLD, two simultaneous S obligations, deferred reveals, exact
H01 public history, unchanged board repair facts, worker/session transport and
the prospective context supplied to fresh/forecast/recovery planning. It also
makes explicit that a tape's phase marker is an input, not authentication of the
original decision. The actual page's handoff/Undo/replay case in `st-undo.test.cjs`
checks the same resource ledger before and after restoration. These accounting
checks and the existing recovery-budget tests are separate from timed strategic
simulation evidence.

`st-fresh-maintenance-handoff.test.cjs` covers generic fresh supported selection
after an eligible, fully admitted handoff: marked resource history, shared
remaining budgets, forecast fallback, provenance, no Reset dispatch, and exact
finite J-goal retention with actual movements and newly public supply. A second
eligible position checks delegation without requiring that repair. Production
Worker execution is separate from component deadline controls; paired finite
simulations and real-browser checks remain separate acceptance evidence.

`st-opening-third-t.test.cjs` checks ordinary visible first-double route retention
through actual input/reveal history, separately from post-clear handoff proof.
It includes invalid original supply, event/action/bag/history changes, budget
expiry, immutable routing, preserved legacy forecast payload and rejection of
construction-only forecasts by maintenance admission. The minimized fixture
contains public observation/history and visible witnesses, not a private stream.

`st-state-owned-projection.test.cjs` covers identity-gated immutable hypothetical
transitions across the envelope, S/L and allocation components. Public codecs
remain mutable and fully validating; caller-frozen copies and proxies do not
inherit ownership. Tests include direct component serialization hooks, nested
mutation isolation, signed-zero notch facts, actual classic Worker loading,
and parity with the ordinary reducers. These are correctness checks, not a
performance claim; measure complete searches separately on frozen revisions.

### Ordinary known-invalid pruning

`st-ordinary-early-rejection.test.cjs` checks that ordinary main-search nodes
with an already invalid notch or cycle debt stop before resource projection.
Shared preparation and repair callers retain the complete construction path.
Tests preserve existing placement evidence, inherited debt, the Right-piece
gate and the distinction between a structural preference and a hard rejection.
This is a computation reduction, not a broader regional policy or a claim
that unfinished proofs establish impossibility.

### Saved goals and symmetric landing outcomes

`st-saved-outcome-extension.test.cjs` exercises optional same-horizon, Reset and
reserved-O extensions when ordinary reduction removes a saved symmetric pose.
Matching physical outcomes are only a discovery hint: the original saved prefix
and resource route are preserved, and the searched tail is replayed and rebuilt
within the shared budget. Reset still requires its literal saved event/witness
prefix. Existing exact-event fast paths are unchanged, including their existing
observed-result comparison scope.

Tests include noncanonical I/S/Z integration controls, disabled-fallback
sensitivity for ordinary/Reset extensions, distinct trusted accounting roots,
real same-cell no-spin/mini events, actual HOLD identity/draw differences,
invalid tails and interrupted replay. They establish finite compatibility and
fail-closed behavior, not improved strategic quality or production latency.

### Timed commitment replay

Simulation traces record a `clock-tape-v1` receipt for post-lock commitment
recertification. Run-length-encoded clock samples preserve the actual 150 ms
proof deadline; the runner does not substitute unlimited or node-only search.
Replay reruns the original resource, goal, event, supply and access checks with
those samples, requires exact clock consumption, and compares the retained
result hash as well as the next public request. This makes the retention check
reproducible without trusting a recorded keep/drop result. Per-action display
retention remains a separately reported timing diagnostic.

Clock recording adds small per-sample bookkeeping, so instrumented wall-clock
results still need matched comparisons; it is not a zero-overhead claim. Old
traces without this receipt explicitly report `legacy-live-clock` and can still
fail when timed commitment proof completion differs. They are not silently
upgraded or reclassified as passes. New traces missing or corrupting a receipt
fail verification. The minimized `commitment-clock-replay.json` fixture covers
the real Z/S suffix whose 2,430-node repair formerly crossed the deadline, both
completed and expired, with exact obligation and mutation checks.

### Search explorer

`st-search-trace.test.cjs` checks deterministic node-bounded traced/untraced
ordinary and opening results, independently replays captured paths, verifies
explicit trace truncation and zero-budget limits, and executes the real worker
script loading protocol. `st-search-explorer-ui.test.cjs` drives the actual lab
page through opt-in capture, safe event rendering, frozen state, independent
coaching, cancellation and stale replies. These DOM tests are not painted-pixel
or real-worker scheduling evidence.
