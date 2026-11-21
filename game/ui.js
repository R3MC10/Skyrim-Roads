/* Screens, game loop and touch controls. */
{
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtMin = (m) => m < 1 ? "under a minute" : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // running inside the Android app: offline single-player here, the shared world opens from the online link
  const APP = !!window.Capacitor?.isNativePlatform?.();
  const ONLINE_URL = "https://claude.ai/artifact/BDLK87G6h4icRdqgBfwiU3";
  function openOnline() {
    const B = window.Capacitor?.Plugins?.Browser;
    if (B) B.open({ url: ONLINE_URL, toolbarColor: "#121417" }); else window.open(ONLINE_URL, "_blank");
  }
  const onlineBtn = () => APP ? `<button class="btn pri" data-act="online" style="width:100%;margin-top:8px">🌐 Play online with friends</button><p class="sub" style="margin-top:6px">The shared world opens in Chrome (sign in to Claude once). Your online character is separate from this phone's offline one.</p>` : "";
  const KIND = { city: "City", town: "Town", farm: "Farm", dungeon: "Dungeon", fort: "Fort", camp: "Camp", lair: "Dragon lair", stone: "Standing stone", shrine: "Shrine", landmark: "Landmark" };
  const TABS = [
    ["map", "Travel", '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'],
    ["hero", "Hero", '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/>'],
    ["pack", "Pack", '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 016 0v2"/>'],
    ["tactics", "Tactics", '<path d="M5 19L19 5M14 5h5v5"/><path d="M5 5l6 6M14 14l5 5"/>'],
    ["town", "Town", '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>'],
    ["log", "Journal", '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>'],
  ];
  let S = null, net = {}, tab = "map", selected = null, others = [], bags = [];
  let zoom = innerWidth < 700 ? 2.4 : 1, follow = true, center = [0.5, 0.5], view = {}, version = 0, rendered = -1, lastPanelRender = 0;
  let tacticsDraft = { if: "hp_below", pct: 40, do: "potion:health", edit: null }, testResult = null, townShop = null, forgeTab = "make", forgeGroup = "iron", packOpen = null, searchText = "", uxAllPlaces = false, uxHelpOpen = null, packSearch = "";
  let raidDocs = [], raidSeen = null, enchDraft = {};
  let chatDocs = [], chatRaw = [], chatCh = "world", chatDraft = "", chatSeen = 0, chatSeenIds = new Set(), lastChatSend = 0;
  const bootT = Date.now() / 1000;
  let trades = [], ladderDocs = [], ladderCat = "level", tradeSel = [], tradeTo = null, seenTrades = new Set(), lastLadderJson = "";
  let coopUI = null, perkSkill = null, heroSkill = null, alchSel = [], party = null, invites = [], chests = [], news = [], seenAttacks = new Set(), lastCardJson = "", lastAmbushCheck = 0;
  const app = $("#app"), tabsEl = $("#tabs");
  const bump = () => { version++; };

  // ------------------------------------------------------------ helpers
  const hudIcon = (k, fallback) => (typeof HUD !== "undefined" ? HUD.icon(k) : fallback);
  function toast(text) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    if (typeof HUD !== "undefined") HUD.log(el, text);
    el.textContent = text; el.classList.remove("hide");
    if (typeof POLISH !== "undefined") POLISH.toast(el, text);
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hide"), 3800);
  }
  function persist(pub = false) { Store.save(S); if (pub) { publishCard(); publishHome(); publishClan(); publishHall(); } bump(); }
  let lastClanJson = "";
  function publishClan() {
    const json = JSON.stringify([S.clan || null, S.name]);
    if (json === lastClanJson) return; lastClanJson = json;
    if (S.clan) Store.put("clanmem", S.id, { clan: S.clan, name: S.name, t: G.now() }); else Store.remove("clanmem", S.id);
  }
  function publishCard(force = true) {
    const tr = S.trip;
    const card = { name: S.name, race: S.race, level: S.level, x: S.x, y: S.y,
      t0: tr ? tr.lastTick : G.now(), moving: !!(tr && tr.status === "travel"), dest: tr ? tr.dest : null,
      path: tr && tr.status === "travel" ? [[S.x, S.y], ...tr.path.slice(tr.idx + 1)].slice(0, 120) : null,
      speed: G.speed(S), loc: S.location || null, region: WORLD.regionOf([S.x, S.y]), look: HEROART.lookOf(S), party: party?.id || null, hiding: !!S.ambush, clan: myClan()?.tag || null, ...MP.stats(S), coop: coopUI?.card() || null };
    const json = JSON.stringify({ ...card, t0: 0, cur: Math.round(card.cur / 10) });
    if (!force && json === lastCardJson) return;
    lastCardJson = json;
    Store.publish({ ...card, updated: Date.now() });
    const lad = MP.ladder(S), lj = JSON.stringify({ ...lad, t: 0 });
    if (lj !== lastLadderJson && Store.online) { lastLadderJson = lj; Store.put("ladder", S.id, lad); }
  }
  let liveCache = { t: 0, key: "", pos: null };
  function livePos(t = G.now()) {
    const tr = S.trip;
    if (!tr || tr.status !== "travel") return [S.x, S.y];
    const key = tr.lastTick + ":" + tr.idx;
    if (liveCache.key === key && Math.abs(liveCache.t - t) < 0.05) return liveCache.pos;
    liveCache = { t, key, pos: G.posAfter(S, Math.max(0, t - tr.lastTick)) };
    return liveCache.pos;
  }
  /* players only meet on the same map: Skyrim or Solstheim (old cards without a region are in Skyrim) */
  const sameMap = (o) => (o.region || WORLD.regionOf([o.x, o.y])) === WORLD.regionOf([S.x, S.y]);
  function otherPos(o, t = G.now()) {
    if (!o.moving || !o.path || o.path.length < 2) return [o.x, o.y];
    return Terrain.moveAlong(o.path, 0, o.path[0], Math.max(0, t - o.t0), (o.speed || 30) / 60).pos;
  }
  const tripMinutesLeft = () => Math.max(0, G.minutesLeft(S) - (S.trip?.status === "travel" ? (G.now() - S.trip.lastTick) / 60 : 0));
  // cities and the old towns are on every map; everything in WORLD.hidden has to be found first
  const known = (n) => S.discovered.includes(n) || (["city", "town"].includes(WORLD.places[n][2]) && !WORLD.hidden?.has(n));
  const placesFound = () => { const all = Object.keys(WORLD.places).length, got = new Set(S.discovered.filter((n) => WORLD.places[n])).size; return { got, all }; };
  let discSeen = null;
  function discoveryToast() {   // a popup for every place you find, however you found it
    if (!S) return;
    if (!discSeen) { discSeen = new Set(S.discovered); return; }
    const fresh = S.discovered.filter((n) => !discSeen.has(n));
    if (!fresh.length) return;
    fresh.forEach((n) => discSeen.add(n));
    if (fresh.length === 1 && fresh[0] === S.location && !S.trip) return;   // the "Arrived at …" popup already says it
    const pf = placesFound();
    toast(`📍 Discovered: ${fresh.slice(0, 2).join(", ")}${fresh.length > 2 ? ` and ${fresh.length - 2} more` : ""} · ${pf.got}/${pf.all} places`);
  }
  const myBag = () => bags.find((b) => b.ownerId === S.id && b.expires > G.now());
  /* a player's bag is private to them and their killer for the first ten minutes */
  const bagOpenTo = (b, t = G.now()) => !b.killerId || b.ownerId === S.id || b.killerId === S.id || t > (b.t || 0) + 600;
  const reachableBags = () => bags.filter((b) => bagOpenTo(b));
  function visibleBags() {
    const t = G.now();
    return bags.filter((b) => b.expires > t && bagOpenTo(b, t) && (b.ownerId === S.id || b.killerId === S.id || S.explored.slice(-60).some((p) => G.pxDist(p, [b.x, b.y]) < 90)))
      .map((b) => ({ pos: [b.x, b.y], label: b.ownerId === S.id ? `Your bag · ${Math.max(0, Math.floor((b.expires - t) / 60))} min` : b.killerId === S.id ? `${b.ownerName}'s bag (your kill)` : `${b.ownerName}'s bag` }));
  }
  const pct = (a, b) => Math.max(0, Math.min(100, 100 * a / Math.max(1, b)));

  // ------------------------------------------------------------ boot
  async function boot() {
    net = await Store.init();
    try { await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]); } catch { /* fonts optional */ }
    S = await Store.loadSave();
    if (S) S = G.migrate(S);
    if (getPref("zoomFar", false)) zoom = 1;
    let open = null; try { open = sessionStorage.getItem("rotn_open"); sessionStorage.removeItem("rotn_open"); } catch { /* ignore */ }
    if (open === "update") { showTitle("update"); checkUpdate(true); } else showTitle(open === "menu" ? "menu" : "press");
  }

  function showCreate() {
    let race = "nord";
    const draw = () => {
      app.innerHTML = `
      <div class="panel" style="margin-top:16px">
        <h1 style="font-size:clamp(28px,7vw,44px)">Roads of the North</h1>
        <p class="sub">A shared Skyrim you travel in real time. Walking from Whiterun to Windhelm takes about ten minutes, and the road is rarely empty.</p>
        <label class="sub" for="nm">Your name</label>
        <input id="nm" maxlength="24" autocomplete="off" placeholder="e.g. Remigiusz" value="${esc($("#nm")?.value || "")}">
        ${TITLEART.createScene(race)}
        <h3 style="margin-top:14px">Choose your race</h3>
        ${DOLL.racePicker(race)}
        <div class="cshow">${DOLL.showcase(race)}</div>
        <button class="btn pri" id="begin" style="width:100%;margin-top:8px">Begin in ${esc(D.START_LOCATION)}</button>
        <button class="btn" id="toTitle" style="width:100%;margin-top:8px">Back to the main menu</button>
        <p class="sub status ${net.mode === "shared" || net.mode === "p2p" ? "live" : ""}" style="margin-top:10px"><i></i>${net.mode === "shared" ? "Shared world: other players will see you on the map." : net.mode === "p2p" ? "One world for everyone with the app: your game is saved on this phone and syncs straight with everyone else's." : APP ? "Offline game: saved on this phone." : "Saved in this browser only (shared saving unavailable here)."}</p>${net.mode === "shared" || net.mode === "p2p" ? "" : onlineBtn().replace('data-act="online"', 'id="online"')}
      </div>`;
      app.querySelectorAll("[data-race]").forEach((b) => b.onclick = () => { race = b.dataset.race; const v = $("#nm").value; draw(); $("#nm").value = v; });
      if ($("#online")) $("#online").onclick = openOnline;
      $("#toTitle").onclick = () => { app.innerHTML = ""; showTitle("menu"); };
      $("#begin").onclick = () => {
        const name = ($("#nm").value || "").trim().slice(0, 24) || "Dovahkiin";
        S = G.newSave(Store.uid, name, race);
        if (typeof PATCHNOTES !== "undefined") PATCHNOTES.markSeen();   // a new character starts on the current version
        if (!/[?&]notut/.test(location.search)) S.tut = { step: 1, seen: {} };   // new characters get the guided first trip
        const wantIntro = !/[?&]notut/.test(location.search) && (!navigator.webdriver || /[?&]intro/.test(location.search));
        if (wantIntro) S.introSeen = true;
        persist(true);
        startGame();
        if (wantIntro) try { TITLEART.intro(null, { reduce: reduceMotion }); } catch (e) { console.warn("intro", e); }
      };
    };
    draw();
  }

  // ------------------------------------------------------------ title screen (main menu)
  const PREFS_KEY = "rotn_prefs";
  const getPref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const setPref = (k, v) => { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); p[k] = v; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  let titlePage = "press", titleAnim = 0, update = null, updateMsg = "", updatePct = -1, updateBusy = false, gameStarted = false;
  const EMBLEM = `<svg class="emb" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e7c4"/><stop offset=".6" stop-color="#c9a75e"/><stop offset="1" stop-color="#7d6230"/></linearGradient></defs>
    <circle cx="50" cy="50" r="45" fill="none" stroke="url(#eg)" stroke-width="1.6"/><circle cx="50" cy="50" r="39" fill="none" stroke="url(#eg)" stroke-width=".8" stroke-dasharray="2 4"/>
    <path d="M14 70 L36 38 L45 50 L58 28 L86 70 Z" fill="none" stroke="url(#eg)" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M52 37 L58 28 L64 37" fill="none" stroke="#f3e7c4" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M50 92 C47 80 56 76 50 70" fill="none" stroke="url(#eg)" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M50 8 l2.2 5 5 .6 -3.8 3.4 1 5 -4.4-2.6 -4.4 2.6 1-5 -3.8-3.4 5-.6z" fill="url(#eg)"/></svg>`;
  const versionText = async () => { try { if (window.__app) { const c = await window.__app.current(); return `Build ${c.build}`; } } catch { /* ignore */ } return APP ? "App" : "Web version"; };
  function worldText() {
    if (Store.mode === "p2p") return Store.peers ? `The world · ${Store.peers} other ${Store.peers === 1 ? "player" : "players"} online` : "The world · looking for friends…";
    if (Store.online) return `Shared world · ${others.length} other travellers`;
    return APP ? "Offline game" : "Saved in this browser";
  }
  function showTitle(page = "press") {
    titlePage = page;
    let el = $("#title");
    if (!el) {
      el = document.createElement("div"); el.id = "title"; el.className = "title";
      el.innerHTML = `<canvas id="tanim" class="tanim" aria-hidden="true"></canvas><canvas id="tfog"></canvas><div class="vign"></div><div class="inner" id="tinner"></div><div class="foot" id="tfoot"></div>`;
      document.body.appendChild(el);
      el.addEventListener("click", onTitleClick);
      el.addEventListener("input", onSettingsInput);
      el.addEventListener("change", onSettingsInput);
      startFog();
      try { titleStop = TITLEART.start($("#tanim"), { reduce: reduceMotion }); } catch (e) { console.warn("title art", e); }
      const foot = async () => { if (!$("#title")) return; $("#tfoot").textContent = `${await versionText()} · ${worldText()}`; setTimeout(foot, 3000); };
      foot();
    }
    tabsEl.classList.add("hide");
    SOUND.mood("title");
    SOUND.ambience?.({ scene: "wild", weather: "snow", tod: "night", ground: "snow", coldLand: true });   // the title: wind over the mountains
    renderTitle();
  }
  let titleStop = null;
  /* fade the title out instead of cutting; it stops taking taps at once and drops its id so a new title can open */
  function closeTitle() {
    cancelAnimationFrame(titleAnim); try { titleStop?.(); } catch { /* ignore */ } titleStop = null;
    const el = $("#title"); if (!el) return;
    el.id = "title-out"; el.style.pointerEvents = "none";
    if (reduceMotion) { el.remove(); return; }
    el.classList.add("tout"); setTimeout(() => el.remove(), 320);
  }
  function renderTitle() {
    const inner = $("#tinner"); if (!inner) return;
    if (!$("#thead")) inner.innerHTML = `<div id="thead" style="display:flex;flex-direction:column;align-items:center">${EMBLEM}<h1>Roads of the North</h1><div class="tag">A shared journey across Skyrim</div></div><div id="tbody" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1"></div>`;
    let body = "";
    if (titlePage === "press") body = `<button class="press" data-t="menu">Tap to begin</button>`;
    else if (titlePage === "menu") {
      const item = (t, label, sub = "", badge = "") => `<button class="mi" data-t="${t}"><span class="lbl">${label}${badge ? `<span class="badge">${badge}</span>` : ""}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
      body = `<nav class="menu" aria-label="Main menu">
        ${S ? item("continue", "Continue", `${S.name} · Level ${S.level} ${D.RACES[S.race].name} · ${S.location || G.holdAt([S.x, S.y])}`) : ""}
        ${item("new", S ? "New Character" : "Begin")}
        ${item("settings", "Settings")}
        ${item("update", "Updates", "", update?.newer ? "New" : "")}
        ${typeof PATCHNOTES !== "undefined" ? item("notes", "Patch Notes", "", PATCHNOTES.unseen() && S ? "New" : "") : ""}
        ${item("howto", "How to Play")}
        ${item("credits", "Credits")}</nav>`;
    }
    else body = `<div class="page">${titleSubpage()}</div>`;
    $("#tbody").innerHTML = body;
    if (titlePage !== "press") inner.querySelector(".mi, .page .btn")?.focus({ preventScroll: true });
    if (titlePage !== "menu" && titlePage !== "press") inner.scrollTop = 0;
  }
  const backBtn = `<button class="btn" data-t="menu">Back</button>`;
  function titleSubpage() {
    if (titlePage === "settings") return `<h2>Settings</h2>${settingsHTML()}${typeof PATCHNOTES !== "undefined" ? `<button class="btn" data-t="notes" style="width:100%;margin-top:12px">📜 Patch notes</button>` : ""}${backBtn}`;
    if (titlePage === "notes") { PATCHNOTES.markSeen(); return `<h2>Patch Notes</h2>${PATCHNOTES.html()}${backBtn}`; }
    if (titlePage === "confirmNew") return `<h2>Start over?</h2><p>${esc(S.name)} (level ${S.level}) and everything they carry will be gone for good. Other players' worlds aren't affected.</p>
      <button class="btn danger" data-t="wipe">Yes, make a new character</button>${backBtn}`;
    if (titlePage === "update") return `<h2>Updates</h2>${updateHTML()}${backBtn}`;
    if (titlePage === "backup") return `<h2>Back up</h2>${backupHTML()}<button class="btn" data-t="settings">Back</button>`;
    if (titlePage === "restore") return `<h2>Restore</h2>${restoreHTML()}<button class="btn" data-t="settings">Back</button>`;
    if (titlePage === "howto") return `<h2>How to Play</h2>
      <h3>Travel</h3><p>Tap a place on the map and press Go. You walk in real time, even with the app closed: about ten minutes from Whiterun to Windhelm. Roads are fast; snow, marsh and mountains are slow. Carriages are safe and quick.</p>
      <h3>Fights</h3><p>Bandits, wolves and worse block the road. Fight, flee, sneak past or drink a potion. Fights follow your tactics (Tactics tab), rules like “below 40% health, drink a potion”.</p>
      <h3>Towns</h3><p>The Town tab has shops, inns, trainers, the forge, alchemy, jobs, homes and followers. Rest at an inn or your own bed for a bonus.</p>
      <h3>Dungeons</h3><p>At a barrow or cave, press Go inside. Pick your way room by room down to the boss. Health doesn't come back on its own in there, so bring potions.</p>
      <h3>Quests</h3><p>The Journal tab shows your quests. The gold diamond on the map marks where to go next.</p>
      <h3>Playing together</h3><p>Everyone with the app shares one world. Form a party, trade, fight dragons that attack towns, or rob each other. Watch your back.</p>
      <h3>Dying</h3><p>You wake at the nearest town and drop a bag with your gold. Get back to it within ten minutes before someone else does.</p>
      ${S ? `<button class="btn pri" data-t="tutorial">Play the guided tutorial with ${esc(S.name)}</button>` : ""}${backBtn}`;
    if (titlePage === "credits") return `<h2>Credits</h2>
      <p><b>Created by</b> Remigiusz (R3MC10)</p><p><b>Built with</b> Claude</p>
      <p><b>Music and sound</b> composed live on your device</p>
      <p><b>Fonts</b> Cinzel, Cormorant Garamond, Barlow Semi Condensed (SIL Open Font License)</p>
      <p><b>Networking</b> Trystero, phone to phone</p>
      <p class="sub" style="margin-top:12px">A fan project inspired by The Elder Scrolls V: Skyrim. Not made by or affiliated with Bethesda.</p>${backBtn}`;
    return backBtn;
  }
  function onTitleClick(e) {
    const b = e.target.closest("[data-t], [data-act]"); if (!b) return;
    if (b.dataset.act === "bk") { bkClick(b); return; }
    if (b.dataset.act) { settingsAction(b.dataset.act, b) && renderTitle(); return; }
    const t = b.dataset.t;
    SOUND.fx(t === "menu" && titlePage === "press" ? "arrive" : "click");
    switch (t) {
      case "continue": closeTitle(); startGame(); break;
      case "tutorial": S.tut = { step: 1, seen: {} }; Store.save(S); closeTitle(); startGame(); break;
      case "new": if (S) { titlePage = "confirmNew"; renderTitle(); } else { closeTitle(); showCreate(); } break;
      case "wipe": Store.wipe().then(() => { S = null; closeTitle(); showCreate(); }); break;
      case "update": titlePage = "update"; renderTitle(); checkUpdate(true); break;
      case "doupdate": runUpdate(); break;
      default: titlePage = t; renderTitle();
    }
  }
  function startGame() { if (gameStarted) return; gameStarted = true; start(); }

  // ---- settings (title page and in-game sheet share these)
  function settingsHTML() {
    const c = SOUND.settings, sl = (id, label, v) => `<label class="sndrow"><span>${label}</span><input type="range" id="${id}" min="0" max="100" step="5" value="${Math.round(v * 100)}" aria-label="${label}"></label>`;
    const seg = (key, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="pref" data-k="${key}" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join("")}</div>`;
    return `<h3>Sound</h3>${sl("snd_music", "Music", c.music)}${sl("snd_sfx", "Effects", c.sfx)}${sl("snd_amb", "Ambience", c.amb ?? 0.5)}
      <div class="setrow"><span>All sound</span>${seg("mute", [[false, "On"], [true, "Off"]], c.mute)}</div>
      ${S ? `<h3>Your character</h3><div class="grid2"><button class="btn" data-act="bk" data-bk="openbackup">Back up</button><button class="btn" data-act="bk" data-bk="openrestore">Restore</button></div>` : `<h3>Your character</h3><button class="btn" data-act="bk" data-bk="openrestore" style="width:100%">Restore from a backup</button>`}
      <h3>Look</h3><div class="setrow"><span>Art style</span>${seg("artStyle", [["ink", "Hand-drawn"], ["pixel", "Pixel art"]], ART.style())}</div>
      <h3>Map</h3><div class="setrow"><span>Map opens</span>${seg("zoomFar", [[false, "Close up"], [true, "All Skyrim"]], getPref("zoomFar", false))}</div>
      ${APP ? `<h3>Phone</h3><div class="setrow"><span>Notifications</span>${seg("notify", [[true, "On"], [false, "Off"]], getPref("notify", true))}</div>
      <div class="setrow"><span>Check for updates</span>${seg("autoUpdate", [[true, "Automatically"], [false, "Only when I ask"]], getPref("autoUpdate", true))}</div>` : ""}`;
  }
  function onSettingsInput(e) {
    if (e.target.id === "snd_music") SOUND.set("music", e.target.value / 100);
    if (e.target.id === "snd_amb") SOUND.set("amb", e.target.value / 100);
    if (e.target.id === "snd_sfx") { SOUND.set("sfx", e.target.value / 100); if (e.type === "change") SOUND.fx("coin"); }
  }
  /* returns true when the caller should re-render */
  function settingsAction(act, b) {
    if (act !== "pref") return false;
    const k = b.dataset.k, v = b.dataset.v === "true";
    if (k === "artStyle") { ART.setStyle(b.dataset.v); SOUND.fx("click"); if (typeof POLISH !== "undefined") POLISH.texture(); if (S) { try { renderPanel(true); } catch { /* title screen */ } } return true; }
    if (k === "mute") { SOUND.set("mute", v); if ($("#sndBtn")) $("#sndBtn").innerHTML = hudIcon(v ? "mute" : "gear", v ? "🔇" : "⚙") + '<small class="ibl" aria-hidden="true">Menu</small>'; }
    else setPref(k, v);
    SOUND.fx("click");
    return true;
  }

  // ---- character backups
  let bkCode = null, bkNote = "", bkArmed = null;
  function backupHTML() {
    return `<p>This code is your whole character: level, skills, gear, gold, quests and home. Keep it somewhere safe (notes, a message to yourself). Paste it into Restore on any phone to get your hero back.</p>
      <textarea id="bkcode" class="code" readonly rows="5" aria-label="Your backup code">${esc(bkCode || "Making your code…")}</textarea>
      <div class="grid2"><button class="btn pri" data-act="bk" data-bk="copy" ${bkCode ? "" : "disabled"}>Copy</button><button class="btn" data-act="bk" data-bk="share" ${bkCode ? "" : "disabled"}>Share…</button></div>
      ${bkNote ? `<p class="sub" role="status">${esc(bkNote)}</p>` : ""}`;
  }
  function restoreHTML() {
    const auto = BACKUP.autoList();
    return `<p>Paste a backup code below. ${S ? `<b>This replaces ${esc(S.name)} (level ${S.level}) on this phone.</b> Back them up first if you want to keep them.` : ""}</p>
      <textarea id="rscode" class="code" rows="4" placeholder="ROTN1.…" aria-label="Backup code" autocomplete="off" spellcheck="false"></textarea>
      <button class="btn ${bkArmed === "code" ? "danger" : "pri"}" data-act="bk" data-bk="restore" style="width:100%">${bkArmed === "code" ? `Yes, replace ${esc(S?.name || "")}` : "Restore this code"}</button>
      ${auto.length ? `<h3>Automatic copies on this phone</h3><p class="sub" style="margin-top:0">Saved every 10 minutes while you play. They're gone if the app is deleted, so keep a code too.</p>
      <div class="list">${auto.map((a, i) => `<div class="item"><div class="t">${esc(a.name)} · level ${a.level}<span>${new Date(a.t).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}${a.where ? " · " + esc(a.where) : ""}</span></div><button class="btn sm" data-act="bk" data-bk="auto" data-i="${i}">${bkArmed === "auto" + i ? "Yes, replace" : "Restore"}</button></div>`).join("")}</div>` : ""}
      ${bkNote ? `<p class="sub" role="status" style="color:var(--ember)">${esc(bkNote)}</p>` : ""}`;
  }
  function bkRender(page) {
    if ($("#title")) { titlePage = page; renderTitle(); return; }
    const keep = $("#rscode")?.value || "";
    openModal(`<h2>${page === "backup" ? "Back up" : "Restore"}</h2>${page === "backup" ? backupHTML() : restoreHTML()}<button class="btn" data-act="close" style="width:100%;margin-top:10px">Close</button>`);
    if ($("#rscode")) $("#rscode").value = keep;
  }
  async function bkClick(b) {
    const k = b.dataset.bk;
    SOUND.fx("click");
    if (k === "openbackup") { bkCode = null; bkNote = ""; bkRender("backup"); bkCode = await BACKUP.make(S); bkRender("backup"); return; }
    if (k === "openrestore") { bkNote = ""; bkArmed = null; bkRender("restore"); return; }
    if (k === "copy") {
      try { await navigator.clipboard.writeText(bkCode); bkNote = "Copied. Paste it somewhere safe."; }
      catch { const t = $("#bkcode"); t.select(); bkNote = document.execCommand("copy") ? "Copied. Paste it somewhere safe." : "Select the code and copy it by hand."; }
      bkRender("backup"); return;
    }
    if (k === "share") {
      const text = `Roads of the North backup: ${S.name}, level ${S.level}\n${bkCode}`;
      try {
        if (window.Capacitor?.Plugins?.Share && APP) await window.Capacitor.Plugins.Share.share({ title: "Roads of the North backup", text, dialogTitle: "Save your backup" });
        else if (navigator.share) await navigator.share({ title: "Roads of the North backup", text });
        else { await navigator.clipboard.writeText(bkCode); bkNote = "Sharing isn't available here, so the code was copied instead."; bkRender("backup"); }
      } catch { /* cancelled */ }
      return;
    }
    if (k === "restore" || k === "auto") {
      const code = k === "auto" ? BACKUP.autoList()[+b.dataset.i]?.code : $("#rscode")?.value;
      const armKey = k === "auto" ? "auto" + b.dataset.i : "code";
      let save;
      try { save = await BACKUP.read(code); } catch (err) { bkNote = err.message; bkArmed = null; bkRender("restore"); return; }
      if (S && bkArmed !== armKey) { bkArmed = armKey; bkNote = ""; bkRender("restore"); if ($("#rscode") && k === "restore") $("#rscode").value = code; return; }
      if (S) await BACKUP.autoSave(S, true);   // one last copy of the character being replaced
      save = G.migrate(save); save.id = Store.uid;
      Store.save(save); await Store.flush();
      try { sessionStorage.setItem("rotn_open", "menu"); } catch { /* ignore */ }
      location.reload();
    }
  }

  // ---- updates
  function updateHTML() {
    if (!window.__app) return `<p>You're playing the web version, which is always up to date. The phone app checks for new versions and installs them itself.</p>`;
    if (!update) return `<p class="sub">${esc(updateMsg || "Checking for a new version…")}</p>`;
    const cur = update.current.build, lat = update.latest;
    const when = lat.date ? new Date(lat.date).toLocaleDateString() : "";
    if (!update.newer) return `<p>You have the newest version: <b>build ${cur}</b>.</p>${updateMsg ? `<p class="sub">${esc(updateMsg)}</p>` : ""}<button class="btn" data-t="update">Check again</button>`;
    return `<p>A new version is ready: <b>build ${lat.build}</b>${when ? ` (${esc(when)})` : ""}. You have build ${cur}.</p>
      ${lat.notes ? `<h3>What's new</h3><div class="notes">${esc(lat.notes)}</div>` : ""}
      <p class="sub">Your character and progress stay. ${(lat.size / 1048576).toFixed(1)} MB download.</p>
      ${updateMsg ? `<p id="umsg">${esc(updateMsg)}</p><div class="uprog"><i id="ubar" style="width:${Math.max(0, updatePct)}%"></i></div>` : ""}
      <button class="btn pri" data-t="doupdate" ${updateBusy ? "disabled" : ""}>${updateBusy ? "Updating…" : "Update now"}</button>`;
  }
  async function checkUpdate(force) {
    if (!window.__app) return;
    if (force) { update = null; updateMsg = ""; }
    try { update = await window.__app.check(force); }
    catch (err) { updateMsg = `Couldn't reach GitHub (${err.message}). Check your internet and try again.`; update = null; }
    if (titlePage === "update") renderTitle(); else if ($("#title")) renderTitle();
  }
  async function runUpdate() {
    if (!update?.newer || updateBusy) return;
    updateBusy = true; updateMsg = "Starting…"; updatePct = 0; renderTitle();
    try {
      const r = await window.__app.install(update.latest, (text, pct) => {
        updateMsg = text; updatePct = pct;
        const m = $("#umsg"), bar = $("#ubar");
        if (m && bar) { m.textContent = text; bar.style.width = `${Math.max(0, pct)}%`; } else if (titlePage === "update") renderTitle();
      });
      if (r === "installer") updateMsg = "Tap Install (or Update) on Android's screen. The game reopens on the new version.";
    } catch (err) { updateMsg = `The update didn't finish: ${err.message}. Try again.`; }
    updateBusy = false;
    if (titlePage === "update") renderTitle();
  }
  function updateAvailable(r) {
    update = r;
    if ($("#title")) { if (titlePage === "menu") renderTitle(); return; }
    toast(`A new version (build ${r.latest.build}) is ready. Open ⚙ to update.`);
  }

  // ---- fog and snow
  function startFog() {
    const cv = $("#tfog"), cx = cv.getContext("2d");
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener("resize", fit);
    const W = () => innerWidth, H = () => innerHeight;
    const blobs = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * W(), y: H() * (0.35 + Math.random() * 0.7), r: 160 + Math.random() * 260, v: 6 + Math.random() * 12, a: 0.05 + Math.random() * 0.06, ph: i }));
    const flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * W(), y: Math.random() * H(), s: 0.6 + Math.random() * 1.8, v: 12 + Math.random() * 30, w: Math.random() * 6 }));
    let last = performance.now();
    const draw = (ts) => {
      if (!$("#title")) return;
      const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
      cx.clearRect(0, 0, W(), H());
      for (const b of blobs) {
        if (!reduceMotion) { b.x += b.v * dt; if (b.x - b.r > W()) b.x = -b.r; }
        const g = cx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(200,210,220,${b.a})`); g.addColorStop(1, "rgba(200,210,220,0)");
        cx.fillStyle = g; cx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      cx.fillStyle = "rgba(235,240,245,.55)";
      for (const f of flakes) {
        if (!reduceMotion) { f.y += f.v * dt; f.x += Math.sin(ts / 1000 + f.w) * 8 * dt; if (f.y > H()) { f.y = -4; f.x = Math.random() * W(); } }
        cx.beginPath(); cx.arc(f.x, f.y, f.s, 0, 7); cx.fill();
      }
      if (!reduceMotion) titleAnim = requestAnimationFrame(draw);
    };
    titleAnim = requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------ main screen
  window.__dbg = { save: () => S, view: () => view, openEvent: (n) => openEvent(n), tally: (k, n) => tally(k, n), message: (t, x, b) => showMessage(t, x, b), toast: (t) => toast(t) };   // for testing in the browser console
  /* phone back button: close what's on top, step back to the map, and only then leave the app */
  window.__ui = {
    back() {
      if ($("#title")) { if (titlePage !== "menu" && titlePage !== "press") { titlePage = "menu"; renderTitle(); return true; } return false; }
      if (!S && $("#toTitle")) { app.innerHTML = ""; showTitle("menu"); return true; }
      if ($("#sky") && !$("#modal")) { closeMenu(); if (typeof TABMENU !== "undefined") TABMENU.menuClosed(); return true; }
      if ($("#modal")) { if (!$("#modal [data-act=enc], #modal [data-act=ev], #modal [data-act=guard]")) closeModal(); return true; }
      if ($("#dun")) { closeDungeon(); return true; }
      if (selected) { selected = null; renderPicked(); return true; }
      if (typeof TABMENU !== "undefined") { const r = TABMENU.back(); if (r !== null) return r; }   // the compass is home (tabmenu.js)
      if (S && tab !== "map") { tab = "map"; bump(); renderTabs(); renderPanel(true); return true; }
      return false;
    },
    save() { if (S) Store.save(S); },
    /* for the Tab compass (tabmenu.js) */
    openMenu: (p) => openMenu(p), closeMenu: () => closeMenu(), refresh: () => { bump(); renderPanel(true); },
    go(t) { closeMenu(); tab = t; testResult = null; bump(); renderTabs(); renderPanel(true); },
    get tab() { return tab; },
    updateAvailable: (r) => updateAvailable(r),
    permissionBack: () => { if ($("#title") && titlePage === "update") { updateMsg = "Thanks. Tap Update now again."; renderTitle(); } },
    /* things worth a phone notification while the app is closed: arrival and the next dragon attack (times in ms) */
    upcoming() {
      if (!S) return [];
      const out = [], now = Date.now(), tr = S.trip;
      if (tr && tr.status === "travel") { const m = tripMinutesLeft(); if (m > 0.5) out.push({ id: 1, at: now + m * 60000, title: `You've reached ${tr.destName}`, body: tr.carriage ? "The carriage pulls up. Tap to see where you are." : "Your trip is over. Tap to see what's there." }); }
      const r = WEVENTS.nextRaid();
      if (r) out.push({ id: 2, at: r.start * 1000, title: `🐉 A dragon attacks ${r.town}!`, body: "Every player can fight it together for the next 20 minutes." });
      return out.filter((n) => n.at > now + 5000);
    },
  };
  function start() {
    if (typeof POLISH !== "undefined") POLISH.texture();
    app.innerHTML = `
      <div class="top"><span class="lvlb num" id="lvlb" aria-label="Level"></span><div class="who"><b id="nm"></b><span id="sub"></span></div>
        <div class="meta"><div id="clock"></div><div class="gold" id="goldv"></div></div>
        <button class="iconbtn soc" id="socBtn" aria-label="Friends, messages and trades">${hudIcon("people", "👥")}<small class="ibl" aria-hidden="true">Friends</small></button>
        <button class="iconbtn snd" id="sndBtn" aria-label="Settings and menu">${hudIcon(SOUND.settings.mute ? "mute" : "gear", SOUND.settings.mute ? "🔇" : "⚙")}<small class="ibl" aria-hidden="true">Menu</small></button></div>
      <div class="layout">
        <div>
          <div class="mapwrap" id="mapwrap"><canvas id="map" aria-label="Map of Skyrim"></canvas>
            <div class="mapbtns"><button class="iconbtn" id="zoomBtn" aria-label="Zoom map">${zoom === 1 ? "＋" : "－"}</button><button class="iconbtn" id="centerBtn" aria-label="Centre on me">◎</button></div>
            <div class="picked hide" id="picked"></div></div>
          <div class="vitals" id="vitals"></div>
          <div id="trip"></div>
          <div id="raid"></div>
        </div>
        <div class="side" id="side"></div>
      </div>`;
    tabsEl.classList.remove("hide");
    window.scrollTo(0, 0);
    tabsEl.innerHTML = TABS.map(([id, label, svg]) => `<button class="tab ${id === tab ? "on" : ""}" role="tab" aria-selected="${id === tab}" data-tab="${id}"><svg viewBox="0 0 24 24">${svg}</svg>${label}</button>`).join("");
    tabsEl.onclick = (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; SOUND.fx("click"); if (b.dataset.tab === "pack") return openMenu("items"); closeMenu(); tab = b.dataset.tab; testResult = null; bump(); renderTabs(); renderPanel(true); if (typeof POLISH !== "undefined") POLISH.swap($("#side")); $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); };
    $("#zoomBtn").onclick = () => { mapTouchedAt = performance.now(); zoom = zoom > 1.01 ? 1 : 2.4; follow = true; $("#zoomBtn").textContent = zoom > 1.01 ? "－" : "＋"; };
    $("#centerBtn").onclick = () => { mapTouchedAt = performance.now(); follow = true; if (zoom === 1) zoom = 2.4; $("#zoomBtn").textContent = "－"; };
    bindMap();
    if (typeof HUD !== "undefined") HUD.mount($("#mapwrap"), (name) => { if (WORLD.places[name]) { SOUND.fx("click"); selected = name; roamSpot = null; renderPicked(); } });
    $("#sndBtn").onclick = openSound;
    $("#socBtn").onclick = () => { SOUND.fx("click"); closeMenu(); tab = "social"; bump(); renderTabs(); renderPanel(true); $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); };
    $("#side").addEventListener("click", onPanelClick);
    $("#side").addEventListener("change", onPanelChange);
    $("#side").addEventListener("input", onPanelInput);
    $("#side").addEventListener("keydown", (e) => { if (e.target.id === "chatin" && e.key === "Enter") { e.preventDefault(); chatSend(e.target.value); } if (e.target.id === "dmin" && e.key === "Enter") { e.preventDefault(); sendDM(); } });
    $("#trip").addEventListener("click", onPanelClick);
    $("#raid").addEventListener("click", onPanelClick);
    Store.watch("raids", (docs) => { raidDocs = docs; });
    Store.watch("trades", (docs) => onTrades(docs));
    Store.watch("duels", (docs) => onDuels(docs));
    Store.watch("stalls", (docs) => onStalls(docs));
    Store.watch("halls", (docs) => onHalls(docs));
    if (typeof ECON !== "undefined") Store.watch("econ", (docs) => { ECON.set(docs); if (tab === "town") bump(); });
    Store.watch("verses", (docs) => { verseDocs = docs.filter((d) => d && d.uid && typeof d.text === "string"); onSong(); });
    Store.watch("verselikes", (docs) => { likeDocs = docs.filter((d) => d && d.verseId && d.voter); onSong(); });
    Store.watch("guards", (docs) => { guardDocs = docs; if (tab === "town" || tab === "log") bump(); });
    Store.watch("friends", (docs) => onFriends(docs));
    Store.watch("dms", (docs) => onDMs(docs));
    if (Store.online) Store.put("friends", S.id, SOCIAL.record(S));
    Store.watch("clans", (docs) => { const before = CLANS.invitesFor(S.id).length; CLANS.set(docs, null); if (CLANS.invitesFor(S.id).length > before && !myClan()) toast(`🏴 You're invited to join a clan. See the Journal.`); bump(); renderTabs(); });
    Store.watch("clanmem", (docs) => { CLANS.set(null, docs); bump(); });
    Store.watch("chat", (docs) => onChat(docs));
    Store.watch("homes", (docs) => { homeDocs = docs; if (tab === "town") bump(); });
    Store.watch("gifts", (docs) => onGifts(docs));
    Store.watch("war", (docs) => { WARS.setDocs(docs, S); holdChange(); if (tab === "log") bump(); });
    Store.watch("bounty", (docs) => { BOUNTY.setDocs(docs, S); if (tab === "log" || tab === "town") bump(); });
    Store.watch("hall", (docs) => { HALL.setDonors(docs, S); if (tab === "town") bump(); });
    Store.watch("hallchest", (docs) => { HALL.setChest(docs); if (tab === "town") bump(); });
    Store.watch("ladder", (docs) => { ladderDocs = docs; if (tab === "log") bump(); });
    $("#picked").addEventListener("click", onPanelClick);
    Store.watchPlayers((ps) => { others = ps; if (tab === "log") bump(); });
    Store.watchBags((b) => { bags = b; });
    Store.watch("attacks", (docs) => onAttacks(docs));
    Store.watch("parties", (docs) => {
      party = docs.find((p) => p.members?.some((m) => m.id === S.id)) || null;
      invites = docs.filter((p) => p.invites?.includes(S.id) && !p.members.some((m) => m.id === S.id));
      if (tab === "log") bump();
    });
    if (typeof COOP !== "undefined") {   // co-op dungeons (coop.js)
      coopUI = COOP.ui({ S: () => S, toast, esc, Store, others: () => others, party: () => party, cardOf, persist, publishCard, renderDungeon, renderPanel, bump,
        sendDm: (id, name, text) => { const r = SOCIAL.dm(S, id, name, text); if (!r.err && Store.online) Store.put("dms", r.id, r.doc); } });
      Store.watch("runs", (docs) => coopUI.onRuns(docs));
    }
    Store.watch("chests", (docs) => { const had = chests.length; chests = docs.filter((c) => c.members?.some((m) => m.id === S.id)); if (chests.length > had) toast("💰 A party chest is waiting. See the Journal tab."); if (tab === "log") bump(); });
    Store.watch("news", (docs) => { news = docs.sort((a, b) => b.t - a.t); if (news.length > 40) news.slice(40).forEach((n) => Store.remove("news", n.id)); if (tab === "log") bump(); });
    G.setAllyProvider(() => allies());
    let lastPeers = 0;
    Store.onStatus?.((st) => {
      if (st.peers > lastPeers) { publishCard(); toast(`${st.peers} other player${st.peers > 1 ? "s" : ""} online.`); }
      lastPeers = st.peers; bump(); if (["map", "log"].includes(tab)) renderPanel(false);
    });
    if (TOWNS.guardCheck(S) && !TOWNS.wanted(S)) setTimeout(openGuard, 400);
    document.addEventListener("visibilitychange", () => { if (document.hidden) Store.save(S); else tick(); });
    tick();
    setInterval(tick, 1000);
    festAnnounce();
    requestAnimationFrame(frame);
    if (typeof TABMENU !== "undefined") TABMENU.mount();   // the Tab compass is the home screen
    if (S.trip?.status === "encounter") openEncounter();
    else if (S.trip?.status === "event") openEvent();
    if (S.dungeon) renderDungeon();
    setTimeout(whatsNew, 1500);
  }
  /* "What's new": once per update, for characters who were here before it; never over another popup */
  function whatsNew(tries = 0) {
    if (typeof PATCHNOTES === "undefined" || !PATCHNOTES.unseen()) return;
    if (navigator.webdriver && !/[?&]whatsnew/.test(location.search)) return;   // automated checks don't want surprise popups
    if (S.tut?.step) { PATCHNOTES.markSeen(); return; }                           // brand-new players get the tutorial instead
    if ($("#modal") || document.querySelector(".intro")) { if (tries < 20) setTimeout(() => whatsNew(tries + 1), 3000); return; }
    PATCHNOTES.markSeen();
    openModal(`${PATCHNOTES.whatsNewHTML()}<div class="grid2" style="margin-top:12px"><button class="btn" data-act="notes">All patch notes</button><button class="btn pri" data-act="close">Continue</button></div>`, "pnsheet");
  }
  function openNotes() {
    PATCHNOTES.markSeen();
    openModal(`<h2>Patch Notes</h2>${PATCHNOTES.html()}<button class="btn pri" data-act="close" style="width:100%;margin-top:12px">Done</button>`, "pnsheet");
  }
  /* road events: only while you're watching. About one every 3 minutes of walking, never two within a minute. */
  let lastEventAt = Date.now();
  const EVENT_PER_SECOND = 1 / 180, EVENT_GAP_MS = 60000;
  function maybeRoadEvent() {
    if (document.hidden || $("#modal") || S.trip?.status !== "travel" || S.trip.carriage || S.trip.boat || Date.now() - lastEventAt < EVENT_GAP_MS) return;
    if (G.minutesLeft(S) < 0.5 || Math.random() > EVENT_PER_SECOND) return;
    lastEventAt = Date.now();
    [S.x, S.y] = livePos();
    if (G.startEvent(S)) { persist(); openEvent(); }
  }

  function tick() {
    if (!S) return;
    const t = G.now();
    { const cm = CARAVANS.tick(S, t); if (cm) { persist(true); toast(cm); if (S.caravanJob === null) Store.change("guards", `${lastJobId}-${S.id}`, (d) => (d && d.status === "signed" ? { ...d, status: "left" } : d)); bump(); } lastJobId = S.caravanJob?.id || lastJobId; }
    tickTimers(t); hallTick(t); discoveryToast(); if (Math.floor(t) % 5 === 0) courierCheck();
    if (typeof IMM !== "undefined") { IMM.tick(S); if (S.lastSeen && t - S.lastSeen > 3600 && !S.trip?.status) IMM.loading("Welcome back to Skyrim"); S.lastSeen = t; }
    if (S.trip?.status === "travel") {
      const out = G.advance(S, t, reachableBags());
      if (out.taken.length || out.bag || out.died || out.encounter || out.arrived) {
        out.taken.forEach((id) => Store.takeBag(id));
        if (out.bag) Store.addBag(out.bag);
        persist(true);
        if (out.died) { SOUND.fx("death"); showMessage("You died", out.died, true); }
        else if (out.encounter) openEncounter();
        else if (out.arrived) {
          SOUND.fx("arrive"); tally("arrivals"); festCount("arrive");
          if (typeof IMM !== "undefined") IMM.bark(S, out.arrived);
          if (!WORLD.places[out.arrived]) {   // free roam or a pin: say what's around
            const near = ROAM.around(S), msg = `You stop in ${ROAM.isRoam(out.arrived) ? out.arrived : `the spot you marked (${out.arrived})`}. ${Terrain.NAMES[Terrain.typeAtPos([S.x, S.y])]} all around.${near.length ? ` Nearby: ${near.join(", ")}.` : " Nothing you know of nearby."}`;
            G.note(S, "🧭 " + msg); toast(msg);
          } else
          toast(`Arrived at ${out.arrived}.` + (G.shopTypes(out.arrived).length ? " Shops are in the Town tab." : DUNGEONS.enterable(out.arrived) ? " You can go inside." : ""));
          selected = null; renderPanel(true);
          caravanPay();
          const jm = TOWNS.checkJobs(S); if (jm.length) { tally("jobs", jm.length); persist(); setTimeout(() => toast(jm.join(" ")), 1500); }
          if (TOWNS.guardCheck(S)) openGuard();
          const qa = QUESTS.active(S).find((a) => a.st.obj.talk === out.arrived);
          if (qa) setTimeout(() => toast(`📜 ${qa.st.title}: "${qa.st.obj.label}" is waiting in the Journal.`), 2500);
          if (out.solIntro) { persist(true); setTimeout(() => showMessage("Quest", out.solIntro), 700); }
        }
      } else { Store.save(S); maybeRoadEvent(); }
    }
    followParty(); checkAmbush(); renderRaid(); soundTick();
    if (S.tut?.step > 0 && TUT[S.tut.step]?.done()) bump();
    if (Math.floor(t) % 5 === 0) { checkAch(); bloodTick(); }
    if (Math.floor(t) % 3 === 0) { const qm = QUESTS.check(S); if (qm.length) { persist(true); showMessage("Quest", qm.join(" ")); } }
    if (Math.floor(t) % 30 === 0) { publishCard(false); publishHome(); publishClan(); }
    if (Math.floor(t) % 60 === 0) BACKUP.autoSave(S);
    renderTop(); renderVitals(); renderTrip(); renderTabs(); hudCompass();
    if (version !== rendered || Date.now() - lastPanelRender > 20000) renderPanel(false);
  }

  /* music follows what you're doing; little sounds for gold and level-ups */
  let lastGold = null, lastPending = null;
  /* what you'd hear right now: the scene, the weather, the ground under your feet ([OURS] sound.js ambience) */
  function ambState(raid) {
    const pos = livePos(), T = typeof Terrain !== "undefined" ? Terrain : null;
    const ty = T ? T.typeAtPos(pos) : 5, wx = WEVENTS.weather(pos)?.id || "clear";
    const near = T ? [[0, 0], [0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]].map(([dx, dy]) => T.typeAtPos([pos[0] + dx, pos[1] + dy])) : [];
    const sky = typeof SKY !== "undefined" ? SKY.state(pos) : null;
    const inTown = !!S.location && !S.trip && TOWNS.isTown(S.location);
    const scene = S.dungeon ? "dungeon" : inTown ? (tab === "town" && townShop === "inn" ? "inn" : tab === "town" && (townShop === "forge" || townShop === "blacksmith") ? "forge" : "town") : "wild";
    const snowy = ty === 11 || ty === 15 || wx === "snow" || wx === "blizzard";
    return {
      scene, weather: wx, tod: G.isNight() ? "night" : "day",
      ground: snowy ? "snow" : [3, 4, 12, 13, 14].includes(ty) ? "stone" : ty === 10 ? "marsh" : "grass",
      leafy: [5, 7, 8, 9].includes(ty), coldLand: [11, 14, 15].includes(ty) || !!sky?.cold, wet: wx === "rain" || wx === "storm" || wx === "blizzard",
      water: near.some((k) => k <= 2), sea: near.includes(0), dwemer: S.dungeon?.theme === "dwemer",
      raid: !!(raid && (S.location === raid.town || (WORLD.places[raid.town] && G.pxDist(pos, WORLD.places[raid.town]) < 120))),
      moving: S.trip?.status === "travel", speed: T ? Math.round(T.speedAt(pos) * 10) / 10 : 1,
      riding: typeof HORSES !== "undefined" && HORSES.riding(S), cart: typeof CARAVANS !== "undefined" && CARAVANS.hasCart(S),
    };
  }
  function soundTick() {
    const raid = WEVENTS.activeRaid();
    try { SOUND.ambience?.(ambState(raid)); } catch (e) { /* sound never breaks the game */ }
    SOUND.mood(S.dungeon ? (S.dungeon.room?.enemy ? "combat" : "dungeon") : S.trip?.status === "encounter" || (raid && S.location === raid.town && !S.trip) ? "combat" : G.isNight() ? "night" : "day");
    if (lastGold != null && S.gold !== lastGold) { SOUND.fx("coin"); if (typeof POLISH !== "undefined") POLISH.gold(S.gold - lastGold); }
    if (lastPending != null && S.pendingLevels > lastPending) { SOUND.fx("levelup", 0.3); if (typeof POLISH !== "undefined") POLISH.levelUp(S.level); }
    lastGold = S.gold; lastPending = S.pendingLevels;
    if (lastDragons != null && (S.dragons || 0) > lastDragons) tally("dragons", (S.dragons || 0) - lastDragons);
    lastDragons = S.dragons || 0;
  }
  function openSound() {
    openModal(`<h2>Settings</h2>${settingsHTML()}
      <button class="btn" data-act="guide" style="width:100%;margin-top:14px">📖 Guide for new players</button>
      ${typeof PATCHNOTES !== "undefined" ? `<button class="btn" data-act="notes" style="width:100%;margin-top:8px">📜 Patch notes</button>` : ""}
      <div class="grid2" style="margin-top:8px">${window.__app ? `<button class="btn" data-act="toupdate">${update?.newer ? "⬆ Update ready" : "Check for updates"}</button>` : ""}<button class="btn" data-act="totitle" ${window.__app ? "" : 'style="grid-column:1/-1"'}>Main menu</button></div>
      <button class="btn pri" data-act="close" style="width:100%;margin-top:10px">Done</button>`);
    const m = $("#modal");
    m.addEventListener("input", onSettingsInput); m.addEventListener("change", onSettingsInput);
  }
  function renderTop() {
    $("#nm").textContent = S.name;
    const where = S.location || (S.trip?.boat ? `at sea on ${S.trip.ship || "the ship"}` : `the wilds of ${G.holdAt(livePos())}`);
    $("#sub").textContent = typeof HUD !== "undefined" ? `${D.RACES[S.race].name} · ${where}` : `Level ${S.level} ${D.RACES[S.race].name} · ${where}`;
    const lb = $("#lvlb"); if (lb && lb.textContent !== String(S.level)) lb.textContent = S.level;
    const wx = WEVENTS.weather(livePos()), dt = WEVENTS.date();
    const clk = $("#clock"), when = `${dt.day} ${dt.month}, ${G.clockText().split(", ")[1]}`;
    if (typeof SKY !== "undefined") {   // a small drawn sky: sun or moon phase, clouds, rain, snow
      const st = SKY.state(livePos()), ic = SKY.icon(st, 22);
      if (clk._ic !== ic) { clk._ic = ic; clk.innerHTML = `<span class="skyw">${ic}</span><span class="skyt"></span>`; }
      const txt = `${when} · ${wx.name}`; const tEl = clk.querySelector(".skyt"); if (tEl && tEl.textContent !== txt) { tEl.textContent = txt; clk.title = txt; }
    } else clk.textContent = `${G.isNight() ? "🌙" : "☀️"} ${when} · ${wx.icon} ${wx.name}`;
    $("#goldv").textContent = `${S.gold} gold`;
  }
  function hudCompass() {
    if (typeof HUD === "undefined") return;
    const pos = livePos(), tr = S.trip, W = G.MAP_W, H = G.MAP_H;
    let target = null;
    if (tr && tr.status === "travel" && tr.path) { target = tr.path.slice(tr.idx + 1).find((p) => G.pxDist(pos, p) > 4) || tr.dest; }
    const near = [], unk = [];
    for (const [n, p] of Object.entries(WORLD.places)) {
      if (n === S.location) continue;
      const d = G.pxDist(pos, p);
      if (known(n)) { if (d < 170) near.push({ name: n, pos: p, kind: p[2], known: true, d }); }
      else if (d < 70) unk.push({ name: n, pos: p, kind: p[2], known: false, d });
    }
    near.sort((a, b) => a.d - b.d); unk.sort((a, b) => a.d - b.d);
    const qp = questPos(), qa = qp ? QUESTS.active(S)[0] : null;
    const raid = WEVENTS.activeRaid();
    HUD.compass({ pos, target, W, H, places: [...near.slice(0, 8), ...unk.slice(0, 3)],
      players: others.filter((o) => !o.hiding && sameMap(o)).map((o) => ({ name: o.name, pos: otherPos(o) })).filter((o) => G.pxDist(pos, o.pos) < 220).slice(0, 8),
      quest: qp ? { pos: qp, name: qa ? QUESTS.target(qa.st) : "" } : null,
      raid: raid && WORLD.places[raid.town] ? { town: raid.town, pos: WORLD.places[raid.town] } : null });
  }
  function renderVitals() {
    const hp = G.curHealth(S), mh = G.maxHealth(S);
    if (typeof HUD !== "undefined") {
      const w = G.carried(S), cap = G.capacity(S), bty = TOWNS.totalBounty(S);
      HUD.bars($("#vitals"), { hp, hpMax: mh, mp: G.maxMagicka(S), mpMax: G.maxMagicka(S), sp: G.maxStamina(S), spMax: G.maxStamina(S), w, cap, over: G.overweight(S),
        danger: S.trip?.status === "encounter" || !!S.dungeon?.room?.enemy, hidden: !!S.ambush, vampire: !!S.vampire, werewolf: !!S.werewolf,
        rested: G.rested(S) ? ((S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested") : "", sick: !!(S.sanguinare && !S.vampire), bounty: bty, riding: HORSES.riding(S) });
      return;
    }
    const row = (label, cur, max, color) => `<div class="vital"><small><span>${label}</span><span class="num">${Math.round(cur)}/${max}</span></small><div class="bar"><i style="width:${pct(cur, max)}%;background:${color}"></i></div></div>`;
    const w = G.carried(S), cap = G.capacity(S);
    $("#vitals").innerHTML = row("Health", hp, mh, "var(--hp)") + row("Magicka", G.maxMagicka(S), G.maxMagicka(S), "var(--mp)") + row(G.overweight(S) ? "Weight · too heavy" : "Weight", w, cap, w > cap ? "var(--ember)" : "#8a7a5c");
  }
  function renderTrip() {
    const el = $("#trip"), tr = S.trip;
    const put = (html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };   // only redraw on change, so taps don't get lost
    if (S.dungeon) { put(`<div class="trip enc"><div class="row"><b>🕯 You're inside ${esc(S.dungeon.place)}</b><button class="btn danger sm" data-act="dun">Go back in</button></div></div>`); return; }
    if (!tr) { put(""); return; }
    if (tr.status === "event") {
      put(`<div class="trip"><div class="row"><b>🛤 Something by the road</b><button class="btn pri sm" data-act="openev">Look</button></div></div>`);
      return;
    }
    if (tr.status === "encounter") {
      put(`<div class="trip enc"><div class="row"><b>⚠️ ${esc(tr.encounter.name)} blocks the road</b><button class="btn danger sm" data-act="openenc">Face it</button></div></div>`);
      return;
    }
    const mins = tripMinutesLeft(), total = Math.max(mins, tr.total || mins), p = pct(total - mins, total);
    const here = livePos(), ground = Terrain.NAMES[Terrain.typeAtPos(here)], sp = Terrain.speedAt(here);
    const pace = sp >= 1.2 ? "fast going" : sp >= 0.95 ? "steady" : sp >= 0.6 ? "slow going" : "very slow going";
    const html = `<div class="trip"><div class="row"><b>${esc(tr.origin)} → ${esc(tr.destName)}</b><span class="num sub">${fmtMin(mins)}</span>${!tr.carriage && !tr.boat && HORSES.present(S) ? `<button class="btn sm" data-act="hride">${HORSES.riding(S) ? "Walk" : "Ride"}</button>` : ""}<button class="btn sm" data-act="stop">Stop</button></div>
      <div class="bar"><i style="background:var(--frost)"></i></div>
      <div class="sub">${tr.boat ? `⛵ aboard ${esc(tr.ship || "the ship")} · nothing attacks a ship at sea` : tr.carriage ? "🐎 by carriage · safe on the Jarl's roads" : `${esc(ground)} · ${pace} · ${HORSES.riding(S) ? `riding ${esc(S.horse.name)}` : HORSES.present(S) ? `walking beside ${esc(S.horse.name)}` : G.overweight(S) ? "too heavy to run" : "on foot"}`}${S.follower ? ` · ${esc(TOWNS.FOLLOWERS[S.follower.id][0])} with you` : ""}</div>
      ${tr.log.length ? `<div class="sub">${esc(tr.log[0])}</div>` : `<div class="sub">The trip keeps going while the page is closed.</div>`}</div>`;
    put(html.replace(/<\/div>$/, `<div class="tripvig"></div></div>`));
    const bar = el.querySelector(".bar i"); if (bar) bar.style.width = `${p}%`;
    if (tr.boat && typeof SOLART !== "undefined") { const tv = el.querySelector(".tripvig"); if (tv && !tv.dataset.sea) { tv.dataset.sea = 1; tv.innerHTML = SOLART.sea(); } }   // at sea (solart.js)
    else if (typeof FXART !== "undefined") FXART.vignette(el.querySelector(".tripvig"), { ground, progress: p / 100, riding: HORSES.riding(S), carriage: !!tr.carriage, boat: !!tr.boat, horse: HORSES.riding(S) ? HORSES.coat(S.horse.coat)[2] : null, look: myLook(), reduce: reduceMotion, sky: typeof SKY !== "undefined" ? SKY.state(here) : null });
  }
  function renderTabs() {
    tabsEl.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on);
      const needDot = (b.dataset.tab === "hero" && (S.pendingLevels > 0 || PERKS.pointsLeft(S) > 0)) || (b.dataset.tab === "log" && (invites.length || chests.length || chatUnread() > 0));
      if (needDot && !b.querySelector(".dot")) b.insertAdjacentHTML("beforeend", '<span class="dot"></span>');
      if (!needDot) b.querySelector(".dot")?.remove();
    });
    const sb = $("#socBtn"); if (sb) { const n = socialBadge(); sb.classList.toggle("on", tab === "social"); if (n && !sb.querySelector(".dot")) sb.insertAdjacentHTML("beforeend", '<span class="dot"></span>'); if (!n) sb.querySelector(".dot")?.remove(); }
  }

  // ------------------------------------------------------------ map
  let lastFrame = 0;
  /* battery: draw the map only while it's on screen, at 30 fps while something moves and 8 fps when all is still */
  let mapOnScreen = true, mapTouchedAt = 0, mapObserved = null;
  function frame(ts) {
    requestAnimationFrame(frame);
    const m = $("#map");
    if (m && mapObserved !== m && window.IntersectionObserver) { mapObserved = m; new IntersectionObserver((es) => { mapOnScreen = es[0].isIntersecting; }).observe(m); }
    const moving = S?.trip?.status === "travel" || performance.now() - mapTouchedAt < 1500;
    const wx = WEVENTS.weather(livePos()).id, weatherAnim = !reduceMotion && !["clear", "cloudy", "fog"].includes(wx);
    const mapAnim = typeof MAPART !== "undefined" && MAPART.active();   // a discovery burst playing
    const raidNow = typeof RAIDART !== "undefined" && WEVENTS.activeRaid();
    const fxNow = typeof FXART !== "undefined" && S ? FXART.state(S) : null;   // spell and shout effects on the map
    if (document.hidden || !m || !mapOnScreen || ts - lastFrame < (moving || mapAnim ? 33 : weatherAnim || (raidNow && !reduceMotion) || (fxNow?.anim && !reduceMotion) ? 66 : 125)) return;
    lastFrame = ts;
    const pos = livePos();
    if (follow) center = pos;
    view = {
      region: WORLD.regionOf(pos),
      raid: raidNow ? raidView(raidNow) : null, fx: fxNow,
      player: pos, name: S.name, look: myLook(), moving: S.trip?.status === "travel", trail: S.trip?.trail, dest: S.trip ? { pos: S.trip.dest, name: S.trip.destName, roam: !!S.trip.roam } : null, spot: selected === "__spot" ? roamSpot : null,
      route: S.trip && !S.trip.boat ? (S.trip.status === "travel" ? S.trip.path.slice(S.trip.idx + 1) : [S.trip.dest]) : null,
      discovered: S.discovered, explored: [...S.explored, pos], others: others.filter((o) => sameMap(o) && (!o.hiding || G.pxDist(livePos(), otherPos(o)) < MP.NEAR_PX)).map((o) => ({ name: (o.clan ? `[${o.clan}] ` : "") + o.name + (party?.members.some((m) => m.id === o.id) ? " ⚑" : ""), pos: otherPos(o), look: o.look, race: o.race, party: !!party?.members.some((m) => m.id === o.id) })),
      rulers: Object.entries(WARS.rulers(S)).map(([hold, c]) => ({ hold, color: c.colors[0] })),
      banners: CLANS.banners(homeDocs, S, VISITS.record(S)).filter((b) => WORLD.places[b.town]).map((b) => ({ ...b, pos: WORLD.places[b.town].slice(0, 2) })),
      cleared: clearedLeft(), bags: visibleBags(), selected: selected && WORLD.places[selected] ? selected : null, t: ts / 1000, zoom, center, reduceMotion, weather: WEVENTS.weather(pos).id, quest: questPos(), mask: typeof PRIESTS !== "undefined" ? PRIESTS.marker(S)?.pos : null, tmaps: typeof EXPLORE !== "undefined" ? EXPLORE.marks(S) : [], pins: (S.pins || []).map((p) => ({ pos: [p.x, p.y], label: `${p.icon} ${p.label}`, on: selected === "__pin:" + p.id })),
      routes: party ? others.filter((o) => o.moving && o.path?.length > 1 && party.members.some((m) => m.id === o.id)).map((o) => ({ path: o.path, from: otherPos(o), name: o.name })) : [], horse: HORSES.riding(S) ? HORSES.coat(S.horse.coat)[2] : null, cart: CARAVANS.hasCart(S), caravans: CARAVANS.all().map((c) => { const cp = CARAVANS.pos(c); return { cp, c }; }).map(({ cp, c }) => ({ pos: cp, visible: G.pxDist(cp, pos) < 160 || S.discovered.some((n) => WORLD.places[n] && ["city", "town"].includes(WORLD.places[n][2]) && G.pxDist(cp, WORLD.places[n]) < 45), khajiit: c.line.khajiit, moving: c.phase === "road", mine: S.caravanJob?.id === c.id, label: c.line.name.replace(/'s caravan$/, "") })).filter((c) => !(c.mine && S.trip?.caravan)), hall: S.discovered.includes(HALL.TOWN) || known(HALL.TOWN) ? { pos: HALL.POS, label: `Hall of the North · ${HALL.progress().name}` } : null,
    };
    WorldMap.draw($("#map"), view);
  }
  let lookCache = { k: "", v: null };
  function myLook() {
    const k = JSON.stringify([S.race, S.loadout, G.loadout(S).equipment, S.vampire, S.werewolf]);
    if (k !== lookCache.k) lookCache = { k, v: HEROART.lookOf(S) };
    return lookCache.v;
  }
  function bindMap() {
    const c = $("#map"), pts = new Map();
    let down = null, moved = false, pinch = null;
    const setZoom = (z, fx, fy) => {     // zoom keeping the point under the fingers still
      z = Math.max(1, Math.min(6, z));
      if (view.transform && fx != null) {
        const { k, ox, oy } = view.transform, mx = (fx - ox) / k / WorldMap.W, my = (fy - oy) / k / WorldMap.H;
        const r = c.getBoundingClientRect(), nk = k * z / zoom;
        center = [mx - (fx - r.width / 2) / nk / WorldMap.W, my - (fy - r.height / 2) / nk / WorldMap.H];
        follow = false;
      }
      zoom = z; $("#zoomBtn").textContent = zoom > 1.01 ? "－" : "＋";
    };
    let press = null, pressed = false;
    c.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]); c.setPointerCapture(e.pointerId); mapTouchedAt = performance.now();
      clearTimeout(press); pressed = false;
      if (pts.size === 1) press = setTimeout(() => {   // hold a finger still on the map: drop a pin there
        if (moved || pts.size !== 1 || !view.transform) return;
        pressed = true; const r = c.getBoundingClientRect(); const [wx, wy] = screenToWorld(e.clientX - r.left, e.clientY - r.top);
        if (navigator.vibrate) try { navigator.vibrate(30); } catch { /* not allowed */ }
        openPinDialog(wx, wy);
      }, 550);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom }; moved = true; }
      else { down = { x: e.clientX, y: e.clientY, c: [...center] }; moved = false; }
    });
    c.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      mapTouchedAt = performance.now();
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const r = c.getBoundingClientRect();
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        setZoom(pinch.z * d / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        return;
      }
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 8) { moved = true; clearTimeout(press); }
      if (moved && zoom > 1 && view.transform) { follow = false; center = [down.c[0] - dx / (WorldMap.W * view.transform.k), down.c[1] - dy / (WorldMap.H * view.transform.k)]; }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p] = [...pts.values()]; down = { x: p[0], y: p[1], c: [...center] }; return; }
      if (!down) return;
      const wasMove = moved; down = null; clearTimeout(press);
      if (wasMove || pressed || !view.transform || e.type === "pointercancel") return;
      const r = c.getBoundingClientRect();
      const pin = pinAt(e.clientX - r.left, e.clientY - r.top);
      selected = pin ? "__pin:" + pin.id : WorldMap.placeAt(view, e.clientX - r.left, e.clientY - r.top, known);
      if (!selected) { const w = screenToWorld(e.clientX - r.left, e.clientY - r.top); if (WORLD.onMap(w)) { roamSpot = w; selected = "__spot"; } }
      renderPicked();
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", (e) => { e.preventDefault(); mapTouchedAt = performance.now(); const r = c.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }
  let roamSpot = null;
  function renderPicked() {
    const el = $("#picked");
    if (!selected) { el.classList.add("hide"); return; }
    if (selected === "__spot") {   // free roam: any spot on the map
      if (!roamSpot) { selected = null; return renderPicked(); }
      const r = ROAM.plan(S, roamSpot);
      el.classList.remove("hide");
      el.innerHTML = r.err ? `<div class="t"><b>🧭 ${esc(r.err)}</b><span>Tap somewhere on land to roam there.</span></div><button class="iconbtn" data-act="unpick" aria-label="Close">✕</button>`
        : `<div class="t"><b>🧭 ${esc(r.name[0].toUpperCase() + r.name.slice(1))}</b><span>${esc(r.ground)} · ${esc(G.holdAt(r.pos))} · ${fmtMin(G.minutesTo(S, r.pos))}${r.snapped ? " · nearest dry land" : ""}</span></div>
        <button class="btn pri" data-act="go" data-place="__spot">Walk here</button><button class="btn" data-act="spotpin">Pin</button><button class="iconbtn" data-act="unpick" aria-label="Close">✕</button>`;
      return;
    }
    if (selected.startsWith("__pin:")) {
      const p = (S.pins || []).find((q) => "__pin:" + q.id === selected); if (!p) { selected = null; return renderPicked(); }
      el.classList.remove("hide");
      el.innerHTML = `<div class="t"><b>${esc(p.icon)} ${esc(p.label)}</b><span>Your pin · ${esc(G.holdAt([p.x, p.y]))} · ${fmtMin(G.minutesTo(S, [p.x, p.y]))}</span></div>
        <button class="btn pri" data-act="go" data-place="${esc(selected)}">Travel</button>${party ? `<button class="btn" data-act="pinshare" data-id="${esc(p.id)}">Share</button>` : ""}<button class="btn" data-act="pindel" data-id="${esc(p.id)}">Remove</button><button class="btn" data-act="unpick" aria-label="Close">✕</button>`;
      return;
    }
    const [x, y, kind] = WORLD.places[selected];
    const here = S.location === selected;
    const mins = here ? 0 : G.minutesTo(S, [x, y]);
    el.classList.remove("hide");
    el.innerHTML = `<div class="t"><b>${esc(selected)}</b><span>${KIND[kind]} · ${esc(G.holdAt([x, y]))}${S.discovered.includes(selected) ? "" : " · not yet visited"}${here ? " · you are here" : ` · ${fmtMin(mins)}`}</span></div>
      ${here ? (DUNGEONS.enterable(selected) && !S.trip ? `<button class="btn danger" data-act="enter">Go inside</button>` : "") : `<button class="btn pri" data-act="go" data-place="${esc(selected)}">Travel</button>`}<button class="iconbtn" data-act="unpick" aria-label="Close">✕</button>`;
  }

  // ------------------------------------------------------------ travel
  function travelTo(name) {
    let pos;
    if (name === "__bag") { const b = myBag(); if (!b) return toast("Your bag is gone."); pos = [b.x, b.y]; name = "your lost bag"; }
    else if (name === "__spot") { const cb = CARAVANS.roamBlocked(S); if (cb) return toast(cb); const r = roamSpot && ROAM.plan(S, roamSpot); if (!r || r.err) return toast(r?.err || "Pick a spot first."); pos = r.pos; name = r.name; }
    else if (name.startsWith("__pin:")) { const p = (S.pins || []).find((q) => "__pin:" + q.id === name); if (!p) return toast("That pin is gone."); pos = [p.x, p.y]; name = p.label; }
    else pos = WORLD.places[name].slice(0, 2);
    if (S.location === name) return toast(`You're already in ${name}.`);
    const err = G.startTrip(S, name, pos);
    if (err) return toast(err);
    selected = null; renderPicked();
    if (party && party.leader === S.id) {
      const near = others.filter((o) => party.members.some((m) => m.id === o.id) && G.pxDist(otherPos(o), [S.x, S.y]) <= 40);
      S.trip.speed = MP.partySpeed(S, { members: near.map((o) => ({ id: o.id })) }, near);
      Store.change("parties", party.id, (p) => ({ ...p, trip: { destName: name, dest: pos, start: [S.x, S.y], speed: S.trip.speed, t: G.now() } }));
      if (near.length) toast(`Your party follows. Pace set by the slowest: ${fmtMin(G.minutesLeft(S))}.`);
    }
    S.trip.total = G.minutesLeft(S);
    if (ROAM.isRoam(name)) { S.trip.roam = true; roamSpot = null; }
    toast(`You set off ${ROAM.isRoam(name) ? "into" : "for"} ${name}. About ${fmtMin(S.trip.total)}.`);
    follow = true;
    $("#mapwrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    persist(true);
  }

  // ------------------------------------------------------------ encounters & messages
  function openModal(html, cls = "") {
    closeModal();
    const m = document.createElement("div");
    m.className = "modal"; m.id = "modal";
    m.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    m.addEventListener("click", onPanelClick);
    document.body.appendChild(m);
    m.querySelector("button")?.focus();
  }
  const closeModal = () => $("#modal")?.remove();
  function showMessage(title, text, bad) {
    if (/quest/i.test(title) || /📜/.test(text)) SOUND.fx("quest");
    if (typeof POLISH !== "undefined") POLISH.fromText(text);
    openModal(`${/^You died/.test(title) ? UIART.death(320, 120) : typeof EVENTART !== "undefined" ? EVENTART.story(title, text) : ""}<h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn ${bad ? "danger" : "pri"}" data-act="close" style="width:100%">Continue</button>`, bad ? "enc" : "");
  }
  function fightLog(f) {
    return `${typeof FIGHTART !== "undefined" ? FIGHTART.placeholder(f, S) : ""}<details ${f.log.length < 9 ? "open" : ""}><summary class="sub" style="cursor:pointer;min-height:36px">Fight log (${f.turn} turns) — [n] is the tactic rule that fired</summary><div class="flog">${f.log.map((l) =>
      `<div><span class="r">${l.turn ? `T${l.turn}` : "⚡"}${l.rule != null ? `<br>[${l.rule || "–"}]` : ""}</span><span>${esc(l.me)}${l.me && l.them ? " · " : ""}${esc(l.them)}${l.hp != null ? ` <span class="sub">(you ${l.hp} · foe ${l.ehp})</span>` : ""}</span></div>`).join("")}</div></details>`;
  }
  function openEncounter(note) {
    const e = S.trip?.encounter;
    if (!e) return;
    openModal(`<p class="sub danger-${e.danger}" style="margin:0">${e.danger === "high" ? "Deadly" : e.danger === "medium" ? "Dangerous" : "Minor"} encounter · ${esc(e.hold)}${G.isNight() ? " · night" : ""}</p>
      <h2 style="margin:4px 0 8px">${esc(e.name)}</h2><p>${esc(e.text)}</p>
      ${note ? `<p class="sub">${esc(note)}</p>` : ""}${(() => { const am = typeof AMMO !== "undefined" ? AMMO.status(S) : null; return am && !am.best ? ammoNote() : ""; })()}${typeof HORSEBACK !== "undefined" ? HORSEBACK.note(S) : ""}
      <div class="grid2" style="margin:10px 0"><div class="vital"><small><span>You</span><span class="num">${Math.round(G.curHealth(S))}/${G.maxHealth(S)}</span></small><div class="bar"><i style="width:${pct(G.curHealth(S), G.maxHealth(S))}%;background:var(--hp)"></i></div></div>
      <div class="vital"><small><span>${esc(e.name)}</span><span class="num">${e.hp}/${e.health}</span></small><div class="bar"><i style="width:${pct(e.hp, e.health)}%;background:var(--ember)"></i></div></div></div>
      <div class="grid2">
        <button class="btn danger" data-act="enc" data-a="fight">⚔️ Fight</button>
        <button class="btn" data-act="enc" data-a="flee">🏃 Flee</button>
        <button class="btn" data-act="enc" data-a="sneak">🥷 Sneak past</button>
        <button class="btn" data-act="enc" data-a="potion" ${G.countRestore(S, "health") ? "" : "disabled"}>🧪 Potion (${G.countRestore(S, "health")})</button>
        ${e.bountyHold ? `<button class="btn pri" data-act="enc" data-a="pay" style="grid-column:1/-1">⚖️ Pay your ${esc(e.bountyHold)} bounty (${TOWNS.bounty(S, e.bountyHold)} gold)</button>` : ""}
      </div><p class="sub" style="margin-bottom:0">Fighting uses your <b>${esc(S.loadout)}</b> tactics. A hidden start gives a sneak attack.</p>`, "enc");
  }
  const skillLine = (r) => (r.skills || []).length ? `<p class="sub">📈 ${r.skills.map(esc).join(" · ")}</p>` : "";
  function openEvent(note) {
    const ev = S.trip?.event;
    if (!ev) return;
    const shop = ev.shop ? `<div class="list" style="margin:8px 0">${ev.shop.map((i) => { const p = G.buyPrice(S, i, null); return `<div class="item"><div class="t">${esc(D.ITEMS[i].name)}<span>${esc(G.itemStats(i))} · ${D.ITEMS[i].weight} wt</span></div><span class="num gold">${p}</span><button class="btn sm" data-act="evbuy" data-item="${i}" ${S.gold >= p ? "" : "disabled"}>Buy</button></div>`; }).join("")}</div><p class="sub">You have ${S.gold} gold.</p>` : "";
    const choices = ev.shop ? [["leave", "Say goodbye and move on"]] : G.eventChoices(S);
    openModal(`${typeof EVENTART !== "undefined" ? EVENTART.road(ev) : ""}<p class="sub" style="margin:0">On the road · ${esc(G.holdAt([S.x, S.y]))} · ${esc(Terrain.NAMES[Terrain.typeAtPos([S.x, S.y])])}</p>
      <h2 style="margin:4px 0 8px">Something by the road</h2><p>${esc(ev.text)}</p>
      ${note ? `<p class="sub">${esc(note)}</p>` : ""}${shop}
      <div class="evc">${choices.map(([c, label]) => `<button class="btn ${c === "leave" ? "" : "pri"}" data-act="ev" data-c="${c}">${esc(label)}</button>`).join("")}</div>`);
  }
  function eventAction(c) {
    const evBefore = S.trip?.event;
    const r = G.eventChoice(S, c);
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (r.fight || r.died) return showFightResult(r);
    if (S.trip?.status === "event") return openEvent([r.text, ...(r.skills || [])].filter(Boolean).join(" "));
    if (c === "leave") return closeModal();
    openModal(`${typeof EVENTART !== "undefined" && evBefore ? EVENTART.road(evBefore) : ""}<h2>On the road</h2><p>${esc(r.text)}</p>${skillLine(r)}
      <button class="btn pri" data-act="close" style="width:100%">Continue to ${esc(S.trip?.destName || "the road")}</button>`);
  }
  function encounterAction(a) {
    const r = G.encounterAction(S, a);
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (a === "potion" && S.trip?.status === "encounter") return openEncounter(r.text);
    showFightResult(r);
  }
  function showFightResult(r) {
    if (r.fight) { const inf = CURSE.maybeInfect(S, r.fight.e); if (inf) { persist(); setTimeout(() => toast(inf), 1800); } }
    if (r.fight && !r.died && !r.fight.nonlethal) { tally("foes"); warPoint("fight", G.holdAt(livePos())); if ((r.fight.e?.tags || []).includes("undead")) festCount("undead"); }
    if (r.fight || r.died) SOUND.fight(r); else if (/potion|drink/i.test(r.text || "")) SOUND.fx("potion");
    const skills = (r.skills || []).length ? `<p class="sub">📈 ${r.skills.map(esc).join(" · ")}</p>` : "";
    if (r.died) {
      openModal(`<h2>💀 Defeated</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}<p>${esc(r.died)}</p><button class="btn danger" data-act="close" style="width:100%">Continue</button>`, "enc");
      return;
    }
    if (!r.fight && S.trip?.status === "encounter") return openEncounter(r.text);
    const loot = r.fight ? [r.gold ? `${r.gold} gold` : "", ...(r.loot || [])].filter(Boolean) : [];
    openModal(`<h2>${r.fight ? "Victory" : "Away"}</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}
      ${loot.length ? `<p>Loot: <b>${loot.map(esc).join(", ")}</b></p>` : ""}${skills}
      <button class="btn pri" data-act="close" style="width:100%">Continue to ${esc(S.trip?.destName || "the road")}</button>`);
  }

  // ------------------------------------------------------------ dungeons
  let dunNote = null;   // result of the last action, shown above the map
  // ------------------------------------------------------------ cleared places: live "opens again in" timers
  // timers count in-game time (1 in-game day = 2 real hours)
  const fmtLeft = (sec) => { const g = Math.max(0, Math.ceil(sec * G.GAME_SPEED)), d = Math.floor(g / 86400), h = Math.floor((g % 86400) / 3600), m = Math.floor((g % 3600) / 60);
    return d ? `${d} day${d > 1 ? "s" : ""} ${h} h` : h ? `${h} h ${String(m).padStart(2, "0")} min` : `${Math.max(1, m)} min`; };
  const cdSpan = (until) => `<span class="cd num" data-until="${Math.ceil(until)}">${fmtLeft(until - G.now())}</span>`;
  function clearedLeft() {
    const out = {}, t = G.now();
    for (const n of Object.keys(S.cleared || {})) { const left = DUNGEONS.enterable(n) ? DUNGEONS.refillLeft(S, n, t) : 0; if (left > 0) out[n] = left; }
    return out;
  }
  function refillCard(l, left) {
    const total = DUNGEONS.REFILL_SECONDS || 216000, pct = Math.max(0, Math.min(100, 100 - (left / total) * 100));
    const realH = left / 3600;
    return `<div class="refill"><div class="t">🔒 Cleared. Opens again in ${cdSpan(G.now() + left)}</div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div><p class="sub" style="margin:4px 0 0">In-game time: something new moves in on ${esc(G.clockText(G.now() + left))} (about ${realH >= 1 ? Math.round(realH) + " real hour" + (Math.round(realH) === 1 ? "" : "s") : Math.ceil(left / 60) + " real minutes"}).</p></div>`;
  }
  function clearedPanel() {
    const list = Object.entries(clearedLeft()).sort((a, b) => a[1] - b[1]);
    if (!list.length) return "";
    return `<div class="panel"><h2>Cleared places</h2><p class="sub">When each one opens again.</p><div class="list">${list.map(([n, left]) => `<div class="item"><div class="t">${esc(n)}<span>${esc(DUNGEONS.describe(n))}</span></div>${cdSpan(G.now() + left)}</div>`).join("")}</div></div>`;
  }
  function tickTimers(t) {
    let done = false;
    for (const el of document.querySelectorAll(".cd[data-until]")) { const left = +el.dataset.until - t; if (left <= 0) done = true; else { const txt = fmtLeft(left); if (el.textContent !== txt) el.textContent = txt; } }
    if (done) renderPanel(true);
  }

  // ---- the trade window: Buy and Sell side by side, like Skyrim's barter menu
  let shopMode = "buy";
  const econB = (item) => (typeof ECON !== "undefined" ? ECON.badge(S.location, item) : "");   // ▲/▼ price arrows (economy.js)
  function barterHTML(shop, open, wanted, shopRow) {
    const wt = Math.round(G.carried(S)), cap = Math.round(G.capacity(S));
    const head = `<div class="barter-head"><span>💰 <b class="gold num">${S.gold}</b> gold</span>${Number.isFinite(wt) && cap ? `<span>⚖ ${wt}/${cap}</span>` : ""}</div>
      <div class="seg"><button class="${shopMode === "buy" ? "on" : ""}" data-act="smode" data-id="buy">Buy</button><button class="${shopMode === "sell" ? "on" : ""}" data-act="smode" data-id="sell">Sell</button></div>`;
    const mk = typeof ECON !== "undefined" ? ECON.report(S, S.location) : "";
    if (shopMode === "buy") return head + mk + (typeof TOMES !== "undefined" ? TOMES.stockAt(S.location, shop) : D.SHOP_STOCK[shop] || []).map((i) => shopRow(i)).join("");
    const eq = new Set(Object.values(G.loadout(S).equipment || {}));
    const fence = shop === "fence" || (typeof TOWNS !== "undefined" && TOWNS.canFence(S));
    const rows = S.inv.filter((r) => !eq.has(r.id) && D.ITEMS[r.item] && !["golden_claw", "dragonstone"].includes(r.item) && (!r.stolen || fence))
      .map((r) => ({ r, p: G.sellPrice(S, r) })).sort((a, b) => b.p * b.r.qty - a.p * a.r.qty);
    const ok = open && !wanted;
    return head + mk + (rows.length ? rows.map(({ r, p }) => `<div class="item">${ICONART.item(r.item, 34, r)}<div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}${r.stolen ? ' <span class="danger-high">stolen</span>' : ""}<span>${esc(G.itemStats(r.item))} · ${D.ITEMS[r.item].weight} wt</span></div>${econB(r.item)}<span class="num gold">${p}</span><button class="btn sm pri" data-act="sell" data-id="${r.id}" ${ok ? "" : "disabled"}>Sell</button>${r.qty > 1 ? `<button class="btn sm" data-act="sellall" data-id="${r.id}" ${ok ? "" : "disabled"}>All ${G.lotPrice ? G.lotPrice(S, r.item, r.qty, "sell", r) : p * r.qty}</button>` : ""}</div>`).join("")
      : `<p class="sub">Nothing to sell${eq.size ? " (worn gear stays on you)" : ""}.</p>`) + (S.inv.some((r) => r.stolen) && !fence ? `<p class="sub">Stolen things only sell to a fence.</p>` : "");
  }
  // ------------------------------------------------------------ the bard's corner: verses, likes, the Song of the North
  let verseDocs = [], likeDocs = [], deedPick = null, verseDraft = "", songSeen = null;
  const bardOf = (town) => { const names = { Whiterun: "Mikael", Riverwood: "Sven", Solitude: "Lisette", Windhelm: "Ambarys's bard Lurbuk", Markarth: "Rorlund", Riften: "Talsgar", Morthal: "Lurbuk", Dawnstar: "Karita", Falkreath: "Inge" };
    const n = names[town] || "Talsgar the Wanderer"; return { name: n.replace(/^Ambarys's bard /, ""), race: ["Lisette", "Karita", "Inge"].includes(n) ? "breton" : "nord", sex: ["Lisette", "Karita", "Inge"].includes(n) ? "f" : "m", role: "bard", title: "Bard" }; };
  const visibleVerses = () => verseDocs.filter((v) => !chatMuted().includes(v.uid));
  function onSong() {
    const song = BARDS.current(verseDocs, likeDocs, chatMuted());
    const m = BARDS.reward(S, song);
    if (m) { persist(true); SOUND.fx("levelup"); toast(m); }
    if (tab === "town" && townShop === "inn") bump();
  }
  function bardHTML(l) {
    const song = BARDS.current(verseDocs, likeDocs, chatMuted()), cnt = BARDS.counts(likeDocs), wk = BARDS.week();
    const songHtml = `<div class="bardsong"><div class="ico-h">${NPCART.portrait(bardOf(l), 44)}<div><h3>🎵 Song of the North</h3><span class="sub">${song.final ? `Made from the best verses of ${BARDS.weekName(song.week)}` : "This week's song is still being written"}</span></div></div>
      ${song.lines.length ? `<ol>${song.lines.map((v) => `<li><i>“${esc(v.text)}”</i><small>— ${esc(v.name)}${v.uid === S.id ? " (you)" : ""} · 👍 ${cnt[v.id] || 0}</small></li>`).join("")}</ol><button class="btn pri" data-act="bardsing" style="width:100%">🎵 Ask the bard to sing it</button>`
        : `<p class="sub" style="margin:6px 0">${Store.online ? "Nobody has written a verse yet. Be the first!" : "You're playing offline, so the bard sings the old songs:"}</p>${Store.online ? "" : `<p class="sub"><i>${esc(TOWNS.BARD ? TOWNS.BARD[0] : "“Ragnar the Red, who came riding to Whiterun…”")}</i></p>`}`}</div>`;
    const today = BARDS.day(), wrote = verseDocs.some((v) => v.id === `${S.id}-${today}`);
    const pending = BARDS.mine(verseDocs, S.id).filter((v) => BARDS.weekOf(v) === wk).length;
    const deeds = BARDS.deeds(S);
    const writeHtml = wrote ? `<p class="sub">You've written today's verse. Come back tomorrow (in-game) for another.</p>`
      : pending >= BARDS.MAX_PENDING ? `<p class="sub">You have ${BARDS.MAX_PENDING} verses waiting for this week's song. Let them be heard first.</p>`
      : `<p class="sub" style="margin:4px 0">Pick one of your deeds, or write your own line (up to ${BARDS.MAX_LEN} letters). Players who like it can cheer for it; the best lines become next week's song.</p>
        <div class="deedchips">${deeds.map(([tag, text], i) => `<button class="chip ${deedPick === i ? "on" : ""}" data-act="deedpick" data-id="${i}">${esc(text)}</button>`).join("")}</div>
        <div class="chatrow"><input id="versein" maxlength="${BARDS.MAX_LEN}" placeholder="Your verse" value="${esc(verseDraft)}" autocomplete="off" aria-label="Your verse"><button class="btn pri" data-act="versewrite">Write</button></div>`;
    const recent = visibleVerses().filter((v) => BARDS.weekOf(v) >= wk - 1).sort((a, b) => b.t - a.t).slice(0, 12);
    const listHtml = recent.length ? recent.map((v) => { const own = v.uid === S.id, did = BARDS.liked(likeDocs, v.id, S.id);
      return `<div class="verse"><div class="vt"><i>“${esc(v.text)}”</i><small>${esc(v.name)}${own ? " (you)" : ""} · ${esc(v.town || "")} · Day ${v.day}</small>${own ? "" : ` <button class="linkbtn" data-act="chatmute" data-id="${esc(v.uid)}" data-name="${esc(v.name)}">hide this author</button>`}</div><button class="btn sm ${did ? "" : "pri"}" data-act="verselike" data-id="${esc(v.id)}" ${own || did || !Store.online ? "disabled" : ""} aria-label="Cheer">👍 ${cnt[v.id] || 0}</button></div>`; }).join("")
      : `<p class="sub">No new verses yet.</p>`;
    return `${songHtml}<h3 style="margin-top:12px">✒ Write a verse</h3>${Store.online ? writeHtml : `<p class="sub">Go online to share verses with other players.</p>`}<h3 style="margin-top:12px">New verses</h3>${listHtml}`;
  }
  function singSong() {
    const song = BARDS.current(verseDocs, likeDocs, chatMuted());
    if (!song.lines.length) return;
    const n = bardOf(S.location);
    SOUND.fx("quest");
    openModal(`<div class="singing"><div class="bardp">${NPCART.portrait(n, 72)}</div><h2>${esc(n.name)} sings</h2><p class="sub">The inn goes quiet. Mugs are lowered.</p>
      ${song.lines.map((v, i) => `<div class="sline" style="animation-delay:${(reduceMotion ? 0 : 0.4 + i * 1.1).toFixed(1)}s">“${esc(v.text)}”<small>${esc(v.name)}</small></div>`).join("")}
      <div class="evc"><button class="btn pri" data-act="close">Raise your mug</button></div></div>`);
    if (!reduceMotion) song.lines.forEach((_, i) => setTimeout(() => SOUND.fx("coin"), (400 + i * 1100)));
  }

  function mineHTML(l) {
    const m = SMITH.MINES[l]; if (!m) return "";
    const left = SMITH.mineLeft(S, l), pick = SMITH.count(S, "pickaxe") > 0;
    const ores = [...new Set(m[1].map(([o]) => D.ITEMS[o].name))].join(", ");
    return `<div class="card"><h3>⛏ ${esc(m[0])}</h3><p class="sub" style="margin-top:0">Ore here: ${esc(ores)}. Sometimes a gem.</p>
      ${left ? `<div class="refill"><div class="t">The veins are bare. They grow back in ${cdSpan(G.now() + left)}</div></div>`
        : `<button class="btn pri" data-act="mine" style="width:100%" ${pick ? "" : "disabled"}>${pick ? "Mine the veins" : "You need a pickaxe (blacksmiths and general stores)"}</button>`}</div>`;
  }
  function placeHere() {
    const l = S.location;
    if (l && !S.trip && POWERS.STONE_AT[l]) {
      return `<div class="panel" style="border-color:var(--gold)"><h2>${esc(l)}</h2>${PLACEART.scene(l)}<p class="sub">A standing stone. You can carry the blessing of one stone at a time; touching another replaces it.${S.stone ? ` Yours now: ${esc(POWERS.STONES[S.stone][0])}.` : ""}</p>
        <div class="list">${POWERS.STONE_AT[l].map((id) => `<div class="item ${S.stone === id ? "on" : ""}">${UIART.stone(id, 34)}<div class="t">${esc(POWERS.STONES[id][0])}<span>${esc(POWERS.STONES[id][1])}</span></div><button class="btn sm pri" data-act="stone" data-id="${id}" ${S.stone === id ? "disabled" : ""}>${S.stone === id ? "Yours" : "Choose"}</button></div>`).join("")}</div></div>`;
    }
    if (l === "High Hrothgar" && !S.trip) return `<div class="panel" style="border-color:var(--gold)"><h2>High Hrothgar</h2>${PLACEART.scene(l)}<p class="sub">Seven thousand steps up the Throat of the World, the Greybeards wait in silence.</p>${typeof NPCART !== "undefined" ? NPCART.talk("High Hrothgar", "greybeard", S) : ""}
      <button class="btn pri" data-act="greybeards" style="width:100%" ${S.greybeards ? "disabled" : ""}>${S.greybeards ? "They have taught you all they will, for now" : "Speak with the Greybeards"}</button></div>`;
    if (l && !S.trip && SMITH.MINES[l] && !TOWNS.isTown?.(l) && !DUNGEONS.enterable(l)) return `<div class="panel"><h2>${esc(l)}</h2>${PLACEART.scene(l)}${mineHTML(l)}</div>`;
    const solLine = typeof SOL !== "undefined" && l ? SOL.placeLine(S, l) : "";
    if (l && !S.trip && WORLD.places[l] && !DUNGEONS.enterable(l)) return `<div class="panel"><h2>${esc(l)}</h2>${PLACEART.scene(l)}<p class="sub" style="margin:0">${esc(G.holdAt(WORLD.places[l]))}${G.shopTypes(l).length || TOWNS.isTown(l) ? " · shops, inn and more in the Town tab" : ""}</p>${solLine ? `<p class="sub">${esc(solLine)}</p>` : ""}</div>`;
    if (!l || !DUNGEONS.enterable(l) || S.trip) return "";
    const left = DUNGEONS.refillLeft(S, l), lvl = { 1: 1, 2: 6, 3: 12 }[DUNGEONS.info(l).tier];
    const th = DUNGEONS.info(l).theme, rec = th === "lair" ? 20 : th === "giantcamp" ? 10 : lvl;
    return `<div class="panel" style="border-color:var(--ember)"><h2>${esc(l)}</h2>${PLACEART.scene(l)}<p class="sub">${esc(DUNGEONS.describe(l))} · good from about level ${rec}. Inside, you pick your own way room by room down to the boss. Health doesn't come back on its own in there, and you can leave between rooms whenever you like.</p>
      ${left ? refillCard(l, left) : `<button class="btn danger" data-act="enter" style="width:100%">🕯 Go inside</button>${coopUI ? coopUI.lobbyHTML(l) : ""}`}${SMITH.MINES[l] ? `<div style="margin-top:10px">${mineHTML(l)}</div>` : ""}</div>`;
  }
  function closeDungeon() { $("#dun")?.remove(); }
  function dunMap(d) {
    const rows = d.rows, W = 320, gap = 54, H = rows.length * gap + 10;
    const next = new Set(DUNGEONS.nextChoices(S));
    const xy = (r, c) => [W / (rows[r].length + 1) * (c + 1), 30 + r * gap];
    let lines = "", nodes = "";
    rows.forEach((row, r) => row.forEach((n, c) => n.links.forEach((j) => {
      if (r + 1 >= rows.length) return;
      const [x1, y1] = xy(r, c), [x2, y2] = xy(r + 1, j), walked = d.path?.some((p, i) => p[0] === r && p[1] === c && d.path[i + 1]?.[1] === j && d.path[i + 1]?.[0] === r + 1);
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${walked ? "#c9a75e" : "#3d434b"}" stroke-width="${walked ? 3 : 2}" stroke-dasharray="${walked ? "" : "4 4"}"/>`;
    })));
    rows.forEach((row, r) => row.forEach((n, c) => {
      const [x, y] = xy(r, c), isNext = !d.room && (d.row === r - 1) && next.has(c), here = d.row === r && d.col === c, done = d.path?.some((p) => p[0] === r && p[1] === c);
      nodes += `<g class="node ${isNext ? "next" : ""} ${here ? "here" : ""} ${done && !here ? "done" : ""} ${n.type === "boss" ? "boss" : ""}" ${isNext ? `data-act="droom" data-c="${c}" role="button" tabindex="0" aria-label="${DUNGEONS.LABEL[n.type]}"` : ""}>
        <circle cx="${x}" cy="${y}" r="${n.type === "boss" ? 21 : 17}"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="${n.type === "boss" ? 20 : 16}">${DUNGEONS.ICON[n.type]}</text></g>`;
    }));
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dungeon map">${lines}${nodes}</svg>`;
  }
  function renderDungeon() {
    const d = S.dungeon;
    if (!d) return closeDungeon();
    let el = $("#dun");
    if (!el) { el = document.createElement("div"); el.id = "dun"; el.className = "dun"; el.addEventListener("click", onPanelClick); el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.act) onPanelClick(e); }); document.body.appendChild(el); }
    const hp = G.curHealth(S), mh = G.maxHealth(S), r = d.room;
    const total = d.rows.length, step = Math.max(0, d.row + 1);
    const chestOpen = dunNote?.roomType === "treasure" && /click|inside|salvage/i.test(dunNote.text || "");
    const res = dunNote ? `<div class="card res ${dunNote.roomType === "rest" ? "rest" : ""}">${dunNote.roomType === "treasure" ? DUNART.chestHTML(chestOpen) : ""}<p>${esc(dunNote.text)}</p>${dunNote.fight ? fightLog(dunNote.fight) : ""}
      ${dunNote.stripLoot?.length || dunNote.stripGold ? DUNART.lootStrip(dunNote.stripGold, dunNote.stripLoot) : ""}${dunNote.loot?.length || dunNote.gold ? `<p class="sub" style="margin:2px 0 0">Loot: ${[dunNote.gold ? dunNote.gold + " gold" : "", ...(dunNote.loot || [])].filter(Boolean).map(esc).join(", ")}</p>` : ""}${skillLine(dunNote)}</div>` : "";
    let main;
    if (d.done) main = `<div class="card"><h3>🏆 ${esc(d.place)} is cleared</h3>${DUNART.lootStrip(d.gold, d.found)}<p class="sub">Found so far: ${d.gold} gold${d.found.length ? ", " + d.found.map(esc).join(", ") : ""}.</p><button class="btn pri" data-act="dleave" style="width:100%">Head back outside</button></div>`;
    else if (r) {
      const e = r.enemy;
      main = `<div class="card ${e ? "foe" : ""} ${r.type === "rest" ? "rest" : ""}">${PLACEART.room(r.type)}<h3>${DUNGEONS.ICON[r.type]} ${e ? esc(e.name) : DUNGEONS.LABEL[r.type]}</h3><p>${esc(r.text)}</p>
        ${e ? `<div class="vital"><small><span>${esc(e.name)}</span><span class="num">${e.hp}/${e.health} · hits for ~${Math.round(e.damage)}</span></small><div class="bar"><i style="width:100%;background:var(--ember)"></i></div></div>` : ""}
        <div class="evc">${DUNGEONS.roomChoices(S).map(([c, label]) => `<button class="btn ${["fight", "pick", "rest", "read", "pray", "open", "loot", "burn", "dash"].includes(c) || c.startsWith("set:") ? (e ? "danger" : "pri") : ""}" data-act="dact" data-c="${esc(c)}">${esc(label)}</button>`).join("")}</div>
        ${e ? `<p class="sub" style="margin-bottom:0">Fighting uses your <b>${esc(S.loadout)}</b> tactics.</p>` : ""}</div>`;
    } else {
      const nx = DUNGEONS.nextChoices(S), row = d.rows[d.row + 1];
      main = `<div class="card">${d.row < 0 ? PLACEART.scene(d.place) : ""}<h3>${d.row < 0 ? "The entrance" : "Which way?"}</h3><p class="sub">${d.row < 0 ? `You light a torch and step into ${esc(d.place)}.` : "The passage splits."} Tap a glowing room on the map, or pick here:</p>
        <div class="evc">${nx.map((c) => `<button class="btn ${row[c].type === "boss" ? "danger" : ""}" data-act="droom" data-c="${c}">${DUNGEONS.ICON[row[c].type]} ${DUNGEONS.LABEL[row[c].type]}</button>`).join("")}</div></div>`;
    }
    if (coopUI && d.run) { if (!d.done && !r && coopUI.waiting()) main = coopUI.waitHTML(); else if (!d.done && !r) main = coopUI.behindHTML() + main; if (d.done) main += coopUI.chestHTML(); }
    el.innerHTML = `<div class="in">
      <div class="hd"><h2>🕯 ${esc(d.place)}</h2><button class="btn sm" data-act="dmin">🎒 Pack</button>${d.done || r?.type === "boss" ? "" : `<button class="btn sm" data-act="dleave">Leave</button>`}</div>
      <div class="vital"><small><span>Health${r ? "" : " · no natural healing in here"}</span><span class="num">${Math.round(hp)}/${mh}</span></small><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--hp)"></i></div></div>
      ${coopUI && d.run ? coopUI.bar() : ""}<p class="sub" style="margin:0">Room ${step} of ${total} · found ${d.gold} gold${d.found.length ? ` and ${d.found.length} item${d.found.length > 1 ? "s" : ""}` : ""} · ${G.countRestore(S, "health")} healing potions</p>
      ${res}${main}
      <div class="card dmapcard"><div class="legend">${["fight", "elite", "trap", "treasure", "puzzle", "rest", "mystery", "boss"].filter((k) => d.rows.some((row) => row.some((n) => n.type === k))).map((k) => `<span>${DUNGEONS.ICON[k]} ${DUNGEONS.LABEL[k]}</span>`).join("")}</div>${DUNART.mapHTML(d)}</div>
    </div>`;
    el.scrollTop = 0;
    DUNART.after(el, reduceMotion);
    if (dunNote?.hurt && !reduceMotion) { el.classList.remove("hurt"); void el.offsetWidth; el.classList.add("hurt"); }
  }
  function dungeonRoom(c) {
    const ce = S.dungeon?.run && coopUI ? coopUI.beforePick() : null;
    if (ce) return toast(ce);
    const d = S.dungeon, err = DUNGEONS.enterRoom(S, +c);
    if (err) return toast(err);
    d.path = d.path || []; d.path.push([d.row, d.col]);
    dunNote = null; persist(); renderDungeon();
    if (d.run && coopUI) coopUI.afterPick();
  }
  function exploreAct(what, id) {
    const r = EXPLORE.act(S, what, id);
    if (r.html) return openModal(r.html);
    if (r.err) return toast(r.err);
    SOUND.fx(r.got ? "coin" : "click");
    if (r.got) G.note(S, `🔍 ${r.text}`);
    persist(true); renderPanel(true);
    openModal(`<h2>${what === "xdig" ? "⛏ Buried treasure" : "🔍 Searching"}</h2><p>${esc(r.text)}</p>${r.book ? `<button class="btn" data-act="xread" data-id="${esc(r.book.id)}" style="width:100%;margin-bottom:6px">📖 Read "${esc(r.book.title)}"</button>` : ""}<button class="btn pri" data-act="close" style="width:100%">Continue</button>`);
  }
  function dungeonAct(c) {
    const runId = S.dungeon?.run || null, roomType = S.dungeon?.room?.type, hp0 = G.curHealth(S), found0 = S.dungeon?.found.length || 0, gold0 = S.dungeon?.gold || 0;
    const r = DUNGEONS.act(S, c);
    if (S.dungeon) { const newFound = S.dungeon.found.slice(found0); r.stripLoot = [...new Set([...(r.loot || []), ...newFound])]; r.stripGold = r.gold || (S.dungeon.gold - gold0) || 0; }
    r.roomType = roomType; r.hurt = roomType === "trap" && G.curHealth(S) < hp0 - 0.5;
    if (r.fight) { const inf = CURSE.maybeInfect(S, r.fight.e); if (inf) setTimeout(() => toast(inf), 1800); }
    if (r.fight && !r.died) { tally("foes"); warPoint("fight", G.holdAt(WORLD.places[S.dungeon?.place] || livePos())); if ((r.fight.e?.tags || []).includes("undead")) festCount("undead"); }
    if (r.fight || r.died) SOUND.fight(r); else if (r.trap || /trap|dart|blade/i.test(r.text || "")) SOUND.fx("hit");
    if (r.bag) Store.addBag(r.bag);
    persist(true);
    if (runId && coopUI) coopUI.afterAct(r, runId);
    if (r.died) { dunNote = null; closeDungeon(); renderPanel(true); openModal(`<h2>💀 Defeated</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}<p>${esc(r.died)}</p><button class="btn danger" data-act="close" style="width:100%">Continue</button>`, "enc"); return; }
    if (r.partyChest && party) {
      const id = `${S.id}-${Math.floor(G.now())}`;
      Store.put("chests", id, { gold0: r.partyChest.gold, items0: r.partyChest.items, goldLeft: r.partyChest.gold, itemsLeft: r.partyChest.items, taken: [],
        members: party.members, place: S.dungeon?.place || "", byName: S.name, t: G.now() });
      postNews(`💰 ${S.name}'s party cleared ${S.dungeon?.place}. The chest is waiting to be shared.`);
    } else if (r.partyChest) { S.gold += r.partyChest.gold; r.partyChest.items.forEach((i) => G.give(S, i)); }
    if (r.cleared) { tally("dungeons"); warPoint("dungeon", G.holdAt(WORLD.places[S.dungeon?.place] || livePos())); const jm = TOWNS.checkJobs(S); if (jm.length) { tally("jobs", jm.length); r.text += " " + jm.join(" "); } postNews(`🏆 ${S.name} cleared ${S.dungeon?.place}.`); }
    persist(true);
    dunNote = r; renderDungeon();
  }


  // ------------------------------------------------------------ Skyrim-style menu (Items / Magic / Skills), SkyUI-like lists
  let sky = { page: "items", cat: "all", sort: "name", dir: 1, sel: null };
  const ICONS = {
    gear: '<circle cx="12" cy="5" r="2.5"/><path d="M7 21l1-8-3-3 4-2h6l4 2-3 3 1 8M10 13h4"/>',
    all: '<path d="M4 6h16M4 12h16M4 18h16"/>', weapons: '<path d="M5 19L17 7l2-4-4 2L3 17zM7 14l3 3"/>', apparel: '<path d="M8 3l4 2 4-2 4 4-3 3v11H7V10L4 7z"/>',
    potions: '<path d="M10 3h4M10 3v5l-4 8a4 4 0 004 6h4a4 4 0 004-6l-4-8V3"/>', scrolls: '<path d="M7 4h10a2 2 0 010 4H9v12H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 8h8v10a2 2 0 01-2 2H9"/>',
    books: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5"/>', ingredients: '<path d="M12 21V11M12 11c-4 0-6-3-6-7 4 0 6 3 6 7zm0 0c4 0 6-3 6-7-4 0-6 3-6 7z"/>',
    misc: '<path d="M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10"/>', food: '<path d="M4 11h16a8 8 0 01-16 0zM9 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
    destruction: '<path d="M12 3c3 4 6 6 6 10a6 6 0 01-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-2-1-4 0-6z"/>', restoration: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="5"/>',
    alteration: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/>', conjuration: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>', illusion: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    powers: '<path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>', shouts: '<path d="M4 9v6h4l6 5V4L8 9zM17 8a5 5 0 010 8M19 5a9 9 0 010 14"/>', effects: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
    combat: '<path d="M5 19L19 5M14 5h5v5"/>', magic: '<circle cx="12" cy="12" r="8"/><path d="M12 4l2 8-2 8-2-8z"/>', stealth: '<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/>', other: '<circle cx="12" cy="12" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.misc}</svg>`;
  const ITEM_CATS = [["gear", "Worn"], ["all", "All"], ["weapons", "Weapons"], ["apparel", "Apparel"], ["potions", "Potions"], ["scrolls", "Scrolls"], ["books", "Books"], ["ingredients", "Ingredients"], ["food", "Food"], ["misc", "Misc"]];
  const catOf = (it) => it.slot === "food" ? "food" : it.slot === "weapon" || it.slot === "ammo" ? "weapons" : G.ARMOR_SLOTS.includes(it.slot) ? "apparel" : ["potion", "poison"].includes(it.slot) ? "potions"
    : it.slot === "scroll" ? "scrolls" : it.slot === "tome" || it.slot === "recipe" ? "books" : it.slot === "ingredient" ? "ingredients" : "misc";
  const MAGIC_CATS = [["all", "All"], ["destruction", "Destruction"], ["restoration", "Restoration"], ["alteration", "Alteration"], ["conjuration", "Conjuration"], ["illusion", "Illusion"], ["powers", "Powers"], ["shouts", "Shouts"], ["effects", "Active effects"]];
  const SKILL_CATS = [["all", "All"], ["combat", "Warrior"], ["magic", "Mage"], ["stealth", "Thief"], ["other", "Other"]];
  const SKILL_GROUP = { combat: "Warrior", magic: "Mage", stealth: "Thief" };
  function openMenu(page = "items") { SOUND.fx("page"); sky = { ...sky, page, cat: page === "items" ? "gear" : "all", sel: null }; renderMenu(); }
  function closeMenu() { $("#sky")?.remove(); }
  function itemStat(r) {
    const it = D.ITEMS[r.item];
    if (it.slot === "weapon") return it.damage + (r.temper || 0);
    if (G.ARMOR_SLOTS.includes(it.slot)) return (it.armor || 0) + (r.temper || 0);
    if (it.restore) return it.restore[1];
    if (it.effects) return it.effects[0][1];
    if (it.slot === "soulgem") return it.charge;
    return null;
  }
  function itemRows() {
    const eqIds = new Set(Object.values(G.loadout(S).equipment));
    const q = (sky.q || "").toLowerCase();
    let rows = S.inv.filter((r) => D.ITEMS[r.item] && (sky.cat === "all" || catOf(D.ITEMS[r.item]) === sky.cat) && (!q || ((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name).toLowerCase().includes(q))).map((r) => {
      const it = D.ITEMS[r.item];
      return { id: r.id, r, it, name: (r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + it.name + (r.nm ? ` “${r.nm}”` : ""), stat: itemStat(r), weight: +(it.weight * r.qty).toFixed(2), value: it.value, eq: eqIds.has(r.id) };
    });
    const k = sky.sort, d = sky.dir;
    rows.sort((a, b) => (b.eq - a.eq) || (k === "name" ? a.name.localeCompare(b.name) * d : (((a[k] ?? -1) - (b[k] ?? -1)) * -d) || a.name.localeCompare(b.name)));
    return rows;
  }
  function itemDetail(row) {
    const { r, it } = row, eq = row.eq;
    const canShop = S.location && G.shopTypes(S.location).length && G.shopsOpen();
    const gems = S.inv.filter((x) => D.ITEMS[x.item]?.slot === "soulgem");
    const stats = [];
    if (it.slot === "weapon") stats.push(["Damage", it.damage + (r.temper ? ` (+${r.temper})` : "")], ["Skill", it.skill], ["Hands", it.hands === 2 ? "Two" : "One"]);
    if (G.ARMOR_SLOTS.includes(it.slot)) stats.push(["Armor", (it.armor || 0) + (r.temper ? ` (+${r.temper})` : "")], ["Type", it.type || "—"], ["Slot", it.slot]);
    stats.push(["Weight", +(it.weight * r.qty).toFixed(2)], ["Value", it.value]);
    if (r.qty > 1) stats.push(["Count", r.qty]);
    const lines = [];
    if (it.enchant) lines.push(`${it.enchant.magnitude} ${it.enchant.effect} damage per hit · charge ${Math.round(100 * (r.charge || 0) / it.enchant.capacity)}%`);
    if (it.staff) lines.push(`Casts ${D.SPELLS[it.staff.spell].name} instead of swinging · charge ${Math.round(100 * MAGIC.staffCharge(r) / it.staff.capacity)}% (${Math.floor(MAGIC.staffCharge(r) / it.staff.perCast)} casts)`);
    if (it.aenchant) lines.push(`${[it.aenchant, ...(it.aenchant.more || [])].map((e) => e.key.startsWith("dae:") ? e.name : `${e.name} ${e.mag}`).join(" · ")} while worn`);
    if (it.desc) lines.push(it.desc);   // Daedric artifacts and other named items
    if (it.effects) lines.push(it.effects.map(([e, m, dd]) => `${e} ${m}${dd * 5 >= 60 ? ` for ${Math.round(dd * 5 / 60)} min` : ""}`).join(" · "));
    else if (it.restore) lines.push(`Restores ${it.restore[1]} ${it.restore[0]}`);
    if (it.slot === "scroll" || it.slot === "tome") lines.push(`${it.slot === "tome" ? "Teaches" : "Casts"} ${D.SPELLS[it.spell].name}${it.slot === "tome" && S.spells.includes(it.spell) ? " (you know it)" : ""}`);
    if (it.slot === "ingredient" && TOWNS.INGREDIENT_FX[r.item]) lines.push("Effects: " + TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? e : "?").join(", "));
    if (it.slot === "material") lines.push("Used at the forge to improve gear.");
    if (r.stolen) lines.push("Stolen. Only a fence will buy it.");
    if (it.slot === "recipe" && typeof CRAFTFAIR !== "undefined") lines.push(CRAFTFAIR.knows(S, it.recipe) ? "You already know these forge recipes." : `Read it to learn new forge recipes: ${Object.keys(SMITH.RECIPES).filter((k) => SMITH.RECIPES[k].needs === it.recipe).map((k) => D.ITEMS[k].name).join(", ")}.`);
    if (r.cv != null && it.slot !== "potion") lines.push(`You made this. Shops pay no more than its materials were worth${r.nm ? "" : ", but you can give it a name"}.`);
    const acts = [];
    if (G.SLOTS.includes(it.slot)) acts.push(eq ? `<button class="btn" data-act="uneq" data-slot="${it.slot}">Unequip</button>` : `<button class="btn pri" data-act="eq" data-id="${r.id}">Equip</button>`);
    if (it.slot === "tome") acts.push(`<button class="btn pri" data-act="read" data-id="${r.id}">Read</button>`);
    if (it.slot === "recipe") acts.push(`<button class="btn pri" data-act="cfread" data-id="${r.id}">Read</button>`);
    if (typeof CRAFTFAIR !== "undefined" && CRAFTFAIR.canName(r)) acts.push(`<span class="cf-name"><input id="cfname-${r.id}" maxlength="${CRAFTFAIR.NAME_MAX}" placeholder="Name it" value="${esc(r.nm || "")}" aria-label="Name for this item"><button class="btn" data-act="cfname" data-id="${r.id}">${r.nm ? "Rename" : "Name it"}</button></span>`);
    if (it.slot === "potion") acts.push(`<button class="btn pri" data-act="drinkrow" data-id="${r.id}">Drink</button>`);
    if (it.slot === "poison") acts.push(`<button class="btn pri" data-act="poison" data-id="${r.id}">Coat weapon</button>`);
    if (it.slot === "ingredient") acts.push(`<button class="btn" data-act="eat" data-id="${r.id}">Eat</button>`);
    if (it.slot === "food" && r.item !== "fishing_rod") acts.push(`<button class="btn pri" data-act="eatfood" data-id="${r.id}">Eat${it.dish ? "" : " (raw)"}</button>`);
    if (it.dish) lines.push(`${it.desc}. A new meal replaces the last one's effect.`);
    if (it.enchant || it.staff) acts.push(...gems.map((g) => `<button class="btn" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`));
    if (canShop) acts.push(`<button class="btn" data-act="sell" data-id="${r.id}">Sell · ${G.sellPrice(S, r)} gold</button>`);
    if (typeof ECON !== "undefined" && !it.noTrade && !["golden_claw", "dragonstone"].includes(r.item)) { const bp = ECON.bestPlace(S, r); if (bp && bp.p > 1) lines.push(`Sells best in ${bp.to} right now (about ${bp.p} gold each).`); }
    return `<div class="sky-detail"><div class="sky-ico">${ICONART.item(r.item, 64, r)}</div><h3>${esc(row.name)}</h3><div class="sky-stats">${stats.map(([k, v]) => `<div><span>${k}</span><b class="num">${esc(String(v))}</b></div>`).join("")}</div>
      ${lines.map((l) => `<p class="sub">${esc(l)}</p>`).join("")}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  // ---- magic
  const inTactics = (a) => G.loadout(S).rules.some((r) => r.do === a);
  // pictures for spells, powers, shouts and stones in menus (uiart.js)
  function magicIcon(id, size = 24) {
    const [k, a] = String(id).split(":");
    if (k === "spell") return UIART.spell(a, size);
    if (k === "shout") return UIART.shout(a, size);
    if (k === "power") return a === "stone" && S.stone ? UIART.stone(S.stone, size) : a === "race" ? UIART.power(S.race, size) : UIART.action("power:beast", size);
    if (k === "fx" && a === "stone" && S.stone) return UIART.stone(S.stone, size);
    return "";
  }
  function magicRows() {
    const out = [];
    for (const id of S.spells) { const sp = D.SPELLS[id]; if (!sp) continue; out.push({ id: `spell:${id}`, cat: sp.school.toLowerCase(), name: sp.name, cost: sp.kind === "utility" ? null : G.spellCost(S, sp), sub: `${sp.school} · ${sp.level || "Novice"}` }); }
    out.push({ id: "power:race", cat: "powers", name: POWERS.RACE[S.race][0], cost: null, sub: POWERS.powerReady(S, "race") ? "Ready" : "Used today" });
    if (S.werewolf) out.push({ id: "power:beast", cat: "powers", name: "Beast Form", cost: null, sub: CURSE.beastReady(S) ? "Ready" : "Used today" });
    if (POWERS.stoneHasPower(S)) out.push({ id: "power:stone", cat: "powers", name: POWERS.STONES[S.stone][0], cost: null, sub: POWERS.powerReady(S, "stone") ? "Ready" : "Used today" });
    for (const [id, [name, words]] of Object.entries(POWERS.SHOUTS)) if (words.some((w) => POWERS.known(S, w))) out.push({ id: `shout:${id}`, cat: "shouts", name, cost: null, sub: words.map((w) => POWERS.known(S, w) ? (POWERS.unlocked(S, w) ? w : w + "🔒") : "···").join(" ") });
    const t = G.now();
    for (const f of (S.fx || []).filter((f) => f.until > t)) out.push({ id: `fx:${f.name}:${f.until}`, cat: "effects", name: f.name, cost: null, sub: `${f.mag} · ${Math.ceil((f.until - t) / 60)} min` });
    for (const g of gearFx()) out.push({ id: `fx:gear:${g.from}:${g.key}`, cat: "effects", name: fxLabel(g), cost: null, sub: `Worn: ${g.from}` });
    if (G.rested(S)) out.push({ id: "fx:rested", cat: "effects", name: (S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested", cost: null, sub: `${Math.ceil((S.rested - t) / 60)} min` });
    if (S.stone) out.push({ id: "fx:stone", cat: "effects", name: POWERS.STONES[S.stone][0], cost: null, sub: "Standing stone" });
    return out.filter((r) => sky.cat === "all" ? !r.id.startsWith("fx:") : r.cat === sky.cat);
  }
  function magicDetail(row) {
    const [kind, arg] = row.id.split(":");
    let desc = "", acts = [];
    if (kind === "spell") {
      const sp = D.SPELLS[arg];
      const fail = MAGIC.failChance(S, arg);
      desc = `${MAGIC.describe(sp)} · ${sp.level || "Novice"} ${sp.school} · ${row.cost == null ? "no magicka: a short rest between casts" : `${row.cost} magicka`}${MAGIC.dualable(sp) ? ` (dual-cast: ${Math.round(row.cost * MAGIC.DUAL_COST)} for ×${MAGIC.DUAL_POWER} power)` : ""}${fail ? ` · ⚠ above your ${sp.school} (${G.skill(S, sp.school)} of ${MAGIC.REQ[sp.level]}): costs more and fizzles ${Math.round(fail * 100)}% of the time` : ""}`;
      if (MAGIC.outOfFight(sp)) { const cd = MAGIC.cdLeft(S, arg); acts.push(`<button class="btn pri" data-act="castout" data-id="${esc(arg)}" ${cd ? "disabled" : ""}>${cd ? `Ready in ${Math.ceil(cd)} s` : "Cast now"}</button>`); }
    } else if (kind === "power") desc = arg === "race" ? POWERS.RACE[S.race][1] + " Once a day." : POWERS.STONES[S.stone][1];
    else if (kind === "shout") {
      const sh = POWERS.SHOUTS[arg], lv = POWERS.level(S, arg);
      desc = `${sh[3]} ${lv ? `You can shout ${lv} word${lv > 1 ? "s" : ""}; cooldown ${sh[2][lv - 1]} s.` : "Unlock its first word with a dragon soul."}`;
      acts.push(...sh[1].filter((w) => POWERS.known(S, w) && !POWERS.unlocked(S, w)).map((w) => `<button class="btn" data-act="unlock" data-id="${w}" ${(S.souls || 0) > 0 ? "" : "disabled"}>Unlock ${w} (dragon soul: ${S.souls || 0})</button>`));
      if (POWERS.ROAD_SHOUTS.includes(arg) && lv) acts.push(`<button class="btn pri" data-act="roadshout" data-id="${arg}" ${POWERS.voiceReady(S) ? "" : "disabled"}>Shout now</button>`);
    } else return `<div class="sky-detail"><h3>${esc(row.name)}</h3><p class="sub">${esc(row.sub)}</p></div>`;
    const usable = (kind === "spell" && D.SPELLS[arg]?.kind !== "utility") || kind === "power" || (kind === "shout" && !POWERS.ROAD_SHOUTS.includes(arg) && POWERS.level(S, arg));
    if (usable) acts.unshift(inTactics(row.id) ? `<button class="btn" data-act="skytacx" data-id="${esc(row.id)}">Remove from tactics</button>` : `<button class="btn pri" data-act="skytac" data-id="${esc(row.id)}">Use first in every fight</button>`);
    return `<div class="sky-detail">${magicIcon(row.id, 64) ? `<div class="sky-ico">${magicIcon(row.id, 64)}</div>` : ""}<h3>${esc(row.name)}</h3><p class="sub">${esc(desc)}</p>${usable && inTactics(row.id) ? '<p class="sub">In your tactics. Fine-tune when it fires in the Tactics tab.</p>' : ""}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  // ---- what your worn gear and potions add (shown next to skills)
  function gearFx() {
    const out = [];
    for (const id of Object.values(G.loadout(S).equipment || {})) { const r = G.invRow(S, id), it = r && D.ITEMS[r.item]; if (it?.aenchant) for (const e of [it.aenchant, ...(it.aenchant.more || [])]) if (!e.key.startsWith("dae:")) out.push({ name: e.name, mag: e.mag, key: e.key, from: it.name }); }   // masks carry several
    return out;
  }
  const FX_UNIT = (key) => key.startsWith("dmg:") ? "% damage" : key.startsWith("spell:") ? "% stronger spells" : key === "barter" ? "% better prices" : key === "resist" ? "% resist magic" : key === "carry" ? " carry weight" : key.startsWith("max:") ? " " + key.slice(4) : key.startsWith("skill:") ? " skill" : key.startsWith("cost:") ? "% cheaper" : key.startsWith("regen:") ? "% faster regen" : "";
  const fxLabel = (g) => ["immune", "konahrik"].includes(g.key) ? g.name : `${g.name} +${g.mag}${FX_UNIT(g.key)}`;
  function boost(sk) {
    const leg = typeof LEGEND !== "undefined" ? LEGEND.bonus(S, sk) : 0;
    const add = G.skill(S, sk) - S.skills[sk].lvl - leg, dmg = G.fxSum(S, "dmg:" + sk), spell = G.fxSum(S, "spell:" + sk);
    const bits = [add ? `+${add} from gear/potions` : "", leg ? `+${leg} Legendary` : "", dmg ? `+${dmg}% damage` : "", spell ? `+${spell}% stronger spells` : ""].filter(Boolean);
    return { add: add + leg, lvl: S.skills[sk].lvl + add + leg, any: bits.length > 0, text: bits.join(" · ") };
  }
  const skillNum = (sk) => { const b = boost(sk); return `${b.lvl}${b.any ? `<span class="boost" title="${esc(b.text)}">▲</span>` : ""}`; };
  // ---- what a skill does and how to raise it (skillinfo.js)
  function skillInfoHTML(sk) {
    const i = SKILLINFO.get(S, sk); if (!i) return "";
    return `<div class="sinfo"><p class="sinfo-what">${UIART.skill(sk, 36)}<span>${esc(i.what)}</span></p>${i.now.length ? `<h4>What your level gives</h4><ul>${i.now.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      <h4>How to raise it</h4><ul>${i.raise.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${i.perks ? `<p class="sub">Perks (level needed): ${esc(i.perks)}</p>` : ""}${legendHTML(sk)}</div>`;
  }
  /* Legendary skills (legendary.js): at 100, start the skill again for a permanent star */
  let legendArm = null;
  function legendHTML(sk) {
    if (typeof LEGEND === "undefined") return "";
    const r = LEGEND.row(S, sk), st = r.stars ? `<p class="sub leg-st"><b class="leg-stars">${LEGEND.starText(r.stars)}</b> Legendary ${r.stars}× · +${r.bonus} to ${esc(sk)} for good</p>` : "";
    if (!r.ready) return st + (r.lvl >= 80 ? `<p class="sub">At 100 you can make ${esc(sk)} Legendary: it starts again from ${LEGEND.START}, keeps your perks and gives +${LEGEND.BONUS_PER_STAR} for good.</p>` : "");
    const armed = legendArm === sk;
    return `${st}<div class="leg-box"><p><b>${esc(sk)} is at 100.</b> Make it Legendary: it drops to ${LEGEND.START} and grows again (so your level keeps rising), you keep your perks, and you get +${LEGEND.BONUS_PER_STAR} ${esc(sk)} for good${r.bonus >= LEGEND.MAX_BONUS ? " (bonus already at its most: a star for show)" : ""}.</p>
      <button class="btn ${armed ? "danger" : "pri"}" data-act="legend" data-id="${esc(sk)}">${armed ? `Yes, reset ${esc(sk)} to ${LEGEND.START}` : "⭐ Make Legendary"}</button>${armed ? ` <button class="btn" data-act="legendno">Not now</button>` : ""}</div>`;
  }
  /* a clear view of where your levels stand (top of the Character screen) */
  function progressPanel() {
    if (typeof LEGEND === "undefined") return "";
    const p = LEGEND.progress(S);
    const near = p.closest.map((r) => `<button class="item prog-row" data-act="skinfo" data-id="${esc(r.sk)}">${UIART.skill(r.sk, 24)}<div class="t">${esc(r.sk)} ${r.lvl} → ${r.lvl + 1}<span><span class="bar"><i style="width:${r.pct}%;background:var(--frost)"></i></span>${r.pct}% there</span></div></button>`).join("");
    const ready = p.ready.length ? `<p class="sub leg-ready">⭐ Ready to make Legendary: ${p.ready.map((r) => `<button class="linkbtn" data-act="skinfo" data-id="${esc(r.sk)}">${esc(r.sk)}</button>`).join(", ")}</p>` : "";
    return `<div class="panel prog-panel"><h2>Progress</h2>
      <p class="sub">Level ${p.level} · ${p.charPct}% to level ${p.level + 1}. Every skill point you gain moves this bar (higher skills move it more), so every skill counts.</p>
      <div class="bar"><i style="width:${p.charPct}%;background:var(--gold)"></i></div>
      <p class="sub" style="margin-top:8px">Perk points to spend: <b>${PERKS.pointsLeft(S)}</b>${p.stars ? ` · Legendary stars: <b class="leg-stars">${p.stars}★</b>` : ""}</p>
      <p class="sub">Foes match your <b>fighting level ${p.fightLevel}</b>${p.fightLevel < p.level ? ` (lower than your level ${p.level}: crafting, trading and sneaking don't make the road harder)` : ""}. It follows your best weapon or spell skill and your best armor or defence skill, so better gear and skills always win you fights.</p>
      ${near ? `<h4 style="margin:10px 0 4px">Closest to going up</h4><div class="list">${near}</div>` : ""}${ready}</div>`;
  }
  // ---- skills
  function skillRows() {
    const group = (sk) => Object.entries(D.SKILL_GROUPS).find(([, l]) => l.includes(sk))?.[0];
    return D.ALL_SKILLS.map((sk) => ({ id: sk, name: sk, lvl: boost(sk).lvl, bst: boost(sk), prog: pct(S.skills[sk].xp, F.skillXpNeeded(sk, S.skills[sk].lvl)), g: group(sk), perks: (PERKS.TREES[sk] || []).filter(([id]) => PERKS.rank(S, id)).length }))
      .filter((r) => sky.cat === "all" || (SKILL_GROUP[sky.cat] ? r.g === SKILL_GROUP[sky.cat] : !Object.values(SKILL_GROUP).includes(r.g)))
      .sort((a, b) => sky.sort === "name" ? a.name.localeCompare(b.name) * sky.dir : (b.lvl - a.lvl) * sky.dir);
  }
  function renderMenu() {
    let el = $("#sky");
    if (!el) {
      el = document.createElement("div"); el.id = "sky"; el.className = "sky"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Menu");
      el.addEventListener("click", onPanelClick); document.body.appendChild(el);
      el.addEventListener("input", (e) => { if (e.target.id !== "skysearch") return; sky.q = e.target.value; if (sky.q && sky.cat === "gear") sky.cat = "all"; const pos = e.target.selectionStart; renderMenu(); const q = $("#skysearch"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } });
    }
    const cats = sky.page === "items" ? ITEM_CATS : sky.page === "magic" ? MAGIC_CATS : SKILL_CATS;
    let head = "", list = "", detail = "";
    if (sky.page === "items" && sky.cat === "gear") {
      list = `<div class="sky-doll">${dollScreen()}${typeof AMMO !== "undefined" && AMMO.status(S) && !AMMO.status(S).best ? ammoNote() : ""}<p class="sub" style="text-align:center;margin:8px 0 0">Tap a slot to change what you wear. Loadout: <b>${esc(S.loadout)}</b></p></div>`;
    } else if (sky.page === "items") {
      const rows = itemRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      const arrow = (k) => sky.sort === k ? (sky.dir > 0 ? " ▾" : " ▴") : "";
      head = `<div class="sky-head sky-cols"><button data-act="skysort" data-id="name">Name${arrow("name")}</button><button data-act="skysort" data-id="stat">${{ weapons: "Dmg", apparel: "Armor", potions: "Power" }[sky.cat] || "Stat"}${arrow("stat")}</button><button data-act="skysort" data-id="weight">Wt${arrow("weight")}</button><button data-act="skysort" data-id="value">Value${arrow("value")}</button></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols ${r.id === sky.sel ? "sel" : ""} ${r.eq ? "eq" : ""}" data-act="skysel" data-id="${r.id}"><span class="nm">${ICONART.item(r.r.item, 24, r.r)}${esc(r.name)}${r.r.qty > 1 ? ` <i>(${r.r.qty})</i>` : ""}${r.it.enchant || r.it.aenchant ? ' <i class="ench">✦</i>' : ""}${r.r.stolen ? ' <i class="stolen">✋</i>' : ""}</span><span class="num">${r.stat ?? "–"}</span><span class="num">${r.weight}</span><span class="num">${r.value}</span></button>`).join("") || `<p class="sub sky-empty">${sky.q ? `Nothing called “${esc(sky.q)}” here. Try “All”, or part of the name.` : "Nothing here. Buy things in town or loot them on the road."}</p>`;
      detail = sel ? itemDetail(sel) : "";
    } else if (sky.page === "magic") {
      const rows = magicRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      head = `<div class="sky-head sky-cols2"><span>Name</span><span>Cost</span></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols2 ${r.id === sky.sel ? "sel" : ""} ${inTactics(r.id) ? "eq" : ""}" data-act="skysel" data-id="${esc(r.id)}"><span class="nm sk-nm">${magicIcon(r.id, 26)}<span>${esc(r.name)}<small>${esc(r.sub)}</small></span></span><span class="num">${r.cost ?? ""}</span></button>`).join("") || '<p class="sub sky-empty">Nothing here.</p>';
      detail = sel ? magicDetail(sel) : "";
    } else {
      const rows = skillRows(); const sel = rows.find((r) => r.id === sky.sel) || null;
      head = `<div class="sky-head sky-cols2"><button data-act="skysort" data-id="name">Skill</button><button data-act="skysort" data-id="lvl">Level</button></div>`;
      list = rows.map((r) => `<button class="sky-row sky-cols2 ${r.id === sky.sel ? "sel" : ""}" data-act="skysel" data-id="${esc(r.id)}"><span class="nm">${UIART.skill(r.id, 22)} ${esc(r.name)}<span class="bar"><i style="width:${r.prog}%;background:var(--frost)"></i></span></span><span class="num">${typeof LEGEND !== "undefined" && LEGEND.stars(S, r.id) ? `<b class="leg-stars">${LEGEND.stars(S, r.id)}★</b> ` : ""}${r.lvl}${r.bst.any ? '<span class="boost">▲</span>' : ""}</span></button>`).join("");
      detail = sel ? `<div class="sky-detail"><div class="sky-ico">${UIART.skill(sel.id, 56)}</div><h3>${esc(sel.name)} ${sel.lvl}</h3>${sel.bst.any ? `<p class="sub boost-t">${esc(sel.bst.text)}</p>` : ""}<p class="sub">${S.skills[sel.id].lvl >= 100 ? "At 100: ready to be made Legendary." : `${sel.prog}% of the way to ${sel.lvl + 1}.`} ${sel.perks ? `${sel.perks} perk${sel.perks > 1 ? "s" : ""} taken.` : ""} Perk points to spend: ${PERKS.pointsLeft(S)}.</p>${skillInfoHTML(sel.id)}
        <div class="sky-acts">${PERKS.TREES[sel.id] ? `<button class="btn pri" data-act="skyperks" data-id="${esc(sel.id)}">Perk tree</button>` : ""}</div></div>` : "";
      if (S.pendingLevels > 0) detail = `<div class="sky-detail"><h3>Level up</h3><p class="sub">Choose what grows (+10), like Skyrim.</p><div class="sky-acts"><button class="btn" data-act="lvl" data-a="health">Health</button><button class="btn" data-act="lvl" data-a="magicka">Magicka</button><button class="btn" data-act="lvl" data-a="stamina">Stamina</button></div></div>` + detail;
    }
    const f = new G.Fight(S, { name: "-", health: 1, damage: 0, tags: [] });
    const armor = Math.round(f.armorRating().rating);
    let dmg = 0; for (let i = 0; i < 8; i++) dmg += f.weaponDamage(); dmg = Math.round(dmg / 8);
    const hp = G.curHealth(S), mh = G.maxHealth(S);
    el.innerHTML = `<div class="sky-in">
      <div class="sky-top"><button class="iconbtn" data-act="skyclose" aria-label="Close menu">✕</button>
        <div class="sky-pages">${[["items", "Items"], ["magic", "Magic"], ["skills", "Skills"]].map(([p, l]) => `<button class="sky-page ${p === sky.page ? "on" : ""}" data-act="skytab" data-id="${p}">${l}</button>`).join("")}</div><button class="uxi sky-i" data-act="uxhelp" data-id="pack" aria-label="What is this screen?" aria-expanded="${uxHelpOpen === "pack"}">ⓘ</button></div>
      ${uxHelpOpen === "pack" ? `<div class="uxpop" role="note"><p>${sky.page === "items" ? SCREEN_HELP.pack[2] : sky.page === "magic" ? "Your spells, powers and shouts. Tap one to read it and to add it to your fight tactics." : "Your skills. They grow as you use them; tap one to see its perk tree and how to raise it."}</p><button class="btn sm" data-act="uxhelp" data-id="pack">Got it</button></div>` : ""}
      <div class="sky-cats">${cats.map(([k, l]) => `<button class="sky-cat ${k === sky.cat ? "on" : ""}" data-act="skycat" data-id="${k}" aria-label="${l}">${svgI(k)}<span>${l}</span></button>`).join("")}</div>
      <div class="sky-title">${esc((cats.find(([k]) => k === sky.cat) || cats[0])[1])}</div>
      ${sky.page === "items" ? `<input id="skysearch" class="uxsearch sky-search" type="search" placeholder="🔍 Find an item by name" value="${esc(sky.q || "")}" autocomplete="off" aria-label="Find an item">` : ""}
      ${head}<div class="sky-list">${list}</div>${detail}
      <div class="sky-foot"><span>Armor <b class="num">${armor}</b></span><span>Damage <b class="num">${dmg}</b></span><span>Weight <b class="num">${G.carried(S).toFixed(0)}/${G.capacity(S)}</b></span><span class="gold">${S.gold} gold</span></div>
      <div class="sky-vitals"><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--hp)"></i></div><div class="bar"><i style="width:100%;background:var(--mp)"></i></div><div class="bar"><i style="width:100%;background:var(--sp)"></i></div></div>
    </div>`;
  }

  // ------------------------------------------------------------ dragon attacks (world events)
  // ---- raid / arena / clan art helpers (raidart.js)
  const raPortrait = (id, size) => { if (typeof HEROART === "undefined") return ""; const c = id === S.id ? S : cardOf(id) || ladderDocs.find((d) => d.id === id); return c ? HEROART.portrait(c, size) : ""; };
  function raidView(r) {
    const tl = WEVENTS.tally(r, raidDocs, S), visible = S.discovered.includes(r.town) || G.pxDist(livePos(), WORLD.places[r.town]) < 160;
    return visible ? { pos: WORLD.places[r.town].slice(0, 2), done: tl.total >= tl.need, left: tl.need ? Math.max(0, tl.need - tl.total) / tl.need : 1, fighters: tl.people } : null;
  }
  function renderRaid() {
    const el = $("#raid"); if (!el) return;
    const r = WORLD.isSol(livePos()) ? null : WEVENTS.activeRaid();   // no dragon raids reach you on Solstheim
    if (!r) {
      if (S.raid && !S.raid.claimed) { /* the dragon might have died after the window: nothing to show */ }
      el.innerHTML = ""; return;
    }
    if (raidSeen !== r.id) {
      raidSeen = r.id; SOUND.fx("dragon"); toast(`🐉 A dragon is attacking ${r.town}!`);
      if (!news.some((n) => n.text.includes(r.id))) postNews(`🐉 A dragon is attacking ${r.town}! Every warrior is needed. (${r.id})`);
    }
    const tl = WEVENTS.tally(r, raidDocs, S), left = Math.max(0, Math.ceil((r.end - G.now()) / 60)), done = tl.total >= tl.need;
    const msg = WEVENTS.claim(S, r, raidDocs);
    if (msg) { persist(true); showMessage("The dragon falls", msg); }
    const here = S.location === r.town;
    el.innerHTML = `<div class="trip enc" style="margin-top:10px">${typeof EVENTART !== "undefined" ? EVENTART.raid(r.town, done) : ""}<div class="row"><b>🐉 ${done ? `The dragon over ${esc(r.town)} is dead` : `A dragon is attacking ${esc(r.town)}`}</b><span class="num sub">${done ? "" : `${left} min`}</span></div>
      ${typeof RAIDART !== "undefined" ? RAIDART.raidHealth(tl, raidDocs, r, S, raPortrait) : `<div class="bar"><i style="width:${pct(tl.total, tl.need)}%;background:var(--ember)"></i></div>`}
      <div class="sub">${done ? "Everyone who fought shares the soul and the spoils." : `${tl.total}/${tl.need} damage dealt${tl.people ? ` by ${tl.people} ${tl.people === 1 ? "fighter" : "fighters"}` : ""}. Everyone who hurts it gets its soul, 300 gold, dragon bone and scales. The more people fight, the tougher it gets.`}</div>
      ${done ? "" : here ? `<button class="btn danger" data-act="raidfight" style="width:100%">⚔️ Fight the dragon</button>` : `<button class="btn" data-act="go" data-place="${esc(r.town)}" style="width:100%">Travel to ${esc(r.town)}</button>`}</div>`;
  }
  function raidFight() {
    const r = WEVENTS.activeRaid(); if (!r) return toast("The dragon is gone.");
    const out = WEVENTS.fight(S, r, raidDocs);
    if (!out.fight) return toast(out.text);
    Store.put("raids", `${r.id}-${S.id}`, { raid: r.id, uid: S.id, name: S.name, dmg: S.raid.dmg, t: G.now() });
    if (out.bag) Store.addBag(out.bag);
    if (out.slain) postNews(`🐉 ${S.name} struck the killing blow on the dragon over ${r.town}!`);
    warPoint("raid", G.holdAt(WORLD.places[r.town]));
    persist(true); renderPanel(true); renderRaid();
    showFightResult({ ...out, text: out.text, loot: [], gold: 0 });
  }

  // ------------------------------------------------------------ quests
  function questPos() {
    const act = QUESTS.active(S), mapOf = (x) => { const n = QUESTS.target(x.st); return n && WORLD.places[n] && WORLD.same(WORLD.places[n], [S.x, S.y]); };
    const a = act.find(mapOf) || act[0]; if (!a) return null;
    const n = QUESTS.target(a.st); return n && WORLD.places[n] && S.location !== n ? WORLD.places[n] : null;
  }
  function questPanel() {
    QUESTS.ensure(S);
    const act = QUESTS.active(S);
    const rows = act.map((a) => {
      const n = QUESTS.target(a.st), here = n && S.location === n, o = a.st.obj, rec = QUESTS.recOf ? QUESTS.recOf(a.id, a.stage) : 0;   // [OURS] quest-fight scaling
      const btns = [o.talk && here ? `<button class="btn sm pri" data-act="qtalk" data-id="${a.id}">${esc(o.label)}</button>` : "",
        n && !here && WORLD.places[n] ? `<button class="btn sm" data-act="go" data-place="${esc(n)}">Travel to ${esc(n)}</button>` : ""].join("");
      return `<div class="item on" style="flex-wrap:wrap">${UIART.quest(a.id, 32)}<div class="t">${esc(a.def.name)} · ${esc(a.st.title)}<span>${esc(a.st.text)}${o.count ? ` (${Math.max(0, ((S.stats || {})[o.count] || 0) - ((a.base || {})[o.count] || 0))}/${o.n})` : ""}${o.check ? ` · ${esc(o.check.skill)} check: ${Math.round(QUESTS.checkChance(S, o.check) * 100)}% chance${o.check.fight ? " (a fight if you're seen)" : o.check.bounty ? " (a bounty if you're seen)" : ""}` : ""}${(a.retryAt || 0) > G.now() ? ` · lie low ${Math.ceil((a.retryAt - G.now()) / 60)} more min` : ""}${rec > 1 ? ` · <b class="qrec" style="color:var(${S.level < rec ? "--hp" : "--gold"})">Recommended level ${rec}</b>` : ""}</span></div>${btns ? `<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${btns}</div>` : ""}</div>`;
    }).join("");
    const avail = QUESTS.list().filter((id) => QUESTS.L[id].start && !(S.quests || {})[id] && (!QUESTS.visible || QUESTS.visible(S, id))).map((id) => {
      const d = QUESTS.L[id];
      return `<div class="item">${UIART.quest(id, 32)}${NPCART.giver(id, 32)}<div class="t">${esc(d.name)}<span>${QUESTS.canJoin(S, id) ? "They're here. Ask to join." : `Find them at ${esc(d.giver)}.`}</span></div>${QUESTS.canJoin(S, id) ? `<button class="btn sm pri" data-act="qjoin" data-id="${id}">Join</button>` : ""}</div>`;
    }).join("");
    const done = Object.entries(S.quests || {}).filter(([, v]) => v.done).map(([id]) => QUESTS.L[id]?.name).filter(Boolean);
    const work = ["thieves", "brotherhood"].filter((id) => GUILDS.canTake(S, id)).map((id) => {
      const st = GUILDS.state(S)[id], r = GUILDS.rank(S, id), j = st.job, who = id === "thieves" ? "Delvin and Vex" : "Nazir";
      const head = `${UIART.quest(id, 32)}<div class="t">${id === "thieves" ? "Thieves Guild work" : "Dark Brotherhood contracts"}<span>Rank: <b>${esc(r?.name || "—")}</b> · ${st.jobs} done${r?.next ? ` · ${esc(r.next[0])} at ${r.next[1]}` : ""}</span></div>`;
      if (j) { const here = S.location === j.town;
        return `<div class="item on" style="flex-wrap:wrap">${head}<p class="sub" style="width:100%;margin:4px 0">${esc(j.label)}: ${esc(j.text)} Pays ${j.pay} gold. ${esc(j.skill)} check: ${Math.round(GUILDS.chance(S, j) * 100)}%.</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${here ? `<button class="btn sm pri" data-act="gdo" data-id="${id}">${id === "thieves" ? "Do the job" : "Fulfil the contract"}</button>` : `<button class="btn sm" data-act="go" data-place="${esc(j.town)}">Travel to ${esc(j.town)}</button>`}<button class="btn sm" data-act="gdrop" data-id="${id}">Drop it</button></div></div>`; }
      const at = GUILDS.takeAt(id).includes(S.location), wait = Math.max(0, st.next - G.now());
      return `<div class="item" style="flex-wrap:wrap">${head}<p class="sub" style="width:100%;margin:4px 0">${wait > 0 ? `${who} will have more work in about ${Math.ceil(wait / 60)} min.` : at ? `${who} ${id === "thieves" ? "have" : "has"} work for you.` : `Ask ${who} for work ${id === "thieves" ? "in the Ragged Flagon (Riften)" : "at the Sanctuary (Falkreath or Dawnstar)"}.`}</p>${at && wait <= 0 ? `<button class="btn sm pri" data-act="gtake" data-id="${id}">${id === "thieves" ? "Ask for a job" : "Ask for a contract"}</button>` : ""}</div>`;
    }).join("");
    return `<div class="panel"><h2>Quests</h2><div class="list">${rows || '<p class="sub">No active quests. Ask around: quest givers are listed below under Guilds, and the inn (Town tab) sells rumours.</p>'}</div>
      ${work ? `<h3 style="margin-top:12px">Guild work</h3><div class="list">${work}</div>` : ""}
      ${avail ? `<h3 style="margin-top:12px">Guilds</h3><div class="list">${avail}</div>` : ""}
      ${done.length ? `<p class="sub" style="margin-top:8px">Completed: ${done.map(esc).join(", ")}</p>` : ""}
      <p class="sub" style="margin-top:6px">The gold diamond on the map marks where your current quest leads.</p></div>`;
  }
  function guildWork(id) {
    const r = GUILDS.work(S, id);
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    const text = [r.text, ...(r.msgs || [])].join(" ");
    if (r.fight) return showFightResult({ ...r, text, loot: [], gold: 0 });
    SOUND.fx(/off|run/.test(r.text) ? "click" : "coin");
    showMessage(id === "thieves" ? "Thieves Guild" : "Dark Brotherhood", text);
  }
  function questTalk(id) {
    const r = QUESTS.talk(S, id);
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    if (!r.fight && !r.msgs) return toast(r.text);
    if (r.fight && r.msgs?.length) SOUND.fx("quest", 2);
    if (r.fight) return showFightResult({ ...r, text: [r.text, ...(r.msgs || [])].join(" "), loot: [], gold: 0 });
    showMessage("Quest", [r.text, ...(r.msgs || [])].join(" "));
  }

  // ------------------------------------------------------------ the Jarl's bounty board
  let lastDragons = null;
  // ------------------------------------------------------------ tutorial: a guided first trip, then one tip per tab
  const TUT = [
    null,
    { title: "Your first trip", text: () => `Welcome to Skyrim, ${S.name}. Everything happens in real time. Tap <b>Whiterun</b> on the map and press <b>Travel</b>, or press <b>Go</b> next to it in the list below.`, done: () => !!S.trip || S.location === "Whiterun" },
    { title: "On the road", text: () => "You're walking. Trips keep going even when the app is closed, and something may happen by the road. You can ride a horse later, or take a carriage between cities.", done: () => !S.trip },
    { title: "You've arrived", text: () => `Open the <b>Town</b> tab. In towns and cities it has shops, the inn, trainers, the forge, jobs and more${S.location && TOWNS.isTown(S.location) ? "" : " (this spot is out in the wilds, so it shows what you can do here)"}.`, done: () => tab === "town" },
    { title: "Quests", text: () => "Now open the <b>Journal</b>. Your quests are there, and the gold diamond on the map shows where to go next. It's also where you chat with other players.", done: () => tab === "log" },
    { title: "Fights", text: () => "One more: the <b>Tactics</b> tab. Fights play out by themselves, following your rules, like “below 40% health, drink a potion”.", done: () => tab === "tactics" },
  ];
  const TAB_TIPS = {
    map: "Start with the “What to do next” card. Press Go to travel; tap any place on the map to see how far it is.",
    hero: "Your level, skills and perks. A dot on this tab means you can level up or spend a perk point.",
    pack: "Everything you carry. Tap an item to wear or use it; search by name at the top of the list.",
    tactics: "Set rules for fights. They're checked top to bottom every turn. Test them against a dummy before a real fight.",
    town: "Places in town are grouped: Shops, Services, Guilds & jobs. Each town has different ones; shops close at night.",
    log: "Your quests first, then chat and the world. Tap a name in the ribbon to jump there; numbers mean something new.",
  };

  const guideOffer = () => !S.guideOffered && S.level < 10 && (!S.tut || S.tut.off || S.tut.step === 0)
    ? `<div class="tut"><div class="tut-h"><b>📖 New to the game?</b></div><p>The guide walks you through your first hour: trading, tactics, dungeons, smithing, friends and more.</p><div style="display:flex;gap:8px"><button class="btn sm pri" data-act="guide">Open the guide</button><button class="btn sm" data-act="guideno">Not now</button></div></div>` : "";
  function tutTip() {
    const t = S.tut; if (!t || t.off) return guideOffer();
    if (t.step > 0 && t.step < TUT.length) {
      while (t.step < TUT.length && TUT[t.step].done()) t.step++;
      if (t.step >= TUT.length) { t.step = 0; S.gold += 100; Store.save(S); setTimeout(() => { SOUND.fx("quest"); toast("Tutorial done. Riverwood's steward sends you 100 gold for the road."); }, 300); }
      else { const st = TUT[t.step]; return `<div class="tut"><div class="tut-h"><b>${esc(st.title)}</b><span class="sub">${t.step} of ${TUT.length - 1}</span></div><p>${st.text()}</p><button class="linkbtn" data-act="tutskip">Skip the tutorial</button></div>`; }
    }
    if (guideOffer()) return guideOffer();
    if (TAB_TIPS[tab] && !t.seen?.[tab]) return `<div class="tut"><p>💡 ${TAB_TIPS[tab]}</p><button class="btn sm" data-act="tutseen">Got it</button></div>`;
    return "";
  }

  // ------------------------------------------------------------ clan wars over the holds
  function warPoint(kind, hold) {
    if (!WARS.add(S, kind, hold)) return;
    const rec = WARS.record(S); Store.put("war", `${rec.week}-${S.id}`, rec); WARS.setDocs(null, S); Store.save(S);
  }
  /* a toast with the banner when a hold changes hands (compared with what this phone last saw) */
  function holdChange() {
    if (!Store.online || !CLANS.all.length) return;
    let seen = {}; try { seen = JSON.parse(localStorage.getItem("rotn_rulers") || "{}"); } catch { /* ignore */ }
    const now = {}, rul = WARS.rulers(S);
    for (const [h, c] of Object.entries(rul)) now[h] = c.tag;
    const first = !localStorage.getItem("rotn_rulers");
    try { localStorage.setItem("rotn_rulers", JSON.stringify(now)); } catch { /* ignore */ }
    if (first) return;
    for (const [h, tag] of Object.entries(now)) if (seen[h] !== tag) {
      const c = rul[h];
      if (typeof POLISH !== "undefined" && typeof RAIDART !== "undefined") POLISH.banner("hold", "Hold captured", `[${c.tag}] rules ${h}`, RAIDART.clanBanner(c, 30, 42));
      else toast(`⚑ ${c.name} [${c.tag}] now rules ${h}.`);
      break;
    }
  }
  function holdsPanel() {
    if (!Store.online || !CLANS.all.length) return "";
    const w = WARS.week(), st = WARS.standings(w, S), rul = WARS.rulers(S), mine = myClan();
    const left = BOUNTY.weekEnds(w) - Date.now(), days = Math.floor(left / 864e5), hrs = Math.floor((left % 864e5) / 36e5);
    return `<div class="panel"><h2>Holds</h2><p class="sub">Clans fight for the nine holds each week. Win fights, clear dungeons and fight dragons inside a hold to earn it points (Arena wins count for Eastmarch). Whoever leads when the week ends rules it all next week, and their members shop 10% cheaper there. ${days}d ${hrs}h left.</p>
      ${typeof RAIDART !== "undefined" ? RAIDART.holdsMap(rul) : ""}
      <div class="list">${Object.keys(WORLD.holds).map((h) => { const r = rul[h], list = st[h], lead = list[0], me = mine && list.find((x) => x.clan.id === mine.id);
        return `<div class="item" style="flex-wrap:wrap">${r ? bannerHTML(r) : `<span class="banner" style="background:#2a2e33" aria-hidden="true"></span>`}<div class="t">${esc(h)}<span>${r ? `Ruled by ${esc(r.name)} [${esc(r.tag)}]` : "Nobody rules it"} · this week: ${lead ? `${esc(lead.clan.tag)} ${lead.pts}` : "no points yet"}${list[1] ? `, ${esc(list[1].clan.tag)} ${list[1].pts}` : ""}${me && me !== lead ? ` · you: ${me.pts}` : ""}</span></div></div>`; }).join("")}</div>
      ${mine ? "" : `<p class="sub">Join or found a clan (below) to take part.</p>`}</div>`;
  }

  // ------------------------------------------------------------ seasonal events
  function festCount(key, n = 1) { const m = FEST.count(S, key, n); if (m) { persist(); SOUND.fx("quest"); setTimeout(() => toast(m), 800); } }
  function festPanel() {
    const st = FEST.status(S), nx = FEST.next();
    if (!st) return nx ? `<div class="panel"><h2>Coming up</h2><p class="sub">${nx.icon} ${esc(nx.name)} starts in ${nx.days} day${nx.days > 1 ? "s" : ""}. ${esc(nx.text)}</p></div>` : "";
    const { ev } = st;
    return `<div class="panel" style="border-color:var(--gold)"><h2>${ev.icon} ${esc(ev.name)}</h2>${UIART.fest(ev.id, 340, 64)}<p class="sub">${esc(ev.text)}</p>
      <div class="item" style="flex-wrap:wrap"><div class="t">${esc(ev.goal.what)}<span>Reward: ${ev.reward.gold} gold, ${ev.reward.item[1]} ${esc(D.ITEMS[ev.reward.item[0]]?.name || "")} and the title “${esc(ev.reward.title)}”</span></div>
        <span class="num ${st.done || st.ready ? "gold" : "sub"}">${st.n}/${ev.goal.n}</span>
        <div class="bar" style="width:100%;margin-top:4px"><i style="width:${(100 * st.n) / ev.goal.n}%;background:var(--gold)"></i></div>
        ${st.ready ? `<button class="btn pri" data-act="festclaim" style="width:100%;margin-top:8px">Claim your reward</button>` : st.done ? `<p class="sub" style="width:100%;margin:6px 0 0">Reward claimed. See you next year.</p>` : ""}</div></div>`;
  }
  function festAnnounce() {
    const ev = FEST.active(); if (!ev) return;
    S.festSeen = S.festSeen || {};
    if (S.festSeen[ev.key]) return;
    S.festSeen[ev.key] = 1; Store.save(S);
    setTimeout(() => { SOUND.fx("quest"); toast(`${ev.icon} ${ev.name} has begun! See the Journal.`); }, 2500);
  }

  // ------------------------------------------------------------ market stalls
  let stalls = [], stallPick = null;
  function onStalls(docs) {
    stalls = docs.filter((d) => d && d.row && d.seller);
    for (const d of stalls) if (d.seller === S.id && (d.status === "sold" || d.status === "withdrawn")) {
      Store.remove("stalls", d.id);
      const m = MARKET.settle(S, d); if (m) { persist(true); if (d.status === "sold") SOUND.fx("coin"); toast(m); }
    }
    if (tab === "town") bump();
  }
  function marketHTML(l) {
    const forSale = MARKET.inTown(stalls, l, S.id), own = MARKET.mine(stalls, S.id), hereOwn = own.filter((d) => d.town === l), house = (S.homes || {})[l] || MARKET.hallShop(S, l);
    const row = (d, btn) => `<div class="item">${ICONART.item(d.row.item, 34, d.row)}<div class="t">${esc(MARKET.itemName(d.row))}${d.row.qty > 1 ? ` ×${d.row.qty}` : ""}<span>${btn === "buy" ? `${d.hall ? `🏰 ${esc(d.hallName || d.sellerName + "'s hall")}` : `${esc(d.sellerName)}'s stall`} · ${esc(G.itemStats(d.row.item))}` : d.hall ? "on your hall counter" : "on your stall"}</span></div><span class="num gold">${d.price}</span>${btn === "buy" ? `<button class="btn sm pri" data-act="mbuy" data-id="${esc(d.id)}" ${S.gold >= d.price ? "" : "disabled"}>Buy</button>` : `<button class="btn sm" data-act="mpull" data-id="${esc(d.id)}">Take back</button>`}</div>`;
    let h = `<h3>For sale here</h3>${forSale.length ? forSale.map((d) => row(d, "buy")).join("") : `<p class="sub">No player stalls in ${esc(l)} right now.</p>`}`;
    if (!house) return h + `<p class="sub" style="margin-top:10px">Own a house in ${esc(l)}, or a hall here with a shop counter, to run your own stall.</p>`;
    const eq = new Set(Object.values(G.loadout(S).equipment || {}));
    const pack = S.inv.filter((r) => !eq.has(r.id) && !r.stolen && D.ITEMS[r.item]).slice(0, 40);
    const pick = pack.find((r) => r.id === stallPick);
    h += `<h3 style="margin-top:12px">Your stall · ${own.length}/${MARKET.capFor(S)}</h3>${hereOwn.length ? hereOwn.map((d) => row(d, "pull")).join("") : `<p class="sub">Nothing on your stall here.</p>`}
      <p class="sub">Things on your stall sell even while you're away; your game collects the gold next time it's open. The market keeps ${Math.round(MARKET.FEE * 100)}%.</p>
      ${pick ? `<div class="card"><h3>${esc(MARKET.itemName(pick))}${pick.qty > 1 ? ` ×${pick.qty}` : ""}</h3><div class="chatrow"><input id="mprice" inputmode="numeric" value="${MARKET.suggest(pick)}" aria-label="Price in gold"><button class="btn pri" data-act="mlist">Put on stall</button><button class="btn" data-act="mpick" data-id="">Cancel</button></div><p class="sub" style="margin:4px 0 0">Price for all of it, in gold. A shop would pay you about ${G.sellPrice(S, pick) * pick.qty}.</p></div>`
        : `<details><summary class="sub" style="cursor:pointer;min-height:36px">Put something on your stall</summary>${pack.map((r) => `<div class="item"><div class="t">${esc(MARKET.itemName(r))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div><button class="btn sm" data-act="mpick" data-id="${r.id}">Choose</button></div>`).join("")}</details>`}`;
    return h;
  }
  async function marketBuy(id) {
    const out = {};
    await Store.change("stalls", id, (d) => MARKET.buy(S, { ...d }, out) || d);
    if (out.err) return toast(out.err);
    if (!out.text) return toast("Someone bought it first.");
    persist(true); SOUND.fx("coin"); toast(out.text); renderPanel(true);
  }

  // ------------------------------------------------------------ player halls, shops and guild halls (halls.js)
  let hallDocs = [], lastHallJson = null, hallView = null, hallLast = 0, hallTab = "rooms";
  const clanHall = () => { const c = myClan(); return c ? HALLS.clanHallOf(hallDocs, c.id) : null; };
  function onHalls(docs) {
    hallDocs = docs.filter((d) => d && d.town && d.name);
    HALLS.setClanHall(clanHall());
    if (tab === "town") bump();
  }
  function publishHall() {
    if (!Store.online) return;
    const rec = HALLS.card(S), json = JSON.stringify(rec);
    if (json === lastHallJson) return;
    lastHallJson = json;
    if (rec) Store.put("halls", S.id, { ...rec, t: G.now() }); else Store.remove("halls", S.id);
  }
  /* every half minute: wages, the steward, thieves, travellers buying from your counter, the guild hall's day */
  function hallTick(t) {
    if (t - hallLast < 30) return; hallLast = t;
    if (S.hall) {
      const msgs = HALLS.settle(S.hall, t);
      HALLS.refreshTrophies(S, t);
      const sell = HALLS.travellerBuys(S, stalls, t);
      for (const id of sell) Store.change("stalls", id, (d) => (d.status === "open" && d.seller === S.id ? { ...d, status: "sold", buyer: "npc", buyerName: "A traveller", soldAt: G.now() } : d));
      if (msgs.length || sell.length) { persist(true); msgs.forEach((m) => toast(m)); }
    }
    const ch = clanHall();
    if (ch && HALLS.canUse(S, ch) && Math.floor(t / HALLS.DAY) > Math.floor((ch.paid || t) / HALLS.DAY))
      Store.change("halls", ch.id, (d) => { HALLS.settle(d, t); return d; });
  }
  /* run a change on a hall: your own (in the save) or the guild's (shared, under a lease) */
  async function hallDo(clan, fn) {
    if (!clan) { if (!S.hall) return toast("You don't have a hall."); const r = fn(S.hall, { s: S }); if (r.err) return toast(r.err); persist(true); toast(r.text); renderPanel(true); return; }
    const ch = clanHall(); if (!ch) return toast("Your clan has no hall.");
    let out = null;
    const res = await Store.change("halls", ch.id, (d) => { const h = { ...d }; HALLS.settle(h); out = fn(h, { h }); return out.err ? d : h; });
    if (!res && !out) return toast("Someone else is changing the hall. Try again.");
    if (out?.err) return toast(out.err);
    persist(true); if (out?.text) toast(out.text); renderPanel(true);
  }
  const hallPurseFor = (clan) => (clan ? "guild funds" : "your gold and pack");
  function hallCostText(room, level, clan) {
    const c = HALLS.cost(room, level, clan); if (!c) return "";
    return [`${c.gold.toLocaleString()} gold`, ...Object.entries(c.mats).map(([m, n]) => `${D.ITEMS[m]?.name || m} ×${n}`)].join(" · ");
  }
  function hallManageHTML(h, clan) {
    const own = !clan || h.founder === S.id, c = clan ? "1" : "", purse = clan ? { h } : { s: S }, here = S.location === h.town;
    const tabs = [["rooms", "Rooms"], ["decor", "Decor"], ["staff", "Staff"], ["store", clan ? "Storage" : "Storage & trophies"], ...(clan ? [] : [["shop", "Shop"]]), ["log", clan ? "Members" : "Coffer"]];
    if (!tabs.some(([k]) => k === hallTab)) hallTab = "rooms";
    let b = "";
    if (hallTab === "rooms") {
      b = (clan ? HALLS.CLAN_ROOMS : Object.keys(HALLS.ROOMS)).map((id) => {
        const [nm, desc] = HALLS.ROOMS[id], L = HALLS.lvl(h, id), next = L + 1, e = next <= 2 ? HALLS.canPay(purse, HALLS.cost(id, next, clan).gold, HALLS.cost(id, next, clan).mats) : "done";
        return `<div class="item ${L ? "on" : ""}"><div class="t">${L ? "✔" : "○"} ${esc(nm)}${L ? ` · level ${L}` : ""}<span>${esc(desc)}${next <= 2 ? `<br>${L ? "Improve" : "Build"}: ${esc(hallCostText(id, next, clan))}` : ""}</span></div>${next <= 2 ? `<button class="btn sm ${e ? "" : "pri"}" data-act="hbuild" data-id="${id}" data-c="${c}" ${e || !here || !own ? "disabled" : ""} title="${esc(e || "")}">${L ? "Improve" : "Build"}</button>` : ""}</div>`;
      }).join("") + (clan ? `<p class="sub">Guild halls pay for everything from the guild funds (materials are bought in gold). Only the founder builds; any member can give gold.</p>` : `<p class="sub">Materials come from your pack: ingots from the forge, leather, firewood. Mines and blacksmiths have them.</p>`);
      b += `<div class="item"><div class="t">The hearth<span>Rest here for free. Comfort ${HALLS.comfort(h)}/${HALLS.COSY}: ${HALLS.comfort(h) >= HALLS.COSY ? "Well Rested (+10% skills)" : "Rested (+5%); decorate for Well Rested"}</span></div><button class="btn sm pri" data-act="hrest" data-c="${c}" ${here ? "" : "disabled"}>Rest</button></div>`;
      if (HALLS.lvl(h, "shrine")) b += `<div class="item"><div class="t">The shrine<span>Once a day: +${HALLS.lvl(h, "shrine") >= 2 ? 50 : 25} health for a day, diseases cured</span></div><button class="btn sm" data-act="hpray" data-c="${c}" ${here ? "" : "disabled"}>Pray</button></div>`;
      if (HALLS.lvl(h, "forge")) b += `<div class="item"><div class="t">The forge<span>Smithing improves ${HALLS.lvl(h, "forge") * 10}% faster here</span></div><button class="btn sm" data-act="shop" data-id="forge" ${here ? "" : "disabled"}>Use</button></div>`;
    } else if (hallTab === "decor") {
      b = `<p class="sub" style="margin-top:0">${(h.decor || []).length}/${HALLS.decorCap(h)} spaces · each room built gives one more.</p>` + Object.entries(HALLS.DECOR).map(([id, [nm, price, cf]]) => {
        const has = (h.decor || []).includes(id), e = HALLS.canPay(purse, price);
        return `<div class="item ${has ? "on" : ""}"><div class="t">${has ? "✔ " : ""}${esc(nm)}<span>+${cf} comfort</span></div>${has ? (own ? `<button class="btn sm" data-act="hundecor" data-id="${id}" data-c="${c}">Take down</button>` : "") : `<span class="num gold">${price}</span><button class="btn sm" data-act="hdecor" data-id="${id}" data-c="${c}" ${e || !here || !own || (h.decor || []).length >= HALLS.decorCap(h) ? "disabled" : ""}>Put up</button>`}</div>`;
      }).join("");
    } else if (hallTab === "staff") {
      b = `<p class="sub" style="margin-top:0">Wages come out of the ${clan ? "guild funds" : "coffer"} once an in-game day (every 2 real hours): ${HALLS.wages(h)} gold a day now. Unpaid staff leave.</p>` + (clan ? HALLS.CLAN_STAFF : Object.keys(HALLS.STAFF)).map((id) => {
        const [nm, fee, wage, need, desc] = HALLS.STAFF[id], has = (h.staff || {})[id], e = HALLS.canPay(purse, fee) || (need && !HALLS.lvl(h, need) ? `Build the ${HALLS.ROOMS[need][0].toLowerCase()} first.` : null);
        return `<div class="item ${has ? "on" : ""}">${typeof HOMEART !== "undefined" ? "" : ""}<div class="t">${has ? "✔ " : ""}${esc(nm)}<span>${esc(desc)} · ${wage} gold a day</span></div>${has ? (own ? `<button class="btn sm" data-act="hfire" data-id="${id}" data-c="${c}">Let go</button>` : "") : `<span class="num gold">${fee}</span><button class="btn sm" data-act="hhire" data-id="${id}" data-c="${c}" ${e || !here || !own ? "disabled" : ""} title="${esc(e || "")}">Hire</button>`}</div>`;
      }).join("");
    } else if (hallTab === "store") {
      const eq = new Set(Object.values(G.loadout(S).equipment || {})), pack = S.inv.filter((r) => !eq.has(r.id) && D.ITEMS[r.item] && !(clan && (r.stolen || D.ITEMS[r.item].noTrade)));
      const left = clan && h.founder !== S.id ? HALLS.CLAN_TAKES_PER_DAY - ((h.takes?.[S.id]?.day === Math.floor(G.now() / HALLS.DAY)) ? h.takes[S.id].n : 0) : null;
      b = HALLS.cap(h) ? `<h3 style="margin-top:0">Storage · ${(h.storage || []).length}/${HALLS.cap(h)}${h.staff?.guard ? " · guarded" : " · no guard"}</h3>${left != null ? `<p class="sub" style="margin-top:0">You can take ${left} more today.</p>` : ""}
        ${(h.storage || []).length ? h.storage.map((r, i) => `<div class="item">${ICONART.item(r.item, 30, r)}<div class="t">${esc(HALLS.name(r))}${r.qty > 1 ? ` ×${r.qty}` : ""}<span>${clan ? `from ${esc(r.by || "someone")}` : esc(G.itemStats(r.item))}</span></div><button class="btn sm" data-act="hunstash" data-id="${i}" data-c="${c}" ${here && left !== 0 ? "" : "disabled"}>Take</button></div>`).join("") : `<p class="sub">Empty.</p>`}
        <details><summary class="sub" style="cursor:pointer;min-height:36px">Put something in</summary>${pack.length ? pack.slice(0, 40).map((r) => `<div class="item"><div class="t">${esc(HALLS.name(r))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div><button class="btn sm" data-act="hstash" data-id="${r.id}" data-c="${c}" ${here ? "" : "disabled"}>Store</button></div>`).join("") : `<p class="sub">Nothing loose to store.</p>`}</details>` : `<p class="sub">Build storage to keep things here.</p>`;
      if (HALLS.trophyCap(h)) {
        const tro = pack.filter(HALLS.trophyOk);
        b += `<h3 style="margin-top:12px">Trophy wall · ${(h.trophies || []).length}/${HALLS.trophyCap(h)}${clan ? "" : ` · +${Math.min(HALLS.trophyCap(h), (h.trophies || []).length)}% better prices`}</h3>${(h.trophies || []).map((r, i) => `<div class="item">${ICONART.item(r.item, 30, r)}<div class="t">${esc(HALLS.name(r))}<span>put up by ${esc(r.by || "you")}</span></div>${own ? `<button class="btn sm" data-act="hunmount" data-id="${i}" data-c="${c}" ${here ? "" : "disabled"}>Take down</button>` : ""}</div>`).join("") || `<p class="sub">Nothing on the wall yet.</p>`}
          ${tro.length ? tro.map((r) => `<div class="item"><div class="t">${esc(HALLS.name(r))}</div><button class="btn sm" data-act="hmount" data-id="${r.id}" data-c="${c}" ${here ? "" : "disabled"}>Mount</button></div>`).join("") : `<p class="sub">Dragon bones, scales, golden claws and treasures from the road go on the wall.</p>`}`;
      }
    } else if (hallTab === "shop") {
      const open = MARKET.mine(stalls, S.id).filter((d) => d.town === h.town && d.hall);
      b = HALLS.lvl(h, "counter") ? `<p class="sub" style="margin-top:0">List things from the Market stalls in ${esc(h.town)}: up to ${MARKET.capFor(S)}, and the market keeps only ${Math.round(HALLS.HALL_FEE * 100)}% (stalls pay ${Math.round(MARKET.FEE * 100)}%). ${h.staff?.shopkeeper ? `Your shopkeeper sells up to ${2 * HALLS.lvl(h, "counter")} a day to travellers when the price is fair (no more than about 1.25× value).` : "Hire a shopkeeper and travellers will buy from you too."}</p>
        ${open.length ? open.map((d) => `<div class="item">${ICONART.item(d.row.item, 30, d.row)}<div class="t">${esc(MARKET.itemName(d.row))}${d.row.qty > 1 ? ` ×${d.row.qty}` : ""}<span>${d.price <= (D.ITEMS[d.row.item].value || 1) * d.row.qty ? "Fair price: sells quickly" : d.price <= (D.ITEMS[d.row.item].value || 1) * d.row.qty * 1.25 ? "A bit high: sells slowly" : "Too dear for travellers; only players"}</span></div><span class="num gold">${d.price}</span></div>`).join("") : `<p class="sub">Nothing on your counter yet.</p>`}
        <button class="btn pri" data-act="shop" data-id="market" style="width:100%;margin-top:6px" ${here ? "" : "disabled"}>Open the Market stalls</button>` : `<p class="sub">Build a shop counter to sell from your hall.</p>`;
    } else if (hallTab === "log") {
      if (clan) {
        const donors = Object.values(h.donors || {}).sort((a, b) => b.gold - a.gold);
        b = `<div class="item"><div class="t">Guild funds<span>${(h.funds || 0).toLocaleString()} gold · wages ${HALLS.wages(h)} a day</span></div></div>
          <div class="chips">${[100, 500, 1000, 5000].map((n) => `<button class="chip" data-act="hdep" data-id="${n}" data-c="1" ${S.gold >= n ? "" : "disabled"}>Give ${n}</button>`).join("")}</div>
          <h3 style="margin-top:12px">Who gave</h3>${donors.length ? donors.slice(0, 12).map((d) => `<div class="item"><div class="t">${esc(d.name)}</div><span class="num gold">${d.gold.toLocaleString()}</span></div>`).join("") : `<p class="sub">Nobody yet.</p>`}`;
      } else {
        b = `<div class="item"><div class="t">The coffer<span>${(h.coffer || 0).toLocaleString()} gold · wages ${HALLS.wages(h)} a day${h.staff?.steward ? ` · steward brings ${10 * HALLS.roomCount(h)} a day` : ""}</span></div></div>
          <div class="chips">${[100, 500, 1000].map((n) => `<button class="chip" data-act="hdep" data-id="${n}" ${S.gold >= n ? "" : "disabled"}>Put in ${n}</button>`).join("")}${(h.coffer || 0) > 0 ? `<button class="chip" data-act="hwd" data-id="${h.coffer}">Take all</button>` : ""}</div>`;
      }
      b += `<h3 style="margin-top:12px">Lately</h3>${(h.log || []).length ? h.log.map((l) => `<p class="sub" style="margin:2px 0">${esc(l)}</p>`).join("") : `<p class="sub">Quiet.</p>`}`;
    }
    return `${typeof HOMEART !== "undefined" ? HOMEART.guild(h) : ""}<div class="card"><h3>${clan ? `🏴 ${esc(h.name)} [${esc(h.tag || "")}]` : `🏰 ${esc(h.name)}`}</h3><p class="sub" style="margin:0">${esc(h.town)} · ${HALLS.roomCount(h)} room${HALLS.roomCount(h) === 1 ? "" : "s"} · ${clan ? `funds ${(h.funds || 0).toLocaleString()}` : `coffer ${(h.coffer || 0).toLocaleString()}`} gold${here ? "" : ` · you're away (${esc(S.location || "on the road")})`}</p></div>
      <div class="chips hallnav">${tabs.map(([k, n]) => `<button class="chip ${k === hallTab ? "on" : ""}" data-act="htab" data-id="${k}">${n}</button>`).join("")}</div><div class="list">${b}</div>`;
  }
  function hallsHTML(l) {
    if (hallView) {
      const d = hallDocs.find((x) => x.id === hallView);
      if (d) return `<button class="btn sm" data-act="hback">← Back</button>${typeof HOMEART !== "undefined" ? HOMEART.guild(d) : ""}<div class="card"><h3>${d.clan ? "🏴" : "🏰"} ${esc(d.name)}</h3><p class="sub" style="margin:0">${d.clan ? `Guild hall of ${esc(d.clanName || "a clan")}` : `${esc(d.ownerName)}'s hall · level ${d.level || 1}`}</p></div>
        <div class="list">${Object.entries(d.rooms || {}).filter(([, v]) => v).map(([k, v]) => `<div class="item"><div class="t">${esc(HALLS.ROOMS[k]?.[0] || k)}${v > 1 ? " · level 2" : ""}</div></div>`).join("") || `<p class="sub">Bare walls and a hearth, for now.</p>`}
        ${(d.trophies || []).length ? `<h3 style="margin-top:10px">On the trophy wall</h3><p class="sub">${d.trophies.map((t) => esc(D.ITEMS[typeof t === "string" ? t : t.item]?.name || "")).filter(Boolean).join(", ")}</p>` : ""}
        ${d.shop ? `<button class="btn pri" data-act="shop" data-id="market" style="width:100%;margin-top:6px">See ${esc(d.ownerName)}'s shop in the Market stalls</button>` : ""}</div>`;
      hallView = null;
    }
    let h = "";
    const mine = S.hall, c = myClan(), ch = clanHall();
    if (mine && mine.town === l) h += hallManageHTML(mine, false);
    else if (mine) h += `<div class="item"><div class="t">🏰 ${esc(mine.name)}<span>Your hall is in ${esc(mine.town)} · coffer ${(mine.coffer || 0).toLocaleString()} gold</span></div></div>`;
    else if (HALLS.plotHere(l)) h += `<div class="card"><h3>Buy a hall plot in ${esc(l)}</h3><p class="sub">Your own hall: build a forge, a shrine, a trophy room, storage and a shop counter; decorate it; hire a shopkeeper, a steward and a guard.</p>
      <div class="chatrow"><input id="hname" maxlength="28" placeholder="${esc(S.name)}'s Hall" autocomplete="off" aria-label="Hall name"><button class="btn pri" data-act="hplot" ${S.gold >= HALLS.plotPrice(l) ? "" : "disabled"}>Buy · ${HALLS.plotPrice(l).toLocaleString()}</button></div></div>`;
    if (c && ch && ch.town === l) h += `<h3 style="margin-top:14px">Your guild hall</h3>` + hallManageHTML(ch, true);
    else if (c && ch) h += `<div class="item"><div class="t">🏴 ${esc(ch.name)}<span>Your clan's hall is in ${esc(ch.town)}</span></div></div>`;
    else if (c && c.founder === S.id && HALLS.plotHere(l)) h += `<div class="card"><h3>Raise a guild hall for ${esc(c.name)}</h3><p class="sub">One hall for the whole clan: shared storage, a forge and a shrine for every member. Members give gold to build it.</p>
      <div class="chatrow"><input id="chname" maxlength="28" placeholder="Hall of ${esc(c.name)}" autocomplete="off" aria-label="Guild hall name"><button class="btn pri" data-act="hclanplot" ${S.gold >= HALLS.plotPrice(l, true) ? "" : "disabled"}>Buy · ${HALLS.plotPrice(l, true).toLocaleString()}</button></div></div>`;
    else if (c && !ch) h += `<p class="sub" style="margin-top:10px">Your clan has no guild hall yet. The founder can buy one in a hold capital.</p>`;
    const others = hallDocs.filter((d) => d.town === l && d.id !== S.id && !(ch && d.id === ch.id));
    h += `<h3 style="margin-top:14px">Other halls in ${esc(l)}</h3>${others.length ? others.map((d) => `<div class="item"><div class="t">${d.clan ? "🏴" : "🏰"} ${esc(d.name)}<span>${d.clan ? `Guild hall · ${esc(d.clanName || "")}` : `${esc(d.ownerName)} · ${HALLS.roomCount(d)} rooms${d.shop ? " · has a shop" : ""}`}</span></div><button class="btn sm" data-act="hvisit" data-id="${esc(d.id)}">Visit</button></div>`).join("") : `<p class="sub">None yet${Store.online ? "" : " (or you're playing offline)"}.</p>`}`;
    return h;
  }
  async function clanPlot() {
    const c = myClan(), r = HALLS.foundClanHall(S, c, $("#chname")?.value, clanHall());
    if (r.err) return toast(r.err);
    await Store.put("halls", r.id, r.doc); hallDocs.push({ ...r.doc, id: r.id }); HALLS.setClanHall(clanHall());
    persist(true); toast(r.text); renderPanel(true);
  }

  // ------------------------------------------------------------ werewolf and vampire
  function bloodTick() {
    const m = CURSE.update(S);
    if (m) { persist(true); SOUND.fx("death"); showMessage("The Change", m); }
    if (CURSE.offered(S) && !S.wolfOfferSeen) { S.wolfOfferSeen = true; persist(); toast("🐺 The Circle of the Companions wants a word with you in Whiterun. See the Hero tab."); }
  }
  function bloodPanel() {
    const t = G.now(), here = S.location, wiz = here && G.shopTypes(here).includes("wizard");
    if (S.vampire) {
      const st = CURSE.stage(S), h = Math.floor(CURSE.hoursUnfed(S));
      return `<div class="panel" style="border-color:#7a1414"><h2>🩸 Vampire</h2><p class="sub">Hunger: stage ${st} of 4 (${h} hour${h === 1 ? "" : "s"} since you fed). The hungrier you are, the stronger your Destruction and Illusion and your night-time blows, and the more the sun slows your healing outside by day. Feed at an inn (Town tab) to reset it.</p>
        <div class="item"><div class="t">Cure vampirism<span>A court wizard's ritual: a filled Common Soul Gem and ${CURSE.CURE_VAMPIRE_GOLD} gold${wiz ? "" : " · go to a city with a court wizard"}</span></div><button class="btn sm" data-act="curevamp" ${wiz ? "" : "disabled"}>Cure</button></div></div>`;
    }
    if (S.sanguinare) {
      const left = Math.max(0, Math.ceil((CURSE.TURN_AFTER - (t - S.sanguinare.at)) / 60));
      return `<div class="panel" style="border-color:#7a1414"><h2>🩸 Sanguinare Vampiris</h2><p class="sub">A vampire's disease. In about ${left} minutes you'll turn into a vampire. Drink a Potion of Cure Disease (general stores, court wizards) or pray at a roadside shrine to stop it, or let it happen.</p></div>`;
    }
    if (S.werewolf) return `<div class="panel" style="border-color:var(--gold)"><h2>🐺 Werewolf</h2><p class="sub">Beast Form, once a day, is in your Tactics: for ${CURSE.BEAST_TURNS} turns you hit much harder, take less damage and heal a bit, but can't drink potions. Beds no longer make you Rested, and you can't catch diseases.</p>
      <div class="item"><div class="t">Be cleansed<span>At Jorrvaskr in Whiterun, ${CURSE.CURE_WEREWOLF} gold</span></div><button class="btn sm" data-act="curewolf" ${here === "Whiterun" ? "" : "disabled"}>Cure</button></div></div>`;
    if (CURSE.offered(S)) return `<div class="panel" style="border-color:var(--gold)"><h2>🐺 The Circle's offer</h2><p class="sub">The Companions' inner circle offers you their secret: the blood of the beast. Once a day you can turn into a werewolf in a fight. Beds won't make you Rested any more. You can be cleansed later for ${CURSE.CURE_WEREWOLF} gold.</p>
      <div class="grid2"><button class="btn pri" data-act="wolfyes" ${here === "Whiterun" ? "" : "disabled"}>Accept${here === "Whiterun" ? "" : " (in Whiterun)"}</button><button class="btn" data-act="wolfno">No, thank you</button></div></div>`;
    return "";
  }

  // ------------------------------------------------------------ achievements
  let achOpen = false;
  function achPanel() {
    const all = ACH.progress(S), got = all.filter((a) => a.done);
    const list = achOpen ? all : [...got, ...all.filter((a) => !a.done).sort((a, b) => b.cur / b.goal - a.cur / a.goal).slice(0, 3)];
    return `<div class="panel"><h2>Achievements · ${got.length}/${all.length}</h2><div class="list">${list.map((a) => `<div class="item ${a.done ? "on" : ""}" style="flex-wrap:wrap;${a.done ? "" : "opacity:.85"}">${UIART.ach(a.id, 32, a.done)}<div class="t">${esc(a.name)}<span>${esc(a.what)}</span></div><span class="num ${a.done ? "gold" : "sub"}">${a.done ? "✔" : `${a.cur.toLocaleString()}/${a.goal.toLocaleString()}`}</span>
      ${a.done ? "" : `<div class="bar" style="width:100%;margin-top:4px"><i style="width:${(100 * a.cur) / a.goal}%;background:var(--frost)"></i></div>`}</div>`).join("")}</div>
      <button class="btn" data-act="achmore" style="width:100%;margin-top:8px">${achOpen ? "Show fewer" : `Show all ${all.length}`}</button></div>`;
  }
  function checkAch() {
    const fresh = ACH.check(S);
    if (!fresh.length) return;
    persist(true);
    fresh.forEach((a, i) => setTimeout(() => { SOUND.fx("levelup"); toast(`🏆 Achievement: ${a.icon} ${a.name}`); }, 1200 * i));
    for (const a of fresh) if (Store.online) postNews(`🏆 ${S.name} earned “${a.name}”.`);
  }

  // ------------------------------------------------------------ map pins
  const PIN_ICONS = ["📍", "⭐", "⚔️", "💰", "🌿", "🏕", "❗", "🐉"], PIN_MAX = 20;
  let pinDraft = null;
  function screenToWorld(sx, sy) { const { k, ox, oy } = view.transform; return [(sx - ox) / k / WorldMap.W, (sy - oy) / k / WorldMap.H]; }
  function pinAt(sx, sy) {
    if (!view.transform) return null;
    const { k, ox, oy } = view.transform;
    let best = null, bd = 22;
    for (const p of S.pins || []) { const d = Math.hypot(p.x * WorldMap.W * k + ox - sx, p.y * WorldMap.H * k + oy - sy); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function openPinDialog(x, y) {
    if (x < 0 || y < 0 || x > 1 || y > 1) return;
    pinDraft = { x, y, icon: pinDraft?.icon || "📍" };
    openModal(`<h2>Drop a pin</h2><p class="sub" style="margin-top:0">${esc(G.holdAt([x, y]))} · about ${fmtMin(G.minutesTo(S, [x, y]))} away. Only you see your pins, unless you share one with your party.</p>
      <div class="chips">${PIN_ICONS.map((i) => `<button class="chip ${i === pinDraft.icon ? "on" : ""}" data-act="pinicon" data-id="${i}" aria-label="${i}">${i}</button>`).join("")}</div>
      <input id="pinlabel" maxlength="24" placeholder="Name it (e.g. Good fishing)" autocomplete="off" style="margin-top:8px" aria-label="Pin name">
      <div class="grid2" style="margin-top:10px"><button class="btn pri" data-act="pinsave">Drop pin</button><button class="btn" data-act="close">Cancel</button></div>
      ${(S.pins || []).length >= PIN_MAX ? `<p class="sub">You have ${PIN_MAX} pins. Remove one first.</p>` : ""}`);
    setTimeout(() => $("#pinlabel")?.focus(), 50);
  }
  function addPin(x, y, label, icon) {
    S.pins = S.pins || [];
    if (S.pins.length >= PIN_MAX) return toast(`You have ${PIN_MAX} pins. Remove one first.`);
    label = String(label || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 24) || "Pin";
    const id = Date.now().toString(36);
    S.pins.push({ id, x: Math.min(1, Math.max(0, +x)), y: Math.min(1, Math.max(0, +y)), label, icon: PIN_ICONS.includes(icon) ? icon : "📍" });
    persist(); return id;
  }

  // ------------------------------------------------------------ fishing and cooking
  function cookList() {
    return Object.entries(COOK.RECIPES).map(([id, [name, ings, , what]]) => {
      const miss = COOK.missing(S, id);
      return `<div class="item" style="flex-wrap:wrap"><div class="t">${esc(name)}<span>${esc(what)} · ${ings.map(([it, q]) => `${q > 1 ? q + " " : ""}${it === "fish" ? "any fish" : esc(D.ITEMS[it].name)}`).join(", ")}</span></div>
        <button class="btn sm ${miss.length ? "" : "pri"}" data-act="cook" data-id="${id}" ${miss.length || !COOK.canCook(S) ? "disabled" : ""}>Cook</button>${miss.length ? `<span class="sub" style="width:100%">Missing: ${esc(miss.join(", "))}</span>` : ""}</div>`;
    }).join("") + `<p class="sub" style="margin-top:8px">General stores sell salt, vegetables and meat. Garlic and lavender grow in home gardens and are sold by alchemists.</p>`;
  }
  function fishCard() {
    const c = COOK.canFish(S, livePos()), caught = (S.stats || {}).fish || 0;
    return `<div class="item"><div class="t">🎣 Go fishing<span>${c.err ? esc(c.err) : `You've caught ${caught} fish so far.`}</span></div><button class="btn sm pri" data-act="fishgo" ${c.err ? "disabled" : ""}>Cast</button></div>`;
  }
  function wildsFood() {
    if (S.trip?.status === "travel" || S.trip?.status === "encounter" || S.dungeon) return "";
    const lit = COOK.campLit(S), water = COOK.waterNear(livePos());
    return `<div class="panel"><h2>Camp</h2>
      ${lit ? `<p class="sub">Your fire crackles. ${Math.ceil((S.camp.until - G.now()) / 60)} minutes of warmth left.</p>${cookList()}` : `<div class="item"><div class="t">🔥 Make a campfire<span>Uses 1 Firewood · lets you cook here for ${COOK.CAMP_MIN} minutes</span></div><button class="btn sm" data-act="camp">Light</button></div>`}
      ${water ? fishCard() : ""}</div>`;
  }
  let fishState = null, fishRaf = 0;
  function openFishing() {
    const c = COOK.canFish(S, livePos());
    if (c.err) return toast(c.err);
    cancelAnimationFrame(fishRaf);
    fishState = { phase: "wait", water: c.water, at: performance.now() + 1500 + Math.random() * 3000, bite: null };
    drawFishing("You cast your line and wait…");
    const loop = (ts) => {
      if (!fishState || !$("#fishbar")) return;
      if (fishState.phase === "wait" && ts >= fishState.at) {
        fishState.phase = "bite"; fishState.bite = COOK.bite(fishState.water); fishState.t0 = ts; fishState.until = ts + 5000;
        SOUND.fx("click"); if (navigator.vibrate) try { navigator.vibrate(60); } catch { /* not allowed */ }
        drawFishing("A bite! Reel in when the needle is in the green.");
      }
      if (fishState.phase === "bite") {
        const period = fishState.bite.zone[1] - fishState.bite.zone[0] < 0.22 ? 1900 : 2500;   // rarer fish: a narrower zone and a quicker needle
        const ph = ((ts - fishState.t0) % period) / period; fishState.needle = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        const n = $("#fishneedle"); if (n) n.style.left = `${fishState.needle * 100}%`;
        if (ts > fishState.until) { fishState.phase = "done"; drawFishing("Too slow. It got away.", true); return; }
      }
      fishRaf = requestAnimationFrame(loop);
    };
    fishRaf = requestAnimationFrame(loop);
  }
  function drawFishing(msg, done = false) {
    const b = fishState?.bite;
    openModal(`<h2>Fishing</h2><p class="sub" style="margin-top:0">${esc({ river: "A river", lake: "A lake", sea: "The Sea of Ghosts" }[fishState?.water] || "Water")} · rod in hand</p>
      <p id="fishmsg">${esc(msg)}</p>
      <div class="fishbar" id="fishbar">${b ? `<i class="zone" style="left:${b.zone[0] * 100}%;width:${(b.zone[1] - b.zone[0]) * 100}%"></i><i class="needle" id="fishneedle"></i>` : `<i class="bob"></i>`}</div>
      ${done ? `<div class="grid2" style="margin-top:12px"><button class="btn pri" data-act="fishgo">Cast again</button><button class="btn" data-act="fishstop">Done</button></div>`
        : `<button class="btn pri" data-act="fishreel" style="width:100%;margin-top:12px;min-height:64px;font-size:20px">Reel in!</button><button class="btn" data-act="fishstop" style="width:100%;margin-top:8px">Stop</button>`}`);
  }
  function reelIn() {
    if (!fishState) return;
    if (fishState.phase === "wait") { fishState.phase = "done"; cancelAnimationFrame(fishRaf); return drawFishing("Too soon. You scared it off.", true); }
    if (fishState.phase !== "bite") return;
    cancelAnimationFrame(fishRaf); fishState.phase = "done";
    const r = COOK.reel(S, fishState.bite, fishState.needle ?? 0);
    if (r.ok) { SOUND.fx("coin"); persist(); }
    drawFishing(r.text, true);
  }

  // ------------------------------------------------------------ visiting homes and gifts
  let homeDocs = [], giftDocs = [], seenGifts = new Set(), lastHomeJson = "", visitId = null;
  const myGifts = () => giftDocs.filter((g) => g.to === S.id);
  function onGifts(docs) {
    giftDocs = docs.filter((g) => g && g.to && g.from && g.town);
    for (const g of myGifts()) {
      if (seenGifts.has(g.id)) continue;
      seenGifts.add(g.id);
      if (g.t > bootT) { SOUND.fx("quest"); toast(`🎁 ${g.fromName} left something at your house in ${g.town}.`); }
    }
    if (tab === "town") bump();
  }
  function publishHome() {
    const rec = VISITS.record(S), json = JSON.stringify(rec);
    if (json === lastHomeJson) return;
    lastHomeJson = json;
    if (rec) Store.put("homes", S.id, { ...rec, t: G.now() }); else Store.remove("homes", S.id);
  }
  function visitHTML(d) {
    const town = S.location, hn = TOWNS.HOMES[town]?.[0] || "their house";
    const skulls = Math.min(12, d.dragons || 0);
    const pack = S.inv.filter((r) => !Object.values(G.loadout(S).equipment || {}).includes(r.id) && !r.stolen).slice(0, 30);
    return `<p class="sub" style="margin:0">${esc(hn)} · ${esc(town)}</p><h2 style="margin:4px 0">${esc(d.name)}'s home</h2>
      ${typeof HOMEART !== "undefined" ? HOMEART.visit(d, town, visitGifted.has(d.id)) : ""}${d.motto ? `<p class="motto">“${esc(d.motto)}”</p>` : ""}
      <p class="sub">Level ${d.level} ${esc(D.RACES[d.race]?.name || "")}${d.titles?.length ? ` · ${d.titles.map(esc).join(" · ")}` : ""}</p>
      <div class="trophies">${skulls ? `<span>🐲 ${skulls} dragon skull${skulls > 1 ? "s" : ""} on the wall</span>` : `<span>No dragon skulls yet</span>`}<span>🏆 ${d.cleared || 0} dungeons cleared</span>${d.souls ? `<span>✨ ${d.souls} soul${d.souls > 1 ? "s" : ""} unspent</span>` : ""}${d.ach ? `<span>🏆 ${d.ach.n}/${d.ach.total} achievements</span>` : ""}</div>
      ${d.ach?.latest?.length ? `<p class="sub">Latest: ${d.ach.latest.map(esc).join(" · ")}</p>` : ""}
      ${d.show?.length ? `<h3>Display case</h3><div class="list">${d.show.map((x) => `<div class="item"><div class="t">${esc(x.name)}</div></div>`).join("")}</div>` : ""}
      <h3 style="margin-top:12px">Leave a gift</h3><p class="sub" style="margin-top:0">It waits in their house until they come home. Gifts can't be taken back.</p>
      <input id="giftnote" maxlength="${VISITS.NOTE_MAX}" placeholder="A note (optional)" autocomplete="off" aria-label="Note">
      <div class="chips">${[50, 100, 500, 1000].map((n) => `<button class="chip" data-act="giftgold" data-id="${n}" ${S.gold >= n ? "" : "disabled"}>${n} gold</button>`).join("")}<button class="chip" data-act="giftnote">Just the note</button></div>
      <details style="margin-top:6px"><summary class="sub" style="cursor:pointer;min-height:36px">Give something from your pack</summary>${pack.length ? pack.map((r) => `<div class="item"><div class="t">${esc(VISITS.itemName(r))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div><button class="btn sm" data-act="giftitem" data-id="${r.id}">Give</button></div>`).join("") : `<p class="sub">Nothing you can give.</p>`}</details>
      <button class="btn" data-act="close" style="width:100%;margin-top:10px">Leave</button>`;
  }
  const visitGifted = new Set();
  function openVisit(id) {
    const d = homeDocs.find((x) => x.id === id);
    if (!d || !d.towns?.includes(S.location)) { closeModal(); return toast("They don't have a house here."); }
    visitId = id; const note = $("#giftnote")?.value || "";
    openModal(visitHTML(d)); if ($("#giftnote")) $("#giftnote").value = note;
  }
  function sendGift(kind, arg) {
    const d = homeDocs.find((x) => x.id === visitId), note = $("#giftnote")?.value || "", town = S.location;
    const r = kind === "gold" ? VISITS.giftGold(S, d, town, arg, note) : kind === "item" ? VISITS.giftItem(S, d, town, arg, note) : VISITS.giftNote(S, d, town, note);
    if (r.err) return toast(r.err);
    Store.put("gifts", nid(), r.gift); visitGifted.add(visitId); persist(true); SOUND.fx(kind === "gold" ? "coin" : "click"); toast(r.text);
    if ($("#giftnote")) $("#giftnote").value = "";
    openVisit(visitId);
  }
  function tally(kind, n = 1) {
    if (typeof IMM !== "undefined") IMM.count(S, kind, n);   // lifetime counters for Journal → Stats
    if (!BOUNTY.add(S, kind, n)) return;
    const rec = BOUNTY.record(S);
    Store.put("bounty", `${rec.week}-${S.id}`, rec);
    BOUNTY.setDocs(null, S);   // show our own new numbers right away; the feed brings everyone else's
    Store.save(S);
  }
  function bountyPanel() {
    const w = BOUNTY.week(), left = BOUNTY.weekEnds(w) - Date.now(), days = Math.floor(left / 864e5), hrs = Math.floor((left % 864e5) / 36e5);
    const row = (g, wk) => {
      const can = BOUNTY.claimable(S, wk, g.kind), claimed = (S.bountyClaimed || {})[`${wk}:${g.kind}`];
      return `<div class="item" style="flex-wrap:wrap">${g.kind === "dragons" ? ICONART.enemy("Dragon", ["dragon"], 34) : g.kind === "foes" ? ICONART.enemy("Bandit outlaw", ["humanoid"], 34) : ICONART.item(g.item[0], 34)}<div class="t">${g.done ? "✔ " : ""}${esc(g.title)}<span>${esc(g.text)} · reward ${g.gold} gold + ${g.item[1]} ${esc(D.ITEMS[g.item[0]]?.name || "")}${g.top ? ` · most: ${esc(g.top.name)} (${g.top.n})` : ""}</span></div>
        <span class="num ${g.done ? "gold" : "sub"}">${Math.min(g.total, g.target)}/${g.target}</span>
        <div class="bar" style="width:100%;margin:4px 0 2px"><i style="width:${g.pct}%;background:${g.done ? "var(--gold)" : "var(--frost)"}"></i></div>
        <div style="display:flex;gap:8px;align-items:center;width:100%"><span class="sub" style="flex:1">You: ${g.mine} · ${g.helpers} helping</span>${can ? `<button class="btn sm pri" data-act="bclaim" data-w="${wk}" data-id="${g.kind}">Claim reward</button>` : claimed ? `<span class="sub">Reward taken</span>` : g.done && !g.mine ? `<span class="sub">Help next time to share</span>` : ""}</div></div>`;
    };
    const last = BOUNTY.board(w - 1, S.id).filter((g) => BOUNTY.claimable(S, w - 1, g.kind));
    return `<div class="panel"><h2>Bounty board</h2><p class="sub">The Jarls post three goals for the whole world each week. Everyone who helps gets the reward once a goal is met; whoever did the most earns a title. ${days}d ${hrs}h left.</p>
      <div class="list">${BOUNTY.board(w, S.id).map((g) => row(g, w)).join("")}</div>
      ${last.length ? `<h3 style="margin-top:10px">Last week, still unclaimed</h3><div class="list">${last.map((g) => row(g, w - 1)).join("")}</div>` : ""}</div>`;
  }

  // ------------------------------------------------------------ clans
  let clanDraft = { colors: ["#8c2b22", "#c9a75e"] };
  const bannerHTML = (c) => `<span class="banner" style="background:linear-gradient(180deg,${c.colors[0]} 0 58%,${c.colors[1]} 58% 100%)" aria-hidden="true"></span>`;
  function clanPanel() {
    if (!Store.online) return "";
    const c = myClan(), inv = CLANS.invitesFor(S.id).filter((x) => x.id !== c?.id);
    if (!c) {
      const sw = (i) => CLANS.COLORS.map((col) => `<button class="swatch ${clanDraft.colors[i] === col ? "on" : ""}" style="background:${col}" data-act="clancol" data-i="${i}" data-id="${col}" aria-label="Colour"></button>`).join("");
      return `<div class="panel"><h2>Clan</h2>
        ${inv.length ? `<div class="list">${inv.map((x) => `<div class="item on">${bannerHTML(x)}<div class="t">${esc(x.name)} [${esc(x.tag)}]<span>${esc(x.founderName)} invites you</span></div><button class="btn sm pri" data-act="clanjoin" data-id="${esc(x.id)}">Join</button></div>`).join("")}</div>` : ""}
        <p class="sub">Found your own clan: a name, a short tag shown next to your members' names, and a banner that flies over their houses on the map. Your clan gets its own chat.</p>
        <div class="grid2"><input id="clanname" maxlength="24" placeholder="Clan name" value="${esc(clanDraft.name || "")}" autocomplete="off" aria-label="Clan name"><input id="clantag" maxlength="4" placeholder="Tag (e.g. NORD)" value="${esc(clanDraft.tag || "")}" autocomplete="off" aria-label="Clan tag" style="text-transform:uppercase"></div>
        <p class="sub" style="margin-bottom:4px">Banner top</p><div class="coats">${sw(0)}</div><p class="sub" style="margin-bottom:4px">Banner bottom</p><div class="coats">${sw(1)}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px">${typeof RAIDART !== "undefined" && clanDraft.colors?.length >= 2 ? RAIDART.clanBanner({ ...clanDraft, tag: (clanDraft.tag || "").toUpperCase() }, 56, 80) : bannerHTML(clanDraft)}<button class="btn pri" data-act="clanfound" style="flex:1">Raise the banner</button></div></div>`;
    }
    const mem = CLANS.members(c), founder = c.founder === S.id, onlineIds = new Set(others.map((o) => o.id));
    const invitable = founder ? others.filter((o) => !mem.some((m) => m.id === o.id) && !(c.invites || []).includes(o.id)) : [];
    const RAc = typeof RAIDART !== "undefined";
    return `<div class="panel"><h2>Clan</h2>${RAc ? `<div class="clanhead">${RAIDART.clanBanner(c)}<div><b>${esc(c.name)}</b><span class="num">[${esc(c.tag)}]</span><span class="sub">Founded by ${esc(c.founderName)} · ${mem.length} member${mem.length > 1 ? "s" : ""}</span></div></div>` : `<div class="item">${bannerHTML(c)}<div class="t">${esc(c.name)} [${esc(c.tag)}]<span>Founded by ${esc(c.founderName)} · ${mem.length} member${mem.length > 1 ? "s" : ""}</span></div></div>`}
      <h3 style="margin-top:10px">Members</h3><div class="list">${mem.map((m) => `<div class="item">${RAc ? raPortrait(m.id, 32) : ""}<div class="t">${esc(m.name)}${m.id === c.founder ? " ⚑" : ""}${m.id === S.id ? " (you)" : ""}<span>${m.id === S.id || onlineIds.has(m.id) ? "online" : "away"}</span></div>${founder && m.id !== S.id ? `<button class="btn sm" data-act="clankick" data-id="${esc(m.id)}">Send away</button>` : ""}</div>`).join("")}</div>
      ${founder ? `<h3 style="margin-top:10px">Invite</h3>${invitable.length ? invitable.map((o) => `<div class="item"><div class="t">${esc(o.name)}<span>Level ${o.level}${o.clan ? ` · in [${esc(o.clan)}]` : ""}</span></div><button class="btn sm" data-act="claninv" data-id="${esc(o.id)}">Invite</button></div>`).join("") : `<p class="sub">Nobody else online to invite right now.</p>`}` : ""}
      <button class="btn danger" data-act="clanleave" style="width:100%;margin-top:10px">${founder ? "Lower the banner (disband)" : "Leave the clan"}</button></div>`;
  }

  // ------------------------------------------------------------ chat
  const CHAT_MAX = 200;
  const chatMuted = () => getPref("muted", []);
  const chatHue = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const chatOk = (d) => d && typeof d.text === "string" && d.t > Date.now() / 1000 - 86400 && !chatMuted().includes(d.from);
  const myClan = () => (S ? CLANS.of(S.id, S) : null);
  const myChannels = () => ["world", ...(party ? [party.id] : []), ...(myClan() ? ["clan:" + myClan().id] : [])];
  const curChannel = () => (chatCh === "clan" && myClan() ? "clan:" + myClan().id : chatCh !== "world" && chatCh !== "clan" && party ? party.id : "world");
  const chatUnread = () => chatDocs.filter((d) => d.from !== S?.id && d.t > chatSeen && myChannels().includes(d.ch)).length;
  function onChat(docs) {
    chatRaw = docs;
    chatDocs = docs.filter(chatOk).sort((a, b) => a.t - b.t);
    for (const d of chatDocs) {
      if (chatSeenIds.has(d.id)) continue;
      chatSeenIds.add(d.id);
      if (d.from === S.id || d.t < bootT || !myChannels().includes(d.ch)) continue;
      if (tab === "log" && !document.hidden) continue;
      SOUND.fx("chat");
      toast(`💬 ${d.name}${d.ch === "world" ? "" : d.ch.startsWith("clan:") ? " (clan)" : " (party)"}: ${d.text.slice(0, 70)}${d.text.length > 70 ? "…" : ""}`);
    }
    if (party == null && chatCh !== "world" && chatCh !== "clan") chatCh = "world";
    bump(); renderTabs();
    if (tab === "log") { const box = $("#chatlog"); if (box && !(document.activeElement?.id === "chatin")) renderPanel(false); }
  }
  function chatSend(text) {
    text = String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
    if (!text) return;
    if (Date.now() - lastChatSend < 1500) return toast("Easy. Wait a moment before the next message.");
    lastChatSend = Date.now();
    const ch = curChannel();
    Store.put("chat", nid(), { from: S.id, name: S.name, text, ch, t: G.now() });
    chatDraft = ""; SOUND.fx("click");
    renderPanel(true);
    $("#chatin")?.focus({ preventScroll: true });
  }
  function quickPhrases() {
    const raid = WEVENTS.activeRaid(), here = S.location || G.holdAt(livePos());
    return ["Need help!", "On my way", `Meet me at ${here}`, ...(raid ? [`🐉 Dragon at ${raid.town}!`] : []), "Trade?", "Group up?", "Thanks!", "GG"];
  }
  function chatPanel() {
    if (!Store.online) return "";
    const ch = curChannel(), muted = chatMuted();
    const msgs = chatDocs.filter((d) => d.ch === ch).slice(-40);
    chatSeen = Math.max(chatSeen, ...chatDocs.filter((d) => myChannels().includes(d.ch)).map((d) => d.t), 0);
    const line = (d) => `<div class="cm ${d.from === S.id ? "me" : ""}"><time>${new Date(d.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><button class="cn" data-act="chatmute" data-id="${esc(d.from)}" data-name="${esc(d.name)}" style="color:hsl(${chatHue(d.from)},65%,70%)" ${d.from === S.id ? "disabled" : ""}>${esc(d.name)}</button><span>${esc(d.text)}${d.pin && typeof d.pin.x === "number" ? ` <button class="linkbtn" data-act="pinadd" data-id="${esc(d.id)}">Add to my map</button>` : ""}</span></div>`;
    return `<div class="panel"><h2>Chat</h2>
      <div class="chips">${[["world", "World"], ...(party ? [[party.id, "Party"]] : []), ...(myClan() ? [["clan", `[${myClan().tag}] Clan`]] : [])].map(([id, l]) => `<button class="chip ${(id === "clan" ? "clan:" + myClan()?.id : id) === ch ? "on" : ""}" data-act="chatch" data-id="${esc(id)}">${l}</button>`).join("")}</div>
      <div class="chatlog" id="chatlog" aria-live="polite">${msgs.length ? msgs.map(line).join("") : `<p class="sub">${ch === "world" ? "No messages yet. Say hello to everyone online." : "Talk to your party here. Only party members see these in the game."}</p>`}</div>
      <div class="chips quick">${quickPhrases().map((q) => `<button class="chip" data-act="chatq" data-id="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <div class="chatrow"><input id="chatin" maxlength="${CHAT_MAX}" placeholder="${ch === "world" ? "Message everyone" : "Message your party"}" value="${esc(chatDraft)}" autocomplete="off" enterkeyhint="send" aria-label="Chat message"><button class="btn pri" data-act="chatsend">Send</button></div>
      ${muted.length ? `<p class="sub" style="margin:6px 0 0">Muted: ${muted.length} player${muted.length > 1 ? "s" : ""}. <button class="linkbtn" data-act="chatunmute">Unmute all</button></p>` : `<p class="sub" style="margin:6px 0 0">Tap a name to mute that player.</p>`}</div>`;
  }

  // ------------------------------------------------------------ trading
  function onTrades(docs) {
    trades = docs;
    for (const d of docs) {
      if (d.from === S.id && d.status !== "open") {           // my offer was answered: settle it
        const m = MP.settle(S, d); Store.remove("trades", d.id);
        if (m) { persist(true); toast(m); }
      } else if (d.to === S.id && d.status === "open" && !seenTrades.has(d.id)) { seenTrades.add(d.id); toast(`🤝 ${d.fromName} offers you a trade. See the Journal.`); }
    }
    if (tab === "log") bump();
  }
  function openTrade(card, note) {
    const eq = new Set(Object.values(G.loadout(S).equipment));
    const rows = S.inv.filter((r) => !eq.has(r.id) && D.ITEMS[r.item]);
    const gv = $("#tgive")?.value || "", av = $("#task")?.value || "";
    tradeTo = card.id;
    const far = card.x == null || !!MP.canTarget(S, card, livePos(), otherPos(card));
    openModal(`<h2>Trade with ${esc(card.name)}</h2><p class="sub">${far && SOCIAL.isFriend(S, card.id) ? "📦 They're not here, so a courier will carry your offer (about an hour of game time). " : ""}What you offer leaves your pack now and comes back if they say no.</p>${note ? `<p class="sub">${esc(note)}</p>` : ""}
      <div class="list" style="max-height:38vh;overflow:auto">${rows.map((r) => `<div class="item ${tradeSel.includes(r.id) ? "on" : ""}" data-act="tradepick" data-id="${r.id}" role="button" tabindex="0">${ICONART.item(r.item, 30, r)}<div class="t">${tradeSel.includes(r.id) ? "☑" : "☐"} ${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}<span>worth ${D.ITEMS[r.item].value}</span></div></div>`).join("") || '<p class="sub">Nothing loose in your pack.</p>'}</div>
      <div class="grid2" style="margin-top:10px"><label class="sub">Gold you give<input id="tgive" inputmode="numeric" value="${esc(gv)}" placeholder="0"></label><label class="sub">Gold you ask<input id="task" inputmode="numeric" value="${esc(av)}" placeholder="0 = gift"></label></div>
      <div class="evc"><button class="btn pri" data-act="tradesend">Send offer</button><button class="btn" data-act="close">Cancel</button></div>`);
  }
  async function answerTrade(id, yes) {
    let ok = false, poor = false;
    await Store.change("trades", id, (d) => {
      if (d.status !== "open" || !SOCIAL.arrived(d)) return d;
      if (!yes) { ok = true; return { ...d, status: "declined" }; }
      const nx = MP.accept(S, { ...d }); if (!nx) { poor = true; return d; }
      ok = true; return nx;
    });
    if (poor) return toast("You can't afford that.");
    if (!ok) return toast("That offer is gone.");
    persist(true); renderPanel(true); toast(yes ? "Deal. The goods are in your pack." : "You turn the offer down.");
  }
  // ------------------------------------------------------------ social: friends, private messages, courier trades
  let guardDocs = [], lastJobId = null;
  let friendDocs = [], dmDocs = [], socTab = "friends", socWith = null, socSearch = "", dmDraft = "", seenDMs = null, seenAdds = new Set(), courierToasted = new Set(), fRemoveAsk = null;
  function onFriends(docs) {
    friendDocs = docs;
    for (const d of SOCIAL.addedMe(docs, S)) if (!seenAdds.has(d.id)) { seenAdds.add(d.id); if ((d.t || 0) > G.now() - 3600) toast(`👥 ${d.name} added you as a friend.`); }
    renderTabs(); if (tab === "social") bump();
  }
  function onDMs(docs) {
    dmDocs = docs.filter((d) => d && d.from && d.to && typeof d.text === "string");
    const first = seenDMs === null; seenDMs = seenDMs || new Set();
    for (const d of dmDocs) if (!seenDMs.has(d.id)) {
      seenDMs.add(d.id);
      if (!first && d.to === S.id && !(tab === "social" && socTab === "msgs" && socWith === d.from)) { toast(`💬 ${d.fromName}: ${d.text.slice(0, 60)}`); SOUND.fx("page"); }
    }
    if (tab === "social" && socTab === "msgs" && socWith) { SOCIAL.markRead(S, dmDocs, socWith); refreshThread(); }
    renderTabs(); if (tab === "social") bump();
  }
  const myIncoming = () => trades.filter((d) => d.to === S.id && d.status === "open" && SOCIAL.arrived(d));
  const socialBadge = () => SOCIAL.unread(S, dmDocs) + SOCIAL.addedMe(friendDocs, S).length + myIncoming().length;
  function courierCheck() {
    for (const d of trades) if (d.to === S.id && d.courier && d.status === "open" && SOCIAL.arrived(d) && !courierToasted.has(d.id)) { courierToasted.add(d.id); toast(`📦 A courier brings an offer from ${d.fromName}. Open 👥 Trades.`); renderTabs(); if (tab === "social") bump(); }
  }
  function publishFriends() { if (Store.online) Store.put("friends", S.id, SOCIAL.record(S)); }
  function friendCard(id) { return cardOf(id) || (SOCIAL.friends(S)[id] ? { id, name: SOCIAL.friends(S)[id].name } : null); }
  function panelSocial() {
    const nDm = SOCIAL.unread(S, dmDocs), nAdd = SOCIAL.addedMe(friendDocs, S).length, inc = myIncoming();
    const chips = `<div class="seg">${[["friends", `Friends${nAdd ? ` (${nAdd})` : ""}`], ["msgs", `Messages${nDm ? ` (${nDm})` : ""}`], ["trades", `Trades${inc.length ? ` (${inc.length})` : ""}`]].map(([k, l]) => `<button class="${socTab === k ? "on" : ""}" data-act="soctab" data-id="${k}">${l}</button>`).join("")}</div>`;
    const off = Store.online ? "" : `<p class="sub">You're playing offline. Go online (Travel tab) to see friends and messages.</p>`;
    let body = "";
    if (socTab === "friends") {
      const fr = Object.entries(SOCIAL.friends(S)).map(([id, f]) => ({ id, name: f.name, card: cardOf(id) })).map((f) => ({ ...f, st: SOCIAL.status(f.card) })).sort((a, b) => b.st.online - a.st.online || a.name.localeCompare(b.name));
      const q = socSearch.trim().toLowerCase();
      const found = q.length >= 2 ? others.filter((o) => o.name?.toLowerCase().includes(q) && !SOCIAL.isFriend(S, o.id)).slice(0, 8) : [];
      const adds = SOCIAL.addedMe(friendDocs, S);
      body = `${adds.length ? `<h3>Added you</h3>${adds.map((d) => `<div class="item on"><div class="t">${esc(d.name)}<span>wants to be friends</span></div><button class="btn sm pri" data-act="faddrec" data-id="${esc(d.id)}">Add back</button></div>`).join("")}` : ""}
        <h3 style="margin-top:8px">Your friends · ${fr.length}</h3>
        ${fr.length ? fr.map((f) => `<div class="item" style="flex-wrap:wrap">${HEROART.portrait(f.card || { race: "nord", id: f.id }, 38)}<div class="t"><i class="onl ${f.st.online ? "on" : ""}"></i>${esc(f.name)}<span>${esc(f.st.text)}</span></div>
          <div class="fbtns"><button class="btn sm" data-act="fmsg" data-id="${esc(f.id)}">💬 Message</button><button class="btn sm" data-act="ftrade" data-id="${esc(f.id)}">🤝 Trade</button>${fRemoveAsk === f.id ? `<button class="btn sm danger" data-act="fdel" data-id="${esc(f.id)}">Really remove?</button>` : `<button class="btn sm" data-act="fdelask" data-id="${esc(f.id)}" aria-label="Remove friend">✕</button>`}</div></div>`).join("")
          : `<p class="sub">No friends yet. Add people from the Travellers list (Journal), or search below.</p>`}
        <h3 style="margin-top:12px">Add a friend</h3>
        <input id="socsearch" placeholder="Type a name" value="${esc(socSearch)}" autocomplete="off" aria-label="Search players by name">
        ${q.length >= 2 ? (found.length ? found.map((o) => `<div class="item"><div class="t">${esc(o.name)}<span>${esc(SOCIAL.status(o).text)}</span></div><button class="btn sm pri" data-act="fadd" data-id="${esc(o.id)}">＋ Add</button></div>`).join("") : `<p class="sub">Nobody by that name has been seen in this world.</p>`) : ""}`;
    } else if (socTab === "msgs") {
      if (socWith) {
        const f = friendCard(socWith) || { name: SOCIAL.conversations(S, dmDocs).find((c) => c.id === socWith)?.name || "Traveller" };
        SOCIAL.markRead(S, dmDocs, socWith);
        const th = SOCIAL.thread(dmDocs, S.id, socWith).slice(-60);
        body = `<div class="item"><button class="btn sm" data-act="dmback">‹ Back</button><div class="t" style="margin-left:8px">${esc(f.name)}<span>${esc(SOCIAL.status(cardOf(socWith)).text)}</span></div></div>
          <div class="chatlog" id="chatlog">${th.length ? th.map(dmLine).join("") : `<p class="sub">No messages yet. Only the two of you can read this.</p>`}</div>
          <div class="chatrow"><input id="dmin" maxlength="${SOCIAL.DM_MAX}" placeholder="Message ${esc(f.name)}" value="${esc(dmDraft)}" autocomplete="off" enterkeyhint="send" aria-label="Private message"><button class="btn pri" data-act="dmsend">Send</button></div>`;
      } else {
        const conv = SOCIAL.conversations(S, dmDocs), seen = new Set(conv.map((c) => c.id));
        const more = Object.entries(SOCIAL.friends(S)).filter(([id]) => !seen.has(id));
        body = (conv.length ? conv.map((c) => { const n = SOCIAL.unreadFrom(S, dmDocs, c.id); return `<div class="item ${n ? "on" : ""}" data-act="fmsg" data-id="${esc(c.id)}" role="button" tabindex="0"><div class="t">${esc(c.name)}${n ? ` <b class="gold">· ${n} new</b>` : ""}<span>${c.mine ? "You: " : ""}${esc(c.last.slice(0, 70))}</span></div><span class="num sub">${new Date(c.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>`; }).join("") : `<p class="sub">No messages yet.</p>`)
          + (more.length ? `<h3 style="margin-top:10px">Write to a friend</h3>${more.map(([id, f]) => `<div class="item"><div class="t">${esc(f.name)}</div><button class="btn sm" data-act="fmsg" data-id="${esc(id)}">💬 Write</button></div>`).join("")}` : "");
      }
    } else {
      const outC = trades.filter((d) => d.from === S.id && d.status === "open"), onWay = trades.filter((d) => d.to === S.id && d.status === "open" && !SOCIAL.arrived(d));
      body = `${inc.length ? inc.map((d) => `<div class="item on" style="flex-wrap:wrap"><div class="t">${d.courier ? "📦 " : ""}${esc(d.fromName)} offers ${esc(MP.describe(d))}${(d.items || []).length ? `<span class="icorow">${d.items.slice(0, 4).map((x) => ICONART.item(x.item, 26, x)).join("")}</span>` : ""}<span>${d.ask ? `for ${d.ask} gold (you have ${S.gold})` : "as a gift"}</span></div><div class="fbtns"><button class="btn sm pri" data-act="tradeyes" data-id="${esc(d.id)}" ${S.gold >= d.ask ? "" : "disabled"}>Accept</button><button class="btn sm" data-act="tradeno" data-id="${esc(d.id)}">Decline</button></div></div>`).join("") : `<p class="sub">No offers waiting for you.</p>`}
        ${onWay.length ? `<h3 style="margin-top:10px">Couriers on the way to you</h3>${onWay.map((d) => `<div class="item"><div class="t">📦 From ${esc(d.fromName)}<span>arrives in ${cdSpan(d.arrive)}</span></div></div>`).join("")}` : ""}
        ${outC.length ? `<h3 style="margin-top:10px">Your offers</h3>${outC.map((d) => `<div class="item"><div class="t">${d.courier ? "📦 " : ""}To ${esc(d.toName)}: ${esc(MP.describe(d))}<span>${d.ask ? `asking ${d.ask} gold` : "gift"} · ${d.courier && !SOCIAL.arrived(d) ? `courier arrives in ${cdSpan(d.arrive)}` : "waiting for an answer"}</span></div><button class="btn sm" data-act="tradecancel" data-id="${esc(d.id)}">Withdraw</button></div>`).join("")}` : ""}
        <p class="sub" style="margin-top:10px">To send an offer, tap 🤝 Trade next to a friend. If they're not in the same place, a courier carries it (about an hour of game time). What you offer leaves your pack at once and comes back if they say no.</p>`;
    }
    return `<div class="panel"><h2>👥 Friends & messages</h2>${chips}${off}${body}</div>`;
  }
  const dmLine = (d) => `<div class="cm ${d.from === S.id ? "me" : ""}"><time>${new Date(d.t * 1000).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</time><span class="cx">${esc(d.text)}</span></div>`;
  function refreshThread() {   // update the open conversation even while you're typing (the panel won't redraw then)
    const cl = $("#chatlog"); if (!cl || !socWith) return;
    const th = SOCIAL.thread(dmDocs, S.id, socWith).slice(-60);
    const html = th.length ? th.map(dmLine).join("") : `<p class="sub">No messages yet. Only the two of you can read this.</p>`;
    if (cl.innerHTML !== html) { cl.innerHTML = html; cl.scrollTop = cl.scrollHeight; }
  }
  async function sendDM() {
    const r = SOCIAL.dm(S, socWith, friendCard(socWith)?.name || "Traveller", $("#dmin")?.value);
    if (r.err) return toast(r.err);
    if (!Store.online) return toast("You're offline. Go online to send messages.");
    if (Date.now() - lastChatSend < 1200) return;
    lastChatSend = Date.now();
    seenDMs?.add(r.id); Store.put("dms", r.id, r.doc); if (!dmDocs.some((d) => d.id === r.id)) dmDocs.push({ ...r.doc, id: r.id }); dmDraft = ""; renderPanel(true);
    setTimeout(() => $("#dmin")?.focus(), 30);
  }

  // ------------------------------------------------------------ the Arena (Windhelm)
  let duels = [], seenDuels = new Set(), arenaStake = 100;
  function onDuels(docs) {
    duels = docs;
    for (const d of docs) {
      if (d.from === S.id && d.status !== "open") { if (d.status === "done") { festCount("duel"); if (d.winner === S.id) warPoint("duel", "Eastmarch"); } const m = ARENA.settle(S, d); Store.remove("duels", d.id); if (m) { persist(true); SOUND.fx(d.winner === S.id ? "victory" : "click"); toast("⚔ " + m); } }
      else if (d.to === S.id && d.status === "open" && !seenDuels.has(d.id)) { seenDuels.add(d.id); if (d.t > bootT) { SOUND.fx("shout"); toast(`⚔ ${d.fromName} challenges you in the Windhelm Arena${d.stake ? ` for ${d.stake} gold` : ""}!`); } }
    }
    if (tab === "town") bump();
  }
  function arenaHTML() {
    const a = ARENA.me(S), t = G.now();
    const inc = duels.filter((d) => d.to === S.id && d.status === "open" && t - d.t < ARENA.OPEN_MIN * 60), out = duels.filter((d) => d.from === S.id && d.status === "open");
    const fighters = others.filter((o) => o.loc === ARENA.TOWN && o.id !== S.id);
    const board = ARENA.board(ladderDocs, S).slice(0, 10);
    const RA = typeof RAIDART !== "undefined" ? RAIDART : null;
    return `${RA ? RA.arenaHTML() + RA.seasonBanner(ARENA.seasonName()) + RA.podium(board.slice(0, 3), raPortrait, UIART.rank) : ""}<div class="card"><h3 class="ico-h">${UIART.rank(a.rating, 30)} ${RA ? "Your standing" : `Season of ${esc(ARENA.seasonName())}`}</h3><p class="sub" style="margin:0">Your rating ${a.rating} · ${a.w} won, ${a.l} lost. Nobody dies in the Arena: the loser kneels and the healers patch everyone up.</p></div>
      ${inc.length ? `<h3 style="margin-top:12px">Challenges for you</h3>${inc.map((d) => `<div class="item on" style="flex-wrap:wrap">${RA ? RA.versus({ id: d.from, name: d.fromName }, { id: S.id, name: S.name }, d.stake, raPortrait) : ""}<div class="t">${esc(d.fromName)}<span>${d.stake ? `Stake ${d.stake} gold each · winner takes ${d.stake * 2}` : "A friendly bout, no bet"} · rating ${d.aRating}</span></div>
        <div style="display:flex;gap:6px"><button class="btn sm pri" data-act="duelyes" data-id="${esc(d.id)}" ${S.gold >= d.stake ? "" : "disabled"}>Fight</button><button class="btn sm" data-act="duelno" data-id="${esc(d.id)}">No</button></div></div>`).join("")}` : ""}
      ${out.length ? `<h3 style="margin-top:12px">Waiting for an answer</h3>${out.map((d) => `<div class="item" style="flex-wrap:wrap">${RA ? RA.versus({ id: S.id, name: S.name }, { id: d.to, name: d.toName }, d.stake, raPortrait) : ""}<div class="t">${esc(d.toName)}<span>${d.stake ? `${d.stake} gold held` : "Friendly bout"}</span></div><button class="btn sm" data-act="duelcancel" data-id="${esc(d.id)}">Withdraw</button></div>`).join("")}` : ""}
      <h3 style="margin-top:12px">Challenge someone</h3>
      <div class="chips">${[0, 100, 500, 1000].map((n) => `<button class="chip ${arenaStake === n ? "on" : ""}" data-act="duelstake" data-id="${n}">${n ? n + " gold" : "No bet"}</button>`).join("")}</div>
      ${!Store.online ? `<p class="sub">You're playing offline. The Arena needs other players.</p>` : fighters.length ? fighters.map((o) => `<div class="item"><div class="t">${esc(o.name)}<span>Level ${o.level} ${esc(D.RACES[o.race]?.name || "")}${(() => { const l = ladderDocs.find((x) => x.id === o.id); return l?.arena ? ` · rating ${l.arena.rating}` : ""; })()}</span></div><button class="btn sm pri" data-act="duelgo" data-id="${esc(o.id)}" ${S.gold >= arenaStake && ARENA.here(S) ? "" : "disabled"}>Challenge</button></div>`).join("")
        : `<p class="sub">Nobody else is in Windhelm right now. Ask a friend in the chat to meet you here.</p>`}
      <h3 style="margin-top:12px">Season ladder</h3>${board.length ? `<div class="list">${board.map((r, i) => `<div class="item ${r.id === S.id ? "on" : ""}"><span class="num" style="width:1.6em;color:var(--gold)">${i + 1}</span><div class="t">${esc(r.name)}${r.id === S.id ? " (you)" : ""}<span>${r.w} won · ${r.l} lost</span></div><span class="num gold">${r.rating}</span></div>`).join("")}</div>` : `<p class="sub">No bouts yet this season.</p>`}`;
  }
  async function answerDuel(id, yes) {
    let res = null, err = null;
    await Store.change("duels", id, (d) => {
      if (d.status !== "open") { err = "That challenge is gone."; return d; }
      if (!yes) return { ...d, status: "declined" };
      const r = ARENA.accept(S, { ...d }); if (r.err) { err = r.err; return d; }
      res = r; return r.doc;
    });
    if (err) return toast(err);
    persist(true); renderPanel(true);
    if (!yes) return toast("You turn the challenge down.");
    if (res) { festCount("duel"); if (res.doc.winner === S.id) warPoint("duel", "Eastmarch"); }
    if (res) { if (typeof RAIDART !== "undefined") RAIDART.cheer(4000); SOUND.fight({ fight: res.fight, died: res.doc.winner !== S.id }); postNews(`⚔ ${res.doc.winner === S.id ? S.name : res.doc.fromName} beat ${res.doc.winner === S.id ? res.doc.fromName : S.name} in the Windhelm Arena${res.doc.pot ? ` and won ${res.doc.pot} gold` : ""}.`);
      openModal(`<h2>${res.doc.winner === S.id ? "Victory in the Arena" : "Beaten, not broken"}</h2><p>${esc(res.text)}</p>${fightLog(res.fight)}${skillLine(res)}<button class="btn pri" data-act="close" style="width:100%">Continue</button>`); }
  }
  async function cancelTrade(id) { await Store.change("trades", id, (d) => (d.status === "open" ? { ...d, status: "cancelled" } : d)); }

  // ------------------------------------------------------------ multiplayer
  const nid = () => `${S.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  function postNews(text) { Store.put("news", nid(), { text, t: G.now() }); }
  function onAttacks(docs) {
    for (const d of docs) {
      if (d.to !== S.id || seenAttacks.has(d.id)) continue;
      seenAttacks.add(d.id);
      const r = MP.receive(S, d);
      Store.remove("attacks", d.id);
      if (!r) continue;
      if (r.bag) Store.addBag(r.bag);
      persist(true); closeDungeon(); renderPanel(true);
      showMessage(r.bad ? "On the road" : "Word reaches you", r.text, r.bad);
    }
  }
  function cardOf(id) { return others.find((o) => o.id === id); }
  function allies() {
    if (S.trip?.caravan) {   // guarding a caravan: the other guards who signed on fight with you, plus two hired swords
      const id = S.trip.caravan, mates = guardDocs.filter((g) => g.caravanId === id && g.uid !== S.id && g.status !== "left");
      return [...mates.map((g) => MP.allyFromCard(cardOf(g.uid) || { name: g.name, dmg: 4 + (g.level || 1) * 0.6 })), { name: "Caravan guard", dmg: 4 + S.level * 0.3 }, { name: "Caravan guard", dmg: 4 + S.level * 0.3 }];
    }
    if (S.dungeon?.run && coopUI) return coopUI.allies();   // a co-op run: whoever is in your room
    if (!party) return [];
    const me = livePos();
    return others.filter((o) => party.members.some((m) => m.id === o.id) && (S.dungeon ? o.dungeon === S.dungeon.place : (!o.dungeon && G.pxDist(otherPos(o), me) <= MP.NEAR_PX)))
      .map(MP.allyFromCard);
  }
  function followParty() {
    const tr = party?.trip;
    if (!tr || party.leader === S.id || tr.t <= (S.followT || 0) || S.dungeon || (S.trip && S.trip.status !== "travel")) return;
    if (G.now() - tr.t > 600) return;
    if (G.pxDist([S.x, S.y], tr.start) > 40) return;
    S.followT = tr.t;
    const err = G.startTrip(S, tr.destName, tr.dest);
    if (err) return;
    S.trip.speed = tr.speed; S.trip.total = G.minutesLeft(S);
    persist(true);
    toast(`You follow ${party.leaderName} to ${tr.destName}.`);
  }
  function checkAmbush() {
    if (!S.ambush) return;
    if (S.trip || S.location || S.dungeon) { S.ambush = false; publishCard(); return; }
    if (Date.now() - lastAmbushCheck < 3000 || $("#modal")) return;
    lastAmbushCheck = Date.now();
    const me = [S.x, S.y], t = G.now();
    const victim = others.find((o) => o.moving && !party?.members.some((m) => m.id === o.id) && G.pxDist(otherPos(o, t), me) <= MP.AMBUSH_PX && (o.safeUntil || 0) < t && !(S.ambushed || {})[o.id]);
    if (!victim) return;
    S.ambushed = { ...(S.ambushed || {}), [victim.id]: t };
    S.ambush = false;
    doAttack(victim, true);
  }
  function doAttack(card, ambush = false) {
    const err = ambush ? null : MP.canTarget(S, card, livePos(), otherPos(card));
    if (err) return toast(err);
    const r = MP.attack(S, card, { ambush, pos: livePos() });
    if (r.doc) Store.put("attacks", r.id, r.doc);
    if (r.news) postNews(r.news);
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    openModal(`<h2>${r.won ? "🗡 Victory" : r.died ? "💀 Defeated" : "Fight"}</h2><p>${esc(r.text)}</p>${r.fight ? fightLog(r.fight) : ""}${r.died ? `<p>${esc(r.died)}</p>` : ""}${skillLine(r)}<button class="btn ${r.died ? "danger" : "pri"}" data-act="close" style="width:100%">Continue</button>`, r.died ? "enc" : "");
  }
  function doPickpocket(card) {
    const err = MP.canTarget(S, card, livePos(), otherPos(card));
    if (err) return toast(err);
    const r = MP.pickpocket(S, card);
    if (r.doc) Store.put("attacks", r.id, r.doc);
    if (r.news) postNews(r.news);
    persist(true); renderPanel(true);
    showMessage("Pickpocket", r.text + ((r.skills || []).length ? " 📈 " + r.skills.join(" · ") : ""), !r.skills);
  }
  async function invite(card) {
    if (party && party.leader !== S.id) return toast("Only your party leader can invite.");
    if (party) { await Store.change("parties", party.id, (p) => ({ ...p, invites: [...new Set([...(p.invites || []), card.id])] })); }
    else { const id = nid(); await Store.put("parties", id, { leader: S.id, leaderName: S.name, members: [{ id: S.id, name: S.name }], invites: [card.id], t: G.now() }); }
    toast(`Invited ${card.name}. They'll see it in their Journal.`);
  }
  async function acceptInvite(pid) {
    if (party) await leaveParty();
    const r = await Store.change("parties", pid, (p) => ({ ...p, invites: (p.invites || []).filter((x) => x !== S.id), members: [...p.members.filter((m) => m.id !== S.id), { id: S.id, name: S.name }] }));
    toast(r ? "You joined the party." : "That party is gone.");
    publishCard();
  }
  async function declineInvite(pid) { await Store.change("parties", pid, (p) => ({ ...p, invites: (p.invites || []).filter((x) => x !== S.id) })); }
  async function leaveParty() {
    if (!party) return;
    if (party.leader === S.id) await Store.remove("parties", party.id);
    else await Store.change("parties", party.id, (p) => ({ ...p, members: p.members.filter((m) => m.id !== S.id) }));
    party = null; toast("You left the party."); publishCard();
  }
  async function chestShare(cid) {
    let got = null;
    await Store.change("chests", cid, (c) => {
      if (c.taken.includes(S.id)) return c;
      const sh = MP.shareOf(c, S.id), gold = Math.min(sh.gold, c.goldLeft), items = sh.items.filter((i) => c.itemsLeft.includes(i));
      got = { gold, items };
      const left = [...c.itemsLeft]; items.forEach((i) => left.splice(left.indexOf(i), 1));
      const nx = { ...c, goldLeft: c.goldLeft - gold, itemsLeft: left, taken: [...c.taken, S.id] };
      return nx.taken.length >= c.members.length ? null : nx;
    });
    if (!got) return toast("Too late. Somebody got there first.");
    S.gold += got.gold; got.items.forEach((i) => G.give(S, i)); persist(true);
    toast(`You take your share: ${got.gold} gold${got.items.length ? ", " + got.items.map((i) => D.ITEMS[i].name).join(", ") : ""}.`);
  }
  async function chestGrab(cid) {
    let got = null, place = "";
    await Store.change("chests", cid, (c) => { got = { gold: c.goldLeft, items: c.itemsLeft }; place = c.place; return null; });
    if (!got) return toast("Too late. Somebody got there first.");
    S.gold += got.gold; got.items.forEach((i) => G.give(S, i)); persist(true);
    postNews(`🐍 ${S.name} took everything from the party chest at ${place}. Betrayal!`);
    showMessage("Everything is yours", `You stuff ${got.gold} gold${got.items.length ? " and " + got.items.map((i) => D.ITEMS[i].name).join(", ") : ""} into your pack. Your party will remember this.`);
  }
  function openGuard(note) {
    const g = TOWNS.guardCheck(S);
    if (!g) return;
    openModal(`<p class="sub" style="margin:0">${esc(S.location)} · ${esc(g.hold)}</p><h2 style="margin:4px 0 8px">"Stop right there, criminal scum!"</h2>
      <p>A guard blocks your way. "You have a bounty of ${g.bounty} gold in ${esc(g.hold)}. Pay the court or serve your sentence."</p>${note ? `<p class="sub">${esc(note)}</p>` : ""}
      <div class="evc">
        <button class="btn pri" data-act="guard" data-c="pay" ${S.gold >= g.fine ? "" : "disabled"}>Pay the fine (${g.fine} gold, stolen goods taken)</button>
        ${g.bribe != null ? `<button class="btn" data-act="guard" data-c="bribe" ${S.gold >= g.bribe ? "" : "disabled"}>Bribe the guard (${g.bribe} gold, keep everything)</button>` : ""}
        <button class="btn" data-act="guard" data-c="jail">Go to jail (lose some skill progress)</button>
        <button class="btn danger" data-act="guard" data-c="resist">Resist arrest</button>
      </div>`, "enc");
  }
  function guardAction(c) {
    const r = TOWNS.guardChoice(S, c);
    if (r.bag) Store.addBag(r.bag);
    persist(true); renderPanel(true);
    if (r.stay) return openGuard(r.text);
    if (r.died || r.fight) return showFightResult(r);
    showMessage("The guard", r.text);
  }

  // ------------------------------------------------------------ panels
  /* [ux] a small header on every tab: what this screen is, with an ⓘ that explains it in plain words */
  const SCREEN_HELP = {
    map: ["Travel", "Pick where to go", "The card at the top says what to do next. Press Go to walk there: trips keep going while the app is closed. The gold ◆ on the map is your current quest; tap empty ground to roam off the road."],
    hero: ["Hero", "Level, skills and perks", "Skills grow as you use them. When you level up, choose Health, Magicka or Stamina and spend perk points in a skill's tree. Below are your powers, shouts, standing stone and achievements."],
    pack: ["Pack", "What you carry and wear", "Open your things to wear, use, compare or drop them. Use the search box to find an item by name. Heavy packs slow you down: sell things or store them at home."],
    tactics: ["Tactics", "How you fight", "Fights play out by themselves. Your rules are checked from the top every turn, like “health below 40% → drink a potion”. Test them against a dummy before a real fight."],
    town: ["Town", "Shops and services here", "Pick a place from the groups: Shops to buy and sell, Services for the inn, trainers and the forge, Guilds & jobs for paid work. Shops close at night (20:00–08:00)."],
    log: ["Journal", "Quests, chat and the world", "Use the ribbon to jump to a section; numbers show what's new. Quests tell you where to go next. Rarely used sections are folded: tap Show to open them."],
    social: ["Friends", "Friends, messages and trades", "Add players as friends, send them messages, and trade by courier from anywhere."],
  };
  function screenHead() {
    const h = SCREEN_HELP[tab]; if (!h) return "";
    return `<div class="uxhead"><div class="uxh-t"><b>${h[0]}</b><span>${h[1]}</span></div><button class="uxi" data-act="uxhelp" data-id="${tab}" aria-label="What is this screen?" aria-expanded="${uxHelpOpen === tab}">ⓘ</button></div>
      ${uxHelpOpen === tab ? `<div class="uxpop" role="note"><p>${h[2]}</p><button class="btn sm" data-act="uxhelp" data-id="${tab}">Got it</button></div>` : ""}`;
  }
  function renderPanel(force) {
    const side = $("#side");
    if (!force && side.contains(document.activeElement) && document.activeElement.matches("input,select")) return;
    rendered = version; lastPanelRender = Date.now();
    side.dataset.tab = tab;
    const openD = [...side.querySelectorAll("details")].map((d) => d.open), y = scrollY;
    const twp = typeof TABMENU !== "undefined" ? { stars: () => TABMENU.stars(S), perks: () => TABMENU.perks(S) } : {};
    side.innerHTML = tutTip() + screenHead() + ({ map: panelTravel, hero: panelHero, pack: panelPack, tactics: panelTactics, town: panelTown, log: panelLog, social: panelSocial, ...twp }[tab] || panelTravel)();
    if (typeof TABMENU !== "undefined") TABMENU.afterPanel(tab);
    if (!force) { side.querySelectorAll("details").forEach((d, i) => { if (openD[i] != null) d.open = openD[i]; }); scrollTo(0, y); }
    const cl = $("#chatlog"); if (cl) cl.scrollTop = cl.scrollHeight;
  }

  /* [ux] "What to do next": the current quest goal, things waiting for you, the next guide step and a place nearby */
  function nextCard() {
    if (S.dungeon) return "";
    const here = livePos(), eta = (n) => fmtMin(G.pxDist(here, WORLD.places[n]) * 1.1 / G.speed(S));
    const rows = [];
    const row = (ico, title, sub, btn) => rows.push(`<div class="item nx"><span class="nx-i" aria-hidden="true">${ico}</span><div class="t">${title}<span>${sub}</span></div>${btn || ""}</div>`);
    if (S.trip && S.trip.destName) row("🧭", `On the way to ${esc(S.trip.destName)}`, "You keep travelling even with the app closed.", "");
    QUESTS.ensure(S);
    const a = QUESTS.active(S)[0];
    if (a) {
      const n = QUESTS.target(a.st), at = n && S.location === n, o = a.st.obj;
      const btn = o.talk && at ? `<button class="btn sm pri" data-act="qtalk" data-id="${a.id}">${esc(o.label)}</button>`
        : n && !at && WORLD.places[n] && !(S.trip && S.trip.destName === n) ? `<button class="btn sm pri" data-act="go" data-place="${esc(n)}">Go</button>` : "";
      row("◆", `${esc(a.st.title)} <small class="nx-q">${esc(a.def.name)}</small>`, `${esc(a.st.text)}${n && !at && WORLD.places[n] ? ` · ${esc(n)} is ~${eta(n)} away` : ""}`, btn);
    }
    if (S.pendingLevels > 0 || PERKS.pointsLeft(S) > 0) row("⬆", S.pendingLevels > 0 ? "You can level up" : `${PERKS.pointsLeft(S)} perk point${PERKS.pointsLeft(S) > 1 ? "s" : ""} to spend`, "Open Hero to choose what grows.", `<button class="btn sm" data-act="uxtab" data-id="hero">Hero</button>`);
    if (S.location && !S.trip && (TOWNS.isTown(S.location) || G.shopTypes(S.location).length)) row("🏘", `You're in ${esc(S.location)}`, "Shops, the inn, trainers and jobs are in the Town tab.", `<button class="btn sm" data-act="uxtab" data-id="town">Town</button>`);
    const g = typeof GUIDE !== "undefined" && S.level < 15 ? GUIDE.STEPS.find((st) => !st[3](S)) : null;
    if (g) row("📖", `Next step: ${esc(g[1])}`, esc(g[2]), `<button class="btn sm" data-act="guidego" data-id="${g[0]}">Show me</button>`);
    if (!S.trip) {
      const near = Object.keys(WORLD.places).filter((n) => known(n) && n !== S.location && !S.discovered.includes(n)).map((n) => [n, G.pxDist(here, WORLD.places[n])]).sort((x, y) => x[1] - y[1])[0];
      if (near && rows.length < 4) row("✦", `Explore ${esc(near[0])}`, `${KIND[WORLD.places[near[0]][2]]} you haven't visited · ~${eta(near[0])}`, `<button class="btn sm" data-act="go" data-place="${esc(near[0])}">Go</button>`);
    }
    if (!rows.length) return "";
    return `<div class="panel nextcard"><h2>What to do next</h2><div class="list">${rows.join("")}</div></div>`;
  }
  function panelTravel() {
    const here = livePos();
    const places = Object.keys(WORLD.places).filter((n) => known(n) && n !== S.location && WORLD.same(here, WORLD.places[n]) && n.toLowerCase().includes(searchText.toLowerCase()))
      .map((n) => ({ n, d: G.pxDist(here, WORLD.places[n]) })).sort((a, b) => a.d - b.d);
    const bag = myBag();
    return `${nextCard()}${placeHere()}${typeof EXPLORE !== "undefined" ? EXPLORE.placeCard(S) : ""}<div class="panel"><h2>Where to?</h2><p class="sub">Tap a place on the map, or press <b>Go</b> below. Tap empty ground on the map to roam off the road.</p>
      <input id="search" placeholder="Search places" value="${esc(searchText)}" autocomplete="off" aria-label="Search places">
      <div class="list">${bag ? `<div class="item on"><div class="t">🎒 Your lost bag<span>${bag.gold} gold · ${Math.max(0, Math.floor((bag.expires - G.now()) / 60))} min left before it's fair game</span></div><button class="btn pri sm" data-act="go" data-place="__bag">Go</button></div>` : ""}
      ${places.slice(0, searchText || uxAllPlaces ? 40 : 8).map(({ n, d }) => { const k = WORLD.places[n][2]; return `<div class="item"><div class="t">${esc(n)}<span>${KIND[k]} · ${esc(G.holdAt(WORLD.places[n]))}${S.discovered.includes(n) ? "" : " · unvisited"}${(() => { const lf = DUNGEONS.enterable(n) ? DUNGEONS.refillLeft(S, n) : 0; return lf ? ` · 🔒 opens in ${cdSpan(G.now() + lf)}` : ""; })()}</span></div><span class="num sub">${d * 1.1 / G.speed(S) < 1 ? "" : "~"}${fmtMin(d * 1.1 / G.speed(S))}</span><button class="btn sm" data-act="go" data-place="${esc(n)}">Go</button></div>`; }).join("") || `<p class="sub">No places match “${esc(searchText)}”. Try part of the name, like “riv”.</p>`}${!searchText && places.length > 8 ? `<button class="btn" data-act="uxall" style="width:100%;margin-top:8px">${uxAllPlaces ? "Show only the nearest" : `Show all ${places.length} places`}</button>` : ""}</div>
      <p class="sub status ${Store.online ? "live" : ""}" style="margin-top:12px"><i></i>${Store.mode === "p2p" ? `The world · ${Store.peers ? `${Store.peers} other ${Store.peers === 1 ? "phone" : "phones"} online` : "looking for friends…"}` : Store.online ? `Shared world · ${others.length} other ${others.length === 1 ? "traveller" : "travellers"}` : APP ? "Offline game · saved on this phone" : "Saved in this browser only"}</p>${Store.online ? "" : onlineBtn()}</div>`;
  }

  function panelHero() {
    const need = 0 + (S.level + 3) * 25;
    const lvl = S.pendingLevels > 0 ? `<div class="panel" style="border-color:var(--gold)"><h2>Level up!</h2><p class="sub">You have ${S.pendingLevels} level-up${S.pendingLevels > 1 ? "s" : ""} to spend. Skyrim rules: +10 to one attribute.</p>
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><button class="btn attrbtn" data-act="lvl" data-a="health">${UIART.attr("health", 26)} Health</button><button class="btn attrbtn" data-act="lvl" data-a="magicka">${UIART.attr("magicka", 26)} Magicka</button><button class="btn attrbtn" data-act="lvl" data-a="stamina">${UIART.attr("stamina", 26)} Stamina</button></div></div>` : "";
    const groups = Object.entries(D.SKILL_GROUPS).map(([g, list]) => `<h3 style="margin-top:14px">${esc(g)}</h3><div class="skills">${list.map((sk) => {
      const s = S.skills[sk], n = F.skillXpNeeded(sk, s.lvl);
      const bs = boost(sk);
      return `<button class="skill ${heroSkill === sk ? "on" : ""}" data-act="skinfo" data-id="${esc(sk)}" aria-expanded="${heroSkill === sk}"><small><span>${UIART.skill(sk, 20)} ${esc(sk)}${typeof LEGEND !== "undefined" && LEGEND.stars(S, sk) ? ` <b class="leg-stars">${LEGEND.starText(LEGEND.stars(S, sk))}</b>` : ""} <i class="sk-i">ⓘ</i></span><b class="num">${skillNum(sk)}</b></small><div class="bar"><i style="width:${pct(s.xp, n)}%;background:var(--frost)"></i></div>${bs.any ? `<small class="boost-t">${esc(bs.text)}</small>` : ""}</button>${heroSkill === sk ? `<div class="skcard">${skillInfoHTML(sk)}</div>` : ""}`;
    }).join("")}</div>`).join("");
    const pts = PERKS.pointsLeft(S);
    const skillsWithPerks = Object.keys(PERKS.TREES);
    perkSkill = perkSkill && skillsWithPerks.includes(perkSkill) ? perkSkill : skillsWithPerks.slice().sort((a, b) => S.skills[b].lvl - S.skills[a].lvl)[0];
    const perks = `<div class="panel"><h2>Perks ${pts > 0 ? `<span class="gold">· ${pts} to spend</span>` : ""}</h2><p class="sub">One perk point per level, like Skyrim. Pick a skill:</p>
      <div class="chips" style="flex-wrap:wrap">${skillsWithPerks.map((k) => { const n = PERKS.TREES[k].filter(([id]) => PERKS.rank(S, id)).length; return `<button class="chip ${k === perkSkill ? "on" : ""}" data-act="pskill" data-id="${esc(k)}">${esc(k)} ${S.skills[k].lvl}${n ? ` · ${n}` : ""}</button>`; }).join("")}</div>
      <p class="sub perk-sum">${UIART.skill(perkSkill, 32)} ${esc(SKILLINFO.summary(perkSkill))} <button class="linkbtn" data-act="skinfo" data-id="${esc(perkSkill)}">How to raise it</button></p>
      <div class="list" style="margin-top:8px">${PERKS.TREES[perkSkill].map(([id, name, ranks]) => {
        const r = PERKS.rank(S, id), p = PERKS.BY_ID[id], err = PERKS.canTake(S, id);
        return `<div class="item ${r ? "on" : ""}" style="flex-wrap:wrap">${UIART.skill(perkSkill, 26)}<div class="t">${esc(name)}${ranks > 1 ? ` <span class="num">${r}/${ranks}</span>` : r ? " ✓" : ""}<span>${esc(p.desc)}${r < ranks ? ` · needs ${esc(perkSkill)} ${p.req[r]}${p.needs.length ? ` and ${p.needs.map((n) => esc(PERKS.BY_ID[n].name)).join(" or ")}` : ""}` : ""}</span></div>
          ${r < ranks ? `<button class="btn sm ${err ? "" : "pri"}" data-act="perk" data-id="${id}" ${err ? "disabled" : ""}>Take</button>` : ""}</div>`; }).join("")}</div></div>`;
    const t = G.now(), fx = (S.fx || []).filter((f) => f.until > t);
    const gfx = gearFx();
    const effects = fx.length || gfx.length || G.rested(S) || S.poison ? `<div class="panel"><h2>Active effects</h2><div class="list">${gfx.map((g) => `<div class="item"><div class="t">${esc(fxLabel(g))}<span>from ${esc(g.from)} (while worn)</span></div></div>`).join("")}${G.rested(S) ? `<div class="item"><div class="t">${(S.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested"}<span>Skills improve ${Math.round((S.restBonus || 0.05) * 100)}% faster · ${Math.ceil((S.rested - t) / 60)} min left</span></div></div>` : ""}
      ${S.poison ? `<div class="item"><div class="t">${esc(S.poison.name)} on your weapon<span>${S.poison.hits} hit${S.poison.hits > 1 ? "s" : ""} left</span></div></div>` : ""}
      ${fx.map((f) => `<div class="item"><div class="t">${esc(f.name)} ${f.mag}<span>${Math.ceil((f.until - t) / 60)} min left</span></div></div>`).join("")}</div></div>` : "";
    const tnow = G.now(), rp = POWERS.RACE[S.race];
    const cd = (at) => { const m = Math.ceil(((at || 0) + POWERS.DAY - tnow) / 60); return m > 0 ? `ready in ${m} min` : "ready"; };
    const shoutRows = Object.entries(POWERS.SHOUTS).filter(([, [, words]]) => words.some((w) => POWERS.known(S, w))).map(([id, [name, words, cds, desc]]) => {
      const lv = POWERS.level(S, id);
      return `<div class="item" style="flex-wrap:wrap">${UIART.shout(id, 30)}<div class="t">${esc(name)} <span class="num">${words.map((w) => POWERS.known(S, w) ? (POWERS.unlocked(S, w) ? `<b>${w}</b>` : `${w}🔒`) : "···").join(" ")}</span><span>${esc(desc)}${lv ? ` · cooldown ${cds[lv - 1]} s` : ""}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${words.filter((w) => POWERS.known(S, w) && !POWERS.unlocked(S, w)).map((w) => `<button class="btn sm" data-act="unlock" data-id="${w}" ${(S.souls || 0) > 0 ? "" : "disabled"}>Unlock ${w} (1 soul)</button>`).join("")}
        ${POWERS.ROAD_SHOUTS.includes(id) && lv ? `<button class="btn sm pri" data-act="roadshout" data-id="${id}" ${POWERS.voiceReady(S) ? "" : "disabled"}>Shout</button>` : ""}</div></div>`; }).join("");
    const fol = S.follower ? `<div class="panel"><h2>Follower</h2><div class="item">${NPCART.follower(S.follower.id, 36)}<div class="t">${esc(TOWNS.FOLLOWERS[S.follower.id][0])}<span>${Math.round(TOWNS.followerHp(S))}/${TOWNS.followerMax(S, S.follower.id)} health · fights beside you · carries 100 for you · goes down instead of dying</span></div><button class="btn sm" data-act="dismiss">Dismiss</button></div></div>` : "";
    const powersHtml = fol + `<div class="panel"><h2>Powers & shouts</h2><div class="list">
      <div class="item">${UIART.power(S.race, 30)}<div class="t">${esc(rp[0])} <span class="num">${cd(S.powerAt)}</span><span>${esc(rp[1])} Once a day: put "Use my racial power" in your tactics.</span></div></div>
      <div class="item">${S.stone ? UIART.stone(S.stone, 30) : ""}<div class="t">${S.stone ? esc(POWERS.STONES[S.stone][0]) : "No standing stone"}${S.stone && POWERS.stoneHasPower(S) ? ` <span class="num">${cd(S.stonePowerAt)}</span>` : ""}<span>${S.stone ? esc(POWERS.STONES[S.stone][1]) : "Visit one of the 13 standing stones (Guardian Stones are near Riverwood) to take its blessing."}</span></div></div>
      ${shoutRows || `<p class="sub">No Words of Power yet. Word Walls wait at the end of Nordic barrows (Bleak Falls Barrow has one), and the Greybeards at High Hrothgar teach Unrelenting Force.</p>`}</div>
      <p class="sub" style="margin-top:8px">Dragon souls: <b>${S.souls || 0}</b>${S.dragons ? ` · dragons slain: ${S.dragons}` : ""}. Kill a dragon to absorb its soul; each soul unlocks one word.${!POWERS.voiceReady(S) ? ` Your voice recovers in ${Math.ceil(S.voiceAt - tnow)} s.` : ""}</p></div>`;
    const amN = typeof AMMO !== "undefined" ? AMMO.status(S) : null;
    return `${lvl}${progressPanel()}${amN && !amN.best ? `<div class="panel" style="border-color:var(--ember)">${ammoNote()}</div>` : ""}${effects}${powersHtml}<div class="panel"><h2>${esc(S.name)}</h2><div class="herobox">${HEROART.figure(S, 160, 220)}</div>${amN?.best ? ammoNote() : ""}${(S.titles || []).length ? `<p class="sub" style="text-align:center;color:var(--gold)">${S.titles.map(esc).join(" · ")}</p>` : ""}<p class="sub">Level ${S.level} ${esc(D.RACES[S.race].name)} · ${esc(D.RACES[S.race].desc)}</p><p class="sub">📍 Places discovered: <b>${placesFound().got}</b> of ${placesFound().all}</p>
      <div class="bar" style="margin-top:8px"><i style="width:${pct(S.charXp, need)}%;background:var(--gold)"></i></div><p class="sub num">${Math.round(S.charXp)}/${need} toward level ${S.level + 1}</p>
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:8px">
        <div class="slot">Health<b class="num" style="display:block">${G.maxHealth(S)}</b></div><div class="slot">Magicka<b class="num" style="display:block">${G.maxMagicka(S)}</b></div><div class="slot">Stamina<b class="num" style="display:block">${G.maxStamina(S)}</b></div></div>
      <p class="sub" style="margin-top:10px">Spells: ${S.spells.map((s) => esc(D.SPELLS[s].name)).join(", ")} · Power: ${esc(D.RACES[S.race].power)}${S.horse ? ` · Horse: ${esc(S.horse.name)}` : ""}</p>
      ${(S.words || []).length ? `<p class="sub">Words of Power: ${S.words.map(esc).join(", ")}</p>` : ""}
      ${groups}
      <p class="sub" style="margin-top:14px">Skills rise as you use them, with Skyrim's own rates.</p>
      <details style="margin-top:8px"><summary class="sub" style="cursor:pointer;min-height:36px">Start over</summary><p class="sub">Deletes this character for good.</p><button class="btn danger" data-act="wipe">Delete ${esc(S.name)}</button></details></div>${perks}${bloodPanel()}${achPanel()}`;
  }

  function panelPack() {
    const eq = G.equipment(S), eqIds = new Set(Object.values(eq).map((r) => r.id));
    const slotNames = { weapon: "Weapon", shield: "Shield", head: "Head", chest: "Chest", hands: "Hands", feet: "Feet" };
    const groups = {};
    for (const r of S.inv) {
      const it = D.ITEMS[r.item]; if (!it) continue;
      const g = { weapon: "Weapons", potion: "Potions", poison: "Poisons", scroll: "Scrolls", tome: "Spell tomes", ammo: "Arrows & bolts", soulgem: "Soul gems", ingredient: "Ingredients", trophy: "Trophies", material: "Crafting materials" }[it.slot] || "Armor";
      (groups[g] = groups[g] || []).push(r);
    }
    const canShop = S.location && G.shopTypes(S.location).length && G.shopsOpen();
    const enchanted = S.inv.filter((r) => D.ITEMS[r.item]?.enchant), gems = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "soulgem");
    const row = (r) => {
      const it = D.ITEMS[r.item], open = packOpen === r.id, on = eqIds.has(r.id);
      const charge = it.enchant ? ` · ${Math.round(100 * (r.charge || 0) / it.enchant.capacity)}% charge` : it.staff ? ` · ${Math.round(100 * MAGIC.staffCharge(r) / it.staff.capacity)}% charge` : "";
      const acts = [];
      if (G.SLOTS.includes(it.slot)) acts.push(on ? `<button class="btn sm" data-act="uneq" data-slot="${it.slot}">Take off</button>` : `<button class="btn sm pri" data-act="eq" data-id="${r.id}">Equip</button>`);
      if (it.slot === "tome") acts.push(`<button class="btn sm pri" data-act="read" data-id="${r.id}">Read</button>`);
      if (it.slot === "recipe") acts.push(`<button class="btn sm pri" data-act="cfread" data-id="${r.id}">Read</button>`);
      if (it.slot === "potion") acts.push(`<button class="btn sm pri" data-act="drinkrow" data-id="${r.id}">Drink</button>`);
      if (it.slot === "poison") acts.push(`<button class="btn sm pri" data-act="poison" data-id="${r.id}">Coat weapon</button>`);
      if (it.slot === "ingredient") acts.push(`<button class="btn sm" data-act="eat" data-id="${r.id}">Eat (learn an effect)</button>`);
      if ((it.enchant || it.staff) && gems.length) acts.push(...gems.map((g) => `<button class="btn sm" data-act="recharge" data-id="${r.id}" data-gem="${g.id}">Recharge (${esc(D.ITEMS[g.item].name.split(" (")[0])})</button>`));
      if (canShop) acts.push(`<button class="btn sm" data-act="sell" data-id="${r.id}">Sell ${G.sellPrice(S, r)}g</button>`);
      const ingFx = it.slot === "ingredient" && TOWNS.INGREDIENT_FX[r.item] ? TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? e : "?").join(", ") : "";
      const qual = r.tq ? TOWNS.QUALITY[r.tq] + " " : "";
      return `<div class="item ${on ? "on" : ""}" data-act="packrow" data-id="${r.id}" style="flex-wrap:wrap">${ICONART.item(r.item, 34, r)}<div class="t">${esc(qual + it.name + (r.nm ? ` “${r.nm}”` : ""))}${r.qty > 1 ? ` ×${r.qty}` : ""}${on ? " ✓" : ""}${r.stolen ? ' <span class="danger-high">stolen</span>' : ""}<span>${esc(ingFx || G.itemStats(r.item))}${r.temper ? ` · +${r.temper} improved` : ""}${charge} · ${+(it.weight * r.qty).toFixed(2)} wt</span></div>
        ${open ? `<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">${acts.join("") || '<span class="sub">Nothing to do with this here.</span>'}</div>` : ""}</div>`;
    };
    return `<div class="panel"><h2>Equipped · ${esc(S.loadout)}</h2>${dollScreen()}${typeof AMMO !== "undefined" && AMMO.status(S) && !AMMO.status(S).best ? ammoNote() : ""}
      <p class="sub" style="margin-top:8px">Carrying <span class="num">${G.carried(S).toFixed(1)}/${G.capacity(S)}</span>${G.overweight(S) ? " — too heavy to run" : ""} · ${S.gold} gold${enchanted.length ? ` · ${enchanted.length} enchanted` : ""}</p></div>
      <div class="panel"><h2>Pack</h2><p class="sub">Tap an item for options.${canShop ? " You're in town: you can sell here." : ""}</p>
      ${S.inv.length > 6 ? `<input id="packsearch" class="uxsearch" type="search" placeholder="🔍 Find an item" value="${esc(packSearch)}" autocomplete="off" aria-label="Find an item in your pack">` : ""}
      ${Object.entries(groups).map(([g, rows]) => [g, rows.filter((r) => !packSearch || ((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name).toLowerCase().includes(packSearch.toLowerCase()))]).filter(([, rows]) => rows.length).map(([g, rows]) => `<h3 style="margin-top:12px">${g}</h3><div class="list">${rows.map(row).join("")}</div>`).join("") || (packSearch ? `<p class="sub">Nothing called “${esc(packSearch)}”. Try part of the name.</p>` : '<p class="sub">Your pack is empty. Buy things in a town (Town tab → Shops) or loot them on the road.</p>')}</div>`;
  }

  let pendingPreset = null, pendingDel = false;
  function tacticActions() {
    return [...Object.entries(D.BASIC_ACTIONS).map(([id, l]) => [id, l]),
      ...S.spells.filter((x) => D.SPELLS[x] && D.SPELLS[x].kind !== "utility").map((x) => [`spell:${x}`, `Cast ${D.SPELLS[x].name} (${G.spellCost(S, D.SPELLS[x])} magicka)`]),
      ...S.spells.filter((x) => D.SPELLS[x] && MAGIC.dualable(D.SPELLS[x])).map((x) => [`dual:${x}`, `Dual-cast ${D.SPELLS[x].name} (×${MAGIC.DUAL_POWER}, ${Math.round(G.spellCost(S, D.SPELLS[x]) * MAGIC.DUAL_COST)} magicka)`]),
      ...["health", "magicka", "stamina"].map((r) => [`potion:${r}`, `Drink a ${r} potion (have ${G.countRestore(S, r)})`]),
      ...[...new Set(S.inv.filter((r) => D.ITEMS[r.item]?.slot === "scroll").map((r) => r.item))].map((i) => [`scroll:${i}`, `Read ${D.ITEMS[i].name}`]),
      ["power:race", `Use ${POWERS.RACE[S.race][0]} (racial power, once a day)`],
      ...(S.werewolf ? [["power:beast", "Beast Form (werewolf, once a day: much stronger, no potions)"]] : []),
      ...(POWERS.stoneHasPower(S) && S.stone !== "tower" ? [["power:stone", `Use ${POWERS.STONES[S.stone][0]}'s power (once a day)`]] : []),
      ...Object.keys(POWERS.SHOUTS).filter((id) => !POWERS.ROAD_SHOUTS.includes(id) && POWERS.level(S, id)).map((id) => [`shout:${id}`, `Shout ${POWERS.SHOUTS[id][0]} (${POWERS.level(S, id)} word${POWERS.level(S, id) > 1 ? "s" : ""})`])];
  }
  /* why a rule may not fire right now */
  function ruleWarn(r) {
    const [kind, arg] = r.do.split(":");
    if (kind === "spell" && !S.spells.includes(arg)) return "You don't know this spell, so it's skipped.";
    if (kind === "potion" && !G.countRestore(S, arg)) return `You have no ${arg} potions.`;
    if (kind === "scroll" && !S.inv.some((x) => x.item === arg)) return "You have none of these scrolls.";
    if (kind === "shout" && !POWERS.level(S, arg)) return "You can't shout this yet.";
    if (!D.CONDITIONS[r.if]) return "Unknown condition.";
    return "";
  }
  function firedSummary(f) {
    const n = {}; for (const l of f.log) if (l.rule) n[l.rule] = (n[l.rule] || 0) + 1;
    const ks = Object.keys(n).sort((a, b) => a - b);
    return ks.length ? "Rules used: " + ks.map((k) => `#${k} ×${n[k]}`).join(", ") + "." : "No rule fired: you just attacked.";
  }
  // ------------------------------------------------------------ the newbie guide
  function guideHTML() {
    const pr = GUIDE.progress(S);
    return `<h2>📖 Guide</h2><p class="sub">Your first hour in Skyrim, step by step. Steps tick off by themselves. ${pr.done} of ${pr.total} done.</p>
      <div class="bar" style="margin:6px 0 10px"><i style="width:${Math.round(pr.done / pr.total * 100)}%;background:var(--gold)"></i></div>
      <div class="list guide">${GUIDE.STEPS.map(([id, title, text, done], i) => { const d = done(S); return `<div class="item gstep ${d ? "done" : ""}" style="flex-wrap:wrap">${UIART.guide(id, 30)}<div class="t"><b>${d ? "✓" : i + 1}.</b> ${esc(title)}<span>${esc(text)}</span></div>${d ? "" : `<button class="btn sm pri" data-act="guidego" data-id="${id}">Show me</button>`}</div>`; }).join("")}</div>
      <h3 style="margin-top:14px">Questions</h3>${GUIDE.FAQ.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p class="sub">${esc(a)}</p></details>`).join("")}
      <button class="btn pri" data-act="close" style="width:100%;margin-top:12px">Close</button>`;
  }
  function openGuide() { S.guideOffered = true; openModal(guideHTML()); }
  function guideGo(id) {
    const st = GUIDE.STEPS.find((x) => x[0] === id); if (!st) return;
    const to = st[4]; closeModal(); closeMenu?.();
    tab = to.tab;
    if (to.shop) { if (S.location && G.shopTypes) townShop = to.shop; }
    if (to.tab === "social") socTab = "friends";
    renderTabs(); renderPanel(true);
    $("#side").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    toast(`📖 ${st[1]}: ${st[2]}`);
  }
  function guideCard() {
    const pr = GUIDE.progress(S); if (pr.done >= pr.total) return "";
    return `<div class="panel"><h2>📖 Guide</h2><p class="sub">New here? ${pr.done} of ${pr.total} first steps done.</p><button class="btn pri" data-act="guide" style="width:100%">Open the guide</button></div>`;
  }
  // ---- the paper doll (dollart.js): figure + slots on the Pack tab
  function dollStats() {
    let armor = 0, dmg = 0;
    try { const f = new G.Fight(S, { name: "-", health: 1, damage: 0, tags: [] }); armor = Math.round(f.armorRating().rating); for (let i = 0; i < 8; i++) dmg += f.weaponDamage(); dmg = Math.round(dmg / 8); } catch { /* fine without numbers */ }
    return { armor, dmg, carried: G.carried(S).toFixed(1), cap: G.capacity(S) };
  }
  const dollScreen = () => DOLL.screen(S, dollStats());
  function ammoNote() {   // what your bow or crossbow shoots, and a warning when you're out
    const a = typeof AMMO !== "undefined" ? AMMO.status(S) : null; if (!a) return "";
    return `<p class="sub ammo ${a.best ? "" : "warn"}">🏹 ${esc(a.text)}</p>`;
  }
  function panelTactics() {
    const L = G.loadout(S), rules = L.rules;
    const condOpts = Object.entries(D.CONDITIONS).map(([id, [label, p]]) => `<option value="${id}" ${tacticsDraft.if === id ? "selected" : ""}>${esc(label)}${p === "turn" ? " …" : p ? " …%" : ""}</option>`).join("");
    const actList = tacticActions();
    if (!actList.some(([id]) => id === tacticsDraft.do)) actList.push([tacticsDraft.do, G.describeAction(tacticsDraft.do)]);
    const actOpts = actList.map(([id, l]) => `<option value="${esc(id)}" ${tacticsDraft.do === id ? "selected" : ""}>${esc(l)}</option>`).join("");
    const kind = D.CONDITIONS[tacticsDraft.if]?.[1];
    const vals = kind === "turn" ? D.TURNS : D.PERCENTS;
    if (kind && !vals.includes(tacticsDraft.pct)) tacticsDraft.pct = kind === "turn" ? 3 : 50;
    const enemies = D.ENCOUNTERS.filter((e) => e.kind !== "event");
    const dead = G.deadRules(rules), editing = tacticsDraft.edit != null && rules[tacticsDraft.edit];
    const cards = rules.map((r, i) => { const d = G.describeRule(r), w = dead[i] || ruleWarn(r);
      return `<div class="rcard ${r.off ? "off" : ""} ${dead[i] ? "dead" : ""} ${tacticsDraft.edit === i ? "editing" : ""}"><div class="rhead"><span class="n">${i + 1}</span>${r.do === "power:stone" && S.stone ? UIART.stone(S.stone, 30) : r.do === "power:race" ? UIART.power(S.race, 30) : UIART.action(r.do, 30)}<div class="rtxt"><div><small>IF</small> <b>${esc(d.cond)}</b></div><div><small>THEN</small> <b>${esc(d.act)}</b></div>${r.off ? '<div class="rw">Switched off</div>' : w ? `<div class="rw">⚠ ${esc(w)}</div>` : ""}</div></div>
        <div class="racts"><button class="iconbtn" data-act="rup" data-i="${i}" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button class="iconbtn" data-act="rdown" data-i="${i}" aria-label="Move down" ${i < rules.length - 1 ? "" : "disabled"}>↓</button><button class="iconbtn" data-act="roff" data-i="${i}" aria-label="${r.off ? "Switch on" : "Switch off"}">${r.off ? "▶" : "⏸"}</button><button class="iconbtn" data-act="redit" data-i="${i}" aria-label="Edit">✎</button><button class="iconbtn" data-act="rdel" data-i="${i}" aria-label="Remove">✕</button></div></div>`; }).join("");
    return `<div class="panel"><h2>Tactics · ${esc(S.loadout)}</h2><p class="sub">Every turn, the <b>first</b> rule that is true <b>and</b> possible (enough magicka, stamina, potions…) fires. If none does, you attack. Power attacks cost ${F.powerAttackCost(G.equipment(S).weapon ? D.ITEMS[G.equipment(S).weapon.item].weight : 0)} stamina now.</p>${ammoNote()}
      <div class="rlist">${cards || '<p class="sub">No rules: you will just attack.</p>'}</div>
      <div class="card redit" id="tedit"><h3>${editing ? `Change rule ${tacticsDraft.edit + 1}` : "Add a rule"}</h3>
      <label class="sub">If</label><select id="tc" aria-label="Condition">${condOpts}</select>
      ${kind ? `<select id="tp" aria-label="${kind === "turn" ? "Turn" : "Percent"}">${vals.map((p) => `<option value="${p}" ${tacticsDraft.pct === p ? "selected" : ""}>${p}${kind === "turn" ? "" : "%"}</option>`).join("")}</select>` : ""}
      <label class="sub">Then</label><select id="ta" aria-label="Action">${actOpts}</select>
      ${editing ? `<div class="grid2"><button class="btn pri" data-act="rsave">Save rule ${tacticsDraft.edit + 1}</button><button class="btn" data-act="rcancel">Cancel</button></div>`
        : `<button class="btn pri" data-act="radd" style="width:100%" ${rules.length >= D.MAX_RULES ? "disabled" : ""}>Add rule ${rules.length >= D.MAX_RULES ? `(max ${D.MAX_RULES})` : ""}</button><p class="sub" style="margin:4px 0 0">New rules go above “Always → Attack”, so they get used.</p>`}</div>
      <h3 style="margin-top:14px">Presets</h3>${pendingPreset ? `<div class="card"><p>Replace your ${rules.length} rule${rules.length === 1 ? "" : "s"} with the <b>${esc(D.PRESETS[pendingPreset].name)}</b> preset?</p><div class="grid2"><button class="btn danger" data-act="presetyes">Replace</button><button class="btn" data-act="presetno">Keep mine</button></div></div>`
        : `<div class="chips">${Object.entries(D.PRESETS).map(([id, p]) => `<button class="chip" data-act="preset" data-id="${id}">${esc(p.name)}</button>`).join("")}</div>`}</div>
      <div class="panel"><h2>Test fight</h2><p class="sub">A practice fight at full health. Nothing is used up, and you can't die.</p>
      <div class="list"><select id="te" aria-label="Enemy">${enemies.map((e) => `<option>${esc(e.name)}</option>`).join("")}</select><button class="btn pri" data-act="test">Fight it</button></div>
      ${testResult ? `<p style="margin-top:10px;display:flex;align-items:center;gap:10px">${ICONART.enemy(testResult.name, D.ENCOUNTERS.find((x) => x.name === testResult.name)?.tags, 40)}<span><b>${testResult.f.won ? "Victory" : "Defeat"}</b> against the ${esc(testResult.name)}.</span></p><p class="sub">${firedSummary(testResult.f)}</p>${fightLog(testResult.f)}` : ""}</div>
      <div class="panel"><h2>Loadouts</h2><p class="sub">A loadout is gear + rules. Switch before a fight.</p>
      <div class="chips">${Object.keys(S.loadouts).map((n) => `<button class="chip lochip ${n === S.loadout ? "on" : ""}" data-act="lo" data-name="${esc(n)}">${DOLL.loadoutThumb(S, n)}${esc(n)}</button>`).join("")}</div>
      <div class="list"><input id="lon" maxlength="20" placeholder="New loadout name, e.g. Dragon" aria-label="New loadout name"><div class="grid2"><button class="btn" data-act="losave">Save current as</button>${pendingDel ? `<button class="btn danger" data-act="lodelyes">Really delete ${esc(S.loadout)}?</button>` : `<button class="btn danger" data-act="lodel">Delete ${esc(S.loadout)}</button>`}</div></div></div>`;
  }

  let horseCoat = "bay";
  function cartHTML(open, wanted) {
    const c = S.cart, coat = S.horse ? HORSES.coat(S.horse.coat)[2] : undefined;
    if (!c) return `<div class="card cvcard"><div class="cvhead">${CARAVANS.wagonHTML(96, 64, { cover: false, coat })}<div><h3 style="margin:0">A cart · ${CARAVANS.CART_PRICE} gold</h3><p class="sub" style="margin:2px 0 0">Hitched to your horse it carries +${CARAVANS.CART_CARRY}. You go 10% slower, keep to the roads, and bandits sometimes come for the cargo.</p></div></div>
      <button class="btn pri" data-act="cartbuy" style="width:100%;margin-top:8px" ${S.horse && open && !wanted && S.gold >= CARAVANS.CART_PRICE ? "" : "disabled"}>${S.horse ? "Buy the cart" : "You need a horse first"}</button></div>`;
    const here = c.parked === S.location;
    return `<div class="card cvcard"><div class="cvhead">${CARAVANS.wagonHTML(96, 64, { cover: false, coat, wheels: c.wheels })}<div><h3 style="margin:0">Your cart</h3><p class="sub" style="margin:2px 0 0">${c.parked ? `Waiting at the stables in ${esc(c.parked)}.` : CARAVANS.hasCart(S) ? `Hitched up: +${CARAVANS.CART_CARRY} carry weight, roads only.` : "Your horse isn't here to pull it."}${c.wheels ? " Iron-bound wheels." : ""}</p></div></div>
      <div class="grid2" style="margin-top:8px"><button class="btn" data-act="carttoggle" ${c.parked && !here ? "disabled" : ""}>${c.parked ? "Hitch it up" : "Leave it here"}</button><button class="btn" data-act="cartwheels" ${c.wheels || !open || S.gold < CARAVANS.WHEELS_PRICE ? "disabled" : ""}>${c.wheels ? "Iron wheels fitted" : `Iron wheels (${CARAVANS.WHEELS_PRICE})`}</button></div></div>`;
  }
  function caravansHTML(l) {
    const list = CARAVANS.at(l), j = S.caravanJob;
    if (!list.length) {
      const next = CARAVANS.all().filter((c) => c.to === l).sort((a, b) => a.arrive - b.arrive)[0];
      return `<p class="sub">No caravans in ${esc(l)} right now.${next ? ` ${esc(next.line.name)} is on the road from ${esc(next.from)} and arrives in ${cdSpan(next.arrive)}.` : ""}</p>`;
    }
    return list.map((c) => {
      const g = guardDocs.filter((d) => d.caravanId === c.id && d.status !== "left"), mine = j?.id === c.id, sh = CARAVANS.share(c.id, mine ? g : [...g, { caravanId: c.id }], c.from, c.to), p = CARAVANS.plan(c);
      const guards = g.length ? `<div class="cvguards">${g.map((d) => `<span>${typeof HEROART !== "undefined" ? HEROART.portrait(cardOf(d.uid) || { race: d.race || "nord", id: d.uid, name: d.name }, 26) : ""}${esc(d.name)} · ${d.level || 1}</span>`).join("")}</div>` : `<p class="sub" style="margin:4px 0">No guards yet.</p>`;
      const goods = c.here ? CARAVANS.stock(c).map((i) => `<div class="item">${typeof ICONART !== "undefined" ? ICONART.item(i, 32) : ""}<div class="t">${esc(D.ITEMS[i].name)}<span>${esc(G.itemStats(i))}</span></div><span class="num gold">${CARAVANS.price(S, i)}</span><button class="btn sm" data-act="cvbuy" data-id="${esc(c.id)}" data-item="${esc(i)}" ${S.gold >= CARAVANS.price(S, i) ? "" : "disabled"}>Buy</button></div>`).join("") : "";
      return `<div class="card cvcard"><div class="cvhead">${CARAVANS.wagonHTML(110, 72, { khajiit: c.line.khajiit })}<div><h3 style="margin:0">${esc(c.line.name)}</h3><p class="sub" style="margin:2px 0 0">${c.here ? `To ${esc(c.to)} · leaves in ${cdSpan(c.depart)}` : `Arriving from ${esc(c.from)} in ${cdSpan(c.arrive)}`}</p></div></div>
        ${c.here ? `<p class="sub" style="margin:6px 0 0">Expect ${p.at.length === 2 ? "two ambushes" : "an ambush"} on the road. Pay: about <b class="gold">${sh.each}</b> gold each with ${sh.n} guard${sh.n > 1 ? "s" : ""} (more guards, bigger contract).</p>${guards}
          ${mine ? `<button class="btn" data-act="cvleave" style="width:100%">Leave the caravan</button>` : `<button class="btn pri" data-act="cvsign" data-id="${esc(c.id)}" style="width:100%" ${j || S.trip ? "disabled" : ""}>${j ? "You're guarding another caravan" : "Sign on as a guard"}</button>`}
          <h3 style="margin-top:10px">Wares</h3>${goods}` : ""}</div>`;
    }).join("");
  }
  function caravanJobPanel() {
    const j = S.caravanJob; if (!j) return "";
    const st = j.status === "signed" ? `Waiting in ${esc(j.from)}. The wagons leave in ${cdSpan(j.depart)} — be there.` : `On the road to ${esc(j.to)}. Arrives in ${cdSpan(j.arrive)}. ${j.ambush ? `Ambushes fought off: ${j.ambush}.` : "Stay sharp."}`;
    return `<div class="panel"><h2>🐫 Caravan job</h2><div class="cvhead">${CARAVANS.wagonHTML(84, 56, { khajiit: CARAVANS.LINES.find((x) => x.id === j.line)?.khajiit })}<div><b>${esc(j.name)}</b><p class="sub" style="margin:2px 0 0">${st}</p></div></div><button class="btn" data-act="cvleave" style="width:100%;margin-top:8px">Leave the caravan</button></div>`;
  }
  async function caravanPay() {
    const a = CARAVANS.arrived(S, guardDocs); if (!a) return;
    S.caravanJob = null;
    let paid = false;
    await Store.change("guards", a.recId, (d) => { const nd = CARAVANS.claim(d || { caravanId: a.recId.split("-").slice(0, 3).join("-"), uid: S.id, name: S.name }, a.pay); if (nd) paid = true; return nd || d; });
    if (!paid) { persist(true); return; }
    S.gold += a.pay; persist(true); SOUND.fx("coin");
    showMessage("Caravan", `🐫 ${a.name} rolls safely into ${a.to}. The caravan master counts out your share: ${a.pay} gold${a.n > 1 ? ` (${a.n} guards)` : ""}.`);
  }
  function stablesHTML(open, wanted) {
    const h = HORSES.fix(S), l = S.location;
    const swatch = (c, on, act) => `<button class="coat ${on ? "on" : ""}" ${act ? `data-act="hcoat" data-id="${c[0]}"` : "disabled"} style="background:${c[2]}" aria-label="${esc(c[1])}" aria-pressed="${on}"></button>`;
    if (!h) return `<div class="card"><h3>Buy a horse · ${D.HORSE_PRICE} gold</h3><p class="sub">Riding, you travel ${D.HORSE_SPEED}× faster and flee more easily. Your horse carries ${D.HORSE_CARRY} for you even when you walk beside it. Horses never die: if badly hurt, they limp back to the nearest stables to rest.</p>
      <div class="coats">${HORSES.COATS.map((c) => swatch(c, c[0] === horseCoat, true)).join("")}</div><p class="sub" style="margin:4px 0 0">${esc(HORSES.coat(horseCoat)[1])}</p>
      <div class="chatrow"><input id="hname" maxlength="16" placeholder="Name your horse" autocomplete="off" aria-label="Horse name"><button class="btn pri" data-act="hbuy" ${open && !wanted && S.gold >= D.HORSE_PRICE ? "" : "disabled"}>Buy</button></div>
      ${!open ? `<p class="sub">The stables open at 08:00.</p>` : S.gold < D.HORSE_PRICE ? `<p class="sub">You have ${S.gold} gold.</p>` : ""}</div>`;
    const c = HORSES.coat(h.coat), mh = HORSES.maxHp(h), hp = HORSES.hp(S), aw = HORSES.away(S);
    const here = aw && h.away.town === l, mins = Math.ceil(HORSES.readyIn(S) / 60);
    return `<div class="card"><div class="row" style="display:flex;gap:10px;align-items:center">${UIART.horse(h.coat, 44, h.armor && h.armor !== "none")}<div style="flex:1"><h3 style="margin:0">${esc(h.name)}</h3><span class="sub">${esc(c[1])} · ${esc(HORSES.ARMOR[h.armor].name)}</span></div></div>
        ${aw ? `<p>${here ? (mins > 0 ? `${esc(h.name)} is resting here. Ready in about ${mins} min.` : `${esc(h.name)} is rested and waiting for you.`) : `${esc(h.name)} is resting at the stables in ${esc(h.away.town)}.`}</p>
          ${here ? `<div class="grid2"><button class="btn pri" data-act="hfetch" ${mins > 0 ? "disabled" : ""}>Take ${esc(h.name)}</button><button class="btn" data-act="hhurry" ${mins > 0 ? "" : "disabled"}>Patch up now (${HORSES.HURRY_PRICE} gold)</button></div>` : ""}`
        : `<div class="vital" style="margin-top:8px"><small><span>Health</span><span class="num">${Math.round(hp)}/${mh}</span></small><div class="bar"><i style="width:${pct(hp, mh)}%;background:var(--sp)"></i></div></div>`}
        <div class="chatrow" style="margin-top:8px"><input id="hname" maxlength="16" placeholder="New name" autocomplete="off" aria-label="New name"><button class="btn" data-act="hrename">Rename</button></div></div>
      <h3 style="margin-top:12px">Horse armor</h3>${Object.entries(HORSES.ARMOR).filter(([id]) => id !== "none").map(([id, a]) => `<div class="item"><div class="t">${esc(a.name)}<span>+${a.hp} health · takes ${Math.round(a.guard * 100)}% less damage</span></div><span class="num gold">${a.price}</span><button class="btn sm" data-act="harmor" data-id="${id}" ${h.armor === id || !open || S.gold < a.price || wanted ? "disabled" : ""}>${h.armor === id ? "Worn" : "Buy"}</button></div>`).join("")}`;
  }
  /* [ux] Town sections in a few labelled groups, with a line on what the open one is for */
  const TOWN_GROUPS = [["Shops", ["general", "blacksmith", "wizard", "fence", "market", "stables"]], ["Services", ["inn", "train", "forge", "alchemy", "enchanter", "cook", "craft", "carriage", "hire"]],
    ["Your home", ["home", "homes"]], ["Guilds & jobs", ["jobs", "notice", "caravans", "hall", "mine", "streets"]], ["Fun", ["arena", "fish"]]];
  const TOWN_DESC = { general: "Buy food, potions and supplies; sell almost anything.", blacksmith: "Weapons, armor, arrows and metal.", wizard: "Spell tomes, staffs and soul gems.", fence: "Buys stolen goods.", market: "Things other players are selling.", stables: "Buy a horse or a cart to travel and carry more.",
    inn: "Sleep to heal and get Rested; hear rumours.", train: "Pay to raise a skill (5 times per level).", forge: "Make, smelt and improve gear.", alchemy: "Mix ingredients into potions.", enchanter: "Learn and add enchantments.", cook: "Cook meals that heal and buff.", craft: "Design your own spells.", carriage: "Safe, fast rides to other cities.", hire: "Hire a follower who fights beside you.",
    home: "Your house: a safe chest, a bed and a garden.", homes: "Visit other players' houses here.", jobs: "Small paid jobs: clear, deliver, gather.", notice: "This week's world goals and rewards.", caravans: "Guard a caravan for pay.", hall: "A hall everyone builds together.", mine: "Dig ore with a pickaxe.", streets: "Pickpocket, check your bounty, talk to guards.",
    arena: "Duel other players for a stake.", fish: "Cast a line and catch fish." };
  function townGroups(sections, names) {
    const used = new Set(), html = TOWN_GROUPS.map(([g, ids]) => { const here = ids.filter((t) => sections.includes(t)); here.forEach((t) => used.add(t)); return here.length ? [g, here] : null; }).filter(Boolean);
    const rest = sections.filter((t) => !used.has(t)); if (rest.length) html.push(["More", rest]);
    return `<div class="towngroups">${html.map(([g, ids]) => `<div class="tg"><div class="tg-h">${g}</div><div class="chips">${ids.map((t) => `<button class="chip ${t === townShop ? "on" : ""}" data-act="shop" data-id="${t}" title="${esc(TOWN_DESC[t] || "")}">${esc(names[t])}</button>`).join("")}</div></div>`).join("")}</div>
      ${TOWN_DESC[townShop] ? `<p class="tg-desc"><b>${esc(names[townShop])}:</b> ${esc(TOWN_DESC[townShop])}</p>` : ""}`;
  }
  function panelTown() {
    const l = S.location, types = l ? G.shopTypes(l) : [];
    if (!l || (!types.length && !TOWNS.isTown(l))) {
      if (l && (DUNGEONS.enterable(l) || POWERS.STONE_AT[l] || l === "High Hrothgar")) return placeHere();
      return wildsFood() + `<div class="panel"><h2>${l ? esc(l) : "The wilds"}</h2><p class="sub">${l ? "There's nothing to buy here." : "You're out on the road."} Cities and towns have shops, inns, trainers, alchemy labs, forges and jobs.</p></div>`;
    }
    const open = G.shopsOpen(), wanted = TOWNS.wanted(S), hold = G.holdAt(WORLD.places[l]);
    const sections = [...types.filter((x) => x !== "stables"), ...(TOWNS.INNS[l] ? ["inn"] : []), ...(TOWNS.TRAINERS[l] ? ["train"] : []), "alchemy", ...(types.includes("blacksmith") || HALLS.hasForge(S, l) ? ["forge"] : []), "jobs", "streets", ...(TOWNS.followersHere(S).length || l === "Whiterun" ? ["hire"] : []), ...(TOWNS.carriageFrom(l) ? ["carriage"] : []), ...(TOWNS.HOMES[l] ? ["home", "homes", "market"] : []), ...(SMITH.MINES[l] ? ["mine"] : []), ...(l === SPELLCRAFT.TOWN ? ["craft"] : []), ...(CARAVANS.stopsAt(l) ? ["caravans"] : []), ...(l === HALL.TOWN ? ["hall"] : []), ...(HALLS.plotHere(l) || hallDocs.some((d) => d.town === l) || S.hall?.town === l ? ["halls"] : []), "notice", ...(TOWNS.INNS[l] ? ["cook"] : []), ...(l === ARENA.TOWN ? ["arena"] : []), ...(COOK.waterNear(WORLD.places[l]) ? ["fish"] : []), ...(ENCH.hasEnchanter(l) ? ["enchanter"] : []), ...(types.includes("stables") ? ["stables"] : []), ...(typeof SOL !== "undefined" ? SOL.sections(l) : [])];
    townShop = sections.includes(townShop) ? townShop : sections[0];
    const names = { general: "General goods", blacksmith: "Blacksmith", wizard: "Court wizard", stables: "Stables", fence: "Ragged Flagon (fence)", inn: TOWNS.INNS[l] || "Inn", train: "Trainers", alchemy: "Alchemy lab", forge: "Forge", jobs: "Jobs", streets: "Streets", hire: l === "Whiterun" ? "Dragonsreach & hirelings" : "Hirelings", hall: "⚑ Hall of the North", halls: "🏰 Halls & shops", notice: "📜 Jarl's bounty", homes: "🏘 Neighbours", market: "🛒 Market stalls", mine: "⛏ Mine", craft: "✨ Spell crafting", caravans: "🐫 Caravans", cook: "🍲 Cooking pot", arena: "⚔ The Arena", fish: "🎣 Fishing", carriage: "Carriage", enchanter: "Arcane enchanter", home: TOWNS.home(S, l) ? `🏠 ${TOWNS.HOMES[l]?.[0]}` : `Buy ${TOWNS.HOMES[l]?.[0]}`, ...(typeof SOL !== "undefined" ? SOL.NAMES : {}) };
    const fac = F.priceFactor(G.skill(S, "Mercantile"));
    let body = "", note = "";
    const shopRow = (i, sell = true) => { const p = G.buyPrice(S, i), it = D.ITEMS[i], tome = it.slot === "tome" && typeof TOMES !== "undefined" ? ` · ${TOMES.level(it.spell)}${S.spells.includes(it.spell) ? " · you know it" : ""}` : ""; return `<div class="item">${ICONART.item(i, 34)}<div class="t">${esc(it.name)}<span>${esc(G.itemStats(i))}${tome} · ${it.weight} wt</span></div>${econB(i)}<span class="num gold">${p}</span><button class="btn sm" data-act="buy" data-item="${esc(i)}" ${open && !wanted && S.gold >= p ? "" : "disabled"}>Buy</button>${it.slot === "ammo" ? (() => { const p20 = G.lotPrice ? G.lotPrice(S, i, 20, "buy") : p * 20; return `<button class="btn sm" data-act="buyn" data-item="${esc(i)}" data-n="20" title="${p20} gold" ${open && !wanted && S.gold >= p20 ? "" : "disabled"}>×20</button>`; })() : ""}</div>`; };
    if (townShop === "stables") body = stablesHTML(open, wanted) + cartHTML(open, wanted);
    else if (["general", "blacksmith", "wizard", "fence"].includes(townShop)) {
      note = `${open ? "Shops are open." : `Shops are closed for the night. They open at 08:00 (${esc(G.clockText())}).`} At Mercantile ${G.skill(S, "Mercantile")} you buy at about ${(fac / G.haggle(S)).toFixed(2)}× value.${townShop === "fence" ? " The fence buys stolen goods." : ""}`;
      body = barterHTML(townShop, open, wanted, shopRow);
    } else if (townShop === "inn") {
      note = "Sleep to heal fully and become Rested (skills improve 5% faster for 40 minutes; your own bed gives 10%). Buy a round and the locals talk." + (FEST.freeInn() ? " 🎉 New Life Festival: rooms are free!" : "");
      body = (S.vampire ? `<div class="item"><div class="t">🩸 Feed on a sleeping traveller<span>Resets your hunger. Someone might wake up (bounty).</span></div><button class="btn sm danger" data-act="vfeed">Feed</button></div>` : "") + (FEST.freeInn() ? `<div class="item on"><div class="t">🎉 The innkeeper's New Life gift<span>Once a day: a hot meal and a little gold</span></div><button class="btn sm pri" data-act="festgift">Take it</button></div>` : "") + `<div class="item"><div class="t">Rent a room<span>${G.rested(S) ? "You're already rested" : "Full health and Rested"}</span></div><span class="num gold">${TOWNS.roomPrice(S)}</span><button class="btn sm pri" data-act="inn" data-c="room" ${wanted ? "disabled" : ""}>Sleep</button></div>
        <div class="item"><div class="t">Buy a round, listen for rumours<span>Reveals ${G.P(S, "rumour_monger") ? "two places" : "a place"} you haven't found yet</span></div><span class="num gold">${TOWNS.rumourPrice ? TOWNS.rumourPrice(S) : G.P(S, "rumour_monger") ? 0 : TOWNS.RUMOUR}</span><button class="btn sm" data-act="inn" data-c="rumour">Listen</button></div>`;
      body += bardHTML(l);
    } else if (townShop === "train") {
      const n = TOWNS.trainedThisLevel(S);
      note = `Skyrim rules: 5 sessions per level (${5 - n} left), and trainers stop at 50 (common), 75 (expert) or 90 (master).`;
      body = TOWNS.TRAINERS[l].map(([who, sk, lvl]) => { const c = TOWNS.trainCost(S, sk), cur = S.skills[sk].lvl, ok = cur < TOWNS.CAP[lvl] && n < 5 && S.gold >= c && !wanted;
        return `<div class="item">${NPCART.trainer(who, sk, 36)}<div class="t">${esc(who)}<span>${esc(sk)} ${cur} → ${cur + 1} · ${lvl} trainer (up to ${TOWNS.CAP[lvl]})</span></div><span class="num gold">${c}</span><button class="btn sm" data-act="train" data-id="${esc(who)}" ${ok ? "" : "disabled"}>Train</button></div>`; }).join("");
    } else if (townShop === "alchemy") {
      const ings = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "ingredient");
      alchSel = alchSel.filter((id) => ings.some((r) => r.id === id));
      const knownFx = (r) => TOWNS.INGREDIENT_FX[r.item][1].filter((e, i) => TOWNS.known(S, r.item)[i]);
      const selRows = alchSel.map((id) => ings.find((r) => r.id === id));
      const knownShared = selRows.length >= 2 ? [...new Set(selRows.flatMap(knownFx))].filter((e) => selRows.filter((r) => knownFx(r).includes(e)).length >= 2) : [];
      note = `Pick two or three ingredients that share an effect. You only see effects you've discovered: eat ingredients or experiment. Alchemy ${G.skill(S, "Alchemy")}.`;
      body = ings.length ? ings.map((r) => `<div class="item ${alchSel.includes(r.id) ? "on" : ""}" data-act="alch" data-id="${r.id}" role="button" tabindex="0"><div class="t">${alchSel.includes(r.id) ? "☑" : "☐"} ${esc(D.ITEMS[r.item].name)} ×${r.qty}<span>${TOWNS.INGREDIENT_FX[r.item][1].map((e, i) => TOWNS.known(S, r.item)[i] ? esc(e) : "?").join(", ")}</span></div></div>`).join("")
        + `<p class="sub" style="margin-top:8px">${selRows.length >= 2 ? (knownShared.length ? `Known shared effects: <b>${knownShared.map(esc).join(", ")}</b>` : "No shared effects you know of. Could be a discovery, or sludge.") : "Select ingredients above."}</p>
        <button class="btn pri" data-act="brew" style="width:100%" ${alchSel.length >= 2 ? "" : "disabled"}>Brew</button>`
        : '<p class="sub">You have no ingredients. Gather them on the road, in dungeons, or buy them at the general store and court wizard.</p>';
    } else if (townShop === "forge") {
      const ftabs = `<div class="chips" style="margin-bottom:8px">${[["make", "⚒ Make"], ["refine", "🔥 Smelt & tan"], ["improve", "✨ Improve"]].map(([k, l2]) => `<button class="chip ${forgeTab === k ? "on" : ""}" data-act="ftab" data-id="${k}">${l2}</button>`).join("")}</div>`;
      if (forgeTab === "make") {
        note = `Make weapons, armor and jewellery from ingots, leather and gems. Better metals need Smithing perks. Smithing ${G.skill(S, "Smithing")}.`;
        const g = forgeGroup, ids = SMITH.byGroup(g);
        body = ftabs + `<div class="chips" style="margin-bottom:6px;flex-wrap:wrap">${SMITH.GROUPS.map(([k, l2]) => `<button class="chip ${g === k ? "on" : ""}" data-act="fgroup" data-id="${k}">${l2}</button>`).join("")}</div>`
          + (SMITH.PERK_FOR[g] && !G.P(S, SMITH.PERK_FOR[g]) ? `<p class="sub">🔒 Needs the ${esc(PERKS.BY_ID[SMITH.PERK_FOR[g]].name)} perk (Hero tab → Perks → Smithing).</p>` : "")
          + (g === "found" && typeof CRAFTFAIR !== "undefined" ? CRAFTFAIR.foundNote(S, esc) : "")
          + ids.map((id) => { const i = SMITH.info(S, id), it = D.ITEMS[id];
            return `<div class="item">${ICONART.item(id, 34)}<div class="t">${esc(it.name)}${i.out > 1 ? ` ×${i.out}` : ""}<span>${esc(G.itemStats(id))}${it.slot === "valuable" ? ` · worth ${it.value}` : ""}${i.xpMult != null && i.xpMult < 0.99 ? ` · ${Math.round(i.xpMult * 100)}% XP (made recently)` : ""}${i.needs && typeof CRAFTFAIR !== "undefined" && !CRAFTFAIR.knows(S, i.needs) ? " · 🔒 recipe needed" : ""}</span><span>${i.mats.map(([m, n], k) => `<b class="${i.have[k] >= n ? "" : "miss"}">${n} ${esc(D.ITEMS[m].name)}</b> (${i.have[k]})`).join(" · ")}</span></div><button class="btn sm ${i.block ? "" : "pri"}" data-act="smake" data-id="${esc(id)}" ${i.block ? "disabled" : ""}>Make</button></div>`; }).join("");
      } else if (forgeTab === "refine") {
        note = "Smelt ore into ingots and tan pelts into leather. Ores come from mines; pelts from wolves, bears and sabre cats.";
        body = ftabs + SMITH.REFINE.map((r, k) => { const i = SMITH.refineInfo(S, k);
          return `<div class="item"><div class="t">${i.kind === "smelt" ? "🔥" : "🪶"} ${i.n} ${esc(D.ITEMS[i.out].name)}<span>from ${esc(SMITH.matText(i.mats))} · you can make ${i.times}</span></div><button class="btn sm ${i.times ? "pri" : ""}" data-act="srefine" data-id="${k}" ${i.times ? "" : "disabled"}>Once</button><button class="btn sm" data-act="srefineall" data-id="${k}" ${i.times > 1 ? "" : "disabled"}>All</button></div>`; }).join("");
      } else {
      note = `Each improvement uses one piece of the item's material (ingots, leather, firewood, moonstone or dwarven metal). Blacksmiths sell the common ones; dungeons hide the rest. Your Smithing (${G.skill(S, "Smithing")}) sets how far: every 20 points allows one more quality level.`;
      const rows = S.inv.filter((r) => TOWNS.temperInfo(S, r));
      body = ftabs + rows.map((r) => { const i = TOWNS.temperInfo(S, r);
        return `<div class="item"><div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}<span>${i.block ? esc(i.block) : `→ ${TOWNS.QUALITY[i.q + 1]} (+${i.per} ${D.ITEMS[r.item].slot === "weapon" ? "damage" : "armor"}) · uses 1 ${esc(D.ITEMS[i.ingot].name)} (you have ${i.have})`}</span></div><button class="btn sm" data-act="temper" data-id="${r.id}" ${i.block ? "disabled" : ""}>Improve</button></div>`; }).join("") || '<p class="sub">Nothing to improve.</p>';
      }
    } else if (townShop === "jobs") {
      const avail = TOWNS.jobsAt(S, l), mine = S.jobs || [];
      note = "New jobs every in-game day (2 real hours). You can hold three at once. Clearing and delivery jobs pay out by themselves when done.";
      body = `<h3>Your jobs</h3>${mine.length ? mine.map((j) => `<div class="item" style="flex-wrap:wrap">${j.type === "gather" ? ICONART.item(j.item, 30) : ""}<div class="t">${esc(j.type === "clear" ? `Clear ${j.target}` : j.type === "deliver" ? `Deliver to ${j.target}` : `Bring ${j.n} ${D.ITEMS[j.item].name}`)}<span>${j.type === "gather" ? `You have ${TOWNS.countItem(S, j.item)}/${j.n} · ` : ""}from ${esc(j.town)} · ${j.reward} gold</span></div>
          ${j.type === "gather" ? `<button class="btn sm pri" data-act="handin" data-id="${esc(j.id)}" ${TOWNS.countItem(S, j.item) >= j.n ? "" : "disabled"}>Hand in</button>` : ""}<button class="btn sm" data-act="dropjob" data-id="${esc(j.id)}">Drop</button></div>`).join("") : '<p class="sub">None yet.</p>'}
        <h3 style="margin-top:12px">Notice board</h3>${avail.length ? avail.map((j) => `<div class="item"><div class="t">${esc(j.text)}<span>${j.reward} gold</span></div><button class="btn sm pri" data-act="takejob" data-id="${esc(j.id)}" ${mine.length >= 3 || wanted ? "disabled" : ""}>Take</button></div>`).join("") : '<p class="sub">Nothing new today.</p>'}`;
    } else if (townShop === "arena") {
      note = "Friendly duels between players, with an optional bet. Both of you must be in Windhelm. Seasons last a month; ratings start at 1000.";
      body = arenaHTML();
    } else if (townShop === "cook") {
      note = `The inn's cooking pot. Cooked meals give buffs for a while; a new meal replaces the last one's.`;
      body = cookList();
    } else if (townShop === "fish") {
      note = `Water nearby: ${COOK.waterNear(WORLD.places[l])}. Cast, wait for a bite, and reel in when the needle is in the green.`;
      body = fishCard();
    } else if (townShop === "caravans") {
      note = "Caravans roll between the holds on a timetable everyone shares. Sign on as a guard while the wagons wait, travel with them, fight off the ambushes, and collect your pay on arrival.";
      body = caravansHTML(l);
    } else if (townShop === "craft") {
      note = "The College's spellwrights can bind effects from spells you know into a spell of your own. It costs a little more magicka than casting the parts on their own.";
      body = craftHTML();
    } else if (townShop === "mine") {
      note = "Dig ore with a pickaxe, then smelt it into ingots at the forge.";
      body = mineHTML(l);
    } else if (townShop === "market") {
      note = "Players sell their own things here. Buy, or run your own stall if you own a house in this town.";
      body = marketHTML(l);
    } else if (townShop === "halls") {
      note = "Build your own hall here, or a guild hall for your clan. Staff are paid every in-game day.";
      body = hallsHTML(l);
    } else if (townShop === "homes") {
      const list = VISITS.inTown(homeDocs, l, S.id);
      note = `Other players who own ${TOWNS.HOMES[l][0]} in their own world. Drop in to see their trophies, or leave a gift.`;
      body = list.length ? list.map((d) => `<div class="item"><div class="t">${esc(d.name)}<span>Level ${d.level}${d.dragons ? ` · ${d.dragons} dragon skull${d.dragons > 1 ? "s" : ""}` : ""}${d.motto ? ` · “${esc(d.motto)}”` : ""}</span></div><button class="btn sm pri" data-act="visit" data-id="${esc(d.id)}">Visit</button></div>`).join("")
        : `<p class="sub">Nobody else has a house here yet${Store.online ? "" : " (or you're playing offline)"}.</p>`;
    } else if (townShop === "notice") {
      note = "The same three goals hang in every town this week. Progress counts wherever you are.";
      body = bountyPanel().replace('<div class="panel"><h2>Bounty board</h2>', "<div>");
    } else if (townShop === "hall") {
      const pr = HALL.progress(), mats = S.inv.filter((r) => HALL.MAT_PTS[r.item]), mine = S.hallPts || 0;
      note = "One hall for everyone in the world. Every gold coin and ingot anyone gives makes it bigger, and every size gives all players something.";
      const tiers = HALL.TIERS.map(([n, need, what], i) => `<div class="item ${i === pr.tier ? "on" : ""}"><div class="t">${i <= pr.tier ? "✔" : "○"} ${esc(n)}${need ? ` · ${need.toLocaleString()}` : ""}<span>${esc(what)}</span></div></div>`).join("");
      const chestOpen = pr.tier >= 2, left = HALL.CHEST_PER_DAY - HALL.takenToday(S);
      const putRows = S.inv.filter((r) => HALL.canDeposit(r) && !Object.values(G.loadout(S).equipment || {}).includes(r.id)).slice(0, 15);
      body = `${typeof HOMEART !== "undefined" ? HOMEART.hall(pr.tier, HALL.top(6), HALL.chest.length, pr.pct) : ""}<div class="card"><h3>${esc(pr.name)}${pr.next ? ` → ${esc(pr.next)}` : " · fully built"}</h3>
          <div class="bar" style="margin:6px 0"><i style="width:${pr.pct}%;background:var(--gold)"></i></div>
          <p class="sub" style="margin:0">${pr.points.toLocaleString()}${pr.need ? ` of ${pr.need.toLocaleString()}` : ""} given by ${HALL.top(999).length} ${HALL.top(999).length === 1 ? "player" : "players"} · you gave ${mine.toLocaleString()}${mine < HALL.BUILDER_PTS ? ` (${HALL.BUILDER_PTS} earns the title Hall Builder)` : ""}</p></div>
        <div class="item"><div class="t">${pr.tier ? "Sleep in the hall" : "Rest by the fire"}<span>${pr.tier >= 3 ? "Free · full health and Well Rested (+10%)" : pr.tier ? "Free · full health and Rested (+5%)" : "Free · full health"}</span></div><button class="btn sm pri" data-act="hallrest">Rest</button></div>
        <h3 style="margin-top:12px">Give gold</h3><div class="chips">${[50, 100, 500, 1000, 5000].map((n) => `<button class="chip" data-act="hallgold" data-id="${n}" ${S.gold >= n ? "" : "disabled"}>${n}</button>`).join("")}</div>
        <h3 style="margin-top:12px">Give materials</h3>${mats.length ? mats.map((r) => `<div class="item"><div class="t">${esc(D.ITEMS[r.item].name)} ×${r.qty}<span>${HALL.MAT_PTS[r.item]} each</span></div><button class="btn sm" data-act="hallmat" data-id="${r.id}" data-n="1">Give 1</button>${r.qty > 1 ? `<button class="btn sm" data-act="hallmat" data-id="${r.id}" data-n="${r.qty}">All</button>` : ""}</div>`).join("") : `<p class="sub">Ingots, leather, firewood and the like count for more than their price. Blacksmiths sell them, mines and forts hide them.</p>`}
        <h3 style="margin-top:12px">What the hall gives everyone</h3>${tiers}
        <h3 style="margin-top:12px">Shared chest</h3>${chestOpen ? `<p class="sub" style="margin-top:0">Leave things for others. You can take ${HALL.CHEST_PER_DAY} a day (${left} left today).</p>
          ${HALL.chest.length ? HALL.chest.slice(0, 20).map((d) => `<div class="item"><div class="t">${esc(D.ITEMS[d.item].name)}<span>from ${esc(d.by || "someone")}</span></div><button class="btn sm" data-act="halltake" data-id="${esc(d.id)}" ${left > 0 ? "" : "disabled"}>Take</button></div>`).join("") : `<p class="sub">Empty for now.</p>`}
          <details style="margin-top:6px"><summary class="sub" style="cursor:pointer;min-height:36px">Put something in</summary>${putRows.length ? putRows.map((r) => `<div class="item"><div class="t">${esc(D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}</div><button class="btn sm" data-act="hallput" data-id="${r.id}">Put in</button></div>`).join("") : `<p class="sub">Nothing you can leave (equipped, stolen and improved things stay with you).</p>`}</details>`
          : `<p class="sub">Opens when the hall becomes a Mead Hall.</p>`}
        <h3 style="margin-top:12px">Trophy wall</h3>${HALL.top(10).length ? `<div class="list">${HALL.top(10).map((d, i) => `<div class="item ${d.id === S.id ? "on" : ""}"><span class="num" style="width:1.6em;color:var(--gold)">${i + 1}</span><div class="t">${esc(d.name)}${d.id === S.id ? " (you)" : ""}</div><span class="num gold">${d.pts.toLocaleString()}</span></div>`).join("")}</div>` : `<p class="sub">No names yet. Be the first.</p>`}`;
    } else if (townShop === "home") {
      const [hname, price, hdesc] = TOWNS.HOMES[l], h = TOWNS.home(S);
      if (!h) {
        note = `${hdesc} Skyrim price. Inside: a chest that keeps things safe even when you die, your own bed (Well Rested: skills +10%), and a garden.`;
        body = `<div class="item"><div class="t">${esc(hname)}<span>${l === "Whiterun" && !S.thaneWhiterun ? "Only for someone the Jarl trusts (bring Farengar the Dragonstone)" : "For sale"}</span></div><span class="num gold">${price}</span><button class="btn sm pri" data-act="buyhome" ${S.gold >= price && !wanted ? "" : "disabled"}>Buy</button></div>`;
      } else {
        note = "Your home. Things in the chest are safe even if you die on the road.";
        const pack = S.inv.filter((r) => !Object.values(G.loadout(S).equipment).includes(r.id));
        body = `${typeof HOMEART !== "undefined" ? HOMEART.mine(S, l) : ""}<div class="item"><div class="t">Your bed<span>Full health and Well Rested (+10% skills for 40 min)</span></div><button class="btn sm pri" data-act="homebed">Sleep</button></div>
          <div class="item"><div class="t">Garden<span>${TOWNS.gardenReady(S) ? "Ripe: harvest ingredients" : `Growing. Ready in ${Math.ceil(((h.garden || 0) + 7200 - G.now()) / 60)} min`}</span></div><button class="btn sm" data-act="harvest" ${TOWNS.gardenReady(S) ? "" : "disabled"}>Harvest</button></div>
          ${(() => { const gs = myGifts().filter((g) => g.town === l); return gs.length ? `<h3 style="margin-top:12px">🎁 Gifts at your door (${gs.length})</h3><div class="list">${gs.map((g) => `<div class="item on"><div class="t">From ${esc(g.fromName)}<span>${[g.gold ? `${g.gold} gold` : "", g.row && D.ITEMS[g.row.item] ? VISITS.itemName(g.row) + (g.row.qty > 1 ? ` ×${g.row.qty}` : "") : "", g.note ? `“${esc(g.note)}”` : ""].filter(Boolean).join(" · ")}</span></div><button class="btn sm pri" data-act="giftopen" data-id="${esc(g.id)}">Take in</button></div>`).join("")}</div>` : ""; })()}
          ${(() => { const st = MARKET.mine(stalls, S.id).filter((d) => d.town === l); return `<h3 style="margin-top:12px">🛒 Your stall</h3><div class="item"><div class="t">${st.length ? `${st.length} thing${st.length > 1 ? "s" : ""} for sale<span>${esc(st.map((d) => MARKET.itemName(d.row)).slice(0, 3).join(", "))}${st.length > 3 ? "…" : ""}</span>` : "Nothing for sale<span>Sell things here even while you're away</span>"}</div><button class="btn sm" data-act="shop" data-id="market">Open stall</button></div>`; })()}
          <h3 style="margin-top:12px">Over the door</h3><div class="chatrow"><input id="motto" maxlength="${VISITS.MOTTO_MAX}" placeholder="A motto visitors will see" value="${esc(S.motto || "")}" autocomplete="off" aria-label="Motto"><button class="btn" data-act="motto">Carve</button></div>
          <h3 style="margin-top:12px" id="homechest">Chest (${h.chest.length})</h3><p class="sub" style="margin-top:0">Put up to ${VISITS.SHOW_MAX} things in the display case for visitors to see.</p>${h.chest.length ? h.chest.map((r, i) => `<div class="item"><div class="t">${r.shown ? "🖼 " : ""}${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}<span>${esc(G.itemStats(r.item))}</span></div><button class="btn sm" data-act="showcase" data-id="${i}">${r.shown ? "Hide" : "Show"}</button><button class="btn sm" data-act="unstash" data-id="${i}">Take</button></div>`).join("") : '<p class="sub">Empty.</p>'}
          <h3 style="margin-top:12px">Put away from your pack</h3>${pack.length ? pack.map((r) => `<div class="item"><div class="t">${esc((r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}<span>${+(D.ITEMS[r.item].weight * r.qty).toFixed(2)} wt</span></div><button class="btn sm" data-act="stash" data-id="${r.id}">Store</button></div>`).join("") : '<p class="sub">Nothing loose in your pack (equipped gear stays on you).</p>'}`;
      }
    } else if (townShop === "enchanter") {
      const known = ENCH.known(S), gems = S.inv.filter((r) => D.ITEMS[r.item]?.slot === "soulgem");
      const breakable = S.inv.filter((r) => ENCH.isEnchanted(D.ITEMS[r.item]) && !Object.values(G.loadout(S).equipment).includes(r.id));
      const blanks = S.inv.filter((r) => { const it = D.ITEMS[r.item]; return (it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot)) && !ENCH.isEnchanted(it); });
      enchDraft.item = blanks.some((r) => r.id === enchDraft.item) ? enchDraft.item : blanks[0]?.id;
      const bit = enchDraft.item != null ? D.ITEMS[G.invRow(S, enchDraft.item).item] : null;
      const fits = bit ? known.filter((e) => ENCH.canTake(bit, e)) : [];
      enchDraft.eff = fits.includes(enchDraft.eff) ? enchDraft.eff : fits[0];
      enchDraft.gem = gems.some((r) => r.id === enchDraft.gem) ? enchDraft.gem : gems[0]?.id;
      const pv = enchDraft.item != null && enchDraft.eff && enchDraft.gem != null ? ENCH.preview(S, enchDraft.item, enchDraft.eff, enchDraft.gem) : null;
      const effName = (e) => (ENCH.WEAPON[e] || ENCH.ARMOR[e])[0];
      note = `Break an enchanted item to learn its effect (the item is destroyed), then put it on your own gear with a filled soul gem. Stronger with a bigger soul and higher Enchanting (${G.skill(S, "Enchanting")}).`;
      body = `<h3>Effects you know</h3><p class="sub">${known.length ? known.map(effName).map(esc).join(", ") : "None yet. Find or buy enchanted gear and break it down here."}</p>
        <h3 style="margin-top:10px">Break down (learn)</h3>${breakable.length ? breakable.map((r) => `<div class="item"><div class="t">${esc(D.ITEMS[r.item].name)}<span>${known.includes(ENCH.effectOf(r.item)) ? "You know this effect already" : `Teaches ${esc(effName(ENCH.effectOf(r.item)))}`}</span></div><button class="btn sm" data-act="disench" data-id="${r.id}" ${known.includes(ENCH.effectOf(r.item)) ? "disabled" : ""}>Break</button></div>`).join("") : '<p class="sub">No loose enchanted items in your pack (take equipped ones off first).</p>'}
        <h3 style="margin-top:10px">Enchant</h3>${blanks.length && known.length && gems.length ? `
          <label class="sub" for="ench_item">Item</label><select id="ench_item">${blanks.map((r) => `<option value="${r.id}" ${r.id === enchDraft.item ? "selected" : ""}>${esc(D.ITEMS[r.item].name)}</option>`).join("")}</select>
          <label class="sub" for="ench_eff">Effect</label><select id="ench_eff">${fits.length ? fits.map((e) => `<option value="${e}" ${e === enchDraft.eff ? "selected" : ""}>${esc(effName(e))}</option>`).join("") : '<option value="">Nothing you know fits this item</option>'}</select>
          <label class="sub" for="ench_gem">Soul gem</label><select id="ench_gem">${gems.map((r) => `<option value="${r.id}" ${r.id === enchDraft.gem ? "selected" : ""}>${esc(D.ITEMS[r.item].name)} ×${r.qty}</option>`).join("")}</select>
          <p class="sub" style="margin-top:6px">${pv ? `Result: ${esc(effName(enchDraft.eff))} ${pv.mag}${ENCH.WEAPON[enchDraft.eff] ? " damage per hit, " + pv.cap + " charge" : ""}` : ""}</p>
          <button class="btn pri" data-act="enchant" style="width:100%" ${pv ? "" : "disabled"}>Enchant</button>`
          : `<p class="sub">You need an unenchanted weapon or armor, a known effect, and a filled soul gem (court wizards sell them).</p>`}`;
    } else if (townShop === "docks" && typeof SOL !== "undefined") {
      ({ note, body } = SOL.docksHTML(S, esc, { wanted }));
    } else if (townShop === "carriage") {
      note = "Skyrim fares: 20 gold to a big city, 50 to a small hold capital. The carriage goes as fast as a horse, and nothing attacks you on the way.";
      body = TOWNS.carriageDests(S).map(({ n, price }) => { const mins = G.pxDist(WORLD.places[l], WORLD.places[n]) * 1.15 / TOWNS.CARRIAGE_SPEED;
        return `<div class="item"><div class="t">${esc(n)}<span>about ${fmtMin(mins)}</span></div><span class="num gold">${price}</span><button class="btn sm pri" data-act="carriage" data-id="${esc(n)}" ${S.gold >= price && !wanted ? "" : "disabled"}>Ride</button></div>`; }).join("");
    } else if (townShop === "hire") {
      note = "One follower at a time. They fight beside you, carry 100 for you and heal between fights. Badly hurt, they go down and get back up after the fight; they never die. Hirelings cost 500 gold.";
      body = (l === "Whiterun" ? `<div class="item">${NPCART.portrait(NPCART.who("Whiterun", "wizard"), 36)}<div class="t">Farengar, court wizard<span>${S.thaneWhiterun ? "Thanks you again for the Dragonstone." : "Wants the Dragonstone from Bleak Falls Barrow. The Jarl rewards whoever brings it."}</span></div>${S.thaneWhiterun ? "" : `<button class="btn sm pri" data-act="dragonstone" ${S.inv.some((r) => r.item === "dragonstone") ? "" : "disabled"}>Give it</button>`}</div>` : "")
        + TOWNS.followersHere(S).map(([id, [name, , cost, hp, dmg, desc]]) => `<div class="item">${NPCART.follower(id, 36)}<div class="t">${esc(name)}<span>${esc(desc)} · ${TOWNS.followerMax(S, id)} health · hits for ~${Math.round(dmg * (1 + 0.05 * (S.level - 1)))}</span></div><span class="num gold">${cost || "free"}</span><button class="btn sm pri" data-act="hire" data-id="${id}" ${S.follower || S.gold < cost || wanted || (id === "lydia" && !S.thaneWhiterun) ? "disabled" : ""}>${S.follower?.id === id ? "With you" : "Hire"}</button></div>`).join("");
    } else if (townShop === "streets") {
      const b = TOWNS.bounty(S, hold);
      note = `Crime has a price: Skyrim bounties are 25 gold for pickpocketing, 40 for assault and 1000 for murder, per hold. Guards stop you when you come into a town where you're wanted.`;
      body = `<div class="item"><div class="t">Pick a pocket<span>Pickpocket ${G.skill(S, "Pickpocket")} · about ${Math.round(TOWNS.pickChance(S, { gold: 25, level: 10 }) * 100)}% chance · getting caught adds 25 gold bounty</span></div><button class="btn sm danger" data-act="pickpocket">Try</button></div>
        <div class="item"><div class="t">Your bounty in ${esc(hold)}<span>${b ? `${b} gold${wanted ? " · you resisted arrest: shops won't serve you" : ""}` : "Clean. For now."}</span></div>${b ? `<button class="btn sm" data-act="guardopen">Talk to a guard</button>` : ""}</div>
        <p class="sub" style="margin-top:8px">Stolen goods only sell to a fence: the Ragged Flagon in Riften, or anywhere with the Fence perk.</p>`;
    }
    if (typeof SOL !== "undefined") body += SOL.extraHTML(S, l, townShop, esc);   // Skaal smith's technique, Raven Rock's forge
    return `<div class="panel"><h2>${esc(l)}</h2>${PLACEART.scene(l)}${typeof CIVILWAR !== "undefined" ? CIVILWAR.townLine(S, l) : ""}${wanted ? `<p class="sub danger-high">You're wanted in ${esc(hold)}. Shops, inns and trainers turn you away.</p>` : ""}
      ${townGroups(sections, names)}
      ${(townShop === "home" && TOWNS.home(S, l)) || (townShop === "hall" && typeof HOMEART !== "undefined") || townShop === "halls" ? "" : PLACEART.section(townShop === "hire" ? "hall" : townShop === "cook" ? "inn" : townShop === "home" && TOWNS.home(S, l) ? "home" : townShop)}${typeof NPCART !== "undefined" ? NPCART.talk(l, townShop, S) : ""}${note ? `<p class="sub" style="margin-top:8px">${note}</p>` : ""}<div class="list">${body}</div><p class="sub" style="margin-top:10px">You have <b class="gold">${S.gold} gold</b>.</p></div>`;
  }

  /* [ux] Journal: rarely used sections start folded; a tap on the header (or the ribbon) opens them */
  const J_FOLD_DEFAULT = { world: true, ladder: true, news: true, stats: true, log: true };
  const J_FOLDABLE = new Set(["world", "ladder", "news", "stats", "log", "cleared", "party"]);
  function jFolds() { let f = null; try { f = JSON.parse(localStorage.getItem("ux_jfold") || "null"); } catch { /* fine */ } return f || { ...J_FOLD_DEFAULT }; }
  function jFoldWrap(id, h) {
    if (!J_FOLDABLE.has(id)) return h;
    const folded = !!jFolds()[id];
    return h.replace(/(<div id="j-[^"]+" class="panel)("[^>]*>|"[^>]*>)/, `$1${folded ? " jfold" : ""}$2`).replace(/<div class="panel" id="j-log">/, `<div class="panel${folded ? " jfold" : ""}" id="j-log">`)
      .replace(/<\/h2>/, `</h2><button class="jfold-b" data-act="jfold" data-id="${id}" aria-expanded="${!folded}">${folded ? "Show ▾" : "Hide ▴"}</button>`);
  }
  function panelLog() {
    const t = G.now(), me = livePos();
    const ppl = others.filter((o) => sameMap(o) && (!o.hiding || G.pxDist(me, otherPos(o, t)) < MP.NEAR_PX)).map((o) => ({ ...o, pos: otherPos(o, t) })).map((o) => ({ ...o, d: G.pxDist(me, o.pos) })).sort((a, b) => a.d - b.d);
    const inParty = (id) => party?.members.some((m) => m.id === id);
    const shared = Store.online;
    const partyHtml = !shared ? "" : `<div class="panel"><h2>Party</h2>${party ? `<p class="sub">Led by ${esc(party.leaderName)}. The leader picks where to go; everyone standing with them follows at the slowest member's pace. Members near you fight beside you.</p>
        <div class="list">${party.members.map((m) => `<div class="item"><div class="t">${esc(m.name)}${m.id === party.leader ? " ⚑" : ""}${m.id === S.id ? " (you)" : ""}<span>${m.id === S.id ? "" : (() => { const c = cardOf(m.id); return c ? `${esc(G.holdAt(otherPos(c)))} · ${G.pxDist(otherPos(c), me) <= MP.NEAR_PX ? "with you" : "away"}` : "offline"; })()}</span></div></div>`).join("")}</div>
        <button class="btn" data-act="leaveparty" style="width:100%;margin-top:8px">${party.leader === S.id ? "Disband the party" : "Leave the party"}</button>` : '<p class="sub">You travel alone. Invite someone from the list below.</p>'}
      ${invites.map((p) => `<div class="item on" style="margin-top:8px"><div class="t">${esc(p.leaderName)} invites you to their party</div><button class="btn sm pri" data-act="accept" data-id="${esc(p.id)}">Join</button><button class="btn sm" data-act="decline" data-id="${esc(p.id)}">No</button></div>`).join("")}
      ${chests.map((c) => { const sh = MP.shareOf(c, S.id); return `<div class="item on" style="margin-top:8px;flex-wrap:wrap"><div class="t">💰 Party chest from ${esc(c.place)}<span>${c.goldLeft} gold${c.itemsLeft.length ? ", " + c.itemsLeft.map((i) => esc(D.ITEMS[i].name)).join(", ") : ""} · your fair share: ${sh.gold} gold${sh.items.length ? " + " + sh.items.length + " item" + (sh.items.length > 1 ? "s" : "") : ""}</span></div>
        <div style="display:flex;gap:6px;width:100%;flex-wrap:wrap">${c.taken.includes(S.id) ? '<span class="sub">You took your share.</span>' : `<button class="btn sm pri" data-act="share" data-id="${esc(c.id)}">Take my share</button>`}<button class="btn sm danger" data-act="grab" data-id="${esc(c.id)}">Take everything</button></div></div>`; }).join("")}</div>`;
    const canAmbush = shared && !S.trip && !S.location && !S.dungeon;
    const travellers = `<div class="panel"><h2>Travellers</h2>${shared
      ? (ppl.length ? `<div class="list">${ppl.map((o) => { const near = !MP.canTarget(S, o, me, o.pos);
          return `<div class="item" style="flex-wrap:wrap">${HEROART.portrait(o, 38)}<div class="t">${esc(o.name)}${inParty(o.id) ? " ⚑" : ""}<span>Level ${o.level} ${esc(D.RACES[o.race]?.name || "")} · ${esc(o.loc || G.holdAt(o.pos))}${o.moving ? " · travelling" : ""}${o.dungeon ? " · in a dungeon" : ""}${o.bounty ? ` · wanted (${o.bounty})` : ""}</span></div>
          <span class="num sub">${near ? "here" : o.d < 60 ? "nearby" : "~" + fmtMin(o.d * 1.1 / G.speed(S)) + " away"}</span>
          <div style="display:flex;gap:6px;width:100%;flex-wrap:wrap">${SOCIAL.isFriend(S, o.id) ? "" : `<button class="btn sm" data-act="fadd" data-id="${esc(o.id)}">＋ Friend</button>`}${inParty(o.id) ? "" : `<button class="btn sm" data-act="invite" data-id="${esc(o.id)}">Invite</button>`}
          ${near ? `<button class="btn sm" data-act="trade" data-id="${esc(o.id)}">Trade</button>` : ""}${near && !inParty(o.id) ? `<button class="btn sm" data-act="pick" data-id="${esc(o.id)}">Pickpocket</button><button class="btn sm danger" data-act="attack" data-id="${esc(o.id)}">Attack</button>` : ""}</div></div>`; }).join("")}</div>
          <p class="sub" style="margin-top:8px">To rob or attack someone you must be in the same place. Fights use their gear and stats. Killing someone in a town is always seen; out in the wilds, sometimes.</p>`
        : `<p class="sub">No one else ${Store.mode === "p2p" ? "online right now. Send friends the app and they" : "yet. Share this page and friends"} appear here and on the map.</p>`)
      : APP ? `<p class="sub">This is the offline game: just you. Other players live in the online world.</p>${onlineBtn()}` : '<p class="sub">Shared saving isn\'t available in this view, so you\'re playing alone in this browser.</p>'}
      ${shared ? `<div class="item" style="margin-top:8px"><div class="t">🏹 Lie in ambush<span>${S.ambush ? "Hidden by the road. The next traveller to pass close by gets a sneak attack." : canAmbush ? "Hide here off the road (you must be standing in the wilds). You're hidden from the map." : "Stop somewhere in the wilds first."}</span></div><button class="btn sm ${S.ambush ? "danger" : ""}" data-act="ambush" ${canAmbush || S.ambush ? "" : "disabled"}>${S.ambush ? "Stop" : "Hide"}</button></div>` : ""}</div>`;
    const bnt = Object.entries(S.bounty || {}).filter(([, v]) => v > 0);
    const bounty = bnt.length ? `<div class="panel"><h2>Bounties</h2><div class="list">${bnt.map(([h, v]) => `<div class="item"><div class="t">${esc(h)}<span>${v} gold${(S.resisted || {})[h] ? " · resisted arrest" : ""}</span></div></div>`).join("")}</div><p class="sub" style="margin-top:6px">Pay it to a guard in that hold's towns, or to a bounty hunter on the road.</p></div>` : "";
    const word = shared ? `<div class="panel"><h2>Word on the road</h2>${news.length ? `<div class="log">${news.slice(0, 20).map((n) => `<div><time>${new Date(n.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(n.text)}</div>`).join("")}</div>` : '<p class="sub">Quiet, for now.</p>'}</div>` : "";
    const worldHtml = Store.mode === "p2p" ? `<div class="panel"><h2>The world</h2>
      <p class="sub">One world for everyone with the app, shared straight between phones. Only people online right now appear here. To bring a friend in, send them the app: github.com/R3MC10/Skyrim-Roads/releases</p>
      <div class="item"><div class="t">${Store.peers ? `${Store.peers} other ${Store.peers === 1 ? "player" : "players"} online` : "Looking for other players…"}<span>${Store.peers ? `${Store.direct} linked straight to you${Store.peers > Store.direct ? `, ${Store.peers - Store.direct} reached through other players` : ""}` : "It can take up to a minute to find each other"}</span></div></div></div>` : "";
    const incoming = trades.filter((d) => d.to === S.id && d.status === "open" && SOCIAL.arrived(d)), outgoing = trades.filter((d) => d.from === S.id && d.status === "open");
    const tradeHtml = incoming.length || outgoing.length ? `<div class="panel"><h2>Trades</h2><div class="list">
      ${incoming.map((d) => `<div class="item on" style="flex-wrap:wrap"><div class="t">${esc(d.fromName)} offers ${esc(MP.describe(d))}${(d.items || []).length ? `<span class="icorow">${d.items.slice(0, 4).map((x) => ICONART.item(x.item, 26, x)).join("")}</span>` : ""}<span>${d.ask ? `for ${d.ask} gold (you have ${S.gold})` : "as a gift"}</span></div><div style="display:flex;gap:6px;width:100%"><button class="btn sm pri" data-act="tradeyes" data-id="${esc(d.id)}" ${S.gold >= d.ask ? "" : "disabled"}>Accept</button><button class="btn sm" data-act="tradeno" data-id="${esc(d.id)}">Decline</button></div></div>`).join("")}
      ${outgoing.map((d) => `<div class="item"><div class="t">To ${esc(d.toName)}: ${esc(MP.describe(d))}<span>${d.ask ? `asking ${d.ask} gold` : "gift"} · waiting</span></div><button class="btn sm" data-act="tradecancel" data-id="${esc(d.id)}">Withdraw</button></div>`).join("")}</div></div>` : "";
    const cats = [["level", "Level"], ["gold", "Gold"], ["dragons", "Dragons"], ["cleared", "Dungeons"], ["kills", "Kills"], ["arenaRating", "Arena"]];
    const board = [...ladderDocs.filter((d) => d.id !== S.id), { ...MP.ladder(S), id: S.id }].sort((a, b) => (b[ladderCat] || 0) - (a[ladderCat] || 0) || b.level - a.level);
    const myRank = board.findIndex((d) => d.id === S.id) + 1;
    const ladderHtml = shared ? `<div class="panel"><h2>Leaderboard</h2><div class="chips">${cats.map(([k, l]) => `<button class="chip ${k === ladderCat ? "on" : ""}" data-act="ladder" data-id="${k}">${l}</button>`).join("")}</div>
      <div class="list">${board.slice(0, 10).map((d, i) => `<div class="item ${d.id === S.id ? "on" : ""}"><span class="num" style="width:1.6em;color:var(--gold)">${i + 1}</span><div class="t">${esc(d.name)}${d.id === S.id ? " (you)" : ""}<span>Level ${d.level} ${esc(D.RACES[d.race]?.name || "")}</span></div><b class="num">${d[ladderCat] || 0}</b></div>`).join("")}</div>
      ${myRank > 10 ? `<p class="sub" style="margin-top:6px">You're number ${myRank}.</p>` : ""}</div>` : "";
    // a quick-jump menu: the Journal has grown long
    const parts = [["guide", "📖 Guide", guideCard()], ["event", "Event", festPanel()], ["quests", "Quests", questPanel()], ["bounty", "Bounty", bountyPanel()], ["chat", "Chat", chatPanel()], ["holds", "Holds", holdsPanel()], ["clan", "Clan", clanPanel()],
      ["world", "World", worldHtml], ["trades", "Trades", tradeHtml], ["coop", "Co-op", coopUI ? coopUI.invitesHTML() : ""], ["party", "Party", partyHtml], ["people", "Travellers", travellers], ["ladder", "Leaderboard", ladderHtml], ["crimes", "Bounties", bounty], ["cleared", "Cleared", clearedPanel()], ["finds", "Discoveries", typeof EXPLORE !== "undefined" ? EXPLORE.panel(S) : ""], ["caravan", "Caravan", caravanJobPanel()], ["news", "News", word], ["stats", "Stats", typeof IMM !== "undefined" ? IMM.stats(S) : ""]]
      .filter(([, , h]) => h && h.trim()).map(([id, label, h]) => [id, label, jFoldWrap(id, h.replace(/<div class="panel"/, `<div id="j-${id}" class="panel"`))]);
    const badge = { quests: QUESTS.active(S).length, chat: chatUnread(), trades: incoming.length, party: invites.length + chests.length };
    const nav = `<nav class="jnav" aria-label="Journal sections">${[...parts.map(([id, label]) => [id, label]), ["log", "Diary"]].map(([id, label]) => `<button class="chip ${jFolds()[id] ? "folded" : ""}" data-act="jgo" data-id="${id}">${label}${badge[id] ? ` <b class="jbadge">${badge[id]}</b>` : ""}</button>`).join("")}</nav>`;
    return `${nav}${parts.map(([, , h]) => h).join("")}
      ${jFoldWrap("log", `<div class="panel" id="j-log"><h2>Diary</h2>`)}<div class="log">${S.journal.map((j) => `<div><time>${new Date(j.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(j.text)}</div>`).join("")}</div></div>`;
  }

  // ------------------------------------------------------------ panel events
  // ---- spell crafting at the College
  let craftDraft = { a: "", am: 0, b: "", bm: 0, name: "" };
  const craftChoices = () => [craftDraft.a && { key: craftDraft.a, amount: craftDraft.am }, craftDraft.b && { key: craftDraft.b, amount: craftDraft.bm }].filter(Boolean);
  function craftPreview() {
    const d = SPELLCRAFT.design(S, craftChoices());
    if (d.err) return `<p class="sub">${esc(d.err)}</p>`;
    const cost = SPELLCRAFT.castCost(S, d), fee = SPELLCRAFT.fee(d);
    return `<div class="item"><div class="t">${esc(craftDraft.name.trim() || SPELLCRAFT.autoName(d))}<span>${esc(d.school)} · ${esc(d.level)} · ${cost} magicka to cast</span><span>${d.parts.map((p) => esc(p.label + (p.amount ? " " + Math.round(p.amount) : ""))).join(" + ")}</span></div><span class="num gold">${fee}</span></div>
      <button class="btn pri" data-act="craftgo" style="width:100%" ${S.gold >= fee && (S.customSpells || []).length < SPELLCRAFT.MAX ? "" : "disabled"}>Craft for ${fee} gold</button>`;
  }
  function craftHTML() {
    const comps = SPELLCRAFT.components(S), mine = S.customSpells || [];
    if (!comps.length) return `<p class="sub">You don't know any spells whose effects can be crafted with. Learn some first (court wizards and the College sell tomes).</p>`;
    const pick = (id, cur) => `<select id="${id}" aria-label="Effect"><option value="">${id === "cfA" ? "Choose an effect" : "(no second effect)"}</option>${comps.map((c) => `<option value="${esc(c.key)}" ${c.key === cur ? "selected" : ""}>${esc(c.name)} · ${esc(c.school)}</option>`).join("")}</select>`;
    const slider = (id, key, val) => { const c = comps.find((x) => x.key === key); return c && c.scales ? `<label class="sub" style="display:block;margin:4px 0 8px">Strength <b id="${id}v">${Math.round(val || c.max)}</b> of ${c.max}<input type="range" id="${id}" min="${c.min}" max="${c.max}" step="1" value="${Math.round(val || c.max)}" style="width:100%"></label>` : ""; };
    return `<h3>Make a spell</h3>
      ${pick("cfA", craftDraft.a)}${slider("cfAm", craftDraft.a, craftDraft.am)}
      ${pick("cfB", craftDraft.b)}${slider("cfBm", craftDraft.b, craftDraft.bm)}
      <input id="cfName" maxlength="28" placeholder="Name it (optional)" value="${esc(craftDraft.name)}" autocomplete="off" aria-label="Spell name" style="margin:6px 0">
      <div id="cfPrev">${craftPreview()}</div>
      <h3 style="margin-top:12px">Your crafted spells · ${mine.length}/${SPELLCRAFT.MAX}</h3>
      ${mine.length ? mine.map((c) => `<div class="item">${UIART.spell(c.id, 34)}<div class="t">${esc(c.name)}<span>${esc(c.school)} · ${esc(c.level)} · ${G.spellCost(S, D.SPELLS[c.id])} magicka · ${c.parts.map((p) => esc(p.label)).join(" + ")}</span></div><button class="btn sm" data-act="craftdel" data-id="${esc(c.id)}">Forget</button></div>`).join("") : `<p class="sub">None yet.</p>`}`;
  }
  function onPanelInput(e) {
    if (["cfAm", "cfBm", "cfName"].includes(e.target.id)) {
      if (e.target.id === "cfName") craftDraft.name = e.target.value; else { craftDraft[e.target.id === "cfAm" ? "am" : "bm"] = +e.target.value; const v = $("#" + e.target.id + "v"); if (v) v.textContent = e.target.value; }
      const pv = $("#cfPrev"); if (pv) pv.innerHTML = craftPreview(); return;
    }
    if (e.target.id === "cfA" || e.target.id === "cfB") { if (e.target.id === "cfA") { craftDraft.a = e.target.value; craftDraft.am = 0; } else { craftDraft.b = e.target.value; craftDraft.bm = 0; } renderPanel(true); return; } if (e.target.id === "chatin") { chatDraft = e.target.value; return; } if (e.target.id === "dmin") { dmDraft = e.target.value; return; } if (e.target.id === "versein") { verseDraft = e.target.value; return; }
    if (e.target.id === "socsearch") { socSearch = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const q = $("#socsearch"); q.focus(); q.setSelectionRange(pos, pos); return; } if (e.target.id === "packsearch") { packSearch = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const q = $("#packsearch"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } return; } if (e.target.id === "search") { searchText = e.target.value; const pos = e.target.selectionStart; renderPanel(true); const s = $("#search"); s.focus(); s.setSelectionRange(pos, pos); } }
  function onPanelChange(e) {
    const id = e.target.id;
    if (id === "tc") { tacticsDraft.if = e.target.value; renderPanel(true); }
    if (id === "tp") tacticsDraft.pct = +e.target.value;
    if (id === "ta") tacticsDraft.do = e.target.value;
    if (id === "ench_item") { enchDraft.item = +e.target.value; renderPanel(true); }
    if (id === "ench_eff") { enchDraft.eff = e.target.value; renderPanel(true); }
    if (id === "ench_gem") { enchDraft.gem = +e.target.value; renderPanel(true); }
  }
  function onPanelClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const a = b.dataset.act, L = G.loadout(S);
    if (a.startsWith("coop") && coopUI) return void coopUI.act(b);
    const say = (m) => { toast(m); persist(); renderPanel(true); if ($("#sky")) renderMenu(); };
    switch (a) {
      case "go": travelTo(b.dataset.place); renderPanel(true); break;
      case "uxall": uxAllPlaces = !uxAllPlaces; renderPanel(true); break;
      case "uxtab": tab = b.dataset.id; renderTabs(); renderPanel(true); scrollTo(0, 0); break;
      case "uxhelp": uxHelpOpen = uxHelpOpen === b.dataset.id ? null : b.dataset.id; renderPanel(true); if ($("#sky")) renderMenu(); break;
      case "jfold": { const f = jFolds(); f[b.dataset.id] = !f[b.dataset.id]; try { localStorage.setItem("ux_jfold", JSON.stringify(f)); } catch { /* fine */ } renderPanel(true); break; }
      case "unpick": selected = null; roamSpot = null; renderPicked(); break;
      case "xsearch": case "xdig": case "xread": exploreAct(b.dataset.act, b.dataset.id); break;
      case "spotpin": if (roamSpot) { const [x, y] = roamSpot; selected = null; renderPicked(); openPinDialog(x, y); } break;
      case "stop": if (S.trip?.carriage) { toast("The driver won't stop until you get there."); break; } if (S.trip?.boat) { toast("You're at sea. The Northern Maiden won't turn back now."); break; } if (S.trip?.status === "travel" || S.trip?.status === "event") { [S.x, S.y] = livePos(); S.trip = null; S.location = Object.keys(WORLD.places).find((n) => G.pxDist([S.x, S.y], WORLD.places[n]) < 12) || null; persist(true); toast("You stop and look around."); } break;
      case "openenc": openEncounter(); break;
      case "openev": openEvent(); break;
      case "online": openOnline(); break;
      case "raidfight": raidFight(); break;
      case "ladder": ladderCat = b.dataset.id; renderPanel(true); break;
      case "qtalk": questTalk(b.dataset.id); break;
      case "gtake": { const r = GUILDS.offer(S, b.dataset.id); if (r.err) return toast(r.err); persist(true); renderPanel(true); showMessage(b.dataset.id === "thieves" ? "A job from the Guild" : "A contract", r.text); break; }
      case "gdrop": toast(GUILDS.drop(S, b.dataset.id)); persist(true); renderPanel(true); break;
      case "gdo": guildWork(b.dataset.id); break;
      case "qjoin": { const m = QUESTS.join(S, b.dataset.id); persist(true); renderPanel(true); showMessage("A new path", m); break; }
      case "trade": { const c = cardOf(b.dataset.id); if (c) { tradeSel = []; openTrade(c); } break; }
      case "tradepick": { const id = +b.dataset.id; tradeSel = tradeSel.includes(id) ? tradeSel.filter((x) => x !== id) : [...tradeSel, id]; const c = cardOf(tradeTo); if (c) openTrade(c); break; }
      case "tradesend": {
        const c = cardOf(tradeTo) || (SOCIAL.isFriend(S, tradeTo) ? { id: tradeTo, name: SOCIAL.friends(S)[tradeTo].name } : null); if (!c) { closeModal(); return toast("They're gone."); }
        const err = c.x == null ? "far away" : MP.canTarget(S, c, livePos(), otherPos(c));
        const courier = err && !party?.members.some((m) => m.id === c.id);
        if (courier && !SOCIAL.isFriend(S, c.id)) return openTrade(c, err);
        const r = courier ? SOCIAL.courierOffer(S, c, tradeSel, $("#tgive")?.value, $("#task")?.value) : MP.makeOffer(S, c, tradeSel, $("#tgive")?.value, $("#task")?.value);
        if (!r.doc) return openTrade(c, r.text);
        Store.put("trades", r.id, r.doc); tradeSel = []; persist(true); closeModal(); renderPanel(true); toast(r.text); break;
      }
      case "tradeyes": answerTrade(b.dataset.id, true); break;
      case "tradeno": answerTrade(b.dataset.id, false); break;
      case "tradecancel": cancelTrade(b.dataset.id); break;
      case "castout": {
        const from = [S.x, S.y], sid = b.dataset.id, use = D.SPELLS[sid]?.use;
        const m = MAGIC.castOut(S, sid); persist(true); SOUND.fx("page"); say(m); renderMenu?.();
        if (typeof FXART !== "undefined" && typeof m === "string" && !/fizzles|need|can't|isn't|nothing|Not now|first/i.test(m.split(":")[0] + (m.includes(":") ? "" : m))) {
          if (use === "clairvoyance" && questPos()) FXART.cast("clairvoyance", { to: questPos().slice(0, 2) });
          else if (use === "recall" && /^Recall:/.test(m)) FXART.cast("recall", { from, to: [S.x, S.y] });
          else if (use === "transmute" && /^Transmute:/.test(m)) FXART.cast("transmute");
        }
        break;
      }
      case "skytab": sky.page = b.dataset.id; sky.cat = "all"; sky.sel = null; sky.sort = sky.page === "skills" ? "lvl" : "name"; sky.dir = 1; renderMenu(); break;
      case "skycat": sky.cat = b.dataset.id; sky.sel = null; renderMenu(); break;
      case "skysort": { const k = b.dataset.id; sky.dir = sky.sort === k ? -sky.dir : 1; sky.sort = k; renderMenu(); break; }
      case "skysel": { const id = isNaN(+b.dataset.id) ? b.dataset.id : +b.dataset.id; sky.sel = sky.sel === id ? null : id; renderMenu(); break; }
      case "skyclose": closeMenu(); break;
      case "skyperks": closeMenu(); perkSkill = b.dataset.id; tab = "hero"; bump(); renderTabs(); renderPanel(true); setTimeout(() => $("#side").scrollIntoView({ block: "start" }), 50); break;
      case "skytac": { const L = G.loadout(S); if (!inTactics(b.dataset.id)) { let k = 0; while (k < L.rules.length && /_below$/.test(L.rules[k].if) && /^potion|^spell:(healing|fast_healing)/.test(L.rules[k].do)) k++; L.rules.splice(k, 0, { if: "always", do: b.dataset.id }); } say("Added to your tactics, right after your healing rules: you'll use it whenever it's ready."); break; }
      case "skytacx": { const L = G.loadout(S); L.rules = L.rules.filter((r) => r.do !== b.dataset.id); say("Removed from your tactics."); break; }
      case "disench": say(ENCH.disenchant(S, +b.dataset.id)); break;
      case "enchant": { const m = ENCH.enchant(S, enchDraft.item, enchDraft.eff, enchDraft.gem); persist(true); renderPanel(true); showMessage("Arcane enchanter", m); publishCard(); break; }
      case "stone": say(POWERS.takeStone(S, b.dataset.id)); publishCard(); break;
      case "sail": { const err = SOL.sail(S); if (err) return toast(err); if (typeof IMM !== "undefined") IMM.loading(`${S.trip.ship[0].toUpperCase() + S.trip.ship.slice(1)} casts off for ${S.trip.destName}…`); SOUND.fx("coin"); persist(true); toast(`⛵ You set sail for ${S.trip.destName}. About ${fmtMin(S.trip.total)} at sea.`); tab = "map"; renderTabs(); renderPanel(true); break; }
      case "solact": { const m = SOL.act(S, b.dataset.id); persist(true); toast(m); renderPanel(true); break; }
      case "carriage": { const err = TOWNS.rideCarriage(S, b.dataset.id); if (err) return toast(err); if (typeof IMM !== "undefined") IMM.loading(`The carriage rolls toward ${b.dataset.id}…`); S.trip.total = G.minutesLeft(S); persist(true); toast(`The driver cracks the reins. ${fmtMin(S.trip.total)} to ${b.dataset.id}.`); tab = "map"; renderTabs(); renderPanel(true); $("#mapwrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); follow = true; break; }
      case "hire": say(TOWNS.hire(S, b.dataset.id)); publishCard(); break;
      case "buyhome": { const m = TOWNS.buyHome(S); persist(true); renderPanel(true); showMessage("A home of your own", m); break; }
      case "homebed": say(TOWNS.sleepHome(S)); break;
      case "homejump": { const el = $("#homechest"); if (el) { const y = el.getBoundingClientRect().top + scrollY - 70; scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }); } break; }
      case "harvest": say(TOWNS.harvest(S)); break;
      case "stash": say(TOWNS.stash(S, +b.dataset.id)); publishCard(); break;
      case "unstash": say(TOWNS.unstash(S, +b.dataset.id)); publishCard(); publishHome(); break;
      case "dismiss": say(TOWNS.dismiss(S)); publishCard(); break;
      case "dragonstone": { const m = TOWNS.deliverDragonstone(S); persist(true); renderPanel(true); showMessage("Dragonsreach", m); break; }
      case "greybeards": { const m = POWERS.greybeards(S); persist(true); renderPanel(true); showMessage("High Hrothgar", m); break; }
      case "unlock": say(POWERS.unlock(S, b.dataset.id)); break;
      case "roadshout": { SOUND.fx("shout"); const from = livePos(); const m = POWERS.roadShout(S, b.dataset.id); liveCache.key = ""; persist(true); toast(m); renderPanel(true);
        if (typeof FXART !== "undefined" && /^WULD/.test(m || "")) FXART.cast("whirlwind", { from }); break; }
      case "enter": { const err = DUNGEONS.enter(S); if (err) return toast(err); if (typeof IMM !== "undefined") IMM.loading(`Entering ${S.dungeon?.place || "the dungeon"}…`); selected = null; renderPicked(); dunNote = null; persist(true); renderDungeon(); break; }
      case "dun": renderDungeon(); break;
      case "droom": dungeonRoom(b.dataset.c); break;
      case "dact": if (b.dataset.c.startsWith("game:") && typeof EXPLORE !== "undefined") { EXPLORE.openGame(S, dungeonAct); break; } if (b.dataset.c === "pick" && typeof IMM !== "undefined" && IMM.wantsGame()) { IMM.pick("dungeon", dungeonAct, S); break; } dungeonAct(b.dataset.c); break;
      case "dmin": closeDungeon(); tab = "pack"; renderTabs(); renderPanel(true); break;
      case "dleave": { if (S.dungeon?.run && coopUI) coopUI.left(); if (typeof IMM !== "undefined") IMM.loading("Back to the open road…"); const m = DUNGEONS.leave(S); dunNote = null; persist(true); closeDungeon(); renderPanel(true); showMessage("Back outside", m); break; }
      case "ev": if (b.dataset.c === "pick" && typeof IMM !== "undefined" && IMM.wantsGame()) { IMM.pick("event", eventAction, S); break; } eventAction(b.dataset.c); break;
      case "evbuy": { const m = G.buyFrom(S, b.dataset.item); persist(); openEvent(m); break; }
      case "enc": encounterAction(b.dataset.a); break;
      case "close": closeModal(); break;
      case "chatsend": chatSend($("#chatin")?.value); break;
      case "chatq": chatSend(b.dataset.id); break;
      case "chatch": chatCh = b.dataset.id; renderPanel(true); break;
      case "chatmute": { const m = chatMuted(), id = b.dataset.id; if (m.includes(id)) return; setPref("muted", [...m, id]); toast(`Muted ${b.dataset.name}. Their messages are hidden.`); onChat(chatRaw); renderPanel(true); break; }
      case "chatunmute": setPref("muted", []); toast("Everyone is unmuted."); onChat(chatRaw); renderPanel(true); break;
      case "pref": settingsAction("pref", b); openSound(); break;
      case "bk": bkClick(b); break;
      case "totitle": Store.save(S); try { sessionStorage.setItem("rotn_open", "menu"); } catch { /* ignore */ } location.reload(); break;
      case "toupdate": Store.save(S); try { sessionStorage.setItem("rotn_open", "update"); } catch { /* ignore */ } location.reload(); break;
      case "lvl": say(G.levelUp(S, b.dataset.a)); publishCard(); break;
      case "wipe": Store.wipe().then(() => { S = null; tabsEl.classList.add("hide"); location.reload(); }); break;
      case "packrow": if (!e.target.closest("button")) { packOpen = packOpen === +b.dataset.id ? null : +b.dataset.id; renderPanel(true); } break;
      case "eq": say(G.equip(S, +b.dataset.id)); break;
      case "dollslot": SOUND.fx("click"); openModal(DOLL.picker(S, b.dataset.slot), "dsheet"); break;
      case "dolleq": { const m = G.equip(S, +b.dataset.id); SOUND.fx(/^Equipped/.test(m) ? "equip" in (SOUND.FX || {}) ? "equip" : "clang" : "click"); if (/^Equipped/.test(m)) { closeModal(); publishCard(); } say(m); break; }
      case "dolloff": G.unequip(S, b.dataset.slot); closeModal(); publishCard(); say("Taken off."); break;
      case "uneq": G.unequip(S, b.dataset.slot); say("Taken off."); break;
      case "read": say(G.readTome(S, +b.dataset.id)); break;
      case "cfread": say(CRAFTFAIR.read(S, +b.dataset.id)); persist(true); renderPanel(true); break;
      case "cfname": { const inp = document.getElementById("cfname-" + b.dataset.id); say(CRAFTFAIR.rename(S, +b.dataset.id, inp ? inp.value : "")); persist(true); renderPanel(true); break; }
      case "drink": say(G.drinkPotion(S)); break;
      case "recharge": say(G.recharge(S, +b.dataset.id, +b.dataset.gem)); break;
      case "sell": { packOpen = null; const m = G.sell(S, +b.dataset.id, 1); if (/^Sold/.test(m)) GUIDE.mark(S, "trade"); say(m); break; }
      case "sellall": { const r = G.invRow(S, +b.dataset.id); if (r) { const m = G.sell(S, r.id, r.qty); if (/^Sold/.test(m)) GUIDE.mark(S, "trade"); say(m); } break; }
      case "smode": shopMode = b.dataset.id; renderPanel(true); break;
      case "buy": { const m = G.buy(S, b.dataset.item, 1); if (/^Bought/.test(m)) GUIDE.mark(S, "trade"); say(m); break; }
      case "buyn": { const m = G.buy(S, b.dataset.item, +b.dataset.n || 1); if (/^Bought/.test(m)) GUIDE.mark(S, "trade"); say(m); break; }
      case "shop": townShop = b.dataset.id; if (townShop === "halls") hallView = null; renderPanel(true); break;
      case "pskill": perkSkill = b.dataset.id; renderPanel(true); break;
      case "skinfo": heroSkill = heroSkill === b.dataset.id ? null : b.dataset.id; renderPanel(true); if (heroSkill) setTimeout(() => $(".skcard")?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }), 30); break;
      case "perk": say(PERKS.take(S, b.dataset.id)); publishCard(); break;
      case "legend": if (legendArm !== b.dataset.id) { legendArm = b.dataset.id; renderPanel(true); if ($("#sky")) renderMenu(); break; } legendArm = null; say(LEGEND.make(S, b.dataset.id)); publishCard(); break;
      case "legendno": legendArm = null; renderPanel(true); if ($("#sky")) renderMenu(); break;
      case "drinkrow": packOpen = null; say(TOWNS.drink(S, +b.dataset.id)); publishCard(); break;
      case "poison": packOpen = null; say(TOWNS.applyPoison(S, +b.dataset.id)); break;
      case "eat": packOpen = null; say(TOWNS.eat(S, +b.dataset.id)); break;
      case "hallrest": say(HALL.rest(S)); break;
      case "visit": openVisit(b.dataset.id); break;
      case "hplot": { const r = HALLS.buyPlot(S, $("#hname")?.value); if (r.err) return toast(r.err); hallTab = "rooms"; SOUND.fx("coin"); persist(true); toast(r.text); renderPanel(true); break; }
      case "hclanplot": clanPlot(); break;
      case "htab": hallTab = b.dataset.id; renderPanel(true); break;
      case "hvisit": hallView = b.dataset.id; renderPanel(true); break;
      case "hback": hallView = null; renderPanel(true); break;
      case "hbuild": hallDo(!!b.dataset.c, (h, purse) => HALLS.build(h, b.dataset.id, purse, S.name)); SOUND.fx("clang"); break;
      case "hdecor": hallDo(!!b.dataset.c, (h, purse) => HALLS.addDecor(h, b.dataset.id, purse, S.name)); break;
      case "hundecor": hallDo(!!b.dataset.c, (h) => HALLS.removeDecor(h, b.dataset.id)); break;
      case "hhire": hallDo(!!b.dataset.c, (h, purse) => HALLS.hire(h, b.dataset.id, purse, G.now(), S.name)); break;
      case "hfire": hallDo(!!b.dataset.c, (h) => HALLS.dismiss(h, b.dataset.id)); break;
      case "hdep": hallDo(!!b.dataset.c, (h) => HALLS.deposit(S, h, +b.dataset.id)); SOUND.fx("coin"); break;
      case "hwd": hallDo(false, (h) => HALLS.withdraw(S, h, +b.dataset.id)); SOUND.fx("coin"); break;
      case "hrest": hallDo(!!b.dataset.c, (h) => HALLS.rest(S, h)); break;
      case "hpray": hallDo(!!b.dataset.c, (h) => HALLS.pray(S, h)); break;
      case "hstash": hallDo(!!b.dataset.c, (h) => HALLS.stash(S, h, +b.dataset.id)); break;
      case "hunstash": hallDo(!!b.dataset.c, (h) => HALLS.unstash(S, h, +b.dataset.id)); break;
      case "hmount": hallDo(!!b.dataset.c, (h) => { const r = HALLS.stash(S, h, +b.dataset.id, true); if (!b.dataset.c) HALLS.refreshTrophies(S); return r; }); break;
      case "hunmount": hallDo(!!b.dataset.c, (h) => { const r = HALLS.unstash(S, h, +b.dataset.id, true); if (!b.dataset.c) HALLS.refreshTrophies(S); return r; }); break;
      case "mpick": stallPick = b.dataset.id ? +b.dataset.id : null; renderPanel(true); break;
      case "mlist": { const r = MARKET.list(S, stallPick, $("#mprice")?.value, stalls); if (r.err) return toast(r.err); Store.put("stalls", r.id, r.doc); stalls.push({ ...r.doc, id: r.id }); stallPick = null; persist(true); say(r.text); break; }
      case "mbuy": marketBuy(b.dataset.id); break;
      case "mpull": Store.change("stalls", b.dataset.id, (d) => (d.status === "open" && d.seller === S.id ? { ...d, status: "withdrawn" } : d)); break;
      case "wolfyes": SOUND.fx("dragon"); say(CURSE.acceptWolf(S)); publishCard(); break;
      case "wolfno": say(CURSE.declineWolf(S)); break;
      case "curewolf": say(CURSE.cureWolf(S)); break;
      case "curevamp": say(CURSE.cureVampire(S)); break;
      case "vfeed": say(CURSE.feed(S)); break;
      case "jgo": { const f0 = jFolds(); if (f0[b.dataset.id]) { f0[b.dataset.id] = false; try { localStorage.setItem("ux_jfold", JSON.stringify(f0)); } catch { /* fine */ } renderPanel(true); } const el = $("#j-" + b.dataset.id); if (el) { const y = el.getBoundingClientRect().top + scrollY - 64; scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }); } break; }
      case "festclaim": { const m = FEST.claim(S); if (!m) break; SOUND.fx("levelup"); say(m); publishCard(); break; }
      case "festgift": { const m = FEST.innGift(S); if (m) { SOUND.fx("coin"); say(m); } break; }
      case "clancol": clanDraft = { ...clanDraft, name: $("#clanname")?.value, tag: $("#clantag")?.value }; clanDraft.colors[+b.dataset.i] = b.dataset.id; renderPanel(true); break;
      case "clanfound": { const r = CLANS.found(S, $("#clanname")?.value, $("#clantag")?.value, clanDraft.colors); if (r.err) return toast(r.err); Store.put("clans", S.id, r.clan); CLANS.set([...CLANS.all.filter((x) => x.id !== S.id), { ...r.clan, id: S.id }], null); persist(true); postNews(`🏴 ${S.name} raised the banner of ${r.clan.name} [${r.clan.tag}].`); say(r.text); break; }
      case "claninv": { const c = myClan(); if (!c || c.founder !== S.id) break; const r = CLANS.invite(c, b.dataset.id); if (r.err) return toast(r.err); Store.put("clans", S.id, (({ id, ...x }) => x)(r.clan)); toast("Invitation sent."); break; }
      case "clankick": { const c = myClan(); if (!c || c.founder !== S.id) break; Store.put("clans", S.id, (({ id, ...x }) => x)(CLANS.kick(c, b.dataset.id).clan)); toast("They're no longer in the clan."); break; }
      case "clanjoin": { const r = CLANS.join(S, CLANS.byId(b.dataset.id)); if (r.err) return toast(r.err); persist(true); say(r.text); break; }
      case "clanleave": { const c = myClan(); if (c && c.founder === S.id) { Store.remove("clans", S.id); postNews(`🏴 The banner of ${c.name} was lowered.`); } say(CLANS.leave(S)); persist(true); break; }
      case "achmore": achOpen = !achOpen; renderPanel(true); break;
      case "guide": openGuide(); persist(); break;
      case "notes": openNotes(); break;
      case "guideno": S.guideOffered = true; persist(); renderPanel(true); toast("You can open the guide any time from ⚙ or the Journal."); break;
      case "guidego": guideGo(b.dataset.id); break;
      case "tutskip": S.tut = { ...S.tut, step: 0, off: true }; persist(); renderPanel(true); toast("Tutorial skipped. You can replay it from How to Play in the main menu."); break;
      case "tutseen": S.tut.seen = { ...(S.tut.seen || {}), [tab]: true }; persist(); renderPanel(true); break;
      case "pinicon": pinDraft.icon = b.dataset.id; { const v = $("#pinlabel")?.value || ""; openPinDialog(pinDraft.x, pinDraft.y); $("#pinlabel").value = v; } break;
      case "pinsave": { const id = addPin(pinDraft.x, pinDraft.y, $("#pinlabel")?.value, pinDraft.icon); closeModal(); if (id) { selected = "__pin:" + id; renderPicked(); SOUND.fx("click"); } break; }
      case "pindel": S.pins = (S.pins || []).filter((p) => p.id !== b.dataset.id); selected = null; renderPicked(); persist(); break;
      case "pinshare": { const p = (S.pins || []).find((q) => q.id === b.dataset.id); if (!p || !party) break; Store.put("chat", nid(), { from: S.id, name: S.name, text: `${p.icon} ${p.label}`, ch: party.id, t: G.now(), pin: { x: p.x, y: p.y, label: p.label, icon: p.icon } }); toast("Shared with your party in the chat."); break; }
      case "pinadd": { const d = chatDocs.find((x) => x.id === b.dataset.id); if (!d?.pin) break; const id = addPin(d.pin.x, d.pin.y, d.pin.label, d.pin.icon); if (id) { tab = "map"; renderTabs(); renderPanel(true); selected = "__pin:" + id; renderPicked(); follow = false; center = [d.pin.x, d.pin.y]; if (zoom < 2) zoom = 2.4; $("#mapwrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); } break; }
      case "duelstake": arenaStake = +b.dataset.id; renderPanel(true); break;
      case "duelgo": { const c = others.find((o) => o.id === b.dataset.id); const r = ARENA.challenge(S, c && { ...c, id: c.id }, arenaStake); if (r.err) return toast(r.err); Store.put("duels", r.id, r.doc); persist(true); say(r.text); break; }
      case "duelyes": answerDuel(b.dataset.id, true); break;
      case "duelno": answerDuel(b.dataset.id, false); break;
      case "duelcancel": Store.change("duels", b.dataset.id, (d) => (d.status === "open" ? { ...d, status: "cancelled" } : d)); break;
      case "fishgo": GUIDE.mark(S, "fish"); openFishing(); break;
      case "fishreel": reelIn(); break;
      case "fishstop": cancelAnimationFrame(fishRaf); fishState = null; closeModal(); renderPanel(true); break;
      case "cook": GUIDE.mark(S, "cook"); say(COOK.cook(S, b.dataset.id)); SOUND.fx("potion"); break;
      case "camp": say(COOK.makeCamp(S)); break;
      case "eatfood": say(COOK.eatFood(S, +b.dataset.id)); if ($("#sky")) renderMenu(); break;
      case "giftgold": sendGift("gold", +b.dataset.id); break;
      case "giftitem": sendGift("item", +b.dataset.id); break;
      case "giftnote": sendGift("note"); break;
      case "motto": say(VISITS.setMotto(S, $("#motto")?.value)); publishHome(); break;
      case "showcase": say(VISITS.toggleShow(S, S.location, +b.dataset.id)); publishHome(); break;
      case "giftopen": {
        const id = b.dataset.id;
        Promise.resolve(Store.change("gifts", id, (g) => (g.to === S.id ? null : g))).then((res) => {
          if (!res?.before || res.before.to !== S.id || res.after) return toast("That gift is gone.");
          SOUND.fx("coin"); say(VISITS.receive(S, res.before)); publishHome();
        });
        break;
      }
      case "hcoat": horseCoat = b.dataset.id; renderPanel(true); break;
      case "cartbuy": say(CARAVANS.buyCart(S)); publishCard(); break;
      case "cartwheels": say(CARAVANS.buyWheels(S)); break;
      case "carttoggle": say(CARAVANS.toggleCart(S)); break;
      case "cvsign": { const r = CARAVANS.signOn(S, b.dataset.id); if (r.err) return toast(r.err); Store.put("guards", r.id, r.doc); guardDocs.push({ ...r.doc, id: r.id }); lastJobId = S.caravanJob.id; persist(true); say(r.text); break; }
      case "cvleave": { const id = S.caravanJob?.id, m = CARAVANS.leave(S); if (id) Store.change("guards", `${id}-${S.id}`, (d) => (d ? { ...d, status: "left" } : d)); persist(true); say(m || "You're not with a caravan."); break; }
      case "cvbuy": say(CARAVANS.buy(S, b.dataset.id, b.dataset.item)); break;
      case "hbuy": say(HORSES.buy(S, $("#hname")?.value, horseCoat)); publishCard(); break;
      case "hrename": say(HORSES.rename(S, $("#hname")?.value)); break;
      case "harmor": say(HORSES.buyArmor(S, b.dataset.id)); break;
      case "hfetch": say(HORSES.fetch(S)); publishCard(); break;
      case "hhurry": say(HORSES.hurry(S)); publishCard(); break;
      case "hride": { const m = HORSES.toggle(S); liveCache.key = ""; S.trip && (S.trip.total = G.minutesLeft(S)); say(m); renderTrip(); publishCard(); break; }
      case "bclaim": { const m = BOUNTY.claim(S, +b.dataset.w, b.dataset.id); if (!m) return toast("Nothing to claim there."); SOUND.fx("quest"); say(m); publishCard(); break; }
      case "hallgold": case "hallmat": {
        const r = a === "hallgold" ? HALL.donateGold(S, +b.dataset.id) : HALL.donateMat(S, +b.dataset.id, +b.dataset.n);
        if (r.err) return toast(r.err);
        Store.put("hall", S.id, { name: S.name, pts: S.hallPts, t: G.now() });
        if (r.after > r.before) { postNews(`⚑ The Hall of the North is now a ${HALL.TIERS[r.after][0]}, thanks to ${S.name} and everyone who gave.`); SOUND.fx("levelup"); } else SOUND.fx("coin");
        say(r.text); publishCard(); break;
      }
      case "hallput": { const r = HALL.deposit(S, +b.dataset.id); if (r.err) return toast(r.err); Store.put("hallchest", nid(), { item: r.item, by: S.name, t: G.now() }); say(r.text); break; }
      case "halltake": {
        if (!HALL.canTake(S)) return toast(`You've taken ${HALL.CHEST_PER_DAY} things today. Come back tomorrow.`);
        const id = b.dataset.id;
        Promise.resolve(Store.change("hallchest", id, () => null)).then((res) => { if (!res?.before?.item) return toast("Too late. Someone took it."); say(HALL.took(S, res.before.item)); });
        break;
      }
      case "deedpick": { const i = +b.dataset.id, d = BARDS.deeds(S)[i]; deedPick = i; verseDraft = d ? d[1] : verseDraft; renderPanel(true); break; }
      case "versewrite": {
        const raw = $("#versein")?.value ?? verseDraft, tag = deedPick != null ? BARDS.deeds(S)[deedPick]?.[0] : "";
        const r = BARDS.write(S, raw, tag, verseDocs); if (r.err) return toast(r.err);
        Store.put("verses", r.id, r.doc); if (!verseDocs.some((x) => x.id === r.id)) verseDocs.push({ ...r.doc, id: r.id }); verseDraft = ""; deedPick = null; SOUND.fx("page"); say(r.text); renderPanel(true); break; }
      case "verselike": {
        const v = verseDocs.find((x) => x.id === b.dataset.id), r = BARDS.like(S, v, likeDocs); if (r.err) return toast(r.err);
        Store.put("verselikes", r.id, r.doc); if (!likeDocs.some((x) => x.id === r.id)) likeDocs.push({ ...r.doc, id: r.id }); SOUND.fx("click"); toast(`👍 You cheer for ${v.name}'s verse.`); renderPanel(true); break; }
      case "bardsing": singSong(); break;
      case "inn": say(b.dataset.c === "room" ? TOWNS.rentRoom(S) : TOWNS.rumour(S)); break;
      case "train": say(TOWNS.train(S, b.dataset.id)); publishCard(); break;
      case "alch": { const id = +b.dataset.id; alchSel = alchSel.includes(id) ? alchSel.filter((x) => x !== id) : [...alchSel, id].slice(-3); renderPanel(true); break; }
      case "brew": { const before = S.inv.filter((x) => String(x.item).startsWith("brew|")).reduce((a, x) => a + x.qty, 0); const r = TOWNS.brew(S, alchSel); const made = S.inv.filter((x) => String(x.item).startsWith("brew|")).reduce((a, x) => a + x.qty, 0) - before; if (made > 0) tally("potions", made); alchSel = []; persist(); renderPanel(true); showMessage("Alchemy", r.text + ((r.skills || []).length ? " 📈 " + r.skills.join(" · ") : "")); break; }
      case "temper": GUIDE.mark(S, "smith"); say(TOWNS.temper(S, +b.dataset.id)); publishCard(); break;
      case "soctab": socTab = b.dataset.id; socWith = null; renderPanel(true); break;
      case "fadd": case "faddrec": { const c = cardOf(b.dataset.id) || (() => { const d = friendDocs.find((x) => x.id === b.dataset.id); return d ? { id: d.id, name: d.name } : null; })(); if (!c) return toast("They're not around."); const m = SOCIAL.add(S, c); persist(true); publishFriends(); toast(m); renderPanel(true); renderTabs(); break; }
      case "fdelask": fRemoveAsk = b.dataset.id; renderPanel(true); break;
      case "fdel": toast(SOCIAL.remove(S, b.dataset.id)); fRemoveAsk = null; persist(true); publishFriends(); renderPanel(true); break;
      case "fmsg": socTab = "msgs"; socWith = b.dataset.id; tab = "social"; renderTabs(); renderPanel(true); setTimeout(() => { const cl = $("#chatlog"); if (cl) cl.scrollTop = cl.scrollHeight; }, 20); break;
      case "dmback": socWith = null; renderPanel(true); break;
      case "dmsend": sendDM(); break;
      case "ftrade": { const c = friendCard(b.dataset.id); if (c) { tradeSel = []; openTrade(c); } break; }
      case "craftgo": { const r = SPELLCRAFT.craft(S, craftChoices(), craftDraft.name); if (r.err) return toast(r.err); craftDraft = { a: "", am: 0, b: "", bm: 0, name: "" }; SOUND.fx("coin"); persist(true); say(r.text); renderPanel(true); break; }
      case "craftdel": say(SPELLCRAFT.forget(S, b.dataset.id)); persist(true); renderPanel(true); break;
      case "mine": { const m = SMITH.mine(S); if (m.startsWith("⛏")) { SOUND.fx("clang"); persist(true); } say(m); renderPanel(true); break; }
      case "ftab": forgeTab = b.dataset.id; renderPanel(true); break;
      case "fgroup": forgeGroup = b.dataset.id; renderPanel(true); break;
      case "smake": { const m = SMITH.make(S, b.dataset.id); if (/^You make/.test(m)) { GUIDE.mark(S, "smith"); SOUND.fx("clang"); tally("crafted"); persist(true); publishCard(); } say(m); break; }
      case "srefine": case "srefineall": { const m = SMITH.refine(S, +b.dataset.id, a === "srefineall"); if (/^You (smelt|tan)/.test(m)) persist(true); say(m); break; }
      case "takejob": say(TOWNS.takeJob(S, b.dataset.id)); break;
      case "dropjob": say(TOWNS.dropJob(S, b.dataset.id)); break;
      case "handin": say(TOWNS.handIn(S, b.dataset.id)); break;
      case "pickpocket": { const r = TOWNS.pickTownsfolk(S); persist(true); renderPanel(true); showMessage("The streets", r.text + ((r.skills || []).length ? " 📈 " + r.skills.join(" · ") : "")); break; }
      case "guardopen": openGuard(); break;
      case "guard": guardAction(b.dataset.c); break;
      case "invite": { const c = cardOf(b.dataset.id); if (c) invite(c); break; }
      case "accept": acceptInvite(b.dataset.id); break;
      case "decline": declineInvite(b.dataset.id); break;
      case "leaveparty": leaveParty(); break;
      case "share": chestShare(b.dataset.id); break;
      case "grab": chestGrab(b.dataset.id); break;
      case "attack": { const c = cardOf(b.dataset.id); if (c) doAttack(c); break; }
      case "pick": { const c = cardOf(b.dataset.id); if (c) doPickpocket(c); break; }
      case "ambush": S.ambush = !S.ambush; persist(true); toast(S.ambush ? "You crouch in the brush beside the road and wait." : "You step back onto the road."); renderPanel(true); break;
      case "rup": case "rdown": { const i = +b.dataset.i, j = a === "rup" ? i - 1 : i + 1; if (j < 0 || j >= L.rules.length || !L.rules[i]) break; [L.rules[i], L.rules[j]] = [L.rules[j], L.rules[i]]; tacticsDraft.edit = null; persist(); renderPanel(true); break; }
      case "rdel": { const i = +b.dataset.i; if (!L.rules[i]) break; const [gone] = L.rules.splice(i, 1); tacticsDraft.edit = null; persist(); renderPanel(true); toast(`Removed: ${G.describeRule(gone).cond} → ${G.describeRule(gone).act}`); break; }
      case "roff": { const r = L.rules[+b.dataset.i]; if (!r) break; if (r.off) delete r.off; else r.off = true; persist(); renderPanel(true); break; }
      case "redit": { const r = L.rules[+b.dataset.i]; if (!r) break; Object.assign(tacticsDraft, { if: r.if, do: r.do, pct: r.pct ?? 50, edit: +b.dataset.i }); renderPanel(true); $("#tedit")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); break; }
      case "rcancel": tacticsDraft.edit = null; renderPanel(true); break;
      case "rsave": case "radd": { GUIDE.mark(S, "tactics");
        const r = { if: tacticsDraft.if, do: tacticsDraft.do }; if (D.CONDITIONS[r.if]?.[1]) r.pct = tacticsDraft.pct;
        if (a === "rsave" && L.rules[tacticsDraft.edit]) { const old = L.rules[tacticsDraft.edit]; if (old.off) r.off = true; L.rules[tacticsDraft.edit] = r; tacticsDraft.edit = null; toast("Rule saved."); }
        else if (!G.addRule(L.rules, r)) return toast(`Max ${D.MAX_RULES} rules.`);
        else toast(`Rule ${L.rules.indexOf(r) + 1} added.`);
        persist(); renderPanel(true); break;
      }
      case "preset": pendingPreset = b.dataset.id; renderPanel(true); break;
      case "presetno": pendingPreset = null; renderPanel(true); break;
      case "presetyes": { const id = pendingPreset; pendingPreset = null; if (!D.PRESETS[id]) break; L.rules = G.clone(D.PRESETS[id].rules); tacticsDraft.edit = null; say(`${D.PRESETS[id].name} tactics loaded. Rules for spells you don't know are skipped.`); break; }
      case "test": {
        const name = $("#te").value, e2 = G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === name), S.level);
        const sim = G.clone(S); sim.health = G.maxHealth(sim); sim.healthTs = G.now(); sim._test = true;
        const f = new G.Fight(sim, e2); f.run();
        testResult = { f, name }; renderPanel(true); break;
      }
      case "lo": if (S.trip?.status === "encounter") return toast("Not in the middle of a fight!"); S.loadout = b.dataset.name; tacticsDraft.edit = null; pendingPreset = null; say(`Switched to ${S.loadout}: its own gear and tactics.`); break;
      case "losave": { const n = ($("#lon").value || "").trim().slice(0, 20); if (!n) return toast("Give it a name first."); say(G.saveLoadoutAs(S, n)); break; }
      case "lodel": pendingDel = true; renderPanel(true); setTimeout(() => { if (pendingDel) { pendingDel = false; if (tab === "tactics") renderPanel(true); } }, 5000); break;
      case "lodelyes": pendingDel = false; tacticsDraft.edit = null; say(G.deleteLoadout(S, S.loadout)); break;
    }
  }

  boot().catch((err) => { console.error(err); app.innerHTML = `<div class="panel" style="margin-top:24px"><h2>Something went wrong</h2><p class="sub">${esc(err.message)}</p></div>`; });
}
