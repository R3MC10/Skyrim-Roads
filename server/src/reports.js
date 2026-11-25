// Player reports (game/bugreport.js → POST /api/report). Each one becomes a GitHub issue labelled "player-report"
// (plus its kind: bug, balance, art, text or idea) in the game's repo, so Claude can pick it up and fix it.
// The GitHub token comes only from the GITHUB_REPORT_TOKEN env var; it is never logged or sent back.
// Without the token (or when GitHub fails) the report is kept in the store instead (reports table / memory).
"use strict";

const REPORT_LIMITS = {
  title: 120,
  text: 20 * 1024,           // what happened
  total: 300 * 1024,         // the whole report, log and snapshot included
  perHour: 5,                // reports per IP per hour
  issueBody: 60000,          // GitHub's limit is 65536 characters
};
const CATS = ["bug", "balance", "art", "text", "idea"];
const REPO = "R3MC10/Skyrim-Roads";

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
const noPing = (t) => t.replace(/@(?=\w)/g, "@​");            // a player's text never pings anyone on GitHub
const fence = (t) => t.replace(/```/g, "'''");                      // can't break out of a code block
/* a name (player or hero): one line, no control characters at all, at most 40 characters; empty → null */
const nameOf = (v) => { const t = typeof v === "string" || typeof v === "number" ? String(v).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) : ""; return t || null; };
/* a name shown in the issue's markdown: no pings, no HTML, no bold/links breaking out */
const mdName = (t) => noPing(String(t)).replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;")).replace(/([\\`*_[\]])/g, "\\$1");

function issueOf(r) {
  const player = nameOf(r.player), hero = nameOf(r.character);
  const info = r.info && typeof r.info === "object" ? r.info : {};
  const rows = Object.entries(info).slice(0, 30).map(([k, v]) => `- **${clean(k, 40)}**: ${noPing(clean(typeof v === "object" ? JSON.stringify(v) : v, 200))}`);
  if (r.character) rows.unshift(`- **character**: ${noPing(clean(r.character, 40))}`);
  const log = Array.isArray(r.log) ? r.log.slice(-40).map((l) => clean(l, 400)).join("\n") : "";
  let state = ""; try { state = JSON.stringify(r.state ?? null, null, 1); } catch { state = "null"; }
  if (state.length > 30000) state = state.slice(0, 30000) + "\n… (cut)";
  if (player) rows.unshift(`- **player**: ${noPing(player)}`);
  const from = player ? `**From:** ${mdName(player)}${hero ? ` (hero: ${mdName(hero)})` : ""}` : hero ? `**From:** hero ${mdName(hero)}` : null;
  const body = [
    ...(from ? [from, ""] : []),
    noPing(r.text || "_(no description)_"),
    "",
    "<details><summary>Game info, log and snapshot</summary>",
    "",
    rows.join("\n"),
    "",
    "**Recent log**",
    "```text", fence(noPing(log)) || "(empty)", "```",
    "",
    "**State snapshot**",
    "```json", fence(noPing(state)), "```",
    "</details>",
    "",
    "_Sent from the game's Report a problem window._",
  ].join("\n");
  return { title: `[Report] ${r.title}${player ? ` — ${noPing(player)}` : ""}`, body: body.slice(0, REPORT_LIMITS.issueBody), labels: ["player-report", r.category] };
}

/* createReports({ store, limiter, env, fetch, log }) → async (body, ip) => { ok, issue } or throws { status, code, message } */
function createReports({ store, limiter, env = process.env, fetch: fetchImpl = globalThis.fetch, log = (m) => console.log(m), repo = REPO, now = () => Date.now() }) {
  const perIp = limiter(REPORT_LIMITS.perHour, 60 * 60e3);
  const bad = (status, code, message) => Object.assign(new Error(message), { status, code });

  function validate(b) {
    let size = 0; try { size = Buffer.byteLength(JSON.stringify(b)); } catch { throw bad(400, "bad_report", "That report couldn't be read."); }
    if (size > REPORT_LIMITS.total) throw bad(413, "too_big", "That report is too big.");
    const title = clean(b.title, 1000).trim(), text = clean(b.text, REPORT_LIMITS.text + 1);
    if (title.length < 3 && text.trim().length < 3) throw bad(400, "empty_report", "Write a short title or a few words about what happened.");
    if (text.length > REPORT_LIMITS.text) throw bad(413, "too_long", "That description is too long.");
    return {
      title: (title || text.trim()).slice(0, REPORT_LIMITS.title).replace(/\s+/g, " "),
      text: text.trim(),
      category: CATS.includes(b.category) ? b.category : "bug",
      player: nameOf(b.player),          // the player's account name (or hero name); old clients don't send it
      character: b.character ? clean(b.character, 40) : null,
      info: b.info && typeof b.info === "object" && !Array.isArray(b.info) ? b.info : {},
      log: Array.isArray(b.log) ? b.log.slice(-40).map((l) => clean(l, 400)) : [],
      state: b.state && typeof b.state === "object" ? b.state : null,
    };
  }

  async function toGitHub(r, token) {
    const issue = issueOf(r);
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "roads-of-the-north-server", "Content-Type": "application/json" },
      body: JSON.stringify(issue),
    });
    if (!res.ok) { log(`report: GitHub answered ${res.status}, keeping it in the store`); return null; }
    const j = await res.json().catch(() => ({}));
    return Number.isInteger(j.number) ? j.number : null;
  }

  return async function report(b, ip) {
    if (!perIp(ip || "?")) throw bad(429, "slow_down", "That's a lot of reports. Try again in an hour.");
    const r = validate(b || {});
    const token = String(env.GITHUB_REPORT_TOKEN || "").trim();
    let issue = null;
    if (token && typeof fetchImpl === "function") {
      try { issue = await toGitHub(r, token); } catch (e) { log("report: couldn't reach GitHub, keeping it in the store"); }
    }
    if (issue == null) {
      if (store.saveReport) await store.saveReport({ id: "rep_" + now().toString(36) + Math.random().toString(36).slice(2, 8), at: now(), report: r });
      log(token ? "report stored (GitHub failed)" : "report stored (no token)");
    } else log(`report: issue #${issue}`);
    return { ok: true, issue };
  };
}

module.exports = { createReports, issueOf, nameOf, REPORT_LIMITS, CATS };
