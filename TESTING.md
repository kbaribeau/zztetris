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

The command exits nonzero for failed assertions, setup/unhandled errors, timeouts, missing tests, skipped/TODO cases, or the wrong Node version. Node's 15-second test timeout handles cooperative/asynchronous stalls; it cannot interrupt a child stuck in synchronous JavaScript. A parent watchdog aborts the whole suite after 300 seconds, including those synchronous hangs. Virtual time is separate from these real-time safety limits.

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

The old advisor and its implementation-specific gates remain removed. New pure suites cover rules/rotation metadata, actual-pose witnesses, all clear counts, hold/draw accounting and uncertain bag observations. `st-fixtures.test.cjs` independently decodes source Fumens and replays legal construction from empty. Source pictures are not planner answer lookups.

`st-planner.test.cjs` checks hidden-future noninterference, finite proof replay, support/budget boundaries, reservoir construction, actual-pose revalidation and stable commitment through HOLD. `st-closed-loop.test.cjs` executes the planner's own decisions with newly revealed previews through nonclear → TSD → rebuild; it does not execute reference answers. `scripts/evaluate-st.cjs` reports broader held-out/closed-loop outcomes and latency, including failures, separately from unit assertions.

`st-lab.test.cjs` covers real page scripts with deterministic Worker protocol stubs, plus worker entry code, cancellation/revision races, withheld invalid witnesses, stable targets during exact execution, imports, hidden-future exclusion, hold/reset/manual play, and settings/input guards. This is not a real browser Worker/pixel test. The natural legacy replay now runs on ordinary practice, where its unlimited-hold contract belongs.

`st-line-counter.test.cjs` covers actual clear-event accumulation (single through quad and TSD), Undo, restart/random reset, mode/position/session-import baselines, rejected imports, non-clears and terminal actions through the real page controller. It also checks the shared attached board-footer/live-region structure and accessible label, plus 1,234 actual cleared rows from a synthetic O-only fixture (not seven-bag history), grouped formatting and Undo after history pruning. `st-piece-counter.test.cjs` checks the persistent locked-piece total independently of draws/HOLD, prefilled heaps, clears and terminal no-ops; both visible/accessible baselines; import/export, resets, Undo/branching, unchanged badges/advice hiding, and 10,005 actual locks with grouped large-number display and bounded Undo. Real desktop/narrow screenshots must supplement these DOM assertions for footer alignment, large-count wrapping, unchanged board/target geometry and the above-field badges.

`st-import-alert.test.cjs` drives the actual importer through parse errors, multi-code position errors, long preview-limit messages, session schema/settings/replay rejection, accepted-session warnings, successful imports and exports. It checks retained input/game/worker state, safe text rendering, repeated live-region mutations, focus/selection preservation, previous-attempt wording during edits, collapsed-section failure cues and the absence of a new Edit JSON action. Supplement these DOM checks with desktop/narrow browser captures for contextual alert prominence, wrapping, board geometry and real keyboard focus; DOM live-region attributes alone do not certify screen-reader speech.

`st-coaching-phase.test.cjs` exercises the actual page’s compact phase badge through saved modes, imports, manual play, restart, advice hiding, pending/stale/unsupported/error results, finite-queue exhaustion and top-out. The actual opening-clear/handoff/Undo route in `st-undo.test.cjs` also checks Opening → Mid-game → Opening without changing the selected Empty board start. The phase badge is session context, not a new Reset classifier. `st-resource-badges.test.cjs` replays retained public test supply through actual controller draws to check observed S / spent Z, inactive versus unknown, source-profile departures, Undo, restart/import/mode boundaries, advice-hidden state and rejection of hypothetical worker allocations as badge truth. It also exercises accessible names/descriptions, focused-key isolation, Escape dismissal and terminal historical qualifiers. These DOM assertions do not prove rendered layout. Check the [above-field badges](ST-LAB.md), outline/fill and double-contour cues, focus/hover details, unchanged board/target alignment and wrapped toolbar at desktop and a verified narrow viewport.

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

Use the separate [ST simulation runner](docs/st-simulation.md) for bounded seeded play, replayable action traces, and matched comparisons. It is opt-in and is not part of `npm test`; a lock cap is censored evidence, not proof of indefinite play.


### Serial-suite compilation cache

The behavioral runner uses a new private temporary Node compilation cache for
its child processes on each invocation. This saves repeated parsing/compilation
of shared dependencies without sharing module instances, globals, jsdom realms
or planner results. Every run begins cold; the runner verifies child enablement,
records it in the manifest, and removes its cache afterward. The serial order,
The 15-second file timeout remains; the parent watchdog is 300 seconds to accommodate the expanded serial resource-regression suite. Planner per-move budgets are unchanged.

Set `NODE_DISABLE_COMPILE_CACHE=1` to opt out. The runner also disables compilation
caching when `NODE_V8_COVERAGE` is set: Node warns that V8 coverage can be less
precise for deserialized compiled code. These behavioral test counts are not a
V8 coverage report. See [Node's compile-cache documentation](https://nodejs.org/download/release/v24.15.0/docs/api/module.html#module-compile-cache).

`st-piece-ledger.test.cjs` checks the observation-only compact ledger: entered versus
preview supply, unlimited HOLD identity, cross-bag SL candidate/completion,
unresolved accommodation, source/import provenance, ZJ counts, 4,100 movement
inputs and 600 locks without cumulative truncation. `st-piece-ledger-ui.test.cjs`
checks controller integration, diagnostic isolation, lifecycle resets and exact
100-lock Undo retention/restoration/branching. Existing resource-history UI request
oracles remain unchanged. These tests do not claim the shadow facts influence
recommendations or repair the existing planner tracker.

### Shared timed-coach allowance

`st-coach-config.js` exports the frozen `SEARCH_TIME_MS` constant (currently
1500 ms) to CommonJS and classic browser/worker scripts. The live page, worker
fallback, simulation configuration, timed evaluation loop and normal timed
planner regression tests consume it. `st-coach-config.test.cjs` verifies the real
page request and worker deadline/default plumbing, including an injected alternate
configuration to detect copied literals; explicit zero/tiny overrides remain exact.

This is not the 2500 ms worker watchdog or the 300-second suite watchdog. Deliberate
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
