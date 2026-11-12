# State-branch review packet generator

Use the maintained generator rather than hand-building a packet or Fumen URL:

```sh
npm ci
npm run review:st -- --manifest /evidence/manifest.json --out /evidence/new-packet
```

Use the Node/npm versions in TESTING.md. The output must be a fresh directory
outside **every Git worktree**, including symlinked worktrees. Inputs resolve
relative to the manifest. The command validates all cases before writing any
outputs. It makes no network requests and runs no new planner searches. Run
`node --test test/st-review-packet.test.cjs test/st-review-import.test.cjs` while
editing; the normal clean `npm test` remains the delivery check.

## Manifest v1

```json
{
  "schemaVersion": 1,
  "title": "Midgame stopping positions",
  "expectedAppRevision": "full SHA of the app the player should use",
  "limitations": "Development examples, not a holdout or proof of impossibility. Browser opening still needs checking.",
  "cases": [
    {
      "id": "MG01",
      "title": "First abstention",
      "why": "A recorded Left resolution exists at this boundary.",
      "question": "Which continuation would you try?",
      "sourceRevision": "full SHA that produced this trace",
      "input": "episode/input.json",
      "trace": "episode/trace.jsonl",
      "beforeLock": 27
    }
  ]
}
```

Cases are ordered in review priority. IDs must be unique, 1–64 letters, digits,
underscores or hyphens, starting with a letter or digit. Labels and source
revisions are author-supplied provenance, **not automatically authenticated**.
Do not fill them with guessed values. Describe cohort, search limits, lock/line
caps, inherited history and missing checks in `limitations`. Selected request
search limits are retained separately from the supported current import limits.

### Recorded simulation cases

`input` and JSONL `trace` use the current state-branch simulator contract.
`beforeLock` selects the request before that one-based recorded lock, including
an abstention request after the preceding completed lock. A cap-only stop has
no request and cannot be presented as a decision. The generator replays **all
recorded locks** with production rules and compares the selected boundary's
public state and coaching context with replay. It emits the recorded board
prefix through that boundary. No new recommendation is generated.

Replay is strict. A trace from a different engine revision may fail; use its
matching checkout with this tooling or explicitly describe a checkpoint-only
case instead. Do not relax replay assertions or manufacture historical context.
Replay receipts retain timing diagnostics: recorded action replay does not prove
that interactive delayed replanning will reproduce the same recommendation.

### Checkpoint-only cases

For an existing session v2 checkpoint, replace `input`, `trace` and `beforeLock`
with:

```json
{
  "session": "stop/public-session.json",
  "privateTail": "tail.json",
  "boundary": "Before continuation lock 27; recorded checkpoint only"
}
```

Keep the other case fields. `privateTail` is an optional JSON array of piece
letters **after the six visible previews**, not after a lock count. Empty/absent
tail means finite visible-only practice. Production practice validation checks
bag consistency. The generator clearly labels historical replay **not verified**
for this mode. Parsing a checkpoint does not establish its history or strategic
validity. Only current session v2 is supported: no legacy ledger import or
translation is added. Canonical public export strips unknown transport fields;
known evaluator-only fields nested in candidate data are rejected.

## Output and viewer behavior

- `review.html`: interactive priority index, embedded PNG boards, one copy-import
  control and selectable long-practice JSON per case. On clipboard failure,
  text is selected for manual copy; success is never claimed after a denial.
- `README.md`: portable links to the HTML, diagrams, Fumen and receipts.
- Per case: SVG, PNG rasterized from that SVG with pinned `@resvg/resvg-js`,
  canonical public session, private practice, Fumen text and validation receipt.
- `packet.zip`: portable copy of all files, and `SHA256SUMS` for integrity.

All Fumen links use **`https://fumen.sixwi.de/#?v115@…`**, the English viewer's
supported fragment syntax. The payload is not sent in the HTTP request, avoiding
server query-length limits. The full selectable Fumen text is a fallback. Long
fragments may still meet client/app limits; test the actual links in a real
browser, not just codec decoding. Do not switch back to `fumen.zui.jp/?`.

Fumen pages are settled boards, with **no operation to apply**. Comments show
active piece, HOLD and visible preview. Active pose is drawn as an outline in
the diagram and remains exact in the practice import. `#` and `X` occupied cells
are both shown as Fumen grey `X`. Fumen cannot represent occupied rows above
row 17; those cases fail explicitly rather than silently cropping. SVG expands
to include high occupied cells. The public snapshot alone drives all diagrams;
the private tail belongs only to the practice envelope, not diagram inputs or
public sessions. Never add seed, hidden tape or evaluator provenance to advice.

## Required review before delivery

Automated checks cover production session/practice parsing, current obligations
and plan continuity, replay when supplied, Fumen round-trip, English fragment
URLs, local links, PNG encoding, ZIP checksums, clipboard fallback and real Lab
controller import/restart/undo/export through the offline DOM harness.

Inspect generated PNGs for orientation, upper rows and label readability. Open
representative short and long Fumen links in a real browser and verify the
intended page, board and language. Import a case into the intended app revision
when browser access permits. These are separate checks: parser/DOM/raster tests
are not browser rendering or delivery proof. The generated receipts conservatively
say browser checks have not been run; retain a separate receipt for manual
checks, with exact packet hashes and app revision. Report blocked checks honestly.

Generated packets, snapshots, tails and raw traces stay outside Git. Commit only
the generator, maintained contract, tests and deliberately minimized fixtures.
This tool does not change gameplay, planner budgets or branch contents and does
not authorize a push. Publish only under the user's current authorization.
