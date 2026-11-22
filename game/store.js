/* Saving and networking. Two backends with the same functions:
   - shared: the page's own database (other players, dropped bags, your save on any device)
   - local:  this browser only (used when the shared database isn't available)
   Your full save is private. Only a small public card (name, level, position, current trip) is shared,
   and other players' positions are worked out from their trip, so we never write on a timer. */
const Store = (() => {
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  const NS = (location.search.match(/[?&]p=(\w+)/) || [])[1] || "";   // test only: several "phones" in one browser
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(NS + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  let db = null, uid = null, mode = "local", writable = true;
  /* ---- phone-to-phone world ("p2p"): every phone keeps a full copy of the shared world and merges with each
     phone it meets. Each record carries a timestamp (_v); the newest version wins. Deletions leave a marker (_del)
     so they spread too. Only players who are online right now show up and can be interacted with. */
  let world = {}, worldCode = null, net = null, peerUid = {}, online = new Set(), p2pStatus = "offline", saveWorldT = null;
  const wl = {};   // watchers per collection
  const COLS = ["players", "bags", "attacks", "parties", "chests", "news", "raids", "trades", "ladder", "chat", "hall", "hallchest", "bounty", "homes", "gifts", "duels", "clans", "clanmem", "war", "stalls", "friends", "dms", "guards", "verses", "verselikes", "runs", "econ", "halls", "pshare", "wevents"];
  const now = () => Date.now();
  let lastSaveJson = null, lastPubJson = null, saving = null, pendingSave = null;
  const listeners = { players: [], bags: [] };
  let localBags = [];

  async function init() {
    try {
      if (window.claude?.use) {
        const [d, u] = await Promise.all([withTimeout(window.claude.use("db"), 10000), withTimeout(window.claude.use("user"), 10000)]);
        const id = u ? await withTimeout(u.id(), 10000) : null;
        if (d && id) {
          db = d; uid = id; mode = "shared";
          const can = await withTimeout(Promise.resolve(u.can?.("data.write")), 5000);
          if (can === false) writable = false;
        }
      }
    } catch (e) { console.warn("shared storage unavailable", e); }
    if (mode === "local") {
      uid = ls.get("sk.uid") || "local-" + Math.random().toString(36).slice(2, 10);
      ls.set("sk.uid", uid);
      localBags = ls.get("sk.bags") || [];
      const T = transport();
      if (T) { mode = "p2p"; joinWorld(ONE_WORLD, T); }
    }
    return { mode, uid, writable };
  }

  // a BroadcastChannel stand-in for tests (?net=bc): tabs of one browser act as phones
  function transport() {
    if (/[?&]net=bc/.test(location.search) && window.BroadcastChannel) return {
      name: "bc",
      join(code, h) {
        const ch = new BroadcastChannel("rotn-" + code), me = Math.random().toString(36).slice(2, 9), peers = new Set();
        const post = (m) => ch.postMessage({ ...m, from: me });
        ch.onmessage = ({ data: m }) => {
          if (m.to && m.to !== me) return;
          if (m.k === "hi") { if (!peers.has(m.from)) { peers.add(m.from); post({ k: "hi", to: m.from }); h.onJoin(m.from); } return; }
          if (m.k === "bye") { peers.delete(m.from); h.onLeave(m.from); return; }
          h.onMessage(m.data, m.from);
        };
        post({ k: "hi" });
        addEventListener("pagehide", () => post({ k: "bye" }));
        return { send: (data, peer) => post({ k: "m", data, to: peer }), leave: () => { post({ k: "bye" }); ch.close(); } };
      },
    };
    return window.P2PNET || null;
  }
  const ONE_WORLD = "NORTH";   // everyone who has the app plays in this one world
  const newCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const live = (d) => d && !d._del;
  function emit(col) { const docs = list(col); (wl[col] || []).forEach((f) => f(docs)); }
  function list(col) {
    const out = Object.entries(world[col] || {}).filter(([, d]) => live(d)).map(([id, d]) => ({ ...d, id }));
    return col === "players" ? out.filter((d) => d.id !== uid && online.has(d.id)) : out;
  }
  function persistWorld() { clearTimeout(saveWorldT); saveWorldT = setTimeout(() => ls.set("sk.w." + worldCode, world), 800); }
  /* keep the newer version of each record */
  function merge(col, id, doc) {
    if (!COLS.includes(col) || !doc || typeof doc._v !== "number") return false;
    const cur = (world[col] = world[col] || {})[id];
    if (cur && (cur._v > doc._v || (cur._v === doc._v && String(cur._by) >= String(doc._by)))) return false;
    world[col][id] = doc;
    return true;
  }
  function tidy() {   // forget old things so the copy every phone keeps stays small
    const t = now(), sec = t / 1000;
    for (const col of COLS) for (const [id, d] of Object.entries(world[col] || {})) {
      const age = t - d._v;
      if ((d._del && age > 2 * 864e5) || (col === "bags" && live(d) && d.expires < sec) || (col === "attacks" && age > 36e5) || (col === "raids" && age > 864e5) || (col === "trades" && age > 7 * 864e5) || (col === "players" && age > 30 * 864e5) || (col === "chat" && age > 864e5) || (["bounty", "war"].includes(col) && age > 15 * 864e5) || (col === "gifts" && age > 30 * 864e5) || (col === "duels" && age > 864e5) || (col === "dms" && age > 14 * 864e5) || (["verses", "verselikes"].includes(col) && age > 14 * 864e5) || (col === "guards" && age > 2 * 864e5) || (col === "econ" && age > 3 * 864e5) || (col === "pshare" && age > 864e5) || (col === "runs" && age > 6 * 36e5) || (col === "wevents" && age > 9 * 864e5)
        || (["ladder", "homes"].includes(col) && age > 60 * 864e5) || (col === "clanmem" && age > 90 * 864e5))   // players gone for months
        delete world[col][id];
    }
    const news = Object.entries(world.news || {}).filter(([, d]) => live(d)).sort((a, b) => b[1]._v - a[1]._v);
    news.slice(40).forEach(([id]) => delete world.news[id]);
    const chat = Object.entries(world.chat || {}).filter(([, d]) => live(d)).sort((a, b) => b[1]._v - a[1]._v);
    chat.slice(60).forEach(([id]) => delete world.chat[id]);
    const hc = Object.entries(world.hallchest || {}).filter(([, d]) => live(d)).sort((a, b) => b[1]._v - a[1]._v);
    hc.slice(60).forEach(([id]) => delete world.hallchest[id]);
    const dms = Object.entries(world.dms || {}).filter(([, d]) => live(d)).sort((a, b) => b[1]._v - a[1]._v);
    dms.slice(400).forEach(([id]) => delete world.dms[id]);
  }
  function localPut(col, id, doc) {
    const rec = { ...doc, _v: Math.max(now(), ((world[col] || {})[id]?._v || 0) + 1), _by: uid };
    delete rec.id;
    merge(col, id, rec); persistWorld(); emit(col);
    net?.send({ t: "put", col, id, doc: rec });
  }
  function joinWorld(code, T = transport()) {
    if (net) { try { net.leave(); } catch { /* ignore */ } }
    worldCode = code; ls.set("sk.world", code);
    world = ls.get("sk.w." + code) || {}; tidy();
    online = new Set(); peerUid = {}; p2pStatus = "searching";
    COLS.forEach(emit);
    net = T.join(code, {
      onJoin(peer) { net.send({ t: "hello", uid, world }, peer); },
      onLeave(peer) { const u = peerUid[peer]; delete peerUid[peer]; if (u && !Object.values(peerUid).includes(u)) { online.delete(u); emit("players"); } p2pStatus = online.size ? "connected" : "searching"; statusChanged(); },
      onMessage(m, peer) {
        if (!m || typeof m !== "object") return;
        if (m.t === "hello") {
          peerUid[peer] = m.uid; online.add(m.uid);
          for (const col of COLS) for (const [id, d] of Object.entries(m.world?.[col] || {})) merge(col, id, d);
          tidy(); persistWorld(); COLS.forEach(emit);
          p2pStatus = "connected"; statusChanged();
        } else if (m.t === "put") {
          if (m.col === "players" && peerUid[peer] && m.id === peerUid[peer]) online.add(m.id);
          if (merge(m.col, m.id, m.doc)) { persistWorld(); emit(m.col); }
        }
      },
      onError() { /* trystero keeps retrying on its own */ },
    });
    statusChanged();
  }
  const statusL = [];
  function statusChanged() { statusL.forEach((f) => f({ status: p2pStatus, peers: online.size, code: worldCode })); }

  async function loadSave() {
    if (mode === "p2p") return ls.get("sk.save");
    if (mode === "shared") {
      try {
        const snap = await db.doc(`data/users/${uid}/save`).get();
        if (snap.exists) { const s = snap.data().state; lastSaveJson = JSON.stringify(s); return JSON.parse(lastSaveJson); }
        return null;
      } catch (e) { console.warn(e); return null; }
    }
    return ls.get("sk.save");
  }

  /* Save whenever state changed. One write in flight at a time; bursts collapse into one write. */
  function save(state) {
    const json = JSON.stringify(state);
    if (json === lastSaveJson) return;
    if (mode === "local" || mode === "p2p") { ls.set("sk.save", state); lastSaveJson = json; return; }
    if (!writable) return;
    pendingSave = json;
    if (saving) return;
    saving = (async () => {
      while (pendingSave) {
        const body = pendingSave; pendingSave = null;
        try { await db.doc(`data/users/${uid}/save`).set({ state: JSON.parse(body), updated: Date.now() }); lastSaveJson = body; }
        catch (e) { console.warn("save failed", e); if (e?.code === "invalid_argument") writable = false; break; }
      }
      saving = null;
    })();
  }

  /* Public card: changes only when the trip or level changes (positions are computed from it). */
  async function publish(card) {
    const json = JSON.stringify(card);
    if (json === lastPubJson) return;
    lastPubJson = json;
    if (mode === "p2p") return localPut("players", uid, card);
    if (mode === "local" || !writable) return;
    try { await db.doc(`players/${uid}`).set(card); } catch (e) { console.warn("publish failed", e); }
  }

  function watchPlayers(cb) {
    if (mode === "p2p") return watch("players", cb);
    if (mode === "local") { cb([]); return () => {}; }
    return db.collection("players").onSnapshot(
      (snap) => cb(snap.docs.filter((d) => d.id !== uid).map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.warn("players feed stopped", e));
  }
  function watchBags(cb) {
    if (mode === "p2p") return watch("bags", cb);
    if (mode === "local") { cb(localBags); listeners.bags.push(cb); return () => {}; }
    return db.collection("bags").onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      (e) => console.warn("bags feed stopped", e));
  }
  async function addBag(bag) {
    if (mode === "p2p") return localPut("bags", bag.id, bag);
    if (mode === "local") { localBags.push(bag); ls.set("sk.bags", localBags); listeners.bags.forEach((f) => f(localBags)); return; }
    if (!writable) return;
    try { await db.doc(`bags/${bag.id}`).set(bag); } catch (e) { console.warn(e); }
  }
  /* Take a bag only if it is still there (someone else may have been faster). */
  async function takeBag(id) {
    if (mode === "p2p") { const had = live((world.bags || {})[id]); if (had) localPut("bags", id, { _del: true }); return !!had; }
    if (mode === "local") {
      const had = localBags.some((b) => b.id === id);
      localBags = localBags.filter((b) => b.id !== id); ls.set("sk.bags", localBags);
      listeners.bags.forEach((f) => f(localBags));
      return had;
    }
    try {
      const ref = db.doc(`bags/${id}`);
      const lease = await ref.acquire({ holder: uid, ttlMs: 5000 });
      if (!lease.acquired) return false;
      const snap = await ref.get();
      if (!snap.exists) return false;
      await ref.delete();
      return true;
    } catch (e) { console.warn(e); return false; }
  }
  async function wipe() {
    if (mode === "p2p") { try { localStorage.removeItem(NS + "sk.save"); } catch { /* ignore */ } lastSaveJson = null; localPut("players", uid, { _del: true }); return; }
    if (mode === "local") { try { localStorage.removeItem(NS + "sk.save"); } catch { /* ignore */ } lastSaveJson = null; return; }
    try { await db.doc(`data/users/${uid}/save`).delete(); await db.doc(`players/${uid}`).delete(); } catch (e) { console.warn(e); }
    lastSaveJson = null; lastPubJson = null;
  }
  /* Small shared collections for multiplayer: attacks, parties, chests, news. Local mode keeps them in memory (you're alone anyway). */
  const mem = {}, memL = {};
  const memEmit = (col) => (memL[col] || []).forEach((f) => f(Object.values(mem[col] || {})));
  function watch(col, cb) {
    if (mode === "p2p") { (wl[col] = wl[col] || []).push(cb); cb(list(col)); return () => {}; }
    if (mode === "local") { (memL[col] = memL[col] || []).push(cb); cb(Object.values(mem[col] || {})); return () => {}; }
    return db.collection(col).onSnapshot((snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), (e) => console.warn(col + " feed stopped", e));
  }
  async function put(col, id, doc) {
    if (mode === "p2p") { localPut(col, id, doc); return true; }
    if (mode === "local") { (mem[col] = mem[col] || {})[id] = { ...doc, id }; memEmit(col); return true; }
    if (!writable) return false;
    try { await db.doc(`${col}/${id}`).set(doc); return true; } catch (e) { console.warn(e); return false; }
  }
  async function remove(col, id) {
    if (mode === "p2p") { if ((world[col] || {})[id]) localPut(col, id, { _del: true }); return; }
    if (mode === "local") { delete (mem[col] || {})[id]; memEmit(col); return; }
    try { await db.doc(`${col}/${id}`).delete(); } catch (e) { console.warn(e); }
  }
  /* read-modify-write under a short lease, so two players can't both take the same thing. fn(doc) returns the new doc, or null to delete. */
  async function change(col, id, fn) {
    if (mode === "p2p") {
      const cur = (world[col] || {})[id];
      if (!live(cur)) return null;
      const before = { ...cur }; delete before._v; delete before._by;
      const nx = fn({ ...before });
      localPut(col, id, nx ? nx : { _del: true });
      return { before, after: nx };
    }
    if (mode === "local") { const cur = (mem[col] || {})[id]; if (!cur) return null; const nx = fn({ ...cur }); if (nx) mem[col][id] = { ...nx, id }; else delete mem[col][id]; memEmit(col); return { before: cur, after: nx }; }
    try {
      const ref = db.doc(`${col}/${id}`);
      const lease = await ref.acquire({ holder: uid, ttlMs: 5000 });
      if (!lease.acquired) return null;
      const snap = await ref.get();
      if (!snap.exists) return null;
      const cur = snap.data(), nx = fn({ ...cur });
      if (nx) await ref.set(nx); else await ref.delete();
      return { before: cur, after: nx };
    } catch (e) { console.warn(e); return null; }
  }
  return { flush: () => saving || Promise.resolve(), init, loadSave, save, publish, watchPlayers, watchBags, addBag, takeBag, wipe, watch, put, remove, change,
    joinWorld: (code) => joinWorld(String(code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || newCode()),
    onStatus: (f) => { statusL.push(f); f({ status: p2pStatus, peers: online.size, code: worldCode }); },
    get online() { return mode === "shared" || mode === "p2p"; }, get worldCode() { return worldCode; }, get peers() { return online.size; }, get direct() { return Math.min(online.size, net?.direct?.() ?? online.size); }, get mode() { return mode; }, get uid() { return uid; }, get writable() { return writable; } };
})();
