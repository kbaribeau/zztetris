# Continuation-engine playtest

**Branch:** `fm/zztetris-continuation-engine`. This is an experimental replacement
of the matcher in this branch only. The captain decides whether it is better;
no merge or production deployment is authorized. The implementation is useful
for testing finite construction/repair explanations, **not yet a dependable
move-by-move coach**. Read [the endpoint contract](../ST-LAB.md).

## Isolated launch

From an isolated checkout of this branch (not the primary checkout):

```sh
python3 -m http.server 8877 --bind 127.0.0.1
```

In another terminal on macOS:

```sh
open http://127.0.0.1:8877/st-lab.html
```

After the branch is published, an independent copy can be obtained with:

```sh
git clone --single-branch --branch fm/zztetris-continuation-engine \
  https://github.com/kbaribeau/zztetris.git /tmp/zztetris-continuation-playtest
cd /tmp/zztetris-continuation-playtest
python3 -m http.server 8877 --bind 127.0.0.1
```

No build/install is needed to play. Stop **your own** foreground server with
Ctrl-C. Do not publish this preview or use/stop a shared server or browser profile.
The delivery handoff gives the local isolated worktree path before publication.

## Four reproducible established-stack examples

Open **Normal editing / practice controls**. Copy a raw Fumen below to the
clipboard and click **Import: Fumen** (not Full Fumen). Click **HOLD** to edit its
letter (submit an empty value where specified), then click **NEXT** and paste the
queue string. The first letter becomes active; the next six are visible.
Trailing letters are reproduction data, **never visible to the advisor**.
These queues are authored examples, not recovered video queues or random bags.

### 1. Scoring cycle

- HOLD: `Z`
- NEXT: `TOIJLSTIOTJLSZIOTJLSZ`
- Fumen:

```text
v115@LgF8DeG8CeG8CeF8DeG8CeG8CeF8DeG8CeG8MeAgH
```

Expected first target: hold for the Z cap. The checked three-lock route includes
an actual non-mini TSD. Follow the target manually; a TSD needs the final
rotation while grounded, then zero-distance hard drop. The gray ghost is not
the amber destination. A next target may change as the horizon moves forward.

### 2. Center construction

- HOLD: empty
- NEXT: `LOTIJLSIOTJLSZIOTJLSZ`
- Fumen:

```text
v115@GgB8GeB8DeG8CeG8CeF8DeG8CeG8CeF8CeH8AeI8AeA8KeAgH
```

Expected first target: L finishes the existing SL overhang. Its three-lock route
also accommodates O and scores T. S in the later preview does not blanket-veto
construction; the claim is about the verified route, not every later piece.

### 3. Cross-region resource allocation / non-scoring filler

- HOLD: empty
- NEXT: `SIIOOJLIOTJLSZIOTJLSZ`
- Fumen:

```text
v115@DgB8FeF8DeG8CeG8CeF8DeG8CeG8CeF8DeG8CeG8MeAgH
```

The default chooses an I through hold, with a non-scoring Left route; it does
not invent an immediate double. The same starting board also has an independent
S→I→I witness in tests: both newly created shallow channels need **different**
I instances. That witness is not guaranteed to be the default recommendation.

### 4. Repair an existing freestyle vacancy

- HOLD: empty
- NEXT: `STOIJLZIOTJLSZIOTJLSZ`
- Fumen:

```text
v115@3fB8BeC8CeA8BeD8CeF8DeG8CeG8CeF8DeG8CeG8CeF8CeH8AeI8AeA8KeAgH
```

Expected first target: S tucks into the Left vacancy under J's roof. The checked
route pays that vacancy and includes a double. Tests independently check the
preceding J→S construction too, but searching **before** J can exhaust the UI
budget instead of finding that route. This is a real coverage limitation.

## What to try

- Move/rotate or hold before following a target. The old target hides while a
  fresh continuation is checked; the same sound destination is preferred.
- Press **A**: both target and explanation disappear. Press it again to compute
  afresh. Undo/redo, draw a cell, edit HOLD/NEXT, import and restart.
- Try your own filler or save a failed board/Fumen and queue. A missing target
  means **not verified within this search**, not impossible or necessarily bad.
- Enable gravity or another kickset: advice must stop. No left-scoring or
  triple guidance is implemented. Restart returns to normal empty-board play,
  which currently receives no opening advice.

For a detailed witness, run `stLab.diagnostics()` in the browser console. It
includes actual paths (`prelude`, then `path`), all three resulting heaps,
resource identities, paid/payable obligations, terminal hypothetical-access
status, work/stop counters and timing. The visible UI intentionally omits most
of that detail. Hypothetical Z/T/I terminal probes are **not promised future
pieces** or additional actual locks.

## Evidence and limits at implementation handoff

- **48 prior right-oriented snapshots:** 45 issued three-lock witnesses and
  three abstentions; all 135 actual locks and the separate terminal-access
  probes replayed in the real engine without an observed invalid path, spawn,
  heap or scoring claim. Only 25 first moves matched a previously authored
  acceptable first move; the other 20 lack that independent strategic annotation.
  Legality plus this branch's endpoint predicate is not universal strategy proof.
- **Closed loop, twelve fixed seeds, 56-lock caps, stop at first abstention:**
  seeds `1,2,3,4` reached `4,5,5,1` locks. Held-out seeds `2000..2007` reached
  `5,6,6,3,6,10,3,1`. Total **55 locks, eight doubles, zero quads**. Every trial
  eventually hit the pose budget. These attempted multi-bag runs do **not**
  demonstrate sustained multi-bag coaching; even the longest stopped at ten.
  No fallback, rejected seed or hidden suffix was used to inflate the result.
- Initial synchronous browser stress decisions reached about **44 ms**; slicing
  was added. In the isolated desktop browser sample, the cycle/Center/allocation
  decisions took about **103–174 ms elapsed**, **11–32 ms work**; a difficult
  repair search timed out. The maximum observed slice was **14.3 ms**, despite
  the 4-ms scheduling target. One movement-to-next-frame observation was 31 ms.
- At emulated **390×844**, warm examples displayed correctly, but cold cycle
  and difficult repair decisions could hit the 750-ms deadline (observed returns
  around 793–800 ms at the next scheduled frame). Some frame intervals were
  50–67 ms. These measurements do **not** establish smooth 60-fps performance,
  a strict 4-ms bound or physical mobile-device certification. Toggle/retry
  recomputes; it does not reuse a partially verified timeout result.
- The old seed-29 natural quad is now an intentional abstention: that irregular
  stack lacks the new endpoint ladder. Scoring alone is no longer sufficient.
- Strict one-column-channel and Center-ladder criteria, width pruning, a
  three-lock horizon and no opening coverage all cause useful missed advice.
  More issued recommendations are not evidence of better player learning or
  universal superiority. The captain's playtest decides replacement.

Reproduce local validation with Node from `.nvmrc`:

```sh
npm ci
npm test
node scripts/st-trial.cjs test-results/st-trial.json
```

Full revision-bound results, corpus outputs, intermediate experimental results,
browser measurements and inspected screenshots are retained in the task's
private delivery evidence. No GitHub CI exists for this static project; local
validation is the accepted evidence, not an empty forge check list labelled green.
