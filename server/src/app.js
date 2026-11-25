// The HTTP API: accounts, sessions (one device at a time) and cloud characters. See server/PLAN.md for the routes.
// createApp({ store, now, origins }) returns a (req, res) handler; index.js wraps it in a server.
"use strict";
const A = require("./auth");
const { createReports } = require("./reports");
const { createReportsReader } = require("./reportsread");
const { createVersion } = require("./version");

const LIMITS = {
  user: /^[A-Za-z0-9_-]{3,20}$/,
  passMin: 8, passMax: 200,
  charId: /^[A-Za-z0-9_-]{3,64}$/,
  maxChars: 12,
  body: 2.5 * 1024 * 1024,            // a save is usually 50–300 KB; this leaves plenty of room
  saveBytes: 2 * 1024 * 1024,
  idleMs: 30 * 24 * 3600e3,            // a device not seen for 30 days is signed out
  touchMs: 30e3,                       // last-seen is written at most this often
};

/* a small sliding-window limiter, per key */
function limiter(max, windowMs, clock) {
  const hits = new Map();
  return (key) => {
    const t = clock(), list = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(t); hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
    return true;
  };
}

class HttpError extends Error { constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; } }
const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra); };

function createApp({ store, now = () => Date.now(), origins = null, trustProxy = true, events = null, reportEnv = process.env, reportFetch = globalThis.fetch, versionFetch = globalThis.fetch, log = (m) => console.log(m) } = {}) {
  const loginByUser = limiter(10, 10 * 60e3, now), loginByIp = limiter(60, 10 * 60e3, now), registerByIp = limiter(20, 60 * 60e3, now);
  const report = createReports({ store, limiter: (max, ms) => limiter(max, ms, now), env: reportEnv, fetch: reportFetch, log, now });   // player reports → GitHub issues (reports.js)
  const reader = createReportsReader({ store, env: reportEnv, now });   // reading stored reports back, behind REPORTS_READ_KEY (reportsread.js)
  const version = createVersion({ fetch: versionFetch, now });   // the newest game build, from GitHub releases (version.js)
  const asHttp = async (fn) => { try { return await fn(); } catch (e) { if (e.status) fail(e.status, e.code, e.message); throw e; } };
  const allowed = origins && origins.length ? new Set(origins) : null;

  function cors(req, res) {
    const o = req.headers.origin;
    if (!o) return;
    if (!allowed || allowed.has(o)) { res.setHeader("Access-Control-Allow-Origin", allowed ? o : "*"); if (allowed) res.setHeader("Vary", "Origin"); }
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  function send(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(json) });
    res.end(json);
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const parts = [];
      req.on("data", (c) => { size += c.length; if (size > LIMITS.body) { reject(new HttpError(413, "too_big", "That's too much data.")); req.destroy(); } else parts.push(c); });
      req.on("end", () => {
        if (!parts.length) return resolve({});
        try { const v = JSON.parse(Buffer.concat(parts).toString("utf8")); resolve(v && typeof v === "object" ? v : {}); }
        catch { reject(new HttpError(400, "bad_json", "The request couldn't be read.")); }
      });
      req.on("error", reject);
    });
  }
  const ipOf = (req) => (trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
  const device = (b) => ({ deviceId: String(b.deviceId || "").slice(0, 80) || "unknown", deviceName: String(b.deviceName || "").replace(/[\u0000-\u001f]/g, "").slice(0, 60) || "Another device" });
  const pubAccount = (a) => ({ id: a.id, username: a.username, email: a.email || null, createdAt: a.createdAt });

  /* the signed-in session behind the request, or a 401 that tells the game why */
  async function auth(req) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
    if (!m) fail(401, "signed_out", "Please sign in.");
    return authToken(m[1]);
  }
  /* the same check for a bare token (the world connection, hub.js) */
  async function authToken(token) {
    if (!token) fail(401, "signed_out", "Please sign in.");
    const s = await store.sessionByToken(A.tokenHash(token));
    if (!s) fail(401, "signed_out", "Please sign in.");
    if (s.revokedAt) {
      if (s.revokedBy) fail(401, "session_replaced", `You're now playing on ${s.revokedBy}.`, { by: s.revokedBy, at: s.revokedAt });
      fail(401, "signed_out", "You signed out on this device.");
    }
    const t = now();
    if (t - s.lastSeen > LIMITS.idleMs) { await store.revokeSession(s.id, { now: t }); fail(401, "session_expired", "You were away a long time. Please sign in again."); }
    if (t - s.lastSeen > LIMITS.touchMs) await store.touchSession(s.id, t);
    const a = await store.accountById(s.accountId);
    if (!a) fail(401, "signed_out", "Please sign in.");
    return { session: s, account: a };
  }
  /* start a session on this device. Another device still signed in → ask first (409), unless takeover */
  async function startSession(a, b) {
    const d = device(b), t = now();
    const live = (await store.liveSessions(a.id)).filter((s) => t - s.lastSeen <= LIMITS.idleMs);
    const elsewhere = live.filter((s) => s.deviceId !== d.deviceId).sort((x, y) => y.lastSeen - x.lastSeen);
    if (elsewhere.length && !b.takeover) fail(409, "session_active", `You're playing on ${elsewhere[0].deviceName}.`, { device: elsewhere[0].deviceName, lastSeen: elsewhere[0].lastSeen });
    const token = A.newToken();
    const s = await store.createSession({ id: A.newId("ses"), accountId: a.id, tokenHash: A.tokenHash(token), ...d, now: t });
    const gone = await store.revokeSessions(a.id, { exceptId: s.id, by: d.deviceName, now: t });   // same device's old session, or the one taken over
    if (gone) events?.emit("revoked", { accountId: a.id, exceptSessionId: s.id, by: d.deviceName });   // its world connection closes too (hub.js)
    return { token, account: pubAccount(a), device: d.deviceName, took: elsewhere.length ? elsewhere[0].deviceName : null };
  }
  function checkCreds(b) {
    const username = String(b.username || "").trim(), password = String(b.password || "");
    return { username, password, lc: username.toLowerCase() };
  }

  const routes = {
    "GET /api/health": async () => ({ ok: true, store: store.kind, time: now() }),
    "GET /api/version": async () => { try { return await version.get(); } catch (e) { fail(503, "no_version", "Couldn't reach GitHub to see the newest build."); } },
    "POST /api/register": async (req, b) => {
      if (!registerByIp(ipOf(req))) fail(429, "slow_down", "Too many new accounts from here. Try again later.");
      const { username, password, lc } = checkCreds(b);
      if (!LIMITS.user.test(username)) fail(400, "bad_username", "Usernames are 3–20 letters, numbers, _ or -.");
      if (password.length < LIMITS.passMin) fail(400, "weak_password", `Use at least ${LIMITS.passMin} characters for your password.`);
      if (password.length > LIMITS.passMax) fail(400, "bad_password", "That password is too long.");
      if (lc === password.toLowerCase()) fail(400, "weak_password", "Your password can't be your username.");
      const a = await store.createAccount({ id: A.newId("acc"), username, usernameLc: lc, passHash: await A.hashPassword(password), now: now() });
      if (!a) fail(409, "username_taken", "That username is taken.");
      return startSession(a, b);
    },
    "POST /api/login": async (req, b) => {
      const { username, password, lc } = checkCreds(b);
      if (!loginByIp(ipOf(req)) || !loginByUser(lc)) fail(429, "slow_down", "Too many tries. Wait a few minutes and try again.");
      const a = lc ? await store.accountByName(lc) : null;
      if (!a) { await A.burn(password); fail(401, "bad_login", "Wrong username or password."); }
      if (!(await A.checkPassword(password, a.passHash))) fail(401, "bad_login", "Wrong username or password.");
      return startSession(a, b);
    },
    "POST /api/logout": async (req) => { const { session, account } = await auth(req); await store.revokeSession(session.id, { now: now() }); events?.emit("revoked", { accountId: account.id, exceptSessionId: null, by: null }); return { ok: true }; },
    "GET /api/session": async (req) => { const { session, account } = await auth(req); return { account: pubAccount(account), device: session.deviceName }; },
    "POST /api/report": async (req, b) => {
      try { return await report(b, ipOf(req)); }
      catch (e) { if (e.status) fail(e.status, e.code, e.message); throw e; }
    },
    "GET /api/reports": async (req) => asHttp(() => reader.list(req, new URL(req.url || "/", "http://x").searchParams, ipOf(req))),
    "GET /api/characters": async (req) => { const { account } = await auth(req); return { characters: (await store.listCharacters(account.id)).map(({ accountId, deletedAt, ...c }) => c) }; },
  };
  /* /api/characters/:id */
  async function character(req, method, id, b) {
    const { account } = await auth(req);
    if (!LIMITS.charId.test(id)) fail(400, "bad_id", "That character id isn't valid.");
    if (method === "GET") {
      const c = await store.getCharacter(id);
      if (!c || c.deletedAt || c.accountId !== account.id) fail(404, "not_found", "That character isn't on your account.");
      const { accountId, deletedAt, ...out } = c;
      return { character: out };
    }
    if (method === "PUT") {
      const data = b.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) fail(400, "bad_save", "That save couldn't be read.");
      const json = JSON.stringify(data);
      if (Buffer.byteLength(json) > LIMITS.saveBytes) fail(413, "too_big", "That save is too big.");
      const existing = await store.getCharacter(id);
      if (existing && existing.accountId !== account.id) fail(403, "not_yours", "That character belongs to another account.");
      if ((!existing || existing.deletedAt) && (await store.countCharacters(account.id)) >= LIMITS.maxChars) fail(409, "too_many", `An account holds up to ${LIMITS.maxChars} characters.`);
      const r = await store.saveCharacter({ id, accountId: account.id, name: String(data.name || "Nameless").slice(0, 40), level: Math.max(1, Math.min(999, data.level | 0 || 1)),
        race: data.race ? String(data.race).slice(0, 20) : null, json, baseVersion: b.baseVersion | 0, force: !!b.force, now: now() });
      if (r.notYours) fail(403, "not_yours", "That character belongs to another account.");
      if (r.conflict) { const { accountId, deletedAt, ...server } = r.server; fail(409, "version_conflict", "This character was played somewhere else since.", { server }); }
      return { version: r.version };
    }
    if (method === "DELETE") {
      if (!(await store.deleteCharacter(id, account.id, now()))) fail(404, "not_found", "That character isn't on your account.");
      return { ok: true };
    }
    fail(405, "bad_method", "Not allowed.");
  }

  const handle = async function handle(req, res) {
    cors(req, res);
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const path = (req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";
    try {
      const key = `${req.method} ${path}`;
      const m = /^\/api\/characters\/([^/]+)$/.exec(path);
      const rd = req.method === "POST" && /^\/api\/reports\/([^/]+)\/done$/.exec(path);
      if (rd) { send(res, 200, await asHttp(() => reader.done(req, decodeURIComponent(rd[1]), ipOf(req)))); return; }
      if (!routes[key] && !m) fail(404, "no_route", "Nothing here.");
      const b = req.method === "POST" || req.method === "PUT" ? await readBody(req) : {};
      const out = m ? await character(req, req.method, decodeURIComponent(m[1]), b) : await routes[key](req, b);
      send(res, 200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.code, message: e.message, ...e.extra });
      console.error(e);
      send(res, 500, { error: "server_error", message: "Something went wrong on the server." });
    }
  };
  handle.authToken = authToken;
  return handle;
}
module.exports = { createApp, LIMITS };
