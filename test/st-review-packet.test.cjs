"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const { JSDOM } = require("jsdom");
const Packet = require("../scripts/lib/st-review-packet.cjs"),
  S = require("../st-session"),
  R = require("../st-rules"),
  B = require("../st-bag"),
  Practice = require("../st-practice");
const { withPage } = require("./support/page.cjs");
function sample() {
  const s = R.createState({
    active: "I",
    queue: ["J", "L", "O", "S", "T", "Z"],
    streamCursor: 1,
  });
  s.bag = B.fromObserved({ observed: ["I", ...s.queue], startPhase: 0 });
  return S.create(s);
}
function setup(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "st-packet-"));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function inputs(root) {
  fs.writeFileSync(path.join(root, "session.json"), JSON.stringify(sample()));
  fs.writeFileSync(
    path.join(root, "tail.json"),
    JSON.stringify(["I", "J", "L", "O", "S", "T", "Z"]),
  );
  const m = {
    schemaVersion: 1,
    title: "Review <test>",
    expectedAppRevision: "test-revision",
    limitations: "Synthetic fixture; no strategy claim.",
    cases: [
      {
        id: "R1",
        title: "Empty board",
        why: "Testing import",
        question: "What next?",
        sourceRevision: "test-source",
        session: "session.json",
        privateTail: "tail.json",
        boundary: "Before fixture lock 1",
      },
    ],
  };
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(m));
  return m;
}
function unzip(buffer) {
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const n = buffer.readUInt16LE(offset + 26),
      extra = buffer.readUInt16LE(offset + 28),
      size = buffer.readUInt32LE(offset + 18),
      name = buffer.subarray(offset + 30, offset + 30 + n).toString(),
      start = offset + 30 + n + extra;
    const data = buffer.subarray(start, start + size);
    assert.equal(Packet.crc32(data), buffer.readUInt32LE(offset + 14));
    files[name] = data;
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
  return files;
}
test("packet/build produces portable HTML, English fragment Fumen, PNG from SVG, and byte-exact ZIP", () =>
  setup((root) => {
    inputs(root);
    const out = path.join(root, "output"),
      got = Packet.build(path.join(root, "manifest.json"), out);
    assert.equal(got.cases, 1);
    assert.equal(Object.hasOwn(got, "browserVerified"), false);
    const html = fs.readFileSync(path.join(out, "review.html"), "utf8"),
      dom = new JSDOM(html),
      d = dom.window.document;
    assert.equal(d.title, "Review <test>");
    assert.doesNotMatch(html, /browser checks|browserVerified|browser usability/i);
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(out, "validation.json"), "utf8")), "browserVerified"), false);
    assert.equal(d.querySelectorAll("button").length, 1);
    const url = new URL(
      [...d.querySelectorAll("a")].find(
        (a) => a.textContent === "Open English Fumen",
      ).href,
    );
    assert.equal(url.hostname, "fumen.sixwi.de");
    assert.equal(url.search, "");
    assert(url.hash.startsWith("#?v115@"));
    assert(!html.includes("fumen.zui.jp"));
    const p = Practice.prepare(
      JSON.parse(d.querySelector('[id="json-R1"]').value),
    );
    assert.deepEqual(p.session.state, S.prepare(sample()).state);
    assert.equal(p.tail.length, 7);
    const svg = fs.readFileSync(path.join(out, "R1/overview.svg"), "utf8");
    assert(svg.includes("HOLD: empty"));
    assert(svg.includes("6. Z"));
    assert(!svg.includes("privatePractice"));
    const png = fs.readFileSync(path.join(out, "R1/overview.png"));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert(png.readUInt32BE(16) > 0);
    const files = unzip(fs.readFileSync(path.join(out, "packet.zip")));
    for (const [name, b] of Object.entries(files))
      assert.deepEqual(b, fs.readFileSync(path.join(out, name)));
    const v = JSON.parse(files["R1/validation.json"]);
    assert.equal(v.replay.verified, false);
    assert.equal(v.planContinuityRoundTrip, true);
    dom.window.close();
  }));
test("packet/clipboard success, denial fallback and generated import work in actual Lab controller", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "st-packet-"));
  try {
    inputs(root);
    Packet.build(path.join(root, "manifest.json"), path.join(root, "out"));
    const html = fs.readFileSync(path.join(root, "out/review.html"), "utf8");
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    let copied;
    Object.defineProperty(dom.window.navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          copied = text;
        },
      },
      configurable: true,
    });
    const d = dom.window.document;
    d.querySelector("button").click();
    await new Promise((r) => setImmediate(r));
    assert.equal(
      d.getElementById("status-R1").textContent.startsWith("Copied."),
      true,
    );
    assert.equal(copied, d.getElementById("json-R1").value);
    Object.defineProperty(dom.window.navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    });
    d.querySelector("button").click();
    await new Promise((r) => setImmediate(r));
    assert(d.getElementById("json-R1").closest("details").open);
    assert.match(d.getElementById("status-R1").textContent, /unavailable/);
    await withPage("st-lab.html", {}, (g) => {
      const requests = [];
      g.window.Worker = class {
        postMessage(m) {
          requests.push(JSON.stringify(m));
        }
        terminate() {}
      };
      g.element("#st-snapshot").value = copied;
      g.click("#st-import");
      assert.doesNotMatch(
        g.element("#st-import-status").textContent,
        /rejected/i,
      );
      const before = g.snapshot();
      g.window.stLab.act("HD");
      g.window.stLab.act("UNDO");
      assert.deepEqual(
        { ...g.snapshot(), revision: 0 },
        { ...before, revision: 0 },
      );
      g.click("#st-reset");
      g.advance(40);
      assert.deepEqual(
        { ...g.snapshot(), revision: 0 },
        { ...before, revision: 0 },
      );
      g.click("#st-export-session");
      assert.equal(g.downloads.at(-1).filename, "R1-coaching-export.json");
      for (const text of [g.downloads.at(-1).text, ...requests])
        assert(!/privatePractice|"tail"/.test(text));
    });
    dom.window.close();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("packet/long links stay entirely in fragment and Fumen round trips all boards without silent crop", () => {
  const s = S.prepare(sample()).state,
    states = Array.from({ length: 200 }, () => s),
    code = Packet.fumen(states, "LongCase");
  const u = new URL(Packet.fumenUrl(code));
  assert.equal(u.search, "");
  assert.equal(u.pathname, "/");
  assert.equal(Packet.codec.decoder.decode(code).length, 200);
  assert.throws(() => Packet.fumenUrl("https://bad"), /Invalid/);
  const upper = JSON.parse(JSON.stringify(s));
  upper.board[0] = "X.........";
  assert.throws(() => Packet.fumen([upper], "upper"), /cannot represent/);
  const svg = Packet.svg(upper, "upper");
  assert(svg.includes("Rows 0–39"));
});
test("packet/rejects duplicate IDs, path traversal IDs, hidden preview, corrupt tail and existing/worktree output", () =>
  setup((root) => {
    const m = inputs(root);
    m.cases.push(m.cases[0]);
    assert.throws(() => Packet.validateManifest(m), /Duplicate/);
    assert.throws(
      () => Packet.prepareCase({ ...m.cases[0], id: "../bad" }, root),
      /id/,
    );
    const raw = sample();
    raw.position.queue.push("I");
    fs.writeFileSync(path.join(root, "session.json"), JSON.stringify(raw));
    assert.throws(() => Packet.prepareCase(m.cases[0], root), /six|preview/);
    inputs(root);
    fs.writeFileSync(path.join(root, "tail.json"), '["I","I"]');
    assert.throws(() => Packet.prepareCase(m.cases[0], root), /frontier/);
    assert.throws(() => Packet.safeOutput(root), /fresh/);
    const work = path.join(root, "work");
    fs.mkdirSync(work);
    execFileSync("git", ["init", work], { stdio: "pipe" });
    assert.throws(
      () => Packet.safeOutput(path.join(work, "new", "output")),
      /outside/,
    );
    fs.symlinkSync(work, path.join(root, "alias"));
    assert.throws(
      () => Packet.safeOutput(path.join(root, "alias", "output")),
      /outside/,
    );
  }));
test("packet/trace mode verifies all actions and selects precise before-lock state and tail", () =>
  setup((root) => {
    const E = require("../scripts/lib/st-simulation.cjs"),
      P = require("../st-planner"),
      input = E.makeInput("empty", 29, 1),
      records = [];
    E.runEpisode(input, {
      planner: (request) =>
        P.decide(request.observation, {
          ...request.options,
          deadline: Infinity,
        }),
      onRecord: (r) => records.push(r),
    });
    assert(records.some((r) => r.kind === "lock"));
    fs.writeFileSync(path.join(root, "input.json"), JSON.stringify(input));
    fs.writeFileSync(
      path.join(root, "trace.jsonl"),
      records.map((r) => JSON.stringify(r)).join("\n"),
    );
    const c = {
      id: "T1",
      title: "Trace",
      why: "Verify",
      question: "First move?",
      sourceRevision: "fixture",
      input: "input.json",
      trace: "trace.jsonl",
      beforeLock: 1,
    };
    const got = Packet.prepareCase(c, root);
    assert.equal(got.replay.verified, true);
    assert.equal(got.replay.locks, 1);
    assert.deepEqual(got.state, input.initial);
    assert.deepEqual(got.practice.privatePractice.tail, input.future);
    assert(got.boundary.includes("Before recorded lock 1"));
    const live = E.createSession(input),
      first = records.find((r) => r.kind === "lock");
    live.execute(first.advice, { commitmentReplay: first.commitmentCheck });
    records.push({ kind: "stop", lock: 1, request: live.request(2, E.CONFIG) });
    fs.writeFileSync(
      path.join(root, "trace.jsonl"),
      records.map((r) => JSON.stringify(r)).join("\n"),
    );
    const stop = Packet.prepareCase({ ...c, beforeLock: 2 }, root);
    assert.deepEqual(stop.state, E.publicObservation(live.state));
    assert.deepEqual(
      stop.practice.privatePractice.tail,
      input.future.slice(live.cursor),
    );
    assert(stop.boundary.includes("Fumen page 2"));
    const lock = records.find((r) => r.kind === "lock");
    lock.after.board[39] = "XXXXXXXXXX";
    fs.writeFileSync(
      path.join(root, "trace.jsonl"),
      records.map((r) => JSON.stringify(r)).join("\n"),
    );
    assert.throws(() => Packet.prepareCase(c, root));
  }));

test("packet/canonicalizes session transport and represents grey occupancy in Fumen", () =>
  setup((root) => {
    const m = inputs(root),
      raw = sample();
    raw.hiddenFuture = ["I", "Z"];
    raw.position.hiddenFuture = ["I"];
    raw.coaching.privateTape = ["Z"];
    fs.writeFileSync(path.join(root, "session.json"), JSON.stringify(raw));
    const c = Packet.prepareCase(m.cases[0], root);
    assert(!JSON.stringify(c.session).includes("hiddenFuture"));
    assert(!JSON.stringify(c.practice).includes("privateTape"));
    const state = S.prepare(sample()).state;
    state.board[39] = "#.........";
    const diagram = new JSDOM(Packet.svg(state, "grey"), {
      contentType: "image/svg+xml",
    });
    const cell = diagram.window.document.querySelector('rect[x="35"][y="549"]');
    assert.equal(cell.getAttribute("fill"), "#8893a5");
    diagram.window.close();
    const code = Packet.fumen([state], "grey");
    assert.equal(Packet.codec.decoder.decode(code)[0].field.at(0, 0), "X");
  }));

test("packet/rejects evaluator-only data nested in candidate evidence", () => {
  assert.throws(
    () =>
      Packet.assertPublic({
        coaching: { previous: { evidence: { future: ["I"] } } },
      }),
    /Evaluator-only/,
  );
});
