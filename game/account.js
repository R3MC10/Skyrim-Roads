/* Accounts: sign in with a username and password, keep your characters on the server and play them on any device,
   one device at a time. [OURS] Server: server/ (plan in server/PLAN.md).
   Off unless a server address is known (DEFAULT_SERVER once the Railway server is live, or ?server=https://… for
   testing, remembered on this device). Signed out, the game works exactly as before.
   - Title menu → Account: create an account or sign in; your characters (play any of them here), upload this
     device's character, start a new one, sign out.
   - Signing in while another device is playing asks "You're playing on X. Play here instead?"; Play here signs the
     other device out, and that device is told the next time it talks to the server (a heartbeat every minute).
   - The character you play is saved to your account a few seconds after changes, when the app goes to the
     background, and retried when the connection comes back. If it was played somewhere else since (only possible
     after a takeover while offline), you choose which copy to keep.
   - Playing a character from your account puts it in this device's save slot (the character that was there is
     kept in the automatic backups) and gives this device the character's own world id, so you're the same person
     in the shared world on every device.
   Nothing here touches the game rules; it only moves saves. Passwords are never stored on the device. */
const ACCOUNT = (() => {
  const DEFAULT_SERVER = "https://skyrim-roads-production.up.railway.app";   // our server on Railway (server/); ?server=… overrides it for testing
  const DOM = typeof document !== "undefined" && typeof location !== "undefined" && typeof addEventListener !== "undefined";   // node tests load every file without a page
  const NS = DOM ? (location.search.match(/[?&]p=(\w+)/) || [])[1] || "" : "";   // tests: several "devices" in one browser
  const K = (k) => NS + "acct." + k;
  const get = (k) => { try { return JSON.parse(localStorage.getItem(K(k))); } catch { return null; } };
  const set = (k, v) => { try { if (v == null) localStorage.removeItem(K(k)); else localStorage.setItem(K(k), JSON.stringify(v)); } catch { /* storage blocked */ } };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rand = (n) => { const a = new Uint8Array(n); (globalThis.crypto || {}).getRandomValues?.(a); return [...a].map((x) => (x % 36).toString(36)).join("") || Math.random().toString(36).slice(2, 2 + n); };
  const SYNC_DELAY = 6e3, SYNC_MAX = 30e3, BEAT = 60e3, RETRY = 60e3;

  // ---------------------------------------------------------------- where, who, which device
  function server() {
    if (DOM) { const q = (location.search.match(/[?&]server=([^&]+)/) || [])[1]; if (q) set("server", decodeURIComponent(q)); }
    const auto = !(DOM && navigator.webdriver);   // like pictures and audio: under browser automation only with ?server=… (keeps screen tests offline)
    return String(get("server") || (auto ? DEFAULT_SERVER : "") || "").replace(/\/+$/, "");
  }
  const on = () => !!server();
  function deviceId() { let d = get("device"); if (!d) { d = "dev-" + rand(12); set("device", d); } return d; }
  function deviceName() {
    const own = get("deviceName"); if (own) return own;
    const ua = DOM ? navigator.userAgent || "" : "";
    const app = DOM && window.Capacitor?.isNativePlatform?.();
    const kind = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
      : /Windows/.test(ua) ? "Windows PC" : /Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux PC" : "Browser";
    return kind + (app ? "" : " (web)");
  }
  const signedIn = () => on() && !!get("token");
  const user = () => get("user");
  const linked = () => get("char");   // { id, version, name } the character this device plays from the account

  // ---------------------------------------------------------------- talking to the server
  let ctx = { getSave: () => null, rerender: () => {}, onTitle: () => false };
  async function api(method, path, body, { auth = true, timeout = 15000 } = {}) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(() => ctl?.abort(), timeout);
    try {
      const tok = get("token");
      const r = await fetch(server() + path, { method, headers: { "Content-Type": "application/json", ...(auth && tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: ctl?.signal });
      let j = {}; try { j = await r.json(); } catch { /* no body */ }
      if (r.status === 401 && auth && tok) lost(j);
      return { status: r.status, ok: r.ok, ...j };
    } catch (e) {
      return { status: 0, ok: false, error: "offline", message: "Can't reach the server. Check your connection and try again." };
    } finally { clearTimeout(t); }
  }
  /* the session ended: another device took over, you signed out elsewhere, or it expired */
  function lost(j) {
    set("token", null);
    if (j.error === "session_replaced") set("kicked", { by: j.by || "another device", at: j.at || Date.now() });
    else note = j.message || "Please sign in again.";
    stopBeat();
    if (j.error === "session_replaced" && !ctx.onTitle()) wall();
    ctx.rerender();
  }

  // ---------------------------------------------------------------- sign up, sign in, sign out
  let form = { mode: "in", username: "", busy: false }, ask = null, note = "", chars = null, charsErr = "";
  async function enter(mode, username, password, takeover = false) {
    form = { ...form, mode, username, busy: true }; note = ""; ctx.rerender();
    const r = await api("POST", mode === "up" ? "/api/register" : "/api/login", { username, password, deviceId: deviceId(), deviceName: deviceName(), takeover }, { auth: false });
    form.busy = false;
    if (r.status === 409 && r.error === "session_active") { ask = { username, password, device: r.device, lastSeen: r.lastSeen }; ctx.rerender(); return r; }
    ask = null;
    if (!r.ok) { note = r.message || "That didn't work."; ctx.rerender(); return r; }
    set("token", r.token); set("user", { username: r.account.username, id: r.account.id }); set("kicked", null);
    note = r.took ? `Playing here now. ${r.took} has been signed out.` : mode === "up" ? `Welcome, ${r.account.username}! Your account is ready.` : "";
    startBeat(); rejoin();
    await refresh();
    // this device's character was linked before: catch up with anything newer on the account
    const l = linked(); if (l) await checkNewer(l);
    return r;
  }
  async function signOut() {
    await flush();
    await api("POST", "/api/logout");
    set("token", null); set("char", null); set("kicked", null); chars = null; note = "Signed out. The character on this device stays here."; stopBeat(); rejoin(); ctx.rerender();
  }
  /* switch the shared world between our server (signed in) and phone-to-phone (signed out), without a reload */
  function rejoin() { try { if (typeof Store !== "undefined" && Store.mode === "p2p" && Store.joinWorld) Store.joinWorld(Store.worldCode || "NORTH"); } catch (e) { console.warn("world switch", e); } }
  async function refresh() {
    if (!signedIn()) { chars = null; return; }
    const r = await api("GET", "/api/characters");
    if (r.ok) { chars = r.characters; charsErr = ""; } else if (r.status !== 401) charsErr = r.message || "Couldn't load your characters.";
    ctx.rerender();
  }

  // ---------------------------------------------------------------- characters
  function storeKey(k) { return NS + k; }
  function putLocal(data, id) {
    try {
      localStorage.setItem(storeKey("sk.uid"), JSON.stringify(id));
      if (data) localStorage.setItem(storeKey("sk.save"), JSON.stringify({ ...data, id })); else localStorage.removeItem(storeKey("sk.save"));
    } catch (e) { return false; }
    return true;
  }
  async function keepCopy() { const S = ctx.getSave(); if (S && typeof BACKUP !== "undefined") { try { await BACKUP.autoSave(S, true); } catch { /* best effort */ } } }
  /* while a character is swapped into this device's save slot, the game must not save over it on the way out */
  let hold = false;
  const holding = () => hold;
  function reloadToMenu() { hold = true; try { sessionStorage.setItem("rotn_open", "menu"); } catch { /* ignore */ } location.reload(); }
  /* the save as text with its keys in order, so two copies can be compared (the server's database reorders keys) */
  /* Saves this device sent since the account last confirmed one. A save can reach the server while its reply is lost
     (the app went to the background, the signal dropped, the 15 s limit ran out); the next save then looks out of date.
     If the account's copy is one of ours, it was never "played somewhere else": take its number and carry on. */
  const fp = (data) => { const t = stable(data); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + "." + t.length; };
  function sentAdd(id, data) { const o = get("sent"); const list = o && o.id === id ? o.list : []; list.push(fp(data)); set("sent", { id, list: list.slice(-40) }); }
  const sentClear = () => set("sent", null);
  /* the account's copy of id, and whether this device sent it ({ mine, version, data, ... } or null when unreachable) */
  async function accountCopy(id) {
    const r = await api("GET", "/api/characters/" + encodeURIComponent(id));
    if (!r.ok) return null;
    const o = get("sent"), mine = !!(o && o.id === id && o.list.includes(fp(r.character.data)));
    return { mine, ...r.character };
  }
  const extra = (d) => (d && typeof d === "object" ? { gold: d.gold } : {});
  const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",")}}` : JSON.stringify(v));
  /* Before this device's character leaves the save slot, make sure it lives on somewhere besides the 3 automatic
     backups: on the account (uploaded now if it never was), or the player chooses between two different copies.
     next = what to do once it's safe ({ play: id } or { fresh: true }). Returns true when it's safe to go on. */
  async function secure(next) {
    const S = ctx.getSave(); if (!S || !S.id) return true;
    await refresh();
    const onAcct = (chars || []).find((c) => c.id === S.id), l = linked();
    if (onAcct && l && l.id === S.id) {   // the character this device plays from the account: save the last bits first
      await flush();
      if (conflict) { conflict.next = next; showConflict(); return false; }
      return !get("dirty") || (note = "Couldn't save to your account just now. Try again in a moment.", ctx.rerender(), false);
    }
    if (!onAcct) {   // only on this device: put it on the account before it leaves the slot
      note = `Saving ${S.name} to your account first…`; ctx.rerender();
      const r = await api("PUT", "/api/characters/" + encodeURIComponent(S.id), { data: S, baseVersion: 0 });
      if (r.ok || r.error === "not_yours") { await refresh(); return true; }   // not_yours: it's safe on the account it belongs to
      note = r.status === 0 ? `${S.name} is only on this device and there's no connection to save it to your account. Try again when you're online.`
        : r.error === "too_many" ? `${S.name} is only on this device, and your account is full (12 characters). Nothing was changed.`
        : `${S.name} couldn't be saved to your account (${r.message || "error"}), so nothing was changed.`;
      ctx.rerender(); return false;
    }
    // on the account, but this device played it while not linked (signed out or offline): the same, or different?
    const r = await api("GET", "/api/characters/" + encodeURIComponent(S.id));
    if (!r.ok) { note = r.message || "Couldn't check your account. Try again."; ctx.rerender(); return false; }
    if (stable(r.character.data) === stable({ ...S, id: S.id })) return true;
    conflict = { server: onAcct, local: local(S), next }; showConflict(); return false;
  }
  /* play a character from the account on this device */
  async function play(id, { skip = false } = {}) {
    const S = ctx.getSave(), l = linked();
    const sum = (chars || []).find((c) => c.id === id);
    if (S && S.id === id && l && l.id === id && sum && sum.version === l.version) { note = `${S.name} is ready. Tap Continue.`; ctx.rerender(); return true; }   // already here and up to date
    if (!skip && S && S.id !== id && !(await secure({ play: id }))) return false;
    if (!skip && S && S.id === id && !(l && l.id === id)) {   // this device has its own copy of this character (played while not linked)
      const r = await api("GET", "/api/characters/" + encodeURIComponent(id));
      if (!r.ok) { note = r.message || "Couldn't check your account. Try again."; ctx.rerender(); return false; }
      if (stable(r.character.data) !== stable({ ...S, id })) { conflict = { server: { ...(sum || {}), id, name: r.character.name, level: r.character.level, updatedAt: r.character.updatedAt }, local: local(S), next: { play: id } }; showConflict(); return false; }
      set("char", { id, version: r.character.version, name: r.character.name }); set("dirty", null);   // the same: just link this device to it
      note = `${S.name} is ready. Tap Continue.`; await refresh(); return true;
    }
    note = "Loading your character…"; ctx.rerender();
    const r = await api("GET", "/api/characters/" + encodeURIComponent(id));
    if (!r.ok) { note = r.message || "Couldn't load that character."; ctx.rerender(); return false; }
    await flush(); await keepCopy();
    hold = true;
    if (!putLocal(r.character.data, id)) { hold = false; note = "This device has no room to store the character."; ctx.rerender(); return false; }
    set("char", { id, version: r.character.version, name: r.character.name }); set("dirty", null);
    reloadToMenu();
    return true;
  }
  /* put this device's character on the account */
  async function upload(force = false) {
    const S = ctx.getSave(); if (!S) return;
    note = "Uploading…"; ctx.rerender();
    const r = await api("PUT", "/api/characters/" + encodeURIComponent(S.id), { data: S, baseVersion: 0, force });
    if (r.status === 409 && r.error === "version_conflict") { conflict = { server: r.server, local: local(S), upload: true }; note = ""; ctx.rerender(); showConflict(); return r; }
    if (!r.ok) { note = r.message || "Upload failed."; ctx.rerender(); return r; }
    set("char", { id: S.id, version: r.version, name: S.name }); set("dirty", null); conflict = null;
    note = `${S.name} is on your account now. Play them from any device.`;
    await refresh();
    return r;
  }
  /* a fresh character on the account: a new world id, an empty slot, then the usual character creation */
  async function newCharacter({ skip = false } = {}) {
    if (!skip && !(await secure({ fresh: true }))) return false;
    await flush(); await keepCopy();
    hold = true;
    const id = "local-" + rand(10);
    putLocal(null, id);
    set("char", { id, version: 0, name: "" }); set("dirty", null);
    reloadToMenu();
  }

  // ---------------------------------------------------------------- saving to the account
  let syncT = 0, firstDirty = 0, lastJson = null, syncing = null, conflict = null, lastSync = get("lastSync") || 0, syncNote = "";
  /* called by store.js after every local save */
  function onSave(state, json) {
    const l = linked();
    if (!signedIn() || !l || !state || state.id !== l.id || conflict) return;
    lastJson = json || JSON.stringify(state);
    set("dirty", Date.now()); set("playedAt", { id: state.id, at: Date.now() });
    if (!firstDirty) firstDirty = Date.now();
    clearTimeout(syncT);
    syncT = setTimeout(flush, Date.now() - firstDirty > SYNC_MAX ? 0 : SYNC_DELAY);
  }
  async function flush() {
    clearTimeout(syncT); syncT = 0;
    if (syncing) return syncing;
    const l = linked();
    if (!signedIn() || !l || conflict) return;
    let json = lastJson;
    if (!json && get("dirty")) { const S = ctx.getSave(); if (S && S.id === l.id) json = JSON.stringify(S); }
    if (!json) return;
    syncing = (async () => {
      const data = JSON.parse(json);
      sentAdd(l.id, data);
      const r = await api("PUT", "/api/characters/" + encodeURIComponent(l.id), { data, baseVersion: l.version });
      if (r.ok) {
        sentClear();
        set("char", { ...l, version: r.version, name: JSON.parse(json).name || l.name });
        if (lastJson === json) { lastJson = null; set("dirty", null); }
        firstDirty = 0; lastSync = Date.now(); set("lastSync", lastSync); syncNote = "";
      } else if (r.status === 409 && r.error === "version_conflict") {
        const c = await accountCopy(l.id);
        if (c && c.mine && c.version > l.version) { set("char", { ...linked(), version: c.version }); sentClear(); syncT = setTimeout(flush, 0); return; }   // our own save whose reply got lost: upload again on top of it
        if (!c && r.server) { syncNote = "Not saved to your account yet: no connection. It will try again."; syncT = setTimeout(flush, RETRY); return; }   // can't tell yet: ask again later rather than guess
        const S = ctx.getSave(); conflict = { server: { ...r.server, ...extra(c?.data) }, local: local(S) }; showConflict();
      } else if (r.status === 0) { syncNote = "Not saved to your account yet: no connection. It will try again."; syncT = setTimeout(flush, RETRY); }
      else if (r.status !== 401) syncNote = r.message || "Saving to your account failed.";
    })().finally(() => { syncing = null; });
    return syncing;
  }
  /* after signing in again: is the account's copy newer than what this device has? */
  async function checkNewer(l) {
    const r = await api("GET", "/api/characters");
    const c = r.ok && r.characters.find((x) => x.id === l.id);
    if (c && c.version > l.version) {
      const a = await accountCopy(l.id);
      if (a && a.mine) { set("char", { ...l, version: a.version }); sentClear(); return; }   // only our own lost save
      const S = ctx.getSave(); conflict = { server: { ...c, ...extra(a?.data) }, local: local(S) }; showConflict();
    }
  }

  // ---------------------------------------------------------------- heartbeat: notices a takeover
  let beatT = 0;
  function startBeat() {
    stopBeat();
    if (!signedIn() || !DOM) return;
    beatT = setInterval(() => { if (!document.hidden && signedIn()) api("GET", "/api/session"); }, BEAT);
  }
  function stopBeat() { clearInterval(beatT); beatT = 0; }

  // ---------------------------------------------------------------- what the screens show
  const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 90 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 * 2 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };
  const raceName = (r) => (typeof D !== "undefined" && D.RACES?.[r]?.name) || r || "";
  function menuSub() { const u = user(); return signedIn() && u ? `Signed in as ${u.username}` : get("kicked") ? "Signed out (playing elsewhere)" : "Keep your characters on every device"; }
  /* the Account page on the title screen */
  function pageHTML() {
    const k = get("kicked"), S = ctx.getSave(), u = user();
    const msg = note ? `<p class="acnote" role="status">${esc(note)}</p>` : "";
    if (ask) return `<h2>Play here?</h2>
      <p>You're playing on <b>${esc(ask.device)}</b> (last seen ${ago(ask.lastSeen)}). Your account can play on one device at a time.</p>
      <p class="sub">If you play here, ${esc(ask.device)} is signed out. Its last progress is already saved to your account.</p>
      <button class="btn pri" data-acct="takeover">Play here</button><button class="btn" data-acct="keep">Keep playing there</button>`;
    if (!signedIn()) {
      const up = form.mode === "up";
      return `<h2>${up ? "Create account" : "Sign in"}</h2>
        ${k ? `<p class="acnote warn" role="status">You were signed out here because you started playing on <b>${esc(k.by)}</b>. Sign in to play here instead.</p>` : ""}
        <p class="sub">${up ? "Just a name and a password: no email needed. Your characters are kept on the server so you can play them on any device." : "Play your characters on any device, one at a time."}</p>
        <label class="acfield"><span>Username</span><input id="acu" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" value="${esc(form.username || u?.username || "")}" placeholder="3–20 letters or numbers"></label>
        <label class="acfield"><span>Password</span><input id="acp" type="password" autocomplete="${up ? "new-password" : "current-password"}" maxlength="200" placeholder="${up ? "At least 8 characters" : ""}"></label>
        ${up ? `<label class="acfield"><span>Password again</span><input id="acp2" type="password" autocomplete="new-password" maxlength="200"></label>` : ""}
        ${msg}
        <button class="btn pri" data-acct="${up ? "register" : "login"}" ${form.busy ? "disabled" : ""}>${form.busy ? "One moment…" : up ? "Create account" : "Sign in"}</button>
        <button class="linkbtn acswap" data-acct="${up ? "mode-in" : "mode-up"}">${up ? "I already have an account" : "New here? Create an account"}</button>
        <p class="sub acfine">There's no email, so keep your password safe: it can't be reset yet.</p>`;
    }
    const l = linked(), list = chars || [];
    const local = S && !list.some((c) => c.id === S.id) ? S : null;
    const status = l && S && S.id === l.id ? (syncNote ? `<p class="acnote warn">${esc(syncNote)}</p>` : `<p class="sub">${esc(S.name)} is saved to your account${lastSync ? ` (last ${ago(lastSync)})` : ""}.</p>`) : "";
    const rows = list.map((c) => {
      const here = S && S.id === c.id;
      return `<div class="acchar${here ? " here" : ""}"><div class="t"><b>${esc(c.name)}</b><span>Level ${c.level}${c.race ? " · " + esc(raceName(c.race)) : ""} · ${here ? "on this device" : "played " + ago(c.updatedAt)}</span></div>
        <button class="btn ${here && l?.id === c.id ? "" : "pri"}" data-acct="play" data-id="${esc(c.id)}">${here && l?.id === c.id ? "Playing" : "Play here"}</button></div>`;
    }).join("");
    return `<h2>Your account</h2>
      <p class="sub">Signed in as <b>${esc(u?.username || "")}</b> on ${esc(deviceName())}.</p>
      ${msg}${status}
      <h3>Your characters</h3>
      ${charsErr ? `<p class="acnote warn">${esc(charsErr)}</p>` : chars == null ? `<p class="sub">Loading…</p>` : rows || `<p class="sub">No characters on your account yet.</p>`}
      ${local ? `<div class="acchar local"><div class="t"><b>${esc(local.name)}</b><span>Level ${local.level} · only on this device</span></div><button class="btn pri" data-acct="upload">Upload</button></div>` : ""}
      <button class="btn" data-acct="new">New character</button>
      <button class="btn" data-acct="signout">Sign out</button>`;
  }
  /* "Start over?" text when signed in: nothing is lost, it stays on the account */
  function newCharText(S) {
    if (!signedIn()) return null;
    const l = linked();
    return l && S && l.id === S.id ? `${esc(S.name)} stays on your account; you can play them again from Account. The new character gets its own place on your account.` : null;
  }

  // ---------------------------------------------------------------- dialogs over the game (signed out elsewhere, two copies)
  function overlay(html) {
    if (!DOM) return;
    let el = document.getElementById("acctwall");
    if (!el) { el = document.createElement("div"); el.id = "acctwall"; el.className = "acwall"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
    el.innerHTML = `<div class="acwall-in">${html}</div>`;
    el.querySelector("button, input")?.focus();
  }
  const closeOverlay = () => document.getElementById("acctwall")?.remove();
  function wall(err = "") {
    const k = get("kicked"); if (!k) return;
    overlay(`<h2>Playing on another device</h2>
      <p>You started playing on <b>${esc(k.by)}</b>, so this device was signed out. Your progress there is saved to your account.</p>
      <label class="acfield"><span>Password for ${esc(user()?.username || "")}</span><input id="acwp" type="password" autocomplete="current-password"></label>
      ${err ? `<p class="acnote warn" role="status">${esc(err)}</p>` : ""}
      <button class="btn pri" data-acct="reclaim">Play here instead</button>
      <button class="btn" data-acct="offline">Keep playing here, offline</button>
      <p class="sub">Offline, this device's character stops saving to your account.</p>`);
  }
  function wallNote(t) { const el = document.querySelector("#acctwall .acwall-in"); if (el) { el.querySelector(".acnote")?.remove(); el.insertAdjacentHTML("beforeend", `<p class="acnote warn" role="status">${esc(t)}</p>`); } }
  /* this device's copy for the choice screen: level, gold and when it was last played here */
  function local(S) { const p = get("playedAt"); return { name: S?.name, level: S?.level, gold: S?.gold, at: p && S && p.id === S.id ? p.at : 0 }; }
  function showConflict() {
    if (!conflict) return;
    const sv = conflict.server, lc = conflict.local || {};
    const gold = (g) => (typeof g === "number" ? ` · ${Math.floor(g)} gold` : "");
    const cloudNew = !lc.at || (sv.updatedAt || 0) > lc.at;   // which copy was played last (the device's own clock vs the server's: close enough to pick a default)
    const tag = '<em class="acnew">Newest</em>';
    const bCloud = `<button class="btn${cloudNew ? " pri" : ""}" data-acct="usecloud">Use the account copy</button>`;
    const bHere = `<button class="btn${cloudNew ? "" : " pri"}" data-acct="usehere">Keep this device's copy</button>`;
    overlay(`<h2>Two copies of ${esc(sv.name)}</h2>
      <p>${conflict.next ? `The ${esc(sv.name)} on this device isn't the same as the one on your account. Which one should be kept?` : `${esc(sv.name)} was played on another device after this one last saved.`}</p>
      <div class="accmp"><div${cloudNew ? ' class="on"' : ""}><b>On your account ${cloudNew ? tag : ""}</b><span>Level ${sv.level}${gold(sv.gold)}</span><span>played ${ago(sv.updatedAt)}</span></div><div${cloudNew ? "" : ' class="on"'}><b>On this device ${cloudNew ? "" : tag}</b><span>Level ${lc.level ?? "?"}${gold(lc.gold)}</span>${lc.at ? `<span>played ${ago(lc.at)}</span>` : ""}</div></div>
      ${cloudNew ? bCloud + bHere : bHere + bCloud}
      <p class="sub">Nothing is lost: the copy you don't keep goes into this device's automatic backups (Settings → Restore).</p>`);
  }

  // ---------------------------------------------------------------- clicks
  async function onClick(e) {
    const b = e.target.closest?.("[data-acct]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.acct, val = (id) => document.getElementById(id)?.value || "";
    if (typeof SOUND !== "undefined") SOUND.fx("click");
    if (a === "mode-in" || a === "mode-up") { form = { mode: a === "mode-up" ? "up" : "in", username: val("acu"), busy: false }; note = ""; return ctx.rerender(); }
    if (a === "login") return enter("in", val("acu").trim(), val("acp"));
    if (a === "register") {
      if (val("acp") !== val("acp2")) { form.username = val("acu"); note = "The two passwords don't match."; return ctx.rerender(); }
      return enter("up", val("acu").trim(), val("acp"));
    }
    if (a === "takeover" && ask) { const { username, password } = ask; return enter("in", username, password, true); }
    if (a === "keep") { const d = ask?.device; ask = null; note = d ? `OK, keep playing on ${d}.` : ""; return ctx.rerender(); }
    if (a === "play") return play(b.dataset.id);
    if (a === "upload") return upload();
    if (a === "new") return newCharacter();
    if (a === "signout") return signOut();
    if (a === "reclaim") {
      const r = await enter("in", user()?.username || "", val("acwp"), true);   // also checks for a newer copy on the account
      if (r.ok) { if (!conflict) closeOverlay(); } else wall(r.message || "That didn't work.");
      return;
    }
    if (a === "offline") { set("kicked", null); set("char", null); closeOverlay(); rejoin(); ctx.rerender(); return; }
    if (a === "usecloud" && conflict) {   // the device's copy goes to its automatic backups (play/keepCopy), the account's copy is used
      const c = conflict, id = c.server.id || linked()?.id; conflict = null; closeOverlay();
      if (!signedIn()) return;
      chars = null;
      if (c.next?.play) { await keepCopy(); return play(c.next.play, { skip: true }); }   // (play() keeps a copy too when it swaps)
      if (c.next?.fresh) return newCharacter({ skip: true });
      if (id) await play(id, { skip: true });
      return;
    }
    if (a === "usehere" && conflict) {   // the account's copy is downloaded into this device's backups first, then replaced
      const c = conflict, l = linked(), S = ctx.getSave(), id = c.server.id || l?.id || S?.id;
      const old = await api("GET", "/api/characters/" + encodeURIComponent(id));
      if (!old.ok) { wallNote(old.status === 0 ? "No connection: nothing was changed. Try again when you're online." : old.message || "Couldn't reach your account."); return; }
      if (typeof BACKUP !== "undefined") { try { await BACKUP.autoSave(old.character.data, true); } catch { /* best effort, still in the account's copy below until replaced */ } }
      conflict = null; closeOverlay();
      const r = await api("PUT", "/api/characters/" + encodeURIComponent(id), { data: S, baseVersion: 0, force: true });
      if (!r.ok) { note = r.message || "Couldn't save this device's copy."; ctx.rerender(); return; }
      set("char", { id: S.id, version: r.version, name: S.name }); set("dirty", null); sentClear(); lastJson = null; note = `Kept this device's ${S.name}. The account's old copy is in this device's backups.`;
      await refresh();
      if (c.next?.play) return play(c.next.play, { skip: true });
      if (c.next?.fresh) return newCharacter({ skip: true });
      return;
    }
  }

  /* ui.js calls this once at boot: how to read the save and redraw the title screen */
  function init(c) {
    ctx = { ...ctx, ...c };
    if (!on() || !DOM) return;
    if (!init.done) {
      init.done = true;
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target?.closest?.(".acfield")) { const btn = document.querySelector('[data-acct="login"],[data-acct="register"],[data-acct="reclaim"]'); btn?.click(); } });
      const away = () => { if (document.hidden) flush(); };
      document.addEventListener("visibilitychange", away);
      addEventListener("pagehide", () => flush());
      addEventListener("online", () => flush());
    }
    if (signedIn()) { startBeat(); refresh(); api("GET", "/api/session"); if (get("dirty")) flush(); }
    else if (get("kicked") && linked()) setTimeout(() => { if (!ctx.onTitle()) wall(); }, 0);
  }
  /* servernet.js: the session token for the world connection, and what to do when the server closes it for good */
  const token = () => get("token");
  function lostSession(j) { if (get("token")) lost(j || { error: "signed_out" }); }
  return { on, init, holding, token, lostSession, signedIn, user, linked, server, deviceName, menuSub, pageHTML, newCharText, newCharacter, onSave, flush, refresh,
    _state: () => ({ ask, note, chars, conflict, syncNote, lastSync, form }) };
})();
if (typeof module !== "undefined") module.exports = ACCOUNT;
