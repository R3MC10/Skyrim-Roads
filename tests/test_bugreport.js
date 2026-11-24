// Report a problem (game/bugreport.js + server/src/reports.js):
//  client — the payload carries the right info and nothing personal, the error ring buffer keeps the last 40 lines,
//           offline reports are queued and sent later, F12 opens the window and Send posts it;
//  server — POST /api/report makes a GitHub issue with the env token and the right labels (GitHub mocked),
//           size limits, 5 an hour per IP, and without a token the report is kept in the store.
// W=/path/to/game/ node test_bugreport.js
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path"), http = require("http");
const W = process.env.W || path.join(__dirname, "../game/");
let n = 0, fails = 0;
const OK = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

// ------------------------------------------------------------------ a tiny page for the game file
function page() {
  const body = { children: [], appendChild(e) { this.children.push(e); e._parent = this; } };
  const handlers = {};
  const mkEl = () => {
    const parts = {};
    const el = {
      id: "", className: "", innerHTML: "", listeners: {},
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
      remove() { body.children = body.children.filter((c) => c !== this); },
      querySelector(sel) { return parts[sel] || (parts[sel] = { value: "", disabled: false, textContent: "", className: "", focus() {} }); },
      querySelectorAll() { return []; },
    };
    return el;
  };
  const document = {
    body, createElement: mkEl,
    getElementById: (id) => body.children.find((c) => c.id === id) || null,
    querySelector: () => null,
    addEventListener() {},
  };
  const store = new Map();
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const logged = [];
  const con = { error: (...a) => logged.push(a), log: (...a) => console.log(...a), warn() {} };
  const c = {
    document, localStorage, console: con, JSON, Math, Date, Object, Array, String, Number, Error, Promise, Map, Set,
    innerWidth: 412, innerHeight: 915, devicePixelRatio: 2.625, navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" },
    setTimeout: (f, ms) => { const t = setTimeout(f, ms); t.unref?.(); return t; }, clearTimeout,
    setInterval: (f, ms) => { const t = setInterval(f, ms); t.unref?.(); return t; }, clearInterval,
    addEventListener: (t, f, cap) => { (handlers[t] = handlers[t] || []).push(f); },
    ACCOUNT: { server: () => "https://srv.test" },
    ART: { style: () => "ink" },
  };
  c.window = c;
  vm.createContext(c);
  for (const f of ["patchnotes.js", "i18n_bugreport.js", "bugreport.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
  c.fire = (t, e) => (handlers[t] || []).forEach((f) => f(e));
  c.logged = logged;
  return c;
}

async function client() {
  const c = page(), B = c.BUGREPORT;
  const hero = { name: "Ysolda Tester", level: 17, location: "Whiterun", health: 80, gold: 512, inv: [{ item: "iron_sword", qty: 1 }, { item: "potion", qty: 3, type: "potion" }],
    quests: { bleakfalls: { stage: 2 }, gold_claw: { done: true } }, email: "secret@example.com", deviceToken: "tok-123" };
  c.__dbg = { save: () => hero };

  // ---- ring buffer: console.error, uncaught errors and failed promises, last 40 lines
  B._reset();
  c.console.error("boom", { a: 1 });
  OK(c.logged.length === 1, "console.error still reaches the real console");
  c.fire("error", { message: "x is not defined", filename: "https://game/ui.js", lineno: 12, colno: 5 });
  c.fire("unhandledrejection", { reason: new Error("lost connection") });
  const l = B.lines();
  OK(l.length === 3 && /error: boom \{"a":1\}/.test(l[0]) && /uncaught: x is not defined ui\.js:12:5/.test(l[1]) && /promise: .*lost connection/.test(l[2]), "the log catches all three kinds: " + JSON.stringify(l));
  for (let i = 0; i < 60; i++) B.log("error", "line " + i);
  OK(B.lines().length === 40 && /line 59$/.test(B.lines()[39]) && /line 20$/.test(B.lines()[0]), "only the last 40 lines are kept");
  B.log("error", "x".repeat(5000));
  OK(B.lines()[39].length <= 300, "long lines are cut");

  // ---- the payload
  B._reset(); B.log("error", "one");
  const p = B.payload({ title: "  Can't sell the sword ", text: "Sold it, gold stayed the same.", category: "balance" }, { appBuild: 143 });
  OK(p.title === "Can't sell the sword" && p.text === "Sold it, gold stayed the same." && p.category === "balance", "title, text and kind");
  OK(p.character === "Ysolda Tester", "the hero's name comes along");
  OK(p.info.build === c.PATCHNOTES.latest().build && p.info.notes === c.PATCHNOTES.latest().id && p.info.appBuild === 143, "game build and app build");
  OK(p.info.platform === "phone browser" && p.info.screen === "412x915@2.63" && p.info.artStyle === "ink", "platform, screen size, art style: " + JSON.stringify(p.info));
  OK(p.info.level === 17 && p.info.location === "Whiterun" && p.info.view === "map", "level, location and current screen");
  OK(p.log.length === 1 && /one$/.test(p.log[0]), "the log goes with it");
  OK(p.state.items === 2 && p.state.itemsByType.potion === 3 && p.state.quests.bleakfalls === 2 && p.state.quests.gold_claw === "done" && p.state.gold === 512, "state snapshot: items and quest stages " + JSON.stringify(p.state));
  const blob = JSON.stringify(p);
  OK(!/secret@example|tok-123/.test(blob), "nothing personal beyond the hero's name");
  OK(B.payload({ title: "t".repeat(500), text: "y".repeat(9000), category: "nonsense" }).title.length === 100 && B.payload({ title: "x", category: "nonsense" }).category === "bug", "client limits and unknown kinds → bug");
  OK(B.payload({ title: "abc" }, { S: null }).character === null && B.payload({ title: "abc" }, { S: null }).state.character === null, "works on the title screen too");

  // ---- sending, the offline queue and the retry
  const posts = [];
  let mode = "offline";
  c.fetch = async (url, o) => {
    posts.push({ url, body: JSON.parse(o.body), method: o.method });
    if (mode === "offline") throw new TypeError("Failed to fetch");
    if (mode === "busy") return { ok: false, status: 503, json: async () => ({}) };
    if (mode === "bad") return { ok: false, status: 400, json: async () => ({ error: "empty_report" }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, issue: 42 }) };
  };
  B._reset();
  let r = await B.send(B.payload({ title: "First", text: "a" }));
  OK(r.result === "queued" && B.queue().length === 1 && posts[0].url === "https://srv.test/api/report" && posts[0].method === "POST", "offline → kept on the device");
  mode = "busy";
  r = await B.send(B.payload({ title: "Second", text: "b" }));
  OK(r.result === "queued" && B.queue().length === 2, "server busy → kept too");
  OK(await B.flush() === 0 && B.queue().length === 2, "still busy: nothing lost");
  mode = "up";
  OK(await B.flush() === 2 && B.queue().length === 0, "back online: both sent, oldest first");
  OK(posts.slice(-2).map((x) => x.body.title).join() === "First,Second", "in order");
  r = await B.send(B.payload({ title: "Third", text: "c" }));
  OK(r.result === "sent" && r.issue === 42 && B.queue().length === 0, "online: sent straight away with the issue number");
  mode = "bad";
  r = await B.send(B.payload({ title: "Fourth", text: "d" }));
  OK(r.result === "dropped" && B.queue().length === 0, "a refused report isn't retried forever");
  mode = "offline"; for (let i = 0; i < 15; i++) await B.send(B.payload({ title: "Many " + i }));
  OK(B.queue().length === 10, "the queue holds at most 10");
  c.ACCOUNT = { server: () => "" }; B._reset();
  r = await B.send(B.payload({ title: "No server" }));
  OK(r.result === "queued", "no server address (tests, offline builds) → queued");
  c.ACCOUNT = { server: () => "https://srv.test" };
  mode = "up"; c.fire("online");
  await new Promise((res) => setTimeout(res, 20));
  OK(B.queue().length === 0, "the online event sends what's waiting");

  // ---- F12 opens the window, Send posts it
  B._reset();
  let prevented = false;
  c.fire("keydown", { key: "F12", preventDefault() { prevented = true; }, stopPropagation() {} });
  OK(B.isOpen() && prevented && c.document.getElementById("bugrep"), "F12 opens the report window (and keeps the browser's F12)");
  const box = c.document.getElementById("bugrep");
  OK(/Report a problem/.test(box.innerHTML) && /brtitle/.test(box.innerHTML) && /brtext/.test(box.innerHTML) && ["bug", "balance", "art", "text", "idea"].every((k) => box.innerHTML.includes(`data-brcat="${k}"`)), "title, description and the five kinds");
  OK((await B.submit()) === null && /short title/.test(box.querySelector("#brmsg").textContent), "an empty report asks for a few words");
  box.querySelector("#brtitle").value = "Stuck in Bleak Falls";
  box.querySelector("#brtext").value = "The door won't open.";
  const before = posts.length;
  r = await B.submit();
  OK(r.result === "sent" && posts.length === before + 1 && posts[before].body.title === "Stuck in Bleak Falls" && posts[before].body.text === "The door won't open.", "Send posts the report");
  OK(box.querySelector("#brmsg").textContent === "Report sent, thanks!", "says thanks");
  c.fire("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
  OK(!B.isOpen(), "Esc closes it");
  c.fire("keydown", { key: "F12", preventDefault() {}, stopPropagation() {} });
  mode = "offline";
  c.document.getElementById("bugrep").querySelector("#brtitle").value = "Offline one";
  r = await B.submit();
  OK(r.result === "queued" && c.document.getElementById("bugrep").querySelector("#brmsg").textContent === "Saved, will send when online", "offline: saved for later");
  B.close();
  OK(/data-brep="open"/.test(B.settingsHTML()) && /Report a problem/.test(B.settingsHTML()), "Settings has a Report a problem button (the phone's way in)");
  OK(c.I18N_EXTRA.words["Report sent, thanks!"] && c.I18N_EXTRA.words["Report a problem from inside the game"], "Polish lines for the window and the patch note");
  OK(c.PATCHNOTES.LIST.slice(0, 60).some((x) => x.id === "b144-bugreport" && x.build === 144), "patch note near the top");   // several features ship together; only one note can be first
}

// ------------------------------------------------------------------ the server route
async function server() {
  const S = path.join(__dirname, "../server/src/");
  const { createApp } = require(S + "app");
  const { memoryStore } = require(S + "store-memory");
  const { issueOf, REPORT_LIMITS } = require(S + "reports");
  const gh = [], logs = [];
  let ghMode = "ok";
  const env = { GITHUB_REPORT_TOKEN: "ghp_TESTTOKEN123" };
  const mockFetch = async (url, o) => {
    gh.push({ url, headers: o.headers, body: JSON.parse(o.body) });
    if (ghMode === "down") throw new Error("network");
    if (ghMode === "fail") return { ok: false, status: 401, json: async () => ({}) };
    return { ok: true, status: 201, json: async () => ({ number: 7 + gh.length }) };
  };
  const store = memoryStore(); await store.init();
  let clock = 1_700_000_000_000;
  const srv = http.createServer(createApp({ store, now: () => clock, trustProxy: true, reportEnv: env, reportFetch: mockFetch, log: (m) => logs.push(m) }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = async (body, ip = "10.1.0.1", raw) => {
    const r = await fetch(base + "/api/report", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: raw ?? JSON.stringify(body) });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  const rep = { title: "Can't sell the sword", text: "Sold it to Belethor, @someone gold stayed the same.", category: "balance", character: "Ysolda",
    info: { build: 144, platform: "Android app", screen: "412x915@2.6", artStyle: "pixel", level: 17, location: "Whiterun" }, log: ["12:00:01 error: boom ```rm```"], state: { gold: 5, quests: { a: 1 } } };

  let r = await post(rep);
  OK(r.status === 200 && r.ok === true && r.issue === 8, "a report becomes a GitHub issue: " + JSON.stringify(r));
  const call = gh[0];
  OK(call.url === "https://api.github.com/repos/R3MC10/Skyrim-Roads/issues", "the repo's issues URL");
  OK(call.headers.Authorization === "Bearer ghp_TESTTOKEN123" && call.headers.Accept === "application/vnd.github+json" && call.headers["User-Agent"], "headers carry the env token");
  OK(JSON.stringify(call.body.labels) === '["player-report","balance"]', "labels: player-report and the kind");
  OK(call.body.title === "[Report] Can't sell the sword", "title has [Report]");
  const body = call.body.body;
  OK(body.startsWith("Sold it to Belethor") && /<details><summary>/.test(body) && /\*\*platform\*\*: Android app/.test(body) && /\*\*character\*\*: Ysolda/.test(body), "description first, the rest folded in <details>");
  OK(!/@someone/.test(body) && /@​someone/.test(body), "player text never pings anyone");
  OK((body.match(/```/g) || []).length === 4, "the log can't break out of its code block");
  OK(!logs.join("\n").includes("ghp_TESTTOKEN123") && !JSON.stringify(r).includes("ghp_"), "the token is never logged or sent back");
  OK((await store.listReports()).length === 0, "nothing kept when GitHub took it");

  // unknown kind → bug
  await post({ ...rep, category: "hack" }, "10.1.0.2");
  OK(JSON.stringify(gh[1].body.labels) === '["player-report","bug"]', "unknown kind → bug");

  // limits
  OK((await post({ title: "", text: "" }, "10.1.0.3")).status === 400, "empty report refused");
  OK((await post({ ...rep, text: "x".repeat(REPORT_LIMITS.text + 10) }, "10.1.0.4")).status === 413, "description over 20 KB refused");
  OK((await post({ ...rep, state: { big: "y".repeat(310 * 1024) } }, "10.1.0.5")).status === 413, "whole report over 300 KB refused");
  OK((await post(null, "10.1.0.6", "{nope")).status === 400, "unreadable JSON refused");
  OK(issueOf({ title: "t", text: "z", category: "bug", info: {}, log: [], state: { s: "q".repeat(100000) } }).body.length <= REPORT_LIMITS.issueBody, "the issue body fits GitHub's limit");

  // rate limit: 5 an hour per IP
  const before = gh.length, codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post({ ...rep, title: "Spam " + i }, "10.9.9.9")).status);
  OK(codes.slice(0, 5).every((s) => s === 200) && codes[5] === 429 && codes[6] === 429 && gh.length === before + 5, "5 reports an hour per IP: " + codes);
  OK((await post(rep, "10.9.9.10")).status === 200, "another IP is fine");
  clock += 61 * 60e3;
  OK((await post(rep, "10.9.9.9")).status === 200, "an hour later the IP can report again");

  // GitHub refuses or is down → kept in the store, still ok
  ghMode = "fail";
  r = await post({ ...rep, title: "GitHub says no" }, "10.2.0.1");
  OK(r.status === 200 && r.ok && r.issue === null, "GitHub error → ok, no issue number");
  ghMode = "down";
  r = await post({ ...rep, title: "GitHub unreachable" }, "10.2.0.2");
  OK(r.status === 200 && r.issue === null, "GitHub unreachable → ok");
  OK((await store.listReports()).map((x) => x.report.title).join() === "GitHub unreachable,GitHub says no", "both kept in the store");

  // no token at all → stored, logged, never calls GitHub
  delete env.GITHUB_REPORT_TOKEN; ghMode = "ok";
  const ghBefore = gh.length;
  r = await post({ ...rep, title: "No token here" }, "10.3.0.1");
  OK(r.status === 200 && r.ok === true && r.issue === null && gh.length === ghBefore, "no token → no GitHub call, still ok");
  OK((await store.listReports())[0].report.title === "No token here" && logs.includes("report stored (no token)"), "stored and logged \"report stored (no token)\"");
  OK((await store.listReports())[0].report.character === "Ysolda" && (await store.listReports())[0].report.log.length === 1, "the stored report keeps its details");
  srv.close();
}

(async () => {
  await client();
  await server();
  console.log(fails ? `${fails} of ${n} checks FAILED` : `bugreport: all ${n} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
