# Visual review packets

The README should let the player recognize each starting position and prioritize review **before** opening Fumen or playing. Keep orientation short; link detailed evidence rather than burying the cases under logs. This is a packet-authoring contract, not an implemented renderer or permission to generate, upload or retrofit unrelated packets.

## Entry point and case navigation

Write a local `README.md` with a suggested review order and a short reason for each priority (for example, an unresolved decision before a confirmed illustration). Use stable case IDs across filenames, diagrams, Fumen comments and evidence. For multiple cases, provide an index with a small PNG overview per case, a descriptive title, the focused question and links to the case section/import/Fumen. A single case needs no redundant navigation table.

Each case section supplies:

- A readable PNG starting-position overview linked to its editable SVG source; a plain-language description of why the case matters and one question to answer.
- Exact state labels: source revision, recorded lock/move number, before/after boundary, one-based Fumen page and whether that page is a recorded board or an operation to apply. Distinguish recorded/actual states from proposed alternatives, and verified replay from unverified sketches.
- Expected app revision and coach/rules/schema versions where relevant, separately from the source trace revision. State the build actually checked, or explicitly say it was not checked. Do not promise that a new coach repeats recorded advice.
- Actual clickable Markdown links to the import JSON and English-commented Fumen—not bare filenames or prose references—plus what to try, and concise import instructions: open ST lab in the expected app revision, paste the complete JSON into the existing textbox, then use **Import position or session**. Explain applicable warnings, finite supply and how to restart the exercise.
- A compact validation/provenance note with links to replay/accounting receipts and benchmark evidence, including failed or inconclusive results relevant to this case. State unknown/truncated history, synthetic inputs, stale advice, import limits and browser checks not performed. A passing parser is not a live-browser import pass.

A useful generated README shape is:

```text
# Review packet — question/topic
Expected app revision; source revision; what was actually verified
Suggested review order + case index (PNG / case / why review / links)
## Case ID — descriptive title
Starting-position PNG → SVG source
Exact move + before/after + Fumen page; actual/proposed; verification status
Question / what to try
Import and Fumen links / instructions / restart or supply caveat
Validation and limitations → detailed evidence
```

This is a template definition only: replace descriptive fields with verified values in generated packets, not invented values or empty promises.

## SVG sources and PNG previews

Generate each board SVG and its PNG preview from the **same validated public snapshot used by the import**, not a hand-redrawn approximation or a later trace state. Render the PNG from that SVG. Retain the source snapshot and record its relationship to the session and Fumen boundary in local evidence.

Show settled cells accurately on the ten-column grid, preserving coordinates, row orientation, colors/piece identity where recorded, and board dimensions. Distinguish the active piece from settled cells; label HOLD (including empty) and the six visible preview slots in draw order. If the source has fewer visible pieces, show the actual finite queue and label the missing slots rather than inventing pieces. Do not display or encode unrevealed tail pieces, seeds or evaluator-only metadata in SVG text/metadata, PNGs, alt text or captions. Read only the public snapshot when rendering.

Account for occupied cells or the active piece above the usual visible board: include an overflow inset/expanded view, or prominently label the cropped rows and their contents without implying the full board is shown. Do not silently clip relevant geometry. Keep labels legible at the README preview size. These are diagrams, not claims of captured live-app screenshots.

Compare occupied cells, active pose, HOLD and preview against the imported public snapshot and the matching decoded Fumen page (accounting for whether the page's operation is pre- or post-lock). Inspect the rendered PNG for clipping, incorrect orientation, obscured cells and unreadable labels. Record mismatches or renderer limitations; do not mark an unchecked preview verified.

Use side-by-side first-choice diagrams only when they materially clarify the question. Label proposed placements and their verification separately; do not present a ghost/target as a locked piece, imply unplayed alternatives occurred, or require a comparison panel for every orientation-only case.

## Public sessions versus private practice

Follow [ST-LAB.md's private practice contract](../../../../ST-LAB.md#private-practice-imports) rather than duplicating its schema here. Ordinary public sessions contain no hidden future tape. If the case needs finite continuation, put the complete public session inside the supported `zztetris-st-practice` wrapper; keep its tail private to the controller, never in advice requests, public history or diagram inputs.

Validate the wrapper through production import validation. Check tail alignment against actual draws **after the six visible preview pieces**, not lock count: a filled HOLD swap consumes no draw; empty HOLD does. Verify seven-bag/frontier consistency without inventing missing history. For a replayable practice claim, check that Restart/reset restores the imported state and tail, Undo restores the draw cursor with public history, and finite exhaustion does not synthesize new supply. Record which checks used production logic versus the real browser and any unavailable checks. Retain the original wrapper because ordinary exports intentionally omit the tail.

## Evidence and storage

Use the [shared research process](../../../../docs/st-research-workflow.md) for historical accounting, alternative replays, source identity and failed benchmark retention. Geometry is not proof of resource permission; a legal recorded replay is not proof of policy selection or strategy quality. Give the player the result and limitation, with detailed receipts one link away.

Use portable relative links within the delivered packet bundle for JSON imports, SVG/PNG files and other local artifacts; validate that every destination exists and resolves from the README after packaging. Keep any external Fumen links explicit and verified. Do not invent Space URLs, private download links or public-sharing destinations; a local file path is not evidence that the player can download it. State any delivery/access limitation rather than claiming an inaccessible link works.

Keep generated READMEs, SVGs, PNGs, snapshots, sessions, private tapes and receipts together in a fresh evidence directory **outside every Git worktree**. Only maintained skill/process/template definitions belong in Git. Verify relative links and image previews from that directory before delivery; report its actual path and any access limitation without assuming permanent retention or upload authority.

### Suggested continuation-export filenames

For every newly generated playable case, include a descriptive `suggestedFileName` such as `R433-frame21-coaching-export.json`. Use `STSession.create(state, {...options, suggestedFileName})` for public sessions or `STPractice.create(session, tail, {suggestedFileName})` for private practice. The practice-wrapper hint takes precedence over the nested session hint. This metadata is not gameplay evidence and must not be inserted into observations, source hashes, or Worker inputs. Do not regenerate historical packets just to add the hint. The lab downloads the current public coaching session using this browser filename hint; neither private tail nor stale import textarea content is exported.
