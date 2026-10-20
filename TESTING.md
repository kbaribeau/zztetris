# Browser-free regression tests

Use Node **24.20.0** (`.nvmrc`) and npm **11.19.0**. With nvm, run `nvm install && nvm use` first.

```sh
npm ci && npm test
```

Installation needs access to the npm registry (or a populated npm cache). **Test execution is offline**: it does not start a server, download browser binaries, or launch any browser. Production is still the same static HTML/JavaScript site; the npm dependencies are development-only. There is no build step or GitHub Actions requirement.

## Results and failures

`npm test` runs Node's built-in test runner in isolated child processes, with its TAP reporter. The small `scripts/test.cjs` wrapper also writes:

- `test-results/<run-id>/results.tap`: named checks, failures and diagnostics;
- `test-results/<run-id>/manifest.json`: full Git SHA, dirty flag, lockfile SHA-256, Node version, seed, test identifiers, durations, counts, failures and exit code.

The command exits nonzero for failed assertions, setup/unhandled errors, timeouts, missing tests, skipped/TODO cases, or the wrong Node version. Node's 15-second test timeout handles cooperative/asynchronous stalls; it cannot interrupt a child stuck in synchronous JavaScript. A parent watchdog aborts the whole suite after 60 seconds, including those synchronous hangs. Virtual time is separate from these real-time safety limits.

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
- Per-realm jsdom Storage. A modeled reload/navigation copies keys into a **fresh** same-origin realm; it is not real disk persistence, a browser reload, or a cross-tab storage event.
- Explicit non-rendering canvas, sprite and audio adapters. Sprite/audio paths must be allowlisted and exist locally. Sprites complete in order by default; `autoLoadImages: false` lets startup tests deliver the actual onload handlers in a controlled order (see [Sprite readiness regression](#sprite-readiness-regression)). Canvas requests are not pixel assertions.

Every resource request is resolved against an explicit local allowlist. The known animate.css CDN stylesheet is deliberately replaced with empty CSS because animation styling is outside these tests. Unknown URLs receive a denial and fail the case; they never fall through to the network. Explicit fetch/XHR/WebSocket/beacon calls are forbidden too (including synchronous XHR, which otherwise bypasses jsdom's request interceptors). Stylesheets are parsed, not laid out; fonts/icons are not rendered.

Unexpected host methods, resource errors, console errors and unhandled window errors fail the test. The only expected jsdom limitation accepted during a test is the navigation diagnostic emitted by the **real** controls Reset `onclick` calling `location.reload()`. The test requires that diagnostic exactly once, checks the storage deletions, then models reload with a new page. It does not swallow navigation failures elsewhere. Realm timers and windows are disposed in `finally`, including when assertions fail. Only trusted repository content should be run: jsdom is not a security sandbox.

### Fixtures and maintenance

`test/support/pages.cjs` explicitly lists the ten normal game pages and the separate ST lab page with their engines/modes/cadences. The lab has dedicated startup/settings tests because it uses temporary gravity-off rules rather than normal persisted gravity. Add a page deliberately, with a startup and settings case; do not treat practice as a proxy for the other engines.

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

## ST lab behavioral coverage

This branch tests the replacement continuation engine, not compatibility with the previous matcher. `st-core.test.cjs`, `st-center.test.cjs`, `st-scheduling.test.cjs` and `st-lab.test.cjs` execute the pure/resumable interface and actual page/engine. The manifest records the current test count, not a coverage percentage.

- Every tested witness executes all three locks through real `zzBot` hold/move/rotate/drop functions. Assert exact post-clear heaps and spin/mini/line counts, grounded zero-distance HD, no TOP OUT and distinct instance IDs. Source cap and double retain independent literal expected boards. A stale path on a missing-Left-cell board actually makes a single; a double without final rotation is not a spin.
- Active/held/empty/two-hold access, trapped I respawn, blocked intermediate hold and following spawns (including terminal spawn), immutable input, determinism, visible-prefix clipping/separators/hidden-suffix invariance, malformed state and shared pose/lock/candidate budgets remain covered. The generator and synchronous operation return identical results.
- Independent literal `st-continuation-fixtures.cjs` boards test two **distinct** I remedies for S-created shallow boundary channels, J's temporary roof followed by an actual S repair, and non-scoring/scoring routes. Depth 1/2, occupied hold and late-I counterexamples cannot claim the same S target resolved. Newly initiated OJ must finish inside the horizon. Center source completions execute without the superseded LO visible-S veto. Roof/support/preference negatives may select a different valid route, not blindly preserve an old target.
- Tests intentionally replace old fixed-priority, immediate-only, completion-only and blanket-veto assertions. Safety assertions were not redefined as matching old outputs. Conservative endpoint geometry still misses useful moves; passing legality tests is not a general strategy-quality certificate.
- Empty normal entry/restart, temporary rules/saved settings, input guards, custom SVG cells, toggle persistence, ordinary-mode isolation, history branches/truncation, locks while hidden, drawing, garbage, mirror, shuffle, hold/queue editing and all previously covered imports remain exercised. Fresh advice is allowed to differ after the horizon/endpoint change.
- Resumable work cancels on changed snapshots, hides old targets while pending, recomputes when shown and never resurrects advice after restart. The total elapsed deadline produces honest abstention; unchanged frames do not churn DOM/live regions. Tests wait for bounded completion rather than require synchronous answers in one frame.
- Real settings rebind/Reset and focus/modifier guards remain covered. Advice remains after the field in DOM reading order; jsdom cannot prove painted layout or real-browser responsiveness.

For lab layout changes, measure the actual canvas/HOLD/NEXT rectangles in a real browser at fixed viewport and scroll position before and after those advice transitions. Include long/wrapped continuation text, desktop and narrow widths, field horizontal scrolling, and a viewport near the vertical-scrollbar threshold. Rectangles must stay identical within each viewport/scroll setting; the advice panel must follow the canvas without overlap. Inspect screenshots, verify current (not cached) styles, and retain the commit/dirty state and measurements. Prepared scoring fixtures are layout examples, not natural-play evidence.

`test/st-natural.test.cjs` preserves the genuine seed-**29** empty-board replay and its manual quad, without board/queue/pose injection. The new advisor intentionally abstains on that irregular stack: a legal quad alone no longer certifies an ST endpoint. This is a recorded coverage loss, not a broken engine scoring test. `test/support/st-natural.cjs` retains all eleven observed construction locks.

`node scripts/st-trial.cjs [output.json]` runs twelve fixed-seed closed loops, with the actual normal generator and an explicitly injected established heap. Only the six-piece visible projection reaches the advisor. Each trial has a 56-lock cap and stops at first abstention—no handpicked fallback or omitted failures. It records every input/witness, exact-engine transition check, timing and stop reason. The 2000-series seeds were reserved before the final search evaluation; these are not natural openings, indefinite-play proofs or a player-learning study. The [playtest handoff](docs/st-playtest.md) reports the short runs and substantial missed coverage. Retain the full JSON with its revision/dirty marker, not just a success count.

These are bounded ST examples, not all rotations/boards/strategies. The existing baseline exclusions still apply outside these cases (for example, image decoding and complete mode-specific scoring). jsdom checks SVG attributes/labels, not pixels. No live LLM, network request, browser process or new test dependency is involved. The source `.lavish` study, screenshots and local review tooling are not part of the product/tests.

## Training display settings coverage

`test/training-settings.test.cjs` exercises all eleven actual game pages (ten normal modes plus the lab), the three engine copies and the real controls page. It covers missing/on/off preferences, grouped labels and descriptions, immediate marker redraw including the outgoing top cue and short custom segments, unchanged sprites/board/queue/hold/ghost/history, modeled reload, settings preservation, popup close without restart, enabled/disabled gameplay parity, guide setting/hotkey/button synchronization, restart/fresh recognition honoring the saved choice, normal-mode isolation and explicit Reset. The existing `preview/*` cases explicitly enable markers so default-off cannot weaken their geometry, import or special-segment assertions.

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
