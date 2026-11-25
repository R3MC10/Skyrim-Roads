/* gameupdate.js: game-only updates for the Windows app (installed and portable alike), like the phone app's.
   Each GitHub release has latest.json (scripts/latestjson.mjs): the build number, the PC shell number and the game
   files as one zip (game-shellS.zip) plus small patches from recent builds (game-shellS-fromN.zip, only what
   changed + _delta.json). This downloads the newest one in the background, checks its SHA-256, unpacks it next to
   the saves (userData/game-updates/b<build>) and main.js serves the game from there instead of the files inside
   the app. A new build is tried first: if its title screen doesn't come up (no ready() in time, or 3 starts
   without one) it's marked bad and the game goes back to the build before it. A newer app install (its own
   files are newer) wins over anything downloaded.
   Plain Node (no Electron) so tests/test_pcgameupdate.js can run it against a local server. */
const fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib");

const SAFE = /^[\w.-]+$/, HEX = /^[0-9a-f]{64}$/i;

/* ---------- zip reading (Info-ZIP "zip -r9" output: stored or deflated entries, no zip64) ---------- */
function readZip(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size, tailLen = Math.min(size, 65557), tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    let e = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("not a zip file");
    const count = tail.readUInt16LE(e + 10), cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
    if (count === 0xffff || cdOff === 0xffffffff) throw new Error("zip64 isn't supported");
    const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
    const out = [];
    for (let p = 0, i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error("damaged zip directory");
      const method = cd.readUInt16LE(p + 10), crc = cd.readUInt32LE(p + 16), csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
      const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32), loc = cd.readUInt32LE(p + 42);
      out.push({ name: cd.toString("utf8", p + 46, p + 46 + nlen), method, crc, csize, usize, loc });
      p += 46 + nlen + xlen + clen;
    }
    return out;
  } finally { fs.closeSync(fd); }
}
/* a zip entry name -> a safe relative path, or null (folders, absolute paths, "..") */
function safeRel(name) {
  const n = String(name).replace(/\\/g, "/");
  if (!n || n.endsWith("/") || n.startsWith("/") || /^[a-z]:/i.test(n)) return null;
  const parts = n.split("/");
  if (parts.some((x) => !x || x === "." || x === "..")) return null;
  return parts.join(path.sep);
}
function extractZip(file, dir) {
  const entries = readZip(file), fd = fs.openSync(file, "r"), names = [];
  try {
    for (const en of entries) {
      const rel = safeRel(en.name); if (!rel) { if (!en.name.endsWith("/")) throw new Error("bad file name in zip: " + en.name); continue; }
      const head = Buffer.alloc(30); fs.readSync(fd, head, 0, 30, en.loc);
      if (head.readUInt32LE(0) !== 0x04034b50) throw new Error("damaged zip entry: " + en.name);
      const start = en.loc + 30 + head.readUInt16LE(26) + head.readUInt16LE(28), raw = Buffer.alloc(en.csize);
      fs.readSync(fd, raw, 0, en.csize, start);
      let data;
      if (en.method === 0) data = raw;
      else if (en.method === 8) data = zlib.inflateRawSync(raw);
      else throw new Error("unknown zip packing in " + en.name);
      if (data.length !== en.usize) throw new Error("damaged file in zip: " + en.name);
      if (typeof zlib.crc32 === "function" && (zlib.crc32(data) >>> 0) !== en.crc) throw new Error("damaged file in zip: " + en.name);
      const dst = path.join(dir, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, data);
      names.push(rel.split(path.sep).join("/"));
    }
  } finally { fs.closeSync(fd); }
  return names;
}
/* copy a folder with plain reads and writes (Electron's fs reads inside app.asar this way, cpSync may not) */
function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyTree(s, d); else fs.writeFileSync(d, fs.readFileSync(s));
  }
}
const rm = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* in use: next start */ } };

/* latest.json -> { build, pcshell, date, notes, game: { url, size, sha256 }, deltas: { from: {url,size,sha256} } } */
function parseManifest(j, releases) {
  const build = Math.floor(+j?.build) || 0;
  if (build <= 0) throw new Error("latest.json looks wrong");
  const base = `${releases}/download/build-${build}/`;
  const file = (f) => (f && SAFE.test(f.name || "") && HEX.test(f.sha256 || "") && +f.size > 0 ? { url: base + f.name, size: +f.size, sha256: f.sha256.toLowerCase() } : null);
  const deltas = {};
  for (const [from, f] of Object.entries(j.deltas || {})) { const d = file(f); if (d && +from > 0) deltas[+from] = d; }
  const notes = String(j.notes || "").split(/\n-{3,}\s*\n/)[0].split("\n").filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l.trim())).join("\n").trim();
  return { build, pcshell: Math.floor(+j.pcshell) || 1, date: j.date || null, notes, game: file(j.game), deltas };
}

/* download url to file, checking size and SHA-256 as it goes. onProgress(done, total). Gives up after `stall` ms of silence. */
async function download(fetchFn, url, file, want, onProgress = () => {}, stall = 60000) {
  const ac = new AbortController();
  let timer = setTimeout(() => ac.abort(), stall);
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), stall); };
  const out = fs.openSync(file, "w"), hash = crypto.createHash("sha256");
  let done = 0;
  try {
    const res = await fetchFn(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`download: ${res.status}`);
    const total = want.size || +res.headers.get("content-length") || 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      kick();
      const b = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      fs.writeSync(out, b); hash.update(b); done += b.length;
      onProgress(done, total);
    }
  } catch (e) {
    throw new Error(ac.signal.aborted ? "the download stalled" : String(e?.message || e));
  } finally { clearTimeout(timer); fs.closeSync(out); }
  if (want.size && done !== want.size) throw new Error("the download was cut short");
  if (want.sha256 && hash.digest("hex") !== want.sha256) throw new Error("the download arrived damaged (checksum)");
}

/* opts: base (folder for downloads + state), bundledDir, bundledBuild, shell (this app's PC shell number),
   manifestUrl, releases (https://github.com/OWNER/REPO/releases), fetch, kind ("setup" | "portable") */
function createGameUpdater(opts) {
  const { base, bundledDir, bundledBuild = 0, shell = 1, kind = "setup" } = opts;
  const fetchFn = opts.fetch || globalThis.fetch;
  const STATE = path.join(base, "state.json");
  let st = { cur: null, prev: null, staged: null, trial: 0, starts: 0, bad: [] }, latest = null, busy = null;
  const load = () => { try { st = { ...st, ...JSON.parse(fs.readFileSync(STATE, "utf8")) }; } catch (e) { /* first start */ } if (!Array.isArray(st.bad)) st.bad = []; };
  const save = () => { try { fs.mkdirSync(base, { recursive: true }); fs.writeFileSync(STATE + ".tmp", JSON.stringify(st)); fs.renameSync(STATE + ".tmp", STATE); } catch (e) { /* read-only disk: no updates */ } };
  const dirOf = (e) => (e && SAFE.test(e.dir || "") ? path.join(base, e.dir) : null);
  const usable = (e) => { const d = dirOf(e); return !!(d && e.build > bundledBuild && fs.existsSync(path.join(d, "index.html"))); };
  const activeBuild = () => (st.cur ? st.cur.build : bundledBuild);
  const root = () => dirOf(st.cur) || bundledDir;
  /* remove downloaded folders nothing points at any more */
  function tidy() {
    const keep = new Set(["state.json", st.cur?.dir, st.prev?.dir, st.staged?.dir].filter(Boolean));
    let names = []; try { names = fs.readdirSync(base); } catch (e) { return; }
    for (const n of names) if (!keep.has(n) && !(busy && /^(tmp|dl|px)-/.test(n))) rm(path.join(base, n));
  }
  function rollback(why = "") {
    if (!st.trial) return false;
    const bad = st.trial;
    st.bad = [...st.bad.filter((b) => b !== bad), bad].slice(-10);
    st.cur = usable(st.prev) ? st.prev : null; st.prev = null; st.trial = 0; st.starts = 0;
    if (st.staged?.build === bad) st.staged = null;
    st.lastRollback = { build: bad, why: String(why).slice(0, 200) };
    save(); tidy();
    return true;
  }
  const api = {
    root, activeBuild, rollback,
    get state() { return JSON.parse(JSON.stringify(st)); },
    /* at app start: pick the folder to serve. A newer app install wins; downloaded files waiting from last time are
       switched to now; a build that keeps failing to start goes back to the one before. -> { root, build, rolledBack } */
    boot() {
      load();
      if (st.cur && !usable(st.cur)) { st.cur = null; st.trial = 0; st.starts = 0; }
      if (st.prev && !usable(st.prev)) st.prev = null;
      if (st.staged && (!usable(st.staged) || st.staged.build <= activeBuild())) st.staged = null;
      if (st.staged && !st.trial) api.apply();
      let rolledBack = false;
      if (st.trial) { st.starts = (st.starts || 0) + 1; if (st.starts > 2) rolledBack = rollback("didn't start 3 times"); }
      save(); tidy();
      return { root: root(), build: activeBuild(), rolledBack };
    },
    info() {
      return { build: activeBuild(), bundled: bundledBuild, shell, kind, staged: st.staged?.build || 0, trial: st.trial || 0, bad: [...st.bad], lastRollback: st.lastRollback || null };
    },
    async latest() {
      const res = await fetchFn(opts.manifestUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`latest.json: ${res.status}`);
      latest = parseManifest(JSON.parse(await res.text()), opts.releases);
      return latest;
    },
    /* -> { current, latest, newer, quick (game files only), bad, size, patch } */
    async check() {
      const lat = await api.latest(), cur = activeBuild();
      const quick = !!lat.game && lat.pcshell <= shell;
      const patch = quick ? lat.deltas[cur] || null : null;
      return { current: api.info(), latest: lat, newer: lat.build > cur, quick, bad: st.bad.includes(lat.build), size: patch ? patch.size : quick ? lat.game.size : 0, patch: !!patch };
    },
    /* download the newest game files (a patch from this build when there is one, else the whole game; a damaged
       patch falls back to the whole game) and keep them ready. onProgress(pct, text). -> { build } */
    download(onProgress = () => {}) {
      if (busy) return busy;
      busy = (async () => {
        const lat = latest || (await api.latest());
        if (!lat.game || lat.pcshell > shell) throw new Error("this build needs the new app");
        if (lat.build <= activeBuild()) throw new Error("already on the newest build");
        if (st.staged?.build === lat.build && usable(st.staged)) return { build: lat.build };
        fs.mkdirSync(base, { recursive: true });
        const from = activeBuild(), dir = `b${lat.build}`, tmp = path.join(base, `tmp-${lat.build}`), zip = path.join(base, `dl-${lat.build}.zip`);
        const pct = (a, b) => (b ? Math.min(99, Math.floor((a * 100) / b)) : -1);
        const finish = () => {
          if (!fs.existsSync(path.join(tmp, "index.html"))) throw new Error("the new files have no index.html");
          rm(path.join(base, dir)); fs.renameSync(tmp, path.join(base, dir)); rm(zip);
          st.staged = { build: lat.build, dir }; save();
          onProgress(100, "Ready");
          return { build: lat.build };
        };
        const patch = lat.deltas[from];
        if (patch) {
          try {
            rm(tmp); rm(zip);
            await download(fetchFn, patch.url, zip, patch, (a, b) => onProgress(pct(a, b), "Downloading"));
            const ex = path.join(base, `px-${lat.build}`); rm(ex);
            const names = extractZip(zip, ex);
            const meta = JSON.parse(fs.readFileSync(path.join(ex, "_delta.json"), "utf8"));
            if (+meta.from !== from || +meta.to !== lat.build) throw new Error("the patch is for another build");
            copyTree(root(), tmp);
            for (const n of names) if (n !== "_delta.json") { const d = path.join(tmp, ...n.split("/")); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ex, ...n.split("/")), d); }
            for (const r of meta.remove || []) { const rel = safeRel(r); if (rel) rm(path.join(tmp, rel)); }
            rm(ex);
            return finish();
          } catch (e) { rm(tmp); rm(zip); rm(path.join(base, `px-${lat.build}`)); onProgress(0, "Downloading the full game"); }
        }
        rm(tmp); rm(zip);
        try {
          await download(fetchFn, lat.game.url, zip, lat.game, (a, b) => onProgress(pct(a, b), "Downloading"));
          onProgress(99, "Unpacking");
          extractZip(zip, tmp);
          return finish();
        } catch (e) { rm(tmp); rm(zip); throw e; }
      })();
      const p = busy;
      p.finally(() => { if (busy === p) busy = null; }).catch(() => {});
      return p;
    },
    /* switch to the downloaded build (main.js reloads the window). The build before is kept to fall back on. */
    apply() {
      if (!st.staged || !usable(st.staged) || st.staged.build <= activeBuild()) { st.staged = null; save(); return false; }
      st.prev = st.cur; st.cur = st.staged; st.staged = null; st.trial = st.cur.build; st.starts = 0;
      save();
      return true;
    },
    /* the title screen drew on these files: they work. The build before isn't needed any more. */
    ready() {
      if (!st.trial || st.trial !== activeBuild()) return false;
      st.trial = 0; st.starts = 0; st.prev = null; st.bad = st.bad.filter((b) => b !== activeBuild());
      save(); tidy();
      return true;
    },
    trying: () => !!st.trial,
  };
  return api;
}

module.exports = { createGameUpdater, parseManifest, readZip, extractZip, safeRel, download };
