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

The ordinary unfiltered `npm test` remains the delivery command. Fixed seed **123** is recorded in every manifest. Two successful runs should agree on case ids, outcomes, counts and seeds; elapsed durations and run ids naturally differ. `host/isolation` additionally compares actual game state across two same-seed fresh realms.

## The test seam

`test/support/page.cjs` creates one fresh jsdom realm per page. jsdom **emulates DOM/HTML**, not a browser renderer. It consumes the actual repository HTML and classic scripts in their declared order, including `defer` and inline handlers such as the controls reset link. Tests execute product behavior through checkbox clicks, input events and keyboard events, then assert saved settings and semantic game state. The game code is unmodified.

Before product initialization, the host installs:

- The actual locally pinned **jQuery 3.6.0**, matching the pages' CDN version.
- A fake timeout/interval/animation-frame clock. The real `render()` still runs because it also performs horizontal input processing. Replacing it with a no-op would hide game behavior.
- A seeded, bounded random stream. Normal gameplay does not use `tetrio.js`'s separate seeded queue generator. A constant random stub can hang cheese's different-hole loop.
- Per-realm jsdom Storage. A modeled reload/navigation copies keys into a **fresh** same-origin realm; it is not real disk persistence, a browser reload, or a cross-tab storage event.
- Explicit non-rendering canvas, sprite and audio adapters. Sprite/audio paths must be allowlisted and exist locally. Sprites complete in order; their real onload handler schedules the 250 ms game startup. Canvas requests are not pixel assertions.

Every resource request is resolved against an explicit local allowlist. The known animate.css CDN stylesheet is deliberately replaced with empty CSS because animation styling is outside these tests. Unknown URLs receive a denial and fail the case; they never fall through to the network. Explicit fetch/XHR/WebSocket/beacon calls are forbidden too (including synchronous XHR, which otherwise bypasses jsdom's request interceptors). Stylesheets are parsed, not laid out; fonts/icons are not rendered.

Unexpected host methods, resource errors, console errors and unhandled window errors fail the test. The only expected jsdom limitation accepted during a test is the navigation diagnostic emitted by the **real** controls Reset `onclick` calling `location.reload()`. The test requires that diagnostic exactly once, checks the storage deletions, then models reload with a new page. It does not swallow navigation failures elsewhere. Realm timers and windows are disposed in `finally`, including when assertions fail. Only trusted repository content should be run: jsdom is not a security sandbox.

### Fixtures and maintenance

`test/support/pages.cjs` explicitly lists all ten game pages and their engines/modes/cadences. Add a page deliberately, with a startup and settings case; do not treat practice as a proxy for the other engines.

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

Future work, **not covered by this baseline**: kick tables/rotation edge cases, line-clear/combo/B2B/T-spin/perfect-clear fixtures, full opposite-key and zero-rate input matrix, touch handlers, history branching/cap/counters, mode row-refill and garbage-replenishment transitions, higher cancellation thresholds, PC digit presets, shuffle properties, text/image import/export, mirror/drawing and host failure paths.

Statement coverage means lines executed; branch coverage means alternatives executed. Neither measures assertion quality, every board state, or browser fidelity. No percentage gate is configured.

## Short, change-triggered browser smoke

Do not manually replay all rules/persistence permutations after a local suite pass. Browser evidence remains for host behavior that emulation cannot establish:

| Change | Small residual check |
| --- | --- |
| HTML/CSS/canvas/sprites/deployed paths | Open an affected page under the deployed path; inspect board, ghost, hold/next, notifications and missing assets. Include narrow layout when styling changes. |
| Keyboard/touch/timer adapters | Real key hold/release and opposite-key interaction; focus/scroll behavior; touch start/end on a real touch device if touched by the change. Browser timer clamping/throttling is not virtual-clock behavior. |
| Settings or popup wiring | Edit a binding/timing, close the popup, reload and switch a mode in an actual browser profile. |
| Audio, clipboard, drawing/image import | Check audible output/autoplay, permission behavior, pixel-to-cell geometry or image decoding only for the affected path. |
| Script URLs/load strategy | Verify actual CDN/asset loading and startup. Ordered fake image completion does not prove network races. |

Local tests are sufficient for this project's regression gate; this checklist is supplemental risk-based evidence, not a request for GitHub CI. No browser check was used to certify this test-tooling-only change.

## Future no-mistakes use

The suite is independently runnable; this change does not invoke or configure no-mistakes. The installed version inspected during setup was **v1.76.0**. Its CLI help did not expose a supported repository schema/effective-config query, and the online configuration reference describes a newer release, so compatibility of optional repository command wiring was not established here. No speculative YAML, global configuration changes or daemon updates were added.

When configuration support is verified for the installed version, use this exact committed command and retain its result bundle as the local baseline rather than having an agent invent a fresh sequence. Keep any supplemental browser investigation limited to the change-triggered checklist above. Preserve the project's accepted local-only/no-CI policy using that version's supported configuration; an empty forge check list is not itself evidence of passing tests.
