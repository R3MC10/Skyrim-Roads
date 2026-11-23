// The accounts server (server/): sign-up and sign-in with hashed passwords, one device at a time with a takeover
// prompt, cloud characters with version checks, ownership, limits and rate limiting.
// node test_server.js                      (memory store, what CI runs)
// PG_TEST_URL=postgres://… node test_server.js   (the same checks against a real Postgres; needs `npm i` in server/)
"use strict";
const http = require("http"), path = require("path");
const S = path.join(__dirname, "../server/src/");
const { createApp, LIMITS } = require(S + "app");
const A = require(S + "auth");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

async function run(store, label) {
  let clock = 1_700_000_000_000;
  const now = () => clock;
  await store.init();
  const srv = http.createServer(createApp({ store, now, trustProxy: true }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  let ip = 1;
  const call = async (method, p, body, token, extra = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", "X-Forwarded-For": extra.ip || "10.0.0." + ip, ...(token ? { Authorization: "Bearer " + token } : {}), ...(extra.headers || {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch { /* empty */ }
    return { status: r.status, ...j, _h: r.headers };
  };
  const L = (m) => `[${label}] ${m}`;

  // ---- health
  const h = await call("GET", "/api/health");
  ok(h.status === 200 && h.ok && h.store === store.kind, L("health answers with the store kind"));

  // ---- register
  let r = await call("POST", "/api/register", { username: "Remi", password: "dragonborn1", deviceId: "phone-1", deviceName: "Remi's phone" });
  ok(r.status === 200 && r.token && r.account.username === "Remi" && !("passHash" in r.account), L("register gives a token and the account, never the hash"));
  const phone = r.token;
  ok((await call("POST", "/api/register", { username: "remi", password: "something9", deviceId: "x" })).error === "username_taken", L("usernames are unique, ignoring case"));
  ok((await call("POST", "/api/register", { username: "ab", password: "something9" })).error === "bad_username", L("too short a username"));
  ok((await call("POST", "/api/register", { username: "has space", password: "something9" })).error === "bad_username", L("no spaces in usernames"));
  ok((await call("POST", "/api/register", { username: "Kacper", password: "short" })).error === "weak_password", L("passwords need 8 characters"));
  ok((await call("POST", "/api/register", { username: "Samename", password: "samename" })).error === "weak_password", L("password can't be the username"));
  const acct = await store.accountByName("remi");
  ok(acct && /^scrypt\$/.test(acct.passHash) && !acct.passHash.includes("dragonborn1"), L("the password is stored only as an scrypt hash"));
  ok(await A.checkPassword("dragonborn1", acct.passHash) && !(await A.checkPassword("dragonborn2", acct.passHash)), L("the hash checks the right password only"));
  const s1 = await store.sessionByToken(A.tokenHash(phone));
  ok(s1 && s1.tokenHash !== phone && s1.deviceName === "Remi's phone", L("only the token's hash is stored"));

  // ---- session heartbeat
  r = await call("GET", "/api/session", null, phone);
  ok(r.status === 200 && r.account.username === "Remi" && r.device === "Remi's phone", L("the session answers"));
  ok((await call("GET", "/api/session")).error === "signed_out" && (await call("GET", "/api/session", null, "nonsense")).error === "signed_out", L("no or a wrong token → signed out"));

  // ---- login: wrong password, then one device at a time
  ok((await call("POST", "/api/login", { username: "Remi", password: "nope-nope", deviceId: "pc-1" })).error === "bad_login", L("wrong password"));
  ok((await call("POST", "/api/login", { username: "Nobody", password: "nope-nope", deviceId: "pc-1" })).error === "bad_login", L("unknown user gives the same answer"));
  r = await call("POST", "/api/login", { username: "REMI", password: "dragonborn1", deviceId: "pc-1", deviceName: "Remi's PC" });
  ok(r.status === 409 && r.error === "session_active" && r.device === "Remi's phone" && r.lastSeen > 0, L("signing in elsewhere asks first: you're playing on Remi's phone"));
  ok((await call("GET", "/api/session", null, phone)).status === 200, L("…and the phone keeps playing if you don't take over"));
  clock += 60e3;
  r = await call("POST", "/api/login", { username: "remi", password: "dragonborn1", deviceId: "pc-1", deviceName: "Remi's PC", takeover: true });
  ok(r.status === 200 && r.token && r.took === "Remi's phone", L("Play here: the PC takes over"));
  const pc = r.token;
  r = await call("GET", "/api/session", null, phone);
  ok(r.status === 401 && r.error === "session_replaced" && r.by === "Remi's PC", L("the phone is told: you're now playing on Remi's PC"));
  ok((await call("GET", "/api/characters", null, phone)).error === "session_replaced", L("and can't save or load any more"));
  // the same device signing in again doesn't ask
  r = await call("POST", "/api/login", { username: "remi", password: "dragonborn1", deviceId: "pc-1", deviceName: "Remi's PC" });
  ok(r.status === 200, L("signing in again on the same device doesn't ask"));
  const pc2 = r.token;
  ok((await call("GET", "/api/session", null, pc)).status === 401 && (await call("GET", "/api/session", null, pc2)).status === 200, L("…and replaces that device's old session"));
  ok((await store.liveSessions(acct.id)).length === 1, L("one live session per account"));

  // ---- characters
  const save = (name, level, extra = {}) => ({ id: "local-abc123", name, level, race: "nord", inv: [{ item: "iron_sword", qty: 1 }], ...extra });
  r = await call("PUT", "/api/characters/local-abc123", { data: save("Hrolf", 7), baseVersion: 0 }, pc2);
  ok(r.status === 200 && r.version === 1, L("upload a character: version 1"));
  r = await call("GET", "/api/characters", null, pc2);
  ok(r.characters.length === 1 && r.characters[0].name === "Hrolf" && r.characters[0].level === 7 && r.characters[0].race === "nord" && !("data" in r.characters[0]), L("the list shows name, level and race, without the save"));
  r = await call("PUT", "/api/characters/local-abc123", { data: save("Hrolf", 8), baseVersion: 1 }, pc2);
  ok(r.version === 2, L("saving on top of the version you have: version 2"));
  r = await call("PUT", "/api/characters/local-abc123", { data: save("Hrolf", 9), baseVersion: 1 }, pc2);
  ok(r.status === 409 && r.error === "version_conflict" && r.server.version === 2 && r.server.level === 8, L("an older copy is caught: played somewhere else since"));
  r = await call("PUT", "/api/characters/local-abc123", { data: save("Hrolf", 9), baseVersion: 1, force: true }, pc2);
  ok(r.version === 3, L("keep this copy anyway (force)"));
  r = await call("GET", "/api/characters/local-abc123", null, pc2);
  ok(r.character.data.level === 9 && r.character.data.inv[0].item === "iron_sword" && r.character.version === 3, L("load gives the whole save back"));
  ok((await call("PUT", "/api/characters/bad id!", { data: save("x", 1) }, pc2)).error === "bad_id", L("odd character ids are refused"));
  ok((await call("PUT", "/api/characters/local-abc123", { data: [1, 2] }, pc2)).error === "bad_save", L("a save must be an object"));
  ok((await call("PUT", "/api/characters/local-big", { data: { name: "Big", blob: "x".repeat(LIMITS.saveBytes + 10) } }, pc2)).status === 413, L("huge saves are refused"));

  // another account can't touch it
  r = await call("POST", "/api/register", { username: "Kacper", password: "whiterun42", deviceId: "k-phone", deviceName: "Kacper's phone" });
  const kac = r.token;
  ok((await call("GET", "/api/characters/local-abc123", null, kac)).error === "not_found", L("someone else's character can't be read"));
  ok((await call("PUT", "/api/characters/local-abc123", { data: save("Thief", 1) }, kac)).error === "not_yours", L("…or overwritten"));
  ok((await call("DELETE", "/api/characters/local-abc123", null, kac)).error === "not_found", L("…or deleted"));
  ok((await call("GET", "/api/characters", null, kac)).characters.length === 0, L("Kacper's list is his own"));

  // delete, then the limit
  ok((await call("DELETE", "/api/characters/local-abc123", null, pc2)).ok, L("delete your own character"));
  ok((await call("GET", "/api/characters", null, pc2)).characters.length === 0 && (await call("GET", "/api/characters/local-abc123", null, pc2)).status === 404, L("…it's gone from the list"));
  for (let i = 0; i < LIMITS.maxChars; i++) await call("PUT", `/api/characters/k-${i}`, { data: { name: "K" + i, level: 1 } }, kac);
  r = await call("PUT", "/api/characters/k-extra", { data: { name: "One too many", level: 1 } }, kac);
  ok(r.error === "too_many", L(`an account holds up to ${LIMITS.maxChars} characters`));
  ok((await call("PUT", "/api/characters/k-0", { data: { name: "K0", level: 2 }, baseVersion: 1 }, kac)).version === 2, L("saving an existing one at the limit still works"));

  // ---- sign out, idle expiry
  ok((await call("POST", "/api/logout", null, kac)).ok && (await call("GET", "/api/session", null, kac)).error === "signed_out", L("sign out ends the session"));
  r = await call("POST", "/api/login", { username: "kacper", password: "whiterun42", deviceId: "k-pc", deviceName: "Kacper's PC" });
  ok(r.status === 200, L("after signing out, another device signs in without asking"));
  const kpc = r.token;
  clock += LIMITS.idleMs + 1000;
  ok((await call("GET", "/api/session", null, kpc)).error === "session_expired", L("a device away for over 30 days is signed out"));
  r = await call("POST", "/api/login", { username: "kacper", password: "whiterun42", deviceId: "k-phone", deviceName: "Kacper's phone" });
  ok(r.status === 200, L("a long-idle device doesn't block signing in elsewhere"));

  // ---- rate limits
  let blocked = false;
  for (let i = 0; i < 12; i++) { const x = await call("POST", "/api/login", { username: "remi", password: "guess" + i, deviceId: "z" }, null, { ip: "10.9.9." + i }); if (x.status === 429) blocked = true; }
  ok(blocked, L("guessing one account's password is slowed down (from any address)"));
  clock += 11 * 60e3;
  ok((await call("POST", "/api/login", { username: "remi", password: "dragonborn1", deviceId: "pc-1", deviceName: "Remi's PC" })).status === 200, L("…and allowed again later"));

  // ---- CORS and odd requests
  r = await call("OPTIONS", "/api/login", null, null, { headers: { Origin: "https://localhost" } });
  ok(r.status === 204 && r._h.get("access-control-allow-origin") && /Authorization/.test(r._h.get("access-control-allow-headers")), L("the app (another origin) may call it"));
  ok((await call("GET", "/api/nothing")).status === 404, L("unknown paths are 404"));
  const bad = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  ok(bad.status === 400, L("broken JSON is a 400, not a crash"));

  await new Promise((res) => srv.close(res));
  await store.close();
}

(async () => {
  await run(require(S + "store-memory").memoryStore(), "memory");
  if (process.env.PG_TEST_URL) {
    const { pgStore } = require(S + "store-pg");
    const st = pgStore(process.env.PG_TEST_URL, { ssl: false });
    // a clean database for the run
    const { Pool } = require(path.join(__dirname, "../server/node_modules/pg"));
    const p = new Pool({ connectionString: process.env.PG_TEST_URL }); await p.query("DROP TABLE IF EXISTS characters, sessions, accounts"); await p.end();
    await run(st, "postgres");
    // two saves racing on the same version: exactly one wins
    const st2 = pgStore(process.env.PG_TEST_URL, { ssl: false }); await st2.init();
    const a = await st2.createAccount({ id: "acc_race", username: "Racer", usernameLc: "racer", passHash: "x", now: 1 });
    await st2.saveCharacter({ id: "race-1", accountId: a.id, name: "R", level: 1, race: null, json: "{}", baseVersion: 0, now: 1 });
    const both = await Promise.all([1, 2].map((i) => st2.saveCharacter({ id: "race-1", accountId: a.id, name: "R" + i, level: i, race: null, json: "{}", baseVersion: 1, now: 2 })));
    ok(both.filter((x) => x.ok).length === 1 && both.filter((x) => x.conflict).length === 1, "[postgres] two saves on the same version: one wins, one is told");
    await st2.close();
  } else console.log("(set PG_TEST_URL to also run against Postgres)");
  console.log(fails ? `failed: ${fails}` : `server: all ok · ${n} checks`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
