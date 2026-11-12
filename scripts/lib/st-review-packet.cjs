"use strict";
// Offline packet tooling. Never imported by the game or planner.
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const R = require("../../st-rules"),
  S = require("../../st-session"),
  Practice = require("../../st-practice");
const Import = require("./st-review-import.cjs");
const ROOT = path.resolve(__dirname, "../..");
const codec = vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, "tetris-fumen.js"), "utf8"),
  { window: {} },
)(2);
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clone = (x) => JSON.parse(JSON.stringify(x));
const hash = (x) => crypto.createHash("sha256").update(x).digest("hex");
function text(x, name) {
  if (typeof x !== "string" || !x.trim() || x.length > 2000)
    throw Error("Required short text: " + name);
  return x;
}
function read(file) {
  if (fs.statSync(file).size > 512 * 1024 * 1024)
    throw Error("Input exceeds 512 MiB");
  return fs.readFileSync(file, "utf8");
}
function file(base, name) {
  text(name, "input path");
  return path.resolve(base, name);
}
function json(base, name) {
  return JSON.parse(read(file(base, name)));
}
function fumenUrl(code) {
  if (typeof code !== "string" || !/^v115@[A-Za-z0-9+/?]+$/.test(code))
    throw Error("Invalid Fumen encoding");
  // The English viewer explicitly supports #?; no payload is sent to its server.
  return "https://fumen.sixwi.de/#?" + code;
}
function fumen(states, id) {
  const pages = states.map((state, i) => {
    if (state.board.slice(0, 17).some((r) => r !== ".........."))
      throw Error(
        "Fumen cannot represent occupied rows above row 17; use a smaller supported case, never silently crop.",
      );
    const field = codec.Field.create();
    for (let y = 17; y < 40; y++)
      for (let x = 0; x < 10; x++)
        if (state.board[y][x] !== ".")
          field.set(
            x,
            39 - y,
            state.board[y][x] === "#" ? "X" : state.board[y][x],
          );
    return {
      field,
      comment: `${id}, page ${i + 1}: recorded settled board, no operation to apply. Active ${state.active?.type || "none"}; HOLD ${state.hold || "empty"}; visible next ${state.queue.join(" ")}.`,
      flags: { lock: false },
    };
  });
  const code = codec.encoder.encode(pages),
    decoded = codec.decoder.decode(code);
  assert.equal(decoded.length, states.length);
  decoded.forEach((p, i) => {
    assert.equal(p.operation, undefined);
    assert.equal(p.comment, pages[i].comment);
    for (let y = 17; y < 40; y++)
      for (let x = 0; x < 10; x++)
        assert.equal(
          p.field.at(x, 39 - y).replace("_", "."),
          states[i].board[y][x] === "#" ? "X" : states[i].board[y][x],
        );
  });
  fumenUrl(code);
  return code;
}
const colors = {
  I: "#53cddd",
  J: "#647eef",
  L: "#efa352",
  O: "#f4dc68",
  S: "#68ce83",
  T: "#b985e5",
  Z: "#e97180",
  X: "#8893a5",
  "#": "#8893a5",
};
function svg(state, id) {
  const cells = state.active ? R.cells(state.active) : [],
    occupied = state.board.flatMap((r, y) => (r !== ".........." ? [y] : []));
  const min = Math.min(17, ...occupied, ...cells.map((c) => c[1])),
    unit = 22,
    top = 65,
    bottom = (40 - min) * unit + top;
  const height = Math.max(610, bottom + 40);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="${height}" viewBox="0 0 680 ${height}"><rect width="680" height="${height}" fill="#101827"/><g font-family="sans-serif" fill="#edf3fc"><text x="24" y="30" font-size="20">${esc(id)} — public position</text>`;
  for (let y = min; y < 40; y++)
    for (let x = 0; x < 10; x++)
      s += `<rect x="${35 + x * unit}" y="${top + (y - min) * unit}" width="21" height="21" fill="${colors[state.board[y][x]] || "#18263a"}" stroke="#35445c"/>`;
  for (const [x, y] of cells)
    s += `<rect x="${37 + x * unit}" y="${top + 2 + (y - min) * unit}" width="17" height="17" fill="none" stroke="${colors[state.active.type]}" stroke-width="3"/>`;
  const labels = [
    `Active (outline): ${state.active?.type || "none"}`,
    state.active
      ? `x ${state.active.x}, y ${state.active.y}, rotation ${state.active.rotation}`
      : "No active piece",
    `HOLD: ${state.hold || "empty"}`,
    `HOLD ${state.canHold ? "available" : "unavailable"}`,
    "NEXT: visible draw order",
    ...Array.from(
      { length: 6 },
      (_, i) => `${i + 1}. ${state.queue[i] || "not supplied"}`,
    ),
    `Rows ${min}–39; row 39 is floor.`,
    min === 17 ? "Rows 0–16 are empty." : "Expanded view includes upper rows.",
  ];
  labels.forEach(
    (t, i) =>
      (s += `<text x="285" y="${88 + i * 34}" font-size="16">${esc(t)}</text>`),
  );
  for (let x = 0; x < 10; x++)
    s += `<text x="${41 + x * unit}" y="${bottom + 24}" font-size="12">${x + 1}</text>`;
  return s + "</g></svg>";
}
function assertPublic(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      [
        "future",
        "hiddenFuture",
        "privatePractice",
        "privateTape",
        "tail",
        "pieceOrigins",
        "rng",
        "seed",
        "inputHash",
      ].includes(key)
    )
      throw Error("Evaluator-only data in public session: " + key);
    assertPublic(child);
  }
}
function requestSession(request, id) {
  return S.create(request.observation, {
    ...request.options,
    previous: request.previous,
    commitment: request.commitment,
    search: S.defaults(),
    suggestedFileName: id + "-coaching-export.json",
  });
}
function prepareCase(c, base) {
  if (!c || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(c.id))
    throw Error("Safe case id required");
  for (const key of ["title", "question", "why", "sourceRevision"])
    text(c[key], key);
  const inputs = {};
  function load(name, parse = true) {
    const value = read(file(base, name));
    inputs[name] = hash(value);
    return parse ? JSON.parse(value) : value;
  }
  let session,
    tail,
    states,
    boundary,
    replay,
    recordedSearch = null;
  if (c.trace) {
    if (
      c.session ||
      c.privateTail ||
      !Number.isSafeInteger(c.beforeLock) ||
      c.beforeLock < 1
    )
      throw Error("Trace case needs beforeLock, without session/privateTail");
    const E = require("./st-simulation.cjs"),
      input = load(c.input),
      records = load(c.trace, false)
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((x) => JSON.parse(x));
    const locks = records.filter((r) => r.kind === "lock");
    locks.forEach((r, i) =>
      assert.equal(r.lock, i + 1, "Trace lock numbers must be contiguous"),
    );
    const decision =
      records.find((r) => r.kind === "lock" && r.lock === c.beforeLock) ||
      records.find((r) => r.kind === "stop" && r.lock === c.beforeLock - 1);
    if (!decision?.request)
      throw Error("No recorded decision request at selected boundary");
    // Verify the whole supplied trace, not only the chosen endpoint.
    replay = E.replayRecords(input, records);
    const live = E.createSession(input),
      prefix = locks.filter((r) => r.lock < c.beforeLock);
    for (const r of prefix)
      live.execute(
        r.advice,
        records[0]?.commitmentReplay === "clock-tape-v1"
          ? { commitmentReplay: r.commitmentCheck }
          : {},
      );
    const canonical = (q) => {
      const r = clone(q);
      if (r.commitment?.advice?.metrics)
        delete r.commitment.advice.metrics.elapsedMs;
      return r;
    };
    assert.deepEqual(
      canonical(live.request(decision.request.id, decision.request.options)),
      canonical(decision.request),
      "Boundary request must match replayed accounting and public state",
    );
    session = requestSession(decision.request, c.id);
    tail = input.future.slice(live.cursor);
    states = [input.initial, ...prefix.map((r) => r.after)];
    boundary = `Before recorded lock ${c.beforeLock}; after ${c.beforeLock - 1} locks; Fumen page ${states.length} (settled board, no operation).`;
    recordedSearch = decision.request.options;
    // Only search limits, never request internals or hidden input, go in overview.
    recordedSearch = Object.fromEntries(
      ["timeMs", "depth", "width", "maxNodes"]
        .filter((k) => Object.hasOwn(recordedSearch, k))
        .map((k) => [k, recordedSearch[k]]),
    );
  } else {
    if (c.input || c.beforeLock !== undefined)
      throw Error("Session cases cannot claim a trace boundary");
    session = load(c.session);
    tail = c.privateTail ? load(c.privateTail) : [];
    boundary =
      text(c.boundary, "boundary") +
      "; Fumen page 1 (settled board, no operation).";
    replay = {
      verified: false,
      note: "Imported current checkpoint only. No historical action replay was supplied or verified.",
    };
    states = [S.prepare(session).state];
  }
  const prepared = S.prepare(session);
  // Never embed the caller's raw object: production parsing ignores unknown transport fields.
  session = S.create(prepared.state, prepared);
  assertPublic(session);
  const practice = Import.create(session, tail, c.id),
    got = Practice.prepare(practice);
  assert.deepEqual(got.session.state, prepared.state);
  assert.deepEqual(got.session.obligationContext, prepared.obligationContext);
  assert.deepEqual(got.session.planContinuity, prepared.planContinuity);
  assert.deepEqual(
    states.at(-1),
    prepared.state,
    "Fumen boundary differs from imported public snapshot",
  );
  const code = fumen(states, c.id),
    diagram = svg(prepared.state, c.id);
  return {
    ...c,
    session,
    practice,
    state: prepared.state,
    code,
    diagram,
    boundary,
    replay,
    inputs,
    recordedSearch,
    warnings: [...new Set([...prepared.warnings, ...got.session.warnings])],
  };
}
// Deterministic ZIP store entries, no shell, absolute paths, symlinks or ZIP64.
function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  let offset = 0;
  const entries = [],
    central = [];
  for (const [name, raw] of Object.entries(files)) {
    const n = Buffer.from(name),
      b = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (b.length > 0xffffffff || n.length > 65535 || offset > 0xffffffff)
      throw Error("ZIP32 size limit");
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x800, 6);
    h.writeUInt16LE(33, 12);
    h.writeUInt32LE(crc32(b), 14);
    h.writeUInt32LE(b.length, 18);
    h.writeUInt32LE(b.length, 22);
    h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    h.copy(c, 8, 6, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    entries.push(h, n, b);
    offset += h.length + n.length + b.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, directory, end]);
}
const clipboard = `document.addEventListener('click',async e=>{const b=e.target.closest('button[data-copy]');if(!b)return;const id=b.dataset.copy,t=document.getElementById('json-'+id),s=document.getElementById('status-'+id);try{await navigator.clipboard.writeText(t.value);s.textContent='Copied. Paste into ST Lab, then Import position or session.';}catch{t.closest('details').open=true;t.focus();t.select();s.textContent='Clipboard unavailable. Copy the selected JSON manually.';}});`;
const css = `:root{color-scheme:dark}body{max-width:1050px;margin:auto;padding:24px;background:#0b1220;color:#eef3fc;font:16px/1.6 system-ui}a{color:#9cceff}article{padding:24px;margin:28px 0;background:#142136;border-radius:12px}img{max-width:100%;height:auto}textarea{width:100%;height:160px}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{padding:12px;font:inherit;cursor:pointer}code{overflow-wrap:anywhere}.notice{border-left:4px solid #edbd68;padding-left:16px}`;
function render(manifest, cases, revision) {
  const files = {};
  const put = (p, value) =>
    (files[p] =
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value, null, 2) + "\n");
  const { Resvg } = require("@resvg/resvg-js");
  let cards = "",
    md = `# ${manifest.title}\n\nOpen [interactive review](review.html).\n\n${manifest.limitations}\n\nExpected app: ${manifest.expectedAppRevision}. Generator: ${revision}.\n\n`;
  for (const c of cases) {
    const prefix = c.id + "/",
      png = new Resvg(c.diagram).render().asPng();
    put(prefix + "overview.svg", c.diagram);
    put(prefix + "overview.png", png);
    put(prefix + "public-session.json", c.session);
    put(prefix + "long-practice.json", c.practice);
    put(prefix + "position.fumen", c.code + "\n");
    const verification = {
      replay: c.replay,
      sessionWarnings: c.warnings,
      publicStateRoundTrip: true,
      obligationContextRoundTrip: true,
      planContinuityRoundTrip: true,
      fumenFieldsAndCommentsRoundTrip: true,
      fumenGreyCells: "Both # and X occupied cells render as Fumen X (grey).",
      diagramSource: "public-session.json",
      privateTailPieces: c.practice.privatePractice.tail.length,
      sourceHashes: c.inputs,
      sourceRevision: c.sourceRevision,
      boundary: c.boundary,
      recordedSearch: c.recordedSearch,
      importSearch: c.session.search,
      strategy:
        "Recorded bounded outcomes, not proof of optimality or impossibility.",
    };
    put(prefix + "validation.json", verification);
    const link = fumenUrl(c.code),
      summary = c.replay.verified
        ? `All ${c.replay.locks} recorded locks in the supplied trace replayed. No search rerun.`
        : c.replay.note;
    cards += `<article id="${c.id}"><h2>${esc(c.id)} — ${esc(c.title)}</h2><p>${esc(c.why)}</p><p><strong>Question:</strong> ${esc(c.question)}</p><p>${esc(c.boundary)}</p><p>Source: ${esc(c.sourceRevision)}. ${esc(summary)}</p><p>${esc(c.warnings.join(" "))}</p><img src="data:image/png;base64,${png.toString("base64")}" alt="${esc(c.id)} public board, active outline, HOLD and visible preview"/><p><a href="${prefix}overview.svg">SVG source</a> · <a href="${link}">Open English Fumen</a> · <a href="${prefix}validation.json">Validation details</a></p><details><summary>Selectable Fumen text</summary><textarea readonly>${esc(c.code)}</textarea></details>${Import.controls(c.practice, c.id)}<p>Finite private supply: ${c.practice.privatePractice.tail.length} draws after the visible preview. Restart restores this exercise. Ordinary exports exclude the private tail.</p><details><summary>Verification and limitations</summary><pre>${esc(JSON.stringify(verification, null, 2))}</pre></details></article>`;
    md += `## ${c.id} — ${c.title}\n\n${c.why}\n\nQuestion: ${c.question}\n\n${c.boundary}\n\n[![${c.id} overview](${prefix}overview.png)](${prefix}overview.svg)\n\n[Play/copy import](review.html#${c.id}) · [English Fumen](${link}) · [Validation](${prefix}validation.json)\n\n${summary}\n\n`;
  }
  put("README.md", md);
  put(
    "review.html",
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(manifest.title)}</title><style>${css}</style></head><body><h1>${esc(manifest.title)}</h1><p class="notice">${esc(manifest.limitations)}</p><p>Expected app: ${esc(manifest.expectedAppRevision)}. Generator revision: ${esc(revision)}.</p><p>Open ST Lab at the expected revision. Copy the long-practice JSON, paste it into the existing textbox, then choose <strong>Import position or session</strong>. If clipboard access fails, copy the selected fallback text. These are diagrams, not screenshots.</p><nav>${cases.map((c) => `<a href="#${c.id}">${esc(c.id)}: ${esc(c.title)}</a>`).join(" · ")}</nav>${cards}<script>${clipboard}</script></body></html>`,
  );
  put("validation.json", {
    schemaVersion: 1,
    generatorRevision: revision,
    caseIds: cases.map((c) => c.id),
    englishFragmentLinks: true,
    portableLinks: true,
  });
  // Validate every generated local href/src (including fragments) before ZIP.
  for (const html of [files["review.html"]])
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      if (url.startsWith("#")) {
        assert(cases.some((c) => url === "#" + c.id));
        continue;
      }
      if (url.startsWith("data:")) continue;
      if (url.startsWith("https:")) {
        assert(url.startsWith("https://fumen.sixwi.de/#?"));
        assert.equal(new URL(url).search, "");
        continue;
      }
      assert(Object.hasOwn(files, url), "Broken local link " + url);
    }
  put(
    "SHA256SUMS",
    Object.entries(files)
      .map(([name, bytes]) => hash(bytes) + "  " + name)
      .join("\n") + "\n",
  );
  return files;
}
function validateManifest(m) {
  if (
    m?.schemaVersion !== 1 ||
    !Array.isArray(m.cases) ||
    !m.cases.length ||
    m.cases.length > 100
  )
    throw Error("Manifest v1 needs 1..100 cases");
  for (const key of ["title", "expectedAppRevision", "limitations"])
    text(m[key], key);
  if (new Set(m.cases.map((c) => c.id)).size !== m.cases.length)
    throw Error("Duplicate case IDs");
}
function safeOutput(out) {
  const resolved = path.resolve(out);
  if (fs.existsSync(resolved)) throw Error("Output must be a fresh directory");
  let ancestor = path.dirname(resolved);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  // Real path prevents a symlink from concealing a worktree destination.
  const actual = path.resolve(
    fs.realpathSync(ancestor),
    path.relative(ancestor, resolved),
  );
  try {
    execFileSync(
      "git",
      ["-C", path.dirname(actual), "rev-parse", "--show-toplevel"],
      { stdio: "pipe" },
    );
    throw Error("Output must be outside every Git worktree");
  } catch (e) {
    if (e.message === "Output must be outside every Git worktree") throw e;
  }
  // Check nearest existing ancestor too when nested output parents do not yet exist.
  try {
    execFileSync(
      "git",
      ["-C", fs.realpathSync(ancestor), "rev-parse", "--show-toplevel"],
      { stdio: "pipe" },
    );
    throw Error("Output must be outside every Git worktree");
  } catch (e) {
    if (e.message === "Output must be outside every Git worktree") throw e;
  }
  return actual;
}
function build(manifestPath, out) {
  const absolute = path.resolve(manifestPath),
    m = JSON.parse(read(absolute));
  validateManifest(m);
  const destination = safeOutput(out),
    cases = m.cases.map((c) => prepareCase(c, path.dirname(absolute)));
  let revision = "unversioned";
  try {
    revision = execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    if (
      execFileSync("git", ["-C", ROOT, "status", "--porcelain"], {
        encoding: "utf8",
      }).trim()
    )
      revision += " (dirty)";
  } catch {}
  const files = render(m, cases, revision),
    archive = zip(files);
  // Everything validates in memory before creating any output.
  fs.mkdirSync(destination, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(destination, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  fs.writeFileSync(path.join(destination, "packet.zip"), archive);
  return {
    directory: destination,
    cases: cases.length,
    files: Object.keys(files).length,
    zipBytes: archive.length,
    generatorRevision: revision,
  };
}
module.exports = {
  assertPublic,
  build,
  prepareCase,
  validateManifest,
  safeOutput,
  render,
  fumen,
  fumenUrl,
  svg,
  zip,
  crc32,
  clipboard,
  codec,
};
