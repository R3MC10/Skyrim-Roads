// Reading stored player reports back (the ones reports.js kept in the store because GitHub wasn't set up or failed).
//   GET  /api/reports?limit=50&since=<epoch ms>&open=1   newest first, limit up to 200
//   POST /api/reports/:id/done                            mark one as handled
// Both need the header "Authorization: Bearer <REPORTS_READ_KEY>". Without that env var the routes don't exist (404).
// The key is compared in constant time, never logged and never read from the URL. Wrong keys are rate limited per IP.
// scripts/reports.mjs is the small command-line reader for this.
"use strict";
const crypto = require("crypto");

const READ_LIMITS = { maxLimit: 200, defLimit: 50, failMax: 10, failWindowMs: 15 * 60e3, globalFailMax: 200 };
const ID = /^rep_[a-z0-9]{1,40}$/;

const digest = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest();
/* constant-time equality: both sides are hashed to the same length first, so length differences don't leak either */
function sameKey(given, key) { return crypto.timingSafeEqual(digest(given), digest(key)); }

/* what one stored report looks like to the reader */
function view(x) {
  const r = (x && x.report) || {}, info = r.info && typeof r.info === "object" ? r.info : {};
  const out = {
    id: x.id, at: x.at, done: x.doneAt != null, doneAt: x.doneAt ?? null,
    title: r.title || "", category: r.category || "bug", text: r.text || "",
    player: r.player || null, character: r.character || null,
    version: { build: info.build ?? null, notes: info.notes ?? null, appBuild: info.appBuild ?? null },
    platform: info.platform ?? null,
    info,
  };
  if (Array.isArray(r.log) && r.log.length) out.log = r.log;
  if (r.state != null) out.snapshot = r.state;
  return out;
}

/* createReportsReader({ store, env, now }) → { enabled(), list(req, query, ip), done(req, id, ip) } or throws { status, code, message } */
function createReportsReader({ store, env = process.env, now = () => Date.now() }) {
  const fails = new Map();          // ip → recent failed-try times
  let globalFails = [];
  const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
  const key = () => String(env.REPORTS_READ_KEY || "").trim();

  function recent(list) { const t = now(); return list.filter((x) => t - x < READ_LIMITS.failWindowMs); }
  function check(req, ip) {
    const k = key();
    if (!k) throw bad(404, "no_route", "Nothing here.");
    const mine = recent(fails.get(ip) || []);
    globalFails = recent(globalFails);
    if (mine.length >= READ_LIMITS.failMax || globalFails.length >= READ_LIMITS.globalFailMax) throw bad(429, "slow_down", "Too many wrong keys. Try again later.");
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
    if (!m || !sameKey(m[1], k)) {
      const t = now(); mine.push(t); fails.set(ip, mine); globalFails.push(t);
      if (fails.size > 5000) for (const [i, v] of fails) if (!recent(v).length) fails.delete(i);
      throw bad(401, "bad_key", "Wrong or missing key.");
    }
  }

  async function list(req, query, ip) {
    check(req, ip);
    let limit = READ_LIMITS.defLimit;
    if (query.has("limit")) {
      limit = Number(query.get("limit"));
      if (!Number.isInteger(limit) || limit < 1) throw bad(400, "bad_limit", "limit must be a whole number from 1 to 200.");
      limit = Math.min(limit, READ_LIMITS.maxLimit);
    }
    let since = null;
    if (query.has("since")) {
      const s = query.get("since");
      since = /^\d+$/.test(s) ? Number(s) : Date.parse(s);
      if (!Number.isFinite(since)) throw bad(400, "bad_since", "since must be a time (epoch ms or ISO date).");
    }
    const open = query.get("open") === "1";
    if (!store.listReports) return { reports: [] };
    const rows = await store.listReports(limit, { since, open });
    return { reports: rows.map(view), limit, since };
  }

  async function done(req, id, ip) {
    check(req, ip);
    if (!ID.test(id)) throw bad(400, "bad_id", "That report id isn't valid.");
    const at = now();
    if (!store.markReportDone || !(await store.markReportDone(id, at))) throw bad(404, "not_found", "No report with that id.");
    return { ok: true, id, doneAt: at };
  }

  return { enabled: () => !!key(), list, done };
}

module.exports = { createReportsReader, view, sameKey, READ_LIMITS };
