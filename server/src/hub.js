// The shared world on the server (phase 2). Signed-in players connect over a WebSocket at /ws. The hub keeps the whole
// shared world (players' public cards, parties, chat, trades, market, clans, world events…) and passes messages between
// connected players, so the game's store.js works exactly as it does phone-to-phone, with the server as a peer that is
// always online and never forgets.
//   client → hub   {k:"auth", token, uid}                 first message: your session and the character you play
//                  {k:"m", data, to?}                      a message for one player (to = their peer id) or for everyone
//                                                          data.t: "put" (one record), "hello" (several), "sum" (fingerprints)
//   hub → client   {k:"ready", peer}  {k:"world", world}  {k:"peers", list:[{peer, uid}]}
//                  {k:"join", peer, uid}  {k:"leave", peer}  {k:"m", from, data}
// Records merge like on the phones: the newer _v wins (ties by _by). A player can only write their own public card and
// only sign their own records. A character from another account can't be played. One connection per account: signing
// in on another device closes the old one (code 4001) at once.
"use strict";
const { WebSocketServer } = require("ws");
const NETSYNC = require("./netsync.js");   // party records merge field by field, by the same rules as the phones (a copy of game/netsync.js)

const COLS = ["players", "bags", "attacks", "parties", "chests", "news", "raids", "trades", "ladder", "chat", "hall", "hallchest", "bounty", "homes", "gifts", "duels", "clans", "clanmem", "war", "stalls", "friends", "dms", "guards", "verses", "verselikes", "runs", "econ", "halls", "pshare", "lvotes", "tbf", "wevents", "dgame", "holds", "greets", "fest"];   // = store.js COLS (test_hub.js checks they match)
const KEEP = { chat: 864e5, attacks: 36e5, dgame: 36e5, raids: 864e5, duels: 864e5, tbf: 36e5, runs: 6 * 36e5, pshare: 864e5, lvotes: 864e5, guards: 2 * 864e5, econ: 3 * 864e5,
  trades: 7 * 864e5, dms: 14 * 864e5, verses: 14 * 864e5, verselikes: 14 * 864e5, bounty: 15 * 864e5, war: 15 * 864e5, gifts: 30 * 864e5, wevents: 9 * 864e5, players: 90 * 864e5 };
const MAX_MSG = 4 * 1024 * 1024;
/* Remigiusz: "equipped gear should never show when selling items ... or trading with another player". The game never
   puts worn gear in these records; a record that says it does (a worn/eq flag on an item) is dropped as a safety net. */
const HANDOVER = ["trades", "gifts", "stalls"];
const holdsWorn = (doc) => [...(Array.isArray(doc.items) ? doc.items : []), doc.row].some((x) => x && typeof x === "object" && (x.worn || x.eq));

function createHub({ store, now = () => Date.now(), authToken, events, log = () => {} }) {
  const world = {};              // col -> { id -> doc }
  const conns = new Map();       // peer -> { ws, peer, uid, accountId, sessionId }
  const dirty = new Map();       // "col\u0000id" -> [col, id]
  let nextPeer = 1, flushT = null, pruneT = null, wss = null;

  const okCol = (col) => COLS.includes(col);
  function merge(col, id, doc) {
    if (!okCol(col) || typeof id !== "string" || id.length > 120 || !doc || typeof doc !== "object" || typeof doc._v !== "number") return false;
    const cur = (world[col] = world[col] || {})[id];
    const m = cur ? NETSYNC.mergeDoc(col, cur, doc) : null;
    if (m) {
      if (NETSYNC.same(m, cur)) return false;
      world[col][id] = m;
      dirty.set(col + "\u0000" + id, [col, id]);
      if (!flushT) flushT = setTimeout(flush, 1500);
      return true;
    }
    if (cur && (cur._v > doc._v || (cur._v === doc._v && String(cur._by) >= String(doc._by)))) return false;
    world[col][id] = doc;
    dirty.set(col + "\u0000" + id, [col, id]);
    if (!flushT) flushT = setTimeout(flush, 1500);
    return true;
  }
  async function flush() {
    flushT = null;
    const batch = [...dirty.values()]; dirty.clear();
    if (!batch.length || !store.putWorld) return;
    try { await store.putWorld(batch.map(([col, id]) => ({ col, id, doc: world[col]?.[id] ?? null }))); }
    catch (e) { console.error("world save failed", e); for (const [col, id] of batch) dirty.set(col + "\u0000" + id, [col, id]); flushT = setTimeout(flush, 5000); }
  }
  /* forget old records, like the phones do (keeps the world small) */
  function prune() {
    const t = now(), gone = [];
    for (const col of Object.keys(world)) for (const [id, d] of Object.entries(world[col])) {
      const age = t - (d._v || 0);
      if ((d._del && age > 2 * 864e5) || (KEEP[col] && age > KEEP[col]) || (col === "bags" && !d._del && d.expires && d.expires < t / 1000)) { delete world[col][id]; gone.push({ col, id, doc: null }); }
    }
    for (const col of ["news", "chat", "hallchest"]) {
      const live = Object.entries(world[col] || {}).filter(([, d]) => !d._del).sort((a, b) => b[1]._v - a[1]._v);
      for (const [id] of live.slice(col === "news" ? 40 : 60)) { delete world[col][id]; gone.push({ col, id, doc: null }); }
    }
    if (gone.length && store.putWorld) store.putWorld(gone).catch((e) => console.error("prune save failed", e));
    return gone.length;
  }

  const send = (c, m) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };
  const others = (c) => [...conns.values()].filter((x) => x !== c && x.uid);
  function close(c, code, reason) { try { c.ws.close(code, typeof reason === "string" ? reason : JSON.stringify(reason || {}).slice(0, 120)); } catch { /* gone */ } }

  /* first message: who you are */
  async function hello(c, m) {
    let who;
    try { who = await authToken(String(m.token || "")); }
    catch (e) { return close(c, 4401, { error: e.code || "signed_out", by: e.extra?.by }); }
    const uid = String(m.uid || "");
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(uid)) return close(c, 4400, { error: "bad_uid" });
    const ch = await store.getCharacter(uid);
    if (ch && ch.accountId !== who.account.id && !ch.deletedAt) return close(c, 4403, { error: "not_yours" });
    // one connection per account: the newest wins (another device took over, or this one reconnected)
    for (const x of conns.values()) if (x !== c && x.accountId === who.account.id) { conns.delete(x.peer); for (const o of others(x)) send(o, { k: "leave", peer: x.peer }); close(x, 4001, { error: "session_replaced", by: who.session.deviceName }); }
    Object.assign(c, { uid, accountId: who.account.id, sessionId: who.session.id });
    send(c, { k: "ready", peer: c.peer });
    send(c, { k: "world", world });
    send(c, { k: "peers", list: others(c).map((x) => ({ peer: x.peer, uid: x.uid })) });
    for (const o of others(c)) send(o, { k: "join", peer: c.peer, uid });
    log(`+ ${uid} (${conns.size} online)`);
  }
  /* a message from a player: check what it writes, keep it, pass it on */
  function onData(c, data, to) {
    if (!data || typeof data !== "object") return;
    if (data.t === "put") {
      if (data.col === "players" && data.id !== c.uid) return;                   // only your own public card
      if (!data.doc || data.doc._by !== c.uid) return;                            // records are signed by who wrote them
      if (HANDOVER.includes(data.col) && holdsWorn(data.doc)) return;            // worn gear never changes hands (trades, gifts, stalls)
      merge(data.col, data.id, data.doc);
    } else if (data.t === "hello") {
      if (data.uid !== c.uid) return;
      for (const [col, recs] of Object.entries(data.world || {})) {
        if (!okCol(col) || !recs || typeof recs !== "object") continue;
        for (const [id, d] of Object.entries(recs)) if (!(HANDOVER.includes(col) && d && typeof d === "object" && holdsWorn(d)) &&col !== "players" || id === c.uid || (world.players?.[id])) merge(col, id, d);   // others' cards only update cards the hub already knows
      }
    } else if (data.t === "sum") {
      if (data.uid !== c.uid) return;   // the desync check (netsync.js): fingerprints only, passed on, never kept
    } else return;
    const out = { k: "m", from: c.peer, data };
    if (to != null) { const x = conns.get(+to); if (x) send(x, out); }
    else for (const o of others(c)) send(o, out);
  }

  function attach(server) {
    wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
    server.on("upgrade", (req, socket, head) => {
      if ((req.url || "").split("?")[0] !== "/ws") { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    });
    wss.on("connection", (ws) => {
      const c = { ws, peer: nextPeer++, uid: null };
      conns.set(c.peer, c);
      const authT = setTimeout(() => { if (!c.uid) close(c, 4401, { error: "signed_out" }); }, 10e3);
      let alive = true; ws.on("pong", () => { alive = true; });
      const ping = setInterval(() => { if (!alive) return ws.terminate(); alive = false; try { ws.ping(); } catch { /* gone */ } }, 30e3);
      ws.on("message", async (raw) => {
        let m; try { m = JSON.parse(raw); } catch { return; }
        if (!m || typeof m !== "object") return;
        if (!c.uid) { if (m.k === "auth" && !c.authing) { c.authing = true; await hello(c, m).catch((e) => { console.error(e); close(c, 1011, { error: "server_error" }); }); } return; }
        if (m.k === "m") onData(c, m.data, m.to);
      });
      ws.on("close", () => {
        clearTimeout(authT); clearInterval(ping);
        if (conns.get(c.peer) === c) { conns.delete(c.peer); if (c.uid) { for (const o of others(c)) send(o, { k: "leave", peer: c.peer }); log(`- ${c.uid} (${conns.size} online)`); } }
      });
    });
    // a session ended (signed out, taken over): its connection goes too
    events?.on("revoked", ({ accountId, exceptSessionId, by }) => {
      for (const x of [...conns.values()]) if (x.accountId === accountId && x.sessionId !== exceptSessionId) close(x, 4001, { error: by ? "session_replaced" : "signed_out", by });
    });
    pruneT = setInterval(prune, 36e5);
  }
  async function init() {
    if (!store.loadWorld) return;
    for (const { col, id, doc } of await store.loadWorld()) (world[col] = world[col] || {})[id] = doc;
    prune();
  }
  async function stop() { clearInterval(pruneT); clearTimeout(flushT); await flush(); for (const c of conns.values()) close(c, 1001, { error: "restart" }); wss?.close(); }
  return { init, attach, stop, flush, prune, merge, get world() { return world; }, get online() { return [...conns.values()].filter((c) => c.uid).map((c) => c.uid); } };
}
module.exports = { createHub, COLS };
