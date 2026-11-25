// Reading stored player reports back (server/src/reportsread.js): GET /api/reports and POST /api/reports/:id/done.
// No REPORTS_READ_KEY → 404; wrong key → 401 (rate limited); right key → the list; limit, since and open filters; mark done.
// node test_reportsread.js
"use strict";
const http = require("http"), path = require("path");
const S = path.join(__dirname, "../server/src/");
const { createApp } = require(S + "app");
const { memoryStore } = require(S + "store-memory");
const { sameKey } = require(S + "reportsread");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

const KEY = "test-read-key-0123456789abcdef";

async function serve(env, store, clock) {
  const logs = [];
  const srv = http.createServer(createApp({ store, now: () => clock.t, reportEnv: env, reportFetch: null, log: (m) => logs.push(m) }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, p, { key, ip = "10.1.0.1", body } = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", "X-Forwarded-For": ip, ...(key ? { Authorization: "Bearer " + key } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch { /* empty */ }
    return { status: r.status, ...j };
  };
  return { srv, call, logs, close: () => new Promise((r) => srv.close(r)) };
}

(async () => {
  ok(sameKey("abc", "abc") && !sameKey("abc", "abd") && !sameKey("abc", "abcd") && !sameKey("", "abc"), "constant-time compare: equal only when equal");

  // ---- no key set: the routes don't exist
  {
    const clock = { t: 1_700_000_000_000 }, store = memoryStore();
    const s = await serve({}, store, clock);
    ok((await s.call("GET", "/api/reports")).status === 404, "no REPORTS_READ_KEY → GET is 404");
    ok((await s.call("GET", "/api/reports", { key: "anything" })).status === 404, "…even with some key");
    ok((await s.call("POST", "/api/reports/rep_x/done", { key: "anything" })).status === 404, "…and done is 404 too");
    ok((await s.call("GET", "/api/reports", {}).then(() => s.call("GET", "/api/reports", { key: "" }))).status === 404, "empty key header → 404 too");
    await s.close();
  }

  // ---- key set
  const clock = { t: 1_700_000_000_000 }, store = memoryStore();
  const env = { REPORTS_READ_KEY: KEY };
  const s = await serve(env, store, clock);
  const times = [];
  for (let i = 0; i < 5; i++) {
    clock.t += 60e3; times.push(clock.t);
    const r = await s.call("POST", "/api/report", { ip: "10.9.0." + i, body: { title: "Bug number " + i, text: "Something broke " + i, category: i === 2 ? "balance" : "bug",
      info: { build: 220 + i, platform: "Android app", appBuild: 70 }, log: i === 0 ? ["line a", "line b"] : [], state: i === 0 ? { hp: 5 } : null } });
    ok(r.status === 200 && r.issue === null, "report " + i + " stored (no GitHub token)");
  }

  ok((await s.call("GET", "/api/reports")).status === 401, "no key → 401");
  ok((await s.call("GET", "/api/reports", { key: "wrong-key" })).status === 401, "wrong key → 401");
  ok((await s.call("GET", "/api/reports", { key: KEY + "x" })).status === 401, "longer key → 401");
  ok((await s.call("GET", "/api/reports?key=" + KEY)).status === 401, "the key in the URL doesn't count");

  let r = await s.call("GET", "/api/reports", { key: KEY });
  ok(r.status === 200 && r.reports.length === 5, "right key → all five reports");
  ok(r.reports[0].title === "Bug number 4" && r.reports[4].title === "Bug number 0", "newest first");
  const first = r.reports[4];
  ok(first.id && first.at === times[0] && first.category === "bug" && first.text === "Something broke 0" && first.version.build === 220 && first.platform === "Android app" && first.done === false, "id, at, title, category, text, version, platform");
  ok(Array.isArray(first.log) && first.log[1] === "line b" && first.snapshot && first.snapshot.hp === 5, "log and snapshot when present");
  ok(!("log" in r.reports[0]) && !("snapshot" in r.reports[0]), "no log or snapshot fields when empty");
  ok(r.reports[2].category === "balance", "category kept");

  r = await s.call("GET", "/api/reports?limit=2", { key: KEY });
  ok(r.status === 200 && r.reports.length === 2 && r.reports[0].title === "Bug number 4", "limit=2 → the newest two");
  r = await s.call("GET", "/api/reports?limit=9999", { key: KEY });
  ok(r.status === 200 && r.limit === 200 && r.reports.length === 5, "limit is capped at 200");
  ok((await s.call("GET", "/api/reports?limit=0", { key: KEY })).status === 400 && (await s.call("GET", "/api/reports?limit=abc", { key: KEY })).status === 400, "bad limit → 400");
  r = await s.call("GET", "/api/reports?since=" + times[2], { key: KEY });
  ok(r.status === 200 && r.reports.length === 2 && r.reports.every((x) => x.at > times[2]), "since → only newer reports");
  r = await s.call("GET", "/api/reports?since=" + encodeURIComponent(new Date(times[3]).toISOString()), { key: KEY });
  ok(r.status === 200 && r.reports.length === 1 && r.reports[0].title === "Bug number 4", "since also takes an ISO date");
  ok((await s.call("GET", "/api/reports?since=yesterday-ish", { key: KEY })).status === 400, "bad since → 400");
  r = await s.call("GET", "/api/reports?since=" + times[0] + "&limit=1", { key: KEY });
  ok(r.reports.length === 1 && r.reports[0].title === "Bug number 4", "since and limit together");

  // ---- mark done
  const id = first.id;
  ok((await s.call("POST", `/api/reports/${id}/done`)).status === 401, "done without a key → 401");
  ok((await s.call("POST", `/api/reports/${id}/done`, { key: "nope" })).status === 401, "done with a wrong key → 401");
  clock.t += 1000;
  r = await s.call("POST", `/api/reports/${id}/done`, { key: KEY });
  ok(r.status === 200 && r.ok && r.doneAt === clock.t, "done with the key → ok");
  ok((await s.call("POST", "/api/reports/rep_nothere/done", { key: KEY })).status === 404, "unknown id → 404");
  ok((await s.call("POST", "/api/reports/not-an-id/done", { key: KEY })).status === 400, "bad id → 400");
  r = await s.call("GET", "/api/reports", { key: KEY });
  ok(r.reports.find((x) => x.id === id).done === true && r.reports.length === 5, "the list shows it as done");
  r = await s.call("GET", "/api/reports?open=1", { key: KEY });
  ok(r.reports.length === 4 && !r.reports.some((x) => x.id === id), "open=1 hides done ones");

  // ---- failed tries are rate limited per IP; the right key still works from another IP
  const ip = "10.66.0.1";
  let last;
  for (let i = 0; i < 10; i++) last = await s.call("GET", "/api/reports", { key: "guess" + i, ip });
  ok(last.status === 401, "ten wrong tries are 401s");
  ok((await s.call("GET", "/api/reports", { key: "guess-again", ip })).status === 429, "the 11th try is slowed down (429)");
  ok((await s.call("GET", "/api/reports", { key: KEY, ip })).status === 429, "…even with the right key while blocked");
  ok((await s.call("GET", "/api/reports", { key: KEY, ip: "10.66.0.2" })).status === 200, "another IP is not blocked");
  clock.t += 16 * 60e3;
  ok((await s.call("GET", "/api/reports", { key: KEY, ip })).status === 200, "after the window it works again");

  ok(!s.logs.some((l) => l.includes(KEY)), "the key never shows up in the log");
  await s.close();

  // ---- the key is read live: removing it turns the route off
  {
    const st = memoryStore(), c = { t: 1 }, e = { REPORTS_READ_KEY: KEY };
    const s2 = await serve(e, st, c);
    ok((await s2.call("GET", "/api/reports", { key: KEY })).status === 200, "key set → 200");
    e.REPORTS_READ_KEY = "  ";
    ok((await s2.call("GET", "/api/reports", { key: KEY })).status === 404, "blank key → off (404)");
    await s2.close();
  }

  console.log(fails ? `failed: ${fails}` : `reportsread: all ok · ${n} checks`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
