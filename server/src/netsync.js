/* Network sync for parties [OURS]: everyone in a party ends up seeing the same thing.
   The shared world is a set of records (store.js). Until now each record was "newest copy wins": when two phones changed
   the same record at nearly the same moment (a member reporting which room they're in while the leader added the next
   room, two members voting at once, two heroes landing the last blow on the boss…), one of the changes was silently lost.
   That is how a party could get stuck ("Hold on, the party is still syncing"), lose loot votes, or lose a killer from the
   boss chest.

   This module fixes that in four ways:
   1. Field-by-field merge. Every write stamps the fields it really changed (_f: field -> [stamp]). When two copies meet,
      each field keeps its newest version, and the per-player maps inside a record (votes, ready marks, who's in which
      room, chest claims, members…) merge player by player. Merging is order-free (a, b, c in any order, any number of
      times, gives the same record), so phones that hear the same changes always agree, however late or out of order the
      messages come. Records written by old phones (no _f) still work: they count as "everything changed at _v", exactly
      the old newest-wins rule.
   2. A desync check: every 20 s each phone sends a short fingerprint (hash) of the party records it holds. A phone whose
      copy differs answers with its copy, the other merges it and sends back what the first one was missing. One round
      trip and both hold the same record (dropped messages, a phone that slept, a reconnect…).
   3. Seeded rolls for shared dungeon rooms: a party run's room (puzzle answer, trap, chest lock) and the leader's actions
      replayed on members' phones roll the same dice everywhere (seed = run + room + action), instead of Math.random.
   4. Helpers (hash, rng, seeded, canon) for other modules and for tests/test_netsync.js.
   This file is plain JS that also loads in node: the server (server/src/netsync.js is a byte-for-byte copy, checked by the
   test) merges with the very same rules. */
const NETSYNC = (() => {
  // ---------------------------------------------------------------- hashing and seeded rolls
  function hash(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const seedOf = (...parts) => hash(parts.join("|"));
  /* run fn with Math.random replaced by a seeded roll (the same numbers on every phone); always put back afterwards */
  function seeded(seed, fn) {
    const prev = Math.random;
    Math.random = rng(typeof seed === "number" ? seed : hash(seed));
    try { return fn(); } finally { Math.random = prev; }
  }

  // ---------------------------------------------------------------- canonical form (same text for the same data)
  function canon(v) {
    if (v === undefined) return "";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map((x) => (x === undefined ? "null" : canon(x))).join(",") + "]";
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const plain = (o) => !!o && typeof o === "object" && !Array.isArray(o);
  const same = (a, b) => canon(a) === canon(b);
  const hashDoc = (d) => hash(canon(d));

  // ---------------------------------------------------------------- which records merge field by field
  /* maps: per-player (or per-key) maps inside the record. arr: an array of objects keyed by that field. set: an array of
     plain ids. pid: the map belongs to one instance of its parent (a ready check, a stop on the road), named by that field
     of the parent; marks from an older instance never leak into a newer one. */
  const SPEC = {
    parties: { members: { arr: "id" }, invites: { set: 1 }, "ready.ok": { pid: "id" }, "ready.no": { pid: "id" }, "halt.votes": { pid: "id" } },
    runs: { members: { arr: "id" }, invites: { arr: "id" }, at: {}, claims: {}, acts: {}, "chest.killers": { set: 1 }, "vote.votes": {}, "vote.bonus": {}, "vote.done": {} },
    lvotes: { votes: {}, bonus: {}, done: {} },
    pshare: { claims: {} },
  };
  const META = new Set(["_v", "_by", "_f", "id"]);
  const parts = (P) => { const i = P.indexOf("."); return i < 0 ? [null, P] : [P.slice(0, i), P.slice(i + 1)]; };
  const parentOf = (doc, P) => { const [par] = parts(P); return par == null ? doc : plain(doc?.[par]) ? doc[par] : null; };
  const pidOf = (doc, P, sp) => { const par = parentOf(doc, P); return par && sp.pid ? (par[sp.pid] ?? null) : null; };
  /* the map at P as { key: value } (arrays turned into maps), or null if it isn't there */
  function mapOf(doc, P, sp) {
    const par = parentOf(doc, P), raw = par ? par[parts(P)[1]] : undefined;
    if (raw == null) return null;
    if (sp.arr) { const o = {}; if (Array.isArray(raw)) raw.forEach((x) => { if (x && x[sp.arr] != null) o[String(x[sp.arr])] = x; }); return o; }
    if (sp.set) { const o = {}; if (Array.isArray(raw)) raw.forEach((x) => { if (x != null) o[String(x)] = true; }); return o; }
    return plain(raw) ? raw : {};
  }
  const indexIn = (doc, P, sp, k) => { const m = mapOf(doc, P, sp); const i = m ? Object.keys(m).indexOf(k) : -1; return i < 0 ? 0 : i; };
  /* a top-level field's value without the maps that merge on their own */
  function slotVal(col, doc, K) {
    const v = doc?.[K];
    if (v === undefined) return undefined;
    const subs = Object.keys(SPEC[col]).filter((P) => parts(P)[0] === K);
    if (!subs.length || !plain(v)) return v;
    const o = { ...v }; for (const P of subs) delete o[parts(P)[1]];
    return o;
  }
  const topMaps = (col) => new Set(Object.keys(SPEC[col]).filter((P) => parts(P)[0] == null));
  function slotKeys(col, doc) { const tm = topMaps(col); return doc ? Object.keys(doc).filter((k) => !META.has(k) && !tm.has(k)) : []; }
  const fresh = (d) => !!d && plain(d._f) && d._f["~"] === d._v;   // its stamps belong to this very write (an old phone may copy _f along)
  const FS = "|";

  /* a field's stamp in doc d: [stamp] (fresh docs: as written; old-style docs: everything at _v) */
  function topStamp(d, K) { if (fresh(d)) return d._f[K] || null; return [d._v || 0]; }
  /* an entry's stamp: [stamp, parent id, added] or null (unknown here) */
  function entStamp(col, d, P, k) {
    const sp = SPEC[col][P];
    if (fresh(d)) { const e = d._f[P + FS + k]; if (e) return e; const m = mapOf(d, P, sp); return m && k in m ? [1, pidOf(d, P, sp), indexIn(d, P, sp, k)] : null; }
    if (!parentOf(d, P)) return null;
    const m = mapOf(d, P, sp), has = !!m && k in m;
    return [d._v || 0, pidOf(d, P, sp), has ? indexIn(d, P, sp, k) : d._v || 0];
  }
  const better = (sa, va, sb, vb) => (sa !== sb ? sa > sb : canon(va) >= canon(vb));   // true: a wins

  /* build the map's value back from entries { key: value } in (added, key) order */
  function writeMap(par, P, sp, ents, order) {
    const field = parts(P)[1], keys = Object.keys(ents).sort((a, b) => (order[a] - order[b]) || (a < b ? -1 : a > b ? 1 : 0));
    if (sp.arr) par[field] = keys.map((k) => clone(ents[k]));
    else if (sp.set) par[field] = keys;
    else { const o = {}; for (const k of keys) o[k] = clone(ents[k]); par[field] = o; }
  }

  /* merge two copies of one record. Returns the merged record, or null when this collection isn't field-merged (or a
     copy is a deletion): then the caller keeps the plain newest-wins rule. */
  function mergeDoc(col, a, b) {
    const spec = SPEC[col];
    if (!spec || !plain(a) || !plain(b) || a._del || b._del || typeof a._v !== "number" || typeof b._v !== "number") return null;
    const aWins = a._v !== b._v ? a._v > b._v : String(a._by) >= String(b._by);
    const W = aWins ? a : b;
    const out = { _v: W._v, _by: W._by }, f = { "~": W._v };
    // top-level fields
    const keys = new Set([...slotKeys(col, a), ...slotKeys(col, b)]);
    for (const d of [a, b]) if (fresh(d)) for (const k of Object.keys(d._f)) if (k !== "~" && !k.includes(FS) && !topMaps(col).has(k)) keys.add(k);
    for (const K of keys) {
      const sa = topStamp(a, K), sb = topStamp(b, K), va = slotVal(col, a, K), vb = slotVal(col, b, K);
      const na = sa ? sa[0] : 0, nb = sb ? sb[0] : 0;
      const useA = better(na, va, nb, vb), v = useA ? va : vb;
      f[K] = [Math.max(na, nb)];
      if (v !== undefined) out[K] = clone(v);
    }
    // the maps, entry by entry
    for (const P of Object.keys(spec)) {
      const sp = spec[P], par = parentOf(out, P);
      if (!par) continue;
      const pid = pidOf(out, P, sp);
      const side = (d) => { const ok = parentOf(d, P) && pidOf(d, P, sp) === pid; return { d, ok, m: ok ? mapOf(d, P, sp) : null }; };
      const A = side(a), B = side(b), ks = new Set();
      for (const S of [A, B]) {
        if (S.m) Object.keys(S.m).forEach((k) => ks.add(k));
        if (fresh(S.d)) for (const fk of Object.keys(S.d._f)) if (fk.startsWith(P + FS) && S.d._f[fk][1] === pid) ks.add(fk.slice(P.length + 1));
      }
      const ents = {}, order = {};
      for (const k of ks) {
        const ea = entStamp(col, a, P, k), eb = entStamp(col, b, P, k);
        const okA = !!ea && ea[1] === pid, okB = !!eb && eb[1] === pid;
        const va = A.m ? A.m[k] : undefined, vb = B.m ? B.m[k] : undefined;
        const na = okA ? ea[0] : 0, nb = okB ? eb[0] : 0;
        if (!okA && !okB) continue;
        const v = (okA && (!okB || better(na, va, nb, vb))) ? va : vb;
        const added = Math.min(okA ? ea[2] : Infinity, okB ? eb[2] : Infinity);
        f[P + FS + k] = [Math.max(na, nb), pid, added];
        if (v !== undefined) { ents[k] = v; order[k] = added; }
      }
      const had = (A.ok && mapOf(a, P, sp)) || (B.ok && mapOf(b, P, sp));
      if (had || Object.keys(ents).length) writeMap(par, P, sp, ents, order);
    }
    out._f = f;
    return out;
  }

  /* the stamps for a write: prev is my copy before it (or null), next the new record, v its _v. Fields that changed get v,
     the rest keep the stamp they had. Returns undefined for collections that aren't field-merged. */
  function stamp(col, prev, next, v) {
    const spec = SPEC[col];
    if (!spec || !plain(next) || next._del) return undefined;
    if (prev && (prev._del || !plain(prev))) prev = null;
    const f = { "~": v };
    const keys = new Set([...slotKeys(col, prev), ...slotKeys(col, next)]);
    if (prev && fresh(prev)) for (const k of Object.keys(prev._f)) if (k !== "~" && !k.includes(FS) && !topMaps(col).has(k)) keys.add(k);
    for (const K of keys) {
      const old = prev ? topStamp(prev, K) : null;
      f[K] = old && same(slotVal(col, prev, K), slotVal(col, next, K)) ? old : [v];
    }
    for (const P of Object.keys(spec)) {
      const sp = spec[P];
      if (!parentOf(next, P)) continue;
      const pid = pidOf(next, P, sp), samePar = !!prev && parentOf(prev, P) && pidOf(prev, P, sp) === pid;
      const mN = mapOf(next, P, sp) || {}, mP = samePar ? mapOf(prev, P, sp) || {} : {};
      const ks = new Set([...Object.keys(mN), ...Object.keys(mP)]);
      if (samePar && fresh(prev)) for (const fk of Object.keys(prev._f)) if (fk.startsWith(P + FS) && prev._f[fk][1] === pid) ks.add(fk.slice(P.length + 1));
      for (const k of ks) {
        const old = samePar ? entStamp(col, prev, P, k) : null, a = mP[k], b = mN[k];
        if (old && old[1] === pid && same(a, b)) f[P + FS + k] = old;
        else f[P + FS + k] = [v, pid, old && old[1] === pid ? old[2] : v];
      }
    }
    return f;
  }

  // ---------------------------------------------------------------- the desync check
  const DIGEST_COLS = Object.keys(SPEC);
  const DIGEST_AGE = 3 * 3600e3, DIGEST_MAX = 24;
  /* fingerprints of the shared records that concern me: [[col, id, hash], …] */
  function digest(world, uid, t = Date.now()) {
    const out = [];
    for (const col of DIGEST_COLS) for (const [id, d] of Object.entries(world?.[col] || {})) {
      if (!d || d._del || t - (d._v || 0) > DIGEST_AGE) continue;
      if (uid && !JSON.stringify(d).includes(uid)) continue;
      out.push([col, id, hashDoc(d), d._v || 0]);
    }
    return out.sort((x, y) => y[3] - x[3]).slice(0, DIGEST_MAX).map((x) => x.slice(0, 3));   // the newest ones
  }
  /* their fingerprints against my copies: the records where we differ, as a little world { col: { id: doc } } */
  function differ(world, sums) {
    const out = {}; let n = 0;
    for (const s of Array.isArray(sums) ? sums.slice(0, DIGEST_MAX) : []) {
      const [col, id, h] = Array.isArray(s) ? s : [];
      if (!SPEC[col] || typeof id !== "string") continue;
      const mine = world?.[col]?.[id];
      if (!mine || hashDoc(mine) === h) continue;
      (out[col] = out[col] || {})[id] = mine; n++;
    }
    return n ? out : null;
  }
  /* after merging what a peer sent: the records where my copy now holds more than theirs (to send back) */
  function richer(world, theirs) {
    const out = {}; let n = 0;
    for (const [col, recs] of Object.entries(theirs || {})) for (const [id, d] of Object.entries(recs || {})) {
      const mine = world?.[col]?.[id];
      if (mine && !same(mine, d)) { (out[col] = out[col] || {})[id] = mine; n++; }
    }
    return n ? out : null;
  }

  // ---------------------------------------------------------------- shared dungeon rooms roll the same dice
  /* a party run's rooms and the leader's actions in them (replayed on members' phones) use a seed from the run, the room
     and the action, so the puzzle answer, the trap, the lock and what's found are the same on every phone */
  function install(DG) {
    if (!DG || DG.__netsync) return;
    DG.__netsync = true;
    const enter = DG.enterRoom, act = DG.act;
    DG.enterRoom = function (s, col, ...rest) {
      const d = s?.dungeon;
      if (!d?.run) return enter.call(this, s, col, ...rest);
      return seeded(seedOf(d.run, "room", d.cstep || 0, col), () => enter.call(this, s, col, ...rest));
    };
    DG.act = function (s, c, ...rest) {
      const d = s?.dungeon;
      if (!d?.run || !d.room) return act.call(this, s, c, ...rest);
      const step = d.cstep || 0;
      if (!d.nsAct || d.nsAct.step !== step) d.nsAct = { step, n: 0 };
      const n = d.nsAct.n++;
      return seeded(seedOf(d.run, "act", step, n, c), () => act.call(this, s, c, ...rest));
    };
  }
  if (typeof DUNGEONS !== "undefined") install(DUNGEONS);

  return { hash, rng, seedOf, seeded, canon, same, hashDoc, SPEC, mergeDoc, stamp, digest, differ, richer, install, fresh };
})();
if (typeof module !== "undefined") module.exports = NETSYNC;
