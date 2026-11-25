// Read the player reports the server kept (GET /api/reports), newest first, or mark one handled.
//
//   REPORTS_READ_KEY=… node scripts/reports.mjs                  newest 20
//   REPORTS_READ_KEY=… node scripts/reports.mjs --limit 50 --open --since 2026-11-01 --full
//   REPORTS_READ_KEY=… node scripts/reports.mjs --done rep_abc123
//   … --json                                                     raw JSON instead
//
// REPORTS_SERVER defaults to the server the game uses (DEFAULT_SERVER in game/account.js).
// The key is only ever sent in the Authorization header; it is never printed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
function gameServer() {
  try {
    const src = fs.readFileSync(path.join(here, "../game/account.js"), "utf8");
    const m = /DEFAULT_SERVER\s*=\s*"([^"]+)"/.exec(src);
    if (m) return m[1];
  } catch { /* fall through */ }
  return "https://skyrim-roads-production.up.railway.app";
}

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
if (flag("--help") || flag("-h")) {
  console.log("node scripts/reports.mjs [--limit N] [--since <ms or ISO date>] [--open] [--full] [--json] | --done <id>\nNeeds REPORTS_READ_KEY in the environment; REPORTS_SERVER is optional.");
  process.exit(0);
}

const server = (process.env.REPORTS_SERVER || gameServer()).replace(/\/+$/, "");
const key = String(process.env.REPORTS_READ_KEY || "").trim();
if (!key) { console.error("Set REPORTS_READ_KEY in the environment (the same value as on the server)."); process.exit(2); }
const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };

async function call(method, p) {
  let res;
  try { res = await fetch(server + p, { method, headers }); }
  catch (e) { console.error(`Couldn't reach ${server}: ${e.cause?.code || e.message}`); process.exit(1); }
  let body = {}; try { body = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const why = { 401: "wrong key", 404: "not found (or REPORTS_READ_KEY isn't set on the server)", 429: "too many wrong tries, wait 15 minutes" }[res.status] || body.message || "";
    console.error(`Server answered ${res.status}${why ? ": " + why : ""}`);
    process.exit(1);
  }
  return body;
}

const when = (t) => new Date(t).toISOString().replace("T", " ").slice(0, 16) + " UTC";

const doneId = val("--done");
if (flag("--done")) {
  if (!doneId) { console.error("Usage: --done <report id>"); process.exit(2); }
  const r = await call("POST", `/api/reports/${encodeURIComponent(doneId)}/done`);
  console.log(`Marked ${r.id} as handled (${when(r.doneAt)}).`);
  process.exit(0);
}

const q = new URLSearchParams({ limit: String(val("--limit") || 20) });
if (val("--since")) q.set("since", val("--since"));
if (flag("--open")) q.set("open", "1");
const { reports = [] } = await call("GET", `/api/reports?${q}`);

if (flag("--json")) { console.log(JSON.stringify(reports, null, 2)); process.exit(0); }
if (!reports.length) { console.log(`No stored reports on ${server}.`); process.exit(0); }

const full = flag("--full");
console.log(`${reports.length} report(s) from ${server}, newest first:\n`);
for (const r of reports) {
  const ver = [r.version?.build != null ? "build " + r.version.build : null, r.version?.appBuild != null ? "app " + r.version.appBuild : null].filter(Boolean).join(", ") || "?";
  console.log(`${r.done ? "[done] " : ""}${r.id}  ${when(r.at)}  [${r.category}]  ${r.title}`);
  console.log(`  ${ver} · ${r.platform || "?"}${r.character ? " · " + r.character : ""}`);
  if (r.text) console.log("  " + (full ? r.text : r.text.slice(0, 300) + (r.text.length > 300 ? "…" : "")).replace(/\n/g, "\n  "));
  if (r.log?.length) console.log(full ? "  log:\n    " + r.log.join("\n    ") : `  log: ${r.log.length} lines (--full to show)`);
  if (r.snapshot != null) console.log(full ? "  snapshot: " + JSON.stringify(r.snapshot) : "  snapshot: yes (--full to show)");
  console.log("");
}
