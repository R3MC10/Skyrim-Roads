// The shared world on the server (server/src/hub.js): signed-in players connect over a WebSocket, see each other,
// get the stored world, pass records and messages on; the hub keeps records (newest wins) and saves them, refuses
// spoofed cards and other accounts' characters, closes a connection the moment another device takes over, and loads
// the world back after a restart. node test_hub.js   (needs `npm ci` in server/ for the ws library)
"use strict";
const http = require("http"), path = require("path"), { EventEmitter } = require("events");
const S = path.join(__dirname, "../server/src/");
const WS = require(path.join(__dirname, "../server/node_modules/ws"));
const { createApp } = require(S + "app"), { createHub } = require(S + "hub"), { memoryStore } = require(S + "store-memory");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(store) {
  const events = new EventEmitter(), app = createApp({ store, events });
  const srv = http.createServer(app);
  const hub = createHub({ store, authToken: app.authToken, events });
  await hub.init(); hub.attach(srv);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `127.0.0.1:${srv.address().port}`;
  const api = async (method, p, body, token) => { const r = await fetch(`http://${base}${p}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
  /* a player's connection: collects everything the hub sends */
  const client = (token, uid) => new Promise((resolve) => {
    const ws = new WS(`ws://${base}/ws`), c = { ws, got: [], closed: null, peer: null };
    ws.on("open", () => ws.send(JSON.stringify({ k: "auth", token, uid })));
    ws.on("message", (raw) => { const m = JSON.parse(raw); c.got.push(m); if (m.k === "ready") { c.peer = m.peer; resolve(c); } });
    ws.on("close", (code, reason) => { c.closed = { code, reason: String(reason) }; resolve(c); });
    c.send = (data, to) => ws.send(JSON.stringify({ k: "m", data, ...(to != null ? { to } : {}) }));
    c.last = (k) => [...c.got].reverse().find((m) => m.k === k);
  });
  return { srv, hub, api, client, close: async () => { await hub.stop(); await new Promise((r) => srv.close(r)); } };
}

(async () => {
  let store = memoryStore();
  if (process.env.PG_TEST_URL) {   // the same checks on a real Postgres (a clean database)
    const { Pool } = require(path.join(__dirname, "../server/node_modules/pg"));
    const p = new Pool({ connectionString: process.env.PG_TEST_URL }); await p.query("DROP TABLE IF EXISTS world_records, characters, sessions, accounts"); await p.end();
    store = require(S + "store-pg").pgStore(process.env.PG_TEST_URL, { ssl: false });
  }
  await store.init();
  console.log("store:", store.kind);
  let H = await boot(store);
  const a = await H.api("POST", "/api/register", { username: "Remi", password: "dragonborn1", deviceId: "rp", deviceName: "Remi's phone" });
  const k = await H.api("POST", "/api/register", { username: "Kacper", password: "whiterun42", deviceId: "kp", deviceName: "Kacper's phone" });
  await H.api("PUT", "/api/characters/remi-char", { data: { name: "Hrolf", level: 5 } }, a.token);

  // ---- signing in to the world
  const bad = await H.client("nonsense", "x-char");
  ok(bad.closed && bad.closed.code === 4401, "a bad session can't join the world");
  const steal = await H.client(k.token, "remi-char");
  ok(steal.closed && steal.closed.code === 4403, "someone else's character can't be played");
  const A = await H.client(a.token, "remi-char");
  ok(A.peer && A.last("world") && Array.isArray(A.last("peers").list) && A.last("peers").list.length === 0, "Remi joins: ready, the world, nobody else yet");
  const K = await H.client(k.token, "kacper-char");
  await wait(50);
  ok(K.last("peers").list.some((p) => p.uid === "remi-char"), "Kacper joins and sees Remi");
  ok(A.got.some((m) => m.k === "join" && m.uid === "kacper-char"), "Remi is told Kacper joined");
  ok(JSON.stringify(H.hub.online.sort()) === JSON.stringify(["kacper-char", "remi-char"]), "two players online");

  // ---- records and messages
  const card = { name: "Hrolf", level: 5, x: 0.5, y: 0.5, _v: Date.now(), _by: "remi-char" };
  A.send({ t: "put", col: "players", id: "remi-char", doc: card });
  A.send({ t: "put", col: "chat", id: "c1", doc: { text: "Hail!", _v: Date.now(), _by: "remi-char" } });
  await wait(80);
  ok(K.got.some((m) => m.k === "m" && m.data.col === "chat" && m.data.doc.text === "Hail!"), "Kacper gets Remi's chat line");
  ok(H.hub.world.chat?.c1?.text === "Hail!" && H.hub.world.players?.["remi-char"]?.name === "Hrolf", "the hub keeps the records");
  A.send({ t: "put", col: "players", id: "kacper-char", doc: { name: "Fake", _v: Date.now() + 9e9, _by: "remi-char" } });
  A.send({ t: "put", col: "chat", id: "c2", doc: { text: "as Kacper", _v: Date.now(), _by: "kacper-char" } });
  A.send({ t: "put", col: "nonsense", id: "z", doc: { _v: 1, _by: "remi-char" } });
  await wait(80);
  ok(!H.hub.world.players?.["kacper-char"] && !H.hub.world.chat?.c2 && !H.hub.world.nonsense, "spoofed cards, records signed as someone else and unknown collections are dropped");
  ok(!K.got.some((m) => m.k === "m" && (m.data.id === "kacper-char" || m.data.id === "c2")), "…and not passed on");
  A.send({ t: "put", col: "chat", id: "c1", doc: { text: "older", _v: 1, _by: "remi-char" } }); await wait(50);
  ok(H.hub.world.chat.c1.text === "Hail!", "an older copy doesn't overwrite a newer one");
  A.send({ t: "hello", uid: "remi-char", world: { players: { "remi-char": card } } }, K.peer); await wait(50);
  ok(K.got.some((m) => m.k === "m" && m.data.t === "hello"), "a hello to one player reaches just that player");
  // a third player arriving gets the stored world straight away
  const k2acct = await H.api("POST", "/api/register", { username: "Third", password: "riverwood9", deviceId: "tp", deviceName: "phone" });
  const T = await H.client(k2acct.token, "third-char");
  ok(T.last("world").world.chat?.c1?.text === "Hail!" && T.last("world").world.players?.["remi-char"], "a newcomer gets the world the hub kept");

  // ---- another device takes over Remi: the world connection closes at once
  const r = await H.api("POST", "/api/login", { username: "remi", password: "dragonborn1", deviceId: "rpc", deviceName: "Remi's PC", takeover: true });
  await wait(100);
  ok(r.token && A.closed && A.closed.code === 4001 && /session_replaced/.test(A.closed.reason) && /Remi's PC/.test(A.closed.reason), "taking over closes the old device's world connection (4001, by Remi's PC)");
  ok(K.got.some((m) => m.k === "leave" && m.peer === A.peer), "others see Remi's old device leave");
  const A2 = await H.client(r.token, "remi-char");
  ok(A2.peer && !A2.closed, "Remi's PC joins the world");
  // the same account connecting twice (a second tab): the newer connection wins
  const A3 = await H.client(r.token, "remi-char"); await wait(80);
  ok(A2.closed && A2.closed.code === 4001 && A3.peer && !A3.closed, "one connection per account: the newest wins");
  // signing out closes it too
  await H.api("POST", "/api/logout", null, k.token); await wait(80);
  ok(K.closed && K.closed.code === 4001, "signing out closes the world connection");

  // ---- restart: the world comes back from storage
  await H.close();
  H = await boot(store);
  ok(H.hub.world.chat?.c1?.text === "Hail!" && H.hub.world.players?.["remi-char"]?.name === "Hrolf", "after a restart the hub loads the world back");
  // pruning: old chat goes, deleted markers go after 2 days
  H.hub.merge("chat", "old", { text: "ancient", _v: Date.now() - 3 * 864e5, _by: "x" });
  H.hub.merge("trades", "gone", { _del: true, _v: Date.now() - 3 * 864e5, _by: "x" });
  ok(H.hub.prune() >= 2 && !H.hub.world.chat.old && !H.hub.world.trades.gone, "old chat and old deletions are forgotten");
  await H.close(); await store.close();
  console.log(fails ? `failed: ${fails}` : `hub: all ok · ${n} checks`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
