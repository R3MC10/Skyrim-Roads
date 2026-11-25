// GET /api/version: the newest game build (the latest GitHub release, build-N), so every client agrees on one number.
// Reads the release's small latest.json (a plain download, no API limit), else GitHub's API; keeps the answer a few
// minutes so a full server doesn't ask GitHub for every player. Needs no secrets. A stale answer beats none: if GitHub
// can't be reached, the last good one is served (marked stale).
"use strict";
const REPO = "R3MC10/Skyrim-Roads";
const TTL = 3 * 60e3, FAIL_TTL = 30e3;

function createVersion({ fetch = globalThis.fetch, now = () => Date.now(), repo = REPO, ttl = TTL } = {}) {
  let cache = null, failedAt = 0, pending = null;
  const num = (b) => Math.max(0, Math.floor(+b) || 0);
  async function ask() {
    try {
      const r = await fetch(`https://github.com/${repo}/releases/latest/download/latest.json`, { redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (r.ok) { const j = await r.json(); if (num(j.build)) return { build: num(j.build), date: j.date || null, source: "manifest" }; }
    } catch (e) { /* older release without latest.json, or GitHub slow: try the API */ }
    const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "roads-of-the-north-server" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`GitHub said ${r.status}`);
    const j = await r.json(), build = num(String(j.tag_name || "").replace(/\D+/g, ""));
    if (!build) throw new Error("no build number on the latest release");
    return { build, date: j.published_at || null, source: "api" };
  }
  /* -> { build, date, source, checkedAt, stale? } */
  async function get() {
    const t = now();
    if (cache && t - cache.checkedAt < ttl) return cache;
    if (cache && failedAt && t - failedAt < FAIL_TTL) return { ...cache, stale: true };
    if (!pending) pending = ask().then((v) => { cache = { ...v, checkedAt: now() }; failedAt = 0; return cache; })
      .catch((e) => { failedAt = now(); if (cache) return { ...cache, stale: true }; throw e; })
      .finally(() => { pending = null; });
    return pending;
  }
  return { get };
}
module.exports = { createVersion };
