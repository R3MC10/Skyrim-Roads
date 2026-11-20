/* Character backups: the whole save as one text code you can copy, share, and paste back.
   Format: ROTN1.<checksum>.<deflated JSON, base64url>. Plus automatic copies of the last 3 saves on this device. */
const BACKUP = (() => {
  const PREFIX = "ROTN1";
  const AUTO_KEY = "rotn_backups";
  const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64 = (str) => { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  function crc32(bytes) {
    let c, crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) { c = (crc ^ bytes[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
    return ((crc ^ 0xffffffff) >>> 0).toString(36);
  }
  async function pipe(bytes, Stream, kind) {
    if (typeof Stream !== "function") return null;
    const res = new Response(new Blob([bytes]).stream().pipeThrough(new Stream(kind)));
    return new Uint8Array(await res.arrayBuffer());
  }
  async function make(save) {
    const raw = new TextEncoder().encode(JSON.stringify(save));
    const packed = await pipe(raw, window.CompressionStream, "deflate-raw");
    const body = packed ? b64(packed) : "u" + b64(raw);   // "u" = not compressed (very old browsers)
    return `${PREFIX}.${crc32(raw)}.${body}`;
  }
  /* -> save object, or throws an Error with a plain message */
  async function read(code) {
    const clean = String(code || "").replace(/\s+/g, "");
    const m = /^ROTN1\.([0-9a-z]+)\.(u?)([A-Za-z0-9_-]+)$/.exec(clean);
    if (!m) throw new Error("That doesn't look like a Roads of the North backup code. Make sure you copied all of it.");
    let raw;
    try { const bytes = unb64(m[3]); raw = m[2] ? bytes : await pipe(bytes, window.DecompressionStream, "deflate-raw"); }
    catch (e) { raw = null; }
    if (!raw) throw new Error("The code is damaged. Part of it may be missing.");
    if (crc32(raw) !== m[1]) throw new Error("The code is damaged (the check doesn't match). Part of it may be missing or changed.");
    let s;
    try { s = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { throw new Error("The code is damaged."); }
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.race || typeof s.level !== "number" || !s.skills) throw new Error("The code doesn't contain a character.");
    return s;
  }
  const autoList = () => { try { return JSON.parse(localStorage.getItem(AUTO_KEY) || "[]"); } catch (e) { return []; } };
  /* keeps the last 3 snapshots, at most one every 10 minutes */
  async function autoSave(save, force = false) {
    if (!save) return;
    const list = autoList(), last = list[0], now = Date.now();
    if (!force && last && now - last.t < 10 * 60000) return;
    const code = await make(save);
    if (last && last.code === code) return;
    list.unshift({ t: now, name: save.name, level: save.level, where: save.location || "", code });
    try { localStorage.setItem(AUTO_KEY, JSON.stringify(list.slice(0, 3))); } catch (e) { /* storage full or blocked */ }
  }
  return { make, read, autoList, autoSave };
})();
